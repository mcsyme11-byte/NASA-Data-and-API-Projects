// NASA and ESA Data Projects · Sky Finder · what is in the sky · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Everything Sky Finder can point at, worked out in the browser from the visitor's place and the time:
//   asteroids   ../asteroid-tracker/data/sky.json (NASA/JPL close approaches and Horizons vectors)
//   Moon, planets, Sun   shared/sky.js (the Sun only to warn: never point anything at it)
//   bright stars  data/stars.json (d3-celestial, from the Hipparcos catalogue; names for the brightest)
//   space stations  ../spacecraft/data/tle.json (CelesTrak orbital elements; SGP4 in shared/sats.js)
// Nothing about the place is sent anywhere: the files are the same for every visitor.

import { jdFromMs, observer, topocentric, sunVector, moonVector, moonPhase, planetVector, starVector, compassWord, needFor } from '../shared/sky.js';
import { passesFor, lookAt } from '../shared/passes.js';
import { satrecOf, satLook, visiblePasses } from '../shared/sats.js';

const URLS = {
  sky: new URL('../asteroid-tracker/data/sky.json', import.meta.url),
  stars: new URL('data/stars.json', import.meta.url),
  tle: new URL('../spacecraft/data/tle.json', import.meta.url),
};
// The planets that can be seen with the eye, with a word for how they look.
export const PLANETS = [
  ['Venus', 'the brightest point in the sky after the Moon'], ['Jupiter', 'very bright, steady light'],
  ['Mars', 'bright, orange-red'], ['Saturn', 'bright, yellowish'], ['Mercury', 'low, in twilight'],
];
// The two crewed space stations (names as CelesTrak lists them).
export const STATIONS = [['ISS (ZARYA)', 'International Space Station'], ['CSS (TIANHE)', 'Tiangong space station']];

const getJson = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
let cache = null;
// Loads the three files; any that fails is reported in .errors and left empty.
export async function loadSky() {
  if (cache) return cache;
  const [sky, stars, tle] = await Promise.allSettled([getJson(URLS.sky), getJson(URLS.stars), getJson(URLS.tle)]);
  const sats = [];
  if (tle.status === 'fulfilled') {
    for (const [name, label] of STATIONS) {
      const t = (tle.value.sats || []).find((s) => s.name === name || s.key === (name.startsWith('ISS') ? 'iss' : 'tiangong'));
      const rec = t && satrecOf(t);
      if (rec) sats.push({ name: label, short: label.split(' ')[0] === 'International' ? 'ISS' : 'Tiangong', rec, epoch: t.epoch });
    }
  }
  cache = {
    asteroids: sky.status === 'fulfilled' ? sky.value.objects || [] : [],
    updated: sky.status === 'fulfilled' ? sky.value.updated : null,
    stars: stars.status === 'fulfilled' ? stars.value : [],
    sats,
    errors: { sky: sky.status !== 'fulfilled', stars: stars.status !== 'fulfilled', tle: tle.status !== 'fulfilled' },
  };
  return cache;
}
export function resetSky() { cache = null; }

export const sunAltAt = (place, ms) => { const jd = jdFromMs(ms); return topocentric(sunVector(jd), observer(place.lat, place.lon, jd), jd).trueAlt; };

// Tonight: from now (or this evening, by day) to tomorrow's dawn. Times when the Sun is 12° down (dark) and 6° down.
export function tonight(place, now = Date.now()) {
  const STEP = 5 * 60 * 1000;
  let darkFrom = null, darkTo = null, from = now;
  // by day: start at dusk
  for (let ms = now; ms < now + 26 * 3600e3; ms += STEP) {
    const a = sunAltAt(place, ms);
    if (a <= -12 && darkFrom === null) darkFrom = ms;
    if (darkFrom !== null && a > -12) { darkTo = ms; break; }
  }
  if (darkFrom === null) return { from, to: now + 12 * 3600e3, darkFrom: null, darkTo: null, noDark: true };   // summer near the poles
  const twilight = (() => { for (let ms = darkFrom; ms > now - 1; ms -= STEP) if (sunAltAt(place, ms) > -6) return ms; return now; })();
  return { from: Math.max(now, twilight), to: darkTo || now + 18 * 3600e3, darkFrom, darkTo, noDark: false };
}

