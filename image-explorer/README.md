# Image Explorer

**Project 3 of NASA Data Projects.** Status: **planned** (built in its own chat).

NASA shares huge collections of scientific and satellite imagery. This project is a website that lets people
search, filter and explore those images by details like date, location and mission.

## Two halves

| Part | Source | What people do |
|---|---|---|
| **Earth, day by day** | NASA GIBS (Global Imagery Browse Services) | Pick a date and a layer (true colour, fires, snow, night lights…), then pan and zoom the whole planet. Slide through time to watch a storm move. |
| **NASA's picture library** | NASA Image and Video Library (`images-api.nasa.gov`) | Search by keyword, mission (Apollo, Hubble, Webb…), centre and year; open a picture with its description and date. |

Why both: GIBS is satellite imagery **of Earth**, arranged by date and layer, but it has no "mission" to filter by.
The Image Library has the mission photos. Together they cover date, location and mission.

## Data notes

- **GIBS** needs no key. Tiles come from a web map tile service (WMTS), one URL per tile, for example:
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-06-01/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`
- Layers have their own dates and zoom limits; some lag a few days, others stop years ago. The page checks a layer's
  dates before offering them.
- **GIBS acknowledgement** goes on the page (NASA asks for it; see [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md)).
- **Image Library** needs no key.

## Files (to come)

```
image-explorer/
├── index.html     the explorer (a placeholder for now)
├── app.js         search, filters, the map
└── README.md      this file
```

---

**Image Explorer** · part of NASA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
