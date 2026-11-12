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
# Round 5: one corrected UV table (sols 1-100): label and the first 40 rows
u = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/DATA_UV_CORRECTED/"
save("uvc_REMS_UVS_0001_0100.LBL", get(u + "REMS_UVS_0001_0100.LBL"))
d = get(u + "REMS_UVS_0001_0100.TAB")
if d is not None:
    save("uvc_REMS_UVS_0001_0100_head.TAB", b"\n".join(d.splitlines()[:40]))
    report["uvc_rows"] = d.count(b"\n"); report["uvc_bytes"] = len(d)
(OUT / "report.json").write_text(json.dumps(report, indent=2))
(OUT / "requests.txt").write_text("\n".join(log) + "\n")
