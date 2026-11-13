// NASA and ESA Data Projects · Sky Finder · the camera view and calibration · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Draws markers over the camera picture where things are in the sky: the chosen asteroid (a diamond) with its path
// over the next hours, the other asteroids, the Moon, the planets, bright stars, the space stations, the horizon and
// the compass points. The camera picture is only shown on the screen: it is never recorded, saved or sent.
//
// From a direction in the sky to a point on the screen (pinhole camera):
//   v = the direction as an Earth-frame unit vector (x east, y north, z up), from altitude and azimuth
//   f = v·forward, x = v·right, y = v·up      (forward, right, up: where the phone points; orient.js)
//   on screen: X = W/2 + F·x/f,  Y = H/2 − F·y/f,  with F = (L/2) / tan(θ/2)
// where L is the long side of the camera picture as shown and θ the camera's field of view along that side
// (65° by default, a typical phone main camera; adjustable in Calibrate). When f ≤ 0 the thing is behind the phone.
// Calibration: with the real Moon (or a planet or star) in the centre circle, the difference between where the
// sensors say the phone points and where that object really is (ΔA in azimuth, Δh in altitude) is stored and taken
// off every object: A − ΔA, h − Δh.

import { startOrientation, askMotion, basisLook, vecOf, altAzOf, wrap180, dot } from './orient.js';
import { positions, pathOf } from './targets.js';
import { compass, compassWord, needFor } from '../shared/sky.js';

const CAL_KEY = 'nasa-data-projects.sky-finder.calibration';
const FOV_KEY = 'nasa-data-projects.sky-finder.fov';
const CAL_HOURS = 12;
const COL = { brass: '#C0A062', bright: '#E2C88E', ink: '#EDE6D3', muted: '#B4AFA2', blue: '#8AA9C9', rose: '#D9A0A0', red: '#C9675A', outline: 'rgba(8,11,17,.9)' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const hhmm = (ms) => new Date(ms).toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit', hour12: false });
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private browsing */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* nothing */ } },
};
export function calibration() {
  const c = store.get(CAL_KEY);
  return c && Date.now() - c.at < CAL_HOURS * 3600e3 && Number.isFinite(c.dAz) && Number.isFinite(c.dAlt) ? c : null;
}
export const forgetCalibration = () => store.del(CAL_KEY);
export const fovSetting = () => { const v = Number(store.get(FOV_KEY)); return v >= 30 && v <= 100 ? v : 65; };

