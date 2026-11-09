// NASA and ESA Data Projects · Asteroid Tracker · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Two views:
//   This week  live from NASA NeoWs (/neo/rest/v1/feed, at most 7 days per request; 1 request per week shown),
//              through shared/nasa.js, which keeps the visitor's key in their browser and caches answers per visit.
//   By year    from data/years.json and data/YYYY.json (2000 to next year), written by fetch_close_approaches.py on
//              GitHub Actions once a day (the JPL close-approach API blocks direct calls from web pages).
// Charts are in charts.js; units and the size-from-brightness rule in format.js.

import { nasaGet, getKey, setKey, usingDemoKey, isoDate } from '../shared/nasa.js';
import { fmt, sizeText, dateText, sizePicture, diameterM, LD_KM, DAY_MS } from './format.js';
import { scatter, perDay, biggest, yearChart, perYear, hideTip } from './charts.js';
import { mountSearch } from './searchview.js';
import { loadNeos } from './mapdata.js';
import { COL, COMET_CODES } from './skymap.js';
import { neowsId } from './search.js';
import { placeKeeper, scrollBack } from './back.js';
import { mountRisk, chanceText } from './risk.js';
import { esaApproach, riskOf } from './esa.js';

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const ROWS = 15;

const todayStart = () => { const n = new Date(); return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate()); };
const sundayOf = (t) => t - new Date(t).getUTCDay() * DAY_MS;   // weeks run Sunday to Saturday (UTC)

const state = {
  view: 'week',
  weekStart: sundayOf(todayStart()),
  week: null,            // the week's objects, or null while loading
  weekError: null,
  filter: { haz: false, size: 0, dist: Infinity, day: '' },
  sortKey: 't', sortDir: 1, selected: null, showAll: false,
  year: null, yearError: null, maxLd: 1, index: null, yearShown: null,
};

// ---------------------------------------------------------------- tiles and notices
function tiles(target, list) {
  $(target).innerHTML = list.map((t) =>
    `<div class="tile${t.cls ? ' ' + t.cls : ''}"><div class="label">${t.label}</div><div class="value">${t.value}</div>` +
    `<div class="${t.sub ? 'sub' : 'note'}">${t.note}</div></div>`).join('');
}
function loadingTiles(target, labels) {
  tiles(target, labels.map((label) => ({ label, value: '…', note: 'loading' })));
  $(target).classList.add('loading');
}
function notice(target, msg, actions = '') {
  $(target).innerHTML = msg ? `<div class="notice warn" role="alert"><span>${esc(msg)}</span><span class="seg">${actions}</span></div>` : '';
}

// ---------------------------------------------------------------- key settings
function showKeyState() {
  const demo = usingDemoKey();
  $('#keyPill').className = 'pill ' + (demo ? 'warn' : 'good');
  $('#keyPill').textContent = demo ? 'Demo key' : 'Your key';
  $('#keyNote').innerHTML = demo
    ? 'This page is using NASA\'s shared demo key: 30 requests an hour and 50 a day for your connection. A free key from <a href="https://api.nasa.gov/" target="_blank" rel="noopener">api.nasa.gov</a> allows 1,000 an hour. Each week shown costs 1 request, and so does each asteroid\'s page; the "By year" view costs none.'
    : 'Your own key is saved in this browser only (never sent anywhere but NASA): 1,000 requests an hour. Each week shown costs 1 request, and so does each asteroid\'s page. Remove it to go back to the demo key.';
  $('#keyRemove').disabled = demo;
}
function toggleKeyCard(open = $('#keyCard').hidden) {
  $('#keyCard').hidden = !open;
  $('#openKey').setAttribute('aria-expanded', open);
  if (open) $('#keyInput').focus();
}
$('#openKey').addEventListener('click', () => toggleKeyCard());
$('#keyForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const k = $('#keyInput').value.trim();
  if (!k) return;
  setKey(k); $('#keyInput').value = '';
  showKeyState(); toggleKeyCard(false); loadWeek();
});
$('#keyRemove').addEventListener('click', () => { setKey(''); showKeyState(); loadWeek(); });

