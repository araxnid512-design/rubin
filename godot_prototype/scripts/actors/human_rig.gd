class_name HumanRig
extends Node3D
## Скелетная модель человека (Skeleton3D + скиннинг) и процедурная анимация.
## Персонаж и оружие — отдельные объекты: оружие (WeaponView) только позиционируется
## скелетом, а руки ставятся на его рукоять/цевьё/магазин через IK.
## — походка со стопами, зафиксированными в мире (нет скольжения ног);
## — только стоячие позы (без приседаний и колена);
## — состояния хвата из HoldProfiles: idle, low, carry, aim, inspect;
## — перезарядки по типу оружия: магазин, пистолет, короб ПКМ, обойма, переломка, патроны по одному, барабан;
## — действия: перевязка, лечение другого, ремонт, подбор, использование, приветствие, разговор, попадание, смерть.

enum { HIPS, SPINE, CHEST, NECK, HEAD, UA_L, FA_L, HAND_L, UA_R, FA_R, HAND_R, TH_L, SH_L, FOOT_L, TH_R, SH_R, FOOT_R }

const BONE_NAMES := ["hips", "spine", "chest", "neck", "head", "upperarm_l", "forearm_l", "hand_l",
	"upperarm_r", "forearm_r", "hand_r", "thigh_l", "shin_l", "foot_l", "thigh_r", "shin_r", "foot_r"]
const BONE_PARENT := [-1, 0, 1, 2, 3, 2, 5, 6, 2, 8, 9, 0, 11, 12, 0, 14, 15]

const HIP_Y := 0.95
const SPINE_L := 0.12
const CHEST_L := 0.20
const NECK_L := 0.26
const HEAD_L := 0.09
const SH_X := 0.19
const SH_Y := 0.22
const UPPER := 0.30
const FORE := 0.27
const HIP_X := 0.10
const HIP_DY := -0.04
const THIGH := 0.44
const SHIN := 0.40
const ANKLE_H := 0.075
const LEG := THIGH + SHIN

static var _mesh_cache := {}

signal footstep(pos: Vector3, speed: float)

var bone_pos: Array[Vector3] = []
var skel: Skeleton3D
var body_mi: MeshInstance3D
var weapon: WeaponView
var weapon_id := ""
var hold_class := "rifle"
var appearance := {}

# --- входные параметры (задаются актёром) ---
var velocity := Vector3.ZERO
var aiming := false
var hold_state := "low"
var aim_dir := Vector3.FORWARD
var look_at_pos: Variant = null
var look_bias := 0.0
var shamble := 0.0
var holster := false
var fire_kick := 0.0

# --- действие ---
var action := ""
var action_t := 0.0
var action_dur := 0.0
var dead := false
var death_t := 0.0
var _death_from: Array = []
var _death_to: Array = []
var _death_hips_from := Vector3.ZERO
var _death_hips_to := Vector3.ZERO

# --- внутреннее состояние ---
var phase := 0.0
var gait_w := 0.0
var _feet: Array = []
var _first := true
var _cur_rot: Array = []
var _hips_pos := Vector3.ZERO
var _hip_smooth := -1.0
var _smooth_twist := 0.0
var _smooth_pitch := 0.0
var _smooth_lean := Vector2.ZERO
var _prev_vel := Vector3.ZERO
var _head_yaw := 0.0
var _idle_t := 0.0
var _hit_k := 0.0
var _seed := 0.0
var _w_rel := Transform3D.IDENTITY     # оружие относительно груди (сглаживается)
var _w_init := false
var use_interp := true
var lod_skip := 0
var _lod_counter := 0
var _acc_dt := 0.0

class Foot:
	var pos := Vector3.ZERO
	var yaw := 0.0
	var swing := false
	var t := 0.0
	var dur := 0.3
	var from := Vector3.ZERO
	var to := Vector3.ZERO
	var from_yaw := 0.0
	var to_yaw := 0.0
	var side := -1.0
	var lift := 0.12
	var cur := Vector3.ZERO
	var cur_yaw := 0.0
	var pitch := 0.0

func setup(app: Dictionary) -> void:
	appearance = app
	_seed = randf() * 100.0
	for i in BONE_NAMES.size():
		bone_pos.append(Vector3.ZERO)
	bone_pos[HIPS] = Vector3(0, HIP_Y, 0)
	bone_pos[SPINE] = Vector3(0, SPINE_L, 0)
	bone_pos[CHEST] = Vector3(0, CHEST_L, 0)
	bone_pos[NECK] = Vector3(0, NECK_L, 0)
	bone_pos[HEAD] = Vector3(0, HEAD_L, 0)
	bone_pos[UA_L] = Vector3(-SH_X, SH_Y, 0)
	bone_pos[FA_L] = Vector3(0, -UPPER, 0)
	bone_pos[HAND_L] = Vector3(0, -FORE, 0)
	bone_pos[UA_R] = Vector3(SH_X, SH_Y, 0)
	bone_pos[FA_R] = Vector3(0, -UPPER, 0)
	bone_pos[HAND_R] = Vector3(0, -FORE, 0)
	bone_pos[TH_L] = Vector3(-HIP_X, HIP_DY, 0)
	bone_pos[SH_L] = Vector3(0, -THIGH, 0)
	bone_pos[FOOT_L] = Vector3(0, -SHIN, 0)
	bone_pos[TH_R] = Vector3(HIP_X, HIP_DY, 0)
	bone_pos[SH_R] = Vector3(0, -THIGH, 0)
	bone_pos[FOOT_R] = Vector3(0, -SHIN, 0)
	skel = Skeleton3D.new()
	skel.name = "Skeleton"
	add_child(skel)
	for i in BONE_NAMES.size():
		skel.add_bone(BONE_NAMES[i])
	for i in BONE_NAMES.size():
		if BONE_PARENT[i] >= 0:
			skel.set_bone_parent(i, BONE_PARENT[i])
		skel.set_bone_rest(i, Transform3D(Basis(), bone_pos[i]))
	skel.reset_bone_poses()
	body_mi = MeshInstance3D.new()
	body_mi.name = "Body"
	body_mi.mesh = get_body_mesh(app)
	body_mi.custom_aabb = AABB(Vector3(-1.4, -0.2, -1.4), Vector3(2.8, 2.4, 2.8))
	skel.add_child(body_mi)
	body_mi.skeleton = NodePath("..")
	weapon = WeaponView.new()
	weapon.name = "Weapon"
	weapon.visible = false
	skel.add_child(weapon)
	for s in [-1.0, 1.0]:
		var f := Foot.new()
		f.side = s
		_feet.append(f)
	for i in BONE_NAMES.size():
		_cur_rot.append(Quaternion.IDENTITY)

func set_weapon(id: String) -> void:
	weapon_id = id
	_w_init = false
	if id == "":
		weapon.visible = false
		hold_class = "none"
		return
	weapon.setup(id)
	weapon.visible = true
	hold_class = weapon.hold

func play(act: String, dur: float) -> void:
	if dead:
		return
	action = act
	action_t = 0.0
	action_dur = maxf(dur, 0.05)

func stop_action() -> void:
	action = ""
	if weapon:
		weapon.mag_state = 0
		weapon.bolt_t = 0.0
		weapon.open_t = 0.0

func hit_react() -> void:
	_hit_k = 1.0

func on_fire() -> void:
	fire_kick = 1.0
	if weapon:
		weapon.on_fire()

func set_shadow(on: bool) -> void:
	body_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	weapon.set_shadow(on)

func reset_feet() -> void:
	_first = true

func muzzle_world() -> Vector3:
	if weapon_id == "" or not weapon.visible:
		return global_position + Vector3(0, 1.3, 0)
	return weapon.muzzle_global()

# =====================================================================
#   ГЕНЕРАЦИЯ МЕША ТЕЛА
# =====================================================================

static func _bw(b: int) -> Array:
	return [PackedInt32Array([b, 0, 0, 0]), PackedFloat32Array([1, 0, 0, 0])]

static func _bw2(b0: int, b1: int, w1: float) -> Array:
	return [PackedInt32Array([b0, b1, 0, 0]), PackedFloat32Array([1.0 - w1, w1, 0, 0])]

