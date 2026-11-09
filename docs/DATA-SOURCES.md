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

Checked Nov 8, 2026 (live requests from the published site):
- **Browsers may call it** (CORS allowed), so the Asteroid Tracker requests the week's feed from the page.
- **The rate-limit headers are not readable from a web page** (NASA does not expose them to browsers), so the page
  cannot show "requests left"; it shows which key is in use and that key's limits instead.
- `close_approach_data[].epoch_date_close_approach` is the close-approach time in milliseconds, UTC
  (1794183300000 = 2026-11-09 00:15 UTC, matching `close_approach_date_full`). Speed used:
  `relative_velocity.kilometers_per_second`.
- `estimated_diameter.meters` gives min and max; the range corresponds to albedos of about 0.25 and 0.05 (see the
  size rule below).
- A typical week: 42 close approaches, 5 flagged potentially hazardous (Nov 8–14, 2026).

`neo/{id}`, checked Nov 8, 2026 (used by the Asteroid Tracker's page for one asteroid, 1 request per page):
- Top level: `id`, `neo_reference_id`, `name`, `designation`, `absolute_magnitude_h`, `estimated_diameter`,
  `is_potentially_hazardous_asteroid`, `is_sentry_object`, `nasa_jpl_url`, `close_approach_data`, `orbital_data`.
- `close_approach_data`: every computed approach, 1900–2200 (for example 36 for 1998 VE31, all to Earth); same fields
  as in the feed.
- `orbital_data` (numbers given as strings): `semi_major_axis` (au), `eccentricity`, `inclination`,
  `ascending_node_longitude`, `perihelion_argument`, `mean_anomaly` (degrees, J2000 ecliptic), `mean_motion`
  (degrees per day), `epoch_osculation` (Julian date of these elements), `perihelion_distance`, `aphelion_distance`,
  `orbital_period` (days), `minimum_orbit_intersection` (MOID, au), `orbit_class` (type, description, range),
  `observations_used`, `first_observation_date`, `last_observation_date`, `data_arc_in_days`,
  `orbit_determination_date`, `orbit_uncertainty` (0 best to 9).
- **Ids:** an unnumbered object has a 7-digit id (3092201 for 1998 VE31); a numbered asteroid's id is
  2,000,000 + its number (433 Eros = 2000433).

### JPL Close-Approach Data API

`https://ssd-api.jpl.nasa.gov/cad.api` (no key). Close approaches over any date range, past and future, filtered by
distance (`dist-max`, for example `10LD`) and date (`date-min`, `date-max`). Suited to "the closest approaches of
the year" and to history beyond NeoWs's 7-day window.

Checked Nov 8, 2026 against the API's documentation (version 1.5) and live answers:
- **No CORS headers:** browsers block a web page from calling it. The Asteroid Tracker therefore reads files,
  `asteroid-tracker/data/YYYY.json` (one per year, 2000 to next year, approaches within 10 LD) and
  `asteroid-tracker/data/years.json` (the years and their counts within 1, 5 and 10 LD), written by
  `asteroid-tracker/fetch_close_approaches.py` on GitHub Actions (`.github/workflows/asteroid-data.yml`): daily for
  this year and next year and any missing year; every year when run by hand with "all".
- **Defaults:** `date-min=now`, `date-max=+60` (days), `dist-max=0.05` (au), NEOs only, Earth, sorted by date.
- **Useful options:** `diameter=true`, `fullname=true`, `sort` (`date`, `dist`, `-dist`, …), `limit`,
  `total-only=true` (the count only).
- **Each row is an array** in the order given by `fields`: `des`, `orbit_id`, `jd`, `cd` (calendar time, TDB, about
  69 s from UTC), `dist`, `dist_min`, `dist_max` (au), `v_rel`, `v_inf` (km/s), `t_sigma_f`, `h` (absolute
  magnitude), then `diameter` and `diameter_sigma` (km, usually null) and `fullname` when asked for.
- An empty answer is HTTP 200 with `count` 0. Errors: 400, 405, 500, 503.
- Counts for the whole of 2026, as known on Nov 8, 2026: 1,053 close approaches within 10 LD and 144 within 1 LD
  (about 50 KB as the daily file); 1,558 within 0.05 au.

### Planet positions (JPL approximate elements)

`https://ssd.jpl.nasa.gov/planets/approx_pos.html`, Table 1 (valid 1800–2050, mean ecliptic and equinox J2000),
checked Nov 8, 2026 and copied into `asteroid-tracker/orbit.js`: each planet's a, e, I, L, ϖ, Ω and their rates per
century, with the procedure (elements at the date → ω = ϖ − Ω and M = L − ϖ → Kepler's equation → in-plane
coordinates → rotation into the ecliptic). The orbit diagram therefore covers 1900–2050.

Checks of `orbit.js` (Nov 8, 2026): Earth 0.98330 au from the Sun at the 2026 perihelion and 1.01670 au at aphelion;
1998 VE31 0.1785 au from Earth on 2026-11-09 00:15 UTC (NeoWs: 0.1784980 au), with the computed closest moment within
half an hour of NASA's. A century from the elements' epoch the two-body model drifts (1927 approach: 0.190 au
computed against 0.151 au), which the page states as "good", "approximate" or "rough" for the date shown.

### Size from brightness (when no measured diameter is given)

```
D (km) = 1329 ÷ √p × 10^(−H ÷ 5)
```
- H: absolute magnitude (brightness; a larger H means a smaller object). p: albedo (how much light the surface
  reflects).
- **p = 0.25** (bright surface) gives the **smallest** likely size; **p = 0.05** (dark) the **largest**.
- Example: H = 22 → 106 m to 237 m. This is the range NeoWs reports; the Asteroid Tracker applies the same rule to
  JPL's data (`asteroid-tracker/format.js`).

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

### SBDB Query API (every near-Earth object), checked Nov 8–9, 2026

`https://ssd-api.jpl.nasa.gov/sbdb_query.api` (no key; no CORS headers, so it is fetched by
`asteroid-tracker/fetch_map_data.py` on GitHub Actions and saved as `asteroid-tracker/data/neos.json`).
- Query used: `sb-group=neo`, `full-prec=true`, `fields=spkid,full_name,pdes,a,e,i,om,w,ma,epoch,H,diameter,pha,class,first_obs`.
- Answer: `fields` and `data` (one array per object, numbers as strings) and `count`. 43,186 objects on Nov 8, 2026,
  2,552 of them potentially hazardous; 209 are comets (classes JFc, JFC, HTC, ETc, …), the rest asteroids (APO 24,454,
  AMO 14,979, ATE 3,505, IEO 39). Nearly all share one epoch of osculation (2461200.5); a few thousand have their own.
- `first_obs` is the first observation found, which can be older than the discovery (precovery in archive images):
  Eros 1893, discovered 1898. The "year found" in `neos.json` is therefore the year in the provisional code
  (2004 MN4 → 2004, A898 PA → 1898), and `first_obs` only where there is no such code (survey codes such as
  6344 P-L); comets have no year found.
- **Ids:** SBDB's `spkid` is 20,000,000 + number for numbered asteroids (Apophis 20099942) and an 8-digit id for the
  others (1998 VE31 = 50092224). NeoWs (`neo/{id}`) uses 2,000,000 + number for numbered asteroids (2099942) and
  accepts the 8-digit id for the others (checked: 50092224 returns 1998 VE31). NeoWs does not cover comets; the pages
  link comets to JPL's lookup page instead.
- Size: about 5.5 MB as JSON, about 1.8 MB as GitHub Pages sends it (compressed).

### Horizons API (spacecraft), checked Nov 8–9, 2026

`https://ssd.jpl.nasa.gov/api/horizons.api` (no key; no CORS headers; fetched by `fetch_map_data.py`).
- Query: `COMMAND='<id>'`, `EPHEM_TYPE=VECTORS`, `CENTER='500@10'` (the Sun), `OUT_UNITS=AU-D`,
  `REF_PLANE=ECLIPTIC`, `REF_SYSTEM=ICRF`, `VEC_TABLE=1` (position only), `CSV_FORMAT=YES`, `STEP_SIZE='<n> d'`.
  The table is between `$$SOE` and `$$EOE`; each line gives the Julian date, the calendar date, then x, y, z in au.
- Ids used: Voyager 1 −31, Voyager 2 −32, New Horizons −98, Parker Solar Probe −96, Lucy −49, Psyche −255,
  OSIRIS-REx/APEX −64, Hera −91, James Webb Space Telescope −170, Europa Clipper −159, Juno −61. On Nov 1, 2026
  Voyager 1 was 172 au from the Sun, Voyager 2 145 au, New Horizons 66 au.
- When a range starts before a spacecraft's data, Horizons answers with the first date it covers; the script then
  retries from that date. Each spacecraft is sampled every 1 to 30 days from launch to a year ahead (about 240 KB).
- The International Space Station and Hubble are not on the map: 400–540 km above Earth, they sit inside Earth's dot
  at any scale it shows.

### Asteroid names (Minor Planet Center rules)

Used by `decodeCode()` in `asteroid-tracker/search.js`:
- **Provisional code** `YYYY XYn`: the year found; X the half-month (A = Jan 1–15, B = Jan 16–31, … Y = Dec 16–31;
  I and Z not used); Y and n the order in that half-month: 25 letters A–Z without I, n the number of times the
  alphabet was used up, so order = n × 25 + position of Y. Example: 2024 YR4 = Dec 16–31, 2024, 4 × 25 + 17 = 117th.
- Old-style codes before 1925 begin with A and the last three digits of the year (A898 PA = 1898).
- Survey codes `nnnn P-L` (Palomar–Leiden survey, 1960) and `nnnn T-1/T-2/T-3` (Trojan surveys, 1971, 1973, 1977).
- A permanent **number** follows once the orbit is secure, then possibly a **name** approved by the IAU; the full
  name keeps all three: 99942 Apophis (2004 MN4).
- Checked against known discovery dates: Eros Aug 13, 1898 (A898 PA); Apollo Apr 24, 1932 (1932 HA); Phaethon
  Oct 11, 1983 (1983 TB); Bennu Sep 11, 1999 (1999 RQ36); Apophis Jun 19, 2004 (2004 MN4); 2024 YR4 Dec 27, 2024.

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
