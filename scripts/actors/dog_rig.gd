class_name DogRig
extends Node3D
## Слепой пёс: скелет + процедурная четырёхногая походка (рысь/галоп) с фиксацией лап в мире.

enum { HIPS, CHEST, NECK, HEAD, JAW, TAIL1, TAIL2, FL_U, FL_L, FR_U, FR_L, HL_U, HL_L, HR_U, HR_L }
const NAMES := ["hips", "chest", "neck", "head", "jaw", "tail1", "tail2", "fl_u", "fl_l", "fr_u", "fr_l", "hl_u", "hl_l", "hr_u", "hr_l"]
const PARENT := [-1, 0, 1, 2, 3, 0, 5, 1, 7, 1, 9, 0, 11, 0, 13]
const BODY_H := 0.54
const UP_L := 0.25
const LO_L := 0.24
const PAW_H := 0.03

static var _mesh_cache := {}

var bone_pos: Array[Vector3] = []
var skel: Skeleton3D
var body_mi: MeshInstance3D
var velocity := Vector3.ZERO
var action := ""
var action_t := 0.0
var action_dur := 0.0
var dead := false
var death_t := 0.0
var alert := 0.0
var lod_skip := 0
var _lod_c := 0
var _acc := 0.0
var phase := 0.0
var gait_w := 0.0
var _t := 0.0
var _seed := 0.0
var _legs: Array = []
var _first := true
var _cur: Array = []
var _death_from: Array = []
var _hit := 0.0

class Leg:
	var bone_u := 0
	var mount := Vector3.ZERO     # точка крепления в модели (плечо/бедро)
	var neutral := Vector3.ZERO   # нейтральное положение лапы в модели
	var front := true
	var offset := 0.0
	var pos := Vector3.ZERO
	var cur := Vector3.ZERO
	var swing := false
	var t := 0.0
	var dur := 0.2
	var from := Vector3.ZERO
	var to := Vector3.ZERO
	var lift := 0.08

func setup(app: Dictionary = {}) -> void:
	_seed = randf() * 50.0
	for i in NAMES.size():
		bone_pos.append(Vector3.ZERO)
	bone_pos[HIPS] = Vector3(0, BODY_H, 0.26)
	bone_pos[CHEST] = Vector3(0, 0.02, -0.48)
	bone_pos[NECK] = Vector3(0, 0.05, -0.12)
	bone_pos[HEAD] = Vector3(0, 0.12, -0.14)
	bone_pos[JAW] = Vector3(0, -0.04, -0.04)
	bone_pos[TAIL1] = Vector3(0, 0.03, 0.1)
	bone_pos[TAIL2] = Vector3(0, 0.0, 0.16)
	bone_pos[FL_U] = Vector3(-0.08, -0.05, -0.02)
	bone_pos[FL_L] = Vector3(0, -UP_L, 0)
	bone_pos[FR_U] = Vector3(0.08, -0.05, -0.02)
	bone_pos[FR_L] = Vector3(0, -UP_L, 0)
	bone_pos[HL_U] = Vector3(-0.08, -0.04, 0.0)
	bone_pos[HL_L] = Vector3(0, -UP_L, 0)
	bone_pos[HR_U] = Vector3(0.08, -0.04, 0.0)
	bone_pos[HR_L] = Vector3(0, -UP_L, 0)
	skel = Skeleton3D.new()
	add_child(skel)
	for i in NAMES.size():
		skel.add_bone(NAMES[i])
	for i in NAMES.size():
		if PARENT[i] >= 0:
			skel.set_bone_parent(i, PARENT[i])
		skel.set_bone_rest(i, Transform3D(Basis(), bone_pos[i]))
	skel.reset_bone_poses()
	body_mi = MeshInstance3D.new()
	body_mi.mesh = get_mesh(app)
	body_mi.custom_aabb = AABB(Vector3(-1.2, -0.2, -1.4), Vector3(2.4, 1.6, 2.8))
	skel.add_child(body_mi)
	body_mi.skeleton = NodePath("..")
	var chest_m := bone_pos[HIPS] + bone_pos[CHEST]
	var hips_m := bone_pos[HIPS]
	var defs := [[FL_U, chest_m + bone_pos[FL_U], true, 0.0], [FR_U, chest_m + bone_pos[FR_U], true, 0.5],
		[HL_U, hips_m + bone_pos[HL_U], false, 0.5], [HR_U, hips_m + bone_pos[HR_U], false, 0.0]]
	for d in defs:
		var l := Leg.new()
		l.bone_u = d[0]
		l.mount = d[1]
		l.front = d[2]
		l.offset = d[3]
		l.neutral = Vector3(l.mount.x * 1.1, PAW_H, l.mount.z + (0.0 if l.front else 0.04))
		_legs.append(l)
	for i in NAMES.size():
		_cur.append(Quaternion.IDENTITY)

