#!/usr/bin/env python3
"""Обработка снимков запечённой земли (--as-test=gbake) — см. core/world/ground_bake.gd.

Шаг 1, раскладка слоёв (из плиток ground_<место>_wgt_<x>_<y>.png):
    python3 tools/ground_post.py <папка со снимками> <место> w [размер = 4096] [плиток по стороне = 2]
  → assets/world/tex/ground_<место>_w.jpg (R — трава, G — подстилка, B — тропа, остаток — грунт).
  После этого: godot --headless --path . --import и второй запуск gbake (снимется fast0 — быстрая земля без тона).

Шаг 2, общий тон (из ground_<место>_lit.png, _white.png и _fast0.png):
    python3 tools/ground_post.py <папка со снимками> <место> t [размер = 1024]
  → assets/world/tex/ground_<место>_t.png.
  Тон — отношение сглаженного цвета подробной земли к сглаженному цвету быстрой без тона: издалека быстрая
  земля выглядит как подробная (сухие пятна, куртины, кочки, рельеф под солнцем), вблизи — резкость самих текстур.

Шаг 3, подгонка яркости (по строке «[gcheck] … яркость быстрая/подробная R» проверки --as-test=gcheck):
    python3 tools/ground_post.py - <место> s <множитель>        # множитель = (1 / R) в степени 1/3
  Тон считается в ровном свете, а в игре после цветокоррекции тёмные тона сжимаются сильнее — остаток в
  несколько процентов снимается одним общим множителем.

Цвет со снимков переводится в линейный свет и делится на свет с белого снимка; тон считается по значениям в sRGB
(шейдер в этом рендерере умножает цвет в sRGB). Рядом с картинками кладётся .import: раскладка — сжатие для
видеопамяти, тон — без сжатия; обе без уменьшенных копий.
"""
import os
import sys
import warnings

import numpy as np
from PIL import Image

Image.MAX_IMAGE_PIXELS = None
HERE = os.path.dirname(os.path.abspath(__file__))
TEX = os.path.join(HERE, "..", "assets", "world", "tex")
EXPOSURE = 0.5                 # world_env.tonemap_exposure в _ground_bake
TONE_MAX = 2.0                 # наибольший хранимый тон (ULGroundBake.TONE_MAX) — менять вместе; шаг записи — 0,8 % яркости

IMPORT = """[remap]

importer="texture"
type="CompressedTexture2D"

[params]

compress/mode=2
compress/high_quality=false
compress/lossy_quality=0.7
compress/uastc_level=0
compress/rdo_quality_loss=0.0
compress/hdr_compression=1
compress/normal_map=0
compress/channel_pack=0
mipmaps/generate=false
mipmaps/limit=-1
roughness/mode=0
roughness/src_normal=""
process/channel_remap/red=0
process/channel_remap/green=1
process/channel_remap/blue=2
process/channel_remap/alpha=3
process/fix_alpha_border=true
process/premult_alpha=false
process/normal_map_invert_y=false
process/hdr_as_srgb=false
process/hdr_clamp_exposure=false
process/size_limit=0
detect_3d/compress_to=0
"""


def lin(a):
    a = a.astype(np.float32) / 255.0
    return np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)


def srgb(a):
    a = np.clip(a, 0.0, 1.0)
    return np.where(a <= 0.0031308, a * 12.92, 1.055 * a ** (1.0 / 2.4) - 0.055)


def load(path):
    return np.asarray(Image.open(path).convert("RGB"))


def box(a, n):
    """уменьшение усреднением до n × n (сторона делится нацело)"""
    f = a.shape[0] // n
    assert a.shape[0] == n * f, "снимок %d точек не делится на %d" % (a.shape[0], n)
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", category=RuntimeWarning)
        return np.nanmean(a.reshape(n, f, n, f, 3), axis=(1, 3))


def blur(a, sigma):
    """размытие Гаусса по обеим осям (края — отражением)"""
    r = int(sigma * 3) + 1
    k = np.exp(-0.5 * (np.arange(-r, r + 1) / sigma) ** 2)
    k = (k / k.sum()).astype(np.float32)
    for ax in (0, 1):
        p = np.pad(a, [(r, r) if i == ax else (0, 0) for i in range(3)], mode="reflect")
        a = sum(k[i] * np.take(p, np.arange(i, i + a.shape[ax]), axis=ax) for i in range(2 * r + 1))
    return a


