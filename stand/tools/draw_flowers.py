#!/usr/bin/env python3
"""Пучки полевых цветов для земли (свои, рисованные): ромашка, лютик, колокольчик, клевер. Каждый — картинка
128×128 с прозрачным фоном: стебли снизу, цветки в верхней половине (картинка ложится на наклонные полосы пучка,
как трава). Запуск из корня репозитория: python3 stand/tools/draw_flowers.py"""
import math, random
from PIL import Image, ImageDraw, ImageFilter

OUT = "stand/assets/world/tex/flower_%s.png"
S = 128
KINDS = {
    "daisy": [(246, 244, 236), (242, 196, 40), 9, 5.0],     # лепестки, середина, число лепестков, размер
    "buttercup": [(250, 214, 40), (220, 160, 20), 5, 4.2],
    "bell": [(132, 98, 196), (96, 70, 160), 5, 4.0],
    "clover": [(226, 148, 186), (196, 110, 150), 12, 3.6],
}
for name, (pc, cc, npet, sz) in KINDS.items():
    random.seed(hash(name) % 1000)
    big = 4
    img = Image.new("RGBA", (S * big, S * big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    heads = []
    for i in range(7):
        x0 = random.uniform(0.25, 0.75) * S
        x1 = x0 + random.uniform(-14, 14)
        y1 = random.uniform(0.12, 0.45) * S
        # стебель с листиком
        d.line([(x0 * big, S * big), ((x0 + x1) / 2 * big + random.uniform(-6, 6), (S + y1) / 2 * big), (x1 * big, y1 * big)],
               fill=(64, 112, 44, 255), width=int(1.6 * big))
        lx = (x0 + x1) / 2 * big
        ly = (S + y1) / 2 * big
        d.ellipse([lx - 5 * big, ly - 2 * big, lx + 5 * big, ly + 2 * big], fill=(76, 128, 52, 255))
        heads.append((x1, y1))
    for (x, y) in heads:
        r = sz * random.uniform(0.85, 1.2)
        for k in range(npet):
            a = 2 * math.pi * k / npet + random.uniform(-0.15, 0.15)
            px, py = x + math.cos(a) * r, y + math.sin(a) * r * 0.8
            jit = tuple(max(0, min(255, c + random.randint(-14, 10))) for c in pc)
            d.ellipse([(px - r * 0.62) * big, (py - r * 0.5) * big, (px + r * 0.62) * big, (py + r * 0.5) * big], fill=jit + (255,))
        d.ellipse([(x - r * 0.45) * big, (y - r * 0.45) * big, (x + r * 0.45) * big, (y + r * 0.45) * big], fill=cc + (255,))
    img = img.resize((S, S), Image.LANCZOS)
    img.save(OUT % name)
    print(OUT % name)
