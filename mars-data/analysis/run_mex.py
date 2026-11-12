# NASA and ESA Data Projects · Mars Data · ESA Mars Express radio occultation profiles (MaRS)
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Usage: python3 run_mex.py
#
# Reads every atmospheric profile (…_AIX_….TAB, level 5 "derived") in ESA's Planetary Science Archive for Mars
# Express radio science (MaRS), the newest version of each occultation season's data set, and writes to
# mars-data/data/mex/:
#   profiles.csv   one row per profile: time, place, season, lowest height and its temperature and pressure,
#                  temperature at fixed heights
#   profiles.json  each profile every 1 km of height (temperature, pressure), for the profile chart
#   manifest.csv   every file used, with size and SHA-256
#   report.md      the cleaning report
# Rules: CLEANING-MEX.md. Data: ESA, CC BY-NC 3.0 IGO (credit line in docs/DATA-SOURCES.md).
import hashlib
import json
import re
from collections import Counter
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

from mars_time import ls_and_year
from run_rems import get, listing

PSA = "https://archives.esac.esa.int/psa/ftp/MARS-EXPRESS/MRS/"
OUT = Path(__file__).resolve().parent.parent / "data" / "mex"
RULES_VERSION = "1.0"
N_COLUMNS = 26
COL = {"utc": 1, "radius": 3, "lat": 4, "lon": 5, "height": 7, "p": 10, "p_sigma": 11, "t": 16, "t_sigma": 17}
T_LIMITS = (100.0, 320.0)   # K; rule X3
T_SIGMA_MAX = 10.0          # K; rule X3
LEVELS_KM = [5, 10, 20, 30, 40]


def season_sets() -> list[str]:
    """The newest version of each level-5 occultation data set."""
    sets = [d.strip("/") for d in listing(PSA) if re.match(r"MEX-M-MRS-5-OCC-\d{4}-V\d+\.\d+/$", d)]
    newest: dict[str, str] = {}
    for s in sorted(sets, key=lambda x: (x.split("-V")[0], float(x.split("-V")[1]))):
        newest[s.split("-V")[0]] = s
    return sorted(newest.values())


def profile_files(ds: str) -> list[str]:
    out = []
    for d in [x for x in listing(PSA + ds + "/DATA/") if x.endswith("/")]:
        for f in listing(PSA + ds + "/DATA/" + d + "LEVEL04/"):
            if "_AIX_" in f and f.upper().endswith(".TAB"):
                out.append(f"{ds}/DATA/{d}LEVEL04/{f}")
    return out


