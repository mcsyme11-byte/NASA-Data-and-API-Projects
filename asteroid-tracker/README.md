# Asteroid Tracker

**Project 1 of NASA Data Projects.** Status: **planned** (built in its own chat).

NASA offers datasets and APIs full of information about near-Earth objects and other astronomical bodies. This
project pulls in asteroid data, sorts objects by size, shows how far each one is from Earth, and turns it all into
graphs to explore in an interactive dashboard.

## What it will do

- **This week's close approaches:** every near-Earth object passing Earth, with its size, speed and miss distance.
- **Sort and filter:** by size, distance, speed, date, and "potentially hazardous" or not.
- **Distances people can picture:** miss distance in **Moon distances (LD)** as well as km.
  Example: 1,150,000 km ÷ 384,400 km = **3.0 LD**, "passes three times farther away than the Moon".
- **Graphs:** size against miss distance, approaches per day, the biggest objects of the week.

## Data

| Source | What it gives | Key |
|---|---|---|
| NASA NeoWs (`api.nasa.gov/neo/rest/v1/`) | `feed` (close approaches by date), `neo/{id}` (one object), `browse` (the whole catalogue, paged) | NASA API key or `DEMO_KEY` |
| JPL SBDB Close-Approach Data (`ssd-api.jpl.nasa.gov/cad.api`) | Past and future approaches over long date ranges | none |

**Limits to design around:**
- The `feed` covers **at most 7 days** per request; longer ranges are joined from several requests.
- `DEMO_KEY`: 30 requests an hour and 50 a day per connection. A free personal key: 1,000 an hour.
- Sizes are **estimates** (a min–max diameter from brightness), so the page shows a range, not one exact number.

Details: [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md).

## Files (to come)

```
asteroid-tracker/
├── index.html     the dashboard (a placeholder for now)
├── app.js         fetching, sorting, charts
└── README.md      this file
```

---

**Asteroid Tracker** · part of NASA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
