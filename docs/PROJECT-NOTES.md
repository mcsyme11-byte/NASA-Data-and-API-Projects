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

## How it's built (starting plan; each project's chat confirms it)

| Part | Built with | Why |
|---|---|---|
| Web pages | Plain HTML, CSS and JavaScript modules, no build step | Free hosting on GitHub Pages; easy to read and learn from |
| Charts | Hand-drawn SVG, styled to DESIGN.md (Asteroid Tracker); chosen per project | No library to load; matches the look exactly |
| Maps (Image Explorer) | A web map library (for example Leaflet or OpenLayers) showing GIBS tiles | GIBS serves standard map tiles |
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
workflow): it refreshes the Asteroid Tracker's year of close approaches from JPL and commits the file if it changed.

## Writing style

**Decided Nov 8, 2026:** all documentation is written in a professional tone, as project documentation, never in the
tone of an AI assistant talking to a person (no greetings, first-person phrases, sign-offs or exclamation marks;
no addressing the developer; no narrating what a chat did). `dev/check_wording.py` checks for the common phrases.

Documents, commit messages and code comments are neutral, professional project documentation. The developer is
"the developer" (his name and email stay in every credit line); people using the pages are "the user" or "you" in
user-facing text. Decisions are recorded as dated facts ("Decided Nov 8, 2026: …").
