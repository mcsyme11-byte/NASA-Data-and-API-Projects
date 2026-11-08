// NASA Data Projects · Asteroid Tracker · the orbit diagram · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Draws the Sun, the planets' orbits and an asteroid's orbit to scale in SVG, with every body placed at the chosen
// date (positions from orbit.js). The view can be turned: "tilt" is the angle from looking straight down on Earth's
// orbital plane (0°) to looking along it (90°); "spin" turns the system about the Sun. Drag the diagram to turn it.
//
// Projection (au → screen): spin about the ecliptic pole by φ, then tilt by θ:
//   x1 = x·cos φ − y·sin φ,   y1 = x·sin φ + y·cos φ
//   screen right = x1,   screen up = y1·cos θ + z·sin θ,   towards the viewer = −y1·sin θ + z·cos θ

import { planetPosition, planetElements, asteroidPosition, orbitPath, rotate, dist, LD_AU } from './orbit.js';

const NS = 'http://www.w3.org/2000/svg';
const RAD = Math.PI / 180;
const C = { brass: '#C0A062', bright: '#E2C88E', dim: '#7E6A45', ink: '#EDE6D3', ink2: '#B4AFA2', muted: '#98A0AB',
  line: '#2A3446', line2: '#3A465C', blue: '#8AA9C9', red: '#C9675A', deep: '#0C1119' };
const PLANET_STYLE = { Mercury: '#98A0AB', Venus: '#D1A956', Earth: C.blue, Mars: '#C9784A', Jupiter: '#B79AC8' };

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== undefined && v !== null) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};

export class OrbitView {
  constructor(svg, { k, name, hazardous, tip }) {
    this.svg = svg; this.k = k; this.name = name; this.hazardous = hazardous; this.tip = tip;
    this.tilt = 0; this.spin = 0; this.zoom = 1; this.nearEarth = false; this.nearRadius = 0.05;
    this.jd = null; this.marker = null;          // marker: { jd, label } for the selected close approach
    // which planets: always the inner four; Jupiter when the asteroid's orbit reaches past the asteroid belt
    this.planets = ['Mercury', 'Venus', 'Earth', 'Mars'].concat(k.Q > 3.6 ? ['Jupiter'] : []);
    this.fitR = Math.max(k.Q, k.Q > 3.6 ? 5.46 : 1.70) * 1.06;
    this.astPath = orbitPath(k.a, k.e, k.i, k.O, k.w, 720);
    this.nodes = [-k.w, Math.PI - k.w].map((nu) => {                       // where the orbit crosses the ecliptic
      const r = k.a * (1 - k.e * k.e) / (1 + k.e * Math.cos(nu));
      return { p: rotate(r * Math.cos(nu), r * Math.sin(nu), k.w, k.i, k.O), r };
    });
    this.apsides = [0, Math.PI].map((E) => ({                             // perihelion and aphelion
      p: rotate(k.a * (Math.cos(E) - k.e), k.a * Math.sqrt(1 - k.e * k.e) * Math.sin(E), k.w, k.i, k.O),
      r: E === 0 ? k.q : k.Q, label: E === 0 ? 'closest to the Sun' : 'farthest from the Sun' }));
    this._planetPaths = null; this._planetPathsJd = null;
    this.dragging = null;
    this._bindDrag();
  }

  // ---- projection ----
  _proj(p) {
    const cf = Math.cos(this.spin * RAD), sf = Math.sin(this.spin * RAD), ct = Math.cos(this.tilt * RAD), st = Math.sin(this.tilt * RAD);
    let [x, y, z] = p;
    if (this.nearEarth && this.center) { x -= this.center[0]; y -= this.center[1]; z -= this.center[2]; }
    const x1 = x * cf - y * sf, y1 = x * sf + y * cf;
    return [this.cx + x1 * this.s, this.cy - (y1 * ct + z * st) * this.s, -y1 * st + z * ct];
  }
  _path(points, closed = false) {
    return points.map((p, i) => { const [sx, sy] = this._proj(p); return (i ? 'L' : 'M') + sx.toFixed(1) + ' ' + sy.toFixed(1); }).join('') + (closed ? 'Z' : '');
  }

