'use strict';
/* ---------- layers (GIBS, EPSG:4326; checked against GetCapabilities Nov 9, 2026) ---------- */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/';
const LEVELS = { '250m': 8, '500m': 7, '1km': 6, '2km': 5 };
const BASES = [
  { id: 'truecolor', name: 'True colour', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', ext: 'jpg', set: '250m',
    since: 2000, sat: 'Terra', inst: 'MODIS camera', note: 'A normal photograph' },
  { id: 'night', name: 'Night lights', layer: 'VIIRS_NOAA20_DayNightBand', ext: 'png', set: '1km',
    since: 2018, sat: 'NOAA-20', inst: 'VIIRS day/night band', note: 'Cities, fires and moonlit cloud',
    legend: 'VIIRS_SNPP_DayNightBand_ENCC' },
  { id: 'sst', name: 'Sea temperature', layer: 'GHRSST_L4_MUR_Sea_Surface_Temperature', ext: 'png', set: '1km',
    since: 2002, sat: 'Several', inst: 'combined daily (MUR)', note: 'Ocean surface, °C', legend: 'GHRSST_Sea_Surface_Temperature', lag: 1 },
];
const OVERS = [
  { id: 'fires', name: 'Fires', layer: 'MODIS_Combined_Thermal_Anomalies_All', set: '1km', vector: true, since: 2002 },
  { id: 'snow', name: 'Snow', layer: 'MODIS_Terra_NDSI_Snow_Cover', ext: 'png', set: '500m', since: 2000, legend: 'MODIS_NDSI_Snow_Cover' },
  { id: 'clouds', name: 'Clouds', layer: 'MODIS_Terra_Cloud_Top_Temp_Day', ext: 'png', set: '2km', since: 2000, legend: 'MODIS_Cloud_Top_Temp', opacity: .75 },
  { id: 'smoke', name: 'Smoke and dust', layer: 'MODIS_Terra_Aerosol', ext: 'png', set: '2km', since: 2000, legend: 'MODIS_VIIRS_AOD', opacity: .8 },
  { id: 'ice', name: 'Sea ice', layer: 'GHRSST_L4_MUR_Sea_Ice_Concentration', ext: 'png', set: '1km', since: 2002, legend: 'GHRSST_Sea_Ice_Concentration', lag: 1 },
];

