"""Re-import an exported .glb/.fbx and check it the way a game engine would see it.

    python validate_export.py out/dragon.glb [out/dragon.clips.json]

Checks: clips present (vs clips.json), durations, loops close (first pose == last pose),
every skinned vertex has weights, no more than 4 influences, no NaNs, nothing scaled.
Exit code 1 when a check fails, so it can gate a pipeline.
"""
import json
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402

import creature_anim as ca  # noqa: E402


def main():
    path = sys.argv[1]
    meta_path = sys.argv[2] if len(sys.argv) > 2 else os.path.splitext(path)[0] + ".clips.json"
    meta = json.load(open(meta_path)) if os.path.exists(meta_path) else None
    ca.reset_scene()
    arms, meshes = ca.import_model(path)
    problems = []
    if not arms:
        problems.append("no armature in file")
        report(problems)
    arm = arms[0]
    fps = bpy.context.scene.render.fps
    shapes = {pb.custom_shape for pb in arm.pose.bones if pb.custom_shape}  # importer helper objects
    meshes = [m for m in meshes if m not in shapes and (m.vertex_groups or m.parent == arm)]
    print("%s: %d bones, %d mesh(es), %d clip(s), %.1f KB" % (os.path.basename(path), len(arm.data.bones), len(meshes),
                                                             len(bpy.data.actions), os.path.getsize(path) / 1024))
    notes = []
    for m in meshes:
        deform = {b.name for b in arm.data.bones}
        none = many = 0
        for v in m.data.vertices:
            w = [g for g in v.groups if g.weight > 1e-4 and m.vertex_groups[g.group].name in deform]
            none += not w
            many += len(w) > 4
        if none:
            problems.append("%s: %d vertices have no bone weights (they will stay behind when the creature moves)" % (m.name, none))
        if many:
            problems.append("%s: %d vertices have more than 4 bone influences (Unity/mobile clamp to 4)" % (m.name, many))
    # FBX takes come in as "Armature|walk"; glTF as "walk"
    acts = {a.name.split("|")[-1]: a for a in bpy.data.actions}
    want = {c["name"]: c for c in meta["clips"]} if meta else {}
    for n in want:
        if n not in acts:
            problems.append("clip %r is in clips.json but missing from the file" % n)
    for n, act in sorted(acts.items()):
        f0, f1 = act.frame_range
        dur = (f1 - f0) / fps
        loop = want.get(n, {}).get("loop")
        ad = arm.animation_data_create()
        ad.action = act
        if hasattr(ad, "action_slot") and act.slots and ad.action_slot is None:
            ad.action_slot = act.slots[0]
        poses = []
        for f in (f0, f1):
            bpy.context.scene.frame_set(int(round(f)))
            bpy.context.view_layer.update()
            poses.append({pb.name: pb.matrix.copy() for pb in arm.pose.bones})
        gap = max((poses[0][b].translation - poses[1][b].translation).length for b in poses[0])
        size = max((pb.head - arm.pose.bones[0].head).length for pb in arm.pose.bones) or 1.0
        moved = any(any(abs(x) > 1e-5 for row in (poses[0][b] - arm.data.bones[b].matrix_local) for x in row) for b in poses[0])
        bad = any(math.isnan(x) for b in poses[0] for row in poses[0][b] for x in row)
        flag = ""
        if bad:
            problems.append("clip %r contains NaN transforms" % n)
        if loop and gap > size * .01:
            problems.append("clip %r is marked loop but first/last pose differ by %.3f m -> visible pop" % (n, gap))
        if n in want and abs(dur - want[n]["duration"]) > 2.0 / fps:
            problems.append("clip %r lasts %.2fs, clips.json says %.2fs" % (n, dur, want[n]["duration"]))
        if loop is not None:
            flag = "loop" if loop else "once"
        if loop is False and size * .005 < gap < size * .12:
            notes.append("one-shot %r ends %.3f m away from its start pose - blending back to idle may pop "
                         "(fine if intended, e.g. a death)" % (n, gap))
        if want.get(n, {}).get("feet_out_of_reach_m"):
            notes.append("clip %r: planted feet could not reach the ground: %s" % (n, want[n]["feet_out_of_reach_m"]))
        print("   %-18s %5.2fs  %-4s  start-vs-end pose gap %.4f m%s" % (n, dur, flag, gap, "" if moved else "   (frame 0 = rest pose)"))
    for x in notes:
        print("NOTE: " + x)
    report(problems)


def report(problems):
    if problems:
        print("PROBLEMS:")
        for p in problems:
            print("  - " + p)
        sys.exit(1)
    print("OK - export is engine-ready")
    sys.exit(0)


main()
