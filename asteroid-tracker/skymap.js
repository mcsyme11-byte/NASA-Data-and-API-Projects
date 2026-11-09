// NASA Data Projects · Asteroid Tracker · the solar system map · © 2026 Malcolm Syme · mcsyme11@gmail.com
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

import { planetPosition, planetElements, orbitPath, PLANETS, jdFromMs } from './orbit.js';

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
  // Positions at Julian date jd (au, ecliptic J2000). When the date has moved only a little since the last call
  // (playing, stepping), each asteroid's previous eccentric anomaly is the starting guess for Kepler's equation,
  // so one or two Newton steps are enough instead of four to eight. With quick = true (while playing), exactly one
  // step is taken, starting from the stored sine and cosine: the error left is far below a pixel, and the next
  // exact update (on pause) removes it.
  update(jd, quick = false) {
    if (jd === this.jd) return;
    const warm = this.jd !== null && Math.abs(jd - this.jd) < 60;
    this.jd = jd;
    const { n, a, e, M0, nn, ep, b, m11, m12, m21, m22, m31, m32, x, y, z } = this;
    const Ev = this.Ev || (this.Ev = new Float64Array(n));
    const Sv = this.Sv || (this.Sv = new Float64Array(n)), Cv = this.Cv || (this.Cv = new Float64Array(n));
    const TWO_PI = 2 * Math.PI, fast = quick && warm;
    this.exact = !fast;
    for (let k = 0; k < n; k++) {
      const ek = e[k], M = M0[k] + nn[k] * (jd - ep[k]);      // mean anomaly, not wrapped, so E stays continuous
      let E, sE, cE;
      if (fast) {
        E = Ev[k];
        let d = (E - ek * Sv[k] - M) / (1 - ek * Cv[k]);
        E -= d;
        sE = Math.sin(E); cE = Math.cos(E);
        // more steps only where the first one moved a lot (fast play, very stretched orbits)
        for (let it = 0; it < 6 && (d > 1e-5 || d < -1e-5); it++) {
          d = (E - ek * sE - M) / (1 - ek * cE);
          E -= d; sE = Math.sin(E); cE = Math.cos(E);
        }
      } else {
        if (warm) E = Ev[k];
        else {
          let Mw = M % TWO_PI; if (Mw > Math.PI) Mw -= TWO_PI; else if (Mw < -Math.PI) Mw += TWO_PI;
          E = (ek < 0.8 ? Mw : (Mw < 0 ? -Math.PI : Math.PI)) + (M - Mw);
        }
        sE = 0; cE = 0;
        for (let it = 0; it < 12; it++) {
          sE = Math.sin(E); cE = Math.cos(E);
          const d = (E - ek * sE - M) / (1 - ek * cE);
          E -= d;
          if (d < 1e-9 && d > -1e-9) { sE = Math.sin(E); cE = Math.cos(E); break; }
        }
      }
      Ev[k] = E; Sv[k] = sE; Cv[k] = cE;
      const xp = a[k] * (cE - ek), yp = b[k] * sE;
      x[k] = m11[k] * xp + m12[k] * yp; y[k] = m21[k] * xp + m22[k] * yp; z[k] = m31[k] * xp + m32[k] * yp;
    }
  }
  // the whole orbit of one asteroid, for highlighting
  path(k, steps = 360) {
    const r = this.rows[k];
    return orbitPath(+r[3], +r[4], +r[5] * RAD, +r[6] * RAD, +r[7] * RAD, steps);
  }
}