// ---------------------------------------------------------------- this week
function toObject(o) {
  const ca = (o.close_approach_data || []).find((c) => c.orbiting_body === 'Earth') || o.close_approach_data[0];
  const m = o.estimated_diameter.meters;
  return {
    id: o.id, name: o.name, H: o.absolute_magnitude_h,
    dmin: m.estimated_diameter_min, dmax: m.estimated_diameter_max,
    ld: Number(ca.miss_distance.lunar), km: Number(ca.miss_distance.kilometers),
    v: Number(ca.relative_velocity.kilometers_per_second),
    t: ca.epoch_date_close_approach,
    haz: !!o.is_potentially_hazardous_asteroid, url: o.nasa_jpl_url,
  };
}

let keepRow = null;   // the open row and "show all", put back once when the page is returned to
async function loadWeek() {
  const start = state.weekStart, end = start + 6 * DAY_MS;
  state.week = null; state.weekError = null; state.selected = null; state.showAll = false;
  const sameMonth = new Date(start).getUTCMonth() === new Date(end).getUTCMonth();
  $('#weekLabel').textContent = (sameMonth ? `${dateText(start)}–${new Date(end).getUTCDate()}` : `${dateText(start)} – ${dateText(end)}`) + `, ${new Date(end).getUTCFullYear()}`;
  $('#thisWeek').setAttribute('aria-pressed', start === sundayOf(todayStart()));
  notice('#weekNotice', '');
  loadingTiles('#weekTiles', ['Passing Earth', 'Closest', 'Biggest', 'Fastest', 'Potentially hazardous']);
  ['#cScatter', '#cDays', '#cBig'].forEach((s) => loadingChart(s));
  $('#weekTable tbody').innerHTML = `<tr class="msg"><td colspan="6"><div class="state small">Loading this week's close approaches from NASA…</div></td></tr>`;
  $('#filterCount').textContent = '';
  $('#moreRow').hidden = true;
  fillDays();
  try {
    const feed = await nasaGet('/neo/rest/v1/feed', { start_date: isoDate(new Date(start)), end_date: isoDate(new Date(end)) });
    if (start !== state.weekStart) return;   // the user moved on to another week meanwhile
    state.week = Object.values(feed.near_earth_objects || {}).flat().map(toObject);
    if (keepRow && keepRow.weekStart === start) { state.selected = keepRow.selected; state.showAll = keepRow.showAll; }
    keepRow = null;
  } catch (e) {
    if (start !== state.weekStart) return;
    state.weekError = e;
  }
  showKeyState();
  renderWeek();
}

function loadingChart(sel, msg = 'Loading…') {
  const svg = $(sel), W = Math.max(280, svg.parentElement.clientWidth || 600);
  svg.setAttribute('viewBox', `0 0 ${W} 160`);
  svg.innerHTML = `<text x="${W / 2}" y="84" text-anchor="middle" font-style="italic">${esc(msg)}</text>`;
}

function fillDays() {
  const sel = $('#fDay'), keep = state.filter.day;
  sel.innerHTML = '<option value="">All 7 days</option>' +
    [...Array(7)].map((_, i) => { const t = state.weekStart + i * DAY_MS; return `<option value="${t}">${new Date(t).toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' })} ${dateText(t)}</option>`; }).join('');
  sel.value = [...sel.options].some((o) => o.value === keep) ? keep : '';
  state.filter.day = sel.value;
}

function filtered() {
  const f = state.filter;
  return state.week.filter((o) =>
    (!f.haz || o.haz) &&
    Math.sqrt(o.dmin * o.dmax) >= f.size &&
    o.ld <= f.dist &&
    (!f.day || (o.t >= Number(f.day) && o.t < Number(f.day) + DAY_MS)));
}

