// NASA and ESA Data Projects · Spacecraft, right now · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The page around the map (spacemap.js): views, filters, the list (nearest to Earth first), the card for the chosen
// craft, time, and share links. Data: catalogue.json (mission facts, checked by hand), data/positions.json
// (NASA/JPL Horizons), data/tle.json (CelesTrak), data/links.json (catalogue links that stopped answering).

import { SpaceMap, craftPos, relAt, parentAt, R_EARTH, R_MOON, R_MARS, AU_KM, jdFromMs, msFromJd } from './spacemap.js';
import { satrecOf } from '../shared/sats.js';
import { shareButton, linkWith, takeShared } from '../asteroid-tracker/share.js';

const $ = (s) => document.querySelector(s), $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n, d = 0) => n.toLocaleString('en-CA', { minimumFractionDigits: d, maximumFractionDigits: d });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthText = (s) => { const [y, m, d] = s.split('-'); return d ? `${Number(d)} ${MONTHS[m - 1]} ${y}` : m ? `${MONTHS[m - 1]} ${y}` : y; };
const LIGHT_KM_S = 299792.458;

const VIEWS = {
  solar: { center: 'Sun', viewR: 6, label: 'Solar system' },
  near: { center: 'Earth', viewR: 0.012, label: 'Near Earth' },
  orbit: { center: 'Earth', viewR: 0.0003, label: 'Earth orbit' },
  moon: { center: 'Moon', viewR: 0.000045, label: 'Moon' },
  mars: { center: 'Mars', viewR: 0.00013, label: 'Mars' },
};
const ANGLES = { top: 0, tilt: 55, side: 86 };
const AGENCIES = ['All', 'NASA', 'ESA', 'JAXA', 'ISRO', 'CNSA', 'Other'];
const MAIN_AGENCY = new Set(['NASA', 'ESA', 'JAXA', 'ISRO', 'CNSA']);
const KINDS = [['all', 'All'], ['station', 'Stations'], ['telescope', 'Telescopes'], ['planetary', 'Planet missions'], ['sun', 'Sun'], ['surface', 'Landers and rovers'], ['earth', 'Earth watchers']];
const KIND_WORD = { station: 'Crewed station', telescope: 'Telescope', planetary: 'Planetary mission', sun: 'Watching the Sun', surface: 'Rover', earth: 'Watching Earth' };

const getJson = (u) => fetch(u, { cache: 'no-cache' }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))));
const map = new SpaceMap($('#scMap'), { viewR: 6, tilt: 55, spin: -20 });
let all = [], view = 'solar', agency = 'All', kind = 'all', q = '', live = true, speed = 0, updated = '', broken = new Set();
const earth = (j) => map.earthAt(j);

// ---------------------------------------------------------------- loading
const shared = takeShared(['craft', 'v']);
async function load() {
  $('#scState').hidden = true;
  const [cat, pos, tle, links] = await Promise.allSettled([getJson('catalogue.json'), getJson('data/positions.json'), getJson('data/tle.json'), getJson('data/links.json')]);
  if (cat.status !== 'fulfilled' || (pos.status !== 'fulfilled' && tle.status !== 'fulfilled')) {
    state('The spacecraft positions could not be loaded. Check the connection and <button class="linkbtn" type="button" data-retry>try again</button>.');
    $('#scList').innerHTML = '<div class="state small">Nothing to list yet.</div>';
    $('#scCount').textContent = 'Positions could not be loaded';
    return;
  }
  const P = pos.status === 'fulfilled' ? pos.value : { craft: {} }, T = tle.status === 'fulfilled' ? tle.value : { sats: [] };
  if (links.status === 'fulfilled') broken = new Set(links.value.broken || []);
  const tleBy = Object.fromEntries((T.sats || []).map((s) => [s.key, s]));
  all = [];
  for (const info of cat.value.craft) {
    if (info.src.tle) {
      const t = tleBy[info.key], rec = t && satrecOf(t);
      if (rec) all.push({ key: info.key, info, parent: 'Earth', rec, tle: t });
    } else if (info.src.site) {                // a rover at a fixed place on Mars
      all.push({ key: info.key, info, parent: info.src.center, site: info.src.site, local: true });
    } else {
      const s = P.craft && P.craft[info.key];
      if (s && s.xyz && s.xyz.length >= 6) {
        const samples = [s.jd0, s.step];
        for (const v of s.xyz) samples.push(v / AU_KM);
        all.push({ key: info.key, id: info.key, info, parent: s.parent, samples, local: !!info.src.local, horizons: s.horizons });
      }
    }
  }
  map.craft = all;
  updated = [P.updated, T.updated].filter(Boolean).sort().pop() || '';
  if (tle.status !== 'fulfilled') note('The satellites in Earth orbit could not be loaded just now; the rest of the map works.');
  else if (pos.status !== 'fulfilled') note('The deep-space positions could not be loaded just now; the satellites in Earth orbit work.');
  chips(); applyFilter();
  if (shared && shared.v && VIEWS[shared.v]) setViewName(shared.v, true);
  if (shared && shared.craft && map.byKey(shared.craft)) select(shared.craft, true);
  tick();
}
function state(html) { const s = $('#scState'); s.innerHTML = html; s.hidden = false; const b = s.querySelector('[data-retry]'); if (b) b.addEventListener('click', load); }
function note(text) { state(`<span>${esc(text)}</span>`); setTimeout(() => { $('#scState').hidden = true; }, 8000); }

