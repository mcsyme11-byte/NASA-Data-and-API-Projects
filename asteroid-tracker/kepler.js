// NASA Data Projects · Asteroid Tracker · positions of many asteroids at once · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Used both on the page (skymap.js) and in the background thread (orbitworker.js), so both give identical positions.
// S holds the orbits as typed arrays (see Asteroids in skymap.js) and receives the positions in S.x, S.y, S.z (au).
// When the date has moved only a little since the last call (playing, stepping), each asteroid's previous eccentric
// anomaly is the starting guess for Kepler's equation, so one or two Newton steps are enough instead of four to
// eight. With quick = true (while playing) one step is taken from the stored sine and cosine, and more only where
// that step moved a lot; the result matches the full solution to within about 20 km.
// force = true fills S.x, S.y, S.z even when jd has not changed (the background thread alternates two sets of arrays).
export function solvePositions(S, jd, quick = false, force = false) {
  if (!force && jd === S.jd) return;
  const warm = S.jd !== null && Math.abs(jd - S.jd) < 60;
  S.jd = jd;
  const { n, a, e, M0, nn, ep, b, m11, m12, m21, m22, m31, m32, x, y, z } = S;
  const Ev = S.Ev || (S.Ev = new Float64Array(n));
  const Sv = S.Sv || (S.Sv = new Float64Array(n)), Cv = S.Cv || (S.Cv = new Float64Array(n));
  const TWO_PI = 2 * Math.PI, fast = quick && warm;
  S.exact = !fast;
  for (let k = 0; k < n; k++) {
    const ek = e[k], M = M0[k] + nn[k] * (jd - ep[k]);      // mean anomaly, not wrapped, so E stays continuous
    let E, sE, cE;
    if (fast) {
      E = Ev[k];
      let d = (E - ek * Sv[k] - M) / (1 - ek * Cv[k]);
      E -= d;
      sE = Math.sin(E); cE = Math.cos(E);
      // more steps only where the first one moved a lot (fast play, very stretched orbits)
      for (let it = 0; it < 6 && (d > 1e-5 || d < -1e-5); it++) {
        d = (E - ek * sE - M) / (1 - ek * cE);
        E -= d; sE = Math.sin(E); cE = Math.cos(E);
      }
    } else {
      if (warm) E = Ev[k];
      else {
        let Mw = M % TWO_PI; if (Mw > Math.PI) Mw -= TWO_PI; else if (Mw < -Math.PI) Mw += TWO_PI;
        E = (ek < 0.8 ? Mw : (Mw < 0 ? -Math.PI : Math.PI)) + (M - Mw);
      }
      sE = 0; cE = 0;
      for (let it = 0; it < 12; it++) {
        sE = Math.sin(E); cE = Math.cos(E);
        const d = (E - ek * sE - M) / (1 - ek * cE);
        E -= d;
        if (d < 1e-9 && d > -1e-9) { sE = Math.sin(E); cE = Math.cos(E); break; }
      }
    }
    Ev[k] = E; Sv[k] = sE; Cv[k] = cE;
    const xp = a[k] * (cE - ek), yp = b[k] * sE;
    x[k] = m11[k] * xp + m12[k] * yp; y[k] = m21[k] * xp + m22[k] * yp; z[k] = m31[k] * xp + m32[k] * yp;
  }
}
