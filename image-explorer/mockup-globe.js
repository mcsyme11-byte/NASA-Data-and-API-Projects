/* NASA Data Projects · Image Explorer · mock-up: the Globe tab and the live picture library
 * © 2026 Malcolm Syme · mcsyme11@gmail.com
 *
 * The Earth (NASA Blue Marble from GIBS) turned to the current sidereal time inside the sky: 5,044 stars to
 * magnitude 6 and the 110 Messier objects (d3-celestial), plus famous Hubble and Webb targets, at their real
 * positions. Pins on the Earth are the natural events NASA EONET is following now. Uses the classic script's
 * show(), nice(), esc(), PICS, CENTRES and focusEarth().
 */
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const $ = id => document.getElementById(id);
const D2R = Math.PI / 180;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = $('globeFrame'), host = $('globe'), over = $('gOver'), ctx = over.getContext('2d');
/* the starting view looks past the Earth towards Sagittarius and the centre of the galaxy, the richest part of the
   sky for nebulae and clusters (the Lagoon, Trifid, Omega and Eagle nebulae) */
const SKY_R = 190, STAR_R = 200, HOME = { ra: 271, dec: -22, dist: 6 };

/* Earth-fixed and sky positions use the same rule: x towards longitude (or right ascension) 0, y north. */
const vec = (lat, lon, r) => new THREE.Vector3(r * Math.cos(lat * D2R) * Math.cos(lon * D2R), r * Math.sin(lat * D2R), -r * Math.cos(lat * D2R) * Math.sin(lon * D2R));
/* Greenwich mean sidereal time: how far the Earth has turned against the stars (IAU 1982 formula, enough here). */
const gmst = (t = Date.now()) => ((((280.46061837 + 360.98564736629 * (t / 864e5 + 2440587.5 - 2451545)) % 360) + 360) % 360) * D2R;

const vis = { events: true, galaxy: true, nebula: true, cluster: true, labels: true, spin: !reduce };
let renderer, scene, camera, controls, earth, earthMat, started = false, running = false;
let events = [], sky = [], hits = [], selected = null, fly = null, hover = null;

/* ---------- sky objects ---------- */
const TYPES = { s: ['galaxy', 'Spiral galaxy'], e: ['galaxy', 'Elliptical galaxy'], i: ['galaxy', 'Irregular galaxy'],
  gc: ['cluster', 'Globular star cluster'], oc: ['cluster', 'Open star cluster'], pos: ['cluster', 'Group of stars'],
  pn: ['nebula', 'Planetary nebula'], rn: ['nebula', 'Reflection nebula'], sfr: ['nebula', 'Star-forming nebula'],
  snr: ['nebula', 'Supernova remnant'], dn: ['nebula', 'Dark nebula'], bn: ['nebula', 'Bright nebula'] };