/* ---------- dates ---------- */
const DAY = 864e5;
const iso = t => new Date(t).toISOString().slice(0, 10);
const LATEST = iso(Date.now() - DAY);                     // the last full UTC day
const nice = s => new Date(s + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
let date = LATEST;
/* each layer's own newest day: the combined (MUR) layers arrive a day after the others.
   To do: read every layer's dates from GIBS instead of a fixed lag (see docs/ROADMAP.md). */
const dayFor = L => { const last = iso(Date.parse(LATEST) - (L.lag || 0) * DAY); return date > last ? last : date; };

/* ---------- map ---------- */
const proj = ol.proj.get('EPSG:4326');
function grid(set) {
  const res = []; for (let z = 0; z <= LEVELS[set]; z++) res.push(0.5625 / 2 ** z);
  return new ol.tilegrid.TileGrid({ origin: [-180, 90], extent: [-180, -90, 180, 90], resolutions: res, tileSize: 512 });
}
function rasterSource(L) {
  return new ol.source.XYZ({
    projection: proj, tileGrid: grid(L.set), crossOrigin: 'anonymous', transition: 150,
    tileUrlFunction: c => `${GIBS}${L.layer}/default/${dayFor(L)}/${L.set}/${c[0]}/${c[2]}/${c[1]}.${L.ext}`,
  });
}
/* fire dots grow as the map zooms in: 1.2 px for the whole world, up to 4 px close up */
const fireStyles = [1.2, 2, 3, 4].map(r => new ol.style.Style({ image: new ol.style.Circle({ radius: r,
  fill: new ol.style.Fill({ color: '#E8763A' }), stroke: r > 2 ? new ol.style.Stroke({ color: 'rgba(232,118,58,.35)', width: 3 }) : undefined }) }));
const fireStyle = (f, res) => fireStyles[res > .2 ? 0 : res > .05 ? 1 : res > .015 ? 2 : 3];
function vectorSource(L) {
  return new ol.source.VectorTile({
    projection: proj, tileGrid: grid(L.set), format: new ol.format.MVT(),
    tileUrlFunction: c => `${GIBS}${L.layer}/default/${dayFor(L)}/${L.set}/${c[0]}/${c[2]}/${c[1]}.mvt`,
  });
}
const layers = {};
for (const L of BASES) layers[L.id] = new ol.layer.Tile({ source: rasterSource(L), visible: L.id === 'truecolor' });
for (const L of OVERS) layers[L.id] = L.vector
  ? new ol.layer.VectorTile({ source: vectorSource(L), style: fireStyle, visible: false, declutter: false })
  : new ol.layer.Tile({ source: rasterSource(L), visible: false, opacity: L.opacity || 1 });

const popEl = document.createElement('div'); popEl.className = 'pop';
const popup = new ol.Overlay({ element: popEl, stopEvent: true });
const map = new ol.Map({
  target: 'map',
  layers: [...BASES.map(L => layers[L.id]), ...OVERS.map(L => layers[L.id])],
  overlays: [popup],
  controls: ol.control.defaults.defaults({ attribution: false, rotate: false }).extend([new ol.control.ScaleLine()]),
  view: new ol.View({ projection: proj, center: [-20, 55], zoom: 2, maxZoom: 10, extent: [-180, -90, 180, 90], smoothExtentConstraint: false }),   /* never shows past the poles or the date line */
});
function fillFrame() {          /* fills the frame with no empty bands; the edges of the world crop to fit */
  const [w, h] = map.getSize(); map.getView().setResolution(Math.min(360 / w, 180 / h)); map.getView().setCenter([0, 0]);
}
map.once('change:size', fillFrame); if (map.getSize()) fillFrame();

function refreshSources() {
  for (const L of [...BASES, ...OVERS]) layers[L.id].getSource().refresh();
}

/* ---------- layer pickers ---------- */
let base = 'truecolor'; const on = new Set();
const baseList = document.getElementById('baseList'), overList = document.getElementById('overList');
baseList.innerHTML = BASES.map(L => `<button role="radio" aria-checked="${L.id === base}" aria-pressed="${L.id === base}" data-id="${L.id}"><span class="mark"></span>${L.name}<span class="since">from ${L.since}</span></button>`).join('');
overList.innerHTML = OVERS.map(L => `<button aria-pressed="false" data-id="${L.id}"><span class="mark"></span>${L.name}<span class="since">from ${L.since}</span></button>`).join('');
baseList.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  base = b.dataset.id;
  for (const x of baseList.children) { const s = x.dataset.id === base; x.setAttribute('aria-pressed', s); x.setAttribute('aria-checked', s); }
  for (const L of BASES) layers[L.id].setVisible(L.id === base);
  update();
});
overList.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  const id = b.dataset.id, colour = !OVERS.find(L => L.id === id).vector;
  if (on.has(id)) on.delete(id);
  else {
    if (colour) for (const L of OVERS) if (!L.vector && on.has(L.id)) on.delete(L.id);   /* colour layers hide each other */
    on.add(id);
  }
  for (const x of overList.children) { const s = on.has(x.dataset.id); x.setAttribute('aria-pressed', s); layers[x.dataset.id].setVisible(s); }
  update();
});

