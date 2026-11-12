# Sky Finder

An installable phone web app that points to tonight's passing asteroids, with the Moon, planets, bright stars and the
space stations to check the aim. Part of NASA and ESA Data Projects, at `sky-finder/` on the site. Created by
Malcolm Syme (mcsyme11@gmail.com), © 2026.

## What it does

- **Tonight's list** (`index.html`, `app.js`): where you are (your device's location or a town), when it is dark, the
  asteroid passes worth looking for (tonight first), the Moon, the planets and the ISS and Tiangong passes you can see.
- **Camera view** (`view.js`): the camera picture with markers over it. The chosen asteroid is a diamond with its path
  hour by hour; the Moon, planets, bright stars and space stations are drawn for reference; an arrow points to
  anything off the screen and a line says which way to turn. Without motion sensors, the sky is dragged by hand.
- **Calibration:** with the Moon, a planet or a bright star in the brass circle, the difference between where the
  sensors say the phone points and where that object is (in azimuth and altitude) is taken off every marker. It is
  kept for 12 hours.
- **How-to page** (`how-to.html`): adding it to the home screen, the three permissions, finding an asteroid, what the
  marks mean, what is needed to see it.
- **Offline:** `sw.js` keeps the app's files and the last data in the browser's cache.

## How it works

| Step | Rule |
|---|---|
| Where the phone points | The W3C device-orientation angles α, β, γ give R = Rz(α)·Rx(β)·Ry(γ); the back camera looks along R·(0, 0, −1). Android's `deviceorientationabsolute` gives α from magnetic north; on an iPhone, `webkitCompassHeading` sets it (`orient.js`). |
| A direction to the screen | v·forward = f, v·right = x, v·up = y; X = W/2 + F·x/f, Y = H/2 − F·y/f, F = (L/2)/tan(θ/2), with θ the camera's view across the long side L (65° by default, adjustable). Behind the phone when f ≤ 0. |
| Where things are | `shared/sky.js`: precession, the observer's place on the WGS84 ellipsoid, refraction; asteroids from `asteroid-tracker/data/sky.json`; stations by SGP4 (`shared/sats.js`). |
| Seen tonight | Asteroid: at least 10° up with the Sun 12° down. Station: at least 10° up, in sunlight, the Sun 6° down. |

## Privacy and safety

Camera, location and motion readings stay on the device; nothing is recorded or sent. The place, the settings and the
calibration are kept in the browser's local storage. A notice before first use and the site's Terms say never to look
at the Sun and to look where you walk. See the site's Privacy and Terms pages.

## Data

NASA/JPL (close approaches and Horizons), CelesTrak (orbital elements), d3-celestial (bright stars, BSD 3-Clause),
GeoNames (towns, CC BY 4.0). Details in `docs/DATA-SOURCES.md`. Not endorsed by NASA or ESA.