const FAMOUS = new Set(['M1', 'M8', 'M13', 'M16', 'M20', 'M27', 'M31', 'M33', 'M42', 'M44', 'M45', 'M51', 'M57', 'M81', 'M87', 'M101', 'M104']);
const SEARCH = { M77: 'Messier 77', M87: 'Messier 87', M24: 'Messier 24', M73: 'Messier 73', M16: 'Eagle Nebula', M45: 'Pleiades', M44: 'Beehive Cluster' };
/* famous Hubble and Webb targets outside the Messier list; positions (J2000, degrees) to be confirmed against SIMBAD when built */
const EXTRA = [
  ['Carina Nebula', 'NGC 3372', 'nebula', 'Star-forming nebula', 161.265, -59.867],
  ['Southern Ring Nebula', 'NGC 3132', 'nebula', 'Planetary nebula', 151.757, -40.436],
  ['Helix Nebula', 'NGC 7293', 'nebula', 'Planetary nebula', 337.411, -20.837],
  ['Cat’s Eye Nebula', 'NGC 6543', 'nebula', 'Planetary nebula', 269.639, 66.633],
  ['Horsehead Nebula', 'Barnard 33', 'nebula', 'Dark nebula', 85.245, -2.458],
  ['Tarantula Nebula', 'NGC 2070', 'nebula', 'Star-forming nebula', 84.676, -69.101],
  ['Cassiopeia A', '3C 461', 'nebula', 'Supernova remnant', 350.85, 58.815],
  ['Rho Ophiuchi', 'Rho Oph cloud', 'nebula', 'Star-forming cloud', 246.4, -23.45],
  ['Westerlund 2', 'Westerlund 2', 'cluster', 'Young star cluster', 156.0, -57.75],
  ['Stephan’s Quintet', 'HCG 92', 'galaxy', 'Group of galaxies', 339.0, 33.96],
  ['Cartwheel Galaxy', 'ESO 350-40', 'galaxy', 'Ring galaxy', 9.421, -33.716],
  ['Centaurus A', 'NGC 5128', 'galaxy', 'Elliptical galaxy', 201.365, -43.019],
  ['Large Magellanic Cloud', 'LMC', 'galaxy', 'Dwarf galaxy', 80.894, -69.756],
  ['Small Magellanic Cloud', 'SMC', 'galaxy', 'Dwarf galaxy', 13.187, -72.829],
];
const tidy = s => s.replace(/[´’]/g, '’');
function nameOf(id, alt, kind) {
  if (!alt) return 'Messier ' + id.slice(1);
  alt = tidy(alt);
  if (kind === 'galaxy' && !/galaxy|cloud| a$/i.test(alt)) return alt + ' Galaxy';
  return alt;
}

/* ---------- start (on the first visit to the tab) ---------- */
document.addEventListener('viewchange', e => {
  if (e.detail === 'globe') { if (!started) init(); resize(); run(); } else running = false;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) running = false; else if (!$('view-globe').hidden) run(); });

function init() {
  started = true;
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setClearColor(0x05080d);
  host.appendChild(renderer.domElement);
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(40, 1, 0.01, 1000);

  controls = new OrbitControls(camera, renderer.domElement);
  Object.assign(controls, { enablePan: false, enableDamping: true, dampingFactor: 0.08, minDistance: 1.12, maxDistance: 40,
    rotateSpeed: 0.5, zoomSpeed: 0.9, autoRotate: vis.spin, autoRotateSpeed: 0.35 });
  controls.addEventListener('start', () => { fly = null; if (vis.spin) setSpin(false); });

  earth = new THREE.Group(); earth.rotation.y = gmst(); scene.add(earth);
  earthMat = new THREE.MeshBasicMaterial({ color: 0x1a2333 });
  earth.add(new THREE.Mesh(new THREE.SphereGeometry(1, 128, 64), earthMat));
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(1.012, 64, 32),
    new THREE.MeshBasicMaterial({ color: 0x8aa9c9, transparent: true, opacity: 0.18, side: THREE.BackSide })));
  home(false);

  loadEarth();
  loadStars();
  loadSky();
  loadEvents();
  wirePointer();
  new ResizeObserver(resize).observe(frame);
}

/* ---------- the Earth: NASA Blue Marble from GIBS, sharper once the first picture is in ---------- */
async function loadEarth() {
  const base = 'https://gibs.earthdata.nasa.gov/wmts/epsg4326/best/BlueMarble_NextGeneration/default/default/500m/';
  const level = async (z, cols, rows, W, H) => {
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    let ok = 0;
    await Promise.all(Array.from({ length: cols * rows }, (_, i) => new Promise(done => {
      const x = i % cols, y = Math.floor(i / cols), img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => { g.drawImage(img, x * 512, y * 512); ok++; done(); };
      img.onerror = done;
      img.src = `${base}${z}/${y}/${x}.jpeg`;
    })));
    if (!ok) return false;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    if (earthMat.map) earthMat.map.dispose();
    earthMat.map = t; earthMat.color.set(0xffffff); earthMat.needsUpdate = true;
    return true;
  };
  const first = await level(2, 5, 3, 2560, 1280);        // 0.14° a pixel, about 16 km
  if (!first) { tag('The Earth picture could not be loaded from NASA right now.'); return; }
  if (renderer.capabilities.maxTextureSize >= 5120) await level(3, 10, 5, 5120, 2560);   // about 8 km
}

