// NASA and ESA Data Projects · Asteroid Tracker · "Visible from here" · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The close passes of the next 30 days that rise above the visitor's horizon at night, how bright each gets and what
// is needed to see it (data/sky.json, from NASA/JPL; the sky maths in shared/sky.js and shared/passes.js). The place
// stays in the browser (shared/place.js).

import { currentPlace, locate, searchPlaces, forgetPlace, setPlace, placeText } from '../shared/place.js';
import { passesFor } from '../shared/passes.js';
import { jdFromMs, moonPhase, NEEDS, compassWord } from '../shared/sky.js';
import { fmt, sizeText } from './format.js';

const msFromJd = (jd) => (jd - 2440587.5) * 86400000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const NEED_COL = { eye: '#E2C88E', bino: '#8FB996', small: '#8AA9C9', large: '#B79AC8', faint: '#98A0AB' };
const when = (jd) => new Date(msFromJd(jd)).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeOnly = (jd) => new Date(msFromJd(jd)).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' });
const needTag = (n) => `<span class="need" style="--c:${NEED_COL[n.key]}">${esc(n.label)}</span>`;
const sizeOf = (km) => sizeText({ dmin: km * 1000, dmax: km * 1000, measured: true });
const skyFinder = (des) => `../sky-finder/?find=${encodeURIComponent(des)}`;

