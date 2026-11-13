# Аватары врагов от пользователя: сетка 7×2 (tools/efaces/avatars_grid.jpg) в порядке листа «враги в полный рост»
# → tools/efaces/src/<имя>.jpg (квадрат, лицо в верхней части); затем python3 tools/efaces/build.py
import os
from PIL import Image
import numpy as np
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
ORDER = ['scav', 'scav2', 'alpha', 'queen', 'brute', 'spitter', 'guardian', 'mur1', 'bandit3', 'bandit4', 'mur2', 'bandit5', 'marksman', 'boss']
im = Image.open(os.path.join(ROOT, 'tools/efaces/avatars_grid.jpg')).convert('RGB')
a = np.asarray(im).astype(int).sum(2)
def spans(dark, n):
    out, cur = [], None
    for i, d in enumerate(dark):
        if not d and cur is None: cur = i
        if d and cur is not None: out.append((cur, i)); cur = None
    if cur is not None: out.append((cur, len(dark)))
    out = [s for s in out if s[1] - s[0] > 60]
    assert len(out) == n, out
    return out
cols = spans((a < 45).mean(0) > 0.85, 7)
rows = spans((a < 45).mean(1) > 0.85, 2)
os.makedirs(os.path.join(ROOT, 'tools/efaces/src'), exist_ok=True)
k = 0
for r0, r1 in rows:
    for c0, c1 in cols:
        w, h = c1 - c0, r1 - r0
        s = min(w, h)
        x = c0 + (w - s) // 2
        y = r0 + int((h - s) * 0.25)          # лицо — в верхней части кадра
        im.crop((x, y, x + s, y + s)).save(os.path.join(ROOT, 'tools/efaces/src', ORDER[k] + '.jpg'), quality=93)
        k += 1
print(k, 'аватаров')
