// NASA and ESA Data Projects · Image Explorer · builds the place list for place search · © 2026 Malcolm Syme · mcsyme11@gmail.com
//
// Source: GeoNames (geonames.org, CC BY 4.0) through the all-the-cities package (MIT), which holds every GeoNames
// place of 1,000 people or more. Run from a folder where `npm install all-the-cities@3.1.0` has been done:
//
//   node path/to/image-explorer/tools/build_places.mjs path/to/image-explorer/data/places.json
//
// Keeps every place of 10,000 people or more and every capital, largest first, as
// [name, country code, latitude, longitude, 1 for a capital]. Country names come from the browser (Intl.DisplayNames).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';

const require = createRequire(process.cwd() + '/');
const cities = require('all-the-cities');
const out = process.argv[2] || 'places.json';

const keep = cities
  .filter(c => c.population >= 10000 || c.featureCode === 'PPLC')
  .sort((a, b) => b.population - a.population)
  .map(c => [c.name, c.country, +c.loc.coordinates[1].toFixed(3), +c.loc.coordinates[0].toFixed(3), c.featureCode === 'PPLC' ? 1 : 0]);

writeFileSync(out, JSON.stringify(keep));
console.log(`${keep.length} places (${keep.filter(p => p[4]).length} capitals) → ${out}`);
