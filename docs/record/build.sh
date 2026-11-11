#!/bin/sh
# NASA and ESA Data Projects · Project Record · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Rebuilds "docs/NASA and ESA Data Projects - Project Record.pdf" from the repository (laid out as a Word document in a
# temporary folder, then made into the PDF; only the PDF is kept). GitHub runs this after every push to main
# (.github/workflows/project-record.yml); by hand, only if that run failed:   sh docs/record/build.sh
# Needs: python3 with pypdf and fontTools, node with the npm packages "docx" and "marked", and LibreOffice (soffice).
# Use a clone with full history: a shallow clone cuts the Repository History chapter short.
# Fails if a personal detail (a personal folder path, an e-mail address other than the developer's and the agencies'
# public contact addresses) would end up in the record.
set -e
HERE=$(cd "$(dirname "$0")" && pwd)
ROOT=$(cd "$HERE/../.." && pwd)
WORK=$(mktemp -d)
OUT="$WORK/record.docx"
PDF="$ROOT/docs/NASA and ESA Data Projects - Project Record.pdf"
trap 'rm -rf "$WORK"' EXIT

sh "$HERE/fonts.sh"
if [ "$(git -C "$ROOT" rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
  echo "note: this is a shallow clone; the Repository History chapter will be incomplete"
fi
if [ -n "$(git -C "$ROOT" status --porcelain -- . ':!docs/NASA and ESA Data Projects - Project Record.pdf' 2>/dev/null)" ]; then
  echo "note: the repository has uncommitted changes; commit them first so this edition names the commit it was built from"
fi
python3 -I "$HERE/export_extras.py" "$ROOT" "$WORK/extras.json"

export NODE_PATH="$(npm root -g):/opt/npm-tools/node_modules:${NODE_PATH:-}"
PDFOPT='pdf:writer_pdf_Export:{"ExportBookmarksToPDFDestination":{"type":"boolean","value":"true"}}'
# first build, laid out by LibreOffice to measure where each Part and chapter starts (Georgia is measured with
# Gelasio, its metric twin, when installed); then the real build, with those page numbers in the contents
TOC="-"
if command -v soffice >/dev/null 2>&1; then
  node "$HERE/build_record.js" "$ROOT" "$WORK/extras.json" "$WORK/pass1.docx" - >/dev/null
  soffice --headless --convert-to "$PDFOPT" --outdir "$WORK" "$WORK/pass1.docx" >/dev/null 2>&1 || true
  if [ -f "$WORK/pass1.pdf" ] && python3 -I "$HERE/page_map.py" "$WORK/pass1.pdf" "$WORK/pass1.docx.heads.json" "$WORK/toc.json"; then TOC="$WORK/toc.json"; fi
fi
[ "$TOC" = "-" ] && echo "contents: page numbers not measured; Word fills them in when the record is opened"
node "$HERE/build_record.js" "$ROOT" "$WORK/extras.json" "$OUT" - "$TOC"
rm -f "$OUT.heads.json"

# personal-details check: no personal folder paths, and no e-mail address but the developer's and the agencies'
# public contact addresses quoted in the data-source notes
TEXT="$WORK/text"
( cd "$WORK" && unzip -o -q "$OUT" word/document.xml && sed -e 's/<[^>]*>/ /g' word/document.xml > "$TEXT" )
if grep -n -i -E 'C:\\Users\\[A-Za-z0-9]|/Users/[A-Za-z0-9]|/home/[a-z][a-z0-9_-]*/' "$TEXT" | grep -v -E '/home/(claude|user)/' >/dev/null; then
  echo "STOP: a personal folder path is in the record:"; grep -o -i -E '.{40}(C:.Users|/Users/|/home/).{40}' "$TEXT" | head; exit 1
fi
OTHER=$(grep -o -E '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' "$TEXT" | sort -u \
  | grep -v -x -E 'mcsyme11@gmail\.com|noreply@anthropic\.com|jsc-earthweb@mail\.nasa\.gov|neocc@esa\.int' || true)
if [ -n "$OTHER" ]; then echo "STOP: an e-mail address other than the developer's is in the record: $OTHER"; exit 1; fi
echo "personal-details check: OK"

# the record as a PDF (the only copy kept: it opens on any device)
rm -f "$WORK/record.pdf"
if soffice --headless --convert-to "$PDFOPT" --outdir "$WORK" "$WORK/record.docx" >/dev/null 2>&1 && [ -s "$WORK/record.pdf" ]; then
  mv "$WORK/record.pdf" "$PDF"; echo "wrote $PDF ($(( $(wc -c < "$PDF") / 1024 )) KB)"
else echo "STOP: the PDF couldn't be made"; exit 1; fi
