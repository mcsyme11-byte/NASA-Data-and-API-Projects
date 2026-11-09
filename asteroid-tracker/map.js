// NASA and ESA Data Projects · Asteroid Tracker · solar system map page · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// map.html[?focus=<SBDB spkid>]  The renderer is skymap.js; the data (all near-Earth asteroids, spacecraft tracks,
// this week's visitors) comes from mapdata.js, which reads the daily files in data/.

import { SolarMap, Asteroids, CLASSES, COL, spacecraftAt, classOf, COMET_CODES, hermiteAt, hermiteVel } from './skymap.js';
import { planetPosition, jdFromMs, msFromJd, dist, LD_AU, AU_KM } from './orbit.js';
import { fmt, sizeText, sizePicture, diameterM, LD_KM } from './format.js';
import { loadMapData } from './mapdata.js';
import { searchNames, neowsId, decodeName } from './search.js';
import { backLink, placeKeeper, scrollBack } from './back.js';

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
  ast.update(jdFromMs(Date.now()));                   // first positions here, then the background thread takes over
  ast.useWorker(() => map && map.request());
  $('#count').textContent = fmt(ast.n);
  map = new SolarMap($('#map'), { asteroids: ast, spacecraft: data.spacecraft.map((c) => ({ ...c, show: true })) });
  // this week's visitors: rings on the map
  const byDes = new Map(data.rows.map((r, k) => [String(r[COL.pdes]), k]));
  data.visitors.forEach((d) => { const k = byDes.get(String(d)); if (k !== undefined) map.highlight.add(k); });
  map.onFrame = afterFrame;
  map.onView = () => { syncButtons(); $('#hint').classList.add('gone'); };
  map.onTap = (e) => select(map.pick(e.clientX, e.clientY, 14));
  map.onHover = hover; map.onLeave = () => ($('#tip').hidden = true);
  setDate(Date.now(), true);
  buildLegend(); buildCraft();
  setupYears();
  const focus = new URLSearchParams(location.search).get('focus');
  if (focus) {
    const k = data.rows.findIndex((r) => String(r[COL.pdes]) === focus || String(r[COL.spkid]) === focus);
    if (k >= 0) { select({ kind: 'asteroid', k, name: data.rows[k][COL.name] }); centre({ asteroid: k }); map.setView({ viewR: 1.6 }); syncButtons(); }
  }
  $('#loading').hidden = true;
  if (place) restorePlace(place);
  syncButtons();
}

