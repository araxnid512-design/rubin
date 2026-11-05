#!/usr/bin/env python3
"""Тестовые GLB для проверки загрузчика моделей движка (без сторонних библиотек).

test_box.glb       — текстурированный ящик 10×4×8 (PNG-текстура внутри GLB), как статичная модель здания/машины.
test_character.glb — персонаж из двух костей (Hips → RightHand) со скином и клипами idle/walk/shoot/fall.
Запуск: python3 tools/make_test_glb.py <папка>
"""
import json, math, struct, sys, zlib, os


def png_rgba(w, h, pixels):
    raw = b''.join(b'\x00' + bytes(pixels[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


class Glb:
    def __init__(self):
        self.bin = bytearray(); self.j = {'asset': {'version': '2.0', 'generator': 'rubin test'}, 'bufferViews': [], 'accessors': [], 'buffers': []}

    def view(self, data, target=None):
        while len(self.bin) % 4: self.bin.append(0)
        off = len(self.bin); self.bin += data
        bv = {'buffer': 0, 'byteOffset': off, 'byteLength': len(data)}
        if target: bv['target'] = target
        self.j['bufferViews'].append(bv); return len(self.j['bufferViews']) - 1

    def acc(self, fmt, ctype, typ, values, n, mm=False):
        data = struct.pack('<' + fmt * len(values), *values)
        a = {'bufferView': self.view(data), 'componentType': ctype, 'count': n, 'type': typ}
        if mm:
            k = {'SCALAR': 1, 'VEC3': 3}[typ]
            a['min'] = [min(values[i::k]) for i in range(k)]; a['max'] = [max(values[i::k]) for i in range(k)]
        self.j['accessors'].append(a); return len(self.j['accessors']) - 1

    def save(self, path):
        while len(self.bin) % 4: self.bin.append(0)
        self.j['buffers'] = [{'byteLength': len(self.bin)}]
        js = json.dumps(self.j, separators=(',', ':')).encode()
        while len(js) % 4: js += b' '
        out = struct.pack('<III', 0x46546C67, 2, 12 + 8 + len(js) + 8 + len(self.bin)) + struct.pack('<II', len(js), 0x4E4F534A) + js + struct.pack('<II', len(self.bin), 0x004E4942) + bytes(self.bin)
        open(path, 'wb').write(out)


def box(sx, sy, sz, y0=0.0):
    P, N, U, I = [], [], [], []
    faces = [((1, 0, 0), (0, 0, -1), (0, 1, 0)), ((-1, 0, 0), (0, 0, 1), (0, 1, 0)), ((0, 1, 0), (1, 0, 0), (0, 0, -1)),
             ((0, -1, 0), (1, 0, 0), (0, 0, 1)), ((0, 0, 1), (1, 0, 0), (0, 1, 0)), ((0, 0, -1), (-1, 0, 0), (0, 1, 0))]
    for n, u, vv in faces:
        b = len(P) // 3
        for a, c in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            p = [n[i] * 0.5 + u[i] * 0.5 * a + vv[i] * 0.5 * c for i in range(3)]
            P += [p[0] * sx, p[1] * sy + y0 + sy / 2, p[2] * sz]; N += list(n); U += [(a + 1) / 2, 1 - (c + 1) / 2]
        I += [b, b + 1, b + 2, b, b + 2, b + 3]
    return P, N, U, I


def test_box(path):
    g = Glb(); P, N, U, I = box(10, 4, 8)
    w = h = 8; px = []
    for y in range(h):
        for x in range(w): px += ([200, 120, 40, 255] if (x // 2 + y // 2) % 2 else [70, 90, 60, 255])
    img = g.view(png_rgba(w, h, px))
    g.j['images'] = [{'bufferView': img, 'mimeType': 'image/png'}]; g.j['textures'] = [{'source': 0}]
    g.j['materials'] = [{'pbrMetallicRoughness': {'baseColorTexture': {'index': 0}, 'baseColorFactor': [1, 1, 1, 1]}}]
    prim = {'attributes': {'POSITION': g.acc('f', 5126, 'VEC3', P, len(P) // 3, True), 'NORMAL': g.acc('f', 5126, 'VEC3', N, len(N) // 3), 'TEXCOORD_0': g.acc('f', 5126, 'VEC2', U, len(U) // 2)},
            'indices': g.acc('H', 5123, 'SCALAR', I, len(I), True), 'material': 0}
    g.j['meshes'] = [{'primitives': [prim]}]; g.j['nodes'] = [{'mesh': 0, 'name': 'Box'}]; g.j['scenes'] = [{'nodes': [0]}]; g.j['scene'] = 0
    g.save(path)


def quat_x(a): return [math.sin(a / 2), 0, 0, math.cos(a / 2)]


def test_character(path):
    g = Glb()
    # тело (кость 0) и правая рука (кость 1)
    P1, N1, U1, I1 = box(0.45, 1.5, 0.3, 0.0)
    P2, N2, U2, I2 = box(0.12, 0.12, 0.6, 1.25)
    P2 = [P2[i] + (0.32 if i % 3 == 0 else 0) - (0.3 if i % 3 == 2 else 0) for i in range(len(P2))]
    off = len(P1) // 3
    P, N, U, I = P1 + P2, N1 + N2, U1 + U2, I1 + [i + off for i in I2]
    nv = len(P) // 3
    J = [0, 0, 0, 0] * off + [1, 0, 0, 0] * (nv - off); W = [1, 0, 0, 0] * nv
    g.j['materials'] = [{'pbrMetallicRoughness': {'baseColorFactor': [0.4, 0.45, 0.3, 1]}}]
    prim = {'attributes': {'POSITION': g.acc('f', 5126, 'VEC3', P, nv, True), 'NORMAL': g.acc('f', 5126, 'VEC3', N, nv), 'JOINTS_0': g.acc('B', 5121, 'VEC4', J, nv), 'WEIGHTS_0': g.acc('f', 5126, 'VEC4', W, nv)},
            'indices': g.acc('H', 5123, 'SCALAR', I, len(I), True), 'material': 0}
    g.j['meshes'] = [{'primitives': [prim]}]
    # узлы: 0 — сетка со скином, 1 — Hips, 2 — RightHand (у плеча)
    g.j['nodes'] = [{'mesh': 0, 'skin': 0, 'name': 'Body'}, {'name': 'Hips', 'translation': [0, 0, 0], 'children': [2]}, {'name': 'RightHand', 'translation': [0.32, 1.31, 0]}]
    ibm = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] + [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, -0.32, -1.31, 0, 1]
    g.j['skins'] = [{'joints': [1, 2], 'inverseBindMatrices': g.acc('f', 5126, 'MAT4', ibm, 2)}]
    g.j['scenes'] = [{'nodes': [0, 1]}]; g.j['scene'] = 0
    anims = []
    for name, keys in (('idle', [0, 0.05, 0]), ('walk', [0.5, -0.5, 0.5]), ('shoot', [-1.4, -1.45, -1.4]), ('fall', [0, 0.8, 1.5])):
        t = g.acc('f', 5126, 'SCALAR', [0, 0.5, 1.0], 3, True)
        rot = []
        for a in keys: rot += quat_x(a)
        r = g.acc('f', 5126, 'VEC4', rot, 3)
        ch = [{'sampler': 0, 'target': {'node': 2, 'path': 'rotation'}}]; sm = [{'input': t, 'output': r, 'interpolation': 'LINEAR'}]
        if name == 'fall':
            hip = []
            for a in keys: hip += quat_x(-a)
            ch.append({'sampler': 1, 'target': {'node': 1, 'path': 'rotation'}}); sm.append({'input': t, 'output': g.acc('f', 5126, 'VEC4', hip, 3), 'interpolation': 'LINEAR'})
        anims.append({'name': name, 'channels': ch, 'samplers': sm})
    g.j['animations'] = anims
    g.save(path)


if __name__ == '__main__':
    out = sys.argv[1] if len(sys.argv) > 1 else '.'
    os.makedirs(out, exist_ok=True)
    test_box(os.path.join(out, 'test_box.glb')); test_character(os.path.join(out, 'test_character.glb'))
    print('ok', os.listdir(out))
