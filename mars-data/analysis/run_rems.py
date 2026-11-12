# NASA and ESA Data Projects · Mars Data · Curiosity REMS: download, clean and summarise a chunk of sols
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Usage:
#   python3 run_rems.py SOL_00001_00089 [SOL_00090_00179 ...]   process these folders (chunks) of the archive
#   python3 run_rems.py --list                                   list the archive's chunks and which are processed
#
# For each sol in a chunk: downloads the MODRDR table and label and the ADR table, applies the rules in CLEANING.md,
# and writes, in mars-data/data/rems/:
#   sols.csv      one row of daily statistics per sol (rows for re-processed sols are replaced)
#   hourly.csv    hourly means per sol
#   manifest.csv  every file used: size, SHA-256, NASA's product version and creation time
#   reports/<chunk>.md   the cleaning report for the chunk
# Raw downloads are kept only in a temporary folder and never committed.
import argparse
import hashlib
import re
import sys
import time
import urllib.request
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import rems

BASE = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/"
UA = {"User-Agent": "NASA-ESA-Data-Projects/1.0 (educational; github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects)"}
OUT = Path(__file__).resolve().parent.parent / "data" / "rems"


def get(url: str, tries: int = 4) -> bytes:
    for i in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=120) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(5 * (i + 1))
    raise RuntimeError("unreachable")


def listing(url: str) -> list[str]:
    html = get(url).decode("utf-8", "replace")
    return sorted({h for h in re.findall(r'href="([^"?#]+)"', html) if not h.startswith(("/", "http", "..", "mailto"))})


def label_value(lbl: str, key: str) -> str:
    m = re.search(rf"^\s*{key}\s*=\s*\"?([^\"\r\n]*)", lbl, re.M)
    return m.group(1).strip() if m else ""


def process_sol(chunk: str, sol_dir: str, mod_names: list[str], adr_names: list[str]) -> dict:
    sol = int(sol_dir.strip("/")[3:])
    url = BASE + "DATA/" + chunk + "/" + sol_dir
    files = listing(url)
    res: dict = {"sol": sol, "files": [], "problem": ""}
    mod_tab = [f for f in files if "RMD" in f and f.upper().endswith(".TAB")]
    adr_tab = [f for f in files if "ADR" in f and f.upper().endswith(".TAB")]
    if len(mod_tab) != 1:
        res["problem"] = f"{len(mod_tab)} MODRDR tables in the folder"
        return res
    raw = get(url + mod_tab[0])
    lbl_name = mod_tab[0][:-4] + ".LBL"
    lbl = get(url + lbl_name).decode("ascii", "replace") if lbl_name in files else ""
    res["files"].append({"sol": sol, "file": chunk + "/" + sol_dir + mod_tab[0], "bytes": len(raw),
                         "sha256": hashlib.sha256(raw).hexdigest(),
                         "product_version": label_value(lbl, "PRODUCT_VERSION_ID"),
                         "created": label_value(lbl, "PRODUCT_CREATION_TIME")})
    rows_label = label_value(lbl, "FILE_RECORDS")
    df = rems.read_table(raw, mod_names)
    if rows_label and int(rows_label) != len(df):
        raise ValueError(f"sol {sol}: label says {rows_label} rows, file has {len(df)}")
    adr = None
    if len(adr_tab) == 1:
        araw = get(url + adr_tab[0])
        albl_name = adr_tab[0][:-4] + ".LBL"
        albl = get(url + albl_name).decode("ascii", "replace") if albl_name in files else ""
        res["files"].append({"sol": sol, "file": chunk + "/" + sol_dir + adr_tab[0], "bytes": len(araw),
                             "sha256": hashlib.sha256(araw).hexdigest(),
                             "product_version": label_value(albl, "PRODUCT_VERSION_ID"),
                             "created": label_value(albl, "PRODUCT_CREATION_TIME")})
        try:
            adr = rems.read_adr(araw, adr_names, albl)
        except ValueError as e:  # the weather data is still used; the sol has no rover height
            res["note"] = f"ADR not used: {e}"
    else:
        res["note"] = f"{len(adr_tab)} ADR tables in the folder; no rover height"
    cleaned, report = rems.clean(df, sol)
    res["report"] = report
    res["summary"] = rems.summarise(cleaned, sol, adr)
    res["hourly"] = rems.hourly_profile(cleaned, sol)
    other = sorted(set(cleaned["sol"]) - {sol})
    res["other_sols"] = other
    return res


def merge_csv(path: Path, new: pd.DataFrame, key: list[str]) -> pd.DataFrame:
    if path.exists():
        old = pd.read_csv(path)
        old = old[~old.set_index(key).index.isin(new.set_index(key).index)]
        new = pd.concat([old, new], ignore_index=True)
    new = new.sort_values(key).reset_index(drop=True)
    path.parent.mkdir(parents=True, exist_ok=True)
    new.to_csv(path, index=False)
    return new


