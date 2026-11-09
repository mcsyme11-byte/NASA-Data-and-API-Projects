// NASA Data Projects · Asteroid Tracker · search · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Instant search over every near-Earth asteroid's name and code (data/neos.json, loaded once). Matching ignores
// case, spaces and brackets, so "2024yr4", "2024 YR4" and "(2024 YR4)" all find the same object. Ranking:
//   1. a name that starts with what was typed ("apo" → Apophis, Apollo)
//   2. a number or code that starts with it ("433" → 433 Eros; "2024 y" → 2024 YA, 2024 YB…)
//   3. anything containing it
// then numbered asteroids first, then the brighter (usually bigger) ones.

import { COL, CLASSES, classOf, COMET_CODES } from './skymap.js';

// ---------------------------------------------------------------- what an asteroid's code means
// Provisional codes (Minor Planet Center rules), e.g. 2024 YR4:
//   2024  the year it was found
//   Y     the half-month: A = Jan 1–15, B = Jan 16–31, … Y = Dec 16–31 (I is not used, nor Z)
//   R4    its place in that half-month: the letters A–Z without I count 25 objects, and the number says how many
//         times the alphabet was used up first. R is the 17th letter, so R4 = 4 × 25 + 17 = the 117th.
// A permanent number (99942) comes once the orbit is known well; a name (Apophis) may follow.
const HALF = 'ABCDEFGHJKLMNOPQRSTUVWXY', ORDER = 'ABCDEFGHJKLMNOPQRSTUVWXYZ';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ordinal = (n) => n.toLocaleString('en-CA') + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
export function decodeCode(code) {
  let m = /^(\d{4}) ([A-HJ-Y])([A-HJ-Z])(\d*)$/.exec(String(code).trim().toUpperCase().replace(/^A(\d{3}) /, (x, y) => (1000 + Number(y)) + ' '));
  if (m) {
    const year = Number(m[1]), h = HALF.indexOf(m[2]), month = h >> 1, second = h % 2 === 1;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    const n = (m[4] ? Number(m[4]) : 0) * 25 + ORDER.indexOf(m[3]) + 1;
    return { year, text: `found ${MONTHS[month]} ${second ? '16–' + last : '1–15'}, ${year}, the ${ordinal(n)} new small body given a code in that half-month`,
      parts: { year, half: `${MONTHS[month]} ${second ? '16–' + last : '1–15'}`, order: n } };
  }
  m = /^(\d{4}) (P-L|T-1|T-2|T-3)$/.exec(String(code).trim().toUpperCase());
  if (m) return { text: m[2] === 'P-L' ? 'found in the Palomar–Leiden survey of 1960, which numbered its finds this way' : `found in the Palomar–Leiden Trojan survey ${m[2]} (${({ 'T-1': 1971, 'T-2': 1973, 'T-3': 1977 })[m[2]]}), which numbered its finds this way` };
  return null;
}
// The plain-English meaning of an asteroid's full name, e.g. "99942 Apophis (2004 MN4)"
export function decodeName(full) {
  full = String(full).trim();
  const paren = /\(([^)]+)\)\s*$/.exec(full);
  const head = paren ? full.slice(0, paren.index).trim() : full;
  const numbered = /^(\d+)(?:\s+(.+))?$/.exec(head);
  const code = paren ? paren[1] : head;
  const d = decodeCode(code);
  const bits = [];
  if (d) bits.push(`${code}: ${d.text}`);
  if (numbered) bits.push(`${Number(numbered[1]).toLocaleString('en-CA')}: its number in the official list of asteroids with well-known orbits${numbered[2] ? `; ${numbered[2]} is its official name` : ''}`);
  return bits.length ? bits.join('. ') + '.' : null;
}
import { fmt, sizeText, diameterM } from './format.js';

