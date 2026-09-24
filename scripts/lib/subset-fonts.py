"""Subset the self-hosted fonts to the characters this site uses.

Run once when fonts change:  python3 scripts/lib/subset-fonts.py
Reads the latin woff2 files from node_modules/@fontsource-variable and writes
public/assets/fonts/inter-tight-subset.woff2 and inter-subset.woff2.
Keeps the wght axis (Inter Tight 300 to 700, Inter 400 to 700).
Requires fontTools and brotli (pip install fonttools brotli).
"""
import os
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
SRC = os.path.join(ROOT, 'node_modules', '@fontsource-variable')
OUT = os.path.join(ROOT, 'public', 'assets', 'fonts')
# Printable ASCII plus a few typographic marks the templates may use.
EXTRA = [0x00A0, 0x00A9, 0x00B7, 0x2019, 0x2018, 0x201C, 0x201D, 0x2022, 0x2026, 0x2192]
UNICODES = list(range(0x20, 0x7F)) + EXTRA

JOBS = [
    ('inter-tight/files/inter-tight-latin-wght-normal.woff2', 'inter-tight-subset.woff2', (300, 700)),
    ('inter/files/inter-latin-wght-normal.woff2', 'inter-subset.woff2', (400, 700)),
]

os.makedirs(OUT, exist_ok=True)
for src, dest, (lo, hi) in JOBS:
    font = TTFont(os.path.join(SRC, src), lazy=False)
    opts = subset.Options()
    opts.flavor = 'woff2'
    opts.layout_features = ['kern', 'liga', 'calt', 'tnum', 'case', 'ss01', 'cv05', 'cv11']
    opts.name_IDs = ['*']
    opts.notdef_outline = True
    sub = subset.Subsetter(opts)
    sub.populate(unicodes=UNICODES)
    sub.subset(font)
    font = instancer.instantiateVariableFont(font, {'wght': (lo, hi)})
    path = os.path.join(OUT, dest)
    font.flavor = 'woff2'
    font.save(path)
    print(dest, os.path.getsize(path), 'bytes')
