// NASA and ESA Data Projects · Sky Finder · tonight's list · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The home screen: where you are, a strip of tonight's figures (when it gets dark, the Moon, how many asteroids are up),
// the asteroids passing close (tonight, the coming nights, then the ones not up at night from here), what else is up
// tonight (Moon, planets, the space stations' passes), and the button that opens the camera view (view.js).
// Opened from the Asteroid Tracker with ?find=<designation>, that asteroid is shown first and the camera view aims
// at it. Works offline once visited (sw.js); the data files are the same for every visitor.

import { currentPlace, locate, searchPlaces, setPlace, forgetPlace } from '../shared/place.js';
import { loadSky, tonightList, dirText } from './targets.js';
import { openFromTap } from './view.js';

const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
const day = (ms) => new Date(ms).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric' });
const msFromJd = (jd) => (jd - 2440587.5) * 86400000;
const ACCEPT_KEY = 'nasa-data-projects.sky-finder.accepted';
const RED_KEY = 'nasa-data-projects.sky-finder.red';
const find = new URLSearchParams(location.search).get('find');
let sky = null, list = null, chosen = find || null;

// ------------------------------------------------------------ red light
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private browsing */ } },
};
function setRed(on) { document.documentElement.classList.toggle('red', on); $('#red').setAttribute('aria-pressed', on); store.set(RED_KEY, on ? '1' : ''); }
setRed(store.get(RED_KEY) === '1');
$('#red').addEventListener('click', () => setRed(!document.documentElement.classList.contains('red')));

// ------------------------------------------------------------ place
const sheet = $('#placeSheet');
function openPlace(open) {
  sheet.hidden = !open; $('#changePlace').setAttribute('aria-expanded', open);
  $('#changePlace').textContent = open ? 'Close' : 'Change';
  if (open) setTimeout(() => $('#placeQ').focus(), 30);
}
$('#changePlace').addEventListener('click', () => openPlace(sheet.hidden));
$('#closePlace').addEventListener('click', () => { openPlace(false); $('#changePlace').focus(); });
sheet.addEventListener('keydown', (e) => { if (e.key === 'Escape' && currentPlace()) { openPlace(false); $('#changePlace').focus(); } });
const say = (m) => { $('#placeMsg').textContent = m || ''; $('#placeMsg').hidden = !m; };
$('#useHere').addEventListener('click', async () => {
  const b = $('#useHere'); b.disabled = true; b.textContent = 'Finding you…'; say('');
  try { await locate(); openPlace(false); } catch (e) { say(e.message); }
  b.disabled = false; b.textContent = 'Use my location';
});
$('#forgetPlace').addEventListener('click', () => { forgetPlace(); say('Forgotten on this phone.'); });
let hits = [], cur = -1, qt = null;
function showHits() {
  const box = $('#placeHits'); box.hidden = !hits.length;
  box.innerHTML = hits.map((h, i) => `<button type="button" role="option" aria-selected="${i === cur}" data-i="${i}">${esc(h.name)}</button>`).join('');
}
function searchNow() {
  clearTimeout(qt);
  const q = $('#placeQ').value.trim();
  if (!q) { hits = []; showHits(); return; }
  qt = setTimeout(async () => {
    try {
      hits = await searchPlaces(q); cur = -1; showHits();
      say(hits.length ? '' : `No town called "${q}" in the list. Try a nearby larger town, or "Use my location".`);
    } catch { say('The list of towns could not be loaded. Try "Use my location".'); }
  }, 120);
}
$('#placeQ').addEventListener('input', searchNow);
$('#placeClear').addEventListener('click', (e) => { e.preventDefault(); $('#placeQ').value = ''; searchNow(); say(''); $('#placeQ').focus(); });
$('#placeQ').addEventListener('keydown', (e) => {
  if (!hits.length) return;
  if (e.key === 'ArrowDown') { cur = (cur + 1) % hits.length; showHits(); e.preventDefault(); }
  else if (e.key === 'ArrowUp') { cur = (cur - 1 + hits.length) % hits.length; showHits(); e.preventDefault(); }
  else if (e.key === 'Enter') { pickPlace(cur >= 0 ? cur : 0); e.preventDefault(); }
});
$('#placeHits').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pickPlace(Number(b.dataset.i)); });
function pickPlace(i) { const h = hits[i]; if (!h) return; setPlace({ ...h, how: 'search' }); hits = []; showHits(); $('#placeQ').value = ''; say(''); openPlace(false); }
addEventListener('skyplace', () => render());

