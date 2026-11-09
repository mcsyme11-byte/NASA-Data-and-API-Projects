#!/usr/bin/env python3
# NASA Data Projects · Image Explorer · astronaut photos of Earth for the globe · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: the Gateway to Astronaut Photography of Earth (eol.jsc.nasa.gov), Earth Science and Remote Sensing Unit,
# NASA Johnson Space Center, through its Photos Database API:
#   https://eol.jsc.nasa.gov/SearchPhotos/PhotosDatabaseAPI/PhotosDatabaseAPI.pl?query=…&return=…&key=…
# The API needs a free key (requested by email from jsc-earthweb@mail.nasa.gov). The key is never committed: GitHub
# Actions passes it from the repository secret EOL_API_KEY. Without a key the script changes nothing.
# Web pages cannot call the API (no CORS headers), so GitHub Actions runs this once a day
# (.github/workflows/astronaut-photos.yml) and commits image-explorer/data/astronaut.json when it has changed.
#
# Keeps cataloged photos (those with a photo centre point and a place name, from the "frames" table) taken in the last
# 90 days, or the last year if fewer than 60, with half the sky or less in cloud: the newest 400.
#   python3 image-explorer/fetch_astronaut_photos.py            (reads EOL_API_KEY from the environment)

import json, os, sys, urllib.parse, urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = 'https://eol.jsc.nasa.gov/SearchPhotos/PhotosDatabaseAPI/PhotosDatabaseAPI.pl'
OUT = Path(__file__).resolve().parent / 'data' / 'astronaut.json'
FIELDS = ['frames|mission', 'frames|roll', 'frames|frame', 'frames|pdate', 'frames|ptime', 'frames|lat', 'frames|lon',
          'frames|geon', 'frames|feat', 'frames|cldp', 'frames|tilt', 'images|directory', 'images|filename', 'images|width']
KEEP, MAX_CLOUD = 400, 50

def query(key, since):
    params = {'query': f'frames|pdate|ge|{since}', 'return': '|'.join(FIELDS), 'key': key}
    url = API + '?' + urllib.parse.urlencode(params, safe='|')
    req = urllib.request.Request(url, headers={'User-Agent': 'NASA-Data-Projects/1.0 (github.com/mcsyme11-byte/NASA-Data-and-API-Projects)'})
    with urllib.request.urlopen(req, timeout=120) as r:
        rows = json.loads(r.read().decode('utf-8'))
    if not isinstance(rows, list):
        raise SystemExit(f'Unexpected answer from the API: {str(rows)[:300]}')
    return rows

def group(rows):
    """One entry per photo (mission-roll-frame), with its small and large image files."""
    photos = {}
    for r in rows:
        g = lambda f: r.get('frames.' + f) if 'frames.' + f in r else r.get('images.' + f)
        pid = f"{g('mission')}-{g('roll')}-{g('frame')}"
        p = photos.setdefault(pid, {'row': r, 'small': None, 'large': None})
        d, f = r.get('images.directory') or '', r.get('images.filename') or ''
        if '/small/' in f'/{d}/' and not p['small']: p['small'] = f'{d}/{f}'
        elif '/large/' in f'/{d}/' and not p['large']: p['large'] = f'{d}/{f}'
    out = []
    for pid, p in photos.items():
        r = p['row']
        try: lat, lon, cloud = float(r['frames.lat']), float(r['frames.lon']), float(r.get('frames.cldp') or 0)
        except (KeyError, TypeError, ValueError): continue
        if (lat == 0 and lon == 0) or cloud > MAX_CLOUD or not (p['small'] or p['large']): continue
        d, t = str(r.get('frames.pdate') or ''), str(r.get('frames.ptime') or '').zfill(6)
        out.append([pid, f'{d[:4]}-{d[4:6]}-{d[6:8]}', f'{t[:2]}:{t[2:4]}', round(lat, 1), round(lon, 1),
                    (r.get('frames.geon') or '').strip().title(), (r.get('frames.feat') or '').strip(), int(cloud),
                    p['small'] or p['large'], p['large'] or p['small']])
    out.sort(key=lambda x: (x[1], x[2]), reverse=True)
    return out

def main():
    key = os.environ.get('EOL_API_KEY', '').strip()
    if not key:
        print('No EOL_API_KEY: astronaut photos not fetched; data/astronaut.json left as it is.')
        return
    today = datetime.now(timezone.utc).date()
    photos = []
    for days in (90, 365):
        photos = group(query(key, (today - timedelta(days=days)).strftime('%Y%m%d')))
        if len(photos) >= 60: break
    try:                                                  # nothing new: leave the file (and the repository) alone
        if json.loads(OUT.read_text(encoding='utf-8')).get('photos') == json.loads(json.dumps(photos[:KEEP])):
            print('No change in the photos.'); return
    except (OSError, ValueError): pass
    data = {'updated': today.isoformat(),
            'source': 'Image courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center (eol.jsc.nasa.gov)',
            'fields': ['id', 'date (UTC)', 'time (UTC)', 'lat', 'lon', 'place', 'features', 'cloud %', 'small image', 'large image'],
            'photos': photos[:KEEP]}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(photos[:KEEP])} photos written ({len(photos)} found).')

if __name__ == '__main__':
    main()
