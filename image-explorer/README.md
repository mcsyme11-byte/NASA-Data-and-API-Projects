# Image Explorer

**Project 3 of NASA Data Projects.** Status: **mock-up for review** (`mockup.html` on the live site), Nov 9, 2026.

NASA shares huge collections of scientific and satellite imagery. This project is a website that lets people
search, filter and explore those images by details like date, location and mission.

## Two halves

| Part | Source | What people do |
|---|---|---|
| **Earth map** | NASA GIBS (Global Imagery Browse Services) | Pick a date and a picture (true colour, night lights, sea temperature) with fires, snow, clouds, smoke and dust or sea ice on top; pan and zoom the whole planet; step or play through the days. |
| **Picture library** | NASA Image and Video Library (`images-api.nasa.gov`) | Search by keyword, place, mission (Apollo, Hubble, Webb…), centre and year; open a picture with its description and date. |

Reason for using both sources: GIBS is satellite imagery **of Earth**, arranged by date and layer, but it has no "mission" to filter by.
The Image Library has the mission photos. Together they cover date, location and mission.

## Data notes

- **GIBS** needs no key. Tiles come from a web map tile service (WMTS), one URL per tile, for example:
  `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-06-01/250m/{level}/{row}/{column}.jpg`
- The map uses the `epsg4326` projection, the only one in which the fire layers load (checked Nov 9, 2026).
- Layers have their own dates and zoom limits; some lag a few days, others stop years ago. The page checks a layer's
  dates before offering them.
- **GIBS acknowledgement** goes on the page (NASA asks for it; see [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md)).
- **Image Library** needs no key.

## Files (to come)

```
image-explorer/
├── index.html     the explorer (a placeholder until the mock-up is approved)
├── mockup.html    the mock-up for review (removed once the page is built)
├── explorer.css   the page's styles (to come)
├── app.js         search, filters, the map (to come)
└── README.md      this file
```

---

**Image Explorer** · part of NASA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