/* ---------- stars ---------- */
async function loadStars() {
  try {
    const j = await (await fetch('https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/stars.6.json')).json();
    const n = j.features.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    j.features.forEach((f, i) => {
      const [ra, dec] = f.geometry.coordinates, m = f.properties.mag, bv = parseFloat(f.properties.bv) || 0.6;
      vec(dec, ra, STAR_R).toArray(pos, i * 3);
      size[i] = Math.max(1.3, 5.6 - 0.8 * m);
      const c = bv < 0.2 ? [0.80, 0.87, 1] : bv > 1.1 ? [1, 0.82, 0.66] : bv > 0.6 ? [1, 0.93, 0.82] : [0.95, 0.95, 0.97];
      col.set(c, i * 3);
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.ShaderMaterial({
      uniforms: { uDpr: { value: renderer.getPixelRatio() } }, transparent: true, depthWrite: false,
      vertexShader: 'attribute float size; attribute vec3 aColor; uniform float uDpr; varying vec3 vC; void main(){ vC = aColor; gl_PointSize = size * uDpr; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec3 vC; void main(){ float r = length(gl_PointCoord - 0.5); if (r > 0.5) discard; gl_FragColor = vec4(vC, smoothstep(0.5, 0.05, r)); }',
    });
    scene.add(new THREE.Points(geo, mat));
  } catch { /* the sky still works without background stars */ }
}

/* ---------- galaxies, nebulae, clusters ---------- */
async function loadSky() {
  try {
    const j = await (await fetch('https://cdn.jsdelivr.net/gh/ofrohn/d3-celestial@master/data/messier.json')).json();
    for (const f of j.features) {
      const p = f.properties, [kind, type] = TYPES[p.type] || ['nebula', 'Nebula'];
      const [ra, dec] = f.geometry.coordinates;
      sky.push({ id: f.id, name: nameOf(f.id, p.alt, kind), desig: [f.id, p.desig].filter(Boolean).join(' · '), kind, type,
        mag: p.mag, dim: p.dim, ra: (ra + 360) % 360, dec, famous: FAMOUS.has(f.id),
        term: SEARCH[f.id] || (p.alt ? nameOf(f.id, p.alt, kind) : 'Messier ' + f.id.slice(1)), pos: vec(dec, ra, SKY_R) });
    }
  } catch { tag('The Messier list could not be loaded right now.'); }
  for (const [name, desig, kind, type, ra, dec] of EXTRA)
    sky.push({ id: desig, name, desig, kind, type, ra, dec, famous: true, term: name, pos: vec(dec, ra, SKY_R) });
  status();
}

/* ---------- natural events NASA is following, with a report in the last 30 days (EONET) ----------
 * Many events stay "open" for months after the last report (7,236 open on Nov 9, 2026, 35 reported in 30 days). */
const CAT = { wildfires: '#C9784A', volcanoes: '#D1A956', severeStorms: '#8AA9C9', seaLakeIce: '#B79AC8', snow: '#B79AC8' };
async function loadEvents() {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const j = await (await fetch('https://eonet.gsfc.nasa.gov/api/v3/events?status=open&days=30')).json();
      events = j.events.map(e => {
        const g = e.geometry[e.geometry.length - 1];
        let [lon, lat] = g.coordinates;
        if (g.type === 'Polygon') { const ring = g.coordinates[0]; lon = ring.reduce((a, c) => a + c[0], 0) / ring.length; lat = ring.reduce((a, c) => a + c[1], 0) / ring.length; }
        const c = e.categories[0];
        return { id: e.id, name: e.title, cat: c.id, catTitle: c.title, date: g.date.slice(0, 10), lat, lon,
          mag: g.magnitudeValue, unit: g.magnitudeUnit, src: (e.sources[0] || {}).url, kind: 'event', local: vec(lat, lon, 1.004) };
      }).filter(e => isFinite(e.lat) && isFinite(e.lon));
      break;
    } catch { if (attempt) events = null; }
  }
  status();
}