// ------------------------------------------------------------ the lists
function upWindow(x) {
  // the stretch of the best night when it is dark and the asteroid at least 10° up
  const pts = x.night.points, i0 = pts.findIndex((q) => q.jd >= x.top.jd);
  let a = i0, b = i0;
  while (a > 0 && pts[a - 1].dark && pts[a - 1].trueAlt >= 10) a--;
  while (b < pts.length - 1 && pts[b + 1].dark && pts[b + 1].trueAlt >= 10) b++;
  return { from: msFromJd(pts[a].jd), to: msFromJd(pts[b].jd) };
}
const needTag = (n) => `<span class="need n-${n.key}">${esc(n.label)}</span>`;
const shortName = (n) => n.replace(/^\((.*)\)$/, '$1');
const CHEV = '<svg class="chev" width="10" height="16" viewBox="0 0 10 16" aria-hidden="true"><path d="M2 2l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.6"/></svg>';
// one row of a list: icon, name (with what is needed to see it), one line of detail, and an arrow into the camera view
const row = (t, cls, icon, name, need, detail) => `<button class="sfitem${cls}" type="button" data-t="${esc(t)}" aria-pressed="${chosen === t}">`
  + `<span class="ic ${icon}" aria-hidden="true"></span><span class="t"><span class="nm"><b>${esc(name)}</b>${need ? ' ' + needTag(need) : ''}</span><span class="d">${detail}</span></span>${CHEV}</button>`;
const group = (title, rows) => (rows.length ? `<h3 class="sfgroup">${title}</h3>${rows.join('')}` : '');
const EYE = { key: 'eye', label: 'Naked eye' };

function stats(n, m, upTonight, total) {
  const box = $('#tonightStats'); box.hidden = false;
  const dark = n.noDark ? `<div class="value">None</div><div class="note">the Sun stays less than 12° down</div>`
    : `<div class="value">${n.darkFrom <= Date.now() + 5 * 60e3 ? 'Now' : hhmm(n.darkFrom)}</div><div class="note">${n.darkTo ? `until ${hhmm(n.darkTo)}` : 'until dawn'}</div>`;
  box.innerHTML = `<div class="stat"><div class="label">Dark from</div>${dark}</div>`
    + `<div class="stat"><div class="label">Moon</div><div class="value">${Math.round(m.lit * 100)}<small>% lit</small></div><div class="note">${m.top ? `highest ${hhmm(m.top.ms)}` : 'not up while dark'}</div></div>`
    + (total === null ? `<div class="stat"><div class="label">Asteroids</div><div class="value">–</div><div class="note">list not loaded</div></div>`
      : `<div class="stat"><div class="label">Asteroids</div><div class="value">${upTonight}</div><div class="note">up tonight, of ${total} in 30 days</div></div>`);
}