// ---------------------------------------------------------------- coming back to the same view
// On Back or a reload, the map returns to the view it was left in: zoom, angle, centre, selection, date (or the live
// clock), speed, filters and spacecraft. A famous pass in progress starts again from its beginning.
const pdesOf = (k) => String(data.rows[k][COL.pdes]);
const place = placeKeeper('map', () => {
  if (!map) return {};
  const c = map.center, s = selected;
  return {
    viewR: map.viewR, spin: map.spin, tilt: map.tilt, tour: tour ? tour.id : null, panX: map.panX, panY: map.panY, panMode: map.panMode,
    center: typeof c === 'object' && c ? (c.asteroid !== undefined ? { asteroid: pdesOf(c.asteroid) } : { craft: c.craft }) : c,
    sel: !s ? null : s.kind === 'asteroid' || s.kind === 'tour' ? { kind: 'asteroid', pdes: pdesOf(s.k) } : s.kind === 'craft' ? { kind: 'craft', i: s.i } : s.kind === 'planet' ? { kind: 'planet', name: s.name } : null,
    ms: live ? null : nowMs(), speed: $('#speed').value, filter: map.filter,
    foundBy: $('#foundBy').value, closeIn: $('#closeIn').value, craft: map.spacecraft.map((c2) => !!c2.show),
  };
});
let pendingCloseIn = null;   // applied once the list of years has loaded
function restorePlace(p) {
  const kOf = (pdes) => data.rows.findIndex((r) => String(r[COL.pdes]) === pdes);
  if (p.tour && PASSES[p.tour]) { startTour(p.tour); scrollBack(p.scrollY); return; }
  if (Array.isArray(p.craft) && p.craft.length === map.spacecraft.length) { map.spacecraft.forEach((c, i) => (c.show = p.craft[i])); buildCraft(); }
  if ([...$('#speed').options].some((o) => o.value === p.speed)) $('#speed').value = p.speed;
  if (['all', 'haz', 'big', 'km'].includes(p.filter)) map.filter = p.filter;
  if (p.foundBy && Number(p.foundBy) !== Number($('#foundBy').value)) { $('#foundBy').value = p.foundBy; $('#foundBy').dispatchEvent(new Event('input')); }
  if (p.closeIn) pendingCloseIn = p.closeIn;
  if (Number.isFinite(p.ms)) setDate(p.ms);
  if (p.sel) {
    if (p.sel.kind === 'asteroid') { const k = kOf(p.sel.pdes); if (k >= 0) select({ kind: 'asteroid', k, name: data.rows[k][COL.name].trim() }); }
    else if (p.sel.kind === 'craft' && map.spacecraft[p.sel.i]) select({ kind: 'craft', i: p.sel.i, name: map.spacecraft[p.sel.i].name });
    else if (p.sel.kind === 'planet' && p.sel.name) select({ kind: 'planet', name: p.sel.name });
  }
  const c = p.center;
  if (c === 'Sun' || c === 'Earth') map.center = c;
  else if (c && c.asteroid !== undefined) { const k = kOf(c.asteroid); if (k >= 0) map.center = { asteroid: k }; }
  else if (c && Number.isInteger(c.craft) && map.spacecraft[c.craft]) map.center = { craft: c.craft };
  if (Number.isFinite(p.viewR) && Number.isFinite(p.tilt) && Number.isFinite(p.spin)) map.setView({ viewR: p.viewR, tilt: p.tilt, spin: p.spin });
  if (Number.isFinite(p.panX) && Number.isFinite(p.panY)) { map.panX = p.panX; map.panY = p.panY; map.panMode = !!p.panMode; map.request(); }
  $('#hint').classList.add('gone');
  scrollBack(p.scrollY);
}
backLink($('#back'));

// ---------------------------------------------------------------- after each frame: date, scale bar
function afterFrame(m) {
  // a scale bar of a round length about 80–160 px long
  const pxPerAu = (Math.min(m.cv.width, m.cv.height) / 2 - 10 * m.dpr) / m.viewR / m.dpr;
  const steps = [0.00002, 0.00005, 0.0001, 0.0002, LD_AU / 2, LD_AU, 2 * LD_AU, 5 * LD_AU, 10 * LD_AU, 0.05, 0.1, 0.25, 0.5, 1, 2, 5, 10, 20, 50, 100];
  const u = steps.find((v) => v * pxPerAu >= 70) || 100;
  $('#scaleBar').style.width = Math.round(u * pxPerAu) + 'px';
  const nLd = Math.round(u / LD_AU), kmTxt = u < LD_AU * 0.9 ? `${fmt(u * AU_KM)} km` : null;   // under 1 Moon distance: km
  $('#scaleLbl').textContent = kmTxt ? kmTxt : u < 0.05 ? `${fmt(nLd)} Moon distance${nLd === 1 ? '' : 's'}` : `${u} au · ${fmt(u * 149.6, u < 1 ? 1 : 0)} million km`;
  if (selected && m._lastSelDay !== shownDay) { m._lastSelDay = shownDay; showSelected(false); }
  else if (selected && selected.kind === 'tour' && performance.now() - (m._tourT || 0) > 150) { m._tourT = performance.now(); showSelected(false); }
}