  // planets' orbits change very slowly; recompute their paths only when the date moves by more than a year
  _planetOrbits(jd) {
    if (this._planetPaths && Math.abs(jd - this._planetPathsJd) < 365) return this._planetPaths;
    this._planetPathsJd = jd;
    this._planetPaths = Object.fromEntries(this.planets.map((n) => {
      const e = planetElements(n, jd);
      return [n, orbitPath(e.a, e.e, e.i, e.O, e.w, n === 'Jupiter' ? 240 : 180)];
    }));
    return this._planetPaths;
  }

  setDate(jd) { this.jd = jd; this.draw(); }
  setView({ tilt, spin }) { if (tilt !== undefined) this.tilt = Math.max(0, Math.min(90, tilt)); if (spin !== undefined) this.spin = spin; this.draw(); }

  // ---- drawing ----
  draw() {
    const svg = this.svg, jd = this.jd;
    if (jd === null) return;
    const W = Math.max(280, Math.round(svg.parentElement.clientWidth || 600));
    const H = W < 640 ? Math.round(W * 1.0) : Math.round(Math.min(W * 0.62, 640));
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = '';
    this.W = W; this.H = H; this.boxes = [];
    this.cx = W / 2; this.cy = H / 2 + (W < 640 ? 0 : 10);
    const earth = planetPosition('Earth', jd), ast = asteroidPosition(this.k, jd);
    this.center = earth;
    const R = this.nearEarth ? this.nearRadius : this.fitR / this.zoom;
    this.s = (Math.min(W, H) / 2 - 18) / R;
    const vb = this.tilt > 3;   // tilted: draw the plane of Earth's orbit for depth
    if (W >= 640) this.boxes.push([0, 0, 190, 84]);
    this.boxes.push([0, H - 40, 260, H], [W - 130, H - 30, W, H]);

    const defs = el('defs', {}, svg);
    const glow = el('radialGradient', { id: 'sunglow' }, defs);
    el('stop', { offset: '0', 'stop-color': C.bright, 'stop-opacity': 0.9 }, glow);
    el('stop', { offset: '0.35', 'stop-color': C.brass, 'stop-opacity': 0.35 }, glow);
    el('stop', { offset: '1', 'stop-color': C.brass, 'stop-opacity': 0 }, glow);
    const clip = el('clipPath', { id: 'oclip' }, defs); el('rect', { x: 0, y: 0, width: W, height: H }, clip);
    const g = el('g', { 'clip-path': 'url(#oclip)' }, svg);

    if (this.nearEarth) this._drawNearEarth(g, jd, earth, ast, W, H);
    else this._drawSystem(g, jd, earth, ast, vb);

    // scale bar (bottom left): 1 au, or 1 LD when zoomed in near Earth
    const units = this.nearEarth ? [1, 5, 10, 25, 50, 100].map((n) => n * LD_AU) : [0.1, 0.25, 0.5, 1, 2];
    const unit = units.find((u) => u * this.s >= 50) || units[units.length - 1];
    const len = unit * this.s, bx = 16, by = H - 18;
    el('line', { x1: bx, x2: bx + len, y1: by, y2: by, stroke: C.ink2, 'stroke-width': 1.5 }, svg);
    [bx, bx + len].forEach((x) => el('line', { x1: x, x2: x, y1: by - 4, y2: by + 4, stroke: C.ink2 }, svg));
    const nLd = Math.round(unit / LD_AU);
    const ulabel = this.nearEarth ? (nLd === 1 ? '1 Moon distance (384,400 km)' : `${nLd} Moon distances`) : `${unit} au = ${(unit * 149.6).toLocaleString('en-CA', { maximumFractionDigits: 1 })} million km`;
    const t = el('text', { x: bx, y: by - 8, fill: C.ink2, 'font-size': 11 }, svg); t.textContent = ulabel;
    if (this.tilt === 0 && !this.nearEarth) {
      const v = el('text', { x: W - 14, y: H - 14, 'text-anchor': 'end', fill: C.muted, 'font-size': 11, 'font-style': 'italic' }, svg);
      v.textContent = 'seen from above';
    }
    svg.setAttribute('aria-label', `Orbit diagram on ${new Date((jd - 2440587.5) * 86400000).toISOString().slice(0, 10)}: the Sun, ${this.planets.join(', ')} and ${this.name}, ` +
      `${dist(earth, ast).toFixed(3)} au from Earth and ${Math.hypot(...ast).toFixed(3)} au from the Sun.`);
  }

