#!/usr/bin/env python3
# NASA and ESA Data Projects · Spacecraft map data · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Reads spacecraft/catalogue.json and writes, into spacecraft/data/:
#   positions.json  positions from NASA/JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api), each relative to its "parent":
#                     Sun    deep-space craft: every few days (Parker Solar Probe every 6 hours), back to launch or a
#                            few years, and a year ahead
#                     Earth  craft near the Lagrange points L1 and L2: every 6 hours, 60 days back and 120 ahead
#                     Moon, Mars  orbiters and rovers: every 5 minutes (rovers 30), half a day back and 1.5 days ahead
#                   ecliptic J2000 frame (Horizons REF_PLANE=ECLIPTIC, ICRF), whole kilometres.
#   tle.json        the latest orbital elements (two-line element sets) of the craft in Earth orbit, from CelesTrak
#                   (celestrak.org), for the SGP4 model run in the browser.
#   links.json      the catalogue's links that did not answer (HTTP 404 or 410), which the page leaves out.
# A craft that cannot be found is left out of the files and named in the log; the page shows only what was found.
# Run by hand:  python3 spacecraft/fetch_spacecraft.py   (standard library only)
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(HERE, 'data')
HORIZONS = 'https://ssd.jpl.nasa.gov/api/horizons.api'
CELESTRAK = 'https://celestrak.org/NORAD/elements/gp.php'
UA = {'User-Agent': 'NASA-and-ESA-Data-Projects/1.0 (spacecraft map; github.com/mcsyme11-byte/NASA-ESA-Data-and-API-Projects)'}
CENTER = {'Sun': '500@10', 'Earth': '500@399', 'Moon': '500@301', 'Mars': '500@499'}
GROUPS = ['stations', 'science', 'weather', 'resource', 'noaa', 'goes', 'military', 'geodetic', 'active']


def fetch(url, params=None, as_json=True, tries=3, timeout=120):
    full = url + ('?' + urllib.parse.urlencode(params, safe="'@%;=") if params else '')
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(full, headers=UA), timeout=timeout) as r:
                body = r.read()
                return json.loads(body) if as_json else body.decode('utf-8', 'replace')
        except urllib.error.HTTPError as e:
            if e.code in (400, 403, 404):
                raise
            err = e
        except Exception as e:      # network: try again
            err = e
        if k < tries - 1:
            time.sleep(4 * (k + 1))
    raise err


