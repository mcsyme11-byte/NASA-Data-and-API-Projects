# Cleaning rules: Curiosity REMS (version 1.2)

Rules applied by `rems.py` to NASA's REMS MODRDR tables (Curiosity's weather station, Gale Crater). Each rule says
what is done and why. A change to any rule raises the version number in `rems.py` (`RULES_VERSION`), and every row of
`data/rems/sols.csv` records the version that produced it. Nothing is removed silently: every chunk of sols has a
cleaning report in `data/rems/reports/` with a count for each reason.

Source: NASA Planetary Data System, Atmospheres Node, volume `mslrem_1001`; data set MSL-M-REMS-5-MODRDR-V1.0 (the
REMS team's highest processing level: environmental values corrected for rover heat, shadows and dust). Column
meanings are taken from the archive's own `LABEL/MODRDR6.FMT`; the column list is compared with the expected list on
every run, and processing stops if it has changed.

## Which rule for which situation

| Situation | Rule | Action |
|---|---|---|
| A value is `-999.00`, `-9.990E+02`, `UNK`, `NULL` or blank | 0 | Treated as missing (NASA's codes for "cannot be determined", ERRATA.TXT, 2024-09-30) |
| Two rows share a timestamp | 1 | The first is kept, the other removed |
| A row's local time cannot be read | 2 | Removed |
| A row's local time is on a different sol from its file | 2 | Counted; not used in that sol's statistics |
| A quality flag says the reading is bad | 3 | The value is removed (the rest of the row stays) |
| A value is outside physical limits | 4 | The value is removed |
| A flag gives information, not quality | 5 | Kept, and counted in the report |
| A sol has good data in fewer than 22 of its 24 hours | 6 | Statistics are given but marked "partial" |
| Corrected UV is missing (Sun more than 55° from overhead) | 9 | No UV value for that minute |
| An air-temperature minute is 25 K beyond both neighbouring hours | 11 | The readings of that minute are removed |

## Rule 0 — Missing values

NASA writes `-999` (as `-999.00` or `-9.990E+02`) where a value cannot be determined; files released before September
2024 used `UNK` or `NULL`. All are treated as missing. The wind columns are missing throughout: the wind sensor was
damaged during landing, and the REMS team does not release processed wind data.

## Rule 1 — One row per second

Rows are sorted by timestamp (seconds since noon, January 1, 2000). A repeated timestamp keeps its first row.

## Rule 2 — Local time

Local Mean Solar Time (LMST) has the form `SSSSSMHH:MM:SS.sss`: sol number, `M`, then hours, minutes and seconds of
the Mars day. The hour of the day (0–24 Mars hours, each 1/24 of a sol) comes from it.

## Rule 3 — NASA's quality flags

Each flag is a string of characters, one per check, counted from the left; `1` = good, `0` = bad, `X` = unknown. Not
every character is a quality check, so each is read for its own meaning (MODRDR6.FMT):

| Measurement | Column | Characters required to be `1` | Meaning |
|---|---|---|---|
| Pressure | `PS_CONFIDENCE_LEVEL` | 2 | No shadow effect |
| Air temperature | `AMBIENT_TEMP_CONFIDENCE_LEVEL` | 8 and 9 | Error under 5 K; observation reliable |
| Ground temperature | `GTS_CONFIDENCE_LEVEL` | 2, 3 and 4 | High-quality recalibration; rover still; no shadow in the sensor's view |
| Relative humidity | `HS_CONFIDENCE_LEVEL` | 2 must not be `0` | Relative humidity quality not "bad" (it is `X`, unknown, in the files examined) |
| Water vapour | `HS_CONFIDENCE_LEVEL` | 2 not `0`, and 3 | As above, and the amount of water vapour within the sensor's range (under 400 ppm) |

An `X` in a character required to be `1` counts as not passing. For humidity, NASA marks the quality character `X`
(unknown) throughout, so only readings marked `0` (bad) are removed.

## Rule 4 — Physical limits

Values outside these limits cannot be real at Gale Crater and are removed:

| Measurement | Limits | Reason |
|---|---|---|
| Pressure | 400–1,200 Pa | Gale Crater's readings stay roughly within 700–950 Pa through the year |
| Air temperature | 130–310 K (−143 to 37 °C) | Well below the frost point of carbon dioxide at this pressure (about 148 K) / well above any air temperature measured on Mars |
| Ground temperature | 130–330 K (−143 to 57 °C) | As above, with room for warm sunlit ground |
| Relative humidity | 0–100 % | Relative humidity cannot be outside this range |
| Water vapour | 0–400 ppm | The sensor's stated range (character 3 of the flag) |
| Corrected UV, band ABC | 0–30 W/m² | Well above the largest flux possible at Mars's distance from the Sun |

The limits are deliberately wide: they catch impossible values, not unusual ones. Unusual values are listed for
review instead (rule 8).

## Rule 5 — Information kept with the values

- **Pressure oscillator:** the first character of `PS_CONFIDENCE_LEVEL` says which of the sensor's two oscillators
  was used (`0` = oscillator 1, `1` = oscillator 2). It is not a quality check; readings from both are kept, and the
  number from oscillator 1 is counted.
- **Ground temperature power supply:** the first character of `GTS_CONFIDENCE_LEVEL` is `0` when the sensor's power
  supply is outside 4.87–4.97 V. Late in the mission this is true of almost every reading, while NASA continues to
  release the values. They are kept and counted; ground temperature is shown as lower confidence than pressure and air
  temperature.
- **Humidity is preliminary:** the first character of `HS_CONFIDENCE_LEVEL` is `0` ("preliminary") on every reading
  in the files examined. Humidity is used (decided Nov 11, 2026) and labelled "preliminary" wherever it appears.

## Rule 6 — Coverage of a sol

REMS measures for 5 minutes at the start of every hour, plus some full hours; the full hours move around the day from
sol to sol. A local hour counts when it has at least 60 good one-second readings. A sol is **full** for a measurement
when at least 22 of its 24 hours count, otherwise **partial**. Charts of daily averages use full sols only.

## Rule 7 — Daily statistics

- **Daily mean:** the mean of the hourly means, so every hour of the sol counts once, however long REMS measured in it.
- **Daily minimum and maximum:** from one-minute medians (each minute with at least 30 good readings), so a single
  one-second gust or noise spike does not set the day's extreme. The local hour of each is recorded.
- **Season:** the solar longitude (Ls) and Mars Year at the middle of the sol's measurements, calculated from the date
  by the method of Allison and McEwen (2000) in `mars_time.py`, checked against the archive's stated values (sol 1:
  Ls 151.0, Mars Year 31; sol 4488: Ls 60.1, Mars Year 38). The REMS column `SOLAR_LONGITUDE_ANGLE` is not used:
  despite its name it is the Sun's direction relative to the rover.
- **Humidity:** the humidity sensor is accurate only when it is cold, so relative humidity is summarised as the day's
  highest value (from one-minute medians; it is reached at night) and its local hour, and water vapour as the median
  over local hours 2–6.
- **Rover height:** the median of `ROVER_POSITION_Z` from the ADR file (metres above the landing site). Curiosity has
  been climbing Mount Sharp; pressure falls with height, so height is kept beside every sol's pressure.

## Rule 8 — Listed for review, not removed

Each report lists, for a person to check: a change of more than 15 Pa in daily mean pressure between consecutive full
sols; daily air temperatures outside 150–300 K or ground temperatures outside 150–320 K; and a change of more than 50 m
in rover height between sols with data.

## Rule 9 — Ultraviolet (UV)

UV comes from NASA's corrected UV data set (MSL-M-REMS-5-UVRDR-V1.0, folder `DATA_UV_CORRECTED`), the REMS team's
highest UV processing level: fluxes corrected for dust settling on the sensor and for errors in the original
calibration. It covers sols 1–3423, and only times when the Sun is less than 55° from overhead (other times are
`-999`). The uncorrected UV in the MODRDR files is not used: dust on the sensor makes it misleading, and after sol
3423 there is no corrected UV, so UV charts end there.

- Band used: UV_ABC (the broad band, 220–370 nm), in W/m².
- Per sol: the midday peak (the highest one-minute median, each minute with at least 30 readings), its local hour, and
  the Sun's angle from overhead at that time (the peak depends on the season and on dust in the air).
- The peak counts as the sol's **midday** peak only if it falls between 10:30 and 13:30 local time and the sol has at
  least 30 good minutes of UV (`uv_midday`). A peak later in the afternoon, or a sol with only a few minutes, means
  there were no measurements near noon; charts of the midday peak leave such sols out.
- Each file holds 100 sols (about 1.2 GB); it is read as it downloads and not stored. Its row count is checked against
  its label.

## Rule 10 — Values set aside for review

A value that passes every rule but is plainly not weather (for example one hour 80 °C colder than the hours either
side) is listed in `exclusions.csv` with the sol, the measurement and the reason. It stays in the data files but is
left out of what the page shows until it has been reviewed. The automatic rules are not changed for a single case.

Since version 1.2 the list is empty: the 26 sols set aside on November 12, 2026 (evening air-temperature glitches) are
handled by rule 11.

## Rule 11 — Single-hour air-temperature glitches (since version 1.2)

On some evenings (about 18:00–20:00 local, more often since sol 4087) the air temperature reads about −115 to −120 °C
for part of one hour, between hours of about −35 to −55 °C. Air cannot cool by 70 K and warm again within an hour, so
these readings are not weather. They pass rules 3 and 4 (the flags are good and the values are within the limits), so
a separate rule removes them:

- for each local hour whose neighbouring hours (before and after) both have at least 60 good readings, take the mean
  of each neighbour;
- a one-minute median in that hour more than 25 K colder than the colder neighbour's mean, or 25 K warmer than the
  warmer one's, is a glitch, and every reading in that minute is removed;
- the rest of the hour and of the sol is kept. Each cleaning report counts the readings removed and names the sols.

Real changes within an hour stay well inside 25 K: the fastest real change, the morning warm-up, is about 10–15 K
per hour. The rule replaces the 26 sols set aside by hand under rule 10 on November 12, 2026.

Checked on the whole record (November 12, 2026): rule 11 removed readings on 34 sols, all evening glitches of this
kind: the 26 sols set aside under rule 10, and 2805, 3325, 4175, 4188, 4204, 4226, 4294 and 4823, where the glitch
was shorter (removing it moves the daily mean by less than 0.1 K, or changes no published figure). After it, no hourly mean is more than 25 K beyond both neighbouring hours,
and no full sol has a daily air minimum below 170 K. A first version compared an hour with only one neighbour when the
next hour had no data; on sol 1418 that removed 39 readings of real morning warming. The rule now applies only when
both neighbouring hours have data, as written above, and sol 1418 was processed again.

---

Created by **Malcolm Syme** · <mcsyme11@gmail.com> · part of NASA and ESA Data Projects.
