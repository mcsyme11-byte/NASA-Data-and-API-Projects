# Change log

## November 12, 2026 — Mars Data: Two craters

- The approved "Two craters" chart is on the Mars Data page: air pressure at Gale Crater (Curiosity) and Jezero Crater
  (Perseverance) through the same seasons. The page's data credit names the MEDA team; the mock-up file is removed.

## November 12, 2026 — a shorter footer and a Legal page

- **Footer:** one row with About, Legal, Contact and Source code ↗ and the copyright line, then one short credit line
  ("Data courtesy of NASA and ESA. An independent project, not endorsed by NASA or ESA."), on every page.
- **Legal page** (`legal/`): Privacy, Terms of use, Credits and the MIT licence, one card each with a one-line summary.
  Their own addresses are unchanged; opened directly, they go back to Legal.
- **Data credits:** each page's detailed credits (sources, ESA's credit lines, the GIBS acknowledgement) moved out of
  the footer to small lines just above it, with the content they cover.

## November 12, 2026 — Mars Data: Perseverance (Jezero Crater) and a two-craters mock-up

- Perseverance's weather data (MEDA, NASA PDS), sols 0–1859 (February 2021 to May 2026), cleaned with the MEDA rules
  (`mars-data/analysis/CLEANING-MEDA.md`, `run_meda.py`); a cleaning report for every chunk
  (`mars-data/data/meda/reports/`). Page file `mars-data/data/meda.json`.
- Mock-up for approval: a "Two craters" chart comparing air pressure at Gale and Jezero (`mars-data/mockup.html`).
- MEDA added to `CREDITS.md`, the Credits page and `docs/DATA-SOURCES.md`. Mars Express (ESA) waits for ESA's archive,
  down for maintenance.

## November 12, 2026 — Mars Data: the whole Curiosity record

- Curiosity REMS sols 4258–4843 (Mars Years 37–38) added; the page now covers the whole released record: sols
  1–4843 (August 7, 2012 to March 22, 2026), 4,703 sols with data, Mars Years 31–38. Every cleaning report checked.
- The recurring evening air-temperature glitch was found on 26 sols in all; their air temperature is set aside for
  review (`mars-data/analysis/exclusions.csv`).
