# Mars Data

**Project 3 of NASA and ESA Data Projects.** Status: **planned** (built in its own chat).

NASA missions gather an incredible amount of information about Mars, and much of it is publicly available. This
project digs into patterns in measurements from Mars missions: cleaning the data, organising the measurements by
location and time, calculating statistics, and making visualisations that show interesting patterns or relationships.

## The plan

1. **Get:** download measurements from NASA's Planetary Data System (PDS).
2. **Clean:** remove missing and impossible readings, convert units (kelvin → °C, Pa → hPa), and mark gaps.
3. **Organise:** by **sol** (a Mars day, 24 h 39 min), by **Ls** (solar longitude, the season: 0° = northern spring) and by time of day.
4. **Statistics:** daily highs and lows, seasonal averages, ranges, and how two measurements move together.
5. **Visualise:** a page of charts in the project's look.

**Example pattern to look for:** air pressure at Gale Crater rises and falls over the Mars year, because a large
share of the atmosphere (carbon dioxide) freezes onto the winter pole and thaws again.

## Data (first choice)

| Source | What it gives | Key |
|---|---|---|
| Curiosity's weather station (REMS), PDS Atmospheres Node | Air and ground temperature, pressure, humidity, wind and UV at Gale Crater, from August 2012 | none |

Other candidates: InSight's weather data at Elysium Planitia (2018–2022, mission ended), Viking Lander records
(1976–1982) for comparison. Details: [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md).

## Files (to come)

```
mars-data/
├── index.html       the charts page (a placeholder for now)
├── analysis/        Python: download, clean, organise, statistics
├── data/            cleaned, small summary files the page reads (raw downloads are not committed)
└── README.md        this file
```

---

**Mars Data** · part of NASA and ESA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