export function mountVisible(root, url) {
  let data = null, err = null, sel = 0, passes = [];
  root.innerHTML = `
    <div class="viewhead">
      <h2>Asteroids you can look for from where you are</h2>
      <p class="lede">The close passes of the next 30 days that rise above your horizon at night, how bright they get and what you need to see them. Most asteroids passing Earth are far too faint for anything but a large telescope; this list shows the ones worth trying.</p>
    </div>
    <section class="panel placecard" aria-label="Your location">
      <div class="placewho">
        <div class="label">Your location</div>
        <div class="value" id="visPlace">Not set yet</div>
        <div class="note">Kept on this device only and never sent anywhere. Times are in this device's time zone.</div>
      </div>
      <div class="placeact">
        <button class="btn" id="visLocate" type="button">Use my location</button>
        <div class="placesearch">
          <label class="lbl" for="visQ">or a town</label>
          <input id="visQ" type="search" placeholder="Town or city" autocomplete="off" spellcheck="false" aria-controls="visHits" aria-autocomplete="list">
          <div class="placehits" id="visHits" role="listbox" hidden></div>
        </div>
        <button class="linkbtn" id="visForget" type="button" hidden>Forget this place</button>
      </div>
      <p class="note" id="visMsg" role="status" aria-live="polite" hidden></p>
    </section>
    <div class="stats" id="visTiles"></div>
    <div class="visgrid">
      <section class="panel" aria-labelledby="visListTitle">
        <div class="ph"><h3 id="visListTitle">Passes you can look for</h3><span class="aside" id="visCount"></span></div>
        <div class="pb flush"><table class="neo vistable" id="visTable"><thead><tr><th>Asteroid</th><th>Best moment</th><th>Highest</th><th>Brightness</th><th>You need</th><th><span class="sr">Sky Finder</span></th></tr></thead><tbody></tbody></table></div>
        <div class="pf"><p class="caption" id="visSource"></p></div>
      </section>
      <aside class="visside">
        <section class="panel" aria-labelledby="visNightTitle">
          <div class="ph"><h3 id="visNightTitle">Its best night</h3></div>
          <div class="pb"><svg class="chart" id="visChart" role="img"></svg></div>
          <div class="pf"><p class="caption">Height above your horizon through the night; the darker band is full darkness (the Sun more than 12° down). The line is dotted below 10°, where haze and trees get in the way.</p></div>
        </section>
        <section class="panel" aria-labelledby="visRules">
          <div class="ph"><h3 id="visRules">What you need: the rules</h3></div>
          <div class="pb"><div class="needrules">${NEEDS.map((n, i) => `<span>${i === 0 ? 'Magnitude up to 6' : i === NEEDS.length - 1 ? 'Above 15' : `${NEEDS[i - 1].max} to ${n.max}`}</span><span>${needTag(n)} ${esc(n.note)}</span>`).join('')}</div></div>
          <div class="pf"><p class="caption">Bigger magnitude means fainter. A city sky or a bright Moon moves everything one step down the list. <a href="../sky-finder/">Sky Finder</a>, on a phone, points you to it (<a href="../sky-finder/how-to.html">how to use it</a>).</p></div>
        </section>
      </aside>
    </div>`;
  const $ = (s) => root.querySelector(s);

  const say = (m) => { $('#visMsg').textContent = m || ''; $('#visMsg').hidden = !m; };
  $('#visLocate').addEventListener('click', async () => {
    $('#visLocate').disabled = true; $('#visLocate').textContent = 'Finding you…'; say('');
    try { await locate(); } catch (e) { say(e.message); }
    $('#visLocate').disabled = false; $('#visLocate').textContent = 'Use my location';
  });
  $('#visForget').addEventListener('click', () => { forgetPlace(); say('This place has been forgotten on this device.'); });
  // the town search: suggestions as you type; arrows and Enter pick one
  let hits = [], cur = -1, t = null;
  const showHits = () => {
    const box = $('#visHits');
    box.hidden = !hits.length;
    box.innerHTML = hits.map((h, i) => `<button type="button" role="option" aria-selected="${i === cur}" data-i="${i}">${esc(h.name)}</button>`).join('');
  };
  $('#visQ').addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(async () => {
      try { hits = await searchPlaces($('#visQ').value); cur = -1; showHits(); }
      catch { say('The list of towns could not be loaded. Try "Use my location", or try again later.'); }
    }, 120);
  });
  $('#visQ').addEventListener('keydown', (e) => {
    if (!hits.length) return;
    if (e.key === 'ArrowDown') { cur = (cur + 1) % hits.length; showHits(); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { cur = (cur - 1 + hits.length) % hits.length; showHits(); e.preventDefault(); }
    else if (e.key === 'Enter') { pick(cur >= 0 ? cur : 0); e.preventDefault(); }
    else if (e.key === 'Escape') { hits = []; showHits(); }
  });
  $('#visHits').addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (b) pick(Number(b.dataset.i)); });
  const pick = (i) => { const h = hits[i]; if (!h) return; setPlace({ ...h, how: 'search' }); hits = []; showHits(); $('#visQ').value = ''; say(''); };
  addEventListener('skyplace', () => render());

  root.querySelector('tbody').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (!tr || e.target.closest('a')) return;
    sel = Number(tr.dataset.i); render(false);
  });
  root.querySelector('tbody').addEventListener('keydown', (e) => {
    const tr = e.target.closest('tr[data-i]');
    if (tr && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); sel = Number(tr.dataset.i); render(false); }
  });

  function tiles(list) {
    const p = currentPlace(), jd = jdFromMs(Date.now()), moon = moonPhase(jd);
    const vis = list.filter((x) => x.visible), b = vis[0];
    const tile = (label, value, note) => `<div class="tile"><div class="label">${label}</div><div class="value">${value}</div><div class="note">${note}</div></div>`;
    $('#visTiles').innerHTML = [
      tile('Up at night from here', p ? `${vis.length} of ${list.length}` : '—', p ? 'passes in the next 30 days' : 'set your location above'),
      tile('Brightest', b ? `magnitude ${b.best.mag.toFixed(1)}` : '—', b ? `${esc(b.obj.name)}, ${when(b.best.jd)}` : 'none bright enough from here'),
      tile('Easiest to see', b ? needTag(b.need) : '—', b ? 'what the brightest one needs' : 'with what you have'),
      tile('Moon tonight', `${Math.round(moon.lit * 100)}% lit`, moon.lit > 0.6 ? 'bright: it hides faint ones' : 'a darker sky helps'),
    ].join('');
  }

  function render(recompute = true) {
    const p = currentPlace();
    $('#visPlace').textContent = p ? placeText(p) : 'Not set yet';
    $('#visForget').hidden = !p;
    const tb = root.querySelector('tbody');
    if (err) {
      tb.innerHTML = `<tr class="msg"><td colspan="6"><div class="state small">The list of upcoming passes could not be loaded. <button class="linkbtn" data-retry>Try again</button></div></td></tr>`;
      tb.querySelector('[data-retry]').addEventListener('click', load);
      tiles([]); chart(null); return;
    }
    if (!data) { tb.innerHTML = `<tr class="msg"><td colspan="6"><div class="state small">Loading the passes of the next 30 days…</div></td></tr>`; return; }
    const objs = data.objects || [];
    if (!objs.length) {
      tb.innerHTML = `<tr class="msg"><td colspan="6"><div class="state small">No asteroid passing in the next 30 days is expected to be bright enough for a backyard telescope. The list is updated every day.</div></td></tr>`;
      tiles([]); chart(null); $('#visCount').textContent = ''; return;
    }
    if (!p) {
      tb.innerHTML = objs.map((o) => `<tr><td>${esc(o.name)}<span class="sub">${fmt(o.ca_ld, o.ca_ld < 10 ? 1 : 0)} Moon distances${o.diameter_km ? ' · ' + esc(sizeOf(o.diameter_km)) + ' wide' : ''}</span></td><td data-label="Closest">${when(o.ca_jd)}</td><td colspan="3" class="ask"><span class="sub" style="margin:0">set your location to see if it is up at night where you are</span></td><td class="empty"></td></tr>`).join('');
      tiles(objs.map((o) => ({ obj: o, visible: false }))); chart(null); $('#visCount').textContent = `${objs.length} worth looking for`;
      return;
    }
    if (recompute) { passes = passesFor(objs, p, jdFromMs(Date.now())); sel = passes.findIndex((x) => x.visible); if (sel < 0) sel = 0; }
    $('#visCount').textContent = `${passes.filter((x) => x.visible).length} up at night from here`;
    tb.innerHTML = passes.map((x, i) => {
      const o = x.obj, size = o.diameter_km ? ` · ${esc(sizeOf(o.diameter_km))} wide` : '';
      const name = o.neows_id ? `<a href="object.html?id=${o.neows_id}">${esc(o.name)}</a>` : esc(o.name);
      if (!x.visible) return `<tr class="dim" data-i="${i}" tabindex="0" aria-selected="${i === sel}"><td>${name}<span class="sub">${fmt(o.ca_ld, o.ca_ld < 10 ? 1 : 0)} Moon distances${size}</span></td><td data-label="Best moment">not from here</td><td colspan="2" data-label="Why"><span>${esc(x.reason)}</span></td><td data-label="You need">${needTag(x.need)}</td><td class="empty"></td></tr>`;
      return `<tr data-i="${i}" tabindex="0" aria-selected="${i === sel}"><td>${name}<span class="sub">${fmt(o.ca_ld, o.ca_ld < 10 ? 1 : 0)} Moon distances${size}</span></td><td data-label="Best moment">${when(x.best.jd)}</td><td data-label="Highest">${Math.round(x.top.alt)}° up, ${esc(compassWord(x.top.az))}</td><td data-label="Brightness">magnitude ${x.best.mag.toFixed(1)}</td><td data-label="You need">${needTag(x.need)}</td><td class="go"><a class="btn ghost small" href="${skyFinder(o.des)}">Find it ›</a></td></tr>`;
    }).join('');
    tiles(passes);
    chart(passes[sel] && passes[sel].visible ? passes[sel] : null);
  }

  // the night chart: altitude through the best night, darkness shaded
  function chart(x) {
    const svg = $('#visChart'), W = Math.max(280, Math.round(svg.parentElement.clientWidth - 2 || 380)), H = 190, m = { l: 34, r: 10, t: 14, b: 26 };
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    $('#visNightTitle').textContent = x ? `${x.obj.name} on its best night` : 'Its best night';
    if (!x) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-style="italic">${currentPlace() ? 'Pick a pass that is up at night from here.' : 'Set your location to see its night.'}</text>`;
      svg.setAttribute('aria-label', 'No pass chosen');
      return;
    }
    const pts = x.night.points, X = (jd) => m.l + (jd - x.night.from) / (x.night.to - x.night.from) * (W - m.l - m.r), Y = (a) => m.t + (90 - Math.max(-10, Math.min(90, a))) / 100 * (H - m.t - m.b);
    let shade = '';
    for (let i = 0; i + 1 < pts.length; i++) if (pts[i].dark) shade += `<rect x="${X(pts[i].jd).toFixed(1)}" y="${m.t}" width="${(X(pts[i + 1].jd) - X(pts[i].jd) + 0.6).toFixed(1)}" height="${H - m.t - m.b}" fill="#0F1520"></rect>`;
    // the whole line dotted, then the part above 10° solid
    const all = pts.map((q, i) => `${i ? 'L' : 'M'}${X(q.jd).toFixed(1)} ${Y(q.alt).toFixed(1)}`).join('');
    let solid = '';
    pts.forEach((q, i) => { if (q.alt >= 10) solid += `${solid && pts[i - 1] && pts[i - 1].alt >= 10 ? 'L' : 'M'}${X(q.jd).toFixed(1)} ${Y(q.alt).toFixed(1)}`; });
    const grid = [0, 30, 60, 90].map((a) => `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(a)}" y2="${Y(a)}" stroke="#2A3446"></line><text x="${m.l - 6}" y="${Y(a) + 4}" text-anchor="end">${a}°</text>`).join('');
    const ticks = [];
    for (let k = 0; k <= 4; k++) { const jd = x.night.from + k * 0.25; ticks.push(`<text x="${X(jd)}" y="${H - 8}" text-anchor="${k === 0 ? 'start' : k === 4 ? 'end' : 'middle'}">${timeOnly(jd)}</text>`); }
    const tx = X(x.top.jd), ty = Y(x.top.alt);
    svg.innerHTML = `<rect x="${m.l}" y="${m.t}" width="${W - m.l - m.r}" height="${H - m.t - m.b}" fill="#141B26"></rect>${shade}${grid}
      <path d="${all}" fill="none" stroke="#C0A062" stroke-width="1.5" stroke-dasharray="2 4"></path>
      <path d="${solid}" fill="none" stroke="#C0A062" stroke-width="2"></path>
      <circle cx="${tx}" cy="${ty}" r="4" fill="#E2C88E"></circle>
      <text x="${Math.min(tx + 8, W - m.r - 4)}" y="${Math.max(m.t + 12, ty - 8)}" text-anchor="${tx > W - 140 ? 'end' : 'start'}" class="hl">highest: ${Math.round(x.top.alt)}°, ${esc(compassWord(x.top.az))}, ${timeOnly(x.top.jd)}</text>${ticks.join('')}`;
    svg.setAttribute('aria-label', `${x.obj.name}: highest ${Math.round(x.top.alt)} degrees above the horizon, to the ${compassWord(x.top.az)}, at ${timeOnly(x.top.jd)}`);
  }

  async function load() {
    err = null; data = null; render();
    try {
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error(r.status);
      data = await r.json();
      $('#visSource').textContent = `Positions from NASA/JPL (close-approach data and Horizons), updated ${data.updated || "after the first daily run"}; brightness estimated from each asteroid's size and distance, so treat it as about ± 1 magnitude.`;
    } catch (e) { err = e; }
    render();
  }
  let rt = null;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (!root.hidden && passes[sel]) chart(passes[sel].visible ? passes[sel] : null); }, 150); });
  load();
  return { refresh: () => render() };
}