function renderWeek() {
  $('#weekTiles').classList.remove('loading');
  if (state.weekError) {
    const e = state.weekError;
    const keyBtn = e.status === 429 || e.status === 403 ? '<button class="btn ghost" data-act="key">Key settings</button>' : '';
    notice('#weekNotice', e.message, keyBtn + '<button class="btn ghost" data-act="retry">Try again</button>');
    tiles('#weekTiles', ['Passing Earth', 'Closest', 'Biggest', 'Fastest', 'Potentially hazardous'].map((label) => ({ label, value: '—', note: 'not loaded' })));
    ['#cScatter', '#cDays', '#cBig'].forEach((s) => loadingChart(s, 'No data: NASA could not be reached.'));
    $('#weekTable tbody').innerHTML = `<tr class="msg"><td colspan="6"><div class="state small">No data to show.</div></td></tr>`;
    return;
  }
  const week = state.week;
  if (!week.length) {
    tiles('#weekTiles', [{ label: 'Passing Earth', value: 0, note: 'no close approaches listed for this week' }]);
  } else {
    const by = (k, d) => [...week].sort((a, b) => (a[k] - b[k]) * d)[0];
    const closest = by('ld', 1), big = by('dmax', -1), fast = by('v', -1), haz = week.filter((o) => o.haz).length;
    tiles('#weekTiles', [
      { label: 'Passing Earth', value: week.length, note: `close approach${week.length === 1 ? '' : 'es'} this week` },
      { label: 'Closest', value: fmt(closest.ld, closest.ld < 10 ? 2 : 1) + ' <small>LD</small>', note: esc(closest.name) + ' · ' + fmt(closest.km) + ' km', sub: 1 },
      { label: 'Biggest', value: sizeText(big), note: esc(big.name) + ' · estimated', sub: 1 },
      { label: 'Fastest', value: fmt(fast.v, 1) + ' <small>km/s</small>', note: esc(fast.name), sub: 1 },
      { label: 'Potentially hazardous', value: haz, note: haz ? 'flagged by NASA · none on a collision course' : 'none flagged this week', cls: haz ? 'hazard' : '' },
    ]);
  }
  renderFiltered();
}

function renderFiltered() {
  if (!state.week) return;
  const list = filtered();
  $('#filterCount').textContent = `showing ${list.length} of ${state.week.length}`;
  const none = state.week.length ? undefined : 'NASA lists no close approaches for this week.';
  scatter($('#cScatter'), list, none);
  perDay($('#cDays'), list, state.weekStart);
  biggest($('#cBig'), list, none);
  weekTable(list);
}

function weekTable(list) {
  const k = state.sortKey, d = state.sortDir;
  const rows = [...list].sort((a, b) => (k === 'name' ? a.name.localeCompare(b.name) : a[k] - b[k]) * d);
  const shown = state.showAll ? rows : rows.slice(0, ROWS);
  if (!rows.length) {
    $('#weekTable tbody').innerHTML = `<tr class="msg"><td colspan="6"><div class="state small"><span>${state.week.length
      ? 'No objects match these filters. <button class="linkbtn" data-act="clear">Clear filters</button>'
      : 'NASA lists no close approaches for this week.'}</span></div></td></tr>`;
  } else {
    $('#weekTable tbody').innerHTML = shown.map((o) => {
      const sel = o.id === state.selected;
      return `<tr data-id="${esc(o.id)}" aria-selected="${sel}" aria-expanded="${sel}" tabindex="0">
        <td data-label="Name">${esc(o.name)}</td>
        <td data-label="Closest (UTC)">${dateText(o.t, true)}</td>
        <td data-label="Size, est." class="num"><span>${sizeText(o)}</span></td>
        <td data-label="Miss distance" class="num"><span>${fmt(o.ld, 1)} LD<span class="s">${fmt(o.km)} km</span></span></td>
        <td data-label="Speed" class="num"><span>${fmt(o.v, 1)} km/s</span></td>
        <td data-label="Flag"${o.haz ? '' : ' class="empty"'}>${o.haz ? '<span class="tag haz">Potentially hazardous</span>' : ''}</td></tr>` +
        (sel ? `<tr class="drow"><td colspan="6">${detailHtml(o)}</td></tr>` : '');
    }).join('');
  }
  fillEsa();
  $('#moreRow').hidden = rows.length <= ROWS;
  $('#moreBtn').textContent = state.showAll ? 'Show fewer' : `Show all ${rows.length}`;
  $$('#weekTable th[data-k]').forEach((th) =>
    th.setAttribute('aria-sort', th.dataset.k === k ? (d > 0 ? 'ascending' : 'descending') : 'none'));
  const sel = $('#sortSel'), v = `${k}:${d}`;
  sel.value = [...sel.options].some((o) => o.value === v) ? v : sel.value;
}