// ---------------------------------------------------------------- views and angle
function setViewName(v, quick) {
  view = v;
  $$('.views [data-v]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.v === v));
  map.setView({ center: VIEWS[v].center, viewR: VIEWS[v].viewR, panX: 0, panY: 0 });
  if (!quick) map.request();
}
$$('.views [data-v]').forEach((b) => b.addEventListener('click', () => setViewName(b.dataset.v)));
$$('[data-a]').forEach((b) => b.addEventListener('click', () => { map.setView({ tilt: ANGLES[b.dataset.a] }); markAngle(); }));
function markAngle() { $$('[data-a]').forEach((b) => b.setAttribute('aria-pressed', Math.abs(map.tilt - ANGLES[b.dataset.a]) < 1)); }
map.onView = markAngle;
$('#zIn').addEventListener('click', () => { map.setView({ viewR: map.viewR / 1.6 }); });
$('#zOut').addEventListener('click', () => { map.setView({ viewR: map.viewR * 1.6 }); });
$('#zPan').addEventListener('click', () => { map.panMode = !map.panMode; $('#zPan').setAttribute('aria-pressed', map.panMode); });

// ---------------------------------------------------------------- filters and list
function chips() {
  $('#scAgency').innerHTML = AGENCIES.map((a) => `<button type="button" class="chip" data-ag="${a}" aria-pressed="${a === agency}">${a}</button>`).join('');
  $('#scKind').innerHTML = KINDS.map(([k, l]) => `<button type="button" class="chip" data-kind="${k}" aria-pressed="${k === kind}">${l}</button>`).join('');
}
$('#scAgency').addEventListener('click', (e) => { const b = e.target.closest('[data-ag]'); if (!b) return; agency = b.dataset.ag; chips(); applyFilter(); });
$('#scKind').addEventListener('click', (e) => { const b = e.target.closest('[data-kind]'); if (!b) return; kind = b.dataset.kind; chips(); applyFilter(); });
let qt = null;
$('#scQ').addEventListener('input', () => { clearTimeout(qt); qt = setTimeout(() => { q = $('#scQ').value.trim().toLowerCase(); applyFilter(); }, 100); });
function matches(c) {
  const i = c.info;
  if (agency !== 'All' && !(agency === 'Other' ? i.agencies.some((a) => !MAIN_AGENCY.has(a)) : i.agencies.includes(agency))) return false;
  if (kind !== 'all' && i.kind !== kind) return false;
  if (q && !`${i.name} ${i.full || ''} ${i.agencies.join(' ')} ${i.where || ''} ${KIND_WORD[i.kind]}`.toLowerCase().includes(q)) return false;
  return true;
}
let listed = [];
function applyFilter() {
  const shown = all.filter(matches);
  map.shown = shown.length === all.length ? null : new Set(shown.map((c) => c.key));
  map.request();
  const E = earth(map.jd);
  listed = shown.map((c) => { const p = map.pos(c); return { c, d: p ? Math.hypot(p[0] - E[0], p[1] - E[1], p[2] - E[2]) : Infinity }; }).sort((a, b) => a.d - b.d);
  $('#scListN').textContent = `${shown.length}${shown.length === all.length ? '' : ' of ' + all.length} · by distance from Earth`;
  $('#scList').innerHTML = listed.length ? listed.map(({ c, d }) => `<button type="button" class="sc-row" role="listitem" data-key="${c.key}" aria-pressed="${c.key === map.sel}">
      <span class="n">${esc(c.info.name)}</span><span class="d">${esc(distWord(c, d))}</span>
      <span class="a">${esc(c.info.agencies.join(' · '))}${c.info.where ? ' · ' + esc(c.info.where) : ''}</span></button>`).join('')
    : `<div class="state small">No spacecraft match. <button class="linkbtn" type="button" id="scClear">Show all</button></div>`;
  const clr = $('#scClear');
  if (clr) clr.addEventListener('click', () => { agency = 'All'; kind = 'all'; q = ''; $('#scQ').value = ''; chips(); applyFilter(); });
}
function distWord(c, dAu) {
  if (!Number.isFinite(dAu)) return '';
  if (c.parent === 'Earth' && c.rec) { const r = relAt(c, map.jd); return r ? `${fmt(Math.hypot(...r) * AU_KM - R_EARTH)} km up` : ''; }
  if (c.parent === 'Mars' && c.info.kind === 'surface') return 'on Mars';
  if (c.parent === 'Mars') return 'at Mars';
  if (c.parent === 'Moon') return 'at the Moon';
  const km = dAu * AU_KM;
  if (km < 1e7) return `${fmt(km / 1e6, 1)} million km`;
  return `${dAu >= 10 ? fmt(dAu) : fmt(dAu, dAu < 1 ? 2 : 1)} au`;
}
$('#scList').addEventListener('click', (e) => { const b = e.target.closest('[data-key]'); if (b) select(b.dataset.key); });

// ---------------------------------------------------------------- choosing a craft
function viewFor(c) {
  if (c.parent === 'Mars' || c.parent === 'Moon') {      // far orbits (Hope reaches 43,000 km): zoom out to fit
    const v = c.parent === 'Mars' ? 'mars' : 'moon', r = relAt(c, map.jd);
    return { v, viewR: r ? Math.max(VIEWS[v].viewR, Math.hypot(...r) * 1.35) : VIEWS[v].viewR };
  }
  if (c.parent === 'Earth' && c.rec) { const r = relAt(c, map.jd); const R = r ? Math.hypot(...r) : 0.0003; return { v: 'orbit', viewR: Math.max(VIEWS.orbit.viewR, R * 1.35) }; }
  if (c.parent === 'Earth') return { v: 'near' };
  const p = map.pos(c), d = p ? Math.hypot(...p) : 6;
  return { v: 'solar', viewR: Math.min(240, Math.max(1.6, d * 1.25)) };
}
function select(key, fromShare) {
  const c = map.byKey(key);
  if (!c) return;
  map.sel = key; map.showPath = true;
  const f = viewFor(c);
  setViewName(f.v, true);
  if (f.viewR) map.setView({ viewR: f.viewR });
  $$('.sc-row').forEach((b) => b.setAttribute('aria-pressed', b.dataset.key === key));
  card(c);
  if (!fromShare && matchMedia('(max-width: 900px)').matches) $('#scFrame').scrollIntoView({ block: 'start', behavior: 'smooth' });
  map.request();
}
function unselect() { map.sel = null; if (map.center && map.center.craft) map.setView({ center: VIEWS[view].center, panX: 0, panY: 0 }); $('#scCard').hidden = true; $$('.sc-row').forEach((b) => b.setAttribute('aria-pressed', 'false')); map.request(); }
map.onTap = (e) => {
  const b = map.pick(e.clientX, e.clientY, 16);
  if (!b) return;
  if (b.kind === 'craft') select(b.key);
  else if (b.kind === 'cluster') setViewName(b.group === 'Mars' ? 'mars' : map.viewR > 0.05 ? 'near' : 'orbit');
  else if (b.kind === 'planet' && (b.name === 'Mars' || b.name === 'Earth')) setViewName(b.name === 'Mars' ? 'mars' : 'near');
  else if (b.kind === 'moon') setViewName('moon');
};

// ---------------------------------------------------------------- the card
function figures(c) {
  const jd = map.jd, p = map.pos(c, jd), E = earth(jd), out = [];
  if (!p) return [['Position', 'outside the data for this date']];
  const dE = Math.hypot(p[0] - E[0], p[1] - E[1], p[2] - E[2]) * AU_KM, dS = Math.hypot(...p);
  const step = c.rec || c.local ? 1 / 1440 : 0.05, p1 = map.pos(c, jd - step), p2 = map.pos(c, jd + step);
  const vSun = p1 && p2 ? Math.hypot(p2[0] - p1[0], p2[1] - p1[1], p2[2] - p1[2]) * AU_KM / (2 * step * 86400) : null;
  if (c.rec) {
    const r = relAt(c, jd), r1 = relAt(c, jd - 1 / 1440), r2 = relAt(c, jd + 1 / 1440);
    const h = Math.hypot(...r) * AU_KM - R_EARTH, v = Math.hypot(r2[0] - r1[0], r2[1] - r1[1], r2[2] - r1[2]) * AU_KM / 120;
    const period = 2 * Math.PI / c.rec.no;
    out.push(['Height', `${fmt(h)} km`, 'above the surface'], ['Speed', `${fmt(v, 2)} km/s`, `${fmt(v * 3600)} km/h`],
      ['Once round', period < 180 ? `${fmt(period)} min` : period < 2880 ? `${fmt(period / 60, 1)} hours` : `${fmt(period / 1440, 1)} days`, 'one orbit']);
  } else if (c.local) {
    const r = relAt(c, jd), R = c.parent === 'Mars' ? R_MARS : R_MOON;
    if (c.info.kind === 'surface') out.push(['Where', c.info.where, 'on the surface']);
    else if (r) {
      const r1 = relAt(c, jd - 1 / 1440), r2 = relAt(c, jd + 1 / 1440);
      out.push(['Height', `${fmt(Math.hypot(...r) * AU_KM - R)} km`, `above ${c.parent === 'Mars' ? 'Mars' : 'the Moon'}`]);
      if (r1 && r2) out.push(['Speed', `${fmt(Math.hypot(r2[0] - r1[0], r2[1] - r1[1], r2[2] - r1[2]) * AU_KM / 120, 2)} km/s`, `around ${c.parent === 'Mars' ? 'Mars' : 'the Moon'}`]);
    }
    out.push(['From Earth', dE > 1e7 ? `${fmt(dE / AU_KM, 2)} au` : `${fmt(dE)} km`, `light takes ${lightText(dE)}`]);
  } else {
    out.push(['From Earth', dE < 1e7 ? `${fmt(dE / 1e6, 2)} million km` : `${fmt(dE / AU_KM, dE / AU_KM < 10 ? 2 : 1)} au`, `light takes ${lightText(dE)}`]);
    out.push(['From the Sun', `${fmt(dS, dS < 10 ? 2 : 1)} au`, `${fmt(dS * AU_KM / 1e6)} million km`]);
    if (vSun) out.push(['Speed', `${fmt(vSun, 1)} km/s`, 'relative to the Sun']);
  }
  return out;
}
function lightText(km) { const s = km / LIGHT_KM_S; return s < 60 ? `${fmt(s, 1)} s` : s < 3600 ? `${fmt(s / 60, 1)} min` : `${fmt(s / 3600, 1)} hours`; }
function card(c) {
  const i = c.info, el = $('#scCard');
  const links = (i.links || []).filter((l) => !broken.has(l.url));
  links.push(c.rec ? { label: 'CelesTrak: its orbital elements', url: 'https://celestrak.org/' } : { label: 'NASA/JPL Horizons: its position data', url: 'https://ssd.jpl.nasa.gov/horizons/' });
  const today = new Date(msFromJd(map.jd)).toISOString().slice(0, 7);
  el.innerHTML = `
    <div class="cc-top"><div><div class="lbl">${esc(i.agencies.join(' · '))} · ${esc(KIND_WORD[i.kind])}${(i.tags || []).includes('military') ? ' · military' : ''}</div>
      <h3>${esc(i.name)}</h3>${i.full ? `<div class="cc-full">${esc(i.full)}</div>` : ''}</div>
      <button class="cc-x" type="button" aria-label="Close">×</button></div>
    <dl class="cc-fig" id="ccFig"></dl>
    <dl class="cc-fig cc-launch"><div><dt>Launched</dt><dd>${esc(monthText(i.launch))}<span>${esc(i.vehicle)}</span></dd></div></dl>
    <p class="cc-about">${esc(i.about)}</p>
    ${i.timeline && i.timeline.length ? `<div class="lbl">Timeline</div><ol class="cc-tl">${i.timeline.map(([d, t]) => `<li class="${d.slice(0, 7) > today ? 'next' : ''}"><span>${esc(monthText(d))}</span>${esc(t)}</li>`).join('')}</ol>` : ''}
    <div class="lbl">Read more</div>
    <ul class="cc-links">${links.map((l) => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.label)} <span class="ext">↗</span></a></li>`).join('')}</ul>
    <div class="cc-act">
      <button class="btn" type="button" id="ccFollow" aria-pressed="${!!(map.center && map.center.craft === c.key)}">Follow it</button>
      <button class="btn ghost" type="button" id="ccPath" aria-pressed="${map.showPath}">Show its path</button>
      <button class="btn ghost" type="button" id="ccShare">Share</button>
      ${c.key === 'iss' || c.key === 'tiangong' ? `<a class="btn ghost" href="../sky-finder/?find=${c.key}">See it from here</a>` : ''}
    </div>
    <p class="sharemsg" id="ccShareMsg" hidden></p>
    <p class="note">Position: ${c.rec ? `CelesTrak orbital elements of ${esc(c.tle.epoch)} UTC, worked out in your browser (SGP4)` : 'NASA/JPL Horizons'}. Mission facts: ${esc(i.agencies.slice(0, 2).join(' and '))}.</p>`;
  el.hidden = false;
  figs(c);
  el.querySelector('.cc-x').addEventListener('click', unselect);
  $('#ccFollow').addEventListener('click', () => {
    const on = !(map.center && map.center.craft === c.key);
    map.setView(on ? { center: { craft: c.key }, panX: 0, panY: 0 } : { center: VIEWS[view].center, panX: 0, panY: 0 });
    $('#ccFollow').setAttribute('aria-pressed', on);
  });
  $('#ccPath').addEventListener('click', () => { map.showPath = !map.showPath; $('#ccPath').setAttribute('aria-pressed', map.showPath); map.request(); });
  shareButton($('#ccShare'), $('#ccShareMsg'), () => linkWith({ craft: c.key, v: view }), `${i.name}, on the spacecraft map`);
}
function figs(c) {
  const el = $('#ccFig'); if (!el) return;
  el.innerHTML = figures(c).map(([k, v, s]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}${s ? `<span>${esc(s)}</span>` : ''}</dd></div>`).join('');
}

