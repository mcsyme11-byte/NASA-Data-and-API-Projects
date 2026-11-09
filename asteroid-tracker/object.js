// NASA Data Projects · Asteroid Tracker · one asteroid · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// object.html?id=<NeoWs id>[&t=<close-approach time, ms UTC>]
// One request to NASA NeoWs (/neo/rest/v1/neo/{id}) gives the asteroid's size, its orbital elements and every
// computed close approach (1900–2200). The orbit diagram (orbitview.js) places the asteroid and the planets at any
// date from 1900 to 2050 (the planets' elements table is valid 1800–2050).

import { backLink } from './back.js';
import { nasaGet } from '../shared/nasa.js';
import { fmt, sizeText, dateText, sizePicture, LD_KM } from './format.js';
import { hoverTip, tipApi, hideTip } from './charts.js';
import { asteroidElements, asteroidPosition, planetPosition, jdFromMs, msFromJd, dist, LD_AU, AU_KM } from './orbit.js';
import { OrbitView } from './orbitview.js';
import { decodeName } from './search.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NS = 'http://www.w3.org/2000/svg';
const DAY = 86400000;
const MIN_MS = Date.UTC(1900, 0, 1), MAX_MS = Date.UTC(2050, 11, 31);   // the diagram's date range
const GM_SUN = 1.32712440018e11;                                         // km³/s², for the speed around the Sun
const ROWS = 12;

const ORBIT_CLASS = {
  APO: 'An Apollo asteroid: its orbit crosses Earth\'s, and it spends most of its time farther from the Sun than Earth.',
  ATE: 'An Aten asteroid: its orbit crosses Earth\'s, and it spends most of its time closer to the Sun than Earth.',
  AMO: 'An Amor asteroid: it comes close to Earth\'s orbit from outside, but does not cross it.',
  IEO: 'An Atira asteroid: its whole orbit lies inside Earth\'s.',
};

const params = new URLSearchParams(location.search);
const id = (params.get('id') || '').trim();
const state = { neo: null, k: null, view: null, jd: null, anchor: null, approaches: [], sel: null, playing: false, showAll: false, held: null };

function notice(msg, actions = '') {
  $('#notice').innerHTML = msg ? `<div class="notice warn" role="alert"><span>${msg}</span><span class="seg">${actions}</span></div>` : '';
}
function tiles(target, list) {
  $(target).innerHTML = list.map((t) => `<div class="tile"><div class="label">${t.label}</div><div class="value">${t.value}</div><div class="note">${t.note}</div></div>`).join('');
}

// ---------------------------------------------------------------- load
async function load() {
  if (!/^\d{5,9}$/.test(id)) {
    $('#name').textContent = 'No asteroid chosen';
    notice('This page shows one asteroid. Open one from the <a href="./">Asteroid Tracker</a>: tap a row in the week\'s list, then "Open this asteroid\'s page".');
    return;
  }
  notice('');
  $('#name').textContent = 'Loading…';
  try {
    state.neo = await nasaGet('/neo/rest/v1/neo/' + id);
  } catch (e) {
    $('#name').textContent = 'Asteroid ' + id;
    const msg = e.status === 404 ? 'NASA has no asteroid with this number. Open one from the <a href="./">Asteroid Tracker</a>.' : esc(e.message);
    notice(msg, e.status === 404 ? '' : '<button class="btn ghost" data-act="retry">Try again</button>' + (e.status === 429 || e.status === 403 ? '<a class="btn ghost" href="./#key">Key settings</a>' : ''));
    return;
  }
  render();
}
document.addEventListener('click', (e) => { if (e.target.closest('[data-act=retry]')) load(); });

