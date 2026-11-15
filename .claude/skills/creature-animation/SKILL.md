---
name: creature-animation
description: Rig and animate 3D characters and fantasy creatures (humanoids, dragons, wyverns, quadrupeds, spiders, insects, serpents, tentacled monsters, hydras, any invented anatomy) with Blender Python scripts and export game-ready clips (idle, walk, run, fly, attack, hit, death, roar, custom) as FBX/GLB for Unity, Unreal or Godot. Use this whenever the user wants a character, monster, animal or creature animated, rigged, given a walk cycle / attack / death / flight animation, asks for an animation set for a game, has a .glb/.fbx/.blend model that needs skeleton or clips, or mentions Blender animation scripting - even if they don't say "Blender" or "skill". Russian triggers too - анимация персонажа, анимировать существо/монстра/дракона, цикл ходьбы, риг, скелет, анимации для игры.
---

# Creature animation (Blender scripts → game engine)

You animate by writing short Python scripts against `scripts/creature_anim.py`, running them
headless, **looking at the preview image**, fixing, and exporting. The library does the
mechanical parts that are easy to get wrong (bone-axis maths, leg IK, seamless loops, exporter
flags). Your job is the part that needs judgement: anatomy, timing, weight, personality.

## Setup

Run scripts with either:

- `python3 script.py` after `pip install bpy pillow` (the `bpy` wheel is Blender as a module;
  if pip finds no wheel for this Python, use a real Blender), or
- `blender -b -P script.py` (Blender 4.4+; inside it: `sys.executable -m pip install pillow`).

Every script starts with:

```python
import sys; sys.path.insert(0, "<this skill's folder>/scripts")
import creature_anim as ca
```

Conventions: **up +Z, creature faces −Y, its left is +X, ground at Z=0, metres.**

## Workflow

1. **Pick the route**
   - *No model* (or "just prototype it") → build a skeleton from a body plan + blockout mesh.
   - *Rigged model* (.glb/.fbx/.blend with bones) → wrap its skeleton.
   - *Unrigged mesh* → build a skeleton fitted to it, then skin it.

   For any supplied file run `python3 scripts/inspect_model.py model.glb --png look.png` first
   and read both the text and the image. Never guess what is inside a model.
2. **Write the script** (templates below). Start from stock clips, then add or replace clips
   the request is really about.
3. **Preview and look.** `rig.preview("out/preview.png")` writes contact sheets (3 clips per
   image). Open every one with the Read tool. This is your only eyes - a clip you have not
   looked at is a clip you do not know works. See *What to look for* below.
4. **Fix and repeat** until the motion reads correctly. Regenerating takes seconds.
5. **Export + validate**: `rig.export("out/name", engine="unity"|"unreal"|"godot")` then
   `python3 scripts/validate_export.py out/name.fbx` (and the .glb). It re-imports the file as
   an engine would and fails on missing clips, loops that pop, unweighted vertices.
