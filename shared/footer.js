// NASA Data Projects · site links in every footer · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Adds one row of links (About, Privacy, Terms, Credits, Contact, the licence and the source code) to the top of the page's
// <footer class="footer">, so the links are written in one place for every page. Each page loads it with
//   <script type="module" src="<path to>/shared/footer.js"></script>
// Links are worked out from this file's own address, so they are right at any folder depth.

const REPO = 'https://github.com/mcsyme11-byte/NASA-Data-and-API-Projects';
const root = new URL('../', import.meta.url);

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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addLinks);
else addLinks();