function render() {
  const place = currentPlace();
  $('#placeName').textContent = place ? place.name : 'Not set yet';
  $('#forgetPlace').hidden = !place;
  $('#point').disabled = !place || !sky;
  if (!place) {
    $('#tonightStats').hidden = true; $('#found').hidden = true;
    $('#astList').innerHTML = `<div class="state small">Choose where you are to see what is up tonight.</div>`;
    $('#alsoList').innerHTML = '';
    if (sheet.hidden) openPlace(true);
    $('#closePlace').hidden = true;
    $('#point').textContent = 'Choose where you are first';
    return;
  }
  $('#closePlace').hidden = false;
  if (!sky) return;
  if (sky.errors.sky && sky.errors.stars) {
    $('#tonightStats').hidden = true;
    $('#astList').innerHTML = `<div class="notice error"><span class="t">Tonight's data could not be loaded. Check the connection, then try again.</span><button class="btn small" type="button" data-retry>Try again</button></div>`;
    $('#astList [data-retry]').addEventListener('click', () => { location.reload(); });
    $('#alsoList').innerHTML = '';
    return;
  }
  list = tonightList(sky, place);
  const n = list.night;
  const tonightEnd = n.to + 3600e3;

  // asteroids: tonight, the coming nights, then the ones that are not up at night from here
  const now = [], later = [], never = [];
  for (const x of list.passes) {
    const o = x.obj, name = shortName(o.name);
    if (!x.visible) { never.push(row(o.des, ' dim', 'ast', name, x.need, `not up at night from here (${esc(x.reason)})`)); continue; }
    const w = upWindow(x);
    if (w.from <= tonightEnd) now.push(row(o.des, '', 'ast', name, x.need, `up ${hhmm(w.from)}–${hhmm(w.to)}, highest at ${hhmm(msFromJd(x.top.jd))} to the ${dirText(x.top.az)} · magnitude ${x.best.mag.toFixed(1)}`));
    else later.push(row(o.des, '', 'ast', name, x.need, `best ${day(msFromJd(x.best.jd))} at ${hhmm(msFromJd(x.best.jd))}, to the ${dirText(x.top.az)} · magnitude ${x.best.mag.toFixed(1)}`));
  }
  stats(n, list.moon, now.length, sky.errors.sky ? null : list.passes.length);
  if (find && !list.passes.some((x) => x.obj.des === find)) {
    $('#found').hidden = false;
    $('#found').innerHTML = `<span class="t"><b>${esc(find)}</b> is not among the passes worth looking for in the next 30 days: it is too faint, or not close enough. The camera view still shows the Moon, planets and stars.</span>`;
  } else $('#found').hidden = true;
  if (sky.errors.sky) $('#astList').innerHTML = `<div class="notice error"><span class="t">The asteroid list could not be loaded just now. The Moon, planets and stars below still work.</span></div>`;
  else if (!list.passes.length) $('#astList').innerHTML = `<div class="state small">No asteroid passing in the next 30 days is bright enough to look for from a backyard. The list is updated every day.</div>`;
  else {
    const none = !now.length && !later.length ? `<p class="sfnote">None of the coming passes rises above your horizon at night; the markers still show where they are.</p>` : '';
    $('#astList').innerHTML = none + group('Tonight', now) + group('Coming nights', later) + group('Not up at night from here', never);
  }

  // also up: the Moon, the planets, the space stations' passes
  const also = [];
  const m = list.moon;
  if (m.top) also.push(row('moon', '', 'moon', 'Moon', null, `${Math.round(m.lit * 100)}% lit, ${m.waxing ? 'growing' : 'shrinking'}; highest ${Math.round(m.top.alt)}° up to the ${dirText(m.top.az)} at ${hhmm(m.top.ms)}`));
  for (const p of list.planets) also.push(row(p.name.toLowerCase(), '', 'planet', p.name, EYE, `${esc(p.look)}; highest ${Math.round(p.top.alt)}° up to the ${dirText(p.top.az)} at ${hhmm(p.top.ms)}`));
  for (const s of list.stations) {
    const ps = s.passes.slice(0, 3).map((q) => `${hhmm(q.start.ms)} (${Math.round(q.top.alt)}° up, ${Math.round((q.end.ms - q.start.ms) / 60000) || 1} min)`).join(', ');
    also.push(row(s.short.toLowerCase(), '', 'station', s.name, EYE, `a bright moving star, passing over at ${ps}`));
  }
  let extra = '';
  if (sky.errors.tle) extra = `<p class="sfnote">The space stations' orbits could not be loaded just now.</p>`;
  else if (sky.sats.length && !list.stations.length) extra = `<p class="sfnote">No space station passes you can see tonight.</p>`;
  $('#alsoList').innerHTML = (also.join('') || `<div class="state small">${n.noDark ? 'The sky does not get dark tonight.' : 'Nothing bright is up tonight apart from the stars.'}</div>`) + extra;
  if (find) { const el = document.querySelector(`[data-t="${CSS.escape(find)}"]`); if (el && !render.scrolled) { render.scrolled = true; el.scrollIntoView({ block: 'center' }); } }
  $('#point').textContent = chosen ? `Find ${chosenName()}` : 'Point at the sky';
}
function chosenName() {
  if (!chosen) return '';
  const a = sky && sky.asteroids.find((o) => o.des === chosen);
  if (a) return shortName(a.name).replace(/^(\d+) (\S+) \(.*\)$/, '$2');
  return chosen === 'iss' ? 'the ISS' : chosen === 'tiangong' ? 'Tiangong' : chosen === 'moon' ? 'the Moon' : chosen[0].toUpperCase() + chosen.slice(1);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('.sfitem[data-t]');
  if (!b) return;
  chosen = b.dataset.t;
  document.querySelectorAll('.sfitem[data-t]').forEach((x) => x.setAttribute('aria-pressed', x === b));
  $('#point').textContent = `Find ${chosenName()}`;
  point();
});

