// NASA and ESA Data Projects · site links in every footer · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Adds one row of links (About, Privacy, Terms, Credits, Contact, the licence and the source code) to the top of the page's
// <footer class="footer">, so the links are written in one place for every page. Each page loads it with
//   <script type="module" src="<path to>/shared/footer.js"></script>
// It also sets up the "‹ Back" button on pages that have one (see wireBack below), and the soft edge fade on rows that
// scroll sideways (wireScrollRows).
// Links are worked out from this file's own address, so they are right at any folder depth.

const REPO = 'https://github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects';
const root = new URL("../", import.meta.url.split("?")[0]);

const LINKS = [
  { label: 'About', href: new URL('about/', root).href, page: 'about' },
  { label: 'Privacy', href: new URL('privacy/', root).href, page: 'privacy' },
  { label: 'Terms', href: new URL('terms/', root).href, page: 'terms' },
  { label: 'Credits', href: new URL('credits/', root).href, page: 'credits' },
  { label: 'Contact', href: new URL('contact/', root).href, page: 'contact' },
  { label: 'Licence (MIT)', href: REPO + '/blob/main/LICENSE.md', external: true },
  { label: 'Source code', href: REPO, external: true },
];

function addLinks() {
  const footer = document.querySelector('footer.footer');
  if (!footer || footer.querySelector('.sitelinks')) return;

  const here = location.pathname;
  const nav = document.createElement('nav');
  nav.className = 'sitelinks';
  nav.setAttribute('aria-label', 'About this site');

  for (const l of LINKS) {
    const a = document.createElement('a');
    a.href = l.href;
    a.textContent = l.label;
    if (l.external) {
      a.target = '_blank';
      a.rel = 'noopener';
      a.append(Object.assign(document.createElement('span'), { className: 'ext', textContent: ' ↗' }));
      a.setAttribute('aria-label', l.label + ' (on GitHub, opens in a new tab)');
    } else if (here.includes('/' + l.page + '/')) {
      a.setAttribute('aria-current', 'page');
    }
    nav.append(a);
  }
  footer.prepend(nav);
}

// A "‹ Back" button (<a class="backlink" id="back" href="<home>">‹ Home</a>) above the heading. When the previous page in
// this tab is a page of this site, it is named for that page and uses the browser's own Back, so that page returns
// where it was left; otherwise it keeps its fallback, the home page.
const NAMES = [
  [/\/asteroid-tracker\/map\.html$/, 'the map'], [/\/asteroid-tracker\/object\.html$/, 'the asteroid'],
  [/\/asteroid-tracker\/(index\.html)?$/, 'the Asteroid Tracker'], [/\/image-explorer\//, 'the Image Explorer'],
  [/\/mars-data\//, 'Mars Data'], [/\/about\//, 'About'], [/\/privacy\//, 'Privacy'], [/\/terms\//, 'Terms'],
  [/\/credits\//, 'Credits'], [/\/contact\//, 'Contact'], [/\/sky-finder\//, 'Sky Finder'], [/\/spacecraft\//, 'the spacecraft map'],
];
function wireBack() {
  const el = document.getElementById('back');
  if (!el || !el.classList.contains('backlink')) return;
  let ref = null;
  try { ref = new URL(document.referrer); } catch { /* no referrer */ }
  if (!ref || ref.origin !== location.origin || ref.pathname === location.pathname) return;
  const p = ref.pathname;
  const hit = NAMES.find(([rx]) => rx.test(p));
  const name = hit ? hit[1] : (p === root.pathname || p === root.pathname + 'index.html' ? 'the home page' : null);
  el.textContent = '‹ ' + (name ? 'Back to ' + name : 'Back');
  el.href = ref.href;
  el.addEventListener('click', (e) => {
    if (history.length > 1 && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); history.back(); }
  });
}

// Rows that scroll sideways (the tab bars, chip rows on small screens): a soft fade on the side where there is more,
// and the selected tab scrolled into view, so nothing looks cut off. Decided Nov 12, 2026.
const HSCROLL = '.tabs, .popular, .gbar .seg, [data-hscroll]';
function fades(el) {
  const more = el.scrollWidth - el.clientWidth;
  el.classList.toggle('hs-l', more > 2 && el.scrollLeft > 2);
  el.classList.toggle('hs-r', more > 2 && el.scrollLeft < more - 2);
}
function wireScrollRows() {
  const ro = 'ResizeObserver' in window ? new ResizeObserver((es) => es.forEach((e) => fades(e.target))) : null;
  const init = (el) => {
    if (el.dataset.hs) return;
    el.dataset.hs = '1';
    el.classList.add('hscroll');
    el.addEventListener('scroll', () => fades(el), { passive: true });
    if (ro) ro.observe(el);
    const sel = el.querySelector('[aria-current="page"], [aria-selected="true"]');
    if (sel && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, sel.offsetLeft - (el.clientWidth - sel.offsetWidth) / 2);
    fades(el);
  };
  const scan = () => document.querySelectorAll(HSCROLL).forEach(init);
  const all = () => document.querySelectorAll('.hscroll').forEach(fades);
  scan();
  addEventListener('resize', all, { passive: true });
  document.addEventListener('click', (e) => { if (e.target.closest && e.target.closest('.hscroll')) requestAnimationFrame(all); });
  // rows the pages add later (search chips, a view's controls): picked up as they appear
  let queued = false;
  new MutationObserver(() => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; scan(); all(); }); } })
    .observe(document.body, { childList: true, subtree: true });
}

function start() { addLinks(); wireBack(); wireScrollRows(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
else start();
