// NASA and ESA Data Projects · Asteroid Tracker · the solar system map · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Draws every near-Earth asteroid (about 43,000), the planets and selected spacecraft around the Sun on a <canvas>,
// at any date, from any angle. Built for smooth movement:
//   • Asteroid positions are worked out only when the date changes (Kepler's equation for each, in typed arrays).
//   • Turning or zooming only re-projects the stored positions, and the dots are written straight into a pixel
//     buffer (ImageData) rather than drawn one by one, so a frame takes a few milliseconds even on a phone.
//   • Nothing is redrawn unless something changed; dragging asks for at most one frame per screen refresh.
//
// Projection, the same as the orbit diagram (orbitview.js): spin φ about the ecliptic pole, then tilt θ:
//   x1 = x·cos φ − y·sin φ,  y1 = x·sin φ + y·cos φ,  screen up = y1·cos θ + z·sin θ

import { planetPosition, planetElements, orbitPath, PLANETS, jdFromMs, wrap180 } from './orbit.js';
export { wrap180 };
import { solvePositions } from './kepler.js';

const RAD = Math.PI / 180;
const K_GAUSS = 0.01720209895;                      // Gaussian gravitational constant: n (rad/day) = k / a^1.5
// orbit classes: colours in DESIGN.md's series order, and plain names
export const CLASSES = {
  APO: { name: 'Apollo', note: 'cross Earth\'s orbit, mostly outside it', rgb: [192, 160, 98] },
  ATE: { name: 'Aten', note: 'cross Earth\'s orbit, mostly inside it', rgb: [138, 169, 201] },
  AMO: { name: 'Amor', note: 'come near Earth\'s orbit from outside', rgb: [143, 185, 150] },
  IEO: { name: 'Atira', note: 'stay inside Earth\'s orbit', rgb: [183, 154, 200] },
  COM: { name: 'Comet', note: 'icy bodies on stretched orbits, such as Halley', rgb: [201, 120, 74] },
};
// the database's comet classes (Jupiter-family, Halley-type, Encke-type, …) all drawn as comets
export const COMET_CODES = new Set(['JFc', 'JFC', 'HTC', 'ETc', 'CTc', 'COM', 'PAR', 'HYP']);
export const classOf = (code) => (COMET_CODES.has(code) ? 'COM' : code);
const HAZ_RGB = [201, 103, 90];
const RISK_RGB = [236, 122, 166];                  // asteroids on an impact-risk list (rose: no orbit type uses it)
const AU_KM = 149597870.7;
const RADIUS_KM = { Mercury: 2440, Venus: 6052, Earth: 6371, Mars: 3390, Jupiter: 69911, Saturn: 58232, Uranus: 25362, Neptune: 24622 };
const FRESH_RGB = [255, 244, 214];                  // found in the year being shown
const PLANET_COL = { Mercury: '#98A0AB', Venus: '#D1A956', Earth: '#8AA9C9', Mars: '#C9784A', Jupiter: '#B79AC8', Saturn: '#D1A956', Uranus: '#8FB996', Neptune: '#8AA9C9' };

