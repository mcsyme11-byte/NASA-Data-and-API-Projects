// NASA and ESA Data Projects · Asteroid Tracker · the impact-risk list · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Every object with a calculated chance of hitting Earth, from both impact-monitoring centres side by side: ESA's NEO
// Coordination Centre (NEOCC) and NASA/JPL's Sentry. Read from data/risk.json, written daily by fetch_risk.py.
// Filters: which list (both, ESA only, NASA only), size and name; sorted by any column; 50 rows at a time.

import { fmt, sizePicture } from './format.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const PAGE = 50;

// "1 in 2,700" (two significant figures), with a percentage once the chance reaches 1 in 1,000
export function chanceText(p) {
  if (!(p > 0)) return '';
  const n = 1 / p, r = n >= 100 ? Number(n.toPrecision(2)) : Math.round(n);
  return `1 in ${fmt(Math.max(1, r))}` + (p >= 0.001 ? ` <span class="s">${fmt(p * 100, p >= 0.1 ? 0 : p >= 0.01 ? 1 : 2)}%</span>` : '');
}
const ps = (v) => (v === null || v === undefined ? '' : (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v).toFixed(2));
const dateText = (d) => (d ? new Date(d + 'T00:00:00Z').toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' }) : '');
// pages for one object at each centre
const esaPage = (des) => `https://neo.ssa.esa.int/search-for-asteroids?tab=summary&des=${encodeURIComponent(des.replace(/ /g, ''))}`;
const nasaPage = (des) => `https://cneos.jpl.nasa.gov/sentry/details.html#?des=${encodeURIComponent(des)}`;

export function mountRisk(root, url) {
  const st = { rows: null, list: 'all', size: 0, q: '', sort: 'ps', dir: -1, shown: PAGE, open: null };
  const $ = (s) => root.querySelector(s);

  function render() {
    const R = st.rows;
    const q = st.q.trim().toLowerCase().replace(/\s+/g, ' ');
    let list = R.filter((r) => (st.list === 'all' || (st.list === 'both' ? r.esa && r.nasa : st.list === 'esa' ? r.esa && !r.nasa : r.nasa && !r.esa))
      && (!st.size || (r.d || 0) >= st.size) && (!q || r.key.includes(q)));
    const key = { name: (r) => r.name, d: (r) => r.d || 0, date: (r) => r.date || '9999', ip: (r) => r.ip, ps: (r) => r.ps,
      esa: (r) => (r.esa ? r.esa.ip : 0), nasa: (r) => (r.nasa ? r.nasa.ip : 0) };
    const k = key[st.sort];
    list.sort((a, b) => { const x = k(a), y = k(b); return (x < y ? -1 : x > y ? 1 : 0) * st.dir || b.ps - a.ps; });
    $('#riskCount').textContent = `${fmt(list.length)} of ${fmt(R.length)} objects`;
    root.querySelectorAll('#riskTable th[data-k]').forEach((th) =>
      th.setAttribute('aria-sort', th.dataset.k === st.sort ? (st.dir > 0 ? 'ascending' : 'descending') : 'none'));
    const rows = list.slice(0, st.shown).map((r) => {
      const href = r.id ? `object.html?id=${encodeURIComponent(r.id)}` : nasaPage(r.des);
      const one = (who, c) => (c ? `<b>${chanceText(c.ip)}</b><span class="s">${dateText(c.date)}${c.ts !== null && c.ts !== undefined ? ` · Torino ${c.ts}` : ''}</span>` : `<span class="none">not on ${who}'s list</span>`);
      const open = st.open === r.des;
      return `<tr data-des="${esc(r.des)}" aria-expanded="${open}" tabindex="0">
        <td data-label="Name"><a href="${esc(href)}"${r.id ? '' : ' target="_blank" rel="noopener"'}>${esc(r.name)}</a></td>
        <td data-label="Size, est." class="num">${r.d ? (r.d >= 1000 ? fmt(r.d / 1000, 1) + ' km' : fmt(r.d) + ' m') : ''}</td>
        <td data-label="ESA (NEOCC)" class="num"><span>${one('ESA', r.esa)}</span></td>
        <td data-label="NASA (Sentry)" class="num"><span>${one('NASA', r.nasa)}</span></td>
        <td data-label="Palermo" class="num"><span>${r.esa ? 'ESA ' + ps(r.esa.ps) : ''}${r.esa && r.nasa ? '<br>' : ''}${r.nasa ? 'NASA ' + ps(r.nasa.ps) : ''}</span></td>
      </tr>${open ? detail(r) : ''}`;
    }).join('');
    $('#riskTable tbody').innerHTML = rows || `<tr class="msg"><td colspan="5"><div class="state small">No object matches. Try another list, a smaller size or fewer letters.</div></td></tr>`;
    $('#riskMore').hidden = list.length <= st.shown;
    $('#riskMore').textContent = `Show ${fmt(Math.min(PAGE, list.length - st.shown))} more`;
  }

  function detail(r) {
    const side = (who, c, page) => c ? `<div class="tile"><div class="label">${who}</div>
        <div class="value">${chanceText(c.ip)}</div>
        <div class="note">most likely impact ${dateText(c.date)}${c.years ? `; possible impacts ${esc(String(c.years).replace("-", "–"))}` : ''}${c.cum ? `; all of them together ${chanceText(c.cum).replace(/ <span.*$/, '')}` : ''}.
        Palermo ${ps(c.ps)}${c.ts !== null && c.ts !== undefined ? `, Torino ${c.ts}` : ', Torino not given (more than 100 years ahead)'}${c.special ? '. On ESA\'s special risk list, for cases followed with extra care' : ''}.
        <a href="${page}" target="_blank" rel="noopener">${who === 'ESA NEOCC' ? 'ESA\'s page' : 'NASA\'s page'} ›</a></div></div>`
      : `<div class="tile"><div class="label">${who}</div><div class="value none">Not listed</div><div class="note">${who === 'ESA NEOCC' ? 'ESA' : 'NASA'} has found no impact chance for it${who === 'ESA NEOCC' ? '' : ' with its own calculation'}.</div></div>`;
    const sz = r.d ? sizePicture({ dmin: r.d, dmax: r.d }) : '';
    return `<tr class="drow"><td colspan="5"><div class="tiles two">${side('ESA NEOCC', r.esa, esaPage(r.des))}${side('NASA/JPL Sentry', r.nasa, nasaPage(r.des))}</div>
      <p class="note">${sz ? 'Size: ' + esc(sz) + '. ' : ''}${r.v ? `Speed if it hit: about ${fmt(r.v, 1)} km/s. ` : ''}${r.id ? `<a href="object.html?id=${encodeURIComponent(r.id)}">Its orbit and close approaches ›</a>` : ''}</p></td></tr>`;
  }

  function load() {
    $('#riskTable tbody').innerHTML = `<tr class="msg"><td colspan="5"><div class="state small">Loading both risk lists…</div></td></tr>`;
    fetch(url).then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); }).then((d) => {
      const F = d.fields, ix = Object.fromEntries(F.map((f, i) => [f, i]));
      st.rows = d.rows.map((r) => {
        const g = (f) => r[ix[f]];
        const esa = g('esa_ip_max') !== null ? { ip: g('esa_ip_max'), ps: g('esa_ps_max'), ts: g('esa_ts'), date: g('esa_date'), years: g('esa_years'), cum: g('esa_ip_cum'), special: g('esa_special') } : null;
        const nasa = g('nasa_ip_max') !== null ? { ip: g('nasa_ip_max'), ps: g('nasa_ps_max'), ts: g('nasa_ts'), date: g('nasa_date'), years: g('nasa_years'), cum: g('nasa_ip_cum') } : null;
        const name = g('name');
        return { des: g('designation'), name, id: g('neows_id'), d: g('diameter_m'), v: g('v_kms'), esa, nasa,
          key: (name + ' ' + g('designation')).toLowerCase().replace(/[()]/g, ''),
          ip: Math.max(esa ? esa.ip : 0, nasa ? nasa.ip : 0),
          ps: Math.max(esa && esa.ps !== null ? esa.ps : -99, nasa && nasa.ps !== null ? nasa.ps : -99),
          date: [esa && esa.date, nasa && nasa.date].filter(Boolean).sort()[0] || null };
      });
      const c = d.counts, tsMax = Math.max(0, ...st.rows.map((r) => Math.max(r.esa?.ts ?? 0, r.nasa?.ts ?? 0)));
      $('#riskTiles').innerHTML = [
        ['ESA NEOCC', fmt(c.esa), 'objects with any impact chance'],
        ['NASA/JPL Sentry', fmt(c.nasa), 'objects with any impact chance'],
        ['On both lists', fmt(c.both), 'found by both centres'],
        ['Highest Torino rating', String(tsMax), tsMax === 0 ? 'no object needs public concern' : 'see the rows rated above 0'],
      ].map(([l, v, n]) => `<div class="tile"><div class="label">${l}</div><div class="value">${v}</div><div class="note">${n}</div></div>`).join('');
      $('#riskUpdated').textContent = `ESA's list of ${d.esa_updated || 'an unknown date'}; NASA's list fetched ${d.updated.replace('T', ' ').replace('Z', ' UTC')}.`;
      render();
    }).catch(() => {
      $('#riskTiles').innerHTML = '';
      $('#riskTable tbody').innerHTML = `<tr class="msg"><td colspan="5"><div class="state small">The risk lists could not be loaded. Check the connection and reload the page.</div></td></tr>`;
    });
  }

  // controls
  root.querySelectorAll('[data-risklist]').forEach((b) => b.addEventListener('click', () => {
    st.list = b.dataset.risklist; st.shown = PAGE;
    root.querySelectorAll('[data-risklist]').forEach((x) => x.setAttribute('aria-pressed', x === b)); if (st.rows) render();
  }));
  $('#riskSize').addEventListener('change', (e) => { st.size = Number(e.target.value); st.shown = PAGE; if (st.rows) render(); });
  $('#riskQ').addEventListener('input', (e) => { st.q = e.target.value; st.shown = PAGE; if (st.rows) render(); });
  root.querySelectorAll('#riskTable th[data-k]').forEach((th) => {
    const go = () => { const k = th.dataset.k; st.dir = st.sort === k ? -st.dir : (k === 'name' || k === 'date' ? 1 : -1); st.sort = k; render(); };
    th.addEventListener('click', go); th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
  });
  $('#riskSort').addEventListener('change', (e) => { const [k, d] = e.target.value.split(':'); st.sort = k; st.dir = Number(d); render(); });
  $('#riskMore').addEventListener('click', () => { st.shown += PAGE; render(); });
  const toggle = (tr) => { st.open = st.open === tr.dataset.des ? null : tr.dataset.des; render(); };
  $('#riskTable tbody').addEventListener('click', (e) => { const tr = e.target.closest('tr[data-des]'); if (tr && !e.target.closest('a')) toggle(tr); });
  $('#riskTable tbody').addEventListener('keydown', (e) => { const tr = e.target.closest('tr[data-des]'); if (tr && (e.key === 'Enter' || e.key === ' ') && !e.target.closest('a')) { e.preventDefault(); toggle(tr); } });
  load();
  return { get state() { return st; } };
}
