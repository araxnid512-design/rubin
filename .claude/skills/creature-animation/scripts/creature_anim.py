"""creature_anim - procedural rigging + animation of characters and fantasy creatures in Blender.

Runs inside Blender's Python (Blender 4.4+ / 5.x, or the `bpy` pip module). No UI needed.

Conventions (armature space):  up = +Z,  forward = -Y,  creature's LEFT = +X,  ground = Z 0.
All lengths are metres. All animation amplitudes are derived from the rig's own proportions,
so the same clip code works for a 20 cm imp and a 20 m dragon.

Typical use:

    import sys; sys.path.insert(0, "<skill>/scripts")
    import creature_anim as ca

    ca.reset_scene()
    rig = ca.build(ca.preset("dragon", size=4.0), name="Dragon")   # or ca.Rig.from_armature(...)
    rig.add_blockout()                                              # placeholder skinned mesh
    rig.add_standard_clips()                                        # idle / walk / run / fly / ...
    rig.clip("tail_whip", my_fn, duration=1.2, loop=False)          # custom clip, see Pose
    rig.preview("out/preview.png")                                  # contact sheet -> LOOK AT IT
    rig.export("out/dragon", engine="unity")                        # .glb/.fbx + clips.json
"""
import json
import math
import os

import bpy
from mathutils import Matrix, Quaternion, Vector

UP = Vector((0, 0, 1))
TAU = math.tau


def _v(p):
    return Vector(p)


def ease(x):
    """Smoothstep 0..1 -> 0..1 (slow in, slow out)."""
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)


def pulse(t, start, peak, end):
    """0 before `start`, eases to 1 at `peak`, eases back to 0 at `end`. For one-shot actions."""
    if t <= start or t >= end:
        return 0.0
    if t < peak:
        return ease((t - start) / (peak - start))
    return 1.0 - ease((t - peak) / (end - peak))


def osc(t, cycles=1, phase=0.0):
    """Loop-safe sine: integer `cycles` per clip guarantees frame 0 == last frame."""
    return math.sin(TAU * (cycles * t + phase))


def reset_scene(fps=30):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = fps
    bpy.context.scene.unit_settings.system = "METRIC"


# --------------------------------------------------------------------------- body plans

def _mirror(p):
    return Vector((-p[0], p[1], p[2]))


def _lerp_pts(a, b, n):
    a, b = _v(a), _v(b)
    return [a.lerp(b, i / n) for i in range(n + 1)]


def preset(kind, size=1.0, **o):
    """Return an editable body plan: {"chains": [ {name, role, points, mirror?, parent?}, ... ]}.

    `size` = approximate height at the shoulder/hip for walkers, total height for humanoids,
    body length for serpents. Edit the returned points freely (or write a plan from scratch)
    to get any anatomy - extra heads, six legs, two tails, four wings...

    Points are armature-space positions, root-first. Mirrored chains are given for the LEFT
    side (x > 0). Roles: spine, neck (last bone = head), tail, leg, arm, wing, tentacle, extra.
    A leg with 4 points gets a foot bone (hip, knee, ankle, toe); bend the rest pose slightly
    at the knee - the IK solver bends legs the way the rest pose already bends.
    """
    s = size
    C = []

    def chain(name, role, pts, mirror=False, **kw):
        C.append(dict(name=name, role=role, points=[_v(p) * s for p in pts], mirror=mirror, **kw))

    if kind == "humanoid":  # T-pose, size = height
        chain("spine", "spine", [(0, 0, .53), (0, 0, .62), (0, -.01, .72), (0, 0, .82)])
        chain("neck", "neck", [(0, 0, .82), (0, -.01, .88), (0, -.01, 1.0)])
        chain("leg", "leg", [(.09, 0, .53), (.095, -.025, .28), (.1, 0, .05), (.1, -.13, 0)], True)
        chain("arm", "arm", [(.05, 0, .8), (.17, 0, .8), (.42, .01, .8), (.65, 0, .8), (.74, 0, .8)], True)
    elif kind in ("quadruped", "dragon"):  # size = shoulder height
        L = o.get("body_length", 1.5)
        chain("spine", "spine", _lerp_pts((0, L / 2, .95), (0, -L / 2, 1.0), 4))
        chain("neck", "neck", [(0, -L / 2, 1.0), (0, -L / 2 - .3, 1.25), (0, -L / 2 - .5, 1.5), (0, -L / 2 - .95, 1.45)])
        chain("jaw", "extra", [(0, -L / 2 - .52, 1.42), (0, -L / 2 - .9, 1.36)], parent="neck:-1", tag="jaw")
        chain("tail", "tail", _lerp_pts((0, L / 2, .95), (0, L / 2 + 1.6, .35), 6))
        chain("leg_front", "leg", [(.22, -L / 2 + .05, .9), (.25, -L / 2 + .12, .47), (.25, -L / 2 + .05, .07), (.25, -L / 2 - .13, 0)], True)
        chain("leg_hind", "leg", [(.22, L / 2 - .05, .9), (.26, L / 2 - .2, .48), (.26, L / 2 + .02, .07), (.26, L / 2 - .16, 0)], True)
        if kind == "dragon":
            chain("wing", "wing", [(.15, -L / 4, 1.05), (.9, -L / 4 + .15, 1.25), (1.9, -L / 4 - .1, 1.2), (3.0, -L / 4 + .5, 1.1)], True)
    elif kind in ("wyvern", "bird"):  # two legs + wings, horizontal body. size = hip height
        chain("spine", "spine", _lerp_pts((0, .35, 1.0), (0, -.35, 1.1), 3))
        chain("neck", "neck", [(0, -.35, 1.1), (0, -.55, 1.35), (0, -.7, 1.55), (0, -1.0, 1.5)])
        chain("tail", "tail", _lerp_pts((0, .35, 1.0), (0, 1.5, .7), 5))
        chain("leg", "leg", [(.18, .1, .95), (.2, -.12, .5), (.2, .08, .08), (.2, -.14, 0)], True)
        chain("wing", "wing", [(.14, -.2, 1.15), (.8, -.1, 1.3), (1.6, -.3, 1.25), (2.5, .2, 1.15)], True)
    elif kind == "serpent":  # size = length, lies along +Y with head at -Y
        n = o.get("segments", 14)
        chain("spine", "spine", [(0, .5 - i / n * .85, .05) for i in range(n + 1)])
        chain("neck", "neck", [(0, -.35, .05), (0, -.42, .06), (0, -.5, .06)])
    elif kind in ("spider", "insect"):  # size = body height off the ground * ~3
        pairs = 4 if kind == "spider" else 3
        chain("spine", "spine", [(0, .25, .3), (0, 0, .3), (0, -.25, .3)])
        chain("neck", "neck", [(0, -.25, .3), (0, -.42, .29)])
        chain("abdomen", "tail", [(0, .25, .3), (0, .55, .36), (0, .85, .3)])
        for i in range(pairs):
            y = -.2 + i * (.42 / max(1, pairs - 1))  # front -> back
            fan = (i - (pairs - 1) / 2) * .28  # splay front legs forward, hind legs back
            chain("leg_%d" % (i + 1), "leg",
                  [(.1, y, .3), (.45, y + fan * .9, .62), (.95, y + fan * 2.2, 0)], True)
    elif kind == "tentacle":  # octopus-like: mantle up, arms radiating. size = mantle height
        n = o.get("arms", 8)
        chain("spine", "spine", [(0, 0, .35), (0, .05, .7), (0, .1, 1.0)])
        for i in range(n):
            a = TAU * (i + .5) / n
            d = Vector((math.cos(a), math.sin(a), 0))
            pts = [d * (.12 + .2 * k) + Vector((0, 0, .35 - .34 * ease(k / 5))) for k in range(7)]
            chain("tentacle_%d" % (i + 1), "tentacle", pts, parent="spine:0")
    else:
        raise ValueError("unknown preset %r; use humanoid, quadruped, dragon, wyvern, bird, "
                         "serpent, spider, insect, tentacle - or write the plan by hand" % kind)
    return {"chains": C}