  _drawSystem(g, jd, earth, ast, vb) {
    const R = this.fitR / this.zoom;
    // the plane of Earth's orbit, as a faint disc with rings every au (only when tilted)
    if (vb) {
      const ring = (r) => { const pts = []; for (let a = 0; a <= 360; a += 4) pts.push([r * Math.cos(a * RAD), r * Math.sin(a * RAD), 0]); return pts; };
      el('path', { d: this._path(ring(R * 0.98), true), fill: C.brass, 'fill-opacity': 0.035, stroke: 'none' }, g);
      for (let r = 1; r < R; r += r < 2 ? 0.5 : 1) el('path', { d: this._path(ring(r), true), fill: 'none', stroke: C.line, 'stroke-width': 0.8, 'stroke-dasharray': '2 4' }, g);
    }
    // the Sun
    const [sx, sy] = this._proj([0, 0, 0]);
    el('circle', { cx: sx, cy: sy, r: 22, fill: 'url(#sunglow)' }, g);
    const sun = el('circle', { cx: sx, cy: sy, r: 6, fill: C.bright }, g);
    this._tipOn(sun, '<b>The Sun</b>');
    // planets' orbits and positions
    const paths = this._planetOrbits(jd);
    for (const n of this.planets) {
      const isE = n === 'Earth';
      el('path', { d: this._path(paths[n], true), fill: 'none', stroke: isE ? C.blue : C.line2, 'stroke-width': isE ? 1.6 : 1, opacity: isE ? 0.9 : 0.9 }, g);
    }
    // the asteroid's orbit: solid above the plane of Earth's orbit, dashed below; split where z changes sign
    const col = this.hazardous ? C.red : C.brass;
    let seg = [], above = this.astPath[0][2] >= 0;
    const flush = () => { if (seg.length > 1) el('path', { d: this._path(seg), fill: 'none', stroke: col, 'stroke-width': above ? 2 : 1.6, 'stroke-dasharray': above ? '' : '5 5', opacity: above ? 0.95 : 0.6 }, g); };
    for (const p of this.astPath) {
      const now = p[2] >= 0;
      if (now !== above && seg.length) { seg.push(p); flush(); seg = [p]; above = now; } else seg.push(p);
    }
    flush();
    // direction of travel: a small arrow on the asteroid's orbit a little ahead of the asteroid
    this._arrow(g, asteroidPosition(this.k, jd + Math.max(8, this.k.period * 0.06)), asteroidPosition(this.k, jd + Math.max(9, this.k.period * 0.06) + 1), col);
    this._arrow(g, planetPosition('Earth', jd + 40), planetPosition('Earth', jd + 41), C.blue);
    // where it crosses Earth's orbital plane, and its closest and farthest points from the Sun
    for (const nd of this.nodes) {
      const [x, y] = this._proj(nd.p), m = el('g', {}, g);
      el('path', { d: `M${x - 5} ${y - 5}L${x + 5} ${y + 5}M${x - 5} ${y + 5}L${x + 5} ${y - 5}`, stroke: C.ink, 'stroke-width': 1.6 }, m);
      el('circle', { cx: x, cy: y, r: 10, fill: 'transparent' }, m);
      this._tipOn(m, `<b>Crosses Earth's orbital plane</b><br>${nd.r.toFixed(3)} au from the Sun${Math.abs(nd.r - 1) < 0.1 ? '<br>close to Earth\'s orbit: close passes happen here' : ''}`);
    }
    for (const ap of this.apsides) {
      const [x, y] = this._proj(ap.p), m = el('g', {}, g);
      el('circle', { cx: x, cy: y, r: 3.5, fill: C.deep, stroke: col, 'stroke-width': 1.5 }, m);
      el('circle', { cx: x, cy: y, r: 10, fill: 'transparent' }, m);
      this._tipOn(m, `<b>${ap.label[0].toUpperCase() + ap.label.slice(1)}</b><br>${ap.r.toFixed(3)} au, ${(ap.r * 149.6).toFixed(0)} million km`);
    }
    // the selected close approach: where the asteroid is on that date
    if (this.marker) {
      const [x, y] = this._proj(asteroidPosition(this.k, this.marker.jd));
      el('circle', { cx: x, cy: y, r: 9, fill: 'none', stroke: C.bright, 'stroke-width': 1.2, 'stroke-dasharray': '2 2' }, g);
    }
    // bodies, drawn back to front
    const bodies = this.planets.map((n) => ({ n, p: n === 'Earth' ? earth : planetPosition(n, jd) }));
    bodies.push({ n: '_ast', p: ast });
    const pr = bodies.map((b) => ({ ...b, s: this._proj(b.p) })).sort((a, b) => a.s[2] - b.s[2]);
    // the line from Earth to the asteroid, with the distance
    const [ex, ey] = this._proj(earth), [ax, ay] = this._proj(ast);
    el('line', { x1: ex, y1: ey, x2: ax, y2: ay, stroke: C.ink2, 'stroke-width': 1, 'stroke-dasharray': '3 4', opacity: 0.8 }, g);
    // drop lines: how far above or below Earth's orbital plane the asteroid is (tilted views)
    if (this.tilt > 3) {
      const [bx, by] = this._proj([ast[0], ast[1], 0]);
      el('line', { x1: ax, y1: ay, x2: bx, y2: by, stroke: col, 'stroke-width': 1, 'stroke-dasharray': '1 3' }, g);
      el('circle', { cx: bx, cy: by, r: 2, fill: col, opacity: 0.6 }, g);
    }
    const sunXY = this._proj([0, 0, 0]); this._occupy(sunXY[0], sunXY[1], 9);
    for (const b of pr) this._occupy(b.s[0], b.s[1], 8);
    for (const b of pr) {
      const [x, y] = b.s;
      if (b.n === '_ast') {
        const m = el('g', {}, g);
        if (this.hazardous) el('path', { d: `M${x} ${y - 7}l7 7-7 7-7-7z`, fill: C.red, stroke: C.deep, 'stroke-width': 1 }, m);
        else el('circle', { cx: x, cy: y, r: 6, fill: C.bright, stroke: C.deep, 'stroke-width': 1.5 }, m);
        el('circle', { cx: x, cy: y, r: 14, fill: 'transparent' }, m);
        this._tipOn(m, `<b>${this.name}</b><br>${Math.hypot(...ast).toFixed(3)} au from the Sun<br>${dist(earth, ast).toFixed(3)} au from Earth`);
      } else {
        const isE = b.n === 'Earth', m = el('g', {}, g);
        el('circle', { cx: x, cy: y, r: isE ? 6 : b.n === 'Jupiter' ? 6 : 4, fill: PLANET_STYLE[b.n], stroke: C.deep, 'stroke-width': 1.5 }, m);
        el('circle', { cx: x, cy: y, r: 12, fill: 'transparent' }, m);
        this._tipOn(m, `<b>${b.n}</b><br>${Math.hypot(...b.p).toFixed(3)} au from the Sun`);
      }
    }
    // labels, most important first
    const at = (n) => pr.find((b) => b.n === n).s;
    this._label(g, ...at('_ast').slice(0, 2), this.name.replace(/[()]/g, ''), C.bright, 10, true);
    this._label(g, ...at('Earth').slice(0, 2), 'Earth', C.blue, 9, true);
    const len = Math.hypot(ax - ex, ay - ey);
    if (len > 70) this._label(g, (ex + ax) / 2, (ey + ay) / 2, `${dist(earth, ast).toFixed(3)} au`, C.ink2, 4, false, 11);
    for (const n of ['Mars', 'Venus', 'Jupiter', 'Mercury']) if (this.planets.includes(n)) this._label(g, ...at(n).slice(0, 2), n, C.ink2, 7);
  }

