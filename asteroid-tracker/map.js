// NASA Data Projects · Asteroid Tracker · solar system map page · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// map.html[?focus=<SBDB spkid>]  The renderer is skymap.js; the data (all near-Earth asteroids, spacecraft tracks,
// this week's visitors) comes from mapdata.js, which reads the daily files in data/.

import { SolarMap, Asteroids, CLASSES, COL, spacecraftAt, classOf, COMET_CODES } from './skymap.js';
import { planetPosition, jdFromMs, msFromJd, dist, LD_AU } from './orbit.js';
import { fmt, sizeText, diameterM } from './format.js';
import { loadMapData } from './mapdata.js';
import { searchNames, neowsId, decodeName } from './search.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const DAY = 86400000, MIN_MS = Date.UTC(1900, 0, 1), MAX_MS = Date.UTC(2050, 11, 31);
const VIEWS = { top: { tilt: 0 }, tilt: { tilt: 55 }, side: { tilt: 88 } };

let map, ast, data, selected = null, playing = false;

async function start() {
  try {
    data = await loadMapData();
  } catch {
    $('#loading').innerHTML = '<span>The map data could not be loaded. <button class="linkbtn" onclick="location.reload()">Try again</button></span>';
    return;
  }
  ast = new Asteroids(data.rows);
  $('#count').textContent = fmt(ast.n);
  map = new SolarMap($('#map'), { asteroids: ast, spacecraft: data.spacecraft.map((c) => ({ ...c, show: true })) });
  // this week's visitors: rings on the map
  const byDes = new Map(data.rows.map((r, k) => [String(r[COL.pdes]), k]));
  data.visitors.forEach((d) => { const k = byDes.get(String(d)); if (k !== undefined) map.highlight.add(k); });
  map.onFrame = afterFrame;
  map.onView = () => { syncButtons(); $('#hint').classList.add('gone'); };
  map.onTap = (e) => select(map.pick(e.clientX, e.clientY, 14));
  map.onHover = hover; map.onLeave = () => ($('#tip').hidden = true);
  setDate(Date.now());
  buildLegend(); buildCraft();
  setupYears();
  const focus = new URLSearchParams(location.search).get('focus');
  if (focus) {
    const k = data.rows.findIndex((r) => String(r[COL.pdes]) === focus || String(r[COL.spkid]) === focus);
    if (k >= 0) { select({ kind: 'asteroid', k, name: data.rows[k][COL.name] }); centre({ asteroid: k }); map.setView({ viewR: 1.6 }); syncButtons(); }
  }
  $('#loading').hidden = true;
  syncButtons();
}

