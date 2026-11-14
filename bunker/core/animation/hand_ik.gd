class_name BCHandIK
extends SkeletonModifier3D
## Кисть к цели (BunkerCore): двухзвенный IK руки (плечо → предплечье → кисть) с плавным весом.
## Клип двери/пульта сделан «в воздух»; при взаимодействии player.gd задаёт точку (ручка двери, панель пульта,
## выключатель) и окно времени, где рука на ней. Вес растёт за t_in, держится, спадает за t_out (smoothstep);
## цель может двигаться (ручка открывающейся двери) — тогда она передаётся как узел. Если цель дальше длины руки,
## кисть тянется к ней по прямой насколько хватает (клип не ломается). Ладонь — на цели: запястье ставится
## на расстояние «запястье — середина ладони» от цели по направлению кисти из клипа.

var _side := ""
var _target := Vector3.ZERO
var _node: Node3D = null
var _node_off := Vector3.ZERO
var _t := 0.0
var _t_in := 0.25
var _t_hold := 0.5
var _t_out := 0.3
var _delay := 0.0
var weight := 0.0
var last_err := 0.0                     ## расстояние кисть — цель после IK, м (для проверки)


## тянуться рукой ("L"/"R") к точке world (или к узлу node со смещением в его системе)
func reach(side: String, world: Vector3, delay: float, t_in: float, hold: float, t_out: float, node: Node3D = null) -> void:
	_side = side
	_target = world
	_node = node
	_node_off = node.global_transform.affine_inverse() * world if node else Vector3.ZERO
	_delay = delay
	_t_in = maxf(t_in, 0.01)
	_t_hold = hold
	_t_out = maxf(t_out, 0.01)
	_t = 0.0


func cancel() -> void:
	_side = ""
	weight = 0.0


func _process_modification_with_delta(delta: float) -> void:
	if _side == "":
		return
	var s := get_skeleton()
	if s == null:
		return
	_t += delta
	var x := _t - _delay
	var w := 0.0
	if x <= 0.0:
		w = 0.0
	elif x < _t_in:
		w = x / _t_in
	elif x < _t_in + _t_hold:
		w = 1.0
	elif x < _t_in + _t_hold + _t_out:
		w = 1.0 - (x - _t_in - _t_hold) / _t_out
	else:
		_side = ""
		weight = 0.0
		return
	weight = w * w * (3.0 - 2.0 * w)
	if weight < 0.001:
		return
	var a := s.find_bone(_side + "_Upperarm")
	var b := s.find_bone(_side + "_Forearm")
	var c := s.find_bone(_side + "_Hand")
	var m := s.find_bone(_side + "_Mid1")
	if a < 0 or b < 0 or c < 0:
		return
	var goal := _node.global_transform * _node_off if is_instance_valid(_node) else _target
	var inv := s.global_transform.affine_inverse()
	var tg := inv * goal
	# ладонь на цели: запястье — на длину «запястье → середина ладони» назад по направлению кисти
	var C := s.get_bone_global_pose(c)
	if m >= 0:
		var palm := (s.get_bone_global_pose(m).origin - C.origin) * 0.6
		tg -= palm
	var cur := C.origin
	var want := cur.lerp(tg, weight)
	_solve(s, a, b, c, want)
	last_err = (s.global_transform * s.get_bone_global_pose(c).origin).distance_to(s.global_transform * tg) * weight


func _solve(s: Skeleton3D, a: int, b: int, c: int, target: Vector3) -> void:
	var A := s.get_bone_global_pose(a)
	var B := s.get_bone_global_pose(b)
	var C := s.get_bone_global_pose(c)
	var la := A.origin.distance_to(B.origin)
	var lb := B.origin.distance_to(C.origin)
	var at := target - A.origin
	var d := clampf(at.length(), absf(la - lb) + 0.001, la + lb - 0.001)
	var dir := at.normalized()
	var ac := C.origin - A.origin
	var elbow := B.origin - A.origin
	var pole := elbow - ac.normalized() * elbow.dot(ac.normalized())
	if pole.length() < 0.0001:
		pole = Vector3.DOWN
	pole = (pole - dir * pole.dot(dir)).normalized()
	var cos_a := clampf((la * la + d * d - lb * lb) / (2.0 * la * d), -1.0, 1.0)
	var new_b := A.origin + dir * (la * cos_a) + pole * (la * sqrt(1.0 - cos_a * cos_a))
	A.basis = Basis(Quaternion((B.origin - A.origin).normalized(), (new_b - A.origin).normalized())) * A.basis
	s.set_bone_global_pose(a, A)
	var B2 := s.get_bone_global_pose(b)
	var C2 := s.get_bone_global_pose(c)
	B2.basis = Basis(Quaternion((C2.origin - B2.origin).normalized(), (A.origin + dir * d - B2.origin).normalized())) * B2.basis
	s.set_bone_global_pose(b, B2)
	# кисть сохраняет ориентацию из клипа
	var C3 := s.get_bone_global_pose(c)
	C3.basis = C.basis
	s.set_bone_global_pose(c, C3)
