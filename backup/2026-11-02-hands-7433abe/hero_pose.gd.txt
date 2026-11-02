extends SkeletonModifier3D
## Поза героя поверх анимации. Godot вызывает _process_modification() каждый кадр после того, как AnimationTree
## выставил кости, и до отрисовки (так устроен SkeletonModifier3D в Godot 4.3+). Порядок (ТЗ «СТИКС»: сначала
## правая кисть держит оружие, затем оружие задаёт место левой кисти, затем локти):
##   1) поворот корпуса: позвоночник (Spine → Spine1 → Spine2) доворачивается на twist — ноги шагают по ходу
##      движения, верх смотрит туда, куда целится герой (поворот делится между тремя позвонками);
##   1а) переноска длинного ствола вне прицела (вес carry): ствол поперёк корпуса на уровне низа груди, дулом вперёд
##      и чуть влево, приклад у правого бока под предплечьем, правая кисть на пистолетной рукояти (двухзвенный IK
##      правой руки к хвату CARRY в осях груди — качается вместе с корпусом на ходу), левая — снизу под цевьём (п. 3);
##   2) отдача: грудь откидывается назад, правая кисть с оружием уходит назад по линии ствола, ствол
##      подбрасывает вверх (двухзвенный IK правой руки), затем возврат — сила kick гаснет в player.gd;
##   3) левая кисть — на цевьё двуручного оружия: узел GripL модели ствола (marker, в осях хвата правой руки)
##      → двухзвенный IK плечо–локоть–кисть (если не достать — ключица навстречу и перехват цевья ближе);
##      вес ik_weight плавно 0 → 1 при подъёме и 1 → 0 при уборке.
## Локоть сгибается в той же плоскости, что в клипе (не перескакивает и не выворачивается), и никогда не
## выпрямляется до конца. Изменения не накапливаются: после отрисовки скелет возвращает кости к анимации.

const SPINE := ["Spine", "Spine1", "Spine2"]
## Доля поворота корпуса на каждый позвонок, снизу вверх.
const SPINE_SHARE := [0.3, 0.33, 0.37]
## Рука вытягивается не больше чем на эту долю длины — локоть не бывает прямым (180°).
const REACH := 0.98
## Если до цевья не достать (низкая готовность: клипы запечены с короткой рукой), ключица выдвигается навстречу
## (до 20°), а остаток — кисть перехватывает цевьё ближе к себе (до 7 см по стволу назад). Проверено на всех
## кадрах клипов с автоматом: кисть на цевье, локоть согнут на 23–45°.
const CLAV_MAX := 0.35
const SLIDE_MAX := 0.07
## Переноска: где хват правой кисти (узел GripR) в осях груди (Spine2: x — влево, y — вверх, z — вперёд), м,
## и куда смотрит ствол: на CARRY_YAW влево и на CARRY_PITCH вниз, градусы (по снимкам-образцам пользователя:
## ствол поперёк корпуса, приклад под правым предплечьем, левая ладонь снизу под цевьём).
const CARRY_AT := Vector3(-0.12, -0.18, 0.33)
const CARRY_YAW := 20.0
const CARRY_PITCH := 4.0

## Поворот верха относительно ног, рад (плюс — влево).
var twist := 0.0
## Отдача: сила сейчас (1 — в момент выстрела), толчок назад, м, подброс ствола и откид груди, рад.
var kick := 0.0
var kick_back := 0.0
var kick_climb := 0.0
var kick_chest := 0.0
## Вес IK левой кисти (0 — как в клипе, 1 — точно на GripL оружия).
var ik_weight := 0.0
## Вес переноски длинного ствола (0 — как в клипе, 1 — хват CARRY); в прицеле — 0.
var carry := 0.0
## Где должен оказаться узел GripL левой кисти — в осях узла GripR правой (= в осях оружия в руке).
var marker := Transform3D.IDENTITY
## Для автотеста: сколько раз модификатор отработал и насколько левая кисть не дотянулась до цели, м (−1 — IK выключен).
var frames := 0
var ik_error := -1.0
## На сколько кисть перехватила цевьё ближе к себе, м.
var ik_slide := 0.0

var _bound := false
var _spine: Array[int] = []
var _chest := -1
var _r_arm := -1
var _r_fore := -1
var _r_hand := -1
var _l_clav := -1
var _l_arm := -1
var _l_fore := -1
var _l_hand := -1
var _grip_r := -1
var _grip_l := -1

