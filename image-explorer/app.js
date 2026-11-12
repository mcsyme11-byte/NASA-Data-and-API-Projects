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
/* each layer's days, read from GIBS (decided Nov 10, 2026): the layer's time domain lists the runs of days it has, for
   example "2002-06-01/2021-02-19/P1D,2021-02-22/…" (the MUR layers miss a few days). A layer shows the chosen day, or
   its nearest earlier day when it has no picture for that day. While the domain is loading, or if it cannot be read,
   the fixed lag below is used (the combined MUR layers arrive a day after the others). */
const DOMAINS = new Map();                                 /* "projection layer" → [[from, to], …], null while loading, false if unreadable */
const domKey = S => `${V().gibs} ${S.layer}`;
function loadDomain(S) {
  const k = domKey(S);
  if (DOMAINS.has(k)) return;
  DOMAINS.set(k, null);
  fetch(`${GIBS}${V().gibs}/best/1.0.0/${S.layer}/default/${S.set}/all/--${LATEST}.xml`)
    .then(r => r.ok ? r.text() : Promise.reject(new Error(r.status)))
    .then(t => {
      const d = (t.match(/<Domain>([^<]*)<\/Domain>/) || [])[1] || '';
      const runs = d.split(',').map(x => x.trim().split('/')).filter(r => /^\d{4}-\d\d-\d\d/.test(r[0]))
        .map(r => [r[0].slice(0, 10), (/^\d{4}-/.test(r[1] || '') ? r[1] : r[0]).slice(0, 10)]);
      DOMAINS.set(k, runs.length ? runs : false);
      refreshSources(); update();
    })
    .catch(() => DOMAINS.set(k, false));
}
function dayFor(S) {
  const want = date > LATEST ? LATEST : date, runs = DOMAINS.get(domKey(S));
  if (!runs) { const last = iso(Date.parse(LATEST) - (S.lag || 0) * DAY); return want > last ? last : want; }
  let best = null;
  for (const [a, b] of runs) if (a <= want) best = b < want ? b : want;
  return best || want;                                     /* before the layer's first day: no picture, as before */
}
/* why a layer shows another day: past its newest day, or a day it lacks */
const lastOf = S => { const runs = DOMAINS.get(domKey(S)); return runs ? runs[runs.length - 1][1] : null; };

/* ---------- map: three views ---------- */
proj4.defs('EPSG:3413', '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs');
proj4.defs('EPSG:3031', '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +k=1 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs');
ol.proj.proj4.register(proj4);
const H = 4194304;                                        /* half the width of GIBS's polar grids, metres */
for (const c of ['EPSG:3413', 'EPSG:3031']) ol.proj.get(c).setExtent([-H, -H, H, H]);
ol.proj.get('EPSG:3413').setWorldExtent([-180, 30, 180, 90]); ol.proj.get('EPSG:3031').setWorldExtent([-180, -90, 180, -30]);   /* for the grid */
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
/* true colour comes as JPEG, so the gaps between a satellite's passes are drawn in black: those pixels (each colour 10
   or less out of 255) are made see-through as each tile loads, so the Blue Marble picture underneath shows instead */
