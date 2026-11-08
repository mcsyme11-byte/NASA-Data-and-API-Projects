// NASA Data Projects · shared NASA API helper · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// One place for talking to api.nasa.gov, used by every project's page.
//
// The API key: these pages are static (GitHub Pages), so a key written into the code would be public. Instead each
// visitor's own key is kept in their browser only (localStorage), and the shared DEMO_KEY is used until they add one.
// No key is ever committed to the repository. (GIBS and the NASA Image and Video Library need no key at all.)
//
// Use:
//   import { nasaGet, getKey, setKey } from '../shared/nasa.js';
//   const feed = await nasaGet('/neo/rest/v1/feed', { start_date: '2026-11-01', end_date: '2026-11-07' });

const KEY_STORE = 'nasa-data-projects.api-key';
const API_ROOT = 'https://api.nasa.gov';
const cache = new Map();   // answers kept for this visit, so the same request never costs twice

export const DEMO_KEY = 'DEMO_KEY';   // NASA's shared key: 30 requests an hour, 50 a day, per connection

export function getKey() {
  try { return localStorage.getItem(KEY_STORE) || DEMO_KEY; } catch { return DEMO_KEY; }
}

export function setKey(key) {
  try {
    const k = (key || '').trim();
    if (k) localStorage.setItem(KEY_STORE, k); else localStorage.removeItem(KEY_STORE);
  } catch { /* private browsing: the key lasts for this visit only */ }
}

export function usingDemoKey() { return getKey() === DEMO_KEY; }

// The last rate-limit numbers NASA sent back (from the X-RateLimit headers). Checked Nov 8, 2026: NASA does not expose
// these headers to web pages, so in a browser they stay null; kept for scripts and in case that changes.
export const rateLimit = { limit: null, remaining: null };

export class NasaError extends Error {
  constructor(message, status) { super(message); this.status = status; }
}

// GET an api.nasa.gov path with query parameters; returns the parsed JSON.
export async function nasaGet(path, params = {}) {
  const url = new URL(API_ROOT + path);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) url.searchParams.set(k, v);
  url.searchParams.set('api_key', getKey());

  const id = url.toString();
  if (cache.has(id)) return cache.get(id);

  let res;
  try {
    res = await fetch(url);
  } catch {
    throw new NasaError('NASA could not be reached. Check the internet connection and try again.', 0);
  }

  const limit = res.headers.get('X-RateLimit-Limit');
  const left = res.headers.get('X-RateLimit-Remaining');
  if (limit !== null) rateLimit.limit = Number(limit);
  if (left !== null) rateLimit.remaining = Number(left);

  if (!res.ok) throw new NasaError(plainMessage(res.status), res.status);

  const data = await res.json();
  cache.set(id, data);
  return data;
}

// What went wrong, and what to do next, in plain English.
function plainMessage(status) {
  if (status === 429) {
    return usingDemoKey()
      ? 'The shared demo key has run out of requests for now. Add your own free key from api.nasa.gov, or try again in an hour.'
      : 'Your key has reached NASA\'s limit of 1,000 requests an hour. Try again later.';
  }
  if (status === 403) return 'NASA didn\'t accept the API key. Check it in Settings, or remove it to use the demo key.';
  if (status === 400) return 'NASA couldn\'t answer that request (check the dates: some searches allow at most 7 days).';
  if (status >= 500) return 'NASA\'s service is having trouble right now. Try again in a few minutes.';
  return 'Something went wrong (error ' + status + '). Try again.';
}

// ---- small formatting helpers shared by the pages ----

const nf = new Intl.NumberFormat('en-CA');
export const fmt = (n, digits = 0) =>
  n === null || n === undefined || Number.isNaN(n) ? '—'
    : new Intl.NumberFormat('en-CA', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
export const fmtInt = (n) => (n === null || n === undefined ? '—' : nf.format(Math.round(n)));

// A date as YYYY-MM-DD in UTC (the form NASA's APIs expect).
export const isoDate = (d) => d.toISOString().slice(0, 10);
