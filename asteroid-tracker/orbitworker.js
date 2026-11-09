// NASA and ESA Data Projects · Asteroid Tracker · the map's background thread · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Works out the positions of every asteroid for the map (kepler.js) so the page's own thread only draws. The page
// sends the orbits once, then a date and three position arrays to fill; the arrays go back and forth without copying.

import { solvePositions } from './kepler.js';

let S = null;
self.onmessage = (ev) => {
  const m = ev.data;
  if (m.init) { S = { ...m.init, n: m.n, jd: null }; return; }
  S.x = m.x; S.y = m.y; S.z = m.z;
  solvePositions(S, m.jd, m.quick, true);
  self.postMessage({ jd: m.jd, x: S.x, y: S.y, z: S.z }, [S.x.buffer, S.y.buffer, S.z.buffer]);
};
