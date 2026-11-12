// NASA and ESA Data Projects · the sky from a place on Earth · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Where things are in the sky for an observer at latitude φ, longitude λ, at a given moment: the Sun, the Moon, the
// planets, bright stars and asteroids (from NASA/JPL Horizons vectors). Used by the Asteroid Tracker's "Visible from
// here" tab and by Sky Finder. Accuracy is about 0.05° for the Sun and Moon, a few arcminutes for the inner planets,
// about 0.2° for Jupiter and Saturn (JPL's approximate elements), well inside what a phone's compass can show.
//
// The steps, in the order they are applied:
//   1. Time:       Julian date JD; T = (JD − 2451545) / 36525 (centuries since J2000.0).
//   2. Position:   a geocentric vector in the J2000 equatorial frame (planets and the Sun from orbit.js, rotated from
//                  the ecliptic by ε₀ = 23.4392911°; asteroids from Horizons, already in this frame; stars from their
//                  J2000 right ascension and declination). The Moon comes from Meeus, "Astronomical Algorithms",
//                  chapter 47 (the main terms), in the ecliptic of the date.
//   3. Precession: J2000 → the equator and equinox of the date (IAU 1976 angles ζ, z, θ).
//   4. Topocentre: subtract the observer's own position (WGS84 ellipsoid), which matters for the Moon (up to 1°) and
//                  for an asteroid passing close.
//   5. Horizon:    local sidereal time LST = GMST + λ;  hour angle H = LST − α;
//                  altitude  sin h = sin φ sin δ + cos φ cos δ cos H;
//                  azimuth   A = atan2(−cos δ sin H, sin δ cos φ − cos δ sin φ cos H), from north through east.
//   6. Refraction: for display, Bennett's formula R = 1′ / tan(h + 7.31′/(h + 4.4′)) lifts objects near the horizon.
//   7. Brightness: an asteroid's magnitude from the IAU H, G system (G = 0.15):
//                  V = H + 5 log10(r Δ) − 2.5 log10((1 − G) Φ₁ + G Φ₂), with r and Δ its distances (au) from the Sun
//                  and from Earth, Φ₁ = exp(−3.33 tan^0.63(α/2)), Φ₂ = exp(−1.87 tan^1.22(α/2)), α the phase angle.

import { planetPosition, jdFromMs, AU_KM } from '../asteroid-tracker/orbit.js';
export { jdFromMs };

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const EPS0 = 23.4392911 * RAD;                        // obliquity of the ecliptic at J2000
const R_EQ = 6378.137, F_EARTH = 1 / 298.257223563;   // WGS84
const norm360 = (a) => ((a % 360) + 360) % 360;

// ---------------------------------------------------------------- time
export const centuries = (jd) => (jd - 2451545.0) / 36525;
// Greenwich mean sidereal time, degrees (IAU 1982, with UT1 ≈ UTC: under a second's difference, 0.004°)
export function gmst(jd) {
  const T = centuries(jd);
  return norm360(280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * T * T - (T * T * T) / 38710000);
}
export const lst = (jd, lonDeg) => norm360(gmst(jd) + lonDeg);

// ---------------------------------------------------------------- frames
export function eclToEq([x, y, z], eps = EPS0) {   // ecliptic → equatorial (rotation about x by ε)
  const c = Math.cos(eps), s = Math.sin(eps);
  return [x, y * c - z * s, y * s + z * c];
}
export function obliquity(jd) {                    // mean obliquity of the date (radians)
  const T = centuries(jd);
  return (23.4392911 - 0.0130042 * T - 1.64e-7 * T * T + 5.04e-7 * T * T * T) * RAD;
}
// The precession matrix from J2000 to the mean equator and equinox of the date (IAU 1976).
const _prec = new Map();
export function precessionMatrix(jd) {
  const key = Math.round(jd);                       // changes by 0.00004° a day: one matrix a day is plenty
  if (_prec.has(key)) return _prec.get(key);
  const T = centuries(key);
  const zeta = (2306.2181 * T + 0.30188 * T * T + 0.017998 * T * T * T) / 3600 * RAD;
  const z = (2306.2181 * T + 1.09468 * T * T + 0.018203 * T * T * T) / 3600 * RAD;
  const th = (2004.3109 * T - 0.42665 * T * T - 0.041833 * T * T * T) / 3600 * RAD;
  const cz = Math.cos(zeta), sz = Math.sin(zeta), cZ = Math.cos(z), sZ = Math.sin(z), ct = Math.cos(th), st = Math.sin(th);
  const m = [
    [cZ * ct * cz - sZ * sz, -cZ * ct * sz - sZ * cz, -cZ * st],
    [sZ * ct * cz + cZ * sz, -sZ * ct * sz + cZ * cz, -sZ * st],
    [st * cz, -st * sz, ct],
  ];
  if (_prec.size > 64) _prec.clear();
  _prec.set(key, m);
  return m;
}
export function precess(v, jd) {
  const m = precessionMatrix(jd);
  return [m[0][0] * v[0] + m[0][1] * v[1] + m[0][2] * v[2], m[1][0] * v[0] + m[1][1] * v[1] + m[1][2] * v[2], m[2][0] * v[0] + m[2][1] * v[1] + m[2][2] * v[2]];
}
export const radec = ([x, y, z]) => ({ ra: norm360(Math.atan2(y, x) * DEG), dec: Math.atan2(z, Math.hypot(x, y)) * DEG, dist: Math.hypot(x, y, z) });
export function fromRadec(raDeg, decDeg, dist = 1) {
  const a = raDeg * RAD, d = decDeg * RAD;
  return [dist * Math.cos(d) * Math.cos(a), dist * Math.cos(d) * Math.sin(a), dist * Math.sin(d)];
}

