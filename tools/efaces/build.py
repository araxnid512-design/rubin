# Портреты врагов и мутантов (снимки голов 3D-моделей, tools/efaces/render.js → tools/efaces/src/*.jpg;
# можно заменить своими картинками с теми же именами) → game/js/efaces.js (картинки внутри файла).
# Запуск: python3 tools/efaces/build.py
import base64, io, os
from PIL import Image
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..')
SRC = os.path.join(ROOT, 'tools/efaces/src')
# тип врага → портрет (варианты тел — свои портреты, тип берёт первый)
NAMES = ['scav', 'scav2', 'alpha', 'queen', 'brute', 'spitter', 'guardian', 'mur1', 'bandit3', 'bandit4', 'mur2', 'bandit5', 'marksman', 'boss',
         'sobr1', 'sobr2', 'sobr3', 'sobr4', 'sobr5', 'clan1', 'clan2', 'clan3', 'clan4', 'clan5', 'clan6']
out = {}
for n in NAMES:
    p = os.path.join(SRC, n + '.jpg')
    if not os.path.exists(p):
        p = os.path.join(SRC, n + '.png')
    if not os.path.exists(p):
        continue
    im = Image.open(p).convert('RGB')
    w, h = im.size; s = min(w, h)
    im = im.crop(((w - s) // 2, (h - s) // 2, (w - s) // 2 + s, (h - s) // 2 + s)).resize((192, 192), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'WEBP', quality=82, method=6)
    out[n] = 'data:image/webp;base64,' + base64.b64encode(buf.getvalue()).decode()
js = "'use strict';\n/* Портреты врагов и мутантов, сгенерировано tools/efaces/build.py — не править руками */\nwindow.DW = window.DW || {};\nDW.EFACE_IMG = {\n" + ',\n'.join("  " + k + ": '" + v + "'" for k, v in out.items()) + "\n};\n"
open(os.path.join(ROOT, 'game/js/efaces.js'), 'w').write(js)
print(len(out), 'портретов,', len(js) // 1024, 'КБ')
