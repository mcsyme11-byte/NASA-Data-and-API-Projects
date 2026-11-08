// NASA Data Projects · Asteroid Tracker · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Two views:
//   This week  live from NASA NeoWs (/neo/rest/v1/feed, at most 7 days per request; 1 request per week shown),
//              through shared/nasa.js, which keeps the visitor's key in their browser and caches answers per visit.
//   This year  from data/close-approaches.json, written daily by fetch_close_approaches.py on GitHub Actions
//              (the JPL close-approach API blocks direct calls from web pages).
// Charts are in charts.js; units and the size-from-brightness rule in format.js.

import { nasaGet, getKey, setKey, usingDemoKey, isoDate } from '../shared/nasa.js';
import { fmt, sizeText, dateText, sizePicture, diameterM, LD_KM, DAY_MS } from './format.js';
import { scatter, perDay, biggest, yearChart, hideTip } from './charts.js';

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
  year: null, yearError: null, maxLd: 1,
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
    ? 'This page is using NASA\'s shared demo key: 30 requests an hour and 50 a day for your connection. A free key from <a href="https://api.nasa.gov/" target="_blank" rel="noopener">api.nasa.gov</a> allows 1,000 an hour. Each week shown costs 1 request; the "This year" view costs none.'
    : 'Your own key is saved in this browser only (never sent anywhere but NASA): 1,000 requests an hour. Each week shown costs 1 request. Remove it to go back to the demo key.';
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

async function loadWeek() {
  const start = state.weekStart, end = start + 6 * DAY_MS;
  state.week = null; state.weekError = null; state.selected = null; state.showAll = false;
  $('#weekLabel').textContent = `${dateText(start)} – ${dateText(end)}, ${new Date(end).getUTCFullYear()}`;
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
    <p class="note">Sizes are estimates from how bright the object looks: a dark object is larger than a shiny one of the same brightness, so NASA gives a range.${o.url ? ` <a href="${esc(o.url)}" target="_blank" rel="noopener">Full orbit at JPL ›</a>` : ''}</p></div>`;
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
  if (act === 'retry') state.view === 'year' ? loadYear() : loadWeek();
  if (act === 'key') toggleKeyCard(true);
  if (act === 'clear') clearFilters();
});

// ---------------------------------------------------------------- this year
async function loadYear() {
  state.yearError = null;
  notice('#yearNotice', '');
  loadingTiles('#yearTiles', ['Within 1 LD', 'Closest of the year', 'Still to come', 'Next one']);
  loadingChart('#cYear');
  try {
    const res = await fetch('data/close-approaches.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('status ' + res.status);
    const data = await res.json();
    state.year = {
      year: data.year, updated: data.updated,
      rows: data.rows.map(([name, t, ld, H, dkm]) => {
        const o = { name, t, ld, H };
        if (dkm) { o.dmin = o.dmax = dkm * 1000; o.measured = true; }
        else if (H !== null) { o.dmin = diameterM(H, 0.25); o.dmax = diameterM(H, 0.05); }
        else { o.dmin = o.dmax = NaN; }
        return o;
      }),
    };
  } catch {
    state.yearError = true;
  }
  renderYear();
}

function renderYear() {
  $('#yearTiles').classList.remove('loading');
  if (state.yearError || !state.year) {
    notice('#yearNotice', 'The year\'s close-approach data could not be loaded. Try again in a moment.', '<button class="btn ghost" data-act="retry">Try again</button>');
    tiles('#yearTiles', [{ label: 'This year', value: '—', note: 'not loaded' }]);
    loadingChart('#cYear', 'No data.');
    $('#yearTable tbody').innerHTML = $('#nextTable tbody').innerHTML = '';
    return;
  }
  const { year, updated, rows } = state.year, now = Date.now(), max = state.maxLd;
  const list = rows.filter((o) => o.ld <= max);
  const closest = [...list].sort((a, b) => a.ld - b.ld);
  const upcoming = list.filter((o) => o.t >= now).sort((a, b) => a.t - b.t);
  const within = max === 1 ? 'closer than the Moon' : `within ${max} times the Moon's distance`;
  tiles('#yearTiles', [
    { label: `Within ${max} LD in ${year}`, value: fmt(list.length), note: within },
    closest[0]
      ? { label: 'Closest of the year', value: fmt(closest[0].ld * LD_KM) + ' <small>km</small>', note: esc(closest[0].name) + ' · ' + dateText(closest[0].t), sub: 1 }
      : { label: 'Closest of the year', value: '—', note: 'none yet' },
    { label: 'Still to come', value: fmt(upcoming.length), note: `known so far, between today and Dec 31` },
    upcoming[0]
      ? { label: 'Next one', value: dateText(upcoming[0].t), note: esc(upcoming[0].name) + ' · ' + fmt(upcoming[0].ld, 2) + ' LD', sub: 1 }
      : { label: 'Next one', value: '—', note: 'none known yet this year' },
  ]);
  yearChart($('#cYear'), list, { year, now, maxLd: max });
  $('#yearUpdated').textContent = updated ? `Last updated ${updated.slice(0, 10)}, ${updated.slice(11, 16)} UTC.` : '';
  smallTable('#yearTable', closest.slice(0, 6), 'None yet.');
  smallTable('#nextTable', upcoming.slice(0, 6), 'None known yet. New objects are found every week.');
}

function smallTable(sel, list, empty) {
  $(sel + ' tbody').innerHTML = list.length
    ? list.map((o) => `<tr class="static"><td data-label="Name">${esc(o.name)}</td><td data-label="Date">${dateText(o.t)}</td><td data-label="Size, est." class="num"><span>${sizeText(o)}</span></td><td data-label="Distance" class="num"><span>${fmt(o.ld, 2)} LD<span class="s">${fmt(o.ld * LD_KM)} km</span></span></td></tr>`).join('')
    : `<tr class="msg"><td colspan="4"><div class="state small">${empty}</div></td></tr>`;
}

$$('[data-ld]').forEach((b) => b.addEventListener('click', () => {
  state.maxLd = Number(b.dataset.ld);
  $$('[data-ld]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  renderYear();
}));

// ---------------------------------------------------------------- views (#year opens the year view)
function setView(v) {
  state.view = v;
  $$('[data-view]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.view === v));
  $('#view-week').hidden = v !== 'week';
  $('#view-year').hidden = v !== 'year';
  hideTip();
  if (v === 'year') { if (!state.year && !state.yearError) loadYear(); else renderYear(); }
  else if (state.week) renderFiltered();
}
$$('[data-view]').forEach((b) => b.addEventListener('click', () => {
  history.replaceState(null, '', b.dataset.view === 'year' ? '#year' : location.pathname);
  setView(b.dataset.view);
}));
addEventListener('hashchange', () => setView(location.hash === '#year' ? 'year' : 'week'));

let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.view === 'week') renderFiltered(); else if (state.year) renderYear(); }, 150);
});

// ---------------------------------------------------------------- start
showKeyState();
loadWeek();
setView(location.hash === '#year' ? 'year' : 'week');