static func _bw(b: int) -> Array:
	return [PackedInt32Array([b, 0, 0, 0]), PackedFloat32Array([1, 0, 0, 0])]

static func _bw2(a: int, b: int, w: float) -> Array:
	return [PackedInt32Array([a, b, 0, 0]), PackedFloat32Array([1.0 - w, w, 0, 0])]

static func get_mesh(app: Dictionary) -> ArrayMesh:
	var key := str(app.hash())
	if _mesh_cache.has(key):
		return _mesh_cache[key]
	var mb := MeshBuilder.new()
	mb.skinned = true
	var skin := MeshBuilder.mat(app.get("skin", Color(0.55, 0.42, 0.38)), MeshBuilder.MAT_SKIN)
	var dark := MeshBuilder.mat(app.get("dark", Color(0.32, 0.22, 0.2)), MeshBuilder.MAT_SKIN)
	var mouth := MeshBuilder.mat(Color(0.35, 0.08, 0.08), MeshBuilder.MAT_SKIN)
	var teeth := MeshBuilder.mat(Color(0.85, 0.82, 0.7), MeshBuilder.MAT_SKIN)
	var up := Vector3.UP
	var hy := BODY_H
	# туловище: таз → грудь (поджарое, рёбра)
	mb.add_limb(Vector3(0, hy + 0.02, 0.36), Vector3(0, hy + 0.0, 0.1), 0.085, 0.1, 0.1, 0.12, 8, dark, up, _bw(HIPS)[0], _bw(HIPS)[1], _bw2(HIPS, CHEST, 0.3)[0], _bw2(HIPS, CHEST, 0.3)[1], true, false)
	mb.add_limb(Vector3(0, hy + 0.0, 0.1), Vector3(0, hy + 0.02, -0.12), 0.1, 0.12, 0.12, 0.16, 8, skin, up, _bw2(HIPS, CHEST, 0.3)[0], _bw2(HIPS, CHEST, 0.3)[1], _bw2(HIPS, CHEST, 0.8)[0], _bw2(HIPS, CHEST, 0.8)[1])
	mb.add_limb(Vector3(0, hy + 0.02, -0.12), Vector3(0, hy + 0.04, -0.3), 0.12, 0.16, 0.11, 0.15, 8, skin, up, _bw2(HIPS, CHEST, 0.8)[0], _bw2(HIPS, CHEST, 0.8)[1], _bw(CHEST)[0], _bw(CHEST)[1])
	# шея и голова
	var neck_m := Vector3(0, hy + 0.07, -0.34)
	var head_m := neck_m + Vector3(0, 0.12, -0.14)
	mb.add_limb(Vector3(0, hy + 0.04, -0.3), neck_m + Vector3(0, 0.1, -0.12), 0.11, 0.14, 0.065, 0.07, 8, skin, up, _bw(CHEST)[0], _bw(CHEST)[1], _bw2(NECK, HEAD, 0.4)[0], _bw2(NECK, HEAD, 0.4)[1])
	mb.add_limb(head_m + Vector3(0, 0.0, 0.06), head_m + Vector3(0, -0.01, -0.08), 0.07, 0.075, 0.06, 0.055, 8, skin, up, _bw(HEAD)[0], _bw(HEAD)[1], _bw(HEAD)[0], _bw(HEAD)[1], true, false)
	mb.add_limb(head_m + Vector3(0, -0.005, -0.08), head_m + Vector3(0, -0.02, -0.2), 0.045, 0.035, 0.03, 0.025, 6, skin, up, _bw(HEAD)[0], _bw(HEAD)[1], _bw(HEAD)[0], _bw(HEAD)[1], false, true)
	mb.set_bone(HEAD)
	mb.add_box(Transform3D(Basis(), head_m + Vector3(0, 0.0, -0.205)), Vector3(0.035, 0.025, 0.02), MeshBuilder.mat(Color(0.12, 0.08, 0.08), MeshBuilder.MAT_SKIN))
	# слепые бельма вместо глаз
	for s in [-1.0, 1.0]:
		mb.add_box(Transform3D(Basis(), head_m + Vector3(s * 0.045, 0.03, -0.07)), Vector3(0.02, 0.012, 0.03), dark)
		mb.add_box(Transform3D(Basis(Vector3.FORWARD, s * 0.5), head_m + Vector3(s * 0.05, 0.08, 0.02)), Vector3(0.025, 0.07, 0.05), dark)
		mb.add_box(Transform3D(Basis(), head_m + Vector3(s * 0.025, -0.045, -0.17)), Vector3(0.008, 0.02, 0.008), teeth)
	mb.set_bone(JAW)
	mb.add_box(Transform3D(Basis(Vector3.RIGHT, 0.08), head_m + Vector3(0, -0.055, -0.11)), Vector3(0.06, 0.025, 0.15), mouth)
	# хвост
	mb.add_limb(Vector3(0, hy + 0.05, 0.36), Vector3(0, hy + 0.05, 0.52), 0.025, 0.025, 0.018, 0.018, 6, dark, up, _bw(TAIL1)[0], _bw(TAIL1)[1], _bw2(TAIL1, TAIL2, 0.5)[0], _bw2(TAIL1, TAIL2, 0.5)[1])
	mb.add_limb(Vector3(0, hy + 0.05, 0.52), Vector3(0, hy + 0.04, 0.72), 0.018, 0.018, 0.006, 0.006, 6, dark, up, _bw2(TAIL1, TAIL2, 0.5)[0], _bw2(TAIL1, TAIL2, 0.5)[1], _bw(TAIL2)[0], _bw(TAIL2)[1], false, true)
	# лапы
	var chest_m := Vector3(0, hy + 0.02, -0.22)
	var hips_m := Vector3(0, hy, 0.26)
	for d in [[FL_U, FL_L, chest_m + Vector3(-0.08, -0.05, -0.02), CHEST], [FR_U, FR_L, chest_m + Vector3(0.08, -0.05, -0.02), CHEST],
			[HL_U, HL_L, hips_m + Vector3(-0.08, -0.04, 0.0), HIPS], [HR_U, HR_L, hips_m + Vector3(0.08, -0.04, 0.0), HIPS]]:
		var bu: int = d[0]
		var bl: int = d[1]
		var m: Vector3 = d[2]
		var par: int = d[3]
		var knee := m + Vector3(0, -UP_L, 0)
		var paw := knee + Vector3(0, -LO_L, 0)
		var thick := 0.055 if bu >= HL_U else 0.045
		mb.add_limb(m + Vector3(0, 0.08, 0), knee, thick, thick * 1.3, 0.028, 0.03, 6, skin, Vector3.FORWARD, _bw2(par, bu, 0.7)[0], _bw2(par, bu, 0.7)[1], _bw2(bu, bl, 0.5)[0], _bw2(bu, bl, 0.5)[1])
		mb.add_limb(knee, paw + Vector3(0, 0.02, 0), 0.028, 0.03, 0.022, 0.024, 6, skin, Vector3.FORWARD, _bw2(bu, bl, 0.5)[0], _bw2(bu, bl, 0.5)[1], _bw(bl)[0], _bw(bl)[1])
		mb.set_bone(bl)
		mb.add_box(Transform3D(Basis(), paw + Vector3(0, 0.0, -0.025)), Vector3(0.05, 0.035, 0.08), dark)
	var mesh := mb.build(Mats.character())
	_mesh_cache[key] = mesh
	return mesh

