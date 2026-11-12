# NASA and ESA Data Projects · Mars Data · Curiosity REMS reader, cleaning and daily summaries
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Reads REMS MODRDR (environmental values, corrected) and ADR (rover position) tables from NASA's Planetary Data System,
# applies the cleaning rules in CLEANING.md, and summarises each sol. The column lists are read from the archive's own
# format files and compared with the lists below; if NASA changes them, processing stops instead of misreading values.
import csv
import io
import math
import re
from collections import Counter

import pandas as pd

from mars_time import from_j2000_seconds, ls_and_year

RULES_VERSION = "1.1"  # raise when a rule in CLEANING.md changes; the summaries record it

MODRDR_COLUMNS = [
    "TIMESTAMP", "LMST", "LTST", "HORIZONTAL_WIND_SPEED", "VERTICAL_WIND_SPEED", "WIND_DIRECTION",
    "WS_CONFIDENCE_LEVEL", "BRIGHTNESS_TEMP", "BRIGHTNESS_TEMP_LONG_TERM_UNCERTAINTY",
    "BRIGHTNESS_TEMP_SHORT_TERM_UNCERTAINTY", "GTS_CONFIDENCE_LEVEL", "BOOM1_LOCAL_AIR_TEMP",
    "ATS_BOOM1_CONFIDENCE_LEVEL", "BOOM2_LOCAL_AIR_TEMP", "ATS_BOOM2_CONFIDENCE_LEVEL", "AMBIENT_TEMP",
    "AMBIENT_TEMP_CONFIDENCE_LEVEL", "UV_A", "UV_B", "UV_C", "UV_ABC", "UV_D", "UV_E", "UV_A_UNCERTAINTY",
    "UV_B_UNCERTAINTY", "UV_C_UNCERTAINTY", "UV_ABC_UNCERTAINTY", "UV_D_UNCERTAINTY", "UV_E_UNCERTAINTY",
    "UVS_CONFIDENCE_LEVEL", "LOCAL_RELATIVE_HUMIDITY", "HS_TEMP", "LOCAL_RELATIVE_HUMIDITY_UNCERTAINTY",
    "VOLUME_MIXING_RATIO", "VOLUME_MIXING_RATIO_UNCERTAINTY", "HS_CONFIDENCE_LEVEL", "PS_CONFIGURATION", "PRESSURE",
    "PRESSURE_UNCERTAINTY", "PS_CONFIDENCE_LEVEL"]
ADR_NEEDED = ["TIMESTAMP", "LMST", "ROVER_POSITION_X", "ROVER_POSITION_Y", "ROVER_POSITION_Z"]
FLAG_COLUMNS = {c for c in MODRDR_COLUMNS if c.endswith("CONFIDENCE_LEVEL")} | {"LMST", "LTST", "PS_CONFIGURATION"}
MISSING_TEXT = {"", "UNK", "NULL", "N/A"}

# Physical limits (CLEANING.md, rule 4): values outside them cannot be real at Gale Crater.
LIMITS = {"pressure": (400.0, 1200.0), "air_temp": (130.0, 310.0), "ground_temp": (130.0, 330.0),
          "humidity": (0.0, 100.0), "water_vapour": (0.0, 400.0)}
NIGHT_HOURS = (2.0, 6.0)  # rule 7: local hours used for the night-time water vapour value
FULL_SOL_HOURS = 22      # rule 6: a sol is "full" with good data in at least 22 of its 24 local hours
MIN_SECONDS_PER_HOUR = 60  # rule 6: an hour counts with at least 60 good one-second readings


def columns_from_fmt(text: str) -> list[str]:
    """Column names, in order, from a PDS3 .FMT file."""
    return re.findall(r'^\s*NAME\s*=\s*"?([A-Z0-9_]+)"?', text, re.M)


def check_columns(found: list[str], expected: list[str], what: str, exact: bool = True) -> None:
    """exact: the same columns in the same order; otherwise every expected column must be present."""
    if (found != expected) if exact else not set(expected) <= set(found):
        raise ValueError(f"{what}: the archive's column list has changed; expected {expected}, found {found}")


def is_missing(text: str) -> bool:
    t = text.strip()
    if t in MISSING_TEXT:
        return True
    try:
        return math.isclose(float(t), -999.0)  # -999.00 and -9.990E+02 (ERRATA.TXT, release of 2024-09-30)
    except ValueError:
        return False