def parse(raw: bytes, path: str, tally: Counter) -> dict | None:
    rows = [r.split() for r in raw.decode("ascii", "replace").splitlines() if r.strip()]
    good = [r for r in rows if len(r) == N_COLUMNS]
    tally["rows_read"] += len(rows)
    tally["rows_wrong_columns"] += len(rows) - len(good)
    if not good:
        return None
    a = pd.DataFrame([[r[COL[k]] for k in COL] for r in good], columns=list(COL))
    for c in a.columns:
        if c != "utc":
            a[c] = pd.to_numeric(a[c], errors="coerce")
    ok = a["t"].between(*T_LIMITS) & (a["t_sigma"] <= T_SIGMA_MAX) & (a["p"] > 0)
    tally["rows_removed"] += int((~ok).sum())
    a = a[ok].sort_values("height")
    if len(a) < 10:
        tally["profiles_too_short"] += 1
        return None
    tally["rows_kept"] += len(a)
    low = a.iloc[0]
    t = datetime.fromisoformat(low["utc"]).replace(tzinfo=timezone.utc)
    ls, my = ls_and_year(t)
    lon = float(low["lon"]) % 360
    out = {"id": Path(path).stem.replace("_AIX", ""), "season": path.split("/")[0].split("-")[5],
           "utc": t.strftime("%Y-%m-%d %H:%M"), "ls": round(ls, 2), "mars_year": my,
           "lat": round(float(low["lat"]), 2), "lon": round(lon if lon <= 180 else lon - 360, 2),
           "lowest_km": round(float(low["height"]), 2), "top_km": round(float(a["height"].max()), 1),
           "t_lowest": round(float(low["t"]), 1), "p_lowest": round(float(low["p"]), 1)}
    for h in LEVELS_KM:
        out[f"t_{h}km"] = round(float(np.interp(h, a["height"], a["t"])), 1) if a["height"].min() <= h <= a["height"].max() else None
    grid = np.arange(np.ceil(a["height"].min()), np.floor(a["height"].max()) + 1)
    out["_profile"] = [[int(h), round(float(np.interp(h, a["height"], a["t"])), 1),
                        round(float(np.exp(np.interp(h, a["height"], np.log(a["p"])))), 2)] for h in grid]
    return out


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    try:
        sets = season_sets()
    except Exception as e:
        (OUT / "report.md").write_text(f"# Mars Express\n\nThe archive's list of data sets could not be read: {e}\n")
        raise
    print("data sets:", sets, flush=True)
    files = []
    for ds in sets:
        try:
            got = profile_files(ds)
        except Exception as e:
            got = []
            print(f"{ds}: listing failed: {e}", flush=True)
        print(f"{ds}: {len(got)} profiles", flush=True)
        files += got
    (OUT / "listing.txt").write_text("\n".join(f"{ds}: {sum(f.startswith(ds) for f in files)}" for ds in sets) + "\n")
    print(f"{len(files)} profiles", flush=True)
    tally: Counter = Counter()
    manifest, profiles = [], []

    errors: list[str] = []

    def one(path: str):
        try:
            return path, get(PSA + path), None
        except Exception as e:  # reported; the other profiles continue
            return path, None, f"{type(e).__name__}: {e}"

    with ThreadPoolExecutor(max_workers=4) as pool:
        for path, raw, err in pool.map(one, files):
            if err:
                errors.append(f"{path}: {err}")
                continue
            manifest.append({"file": path, "bytes": len(raw), "sha256": hashlib.sha256(raw).hexdigest()})
            try:
                p = parse(raw, path, tally)
            except Exception as e:
                errors.append(f"{path}: {type(e).__name__}: {e}")
                continue
            if p:
                profiles.append(p)
    OUT.mkdir(parents=True, exist_ok=True)
    df = pd.DataFrame([{k: v for k, v in p.items() if k != "_profile"} for p in profiles])
    if len(df):
        df = df.sort_values("utc")
    df.to_csv(OUT / "profiles.csv", index=False)
    (OUT / "profiles.json").write_text(json.dumps({p["id"]: p["_profile"] for p in profiles}, separators=(",", ":")))
    if manifest:
        pd.DataFrame(manifest).sort_values("file").to_csv(OUT / "manifest.csv", index=False)
    lines = ["# Cleaning report: Mars Express radio occultation profiles (ESA)", "",
             f"Processed {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC with rules version {RULES_VERSION} "
             "(mars-data/analysis/CLEANING-MEX.md).", "",
             f"- Data sets (newest version of each season): {', '.join(sets)}",
             f"- Profile files: {len(files)}; profiles kept: {len(profiles)}; too short after cleaning: {tally['profiles_too_short']}",
             f"- Rows read: {tally['rows_read']:,}; wrong number of columns: {tally['rows_wrong_columns']:,}",
             f"- Rows removed (temperature outside {T_LIMITS[0]:.0f}–{T_LIMITS[1]:.0f} K, uncertainty over "
             f"{T_SIGMA_MAX:.0f} K, or no pressure): {tally['rows_removed']:,}; kept: {tally['rows_kept']:,}"]
    if len(df):
        lines += [f"- Dates: {df['utc'].min()} to {df['utc'].max()}; Mars Years {df['mars_year'].min()}–{df['mars_year'].max()}",
                  f"- Latitudes {df['lat'].min():.0f}° to {df['lat'].max():.0f}°; lowest point {df['lowest_km'].min():.1f}–"
                  f"{df['lowest_km'].max():.1f} km; temperature there {df['t_lowest'].min():.0f}–{df['t_lowest'].max():.0f} K"]
    lines += [f"- Files that could not be read: {len(errors)}"] + [f"  - {e}" for e in errors[:30]]
    lines += ["", "---", "", "Data: ESA Planetary Science Archive, Mars Express MaRS level 5; credit: ESA, CC BY-NC 3.0 IGO. "
              "Report generated by mars-data/analysis/run_mex.py.", ""]
    (OUT / "report.md").write_text("\n".join(lines))
    print("\n".join(lines))


if __name__ == "__main__":
    main()