func play(act: String, dur: float) -> void:
	if dead:
		return
	action = act
	action_t = 0.0
	action_dur = dur

func hit_react() -> void:
	_hit = 1.0

func reset_feet() -> void:
	_first = true

func set_shadow(on: bool) -> void:
	body_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func die() -> void:
	if dead:
		return
	dead = true
	death_t = 0.0
	_death_from = _cur.duplicate()

func update_pose(delta: float) -> void:
	if lod_skip > 0:
		_lod_c += 1
		_acc += delta
		if _lod_c <= lod_skip:
			return
		_lod_c = 0
		delta = _acc
		_acc = 0.0
	delta = minf(delta, 0.1)
	_t += delta
	if dead:
		_update_death(delta)
		return
	if action != "":
		action_t += delta
		if action_t >= action_dur:
			action = ""
	_hit = maxf(0.0, _hit - delta * 4.0)
	var xf := get_global_transform_interpolated() if is_inside_tree() else global_transform
	var inv := xf.affine_inverse()
	var lv := xf.basis.inverse() * velocity
	lv.y = 0
	var speed := lv.length()
	var gallop := smoothstep(4.0, 6.5, speed)
	var duty := lerpf(0.55, 0.32, smoothstep(1.0, 6.0, speed))
	var stance_half := lerpf(0.12, 0.3, smoothstep(0.5, 7.0, speed))
	var cycle := 2.0 * stance_half / duty
	var moving := speed > 0.1
	gait_w = move_toward(gait_w, 1.0 if moving else 0.0, delta * 4.0)
	if moving:
		phase = fmod(phase + speed * delta / cycle, 1.0)
	var floor_y := xf.origin.y
	if _first:
		_first = false
		for l: Leg in _legs:
			l.pos = xf * l.neutral
			l.cur = l.pos
			l.swing = false
	var vdir := lv.normalized() if speed > 0.01 else Vector3.ZERO
	var swing_time := (1.0 - duty) * cycle / maxf(speed, 0.5)
	for i in 4:
		var l: Leg = _legs[i]
		var off := l.offset
		if gallop > 0.5:
			off = [0.0, 0.12, 0.55, 0.65][i]
		var fp := fmod(phase + off, 1.0)
		if l.swing:
			l.t += delta / l.dur
			var rem := (1.0 - l.t) * l.dur
			var tgt := xf * (l.neutral + vdir * stance_half * (1.0 if moving else 0.0)) + velocity * rem
			tgt.y = floor_y + PAW_H
			l.to = tgt
			if l.t >= 1.0:
				l.swing = false
				l.pos = l.to
				l.cur = l.pos
			else:
				var e := l.t * l.t * (3.0 - 2.0 * l.t)
				l.cur = l.from.lerp(l.to, e)
				l.cur.y = floor_y + PAW_H + sin(l.t * PI) * l.lift
		else:
			l.cur = l.pos
			var go := false
			if moving and fp >= duty:
				go = true
			var rel := inv * l.pos
			if (rel - l.mount).length() > (UP_L + LO_L) * 1.05:
				go = true
			if not moving and Vector2(rel.x - l.neutral.x, rel.z - l.neutral.z).length() > 0.12:
				go = true
			if go:
				l.swing = true
				l.t = 0.0
				l.dur = clampf(swing_time, 0.1, 0.3) if moving else 0.18
				l.from = l.pos
				l.lift = lerpf(0.06, 0.13, smoothstep(0.5, 5.0, speed))
	# --- корпус ---
	var bob := sin(phase * TAU * 2.0) * 0.015 * gait_w + sin(phase * TAU) * 0.05 * gallop
	var crouch := 0.0
	var head_drop := 0.0
	var jaw := 0.0
	var lunge := 0.0
	if action == "attack":
		var k := action_t / action_dur
		lunge = sin(clampf(k, 0, 1) * PI)
		jaw = sin(clampf(k * 1.3, 0, 1) * PI) * 0.7
		crouch = -lunge * 0.05
	elif action == "sniff" or (not moving and alert < 0.5):
		head_drop = 0.35 + sin(_t * 2.0 + _seed) * 0.1
	if alert > 0.5 and not moving:
		crouch = 0.08
		jaw = 0.15 + sin(_t * 9.0) * 0.08
	var pitch_body := sin(phase * TAU + 0.6) * 0.12 * gallop
	var hips_b := Basis(Vector3.RIGHT, pitch_body + lunge * 0.15) * Basis(Vector3.FORWARD, _hit * 0.3)
	var hips_p := Vector3(0, BODY_H - crouch + bob - _hit * 0.05, 0.26 - lunge * 0.15)
	var chest_b := hips_b * Basis(Vector3.RIGHT, -pitch_body * 1.6 - lunge * 0.2) * Basis(Vector3.UP, sin(phase * TAU) * 0.06 * gait_w)
	var neck_b := chest_b * Basis(Vector3.RIGHT, -head_drop * 0.6 + lunge * 0.3 - pitch_body)
	var head_b := neck_b * Basis(Vector3.RIGHT, -head_drop * 0.5 + lunge * 0.25 + sin(phase * TAU * 2.0) * 0.05) * Basis(Vector3.UP, sin(_t * 1.3 + _seed) * 0.3 * (1.0 - gait_w))
	var jaw_b := head_b * Basis(Vector3.RIGHT, -jaw)
	var wag := sin(_t * (8.0 if alert < 0.5 else 3.0)) * (0.5 if alert < 0.5 else 0.1)
	var tail1_b := hips_b * Basis(Vector3.RIGHT, -0.5 + gallop * 0.4) * Basis(Vector3.UP, wag)
	var tail2_b := tail1_b * Basis(Vector3.RIGHT, -0.3) * Basis(Vector3.UP, wag * 0.6)
	var hips_t := Transform3D(hips_b, hips_p)
	var chest_t := Transform3D(chest_b, hips_t * bone_pos[CHEST])
	var g: Array = []
	g.resize(NAMES.size())
	g[HIPS] = hips_b
	g[CHEST] = chest_b
	g[NECK] = neck_b
	g[HEAD] = head_b
	g[JAW] = jaw_b
	g[TAIL1] = tail1_b
	g[TAIL2] = tail2_b
	for i in 4:
		var l: Leg = _legs[i]
		var mount: Vector3 = (chest_t if l.front else hips_t) * bone_pos[l.bone_u]
		var paw := inv * l.cur
		var pole := Vector3(0, 0, 1) if l.front else Vector3(0, 0, -1)
		var knee := HumanRig._ik(mount, paw, UP_L, LO_L, pole)
		var ub := HumanRig._basis_y_fwd((mount - knee).normalized(), Vector3.FORWARD)
		var lb := HumanRig._basis_y_fwd((knee - paw).normalized(), Vector3.FORWARD)
		g[l.bone_u] = ub
		g[l.bone_u + 1] = lb
	skel.set_bone_pose_position(HIPS, hips_p)
	for i in NAMES.size():
		var b: Basis = g[i]
		var p: int = PARENT[i]
		var q: Quaternion = b.get_rotation_quaternion() if p < 0 else ((g[p] as Basis).inverse() * b).orthonormalized().get_rotation_quaternion()
		_cur[i] = q
		skel.set_bone_pose_rotation(i, q)

func _update_death(delta: float) -> void:
	if death_t >= 1.0:
		return
	death_t = minf(1.0, death_t + delta / 0.6)
	var k := death_t * death_t
	for i in NAMES.size():
		var to := Quaternion.IDENTITY
		if i == HIPS:
			to = Quaternion(Basis(Vector3.FORWARD, PI * 0.5))
		elif i in [FL_U, FR_U, HL_U, HR_U]:
			to = Quaternion(Basis(Vector3.RIGHT, randf_range(-0.3, 0.3) if death_t < 0.05 else 0.2))
		elif i == JAW:
			to = Quaternion(Basis(Vector3.RIGHT, -0.4))
		skel.set_bone_pose_rotation(i, (_death_from[i] as Quaternion).slerp(to, k))
	skel.set_bone_pose_position(HIPS, Vector3(0.0, lerpf(BODY_H, 0.1, k), 0.26))