// Asteroids as typed arrays (columns), from rows [spkid, name, pdes, a, e, i, om, w, ma, epoch, H, diameter, pha, class]
export const COL = { spkid: 0, name: 1, pdes: 2, a: 3, e: 4, i: 5, om: 6, w: 7, ma: 8, epoch: 9, H: 10, diameter: 11, pha: 12, cls: 13, found: 14, firstSeen: 15 };
export class Asteroids {
  constructor(rows) {
    const n = rows.length;
    this.n = n;
    this.rows = rows;
    const F = (k) => new Float64Array(n);
    this.a = F(); this.e = F(); this.M0 = F(); this.nn = F(); this.ep = F();
    this.m11 = F(); this.m12 = F(); this.m21 = F(); this.m22 = F(); this.m31 = F(); this.m32 = F();
    this.b = F();                                     // a·√(1−e²)
    this.cls = new Uint8Array(n); this.haz = new Uint8Array(n); this.H = new Float32Array(n); this.found = new Int16Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n); this.z = new Float32Array(n);
    const codes = Object.keys(CLASSES);
    for (let k = 0; k < n; k++) {
      const r = rows[k];
      const a = +r[3], e = +r[4], i = +r[5] * RAD, O = +r[6] * RAD, w = +r[7] * RAD;
      this.a[k] = a; this.e[k] = e; this.M0[k] = +r[8] * RAD; this.ep[k] = +r[9];
      this.nn[k] = K_GAUSS / Math.pow(a, 1.5);
      this.b[k] = a * Math.sqrt(1 - e * e);
      // rotation matrix columns for x′ and y′ (see orbit.js rotate())
      const cw = Math.cos(w), sw = Math.sin(w), ci = Math.cos(i), si = Math.sin(i), cO = Math.cos(O), sO = Math.sin(O);
      this.m11[k] = cw * cO - sw * sO * ci; this.m12[k] = -sw * cO - cw * sO * ci;
      this.m21[k] = cw * sO + sw * cO * ci; this.m22[k] = -sw * sO + cw * cO * ci;
      this.m31[k] = sw * si;                this.m32[k] = cw * si;
      this.cls[k] = Math.max(0, codes.indexOf(classOf(r[13])));
      this.found[k] = r[14] || 0;                       // 0: no year (comets): always shown
      this.haz[k] = r[12] === 'Y' || r[12] === 1 ? 1 : 0;
      this.H[k] = r[10] === null ? 99 : +r[10];
    }
    this.jd = null;
  }
  // Positions at Julian date jd: in the background thread when one is running (see useWorker), otherwise here.
  update(jd, quick = false) {
    if (this.worker) { this._ask(jd, quick); return; }
    solvePositions(this, jd, quick);
  }

  // Start the background thread. The first positions are worked out here, so nothing has to wait for the thread.
  // Two sets of position arrays take turns: one is drawn while the thread fills the other.
  useWorker(onReady) {
    let w;
    try { w = new Worker(new URL('./orbitworker.js', import.meta.url), { type: 'module' }); } catch { return false; }
    const cols = ['a', 'e', 'M0', 'nn', 'ep', 'b', 'm11', 'm12', 'm21', 'm22', 'm31', 'm32'];
    w.postMessage({ init: Object.fromEntries(cols.map((c) => [c, this[c]])), n: this.n });
    this.spare = [new Float32Array(this.n), new Float32Array(this.n), new Float32Array(this.n)];
    this._busy = false; this._want = null;
    w.onmessage = (ev) => {
      const { jd, x, y, z } = ev.data;
      this.spare = [this.x, this.y, this.z];
      this.x = x; this.y = y; this.z = z; this.jd = jd;
      this._busy = false;
      onReady && onReady();
      if (this._want && this._want.jd !== jd) { const t = this._want; this._want = null; this._ask(t.jd, t.quick); }
    };
    w.onerror = () => { this.worker = null; w.terminate(); };   // fall back to this thread
    this.worker = w;
    return true;
  }
  _ask(jd, quick) {
    if (jd === this.jd && !this._busy) return;
    if (this._busy || !this.spare) { this._want = { jd, quick }; return; }
    this._busy = true;
    const [x, y, z] = this.spare; this.spare = null;
    this.worker.postMessage({ jd, quick, x, y, z }, [x.buffer, y.buffer, z.buffer]);
  }

  // the whole orbit of one asteroid, for highlighting (kept until another is asked for)
  path(k, steps = 360) {
    if (this._path && this._path.k === k && this._path.steps === steps) return this._path.pts;
    const r = this.rows[k];
    const pts = orbitPath(+r[3], +r[4], +r[5] * RAD, +r[6] * RAD, +r[7] * RAD, steps);
    this._path = { k, steps, pts };
    return pts;
  }
}

// Spacecraft: samples [jd0, stepDays, x0,y0,z0, x1,y1,z1, …] per craft (au, ecliptic, Sun at the centre).
// Between two samples the path is a centripetal Catmull-Rom curve through the samples on either side: it follows tight
// turns, such as Parker Solar Probe's around the Sun, without the corners of straight lines or the overshoot of other
// curves. The spacecraft's dot and its drawn path use the same curve, so the dot always sits on its path.
function craftPoint(s, n, i, t) {
  const P = (k) => { k = Math.max(0, Math.min(n - 1, k)); const o = 2 + k * 3; return [s[o], s[o + 1], s[o + 2]]; };
  const p1 = P(i), p2 = P(i + 1);
  const p0 = i > 0 ? P(i - 1) : p1.map((v, j) => 2 * v - p2[j]);                 // ends: mirror the next point
  const p3 = i + 2 < n ? P(i + 2) : p2.map((v, j) => 2 * v - p1[j]);
  const knot = (a, b) => Math.max(1e-12, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])));
  const t0 = 0, t1 = t0 + knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3), u = t1 + (t2 - t1) * t;
  const mix = (a, b, ta, tb) => a.map((v, j) => ((tb - u) * v + (u - ta) * b[j]) / (tb - ta));
  const A1 = mix(p0, p1, t0, t1), A2 = mix(p1, p2, t1, t2), A3 = mix(p2, p3, t2, t3);
  return mix(mix(A1, A2, t0, t2), mix(A2, A3, t1, t3), t1, t2);
}
export function spacecraftAt(sc, jd) {
  const s = sc.samples, n = (s.length - 2) / 3, f = (jd - s[0]) / s[1];
  if (!(f >= 0) || f > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(f));
  return craftPoint(s, n, i, f - i);
}
// The whole path, worked out once per spacecraft: [x, y, z, jd] points, with extra points between two samples where
// the path bends (one more for about every 4 degrees of turn, up to 12), so curves stay smooth when zoomed in.
export function craftTrack(sc) {
  if (sc._track) return sc._track;
  const s = sc.samples, n = (s.length - 2) / 3, out = [];
  const P = (k) => { const o = 2 + k * 3; return [s[o], s[o + 1], s[o + 2]]; };
  const turn = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], v = [c[0] - b[0], c[1] - b[1], c[2] - b[2]];
    const lu = Math.hypot(...u), lv = Math.hypot(...v);
    return lu && lv ? Math.acos(Math.max(-1, Math.min(1, (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv)))) : 0;
  };
  for (let i = 0; i < n - 1; i++) {
    const bend = Math.max(i > 0 ? turn(P(i - 1), P(i), P(i + 1)) : 0, i + 2 < n ? turn(P(i), P(i + 1), P(i + 2)) : 0);
    const k = Math.min(12, 1 + Math.floor(bend / (4 * RAD)));
    for (let j = 0; j < k; j++) { const p = j ? craftPoint(s, n, i, j / k) : P(i); p.push(s[0] + (i + j / k) * s[1]); out.push(p); }
  }
  if (n) { const p = P(n - 1); p.push(s[0] + (n - 1) * s[1]); out.push(p); }
  sc._track = out;
  return out;
}
// Spacecraft that repeat the same loop many times (Parker Solar Probe around the Sun, Juno around Jupiter) show only
// their last year of flight, so the loops do not pile up; selecting one shows its whole path.
export const RECENT_ONLY = new Set(['-96', '-61']);

