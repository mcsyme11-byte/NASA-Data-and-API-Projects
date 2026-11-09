#!/usr/bin/env python3
# NASA and ESA Data Projects · Asteroid Tracker · impact-risk lists and ESA close approaches · © 2026 Malcolm Syme ·
# mcsyme11@gmail.com
#
# Writes, in asteroid-tracker/data/:
#   risk.json        every object with a calculated chance of hitting Earth, from both impact-monitoring centres:
#                    ESA's NEO Coordination Centre (NEOCC) risk list and NASA/JPL's Sentry, side by side, matched by
#                    designation, with each object's NeoWs id when it is in data/neos.json
#   esa_close.json   ESA NEOCC's close approaches to Earth within 0.05 au: the past 30 days and the next year
#
# ESA NEOCC (https://neo.ssa.esa.int/computer-access): plain-text tables with "|" between columns, no key. ESA calls
# this access experimental and liable to change without notice, so each table is checked against the expected
# headings; a table that does not match is skipped and the previous file kept, and the NASA part still runs.
# NASA/JPL Sentry (https://ssd-api.jpl.nasa.gov/doc/sentry.html): JSON, API version 2.0, no key.
# Neither server's reply to a web page from another site is relied on: the CORS header each sends is recorded in
# risk.json (cors) for docs/DATA-SOURCES.md.
#
# Run by hand:  python3 asteroid-tracker/fetch_risk.py   (standard library only)
import datetime as dt
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data')
NEOCC = 'https://neo.ssa.esa.int/PSDB-portlet/download'
SENTRY = 'https://ssd-api.jpl.nasa.gov/sentry.api'
UA = {'User-Agent': 'NASA-and-ESA-Data-Projects/1.0 (asteroid tracker)', 'Origin': 'https://mcsyme11-byte.github.io'}
LD_KM = 384400


def fetch(url, params, tries=3):
    """(body text, the Access-Control-Allow-Origin header or None)."""
    q = urllib.parse.urlencode(params)
    for k in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + ('?' + q if q else ''), headers=UA), timeout=180) as r:
                return r.read().decode('utf-8', 'replace'), r.headers.get('Access-Control-Allow-Origin')
        except Exception as e:
            if k == tries - 1:
                raise
            print('  retrying after: %s' % e)
            time.sleep(5 * (k + 1))


def des_from_esa(num_des, name=''):
    """ESA writes designations without the space: 2008JL3 → 2008 JL3; 6344PL → 6344 P-L. Numbered: the number."""
    s = num_des.strip()
    if re.fullmatch(r'\d+', s):
        return s
    m = re.fullmatch(r'(\d{4})(P-?L|T-?[123])', s)              # survey codes first: 6344PL → 6344 P-L
    if m:
        return m.group(1) + ' ' + m.group(2)[0] + '-' + m.group(2)[-1]
    m = re.fullmatch(r'(\d{4}|A\d{3})([A-Z]{2}\d*)', s)          # 2008JL3 → 2008 JL3; A898PA → A898 PA
    if m:
        return m.group(1) + ' ' + m.group(2)
    return s


def esa_table(text, need):
    """The data rows of an NEOCC table: (last update, [[cell, …], …]). `need` are words its column headings must
    contain; a table without them (a changed format) raises ValueError."""
    lines = text.replace('\r', '').split('\n')
    stamp = next((l.split(':', 1)[1].strip() for l in lines if l.startswith('Last Update')), None)
    head = ' '.join(l for l in lines[:8] if '|' in l)
    missing = [w for w in need if w.lower() not in head.lower()]
    if missing or not stamp:
        raise ValueError('table format changed: missing %s' % (missing or ['Last Update']))
    rows, started = [], False
    for l in lines:
        if not started:
            started = l.startswith('AAAA')            # the line of placeholders ends the headings
            continue
        if '|' in l:
            rows.append([c.strip() for c in l.split('|')])
    if not rows:
        raise ValueError('table has no rows')
    return stamp, rows


def num(s):
    try:
        return float(s)
    except (TypeError, ValueError):
        return None


