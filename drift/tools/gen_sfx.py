#!/usr/bin/env python3
"""Синтез космических звуков «Дрейфа» (свои, без чужих записей): бластеры, турели, попадания, тревога, прыжок,
стыковка, удар метеора, сварка, инструмент, добыча, энергия, сборка, гул корабля (бесшовный цикл).

Запуск: python3 tools/gen_sfx.py  → assets/audio/*.ogg (моно 44.1 кГц, Ogg Vorbis q4, нужен ffmpeg).
Случайность с фиксированным зерном — одинаковый результат при каждом запуске.
"""
import os
import subprocess
import tempfile
import wave

import numpy as np

SR = 44100
OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "audio")
rng = np.random.default_rng(7)


def t_axis(sec):
    return np.arange(int(round(sec * SR))) / SR


def sweep(f0, f1, sec, shape="sin", curve=1.0):
    t = t_axis(sec)
    k = (t / sec) ** curve
    f = f0 + (f1 - f0) * k
    ph = 2 * np.pi * np.cumsum(f) / SR
    if shape == "sin":
        return np.sin(ph)
    if shape == "saw":
        return 2.0 * ((ph / (2 * np.pi)) % 1.0) - 1.0
    if shape == "sq":
        return np.sign(np.sin(ph)) * 0.7
    return np.sin(ph)


def env(sec, a=0.003, d=None, hold=0.0):
    """атака a, затем экспоненциальный спад за d (до −60 дБ)"""
    t = t_axis(sec)
    d = d or sec
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = np.clip(t - a - hold, 0, None)
    return e * np.exp(-6.9 * rel / d)


def noise(sec):
    return rng.uniform(-1, 1, int(round(sec * SR)))


def lpf(x, fc):
    """однополюсный ФНЧ (fc может быть массивом той же длины)"""
    fc = np.broadcast_to(np.asarray(fc, dtype=float), x.shape)
    a = 1.0 - np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x)
    s = 0.0
    for i in range(len(x)):
        s += a[i] * (x[i] - s)
        y[i] = s
    return y


def hpf(x, fc):
    return x - lpf(x, fc)


def mix(*parts):
    n = max(len(p) for p in parts)
    out = np.zeros(n)
    for p in parts:
        out[: len(p)] += p
    return out


def fade(x, fin=0.002, fout=0.02):
    n_in = max(1, int(fin * SR))
    n_out = max(1, int(fout * SR))
    x = x.copy()
    x[:n_in] *= np.linspace(0, 1, n_in)
    x[-n_out:] *= np.linspace(1, 0, n_out)
    return x


def norm(x, peak_db=-1.0):
    m = np.max(np.abs(x)) or 1.0
    return x / m * (10 ** (peak_db / 20))


def save(name, x, peak_db=-1.0, loop=False):
    x = norm(x if loop else fade(x), peak_db)
    pcm = (np.clip(x, -1, 1) * 32767).astype(np.int16)
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
        tmp = f.name
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    dst = os.path.join(OUT, name + ".ogg")
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "4", dst], check=True)
    os.remove(tmp)
    print("%-16s %.2f с" % (name, len(x) / SR))


def metal(sec, freqs, d, amp=None):
    """металлический звон: негармонические частичные с разным спадом"""
    t = t_axis(sec)
    out = np.zeros_like(t)
    for i, f in enumerate(freqs):
        a = 1.0 if amp is None else amp[i]
        out += a * np.sin(2 * np.pi * f * t + rng.uniform(0, 6.28)) * np.exp(-6.9 * t / (d * (1.0 - 0.12 * i)))
    return out