// Position at jd from samples [jd, x, y, z, vx, vy, vz] (au, au/day), by cubic Hermite interpolation between the two
// samples around jd, which uses the velocities too; null outside the samples.
export function hermiteAt(rows, jd) {
  if (!rows || !rows.length || jd < rows[0][0] || jd > rows[rows.length - 1][0]) return null;
  let lo = 0, hi = rows.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (rows[mid][0] <= jd) lo = mid; else hi = mid; }
  const a = rows[lo], b = rows[hi], h = b[0] - a[0];
  if (h <= 0) return [a[1], a[2], a[3]];
  const t = (jd - a[0]) / h, t2 = t * t, t3 = t2 * t;
  const h00 = 2 * t3 - 3 * t2 + 1, h10 = t3 - 2 * t2 + t, h01 = -2 * t3 + 3 * t2, h11 = t3 - t2;
  return [1, 2, 3].map((i) => h00 * a[i] + h10 * h * a[i + 3] + h01 * b[i] + h11 * h * b[i + 3]);
}
export function hermiteVel(rows, jd) {          // velocity (au/day), from the derivative of the same curve
  const d = 1 / 1440, p = hermiteAt(rows, jd - d), q = hermiteAt(rows, jd + d);
  return p && q ? [0, 1, 2].map((i) => (q[i] - p[i]) / (2 * d)) : null;
}

export class SolarMap {
  constructor(canvas, opts = {}) {
    this.cv = canvas; this.ctx = canvas.getContext('2d', { alpha: false });
    this.ast = opts.asteroids || null;
    this.spacecraft = opts.spacecraft || [];
    this.interactive = opts.interactive !== false;
    this.tilt = opts.tilt ?? 55; this.spin = opts.spin ?? -20;
    this.viewR = opts.viewR ?? 1.7;                    // au from the centre to the nearer edge of the view
    this.center = 'Sun';                               // 'Sun', 'Earth', or { asteroid: k }, or { craft: i }
    this.panX = 0; this.panY = 0;                      // pan: how far the view is moved off the centre, in au across and up the screen
    this.panMode = false;                              // the pan button: a plain drag pans instead of turning the view
    this.filter = 'all';                               // 'all' | 'haz' | 'big' | 'km' | 'risk'
    this.riskSet = null;                               // Set of row indexes on an impact-risk list (ESA or NASA)
    this.riskMark = true;                              // colour them rose (and, zoomed in, ring each with a diamond)
    this.riskFlag = null;                              // Uint8Array, 1 for each row on a risk list (built from riskSet)
    this.foundMax = 9999;                              // show only objects found by the end of this year
    this.only = null;                                  // a Set of indices: show only these (close passes in a year)
    this.colorBy = 'class';                            // 'class' | 'plain'
    this.highlight = new Set();                        // asteroid indices drawn larger (this week's visitors)
    this.selected = -1;
    this.selectedCraft = -1;                          // the selected spacecraft's index: its whole path is drawn
    this.labels = opts.labels !== false;
    this.quick = false;                                // true while playing: one Newton step per frame
    this.tour = null;                                  // a famous pass: { k, asteroid, earth, moon } Horizons samples
    this.jd = jdFromMs(Date.now());
    this.planets = Object.keys(PLANETS);
    this._dirty = true; this._raf = null; this.onFrame = null;
    this._planetCache = null;
    this.resize();
    new ResizeObserver(() => this.resize()).observe(canvas);
    if (this.interactive) this._bind();
  }