## Кость по короткому имени Mixamo («Spine», «LeftHand»): с приставкой mixamorig или без.
static func find_bone(sk: Skeleton3D, short: String) -> int:
	for n in ["mixamorig" + short, short, "mixamorig_" + short, "mixamorig:" + short]:
		var i := sk.find_bone(n)
		if i >= 0:
			return i
	return -1

## Узлы хвата в кистях героя (из player.glb) — на случай, если импорт не сделал их костями.
static func grip_r_default() -> Transform3D:
	return Transform3D(Basis(Quaternion(0.0, 0.0, 0.7071068, -0.7071068)), Vector3(-0.1209, -0.012, 0.0))

static func grip_l_default() -> Transform3D:
	return Transform3D(Basis(Quaternion(0.0, 0.0, -0.7071068, -0.7071068)), Vector3(0.1209, -0.012, 0.0))

func _bind(sk: Skeleton3D) -> void:
	_bound = true
	_spine.clear()
	for n in SPINE:
		_spine.append(find_bone(sk, n))
	_chest = _spine[2]
	_r_arm = find_bone(sk, "RightArm")
	_r_fore = find_bone(sk, "RightForeArm")
	_r_hand = find_bone(sk, "RightHand")
	_l_clav = find_bone(sk, "LeftShoulder")
	_l_arm = find_bone(sk, "LeftArm")
	_l_fore = find_bone(sk, "LeftForeArm")
	_l_hand = find_bone(sk, "LeftHand")
	_grip_r = sk.find_bone("GripR")
	_grip_l = sk.find_bone("GripL")

func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null:
		return
	if not _bound:
		_bind(sk)
	frames += 1
	if absf(twist) > 0.0005:
		_twist(sk)
	if carry > 0.001 and _chest >= 0 and _r_arm >= 0 and _r_fore >= 0 and _r_hand >= 0:
		_carry(sk)
	if kick > 0.003:
		_recoil(sk)
	if ik_weight > 0.001 and _l_arm >= 0 and _l_fore >= 0 and _l_hand >= 0 and _r_hand >= 0:
		_left_hand(sk)
	else:
		ik_error = -1.0

# ---------- 1. Корпус к цели ----------

func _twist(sk: Skeleton3D) -> void:
	# вертикаль в осях скелета (модель стоит прямо, но на всякий случай — от мировой)
	var up := (sk.global_transform.basis.orthonormalized().inverse() * Vector3.UP).normalized()
	for k in _spine.size():
		if _spine[k] >= 0:
			_turn(sk, _spine[k], up, twist * float(SPINE_SHARE[k]))

# ---------- 1а. Переноска ----------

## Хват правой кисти при переноске — в осях груди: ствол (−Y хвата) вперёд, влево и чуть вниз, верх (+Z) — вверх.
static func carry_grip() -> Transform3D:
	var yaw := deg_to_rad(CARRY_YAW)
	var pitch := deg_to_rad(CARRY_PITCH)
	var d := Vector3(sin(yaw) * cos(pitch), -sin(pitch), cos(yaw) * cos(pitch)).normalized()
	var y := -d
	var z := (Vector3.UP - y * Vector3.UP.dot(y)).normalized()
	return Transform3D(Basis(y.cross(z), y, z), CARRY_AT)

func _carry(sk: Skeleton3D) -> void:
	var w := clampf(carry, 0.0, 1.0)
	var chest := sk.get_bone_global_pose(_chest)
	var g := Transform3D(chest.basis.orthonormalized(), chest.origin) * carry_grip()
	var goal := g * _grip_r_local(sk).affine_inverse()
	var now := sk.get_bone_global_pose(_r_hand)
	_solve(sk, _r_arm, _r_fore, _r_hand, now.interpolate_with(goal, w), _hint(sk, Vector3(-0.6, -1.0, -0.3)))

# ---------- 2. Отдача ----------

