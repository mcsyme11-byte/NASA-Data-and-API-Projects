# Change log

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