# --------------------------------------------------------------------------- rig

class Chain:
    def __init__(self, name, role, bones, side=0, tag=None, foot=None):
        self.name, self.role, self.bones, self.side, self.tag = name, role, bones, side, tag
        self.foot = foot  # leg only: name of the foot bone (not part of the IK chain) or None
        self.phase = 0.0
        self.pair = 0

    def __repr__(self):
        return "<%s %s %s>" % (self.role, self.name, self.bones)


class Rig:
    """An armature plus a description of what each bone chain *is* (leg, wing, tail...)."""

    def __init__(self, arm, chains, forward=(0, -1, 0), up=(0, 0, 1)):
        self.arm = arm
        self.chains = chains
        self.fwd = _v(forward).normalized()
        self.up = _v(up).normalized()
        self.left = self.up.cross(self.fwd).normalized()
        self.clips = []
        self.meshes = []
        self._ik = None
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"
        self._rest = {b.name: b.matrix_local.copy() for b in arm.data.bones}
        self._restq = {n: m.to_quaternion() for n, m in self._rest.items()}
        self._setup_legs()
        heights = [(b.head_local.dot(self.up), b.tail_local.dot(self.up)) for b in arm.data.bones]
        lo = min(min(h) for h in heights)
        hi = max(max(h) for h in heights)
        self.height = max(hi - lo, 1e-6)
        self.ground = lo
        self.leg_len = (sum(self.chain_len(l) for l in self.legs) / len(self.legs)) if self.legs else self.height * .5

    # ---- lookup helpers
    def by_role(self, role):
        return [c for c in self.chains if c.role == role]

    def chain(self, name):
        for c in self.chains:
            if c.name == name:
                return c
        raise KeyError("no chain %r; have %s" % (name, [c.name for c in self.chains]))

    def tagged(self, tag):
        return [b for c in self.chains if c.tag == tag for b in c.bones]

    @property
    def spine(self):
        s = self.by_role("spine")
        return s[0].bones if s else []

    @property
    def hips(self):
        """Bone that carries the whole body (first spine bone, or the armature's top bone)."""
        if self.spine:
            return self.spine[0]
        return next(b.name for b in self.arm.data.bones if b.parent is None)

    @property
    def root(self):
        b = self.arm.data.bones[self.hips]
        return b.parent.name if b.parent else None

    @property
    def head(self):
        n = self.by_role("neck")
        return n[0].bones[-1] if n else None

    def bone_dir(self, name):
        b = self.arm.data.bones[name]
        return (b.tail_local - b.head_local).normalized()

    def chain_len(self, c):
        return sum(self.arm.data.bones[b].length for b in c.bones)

    def _setup_legs(self):
        legs = self.by_role("leg")
        B = self.arm.data.bones
        for l in legs:
            l.rest_foot = B[l.bones[-1]].tail_local.copy()  # ankle (IK target)
            l.rest_hip = B[l.bones[0]].head_local.copy()
        # pair index: front (0) -> back, by forward coordinate of the hip
        stations = sorted({round(l.rest_hip.dot(self.fwd), 4) for l in legs}, reverse=True)
        for l in legs:
            l.pair = stations.index(round(l.rest_hip.dot(self.fwd), 4))
        legs.sort(key=lambda l: (l.pair, -l.side))
        self.legs = legs

    # ---- wrap an existing armature
    @classmethod
    def from_armature(cls, arm, mapping, forward=None):
        """Describe an existing (imported) skeleton.

        mapping = {"spine": [hips, ..., chest], "neck": [neck, ..., head], "tail": [...],
                   "legs": [[thigh, shin, foot], ...], "arms": [[...], ...],
                   "wings": [[...], ...], "tentacles": [[...], ...], "jaw": [name],
                   "extra": {"name": [bones]} }
        Leg lists with 3+ bones treat the LAST bone as the foot unless given as
        {"bones": [...], "foot": False}. `forward` is the direction the creature faces in
        WORLD space (default: guessed from head/neck vs hips, else -Y).
        """
        inv = arm.matrix_world.inverted().to_3x3()
        up = (inv @ UP).normalized()
        B = arm.data.bones
        chains = []

        def side_of(names, left):
            x = sum(B[n].head_local.dot(left) for n in names) / len(names)
            ext = max((b.head_local - B[0].head_local).length for b in B) or 1.0
            return 0 if abs(x) < ext * .01 else (1 if x > 0 else -1)

        if forward is None:
            f = None
            if mapping.get("neck") and mapping.get("spine"):
                d = B[mapping["neck"][-1]].tail_local - B[mapping["spine"][0]].head_local
                d = d - up * d.dot(up)
                if d.length > 1e-4 * max(1.0, B[mapping["spine"][0]].length):
                    f = d.normalized()
            if f is None or f.length < .5:
                f = (inv @ Vector((0, -1, 0))).normalized()
            # snap to the dominant axis: imported characters face along an axis
            fa = max(range(3), key=lambda i: abs(f[i]))
            f = Vector([(1 if f[i] > 0 else -1) if i == fa else 0 for i in range(3)])
        else:
            f = (inv @ _v(forward)).normalized()
        left = up.cross(f).normalized()
        for role, key in (("spine", "spine"), ("neck", "neck"), ("tail", "tail")):
            if mapping.get(key):
                chains.append(Chain(key, role, list(mapping[key])))
        for role, key in (("leg", "legs"), ("arm", "arms"), ("wing", "wings"), ("tentacle", "tentacles")):
            for i, item in enumerate(mapping.get(key, [])):
                foot = None
                if isinstance(item, dict):
                    bones, has_foot = list(item["bones"]), item.get("foot", True)
                else:
                    bones, has_foot = list(item), len(item) >= 3
                if role == "leg" and has_foot and len(bones) >= 3:
                    foot, bones = bones[-1], bones[:-1]
                sd = side_of(bones, left)
                chains.append(Chain("%s_%d%s" % (role, i + 1, {1: ".L", -1: ".R", 0: ""}[sd]), role, bones, sd, foot=foot))
        if mapping.get("jaw"):
            chains.append(Chain("jaw", "extra", list(mapping["jaw"]), tag="jaw"))
        for name, bones in (mapping.get("extra") or {}).items():
            chains.append(Chain(name, "extra", list(bones), side_of(bones, left)))
        missing = [b for c in chains for b in c.bones + ([c.foot] if c.foot else []) if b not in B]
        if missing:
            raise KeyError("bones not in armature: %s" % missing)
        rig = cls(arm, chains, forward=f, up=up)
        rig.meshes = [o for o in bpy.data.objects if o.type == "MESH" and
                      any(m.type == "ARMATURE" and m.object == arm for m in o.modifiers)]
        return rig

    # ---- placeholder geometry
    def add_blockout(self, thickness=1.0, color=(.45, .55, .5, 1)):
        """Low-poly skinned placeholder mesh (one tapered box per bone, membranes on wings).

        Good enough to judge motion in-engine and to be swapped for final art later, since the
        skeleton and clips stay valid for any mesh skinned to the same bones."""
        import bmesh
        bm = bmesh.new()
        groups = {}
        base = {"spine": .16, "neck": .09, "tail": .09, "leg": .06, "arm": .05, "wing": .025,
                "tentacle": .05, "extra": .04}
        B = self.arm.data.bones
        role_of, pos_in = {}, {}
        for c in self.chains:
            allb = c.bones + ([c.foot] if c.foot else [])
            for i, b in enumerate(allb):
                role_of[b] = c
                pos_in[b] = i / max(1, len(allb) - 1)
        legs_scale = self.leg_len if self.legs else self.height
        unit = max(self.height, legs_scale) * thickness
        for b in B:
            c = role_of.get(b.name)
            if c is None and b.name != self.hips:
                continue
            role = c.role if c else "extra"
            f = pos_in.get(b.name, 0)
            taper = {"tail": 1 - .8 * f, "tentacle": 1 - .75 * f, "leg": 1 - .45 * f, "arm": 1 - .4 * f,
                     "neck": 1 - .2 * f, "wing": 1 - .5 * f}.get(role, 1.0)
            r0 = base[role] * unit * taper
            r1 = r0 * (.8 if role in ("tail", "tentacle", "leg", "arm") else 1.0)
            if c and c.role == "neck" and b.name == c.bones[-1]:
                r0, r1 = r0 * 1.5, r0 * .9  # head
            if c and c.foot == b.name:
                r0, r1 = r0 * 1.1, r0 * .9
            m = b.matrix_local
            x, z = m.col[0].to_3d(), m.col[2].to_3d()
            h, t = b.head_local, b.tail_local
            ring0 = [bm.verts.new(h + x * sx * r0 + z * sz * r0) for sx, sz in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
            ring1 = [bm.verts.new(t + x * sx * r1 + z * sz * r1) for sx, sz in ((1, 1), (-1, 1), (-1, -1), (1, -1))]
            for i in range(4):
                bm.faces.new((ring0[i], ring0[(i + 1) % 4], ring1[(i + 1) % 4], ring1[i]))
            bm.faces.new(ring0[::-1])
            bm.faces.new(ring1)
            groups.setdefault(b.name, []).extend(ring0 + ring1)
            if role == "wing":  # membrane trailing behind the bone
                chord = self.chain_len(c) * .45 * (1 - .6 * f)
                chord1 = self.chain_len(c) * .45 * (1 - .6 * min(1, f + 1 / max(1, len(c.bones) - 1)))
                back = -self.fwd
                a, d = bm.verts.new(h), bm.verts.new(h + back * chord)
                bb, cc = bm.verts.new(t), bm.verts.new(t + back * (chord1 if b.name != c.bones[-1] else chord * .15))
                bm.faces.new((a, bb, cc, d))
                groups[b.name].extend([a, bb, cc, d])
        bm.verts.index_update()
        idx = {n: [v.index for v in vs] for n, vs in groups.items()}
        me = bpy.data.meshes.new(self.arm.name + "_blockout")
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
        bm.to_mesh(me)
        bm.free()
        ob = bpy.data.objects.new(self.arm.name + "_blockout", me)
        bpy.context.scene.collection.objects.link(ob)
        for n, ids in idx.items():
            ob.vertex_groups.new(name=n).add(ids, 1.0, "REPLACE")
        mat = bpy.data.materials.new(self.arm.name + "_mat")
        mat.diffuse_color = color
        mat.use_backface_culling = False
        me.materials.append(mat)
        ob.parent = self.arm
        ob.modifiers.new("Armature", "ARMATURE").object = self.arm
        self.meshes.append(ob)
        return ob

    def bind_mesh(self, objs, method="auto"):
        """Skin unrigged mesh object(s) to this armature. method: 'auto' (heat) | 'envelope'.

        Heat weighting fails on non-manifold / multi-shell meshes; this falls back to
        envelope weights automatically. Always check the preview afterwards."""
        objs = objs if isinstance(objs, (list, tuple)) else [objs]
        for ob in objs:
            for o in bpy.context.view_layer.objects:
                o.select_set(False)
            ob.select_set(True)
            self.arm.select_set(True)
            bpy.context.view_layer.objects.active = self.arm
            bpy.ops.object.parent_set(type="ARMATURE_AUTO" if method == "auto" else "ARMATURE_ENVELOPE")
            deform = {b.name for b in self.arm.data.bones if b.use_deform}
            weighted = sum(1 for v in ob.data.vertices
                           if any(ob.vertex_groups[g.group].name in deform and g.weight > 1e-4 for g in v.groups))
            if method == "auto" and weighted < len(ob.data.vertices) * .9:
                print("[creature_anim] heat weights covered %d/%d verts on %s -> envelope fallback"
                      % (weighted, len(ob.data.vertices), ob.name))
                ob.vertex_groups.clear()
                bpy.ops.object.parent_set(type="ARMATURE_ENVELOPE")
            if ob not in self.meshes:
                self.meshes.append(ob)

    # ---- IK plumbing (temporary, only while a clip is being sampled)
    def _ik_on(self):
        self._ik = {}
        for l in self.legs:
            e = bpy.data.objects.new("_ik_" + l.name, None)
            bpy.context.scene.collection.objects.link(e)
            e.parent = self.arm
            e.location = l.rest_foot
            con = self.arm.pose.bones[l.bones[-1]].constraints.new("IK")
            con.name = "_ca_ik"
            con.target = e
            con.chain_count = len(l.bones)
            con.iterations = 200
            self._ik[l.name] = (e, con)

    def _ik_off(self):
        for l in self.legs:
            e, con = self._ik[l.name]
            self.arm.pose.bones[l.bones[-1]].constraints.remove(con)
            bpy.data.objects.remove(e)
        self._ik = None
        for pb in self.arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)

    def _sample(self, pose):
        """Apply a Pose, solve IK, return {bone: (loc, quat)} local channels."""
        arm, pbs = self.arm, self.arm.pose.bones
        out = {}
        for pb in pbs:
            q = pose.q.get(pb.name)
            rq = self._restq[pb.name]
            pb.rotation_quaternion = (rq.inverted() @ q @ rq) if q else Quaternion()
            loc = pose.loc.get(pb.name)
            pb.location = (rq.inverted() @ loc) if loc else Vector()
            out[pb.name] = (pb.location.copy(), pb.rotation_quaternion.copy())
        if self.legs:
            body = pose.loc.get(self.hips, Vector())
            for l in self.legs:
                tgt = l.rest_foot + pose.feet.get(l.name, Vector())
                hip = l.rest_hip + body
                reach = self.chain_len(l) * .985
                d = tgt - hip
                if d.length > reach:  # never ask for more than the leg can reach -> no floating feet
                    tgt = hip + d.normalized() * reach
                self._ik[l.name][0].location = tgt
            bpy.context.view_layer.update()
            for l in self.legs:
                for b in l.bones:
                    m = arm.convert_space(pose_bone=pbs[b], matrix=pbs[b].matrix, from_space="POSE", to_space="LOCAL")
                    out[b] = (Vector(), m.to_quaternion())
                if l.foot:  # keep the foot level with the ground (+ optional pitch), whatever the shin does
                    pitch = pose.foot_pitch.get(l.name, 0.0)
                    rot = Quaternion(self.left, math.radians(pitch)) @ self._restq[l.foot]
                    want = Matrix.Translation(pbs[l.bones[-1]].tail) @ rot.to_matrix().to_4x4()
                    m = arm.convert_space(pose_bone=pbs[l.foot], matrix=want, from_space="POSE", to_space="LOCAL")
                    out[l.foot] = (Vector(), m.to_quaternion())
        return out

    # ---- clips
    def _settle(self, P, smp):
        """Keep everything on or above the floor: limbs that would sink are swung up at their
        root so they drape along the ground; if the torso itself sinks, the body is lifted."""
        pbs = self.arm.pose.bones
        floor = self.ground + self.height * .012
        up = self.up
        loose = [c for c in self.chains if c.role not in ("leg", "spine")]
        for _ in range(8):
            bpy.context.view_layer.update()
            changed = False
            for c in loose:
                pts = [pbs[b].tail for b in c.bones]
                low = min(pts, key=lambda p: p.dot(up))
                sink = floor - low.dot(up)
                base = pbs[c.bones[0]].head
                if sink > 1e-4 and base.dot(up) > floor:
                    r = max((low - base).length, 1e-6)
                    P.rot(c.bones[0], up=min(25.0, math.degrees(math.asin(min(1.0, sink / r))) * 1.05 + .2))
                    changed = True
            core = [pbs[b] for b in self.spine] + [pbs[c.bones[0]] for c in loose]
            sink = floor - min(min(pb.head.dot(up) for pb in core), min(pbs[b].tail.dot(up) for b in self.spine) if self.spine else 1e9)
            if sink > 1e-4:
                P.move(self.hips, up * sink)
                changed = True
            if not changed:
                break
            smp = self._sample(P)
        return smp

    def clip(self, name, fn, duration=1.0, loop=True, fps=None, speed=None, step=1, keep_above_ground=False):
        """Bake `fn(P, t)` into an Action called `name`.

        fn receives a fresh Pose `P` and t in 0..1 and poses the creature for that instant.
        Loops: frame N is sampled at t=0 again, so make everything periodic in t (use
        osc()/integer cycle counts) and the loop is seamless by construction.
        `speed` (m/s) is recorded in clips.json for locomotion clips (blend trees / root motion).
        keep_above_ground=True makes necks/tails/wings/arms drape along the floor instead of
        sinking through it (and lifts the torso if it would sink) - use it for falls, deaths,
        crouches, sleeping poses and anything that lies down.
        """
        scn = bpy.context.scene
        fps = fps or scn.render.fps
        n = max(2, round(duration * fps))
        frames = sorted(set(list(range(0, n, step)) + [n]))
        # detach any previous clip first: a depsgraph rebuild re-evaluates the assigned action
        # and would silently overwrite the pose of the first sample
        if self.arm.animation_data:
            self.arm.animation_data.action = None
        for pb in self.arm.pose.bones:
            pb.matrix_basis = Matrix.Identity(4)
        self._ik_on()
        bpy.context.view_layer.update()
        samples = []
        try:
            for f in frames:
                t = f / n
                if loop and f == n:
                    t = 0.0
                P = Pose(self, t)
                fn(P, t)
                smp = self._sample(P)
                if keep_above_ground:
                    smp = self._settle(P, smp)
                samples.append(smp)
        finally:
            self._ik_off()
        old = bpy.data.actions.get(name)
        if old:
            bpy.data.actions.remove(old)
            self.clips = [c for c in self.clips if c["name"] != name]
        act = bpy.data.actions.new(name)
        act.use_fake_user = True
        ad = self.arm.animation_data_create()
        ad.action = act
        pbs = self.arm.pose.bones
        moving_loc = {b for s in samples for b, (loc, _) in s.items() if loc.length > 1e-7}
        prev = {}
        for f, s in zip(frames, samples):
            for b, (loc, q) in s.items():
                pb = pbs[b]
                if b in prev and q.dot(prev[b]) < 0:
                    q = -q
                prev[b] = q
                pb.rotation_quaternion = q
                pb.keyframe_insert("rotation_quaternion", frame=f, group=b)
                if b in moving_loc:
                    pb.location = loc
                    pb.keyframe_insert("location", frame=f, group=b)
        for fc in _fcurves(act):
            for k in fc.keyframe_points:
                k.interpolation = "LINEAR"
        act.use_frame_range = True
        act.frame_start, act.frame_end = 0, n
        act.use_cyclic = loop
        info = dict(name=name, frames=n, fps=fps, duration=round(n / fps, 4), loop=loop)
        if speed is not None:
            info["speed_m_s"] = round(speed, 4)
        self.clips.append(info)
        for pb in pbs:
            pb.matrix_basis = Matrix.Identity(4)
        return act

    def add_standard_clips(self, names=None, **kw):
        """Add the stock clips that make sense for this anatomy (see STANDARD_CLIPS)."""
        import creature_clips
        return creature_clips.add_standard(self, names, **kw)

    # ---- output
    def show(self, name, frame=0):
        act = bpy.data.actions[name]
        ad = self.arm.animation_data_create()
        ad.action = act
        if hasattr(ad, "action_slot") and act.slots and ad.action_slot is None:
            ad.action_slot = act.slots[0]
        bpy.context.scene.frame_set(frame)
        bpy.context.view_layer.update()

    def preview(self, path, clips=None, cols=6, views=("side", "top"), cell=260, per_sheet=3):
        """Contact sheet PNG(s); returns the list of files. Open them and LOOK before exporting."""
        import creature_preview
        return creature_preview.contact_sheet(self, path, clips, cols, views, cell, per_sheet)

    def export(self, basepath, engine="generic", formats=None, clips=None):
        """Write <basepath>.glb and/or .fbx plus <basepath>.clips.json.

        engine: 'unity' | 'unreal' -> FBX (+GLB);  'godot' | 'web' | 'generic' -> GLB (+FBX on request).
        """
        formats = formats or {"unity": ("fbx", "glb"), "unreal": ("fbx", "glb")}.get(engine, ("glb",))
        os.makedirs(os.path.dirname(os.path.abspath(basepath)), exist_ok=True)
        names = clips or [c["name"] for c in self.clips]
        scn = bpy.context.scene
        scn.frame_start = 0
        scn.frame_end = max([c["frames"] for c in self.clips] + [1])
        for o in bpy.context.view_layer.objects:
            o.select_set(False)
        self.arm.select_set(True)
        for m in self.meshes:
            m.select_set(True)
        bpy.context.view_layer.objects.active = self.arm
        # only our clips should be exported: park every other action out of the exporters' sight
        if self.clips:
            self.show(names[0])
        written = []
        if "glb" in formats:
            p = basepath + ".glb"
            bpy.ops.export_scene.gltf(
                filepath=p, export_format="GLB", use_selection=True,
                export_animation_mode="ACTIONS", export_force_sampling=True,
                export_optimize_animation_size=False, export_anim_slide_to_zero=True,
                export_skins=True, export_yup=True, export_apply=False)
            written.append(p)
        if "fbx" in formats:
            p = basepath + ".fbx"
            kw = dict(filepath=p, use_selection=True, object_types={"ARMATURE", "MESH"},
                      add_leaf_bones=False, bake_anim=True, bake_anim_use_all_actions=True,
                      bake_anim_use_nla_strips=False, bake_anim_use_all_bones=True,
                      bake_anim_force_startend_keying=True, bake_anim_simplify_factor=0.0,
                      mesh_smooth_type="FACE", use_armature_deform_only=True)
            if engine == "unreal":
                kw.update(axis_forward="X", axis_up="Z", primary_bone_axis="Y", secondary_bone_axis="X")
            else:  # Unity & default
                kw.update(axis_forward="-Z", axis_up="Y", apply_scale_options="FBX_SCALE_UNITS",
                          bake_space_transform=False)
            bpy.ops.export_scene.fbx(**kw)
            written.append(p)
        meta = dict(creature=self.arm.name, engine=engine, up="Z (Blender) / Y (glTF, FBX-Unity)",
                    bones=len(self.arm.data.bones), height_m=round(self.height, 4),
                    clips=[c for c in self.clips if c["name"] in names])
        with open(basepath + ".clips.json", "w") as fh:
            json.dump(meta, fh, indent=2)
        written.append(basepath + ".clips.json")
        print("[creature_anim] exported:", ", ".join(written))
        return written


