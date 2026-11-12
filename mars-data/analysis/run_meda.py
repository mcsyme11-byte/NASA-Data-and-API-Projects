# NASA and ESA Data Projects · Mars Data · Perseverance MEDA: download, clean and summarise
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Usage:
#   python3 run_meda.py sol_0000_0089 [sol_0090_0179 ...]   process these folders (chunks) of NASA's MEDA archive
#   python3 run_meda.py --list                              list the archive's chunks
#
# Reads the derived (highest-level) MEDA tables for each sol from NASA's Planetary Data System, Atmospheres Node:
# pressure (PS), humidity (RHS) and rover position (ANCILLARY). Rules: CLEANING-MEDA.md. Writes, in
# mars-data/data/meda/: sols.csv (daily statistics), hourly.csv, manifest.csv and reports/<chunk>.md.
# Raw downloads are never stored.
import argparse
import csv
import hashlib
import io
import re
import sys
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

from mars_time import from_j2000_seconds, ls_and_year
from run_rems import get, listing, merge_csv  # same polite download helpers as REMS

BASE = "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/"
OUT = Path(__file__).resolve().parent.parent / "data" / "meda"
RULES_VERSION = "1.0"

NEEDED = {  # columns read from each table; the files' own header rows are checked for them
    "PS": ["SCLK", "LMST", "PRESSURE", "TRANSDUCER"],
    "RHS": ["SCLK", "LMST", "LOCAL_RELATIVE_HUMIDITY", "VOLUME_MIXING_RATIO"],
    "ANCILLARY": ["SCLK", "LMST", "ROVER_POSITION_Z"],
}
LIMITS = {"pressure": (400.0, 1200.0), "humidity": (0.0, 100.0), "water_vapour": (0.0, 400.0)}
HUMIDITY_FROM_SOL = 63      # NASA's readme: humidity before sol 63 is not reliable
MIN_SECONDS_PER_HOUR = 60
FULL_SOL_HOURS = 10         # MEDA measures about 12 of 24 hours a sol (rule M5)
NIGHT_HOURS = (2.0, 6.0)
SENTINEL = 9999999999.0     # NASA's readme: an invalid value in some columns


def read_csv(raw: bytes, kind: str) -> pd.DataFrame:
    rows = list(csv.reader(io.StringIO(raw.decode("ascii", "replace"))))
    header = [c.strip() for c in rows[0]] if rows else []
    missing = [c for c in NEEDED[kind] if c not in header]
    if missing:
        raise ValueError(f"{kind}: columns {missing} are missing from the file (header: {header})")
    df = pd.DataFrame([r for r in rows[1:] if len(r) == len(header)], columns=header)[NEEDED[kind]]
    for c in NEEDED[kind]:
        if c != "LMST":
            df[c] = pd.to_numeric(df[c].str.strip(), errors="coerce")
            df.loc[df[c] >= SENTINEL, c] = float("nan")
    lm = df["LMST"].str.strip().str.extract(r"^(\d{5})M(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$")
    df["sol"] = pd.to_numeric(lm[0], errors="coerce")
    df["hour"] = pd.to_numeric(lm[1]) + pd.to_numeric(lm[2]) / 60 + pd.to_numeric(lm[3]) / 3600
    return df


