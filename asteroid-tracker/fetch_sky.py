#!/usr/bin/env python3
# NASA and ESA Data Projects · Asteroid Tracker · sky positions for passes worth looking for · © 2026 Malcolm Syme ·
# mcsyme11@gmail.com
#
# Writes asteroid-tracker/data/sky.json, read by the "Visible from here" tab and by Sky Finder:
#   the asteroids passing within 0.2 au (78 Moon distances) of Earth from yesterday to 30 days ahead (NASA/JPL
#   close-approach data, CAD), kept when they could be bright enough for a large backyard telescope (estimated
#   magnitude at closest approach 16 or brighter), each with its position as seen from Earth's centre every hour or
#   few hours around the pass (NASA/JPL Horizons, geocentric vectors, ICRF / J2000 equator, km).
# The pages turn these into a direction in the sky from the visitor's own place (shared/sky.js), so no request about
# the visitor's location is ever sent anywhere.
#
# Brightness estimate used to choose (the pages compute the real value hour by hour):
#   V ≈ H + 5·log10(r·Δ) + 2.5,  r ≈ 1 au (near Earth), Δ = the closest distance (au); +2.5 for a typical phase.
#
# Run by hand:  python3 asteroid-tracker/fetch_sky.py   (standard library only)
import datetime as dt
import json
import math
import os
import sys
import time
import urllib.parse
import urllib.request

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
CAD = 'https://ssd-api.jpl.nasa.gov/cad.api'
HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
UA = {'User-Agent': 'NASA-and-ESA-Data-Projects/1.0 (asteroid tracker, sky positions)'}
DIST_MAX = 0.2           # au
MAG_LIMIT = 16.0         # estimated magnitude at closest approach
MAX_OBJECTS = 40
LD_AU = 384400 / 149597870.7


def get(url, params, tries=3):
    q = urllib.parse.urlencode(params, safe="'@%;=")
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + '?' + q, headers=UA), timeout=120) as r:
                return json.load(r)
        except Exception as e:
            if k == tries - 1:
                raise
            print('  retrying after: %s' % e)
            time.sleep(5 * (k + 1))


def jd_to_iso(jd):
    return (dt.datetime(2000, 1, 1, 12, tzinfo=dt.timezone.utc) + dt.timedelta(days=jd - 2451545.0)).strftime('%Y-%m-%d %H:%M')


def main():
    now = dt.datetime.now(dt.timezone.utc)
    jd_now = (now - dt.datetime(2000, 1, 1, 12, tzinfo=dt.timezone.utc)).total_seconds() / 86400 + 2451545.0
    cad = get(CAD, {'date-min': (now - dt.timedelta(days=1)).strftime('%Y-%m-%d'), 'date-max': (now + dt.timedelta(days=30)).strftime('%Y-%m-%d'),
                    'dist-max': str(DIST_MAX), 'fullname': 'true', 'diameter': 'true'})
    f = {k: i for i, k in enumerate(cad.get('fields', []))}
    rows = cad.get('data') or []
    picks = []
    for r in rows:
        try:
            H = float(r[f['h']]) if r[f['h']] not in (None, '') else None
        except ValueError:
            H = None
        dist = float(r[f['dist']])
        if H is None:
            continue
        est = H + 5 * math.log10(dist) + 2.5
        if est <= MAG_LIMIT:
            picks.append((est, r))
    picks.sort(key=lambda p: p[0])
    picks = picks[:MAX_OBJECTS]
    print('Close approaches within %.2f au, next 30 days: %d; bright enough to look for: %d' % (DIST_MAX, len(rows), len(picks)))

    # NeoWs id (= JPL SPK-ID) from the map's list, so the pages can link to each asteroid's own page
    spk = {}
    try:
        with open(os.path.join(DATA, 'neos.json')) as fh:
            neos = json.load(fh)
        for row in neos['rows']:
            spk[str(row[2])] = row[0]
    except (OSError, ValueError, KeyError):
        pass

    out = []
    for est, r in picks:
        des, ca = r[f['des']], float(r[f['jd']])
        dist = float(r[f['dist']])
        start, stop = max(jd_now - 1, ca - 6), min(jd_now + 31, ca + 6)
        step_h = 1 if dist < 0.02 else 3
        res = get(HORIZONS, {
            'format': 'json', 'COMMAND': "'DES=%s;'" % des if not des.isdigit() else "'%s;'" % des,
            'EPHEM_TYPE': 'VECTORS', 'CENTER': "'500@399'", 'REF_PLANE': 'FRAME', 'REF_SYSTEM': 'ICRF',
            'START_TIME': "'JD%.5f'" % start, 'STOP_TIME': "'JD%.5f'" % stop, 'STEP_SIZE': "'%d%%20h'" % step_h,
            'OUT_UNITS': 'KM-S', 'VEC_TABLE': '1', 'CSV_FORMAT': 'YES', 'OBJ_DATA': 'NO'})
        text = (res or {}).get('result', '')
        if '$$SOE' not in text:
            print('  %s: no vectors (%s)' % (des, ((res or {}).get('error') or text[:160]).strip()[:160]))
            continue
        xyz, t0 = [], None
        for line in text.split('$$SOE', 1)[1].split('$$EOE', 1)[0].strip().splitlines():
            p = [c.strip() for c in line.split(',')]
            if len(p) < 5:
                continue
            t0 = float(p[0]) if t0 is None else t0
            xyz += [round(float(p[2])), round(float(p[3])), round(float(p[4]))]
        diam = r[f['diameter']] if 'diameter' in f else None
        out.append({
            'des': des, 'name': (r[f['fullname']] or des).strip(), 'neows_id': spk.get(des), 'H': float(r[f['h']]),
            'diameter_km': float(diam) if diam not in (None, '') else None,
            'ca_jd': round(ca, 5), 'ca_utc': jd_to_iso(ca), 'ca_ld': round(dist / LD_AU, 2), 'ca_au': dist,
            'v_kms': float(r[f['v_rel']]), 'est_mag': round(est, 1),
            't0': t0, 'step': step_h / 24, 'xyz': xyz})
        print('  %s: %d positions, closest %s UTC, %.1f LD, estimated magnitude %.1f' % (des, len(xyz) // 3, jd_to_iso(ca), dist / LD_AU, est))
        time.sleep(1)
    out.sort(key=lambda o: o['ca_jd'])
    doc = {'source': 'NASA/JPL close-approach data (ssd-api.jpl.nasa.gov/cad.api) and Horizons (ssd.jpl.nasa.gov/api/horizons.api)',
           'frame': 'geocentric, ICRF (J2000 equator), km', 'updated': now.strftime('%Y-%m-%d %H:%M UTC'),
           'window_days': 30, 'dist_max_au': DIST_MAX, 'mag_limit': MAG_LIMIT, 'objects': out}
    with open(os.path.join(DATA, 'sky.json'), 'w') as fh:
        json.dump(doc, fh, separators=(',', ':'), allow_nan=False)
    print('sky.json: %d asteroids' % len(out))
    return 0


if __name__ == '__main__':
    sys.exit(main())
