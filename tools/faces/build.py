# Портреты бойцов из сетки фото 5×4 (tools/faces/faces_grid.jpg) → game/js/faces.js (картинки внутри файла:
# под file:// в APK холст с ними не «чужой», портрет можно сохранить в dataURL).
# Запуск: python3 tools/faces/build.py
import base64, io, os
from PIL import Image
import numpy as np
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
im = Image.open(os.path.join(ROOT, 'tools/faces/faces_grid.jpg')).convert('RGB')
a = np.asarray(im).astype(int).sum(2)
def spans(dark, n):
    # промежутки между тёмными линиями сетки
    out, cur = [], None
    for i, d in enumerate(dark):
        if not d and cur is None: cur = i
        if d and cur is not None: out.append((cur, i)); cur = None
    if cur is not None: out.append((cur, len(dark)))
    out = [s for s in out if s[1] - s[0] > 100]
    assert len(out) == n, out
    return out
cols = spans((a < 60).mean(0) > 0.9, 5)
rows = spans((a < 60).mean(1) > 0.9, 4)
SIZE = 192
faces = []
for r0, r1 in rows:
    for c0, c1 in cols:
        w, h = c1 - c0, r1 - r0
        side = int(min(w, h) * 0.8)
        x = c0 + (w - side) // 2
        y = r0 + int(h * 0.05)
        crop = im.crop((x, y, x + side, y + side)).resize((SIZE, SIZE), Image.LANCZOS)
        buf = io.BytesIO(); crop.save(buf, 'WEBP', quality=82, method=6)
        faces.append('data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode())
js = "'use strict';\n/* Портреты бойцов (фото), сгенерировано tools/faces/build.py — не править руками */\nwindow.DW = window.DW || {};\nDW.FACE_IMG = [\n" + ',\n'.join("'" + f + "'" for f in faces) + "\n];\n"
open(os.path.join(ROOT, 'game/js/faces.js'), 'w').write(js)
print(len(faces), 'лиц,', len(js) // 1024, 'КБ')