// Where each kind of thing is at time ms, for the camera view: [{key, kind, name, alt, az, mag?, label}].
export function positions(sky, place, ms, chosen) {
  const jd = jdFromMs(ms), obs = observer(place.lat, place.lon, jd), out = [];
  const sun = topocentric(sunVector(jd), obs, jd);
  out.push({ key: 'sun', kind: 'sun', name: 'Sun', alt: sun.alt, az: sun.az });
  const moon = topocentric(moonVector(jd), obs, jd), ph = moonPhase(jd);
  out.push({ key: 'moon', kind: 'moon', name: 'Moon', alt: moon.alt, az: moon.az, lit: ph.lit, waxing: ph.waxing });
  for (const [name] of PLANETS) {
    const p = topocentric(planetVector(name, jd), obs, jd);
    out.push({ key: name.toLowerCase(), kind: 'planet', name, alt: p.alt, az: p.az });
  }
  for (const s of sky.stars) {
    if (s[2] > 3.6 && !s[3]) continue;
    const p = topocentric(starVector(s[0], s[1], jd), obs, jd);
    if (p.alt > -2) out.push({ key: 'star', kind: 'star', name: s[3] || '', alt: p.alt, az: p.az, mag: s[2] });
  }
  for (const s of sky.sats) {
    const l = satLook(s.rec, place, ms);
    if (l) out.push({ key: s.short.toLowerCase(), kind: 'station', name: s.short, alt: l.alt, az: l.az, lit: l.lit });
  }
  for (const a of sky.asteroids) {
    const l = lookAt(a, place, jd);
    if (l) out.push({ key: 'ast:' + a.des, kind: 'asteroid', name: a.name, alt: l.alt, az: l.az, mag: l.mag, chosen: chosen === a.des, obj: a });
  }
  return out;
}

// An asteroid's path for the camera: every 20 minutes from 2 hours before to 6 hours after ms, with the hours marked.
export function pathOf(obj, place, ms) {
  const pts = [];
  for (let k = -6; k <= 18; k++) {
    const t = ms + k * 20 * 60 * 1000, l = lookAt(obj, place, jdFromMs(t));
    if (l) pts.push({ ms: t, alt: l.alt, az: l.az, hour: new Date(t).getMinutes() < 20 && k !== 0 });
  }
  return pts;
}

// The home list: asteroid passes (tonight first), and what else is up tonight.
export function tonightList(sky, place, now = Date.now()) {
  const night = tonight(place, now);
  const passes = passesFor(sky.asteroids, place, jdFromMs(now));
  const mid = night.darkFrom ? (night.darkFrom + (night.darkTo || night.darkFrom + 6 * 3600e3)) / 2 : now;
  const jdMid = jdFromMs(mid);
  const sample = (vecAt) => {      // highest point while dark tonight
    let top = null;
    for (let ms = night.from; ms <= night.to; ms += 15 * 60 * 1000) {
      const jd = jdFromMs(ms), p = topocentric(vecAt(jd), observer(place.lat, place.lon, jd), jd);
      if (p.trueAlt > 5 && (!top || p.alt > top.alt)) top = { ...p, ms };
    }
    return top;
  };
  const moonTop = sample(moonVector), ph = moonPhase(jdMid);
  const planets = PLANETS.map(([name, look]) => ({ name, look, top: sample((jd) => planetVector(name, jd)) })).filter((p) => p.top);
  const stations = [];
  for (const s of sky.sats) {
    const ps = visiblePasses(s.rec, place, night.from, night.to, (ms) => sunAltAt(place, ms));
    if (ps.length) stations.push({ name: s.name, short: s.short, passes: ps });
  }
  return { night, passes, moon: { top: moonTop, lit: ph.lit, waxing: ph.waxing }, planets, stations };
}

export const dirText = (az) => compassWord(az);
export { needFor };