def save(arr, name):
    """раскладка — JPEG и сжатие для видеопамяти; тон — PNG без сжатия (плавные переходы не терпят блоков)"""
    dst = os.path.join(TEX, name)
    if name.endswith(".png"):
        Image.fromarray(arr, "RGB").save(dst, optimize=True)
    else:
        Image.fromarray(arr, "RGB").save(dst, quality=92, subsampling=0, optimize=True)
    if not os.path.exists(dst + ".import"):
        with open(dst + ".import", "w", encoding="utf-8") as fh:
            fh.write(IMPORT.replace("compress/mode=2", "compress/mode=0") if name.endswith(".png") else IMPORT)
    return os.path.getsize(dst) / 1e6


def weights(src, place, size, tiles):
    out = np.zeros((size, size, 3), dtype=np.float32)
    t = size // tiles
    for ty in range(tiles):
        for tx in range(tiles):
            # снимок без света: точка = вес, пропущенный через «выдержку» и кодирование sRGB
            a = srgb(lin(load("%s/ground_%s_wgt_%d_%d.png" % (src, place, tx, ty))) / EXPOSURE)
            out[ty * t:(ty + 1) * t, tx * t:(tx + 1) * t] = box(a, t)
    share = out.reshape(-1, 3).mean(0)
    mb = save((np.clip(out, 0, 1) * 255.0 + 0.5).astype(np.uint8), "ground_%s_w.jpg" % place)
    print("ground_%s_w.jpg: %dx%d, %.1f МБ; доли слоёв: трава %.2f, подстилка %.2f, тропа %.2f, грунт %.2f" % (
        place, size, size, mb, share[0], share[1], share[2], max(1.0 - float(share.sum()), 0.0)))


def tone(src, place, size):
    wh = lin(load("%s/ground_%s_white.png" % (src, place)))
    hole = wh.mean(-1) < 0.1                                # здесь земли нет (выработка карьера)
    full = lin(load("%s/ground_%s_lit.png" % (src, place))) / np.maximum(wh, 1e-3)
    fast = lin(load("%s/ground_%s_fast0.png" % (src, place))) / np.maximum(wh, 1e-3)
    wmax, lmax = float(wh.max()), float(lin(load("%s/ground_%s_lit.png" % (src, place))).max())
    full[hole] = np.nan
    fast[hole] = np.nan
    full, fast = box(full, size), box(fast, size)
    bad = np.isnan(full[..., 0]) | np.isnan(fast[..., 0])
    full[bad] = np.nanmean(full.reshape(-1, 3), axis=0)
    fast[bad] = np.nanmean(fast.reshape(-1, 3), axis=0)
    mean = full[~bad].mean(0)
    t = srgb(blur(full, 1.2)) / np.maximum(srgb(blur(fast, 1.2)), 1e-3)
    # тон хранится вдвое уменьшенным (0…2 → 0…1): шейдер умножает на TONE_MAX. Больше двух тон бывает только в
    # синем канале травы (около 1 % точек), где синего почти нет, — там он срезается без вреда; зато шаг записи
    # 0,8 % яркости (при уменьшении вчетверо был 1,6 %, и мелкая подгонка яркости тонула в округлении)
    mb = save((np.clip(t / TONE_MAX, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8), "ground_%s_t.png" % place)
    warn = "" if (wmax < 0.97 and lmax < 0.985) else "  ВНИМАНИЕ: снимок на пределе яркости — цвет может быть срезан"
    print("ground_%s_t.png: %dx%d, %.2f МБ; средний цвет земли %s, тон в среднем %s, срезано (тон > %.0f): красный и зелёный %.2f %%, синий %.2f %% точек%s" % (
        place, size, size, mb, np.round(mean, 3), np.round(np.clip(t[~bad], 0, TONE_MAX).mean(0), 2), TONE_MAX,
        100.0 * float((t[~bad][..., :2] > TONE_MAX).mean()), 100.0 * float((t[~bad][..., 2] > TONE_MAX).mean()), warn))


def scale(place, k):
    """подгонка яркости: весь тон умножается на k (по замеру проверки gcheck в условиях игры)"""
    dst = os.path.join(TEX, "ground_%s_t.png" % place)
    t = np.asarray(Image.open(dst).convert("RGB"), dtype=np.float32) / 255.0 * TONE_MAX * k
    save((np.clip(t / TONE_MAX, 0.0, 1.0) * 255.0 + 0.5).astype(np.uint8), "ground_%s_t.png" % place)
    print("ground_%s_t.png: тон умножен на %.3f" % (place, k))


def main():
    src, place, mode = sys.argv[1], sys.argv[2], sys.argv[3]
    if mode == "s":
        scale(place, float(sys.argv[4]))
    elif mode == "w":
        weights(src, place, int(sys.argv[4]) if len(sys.argv) > 4 else 4096, int(sys.argv[5]) if len(sys.argv) > 5 else 2)
    else:
        tone(src, place, int(sys.argv[4]) if len(sys.argv) > 4 else 1024)


if __name__ == "__main__":
    main()
