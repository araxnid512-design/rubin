"""Разметка треугольников разрушителя на части: 0 корпус, 1 голова, 2 рука L(-x), 3 рука R(+x), 4 нога FL, 5 нога FR, 6 нога B.
python3 -I seg.py dk_pos.bin out_labels.bin preview.png"""
import sys
import numpy as np
from PIL import Image, ImageDraw

P = np.fromfile(sys.argv[1], dtype=np.float32).reshape(-1, 3)
I = np.fromfile(sys.argv[1] + '.idx', dtype=np.uint32).reshape(-1, 3)
C = P[I].mean(1)  # центры треугольников
x, y, z = C[:, 0], C[:, 1], C[:, 2]
lab = np.zeros(len(C), np.uint8)
HUB_Y = float(sys.argv[4]) if len(sys.argv) > 4 else -0.24
r = np.hypot(x, z)
# ноги: ниже корпуса, либо снаружи корпуса на уровне таза
leg = (y < HUB_Y) | ((y < HUB_Y + 0.16) & (r > 0.36))
back = leg & (z < -0.2) & (np.abs(x) < 0.42)
lab[leg & ~back & (x < 0)] = 4
lab[leg & ~back & (x >= 0)] = 5
lab[back] = 6
# руки: по бокам корпуса, от плеча до стволов
ARM_X = float(sys.argv[5]) if len(sys.argv) > 5 else 0.42
arm = ~leg & (np.abs(x) > ARM_X) & (y > HUB_Y) & (y < 0.66) & (z > -0.25)
lab[arm & (x < 0)] = 2
lab[arm & (x >= 0)] = 3
# голова: спереди по центру
head = ~leg & ~arm & (z > 0.22) & (np.abs(x) < 0.27) & (y > 0.22) & (y < 0.7)
lab[head] = 1
lab.tofile(sys.argv[2])
print('счёт частей', np.bincount(lab, minlength=7))
for k in range(7):
    m = lab == k
    if m.any(): print(k, 'min', C[m].min(0).round(2), 'max', C[m].max(0).round(2))

COL = [(120, 120, 120), (230, 30, 30), (30, 90, 230), (30, 200, 230), (40, 170, 40), (220, 180, 0), (200, 40, 200)]
def view(a, b, flip, w=500):
    im = Image.new('RGB', (w, w), 'white'); d = ImageDraw.Draw(im)
    for g in np.arange(-1, 1.01, 0.1):
        gx = (g + 1) * w / 2; c = (255, 150, 150) if abs(g) < 1e-6 else (225, 225, 245); d.line((gx, 0, gx, w), fill=c); d.line((0, gx, w, gx), fill=c)
    order = np.argsort(C[:, 3 - a - b] * (1 if flip else -1)) if False else range(len(C))
    for i in order:
        px = (C[i, a] + 1) * w / 2; py = (1 - C[i, b]) * w / 2 if b == 1 else (C[i, b] + 1) * w / 2
        d.point((px, py), fill=COL[lab[i]])
    return im
W = Image.new('RGB', (1500, 500)); W.paste(view(0, 1, 0), (0, 0)); W.paste(view(2, 1, 0), (500, 0)); W.paste(view(0, 2, 0), (1000, 0)); W.save(sys.argv[3])
