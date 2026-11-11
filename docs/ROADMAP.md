# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)



## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] Watch the scheduled "Asteroid data" runs (06:17 and the 14:47 backup, added Nov 9, 2026): at least one should
  run each day.
- [ ] Confirm the monthly refresh of `data/famous.json` on the 1st of the month (the "Asteroid data" log shows
  "famous.json written").
- [ ] **Developer testing of the Nov 10 additions,** on a computer and a phone: the orbit diagram turning past
  edge-on with a mouse; the rose risk-list dots on the map, the diamonds when zoomed in, and "Show in their orbit
  colours"; the "ESA and NASA compared" chart on an asteroid page (for example Bennu, 1950 DA, Duende); "Share this
  view" on the map and "Share this week" on the tracker, opened on another device.
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
- [ ] Picture library: tune the ranking further as the developer reviews searches (the weights are in `scoreOf` in
  `image-explorer/app.js`).
- [ ] Polar views: a sea ice layer that works through the polar night. GIBS's microwave sea-ice records ended
  (SSMIS Aug 2021, AMSR2 Sep 2025); the current one is MODIS (a camera, daylight only). Ice surface temperature
  (`MODIS_Terra_Ice_Surface_Temp_Night`, thermal) is an option to consider.
- [ ] Further rounds of changes to the globe, as the developer reviews it.
- [ ] Place search: smaller natural features (Natural Earth 1:10m leaves out, for example, Lake Louise and the Bow
  River).
- [ ] Picture library: subtitles for videos (NASA's files cannot be attached from another site; would need a copy).
- [ ] Shared parts used by both projects (tabs, "How to read this", the big search box, the tooltip) moved from
  `asteroid-tracker/tracker.css` into `shared/theme.css`; the page still loads `tracker.css` for them.
- [ ] Globe: more sky objects (fainter galaxies), if wanted.
- [ ] Keyboard use of the globe's markers (today they are reached through Find). With reduced motion set, the globe
  does not turn by itself and moves without animation; to be rechecked on a phone.

## 3. Mars Data (third)

Plan confirmed Nov 11, 2026 (see PROJECT-NOTES.md): three missions, updated automatically by a GitHub Actions job.

**Data and analysis**
- [ ] Check each source against the agency's current documentation and record it in `docs/DATA-SOURCES.md` with its
  exact credit line: Curiosity REMS (MODRDR), Perseverance MEDA, Mars Express MaRS profiles (ESA, CC BY-NC 3.0 IGO).
- [ ] Test that GitHub's servers can reach the NASA PDS Atmospheres Node and ESA's Planetary Science Archive (the
  project's cloud workspace cannot).
- [ ] Download the REMS record in chunks (the whole mission, sol 1 to the newest released sol); look at the files'
  columns on the first chunk. Confirm the newest sol in the archive (the REMS
  page gives sol 4488, its volume list sols 1–3778).
- [ ] Cleaning, chunk by chunk: missing and impossible values, confidence flags, units, gaps marked; a cleaning
  report per chunk (rows kept and removed, reasons, gaps) checked before the next chunk.
- [ ] Organise by sol, Ls (season), time of day and site.
- [ ] Statistics: daily highs and lows, seasonal averages, relationships between measurements.
- [ ] Add MEDA (Jezero Crater) and the MaRS profiles (ESA) to the same pipeline.

**Automatic updates**
- [ ] GitHub Actions job "Mars data", twice a week to start (to be reduced to weekly once stable): check each
  mission's archive for new or replaced files, download only those, clean and summarise with the same code, run the
  checks, and commit the summaries if they changed.
- [ ] Manifest of processed files (name, size, checksum), committed, so nothing is downloaded twice and replaced
  files are reprocessed.
- [ ] Checks before saving: expected columns, values within physical limits, sol count never decreasing, no
  duplicate sols. On any failure the previous summaries are kept and the job stops with an error.
- [ ] Email notice: when a run finds new data, the job opens a GitHub issue ("New Mars data: …"), which GitHub emails
  to the repository owner; a failed run is reported the same way.
- [ ] The page shows, for each mission, "Data up to sol X · checked [date]".

**Page**
- [ ] Charts page mock-up for approval: pressure over the Mars year, one sol hour by hour, daily highs and lows,
  season × time of day, one relationship; later the Mars Express profiles.
- [ ] Charts page in the project's look; a short write-up of what the patterns show.
- [ ] `CREDITS.md`, the Credits page and the Privacy page updated for the new sources in the same change.
