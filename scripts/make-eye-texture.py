"""Делает мутные глаза зомби из текстуры глаз MakeHuman (CC0).

Запуск: python3 scripts/make-eye-texture.py <путь>/brown_eye.png assets/zombie_eye.png
"""
import sys
from PIL import Image, ImageFilter
import colorsys

src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGBA')
px = im.load()
w, h = im.size
for y in range(h):
    for x in range(w):
        r, g, b, a = px[x, y]
        hh, ss, vv = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
        if (ss > 0.35 and vv < 0.75) or vv < 0.2:
            # радужка/зрачок: молочная плёнка, едва заметный серо-голубой цвет
            k = 0.82
            tr, tg, tb = 0.70, 0.73, 0.71
            l = 0.5 + vv * 0.3
            nr = (r / 255) * (1 - k) + tr * l * k * 1.4
            ng = (g / 255) * (1 - k) + tg * l * k * 1.4
            nb = (b / 255) * (1 - k) + tb * l * k * 1.4
        else:
            # белок: желтоватый, с красными прожилками сильнее
            red = max(0.0, (r - g) / 255) * 2.5
            nr = min(1, r / 255 * 0.95 + red * 0.25)
            ng = g / 255 * 0.86 - red * 0.15
            nb = b / 255 * 0.62 - red * 0.15
        px[x, y] = (int(max(0, min(1, nr)) * 255), int(max(0, min(1, ng)) * 255), int(max(0, min(1, nb)) * 255), a)
im = im.filter(ImageFilter.GaussianBlur(1.2))
im.save(dst, optimize=True)
