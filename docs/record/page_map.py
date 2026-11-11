#!/usr/bin/env python3
# NASA and ESA Data Projects · Project Record · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Measures which page each Part and chapter starts on, for the record's contents: reads the bookmarks of a first
# build turned into a PDF (LibreOffice exports each bookmark as a named destination) and numbers the pages from the
# first Part, as the record's own page numbers do.
#   python3 -I page_map.py <first build.pdf> <heads.json> <out toc.json>

import json
import sys

from pypdf import PdfReader


def main():
    pdf, heads_path, out = sys.argv[1:4]
    heads = json.load(open(heads_path, encoding="utf-8"))
    reader = PdfReader(pdf)
    where = {}
    for name, dest in reader.named_destinations.items():
        # LibreOffice writes "_Toc…" as "/5FToc…" (the underscore as its hex code)
        key = str(name).lstrip("/")
        if key.startswith("5F") or key.startswith("#5F"):
            key = "_" + key.split("5F", 1)[1]
        if key.startswith("_Toc"):
            try:
                where[key] = reader.get_destination_page_number(dest)
            except Exception:
                pass
    if not heads or heads[0]["href"] not in where:
        sys.exit("page_map: the first Part's bookmark is not in the PDF")
    first = where[heads[0]["href"]]
    toc = [{"href": h["href"], "page": where[h["href"]] - first + 1} for h in heads if h["href"] in where]
    json.dump(toc, open(out, "w", encoding="utf-8"))
    print("contents: %d of %d headings placed; the body runs to page %d" % (len(toc), len(heads), len(reader.pages) - first))


if __name__ == "__main__":
    main()
