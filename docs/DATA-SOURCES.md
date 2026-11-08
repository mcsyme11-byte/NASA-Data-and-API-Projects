# Data sources

Every NASA source the projects use or may use, with how to reach it, what it needs, and its limits.
Checked November 8, 2026. Each project's chat confirms the details again before building on them.

## Keys at a glance

| Source | Key needed? | Used by |
|---|---|---|
| api.nasa.gov (NeoWs and others) | Yes: a free personal key, or `DEMO_KEY` | Asteroid Tracker |
| JPL SSD APIs (close approaches, small-body database) | No | Asteroid Tracker |
| PDS Atmospheres Node (Mars weather) | No (file downloads) | Mars Data |
| GIBS (satellite imagery tiles) | No | Image Explorer |
| NASA Image and Video Library | No | Image Explorer |

## api.nasa.gov

- **Sign up:** api.nasa.gov, free, the key arrives by email. One key works for every api.nasa.gov service.
- **Passing it:** as the `api_key` query parameter.
- **Limits:**
  - `DEMO_KEY` (NASA's shared key for trying things out): **30 requests an hour, 50 a day**, per connection (IP).
  - A personal key: **1,000 requests an hour**.
  - Every answer carries `X-RateLimit-Limit` and `X-RateLimit-Remaining` headers; going over returns **429**.
- **In this repository:** web pages use `shared/nasa.js` (the visitor's key in their browser only); Python reads
  `NASA_API_KEY` from `.env`. No key is committed.

## Asteroid Tracker

### NeoWs (Near Earth Object Web Service)

Base: `https://api.nasa.gov/neo/rest/v1/`

| Endpoint | What it returns |
|---|---|
| `feed?start_date=YYYY-MM-DD&end_date=YYYY-MM-DD` | Every object with a close approach in the range, grouped by date. **At most 7 days per request.** |
| `neo/{id}` | One object: its orbit and all its known close approaches |
| `neo/browse?page=n&size=20` | The whole catalogue, a page at a time |

Useful fields per object: `name`, `estimated_diameter` (min and max, in km, m, miles and feet),
`is_potentially_hazardous_asteroid`, and in `close_approach_data`: `close_approach_date_full`,
`relative_velocity.kilometers_per_hour`, `miss_distance.kilometers` and `miss_distance.lunar`.

Example: one week's feed
```
https://api.nasa.gov/neo/rest/v1/feed?start_date=2026-11-01&end_date=2026-11-07&api_key=DEMO_KEY
```

### JPL Close-Approach Data API

`https://ssd-api.jpl.nasa.gov/cad.api` (no key). Close approaches over any date range, past and future, filtered by
distance (`dist-max`, for example `10LD`) and date (`date-min`, `date-max`). Suited to "the closest approaches of
the year" and to history beyond NeoWs's 7-day window.

## Mars Data

### Curiosity's weather station (REMS), PDS Atmospheres Node

- **Where:** NASA's Planetary Data System, Atmospheres Node (atmos.nmsu.edu › Mars › Curiosity › REMS).
- **What:** air and ground temperature, pressure, relative humidity, wind and UV at Gale Crater, from sol 1
  (August 7, 2012), released in batches.
- **Which files:** the reduced data (RDR). The **MODRDR** set (environmental values, corrected) is the likely
  starting point; units are kelvin and pascals.
- **Rhythm:** readings once a second, usually 5-minute blocks every hour plus some full hours each sol, so the
  data is uneven in time and needs organising before averages mean anything.

### Other candidates

| Source | Covers | Note |
|---|---|---|
| InSight weather (TWINS, pressure sensor) | Elysium Planitia, 2018–2022 | The mission has ended; archived in the PDS |
| Viking Lander meteorology | 1976–1982 | For a then-and-now comparison |

## Image Explorer

### GIBS (Global Imagery Browse Services)

- **What:** over 1,000 satellite imagery layers of Earth, as map tiles, by date.
- **No key.** Tile URL pattern (WMTS, REST):
  ```
  https://gibs.earthdata.nasa.gov/wmts/{projection}/best/{Layer}/default/{YYYY-MM-DD}/{TileMatrixSet}/{z}/{y}/{x}.{jpg|png}
  ```
  For a normal web map use `epsg3857` with a `GoogleMapsCompatible_LevelN` tile set (N is the layer's deepest zoom).
- **Layer list and dates:** the GetCapabilities document,
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities`.
- **Limits:** each layer has its own image format, deepest zoom and date range; asking outside them gives blank
  tiles or errors.
- **Required acknowledgement** (NASA asks every user of GIBS to show it):
  > We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of
  > NASA's Earth Science Data and Information System (ESDIS).

### NASA Image and Video Library

- `https://images-api.nasa.gov/search?q=...&media_type=image` (no key).
- Filters: `q` (keywords), `center` (for example JPL, GSFC), `year_start`, `year_end`, `keywords`, `page`.
- Each result has a title, description, date, NASA centre and keywords; `asset/{nasa_id}` lists the image sizes.

## Using NASA material

- NASA data and imagery are generally free to use and not under copyright in the United States, but NASA's insignia
  (the "meatball" logo) and logotype **may not be used** without permission. These projects use their own emblem.
- Pages say "Data courtesy of NASA" and that the project isn't endorsed by NASA.