static func _limb(mb: MeshBuilder, p0: Vector3, p1: Vector3, r0: Vector2, r1: Vector2, col: Color, fwd: Vector3, w0: Array, w1: Array, sides: int = 8, cap0: bool = false, cap1: bool = false) -> void:
	mb.add_limb(p0, p1, r0.x, r0.y, r1.x, r1.y, sides, col, fwd, w0[0], w0[1], w1[0], w1[1], cap0, cap1)

static func get_body_mesh(app: Dictionary) -> ArrayMesh:
	var key := str(app.hash())
	if _mesh_cache.has(key):
		return _mesh_cache[key]
	var mb := MeshBuilder.new()
	mb.skinned = true
	var suit: Color = app.get("suit", Color(0.2, 0.2, 0.21))
	var armor: Color = app.get("armor", Color(0.55, 0.1, 0.08))
	var pants: Color = app.get("pants", suit)
	var skin: Color = app.get("skin", Color(0.66, 0.53, 0.46))
	var boots: Color = app.get("boots", Color(0.12, 0.11, 0.1))
	var gloves: Color = app.get("gloves", Color(0.13, 0.13, 0.13))
	var vest: Color = app.get("vest", Color(0.25, 0.25, 0.22))
	var w: float = app.get("build", 1.0)
	var head_kind: String = app.get("head", "helmet")
	var c_suit := MeshBuilder.mat(suit, MeshBuilder.MAT_CLOTH)
	var c_pants := MeshBuilder.mat(pants, MeshBuilder.MAT_CLOTH)
	var c_armor := MeshBuilder.mat(armor, MeshBuilder.MAT_PAINT)
	var c_skin := MeshBuilder.mat(skin, MeshBuilder.MAT_SKIN)
	var c_boot := MeshBuilder.mat(boots, MeshBuilder.MAT_RUBBER)
	var c_glove := MeshBuilder.mat(gloves, MeshBuilder.MAT_RUBBER)
	var c_vest := MeshBuilder.mat(vest, MeshBuilder.MAT_CLOTH)
	var fwd := Vector3(0, 0, -1)
	var hip := HIP_Y
	var spine_y := hip + SPINE_L
	var chest_y := spine_y + CHEST_L
	var neck_y := chest_y + NECK_L
	var head_y := neck_y + HEAD_L
	var sh_y := chest_y + SH_Y
	# --- ноги ---
	for s in [-1.0, 1.0]:
		var th: int = TH_L if s < 0 else TH_R
		var sh: int = SH_L if s < 0 else SH_R
		var ft: int = FOOT_L if s < 0 else FOOT_R
		var hx: float = s * HIP_X
		var hy := hip + HIP_DY
		var ky := hy - THIGH
		var ay := ky - SHIN
		_limb(mb, Vector3(hx * 1.05, hy + 0.06, 0), Vector3(hx, ky, 0), Vector2(0.092, 0.1) * w, Vector2(0.064, 0.068) * w, c_pants, fwd, _bw2(HIPS, th, 0.6), _bw2(th, sh, 0.5))
		# наколенник
		mb.set_bone(sh)
		mb.add_box(Transform3D(Basis(), Vector3(hx, ky - 0.02, -0.065)), Vector3(0.085, 0.1, 0.03), c_armor)
		_limb(mb, Vector3(hx, ky, 0), Vector3(hx, ay + 0.2, 0), Vector2(0.064, 0.068) * w, Vector2(0.05, 0.055) * w, c_pants, fwd, _bw2(th, sh, 0.5), _bw(sh))
		_limb(mb, Vector3(hx, ay + 0.21, 0), Vector3(hx, ay - 0.01, 0), Vector2(0.06, 0.064) * w, Vector2(0.056, 0.06) * w, c_boot, fwd, _bw(sh), _bw2(sh, ft, 0.5), 8, true, false)
		mb.set_bone(ft)
		mb.add_box(Transform3D(Basis(), Vector3(hx, ay - 0.035, -0.055)), Vector3(0.11, 0.08, 0.27), c_boot)
		mb.add_box(Transform3D(Basis(), Vector3(hx, ay - 0.07, -0.055)), Vector3(0.115, 0.02, 0.28), MeshBuilder.mat(Color(0.04, 0.04, 0.04), MeshBuilder.MAT_RUBBER))
	# --- таз и корпус ---
	_limb(mb, Vector3(0, hip - 0.13, 0), Vector3(0, hip + 0.05, 0), Vector2(0.165, 0.11) * w, Vector2(0.16, 0.105) * w, c_pants, fwd, _bw(HIPS), _bw(HIPS), 8, true, false)
	_limb(mb, Vector3(0, hip + 0.05, 0), Vector3(0, spine_y + 0.1, 0), Vector2(0.16, 0.105) * w, Vector2(0.158, 0.105) * w, c_suit, fwd, _bw2(HIPS, SPINE, 0.5), _bw2(SPINE, CHEST, 0.4))
	_limb(mb, Vector3(0, spine_y + 0.1, 0), Vector3(0, sh_y + 0.02, 0), Vector2(0.158, 0.105) * w, Vector2(0.2, 0.115) * w, c_suit, fwd, _bw2(SPINE, CHEST, 0.4), _bw(CHEST), 8, false, true)
	# ремень
	mb.set_bone(HIPS)
	mb.add_box(Transform3D(Basis(), Vector3(0, hip + 0.03, 0)), Vector3(0.34 * w, 0.05, 0.23 * w), MeshBuilder.mat(Color(0.1, 0.09, 0.07), MeshBuilder.MAT_RUBBER))
	# бронеплиты / разгрузка
	mb.set_bone(CHEST)
	mb.add_box(Transform3D(Basis(Vector3.RIGHT, 0.05), Vector3(0, chest_y + 0.08, -0.105 * w)), Vector3(0.3 * w, 0.3, 0.05), c_armor)
	mb.add_box(Transform3D(Basis(), Vector3(0, chest_y + 0.09, 0.11 * w)), Vector3(0.32 * w, 0.32, 0.05), c_armor.darkened(0.15))
	if app.get("vest_on", true):
		mb.set_bone(SPINE)
		for px in [-0.09, 0.0, 0.09]:
			mb.add_box(Transform3D(Basis(), Vector3(px * w, spine_y + 0.06, -0.125 * w)), Vector3(0.075, 0.1, 0.05), c_vest)
		mb.set_bone(CHEST)
		mb.add_box(Transform3D(Basis(), Vector3(0.0, chest_y + 0.25, -0.02)), Vector3(0.36 * w, 0.05, 0.22 * w), c_vest)
	# наплечники
	for s in [-1.0, 1.0]:
		var ua: int = UA_L if s < 0 else UA_R
		mb.set_bone(ua)
		mb.add_box(Transform3D(Basis(Vector3.FORWARD, -s * 0.25), Vector3(s * (SH_X + 0.02), sh_y + 0.0, 0)), Vector3(0.12, 0.1, 0.14), c_armor)
	# рюкзак
	if app.get("backpack", false):
		mb.set_bone(CHEST)
		var bc: Color = app.get("pack_color", Color(0.18, 0.17, 0.13))
		mb.add_box(Transform3D(Basis(), Vector3(0, chest_y + 0.06, 0.2 * w)), Vector3(0.28, 0.36, 0.16), MeshBuilder.mat(bc, MeshBuilder.MAT_CLOTH))
		mb.add_box(Transform3D(Basis(), Vector3(0, chest_y + 0.27, 0.19 * w)), Vector3(0.24, 0.08, 0.13), MeshBuilder.mat(bc.darkened(0.2), MeshBuilder.MAT_CLOTH))
	if app.get("medbag", false):
		mb.set_bone(HIPS)
		mb.add_box(Transform3D(Basis(), Vector3(-0.19 * w, hip - 0.02, 0.04)), Vector3(0.08, 0.16, 0.2), MeshBuilder.mat(Color(0.75, 0.75, 0.7), MeshBuilder.MAT_CLOTH))
		mb.add_box(Transform3D(Basis(), Vector3(-0.235 * w, hip - 0.0, 0.04)), Vector3(0.005, 0.06, 0.06), MeshBuilder.mat(Color(0.8, 0.1, 0.1), MeshBuilder.MAT_PAINT))
	if app.get("toolbag", false):
		mb.set_bone(HIPS)
		mb.add_box(Transform3D(Basis(), Vector3(0.19 * w, hip - 0.03, 0.03)), Vector3(0.08, 0.14, 0.18), MeshBuilder.mat(Color(0.35, 0.25, 0.12), MeshBuilder.MAT_CLOTH))
	# кобура
	mb.set_bone(HIPS)
	mb.add_box(Transform3D(Basis(), Vector3(0.18 * w, hip - 0.06, -0.02)), Vector3(0.05, 0.13, 0.09), MeshBuilder.mat(Color(0.12, 0.1, 0.08), MeshBuilder.MAT_RUBBER))
	# --- руки ---
	for s in [-1.0, 1.0]:
		var ua: int = UA_L if s < 0 else UA_R
		var fa: int = FA_L if s < 0 else FA_R
		var hd: int = HAND_L if s < 0 else HAND_R
		var x: float = s * SH_X
		var ey := sh_y - UPPER
		var wy := ey - FORE
		_limb(mb, Vector3(x, sh_y + 0.04, 0), Vector3(x, ey, 0), Vector2(0.062, 0.066) * w, Vector2(0.05, 0.052) * w, c_suit, fwd, _bw2(CHEST, ua, 0.75), _bw2(ua, fa, 0.5))
		_limb(mb, Vector3(x, ey, 0), Vector3(x, wy + 0.02, 0), Vector2(0.05, 0.052) * w, Vector2(0.038, 0.042) * w, c_suit, fwd, _bw2(ua, fa, 0.5), _bw(fa))
		if app.get("armband", false) and s < 0:
			mb.set_bone(ua)
			mb.add_box(Transform3D(Basis(), Vector3(x, sh_y - 0.12, 0)), Vector3(0.115, 0.05, 0.12), MeshBuilder.mat(app.get("armband_color", Color(0.8, 0.1, 0.08)), MeshBuilder.MAT_CLOTH))
		_limb(mb, Vector3(x, wy + 0.03, 0), Vector3(x, wy - 0.015, 0), Vector2(0.042, 0.045), Vector2(0.04, 0.045), c_glove, fwd, _bw(fa), _bw(hd))
		mb.set_bone(hd)
		mb.add_box(Transform3D(Basis(), Vector3(x, wy - 0.065, -0.005)), Vector3(0.04, 0.1, 0.085), c_glove)
		mb.add_box(Transform3D(Basis(Vector3.RIGHT, 0.4), Vector3(x - s * 0.01, wy - 0.05, -0.055)), Vector3(0.025, 0.06, 0.025), c_glove)
	# --- шея и голова ---
	_limb(mb, Vector3(0, chest_y + 0.2, 0), Vector3(0, head_y + 0.02, 0.0), Vector2(0.06, 0.06), Vector2(0.055, 0.058), c_skin if head_kind != "gasmask" else c_suit, fwd, _bw2(CHEST, NECK, 0.5), _bw2(NECK, HEAD, 0.5))
	if app.get("collar", true):
		mb.set_bone(CHEST)
		_limb(mb, Vector3(0, sh_y - 0.01, 0.0), Vector3(0, sh_y + 0.06, 0.0), Vector2(0.09, 0.085), Vector2(0.075, 0.075), c_suit, fwd, _bw(CHEST), _bw2(CHEST, NECK, 0.5))
	var hy := head_y
	_limb(mb, Vector3(0, hy - 0.02, -0.01), Vector3(0, hy + 0.08, -0.005), Vector2(0.07, 0.08), Vector2(0.088, 0.1), c_skin, fwd, _bw(HEAD), _bw(HEAD), 8, true, false)
	_limb(mb, Vector3(0, hy + 0.08, -0.005), Vector3(0, hy + 0.2, 0.0), Vector2(0.088, 0.1), Vector2(0.06, 0.07), c_skin, fwd, _bw(HEAD), _bw(HEAD), 8, false, true)
	mb.set_bone(HEAD)
	mb.add_box(Transform3D(Basis(), Vector3(0, hy + 0.07, -0.1)), Vector3(0.025, 0.04, 0.03), c_skin.darkened(0.08))
	var eye := MeshBuilder.mat(Color(0.05, 0.05, 0.05), MeshBuilder.MAT_SKIN)
	if head_kind != "gasmask":
		for s in [-1.0, 1.0]:
			mb.add_box(Transform3D(Basis(), Vector3(s * 0.035, hy + 0.105, -0.088)), Vector3(0.025, 0.012, 0.01), eye)
	var hair := MeshBuilder.mat(app.get("hair", Color(0.15, 0.12, 0.1)), MeshBuilder.MAT_CLOTH)
	match head_kind:
		"helmet":
			var hc := MeshBuilder.mat(app.get("helmet_color", Color(0.14, 0.15, 0.13)), MeshBuilder.MAT_PAINT)
			_limb(mb, Vector3(0, hy + 0.09, 0.005), Vector3(0, hy + 0.19, 0.008), Vector2(0.122, 0.135), Vector2(0.115, 0.125), hc, fwd, _bw(HEAD), _bw(HEAD), 10, true, false)
			_limb(mb, Vector3(0, hy + 0.19, 0.008), Vector3(0, hy + 0.25, 0.01), Vector2(0.115, 0.125), Vector2(0.05, 0.055), hc, fwd, _bw(HEAD), _bw(HEAD), 10, false, true)
			if app.get("goggles", false):
				mb.add_box(Transform3D(Basis(), Vector3(0, hy + 0.2, -0.1)), Vector3(0.14, 0.035, 0.04), MeshBuilder.mat(Color(0.2, 0.25, 0.25), MeshBuilder.MAT_GLASS))
		"gasmask":
			var gm := MeshBuilder.mat(Color(0.12, 0.13, 0.12), MeshBuilder.MAT_RUBBER)
			_limb(mb, Vector3(0, hy - 0.03, 0.0), Vector3(0, hy + 0.22, 0.0), Vector2(0.095, 0.105), Vector2(0.075, 0.085), gm, fwd, _bw(HEAD), _bw(HEAD), 8, true, true)
			mb.add_cyl(Transform3D(Basis(Vector3.RIGHT, -PI / 2 - 0.3), Vector3(0, hy + 0.03, -0.09)), 0.035, 0.03, 0.08, 8, MeshBuilder.mat(Color(0.2, 0.2, 0.18), MeshBuilder.MAT_PAINT))
			for s in [-1.0, 1.0]:
				mb.add_cyl(Transform3D(Basis(Vector3.RIGHT, -PI / 2), Vector3(s * 0.04, hy + 0.11, -0.085)), 0.025, 0.025, 0.02, 8, MeshBuilder.mat(Color(0.3, 0.35, 0.3), MeshBuilder.MAT_GLASS))
			var hc2 := MeshBuilder.mat(app.get("helmet_color", Color(0.14, 0.15, 0.13)), MeshBuilder.MAT_PAINT)
			_limb(mb, Vector3(0, hy + 0.12, 0.01), Vector3(0, hy + 0.2, 0.012), Vector2(0.12, 0.13), Vector2(0.112, 0.122), hc2, fwd, _bw(HEAD), _bw(HEAD), 10, true, false)
			_limb(mb, Vector3(0, hy + 0.2, 0.012), Vector3(0, hy + 0.26, 0.015), Vector2(0.112, 0.122), Vector2(0.05, 0.055), hc2, fwd, _bw(HEAD), _bw(HEAD), 10, false, true)
		"beret":
			_limb(mb, Vector3(0, hy + 0.12, 0.0), Vector3(0, hy + 0.2, 0.0), Vector2(0.092, 0.104), Vector2(0.075, 0.085), hair, fwd, _bw(HEAD), _bw(HEAD), 8, false, true)
			var bc := MeshBuilder.mat(app.get("beret_color", Color(0.45, 0.06, 0.06)), MeshBuilder.MAT_CLOTH)
			mb.add_box(Transform3D(Basis(Vector3.FORWARD, 0.25), Vector3(0.02, hy + 0.205, 0.0)), Vector3(0.21, 0.05, 0.22), bc)
			mb.add_box(Transform3D(Basis(), Vector3(-0.05, hy + 0.2, -0.105)), Vector3(0.025, 0.03, 0.01), MeshBuilder.mat(Color(0.9, 0.75, 0.2), MeshBuilder.MAT_PAINT))
		"cap":
			var cc := MeshBuilder.mat(app.get("cap_color", Color(0.14, 0.14, 0.13)), MeshBuilder.MAT_CLOTH)
			_limb(mb, Vector3(0, hy + 0.12, 0.0), Vector3(0, hy + 0.23, 0.0), Vector2(0.098, 0.11), Vector2(0.085, 0.095), cc, fwd, _bw(HEAD), _bw(HEAD), 8, false, true)
			mb.add_box(Transform3D(Basis(Vector3.RIGHT, -0.15), Vector3(0, hy + 0.14, -0.13)), Vector3(0.15, 0.015, 0.08), cc)
		"hood":
			var hc3 := MeshBuilder.mat(app.get("hood_color", suit), MeshBuilder.MAT_CLOTH)
			_limb(mb, Vector3(0, hy - 0.02, 0.03), Vector3(0, hy + 0.24, 0.02), Vector2(0.12, 0.13), Vector2(0.07, 0.08), hc3, fwd, _bw(HEAD), _bw(HEAD), 8, false, true)
			mb.add_box(Transform3D(Basis(), Vector3(0, hy + 0.04, -0.09)), Vector3(0.12, 0.08, 0.02), MeshBuilder.mat(Color(0.08, 0.08, 0.08), MeshBuilder.MAT_CLOTH))
		"bald":
			pass
		_:
			_limb(mb, Vector3(0, hy + 0.12, 0.0), Vector3(0, hy + 0.215, 0.01), Vector2(0.094, 0.106), Vector2(0.07, 0.08), hair, fwd, _bw(HEAD), _bw(HEAD), 8, false, true)
	if app.get("headset", false):
		mb.set_bone(HEAD)
		for s in [-1.0, 1.0]:
			mb.add_box(Transform3D(Basis(), Vector3(s * 0.098, hy + 0.1, 0.0)), Vector3(0.025, 0.06, 0.05), MeshBuilder.mat(Color(0.1, 0.1, 0.1), MeshBuilder.MAT_RUBBER))
		mb.add_box(Transform3D(Basis(), Vector3(-0.07, hy + 0.04, -0.07)), Vector3(0.01, 0.01, 0.07), MeshBuilder.mat(Color(0.1, 0.1, 0.1), MeshBuilder.MAT_RUBBER))
	var mesh := mb.build(Mats.character())
	_mesh_cache[key] = mesh
	return mesh

