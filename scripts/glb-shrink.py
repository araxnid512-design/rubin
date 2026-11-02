#!/usr/bin/env python3
"""Ужать GLB под телефон: все картинки внутри — не больше MAX px по большей стороне (по правилам docs/tripo:
1024 для персонажей и оружия, 512 для мелочи). Непрозрачные — JPEG (качество 85), с прозрачностью — PNG.
Геометрия, скелет и анимации не трогаются. Нужен Pillow.

    python3 scripts/glb-shrink.py вход.glb выход.glb [MAX]
"""
import io
import json
import struct
import sys

from PIL import Image


def read_glb(path):
    data = open(path, "rb").read()
    magic, ver, total = struct.unpack("<III", data[:12])
    assert magic == 0x46546C67, "не GLB"
    off = 12
    js, binc = None, b""
    while off < len(data):
        ln, typ = struct.unpack("<II", data[off:off + 8])
        chunk = data[off + 8:off + 8 + ln]
        if typ == 0x4E4F534A:
            js = json.loads(chunk)
        elif typ == 0x004E4942:
            binc = chunk
        off += 8 + ln
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(",", ":")).encode()
    jb += b" " * ((4 - len(jb) % 4) % 4)
    binc += b"\0" * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + 8 + len(binc)
    with open(path, "wb") as f:
        f.write(struct.pack("<III", 0x46546C67, 2, total))
        f.write(struct.pack("<II", len(jb), 0x4E4F534A) + jb)
        f.write(struct.pack("<II", len(binc), 0x004E4942) + binc)


def main():
    src, dst = sys.argv[1], sys.argv[2]
    mx = int(sys.argv[3]) if len(sys.argv) > 3 else 1024
    js, binc = read_glb(src)
    views = js.get("bufferViews", [])
    image_views = {img["bufferView"]: i for i, img in enumerate(js.get("images", [])) if "bufferView" in img}
    new_bin = bytearray()
    for vi, v in enumerate(views):
        start = v.get("byteOffset", 0)
        blob = binc[start:start + v["byteLength"]]
        if vi in image_views:
            img_i = image_views[vi]
            im = Image.open(io.BytesIO(blob))
            im.load()
            alpha = im.mode in ("RGBA", "LA") and im.getchannel("A").getextrema()[0] < 250
            if max(im.size) > mx:
                k = mx / max(im.size)
                im = im.resize((max(1, round(im.size[0] * k)), max(1, round(im.size[1] * k))), Image.LANCZOS)
            out = io.BytesIO()
            if alpha:
                im.save(out, "PNG", optimize=True)
                js["images"][img_i]["mimeType"] = "image/png"
            else:
                im.convert("RGB").save(out, "JPEG", quality=85, optimize=True)
                js["images"][img_i]["mimeType"] = "image/jpeg"
            blob = out.getvalue()
        while len(new_bin) % 4:
            new_bin += b"\0"
        v["byteOffset"] = len(new_bin)
        v["byteLength"] = len(blob)
        new_bin += blob
    if js.get("buffers"):
        js["buffers"][0]["byteLength"] = len(new_bin)
    write_glb(dst, js, bytes(new_bin))
    print(f"{src}: {len(binc) / 1048576:.1f} МБ → {dst}: {len(new_bin) / 1048576:.1f} МБ (картинки до {mx} px)")


if __name__ == "__main__":
    main()