def write_report(chunk: str, results: list[dict], expected: range) -> str:
    got = {r["sol"] for r in results}
    no_folder = [s for s in expected if s not in got]
    problems = [r for r in results if r["problem"]]
    ok = [r for r in results if not r["problem"]]
    tot: Counter = Counter()
    for r in ok:
        tot.update(r["report"])
    summ = pd.DataFrame([r["summary"] for r in ok]).sort_values("sol") if ok else pd.DataFrame()

    def pct(a, b):
        return f"{100 * a / b:.1f} %" if b else "–"

    lines = [f"# Cleaning report: Curiosity REMS, {chunk}", "",
             f"Processed {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC with cleaning rules version "
             f"{rems.RULES_VERSION} (mars-data/analysis/CLEANING.md).", "",
             "## Sols", "",
             f"- Sols in this chunk's range: {len(expected)} ({expected.start}–{expected.stop - 1})",
             f"- Sols with a data folder: {len(got)}; processed: {len(ok)}",
             f"- Sols with no folder (no REMS data released): {len(no_folder)}"
             + (f" — {', '.join(map(str, no_folder))}" if no_folder else ""),
             f"- Sols without rover height (ADR file missing or unreadable): "
             f"{sum(1 for r in ok if r.get('note'))}"
             + "".join(f"\n  - sol {r['sol']}: {r['note']}" for r in ok if r.get("note")),
             f"- Sols with a problem (not processed): {len(problems)}"
             + "".join(f"\n  - sol {r['sol']}: {r['problem']}" for r in problems)]
    if len(summ):
        for name, label in [("pressure", "Pressure"), ("air_temp", "Air temperature"),
                            ("ground_temp", "Ground temperature")]:
            full = int(summ[f"{name}_full"].sum())
            lines.append(f"- {label}: {full} full sols (good data in at least {rems.FULL_SOL_HOURS} of 24 local hours), "
                         f"{len(summ) - full} partial")
    lines += ["", "## Rows (one row = one second of measurements)", "",
              f"- Rows read: {tot['rows_read']:,}",
              f"- Removed as duplicate timestamps: {tot['rows_duplicate_timestamp']:,}",
              f"- Removed for an unreadable local time: {tot['rows_bad_local_time']:,}",
              f"- Rows whose local time falls on a neighbouring sol (counted, not used): {tot['rows_other_sol']:,}", "",
              "| Measurement | Missing in the file | Failed NASA's quality flags | Outside physical limits | Kept |",
              "|---|---:|---:|---:|---:|"]
    for name, label in [("pressure", "Pressure"), ("air_temp", "Air temperature"), ("ground_temp", "Ground temperature"),
                        ("humidity", "Relative humidity"), ("water_vapour", "Water vapour")]:
        n = tot["rows_read"] - tot["rows_duplicate_timestamp"] - tot["rows_bad_local_time"]
        lines.append(f"| {label} | {tot[f'{name}_missing']:,} | {tot[f'{name}_failed_flags']:,} | "
                     f"{tot[f'{name}_outside_limits']:,} | {tot[f'{name}_kept']:,} ({pct(tot[f'{name}_kept'], n)}) |")
    lines += ["", f"Air temperature readings removed as single-hour glitches (rule 11): {tot['air_temp_spike_rows']:,}"
              + (f" on sols {', '.join(str(r['sol']) for r in ok if r['report'].get('air_temp_spike_rows'))}"
                 if tot['air_temp_spike_rows'] else ""),
              "", "Kept with a note (not removed):", "",
              f"- Pressure readings from oscillator 1 (the sensor has two; oscillator 2 is used most of the time): "
              f"{tot['pressure_oscillator_1']:,}",
              f"- Ground temperature readings with the sensor's power supply flagged out of range: "
              f"{tot['ground_temp_power_out_of_range']:,} ({pct(tot['ground_temp_power_out_of_range'], tot['ground_temp_kept'])} of kept)",
              f"- Relative humidity readings marked \"preliminary\" by NASA: {tot['humidity_preliminary']:,} "
              f"({pct(tot['humidity_preliminary'], tot['humidity_kept'])} of kept)"]

    review = []
    if len(summ):
        s = summ[summ["pressure_full"]].set_index("sol")["pressure_mean"]
        jumps = s.diff()[s.index.to_series().diff() == 1]
        for sol, j in jumps[jumps.abs() > 15].items():
            review.append(f"- sol {sol}: daily mean pressure changed by {j:+.1f} Pa from the sol before")
        for name, (lo, hi) in [("air_temp", (150, 300)), ("ground_temp", (150, 320))]:
            col = summ.get(f"{name}_min")
            if col is not None:
                for _, r in summ[(summ[f"{name}_min"] < lo) | (summ[f"{name}_max"] > hi)].iterrows():
                    review.append(f"- sol {int(r['sol'])}: {name.replace('_', ' ')} from {r[f'{name}_min']} to "
                                  f"{r[f'{name}_max']} K (unusually wide)")
        if "rover_z_m" in summ:
            z = summ.set_index("sol")["rover_z_m"].dropna()
            for sol, dz in z.diff()[z.diff().abs() > 50].items():
                review.append(f"- sol {sol}: rover height changed by {dz:+.0f} m from the previous sol with data")
    lines += ["", "## To review (nothing removed; listed for a person to check)", ""]
    lines += review or ["- Nothing flagged."]
    if len(summ):
        lines += ["", "## Season covered", "",
                  f"- Mars Year {int(summ['mars_year'].min())}, Ls {summ.iloc[0]['ls']:.1f}° (sol {int(summ.iloc[0]['sol'])}) "
                  f"to Mars Year {int(summ['mars_year'].max())}, Ls {summ.iloc[-1]['ls']:.1f}° (sol {int(summ.iloc[-1]['sol'])})",
                  f"- Earth dates {summ.iloc[0]['utc_date']} to {summ.iloc[-1]['utc_date']}"]
    lines += ["", "---", "", "Data: NASA Planetary Data System, Atmospheres Node; MSL REMS MODRDR and ADR "
              "(MSL-M-REMS-5-MODRDR-V1.0, MSL-M-REMS-6-ADR-V1.0). Report generated by mars-data/analysis/run_rems.py.", ""]
    return "\n".join(lines)