# =====================================================================
#   АНИМАЦИЯ
# =====================================================================

static func _basis_y_fwd(y: Vector3, fwd: Vector3) -> Basis:
	## Базис кости: +Y кости = y, -Z кости ≈ fwd.
	var f := fwd - y * fwd.dot(y)
	if f.length_squared() < 1e-6:
		f = Vector3.FORWARD - y * Vector3.FORWARD.dot(y)
		if f.length_squared() < 1e-6:
			f = Vector3.UP - y * Vector3.UP.dot(y)
	var z := -f.normalized()
	var x := y.cross(z).normalized()
	return Basis(x, y, z.normalized())

static func _weapon_basis(fwd: Vector3, up_hint: Vector3, roll: float) -> Basis:
	## Базис оружия: -Z = fwd, +Y ≈ up_hint, затем крен вокруг ствола.
	var z := -fwd.normalized()
	var x := up_hint.cross(z)
	if x.length_squared() < 1e-6:
		x = Vector3.RIGHT
	x = x.normalized()
	var y := z.cross(x).normalized()
	var b := Basis(x, y, z)
	if roll != 0.0:
		b = b * Basis(Vector3.FORWARD, roll)
	return b

static func _ik(root: Vector3, target: Vector3, a: float, b: float, pole: Vector3) -> Vector3:
	## Двухзвенная IK: возвращает позицию среднего сустава.
	var d := target - root
	var dist := clampf(d.length(), 0.01, (a + b) * 0.999)
	var dir := d.normalized() if d.length_squared() > 1e-8 else Vector3.DOWN
	var ca := clampf((a * a + dist * dist - b * b) / (2.0 * a * dist), -1.0, 1.0)
	var ang := acos(ca)
	var p := pole - dir * pole.dot(dir)
	if p.length_squared() < 1e-8:
		p = Vector3.FORWARD - dir * Vector3.FORWARD.dot(dir)
	p = p.normalized()
	return root + dir * (cos(ang) * a) + p * (sin(ang) * a)

