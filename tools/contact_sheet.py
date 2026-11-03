#!/usr/bin/env python3
"""Собирает кадры docs/rigtest в контактные листы."""
import sys, glob, os
from PIL import Image
src = sys.argv[1]; out = sys.argv[2]; pattern = sys.argv[3] if len(sys.argv) > 3 else "*.png"
files = sorted(glob.glob(os.path.join(src, pattern)))
cols = int(sys.argv[4]) if len(sys.argv) > 4 else 4
if not files:
    print('no files'); sys.exit(0)
tw, th = 480, 270
rows = (len(files) + cols - 1) // cols
sheet = Image.new("RGB", (cols * tw, rows * th), (30, 30, 30))
for i, f in enumerate(files):
    im = Image.open(f).convert("RGB").resize((tw, th))
    sheet.paste(im, ((i % cols) * tw, (i // cols) * th))
sheet.save(out)
print(out, len(files))