function detailHtml(o) {
  const t = [
    { label: 'Size', value: sizeText(o), note: sizePicture(o) },
    { label: 'Miss distance', value: fmt(o.ld, o.ld < 10 ? 2 : 1) + ' <small>LD</small>', note: `${fmt(o.km)} km · ${o.ld >= 1 ? fmt(o.ld, 1) + '× farther than the Moon' : 'closer than the Moon'}` },
    { label: 'Speed', value: fmt(o.v, 1) + ' <small>km/s</small>', note: `${fmt(o.v * 3600)} km/h · across Earth in ${fmt(12742 / o.v / 60, 0)} min` },
    { label: 'Closest', value: dateText(o.t), note: new Date(o.t).toISOString().slice(11, 16) + ' UTC' },
  ];
  return `<div class="dwrap"><div class="tiles">${t.map((x) => `<div class="tile"><div class="label">${x.label}</div><div class="value">${x.value}</div><div class="note">${x.note}</div></div>`).join('')}</div>
    <div class="tiles esa-tiles" data-esa-name="${esc(o.name)}" data-esa-t="${o.t}" data-esa-ld="${o.ld}" hidden></div>
    <p class="note">Sizes are estimates from how bright the object looks: a dark object is larger than a shiny one of the same brightness, so NASA gives a range.</p>
    <p class="dlinks"><a class="btn" href="object.html?id=${encodeURIComponent(o.id)}&amp;t=${o.t}">Open its page ›</a><span class="note">its orbit around the Sun and every pass by Earth</span></p></div>`;
}

// ESA's figures for the open row, added when ESA's file has loaded: its distance for the same pass, and the
// object's place on either impact-risk list. Nothing is shown for an object ESA does not list.
function fillEsa() {
  const box = document.querySelector('.esa-tiles');
  if (!box) return;
  const name = box.dataset.esaName, t = Number(box.dataset.esaT), ld = Number(box.dataset.esaLd);
  Promise.all([esaApproach(name, t), riskOf(name)]).then(([a, r]) => {
    if (!box.isConnected) return;
    const tiles = [];
    if (a) tiles.push({ label: 'ESA: miss distance', value: fmt(a.ld, a.ld < 10 ? 2 : 1) + ' <small>LD</small>',
      note: `${fmt(a.km)} km on ${esc(a.date)}, from ESA's NEO Coordination Centre (NASA: ${fmt(ld, ld < 10 ? 2 : 1)} LD)` });
    if (r && (r.esa || r.nasa)) tiles.push({ label: 'Impact chance', value: chanceText((r.esa || r.nasa).ip),
      note: `${r.esa ? 'ESA ' + chanceText(r.esa.ip).replace(/ <span.*$/, '') : 'not on ESA\'s list'} · ${r.nasa ? 'NASA ' + chanceText(r.nasa.ip).replace(/ <span.*$/, '') : 'not on NASA\'s list'} · <a href="#risk">the risk list ›</a>` });
    if (!tiles.length) return;
    box.innerHTML = tiles.map((x) => `<div class="tile"><div class="label">${x.label}</div><div class="value">${x.value}</div><div class="note">${x.note}</div></div>`).join('');
    box.hidden = false;
  });
}

