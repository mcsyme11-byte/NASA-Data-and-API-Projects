# Project notes

How NASA and ESA Data Projects is built, the decisions made so far, and how to run and publish it.

## Decisions

- **Decided Nov 11, 2026 (Mars Data):** the whole Curiosity record (sol 1 to the newest released sol) is used from
  the start, not a single Mars year. It is downloaded and cleaned in chunks (a range of sols at a time), each chunk
  checked and its cleaning results recorded before the next is processed: rows kept and removed, the reason for each
  removal, and the gaps found. Cleaning is done slowly and carefully; correctness comes before speed.
- **Decided Nov 11, 2026 (whole site):** the projects are numbered in build order: Project 1 Asteroid Tracker,
  Project 2 Image Explorer, Project 3 Mars Data (Mars was previously labelled Project 2). The home page lists them in
  that order.
- **Decided Nov 11, 2026 (Mars Data):** the project follows a fixed set of three missions and updates itself as new
  data is published: NASA's Curiosity (REMS, Gale Crater) and Perseverance (MEDA, Jezero Crater), and ESA's Mars
  Express (MaRS temperature and pressure profiles, CC BY-NC 3.0 IGO). InSight is not followed (the mission ended in
  2022). Mission data reaches the public archives in batches, months after it is measured, so "up to date" means each
  new batch is picked up soon after release, not live readings. A GitHub Actions job checks the archives twice a
  week to start (weekly once stable), downloads only new or replaced files, processes them with the same code as the
  rest, and commits the summaries only if every check passes; otherwise the previous summaries stay. New data and
  failed runs open a GitHub issue, which reaches the developer by email. Raw downloads are never committed.
- **Decided Nov 10, 2026:** the repository stays a single public repository (no separate private copy: only the
  developer and the chats he works with can push; others can only fork, comment or propose changes, which need his
  approval). `main` is protected by a branch ruleset, "Protect main": deletion of `main` and force pushes to it are
  blocked; ordinary pushes from the chats and the daily data jobs are unaffected. History on `main` is therefore never
  rewritten: a mistake is undone with a new commit (`git revert`), not by force-pushing over it.
- **Decided Nov 9, 2026:** ESA (the European Space Agency) data is added **alongside** NASA's across the projects;
  NASA stays the main source, and ESA is added where it helps. Each project's chat changes its own project; the
  project-wide files (name, CLAUDE.md, credits, terms, footers) are changed in the general chat. The rules for ESA
  sources are in CLAUDE.md: check against ESA's documentation first, record in DATA-SOURCES, show ESA's credit wherever
  its data appears, list it in CREDITS.md and on the Credits page, never use ESA's logo, keep it free, and add any ESA
  service the browser contacts to the Privacy page first. Every page says the project isn't endorsed by NASA or ESA.
- **Decided Nov 9, 2026:** the project is renamed **NASA and ESA Data Projects**, and the repository
  **mcsyme11-byte/NASA-ESA-Data-and-API-Projects** (formerly NASA-Data-and-API-Projects). The site moved with it to
  https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/ (GitHub does not redirect the old site address; it
  redirects the old repository address for links and Git). Saved browser data keeps its old `nasa-data-projects.`
  names, so visitors' keys and places are not lost.
- **Decided Nov 9, 2026:** the site has information pages (About, Privacy, Terms of use, Credits, Contact) at
  `about/`, `privacy/`, `terms/`, `credits/` and `contact/`, linked from a row of site links in every footer
  (`shared/footer.js`, one file for every page). The footer also links to the licence and the source code on GitHub.
  The Privacy page states what the site actually does (nothing collected; the API key in local storage; the place in
  a page in session storage; GitHub Pages and NASA's and ESA's services contacted directly; the code libraries are served from the site itself since Nov 10, 2026) and is updated before the
  site stores or sends anything new.
