#!/usr/bin/env python3
"""Тайлы корабля «Дрейф»: карта высот → цвет + карта нормалей (+ свечение), процедурно (numpy + PIL).

Проекция та же, что у спрайтов (docs/ART_PIPELINE.md): камера сверху под 45°, 64 px на метр по горизонтали,
1 м глубины пола и 1 м высоты стены — по 45.25 px по вертикали экрана.
  пол 1×1 м        → 64×45   (верх картинки — север, «дальний» край)
  стена 2.5 м      → 64×113  (лицевая грань, смотрит на юг, к зрителю; низ картинки — пол)
  верх стены 0.4 м → 64×18
Нормали — в пространстве камеры, как у запечённых спрайтов: RGB = n·0.5+0.5, X вправо, Y вверх по экрану,
Z на зрителя. Поэтому у пола «ровная» нормаль (0, 0.71, 0.71) — RGB (128, 218, 218), у стены (0, −0.71, 0.71) —
RGB (128, 37, 218): лампа, поставленная в точку экрана, куда проецируется её 3D-положение, освещает и пол под
собой, и стены, обращённые к ней.
Цвет запекается тем же мягким нейтральным светом, что и спрайты (рассеянный 0.78 + ключ 0.32 слева сверху),
поэтому стены чуть темнее пола — как лицевые грани персонажей.

Запуск: python3 drift/tools/gen_tiles.py   (пишет drift/assets/tiles/*.png и tiles.json)
"""
import json
import os

import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'assets', 'tiles')
SS = 4  # суперсэмплинг
PPM = 64.0
S45 = np.sqrt(0.5)

# свет — как в tools/bake/bake_model.gdshader
KEY = np.array([-0.55, 0.62, 0.56])
KEY = KEY / np.linalg.norm(KEY)
AMBIENT, KEY_E, WRAP, GROUND_AO = 0.78, 0.32, 0.08, 0.12

# базис поверхности в пространстве камеры: T — вправо по картинке, B — вниз по картинке, N — наружу
FRAMES = {
    'floor': (np.array([1.0, 0, 0]), np.array([0, -S45, S45]), np.array([0, S45, S45])),
    'wall': (np.array([1.0, 0, 0]), np.array([0, -S45, -S45]), np.array([0, -S45, S45])),
}


