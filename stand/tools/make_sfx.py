"""Свои звуки (синтез, без чужих записей): шаги по бетону, дереву и металлу, скрип двери, ворота гаража.
Запуск из stand/: python3 tools/make_sfx.py — пишет assets/audio/*.ogg (нужен ffmpeg)."""
import numpy as np, wave, subprocess, os, tempfile
SR = 44100
rng = np.random.default_rng(7)
OUT = "assets/audio"

def env(n, a=0.002, d=0.08):
    t = np.arange(n) / SR
    return np.minimum(t / a, 1.0) * np.exp(-t / d)

def noise(n, lo, hi):
    x = rng.standard_normal(n)
    f = np.fft.rfft(x); fr = np.fft.rfftfreq(n, 1 / SR)
    f[(fr < lo) | (fr > hi)] = 0
    y = np.fft.irfft(f, n)
    return y / (np.abs(y).max() + 1e-9)

def tone(n, f, d):
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * f * t) * np.exp(-t / d)

def save(name, x, gain=0.8):
    x = x / (np.abs(x).max() + 1e-9) * gain
    fd, tmp = tempfile.mkstemp(suffix=".wav"); os.close(fd)
    with wave.open(tmp, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-c:a", "libvorbis", "-q:a", "3", f"{OUT}/{name}.ogg"], check=True)
    os.remove(tmp)

for i in range(1, 5):   # бетон: сухой короткий стук подошвы и шорох песка
    n = int(SR * 0.16); k = rng.uniform(0.9, 1.1)
    x = noise(n, 900, 5200) * env(n, 0.001, 0.018 * k) + 0.6 * tone(n, 130 * k, 0.02) + 0.25 * noise(n, 2500, 9000) * env(n, 0.02, 0.05)
    save(f"step_concrete_{i}", x, 0.7)
for i in range(1, 5):   # доски: глухой гулкий удар, лёгкий скрип
    n = int(SR * 0.24); k = rng.uniform(0.88, 1.12)
    x = tone(n, 150 * k, 0.05) + 0.6 * tone(n, 310 * k, 0.03) + 0.5 * noise(n, 300, 2200) * env(n, 0.001, 0.02)
    x += 0.12 * np.sin(2 * np.pi * (900 * k + 250 * np.arange(n) / n) * np.arange(n) / SR) * env(n, 0.05, 0.06)
    save(f"step_wood_{i}", x, 0.75)
for i in range(1, 5):   # металл (помост гаража): стук со звоном листа
    n = int(SR * 0.35); k = rng.uniform(0.9, 1.1)
    x = 0.8 * noise(n, 600, 4000) * env(n, 0.001, 0.012)
    for f, d, a in [(420, 0.09, 0.7), (790, 0.07, 0.5), (1330, 0.05, 0.35), (2150, 0.035, 0.25)]:
        x += a * tone(n, f * k, d)
    save(f"step_metal_{i}", x, 0.6)
for i in range(1, 3):   # дверь: протяжный скрип петель
    n = int(SR * 0.7); t = np.arange(n) / SR; k = rng.uniform(0.9, 1.15)
    f = (520 + 260 * np.sin(2 * np.pi * 1.3 * t + i) + 90 * np.sin(2 * np.pi * 7 * t)) * k
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = (np.sign(np.sin(ph)) * 0.35 + np.sin(ph) * 0.65) * (0.5 + 0.5 * np.sin(2 * np.pi * 23 * t) ** 2)
    x = x * np.minimum(t / 0.08, 1.0) * np.minimum((t[-1] - t) / 0.2, 1.0) + 0.15 * noise(n, 1500, 6000) * np.minimum((t[-1] - t) / 0.3, 1.0)
    save(f"door_creak_{i}", x, 0.45)
# ворота гаража: тяжёлый скрип и дребезг листа, в конце — удар створки об упор
n = int(SR * 1.5); t = np.arange(n) / SR
f = 190 + 70 * np.sin(2 * np.pi * 0.8 * t) + 30 * np.sin(2 * np.pi * 5 * t)
ph = 2 * np.pi * np.cumsum(f) / SR
x = (np.sign(np.sin(ph)) * 0.4 + np.sin(ph) * 0.6) * (0.4 + 0.6 * np.sin(2 * np.pi * 11 * t) ** 2) * np.minimum(t / 0.15, 1.0) * np.minimum((1.25 - t).clip(0) / 0.25, 1.0)
x += 0.35 * noise(n, 800, 5000) * (0.3 + 0.7 * np.sin(2 * np.pi * 17 * t) ** 2) * np.minimum((1.25 - t).clip(0) / 0.25, 1.0)
m = int(SR * 0.25); s0 = int(SR * 1.22)
x[s0:s0 + m] += 1.4 * (noise(m, 80, 2500) * env(m, 0.001, 0.03) + tone(m, 95, 0.06) + 0.5 * tone(m, 640, 0.05))
save("gate_open", x, 0.6)
print("готово")
