#!/usr/bin/env python3
# NASA and ESA Data Projects · Asteroid Tracker · daily copy of NASA's NeoWs data · © 2026 Malcolm Syme ·
# mcsyme11@gmail.com
#
# The "This week" list and each asteroid's page read NASA's NeoWs service (api.nasa.gov), which needs a key. A key
# cannot be put in the public pages, and visitors should not need one, so this script copies the part of NeoWs that
# most visitors see, using the developer's key kept as the GitHub repository secret NASA_API_KEY (never in a file):
#
#   data/neows/index.json          what the copy holds: the weeks, the asteroids and when each was fetched
#   data/neows/week-YYYY-MM-DD.json   NeoWs "feed" for one week (Sunday to Saturday, UTC), from two weeks before the
#                                  current week to two weeks after it
#   data/neows/neo/<id>.json       NeoWs "neo" for every asteroid in those weeks (its size, orbit and passes of Earth)
#
# The files keep NeoWs's own shape, trimmed to the fields the pages use, so the pages read them exactly as they read
# NASA's answers. A week or asteroid outside the copy is still asked of NASA by the visitor's browser (demo key, or
# the visitor's own key).
#
# Limits: a personal key allows 1,000 requests an hour. A first run needs about 5 + 600 requests; later runs fetch
# only asteroids new to the window and refresh the oldest (more than 14 days old), at most DETAIL_MAX a run, and stop
# early when NASA reports fewer than 25 requests left. Without NASA_API_KEY the script uses DEMO_KEY for the weeks
# only (5 requests) and fetches no asteroid details.
#
# Run by hand:  NASA_API_KEY=... python3 asteroid-tracker/fetch_neows.py   (standard library only)
import datetime as dt
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

DATA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data', 'neows')
API = os.environ.get('NEOWS_API', 'https://api.nasa.gov/neo/rest/v1')   # override for tests only
UA = {'User-Agent': 'NASA-and-ESA-Data-Projects/1.0 (asteroid tracker)'}
WEEKS_BEFORE, WEEKS_AFTER = 2, 2
DETAIL_MAX = 750          # asteroid pages fetched in one run at most
REFRESH_DAYS = 14         # an asteroid's copy older than this is fetched again (oldest first)
KEEP_LEFT = 25            # stop when NASA reports fewer requests left than this


class OutOfRequests(Exception):
    pass


def get(path, params, key):
    """NeoWs answer as JSON. The key is never printed."""
    q = urllib.parse.urlencode({**params, 'api_key': key})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(f'{API}{path}?{q}', headers=UA), timeout=60) as r:
                left = r.headers.get('X-RateLimit-Remaining')
                data = json.load(r)
                if left is not None and int(left) < KEEP_LEFT:
                    raise OutOfRequests(f'{left} requests left')
                return data
        except urllib.error.HTTPError as e:
            if e.code == 429:
                raise OutOfRequests('NASA answered 429 (limit reached)')
            if e.code in (400, 404):
                return None
            if e.code == 403:
                raise SystemExit('NASA did not accept the key (403): check the NASA_API_KEY secret.')
            err = f'HTTP {e.code}'
        except (urllib.error.URLError, TimeoutError) as e:
            err = str(e)
        time.sleep(5 * (attempt + 1))
    raise RuntimeError(f'{path}: {err}')


def trim_approach(c):
    return {'orbiting_body': c.get('orbiting_body'), 'epoch_date_close_approach': c.get('epoch_date_close_approach'),
            'miss_distance': {k: c['miss_distance'][k] for k in ('lunar', 'kilometers')},
            'relative_velocity': {'kilometers_per_second': c['relative_velocity']['kilometers_per_second']}}


def trim_common(o):
    return {'id': o['id'], 'name': o['name'], 'absolute_magnitude_h': o.get('absolute_magnitude_h'),
            'estimated_diameter': {'meters': o['estimated_diameter']['meters']},
            'is_potentially_hazardous_asteroid': o.get('is_potentially_hazardous_asteroid'), 'nasa_jpl_url': o.get('nasa_jpl_url')}


def trim_neo(o):
    t = trim_common(o)
    t.update({'designation': o.get('designation'), 'is_sentry_object': o.get('is_sentry_object'),
              'orbital_data': o.get('orbital_data'),
              'close_approach_data': [trim_approach(c) for c in o.get('close_approach_data') or [] if c.get('orbiting_body') == 'Earth']})
    return t


def write_if_changed(path, obj):
    text = json.dumps(obj, separators=(',', ':'), allow_nan=False, sort_keys=True)
    try:
        with open(path) as f:
            if f.read() == text:
                return False
    except FileNotFoundError:
        pass
    with open(path, 'w') as f:
        f.write(text)
    return True


