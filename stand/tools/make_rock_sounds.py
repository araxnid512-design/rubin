# Звуки броска камня Рубера — синтез с нуля (свои, без чужих записей): вырывает камень из земли, бросок, удар.
# Запуск: python3 stand/tools/make_rock_sounds.py <папка> → rock_rip.wav, rock_throw.wav, rock_hit_1.wav, rock_hit_2.wav;
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

def brown(n, rng):
    w = rng.standard_normal(n)
    b = np.cumsum(w)
    b -= np.convolve(b, np.ones(2001) / 2001, mode="same")     # без ухода постоянной составляющей
    return b / (np.abs(b).max() + 1e-9)

def env(n, a, d, sus=0.0, hold=0.0):
    t = np.arange(n) / SR
    e = np.minimum(1.0, t / max(a, 1e-4))
    rel = np.clip(t - a - hold, 0, None)
    return e * np.where(t < a + hold, 1.0, np.exp(-rel / max(d, 1e-4)) * (1 - sus) + sus)

def crackles(n, rng, t0, t1, count, lo=1800, hi=7000, decay=0.006, amp=1.0, fade=True):
    out = np.zeros(n)
    for _ in range(count):
        t = rng.uniform(t0, t1)
        i = int(t * SR)
        L = int(SR * decay * rng.uniform(2, 6))
        if i + L >= n:
            continue
        burst = rng.standard_normal(L) * np.exp(-np.arange(L) / (SR * decay))
        k = amp * rng.uniform(0.25, 1.0) * (np.exp(-(t - t0) / max(t1 - t0, 1e-3) * 1.6) if fade else 1.0)
        out[i:i + L] += burst * k
    return band(out, lo, hi)

def thump(n, rng, t0, f0, f1, dec, amp):
    t = np.arange(n) / SR - t0
    t = np.clip(t, 0, None)
    f = f1 + (f0 - f1) * np.exp(-t / 0.06)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / dec) * (np.arange(n) / SR >= t0)
    return s * amp

def save(name, x, peak_db=-3.0):
    x = x - np.mean(x)
    fade = int(SR * 0.02)
    x[-fade:] *= np.linspace(1, 0, fade)
    x[:64] *= np.linspace(0, 1, 64)
    x = x / (np.abs(x).max() + 1e-9) * 10 ** (peak_db / 20)
    pcm = (x * 32767).astype(np.int16)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

# 1) вырывает камень: нарастающий гул земли, хруст и треск (корни, дёрн), осыпь мелких камешков
for v, seed in [(1, 11)]:
    rng = np.random.default_rng(seed)
    n = int(SR * 1.15)
    rumble = band(brown(n, rng), 25, 180) * env(n, 0.28, 0.35, hold=0.25)
    grind = band(rng.standard_normal(n), 120, 900) * env(n, 0.25, 0.25, hold=0.2) * 0.35
    crack = crackles(n, rng, 0.30, 0.42, 9, lo=900, hi=5000, decay=0.008, amp=1.6, fade=False)
    snap = thump(n, rng, 0.36, 160, 70, 0.07, 0.8)
    debris = crackles(n, rng, 0.42, 1.05, 70, lo=2200, hi=9000, decay=0.003, amp=0.55)
    save(f"rock_rip", rumble * 0.9 + grind + crack + snap + debris)

# 2) бросок: тяжёлый низкий свист проносящейся глыбы и короткий выдох-напор
for v, seed in [(1, 21)]:
    rng = np.random.default_rng(seed)
    n = int(SR * 0.62)
    t = np.arange(n) / SR
    bell = np.exp(-((t - 0.24) / 0.11) ** 2)
    air = np.zeros(n)
    # полоса шума, середина которой уходит вверх и обратно (пролёт)
    seg = 1024
    noise = rng.standard_normal(n + seg)
    for i in range(0, n, seg // 2):
        c = 280 + 650 * np.exp(-((i / SR - 0.24) / 0.12) ** 2)
        part = band(noise[i:i + seg], c * 0.55, c * 1.7) * np.hanning(seg)
        air[i:i + seg] += part[: max(0, min(seg, n - i))] if i + seg <= n else part[: n - i]
    body = thump(n, rng, 0.05, 110, 60, 0.18, 0.35) * 0.6
    save("rock_throw", air * bell * 1.0 + body + band(brown(n, rng), 30, 160) * bell * 0.5)

# 3) удар о землю: глухой тяжёлый удар (низкий тон с падением), шлепок грунта, разлёт осколков и осыпь
for v, seed in [(1, 31), (2, 47)]:
    rng = np.random.default_rng(seed)
    n = int(SR * 1.45)
    boom = thump(n, rng, 0.0, 95 + 10 * v, 42, 0.16, 1.0)
    sub = thump(n, rng, 0.0, 60, 32, 0.3, 0.6)
    slap = band(rng.standard_normal(n), 150, 1400) * env(n, 0.002, 0.045) * 0.9
    dirt = band(brown(n, rng), 40, 500) * env(n, 0.004, 0.22) * 0.8
    chips = crackles(n, rng, 0.02, 0.25, 22, lo=1500, hi=7000, decay=0.006, amp=1.2)
    settle = crackles(n, rng, 0.2, 1.3, 55, lo=2500, hi=9000, decay=0.003, amp=0.4)
    save(f"rock_hit_{v}", boom + sub + slap + dirt + chips + settle)
print("ok")
