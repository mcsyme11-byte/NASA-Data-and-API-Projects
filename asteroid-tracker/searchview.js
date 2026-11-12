// NASA and ESA Data Projects · Asteroid Tracker · the Search tab · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Results appear after every letter typed. The first search loads data/neos.json (about 43,000 asteroids) once;
// after that each keystroke is answered from memory in a few milliseconds.

import { searchNames, countMatches, resultCard, decodeCode } from './search.js';
import { COL } from './skymap.js';
import { fmt } from './format.js';

const POPULAR = ['Apophis', 'Bennu', 'Ryugu', 'Eros', 'Didymos', 'Itokawa', 'Phaethon', '2024 YR4', 'Florence', 'Toutatis'];

export function mountSearch(root, loadRows) {
  root.innerHTML = `
    <div class="searchhead">
      <label class="bigsearch"><span class="sr">Search every near-Earth asteroid and comet</span>
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M15.5 15.5 21 21" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
        <input type="search" id="q" placeholder="A name or code, like 2024 YR4" autocomplete="off" spellcheck="false" autocapitalize="off">
        <button type="button" class="qclear" id="qclear" aria-label="Clear the search" hidden>Clear</button>
      </label>
      <p class="note" id="qnote">Searching every known near-Earth asteroid and comet<span id="qcount"></span>. Results appear as you type.</p>
      <div class="searchopts">
        <label class="speed">Found in <select id="qyear"><option value="">Any year</option></select></label>
        <div class="popular"><span class="barlbl">Try</span>${POPULAR.map((p) => `<button class="chip" data-q="${p}">${p}</button>`).join('')}</div>
      </div>
      <div class="decodebar" id="qdecode" hidden></div>
    </div>
    <div class="results" id="results" aria-live="polite"></div>
    <p class="note" id="rmore"></p>
    <details class="howto names"><summary>How asteroid names work</summary>
      <p>A new asteroid first gets a <b>code</b> made from when it was found. Take <b>2024 YR4</b>:</p>
      <table class="nametable">
        <tr><th>2024</th><td>the year it was found</td></tr>
        <tr><th>Y</th><td>the half-month: A is January 1–15, B is January 16–31, C is February 1–15, and so on to Y, December 16–31. I and Z are not used.</td></tr>
        <tr><th>R4</th><td>its place in that half-month. The letters A to Z without I count 25 finds; the number says how many times the alphabet was used up before. R is the 17th letter, so R4 means 4 × 25 + 17 = the <b>117th</b> find of late December 2024.</td></tr>
      </table>
      <p>Once its orbit is known well, it gets a permanent <b>number</b> in the official list (99942), and the people who found it may suggest a <b>name</b>, which the International Astronomical Union approves. The full form keeps all three: <b>99942 Apophis (2004 MN4)</b>, found June 16–30, 2004, the 113th find that half-month, number 99,942, named after the Egyptian god of chaos.</p>
      <p>Older codes look a little different: <b>A898 PA</b> (Eros) means 1898, and codes such as <b>6344 P-L</b> come from a 1960 telescope survey that numbered its finds its own way. Comets have their own system: <b>1P/Halley</b> was the first periodic comet to be listed.</p>
      <p>Type any code in the search box to see it decoded.</p>
    </details>`;
  const q = root.querySelector('#q'), out = root.querySelector('#results'), more = root.querySelector('#rmore');
  const ysel = root.querySelector('#qyear'), decodeBar = root.querySelector('#qdecode');
  const now = new Date().getUTCFullYear();
  ysel.innerHTML += Array.from({ length: now - 1989 }, (_, i) => now - i).map((y) => `<option value="y${y}">${y}</option>`).join('') +
    [1980, 1970, 1960, 1950].map((d) => `<option value="d${d}">the ${d}s</option>`).join('') + '<option value="before1950">before 1950</option>';
  const keepFor = (v) => {
    if (!v) return null;
    if (v === 'before1950') return (r) => r[COL.found] && r[COL.found] < 1950;
    const n = Number(v.slice(1));
    return v[0] === 'y' ? (r) => r[COL.found] === n : (r) => r[COL.found] >= n && r[COL.found] < n + 10;
  };
  let rows = null, loading = null;
  const ensure = () => {
    if (rows) return Promise.resolve(rows);
    if (!loading) {
      out.innerHTML = '<div class="state small">Loading the list of asteroids…</div>';
      loading = loadRows().then((r) => { rows = r; root.querySelector('#qcount').textContent = ` (${fmt(r.length)})`; return r; })
        .catch(() => { loading = null; out.innerHTML = '<div class="notice warn">The list of asteroids could not be loaded. <button class="linkbtn" data-retry>Try again</button></div>'; throw new Error('load'); });
    }
    return loading;
  };
  const show = () => {
    const text = q.value, yv = ysel.value, keep = keepFor(yv);
    const code = decodeCode(text.replace(/[()]/g, ''));
    decodeBar.hidden = !code;
    if (code) decodeBar.innerHTML = `<b>${text.trim().replace(/[<>&"()]/g, '').toUpperCase()}</b> means: ${code.text}.`;
    if (!text.trim() && !keep) { out.innerHTML = ''; more.textContent = ''; return; }
    ensure().then((r) => {
      if (q.value !== text || ysel.value !== yv) return;   // a newer keystroke or choice has taken over
      const t0 = performance.now(), hits = searchNames(r, text, 24, keep), total = countMatches(r, text, keep);
      out.innerHTML = hits.length ? hits.map((k) => resultCard(r[k])).join('')
        : `<div class="state small">${text.trim() ? `No near-Earth object matches “${text.replace(/[<>&"]/g, '')}”${keep ? ' in that year' : ''}. Try fewer letters, or a code such as 2004 MN4.` : 'None found in that year.'}</div>`;
      const what = text.trim() ? 'matches' : `found ${ysel.options[ysel.selectedIndex].text.replace(/^(\d)/, 'in $1')}, biggest first`;
      more.textContent = total > hits.length ? `Showing the best ${hits.length} of ${fmt(total)} ${what}. Type more letters to narrow it down.` : total ? `${fmt(total)} ${total === 1 && text.trim() ? 'match' : what}.` : '';
      out.dataset.ms = (performance.now() - t0).toFixed(1);
    }).catch(() => {});
  };
  const clear = root.querySelector('#qclear');
  q.addEventListener('input', () => { clear.hidden = !q.value; show(); });
  clear.addEventListener('click', () => { q.value = ''; clear.hidden = true; show(); q.focus(); });
  q.addEventListener('focus', () => { ensure().catch(() => {}); });
  ysel.addEventListener('change', show);
  q.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { const a = out.querySelector('a.rmain'); if (a) location.href = a.href; }
    if (e.key === 'ArrowDown') { const a = out.querySelector('a.rmain'); if (a) { e.preventDefault(); a.focus(); } }
  });
  out.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft'].includes(e.key)) return;
    const links = [...out.querySelectorAll('a.rmain')], i = links.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    const j = i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1);
    if (j < 0) q.focus(); else if (links[j]) links[j].focus();
  });
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-q]'); if (b) { q.value = b.dataset.q; clear.hidden = false; show(); q.focus(); }
    if (e.target.closest('[data-retry]')) { ensure().then(show).catch(() => {}); }
  });
  return { focus: () => q.focus(), set: (v) => { q.value = v; clear.hidden = !v; show(); } };
}
