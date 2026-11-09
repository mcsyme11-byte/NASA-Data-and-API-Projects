#!/usr/bin/env python3
# NASA Data Projects · Asteroid Tracker · data for the map and search · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Writes, in asteroid-tracker/data/:
#   neos.json        every near-Earth asteroid's orbit and size, from the NASA/JPL Small-Body Database (SBDB) Query
#                    API, one row each: [spkid, full name, designation, a, e, i, om, w, ma, epoch, H, diameter, pha,
#                    class, year found, year first seen]
#   preview.json     the potentially hazardous ones only, for the home page's live preview
#   spacecraft.json  positions of selected spacecraft around the Sun from NASA/JPL Horizons, every few days from
#                    launch (or 1977) to a year ahead
#   famous.json      for the map's famous close passes: precise positions and velocities of the asteroid, Earth and
#                    the Moon (Horizons, which includes Earth's pull), every 10 minutes within 12 hours of closest
#                    approach, hourly within 3 days, daily within 40 days. Refreshed when missing or a month old.
# The JPL APIs do not send CORS headers, so web pages cannot call them; GitHub Actions runs this script once a day
# (.github/workflows/asteroid-data.yml). No key is needed.
#
# Run by hand:  python3 asteroid-tracker/fetch_map_data.py   (standard library only)
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
SBDB = 'https://ssd-api.jpl.nasa.gov/sbdb_query.api'
HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
UA = {'User-Agent': 'NASA-Data-Projects/1.0 (asteroid tracker)'}
FIELDS = ['spkid', 'full_name', 'pdes', 'a', 'e', 'i', 'om', 'w', 'ma', 'epoch', 'H', 'diameter', 'pha', 'class', 'first_obs']

# Horizons ids checked Nov 8, 2026; short and longer descriptions are shown on the map
SPACECRAFT = [
    ('-31', 'Voyager 1', '1977-09-08', 30, 'farthest spacecraft, launched 1977',
     'Launched in 1977; the farthest human-made object, in interstellar space since 2012.'),
    ('-32', 'Voyager 2', '1977-08-23', 30, 'visited Uranus and Neptune',
     'Launched in 1977; the only spacecraft to visit Uranus and Neptune; in interstellar space since 2018.'),
    ('-98', 'New Horizons', '2006-01-20', 20, 'flew past Pluto in 2015',
     'Flew past Pluto in 2015 and the small world Arrokoth in 2019; now in the Kuiper belt.'),
    # Parker: every 6 hours (0.25 d). Near the Sun it covers about 16 million km a day while passing about 7 million km
    # from it, so daily samples would cut straight across its turn.
    ('-96', 'Parker Solar Probe', '2018-08-13', 0.25, 'closest ever to the Sun',
     'Flies closer to the Sun than any spacecraft before it, through the Sun\'s outer atmosphere.'),
    ('-49', 'Lucy', '2021-10-17', 4, 'touring Jupiter\'s Trojan asteroids',
     'On a twelve-year tour of the Trojan asteroids that share Jupiter\'s orbit.'),
    ('-255', 'Psyche', '2023-10-14', 4, 'heading for a metal asteroid',
     'On its way to the metal-rich asteroid 16 Psyche, arriving in 2029.'),
    ('-64', 'OSIRIS-APEX', '2016-09-09', 4, 'meets Apophis in 2029',
     'As OSIRIS-REx it brought samples of asteroid Bennu to Earth in 2023; now heading for Apophis, arriving in 2029.'),
    ('-91', 'Hera', '2024-10-08', 4, 'ESA mission to Didymos',
     'ESA\'s mission to the asteroid pair Didymos and Dimorphos, which NASA\'s DART probe struck in 2022.'),
    ('-170', 'James Webb Space Telescope', '2022-01-25', 4, '1.5 million km from Earth',
     'The James Webb Space Telescope, about 1.5 million km from Earth on the side away from the Sun.'),
    ('-159', 'Europa Clipper', '2024-10-15', 4, 'on its way to Jupiter\'s moon Europa',
     'On its way to Jupiter\'s moon Europa, arriving in 2030.'),
    ('-61', 'Juno', '2011-08-06', 4, 'orbiting Jupiter since 2016',
     'Launched in 2011 and orbiting Jupiter since 2016.'),
]

COMETS = {'JFc', 'JFC', 'HTC', 'ETc', 'CTc', 'COM', 'PAR', 'HYP'}   # comet orbit classes in the SBDB


def get(url, params, tries=3):
    q = urllib.parse.urlencode(params, safe="'@%")
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + '?' + q, headers=UA), timeout=180) as r:
                return json.load(r)
        except Exception as e:
            if k == tries - 1:
                raise
            print('  retrying after: %s' % e)
            time.sleep(5 * (k + 1))