  // ---------------------------------------------------------------- sizing and drawing requests
  resize() {
    const dpr = Math.min(1.5, window.devicePixelRatio || 1);    // 1.5× is sharp enough for dots and keeps frames fast
    const w = Math.max(10, Math.round(this.cv.clientWidth * dpr)), h = Math.max(10, Math.round(this.cv.clientHeight * dpr));
    if (w !== this.cv.width || h !== this.cv.height) {
      this.cv.width = w; this.cv.height = h;
      this.img = this.ctx.createImageData(w, h);
      this.buf = new Uint32Array(this.img.data.buffer);
      this.px = new Uint8ClampedArray(this.img.data.buffer);
    }
    this.dpr = dpr;
    this.request();
  }
  request() {
    this._dirty = true;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; if (this._dirty) { this._dirty = false; this.draw(); } });
  }
  setDate(jd) { this.jd = jd; this.request(); }
  setView(v) { Object.assign(this, v); this.tilt = wrap180(this.tilt); this.spin = wrap180(this.spin); this.viewR = Math.max(0.00006, Math.min(260, this.viewR)); this.request(); }   // zoom limits: about 9,000 km across (Earth fills the view) to past the Voyagers

  // ---------------------------------------------------------------- positions
  // During a famous pass, Earth, the Moon and that asteroid come from NASA/JPL Horizons (which includes Earth's own
  // pull), so the pass is drawn as it really happened; outside the samples the usual formulas take over.
  earthAt(jd) { return (this.tour && hermiteAt(this.tour.earth, jd)) || planetPosition('Earth', jd); }
  moonAt(jd) { return this.tour ? hermiteAt(this.tour.moon, jd) : null; }
  tourAst(jd) { return this.tour ? hermiteAt(this.tour.asteroid, jd) : null; }
  asteroidPos(k) {
    const t = this.tour && this.tour.k === k ? this.tourAst(this.jd) : null;
    return t || [this.ast.x[k], this.ast.y[k], this.ast.z[k]];
  }
  _planetOrbits() {
    const yr = Math.round((this.jd - 2451545) / 365.25), fine = this.viewR < 0.1;   // more points when zoomed in
    if (this._planetCache && this._planetCache.yr === yr && this._planetCache.fine === fine) return this._planetCache.paths;
    const paths = {};
    for (const n of this.planets) { const e = planetElements(n, this.jd); paths[n] = orbitPath(e.a, e.e, e.i, e.O, e.w, fine ? 4000 : n === 'Mercury' ? 120 : 200); }
    this._planetCache = { yr, paths, fine };
    return paths;
  }
  centerPos() {
    if (this.center === 'Earth') return this.earthAt(this.jd);
    if (this.center && this.center.asteroid !== undefined && this.ast) return this.asteroidPos(this.center.asteroid);
    if (this.center && this.center.craft !== undefined) return spacecraftAt(this.spacecraft[this.center.craft], this.jd) || [0, 0, 0];
    return [0, 0, 0];
  }

  // ---------------------------------------------------------------- the frame
  draw() {
    const t0 = performance.now();
    const W = this.cv.width, H = this.cv.height, ctx = this.ctx, dpr = this.dpr;
    if (this.ast) this.ast.update(this.jd, this.quick);
    const c = this.centerPos();
    const cf = Math.cos(this.spin * RAD), sf = Math.sin(this.spin * RAD), ct = Math.cos(this.tilt * RAD), st = Math.sin(this.tilt * RAD);
    const s = (Math.min(W, H) / 2 - 10 * dpr) / this.viewR;
    const cx = W / 2 - this.panX * s, cy = H / 2 + this.panY * s;   // where the centre object falls, after panning
    this._p = { cf, sf, ct, st, cx, cy, s, c };
    const proj = (x, y, z) => {
      x -= c[0]; y -= c[1]; z -= c[2];
      const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
      return [cx + x1 * s, cy - (y1 * ct + z * st) * s, -y1 * st + z * ct];
    };
    this.proj = proj;

    // 1. background and asteroids, straight into the pixel buffer
    const buf = this.buf, px = this.px;
    buf.fill(0xff19110c);                                    // #0C1119, written as ABGR
    if (this.ast) {
      const A = this.ast, X = A.x, Y = A.y, Z = A.z, cls = A.cls, haz = A.haz, Hm = A.H;
      const f = this.filter, hmax = f === 'big' ? 22 : f === 'km' ? 17.75 : 99;
      const plain = this.colorBy === 'plain';
      const cols = Object.values(CLASSES).map((k) => k.rgb);
      const big = (s > 0 && this.viewR < 0.6) || (this.only && this.only.size < 3000) ? 2 : 1;   // zoomed in, or a short list: 2-pixel dots
      const amt = this.viewR > 8 ? 0.55 : 0.8;                   // fainter when far out, so the cloud doesn't glare
      const W4 = W * 4;
      const fmax = this.foundMax, fnd = A.found, only = this.only, rs = this.riskSet;
      if (rs && (!this.riskFlag || this.riskFlag.n !== rs.size)) { this.riskFlag = new Uint8Array(A.n); rs.forEach((k) => (this.riskFlag[k] = 1)); this.riskFlag.n = rs.size; }
      const rf = this.riskMark && rs ? this.riskFlag : null;
      const skip = this.tour && this.tourAst(this.jd) ? this.tour.k : -1;
      const fresh = fmax < 9999 ? fmax : -1;             // found in the year shown: drawn brighter
      for (let k = 0; k < A.n; k++) {
        if (f === 'haz' && !haz[k]) continue;
        if (f === 'risk' && !(rs && rs.has(k))) continue;
        if (Hm[k] > hmax) continue;
        if (fnd[k] > fmax) continue;
        if (only && !only.has(k)) continue;
        if (k === skip) continue;
        const x = X[k] - c[0], y = Y[k] - c[1], z = Z[k] - c[2];
        const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
        const sx = (cx + x1 * s) | 0, sy = (cy - (y1 * ct + z * st) * s) | 0;
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;
        const risky = rf && rf[k] && fnd[k] !== fresh;      // on a risk list: rose, always 2 × 2 pixels and a little brighter
        const rgb = fnd[k] === fresh ? FRESH_RGB : risky ? RISK_RGB : haz[k] && f !== 'all' ? HAZ_RGB : plain ? cols[0] : cols[cls[k]];
        const a2 = risky ? 1 : amt;
        let o = sy * W4 + sx * 4;
        // additive blend: dense regions glow
        px[o] += rgb[0] * a2; px[o + 1] += rgb[1] * a2; px[o + 2] += rgb[2] * a2;
        if (big === 2 || risky) { o += 4; px[o] += rgb[0] * a2; px[o + 1] += rgb[1] * a2; px[o + 2] += rgb[2] * a2;
          o += W4 - 4; px[o] += rgb[0] * a2; px[o + 1] += rgb[1] * a2; px[o + 2] += rgb[2] * a2;
          o += 4; px[o] += rgb[0] * a2; px[o + 1] += rgb[1] * a2; px[o + 2] += rgb[2] * a2; }
      }
    }
    ctx.putImageData(this.img, 0, 0);

    // 2. vector layers on top: plane of Earth's orbit, planets' orbits, the Sun, bodies, labels
    ctx.save();
    ctx.lineJoin = 'round';
    // Lines are sent to the canvas only where they cross the visible area (plus a margin). Zoomed in close, the
    // planets' orbits and the spacecraft paths would otherwise be shapes millions of pixels long, with hundreds of
    // thousands of dashes, which makes a graphics processor stutter even though almost none of it shows.
    const M = 40 * dpr, X0 = -M, Y0 = -M, X1 = W + M, Y1 = H + M;
    // Each segment is cut to that area (Liang-Barsky clipping), so even a segment that runs from far off one side to
    // far off the other is drawn only where it shows. For dashed lines, the cut start is moved back to where a dash
    // begins, so the pattern stays in step with the full line and does not shimmer as the view moves.
    const clip = (ax, ay, bx, by) => {
      const dx = bx - ax, dy = by - ay; let t0 = 0, t1 = 1;
      const edge = (pp, q) => { if (pp === 0) return q >= 0; const r = q / pp;
        if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; } return true; };
      if (edge(-dx, ax - X0) && edge(dx, X1 - ax) && edge(-dy, ay - Y0) && edge(dy, Y1 - ay)) return [t0, t1];
      return null;
    };
    const line = (pts, stroke, width, dash) => {
      const P = dash ? (dash[0] + dash[1]) * dpr : 0;
      ctx.beginPath();
      let prev = null, open = false, acc = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = proj(pts[i][0], pts[i][1], pts[i][2]);
        if (prev) {
          const len = Math.hypot(p[0] - prev[0], p[1] - prev[1]);
          const t = len > 0 ? clip(prev[0], prev[1], p[0], p[1]) : null;
          if (t) {
            if (!open || t[0] > 0) {                       // a new piece starts here
              let d0 = t[0] * len;
              if (P) d0 = Math.max(0, d0 - ((acc + d0) % P));
              const u = d0 / len;
              ctx.moveTo(prev[0] + (p[0] - prev[0]) * u, prev[1] + (p[1] - prev[1]) * u); open = true;
            }
            ctx.lineTo(prev[0] + (p[0] - prev[0]) * t[1], prev[1] + (p[1] - prev[1]) * t[1]);
            if (t[1] < 1) open = false;                    // leaves the area: the next piece starts afresh
          } else open = false;
          acc += len;
        }
        prev = p;
      }
      ctx.strokeStyle = stroke; ctx.lineWidth = width * dpr; ctx.setLineDash(dash ? dash.map((d) => d * dpr) : []); ctx.stroke();
    };
    const paths = this._planetOrbits();
    const visible = (r) => r * s > 6 * dpr;                   // skip orbits too small to see
    for (const n of this.planets) {
      if (!visible(PLANETS[n].el[0])) continue;      // too small to see; off-screen parts are skipped by line()
      line(paths[n], n === 'Earth' ? 'rgba(138,169,201,.85)' : 'rgba(94,103,117,.75)', n === 'Earth' ? 1.4 : 1);
    }
    // close to Earth: the Moon's orbit for scale (384,400 km), in the plane of Earth's orbit
    this.moonRing = null;
    if (this.viewR < 0.06) {
      const e = this.earthAt(this.jd), r = 384400 / 149597870.7, ring = [];
      for (let a = 0; a <= 360; a += 3) ring.push([e[0] + r * Math.cos(a * RAD), e[1] + r * Math.sin(a * RAD), e[2]]);
      line(ring, 'rgba(180,175,162,.55)', 1);
      const q = proj(e[0] + r * Math.SQRT1_2, e[1] - r * Math.SQRT1_2, e[2]), c = proj(e[0], e[1], e[2]);
      if (Math.hypot(q[0] - c[0], q[1] - c[1]) > 46 * dpr) this.moonRing = q;   // labelled only when the ring is large enough
    }
    // selected asteroid's orbit
    if (this.ast && this.selected >= 0) {
      if (this.tour && this.tour.k === this.selected && this.tourAst(this.jd)) {
        // the path it really flew (Horizons), with 8 points between samples along the Hermite curve, so the bend
        // made by Earth's pull stays smooth however far in the view is zoomed
        const T = this.tour;
        if (!T.fine) {
          T.fine = [];
          const tr = T.asteroid;
          for (let i = 0; i + 1 < tr.length; i++) for (let j = 0; j < 8; j++) T.fine.push(hermiteAt(tr, tr[i][0] + (tr[i + 1][0] - tr[i][0]) * j / 8));
          const z = tr[tr.length - 1]; T.fine.push([z[1], z[2], z[3]]);
        }
        line(T.fine, 'rgba(226,200,142,.9)', 1.5);
      } else line(this.ast.path(this.selected, this.viewR < 0.1 ? 4000 : 360), 'rgba(226,200,142,.9)', 1.5);
    }
    // spacecraft tracks
    // every point is used (line() skips what is off screen); recent-only spacecraft from a year before the date shown
    this.spacecraft.forEach((sc, ci) => {
      if (!sc.show) return;
      const tr = craftTrack(sc), from = RECENT_ONLY.has(sc.id) && ci !== this.selectedCraft ? this.jd - 365.25 : -Infinity;
      let a = 0, b = tr.length;
      while (a < b) { const m = (a + b) >> 1; if (tr[m][3] < from) a = m + 1; else b = m; }   // first point in range
      const pts = [];
      for (let i = a; i < tr.length && tr[i][3] <= this.jd; i++) pts.push(tr[i]);
      const now = spacecraftAt(sc, this.jd); if (now) pts.push(now);
      const sel = ci === this.selectedCraft;
      if (pts.length > 1) line(pts, sel ? 'rgba(237,230,211,.55)' : 'rgba(237,230,211,.28)', sel ? 1.3 : 1, [2, 4]);
    });
    // Sun
    // the Sun: a glow, and its true size (696,000 km) once that is bigger than the marker
    const sun = proj(0, 0, 0), sTrue = (696000 / AU_KM) * s, sr = Math.max(7 * dpr, sTrue / 0.7);
    if (sun[0] > -sr * 4 && sun[1] > -sr * 4 && sun[0] < W + sr * 4 && sun[1] < H + sr * 4) {
      const g = ctx.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], sr * 4);
      g.addColorStop(0, 'rgba(226,200,142,.95)'); g.addColorStop(0.3, 'rgba(192,160,98,.35)'); g.addColorStop(1, 'rgba(192,160,98,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun[0], sun[1], sr * 4, 0, 7); ctx.fill();
      ctx.fillStyle = '#E2C88E'; ctx.beginPath(); ctx.arc(sun[0], sun[1], sr * 0.7, 0, 7); ctx.fill();
    }

    this.bodies = [];                                           // for picking and labels
    this.boxes = [];
    for (const n of this.planets) {
      if (!visible(PLANETS[n].el[0])) continue;
      const p = n === 'Earth' ? this.earthAt(this.jd) : planetPosition(n, this.jd), q = proj(p[0], p[1], p[2]);
      // a marker, or the planet's true size when zoomed in far enough for that to be bigger
      const r = Math.max((n === 'Earth' ? 4.5 : ['Jupiter', 'Saturn'].includes(n) ? 5 : 3.5) * dpr, RADIUS_KM[n] / AU_KM * s);
      if (q[0] < -r || q[1] < -r || q[0] > W + r || q[1] > H + r) continue;
      ctx.fillStyle = PLANET_COL[n]; ctx.strokeStyle = '#0C1119'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill(); ctx.stroke();
      this.bodies.push({ kind: 'planet', name: n, x: q[0], y: q[1], r, col: n === 'Earth' ? '#8AA9C9' : '#B4AFA2' });
    }
    // the Moon (during a famous pass, from Horizons)
    const moon = this.moonAt(this.jd);
    if (moon) {
      const q = proj(moon[0], moon[1], moon[2]), r = Math.max(3 * dpr, 1737.4 / AU_KM * s);
      if (q[0] > -r && q[1] > -r && q[0] < W + r && q[1] < H + r) {
        ctx.fillStyle = '#B4AFA2'; ctx.strokeStyle = '#0C1119'; ctx.lineWidth = 1.5 * dpr;
        ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill(); ctx.stroke();
        this.bodies.push({ kind: 'moon', name: 'Moon', x: q[0], y: q[1], r, col: '#B4AFA2' });
      }
    }
    // highlighted asteroids (this week's visitors) and the selected one
    if (this.ast) {
      const A = this.ast;
      ctx.lineWidth = 1.2 * dpr;
      for (const k of this.highlight) {
        const q = proj(A.x[k], A.y[k], A.z[k]);
        ctx.strokeStyle = A.haz[k] ? '#C9675A' : '#E2C88E';
        ctx.beginPath(); ctx.arc(q[0], q[1], 3.5 * dpr, 0, 7); ctx.stroke();
      }
      // asteroids on an impact-risk list, zoomed in (closer than about Venus's distance across): a small diamond round
      // each, drawn as one path. Further out they are many hundreds on screen, and their rose colour is enough.
      if (this.riskMark && this.riskSet && this.riskSet.size && this.viewR <= 0.35) {
        const f = this.filter, hmax = f === 'big' ? 22 : f === 'km' ? 17.75 : 99, d = 4 * dpr;
        ctx.strokeStyle = 'rgba(236,122,166,.9)'; ctx.lineWidth = 1.2 * dpr; ctx.beginPath();
        for (const k of this.riskSet) {
          if ((f === 'haz' && !A.haz[k]) || A.H[k] > hmax || A.found[k] > this.foundMax || (this.only && !this.only.has(k))) continue;
          const q = proj(A.x[k], A.y[k], A.z[k]);
          if (q[0] < -d || q[1] < -d || q[0] > W + d || q[1] > H + d) continue;
          ctx.moveTo(q[0], q[1] - d); ctx.lineTo(q[0] + d, q[1]); ctx.lineTo(q[0], q[1] + d); ctx.lineTo(q[0] - d, q[1]); ctx.closePath();
        }
        ctx.stroke();
      }
      if (this.selected >= 0) {
        const k = this.selected, sp = this.asteroidPos(k), q = proj(sp[0], sp[1], sp[2]);
        ctx.fillStyle = A.haz[k] ? '#C9675A' : '#E2C88E';
        ctx.beginPath(); ctx.arc(q[0], q[1], 4.5 * dpr, 0, 7); ctx.fill();
        ctx.strokeStyle = '#E2C88E'; ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.arc(q[0], q[1], 10 * dpr, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        this.bodies.push({ kind: 'asteroid', name: A.rows[k][1].trim(), x: q[0], y: q[1], r: 11 * dpr, col: '#E2C88E', k });   // r clears the 10 px ring
      }
    }
    // spacecraft: a small brass cross in a ring
    this.spacecraft.forEach((sc, i) => {
      if (!sc.show) return;
      const p = spacecraftAt(sc, this.jd); if (!p) return;
      const q = proj(p[0], p[1], p[2]), r = 5 * dpr;
      if (q[0] < -20 || q[1] < -20 || q[0] > W + 20 || q[1] > H + 20) return;
      ctx.strokeStyle = '#EDE6D3'; ctx.lineWidth = 1.3 * dpr;
      ctx.beginPath(); ctx.moveTo(q[0] - r, q[1]); ctx.lineTo(q[0] + r, q[1]); ctx.moveTo(q[0], q[1] - r); ctx.lineTo(q[0], q[1] + r); ctx.stroke();
      ctx.beginPath(); ctx.arc(q[0], q[1], r * 0.55, 0, 7); ctx.stroke();
      const apart = Math.hypot(q[0] - sun[0], q[1] - sun[1]) > 60 * dpr;
      this.bodies.push({ kind: 'craft', name: sc.name, x: q[0], y: q[1], r, col: '#EDE6D3', i, quiet: !apart });
    });
    // labels, with simple collision avoidance
    if (this.labels) {
      ctx.font = `${12 * dpr}px Georgia, "Palatino Linotype", serif`;
      ctx.textBaseline = 'alphabetic';
      for (const b of this.bodies) this.boxes.push([b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r]);
      const order = this.bodies.slice().sort((p, q) => (q.kind === 'asteroid') - (p.kind === 'asteroid') || (q.name === 'Earth') - (p.name === 'Earth'));
      for (const b of order) if (!b.quiet) this._label(ctx, b, W, H, dpr);
      if (this.moonRing) this._label(ctx, { name: "the Moon's orbit", x: this.moonRing[0], y: this.moonRing[1], r: 2 * dpr, col: '#98A0AB' }, W, H, dpr);
    }
    ctx.restore();
    this.frameMs = performance.now() - t0;
    this.onFrame && this.onFrame(this);
  }
  _label(ctx, b, W, H, dpr) {
    const w = ctx.measureText(b.name).width, h = 12 * dpr, o = b.r + 4 * dpr;
    const spots = [[o, -o * 0.3], [o, o + h * 0.7], [-o - w, -o * 0.3], [-o - w, o + h * 0.7], [-w / 2, -o - 2 * dpr], [-w / 2, o + h]];
    for (const [dx, dy] of spots) {
      const bx = [b.x + dx - 2, b.y + dy - h, b.x + dx + w + 2, b.y + dy + 3];
      if (bx[0] < 2 || bx[2] > W - 2 || bx[1] < 2 || bx[3] > H - 2) continue;
      if (this.boxes.some((q) => bx[0] < q[2] && bx[2] > q[0] && bx[1] < q[3] && bx[3] > q[1])) continue;
      this.boxes.push(bx);
      ctx.fillStyle = b.col; ctx.fillText(b.name, b.x + dx, b.y + dy);
      return;
    }
  }

  // ---------------------------------------------------------------- picking: the nearest object to a screen point
  pick(clientX, clientY, maxPx = 12) {
    const r = this.cv.getBoundingClientRect(), dpr = this.dpr;
    const X = (clientX - r.left) * dpr, Y = (clientY - r.top) * dpr, lim = (maxPx * dpr) ** 2;
    let best = null, bd = lim;
    for (const b of this.bodies || []) { const d = (b.x - X) ** 2 + (b.y - Y) ** 2; if (d < bd) { bd = d; best = b; } }
    if (best) return best;
    if (!this.ast || !this._p) return null;
    const { cf, sf, ct, st, cx, cy, s, c } = this._p, A = this.ast, f = this.filter, hmax = f === 'big' ? 22 : f === 'km' ? 17.75 : 99;
    let bk = -1;
    for (let k = 0; k < A.n; k++) {
      if ((f === 'haz' && !A.haz[k]) || (f === 'risk' && !(this.riskSet && this.riskSet.has(k))) || A.H[k] > hmax || A.found[k] > this.foundMax || (this.only && !this.only.has(k))) continue;
      const x = A.x[k] - c[0], y = A.y[k] - c[1], z = A.z[k] - c[2];
      const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
      const d = (cx + x1 * s - X) ** 2 + (cy - (y1 * ct + z * st) * s - Y) ** 2;
      if (d < bd) { bd = d; bk = k; }
    }
    return bk >= 0 ? { kind: 'asteroid', k: bk, name: A.rows[bk][1].trim() } : null;
  }

  // Pixels per au on the canvas, and a point on screen (CSS px from the canvas's top left) as a position across
  // and up the screen plane (au, measured from the centre object).
  _scale() { return (Math.min(this.cv.width, this.cv.height) / 2 - 10 * this.dpr) / this.viewR; }
  _screenToPlane(px, py) {
    const s = this._scale(), W = this.cv.width, H = this.cv.height;
    return [this.panX + (px * this.dpr - W / 2) / s, this.panY + (H / 2 - py * this.dpr) / s];
  }
  // Zoom to viewR keeping the point under (px, py) where it is, so the wheel and a pinch zoom towards the pointer.
  zoomAt(viewR, px, py) {
    const [u, v] = this._screenToPlane(px, py);
    this.setView({ viewR });
    const s = this._scale(), W = this.cv.width, H = this.cv.height;
    this.panX = u - (px * this.dpr - W / 2) / s; this.panY = v - (H / 2 - py * this.dpr) / s;
    this.request();
  }
  // Pan by a drag of (dx, dy) CSS pixels: the map follows the pointer.
  panBy(dx, dy, from) {
    const s = this._scale();
    this.panX = from[0] - dx * this.dpr / s; this.panY = from[1] + dy * this.dpr / s;
    this.request();
  }

  // ---------------------------------------------------------------- input
  // Drag to turn the view; drag with the middle or right button, with Shift held, or with the pan button on, to pan;
  // on a touch screen, two fingers pinch to zoom and drag to pan. The wheel and a pinch zoom towards the pointer.
  _bind() {
    const cv = this.cv, ptrs = new Map();
    let start = null, pinch = null, moved = false;
    const local = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    cv.addEventListener('contextmenu', (e) => e.preventDefault());     // the right button pans
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (e.button === 1) e.preventDefault();                          // no auto-scroll on the middle button
      const pan = e.button === 1 || e.button === 2 || e.shiftKey || this.panMode;
      if (ptrs.size === 1) start = { x: e.clientX, y: e.clientY, spin: this.spin, tilt: this.tilt, pan, from: [this.panX, this.panY] };
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: this.viewR, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, from: [this.panX, this.panY] };
        start = null;
      }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) { this.onHover && this.onHover(e); return; }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        // two fingers: the midpoint pans, the spread zooms about the midpoint
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
        this.panBy(mx - pinch.mx, my - pinch.my, pinch.from);
        const r = cv.getBoundingClientRect();
        this.zoomAt(pinch.r * pinch.d / Math.max(10, d), mx - r.left, my - r.top);
        pinch.r = this.viewR; pinch.d = d; pinch.mx = mx; pinch.my = my; pinch.from = [this.panX, this.panY];
        moved = true; this.onView && this.onView();
      } else if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true; cv.classList.add(start.pan ? 'panning' : 'dragging');
        if (start.pan) this.panBy(dx, dy, start.from);
        else this.setView({ spin: start.spin + dx * 0.35, tilt: start.tilt + dy * 0.3 });
        this.onView && this.onView();
      }
    });
    const end = (e) => {
      const wasTap = !moved && ptrs.size === 1 && start;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) { cv.classList.remove('dragging', 'panning'); if (wasTap && e.type === 'pointerup' && e.button === 0) this.onTap && this.onTap(e); start = null; }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', (e) => { if (!ptrs.size) this.onLeave && this.onLeave(e); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [px, py] = local(e);
      this.zoomAt(this.viewR * Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015)), px, py);
      this.onView && this.onView();
    }, { passive: false });
    cv.addEventListener('dblclick', (e) => { const [px, py] = local(e); this.zoomAt(this.viewR / 2, px, py); this.onView && this.onView(); });
    cv.addEventListener('keydown', (e) => {
      const k = e.key, step = e.shiftKey ? 15 : 5, p = 0.08 * this.viewR;
      if (e.altKey && k.startsWith('Arrow')) {                         // Alt + arrows pan
        this.panX += k === 'ArrowLeft' ? -p : k === 'ArrowRight' ? p : 0; this.panY += k === 'ArrowDown' ? -p : k === 'ArrowUp' ? p : 0;
        this.request(); e.preventDefault(); this.onView && this.onView(); return;
      }
      if (k === 'ArrowLeft') this.setView({ spin: this.spin - step });
      else if (k === 'ArrowRight') this.setView({ spin: this.spin + step });
      else if (k === 'ArrowUp') this.setView({ tilt: this.tilt - step });
      else if (k === 'ArrowDown') this.setView({ tilt: this.tilt + step });
      else if (k === '+' || k === '=') this.setView({ viewR: this.viewR / 1.25 });
      else if (k === '-' || k === '_') this.setView({ viewR: this.viewR * 1.25 });
      else return;
      e.preventDefault(); this.onView && this.onView();
    });
  }
}
