# Instructions for Claude working in this repo

This repository is Malcolm Syme's **NASA and ESA Data Projects**: three learning-and-exploring projects built on the open data
and APIs of NASA and ESA (the European Space Agency), one folder each:

| Project | Folder | What it is |
|---|---|---|
| **Asteroid Tracker** | `asteroid-tracker/` | Near-Earth objects sorted by size and distance, an interactive dashboard (NASA/JPL and ESA NEOCC) |
| **Mars Data** | `mars-data/` | Mars mission measurements cleaned, organised, analysed and charted |
| **Image Explorer** | `image-explorer/` | Imagery searchable by date, location and mission (NASA GIBS + Image Library, ESA/Webb + ESA/Hubble) |

Utilities alongside them (since Nov 12, 2026): **Sky Finder** (`sky-finder/`, an installable phone web app that points
to passing asteroids) and the **spacecraft map** (`spacecraft/`, previewed on the home page; data job
`spacecraft-data.yml`; facts in `spacecraft/catalogue.json`, checked by hand).

Shared code and the look are in `shared/`; documents in `docs/`. It is separate from the Flight Deck Suite and Hot Mic
(their own repositories), but shares their look.

**Start every new chat here:** read `docs/PROJECT-NOTES.md` (decisions, how it's built), `docs/ROADMAP.md` (what's
next and every pending to-do), `docs/DATA-SOURCES.md` (APIs, keys, limits) and the latest file in `docs/handoffs/`, if
any (its confirmed answers at the top override older notes). Work on one project at a time, in that project's chat,
inside its own folder.

## Standing rules

- When the developer asks a question ("why…", "what do you think?"), answer it only. Build or change nothing until he
  explicitly says go.
