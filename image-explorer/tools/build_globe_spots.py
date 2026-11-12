#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · builds the globe's places on Earth
# © 2026 Malcolm Syme · mcsyme11@gmail.com
#
#   python3 image-explorer/tools/build_globe_spots.py
# Reads data/features-more.json (GeoNames, built by build_geonames_features.py) and writes data/globe-spots.json:
#   [name, kind, lat, lon, detail]  kind: volcano | wonder | launch
# Volcanoes: GeoNames volcanoes with an English Wikipedia article. Natural wonders: national parks, nature reserves,
# waterfalls, glaciers, gorges, canyons, caves, craters and reefs among the best-known places (importance 5–7; atolls
# left out, about 120 small islands). Launch sites: the world's spaceports, positions from their public descriptions
# (to about 1 km).

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WONDER = {'Park', 'Nature reserve', 'Waterfall', 'Glacier', 'Canyon', 'Gorge', 'Cave', 'Crater', 'Reef', 'Ice cap', 'Delta'}
LAUNCH = [   # name, latitude, longitude, operator / country
    ('Kennedy Space Center', 28.608, -80.604, 'NASA · United States'),
    ('Cape Canaveral Space Force Station', 28.562, -80.577, 'United States'),
    ('Vandenberg Space Force Base', 34.742, -120.572, 'United States'),
    ('Wallops Flight Facility', 37.940, -75.466, 'NASA · United States'),
    ('Starbase', 25.997, -97.157, 'SpaceX · United States'),
    ('Rocket Lab Launch Complex 1', -39.262, 177.865, 'Rocket Lab · New Zealand'),
    ('Guiana Space Centre', 5.239, -52.768, 'ESA, CNES and Arianespace · French Guiana'),
    ('Baikonur Cosmodrome', 45.965, 63.305, 'Russia · Kazakhstan'),
    ('Plesetsk Cosmodrome', 62.925, 40.577, 'Russia'),
    ('Vostochny Cosmodrome', 51.884, 128.333, 'Russia'),
    ('Jiuquan Satellite Launch Center', 40.958, 100.291, 'China'),
    ('Xichang Satellite Launch Center', 28.246, 102.027, 'China'),
    ('Taiyuan Satellite Launch Center', 38.849, 111.608, 'China'),
    ('Wenchang Space Launch Site', 19.614, 110.951, 'China'),
    ('Satish Dhawan Space Centre', 13.720, 80.230, 'ISRO · India'),
    ('Tanegashima Space Center', 30.400, 130.970, 'JAXA · Japan'),
    ('Uchinoura Space Center', 31.251, 131.079, 'JAXA · Japan'),
    ('Naro Space Center', 34.432, 127.535, 'South Korea'),
    ('Palmachim Airbase', 31.884, 34.680, 'Israel'),
    ('Semnan Space Center', 35.234, 53.921, 'Iran'),
    ('Sohae Satellite Launching Station', 39.660, 124.705, 'North Korea'),
    ('Alcântara Launch Center', -2.373, -44.396, 'Brazil'),
    ('Andøya Spaceport', 69.294, 16.020, 'Norway'),
    ('Esrange Space Center', 67.893, 21.107, 'Sweden'),
]

spots = []
for name, kind, lat, lon, rank, cc in json.loads((ROOT / 'data' / 'features-more.json').read_text(encoding='utf-8')):
    base = kind.split(' · ')[0]
    if base == 'Volcano': spots.append([name, 'volcano', lat, lon, kind.replace('Volcano · ', '') if ' · ' in kind else ''])
    elif base in WONDER and rank <= 7: spots.append([name, 'wonder', lat, lon, base])
spots += [[n, 'launch', la, lo, op] for n, la, lo, op in LAUNCH]
(ROOT / 'data' / 'globe-spots.json').write_text(json.dumps(spots, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
from collections import Counter
print(len(spots), Counter(s[1] for s in spots))