static func _seg(k: float, a: float, b: float) -> float:
	return smoothstep(a, b, k)

func _neutral(f: Foot) -> Vector3:
	return Vector3(f.side * 0.11, ANKLE_H, 0.0)

func update_pose(delta: float) -> void:
	if skel == null:
		return
	if lod_skip > 0:
		_lod_counter += 1
		_acc_dt += delta
		if _lod_counter <= lod_skip:
			return
		_lod_counter = 0
		delta = _acc_dt
		_acc_dt = 0.0
	else:
		_acc_dt = 0.0
	delta = minf(delta, 0.1)
	if dead:
		_update_death(delta)
		return
	var xf := get_global_transform_interpolated() if (use_interp and is_inside_tree()) else global_transform
	if action != "":
		action_t += delta
		if action_t >= action_dur:
			_end_action()
	_hit_k = maxf(0.0, _hit_k - delta * 4.0)
	fire_kick = maxf(0.0, fire_kick - delta * 9.0)
	_idle_t += delta
	var inv := xf.affine_inverse()
	var basis_inv := xf.basis.inverse()
	var lv := basis_inv * velocity
	lv.y = 0.0
	var speed := lv.length()
	var run_k := smoothstep(2.1, 3.8, speed)
	var act := action
	var ap := clampf(action_t / action_dur, 0.0, 1.0) if act != "" else 0.0
	var prof := HoldProfiles.get_profile(hold_class)
	# наклон корпуса (только стоя): подбор, ремонт, помощь раненому
	var bend := 0.0
	if act == "pickup":
		bend = sin(ap * PI)
	elif act == "repair" or act == "heal_other":
		bend = 0.35 * _seg(action_t, 0.0, 0.3) * (1.0 - _seg(action_t, action_dur - 0.3, action_dur))
	# ---------------- шаги ----------------
	var accel := (velocity - _prev_vel) / maxf(delta, 0.001)
	_prev_vel = velocity
	var duty := lerpf(0.6, 0.36, run_k)
	var stance_half := lerpf(0.33, 0.42, run_k) * clampf(speed / 1.5, 0.4, 1.0) * lerpf(1.0, 0.55, shamble)
	# при движении вбок шаг короче, чтобы ноги не перекрещивались
	var lateral := absf(lv.x) / maxf(speed, 0.01)
	stance_half *= lerpf(1.0, 0.4, smoothstep(0.3, 0.9, lateral))
	var cycle_len := 2.0 * stance_half / duty
	var moving := speed > 0.12
	gait_w = move_toward(gait_w, 1.0 if moving else 0.0, delta * 4.0)
	var fwd_w := xf.basis * Vector3.FORWARD
	var body_yaw := atan2(-fwd_w.x, -fwd_w.z)
	var floor_y := xf.origin.y
	if _first:
		_first = false
		for f: Foot in _feet:
			var p := xf * _neutral(f)
			p.y = floor_y + ANKLE_H
			f.pos = p
			f.cur = p
			f.yaw = body_yaw
			f.cur_yaw = body_yaw
			f.swing = false
		phase = 0.0
	if moving:
		phase = fmod(phase + speed * delta / cycle_len, 1.0)
	var vel_dir_l := lv.normalized() if speed > 0.01 else Vector3.ZERO
	var swing_time := (1.0 - duty) * cycle_len / maxf(speed, 0.5)
	for i in 2:
		var f: Foot = _feet[i]
		var other: Foot = _feet[1 - i]
		var fp := fmod(phase + (0.0 if i == 0 else 0.5), 1.0)
		var neutral_l := _neutral(f)
		if f.swing:
			f.t += delta / f.dur
			var remaining := (1.0 - f.t) * f.dur
			var land_l := neutral_l + vel_dir_l * stance_half * (1.0 if moving else 0.0)
			# при шаге вбок ноги не перекрещиваются
			if f.side * land_l.x < 0.05:
				land_l.x = f.side * 0.05
			var tgt := xf * land_l + velocity * remaining
			tgt.y = floor_y + neutral_l.y
			f.to = tgt
			f.to_yaw = body_yaw
			if f.t >= 1.0:
				f.swing = false
				f.pos = f.to
				f.yaw = f.to_yaw
				f.cur = f.pos
				f.cur_yaw = f.yaw
				f.pitch = 0.0
				footstep.emit(f.pos, speed)
			else:
				var k := f.t
				var e := k * k * (3.0 - 2.0 * k)
				f.cur = f.from.lerp(f.to, e)
				f.cur.y = lerpf(f.from.y, f.to.y, e) + sin(k * PI) * f.lift
				f.cur_yaw = lerp_angle(f.from_yaw, f.to_yaw, e)
				f.pitch = sin(k * PI) * 0.25 - (1.0 - k) * 0.35 * run_k
		else:
			f.cur = f.pos
			f.cur_yaw = f.yaw
			f.pitch = 0.0
			var want_swing := false
			if moving and fp >= duty and not other.swing:
				want_swing = true
			var rel := inv * f.pos
			var hip_l := Vector3(f.side * HIP_X, (_hips_pos.y if _hips_pos.y > 0.1 else 0.9) + HIP_DY, 0)
			if (rel - hip_l).length() > LEG * 1.02:
				want_swing = true
			if not moving and not other.swing:
				var dev := Vector2(rel.x - neutral_l.x, rel.z - neutral_l.z).length()
				var ydev := absf(angle_difference(f.yaw, body_yaw))
				if dev > 0.16 or ydev > 0.6:
					if i == 0 or not _foot_off(_feet[0], inv, body_yaw):
						want_swing = true
			if want_swing:
				f.swing = true
				f.t = 0.0
				f.dur = clampf(swing_time, 0.16, 0.42) if moving else 0.3
				f.from = f.pos
				f.from_yaw = f.yaw
				f.lift = lerpf(0.09, 0.2, run_k) * (1.0 - shamble * 0.6) if moving else 0.07
	# ---------------- таз ----------------
	var bob_run := -cos((phase - duty * 0.5) * TAU * 2.0)
	var bob := bob_run * 0.035 * run_k * gait_w
	var heavy: float = prof.get("heavy", 0.0) if hold_class != "none" and not holster else 0.0
	var hip_h := lerpf(0.945, 0.925, gait_w) - run_k * 0.03 - shamble * 0.05 - bend * 0.06 + bob
	for f: Foot in _feet:
		if not f.swing or f.t > 0.85:
			var rel := inv * f.cur
			var hx := f.side * HIP_X + _hips_pos.x
			var dxz := Vector2(rel.x - hx, rel.z - _hips_pos.z).length()
			var reach := LEG * 0.985
			if dxz < reach:
				var lim := rel.y + sqrt(reach * reach - dxz * dxz) - HIP_DY
				hip_h = minf(hip_h, lim)
	_hip_smooth = hip_h if _hip_smooth < 0.0 else lerpf(_hip_smooth, hip_h, clampf(delta * 18.0, 0, 1))
	hip_h = minf(_hip_smooth, hip_h + 0.01)
	var sway := -sin((phase - 0.05) * TAU) * lerpf(0.022, 0.01, run_k) * gait_w
	var idle_shift := sin(_idle_t * 0.4 + _seed) * 0.015 * (1.0 - gait_w)
	var la := basis_inv * accel
	var lean_target := Vector2(clampf(la.z * -0.012, -0.12, 0.12), clampf(la.x * 0.01, -0.1, 0.1))
	_smooth_lean = _smooth_lean.lerp(lean_target, clampf(delta * 5.0, 0, 1))
	var lean := 0.03 * speed + run_k * 0.04 + _smooth_lean.x + shamble * 0.25 + bend * 0.75 - heavy * (1.0 - run_k)
	var pelvis_yaw := sin(phase * TAU) * 0.09 * gait_w * (1.0 - run_k * 0.3)
	_hips_pos = Vector3(sway + idle_shift, hip_h, bend * 0.05)
	var hips_b := Basis(Vector3.UP, pelvis_yaw) * Basis(Vector3.RIGHT, -lean * 0.4) * Basis(Vector3.FORWARD, _smooth_lean.y * 0.5 + (sway + idle_shift) * 1.5)
	# ---------------- прицеливание и корпус ----------------
	var armed := hold_class != "none" and not holster
	var state := hold_state
	if aiming:
		state = "aim"
	if act == "reload" or act == "cycle":
		state = "low" if state != "aim" or hold_class == "pistol" else "aim"
		if act == "reload":
			state = "low"
	if act == "inspect":
		state = "inspect"
	var aim_l := basis_inv * aim_dir
	var aim_yaw := atan2(-aim_l.x, -aim_l.z)
	var aim_pitch := asin(clampf(aim_l.normalized().y, -0.8, 0.8)) if aim_l.length_squared() > 0.001 else 0.0
	var is_aim := state == "aim" and armed
	var twist_target := 0.0
	if is_aim:
		twist_target = prof.get("twist", -0.5) + clampf(aim_yaw, -0.9, 0.9)
	elif armed and state == "inspect":
		twist_target = -0.2
	_smooth_twist = lerpf(_smooth_twist, twist_target, clampf(delta * 10.0, 0, 1))
	_smooth_pitch = lerpf(_smooth_pitch, aim_pitch if is_aim else 0.0, clampf(delta * 10.0, 0, 1))
	var counter := -pelvis_yaw * 1.4
	var breathe := sin(_idle_t * 1.7 + _seed) * 0.012
	var spine_b := hips_b * Basis(Vector3.UP, _smooth_twist * 0.45 + counter * 0.5) * Basis(Vector3.RIGHT, -lean * 0.45 + _hit_k * 0.2)
	var chest_b := spine_b * Basis(Vector3.UP, _smooth_twist * 0.55 + counter * 0.5) * Basis(Vector3.RIGHT, -lean * 0.2 + breathe + _hit_k * 0.25 + _smooth_pitch * 0.35 + shamble * 0.15)
	var hips_t := Transform3D(hips_b, _hips_pos)
	var spine_t := Transform3D(spine_b, hips_t * bone_pos[SPINE])
	var chest_t := Transform3D(chest_b, spine_t * bone_pos[CHEST])
	# ---------------- голова ----------------
	var look_yaw := 0.0
	var look_pitch := -0.05 + shamble * 0.35
	if look_at_pos != null:
		var lp: Vector3 = inv * (look_at_pos as Vector3)
		var dh := lp - (chest_t * Vector3(0, 0.4, 0))
		look_yaw = clampf(atan2(-dh.x, -dh.z) - _smooth_twist, -1.1, 1.1)
		look_pitch = clampf(asin(clampf(dh.normalized().y, -1, 1)), -0.5, 0.4)
	elif is_aim:
		look_yaw = clampf(aim_yaw - _smooth_twist, -1.0, 1.0)
		look_pitch = _smooth_pitch * 0.5
	elif state == "inspect":
		look_yaw = 0.25
		look_pitch = -0.45
	else:
		look_yaw = sin(_idle_t * 0.35 + _seed) * 0.35 * (1.0 - gait_w)
	look_yaw += look_bias
	if act == "reload":
		look_pitch = -0.4
		look_yaw += 0.15
	_head_yaw = lerpf(_head_yaw, clampf(look_yaw, -1.2, 1.2), clampf(delta * 6.0, 0, 1))
	var neck_b := chest_b * Basis(Vector3.UP, _head_yaw * 0.4) * Basis(Vector3.RIGHT, look_pitch * 0.3 - lean * 0.2)
	var head_b := neck_b * Basis(Vector3.UP, _head_yaw * 0.6) * Basis(Vector3.RIGHT, look_pitch * 0.7 + bob * 1.5 + shamble * 0.2) * Basis(Vector3.FORWARD, shamble * 0.35)
	var neck_t := Transform3D(neck_b, chest_t * bone_pos[NECK])
	var head_t := Transform3D(head_b, neck_t * bone_pos[HEAD])
	# ---------------- ноги (IK) ----------------
	var leg_glob := []
	for i in 2:
		var f: Foot = _feet[i]
		var th_i := TH_L if i == 0 else TH_R
		var hip_j := hips_t * bone_pos[th_i]
		var ank := inv * f.cur
		var fyaw := angle_difference(body_yaw, f.cur_yaw)
		var foot_dir := Vector3(-sin(fyaw), 0, -cos(fyaw))
		var pole := (foot_dir + Vector3(f.side * 0.15, 0, 0)).normalized()
		var fpitch := f.pitch
		var knee := _ik(hip_j, ank, THIGH, SHIN, pole)
		var th_b := _basis_y_fwd((hip_j - knee).normalized(), pole)
		var ank_real := knee + (ank - knee).normalized() * SHIN
		var sh_b := _basis_y_fwd((knee - ank_real).normalized(), foot_dir)
		var ft_b := Basis(Vector3.UP, fyaw) * Basis(Vector3.RIGHT, fpitch)
		leg_glob.append([th_b, sh_b, ft_b])
	# ---------------- оружие ----------------
	var sh_l := chest_t * bone_pos[UA_L]
	var sh_r := chest_t * bone_pos[UA_R]
	var hand_l_tgt: Variant = null
	var hand_r_tgt: Variant = null
	var hand_r_basis: Variant = null
	var pole_l := Vector3(-0.3, -1.0, 0.2)
	var pole_r := Vector3(0.9, -0.5, 0.4)
	var weapon_xf: Variant = null
	var one_hand := false
	var stowed := act in ["bandage", "heal_other", "repair", "salute"]
	if armed and not stowed:
		var target_xf := _weapon_target(state, prof, chest_t, chest_b, aim_yaw)
		one_hand = state == "carry" and prof.get("carry", {}).get("one_hand", false)
		if act == "reload":
			target_xf = target_xf * _reload_tilt(ap)
		var rel_t := chest_t.affine_inverse() * target_xf
		if not _w_init:
			_w_rel = rel_t
			_w_init = true
		else:
			var k := clampf(delta * (16.0 if is_aim else 9.0), 0, 1)
			_w_rel = Transform3D(_w_rel.basis.orthonormalized().slerp(rel_t.basis.orthonormalized(), k), _w_rel.origin.lerp(rel_t.origin, k))
		weapon_xf = chest_t * _w_rel
		var wx: Transform3D = weapon_xf
		if fire_kick > 0.0:
			var kick_dir := wx.basis.z * 0.05 * fire_kick * (0.4 if hold_class == "pistol" else 1.0)
			wx = Transform3D(wx.basis * Basis(Vector3.RIGHT, fire_kick * (0.12 if hold_class != "pistol" else 0.3)), wx.origin + kick_dir)
			weapon_xf = wx
		hand_r_tgt = wx.origin
		hand_r_basis = wx.basis
		hand_l_tgt = wx * weapon.point("fore")
		if hold_class == "pistol":
			pole_l = Vector3(-0.5, -1.0, 0.1)
			pole_r = Vector3(0.6, -1.0, 0.1)
		elif hold_class == "mg" and is_aim:
			pole_l = Vector3(-0.6, -1.0, 0.0)
		# анимации оружия и рук
		weapon.mag_state = 0
		weapon.bolt_t = 0.0
		weapon.open_t = 0.0
		if act == "reload":
			hand_l_tgt = _reload_hand(ap, wx, chest_t)
		elif act == "cycle":
			hand_l_tgt = _cycle_hand(ap, wx)
		elif act == "inspect":
			var bp := wx * weapon.point("bolt_pt")
			hand_l_tgt = (wx * weapon.point("fore")).lerp(bp, _seg(ap, 0.15, 0.35) * (1.0 - _seg(ap, 0.75, 0.95)))
			weapon.bolt_t = _seg(ap, 0.4, 0.5) * (1.0 - _seg(ap, 0.6, 0.7)) * 0.5
		if one_hand:
			hand_l_tgt = null
			hand_r_tgt = null
			weapon_xf = null
	# ---------------- действия без оружия в руках ----------------
	if act == "bandage" or act == "heal_other":
		var k := action_t
		var base := chest_t * Vector3(-0.02, -0.12, -0.34)
		if act == "heal_other":
			base = chest_t * Vector3(0.0, -0.3, -0.45)
		hand_l_tgt = base + Vector3(-0.05, 0, 0)
		hand_r_tgt = base + Vector3(cos(k * 9.0) * 0.07 + 0.06, sin(k * 9.0) * 0.06, sin(k * 9.0 + 1.0) * 0.05)
		hand_r_basis = null
		pole_l = Vector3(-0.8, -0.6, 0.3)
		pole_r = Vector3(0.8, -0.6, 0.3)
	elif act == "repair":
		var k := action_t
		# работа стоя: руки на уровне пояса у объекта перед собой
		hand_l_tgt = chest_t * Vector3(-0.14, -0.28 + sin(k * 3.0) * 0.03, -0.42)
		hand_r_tgt = chest_t * Vector3(0.12, -0.24 + absf(sin(k * 6.0)) * 0.16, -0.4)
		hand_r_basis = null
		pole_l = Vector3(-0.8, -0.2, 0.4)
		pole_r = Vector3(0.8, 0.0, 0.5)
	elif act == "salute":
		var k := _seg(ap, 0.0, 0.2) * (1.0 - _seg(ap, 0.8, 1.0))
		hand_r_tgt = (chest_t * Vector3(0.22, -0.55, 0.0)).lerp(head_t * Vector3(0.1, 0.12, -0.08), k)
		hand_r_basis = null
		pole_r = Vector3(1.0, 0.2, 0.0)
	elif act == "pickup" or act == "use":
		var k := sin(ap * PI)
		var reach_pt := Vector3(-0.18, 0.45, -0.55) if act == "pickup" else chest_t * Vector3(-0.1, 0.05 + k * 0.05, -0.45)
		var start_pt := chest_t * Vector3(-0.1, -0.35, -0.3)
		hand_l_tgt = start_pt.lerp(reach_pt, k if act == "pickup" else 1.0)
		pole_l = Vector3(-0.8, -0.5, 0.4)
		if armed and weapon_xf != null:
			# левая рука освобождается, правая держит оружие опущенным
			pass
	elif act == "talk":
		if hand_l_tgt == null:
			hand_l_tgt = chest_t * Vector3(-0.2, -0.3 + sin(action_t * 3.0) * 0.05, -0.28)
	# ---------------- руки ----------------
	var arm_glob := {}
	for side in [-1.0, 1.0]:
		var sh_p: Vector3 = sh_l if side < 0 else sh_r
		var tgt: Variant = hand_l_tgt if side < 0 else hand_r_tgt
		var pole: Vector3 = pole_l if side < 0 else pole_r
		if tgt == null:
			var opp: Foot = _feet[1 if side < 0 else 0]
			var opp_rel := inv * opp.cur
			var swing_amt := clampf(-opp_rel.z * 1.35, -0.75, 0.75) * gait_w
			var elbow_bend := lerpf(0.25, 1.35, run_k)
			if shamble > 0.0:
				swing_amt = swing_amt * 0.3 + shamble * 0.9
				elbow_bend = 0.5
			var ua_b := chest_b * Basis(Vector3.FORWARD, side * (0.12 + run_k * 0.1)) * Basis(Vector3.RIGHT, swing_amt * lerpf(0.55, 0.9, run_k) + 0.02 + breathe)
			var fa_b := ua_b * Basis(Vector3.RIGHT, elbow_bend + maxf(0.0, swing_amt) * 0.5)
			arm_glob[side] = [ua_b, fa_b, fa_b]
		else:
			var hand_up: Vector3 = (hand_r_basis as Basis) * Vector3.UP if (side > 0 and hand_r_basis != null) else Vector3.UP
			var wrist: Vector3 = (tgt as Vector3) + hand_up * 0.065
			var elbow := _ik(sh_p, wrist, UPPER, FORE, pole)
			var ua_b := _basis_y_fwd((sh_p - elbow).normalized(), wrist - elbow)
			var wr := elbow + (wrist - elbow).normalized() * FORE
			var fa_b := _basis_y_fwd((elbow - wr).normalized(), sh_p - elbow)
			var hb: Basis = fa_b
			if side > 0 and hand_r_basis != null:
				hb = hand_r_basis
			arm_glob[side] = [ua_b, fa_b, hb]
	# ---------------- положение оружия ----------------
	if weapon_id != "" and weapon != null:
		if not armed or stowed:
			weapon.visible = true
			if hold_class == "pistol":
				weapon.transform = hips_t * Transform3D(Basis(Vector3.RIGHT, -PI / 2), Vector3(0.2, -0.04, -0.02))
			else:
				weapon.transform = chest_t * Transform3D(Basis(Vector3.FORWARD, 0.9) * Basis(Vector3.UP, PI), Vector3(0.0, 0.0, 0.2))
			weapon.mag_state = 0
			weapon.bolt_t = 0.0
			weapon.open_t = 0.0
		elif weapon_xf == null:
			var ra: Array = arm_glob[1.0]
			var ua_b: Basis = ra[0]
			var fa_b: Basis = ra[1]
			var hb: Basis = ra[2]
			var wrist := sh_r + ua_b * Vector3(0, -UPPER, 0) + fa_b * Vector3(0, -FORE, 0)
			weapon.visible = true
			weapon.transform = Transform3D(hb, wrist + hb * Vector3(0, -0.065, 0))
		else:
			weapon.visible = true
			weapon.transform = weapon_xf
		weapon.update_parts(delta)
	# ---------------- запись в скелет ----------------
	var g: Array = []
	g.resize(17)
	g[HIPS] = hips_b
	g[SPINE] = spine_b
	g[CHEST] = chest_b
	g[NECK] = neck_b
	g[HEAD] = head_b
	var al: Array = arm_glob[-1.0]
	var ar: Array = arm_glob[1.0]
	g[UA_L] = al[0]
	g[FA_L] = al[1]
	g[HAND_L] = al[2]
	g[UA_R] = ar[0]
	g[FA_R] = ar[1]
	g[HAND_R] = ar[2]
	g[TH_L] = leg_glob[0][0]
	g[SH_L] = leg_glob[0][1]
	g[FOOT_L] = leg_glob[0][2]
	g[TH_R] = leg_glob[1][0]
	g[SH_R] = leg_glob[1][1]
	g[FOOT_R] = leg_glob[1][2]
	_apply(g, _hips_pos)