// ------------------------------------------------------------ first use: safety and privacy, then the camera view
function accepted() { return store.get(ACCEPT_KEY) === '1'; }
// onYes runs inside the tap on "I understand", so the iPhone can still ask for the motion sensors.
function firstUse(onYes) {
  const back = document.activeElement;
  const d = document.createElement('div');
  d.className = 'sfmodal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'fuT');
  d.innerHTML = `<div class="sfmodal-c">
    <div class="kicker">Before you start</div>
    <h2 id="fuT">Safety and your data</h2>
    <ul class="list">
      <li><b>Never point your eyes, binoculars or a telescope at the Sun.</b> Sky Finder marks it in red.</li>
      <li>Look where you walk: somewhere safe and dark, away from roads and edges. Never use it while driving.</li>
      <li>The camera, your location and the motion sensors are used on this phone only, to draw the markers. Nothing is recorded, saved or sent.</li>
      <li>Positions are estimates for learning and enjoyment; a phone compass can be several degrees off until it is calibrated.</li>
    </ul>
    <p class="sfnote">Continuing means you accept the <a href="../terms/#sky-finder">terms for Sky Finder</a>. How the camera, location and sensors are handled: <a href="../privacy/#sky-finder">Privacy</a>. Everything else: <a href="../legal/">Legal</a>.</p>
    <div class="sfmodal-b"><button class="btn quiet" type="button" data-no>Not now</button><button class="btn" type="button" data-yes>I understand</button></div>
  </div>`;
  document.body.append(d);
  const done = (ok) => { d.remove(); if (ok) { store.set(ACCEPT_KEY, '1'); onYes(); } else (back && back.focus ? back : $('#point')).focus(); };
  d.querySelector('[data-yes]').addEventListener('click', () => done(true));
  d.querySelector('[data-no]').addEventListener('click', () => done(false));
  d.addEventListener('click', (e) => { if (e.target === d) done(false); });
  d.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') done(false);
    if (e.key === 'Tab') {            // keep the focus inside the notice
      const f = [...d.querySelectorAll('a, button')], i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0) { f[f.length - 1].focus(); e.preventDefault(); } else if (!e.shiftKey && i === f.length - 1) { f[0].focus(); e.preventDefault(); }
    }
  });
  d.querySelector('[data-yes]').focus();
}
let viewing = null, opening = false;
function point() {
  const place = currentPlace();
  if (!place) { openPlace(true); say('Choose where you are first.'); return; }
  if (!sky || viewing || opening) return;
  if (!accepted()) { firstUse(go); return; }
  go();
}
function go() {
  // runs inside the tap: openFromTap asks for the motion sensors before anything else
  opening = true;
  const place = currentPlace();
  history.pushState({ view: 1 }, '', location.href);
  openFromTap($('#view'), {
    sky, place, target: chosen,
    onTarget: (t) => { chosen = t; document.querySelectorAll('.sfitem[data-t]').forEach((x) => x.setAttribute('aria-pressed', x.dataset.t === t)); $('#point').textContent = t ? `Find ${chosenName()}` : 'Point at the sky'; },
    onClose: () => { viewing = null; if (history.state && history.state.view) history.back(); },
  }).then((v) => { viewing = v; opening = false; });
}
$('#point').addEventListener('click', point);
addEventListener('popstate', () => { if (viewing) { const v = viewing; viewing = null; v.close(); } });

// ------------------------------------------------------------ start
loadSky().then((s) => { sky = s; render(); });
render();
setInterval(() => { if (!viewing && sky) render(); }, 5 * 60 * 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