/* ---------- tiles, legend, labels ---------- */
const $ = id => document.getElementById(id);
function update() {
  const B = BASES.find(L => L.id === base), O = OVERS.filter(L => on.has(L.id));
  $('tDate').textContent = nice(date);
  $('tBase').textContent = B.name; $('tBaseNote').textContent = B.note;
  $('tSat').textContent = B.sat; $('tSatNote').textContent = B.inst;
  $('tOver').textContent = O.length ? O.length + (O.length === 1 ? ' layer' : ' layers') : 'Nothing';
  $('tOverNote').textContent = O.length ? O.map(L => L.name).join(' · ') : 'Add fires, snow, clouds…';
  $('mapTag').innerHTML = `<strong>${nice(date)}</strong> · ${B.name}${O.length ? ' + ' + O.map(L => L.name.toLowerCase()).join(', ') : ''}`;
  const rows = [];
  if (B.legend) rows.push(`<div class="row"><span>${B.name}</span><img src="https://gibs.earthdata.nasa.gov/legends/${B.legend}_H.svg" alt="Colour key for ${B.name}"></div>`);
  for (const L of O) rows.push(L.vector
    ? `<div class="row"><span>${L.name}</span><span class="firekey"><i></i>A fire or other hot spot seen that day</span></div>`
    : `<div class="row"><span>${L.name}</span><img src="https://gibs.earthdata.nasa.gov/legends/${L.legend}_H.svg" alt="Colour key for ${L.name}"></div>`);
  $('legend').innerHTML = rows.join('');
  const behind = [B, ...O].filter(L => dayFor(L) !== date);
  $('mapSrc').textContent = (behind.length ? `${behind.map(L => L.name).join(' and ')}: newest day ${nice(dayFor(behind[0]))}, shown instead. ` : '') +
    `Imagery: NASA GIBS · ${[B, ...O].map(L => L.layer).join(', ')}`;
  $('dPick').value = date; $('dLatest').setAttribute('aria-pressed', date === LATEST);
  $('dNext').disabled = date >= LATEST;
  const from = Date.parse(LATEST) - 60 * DAY;
  $('sFrom').textContent = nice(iso(from)); $('sTo').textContent = 'Latest';
  $('sDay').value = Math.max(0, Math.round((Date.parse(date) - from) / DAY));
}
/* from the globe: open the Earth map on a place and day, with a layer on top */
function focusEarth(lat, lon, day, overlay) {
  show('earth');
  if (overlay && !on.has(overlay)) overList.querySelector(`[data-id="${overlay}"]`).click();
  setDate(day > LATEST ? LATEST : day);
  map.getView().animate({ center: [lon, lat], zoom: 6, duration: 600 });
}
function setDate(d) {
  if (d > LATEST) d = LATEST; if (d < '2000-02-24') d = '2000-02-24';
  if (d === date) return; date = d; refreshSources(); update();
}

$('dPick').max = LATEST; $('dPick').min = '2000-02-24';
$('dPick').addEventListener('change', e => e.target.value && setDate(e.target.value));
$('dPrev').addEventListener('click', () => setDate(iso(Date.parse(date) - DAY)));
$('dNext').addEventListener('click', () => setDate(iso(Date.parse(date) + DAY)));
$('dLatest').addEventListener('click', () => setDate(LATEST));
$('sDay').addEventListener('input', e => setDate(iso(Date.parse(LATEST) - (60 - +e.target.value) * DAY)));

/* play: one step per tick; waits for the map to finish drawing before the next day */
let timer = null;
function stop() { clearTimeout(timer); timer = null; $('play').textContent = '▶ Play'; $('play').setAttribute('aria-pressed', 'false'); }
function tick() {
  if (date >= LATEST) return stop();
  setDate(iso(Date.parse(date) + DAY));
  map.once('rendercomplete', () => { if (timer) timer = setTimeout(tick, +$('speed').value); });
}
$('play').addEventListener('click', () => {
  if (timer) return stop();
  if (date >= LATEST) setDate(iso(Date.parse(LATEST) - 30 * DAY));
  $('play').textContent = '❚❚ Pause'; $('play').setAttribute('aria-pressed', 'true');
  timer = setTimeout(tick, 50);
});