func _end_action() -> void:
	action = ""
	if weapon:
		weapon.mag_state = 0
		weapon.bolt_t = 0.0
		weapon.open_t = 0.0

func _weapon_target(state: String, prof: Dictionary, chest_t: Transform3D, chest_b: Basis, aim_yaw: float) -> Transform3D:
	## Целевая трансформация оружия (в пространстве модели) для состояния хвата.
	if state == "aim":
		var a: Dictionary = prof.aim
		var wdir := Vector3(-sin(aim_yaw), 0, -cos(aim_yaw))
		wdir = (wdir * cos(_smooth_pitch) + Vector3.UP * sin(_smooth_pitch)).normalized()
		var wb := _weapon_basis(wdir, Vector3.UP, 0.0)
		match a.get("mode", "shoulder"):
			"extended":
				var base := chest_t * Vector3(0.0, 0.12, 0.0)
				return Transform3D(wb, base + wdir * float(a.get("reach", 0.48)) + Vector3(0, -0.02, 0))
			"hip":
				var g: Vector3 = chest_t * (a.anchor as Vector3)
				return Transform3D(wb, g)
			_:
				var anchor: Vector3 = chest_t * (a.anchor as Vector3)
				var st := weapon.point("stock")
				var eye_drop: float = prof.get("eye_drop", 0.0)
				return Transform3D(wb, anchor - wb * st + Vector3(0, -eye_drop, 0))
	var d: Dictionary = prof.get(state, prof.low)
	var fwd: Vector3 = chest_b * (d.f as Vector3).normalized()
	var up: Vector3 = chest_b * Vector3(0.1, 1.0, 0.15)
	return Transform3D(_weapon_basis(fwd, up, float(d.get("r", 0.0))), chest_t * (d.g as Vector3))

