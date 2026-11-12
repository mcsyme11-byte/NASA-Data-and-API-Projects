# Project Record

**[`docs/NASA and ESA Data Projects - Project Record.pdf`](../NASA%20and%20ESA%20Data%20Projects%20-%20Project%20Record.pdf)**
is the project's complete record as one PDF: what each project is and how it works, where everything stands, the
roadmap, the history, the change log, the data sources, the design, the decisions and working rules, the site's own
pages, the licence and credits, the full repository history and a glossary.

It is built from this repository, never edited by hand, and **rebuilt automatically on GitHub** (since Nov 11, 2026)
after every push to main: [`.github/workflows/project-record.yml`](../../.github/workflows/project-record.yml) runs
the build below and commits the record on its own ("Project Record rebuilt (automatic)"). Each edition matches the
repository at the commit its cover and Document control name. Chats don't build or commit it themselves; they only
check that the automatic commit arrived after their push. It can also be run by hand: GitHub › Actions › Project
Record › Run workflow.

**Daily data updates are skipped (decided Nov 11, 2026).** Pushes that change only data files
(`asteroid-tracker/data/`, `image-explorer/data/`, `mars-data/data/`), such as the daily asteroid and astronaut-photo
updates, don't start a rebuild: none of those files are in the record, so each rebuild would make the same PDF again.
A push that also changes anything else starts one as usual. The Repository History chapter counts the data updates
instead of listing them.

## Build

The automatic build runs exactly this. To build by hand (only if the automatic run failed), use a clone with full
history: a shallow clone cuts the Repository History chapter short.

```
sh docs/record/build.sh          # writes docs/NASA and ESA Data Projects - Project Record.pdf
```

It is laid out as a Word document in a temporary folder first, then made into the PDF; only the PDF is kept. Needs
python3 (with pypdf and fontTools), node with the npm packages `docx` and `marked`, and LibreOffice (`soffice`).

| File | What it does |
|---|---|
| `build.sh` | Runs everything below, then checks the record for personal details (a personal folder path, any e-mail address but the developer's and NASA's and ESA's own, at nasa.gov and esa.int) and stops if it finds one |
| `build_record.js` | Lays out the document: cover, Document control, Contents, the Parts. The list of repository documents in each Part is `PARTS` at the top |
| `export_extras.py` | The parts that aren't Markdown files: the repository history (without the daily data updates and the record's own rebuilds, which are counted), the site's own pages (About, Privacy, Terms of use, Credits, Contact, from their HTML) and the working rules (from CLAUDE.md) |
| `page_map.py` | Measures which page each Part and chapter starts on (a first build laid out by LibreOffice), for the page numbers in the Contents |
| `fonts.sh` | Build machine only: installs Gelasio, which has Georgia's exact letter widths, so the measured page numbers match Word |
| `front.md` | About this record, the projects at a glance, where things stand, how the work is done (keep "Where things stand" current) |
| `glossary.md` | The glossary |

The build is adapted from the Flight Deck Suite's and Hot Mic's Project Records, which work the same way.

## Everything goes in, every time

Every Markdown and text document in the repository is in the record, except the few left out on purpose below. A
document listed in `PARTS` (`build_record.js`) sits in its own Part. **Any other document goes in by itself**, in
full, in a Part called "Newly added documents", and the build names it in its output ("Newly added documents (not yet
in PARTS): …"). So nothing can be missed, even if a chat forgets the list.

**When adding a document:** add it to the right Part in `PARTS` in the same change, so it doesn't sit in "Newly added
documents".

**Left out on purpose** (`LEFT_OUT` in `build_record.js`): `docs/handoffs/` (working notes between chats),
`docs/CLAUDE-PROJECT-SETUP.md` (the Claude project's set-up), `CLAUDE.md` (its standing rules are in Part Decisions
and Working Rules), the outside libraries' own licence texts and copies (`vendor/`), data files (`data/` folders),
test data and GitHub's settings.

---
© 2026 Malcolm Syme · mcsyme11@gmail.com
