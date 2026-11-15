#!/usr/bin/env python3
"""Лист снимков стенда: строки — движения, столбцы — виды (a — спереди-сбоку, b — слева, c — руки).
Запуск: python3 tools/sheet.py папка выход.png [id,id,...] [момент 0|1] [ширина кадра]"""
import sys, os
from PIL import Image, ImageDraw
d, out = sys.argv[1], sys.argv[2]
ids = sys.argv[3].split(',') if len(sys.argv) > 3 and sys.argv[3] else sorted({f.rsplit('_', 1)[0] for f in os.listdir(d) if f.endswith('.png')})
m = sys.argv[4] if len(sys.argv) > 4 else '0'
w = int(sys.argv[5]) if len(sys.argv) > 5 else 480
h = w * 720 // 1280
views = sys.argv[6] if len(sys.argv) > 6 else 'abcd'
sheet = Image.new('RGB', (w * len(views), h * len(ids)), (20, 20, 24))
dr = ImageDraw.Draw(sheet)
for r, i in enumerate(ids):
    for c, v in enumerate(views):
        p = os.path.join(d, f'{i}_{m}{v}.png')
        if os.path.exists(p):
            im = Image.open(p).convert('RGB')
            sheet.paste(im.resize((w, h), Image.LANCZOS), (c * w, r * h))
    dr.text((6, r * h + 4), i, fill=(255, 230, 120))
sheet.save(out)
print(out, sheet.size)
