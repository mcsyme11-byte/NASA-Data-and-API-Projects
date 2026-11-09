// NASA Data Projects · the home page's live preview of the solar system map · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The potentially hazardous asteroids (about 2,500, data/preview.json) and the planets, turning slowly and moving
// through time. Not interactive: a click opens the full map. Pauses when off screen or in a background tab, and
// stays still for people who prefer reduced motion.

import { SolarMap, Asteroids } from './skymap.js';
import { jdFromMs } from './orbit.js';

export async function mountPreview(canvas, dataUrl, { onCount } = {}) {
  const res = await fetch(dataUrl);
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  const ast = new Asteroids(data.rows);
  const map = new SolarMap(canvas, { asteroids: ast, interactive: false, tilt: 58, spin: -30, viewR: 1.9, labels: true });
  map.quick = true;                       // animation only: one Newton step per frame is plenty
  map.planets = ['Mercury', 'Venus', 'Earth', 'Mars'];
  map.colorBy = 'plain';
  onCount && onCount(data.total || ast.n, ast.n);
  let jd = jdFromMs(Date.now()), last = 0, visible = true, raf = null;
  map.setDate(jd);
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return map;
  const frame = (t) => {
    raf = null;
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0; last = t;
    jd += dt * 6;                         // 6 days a second
    map.spin += dt * 2.5;                 // a slow turn
    map.setDate(jd);
    loop();
  };
  const loop = () => { if (visible && !document.hidden && !raf) raf = requestAnimationFrame(frame); };
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = 0; loop(); }).observe(canvas);
  document.addEventListener('visibilitychange', () => { last = 0; loop(); });
  loop();
  return map;
}
