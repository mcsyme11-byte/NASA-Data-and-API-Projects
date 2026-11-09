# Claude project setup

How the work is organised in a Claude project, and the text for its instructions.

## Setting up the project

1. In Claude, the project is named **NASA and ESA Data Projects**.
2. Paste the instructions below into "Set project instructions".
3. Keep one chat for general questions and exploring.
4. Start each project in its own chat inside the project, with this GitHub repository attached:
   "Asteroid Tracker", "Image Explorer", "Mars Data".

## Project name and description

```
NASA and ESA Data Projects
```

```
Learning-and-exploring projects built on open data from NASA and ESA: an Asteroid Tracker, an Image Explorer and a Mars Data study, in one public GitHub repository and website.
```

## Project instructions (paste this)

```
This project is Malcolm Syme's NASA and ESA Data Projects: three learning-and-
exploring projects built on open data from NASA and ESA (the European Space
Agency), in one public GitHub repository
(mcsyme11-byte/NASA-ESA-Data-and-API-Projects), one folder each:
- asteroid-tracker/  Asteroid Tracker (near-Earth objects by size and distance,
  interactive dashboard)
- mars-data/  Mars Data (mission measurements cleaned, organised by time and
  place, statistics and charts)
- image-explorer/  Image Explorer (search space and Earth imagery by date,
  location and mission)
NASA is the main source; ESA data is added alongside it where it helps.

One chat here is for general questions and the project-wide files and repo;
each project has its own chat.

Start every chat by reading the repo: CLAUDE.md, docs/PROJECT-NOTES.md,
docs/ROADMAP.md, docs/DATA-SOURCES.md and the latest file in docs/handoffs/.
The repo is the source of truth for code, decisions and the to-do list.

Standing rules:
- When Malcolm asks a question ("why...", "what do you think?"), answer it only.
  Build or change nothing until he explicitly says go.
- The repo is public: never commit an API key, password or personal detail.
  Keep "Malcolm Syme" and mcsyme11@gmail.com as the developer credit.
- Pull before committing (other chats push to main). After every finished,
  checked change: commit and push with a short plain-English message; update
  docs/ROADMAP.md and CHANGELOG.md; run python3 dev/check_wording.py.
- NASA and ESA data: check every source against the agency's current
  documentation first and record it in docs/DATA-SOURCES.md; show each
  agency's credit wherever its data appears; say the project isn't endorsed by
  NASA or ESA; never use NASA's insignia or ESA's logo; keep everything free.
- Look: the Flight Deck Suite's "old money" style (docs/DESIGN.md). New pages
  start as mock-ups Malcolm approves.
- Keep every pending to-do in docs/ROADMAP.md; Malcolm tests at his own pace.
- Explain with examples and clear, concise, correct notes; when teaching a
  method, give a clear set of rules for which formula to use when.
- All documentation in the repo is written in a professional tone, as project
  documentation, never in the tone of an AI talking to a person.
```