def year_found(full_name, pdes, first_obs):
    """The year in the asteroid's provisional code (2004 MN4 → 2004; old style A898 PA → 1898), else the year it was
    first seen (survey codes such as 6344 P-L, and comets)."""
    m = re.search(r'\((\d{4}) [A-Z]{2}\d*\)', full_name) or re.match(r'^(\d{4}) [A-Z]{2}\d*$', str(pdes))
    if m:
        return int(m.group(1))
    m = re.search(r'\(A(\d{3}) [A-Z]', full_name)
    if m:
        return 1000 + int(m.group(1))
    return int(first_obs[:4]) if first_obs else None


def num(v, digits):
    return None if v in (None, '') else round(float(v), digits)


def neos():
    raw = get(SBDB, {'fields': ','.join(FIELDS), 'sb-group': 'neo', 'full-prec': 'true'})
    f = {k: raw['fields'].index(k) for k in FIELDS}
    rows = []
    for r in raw['data']:
        fo = r[f['first_obs']]
        rows.append([
            int(r[f['spkid']]), r[f['full_name']].strip(), r[f['pdes']],
            num(r[f['a']], 6), num(r[f['e']], 6), num(r[f['i']], 4), num(r[f['om']], 4), num(r[f['w']], 4),
            num(r[f['ma']], 4), num(r[f['epoch']], 1), num(r[f['H']], 2), num(r[f['diameter']], 3),
            r[f['pha']], r[f['class']],
            None if r[f['class']] in COMETS else year_found(r[f['full_name']], r[f['pdes']], fo), int(fo[:4]) if fo else None,
        ])
    rows = [r for r in rows if r[3] and r[3] > 0 and r[4] is not None and r[4] < 1]   # closed orbits only
    return rows, int(raw.get('count', len(rows)))


