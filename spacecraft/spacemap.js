// NASA and ESA Data Projects · the spacecraft map · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The asteroid map's solar-system view (asteroid-tracker/skymap.js: the same projection, turning, tilting, zooming and
// panning) with the active spacecraft on it, from deep space down to low Earth orbit. Each craft's position is its
// "parent's" position plus its own position relative to that parent:
//   Sun    deep-space craft: NASA/JPL Horizons samples, every few days
//   Earth  craft near L1 and L2: Horizons samples every 6 hours, relative to Earth
//          craft in Earth orbit: worked out in the browser from CelesTrak's orbital elements (SGP4, satellite.js),
//          turned from Earth's equator (TEME) to the ecliptic by the obliquity ε = 23.4393°
//   Moon   lunar orbiters: Horizons samples every 5 minutes, relative to the Moon; the Moon itself from shared/sky.js
//          (Meeus, chapter 47), its longitude moved back to the J2000 ecliptic (precession: 1.39697° a century)
//   Mars   orbiters and rovers: Horizons samples every 5 or 30 minutes, relative to Mars
// All positions: ecliptic J2000, astronomical units (au), the Sun at the centre, as on the asteroid map.

import { SolarMap, spacecraftAt, craftTrack } from '../asteroid-tracker/skymap.js';
import { planetPosition, jdFromMs, msFromJd, AU_KM } from '../asteroid-tracker/orbit.js';
import { moonEcliptic } from '../shared/sky.js';
import * as sat from '../shared/vendor/satellite.min.js';

const RAD = Math.PI / 180;
const EPS = 23.4392911 * RAD, CE = Math.cos(EPS), SE = Math.sin(EPS);
export const R_EARTH = 6371, R_MOON = 1737.4, R_MARS = 3389.5;
export { AU_KM, jdFromMs, msFromJd };

// ---------------------------------------------------------------- positions
export function moonGeo(jd) {                      // the Moon from Earth's centre, au, ecliptic J2000
  const m = moonEcliptic(jd), T = (jd - 2451545) / 36525;
  const l = (m.lon - 1.3969713 * T) * RAD, b = m.lat * RAD, r = m.km / AU_KM;
  return [r * Math.cos(b) * Math.cos(l), r * Math.cos(b) * Math.sin(l), r * Math.sin(b)];
}
// A craft: { key, info (from the catalogue), parent, samples? (au, relative), rec? (SGP4) }
export function parentAt(parent, jd, earth) {
  if (parent === 'Sun') return [0, 0, 0];
  const e = earth(jd);
  if (parent === 'Earth') return e;
  if (parent === 'Moon') { const m = moonGeo(jd); return [e[0] + m[0], e[1] + m[1], e[2] + m[2]]; }
  return planetPosition(parent, jd);
}
// Relative to the parent (au), or null outside the data.
export function relAt(c, jd) {
  if (c.rec) {
    const pv = sat.propagate(c.rec, new Date(msFromJd(jd)));
    if (!pv || !pv.position || !Number.isFinite(pv.position.x)) return null;
    const { x, y, z } = pv.position;
    return [x / AU_KM, (y * CE + z * SE) / AU_KM, (-y * SE + z * CE) / AU_KM];
  }
  return c.samples ? spacecraftAt(c, jd) : null;
}
export function craftPos(c, jd, earth) {
  const r = relAt(c, jd);
  if (!r) return c.local ? parentAt(c.parent, jd, earth) : null;   // a Mars or Moon craft outside its day of samples: at its planet
  const p = parentAt(c.parent, jd, earth);
  return [p[0] + r[0], p[1] + r[1], p[2] + r[2]];
}

