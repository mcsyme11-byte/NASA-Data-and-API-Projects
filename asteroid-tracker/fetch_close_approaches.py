#!/usr/bin/env python3
# NASA and ESA Data Projects · Asteroid Tracker · daily close-approach data · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Fetches every close approach to Earth within 10 lunar distances (LD), one calendar year (UTC) at a time, from the
# NASA/JPL SBDB Close-Approach Data API, and writes asteroid-tracker/data/YYYY.json for each year plus
# asteroid-tracker/data/years.json (the list of years with their counts), which the page's year view reads.
#
# Years covered: FIRST_YEAR to next year. Each daily run refreshes this year and next year, and fetches any year
# whose file is missing; past years change rarely (an old approach is occasionally found in archive images), so
# "--all" refreshes every year (run by hand, or from Actions › Asteroid data › Run workflow with "all").
#
# Why a file and not a live request: the JPL API does not send CORS headers, so browsers block a web page from
# calling it directly (checked Nov 8, 2026). GitHub Actions runs this script once a day
# (.github/workflows/asteroid-data.yml); no key is needed.
#
# Run by hand:  python3 asteroid-tracker/fetch_close_approaches.py [--all]   (standard library only)
import datetime as dt
import json
import os
import sys
import time
import urllib.parse
import urllib.request

API = 'https://ssd-api.jpl.nasa.gov/cad.api'
AU_KM = 149597870.7
LD_KM = 384400.0
MAX_LD = 10
DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
FIRST_YEAR = 2000
LEVELS = (1, 5, 10)   # the distance choices on the page, in LD


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
    """JPL rows (arrays of strings) -> compact rows:
    [name, time (ms, UTC), distance (LD), H, diameter (km) or null, designation]."""
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
        rows.append([name, int(t.timestamp() * 1000), round(ld, 4), h, d, r[i['des']]])
    return rows


def year_file(year):
    return os.path.join(DATA, '%d.json' % year)


def load(path):
    try:
        with open(path, encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return None


def write(path, obj):
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, separators=(',', ':'))
        fh.write('\n')


def update_year(year, now):
    """Fetch one year; write its file only if the rows changed. Returns True if written."""
    rows = convert(fetch(year))
    old = load(year_file(year))
    if old and old.get('rows') == json.loads(json.dumps(rows)):
        return False
    write(year_file(year), {
        'source': 'NASA/JPL SBDB Close-Approach Data API (ssd-api.jpl.nasa.gov/cad.api)',
        'year': year, 'max_ld': MAX_LD, 'updated': now,
        'fields': ['name', 'time_ms_utc', 'distance_ld', 'h', 'diameter_km', 'designation'],
        'rows': rows,
    })
    return True


def write_index(years_range):
    years = []
    for y in years_range:
        d = load(year_file(y))
        if d is None:
            continue
        years.append({'year': y, 'updated': d['updated'],
                      'counts': {str(l): sum(1 for r in d['rows'] if r[2] <= l) for l in LEVELS}})
    index = {'source': 'NASA/JPL SBDB Close-Approach Data API', 'max_ld': MAX_LD, 'years': years}
    old = load(os.path.join(DATA, 'years.json'))
    if old != json.loads(json.dumps(index)):
        write(os.path.join(DATA, 'years.json'), index)


def main():
    now_dt = dt.datetime.now(dt.timezone.utc)
    now = now_dt.strftime('%Y-%m-%dT%H:%MZ')
    this = now_dt.year
    every = range(FIRST_YEAR, this + 2)
    todo = [y for y in every if '--all' in sys.argv or y >= this or not os.path.exists(year_file(y))]
    os.makedirs(DATA, exist_ok=True)
    failed = 0
    for y in todo:
        try:
            changed = update_year(y, now)
            print('%d: %s' % (y, 'updated' if changed else 'no change'))
        except Exception as e:  # keep the old file; report and carry on with the other years
            failed += 1
            print('%d: could not reach the JPL close-approach API (%s)' % (y, e))
        time.sleep(0.5)  # be gentle with the API
    old = os.path.join(DATA, 'close-approaches.json')  # the version-1 file, replaced by YYYY.json
    if os.path.exists(old):
        os.remove(old)
    write_index(every)
    return 1 if todo and failed == len(todo) else 0   # one failed year does not block saving the others


if __name__ == '__main__':
    sys.exit(main())
