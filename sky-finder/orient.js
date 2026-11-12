// NASA and ESA Data Projects · Sky Finder · where the phone is pointing · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// The phone's motion sensors (the browser's DeviceOrientation events) give three angles, α β γ. Following the W3C
// specification, the phone's frame is turned into Earth's frame (x east, y north, z up) by
//     R = Rz(α) · Rx(β) · Ry(γ)
// The back camera looks along the phone's −z axis, so it points along R·(0, 0, −1); the top of the screen is the
// phone's +y axis (or +x, −y … when the screen is turned sideways; screen.orientation.angle says which).
//
// α is measured from north only when the browser says so:
//   Android (Chrome)  the "deviceorientationabsolute" event (α from magnetic north)
//   iPhone (Safari)   α is relative to where the phone first pointed; webkitCompassHeading gives the magnetic
//                     heading, and the difference is applied to α
//   neither           the direction is unknown until the visitor calibrates on the Moon, a planet or a star
// Compasses read magnetic north, which differs from true north by up to 20° or more in places, and phones are often
// a further 5–15° off; calibration (sky-finder/view.js) takes out both at once.
// Readings are smoothed (a short running average of the pointing directions) so the markers do not shake.

const RAD = Math.PI / 180, DEG = 180 / Math.PI;
const wrap180 = (a) => ((a % 360) + 540) % 360 - 180;

function matrix(a, b, g) {
  const ca = Math.cos(a * RAD), sa = Math.sin(a * RAD), cb = Math.cos(b * RAD), sb = Math.sin(b * RAD), cg = Math.cos(g * RAD), sg = Math.sin(g * RAD);
  // Rz(α)·Rx(β)·Ry(γ), row by row
  return [
    [ca * cg - sa * sb * sg, -sa * cb, ca * sg + sa * sb * cg],
    [sa * cg + ca * sb * sg, ca * cb, sa * sg - ca * sb * cg],
    [-cb * sg, sb, cb * cg],
  ];
}
const mul = (M, v) => [M[0][0] * v[0] + M[0][1] * v[1] + M[0][2] * v[2], M[1][0] * v[0] + M[1][1] * v[1] + M[1][2] * v[2], M[2][0] * v[0] + M[2][1] * v[1] + M[2][2] * v[2]];
const norm = (v) => { const n = Math.hypot(...v) || 1; return v.map((x) => x / n); };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const vecOf = (alt, az) => [Math.sin(az * RAD) * Math.cos(alt * RAD), Math.cos(az * RAD) * Math.cos(alt * RAD), Math.sin(alt * RAD)];
export const altAzOf = (v) => ({ alt: Math.asin(Math.max(-1, Math.min(1, v[2]))) * DEG, az: ((Math.atan2(v[0], v[1]) * DEG) % 360 + 360) % 360 });

// A pointing: forward (where the camera looks), up (the top of the screen) and right, as Earth-frame unit vectors.
export function basisFrom(fw, up) {
  const f = norm(fw), u = norm(up.map((x, i) => x - dot(up, f) * f[i]));
  return { f, u, r: cross(f, u) };
}
// For the drag-to-look view (no sensors): looking at altitude/azimuth, screen level.
export function basisLook(alt, az) {
  const f = vecOf(alt, az), u = vecOf(alt + 90, az);
  return basisFrom(f, u);
}

// Starts listening. onChange(state) is called on every reading; state.kind is 'absolute', 'relative' or 'none'.
export function startOrientation(onChange) {
  let kind = 'none', offset = null, fw = null, up = null, last = 0, alive = true;
  const angle = () => (screen.orientation && Number.isFinite(screen.orientation.angle) ? screen.orientation.angle : (window.orientation || 0));
  function reading(e, absolute) {
    if (!alive || e.alpha === null || e.beta === null || e.gamma === null) return;
    let alpha = e.alpha;
    if (absolute) kind = 'absolute';
    else if (Number.isFinite(e.webkitCompassHeading) && e.webkitCompassAccuracy !== -1) {
      // iPhone: line α up with the compass. The compass heading is that of the camera when the phone is upright, of
      // the top of the phone when it lies flat; compare like with like and average the offset.
      const R0 = matrix(alpha, e.beta, e.gamma), back = mul(R0, [0, 0, -1]), top = mul(R0, [0, 1, 0]);
      const v = Math.abs(back[2]) < 0.75 ? back : top, mine = Math.atan2(v[0], v[1]) * DEG;
      const want = e.webkitCompassHeading, d = wrap180(want - mine);
      offset = offset === null ? d : offset + wrap180(d - offset) * 0.08;
      kind = 'absolute';
    } else if (kind !== 'absolute') kind = 'relative';
    if (kind === 'absolute' && !absolute && offset !== null) alpha = alpha - offset;
    const R = matrix(alpha, e.beta, e.gamma), t = angle() * RAD;
    const f = mul(R, [0, 0, -1]), u = mul(R, [Math.sin(t), Math.cos(t), 0]);
    // smoothing: more when still, less when the phone moves quickly
    const k = fw ? Math.min(0.5, 0.12 + 2 * (1 - dot(fw, f))) : 1;
    fw = fw ? norm(fw.map((x, i) => x + (f[i] - x) * k)) : f;
    up = up ? norm(up.map((x, i) => x + (u[i] - x) * k)) : u;
    last = performance.now();
    onChange({ kind, basis: basisFrom(fw, up) });
  }
  const abs = (e) => reading(e, true);
  const rel = (e) => { if (e.absolute === true) reading(e, true); else if (kind !== 'absolute' || !('ondeviceorientationabsolute' in window)) reading(e, false); };
  if ('ondeviceorientationabsolute' in window) addEventListener('deviceorientationabsolute', abs);
  addEventListener('deviceorientation', rel);
  return {
    stop() { alive = false; removeEventListener('deviceorientationabsolute', abs); removeEventListener('deviceorientation', rel); },
    get lastReading() { return last; },
  };
}

// iPhone asks the visitor once; this must run inside a tap. Resolves to false only when the visitor said no; a device
// without sensors simply sends no readings (the view then offers drag-to-look).
export async function askMotion() {
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === 'function') {
    try { return (await D.requestPermission()) === 'granted'; } catch { return false; }
  }
  return true;
}
export { wrap180, dot };