// ---------------------------------------------------------------- after each frame: date, scale bar
function afterFrame(m) {
  // a scale bar of a round length about 80–160 px long
  const pxPerAu = (Math.min(m.cv.width, m.cv.height) / 2 - 10 * m.dpr) / m.viewR / m.dpr;
  const steps = [0.001, 0.0025, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const u = steps.find((v) => v * pxPerAu >= 70) || 100;
  $('#scaleBar').style.width = Math.round(u * pxPerAu) + 'px';
  $('#scaleLbl').textContent = u < 0.05 ? `${fmt(u / LD_AU, 0)} Moon distances` : `${u} au · ${fmt(u * 149.6, u < 1 ? 1 : 0)} million km`;
  if (selected && m._lastSelDay !== shownDay) { m._lastSelDay = shownDay; showSelected(false); }
}

// ---------------------------------------------------------------- date and play
let shownDay = null;
function setDate(ms) {
  ms = Math.max(MIN_MS, Math.min(MAX_MS, ms));
  map.setDate(jdFromMs(ms));
  const day = Math.floor(ms / DAY);
  if (day === shownDay) return;                       // the text changes only once a day of map time
  shownDay = day;
  $('#mDate').textContent = new Date(ms).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  $('#date').value = new Date(ms).toISOString().slice(0, 10);
  $('#mSub').textContent = Math.abs(ms - Date.now()) < DAY ? 'today' : '';
}
const nowMs = () => msFromJd(map.jd);
let last = 0, raf = null;
function tick(t) {
  if (!playing) return;
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
  const next = nowMs() + dt * Number($('#speed').value) * DAY;
  if (next >= MAX_MS) { setDate(MAX_MS); stop(); return; }
  setDate(next);
  raf = requestAnimationFrame(tick);
}
function play() { playing = true; map.quick = true; last = 0; $('#play').setAttribute('aria-pressed', 'true'); $('#play').textContent = '❚❚ Pause'; raf = requestAnimationFrame(tick); }
function stop() { if (playing) { map.quick = false; map.ast.jd = null; map.request(); } playing = false; if (raf) cancelAnimationFrame(raf); raf = null; $('#play').setAttribute('aria-pressed', 'false'); $('#play').textContent = '▶ Play'; }
$('#play').addEventListener('click', () => (playing ? stop() : play()));
$$('[data-step]').forEach((b) => b.addEventListener('click', () => { stop(); setDate(nowMs() + Number(b.dataset.step) * DAY); }));
$('#today').addEventListener('click', () => { stop(); setDate(Date.now()); });
$('#date').addEventListener('change', (e) => { const ms = Date.parse(e.target.value + 'T00:00:00Z'); if (!isNaN(ms)) { stop(); setDate(ms); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

// ---------------------------------------------------------------- view controls
function syncButtons() {
  $$('[data-v]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(map.tilt - VIEWS[b.dataset.v].tilt) < 1));
  $$('[data-r]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(Math.log(map.viewR / Number(b.dataset.r))) < 0.05));
  const c = map.center;
  $$('[data-c]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === 'sel' ? typeof c === 'object' : c === b.dataset.c));
  $$('[data-f]').forEach((b) => b.setAttribute('aria-pressed', map.filter === b.dataset.f));
}
// smooth transitions between views (skipped when the user prefers reduced motion)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateTo(target, ms = 600) {
  if (reduce) { map.setView(target); syncButtons(); return; }
  const from = { tilt: map.tilt, spin: map.spin, viewR: map.viewR }, t0 = performance.now();
  const step = (t) => {
    const f = Math.min(1, (t - t0) / ms), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const v = {};
    if (target.tilt !== undefined) v.tilt = from.tilt + (target.tilt - from.tilt) * e;
    if (target.spin !== undefined) v.spin = from.spin + (target.spin - from.spin) * e;
    if (target.viewR !== undefined) v.viewR = Math.exp(Math.log(from.viewR) + (Math.log(target.viewR) - Math.log(from.viewR)) * e);
    map.setView(v);
    if (f < 1) requestAnimationFrame(step); else syncButtons();
  };
  requestAnimationFrame(step);
}
$$('[data-v]').forEach((b) => b.addEventListener('click', () => animateTo(VIEWS[b.dataset.v])));
$$('[data-r]').forEach((b) => b.addEventListener('click', () => animateTo({ viewR: Number(b.dataset.r) }, 900)));
function centre(c) { map.center = c; map.request(); syncButtons(); }
$$('[data-c]').forEach((b) => b.addEventListener('click', () => {
  if (b.dataset.c === 'sel') { if (selected) centre(selected.kind === 'asteroid' ? { asteroid: selected.k } : selected.kind === 'craft' ? { craft: selected.i } : selected.name); }
  else centre(b.dataset.c);
}));
$$('[data-f]').forEach((b) => b.addEventListener('click', () => { map.filter = b.dataset.f; map.request(); syncButtons(); }));
$('#zIn').addEventListener('click', () => animateTo({ viewR: map.viewR / 1.8 }, 300));
$('#zOut').addEventListener('click', () => animateTo({ viewR: map.viewR * 1.8 }, 300));
$('#craftBtn').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on); map.spacecraft.forEach((c) => (c.show = on)); map.request(); buildCraft();
});
$('#weekBtn').addEventListener('click', (e) => {
  const on = e.currentTarget.getAttribute('aria-pressed') !== 'true';
  e.currentTarget.setAttribute('aria-pressed', on);
  if (on) { map.highlight = map._savedHighlight || map.highlight; } else { map._savedHighlight = map.highlight; map.highlight = new Set(); }
  map.request();
});
// full screen: the browser's own where it allows it for page elements, otherwise the map fills the window
const frameEl = $('#mapframe');
const isFull = () => !!document.fullscreenElement || frameEl.classList.contains('pseudo-full');
function syncFull() {
  const on = isFull();
  $('#full').textContent = on ? '⤡' : '⤢';
  $('#full').setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  $('#full').title = on ? 'Exit full screen (Esc)' : 'Full screen';
  map && map.resize();
}
$('#full').addEventListener('click', () => {
  if (document.fullscreenElement) { document.exitFullscreen(); return; }
  if (frameEl.classList.contains('pseudo-full')) { frameEl.classList.remove('pseudo-full'); document.body.classList.remove('noscroll'); syncFull(); return; }
  const fallback = () => { frameEl.classList.add('pseudo-full'); document.body.classList.add('noscroll'); syncFull(); };
  if (frameEl.requestFullscreen) frameEl.requestFullscreen().catch(fallback); else fallback();
});
document.addEventListener('fullscreenchange', syncFull);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && frameEl.classList.contains('pseudo-full')) { frameEl.classList.remove('pseudo-full'); document.body.classList.remove('noscroll'); syncFull(); } });