def esa_risk():
    text, cors = fetch(NEOCC, {'file': 'esa_risk_list'})
    stamp, rows = esa_table(text, ['Num/des', 'Diameter', 'IP max', 'PS max', 'TS', 'Vel km/s', 'IP cum'])
    out = {}
    for r in rows:
        if len(r) < 11:
            continue
        num_des, name = (r[0].split(None, 1) + [''])[:2]           # "101955 Bennu", "2008JL3"
        d = des_from_esa(num_des)
        out[d] = {'name': name, 'diameter_m': num(r[1]), 'estimated': r[2] == '*', 'date': r[3][:10] or None,
                  'ip_max': num(r[4]), 'ps_max': num(r[5]), 'ts': int(r[6]) if r[6].isdigit() else None,
                  'v_kms': num(r[7]), 'years': r[8] or None, 'ip_cum': num(r[9]), 'ps_cum': num(r[10])}
    print('ESA risk list: %d objects (updated %s)' % (len(out), stamp))
    return stamp, out, cors


def esa_close():
    out, stamps = [], []
    for f in ('esa_recent_close_app', 'esa_upcoming_close_app'):
        text, _ = fetch(NEOCC, {'file': f})
        stamp, rows = esa_table(text, ['Num/des', 'Miss Distance', 'km', 'LD', 'Diameter', 'Rel. vel', 'CAI'])
        stamps.append(stamp)
        for r in rows:
            if len(r) < 10:
                continue
            num_des, name = (r[0].split(None, 1) + [''])[:2]
            out.append([des_from_esa(num_des), name, r[1], num(r[2]), num(r[4]), num(r[5]), r[6] == '*', num(r[7]),
                        num(r[9]), num(r[10])])
    out.sort(key=lambda x: (x[2], x[4] or 0))
    print('ESA close approaches: %d (updated %s)' % (len(out), ', '.join(stamps)))
    return max(stamps), out


def sentry():
    text, cors = fetch(SENTRY, {})
    s = json.loads(text)
    if str(s.get('signature', {}).get('version')) != '2.0':
        raise ValueError('Sentry API version changed: %s' % s.get('signature'))
    out = {}
    for o in s['data']:
        out[o['des']] = {'name': o.get('fullname', '').strip(), 'ip': num(o.get('ip')), 'ps_max': num(o.get('ps_max')),
                         'ps_cum': num(o.get('ps_cum')), 'ts': int(o['ts_max']) if str(o.get('ts_max', '')).isdigit() else None,
                         'years': o.get('range'), 'n_imp': o.get('n_imp'),
                         'diameter_m': round(num(o['diameter']) * 1000) if num(o.get('diameter')) else None,
                         'v_kms': num(o.get('v_inf')), 'date': None, 'ip_max': None}
    # the single most likely impact of each object: its date and chance (mode V lists every possible impact)
    text, _ = fetch(SENTRY, {'all': '1'})
    v = json.loads(text)
    for vi in v.get('data', []):
        o = out.get(vi['des'])
        ip = num(vi.get('ip'))
        if o is not None and ip is not None and (o['ip_max'] is None or ip > o['ip_max']):
            o['ip_max'] = ip
            o['date'] = vi['date'][:10]
    print('NASA Sentry: %d objects' % len(out))
    return out, cors


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


def old(name):
    try:
        with open(os.path.join(DATA, name), encoding='utf-8') as fh:
            return json.load(fh)
    except (OSError, ValueError):
        return {}


def neows_ids():
    """designation → NeoWs id, from data/neos.json (2,000,000 + number when numbered, else SBDB's spkid)."""
    d = old('neos.json')
    ids = {}
    for r in d.get('rows', []):
        m = re.match(r'\s*(\d+)\s', r[1])
        ids[str(r[2])] = 2000000 + int(m.group(1)) if m else r[0]
    return ids


