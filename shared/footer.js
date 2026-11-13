// NASA and ESA Data Projects · site links in every footer · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Adds the row of site links (About, Legal, Contact and the source code) to the page's <footer class="footer">, in
// front of the copyright line, so the links are written in one place for every page. Each page loads it with
//   <script type="module" src="<path to>/shared/footer.js"></script>
// and has this footer (decided Nov 12, 2026: a short footer; each page's detailed data credits sit above it, in
// <p class="srcline"> lines next to the content they cover):
//   <footer class="footer">
//     <div class="ftop"><p class="copy">© 2026 <strong>Malcolm Syme</strong> · <a href="mailto:…">…</a></p></div>
//     <p class="fnote">Data courtesy of NASA and ESA. An independent project, not endorsed by NASA or ESA.</p>
//   </footer>
// Privacy, Terms, Credits and the licence are reached through the Legal page (legal/).
// It also sets up the "‹ Back" button on pages that have one (see wireBack below), and the soft edge fade on rows that
// scroll sideways (wireScrollRows).
// Links are worked out from this file's own address, so they are right at any folder depth.

const REPO = 'https://github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects';
const root = new URL("../", import.meta.url.split("?")[0]);

// `pages`: the folders that count as this link's own section (the Legal link is marked on its four pages too)
const LINKS = [
  { label: 'About', href: new URL('about/', root).href, pages: ['about'] },
  { label: 'Legal', href: new URL('legal/', root).href, pages: ['legal', 'privacy', 'terms', 'credits'] },
  { label: 'Contact', href: new URL('contact/', root).href, pages: ['contact'] },
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
    } else if (l.pages.some((pg) => here.includes('/' + pg + '/'))) {
      a.setAttribute('aria-current', here.includes('/' + l.pages[0] + '/') ? 'page' : 'true');
    }
    nav.append(a);
  }
  // in front of the copyright line; a page with an older footer (no .ftop) gets the row at the top
  const top = footer.querySelector('.ftop');
  if (top) top.prepend(nav); else footer.prepend(nav);
}

// A "‹ Back" button (<a class="backlink" id="back" href="<home>">Home</a>; the arrow is drawn by shared/theme.css) above
// the heading. When the previous page in this tab is a page of this site, it is named for that page and uses the browser's own Back, so that page returns
// where it was left; otherwise it keeps its fallback, the home page.
const NAMES = [
  [/\/asteroid-tracker\/map\.html$/, 'the map'], [/\/asteroid-tracker\/object\.html$/, 'the asteroid'],
  [/\/asteroid-tracker\/tracker\.html$/, 'the Asteroid Tracker'], [/\/asteroid-tracker\/(index\.html)?$/, 'the Asteroid Tracker home page'], [/\/image-explorer\/explore\.html$/, 'the Image Explorer'],
  [/\/image-explorer\/(index\.html)?$/, 'the Image Explorer home page'], [/\/mars-data\/charts\//, 'the Mars charts'],
  [/\/mars-data\/method\//, 'How the data is made'], [/\/mars-data\//, 'Mars Data'], [/\/about\//, 'About'], [/\/privacy\//, 'Privacy'], [/\/terms\//, 'Terms'],
  [/\/credits\//, 'Credits'], [/\/contact\//, 'Contact'], [/\/legal\//, 'Legal'], [/\/sky-finder\/how-to\.html$/, 'How to use Sky Finder'], [/\/sky-finder\//, 'Sky Finder'], [/\/spacecraft\//, 'the spacecraft map'],
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
  el.textContent = name ? 'Back to ' + name : 'Back';   // the arrow is drawn by the style sheet
  el.href = ref.href;
  el.addEventListener('click', (e) => {
    if (history.length > 1 && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); history.back(); }
  });
}

// Rows that scroll sideways (segmented controls and chip rows that don't fit a small screen): a soft fade on the side
// where there is more, and the chosen button scrolled into view, so nothing looks cut off. Decided Nov 12, 2026; since
// Nov 13, 2026 (version 2 of the look) tab bars wrap instead and every segmented control (.seg) gets the fade.
const HSCROLL = '.seg, .popular, [data-hscroll]';
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
    const sel = el.querySelector('[aria-current="page"], [aria-selected="true"], [aria-pressed="true"]');
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