// root: the full-screen view element. opts: { sky, place, target (asteroid des, or 'moon', 'jupiter' …), onClose }
export function openView(root, opts) {
  const { sky, place } = opts;
  let target = opts.target || null, mode = 'look', calPick = null;
  let basis = basisLook(30, 180), sensors = 'none', orient = null, stream = null, wake = null, raf = 0, items = [], path = null, pathFor = null;
  let lastItemsAt = 0, drag = null, dragAlt = 30, dragAz = 180, alive = true, motionAllowed = false, gotReading = false;
  let cal = calibration(), fov = fovSetting();

  root.innerHTML = `
    <video class="cam" playsinline muted autoplay aria-hidden="true"></video>
    <div class="nocam" hidden></div>
    <canvas class="sky" aria-hidden="true"></canvas>
    <div class="reticle" aria-hidden="true"></div>
    <div class="calring" hidden aria-hidden="true"><span>Put it here</span></div>
    <header class="vbar">
      <button class="vbtn vback" type="button" aria-label="Back to tonight's list">‹</button>
      <div class="looking" role="status" aria-live="off"><span class="lk">Looking</span> <b id="vLook">—</b></div>
      <button class="vbtn cal" type="button" aria-describedby="vCalState">Calibrate</button>
      <span class="sr" id="vCalState"></span>
    </header>
    <div class="vwarn" role="alert" hidden></div>
    <section class="sheet" aria-label="What you are looking for">
      <div class="chips sfpick" data-hscroll role="group" aria-label="Show"></div>
      <div class="shbody" aria-live="polite"></div>
    </section>
    <section class="calsheet" hidden aria-label="Calibrate">
      <h2>Put something bright in the circle</h2>
      <div class="chips" data-hscroll role="group" aria-label="What to line up"></div>
      <p class="caloff" id="vCalOff"></p>
      <button class="btn" type="button" id="vCalDone">Done, it is in the circle</button>
      <div class="calrow">
        <button class="linkbtn" type="button" id="vCalSkip">Skip for now</button>
        <button class="linkbtn" type="button" id="vCalReset" hidden>Undo calibration</button>
      </div>
      <p class="calwhy">Phone compasses are often 5 to 15 degrees off. Put the real thing inside the brass circle, then tap Done: every marker moves by the same amount.</p>
      <details class="fov"><summary>Markers too spread out or too close together?</summary>
        <label>Camera view across the long side of the screen: <b id="vFovV">${fov}°</b>
          <input type="range" min="40" max="90" step="1" value="${fov}" id="vFov"></label>
        <p class="hint">Most phones are near 65°. Line two bright things up: if the second marker lands outside the real one, lower the number.</p>
      </details>
    </section>`;
  const $ = (s) => root.querySelector(s);
  const canvas = $('canvas.sky'), ctx = canvas.getContext('2d'), video = $('video.cam');
  root.hidden = false;
  document.documentElement.classList.add('viewing');

  // ------------------------------------------------------------ camera, sensors, screen kept on
  async function startCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { noCamera('This browser cannot show the camera here. The markers still work: hold the phone up to the sky.'); return; }
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
      if (!alive) { stream.getTracks().forEach((t) => t.stop()); return; }
      video.srcObject = stream; video.play().catch(() => {});
    } catch (e) {
      noCamera(e && e.name === 'NotAllowedError' ? 'Camera not allowed. The markers still work over a dark background; to see the sky behind them, allow the camera for this site in the browser settings.' : 'No camera could be opened. The markers still work over a dark background.');
    }
  }
  function noCamera(msg) { video.hidden = true; $('.nocam').hidden = false; warn(msg, 6000); }
  function startSensors(granted) {
    motionAllowed = granted;
    // listen in any case (some browsers report "denied" yet send readings); fall back to drag-to-look without them
    orient = startOrientation((s) => { gotReading = true; sensors = s.kind; basis = s.basis; });
    setTimeout(() => {
      if (!alive || gotReading) return;
      sensors = 'none';
      warn(granted ? 'No motion readings from this device, so drag the sky to look around.'
        : 'Motion sensors are off, so drag the sky to look around. On an iPhone, allow "Motion & Orientation Access" when asked (close Sky Finder and open it again to be asked again).', 7000);
    }, 1800);
  }
  async function keepAwake() { try { wake = await navigator.wakeLock.request('screen'); } catch { wake = null; } }
  const onVis = () => { if (document.visibilityState === 'visible' && alive && !wake) keepAwake(); };
  document.addEventListener('visibilitychange', onVis);

  let warnT = null;
  function warn(msg, ms = 4000) { const w = $('.vwarn'); w.textContent = msg; w.hidden = false; clearTimeout(warnT); warnT = setTimeout(() => { w.hidden = true; }, ms); }

  // ------------------------------------------------------------ drag to look (no sensors), tap a marker to choose it
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, alt: dragAlt, az: dragAz, moved: false }; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 6) drag.moved = true;
    if (sensors === 'none' && drag.moved) {
      const degPx = fov / Math.max(innerWidth, innerHeight);
      dragAz = (drag.az - dx * degPx + 360) % 360; dragAlt = Math.max(-30, Math.min(89, drag.alt + dy * degPx));
    }
  });
  canvas.addEventListener('pointerup', (e) => { const d = drag; drag = null; if (d && !d.moved) tapAt(e.clientX, e.clientY); });
  canvas.addEventListener('pointercancel', () => { drag = null; });
  function tapAt(x, y) {
    let best = null;
    for (const it of items) {
      if (!it.sx || it.kind === 'star' && !it.name || it.kind === 'sun') continue;
      const d = Math.hypot(it.sx - x, it.sy - y);
      if (d < 34 && (!best || d < best.d)) best = { d, it };
    }
    if (!best) return;
    const it = best.it;
    if (mode === 'cal') { if (it.kind !== 'asteroid') { calPick = it.key === 'star' ? 'star:' + it.name : it.key; renderCal(); } return; }
    choose(keyOfItem(it));
  }

  // ------------------------------------------------------------ projection
  function frame() {
    const W = innerWidth, H = innerHeight;
    let L = Math.max(W, H);
    if (!video.hidden && video.videoWidth) {          // object-fit: cover; the picture's long side as shown
      const s = Math.max(W / video.videoWidth, H / video.videoHeight);
      L = Math.max(video.videoWidth, video.videoHeight) * s;
    }
    return { W, H, F: (L / 2) / Math.tan(fov / 2 * Math.PI / 180) };
  }
  const corrected = (alt, az) => (cal ? { alt: alt - cal.dAlt, az: az - cal.dAz } : { alt, az });
  function project(alt, az, fr, b) {
    const c = corrected(alt, az), v = vecOf(c.alt, c.az), f = dot(v, b.f);
    const x = dot(v, b.r), y = dot(v, b.u);
    return { f, x, y, sx: fr.W / 2 + fr.F * x / f, sy: fr.H / 2 - fr.F * y / f, on: f > 0.05 };
  }
  // where the phone points, after calibration
  function pointing(b) { const p = altAzOf(b.f); return cal ? { alt: p.alt + cal.dAlt, az: (p.az + cal.dAz + 360) % 360 } : p; }

  // ------------------------------------------------------------ drawing
  function draw() {
    if (!alive) return;
    raf = requestAnimationFrame(draw);
    const now = Date.now();
    if (now - lastItemsAt > 1000) { items = positions(sky, place, now, target); lastItemsAt = now; if (mode === 'look') renderSheet(false); else renderCal(); }
    if (sensors === 'none') basis = basisLook(dragAlt, dragAz);
    const fr = frame(), b = basis, dpr = Math.min(2, devicePixelRatio || 1);
    if (canvas.width !== Math.round(fr.W * dpr) || canvas.height !== Math.round(fr.H * dpr)) { canvas.width = Math.round(fr.W * dpr); canvas.height = Math.round(fr.H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, fr.W, fr.H);
    const p = pointing(b);
    { const a = Math.round(p.alt); $('#vLook').textContent = `${compassWord(p.az).replace(/^./, (c) => c.toUpperCase())} · ${Math.abs(a)}° ${a >= 0 ? 'up' : 'down'}`; }

    // the horizon and the compass points
    ctx.lineWidth = 1.2; ctx.strokeStyle = 'rgba(192,160,98,.55)'; ctx.setLineDash([]);
    ctx.beginPath(); let pen = false;
    for (let az = 0; az <= 360; az += 2) {
      const q = project(0, az, fr, b);
      if (q.f > 0.15 && Math.abs(q.sx) < 4 * fr.W) { pen ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy); pen = true; } else pen = false;
    }
    ctx.stroke();
    for (let az = 0; az < 360; az += 45) {
      const q = project(0, az, fr, b);
      if (q.on) label(compass(az), q.sx, q.sy + 18, { color: az === 0 ? COL.bright : COL.brass, size: az % 90 ? 12 : 15, align: 'center' });
    }

    // stars, then planets, Moon, stations, asteroids
    for (const it of items) { it.sx = it.sy = null; }
    for (const it of items.filter((i) => i.kind === 'star')) {
      const q = project(it.alt, it.az, fr, b);
      if (!q.on || q.sx < -20 || q.sx > fr.W + 20 || q.sy < -20 || q.sy > fr.H + 20) continue;
      it.sx = q.sx; it.sy = q.sy;
      const r = Math.max(0.8, 3.2 - it.mag * 0.6);
      ctx.fillStyle = 'rgba(237,230,211,.85)'; ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, 7); ctx.fill();
      if (it.name && it.mag < 1.6) label(it.name, q.sx + 6, q.sy - 5, { color: 'rgba(180,175,162,.9)', size: 11 });
    }
    const sel = selected();
    // the chosen asteroid's path
    if (sel && sel.kind === 'asteroid') {
      if (!path || pathFor !== sel.obj.des || now - path.at > 60000) { path = { at: now, pts: pathOf(sel.obj, place, now) }; pathFor = sel.obj.des; }
      ctx.setLineDash([3, 5]); ctx.strokeStyle = 'rgba(226,200,142,.75)'; ctx.lineWidth = 1.6; ctx.beginPath(); pen = false;
      const marks = [];
      for (const pt of path.pts) {
        const q = project(pt.alt, pt.az, fr, b);
        if (q.on && Math.abs(q.sx) < 4 * fr.W) { pen ? ctx.lineTo(q.sx, q.sy) : ctx.moveTo(q.sx, q.sy); pen = true; if (pt.hour) marks.push([q, pt]); } else pen = false;
      }
      ctx.stroke(); ctx.setLineDash([]);
      for (const [q, pt] of marks) {
        ctx.fillStyle = COL.bright; ctx.beginPath(); ctx.arc(q.sx, q.sy, 2.6, 0, 7); ctx.fill();
        label(hhmm(pt.ms), q.sx + 7, q.sy + 4, { color: COL.bright, size: 11 });
      }
    }
    for (const it of items.filter((i) => i.kind !== 'star')) {
      const q = project(it.alt, it.az, fr, b);
      if (!q.on || q.sx < -40 || q.sx > fr.W + 40 || q.sy < -40 || q.sy > fr.H + 40) continue;
      it.sx = q.sx; it.sy = q.sy;
      const isSel = sel && it === sel;
      if (it.kind === 'sun') {
        ctx.fillStyle = 'rgba(201,103,90,.35)'; ctx.strokeStyle = COL.red; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, 16, 0, 7); ctx.fill(); ctx.stroke();
        label('Sun: never look at it', q.sx, q.sy - 24, { color: COL.red, size: 13, align: 'center' });
      } else if (it.kind === 'moon') {
        const r = Math.max(9, fr.F * 0.0045);
        ctx.fillStyle = 'rgba(237,230,211,.18)'; ctx.strokeStyle = COL.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.sx, q.sy, r, 0, 7); ctx.fill(); ctx.stroke();
        label('Moon', q.sx + r + 6, q.sy + 4, { color: COL.ink, size: 13 });
      } else if (it.kind === 'planet') {
        if (it.alt < -1) continue;
        ctx.strokeStyle = COL.brass; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(q.sx, q.sy, 7, 0, 7); ctx.stroke();
        label(it.name, q.sx + 11, q.sy + 4, { color: COL.brass, size: 13 });
      } else if (it.kind === 'station') {
        if (it.alt < 0) continue;
        ctx.strokeStyle = it.lit ? COL.blue : 'rgba(138,169,201,.45)'; ctx.lineWidth = 1.5; ctx.strokeRect(q.sx - 5, q.sy - 5, 10, 10);
        label(it.name + (it.lit ? '' : ' (in shadow)'), q.sx + 10, q.sy + 4, { color: COL.blue, size: 12 });
      } else if (it.kind === 'asteroid') {
        if (it.alt < -1 && !isSel) continue;
        const s = isSel ? 9 : 5;
        ctx.fillStyle = isSel ? COL.bright : 'rgba(217,160,160,.85)'; ctx.strokeStyle = COL.outline; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(q.sx, q.sy - s); ctx.lineTo(q.sx + s, q.sy); ctx.lineTo(q.sx, q.sy + s); ctx.lineTo(q.sx - s, q.sy); ctx.closePath(); ctx.stroke(); ctx.fill();
        if (isSel) { ctx.strokeStyle = 'rgba(226,200,142,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.sx, q.sy, 18, 0, 7); ctx.stroke(); }
        label(shortName(it.name) + (isSel ? ' · now' : ''), q.sx + s + 6, q.sy + 4, { color: isSel ? COL.bright : COL.rose, size: isSel ? 14 : 11 });
      }
      if (isSel && it.kind !== 'asteroid') { ctx.strokeStyle = 'rgba(226,200,142,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(q.sx, q.sy, 22, 0, 7); ctx.stroke(); }
    }

    // the way to the chosen thing, when it is off the screen
    const want = mode === 'cal' ? calTarget() : sel;
    if (want) {
      const q = project(want.alt, want.az, fr, b), m = 34;
      const low = mode === 'cal' ? ($('.calsheet').offsetHeight || 260) : sheetH;
      const inside = q.on && q.sx > m && q.sx < fr.W - m && q.sy > m + 50 && q.sy < fr.H - low - 10;
      if (!inside) {
        const ang = Math.atan2(-q.y, q.x) + (q.f < 0 && Math.hypot(q.x, q.y) < 0.2 ? Math.PI : 0);
        const top = 64 + m, bot = fr.H - low - m, cx = fr.W / 2, cy = (top + bot) / 2, rx = fr.W / 2 - m, ry = Math.max(40, (bot - top) / 2);
        const t = Math.min(rx / Math.abs(Math.cos(ang) || 1e-6), ry / Math.abs(Math.sin(ang) || 1e-6));
        const ax = cx + Math.cos(ang) * t, ay = cy + Math.sin(ang) * t;
        ctx.save(); ctx.translate(ax, ay); ctx.rotate(ang);
        ctx.fillStyle = COL.bright; ctx.strokeStyle = COL.outline; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -12); ctx.lineTo(-3, 0); ctx.lineTo(-8, 12); ctx.closePath(); ctx.stroke(); ctx.fill();
        ctx.restore();
      }
    }
  }
  function label(text, x, y, o) {
    ctx.font = `${o.size || 12}px Georgia, "Palatino", serif`; ctx.textAlign = o.align || 'left';
    ctx.lineWidth = 3.5; ctx.strokeStyle = COL.outline; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
    ctx.fillStyle = o.color || COL.ink; ctx.fillText(text, x, y);
  }
  const shortName = (n) => n.replace(/^\((.*)\)$/, '$1').replace(/^(\d+) (\S+) \(.*\)$/, '$2');

  function selected() {
    if (!target) return null;
    if (target.startsWith('star:')) return items.find((i) => i.kind === 'star' && i.name === target.slice(5)) || null;
    return items.find((i) => (i.kind === 'asteroid' ? i.obj.des === target : i.key === target)) || null;
  }

  // ------------------------------------------------------------ the sheet under the view
  function turnHint(it) {
    const fr = frame(), q = project(it.alt, it.az, fr, basis);
    const h = Math.atan2(q.x, q.f) * 180 / Math.PI, v = Math.atan2(q.y, Math.hypot(q.f, q.x)) * 180 / Math.PI;
    if (Math.abs(h) < 4 && Math.abs(v) < 4) return 'It is in the middle of the screen.';
    const lr = Math.abs(h) < 4 ? '' : `${h > 0 ? 'right' : 'left'}${Math.abs(h) > 60 ? '' : Math.abs(h) > 20 ? '' : ' a little'}`;
    const ud = Math.abs(v) < 4 ? '' : `${v > 0 ? 'up' : 'down'}${Math.abs(v) > 20 ? '' : ' a little'}`;
    if (Math.abs(h) > 120) return `Turn around${ud ? ', then ' + ud : ''}.`;
    return `Turn ${[lr, ud].filter(Boolean).join(' and ')} to centre it.`;
  }
  // the row of things to switch to without leaving the view: the brightest asteroids, the Moon, the planets and the
  // space stations that are up (the chosen one is always there)
  let pickKey = '';
  const keyOfItem = (i) => (i.kind === 'asteroid' ? i.obj.des : i.kind === 'star' ? 'star:' + i.name : i.key);
  function renderPick() {
    const ast = items.filter((i) => i.kind === 'asteroid').sort((a, c) => a.mag - c.mag);
    const pick = [...ast.filter((i) => keyOfItem(i) === target || keyOfItem(i) === opts.target || i.alt > 0).slice(0, 6),
      ...items.filter((i) => (i.kind === 'moon' || i.kind === 'planet' || i.kind === 'station') && i.alt > 0)];
    const sel = selected();
    if (sel && !pick.includes(sel)) pick.unshift(sel);
    const k = pick.map(keyOfItem).join() + '|' + target;
    if (k === pickKey) return;
    pickKey = k;
    $('.sfpick').hidden = !pick.length;
    $('.sfpick').innerHTML = pick.map((i) => `<button type="button" class="chip" data-k="${esc(keyOfItem(i))}" aria-pressed="${keyOfItem(i) === target}">${esc(i.kind === 'asteroid' ? shortName(i.name) : i.name)}</button>`).join('');
  }
  function choose(k) {
    target = k; path = null; pickKey = ''; renderPick(); renderSheet(true);
    if (opts.onTarget) opts.onTarget(k);
    if (navigator.vibrate) navigator.vibrate(8);
  }
  $('.sfpick').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) choose(b.dataset.k); });

  let sheetKey = '', sheetH = 150;
  function renderSheet(force) {
    renderPick();
    const it = selected(), sh = $('.shbody');
    if (!target || !it) {
      const k = 'none' + (target || '');
      if (!force && sheetKey === k) return; sheetKey = k;
      sh.innerHTML = `<div class="sh1"><b>Hold the phone up to the sky</b></div><p class="shnote">${target ? 'That one is not in tonight\'s data any more.' : 'Tap a marker, or a name above, to see what it is.'} Diamonds are asteroids, circles planets, squares space stations.</p>`;
      sheetH = $('.sheet').offsetHeight || sheetH;
      return;
    }
    const up = it.alt >= 0;
    let lines = '', head = '', note = '';
    if (it.kind === 'asteroid') {
      const need = needFor(it.mag);
      head = `<b>${esc(it.name)}</b> <span class="need n-${need.key}">${esc(need.label)}</span>`;
      lines = `<span><i>${up ? 'Up' : 'Below the horizon'}</i> ${Math.round(Math.abs(it.alt))}° · ${compass(it.az)}</span><span><i>Brightness</i> magnitude ${it.mag.toFixed(1)}</span><span><i>Closest</i> ${new Date((it.obj.ca_jd - 2440587.5) * 86400000).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}, ${it.obj.ca_ld.toFixed(1)} Moon dist.</span>`;
      note = it.mag > 9 ? 'Too faint for the phone camera: the diamond marks where it is. ' : '';
    } else {
      const what = { moon: 'the Moon', planet: it.name, station: it.name === 'ISS' ? 'the International Space Station' : 'the Tiangong space station', star: it.name, sun: 'the Sun' }[it.kind];
      head = `<b>${esc(what.replace(/^the /, (s) => s).replace(/^./, (c) => c.toUpperCase()))}</b>`;
      lines = `<span><i>${up ? 'Up' : 'Below the horizon'}</i> ${Math.round(Math.abs(it.alt))}° · ${compass(it.az)}</span>${it.kind === 'moon' ? `<span><i>Lit</i> ${Math.round(it.lit * 100)}%</span>` : ''}${it.kind === 'station' ? `<span><i>${it.lit ? 'In sunlight' : 'In Earth\'s shadow'}</i></span>` : ''}`;
      if (it.kind === 'sun') note = 'Never point binoculars, a telescope or your eyes at the Sun. ';
    }
    const hint = up ? turnHint(it) : 'It is below your horizon now; see tonight\'s list for when it rises.';
    const html = `<div class="sh1">${head}</div><div class="shl">${lines}</div><p class="shnote">${note}${esc(hint)}</p>`;
    if (html !== sh.innerHTML) sh.innerHTML = html;
    sheetH = $('.sheet').offsetHeight || sheetH;
  }

  // ------------------------------------------------------------ calibration
  function calChoices() {
    const up = items.filter((i) => i.alt > 3 && (i.kind === 'moon' || i.kind === 'planet' || (i.kind === 'star' && i.name && i.mag < 1.6)));
    const order = { moon: 0, planet: 1, star: 2 };
    return up.sort((a, c) => order[a.kind] - order[c.kind] || (a.mag ?? -5) - (c.mag ?? -5)).slice(0, 8);
  }
  function calTarget() {
    const ch = calChoices();
    if (!calPick || !ch.some((c) => keyOf(c) === calPick)) calPick = ch[0] ? keyOf(ch[0]) : null;
    return ch.find((c) => keyOf(c) === calPick) || null;
  }
  const keyOf = (c) => (c.kind === 'star' ? 'star:' + c.name : c.key);
  let calChipsKey = '';
  function calState() {
    const b = $('.vbtn.cal');
    b.classList.toggle('ok', !!cal);
    const h = cal ? Math.round((Date.now() - cal.at) / 3600e3) : 0;
    $('#vCalState').textContent = cal ? `Calibrated on ${cal.on} ${h < 1 ? 'less than an hour' : h === 1 ? 'an hour' : h + ' hours'} ago.` : 'Not calibrated yet.';
    b.title = $('#vCalState').textContent;
  }
  function renderCal() {
    const ch = calChoices(), t = calTarget(), chips = $('.calsheet .chips');
    const k = ch.map(keyOf).join() + '|' + calPick;
    if (k !== calChipsKey) {
      calChipsKey = k;
      chips.innerHTML = ch.length ? ch.map((c) => `<button type="button" class="chip" data-k="${esc(keyOf(c))}" aria-pressed="${keyOf(c) === calPick}">${esc(c.kind === 'moon' ? 'Moon' : c.name)}</button>`).join('')
        : '<span class="hint">Nothing bright is above your horizon just now. Try again when the Moon or a planet is up.</span>';
    }
    $('#vCalDone').disabled = !t;
    $('#vCalReset').hidden = !cal;
    if (!t) { $('#vCalOff').textContent = ''; return; }
    const p = pointing(basis), dA = wrap180(t.az - p.az), dH = t.alt - p.alt;
    $('#vCalOff').innerHTML = `Where the sensors say ${esc(t.kind === 'moon' ? 'the Moon' : t.name)} is: <b>${Math.abs(dA).toFixed(0)}° ${dA >= 0 ? 'right' : 'left'} · ${Math.abs(dH).toFixed(0)}° ${dH >= 0 ? 'up' : 'down'}</b> of the circle.`;
  }
  $('.calsheet .chips').addEventListener('click', (e) => { const b = e.target.closest('[data-k]'); if (b) { calPick = b.dataset.k; calChipsKey = ''; renderCal(); } });
  function enterCal() {
    if (!alive) return;
    mode = 'cal'; root.classList.add('calibrating'); $('.calsheet').hidden = false; $('.calring').hidden = false; $('.sheet').hidden = true;
    calChipsKey = ''; renderCal();
  }
  function leaveCal() { mode = 'look'; root.classList.remove('calibrating'); $('.calsheet').hidden = true; $('.calring').hidden = true; $('.sheet').hidden = false; sheetKey = ''; renderSheet(true); }
  $('.vbtn.cal').addEventListener('click', () => (mode === 'cal' ? leaveCal() : enterCal()));
  $('#vCalSkip').addEventListener('click', leaveCal);
  $('#vCalDone').addEventListener('click', () => {
    const t = calTarget(); if (!t) return;
    const raw = altAzOf(basis.f);   // sensors only, without the old calibration
    cal = { dAz: wrap180(t.az - raw.az), dAlt: t.alt - raw.alt, at: Date.now(), on: t.kind === 'moon' ? 'Moon' : t.name };
    store.set(CAL_KEY, cal); calState();
    if (navigator.vibrate) navigator.vibrate([10, 40, 10]);
    warn(`Calibrated on ${cal.on}: ${Math.abs(cal.dAz).toFixed(0)}° sideways and ${Math.abs(cal.dAlt).toFixed(0)}° up or down taken off. Kept on this phone for ${CAL_HOURS} hours.`, 4500);
    leaveCal();
  });
  $('#vCalReset').addEventListener('click', () => { cal = null; forgetCalibration(); calState(); renderCal(); warn('Calibration undone.'); });
  $('#vFov').addEventListener('input', (e) => { fov = Number(e.target.value); $('#vFovV').textContent = fov + '°'; store.set(FOV_KEY, fov); });

  // ------------------------------------------------------------ open and close
  function close() {
    if (!alive) return;
    alive = false; cancelAnimationFrame(raf);
    if (orient) orient.stop();
    if (stream) stream.getTracks().forEach((t) => t.stop());
    if (wake) wake.release().catch(() => {});
    document.removeEventListener('visibilitychange', onVis);
    removeEventListener('keydown', onKey);
    root.hidden = true; root.innerHTML = ''; root.classList.remove('calibrating');
    document.documentElement.classList.remove('viewing');
    opts.onClose && opts.onClose();
  }
  const onKey = (e) => { if (e.key === 'Escape') (mode === 'cal' ? leaveCal() : close()); };
  addEventListener('keydown', onKey);
  $('.vbtn.vback').addEventListener('click', close);

  // aim the drag view at the target to begin with
  items = positions(sky, place, Date.now(), target); lastItemsAt = Date.now();
  const s0 = selected();
  if (s0 && s0.alt > -5) { dragAlt = Math.max(5, Math.min(80, s0.alt)); dragAz = s0.az; }
  renderSheet(true); calState();
  draw();
  startCamera(); keepAwake();
  return { close, startSensors, enterCal, get sensors() { return sensors; }, get motionAllowed() { return motionAllowed; } };
}

// Called from the tap that opens the view (iPhone needs the motion permission asked inside a tap).
export async function openFromTap(root, opts) {
  const granted = await askMotion();
  const v = openView(root, opts);
  v.startSensors(granted);
  // once the sensors answer: calibrate first when there is no recent calibration (or when asked to)
  setTimeout(() => { if (v.sensors !== 'none' && (opts.calibrate || !calibration())) v.enterCal(); }, 1300);
  return v;
}