function status() {
  const ev = events === null ? 'events unavailable right now' : `${events.length} events on Earth in the last 30 days`;
  tag(`${ev} · ${sky.length} sky objects · as of ${new Date().toUTCString().slice(17, 22)} UTC`);
  $('gSrc').textContent = 'Earth: NASA Blue Marble (GIBS). Events: NASA EONET, live. Stars to magnitude 6 and Messier objects: d3-celestial.';
}
const tag = t => { $('gTag').textContent = t; };

/* ---------- drawing ---------- */
function resize() {
  if (!started) return;
  const w = frame.clientWidth, h = frame.clientHeight, d = Math.min(devicePixelRatio, 2);
  if (!w || !h) return;                                  /* the tab is hidden */
  renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  over.width = w * d; over.height = h * d;
}
function run() {
  if (running || $('view-globe').hidden) return;
  running = true;
  const loop = () => {
    if (!running) return;
    if (fly) stepFly();
    controls.rotateSpeed = Math.min(0.5, Math.max(0.04, (camera.position.length() - 1) * 0.25));
    controls.update();
    renderer.render(scene, camera);
    draw();
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

const BRASS = '#C0A062', BRIGHT = '#E2C88E', INK2 = '#B4AFA2';
window.__g = { get camera() { return camera; }, get sky() { return sky; }, get hits() { return hits; }, get earth() { return earth; } };
function draw() {
  const w = frame.clientWidth, h = frame.clientHeight, d = over.width / w;
  ctx.setTransform(d, 0, 0, d, 0, 0); ctx.clearRect(0, 0, w, h);
  const cam = camera.position, dist = cam.length(), m = earth.matrixWorld, labels = [];
  hits = [];
  ctx.font = '12px Georgia, "Palatino Linotype", serif'; ctx.textBaseline = 'middle';
  const place = (p, item, r) => {
    const s = p.clone().project(camera);
    if (s.z > 1 || s.x < -1.05 || s.x > 1.05 || s.y < -1.05 || s.y > 1.05) return null;
    const x = (s.x + 1) / 2 * w, y = (1 - s.y) / 2 * h; hits.push({ x, y, r, item }); return [x, y];
  };
  const label = (x, y, text, colour) => {
    const tw = ctx.measureText(text).width, box = [x + 9, y - 8, tw + 4, 16];
    if (labels.some(b => box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3])) return;
    labels.push(box);
    ctx.fillStyle = 'rgba(5,8,13,.65)'; ctx.fillRect(box[0] - 2, box[1], box[2] + 2, box[3]);
    ctx.fillStyle = colour; ctx.fillText(text, x + 10, y);
  };

  /* sky: hidden behind the Earth; names for the famous ones when zoomed out */
  for (const o of sky) {
    if (!vis[o.kind]) continue;
    const dir = o.pos.clone().sub(cam).normalize(), b = cam.dot(dir), disc = b * b - (cam.lengthSq() - 1);
    if (disc > 0 && -b - Math.sqrt(disc) > 0) continue;
    const at = place(o.pos, o, 9); if (!at) continue;
    const [x, y] = at, sel = selected === o, hov = hover === o;
    ctx.strokeStyle = ctx.fillStyle = sel || hov ? BRIGHT : o.kind === 'cluster' ? INK2 : BRASS;
    ctx.lineWidth = 1.5;
    if (o.kind === 'galaxy') { ctx.beginPath(); ctx.ellipse(x, y, 6, 3.6, -0.5, 0, 7); ctx.stroke(); }
    else if (o.kind === 'nebula') { ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 4, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 4, y); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fill(); }
    if (sel) { ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); }
    if (sel || hov || (vis.labels && o.famous && dist > 2.4)) label(x, y, o.name, sel || hov ? BRIGHT : INK2);
  }

  /* events: on the side of the Earth facing the camera */
  if (vis.events && events) for (const e of events) {
    const p = e.local.clone().applyMatrix4(m);
    if (p.dot(cam.clone().sub(p)) <= 0) continue;
    const at = place(p, e, 9); if (!at) continue;
    const [x, y] = at, r = dist < 1.6 ? 5 : dist < 3 ? 4 : 3, sel = selected === e;
    ctx.fillStyle = CAT[e.cat] || '#8FB996';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(5,8,13,.8)'; ctx.lineWidth = 1; ctx.stroke();
    if (sel) { ctx.strokeStyle = BRIGHT; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, r + 5, 0, 7); ctx.stroke(); }
    if (sel || hover === e || (vis.labels && dist < 1.5)) label(x, y, e.name, sel || hover === e ? BRIGHT : INK2);
  }
}