def main():
    key = os.environ.get('NASA_API_KEY', '').strip()
    personal = bool(key) and key != 'DEMO_KEY'
    key = key or 'DEMO_KEY'
    os.makedirs(os.path.join(DATA, 'neo'), exist_ok=True)
    try:
        with open(os.path.join(DATA, 'index.json')) as f:
            old = json.load(f)
    except (FileNotFoundError, ValueError):
        old = {}
    fetched = dict(old.get('fetched', {}))      # asteroid id -> date its copy was fetched (YYYY-MM-DD)
    now = dt.datetime.now(dt.timezone.utc)
    today = now.date()
    sunday = today - dt.timedelta(days=(today.weekday() + 1) % 7)
    starts = [sunday + dt.timedelta(weeks=w) for w in range(-WEEKS_BEFORE, WEEKS_AFTER + 1)]
    print('Key:', 'the developer\'s key (NASA_API_KEY secret)' if personal else 'DEMO_KEY (no NASA_API_KEY secret)')

    weeks, ids, stopped = [], [], None
    try:
        for s in starts:
            try:
                feed = get('/feed', {'start_date': s.isoformat(), 'end_date': (s + dt.timedelta(days=6)).isoformat()}, key)
            except RuntimeError as e:
                print(f'Week of {s}: not fetched ({e}); the previous copy is kept')
                continue
            if not feed:
                continue
            neo = {d: [dict(trim_common(o), close_approach_data=[trim_approach(c) for c in o['close_approach_data']])
                       for o in objs] for d, objs in feed.get('near_earth_objects', {}).items()}
            n = sum(len(v) for v in neo.values())
            write_if_changed(os.path.join(DATA, f'week-{s.isoformat()}.json'), {'element_count': n, 'near_earth_objects': neo})
            weeks.append(s.isoformat())
            ids += [o['id'] for v in neo.values() for o in v]
            print(f'Week of {s}: {n} close approaches')
    except OutOfRequests as e:
        stopped = str(e)
    if not weeks:
        print('No week could be fetched; the previous copy is kept.', stopped or '')
        return 1
    # a week that could not be fetched this time keeps its previous copy if it is still in the window
    for s in old.get('weeks', []):
        if s not in weeks and s in [x.isoformat() for x in starts] and os.path.exists(os.path.join(DATA, f'week-{s}.json')):
            weeks.append(s)
            with open(os.path.join(DATA, f'week-{s}.json')) as f:
                ids += [o['id'] for v in json.load(f)['near_earth_objects'].values() for o in v]
    weeks.sort()

    ids = sorted(set(ids), key=int)
    want = set(ids)
    # asteroids to fetch: new ones first, then the oldest copies past REFRESH_DAYS
    new = [i for i in ids if i not in fetched or not os.path.exists(os.path.join(DATA, 'neo', f'{i}.json'))]
    stale = sorted((i for i in ids if i not in new and (today - dt.date.fromisoformat(fetched[i])).days >= REFRESH_DAYS),
                   key=lambda i: fetched[i])
    todo = (new + stale)[:DETAIL_MAX] if personal and not stopped else []
    got = 0
    try:
        for i in todo:
            try:
                o = get(f'/neo/{i}', {}, key)
            except RuntimeError as e:
                print(f'Asteroid {i}: not fetched ({e})')
                continue
            if o:
                write_if_changed(os.path.join(DATA, 'neo', f'{i}.json'), trim_neo(o))
                fetched[i] = today.isoformat()
                got += 1
    except OutOfRequests as e:
        stopped = str(e)
    print(f'Asteroid pages fetched: {got} of {len(todo)} planned ({len(new)} new, {len(stale)} due for refresh)')

    # drop asteroids and weeks that have left the window
    for name in os.listdir(os.path.join(DATA, 'neo')):
        if name.endswith('.json') and name[:-5] not in want:
            os.remove(os.path.join(DATA, 'neo', name))
    for name in os.listdir(DATA):
        if name.startswith('week-') and name[5:15] not in weeks:
            os.remove(os.path.join(DATA, name))
    have = [i for i in ids if i in fetched and os.path.exists(os.path.join(DATA, 'neo', f'{i}.json'))]
    fetched = {i: fetched[i] for i in have}
    write_if_changed(os.path.join(DATA, 'index.json'), {
        'updated': now.strftime('%Y-%m-%d %H:%M UTC'), 'weeks': weeks, 'neo': have, 'fetched': fetched,
        'key': 'personal' if personal else 'demo'})
    print(f'Copy: {len(weeks)} weeks, {len(have)} of {len(ids)} asteroid pages.' + (f' Stopped early: {stopped}.' if stopped else ''))
    return 0


if __name__ == '__main__':
    sys.exit(main())