- **Decided Nov 9, 2026:** the project's own code and documents are released under the **MIT License** (replacing
  "all rights reserved"); third-party data and libraries keep their own terms, listed in `CREDITS.md`. A new data
  source or library is added to `CREDITS.md` (and the site's Credits page) in the same change.
- **Decided Nov 8, 2026:** three projects in one repository, each in its own folder (a "stream"):
  `asteroid-tracker/`, `mars-data/`, `image-explorer/`. Shared code and the look live in `shared/`.
- **Decided Nov 8, 2026:** the repository is **public**, so the pages can be hosted free on GitHub Pages and shown
  as a portfolio. Rule that follows: no API key, password or personal detail is ever committed.
- **Decided Nov 8, 2026:** the look follows the Flight Deck Suite and Hot Mic ("old money": navy, brass, cream,
  serif type), see [DESIGN.md](DESIGN.md).
- **Suggested order (Nov 8, 2026):** Asteroid Tracker, then Image Explorer, then Mars Data.
- **Each project is built in its own chat** inside the Claude project "NASA and ESA Data Projects"; a general chat is for
  questions and exploring.
- **Decided Nov 8, 2026 (Asteroid Tracker):** charts are hand-drawn SVG (no library), the "This year" view (JPL
  close-approach data) is part of version 1, and the page was built from an approved mock-up.
- **Decided Nov 8, 2026 (Asteroid Tracker):** the JPL close-approach API blocks calls from web pages, so GitHub
  Actions fetches the year's data once a day and commits `asteroid-tracker/data/close-approaches.json` when it has
  changed (one automatic commit a day at most, "Asteroid data: daily close-approach update").
- **Decided Nov 8, 2026 (Asteroid Tracker):** after version 1, three additions: a page for each asteroid (every
  approach, from `neo/{id}`), past years in the year view (2000 to next year) and an orbit diagram, with the orbit
  diagram to be done with particular care. The developer allowed building these without separate mock-ups.
- **Decided Nov 8, 2026 (Asteroid Tracker):** a solar system map on its own page (`map.html`) with every near-Earth
  object, the planets and spacecraft; a live preview of it on the home page; a Search tab. Mock-ups approved Nov 8.
- **Decided Nov 9, 2026 (Asteroid Tracker):** a guide to how asteroids are named, with each code decoded on the pages;
  "Found by the end of" (a discovery timeline) and "Close to Earth in" (a year) on the map; "Found in" in search;
  comets kept on the map as their own type. Built without a separate mock-up, at the developer's request.
- **Map performance (Nov 9, 2026):** positions are worked out only when the date changes, in typed arrays, starting
  each object from its previous frame's solution; dots are written straight into a pixel buffer at most 1.5× the
  screen's resolution; nothing is redrawn unless something changed. Measured with all 43,186 objects: dragging at
  60 frames a second on every screen tested; playing at 60 on standard and phone screens and 50–55 on 2× desktop and
  tablet screens, on a test machine without a graphics processor.
- **Map performance (Nov 9, 2026):** the Kepler solving moved to a background thread (`orbitworker.js`, sharing
  `kepler.js` with the page, which falls back to solving itself if a worker cannot start); lines are cut to the
  visible area before drawing. Measured: playing at a median of 60 frames a second at every width, zoomed in or out.
- **Decided Nov 9, 2026 (Asteroid Tracker):** spacecraft paths are smooth curves through every sample; Parker Solar
  Probe and Juno show only their last year unless selected, because their repeated loops piled up into a tangle.
- **Decided Nov 9, 2026 (Asteroid Tracker):** famous close passes are placed from Horizons positions
  (`data/famous.json`), not two-body orbits, because Earth's pull bends the path during a close pass. Five passes:
  Apophis 2029, Duende 2013, 2020 QG, 2019 OK and 2024 YR4 (2032).
- **Decided Nov 9, 2026 (Asteroid Tracker):** "‹ Back" uses the browser's own Back when the previous page is part of
  the site; the tracker and the map keep their place in the browser tab (`back.js`), and NASA's answers are kept
  for an hour in the tab (`shared/nasa.js`), so returning costs no requests.
- **Decided Nov 8, 2026 (Asteroid Tracker):** the orbit diagram computes positions itself (two-body Kepler orbits from
  NASA's elements; planets from JPL's approximate elements), so it works offline from the one NeoWs answer. Its
  limits are shown on the page; NASA's official close-approach figures are shown beside it.

- **Decided Nov 9, 2026 (Image Explorer):** one page with two tabs, "Earth map" and "Picture library". The map uses
  OpenLayers in the `epsg4326` projection (the fire layers work only there; see DATA-SOURCES.md), with Arctic and
  Antarctic views. Eight layers to start: true colour, night lights and sea temperature as the picture underneath;
  fires, snow, clouds, smoke and dust, and sea ice on top (fires with anything, the coloured layers one at a time).
  A date picker, a day-by-day slider and Play. Place search with suggestions after every letter (names and
  coordinates); tapping the map offers NASA's pictures of that place. The picture library is images first, with
  videos available as a filter. A mock-up comes first (`image-explorer/mockup.html`).

- **Decided Nov 9, 2026 (Image Explorer):** after the first mock-up the developer asked for a globe of the Earth that
  turns and zooms like the Asteroid Tracker's solar system map, with NASA pictures pinned to places on the Earth and
  to galaxies and nebulae in the sky around it. The daily Earth map stays. The page now has three tabs: **Earth
  map · Globe · Picture library**. The globe uses three.js (MIT licence) with NASA's Blue Marble, turned to the
  current sidereal time inside the real sky. Pins on the Earth: NASA EONET events (live) and, later, astronaut photos
  of Earth. Pins in the sky: all 110 Messier objects and famous Hubble and Webb targets, each opening NASA's pictures
  of it. Several rounds of mock-ups are expected.
- **Decided Nov 9, 2026 (Image Explorer):** the developer approved the globe mock-up for publishing and asked to see
  it with all the galaxies. Version 1 went live the same night with about 1,350 sky objects (every Messier object,
  every named object and every galaxy to magnitude 12) and the constellations, the real place list (GeoNames) and the
  live picture library. Further rounds of changes are expected.
- **Decided Nov 9, 2026 (Image Explorer):** the developer asked for five additions at once, built the same night:
  the four hand-listed sky positions checked, playable videos, natural features in place search (Natural Earth),
  Arctic and Antarctic views (proj4js with OpenLayers), and astronaut photos on the globe (a daily GitHub Actions
  job, active once the free API key is stored as the secret `EOL_API_KEY`).
- **Decided Nov 9, 2026 (Image Explorer):** the picture library puts pictures taken in space or of space first and
  moves launches, people, events and artists' illustrations under "Behind the scenes"; results appear as you type
  from 3 letters; suggestions and corrections allow for small spelling mistakes; mission buttons search several
  phrasings; a picture naming a sky object links to it on the globe. Whether to add ESA's Webb and Hubble archives is
  left to the developer.
- **Decided Nov 9, 2026 (Image Explorer):** the developer approved the mock-up of ESA's pictures in the library. Each
  search also asks ESA/Webb and ESA/Hubble's archives live (their pages allow browsers to read them); results are
  merged and sorted by the same score (ESA's archive pictures start 2 higher, as telescope science pictures), taking
  turns between libraries. A tag on each picture names its library; "From" picks NASA, ESA or both. The James Webb
  and Hubble buttons list ESA's whole archive for that telescope; the other mission buttons ask NASA only. ESA's
  archives have no videos; the NASA centre filter applies to NASA's pictures; the years apply to ESA's pictures by
  the year in their ID. An ESA picture's credit line, caption and details are read from its page when it opens.
- **Decided Nov 9, 2026 (Asteroid Tracker):** ESA's NEO Coordination Centre is added beside NASA's data. A new
  "Impact risk" tab lists every object on ESA's risk list (including its special risk list) or NASA/JPL's Sentry list,
  side by side, with the Torino and Palermo scales explained as rules; an asteroid's page and the week's details show
  ESA's and NASA's impact chances and ESA's close-approach distance; the map gains an "On a risk list" filter and
  on-screen arrow buttons for panning on phones. Neither centre's server allows calls from web pages, so the data job
  writes `data/risk.json` and `data/esa_close.json`. NASA stays the main source; every figure says which agency it
  comes from. The developer waived the mock-up step for this addition ("just do as much as you can").
- **Decided Nov 9, 2026 (licence position):** ESA's NEOCC portal has no licence of its own and refers to ESA's general
  terms, which allow educational and informational use with ESA's credit. The figures are shown with the credit
  "ESA NEO Coordination Centre (©ESA)" and no ESA logo; if a question arises, the NEOCC is asked by email
  (`neocc@esa.int`).
- **Not possible (Nov 9, 2026):** seeing individual houses. NASA's sharpest free imagery is about 30 m a pixel
  (Landsat) and the daily layers 250 m; houses need commercial imagery, which is neither NASA's nor free.

## How it's built (starting plan; each project's chat confirms it)

| Part | Built with | Why |
|---|---|---|
| Web pages | Plain HTML, CSS and JavaScript modules, no build step | Free hosting on GitHub Pages; easy to read and learn from |
| Charts | Hand-drawn SVG, styled to DESIGN.md (Asteroid Tracker); chosen per project | No library to load; matches the look exactly |
| Globe (Image Explorer) | three.js 0.187 (MIT licence, from a CDN), WebGL | A textured Earth, 5,000 stars and markers drawn smoothly; the markers and names are drawn on a 2D layer above |
| Maps (Image Explorer) | OpenLayers 10 (BSD licence) and proj4js 2.22 (MIT) from a CDN; `epsg4326`, `epsg3413` (Arctic), `epsg3031` (Antarctic) | Handles GIBS's tile grids, vector fire tiles and polar views; Leaflet does not without add-ons |
| Mars analysis | Python 3 (pandas, matplotlib) in `mars-data/analysis/` | Cleaning and statistics are easiest in Python; it writes small summary files the web page reads |

## API keys

- **Web pages:** `shared/nasa.js` keeps the visitor's own key in their browser (localStorage) and uses NASA's
  `DEMO_KEY` until they add one. A key placed in a public page's code would be visible to anyone, which is why it
  isn't done.
- **Python:** reads `NASA_API_KEY` from `.env` (copy `.env.example`). `.env` is in `.gitignore`.
- **Check on GitHub:** `dev/check_wording.py` also fails if anything that looks like a NASA key is committed.

## Running it locally

```
python3 -m http.server 8000      # from the repository's top folder
```
Then open `http://localhost:8000`. (Opening the HTML files directly doesn't work, because browsers block
JavaScript modules on `file://`.)

## Publishing (GitHub Pages)

Live since Nov 8, 2026: https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/

One-time setting, done on github.com: the repository's **Settings › Pages › Build and deployment**, Source
"Deploy from a branch", Branch **main**, folder **/ (root)**, Save. The site then appears at
`https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/` a minute or two after each push.

## Checks on GitHub

`.github/workflows/checks.yml` runs `dev/check_wording.py` after every push to main:
- no first name on its own (the credit "Malcolm Syme" is fine), no chat narrating its own work;
- no personal paths or user names;
- no NASA API key.

Run it by hand: `python3 dev/check_wording.py`.

`.github/workflows/astronaut-photos.yml` runs once a day (07:41 UTC) and on demand: it fetches the newest astronaut
photos of Earth into `image-explorer/data/astronaut.json` if the secret `EOL_API_KEY` is set, and commits the file if
it changed.

`.github/workflows/asteroid-data.yml` runs twice a day (06:17 UTC, and 14:47 UTC as a backup) and on demand
(Actions › Asteroid data › Run workflow, with "all" to refresh every year): it refreshes the Asteroid Tracker's
close-approach files, every near-Earth object's orbit, the spacecraft positions and the coming passes (`soon.json`)
from JPL, and commits them if they changed. If other work has been pushed meanwhile, it rebases onto it and retries
the push (up to five times).

**Decided Nov 9, 2026 (whole site):** "‹ Back" buttons (`<a class="backlink" id="back">`) are named and wired by
`shared/footer.js` alone. Page code must not add its own click handler to them, or one press goes back two pages;
the Asteroid Tracker's `back.js` only un-hides the map's button.

**Decided Nov 9, 2026 (Asteroid Tracker):** the map pans (right, middle or Shift drag, two fingers, or the ✥ button),
and the wheel and a pinch zoom towards the pointer; a plain drag still turns the view.

**Decided Nov 9, 2026 (Asteroid Tracker):** the orbit diagram marks a close approach at both bodies' positions at that
moment, and Play stops there; its normal speed is 5 days a second (60 was too fast to follow).

**Decided Nov 9, 2026 (Asteroid Tracker):** a backup daily run, after GitHub did not start the 06:17 run that day.
The size comparisons (`compare.js`) replace the earlier "school buses / football fields" phrase everywhere, with one
rule set; the famous passes take their times and distances from NASA/JPL close-approach data in `famous.json` rather
than figures typed into the page; Chelyabinsk (2013) is not a famous pass, because no orbit exists for it (it was not
seen before it entered the atmosphere).

## Writing style

**Decided Nov 8, 2026:** all documentation is written in a professional tone, as project documentation, never in the
tone of an AI assistant talking to a person (no greetings, first-person phrases, sign-offs or exclamation marks;
no addressing the developer; no narrating what a chat did). `dev/check_wording.py` checks for the common phrases.

Documents, commit messages and code comments are neutral, professional project documentation. The developer is
"the developer" (his name and email stay in every credit line); people using the pages are "the user" or "you" in
user-facing text. Decisions are recorded as dated facts ("Decided Nov 8, 2026: …").