6. **Report** what was produced: files, clip table (name, seconds, loop, speed m/s), how to
   import it (read `references/engines.md` for the user's engine), and honest caveats
   (blockout mesh is a placeholder; auto-skinning quality; anything that still looks off).

## Route A - build a creature from a body plan

```python
ca.reset_scene()
plan = ca.preset("dragon", size=3.0)      # humanoid quadruped dragon wyvern bird serpent spider insect tentacle
rig = ca.build(plan, name="Dragon")
rig.add_blockout()                         # placeholder skinned mesh, so it is visible in-engine
rig.add_standard_clips()                   # picks what fits the anatomy; or pass a list of names
rig.preview("out/preview.png")
rig.export("out/dragon", engine="unity")
```

A plan is just `{"chains": [...]}`; each chain is a list of joint positions, root first:

```python
{"name": "wing", "role": "wing", "mirror": True,           # give the LEFT side (x > 0)
 "points": [(.3, -.4, 2.1), (1.6, -.2, 2.5), (3.4, -.6, 2.4), (5.2, .4, 2.2)],
 "parent": "spine:-1"}                                      # optional: "chain" or "chain:index"
```

Roles: `spine` (exactly one; hips→chest; carries everything), `neck` (last bone = head),
`tail`, `leg`, `arm`, `wing`, `tentacle`, `extra` (horns, fins, jaw with `"tag": "jaw"`).
Invented anatomy is just more chains: a hydra is three `neck` chains, a centaur is a
quadruped with a second upright spine section and arms, a griffin is a quadruped plus wings.
Edit a preset's points or write the plan from scratch - whichever is less work.

Rules that keep rigs working:
- Legs: `[hip, knee, ankle, toe]` (4 points → gets a foot bone) or `[hip, knee, tip]`.
  **Bend the knee slightly in the rest pose in the direction it should bend** - IK follows
  the existing bend; a perfectly straight leg can fold either way.
- Feet at Z≈0 in the rest pose; the lowest point of the rig defines the floor.
- Humanoids in T-pose (arms straight out) - stock clips bring the arms down.
- 3-6 bones per tail/neck/tentacle is plenty; more bones = smoother curve, bigger files.

## Route B - animate an existing rigged model

```python
ca.reset_scene()
arms, meshes = ca.import_model("in/troll.fbx")
arm = arms[0]
print(ca.guess_mapping(arm))               # name-based guess - verify against inspect_model output
rig = ca.Rig.from_armature(arm, {
    "spine": ["Hips", "Spine", "Spine1", "Spine2"],
    "neck":  ["Neck", "Head"],
    "legs":  [["LeftUpLeg", "LeftLeg", "LeftFoot"], ["RightUpLeg", "RightLeg", "RightFoot"]],
    "arms":  [["LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand"], ["RightShoulder", "RightArm", "RightForeArm", "RightHand"]],
    "tail":  [...], "wings": [[...], [...]], "jaw": ["Jaw"],
})                                          # forward=(x,y,z) if the model does not face along the head
```

The mapping only needs the bones you will animate; fingers, twist bones etc. can be left out.
Bone axes, scale (FBX 0.01) and orientation do not matter - poses are expressed in creature
terms and converted per bone. Existing clips in the file are kept; yours are added.
If the model's rest pose is not a T-pose/neutral stance, stock clips assume it is: check the
preview and adjust (e.g. an A-pose needs less arm drop - write the clip yourself).

## Route C - unrigged mesh

Read the `inspect_model.py` cross-sections and silhouette, then write a plan whose joints sit
**inside** the mesh at the real joints (shoulders, hips, knees, wing roots), and:

```python
arms, meshes = ca.import_model("in/beast.glb")
rig = ca.build(plan, name="Beast")
rig.bind_mesh(meshes)                      # heat weights, falls back to envelopes
rig.preview("out/bind_check.png", views=("side", "front"))
```

Automatic skinning is a rough first pass: it fails on meshes made of separate shells and
bleeds between limbs that touch. Say so in your report; the preview shows how bad it is.

## Writing clips

A clip is a function that poses the creature at time `t` (0→1). The library samples it,
solves leg IK, and bakes keys:

```python
import creature_clips
from creature_anim import osc, pulse, ease

def tail_slam(P, t):
    wind = pulse(t, 0.00, 0.35, 0.50)       # anticipation: rises 0→.35, gone by .5
    hit  = pulse(t, 0.42, 0.52, 0.90)       # the action: fast in, slow out
    tail = rig.chain("tail").bones
    creature_clips.base_pose(P, rig)        # arms down + wings folded, same as the stock idle
    P.body(up=-rig.leg_len * .10 * wind, yaw=18 * wind - 30 * hit)   # hips drive it
    for i, b in enumerate(tail):
        P.rot(b, left=-9 * wind + 14 * pulse(t, .42 + i * .03, .54 + i * .03, .95), up=5 * wind)
    P.rot(rig.head, left=12 * hit)                                   # look where it lands

rig.clip("tail_slam", tail_slam, duration=1.4, loop=False)
```

`P` (see `Pose` in `creature_anim.py` for full docstrings):

| call | meaning |
|---|---|
| `P.rot(bone, up=, left=, fwd=, out=, twist=)` | swing a bone so its **tip** moves that way, degrees from rest. `out` mirrors for .L/.R. Children inherit. Accepts a list. A direction the bone already points along does nothing (`up` on a vertical neck or spine) - use `fwd`/`left` there, or `P.turn`. |
| `P.turn(bone, pitch=, yaw=, roll=)` | rigid rotation (nose up / turn left / lean left) - heads, whole-body attitude |
| `P.body(up=, fwd=, left=, pitch=, yaw=, roll=)` | move/tilt the whole body via the hips; planted feet stay put |
| `P.foot(leg, fwd=, up=, left=, pitch=)` | place a foot relative to its rest spot (metres); `leg` = index into `rig.legs`, name, or chain |
| `P.gait(stride, lift, duty)` | full stepping cycle for every leg, in place; phases via `ca.set_gait(rig, "alternate"\|"walk4"\|"gallop"\|"bound"\|"wave")` |
| `P.wave(bones, amp, cycles, lag, toward=)` | travelling wave down a chain - tails, tentacles, serpents |

Helpers: `osc(t, cycles, phase)` loop-safe sine; `pulse(t, start, peak, end)` one-shot bump;
`ease(x)`. Handles: `rig.spine`, `rig.hips`, `rig.head`, `rig.legs`, `rig.by_role("wing")`,
`rig.chain("tail").bones`, `rig.tagged("jaw")`, `rig.leg_len`, `rig.height`.
With several of something (three necks, two tails, four wings) address each chain by its plan
name - `rig.chain("neck_left").bones` - or loop over `rig.by_role("neck")`; `rig.head` is only
the first neck's head. Give each jaw its own `"tag"` (`"jaw_left"`) to open them separately.

Things that make clips work:
- **Size amplitudes from the rig** (`rig.leg_len`, `rig.height`), never raw metres, so the
  clip survives a rescale.
- **Loops**: only use `t` through `osc()` with integer `cycles` (or other functions with
  period 1). Then the last frame equals the first by construction. `validate_export.py` checks.
- **Start from the shared base pose**: the rest pose has arms out and wings spread, which is
  not how the creature stands. `creature_clips.base_pose(P, rig)` applies the same stance the
  stock idle uses; without it a custom ground clip snaps the wings open when it starts.
- **One-shots** (attack, hit, death): build from `pulse()`/`ease()` windows; start at the idle
  pose (all windows 0 at t=0) so the engine can blend in. Attacks should also end there.
- **Lying down / falling**: pass `keep_above_ground=True` to `rig.clip` - limbs drape on the
  floor instead of sinking through it.
- **Feet that cannot reach hover.** If `rig.clip` prints `WARNING ... planted feet out of
  reach`, the body is too high or too far from where the feet are planted (common on rigs with
  nearly straight legs, and in rearing/howling poses). Lower the hips or move the feet until
  the warning is gone - hovering feet are hard to spot on the contact sheet.
- **Locomotion is in place** (treadmill). Pass `speed=ca.gait_speed(stride, duration)` so
  `clips.json` tells the game how fast to move the actor without foot sliding.
- Copy a maker from `scripts/creature_clips.py` when you need a variant (limp, sneak, charge,
  hover-attack) - it is quicker and better than starting blank.

Before writing clips for an unfamiliar anatomy or a request about *feel* ("heavy", "menacing",
"skittering"), read `references/animation-craft.md` - gait tables, timing by creature mass,
wing/serpent/tentacle mechanics, and how to stage attacks.

## What to look for in the preview

Rows are clips (side view, then top view); columns are evenly spaced moments. The red line is
the floor; grey is the mesh; colours are chains (blue legs, pink wings, green tail, orange neck).

- Columns look identical → nothing is moving; amplitude too small or wrong bone list.
- Feet under the red line, or hovering during stance → stride/lift too big for the leg, or the
  rest pose has feet off the floor.
- A stock clip that does not suit this anatomy (wing fold poking out, slither on a reared
  body) → do not ship it and apologise in the report; copy its maker and adjust the numbers.
- Knees/elbows bending the wrong way → rest pose needs a slight bend in the right direction.
- Limb shoots off at a strange angle → wrong sign or wrong `toward` (`up` vs `fwd`); for
  vertical bones `up` does nothing, use `fwd`/`left`.
- Everything moves in unison → add `lag` down chains and offset phases; it reads as robotic.
- Mesh (grey) not following the bones → skinning problem, not an animation problem.
- An attack with no wind-up, a death with no settle, a walk with a rock-steady torso → flat
  performance; see the craft reference.

Use `rig.preview(path, clips=["walk"], cols=8, views=("side", "front"))` to zoom into one clip.

## Output

`rig.export(base, engine=...)` writes `base.fbx` and/or `base.glb` plus `base.clips.json`
(clip names, frames, fps, loop flag, speed). Unity/Unreal get FBX (+GLB), Godot/web get GLB.
All clips live in one file as named takes. Clip names are lower_snake_case and are what the
engine shows - keep them stable (`idle`, `walk`, `run`, `attack_bite`, `death`). Godot is the
one exception worth knowing: a `-loop` suffix (`walk-loop`) makes it loop the clip on import.
Save the generating script next to the outputs so the set can be regenerated or tweaked.
