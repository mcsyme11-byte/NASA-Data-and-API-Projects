# About this record

This is the complete record of **NASA and ESA Data Projects**, Malcolm Syme's three learning-and-exploring projects built on the open data of NASA and ESA (the European Space Agency): what each project is and how it works, where everything stands, what is planned, every change so far, the data sources and their terms, the design, the decisions and working rules, the site's own pages, the licence and credits, and the repository's full history.

It is built from the project's public GitHub repository (mcsyme11-byte/NASA-ESA-Data-and-API-Projects) and rebuilt automatically after every change, so it matches the repository at the commit named on its cover and on the Document control page. The one exception is the daily data updates: automatic commits that only refresh data files (the asteroid data, the astronaut photos and similar). None of those files are in this record, so they don't start a rebuild, and the Repository History counts them instead of listing them. Each chapter names the repository file it comes from; links lead to that file on GitHub.

| | |
|---|---|
| **Developer** | Malcolm Syme · mcsyme11@gmail.com |
| **Built with** | Claude (Anthropic) |
| **Repository** | github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects (public) |
| **The site** | mcsyme11-byte.github.io/NASA-ESA-Data-and-API-Projects |
| **Licence** | MIT License (the project's own code and documents); outside data and libraries keep their own terms |
| **Edition** | see the cover and Document control |

# The projects at a glance

| Project | What it does | Data | Where it stands |
|---|---|---|---|
| **Asteroid Tracker** | The near-Earth objects passing Earth this week and every year since 2000, sorted by size and distance (also in Moon distances), a page and orbit diagram for each, a search, and a map of all of them with the planets and spacecraft; impact-risk lists from NASA/JPL and ESA side by side | NASA NeoWs; NASA/JPL close-approach data, Small-Body Database, Horizons and Sentry; ESA NEO Coordination Centre | Live since November 8, 2026; its data is refreshed daily |
| **Image Explorer** | The Earth from orbit on any day since 2000, a globe inside the real sky with natural events and astronaut photos, and the picture libraries of NASA, ESA/Webb and ESA/Hubble, searchable by subject, mission and date | NASA GIBS, EONET, Image and Video Library and astronaut photography; ESA/Webb and ESA/Hubble | Live since November 9, 2026 |
| **Mars Data** | Weather measured on the surface of Mars, cleaned, organised by sol, season and time of day, with statistics and charts that show the patterns of a Martian year | NASA Planetary Data System (Curiosity's REMS first), ESA where it helps | Planned; started in its own chat on November 11, 2026 |

# Where things stand

- **Live:** the Asteroid Tracker (with its "Visible from here" tab), the Image Explorer, Mars Data (Curiosity's weather, since November 12, 2026), Sky Finder (a phone app for finding passing asteroids, since November 12, 2026) and the spacecraft map (since November 12, 2026), on the site, with the site's information pages (About, Privacy, Terms of use, Credits, Contact), linked from every page's footer.
- **NASA and ESA:** since November 9, 2026 ESA's data is added alongside NASA's where it helps; NASA stays the main source. Every page credits its sources and says the project isn't endorsed by NASA or ESA.
- **Keys:** visitors need no key. Since November 12, 2026 the Asteroid Tracker's daily data job copies the NASA data that needs one, using the developer's key kept as a GitHub repository secret (`NASA_API_KEY`), never in the code.
- **Waiting:** the astronaut photos on the globe wait for a key from NASA's astronaut photography service, kept as a GitHub repository secret, never in the code.
- **Next:** the developer's testing of the November 12, 2026 additions, and Mars Data's next steps, as listed in the roadmap.
- **The repository:** public, with `main` protected against force pushes and deletion; GitHub checks every push for wording, personal details and keys, and rebuilds this record.

# How the work is done

- **The developer decides:** what is built and when. Questions are answered without building anything until the developer explicitly says go; new pages start as mock-ups the developer approves.
- **Real data, checked first:** every source is checked against NASA's or ESA's current documentation before anything is built on it, recorded in the data-source notes, and credited wherever its data appears.
- **Free to run:** static pages on GitHub Pages, free NASA and ESA services, no paid services, no keys in the code.
- **Tested before it goes live:** every page is checked at phone, tablet and computer widths, with its empty, loading and error states.
- **Every change is recorded:** each finished change is pushed with its roadmap and change-log entries, and this record is rebuilt.
- **Public-ready:** no personal details anywhere, except the developer credit: © 2026 Malcolm Syme · mcsyme11@gmail.com.
