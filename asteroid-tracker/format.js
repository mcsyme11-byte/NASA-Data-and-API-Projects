// NASA and ESA Data Projects · Asteroid Tracker · units and formatting · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Rules for the numbers on this page:
//   Moon distances:  LD = km ÷ 384,400                 (1 LD is the Moon's average distance)
//   from au:         km = au × 149,597,870.7
//   speed:           km/h = km/s × 3,600
//   size from brightness (absolute magnitude H, albedo p = how much light the surface reflects):
//                    D (km) = 1329 ÷ √p × 10^(−H ÷ 5)
//                    p = 0.25 (bright surface) gives the smallest likely size, p = 0.05 (dark) the largest.
//                    Example: H = 22 → 106 m to 237 m. NASA's NeoWs gives this range itself; JPL's data gives H only.

import { compareSize } from './compare.js';
import { fmt } from '../shared/nasa.js';
export { fmt };

export const LD_KM = 384400;
export const AU_KM = 149597870.7;
export const DAY_MS = 86400000;

export const diameterM = (H, albedo) => 1329 / Math.sqrt(albedo) * Math.pow(10, -H / 5) * 1000;

function metres(v, other) {
  if (Math.max(v, other) >= 1000) return fmt(v / 1000, 1);
  return fmt(v, Math.max(v, other) < 10 ? 1 : 0);
}

// "106–237 m", "0.5–1.1 km", or "about 16.8 km" when a measured diameter is known
export function sizeText(o) {
  if (!(o.dmax > 0)) return 'unknown';
  if (o.measured) return 'about ' + (o.dmax >= 1000 ? fmt(o.dmax / 1000, 1) + ' km' : fmt(o.dmax, o.dmax < 10 ? 1 : 0) + ' m');
  const unit = o.dmax >= 1000 ? ' km' : ' m';
  return metres(o.dmin, o.dmax) + '–' + metres(o.dmax, o.dmin) + unit;
}

// "Nov 9" or "Nov 9, 00:15" (UTC)
export function dateText(t, withTime = false) {
  const d = new Date(t);
  const s = d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  return withTime ? s + ', ' + d.toISOString().slice(11, 16) : s;
}

// Things people can picture
// The size next to something familiar (rules in compare.js), as a note: "about 3 times the length of an NHL hockey rink (61 m)".
export function sizePicture(o) {
  const t = compareSize(o.dmin, o.dmax);
  return t ? t[0].toLowerCase() + t.slice(1) : '';
}
