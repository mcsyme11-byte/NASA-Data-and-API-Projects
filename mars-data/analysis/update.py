# NASA and ESA Data Projects · Mars Data · automatic update from NASA's archive · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Run by the "Mars data" GitHub Actions job (.github/workflows/mars-data.yml). Finds what NASA has released or
# replaced since the last run and processes only that:
#   - chunk folders not processed yet;
#   - in the newest processed chunk, sols added since, or files replaced by a new version (a new file name);
#   - corrected UV files not processed yet.
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

import run_rems
import run_uv
from run_rems import BASE, OUT, get, listing

NOTICE = Path(os.environ.get("RUNNER_TEMP", "/tmp")) / "mars_update_notice.md"


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

    sols_after = pd.read_csv(OUT / "sols.csv")["sol"] if (OUT / "sols.csv").exists() else pd.Series(dtype=int)
    new_sols = sorted(set(sols_after) - sols_before)
    check = {"checked": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
             "archive_chunks": len(chunks), "archive_last_chunk": chunks[-1] if chunks else None,
             "last_sol": int(sols_after.max()) if len(sols_after) else None,
             "processed_chunks": todo, "processed_uv_files": uv_todo,
             "new_sols": [new_sols[0], new_sols[-1], len(new_sols)] if new_sols else [],
             "errata_sha256": errata_sha, "errata_changed": errata_changed}
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
