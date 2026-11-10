# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)


- [ ] Delete the branch `map-data-test` on GitHub (Branches page): it held a one-off test run of the map's data job
  on Nov 9, 2026, and branches cannot be deleted from the build session.
- [ ] Optional: a **Project Record** PDF rebuilt automatically after every push, as in the Flight Deck Suite and Hot Mic.

## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] **Developer testing**, at the developer's own pace: the live page with real data on a computer and a phone;
  both views, the filters, sorting, row details, key settings (save and remove the personal key).
- [ ] **Developer testing of the additions:** an asteroid's page (open one from a row's details), the orbit
  diagram (Top / Tilted / Side, drag to turn, Play, the slider, Near Earth, tapping an approach), and past years
  in the "By year" view.
- [ ] Watch the scheduled "Asteroid data" runs (06:17 and the 14:47 backup, added Nov 9, 2026): at least one should
  run each day.
- [ ] **Developer testing of the home page's "closest pass, next 7 days" line, the size comparisons and the three new
  famous passes** (Toutatis, 2012 TC4, 2023 BU), on a computer and a phone.
- [ ] **Developer testing of map panning** with a mouse (right, middle and Shift drag), a trackpad (the ✥ button)
  and a phone (two fingers), and of the "‹ Back" buttons going back exactly one page.
- [ ] **Developer testing of the orbit diagram's close-approach rings,** the countdown, Play stopping at the approach,
  the new speeds, and turning a famous pass off by pressing its button again.
- [ ] **Developer testing of the map, search and home preview:** dragging, pinching and zooming on a phone and a
  computer; Play at each speed; full screen and leaving it; Find; "Found by the end of" with Watch; "Close to Earth
  in"; the Search tab with "Found in"; the naming guide; the live preview on the home page.
- [ ] **Developer testing of the Nov 9 additions:** the five famous close passes on a computer and a phone (each
  flies to Earth, plays and pauses at closest approach); zooming right in to Earth and to a selected asteroid; the
  live clock; the full-screen and exit buttons; the "‹ Back" buttons (tracker → an asteroid → Back returns to the
  same week, filters, open row and scroll position; the same from the map, the Search tab and the "By year" view);
  every name in the "By year" tables opening its own page.
- [ ] Confirm the monthly refresh of `data/famous.json` on the 1st of the month (the "Asteroid data" log shows
  "famous.json written").
- [ ] **Developer testing of the ESA additions (Nov 9, 2026),** on a computer and a phone: the Impact risk tab
  (filters, sorting, row details, the links to ESA's and NASA's pages), an asteroid page's "Impact risk" section, the
  ESA tiles in a week row's details, the map's "On a risk list" filter and the arrow buttons that appear with ✥.
- [ ] **Developer testing of the map's free tilt (Nov 10, 2026):** drag up and down past edge-on to look from
  underneath and round again, on a computer and a phone; the Top, Tilted and Side buttons bring the view back.
- [ ] Watch the "Fetch impact-risk lists and ESA close approaches" step in the "Asteroid data" runs: ESA calls its
  automated access experimental, so a change of format stops the step (the previous files are kept) and needs a fix
  in `fetch_risk.py`.
- [ ] Optional: if ESA's credit form or terms for the NEOCC figures are in doubt, ask the NEOCC by email
  (`neocc@esa.int`) and record the answer in `docs/DATA-SOURCES.md`.

## 2. Image Explorer (version 1 live Nov 9, 2026; additions Nov 9)

- [ ] **Astronaut photos: request the free API key** by email from jsc-earthweb@mail.nasa.gov (Gateway to Astronaut
  Photography of Earth), then store it on github.com as the repository secret `EOL_API_KEY` (Settings › Secrets and
  variables › Actions › New repository secret) and run Actions › Astronaut photos › Run workflow once. Until then the
  globe hides the astronaut photos. The first real run is the first test of `fetch_astronaut_photos.py` against the
  API (it was tested on records shaped like the API documentation's examples).
- [ ] **Developer testing** at the developer's own pace, on a computer and a phone: the Earth map (dates, Play,
  layers, place search with towns and natural features, tapping the map, the Arctic and Antarctic views), the Globe
  (turning, zooming, events, sky markers, find, the selected card, "See it on the Earth map"), the Picture library
  (search, results as you type, spelling suggestions and corrections, mission buttons, Behind the scenes, filters,
  Pictures / Pictures and videos / Videos, playing a video, Show more, the viewer, "See it in the sky").
- [ ] **Check the ESA pictures on the live site** with a browser: searches such as "crab nebula", "saturn" and the
  James Webb and Hubble buttons; an ESA picture's credit line, caption and details in the viewer; the From filter.
  The build was tested on pages copied from ESA's markup of Nov 9, 2026; the workspace used for the build cannot
  reach ESA's sites.
- [ ] Picture library: ESA's videos (esawebb.org/videos, esahubble.org/videos) beside NASA's, if wanted.
- [ ] Picture library: tune the ranking further as the developer reviews searches (the weights are in `scoreOf` in
  `image-explorer/app.js`).
- [ ] Polar views: a sea ice layer that works through the polar night. GIBS's microwave sea-ice records ended
  (SSMIS Aug 2021, AMSR2 Sep 2025); the current one is MODIS (a camera, daylight only). Ice surface temperature
  (`MODIS_Terra_Ice_Surface_Temp_Night`, thermal) is an option to consider.
- [ ] Delete the branch `image-explorer-probe` on GitHub (Branches page): it held one-off probes of NASA, SIMBAD and
  the astronaut photo site on Nov 9, 2026.
- [ ] Further rounds of changes to the globe, as the developer reviews it.
- [ ] Globe: sharper Earth close up (finer Blue Marble tiles for the part in view); day and night shading if wanted;
  more objects (fainter galaxies) if wanted.
- [ ] Earth map: each layer's dates read from GIBS rather than fixed one-day lags (MUR layers; clouds in the polar
  views), without downloading the 5.8 MB layer list on every visit.
- [ ] Earth map: colour keys drawn in the project's look from GIBS's colour maps, in place of GIBS's light legend images.
- [ ] Place search: smaller natural features (Natural Earth 1:10m leaves out, for example, Lake Louise and the Bow
  River).
- [ ] Picture library: subtitles for videos (NASA's files cannot be attached from another site; would need a copy).
- [ ] Shared parts used by both projects (tabs, "How to read this", the big search box, the tooltip) moved from
  `asteroid-tracker/tracker.css` into `shared/theme.css`; the page still loads `tracker.css` for them.
- [ ] Load OpenLayers, proj4js and three.js from the repository rather than a CDN, so the page does not depend on jsDelivr.
- [ ] Keyboard use of the globe's markers (today they are reached through Find). With reduced motion set, the globe
  does not turn by itself and moves without animation; to be rechecked on a phone.

## 3. Mars Data (third)

- [ ] Confirm the dataset in its own chat (REMS MODRDR as the first choice).
- [ ] Download a first batch of sols; look at the files' columns.
- [ ] Cleaning: missing and impossible values, units, gaps marked.
- [ ] Organise by sol, Ls (season) and time of day.
- [ ] Statistics: daily highs and lows, seasonal averages, relationships between measurements.
- [ ] Charts page in the project's look; a short write-up of what the patterns show.
