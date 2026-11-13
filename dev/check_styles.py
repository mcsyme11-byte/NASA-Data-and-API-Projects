#!/usr/bin/env python3
# NASA and ESA Data Projects · the style check · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Keeps every page on the shared component set (docs/DESIGN.md, decided Nov 13, 2026). Run by GitHub after every push
# (.github/workflows/checks.yml) and by hand:
#   python3 dev/check_styles.py        (exit 1 lists every problem)
#
# It checks that:
#   1. no page has a <style> block or a style="…" attribute (a page's look comes from shared/theme.css and, for the
#      inside of a tool, its project's style sheet; values worked out from data are set by the page's script);
#   2. every page links shared/theme.css and shared/footer.js, and every versioned style file with the same version tag;
#   3. no project style sheet redefines a shared component on its own (a rule such as ".btn { … }" or ".card { … }");
#      a project may only adjust a component inside its own parts (".mapbar .seg { … }", ".chip.play { … }").
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP = ('docs/', 'dev/', 'image-explorer/vendor/', 'shared/vendor/', 'node_modules/')
SKIP_FILES = {'mars-data/mockup.html'}           # a mock-up waiting for approval, not a page of the site
PROJECT_CSS = ['asteroid-tracker/tracker.css', 'image-explorer/explorer.css', 'mars-data/mars.css',
               'spacecraft/spacecraft.css', 'sky-finder/sky-finder.css']
# the shared components (shared/theme.css); a project style sheet may not restyle one of these by itself
SHARED = ['btn', 'chip', 'chips', 'card', 'cards', 'panel', 'panels', 'seg', 'tabs', 'notice', 'badge', 'badges', 'pill',
          'tag', 'stat', 'stats', 'tile', 'tiles', 'pagehead', 'phead', 'back', 'backlink', 'howto', 'section',
          'section-head', 'shead', 'footer', 'sitelinks', 'srcline', 'lede', 'kicker', 'eyebrow', 'bigsearch', 'qclear',
          'filters', 'periodbar', 'period', 'linkbtn', 'state', 'empty', 'loading', 'ctl', 'table', 'prose', 'list',
          'terms', 'sources', 'steps', 'split', 'legend', 'tip', 'note', 'caption', 'aside', 'lbl', 'wrap', 'topbar',
          'nav', 'brand', 'more', 'viewhead', 'actions', 'field', 'sr', 'hscroll', 'callout', 'stage', 'medal']

def tracked():
    out = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'], cwd=ROOT,
                         capture_output=True, text=True, check=True).stdout.split('\n')
    return [f for f in out if f and not f.startswith(SKIP) and f not in SKIP_FILES]

def main():
    problems = []
    files = tracked()
    pages = [f for f in files if f.endswith('.html')]
    tags = {}
    for f in pages:
        s = open(os.path.join(ROOT, f), encoding='utf-8').read()
        in_script = False
        for n, line in enumerate(s.split('\n'), 1):
            # a page's own script may set values worked out from data (a chart key's colour); markup may not
            opened, closed = len(re.findall(r'<script\b', line)), len(re.findall(r'</script>', line))
            check = not in_script and not (opened and not closed)
            in_script = (in_script or opened > closed) and not (closed >= opened and closed > 0)
            if not check:
                continue
            if re.search(r'<style[\s>]', line):
                problems.append(f'{f}:{n}: a <style> block (use shared/theme.css or the project style sheet)')
            if re.search(r'\sstyle="', line):
                problems.append(f'{f}:{n}: a style="…" attribute: {line.strip()[:100]}')
        if not re.search(r'shared/theme\.css\?v=\d+', s):
            problems.append(f'{f}: does not link shared/theme.css with a version tag')
        if not re.search(r'shared/footer\.js\?v=\d+', s):
            problems.append(f'{f}: does not load shared/footer.js with a version tag')
        for m in re.finditer(r'(theme\.css|footer\.js|tracker\.css|explorer\.css|mars\.css|spacecraft\.css)\?v=(\d+)', s):
            tags.setdefault(m.group(2), []).append(f'{f} ({m.group(1)})')
    if len(tags) > 1:
        newest = max(tags)
        for v, where in sorted(tags.items()):
            if v != newest:
                for w in where:
                    problems.append(f'{w}: version tag {v}, not the current {newest} (raise it in every page)')
    for f in PROJECT_CSS:
        p = os.path.join(ROOT, f)
        if not os.path.exists(p):
            continue
        css = re.sub(r'/\*.*?\*/', '', open(p, encoding='utf-8').read(), flags=re.S)
        for m in re.finditer(r'(^|[}\n])\s*([^{}@]+?)\s*\{', css):
            for sel in m.group(2).split(','):
                sel = sel.strip()
                k = re.fullmatch(r'\.([a-z][\w-]*)(:hover|:focus|:active|:focus-visible)?', sel)
                if k and k.group(1) in SHARED:
                    line = css[:m.start(2)].count('\n') + 1
                    problems.append(f'{f}:{line}: restyles the shared component .{k.group(1)} on its own '
                                    f'(adjust it inside the tool\'s own parts, or change shared/theme.css)')
    if problems:
        print('Style check: problems found\n')
        print('\n'.join(problems))
        print('\nThe rules are in docs/DESIGN.md ("Components" and "Page styles").')
        sys.exit(1)
    print('Style check: no problems.')

if __name__ == '__main__':
    main()