- The charts use eight colours, one for each Mars Year (two added to the theme's six for this page).

## November 12, 2026 — Mars Data: sols 3645–4257 added; evening glitch set aside

- Curiosity REMS sols 3645–4257 (Mars Year 37); every cleaning report checked. The page now covers sols 1–4257.
- A recurring air-temperature glitch (one hour at about 19:00–20:00 local reading about −120 °C) was found on 12 sols
  across the record; their air temperature is set aside for review (`mars-data/analysis/exclusions.csv`).

## November 12, 2026 — Mars Data: sols 3069–3644 added; corrected UV complete

- Curiosity REMS sols 3069–3644 (Mars Year 36) and the last corrected UV files (to sol 3423, the end of NASA's corrected
  UV set); every cleaning report checked, nothing flagged. The page now covers sols 1–3644.

## November 12, 2026 — Mars Data: sols 2483–3068 added

- Curiosity REMS sols 2483–3068 (Mars Years 35–36) and corrected UV for sols 2501–3100; every cleaning report
  checked, nothing flagged by the automatic review.
- New cleaning rule 10: a value that passes every rule but is plainly not weather is listed in
  `mars-data/analysis/exclusions.csv` and left out of the page until reviewed. First entry: sol 2844 air temperature
  (one hour at −119.6 °C between hours of −38 and −49 °C). The page now covers sols 1–3068.

## November 12, 2026 — Mars Data: sols 1870–2482 added

- Curiosity REMS sols 1870–2482 (Mars Years 34–35) and corrected UV for sols 1901–2500; every cleaning report checked,
  nothing flagged. Gaps with no data released: sols 2172–2199 and 2321–2346. The 2018 global dust storm (around sols
  2085–2120) shows as very low midday UV and daily pressure swings of up to 140 Pa. The page now covers sols 1–2482.

## November 12, 2026 — Mars Data: sols 1294–1869 added

- Curiosity REMS sols 1294–1869 (Mars Years 33–34) and corrected UV for sols 1301–1900, cleaned with rules 1.1;
  every cleaning report checked (no problems, nothing flagged for review; UV row counts match NASA's labels). The page
  now covers sols 1–1869.

## November 12, 2026 — Sky Finder, "Visible from here" and the spacecraft map

- **Layout fixes (same day):** the spacecraft map's agency and kind filters were squeezed to a sliver on desktop and
  are now full height; the craft card keeps its title and close button in view while it scrolls; a "group" of one
  craft is drawn as the craft itself; Sky Finder's place panel has a close button (and Escape); the Asteroid Tracker's
  tabs wrap to a second line on desktop instead of running off the edge, and the map and asteroid pages list the
  "Visible from here" tab too. The map page no longer has a "Back" button above its title: the tracker's tabs are
  right below it.
- **Asteroid Tracker, "Visible from here" tab** (`#visible`): choose a place ("Use my location" or a town from the
  GeoNames list); the close passes of the next 30 days that rise at least 10° above that horizon in full darkness
  (the Sun 12° down), each with its best moment, highest point, brightness and what is needed to see it (naked eye up
  to magnitude 6, binoculars 6–9, small telescope 9–12, large telescope 12–15, too faint above 15); a night chart of
  its height hour by hour; "Find it ›" opens Sky Finder. Data: `data/sky.json`, written daily by `fetch_sky.py`
  (NASA/JPL close approaches and Horizons). The place stays in the browser.
- **Sky Finder** (`sky-finder/`): an installable phone web app. Tonight's list (asteroid passes, the Moon, the
  planets and the ISS and Tiangong passes you can see); a camera view with a marker and the hour-by-hour path of the
  chosen asteroid, the Moon, planets, bright stars, the stations, the horizon and the compass points, an arrow to
  anything off the screen and a line telling which way to turn; calibration on the Moon, a planet or a bright star;
  drag-to-look where there are no motion sensors; red light; a safety notice on first use; works offline once
  visited; a how-to page. Linked from the tracker's new tab and the Image Explorer's globe notes. Sky maths in
  `shared/sky.js`, checked against Astropy.
- **Spacecraft map** (`spacecraft/`): 82 active spacecraft and stations of NASA, ESA, JAXA, ISRO, CNSA and others,
  from low Earth orbit to the Voyagers, on the asteroid map's controls, with five views (Solar system, Near Earth,
  Earth orbit, Moon, Mars), search, agency and kind filters, a card for each craft (figures, launch, description,
  timeline, links to the agencies' pages), Follow, its path, Share and time controls. Small drawings show what each
  kind of craft looks like. Data: NASA/JPL Horizons and CelesTrak, copied twice a day by the new "Spacecraft data"
  workflow; satellites worked out in the browser with satellite.js (MIT).
- **Home page:** the large panel now previews the spacecraft map (the asteroid map's preview takes its place if the
  spacecraft data cannot be loaded); the asteroid map is a link under it; a Sky Finder banner.
- **Privacy, Terms and Credits** updated first: the place, Sky Finder's settings and offline copy; camera, location
  and motion use; safety at night and never looking at the Sun; CelesTrak and satellite.js credits.
## November 12, 2026 — Mars Data page live

- **Mars Data page** (`mars-data/index.html`), built from the approved mock-up: pressure through the Martian year
  (with a correction for the rover's climb), the daily pressure swing, humidity at night (preliminary), midday
  ultraviolet, temperature by season and hour, any sol hour by hour, daily highs and lows, and the rover's climb.
  Loading and error states; charts drawn at the width they are shown.
- **Data:** Curiosity REMS sols 1–1293 (Mars Years 31–33), cleaned with rules 1.1, with the cleaning reports
  (`mars-data/data/rems/reports/`); page files built by `mars-data/analysis/make_page_data.py`.
- The mock-up files are removed; the home page lists Mars Data as live.

## November 12, 2026 — site-wide polish

A full check of every page at phone, tablet and computer sizes, and these fixes:

- **Feel:** quick hover and press feedback on every button, chip, tab and link; a brass glow on focused fields; a
  solid header with a soft shadow; dark date pickers and dropdowns.
- **Phones:** tab bars and chip rows that don't fit scroll sideways with a soft edge fade, and the selected tab
  scrolls into view (Asteroid Tracker tabs and search chips, the Globe's and Picture library's chip rows); tap
  targets raised to 40 px (the site name, "Its page ›", "Clear", sliders, the "Asteroid Tracker" link above titles);
  search placeholders shortened to fit.
- **Number tiles** shrink their figures slightly on narrow tiles, so values such as "0.75–1.10 au" and "11 Nov 2026"
  are never cut off at the tile's edge.
- **"How to read this"** is easier to read (12 px).
- **Asteroid Tracker:** one tab bar on every page (the map and asteroid pages gained Impact risk); the map page always
  has its Back button; space between the Impact risk intro and its tiles; labels on the Solar System Map and the
  orbit diagram outlined so they read clearly over dots and orbits; the orbit diagram's date no longer covers its
  labels on phones (a map-only rule had applied to it); "Asteroid not found" as the title for an unknown number;
  the asteroid page's tags and links in one consistent style.
- **Image Explorer:** fewer place names on a phone-sized Earth map, so they don't crowd; the Picture library's
  source filter is now "Library" (it shared "From" with the year), and its labels match the other rows; its Clear
  button appears once something is typed.
- The rules behind these are in `docs/DESIGN.md` (8a. Feel) and CLAUDE.md, so new pages follow them.

## November 12, 2026 — Asteroid Tracker: no key needed for visitors

- The daily data job copies NASA's NeoWs data for the current week, the two weeks before and after it, and every
  asteroid in them (`fetch_neows.py`, `data/neows/`), using the developer's key from the repository secret
  `NASA_API_KEY`. The "This week" list and the asteroid pages read that copy first, so visitors need no key and use
  none of their own allowance; other weeks and asteroids are still asked of NASA directly.
- The Key settings box was removed: with the daily copy no visitor needs a key. A key saved by the earlier version
  is deleted from the browser on the next visit; the Privacy and Terms pages say so.
- The secret `NASA_API_KEY` was added the same day; the first run copied 5 weeks and 199 asteroid pages, and the
  live site was confirmed to open the week and asteroid pages from the copy without asking NASA.

## November 11, 2026 — Image Explorer: map tap card, map lines and names, gaps filled, more on the globe

- **Tapping the Earth map** says where the spot is: the country (from Natural Earth outlines), a natural feature on or
  near it (for example "Hamada de Tinrhert · desert · Algeria"), and the distance and direction from the nearest town
  ("347 km south of Hassi Messaoud"); at sea, the sea or ocean. "Open water or remote land" is gone. Rivers' points
  (their mouths) are left out of "near".
- **Gaps between satellite passes** show a cloud-free Blue Marble picture instead of black (not under night lights).
- **Map lines and names:** coastlines, land borders, rivers, a latitude and longitude grid, and names of countries,
  capitals and cities (more as the map zooms in; bigger places win where names crowd), each with a button; in all three
  views. Built from Natural Earth 1:50m by `tools/build_shapes.py`.
- **Globe:** earthquakes of magnitude 4.5 or more in the past week (USGS, live; circles sized by magnitude), 276
  volcanoes, 24 launch sites and 711 natural wonders (national parks, waterfalls, glaciers, gorges, caves, reefs; off at
  first), each with its own button, card, "See it on the Earth map", pictures, and in Find
  (`data/globe-spots.json`, `tools/build_globe_spots.py`).
- **Astronaut photos without the key:** the daily job reads NASA's public Latest ISS Imagery set when there is no
  `EOL_API_KEY`; photos not yet cataloged are pinned below the Station and say so.
- Privacy and Credits list the US Geological Survey; Credits list the new Natural Earth and GeoNames uses.

## November 12, 2026 — Project Record builds again

- **Fixed:** the Project Record's automatic rebuild stopped on its personal-details check from Nov 11, 2026 (commit
  01c5a37 onward), because the Mars Data notes quote ESA's licensing contact address. Every push since then failed
  the rebuild and sent the developer an e-mail; no commit was refused, and only the PDF stayed at its earlier edition.
  The check now allows any address at nasa.gov or esa.int (official agency contacts); any other address still stops
  the build.
- `mars-data/analysis/CLEANING.md` has its place in the record's Mars Data Part.

## November 12, 2026 — Mars Data: sources checked, cleaning rules and a mock-up

- **Sources checked** from GitHub's servers and recorded in `docs/DATA-SOURCES.md`: Curiosity REMS (NASA PDS
  Atmospheres Node, sols 1–4843), Perseverance MEDA (NASA PDS), Mars Express MaRS profiles (ESA Planetary Science
  Archive, CC BY-NC 3.0 IGO), with their citations and ESA's credit line.
