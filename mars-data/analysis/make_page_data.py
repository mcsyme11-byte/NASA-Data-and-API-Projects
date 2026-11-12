# NASA and ESA Data Projects · Mars Data · data for the web page · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Packs the cleaned REMS summaries (mars-data/data/rems/) into the small files the page reads:
#   mars-data/data/summary.json        one row per sol, the season-by-hour grid, and facts about the data
#   mars-data/data/hourly/MY<n>.json   hourly means per sol, one file per Mars Year (loaded when a sol is picked)
import json
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

DATA = Path(__file__).resolve().parent.parent / "data" / "rems"
OUT = Path(__file__).resolve().parent.parent / "data"


def num(v, nd=1):
    return None if pd.isna(v) else round(float(v), nd)


def main() -> None:
    s = pd.read_csv(DATA / "sols.csv")
    if (DATA / "uv.csv").exists():
        uv = pd.read_csv(DATA / "uv.csv")
        not_midday = ~uv["uv_abc_max_hour"].between(10.5, 13.5) | (uv["uv_minutes"] < 30)  # CLEANING.md rule 9
        uv.loc[not_midday, ["uv_abc_max", "uv_sza_at_max"]] = None
        s = s.merge(uv, on="sol", how="left")
    h = pd.read_csv(DATA / "hourly.csv")

    # Values set aside for review (CLEANING.md, rule 10): removed from what the page shows, kept in the data files.
    ex_path = Path(__file__).resolve().parent / "exclusions.csv"
    if ex_path.exists():
        for e in pd.read_csv(ex_path).itertuples():
            m = e.measurement
            for c in [c for c in s.columns if c.startswith(m + "_")]:
                s.loc[s["sol"] == e.sol, c] = False if s[c].dtype == bool else float("nan")
            if m in h.columns:
                h.loc[h["sol"] == e.sol, m] = None

    cols = {"sol": 0, "ls": 2, "mars_year": 0, "utc_date": None, "pressure_mean": 1, "pressure_min": 1,
            "pressure_max": 1, "pressure_full": None, "air_temp_mean": 1, "air_temp_min": 1, "air_temp_max": 1,
            "air_temp_full": None, "ground_temp_min": 1, "ground_temp_max": 1, "rover_z_m": 1, "humidity_max": 2,
            "humidity_max_hour": 1, "water_vapour_night": 1, "uv_abc_max": 3, "uv_sza_at_max": 1}
    rows = []
    for _, r in s.iterrows():
        row = []
        for c, nd in cols.items():
            v = r.get(c)
            if nd is None:
                row.append(None if pd.isna(v) else (bool(v) if isinstance(v, (bool,)) or c.endswith("_full") else v))
            else:
                row.append(num(v, nd) if nd else (None if pd.isna(v) else int(v)))
        rows.append(row)

    # season x time of day: mean hourly air temperature in 10-degree Ls bins
    hh = h.merge(s[["sol", "ls"]], on="sol")
    hh["lsbin"] = (hh["ls"] // 10).astype(int)
    heat = hh.groupby(["lsbin", "hour"])["air_temp"].agg(["mean", "count"]).reset_index()
    heat = [[int(a), int(b), num(m), int(n)] for a, b, m, n in heat.itertuples(index=False) if n >= 3]

    hourly_dir = OUT / "hourly"
    hourly_dir.mkdir(parents=True, exist_ok=True)
    hcols = [c for c in ["pressure", "air_temp", "ground_temp", "humidity"] if c in h.columns]
    year_of = dict(zip(s["sol"], s["mars_year"]))
    for year in sorted(s["mars_year"].dropna().unique()):
        part = h[h["sol"].map(year_of) == year].sort_values(["sol", "hour"])
        out = {}
        for sol, d in part.groupby("sol"):
            out[int(sol)] = [[int(x.hour)] + [num(getattr(x, c), 2) for c in hcols] for x in d.itertuples()]
        (hourly_dir / f"MY{int(year)}.json").write_text(json.dumps({"cols": ["hour"] + hcols, "sols": out},
                                                                   separators=(",", ":")))

    meta = {"rules": str(s["rules"].iloc[-1]), "first_sol": int(s["sol"].min()), "last_sol": int(s["sol"].max()),
            "first_date": s["utc_date"].iloc[0], "last_date": s["utc_date"].iloc[-1], "sols": len(s),
            "built": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "checked": (json.loads((DATA / "last_check.json").read_text()).get("checked", "")[:10]
                        if (DATA / "last_check.json").exists() else ""),
            "uv_last_sol": int(s.loc[s["uv_abc_max"].notna(), "sol"].max()) if "uv_abc_max" in s else None}
    payload = {"meta": meta, "cols": list(cols), "rows": rows, "heat": heat}
    (OUT / "summary.json").write_text(json.dumps(payload, separators=(",", ":")))
    print(f"summary.json: {len(rows)} sols, {(OUT / 'summary.json').stat().st_size / 1024:.0f} KB; "
          f"hourly files: {len(list(hourly_dir.glob('MY*.json')))}")


if __name__ == "__main__":
    main()
