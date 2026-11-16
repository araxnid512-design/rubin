#!/usr/bin/env python3
"""Текстура еловой лапы для деревьев локации (своя, рисованная): ветка сверху — ось, боковые веточки, хвоя.
Основание лапы — внизу по центру, кончик — вверху. Запуск из корня репозитория: python3 stand/tools/draw_flora.py"""
import math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = "stand/assets/world/tex/spruce_bough.png"
S = 1024
random.seed(41)
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)


def col(k, j=0.0):
    """цвет хвои: k 0 — тёмная у ствола, 1 — молодая на концах"""
    a, b = (22, 44, 26), (86, 122, 58)
    r = random.uniform(-j, j)
    return tuple(max(0, min(255, int(a[i] + (b[i] - a[i]) * k + r * 40))) for i in range(3)) + (255,)


twigs = []      # (x0, y0, x1, y1, k) — k: насколько ближе к концу лапы


def twig(x, y, ang, ln, k, depth):
    x1, y1 = x + math.sin(ang) * ln, y - math.cos(ang) * ln
    twigs.append((x, y, x1, y1, k, depth))
    if depth >= 2 or ln < 60:
        return
    n = int(ln / 44)
    for i in range(1, n + 1):
        t = i / (n + 1)
        for sgn in (-1, 1):
            if random.random() < 0.12:
                continue
            a = ang + sgn * math.radians(random.uniform(38, 56) - 14 * t)
            l2 = ln * (0.62 if depth == 0 else 0.5) * (1 - t) ** 0.7 * random.uniform(0.8, 1.1) + 26
            twig(x + (x1 - x) * t, y + (y1 - y) * t, a, l2, min(1.0, k + 0.25 + 0.35 * t), depth + 1)


twig(S / 2, S - 16, 0.0, S - 60, 0.0, 0)
# подложка: плотная тёмная хвоя вдоль веточек
for x0, y0, x1, y1, k, dp in twigs:
    d.line([x0, y0, x1, y1], fill=col(0.05 + 0.25 * k), width=[30, 22, 16][dp])
# хвоинки
for x0, y0, x1, y1, k, dp in twigs:
    ln = math.hypot(x1 - x0, y1 - y0)
    ang = math.atan2(x1 - x0, -(y1 - y0))
    n = int(ln / 3.2)
    for i in range(n):
        t = i / max(1, n - 1)
        px, py = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
        for sgn in (-1, 1):
            a = ang + sgn * math.radians(random.uniform(35, 68))
            l = random.uniform(13, 24) * (1.0 - 0.3 * t)
            kk = min(1.0, k * 0.55 + 0.45 * t * (0.5 + 0.5 * k) + random.uniform(-0.1, 0.25))
            d.line([px, py, px + math.sin(a) * l, py - math.cos(a) * l], fill=col(max(0.0, kk), 0.25), width=3)
    # кончик веточки — светлая молодая хвоя
    for j in range(7):
        a = ang + math.radians(random.uniform(-55, 55))
        l = random.uniform(12, 20)
        d.line([x1, y1, x1 + math.sin(a) * l, y1 - math.cos(a) * l], fill=col(min(1.0, 0.75 + 0.25 * k), 0.2), width=3)
# сама ветка — коричневая, видна у основания
for x0, y0, x1, y1, k, dp in twigs:
    if dp == 0:
        d.line([x0, y0, x0 + (x1 - x0) * 0.45, y0 + (y1 - y0) * 0.45], fill=(70, 52, 36, 255), width=9)
out = img.resize((512, 512), Image.LANCZOS)
# цвет под прозрачными краями — тёмно-зелёный (без светлой каймы при сглаживании)
bg = Image.new("RGBA", out.size, (30, 54, 32, 0))
bg.paste(out, (0, 0), out)
r, g, b, _ = bg.split()
Image.merge("RGBA", (r, g, b, out.split()[3])).save(OUT)
print(OUT)