// ---------------------------------------------------------------- icons
// Small drawings, about 2.6·s across, of what each kind of craft looks like: solar panels, dishes, tubes, wheels.
const PANEL = '#5D7FA3', PANEL_EDGE = '#9FB8D2';
export function craftIcon(ctx, kind, x, y, s, col = '#EDE6D3', military = false) {
  ctx.save(); ctx.translate(x, y);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const halo = () => { ctx.fillStyle = 'rgba(8,11,17,.55)'; ctx.beginPath(); ctx.arc(0, 0, s * 1.75, 0, 7); ctx.fill(); };
  const panel = (px, py, w, h) => { ctx.fillStyle = PANEL; ctx.strokeStyle = PANEL_EDGE; ctx.lineWidth = Math.max(0.6, s * 0.12); ctx.fillRect(px - w / 2, py - h / 2, w, h); ctx.strokeRect(px - w / 2, py - h / 2, w, h); };
  const body = (w, h) => { ctx.fillStyle = military ? '#D1A956' : col; ctx.strokeStyle = 'rgba(8,11,17,.9)'; ctx.lineWidth = Math.max(0.6, s * 0.12); ctx.fillRect(-w / 2, -h / 2, w, h); ctx.strokeRect(-w / 2, -h / 2, w, h); };
  halo();
  if (kind === 'station') {                       // a truss with two pairs of solar wings and modules in the middle
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(1, s * 0.2);
    ctx.beginPath(); ctx.moveTo(-1.6 * s, 0); ctx.lineTo(1.6 * s, 0); ctx.stroke();
    for (const sx of [-1.15, 1.15]) for (const sy of [-0.62, 0.62]) panel(sx * s, sy * s, 0.5 * s, 0.95 * s);
    body(0.5 * s, 0.9 * s);
  } else if (kind === 'telescope') {              // a tube with its open end, at a slant
    ctx.rotate(-0.6);
    body(1.9 * s, 0.85 * s);
    ctx.fillStyle = '#0C1119'; ctx.beginPath(); ctx.ellipse(0.95 * s, 0, 0.18 * s, 0.38 * s, 0, 0, 7); ctx.fill();
    panel(-0.2 * s, -0.85 * s, 1.1 * s, 0.38 * s); panel(-0.2 * s, 0.85 * s, 1.1 * s, 0.38 * s);
  } else if (kind === 'sun') {                    // a heat shield in front of a body with two wings
    panel(-1.15 * s, 0, 0.9 * s, 0.45 * s); panel(1.15 * s, 0, 0.9 * s, 0.45 * s);
    body(0.75 * s, 0.75 * s);
    ctx.strokeStyle = '#E2C88E'; ctx.lineWidth = Math.max(1, s * 0.22);
    ctx.beginPath(); ctx.arc(0, 0.25 * s, 0.85 * s, Math.PI * 1.2, Math.PI * 1.8); ctx.stroke();
  } else if (kind === 'surface') {                // a rover: body, mast and three wheels
    body(1.5 * s, 0.55 * s);
    ctx.fillStyle = '#98A0AB'; for (const wx of [-0.55, 0, 0.55]) { ctx.beginPath(); ctx.arc(wx * s, 0.5 * s, 0.24 * s, 0, 7); ctx.fill(); }
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, s * 0.14);
    ctx.beginPath(); ctx.moveTo(0.45 * s, -0.25 * s); ctx.lineTo(0.45 * s, -0.95 * s); ctx.stroke();
    ctx.fillStyle = col; ctx.fillRect(0.3 * s, -1.15 * s, 0.4 * s, 0.25 * s);
  } else if (kind === 'earth') {                  // a box with one long solar wing
    panel(-1.05 * s, 0, 1.3 * s, 0.5 * s);
    body(0.75 * s, 0.75 * s);
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, s * 0.14);
    ctx.beginPath(); ctx.moveTo(0.38 * s, 0); ctx.lineTo(0.95 * s, 0); ctx.stroke();
  } else {                                        // a deep-space probe: a big dish on a body, a boom
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, s * 0.14);
    ctx.beginPath(); ctx.moveTo(0, 0.3 * s); ctx.lineTo(0.9 * s, 1.0 * s); ctx.stroke();
    body(0.8 * s, 0.6 * s);
    ctx.fillStyle = '#D9D2BF'; ctx.strokeStyle = 'rgba(8,11,17,.9)'; ctx.lineWidth = Math.max(0.6, s * 0.12);
    ctx.beginPath(); ctx.ellipse(0, -0.55 * s, 0.95 * s, 0.38 * s, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8F8A7E'; ctx.beginPath(); ctx.arc(0, -0.6 * s, 0.12 * s, 0, 7); ctx.fill();
  }
  ctx.restore();
}

