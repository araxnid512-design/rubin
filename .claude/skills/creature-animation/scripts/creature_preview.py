"""Contact-sheet preview: one row per clip and view, `cols` evenly spaced moments per row.

Draws the deformed mesh as a point cloud and the skeleton as lines, so it works headless
with no GPU. Left = start of the clip. Red line = ground. Look for: feet under the ground
or floating, limbs bending backwards, the mesh tearing away from bones, poses that are
identical across the row (nothing is moving), first and last cell of a loop not matching.
"""
import os

import bpy
from mathutils import Vector
try:
    from PIL import Image, ImageDraw
except ImportError as e:  # Blender's bundled Python ships without Pillow
    raise ImportError("creature_preview needs Pillow: run `<this python> -m pip install pillow` "
                      "(inside Blender: sys.executable -m pip install pillow)") from e

ROLE_COL = {"spine": (40, 40, 40), "neck": (200, 90, 0), "tail": (0, 130, 90), "leg": (30, 90, 220),
            "arm": (150, 60, 200), "wing": (210, 40, 90), "tentacle": (0, 150, 170), "extra": (120, 120, 120)}


def _mesh_lines(rig, limit=4000):
    """Deformed mesh as (segments, points) in armature space: wireframe when it is light
    enough to stay readable, otherwise a sparse point cloud."""
    segs, pts = [], []
    dg = bpy.context.evaluated_depsgraph_get()
    inv = rig.arm.matrix_world.inverted()
    for ob in rig.meshes:
        ev = ob.evaluated_get(dg)
        me = ev.to_mesh()
        mw = inv @ ev.matrix_world
        if len(me.edges) <= limit:
            co = [mw @ v.co for v in me.vertices]
            segs += [(co[e.vertices[0]], co[e.vertices[1]]) for e in me.edges]
        else:
            step = max(1, len(me.vertices) // limit)
            pts += [mw @ me.vertices[i].co for i in range(0, len(me.vertices), step)]
        ev.to_mesh_clear()
    return segs, pts


def contact_sheet(rig, path, clips=None, cols=6, views=("side", "top"), cell=260, per_sheet=3):
    """Writes path (and path_2, path_3... every `per_sheet` clips so each image stays legible).
    Returns the list of files written."""
    names = clips or [c["name"] for c in rig.clips]
    info = {c["name"]: c for c in rig.clips}
    role = {}
    for c in rig.chains:
        for b in c.bones + ([c.foot] if c.foot else []):
            role[b] = c.role
    axes = {"side": (-rig.fwd, rig.up), "top": (rig.left, -rig.fwd), "front": (rig.left, rig.up)}
    pad, label = 14, 16
    out = []
    for page in range(0, len(names), per_sheet):
        chunk = names[page:page + per_sheet]
        img = Image.new("RGB", (cols * cell + 90, len(chunk) * len(views) * cell), "white")
        d = ImageDraw.Draw(img)
        r = 0
        for n in chunk:
            nf = info[n]["frames"] if n in info else int(bpy.data.actions[n].frame_range[1])
            loop = info.get(n, {}).get("loop", True)
            row = []
            for k in range(cols):
                f = round(nf * k / cols) if loop else round(nf * k / (cols - 1))
                rig.show(n, f)
                bones = [(pb.name, pb.head.copy(), pb.tail.copy()) for pb in rig.arm.pose.bones if pb.name in role]
                row.append((f, bones) + _mesh_lines(rig))
            allp = [p for _, bones, _, _ in row for b in bones for p in b[1:]] + [rig.up * rig.ground]
            for v in views:
                ax, ay = axes[v]
                xs = [p.dot(ax) for p in allp]
                ys = [p.dot(ay) for p in allp]
                cx, cy = (min(xs) + max(xs)) / 2, (min(ys) + max(ys)) / 2
                sc = (cell - 2 * pad - label) / max(max(xs) - min(xs), max(ys) - min(ys), 1e-6)
                y0 = r * cell
                d.text((6, y0 + 6), n, fill=(0, 0, 0))
                d.text((6, y0 + 22), v, fill=(110, 110, 110))
                if n in info:
                    c = info[n]
                    d.text((6, y0 + 38), "%.2fs %s" % (c["duration"], "loop" if c["loop"] else "once"), fill=(110, 110, 110))
                    if "speed_m_s" in c:
                        d.text((6, y0 + 54), "%.2f m/s" % c["speed_m_s"], fill=(110, 110, 110))
                for k, (f, bones, segs, pts) in enumerate(row):
                    x0 = 90 + k * cell
                    ox, oy = x0 + cell / 2, y0 + label + (cell - label) / 2

                    def pr(p):
                        return (ox + (p.dot(ax) - cx) * sc, oy - (p.dot(ay) - cy) * sc)
                    d.rectangle((x0, y0, x0 + cell - 1, y0 + cell - 1), outline=(225, 225, 225))
                    d.text((x0 + 5, y0 + 3), "f%d" % f, fill=(150, 150, 150))
                    for a, b in segs:
                        d.line((*pr(a), *pr(b)), fill=(200, 208, 216))
                    for p in pts:
                        d.point(pr(p), fill=(170, 182, 194))
                    if v != "top":
                        gy = oy - (rig.ground - cy) * sc
                        d.line((x0 + 2, gy, x0 + cell - 3, gy), fill=(230, 80, 80))
                    for name, h, t in bones:
                        d.line((*pr(h), *pr(t)), fill=ROLE_COL.get(role[name], (0, 0, 0)), width=2)
                r += 1
        root, ext = os.path.splitext(path)
        p = path if page == 0 else "%s_%d%s" % (root, page // per_sheet + 1, ext)
        img.save(p)
        out.append(p)
    print("[creature_anim] preview:", ", ".join(out))
    return out