// ---------------------------------------------------------------- the observer
// The observer's geocentric position, km, in the equator-of-date frame, at sidereal time LST (geodetic latitude).
export function observerVector(latDeg, lonDeg, jd, heightKm = 0) {
  const phi = latDeg * RAD, e2 = F_EARTH * (2 - F_EARTH);
  const N = R_EQ / Math.sqrt(1 - e2 * Math.sin(phi) ** 2);
  const rc = (N + heightKm) * Math.cos(phi), zc = (N * (1 - e2) + heightKm) * Math.sin(phi);
  const t = lst(jd, lonDeg) * RAD;
  return [rc * Math.cos(t), rc * Math.sin(t), zc];
}
// Altitude and azimuth (degrees) of a direction given by right ascension and declination of the date.
export function horizon(raDeg, decDeg, latDeg, lstDeg) {
  const H = (lstDeg - raDeg) * RAD, d = decDeg * RAD, p = latDeg * RAD;
  const sh = Math.sin(p) * Math.sin(d) + Math.cos(p) * Math.cos(d) * Math.cos(H);
  const alt = Math.asin(Math.max(-1, Math.min(1, sh))) * DEG;
  const az = norm360(Math.atan2(-Math.cos(d) * Math.sin(H), Math.sin(d) * Math.cos(p) - Math.cos(d) * Math.sin(p) * Math.cos(H)) * DEG);
  return { alt, az };
}
// Bennett's refraction (degrees to add to the true altitude); none well below the horizon.
export function refraction(altDeg) {
  if (altDeg < -2) return 0;
  return 1 / 60 / Math.tan((altDeg + 7.31 / (altDeg + 4.4)) * RAD);
}
// A geocentric vector (km, equator of date) seen from the observer: altitude, azimuth, distance (km).
export function topocentric(vKm, obs, jd) {
  const t = [vKm[0] - obs.vec[0], vKm[1] - obs.vec[1], vKm[2] - obs.vec[2]];
  const r = radec(t), h = horizon(r.ra, r.dec, obs.lat, obs.lst);
  return { alt: h.alt + refraction(h.alt), trueAlt: h.alt, az: h.az, ra: r.ra, dec: r.dec, km: r.dist };
}
// Everything that depends only on the place and the moment, worked out once.
export function observer(lat, lon, jd) {
  return { lat, lon, jd, lst: lst(jd, lon), vec: observerVector(lat, lon, jd) };
}