/* ---------- pointer: hover names, tap to select ---------- */
const tip = Object.assign(document.createElement('div'), { className: 'tip', hidden: true });
document.body.appendChild(tip);
function nearest(ev) {
  const r = renderer.domElement.getBoundingClientRect(), x = ev.clientX - r.left, y = ev.clientY - r.top;
  let best = null, bd = 196;                              /* within 14 px */
  for (const h of hits) { const d = (h.x - x) ** 2 + (h.y - y) ** 2; if (d < bd) { bd = d; best = h.item; } }
  return best;
}
function wirePointer() {
  const el = renderer.domElement; let down = null;
  el.addEventListener('pointerdown', e => { down = [e.clientX, e.clientY]; });
  el.addEventListener('pointerup', e => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) < 6) { const it = nearest(e); if (it) select(it); }
    down = null;
  });
  el.addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse' || e.buttons) { tip.hidden = true; return; }
    hover = nearest(e); el.style.cursor = hover ? 'pointer' : '';
    if (!hover) { tip.hidden = true; return; }
    tip.innerHTML = `<b>${esc(hover.name)}</b><br>${esc(hover.kind === 'event' ? hover.catTitle + ' · ' + nice(hover.date) : hover.type)}`;
    tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.hidden = false;
  });
  el.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
}

/* ---------- camera moves ---------- */
/* stand on the far side of the Earth from a sky direction, a little to one side, so the sky shows beside the Earth */
function skyView(u, dist) {
  u = u.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(u);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  return u.negate().add(side.normalize().multiplyScalar(0.45)).normalize().multiplyScalar(dist);
}
function home(animate = true) {
  const p = skyView(vec(HOME.dec, HOME.ra, 1), HOME.dist);
  animate ? flyTo(p) : camera.position.copy(p);
}
function flyTo(to) { fly = { from: camera.position.clone(), to, t0: performance.now(), ms: reduce ? 1 : 900 }; }
function stepFly() {
  const k = Math.min(1, (performance.now() - fly.t0) / fly.ms), e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2;
  const a = fly.from.clone().normalize(), b = fly.to.clone().normalize();
  const dir = new THREE.Vector3().copy(a).lerp(b, e);
  if (dir.lengthSq() < 1e-6) dir.set(0, 1, 0);                  /* exactly opposite: pass over the pole */
  camera.position.copy(dir.normalize().multiplyScalar(fly.from.length() + (fly.to.length() - fly.from.length()) * e));
  if (k === 1) fly = null;
}
function goTo(it) {
  if (it.kind === 'event') {
    flyTo(it.local.clone().applyMatrix4(earth.matrixWorld).normalize().multiplyScalar(Math.min(camera.position.length(), 2.2)));
  } else {
    flyTo(skyView(it.pos, Math.max(camera.position.length(), 6)));
  }
}
$('gIn').addEventListener('click', () => flyTo(camera.position.clone().multiplyScalar(0.75).clampLength(1.15, 40)));
$('gOut').addEventListener('click', () => flyTo(camera.position.clone().multiplyScalar(1.4).clampLength(1.15, 40)));
$('gHome').addEventListener('click', () => home());

