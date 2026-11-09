# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)

- [ ] **Create the Claude project's chats:** one per project (the project's instructions are in place).
- [ ] Delete the branch `map-data-test` on GitHub (Branches page): it held a one-off test run of the map's data job
  on Nov 9, 2026, and branches cannot be deleted from the build session.
- [ ] Optional: a **Project Record** PDF rebuilt automatically after every push, as in the Flight Deck Suite and Hot Mic.

## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] **Developer testing**, at the developer's own pace: the live page with real data on a computer and a phone;
  both views, the filters, sorting, row details, key settings (save and remove the personal key).
- [ ] **Developer testing of the additions:** an asteroid's page (open one from a row's details), the orbit
  diagram (Top / Tilted / Side, drag to turn, Play, the slider, Near Earth, tapping an approach), and past years
  in the "By year" view.
- [ ] Confirm the first daily run of the "Asteroid data" workflow the following morning (a new commit, or "No
  change" in its log).
- [ ] **Developer testing of the map, search and home preview:** dragging, pinching and zooming on a phone and a
  computer; Play at each speed; full screen and leaving it; Find; "Found by the end of" with Watch; "Close to Earth
  in"; the Search tab with "Found in"; the naming guide; the live preview on the home page.
- [ ] **Developer testing of the Nov 9 additions:** the five famous close passes on a computer and a phone (each
  flies to Earth, plays and pauses at closest approach); zooming right in to Earth and to a selected asteroid; the
  live clock; the full-screen and exit buttons; the "‹ Back" buttons (tracker → an asteroid → Back returns to the
  same week, filters, open row and scroll position; the same from the map, the Search tab and the "By year" view);
  every name in the "By year" tables opening its own page.
- [ ] After the next daily data run, look at Parker Solar Probe near the Sun on the map: its path should now curve
  smoothly around the Sun (the run samples it every 6 hours).
- [ ] Confirm the monthly refresh of `data/famous.json` on the 1st of the month (the "Asteroid data" log shows
  "famous.json written").

## 2. Image Explorer (version 1 live Nov 9, 2026)

- [ ] **Developer testing** at the developer's own pace, on a computer and a phone: the Earth map (dates, Play,
  layers, place search, tapping the map), the Globe (turning, zooming, events, sky markers, find, the selected card,
  "See it on the Earth map"), the Picture library (search, filters, Show more, the viewer).
- [ ] Further rounds of changes to the globe, as the developer reviews it.
- [ ] Globe: astronaut photos of Earth as pins (work out how to query eol.jsc.nasa.gov; a daily file from GitHub
  Actions, since web pages cannot call it).
- [ ] Globe: confirm the four hand-listed sky positions against SIMBAD (see DATA-SOURCES.md).
- [ ] Globe: sharper Earth close up (finer Blue Marble tiles for the part in view); day and night shading if wanted;
  more objects (fainter galaxies) if wanted.
- [ ] Earth map: each layer's dates read from GIBS rather than a fixed one-day lag for the MUR layers, without
  downloading the 5.8 MB layer list on every visit.
- [ ] Earth map: colour keys drawn in the project's look from GIBS's colour maps, in place of GIBS's light legend images.
- [ ] Earth map: Arctic and Antarctic views (`epsg3413`, `epsg3031`).
- [ ] Place search: mountains, lakes, rivers and other natural features (GeoNames classes T and H).
- [ ] Picture library: videos playable; all sizes of a picture listed in the viewer.
- [ ] Shared parts used by both projects (tabs, "How to read this", the big search box, the tooltip) moved from
  `asteroid-tracker/tracker.css` into `shared/theme.css`; the page still loads `tracker.css` for them.
- [ ] Load OpenLayers and three.js from the repository rather than a CDN, so the page does not depend on jsDelivr.
- [ ] Keyboard use of the globe's markers (today they are reached through Find). With reduced motion set, the globe
  does not turn by itself and moves without animation; to be rechecked on a phone.

## 3. Mars Data (third)

- [ ] Confirm the dataset in its own chat (REMS MODRDR as the first choice).
- [ ] Download a first batch of sols; look at the files' columns.
- [ ] Cleaning: missing and impossible values, units, gaps marked.
- [ ] Organise by sol, Ls (season) and time of day.
- [ ] Statistics: daily highs and lows, seasonal averages, relationships between measurements.
- [ ] Charts page in the project's look; a short write-up of what the patterns show.
