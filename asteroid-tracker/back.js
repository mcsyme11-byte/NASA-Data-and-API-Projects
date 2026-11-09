// NASA and ESA Data Projects · Asteroid Tracker · back button · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The "‹ Back" button at the top of a page. Since Nov 9, 2026 the site's shared footer script (shared/footer.js) names
// it for the page it returns to and makes it use the browser's own Back, on every page; adding a second click
// handler here would go back two pages. This only shows a button the HTML marks hidden (the map's, which is
// useful only when the map was opened from another page of the site).
//
// Use:  <a class="backlink" id="back" href="./" hidden>‹ Back</a>   then   backLink(document.getElementById('back'));

export function backLink(el) {
  if (!el || !el.hidden) return;
  let ref = null;
  try { ref = new URL(document.referrer); } catch { /* no referrer */ }
  if (ref && ref.origin === location.origin && ref.pathname !== location.pathname) el.hidden = false;
}

// Keeps a page's place (whatever get() returns, plus the scroll position) in this browser tab when the page is left,
// and hands it back when the page is returned to with Back or Forward, or reloaded. Opening the page fresh, from a
// link or the address bar, starts it at the top as usual.
export function placeKeeper(name, get) {
  const key = 'nasa-data-projects.place.' + name + location.pathname + location.search;
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  addEventListener('pagehide', () => {
    try { sessionStorage.setItem(key, JSON.stringify({ ...get(), scrollY: Math.round(scrollY) })); } catch { /* storage unavailable */ }
  });
  const nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
  const returning = nav ? nav.type === 'back_forward' || nav.type === 'reload' : false;
  if (!returning) return null;
  try { return JSON.parse(sessionStorage.getItem(key)); } catch { return null; }
}

// Scrolls back to y once the page is tall enough (data and charts arrive a moment after the page opens). Stops if the
// user scrolls, taps or presses a key first, or after a few seconds.
export function scrollBack(y, ready = () => true) {
  if (!y) return;
  let stop = false;
  const cancel = () => { stop = true; };
  for (const ev of ['wheel', 'touchstart', 'keydown', 'mousedown']) addEventListener(ev, cancel, { once: true, passive: true });
  const until = performance.now() + 5000;
  const go = () => {
    if (stop) return;
    const room = document.documentElement.scrollHeight - innerHeight;
    if (ready() && room >= y - 2) { requestAnimationFrame(() => { if (!stop) scrollTo(0, y); }); return; }
    if (performance.now() < until) requestAnimationFrame(go);
    else scrollTo(0, Math.min(y, room));
  };
  go();
}