// ---------------------------------------------------------------- time
$('#tNow').addEventListener('click', () => { live = true; speed = 0; marks(); });
$$('[data-speed]').forEach((b) => b.addEventListener('click', () => { const v = Number(b.dataset.speed); if (speed === v) { speed = 0; } else { speed = v; live = false; } marks(); }));
function marks() {
  $('#tNow').setAttribute('aria-pressed', live);
  $$('[data-speed]').forEach((b) => b.setAttribute('aria-pressed', Number(b.dataset.speed) === speed));
  $('#scLive').hidden = !live;
}
let last = performance.now(), lastSlow = 0;
const MIN_JD = jdFromMs(Date.now()) - 60, MAX_JD = jdFromMs(Date.now()) + 365;
function tick() {
  const t = performance.now(), dt = Math.min(0.25, (t - last) / 1000); last = t;
  let changed = false;
  if (live) {
    const jd = jdFromMs(Date.now());
    // close to Earth, satellites move visibly: redraw every frame; further out, twice a second is plenty
    if (map.viewR < 0.002 || map.center && map.center.craft || t - lastSlow > 500) { map.jd = jd; changed = true; lastSlow = t; }
  } else if (speed) {
    map.jd = Math.min(MAX_JD, Math.max(MIN_JD, map.jd + speed * dt / 86400)); changed = true;
    if (map.jd >= MAX_JD) { speed = 0; marks(); }
  }
  if (changed) {
    map.request();
    if (t - (tick.ui || 0) > 500) {
      tick.ui = t;
      const d = new Date(msFromJd(map.jd));
      $('#scDate').textContent = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}, ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} UTC`;
      $('#scCount').textContent = `${all.length} active spacecraft and stations${updated ? ` · positions updated ${updated}` : ''}`;
      const c = map.sel && map.byKey(map.sel); if (c) figs(c);
    }
  }
  requestAnimationFrame(tick);
}
marks();
addEventListener('keydown', (e) => { if (e.key === 'Escape' && map.sel) unselect(); });
load();
export { map, craftPos, parentAt };