- **After every change that's finished and checked,** commit and push it to `main` with a short plain-English commit
  message, and update `docs/ROADMAP.md` (remove what's done), `CHANGELOG.md` and, for milestones, `docs/HISTORY.md`.
- **Public repository: no secrets, ever.** No API key, password or token in any file. Visitors need no key: data that
  needs one is copied by the GitHub data jobs with repository secrets (`NASA_API_KEY`, `EOL_API_KEY`); web pages call
  NASA only through `shared/nasa.js` with `DEMO_KEY`; Python run by hand reads `NASA_API_KEY` from `.env` (ignored by
  Git).
- **Public-ready by default:** no personal details in code, docs or tests (no PC or user names, personal paths,
  callsigns or family details); use generic wording and made-up test data. **Exception: always keep "Malcolm Syme"
  and mcsyme11@gmail.com as the developer, copyright and contact credit.**
- **Look:** the Flight Deck Suite's "old money" look (navy, brass, cream, serif type), as set out in `docs/DESIGN.md`
  and `shared/theme.css`. New pages and big visual changes start as mock-ups the developer approves.
- **Free to run:** static pages on GitHub Pages and free NASA APIs; no paid services.
- **Site pages (since Nov 9, 2026):** every page loads `shared/footer.js` (the links to About, Legal, Contact and the
  source code; since Nov 12, 2026 the footer is one row of those links with the copyright, then one short credit
  line, and Privacy, Terms, Credits and the licence are reached through the Legal page, `legal/`). Each page's
  detailed data credits sit above the footer in `<p class="srcline">` lines, never in the footer. A new data source or library is added to `CREDITS.md` and the Credits
  page (`credits/index.html`) in the same change; anything new the site stores or sends is added to the Privacy page
  first.
- **Version tags on style files (since Nov 9, 2026; project style sheets since Nov 12):** pages link
  `shared/theme.css`, `shared/footer.js`, `asteroid-tracker/tracker.css` and `image-explorer/explorer.css` with a
  version tag (`?v=YYYYMMDDNN`). After changing any of them, raise the tag in every page (one search-and-replace), so
  browsers fetch the new copy instead of an old saved one.
- **Feel (since Nov 12, 2026):** everything pressable gives quick feedback (the shared hover and press transitions in
  `shared/theme.css`); tap targets are at least 40 px tall on phones; rows of tabs or chips that don't fit a phone
  scroll sideways with a soft edge fade (the Asteroid Tracker's tabs wrap instead, decided Nov 12, 2026) (`shared/footer.js` adds it to `.tabs`, `.popular`, `.gbar .seg` and anything
  marked `data-hscroll`); labels drawn over maps and diagrams get a dark outline; placeholders fit a 375 px phone; every page except the
  site's home page has a Back button (`.backlink#back`).
- **ESA data (decided Nov 9, 2026):** ESA's data is added alongside NASA's where it helps; NASA stays the main source,
  and pages say which agency each number or picture comes from. For every ESA source:
  - check it against ESA's current documentation before building on it (address, format, limits, terms, credit), and
    record it in `docs/DATA-SOURCES.md` (ESA section) with its exact credit line;
  - show ESA's credit wherever its data or pictures appear, in ESA's own form (for example "ESA/DLR/FU Berlin, CC BY-SA
    3.0 IGO", with a link to the licence where one applies), and add the source to `CREDITS.md` and the Credits page
    in the same change;
  - use only material ESA allows: works released under CC BY-SA 3.0 IGO, or ESA's terms for educational and
    informational use; never ESA's logo (it needs ESA's written permission);
  - keep it free to run: no paid ESA services; a free account or key follows the same no-secrets rule as NASA's;
  - if visitors' browsers contact an ESA service directly, add it to the Privacy page first.
- **Respect NASA's and ESA's terms:** show "Data courtesy of NASA" (and ESA where its data is used) and that the
  project isn't endorsed by NASA or ESA; show the GIBS
  acknowledgement wherever GIBS imagery appears; never use NASA's insignia or logotype, or ESA's logo.
- **Check facts about the data:** confirm endpoints, fields and limits against NASA's current documentation before
  building on them, and record anything new in `docs/DATA-SOURCES.md`.
- Quality bar: correct, professional, tested. Check every page at the widths in DESIGN.md, and its empty, loading and
  error states (no results, NASA out of reach, the demo key used up).
- Keep every pending to-do in `docs/ROADMAP.md`; the developer tests at his own pace.
- Explain things with examples and clear, concise, correct notes. When teaching a method, give a clear set of rules
  saying which formula or step to use in which situation.

## Project Record (since Nov 11, 2026)

`docs/NASA and ESA Data Projects - Project Record.pdf` is the whole project as one PDF, built from the repository by
`docs/record/` (see its README). **GitHub rebuilds it automatically** (`.github/workflows/project-record.yml`) after
every push to main and commits it as "Project Record rebuilt (automatic)". Pushes that change only data files
(`asteroid-tracker/data/`, `image-explorer/data/`, `mars-data/data/`: the daily data updates) don't start a rebuild.
So: **never build or commit the PDF yourself** (two builds at once clash). Pull and rebase before every push, since
the automatic commit lands on main. After pushing, check a few minutes later that the automatic commit arrived
(`git fetch` and `git log -1 origin/main`); only if the run failed, fix the cause. **Everything goes in:** every
Markdown or text document in the repository is in the record; one not yet listed in `PARTS`
(`docs/record/build_record.js`) lands in a "Newly added documents" Part by itself. When you add a document, add it to
its proper Part in `PARTS` in the same change. Keep "Where things stand" in `docs/record/front.md` current.

## Protected main branch (since Nov 10, 2026)

`main` has a ruleset that blocks force pushes and its deletion. Pull and rebase before pushing; never force-push. To
undo a change, make a new commit (`git revert <commit>`).

## Writing style

**Rule (decided Nov 8, 2026): all documentation is written in a professional tone, as project documentation, never
in the tone of an AI assistant talking to a person.** No greetings, no "I'll", "we'll", "let's", "happy to", "great
question" or exclamation marks; no addressing the developer; no narrating what a chat did. State facts, decisions,
steps and limits plainly.

Documents, commit messages and code comments are neutral, professional project documentation, not conversation:
"the developer" for Malcolm Syme (his full name and email stay in every credit line), "the user" or "you" in text for
people using the pages. Record decisions as dated facts ("Decided Nov 8, 2026: …"), and describe work by what was
done, not by who in a chat did it. `python3 dev/check_wording.py` checks this, and GitHub runs it after every push.

## Running

```
python3 -m http.server 8000     # then open http://localhost:8000
python3 dev/check_wording.py    # wording, personal details and keys
```
