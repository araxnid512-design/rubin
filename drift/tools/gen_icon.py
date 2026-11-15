#!/usr/bin/env python3
"""Иконка «Дрейфа» (собственная отрисовка): тёмный космос со звёздами, край планеты, корабль в профиль с
огнём двигателей. Значки Android всех плотностей (обычный и адаптивный) и icon.png проекта."""
import math, os
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = os.path.join(os.path.dirname(__file__), "..")
RES = os.path.join(ROOT, "android", "app", "src", "main", "res")
S = 1024
rng = np.random.default_rng(11)


def background(size):
    y, x = np.mgrid[0:size, 0:size] / size
    r = np.clip(np.hypot(x - 0.3, y - 0.25), 0, 1)[..., None]
    img = np.array((18, 22, 48)) * (1 - r) + np.array((4, 5, 12)) * r
    im = Image.fromarray(img.astype(np.uint8), "RGB").convert("RGBA")
    d = ImageDraw.Draw(im)
    for i in range(140):
        px, py = rng.random(2) * size
        b = rng.random()
        rr = size * (0.002 if b < 0.85 else 0.004)
        c = int(150 + b * 105)
        d.ellipse([px - rr, py - rr, px + rr, py + rr], fill=(c, c, min(255, c + 20), 255))
    # край планеты снизу справа
    pl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pl)
    R = size * 0.75
    cx, cy = size * 1.05, size * 1.25
    pd.ellipse([cx - R, cy - R, cx + R, cy + R], fill=(40, 70, 120, 255))
    pd.ellipse([cx - R + size * 0.03, cy - R + size * 0.02, cx + R, cy + R], fill=(24, 40, 78, 255))
    glow = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(glow).ellipse([cx - R - 8, cy - R - 8, cx + R + 8, cy + R + 8], outline=(110, 190, 255, 180), width=int(size * 0.012))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(size * 0.01)))
    im.alpha_composite(pl)
    return im


def ship(size):
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    c = size / 2
    s = size / 1024
    def P(pts):
        return [(c + x * s, c + y * s) for x, y in pts]
    # огонь двигателей
    fl = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fl)
    for k, (dy, ln) in enumerate([(-70, 260), (70, 260), (0, 200)]):
        fd.polygon(P([(-250, dy - 34), (-250 - ln, dy), (-250, dy + 34)]), fill=(255, 150, 60, 230))
        fd.polygon(P([(-250, dy - 18), (-250 - ln * 0.6, dy), (-250, dy + 18)]), fill=(255, 240, 200, 255))
    im.alpha_composite(fl.filter(ImageFilter.GaussianBlur(size * 0.012)))
    # корпус
    d.polygon(P([(-260, -120), (120, -150), (330, -40), (360, 0), (330, 40), (120, 150), (-260, 120)]), fill=(205, 210, 220, 255))
    d.polygon(P([(-260, 20), (120, 40), (330, 40), (120, 150), (-260, 120)]), fill=(140, 148, 160, 255))
    d.polygon(P([(-200, -200), (40, -150), (-60, -120), (-230, -120)]), fill=(170, 176, 188, 255))
    d.polygon(P([(-200, 200), (40, 150), (-60, 120), (-230, 120)]), fill=(120, 126, 138, 255))
    # полосы и окна мостика
    d.polygon(P([(-60, -60), (200, -70), (200, -40), (-60, -30)]), fill=(240, 140, 50, 255))
    d.polygon(P([(230, -30), (310, -20), (330, 0), (230, 0)]), fill=(90, 200, 255, 255))
    for i in range(5):
        x = -200 + i * 60
        d.rectangle([c + x * s, c + 60 * s, c + (x + 26) * s, c + 76 * s], fill=(255, 220, 120, 255))
    # двигатели
    for dy in (-70, 70, 0):
        d.rectangle([c - 290 * s, c + (dy - 40) * s, c - 240 * s, c + (dy + 40) * s], fill=(70, 74, 82, 255))
    return im.rotate(18, resample=Image.BICUBIC, center=(c, c))


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
sh = ship(S)
full = bg.copy()
full.alpha_composite(sh)
legacy = rounded(full, int(S * 0.18))
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
small = sh.resize((int(S * 0.72), int(S * 0.72)), Image.LANCZOS)
fg.alpha_composite(small, ((S - small.width) // 2, (S - small.height) // 2))
for k, m in {"mdpi": 1.0, "hdpi": 1.5, "xhdpi": 2.0, "xxhdpi": 3.0, "xxxhdpi": 4.0}.items():
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
