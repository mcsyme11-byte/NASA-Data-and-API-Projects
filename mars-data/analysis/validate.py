# NASA and ESA Data Projects · Mars Data · checks before anything is saved · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Run by the "Mars data" job after update.py and before the results are committed. Exits with an error, so nothing
# is saved and a failure notice is sent, if any check fails:
#   - the summaries exist and have the expected columns;
#   - one row per sol, in order, and no fewer sols than the last saved version (PREV_SOLS, from the job);
#   - every daily value within the physical limits of CLEANING.md rule 4;
#   - no single-hour air-temperature glitch left (CLEANING.md rule 11) and no full sol with an air low below 170 K;
#   - the season (Ls) advancing with the sol number;
#   - every chunk processed in this run has a cleaning report and no sol with a problem.
import json
import os
import sys
from pathlib import Path

import pandas as pd

import rems

OUT = Path(__file__).resolve().parent.parent / "data" / "rems"
REQUIRED = ["sol", "utc_date", "ls", "mars_year", "pressure_mean", "air_temp_mean", "rover_z_m", "rules"]


def main() -> int:
    errors = []
    s = pd.read_csv(OUT / "sols.csv")
    missing = [c for c in REQUIRED if c not in s.columns]
    if missing:
        errors.append(f"sols.csv lacks columns {missing}")
    if s["sol"].duplicated().any():
        errors.append(f"sols.csv repeats sols {s.loc[s['sol'].duplicated(), 'sol'].tolist()[:10]}")
    if not s["sol"].is_monotonic_increasing:
        errors.append("sols.csv is not in sol order")
    prev = int(os.environ.get("PREV_SOLS", "0") or 0)
    if len(s) < prev:
        errors.append(f"sols.csv has {len(s)} sols, fewer than the {prev} saved before")

    checks = {"pressure": ["pressure_mean", "pressure_min", "pressure_max"],
              "air_temp": ["air_temp_mean", "air_temp_min", "air_temp_max"],
              "ground_temp": ["ground_temp_min", "ground_temp_max"],
              "humidity": ["humidity_max"]}
    for name, cols in checks.items():
        lo, hi = rems.LIMITS[name]
        for c in cols:
            if c in s:
                bad = s[(s[c] < lo) | (s[c] > hi)]
                if len(bad):
                    errors.append(f"{c} outside {lo}-{hi} on sols {bad['sol'].tolist()[:10]}")

    # Rule 11 worked: no hourly air-temperature mean more than SPIKE_K beyond both neighbouring hours, and no full sol
    # with a daily air low below 170 K (the evening glitch reads about 155 K; real nights at Gale stay above 175 K).
    h = pd.read_csv(OUT / "hourly.csv", usecols=["sol", "hour", "air_temp"]).dropna()
    h["key"] = h["sol"] * 24 + h["hour"]
    t = h.set_index("key")["air_temp"]
    prev_h, next_h = t.reindex(t.index - 1).to_numpy(), t.reindex(t.index + 1).to_numpy()
    both = pd.DataFrame({"p": prev_h, "n": next_h}, index=t.index)
    spike = (t < both.min(axis=1, skipna=False) - rems.SPIKE_K) | (t > both.max(axis=1, skipna=False) + rems.SPIKE_K)
    if spike.any():
        errors.append(f"single-hour air-temperature glitches left on sols {sorted(set((t.index[spike] // 24).tolist()))[:10]}")
    cold = s[s["air_temp_full"].astype(bool) & (s["air_temp_min"] < 170)]
    if len(cold):
        errors.append(f"daily air low below 170 K on sols {cold['sol'].tolist()[:10]}")

    season = s["mars_year"] * 360 + s["ls"]
    if not season.is_monotonic_increasing:
        back = s.loc[season.diff() < 0, "sol"].tolist()[:10]
        errors.append(f"the season goes backwards at sols {back}")

    check = json.loads((OUT / "last_check.json").read_text()) if (OUT / "last_check.json").exists() else {}
    for c in check.get("processed_chunks", []):
        rep = OUT / "reports" / f"{c}.md"
        if not rep.exists():
            errors.append(f"no cleaning report for {c}")
        elif "with a problem (not processed): 0" not in rep.read_text():
            errors.append(f"{c}: some sols could not be processed (see its cleaning report)")

    meda = OUT.parent / "meda" / "sols.csv"
    if meda.exists():
        m = pd.read_csv(meda)
        if m["sol"].duplicated().any() or not m["sol"].is_monotonic_increasing:
            errors.append("meda/sols.csv repeats sols or is out of order")
        bad = m[(m["pressure_mean"] < 400) | (m["pressure_mean"] > 1200)]
        if len(bad):
            errors.append(f"MEDA pressure outside 400-1200 Pa on sols {bad['sol'].tolist()[:10]}")
        if not (m["mars_year"] * 360 + m["ls"]).is_monotonic_increasing:
            errors.append("MEDA: the season goes backwards")
        prev_m = int(os.environ.get("PREV_MEDA_SOLS", "0") or 0)
        if len(m) < prev_m:
            errors.append(f"meda/sols.csv has {len(m)} sols, fewer than the {prev_m} saved before")

    if errors:
        print("Checks failed; nothing is saved:\n- " + "\n- ".join(errors))
        return 1
    print(f"Checks passed: {len(s)} sols, newest sol {int(s['sol'].max())}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