def _fcurves(act):
    if hasattr(act, "layers"):  # Blender 4.4+ slotted actions
        out = []
        for layer in act.layers:
            for strip in layer.strips:
                for cb in strip.channelbags:
                    out.extend(cb.fcurves)
        return out
    return list(act.fcurves)


# --------------------------------------------------------------------------- pose authoring

class Pose:
    """What a clip function draws on. Everything is expressed in creature terms, not bone axes,
    so the same code drives any skeleton (built here or imported from elsewhere).

    Angles are degrees, relative to the rest pose, and child bones inherit their parents'
    motion (a 5 degree bend on every bone of a tail curls the whole tail).
    """

    def __init__(self, rig, t):
        self.rig, self.t = rig, t
        self.q, self.loc, self.feet, self.foot_pitch = {}, {}, {}, {}

    def rot(self, bone, up=0.0, left=0.0, fwd=0.0, twist=0.0, out=0.0, axis=None, angle=0.0):
        """Swing a bone so its TIP moves toward: up (+Z), left (+X), fwd (facing direction),
        out (away from the body's midline - mirrored automatically for .L/.R bones);
        twist rolls it about its own length. `axis`+`angle` = raw armature-space rotation.
        Accepts a bone name or a list of names (same rotation on each)."""
        if isinstance(bone, (list, tuple)):
            for b in bone:
                self.rot(b, up, left, fwd, twist, out, axis, angle)
            return
        r = self.rig
        d = r.bone_dir(bone)
        q = Quaternion()
        if out:
            sx = r.arm.data.bones[bone].head_local.dot(r.left) + r.arm.data.bones[bone].tail_local.dot(r.left)
            left += out * (1 if sx >= 0 else -1)
        for amount, toward in ((up, r.up), (left, r.left), (fwd, r.fwd)):
            if amount:
                ax = d.cross(toward)
                if ax.length > 1e-3:
                    q = Quaternion(ax.normalized(), math.radians(amount)) @ q
        if twist:
            q = Quaternion(d, math.radians(twist)) @ q
        if axis is not None and angle:
            q = Quaternion(_v(axis).normalized(), math.radians(angle)) @ q
        self.q[bone] = q @ self.q.get(bone, Quaternion())

    def turn(self, bone, pitch=0.0, yaw=0.0, roll=0.0):
        """Rotate a bone (and everything below it) like a rigid body: pitch = nose up,
        yaw = turn left, roll = lean left. Use on hips for whole-body attitude, on head to look."""
        r = self.rig
        q = (Quaternion(r.up, math.radians(yaw)) @ Quaternion(r.left, math.radians(-pitch))
             @ Quaternion(r.fwd, math.radians(-roll)))
        self.q[bone] = q @ self.q.get(bone, Quaternion())

    def wave(self, bones, amp, cycles=1, lag=0.12, toward="left", grow=1.0, phase=0.0, bias=0.0):
        """Travelling wave down a chain (tails, tentacles, serpents, necks, antennae).
        amp = degrees per bone at the tip; `lag` = phase delay per bone (follow-through);
        grow = 0 -> uniform amplitude, 1 -> amplitude ramps from root to tip; bias = constant curl."""
        n = len(bones)
        for i, b in enumerate(bones):
            k = (1 - grow) + grow * (i + 1) / n
            a = bias + amp * k * osc(self.t, cycles, phase - i * lag)
            self.rot(b, **{toward: a})

    def move(self, bone, offset):
        """Translate a bone in armature space (metres). Normally only hips / root."""
        self.loc[bone] = self.loc.get(bone, Vector()) + _v(offset)

    def body(self, up=0.0, fwd=0.0, left=0.0, pitch=0.0, yaw=0.0, roll=0.0):
        """Move/tilt the whole body via the hips. Planted feet stay planted (IK)."""
        r = self.rig
        self.move(r.hips, r.up * up + r.fwd * fwd + r.left * left)
        if pitch or yaw or roll:
            self.turn(r.hips, pitch, yaw, roll)

    def foot(self, leg, fwd=0.0, up=0.0, left=0.0, pitch=0.0):
        """Place a foot relative to its rest spot (metres). leg = Chain, chain name or index into rig.legs."""
        r = self.rig
        l = leg if isinstance(leg, Chain) else (r.legs[leg] if isinstance(leg, int) else r.chain(leg))
        self.feet[l.name] = self.feet.get(l.name, Vector()) + r.fwd * fwd + r.up * up + r.left * left
        self.foot_pitch[l.name] = self.foot_pitch.get(l.name, 0.0) + pitch

    def gait(self, stride, lift, duty=0.6, phases=None, cycles=1):
        """Step every leg through a stance/swing cycle, in place (treadmill style).

        stride = metres travelled per cycle by a planted foot, lift = swing height,
        duty = fraction of the cycle a foot is on the ground (walk ~0.6-0.7, run ~0.35-0.45).
        Planted feet move backward at constant speed -> no foot sliding at speed
        stride / (duty * duration) ... see gait_speed()."""
        r = self.rig
        for l in r.legs:
            ph = (phases or {}).get(l.name, l.phase)
            p = (self.t * cycles + ph) % 1.0
            if p < duty:
                x = .5 - p / duty
                z = 0.0
                pitch = 0.0
            else:
                s = (p - duty) / (1 - duty)
                x = -.5 + ease(s)
                z = math.sin(math.pi * s) ** 1.2
                pitch = -25 * math.sin(TAU * s) if l.foot else 0.0  # toe-off, then heel-first
            self.foot(l, fwd=stride * duty * x, up=lift * z, pitch=pitch)