// ---------------------------------------------------------------- the Sun, planets and Moon (geocentric, km, of date)
// Earth from orbit.js is the Earth–Moon barycentre; Earth itself is 4,671 km from it, towards the opposite of the Moon.
// That offset is under 0.002° for the Sun and planets and is left out; the Moon is computed from Earth directly.
function earthHelio(jd) { return planetPosition('Earth', jd); }
export function sunVector(jd) {
  const e = earthHelio(jd);
  return precess(eclToEq([-e[0] * AU_KM, -e[1] * AU_KM, -e[2] * AU_KM]), jd);
}
export function planetVector(name, jd) {
  const e = earthHelio(jd), p = planetPosition(name, jd);
  // light time: the planet is seen where it was when the light left it (Jupiter: about 40 minutes, 0.006°)
  const d = Math.hypot(p[0] - e[0], p[1] - e[1], p[2] - e[2]), p2 = planetPosition(name, jd - d * 0.0057755);
  return precess(eclToEq([(p2[0] - e[0]) * AU_KM, (p2[1] - e[1]) * AU_KM, (p2[2] - e[2]) * AU_KM]), jd);
}
// The Moon: Meeus chapter 47, the main periodic terms (largest 36 in longitude and distance, 30 in latitude).
// Multiples of D, M, M′, F; coefficients Σl (1e-6 °) and Σr (1e-3 km).
const MOON_LR = [
  [0, 0, 1, 0, 6288774, -20905355], [2, 0, -1, 0, 1274027, -3699111], [2, 0, 0, 0, 658314, -2955968], [0, 0, 2, 0, 213618, -569925],
  [0, 1, 0, 0, -185116, 48888], [0, 0, 0, 2, -114332, -3149], [2, 0, -2, 0, 58793, 246158], [2, -1, -1, 0, 57066, -152138],
  [2, 0, 1, 0, 53322, -170733], [2, -1, 0, 0, 45758, -204586], [0, 1, -1, 0, -40923, -129620], [1, 0, 0, 0, -34720, 108743],
  [0, 1, 1, 0, -30383, 104755], [2, 0, 0, -2, 15327, 10321], [0, 0, 1, 2, -12528, 0], [0, 0, 1, -2, 10980, 79661],
  [4, 0, -1, 0, 10675, -34782], [0, 0, 3, 0, 10034, -23210], [4, 0, -2, 0, 8548, -21636], [2, 1, -1, 0, -7888, 24208],
  [2, 1, 0, 0, -6766, 30824], [1, 0, -1, 0, -5163, -8379], [1, 1, 0, 0, 4987, -16675], [2, -1, 1, 0, 4036, -12831],
  [2, 0, 2, 0, 3994, -10445], [4, 0, 0, 0, 3861, -11650], [2, 0, -3, 0, 3665, 14403], [0, 1, -2, 0, -2689, -7003],
  [2, 0, -1, 2, -2602, 0], [2, -1, -2, 0, 2390, 10056], [1, 0, 1, 0, -2348, 6322], [2, -2, 0, 0, 2236, -9884],
  [0, 1, 2, 0, -2120, 5751], [0, 2, 0, 0, -2069, 0], [2, -2, -1, 0, 2048, -4950], [2, 0, 1, -2, -1773, 4130],
];
const MOON_B = [
  [0, 0, 0, 1, 5128122], [0, 0, 1, 1, 280602], [0, 0, 1, -1, 277693], [2, 0, 0, -1, 173237], [2, 0, -1, 1, 55413],
  [2, 0, -1, -1, 46271], [2, 0, 0, 1, 32573], [0, 0, 2, 1, 17198], [2, 0, 1, -1, 9266], [0, 0, 2, -1, 8822],
  [2, -1, 0, -1, 8216], [2, 0, -2, -1, 4324], [2, 0, 1, 1, 4200], [2, 1, 0, -1, -3359], [2, -1, -1, 1, 2463],
  [2, -1, 0, 1, 2211], [2, -1, -1, -1, 2065], [0, 1, -1, -1, -1870], [4, 0, -1, -1, 1828], [0, 1, 0, 1, -1794],
  [0, 0, 0, 3, -1749], [0, 1, -1, 1, -1565], [1, 0, 0, 1, -1491], [0, 1, 1, 1, -1475], [0, 1, 1, -1, -1410],
  [0, 1, 0, -1, -1344], [1, 0, 0, -1, -1335], [0, 0, 3, 1, 1107], [4, 0, 0, -1, 1021], [4, 0, -1, 1, 833],
];
// The Moon's geocentric ecliptic longitude and latitude (degrees, ecliptic and equinox of the date) and distance (km).
export function moonEcliptic(jd) {
  const T = centuries(jd);
  const Lp = norm360(218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T ** 3 / 538841);
  const D = norm360(297.8501921 + 445267.1114034 * T - 0.0018819 * T * T + T ** 3 / 545868) * RAD;
  const M = norm360(357.5291092 + 35999.0502909 * T - 0.0001536 * T * T) * RAD;
  const Mp = norm360(134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T ** 3 / 69699) * RAD;
  const F = norm360(93.272095 + 483202.0175233 * T - 0.0036539 * T * T) * RAD;
  const A1 = norm360(119.75 + 131.849 * T) * RAD, A2 = norm360(53.09 + 479264.29 * T) * RAD, A3 = norm360(313.45 + 481266.484 * T) * RAD;
  const E = 1 - 0.002516 * T - 0.0000074 * T * T;
  let sl = 0, sr = 0, sb = 0;
  for (const [d, m, mp, f, l, r] of MOON_LR) {
    const arg = d * D + m * M + mp * Mp + f * F, e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sl += l * e * Math.sin(arg); sr += r * e * Math.cos(arg);
  }
  for (const [d, m, mp, f, b] of MOON_B) {
    const e = Math.abs(m) === 1 ? E : Math.abs(m) === 2 ? E * E : 1;
    sb += b * e * Math.sin(d * D + m * M + mp * Mp + f * F);
  }
  const LpR = Lp * RAD;
  sl += 3958 * Math.sin(A1) + 1962 * Math.sin(LpR - F) + 318 * Math.sin(A2);
  sb += -2235 * Math.sin(LpR) + 382 * Math.sin(A3) + 175 * Math.sin(A1 - F) + 175 * Math.sin(A1 + F) + 127 * Math.sin(LpR - Mp) - 115 * Math.sin(LpR + Mp);
  return { lon: norm360(Lp + sl / 1e6), lat: sb / 1e6, km: 385000.56 + sr / 1000 };
}
export function moonVector(jd) {                   // geocentric, km, equator of date
  const m = moonEcliptic(jd), l = m.lon * RAD, b = m.lat * RAD;
  return eclToEq([m.km * Math.cos(b) * Math.cos(l), m.km * Math.cos(b) * Math.sin(l), m.km * Math.sin(b)], obliquity(jd));
}
// How much of the Moon is lit (0–1), from the Sun–Moon angle seen from Earth.
export function moonPhase(jd) {
  const s = sunVector(jd), m = moonVector(jd);
  const cos = (s[0] * m[0] + s[1] * m[1] + s[2] * m[2]) / (Math.hypot(...s) * Math.hypot(...m));
  const elong = Math.acos(Math.max(-1, Math.min(1, cos)));
  const e = earthHelio(jd), sunLon = Math.atan2(-e[1], -e[0]) * DEG;   // the Sun's ecliptic longitude (J2000; 0.4° from the date's)
  return { lit: (1 - Math.cos(Math.PI - elong)) / 2, waxing: norm360(moonEcliptic(jd).lon - sunLon) < 180 };
}

