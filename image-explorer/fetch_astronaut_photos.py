#!/usr/bin/env python3
# NASA and ESA Data Projects · Image Explorer · astronaut photos of Earth for the globe · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Source: the Gateway to Astronaut Photography of Earth (eol.jsc.nasa.gov), Earth Science and Remote Sensing Unit,
# NASA Johnson Space Center, through its Photos Database API:
#   https://eol.jsc.nasa.gov/SearchPhotos/PhotosDatabaseAPI/PhotosDatabaseAPI.pl?query=…&return=…&key=…
# The API needs a free key (requested by email from jsc-earthweb@mail.nasa.gov). The key is never committed: GitHub
# Actions passes it from the repository secret EOL_API_KEY.
# Without a key (decided Nov 11, 2026), the script reads the site's public "Latest ISS Imagery" set instead: its
# tab-separated download lists the newest 1,000 Space Station photos with the date, time and the point below the
# Station (nadir) and, once cataloged, the photo's centre point, place and features:
#   https://eol.jsc.nasa.gov/SearchPhotos/PhotoIdSets/PhotoIdSets.pl?set=Latest_ISS_Imagery&view=1   (sets a cookie)
#   https://eol.jsc.nasa.gov/SearchPhotos/GetTSVFromQueryResults.pl?results=Latest_ISS_Imagery
# Photos without a centre point are placed below the Station and marked so ("below" rather than "centre"); a run of
# photos of one place is kept once (one a day for each 1° square).
# Web pages cannot call the API (no CORS headers), so GitHub Actions runs this once a day
# (.github/workflows/astronaut-photos.yml) and commits image-explorer/data/astronaut.json when it has changed.
#
# Keeps cataloged photos (those with a photo centre point and a place name, from the "frames" table) taken in the last
# 90 days, or the last year if fewer than 60, with half the sky or less in cloud: the newest 400.
#   python3 image-explorer/fetch_astronaut_photos.py            (reads EOL_API_KEY from the environment)

import csv, http.cookiejar, io, json, os, re, sys, urllib.parse, urllib.request
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
    req = urllib.request.Request(url, headers={'User-Agent': 'NASA-Data-Projects/1.0 (github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects)'})
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
                    p['small'] or p['large'], p['large'] or p['small'], 'centre'])
    out.sort(key=lambda x: (x[1], x[2]), reverse=True)
    return out

UA = {'User-Agent': 'NASA-Data-Projects/1.0 (github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects)'}
SITE = 'https://eol.jsc.nasa.gov/'

def latest_set():
    """The public Latest ISS Imagery set, without a key."""
    op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
    def get(u, wait=300, tries=3):                        # the site can be slow: up to 5 minutes, three tries
        for n in range(tries):
            try: return op.open(urllib.request.Request(u, headers=UA), timeout=wait).read()
            except OSError:
                if n == tries - 1: raise
    get(SITE + 'SearchPhotos/PhotoIdSets/PhotoIdSets.pl?set=Latest_ISS_Imagery&view=1')
    tsv = get(SITE + 'SearchPhotos/GetTSVFromQueryResults.pl?results=Latest_ISS_Imagery').decode('iso-8859-1')
    try: listing = get(SITE + 'temp/Latest_ISS_Imagery.json', 120, 1).decode('utf-8', 'replace')    # the image files, where listed
    except OSError: listing = ''
    rows = list(csv.DictReader(io.StringIO(tsv), delimiter='\t'))
    if not rows or 'Nadir Lat' not in rows[0]: raise SystemExit(f'Unexpected listing: {tsv[:300]}')
    out, seen = [], set()
    for r in rows:
        mission, roll, frame = (r.get('mission') or '').strip(), (r.get('roll') or '').strip(), (r.get('frame') or '').strip()
        pid = f'{mission}-{roll}-{frame}'
        num = lambda k: float(r[k]) if (r.get(k) or '').strip() not in ('', None) else None
        clat, clon, nlat, nlon = num('Center Point Lat'), num('Center Point Lon'), num('Nadir Lat'), num('Nadir Lon')
        centre = clat is not None and clon is not None and not (clat == 0 and clon == 0)
        lat, lon = (clat, clon) if centre else (nlat, nlon)
        if lat is None or lon is None or not mission: continue
        d, t = (r.get('Photo Date') or '').strip(), (r.get('Photo Time GMT') or '').strip().zfill(6)
        cloud = num('Clouds Percentage')
        if cloud is not None and cloud > MAX_CLOUD: continue
        key = (d, round(lat), round(lon))
        if key in seen: continue
        seen.add(key)
        files = sorted(set(m for m in re.findall(r'[\w./-]*' + re.escape(pid) + r'[\w.]*', listing) if '/' in m))
        pick = lambda word: next((f.split('DatabaseImages/')[-1].lstrip('/') for f in files if f'/{word}/' in f), None)
        small = pick('small') or f'ESC/small/{mission}/{pid}.JPG'
        large = pick('large') or f'ESC/large/{mission}/{pid}.JPG'
        out.append([pid, f'{d[:4]}-{d[4:6]}-{d[6:8]}', f'{t[:2]}:{t[2:4]}', round(lat, 1), round(lon, 1),
                    (r.get('geon') or '').strip().title(), (r.get('feat') or '').strip(), int(cloud or 0), small, large,
                    'centre' if centre else 'below'])
    out.sort(key=lambda x: (x[1], x[2]), reverse=True)
    return out

def main():
    key = os.environ.get('EOL_API_KEY', '').strip()
    today = datetime.now(timezone.utc).date()
    photos = []
    if not key:
        print('No EOL_API_KEY: reading the public Latest ISS Imagery set.')
        photos = latest_set()
    else:
        for days in (90, 365):
            photos = group(query(key, (today - timedelta(days=days)).strftime('%Y%m%d')))
            if len(photos) >= 60: break
    try:                                                  # nothing new: leave the file (and the repository) alone
        if json.loads(OUT.read_text(encoding='utf-8')).get('photos') == json.loads(json.dumps(photos[:KEEP])):
            print('No change in the photos.'); return
    except (OSError, ValueError): pass
    data = {'updated': today.isoformat(),
            'source': 'Image courtesy of the Earth Science and Remote Sensing Unit, NASA Johnson Space Center (eol.jsc.nasa.gov)',
            'fields': ['id', 'date (UTC)', 'time (UTC)', 'lat', 'lon', 'place', 'features', 'cloud %', 'small image', 'large image',
                       'position: centre of the photo, or below the Station'],
            'photos': photos[:KEEP]}
    OUT.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(photos[:KEEP])} photos written ({len(photos)} found).')

if __name__ == '__main__':
    main()
