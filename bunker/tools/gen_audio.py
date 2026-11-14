#!/usr/bin/env python3
"""Звуки BUNKER SURVIVAL (синтез, без чужих записей): ветер, гул генератора/вентиляции, капель, щелчки
дозиметра, шаги по бетону/земле/в костюме, двери, гермодверь. Запуск: python3 tools/gen_audio.py"""
import numpy as np, wave, os
SR = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'audio')
rng = np.random.default_rng(7)

def save(name, x, sr=SR):
    x = np.clip(x / (np.max(np.abs(x)) + 1e-9) * 0.85, -1, 1)
    with wave.open(os.path.join(OUT, name + '.wav'), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767).astype('<i2').tobytes())

def lp(x, a):  # однополюсный фильтр низких частот
    y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x):
        s += a * (v - s); y[i] = s
    return y

def loopable(x, fade=SR // 2):
    # бесшовный цикл: конец плавно переходит в начало
    a = x[:fade] * np.linspace(0, 1, fade); b = x[-fade:] * np.linspace(1, 0, fade)
    y = x[fade:].copy(); y[-fade:] = b + a
    return y

def env(n, att, dec):
    t = np.arange(n) / SR
    return np.minimum(1, t / max(att, 1e-4)) * np.exp(-t / dec)

# ветер: шум, медленно меняющиеся полосы
n = SR * 12
w = rng.standard_normal(n)
gust = 0.55 + 0.45 * np.sin(np.linspace(0, 2 * np.pi * 3, n) + 1.3) * np.sin(np.linspace(0, 2 * np.pi * 1, n))
wind = lp(w, 0.02) * gust + lp(w, 0.08) * 0.25 * gust
save('amb_wind', loopable(wind))
# гул: генератор 50 Гц + гармоники, вентилятор — шум
t = np.arange(SR * 8) / SR
hum = (np.sin(2 * np.pi * 50 * t) * 0.5 + np.sin(2 * np.pi * 100 * t) * 0.3 + np.sin(2 * np.pi * 150 * t) * 0.12
       + np.sin(2 * np.pi * 25 * t) * 0.25 * (1 + 0.2 * np.sin(2 * np.pi * 0.5 * t)))
hum += lp(rng.standard_normal(len(t)), 0.05) * 0.6
save('amb_hum', loopable(hum))
# капель
n = SR * 10
drip = np.zeros(n)
for k in range(9):
    p = int(rng.uniform(0.05, 0.95) * n); m = int(SR * 0.25)
    tt = np.arange(m) / SR
    f = rng.uniform(900, 1700)
    drip[p:p + m] += np.sin(2 * np.pi * f * tt * (1 + 2.5 * tt)) * np.exp(-tt / 0.04) * rng.uniform(0.4, 1)
drip += lp(rng.standard_normal(n), 0.01) * 0.03
save('amb_drip', drip)
# дозиметр: случайные щелчки (частоту меняет скорость проигрывания)
n = SR * 6
g = np.zeros(n)
for k in range(70):
    p = int(rng.uniform(0, 1) * (n - 200))
    g[p:p + 60] += rng.standard_normal(60) * np.exp(-np.arange(60) / 8)
save('amb_geiger', g)
# шаги
def step(name, bright, dur, noise_lp, thud, crunch=0.0):
    m = int(SR * dur); tt = np.arange(m) / SR
    x = lp(rng.standard_normal(m), noise_lp) * env(m, 0.002, dur / 4)
    x += np.sin(2 * np.pi * thud * tt) * env(m, 0.001, 0.03) * 0.8
    if crunch:
        for k in range(6):
            p = int(rng.uniform(0, 0.5) * m)
            x[p:p + 120] += rng.standard_normal(120) * crunch * np.exp(-np.arange(120) / 30)
    save(name, x * bright)
step('step_concrete', 1.0, 0.18, 0.35, 90)
step('step_dirt', 1.0, 0.22, 0.12, 70, crunch=0.4)
step('step_suit', 1.0, 0.25, 0.08, 60, crunch=0.15)
# двери
def door(name, dur, f0, f1, latch_at):
    m = int(SR * dur); tt = np.arange(m) / SR
    sweep = np.sin(2 * np.pi * np.cumsum(np.linspace(f0, f1, m)) / SR)
    x = sweep * lp(rng.standard_normal(m), 0.3) * 0.4 * np.minimum(1, tt / 0.05)
    p = int(latch_at * m); L = int(SR * 0.08)
    x[p:p + L] += np.sin(2 * np.pi * 180 * np.arange(L) / SR) * np.exp(-np.arange(L) / 300) * 2
    x[p:p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 150)
    save(name, x * np.exp(-tt / (dur * 0.8)))
door('door_open', 0.7, 300, 520, 0.05)
door('door_close', 0.6, 480, 260, 0.85)
# гермодверь: штурвал, тяжёлый скрип, удар
m = int(SR * 2.6); tt = np.arange(m) / SR
x = np.zeros(m)
for k in range(5):
    p = int(SR * (0.05 + k * 0.12)); L = int(SR * 0.05)
    x[p:p + L] += rng.standard_normal(L) * np.exp(-np.arange(L) / 200) * 0.6
creak = np.sin(2 * np.pi * np.cumsum(70 + 25 * np.sin(2 * np.pi * 1.7 * tt)) / SR) * lp(rng.standard_normal(m), 0.4)
x += creak * 0.5 * np.clip((tt - 0.6) / 0.3, 0, 1) * np.clip((2.3 - tt) / 0.3, 0, 1)
p = int(SR * 2.3); L = m - p
x[p:] += np.sin(2 * np.pi * 55 * np.arange(L) / SR) * np.exp(-np.arange(L) / 1800) * 2 + rng.standard_normal(L) * np.exp(-np.arange(L) / 400)
save('blast_door', x)
# удар кулаком и попадание
m = int(SR * 0.25); tt = np.arange(m) / SR
save('punch', lp(rng.standard_normal(m), 0.25) * env(m, 0.001, 0.04) + np.sin(2 * np.pi * 110 * tt) * env(m, 0.001, 0.05))
save('swoosh', lp(rng.standard_normal(m), 0.15) * np.sin(np.pi * tt / 0.25) ** 2)
print('ok', sorted(os.listdir(OUT)))