// week controls
$('#prevWeek').addEventListener('click', () => { state.weekStart -= 7 * DAY_MS; loadWeek(); });
$('#nextWeek').addEventListener('click', () => { state.weekStart += 7 * DAY_MS; loadWeek(); });
$('#thisWeek').addEventListener('click', () => { state.weekStart = sundayOf(todayStart()); loadWeek(); });
$$('[data-haz]').forEach((b) => b.addEventListener('click', () => {
  state.filter.haz = b.dataset.haz === 'haz';
  $$('[data-haz]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderFiltered();
}));
$('#fSize').addEventListener('change', (e) => { state.filter.size = Number(e.target.value); renderFiltered(); });
$('#fDist').addEventListener('change', (e) => { state.filter.dist = Number(e.target.value); renderFiltered(); });
$('#fDay').addEventListener('change', (e) => { state.filter.day = e.target.value; renderFiltered(); });
function clearFilters() {
  state.filter = { haz: false, size: 0, dist: Infinity, day: '' };
  $('#fSize').value = '0'; $('#fDist').value = 'Infinity'; $('#fDay').value = '';
  $$('[data-haz]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.haz === 'all'));
  renderFiltered();
}

// sorting: click or Enter on a heading; size and speed start with the largest, the others with the smallest or earliest
const sortBy = (k) => {
  if (state.sortKey === k) state.sortDir = -state.sortDir;
  else { state.sortKey = k; state.sortDir = k === 'dmax' || k === 'v' ? -1 : 1; }
  weekTable(filtered());
};
$$('#weekTable th[data-k]').forEach((th) => {
  th.addEventListener('click', () => sortBy(th.dataset.k));
  th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortBy(th.dataset.k); } });
});
// rows open their details
const toggleRow = (tr) => {
  if (!tr || !tr.dataset.id) return;
  state.selected = state.selected === tr.dataset.id ? null : tr.dataset.id;
  weekTable(filtered());
  const again = $(`#weekTable tr[data-id="${CSS.escape(tr.dataset.id)}"]`); if (again) again.focus();
};
$('#weekTable tbody').addEventListener('click', (e) => { if (!e.target.closest('a,button')) toggleRow(e.target.closest('tr')); });
$('#weekTable tbody').addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('tr[data-id]')) { e.preventDefault(); toggleRow(e.target); } });
$('#sortSel').addEventListener('change', (e) => {
  const [k, d] = e.target.value.split(':'); state.sortKey = k; state.sortDir = Number(d); weekTable(filtered());
});
$('#moreBtn').addEventListener('click', () => { state.showAll = !state.showAll; weekTable(filtered()); });

// buttons inside notices and empty states
document.addEventListener('click', (e) => {
  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'retry') state.view === 'year' ? loadYear(state.yearShown) : loadWeek();
  if (act === 'key') toggleKeyCard(true);
  if (act === 'clear') clearFilters();
});

// ---------------------------------------------------------------- by year
// data/years.json lists the years with their counts; data/YYYY.json holds one year's approaches within 10 LD.
const yearCache = new Map();
const thisYearNow = () => new Date().getUTCFullYear();

async function loadIndex() {
  if (state.index) return state.index;
  const res = await fetch('data/years.json', { cache: 'no-cache' });
  if (!res.ok) throw new Error('status ' + res.status);
  state.index = await res.json();
  const sel = $('#yearSel');
  sel.innerHTML = state.index.years.map((y) => `<option value="${y.year}">${y.year}</option>`).join('');
  return state.index;
}

function toYearObject([name, t, ld, H, dkm, des]) {
  const o = { name, t, ld, H, des };
  if (dkm) { o.dmin = o.dmax = dkm * 1000; o.measured = true; }
  else if (H !== null && H !== undefined) { o.dmin = diameterM(H, 0.25); o.dmax = diameterM(H, 0.05); }
  else { o.dmin = o.dmax = NaN; }
  return o;
}