// ---------------------------------------------------------------- selection
function select(b) {
  if (!b) return;
  if (b.kind === 'planet' && b.name === 'Earth') b = { kind: 'planet', name: 'Earth' };
  selected = b;
  map.selected = b.kind === 'asteroid' ? b.k : -1;
  $('#cSel').disabled = false;
  map.request();
  showSelected(true);
}
function showSelected(full) {
  const b = selected; if (!b || !map) return;
  const earth = planetPosition('Earth', map.jd);
  let pos = null, html = '';
  if (b.kind === 'asteroid') {
    const r = data.rows[b.k], H = r[COL.H], d = r[COL.diameter];
    const size = d ? { dmin: d * 1000, dmax: d * 1000, measured: true } : H !== null ? { dmin: diameterM(H, 0.25), dmax: diameterM(H, 0.05) } : { dmin: NaN, dmax: NaN };
    const comet = COMET_CODES.has(r[COL.cls]);
    const cls = CLASSES[classOf(r[COL.cls])] || { name: r[COL.cls] || '—', note: '' };
    const dec = comet ? null : decodeName(r[COL.name]);
    const seen = !comet && r[COL.firstSeen] && r[COL.found] && r[COL.firstSeen] < r[COL.found] ? `<div><dt>First seen</dt><dd>${r[COL.firstSeen]}, in older images found later</dd></div>` : '';
    pos = [ast.x[b.k], ast.y[b.k], ast.z[b.k]];
    const page = comet ? `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(r[COL.pdes])}` : `object.html?id=${neowsId(r)}`;
    if (full) html = `<h3>${esc(r[COL.name].trim())}</h3>
      <p class="tags">${r[COL.pha] === 'Y' ? '<span class="tag haz">Potentially hazardous</span>' : ''}<span class="tag">${esc(cls.name)}</span></p>
      ${dec ? `<p class="decode">${esc(dec)}</p>` : ''}
      <dl class="mini">${comet ? '' : `<div><dt>Size, est.</dt><dd>${sizeText(size)}</dd></div>`}<div><dt>Orbit</dt><dd>${esc(cls.note)}</dd></div>${seen}
      <div><dt>From the Sun</dt><dd id="sSun"></dd></div><div><dt>From Earth</dt><dd id="sEarth"></dd></div></dl>
      <p class="dlinks"><a class="btn" href="${page}"${comet ? ' target="_blank" rel="noopener"' : ''}>${comet ? 'JPL\'s page ›' : 'Open its page ›'}</a><button class="btn ghost" id="selCentre">Centre on it</button></p>`;
  } else if (b.kind === 'craft') {
    const c = map.spacecraft[b.i]; pos = spacecraftAt(c, map.jd);
    if (full) html = `<h3>${esc(c.name)}</h3><p class="note" style="margin-top:4px">${esc(c.note || '')}</p>
      <dl class="mini"><div><dt>From the Sun</dt><dd id="sSun"></dd></div><div><dt>From Earth</dt><dd id="sEarth"></dd></div></dl>
      <p class="dlinks"><button class="btn ghost" id="selCentre">Centre on it</button></p>`;
  } else {
    pos = planetPosition(b.name, map.jd);
    if (full) html = `<h3>${esc(b.name)}</h3><dl class="mini"><div><dt>From the Sun</dt><dd id="sSun"></dd></div>${b.name === 'Earth' ? '' : '<div><dt>From Earth</dt><dd id="sEarth"></dd></div>'}</dl>
      <p class="dlinks"><button class="btn ghost" id="selCentre">Centre on it</button></p>`;
  }
  if (full) {
    $('#selBody').innerHTML = html;
    const btn = $('#selCentre');
    if (btn) btn.addEventListener('click', () => centre(b.kind === 'asteroid' ? { asteroid: b.k } : b.kind === 'craft' ? { craft: b.i } : b.name));
  }
  if (pos) {
    const r = Math.hypot(...pos), dE = dist(pos, earth);
    if ($('#sSun')) $('#sSun').textContent = `${fmt(r, r < 10 ? 3 : 1)} au · ${fmt(r * 149.6, 0)} million km`;
    if ($('#sEarth')) $('#sEarth').textContent = dE < 0.26 ? `${fmt(dE / LD_AU, 1)} Moon distances · ${fmt(dE * 149.6, 1)} million km` : `${fmt(dE, dE < 10 ? 3 : 1)} au · ${fmt(dE * 149.6, 0)} million km`;
  } else if ($('#sSun')) { $('#sSun').textContent = 'not in flight on this date'; if ($('#sEarth')) $('#sEarth').textContent = '—'; }
}

