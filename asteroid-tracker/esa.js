// NASA and ESA Data Projects · Asteroid Tracker · ESA and impact-risk lookups · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Small helpers for the pages that show ESA's figures beside NASA's, from the daily files written by fetch_risk.py:
//   data/esa_close.json  ESA NEOCC close approaches within 0.05 au, the past 30 days and the next year (date only)
//   data/risk.json       ESA NEOCC and NASA/JPL Sentry impact-risk lists, matched by designation
// Each file is loaded once per page, when first needed. A file that cannot be loaded gives no ESA figures; the NASA
// figures on the page are not affected.

const once = {};
function load(url) {
  if (!once[url]) once[url] = fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).catch(() => null);
  return once[url];
}

// The designation as both centres write it, from a NeoWs or JPL name:
// "433 Eros (A898 PA)" → "433"; "(2026 VT3)" → "2026 VT3"; "99942 Apophis (2004 MN4)" → "99942".
export function designationOf(name) {
  const s = String(name || '').trim();
  const num = /^(\d+)(\s|$)/.exec(s);
  if (num) return num[1];
  const par = /\(([^)]+)\)/.exec(s);
  return (par ? par[1] : s).trim();
}

// ESA's close approach for this object within a day of tMs: { date, km, ld, v } or null.
export async function esaApproach(name, tMs, base = 'data/') {
  const d = await load(base + 'esa_close.json');
  if (!d) return null;
  const des = designationOf(name), ix = Object.fromEntries(d.fields.map((f, i) => [f, i]));
  let best = null;
  for (const r of d.rows) {
    if (r[ix.designation] !== des) continue;
    const t = Date.parse(r[ix.date_utc] + 'T12:00:00Z'), gap = Math.abs(t - tMs);
    if (gap <= 1.5 * 86400000 && (!best || gap < best.gap)) best = { gap, date: r[ix.date_utc], km: r[ix.distance_km], ld: r[ix.distance_ld], v: r[ix.v_kms] };
  }
  return best;
}
// Whether the ESA close-approach file is ready (so a page can draw first and add ESA's figures when they arrive)
export const esaCloseReady = (base = 'data/') => load(base + 'esa_close.json');

// This object's impact-risk record: { esa: {...} | null, nasa: {...} | null, updated, esaUpdated }, or null when the
// file could not be loaded. Neither list holding it gives { esa: null, nasa: null }.
export async function riskOf(name, base = 'data/') {
  const d = await load(base + 'risk.json');
  if (!d) return null;
  const des = designationOf(name), ix = Object.fromEntries(d.fields.map((f, i) => [f, i]));
  const r = d.rows.find((x) => x[ix.designation] === des);
  const out = { esa: null, nasa: null, updated: d.updated, esaUpdated: d.esa_updated, des };
  if (!r) return out;
  const g = (f) => r[ix[f]];
  if (g('esa_ip_max') !== null) out.esa = { ip: g('esa_ip_max'), ps: g('esa_ps_max'), ts: g('esa_ts'), date: g('esa_date'), years: g('esa_years'), cum: g('esa_ip_cum'), special: g('esa_special') };
  if (g('nasa_ip_max') !== null) out.nasa = { ip: g('nasa_ip_max'), ps: g('nasa_ps_max'), ts: g('nasa_ts'), date: g('nasa_date'), years: g('nasa_years'), cum: g('nasa_ip_cum') };
  return out;
}

// Designations on either risk list (for the map's filter), or null when the file could not be loaded.
export async function riskDesignations(base = 'data/') {
  const d = await load(base + 'risk.json');
  return d ? new Set(d.rows.map((r) => r[0])) : null;
}