  // Zoomed in around Earth: the Moon's orbit for scale and the asteroid's path relative to Earth
  _drawNearEarth(g, jd, earth, ast, W, H) {
    const R = this.nearRadius;
    // Moon's orbit (1 LD) and 10 LD ring, in the plane of Earth's orbit
    const ring = (r) => { const pts = []; for (let a = 0; a <= 360; a += 3) pts.push([earth[0] + r * Math.cos(a * RAD), earth[1] + r * Math.sin(a * RAD), earth[2]]); return pts; };
    if (this.tilt > 3) el('path', { d: this._path(ring(R * 0.98), true), fill: C.brass, 'fill-opacity': 0.035 }, g);
    for (const [r, lab] of [[LD_AU, "the Moon's orbit"], [10 * LD_AU, '10 Moon distances'], [50 * LD_AU, '50 Moon distances']]) {
      if (r > R * 1.4 || r * this.s < 8) continue;
      el('path', { d: this._path(ring(r), true), fill: 'none', stroke: r === LD_AU ? C.ink2 : C.line2, 'stroke-width': 1, 'stroke-dasharray': r === LD_AU ? '' : '3 4', opacity: 0.8 }, g);
      const [lx, ly] = this._proj([earth[0] + r * Math.SQRT1_2, earth[1] - r * Math.SQRT1_2, earth[2]]);
      const t = el('text', { x: lx + 4, y: ly + 12, fill: C.muted, 'font-size': 11, 'font-style': 'italic' }, g); t.textContent = lab;
    }
    // direction of the Sun
    const toSun = [-earth[0], -earth[1], -earth[2]], len = Math.hypot(...toSun);
    const sunPt = earth.map((v, i) => v + toSun[i] / len * R * 0.8);
    const [ex, ey] = this._proj(earth), [ux, uy] = this._proj(sunPt);
    el('line', { x1: ex, y1: ey, x2: ux, y2: uy, stroke: C.brass, 'stroke-width': 1, 'stroke-dasharray': '1 4', opacity: 0.7 }, g);
    const st = el('text', { x: ux, y: uy - 6, 'text-anchor': 'middle', fill: C.brass, 'font-size': 11 }, g); st.textContent = 'towards the Sun ☉';
    // the asteroid's path relative to Earth over ±120 days, where it is inside the view
    const col = this.hazardous ? C.red : C.brass, pts = [];
    for (let d = -120; d <= 120; d += 0.25) {
      const j = jd + d, e = planetPosition('Earth', j), a = asteroidPosition(this.k, j);
      pts.push([a[0] - e[0] + earth[0], a[1] - e[1] + earth[1], a[2] - e[2] + earth[2], d]);
    }
    let seg = [];
    const flush = () => { if (seg.length > 1) el('path', { d: this._path(seg), fill: 'none', stroke: col, 'stroke-width': 1.6, opacity: 0.85 }, g); seg = []; };
    for (const p of pts) { if (dist(p, earth) < R * 1.6) seg.push(p); else flush(); }
    flush();
    // a dot every 5 days along the path; day labels where there is room
    const [ex0, ey0] = this._proj(earth), [ax0, ay0] = this._proj(ast);
    this._occupy(ex0, ey0, 10); this._occupy(ax0, ay0, 10);
    for (const p of pts) {
      if (p[3] % 5 !== 0 || p[3] === 0 || dist(p, earth) > R * 1.25) continue;
      const [x, y] = this._proj(p);
      el('circle', { cx: x, cy: y, r: 2, fill: col }, g);
    }
    for (const p of pts) {
      if (p[3] % 10 !== 0 || p[3] === 0 || dist(p, earth) > R * 1.15) continue;
      const [x, y] = this._proj(p);
      this._label(g, x, y, (p[3] > 0 ? '+' : '−') + Math.abs(p[3]) + ' d', C.muted, 5, false, 10);
    }
    // Earth and the asteroid now
    const [ax, ay] = this._proj(ast);
    el('line', { x1: ex, y1: ey, x2: ax, y2: ay, stroke: C.ink2, 'stroke-width': 1, 'stroke-dasharray': '3 4' }, g);
    el('circle', { cx: ex, cy: ey, r: 7, fill: C.blue, stroke: C.deep, 'stroke-width': 1.5 }, g);
    const m = el('g', {}, g);
    if (this.hazardous) el('path', { d: `M${ax} ${ay - 7}l7 7-7 7-7-7z`, fill: C.red }, m);
    else el('circle', { cx: ax, cy: ay, r: 6, fill: C.bright, stroke: C.deep, 'stroke-width': 1.5 }, m);
    const d = dist(earth, ast);
    this.boxes = this.boxes.filter((b) => !(b[2] - b[0] === 20 && b[3] - b[1] === 20));   // free the two bodies' own spots for their labels
    this._occupy(ex, ey, 8); this._occupy(ax, ay, 8);
    this._label(g, ax, ay, this.name.replace(/[()]/g, ''), C.bright, 10, true);
    this._label(g, ex, ey, 'Earth', C.blue, 10, true);
    this._tipOn(m, `<b>${this.name}</b><br>${(d / LD_AU).toFixed(1)} Moon distances from Earth`);
  }