/* ---------- places: GeoNames towns of 10,000 people or more, every capital, and countries (data/places.json) ---------- */
let PLACES = null, COUNTRIES = [], placesLoading = null;
const regionName = (() => {
  try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return c => { try { return d.of(c) || c; } catch { return c; } }; }
  catch { return c => c; }
})();
function loadPlaces() {
  placesLoading ??= fetch('data/places.json').then(r => { if (!r.ok) throw new Error(r.status); return r.json(); }).then(rows => {
    PLACES = rows.map(([name, cc, lat, lon, cap]) => ({ name, cc, lat, lon, cap, f: fold(name) }));
    /* a country is found by name and shown around its capital */
    COUNTRIES = PLACES.filter(p => p.cap).map(p => { const name = regionName(p.cc); return { name, kind: 'Country', lat: p.lat, lon: p.lon, zoom: 4, f: fold(name) }; });
  }).catch(() => { placesLoading = null; throw new Error('places'); });
  return placesLoading;
}
const fmtLL = (lat, lon) => `${Math.abs(lat).toFixed(2)}° ${lat >= 0 ? 'N' : 'S'}, ${Math.abs(lon).toFixed(2)}° ${lon >= 0 ? 'E' : 'W'}`;
function parseLL(q) {
  const m = q.trim().match(/^(-?\d{1,2}(?:\.\d+)?)\s*°?\s*([NS])?[\s,]+(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([EW])?$/i);
  if (!m) return null;
  let lat = +m[1], lon = +m[3];
  if (m[2] && /s/i.test(m[2])) lat = -Math.abs(lat); if (m[4] && /w/i.test(m[4])) lon = -Math.abs(lon);
  return Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? [lat, lon] : null;
}
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fold = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const q = $('placeQ'), list = $('placeList'); let hits = [], sel = -1;
function suggest() {
  const s = q.value.trim(); hits = []; sel = -1;
  if (!s) { list.hidden = true; q.setAttribute('aria-expanded', 'false'); return; }
  if (!PLACES) {
    list.innerHTML = '<li aria-disabled="true"><span class="note">Loading the place list…</span></li>'; list.hidden = false;
    loadPlaces().then(suggest, () => { list.innerHTML = '<li aria-disabled="true"><span class="note">The place list could not be loaded. Coordinates still work.</span></li>'; });
  }
  const ll = parseLL(s);
  if (ll) hits.push({ name: fmtLL(ll[0], ll[1]), kind: 'Coordinates', lat: ll[0], lon: ll[1] });
  const f = fold(s), match = p => { const i = p.f.indexOf(f); return i === 0 || (i > 0 && p.f[i - 1] === ' ') ? i : -1; };
  if (PLACES && f.length >= 2) {
    for (const c of COUNTRIES) { const i = match(c); if (i >= 0) hits.push({ ...c, i, len: s.length }); if (hits.length >= 3) break; }
    for (const p of PLACES) {                     /* largest first, so the best-known town of a name comes first */
      const i = match(p); if (i < 0) continue;
      hits.push({ name: p.name, kind: regionName(p.cc) + (p.cap ? ' · capital' : ''), lat: p.lat, lon: p.lon, i, len: s.length });
      if (hits.length >= 8) break;
    }
  }
  if (!PLACES && !ll) return;
  list.innerHTML = hits.length ? hits.map((h, j) => `<li role="option" id="pl${j}" aria-selected="false" data-j="${j}"><span>${
    h.i != null ? esc(h.name.slice(0, h.i)) + '<mark>' + esc(h.name.slice(h.i, h.i + h.len)) + '</mark>' + esc(h.name.slice(h.i + h.len)) : esc(h.name)
  }</span><span class="k">${esc(h.kind)}</span></li>`).join('')
    : `<li aria-disabled="true"><span class="note">${f.length < 2 ? 'Keep typing…' : 'No town, country or coordinates match'}</span></li>`;
  list.hidden = false; q.setAttribute('aria-expanded', 'true');
}
function go(h) {
  list.hidden = true; q.setAttribute('aria-expanded', 'false'); q.value = h.kind === 'Coordinates' ? h.name : h.name;
  popup.setPosition(undefined);
  map.getView().animate({ center: [h.lon, h.lat], zoom: h.zoom || Math.max(map.getView().getZoom(), 6), duration: 700 },
    () => showPop([h.lon, h.lat], h.kind === 'Coordinates' ? nearest(h.lat, h.lon) : h.name));
}
q.addEventListener('input', suggest);
q.addEventListener('keydown', e => {
  if (list.hidden || !hits.length) { if (e.key === 'Enter') e.preventDefault(); return; }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
    [...list.children].forEach((li, j) => li.setAttribute('aria-selected', j === sel)); q.setAttribute('aria-activedescendant', 'pl' + sel);
  } else if (e.key === 'Enter') { e.preventDefault(); go(hits[Math.max(sel, 0)]); }
  else if (e.key === 'Escape') { list.hidden = true; q.setAttribute('aria-expanded', 'false'); }
});
list.addEventListener('mousedown', e => { const li = e.target.closest('li[data-j]'); if (li) { e.preventDefault(); go(hits[+li.dataset.j]); } });
q.addEventListener('blur', () => setTimeout(() => { list.hidden = true; q.setAttribute('aria-expanded', 'false'); }, 120));