// Spacecraft: samples [jd0, stepDays, x0,y0,z0, x1,y1,z1, …] per craft; positions by linear interpolation
export function spacecraftAt(sc, jd) {
  const s = sc.samples, n = (s.length - 2) / 3, f = (jd - s[0]) / s[1];
  if (!(f >= 0) || f > n - 1) return null;
  const i = Math.min(n - 2, Math.floor(f)), t = f - i, o = 2 + i * 3;
  return [s[o] + (s[o + 3] - s[o]) * t, s[o + 1] + (s[o + 4] - s[o + 1]) * t, s[o + 2] + (s[o + 5] - s[o + 2]) * t];
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
    this.filter = 'all';                               // 'all' | 'haz' | 'big' | 'km'
    this.foundMax = 9999;                              // show only objects found by the end of this year
    this.only = null;                                  // a Set of indices: show only these (close passes in a year)
    this.colorBy = 'class';                            // 'class' | 'plain'
    this.highlight = new Set();                        // asteroid indices drawn larger (this week's visitors)
    this.selected = -1;
    this.labels = opts.labels !== false;
    this.quick = false;                                // true while playing: one Newton step per frame
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
  setView(v) { Object.assign(this, v); this.tilt = Math.max(0, Math.min(90, this.tilt)); this.viewR = Math.max(0.004, Math.min(260, this.viewR)); this.request(); }

  // ---------------------------------------------------------------- positions
  _planetOrbits() {
    const yr = Math.round((this.jd - 2451545) / 365.25);
    if (this._planetCache && this._planetCache.yr === yr) return this._planetCache.paths;
    const paths = {};
    for (const n of this.planets) { const e = planetElements(n, this.jd); paths[n] = orbitPath(e.a, e.e, e.i, e.O, e.w, n === 'Mercury' ? 120 : 200); }
    this._planetCache = { yr, paths };
    return paths;
  }
  centerPos() {
    if (this.center === 'Earth') return planetPosition('Earth', this.jd);
    if (this.center && this.center.asteroid !== undefined && this.ast) { const k = this.center.asteroid; return [this.ast.x[k], this.ast.y[k], this.ast.z[k]]; }
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
    const cx = W / 2, cy = H / 2, s = (Math.min(W, H) / 2 - 10 * dpr) / this.viewR;
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
      const fmax = this.foundMax, fnd = A.found, only = this.only;
      const fresh = fmax < 9999 ? fmax : -1;             // found in the year shown: drawn brighter
      for (let k = 0; k < A.n; k++) {
        if (f === 'haz' && !haz[k]) continue;
        if (Hm[k] > hmax) continue;
        if (fnd[k] > fmax) continue;
        if (only && !only.has(k)) continue;
        const x = X[k] - c[0], y = Y[k] - c[1], z = Z[k] - c[2];
        const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
        const sx = (cx + x1 * s) | 0, sy = (cy - (y1 * ct + z * st) * s) | 0;
        if (sx < 0 || sy < 0 || sx >= W - 1 || sy >= H - 1) continue;
        const rgb = fnd[k] === fresh ? FRESH_RGB : haz[k] && f !== 'all' ? HAZ_RGB : plain ? cols[0] : cols[cls[k]];
        let o = sy * W4 + sx * 4;
        // additive blend: dense regions glow
        px[o] += rgb[0] * amt; px[o + 1] += rgb[1] * amt; px[o + 2] += rgb[2] * amt;
        if (big === 2) { o += 4; px[o] += rgb[0] * amt; px[o + 1] += rgb[1] * amt; px[o + 2] += rgb[2] * amt;
          o += W4 - 4; px[o] += rgb[0] * amt; px[o + 1] += rgb[1] * amt; px[o + 2] += rgb[2] * amt;
          o += 4; px[o] += rgb[0] * amt; px[o + 1] += rgb[1] * amt; px[o + 2] += rgb[2] * amt; }
      }
    }
    ctx.putImageData(this.img, 0, 0);

    // 2. vector layers on top: plane of Earth's orbit, planets' orbits, the Sun, bodies, labels
    ctx.save();
    ctx.lineJoin = 'round';
    const line = (pts, stroke, width, dash) => {
      ctx.beginPath();
      for (let i = 0; i < pts.length; i++) { const p = proj(pts[i][0], pts[i][1], pts[i][2]); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
      ctx.strokeStyle = stroke; ctx.lineWidth = width * dpr; ctx.setLineDash(dash ? dash.map((d) => d * dpr) : []); ctx.stroke();
    };
    const paths = this._planetOrbits();
    const visible = (r) => r * s > 6 * dpr;                   // skip orbits too small to see
    for (const n of this.planets) {
      const a = PLANETS[n].el[0];
      if (!visible(a) || a > this.viewR * 40) continue;
      line(paths[n], n === 'Earth' ? 'rgba(138,169,201,.85)' : 'rgba(94,103,117,.75)', n === 'Earth' ? 1.4 : 1);
    }
    // the asteroid belt's place, faintly, as two rings at 2.1 and 3.3 au when the view is wide enough
    // (the main belt itself is not drawn: these are near-Earth objects only)
    // selected asteroid's orbit
    if (this.ast && this.selected >= 0) line(this.ast.path(this.selected), 'rgba(226,200,142,.9)', 1.5);
    // spacecraft tracks
    for (const sc of this.spacecraft) {
      if (!sc.show) continue;
      const pts = [], smp = sc.samples, n = (smp.length - 2) / 3;
      for (let i = 0; i < n; i += Math.max(1, Math.floor(n / 400))) {
        const jd = smp[0] + i * smp[1]; if (jd > this.jd) break;
        pts.push([smp[2 + i * 3], smp[3 + i * 3], smp[4 + i * 3]]);
      }
      const now = spacecraftAt(sc, this.jd); if (now) pts.push(now);
      if (pts.length > 1) line(pts, 'rgba(237,230,211,.28)', 1, [2, 4]);
    }
    // Sun
    const sun = proj(0, 0, 0), sr = 7 * dpr;
    const g = ctx.createRadialGradient(sun[0], sun[1], 0, sun[0], sun[1], sr * 4);
    g.addColorStop(0, 'rgba(226,200,142,.95)'); g.addColorStop(0.3, 'rgba(192,160,98,.35)'); g.addColorStop(1, 'rgba(192,160,98,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sun[0], sun[1], sr * 4, 0, 7); ctx.fill();
    ctx.fillStyle = '#E2C88E'; ctx.beginPath(); ctx.arc(sun[0], sun[1], sr * 0.7, 0, 7); ctx.fill();

    this.bodies = [];                                           // for picking and labels
    this.boxes = [];
    for (const n of this.planets) {
      const a = PLANETS[n].el[0];
      if (!visible(a) || a > this.viewR * 40) continue;
      const p = planetPosition(n, this.jd), q = proj(p[0], p[1], p[2]);
      const r = (n === 'Earth' ? 4.5 : ['Jupiter', 'Saturn'].includes(n) ? 5 : 3.5) * dpr;
      ctx.fillStyle = PLANET_COL[n]; ctx.strokeStyle = '#0C1119'; ctx.lineWidth = 1.5 * dpr;
      ctx.beginPath(); ctx.arc(q[0], q[1], r, 0, 7); ctx.fill(); ctx.stroke();
      this.bodies.push({ kind: 'planet', name: n, x: q[0], y: q[1], r, col: n === 'Earth' ? '#8AA9C9' : '#B4AFA2' });
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
      if (this.selected >= 0) {
        const k = this.selected, q = proj(A.x[k], A.y[k], A.z[k]);
        ctx.fillStyle = A.haz[k] ? '#C9675A' : '#E2C88E';
        ctx.beginPath(); ctx.arc(q[0], q[1], 4.5 * dpr, 0, 7); ctx.fill();
        ctx.strokeStyle = '#E2C88E'; ctx.setLineDash([3 * dpr, 3 * dpr]);
        ctx.beginPath(); ctx.arc(q[0], q[1], 10 * dpr, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        this.bodies.push({ kind: 'asteroid', name: A.rows[k][1].trim(), x: q[0], y: q[1], r: 6 * dpr, col: '#E2C88E', k });
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
      if ((f === 'haz' && !A.haz[k]) || A.H[k] > hmax || A.found[k] > this.foundMax || (this.only && !this.only.has(k))) continue;
      const x = A.x[k] - c[0], y = A.y[k] - c[1], z = A.z[k] - c[2];
      const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
      const d = (cx + x1 * s - X) ** 2 + (cy - (y1 * ct + z * st) * s - Y) ** 2;
      if (d < bd) { bd = d; bk = k; }
    }
    return bk >= 0 ? { kind: 'asteroid', k: bk, name: A.rows[bk][1].trim() } : null;
  }

  // ---------------------------------------------------------------- input: drag to turn, pinch or wheel to zoom
  _bind() {
    const cv = this.cv, ptrs = new Map();
    let start = null, pinch = null, moved = false;
    cv.addEventListener('pointerdown', (e) => {
      cv.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      moved = false;
      if (ptrs.size === 1) start = { x: e.clientX, y: e.clientY, spin: this.spin, tilt: this.tilt };
      if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), r: this.viewR }; start = null; }
    });
    cv.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId)) { this.onHover && this.onHover(e); return; }
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()], d = Math.hypot(a.x - b.x, a.y - b.y);
        this.setView({ viewR: pinch.r * pinch.d / Math.max(10, d) }); moved = true; this.onView && this.onView();
      } else if (start) {
        const dx = e.clientX - start.x, dy = e.clientY - start.y;
        if (!moved && Math.hypot(dx, dy) < 4) return;
        moved = true; cv.classList.add('dragging');
        this.setView({ spin: start.spin + dx * 0.35, tilt: start.tilt + dy * 0.3 });
        this.onView && this.onView();
      }
    });
    const end = (e) => {
      const wasTap = !moved && ptrs.size === 1 && start;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (ptrs.size === 0) { cv.classList.remove('dragging'); if (wasTap && e.type === 'pointerup') this.onTap && this.onTap(e); start = null; }
    };
    cv.addEventListener('pointerup', end);
    cv.addEventListener('pointercancel', end);
    cv.addEventListener('pointerleave', (e) => { if (!ptrs.size) this.onLeave && this.onLeave(e); });
    cv.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.setView({ viewR: this.viewR * Math.exp(e.deltaY * (e.deltaMode ? 0.05 : 0.0015)) });
      this.onView && this.onView();
    }, { passive: false });
    cv.addEventListener('dblclick', () => { this.setView({ viewR: this.viewR / 2 }); this.onView && this.onView(); });
    cv.addEventListener('keydown', (e) => {
      const k = e.key, step = e.shiftKey ? 15 : 5;
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