def process_sol(chunk: str, sol_dir: str) -> dict:
    sol = int(sol_dir.strip("/").split("_")[1])
    url = BASE + chunk + "/" + sol_dir
    files = listing(url)
    res: dict = {"sol": sol, "files": [], "problem": "", "report": Counter()}
    tables = {}
    for kind in ("PS", "RHS", "ANCILLARY"):
        name = [f for f in files if re.search(rf"_DER_{kind}_+P\d+\.CSV$", f)]
        if len(name) != 1:
            if kind == "PS":
                res["problem"] = f"{len(name)} pressure tables in the folder"
                return res
            continue
        raw = get(url + name[0])
        res["files"].append({"sol": sol, "file": chunk + "/" + sol_dir + name[0], "bytes": len(raw),
                             "sha256": hashlib.sha256(raw).hexdigest()})
        tables[kind] = read_csv(raw, kind)
    rep = res["report"]

    ps = tables["PS"]
    rep["rows_read"] = len(ps)
    dup = ps["SCLK"].duplicated()
    rep["rows_duplicate_time"] = int(dup.sum())
    ps = ps[~dup & ps["sol"].notna()]
    rep["rows_other_sol"] = int((ps["sol"] != sol).sum())
    ps = ps[ps["sol"] == sol]
    lo, hi = LIMITS["pressure"]
    rep["pressure_missing"] = int(ps["PRESSURE"].isna().sum())
    rep["pressure_outside_limits"] = int((ps["PRESSURE"].notna() & ~ps["PRESSURE"].between(lo, hi)).sum())
    ps = ps[ps["PRESSURE"].between(lo, hi)]
    rep["pressure_kept"] = len(ps)

    out: dict = {"sol": sol}
    if len(ps):
        t = from_j2000_seconds(float(ps["SCLK"].median()))
        out["utc_date"] = t.strftime("%Y-%m-%d")
        ls, my = ls_and_year(t)
        out["ls"], out["mars_year"] = round(ls, 2), my
    hourly = {}
    g = ps.groupby(ps["hour"].astype(int))["PRESSURE"]
    n = g.count()
    hm = g.mean()[n >= MIN_SECONDS_PER_HOUR]
    out["pressure_hours"] = int(len(hm))
    out["pressure_full"] = bool(len(hm) >= FULL_SOL_HOURS)
    if len(hm):
        out["pressure_mean"] = round(float(hm.mean()), 2)
        hourly["pressure"] = {int(h): round(float(v), 2) for h, v in hm.items()}

    if "RHS" in tables and sol >= HUMIDITY_FROM_SOL:
        rh = tables["RHS"]
        rh = rh[(rh["sol"] == sol)]
        rep["humidity_read"] = len(rh)
        ok_h = rh["LOCAL_RELATIVE_HUMIDITY"].between(*LIMITS["humidity"])
        rep["humidity_kept"] = int(ok_h.sum())
        h = rh[ok_h]
        if len(h):
            minute = (h["hour"] * 60).astype(int)
            mg = h.groupby(minute)["LOCAL_RELATIVE_HUMIDITY"]
            med = mg.median()[mg.count() >= 30]
            if len(med):
                out["humidity_max"] = round(float(med.max()), 2)
                out["humidity_max_hour"] = round(float(med.idxmax() / 60), 2)
        v = rh[rh["VOLUME_MIXING_RATIO"].between(*LIMITS["water_vapour"]) & rh["hour"].between(*NIGHT_HOURS)]
        if len(v) >= MIN_SECONDS_PER_HOUR:
            out["water_vapour_night"] = round(float(v["VOLUME_MIXING_RATIO"].median()), 1)
    elif sol < HUMIDITY_FROM_SOL:
        rep["humidity_before_sol_63"] = 1

    if "ANCILLARY" in tables:
        z = tables["ANCILLARY"]["ROVER_POSITION_Z"].dropna()
        if len(z):
            out["rover_z_m"] = round(float(z.median()), 2)
    out["rules"] = RULES_VERSION
    res["summary"] = out
    res["hourly"] = hourly
    return res


