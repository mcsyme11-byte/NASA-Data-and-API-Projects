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
# Round 6: where Perseverance MEDA's data files are, and what they look like
rel = "https://pds.nasa.gov/data/pds4/releases/atmos/mars2020_meda-20260811/"
d = get(rel + "collection_data_derived_env_inventory.csv") or get(rel + "collection_meda_data_derived_env_inventory.csv")
if d:
    lines = d.decode("utf-8", "replace").splitlines()
    report["meda_inventory_rows"] = len(lines)
    report["meda_inventory_head"] = lines[:5] + ["..."] + lines[-5:]
    names = [l.split("::")[0].split(":")[-1] for l in lines if "::" in l]
    report["meda_products_sample"] = sorted({n.split("_")[0] + "_" + "_".join(n.split("_")[1:])[:60] for n in names})[:30]
for base in ["https://atmos.nmsu.edu/PDS/data/PDS4/", "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/",
             "https://pds-atmospheres.nmsu.edu/PDS/data/PDS4/Mars2020/", "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/",
             "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/"]:
    report["list_" + base] = listing(base)[:60]
b = "https://atmos.nmsu.edu/PDS/data/PDS4/Mars2020/mars2020_meda/data_derived_env/"
lv = [x for x in listing(b) if x.endswith("/")]
if lv:
    l2 = listing(b + lv[-1]); report["meda_l2"] = l2[:40]
    sub = [x for x in l2 if x.endswith("/")]
    if sub:
        l3 = listing(b + lv[-1] + sub[-1]); report["meda_l3"] = l3[:80]
        for f in l3:
            if re.search(r"(PS|ATS|RHS|WS|ANCILLARY|GEOMETRY)", f, re.I) and f.lower().endswith((".csv", ".xml")):
                dd = get(b + lv[-1] + sub[-1] + f)
                if dd is not None:
                    save("meda_s_" + f, dd if f.lower().endswith(".xml") else b"\n".join(dd.splitlines()[:30]))
(OUT / "report.json").write_text(json.dumps(report, indent=2))
(OUT / "requests.txt").write_text("\n".join(log) + "\n")