// ---------------------------------------------------------------- render
function render() {
  const n = state.neo, od = n.orbital_data, k = state.k = asteroidElements(od);
  const m = n.estimated_diameter.meters, size = { dmin: m.estimated_diameter_min, dmax: m.estimated_diameter_max };
  document.title = `${n.name} · Asteroid Tracker · NASA Data Projects`;
  $('#name').textContent = n.name;
  const cls = od.orbit_class || {};
  $('#lede').textContent = ORBIT_CLASS[cls.orbit_class_type] || cls.orbit_class_description || 'A near-Earth object.';
  $('#pills').innerHTML =
    (n.is_potentially_hazardous_asteroid ? '<span class="tag haz">Potentially hazardous</span>' : '<span class="tag">Not flagged hazardous</span>') +
    (n.is_sentry_object ? ' <span class="tag warn">On NASA\'s Sentry watch list</span>' : '') +
    ` <a class="tag link" href="map.html?focus=${encodeURIComponent(n.designation || '')}">Show on the solar system map ›</a>` +
    ` <a class="tag link" href="${esc(n.nasa_jpl_url)}" target="_blank" rel="noopener">JPL's page ›</a>`;
  const dec = decodeName(n.name);
  $('#decode').hidden = !dec;
  if (dec) $('#decode').textContent = dec;

  const years = k.period / 365.25, moidAu = Number(od.minimum_orbit_intersection);
  tiles('#facts', [
    { label: 'Size, est.', value: sizeText(size), note: sizePicture(size) },
    { label: 'Year length', value: years >= 2 ? fmt(years, 1) + ' <small>years</small>' : fmt(k.period) + ' <small>days</small>', note: `one trip around the Sun · Earth: 365 days` },
    { label: 'From the Sun', value: `${fmt(k.q, 2)}–${fmt(k.Q, 2)} <small>au</small>`, note: `${fmt(k.q * 149.6)}–${fmt(k.Q * 149.6)} million km · Earth: 1 au` },
    { label: 'Orbit tilt', value: fmt(k.i * 180 / Math.PI, 1) + '°', note: 'slant against the plane of Earth\'s orbit' },
    { label: 'Closest its orbit gets to Earth\'s', value: fmt(moidAu / LD_AU, moidAu / LD_AU < 1 ? 2 : moidAu / LD_AU < 10 ? 1 : 0) + ' <small>LD</small>', note: `${fmt(moidAu, 4)} au · ${fmt(moidAu * AU_KM)} km` },
  ]);

  // every Earth approach from NASA
  state.approaches = (n.close_approach_data || []).filter((c) => c.orbiting_body === 'Earth').map((c) => ({
    t: c.epoch_date_close_approach, ld: Number(c.miss_distance.lunar), km: Number(c.miss_distance.kilometers), v: Number(c.relative_velocity.kilometers_per_second),
  })).sort((a, b) => a.t - b.t);

  // the starting date: the approach given in the link, else the next one in the diagram's range, else today
  const now = Date.now(), tParam = Number(params.get('t'));
  let start = state.approaches.find((a) => tParam && Math.abs(a.t - tParam) < 2 * DAY) ||
              state.approaches.find((a) => a.t >= now && a.t <= MAX_MS);
  state.sel = start || null;
  const startMs = start ? start.t : now;

  $('#content').hidden = false;
  $('.orbitcard').classList.toggle('hazard', !!n.is_potentially_hazardous_asteroid);
  state.view = new OrbitView($('#orbit'), { k, name: n.name, hazardous: n.is_potentially_hazardous_asteroid, tip: tipApi });
  state.view.onViewChange = syncViewButtons;
  setAnchor(startMs);
  setDate(jdFromMs(startMs));
  renderApproaches();
  renderAbout();
  $('#caAside').textContent = state.approaches.length
    ? `${state.approaches.length} passes, ${new Date(state.approaches[0].t).getUTCFullYear()}–${new Date(state.approaches[state.approaches.length - 1].t).getUTCFullYear()}`
    : '';
}

