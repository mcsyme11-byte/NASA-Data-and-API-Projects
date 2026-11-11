#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · builds the list of smaller natural features for place search
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: GeoNames (geonames.org, CC BY 4.0), the worldwide dumps allCountries.zip (one line a place, tab-separated;
# about 400 MB zipped) and alternateNamesV2.zip (other names, including links to Wikipedia articles), from
# https://download.geonames.org/export/dump/. Run by the "Build smaller places" GitHub job
# (.github/workflows/build-places.yml), or by hand:
#
#   python3 image-explorer/tools/build_geonames_features.py allCountries.zip alternateNamesV2.zip [limit]
#
# Keeps natural features (lakes, rivers, glaciers, peaks, passes, valleys, islands, parks and more) that have an
# English Wikipedia article (a sign that a place is known beyond its own area), most-named first. Places already in
# features.json (Natural Earth, the larger features) are left out.
# Writes image-explorer/data/features-more.json: [name, kind, latitude, longitude, importance], importance 5–9
# (Natural Earth's own features are 0–10; the most-named places get 5).

import csv, io, json, math, sys, zipfile
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'data' / 'features-more.json'
# GeoNames feature code → the word shown in the suggestions, and the fewest names a place needs to be kept
CODES = {   # (the number is no longer used as a filter; the Wikipedia link decides)
    'LK': ('Lake', 3), 'LKS': ('Lakes', 3), 'RSV': ('Reservoir', 3), 'LKSL': ('Salt lake', 2), 'LGN': ('Lagoon', 3),
    'STM': ('River', 4), 'STMS': ('Rivers', 4), 'GLCR': ('Glacier', 2), 'ICECAP': ('Ice cap', 1), 'FLLS': ('Waterfall', 2),
    'BAY': ('Bay', 4), 'FJD': ('Fjord', 2), 'GULF': ('Gulf', 3), 'STRT': ('Strait', 3), 'SPNG': ('Spring', 4),
    'MT': ('Mountain', 3), 'PK': ('Peak', 3), 'MTS': ('Mountains', 3), 'VLC': ('Volcano', 2), 'PASS': ('Mountain pass', 2),
    'VAL': ('Valley', 3), 'CNYN': ('Canyon', 2), 'GRGE': ('Gorge', 2), 'CAVE': ('Cave', 3), 'ISL': ('Island', 3),
    'ISLS': ('Islands', 3), 'PEN': ('Peninsula', 3), 'CAPE': ('Cape', 4), 'DSRT': ('Desert', 2), 'PLAT': ('Plateau', 3),
    'PRK': ('Park', 4), 'RESN': ('Nature reserve', 4), 'RESF': ('Forest reserve', 5), 'FRST': ('Forest', 4),
    'CRTR': ('Crater', 2), 'ATOL': ('Atoll', 2), 'RF': ('Reef', 3), 'BCH': ('Beach', 5), 'DLTA': ('Delta', 2),
}
LIMIT = int(sys.argv[3]) if len(sys.argv) > 3 else 60000        # at most this many places, the most-named first

wiki, english = set(), {}                                        # places with an English Wikipedia article; English names
with zipfile.ZipFile(sys.argv[2]) as z, z.open('alternateNamesV2.txt') as f:
    for line in io.TextIOWrapper(f, encoding='utf-8'):
        # id, place, language, name, preferred, short, colloquial, historic, from, to
        c = line.rstrip('\n').split('\t')
        if len(c) < 4: continue
        if c[2] == 'link' and 'en.wikipedia.org/' in c[3]: wiki.add(c[1])
        elif c[2] == 'en' and not (len(c) > 7 and (c[6] == '1' or c[7] == '1')):
            if c[1] not in english or (len(c) > 4 and c[4] == '1'): english[c[1]] = c[3]   # the preferred English name wins

def near(a, b, km):
    dlat = math.radians(b[0] - a[0]); dlon = math.radians(b[1] - a[1]) * math.cos(math.radians((a[0] + b[0]) / 2))
    return 6371 * math.hypot(dlat, dlon) < km

known = {}
for name, kind, lat, lon, *rest in json.loads((ROOT / 'data' / 'features.json').read_text(encoding='utf-8')):
    known.setdefault(name.lower(), []).append((lat, lon))

kept, seen, stats = [], Counter(), Counter()
with zipfile.ZipFile(sys.argv[1]) as z, z.open('allCountries.txt') as f:
    for row in csv.reader(io.TextIOWrapper(f, encoding='utf-8'), delimiter='\t', quoting=csv.QUOTE_NONE):
        code = row[7]
        if code not in CODES: continue
        stats[code] += 1
        kind, need = CODES[code]
        names = len({n for n in row[3].split(',') if n})        # alternate names
        if row[0] not in wiki: continue
        name = english.get(row[0]) or (row[2] if row[2].isascii() and row[2] else row[1])   # "Lake Como" over "Lago di Como"
        name = ' '.join(name.split())
        if not name: continue
        lat, lon = round(float(row[4]), 3), round(float(row[5]), 3)
        if any(near((lat, lon), q, 150) for q in known.get(name.lower(), [])): continue
        key = (name.lower(), kind, round(lat), round(lon))      # the same place listed twice
        if key in seen: continue
        seen[key] = 1
        if code in ('MT', 'PK', 'VLC') and row[15]:
            kind = f'{kind} · {int(row[15]):,} m'
        kept.append((names, name, kind, lat, lon, row[8]))

kept.sort(key=lambda r: -r[0])
kept = kept[:LIMIT]
out = [[n, k, la, lo, max(5, 9 - min(4, (c - 2) // 3)), cc] for c, n, k, la, lo, cc in kept]
OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'{len(out):,} places, {OUT.stat().st_size / 1e6:.2f} MB → {OUT}')
print('kinds kept:', Counter(k.split(' ·')[0] for _, _, k, *_ in kept).most_common())
for probe in ('Lake Geneva', 'Lake Louise', 'Bow Lake', 'Johnston Canyon', 'Takakkaw Falls', 'Banff National Park', 'Bow River', 'Moraine Lake', 'Athabasca Glacier', 'Mount Rundle', 'Peyto Lake', 'Lake Como', 'Matterhorn', 'Half Dome', 'Loch Ness'):
    hit = [r for r in out if r[0] == probe]
    print(f'  {probe}: {hit[:2] if hit else "not kept"}')
print('GeoNames rows by code:', stats.most_common(12), '| places with an English Wikipedia link:', len(wiki))