def gait_speed(stride, duration, cycles=1):
    """Ground speed (m/s) implied by Pose.gait(): the body travels `stride` per cycle."""
    return stride * cycles / duration


GAITS = {
    # phase offset (fraction of a cycle) per (pair index front->back, side) - None = computed
    "alternate": None,  # biped walk, quadruped trot, hexapod tripod, spider tetrapod
    "walk4": {(0, 1): .25, (0, -1): .75, (1, 1): 0.0, (1, -1): .5},  # lateral-sequence walk
    "gallop": {(0, 1): .1, (0, -1): 0.0, (1, 1): .6, (1, -1): .5},
    "bound": {(0, 1): 0.0, (0, -1): 0.0, (1, 1): .5, (1, -1): .5},  # hop / pounce / rabbit
    "wave": "wave",  # centipedes & many-legged crawlers: ripple from back to front
}


def set_gait(rig, gait="alternate"):
    """Assign each leg its phase in the step cycle."""
    table = GAITS[gait]
    npairs = max([l.pair for l in rig.legs] + [0]) + 1
    for l in rig.legs:
        if table is None:
            l.phase = 0.0 if (l.pair + (l.side < 0)) % 2 == 0 else .5
        elif table == "wave":
            l.phase = ((npairs - 1 - l.pair) / npairs + (.5 if l.side < 0 else 0)) % 1.0
        else:
            l.phase = table.get((min(l.pair, 1), 1 if l.side >= 0 else -1), 0.0)


