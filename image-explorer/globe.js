/* NASA Data Projects · Image Explorer · the Globe tab · © 2026 Malcolm Syme · mcsyme11@gmail.com
 *
 * The Earth (NASA Blue Marble from GIBS), turned to the current sidereal time, inside the real sky: 5,044 stars to
 * magnitude 6, the 88 constellations' lines and about 1,350 galaxies, nebulae and star clusters (data/, built by
 * tools/build_sky.py from d3-celestial). Pins on the Earth are the natural events NASA EONET reported in the last
 * 30 days, and astronaut photos of Earth (data/astronaut.json, refreshed daily by fetch_astronaut_photos.py). Uses app.js's show(), nice(), esc(), search(), openViewer(), libSearch(), focusEarth() and A.
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

const vis = { events: true, photos: true, galaxy: true, nebula: true, cluster: true, lines: true, labels: true, spin: !reduce };
let renderer, scene, camera, controls, earth, earthMat, started = false, running = false;
let events = [], photos = [], sky = [], cons = [], lines = null, hits = [], selected = null, fly = null, hover = null;

/* ---------- sky objects: data/sky.json rows are
   [id, name, kind, type, ra, dec, magnitude, size in arcminutes, famous, search term, other designation] ---------- */

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

  camera.aspect = (frame.clientWidth || 1) / (frame.clientHeight || 1);
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
  loadPhotos();
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
    const rows = await (await fetch('data/stars.json')).json();
    const n = rows.length, pos = new Float32Array(n * 3), size = new Float32Array(n), col = new Float32Array(n * 3);
    rows.forEach(([ra, dec, m, bv], i) => {
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
  try {                                                  /* constellation lines, faint brass */
    cons = await (await fetch('data/constellations.json')).json();
    const pts = [];
    for (const c of cons) for (const seg of c.lines) for (let i = 1; i < seg.length; i++)
      pts.push(vec(seg[i - 1][1], seg[i - 1][0], STAR_R - 2), vec(seg[i][1], seg[i][0], STAR_R - 2));
    for (const c of cons) c.pos = vec(c.at[1], c.at[0], STAR_R - 2);
    lines = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x7e6a45, transparent: true, opacity: 0.55, depthWrite: false }));
    lines.visible = vis.lines; scene.add(lines);
  } catch { cons = []; }
}

