#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · builds the globe's sky files · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: the d3-celestial project's data files (Olaf Frohn, BSD 3-Clause licence; see data/LICENSE-d3-celestial.txt).
# Get them with `npm install d3-celestial` and pass the package's data folder:
#
#   python3 image-explorer/tools/build_sky.py node_modules/d3-celestial/data
#
# Writes, in image-explorer/data/:
#   stars.json   [ra, dec, magnitude, colour index] for the 5,044 stars to magnitude 6
#   sky.json     galaxies, nebulae and star clusters: every Messier object, every object with a common name, and
#                every galaxy to magnitude 12, plus a few famous Hubble and Webb targets the catalogue lacks
#   constellations.json   the 88 constellations' lines and the position of each name
# Right ascension is stored from 0 to 360 degrees (the source uses -180 to 180).

import json, math, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else 'node_modules/d3-celestial/data')
OUT = Path(__file__).resolve().parent.parent / 'data'
load = lambda name: json.loads((SRC / name).read_text(encoding='utf-8'))
ra360 = lambda ra: round(ra % 360, 4)
num = lambda v: None if v in ('', None) or float(v) >= 99 else round(float(v), 1)

GALAXY = {'gg': 'Group of galaxies', 'g': 'Galaxy', 's': 'Spiral galaxy', 's0': 'Lenticular galaxy',
          'sd': 'Dwarf galaxy', 'i': 'Irregular galaxy', 'e': 'Elliptical galaxy'}
CLUSTER = {'oc': 'Open star cluster', 'gc': 'Globular star cluster', 'pos': 'Group of stars'}
NEBULA = {'dn': 'Dark nebula', 'bn': 'Bright nebula', 'sfr': 'Star-forming nebula', 'rn': 'Reflection nebula',
          'en': 'Emission nebula', 'pn': 'Planetary nebula', 'snr': 'Supernova remnant'}
def kind(t):
    if t in GALAXY: return 'galaxy', GALAXY[t]
    if t in CLUSTER: return 'cluster', CLUSTER[t]
    return 'nebula', NEBULA.get(t, 'Nebula')

# names NASA uses in its picture library, where the catalogue's common name differs
RENAME = {'NGC 3372': 'Carina Nebula', 'NGC 3132': 'Southern Ring Nebula', 'NGC 292': 'Small Magellanic Cloud',
          'NGC 6563': 'NGC 6563'}   # the catalogue also calls NGC 6563 the Southern Ring; NASA's Southern Ring is NGC 3132
# Messier objects whose library search works better under another term
TERM = {'M77': 'Messier 77', 'M87': 'Messier 87', 'M24': 'Messier 24', 'M73': 'Messier 73',
        'M16': 'Eagle Nebula', 'M45': 'Pleiades', 'M44': 'Beehive Cluster'}
FAMOUS_M = {'M1', 'M8', 'M13', 'M16', 'M20', 'M27', 'M31', 'M33', 'M42', 'M44', 'M45', 'M51', 'M57', 'M81',
            'M87', 'M101', 'M104'}
FAMOUS = {'Carina Nebula', 'Southern Ring Nebula', 'Helix Nebula', "Cat's Eye Nebula", 'Horsehead Nebula',
          'Tarantula Nebula', 'Large Magellanic Cloud', 'Small Magellanic Cloud', 'Centaurus A', 'Sculptor Galaxy',
          'Needle Galaxy', 'Omega Centauri', 'North America Nebula', 'Rosette Nebula', 'Veil Nebula', "Stephan's Quintet"}
# famous Hubble and Webb targets missing from the catalogue: J2000 positions, degrees. Checked Nov 9, 2026 against
# SIMBAD's values as published (Wikipedia's infoboxes cite SIMBAD; NASA's Webb image pages for the Cartwheel)
EXTRA = [
    ("Stephan's Quintet", 'HCG 92', 'galaxy', 'Group of galaxies', 338.990, 33.960),
    ('Cartwheel Galaxy', 'ESO 350-40', 'galaxy', 'Ring galaxy', 9.421, -33.716),          # 00h 37m 41.1s, -33° 42' 59"
    ('Westerlund 2', 'Westerlund 2', 'cluster', 'Young star cluster', 155.992, -57.764),   # 10h 23m 58.1s, -57° 45' 49"
    ('Cassiopeia A', '3C 461', 'nebula', 'Supernova remnant', 350.850, 58.815),         # 23h 23m 24s, +58° 48.9'
    ('Rho Ophiuchi', 'Rho Oph cloud', 'nebula', 'Star-forming cloud', 247.025, -24.542),  # the cloud complex: 16h 28m 06s, -24° 32.5'
]

