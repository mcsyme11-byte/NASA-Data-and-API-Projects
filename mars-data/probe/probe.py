# NASA and ESA Data Projects · Mars Data · archive probe · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# One-off probe, run on GitHub Actions (branch mars-probe): checks that the NASA PDS Atmospheres Node and ESA's
# Planetary Science Archive can be reached, maps the REMS, MEDA and Mars Express MaRS folders, and saves the first and
# last REMS MODRDR files with their labels so the columns can be read. Writes everything to mars-data/probe/out/.
import re, sys, json, time, urllib.request, urllib.parse
from pathlib import Path

OUT = Path(__file__).parent / "out"; OUT.mkdir(exist_ok=True)
UA = {"User-Agent": "NASA-ESA-Data-Projects-probe/1.0 (educational; github.com/mcsyme11-byte)"}
log = []

def get(url, limit=None):
    t = time.time()
    try:
        req = urllib.request.Request(url, headers=UA)
        with urllib.request.urlopen(req, timeout=60) as r:
            data = r.read(limit) if limit else r.read()
            log.append(f"OK   {r.status} {len(data):>9} B {time.time()-t:5.1f}s {url}")
            return data
    except Exception as e:
        log.append(f"FAIL {type(e).__name__}: {e} {url}")
        return None

def listing(url):
    """Links in an Apache-style directory index, without parents, queries or absolute links elsewhere."""
    html = get(url)
    if html is None: return []
    out = []
    for h in re.findall(r'href="([^"?#]+)"', html.decode("utf-8", "replace")):
        if h.startswith(("/", "http", "..", "mailto")): continue
        out.append(h)
    return sorted(set(out))

def save(name, data):
    if data is not None: (OUT / name).write_bytes(data)

report = {}
# Round 4: corrected UV data (UVRDR)
base = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/"
save("uv_REMS_UVRDR_DS.CAT", get(base + "CATALOG/REMS_UVRDR_DS.CAT"))
lvl1 = listing(base + "DATA_UV_CORRECTED/"); report["uv_lvl1"] = lvl1
dirs = [d for d in lvl1 if d.endswith("/")]
for which, d in ([("first", dirs[0]), ("last", dirs[-1])] if dirs else []):
    lvl2 = listing(base + "DATA_UV_CORRECTED/" + d); report["uv_" + which + "_lvl2"] = lvl2[:5] + ["..."] + lvl2[-5:]
    sub = [x for x in lvl2 if x.endswith("/")]
    files, path = lvl2, base + "DATA_UV_CORRECTED/" + d
    if sub:
        pick = sub[0] if which == "first" else sub[-1]
        path = path + pick; files = listing(path); report["uv_" + which + "_files"] = files
    for f in files:
        if f.upper().endswith(".LBL"):
            save("uv_" + which + "_" + f, get(path + f))
        if f.upper().endswith(".TAB"):
            dd = get(path + f)
            if dd is not None:
                save("uv_" + which + "_" + f, b"\n".join(dd.splitlines()[:40]))
                report["uv_" + which + "_rows"] = dd.count(b"\n")
            break
for f in listing(base + "LABEL/"):
    if "UV" in f.upper(): save("uv_LABEL_" + f, get(base + "LABEL/" + f))
(OUT / "report.json").write_text(json.dumps(report, indent=2))
(OUT / "requests.txt").write_text("\n".join(log) + "\n")
