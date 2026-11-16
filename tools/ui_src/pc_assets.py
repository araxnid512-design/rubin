"""Картинки компьютера базы из макета пользователя (pc_mockup.png, 1672×941): фото оружейника, коровника,
карта пути, рамка экрана (девять частей) и мелкие значки (фон макета убирается по яркости).
Запуск: python3 tools/ui_src/pc_assets.py  → stand/assets/ui/…"""
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "tools/ui_src/pc_mockup.png"
OUT = ROOT / "stand/assets/ui"
ICONS = OUT / "pc"
ICONS.mkdir(parents=True, exist_ok=True)
im = Image.open(SRC).convert("RGB")

# фото: оружейник, коровник, карта пути
im.crop((77, 272, 323, 533)).save(OUT / "pc_gunsmith.jpg", quality=92)
im.crop((757, 290, 1060, 530)).save(OUT / "place_cowshed.jpg", quality=92)
im.crop((1424, 323, 1597, 495)).save(OUT / "pc_route_cowshed.jpg", quality=92)

# рамка: металлический край с заклёпками (внутренность прозрачная), уменьшена до 1280×720
fr = im.convert("RGBA").resize((1280, 720), Image.LANCZOS)
m = 30
mask = Image.new("L", fr.size, 255)
ImageDraw.Draw(mask).rectangle((m, m, 1280 - m - 1, 720 - m - 1), fill=0)
fr.putalpha(mask)
fr.save(OUT / "pc_frame.png")


def key(box, name, lo=34, hi=80):
    """значок с тёмного фона: прозрачность по яркости (тёмный фон → прозрачный)"""
    c = im.crop(box).convert("RGBA")
    px = c.load()
    for y in range(c.size[1]):
        for x in range(c.size[0]):
            r, g, b, _ = px[x, y]
            v = max(r, g, b)
            a = 0 if v <= lo else 255 if v >= hi else int(255 * (v - lo) / (hi - lo))
            px[x, y] = (r, g, b, a)
    c = c.resize((c.size[0] * 2, c.size[1] * 2), Image.LANCZOS)
    c.save(ICONS / f"{name}.png")



def key_bg(box, name, lo=40, hi=95):
    """значок на цветной кнопке: прозрачность по отличию от цвета фона (берётся по краю вырезки)"""
    c = im.crop(box).convert("RGBA")
    px = c.load()
    w, h = c.size
    edge = [px[x, y][:3] for x in range(w) for y in (0, h - 1)] + [px[x, y][:3] for y in range(h) for x in (0, w - 1)]
    bg = tuple(sorted(e[i] for e in edge)[len(edge) // 2] for i in range(3))
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            d = ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2) ** 0.5
            a = 0 if d <= lo else 255 if d >= hi else int(255 * (d - lo) / (hi - lo))
            px[x, y] = (r, g, b, a)
    c = c.resize((w * 2, h * 2), Image.LANCZOS)
    c.save(ICONS / f"{name}.png")


key((64, 38, 128, 102), "monitor")
key_bg((88, 138, 130, 178), "tools")
key((403, 143, 442, 174), "map")
key((706, 141, 744, 175), "swap")
key((748, 196, 780, 234), "pin")
key((1320, 203, 1364, 244), "clock")
key((341, 270, 384, 307), "ammo")
key((1083, 285, 1132, 324), "bull")
key((1092, 422, 1117, 446), "st_size")
key((1092, 447, 1117, 472), "st_time")
key((1092, 472, 1117, 497), "st_skull")
key((1092, 497, 1117, 522), "st_claw")
key((278, 588, 317, 627), "tools_off")
key((341, 595, 367, 622), "lock_s")
key((1062, 606, 1100, 646), "lock")
key_bg((1434, 738, 1482, 782), "cart")
key_bg((1432, 816, 1482, 860), "coins")
key((514, 746, 558, 776), "arrow")
key_bg((396, 495, 436, 530), "hammer")
key_bg((1342, 538, 1372, 574), "pin_btn")
print("ok")