async function loadYear(year = state.yearShown || thisYearNow()) {
  state.yearError = null;
  state.yearShown = year;
  notice('#yearNotice', '');
  loadingTiles('#yearTiles', ['Close approaches', 'Closest', '…', '…']);
  loadingChart('#cYear');
  try {
    const index = await loadIndex();
    const years = index.years.map((y) => y.year);
    if (!years.includes(year)) year = state.yearShown = years.includes(thisYearNow()) ? thisYearNow() : years[years.length - 1];
    $('#yearSel').value = year;
    if (!yearCache.has(year)) {
      const res = await fetch(`data/${year}.json`, { cache: 'no-cache' });
      if (!res.ok) throw new Error('status ' + res.status);
      const data = await res.json();
      yearCache.set(year, { year: data.year, updated: data.updated, rows: data.rows.map(toYearObject) });
    }
    if (year !== state.yearShown) return;   // the user picked another year meanwhile
    state.year = yearCache.get(year);
  } catch {
    state.yearError = true;
  }
  renderYear();
}

function renderYear() {
  $('#yearTiles').classList.remove('loading');
  if (state.yearError || !state.year) {
    notice('#yearNotice', 'The close-approach data could not be loaded. Try again in a moment.', '<button class="btn ghost" data-act="retry">Try again</button>');
    tiles('#yearTiles', [{ label: 'Close approaches', value: '—', note: 'not loaded' }]);
    loadingChart('#cYear', 'No data.');
    $('#yearTable tbody').innerHTML = $('#nextTable tbody').innerHTML = '';
    return;
  }
  const { year, updated, rows } = state.year, now = Date.now(), max = state.maxLd, current = thisYearNow();
  const kind = year < current ? 'past' : year > current ? 'future' : 'current';
  const list = rows.filter((o) => o.ld <= max);
  const closest = [...list].sort((a, b) => a.ld - b.ld);
  const upcoming = list.filter((o) => o.t >= now).sort((a, b) => a.t - b.t);
  const biggest = list.filter((o) => o.dmax > 0).sort((a, b) => b.dmax - a.dmax);
  const within = max === 1 ? 'closer than the Moon' : `within ${max} times the Moon's distance`;

  const tClosest = closest[0]
    ? { label: kind === 'future' ? 'Closest expected' : 'Closest of the year', value: fmt(closest[0].ld * LD_KM) + ' <small>km</small>', note: esc(closest[0].name) + ' · ' + dateText(closest[0].t), sub: 1 }
    : { label: 'Closest of the year', value: '—', note: 'none known' };
  const tBiggest = biggest[0]
    ? { label: 'Biggest', value: sizeText(biggest[0]), note: esc(biggest[0].name) + ' · ' + dateText(biggest[0].t), sub: 1 }
    : { label: 'Biggest', value: '—', note: 'none known' };
  const tNext = upcoming[0]
    ? { label: 'Next one', value: dateText(upcoming[0].t), note: esc(upcoming[0].name) + ' · ' + fmt(upcoming[0].ld, 2) + ' LD', sub: 1 }
    : { label: 'Next one', value: '—', note: 'none known yet' };
  const first = [
    { label: `Within ${max} LD in ${year}`, value: fmt(list.length), note: kind === 'future' ? within + ' · known so far' : within },
    tClosest,
  ];
  if (kind === 'current') tiles('#yearTiles', [...first, { label: 'Still to come', value: fmt(upcoming.length), note: 'known so far, between today and Dec 31' }, tNext]);
  else if (kind === 'future') tiles('#yearTiles', [...first, tBiggest, tNext]);
  else {
    const months = Array(12).fill(0); list.forEach((o) => months[new Date(o.t).getUTCMonth()]++);
    const bm = months.indexOf(Math.max(...months));
    tiles('#yearTiles', [...first, tBiggest, list.length
      ? { label: 'Busiest month', value: new Date(Date.UTC(year, bm, 1)).toLocaleDateString('en-CA', { month: 'long', timeZone: 'UTC' }), note: `${months[bm]} close approach${months[bm] === 1 ? '' : 'es'}` }
      : { label: 'Busiest month', value: '—', note: 'none known' }]);
  }

  $('#yearChartTitle').textContent = kind === 'current' ? 'Every close approach this year' : `Every close approach in ${year}`;
  yearChart($('#cYear'), list, { year, now, maxLd: max });
  $('#yearUpdated').textContent = updated ? `Last updated ${updated.slice(0, 10)}, ${updated.slice(11, 16)} UTC.` : '';
  $('#leftTitle').textContent = kind === 'future' ? 'Closest expected' : 'Closest of the year';
  smallTable('#yearTable', closest.slice(0, 6), 'None known.');
  if (kind === 'past') {
    $('#rightTitle').textContent = 'Biggest of the year';
    smallTable('#nextTable', biggest.slice(0, 6), 'None known.');
  } else {
    $('#rightTitle').textContent = 'Coming up';
    smallTable('#nextTable', upcoming.slice(0, 6), 'None known yet. New objects are found every week.');
  }
  $('#thisYear').setAttribute('aria-pressed', year === current);
  const yrs = state.index.years.map((y) => y.year);
  $('#prevYear').disabled = year <= yrs[0];
  $('#nextYear').disabled = year >= yrs[yrs.length - 1];
  $('#perYearAside').textContent = `within ${max} LD`;
  perYear($('#cYears'), state.index.years, { maxLd: max, selected: year, current, onPick: (y) => goYear(y) });
}

