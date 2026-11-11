# Data sources

Every NASA source the projects use or may use, with how to reach it, what it needs, and its limits.
Checked November 8, 2026 (Image Explorer sources: November 9, 2026). Each project's chat confirms the details again before building on them.

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

### JPL Sentry API (impact monitoring), checked Nov 9, 2026

`https://ssd-api.jpl.nasa.gov/sentry.api` (no key; documentation at `https://ssd-api.jpl.nasa.gov/doc/sentry.html`,
API version 2.0). NASA/JPL's automatic impact-monitoring list: every object with a calculated, non-zero chance of
hitting Earth within the next 100 years or so.
- **Summary (no parameters):** one row per object: `des`, `fullname`, `ip` (cumulative impact probability), `ps_cum`,
  `ps_max` (Palermo), `ts_max` (Torino), `n_imp` (number of possible impacts), `range` (years), `h`, `diameter` (km),
  `v_inf` (km/s), `last_obs`. Numbers are sent as strings.
- **`all=1`:** every possible impact of every object (`des`, `date`, `ip`, `ps`, `ts`); used to find each object's most
  likely impact date.
- **No CORS header** in the replies recorded by the data job, so pages read `asteroid-tracker/data/risk.json`, written
  by `asteroid-tracker/fetch_risk.py` on GitHub Actions (twice a day, with the close-approach job).
- A speed or other figure can arrive as `nan`; the job keeps only finite numbers and refuses to write NaN, because a
  browser cannot read JSON containing it.
- Count on Nov 9, 2026: 2,242 objects. Credit: "NASA/JPL (Sentry)".

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
  retries from that date. Each spacecraft is sampled every 4 to 30 days from launch to a year ahead, and Parker Solar
  Probe every 6 hours (`STEP_SIZE='6 h'`; stored as a step of 0.25 days), since near the Sun it moves about 16 million
  km a day while passing about 7 million km from it (about 600 KB in all).
- The International Space Station and Hubble are not on the map: 400–540 km above Earth, they sit inside Earth's dot
  at any scale it shows.

### Horizons API (famous close passes), checked Nov 9, 2026

- Same endpoint, written monthly (on the 1st, or with `--all`, or when the list of passes changes) to
  `data/famous.json` (about 780 KB, eight passes) by `fetch_map_data.py`. For each pass: the asteroid, Earth (`399`) and the Moon (`301`), with `VEC_TABLE=2`
  (position and velocity), `CENTER='500@10'`, ecliptic, au and au/day.
- Small bodies are named with a trailing semicolon: `'99942;'` for a numbered asteroid, `'DES=2020 QG;'` for one
  known only by its code.
- Samples: every 10 minutes within 12 hours of closest approach, hourly within 3 days, daily within 40 days
  (339 per body). The page joins them with cubic Hermite interpolation (positions and velocities).
- Check: the distance from Earth's centre at closest approach matches the JPL close-approach figures to within
  16 km for all five passes; 2024 YR4's pass by the Moon gives 22,940 km against JPL's 22,938 km. Close-approach
  distances are measured from the centre of Earth (or the Moon), not the surface.
- Since Nov 9, 2026 each pass also stores `cad`: NASA/JPL close-approach data for that date (`cad.api`, `des`,
  `body=Earth` or `Moon`, `dist-max=0.2`, dates ±3 days): `cd` (UTC time), `km` (from the centre) and `v_rel` (km/s).
  The tour and its card use these. They differ slightly from earlier published figures because orbits are refined
  (for example 2020 QG: 9,317 km in 2026, 9,302 km as first published).

### soon.json (home page), added Nov 9, 2026

- Written daily by `fetch_map_data.py` from the close-approach year files: every pass within 10 Moon distances from a
  day before the run to 15 days after it, as `[name, time_ms_utc, distance_ld, h, neows_id, designation]`. The NeoWs
  id is 2,000,000 + number for numbered asteroids, otherwise the SBDB `spkid`; comets get none. The home page shows
  the closest pass between the moment it is opened and 7 days later, in the visitor's time zone.

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

