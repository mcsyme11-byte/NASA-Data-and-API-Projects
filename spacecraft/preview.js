// NASA and ESA Data Projects · the home page's preview of the spacecraft map · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The spacecraft map's solar-system view, at today's date, turning slowly. Not interactive: a click opens the full
// map. Pauses when off screen or in a background tab, and stays still for people who prefer reduced motion.

import { SpaceMap } from './spacemap.js';
import { satrecOf } from '../shared/sats.js';
import { AU_KM } from '../asteroid-tracker/orbit.js';

const getJson = (u) => fetch(u).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));

export async function mountCraftPreview(canvas, base, { onCount } = {}) {
  const [cat, pos, tle] = await Promise.allSettled([getJson(base + 'catalogue.json'), getJson(base + 'data/positions.json'), getJson(base + 'data/tle.json')]);
  if (cat.status !== 'fulfilled') throw new Error('catalogue');
  const P = pos.status === 'fulfilled' ? pos.value.craft || {} : {}, T = tle.status === 'fulfilled' ? tle.value.sats || [] : [];
  const tleBy = Object.fromEntries(T.map((s) => [s.key, s]));
  const craft = [];
  for (const info of cat.value.craft) {
    if (info.src.tle) { const rec = tleBy[info.key] && satrecOf(tleBy[info.key]); if (rec) craft.push({ key: info.key, info, parent: 'Earth', rec }); continue; }
    const s = P[info.key];
    if (s && s.xyz && s.xyz.length >= 6) craft.push({ key: info.key, id: info.key, info, parent: s.parent, local: !!info.src.local, samples: [s.jd0, s.step, ...s.xyz.map((v) => v / AU_KM)] });
  }
  if (!craft.length) throw new Error('no positions');
  const map = new SpaceMap(canvas, { interactive: false, tilt: 58, spin: -30, viewR: 6.2 });
  map.craft = craft;
  map.far = new Set();                          // no edge arrows in the preview
  onCount && onCount(craft.length);
  map.request();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return map;
  let last = 0, visible = true, raf = null;
  const frame = (t) => {
    raf = null;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
    map.spin += dt * 2.5;                       // a slow turn
    map.request();
    loop();
  };
  const loop = () => { if (visible && !document.hidden && !raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; loop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { last = 0; loop(); });
  loop();
  return map;
}
