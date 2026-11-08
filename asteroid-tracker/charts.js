// NASA Data Projects · Asteroid Tracker · hand-drawn SVG charts · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Each chart is drawn at its frame's real width (so text stays readable on phones) and redrawn on resize.
// Colours follow docs/DESIGN.md: brass for data, red only for NASA's "potentially hazardous" flag, which also gets a
// different shape (◆) so colour is never the only difference.

import { fmt, sizeText, dateText, LD_KM, DAY_MS } from './format.js';

const NS = 'http://www.w3.org/2000/svg';
const BRASS = '#C0A062', BRIGHT = '#E2C88E', RED = '#C9675A', INK = '#EDE6D3';

const el = (tag, attrs = {}, parent) => {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  if (parent) parent.appendChild(e);
  return e;
};
const text = (parent, attrs, s) => { const t = el('text', attrs, parent); t.textContent = s; return t; };
const frameWidth = (svg) => Math.max(280, Math.round(svg.parentElement.clientWidth || 600));

// ---- tooltip: hover with a mouse, tap on a touch screen ----
const tip = () => document.getElementById('tip');
function place(e) {
  const t = tip();
  t.style.left = Math.max(8, Math.min(e.clientX + 14, innerWidth - t.offsetWidth - 8)) + 'px';
  t.style.top = Math.min(e.clientY + 14, innerHeight - t.offsetHeight - 8) + 'px';
}
function hoverTip(node, html) {
  node.classList.add('hit');
  const show = (e) => { const t = tip(); t.innerHTML = html; t.hidden = false; place(e); };
  node.addEventListener('pointermove', show);
  node.addEventListener('pointerdown', show);
  node.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') tip().hidden = true; });
}
export function hideTip() { const t = tip(); if (t) t.hidden = true; }
addEventListener('scroll', hideTip, { passive: true });
document.addEventListener('pointerdown', (e) => { if (!e.target.closest('.hit')) hideTip(); });

export const tipFor = (o) =>
  `<b>${o.name}</b><br>${sizeText(o)} wide (est.)<br>${fmt(o.ld, o.ld < 1 ? 2 : 1)} LD · ${fmt(o.ld * LD_KM)} km` +
  `<br>${o.v ? fmt(o.v, 1) + ' km/s · ' : ''}${dateText(o.t, !!o.v)}${o.v ? ' UTC' : ''}` +
  (o.haz ? '<br>◆ Potentially hazardous' : '');

function start(svg, W, H) {
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = '';
  return el('g', { class: 'grid' }, svg);
}
function emptyChart(svg, msg) {
  const W = frameWidth(svg), H = 160;
  start(svg, W, H);
  text(svg, { x: W / 2, y: H / 2 + 4, 'text-anchor': 'middle', 'font-style': 'italic' }, msg);
}
const yTitle = (svg, H, m, s) =>
  text(svg, { x: 14, y: (H - m.b + m.t) / 2, 'text-anchor': 'middle', class: 'axt', transform: `rotate(-90 14 ${(H - m.b + m.t) / 2})` }, s);

