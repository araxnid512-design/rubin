#!/usr/bin/env python3
"""Фото-текстуры Poly Haven (CC0) → текстуры игры (game/textures/*.jpg).
Грунт: яркость подгоняется к цвету грунта игры, цвет на 40 % тонируется к палитре (свет времени суток
работает как раньше). Стены: осветлённая кладка (накладывается умножением на грани).
Исходники — art3d/tex/src_<вид>.jpg, список — art3d/tex/SOURCES.txt (вид, id на polyhaven.com)."""
from PIL import Image, ImageFilter, ImageStat
import os
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(R, 'art3d', 'tex')
OUT = os.path.join(R, 'game', 'textures')
os.makedirs(OUT, exist_ok=True)
# вид грунта → (цвет палитры игры, доля тона палитры, множитель яркости)
GROUND = {
    'grain': ('#6e5b44', 0.4, 1.05), 'ash': ('#4b4642', 0.45, 1.0), 'earth': ('#5f4d39', 0.45, 1.08),
    'concrete': ('#5b5957', 0.25, 1.12), 'metal': ('#3d4348', 0.3, 1.15), 'cave': ('#3e352d', 0.35, 1.1),
    'rubble': ('#58524b', 0.55, 1.05), 'wood': ('#7b5a35', 0.3, 1.05), 'asphalt': ('#45443f', 0.3, 1.0),
    'planks': ('#6a5038', 0.55, 1.12)
}
WALLS = {'brick': 0.86, 'plaster': 0.88, 'stone': 0.86, 'bulkhead': 0.9, 'planks': 0.86, 'rockface': 0.84}

def hexrgb(h):
    h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))

def lum(im):
    return ImageStat.Stat(im.convert('L')).mean[0]

for k, (col, tint, gain) in GROUND.items():
    f = os.path.join(SRC, 'src_' + k + '.jpg')
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB').resize((512, 512), Image.LANCZOS)
    target = sum(hexrgb(col)) / 3 * gain
    k1 = target / max(1, lum(im))
    im = im.point(lambda v: max(0, min(255, int(v * k1))))
    # тон к палитре: смешать с картинкой той же яркости, но цвета палитры
    L = im.convert('L')
    c = hexrgb(col); cm = sum(c) / 3
    tinted = Image.merge('RGB', [L.point(lambda v, ch=ch: max(0, min(255, int(v * ch / cm)))) for ch in c])
    im = Image.blend(im, tinted, tint)
    im.save(os.path.join(OUT, 'g_' + k + '.jpg'), quality=86)
    print('g_' + k, round(lum(im)), round(target))

for k, bright in WALLS.items():
    f = os.path.join(SRC, 'src_' + k + '.jpg')
    if not os.path.exists(f): continue
    im = Image.open(f).convert('RGB').resize((256, 256), Image.LANCZOS)
    # для умножения: средняя яркость ~bright, контраст чуть мягче
    k1 = bright * 255 / max(1, lum(im))
    im = im.point(lambda v: max(0, min(255, int(128 + (v * k1 - 128) * 0.85 + 18))))
    im.save(os.path.join(OUT, 'w_' + k + '.jpg'), quality=86)
    print('w_' + k, round(lum(im)))