func _reload_tilt(ap: float) -> Transform3D:
	var k := _seg(ap, 0.0, 0.12) * (1.0 - _seg(ap, 0.88, 1.0))
	match weapon.reload_kind:
		"break":
			return Transform3D(Basis(Vector3.RIGHT, -0.5 * k), Vector3(0, 0.05 * k, 0))
		"pistol":
			return Transform3D(Basis(Vector3.FORWARD, 0.4 * k) * Basis(Vector3.RIGHT, 0.5 * k), Vector3(-0.05 * k, 0.12 * k, 0.05 * k))
		"box":
			return Transform3D(Basis(Vector3.FORWARD, -0.3 * k), Vector3(0, 0.06 * k, 0.04 * k))
		"drum":
			return Transform3D(Basis(Vector3.FORWARD, 0.6 * k), Vector3(0, 0.05 * k, 0.05 * k))
		"clip", "shells":
			return Transform3D(Basis(Vector3.FORWARD, -0.5 * k), Vector3(0, 0.08 * k, 0.05 * k))
		_:
			return Transform3D(Basis(Vector3.FORWARD, 0.55 * k) * Basis(Vector3.RIGHT, 0.2 * k), Vector3(0, 0.06 * k, 0.03 * k))

func _mag_follow(hand: Vector3, wx: Transform3D) -> void:
	## Магазин в руке: его точка хвата совпадает с ладонью.
	var local_hand := wx.affine_inverse() * hand
	var mo: Vector3 = weapon.point("mag_origin")
	var mp: Vector3 = weapon.point("mag_pt")
	weapon.mag_hand_xf = Transform3D(Basis(), local_hand - (mp - mo))
	weapon.mag_state = 1

