# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)

- [ ] **Turn on GitHub Pages** (one setting, see PROJECT-NOTES › Publishing), so the home page goes live.
- [ ] **Get a personal NASA API key** at api.nasa.gov (free) for testing beyond the demo key's 50 requests a day.
- [ ] **Create the Claude project's chats:** one per project, using the instructions in
      [CLAUDE-PROJECT-SETUP.md](CLAUDE-PROJECT-SETUP.md).
- [ ] Optional: a **Project Record** PDF rebuilt automatically after every push, as in the Flight Deck Suite and Hot Mic.

## 1. Asteroid Tracker (first)

- [ ] Confirm the plan in its own chat (features, chart library).
- [ ] This week's close approaches from NeoWs: a table sorted by size or distance.
- [ ] Miss distance in Moon distances (LD) and km; diameter as a min–max range.
- [ ] Filters: hazardous only, size, distance, date.
- [ ] Graphs: size against miss distance; approaches per day; the week's biggest.
- [ ] Key settings: add or remove your own key; requests left.
- [ ] Longer ranges by joining weeks, or the JPL close-approach API.

## 2. Image Explorer (second)

- [ ] Confirm the plan in its own chat (map library, which GIBS layers to offer first).
- [ ] Earth by date: a GIBS map with a date picker and a few layers (true colour, fires, snow, night lights).
- [ ] A time slider to step day by day.
- [ ] NASA Image Library search: keywords, mission, centre, years; results grid; a full-size view with the caption.
- [ ] The GIBS acknowledgement on the page.

## 3. Mars Data (third)

- [ ] Confirm the dataset in its own chat (REMS MODRDR as the first choice).
- [ ] Download a first batch of sols; look at the files' columns.
- [ ] Cleaning: missing and impossible values, units, gaps marked.
- [ ] Organise by sol, Ls (season) and time of day.
- [ ] Statistics: daily highs and lows, seasonal averages, relationships between measurements.
- [ ] Charts page in the project's look; a short write-up of what the patterns show.