/* ---------- tap the map ---------- */
/* the nearest town of 10,000 people or more within about 100 km (0.9°) */
function nearest(lat, lon) {
  if (!PLACES) return 'This spot';
  let best = null, bd = Infinity; const k = Math.cos(lat * Math.PI / 180);
  for (const p of PLACES) { const d = (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2; if (d < bd) { bd = d; best = p; } }
  return Math.sqrt(bd) < 0.9 ? 'Near ' + best.name : 'Open water or remote land';
}
function showPop(c, label) {
  const [lon, lat] = c, place = label.replace(/^Near /, '');
  const term = /^(Open water|This spot)/.test(label) ? '' : place;
  popEl.innerHTML = `<button class="x" aria-label="Close">×</button><div class="eyebrow">This spot</div><div class="where">${esc(label)}</div>
    <div class="ll">${fmtLL(lat, lon)}</div>${term ? `<button class="btn" data-q="${esc(term)}">NASA pictures of ${esc(term)}</button>` : ''}`;
  const px = map.getPixelFromCoordinate(c);
  popEl.classList.toggle('below', !px || px[1] < 190);       /* opens below the spot near the top of the map */
  const w = map.getSize()[0], room = 150;                    /* and slides inward near the sides */
  const x = !px ? 50 : px[0] < room ? 100 * Math.max(.08, px[0] / (2 * room)) : px[0] > w - room ? 100 - 100 * Math.max(.08, (w - px[0]) / (2 * room)) : 50;
  popEl.style.setProperty('--x', `-${x}%`); popEl.style.setProperty('--ax', `${x}%`);
  popup.setPosition(c);
}
popEl.addEventListener('click', e => {
  if (e.target.closest('.x')) popup.setPosition(undefined);
  const b = e.target.closest('[data-q]'); if (b) { $('libQ').value = b.dataset.q; show('library'); libSearch(); }
});
map.on('singleclick', e => {
  const c = e.coordinate;
  if (PLACES) showPop(c, nearest(c[1], c[0]));
  else loadPlaces().then(() => showPop(c, nearest(c[1], c[0])), () => showPop(c, 'This spot'));
});
map.on('pointermove', e => { if (e.dragging) return; $('cursor').hidden = false; $('cursor').textContent = fmtLL(e.coordinate[1], e.coordinate[0]); });
map.getViewport().addEventListener('mouseleave', () => { $('cursor').hidden = true; });

/* ---------- tabs ---------- */
function show(v) {
  for (const b of document.querySelectorAll('.tabs [data-view]')) { const s = b.dataset.view === v; b.setAttribute('aria-selected', s); b.setAttribute('aria-pressed', s); }
  $('view-earth').hidden = v !== 'earth'; $('view-library').hidden = v !== 'library'; $('view-globe').hidden = v !== 'globe';
  if (v === 'earth') map.updateSize(); else stop();
  document.dispatchEvent(new CustomEvent('viewchange', { detail: v }));
  window.scrollTo({ top: 0 });
}
document.querySelector('.tabs').addEventListener('click', e => { const b = e.target.closest('[data-view]'); if (b) show(b.dataset.view); });

/* ---------- picture library: live search of NASA's Image and Video Library ---------- */
const A = 'https://images-assets.nasa.gov/image/';
const PICS = [];                                   /* the results shown, as [id, title, date, centre, photographer, keywords, caption, type] */
const CENTRES = { JSC: 'Johnson Space Center', GSFC: 'Goddard Space Flight Center' };
/* a picture file can fail to load (seen Nov 9, 2026): try the next size, then show a plain panel */
const NEXT = { thumb: 'small', small: 'medium', medium: 'large', large: null };
function fallback(img) {
  const n = NEXT[img.dataset.try];
  if (n) { img.dataset.try = n; img.src = `${A}${img.dataset.id}/${img.dataset.id}~${n}.jpg`; }
  else if (img.id === 'vImg') { img.removeAttribute('src'); img.alt = 'Picture unavailable'; }
  else img.replaceWith(Object.assign(document.createElement('span'), { className: 'nopic', textContent: 'Picture unavailable' }));
}
document.addEventListener('error', e => { if (e.target.matches?.('img[data-try]')) fallback(e.target); }, true);
$('gallery').addEventListener('click', e => { const b = e.target.closest('.pic'); if (b) openViewer(PICS[+b.dataset.j]); });
$('vClose').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('click', e => { if (e.target === $('viewer')) $('viewer').close(); });
$('libClear').addEventListener('click', () => { $('libQ').value = ''; $('libQ').focus(); });
for (const c of document.querySelectorAll('.popular .chip')) c.addEventListener('click', () => { $('libQ').value = c.textContent; libSearch(); });

const API = 'https://images-api.nasa.gov/search';
async function search(params) {
  const u = new URL(API);
  for (const [k, v] of Object.entries(params)) if (v !== '' && v != null) u.searchParams.set(k, v);
  if (!u.searchParams.has('media_type')) u.searchParams.set('media_type', 'image');
  let r;
  try { r = await fetch(u); } catch { r = await fetch(u); }            /* one retry: an odd request fails to connect */
  if (!r.ok) throw new Error(String(r.status));
  const j = await r.json();
  return { total: j.collection.metadata.total_hits, list: j.collection.items.map(i => {
    const d = i.data[0];
    return [d.nasa_id, d.title || 'Untitled', (d.date_created || '').slice(0, 10), d.center || '', d.photographer || d.secondary_creator || '',
      (d.keywords || []).slice(0, 6), (d.description || '').replace(/\s+/g, ' ').trim(), d.media_type];
  }) };
}
function openViewer([id, t, d, c, p, k, s, type]) {
  $('vImg').dataset.id = id; $('vImg').dataset.try = 'medium'; $('vImg').src = `${A}${id}/${id}~medium.jpg`; $('vImg').alt = t;
  $('vTitle').textContent = t; $('vDesc').textContent = s;
  $('vFacts').innerHTML = (d ? `<dt>Date</dt><dd>${nice(d)}</dd>` : '') + (c ? `<dt>NASA centre</dt><dd>${CENTRES[c] || c} (${esc(c)})</dd>` : '') +
    (type === 'video' ? '<dt>Type</dt><dd>Video (the still is shown here)</dd>' : '') +
    (p ? `<dt>Photographer</dt><dd>${esc(p)}</dd>` : '') + `<dt>NASA ID</dt><dd class="mono">${esc(id)}</dd>`;
  $('vKw').innerHTML = k.map(x => `<span class="tag">${esc(x)}</span>`).join('');
  $('vFull').href = `${A}${id}/${id}~medium.jpg`;
  $('viewer').showModal();
}
Object.assign(CENTRES, { JPL: 'Jet Propulsion Laboratory', KSC: 'Kennedy Space Center', MSFC: 'Marshall Space Flight Center',
  HQ: 'NASA Headquarters', ARC: 'Ames Research Center', LARC: 'Langley Research Center', GRC: 'Glenn Research Center',
  AFRC: 'Armstrong Flight Research Center', SSC: 'Stennis Space Center' });

const lib = { page: 1, total: 0, busy: false };
const libSel = document.querySelectorAll('.libfilters select');
const typeChips = document.querySelectorAll('.libfilters .seg .chip');
function render(append, list) {
  const start = append ? PICS.length : 0;
  if (!append) PICS.length = 0;
  PICS.push(...list);
  const html = list.map((x, i) => `<button class="pic" data-j="${start + i}">
      <span class="ph"><img src="${A}${x[0]}/${x[0]}~thumb.jpg" data-id="${esc(x[0])}" data-try="thumb" alt="${esc(x[1])}" loading="lazy"></span>
      <span class="pt"><h3>${esc(x[1])}</h3><span class="meta">${x[2] ? nice(x[2]) : 'No date'} · ${esc(x[3] || 'NASA')}${x[7] === 'video' ? ' · Video' : ''}</span></span></button>`).join('');
  append ? $('gallery').insertAdjacentHTML('beforeend', html) : ($('gallery').innerHTML = html);
}
async function libSearch(append = false) {
  if (lib.busy) return;
  const q = $('libQ').value.trim();
  if (!q) { $('gallery').innerHTML = '<div class="state small" style="grid-column:1/-1">Type a place, a mission or a subject.</div>'; $('libCount').textContent = ''; return; }
  lib.busy = true; lib.page = append ? lib.page + 1 : 1;
  if (!append) { $('gallery').innerHTML = '<div class="state small" style="grid-column:1/-1">Searching NASA’s library…</div>'; $('libCount').textContent = ''; }
  const centre = libSel[0].value === 'Any' ? '' : libSel[0].value.split(' ')[0];
  const from = /^\d{4}$/.test(libSel[1].value) ? libSel[1].value : '', to = /^\d{4}$/.test(libSel[2].value) ? libSel[2].value : '';
  try {
    const r = await search({ q, center: centre, year_start: from, year_end: to, page: lib.page, page_size: 24,
      media_type: typeChips[1].getAttribute('aria-pressed') === 'true' ? 'image,video' : 'image' });
    lib.total = r.total;
    if (!append && !r.list.length) $('gallery').innerHTML = `<div class="state small" style="grid-column:1/-1">No pictures found for “${esc(q)}”. Try fewer words or another spelling.</div>`;
    else render(append, r.list);
    const shown = PICS.length, cap = Math.min(lib.total, 10000);
    $('libCount').textContent = lib.total ? `${lib.total.toLocaleString('en-GB')} found · showing ${shown}` : '';
    document.querySelector('.more').hidden = shown >= cap;
  } catch {
    if (!append) $('gallery').innerHTML = '<div class="state small" style="grid-column:1/-1">NASA’s library can’t be reached right now. Try again in a moment.</div>';
  }
  lib.busy = false;
}
$('libQ').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); libSearch(); } });
for (const s of libSel) s.addEventListener('change', () => libSearch());
typeChips.forEach((c, i) => c.addEventListener('click', () => { typeChips.forEach((x, j) => x.setAttribute('aria-pressed', i === j)); libSearch(); }));
document.querySelector('.more .btn').addEventListener('click', () => libSearch(true));

update();
