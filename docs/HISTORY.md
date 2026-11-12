# History

How NASA and ESA Data Projects came about, in order.

## November 8, 2026 — the idea and the repository

- The developer planned three learning projects built on NASA's open data and APIs, in one Claude project named
  "NASA and ESA Data Projects": an **asteroid tracker** (near-Earth objects sorted by size and distance, with an interactive
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

## November 9, 2026 — famous close passes and going back

- The developer reported choppy frames when zoomed in close, a poorly laid-out spacecraft list, identical full-screen
  and exit icons, and the lack of a way back to the exact spot on the previous page; he also asked whether the map
  shows Earth where it is right now. All were addressed, together with three approved ideas: links for every name
  in the "By year" tables, famous close passes, and a background thread for the orbit maths.
- The zoomed-in slowness came from lines that ran far off screen: the browser still worked out every dash of them.
  Cutting each line to the visible area removed it.
- Two-body orbits cannot show a famous pass correctly, because Earth's pull bends the asteroid's path during the
  pass. Precise positions from NASA/JPL Horizons are used for those passes instead.

## November 8–9, 2026 — the solar system map

- The developer asked for a map of all the asteroids around the Sun that could be turned smoothly and seen from
  different vantage points, with spacecraft such as the Voyagers, plus a search with results after every letter.
  A mock-up with made-up asteroids was approved; the developer then asked for a guide to asteroid names, year
  filters and a fix to the full-screen button, built directly.
- Smoothness was measured throughout. Two changes made playing reach 60 frames a second: each object's orbit is
  solved starting from the previous frame, and the dots are drawn at 1.5× resolution rather than 2×.
- The real data showed that NASA's list of near-Earth objects includes about 200 comets (Halley among them), which
  became their own colour on the map.

## November 9, 2026 — Image Explorer, version 1

- The plan was confirmed in the project's own chat (OpenLayers, eight GIBS layers, tabs, place search), and the
  live services were checked first. The fire layers turned out to work only in the `epsg4326` projection, which set
  the map's projection.
- The first mock-up showed the daily satellite map. The developer found it disappointing (the gaps between
  satellite passes, no detail down to houses) and asked for a globe like the solar system map, with pictures pinned
  to places on Earth and to galaxies in the sky; the daily map was kept for following fires and storms.
- NASA's event feed holds over 7,000 "open" events, most with no report in months; the globe shows those reported in
  the last 30 days, about 35.
- The globe mock-up was approved the same night and published with about 1,350 sky objects.

## November 9, 2026 — Image Explorer: five additions overnight

- The developer asked for five additions and went to bed. NASA, SIMBAD and the astronaut photo site cannot be reached
  from the build session, so a temporary GitHub Actions job on a separate branch checked them and committed what it
  found; Natural Earth was downloaded directly.
- The check of the hand-listed sky positions found one real mistake: the Rho Ophiuchi marker sat on the star, not on
  the cloud complex named after it.
- The astronaut photo site turned out to have a documented API that needs a free key, requested by email. The daily
  job was built to start working as soon as the key is stored as a GitHub secret.

## November 9, 2026 — NASA and ESA

- The project became **NASA and ESA Data Projects**: ESA (the European Space Agency) data is added alongside NASA's
  where it helps, with NASA as the main source. The repository was renamed NASA-ESA-Data-and-API-Projects, and the site
  moved to https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/.
- Project-wide rules for ESA sources were added (check ESA's documentation first, credit ESA wherever its data appears,
  never ESA's logo, free to run), and every page now says the project isn't endorsed by NASA or ESA.

## November 9, 2026 — ESA's data in the Asteroid Tracker

- The Asteroid Tracker became the first project to show ESA's data beside NASA's: the impact-risk lists of ESA's NEO
  Coordination Centre and NASA/JPL's Sentry, side by side in a new Impact risk tab, on each asteroid's page and on the
  map. Neither centre's server answers web pages directly, so the twice-daily data job copies both lists.
- The first run showed a speed given as "nan", which made the file unreadable in a browser; the job now keeps only
  finite numbers.

## November 11, 2026 — Project Record

- The project gained a Project Record: the whole project as one PDF, rebuilt by GitHub after every change except the
  daily data updates, in the same way as the developer's other projects.

## November 12, 2026 — No key needed for visitors

- The Asteroid Tracker's "This week" list and asteroid pages had relied on each visitor's NASA key, or NASA's shared
  demo key (30 requests an hour and 50 a day per connection). The daily data job now copies that data with the
  developer's key, kept as a GitHub secret, so the site works for every visitor without a key.

## November 11–12, 2026 — Mars Data, version 1

- Mars Data was planned around Curiosity's weather station (REMS), with Perseverance (MEDA) and ESA's Mars Express
  to follow, and the whole record from sol 1, cleaned slowly and in chunks. The archives turned out to be reachable
  only from GitHub's servers, so the work ran there, on a separate branch, with a cleaning report for every chunk.
- Careful checking caught several traps: a column named "solar longitude" that is the Sun's direction from the rover,
  not the season; NASA's index stopping at sol 4133 while the data reaches sol 4843; two tables in one ancillary file;
  quality flags whose first character is not a quality check at all.
- The developer approved the mock-up the same night, and the page went live with Mars Years 31–33 (sols 1–1293).

## November 12, 2026 — Sky Finder and the spacecraft map

- The developer proposed a phone app that points the camera at a passing asteroid and a page of the passes visible
  from the visitor's place, then a map of everything humans have sent into space that is still working. Mock-ups were
  approved with changes (more realistic icons, a plainer banner, facts checked line by line, the phone experience
  first) and both were built and published together: the "Visible from here" tab, **Sky Finder** and the
  **spacecraft map**, which took over the home page's large panel.

