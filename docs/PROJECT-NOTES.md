# Project notes

How NASA Data Projects is built, the decisions made so far, and how to run and publish it.

## Decisions

- **Decided Nov 8, 2026:** three projects in one repository, each in its own folder (a "stream"):
  `asteroid-tracker/`, `mars-data/`, `image-explorer/`. Shared code and the look live in `shared/`.
- **Decided Nov 8, 2026:** the repository is **public**, so the pages can be hosted free on GitHub Pages and shown
  as a portfolio. Rule that follows: no API key, password or personal detail is ever committed.
- **Decided Nov 8, 2026:** the look follows the Flight Deck Suite and Hot Mic ("old money": navy, brass, cream,
  serif type), see [DESIGN.md](DESIGN.md).
- **Suggested order (Nov 8, 2026):** Asteroid Tracker, then Image Explorer, then Mars Data.
- **Each project is built in its own chat** inside the Claude project "NASA Data Projects"; a general chat is for
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

## How it's built (starting plan; each project's chat confirms it)

| Part | Built with | Why |
|---|---|---|
| Web pages | Plain HTML, CSS and JavaScript modules, no build step | Free hosting on GitHub Pages; easy to read and learn from |
| Charts | Hand-drawn SVG, styled to DESIGN.md (Asteroid Tracker); chosen per project | No library to load; matches the look exactly |
| Maps (Image Explorer) | OpenLayers 10 (BSD licence, from a CDN), `epsg4326` and the two polar projections | Handles GIBS's tile grids, vector fire tiles and polar views; Leaflet does not without add-ons |
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

Live since Nov 8, 2026: https://mcsyme11-byte.github.io/NASA-Data-and-API-Projects/

One-time setting, done on github.com: the repository's **Settings › Pages › Build and deployment**, Source
"Deploy from a branch", Branch **main**, folder **/ (root)**, Save. The site then appears at
`https://mcsyme11-byte.github.io/NASA-Data-and-API-Projects/` a minute or two after each push.

## Checks on GitHub

`.github/workflows/checks.yml` runs `dev/check_wording.py` after every push to main:
- no first name on its own (the credit "Malcolm Syme" is fine), no chat narrating its own work;
- no personal paths or user names;
- no NASA API key.

Run it by hand: `python3 dev/check_wording.py`.

`.github/workflows/asteroid-data.yml` runs once a day (06:17 UTC) and on demand (Actions › Asteroid data › Run
workflow, with "all" to refresh every year): it refreshes the Asteroid Tracker's close-approach files, every
near-Earth object's orbit and the spacecraft positions from JPL, and commits them if they changed.

## Writing style

**Decided Nov 8, 2026:** all documentation is written in a professional tone, as project documentation, never in the
tone of an AI assistant talking to a person (no greetings, first-person phrases, sign-offs or exclamation marks;
no addressing the developer; no narrating what a chat did). `dev/check_wording.py` checks for the common phrases.

Documents, commit messages and code comments are neutral, professional project documentation. The developer is
"the developer" (his name and email stay in every credit line); people using the pages are "the user" or "you" in
user-facing text. Decisions are recorded as dated facts ("Decided Nov 8, 2026: …").
