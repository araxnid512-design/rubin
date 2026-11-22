# Звук мотора УАЗа (свой, синтез с нуля, без чужих записей): engine_loop — ровный рокот четырёхцилиндрового
# мотора на холостых, кольцо без шва (целое число периодов). В игре высота тона растёт со скоростью машины.
# Запуск: python3 stand/tools/make_car_assets.py <папка> → engine_loop.wav;
# затем ffmpeg -i engine_loop.wav -c:a libvorbis -q:a 4 engine_loop.ogg → stand/assets/audio/.
import numpy as np, wave, sys
SR = 44100
OUT = sys.argv[1]
rng = np.random.default_rng(11)
F0 = 30.0                       # вспышки в цилиндрах, Гц (≈900 об/мин × 4 цилиндра / 2)
n = int(SR * 2.0)               # 2 с = 60 периодов — кольцо без шва
t = np.arange(n) / SR
x = np.zeros(n)
for h, a in [(1, 1.0), (2, 0.55), (3, 0.32), (4, 0.22), (6, 0.12), (8, 0.06)]:
    x += a * np.sin(2 * np.pi * F0 * h * t + rng.uniform(0, 2 * np.pi))
# «удары» вспышек: короткие импульсы раз в период, чуть неровные
pulse = np.zeros(n)
per = SR / F0
for i in range(int(n / per)):
    s = int(i * per + rng.uniform(-6, 6)) % n
    k = 260
    pulse[s:s + k] += np.exp(-np.arange(min(k, n - s)) / 70.0) * rng.uniform(0.7, 1.0)
X = np.fft.rfft(rng.standard_normal(n))
f = np.fft.rfftfreq(n, 1.0 / SR)
noise = np.fft.irfft(X / (1.0 + (f / 900.0) ** 3) / (1.0 + (60.0 / np.maximum(f, 1.0)) ** 2), n)
x = x * 0.6 + np.convolve(pulse, np.ones(1), "same") * 0.9 * noise / (np.std(noise) + 1e-9) * 0.25 + noise / (np.std(noise) + 1e-9) * 0.08
x = x / (np.max(np.abs(x)) + 1e-9) * 0.85
with wave.open(f"{OUT}/engine_loop.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((x * 32767).astype(np.int16).tobytes())
print("engine_loop.wav")
