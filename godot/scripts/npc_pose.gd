class_name NpcPose
extends SkeletonModifier3D
## Поза оружия у муров и наёмников поверх клипа (как у героя — hero_pose.gd, но без поворота корпуса и отдачи):
##   • переноска длинного (двуручного) ствола вне прицела (вес carry): правая кисть — на хвате CARRY в осях груди (ствол поперёк
##     корпуса, приклад у правого бока — как на образцах пользователя), двухзвенный IK правой руки;
##   • левая кисть — на цевье того ствола, что в руке (узел GripL модели оружия), с весом left — клипы сделаны под
##     старые крупные стволы, и без этого левая рука висела в воздухе.
## Работает и на скелете player.glb (наёмники), и на скелете модели Tripo (муры, клипы пересчитаны SkinBake): кости —
## по именам (SkinFollow.find_mixamo), оси корпуса — по линии плеч и вертикали скелета в позе покоя.
## Стоит три кости на руку — дёшево; модификатор выключают вместе с анимацией, когда персонаж далеко.

const HeroPoseScript := preload("res://scripts/hero_pose.gd")
const REACH := 0.98

## Правая кисть → хват (узел, куда кладут оружие); левая кисть → точка опоры цевья. Ставит хозяин (bandit.gd, merc.gd).
var grip_r := Transform3D.IDENTITY
var grip_l := Transform3D.IDENTITY
## Цевьё в осях хвата (узел GripL модели оружия); есть ли оно у ствола.
var marker := Transform3D.IDENTITY
var has_marker := false
## Вес переноски (0 — как в клипе) и вес левой кисти на цевье.
var carry := 0.0
var left := 0.0
## Метров в единице скелета (у модели Tripo скелет внутри узла с масштабом ~2,06): переноска задана в метрах.
var unit := 1.0
## Для автотеста: насколько левая кисть не достала до цевья, в единицах скелета (−1 — не на цевье).
var left_error := -1.0

var _bound := false
var _chest := -1
var _r := [-1, -1, -1]
var _l := [-1, -1, -1]
var _chest_fix := Basis.IDENTITY

## Для модели player.glb (наёмники, запасная модель мура): хваты — из костей-узлов GripR / GripL кистей.
static func make_for_old(model: Node) -> NpcPose:
	var sks := model.find_children("*", "Skeleton3D", true, false)
	if sks.is_empty():
		return null
	var sk: Skeleton3D = sks[0]
	var n := NpcPose.new()
	var rh := SkinFollow.src_bone(sk, "RightHand")
	var lh := SkinFollow.src_bone(sk, "LeftHand")
	var gr := sk.find_bone("GripR")
	var gl := sk.find_bone("GripL")
	n.grip_r = sk.get_bone_global_rest(rh).affine_inverse() * sk.get_bone_global_rest(gr) if rh >= 0 and gr >= 0 else HeroPoseScript.grip_r_default()
	n.grip_l = sk.get_bone_global_rest(lh).affine_inverse() * sk.get_bone_global_rest(gl) if lh >= 0 and gl >= 0 else HeroPoseScript.grip_l_default()
	return n

## Оружие в руке: класс хвата (Gear.CLASS_OF — переноска, двуручный ли), точка LeftSupportGrip относительно
## RightGrip — для левой кисти; у одноручного класса левая не трогается.
var weapon_id := ""

func set_weapon(gun: Node3D, id: String) -> void:
	weapon_id = id
	has_marker = false
	if gun == null or not bool(Gear.grip_class(id)["two"]) or Gear.point(gun, "LeftSupportGrip") == null:
		return
	marker = Gear.point_local(gun, "RightGrip").affine_inverse() * Gear.point_local(gun, "LeftSupportGrip")
	has_marker = true

func _bind(sk: Skeleton3D) -> void:
	_bound = true
	_chest = SkinFollow.find_mixamo(sk, "Spine2")
	_r = [SkinFollow.find_mixamo(sk, "RightArm"), SkinFollow.find_mixamo(sk, "RightForeArm"), SkinFollow.find_mixamo(sk, "RightHand")]
	_l = [SkinFollow.find_mixamo(sk, "LeftArm"), SkinFollow.find_mixamo(sk, "LeftForeArm"), SkinFollow.find_mixamo(sk, "LeftHand")]
	# оси корпуса в позе покоя (x — влево, y — вверх, z — вперёд) относительно кости груди: у player.glb кости
	# смотрят по осям мира, у модели Tripo — вдоль кости; переноска задана в осях корпуса
	if _chest >= 0 and _r[0] >= 0 and _l[0] >= 0:
		var lft := (sk.get_bone_global_rest(_l[0]).origin - sk.get_bone_global_rest(_r[0]).origin)
		lft.y = 0.0
		if lft.length_squared() > 1e-8:
			lft = lft.normalized()
			var up := Vector3.UP
			var fwd := lft.cross(up).normalized()
			var body := Basis(lft, up, fwd)
			_chest_fix = sk.get_bone_global_rest(_chest).basis.orthonormalized().inverse() * body

