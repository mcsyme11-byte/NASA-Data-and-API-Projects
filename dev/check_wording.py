#!/usr/bin/env python3
# NASA Data Projects · the wording and secrets check · © 2026 Malcolm Syme · mcsyme11@gmail.com
#
# Checks the repository against CLAUDE.md's rules: neutral wording ("the developer", never a first name on its own),
# no chat narrating its own work, no chat tone, no personal paths or user names, and no NASA API key in any file (the repository is
# public). Run by GitHub after every push (.github/workflows/checks.yml) and by hand:
#   python3 dev/check_wording.py        (exit 1 lists every problem)
# Left out on purpose: docs/CLAUDE-PROJECT-SETUP.md (the Claude project's instructions, kept word for word).
import os, re, subprocess, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TEXT = ('.md', '.txt', '.py', '.js', '.mjs', '.html', '.css', '.yml', '.yaml', '.sh', '.json', '.csv', '.svg',
        '.ipynb', '.example', '.gitignore')
SKIP_DIRS = ('node_modules/', '.git/')
SKIP_FILES = {'dev/check_wording.py',            # it names the patterns it looks for
              'docs/CLAUDE-PROJECT-SETUP.md'}    # the Claude project's instructions, word for word

RULES = [
    # a first name on its own (the credit "Malcolm Syme" is fine everywhere)
    ('first name', re.compile(r'\bMalcolm\b(?!\s+Syme)'), set()),
    # a chat narrating its work in a document ("Claude copies", "Claude will"); product names are fine
    ('chat narration', re.compile(r'\bClaude\s+(copies|copied|runs|ran|installs|installed|will|wrote|writes|did|does|'
                                  r'checks|checked|built|builds|made|makes|moved|fixed|added|asks|asked|reads|read|'
                                  r'says|said|thinks|tried)\b'), {'CLAUDE.md'}),
    # the tone of an AI assistant talking to a person (decided Nov 8, 2026: documentation is professional)
    ('chat tone', re.compile(r"(?i)\b(I'll|I've|I'm|we'll|we've|let's|happy to help|feel free|great question|"
                             r"hope this helps|let me know|sounds good)\b|^\s*(hi|hey|hello)\b"), {'CLAUDE.md'}),
    # personal paths and user names
    ('personal path', re.compile(r'(?i)\bmcsym\b|C:\\Users\\(?!Pilot\\|User\\)|/Users/(?!user/)|/home/(?!claude/|user/)'), set()),
    # a NASA API key (a long letters-and-digits value given to api_key / NASA_API_KEY); DEMO_KEY is fine
    ('API key', re.compile(r'(?i)(api_key|nasa_api_key|apikey)\s*["\']?\s*[=:]\s*["\']?(?!DEMO_KEY|your_key_here)[A-Za-z0-9]{30,}'), set()),
]

def files():
    if '--files' in sys.argv:
        out = sys.argv[sys.argv.index('--files') + 1:]
    else:
        out = subprocess.run(['git', 'ls-files', '--cached', '--others', '--exclude-standard'],
                             cwd=ROOT, capture_output=True, text=True, check=True).stdout.split('\n')
    for f in out:
        if f and (f.endswith(TEXT) or os.path.basename(f).startswith('.env')) \
                and not f.startswith(SKIP_DIRS) and f not in SKIP_FILES:
            yield f

def main():
    problems = []
    for f in files():
        try:
            lines = open(os.path.join(ROOT, f), encoding='utf-8', errors='replace').read().split('\n')
        except (OSError, IsADirectoryError):
            continue
        for n, line in enumerate(lines, 1):
            for name, rx, allowed in RULES:
                if f in allowed:
                    continue
                if rx.search(line):
                    shown = line.strip()[:140] if name != 'API key' else '(value hidden)'
                    problems.append('%s:%d  %s  "%s"' % (f, n, name, shown))
    if problems:
        print('Check: %d problem%s (see CLAUDE.md):' % (len(problems), '' if len(problems) == 1 else 's'))
        print('\n'.join(problems))
        return 1
    print('Check: no problems.')
    return 0

sys.exit(main())
