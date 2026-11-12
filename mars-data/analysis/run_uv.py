# NASA and ESA Data Projects · Mars Data · Curiosity REMS corrected UV: download and summarise
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Usage: python3 run_uv.py REMS_UVS_0001_0100 [REMS_UVS_0101_0200 ...]
#
# Reads NASA's corrected UV data (MSL-M-REMS-5-UVRDR-V1.0, folder DATA_UV_CORRECTED, 100 sols per file, about 1.2 GB
# each) as it downloads, without saving the file, and writes one row per sol to mars-data/data/rems/uv.csv and a
# report per file to mars-data/data/rems/reports/. Rules: CLEANING.md, rule 9.
import hashlib
import re
import sys
import urllib.request
from collections import Counter, defaultdict
from datetime import datetime, timezone
from statistics import median

import pandas as pd

from run_rems import OUT, UA, get, merge_csv

BASE = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/DATA_UV_CORRECTED/"
EXPECTED = ["SOL_NUMBER", "LMST_HOUR", "SOLAR_ZENITH_ANGLE", "SOLAR_AZIMUTH_ANGLE", "ROVER_YAW", "ROVER_PITCH",
            "ROVER_ROLL", "ROVER_VELOCITY", "MASTHEAD_AZIMUTH", "MASTHEAD_ELEVATION", "ARM_STILL", "ARM_STOWED", "UV_A",
            "UV_B", "UV_C", "UV_ABC", "UV_D", "UV_E", "UV_A_UNCERTAINTY", "UV_B_UNCERTAINTY", "UV_C_UNCERTAINTY",
            "UV_ABC_UNCERTAINTY", "UV_D_UNCERTAINTY", "UV_E_UNCERTAINTY"]
UV_LIMITS = (0.0, 30.0)   # W/m², UV_ABC; well above the largest flux possible at Mars's distance from the Sun
MIN_PER_MINUTE = 30       # as rule 7: a one-minute median needs at least 30 readings


def summarise_sol(sol: int, minutes: dict[int, list[tuple[float, float]]]) -> dict:
    med = {m: (median(v for v, _ in r), median(z for _, z in r)) for m, r in minutes.items() if len(r) >= MIN_PER_MINUTE}
    out = {"sol": sol, "uv_minutes": len(med)}
    if med:
        m_max = max(med, key=lambda m: med[m][0])
        out.update({"uv_abc_max": round(med[m_max][0], 3), "uv_abc_max_hour": round(m_max / 60, 2),
                    "uv_sza_at_max": round(med[m_max][1], 1)})
    return out


def run_file(name: str) -> None:
    lbl = get(BASE + name + ".LBL").decode("ascii", "replace")
    names = re.findall(r'^\s*NAME\s*=\s*"?([A-Z0-9_]+)"?', lbl, re.M)
    if names != EXPECTED:
        raise ValueError(f"{name}: the column list has changed: {names}")
    rows_label = int(re.search(r"^\s*ROWS\s*=\s*(\d+)", lbl, re.M).group(1))
    i_sol, i_hour, i_sza, i_uv = (EXPECTED.index(c) for c in ["SOL_NUMBER", "LMST_HOUR", "SOLAR_ZENITH_ANGLE", "UV_ABC"])

    tally: Counter = Counter()
    sha = hashlib.sha256()
    size = 0
    results: list[dict] = []
    cur_sol, minutes = None, defaultdict(list)
    req = urllib.request.Request(BASE + name + ".TAB", headers=UA)
    with urllib.request.urlopen(req, timeout=300) as r:
        for line in r:
            sha.update(line)
            size += len(line)
            f = line.split(b",")
            tally["rows_read"] += 1
            if len(f) != len(EXPECTED):
                tally["rows_wrong_columns"] += 1
                continue
            sol, hour, sza, uv = int(f[i_sol]), float(f[i_hour]), float(f[i_sza]), float(f[i_uv])
            if sol != cur_sol:
                if cur_sol is not None:
                    results.append(summarise_sol(cur_sol, minutes))
                cur_sol, minutes = sol, defaultdict(list)
            if uv == -999:
                tally["uv_missing"] += 1          # NASA: Sun more than 55° from overhead, or not corrected
                continue
            if not UV_LIMITS[0] <= uv <= UV_LIMITS[1]:
                tally["uv_outside_limits"] += 1
                continue
            tally["uv_kept"] += 1
            minutes[int(hour * 60)].append((uv, sza))
    if cur_sol is not None:
        results.append(summarise_sol(cur_sol, minutes))
    if tally["rows_read"] != rows_label:
        raise ValueError(f"{name}: label says {rows_label} rows, read {tally['rows_read']}")

    df = pd.DataFrame(results)
    if df["sol"].duplicated().any():
        raise ValueError(f"{name}: a sol appears in more than one block (rows not in time order)")
    merge_csv(OUT / "uv.csv", df, ["sol"])
    merge_csv(OUT / "manifest.csv", pd.DataFrame([{
        "sol": int(df["sol"].min()), "file": "DATA_UV_CORRECTED/" + name + ".TAB", "bytes": size,
        "sha256": sha.hexdigest(), "product_version": "", "created": ""}]), ["file"])

    with_uv = df[df["uv_minutes"] > 0]
    lines = [f"# Cleaning report: Curiosity REMS corrected UV, {name}", "",
             f"Processed {datetime.now(timezone.utc):%Y-%m-%d %H:%M} UTC (mars-data/analysis/CLEANING.md, rule 9).", "",
             f"- Sols in the file: {len(df)} ({df['sol'].min()}–{df['sol'].max()}); with a midday UV value: {len(with_uv)}",
             f"- Rows read: {tally['rows_read']:,} (the label's count: {rows_label:,})",
             f"- Rows with the wrong number of columns (removed): {tally['rows_wrong_columns']:,}",
             f"- UV missing (Sun more than 55° from overhead, as NASA sets it): {tally['uv_missing']:,}",
             f"- UV outside {UV_LIMITS[0]:.0f}–{UV_LIMITS[1]:.0f} W/m² (removed): {tally['uv_outside_limits']:,}",
             f"- UV readings kept: {tally['uv_kept']:,}", ""]
    if len(with_uv):
        lines += [f"- Midday peak UV_ABC: {with_uv['uv_abc_max'].min():.2f} to {with_uv['uv_abc_max'].max():.2f} W/m²; "
                  f"median local time of the peak {with_uv['uv_abc_max_hour'].median():.2f}", ""]
    lines += ["---", "", "Data: NASA Planetary Data System, Atmospheres Node; MSL REMS UVRDR (MSL-M-REMS-5-UVRDR-V1.0). "
              "Report generated by mars-data/analysis/run_uv.py.", ""]
    (OUT / "reports").mkdir(parents=True, exist_ok=True)
    (OUT / "reports" / f"{name}.md").write_text("\n".join(lines))
    print(f"{name}: {len(df)} sols, {tally['uv_kept']:,} UV readings kept", flush=True)


if __name__ == "__main__":
    files = {f[:-4] for f in re.findall(r'href="(REMS_UVS_\d{4}_\d{4}\.TAB)"', get(BASE).decode("utf-8", "replace"))}
    for n in sys.argv[1:]:
        if n not in files:
            sys.exit(f"{n} is not a file in the corrected UV folder")
        run_file(n)
