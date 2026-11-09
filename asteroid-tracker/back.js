// NASA Data Projects · Asteroid Tracker · back button · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// A "‹ Back" link at the top of a page, named for the page it returns to ("Back to the map", "Back to the tracker").
// When the previous page in this tab is a page of this site, the link uses the browser's own Back, so that page
// returns where it was left: the tracker and the map also keep their place in this tab (see placeKeeper below).
// Otherwise the link keeps the fallback written in the HTML (the tracker's front page), or stays hidden when the
// HTML marks it hidden.
//
// Use:  <a class="backlink" id="back" href="./">‹ Asteroid Tracker</a>   then   backLink(document.getElementById('back'));

export function backLink(el) {
  if (!el) return;
  let ref = null;
  try { ref = new URL(document.referrer); } catch { /* no referrer */ }
  const here = location.origin + location.pathname + location.search;
  if (!ref || ref.origin !== location.origin || ref.origin + ref.pathname + ref.search === here) return;
  const p = ref.pathname;
  const label = /\/map\.html$/.test(p) ? 'Back to the map'
    : /\/object\.html$/.test(p) ? 'Back to the asteroid'
    : /\/asteroid-tracker\/(index\.html)?$/.test(p) ? 'Back to the tracker'
    : /\/(index\.html)?$/.test(p) && !/\/(mars-data|image-explorer)\//.test(p) ? 'Back to the home page'
    : 'Back';
  el.textContent = '‹ ' + label;
  el.href = ref.href;
  el.hidden = false;
  // The browser's own Back brings the page back as it was. A page opened in a new tab has no history to return to,
  // so then the link simply opens the page.
  el.addEventListener('click', (e) => {
    if (history.length > 1 && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); history.back(); }
  });
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