- **What:** over 1,000 satellite imagery layers of Earth, as map tiles, by date (1,332 layers on Nov 9, 2026).
- **No key.** Tile URL pattern (WMTS, REST):
  ```
  https://gibs.earthdata.nasa.gov/wmts/{projection}/best/{Layer}/default/{YYYY-MM-DD}/{TileMatrixSet}/{z}/{y}/{x}.{jpg|png|mvt}
  ```
- **Layer list and dates:** the GetCapabilities document of each projection, for example
  `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/wmts.cgi?SERVICE=WMTS&REQUEST=GetCapabilities`.
- **Required acknowledgement** (NASA asks every user of GIBS to show it):
  > We acknowledge the use of imagery provided by services from NASA's Global Imagery Browse Services (GIBS), part of
  > NASA's Earth Science Data and Information System (ESDIS).

Checked Nov 9, 2026 (live requests from the published site):
- **Browsers may call it** (CORS allowed): tiles and the GetCapabilities documents load from a web page.
- **Projections:** `epsg4326` (the world as a flat grid of latitude and longitude, 1,332 layers), `epsg3857` (web
  map, 1,332 layers), `epsg3413` (Arctic, 303 layers) and `epsg3031` (Antarctic, 263 layers).
- **The fire layers only work in `epsg4326`** (and the polar projections): they are vector tiles (`.mvt`, points),
  listed in `epsg3857` but every `epsg3857` request returned 404 (eight tiles at zoom 0–7, two dates), while the
  same tiles in `epsg4326` returned data. **The Image Explorer therefore uses `epsg4326`**, as NASA Worldview does.
- **`epsg4326` tile sets:** 512 px tiles from the top-left corner (−180°, 90°); level 0 is 0.5625° per pixel (2 × 1
  tiles), each level halves it. Deepest level: `250m` 8, `500m` 7, `1km` 6, `2km` 5. Tile path order is
  `{level}/{row}/{column}`.
- **Answers:** a tile outside a layer's dates returns 404 (true colour on 1990-01-01; the MUR layers on a day not yet
  processed); a level deeper than the layer's set returns 400. The page treats these as "no picture here", not as
  errors.
- **Size of the layer list:** the `epsg3857` GetCapabilities document is about 5.8 MB, too large to load on every
  visit; each layer's dates are also available on their own (the `…/all/--{TimeEnd}.xml` and `{TimeStart}--{TimeEnd}`
  templates under each layer's `ResourceURL`).
- **A layer's days (used since Nov 10, 2026):** `https://gibs.earthdata.nasa.gov/wmts/{projection}/best/1.0.0/{Layer}/default/{TileMatrixSet}/all/--{YYYY-MM-DD}.xml`
  returns, in about 0.1 s and well under 1 kB, the runs of days the layer has up to that date, in `<Domain>`, for
  example `2002-06-01/2021-02-19/P1D,2021-02-22/2022-11-08/P1D,…`; an unknown layer returns 404. Checked Nov 10, 2026:
  MUR sea temperature misses six short runs of days (newest day two days back), true colour misses nine runs in
  2000–2022; MODIS layers end on the current, still incomplete UTC day. Browsers may read it.
- **Colour maps (used since Nov 10, 2026 for the colour keys):** each `ColorMap` in the v1.3 XML has a `Legend`
  (`continuous`, `discrete` or `classification`) with `LegendEntry` elements in order (`rgb`, `tooltip`, and on some
  `showTick`, `showLabel` and `label`), `minLabel` and `maxLabel`, and the map's `title` and `units` (for example °C,
  %, K). A "No Data" map lists the colour for missing values. Browsers may read them.
- **Colour keys:** each coloured layer lists an SVG legend (`https://gibs.earthdata.nasa.gov/legends/{name}_H.svg`,
  dark text on a light background) and a colour map (`https://gibs.earthdata.nasa.gov/colormaps/v1.3/{name}.xml`).

The eight layers chosen (Nov 9, 2026), with their tile sets in `epsg4326` and first dates:

| On the page | GIBS layer | Tile set · format | From |
|---|---|---|---|
| True colour | `MODIS_Terra_CorrectedReflectance_TrueColor` | 250m · jpg | 2000-02-24 |
| Night lights | `VIIRS_NOAA20_DayNightBand` | 1km · png | 2018-01-05 |
| Sea temperature | `GHRSST_L4_MUR_Sea_Surface_Temperature` | 1km · png | 2002-06-01 |
| Fires | `MODIS_Combined_Thermal_Anomalies_All` | 1km · mvt (points) | 2002-07-04 |
| Snow | `MODIS_Terra_NDSI_Snow_Cover` | 500m · png | 2000-02-24 |
| Clouds | `MODIS_Terra_Cloud_Top_Temp_Day` | 2km · png | 2000-02-24 |
| Smoke and dust | `MODIS_Terra_Aerosol` (aerosol optical depth, land and ocean) | 2km · png | 2000-02-24 |
| Sea ice | `GHRSST_L4_MUR_Sea_Ice_Concentration` | 1km · png | 2002-06-01 |

- Most layers have gaps in their dates (several ranges in the layer list); the page reads them rather than assuming
  every day exists.
- **Newest day:** on Nov 9, 2026 the MODIS and VIIRS layers reached Nov 8 or 9; the two MUR layers (sea temperature,
  sea ice) reached Nov 7.
- **Night lights:** `VIIRS_Black_Marble` (cloud-free city lights) exists only for 2012 and 2016, so the daily
  day/night band is used; it also shows moonlit cloud and fires.
- `Reference_Features_15m` and `Reference_Labels_15m` (coastlines, borders and names from OpenStreetMap) are
  available as overlays if wanted later; they require the OpenStreetMap credit.

### NASA Image and Video Library

- `https://images-api.nasa.gov/search?q=...&media_type=image` (no key).
- Filters: `q` (keywords), `center` (for example JPL, GSFC), `year_start`, `year_end`, `keywords`, `page`.
- Each result has a title, description, date, NASA centre and keywords; `asset/{nasa_id}` lists the image sizes.

Checked Nov 9, 2026 (live requests from the published site):
- **Browsers may call it** (CORS allowed), for searches, `asset/{nasa_id}` and the image files. One search request
  failed to connect and worked when repeated, so the page retries once before showing an error.
- **Answer:** `collection.items[]`, each with `data[0]` (`title`, `description`, `date_created`, `center`,
  `keywords`, `media_type`, `nasa_id`, and sometimes `photographer`, `secondary_creator`, `location`, `album`,
  `description_508`) and `links[]` (image sizes with width and height; `rel: "preview"` is the thumbnail);
  `collection.metadata.total_hits`; `collection.links` with `next` and `prev` pages.
- **Paging:** 100 results per page by default; `page_size` sets it (for example 24). **At most 10,000 results** per
  search: page 100 of 100 works, page 101 returns 400 ("Maximum number of search results have been displayed").
- `center` ignores letter case (`gsfc` = `GSFC`); `media_type=image,video` returns both. Examples: "hubble" 4,960
  results, 598 from GSFC, 249 from 1990–1995; "apollo" 5,940 images and 222 videos.
- **`date_created` is the date in NASA's records,** sometimes not the date the picture was taken (an Apollo picture
  from 1967 carries 2008-07-11); the caption usually gives the real date.
- **`location` is where the picture was published or taken** (for example "Greenbelt, MD" for Goddard), not a map
  position: no result has coordinates. Searching by place therefore searches the words in titles, captions and
  keywords.
- **File names:** `https://images-assets.nasa.gov/image/{nasa_id}/{nasa_id}~{thumb|small|medium|large|orig}.jpg`.
  A listed size can fail to load for a while (`GSFC_20171208_Archive_e000775`: `thumb` and `medium` failed and `small`
  loaded on Nov 9, 2026; all three loaded an hour later), so the page tries the next size before showing "Picture
  unavailable".
  `asset/{nasa_id}` and older records give `http://` links; the page always uses `https://`.

### Blue Marble (the globe's surface), checked Nov 9, 2026