func _recoil(sk: Skeleton3D) -> void:
	if _chest >= 0 and kick_chest > 0.0:
		# грудь — назад: поворот вокруг оси «влево» груди (+X кости в T-позе) на минус
		_turn(sk, _chest, sk.get_bone_global_pose(_chest).basis.x.normalized(), -kick_chest * kick)
	if _r_arm < 0 or _r_fore < 0 or _r_hand < 0 or (kick_back <= 0.0 and kick_climb <= 0.0):
		return
	var h := sk.get_bone_global_pose(_r_hand)
	var g := h * _grip_r_local(sk)
	# оси хвата: ствол — по −Y, к прикладу — +Y, верх оружия — +Z, левый бок — +X; подброс — поворот вокруг X
	var side := g.basis.x.normalized()
	var g2 := Transform3D(Basis(side, -kick_climb * kick) * g.basis, g.origin + g.basis.y.normalized() * (kick_back * kick))
	_solve(sk, _r_arm, _r_fore, _r_hand, g2 * g.affine_inverse() * h, _hint(sk, Vector3(-0.6, -1.0, -0.3)))

# ---------- 3. Левая кисть на цевье ----------

func _left_hand(sk: Skeleton3D) -> void:
	var w := clampf(ik_weight, 0.0, 1.0)
	var g := sk.get_bone_global_pose(_r_hand) * _grip_r_local(sk)
	# где должна быть кисть, чтобы её узел GripL лёг на GripL оружия
	var goal := g * marker * _grip_l_local(sk).affine_inverse()
	var now := sk.get_bone_global_pose(_l_hand)
	_reach_clavicle(sk, goal.origin, w)
	# и с ключицей не достаёт — перехватить цевьё ближе к себе (по стволу назад, +Y хвата)
	var back := g.basis.y.normalized()
	var a := sk.get_bone_global_pose(_l_arm).origin
	var reach := _arm_len(sk) * REACH
	var d0 := goal.origin - a
	var s := 0.0
	if d0.length() > reach:
		var bd := back.dot(d0)
		var disc := bd * bd - (d0.length_squared() - reach * reach)
		s = -bd - sqrt(disc) if disc >= 0.0 else -bd
	ik_slide = clampf(s, 0.0, SLIDE_MAX)
	goal.origin += back * ik_slide
	var want := now.interpolate_with(goal, w)
	_solve(sk, _l_arm, _l_fore, _l_hand, want, _hint(sk, Vector3(0.6, -1.0, -0.3)))
	ik_error = sk.get_bone_global_pose(_l_hand).origin.distance_to(goal.origin)

## Ключица навстречу цели, если рука не достаёт (плечо выдвигается вперёд-внутрь), — до CLAV_MAX, с весом w.
func _reach_clavicle(sk: Skeleton3D, goal: Vector3, w: float) -> void:
	if _l_clav < 0:
		return
	var c := sk.get_bone_global_pose(_l_clav).origin
	var a := sk.get_bone_global_pose(_l_arm).origin
	var reach := _arm_len(sk) * REACH
	if a.distance_to(goal) <= reach:
		return
	var u := a - c
	var n := u.cross(goal - c)
	if n.length_squared() < 1e-10:
		return
	n = n.normalized()
	var f := CLAV_MAX
	if (c + u.rotated(n, f)).distance_to(goal) <= reach:
		# хватит и меньшего поворота — найти его делением пополам
		var lo := 0.0
		var hi := CLAV_MAX
		for _k in 8:
			var m := (lo + hi) * 0.5
			if (c + u.rotated(n, m)).distance_to(goal) <= reach:
				hi = m
			else:
				lo = m
		f = hi
	_turn(sk, _l_clav, n, f * w)

func _arm_len(sk: Skeleton3D) -> float:
	var a := sk.get_bone_global_pose(_l_arm).origin
	var b := sk.get_bone_global_pose(_l_fore).origin
	return a.distance_to(b) + b.distance_to(sk.get_bone_global_pose(_l_hand).origin)

# ---------- Общее ----------

## Узел GripR относительно кисти: из костей (если импорт сделал узел костью) или как в player.glb.
func _grip_r_local(sk: Skeleton3D) -> Transform3D:
	if _grip_r >= 0:
		return sk.get_bone_global_pose(_r_hand).affine_inverse() * sk.get_bone_global_pose(_grip_r)
	return grip_r_default()

func _grip_l_local(sk: Skeleton3D) -> Transform3D:
	if _grip_l >= 0:
		return sk.get_bone_global_pose(_l_hand).affine_inverse() * sk.get_bone_global_pose(_grip_l)
	return grip_l_default()

