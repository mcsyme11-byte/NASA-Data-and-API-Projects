'use strict';
/* ---------- layers (GIBS; checked against the GetCapabilities documents Nov 9, 2026) ----------
   World view: EPSG:4326. Arctic (EPSG:3413) and Antarctic (EPSG:3031) views: `polar` gives the layer and tile set there,
   null where GIBS has no such layer in that view; `antarctic: false` where only the Arctic view has it. */
const GIBS = 'https://gibs.earthdata.nasa.gov/wmts/';
const BASES = [
  { id: 'truecolor', name: 'True colour', layer: 'MODIS_Terra_CorrectedReflectance_TrueColor', ext: 'jpg', set: '250m',
    since: 2000, sat: 'Terra', inst: 'MODIS camera', note: 'A normal photograph', polar: {} },
  { id: 'night', name: 'Night lights', layer: 'VIIRS_NOAA20_DayNightBand', ext: 'png', set: '1km',
    since: 2018, sat: 'NOAA-20', inst: 'VIIRS day/night band', note: 'Cities, fires and moonlit cloud',
    legend: 'VIIRS_SNPP_DayNightBand_ENCC', polar: {} },
  { id: 'sst', name: 'Sea temperature', layer: 'GHRSST_L4_MUR_Sea_Surface_Temperature', ext: 'png', set: '1km',
    since: 2002, sat: 'Several', inst: 'combined daily (MUR)', note: 'Ocean surface, °C', legend: 'GHRSST_Sea_Surface_Temperature', lag: 1, polar: null },
];
const OVERS = [
  { id: 'fires', name: 'Fires', layer: 'MODIS_Combined_Thermal_Anomalies_All', set: '1km', vector: true, since: 2002, polar: {}, antarctic: false },
  { id: 'snow', name: 'Snow', layer: 'MODIS_Terra_NDSI_Snow_Cover', ext: 'png', set: '500m', since: 2000, legend: 'MODIS_NDSI_Snow_Cover', polar: {} },
  { id: 'clouds', name: 'Clouds', layer: 'MODIS_Terra_Cloud_Top_Temp_Day', ext: 'png', set: '2km', since: 2000, legend: 'MODIS_Cloud_Top_Temp', opacity: .75, polar: { set: '1km', lag: 1 } },
  { id: 'smoke', name: 'Smoke and dust', layer: 'MODIS_Terra_Aerosol', ext: 'png', set: '2km', since: 2000, legend: 'MODIS_VIIRS_AOD', opacity: .8, polar: null },
  { id: 'ice', name: 'Sea ice', layer: 'GHRSST_L4_MUR_Sea_Ice_Concentration', ext: 'png', set: '1km', since: 2002, legend: 'GHRSST_Sea_Ice_Concentration', lag: 1,
    polar: { layer: 'MODIS_Terra_Sea_Ice', legend: null, key: ['#FF6464', 'Sea ice seen that day (daylight only)'], lag: 0, sat: 'Terra' } },
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

/* ---------- map: three views ---------- */
proj4.defs('EPSG:3413', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs');
ol.proj.proj4.register(proj4);
const H = 4194304;                                        /* half the width of GIBS's polar grids, metres */
for (const c of ['EPSG:3413', 'EPSG:3031']) ol.proj.get(c).setExtent([-H, -H, H, H]);
const VIEWS = {
  world: { code: 'EPSG:4326', gibs: 'epsg4326', name: 'World' },
  arctic: { code: 'EPSG:3413', gibs: 'epsg3413', name: 'Arctic', pole: 90 },
  antarctic: { code: 'EPSG:3031', gibs: 'epsg3031', name: 'Antarctic', pole: -90 },
};
let view = 'world';
const V = () => VIEWS[view], proj = () => ol.proj.get(V().code);
/* a layer as the current view offers it, or null */
function spec(L) {
  if (view === 'world') return L;
  if (!L.polar || (view === 'antarctic' && L.antarctic === false)) return null;
  return { ...L, ...L.polar };
}
const toLL = c => ol.proj.toLonLat(c, proj());                 /* map coordinate → [lon, lat] */
const fromLL = ll => ol.proj.fromLonLat(ll, proj());

/* GIBS tile grids. World (EPSG:4326): 512 px tiles from (-180°, 90°), 0.5625° a pixel at level 0.
   Polar: 512 px tiles from (-H, H), 8,192 m a pixel at level 0. Each level halves the pixel size. */
const DEEPEST = { world: { '250m': 8, '500m': 7, '1km': 6, '2km': 5 }, polar: { '250m': 5, '500m': 4, '1km': 3 } };
function grid(set) {
  const world = view === 'world', res = [], top = world ? 0.5625 : 8192;
  for (let z = 0; z <= DEEPEST[world ? 'world' : 'polar'][set]; z++) res.push(top / 2 ** z);
  return new ol.tilegrid.TileGrid(world
    ? { origin: [-180, 90], extent: [-180, -90, 180, 90], resolutions: res, tileSize: 512 }
    : { origin: [-H, H], extent: [-H, -H, H, H], resolutions: res, tileSize: 512 });
}
const tileUrl = (S, ext) => c => `${GIBS}${V().gibs}/best/${S.layer}/default/${dayFor(S)}/${S.set}/${c[0]}/${c[2]}/${c[1]}.${ext}`;
function rasterSource(S) {
  return new ol.source.XYZ({ projection: proj(), tileGrid: grid(S.set), crossOrigin: 'anonymous', transition: 150, tileUrlFunction: tileUrl(S, S.ext) });
}
function vectorSource(S) {
  return new ol.source.VectorTile({ projection: proj(), tileGrid: grid(S.set), format: new ol.format.MVT(), tileUrlFunction: tileUrl(S, 'mvt') });
}
/* fire dots grow as the map zooms in: 1.2 px for the whole world, up to 4 px close up (resolution in degrees a pixel) */
const fireStyles = [1.2, 2, 3, 4].map(r => new ol.style.Style({ image: new ol.style.Circle({ radius: r,
  fill: new ol.style.Fill({ color: '#E8763A' }), stroke: r > 2 ? new ol.style.Stroke({ color: 'rgba(232,118,58,.35)', width: 3 }) : undefined }) }));
const fireStyle = (f, res) => { const d = view === 'world' ? res : res / 111320; return fireStyles[d > .2 ? 0 : d > .05 ? 1 : d > .015 ? 2 : 3]; };

const layers = {};
for (const L of BASES) layers[L.id] = new ol.layer.Tile({ visible: false });
for (const L of OVERS) layers[L.id] = L.vector ? new ol.layer.VectorTile({ style: fireStyle, visible: false, declutter: false })
  : new ol.layer.Tile({ visible: false, opacity: L.opacity || 1 });
/* give every layer a source for the current view; the ones the view lacks stay hidden */
function buildSources() {
  for (const L of [...BASES, ...OVERS]) {
    const S = spec(L);
    layers[L.id].setSource(S ? (L.vector ? vectorSource(S) : rasterSource(S)) : null);
  }
}

const popEl = document.createElement('div'); popEl.className = 'pop';
const popup = new ol.Overlay({ element: popEl, stopEvent: true });
function makeView() {
  if (view === 'world') return new ol.View({ projection: proj(), center: [0, 0], zoom: 2, maxZoom: 10, extent: [-180, -90, 180, 90], smoothExtentConstraint: false });   /* never shows past the poles or the date line */
  return new ol.View({ projection: proj(), center: [0, 0], maxZoom: 8, extent: [-H, -H, H, H], smoothExtentConstraint: false });
}
buildSources();
const map = new ol.Map({
  target: 'map',
  layers: [...BASES.map(L => layers[L.id]), ...OVERS.map(L => layers[L.id])],
  overlays: [popup],
  controls: ol.control.defaults.defaults({ attribution: false, rotate: false }).extend([new ol.control.ScaleLine()]),
  view: makeView(),
});
function fillFrame() {          /* fills the frame with no empty bands; the edges of the world crop to fit */
  const size = map.getSize(); if (!size || !size[0]) return;
  const [w, h] = size;
  if (view === 'world') { map.getView().setResolution(Math.min(360 / w, 180 / h)); map.getView().setCenter([0, 0]); }
  else map.getView().fit([-H * 0.92, -H * 0.92, H * 0.92, H * 0.92], { size });     /* the pole to about 55° */
}
map.once('change:size', fillFrame); if (map.getSize()) fillFrame();

function refreshSources() {
  /* a new key makes OpenLayers fetch every tile again with the new date (refresh() alone kept the old tiles) */
  for (const L of [...BASES, ...OVERS]) { const s = layers[L.id].getSource(); if (s) s.setTileUrlFunction(s.getTileUrlFunction(), view + ' ' + date); }
}

/* ---------- layer pickers ---------- */
let base = 'truecolor'; const on = new Set();
const baseList = document.getElementById('baseList'), overList = document.getElementById('overList');
/* the pickers show what the current view offers; the rest are greyed out with a note */
function renderPickers() {
  const item = (L, pressed, radio) => {
    const ok = !!spec(L);
    return `<button ${radio ? `role="radio" aria-checked="${pressed}" ` : ''}aria-pressed="${pressed}" data-id="${L.id}"${ok ? '' : ' disabled'}
      ${ok ? '' : `title="Not available in the ${V().name} view"`}><span class="mark"></span>${L.name}<span class="since">${ok ? 'from ' + L.since : 'World view only'}</span></button>`;
  };
  baseList.innerHTML = BASES.map(L => item(L, L.id === base, true)).join('');
  overList.innerHTML = OVERS.map(L => item(L, on.has(L.id), false)).join('');
}
function showLayers() { for (const L of [...BASES, ...OVERS]) layers[L.id].setVisible(!!spec(L) && (L.id === base || on.has(L.id))); }
renderPickers(); showLayers();
baseList.addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  base = b.dataset.id;
  for (const x of baseList.children) { const s = x.dataset.id === base; x.setAttribute('aria-pressed', s); x.setAttribute('aria-checked', s); }
  showLayers();
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
  for (const x of overList.children) x.setAttribute('aria-pressed', on.has(x.dataset.id));
  showLayers();
  update();
});

