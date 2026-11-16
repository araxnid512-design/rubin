"""Атласы растительности для земли: из спрайтов моделей Poly Haven (CC0; сняты stand/tools/impostor.gd —
grass_medium_02, nettle_plant, weed_plant_02, dandelion_01, shrub_03) собираются плотные пучки, по две ячейки
256×256 на картинку 512×256. Ячейка: основание пучка — внизу по центру. Запуск: python3 tools/veg_src/veg_atlas.py"""
import random
from pathlib import Path
from PIL import Image

SRC = Path(__file__).resolve().parent
OUT = SRC.parents[1] / "stand/assets/world/tex"


def crop(name):
    im = Image.open(SRC / name).convert("RGBA")
    return im.crop(im.getbbox())


def cell(parts, seed, spread=0.32, scale=0.9):
    """пучок: несколько спрайтов, основания — около низа середины ячейки"""
    random.seed(seed)
    c = Image.new("RGBA", (256 * 2, 256 * 2), (0, 0, 0, 0))
    for p in parts:
        im = crop(p)
        k = scale * 512 / max(im.size) * random.uniform(0.75, 1.0)
        im = im.resize((max(1, int(im.width * k)), max(1, int(im.height * k))), Image.LANCZOS)
        if random.random() < 0.5:
            im = im.transpose(Image.FLIP_LEFT_RIGHT)
        x = int(256 + random.uniform(-spread, spread) * 256 - im.width / 2)
        y = int(500 - im.height)
        c.alpha_composite(im, (max(0, min(512 - im.width, x)), max(0, y)))
    return c.resize((256, 256), Image.LANCZOS)


def atlas(name, cells):
    a = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
    for i, c in enumerate(cells):
        a.alpha_composite(c, (i * 256, 0))
    # прозрачные точки — цвет соседей (без тёмной каймы на краю листьев при сглаживании)
    a.save(OUT / f"veg_{name}.png")
    print(OUT / f"veg_{name}.png")


g = [f"grass_medium_02_{i}.png" for i in range(5)]
atlas("grass", [cell([g[4], g[3], g[2], g[4], g[1]], 1, 0.28, 0.95), cell([g[3], g[4], g[0], g[2], g[3]], 2, 0.3, 0.95)])
n = [f"nettle_plant_{i}.png" for i in range(6)]
atlas("nettle", [cell([n[4], n[5], n[0], n[1]], 3, 0.3, 0.92), cell([n[5], n[4], n[2], n[0]], 4, 0.3, 0.92)])
w = [f"weed_plant_02_{i}.png" for i in range(5)]
atlas("weed", [cell([w[0], w[1], w[3]], 5, 0.25, 0.9), cell([w[2], w[4], w[1]], 6, 0.25, 0.9)])
d = [f"dandelion_01_{i}.png" for i in range(5)]
s = [f"shrub_03_{i}.png" for i in range(4)]
atlas("flower", [cell([d[0], d[1], d[3]], 7, 0.25, 0.9), cell([s[0], s[1], s[2], s[3]], 8, 0.25, 0.95)])