def write(name, doc):
    path = os.path.join(DATA, name)
    text = json.dumps(doc, separators=(',', ':'), ensure_ascii=False, allow_nan=False)
    try:
        with open(path) as fh:
            old = json.load(fh)
        if {k: v for k, v in old.items() if k != 'updated'} == {k: v for k, v in doc.items() if k != 'updated'}:
            print('%s: unchanged' % name)
            return
    except (OSError, ValueError):
        pass
    with open(path, 'w') as fh:
        fh.write(text)
    print('%s: written (%d KB)' % (name, len(text) // 1024))


# ---------------------------------------------------------------- Horizons
def resolve(names):
    """A Horizons spacecraft id (a negative number) for the first of the names Horizons recognises."""
    today = dt.date.today()
    for n in names:
        try:
            res = fetch(HORIZONS, {'format': 'json', 'COMMAND': "'%s'" % n.replace(' ', '%20'), 'EPHEM_TYPE': 'VECTORS', 'CENTER': "'500@10'",
                                   'START_TIME': "'%s'" % today, 'STOP_TIME': "'%s'" % (today + dt.timedelta(days=1)), 'STEP_SIZE': "'1%20d'", 'OBJ_DATA': 'NO'})
        except Exception as e:
            print('    lookup %r failed: %s' % (n, e))
            continue
        text = res.get('result', '') + res.get('error', '')
        # one match: "Target body name: Psyche (spacecraft) (-255)"; several: a table, one "  -255  Psyche ..." per line
        m = re.search(r'Target body name:.*?\((-\d+)\)', text)
        if m:
            return m.group(1)
        ids = re.findall(r'^\s*(-\d+)\s+(.+?)\s*$', text, re.M)
        for hid, nm in ids:
            if n.lower().replace('-', ' ') in nm.lower().replace('-', ' '):
                print('    %r: %s chosen from %d matches (%s)' % (n, hid, len(ids), nm.strip()[:40]))
                return hid
        time.sleep(1)
    return None


def vectors(hid, center, start, stop, step):
    res = fetch(HORIZONS, {
        'format': 'json', 'COMMAND': "'%s'" % hid, 'EPHEM_TYPE': 'VECTORS', 'CENTER': "'%s'" % CENTER[center],
        'START_TIME': "'%s'" % start.replace(' ', '%20'), 'STOP_TIME': "'%s'" % stop.replace(' ', '%20'), 'STEP_SIZE': "'%s'" % step.replace(' ', '%20'),
        'OUT_UNITS': 'KM-S', 'REF_PLANE': 'ECLIPTIC', 'REF_SYSTEM': 'ICRF', 'VEC_TABLE': '1', 'CSV_FORMAT': 'YES', 'OBJ_DATA': 'NO'})
    return res.get('result', '') + res.get('error', '')


def samples_for(c, now):
    src = c['src']
    hid = src.get('horizons') or resolve(src.get('horizons_name', []))
    if not hid:
        print('  %-28s not found in Horizons (%s)' % (c['name'], ', '.join(src.get('horizons_name', []))))
        return None
    center = src['center']
    if center == 'Sun':
        step_d = src.get('step', 4)
        back = src.get('years_back', 3)
        start = max(dt.datetime.fromisoformat(c['launch']) + dt.timedelta(days=2), now - dt.timedelta(days=365.25 * back))
        stop = now + dt.timedelta(days=365)
        step = '%d h' % round(step_d * 24) if step_d < 1 else '%d d' % step_d
        step_days = step_d
    elif center == 'Earth':
        start, stop, step, step_days = now - dt.timedelta(days=60), now + dt.timedelta(days=120), '6 h', 0.25
        start = max(start, dt.datetime.fromisoformat(c['launch']) + dt.timedelta(days=1))
    else:
        mins = src.get('step_min', 5)
        start, stop, step, step_days = now - dt.timedelta(hours=12), now + dt.timedelta(hours=36), '%d m' % mins, mins / 1440
    rng = [start.strftime('%Y-%m-%d %H:%M'), stop.strftime('%Y-%m-%d %H:%M')]
    text = ''
    for _ in range(3):
        text = vectors(hid, center, rng[0], rng[1], step)
        if '$$SOE' in text:
            break
        # the trajectory does not cover the whole range: Horizons names the dates it does cover
        m1 = re.search(r'(?:prior to|before)\s+A\.D\.\s+(\d{4}-[A-Z]{3}-\d{2})(?:\s+(\d{2}:\d{2}))?', text)
        m2 = re.search(r'after\s+A\.D\.\s+(\d{4}-[A-Z]{3}-\d{2})(?:\s+(\d{2}:\d{2}))?', text)
        fix = lambda d, t: dt.datetime.strptime(d.title() + ' ' + (t or '00:00'), '%Y-%b-%d %H:%M')
        if m1:
            rng[0] = (fix(m1.group(1), m1.group(2)) + dt.timedelta(days=1)).strftime('%Y-%m-%d %H:%M')
        if m2:
            rng[1] = (fix(m2.group(1), m2.group(2)) - dt.timedelta(hours=1)).strftime('%Y-%m-%d %H:%M')
        if not (m1 or m2):
            break
        time.sleep(1)
    if '$$SOE' not in text:
        print('  %-28s %s: no positions (%s)' % (c['name'], hid, text.strip()[:160].replace('\n', ' ')))
        return None
    xyz, jd0 = [], None
    for line in text.split('$$SOE', 1)[1].split('$$EOE', 1)[0].strip().splitlines():
        p = [v.strip() for v in line.split(',')]
        if len(p) < 5:
            continue
        jd0 = float(p[0]) if jd0 is None else jd0
        xyz += [round(float(p[2])), round(float(p[3])), round(float(p[4]))]
    print('  %-28s %s: %d positions around %s, from %s' % (c['name'], hid, len(xyz) // 3, center, rng[0]))
    return {'horizons': hid, 'parent': center, 'jd0': jd0, 'step': step_days, 'xyz': xyz}


# ---------------------------------------------------------------- CelesTrak
def tles(wanted):
    """{catalogue key: {name, line1, line2, norad, epoch}} for each craft, by its exact CelesTrak name."""
    found, pool = {}, {}
    for g in GROUPS:
        if all(k in found for k in wanted):
            break
        try:
            text = fetch(CELESTRAK, {'GROUP': g, 'FORMAT': 'tle'}, as_json=False)
        except Exception as e:
            print('  CelesTrak group %s: %s' % (g, e))
            continue
        lines = [l.rstrip() for l in text.splitlines() if l.strip()]
        for i in range(0, len(lines) - 2, 3):
            if lines[i + 1].startswith('1 ') and lines[i + 2].startswith('2 '):
                pool.setdefault(lines[i].strip().upper(), (lines[i].strip(), lines[i + 1], lines[i + 2]))
        for key, names in wanted.items():
            if key not in found:
                for n in names:
                    if n.upper() in pool:
                        found[key] = pool[n.upper()]
                        break
        time.sleep(2)
    for key, names in wanted.items():       # not in any group: ask by name, or by catalogue number ("#43435")
        if key in found:
            continue
        for n in names:
            try:
                q = {'CATNR': n[1:]} if n.startswith('#') else {'NAME': n}
                text = fetch(CELESTRAK, {**q, 'FORMAT': 'tle'}, as_json=False)
            except Exception as e:
                print('  CelesTrak name %r: %s' % (n, e))
                continue
            lines = [l.rstrip() for l in text.splitlines() if l.strip()]
            sets = [(lines[i].strip(), lines[i + 1], lines[i + 2]) for i in range(0, len(lines) - 2, 3) if lines[i + 1].startswith('1 ')]
            exact = [s for s in sets if s[0].upper() == n.upper() or n.startswith('#')]
            if exact or len(sets) == 1:
                found[key] = (exact or sets)[0]
                break
            time.sleep(2)
    out = {}
    for key, (name, l1, l2) in found.items():
        yy, day = int(l1[18:20]), float(l1[20:32])
        epoch = dt.datetime(2000 + yy if yy < 57 else 1900 + yy, 1, 1) + dt.timedelta(days=day - 1)
        out[key] = {'name': name, 'line1': l1, 'line2': l2, 'norad': int(l1[2:7]), 'epoch': epoch.strftime('%Y-%m-%d %H:%M')}
    for key in wanted:
        print('  %-28s %s' % (key, ('%s (%d), elements of %s' % (out[key]['name'], out[key]['norad'], out[key]['epoch'])) if key in out else 'not found at CelesTrak'))
    return out


# ---------------------------------------------------------------- links
def check_links(cat):
    bad = []
    seen = set()
    for c in cat:
        for l in c.get('links', []):
            u = l['url']
            if u in seen:
                continue
            seen.add(u)
            code = None
            for method in ('HEAD', 'GET'):
                try:
                    req = urllib.request.Request(u, headers=UA, method=method)
                    with urllib.request.urlopen(req, timeout=30) as r:
                        code = r.status
                    break
                except urllib.error.HTTPError as e:
                    code = e.code
                    if e.code not in (403, 405, 429, 501):
                        break
                except Exception as e:
                    code = str(e)[:60]
                    break
            if code in (404, 410):
                bad.append(u)
            print('  %s %s' % (code, u))
            time.sleep(0.5)
    return bad


def main():
    os.makedirs(DATA, exist_ok=True)
    with open(os.path.join(HERE, 'catalogue.json')) as fh:
        cat = json.load(fh)['craft']
    now = dt.datetime.now(dt.timezone.utc).replace(tzinfo=None, second=0, microsecond=0)
    stamp = now.strftime('%Y-%m-%d %H:%M UTC')
    ok = True

    print('Horizons:')
    pos = {}
    for c in cat:
        if 'horizons' in c['src'] or 'horizons_name' in c['src']:
            try:
                s = samples_for(c, now)
            except Exception as e:
                print('  %-28s failed: %s' % (c['name'], e))
                s, ok = None, False
            if s:
                pos[c['key']] = s
            time.sleep(1)
    if pos:
        write('positions.json', {'source': 'NASA/JPL Horizons (ssd.jpl.nasa.gov/api/horizons.api)', 'frame': 'ecliptic J2000 (ICRF), km, relative to "parent"',
                                 'updated': stamp, 'craft': pos})

    print('CelesTrak:')
    wanted = {c['key']: c['src']['tle'] for c in cat if 'tle' in c['src']}
    try:
        t = tles(wanted)
        if t:
            write('tle.json', {'source': 'CelesTrak (celestrak.org), general perturbations orbital elements', 'updated': stamp,
                               'sats': [{'key': k, **v} for k, v in sorted(t.items())]})
    except Exception as e:
        print('  failed: %s' % e)
        ok = False

    # links once a day is plenty: only on the morning run (or when there is no file yet)
    if now.hour < 12 or not os.path.exists(os.path.join(DATA, 'links.json')):
        print('Links:')
        write('links.json', {'updated': stamp, 'broken': check_links(cat)})
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
