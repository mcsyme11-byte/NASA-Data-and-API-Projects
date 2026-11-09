# Change log

## November 9, 2026 — Image Explorer: date changes reload the pictures

- **Fixed:** changing the date (date box, slider, day buttons, Play) did not reload the satellite pictures already on
  the map, so an earlier day could show the newest day's picture. Every layer now reloads for the new date. Found
  while checking the polar views with live imagery.
- Polar views checked with live NASA imagery: the Arctic (Nov 8: polar night over the pole; Aug 15: the whole Arctic
  in daylight with summer fires) and the Antarctic (Nov 8: the continent in spring sunlight, snow layer).
- The polar sea ice layer's colour key is a single swatch ("Sea ice seen that day, daylight only") in place of
  GIBS's large classification legend; the page explains the polar night.

## November 9, 2026 — Asteroid Tracker: data check

- Checked the "Asteroid data" job: the 06:17 UTC scheduled run did not start, so the job was started by hand at
  12:01 UTC. It succeeded: close approaches for 2026 updated (2027 unchanged), the list of near-Earth objects and the
  spacecraft positions rewritten, and the site republished. Parker Solar Probe now has 13,493 positions (every
  6 hours), and its path curves smoothly around the Sun on the map.

## November 9, 2026 — Image Explorer: polar views, natural features, videos, astronaut photos

- **Arctic and Antarctic views** on the Earth map, looking straight down on the poles (GIBS's polar maps, with
  proj4js). Layers a view lacks are greyed out ("World view only"): sea temperature and smoke and dust in both, fires
  around Antarctica; sea ice there comes from the daily MODIS sea-ice layer. Choosing a place far from the pole goes
  back to the world view.
- **Natural features in place search:** 3,978 mountains (with heights), ranges, lakes, rivers, deserts, islands,
  seas, gulfs and bays from Natural Earth (public domain); choosing a lake, range, river or sea shows all of it.
- **Playable videos** in the picture library: Pictures / Pictures and videos / Videos; a play mark on video cards; the
  viewer plays the smallest version NASA offers and links the full-size file.
- **Astronaut photos on the globe** (blue squares): a daily job (`astronaut-photos.yml`, `fetch_astronaut_photos.py`)
  fetches the newest cataloged photos of Earth with their positions from NASA's Gateway to Astronaut Photography of
  Earth; each opens with the photo, its date, what it shows, a link to NASA's page and NASA's credit line. Switched
  off until the free API key is stored as the secret `EOL_API_KEY`.
- **Sky positions checked:** Westerlund 2 moved 0.02°; the Rho Ophiuchi marker moved 1.2°, from the star onto the
  cloud complex named after it.

## November 9, 2026 — Image Explorer version 1

- **Live** at `image-explorer/`, from the approved mock-up; the mock-up files are removed. The home page lists the
  project as live.
- **Globe:** about 1,350 galaxies, nebulae and star clusters (every Messier object, every object with a common name
  and every galaxy to magnitude 12), the 88 constellations drawn as faint lines with their names, 5,044 stars, all
  from files kept in the repository (`image-explorer/data/`, built by `tools/build_sky.py`; d3-celestial, BSD
  licence). Fainter objects are drawn smaller; famous ones are named.
- **Place search:** 32,117 towns of 10,000 people or more and every capital (GeoNames), and countries by name, with
  suggestions after every letter; tapping the map names the nearest town within about 100 km.
- **Picture library:** live from the start, with an empty search box and a prompt.
- Checked at 320–1440 px: no sideways scrolling, no script errors, and the "out of reach" messages when NASA cannot
  be reached.

## November 9, 2026 — Asteroid Tracker: smooth spacecraft paths

- Spacecraft paths on the map are drawn through every sample as smooth curves (centripetal Catmull-Rom) instead of
  a thinned set of straight lines, which looked jagged near the Sun; each spacecraft's dot moves along the same
  curve.
