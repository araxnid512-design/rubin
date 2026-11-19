# Звуки главаря муров — синтез с нуля (свои, без чужих записей): выстрел тяжёлого пистолета (два варианта),
# взрыв гранаты, стук упавшей гранаты.
# Запуск: python3 stand/tools/make_boss_sounds.py <папка> → shot_deagle_1.wav, shot_deagle_2.wav, grenade_boom.wav,
# grenade_tink.wav; затем ffmpeg -i X.wav -c:a libvorbis -q:a 5 X.ogg → stand/assets/audio/. Нужен numpy.
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


def env(n, a, d):
    t = np.arange(n) / SR
    return np.minimum(1.0, t / max(a, 1e-4)) * np.exp(-np.clip(t - a, 0, None) / max(d, 1e-4))


def sweep(n, f0, f1, tau):
    t = np.arange(n) / SR
    f = f1 + (f0 - f1) * np.exp(-t / tau)
    return np.sin(2 * np.pi * np.cumsum(f) / SR)


def save(name, x, peak=0.93):
    x = x / (np.abs(x).max() + 1e-9) * peak
    fade = int(SR * 0.03)
    x[-fade:] *= np.linspace(1.0, 0.0, fade)
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


def shot(seed, tone):
    rng = np.random.default_rng(seed)
    n = int(SR * 0.9)
    # щелчок-удар в самом начале: широкополосный, очень короткий
    crack = band(rng.standard_normal(n), 700, 9000) * env(n, 0.0006, 0.012) * 1.3
    # тело выстрела: средние частоты, плотное
    body = band(rng.standard_normal(n), 120, 1800) * env(n, 0.001, 0.07) * 1.5
    # низкий толчок — «пушечность» крупного калибра
    thump = sweep(n, 190 * tone, 52 * tone, 0.035) * env(n, 0.001, 0.13) * 1.6
    # раскат по помещению: глухой хвост с двумя отражениями
    tail = band(rng.standard_normal(n), 90, 1100) * env(n, 0.02, 0.24) * 0.42
    x = crack + body + thump + tail
    for dl, g in ((0.061, 0.28), (0.127, 0.16)):
        k = int(SR * dl)
        x[k:] += band(x, 0, 2400)[:-k] * g
    return np.tanh(x * 1.6)


def boom(seed):
    rng = np.random.default_rng(seed)
    n = int(SR * 2.4)
    crack = band(rng.standard_normal(n), 500, 8000) * env(n, 0.0008, 0.02) * 1.2
    blast = band(rng.standard_normal(n), 40, 900) * env(n, 0.002, 0.3) * 1.8
    sub = sweep(n, 110, 30, 0.09) * env(n, 0.002, 0.5) * 2.0
    rumble = band(rng.standard_normal(n), 30, 320) * env(n, 0.08, 0.75) * 0.8
    x = crack + blast + sub + rumble
    # осыпь обломков после взрыва
    t = np.arange(n) / SR
    for _ in range(26):
        t0 = rng.uniform(0.18, 1.3)
        k = int(SR * t0)
        m = int(SR * 0.05)
        if k + m < n:
            x[k:k + m] += band(rng.standard_normal(m), 900, 6000) * env(m, 0.001, 0.009) * rng.uniform(0.05, 0.22) * (1.4 - t0)
    for dl, g in ((0.09, 0.3), (0.21, 0.18)):
        k = int(SR * dl)
        x[k:] += band(x, 0, 1500)[:-k] * g
    return np.tanh(x * 1.4)


def tink(seed):
    rng = np.random.default_rng(seed)
    n = int(SR * 0.5)
    x = np.zeros(n)
    t = np.arange(n) / SR
    for t0, a in ((0.0, 1.0), (0.16, 0.55), (0.27, 0.3)):
        k = int(SR * t0)
        m = n - k
        tt = t[:m]
        ping = (np.sin(2 * np.pi * 2350 * tt) * 0.6 + np.sin(2 * np.pi * 3720 * tt) * 0.35 + np.sin(2 * np.pi * 5480 * tt) * 0.2) * np.exp(-tt / 0.035)
        knock = band(rng.standard_normal(m), 300, 3000) * env(m, 0.0005, 0.006) * 0.9
        x[k:] += (ping + knock) * a
    return x


save("shot_deagle_1", shot(11, 1.0))
save("shot_deagle_2", shot(23, 0.93))
save("grenade_boom", boom(5))
save("grenade_tink", tink(7), 0.7)