def read_table(raw: bytes, names: list[str]) -> pd.DataFrame:
    """One REMS table: every value as text first, then numbers where the column is numeric; missing values as NaN."""
    rows = list(csv.reader(io.StringIO(raw.decode("ascii", "replace")), skipinitialspace=True))
    bad = [i for i, r in enumerate(rows) if len(r) != len(names)]
    if bad:
        raise ValueError(f"{len(bad)} rows do not have {len(names)} columns (first at row {bad[0] + 1})")
    df = pd.DataFrame(rows, columns=names)
    for c in names:
        col = df[c].str.strip()
        if c in FLAG_COLUMNS:
            df[c] = col
        else:
            df[c] = pd.to_numeric(col.where(~col.map(is_missing)), errors="coerce")
    return df


def read_adr(raw: bytes, geom_names: list[str], label: str) -> pd.DataFrame:
    """The geometry table of an ADR file. Each ADR file holds two tables one after the other: corrections (4 columns),
    then geometry (16 columns); the geometry rows are the ones with the geometry table's number of columns, and their
    count must match the label's ROWS for REMS_ADR_GEOMETRY_TABLE."""
    rows = [r for r in csv.reader(io.StringIO(raw.decode("ascii", "replace")), skipinitialspace=True)
            if len(r) == len(geom_names)]
    m = re.search(r"OBJECT\s*=\s*REMS_ADR_GEOMETRY_TABLE.*?\bROWS\s*=\s*(\d+)", label, re.S)
    if m and int(m.group(1)) != len(rows):
        raise ValueError(f"ADR: label says {m.group(1)} geometry rows, file has {len(rows)}")
    df = pd.DataFrame(rows, columns=geom_names)
    for c in ["TIMESTAMP", "ROVER_POSITION_X", "ROVER_POSITION_Y", "ROVER_POSITION_Z"]:
        col = df[c].str.strip()
        df[c] = pd.to_numeric(col.where(~col.map(is_missing)), errors="coerce")
    return df


def char_is(flags: pd.Series, i: int, value: str = "1") -> pd.Series:
    """True where character i (counted from the left, after stripping padding) equals value."""
    return flags.str.len().gt(i) & (flags.str[i] == value)


def clean(df: pd.DataFrame, sol: int) -> tuple[pd.DataFrame, dict]:
    """Apply CLEANING.md rules 1-5. Returns the table with a cleaned column per variable and a count of every reason."""
    report: Counter = Counter()
    report["rows_read"] = len(df)

    # Rule 1: one row per second; duplicates of a timestamp are removed, rows kept in time order.
    dup = df["TIMESTAMP"].duplicated(keep="first")
    report["rows_duplicate_timestamp"] = int(dup.sum())
    df = df[~dup].sort_values("TIMESTAMP").reset_index(drop=True)

    # Rule 2: local time. LMST "SSSSSMHH:MM:SS.sss"; rows whose sol differs from the file's sol are counted and kept
    # under their own sol number.
    lm = df["LMST"].str.extract(r"^(\d{5})M(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)$")
    bad_time = lm.isna().any(axis=1)
    report["rows_bad_local_time"] = int(bad_time.sum())
    df, lm = df[~bad_time].copy(), lm[~bad_time]
    df["sol"] = lm[0].astype(int)
    df["hour"] = lm[1].astype(int) + lm[2].astype(int) / 60 + lm[3].astype(float) / 3600
    report["rows_other_sol"] = int((df["sol"] != sol).sum())

    # Rule 3: quality flags, read character by character (meanings from the archive's MODRDR6.FMT).
    p_ok = df["PRESSURE"].notna() & char_is(df["PS_CONFIDENCE_LEVEL"], 1)          # character 2: no shadow effect
    t_ok = df["AMBIENT_TEMP"].notna() & char_is(df["AMBIENT_TEMP_CONFIDENCE_LEVEL"], 7) \
        & char_is(df["AMBIENT_TEMP_CONFIDENCE_LEVEL"], 8)                           # characters 8 and 9
    g_ok = df["BRIGHTNESS_TEMP"].notna() & char_is(df["GTS_CONFIDENCE_LEVEL"], 1) \
        & char_is(df["GTS_CONFIDENCE_LEVEL"], 2) & char_is(df["GTS_CONFIDENCE_LEVEL"], 3)  # characters 2, 3, 4
    hs = df["HS_CONFIDENCE_LEVEL"]
    h_ok = df["LOCAL_RELATIVE_HUMIDITY"].notna() & ~char_is(hs, 1, "0")             # character 2 not "bad"
    v_ok = df["VOLUME_MIXING_RATIO"].notna() & ~char_is(hs, 1, "0") & char_is(hs, 2)  # and character 3: in range
    for name, col, ok in [("pressure", "PRESSURE", p_ok), ("air_temp", "AMBIENT_TEMP", t_ok),
                          ("ground_temp", "BRIGHTNESS_TEMP", g_ok), ("humidity", "LOCAL_RELATIVE_HUMIDITY", h_ok),
                          ("water_vapour", "VOLUME_MIXING_RATIO", v_ok)]:
        present = df[col].notna()
        report[f"{name}_missing"] = int((~present).sum())
        report[f"{name}_failed_flags"] = int((present & ~ok).sum())
        # Rule 4: physical limits.
        lo, hi = LIMITS[name]
        inside = df[col].between(lo, hi)
        report[f"{name}_outside_limits"] = int((ok & ~inside).sum())
        keep = ok & inside
        report[f"{name}_kept"] = int(keep.sum())
        df[name] = df[col].where(keep)

    # Rule 5: information kept with the values (not used to remove them).
    report["pressure_oscillator_1"] = int((p_ok & char_is(df["PS_CONFIDENCE_LEVEL"], 0, "0")).sum())
    report["ground_temp_power_out_of_range"] = int((df["ground_temp"].notna()
                                                    & char_is(df["GTS_CONFIDENCE_LEVEL"], 0, "0")).sum())
    report["humidity_preliminary"] = int((df["humidity"].notna() & char_is(hs, 0, "0")).sum())
    return df, dict(report)


