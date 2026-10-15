#!/usr/bin/env python3
"""Builds the Claude artifact version of the game.

index.html is a full page for GitHub Pages and the installed app. The Claude
artifact viewer wraps pages in its own document, so it wants a fragment:
the <title>, font links and <style>, then the body. App-only tags (manifest,
icons, viewport) are left out because the viewer supplies its own.

Usage: python3 tools/build-artifact.py <output.html>
"""
import re
import sys

src = open('index.html', encoding='utf-8').read()
head = src[src.index('<head>') + 6:src.index('</head>')]
body = src[src.index('<body>') + 6:src.rindex('</body>')]
keep = []
for line in head.strip().splitlines():
    if re.search(r'<meta |rel="manifest"|rel="icon"|rel="apple-touch-icon"', line):
        continue
    keep.append(line)
open(sys.argv[1], 'w', encoding='utf-8').write('\n'.join(keep) + '\n' + body.strip() + '\n')
print('wrote', sys.argv[1])
