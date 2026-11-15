"""Describe a 3D model so you can decide how to rig/animate it.

    python inspect_model.py model.glb [--png out.png]

Prints: objects, mesh sizes and bounds, whether meshes are skinned, the bone hierarchy with
world-space joint positions, existing animation clips, and a guessed role mapping for
creature_anim.Rig.from_armature(). For unrigged meshes it prints body cross-sections along
the length so you can place joints, and --png writes side/top/front silhouettes to look at.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Vector  # noqa: E402

import creature_anim as ca  # noqa: E402


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    png = sys.argv[sys.argv.index("--png") + 1] if "--png" in sys.argv else None
    if png in args:
        args.remove(png)
    path = args[0]
    ca.reset_scene()
    arms, meshes = ca.import_model(path)
    bpy.context.view_layer.update()
    print("FILE", path)
    pts = []
    for m in meshes:
        co = [m.matrix_world @ v.co for v in m.data.vertices]
        pts += co
        skinned = any(md.type == "ARMATURE" for md in m.modifiers)
        lo = [min(c[i] for c in co) for i in range(3)]
        hi = [max(c[i] for c in co) for i in range(3)]
        print("MESH %-24s verts=%-7d tris~%-7d skinned=%s groups=%d\n     bounds x[%.3f..%.3f] y[%.3f..%.3f] z[%.3f..%.3f]"
              % (m.name, len(co), sum(len(p.vertices) - 2 for p in m.data.polygons), skinned, len(m.vertex_groups),
                 lo[0], hi[0], lo[1], hi[1], lo[2], hi[2]))
    for a in arms:
        sc = a.matrix_world.to_scale()
        print("ARMATURE %s  bones=%d  object scale=(%.3f %.3f %.3f)  (positions below are WORLD space, Z up)"
              % (a.name, len(a.data.bones), *sc))

        def walk(b, depth):
            h = a.matrix_world @ b.head_local
            t = a.matrix_world @ b.tail_local
            print("  %s%-*s head(%7.3f %7.3f %7.3f) len %.3f%s" % ("  " * depth, max(1, 34 - 2 * depth), b.name, h.x, h.y, h.z,
                                                                 (t - h).length, "" if b.use_deform else "  [non-deform]"))
            for c in b.children:
                walk(c, depth + 1)
        for b in a.data.bones:
            if b.parent is None:
                walk(b, 0)
        print("GUESSED MAPPING (verify against the tree above!):")
        for k, v in ca.guess_mapping(a).items():
            print("   %r: %r," % (k, v))
    if bpy.data.actions:
        print("EXISTING CLIPS:")
        for act in bpy.data.actions:
            print("   %-28s frames %d..%d" % (act.name, act.frame_range[0], act.frame_range[1]))
    if pts and not arms:
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        size = hi - lo
        axis = 1 if size.y >= size.x else 0
        print("UNRIGGED. Longest horizontal axis: %s. Cross-sections along it (where is the mass? where do legs reach the floor?):" % "XY"[axis])
        n = 12
        for i in range(n):
            a0 = lo[axis] + size[axis] * i / n
            a1 = lo[axis] + size[axis] * (i + 1) / n
            sl = [p for p in pts if a0 <= p[axis] <= a1]
            if not sl:
                continue
            o = 1 - axis
            print("   %s %7.3f..%7.3f  z[%6.3f..%6.3f]  %s[%6.3f..%6.3f]  n=%d"
                  % ("XY"[axis], a0, a1, min(p.z for p in sl), max(p.z for p in sl), "XY"[o],
                     min(p[o] for p in sl), max(p[o] for p in sl), len(sl)))
        print("   Facing: models usually face -Y (Blender front). Check the silhouette to be sure.")
    if png and pts:
        from PIL import Image, ImageDraw
        cell = 420
        img = Image.new("RGB", (cell * 3, cell), "white")
        d = ImageDraw.Draw(img)
        lo = Vector([min(p[i] for p in pts) for i in range(3)])
        hi = Vector([max(p[i] for p in pts) for i in range(3)])
        sc = (cell - 60) / max(hi - lo)
        c = (lo + hi) / 2
        step = max(1, len(pts) // 20000)
        views = (("side  (-Y is left)", 1, 2), ("top  (+X right, -Y down)", 0, 1), ("front  (+X right)", 0, 2))
        for k, (label, ax, ay) in enumerate(views):
            ox, oy = k * cell + cell / 2, cell / 2 + 10
            d.text((k * cell + 8, 6), label, fill=(0, 0, 0))
            flip = -1 if (ax, ay) == (0, 1) else 1
            for p in pts[::step]:
                d.point((ox + (p[ax] - c[ax]) * sc, oy - flip * (p[ay] - c[ay]) * sc), fill=(120, 135, 150))
            for a in arms:
                for b in a.data.bones:
                    h, t = a.matrix_world @ b.head_local, a.matrix_world @ b.tail_local
                    d.line((ox + (h[ax] - c[ax]) * sc, oy - flip * (h[ay] - c[ay]) * sc,
                            ox + (t[ax] - c[ax]) * sc, oy - flip * (t[ay] - c[ay]) * sc), fill=(220, 40, 60), width=2)
            # axis ticks in metres
            d.text((k * cell + 8, cell - 16), "%s: %.2f..%.2f   %s: %.2f..%.2f" % ("XYZ"[ax], lo[ax], hi[ax], "XYZ"[ay], lo[ay], hi[ay]), fill=(110, 110, 110))
        img.save(png)
        print("SILHOUETTE", png)


main()