def minute_medians(df: pd.DataFrame, col: str) -> pd.Series:
    """Rule 7: median of each local minute with at least 30 good readings (smooths one-second gusts and noise)."""
    s = df[["hour", col]].dropna()
    if s.empty:
        return pd.Series(dtype=float)
    minute = (s["hour"] * 60).astype(int)
    g = s.groupby(minute)[col]
    med = g.median()
    return med[g.count() >= 30]


def summarise(df: pd.DataFrame, sol: int, adr: pd.DataFrame | None) -> dict:
    """Rules 6-8: one row of daily statistics for the sol."""
    d = df[df["sol"] == sol]
    out: dict = {"sol": sol}
    mid = d["TIMESTAMP"].median() if len(d) else math.nan
    if not math.isnan(mid):
        t = from_j2000_seconds(float(mid))
        out["utc_date"] = t.strftime("%Y-%m-%d")
        out["ls"], out["mars_year"] = ls_and_year(t)
        out["ls"] = round(out["ls"], 2)
    for name in ["pressure", "air_temp", "ground_temp"]:
        good = d[["hour", name]].dropna()
        per_hour = good.groupby(good["hour"].astype(int))[name]
        hours = per_hour.count()
        hours = hours[hours >= MIN_SECONDS_PER_HOUR]
        out[f"{name}_hours"] = int(len(hours))
        out[f"{name}_full"] = bool(len(hours) >= FULL_SOL_HOURS)
        if len(hours):
            hourly = per_hour.mean()[hours.index]
            out[f"{name}_mean"] = round(float(hourly.mean()), 2)   # mean of hourly means: each hour counts once
            mm = minute_medians(d, name)
            if len(mm):
                out[f"{name}_min"] = round(float(mm.min()), 2)
                out[f"{name}_max"] = round(float(mm.max()), 2)
                out[f"{name}_min_hour"] = round(float(mm.idxmin() / 60), 2)
                out[f"{name}_max_hour"] = round(float(mm.idxmax() / 60), 2)
    # Humidity (rule 7): the sensor is accurate only when cold, so the day's highest relative humidity (reached at
    # night) is reported, with water vapour as the median over the night hours.
    mm = minute_medians(d, "humidity")
    good_h = d["humidity"].notna()
    out["humidity_hours"] = int((d[good_h].groupby(d.loc[good_h, "hour"].astype(int)).size() >= MIN_SECONDS_PER_HOUR).sum())
    if len(mm):
        out["humidity_max"] = round(float(mm.max()), 2)
        out["humidity_max_hour"] = round(float(mm.idxmax() / 60), 2)
    night = d[d["hour"].between(*NIGHT_HOURS)]["water_vapour"].dropna()
    if len(night) >= MIN_SECONDS_PER_HOUR:
        out["water_vapour_night"] = round(float(night.median()), 1)
    if adr is not None and len(adr):
        z = adr["ROVER_POSITION_Z"].dropna()
        if len(z):
            out["rover_z_m"] = round(float(z.median()), 2)  # height above the landing site (MSL_TOPO frame, +Z up)
    out["rules"] = RULES_VERSION
    return out


def hourly_profile(df: pd.DataFrame, sol: int) -> dict:
    """Hourly means for one sol (used for the "one sol, hour by hour" and "season by time of day" charts)."""
    d = df[df["sol"] == sol]
    res = {}
    for name in ["pressure", "air_temp", "ground_temp", "humidity"]:
        good = d[["hour", name]].dropna()
        g = good.groupby(good["hour"].astype(int))[name]
        n = g.count()
        m = g.mean()[n >= MIN_SECONDS_PER_HOUR]
        res[name] = {int(h): round(float(v), 2) for h, v in m.items()}
    return res