// ---------------------------------------------------------------- date and play
// "Live": showing the present moment, the map's clock keeps running in real time (updated every 20 seconds)
let shownDay = null, live = false;
function setDate(ms, isLive = false) {
  live = isLive;
  ms = Math.max(MIN_MS, Math.min(MAX_MS, ms));
  map.setDate(jdFromMs(ms));
  const day = Math.floor(ms / DAY);
  $('#mSub').textContent = live ? `live · ${new Date(ms).toISOString().slice(11, 16)} UTC` : Math.abs(ms - Date.now()) < DAY ? 'today' : '';
  $('#mSub').classList.toggle('live', live);
  if (day === shownDay) return;                       // the date text changes only once a day of map time
  shownDay = day;
  $('#mDate').textContent = new Date(ms).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
  $('#date').value = new Date(ms).toISOString().slice(0, 10);
}
setInterval(() => { if (live && !playing && !document.hidden && map) setDate(Date.now(), true); }, 20000);
const nowMs = () => msFromJd(map.jd);
let last = 0, raf = null;
function tick(t) {
  if (!playing) return;
  const dt = last ? Math.min(0.1, (t - last) / 1000) : 0; last = t;
  const cur = nowMs(), next = cur + dt * Number($('#speed').value) * DAY;
  if (next >= MAX_MS) { setDate(MAX_MS); stop(); return; }
  if (tour && !tour.paused && cur < tour.tMs && next >= tour.tMs) {     // pause exactly at the closest moment
    tour.paused = true; setDate(tour.tMs); stop(); banner('Closest approach'); showSelected(true); return;
  }
  setDate(next);
  raf = requestAnimationFrame(tick);
}
function play() { playing = true; map.quick = true; last = 0; $('#play').setAttribute('aria-pressed', 'true'); $('#play').textContent = '❚❚ Pause'; raf = requestAnimationFrame(tick); }
function stop() { if (playing) { map.quick = false; map.ast.jd = null; map.request(); } playing = false; if (raf) cancelAnimationFrame(raf); raf = null; $('#play').setAttribute('aria-pressed', 'false'); $('#play').textContent = '▶ Play'; }
$('#play').addEventListener('click', () => (playing ? stop() : play()));
$$('[data-step]').forEach((b) => b.addEventListener('click', () => { stop(); setDate(nowMs() + Number(b.dataset.step) * DAY); }));
$('#today').addEventListener('click', () => { stop(); setDate(Date.now(), true); });
$('#date').addEventListener('change', (e) => { const ms = Date.parse(e.target.value + 'T00:00:00Z'); if (!isNaN(ms)) { stop(); setDate(ms); } });
document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });

// ---------------------------------------------------------------- view controls
function syncButtons() {
  $$('[data-v]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(map.tilt - VIEWS[b.dataset.v].tilt) < 1));
  $$('[data-r]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(Math.log(map.viewR / Number(b.dataset.r))) < 0.05));
  const c = map.center;
  $$('[data-c]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.c === 'sel' ? typeof c === 'object' : c === b.dataset.c));
  $$('[data-f]').forEach((b) => b.setAttribute('aria-pressed', map.filter === b.dataset.f));
  syncPan();
}
// smooth transitions between views (skipped when the user prefers reduced motion)
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
function animateTo(target, ms = 600) {
  if (reduce) { map.setView(target); syncButtons(); return; }
  const from = { tilt: map.tilt, spin: map.spin, viewR: map.viewR, panX: map.panX, panY: map.panY }, t0 = performance.now();
  const step = (t) => {
    const f = Math.min(1, (t - t0) / ms), e = f < 0.5 ? 2 * f * f : 1 - (-2 * f + 2) ** 2 / 2;
    const v = {};
    if (target.tilt !== undefined) v.tilt = from.tilt + (target.tilt - from.tilt) * e;
    if (target.spin !== undefined) v.spin = from.spin + (target.spin - from.spin) * e;
    if (target.viewR !== undefined) v.viewR = Math.exp(Math.log(from.viewR) + (Math.log(target.viewR) - Math.log(from.viewR)) * e);
    if (target.panX !== undefined) { v.panX = from.panX + (target.panX - from.panX) * e; v.panY = from.panY + (target.panY - from.panY) * e; }
    map.setView(v);
    if (f < 1) requestAnimationFrame(step); else syncButtons();
  };
  requestAnimationFrame(step);
}
$$('[data-v]').forEach((b) => b.addEventListener('click', () => animateTo(VIEWS[b.dataset.v])));
$$('[data-r]').forEach((b) => b.addEventListener('click', () => animateTo({ viewR: Number(b.dataset.r), panX: 0, panY: 0 }, 900)));
// Choosing a centre (or the current one again) also undoes any panning.
function centre(c) { map.center = c; map.panX = 0; map.panY = 0; map.request(); syncButtons(); }
// ---------------------------------------------------------------- panning
// The pan button makes a plain drag (or one finger) pan instead of turning; "Re-centre" appears once the view has
// been panned, and glides back to the centre object.
function syncPan() {
  const off = Math.hypot(map.panX, map.panY) > map.viewR * 0.02;
  $('#recentre').hidden = !off;
  $('#panBtn').setAttribute('aria-pressed', map.panMode);
  $('#map').classList.toggle('panmode', map.panMode);
}
$('#panBtn').addEventListener('click', () => { map.panMode = !map.panMode; syncPan(); });
$('#recentre').addEventListener('click', () => { animateTo({ panX: 0, panY: 0 }, 500); setTimeout(syncPan, 520); });
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
// icons: four corners pointing out (full screen) or pointing in, with the word "Exit" (leave full screen)
const ICON_OPEN = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3 8V3h5M12 3h5v5M17 12v5h-5M8 17H3v-5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ICON_CLOSE = '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M8 3v5H3M17 8h-5V3M12 17v-5h5M3 12h5v5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
function syncFull() {
  const on = isFull();
  $('#full').innerHTML = on ? ICON_CLOSE + '<span>Exit</span>' : ICON_OPEN;
  $('#full').classList.toggle('wide', on);
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
  if (tour && b.kind === 'asteroid' && b.k === tour.k) b = { kind: 'tour', k: b.k, name: tour.P.title };
  if (b.kind === 'planet' && b.name === 'Earth') b = { kind: 'planet', name: 'Earth' };
  selected = b;
  map.selected = b.kind === 'asteroid' || b.kind === 'tour' ? b.k : -1;
  map.selectedCraft = b.kind === 'craft' ? b.i : -1;          // its whole path, not only the last year
  $('#cSel').disabled = false;
  map.request();
  showSelected(true);
}
function showSelected(full) {
  const b = selected; if (!b || !map) return;
  const earth = map.earthAt(map.jd);
  let pos = null, html = '';
  if (b.kind === 'tour') { tourCard(full); return; }
  if (b.kind === 'asteroid') {
    const r = data.rows[b.k], H = r[COL.H], d = r[COL.diameter];
    const size = d ? { dmin: d * 1000, dmax: d * 1000, measured: true } : H !== null ? { dmin: diameterM(H, 0.25), dmax: diameterM(H, 0.05) } : { dmin: NaN, dmax: NaN };
    const comet = COMET_CODES.has(r[COL.cls]);
    const cls = CLASSES[classOf(r[COL.cls])] || { name: r[COL.cls] || '—', note: '' };
    const dec = comet ? null : decodeName(r[COL.name]);
    const seen = !comet && r[COL.firstSeen] && r[COL.found] && r[COL.firstSeen] < r[COL.found] ? `<div><dt>First seen</dt><dd>${r[COL.firstSeen]}, in older images found later</dd></div>` : '';
    pos = map.asteroidPos(b.k);
    const page = comet ? `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(r[COL.pdes])}` : `object.html?id=${neowsId(r)}`;
    if (full) html = `<h3>${esc(r[COL.name].trim())}</h3>
      <p class="tags">${r[COL.pha] === 'Y' ? '<span class="tag haz">Potentially hazardous</span>' : ''}<span class="tag">${esc(cls.name)}</span></p>
      ${dec ? `<p class="decode">${esc(dec)}</p>` : ''}
      <dl class="mini">${comet ? '' : `<div><dt>Size, est.</dt><dd>${sizeText(size)}<span class="cmp">${esc(sizePicture(size))}</span></dd></div>`}<div><dt>Orbit</dt><dd>${esc(cls.note)}</dd></div>${seen}
      <div><dt>From the Sun</dt><dd id="sSun"></dd></div><div><dt>From Earth</dt><dd id="sEarth"></dd></div></dl>
      <p class="dlinks"><a class="btn" href="${page}"${comet ? ' target="_blank" rel="noopener"' : ''}>${comet ? 'JPL\'s page ›' : 'Open its page ›'}</a><button class="btn ghost" id="selCentre">Centre on it</button></p>`;
  } else if (b.kind === 'craft') {
    const c = map.spacecraft[b.i]; pos = spacecraftAt(c, map.jd);
    if (full) html = `<h3>${esc(c.name)}</h3><p class="note" style="margin-top:4px">${esc(c.note || '')}</p>
      <dl class="mini"><div><dt>From the Sun</dt><dd id="sSun"></dd></div><div><dt>From Earth</dt><dd id="sEarth"></dd></div></dl>
      <p class="dlinks"><button class="btn ghost" id="selCentre">Centre on it</button></p>`;
  } else if (b.kind === 'moon') {
    pos = map.moonAt(map.jd);
    if (full) html = `<h3>The Moon</h3><dl class="mini"><div><dt>From Earth</dt><dd id="sEarth"></dd></div></dl>`;
  } else {
    pos = b.name === 'Earth' ? earth : planetPosition(b.name, map.jd);
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
    if (pendingCloseIn && [...$('#closeIn').options].some((o) => o.value === pendingCloseIn)) { $('#closeIn').value = pendingCloseIn; $('#closeIn').dispatchEvent(new Event('change')); }
    pendingCloseIn = null;
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

// ---------------------------------------------------------------- famous close passes
// Facts checked Nov 9, 2026: times and distances from the NASA/JPL close-approach data (distances from Earth's
// centre); positions from NASA/JPL Horizons (data/famous.json); stories from NASA/JPL and news reports of the time.
// The famous passes. Times and distances come from NASA/JPL close-approach data in data/famous.json (cad);
// here: the view (half-width in Moon distances), how many days before closest approach the tour starts, the playing
// speed (days of map time a second), and the account shown on the card.
const PASSES = {
  'toutatis-2004': { des: '4179', title: 'Toutatis', view: 12, pre: 3, speed: 0.25, stories: [
    'A lumpy, elongated rock about 5 km long, Toutatis passed about four times the Moon\'s distance from Earth on September 29, 2004. At the time, NASA called it the closest pass this century by any known asteroid of its size.',
    'In December 2012, China\'s Chang\'e 2 spacecraft flew past it about 3 km away and photographed it. Its next notably close pass to Earth is in 2069.'] },
  '2012tc4-2017': { des: '2012 TC4', title: '2012 TC4', view: 0.5, pre: 0.3, speed: 0.0416667, stories: [
    'A house-sized rock, which radar measured at roughly 10 to 20 m, that passed about an eighth of the way to the Moon on October 12, 2017. The Pan-STARRS telescope in Hawaii had found it in 2012, a week before an earlier close pass.',
    'Observatories around the world used this pass for the first global planetary defence exercise: tracking it as if it might hit, to test how quickly they could find, measure and warn. It turned out to be long and narrow, tumbling about once every 12 minutes.'] },
  '2023bu-2023': { des: '2023 BU', title: '2023 BU', view: 0.12, pre: 0.0625, speed: 0.00694444, stories: [
    'A rock a few metres across, about the size of a box truck, that passed about 3,600 km above the southern tip of South America on January 27, 2023 (UTC): one of the closest passes by a known asteroid ever recorded.',
    'An amateur astronomer, Gennadiy Borisov, found it only six days earlier. Earth\'s pull reshaped its orbit: its year around the Sun went from 359 days to 425. Watch the bend in its path.'] },
  'apophis-2029': { des: '99942', title: 'Apophis', view: 0.4, pre: 0.25, speed: 0.0416667, stories: [
    'On April 13, 2029, Apophis, a rock about 340 m across, will pass closer than the satellites that circle 36,000 km above the equator, bright enough to be seen without a telescope from the Eastern Hemisphere.',
    'When it was found in 2004 it briefly had a 2.7% chance of hitting Earth in 2029. Later observations, and radar in 2021, ruled out any impact for at least a century. NASA\'s OSIRIS-APEX spacecraft will meet it just after the pass.'] },
  'duende-2013': { des: '367943', title: 'Duende (2012 DA14)', view: 0.4, pre: 0.25, speed: 0.0416667, stories: [
    'Found a year earlier by an amateur observatory in Spain, Duende passed inside the ring of weather and TV satellites on February 15, 2013.',
    'Earlier that same day, by coincidence, an unrelated, smaller rock exploded over Chelyabinsk in Russia. Nobody had seen that one coming. Duende\'s pass also bent its orbit: it now spends most of its time closer to the Sun than Earth.'] },
  '2020qg-2020': { des: '2020 QG', title: '2020 QG', view: 0.12, pre: 0.0625, speed: 0.00694444, stories: [
    'A car-sized rock that skimmed about 2,900 km above the southern Indian Ocean on August 16, 2020, one of the closest misses ever recorded.',
    'It came from the direction of the Sun, where telescopes cannot look, and was only found about six hours after it had passed. Had it hit, it would have burned up as a bright fireball. Earth\'s pull bent its path sharply: watch the curve.'] },
  '2019ok-2019': { des: '2019 OK', title: '2019 OK', view: 0.7, pre: 0.0625, speed: 0.00694444, stories: [
    'An asteroid roughly 60 to 130 m across that passed at about a fifth of the Moon\'s distance on July 25, 2019.',
    'It was spotted by an observatory in Brazil only about a day before, a reminder of how many mid-sized asteroids are still undiscovered.'] },
  '2024yr4-2032': { des: '2024 YR4', title: '2024 YR4', view: 1.8, pre: 0.6, speed: 0.0416667, moon: true, stories: [
    'Found on December 27, 2024 by a telescope in Chile, this rock about 60 m across briefly had a 3.1% chance of hitting Earth on December 22, 2032. Further observations ruled that out within weeks.',
    'Its chance of hitting the Moon then rose to about 4%, until observations by the James Webb Space Telescope in early 2026 ruled that out too. Keep playing after the pass by Earth: about six and a half hours later it passes the Moon.'] },
};
let tour = null, famousData = null;
async function startTour(id) {
  const P = PASSES[id];
  try {
    if (!famousData) famousData = await (await fetch('data/famous.json')).json();
  } catch { banner('The famous passes could not be loaded. Try again.', 3000); return; }
  const f = famousData.passes.find((p) => p.id === id);
  const k = data.rows.findIndex((r) => String(r[COL.pdes]) === P.des);
  if (!f || k < 0) { banner('That pass is not available.', 3000); return; }
  stop();
  const tMs = Date.parse((f.cad ? f.cad.cd : f.closest).replace(' ', 'T') + ':00Z');
  tour = { id, P, f, k, tMs, paused: false };
  map.tour = { k, asteroid: f.asteroid, earth: f.earth, moon: f.moon };
  $$('[data-pass]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.pass === id));
  // Bring the whole map into view below the sticky header, so the tour is seen from its start.
  const fr = frameEl.getBoundingClientRect();
  if (!isFull() && (fr.top < 64 || fr.bottom > innerHeight)) {
    frameEl.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
  selected = { kind: 'tour', k, name: P.title };
  map.selected = k; $('#cSel').disabled = false;
  map.center = 'Earth'; map.panX = 0; map.panY = 0;
  setDate(tMs - P.pre * DAY);
  $('#speed').value = String(P.speed);
  map.filter = 'all'; map.only = null; $('#closeIn').value = ''; map.foundMax = 9999; $('#foundBy').value = $('#foundBy').max; $('#foundBy').dispatchEvent(new Event('input'));
  showSelected(true); syncButtons();
  animateTo({ viewR: P.view * LD_AU, tilt: 35 }, 1400);
  banner(`${P.title}: ${new Date(tMs).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}`, 2600);
  setTimeout(() => { if (tour && tour.id === id && !playing) play(); }, reduce ? 200 : 1500);
}
function endTour() {
  tour = null; map.tour = null; map.selected = -1; selected = null;
  $$('[data-pass]').forEach((b) => b.setAttribute('aria-pressed', 'false'));
  stop(); map.center = 'Sun'; map.panX = 0; map.panY = 0; $('#speed').value = '10'; setDate(Date.now(), true);
  $('#selBody').innerHTML = '<p class="note">Tap a dot, a planet or a spacecraft on the map, or use "Find an asteroid".</p>';
  $('#cSel').disabled = true;
  animateTo({ viewR: 1.7, tilt: 55 }, 900); syncButtons();
}
function tourCard(full) {
  const { P, f, k, tMs } = tour, r = data.rows[k], jd = map.jd;
  const AUKM = AU_KM, tj = jdFromMs(tMs);
  const va = hermiteVel(f.asteroid, tj), ve = hermiteVel(f.earth, tj);
  const vRel = Math.hypot(va[0] - ve[0], va[1] - ve[1], va[2] - ve[2]) * AUKM / 86400;
  let moonLine = '';
  const km = f.cad ? f.cad.km : null, moonKm = f.cad && f.cad.moon ? f.cad.moon.km : null;
  if (P.moon && moonKm) {
    let best = [1e12, 0];
    for (let j = tj; j < tj + 1; j += 1 / 1440) { const p = hermiteAt(f.asteroid, j), m = hermiteAt(f.moon, j); if (!p || !m) break; const d = Math.hypot(p[0] - m[0], p[1] - m[1], p[2] - m[2]) * AUKM; if (d < best[0]) best = [d, j]; }
    moonLine = `<div><dt>Past the Moon</dt><dd><b>${fmt(moonKm)} km</b> from its centre, ${f.cad.moon.cd ? f.cad.moon.cd.slice(11) : new Date(msFromJd(best[1])).toISOString().slice(11, 16)} UTC</dd></div>`;
  }
  const now = tourNow();
  const sz = r[COL.diameter] ? { dmin: r[COL.diameter] * 1000, dmax: r[COL.diameter] * 1000, measured: true } : { dmin: diameterM(r[COL.H], 0.25), dmax: diameterM(r[COL.H], 0.05) };
  if (full) {
    const past = tMs < Date.now();
    $('#selBody').innerHTML = `<div class="tourcard">
      <div class="label">Famous close pass</div>
      <h3>${esc(r[COL.name].trim())}</h3>
      <p class="when">${past ? 'Passed' : 'Will pass'} ${new Date(tMs).toLocaleDateString('en-CA', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' })}, ${new Date(tMs).toISOString().slice(11, 16)} UTC</p>
      <dl class="mini facts">
        ${km ? `<div><dt>Closest to Earth</dt><dd><b>${fmt(km)} km</b> from its centre, ${km < 100000 ? `about ${fmt(Math.round((km - 6371) / 100) * 100)} km above the surface` : `${fmt(km / LD_KM, 1)} Moon distances`}</dd></div>` : ''}
        ${moonLine}
        <div><dt>Speed past Earth</dt><dd>${fmt(f.cad ? f.cad.v_rel : vRel, 1)} km/s</dd></div>
        <div><dt>Size, est.</dt><dd>${sizeText(sz)}<span class="cmp">${esc(sizePicture(sz))}</span></dd></div>
        <div><dt>Now on the map</dt><dd id="tourNow">${now}</dd></div>
      </dl>
      ${P.stories.map((t) => `<p class="story">${esc(t)}</p>`).join('')}
      <p class="src">Positions: NASA/JPL Horizons, including Earth's pull. Closest-approach figures: NASA/JPL close-approach data.</p>
      <p class="dlinks"><button class="btn" id="tourReplay">Replay</button><button class="btn ghost" id="tourEnd">End tour</button><a class="linkbtn" href="object.html?id=${neowsId(r)}">Its page ›</a></p>
    </div>`;
    $('#tourReplay').addEventListener('click', () => startTour(tour.id));
    $('#tourEnd').addEventListener('click', endTour);
  } else if ($('#tourNow')) $('#tourNow').textContent = now;
}
function tourNow() {
  const jd = map.jd, a = map.tourAst(jd), e = map.earthAt(jd);
  if (!a) return 'outside the tour\'s dates: the asteroid is placed from its orbit';
  const d = Math.hypot(a[0] - e[0], a[1] - e[1], a[2] - e[2]);
  return d / LD_AU < 2 ? `${fmt(Math.round(d * AU_KM))} km from Earth's centre` : `${fmt(d / LD_AU, 1)} Moon distances from Earth`;
}
let bannerTimer = null;
function banner(text, ms = 2200) {
  const b = $('#tourBanner'); b.textContent = text; b.hidden = false;
  clearTimeout(bannerTimer); bannerTimer = setTimeout(() => (b.hidden = true), ms);
}
// a pass's button starts it; pressing the highlighted button again ends it, like "End tour"
$$('[data-pass]').forEach((b) => b.addEventListener('click', () => (tour && tour.id === b.dataset.pass ? endTour() : startTour(b.dataset.pass))));

start();
