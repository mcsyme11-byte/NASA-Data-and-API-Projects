# History

How NASA Data Projects came about, in order.

## November 8, 2026 — the idea and the repository

- The developer planned three learning projects built on NASA's open data and APIs, in one Claude project named
  "NASA Data Projects": an **asteroid tracker** (near-Earth objects sorted by size and distance, with an interactive
  dashboard), a **Mars data** study (cleaning, organising, statistics and charts of mission measurements) and a
  **NASA image explorer** (searching NASA imagery by date, location and mission, starting from GIBS).
- Notes from the first discussion: NeoWs's feed covers at most 7 days per request; some older Mars APIs (such as
  InSight's weather feed) ended with their missions, so archived PDS data is the better source; GIBS is imagery of
  Earth without missions to filter by, so it is paired with the NASA Image and Video Library.
- Decided: one repository, a folder per project; public, for free GitHub Pages hosting and as a portfolio, with no
  API key ever committed.
- The repository was set up with the shared look of the developer's other projects, a NASA API helper, a home page,
  placeholder pages and the documents in `docs/`.

## November 8, 2026 — Asteroid Tracker, version 1

- The plan was confirmed in the project's own chat: hand-drawn SVG charts, the year view from JPL data in version 1,
  and a mock-up first. The mock-up (with made-up data) was approved the same day.
- Checking the live services showed two limits: the JPL close-approach API cannot be called from a web page, and
  NeoWs's rate-limit headers cannot be read by one. The year view therefore reads a file refreshed daily by GitHub
  Actions, and the key settings show the key's limits instead of the requests left.
- The page went live on GitHub Pages with the week view, filters, three graphs, the year view and key settings.

## November 8, 2026 — Asteroid Tracker: each asteroid's page, the orbit diagram, past years

- After version 1 the charts gained "How to read this" notes, and three additions were built the same evening: a
  page for each asteroid, past years in the year view, and an orbit diagram, the one singled out for particular care.
- The orbit maths was checked before the diagram was drawn: Earth's distance from the Sun at perihelion and
  aphelion, and an asteroid's distance from Earth on the day of a close approach, matched NASA's figures.
