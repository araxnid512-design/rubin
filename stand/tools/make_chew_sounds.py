# Звук «ест» голодного пустыша (data/evolve.json) — синтез с нуля (свои, без чужих записей): влажный хруст,
# рывок плоти и короткое чавканье с рыком в горле. Три варианта.
# Запуск: python3 stand/tools/make_chew_sounds.py <папка> → chew_1.wav … chew_3.wav;
# затем ffmpeg -i X.wav -c:a libvorbis -q:a 5 X.ogg → stand/assets/audio/. Нужен numpy.
import numpy as np, wave, sys
SR = 44100
OUT = sys.argv[1]


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= 1.0 / (1.0 + (lo / np.maximum(f, 1.0)) ** 4)
    if hi > 0:
        m *= 1.0 / (1.0 + (f / hi) ** 4)
    return np.fft.irfft(X * m, len(x))


def burst(n, at, dur, rng, lo, hi, amp):
    out = np.zeros(n)
    k = int(dur * SR)
    s = int(at * SR)
    if s >= n:
        return out
    k = min(k, n - s)
    t = np.arange(k) / SR
    e = np.minimum(1.0, t / 0.004) * np.exp(-t / (dur * 0.35))
    out[s:s + k] = band(rng.standard_normal(k), lo, hi) * e * amp
    return out


def make(seed):
    rng = np.random.default_rng(seed)
    dur = 0.75
    n = int(dur * SR)
    x = np.zeros(n)
    # влажный хруст: серия щелчков (хрящ), каждый — узкая полоса
    for i in range(rng.integers(5, 9)):
        at = rng.uniform(0.02, 0.32)
        x += burst(n, at, rng.uniform(0.01, 0.03), rng, rng.uniform(900, 1800), rng.uniform(3500, 6500), rng.uniform(0.4, 1.0))
    # рывок плоти: мягкий низкий шорох
    x += burst(n, rng.uniform(0.05, 0.12), 0.22, rng, 120, 900, 0.9)
    # чавканье: два-три влажных шлепка в середине
    for i in range(rng.integers(2, 4)):
        x += burst(n, rng.uniform(0.3, 0.55), rng.uniform(0.04, 0.07), rng, 300, 2200, rng.uniform(0.6, 1.0))
    # рык в горле: низкий тон с дрожью
    t = np.arange(n) / SR
    f0 = rng.uniform(70, 95)
    g = np.sin(2 * np.pi * f0 * t + 3.0 * np.sin(2 * np.pi * 7.0 * t)) * (0.5 + 0.5 * rng.standard_normal(n).clip(-1, 1) * 0.3)
    g = band(g + 0.4 * rng.standard_normal(n), 60, 700)
    ge = np.clip((t - 0.25) / 0.1, 0, 1) * np.exp(-np.clip(t - 0.35, 0, None) / 0.22)
    x += g * ge * 0.35
    x *= np.minimum(1.0, (dur - t) / 0.05)
    x /= np.abs(x).max() + 1e-9
    return (x * 0.85 * 32767).astype(np.int16)


for i in range(1, 4):
    with wave.open("%s/chew_%d.wav" % (OUT, i), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(make(1700 + i).tobytes())
    print("chew_%d.wav" % i)
