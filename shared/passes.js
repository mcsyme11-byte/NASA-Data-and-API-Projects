// NASA and ESA Data Projects · when an asteroid can be seen from a place · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// From asteroid-tracker/data/sky.json (Horizons geocentric vectors around each close pass) and the visitor's place,
// every 20 minutes through the samples (from now on):
//   dark   the Sun at least 12° below the horizon (nautical twilight is over)
//   up     the asteroid at least 10° above the horizon (lower, it is lost in haze and trees)
//   seen   dark and up; its brightness V from the H, G system (shared/sky.js)
// The best moment of a pass is the brightest "seen" moment (the highest one when two are equally bright); the night
// it falls in is shown hour by hour. A pass with no "seen" moment is "not from here" (below the horizon at night, or
// only up in daylight).

import { jdFromMs, observer, topocentric, sunVector, asteroidVector, magnitudeHG, needFor, compass } from './sky.js';

export const DARK_SUN = -12, MIN_ALT = 10, STEP_MIN = 20;

export function lookAt(obj, place, jd) {
  const v = asteroidVector(obj, jd);
  if (!v) return null;
  const o = observer(place.lat, place.lon, jd), sun = sunVector(jd), t = topocentric(v, o, jd), s = topocentric(sun, o, jd);
  // brightness from the observer's geometry is the same as from Earth's centre to well under 0.01 magnitude
  const mag = magnitudeHG(obj.H, v, sun);
  return { jd, alt: t.alt, trueAlt: t.trueAlt, az: t.az, km: t.km, ra: t.ra, dec: t.dec, sunAlt: s.trueAlt, mag };
}

export function passFor(obj, place, fromJd = jdFromMs(Date.now())) {
  const n = obj.xyz.length / 3, end = obj.t0 + (n - 1) * obj.step, step = STEP_MIN / 1440;
  let best = null, seen = 0, upAny = false;
  for (let jd = Math.max(fromJd, obj.t0); jd <= end; jd += step) {
    const p = lookAt(obj, place, jd);
    if (!p) continue;
    if (p.trueAlt > 0) upAny = true;
    if (p.sunAlt < DARK_SUN && p.trueAlt >= MIN_ALT) {
      seen++;
      if (!best || p.mag < best.mag - 0.05 || (Math.abs(p.mag - best.mag) <= 0.05 && p.alt > best.alt)) best = p;
    }
  }
  if (!best) return { obj, visible: false, upAny, need: needFor(obj.est_mag ?? 99), reason: upAny ? 'only up in daylight' : 'below your horizon' };
  // that night: from the evening before to the morning after the best moment, its highest point while dark
  const night = nightCurve(obj, place, best.jd);
  const top = night.points.filter((q) => q.dark && q.trueAlt >= MIN_ALT).reduce((a, q) => (!a || q.alt > a.alt ? q : a), null) || best;
  return { obj, visible: true, best, top, night, minutes: seen * STEP_MIN, need: needFor(best.mag), dir: compass(top.az) };
}

// The night around jd: 12 hours either side, every 20 minutes, with the Sun's altitude to shade darkness.
export function nightCurve(obj, place, jd) {
  const points = [], step = STEP_MIN / 1440;
  for (let t = jd - 0.5; t <= jd + 0.5 + 1e-9; t += step) {
    const p = lookAt(obj, place, t);
    if (p) points.push({ ...p, dark: p.sunAlt < DARK_SUN });
  }
  return { from: jd - 0.5, to: jd + 0.5, points };
}

export function passesFor(objects, place, fromJd) {
  const out = (objects || []).map((o) => passFor(o, place, fromJd));
  // seen ones first, brightest first; then the rest by closest approach
  out.sort((a, b) => (b.visible - a.visible) || (a.visible ? a.best.mag - b.best.mag : a.obj.ca_jd - b.obj.ca_jd));
  return out;
}