// ---------------------------------------------------------------- stars (J2000 directions, precessed)
export function starVector(raDeg, decDeg, jd) { return precess(fromRadec(raDeg, decDeg, 1e12), jd); }

// ---------------------------------------------------------------- asteroids (Horizons geocentric vectors)
// Samples: { t0 (JD), step (days), xyz: [x, y, z, …] km, J2000 equatorial }. Cubic (Catmull–Rom) between samples.
export function sampleAt(s, jd) {
  const n = s.xyz.length / 3, f = (jd - s.t0) / s.step;
  if (!(f >= 0) || f > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(f)), u = f - i;
  const P = (k) => { const j = 3 * Math.max(0, Math.min(n - 1, k)); return [s.xyz[j], s.xyz[j + 1], s.xyz[j + 2]]; };
  const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2), u2 = u * u, u3 = u2 * u;
  return [0, 1, 2].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * u + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * u2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * u3));
}
export function asteroidVector(s, jd) { const v = sampleAt(s, jd); return v ? precess(v, jd) : null; }
// Magnitude (V) from H and the geometry: vector to the asteroid and to the Sun from Earth's centre (km).
export function magnitudeHG(H, astKm, sunKm, G = 0.15) {
  const helio = [astKm[0] - sunKm[0], astKm[1] - sunKm[1], astKm[2] - sunKm[2]];
  const r = Math.hypot(...helio) / AU_KM, delta = Math.hypot(...astKm) / AU_KM;
  // phase angle: Sun–asteroid–Earth
  const toSun = helio.map((v) => -v), toEarth = astKm.map((v) => -v);
  const cos = (toSun[0] * toEarth[0] + toSun[1] * toEarth[1] + toSun[2] * toEarth[2]) / (Math.hypot(...toSun) * Math.hypot(...toEarth));
  const a = Math.acos(Math.max(-1, Math.min(1, cos))), t = Math.tan(a / 2);
  const p1 = Math.exp(-3.33 * t ** 0.63), p2 = Math.exp(-1.87 * t ** 1.22);
  return H + 5 * Math.log10(r * delta) - 2.5 * Math.log10((1 - G) * p1 + G * p2);
}

// ---------------------------------------------------------------- what you need to see it (DESIGN: the rules)
export const NEEDS = [
  { max: 6, key: 'eye', label: 'Naked eye', note: 'dark sky, away from town' },
  { max: 9, key: 'bino', label: 'Binoculars', note: '' },
  { max: 12, key: 'small', label: 'Small telescope', note: '8–15 cm' },
  { max: 15, key: 'large', label: 'Large telescope', note: '20 cm and up' },
  { max: 99, key: 'faint', label: 'Too faint', note: 'for backyard viewing' },
];
export const needFor = (mag) => NEEDS.find((n) => mag <= n.max);

// Compass point for an azimuth: N, NNE, NE, …
const POINTS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];
const WORDS = { N: 'north', NE: 'north-east', E: 'east', SE: 'south-east', S: 'south', SW: 'south-west', W: 'west', NW: 'north-west' };
export const compass = (az) => POINTS[Math.round(norm360(az) / 22.5) % 16];
export const compassWord = (az) => { const p = POINTS[Math.round(norm360(az) / 45) * 2 % 16]; return WORDS[p]; };