- `BlueMarble_NextGeneration` (also `BlueMarble_ShadedRelief` and `BlueMarble_ShadedRelief_Bathymetry`): NASA's
  cloud-free composite of the whole Earth. Not listed in the GetCapabilities documents, but the tiles load:
  `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/default/500m/{level}/{row}/{column}.jpeg`
  (`default` in place of a date; levels 0–7 of the `500m` set).
- The globe joins level 2 (15 tiles, 2,560 × 1,280 pixels, about 16 km a pixel) and then level 3 (50 tiles,
  5,120 × 2,560, about 8 km a pixel) where the graphics card accepts a picture that wide.

### EONET (Earth Observatory Natural Event Tracker), checked Nov 9, 2026

- `https://eonet.gsfc.nasa.gov/api/v3/events` (no key; **browsers may call it**). Categories (`/api/v3/categories`):
  drought, dust and haze, earthquakes, floods, landslides, manmade, sea and lake ice, severe storms, snow,
  temperature extremes, volcanoes, water colour, wildfires.
- Each event: `id`, `title`, `categories[]`, `sources[]` (the reporting agency's page), `closed`, and `geometry[]`
  (dated points, sometimes polygons, with `magnitudeValue` and `magnitudeUnit`, for example acres for fires).
- **Many events stay open long after their last report:** 7,236 open on Nov 9, 2026 (7,168 wildfires, 32 volcanoes,
  35 sea and lake ice, 1 storm), but only 35 with a report in the last 30 days. The globe asks for
  `status=open&days=30`.

### Sky: stars, galaxies, nebulae, clusters, constellations, checked Nov 9, 2026

- From the d3-celestial project (© 2015 Olaf Frohn, BSD 3-Clause licence, kept as
  `image-explorer/data/LICENSE-d3-celestial.txt`), npm package `d3-celestial`, folder `data/`.
- Positions are `[right ascension, declination]` in degrees, with right ascension from −180 to 180 (M42 the Orion
  Nebula: 83.85, −5.45; M57: −76.6, that is 283.4°); the repository's files store 0 to 360. Checked against known
  positions: Sirius 101.29, −16.72; M31 10.68, +41.27.
- Files used: `stars.6.json` (5,044 stars to magnitude 6, with colour index), `messier.json` (110 Messier objects with
  common names), `dsos.14.json` (15,809 deep-sky objects to magnitude 14, 10,336 of them galaxies),
  `dsonames.json` (724 common names), `constellations.json` and `constellations.lines.json` (88 constellations, plus
  Serpens drawn in two parts: 89 entries).
- **Chosen for the globe** (`image-explorer/tools/build_sky.py`): every Messier object, every object with a common
  name, and every galaxy of magnitude 12 or brighter (bright enough for a backyard telescope): 1,347 objects
  (1,001 galaxies, 165 nebulae, 181 star clusters) on Nov 9, 2026.
- Catalogue corrections made by the build: NGC 3372 named "Carina Nebula" (the catalogue says "η Car Nebula"),
  NGC 3132 "Southern Ring Nebula" (the catalogue gives the name "Eight-Burst Planetary Nebula" to NGC 3132 and
  "Southern Ring" to NGC 6563); objects split into several catalogue numbers (the Rosette Nebula, Stephan's Quintet)
  keep the name on the first part and the number on the others; dark nebulae lose their magnitude, which describes
  nothing visible.
- Four famous targets are not in the catalogue and are listed by hand (J2000, degrees): the Cartwheel Galaxy (9.421,
  −33.716), Westerlund 2 (155.992, −57.764), Cassiopeia A (350.85, +58.815) and the Rho Ophiuchi cloud complex
  (247.025, −24.542). **Checked Nov 9, 2026** against SIMBAD's values as published (Wikipedia's infoboxes, which cite
  SIMBAD, and NASA's Webb image page for the Cartwheel): the Cartwheel and Cassiopeia A were right; Westerlund 2 moved
  by 0.02°; Rho Ophiuchi had been placed on the star Rho Ophiuchi, 1.2° from the cloud complex named after it, and was
  corrected. SIMBAD itself did not answer requests from GitHub Actions within 3 minutes that night.

### Place names (GeoNames), checked Nov 9, 2026

- GeoNames (geonames.org, CC BY 4.0) through the npm package `all-the-cities` 3.1.0 (MIT), which holds the 135,233
  GeoNames places of 1,000 people or more with population and feature code.
- `image-explorer/data/places.json` (`tools/build_places.mjs`): every place of 10,000 people or more and every
  capital, 32,117 places (241 capitals), largest first, about 1.1 MB (about 0.5 MB as sent compressed). It loads the
  first time the place search or the map is used.
- Countries are found by their English names (the browser's `Intl.DisplayNames`) and shown around their capital.
- Mountains, lakes and rivers are not in this list.

### Astronaut photos of Earth (Gateway to Astronaut Photography of Earth), checked Nov 9, 2026

- `https://eol.jsc.nasa.gov`, Earth Science and Remote Sensing Unit, NASA Johnson Space Center: astronaut photos of
  Earth from 1961 to today. **Web pages cannot call it** (no CORS headers); `robots.txt` allows everything.
- **Photos Database API** (documented at `https://eol.jsc.nasa.gov/SearchPhotos/PhotosDatabaseAPI/`):
  `https://eol.jsc.nasa.gov/SearchPhotos/PhotosDatabaseAPI/PhotosDatabaseAPI.pl?query=…&return=…&key=…`, answering
  JSON (a list of records with `table.field` names). `query` is groups of `table|field|operator|value` (operators
  `gt ge lt le eq ne like`, joined with AND); `return` is groups of `table|field`. **A key is required**; keys are free
  and requested by email from jsc-earthweb@mail.nasa.gov.
- Tables: `frames` (cataloged photos: `mission`, `roll`, `frame`, `pdate` YYYYMMDD and `ptime` HHMMSS in UTC, `lat`
  and `lon` of the photo's centre to 0.1°, `nlat`/`nlon` of the point below the station, `cldp` cloud percentage,
  `tilt`, `geon` place name, `feat` features), `nadir` (photos not yet cataloged: only the point below the station),
  `images` (`directory`, `filename`, `width`, `height`, `filesize`; one record per image size).
- Images: `https://eol.jsc.nasa.gov/DatabaseImages/{directory}/{filename}`, for example
  `https://eol.jsc.nasa.gov/DatabaseImages/ESC/small/ISS073/ISS073-E-100000.JPG`; `ESC/small/…` and `ESC/large/…`.
  Photo pages: `https://eol.jsc.nasa.gov/SearchPhotos/photo.pl?mission=ISS073&roll=E&frame=100000`.
- **Credit** (the site's conditions of use): "Image courtesy of the Earth Science and Remote Sensing Unit, NASA
  Johnson Space Center", with the photo number (mission-roll-frame) and the site's address.
- In this repository: `image-explorer/fetch_astronaut_photos.py`, run daily by `.github/workflows/astronaut-photos.yml`
  with the key from the repository secret `EOL_API_KEY`, writes `image-explorer/data/astronaut.json` (the newest 400
  cataloged photos of the last 90 days, or the last year if fewer than 60, with 50% cloud or less). Without the
  secret the job changes nothing and the globe hides the astronaut photos.

### Image and Video Library: videos, checked Nov 9, 2026

- A video's files are under `https://images-assets.nasa.gov/video/{nasa_id}/` (images are under `image/`):
  `~orig.mp4`, and usually `~large.mp4` or `~medium.mp4`, `~small.mp4`, `~preview.mp4`, `~mobile.mp4`, plus stills
  (`~thumb.jpg`, `~small.jpg`, `~medium.jpg`, numbered frames `~thumb_1.jpg` …) and subtitles (`{nasa_id}.vtt`).
  `asset/{nasa_id}` lists them (with `http://` links that also work as `https://`).
- Sizes for three Apollo 11 films: `~mobile.mp4` 118–177 MB, `~small.mp4` 534–799 MB, `~orig.mp4` 1.5–5.3 GB. The
  page plays the smallest version listed and links the largest.
- The video files send no CORS headers: they play in a page, but subtitles (`.vtt`) cannot be attached from another
  site, so the page shows none.
- "apollo 11": 71 videos.

### Image and Video Library: what the results are, checked Nov 9, 2026

- NASA's own order puts launches, people and events first for most mission names: of the first results for "james
  webb", nearly all are testing, launch, people or illustrations. NASA's library holds only about 5 Webb science
  pictures (for example `carina_nebula`, `southern_ring_nebula`, `webb_first_deep_field`, `PIA26702`).
- Clues recorded with each result, used for the page's ranking: `nasa_id` starting `PIA` (Planetary Photojournal),
  `center` `STScI` or `STScI (Webb)` (Space Telescope Science Institute), `nasa_id` of mission frames (`AS11-…`
  Apollo, `iss0…e…` Space Station) point to pictures of space or of Earth from space; `nasa_id` starting `NHQ`, `KSC`
  or `jsc`, and photographers credited "NASA/…", point to event photography.
- NASA's APOD API answered 503 on Nov 9, 2026.

### ESA/Webb and ESA/Hubble picture archives, checked Nov 9, 2026

Decided Nov 9, 2026: ESA's data is added alongside NASA's. The Image Explorer adds ESA's two telescope picture
archives to the Picture library. Checked with requests from GitHub's servers and ESA's published terms.

- **Sites:** `https://esawebb.org/images/` (703 pictures) and `https://esahubble.org/images/` (5,511 pictures), the
  same archive software. No key and no JSON API.
- **Browsers may read them:** every archive page, picture page, feed and picture file answers with
  `access-control-allow-origin: *`.
- **Search:** `/images/?search={words}`, 50 results a page; further pages `/images/page/{n}/?search={words}`; newest
  first with `&sort=-release_date`. The page states the count ("Showing 1 to 50 of 166"); a search with no match has
  no count and no list. Examples: Webb "nebula" 166, "crab" 7, "hubble" 212; Hubble "andromeda" 116, "saturn" 131,
  "crab nebula" 47.
- **Results** are in the page's script as `var images = [ { id, title, width, height, src, url, potw }, … ]`:
  `src` is the 300 px-high thumbnail, `url` the picture's page, `potw` the date for a Picture of the Week or Month
  (empty otherwise). No date, credit or caption in the list.
- **A picture's page** (`/images/{id}/`) holds the title (`<h1>`), the caption, the credit line (`<div
  class="credit">`), and tables "About the Image" (Id, Type such as Observation, Release date, Size) and "About the
  Object" (name, type, constellation, category, distance), plus coordinates (RA, Dec, field of view). The markup
  differs slightly between the two sites (table classes, headings `h3` or `h4`).
- **Files:** `https://cdn.esawebb.org/archives/images/{size}/{id}.jpg` and `https://cdn.esahubble.org/…`, sizes
  `thumb300y`, `screen` (1280 px wide), `large`, `publicationjpg`, and others; originals are TIFF, up to 135 MB.
- **Licence:** Creative Commons Attribution 4.0 (CC BY 4.0) for pictures, videos and web texts. Each picture has
  its own credit line, to be shown in full, unchanged and beside the picture, with active links online. ESA/Webb and
  ESA/Hubble logos need written consent; the material must not suggest endorsement. Music, papers and code are not
  under CC BY 4.0.
- **Used since Nov 9, 2026** by the Image Explorer's Picture library and the globe's selected card (live search,
  thumbnails `thumb300y`, viewer `screen`, "Open large size" `large`). A page past the last answers 404 and is treated
  as empty.
- Example credit lines: weic2622c (Cat's Head Nebula) "NASA, ESA, CSA, STScI. Image Processing: J. Depasquale
  (STScI)"; heic1907a "NASA, ESA, and STScI".

### GIBS polar views, checked Nov 9, 2026

- `epsg3413` (Arctic, 303 layers) and `epsg3031` (Antarctic, 263 layers). Tile grid: 512 px tiles from
  (−4,194,304 m, 4,194,304 m), 8,192 m a pixel at level 0, halving each level; deepest level `250m` 5, `500m` 4,
  `1km` 3. Map projections: polar stereographic, EPSG:3413 `+lat_ts=70 +lon_0=-45`, EPSG:3031 `+lat_ts=-71 +lon_0=0`.
- Of the eight layers: true colour (`250m`), night lights (`1km`), snow (`500m`) and clouds (`1km`, newest day a day
  behind) exist in both; fires (`MODIS_Combined_Thermal_Anomalies_All`, vector tiles) only in the Arctic view; sea
  ice comes from `MODIS_Terra_Sea_Ice` (`1km`, daily, from 2000) because the MUR sea-ice layer is world view only;
  sea temperature and smoke and dust are world view only. Test tiles for each answered 200 with CORS allowed.
- Blue Marble (`BlueMarble_NextGeneration`, `BlueMarble_ShadedRelief_Bathymetry`) is listed in both polar layer lists,
  unlike the world list.
- Checked with live imagery Nov 9, 2026: on Nov 8 the true-colour picture has a black area over the North Pole (polar
  night; MODIS is a camera); on Aug 15 the Arctic is covered. `MODIS_Terra_Sea_Ice` is a classification layer whose
  only coloured class is sea ice (rgb 255, 100, 100; colour map `MODIS_L2_Sea_Ice.xml`). GIBS's microwave sea-ice
  layers, which work in the dark, end in Aug 2021 (`SSMIS_Sea_Ice_Concentration`) and Sep 2025
  (`AMSRU2_Sea_Ice_Concentration_12km`).
- OpenLayers note: `source.refresh()` did not fetch new tiles after the date changed; `setTileUrlFunction(fn, key)`
  with a new key does.

### Place-name services not used

### Natural features (Natural Earth), checked Nov 9, 2026

- Natural Earth 1:10m (naturalearthdata.com, **public domain**), GeoJSON files from the `nvkelso/natural-earth-vector`
  repository on GitHub: `ne_10m_lakes`, `ne_10m_rivers_lake_centerlines`, `ne_10m_geography_regions_points`,
  `ne_10m_geography_regions_elevation_points`, `ne_10m_geography_regions_polys`, `ne_10m_geography_marine_polys`.
- `image-explorer/data/features.json` (`tools/build_features.py`): 3,978 named features (1,063 rivers, 627 mountains
  with their heights, 453 lakes, 405 islands, 219 reservoirs, 214 mountain ranges, 158 island groups, 71 seas,
  61 gulfs, 60 bays, 58 deserts and others), each with a label point, an importance (Natural Earth's `scalerank`) and,
  for areas and rivers, a bounding box so the map can show all of it. About 250 KB.
- Natural Earth gives some lakes a short English name ("Superior", "Nyanza" for Lake Victoria); the build uses the
  full local name when it starts with "Lake" or contains the short name.
- Small features (Lake Louise in Alberta, the Bow River) are below Natural Earth's 1:10m scale and are not included.

### Place-name services not used

- **OpenStreetMap's Nominatim service** forbids search-as-you-type and allows at most 1 request a second (usage
  policy, checked Nov 9, 2026), so the place list is a file in the repository instead.

## Using NASA material

- NASA data and imagery are generally free to use and not under copyright in the United States, but NASA's insignia
  (the "meatball" logo) and logotype **may not be used** without permission. These projects use their own emblem.
- Pages say "Data courtesy of NASA" (and ESA where its data is used) and that the project isn't endorsed by NASA or
  ESA.

## ESA (the European Space Agency)

Decided Nov 9, 2026: ESA's data is added alongside NASA's where it helps. Each ESA source gets its own entry here (address,
key if any, limits, terms and the exact credit line), checked against ESA's current documentation before anything is
built on it. ESA sources in use: the ESA/Webb and ESA/Hubble picture archives (Image Explorer, entry above) and the
NEO Coordination Centre's risk lists and close approaches (Asteroid Tracker, entry below).

### Using ESA material, checked Nov 9, 2026

- **CC BY-SA 3.0 IGO:** where ESA expressly says so, its images, videos and other works are released under the Creative
  Commons Attribution-ShareAlike 3.0 IGO licence (esa.int › Services › CC BY-SA 3.0 IGO licence). They may be reproduced,
  shared and adapted without asking, provided the source is credited in ESA's form (for example "Credit: ESA/Rosetta/NavCam
  – CC BY-SA IGO 3.0", "ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO"), the licence text is linked, changes are marked, and
  adaptations are shared under the same licence. Nothing may suggest that ESA endorses them.
- **Other ESA material:** ESA's website terms allow educational, editorial and informational use with ESA's credit
  (for example "©ESA", "ESA/NASA - SOHO/LASCO"); material credited to someone else needs that holder's terms
  (esa.int › ESA Multimedia › Terms and conditions).
- **ESA's logo** is ESA's property, protected under the Paris Convention; any use needs ESA's prior written permission,
  so it is never used. These projects use their own emblem.
- **ESA/Webb and ESA/Hubble** (esawebb.org, esahubble.org) publish their own picture terms (CC BY 4.0 for most images,
  with their own credit lines); check each archive's terms before using it.

### ESA NEO Coordination Centre (NEOCC): risk lists and close approaches, checked Nov 9, 2026

Used by the Asteroid Tracker (Impact risk tab, the asteroid page, the week's details and the map's "On a risk list"
filter), next to NASA's figures, never in place of them. Checked against ESA's "Automated data access" page
(`https://neo.ssa.esa.int/computer-access`) and live answers from GitHub's servers.
- **Address:** `https://neo.ssa.esa.int/PSDB-portlet/download?file=<name>`; no key, no account, free.
  - `esa_risk_list`: every object with a non-zero impact chance (Nov 9, 2026: 2,209 objects).
  - `esa_special_risk_list`: objects monitored separately because their impact dates are beyond the usual window
    (Nov 9, 2026: 101955 Bennu and 29075 (1950 DA)).
  - `esa_recent_close_app` and `esa_upcoming_close_app`: close approaches to Earth within 0.05 au over the past 30 days
    and the coming year (Nov 9, 2026: 364 together).
- **Format:** plain text. A `Last Update: YYYY-MM-DD HH:MM UTC` line, two heading lines, a format line starting `AAAA`,
  then one row per object with `|` between columns. The risk list gives designation and name, diameter (m, `*` when
  estimated), the most likely impact (date and time, IP max, PS max, TS), speed (km/s), the years of possible impacts,
  IP cum and PS cum. The close-approach lists give the date only (no time), the miss distance in km, au and LD,
  diameter, H, brightest magnitude, speed and ESA's CAI index.
- **Designations** have no space: `2008JL3` is "2008 JL3"; survey designations such as `6344PL` are "6344 P-L"; a
  numbered object is given by its number.
- **Status:** ESA describes this access as experimental and liable to change without notice. The job checks each
  table's headings and, if they change, keeps the previous file and stops with an error instead of writing wrong
  figures; the NASA part still runs.
- **Update times:** the risk lists change after each orbit update (the Nov 9, 2026 list was stamped 18:48 UTC); the job
  reads them twice a day (06:17 and 14:47 UTC).
- **CORS:** no `Access-Control-Allow-Origin` header (recorded in `risk.json`, `cors`), so visitors' browsers never
  contact ESA; pages read `asteroid-tracker/data/risk.json` and `asteroid-tracker/data/esa_close.json`. No change to
  the Privacy page is needed.
- **Terms:** the NEOCC portal has no licence of its own and refers to ESA's general terms: educational and
  informational use is allowed with ESA's credit. No ESA logo is used, and pages say the project isn't endorsed by
  NASA or ESA.
- **Credit line, shown wherever the figures appear:** "ESA NEO Coordination Centre (©ESA)", with the list's date. If
  ESA asks for a different form, it is changed in `index.html`, `object.html`, `map.html`, `risk.js`, `object.js`,
  `app.js`, `CREDITS.md` and the Credits page. Contact for questions: the NEOCC (`neocc@esa.int`).