- **Cleaning rules 1.1** (`mars-data/analysis/CLEANING.md`): NASA's quality flags read character by character,
  physical limits, coverage of each sol, daily statistics, humidity (labelled preliminary), corrected UV. Code in
  `mars-data/analysis/`; Ls and Mars Year calculated from the date (`mars_time.py`), checked against NASA's values.
- **Mock-up** of the charts page for approval: `mars-data/mockup.html`, drawn from the cleaned data for sols 1–1293,
  including humidity (preliminary) and corrected UV. A midday UV peak counts only between 10:30 and 13:30 local time on
  a sol with at least 30 minutes of UV. Approved by the developer on November 11, 2026.

## November 11, 2026 — Project Record

- **Project Record:** `docs/NASA and ESA Data Projects - Project Record.pdf`, the whole project as one PDF (cover,
  Document control, contents, 14 Parts, glossary), built from the repository by `docs/record/`, adapted from the
  Flight Deck Suite's and Hot Mic's records.
- **Rebuilt automatically** by `.github/workflows/project-record.yml` after every push to main, except pushes that
  change only data files (the daily data updates); the Repository History counts those instead of listing them.
- The build stops if a personal detail would end up in the record; the agencies' public contact addresses quoted in
  the data-source notes are allowed.
- **Wording check:** data files are checked for keys only, since they hold real place and object names.

## November 10, 2026 — Image Explorer: ESA's videos; smaller places in place search

- **ESA's videos:** with "Pictures and videos" or "Videos", searches also ask ESA/Webb and ESA/Hubble's video
  archives. An ESA video plays the small file from ESA's servers and links the full HD file; the viewer shows its
  credit line (with line breaks, including the music credit), length and release date, and notes that the music has
  its own terms. The page waits at most 12 s for each ESA archive; a slower one is left out of that search, and the
  results line says it did not answer in time.
- **Smaller places in place search:** about 85,000 lakes, rivers, glaciers, peaks, passes, islands, parks and other
  natural features from GeoNames that have an English Wikipedia article (for example Lake Louise, Moraine Lake, the Bow
  River, Mount Rundle, the Athabasca Glacier), with their English names. The list loads after the main place list;
  a name typed in full is shown first, then the most widely named places (Antarctica's many small named features
  last). It is built by the manual job "Build smaller places"
  (`.github/workflows/build-places.yml`, `tools/build_geonames_features.py`).
- The map's place card offers "Pictures of …" (NASA's and ESA's libraries) instead of "NASA pictures of …".

## November 10, 2026 — Asteroid Tracker: risk colour on the map, ESA and NASA compared, share links

- **Orbit diagram:** the tilt turns all the way round with a mouse, as on the map; "seen from below" labels the view
  from underneath.
- **Map:** asteroids on ESA's or NASA's impact-risk list are drawn in rose (2 × 2 pixels) and, zoomed in closer than
  about 0.35 au, ringed with a small diamond; "Show in their orbit colours" under Orbit types turns this off (kept on
  Back and reload).
- **Asteroid page:** "ESA and NASA compared", a chart of both centres' chances (the most likely impact and all
  possible impacts together, on a log scale) and the years in which each finds an impact possible, with the most
  likely year marked. ESA's special risk list gives no years or total chance; the chart says "not given" there.
- **Share links:** "Share this view" on the map (zoom, angle, centre, selection, date, filters, or the famous pass in
  progress) and "Share this week" on the tracker (the week, filters and open row). On a phone the share sheet opens;
  elsewhere the link is copied, or shown ready to copy. The link's settings are removed from the address once applied.

## November 11, 2026 — Projects numbered in build order; Mars Data uses the whole Curiosity record

- Image Explorer is now Project 2 and Mars Data Project 3, on the home page (in that order), the project pages and
  the READMEs.
- Mars Data plan: the whole Curiosity record is used from the start, downloaded and cleaned in chunks, with a
  cleaning report for each chunk.

## November 11, 2026 — Mars Data: plan for automatic updates

- The plan for Mars Data is set in `docs/ROADMAP.md` and `docs/PROJECT-NOTES.md`: three missions (Curiosity REMS,
  Perseverance MEDA, Mars Express MaRS), a GitHub Actions job twice a week that picks up new archive releases with
  checks before anything is saved, and an email notice through a GitHub issue when new data arrives or a run fails.
  Planning only; nothing is built yet.

