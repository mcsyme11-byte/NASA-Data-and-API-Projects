# Change log

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

- **GitHub Pages switched on:** the home page is at https://mcsyme11-byte.github.io/NASA-Data-and-API-Projects/
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