// hover tooltip (mouse only): the nearest object under the pointer, at most once per frame
let hoverRaf = null;
function hover(e) {
  if (e.pointerType !== 'mouse' || hoverRaf) return;
  hoverRaf = requestAnimationFrame(() => {
    hoverRaf = null;
    const b = map.pick(e.clientX, e.clientY, 9), tip = $('#tip');
    if (!b) { tip.hidden = true; return; }
    let html = `<b>${esc(b.name)}</b>`;
    if (b.kind === 'asteroid') { const r = data.rows[b.k]; html += `<br>${esc((CLASSES[classOf(r[COL.cls])] || {}).name || '')}${r[COL.pha] === 'Y' ? ' · potentially hazardous' : ''}<br><span class="note">tap for details</span>`; }
    tip.innerHTML = html; tip.hidden = false;
    tip.style.left = Math.min(e.clientX + 14, innerWidth - tip.offsetWidth - 8) + 'px'; tip.style.top = e.clientY + 14 + 'px';
  });
}

// ---------------------------------------------------------------- legend and spacecraft list
function buildLegend() {
  const counts = {}; for (let k = 0; k < ast.n; k++) { const c = classOf(data.rows[k][COL.cls]); counts[c] = (counts[c] || 0) + 1; }
  $('#classlist').innerHTML = Object.entries(CLASSES).map(([code, c]) =>
    `<li><i style="background:rgb(${c.rgb.join(',')})"></i><span><b>${c.name}</b> · ${fmt(counts[code] || 0)}<br><span class="note">${c.note}</span></span></li>`).join('') +
    `<li><i class="ring"></i><span><b>This week's visitors</b> · ${fmt(map.highlight.size)}</span></li>`;
}
function buildCraft() {
  $('#craftlist').innerHTML = map.spacecraft.map((c, i) => `<li><button class="linkbtn" data-craft="${i}">${esc(c.name)}</button><span class="note">${esc(c.short || '')}</span></li>`).join('');
  $$('[data-craft]').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.craft), p = spacecraftAt(map.spacecraft[i], map.jd);
    select({ kind: 'craft', i, name: map.spacecraft[i].name });
    if (p) { const r = Math.hypot(...p); animateTo({ viewR: Math.max(1.7, r * 1.25) }, 900); }
  }));
}

// ---------------------------------------------------------------- find an asteroid on the map
const findInput = $('#find'), findList = $('#findList');
let findHits = [], findIdx = -1;
findInput.addEventListener('input', () => {
  const q = findInput.value;
  findHits = q.trim() ? searchNames(data.rows, q, 8) : [];
  findIdx = -1;
  findList.innerHTML = findHits.map((k, i) => `<li role="option" data-i="${i}">${esc(data.rows[k][COL.name].trim())}${data.rows[k][COL.pha] === 'Y' ? ' <span class="tag haz">hazardous</span>' : ''}</li>`).join('') ||
    (q.trim() ? '<li class="none">No near-Earth asteroid by that name</li>' : '');
  findList.hidden = !q.trim();
});
findInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); if (!findHits.length) return;
    findIdx = (findIdx + (e.key === 'ArrowDown' ? 1 : -1) + findHits.length) % findHits.length;
    $$('#findList li').forEach((li, i) => li.setAttribute('aria-selected', i === findIdx));
  } else if (e.key === 'Enter' && findHits.length) { pickFound(findHits[Math.max(0, findIdx)]); }
  else if (e.key === 'Escape') { findList.hidden = true; }
});
findList.addEventListener('click', (e) => { const li = e.target.closest('li[data-i]'); if (li) pickFound(findHits[Number(li.dataset.i)]); });
function pickFound(k) {
  findList.hidden = true; findInput.value = data.rows[k][COL.name].trim();
  select({ kind: 'asteroid', k, name: data.rows[k][COL.name].trim() });
  const r = Math.hypot(ast.x[k], ast.y[k], ast.z[k]);
  animateTo({ viewR: Math.max(1.4, r * 1.3) }, 700);
}
document.addEventListener('click', (e) => { if (!e.target.closest('.ovl-find')) findList.hidden = true; });