## November 10, 2026 — Image Explorer: sharper globe close up; day and night

- Zooming in on the globe lays finer Blue Marble pictures over the part of the Earth in view, about 4, 2, 1 and
  0.5 km a pixel as the view comes closer (about 8 km before); each level starts where the one before would show
  fewer picture pixels than screen pixels.
- **Day and night:** the half of the Earth facing away from the Sun is shaded, with a soft edge for twilight, from the
  Sun's position at the current time; the Earth keeps turning with the time while the page is open. A "Day and night"
  button turns the shading off.

## November 10, 2026 — Image Explorer: colour keys in the project's look

- The Earth map's colour keys are drawn on the page from GIBS's colour maps: the colour bar, up to seven labelled
  values, the two ends, and the measurement and its units (cloud-top temperature in °C instead of kelvin); a layer's
  categories (for example snow's) as small swatches. GIBS's own legend picture stands in while a colour map loads or
  if it cannot be read.

## November 10, 2026 — Image Explorer: each Earth map layer's days read from GIBS

- Each layer's days are read from GIBS (its time domain) instead of a fixed lag: a layer shows the chosen day, or its
  nearest earlier day when it has none (MUR sea temperature and sea ice miss a few days), and the note under the map
  says which ("newest day …" or "no picture that day; nearest earlier day …"). The fixed lag stays only as a fallback
  while the days load or if GIBS cannot be reached.
- The old test branches `image-explorer-probe` and `map-data-test` were deleted.

## November 10, 2026 — Image Explorer: code libraries served from the site

- OpenLayers 10.11.0, proj4js 2.22.0 and three.js 0.187.0 are kept in `image-explorer/vendor/` (unchanged, each with
  its licence) and loaded from the site instead of the jsDelivr CDN, so the page no longer depends on jsDelivr.
  jsDelivr is removed from the Privacy page; the wording check skips the vendor folder.
- The developer's testing of the Image Explorer (Nov 10, 2026) passed, including ESA's pictures on the live site.

## November 10, 2026 — main branch protected

- A branch ruleset, "Protect main", blocks force pushes to `main` and its deletion. Ordinary pushes (the chats and the
  daily data jobs) work as before. Mistakes are undone with a new commit (`git revert`).

## November 10, 2026 — Asteroid Tracker: the map tilts all the way round

- The map's tilt is no longer stopped at "straight down" (0°) and "edge-on" (90°): dragging up or down, or the ↑ ↓
  keys, carry on past edge-on to underneath and round again. The Top, Tilted and Side buttons turn the short way back.

## November 9, 2026 — Image Explorer: searching message names the libraries

- While a search runs, the Picture library says which libraries it is asking, following From: "Searching NASA's and
  ESA's libraries…", "Searching NASA's library…" or "Searching ESA's archives…" (it said NASA's library in every case).

## November 9, 2026 — README brought up to date

- The README links the live site, gives the projects' status in the order of work, names NASA and ESA sources in
  the documentation table, and lists the GitHub workflows (checks and daily data updates).

## November 9, 2026 — ESA check across the site

- Every ESA source now on the site was checked against the project rules: ESA's NEO Coordination Centre (risk list,
  special risk list, close approaches; Asteroid Tracker) and the ESA/Webb and ESA/Hubble picture archives (Image
  Explorer) are in CREDITS.md, on the Credits page and in DATA-SOURCES, and their credit lines appear in the footers of
  the pages that show them. NASA/JPL's Sentry impact monitoring, added at the same time, is listed too.
- **Privacy:** the ESA/Hubble privacy policy is linked; the list of sites the pages link to includes ESA's NEO
  Coordination Centre (the Asteroid Tracker links to it but the browser never contacts it; its data is fetched by the
  daily data job on GitHub).
- **Terms:** ESA/Webb and ESA/Hubble pictures are released under CC BY 4.0, each with its own credit line.
- **About, the home page, the README and CLAUDE.md** describe the ESA data in the Asteroid Tracker and Image Explorer;
  the README shows the Image Explorer as live.

## November 9, 2026 — Image Explorer: ESA's Webb and Hubble pictures in the Picture library

- **Each search also asks ESA/Webb and ESA/Hubble's picture archives** and mixes their pictures with NASA's, sorted
  by the same score and taking turns between libraries. A tag on each picture says whose it is (NASA, ESA/Webb or
  ESA/Hubble); **From** picks NASA and ESA, NASA, or ESA; the results line counts each library.
- **Viewer for ESA pictures:** the credit line in full (with its links), the licence (CC BY 4.0), the caption, the
  release date, type, constellation and category, read from ESA's page for the picture; a link to that page.
- **Mission buttons:** James Webb and Hubble also list ESA's archive for that telescope.
- **Globe:** the selected object's pictures come from NASA's and ESA's libraries in turn, with a count for each.
- If one library is out of reach the others still show, and the results line says which is out of reach.
- Credits page, CREDITS.md and the Privacy page list ESA/Webb and ESA/Hubble; the footer reads "Data courtesy of NASA
  and ESA". The mock-up page was removed.

## November 9, 2026 — Asteroid Tracker: ESA's impact-risk list and close approaches

- **Impact risk tab:** every object on ESA's risk list (NEO Coordination Centre, with its special risk list) or
  NASA/JPL's Sentry list, side by side: each centre's chance, Palermo and Torino values and most likely impact date,
  with filters (which list, size, name), sorting, row details linking to both centres' pages, and the rules for
  reading the chance, Torino, Palermo and why the two lists differ.
- **Asteroid page:** an "Impact risk" section with ESA's and NASA's figures, or "Not listed"; the selected approach
  shows ESA's distance when ESA lists the same pass.
