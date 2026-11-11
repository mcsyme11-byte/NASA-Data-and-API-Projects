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

# 1. Reachability
for u in ["https://atmos.nmsu.edu/PDS/data/",
          "https://pds-atmospheres.nmsu.edu/PDS/data/",
          "https://atmos.nmsu.edu/PDS/data/mslrem_1001/",
          "https://archives.esac.esa.int/psa/ftp/",
          "https://archives.esac.esa.int/psa/ftp/MARS-EXPRESS/MRS/"]:
    get(u, 2000)

# 2. PDS data folder: names relevant to REMS and MEDA
top = listing("https://atmos.nmsu.edu/PDS/data/")
report["pds_top_relevant"] = [x for x in top if re.search(r"msl|rem|meda|m2020|mars2020|perse", x, re.I)]
report["pds_top_count"] = len(top)

# 3. REMS RDR volume
base = "https://atmos.nmsu.edu/PDS/data/mslrem_1001/"
root = listing(base); report["rems_root"] = root
for f in ["aareadme.txt", "voldesc.cat", "errata.txt"]:
    if f in [r.lower() for r in root] or True:
        save("rems_" + f, get(base + f))
data_dirs = listing(base + "DATA/"); report["rems_data_dirs"] = data_dirs
doc = listing(base + "DOCUMENT/"); report["rems_document"] = doc
lbl = listing(base + "LABEL/"); report["rems_label_dir"] = lbl
for f in lbl:
    if f.upper().endswith((".FMT", ".TXT")) and len(lbl) < 40:
        save("rems_LABEL_" + f, get(base + "LABEL/" + f))

def sol_dirs(range_dir):
    return [d for d in listing(base + "DATA/" + range_dir) if d.endswith("/")]

samples = {}
ranges = [d for d in data_dirs if d.endswith("/")]
if ranges:
    for which, rd in [("first", ranges[0]), ("last", ranges[-1])]:
        sds = sol_dirs(rd)
        report[f"rems_{which}_range"] = rd
        report[f"rems_{which}_range_sols"] = [sds[0], sds[-1], len(sds)] if sds else []
        if not sds: continue
        sd = sds[0] if which == "first" else sds[-1]
        files = listing(base + "DATA/" + rd + sd)
        report[f"rems_{which}_sol_dir"] = rd + sd
        report[f"rems_{which}_sol_files"] = files
        for f in files:
            if "RMD" in f.upper():
                d = get(base + "DATA/" + rd + sd + f)
                save(f"rems_{which}_{f}", d)
                if d and f.upper().endswith(".TAB"):
                    samples[which] = {"file": f, "bytes": len(d), "rows": d.count(b"\n")}

report["rems_samples"] = samples

# 4. MEDA candidates
for cand in [x for x in top if re.search(r"meda|m2020|mars2020", x, re.I)][:5]:
    report["meda_" + cand.strip("/")] = listing("https://atmos.nmsu.edu/PDS/data/" + cand)[:60]

# 5. ESA PSA, Mars Express radio science
psa = "https://archives.esac.esa.int/psa/ftp/MARS-EXPRESS/MRS/"
mrs = listing(psa); report["psa_mex_mrs"] = mrs
report["psa_mex_mrs_level4_5"] = [x for x in mrs if re.search(r"-[45]-|OCC|_5|_4", x, re.I)]
for d in report["psa_mex_mrs_level4_5"][:3]:
    report["psa_" + d.strip("/")] = listing(psa + d)[:40]


# 6. Round 2: the archives' own notes, indexes and samples
for f in ["AAREADME.TXT", "ERRATA.TXT", "VOLDESC.CAT", "DOCUMENT/DATA_EVENTS.TXT", "DOCUMENT/DOCINFO.TXT"]:
    save("rems_" + f.replace("/", "_"), get(base + f))
cat = listing(base + "CATALOG/"); report["rems_catalog"] = cat
for f in cat:
    if re.search(r"MOD|DATASET|DS\.CAT|REF", f, re.I) and f.upper().endswith(".CAT"):
        save("rems_CATALOG_" + f, get(base + "CATALOG/" + f))
idx = listing(base + "INDEX/"); report["rems_index"] = idx
for f in idx:
    if f.upper().endswith((".LBL", ".TAB", ".CSV")):
        d = get(base + "INDEX/" + f)
        if d is not None and len(d) < 40_000_000: save("rems_INDEX_" + f, d)
report["rems_all_ranges"] = data_dirs

# MEDA (PDS4 releases)
rel = "https://pds.nasa.gov/data/pds4/releases/atmos/"
meda_rel = [x for x in listing(rel) if x.startswith("mars2020_meda")]
report["meda_releases"] = meda_rel
if meda_rel:
    latest = rel + sorted(meda_rel)[-1]
    report["meda_latest"] = latest
    report["meda_latest_root"] = listing(latest)
    save("meda_readme.txt", get(latest + "readme.txt"))
    for f in report["meda_latest_root"]:
        if "derived_env_inventory" in f: save("meda_" + f, get(latest + f))
    der = [d for d in report["meda_latest_root"] if d.rstrip("/") in ("data_derived_env",)]
    if der:
        lvl1 = listing(latest + der[0]); report["meda_derived_lvl1"] = lvl1[:80]
        sub = [d for d in lvl1 if d.endswith("/")]
        if sub:
            lvl2 = listing(latest + der[0] + sub[-1]); report["meda_derived_lvl2_" + sub[-1]] = lvl2[:80]
            sub2 = [d for d in lvl2 if d.endswith("/")]
            if sub2:
                lvl3 = listing(latest + der[0] + sub[-1] + sub2[-1]); report["meda_derived_lvl3"] = lvl3[:80]
                for f in lvl3:
                    if re.search(r"PS|ATS", f) and f.lower().endswith((".csv", ".xml")):
                        save("meda_sample_" + f, get(latest + der[0] + sub[-1] + sub2[-1] + f))

# ESA Mars Express MaRS level 5
for d in ["MEX-M-MRS-5-OCC-9124-V1.0/", "MEX-M-MRS-5-OCC-9107-V1.0/"]:
    b = psa + d; tag = d.strip("/")
    save("mex_" + tag + "_AAREADME.TXT", get(b + "AAREADME.TXT"))
    save("mex_" + tag + "_VOLDESC.CAT", get(b + "VOLDESC.CAT"))
    for f in listing(b + "CATALOG/"):
        if re.search(r"DATASET|DS\.CAT|REF", f, re.I): save("mex_" + tag + "_CAT_" + f, get(b + "CATALOG/" + f))
    l1 = listing(b + "DATA/"); report["mex_" + tag + "_data"] = l1[:60]
    sub = [x for x in l1 if x.endswith("/")]
    if sub:
        l2 = listing(b + "DATA/" + sub[0]); report["mex_" + tag + "_data_" + sub[0]] = l2[:60]
        sub2 = [x for x in l2 if x.endswith("/")]
        if sub2:
            l3 = listing(b + "DATA/" + sub[0] + sub2[0]); report["mex_" + tag + "_data3"] = l3[:60]
            files = l3
            base3 = b + "DATA/" + sub[0] + sub2[0]
        else:
            files, base3 = l2, b + "DATA/" + sub[0]
        n = 0
        for f in files:
            if f.upper().endswith((".TAB", ".LBL")) and n < 4:
                save("mex_" + tag + "_" + f, get(base3 + f)); n += 1

(OUT / "report.json").write_text(json.dumps(report, indent=2))
(OUT / "requests.txt").write_text("\n".join(log) + "\n")
print("\n".join(log)); print(json.dumps(report, indent=2)[:6000])