function clearBlack(tile, src) {
  const img = tile.getImage(), raw = new Image();
  raw.crossOrigin = 'anonymous';
  raw.onload = () => {
    const c = document.createElement('canvas'); c.width = raw.width; c.height = raw.height;
    const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(raw, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height), a = d.data;
    let any = false;
    for (let i = 0; i < a.length; i += 4) if (a[i] <= 10 && a[i + 1] <= 10 && a[i + 2] <= 10) { a[i + 3] = 0; any = true; }
    if (!any) { img.src = src; return; }                  /* nothing to clear: the original, from the browser's cache */
    g.putImageData(d, 0, 0);
    c.toBlob(b => { const u = URL.createObjectURL(b); img.onload = img.onerror = () => URL.revokeObjectURL(u); img.src = u; }, 'image/png');
  };
  raw.onerror = () => { img.src = src; };               /* lets OpenLayers see the error as before */
  raw.src = src;
}
function rasterSource(S) {
  return new ol.source.XYZ({ projection: proj(), tileGrid: grid(S.set), crossOrigin: 'anonymous', transition: 150, tileUrlFunction: tileUrl(S, S.ext),
    ...(S.ext === 'jpg' ? { tileLoadFunction: clearBlack } : {}) });
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
/* a cloud-free picture (Blue Marble, about 500 m a pixel) under the day's pictures, so the gaps between a satellite's
   passes show land and sea instead of black (decided Nov 11, 2026); not under night lights */
const under = new ol.layer.Tile({ zIndex: -1 });
function underSource() {
  return new ol.source.XYZ({ projection: proj(), tileGrid: grid('500m'), crossOrigin: 'anonymous', transition: 0,
    tileUrlFunction: c => `${GIBS}${V().gibs}/best/BlueMarble_NextGeneration/default/default/500m/${c[0]}/${c[2]}/${c[1]}.jpeg` });
}

/* ---------- map lines and names (decided Nov 11, 2026): Natural Earth 1:50m coastlines, land borders and rivers,
   a latitude and longitude grid, and names of countries, cities and capitals (data/shapes.json, data/labels.json,
   built by tools/build_shapes.py). The lines load the first time one is switched on. ---------- */
const LINES = { borders: true, coast: true, rivers: false, names: true, grid: false };
const lineStyles = {
  coast: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(242,232,213,.55)', width: 1 }) }),
  borders: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(212,184,122,.85)', width: 1.1, lineDash: [5, 3] }) }),
  rivers: new ol.style.Style({ stroke: new ol.style.Stroke({ color: 'rgba(120,170,215,.8)', width: 1 }) }),
};
const lineLayers = {};
for (const k of ['coast', 'borders', 'rivers']) lineLayers[k] = new ol.layer.Vector({ style: lineStyles[k], visible: false, updateWhileInteracting: false, zIndex: 10 });
let shapes = null, shapesLoading = null, labelRows = null;
function loadShapes() {
  shapesLoading ??= Promise.all([fetch('data/shapes.json').then(r => r.json()), fetch('data/labels.json').then(r => r.json())])
    .then(([s, l]) => { shapes = s; labelRows = l; fillLines(); })
    .catch(() => { shapesLoading = null; });
  return shapesLoading;
}
/* lines for the current view: in the polar views only those reaching past 40° towards that pole */
function fillLines() {
  if (!shapes) return;
  const pole = V().pole, near = l => !pole || l.some(([, la]) => pole > 0 ? la > 40 : la < -40);
  for (const k of Object.keys(lineLayers)) {
    const feats = shapes[k].filter(near).map(l => new ol.Feature(new ol.geom.LineString(l).transform('EPSG:4326', proj())));
    lineLayers[k].setSource(new ol.source.Vector({ features: feats }));
  }
  const pts = labelRows.filter(([, , , la]) => !pole || (pole > 0 ? la > 45 : la < -50)).map(([name, kind, lo, la, rank]) => {
    const f = new ol.Feature(new ol.geom.Point(fromLL([lo, la]))); f.setProperties({ name, kind, rank }); return f;
  });
  nameLayer.setSource(new ol.source.Vector({ features: pts }));
}
/* names: countries first, then capitals and cities; a name shows once the map is close enough for its rank */
const nameCache = {};
function nameStyle(f, res) {
  const deg = view === 'world' ? res : res / 111320, z = Math.log2(0.5625 / deg);     /* about the GIBS level shown */
  const { name, kind, rank } = f.getProperties(), country = kind === 'country';
  const narrow = (map.getSize() || [999])[0] < 640;                                 /* a phone-sized map shows fewer names, so they don't crowd */
  if ((country ? rank : rank + 1) > z + (narrow ? 1 : 2)) return null;
  const k = `${kind} ${name}`;
  return nameCache[k] ??= new ol.style.Style({
    image: country ? undefined : new ol.style.Circle({ radius: kind === 'capital' ? 3 : 2, fill: new ol.style.Fill({ color: '#F2E8D5' }), stroke: new ol.style.Stroke({ color: 'rgba(14,20,31,.8)', width: 1 }) }),
    text: new ol.style.Text({ text: country ? name.toUpperCase() : name, font: country ? '600 11px Georgia, serif' : '12px Georgia, serif',
      fill: new ol.style.Fill({ color: country ? '#D4B87A' : '#F2E8D5' }), stroke: new ol.style.Stroke({ color: 'rgba(14,20,31,.85)', width: 3 }),
      offsetY: country ? 0 : -9, ...(country ? { letterSpacing: 2 } : {}) }),
    zIndex: (country ? 200 : kind === 'capital' ? 100 : 0) - rank * 10,   /* where names crowd, bigger countries and cities win */
  });
}
const nameLayer = new ol.layer.Vector({ style: nameStyle, declutter: true, visible: false, zIndex: 12, updateWhileInteracting: false });
const gridLayer = new ol.layer.Graticule({ strokeStyle: new ol.style.Stroke({ color: 'rgba(212,184,122,.35)', width: 1, lineDash: [2, 4] }),
  showLabels: true, wrapX: false, visible: false, zIndex: 11,
  lonLabelStyle: new ol.style.Text({ font: '11px ui-monospace, monospace', textBaseline: 'bottom', fill: new ol.style.Fill({ color: '#D4B87A' }), stroke: new ol.style.Stroke({ color: 'rgba(14,20,31,.9)', width: 3 }) }),
  latLabelStyle: new ol.style.Text({ font: '11px ui-monospace, monospace', textAlign: 'end', fill: new ol.style.Fill({ color: '#D4B87A' }), stroke: new ol.style.Stroke({ color: 'rgba(14,20,31,.9)', width: 3 }) }) });
function showLines() {
  const any = LINES.borders || LINES.coast || LINES.rivers || LINES.names;
  if (any && !shapes) loadShapes();
  for (const k of Object.keys(lineLayers)) lineLayers[k].setVisible(LINES[k]);
  nameLayer.setVisible(LINES.names); gridLayer.setVisible(LINES.grid);
}

buildSources(); under.setSource(underSource());
const map = new ol.Map({
  target: 'map',
  layers: [under, ...BASES.map(L => layers[L.id]), ...OVERS.map(L => layers[L.id]), lineLayers.rivers, lineLayers.coast, lineLayers.borders, gridLayer, nameLayer],
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
document.querySelectorAll('.lines [data-line]').forEach(b => b.addEventListener('click', () => {
  const k = b.dataset.line; LINES[k] = !LINES[k]; b.setAttribute('aria-pressed', LINES[k]); showLines();
}));
showLines();

function refreshSources() {
  /* a new key makes OpenLayers fetch every tile again with the new date (refresh() alone kept the old tiles) */
  for (const L of [...BASES, ...OVERS]) { const s = layers[L.id].getSource(), S = spec(L); if (s && S) s.setTileUrlFunction(s.getTileUrlFunction(), view + ' ' + dayFor(S)); }
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
function showLayers() { for (const L of [...BASES, ...OVERS]) layers[L.id].setVisible(!!spec(L) && (L.id === base || on.has(L.id))); under.setVisible(base !== 'night'); }
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
/* colour keys drawn in the page's look from GIBS's colour maps (decided Nov 10, 2026): each map lists its colours in
   order, the ones with a label, and its units. Kelvin is shown as °C. GIBS's own legend picture stands in while the
   colour map loads, or if it cannot be read. */
const KEYS = new Map();                                    /* legend name → { bars, classes } | null loading | false */
const num = t => t.replace(/-?\d+(\.\d+)?/g, n => String(+(+n).toFixed(2)));
function loadKey(name) {
  if (KEYS.has(name)) return;
  KEYS.set(name, null);
  fetch(`https://gibs.earthdata.nasa.gov/colormaps/v1.3/${name}.xml`).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(t => {
    const d = new DOMParser().parseFromString(t, 'text/xml'), bars = [], classes = [];
    for (const cm of d.querySelectorAll('ColorMap')) {
      const lg = cm.querySelector('Legend'); if (!lg) continue;
      const es = [...lg.querySelectorAll('LegendEntry')], kelvin = cm.getAttribute('units') === 'K';
      const fix = txt => { txt = num(txt || ''); return kelvin ? txt.replace(/-?\d+(\.\d+)?/g, n => String(Math.round(+n - 273.15))) : txt; };
      if (lg.getAttribute('type') === 'classification') {
        for (const e of es) { const tip = e.getAttribute('tooltip') || ''; if (!/^(fill|no data|missing data)$/i.test(tip)) classes.push([e.getAttribute('rgb'), tip]); }
        continue;
      }
      const n = es.length, stops = es.map((e, i) => `rgb(${e.getAttribute('rgb')}) ${(i / n * 100).toFixed(2)}% ${((i + 1) / n * 100).toFixed(2)}%`);
      /* labelled entries; a range such as "1.99 – 2.42" shows its first value; at most 7 labels */
      let ticks = es.map((e, i) => e.getAttribute('showLabel') === 'true' ? [((i + .5) / n * 100).toFixed(2), fix(e.getAttribute('label') || e.getAttribute('tooltip')).split(/\s+[–-]\s+/)[0]] : null).filter(Boolean);
      if (ticks.length > 7) { const step = Math.ceil(ticks.length / 7); ticks = ticks.filter((_, i) => i % step === 0); }
      bars.push({ title: cm.getAttribute('title'), units: kelvin ? '°C' : cm.getAttribute('units') || '', grad: stops.join(','), ticks,
        min: fix(lg.getAttribute('minLabel')), max: fix(lg.getAttribute('maxLabel')) });
    }
    KEYS.set(name, bars.length || classes.length ? { bars, classes } : false); update();
  }).catch(() => KEYS.set(name, false));
}
function keyHtml(name, label) {
  loadKey(name);
  const k = KEYS.get(name);
  if (!k) return `<img src="https://gibs.earthdata.nasa.gov/legends/${name}_H.svg" alt="Colour key for ${esc(label)}">`;
  return `<div class="ckey" role="img" aria-label="Colour key for ${esc(label)}">` + k.bars.map(b => `
    <div class="cbar" style="background:linear-gradient(90deg,${b.grad})"></div>
    <div class="cticks">${b.ticks.map(([x, t]) => `<span style="left:${x}%">${esc(t)}</span>`).join('')}</div>
    <div class="cends"><span>${esc(b.min)}</span><span>${esc(b.title)}${b.units ? ', ' + esc(b.units) : ''}</span><span>${esc(b.max)}</span></div>`).join('') +
    (k.classes.length ? `<div class="cclass">${k.classes.map(([c, t]) => `<span><i style="background:rgb(${c})"></i>${esc(t)}</span>`).join('')}</div>` : '') + '</div>';
}
function update() {
  const B = spec(BASES.find(L => L.id === base)), O = OVERS.filter(L => on.has(L.id)).map(spec).filter(Boolean);
  $('tDate').textContent = nice(date);
  $('tBase').textContent = B.name; $('tBaseNote').textContent = B.note;
  $('tSat').textContent = B.sat; $('tSatNote').textContent = B.inst;
  $('tOver').textContent = O.length ? O.length + (O.length === 1 ? ' layer' : ' layers') : 'Nothing';
  $('tOverNote').textContent = O.length ? O.map(L => L.name).join(' · ') : 'Add fires, snow, clouds…';
  $('mapTag').innerHTML = `<strong>${nice(date)}</strong> · ${view === 'world' ? '' : V().name + ' · '}${B.name}${O.length ? ' + ' + O.map(L => L.name.toLowerCase()).join(', ') : ''}`;
  const rows = [];
  if (B.legend) rows.push(`<div class="row"><span>${B.name}</span>${keyHtml(B.legend, B.name)}</div>`);
  for (const L of O) rows.push(L.vector || L.key
    ? `<div class="row"><span>${L.name}</span><span class="firekey"><i${L.key ? ` style="background:${L.key[0]};box-shadow:none;border-radius:2px"` : ''}></i>${L.key ? L.key[1] : 'A fire or other hot spot seen that day'}</span></div>`
    : `<div class="row"><span>${L.name}</span>${keyHtml(L.legend, L.name)}</div>`);
  $('legend').innerHTML = rows.join('');
  [B, ...O].forEach(loadDomain);
  const behind = [B, ...O].filter(L => dayFor(L) !== date);
  $('mapSrc').textContent = behind.map(L => { const d = dayFor(L), last = lastOf(L);
    return `${L.name}: ${last && date > last || !last ? 'newest day' : 'no picture that day; nearest earlier day'} ${nice(d)}, shown instead. `; }).join('') +
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
  buildSources(); under.setSource(underSource()); fillLines(); map.setView(makeView()); fillFrame();
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
   Natural Earth's mountains, ranges, lakes, rivers, deserts, islands and seas (data/features.json), and, loaded once
   the first list is in, about 85,000 smaller natural features from GeoNames with an English Wikipedia article
   (data/features-more.json, built by tools/build_geonames_features.py; decided Nov 10, 2026) ---------- */
let PLACES = null, COUNTRIES = [], FEATURES = [], MORE = null, placesLoading = null, moreLoading = null;
function loadMore() {
  /* [name, kind, lat, lon, importance (5 best known … 10), country] */
  moreLoading ??= fetch('data/features-more.json').then(r => r.ok ? r.json() : []).catch(() => []).then(rows => {
    MORE = rows.map(([name, kind, lat, lon, rank, cc]) => ({ name, kind: cc ? `${kind} · ${regionName(cc)}` : kind, lat, lon, rank, f: fold(name) }))
      .sort((a, b) => a.rank - b.rank);
  });
  return moreLoading;
}
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
  if (PLACES && !MORE) loadMore().then(() => { if (document.activeElement === q) suggest(); });
  if (PLACES && f.length >= 2) {
    /* order: a name typed in full first; then countries, the best-known natural features, towns (largest first),
       smaller natural features, and the rest */
    const towns = [], major = [], minor = [], more = [];
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
    for (const p of MORE || []) {                 /* best known first */
      const i = match(p); if (i < 0) continue;
      more.push({ name: p.name, kind: p.kind, lat: p.lat, lon: p.lon, zoom: 9, i, len: s.length });
      if (more.length >= 8) break;
    }
    hits.push(...major.slice(0, 3), ...towns.slice(0, 4), ...more.slice(0, 3), ...major.slice(3), ...minor, ...towns.slice(4), ...more.slice(3));
    hits = [...hits.filter(h => fold(h.name) === f), ...hits.filter(h => fold(h.name) !== f)].slice(0, 8);
  }
  if (!PLACES && !ll) return;
  list.innerHTML = hits.length ? hits.map((h, j) => `<li role="option" id="pl${j}" aria-selected="false" data-j="${j}"><span>${
    h.i != null ? esc(h.name.slice(0, h.i)) + '<mark>' + esc(h.name.slice(h.i, h.i + h.len)) + '</mark>' + esc(h.name.slice(h.i + h.len)) : esc(h.name)
  }</span><span class="k">${esc(h.kind)}</span></li>`).join('')
    : `<li aria-disabled="true"><span class="note">${f.length < 2 ? 'Keep typing…' : 'No place, natural feature or coordinates match'}</span></li>`;
  list.hidden = false; q.setAttribute('aria-expanded', 'true');
}
function go(h) {
  list.hidden = true; q.setAttribute('aria-expanded', 'false'); q.value = h.kind === 'Coordinates' ? h.name : h.name;
  popup.setPosition(undefined);
  viewFor(h.lat);
  const at = fromLL([h.lon, h.lat]), done = () => h.kind === 'Coordinates'
    ? loadCountries().then(() => showPop(at, nearest(h.lat, h.lon)))
    : showPop(at, { title: h.name, sub: h.kind, term: h.name });
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

/* ---------- tap the map (decided Nov 11, 2026): what is at a spot, from the country it is in (data/countries.json,
   Natural Earth), a natural feature on or near it, and the nearest town of 10,000 people or more with its distance and
   direction; "open ocean" only where no country and no sea is found ---------- */
let COUNTRY = null, countryLoading = null;
const loadCountries = () => countryLoading ??= fetch('data/countries.json').then(r => r.json()).then(c => { COUNTRY = c; }).catch(() => { COUNTRY = []; });
function inRing(r, x, y) {                        /* ray casting: is (x, y) inside the ring? */
  let a = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, yi] = r[i], [xj, yj] = r[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) a = !a;
  }
  return a;
}
const countryAt = (lat, lon) => (COUNTRY || []).find(([, , [w, s, e, n], rings]) => lon >= w && lon <= e && lat >= s && lat <= n && rings.some(r => inRing(r, lon, lat)))?.[1] || null;
function kmTo(lat1, lon1, lat2, lon2) {            /* great-circle distance, km */
  const r = Math.PI / 180, a = Math.sin((lat2 - lat1) * r / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin((lon2 - lon1) * r / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(a)));
}
function heading(lat1, lon1, lat2, lon2) {        /* the compass direction from 1 to 2, in words */
  const r = Math.PI / 180, y = Math.sin((lon2 - lon1) * r) * Math.cos(lat2 * r);
  const x = Math.cos(lat1 * r) * Math.sin(lat2 * r) - Math.sin(lat1 * r) * Math.cos(lat2 * r) * Math.cos((lon2 - lon1) * r);
  return ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'][Math.round(((Math.atan2(y, x) / r + 360) % 360) / 45) % 8];
}
const WATER = /^(Sea|Ocean|Gulf|Bay|Strait|Sound|Channel|Fjord|Lagoon)$/;
function nearest(lat, lon) {
  if (!PLACES) return { title: 'This spot', sub: '', term: '' };
  const k = Math.cos(lat * Math.PI / 180), d2 = p => (p.lat - lat) ** 2 + ((p.lon - lon) * k) ** 2;
  let town = null, td = Infinity;
  for (const p of PLACES) { const d = d2(p); if (d < td) { td = d; town = p; } }
  const tkm = town ? kmTo(lat, lon, town.lat, town.lon) : Infinity;
  /* the closest named point (a lake, peak, glacier…) within 60 km, and the smallest named area around the spot */
  let pt = null, pd = Infinity, area = null, aSize = Infinity;
  for (const p of [...FEATURES, ...(MORE || [])]) {
    if (p.box) {
      const [w, s, e, n] = p.box;
      if (lon >= w && lon <= e && lat >= s && lat <= n && (e - w) * (n - s) < aSize && p.kind !== 'Continent' && p.kind !== 'Region') { aSize = (e - w) * (n - s); area = p; }
    } else if (!/^Rivers?\b/.test(p.kind)) { const d = d2(p); if (d < pd) { pd = d; pt = p; } }   /* a river's point is its mouth: left out */
  }
  const pkm = pt ? kmTo(lat, lon, pt.lat, pt.lon) : Infinity, kind = p => p.kind.split(' · ')[0].toLowerCase();
  const country = countryAt(lat, lon), far = town && tkm < 2000 ? `${Math.round(tkm).toLocaleString('en-GB')} km ${heading(town.lat, town.lon, lat, lon)} of ${town.name}` : '';
  if (!country) {                                 /* at sea, or a spot the country outlines miss */
    const sea = area && WATER.test(area.kind) ? area.name : null;
    if (pt && pkm < 15) return { title: pt.name, sub: [kind(pt), far].filter(Boolean).join(' · '), term: pt.name };
    return { title: sea || 'Open ocean', sub: far, term: sea || '' };
  }
  if (town && tkm < 15) return { title: 'Near ' + town.name, sub: country, term: town.name };
  if (pt && pkm < 10) return { title: pt.name, sub: `${kind(pt)} · ${country}`, term: pt.name };
  if (town && tkm < 25) return { title: 'Near ' + town.name, sub: country, term: town.name };
  if (pt && pkm < 60) return { title: pt.name, sub: [`${kind(pt)}, ${Math.round(pkm)} km away`, country, far].join(' · '), term: pt.name };
  if (area && !WATER.test(area.kind)) return { title: area.name, sub: [`${kind(area)} · ${country}`, far].filter(Boolean).join(' · '), term: area.name };
  return { title: country, sub: far, term: country };
}
function showPop(c, info) {
  const [lon, lat] = toLL(c), { title, sub, term } = typeof info === 'string' ? { title: info, sub: '', term: info } : info;
  popEl.innerHTML = `<button class="x" aria-label="Close">×</button><div class="eyebrow">This spot</div><div class="where">${esc(title)}</div>
    ${sub ? `<div class="sub">${esc(sub)}</div>` : ''}<div class="ll">${fmtLL(lat, lon)}</div>${term ? `<button class="btn" data-q="${esc(term)}">Pictures of ${esc(term)}</button>` : ''}`;
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
  const ready = () => showPop(c, nearest(lat, lon));
  if (PLACES && COUNTRY && MORE) ready();
  else Promise.all([loadPlaces().then(loadMore), loadCountries()]).then(ready, () => showPop(c, { title: 'This spot', sub: '', term: '' }));
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
  if (x.lib) return openEsa(x);
  const [id, t, d, c, p, k, s, type] = x, base = assets(type), img = $('vImg'), vid = $('vVid'), video = type === 'video';
  $('vTitle').dataset.id = id; $('vCredit').hidden = true;
  img.hidden = video; vid.hidden = !video; vid.onerror = null; vid.pause(); vid.removeAttribute('src'); vid.load();
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
/* an ESA picture: its credit line, caption and details are read from ESA's page for it when it is opened */
function esaHtml(node) {                          /* text and plain web links only */
  let out = '';
  const walk = n => { for (const c of n.childNodes) {
    if (c.nodeType === 3) out += esc(c.textContent);
    else if (c.nodeName === 'A' && /^https?:\/\//i.test(c.getAttribute('href') || '')) out += `<a href="${esc(c.getAttribute('href'))}" target="_blank" rel="noopener">${esc(c.textContent)}</a>`;
    else if (c.nodeName === 'BR') out += '<br>';
    else if (c.nodeType === 1) { walk(c); if (/^(P|DIV)$/.test(c.nodeName)) out += '<br>'; }
  } };
  walk(node); return out.replace(/\s+/g, ' ').replace(/(\s*<br>\s*)+$/, '').replace(/^(\s*<br>\s*)+/, '').replace(/(\s*<br>\s*){2,}/g, '<br>').trim();
}
function openEsa(x) {
  const s = ESA[x.lib], [id, t] = x, img = $('vImg'), vid = $('vVid'), video = x[7] === 'video';
  img.hidden = video; vid.hidden = !video; vid.pause(); vid.removeAttribute('src'); vid.load();
  if (video) {                                    /* the small file plays; full HD is linked */
    vid.poster = x.thumb; vid.src = `${s.cdn}/archives/videos/medium_podcast/${id}.mp4`;
    vid.onerror = () => { if (!/hd_1080p25_screen/.test(vid.src)) vid.src = `${s.cdn}/archives/videos/hd_1080p25_screen/${id}.mp4`; };
  } else { img.dataset.try = 'esa'; img.alt = t; img.src = `${s.cdn}/archives/images/screen/${id}.jpg`; }
  $('vTitle').textContent = t; $('vTitle').dataset.id = id; $('vDesc').textContent = ''; $('vKw').innerHTML = ''; $('vNote').hidden = true;
  const facts = (rows = []) => { $('vFacts').innerHTML = rows.filter(r => r[1]).map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join('') +
    `<dt>Library</dt><dd>${s.name}</dd><dt>ESA ID</dt><dd class="mono">${esc(id)}</dd>`; };
  facts([['Released', x.potw || (x.year ? String(x.year) : '')]]);
  $('vCredit').hidden = false; $('vCreditText').textContent = 'Reading the credit line from ESA\u2019s page…';
  $('vLicence').innerHTML = `<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener">CC BY 4.0</a>${video ? ' (music under its own terms)' : ''} · caption: ${s.name} · <a href="${esc(x.page)}" target="_blank" rel="noopener">The ${video ? 'video' : 'picture'} on ${s.site.replace('https://', '')}</a>`;
  $('vFull').href = video ? `${s.cdn}/archives/videos/hd_1080p25_screen/${id}.mp4` : `${s.cdn}/archives/images/large/${id}.jpg`;
  $('vFull').textContent = video ? 'Open the full HD video' : 'Open large size';
  $('vKind').textContent = (x.score < 0 ? 'Behind the scenes · ' : '') + (video ? 'Video · ' : 'Picture · ') + s.name;
  const sky = window.focusSky && skyIn(t);
  $('vSky').hidden = !sky;
  if (sky) { $('vSky').dataset.id = sky.id; $('vSky').textContent = `See ${sky.name} in the sky`; }
  $('viewer').showModal();
  $('viewer').querySelector('.vbody').scrollTop = 0;
  fetch(x.page).then(r => r.ok ? r.text() : Promise.reject(new Error(r.status))).then(h => {
    if ($('vTitle').dataset.id !== id) return;                  /* another picture was opened meanwhile */
    const d = new DOMParser().parseFromString(h, 'text/html'), cr = d.querySelector('.credit');
    if (!cr) throw new Error('no credit');
    $('vCreditText').innerHTML = esaHtml(cr);
    const rows = {};
    for (const tr of d.querySelectorAll('tr')) { const k = tr.querySelector('th')?.textContent.replace(/\s+/g, ' ').trim().replace(/:$/, ''), v = tr.querySelector('td'); if (k && v && !(k in rows)) rows[k] = v; }
    const txt = k => rows[k] ? rows[k].textContent.replace(/\s+/g, ' ').trim() : '';
    const cat = rows.Category ? [...rows.Category.querySelectorAll('a')].map(a => a.textContent.trim()).filter(Boolean).join(' · ') || txt('Category') : '';
    facts([['Released', txt('Release date').replace(/,\s*\d{1,2}:\d{2}$/, '') || x.potw], ['Type', video ? 'Video' : txt('Type')], ['Length', txt('Duration')],
      ['Constellation', txt('Constellation')], ['Category', cat]]);
    /* the caption: the paragraphs before the credit line in the same column */
    const col = cr.parentElement, paras = [];
    for (const el of col.querySelectorAll('p')) {
      if (cr.contains(el) || !(el.compareDocumentPosition(cr) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const tx = el.textContent.replace(/\s+/g, ' ').trim();
      if (tx && !paras.some(q => q.includes(tx))) paras.push(tx);
    }
    $('vDesc').textContent = paras.join('\n\n');
  }).catch(() => {
    if ($('vTitle').dataset.id !== id) return;
    $('vCreditText').innerHTML = `${s.name}. ESA\u2019s page can\u2019t be reached right now; the full credit line is on <a href="${esc(x.page)}" target="_blank" rel="noopener">ESA\u2019s page for this picture</a>.`;
  });
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
const lib = { page: 1, q: '', st: null, busy: false, seq: 0 };
const libSel = document.querySelectorAll('.libfilters select');
const typeChips = document.querySelectorAll('.libfilters .seg.type .chip');
const fromChips = document.querySelectorAll('.libfilters .seg.from .chip');
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
/* ---------- ESA/Webb and ESA/Hubble picture archives, searched live beside NASA's library (decided Nov 9, 2026) ----------
 * Both sites answer browsers from any site (CORS). A search page lists 50 results in its script as
 * var images = [{ id, title, width, height, src, url, potw }]; a picture's own page has its credit line and details.
 * Pictures are CC BY 4.0, each with its own credit line, shown in full beside the picture. */
const ESA = {
  webb: { name: 'ESA/Webb', site: 'https://esawebb.org', cdn: 'https://cdn.esawebb.org' },
  hubble: { name: 'ESA/Hubble', site: 'https://esahubble.org', cdn: 'https://cdn.esahubble.org' }
};
const ESA_PAGE = 50;
/* mission buttons: Webb and Hubble list their whole archive ('' = best-ranked first); other missions are NASA's own */
const ESA_PRESETS = { 'james webb': [['webb', '']], webb: [['webb', '']], hubble: [['hubble', '']] };
/* the year from an ID such as weic2622c, heic0515a, potw1720a or potm2510a (none for names such as pillarsofcreation) */
const esaYear = id => { const m = id.match(/^(?:weic|heic|potw|potm|opo|ann|sci)(\d{2})\d/i); return m ? (+m[1] >= 90 ? 1900 : 2000) + +m[1] : null; };
/* a string from the page's script: '-style and \' escapes, then HTML entities */
function unjs(s) {
  const t = document.createElement('textarea');
  t.innerHTML = s.replace(/\\u([0-9a-f]{4})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/\\(.)/g, '$1');
  return t.value;
}
const STR = "'((?:\\\\.|[^'\\\\])*)'";
const ESA_ROW = new RegExp(`\\{\\s*id:\\s*${STR},\\s*title:\\s*${STR},\\s*width:\\s*\\d+,\\s*height:\\s*\\d+,\\s*src:\\s*${STR},\\s*url:\\s*${STR},\\s*potw:\\s*${STR}`, 'g');
/* videos (added Nov 10, 2026): the video archive's pages carry no list in their script; each result is a thumbnail
   picture (archives/videos/videoframe/{id}.jpg) whose alt text is the title. Files: medium_podcast/{id}.mp4 (small),
   hd_1080p25_screen/{id}.mp4 (full HD). */
async function esaSearch(key, words, page, kind = 'images') {
  const s = ESA[key], u = `${s.site}/${kind}/${page > 1 ? `page/${page}/` : ''}${words ? '?search=' + encodeURIComponent(words) : ''}`;
  /* an archive that has not answered in 12 s is left out of this search (ESA's video search can take 30 s on a first
     request); one retry when the connection fails at once */
  const ask = () => { const c = new AbortController(), t = setTimeout(() => c.abort(), 12000); return fetch(u, { signal: c.signal }).finally(() => clearTimeout(t)); };
  let r;
  try { r = await ask(); } catch (e) { if (e.name === 'AbortError') throw Object.assign(new Error('slow'), { slow: true }); r = await ask(); }
  if (r.status === 404) return { total: 0, list: [] };                 /* a page past the last one */
  if (!r.ok) throw new Error(String(r.status));
  const h = await r.text();
  if (kind === 'videos') return esaVideos(key, h);
  const start = h.indexOf('var images = ['), end = start < 0 ? -1 : h.indexOf('];', start);
  const block = start < 0 ? '' : h.slice(start, end < 0 ? undefined : end), list = [];
  for (const m of block.matchAll(ESA_ROW)) {
    const id = unjs(m[1]), row = [id, unjs(m[2]) || 'Untitled', '', s.name, '', [], '', 'image'];
    list.push(Object.assign(row, { lib: key, thumb: unjs(m[3]).replace(/^http:/, 'https:'), page: s.site + unjs(m[4]), potw: unjs(m[5]), year: esaYear(id) }));
  }
  const n = h.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)/);
  return { total: n ? +n[1] : list.length, list };
}
function esaVideos(key, h) {
  const s = ESA[key], d = new DOMParser().parseFromString(h, 'text/html'), list = [], seen = new Set();
  for (const im of d.querySelectorAll('img')) {
    const src = im.getAttribute('src') || im.getAttribute('data-src') || '', m = src.match(/\/archives\/videos\/videoframe\/([A-Za-z0-9_-]+)\.jpg/);
    if (!m || seen.has(m[1])) continue;
    seen.add(m[1]);
    const id = m[1], title = (im.getAttribute('alt') || '').replace(/^Video thumbnail for\s+/i, '').trim() || 'Untitled';
    list.push(Object.assign([id, title, '', s.name, '', [], '', 'video'],
      { lib: key, thumb: src.replace(/^http:/, 'https:').replace(/^\/\//, 'https://'), page: `${s.site}/videos/${id}/`, potw: '', year: esaYear(id) }));
  }
  const n = h.match(/Showing\s+\d+\s+to\s+\d+\s+of\s+(\d+)/);
  return { total: n ? +n[1] : list.length, list };
}
function cachedEsa(key, words, page, kind = 'images') {
  const k = `esa ${key} ${kind} ${page} ${words}`;
  if (!cache.has(k)) cache.set(k, esaSearch(key, words, page, kind).catch(e => { cache.delete(k); throw e; }));
  return cache.get(k);
}
const thumbOf = x => x.lib ? x.thumb : `${assets(x[7])}${x[0]}/${x[0]}~thumb.jpg`;
const srcName = x => x.lib ? ESA[x.lib].name : 'NASA';
const fromSel = () => document.querySelector('.libfilters .seg.from [aria-pressed="true"]')?.dataset.from || 'both';
/* a few pictures of one subject from every library, taking turns (for the globe's selected card) */
async function mixedPics(term, n = 6) {
  const jobs = [cached({ q: term, media_type: 'image', page: 1, page_size: 12 }).then(r => ({ who: 'NASA', ...r }))];
  for (const k of Object.keys(ESA)) jobs.push(cachedEsa(k, term, 1).then(r => ({ who: ESA[k].name, ...r })));
  const got = (await Promise.allSettled(jobs)).filter(g => g.status === 'fulfilled').map(g => g.value);
  if (!got.length) throw new Error('out of reach');
  const lists = got.map(g => g.list.map(x => { x.score = scoreOf(x) + (x.lib ? 2 : 0); return x; }).filter(x => x.score >= 0).sort((a, b) => b.score - a.score));
  const list = [];
  for (let i = 0; list.length < n && lists.some(l => l[i]); i++) for (const l of lists) if (l[i] && list.length < n) list.push(l[i]);
  return { list, counts: got.filter(g => g.total).map(g => [g.who, g.total]) };
}
/* one page of a search: NASA's library (a mission's several phrasings asked together) and ESA's two archives, merged.
   Pictures are sorted by score, taking turns between the libraries within the same score. */
async function runSearch(q, page, st) {
  const f = filters(), from = fromSel(), key = fold(q);
  const terms = PRESETS[key] || [q], size = terms.length > 1 ? 18 : 24;
  const kinds = { image: ['images'], 'image,video': ['images', 'videos'], video: ['videos'] }[f.media_type] || ['images'];
  const esaAsk = from === 'nasa' ? [] : (ESA_PRESETS[key] || (PRESETS[key] ? [] : Object.keys(ESA).map(k => [k, q])))
    .flatMap(([k, w]) => kinds.map(kind => [k, w, kind]));
  const slot = ([k, , kind]) => `${k} ${kind}`;
  const jobs = [];
  if (from !== 'esa') terms.forEach((t, i) => {
    if (st && (page - 1) * size >= Math.min(st.nasa[i] ?? 0, 10000)) return;
    jobs.push({ who: 'nasa', i, p: cached({ q: t, ...f, page, page_size: size }) });
  });
  for (const a of esaAsk) {
    if (st && (page - 1) * ESA_PAGE >= (st.esa[slot(a)] ?? 0)) continue;
    jobs.push({ who: a[0], slot: slot(a), p: cachedEsa(a[0], a[1], page, a[2]) });
  }
  const done = await Promise.allSettled(jobs.map(j => j.p));
  if (jobs.length && done.every(d => d.status === 'rejected')) throw new Error('out of reach');
  const next = { nasa: from !== 'esa' ? terms.map((_, i) => st?.nasa[i] ?? 0) : [], esa: { ...(st?.esa || {}) } }, failed = new Set();
  const y0 = +f.year_start || 0, y1 = +f.year_end || 9999, byYear = !!(f.year_start || f.year_end);
  const ids = new Set(page > 1 ? PICS.map(x => (x.lib || 'nasa') + ' ' + x[7] + ' ' + x[0]) : []), list = [], seen = {};
  jobs.forEach((j, n) => {
    const d = done[n];
    if (d.status === 'rejected') { failed.add((j.who === 'nasa' ? 'NASA' : ESA[j.who].name + (j.slot.endsWith('videos') ? ' videos' : '')) + (d.reason?.slow ? ' did not answer in time' : ' out of reach')); return; }
    if (j.who === 'nasa') next.nasa[j.i] = d.value.total; else next.esa[j.slot] = d.value.total;
    for (const x of d.value.list) {
      const id = (x.lib || 'nasa') + ' ' + x[7] + ' ' + x[0];
      if (ids.has(id) || (x.lib && byYear && !(x.year >= y0 && x.year <= y1))) continue;
      ids.add(id); seen[j.who === 'nasa' ? 'nasa' : x.lib] = (seen[j.who === 'nasa' ? 'nasa' : x.lib] || 0) + 1;
      x.score = scoreOf(x) + (x.lib ? 2 : 0);                    /* ESA's archives are telescope science pictures */
      x.n = seen[j.who === 'nasa' ? 'nasa' : x.lib]; list.push(x);
    }
  });
  list.sort((a, b) => Math.min(b.score, 4) - Math.min(a.score, 4) || a.n - b.n);
  const counts = [];
  if (from !== 'esa' && next.nasa.length) counts.push(['NASA', Math.max(0, ...next.nasa)]);
  for (const a of esaAsk) counts.push([ESA[a[0]].name + (a[2] === 'videos' ? ' videos' : kinds.length > 1 ? ' pictures' : ''), next.esa[slot(a)] ?? 0]);
  const more = next.nasa.some(t => page * size < Math.min(t, 10000)) || esaAsk.some(a => page * ESA_PAGE < (next.esa[slot(a)] ?? 0));
  return { list, st: next, counts, failed: [...failed], more, total: counts.reduce((a, c) => a + c[1], 0) };
}
const card = (x, j) => `<button class="pic${x[7] === 'video' ? ' video' : ''}" data-j="${j}">
      <span class="ph"><img src="${esc(thumbOf(x))}" data-id="${esc(x[0])}" data-base="${assets(x[7])}" data-try="${x.lib ? 'esa' : 'thumb'}" alt="${esc(x[1])}" loading="lazy"><span class="src${x.lib ? ' esa' : ''}">${srcName(x)}</span></span>
      <span class="pt"><h3>${esc(x[1])}</h3><span class="meta">${x.lib ? `${esc(x.potw || String(x.year || 'No date'))} · ${srcName(x)}` : `${x[2] ? nice(x[2]) : 'No date'} · ${esc(x[3] || 'NASA')}`}${x[7] === 'video' ? ' · Video' : ''}</span></span></button>`;
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
  if (!append) {                                   /* names the libraries the From setting asks */
    const wait = { both: 'Searching NASA’s and ESA’s libraries…', nasa: 'Searching NASA’s library…', esa: 'Searching ESA’s archives…' }[fromSel()];
    $('libCount').textContent = wait; if (!PICS.length) say($('gallery'), wait);
  }
  try {
    let r = await runSearch(q, page, append ? lib.st : null), used = q, fixed = false;
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
    lib.q = used; lib.page = page; lib.st = r.st;
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
    const parts = r.counts.filter(c => c[1]).map(([w, n]) => `${w}: ${n.toLocaleString('en-GB')} found`);
    if (r.list.length || PICS.length) parts.push(`${main} shown`);
    if (back) parts.push(`${back} behind the scenes`);
    parts.push(...r.failed);
    $('libCount').innerHTML = r.total || r.failed.length ? parts.map(p => `<span>${esc(p)}</span>`).join(' · ') : '';
    document.querySelector('.more').hidden = !r.more;
  } catch {
    if (my === lib.seq && !append) { resetLib('NASA’s and ESA’s libraries can’t be reached right now. Try again in a moment.'); }
  } finally { if (my === lib.seq) lib.busy = false; }
}
for (const s of libSel) s.addEventListener('change', () => libSearch(false, { exact: true }));
for (const set of [typeChips, fromChips]) set.forEach((c, i) => c.addEventListener('click', () => { set.forEach((x, j) => x.setAttribute('aria-pressed', i === j)); libSearch(false, { exact: true }); }));
document.querySelector('.more .btn').addEventListener('click', () => libSearch(true));
$('btsToggle').addEventListener('click', () => setBts($('gallery2').hidden));
$('gallery2').addEventListener('click', e => { const b = e.target.closest('.pic'); if (b) openViewer(PICS[+b.dataset.j]); });
loadSky();                                         /* the sky names, for "See it in the sky" */

update();