// ---------------------------------------------------------------- the diagram's date
const clampMs = (ms) => Math.max(MIN_MS, Math.min(MAX_MS, ms));
function setAnchor(ms) {            // the slider covers one year either side of the anchor date
  state.anchor = clampMs(ms);
  $('#sMin').textContent = new Date(state.anchor - 365 * DAY).toISOString().slice(0, 10);
  $('#sMax').textContent = new Date(state.anchor + 365 * DAY).toISOString().slice(0, 10);
}
function setDate(jd) {
  let ms = clampMs(msFromJd(jd));
  if (Math.abs(ms - state.anchor) > 365 * DAY) setAnchor(ms);
  jd = jdFromMs(ms);
  state.jd = jd;
  const v = state.view;
  const sel = state.sel && state.sel.t >= MIN_MS && state.sel.t <= MAX_MS ? state.sel : null;
  v.marker = sel ? { jd: jdFromMs(sel.t), ld: sel.ld,
    label: `${new Date(sel.t).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' })} · ${fmt(sel.ld, sel.ld < 10 ? 2 : 1)} Moon distances` } : null;
  v.setDate(jd);
  $('#slider').value = ((ms - state.anchor) / DAY + 365).toFixed(2);
  $('#oDate').textContent = new Date(ms).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  const d = new Date(ms); $('#goDate').value = d.toISOString().slice(0, 10);
  readouts();
}

function readouts() {
  const k = state.k, jd = state.jd;
  const earth = planetPosition('Earth', jd), ast = asteroidPosition(k, jd);
  const dE = dist(earth, ast), r = Math.hypot(...ast);
  const speed = Math.sqrt(GM_SUN * (2 / (r * AU_KM) - 1 / (k.a * AU_KM)));   // vis-viva: v² = GM (2/r − 1/a)
  tiles('#readouts', [
    { label: 'From Earth', value: dE / LD_AU < 1000 ? fmt(dE / LD_AU, dE / LD_AU < 1 ? 2 : 1) + ' <small>LD</small>' : fmt(dE, 2) + ' <small>au</small>', note: `${fmt(dE, 3)} au · ${fmt(dE * AU_KM / 1e6, 1)} million km` },
    { label: 'From the Sun', value: fmt(r, 3) + ' <small>au</small>', note: `${fmt(r * 149.6, 0)} million km` },
    { label: 'Speed around the Sun', value: fmt(speed, 1) + ' <small>km/s</small>', note: `Earth: about 29.8 km/s` },
    { label: 'Height above Earth\'s orbit plane', value: (ast[2] >= 0 ? '+' : '−') + fmt(Math.abs(ast[2]), 3) + ' <small>au</small>', note: ast[2] >= 0 ? 'above (north)' : 'below (south)' },
  ]);

  // how much to trust the drawing at this date: years from when the orbit was measured
  const yrs = Math.abs(jd - k.epoch) / 365.25, measured = new Date(msFromJd(k.epoch)).toISOString().slice(0, 10);
  const acc = yrs <= 10 ? 'good' : yrs <= 40 ? 'approximate' : 'rough';
  $('#oAcc').textContent = acc === 'good' ? 'positions: good' : acc === 'approximate' ? 'positions: approximate' : 'positions: rough';
  $('#oAcc').className = 'note acc-' + acc;
  $('#accNote').innerHTML = `<b>How exact is it?</b> Positions are worked out from the orbit NASA measured for ${measured}, with the Sun's pull only. ` +
    `Within about 10 years of that date the drawing is good; further away it drifts, because the planets' pull slowly changes the orbit. ` +
    `It shows the shape and timing of a close pass, not its exact distance: NASA's own figures are in the list below. This date is ${fmt(yrs, 1)} years from ${measured}: <b>${acc}</b>.`;

  // the selected approach: NASA's figure beside the diagram's
  const sel = state.sel;
  if (sel && Math.abs(msFromJd(jd) - sel.t) < 2 * DAY) {
    $('#approachNote').innerHTML = `Close approach on ${dateText(sel.t, true)} UTC. <b>NASA/JPL: ${fmt(sel.ld, 2)} LD</b> (${fmt(sel.km)} km) at ${fmt(sel.v, 1)} km/s. ` +
      `This diagram: ${fmt(dE / LD_AU, dE / LD_AU < 10 ? 2 : 1)} LD${sel.ld < 1 ? ' (so close that Earth\'s own pull, left out of the diagram, bends the path)' : ''}.`;
  } else if (sel && sel.t >= MIN_MS && sel.t <= MAX_MS) {
    // a countdown to the selected approach, which the rings on the diagram mark
    const days = Math.round((sel.t - msFromJd(jd)) / DAY), n = Math.abs(days);
    const span = n >= 730 ? `${fmt(n / 365.25, 1)} years` : `${fmt(n)} day${n === 1 ? '' : 's'}`;
    $('#approachNote').innerHTML = `<b>Closest approach ${days > 0 ? 'in ' + span : span + ' ago'}</b>: ${dateText(sel.t)} ${new Date(sel.t).getUTCFullYear()}, ` +
      `${fmt(sel.ld, sel.ld < 10 ? 2 : 1)} LD (NASA/JPL). The two rings show where Earth and the asteroid ${days > 0 ? 'will be' : 'were'} at that moment` +
      `${days > 0 ? '; Play stops there' : ''}.`;
  } else {
    const next = state.approaches.find((a) => a.t > msFromJd(jd) + DAY);
    $('#approachNote').innerHTML = next ? `Next close approach after this date: ${dateText(next.t)} ${new Date(next.t).getUTCFullYear()}, ${fmt(next.ld, 1)} LD (NASA/JPL).` : '';
  }
  $('#toApproach').disabled = !state.approaches.some((a) => a.t > msFromJd(jd) + DAY && a.t <= MAX_MS);
}

