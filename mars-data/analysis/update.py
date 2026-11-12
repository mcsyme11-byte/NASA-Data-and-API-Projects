# NASA and ESA Data Projects · Mars Data · automatic update from NASA's archive · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Run by the "Mars data" GitHub Actions job (.github/workflows/mars-data.yml). Finds what NASA has released or
# replaced since the last run and processes only that:
#   - chunk folders not processed yet;
#   - in the newest processed chunk, sols added since, or files replaced by a new version (a new file name);
#   - corrected UV files not processed yet;
#   - Perseverance MEDA: new chunk folders and new sols (run_meda.py);
#   - ESA Mars Express profiles (run_mex.py): read once ESA's archive answers, and again when a new season appears.
# Also records whether NASA's ERRATA.TXT (the list of re-released files) has changed; a change is reported for a
# person to review, not acted on automatically.
#
# Writes mars-data/data/rems/last_check.json (date, newest sol, what was done) and, when there is something to
# report, mars_update_notice.md in the runner's temporary folder (the text of the GitHub issue the job opens; not
# committed). Exit code 0 also when nothing is new.
import hashlib
import json
import os
import re
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd

import run_meda
import run_mex
import run_rems
import run_uv
from run_rems import BASE, OUT, get, listing

NOTICE = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "mars_update_notice.md"


def mex_profiles(out: Path) -> int:
    """Number of Mars Express profiles saved so far (0 while none have been read)."""
    try:
        return int(len(pd.read_csv(out / "profiles.csv")))
    except (FileNotFoundError, pd.errors.EmptyDataError):
        return 0


