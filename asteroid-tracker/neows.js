// NASA and ESA Data Projects · Asteroid Tracker · the daily copy of NASA's NeoWs data · © 2026 Malcolm Syme ·
// mcsyme11@gmail.com
//
// fetch_neows.py (the daily data job, using the developer's key kept as a GitHub secret) copies NeoWs for the current
// week, the two weeks before and after it, and every asteroid in them, into data/neows/. The pages read that copy
// first, so most visitors need no key and spend none of their own allowance; only a week or asteroid outside it is
// asked of NASA directly. The files keep NeoWs's own shape, so the pages handle them exactly like NASA's answers.

const BASE = 'data/neows/';
let index = null;

function loadIndex() {
  index = index || fetch(BASE + 'index.json', { cache: 'no-cache' })
    .then((r) => (r.ok ? r.json() : null))
    .then((i) => (i && Array.isArray(i.weeks) && Array.isArray(i.neo) ? { ...i, neoSet: new Set(i.neo) } : null))
    .catch(() => null);
  return index;
}

async function file(name) {
  try {
    const r = await fetch(BASE + name, { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch { return null; }
}

// { feed, updated } for the week starting on this Sunday (YYYY-MM-DD), or null when the copy doesn't hold it
export async function weekCopy(startIso) {
  const i = await loadIndex();
  if (!i || !i.weeks.includes(startIso)) return null;
  const feed = await file(`week-${startIso}.json`);
  return feed && feed.near_earth_objects ? { feed, updated: i.updated } : null;
}

// { neo, updated } for this NeoWs id, or null when the copy doesn't hold it
export async function neoCopy(id) {
  const i = await loadIndex();
  if (!i || !i.neoSet.has(String(id))) return null;
  const neo = await file(`neo/${id}.json`);
  return neo && neo.id ? { neo, updated: i.updated } : null;
}

// the copy's date and the weeks it holds (for the key settings note), or null
export async function copyInfo() {
  const i = await loadIndex();
  return i ? { updated: i.updated, weeks: i.weeks } : null;
}