/* ---------- the selected card ---------- */
const raStr = ra => { const h = ra / 15, hh = Math.floor(h), mm = (h - hh) * 60; return `${hh}h ${mm.toFixed(1)}m`; };
const decStr = d => `${d < 0 ? '−' : '+'}${Math.floor(Math.abs(d))}° ${Math.round((Math.abs(d) % 1) * 60)}′`;
function moons(dim) {                                   /* the full Moon is about 31 arcminutes across */
  const a = parseFloat(String(dim).split('x')[0]); if (!a) return '';
  const r = a / 31; return r >= 1 ? ` · about ${r < 1.5 ? 'as wide as the full Moon' : r.toFixed(r < 10 ? 1 : 0) + ' full Moons wide'}` : '';
}
function select(it) {
  selected = it;
  const card = $('gCard');
  if (it.kind === 'event') {
    card.innerHTML = `<h2>Selected</h2><div class="eyebrow">${esc(it.catTitle)} · on Earth now</div><h3>${esc(it.name)}</h3>
      <dl class="facts"><dt>Latest report</dt><dd>${nice(it.date)}</dd>
      ${it.mag ? `<dt>Size</dt><dd>${Number(it.mag).toLocaleString('en-GB')} ${esc(it.unit || '')}</dd>` : ''}
      <dt>Position</dt><dd class="mono">${Math.abs(it.lat).toFixed(2)}° ${it.lat >= 0 ? 'N' : 'S'}, ${Math.abs(it.lon).toFixed(2)}° ${it.lon >= 0 ? 'E' : 'W'}</dd></dl>
      <button class="btn" id="gEarth">See it on the Earth map</button>
      ${it.src ? `<p class="note" style="margin:12px 0 0">Reported by NASA EONET from <a href="${esc(it.src)}" target="_blank" rel="noopener">its source</a>.</p>` : ''}`;
    $('gEarth').addEventListener('click', () => focusEarth(it.lat, it.lon, it.date, it.cat === 'wildfires' ? 'fires' : it.cat === 'seaLakeIce' ? 'ice' : it.cat === 'snow' ? 'snow' : null));
  } else {
    card.innerHTML = `<h2>Selected</h2><div class="eyebrow">${esc(it.type)}</div><h3>${esc(it.name)}</h3>
      <dl class="facts"><dt>Catalogue</dt><dd>${esc(it.desig)}</dd>
      ${it.mag != null ? `<dt>Brightness</dt><dd>Magnitude ${it.mag}${it.mag <= 6 ? ' · visible without a telescope from a dark place' : ''}</dd>` : ''}
      ${it.dim ? `<dt>Size in the sky</dt><dd>${esc(it.dim.replace('x', ' × '))} arcminutes${moons(it.dim)}</dd>` : ''}
      <dt>Sky position</dt><dd class="mono">RA ${raStr(it.ra)} · Dec ${decStr(it.dec)}</dd></dl>
      <div class="shead" style="margin:6px 0 8px"><h2>NASA pictures</h2><span class="aside" id="gCount">searching…</span></div>
      <div class="gpics" id="gPics"></div>
      <button class="btn ghost" id="gLib">All pictures in the library</button>`;
    $('gLib').addEventListener('click', () => { $('libQ').value = it.term; show('library'); libSearch(); });
    pictures(it);
  }
}
async function pictures(it) {
  const box = $('gPics');
  try {
    const items = await search({ q: it.term, page_size: 6 });
    if (selected !== it) return;
    $('gCount').textContent = items.total ? `${items.total.toLocaleString('en-GB')} in NASA's library` : 'none found';
    box.innerHTML = items.list.map((p, j) => `<button data-j="${j}" aria-label="${esc(p[1])}"><img src="${A}${p[0]}/${p[0]}~thumb.jpg" data-id="${esc(p[0])}" data-try="thumb" alt="" loading="lazy"></button>`).join('')
      || '<p class="note" style="grid-column:1/-1;margin:0">NASA’s library has no pictures under this name.</p>';
    box.onclick = e => { const b = e.target.closest('[data-j]'); if (b) openViewer(items.list[+b.dataset.j]); };
  } catch { if (selected === it) $('gCount').textContent = 'library out of reach'; }
}

