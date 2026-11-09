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
- **By year:** every approach within 1, 5 or 10 Moon distances on a timeline, any year from 2000 to next year, and
  how many were found each year (NASA/JPL data, refreshed daily).
- **Each asteroid's page:** its size and orbit, every close approach to Earth from 1900 to 2200, and the **orbit
  diagram**: the Sun, the planets and the asteroid to scale at any date from 1900 to 2050, turnable, with Play,
  a slider and a "Near Earth" view.
- **Solar System Map** (`map.html`): all 43,186 near-Earth objects, the planets and eleven spacecraft, turnable and
  zoomable at 60 frames a second, with a discovery timeline ("Found by the end of"), "Close to Earth in", Find and
  filters. A live preview runs on the home page.
- **Search:** results with every letter, a "Found in" filter, and a guide to how asteroids are named, with each code
  decoded (2024 YR4: found December 16–31, 2024, the 117th new small body given a code in that half-month).
- **Key settings:** a personal NASA key, kept in the browser only; NASA's shared demo key otherwise.

## The numbers: which rule to use when

| You have | You want | Rule | Example |
|---|---|---|---|
| km | Moon distances (LD) | LD = km ÷ 384,400 | 1,150,000 km ÷ 384,400 = **3.0 LD** |
| au (JPL) | km | km = au × 149,597,870.7 | 0.0000501 au = **7,495 km** = 0.0195 LD |
| km/s | km/h | km/h = km/s × 3,600 | 12.1 km/s = **43,560 km/h** |
| brightness H, no measured size | diameter range | D (km) = 1329 ÷ √p × 10^(−H ÷ 5), with p = 0.25 (smallest) and p = 0.05 (largest) | H = 22 → **106–237 m** |
| a measured diameter (JPL, rare) | size | use it as given | 433 Eros: **about 16.8 km** |
| orbital elements and a date | position around the Sun | M = M0 + n·(days since epoch) → solve M = E − e·sin E → x′ = a(cos E − e), y′ = a√(1−e²)·sin E → rotate by ω, i, Ω | 1998 VE31 on Nov 9, 2026: **0.1785 au** from Earth (NASA: 0.1785) |
| a provisional code, e.g. 2024 YR4 | when it was found | year; 1st letter = half-month (A = Jan 1–15 … Y = Dec 16–31, no I); order = number × 25 + position of the 2nd letter (no I) | 2024 YR4: Dec 16–31, 2024, **117th** |
| distance from the Sun r, orbit size a | speed around the Sun | v = √(GM☉ · (2/r − 1/a)), GM☉ = 1.327 × 10¹¹ km³/s² | r = 1.15 au, a = 1.05 au → **26.4 km/s** |

## Data

| Source | Used for | Key | How |
|---|---|---|---|
| NASA NeoWs `feed` (`api.nasa.gov/neo/rest/v1/`) | This week | NASA key or `DEMO_KEY` | Live from the page, 1 request per week shown |
| NASA NeoWs `neo/{id}` | Each asteroid's page | NASA key or `DEMO_KEY` | Live, 1 request per page |
| NASA/JPL Close-Approach Data (`ssd-api.jpl.nasa.gov/cad.api`) | By year | none | Daily files, `data/YYYY.json` and `data/years.json` (the API blocks calls from web pages) |
| JPL approximate planetary elements | The orbit diagram's and the map's planets | none | Copied into `orbit.js` (valid 1800–2050) |
| NASA/JPL Small-Body Database Query API | Map and search | none | Daily file `data/neos.json` (and `data/preview.json`) |
| NASA/JPL Horizons | The map's spacecraft and famous close passes | none | Daily file `data/spacecraft.json`; monthly `data/famous.json` |

Limits: the `feed` covers at most 7 days per request; `DEMO_KEY` allows 30 requests an hour and 50 a day per
connection, a personal key 1,000 an hour. Details: [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md).

## Files

```
asteroid-tracker/
├── index.html                   the tracker: This week, By year and Search tabs
├── object.html                  one asteroid: facts, the orbit diagram, every close approach
├── map.html                     the solar system map
├── tracker.css                  styles for all three pages (on top of shared/theme.css)
├── app.js                       the tracker's data, filters, sorting, tables and tabs
├── object.js                    the asteroid page: loading, the diagram's controls, the approaches chart and list
├── map.js                       the map page: controls, selection, Find, year filters, full screen
├── skymap.js                    the map's renderer: 43,000 orbits in typed arrays, drawn into a pixel buffer
├── kepler.js                    the map's orbit solving, shared by the page and the background thread
├── orbitworker.js               the background thread (Web Worker) that solves the orbits while the map plays
├── back.js                      the "‹ Back" buttons and keeping a page's place when returning to it
├── preview.js                   the home page's live preview of the map
├── mapdata.js                   loads the map's and search's data files
├── search.js                    search over every name, ids, name decoding, result cards
├── searchview.js                the Search tab
├── charts.js                    the tracker's SVG charts and the shared tooltips
├── orbit.js                     orbit maths: Kepler's equation, planet and asteroid positions (JPL elements)
├── orbitview.js                 the orbit diagram: projection, views, drawing, labels, dragging
├── format.js                    units, the size rule and number formatting
├── fetch_close_approaches.py    writes data/YYYY.json and data/years.json (daily, GitHub Actions)
├── fetch_map_data.py            writes data/neos.json, data/preview.json, data/spacecraft.json (daily), data/famous.json (monthly)
├── data/                        the files above
└── README.md                    this file
```

Run locally: `python3 -m http.server 8000` in the repository's top folder, then open
`http://localhost:8000/asteroid-tracker/`. Refresh the data by hand: `python3 asteroid-tracker/fetch_close_approaches.py` (add `--all` for every year).

---

**Asteroid Tracker** · part of NASA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
