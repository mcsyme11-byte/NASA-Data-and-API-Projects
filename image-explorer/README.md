# Image Explorer

**Project 3 of NASA and ESA Data Projects.** Status: **live** (version 1, Nov 9, 2026).

NASA shares huge collections of scientific and satellite imagery. This project is a website that lets people
search, filter and explore those images by details like date, location and mission.

## Three tabs

| Part | Source | What people do |
|---|---|---|
| **Earth map** | NASA GIBS (Global Imagery Browse Services) | Pick a date and a picture (true colour, night lights, sea temperature) with fires, snow, clouds, smoke and dust or sea ice on top; pan and zoom the whole planet; step or play through the days. |
| **Globe** | NASA Blue Marble (GIBS), NASA EONET, d3-celestial | Turn and zoom the Earth inside the real sky; pins for NASA's natural events of the last 30 days; about 1,350 galaxies, nebulae and star clusters, each opening NASA's pictures of it. |
| **Picture library** | NASA Image and Video Library (`images-api.nasa.gov`) | Search by keyword, place, mission (Apollo, Hubble, Webb…), centre and year, with results and spelling suggestions as you type; space pictures first, launches and events under "Behind the scenes"; open a picture with its description and date, or find its galaxy or nebula on the globe. |

Reason for using several sources: GIBS is satellite imagery **of Earth**, arranged by date and layer, with no "mission" to
filter by. The Image Library has the mission photos. The globe ties places on Earth and objects in the sky to them.

## Data notes

- **GIBS** needs no key. Tiles come from a web map tile service (WMTS), one URL per tile, for example:
  `https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/2026-06-01/250m/{level}/{row}/{column}.jpg`
- The map uses the `epsg4326` projection, the only one in which the fire layers load (checked Nov 9, 2026).
- Layers have their own dates and zoom limits; some lag a few days, others stop years ago. The page checks a layer's
  dates before offering them.
- **GIBS acknowledgement** goes on the page (NASA asks for it; see [docs/DATA-SOURCES.md](../docs/DATA-SOURCES.md)).
- **Image Library** needs no key.

## Files

```
image-explorer/
├── index.html          the page: Earth map, Globe, Picture library
├── explorer.css        the page's styles (on top of shared/theme.css)
├── app.js              the Earth map (world, Arctic, Antarctic), place search, tabs and the picture library
├── globe.js            the Globe tab (three.js)
├── fetch_astronaut_photos.py   daily astronaut photos (GitHub Actions; needs the EOL_API_KEY secret)
├── data/
│   ├── places.json     towns of 10,000 people or more and capitals (GeoNames, CC BY 4.0)
│   ├── features.json   mountains, ranges, lakes, rivers, deserts, islands, seas (Natural Earth, public domain)
│   ├── astronaut.json  the newest astronaut photos of Earth with their positions (empty until the key is set)
│   ├── stars.json      5,044 stars to magnitude 6        ┐
│   ├── sky.json        about 1,350 deep-sky objects      ├ d3-celestial (BSD licence,
│   ├── constellations.json  the 88 constellations        ┘ LICENSE-d3-celestial.txt)
│   └── LICENSE-d3-celestial.txt
├── tools/
│   ├── build_sky.py        builds stars.json, sky.json, constellations.json
│   ├── build_places.mjs    builds places.json
│   └── build_features.py   builds features.json
└── README.md           this file
```

Rebuilding the data:
```
npm install d3-celestial all-the-cities@3.1.0                  # in any scratch folder
python3 image-explorer/tools/build_sky.py node_modules/d3-celestial/data
node image-explorer/tools/build_places.mjs image-explorer/data/places.json   # run from the scratch folder
python3 image-explorer/tools/build_features.py path/to/natural-earth-geojson   # the six files named in the script
```

---

**Image Explorer** · part of NASA and ESA Data Projects · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
