# NASA and ESA Data Projects

**Three ways to learn and explore with real data from NASA and ESA (the European Space Agency) and their APIs.**
Designed by **Malcolm Syme** and built with Claude.

**The site:** https://mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects/

## The projects

| Project | What it is | Data | Status |
|---|---|---|---|
| [**Asteroid Tracker**](asteroid-tracker/) | The near-Earth objects passing Earth this week and every year since 2000, a page and orbit diagram for each, a search, and a turnable map of all 43,000 with the planets and spacecraft | NASA NeoWs; NASA/JPL close-approach data, Small-Body Database, Horizons and Sentry; ESA NEO Coordination Centre (risk lists, close approaches) | **Live** |
| [**Mars Data**](mars-data/) | Weather measured on Mars, cleaned and organised by time and place, with statistics and charts that show its patterns | NASA Planetary Data System (Curiosity's REMS) | Planned |
| [**Image Explorer**](image-explorer/) | The Earth from orbit on any day since 2000, a globe inside the real sky with natural events and astronaut photos, and the picture libraries of NASA and ESA, searchable by subject, mission and date | NASA GIBS, EONET and Image and Video Library; ESA/Webb and ESA/Hubble picture archives | **Live** |

Order of work: Asteroid Tracker (live), then Image Explorer (live), then Mars Data (next); each builds skills the next
one uses.

## How it fits together

```
NASA-ESA-Data-and-API-Projects/
├── index.html          home page linking the three projects
├── about/ privacy/ terms/ credits/ contact/   the site's information pages
├── shared/             the look (theme.css, emblem), the NASA API helper (nasa.js) and the footer links (footer.js)
├── asteroid-tracker/   Project 1
├── image-explorer/     Project 2
├── mars-data/          Project 3 (Python analysis + a charts page)
├── docs/               design guide, data sources, notes, roadmap, history, and the Project Record (record/ builds it)
└── .github/workflows/  checks after every push, the daily data updates, and the Project Record rebuild
```

- **Pages run in the browser,** with no build step: plain HTML, CSS and JavaScript, hosted free on GitHub Pages.
- **One look everywhere:** the Flight Deck Suite's "old money" style (navy, brass and cream, serif type) with a
  night-sky touch. See [docs/DESIGN.md](docs/DESIGN.md).
- **API keys are never committed.** Visitors need no key: the GitHub data jobs copy the data that needs
  one, using keys kept as repository secrets, and the pages use NASA's shared `DEMO_KEY` for anything else. Python scripts read `NASA_API_KEY` from a local `.env` file, which Git ignores.

## Getting started (developers)

1. Get a free NASA API key at **api.nasa.gov** (issued by email).
2. For the Python analysis: copy `.env.example` to `.env` and paste the key in.
3. To try the pages on your own computer, serve the folder (modules don't load from `file://`):
   ```
   python3 -m http.server 8000
   ```
   then open `http://localhost:8000`.

## Documentation

| Document | What's in it |
|---|---|
| [docs/DESIGN.md](docs/DESIGN.md) | Colours, type, components and chart colours |
| [docs/DATA-SOURCES.md](docs/DATA-SOURCES.md) | Every NASA and ESA source used: endpoints, keys, limits, terms and credit lines |
| [docs/PROJECT-NOTES.md](docs/PROJECT-NOTES.md) | How it's built, decisions, how to run and publish |
| [docs/ROADMAP.md](docs/ROADMAP.md) | What's next and every pending to-do |
| [docs/HISTORY.md](docs/HISTORY.md) | How the project came about, in order |
| [Project Record (PDF)](docs/NASA%20and%20ESA%20Data%20Projects%20-%20Project%20Record.pdf) | The whole project as one PDF, rebuilt automatically after every change ([how](docs/record/README.md)) |
| [CHANGELOG.md](CHANGELOG.md) | Every change, newest first |
| [LICENSE.md](LICENSE.md) | The MIT License (the project's own code and documents) |
| [CREDITS.md](CREDITS.md) | Every outside data source and library, with its terms |

---

Data courtesy of NASA and ESA. Imagery from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data
and Information System (ESDIS). An independent project, not endorsed by NASA or ESA.

**NASA and ESA Data Projects** · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
Copyright © 2026 Malcolm Syme. Released under the [MIT License](LICENSE.md); third-party data and libraries keep
their own terms, listed in [CREDITS.md](CREDITS.md).
