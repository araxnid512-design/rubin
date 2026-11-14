#!/usr/bin/env python3
"""Текстуры для телефона: всем картинкам в assets/ — сжатие для видеочипа (ETC2/ASTC), не больше 1024 пикселей,
карты нормалей — как нормали. Нужен после чистого импорта: импортёр GLB сам создаёт .import для извлечённых
текстур с настройками «без потерь» (огромный размер). Запуск: python3 tools/fix_imports.py, затем импорт заново."""
import glob, os, re
root = os.path.join(os.path.dirname(__file__), '..')
n = 0
for f in glob.glob(os.path.join(root, 'assets', '**', '*.import'), recursive=True):
    if '/anim/src/' in f or not re.search(r'\.(jpg|jpeg|png)\.import$', f):
        continue
    s = open(f, encoding='utf-8').read()
    t = re.sub(r'compress/mode=\d', 'compress/mode=2', s)
    # нормали и карты AO/шероховатости окружения — 512: с камеры сверху разница не видна, а весят они больше
    # половины пакета; цветные карты и текстуры персонажей — 1024
    fp = f.replace(os.sep, '/')
    lim = 512 if ('/assets/textures/' in fp and re.search(r'_(n|a)\.(jpg|png)\.import$', f)) else 1024
    # модели Tripo: нормали и карты шероховатости/металла — 512 (с камеры сверху модели мелкие), цвет — 1024
    if '/assets/models/' in fp and re.search(r'_glb_(normal|rm)\.(jpg|png)\.import$', f):
        lim = 512
    if 'process/size_limit=' in t:
        t = re.sub(r'process/size_limit=\d+', 'process/size_limit=%d' % lim, t)
    else:
        t = t.replace('[params]\n', '[params]\n\nprocess/size_limit=%d\n' % lim, 1)
    if re.search(r'(_n|_normal)\.(jpg|png)\.import$', f):
        t = re.sub(r'compress/normal_map=\d', 'compress/normal_map=1', t)
    t = t.replace('"vram_texture": false', '"vram_texture": true')
    if t != s:
        open(f, 'w', encoding='utf-8').write(t)
        n += 1
print('исправлено файлов импорта:', n)
