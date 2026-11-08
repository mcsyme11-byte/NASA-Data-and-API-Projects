#!/usr/bin/env python3
# NASA Data Projects · Asteroid Tracker · daily close-approach data · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Fetches every close approach to Earth within 10 lunar distances (LD) for the current calendar year (UTC) from the
# NASA/JPL SBDB Close-Approach Data API and writes asteroid-tracker/data/close-approaches.json, which the page's
# "This year" view reads.
#
# Why a file and not a live request: the JPL API does not send CORS headers, so browsers block a web page from
# calling it directly (checked Nov 8, 2026). GitHub Actions runs this script once a day
# (.github/workflows/asteroid-data.yml); no key is needed.
#
# Run by hand:  python3 asteroid-tracker/fetch_close_approaches.py   (standard library only)
import datetime as dt
import json
import os
import sys
import urllib.parse
import urllib.request

API = 'https://ssd-api.jpl.nasa.gov/cad.api'
AU_KM = 149597870.7
LD_KM = 384400.0
MAX_LD = 10
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'close-approaches.json')


def fetch(year):
    params = {
        'date-min': '%d-01-01' % year,
        'date-max': '%d-12-31T23:59:59' % year,
        'dist-max': '%dLD' % MAX_LD,
        'diameter': 'true',
        'fullname': 'true',
        'sort': 'date',
    }
    url = API + '?' + urllib.parse.urlencode(params)
    req = urllib.request.Request(url, headers={'User-Agent': 'NASA-Data-Projects/1.0 (asteroid tracker)'})
    with urllib.request.urlopen(req, timeout=60) as res:
        return json.load(res)


def convert(raw):
    """JPL rows (arrays of strings) -> compact rows: [name, time (ms, UTC), distance (LD), H, diameter (km) or null]."""
    if raw.get('signature', {}).get('version') != '1.5':
        print('Note: JPL API version is %s, not 1.5; check the field list.' % raw.get('signature', {}).get('version'))
    f = raw['fields']
    i = {k: f.index(k) for k in ('des', 'cd', 'dist', 'h', 'diameter', 'fullname')}
    rows = []
    for r in raw.get('data', []):
        # close-approach time is in TDB, about 69 s from UTC; a difference that does not show at minute precision
        t = dt.datetime.strptime(r[i['cd']], '%Y-%b-%d %H:%M').replace(tzinfo=dt.timezone.utc)
        name = (r[i['fullname']] or r[i['des']]).strip()
        h = float(r[i['h']]) if r[i['h']] not in (None, '') else None
        d = float(r[i['diameter']]) if r[i['diameter']] not in (None, '') else None
        ld = float(r[i['dist']]) * AU_KM / LD_KM
        rows.append([name, int(t.timestamp() * 1000), round(ld, 4), h, d])
    return rows


def main():
    year = dt.datetime.now(dt.timezone.utc).year
    try:
        raw = fetch(year)
    except Exception as e:  # network or service trouble: keep yesterday's file, fail the run so it shows on GitHub
        print('Could not reach the JPL close-approach API: %s' % e)
        return 1
    rows = convert(raw)
    out = {
        'source': 'NASA/JPL SBDB Close-Approach Data API (ssd-api.jpl.nasa.gov/cad.api)',
        'year': year,
        'max_ld': MAX_LD,
        'updated': dt.datetime.now(dt.timezone.utc).strftime('%Y-%m-%dT%H:%MZ'),
        'fields': ['name', 'time_ms_utc', 'distance_ld', 'h', 'diameter_km'],
        'rows': rows,
    }
    try:  # unchanged data: leave the file alone, so no commit is made
        with open(OUT, encoding='utf-8') as fh:
            if json.load(fh).get('rows') == json.loads(json.dumps(rows)):
                print('No change: %d close approaches for %d' % (len(rows), year))
                return 0
    except (OSError, ValueError):
        pass
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as fh:
        json.dump(out, fh, separators=(',', ':'))
        fh.write('\n')
    print('Wrote %d close approaches for %d to %s' % (len(rows), year, os.path.relpath(OUT)))
    return 0


if __name__ == '__main__':
    sys.exit(main())
