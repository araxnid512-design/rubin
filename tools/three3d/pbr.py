#!/usr/bin/env python3
"""PBR-материалы Poly Haven (CC0) для 3D-боя: цвет, нормали (OpenGL), ARM (AO/шероховатость/металл).
Скачиваются 1K-версии в art3d/pbr/, в игру (game/tex3d/) — ужатые JPEG: <вид>_c.jpg, <вид>_n.jpg, <вид>_a.jpg.
Размер в игре: 512 (земля и стены повторяются по клеткам — больше не нужно на экране телефона)."""
import json, os, sys, urllib.request
from PIL import Image
R = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = os.path.join(R, 'art3d', 'pbr'); OUT = os.path.join(R, 'game', 'tex3d')
os.makedirs(SRC, exist_ok=True); os.makedirs(OUT, exist_ok=True)
# вид в игре → id на polyhaven.com
MATS = {
    'grain': 'gravelly_sand', 'ash': 'ground_grey', 'earth': 'mud_cracked_dry_03', 'concrete': 'concrete_floor_worn_001',
    'metal': 'metal_plate', 'cave': 'rocks_ground_02', 'rubble': 'rocky_gravel', 'wood': 'weathered_brown_planks',
    'asphalt': 'asphalt_02', 'planks': 'brown_planks_03', 'flesh': 'brown_mud_leaves_01',
    'brick': 'red_brick_03', 'plaster': 'cracked_concrete_wall', 'stone': 'rustic_stone_wall_02', 'bulkhead': 'rusty_metal_02',
    'rock': 'rock_face_03', 'roof': 'corrugated_iron_02', 'cliff': 'aerial_rocks_02'
}
SIZE = int(os.environ.get('SIZE', '512'))
UA = {'User-Agent': 'deadworld-texture-fetch'}
def get(url, path):
    if os.path.exists(path): return
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60) as r, open(path, 'wb') as f: f.write(r.read())
only = sys.argv[1:] or list(MATS)
for k in only:
    pid = MATS[k]
    info = json.load(urllib.request.urlopen(urllib.request.Request('https://api.polyhaven.com/files/' + pid, headers=UA), timeout=60))
    parts = {'c': info['Diffuse'], 'n': info['nor_gl'], 'a': info['arm']}
    for s, d in parts.items():
        src = os.path.join(SRC, f'{pid}_{s}_1k.jpg')
        get(d['1k']['jpg']['url'], src)
        im = Image.open(src).convert('RGB').resize((SIZE, SIZE), Image.LANCZOS)
        im.save(os.path.join(OUT, f'{k}_{s}.jpg'), quality=82 if s != 'n' else 88, optimize=True)
    print(k, pid, 'ok', flush=True)
