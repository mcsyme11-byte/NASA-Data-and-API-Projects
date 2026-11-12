# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)



## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] **Mock-ups awaiting the developer's approval (Nov 12, 2026), then build, in one push:**
  - Update 1: a "Visible from here" tab (location button, which close passes rise at night from there, brightness
    and what is needed to see each) and **Sky Finder**, an installable phone web app in its own folder of this
    repository: camera view with a marker and path for the asteroid, the Moon and planets for reference,
    calibration on the Moon or a planet, and a how-to page inside it, linked from the tracker and the Image
    Explorer. Camera, location and motion stay on the device; the Privacy page is updated first.
  - Update 2: a **Spacecraft map** on the home page's large panel (a utility, not a fourth project), the asteroid
    map as a smaller link: every active spacecraft with a public position (NASA, ESA, JAXA, ISRO, CNSA and others;
    deep space from JPL Horizons, notable craft near Earth from CelesTrak), with details and links for each, using
    the asteroid map's controls. Secret military craft have no published orbits and are left out.
- [ ] Watch the scheduled "Asteroid data" runs (06:17 and the 14:47 backup, added Nov 9, 2026): at least one should
  run each day.
- [ ] Confirm the monthly refresh of `data/famous.json` on the 1st of the month (the "Asteroid data" log shows
  "famous.json written").
- [ ] Watch the "Fetch impact-risk lists and ESA close approaches" step in the "Asteroid data" runs: ESA calls its
  automated access experimental, so a change of format stops the step (the previous files are kept) and needs a fix
  in `fetch_risk.py`.
- [ ] Optional: if ESA's credit form or terms for the NEOCC figures are in doubt, ask the NEOCC by email
  (`neocc@esa.int`) and record the answer in `docs/DATA-SOURCES.md`.

## 2. Image Explorer (version 1 live Nov 9, 2026; additions Nov 9)

- [ ] Astronaut photos: the free API key (requested by email from jsc-earthweb@mail.nasa.gov; no answer by Nov 11,
  2026) would add cataloged photos with their centre points. Without it the job uses the public Latest ISS Imagery set
  (since Nov 11, 2026). If the key arrives: repository secret `EOL_API_KEY`, then Actions › Astronaut photos › Run
  workflow.
- [ ] **Developer testing of the Nov 11, 2026 additions:** tapping the Earth map in a desert, at sea and near a town
  (country, feature, distance); the gaps between satellite passes filled; Map lines and names (borders, coastlines,
  rivers, names, grid) in all three views; the globe's earthquakes, volcanoes, launch sites, natural wonders and
  astronaut photos.
- [ ] **Developer testing of the Nov 10, 2026 additions,** on a computer and a phone: the Earth map's colour keys and
  the note under the map when a layer shows another day; place search for smaller places (for example Moraine Lake,
  Mount Rundle); the globe zoomed in close (sharper Earth) and the Day and night button; ESA videos with "Pictures and
  videos" or "Videos".
- [ ] Picture library: tune the ranking further as the developer reviews searches (the weights are in `scoreOf` in
  `image-explorer/app.js`).
- [ ] Polar views: a sea ice layer that works through the polar night. GIBS's microwave sea-ice records ended
  (SSMIS Aug 2021, AMSR2 Sep 2025); the current one is MODIS (a camera, daylight only). Ice surface temperature
  (`MODIS_Terra_Ice_Surface_Temp_Night`, thermal) is an option to consider.
- [ ] Further rounds of changes to the globe, as the developer reviews it.
- [ ] Picture library: subtitles for videos (NASA's files cannot be attached from another site; would need a copy).
- [ ] Shared parts used by both projects (tabs, "How to read this", the big search box, the tooltip) moved from
  `asteroid-tracker/tracker.css` into `shared/theme.css`; the page still loads `tracker.css` for them.
- [ ] Globe: more sky objects (fainter galaxies), if wanted.
- [ ] Keyboard use of the globe's markers (today they are reached through Find). With reduced motion set, the globe
  does not turn by itself and moves without animation; to be rechecked on a phone.

## 3. Mars Data (third)

Plan confirmed Nov 11, 2026 (see PROJECT-NOTES.md): three missions, updated automatically by a GitHub Actions job.

**Data and analysis**
- [ ] REMS, the whole record in chunks (44 chunk folders, sols 1–4843 on Nov 11, 2026) with cleaning rules 1.1
  (`mars-data/analysis/CLEANING.md`): sols 1–1293 done and checked; sols 1294–4843 in batches of about five chunks,
  each report checked before the next batch.
- [ ] Corrected UV (sols 1–3423, 35 files of about 1.2 GB): sols 1–1300 done and checked (row counts match NASA's
  labels); the rest with the REMS batches.
- [ ] The cleaned summaries are built on the `mars-probe` branch and copied to main after each checked batch (sols
  1–1293 on main). When the whole record is in: the scheduled "Mars data" job on main replaces the branch job; delete
  the one-off probe (`mars-data/probe/`, `mars-probe.yml`) and the branch.
- [ ] Optional: ask ESA (data.licences@esa.int) to confirm the spelling of the Mars Express MaRS credit line
  ("M. Plätzold, K. Pieter" on ESA's terms page; the archive names Martin Pätzold).
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
- [ ] Page live (Nov 12, 2026) with sols 1–1293; add each new batch's summaries (`analysis/make_page_data.py`)
  until the whole record is in.
- [ ] A short write-up on the page of what the patterns show, once the whole record is in.
- [ ] `CREDITS.md`, the Credits page and the Privacy page updated for the new sources in the same change.
