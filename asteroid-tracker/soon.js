// NASA Data Projects · Asteroid Tracker · the home page's "closest pass in the next 7 days" · © 2026 Malcolm Syme ·
// mcsyme11@gmail.com
//
// Reads data/soon.json (written daily: the close passes from a day ago to 15 days ahead, within 10 Moon distances)
// and shows the closest one between now and 7 days from now, in the visitor's own time zone, with a link to the
// asteroid's page. Nothing due: says so, with a link to this week's passes. The file cannot be loaded: nothing shown.

import { fmt, diameterM, LD_KM } from './format.js';
import { compareSize } from './compare.js';

const DAY = 86400000;
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export async function mountSoon(el, url, base) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('status ' + res.status);
  const data = await res.json();
  const now = Date.now();
  const due = data.rows.filter((r) => r[1] >= now && r[1] <= now + 7 * DAY);
  if (!due.length) {
    el.innerHTML = `<span class="eyebrow">Next 7 days</span>
      <span class="facts">No asteroid is due within 10 Moon distances of Earth.</span>
      <a class="linkbtn" href="${base}">This week's passes ›</a>`;
    el.hidden = false;
    return;
  }
  const [name, t, ld, h, id, des] = due.reduce((a, b) => (b[2] < a[2] ? b : a));
  const href = id ? `${base}object.html?id=${encodeURIComponent(id)}&t=${t}`
    : `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(des)}`;
  const ext = id ? '' : ' target="_blank" rel="noopener"';
  const when = new Date(t).toLocaleString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) + ' your time';
  const km = ld * LD_KM;
  const size = h !== null && h !== undefined ? compareSize(diameterM(h, 0.25), diameterM(h, 0.05)) : '';
  el.innerHTML = `<span class="eyebrow">Closest pass, next 7 days</span>
    <a class="name" href="${href}"${ext}>${esc(name)}</a>
    <span class="facts">${fmt(ld, ld < 10 ? 1 : 0)} Moon distances (${km >= 1e6 ? fmt(km / 1e6, 2) + ' million' : fmt(Math.round(km / 1000) * 1000)} km) · ${esc(when)}${size ? ' · ' + esc(size[0].toLowerCase() + size.slice(1)) : ''}</span>
    <a class="linkbtn" href="${href}"${ext}>${id ? 'Its page' : 'JPL\'s page'} ›</a>`;
  el.hidden = false;
}
