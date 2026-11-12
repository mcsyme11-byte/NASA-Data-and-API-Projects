#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · builds the Earth map's lines, names and country outlines
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: Natural Earth 1:50m (public domain), the GeoJSON copies at
# https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
#   python3 image-explorer/tools/build_shapes.py [folder with the .geojson files]
# (files missing from the folder are downloaded). Writes:
#   data/shapes.json   coastlines, land borders, rivers: lists of lines [[lon, lat], …], 0.01° (about 1 km)
#   data/countries.json  each country: [ISO code, name, [west, south, east, north], rings], for "which country is
#                        this spot in" when the map is tapped (simplified to about 2 km)
#   data/labels.json   names drawn on the map: [name, kind, lon, lat, rank] for countries (rank 0–5) and cities (rank 1–8)

import json, math, sys, urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/tmp/natural-earth')
URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
FILES = ['ne_50m_coastline', 'ne_50m_admin_0_boundary_lines_land', 'ne_50m_rivers_lake_centerlines',
         'ne_50m_admin_0_countries', 'ne_10m_populated_places_simple']

def load(name):
    p = SRC / f'{name}.geojson'
    if not p.exists():
        SRC.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(URL + p.name, p)
    return json.loads(p.read_text(encoding='utf-8'))['features']

def rdp(pts, eps):
    """Douglas–Peucker simplification; eps in degrees"""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True; stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop(); (x1, y1), (x2, y2) = pts[a], pts[b]; dx, dy = x2 - x1, y2 - y1; n = math.hypot(dx, dy)
        far, fi = -1, -1
        for i in range(a + 1, b):
            # distance to the line from a to b; for a closed ring (a = b), distance to that point
            d = abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / n if n > 1e-9 else math.hypot(pts[i][0] - x1, pts[i][1] - y1)
            if d > far: far, fi = d, i
        if far > eps: keep[fi] = True; stack += [(a, fi), (fi, b)]
    return [p for p, k in zip(pts, keep) if k]

def line(coords, eps, nd=2):
    out = [[round(x, nd), round(y, nd)] for x, y in rdp(coords, eps)]
    dedup = [out[0]] + [p for i, p in enumerate(out[1:]) if p != out[i]]
    return dedup if len(dedup) > 1 else None

def lines(features, eps, keep=lambda f: True):
    out = []
    for f in features:
        if not keep(f): continue
        g = f['geometry']; parts = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates']
        for part in parts:
            l = line(part, eps)
            if l: out.append(l)
    return out

shapes = {
    'coast': lines(load('ne_50m_coastline'), 0.01),
    'borders': lines(load('ne_50m_admin_0_boundary_lines_land'), 0.01),
    'rivers': lines(load('ne_50m_rivers_lake_centerlines'), 0.01, lambda f: (f['properties'].get('featurecla') or '').startswith('River')),
}
(ROOT / 'data' / 'shapes.json').write_text(json.dumps(shapes, separators=(',', ':')), encoding='utf-8')

countries, labels = [], []
for f in load('ne_50m_admin_0_countries'):
    p, g = f['properties'], f['geometry']
    iso = p.get('ISO_A2_EH') if p.get('ISO_A2_EH') not in (None, '-99') else p.get('ISO_A2')
    if iso in (None, '-99'): iso = ''
    name = p.get('NAME_EN') or p.get('NAME')
    polys = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
    rings = [r for poly in polys for r in [line(poly[0], 0.02)] if r and len(r) > 3]    # outer rings; lakes inside count as the country
    if not rings: continue
    xs = [x for r in rings for x, _ in r]; ys = [y for r in rings for _, y in r]
    countries.append([iso, name, [min(xs), min(ys), max(xs), max(ys)], rings])
    labels.append([name, 'country', round(p.get('LABEL_X', 0), 2), round(p.get('LABEL_Y', 0), 2), min(5, int(p.get('MIN_LABEL', 3)) - 1)])
(ROOT / 'data' / 'countries.json').write_text(json.dumps(countries, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

for f in load('ne_10m_populated_places_simple'):
    p = f['properties']
    if p['scalerank'] > 7: continue
    lon, lat = f['geometry']['coordinates']
    labels.append([p['name'], 'capital' if p.get('adm0cap') else 'city', round(lon, 2), round(lat, 2), max(1, p['scalerank'] + 1)])
(ROOT / 'data' / 'labels.json').write_text(json.dumps(labels, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')

for n in ('shapes.json', 'countries.json', 'labels.json'):
    print(n, f"{(ROOT / 'data' / n).stat().st_size / 1e3:.0f} kB")
print({k: len(v) for k, v in shapes.items()}, 'countries', len(countries), 'labels', len(labels))