// ---------------------------------------------------------------- the map
export class SpaceMap extends SolarMap {
  constructor(canvas, opts = {}) {
    super(canvas, { ...opts, spacecraft: [], labels: false });
    this.craft = [];                  // all craft
    this.shown = null;                // Set of keys shown (filters), or null for all
    this.sel = null;                  // the selected craft's key
    this.showPath = true;
    this.minR = 0.000012;             // zoom limit: about 3,600 km across, for the Moon's orbiters
    this.far = new Set(['voyager1', 'voyager2', 'newhorizons']);
  }
  setView(v) {
    super.setView(v);
    if (v.viewR !== undefined && v.viewR < 0.00006) { this.viewR = Math.max(this.minR, v.viewR); this.request(); }
  }
  // close to Earth, the Moon or Mars, the planets' orbits around the Sun would only be straight lines across the view
  _planetOrbits() { return this.viewR < 0.05 ? Object.fromEntries(this.planets.map((n) => [n, []])) : super._planetOrbits(); }
  moonAt(jd) { if (this.viewR > 0.08) return null; const e = this.earthAt(jd), m = moonGeo(jd); return [e[0] + m[0], e[1] + m[1], e[2] + m[2]]; }
  centerPos() {
    const c = this.center;
    if (c === 'Moon') { const e = this.earthAt(this.jd), m = moonGeo(this.jd); return [e[0] + m[0], e[1] + m[1], e[2] + m[2]]; }
    if (c === 'Mars') return planetPosition('Mars', this.jd);
    if (c && c.craft) { const k = this.byKey(c.craft); const p = k && craftPos(k, this.jd, (j) => this.earthAt(j)); if (p) return p; }
    return super.centerPos();
  }
  byKey(key) { return this.craft.find((c) => c.key === key); }
  pos(c, jd = this.jd) { return craftPos(c, jd, (j) => this.earthAt(j)); }

