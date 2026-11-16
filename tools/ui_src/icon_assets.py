"""Иконка игры и картинка при запуске из эмблемы пользователя (emblem.png, 1254×1254, скруглённый квадрат на
чёрном). Запуск: python3 tools/ui_src/icon_assets.py → stand/assets/ui/icon/…
- icon_512 / icon_192 — эмблема со скруглёнными углами на прозрачном (обычная иконка, иконка проекта);
- adaptive_fg / adaptive_bg (432×432) — адаптивная иконка Android: лаунчер показывает только середину слоя
  (≈2/3) своей формой (круг, капля…), поэтому шестиугольник эмблемы уменьшен в эту середину, а фон — та же
  эмблема, размытая и затемнённая, чтобы по краям не было пустоты;
- splash — картинка при запуске (эмблема на тёмном фоне)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parents[2]
SRC = Image.open(ROOT / "tools/ui_src/emblem.png").convert("RGBA")
OUT = ROOT / "stand/assets/ui/icon"
OUT.mkdir(parents=True, exist_ok=True)
N = SRC.size[0]

# скруглённый квадрат: углы (чёрные) — прозрачные
big = 4
mask = Image.new("L", (N * big, N * big), 0)
ImageDraw.Draw(mask).rounded_rectangle((14 * big, 14 * big, (N - 14) * big, (N - 14) * big), radius=170 * big, fill=255)
mask = mask.resize((N, N), Image.LANCZOS)
rounded = SRC.copy()
rounded.putalpha(mask)
for s in (512, 192):
    rounded.resize((s, s), Image.LANCZOS).save(OUT / f"icon_{s}.png")

# шестиугольник с сиянием: вершины в точках эмблемы (с запасом на свечение рамки)
hexp = [(628, 22), (1162, 318), (1162, 900), (628, 1205), (94, 900), (94, 318)]
hm = Image.new("L", (N * big, N * big), 0)
ImageDraw.Draw(hm).polygon([(x * big, y * big) for x, y in hexp], fill=255)
hm = hm.resize((N, N), Image.LANCZOS).filter(ImageFilter.GaussianBlur(5))
hexa = SRC.copy()
hexa.putalpha(hm)
box = hexa.getbbox()
hexa = hexa.crop(box)
S = 432
inner = int(S * 0.64)                                   # видимая середина адаптивного слоя
w, h = hexa.size
k = inner / max(w, h)
hs = hexa.resize((int(w * k), int(h * k)), Image.LANCZOS)
fg = Image.new("RGBA", (S, S), (0, 0, 0, 0))
fg.alpha_composite(hs, ((S - hs.width) // 2, (S - hs.height) // 2))
fg.save(OUT / "adaptive_fg.png")
bg = SRC.convert("RGB").resize((S, S), Image.LANCZOS).filter(ImageFilter.GaussianBlur(14))
bg = ImageEnhance.Brightness(bg).enhance(0.45)
bg.save(OUT / "adaptive_bg.png")

# при запуске: эмблема 600 на тёмном (фон того же цвета, что boot_splash/bg_color)
sp = Image.new("RGBA", (600, 600), (8, 8, 8, 255))
sp.alpha_composite(rounded.resize((600, 600), Image.LANCZOS))
sp.save(OUT / "splash.png")

# проверка: как выглядит адаптивная иконка в круге и в скруглённом квадрате лаунчера
prev = Image.new("RGBA", (900, 320), (40, 40, 44, 255))
for i, shape in enumerate(["circle", "squircle"]):
    lay = Image.new("RGBA", (S, S))
    lay.alpha_composite(bg.convert("RGBA"))
    lay.alpha_composite(fg)
    vis = lay.crop((S // 6, S // 6, S - S // 6, S - S // 6)).resize((288, 288))
    m = Image.new("L", (288, 288), 0)
    d = ImageDraw.Draw(m)
    (d.ellipse if shape == "circle" else lambda b, fill: d.rounded_rectangle(b, 70, fill=fill))((0, 0, 287, 287), fill=255)
    vis.putalpha(m)
    prev.alpha_composite(vis, (16 + i * 300, 16))
prev.alpha_composite(rounded.resize((288, 288)), (616, 16))
prev.save(ROOT / "tools/ui_src/icon_preview.png")
print("ok")