// ---------------------------------------------------------------- controls
function syncViewButtons() {
  $$('[data-tilt]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(state.view.tilt - Number(b.dataset.tilt)) < 0.5));
}
$$('[data-tilt]').forEach((b) => b.addEventListener('click', () => { state.view.setView({ tilt: Number(b.dataset.tilt), spin: state.view.spin }); syncViewButtons(); }));
$('#zoomIn').addEventListener('click', () => { const v = state.view; if (v.nearEarth) v.nearRadius = Math.max(0.004, v.nearRadius / 1.6); else v.zoom = Math.min(12, v.zoom * 1.5); v.draw(); });
$('#zoomOut').addEventListener('click', () => { const v = state.view; if (v.nearEarth) v.nearRadius = Math.min(0.5, v.nearRadius * 1.6); else v.zoom = Math.max(0.6, v.zoom / 1.5); v.draw(); });
$('#zoomFit').addEventListener('click', () => { const v = state.view; v.zoom = 1; v.nearEarth = false; $('#zoomEarth').setAttribute('aria-pressed', 'false'); v.draw(); });
$('#zoomEarth').addEventListener('click', () => {
  const v = state.view; v.nearEarth = !v.nearEarth;
  if (v.nearEarth) {   // fit the selected approach, or the current distance, comfortably in view
    const ld = state.sel ? state.sel.ld : dist(planetPosition('Earth', state.jd), asteroidPosition(state.k, state.jd)) / LD_AU;
    v.nearRadius = Math.max(0.006, Math.min(0.4, ld * LD_AU * 2.6));
  }
  $('#zoomEarth').setAttribute('aria-pressed', v.nearEarth);
  v.draw();
});
$$('[data-step]').forEach((b) => b.addEventListener('click', () => { stop(); setDate(state.jd + Number(b.dataset.step)); }));
$('#slider').addEventListener('input', (e) => { stop(); setDate(jdFromMs(state.anchor + (Number(e.target.value) - 365) * DAY)); });
$('#toToday').addEventListener('click', () => { stop(); setAnchor(Date.now()); setDate(jdFromMs(Date.now())); });
$('#toApproach').addEventListener('click', () => {
  stop();
  const next = state.approaches.find((a) => a.t > msFromJd(state.jd) + DAY && a.t <= MAX_MS);
  if (next) selectApproach(next, false);
});
$('#goDate').addEventListener('change', (e) => {
  const ms = Date.parse(e.target.value + 'T00:00:00Z');
  if (!isNaN(ms)) { stop(); setAnchor(ms); setDate(jdFromMs(ms)); }
});

// play: time runs at the chosen number of days per second; stops by itself at 2050
let raf = null, last = 0;
function frame(t) {
  if (!state.playing) return;
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
  const next = state.jd + dt * Number($('#speed').value);
  if (msFromJd(next) >= MAX_MS) { setDate(jdFromMs(MAX_MS)); stop(); return; }
  // reaching the selected close approach: stop exactly at that moment, so both meeting points line up on screen.
  // "held" remembers the stop, so pressing Play again carries on from there; it is forgotten once the date moves
  // away (by playing on, or the slider), so playing towards the approach again stops again.
  const sel = state.sel && state.sel.t >= MIN_MS && state.sel.t <= MAX_MS ? jdFromMs(state.sel.t) : null;
  if (state.held !== null && Math.abs(state.jd - state.held) > 0.01) state.held = null;
  if (sel !== null && state.held !== sel && state.jd < sel && next >= sel) { setDate(sel); state.held = sel; stop(); return; }
  setDate(next);
  raf = requestAnimationFrame(frame);
}
function play() {
  // starting at the approach itself (as a link to it opens): carry on from it rather than stop at once
  const sel = state.sel ? jdFromMs(state.sel.t) : null;
  if (sel !== null && Math.abs(state.jd - sel) < 0.001) state.held = sel;
  state.playing = true; last = 0; $('#play').setAttribute('aria-pressed', 'true'); $('#play').textContent = '❚❚ Pause'; raf = requestAnimationFrame(frame); }
function stop() { state.playing = false; if (raf) cancelAnimationFrame(raf); raf = null; $('#play').setAttribute('aria-pressed', 'false'); $('#play').textContent = '▶ Play'; }
$('#play').addEventListener('click', () => (state.playing ? stop() : play()));
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

let resizeTimer;
addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(() => { if (state.view) { state.view.draw(); approachChart(); } }, 150); });

