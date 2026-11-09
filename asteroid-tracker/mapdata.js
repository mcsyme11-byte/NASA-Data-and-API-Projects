// NASA Data Projects · Asteroid Tracker · data for the map and search · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// data/neos.json        every near-Earth asteroid's orbit (NASA/JPL Small-Body Database), refreshed daily
// data/spacecraft.json  spacecraft positions every few days (NASA/JPL Horizons), refreshed daily
// data/YYYY.json        this year's close approaches, for "this week's visitors"
// All three are written by fetch_close_approaches.py / fetch_map_data.py on GitHub Actions (JPL's APIs cannot be
// called from a web page).

let neosPromise = null;
export function loadNeos() {
  if (!neosPromise) neosPromise = fetch('data/neos.json').then((r) => { if (!r.ok) throw new Error('status ' + r.status); return r.json(); })
    .catch((e) => { neosPromise = null; throw e; });
  return neosPromise;
}

export async function loadMapData() {
  const now = new Date(), y = now.getUTCFullYear();
  const day0 = Date.UTC(y, now.getUTCMonth(), now.getUTCDate()) - now.getUTCDay() * 86400000;   // Sunday of this week
  const [neos, craft, year] = await Promise.all([
    loadNeos(),
    fetch('data/spacecraft.json').then((r) => (r.ok ? r.json() : { craft: [] })).catch(() => ({ craft: [] })),
    fetch(`data/${y}.json`).then((r) => (r.ok ? r.json() : { rows: [] })).catch(() => ({ rows: [] })),
  ]);
  const visitors = year.rows.filter((r) => r[1] >= day0 && r[1] < day0 + 7 * 86400000).map((r) => r[5]);
  return { rows: neos.rows, updated: neos.updated, spacecraft: craft.craft || [], visitors };
}
