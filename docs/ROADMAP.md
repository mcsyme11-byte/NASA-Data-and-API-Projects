# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)



## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] Developer testing: the Asteroid Tracker's home page (`asteroid-tracker/`) on phone, tablet and computer; each
  card's link; an old link such as `asteroid-tracker/#risk` opening the tracker.
- [ ] **Developer testing of the Nov 12, 2026 additions** (built and published Nov 12, 2026):
  - Asteroid Tracker, "Visible from here" tab: "Use my location" and a typed town; the passes list, the night chart,
    "Find it ›" opening Sky Finder; "Forget this place".
  - Sky Finder (`sky-finder/`), on a phone outdoors at night: add to the home screen (iPhone and Android); the safety
    notice; camera, location and motion prompts; calibration on the Moon or a planet; the markers lining up with the
    real Moon, planets and bright stars; an asteroid's diamond and path; red light; the ISS or Tiangong passes; the
    how-to page.
  - Spacecraft map (`spacecraft/`) and the home page's new panel: the five views, search, agency and kind filters,
    the card for several craft, Follow, the path, Share, time controls; the asteroid map link under the panel.
- [ ] Read the first runs of the new "Spacecraft data" workflow and the "Fetch sky positions" step of "Asteroid data"
  (Actions logs): every craft should be found; any "not found" line (Horizons name or CelesTrak name) needs its
  `src` corrected in `spacecraft/catalogue.json`. Links reported broken in `spacecraft/data/links.json` need new
  addresses.
- [ ] Spacecraft map: Tianwen-1 and Tianwen-2 are not in Horizons, and CelesTrak does not return TESS; add them if
  either service lists them later (the run log names every craft not found).
- [ ] Review `spacecraft/catalogue.json` every few months: take missions that have ended off the list, add new ones.
- [ ] Watch the scheduled "Asteroid data" runs (06:17 and the 14:47 backup, added Nov 9, 2026): at least one should
  run each day.
- [ ] Confirm the monthly refresh of `data/famous.json` on the 1st of the month (the "Asteroid data" log shows
  "famous.json written").
- [ ] Watch the "Fetch impact-risk lists and ESA close approaches" step in the "Asteroid data" runs: ESA calls its
  automated access experimental, so a change of format stops the step (the previous files are kept) and needs a fix
  in `fetch_risk.py`.
- [ ] Optional: if ESA's credit form or terms for the NEOCC figures are in doubt, ask the NEOCC by email
  (`neocc@esa.int`) and record the answer in `docs/DATA-SOURCES.md`.

## 2. Image Explorer (version 1 live Nov 9, 2026; home page Nov 12)

- [ ] Astronaut photos: the free API key (requested by email from jsc-earthweb@mail.nasa.gov; no answer by Nov 11,
  2026) would add cataloged photos with their centre points. Without it the job uses the public Latest ISS Imagery set
  (since Nov 11, 2026). If the key arrives: repository secret `EOL_API_KEY`, then Actions › Astronaut photos › Run
  workflow.
- [ ] **Developer testing of the project's home page (Nov 12, 2026)** on a phone, a tablet and a computer: the three
  "Open" buttons go to the right tab of the explorer, and the explorer's back button returns to the home page.
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
- [x] REMS, the whole record (sols 1–4843, August 7, 2012 to March 22, 2026; 4,703 sols with data), cleaned with rules
  1.2 in chunks; every cleaning report checked (Nov 12, 2026). Rule 11 removes the evening air-temperature glitch
  (34 sols); the set-aside list (`exclusions.csv`, rule 10) is empty.
- [x] Corrected UV (sols 1–3423, 35 files of about 1.2 GB): all done and checked (row counts match NASA's labels).
- [ ] After the first scheduled run of the "Mars data" job succeeds: delete the one-off probe (`mars-data/probe/`),
  the branch workflows (`mars-probe.yml`, `mars-chunks.yml`, `mars-meda.yml`, `mars-mex.yml`, on the `mars-probe`
  branch) and the `mars-probe` branch itself.
- [ ] Optional: ask ESA (data.licences@esa.int) to confirm the spelling of the Mars Express MaRS credit line
  ("M. Plätzold, K. Pieter" on ESA's terms page; the archive names Martin Pätzold).
- [x] Perseverance MEDA (Jezero Crater), sols 0–1859, cleaned with MEDA rules 1.0 (`CLEANING-MEDA.md`); every report
  checked (Nov 12, 2026). Reviewed, real weather: sol 1078 (+20 Pa step in the dusty season) and sol 1113 (11 hours
  measured).
- [x] Two-craters chart (Gale and Jezero pressure): approved and on the page (Nov 12, 2026).
- [ ] Mars Express MaRS profiles (ESA): waiting for ESA's archive (401 during maintenance, Nov 12, 2026); then run
  `run_mex.py` and add a profiles chart (mock-up first). Alternative to check: NASA's PDS Geosciences Node copy.

**Automatic updates**
- [x] GitHub Actions job "Mars data" (`.github/workflows/mars-data.yml`), live Nov 12, 2026: Mondays and Thursdays
  at 09:23 UTC (to be reduced to weekly once stable). It checks NASA's REMS and MEDA archives and ESA's Mars Express
  archive for new or replaced files, downloads only those (manifests of name, size and checksum), cleans and
  summarises them with the same code, runs `validate.py`, and commits only if every check passes.
- [x] Checks before saving (`validate.py`): expected columns, values within physical limits, sol count never
  decreasing, no duplicate sols, the season advancing, no single-hour glitch left (rule 11), no full sol with an air
  low below 170 K, and a cleaning report for every processed chunk.
- [x] Email notice: a run that finds new data, or fails, opens a GitHub issue ("New Mars data: …"), which GitHub
  emails to people watching the repository.
- [x] The charts page shows "Data up to sol X … NASA's archive checked [date]".
- [ ] Reduce the job to weekly once it has run without trouble for a few weeks.

**Page**
- [x] Page live (Nov 12, 2026) with the whole record, sols 1–4843.
- [ ] A short write-up on the page of what the patterns show, once the whole record is in.
- [ ] `CREDITS.md`, the Credits page and the Privacy page updated for the new sources in the same change.