def main():
    os.makedirs(OUT, exist_ok=True)

    # бластер героя: яркий «пиу» сверху вниз + щелчок
    for i, (f0, f1) in enumerate([(1500, 260), (1350, 240), (1600, 300)], 1):
        s = sweep(f0, f1, 0.2, "saw", 0.6) * env(0.2, 0.002, 0.16)
        s = mix(lpf(s, 5000), 0.25 * noise(0.02) * env(0.02, 0.001, 0.015))
        save("blaster_%d" % i, s, -3.0)
    # бластер пиратов: ниже и грязнее
    for i, (f0, f1) in enumerate([(900, 150), (820, 140)], 1):
        s = sweep(f0, f1, 0.24, "sq", 0.5) * env(0.24, 0.002, 0.2)
        s = lpf(s + 0.3 * noise(0.24) * env(0.24, 0.002, 0.08), 3500)
        save("blaster_enemy_%d" % i, s, -3.0)
    # турель-пулемёт: короткая очередь-хлопок
    for i in range(1, 4):
        n = lpf(noise(0.09), 2800 + i * 400) * env(0.09, 0.001, 0.06)
        thump = np.sin(2 * np.pi * (110 + 10 * i) * t_axis(0.09)) * env(0.09, 0.001, 0.07)
        save("turret_gun_%d" % i, mix(n, 0.8 * thump), -2.0)
    # лазерная турель: высокий луч с биением и шипением
    t = t_axis(0.5)
    beam = (sweep(2400, 900, 0.5, "sin", 0.4) + 0.6 * sweep(2410, 905, 0.5, "sin", 0.4)) * env(0.5, 0.004, 0.42)
    hiss = hpf(noise(0.5), 3000) * env(0.5, 0.002, 0.25) * 0.25
    save("turret_laser", beam + hiss, -3.0)
    # попадание: хлопок с низом
    for i in range(1, 3):
        n = lpf(noise(0.14), 1800 + 600 * i) * env(0.14, 0.001, 0.09)
        low = np.sin(2 * np.pi * 180 * t_axis(0.14)) * env(0.14, 0.001, 0.1)
        save("bullet_hit_%d" % i, mix(n, 0.7 * low), -3.0)
    # рикошет от стены: звонкий свист вниз
    for i, f in enumerate([3200, 2800], 1):
        s = sweep(f, f * 0.45, 0.28, "sin", 0.7) * env(0.28, 0.002, 0.24)
        s = mix(s, 0.3 * lpf(noise(0.03), 4000) * env(0.03, 0.001, 0.02))
        save("ricochet_%d" % i, s, -4.0)
    # тревога: двутональный сигнал
    seg = []
    for k in range(4):
        f = 660 if k % 2 == 0 else 880
        tt = t_axis(0.24)
        tone = np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 + 0.5 * np.sin(2 * np.pi * f * tt)
        seg.append(lpf(tone, 3000) * np.minimum(1, tt / 0.01) * np.minimum(1, (0.24 - tt) / 0.02))
    save("alarm", np.concatenate(seg), -2.0)
    # прыжок: нарастающий гул и свист, затем удар
    sec = 1.6
    t = t_axis(sec)
    rise = sweep(50, 240, sec, "saw", 2.0) * (t / sec) ** 1.5
    whoosh = lpf(noise(sec), 300 + 6000 * (t / sec) ** 2) * (t / sec) ** 2
    boom = np.zeros_like(t)
    b0 = int(1.25 * SR)
    bl = len(t) - b0
    tb = np.arange(bl) / SR
    boom[b0:] = (np.sin(2 * np.pi * 45 * tb) + lpf(rng.uniform(-1, 1, bl), 600)) * np.exp(-6.9 * tb / 0.35)
    save("jump", lpf(rise, 1500) * 0.6 + whoosh * 0.8 + boom, -1.0)
    # стыковка: тяжёлый лязг захватов
    t = t_axis(1.0)
    thump = np.sin(2 * np.pi * 62 * t) * np.exp(-6.9 * t / 0.4)
    ring = metal(1.0, [347, 811, 1393, 2087], 0.8, [0.6, 0.4, 0.25, 0.15])
    hiss = hpf(noise(1.0), 2500) * np.exp(-6.9 * np.clip(t - 0.25, 0, None) / 0.6) * (t > 0.25) * 0.2
    save("dock_clamp", thump + ring * 0.6 + hiss, -1.0)
    # удар метеора: глухой взрыв по корпусу
    t = t_axis(1.3)
    boom = (np.sin(2 * np.pi * 38 * t) + 0.6 * lpf(noise(1.3), 500)) * env(1.3, 0.004, 1.0)
    save("impact", boom + 0.3 * metal(1.3, [233, 587, 1021], 0.9), -1.0)
    # сварка: треск и шипение
    t = t_axis(0.9)
    crackle = noise(0.9) * (rng.uniform(0, 1, len(t)) > 0.985) * 1.0
    crackle = lpf(crackle, 6000) * 3.0 + hpf(noise(0.9), 3500) * 0.35
    save("weld", crackle * np.minimum(1, t / 0.05) * np.minimum(1, (0.9 - t) / 0.2), -3.0)
    # инструмент: щелчки трещотки
    t = t_axis(0.55)
    clicks = np.zeros_like(t)
    for k in range(7):
        p = int((0.03 + k * 0.07) * SR)
        cl = metal(0.05, [2900, 4400], 0.03) + noise(0.05) * env(0.05, 0.0005, 0.01)
        clicks[p : p + len(cl)] += cl[: len(clicks) - p]
    save("tool", clicks, -4.0)
    # добыча: хруст камня
    for i in range(1, 3):
        t = t_axis(0.4)
        crunch = lpf(noise(0.4), 1200 + 500 * i) * (rng.uniform(0, 1, len(t)) > 0.6) * env(0.4, 0.002, 0.3)
        thud = np.sin(2 * np.pi * 90 * t) * env(0.4, 0.002, 0.15)
        save("mine_%d" % i, crunch * 1.5 + thud, -3.0)
    # энергия: вкл / выкл
    save("power_on", sweep(180, 820, 0.35, "sin", 0.8) * env(0.35, 0.01, 0.4) + 0.3 * sweep(360, 1640, 0.35) * env(0.35, 0.01, 0.3), -5.0)
    save("power_off", sweep(800, 140, 0.4, "sin", 0.6) * env(0.4, 0.005, 0.35), -5.0)
    # сборка: удары по металлу
    t = t_axis(0.9)
    taps = np.zeros_like(t)
    for k, f in enumerate([520, 610, 480]):
        p = int(k * 0.25 * SR)
        m = metal(0.4, [f, f * 2.32, f * 3.91], 0.25, [1.0, 0.5, 0.3]) + 0.4 * noise(0.4) * env(0.4, 0.001, 0.02)
        taps[p : p + len(m)] += m[: len(taps) - p]
    save("craft_metal", taps, -3.0)
    # гул корабля: бесшовный цикл 11 с (у всех частот — целое число периодов на длину цикла)
    sec = 11.0
    n = int(1.0 * SR)
    air = lpf(noise(sec + 1.0), 400)
    # шов: хвост шума кроссфейдом в начало
    air[:n] = air[:n] * np.linspace(0, 1, n) + air[-n:] * np.linspace(1, 0, n)
    air = air[:-n]
    t = np.arange(len(air)) / SR
    hum = np.zeros_like(t)
    for f, a in [(55.0, 0.5), (110.0, 0.25), (165.0, 0.12), (220.0, 0.06)]:
        hum += a * np.sin(2 * np.pi * f * t)
    wob = 0.5 + 0.5 * np.sin(2 * np.pi * t / sec * 3)
    save("amb_ship", hum * (0.8 + 0.2 * wob) + air * 0.6, -6.0, loop=True)


if __name__ == "__main__":
    main()
