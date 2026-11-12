// NASA and ESA Data Projects · the visitor's place, for the sky pages · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Used by the Asteroid Tracker's "Visible from here" tab and by Sky Finder. The place is either
//   • the device's own location (the browser asks the visitor first; rounded to 0.01°, about 1 km), or
//   • a town picked from the GeoNames list the Image Explorer already ships (image-explorer/data/places.json),
//     searched in the browser, so nothing the visitor types is sent anywhere.
// The chosen place is kept in this browser (localStorage, key below) so it is there next time; "Forget this place"
// deletes it. It is never sent to the site or to anyone else (see the Privacy page).

const KEY = 'nasa-data-projects.sky-place';
const PLACES_URL = new URL('../image-explorer/data/places.json', import.meta.url);

export function getPlace() {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) || 'null');
    return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180 ? p : null;
  } catch { return null; }
}
export function setPlace(p) {
  const place = { name: String(p.name || 'Your location').slice(0, 80), lat: Math.round(p.lat * 100) / 100, lon: Math.round(p.lon * 100) / 100, how: p.how || 'search' };
  try { localStorage.setItem(KEY, JSON.stringify(place)); } catch { /* private browsing: kept for this visit only */ }
  _session = place;
  dispatchEvent(new CustomEvent('skyplace', { detail: place }));
  return place;
}
export function forgetPlace() {
  try { localStorage.removeItem(KEY); } catch { /* nothing stored */ }
  _session = null;
  dispatchEvent(new CustomEvent('skyplace', { detail: null }));
}
let _session = null;
export const currentPlace = () => getPlace() || _session;

// The device's location. Resolves to a place, or rejects with a plain-English reason.
export function locate() {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) { reject(new Error('This browser cannot share its location. Type a town instead.')); return; }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(setPlace({ name: 'Your location', lat: pos.coords.latitude, lon: pos.coords.longitude, how: 'device' })),
      (err) => reject(new Error(err.code === 1
        ? 'Location access was not allowed. Type a town instead, or allow location for this site in the browser settings.'
        : 'Your location could not be found just now. Type a town instead.')),
      { enableHighAccuracy: false, timeout: 15000, maximumAge: 10 * 60 * 1000 });
  });
}

// Town search over the bundled list: [name, country code, lat, lon, capital?], largest places first.
let _places = null;
export function loadPlaces() {
  _places = _places || fetch(PLACES_URL).then((r) => (r.ok ? r.json() : Promise.reject(new Error('places ' + r.status))));
  return _places;
}
const fold = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
let _country = null;
function countryName(code) {
  try { _country = _country || new Intl.DisplayNames(['en'], { type: 'region' }); return _country.of(code) || code; } catch { return code; }
}
export async function searchPlaces(q, limit = 8) {
  const n = fold(q.trim());
  if (n.length < 2) return [];
  const list = await loadPlaces(), starts = [], within = [];
  for (const p of list) {
    const f = fold(p[0]);
    if (f.startsWith(n)) { starts.push(p); if (starts.length >= limit) break; } else if (within.length < limit && f.includes(n)) within.push(p);
  }
  return starts.concat(within).slice(0, limit).map((p) => ({ name: `${p[0]}, ${countryName(p[1])}`, lat: p[2], lon: p[3] }));
}
export const placeText = (p) => `${p.name} · ${Math.abs(p.lat).toFixed(2)}°${p.lat >= 0 ? 'N' : 'S'} ${Math.abs(p.lon).toFixed(2)}°${p.lon >= 0 ? 'E' : 'W'}`;