- **Week details:** ESA's miss distance and the impact chance, when ESA has them.
- **Map:** an "On a risk list" filter, and arrow buttons for panning that appear with ✥ (tap to move, hold to glide).
- **Data job:** `fetch_risk.py` writes `data/risk.json` and `data/esa_close.json` twice a day; a change in ESA's
  format keeps the previous file instead of writing wrong figures.
- ESA's credit ("ESA NEO Coordination Centre (©ESA)") on every page that shows its figures; ESA NEOCC and NASA/JPL
  Sentry in `CREDITS.md`, on the Credits page and in `docs/DATA-SOURCES.md`.

## November 9, 2026 — Image Explorer: ESA picture archives checked; mock-up

- ESA/Webb and ESA/Hubble picture archives checked (search, paging, fields, credit lines, licence, browser access);
  findings in `docs/DATA-SOURCES.md`.
- Mock-up of the Picture library with ESA's pictures beside NASA's: `image-explorer/mockup-esa.html`.

## November 9, 2026 — ESA alongside NASA

- **Decided:** ESA (the European Space Agency) data is added alongside NASA's where it helps; NASA stays the main
  source. Each project's chat adds ESA to its own project.
- **Rules for ESA sources** in CLAUDE.md: checked against ESA's current documentation first, recorded in
  DATA-SOURCES, ESA's credit wherever its data appears, listed in CREDITS.md and on the Credits page, no ESA logo, free
  to run, and any ESA service the browser contacts added to the Privacy page first.
- **Every page** says the project isn't endorsed by NASA or ESA; the site's own pages credit "NASA and ESA (the
  European Space Agency)"; the home page and About describe data from NASA and ESA.
- **Credits** (page and CREDITS.md), **Terms**, **LICENSE.md**, **DATA-SOURCES** and **DESIGN** cover ESA: its
  CC BY-SA 3.0 IGO licence and credit form, its terms for other material, and that its logo is not used.
- The Claude project's new name, description and instructions are in `docs/CLAUDE-PROJECT-SETUP.md`.

## November 9, 2026 — renamed NASA and ESA Data Projects

