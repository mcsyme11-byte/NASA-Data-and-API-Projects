#!/bin/sh
# NASA and ESA Data Projects · Project Record · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Best effort, for the build machine only: the record is set in Georgia, which Linux doesn't have. Gelasio (SIL Open
# Font License) has Georgia's exact letter widths, so LibreOffice lays the pages out as Word does and the contents'
# page numbers come out right. Fetches it from npm (@fontsource/gelasio), turns it into TrueType for this user and
# tells fontconfig to use it for Georgia. Does nothing if Gelasio is already installed.
fc-list 2>/dev/null | grep -q -i gelasio && exit 0
T=$(mktemp -d); trap 'rm -rf "$T"' EXIT
( cd "$T" && npm pack @fontsource/gelasio@5.2.5 >/dev/null 2>&1 && tar xzf fontsource-gelasio-*.tgz ) || { echo "fonts: Gelasio not available (page numbers in the contents may be a little off)"; exit 0; }
mkdir -p "$HOME/.local/share/fonts" "$HOME/.config/fontconfig"
python3 -I - "$T/package/files" "$HOME/.local/share/fonts" <<'PY' || exit 0
import os, sys
from fontTools.ttLib import TTFont
from fontTools.merge import Merger
src, dst = sys.argv[1], sys.argv[2]
for w in ("400", "700"):
    for st in ("normal", "italic"):
        parts = []
        for sub in ("latin", "latin-ext"):
            f = TTFont(os.path.join(src, "gelasio-%s-%s-%s.woff" % (sub, w, st))); f.flavor = None
            p = os.path.join(src, "%s-%s-%s.ttf" % (sub, w, st)); f.save(p); parts.append(p)
        m = Merger().merge(parts)
        # Gelasio matches Georgia's letter widths; its line height is a little taller, so give it Georgia's
        h, o = m["hhea"], m["OS/2"]
        h.ascent, h.descent, h.lineGap = 1878, -449, 0
        o.sTypoAscender, o.sTypoDescender, o.sTypoLineGap, o.usWinAscent, o.usWinDescent = 1878, -449, 0, 1878, 449
        m.save(os.path.join(dst, "Gelasio-%s-%s.ttf" % (w, st)))
PY
CONF="$HOME/.config/fontconfig/fonts.conf"
if [ ! -f "$CONF" ]; then
  cat > "$CONF" <<'XML'
<?xml version="1.0"?><!DOCTYPE fontconfig SYSTEM "fonts.dtd">
<fontconfig>
  <alias binding="same"><family>Georgia</family><prefer><family>Gelasio</family></prefer></alias>
</fontconfig>
XML
fi
fc-cache -f >/dev/null 2>&1
echo "fonts: Gelasio installed for Georgia"
