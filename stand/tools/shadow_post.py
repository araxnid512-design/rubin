#!/usr/bin/env python3
"""Обработка снимка запечённых теней (--as-test=shbake): из shadow_<место>_raw.png — картинка для игры.

Снимок закодирован в sRGB — переводится в линейную долю света и растягивается до 0…1 (0 — полная тень);
края теней слегка смягчаются (в игре тени солнца мягкие); сохраняется одноканальный PNG без потерь.

    python3 tools/shadow_post.py <shadow_место_raw.png> <assets/world/tex/shadow_место.png> [размер]

Рядом кладётся файл .import (если его ещё нет): без сжатия с потерями, без уменьшенных копий и без
ограничения размера — иначе края теней поплывут. После этого: godot --headless --path . --import
"""
import os
import sys

import numpy as np
from PIL import Image, ImageFilter


IMPORT = """[remap]

importer="texture"
type="CompressedTexture2D"

[params]

compress/mode=0
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


def main():
    src, dst = sys.argv[1], sys.argv[2]
    px = int(sys.argv[3]) if len(sys.argv) > 3 else 2048
    a = np.asarray(Image.open(src).convert("RGB"), dtype=np.float32)[:, :, 0] / 255.0
    lin = np.where(a <= 0.04045, a / 12.92, ((a + 0.055) / 1.055) ** 2.4)
    # тени солнца в игре не чёрные (shadow_opacity 0,7–0,78): на снимке в тени остаётся 0,2–0,3 света.
    # Картинка хранит «чистую» тень 0…1, а насколько она темнит землю — решает шейдер (ULSunShadow)
    lo = float(np.percentile(lin, 0.5)) if float((lin < 0.6).mean()) > 0.001 else 0.0
    lin = (lin - lo) / max(1.0 - lo, 1e-3)
    im = Image.fromarray((np.clip(lin, 0, 1) * 255).astype(np.uint8), "L")
    if im.size[0] != px:
        im = im.resize((px, px), Image.LANCZOS)
    im = im.filter(ImageFilter.GaussianBlur(1.2))
    im.save(dst, optimize=True)
    if not os.path.exists(dst + ".import"):
        with open(dst + ".import", "w", encoding="utf-8") as f:
            f.write(IMPORT)
    v = np.asarray(im, dtype=np.float32) / 255.0
    print("%s: %dx%d, в тени %.1f %% земли" % (dst.split("/")[-1], im.size[0], im.size[1], 100.0 * float((v < 0.5).mean())))


if __name__ == "__main__":
    main()