def spacecraft(today):
    out = []
    stop = (today + dt.timedelta(days=365)).isoformat()
    for hid, name, launch, step, short, note in SPACECRAFT:
        start = max(launch, '1977-09-01') if hid in ('-31', '-32') else launch
        start = (dt.date.fromisoformat(start) + dt.timedelta(days=2)).isoformat()
        rng = [start, stop]
        res = None
        for attempt in range(3):
            res = get(HORIZONS, {
                'format': 'json', 'COMMAND': "'%s'" % hid, 'EPHEM_TYPE': 'VECTORS', 'CENTER': "'500@10'",
                'START_TIME': "'%s'" % rng[0], 'STOP_TIME': "'%s'" % rng[1], 'STEP_SIZE': "'%d%%20h'" % round(step * 24) if step < 1 else "'%d%%20d'" % step,
                'OUT_UNITS': 'AU-D', 'REF_PLANE': 'ECLIPTIC', 'REF_SYSTEM': 'ICRF', 'VEC_TABLE': '1', 'CSV_FORMAT': 'YES',
                'OBJ_DATA': 'NO'})
            text = res.get('result', '') + res.get('error', '')
            if '$$SOE' in text:
                break
            # the trajectory file does not cover the whole range: Horizons names the dates it does cover
            m1 = re.search(r'(?:prior to|before)\s+A\.D\.\s+(\d{4}-[A-Z]{3}-\d{2})', text)
            m2 = re.search(r'after\s+A\.D\.\s+(\d{4}-[A-Z]{3}-\d{2})', text)
            fix = lambda s: dt.datetime.strptime(s.title(), '%Y-%b-%d').date()
            if m1:
                rng[0] = (fix(m1.group(1)) + dt.timedelta(days=1)).isoformat()
            if m2:
                rng[1] = (fix(m2.group(1)) - dt.timedelta(days=1)).isoformat()
            if not (m1 or m2):
                break
            time.sleep(1)
        text = res.get('result', '') if res else ''
        if '$$SOE' not in text:
            print('  %s: no positions (%s)' % (name, (res or {}).get('error', text[:200]).strip()[:200]))
            continue
        body = text.split('$$SOE', 1)[1].split('$$EOE', 1)[0].strip().splitlines()
        samples, jd0 = [], None
        for line in body:
            p = [c.strip() for c in line.split(',')]
            if len(p) < 5:
                continue
            if jd0 is None:
                jd0 = float(p[0])
            samples += [round(float(p[2]), 5), round(float(p[3]), 5), round(float(p[4]), 5)]
        out.append({'id': hid, 'name': name, 'short': short, 'note': note, 'samples': [jd0, step] + samples})
        print('  %s: %d positions from %s' % (name, len(samples) // 3, rng[0]))
        time.sleep(1)
    return out


# the famous passes: id, Horizons command, time of closest approach (UTC, from the NASA/JPL close-approach data)
FAMOUS = [
    ('apophis-2029', '99942;', '2029-04-13 21:46'),
    ('duende-2013', '367943;', '2013-02-15 19:26'),
    ('2020qg-2020', 'DES=2020 QG;', '2020-08-16 04:09'),
    ('2019ok-2019', 'DES=2019 OK;', '2019-07-25 01:22'),
    ('2024yr4-2032', 'DES=2024 YR4;', '2032-12-22 08:22'),
]


def vectors(cmd, start, stop, step):
    """Heliocentric ecliptic J2000 positions (au) and velocities (au/day): rows [jd, x, y, z, vx, vy, vz]."""
    res = get(HORIZONS, {
        'format': 'json', 'COMMAND': "'%s'" % urllib.parse.quote(cmd), 'EPHEM_TYPE': 'VECTORS', 'CENTER': "'500@10'",
        'START_TIME': "'%s'" % urllib.parse.quote(start.strftime('%Y-%m-%d %H:%M')),
        'STOP_TIME': "'%s'" % urllib.parse.quote(stop.strftime('%Y-%m-%d %H:%M')),
        'STEP_SIZE': "'%s'" % urllib.parse.quote(step), 'OUT_UNITS': 'AU-D', 'REF_PLANE': 'ECLIPTIC', 'REF_SYSTEM': 'ICRF',
        'VEC_TABLE': '2', 'CSV_FORMAT': 'YES', 'OBJ_DATA': 'NO'})
    text = res.get('result', '')
    if '$$SOE' not in text:
        raise RuntimeError((res.get('error') or text[:200]).strip())
    rows = []
    for line in text.split('$$SOE', 1)[1].split('$$EOE', 1)[0].strip().splitlines():
        p = [c.strip() for c in line.split(',')]
        if len(p) >= 8:
            rows.append([round(float(p[0]), 6)] + [round(float(v), 10) for v in p[2:8]])
    return rows


def famous():
    out = []
    for pid, cmd, when in FAMOUS:
        t = dt.datetime.strptime(when, '%Y-%m-%d %H:%M')
        bodies = {}
        for name, c in (('asteroid', cmd), ('earth', '399'), ('moon', '301')):
            rows = {}
            for span, step in ((dt.timedelta(hours=12), '10 m'), (dt.timedelta(days=3), '1 h'), (dt.timedelta(days=40), '1 d')):
                for r in vectors(c, t - span, t + span, step):
                    rows[r[0]] = r
                time.sleep(0.5)
            bodies[name] = [rows[k] for k in sorted(rows)]
        out.append({'id': pid, 'closest': when, **bodies})
        print('  %s: %d asteroid positions' % (pid, len(bodies['asteroid'])))
    return out


def write_if_changed(name, obj, keys):
    path = os.path.join(DATA, name)
    try:
        with open(path, encoding='utf-8') as fh:
            old = json.load(fh)
        if all(old.get(k) == json.loads(json.dumps(obj[k])) for k in keys):
            print('%s: no change' % name)
            return
    except (OSError, ValueError):
        pass
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(obj, fh, separators=(',', ':'))
        fh.write('\n')
    print('%s: written' % name)


def main():
    now = dt.datetime.now(dt.timezone.utc)
    stamp = now.strftime('%Y-%m-%dT%H:%MZ')
    os.makedirs(DATA, exist_ok=True)
    failed = 0
    fields = ['spkid', 'name', 'designation', 'a', 'e', 'i', 'om', 'w', 'ma', 'epoch', 'H', 'diameter', 'pha', 'class',
              'year_found', 'year_first_seen']
    try:
        rows, count = neos()
        print('neos: %d near-Earth asteroids' % len(rows))
        src = 'NASA/JPL SBDB Query API (ssd-api.jpl.nasa.gov/sbdb_query.api), sb-group=neo'
        write_if_changed('neos.json', {'source': src, 'updated': stamp, 'count': count, 'fields': fields, 'rows': rows}, ['rows'])
        pha = [r for r in rows if r[12] == 'Y']
        write_if_changed('preview.json', {'source': src, 'updated': stamp, 'total': len(pha), 'fields': fields, 'rows': pha}, ['rows'])
    except Exception as e:
        failed += 1
        print('neos: could not reach the SBDB Query API (%s)' % e)
    try:
        craft = spacecraft(now.date())
        if craft:
            write_if_changed('spacecraft.json', {'source': 'NASA/JPL Horizons API (ssd.jpl.nasa.gov/api/horizons.api), '
                                                 'heliocentric ecliptic J2000, au', 'updated': stamp, 'craft': craft}, ['craft'])
    except Exception as e:
        failed += 1
        print('spacecraft: could not reach the Horizons API (%s)' % e)
    # famous passes: past ones do not change and future predictions change rarely, so monthly is enough
    path = os.path.join(DATA, 'famous.json')
    try:
        old = json.load(open(path, encoding='utf-8')) if os.path.exists(path) else {}
    except (OSError, ValueError):
        old = {}
    stale = '--all' in sys.argv or old.get('updated', '')[:10] < (now - dt.timedelta(days=30)).strftime('%Y-%m-%d')
    if stale:
        try:
            passes = famous()
            write_if_changed('famous.json', {'source': 'NASA/JPL Horizons API: heliocentric ecliptic J2000; rows [jd, x, y, z (au), '
                                             'vx, vy, vz (au/day)]', 'updated': stamp, 'passes': passes}, ['passes'])
        except Exception as e:
            print('famous passes: could not reach the Horizons API (%s)' % e)
    return 1 if failed == 2 else 0


if __name__ == '__main__':
    sys.exit(main())