func _reload_hand(k: float, wx: Transform3D, chest_t: Transform3D) -> Vector3:
	## Траектория левой руки и состояние частей оружия во время перезарядки.
	var fore := wx * weapon.point("fore")
	var magp := wx * weapon.point("mag_pt")
	var boltp := wx * weapon.point("bolt_pt")
	var pouch := chest_t * Vector3(-0.06, -0.24, -0.16)
	var h := fore
	match weapon.reload_kind:
		"mag", "pistol":
			if k < 0.12:
				h = fore.lerp(magp, _seg(k, 0.0, 0.12))
			elif k < 0.32:
				h = magp.lerp(pouch, _seg(k, 0.12, 0.32))
				_mag_follow(h, wx)
			elif k < 0.4:
				h = pouch + Vector3(0, sin(k * 60.0) * 0.01, 0)
				_mag_follow(h, wx)
			elif k < 0.62:
				h = pouch.lerp(magp + (magp - wx * weapon.point("mag_origin")) * 0.3, _seg(k, 0.4, 0.62))
				_mag_follow(h, wx)
			elif k < 0.7:
				h = (magp + (magp - wx * weapon.point("mag_origin")) * 0.3).lerp(magp, _seg(k, 0.62, 0.68))
				if k < 0.67:
					_mag_follow(h, wx)
			elif k < 0.88:
				h = magp.lerp(boltp, _seg(k, 0.7, 0.78))
				weapon.bolt_t = _seg(k, 0.78, 0.83) * (1.0 - _seg(k, 0.84, 0.87))
				h += (wx.basis * weapon.point("bolt_axis")) * weapon.bolt_t
			else:
				h = boltp.lerp(fore, _seg(k, 0.88, 1.0))
		"box":
			if k < 0.18:
				h = fore.lerp(boltp, _seg(k, 0.0, 0.1))
				weapon.open_t = _seg(k, 0.1, 0.18)
			elif k < 0.35:
				weapon.open_t = 1.0
				h = boltp.lerp(magp, _seg(k, 0.18, 0.24)).lerp(pouch, _seg(k, 0.24, 0.35))
				if k > 0.24:
					_mag_follow(h, wx)
			elif k < 0.6:
				weapon.open_t = 1.0
				h = pouch.lerp(magp, _seg(k, 0.4, 0.58))
				_mag_follow(h, wx)
			elif k < 0.85:
				weapon.open_t = 1.0 - _seg(k, 0.74, 0.82)
				h = magp.lerp(boltp, _seg(k, 0.62, 0.72))
			else:
				h = boltp.lerp(fore, _seg(k, 0.85, 1.0))
		"clip":
			if k < 0.2:
				h = fore.lerp(boltp, _seg(k, 0.0, 0.12))
				weapon.bolt_t = _seg(k, 0.12, 0.2)
				h += (wx.basis * weapon.point("bolt_axis")) * weapon.bolt_t
			elif k < 0.7:
				weapon.bolt_t = 1.0
				if k < 0.35:
					h = boltp.lerp(pouch, _seg(k, 0.2, 0.35))
				elif k < 0.48:
					h = pouch.lerp(magp + Vector3(0, 0.05, 0), _seg(k, 0.35, 0.48))
					_mag_follow(h, wx)
				else:
					h = magp + Vector3(0, 0.05 - absf(sin((k - 0.48) * 40.0)) * 0.05, 0)
					weapon.mag_state = 0 if k < 0.66 else 2
			elif k < 0.86:
				h = magp.lerp(boltp + (wx.basis * weapon.point("bolt_axis")), _seg(k, 0.7, 0.78))
				weapon.bolt_t = 1.0 - _seg(k, 0.78, 0.86)
				weapon.mag_state = 2
			else:
				weapon.mag_state = 2
				h = boltp.lerp(fore, _seg(k, 0.86, 1.0))
		"break":
			weapon.open_t = _seg(k, 0.05, 0.18) * (1.0 - _seg(k, 0.82, 0.92))
			if k < 0.2:
				h = fore
			elif k < 0.8:
				var c := fmod((k - 0.2) / 0.3, 1.0)
				h = pouch.lerp(magp, sin(c * PI))
			else:
				h = magp.lerp(fore, _seg(k, 0.8, 0.9))
		"shells":
			if k < 0.8:
				var c := fmod(k / 0.27, 1.0)
				h = pouch.lerp(magp, sin(c * PI))
			else:
				var fp := wx * weapon.point("bolt_pt")
				h = magp.lerp(fp, _seg(k, 0.8, 0.85))
				weapon.bolt_t = _seg(k, 0.86, 0.92) * (1.0 - _seg(k, 0.93, 0.99))
				h += (wx.basis * weapon.point("bolt_axis")) * weapon.bolt_t
		"drum":
			weapon.open_t = _seg(k, 0.05, 0.15) * (1.0 - _seg(k, 0.85, 0.93))
			if k < 0.15:
				h = fore.lerp(magp, _seg(k, 0.0, 0.15))
			elif k < 0.85:
				var c := fmod((k - 0.15) / 0.233, 1.0)
				h = pouch.lerp(magp + Vector3(0.09, 0, 0), sin(c * PI))
			else:
				h = magp.lerp(fore, _seg(k, 0.85, 1.0))
	return h

