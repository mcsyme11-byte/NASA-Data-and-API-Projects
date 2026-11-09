# Instructions for Claude working in this repo

This repository is Malcolm Syme's **NASA Data Projects**: three learning-and-exploring projects built on NASA's open
data and APIs, one folder each:

| Project | Folder | What it is |
|---|---|---|
| **Asteroid Tracker** | `asteroid-tracker/` | Near-Earth objects sorted by size and distance, an interactive dashboard |
| **Mars Data** | `mars-data/` | Mars mission measurements cleaned, organised, analysed and charted |
| **Image Explorer** | `image-explorer/` | NASA imagery searchable by date, location and mission (GIBS + Image Library) |

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
- **Public repository: no secrets, ever.** No API key, password or token in any file. Web pages use `shared/nasa.js`
  (the visitor's key in their browser, `DEMO_KEY` otherwise); Python reads `NASA_API_KEY` from `.env` (ignored by Git).
- **Public-ready by default:** no personal details in code, docs or tests (no PC or user names, personal paths,
  callsigns or family details); use generic wording and made-up test data. **Exception: always keep "Malcolm Syme"
  and mcsyme11@gmail.com as the developer, copyright and contact credit.**
- **Look:** the Flight Deck Suite's "old money" look (navy, brass, cream, serif type), as set out in `docs/DESIGN.md`
  and `shared/theme.css`. New pages and big visual changes start as mock-ups the developer approves.
- **Free to run:** static pages on GitHub Pages and free NASA APIs; no paid services.
- **Site pages (since Nov 9, 2026):** every page loads `shared/footer.js` (the links to About, Privacy, Terms, Credits,
  Contact, the licence and the source code). A new data source or library is added to `CREDITS.md` and the Credits
  page (`credits/index.html`) in the same change; anything new the site stores or sends is added to the Privacy page
  first.
- **Respect NASA's terms:** show "Data courtesy of NASA" and that the project isn't endorsed by NASA; show the GIBS
  acknowledgement wherever GIBS imagery appears; never use NASA's insignia or logotype.
- **Check facts about the data:** confirm endpoints, fields and limits against NASA's current documentation before
  building on them, and record anything new in `docs/DATA-SOURCES.md`.
- Quality bar: correct, professional, tested. Check every page at the widths in DESIGN.md, and its empty, loading and
  error states (no results, NASA out of reach, the demo key used up).
- Keep every pending to-do in `docs/ROADMAP.md`; the developer tests at his own pace.
- Explain things with examples and clear, concise, correct notes. When teaching a method, give a clear set of rules
  saying which formula or step to use in which situation.

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