# --------------------------------------------------------------------------- build from plan

def build(plan, name="Creature"):
    """Create an armature from a body plan (see preset()). Returns a Rig."""
    data = bpy.data.armatures.new(name)
    arm = bpy.data.objects.new(name, data)
    bpy.context.scene.collection.objects.link(arm)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.mode_set(mode="EDIT")
    eb = data.edit_bones
    allpts = [_v(p) for c in plan["chains"] for p in c["points"]]
    span = max((max(p[i] for p in allpts) - min(p[i] for p in allpts)) for i in range(3))
    root = eb.new("root")
    root.head, root.tail = (0, 0, 0), (0, 0, span * .08)
    root.use_deform = False
    made = {}  # chain name (with side suffix) -> list of bone names
    chains = []
    specs = sorted(plan["chains"], key=lambda c: 0 if c["role"] == "spine" else 1)
    if not specs or specs[0]["role"] != "spine":
        raise ValueError("plan needs a chain with role 'spine' (the body); it carries everything else")
    pending = list(specs)
    guard = 0
    while pending:
        c = pending.pop(0)
        par = c.get("parent")
        if par and par.split(":")[0] not in made and par.split(":")[0] + ".L" not in made:
            pending.append(c)
            guard += 1
            if guard > len(specs) * 4:
                raise ValueError("chain %r: parent %r not found" % (c["name"], par))
            continue
        for side in ((1, -1) if c.get("mirror") else (0,)):
            suf = {1: ".L", -1: ".R", 0: ""}[side]
            pts = [_mirror(p) if side < 0 else _v(p) for p in c["points"]]
            if len(pts) < 2:
                raise ValueError("chain %r needs at least 2 points" % c["name"])
            names = []
            for i in range(len(pts) - 1):
                b = eb.new("%s_%d%s" % (c["name"], i + 1, suf))
                b.head, b.tail = pts[i], pts[i + 1]
                if (b.tail - b.head).length < 1e-5:
                    raise ValueError("chain %r has two identical consecutive points" % c["name"])
                if i:
                    b.parent = eb[names[-1]]
                    b.use_connect = True
                names.append(b.name)
            first = eb[names[0]]
            if c["role"] == "spine":
                first.parent = root
            else:
                first.parent = eb[_resolve_parent(c, pts[0], made, suf, eb)]
                if (first.parent.tail - first.head).length < 1e-5:
                    first.use_connect = True
            made[c["name"] + suf] = names
            if c["role"] == "spine":
                made["\0spine"] = names
            foot = None
            ik = names
            if c["role"] == "leg" and len(names) >= 3 and c.get("foot", True):
                foot, ik = names[-1], names[:-1]
            chains.append(Chain(c["name"] + suf, c["role"], ik, side, c.get("tag"), foot))
    bpy.ops.object.mode_set(mode="OBJECT")
    return Rig(arm, chains)