- **New name** on every page, document and code comment: NASA and ESA Data Projects.
- **New repository address:** github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects; the site is now at
  https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/. Every full link (the footer's licence and source
  links, About, Terms, Credits, the README, the docs, the data jobs' contact line) points to the new address.
- Saved browser data (the API key, places in pages) keeps its old storage names, so nothing saved is lost.

## November 9, 2026 — Asteroid Tracker: panning on the map; Back goes one page

- **Map panning:** drag with the right or middle mouse button, or hold Shift while dragging; on a touch screen, drag
  with two fingers; or press the new ✥ button beside the zoom buttons, after which a plain drag pans. "Re-centre"
  appears once the map is panned. Choosing Sun, Earth or Selected, an "Out to" view or a famous pass also re-centres.
  Alt and the arrow keys pan from the keyboard. The pan is kept when returning to the map.
- The mouse wheel, a double click and a pinch now zoom towards the pointer rather than the middle of the map.
- **Fix:** the "‹ Back" buttons on an asteroid's page and on the map went back two pages, because the site-wide Back
  code in `shared/footer.js` and the tracker's own code both handled the click. The tracker now leaves naming and
  clicking to the footer, and only shows the map's button when the map was opened from another page.

## November 9, 2026 — Asteroid Tracker: clearer close approach in the orbit diagram; slower playing

- **Orbit diagram (each asteroid's page):** the selected close approach is marked by two rings joined by a line,
  where Earth (blue) and the asteroid (brass) are at the moment they are closest, labelled "Closest to Earth" with the
  date and NASA's distance. Before the approach the side panel counts down ("Closest approach in 40 days"). Play stops
  exactly at the approach and the rings turn solid; pressing Play again carries on. The "Near Earth" view marks the
  same point on the asteroid's path past Earth.
- **Speeds:** Slow 1 day a second, Normal 5 days a second (was 60), Fast 20, Fastest 90; each named in the menu.
- **Map:** pressing a highlighted famous-pass button again ends the tour and returns to today.
- In the "Near Earth" view, the "towards the Sun" label no longer overlaps the time marks.

## November 9, 2026 — shared files always load fresh

- **Fixed:** browsers that had saved an older `shared/theme.css` kept showing the old layout (narrow text, an unstyled
  Back button) after an update. Every page now links `theme.css` and `footer.js` with a version tag
  (`?v=2026110902`), raised whenever either file changes, so the new copy is fetched at once.

## November 9, 2026 — site pages: full width and Back buttons

- **Full width:** About, Privacy, Terms and Credits now use the page's full content width, like the other pages.
- **Back buttons:** About, Privacy, Terms, Credits, Contact and the Mars Data page have a "‹ Back" button above the
  heading. It is named for the page it returns to ("‹ Back to the Asteroid Tracker") and returns there the way the
  browser's Back does; opened directly, it reads "‹ Home".

## November 9, 2026 — Asteroid Tracker: closest pass on the home page, size comparisons, three more famous passes

- **Home page:** a line under the live map shows the closest asteroid pass of the next 7 days, in the visitor's time
  zone, with its distance, size comparison and a link to its page (new daily file `data/soon.json`).
- **Size comparisons** on each asteroid's page, in the tracker's row details and on the map's cards: "about the
  length of a school bus (12 m)", "about 2 times the length of a Canadian football field (137 m)". One rule set
  (`compare.js`) replaces the earlier phrase.
- **Famous close passes:** three more, Toutatis (2004), 2012 TC4 (2017) and 2023 BU (2023), now eight in date order.
  Times, distances and speeds now come from NASA/JPL close-approach data stored with each pass, so they follow NASA's
  latest figures (2020 QG: 9,317 km; Duende: 34,053 km; 2019 OK: 71,355 km). The pass path is smoothed between
  samples; the Moon's-orbit label shows only when the ring is large enough to label clearly.
- **Data job:** a backup daily run at 14:47 UTC, and a push that rebases onto other work and retries.

## November 9, 2026 — site pages: About, Privacy, Terms, Credits, Contact

- **Five new pages:** About (what the site is, the projects, how it works, who made it), Privacy (nothing collected;
  what stays in the browser; the services the browser contacts), Terms of use (free and educational, as is, not for
  safety decisions, NASA, the API key, no warranty), Credits (every data source and library with its terms, the GIBS
  acknowledgement, the MIT License) and Contact (the address, Write an email, Copy address, and three ready-made
  subjects: bug report, the data, ideas).
- **Site links in every footer** (`shared/footer.js`): About · Privacy · Terms · Credits · Contact · Licence (MIT) ·
  Source code, on every page of the site.
- Checked at 1280 and 390 pixels wide; no page errors.

## November 9, 2026 — Image Explorer: picture library search and viewer

- **Viewer:** Close sits in its own bar above the picture and stays in view while the text scrolls; the white
  scrollbar is gone (dark scrollbars throughout); videos and pictures are labelled.
- **Space pictures first:** each result is scored from what NASA records with it (Photojournal and Space Telescope
  Science Institute pictures, Apollo and Space Station frames and words such as nebula or crater count up; launches,
  people, events and artists' illustrations count down). Launches, people, events and illustrations move under
  "Behind the scenes", closed by default.
- **Mission buttons** search several phrasings at once and merge them (for example James Webb: nebulae, galaxies,
  NIRCam images and "james webb").
- **Results as you type** from 3 letters (after a pause of 0.35 s); a search already made is not asked again.
- **Spelling:** suggestions as you type allow for small mistakes, from about 150 missions, 1,350 sky objects,
  countries, natural features and towns. A search with fewer than 3 results is repeated with the nearest known
  spelling ("hubbel" shows Hubble, with a link to search the words as typed).
- **"See it in the sky":** a picture whose title or keywords name a galaxy, nebula or star cluster on the globe opens
  that object on the globe.
- Escape closes the suggestions without clearing the words.

## November 9, 2026 — MIT License and credits

- **Licence:** the project's own code and documents are now under the MIT License (`LICENSE.md`), replacing "all
  rights reserved".
- **Credits:** `CREDITS.md` lists every outside data source and library with its terms (NASA and JPL sources, GIBS
  with its acknowledgement, d3-celestial, GeoNames, Natural Earth, OpenLayers, proj4js, three.js).

## November 9, 2026 — Image Explorer: date changes reload the pictures

- **Fixed:** changing the date (date box, slider, day buttons, Play) did not reload the satellite pictures already on
  the map, so an earlier day could show the newest day's picture. Every layer now reloads for the new date. Found
  while checking the polar views with live imagery.
- Polar views checked with live NASA imagery: the Arctic (Nov 8: polar night over the pole; Aug 15: the whole Arctic
  in daylight with summer fires) and the Antarctic (Nov 8: the continent in spring sunlight, snow layer).
- The polar sea ice layer's colour key is a single swatch ("Sea ice seen that day, daylight only") in place of
  GIBS's large classification legend; the page explains the polar night.

## November 9, 2026 — Asteroid Tracker: data check

- Checked the "Asteroid data" job: the 06:17 UTC scheduled run did not start, so the job was started by hand at
  12:01 UTC. It succeeded: close approaches for 2026 updated (2027 unchanged), the list of near-Earth objects and the
  spacecraft positions rewritten, and the site republished. Parker Solar Probe now has 13,493 positions (every
  6 hours), and its path curves smoothly around the Sun on the map.

## November 9, 2026 — Image Explorer: polar views, natural features, videos, astronaut photos

- **Arctic and Antarctic views** on the Earth map, looking straight down on the poles (GIBS's polar maps, with
  proj4js). Layers a view lacks are greyed out ("World view only"): sea temperature and smoke and dust in both, fires
  around Antarctica; sea ice there comes from the daily MODIS sea-ice layer. Choosing a place far from the pole goes
  back to the world view.
- **Natural features in place search:** 3,978 mountains (with heights), ranges, lakes, rivers, deserts, islands,
  seas, gulfs and bays from Natural Earth (public domain); choosing a lake, range, river or sea shows all of it.
- **Playable videos** in the picture library: Pictures / Pictures and videos / Videos; a play mark on video cards; the
  viewer plays the smallest version NASA offers and links the full-size file.
- **Astronaut photos on the globe** (blue squares): a daily job (`astronaut-photos.yml`, `fetch_astronaut_photos.py`)
  fetches the newest cataloged photos of Earth with their positions from NASA's Gateway to Astronaut Photography of
  Earth; each opens with the photo, its date, what it shows, a link to NASA's page and NASA's credit line. Switched
  off until the free API key is stored as the secret `EOL_API_KEY`.
- **Sky positions checked:** Westerlund 2 moved 0.02°; the Rho Ophiuchi marker moved 1.2°, from the star onto the
  cloud complex named after it.

## November 9, 2026 — Image Explorer version 1

- **Live** at `image-explorer/`, from the approved mock-up; the mock-up files are removed. The home page lists the
  project as live.
- **Globe:** about 1,350 galaxies, nebulae and star clusters (every Messier object, every object with a common name
  and every galaxy to magnitude 12), the 88 constellations drawn as faint lines with their names, 5,044 stars, all
  from files kept in the repository (`image-explorer/data/`, built by `tools/build_sky.py`; d3-celestial, BSD
  licence). Fainter objects are drawn smaller; famous ones are named.
- **Place search:** 32,117 towns of 10,000 people or more and every capital (GeoNames), and countries by name, with
  suggestions after every letter; tapping the map names the nearest town within about 100 km.
- **Picture library:** live from the start, with an empty search box and a prompt.
- Checked at 320–1440 px: no sideways scrolling, no script errors, and the "out of reach" messages when NASA cannot
  be reached.

## November 9, 2026 — Asteroid Tracker: smooth spacecraft paths

- Spacecraft paths on the map are drawn through every sample as smooth curves (centripetal Catmull-Rom) instead of
  a thinned set of straight lines, which looked jagged near the Sun; each spacecraft's dot moves along the same
  curve.
- Parker Solar Probe and Juno, which repeat the same loop many times, show their last year of flight; selecting one
  shows its whole path, drawn brighter.
- Parker Solar Probe is sampled every 6 hours instead of daily (`data/spacecraft.json`), so its turn around the Sun
  is captured: near the Sun it covers about 16 million km a day while passing about 7 million km from it.

## November 9, 2026 — Image Explorer: the Globe tab (mock-up)

- **Globe tab** in the mock-up: NASA's Blue Marble Earth, turned to the current sidereal time, inside the real sky
  (5,044 stars). Pins on the Earth for the natural events NASA EONET reported in the last 30 days; markers in the
  sky for the 110 Messier objects and famous Hubble and Webb targets (galaxies as rings, nebulae as diamonds, star
  clusters as dots). Drag to turn, scroll or pinch to zoom, turn slowly, find by name, show or hide each kind.
  Selecting a sky object shows its facts and NASA's pictures of it; selecting an event opens the Earth map on that
  place and day.
- **Picture library** in the mock-up now searches NASA live, with the centre, year and type filters and Show more.

## November 9, 2026 — Asteroid Tracker: famous close passes, back buttons, smoother zoom

- **Famous close passes** on the map: Apophis (2029), Duende (2013), 2020 QG (2020), 2019 OK (2019) and 2024 YR4
  (2032, with its pass by the Moon). Each flies the map to Earth, plays the pass slowly and pauses at the moment of
  closest approach, with a card of NASA's figures and a short account. Earth, the Moon and the asteroid are placed
  from NASA/JPL Horizons (new monthly file `data/famous.json`); the distances shown match NASA's close-approach data
  to within 16 km.
- **Back buttons:** each asteroid's page, and the map when opened from another page, has a "‹ Back" button naming
  where it returns to. Returning (with that button or the browser's) puts the tracker back on the same week or year,
  filters, sort, open row, search words and scroll position, and the map back on the same view, selection, date and
  filters.
- NASA's answers are kept for an hour in the browser tab, so going back or reloading spends no extra requests.
- **"By year" tables:** every name now opens that asteroid's own page (ids from `data/neos.json`, loaded in the
  background); comets open JPL's page.
- **Map:** zooming in goes down to Earth's true size; Earth, the Sun and the planets are drawn at true size when
  large enough; the Moon's orbit appears near Earth; the scale bar switches to km close in. A **live clock**: on
  today's date the map follows the present moment.
- **Smoother:** the orbit maths runs in a background thread (Web Worker), and lines are cut to the visible area, so
  zooming in close and playing stays at 60 frames a second (slow frames when playing zoomed in fell from about a
  third to under 2%).
- **Layout:** full-screen and exit-full-screen buttons now look different (with an "Exit" label); the spacecraft list
  is a full-width card under the map instead of a tall side column; the "Found by" and "Close to Earth in" controls
  stack on tablets instead of overlapping; a selected asteroid's label no longer touches its ring; starting a famous
  pass scrolls the whole map into view.

## November 9, 2026 — Image Explorer: data checks and a mock-up for review

- GIBS and the NASA Image and Video Library checked with live requests from the published site; findings recorded
  in `docs/DATA-SOURCES.md` (the fire layers work only in the `epsg4326` projection; the library allows 10,000
  results per search; dates and missing picture sizes explained).
- Plan recorded in `docs/PROJECT-NOTES.md`: OpenLayers, eight layers, two tabs, place search, Arctic and Antarctic
  views.
- **Mock-up** (`image-explorer/mockup.html`): a live map of NASA imagery with the eight layers, date controls, a
  day-by-day slider and Play, sample place search, tapping the map, and the picture library with a fixed sample of
  real results and the picture viewer.

## November 9, 2026 — Asteroid Tracker: solar system map, search, home preview, names explained

- **Solar System Map** (`asteroid-tracker/map.html`): all 43,186 known near-Earth objects (asteroids and 209 comets)
  coloured by orbit type, the eight planets and eleven spacecraft (from Parker Solar Probe to the Voyagers, with the
  paths they have flown), at any date from 1900 to 2050. Drag to turn, scroll or pinch to zoom, keyboard controls;
  Top, Tilted and Side views; zoom presets from Mars to the Voyagers; centre on the Sun, Earth or a selection; Play
  at four speeds; Find; filters (potentially hazardous, over 140 m, over 1 km); this week's visitors ringed; full
  screen, with a separate exit button and a fallback for phones that cannot make part of a page full screen.
- **Found by the end of:** a discovery timeline from 1960 to today, with "Watch the discoveries"; the objects found
  in the year shown shine white. **Close to Earth in:** only the asteroids that passed within 10 LD in a chosen year.
- **Search tab:** instant results with every letter over every near-Earth object, a "Found in" filter (a year or a
  decade, biggest first), cards with an orbit sketch, size, orbit type and a link to the map; typed codes are
  decoded as they are typed.
- **How asteroid names work:** a guide in the Search tab, and each name decoded on search cards, the map and each
  asteroid's page (for example "2004 MN4: found June 16–30, 2004, the 113th new small body given a code in that
  half-month").
- **Home page:** a live preview of the map (the 2,552 potentially hazardous asteroids and the inner planets),
  pausing when off screen and still for people who prefer reduced motion; it opens the map.
- **Tabs** across the Asteroid Tracker (This week · By year · Map · Search), also on each asteroid's page, which
  gains "Show on the solar system map".
- New daily data: `fetch_map_data.py` writes `data/neos.json`, `data/preview.json` and `data/spacecraft.json`.
- Layout checked on every page at 320–1440 px; fixes at small widths.

## November 8, 2026 — Asteroid Tracker: tidier notes and layout

- "How to read this" notes are now closed by default and open with a tap.
- Layout fixes found in a check of every page at 320 to 1440 px: the "Open its page" button no longer breaks onto
  two lines; the week bar keeps its dates on one or two neat lines on phones (and reads "Nov 8–14, 2026"); the
  orbit diagram's time buttons fit on one line at 320 px; the legend lines up on small screens.
- Turning the orbit diagram redraws at most once per screen refresh, so dragging stays smooth.

## November 8, 2026 — Asteroid Tracker: each asteroid's page, the orbit diagram, past years

- **A page for each asteroid** (`object.html?id=…`, 1 NASA request): size, length of its year, distance from the Sun,
  orbit tilt and the closest its orbit comes to Earth's; every close approach to Earth from 1900 to 2200 on a chart
  and in a list; facts about how its orbit was worked out. Opened from a row's details in the week view, and from
  numbered asteroids in the year tables.
- **The orbit diagram:** the Sun, Mercury to Mars (and Jupiter for far-reaching orbits) and the asteroid, drawn to
  scale and placed at any date from 1900 to 2050. Top, Tilted and Side views, drag to turn, zoom, and "Near Earth"
  (the path past Earth over ±120 days, with the Moon's orbit for scale). Play, step by day or month, a two-year
  slider, today and the next close approach. Readings for the date: distance from Earth and the Sun, speed around
  the Sun, height above Earth's orbital plane; NASA's official figures beside the diagram's at a close approach,
  and a plain statement of how exact the drawing is for the date shown.
- **Past years:** the year view ("By year") covers 2000 to next year, with a year picker, links such as
  `#year-2012`, tiles suited to past, current and next year, and a chart of the approaches found each year.
- The daily data job now writes one file per year plus an index (`data/years.json`).
- Checked with real data after publishing: for Apophis's December 2027 pass the diagram gives 114.5 LD against
  NASA's 114.22 LD. In the "Near Earth" view the time ticks follow the asteroid's speed (hourly for a fast close
  pass such as Apophis's on April 13, 2029, every few days for a slow distant one). For passes closer than the Moon
  the page notes that Earth's own pull, left out of the diagram, bends the path.

## November 8, 2026 — Asteroid Tracker: charts explained

- Each chart now has a short "How to read this" note with an example.
- The size-against-distance chart shades the area closer than the Moon and labels its directions ("closer than the
  Moon", "bigger ↑ · farther →") above the plot, where they never cover data.

## November 8, 2026 — Asteroid Tracker, version 1

- **This week** (live from NASA NeoWs, 1 request per week shown): tiles for the number passing Earth, the closest,
  the biggest, the fastest and those flagged potentially hazardous; previous and next weeks.
- **Filters:** potentially hazardous only, size, distance and day. **Sorting** by any column (a "Sort by" menu on
  phones). Each row opens its details with sizes, distances and speeds people can picture.
- **Three graphs,** hand-drawn SVG in the project's look: size against miss distance (each size a min–max range),
  approaches per day, and the week's biggest. Tooltips on hover or tap.
- **This year** (NASA/JPL close-approach data): every approach within 1, 5 or 10 Moon distances on a timeline, the
  closest of the year and the ones coming up. The data file is refreshed daily by a new GitHub Actions workflow,
  because the JPL API cannot be called from a web page.
- **Key settings:** add or remove a personal NASA key (kept in the browser only); the page shows which key is in use.
- Loading, empty and error states (NASA out of reach, demo key used up, data file missing), checked at 320 to 1440 px.
- Docs: the checked facts about NeoWs and the JPL API, and the size-from-brightness rule, in DATA-SOURCES.

## November 8, 2026 — documentation tone

- **New rule:** all documentation is written in a professional tone, as project documentation, never in the tone of an
  AI assistant talking to a person (CLAUDE.md, PROJECT-NOTES, the Claude project's instructions).
- The documents were reviewed against it and the remaining informal lines reworded.
- `dev/check_wording.py` now also flags common chat phrases (first-person promises, greetings and sign-offs).

## November 8, 2026 — the site is live

- **GitHub Pages switched on:** the home page is at https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/
  (checked: the page and its three projects load).
- The developer has a personal NASA API key (kept only in the browser and a local `.env`, never in the repository).
- The Claude project's instructions are in place.

## November 8, 2026 — repository set up

- **The repository's structure:** a folder for each project (Asteroid Tracker, Mars Data, Image Explorer), `shared/`
  and `docs/`.
- **The shared look:** `shared/theme.css` (the Flight Deck Suite's navy, brass and cream, serif type) and an emblem.
- **A NASA API helper** (`shared/nasa.js`): one place for requests to api.nasa.gov, the visitor's key kept in their
  browser (the shared `DEMO_KEY` until they add one), answers cached for the visit, and plain-English errors.
- **A home page** (`index.html`) and a placeholder page for each project, ready for GitHub Pages.
- **Docs:** design guide, data sources, project notes, roadmap, history, and the Claude project's instructions.
- **Checks on GitHub:** the wording check (no personal details, neutral wording) and a key check (no API key in the
  repository) after every push.