- Parker Solar Probe and Juno, which repeat the same loop many times, show their last year of flight; selecting one
  shows its whole path, drawn brighter.
- Parker Solar Probe is sampled every 6 hours instead of daily (`data/spacecraft.json`), so its turn around the Sun
  is captured: near the Sun it covers about 16 million km a day while passing about 7 million km from it.

## November 9, 2026 — Image Explorer: the Globe tab (mock-up)

- **Globe tab** in the mock-up: NASA's Blue Marble Earth, turned to the current sidereal time, inside the real sky
  (5,044 stars). Pins on the Earth for the natural events NASA EONET reported in the last 30 days; markers in the
  sky for the 110 Messier objects and famous Hubble and Webb targets (galaxies as rings, nebulae as diamonds, star
  clusters as dots). Drag to turn, scroll or pinch to zoom, turn slowly, find by name, show or hide each kind.
  Selecting a sky object shows its facts and NASA's pictures of it; selecting an event opens the Earth map on that
  place and day.
- **Picture library** in the mock-up now searches NASA live, with the centre, year and type filters and Show more.

## November 9, 2026 — Asteroid Tracker: famous close passes, back buttons, smoother zoom

- **Famous close passes** on the map: Apophis (2029), Duende (2013), 2020 QG (2020), 2019 OK (2019) and 2024 YR4
  (2032, with its pass by the Moon). Each flies the map to Earth, plays the pass slowly and pauses at the moment of
  closest approach, with a card of NASA's figures and a short account. Earth, the Moon and the asteroid are placed
  from NASA/JPL Horizons (new monthly file `data/famous.json`); the distances shown match NASA's close-approach data
  to within 16 km.
- **Back buttons:** each asteroid's page, and the map when opened from another page, has a "‹ Back" button naming
  where it returns to. Returning (with that button or the browser's) puts the tracker back on the same week or year,
  filters, sort, open row, search words and scroll position, and the map back on the same view, selection, date and
  filters.
- NASA's answers are kept for an hour in the browser tab, so going back or reloading spends no extra requests.
- **"By year" tables:** every name now opens that asteroid's own page (ids from `data/neos.json`, loaded in the
  background); comets open JPL's page.
- **Map:** zooming in goes down to Earth's true size; Earth, the Sun and the planets are drawn at true size when
  large enough; the Moon's orbit appears near Earth; the scale bar switches to km close in. A **live clock**: on
  today's date the map follows the present moment.
- **Smoother:** the orbit maths runs in a background thread (Web Worker), and lines are cut to the visible area, so
  zooming in close and playing stays at 60 frames a second (slow frames when playing zoomed in fell from about a
  third to under 2%).
- **Layout:** full-screen and exit-full-screen buttons now look different (with an "Exit" label); the spacecraft list
  is a full-width card under the map instead of a tall side column; the "Found by" and "Close to Earth in" controls
  stack on tablets instead of overlapping; a selected asteroid's label no longer touches its ring; starting a famous
  pass scrolls the whole map into view.

## November 9, 2026 — Image Explorer: data checks and a mock-up for review

- GIBS and the NASA Image and Video Library checked with live requests from the published site; findings recorded
  in `docs/DATA-SOURCES.md` (the fire layers work only in the `epsg4326` projection; the library allows 10,000
  results per search; dates and missing picture sizes explained).
- Plan recorded in `docs/PROJECT-NOTES.md`: OpenLayers, eight layers, two tabs, place search, Arctic and Antarctic
  views.
- **Mock-up** (`image-explorer/mockup.html`): a live map of NASA imagery with the eight layers, date controls, a
  day-by-day slider and Play, sample place search, tapping the map, and the picture library with a fixed sample of
  real results and the picture viewer.

## November 9, 2026 — Asteroid Tracker: solar system map, search, home preview, names explained

