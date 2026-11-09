// NASA Data Projects · Asteroid Tracker · orbit positions · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Positions of the planets and of an asteroid around the Sun, from Keplerian orbital elements, in the J2000
// ecliptic frame (x towards the March equinox, z towards the ecliptic north pole), in astronomical units (au).
//
// The method, step by step (JPL, "Approximate Positions of the Planets", ssd.jpl.nasa.gov/planets/approx_pos.html):
//   1. Elements at the date:   planets: element = value + rate × T, with T = Julian centuries since J2000.0
//                               asteroid: mean anomaly M = M0 + n × (days since the elements' epoch)
//   2. Angles:                  argument of perihelion ω = ϖ − Ω;   mean anomaly (planets) M = L − ϖ
//   3. Kepler's equation:       solve M = E − e·sin E for E (Newton's method)
//   4. In the orbit's plane:    x′ = a(cos E − e),   y′ = a·√(1 − e²)·sin E
//   5. Rotate by ω, i, Ω into the ecliptic frame (rotate() below).
//
// Limits, stated on the page: this is two-body motion (the Sun's pull only). It shows the shape of the orbits and
// where the bodies are to within a small fraction of an au for years around the elements' epoch, which suits a
// diagram. It does not reproduce the exact distance of a very close pass, where Earth's own pull bends the path;
// the official close-approach figures from NASA/JPL are shown beside the diagram for that.

const RAD = Math.PI / 180;
export const J2000 = 2451545.0;                     // Julian date of 2000 Jan 1, 12:00
export const jdFromMs = (ms) => ms / 86400000 + 2440587.5;
export const msFromJd = (jd) => (jd - 2440587.5) * 86400000;
export const AU_KM = 149597870.7;
export const LD_AU = 384400 / AU_KM;               // one lunar distance in au (0.00257)

// JPL Table 1: Keplerian elements and rates per century, valid 1800 AD to 2050 AD (mean ecliptic and equinox J2000).
//          a (au)       e            I (°)         L (°)            ϖ (°)          Ω (°)
export const PLANETS = {
  Mercury: { el: [0.38709927, 0.20563593, 7.00497902, 252.25032350, 77.45779628, 48.33076593],
             rate: [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081] },
  Venus:   { el: [0.72333566, 0.00677672, 3.39467605, 181.97909950, 131.60246718, 76.67984255],
             rate: [0.00000390, -0.00004107, -0.00078890, 58517.81538729, 0.00268329, -0.27769418] },
  Earth:   { el: [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0.0],          // Earth–Moon barycentre
             rate: [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0.0] },
  Mars:    { el: [1.52371034, 0.09339410, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
             rate: [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343] },
  Jupiter: { el: [5.20288700, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
             rate: [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106] },
  Saturn:  { el: [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
             rate: [-0.00125060, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794] },
  Uranus:  { el: [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.95427630, 74.01692503],
             rate: [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589] },
  Neptune: { el: [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
             rate: [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664] },
};

// Solve Kepler's equation M = E − e·sin E (radians). Newton's method; converges in a few steps for e < 1.
export function eccentricAnomaly(M, e) {
  M = Math.atan2(Math.sin(M), Math.cos(M));          // reduce to −π…π
  let E = e < 0.8 ? M : Math.PI * Math.sign(M || 1);
  for (let k = 0; k < 50; k++) {
    const d = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
    E -= d;
    if (Math.abs(d) < 1e-12) break;
  }
  return E;
}

// In-plane (x′, y′) → ecliptic (x, y, z); angles in radians: ω argument of perihelion, i inclination, Ω node.
export function rotate(xp, yp, w, i, O) {
  const cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i), cO = Math.cos(O), sO = Math.sin(O);
  return [
    (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp,
    (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp,
    (sw * si) * xp + (cw * si) * yp,
  ];
}

// Position from elements: a (au), e, i, Ω, ω, M (radians)
export function positionFromElements(a, e, i, O, w, M) {
  const E = eccentricAnomaly(M, e);
  return rotate(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), w, i, O);
}

// A planet's elements at Julian date jd
export function planetElements(name, jd) {
  const T = (jd - J2000) / 36525, p = PLANETS[name];
  const [a, e, I, L, wbar, O] = p.el.map((v, k) => v + p.rate[k] * T);
  return { a, e, i: I * RAD, O: O * RAD, w: (wbar - O) * RAD, M: (L - wbar) * RAD };
}
export function planetPosition(name, jd) {
  const k = planetElements(name, jd);
  return positionFromElements(k.a, k.e, k.i, k.O, k.w, k.M);
}

// An asteroid's elements from NASA NeoWs orbital_data (all strings in the API)
export function asteroidElements(od) {
  const n = Number;
  return {
    a: n(od.semi_major_axis), e: n(od.eccentricity), i: n(od.inclination) * RAD,
    O: n(od.ascending_node_longitude) * RAD, w: n(od.perihelion_argument) * RAD,
    M0: n(od.mean_anomaly) * RAD, n: n(od.mean_motion) * RAD, epoch: n(od.epoch_osculation),
    q: n(od.perihelion_distance), Q: n(od.aphelion_distance), period: n(od.orbital_period),
  };
}
export function asteroidPosition(k, jd) {
  return positionFromElements(k.a, k.e, k.i, k.O, k.w, k.M0 + k.n * (jd - k.epoch));
}

// The whole orbit as a closed path of points (by eccentric anomaly, so the ends of long orbits get enough points)
export function orbitPath(a, e, i, O, w, steps = 360) {
  const pts = [];
  for (let s = 0; s <= steps; s++) {
    const E = (s / steps) * 2 * Math.PI;
    pts.push(rotate(a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E), w, i, O));
  }
  return pts;
}

export const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