func _cycle_hand(k: float, wx: Transform3D) -> Vector3:
	## Передёргивание помпы/затвора после выстрела (КС-23, винтовка Мосина).
	var fore := wx * weapon.point("fore")
	var boltp := wx * weapon.point("bolt_pt")
	weapon.bolt_t = sin(k * PI)
	if weapon.reload_kind == "shells":
		return fore + (wx.basis * weapon.point("bolt_axis")) * weapon.bolt_t
	var h := fore.lerp(boltp, sin(k * PI))
	return h + (wx.basis * weapon.point("bolt_axis")) * weapon.bolt_t * 0.5

func _foot_off(f: Foot, inv: Transform3D, body_yaw: float) -> bool:
	var rel := inv * f.pos
	var n := _neutral(f)
	return Vector2(rel.x - n.x, rel.z - n.z).length() > 0.16 or absf(angle_difference(f.yaw, body_yaw)) > 0.6

func _apply(g: Array, hips_pos: Vector3) -> void:
	skel.set_bone_pose_position(HIPS, hips_pos)
	for i in 17:
		var b: Basis = g[i]
		var p: int = BONE_PARENT[i]
		var q: Quaternion
		if p < 0:
			q = b.get_rotation_quaternion()
		else:
			var pb: Basis = g[p]
			q = (pb.inverse() * b).orthonormalized().get_rotation_quaternion()
		_cur_rot[i] = q
		skel.set_bone_pose_rotation(i, q)

# ---------------- смерть ----------------
func die(_dir: Vector3 = Vector3.ZERO) -> void:
	if dead:
		return
	dead = true
	death_t = 0.0
	_death_from = _cur_rot.duplicate()
	_death_hips_from = _hips_pos
	var back := randf() < 0.6
	_death_to = []
	for i in 17:
		_death_to.append(Quaternion.IDENTITY)
	var r := randf_range(-0.4, 0.4)
	if back:
		_death_to[HIPS] = Quaternion(Basis(Vector3.UP, r) * Basis(Vector3.RIGHT, PI * 0.5))
		_death_hips_to = Vector3(0.0, 0.14, 0.82)
	else:
		_death_to[HIPS] = Quaternion(Basis(Vector3.UP, r) * Basis(Vector3.RIGHT, -PI * 0.5))
		_death_hips_to = Vector3(0, 0.14, -0.82)
	_death_to[SPINE] = Quaternion(Basis(Vector3.RIGHT, randf_range(-0.1, 0.1)))
	_death_to[CHEST] = Quaternion(Basis(Vector3.FORWARD, randf_range(-0.15, 0.15)))
	_death_to[NECK] = Quaternion(Basis(Vector3.UP, randf_range(-0.6, 0.6)))
	_death_to[HEAD] = Quaternion(Basis(Vector3.UP, randf_range(-0.5, 0.5)))
	_death_to[UA_L] = Quaternion(Basis(Vector3.FORWARD, randf_range(0.5, 1.4)))
	_death_to[FA_L] = Quaternion(Basis(Vector3.RIGHT, randf_range(0.1, 0.9)))
	_death_to[UA_R] = Quaternion(Basis(Vector3.FORWARD, -randf_range(0.5, 1.4)))
	_death_to[FA_R] = Quaternion(Basis(Vector3.RIGHT, randf_range(0.1, 0.9)))
	_death_to[TH_L] = Quaternion(Basis(Vector3.FORWARD, randf_range(-0.25, 0.0)) * Basis(Vector3.RIGHT, randf_range(0.0, 0.5)))
	_death_to[SH_L] = Quaternion(Basis(Vector3.RIGHT, -randf_range(0.0, 0.8)))
	_death_to[TH_R] = Quaternion(Basis(Vector3.FORWARD, randf_range(0.0, 0.25)) * Basis(Vector3.RIGHT, randf_range(0.0, 0.3)))
	_death_to[SH_R] = Quaternion(Basis(Vector3.RIGHT, -randf_range(0.0, 0.5)))
	_death_to[FOOT_L] = Quaternion(Basis(Vector3.RIGHT, 0.6))
	_death_to[FOOT_R] = Quaternion(Basis(Vector3.RIGHT, 0.6))

func _update_death(delta: float) -> void:
	if death_t >= 1.0:
		return
	death_t = minf(1.0, death_t + delta / 0.75)
	var k := death_t * death_t
	var kb := 1.0 - pow(1.0 - death_t, 3.0)
	for i in 17:
		var q: Quaternion = (_death_from[i] as Quaternion).slerp(_death_to[i], kb if i != HIPS else k)
		skel.set_bone_pose_rotation(i, q)
	var hp := _death_hips_from.lerp(_death_hips_to, k)
	skel.set_bone_pose_position(HIPS, hp)
	if weapon.visible and death_t > 0.3:
		weapon.transform = Transform3D(Basis(Vector3.UP, 0.7) * Basis(Vector3.FORWARD, PI / 2), Vector3(0.5, 0.03, 0.35))
		weapon.mag_state = 0