## Подсказка, куда смотрит локоть, — в осях груди (вниз, наружу, чуть назад); нужна, только если рука прямая.
func _hint(sk: Skeleton3D, local: Vector3) -> Vector3:
	if _chest < 0:
		return local
	return sk.get_bone_global_pose(_chest).basis.orthonormalized() * local

## Повернуть кость вокруг оси (в осях скелета) на угол — поверх её позы из анимации.
func _turn(sk: Skeleton3D, i: int, axis: Vector3, angle: float) -> void:
	var parent := sk.get_bone_parent(i)
	var pb := sk.get_bone_global_pose(parent).basis.orthonormalized() if parent >= 0 else Basis.IDENTITY
	var local_axis := (pb.inverse() * axis).normalized()
	if local_axis.length_squared() < 0.5:
		return
	sk.set_bone_pose_rotation(i, (Quaternion(local_axis, angle) * sk.get_bone_pose_rotation(i)).normalized())

## Поставить кости поворот в осях скелета.
func _set_global_basis(sk: Skeleton3D, i: int, b: Basis) -> void:
	var parent := sk.get_bone_parent(i)
	var pb := sk.get_bone_global_pose(parent).basis.orthonormalized() if parent >= 0 else Basis.IDENTITY
	sk.set_bone_pose_rotation(i, (pb.inverse() * b.orthonormalized()).get_rotation_quaternion())

## Кратчайший поворот от направления a к направлению b.
static func _arc(a: Vector3, b: Vector3) -> Quaternion:
	if a.length_squared() < 1e-10 or b.length_squared() < 1e-10:
		return Quaternion.IDENTITY
	var u := a.normalized()
	var v := b.normalized()
	var d := u.dot(v)
	if d > 0.999999:
		return Quaternion.IDENTITY
	if d < -0.9999:
		var ax := u.cross(Vector3.UP)
		if ax.length_squared() < 1e-6:
			ax = u.cross(Vector3.RIGHT)
		return Quaternion(ax.normalized(), PI)
	return Quaternion(u, v)

## Двухзвенный IK: плечо i_up → локоть i_lo → кисть i_hand; кисть — в target (точка и поворот, оси скелета).
## Локоть остаётся в плоскости, где он сейчас (по клипу); если рука почти прямая — по подсказке hint.
func _solve(sk: Skeleton3D, i_up: int, i_lo: int, i_hand: int, target: Transform3D, hint: Vector3) -> void:
	var a := sk.get_bone_global_pose(i_up).origin
	var b := sk.get_bone_global_pose(i_lo).origin
	var c := sk.get_bone_global_pose(i_hand).origin
	var l1 := a.distance_to(b)
	var l2 := b.distance_to(c)
	var to := target.origin - a
	if l1 < 0.01 or l2 < 0.01 or to.length() < 0.001:
		return
	var d := clampf(to.length(), absf(l1 - l2) + 0.01, (l1 + l2) * REACH)
	var dir := to.normalized()
	var bend := b - a
	var pole := bend - dir * bend.dot(dir)
	if pole.length_squared() < 0.0004:
		pole = hint - dir * hint.dot(dir)
	if pole.length_squared() < 1e-8:
		return
	pole = pole.normalized()
	var cos_a := clampf((l1 * l1 + d * d - l2 * l2) / (2.0 * l1 * d), -1.0, 1.0)
	var elbow := a + dir * (l1 * cos_a) + pole * (l1 * sqrt(maxf(0.0, 1.0 - cos_a * cos_a)))
	var wrist := a + dir * d
	# плечо: локоть — на новое место (поворот вокруг плечевого сустава)
	var up_b := sk.get_bone_global_pose(i_up).basis.orthonormalized()
	_set_global_basis(sk, i_up, Basis(_arc(b - a, elbow - a)) * up_b)
	# предплечье: запястье — к цели
	var lo := sk.get_bone_global_pose(i_lo)
	var c2 := sk.get_bone_global_pose(i_hand).origin
	_set_global_basis(sk, i_lo, Basis(_arc(c2 - lo.origin, wrist - lo.origin)) * lo.basis.orthonormalized())
	# кисть: поворот цели (хват оружия)
	_set_global_basis(sk, i_hand, target.basis)