def run_chunk(chunk: str, mod_names: list[str], adr_names: list[str]) -> None:
    m = re.match(r"SOL_(\d{5})_(\d{5})$", chunk)
    if not m:
        raise ValueError(f"not a chunk folder name: {chunk}")
    expected = range(int(m.group(1)), int(m.group(2)) + 1)
    sol_dirs = [d for d in listing(BASE + "DATA/" + chunk + "/") if re.match(r"SOL\d{5}/$", d)]
    print(f"{chunk}: {len(sol_dirs)} sol folders", flush=True)
    def safe(d: str) -> dict:
        try:
            return process_sol(chunk, d, mod_names, adr_names)
        except Exception as e:  # reported for this sol; the rest of the chunk continues
            return {"sol": int(d.strip("/")[3:]), "files": [], "problem": f"{type(e).__name__}: {e}"}

    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(safe, sol_dirs))
    ok = [r for r in results if not r["problem"]]
    merge_csv(OUT / "sols.csv", pd.DataFrame([r["summary"] for r in ok]), ["sol"])
    hourly = [{"sol": r["sol"], "hour": h, **{n: r["hourly"][n].get(h) for n in r["hourly"]}}
              for r in ok for h in sorted(set().union(*[r["hourly"][n].keys() for n in r["hourly"]]))]
    if hourly:
        merge_csv(OUT / "hourly.csv", pd.DataFrame(hourly), ["sol", "hour"])
    files = [f for r in results for f in r["files"]]
    if files:
        merge_csv(OUT / "manifest.csv", pd.DataFrame(files), ["file"])
    (OUT / "reports").mkdir(parents=True, exist_ok=True)
    (OUT / "reports" / f"{chunk}.md").write_text(write_report(chunk, results, expected))
    print(f"{chunk}: {len(ok)} sols processed", flush=True)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("chunks", nargs="*")
    ap.add_argument("--list", action="store_true")
    a = ap.parse_args()
    chunks = [d.strip("/") for d in listing(BASE + "DATA/") if re.match(r"SOL_\d{5}_\d{5}/$", d)]
    if a.list:
        done = set()
        if (OUT / "manifest.csv").exists():
            done = {f.split("/")[0] for f in pd.read_csv(OUT / "manifest.csv")["file"]}
        for c in chunks:
            print(c, "processed" if c in done else "")
        return
    mod_names = rems.columns_from_fmt(get(BASE + "LABEL/MODRDR6.FMT").decode("ascii", "replace"))
    rems.check_columns(mod_names, rems.MODRDR_COLUMNS, "MODRDR")
    geom = rems.columns_from_fmt(get(BASE + "LABEL/ADR_GEOM6.FMT").decode("ascii", "replace"))
    rems.check_columns(geom, rems.ADR_NEEDED, "ADR", exact=False)
    adr_names = geom
    for c in a.chunks:
        if c not in chunks:
            sys.exit(f"{c} is not a chunk in the archive")
        run_chunk(c, mod_names, adr_names)


if __name__ == "__main__":
    main()
