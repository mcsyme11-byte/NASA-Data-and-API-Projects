// NASA and ESA Data Projects · Sky Finder · tonight's list · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The home screen: where you are, the asteroids passing close (tonight's first, then the coming nights), what else is
// up tonight (Moon, planets, the space stations' passes), and the button that opens the camera view (view.js).
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
function openPlace(open) { sheet.hidden = !open; $('#changePlace').setAttribute('aria-expanded', open); if (open) setTimeout(() => $('#placeQ').focus(), 30); }
$('#changePlace').addEventListener('click', () => openPlace(sheet.hidden));
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
$('#placeQ').addEventListener('input', () => {
  clearTimeout(qt);
  qt = setTimeout(async () => { try { hits = await searchPlaces($('#placeQ').value); cur = -1; showHits(); } catch { say('The list of towns could not be loaded. Try "Use my location".'); } }, 120);
});
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
const needTag = (n) => `<span class="need" style="--c:var(--n-${n.key})">${esc(n.label)}</span>`;
const shortName = (n) => n.replace(/^\((.*)\)$/, '$1');

function render() {
  const place = currentPlace();
  $('#placeName').textContent = place ? place.name.replace(/, [^,]+$/, (m) => (place.name.length > 26 ? '' : m)) : 'where are you?';
  $('#forgetPlace').hidden = !place;
  $('#point').disabled = !place || !sky;
  if (!place) {
    $('#darkFrom').textContent = '';
    $('#astList').innerHTML = `<div class="sfstate">Choose where you are to see what is up tonight. <button class="sfbtn small" type="button" data-open-place>Choose</button></div>`;
    $('#alsoList').innerHTML = '';
    $('#astList [data-open-place]').addEventListener('click', () => openPlace(true));
    if (sheet.hidden) openPlace(true);
    return;
  }
  if (!sky) return;
  if (sky.errors.sky && sky.errors.stars) {
    $('#astList').innerHTML = `<div class="sfstate">Tonight's data could not be loaded. Check the connection and <button class="linkbtn" type="button" data-retry>try again</button>.</div>`;
    $('#astList [data-retry]').addEventListener('click', () => { location.reload(); });
    return;
  }
  list = tonightList(sky, place);
  const n = list.night;
  $('#darkFrom').textContent = n.noDark ? ' · no full darkness tonight' : ` · dark ${hhmm(n.darkFrom)}–${hhmm(n.darkTo)}`;

  // asteroids
  const vis = list.passes.filter((x) => x.visible);
  const tonightEnd = n.to + 3600e3;
  if (find && !list.passes.some((x) => x.obj.des === find)) {
    $('#found').hidden = false; $('#found').textContent = `${find} is not among the passes worth looking for in the next 30 days.`;
  } else $('#found').hidden = true;
  if (sky.errors.sky) $('#astList').innerHTML = `<div class="sfstate">The asteroid list could not be loaded just now. The Moon, planets and stars below still work.</div>`;
  else if (!list.passes.length) $('#astList').innerHTML = `<div class="sfstate">No asteroid passing in the next 30 days is bright enough to look for from a backyard. The list is updated every day.</div>`;
  else {
    const rows = list.passes.map((x) => {
      const o = x.obj, sel = o.des === chosen;
      if (!x.visible) return `<button class="sfitem dim" type="button" data-t="${esc(o.des)}" aria-pressed="${sel}"><span class="ic ast" aria-hidden="true"></span><span class="t"><b>${esc(shortName(o.name))}</b><span>not up at night from here (${esc(x.reason)})</span></span>${needTag(x.need)}</button>`;
      const w = upWindow(x), isTonight = w.from <= tonightEnd;
      const when = isTonight ? `up ${hhmm(w.from)}–${hhmm(w.to)}, highest ${hhmm(msFromJd(x.top.jd))}, to the ${dirText(x.top.az)}` : `best ${day(msFromJd(x.best.jd))}, ${hhmm(msFromJd(x.best.jd))}, to the ${dirText(x.top.az)}`;
      return `<button class="sfitem${isTonight ? ' tonight' : ''}" type="button" data-t="${esc(o.des)}" aria-pressed="${sel}"><span class="ic ast" aria-hidden="true"></span><span class="t"><b>${esc(shortName(o.name))}</b><span>${when} · mag ${x.best.mag.toFixed(1)}</span></span>${needTag(x.need)}</button>`;
    });
    $('#astList').innerHTML = (vis.length ? '' : `<div class="sfstate small">None of the coming passes rises above your horizon at night; the markers still show where they are.</div>`) + rows.join('');
  }

  // also up
  const also = [];
  const m = list.moon;
  if (m.top) also.push(`<button class="sfitem" type="button" data-t="moon" aria-pressed="${chosen === 'moon'}"><span class="ic moon" aria-hidden="true"></span><span class="t"><b>Moon</b><span>${Math.round(m.lit * 100)}% lit, ${m.waxing ? 'growing' : 'shrinking'}; highest ${Math.round(m.top.alt)}° to the ${dirText(m.top.az)} at ${hhmm(m.top.ms)}</span></span></button>`);
  for (const p of list.planets) also.push(`<button class="sfitem" type="button" data-t="${p.name.toLowerCase()}" aria-pressed="${chosen === p.name.toLowerCase()}"><span class="ic planet" aria-hidden="true"></span><span class="t"><b>${p.name}</b><span>${p.look}; highest ${Math.round(p.top.alt)}° to the ${dirText(p.top.az)} at ${hhmm(p.top.ms)}</span></span><span class="need" style="--c:var(--n-eye)">Naked eye</span></button>`);
  for (const s of list.stations) {
    const ps = s.passes.slice(0, 3).map((q) => `${hhmm(q.start.ms)} (${Math.round(q.top.alt)}° up, ${Math.round((q.end.ms - q.start.ms) / 60000) || 1} min)`).join(', ');
    also.push(`<button class="sfitem" type="button" data-t="${s.short.toLowerCase()}" aria-pressed="${chosen === s.short.toLowerCase()}"><span class="ic station" aria-hidden="true"></span><span class="t"><b>${esc(s.name)}</b><span>passes over: ${ps}; a bright moving star</span></span><span class="need" style="--c:var(--n-eye)">Naked eye</span></button>`);
  }
  if (!sky.errors.tle && sky.sats.length && !list.stations.length) also.push(`<div class="sfstate small">No space station passes you can see tonight.</div>`);
  $('#alsoList').innerHTML = also.join('') || `<div class="sfstate small">${n.noDark ? 'The sky does not get dark tonight.' : 'Nothing bright is up tonight apart from the stars.'}</div>`;
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
  {
    const d = document.createElement('div');
    d.className = 'sfmodal'; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true'); d.setAttribute('aria-labelledby', 'fuT');
    d.innerHTML = `<div class="sfmodal-c">
      <h2 id="fuT">Before you start</h2>
      <ul>
        <li><b>Never point your eyes, binoculars or a telescope at the Sun.</b> Sky Finder marks it in red.</li>
        <li>Look where you walk: go somewhere safe and dark, not near roads or edges. Never use it while driving.</li>
        <li>The camera, your location and the motion sensors are used on this phone only, to draw the markers. Nothing is recorded, saved or sent.</li>
        <li>Positions are estimates for learning and enjoyment; a phone compass can be several degrees off.</li>
      </ul>
      <p class="sfnote">By continuing you agree to the <a href="../terms/#sky-finder">Terms</a>. See also <a href="../privacy/#sky-finder">Privacy</a>.</p>
      <div class="sfmodal-b"><button class="linkbtn" type="button" data-no>Not now</button><button class="sfbtn" type="button" data-yes>I understand</button></div>
    </div>`;
    document.body.append(d);
    const done = (ok) => { d.remove(); if (ok) { store.set(ACCEPT_KEY, '1'); onYes(); } else $('#point').focus(); };
    d.querySelector('[data-yes]').addEventListener('click', () => done(true));
    d.querySelector('[data-no]').addEventListener('click', () => done(false));
    d.addEventListener('keydown', (e) => { if (e.key === 'Escape') done(false); });
    d.querySelector('[data-yes]').focus();
  }
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
  openFromTap($('#view'), { sky, place, target: chosen, onClose: () => { viewing = null; if (history.state && history.state.view) history.back(); } })
    .then((v) => { viewing = v; opening = false; });
}
$('#point').addEventListener('click', point);
addEventListener('popstate', () => { if (viewing) { const v = viewing; viewing = null; v.close(); } });

// ------------------------------------------------------------ start
loadSky().then((s) => { sky = s; render(); });
render();
setInterval(() => { if (!viewing && sky) render(); }, 5 * 60 * 1000);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