def tidy(s): return s.replace('´', '’').replace("'", '’')

def messier_name(mid, alt, k):
    if not alt: return 'Messier ' + mid[1:]
    alt = tidy(alt)
    if k == 'galaxy' and not any(w in alt.lower() for w in ('galaxy', 'cloud')) and not alt.endswith(' A'):
        return alt + ' Galaxy'
    return alt

def term_for(name):
    """The words to search NASA's library with: the name without a part number, plain apostrophes."""
    return name.split(' (')[0].replace('\u2019', "'")

def sep(a, b):
    """Angle between two sky positions, degrees."""
    r = math.radians
    c = (math.sin(r(a[1])) * math.sin(r(b[1])) + math.cos(r(a[1])) * math.cos(r(b[1])) * math.cos(r(a[0] - b[0])))
    return math.degrees(math.acos(max(-1, min(1, c))))

# ---- stars ----
stars = []
for f in load('stars.6.json')['features']:
    ra, dec = f['geometry']['coordinates']; p = f['properties']
    bv = p.get('bv'); bv = round(float(bv), 2) if bv not in ('', None) else 0.6
    stars.append([ra360(ra), round(dec, 4), round(float(p['mag']), 2), bv])

# ---- sky objects: [id, name, kind, type, ra, dec, mag, size, famous, search term, other designation] ----
sky, taken = [], []
for f in load('messier.json')['features']:
    p = f['properties']; k, t = kind(p['type'])
    ra, dec = f['geometry']['coordinates']
    name = messier_name(f['id'], p.get('alt'), k)
    term = TERM.get(f['id'], term_for(name))
    sky.append([f['id'], name, k, t, ra360(ra), round(dec, 4), num(p.get('mag')), p.get('dim') or None,
                1 if f['id'] in FAMOUS_M else 0, term, p.get('desig') or ''])
    taken.append((ra, dec))

names = load('dsonames.json')
used = {s[1] for s in sky}
for f in load('dsos.14.json')['features']:
    fid, p = f['id'], f['properties']
    if fid.startswith('M '): continue
    named = fid in names
    k, t = kind(p['type'])
    mag = num(p.get('mag'))
    if not named and not (k == 'galaxy' and mag is not None and mag <= 12): continue
    ra, dec = f['geometry']['coordinates']
    if any(sep((ra, dec), m) < 0.2 for m in taken): continue          # already listed as a Messier object
    name = RENAME.get(fid) or (tidy(names[fid]['name']) if named else p.get('desig') or fid)
    if name == fid and p.get('desig') and p['desig'] != fid: name = p['desig']
    if name in used:                                                   # parts of one object (the Rosette's NGC numbers)
        if any(x[1] == name and x[0].startswith('M') for x in sky): continue   # the Messier entry covers it
        name = f'{name} ({fid})'
    if p['type'] == 'dn': mag = None                                    # a dark nebula has no meaningful brightness
    used.add(name)
    sky.append([fid, name, k, t, ra360(ra), round(dec, 4), mag, p.get('dim') or None,
                1 if name in {tidy(x) for x in FAMOUS} else 0, term_for(name), ''])

for name, desig, k, t, ra, dec in EXTRA:
    if tidy(name) in used: continue                                    # the catalogue has it after all
    sky.append([desig, tidy(name), k, t, ra, dec, None, None, 1, term_for(name), ''])

# ---- constellations ----
lines = {f['id']: f['geometry']['coordinates'] for f in load('constellations.lines.json')['features']}
cons = []
for f in load('constellations.json')['features']:
    ra, dec = f['geometry']['coordinates']
    cons.append({'id': f['id'], 'name': f['properties']['en'], 'at': [ra360(ra), round(dec, 2)],
                 'lines': [[[ra360(a), round(d, 3)] for a, d in seg] for seg in lines.get(f['id'], [])]})

OUT.mkdir(exist_ok=True)
dump = lambda name, obj: (OUT / name).write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
dump('stars.json', stars); dump('sky.json', sky); dump('constellations.json', cons)
count = lambda k: sum(1 for s in sky if s[2] == k)
print(f'stars {len(stars)} · sky objects {len(sky)} (galaxies {count("galaxy")}, nebulae {count("nebula")}, '
      f'clusters {count("cluster")}; famous {sum(s[8] for s in sky)}) · constellations {len(cons)}')