// A link for an object in the year tables: the asteroid's own page. Its NeoWs id comes from the list of all
// near-Earth objects (data/neos.json, loaded in the background when the year view opens); until that arrives, or
// for an object not in it, numbered asteroids still get theirs (NeoWs id = 2,000,000 + number). Comets, and objects
// with no id, link to JPL's page for the designation.
let idByDes = null;
function loadIds() {
  if (idByDes) return;
  idByDes = new Map();
  loadNeos().then((d) => {
    for (const r of d.rows) idByDes.set(String(r[COL.pdes]), COMET_CODES.has(r[COL.cls]) ? null : neowsId(r));
    if (state.view === 'year' && state.year) renderYear();
  }).catch(() => {});
}
function objectLink(o) {
  const id = o.des !== undefined && o.des !== null ? idByDes && idByDes.get(String(o.des)) : undefined;
  if (id) return `object.html?id=${id}&t=${o.t}`;
  const num = /^\s*(\d+)\s/.exec(o.name);
  if (num && id !== null) return `object.html?id=${2000000 + Number(num[1])}&t=${o.t}`;
  return `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(o.des || o.name.replace(/[()]/g, ''))}`;
}

function smallTable(sel, list, empty) {
  $(sel + ' tbody').innerHTML = list.length
    ? list.map((o) => {
      const href = objectLink(o), ext = href.startsWith('http');
      return `<tr class="static"><td data-label="Name"><a href="${esc(href)}"${ext ? ' target="_blank" rel="noopener"' : ''}>${esc(o.name)}</a></td><td data-label="Date">${dateText(o.t)}</td><td data-label="Size, est." class="num"><span>${sizeText(o)}</span></td><td data-label="Distance" class="num"><span>${fmt(o.ld, 2)} LD<span class="s">${fmt(o.ld * LD_KM)} km</span></span></td></tr>`;
    }).join('')
    : `<tr class="msg"><td colspan="4"><div class="state small">${empty}</div></td></tr>`;
}