  draw() {
    const onFrame = this.onFrame; this.onFrame = null;
    super.draw();
    this.onFrame = onFrame;
    const ctx = this.ctx, dpr = this.dpr, W = this.cv.width, H = this.cv.height, proj = this.proj;
    if (!proj) return;
    ctx.save();
    const earth = (j) => this.earthAt(j), on = (q, m = 30) => q[0] > -m && q[1] > -m && q[0] < W + m && q[1] < H + m;
    const parentQ = {};
    for (const p of ['Earth', 'Moon', 'Mars']) { const pp = parentAt(p, this.jd, earth); parentQ[p] = proj(pp[0], pp[1], pp[2]); }
    // Earth's shadow side and GEO ring when close to Earth
    if (this.viewR < 0.002) {
      const e = parentAt('Earth', this.jd, earth), r = 42164 / AU_KM, ring = [];
      ctx.beginPath();
      for (let a = 0; a <= 360; a += 3) {
        const x = r * Math.cos(a * RAD), y = r * Math.sin(a * RAD);   // the equator, turned to the ecliptic
        const q = proj(e[0] + x, e[1] + y * CE, e[2] - y * SE);
        a ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]);
        ring.push(q);
      }
      ctx.strokeStyle = 'rgba(138,169,201,.35)'; ctx.lineWidth = dpr; ctx.setLineDash([3 * dpr, 4 * dpr]); ctx.stroke(); ctx.setLineDash([]);
      const top = ring.reduce((m, q) => (q[1] < m[1] ? q : m), ring[0]);
      this._geo = top;
    } else this._geo = null;
    // the selected craft's path
    const sel = this.sel && this.byKey(this.sel);
    if (sel && this.showPath) this._path(sel);
    // craft
    const clusters = {}, s = 5.2 * dpr;
    this.craftScreen = [];
    for (const c of this.craft) {
      if (this.shown && !this.shown.has(c.key) && c.key !== this.sel) continue;
      const p = this.pos(c); if (!p) continue;
      const q = proj(p[0], p[1], p[2]);
      c._q = q;
      if (c.parent !== 'Sun' && c.key !== this.sel) {
        const pq = parentQ[c.parent] || parentQ.Earth, group = c.parent === 'Moon' ? 'Earth' : c.parent;
        const gq = parentQ[group];
        if (Math.hypot(q[0] - gq[0], q[1] - gq[1]) < 9 * dpr && Math.hypot(pq[0] - gq[0], pq[1] - gq[1]) < 9 * dpr) {
          clusters[group] = clusters[group] || { q: gq, n: 0 };
          clusters[group].n++;
          continue;
        }
      }
      if (!on(q)) continue;
      const isSel = c.key === this.sel;
      if (isSel) { ctx.strokeStyle = '#E2C88E'; ctx.lineWidth = 1.2 * dpr; ctx.setLineDash([3 * dpr, 3 * dpr]); ctx.beginPath(); ctx.arc(q[0], q[1], s * 2.6, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      craftIcon(ctx, c.info.kind, q[0], q[1], isSel ? s * 1.25 : s, isSel ? '#E2C88E' : '#EDE6D3', (c.info.tags || []).includes('military'));
      this.bodies.push({ kind: 'craft', key: c.key, name: c.info.name, x: q[0], y: q[1], r: s * 1.9, col: isSel ? '#E2C88E' : '#EDE6D3' });
      this.craftScreen.push(c.key);
    }
    // groups of craft too close together to draw apart: a ring with the count
    for (const [g, cl] of Object.entries(clusters)) {
      const q = cl.q, r = 11 * dpr;
      ctx.fillStyle = 'rgba(15,21,32,.85)'; ctx.strokeStyle = '#C0A062'; ctx.lineWidth = 1.3 * dpr;
      ctx.beginPath(); ctx.arc(q[0] + r * 1.4, q[1] - r * 1.4, r, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#E2C88E'; ctx.font = `${11 * dpr}px Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(cl.n), q[0] + r * 1.4, q[1] - r * 1.4 + 0.5 * dpr);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      this.bodies.push({ kind: 'cluster', group: g, name: `${g} · ${cl.n} craft`, x: q[0] + r * 1.4, y: q[1] - r * 1.4, r: r + 2 * dpr, col: '#C0A062', quiet: true });
    }
    // far craft off the map: an arrow at the edge
    this.edges = [];
    for (const c of this.craft) {
      if (!((this.far.has(c.key) && this.viewR > 1) || c.key === this.sel) || (this.shown && !this.shown.has(c.key) && c.key !== this.sel)) continue;
      const q = c._q; if (!q || on(q, 0)) continue;
      const cx = W / 2, cy = H / 2, ang = Math.atan2(q[1] - cy, q[0] - cx), m = 26 * dpr;
      const t = Math.min((W / 2 - m) / Math.abs(Math.cos(ang) || 1e-6), (H / 2 - m) / Math.abs(Math.sin(ang) || 1e-6));
      const ax = cx + Math.cos(ang) * t, ay = cy + Math.sin(ang) * t;
      ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
      ctx.fillStyle = c.key === this.sel ? '#E2C88E' : '#B4AFA2'; ctx.strokeStyle = 'rgba(8,11,17,.9)'; ctx.lineWidth = 2 * dpr;
      ctx.beginPath(); ctx.moveTo(9 * dpr, 0); ctx.lineTo(-5 * dpr, -6 * dpr); ctx.lineTo(-2 * dpr, 0); ctx.lineTo(-5 * dpr, 6 * dpr); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.restore();
      const p = this.pos(c), d = Math.hypot(...p);
      this.bodies.push({ kind: 'craft', key: c.key, name: `${c.info.name}, ${d >= 10 ? Math.round(d) : d.toFixed(1)} au`, x: ax, y: ay, r: 9 * dpr, col: c.key === this.sel ? '#E2C88E' : '#B4AFA2', edge: true });
    }
    // labels: the base map's collision-avoiding labels, craft after planets
    ctx.font = `${12 * dpr}px Georgia, "Palatino Linotype", serif`; ctx.textBaseline = 'alphabetic';
    this.boxes = [];
    for (const b of this.bodies) this.boxes.push([b.x - b.r, b.y - b.r, b.x + b.r, b.y + b.r]);
    const rank = (b) => (b.key === this.sel ? 0 : b.kind === 'planet' ? 1 : b.kind === 'moon' ? 2 : b.edge ? 3 : 4);
    for (const b of this.bodies.slice().sort((p, q) => rank(p) - rank(q))) if (!b.quiet) this._label(ctx, b, W, H, dpr);
    for (const [g, cl] of Object.entries(clusters)) {
      const r = 11 * dpr;
      this._label(ctx, { name: `${g} · ${cl.n} craft`, x: cl.q[0] + r * 1.4, y: cl.q[1] - r * 1.4, r, col: '#C0A062' }, W, H, dpr);
    }
    if (this._geo) this._label(ctx, { name: 'geostationary orbit', x: this._geo[0], y: this._geo[1], r: 2 * dpr, col: '#8AA9C9' }, W, H, dpr);
    if (this.moonRing) this._label(ctx, { name: "the Moon's orbit", x: this.moonRing[0], y: this.moonRing[1], r: 2 * dpr, col: '#98A0AB' }, W, H, dpr);
    ctx.restore();
    this.onFrame && this.onFrame(this);
  }

  // The selected craft's path: for Earth satellites one orbit around this moment, for the rest the stretch of their
  // samples (deep-space craft: up to the date shown, and ahead faintly), drawn relative to the parent's current place.
  _path(c) {
    const ctx = this.ctx, dpr = this.dpr, proj = this.proj, earth = (j) => this.earthAt(j);
    const P = parentAt(c.parent, this.jd, earth), pts = [], ahead = [];
    if (c.rec) {
      const period = (2 * Math.PI / c.rec.no) / 1440;   // days (no: the mean motion, radians a minute)
      for (let k = 0; k <= 180; k++) {
        const jd = this.jd - period / 2 + period * k / 180, r = relAt(c, jd);
        if (r) (jd <= this.jd ? pts : ahead).push([P[0] + r[0], P[1] + r[1], P[2] + r[2]]);
      }
      if (pts.length && ahead.length) ahead.unshift(pts[pts.length - 1]);
    } else if (c.samples) {
      const tr = craftTrack(c);
      for (const t of tr) (t[3] <= this.jd ? pts : ahead).push(c.parent === 'Sun' ? t : [P[0] + t[0], P[1] + t[1], P[2] + t[2]]);
      const now = relAt(c, this.jd);
      if (now) { const q = c.parent === 'Sun' ? now : [P[0] + now[0], P[1] + now[1], P[2] + now[2]]; pts.push(q); ahead.unshift(q); }
    }
    const draw = (list, stroke, dash) => {
      if (list.length < 2) return;
      ctx.beginPath(); let pen = false;
      for (const p of list) { const q = proj(p[0], p[1], p[2]); if (Math.abs(q[0]) < 1e6 && Math.abs(q[1]) < 1e6) { pen ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); pen = true; } else pen = false; }
      ctx.strokeStyle = stroke; ctx.lineWidth = 1.4 * dpr; ctx.setLineDash(dash.map((d) => d * dpr)); ctx.stroke(); ctx.setLineDash([]);
    };
    draw(pts, 'rgba(226,200,142,.8)', []);
    draw(ahead, 'rgba(226,200,142,.45)', [3, 4]);
  }
}