// ---------------------------------------------------------------- every approach: chart and list
function selectApproach(a, scroll = true) {
  state.sel = a;
  if (a.t < MIN_MS || a.t > MAX_MS) {
    renderApproaches();
    $('#approachNote').innerHTML = `The approach on ${dateText(a.t)} ${new Date(a.t).getUTCFullYear()} (${fmt(a.ld, 2)} LD, NASA/JPL) is outside the diagram's range, 1900 to 2050.`;
    return;
  }
  setAnchor(a.t); setDate(jdFromMs(a.t)); renderApproaches();
  if (scroll) $('.orbitcard').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}

function renderApproaches() { approachChart(); approachTable(); }

function approachChart() {
  const svg = $('#cApproaches'), list = state.approaches;
  const W = Math.max(280, Math.round(svg.parentElement.clientWidth || 600)), H = 240, m = { l: 52, r: 14, t: 20, b: 34 };
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.innerHTML = '';
  const el = (tag, attrs, parent = svg) => { const e = document.createElementNS(NS, tag); for (const [a, v] of Object.entries(attrs)) e.setAttribute(a, v); parent.appendChild(e); return e; };
  const txt = (attrs, s) => { const t = el('text', attrs); t.textContent = s; return t; };
  if (!list.length) { txt({ x: W / 2, y: H / 2, 'text-anchor': 'middle', 'font-style': 'italic' }, 'NASA lists no close approaches to Earth for this object.'); return; }
  const y0 = new Date(list[0].t).getUTCFullYear(), y1 = new Date(list[list.length - 1].t).getUTCFullYear() + 1;
  const a0 = Date.UTC(Math.floor(y0 / 25) * 25, 0, 1), a1 = Date.UTC(Math.ceil(y1 / 25) * 25, 0, 1);
  const lo = Math.floor(Math.log10(Math.min(...list.map((a) => a.ld)))), hi = Math.ceil(Math.log10(Math.max(...list.map((a) => a.ld)) * 1.01));
  const X = (t) => m.l + (t - a0) / (a1 - a0) * (W - m.l - m.r);
  const Y = (ld) => H - m.b - (Math.log10(ld) - lo) / Math.max(1, hi - lo) * (H - m.t - m.b);
  const grid = el('g', { class: 'grid' });
  const span = (a1 - a0) / (365.25 * DAY), stepY = span > 200 ? 50 : span > 80 ? 25 : 10;
  for (let y = new Date(a0).getUTCFullYear(); y <= new Date(a1).getUTCFullYear(); y += stepY) {
    const x = X(Date.UTC(y, 0, 1)); el('line', { x1: x, x2: x, y1: m.t, y2: H - m.b }, grid);
    if (W >= 600 || y % (stepY * 2) === 0) txt({ x, y: H - m.b + 16, 'text-anchor': 'middle' }, y);
  }
  for (let p = lo; p <= Math.max(hi, lo + 1); p++) { const v = 10 ** p; el('line', { x1: m.l, x2: W - m.r, y1: Y(v), y2: Y(v) }, grid); txt({ x: m.l - 8, y: Y(v) + 4, 'text-anchor': 'end' }, v >= 1 ? fmt(v) : String(v)); }
  txt({ x: 14, y: (H - m.b + m.t) / 2, 'text-anchor': 'middle', class: 'axt', transform: `rotate(-90 14 ${(H - m.b + m.t) / 2})` }, 'Distance, LD');
  if (lo <= 0 && hi >= 0) { el('line', { x1: m.l, x2: W - m.r, y1: Y(1), y2: Y(1), stroke: '#E2C88E', 'stroke-dasharray': '4 4', opacity: 0.7 }); txt({ x: W - m.r - 4, y: Y(1) - 6, 'text-anchor': 'end', fill: '#E2C88E' }, 'the Moon'); }
  const now = Date.now();
  el('line', { x1: X(now), x2: X(now), y1: m.t, y2: H - m.b, stroke: '#EDE6D3', opacity: 0.6 });
  txt({ x: X(now) + 5, y: m.t - 6, fill: '#EDE6D3' }, 'today');
  // shade the years the diagram cannot show
  if (MAX_MS < a1) el('rect', { x: X(MAX_MS), y: m.t, width: X(a1) - X(MAX_MS), height: H - m.t - m.b, fill: '#5E6775', opacity: 0.12 });
  if (MIN_MS > a0) el('rect', { x: X(a0), y: m.t, width: X(MIN_MS) - X(a0), height: H - m.t - m.b, fill: '#5E6775', opacity: 0.12 });
  for (const a of list) {
    const past = a.t < now, sel = a === state.sel, g = el('g', {});
    if (sel) el('circle', { cx: X(a.t), cy: Y(a.ld), r: 9, fill: 'none', stroke: '#E2C88E', 'stroke-width': 1.5 }, g);
    el('circle', { cx: X(a.t), cy: Y(a.ld), r: 4, fill: past ? '#C0A062' : '#0C1119', stroke: '#C0A062', 'stroke-width': 1.5 }, g);
    el('circle', { cx: X(a.t), cy: Y(a.ld), r: 10, fill: 'transparent' }, g);
    hoverTip(g, `<b>${dateText(a.t)} ${new Date(a.t).getUTCFullYear()}</b><br>${fmt(a.ld, a.ld < 10 ? 2 : 1)} LD · ${fmt(a.km)} km<br>${fmt(a.v, 1)} km/s${a.t > MAX_MS || a.t < MIN_MS ? '<br>outside the diagram\'s range' : ''}`);
    g.addEventListener('click', () => { hideTip(); selectApproach(a); });
  }
}

