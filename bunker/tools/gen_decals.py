#!/usr/bin/env python3
"""Атлас «грязи» для бункера и поверхности (собственная генерация, без чужих картинок): 2×2 плитки по 256 px.
0 — пятно (тёмная клякса с мягким краем), 1 — трещины, 2 — ржавые потёки (для стен), 3 — мусор (обрывки бумаги,
крошка). Альфа — в канале A. Запуск: python3 tools/gen_decals.py → assets/textures/decals/grime_atlas.png"""
import os, numpy as np
from PIL import Image, ImageDraw, ImageFilter
rng = np.random.default_rng(7)
T = 256

def noise(n, octaves=4):
    out = np.zeros((n, n))
    for o in range(octaves):
        s = 2 ** (o + 2)
        g = rng.random((s + 1, s + 1))
        img = Image.fromarray((g * 255).astype(np.uint8)).resize((n, n), Image.BICUBIC)
        out += np.asarray(img, dtype=float) / 255.0 / (2 ** o)
    return out / out.max()

def tile_stain():
    y, x = np.mgrid[0:T, 0:T]
    r = np.hypot(x - T / 2, y - T / 2) / (T / 2)
    n = noise(T)
    a = np.clip((1.0 - r * 1.15) * 1.6 + (n - 0.55) * 1.4, 0, 1) ** 1.4
    a *= 0.8
    rgb = np.stack([0.16 + n * 0.08, 0.13 + n * 0.06, 0.1 + n * 0.04], -1)
    return np.dstack([rgb, a])

def tile_cracks():
    im = Image.new("L", (T, T), 0)
    d = ImageDraw.Draw(im)
    for k in range(4):
        x, y = rng.uniform(30, 226, 2)
        ang = rng.uniform(0, np.pi * 2)
        for s in range(int(rng.integers(14, 26))):
            ang += rng.normal(0, 0.45)
            nx, ny = x + np.cos(ang) * 9, y + np.sin(ang) * 9
            d.line([(x, y), (nx, ny)], fill=255, width=int(rng.integers(1, 4)))
            if rng.random() < 0.18:
                bx, by, ba = nx, ny, ang + rng.choice([-1, 1]) * 0.9
                for _ in range(5):
                    bx2, by2 = bx + np.cos(ba) * 7, by + np.sin(ba) * 7
                    d.line([(bx, by), (bx2, by2)], fill=200, width=1)
                    bx, by = bx2, by2
            x, y = nx, ny
    a = np.asarray(im.filter(ImageFilter.GaussianBlur(0.8)), dtype=float) / 255.0
    y, xx = np.mgrid[0:T, 0:T]
    a *= np.clip(1.0 - np.hypot(xx - T / 2, y - T / 2) / (T * 0.55), 0, 1) * 1.6
    rgb = np.zeros((T, T, 3)) + [0.06, 0.055, 0.05]
    return np.dstack([rgb, np.clip(a, 0, 0.9)])

def tile_rust():
    a = np.zeros((T, T))
    n = noise(T)
    for k in range(int(rng.integers(7, 12))):
        x0 = rng.uniform(20, 236)
        w = rng.uniform(3, 12)
        length = rng.uniform(0.4, 1.0) * T
        xs = np.arange(T)
        col = np.exp(-((xs - x0) / w) ** 2)
        fall = np.clip(1.0 - np.arange(T) / length, 0, 1) ** 0.8
        a += np.outer(fall, col) * rng.uniform(0.4, 0.9)
    a = np.clip(a * (0.6 + n * 0.6), 0, 0.85)
    a[:10] *= np.linspace(0.3, 1, 10)[:, None]
    rgb = np.stack([0.42 + n * 0.1, 0.2 + n * 0.06, 0.08 + n * 0.03], -1)
    return np.dstack([rgb, a])

def tile_debris():
    im = Image.new("RGBA", (T, T), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for k in range(70):
        x, y = rng.uniform(10, 246, 2)
        s = rng.uniform(1, 4)
        c = int(rng.uniform(25, 70))
        d.ellipse([x - s, y - s, x + s, y + s], fill=(c, c - 5, c - 10, 230))
    for k in range(7):
        x, y = rng.uniform(40, 216, 2)
        w, h = rng.uniform(12, 34), rng.uniform(8, 24)
        ang = rng.uniform(0, 180)
        p = Image.new("RGBA", (int(w) + 4, int(h) + 4), (0, 0, 0, 0))
        pd = ImageDraw.Draw(p)
        c = int(rng.uniform(150, 205))
        pd.rectangle([2, 2, w, h], fill=(c, c - 8, c - 25, 235))
        for ln in range(3):
            yy = 4 + ln * h / 4
            pd.line([(4, yy), (w - 3, yy)], fill=(c - 70, c - 70, c - 70, 200), width=1)
        p = p.rotate(ang, expand=True, resample=Image.BICUBIC)
        im.alpha_composite(p, (int(x - p.width / 2), int(y - p.height / 2)))
    arr = np.asarray(im, dtype=float) / 255.0
    return arr

tiles = [tile_stain(), tile_cracks(), tile_rust(), tile_debris()]
atlas = np.zeros((T * 2, T * 2, 4))
for i, t in enumerate(tiles):
    r, c = divmod(i, 2)
    atlas[r * T:(r + 1) * T, c * T:(c + 1) * T] = t
out = os.path.join(os.path.dirname(__file__), "..", "assets", "textures", "decals", "grime_atlas.png")
Image.fromarray((np.clip(atlas, 0, 1) * 255).astype(np.uint8), "RGBA").save(out)
print("сохранено", out)