function goYear(y) {
  history.replaceState(null, '', y === thisYearNow() ? '#year' : `#year-${y}`);
  loadYear(y);
}
$$('[data-ld]').forEach((b) => b.addEventListener('click', () => {
  state.maxLd = Number(b.dataset.ld);
  $$('[data-ld]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderYear();
}));
$('#yearSel').addEventListener('change', (e) => goYear(Number(e.target.value)));
$('#prevYear').addEventListener('click', () => goYear(state.yearShown - 1));
$('#nextYear').addEventListener('click', () => goYear(state.yearShown + 1));
$('#thisYear').addEventListener('click', () => goYear(thisYearNow()));

// ---------------------------------------------------------------- views (#year, #year-2019, #search)
const hashYear = () => { const m = /^#year(?:-(\d{4}))?$/.exec(location.hash); return m ? Number(m[1] || thisYearNow()) : null; };
const hashView = () => (location.hash === '#search' ? 'search' : location.hash === '#risk' ? 'risk' : hashYear() ? 'year' : 'week');
let search = null, risk = null;
function setView(v, year) {
  state.view = v;
  $$('[data-view]').forEach((x) => { x.setAttribute('aria-pressed', x.dataset.view === v); x.setAttribute('aria-selected', x.dataset.view === v); });
  $('#view-week').hidden = v !== 'week';
  $('#view-year').hidden = v !== 'year';
  $('#view-search').hidden = v !== 'search';
  $('#view-risk').hidden = v !== 'risk';
  hideTip();
  if (v === 'risk' && !risk) risk = mountRisk($('#view-risk'), 'data/risk.json');
  if (v === 'year') { loadIds(); if (year || !state.year) loadYear(year || state.yearShown); else renderYear(); }
  else if (v === 'search') { if (!search) search = mountSearch($('#view-search'), () => loadNeos().then((d) => d.rows)); setTimeout(() => search.focus(), 0); }
  else if (state.week) renderFiltered();
}
$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  const v = b.dataset.view;
  history.replaceState(null, '', v === 'year' ? (state.yearShown && state.yearShown !== thisYearNow() ? `#year-${state.yearShown}` : '#year') : v === 'search' ? '#search' : v === 'risk' ? '#risk' : location.pathname);
  setView(v);
}));
addEventListener('hashchange', () => setView(hashView(), hashYear()));

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.view === 'week') renderFiltered(); else if (state.year || state.yearError) renderYear(); }, 150);
});

// ---------------------------------------------------------------- start
showKeyState();
if (location.hash === '#key') toggleKeyCard(true);

// Coming back (Back button, or a reload): the same week or year, filters, sort, open row, search words and scroll
// position as when the page was left. Kept in this browser tab only.
const place = placeKeeper('tracker', () => ({
  hash: location.hash, weekStart: state.weekStart, sortKey: state.sortKey, sortDir: state.sortDir,
  filter: { ...state.filter, dist: Number.isFinite(state.filter.dist) ? state.filter.dist : null },
  selected: state.selected, showAll: state.showAll, maxLd: state.maxLd, q: $('#q') ? $('#q').value : '',
}));
const has = (sel, v) => [...$(sel).options].some((o) => o.value === String(v));
if (place && place.hash === location.hash) {
  if (Number.isFinite(place.weekStart)) state.weekStart = sundayOf(place.weekStart);
  const f = place.filter || {};
  state.filter = { haz: !!f.haz, size: has('#fSize', f.size) ? Number(f.size) : 0, dist: f.dist !== null && has('#fDist', f.dist) ? Number(f.dist) : Infinity, day: f.day || '' };
  $('#fSize').value = String(state.filter.size); $('#fDist').value = String(state.filter.dist);
  $$('[data-haz]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.haz === (state.filter.haz ? 'haz' : 'all')));
  if (has('#sortSel', `${place.sortKey}:${place.sortDir}`)) { state.sortKey = place.sortKey; state.sortDir = place.sortDir; $('#sortSel').value = `${place.sortKey}:${place.sortDir}`; }
  else if (['t', 'ld', 'dmax', 'v', 'name'].includes(place.sortKey) && Math.abs(place.sortDir) === 1) { state.sortKey = place.sortKey; state.sortDir = place.sortDir; }
  if (Number.isFinite(place.maxLd) && $(`[data-ld="${place.maxLd}"]`)) { state.maxLd = place.maxLd; $$('[data-ld]').forEach((x) => x.setAttribute('aria-pressed', Number(x.dataset.ld) === state.maxLd)); }
  keepRow = { weekStart: state.weekStart, selected: place.selected || null, showAll: !!place.showAll };
}
loadWeek();
setView(hashView(), hashYear());
if (place && place.hash === location.hash) {
  if (state.view === 'search' && place.q) search.set(place.q);
  const t0 = performance.now();
  scrollBack(place.scrollY, () => state.view === 'week' ? !!(state.week || state.weekError)
    : state.view === 'year' ? !!(state.year || state.yearError) && (!!idByDes?.size || performance.now() - t0 > 1500)
    : !!document.querySelector('#view-search .rmain') || performance.now() - t0 > 2500);
}
