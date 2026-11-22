# Погода и жизнь (свои, синтез с нуля, без чужих записей):
#  rain_loop — шум дождя (полоса 250–9000 Гц, капли-щелчки), кольцо без шва;
#  flies — жужжание мух у тела (2–3 мухи, пила с дрожью частоты и громкости);
#  clouds.png — бесшовный шум для теней облаков (размытый белый шум через FFT — края совпадают сами).
# Запуск: python3 stand/tools/make_weather_assets.py <папка> → rain_loop.wav, flies.wav, clouds.png;
# затем ffmpeg -i X.wav -c:a libvorbis -q:a 4 X.ogg → stand/assets/audio/, clouds.png → stand/assets/world/tex/.
import numpy as np, wave, sys
from PIL import Image
SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(7)


def band(x, lo, hi):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    m = np.ones_like(f)
    if lo > 0:
        m *= 1.0 / (1.0 + (lo / np.maximum(f, 1.0)) ** 4)
    if hi > 0:
        m *= 1.0 / (1.0 + (f / hi) ** 4)
    # розовый наклон: тише к верху
    m *= 1.0 / np.sqrt(np.maximum(f, 60.0) / 60.0) ** 0.6
    return np.fft.irfft(X * m, len(x))


def save(name, x):
    x = x / (np.max(np.abs(x)) + 1e-9) * 0.85
    with wave.open(f"{OUT}/{name}.wav", "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((x * 32767).astype(np.int16).tobytes())


# --- дождь: 8 с, кольцо (FFT-шум периодичен сам), поверх — капли ---
n = SR * 8
x = band(rng.standard_normal(n), 250, 9000)
slow = 1.0 + 0.15 * np.sin(2 * np.pi * np.arange(n) / n * 3) + 0.08 * np.sin(2 * np.pi * np.arange(n) / n * 7)
x *= slow
for i in range(900):
    s = rng.integers(0, n)
    k = int(SR * rng.uniform(0.004, 0.012))
    t = np.arange(k) / SR
    d = np.sin(2 * np.pi * rng.uniform(1800, 5200) * t) * np.exp(-t / 0.002) * rng.uniform(0.3, 1.0)
    idx = (s + np.arange(k)) % n
    x[idx] += d * 2.2
save("rain_loop", x)

# --- мухи: 2,5 с, 3 мухи ---
n = int(SR * 2.5)
t = np.arange(n) / SR
x = np.zeros(n)
for f0 in (190.0, 222.0, 251.0):
    ph = rng.uniform(0, 6.28)
    fr = f0 * (1.0 + 0.05 * np.sin(2 * np.pi * rng.uniform(0.7, 1.6) * t + ph) + 0.02 * np.sin(2 * np.pi * 9.0 * t))
    p = 2 * np.pi * np.cumsum(fr) / SR
    saw = 2.0 * ((p / (2 * np.pi)) % 1.0) - 1.0
    amp = 0.5 + 0.5 * np.sin(2 * np.pi * rng.uniform(0.3, 0.9) * t + ph) ** 2
    x += saw * amp
x = band(x, 120, 3500)
fade = np.minimum(1.0, np.minimum(t / 0.3, (t[-1] - t) / 0.4))
save("flies", x * fade)

# --- облака: 512², бесшовные ---
N = 512
w = rng.standard_normal((N, N))
F = np.fft.fft2(w)
fy = np.fft.fftfreq(N)[:, None]
fx = np.fft.fftfreq(N)[None, :]
r = np.sqrt(fx * fx + fy * fy) + 1e-6
F *= 1.0 / r ** 1.9 * (r < 0.25)
c = np.real(np.fft.ifft2(F))
c = (c - c.min()) / (c.max() - c.min())
Image.fromarray((c * 255).astype(np.uint8), "L").save(f"{OUT}/clouds.png")
print("ok")