- **Solar System Map** (`asteroid-tracker/map.html`): all 43,186 known near-Earth objects (asteroids and 209 comets)
  coloured by orbit type, the eight planets and eleven spacecraft (from Parker Solar Probe to the Voyagers, with the
  paths they have flown), at any date from 1900 to 2050. Drag to turn, scroll or pinch to zoom, keyboard controls;
  Top, Tilted and Side views; zoom presets from Mars to the Voyagers; centre on the Sun, Earth or a selection; Play
  at four speeds; Find; filters (potentially hazardous, over 140 m, over 1 km); this week's visitors ringed; full
  screen, with a separate exit button and a fallback for phones that cannot make part of a page full screen.
- **Found by the end of:** a discovery timeline from 1960 to today, with "Watch the discoveries"; the objects found
  in the year shown shine white. **Close to Earth in:** only the asteroids that passed within 10 LD in a chosen year.
- **Search tab:** instant results with every letter over every near-Earth object, a "Found in" filter (a year or a
  decade, biggest first), cards with an orbit sketch, size, orbit type and a link to the map; typed codes are
  decoded as they are typed.
- **How asteroid names work:** a guide in the Search tab, and each name decoded on search cards, the map and each
  asteroid's page (for example "2004 MN4: found June 16–30, 2004, the 113th new small body given a code in that
  half-month").
- **Home page:** a live preview of the map (the 2,552 potentially hazardous asteroids and the inner planets),
  pausing when off screen and still for people who prefer reduced motion; it opens the map.
- **Tabs** across the Asteroid Tracker (This week · By year · Map · Search), also on each asteroid's page, which
  gains "Show on the solar system map".
- New daily data: `fetch_map_data.py` writes `data/neos.json`, `data/preview.json` and `data/spacecraft.json`.
- Layout checked on every page at 320–1440 px; fixes at small widths.

## November 8, 2026 — Asteroid Tracker: tidier notes and layout

- "How to read this" notes are now closed by default and open with a tap.
- Layout fixes found in a check of every page at 320 to 1440 px: the "Open its page" button no longer breaks onto
  two lines; the week bar keeps its dates on one or two neat lines on phones (and reads "Nov 8–14, 2026"); the
  orbit diagram's time buttons fit on one line at 320 px; the legend lines up on small screens.
- Turning the orbit diagram redraws at most once per screen refresh, so dragging stays smooth.

## November 8, 2026 — Asteroid Tracker: each asteroid's page, the orbit diagram, past years

- **A page for each asteroid** (`object.html?id=…`, 1 NASA request): size, length of its year, distance from the Sun,
  orbit tilt and the closest its orbit comes to Earth's; every close approach to Earth from 1900 to 2200 on a chart
  and in a list; facts about how its orbit was worked out. Opened from a row's details in the week view, and from
  numbered asteroids in the year tables.
- **The orbit diagram:** the Sun, Mercury to Mars (and Jupiter for far-reaching orbits) and the asteroid, drawn to
  scale and placed at any date from 1900 to 2050. Top, Tilted and Side views, drag to turn, zoom, and "Near Earth"
  (the path past Earth over ±120 days, with the Moon's orbit for scale). Play, step by day or month, a two-year
  slider, today and the next close approach. Readings for the date: distance from Earth and the Sun, speed around
  the Sun, height above Earth's orbital plane; NASA's official figures beside the diagram's at a close approach,
  and a plain statement of how exact the drawing is for the date shown.
- **Past years:** the year view ("By year") covers 2000 to next year, with a year picker, links such as
  `#year-2012`, tiles suited to past, current and next year, and a chart of the approaches found each year.
- The daily data job now writes one file per year plus an index (`data/years.json`).
- Checked with real data after publishing: for Apophis's December 2027 pass the diagram gives 114.5 LD against
  NASA's 114.22 LD. In the "Near Earth" view the time ticks follow the asteroid's speed (hourly for a fast close
  pass such as Apophis's on April 13, 2029, every few days for a slow distant one). For passes closer than the Moon
  the page notes that Earth's own pull, left out of the diagram, bends the path.

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