RISK_FIELDS = ['designation', 'name', 'neows_id', 'diameter_m',
               'esa_date', 'esa_ip_max', 'esa_ps_max', 'esa_ts', 'esa_years', 'esa_ip_cum', 'esa_ps_cum',
               'nasa_date', 'nasa_ip_max', 'nasa_ps_max', 'nasa_ts', 'nasa_years', 'nasa_ip_cum', 'nasa_ps_cum', 'v_kms']


def main():
    now = dt.datetime.now(dt.timezone.utc)
    stamp = now.strftime('%Y-%m-%dT%H:%MZ')
    os.makedirs(DATA, exist_ok=True)
    prev = old('risk.json')
    failed = 0
    try:
        esa_stamp, esa, esa_cors = esa_risk()
    except Exception as e:
        print('ESA risk list could not be read: %s' % e); failed += 1
        esa_stamp, esa, esa_cors = None, None, None
    try:
        nasa, nasa_cors = sentry()
    except Exception as e:
        print('NASA Sentry could not be read: %s' % e); failed += 1
        nasa, nasa_cors = None, None
    if esa is None and nasa is None:
        sys.exit(1)
    # a list that could not be read keeps its previous rows, so one failing source never empties the other's column
    if esa is None or nasa is None:
        keep = {r[0]: dict(zip(RISK_FIELDS, r)) for r in prev.get('rows', [])}
        def from_prev(prefix):
            return {d: {k[len(prefix):]: v for k, v in r.items() if k.startswith(prefix)} | {'name': r['name']}
                    for d, r in keep.items() if r.get(prefix + 'ip_max') is not None or r.get(prefix + 'date')}
        if esa is None:
            esa, esa_stamp = from_prev('esa_'), prev.get('esa_updated')
        if nasa is None:
            nasa = from_prev('nasa_')
    ids = neows_ids()
    rows = []
    for d in sorted(set(esa) | set(nasa), key=lambda x: (len(x), x)):
        e, n = esa.get(d, {}), nasa.get(d, {})
        # NASA's full name when it has one, else from ESA's: "29075 (1950 DA)", "101955 Bennu", "(2023 TB2)"
        en = e.get('name', '')
        en = '(%s)' % des_from_esa(en) if re.fullmatch(r'(\d{4}|A\d{3})[A-Z]{2}\d*|\d{4}(P-?L|T-?[123])', en) else en
        name = n.get('name') or ('%s %s' % (d, en) if d.isdigit() and en else d if d.isdigit() else '(%s)' % d)
        rows.append([d, name, ids.get(d), e.get('diameter_m') or n.get('diameter_m'),
                     e.get('date'), e.get('ip_max'), e.get('ps_max'), e.get('ts'), e.get('years'), e.get('ip_cum'), e.get('ps_cum'),
                     n.get('date'), n.get('ip_max'), n.get('ps_max'), n.get('ts'), n.get('years'), n.get('ip'), n.get('ps_cum'),
                     e.get('v_kms') or n.get('v_kms')])
    write_if_changed('risk.json', {
        'source': 'ESA NEO Coordination Centre risk list (neo.ssa.esa.int) and NASA/JPL Sentry (ssd-api.jpl.nasa.gov)',
        'updated': stamp, 'esa_updated': esa_stamp, 'counts': {'esa': len(esa), 'nasa': len(nasa), 'both': len(set(esa) & set(nasa))},
        'cors': {'esa_neocc': esa_cors, 'nasa_sentry': nasa_cors},
        'fields': RISK_FIELDS, 'rows': rows}, ['rows'])
    try:
        close_stamp, close = esa_close()
        write_if_changed('esa_close.json', {
            'source': 'ESA NEO Coordination Centre close approaches list (neo.ssa.esa.int), within 0.05 au, '
                      'the past 30 days and the next year',
            'updated': stamp, 'esa_updated': close_stamp,
            'fields': ['designation', 'name', 'date_utc', 'distance_km', 'distance_ld', 'diameter_m', 'diameter_estimated',
                       'h', 'v_kms', 'cai'],
            'rows': close}, ['rows'])
    except Exception as e:
        print('ESA close approaches could not be read: %s' % e); failed += 1
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