function approachTable() {
  const list = state.approaches, now = Date.now();
  // around the selected or next approach first; "Show all" lists every one
  let shown = list;
  if (!state.showAll && list.length > ROWS) {
    const focus = state.sel ? list.indexOf(state.sel) : list.findIndex((a) => a.t >= now);
    const from = Math.max(0, Math.min(list.length - ROWS, (focus < 0 ? list.length : focus) - 4));
    shown = list.slice(from, from + ROWS);
  }
  $('#caTable tbody').innerHTML = shown.length ? shown.map((a) => {
    const i = list.indexOf(a), out = a.t > MAX_MS || a.t < MIN_MS;
    return `<tr data-i="${i}" tabindex="0" aria-selected="${a === state.sel}"${out ? ' class="out"' : ''}>
      <td data-label="Date (UTC)">${dateText(a.t)} ${new Date(a.t).getUTCFullYear()}, ${new Date(a.t).toISOString().slice(11, 16)}</td>
      <td data-label="Distance" class="num"><span>${fmt(a.ld, a.ld < 10 ? 2 : 1)} LD<span class="s">${fmt(a.km)} km</span></span></td>
      <td data-label="Speed" class="num"><span>${fmt(a.v, 1)} km/s</span></td>
      <td data-label="">${a.t < now ? '<span class="tag">passed</span>' : '<span class="tag">predicted</span>'}${out ? ' <span class="note">beyond the diagram</span>' : ''}</td></tr>`;
  }).join('') : '<tr class="msg"><td colspan="4"><div class="state small">No close approaches to Earth listed.</div></td></tr>';
  $('#caMore').hidden = list.length <= ROWS;
  $('#caMoreBtn').textContent = state.showAll ? 'Show fewer' : `Show all ${list.length}`;
}
$('#caTable tbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-i]'); if (tr) selectApproach(state.approaches[Number(tr.dataset.i)]); });
$('#caTable tbody').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-i]')) { e.preventDefault(); selectApproach(state.approaches[Number(e.target.dataset.i)]); } });
$('#caMoreBtn').addEventListener('click', () => { state.showAll = !state.showAll; approachTable(); });