func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null:
		return
	if not _bound:
		_bind(sk)
	if _r.has(-1) or _l.has(-1):
		return
	var cgr: Array = Gear.carry_grip(weapon_id)
	if carry > 0.001 and has_marker and bool(cgr[1]) and _chest >= 0:
		var chest := sk.get_bone_global_pose(_chest)
		var body := Transform3D(chest.basis.orthonormalized() * _chest_fix, chest.origin)
		# хват в единицах скелета: у модели Tripo узел хвата несёт масштаб 1/unit (в мире — 1), так же и цель
		var cg0: Transform3D = cgr[0]
		var cg := Transform3D(cg0.basis.scaled(Vector3.ONE / unit), cg0.origin / unit)
		var goal: Transform3D = body * cg * grip_r.affine_inverse()
		var now := sk.get_bone_global_pose(_r[2])
		_solve(sk, _r, now.interpolate_with(goal, clampf(carry, 0.0, 1.0)), body.basis * Gear.POLE_R)
	left_error = -1.0
	if left > 0.001 and has_marker:
		var g := sk.get_bone_global_pose(_r[2]) * grip_r
		var goal_l := g * marker * grip_l.affine_inverse()
		var now_l := sk.get_bone_global_pose(_l[2])
		var chest_b := sk.get_bone_global_pose(_chest).basis.orthonormalized() * _chest_fix if _chest >= 0 else Basis.IDENTITY
		_solve(sk, _l, now_l.interpolate_with(goal_l, clampf(left, 0.0, 1.0)), chest_b * Gear.POLE_L)
		left_error = (sk.get_bone_global_pose(_l[2]) * grip_l).origin.distance_to((g * marker).origin)

## Двухзвенный IK: плечо → локоть → кисть; кисть — в target (точка и поворот, оси скелета). Локоть — в плоскости,
## где он сейчас (по клипу), если рука почти прямая — по подсказке hint.
func _solve(sk: Skeleton3D, ch: Array, target: Transform3D, hint: Vector3) -> void:
	var a := sk.get_bone_global_pose(ch[0]).origin
	var b := sk.get_bone_global_pose(ch[1]).origin
	var c := sk.get_bone_global_pose(ch[2]).origin
	var l1 := a.distance_to(b)
	var l2 := b.distance_to(c)
	var to := target.origin - a
	if l1 < 1e-4 or l2 < 1e-4 or to.length() < 1e-5:
		return
	var d := clampf(to.length(), absf(l1 - l2) + 1e-4, (l1 + l2) * REACH)
	var dir := to.normalized()
	# полюс — явный (локоть вниз-наружу-назад в осях корпуса): плоскость локтя из клипа после IK бывает выкручена
	var pole := hint - dir * hint.dot(dir)
	if pole.length_squared() < 1e-8:
		var bend := b - a
		pole = bend - dir * bend.dot(dir)
	if pole.length_squared() < 1e-12:
		return
	pole = pole.normalized()
	var cos_a := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
	var elbow := a + dir * (l1 * cos_a) + pole * (l1 * sqrt(maxf(0.0, 1.0 - cos_a * cos_a)))
	var wrist := a + dir * d
	_set_basis(sk, ch[0], Basis(HeroPoseScript._arc(b - a, elbow - a)) * sk.get_bone_global_pose(ch[0]).basis.orthonormalized())
	var lo := sk.get_bone_global_pose(ch[1])
	var c2 := sk.get_bone_global_pose(ch[2]).origin
	_set_basis(sk, ch[1], Basis(HeroPoseScript._arc(c2 - lo.origin, wrist - lo.origin)) * lo.basis.orthonormalized())
	_set_basis(sk, ch[2], target.basis.orthonormalized())

func _set_basis(sk: Skeleton3D, i: int, b: Basis) -> void:
	var parent := sk.get_bone_parent(i)
	var pb := sk.get_bone_global_pose(parent).basis.orthonormalized() if parent >= 0 else Basis.IDENTITY
	sk.set_bone_pose_rotation(i, (pb.inverse() * b).get_rotation_quaternion())