def srgb_to_lin(c):
    c = np.asarray(c, dtype=np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def lin_to_srgb(c):
    c = np.clip(c, 0, 1)
    return np.where(c <= 0.0031308, c * 12.92, 1.055 * c ** (1 / 2.4) - 0.055)


def col(hexs):
    hexs = hexs.lstrip('#')
    return srgb_to_lin(np.array([int(hexs[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]))


class Tile:
    """Холст тайла в метрах: X — поперёк (0..ширина), Y — сверху вниз по картинке (0..глубина/высота)."""

    def __init__(self, w_px, h_px, w_m, h_m, kind, seed):
        self.w, self.h, self.kind = w_px, h_px, kind
        self.W, self.Hh = w_px * SS, h_px * SS
        self.wm, self.hm = w_m, h_m
        xs = (np.arange(self.W) + 0.5) / self.W * w_m
        ys = (np.arange(self.Hh) + 0.5) / self.Hh * h_m
        self.X, self.Y = np.meshgrid(xs, ys)
        self.H = np.zeros((self.Hh, self.W))
        self.A = np.zeros((self.Hh, self.W, 3))
        self.E = np.zeros((self.Hh, self.W, 3))
        self.alpha = np.ones((self.Hh, self.W))
        self.rng = np.random.default_rng(seed)
        self.dx = w_m / self.W
        self.dy = h_m / self.Hh

    # --- шум, периодический (через БПФ): тайлы стыкуются без швов
    def noise(self, scale_m, amp=1.0):
        n = self.rng.standard_normal((self.Hh, self.W))
        fy = np.fft.fftfreq(self.Hh, d=self.dy)[:, None]
        fx = np.fft.fftfreq(self.W, d=self.dx)[None, :]
        g = np.exp(-(fx ** 2 + fy ** 2) * (np.pi * scale_m) ** 2 / 2.0)
        r = np.real(np.fft.ifft2(np.fft.fft2(n) * g))
        r = r / (r.std() + 1e-9)
        return r * amp

    def fbm(self, base_m, octaves=4, amp=1.0, gain=0.5):
        out = np.zeros_like(self.H)
        a = 1.0
        s = base_m
        for _ in range(octaves):
            out += self.noise(s, a)
            a *= gain
            s *= 0.5
        return out * amp / 1.6

    # --- формы (маски 0..1 со скосом)
    def rect(self, x0, y0, x1, y1, bevel=0.01):
        m = np.minimum.reduce([self.X - x0, x1 - self.X, self.Y - y0, y1 - self.Y])
        return np.clip(m / max(bevel, 1e-6), 0, 1)

    def circle(self, cx, cy, r, bevel=0.01):
        d = np.hypot(self.X - cx, self.Y - cy)
        return np.clip((r - d) / max(bevel, 1e-6), 0, 1)

    def ring(self, cx, cy, r0, r1, bevel=0.01):
        d = np.hypot(self.X - cx, self.Y - cy)
        return np.clip(np.minimum(d - r0, r1 - d) / max(bevel, 1e-6), 0, 1)

    def dome(self, cx, cy, r, h):
        d2 = ((self.X - cx) ** 2 + (self.Y - cy) ** 2) / (r * r)
        return np.where(d2 < 1, h * np.sqrt(np.clip(1 - d2, 0, 1)), 0.0)

    def hpipe(self, yc, r):
        """горизонтальная труба (по всей ширине): профиль полуцилиндра"""
        d = (self.Y - yc) / r
        return np.where(np.abs(d) < 1, r * np.sqrt(np.clip(1 - d * d, 0, 1)), 0.0), np.abs(d) < 1

    def paint(self, mask, c, wear=0.0):
        m = mask[..., None]
        if wear > 0:
            w = np.clip(self.noise(0.02, 1.0) * 0.5 + 0.5 - (1 - wear), 0, 1)
            m = m * (1 - w[..., None])
        self.A = self.A * (1 - m) + np.asarray(c) * m

    def glow(self, mask, c, k=1.0):
        self.E += mask[..., None] * np.asarray(c) * k

    def bolts(self, pts, r=0.018, h=0.006):
        for (x, y) in pts:
            for ox in (-self.wm, 0, self.wm):
                for oy in (-self.hm, 0, self.hm) if self.kind == 'floor' else (0,):
                    d = self.dome(x + ox, y + oy, r, h)
                    self.H += d
                    m = (d > 0)[..., None]
                    self.A = np.where(m, self.A * 0.8 + 0.05, self.A)

    # --- результат
    def render(self, ao_height=True):
        T, B, N = FRAMES['wall' if self.kind == 'wall' else 'floor']
        Hp = self.H
        # производные: по X всегда периодически (тайлы стыкуются по горизонтали), по Y — у пола тоже
        hx = (np.roll(Hp, -1, 1) - np.roll(Hp, 1, 1)) / (2 * self.dx)
        if self.kind == 'floor':
            hy = (np.roll(Hp, -1, 0) - np.roll(Hp, 1, 0)) / (2 * self.dy)
        else:
            hy = np.gradient(Hp, self.dy, axis=0)
        n = (-hx[..., None] * T + -hy[..., None] * B + N[None, None, :])
        n /= np.linalg.norm(n, axis=2, keepdims=True)
        ndl = np.clip(n @ KEY, 0, None)
        shade = AMBIENT + KEY_E * ndl + WRAP * ((n[..., 1] * 0.5 + 0.5) - 0.5)
        if ao_height:
            # высота над полом (м): у пола 0, у стены — от низа картинки
            hgt = np.zeros_like(Hp) if self.kind == 'floor' else (self.hm - self.Y)
            t = np.clip(hgt / 0.6, 0, 1)
            shade *= 1 - GROUND_AO * (1 - t * t * (3 - 2 * t))
        lit = self.A * shade[..., None] + self.E
        # уменьшение SS×SS: цвет (линейный) и альфа — среднее, нормаль — среднее и нормировка
        def down(a):
            sh = (self.h, SS, self.w, SS) + a.shape[2:]
            return a.reshape(sh).mean(axis=(1, 3))
        a = down(self.alpha)
        lit_d = down(lit * self.alpha[..., None]) / np.maximum(a[..., None], 1e-6)
        n_d = down(n * self.alpha[..., None])
        n_d /= np.maximum(np.linalg.norm(n_d, axis=2, keepdims=True), 1e-6)
        n_d[a <= 0] = N
        e_d = down(self.E * self.alpha[..., None])
        rgb = lin_to_srgb(lit_d)
        col8 = np.dstack([np.round(rgb * 255), np.round(a * 255)]).astype(np.uint8)
        nrm8 = np.dstack([np.round((n_d * 0.5 + 0.5) * 255), np.round(a * 255)]).astype(np.uint8)
        e8 = np.round(lin_to_srgb(np.clip(e_d, 0, 1)) * 255).astype(np.uint8) if self.E.max() > 0 else None
        return col8, nrm8, e8


def floor_tile(seed):
    return Tile(64, 45, 1.0, 1.0, 'floor', seed)


def wall_tile(seed, w_px=64, w_m=1.0):
    return Tile(w_px, 113, w_m, 2.5, 'wall', seed)


# ---------------------------------------------------------------- пол
STEEL = col('6b7178')
STEEL_D = col('4c5157')
STEEL_L = col('8a9097')
YELLOW = col('d9a521')
BLACK = col('1d1e20')


def deck_base(t, plates, gap=0.012, bevel=0.012, hgt=0.006, tint=0.06, grime=0.25):
    """плиты настила: список прямоугольников (м); швы — где плиты кончаются"""
    t.A[:] = STEEL_D * 0.7
    for i, (x0, y0, x1, y1) in enumerate(plates):
        m = t.rect(x0 + gap / 2, y0 + gap / 2, x1 - gap / 2, y1 - gap / 2, bevel)
        t.H += m * hgt
        c = STEEL * (1 + tint * (t.rng.random() - 0.5) * 2)
        t.paint(m, c)
    # грязь и потёртости (мелкая зернистость + редкие пятна)
    g = t.fbm(0.06, 3)
    t.A *= (1 + 0.05 * g)[..., None]
    scratches = np.clip(t.noise(0.006, 1) - 2.0, 0, 1) * 0.3
    t.A += scratches[..., None] * 0.08
    t.H += t.noise(0.01, 0.0004)
    dirt = np.clip(t.fbm(0.3, 3) * 0.5 - 0.45, 0, 1) * grime
    t.A *= (1 - dirt)[..., None]


def floor_plate_a():
    t = floor_tile(11)
    plates = [(0, 0, 0.5, 0.5), (0.5, 0, 1, 0.5), (0, 0.5, 0.5, 1), (0.5, 0.5, 1, 1)]
    deck_base(t, plates)
    pts = []
    for (x0, y0, x1, y1) in plates:
        pts += [(x0 + 0.05, y0 + 0.05), (x1 - 0.05, y0 + 0.05), (x0 + 0.05, y1 - 0.05), (x1 - 0.05, y1 - 0.05)]
    t.bolts(pts)
    return t


def floor_plate_b():
    """рифлёный лист (ромбики)"""
    t = floor_tile(12)
    deck_base(t, [(0, 0, 1, 1)], tint=0.0)
    u = (t.X + t.Y) / 0.1
    v = (t.X - t.Y) / 0.1
    fu, fv = u - np.floor(u), v - np.floor(v)
    # ромбики-«чечевицы» в шахматном порядке
    cu = (np.floor(u) + np.floor(v)) % 2
    d1 = np.hypot((fu - 0.5) * 0.45, (fv - 0.5) * 1.6)
    d2 = np.hypot((fu - 0.5) * 1.6, (fv - 0.5) * 0.45)
    d = np.where(cu > 0, d1, d2)
    bump = np.clip(1 - d / 0.33, 0, 1)
    edge = t.rect(0.006, 0.006, 0.994, 0.994, 0.01)
    t.H += bump ** 0.6 * 0.006 * edge
    t.A *= (1 + 0.25 * bump)[..., None]
    t.bolts([(0.04, 0.04), (0.96, 0.04), (0.04, 0.96), (0.96, 0.96), (0.5, 0.04), (0.5, 0.96)])
    return t


def floor_plate_c():
    """плиты 1×0.5 с сервисным люком"""
    t = floor_tile(13)
    deck_base(t, [(0, 0, 1, 0.5), (0, 0.5, 1, 1)], grime=0.35)
    hatch = t.rect(0.3, 0.6, 0.7, 0.9, 0.008)
    groove = t.rect(0.29, 0.59, 0.71, 0.91, 0.004) - hatch
    t.H -= np.clip(groove, 0, 1) * 0.004
    t.A *= (1 - 0.35 * np.clip(groove, 0, 1))[..., None]
    handle = t.rect(0.45, 0.72, 0.55, 0.78, 0.006)
    t.H -= handle * 0.004
    t.A *= (1 - 0.3 * handle)[..., None]
    t.bolts([(0.05, 0.05), (0.95, 0.05), (0.05, 0.45), (0.95, 0.45), (0.05, 0.55), (0.95, 0.55),
             (0.05, 0.95), (0.95, 0.95), (0.32, 0.62), (0.68, 0.62), (0.32, 0.88), (0.68, 0.88)], r=0.01)
    return t


def floor_grating():
    t = floor_tile(14)
    t.A[:] = col('0c0d0f')
    t.H[:] = -0.04
    frame = 1 - t.rect(0.04, 0.04, 0.96, 0.96, 0.004)
    bars_x = np.abs(((t.X - 0.04) / 0.0575) - np.round((t.X - 0.04) / 0.0575)) * 0.0575 < 0.009
    bars_y = np.abs(((t.Y - 0.04) / 0.115) - np.round((t.Y - 0.04) / 0.115)) * 0.115 < 0.006
    bars = np.clip(bars_x.astype(float) + bars_y.astype(float) * 0.7 + frame, 0, 1)
    t.H = np.where(bars > 0, 0.004 * np.maximum(bars_x, frame > 0.5) + 0.002, t.H)
    t.paint(bars, STEEL * 0.95)
    t.A *= (1 + 0.1 * t.fbm(0.2, 3))[..., None]
    # внизу под решёткой — трубы (едва видны)
    pipe = np.clip(1 - np.abs(t.Y - 0.5) / 0.08, 0, 1) * (bars == 0)
    t.A += pipe[..., None] * col('2a2c30') * 0.6
    t.bolts([(0.02, 0.02), (0.98, 0.02), (0.02, 0.98), (0.98, 0.98)], r=0.01)
    return t


def stripes(t, mask, width=0.09):
    s = ((t.X + t.Y * 1.0) / (width * 2)) % 1.0 < 0.5
    t.paint(mask, YELLOW, wear=0.35)
    t.paint(mask * s, BLACK, wear=0.2)


def floor_hazard(top=True):
    t = floor_plate_a()
    band = t.rect(0, 0, 1, 0.22, 0.003) if top else t.rect(0, 0.78, 1, 1, 0.003)
    # полоса по всей ширине (стыкуется с соседями): прямоугольник по X без отступов
    if top:
        band = np.clip((0.22 - t.Y) / 0.003, 0, 1) * np.clip((t.Y - 0.015) / 0.003, 0, 1)
    else:
        band = np.clip((t.Y - 0.78) / 0.003, 0, 1) * np.clip((0.985 - t.Y) / 0.003, 0, 1)
    stripes(t, band)
    return t


def floor_airlock():
    t = floor_tile(15)
    deck_base(t, [(0, 0, 1, 1)], tint=0.0, grime=0.2)
    t.paint(t.rect(0.02, 0.02, 0.98, 0.98, 0.004), col('4f565e'))
    ring = t.ring(0.5, 0.5, 0.36, 0.44, 0.01)
    t.H += ring * 0.006
    t.paint(ring, col('5d646b'))
    hatch = t.circle(0.5, 0.5, 0.35, 0.006)
    t.H -= hatch * 0.003
    # створки диафрагмы
    ang = np.arctan2(t.Y - 0.5, t.X - 0.5)
    rr = np.hypot(t.X - 0.5, t.Y - 0.5)
    seg = (np.abs(((ang + rr * 4.0) / (np.pi / 3)) % 1.0 - 0.5) < 0.03) & (rr < 0.35) & (rr > 0.05)
    t.H -= seg * 0.003
    t.A *= (1 - 0.45 * seg)[..., None]
    t.paint(t.circle(0.5, 0.5, 0.06, 0.005), col('3a3f45'))
    # жёлтые шевроны по углам
    for (cx, cy, sx, sy) in [(0.1, 0.1, 1, 1), (0.9, 0.1, -1, 1), (0.1, 0.9, 1, -1), (0.9, 0.9, -1, -1)]:
        u = (t.X - cx) * sx
        v = (t.Y - cy) * sy
        chev = ((u + v) > 0.0) & ((u + v) < 0.07) & (u > -0.01) & (v > -0.01) & (u < 0.09) & (v < 0.09)
        t.paint(chev.astype(float), YELLOW, wear=0.3)
    stripe_ring = t.ring(0.5, 0.5, 0.445, 0.47, 0.004)
    stripes(t, stripe_ring, 0.05)
    t.bolts([(0.5 + 0.4 * np.cos(a), 0.5 + 0.4 * np.sin(a)) for a in np.linspace(0, 2 * np.pi, 12, endpoint=False)], r=0.01)
    return t


def floor_reactor():
    t = floor_tile(16)
    deck_base(t, [(0, 0, 0.5, 0.5), (0.5, 0, 1, 0.5), (0, 0.5, 0.5, 1), (0.5, 0.5, 1, 1)], grime=0.15)
    t.A *= 0.55
    cyan = col('3fe0ff')
    # каналы со светящимися линиями: по середине каждой плиты крестом + по периметру плит
    lines = np.zeros_like(t.H)
    for c in (0.25, 0.75):
        lines = np.maximum(lines, np.clip(1 - np.abs(t.X - c) / 0.012, 0, 1) * ((t.Y % 0.5 > 0.08) & (t.Y % 0.5 < 0.42)))
        lines = np.maximum(lines, np.clip(1 - np.abs(t.Y - c) / 0.012, 0, 1) * ((t.X % 0.5 > 0.08) & (t.X % 0.5 < 0.42)))
    chan = np.clip(lines * 2, 0, 1)
    t.H -= chan * 0.004
    t.paint(chan, col('101418'))
    t.glow(lines ** 1.5, cyan, 1.0)
    # мягкий ореол
    halo = np.zeros_like(lines)
    for c in (0.25, 0.75):
        halo = np.maximum(halo, np.exp(-((t.X - c) / 0.04) ** 2) * ((t.Y % 0.5 > 0.06) & (t.Y % 0.5 < 0.44)))
        halo = np.maximum(halo, np.exp(-((t.Y - c) / 0.04) ** 2) * ((t.X % 0.5 > 0.06) & (t.X % 0.5 < 0.44)))
    t.glow(halo, cyan, 0.12)
    t.bolts([(0.05, 0.05), (0.45, 0.05), (0.55, 0.05), (0.95, 0.05), (0.05, 0.45), (0.95, 0.45),
             (0.05, 0.55), (0.95, 0.55), (0.05, 0.95), (0.45, 0.95), (0.55, 0.95), (0.95, 0.95)], r=0.01)
    return t


def hull_tile():
    """обшивка корабля снаружи (вид сверху): светлые плиты внахлёст, ряды заклёпок, нагар"""
    t = floor_tile(17)
    hullc = col('b9bcbd')
    t.A[:] = hullc * 0.6
    rows = [(0.0, 0.34, 0.0), (0.34, 0.67, 0.5), (0.67, 1.0, 0.25)]
    for (y0, y1, off) in rows:
        for k in range(-1, 3):
            x0 = off + k * 0.5
            m = t.rect(x0 + 0.006, y0 + 0.006, x0 + 0.5 - 0.006, y1 - 0.006, 0.008)
            t.H += m * 0.008
            t.paint(m, hullc * (1 + 0.08 * (t.rng.random() - 0.5)))
            pts = [(x0 + 0.03 + i * 0.0733, y0 + 0.025) for i in range(7)] + [(x0 + 0.03 + i * 0.0733, y1 - 0.025) for i in range(7)]
            t.bolts([(p[0] % 1.0, p[1]) for p in pts], r=0.008, h=0.003)
    g = t.fbm(0.25, 4)
    t.A *= (1 + 0.08 * g)[..., None]
    scorch = np.clip(t.fbm(0.4, 4) * 0.6 - 0.3, 0, 1)
    t.A *= (1 - 0.55 * scorch)[..., None]
    t.H += t.noise(0.015, 0.0006)
    # красная маркировка на одной плите
    mark = t.rect(0.08, 0.40, 0.42, 0.44, 0.002)
    t.paint(mark, col('a8322b'), wear=0.4)
    return t


def rock_floor():
    t = floor_tile(18)
    h = t.fbm(0.35, 6, 1.0)
    t.H = h * 0.03
    # кратеры
    for _ in range(5):
        cx, cy, r = t.rng.random(), t.rng.random(), 0.05 + t.rng.random() * 0.1
        for ox in (-1, 0, 1):
            for oy in (-1, 0, 1):
                d = np.hypot(t.X - cx - ox, t.Y - cy - oy) / r
                t.H += np.where(d < 1.3, -0.02 * np.cos(np.clip(d, 0, 1) * np.pi / 2) ** 2 + 0.008 * np.exp(-((d - 1.0) / 0.15) ** 2), 0)
    base = col('5e554c')
    var = t.fbm(0.2, 4)
    t.A = base * (1 + 0.18 * var)[..., None]
    t.A *= (1 + 6.0 * (t.H - t.H.mean()))[..., None].clip(0.6, 1.4)
    peb = np.clip(t.noise(0.01, 1) - 1.8, 0, 1)
    t.H += peb * 0.004
    t.A *= (1 + 0.25 * peb)[..., None]
    return t


# ---------------------------------------------------------------- стены (картинка: y=0 — верх стены, 2.5 м)

WALLC = col('7a8088')
WALLC_D = col('555a61')
TRIM = col('3e4349')


def wall_base(t, seam_mid=True, x_seams=(0.0, 1.0)):
    t.A[:] = WALLC
    # вертикальные швы на краях тайла (половина шва с каждой стороны) и дополнительные
    for xs in x_seams:
        for ox in (-t.wm, 0, t.wm):
            s = np.clip(1 - np.abs(t.X - xs - ox) / 0.012, 0, 1)
            t.H -= s * 0.006
            t.A *= (1 - 0.35 * s)[..., None]
    # панель: выпуклая между 0.3 и 2.15 м от верха
    yb = t.hm  # низ (пол)
    panel = t.rect(-1, 0.32, t.wm + 1, yb - 0.17, 0.02)
    t.H += panel * 0.01
    # верхний пояс (карниз) и нижний плинтус
    top = np.clip((0.3 - t.Y) / 0.01, 0, 1)
    t.paint(top, TRIM)
    t.H += top * 0.02
    groove = np.clip(1 - np.abs(t.Y - 0.12) / 0.01, 0, 1)
    t.H -= groove * 0.004
    kick = np.clip((t.Y - (yb - 0.15)) / 0.01, 0, 1)
    t.paint(kick, WALLC_D * 0.8)
    t.H += kick * 0.015
    if seam_mid:
        s = np.clip(1 - np.abs(t.Y - 1.25) / 0.01, 0, 1)
        t.H -= s * 0.005
        t.A *= (1 - 0.3 * s)[..., None]
    g = t.fbm(0.08, 3)
    t.A *= (1 + 0.04 * g)[..., None]
    streak = t.noise(0.004, 1.0)
    streak = np.clip(np.abs(np.real(np.fft.ifft(np.fft.fft(streak, axis=0) * np.exp(-np.fft.fftfreq(t.Hh)[:, None] ** 2 * 4000), axis=0))) * 0.6 - 0.25, 0, 1)
    t.A *= (1 - 0.12 * streak)[..., None]
    t.H += t.noise(0.01, 0.0003)
    # болты по углам панели
    for xs in x_seams:
        for x in (xs + 0.05, xs - 0.05):
            if 0 < x < t.wm:
                t.bolts([(x, 0.38), (x, yb - 0.24), (x, 1.2), (x, 1.3)] if seam_mid else [(x, 0.38), (x, yb - 0.24)], r=0.011)


def wall_plain():
    t = wall_tile(21)
    wall_base(t)
    return t


def wall_pipes():
    t = wall_tile(22)
    wall_base(t)
    for (yc, r, c) in [(0.62, 0.05, col('8c6b3d')), (0.78, 0.035, col('6f777f')), (1.62, 0.06, col('4f6e5a'))]:
        h, m = t.hpipe(yc, r)
        t.H = np.maximum(t.H, h + 0.012)
        t.paint(m.astype(float), c)
        t.A *= (1 + 0.1 * t.noise(0.05, 1))[..., None] ** (m[..., None])
        # хомуты
        for xc in (0.25, 0.75):
            band = (np.abs(t.X - xc) < 0.02) & m
            t.H += band * 0.006
            t.paint(band.astype(float), STEEL_D)
    # маркировка на трубе
    lab = t.rect(0.45, 1.58, 0.6, 1.66, 0.003)
    t.paint(lab, YELLOW, wear=0.3)
    return t


def wall_console():
    t = wall_tile(23)
    wall_base(t, seam_mid=False)
    box = t.rect(0.12, 0.7, 0.88, 1.75, 0.02)
    t.H += box * 0.05
    t.paint(box, col('3b4148'))
    scr = t.rect(0.2, 0.8, 0.8, 1.3, 0.01)
    t.H -= scr * 0.01
    t.paint(scr, col('06120f'))
    green = col('39f5a0')
    # строки «текста» и график
    rows = ((t.Y - 0.86) % 0.06 < 0.018) & (t.Y > 0.86) & (t.Y < 1.12)
    words = t.noise(0.02, 1) > -0.2
    lengths = (t.X - 0.24) < (0.12 + 0.4 * ((np.floor((t.Y - 0.86) / 0.06) * 0.37) % 1.0))
    txt = rows & words & (t.X > 0.24) & lengths
    graph = np.abs(t.Y - (1.22 - 0.05 * np.sin((t.X - 0.2) * 23) - 0.03 * np.sin((t.X) * 51))) < 0.008
    graph &= (t.X > 0.24) & (t.X < 0.76)
    ui = scr * (txt | graph)
    t.glow(ui, green, 0.9)
    t.glow(scr, col('0c3a2a'), 0.25)
    # кнопки
    for i, c in enumerate([col('ff4a3a'), col('ffc23a'), col('39f5a0'), col('3fa8ff')]):
        b = t.circle(0.3 + i * 0.13, 1.5, 0.03, 0.006)
        t.H += t.dome(0.3 + i * 0.13, 1.5, 0.03, 0.01)
        t.paint(b, c * 0.5)
        t.glow(b, c, 0.5)
    pad = t.rect(0.25, 1.6, 0.75, 1.7, 0.006)
    t.H += pad * 0.006
    t.paint(pad, col('2a2e33'))
    return t


def wall_vent():
    t = wall_tile(24)
    wall_base(t, seam_mid=False)
    frame = t.rect(0.15, 1.15, 0.85, 1.95, 0.015)
    t.H += frame * 0.02
    t.paint(frame, col('5d636a'))
    hole = t.rect(0.2, 1.2, 0.8, 1.9, 0.006)
    t.H -= hole * 0.04
    t.paint(hole, col('101214'))
    slat_y = ((t.Y - 1.2) % 0.07) / 0.07
    slat = hole * (slat_y < 0.6)
    t.H += slat * (0.035 + 0.02 * (1 - slat_y / 0.6))  # наклонные ламели
    t.paint(slat, col('6a7077') * (0.7 + 0.5 * (1 - slat_y)[..., None]))
    t.bolts([(0.18, 1.18), (0.82, 1.18), (0.18, 1.92), (0.82, 1.92)], r=0.012)
    stain = np.clip(t.fbm(0.15, 3) * 0.5, 0, 1) * np.clip((t.Y - 1.9) / 0.3, 0, 1) * (np.abs(t.X - 0.5) < 0.3)
    t.A *= (1 - 0.3 * stain)[..., None]
    return t


def wall_window():
    t = wall_tile(25)
    wall_base(t, seam_mid=False)
    frame = t.rect(0.08, 0.55, 0.92, 1.85, 0.03)
    t.H += frame * 0.03
    t.paint(frame, col('4a5057'))
    win = t.rect(0.14, 0.62, 0.86, 1.78, 0.01)
    t.H -= win * 0.04
    # космос: почти чёрный, лёгкая туманность, звёзды (свечение)
    space = col('03050b') + col('0b1030') * np.clip(t.fbm(0.4, 4) * 0.5 + 0.3, 0, 1)[..., None]
    t.paint(win, np.zeros(3))
    t.A = t.A * (1 - win[..., None]) + space * win[..., None] * 0.6
    stars = t.rng.random(t.H.shape) > 0.9975
    sb = t.rng.random(t.H.shape)
    st = np.zeros_like(t.H)
    st[stars] = 0.4 + 0.6 * sb[stars]
    # звезда — 2×2 субпикселя
    st = np.maximum(st, np.roll(st, 1, 0))
    st = np.maximum(st, np.roll(st, 1, 1))
    t.glow(st * win, col('e8eeff'), 1.0)
    t.glow(win * np.clip(t.fbm(0.5, 3) * 0.4 + 0.2, 0, 1), col('140c30'), 0.35)
    # блик на стекле
    glint = win * np.clip(1 - np.abs((t.X - 0.2) - (t.Y - 0.62) * 0.5) / 0.03, 0, 1) * (t.Y < 1.1)
    t.glow(glint, col('3a4a6a'), 0.25)
    # стекло ровное: высота окна — плоская
    t.H = np.where(win > 0.99, t.H.min(), t.H)
    t.bolts([(0.11, 0.58 + i * 0.25) for i in range(6)] + [(0.89, 0.58 + i * 0.25) for i in range(6)], r=0.01)
    return t


def wall_top():
    t = Tile(64, 18, 1.0, 0.4, 'floor', 26)
    t.A[:] = col('4a4f56')
    cap = t.rect(-1, 0.03, 2, 0.37, 0.02)
    t.H += cap * 0.01
    t.paint(np.clip((t.Y - 0.34) / 0.01, 0, 1), col('5c626a'))
    s = np.clip(1 - np.abs(t.X - 0.0) / 0.01, 0, 1) + np.clip(1 - np.abs(t.X - 1.0) / 0.01, 0, 1)
    t.H -= s * 0.004
    t.A *= (1 + 0.08 * t.fbm(0.2, 3))[..., None]
    t.A *= (1 - 0.3 * s)[..., None]
    return t


def door(open_, w_px=64, w_m=1.0, seed=27):
    t = wall_tile(seed, w_px, w_m)
    wall_base(t, seam_mid=False, x_seams=(0.0, w_m))
    jamb = 0.09
    top_y = 2.5 - 2.1  # проём 2.1 м
    frame = t.rect(jamb - 0.06, top_y - 0.08, w_m - jamb + 0.06, 3.0, 0.015)
    t.H += frame * 0.03
    t.paint(frame, col('3d4248'))
    stripes(t, t.rect(jamb - 0.05, top_y - 0.07, w_m - jamb + 0.05, top_y - 0.015, 0.004) , 0.05)
    opening = t.rect(jamb, top_y, w_m - jamb, 3.0, 0.004)
    # огонёк над дверью
    lc = col('3cff7a') if open_ else col('ffae2a')
    lamp = t.rect(w_m / 2 - 0.08, top_y - 0.2, w_m / 2 + 0.08, top_y - 0.14, 0.006)
    t.H += lamp * 0.008
    t.paint(lamp, lc * 0.5)
    t.glow(lamp, lc, 0.9)
    if open_:
        # проём прозрачный: сквозь него видно пол за стеной (рисуется раньше); по краям — тень в глубине
        t.alpha = 1 - opening
        inner = t.rect(jamb - 0.03, top_y - 0.03, w_m - jamb + 0.03, 3.0, 0.004) - opening
        t.paint(np.clip(inner, 0, 1), col('15171a'))
        t.H -= np.clip(inner, 0, 1) * 0.03
    else:
        t.H = t.H * (1 - opening) + opening * 0.0
        t.paint(opening, col('69707a'))
        mid = w_m / 2
        seam = np.clip(1 - np.abs(t.X - mid) / 0.008, 0, 1) * opening
        t.H -= seam * 0.01
        t.A *= (1 - 0.6 * seam)[..., None]
        # рельефные полосы на створках
        for y in (top_y + 0.35, top_y + 1.0, top_y + 1.65):
            b = t.rect(jamb + 0.04, y, w_m - jamb - 0.04, y + 0.08, 0.01) * (np.abs(t.X - mid) > 0.03)
            t.H += b * 0.008
        win = (t.rect(mid - 0.2, top_y + 0.15, mid - 0.06, top_y + 0.3, 0.005) + t.rect(mid + 0.06, top_y + 0.15, mid + 0.2, top_y + 0.3, 0.005))
        t.H -= win * 0.006
        t.paint(np.clip(win, 0, 1), col('0d1218'))
        stripes(t, t.rect(jamb, 2.5 - 0.3, w_m - jamb, 2.5 - 0.17, 0.004) * opening, 0.05)
        t.A *= (1 + 0.06 * t.fbm(0.2, 3))[..., None]
    return t


def rock_wall(top=False):
    if top:
        t = Tile(64, 18, 1.0, 0.4, 'floor', 29)
    else:
        t = wall_tile(28)
    h = t.fbm(0.3, 6)
    strata = np.sin(t.Y * 18 + 2.0 * t.fbm(0.5, 2)) * 0.5
    t.H = (h * 0.04 + strata * 0.012)
    if not top:
        # неровный верхний край стены (обломки) — альфа
        edge = 0.06 + 0.05 * (t.fbm(0.2, 3)[0:1, :] * 0.5)
        t.alpha = np.clip((t.Y - edge) / 0.01, 0, 1)
    base = col('5a5048')
    t.A = base * (1 + 0.2 * t.fbm(0.25, 4) + 0.08 * strata)[..., None]
    t.A *= (1 + 5.0 * (t.H - t.H.mean()))[..., None].clip(0.6, 1.4)
    crack = np.clip(np.abs(t.noise(0.04, 1)) < 0.05, 0, 1) * (t.noise(0.2, 1) > 0.6)
    t.H -= crack * 0.01
    t.A *= (1 - 0.4 * crack)[..., None]
    if top:
        t.A *= 0.85
    return t


TILES = [
    # имя, функция, вид (kind), подпись
    ('floor_plate_a', floor_plate_a, 'floor', 'палуба: 4 плиты 0.5×0.5 м с болтами'),
    ('floor_plate_b', floor_plate_b, 'floor', 'палуба: рифлёный лист'),
    ('floor_plate_c', floor_plate_c, 'floor', 'палуба: 2 плиты 1×0.5 м, сервисный люк'),
    ('floor_grating', floor_grating, 'floor', 'решётка (под ней темнота и трубы)'),
    ('floor_hazard_n', lambda: floor_hazard(True), 'floor', 'плиты + жёлто-чёрная полоса у северного (верхнего) края'),
    ('floor_hazard_s', lambda: floor_hazard(False), 'floor', 'плиты + жёлто-чёрная полоса у южного (нижнего) края'),
    ('floor_airlock', floor_airlock, 'floor', 'шлюз: круглый люк-диафрагма, шевроны'),
    ('floor_reactor', floor_reactor, 'floor', 'реакторный отсек: тёмные плиты, голубые светящиеся линии'),
    ('hull', hull_tile, 'floor', 'внешняя обшивка корабля (вид сверху)'),
    ('rock_floor', rock_floor, 'floor', 'астероид: каменный пол с кратерами'),
    ('wall_plain', wall_plain, 'wall', 'стена: панель'),
    ('wall_pipes', wall_pipes, 'wall', 'стена: панель с трубами'),
    ('wall_console', wall_console, 'wall', 'стена: пульт с экраном'),
    ('wall_vent', wall_vent, 'wall', 'стена: вентиляционная решётка'),
    ('wall_window', wall_window, 'wall', 'стена: иллюминатор в космос (звёзды)'),
    ('wall_top', wall_top, 'wall_top', 'верх стены (толщина 0.4 м)'),
    ('door_closed', lambda: door(False), 'door', 'дверь 1 м: закрыта (огонёк янтарный)'),
    ('door_open', lambda: door(True), 'door', 'дверь 1 м: открыта, проём прозрачный (огонёк зелёный)'),
    ('door2_closed', lambda: door(False, 128, 2.0, 30), 'door', 'дверь 2 м (2 тайла): закрыта'),
    ('door2_open', lambda: door(True, 128, 2.0, 30), 'door', 'дверь 2 м (2 тайла): открыта'),
    ('rock_wall', lambda: rock_wall(False), 'wall', 'астероид: каменная стена (верхний край неровный, альфа)'),
    ('rock_wall_top', lambda: rock_wall(True), 'wall_top', 'астероид: верх каменной стены'),
]


def main():
    os.makedirs(OUT, exist_ok=True)
    meta = {'ppm': PPM, 'floor_px': [64, 45], 'wall_px': [64, 113], 'wall_top_px': [64, 18],
            'normal_space': 'камера: RGB = n*0.5+0.5, X вправо, Y вверх по экрану, Z на зрителя',
            'flat_normal': {'floor': [128, 218, 218], 'wall': [128, 37, 218]},
            'tiles': {}}
    total = 0
    for name, fn, kind, desc in TILES:
        t = fn()
        c8, n8, e8 = t.render()
        files = {'file': name + '.png', 'normal': name + '_n.png'}
        Image.fromarray(c8, 'RGBA').save(os.path.join(OUT, name + '.png'), optimize=True)
        Image.fromarray(n8, 'RGBA').save(os.path.join(OUT, name + '_n.png'), optimize=True)
        if e8 is not None:
            Image.fromarray(e8, 'RGB').save(os.path.join(OUT, name + '_e.png'), optimize=True)
            files['emission'] = name + '_e.png'
        for f in files.values():
            total += os.path.getsize(os.path.join(OUT, f))
        meta['tiles'][name] = dict(files, size=[t.w, t.h], kind=kind, metres=[t.wm, t.hm], desc=desc,
                                   alpha=bool((c8[..., 3] < 255).any()))
        print(f'{name:16s} {t.w}×{t.h} {kind}')
    with open(os.path.join(OUT, 'tiles.json'), 'w', encoding='utf-8') as f:
        json.dump(meta, f, ensure_ascii=False, indent=1)
    print(f'итого {total / 1024:.0f} КБ')


if __name__ == '__main__':
    main()
