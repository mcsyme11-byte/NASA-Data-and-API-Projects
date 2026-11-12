# Cleaning rules: Mars Express radio occultation profiles (version 1.0)

Rules applied by `run_mex.py` to ESA's Mars Express radio science (MaRS) level 5 profiles. The report is
`data/mex/report.md`.

Source: ESA Planetary Science Archive, `MARS-EXPRESS/MRS/MEX-M-MRS-5-OCC-<season>-V<n>/DATA/<pass>/LEVEL04/
…_AIX_….TAB`: one file per occultation (Mars Express's radio signal passing through the atmosphere on its way to
Earth), giving the atmosphere from about 45 km down to a few kilometres above the ground. Only the newest version of
each season's data set is used (for example 9101 V2.0, not V1.0).

| Situation | Rule | Action |
|---|---|---|
| A row does not have 26 columns | X1 | Removed |
| Temperature outside 100–320 K, its uncertainty over 10 K, or no pressure | X3 | Row removed |
| Fewer than 10 rows left in a profile | X3 | Profile not used |

## X1 — Format

Rows are read by column position, as in the label: UTC time (2), latitude (5), east longitude (6), geopotential height
(8, km), pressure (11, Pa) and temperature (17, K) with their uncertainties (12, 18).

## X2 — Which of the three versions

ESA gives pressure and temperature three times, calculated from three assumptions about the temperature at the top of
the profile (lower, medium, upper boundary condition). The medium one is used. The three agree closely below about
30 km; above it they differ, which is part of why the uncertainty grows with height.

## X3 — Rows removed

A row with a temperature outside 100–320 K, a temperature uncertainty over 10 K (near the top of a profile), or no
pressure is removed. A profile with fewer than 10 rows left is not used.

## X4 — Summaries

For each profile: the time, latitude and longitude of its lowest point; the season (Ls) and Mars Year from that time
(`mars_time.py`); the lowest and highest heights; the temperature and pressure at the lowest point; the temperature at
5, 10, 20, 30 and 40 km (by linear interpolation in height); and the whole profile every 1 km (temperature linear,
pressure on a log scale, as pressure falls exponentially with height).

Data: ESA, CC BY-NC 3.0 IGO. Credit line: docs/DATA-SOURCES.md.

---

Created by **Malcolm Syme** · <mcsyme11@gmail.com> · part of NASA and ESA Data Projects.
