#!/usr/bin/env python3
"""Облегчить GLB с движениями Tripo (<имя>_b.glb, _c.glb …): убрать картинки текстур (сетка, скелет и
анимации остаются). Для запекания из этих файлов берутся только клипы — модель и текстуры берутся из _a.glb.

    python3 drift/tools/bake/strip_glb.py вход.glb выход.glb
"""
import json
import struct
import sys


def read_glb(path):
    data = open(path, 'rb').read()
    magic, version, length = struct.unpack_from('<III', data, 0)
    assert magic == 0x46546C67, 'не GLB'
    off = 12
    js, binc = None, b''
    while off < length:
        clen, ctype = struct.unpack_from('<II', data, off)
        chunk = data[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(chunk.decode('utf-8'))
        elif ctype == 0x004E4942:
            binc = chunk
        off += 8 + clen
    return js, binc


def write_glb(path, js, binc):
    jb = json.dumps(js, separators=(',', ':')).encode('utf-8')
    jb += b' ' * ((4 - len(jb) % 4) % 4)
    binc += b'\0' * ((4 - len(binc) % 4) % 4)
    total = 12 + 8 + len(jb) + (8 + len(binc) if binc else 0)
    with open(path, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(jb), 0x4E4F534A))
        f.write(jb)
        if binc:
            f.write(struct.pack('<II', len(binc), 0x004E4942))
            f.write(binc)


def strip(js, binc):
    js.pop('images', None)
    js.pop('textures', None)
    js.pop('samplers', None)
    for m in js.get('materials', []):
        pbr = m.get('pbrMetallicRoughness', {})
        pbr.pop('baseColorTexture', None)
        pbr.pop('metallicRoughnessTexture', None)
        for k in ('normalTexture', 'occlusionTexture', 'emissiveTexture'):
            m.pop(k, None)
        m.pop('extensions', None)
    for k in ('extensionsUsed', 'extensionsRequired'):
        if k in js:
            js[k] = [e for e in js[k] if 'texture' not in e.lower()]
            if not js[k]:
                js.pop(k)
    # оставить только bufferView, на которые ссылаются accessors; перепаковать BIN
    used = sorted({a['bufferView'] for a in js.get('accessors', []) if 'bufferView' in a})
    remap = {}
    out = bytearray()
    views = []
    for old in used:
        bv = dict(js['bufferViews'][old])
        start = bv.get('byteOffset', 0)
        chunk = binc[start: start + bv['byteLength']]
        while len(out) % 4:
            out.append(0)
        bv['byteOffset'] = len(out)
        bv['buffer'] = 0
        out += chunk
        remap[old] = len(views)
        views.append(bv)
    for a in js.get('accessors', []):
        if 'bufferView' in a:
            a['bufferView'] = remap[a['bufferView']]
    js['bufferViews'] = views
    js['buffers'] = [{'byteLength': len(out)}]
    return js, bytes(out)


if __name__ == '__main__':
    src, dst = sys.argv[1], sys.argv[2]
    js, binc = read_glb(src)
    js, binc = strip(js, binc)
    write_glb(dst, js, binc)
    print(f'{src} → {dst}: {len(binc) / 1e6:.2f} МБ данных')