def write_report(chunk: str, results: list[dict]) -> str:
    ok = [r for r in results if not r["problem"]]
    probs = [r for r in results if r["problem"]]
    tot: Counter = Counter()
    for r in ok:
        tot.update(r["report"])
    summ = pd.DataFrame([r["summary"] for r in ok]).sort_values("sol") if ok else pd.DataFrame()
    m = re.match(r"sol_(\d{4})_(\d{4})$", chunk)
    expected = range(int(m.group(1)), int(m.group(2)) + 1) if m else range(0)
    got = {r["sol"] for r in results}
    none = [s for s in expected if s not in got]
    lines = [f"# Cleaning report: Perseverance MEDA, {chunk}", "",
             f"Processed {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC with MEDA cleaning rules version "
             f"{RULES_VERSION} (mars-data/analysis/CLEANING-MEDA.md).", "",
             f"- Sols in this chunk's range: {len(expected)}; with a data folder: {len(got)}; processed: {len(ok)}",
             f"- Sols with no folder (no MEDA data released): {len(none)}" + (f" — {', '.join(map(str, none))}" if none else ""),
             f"- Sols with a problem (not processed): {len(probs)}" + "".join(f"\n  - sol {r['sol']}: {r['problem']}" for r in probs)]
    if len(summ):
        full = int(summ["pressure_full"].sum())
        lines.append(f"- Pressure: {full} full sols (good data in at least {FULL_SOL_HOURS} local hours), {len(summ) - full} partial")
    lines += ["", f"- Pressure rows read: {tot['rows_read']:,}; duplicate times removed: {tot['rows_duplicate_time']:,}; "
              f"on another sol (not used): {tot['rows_other_sol']:,}",
              f"- Pressure missing (NASA leaves the value empty when not reliable): {tot['pressure_missing']:,}",
              f"- Pressure outside {LIMITS['pressure'][0]:.0f}–{LIMITS['pressure'][1]:.0f} Pa (removed): {tot['pressure_outside_limits']:,}",
              f"- Pressure kept: {tot['pressure_kept']:,}",
              f"- Humidity readings kept: {tot['humidity_kept']:,} of {tot['humidity_read']:,}"
              + (f"; sols before sol {HUMIDITY_FROM_SOL} without humidity (NASA: not reliable): {tot['humidity_before_sol_63']}"
                 if tot['humidity_before_sol_63'] else "")]
    review = []
    if len(summ):
        s = summ[summ["pressure_full"]].set_index("sol")["pressure_mean"]
        j = s.diff()[s.index.to_series().diff() == 1]
        review += [f"- sol {k}: daily mean pressure changed by {v:+.1f} Pa from the sol before" for k, v in j[j.abs() > 15].items()]
        lines += ["", f"Season covered: Mars Year {int(summ['mars_year'].min())}, Ls {summ.iloc[0]['ls']:.1f}° to Mars Year "
                  f"{int(summ['mars_year'].max())}, Ls {summ.iloc[-1]['ls']:.1f}° (Earth dates {summ.iloc[0]['utc_date']} to "
                  f"{summ.iloc[-1]['utc_date']})"]
    lines += ["", "## To review (nothing removed)", ""] + (review or ["- Nothing flagged."])
    lines += ["", "---", "", "Data: NASA Planetary Data System, Atmospheres Node; Mars 2020 MEDA derived data "
              "(DOI 10.17189/1522849). Report generated by mars-data/analysis/run_meda.py.", ""]
    return "\n".join(lines)


def run_chunk(chunk: str) -> None:
    sol_dirs = [d for d in listing(BASE + chunk + "/") if re.match(r"sol_\d{4}/$", d)]
    print(f"{chunk}: {len(sol_dirs)} sol folders", flush=True)

    def safe(d: str) -> dict:
        try:
            return process_sol(chunk, d)
        except Exception as e:
            return {"sol": int(d.strip("/").split("_")[1]), "files": [], "problem": f"{type(e).__name__}: {e}",
                    "report": Counter()}

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(safe, sol_dirs))
    ok = [r for r in results if not r["problem"]]
    if ok:
        merge_csv(OUT / "sols.csv", pd.DataFrame([r["summary"] for r in ok]), ["sol"])
        hourly = [{"sol": r["sol"], "hour": h, "pressure": v} for r in ok for h, v in r["hourly"].get("pressure", {}).items()]
        if hourly:
            merge_csv(OUT / "hourly.csv", pd.DataFrame(hourly), ["sol", "hour"])
    files = [f for r in results for f in r["files"]]
    if files:
        merge_csv(OUT / "manifest.csv", pd.DataFrame(files), ["file"])
    (OUT / "reports").mkdir(parents=True, exist_ok=True)
    (OUT / "reports" / f"{chunk}.md").write_text(write_report(chunk, results))
    print(f"{chunk}: {len(ok)} sols processed", flush=True)


def archive_chunks() -> list[str]:
    return [d.strip("/") for d in listing(BASE) if re.match(r"sol_\d{4}_\d{4}/$", d)]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("chunks", nargs="*")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    chunks = archive_chunks()
    if a.list:
        print("\n".join(chunks))
        return
    for c in a.chunks:
        if c not in chunks:
            sys.exit(f"{c} is not a chunk in the MEDA archive")
        run_chunk(c)


if __name__ == "__main__":
    main()
