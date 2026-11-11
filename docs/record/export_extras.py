#!/usr/bin/env python3
# NASA and ESA Data Projects · Project Record · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Collects the parts of the Project Record that aren't Markdown files: the repository's history (git), the site's own
# pages (About, Privacy, Terms of use, Credits, Contact: their HTML turned into Markdown) and the working rules
# (CLAUDE.md, from "Standing rules" up to "Running").
# The history leaves out the daily data updates (automatic commits that change only data files) and the record's own
# rebuilds; it counts them instead, so the list stays readable.
#   python3 -I export_extras.py <repo root> <out.json>

import html
import json
import os
import re
import subprocess
import sys

# commits made by the automatic jobs that only refresh data (asteroid data, astronaut photos, places, Mars data)
DATA_UPDATE = re.compile(r"^(Asteroid data: daily|Astronaut photos: |Image Explorer data: |Mars data: (daily|update)|"
                         r"Places: |Data update)", re.I)
RECORD_REBUILD = re.compile(r"^Project Record rebuilt( \(.*\)| for .*)?$")

PAGES = [
    ("About", "about/index.html"),
    ("Privacy", "privacy/index.html"),
    ("Terms of use", "terms/index.html"),
    ("Credits", "credits/index.html"),
    ("Contact", "contact/index.html"),
]


def git(root, *args):
    return subprocess.run(["git", "-C", root] + list(args), capture_output=True, text=True, check=True).stdout


def inline(h):
    h = re.sub(r"<(strong|b)>(.*?)</\1>", r"**\2**", h, flags=re.S)
    h = re.sub(r"<(em|i)>(.*?)</\1>", r"*\2*", h, flags=re.S)
    h = re.sub(r'<a [^>]*href="mailto:([^"?]+)[^"]*"[^>]*>.*?</a>', r"\1", h, flags=re.S)
    h = re.sub(r'<a [^>]*href="([^"]+)"[^>]*>(.*?)</a>', r"[\2](\1)", h, flags=re.S)
    h = re.sub(r"<br\s*/?>", " ", h)
    h = re.sub(r"<[^>]+>", "", h)
    return re.sub(r"\s+", " ", html.unescape(h)).strip()


def table(m):
    rows = re.findall(r"<tr>(.*?)</tr>", m.group(1), re.S)
    out = []
    for i, r in enumerate(rows):
        cells = [inline(c).replace("|", "/") for c in re.findall(r"<t[hd][^>]*>(.*?)</t[hd]>", r, re.S)]
        out.append("| " + " | ".join(cells) + " |")
        if i == 0:
            out.append("|" + "---|" * len(cells))
    return "\n\n" + "\n".join(out) + "\n\n"


def page_to_md(h):
    """The site's reading pages: <main> without the Back button, the footer, scripts, styles and decorations."""
    m = re.search(r"<main[^>]*>(.*)</main>", h, re.S)
    h = m.group(1) if m else h
    h = re.sub(r"<footer.*?</footer>", "", h, flags=re.S)
    h = re.sub(r"<(script|style|svg)\b.*?</\1>", "", h, flags=re.S)
    h = re.sub(r'<a class="backlink".*?</a>', "", h, flags=re.S)
    h = re.sub(r'<div class="eyebrow">.*?</div>', "", h, flags=re.S)
    h = re.sub(r'<div class="(?:tablewrap)?">', "", h)
    h = re.sub(r"<table[^>]*>(.*?)</table>", table, h, flags=re.S)
    h = re.sub(r"<h1[^>]*>(.*?)</h1>", lambda x: "\n\n# " + inline(x.group(1)) + "\n\n", h, flags=re.S)
    h = re.sub(r"<h2[^>]*>(.*?)</h2>", lambda x: "\n\n## " + inline(x.group(1)) + "\n\n", h, flags=re.S)
    h = re.sub(r"<h3[^>]*>(.*?)</h3>", lambda x: "\n\n### " + inline(x.group(1)) + "\n\n", h, flags=re.S)
    h = re.sub(r"<li[^>]*>(.*?)</li>", lambda x: "\n- " + inline(x.group(1)), h, flags=re.S)
    h = re.sub(r"</?(ul|ol)[^>]*>", "\n\n", h)
    h = re.sub(r'<p class="updated">(.*?)</p>', lambda x: "\n\n*" + inline(x.group(1)) + "*\n\n", h, flags=re.S)
    h = re.sub(r"<p[^>]*>(.*?)</p>", lambda x: "\n\n" + inline(x.group(1)) + "\n\n", h, flags=re.S)
    # cards and buttons (the Contact page): one line each
    h = re.sub(r'<a [^>]*class="card topic"[^>]*>(.*?)</a>',
               lambda x: "\n- " + " · ".join(inline(t) for t in re.findall(r"<span[^>]*>(.*?)</span>", x.group(1), re.S)), h, flags=re.S)
    h = re.sub(r'<a [^>]*class="(?:email|btn[^"]*)"[^>]*>(.*?)</a>', lambda x: "\n\n" + inline(x.group(1)) + "\n\n", h, flags=re.S)
    h = re.sub(r"<button[^>]*>.*?</button>", "", h, flags=re.S)
    h = re.sub(r'<span class="(?:aside|label)">(.*?)</span>', lambda x: " *" + inline(x.group(1)) + "*", h, flags=re.S)
    h = re.sub(r"<[^>]+>", "", h)
    h = html.unescape(h)
    lines = [ln.strip() for ln in h.split("\n")]
    h = "\n".join(lines)
    return re.sub(r"\n{3,}", "\n\n", h).strip() + "\n"


def main():
    root, out = sys.argv[1], sys.argv[2]

    commit = git(root, "rev-parse", "--short", "HEAD").strip()
    date = git(root, "log", "-1", "--format=%cs").strip()
    log, data_count, total = [], 0, 0
    for line in git(root, "log", "--no-merges", "--format=%cs\t%h\t%s").splitlines():
        d, h, s = line.split("\t", 2)
        if RECORD_REBUILD.match(s):
            continue
        total += 1
        if DATA_UPDATE.match(s):
            data_count += 1
            continue
        log.append([d, h, s])

    legal, legal_src = [], {}
    for title, rel in PAGES:
        p = os.path.join(root, rel)
        if os.path.exists(p):
            legal.append([title, page_to_md(open(p, encoding="utf-8").read())])
            legal_src[title] = rel

    claude = open(os.path.join(root, "CLAUDE.md"), encoding="utf-8").read()
    m = re.search(r"## Standing rules\n(.*?)\n## Running", claude, re.S)
    rules = m.group(1).strip() if m else ""

    json.dump({"commit": commit, "date": date, "count": total, "dataCount": data_count, "log": log,
               "legal": legal, "legalSrc": legal_src, "rules": rules},
              open(out, "w", encoding="utf-8"), ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
