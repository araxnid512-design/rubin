#!/usr/bin/env python3
"""Музыка главного меню — собственная, собрана из звуков, посчитанных здесь же (без чужих записей):
низкий гул в ре миноре, медленные «наплывы» аккорда, ветер, далёкие удары по металлу, глухие толчки,
редкий треск счётчика. Зациклена без шва. Запуск из корня репозитория: python3 stand/tools/build_music.py"""
import subprocess, wave
import numpy as np

SR = 32000
LOOP = 76                     # длина петли, с
TAIL = 8                      # хвост, который вплавляется в начало (шов не слышен)
N = SR * (LOOP + TAIL)
t = np.arange(N) / SR
rng = np.random.default_rng(11)
OUT = "stand/assets/audio/music_menu.ogg"


def lfo(freq, phase, lo, hi):
    return lo + (hi - lo) * (0.5 + 0.5 * np.sin(2 * np.pi * freq * t + phase))


def shaped_noise(lo, hi, n=N, soft=0.25):
    """шум в полосе lo…hi Гц с мягкими краями"""
    sp = np.fft.rfft(rng.standard_normal(n))
    f = np.fft.rfftfreq(n, 1 / SR)
    m = np.exp(-0.5 * (np.log(np.maximum(f, 1e-3) / np.sqrt(lo * hi)) / (np.log(hi / lo) * soft + 0.25)) ** 2)
    m[(f < lo * 0.5) | (f > hi * 2.0)] = 0
    x = np.fft.irfft(sp * m, n)
    return x / (np.abs(x).max() + 1e-9)


def slow(period_lo=6.0):
    """медленная случайная огибающая 0…1 (порывы)"""
    sp = np.fft.rfft(rng.standard_normal(N))
    f = np.fft.rfftfreq(N, 1 / SR)
    sp[f > 1.0 / period_lo] = 0
    x = np.fft.irfft(sp, N)
    x = (x - x.min()) / (x.max() - x.min() + 1e-9)
    return x


def tone(f0, harm=6, det=0.35, roll=1.5):
    out = np.zeros(N)
    for d in (-det, 0.0, det):
        for h in range(1, harm + 1):
            out += np.sin(2 * np.pi * (f0 + d) * h * t + rng.uniform(0, 6.28)) / h ** roll
    return out / 3.0


# гул: ре — ля — ре
# (самый низ — негромко: динамик телефона его почти не воспроизводит, основа гула — на октаву выше)
mix = 0.10 * tone(73.42) * lfo(0.011, 0.0, 0.55, 1.0)
mix += 0.20 * tone(110.00, 8, 0.35, 1.15) * lfo(0.017, 1.3, 0.25, 1.0)
mix += 0.30 * tone(146.83, 8, 0.4, 1.1) * lfo(0.013, 2.1, 0.45, 1.0)
mix += 0.16 * tone(220.00, 6, 0.5, 1.2) * lfo(0.021, 0.7, 0.1, 1.0)
# наплывы аккорда (ре минор с добавленными ступенями): каждая нота приходит и уходит в своём темпе
for f0, per, ph, g in [(349.23, 19.0, 0.4, 0.34), (440.0, 23.0, 2.2, 0.30), (523.25, 29.0, 4.0, 0.22),
                       (587.33, 17.0, 1.1, 0.20), (698.46, 31.0, 5.2, 0.13), (880.0, 37.0, 3.3, 0.08)]:
    env = np.maximum(0.0, np.sin(2 * np.pi * t / per + ph)) ** 2.2
    mix += g * tone(f0, 3, 0.6, 2.0) * env
# ветер
mix += 0.42 * shaped_noise(300, 1500) * (0.25 + 0.75 * slow(7.0))
mix += 0.16 * shaped_noise(1500, 5000, soft=0.2) * slow(4.0) ** 2
# далёкий металл: удар — набор негармоничных призвуков, долго гаснет
for _ in range(9):
    at = rng.uniform(3, LOOP - 6)
    base = rng.choice([196.0, 246.9, 293.7, 329.6, 392.0]) * rng.choice([1.0, 2.0])
    i0 = int(at * SR)
    tt = t[: N - i0]
    hit = np.zeros(N - i0)
    for ratio, dec, g in [(1.0, 4.5, 1.0), (2.76, 3.0, 0.5), (5.40, 1.8, 0.28), (8.93, 1.0, 0.15)]:
        hit += g * np.sin(2 * np.pi * base * ratio * tt + rng.uniform(0, 6.28)) * np.exp(-tt / dec)
    mix[i0:] += 0.13 * rng.uniform(0.5, 1.0) * hit * np.minimum(tt / 0.01, 1.0)
# глухие толчки
for _ in range(5):
    at = rng.uniform(5, LOOP - 4)
    i0 = int(at * SR)
    tt = t[: N - i0]
    f = 110.0 - 40.0 * np.minimum(tt / 0.8, 1.0)
    mix[i0:] += 0.22 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt / 0.9) * np.minimum(tt / 0.02, 1.0)
# треск счётчика — редкими сериями
click = np.zeros(N)
for _ in range(4):
    at = rng.uniform(4, LOOP - 6)
    for _k in range(int(rng.integers(5, 14))):
        i0 = int((at + rng.exponential(0.22) * _k) * SR)
        if i0 < N - 200:
            click[i0:i0 + 90] += rng.uniform(0.4, 1.0) * np.sin(np.arange(90) * 0.9) * np.exp(-np.arange(90) / 14.0)
mix += 0.10 * click


def reverb(x, seed, dec=2.2, wet=0.42):
    r = np.random.default_rng(seed)
    n = int(SR * 5.0)
    ir = r.standard_normal(n) * np.exp(-np.arange(n) / (SR * dec))
    sp = np.fft.rfft(ir)
    f = np.fft.rfftfreq(n, 1 / SR)
    ir = np.fft.irfft(sp / (1.0 + (f / 4500.0) ** 2), n)          # хвост глуше
    m = len(x) + n
    y = np.fft.irfft(np.fft.rfft(x, m) * np.fft.rfft(ir, m), m)[: len(x)]
    y /= np.abs(y).max() + 1e-9
    return x * (1.0 - wet) / (np.abs(x).max() + 1e-9) + y * wet


chan = []
for seed in (3, 4):
    y = reverb(mix, seed)
    L = SR * LOOP
    X = SR * TAIL
    out = y[:L].copy()
    k = np.linspace(0.0, 1.0, X)
    out[:X] = out[:X] * np.sin(k * np.pi / 2) + y[L:L + X] * np.cos(k * np.pi / 2)     # шов петли
    chan.append(out)
st = np.stack(chan, axis=1)
st = np.tanh(st / (np.abs(st).max() + 1e-9) * 1.25) * 0.8
pcm = (st * 32767).astype(np.int16)
with wave.open("/tmp/music_menu.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", "/tmp/music_menu.wav", "-c:a", "libvorbis", "-q:a", "3", OUT], check=True)
print(OUT, "%.0f с" % LOOP)
