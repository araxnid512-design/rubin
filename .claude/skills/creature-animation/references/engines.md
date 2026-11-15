# Importing the exports into game engines

`rig.export(base, engine=...)` already picks the right axes and flags. This is what to tell
the user (or do yourself if the project is in reach) on the engine side.

## Unity (FBX)
- Drop `name.fbx` into `Assets/`. Rig tab: **Generic** for creatures (Humanoid only for
  two-arm-two-leg characters when retargeting is wanted; it ignores tails/wings/extra limbs).
  Root node: `root`.
- Animation tab: each take is a clip. Tick **Loop Time** for clips marked `"loop": true` in
  `clips.json` (Unity does not read loop flags from FBX). Leave root-motion options off -
  clips are in place.
- Animator: blend tree `idle → walk → run` on a speed parameter; set each motion's speed so
  actor velocity = `speed_m_s` from `clips.json` (prevents foot sliding).
- Scale: exported at 1 unit = 1 m with FBX units scale; Scale Factor stays 1.

## Unreal (FBX)
- Import with *Skeletal Mesh* + *Import Animations*; one AnimSequence per take.
- Exported X-forward, Z-up. If the mesh arrives rotated 90°, set Import Rotation yaw −90
  rather than re-exporting.
- Enable looping per AnimSequence in the Blend Space / state machine; use `speed_m_s` for the
  Blend Space axis values.
- UE5 can also import the `.glb` directly (Interchange) if FBX gives trouble.

## Godot 4 (GLB)
- Drop `name.glb` into the project; all clips appear in the AnimationPlayer.
- Loop: in the Advanced Import dialog set *Loop Mode → Linear* for looping clips, or name
  clips with a `-loop` suffix before export (Godot auto-loops those).
- The GLB faces +Z (glTF convention). If the game treats −Z as forward, rotate the
  imported scene root 180° around Y.

## Web / three.js / Babylon (GLB)
- `GLTFLoader` → `gltf.animations` (AnimationClip per clip) → `AnimationMixer`.
- Loop clips: `LoopRepeat`; one-shots: `LoopOnce` + `clampWhenFinished = true`.

## Common problems
| symptom | cause / fix |
|---|---|
| creature lies on its side | wrong up-axis on import; use the engine preset in `rig.export` |
| tiny or giant | FBX unit scale; in Blender-made files 1 unit = 1 m |
| loop "pops" | clip not flagged as looping in the engine, or it is a one-shot |
| feet slide | actor speed ≠ `speed_m_s`; scale playback rate with speed |
| extra `_end` bones | not produced here (`add_leaf_bones=False`); comes from other exporters |
| only one clip shows | engine imported the default take only - enable "import all animations/takes" |