/* ---------- galaxies, nebulae, clusters ---------- */
async function loadSky() {
  try {
    const rows = await (await fetch('data/sky.json')).json();
    sky = rows.map(([id, name, kind, type, ra, dec, mag, dim, famous, term, alt]) =>
      ({ id, name, kind, type, ra, dec, mag, dim, famous: !!famous, term, desig: [id, alt].filter(Boolean).join(' · '), pos: vec(dec, ra, SKY_R) }));
  } catch { tag('The sky objects could not be loaded right now.'); }
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

/* ---------- astronaut photos of Earth (cataloged ones, with the position of the photo's centre) ---------- */
const EOL = 'https://eol.jsc.nasa.gov/';
async function loadPhotos() {
  try {
    const j = await (await fetch('data/astronaut.json')).json();
    photos = (j.photos || []).map(([id, date, time, lat, lon, place, feat, cloud, small, large]) => ({
      id, kind: 'photo', name: place || 'Astronaut photo', date, time, lat, lon, feat, cloud, small, large, local: vec(lat, lon, 1.004) }));
  } catch { photos = []; }
  document.querySelector('[data-show="photos"]').hidden = !photos.length;
  status();
}

function status() {
  const ev = events === null ? 'events unavailable right now' : `${events.length} events on Earth in the last 30 days`;
  tag(`${ev}${photos.length ? ` · ${photos.length} astronaut photos` : ''} · ${sky.length.toLocaleString('en-GB')} sky objects · as of ${new Date().toUTCString().slice(17, 22)} UTC`);
  $('gSrc').textContent = 'Earth: NASA Blue Marble (GIBS). Events: NASA EONET, live. Stars to magnitude 6, galaxies, nebulae, clusters and constellations: d3-celestial.';
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
  const label = (x, y, text, colour, gap = 9) => {      /* gap: room for the selection ring */
    const tw = ctx.measureText(text).width, box = [x + gap, y - 8, tw + 4, 16];
    if (labels.some(b => box[0] < b[0] + b[2] && b[0] < box[0] + box[2] && box[1] < b[1] + b[3] && b[1] < box[1] + box[3])) return;
    labels.push(box);
    ctx.fillStyle = 'rgba(5,8,13,.65)'; ctx.fillRect(box[0] - 2, box[1], box[2] + 2, box[3]);
    ctx.fillStyle = colour; ctx.fillText(text, x + gap + 1, y);
  };

  /* constellation names, faint, when the lines are shown */
  if (vis.lines && vis.labels && lines) {
    ctx.fillStyle = 'rgba(126,106,69,.9)'; ctx.font = 'italic 11px Georgia, "Palatino Linotype", serif';
    for (const c of cons) {
      const dir = c.pos.clone().sub(cam).normalize(), b = cam.dot(dir), disc = b * b - (cam.lengthSq() - 1);
      if (disc > 0 && -b - Math.sqrt(disc) > 0) continue;
      const s = c.pos.clone().project(camera); if (s.z > 1 || Math.abs(s.x) > 1 || Math.abs(s.y) > 1) continue;
      const t = c.name.toUpperCase();
      ctx.fillText(t, (s.x + 1) / 2 * w - ctx.measureText(t).width / 2, (1 - s.y) / 2 * h);
    }
    ctx.font = '12px Georgia, "Palatino Linotype", serif';
  }

  /* sky: hidden behind the Earth; names for the famous ones when zoomed out; faint objects drawn smaller */
  for (const o of sky) {
    if (!vis[o.kind]) continue;
    const dir = o.pos.clone().sub(cam).normalize(), b = cam.dot(dir), disc = b * b - (cam.lengthSq() - 1);
    if (disc > 0 && -b - Math.sqrt(disc) > 0) continue;
    const at = place(o.pos, o, 9); if (!at) continue;
    const [x, y] = at, sel = selected === o, hov = hover === o, big = o.famous || (o.mag != null && o.mag <= 9) || sel || hov, k = big ? 1 : 0.62;
    ctx.globalAlpha = big ? 1 : 0.8;
    ctx.strokeStyle = ctx.fillStyle = sel || hov ? BRIGHT : o.kind === 'cluster' ? INK2 : BRASS;
    ctx.lineWidth = big ? 1.5 : 1.1;
    if (o.kind === 'galaxy') { ctx.beginPath(); ctx.ellipse(x, y, 6 * k, 3.6 * k, -0.5, 0, 7); ctx.stroke(); }
    else if (o.kind === 'nebula') { ctx.beginPath(); ctx.moveTo(x, y - 5 * k); ctx.lineTo(x + 4 * k, y); ctx.lineTo(x, y + 5 * k); ctx.lineTo(x - 4 * k, y); ctx.closePath(); ctx.fill(); }
    else { ctx.beginPath(); ctx.arc(x, y, 2.6 * k, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    if (sel) { ctx.beginPath(); ctx.arc(x, y, 11, 0, 7); ctx.stroke(); }
    if (sel || hov || (vis.labels && o.famous && dist > 2.4)) label(x, y, o.name, sel || hov ? BRIGHT : INK2, sel ? 14 : 9);
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
    if (sel || hover === e || (vis.labels && dist < 1.5)) label(x, y, e.name, sel || hover === e ? BRIGHT : INK2, sel ? r + 8 : 9);
  }

  /* astronaut photos: small blue squares where each photo's centre is */
  if (vis.photos) for (const ph of photos) {
    const p = ph.local.clone().applyMatrix4(m);
    if (p.dot(cam.clone().sub(p)) <= 0) continue;
    const at = place(p, ph, 9); if (!at) continue;
    const [x, y] = at, r = dist < 1.6 ? 4.5 : dist < 3 ? 3.5 : 2.6, sel = selected === ph;
    ctx.fillStyle = '#8AA9C9'; ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
    ctx.strokeStyle = 'rgba(5,8,13,.8)'; ctx.lineWidth = 1; ctx.strokeRect(x - r, y - r, 2 * r, 2 * r);
    if (sel) { ctx.strokeStyle = BRIGHT; ctx.lineWidth = 1.5; ctx.strokeRect(x - r - 5, y - r - 5, 2 * r + 10, 2 * r + 10); }
    if (sel || hover === ph) label(x, y, ph.name, BRIGHT, sel ? r + 9 : 9);
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
    tip.innerHTML = `<b>${esc(hover.name)}</b><br>${esc(hover.kind === 'event' ? hover.catTitle + ' · ' + nice(hover.date) : hover.kind === 'photo' ? 'Astronaut photo · ' + nice(hover.date) : hover.type)}`;
    tip.style.left = e.clientX + 14 + 'px'; tip.style.top = e.clientY + 14 + 'px'; tip.hidden = false;
  });
  el.addEventListener('pointerleave', () => { hover = null; tip.hidden = true; });
}

/* ---------- camera moves ---------- */
/* stand on the far side of the Earth from a sky direction, a little to one side, so the sky shows beside the Earth.
   Narrow (portrait) screens see less sky to the sides, so the view stands farther back and closer to the line. */
function skyView(u, dist) {
  const narrow = camera.aspect < 1;
  u = u.clone().normalize();
  const side = new THREE.Vector3(0, 1, 0).cross(u);
  if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
  return u.negate().add(side.normalize().multiplyScalar(narrow ? 0.17 : 0.45)).normalize().multiplyScalar(narrow ? Math.max(dist, 8) : dist);
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
  if (it.kind === 'event' || it.kind === 'photo') {
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
  if (it.kind === 'photo') {
    const [mission, roll, frame] = it.id.split('-');
    card.innerHTML = `<h2>Selected</h2><div class="eyebrow">Astronaut photo</div><h3>${esc(it.name)}</h3>
      <a class="gphoto" href="${EOL}DatabaseImages/${esc(it.large)}" target="_blank" rel="noopener"><img onerror="this.parentNode.hidden = true" src="${EOL}DatabaseImages/${esc(it.small)}" alt="Astronaut photo of ${esc(it.name)}, ${esc(it.id)}"></a>
      <dl class="facts"><dt>Taken</dt><dd>${nice(it.date)}, ${esc(it.time)} UTC</dd>
      ${it.feat ? `<dt>Shows</dt><dd>${esc(it.feat)}</dd>` : ''}
      <dt>Cloud</dt><dd>${it.cloud}% of the picture</dd>
      <dt>Photo</dt><dd class="mono">${esc(it.id)}</dd>
      <dt>Centre</dt><dd class="mono">${Math.abs(it.lat).toFixed(1)}° ${it.lat >= 0 ? 'N' : 'S'}, ${Math.abs(it.lon).toFixed(1)}° ${it.lon >= 0 ? 'E' : 'W'}</dd></dl>
      <a class="btn ghost" href="${EOL}SearchPhotos/photo.pl?mission=${encodeURIComponent(mission)}&roll=${encodeURIComponent(roll)}&frame=${encodeURIComponent(frame)}" target="_blank" rel="noopener">The photo on NASA's site</a>
      <button class="btn ghost" id="gEarth">See it on the Earth map</button>
      <p class="note" style="margin:12px 0 0">${/^ISS/.test(it.id) ? 'Taken from the International Space Station. ' : ''}Image courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center.</p>`;
    $('gEarth').addEventListener('click', () => focusEarth(it.lat, it.lon, it.date, null));
  } else if (it.kind === 'event') {
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
  for (const it of [...sky, ...(events || []), ...photos]) {
    const keys = [it.name, it.id, it.desig || '', it.catTitle || ''].map(fold);
    if (keys.some(k => k.startsWith(f) || k.includes(' ' + f))) found.push(it);
    if (found.length >= 8) break;
  }
  gl.innerHTML = found.length ? found.map((it, j) => `<li role="option" id="gl${j}" aria-selected="false" data-j="${j}"><span>${esc(it.name)}</span><span class="k">${esc(it.kind === 'event' ? it.catTitle : it.kind === 'photo' ? 'Astronaut photo · ' + nice(it.date) : it.type)}</span></li>`).join('')
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
    if (k === 'lines' && lines) lines.visible = vis.lines;
  });
}