def main() -> None:
    manifest = pd.read_csv(OUT / "manifest.csv") if (OUT / "manifest.csv").exists() else pd.DataFrame(columns=["sol", "file"])
    sols_before = set(pd.read_csv(OUT / "sols.csv")["sol"]) if (OUT / "sols.csv").exists() else set()
    done_files = set(manifest["file"])
    done_chunks = {f.split("/")[0] for f in done_files if f.startswith("SOL_")}

    chunks = run_rems.archive_chunks()
    todo = [c for c in chunks if c not in done_chunks]
    processed = [c for c in chunks if c in done_chunks]
    if processed:  # the newest processed chunk may have grown, or had files replaced
        last = processed[-1]
        for sd in [d for d in listing(BASE + "DATA/" + last + "/") if re.match(r"SOL\d{5}/$", d)]:
            names = [f for f in listing(BASE + "DATA/" + last + "/" + sd) if "RMD" in f and f.upper().endswith(".TAB")]
            if any(f"{last}/{sd}{n}" not in done_files for n in names):
                todo.insert(0, last)
                break

    uv_files = sorted({f[:-4] for f in re.findall(r'href="(REMS_UVS_\d{4}_\d{4}\.TAB)"',
                                                   get(run_uv.BASE).decode("utf-8", "replace"))})
    uv_todo = [u for u in uv_files if f"DATA_UV_CORRECTED/{u}.TAB" not in done_files]

    errata = get(BASE + "ERRATA.TXT")
    errata_sha = hashlib.sha256(errata).hexdigest()
    previous = json.loads((OUT / "last_check.json").read_text()) if (OUT / "last_check.json").exists() else {}
    errata_changed = bool(previous.get("errata_sha256")) and previous["errata_sha256"] != errata_sha

    if todo:
        mod_names, adr_names = run_rems.load_formats()
        for c in todo:
            run_rems.run_chunk(c, mod_names, adr_names)
    for u in uv_todo:
        run_uv.run_file(u)

    # Perseverance MEDA: new chunk folders, and new sols in the newest processed one.
    meda_out = run_meda.OUT
    m_manifest = pd.read_csv(meda_out / "manifest.csv") if (meda_out / "manifest.csv").exists() else pd.DataFrame(columns=["sol", "file"])
    m_before = set(pd.read_csv(meda_out / "sols.csv")["sol"]) if (meda_out / "sols.csv").exists() else set()
    m_done_chunks = {f.split("/")[0] for f in m_manifest["file"]}
    m_chunks = run_meda.archive_chunks()
    m_todo = [c for c in m_chunks if c not in m_done_chunks]
    m_processed = [c for c in m_chunks if c in m_done_chunks]
    if m_processed:
        last = m_processed[-1]
        sol_dirs = [d for d in listing(run_meda.BASE + last + "/") if re.match(r"sol_\d{4}/$", d)]
        if any(int(d.strip("/").split("_")[1]) not in set(m_manifest["sol"]) for d in sol_dirs):
            m_todo.insert(0, last)
    for c in m_todo:
        run_meda.run_chunk(c)
    m_after = set(pd.read_csv(meda_out / "sols.csv")["sol"]) if (meda_out / "sols.csv").exists() else set()
    m_new = sorted(m_after - m_before)

    # ESA Mars Express: read once ESA's archive answers, then again when a new occultation season appears.
    mex_note = ""
    mex_out = run_mex.OUT
    try:
        sets = run_mex.season_sets()
        done = []
        if (mex_out / "report.md").exists():
            done = re.findall(r"MEX-M-MRS-5-OCC-\d{4}-V\d+\.\d+", (mex_out / "report.md").read_text())
        if not (mex_out / "profiles.csv").exists() or sorted(set(done)) != sorted(sets):
            run_mex.main()
            mex_note = (f"ESA's Mars Express profiles were read ({mex_profiles(mex_out)} profiles). "
                        "A chart for them needs a mock-up before it goes on the page.")
    except Exception as e:  # ESA's archive not reachable: not a failure, tried again next run
        mex_note = ""
        print(f"Mars Express: ESA's archive not reachable ({e}); tried again next run.")

    sols_after = pd.read_csv(OUT / "sols.csv")["sol"] if (OUT / "sols.csv").exists() else pd.Series(dtype=int)
    new_sols = sorted(set(sols_after) - sols_before)
    check = {"checked": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
             "archive_chunks": len(chunks), "archive_last_chunk": chunks[-1] if chunks else None,
             "last_sol": int(sols_after.max()) if len(sols_after) else None,
             "processed_chunks": todo, "processed_uv_files": uv_todo,
             "new_sols": [new_sols[0], new_sols[-1], len(new_sols)] if new_sols else [],
             "errata_sha256": errata_sha, "errata_changed": errata_changed,
             "meda_processed_chunks": m_todo, "meda_new_sols": [m_new[0], m_new[-1], len(m_new)] if m_new else [],
             "meda_last_sol": max(m_after) if m_after else None,
             "mex_profiles": mex_profiles(mex_out)}
    (OUT / "last_check.json").write_text(json.dumps(check, indent=2) + "\n")

    notice = NOTICE
    lines = []
    if new_sols:
        lines += [f"New Curiosity weather data was released by NASA and added to the Mars Data page: sols "
                  f"{new_sols[0]}–{new_sols[-1]} ({len(new_sols)} sols).", ""]
    elif todo or uv_todo:
        lines += ["NASA replaced some files already on the Mars Data page; they were processed again.", ""]
    if todo or uv_todo:
        lines += ["Processed: " + ", ".join(todo + uv_todo) + ".", "",
                  "The cleaning report for each chunk is in `mars-data/data/rems/reports/`."]
    if m_new:
        lines += ["", f"New Perseverance weather data (MEDA) was added: sols {m_new[0]}–{m_new[-1]} ({len(m_new)} sols)."]
    if mex_note:
        lines += ["", mex_note]
    if errata_changed:
        lines += ["", "NASA's list of re-released files (ERRATA.TXT) has changed since the last check. Files released "
                  "again under the same name are not detected automatically; the list needs a review."]
    if lines:
        notice.write_text("\n".join(lines) + "\n\n---\nPosted by the Mars data job "
                          "(.github/workflows/mars-data.yml).\n")
    elif notice.exists():
        notice.unlink()
    print(json.dumps(check, indent=2))


if __name__ == "__main__":
    main()