def _resolve_parent(c, p0, made, suf, eb):
    par = c.get("parent")
    if par:
        cname, _, idx = par.partition(":")
        bones = made.get(cname + suf) or made.get(cname) or made.get(cname + ".L")
        return bones[int(idx) if idx else -1]
    spine = made["\0spine"]
    if c["role"] == "tail":
        return spine[0]
    # nearest spine bone to the chain's first point
    def dist(bn):
        h, t = eb[bn].head, eb[bn].tail
        ab = t - h
        u = max(0, min(1, (p0 - h).dot(ab) / ab.length_squared))
        return (h + ab * u - p0).length
    return min(spine, key=dist)


# --------------------------------------------------------------------------- import helpers

def import_model(path):
    """Import .glb/.gltf/.fbx/.obj into the current scene; returns (armatures, meshes)."""
    before = set(bpy.data.objects)
    ext = os.path.splitext(path)[1].lower()
    if ext in (".glb", ".gltf"):
        bpy.ops.import_scene.gltf(filepath=path)
    elif ext == ".fbx":
        bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    elif ext == ".obj":
        bpy.ops.wm.obj_import(filepath=path)
    elif ext == ".blend":
        bpy.ops.wm.open_mainfile(filepath=path)
        before = set()
    else:
        raise ValueError("unsupported model format: " + ext)
    new = [o for o in bpy.data.objects if o not in before]
    return [o for o in new if o.type == "ARMATURE"], [o for o in new if o.type == "MESH"]


