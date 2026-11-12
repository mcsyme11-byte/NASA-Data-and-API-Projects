# Credits

NASA and ESA Data Projects is created by **Malcolm Syme** (<mcsyme11@gmail.com>). The project's own code and documents are
released under the [MIT License](LICENSE.md). Everything below comes from others and keeps its own terms.

The same list appears on the site's Credits page. When a new data source or library is added, it is added here and
there in the same change.

## Data and imagery

| Source | Used for | Terms |
|---|---|---|
| NASA NeoWs (api.nasa.gov) | Asteroid Tracker: close approaches, sizes, the hazard flag | NASA data; generally not under copyright in the United States |
| NASA/JPL Solar System Dynamics: Close-Approach Data, Small-Body Database, Horizons, approximate planetary elements, Sentry | Asteroid Tracker: approaches, orbits, spacecraft and planet positions, NASA's impact-risk list, the positions behind "Visible from here"; spacecraft map: deep-space, Lagrange-point, Moon and Mars positions; Sky Finder: asteroid positions | NASA/JPL data |
| CelesTrak (celestrak.org), general perturbations orbital elements | Spacecraft map: satellites in Earth orbit; Sky Finder: the space stations' passes | Published orbital data; credit "CelesTrak" |
| NASA GIBS (Global Imagery Browse Services), including Blue Marble | Image Explorer: the Earth map, the polar views, the globe's surface | NASA imagery; acknowledgement required (below) |
| NASA Image and Video Library | Image Explorer: the picture library | NASA material; some items carry their own credit or rights, shown with each item |
| NASA EONET (Earth Observatory Natural Event Tracker) | Image Explorer: events on the globe | NASA data |
| Gateway to Astronaut Photography of Earth, Earth Science and Remote Sensing Unit, NASA Johnson Space Center | Image Explorer: astronaut photos on the globe | NASA material; credit the unit |
| d3-celestial, © 2015 Olaf Frohn | Image Explorer: stars, galaxies, nebulae, clusters and constellations; Sky Finder: bright stars and their names (Hipparcos catalogue), `sky-finder/data/stars.json` | BSD 3-Clause, kept as `image-explorer/data/LICENSE-d3-celestial.txt` |
| GeoNames (geonames.org), through the `all-the-cities` package (MIT) and GeoNames' own downloads | Image Explorer, the Asteroid Tracker's "Visible from here" and Sky Finder: place search (towns, cities, capitals; smaller natural features with an English Wikipedia article; the globe's volcanoes and natural wonders) | GeoNames: Creative Commons Attribution 4.0 |
| Natural Earth (naturalearthdata.com) | Image Explorer: mountains, lakes and rivers in place search; the Earth map's coastlines, borders, rivers and names; the country of a tapped spot | Public domain |
| US Geological Survey earthquake feed (earthquake.usgs.gov) | Image Explorer: the globe's earthquakes of the past week | Public domain (US Government) |
| NASA Planetary Data System, Atmospheres Node: Perseverance's Mars Environmental Dynamics Analyzer (MEDA), Mars 2020 MEDA derived data (DOI 10.17189/1522849) | Mars Data: pressure, humidity and the rover's height at Jezero Crater (the two-craters comparison) | NASA data; credit "NASA/JPL-Caltech and the MEDA team (Centro de Astrobiología), NASA Planetary Data System" |
| NASA Planetary Data System, Atmospheres Node: Curiosity's Rover Environmental Monitoring Station (REMS), data sets MSL-M-REMS-5-MODRDR-V1.0, MSL-M-REMS-6-ADR-V1.0 and MSL-M-REMS-5-UVRDR-V1.0 | Mars Data: pressure, air and ground temperature, humidity, ultraviolet and the rover's height, sol by sol | NASA data; credit "NASA/JPL-Caltech and the REMS team (Centro de Astrobiología), NASA Planetary Data System"; citations in `docs/DATA-SOURCES.md` |

**GIBS acknowledgement** (NASA asks every user of GIBS to show it): We acknowledge the use of imagery provided by
services from NASA's Global Imagery Browse Services (GIBS), part of NASA's Earth Science Data and Information System
(ESDIS).

## ESA (the European Space Agency)

Decided Nov 9, 2026: ESA data and imagery are added alongside NASA's where they help. Each ESA source is listed here,
with its exact credit line, in the same change that adds it, and ESA's credit is shown wherever its data appears.

| Source | Used for | Terms |
|---|---|---|
| ESA/Webb picture and video archives (esawebb.org) | Image Explorer: Picture library and the globe's pictures, beside NASA's | CC BY 4.0 (esawebb.org/copyright); each picture's own credit line, shown in full with it, for example "NASA, ESA, CSA, STScI. Image Processing: J. Depasquale (STScI)"; captions credited to ESA/Webb |
| ESA/Hubble picture and video archives (esahubble.org) | Image Explorer: Picture library and the globe's pictures, beside NASA's | CC BY 4.0 (esahubble.org/copyright); each picture's own credit line, shown in full with it, for example "NASA, ESA, and STScI"; captions credited to ESA/Hubble |
| ESA NEO Coordination Centre (NEOCC, neo.ssa.esa.int): risk list, special risk list, close approaches | Asteroid Tracker: ESA's impact-risk list beside NASA's, and ESA's close-approach distances | ESA's terms for educational and informational use; credit "ESA NEO Coordination Centre (©ESA)" |

**ESA's terms:** some ESA images, videos and other works are released, where expressly stated, under the Creative
Commons Attribution-ShareAlike 3.0 IGO licence (CC BY-SA 3.0 IGO): the source is credited in ESA's own form (for
example "ESA/DLR/FU Berlin, CC BY-SA 3.0 IGO"), the licence is linked, changes are marked, and changed versions are
shared under the same licence. Other material on ESA's website may be used for educational and informational purposes
with ESA's credit (ESA's terms and conditions, esa.int). ESA's logo is not used: it needs ESA's written permission.

## Code libraries (copies kept in the repository, `image-explorer/vendor/` and `shared/vendor/`, each with its licence file)

| Library | Version | Used for | Licence |
|---|---|---|---|
| OpenLayers (`ol`) | 10.11.0 | Image Explorer: the Earth map | BSD 2-Clause |
| proj4js (`proj4`) | 2.22.0 | Image Explorer: the polar map projections | MIT |
| three.js (`three`) | 0.187.0 | Image Explorer: the globe | MIT |
| satellite.js, © 2013 Shashwat Kandadai | 7.2.0 | Spacecraft map and Sky Finder: satellite positions from orbital elements (SGP4); bundled as an ES module, `shared/vendor/satellite.min.js`, licence `shared/vendor/LICENSE-satellite.js.md` | MIT |

Analysis tools (run on GitHub's servers to prepare data; not sent to visitors): pandas (BSD 3-Clause), for the Mars
Data cleaning and statistics in `mars-data/analysis/`.

## NASA and ESA

Data courtesy of NASA and ESA. This is an independent project and is not endorsed by NASA or ESA. ESA's logo is not
used. The spacecraft map names missions of other agencies (JAXA, ISRO, CNSA, CMSA, CSA, KASA, the UAE Space Agency and
others) and links to their pages; no agency's logo is used and none endorses the project. NASA's insignia ("meatball"),
logotype ("worm") and seal are not used.

---

**NASA and ESA Data Projects** · Created by **Malcolm Syme** · <mcsyme11@gmail.com>