  _arrow(g, p1, p2, col) {
    const [x1, y1] = this._proj(p1), [x2, y2] = this._proj(p2);
    const a = Math.atan2(y2 - y1, x2 - x1);
    if (!isFinite(a) || Math.hypot(x2 - x1, y2 - y1) < 0.01) return;
    el('path', { d: `M${x1 + 7 * Math.cos(a)} ${y1 + 7 * Math.sin(a)}L${x1 + 7 * Math.cos(a + 2.5)} ${y1 + 7 * Math.sin(a + 2.5)}L${x1 + 7 * Math.cos(a - 2.5)} ${y1 + 7 * Math.sin(a - 2.5)}Z`, fill: col, opacity: 0.9 }, g);
  }
  // Labels are placed at the first of several spots around their point that overlaps nothing drawn so far;
  // a label that fits nowhere is left out unless it must be shown (the asteroid and Earth).
  _occupy(x, y, r) { this.boxes.push([x - r, y - r, x + r, y + r]); }
  _label(g, x, y, s, fill, off, must = false, size = 12) {
    const w = s.length * size * 0.52, h = size;
    const spots = [[off, -off * 0.5], [off, off + h * 0.6], [-off - w, -off * 0.5], [-off - w, off + h * 0.6], [-w / 2, -off - 4], [-w / 2, off + h + 2],
      [off * 1.8, -off * 1.6], [off * 1.8, off * 1.8 + h], [-off * 1.8 - w, -off * 1.6], [-off * 1.8 - w, off * 1.8 + h], [-w / 2, -off * 2.4 - 4], [-w / 2, off * 2.4 + h]];
    const W = this.W, H = this.H;
    for (const [dx, dy] of spots) {
      const b = [x + dx - 2, y + dy - h, x + dx + w + 2, y + dy + 3];
      if (b[0] < 2 || b[2] > W - 2 || b[1] < 2 || b[3] > H - 2) continue;
      if (this.boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
      this.boxes.push(b);
      const t = el('text', { x: x + dx, y: y + dy, fill, 'font-size': size }, g); t.textContent = s;
      return t;
    }
    if (!must) return null;
    const t = el('text', { x: x + off, y: y - off * 0.5, fill, 'font-size': size }, g); t.textContent = s;
    return t;
  }
  _tipOn(node, html) {
    node.classList.add('hit');
    const show = (e) => this.tip && this.tip.show(html, e);
    node.addEventListener('pointermove', show);
    node.addEventListener('pointerdown', show);
    node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse' && this.tip) this.tip.hide(); });
  }

  // drag to turn: left–right spins about the Sun, up–down tilts
  _bindDrag() {
    const svg = this.svg;
    svg.addEventListener('pointerdown', (e) => {
      if (e.button !== 0) return;
      this.dragging = { x: e.clientX, y: e.clientY, spin: this.spin, tilt: this.tilt, moved: false, id: e.pointerId };
    });
    svg.addEventListener('pointermove', (e) => {
      const d = this.dragging; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.moved && Math.hypot(dx, dy) < 4) return;
      if (!d.moved) { d.moved = true; try { svg.setPointerCapture(e.pointerId); } catch { /* not supported */ } svg.classList.add('dragging'); this.tip && this.tip.hide(); }
      this.spin = d.spin + dx * 0.4;
      if (e.pointerType === 'mouse') this.tilt = Math.max(0, Math.min(90, d.tilt + dy * 0.35));
      this.draw();
      this.onViewChange && this.onViewChange();
    });
    const end = (e) => { if (this.dragging && this.dragging.id === e.pointerId) { this.dragging = null; svg.classList.remove('dragging'); } };
    svg.addEventListener('pointerup', end);
    svg.addEventListener('pointercancel', end);
  }
}
