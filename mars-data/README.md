# Mars Data

**Project 3 of NASA and ESA Data Projects.** Status: **live**, with the whole released Curiosity record (sols
1–4843, August 2012 to March 2026). Automatic updates for new NASA releases are planned.

The weather on Mars as measured by NASA's Curiosity rover at Gale Crater since August 2012: the measurements cleaned,
organised by season, time of day and the rover's height, summarised, and charted.

## The pages

- **`index.html`, the project's home page:** what the project is and why it exists, the data used and from which
  agency, what can be done with it and how, and a card linking to each part.
- **`charts/index.html`, the charts,** in the project's look (`docs/DESIGN.md`), drawn as hand-made SVG from
  `data/summary.json`, `data/meda.json` and, for one sol at a time, `data/hourly/MY<n>.json`. Each section has an
  address of its own (`charts/#year`, `#craters`, `#sol`, `#mission`), reached from a section menu that stays at the
  top of the screen:

- **The Martian year:** air pressure through the year, one line per Mars Year, with a correction for the rover's
  climb; how much the pressure swings in a day; humidity at night (preliminary, as NASA marks it); midday
  ultraviolet; average air temperature by season and local hour.
- **Two craters:** air pressure at Gale Crater (Curiosity) and Jezero Crater (Perseverance) through the same seasons.
- **One sol:** air and ground temperature and pressure hour by hour, for any sol with data.
- **The whole mission:** daily highs and lows of air temperature; the rover's height above its landing site.

## How the data is made

The page `method/` sets out the same steps and every cleaning rule in plain words, with an example for each; it
follows `analysis/CLEANING.md` and `analysis/CLEANING-MEDA.md` and is updated with them.

| Step | What happens | Where |
|---|---|---|
| Download | One MODRDR and one ADR file per sol from NASA's Planetary Data System (Atmospheres Node), in chunks of about 90–130 sols; the corrected UV files, 100 sols each | `analysis/run_rems.py`, `analysis/run_uv.py` |
| Clean | The rules in `analysis/CLEANING.md`: NASA's quality flags read character by character, physical limits, missing-value codes; every removal counted | `analysis/rems.py` |
| Organise | Sol, Ls (season) and Mars Year (`analysis/mars_time.py`), local hour, rover height | `analysis/rems.py` |
| Summarise | Hourly and daily statistics; a sol is "full" with good data in 22 of 24 hours | `analysis/rems.py`, `analysis/run_uv.py` |
| Check | A cleaning report per chunk, checked before the next batch | `data/rems/reports/` |
| Publish | The small files the page reads | `analysis/make_page_data.py` |

Raw downloads are never committed; `data/rems/manifest.csv` lists every file used, with its size and SHA-256.

## Files

```
mars-data/
├── index.html            the project home page
├── charts/index.html     the charts
├── method/index.html     how the data is made: the cleaning rules in plain words, with examples
├── analysis/             Python: download, clean, organise, summarise (CLEANING.md: the rules)
├── data/summary.json     one row per sol and the season-by-hour grid, read by the page
├── data/hourly/          hourly means per sol, one file per Mars Year
├── data/rems/            sols.csv, hourly.csv, uv.csv, manifest.csv and the cleaning reports
└── README.md             this file
```

## Data

NASA Planetary Data System, Atmospheres Node: MSL REMS MODRDR, ADR and UVRDR data sets. Citations and checks:
[docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md). Planned next: Perseverance's weather station (MEDA) and ESA's Mars
Express radio occultation profiles.

---

Created by **Malcolm Syme** · <mcsyme11@gmail.com> · part of NASA and ESA Data Projects.