/* ---------- find ---------- */
const fold = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/^m\s+(\d)/, 'm$1');
const gq = $('gQ'), gl = $('gList'); let found = [], gsel = -1;
gq.addEventListener('input', () => {
  const f = fold(gq.value.trim()); found = []; gsel = -1;
  if (!f) { gl.hidden = true; return; }
  for (const it of [...sky, ...(events || [])]) {
    const keys = [it.name, it.id, it.desig || '', it.catTitle || ''].map(fold);
    if (keys.some(k => k.startsWith(f) || k.includes(' ' + f))) found.push(it);
    if (found.length >= 8) break;
  }
  gl.innerHTML = found.length ? found.map((it, j) => `<li role="option" id="gl${j}" aria-selected="false" data-j="${j}"><span>${esc(it.name)}</span><span class="k">${esc(it.kind === 'event' ? it.catTitle : it.type)}</span></li>`).join('')
    : '<li aria-disabled="true"><span class="note">Nothing by that name on the globe</span></li>';
  gl.hidden = false; gq.setAttribute('aria-expanded', 'true');
});
const pick = it => { gl.hidden = true; gq.setAttribute('aria-expanded', 'false'); gq.value = it.name; if (vis.spin) setSpin(false); goTo(it); select(it); };
gq.addEventListener('keydown', e => {
  if (gl.hidden || !found.length) return;
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault(); gsel = (gsel + (e.key === 'ArrowDown' ? 1 : -1) + found.length) % found.length;
    [...gl.children].forEach((li, j) => li.setAttribute('aria-selected', j === gsel)); gq.setAttribute('aria-activedescendant', 'gl' + gsel);
  } else if (e.key === 'Enter') { e.preventDefault(); pick(found[Math.max(gsel, 0)]); }
  else if (e.key === 'Escape') gl.hidden = true;
});
gl.addEventListener('mousedown', e => { const li = e.target.closest('li[data-j]'); if (li) { e.preventDefault(); pick(found[+li.dataset.j]); } });
gq.addEventListener('blur', () => setTimeout(() => { gl.hidden = true; }, 120));

/* ---------- show / hide chips ---------- */
function setSpin(v) { vis.spin = v; if (controls) controls.autoRotate = v; document.querySelector('[data-show="spin"]').setAttribute('aria-pressed', v); }
for (const c of document.querySelectorAll('[data-show]')) {
  if (c.dataset.show === 'spin') c.setAttribute('aria-pressed', vis.spin);
  c.addEventListener('click', () => {
    const k = c.dataset.show;
    if (k === 'spin') return setSpin(!vis.spin);
    vis[k] = !vis[k]; c.setAttribute('aria-pressed', vis[k]);
  });
}

/* ---------- NASA Image and Video Library: live search ---------- */
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
    (type === 'video' ? '<dt>Type</dt><dd>Video (plays in the built page)</dd>' : '') +
    (p ? `<dt>Photographer</dt><dd>${esc(p)}</dd>` : '') + `<dt>NASA ID</dt><dd class="mono">${esc(id)}</dd>`;
  $('vKw').innerHTML = k.map(x => `<span class="tag">${esc(x)}</span>`).join('');
  $('vFull').href = `${A}${id}/${id}~medium.jpg`;
  $('viewer').showModal();
}
Object.assign(CENTRES, { JPL: 'Jet Propulsion Laboratory', KSC: 'Kennedy Space Center', MSFC: 'Marshall Space Flight Center',
  HQ: 'NASA Headquarters', ARC: 'Ames Research Center', LARC: 'Langley Research Center', GRC: 'Glenn Research Center',
  AFRC: 'Armstrong Flight Research Center', SSC: 'Stennis Space Center' });

const lib = { page: 1, total: 0, busy: false, first: true };
const sel = document.querySelectorAll('.libfilters select');
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
  const centre = sel[0].value === 'Any' ? '' : sel[0].value.split(' ')[0];
  const from = /^\d{4}$/.test(sel[1].value) ? sel[1].value : '', to = /^\d{4}$/.test(sel[2].value) ? sel[2].value : '';
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
for (const c of document.querySelectorAll('.popular .chip')) c.addEventListener('click', () => libSearch());
for (const s of sel) s.addEventListener('change', () => libSearch());
typeChips.forEach((c, i) => c.addEventListener('click', () => { typeChips.forEach((x, j) => x.setAttribute('aria-pressed', i === j)); libSearch(); }));
document.querySelector('.more .btn').addEventListener('click', () => libSearch(true));
document.addEventListener('viewchange', e => { if (e.detail === 'library' && lib.first) { lib.first = false; libSearch(); } });
/* the picture-tab button on the Earth map's place card searches straight away */
document.addEventListener('click', e => { if (e.target.closest('.pop [data-q]')) { lib.first = false; libSearch(); } });
