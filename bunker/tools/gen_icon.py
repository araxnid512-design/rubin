#!/usr/bin/env python3
"""Иконка BUNKER SURVIVAL (собственная отрисовка): круглая гермодверь бункера с болтами, жёлто-чёрное кольцо
опасности, знак радиации в центре, тёмный фон. Делает значки Android всех плотностей (обычный и адаптивный —
передний план и фон) и icon.png проекта. Запуск: python3 tools/gen_icon.py"""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
S = 1024
rng = np.random.default_rng(3)


def radial(size, c0, c1, center=(0.5, 0.42)):
    y, x = np.mgrid[0:size, 0:size] / size
    r = np.clip(np.hypot(x - center[0], y - center[1]) / 0.75, 0, 1)[..., None]
    return (np.array(c0) * (1 - r) + np.array(c1) * r)


def background(size):
    img = radial(size, (52, 56, 40), (12, 13, 9))
    n = rng.random((size // 8, size // 8))
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC), dtype=float) / 255
    img = img * (0.88 + n[..., None] * 0.2)
    return Image.fromarray(np.clip(img, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def metal_disc(size, r, c0, c1):
    """диск с вертикальным градиентом «стали»"""
    d = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    y = np.linspace(0, 1, size)[:, None]
    grad = np.array(c0) * (1 - y[..., None]) + np.array(c1) * y[..., None]
    grad = np.repeat(grad, size, axis=1)
    m = Image.new("L", (size, size), 0)
    ImageDraw.Draw(m).ellipse([size / 2 - r, size / 2 - r, size / 2 + r, size / 2 + r], fill=255)
    d = Image.fromarray(np.clip(grad, 0, 255).astype(np.uint8), "RGB").convert("RGBA")
    d.putalpha(m)
    return d


def door(size):
    """гермодверь на прозрачном фоне, занимает ~78% ширины"""
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    c = size / 2
    R = size * 0.39
    # тень под дверью
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([c - R, c - R + size * 0.025, c + R, c + R + size * 0.025], fill=(0, 0, 0, 170))
    im.alpha_composite(sh.filter(ImageFilter.GaussianBlur(size * 0.02)))
    # внешнее кольцо рамы
    im.alpha_composite(metal_disc(size, R, (150, 152, 148), (62, 64, 62)))
    # кольцо опасности: жёлто-чёрные косые полосы
    hz = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hz)
    stripes = Image.new("RGBA", (size, size), (225, 172, 30, 255))
    sd = ImageDraw.Draw(stripes)
    w = size * 0.06
    for k in range(-30, 30):
        x0 = k * w * 2
        sd.polygon([(x0, 0), (x0 + w, 0), (x0 + w + size, size), (x0 + size, size)], fill=(24, 22, 18, 255))
    ring = Image.new("L", (size, size), 0)
    rd = ImageDraw.Draw(ring)
    r1, r2 = R * 0.9, R * 0.74
    rd.ellipse([c - r1, c - r1, c + r1, c + r1], fill=255)
    rd.ellipse([c - r2, c - r2, c + r2, c + r2], fill=0)
    stripes.putalpha(ring)
    im.alpha_composite(stripes)
    # тонкие тёмные кромки кольца
    d = ImageDraw.Draw(im)
    for rr, wd in [(r1, int(size * 0.008)), (r2, int(size * 0.008)), (R, int(size * 0.01))]:
        d.ellipse([c - rr, c - rr, c + rr, c + rr], outline=(20, 20, 18, 255), width=wd)
    # болты по раме
    for i in range(16):
        a = i / 16 * math.tau
        bx, by = c + math.cos(a) * R * 0.95, c + math.sin(a) * R * 0.95
        br = size * 0.016
        d.ellipse([bx - br, by - br + 2, bx + br, by + br + 2], fill=(25, 25, 23, 255))
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=(178, 178, 172, 255))
        d.ellipse([bx - br * 0.45, by - br * 0.65, bx + br * 0.2, by - br * 0.1], fill=(230, 230, 225, 255))
    # центральная створка
    im.alpha_composite(metal_disc(size, r2 * 0.98, (118, 120, 116), (48, 50, 48)))
    # знак радиации: чёрный круг, жёлтые лопасти
    cr = r2 * 0.78
    d.ellipse([c - cr, c - cr, c + cr, c + cr], fill=(232, 182, 34, 255), outline=(20, 20, 18, 255), width=int(size * 0.012))
    tre = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    td = ImageDraw.Draw(tre)
    ro, ri = cr * 0.86, cr * 0.26
    for k in range(3):
        a0 = -90 + k * 120 - 30
        td.pieslice([c - ro, c - ro, c + ro, c + ro], a0, a0 + 60, fill=(22, 20, 16, 255))
    td.ellipse([c - ri, c - ri, c + ri, c + ri], fill=(232, 182, 34, 255))
    td.ellipse([c - ri * 0.62, c - ri * 0.62, c + ri * 0.62, c + ri * 0.62], fill=(22, 20, 16, 255))
    im.alpha_composite(tre)
    # потёртости и ржавчина поверх
    n = rng.random((size // 24, size // 24))
    n = np.asarray(Image.fromarray((n * 255).astype(np.uint8)).resize((size, size), Image.BICUBIC), dtype=float) / 255
    arr = np.asarray(im, dtype=float)
    k = np.clip((n - 0.6) / 0.25, 0, 1)[..., None]          # мягкие пятна ржавчины
    arr[..., :3] *= (1 - k) + k * np.array([0.78, 0.62, 0.48])[None, None, :]
    arr[..., :3] *= (0.94 + n[..., None] * 0.1)
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")


def rounded(img, radius):
    m = Image.new("L", img.size, 0)
    ImageDraw.Draw(m).rounded_rectangle([0, 0, img.size[0] - 1, img.size[1] - 1], radius=radius, fill=255)
    out = img.copy()
    out.putalpha(m)
    return out


def save(img, path, px):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    img.resize((px, px), Image.LANCZOS).save(path)


bg = background(S)
dr = door(S)
full = bg.copy()
full.alpha_composite(dr)
legacy = rounded(full, int(S * 0.18))
# адаптивная иконка: передний план 108 dp, видимая часть — центральные 72 dp; дверь уменьшаем до этой зоны
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
small = dr.resize((int(S * 0.74), int(S * 0.74)), Image.LANCZOS)
fg.alpha_composite(small, ((S - small.width) // 2, (S - small.height) // 2))
dens = {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}
for k, m in dens.items():
    save(legacy, os.path.join(RES, f"mipmap-{k}", "icon.png"), int(48 * m))
    save(fg, os.path.join(RES, f"mipmap-{k}", "icon_foreground.png"), int(108 * m))
    save(bg, os.path.join(RES, f"mipmap-{k}", "icon_background.png"), int(108 * m))
save(legacy, os.path.join(RES, "mipmap", "icon.png"), 192)
os.makedirs(os.path.join(RES, "mipmap-anydpi-v26"), exist_ok=True)
open(os.path.join(RES, "mipmap-anydpi-v26", "icon.xml"), "w").write(
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@mipmap/icon_background"/>\n    <foreground android:drawable="@mipmap/icon_foreground"/>\n</adaptive-icon>\n')
save(legacy, os.path.join(ROOT, "icon.png"), 256)
save(legacy, os.path.join(ROOT, "docs", "icon_512.png"), 512)
print("иконки готовы")
