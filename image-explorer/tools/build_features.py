#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · builds the natural-feature list for place search
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: Natural Earth 1:10m (naturalearthdata.com, public domain), the GeoJSON files in the
# nvkelso/natural-earth-vector repository on GitHub, for example
#   https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson
# Download the six files below into one folder and pass it:
#
#   python3 image-explorer/tools/build_features.py path/to/folder
#
# Writes image-explorer/data/features.json: [name, kind, latitude, longitude, importance, west, south, east, north]
# (importance: Natural Earth's scalerank, 0 = most important; the box is empty for points). One entry per name and kind:
# the pieces of a river or a range are joined, the label point taken from the largest piece.

import json, sys
from pathlib import Path

SRC = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
OUT = Path(__file__).resolve().parent.parent / 'data' / 'features.json'

KINDS = {   # Natural Earth class → the word shown in the suggestions; classes not listed are left out
    'Lake': 'Lake', 'Reservoir': 'Reservoir', 'Alkaline Lake': 'Salt lake', 'River': 'River',
    'mountain': 'Mountain', 'depression': 'Depression', 'plateau': 'Plateau', 'pass': 'Mountain pass',
    'island': 'Island', 'cape': 'Cape', 'waterfall': 'Waterfall', 'pole': 'Pole', 'plain': 'Plain', 'island group': 'Islands',
    'Island': 'Island', 'Range/mtn': 'Mountain range', 'Island group': 'Islands', 'Plateau': 'Plateau', 'Desert': 'Desert',
    'Pen/cape': 'Peninsula', 'Peninsula': 'Peninsula', 'Geoarea': 'Region', 'Coast': 'Coast', 'Plain': 'Plain',
    'Delta': 'Delta', 'Basin': 'Basin', 'Lowland': 'Lowland', 'Valley': 'Valley', 'Tundra': 'Tundra', 'Wetlands': 'Wetland',
    'Isthmus': 'Isthmus', 'Gorge': 'Gorge', 'Foothills': 'Foothills', 'Continent': 'Continent',
    'sea': 'Sea', 'gulf': 'Gulf', 'bay': 'Bay', 'strait': 'Strait', 'sound': 'Sound', 'channel': 'Channel',
    'lagoon': 'Lagoon', 'fjord': 'Fjord', 'ocean': 'Ocean', 'reef': 'Reef', 'inlet': 'Inlet', 'estuary': 'Estuary',
}
FILES = ['ne_10m_lakes', 'ne_10m_rivers_lake_centerlines', 'ne_10m_geography_regions_points',
         'ne_10m_geography_regions_elevation_points', 'ne_10m_geography_regions_polys', 'ne_10m_geography_marine_polys']

def prop(p, *keys):
    for k in keys:
        for v in (p.get(k), p.get(k.upper())):
            if v not in (None, ''): return v
    return None

def parts(g):
    """Each polygon ring or line of a geometry, as a list of [lon, lat]."""
    t, c = g['type'], g['coordinates']
    if t == 'Point': return [[c]]
    if t == 'LineString': return [c]
    if t == 'MultiLineString': return c
    if t == 'Polygon': return [c[0]]
    if t == 'MultiPolygon': return [p[0] for p in c]
    return []

def size(ring):
    """Rough size of a ring or line: its box's area, enough to pick the main piece."""
    xs = [p[0] for p in ring]; ys = [p[1] for p in ring]
    return (max(xs) - min(xs) + 1e-6) * (max(ys) - min(ys) + 1e-6)

def label_point(ring, is_line):
    if is_line: return ring[len(ring) // 2]                     # the middle point along a river
    a = cx = cy = 0.0                                            # the centre of area of a polygon ring
    for (x0, y0), (x1, y1) in zip(ring, ring[1:] + ring[:1]):
        f = x0 * y1 - x1 * y0; a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f
    if abs(a) < 1e-12: return ring[0]
    return [cx / (3 * a), cy / (3 * a)]

found = {}
for name in FILES:
    for f in json.loads((SRC / f'{name}.geojson').read_text(encoding='utf-8'))['features']:
        p, g = f['properties'], f['geometry']
        if not g: continue
        kind = KINDS.get(prop(p, 'featurecla'))
        label = prop(p, 'name_en', 'name')
        full = prop(p, 'name')                                   # "Lake Superior" over the short English "Superior"
        if full and label and str(label) in str(full) and len(str(full)) > len(str(label)) and str(full).isascii(): label = full
        if kind in ('Lake', 'Salt lake', 'Reservoir') and full and str(full).startswith('Lake ') and str(full).isascii(): label = full
        if not kind or not label: continue
        label = ' '.join(str(label).split())
        rank = prop(p, 'scalerank'); rank = int(float(rank)) if rank is not None else 9
        pieces = parts(g)
        if not pieces: continue
        is_point, is_line = g['type'] == 'Point', 'Line' in g['type']
        main = max(pieces, key=size)
        lon, lat = main[0] if is_point else label_point(main, is_line)
        xs = [q[0] for r in pieces for q in r]; ys = [q[1] for r in pieces for q in r]
        box = None if is_point else [min(xs), min(ys), max(xs), max(ys)]
        if kind == 'Mountain':
            h = prop(p, 'elevation')
            if h: kind = f'Mountain · {int(float(h)):,} m'
        key = (label.lower(), kind.split(' ·')[0])
        old = found.get(key)
        if old:                                                  # another piece of the same river, range or lake
            if box and old['box']:
                old['box'] = [min(old['box'][0], box[0]), min(old['box'][1], box[1]), max(old['box'][2], box[2]), max(old['box'][3], box[3])]
            if size(main) > old['size']: old.update(lat=lat, lon=lon, size=size(main))
            old['rank'] = min(old['rank'], rank)
            continue
        found[key] = {'name': label, 'kind': kind, 'lat': lat, 'lon': lon, 'rank': rank, 'box': box, 'size': size(main)}

rows = []
for v in sorted(found.values(), key=lambda v: (v['rank'], v['name'])):
    r = [v['name'], v['kind'], round(v['lat'], 3), round(v['lon'], 3), v['rank']]
    if v['box']: r += [round(x, 2) for x in v['box']]
    rows.append(r)
OUT.write_text(json.dumps(rows, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
kinds = {}
for r in rows: k = r[1].split(' ·')[0]; kinds[k] = kinds.get(k, 0) + 1
print(len(rows), 'features ·', ', '.join(f'{k} {n}' for k, n in sorted(kinds.items(), key=lambda x: -x[1])))