_ROLE_WORDS = [
    ("jaw", ("jaw",)), ("wing", ("wing",)), ("tentacle", ("tentacle", "tendril")), ("tail", ("tail",)),
    ("neck", ("neck", "head")),
    ("leg", ("thigh", "upleg", "upperleg", "shin", "calf", "lowerleg", "leg", "foot", "ankle", "hock", "paw")),
    ("arm", ("clavicle", "shoulder", "upperarm", "forearm", "lowerarm", "arm", "hand", "wrist")),
    ("spine", ("hips", "pelvis", "spine", "chest", "torso", "body", "waist", "abdomen", "thorax")),
]
_SKIP_WORDS = ("toe", "finger", "thumb", "index", "middle", "ring", "pinky", "ik", "pole", "ctrl", "twist", "roll", "end")


def guess_mapping(arm):
    """Best-effort Rig.from_armature() mapping from bone NAMES (Mixamo, Rigify, UE mannequin,
    Tripo and similar). It is a guess: print it, compare with inspect_model.py output, fix by hand."""
    def role(b):
        n = b.name.lower().replace("_", "").replace(" ", "").replace(".", "").replace("-", "")
        n = n.split(":")[-1]
        if any(w in n for w in _SKIP_WORDS):
            return None
        for r, words in _ROLE_WORDS:
            if any(w in n for w in words):
                return r
        return None
    roles = {b.name: role(b) for b in arm.data.bones}
    chains = {}
    for b in arm.data.bones:  # bones are stored parents-first
        r = roles[b.name]
        if not r:
            continue
        par = b.parent
        if par and roles.get(par.name) == r and par.name in chains and chains[par.name][-1] == par.name:
            chains[par.name].append(b.name)
            chains[b.name] = chains[par.name]
        else:
            chains[b.name] = [b.name]
    uniq = []
    for c in chains.values():
        if not any(c is u for u in uniq):
            uniq.append(c)
    m = {}
    for c in uniq:
        r = roles[c[0]]
        if r in ("spine", "neck", "tail", "jaw"):
            if r not in m or len(c) > len(m[r]):
                m[r] = c
        else:
            m.setdefault(r + "s", []).append(c)
    return m