const norm = (s) => String(s).toLowerCase().replace(/[\s()_\-]/g, '');
let cache = null;
function index(rows) {
  if (cache && cache.rows === rows) return cache;
  const n = rows.length, key = new Array(n), proper = new Array(n), num = new Float64Array(n), bright = new Float32Array(n);
  for (let k = 0; k < n; k++) {
    const full = String(rows[k][COL.name]).trim();
    key[k] = norm(full);
    const m = /^(\d+)\s+([^(]+?)\s*(\(|$)/.exec(full);           // "433 Eros (A898 PA)" → number 433, name "eros"
    proper[k] = m ? norm(m[2]) : '';
    num[k] = /^\d+\s/.test(full) ? parseInt(full, 10) : Infinity;
    bright[k] = rows[k][COL.H] === null ? 99 : +rows[k][COL.H];
  }
  cache = { rows, key, proper, num, bright };
  return cache;
}

// indices of the best matches for query q
export function searchNames(rows, q, limit = 24, keep = null) {
  const t = norm(q);
  if (!t && !keep) return [];
  const { key, proper, num, bright } = index(rows);
  const hits = [];
  for (let k = 0; k < key.length; k++) {
    if (keep && !keep(rows[k])) continue;
    let rank;
    if (!t) rank = 1;
    else if (proper[k] && proper[k].startsWith(t)) rank = 0;
    else if (key[k].startsWith(t)) rank = 1;
    else if (key[k].includes(t)) rank = 2;
    else continue;
    hits.push(k * 4 + rank);
  }
  if (!t) hits.sort((x, y) => bright[x >> 2] - bright[y >> 2]);            // no text: biggest (brightest) first
  else hits.sort((x, y) => (x & 3) - (y & 3) || num[x >> 2] - num[y >> 2] || bright[x >> 2] - bright[y >> 2]);
  return hits.slice(0, limit).map((h) => h >> 2);
}
export function countMatches(rows, q, keep = null) {
  const t = norm(q); if (!t && !keep) return 0;
  const { key } = index(rows); let c = 0;
  for (let k = 0; k < key.length; k++) if ((!keep || keep(rows[k])) && (!t || key[k].includes(t))) c++;
  return c;
}

// NASA NeoWs id for an asteroid: 2,000,000 + its number when it has one, otherwise JPL's SPK-ID (checked Nov 8, 2026)
export function neowsId(r) {
  const m = /^\s*(\d+)\s/.exec(r[COL.name]);
  return m ? 2000000 + Number(m[1]) : r[COL.spkid];
}

export function sizeOf(r) {
  const H = r[COL.H], d = r[COL.diameter];
  if (d) return { dmin: d * 1000, dmax: d * 1000, measured: true };
  if (H !== null && H !== undefined) return { dmin: diameterM(+H, 0.25), dmax: diameterM(+H, 0.05) };
  return { dmin: NaN, dmax: NaN };
}

// a small top-down sketch of the orbit next to Earth's (SVG markup)
export function orbitSketch(r, size = 92) {
  const a = +r[COL.a], e = +r[COL.e], w = (+r[COL.w] + +r[COL.om]) * Math.PI / 180;   // longitude of perihelion
  const R = Math.max(1.15, a * (1 + e)) * 1.08, s = size / 2 / R, c = size / 2;
  const b = a * Math.sqrt(1 - e * e), fx = -a * e;                                      // centre of the ellipse from the Sun
  const cx = c + (fx * Math.cos(w)) * s, cy = c - (fx * Math.sin(w)) * s;
  const col = r[COL.pha] === 'Y' ? '#C9675A' : '#C0A062';
  return `<svg class="sketch" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="${c}" cy="${c}" r="${(s * 1).toFixed(1)}" fill="none" stroke="#8AA9C9" stroke-width="1.2" opacity=".8"/>
    <ellipse cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" rx="${(a * s).toFixed(1)}" ry="${(b * s).toFixed(1)}" transform="rotate(${(-w * 180 / Math.PI).toFixed(1)} ${cx.toFixed(1)} ${cy.toFixed(1)})" fill="none" stroke="${col}" stroke-width="1.6"/>
    <circle cx="${c}" cy="${c}" r="3" fill="#E2C88E"/></svg>`;
}

// one result card
export function resultCard(r) {
  const esc = (s) => String(s).replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);
  const comet = COMET_CODES.has(r[COL.cls]);
  const cls = CLASSES[classOf(r[COL.cls])] || { name: r[COL.cls] || 'Near-Earth object', note: '' };
  const a = +r[COL.a], e = +r[COL.e], yrs = Math.pow(a, 1.5), q = a * (1 - e);
  const href = comet ? `https://ssd.jpl.nasa.gov/tools/sbdb_lookup.html#/?sstr=${encodeURIComponent(r[COL.pdes])}` : `object.html?id=${neowsId(r)}`;
  return `<article class="result">
    <a class="rmain" href="${href}"${comet ? ' target="_blank" rel="noopener"' : ''}>
      ${orbitSketch(r)}
      <div class="rtext">
        <h3>${esc(String(r[COL.name]).trim())}</h3>
        <p class="tags">${r[COL.pha] === 'Y' ? '<span class="tag haz">Potentially hazardous</span>' : ''}<span class="tag">${esc(cls.name)}</span></p>
        ${!comet && decodeName(r[COL.name]) ? `<p class="decode">${esc(decodeName(r[COL.name]))}</p>` : ''}
        <dl class="mini">${comet ? '' : `<div><dt>Size, est.</dt><dd>${sizeText(sizeOf(r))}</dd></div>`}
          <div><dt>Year</dt><dd>${yrs >= 2 ? fmt(yrs, 1) + ' years' : fmt(yrs * 365.25) + ' days'}</dd></div>
          <div><dt>Nearest the Sun</dt><dd>${fmt(q, 2)} au</dd></div></dl>
      </div>
    </a>
    <a class="rmap" href="map.html?focus=${encodeURIComponent(r[COL.pdes])}">Show on the map ›</a>
  </article>`;
}
