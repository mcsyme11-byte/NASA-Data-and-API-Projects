// NASA and ESA Data Projects · Earth satellites from their orbital elements · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Positions of satellites in Earth orbit from CelesTrak's published orbital elements (two-line element sets, TLEs),
// copied daily into spacecraft/data/tle.json by the spacecraft data job. The SGP4 model is satellite.js (MIT,
// shared/vendor/). Used by Sky Finder (the space stations' passes over the visitor) and the Spacecraft map.
//
// Rules used for a pass that can be seen with the eye:
//   up       the satellite at least 10° above the horizon
//   dark     the Sun at least 6° below the horizon for the observer (the sky dark enough)
//   lit      the satellite in sunlight: outside Earth's shadow, taken as a cylinder of Earth's radius behind Earth
// A pass is seen while all three hold. Elements a few days old are good to a few seconds of time; a week old, to a
// minute or so, which is why the job copies them every day.

import * as sat from './vendor/satellite.min.js';
import { sunVector, refraction, jdFromMs } from './sky.js';

const RAD = Math.PI / 180, DEG = 180 / Math.PI, R_EARTH = 6371;
export const SAT_MIN_ALT = 10, SAT_DARK_SUN = -6;

export function satrecOf(t) {
  try { const r = sat.twoline2satrec(t.line1, t.line2); return r && !r.error ? r : null; } catch { return null; }
}

// Where a satellite is at time ms: the Earth-centred vector (km, TEME ≈ equator of date), and as seen from a place.
export function satAt(rec, ms) {
  const d = new Date(ms), pv = sat.propagate(rec, d);
  if (!pv || !pv.position || !Number.isFinite(pv.position.x)) return null;
  return { eci: [pv.position.x, pv.position.y, pv.position.z], gmst: sat.gstime(d) };
}
export function satLook(rec, place, ms) {
  const s = satAt(rec, ms);
  if (!s) return null;
  const ecf = sat.eciToEcf({ x: s.eci[0], y: s.eci[1], z: s.eci[2] }, s.gmst);
  const look = sat.ecfToLookAngles({ latitude: place.lat * RAD, longitude: place.lon * RAD, height: 0 }, ecf);
  const trueAlt = look.elevation * DEG;
  return { alt: trueAlt + refraction(trueAlt), trueAlt, az: ((look.azimuth * DEG) % 360 + 360) % 360, km: look.rangeSat, eci: s.eci, lit: sunlit(s.eci, ms) };
}
// In sunlight: not inside the cylinder of Earth's shadow.
export function sunlit(eci, ms) {
  const sv = sunVector(jdFromMs(ms)), n = Math.hypot(...sv), s = sv.map((v) => v / n);
  const along = eci[0] * s[0] + eci[1] * s[1] + eci[2] * s[2];
  if (along >= 0) return true;
  return Math.hypot(eci[0] - along * s[0], eci[1] - along * s[1], eci[2] - along * s[2]) > R_EARTH;
}

// The passes that can be seen from a place between fromMs and toMs: start, highest point and end of each.
// sunAlt(ms) gives the Sun's altitude for the place (degrees).
export function visiblePasses(rec, place, fromMs, toMs, sunAlt) {
  const out = [];
  let cur = null;
  const STEP = 20 * 1000;
  for (let ms = fromMs; ms <= toMs; ms += STEP) {
    const l = satLook(rec, place, ms);
    const seen = l && l.trueAlt >= SAT_MIN_ALT && l.lit && sunAlt(ms) <= SAT_DARK_SUN;
    if (seen) {
      if (!cur) cur = { start: { ms, ...l }, top: { ms, ...l }, end: { ms, ...l } };
      if (l.alt > cur.top.alt) cur.top = { ms, ...l };
      cur.end = { ms, ...l };
    } else if (cur) { out.push(cur); cur = null; }
    // far below the horizon: skip ahead (a low orbit rises at most about every 90 minutes)
    if (!seen && l && l.trueAlt < -40) ms += 4 * 60 * 1000;
  }
  if (cur) out.push(cur);
  return out;
}
