// NASA Data Projects · Asteroid Tracker · size comparisons · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// An asteroid's size put next to something familiar: "About 3 times the length of an NHL hockey rink (61 m)".
//
// Rules:
//   1. Use the middle of NASA's estimate: the geometric mean of the smallest and largest size, √(min × max), because
//      the range spans a factor (often about 2.2), not a fixed number of metres.
//   2. If a familiar object is within 25% of that size (ratio 0.8 to 1.25), say "about the length of" that object.
//   3. Otherwise use the largest familiar object that is smaller, as a whole multiple: "about 3 times the length of";
//      under 1.5 times, "a little more than".
//   4. Below 80% of the smallest object (a person, 1.7 m): "smaller than a person is tall".
// The objects are spaced so a multiple is at most about 5; past the largest (Mount Everest), any multiple is used.

// [phrase, size in metres, shown size]. Checked Nov 9, 2026: NHL rink 200 ft; CFL field 150 yd with end zones
// (110 yd between goal lines, two 20 yd end zones); Eiffel Tower 330 m; CN Tower 553 m; Golden Gate Bridge
// 2,737 m including approaches; Mount Everest 8,849 m.
export const THINGS = [
  ['the height of a person', 1.7, '1.7 m'],
  ['the length of a family car', 4.5, '4.5 m'],
  ['the length of a school bus', 12, '12 m'],
  ['the length of a blue whale', 25, '25 m'],
  ['the length of an NHL hockey rink', 61, '61 m'],
  ['the length of a Canadian football field', 137, '137 m'],
  ['the height of the Eiffel Tower', 330, '330 m'],
  ['the height of the CN Tower', 553, '553 m'],
  ['the length of the Golden Gate Bridge', 2737, '2.7 km'],
  ['the height of Mount Everest', 8849, '8.8 km'],
];

// Sizes in metres; returns a sentence, or '' when the size is unknown.
export function compareSize(dminM, dmaxM) {
  if (!(dminM > 0) || !(dmaxM > 0)) return '';
  const d = Math.sqrt(dminM * dmaxM);
  if (d < 0.8 * THINGS[0][1]) return 'Smaller than a person is tall';
  let best = null;
  for (const t of THINGS) {
    const r = d / t[1];
    if (r >= 0.8 && r <= 1.25 && (!best || Math.abs(Math.log(r)) < Math.abs(Math.log(d / best[1])))) best = t;
  }
  if (best) return `About ${best[0]} (${best[2]})`;
  const below = THINGS.filter((t) => t[1] < d).pop();
  const x = d / below[1];
  if (x < 1.5) return `A little more than ${below[0]} (${below[2]})`;
  return `About ${Math.round(x)} times ${below[0]} (${below[2]})`;
}
