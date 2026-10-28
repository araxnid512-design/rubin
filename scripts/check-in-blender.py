"""Проверка, что models/zombie.glb корректно открывается в Blender.

Запуск: blender -b -P scripts/check-in-blender.py -- models/zombie.glb
   или (Blender как Python-модуль): python3.11 scripts/check-in-blender.py models/zombie.glb
"""
import sys

import bpy

path = sys.argv[sys.argv.index('--') + 1] if '--' in sys.argv else sys.argv[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=path)

arm = [o for o in bpy.data.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
actions = sorted(a.name for a in bpy.data.actions)
verts = sum(len(m.data.vertices) for m in meshes)
images = [i.name for i in bpy.data.images]
print(f'Арматура: {len(arm)}, костей: {len(arm[0].data.bones) if arm else 0}')
print(f'Меши: {len(meshes)}, вершин: {verts}, материалы: {sorted(m.name for m in bpy.data.materials)}')
print(f'Текстуры: {len(images)}')
print(f'Анимации: {actions}')
ok = len(arm) == 1 and len(arm[0].data.bones) in (19, 56) and len(actions) >= 5 and all(any(n in a for a in actions) for n in ['Idle', 'Walk', 'Run', 'Death'])
print('BLENDER: OK' if ok else 'BLENDER: FAIL')
sys.exit(0 if ok else 1)