// ---- 1. size against miss distance (log–log, each object a min–max line) ----
export function scatter(svg, list, emptyMsg = 'No objects match these filters.') {
  if (!list.length) return emptyChart(svg, emptyMsg);
  const W = frameWidth(svg), H = W < 600 ? Math.round(W * 0.95) : 390, m = { l: 58, r: 14, t: 26, b: 48 };
  const g = start(svg, W, H);
  // axis ranges: whole decades (and 3s) that cover the data
  const ticks = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 300, 1000];
  const ldMin = Math.min(...list.map((o) => o.ld)), ldMax = Math.max(...list.map((o) => o.ld));
  const xt = ticks.filter((v, i) => (ticks[i + 1] === undefined || ticks[i + 1] > ldMin) && (ticks[i - 1] === undefined || ticks[i - 1] < ldMax));
  const xa = Math.log10(xt[0]), xb = Math.log10(xt[xt.length - 1]);
  const sticks = [1, 3, 10, 30, 100, 300, 1000, 3000, 10000, 30000];
  const dMin = Math.min(...list.map((o) => o.dmin)), dMax = Math.max(...list.map((o) => o.dmax));
  const yt = sticks.filter((v, i) => (sticks[i + 1] === undefined || sticks[i + 1] > dMin) && (sticks[i - 1] === undefined || sticks[i - 1] < dMax));
  const ya = Math.log10(yt[0]), yb = Math.log10(yt[yt.length - 1]);
  const X = (ld) => m.l + (Math.log10(ld) - xa) / (xb - xa || 1) * (W - m.l - m.r);
  const Y = (d) => H - m.b - (Math.log10(d) - ya) / (yb - ya || 1) * (H - m.t - m.b);
  xt.forEach((v) => { el('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, g); text(svg, { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, v); });
  yt.forEach((v) => { el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); text(svg, { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, v >= 1000 ? v / 1000 + ' km' : v + ' m'); });
  text(svg, { x: (W + m.l) / 2, y: H - 8, 'text-anchor': 'middle', class: 'axt' }, W < 600 ? 'Miss distance, LD' : 'Miss distance, Moon distances (LD)');
  yTitle(svg, H, m, 'Diameter, est.');
  if (xt[0] < 1 && xt[xt.length - 1] > 1) {
    el('rect', { x: m.l, y: m.t, width: X(1) - m.l, height: H - m.t - m.b, fill: BRASS, opacity: 0.06 }, svg);
    el('line', { x1: X(1), x2: X(1), y1: m.t, y2: H - m.b, stroke: BRIGHT, 'stroke-dasharray': '4 4', opacity: 0.7 }, svg);
    text(svg, { x: X(1) + 6, y: m.t - 8, fill: BRIGHT }, 'the Moon');
    text(svg, { x: X(1) - 6, y: m.t - 8, fill: BRIGHT, 'text-anchor': 'end', 'font-style': 'italic' }, W < 600 ? 'closer' : 'closer than the Moon');
  }
  text(svg, { x: W - m.r, y: m.t - 8, 'text-anchor': 'end', 'font-style': 'italic' }, 'bigger ↑ · farther →');
  // hazardous last, so they sit on top
  [...list].sort((a, b) => a.haz - b.haz).forEach((o) => {
    const c = o.haz ? RED : BRASS, x = X(o.ld), gm = Math.sqrt(o.dmin * o.dmax);
    const grp = el('g', {}, svg);
    el('line', { x1: x, x2: x, y1: Y(o.dmin), y2: Y(o.dmax), stroke: c, 'stroke-width': 2, opacity: 0.55 }, grp);
    if (o.haz) el('path', { d: `M${x} ${Y(gm) - 6}l6 6-6 6-6-6z`, fill: c }, grp);
    else el('circle', { cx: x, cy: Y(gm), r: 4, fill: c }, grp);
    el('rect', { x: x - 8, y: Y(o.dmax) - 6, width: 16, height: Y(o.dmin) - Y(o.dmax) + 12, fill: 'transparent' }, grp);
    hoverTip(grp, tipFor(o));
  });
}

// ---- 2. approaches per day (bars; hazardous part hatched) ----
export function perDay(svg, list, weekStart) {
  const W = frameWidth(svg), H = 280, m = { l: 36, r: 12, t: 22, b: 40 };
  const g = start(svg, W, H);
  const defs = el('defs', {}, svg);
  const pat = el('pattern', { id: 'hatch', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
  el('rect', { width: 6, height: 6, fill: RED, opacity: 0.35 }, pat);
  el('line', { x1: 0, y1: 0, x2: 0, y2: 6, stroke: RED, 'stroke-width': 3 }, pat);
  const days = [...Array(7)].map((_, i) => ({ t: weekStart + i * DAY_MS, n: 0, h: 0 }));
  list.forEach((o) => { const d = days[Math.floor((o.t - weekStart) / DAY_MS)]; if (d) { d.n++; if (o.haz) d.h++; } });
  const max = Math.max(4, ...days.map((d) => d.n)), top = Math.ceil(max / 4) * 4;
  const bw = (W - m.l - m.r) / 7, Y = (v) => H - m.b - v / top * (H - m.t - m.b);
  for (let v = 0; v <= top; v += top / 4) { el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); text(svg, { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, v); }
  days.forEach((d, i) => {
    const x = m.l + i * bw + bw * 0.18, w = bw * 0.64, grp = el('g', {}, svg);
    el('rect', { x: m.l + i * bw, y: m.t, width: bw, height: H - m.t - m.b, fill: 'transparent' }, grp);
    if (d.n) el('rect', { x, y: Y(d.n), width: w, height: Y(0) - Y(d.n), fill: BRASS, rx: 2 }, grp);
    if (d.h) el('rect', { x, y: Y(d.h), width: w, height: Y(0) - Y(d.h), fill: 'url(#hatch)' }, grp);
    text(svg, { x: x + w / 2, y: Y(d.n) - 6, 'text-anchor': 'middle', fill: INK }, d.n);
    const day = new Date(d.t);
    text(svg, { x: x + w / 2, y: H - m.b + 16, 'text-anchor': 'middle' }, day.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }));
    text(svg, { x: x + w / 2, y: H - m.b + 30, 'text-anchor': 'middle' }, day.getUTCDate());
    hoverTip(grp, `<b>${dateText(d.t)}</b><br>${d.n} close approach${d.n === 1 ? '' : 'es'}${d.h ? '<br>' + d.h + ' flagged potentially hazardous' : ''}`);
  });
}

// ---- 3. the week's biggest (horizontal min–max bars) ----
export function biggest(svg, list, emptyMsg = 'No objects match these filters.') {
  if (!list.length) return emptyChart(svg, emptyMsg);
  const top = [...list].sort((a, b) => b.dmax - a.dmax).slice(0, 7);
  const W = frameWidth(svg), m = { l: 112, r: 18, t: 10, b: 34 }, H = m.t + m.b + top.length * 34;
  const g = start(svg, W, H);
  const raw = top[0].dmax, step = [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000].find((s) => raw / s <= 4) || 10000;
  const max = Math.ceil(raw / step) * step;
  const X = (v) => m.l + v / max * (W - m.l - m.r), rh = (H - m.t - m.b) / top.length;
  for (let v = 0; v <= max; v += step) { el('line', { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b }, g); text(svg, { x: X(v), y: H - m.b + 16, 'text-anchor': 'middle' }, fmt(v)); }
  text(svg, { x: (W + m.l) / 2, y: H - 2, 'text-anchor': 'middle', class: 'axt' }, 'metres');
  top.forEach((o, i) => {
    const y = m.t + i * rh + rh / 2, c = o.haz ? RED : BRASS, grp = el('g', {}, svg);
    el('rect', { x: 0, y: y - rh / 2, width: W, height: rh, fill: 'transparent' }, grp);
    el('rect', { x: X(o.dmin), y: y - 7, width: Math.max(4, X(o.dmax) - X(o.dmin)), height: 14, rx: 7, fill: c, opacity: 0.85 }, grp);
    const label = o.name.replace(/[()]/g, '');
    text(grp, { x: m.l - 10, y: y + 4, 'text-anchor': 'end', fill: INK }, (label.length > 15 ? label.slice(0, 14) + '…' : label) + (o.haz ? ' ◆' : ''));
    hoverTip(grp, tipFor(o));
  });
}

// ---- 4. the year: every approach by date and distance ----
export function yearChart(svg, list, { year, now, maxLd }) {
  const yStart = Date.UTC(year, 0, 1), yEnd = Date.UTC(year + 1, 0, 1);
  const W = frameWidth(svg), H = W < 600 ? 300 : 340, m = { l: 46, r: 14, t: 22, b: 40 };
  const g = start(svg, W, H);
  const X = (t) => m.l + (t - yStart) / (yEnd - yStart) * (W - m.l - m.r);
  const Y = (ld) => H - m.b - ld / (maxLd * 1.08) * (H - m.t - m.b);
  for (let mo = 0; mo < 12; mo++) {
    const t = Date.UTC(year, mo, 1);
    el('line', { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b }, g);
    if (W >= 600 || mo % 2 === 0)
      text(svg, { x: X(t) + (W - m.l - m.r) / 24, y: H - m.b + 16, 'text-anchor': 'middle' }, new Date(t).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }));
  }
  const step = { 1: 0.25, 5: 1, 10: 2 }[maxLd] || maxLd / 4;
  for (let v = 0; v <= maxLd + 1e-9; v += step) { el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, g); text(svg, { x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, fmt(v, step < 1 ? 2 : 0)); }
  yTitle(svg, H, m, 'Distance, LD');
  el('line', { x1: m.l, x2: W - m.r, y1: Y(1), y2: Y(1), stroke: BRIGHT, 'stroke-dasharray': '4 4', opacity: 0.7 }, svg);
  text(svg, { x: W - m.r - 4, y: Y(1) - 6, 'text-anchor': 'end', fill: BRIGHT }, 'the Moon');
  if (now >= yStart && now < yEnd) {
    el('line', { x1: X(now), x2: X(now), y1: m.t, y2: H - m.b, stroke: INK, opacity: 0.6 }, svg);
    text(svg, { x: X(now) - 6, y: m.t - 6, 'text-anchor': X(now) > W / 2 ? 'end' : 'start', fill: INK }, 'today');
  }
  if (!list.length) text(svg, { x: (W + m.l) / 2, y: H / 2, 'text-anchor': 'middle', 'font-style': 'italic' }, 'No close approaches in this range yet.');
  const scale = W < 600 ? 0.7 : 1;
  list.forEach((o) => {
    const r = o.dmax > 0 ? Math.max(2, (2.5 + Math.log10(Math.sqrt(o.dmin * o.dmax)) * 1.6) * scale) : 2.5, past = o.t < now;
    const c = el('circle', { cx: X(o.t), cy: Y(o.ld), r, fill: past ? BRASS : 'transparent', stroke: BRASS, 'stroke-width': 1.5, opacity: past ? 0.7 : 1 }, svg);
    hoverTip(c, tipFor(o));
  });
}
