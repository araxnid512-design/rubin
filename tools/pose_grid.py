#!/usr/bin/env python3
"""Собирает docs/poses/<класс>_NN.png в лист 5×4 → docs/screenshots/poses_<класс>.png"""
import sys, glob, os
from PIL import Image
root = sys.argv[1] if len(sys.argv) > 1 else "docs"
for cls in ["pistol", "smg", "rifle", "sniper", "shotgun", "mg", "launcher"]:
    files = sorted(glob.glob(f"{root}/poses/{cls}_*.png"))
    if not files:
        continue
    tw, th = 360, 405
    sheet = Image.new("RGB", (5 * tw, 4 * th), (40, 40, 40))
    for i, f in enumerate(files[:20]):
        im = Image.open(f).convert("RGB")
        w, h = im.size
        # центральная часть кадра с персонажем
        cw = int(h * tw / th)
        im = im.crop(((w - cw) // 2, 0, (w + cw) // 2, h)).resize((tw - 4, th - 4))
        sheet.paste(im, ((i % 5) * tw + 2, (i // 5) * th + 2))
    os.makedirs(f"{root}/screenshots", exist_ok=True)
    out = f"{root}/screenshots/poses_{cls}.jpg"
    sheet.save(out, quality=86, optimize=True)
    print(out)
