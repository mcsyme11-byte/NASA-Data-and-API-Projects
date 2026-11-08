# Asteroid Tracker

**Project 1 of NASA Data Projects.** Status: **version 1 live** (Nov 8, 2026):
https://mcsyme11-byte.github.io/NASA-Data-and-API-Projects/asteroid-tracker/

Every near-Earth object passing Earth, sorted by size and distance, with graphs to explore in an interactive dashboard.

## What it does

- **This week:** every close approach from NASA NeoWs, live: the number passing Earth, the closest, the biggest, the
  fastest and those flagged potentially hazardous. Previous and next weeks.
- **Filter and sort:** potentially hazardous only, size, distance, day; sort by time, distance, size, speed or name.
- **Details for each object:** size, miss distance and speed, with comparisons people can picture.
- **Graphs:** size against miss distance, approaches per day, the week's biggest.
- **This year:** every approach within 1, 5 or 10 Moon distances on a timeline (NASA/JPL data, refreshed daily).
- **Key settings:** a personal NASA key, kept in the browser only; NASA's shared demo key otherwise.

## The numbers: which rule to use when

| You have | You want | Rule | Example |
|---|---|---|---|
| km | Moon distances (LD) | LD = km ÷ 384,400 | 1,150,000 km ÷ 384,400 = **3.0 LD** |
| au (JPL) | km | km = au × 149,597,870.7 | 0.0000501 au = **7,495 km** = 0.0195 LD |
| km/s | km/h | km/h = km/s × 3,600 | 12.1 km/s = **43,560 km/h** |
| brightness H, no measured size | diameter range | D (km) = 1329 ÷ √p × 10^(−H ÷ 5), with p = 0.25 (smallest) and p = 0.05 (largest) | H = 22 → **106–237 m** |
| a measured diameter (JPL, rare) | size | use it as given | 433 Eros: **about 16.8 km** |

## Data

| Source | Used for | Key | How |
|---|---|---|---|
| NASA NeoWs `feed` (`api.nasa.gov/neo/rest/v1/`) | This week | NASA key or `DEMO_KEY` | Live from the page, 1 request per week shown |
| NASA/JPL Close-Approach Data (`ssd-api.jpl.nasa.gov/cad.api`) | This year | none | Daily file, `data/close-approaches.json` (the API blocks calls from web pages) |

Limits: the `feed` covers at most 7 days per request; `DEMO_KEY` allows 30 requests an hour and 50 a day per
connection, a personal key 1,000 an hour. Details: [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md).

## Files

```
asteroid-tracker/
├── index.html                   the page
├── tracker.css                  its styles (on top of shared/theme.css)
├── app.js                       loading the data, filters, sorting, tables, views
├── charts.js                    the four SVG charts and their tooltips
├── format.js                    units, the size rule and number formatting
├── fetch_close_approaches.py    writes data/close-approaches.json (run daily by GitHub Actions)
├── data/close-approaches.json   the year's close approaches within 10 LD
└── README.md                    this file
```

Run locally: `python3 -m http.server 8000` in the repository's top folder, then open
`http://localhost:8000/asteroid-tracker/`. Refresh the year's data by hand: `python3 asteroid-tracker/fetch_close_approaches.py`.

---

**Asteroid Tracker** · part of NASA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
