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

- Same endpoint, written monthly (on the 1st, or with `--all`) to `data/famous.json` (about 490 KB) by
  `fetch_map_data.py`. For each pass: the asteroid, Earth (`399`) and the Moon (`301`), with `VEC_TABLE=2`
  (position and velocity), `CENTER='500@10'`, ecliptic, au and au/day.
- Small bodies are named with a trailing semicolon: `'99942;'` for a numbered asteroid, `'DES=2020 QG;'` for one
  known only by its code.
- Samples: every 10 minutes within 12 hours of closest approach, hourly within 3 days, daily within 40 days
  (339 per body). The page joins them with cubic Hermite interpolation (positions and velocities).
- Check: the distance from Earth's centre at closest approach matches the JPL close-approach figures to within
  16 km for all five passes; 2024 YR4's pass by the Moon gives 22,940 km against JPL's 22,938 km. Close-approach
  distances are measured from the centre of Earth (or the Moon), not the surface.

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

### Sky: stars and Messier objects, checked Nov 9, 2026

- From the d3-celestial project (Olaf Frohn, BSD licence) on GitHub, served through jsDelivr:
  `data/stars.6.json` (5,044 stars to magnitude 6, with colour index `bv`) and `data/messier.json` (all 110 Messier
  objects with designation, common name, type, magnitude and size in arcminutes).
- Positions are given as `[right ascension, declination]` in degrees, with right ascension from −180 to 180
  (M42 the Orion Nebula: 83.85, −5.45; M57: −76.6, that is 283.4°). Checked against known positions: Sirius
  101.29, −16.72; M31 10.68, +41.27.
- Types: `s`, `e`, `i` (spiral, elliptical, irregular galaxies, 40); `gc`, `oc`, `pos` (globular and open
  clusters, groups of stars, 58); `pn`, `rn`, `sfr`, `snr` (nebulae, 12).
- The built page keeps its own copy of these files in the repository rather than loading them from jsDelivr.
- Famous Hubble and Webb targets outside the Messier list (Carina Nebula, Southern Ring Nebula, Stephan's Quintet,
  the Magellanic Clouds and others) are listed by hand in the mock-up; their positions are to be confirmed against
  the SIMBAD astronomical database before the page is built.

### Astronaut photos of Earth (Gateway to Astronaut Photography of Earth), checked Nov 9, 2026

- `https://eol.jsc.nasa.gov`: photos taken from the space station and earlier missions, each with the position of
  the area shown. **Web pages cannot call it** (no CORS headers), so pins from it would come from a file refreshed
  by GitHub Actions, as the Asteroid Tracker's data is. How to query it is still to be worked out.

### Place names (for the place search)

- NASA's sources have no list of place names, so place search needs one of its own.
- **OpenStreetMap's Nominatim service is not suitable:** its usage policy forbids search-as-you-type and allows at
  most 1 request a second (checked Nov 9, 2026).
- **Planned source: GeoNames** (download.geonames.org/export/dump), licensed CC BY 4.0, so pages credit
  "GeoNames". `cities15000` (about 25,000 places of over 15,000 people, plus capitals) and countries, with mountains
  (class T), lakes and rivers (class H) and other features to be chosen when the file is built, saved as one small
  file in the repository, as the Asteroid Tracker does with its data.

## Using NASA material

- NASA data and imagery are generally free to use and not under copyright in the United States, but NASA's insignia
  (the "meatball" logo) and logotype **may not be used** without permission. These projects use their own emblem.
- Pages say "Data courtesy of NASA" and that the project isn't endorsed by NASA.
