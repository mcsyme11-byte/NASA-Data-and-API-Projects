// NASA and ESA Data Projects · the quiet field of brass and cream stars behind a page · © 2026 Malcolm Syme ·
// mcsyme11@gmail.com
//
// Decoration only. A page that wants it has <svg class="starfield" id="stars" aria-hidden="true"></svg> as the first
// element of its body and loads this file as a module. The same stars are drawn every time (a fixed seed).

const svg = document.getElementById('stars');
if (svg) {
  const w = 1440, h = 900;
  svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let out = '';
  for (let i = 0; i < 140; i++) {
    const r = rnd() < .9 ? .6 + rnd() * .6 : 1.3;
    out += `<circle cx="${(rnd() * w).toFixed(1)}" cy="${(rnd() * h).toFixed(1)}" r="${r.toFixed(2)}" fill="${rnd() < .25 ? '#C0A062' : '#EDE6D3'}" opacity="${(.15 + rnd() * .45).toFixed(2)}"/>`;
  }
  svg.innerHTML = out;
}
