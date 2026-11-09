# Roadmap

What's next, as of November 8, 2026. Every pending to-do lives here; items are done at the developer's own pace.
Everything finished moves to [CHANGELOG.md](../CHANGELOG.md).

## 0. Repository (set up Nov 8, 2026)

- [ ] **Create the Claude project's chats:** one per project (the project's instructions are in place).
- [ ] Delete the branch `map-data-test` on GitHub (Branches page): it held a one-off test run of the map's data job
  on Nov 9, 2026, and branches cannot be deleted from the build session.
- [ ] Optional: a **Project Record** PDF rebuilt automatically after every push, as in the Flight Deck Suite and Hot Mic.

## 1. Asteroid Tracker (version 1 live Nov 8, 2026)

- [ ] **Developer testing**, at the developer's own pace: the live page with real data on a computer and a phone;
  both views, the filters, sorting, row details, key settings (save and remove the personal key).
- [ ] **Developer testing of the additions:** an asteroid's page (open one from a row's details), the orbit
  diagram (Top / Tilted / Side, drag to turn, Play, the slider, Near Earth, tapping an approach), and past years
  in the "By year" view.
- [ ] Confirm the first daily run of the "Asteroid data" workflow the following morning (a new commit, or "No
  change" in its log).
- [ ] **Developer testing of the map, search and home preview:** dragging, pinching and zooming on a phone and a
  computer; Play at each speed; full screen and leaving it; Find; "Found by the end of" with Watch; "Close to Earth
  in"; the Search tab with "Found in"; the naming guide; the live preview on the home page.
- [ ] Ideas (not decided): the asteroid's page reachable from every row of the "By year" tables (unnumbered objects
  need their id from `neos.json`, a 1.8 MB download that the year view does not otherwise need); a short animation
  of a famous close pass; the map in a Web Worker if playing ever needs more speed on large screens.

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