// ---------------------------------------------------------------- years: found by, close to Earth in
let watching = null;
function setupYears() {
  const now = new Date().getUTCFullYear(), lo = 1960;
  const slider = $('#foundBy');
  slider.min = lo; slider.max = now; slider.value = now;
  const byYear = new Map(); data.rows.forEach((r) => { const y = r[COL.found]; if (y) byYear.set(y, (byYear.get(y) || 0) + 1); });
  const knownBy = (y) => { let t = 0; for (const [yy, c] of byYear) if (yy <= y) t += c; return t; };
  const show = (y, user) => {
    y = Number(y);
    map.foundMax = y >= now ? 9999 : y;
    $('#foundYear').textContent = y;
    const known = knownBy(y), that = byYear.get(y) || 0;
    $('#foundNote').textContent = y >= now
      ? `All ${fmt(known)} known asteroids (comets are always shown). Move the slider back in time, or press Watch.`
      : `${fmt(known)} known by the end of ${y}${that ? `; the ${fmt(that)} found in ${y} shine white` : ''}.${y < 1990 ? ' Before the 1990s few were known: telescope surveys had not yet started searching the sky every night.' : ''}`;
    map.request();
    if (user) stopWatch();
  };
  slider.addEventListener('input', () => show(slider.value, true));
  $('#watch').addEventListener('click', () => {
    if (watching) { stopWatch(); return; }
    let y = Number(slider.value) >= now ? lo : Number(slider.value);
    $('#watch').setAttribute('aria-pressed', 'true'); $('#watch').textContent = '❚❚ Pause';
    const stepMs = reduce ? 900 : 380;
    watching = setInterval(() => {
      y += 1; slider.value = y; show(y, false);
      if (y >= now) stopWatch();
    }, stepMs);
    show(y, false);
  });
  show(now, false);
  // close to Earth in a year: the years with close-approach files
  fetch('data/years.json').then((r) => (r.ok ? r.json() : null)).then((ix) => {
    if (!ix) return;
    $('#closeIn').innerHTML = '<option value="">Any year</option>' + ix.years.slice().reverse().map((y) => `<option value="${y.year}">${y.year} · ${fmt(y.counts['10'])} passes</option>`).join('');
  }).catch(() => {});
  const byDes = new Map(data.rows.map((r, k) => [String(r[COL.pdes]), k]));
  $('#closeIn').addEventListener('change', async (e) => {
    const y = e.target.value;
    if (!y) { map.only = null; map.request(); $('#closeNote').textContent = 'Pick a year to see only the asteroids that passed within 10 Moon distances of Earth that year.'; return; }
    $('#closeNote').textContent = 'Loading…';
    try {
      const d = await (await fetch(`data/${y}.json`)).json();
      const set = new Set(); d.rows.forEach((r) => { const k = byDes.get(String(r[5])); if (k !== undefined) set.add(k); });
      map.only = set; map.request();
      $('#closeNote').textContent = `${fmt(set.size)} asteroids passed within 10 Moon distances of Earth in ${y}, shown where they are on the date above. Set "Any year" to see all again.`;
    } catch { $('#closeNote').textContent = 'That year could not be loaded. Try again.'; }
  });
}
function stopWatch() {
  if (watching) clearInterval(watching);
  watching = null;
  $('#watch').setAttribute('aria-pressed', 'false'); $('#watch').textContent = '▶ Watch the discoveries';
}

start();
