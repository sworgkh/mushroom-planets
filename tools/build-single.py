#!/usr/bin/env python3
"""Fold the project into one self-contained HTML file showing the three planets.

Every module under lib/ and scenes/ is embedded as a data: URL in the import
map (relative imports are rewritten to bare 'sk/...' specifiers), so the page
needs no other files from this repo. three.js itself still comes from the CDN.

    python3 tools/build-single.py      # writes dist/three-planets.html
"""
import base64, pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / 'dist' / 'three-planets.html'
MODULES = sorted([*ROOT.glob('lib/*.js'), *ROOT.glob('scenes/*.js')])

def bare(path: pathlib.Path) -> str:
    return 'sk/' + path.relative_to(ROOT).as_posix()

def rewrite(src: str, path: pathlib.Path) -> str:
    def fix(m):
        spec = m.group(2)
        if spec.startswith('.'):
            spec = bare((path.parent / spec).resolve())
        return f"{m.group(1)}'{spec}'"
    return re.sub(r"(from\s*)'([^']+)'", fix, src)

imports = {
    'three': 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js',
    'three/addons/': 'https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/',
}
for p in MODULES:
    src = rewrite(p.read_text(), p)
    imports[bare(p)] = 'data:text/javascript;base64,' + base64.b64encode(src.encode()).decode()

import json
importmap = json.dumps({'imports': imports}, indent=1)

page = (ROOT / 'tools' / 'single.template.html').read_text().replace('/*IMPORTMAP*/', importmap)
OUT.write_text(page)
print(f'wrote {OUT.name}: {OUT.stat().st_size // 1024} KB, {len(MODULES)} modules embedded')
