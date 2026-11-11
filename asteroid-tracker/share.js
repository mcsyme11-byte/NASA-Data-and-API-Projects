// NASA and ESA Data Projects · Asteroid Tracker · share links · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// "Share this view" and "Share this week": the page's state is written into a link (plain, readable parameters), which
// reopens the same view. On a phone the system share sheet opens; elsewhere the link is copied to the clipboard. If
// neither is available, the link is shown in a box, selected, ready to copy. Nothing is stored or sent anywhere.

// Reads the share parameters from the address, then removes them from it, so that a reload or Back after the user has
// moved the view returns to where they were rather than to the shared view. Call before placeKeeper().
export function takeShared(names) {
  const q = new URLSearchParams(location.search);
  if (!q.has('view')) return null;
  const out = {};
  for (const n of names) if (q.has(n)) out[n] = q.get(n);
  q.delete('view'); names.forEach((n) => q.delete(n));
  const rest = q.toString();
  history.replaceState(history.state, '', location.pathname + (rest ? '?' + rest : '') + location.hash);
  return out;
}

// The page's own address with these parameters (and view=1, which marks a shared link).
export function linkWith(params, hash = '') {
  const q = new URLSearchParams({ view: '1' });
  for (const [k, v] of Object.entries(params)) if (v !== null && v !== undefined && v !== '') q.set(k, v);
  return location.origin + location.pathname + '?' + q.toString() + hash;
}

// Wires a button to share the link that make() returns; msg shows what happened.
export function shareButton(btn, msg, make, title) {
  let timer = null;
  const say = (html) => { msg.innerHTML = html; msg.hidden = false; clearTimeout(timer); timer = setTimeout(() => { msg.hidden = true; }, 6000); };
  btn.addEventListener('click', async () => {
    const url = make();
    const phone = matchMedia('(pointer: coarse)').matches;
    if (phone && navigator.share) {
      try { await navigator.share({ title, url }); return; } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    try {
      await navigator.clipboard.writeText(url);
      say('Link copied.');
      return;
    } catch { /* clipboard not available: show the link instead */ }
    say('<label>Copy this link: <input type="text" readonly class="sharelink"></label>');
    const box = msg.querySelector('input');
    box.value = url; clearTimeout(timer); box.focus(); box.select();
  });
}