/* ---------- tiles, legend, labels ---------- */
const $ = id => document.getElementById(id);
function update() {
  const B = spec(BASES.find(L => L.id === base)), O = OVERS.filter(L => on.has(L.id)).map(spec).filter(Boolean);
  $('tDate').textContent = nice(date);
  $('tBase').textContent = B.name; $('tBaseNote').textContent = B.note;
  $('tSat').textContent = B.sat; $('tSatNote').textContent = B.inst;
  $('tOver').textContent = O.length ? O.length + (O.length === 1 ? ' layer' : ' layers') : 'Nothing';
  $('tOverNote').textContent = O.length ? O.map(L => L.name).join(' · ') : 'Add fires, snow, clouds…';
  $('mapTag').innerHTML = `<strong>${nice(date)}</strong> · ${view === 'world' ? '' : V().name + ' · '}${B.name}${O.length ? ' + ' + O.map(L => L.name.toLowerCase()).join(', ') : ''}`;
  const rows = [];
  if (B.legend) rows.push(`<div class="row"><span>${B.name}</span><img src="https://gibs.earthdata.nasa.gov/legends/${B.legend}_H.svg" alt="Colour key for ${B.name}"></div>`);
  for (const L of O) rows.push(L.vector || L.key
    ? `<div class="row"><span>${L.name}</span><span class="firekey"><i${L.key ? ` style="background:${L.key[0]};box-shadow:none;border-radius:2px"` : ''}></i>${L.key ? L.key[1] : 'A fire or other hot spot seen that day'}</span></div>`
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
/* switch between the World, Arctic and Antarctic views */
function setView(v) {
  if (v === view) return;
  view = v; stop(); popup.setPosition(undefined); $('cursor').hidden = true;
  if (!spec(BASES.find(L => L.id === base))) base = 'truecolor';
  for (const id of [...on]) if (!spec(OVERS.find(L => L.id === id))) on.delete(id);
  buildSources(); map.setView(makeView()); fillFrame();
  renderPickers(); showLayers(); update();
  for (const b of document.querySelectorAll('[data-proj]')) b.setAttribute('aria-pressed', b.dataset.proj === view);
}
for (const b of document.querySelectorAll('[data-proj]')) b.addEventListener('click', () => setView(b.dataset.proj));
/* a place far from the pole on show goes back to the world view */
function viewFor(lat) {
  if (view === 'arctic' && lat < 40) setView('world');
  if (view === 'antarctic' && lat > -40) setView('world');
}
/* from the globe: open the Earth map on a place and day, with a layer on top */
function focusEarth(lat, lon, day, overlay) {
  show('earth');
  viewFor(lat);
  if (overlay && spec(OVERS.find(L => L.id === overlay)) && !on.has(overlay)) overList.querySelector(`[data-id="${overlay}"]`).click();
  setDate(day > LATEST ? LATEST : day);
  map.getView().animate({ center: fromLL([lon, lat]), zoom: view === 'world' ? 6 : 5, duration: 600 });
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

/* ---------- places: GeoNames towns of 10,000 people or more, every capital and countries (data/places.json), and
   Natural Earth's mountains, ranges, lakes, rivers, deserts, islands and seas (data/features.json) ---------- */
let PLACES = null, COUNTRIES = [], FEATURES = [], placesLoading = null;
const regionName = (() => {
  try { const d = new Intl.DisplayNames(['en'], { type: 'region' }); return c => { try { return d.of(c) || c; } catch { return c; } }; }
  catch { return c => c; }
})();
function loadPlaces() {
  const json = u => fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.json(); });
  placesLoading ??= Promise.all([json('data/places.json'), json('data/features.json').catch(() => [])]).then(([rows, feats]) => {
    /* features: [name, kind, lat, lon, importance (0 most), west, south, east, north] */
    FEATURES = feats.map(([name, kind, lat, lon, rank, w, s, e, n]) => ({ name, kind, lat, lon, rank, box: w != null ? [w, s, e, n] : null, f: fold(name) }));
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
    /* order: countries, then the best-known natural features, then towns (largest first), then other features */
    const towns = [], major = [], minor = [];
    for (const c of COUNTRIES) { const i = match(c); if (i >= 0) hits.push({ ...c, i, len: s.length }); if (hits.length >= 3) break; }
    for (const p of FEATURES) {                   /* most important first */
      const i = match(p); if (i < 0) continue;
      (p.rank <= 3 ? major : minor).push({ name: p.name, kind: p.kind, lat: p.lat, lon: p.lon, box: p.box, zoom: p.box ? null : 8, i, len: s.length });
      if (major.length + minor.length >= 8) break;
    }
    for (const p of PLACES) {                     /* largest first, so the best-known town of a name comes first */
      const i = match(p); if (i < 0) continue;
      towns.push({ name: p.name, kind: regionName(p.cc) + (p.cap ? ' · capital' : ''), lat: p.lat, lon: p.lon, i, len: s.length });
      if (towns.length >= 8) break;
    }
    hits.push(...major.slice(0, 3), ...towns, ...major.slice(3), ...minor);
    hits = hits.slice(0, 8);
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
  viewFor(h.lat);
  const at = fromLL([h.lon, h.lat]), done = () => showPop(at, h.kind === 'Coordinates' ? nearest(h.lat, h.lon) : h.name);
  if (h.box) {                                    /* a lake, range, river or sea: show all of it */
    const [w, s, e, n] = h.box, pad = Math.max(e - w, n - s) * 0.08 + 0.05;
    const box = ol.proj.transformExtent([w - pad, Math.max(s - pad, -89.9), e + pad, Math.min(n + pad, 89.9)], 'EPSG:4326', proj(), 16);
    map.getView().fit(box, { duration: 700, maxZoom: view === 'world' ? 8 : 6, padding: [40, 40, 40, 40], callback: done });
  } else map.getView().animate({ center: at, zoom: h.zoom || Math.max(map.getView().getZoom(), view === 'world' ? 6 : 4), duration: 700 }, done);
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
  const [lon, lat] = toLL(c), place = label.replace(/^Near /, '');
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
  const c = e.coordinate, [lon, lat] = toLL(c);
  if (PLACES) showPop(c, nearest(lat, lon));
  else loadPlaces().then(() => showPop(c, nearest(lat, lon)), () => showPop(c, 'This spot'));
});
map.on('pointermove', e => { if (e.dragging) return; const [lon, lat] = toLL(e.coordinate); $('cursor').hidden = false; $('cursor').textContent = fmtLL(lat, lon); });
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
/* a video's files live under video/, with the same names: ~thumb.jpg, ~medium.jpg and ~mobile.mp4, ~small.mp4 … */
const assets = type => 'https://images-assets.nasa.gov/' + (type === 'video' ? 'video/' : 'image/');
const PICS = [];                                   /* the results shown, as [id, title, date, centre, photographer, keywords, caption, type] */
const CENTRES = { JSC: 'Johnson Space Center', GSFC: 'Goddard Space Flight Center' };
/* a picture file can fail to load (seen Nov 9, 2026): try the next size, then show a plain panel */
const NEXT = { thumb: 'small', small: 'medium', medium: 'large', large: null };
function fallback(img) {
  const n = NEXT[img.dataset.try];
  if (n) { img.dataset.try = n; img.src = `${img.dataset.base || A}${img.dataset.id}/${img.dataset.id}~${n}.jpg`; }
  else if (img.id === 'vImg') { img.removeAttribute('src'); img.alt = 'Picture unavailable'; }
  else img.replaceWith(Object.assign(document.createElement('span'), { className: 'nopic', textContent: 'Picture unavailable' }));
}
document.addEventListener('error', e => { if (e.target.matches?.('img[data-try]')) fallback(e.target); }, true);
$('gallery').addEventListener('click', e => { const b = e.target.closest('.pic'); if (b) openViewer(PICS[+b.dataset.j]); });
$('vClose').addEventListener('click', () => $('viewer').close());
$('viewer').addEventListener('click', e => { if (e.target === $('viewer')) $('viewer').close(); });
$('libClear').addEventListener('click', () => { $('libQ').value = ''; closeLib(); libSearch(); $('libQ').focus(); });
for (const c of document.querySelectorAll('.popular .chip')) c.addEventListener('click', () => { $('libQ').value = c.textContent; closeLib(); libSearch(false, { exact: true }); });

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
/* the video sizes to play, smallest first; the largest becomes the "full size" link */
const PLAY = ['~mobile.mp4', '~small.mp4', '~preview.mp4', '~medium.mp4', '~large.mp4', '~orig.mp4'];
/* a sky object named in a picture's title or keywords, to find on the globe: the best-known, then the longest name */
function skyIn(text) {
  const f = ' ' + fold(text).replace(/[^a-z0-9]+/g, ' ') + ' ', m = f.match(/ messier (\d{1,3}) /);
  let best = m ? SKY.find(s => s.id === 'M' + m[1]) : null;
  for (const s of SKY) if (s.f.length >= 5 && f.includes(' ' + s.f.replace(/[^a-z0-9]+/g, ' ') + ' ') &&
    (!best || s.famous > best.famous || (s.famous === best.famous && s.f.length > best.f.length))) best = s;
  return best;
}
function openViewer(x) {
  const [id, t, d, c, p, k, s, type] = x, base = assets(type), img = $('vImg'), vid = $('vVid'), video = type === 'video';
  img.hidden = video; vid.hidden = !video; vid.pause(); vid.removeAttribute('src'); vid.load();
  img.dataset.id = id; img.dataset.base = base; img.dataset.try = 'medium'; img.alt = t;
  if (!video) img.src = `${base}${id}/${id}~medium.jpg`;
  $('vTitle').textContent = t; $('vDesc').textContent = s;
  $('vFacts').innerHTML = (d ? `<dt>Date</dt><dd>${nice(d)}</dd>` : '') + (c ? `<dt>NASA centre</dt><dd>${CENTRES[c] || c} (${esc(c)})</dd>` : '') +
    (video ? '<dt>Type</dt><dd>Video</dd>' : '') +
    (p ? `<dt>Photographer</dt><dd>${esc(p)}</dd>` : '') + `<dt>NASA ID</dt><dd class="mono">${esc(id)}</dd>`;
  $('vKw').innerHTML = k.map(x => `<span class="tag">${esc(x)}</span>`).join('');
  $('vFull').href = `${base}${id}/${id}~medium.jpg`;
  $('vFull').textContent = video ? 'Open the full-size video' : 'Open large size';
  $('vNote').hidden = !video; $('vNote').textContent = video ? 'Finding the video…' : '';
  if (video) {
    vid.poster = `${base}${id}/${id}~medium.jpg`;
    /* NASA lists each video's files; play the smallest, link the largest */
    fetch('https://images-api.nasa.gov/asset/' + encodeURIComponent(id)).then(r => r.json()).then(j => {
      const files = j.collection.items.map(x => x.href.replace(/^http:/, 'https:')), has = suffix => files.find(f => f.endsWith(suffix));
      const play = PLAY.map(has).find(Boolean), full = [...PLAY].reverse().map(has).find(Boolean);
      if (!play) { $('vNote').textContent = 'NASA lists no playable file for this video.'; return; }
      vid.src = play; $('vFull').href = full;
      $('vNote').textContent = 'Plays the smallest version NASA offers; the full-size file can be several gigabytes.';
    }).catch(() => { $('vNote').textContent = 'NASA\u2019s library can\u2019t be reached right now, so the video can\u2019t be played.'; });
  }
  $('vKind').textContent = (x.score < 0 ? 'Behind the scenes · ' : '') + (video ? 'Video' : 'Picture');
  const sky = window.focusSky && skyIn(t + ' ' + k.join(' '));
  $('vSky').hidden = !sky;
  if (sky) { $('vSky').dataset.id = sky.id; $('vSky').textContent = `See ${sky.name} in the sky`; }
  $('viewer').showModal();
  $('viewer').querySelector('.vbody').scrollTop = 0;
}
$('vSky').addEventListener('click', () => { $('viewer').close(); show('globe'); window.focusSky($('vSky').dataset.id); });
$('viewer').addEventListener('close', () => $('vVid').pause());
Object.assign(CENTRES, { JPL: 'Jet Propulsion Laboratory', KSC: 'Kennedy Space Center', MSFC: 'Marshall Space Flight Center',
  HQ: 'NASA Headquarters', ARC: 'Ames Research Center', LARC: 'Langley Research Center', GRC: 'Glenn Research Center',
  AFRC: 'Armstrong Flight Research Center', SSC: 'Stennis Space Center' });

/* ---------- ranking: pictures taken in space or of space first; launches, people, events and illustrations behind the scenes ----------
 * Decided Nov 9, 2026. NASA's library holds far more pictures of people, rockets and events than of space, and its own order
 * puts them first. Each result gets a score from what NASA records with it; 0 or more goes in the main results, below 0
 * goes under "Behind the scenes". The weights were tuned by hand on searches for Hubble, Saturn, Voyager, Cassini and Iceland. */
const ART = /\b(artist'?s?|illustrations?|concepts?|animation|logos?|posters?|renderings?|infographic)\b/;
const SCI = /\b(nebulae?|galax(?:y|ies)|clusters?|supernovae?|planets?|exoplanets?|mercury|venus|mars|martian|jupiter|jovian|saturn|uranus|neptune|pluto|charon|moons?|lunar|craters?|comets?|asteroids?|sun|solar|corona|flares?|auroras?|aurorae|eclipse|earthrise|deep field|stars?|stellar|black hole|quasars?|rings?|surface|terrain|dunes?|mosaic|panorama|infrared|x-ray|ultraviolet|true colou?r|false colou?r|hurricane|cyclone|typhoon|volcano|wildfires?|glaciers?|ice sheet|earth observations?|from orbit|night lights|city lights)\b/g;
const PPL = /\b(launch(?:es|ed|ing)?|liftoff|lifts? off|rollout|rolls? out|press|media|reporters|invit\w*|briefings?|conferences?|ceremony|visits?|visitors|tours?|training|trains|portraits?|awards?|employees|students|interns|events?|panel|meeting|speaks|speech|administrator|deputy|director|reception|celebrat\w*|team|engineers?|technicians?|workers|prepar\w*|hangar|clean ?room|launch pad|stacking|stacked|transport\w*|arrives?|arrival|mock-?up|test stand|hearing|congress\w*|signing|workshop|exhibit\w*|outreach)\b/g;
function scoreOf(x) {
  const [id, title, , centre, photographer, keywords] = x, text = (title + ' ' + keywords.join(' ')).toLowerCase();
  let s = 0;
  if (/^PIA\d/i.test(id)) s += 2;                                   /* NASA's Planetary Photojournal */
  if (/^STScI/i.test(centre)) s += 3;                               /* the Hubble and Webb science institute */
  if (/^(AS\d+-|iss\d+e)/i.test(id)) s += 3;                        /* frames from Apollo and the Space Station */
  if (/^(NHQ|KSC|jsc)/i.test(id)) s -= 3;                           /* headquarters, Kennedy and Johnson event photography */
  if (/^NASA\//i.test(photographer)) s -= 1;                        /* a staff photographer's credit */
  s += Math.min(4, (text.match(SCI) || []).length);
  s -= 1.2 * (text.match(PPL) || []).length;
  if (ART.test(text)) s -= 4;
  return s;
}
/* a mission button searches several phrasings and merges them; one word alone finds mostly launches and people */
const PRESETS = {
  'apollo 11': ['apollo 11 lunar surface', 'apollo 11 earth', 'apollo 11'],
  'hubble': ['hubble'],
  'james webb': ['webb nebula', 'webb galaxy image', 'webb nircam image', 'james webb'],
  'artemis': ['artemis ii earth moon', 'artemis i orion earth', 'orion earth moon', 'artemis'],
  'space station': ['space station earth observation', 'iss crew earth observations', 'international space station'],
  'voyager': ['voyager'],
  'mars rovers': ['perseverance mastcam', 'curiosity mars surface', 'mars rover'],
  'juno': ['junocam', 'juno jupiter'], 'new horizons': ['new horizons pluto'], 'hirise': ['hirise mars'],
  'chandra': ['chandra x-ray'], 'solar dynamics observatory': ['solar dynamics observatory sun'], 'galileo': ['galileo jupiter'],
  'apollo 8': ['apollo 8 earthrise', 'apollo 8']
};
PRESETS.webb = PRESETS['james webb']; PRESETS.iss = PRESETS['space station']; PRESETS['international space station'] = PRESETS['space station'];

/* ---------- spelling: the names the suggestions and corrections are drawn from ---------- */
const MISSIONS = ['Mercury', 'Gemini', 'Apollo 1', 'Apollo 7', 'Apollo 8', 'Apollo 9', 'Apollo 10', 'Apollo 11', 'Apollo 12', 'Apollo 13',
  'Apollo 14', 'Apollo 15', 'Apollo 16', 'Apollo 17', 'Apollo-Soyuz', 'Skylab', 'Space Shuttle', 'Columbia', 'Challenger', 'Discovery',
  'Atlantis', 'Endeavour', 'Enterprise', 'Space Station', 'International Space Station', 'Artemis', 'Artemis I', 'Artemis II', 'Artemis III',
  'Orion', 'Space Launch System', 'Saturn V', 'Gateway', 'Commercial Crew', 'Crew Dragon', 'Starliner', 'Cygnus', 'Hubble',
  'Hubble Space Telescope', 'James Webb', 'James Webb Space Telescope', 'Chandra', 'Spitzer', 'Compton', 'Kepler', 'TESS', 'Fermi', 'Swift',
  'WISE', 'NEOWISE', 'NuSTAR', 'IXPE', 'Roman Space Telescope', 'SOFIA', 'GALEX', 'COBE', 'WMAP', 'Voyager', 'Voyager 1', 'Voyager 2',
  'Pioneer', 'Pioneer 10', 'Pioneer 11', 'Mariner', 'Mariner 4', 'Mariner 9', 'Mariner 10', 'Viking', 'Viking 1', 'Viking 2', 'Galileo',
  'Cassini', 'Huygens', 'Juno', 'New Horizons', 'Messenger', 'Magellan', 'Ulysses', 'Dawn', 'Stardust', 'Deep Impact', 'Genesis',
  'OSIRIS-REx', 'Lucy', 'Psyche', 'DART', 'Europa Clipper', 'Dragonfly', 'Parker Solar Probe', 'Solar Dynamics Observatory', 'SOHO',
  'STEREO', 'TRACE', 'Hinode', 'IRIS', 'Solar Orbiter', 'Mars Pathfinder', 'Sojourner', 'Spirit', 'Opportunity', 'Curiosity',
  'Perseverance', 'Ingenuity', 'Phoenix', 'InSight', 'MAVEN', 'Mars Odyssey', 'Mars Global Surveyor', 'Mars Reconnaissance Orbiter',
  'HiRISE', 'Mars Express', 'Lunar Reconnaissance Orbiter', 'LCROSS', 'GRAIL', 'LADEE', 'Lunar Orbiter', 'Surveyor', 'Ranger',
  'Clementine', 'Lunar Prospector', 'Landsat', 'Terra', 'Aqua', 'Aura', 'Suomi NPP', 'NOAA-20', 'GOES', 'GPM', 'ICESat-2', 'GRACE',
  'SMAP', 'SWOT', 'PACE', 'TEMPO', 'CALIPSO', 'CloudSat', 'Jason-3', 'Sentinel-6', 'Earth Observatory', 'MODIS', 'VIIRS', 'X-15',
  'Gravity Probe B', 'Mars rovers', 'Mars Sample Return', 'Ares', 'Juno Jupiter', 'JunoCam', 'Mastcam'];
const WORDS = ['nebula', 'galaxy', 'galaxies', 'star cluster', 'supernova', 'black hole', 'exoplanet', 'planet', 'Sun', 'Moon', 'Earth',
  'Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune', 'Pluto', 'Charon', 'Titan', 'Europa', 'Enceladus', 'Io',
  'Ganymede', 'Callisto', 'Phobos', 'Deimos', 'Ceres', 'Vesta', 'Bennu', 'comet', 'asteroid', 'meteor', 'aurora', 'eclipse',
  'solar flare', 'sunspot', 'earthrise', 'astronaut', 'spacewalk', 'rocket', 'launch', 'telescope', 'satellite', 'rover', 'lander',
  'crater', 'volcano', 'hurricane', 'typhoon', 'cyclone', 'wildfire', 'glacier', 'iceberg', 'sea ice', 'desert', 'river', 'delta',
  'island', 'city lights', 'night lights', 'deep field', 'infrared', 'x-ray', 'ultraviolet', 'Milky Way', 'Andromeda', 'Orion Nebula'];
let SKY = [], skyLoading = null, VOCAB = null, vocabLoading = null, KNOWN = null;
function loadSky() {
  skyLoading ??= fetch('data/sky.json').then(r => r.json()).then(rows => {
    SKY = rows.map(([id, name, , type, , , , , famous]) => ({ id, name, type, famous: !!famous, f: fold(name) }));
  }).catch(() => { skyLoading = null; });
  return skyLoading;
}
function loadVocab() {
  vocabLoading ??= Promise.all([loadPlaces().catch(() => {}), loadSky()]).then(() => {
    const v = [], seen = new Set(), add = (name, kind, rank, fz = true) => { const f = fold(name); if (!seen.has(f)) { seen.add(f); v.push({ name, kind, rank, f, fz }); } };
    MISSIONS.forEach(m => add(m, 'Mission', 0));
    WORDS.forEach(w => add(w, 'Subject', 1));
    SKY.forEach(s => add(s.name, s.type, s.famous ? 1 : 3));
    COUNTRIES.forEach(c => add(c.name, 'Country', 2));
    FEATURES.forEach(p => add(p.name, p.kind, p.rank <= 3 ? 2 : 4));
    (PLACES || []).forEach((p, i) => add(p.name, regionName(p.cc), 3, i < 3000));   /* largest first; spelling help for the 3,000 largest */
    VOCAB = v;
    KNOWN = new Set(v.flatMap(x => x.f.split(/[\s-]+/)));
  });
  return vocabLoading;
}
/* optimal string alignment distance (Damerau-Levenshtein, where a swapped pair of letters counts as one mistake);
   gives up early once every route is past max */
function osa(a, b, max) {
  const m = a.length, n = b.length; if (Math.abs(m - n) > max) return max + 1;
  let pp = null, p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i]; let low = i;
    for (let j = 1; j <= n; j++) {
      let d = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d = Math.min(d, pp[j - 2] + 1);
      c[j] = d; if (d < low) low = d;
    }
    if (low > max) return max + 1;
    pp = p; p = c;
  }
  return p[n];
}
const allowed = f => f.length <= 5 ? 1 : 2;                         /* mistakes allowed: 1 up to 5 letters, 2 for longer */
const wordStart = (f, s) => { const i = f.indexOf(s); return i === 0 || (i > 0 && f[i - 1] === ' ') ? i : -1; };
/* the start of a name, misspelt: compare with the name's first letters, one shorter, as long and one longer */
function prefixDist(s, f, max) {
  let best = max + 1;
  for (const L of [s.length - 1, s.length, s.length + 1]) if (L > 0 && L <= f.length) best = Math.min(best, osa(s, f.slice(0, L), max));
  return best;
}
function libSuggestions(s) {
  const f = fold(s), exact = [], near = [], max = allowed(f);
  for (const v of VOCAB) {
    const i = wordStart(v.f, f);
    if (i >= 0) { if (exact.length < 400) exact.push({ ...v, i, len: s.length }); }
    else if (v.fz && f.length >= 4 && v.f.length >= f.length - 1) { const d = prefixDist(f, v.f, max); if (d <= max) near.push({ ...v, d }); }
  }
  exact.sort((a, b) => (a.i > 0) - (b.i > 0) || a.rank - b.rank);
  near.sort((a, b) => a.d - b.d || a.rank - b.rank);
  return [...exact.slice(0, 8), ...near].slice(0, 8);
}
/* the corrected search for a misspelt one: the whole phrase if it is close to a known name, otherwise word by word */
function correction(s) {
  if (!VOCAB) return null;
  const f = fold(s); let best = null, bd = allowed(f) + 1;
  for (const v of VOCAB) { if (!v.fz) continue; const d = osa(f, v.f, allowed(f)); if (d < bd || (d === bd && best && v.rank < best.rank)) { bd = d; best = v; } }
  if (best && bd > 0 && bd <= allowed(f)) return best.name;
  const words = f.split(/\s+/); let changed = false;
  const fixed = words.map(w => {
    if (w.length < 4 || KNOWN.has(w)) return w;
    let b = null, d0 = allowed(w) + 1;
    for (const k of KNOWN) { if (Math.abs(k.length - w.length) > 2) continue; const d = osa(w, k, allowed(w)); if (d < d0) { d0 = d; b = k; } }
    if (b) { changed = true; return b; } return w;
  });
  return changed ? fixed.join(' ') : null;
}

/* ---------- the search box: suggestions as you type, results from 3 letters ---------- */
const lq = $('libQ'), ll = $('libList'); let lhits = [], lsel = -1, typeTimer = null;
function closeLib() { ll.hidden = true; lq.setAttribute('aria-expanded', 'false'); lq.removeAttribute('aria-activedescendant'); }
function libSuggest() {
  const s = lq.value.trim(); lhits = []; lsel = -1;
  if (fold(s).length < 2) return closeLib();
  if (!VOCAB) { loadVocab().then(() => { if (document.activeElement === lq) libSuggest(); }); return; }
  lhits = libSuggestions(s);
  if (!lhits.length) return closeLib();
  ll.innerHTML = lhits.map((h, j) => `<li role="option" id="ll${j}" aria-selected="false" data-j="${j}"><span>${
    h.i != null ? esc(h.name.slice(0, h.i)) + '<mark>' + esc(h.name.slice(h.i, h.i + h.len)) + '</mark>' + esc(h.name.slice(h.i + h.len)) : esc(h.name)
  }</span><span class="k">${esc(h.kind)}</span></li>`).join('');
  ll.hidden = false; lq.setAttribute('aria-expanded', 'true');
}
function pickLib(h) { closeLib(); clearTimeout(typeTimer); lq.value = h.name; libSearch(false, { exact: true }); }
lq.addEventListener('focus', () => { loadVocab(); loadSky(); });
lq.addEventListener('input', () => {
  libSuggest(); clearTimeout(typeTimer);
  const s = lq.value.trim();
  if (s.length >= 3) typeTimer = setTimeout(() => libSearch(), 350); else if (!s) libSearch();
});
lq.addEventListener('keydown', e => {
  if (e.key === 'Enter') { e.preventDefault(); clearTimeout(typeTimer); if (!ll.hidden && lsel >= 0) pickLib(lhits[lsel]); else { closeLib(); libSearch(); } return; }
  if (ll.hidden || !lhits.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); lsel = (lsel + (e.key === 'ArrowDown' ? 1 : -1) + lhits.length) % lhits.length;
    [...ll.children].forEach((li, j) => li.setAttribute('aria-selected', j === lsel)); lq.setAttribute('aria-activedescendant', 'll' + lsel);
  } else if (e.key === 'Escape') { e.preventDefault(); closeLib(); }     /* closes the list; the words stay */
});
ll.addEventListener('mousedown', e => { const li = e.target.closest('li[data-j]'); if (li) { e.preventDefault(); pickLib(lhits[+li.dataset.j]); } });
lq.addEventListener('blur', () => setTimeout(closeLib, 120));
$('libFix').addEventListener('click', e => { if (e.target.closest('button')) libSearch(false, { exact: true }); });

/* ---------- results ---------- */
const lib = { page: 1, q: '', totals: [], size: 24, busy: false, seq: 0 };
const libSel = document.querySelectorAll('.libfilters select');
const typeChips = document.querySelectorAll('.libfilters .seg .chip');
const cache = new Map();                           /* the same request is asked once per visit */
function cached(params) {
  const k = JSON.stringify(params);
  if (!cache.has(k)) cache.set(k, search(params).catch(e => { cache.delete(k); throw e; }));
  return cache.get(k);
}
function filters() {
  const centre = (libSel[0].value || '').split(' ')[0];
  const from = /^\d{4}$/.test(libSel[1].value) ? libSel[1].value : '', to = /^\d{4}$/.test(libSel[2].value) ? libSel[2].value : '';
  return { center: centre, year_start: from, year_end: to,
    media_type: ['image', 'image,video', 'video'][[...typeChips].findIndex(c => c.getAttribute('aria-pressed') === 'true')] || 'image' };
}
/* one page of a search: a mission's several phrasings are asked together, merged, and sorted by score */
async function runSearch(q, page, totals) {
  const terms = PRESETS[fold(q)] || [q], size = terms.length > 1 ? 18 : 24, f = filters();
  const ask = terms.map((t, i) => totals && (page - 1) * size >= Math.min(totals[i] ?? Infinity, 10000) ? null : cached({ q: t, ...f, page, page_size: size }));
  const got = await Promise.all(ask.map(p => p || Promise.resolve({ total: totals?.[0] ?? 0, list: [], skip: true })));
  const ids = new Set(page > 1 ? PICS.map(x => x[0]) : []), list = [];
  got.forEach(r => r.list.forEach(x => { if (!ids.has(x[0])) { ids.add(x[0]); x.score = scoreOf(x); x.n = list.length; list.push(x); } }));
  list.sort((a, b) => Math.min(b.score, 4) - Math.min(a.score, 4) || a.n - b.n);
  return { list, size, totals: got.map((r, i) => r.skip ? totals[i] : r.total), total: Math.max(0, ...got.map(r => r.skip ? 0 : r.total)) };
}
const card = (x, j) => `<button class="pic${x[7] === 'video' ? ' video' : ''}" data-j="${j}">
      <span class="ph"><img src="${assets(x[7])}${x[0]}/${x[0]}~thumb.jpg" data-id="${esc(x[0])}" data-base="${assets(x[7])}" data-try="thumb" alt="${esc(x[1])}" loading="lazy"></span>
      <span class="pt"><h3>${esc(x[1])}</h3><span class="meta">${x[2] ? nice(x[2]) : 'No date'} · ${esc(x[3] || 'NASA')}${x[7] === 'video' ? ' · Video' : ''}</span></span></button>`;
const say = (el, text) => { el.innerHTML = `<div class="state small" style="grid-column:1/-1">${text}</div>`; };
function render(append, list) {
  if (!append) { PICS.length = 0; $('gallery').innerHTML = ''; $('gallery2').innerHTML = ''; }
  $('gallery').querySelector('.state')?.remove();
  const start = PICS.length, main = [], back = [];
  PICS.push(...list);
  list.forEach((x, i) => (x.score >= 0 ? main : back).push(card(x, start + i)));
  $('gallery').insertAdjacentHTML('beforeend', main.join('')); $('gallery2').insertAdjacentHTML('beforeend', back.join(''));
}
function setBts(open) {
  $('btsToggle').setAttribute('aria-expanded', open); $('gallery2').hidden = !open;
}
function resetLib(text) {
  PICS.length = 0; say($('gallery'), text); $('gallery2').innerHTML = ''; $('bts').hidden = true; setBts(false);
  $('libCount').textContent = ''; $('libFix').hidden = true; document.querySelector('.more').hidden = true;
}
async function libSearch(append = false, opt = {}) {
  const typed = lq.value.trim();
  if (append && lib.busy) return;
  const my = ++lib.seq;
  if (!typed) { resetLib('Type a mission, a planet, a galaxy or a place, or pick a mission. Results appear as you type.'); return; }
  lib.busy = true;
  const page = append ? lib.page + 1 : 1, q = append ? lib.q : typed;
  if (!append) { $('libCount').textContent = 'Searching NASA’s library…'; if (!PICS.length) say($('gallery'), 'Searching NASA’s library…'); }
  try {
    let r = await runSearch(q, page, append ? lib.totals : null), used = q, fixed = false;
    if (my !== lib.seq) return;
    if (!append && !opt.exact && r.total < 3) {                  /* few or no results: try the nearest known spelling */
      await loadVocab();
      const c = correction(typed);
      if (c && fold(c) !== fold(typed)) {
        const r2 = await runSearch(c, 1, null);
        if (my !== lib.seq) return;
        if (r2.total > r.total) { r = r2; used = c; fixed = true; }
      }
    }
    lib.q = used; lib.page = page; lib.totals = r.totals; lib.size = r.size;
    if (!append && fixed) {
      $('libFix').innerHTML = `Showing results for <b>${esc(used)}</b> · <button type="button">search for “${esc(typed)}” instead</button>`;
      $('libFix').hidden = false;
    } else if (!append) $('libFix').hidden = true;
    render(append, r.list);
    const main = $('gallery').querySelectorAll('.pic').length, back = $('gallery2').querySelectorAll('.pic').length;
    if (!append && !r.list.length) say($('gallery'), `Nothing found for “${esc(typed)}”. Try fewer words, another spelling, or pictures and videos.`);
    else if (!main) say($('gallery'), 'Only behind-the-scenes pictures match so far. They are shown below; Show more looks further.');
    $('bts').hidden = !back; $('btsToggle').textContent = `Behind the scenes (${back})`;
    if (!append) setBts(!main && back > 0);
    const total = r.total;
    $('libCount').textContent = total ? `${total.toLocaleString('en-GB')} found · ${main} shown${back ? ` · ${back} behind the scenes` : ''}` : '';
    document.querySelector('.more').hidden = !r.totals.some(t => page * r.size < Math.min(t, 10000));
  } catch {
    if (my === lib.seq && !append) { resetLib('NASA’s library can’t be reached right now. Try again in a moment.'); }
  } finally { if (my === lib.seq) lib.busy = false; }
}
for (const s of libSel) s.addEventListener('change', () => libSearch(false, { exact: true }));
typeChips.forEach((c, i) => c.addEventListener('click', () => { typeChips.forEach((x, j) => x.setAttribute('aria-pressed', i === j)); libSearch(false, { exact: true }); }));
document.querySelector('.more .btn').addEventListener('click', () => libSearch(true));
$('btsToggle').addEventListener('click', () => setBts($('gallery2').hidden));
$('gallery2').addEventListener('click', e => { const b = e.target.closest('.pic'); if (b) openViewer(PICS[+b.dataset.j]); });
loadSky();                                         /* the sky names, for "See it in the sky" */

update();