function renderAbout() {
  const n = state.neo, od = n.orbital_data, cls = od.orbit_class || {};
  const items = [
    ['Orbit type', `${esc(cls.orbit_class_type || '—')}: ${esc(cls.orbit_class_description || '')}${cls.orbit_class_range ? ` (${esc(cls.orbit_class_range)})` : ''}`],
    ['Observed', `${fmt(od.observations_used)} observations from ${esc(od.first_observation_date)} to ${esc(od.last_observation_date)} (${fmt(od.data_arc_in_days)} days)`],
    ['Orbit worked out', `${esc((od.orbit_determination_date || '').slice(0, 10))} by NASA/JPL; uncertainty ${esc(od.orbit_uncertainty)} on a scale of 0 (best) to 9`],
    ['Brightness (H)', `${fmt(n.absolute_magnitude_h, 2)}: the larger the number, the fainter and usually smaller the object`],
    ['Orbit size and shape', `semi-major axis ${fmt(Number(od.semi_major_axis), 3)} au, eccentricity ${fmt(Number(od.eccentricity), 3)} (0 is a circle)`],
    ['NASA id', `${esc(n.id)}${n.designation ? ' · designation ' + esc(n.designation) : ''}`],
  ];
  $('#about').innerHTML = items.map(([t, d]) => `<div><dt>${t}</dt><dd>${d}</dd></div>`).join('');
}

load();

backLink(document.getElementById('back'));
