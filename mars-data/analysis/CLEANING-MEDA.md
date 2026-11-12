# Cleaning rules: Perseverance MEDA (version 1.0)

Rules applied by `run_meda.py` to NASA's Mars 2020 MEDA data (Perseverance's weather station, Jezero Crater). Every
chunk of sols has a cleaning report in `data/meda/reports/`.

Source: NASA Planetary Data System, Atmospheres Node, `PDS4/Mars2020/mars2020_meda/data_derived_env/`, the derived
level, which NASA recommends for most uses (bundle `readme.txt`). One folder per sol; each sensor in its own CSV table
with a header row and a PDS4 XML label.

| Situation | Rule | Action |
|---|---|---|
| A value is empty or `9999999999` | M1 | Treated as missing (NASA: an empty derived value is not reliable for science) |
| A required column is missing from a table's header | M1 | The sol is not processed and is listed in the report |
| Two rows share a clock time | M2 | The first is kept |
| A row's local time is on another sol | M2 | Not used for that sol |
| Pressure outside 400–1,200 Pa | M3 | Removed |
| Humidity before sol 63 | M4 | Not used (NASA: not reliable before the sensor's first maintenance) |
| Relative humidity outside 0–100 %, water vapour outside 0–400 ppm | M4 | Removed |
| A sol has pressure in fewer than 10 local hours | M5 | Statistics given but marked "partial" |

## M1 — Missing values and columns

NASA leaves a derived value empty where it is not reliable, and uses `9999999999` as an invalid value in some columns.
Both are missing. The columns used are found by name in each table's header row: pressure `PRESSURE`, `TRANSDUCER`;
humidity `LOCAL_RELATIVE_HUMIDITY`, `VOLUME_MIXING_RATIO`; ancillary `ROVER_POSITION_Z`; and `SCLK` and `LMST` in
each.

## M2 — Time

Local Mean Solar Time (`LMST`, `SSSSSMHH:MM:SS.sss`) gives the sol and the hour. The date, season (Ls) and Mars Year
come from the clock time `SCLK`, taken as seconds from noon on January 1, 2000 (sol 1859 gives May 13, 2026, Ls 281°,
Mars Year 38), by the same method as REMS (`mars_time.py`).

## M3 — Pressure

The derived pressure (from transducer 1 or 2; the transducer is recorded) within 400–1,200 Pa is kept. NASA's readme
notes that the transducer used for the derived level can show jumps; the report lists any day-to-day change of more
than 15 Pa between consecutive full sols for review.

## M4 — Humidity

Humidity before sol 63 is not used (NASA's readme). Relative humidity is summarised as the day's highest value (from
one-minute medians with at least 30 readings), water vapour as the median over local hours 2–6, as for REMS.

## M5 — Coverage and daily statistics

MEDA measures about 12 hours a sol, the even hours on even sols and the odd hours on odd sols. An hour counts with at
least 60 readings; a sol is **full** with pressure in at least 10 hours. The daily mean is the mean of the hourly
means: because the measured hours are spread evenly through the day, every second hour, this follows the daily
average closely. Charts of daily averages use full sols only.

---

Created by **Malcolm Syme** · <mcsyme11@gmail.com> · part of NASA and ESA Data Projects.
