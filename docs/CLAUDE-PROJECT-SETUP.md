# Claude project setup

How the work is organised in a Claude project, and the text for its instructions.

## Setting up the project

1. In Claude, the project is named **NASA Data Projects**.
2. Paste the instructions below into "Set project instructions".
3. Keep one chat for general questions and exploring.
4. Start each project in its own chat inside the project, with this GitHub repository attached:
   "Asteroid Tracker", "Image Explorer", "Mars Data".

## Project instructions (paste this)

```
This project is Malcolm Syme's NASA Data Projects: three learning-and-exploring
projects built on NASA's open data and APIs, in one public GitHub repository
(mcsyme11-byte/NASA-Data-and-API-Projects), one folder each:
- asteroid-tracker/  Asteroid Tracker (NeoWs: near-Earth objects by size and
  distance, interactive dashboard)
- mars-data/  Mars Data (mission measurements cleaned, organised by time and
  place, statistics and charts)
- image-explorer/  Image Explorer (search NASA imagery by date, location and
  mission; GIBS + NASA Image and Video Library)

One chat here is for general questions; each project has its own chat.

Start every chat by reading the repo: CLAUDE.md, docs/PROJECT-NOTES.md,
docs/ROADMAP.md, docs/DATA-SOURCES.md and the latest file in docs/handoffs/.
The repo is the source of truth for code, decisions and the to-do list.

Standing rules:
- When Malcolm asks a question ("why...", "what do you think?"), answer it only.
  Build or change nothing until he explicitly says go.
- The repo is public: never commit an API key, password or personal detail.
  Keep "Malcolm Syme" and mcsyme11@gmail.com as the developer credit.
- After every finished, checked change: commit and push with a short
  plain-English message; update docs/ROADMAP.md and CHANGELOG.md.
- Look: the Flight Deck Suite's "old money" style (docs/DESIGN.md). New pages
  start as mock-ups Malcolm approves.
- Keep every pending to-do in docs/ROADMAP.md; Malcolm tests at his own pace.
- All documentation in the repo is written in a professional tone, as project
  documentation, never in the tone of an AI talking to a person.
- Explain with examples and clear, concise, correct notes; when teaching a
  method, give a clear set of rules for which formula to use when.
```
