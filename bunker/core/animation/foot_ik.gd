class_name BCFootIK
extends SkeletonModifier3D
## Постановка стоп BunkerCore (IK для ног). Клипы рассчитаны на ровный пол; на ступенях, склонах и камнях
## каждая стопа ищет землю лучом вниз (слои «мир» и «детали»), таз опускается к нижней стопе, колени
## сгибаются аналитическим решением двухзвенной цепи (бедро → голень → стопа) в плоскости колена, стопа
## наклоняется по нормали поверхности. Смещения сглаживаются, чтобы не дёргалось.

@export var legs := [["L_Thigh", "L_Calf", "L_Foot"], ["R_Thigh", "R_Calf", "R_Foot"]]
@export var hip_bone := "Hip"
@export var ray_up := 0.6
@export var ray_down := 0.9
@export var max_drop := 0.45                ## насколько таз может опуститься
@export var smooth := 14.0
@export var enabled_ik := true
@export var align_feet := true
@export_flags_3d_physics var mask := 1 | 32

var _bones := []          ## [[thigh, calf, foot], ...] индексы
var _hip := -1
var _off := [0.0, 0.0]    ## сглаженные смещения стоп по высоте
var _nrm := [Vector3.UP, Vector3.UP]
var _pelvis := 0.0
var _ankle := 0.08        ## высота голеностопа над подошвой в позе покоя
var last_debug := {}


func _skel_ready() -> void:
	var s := get_skeleton()
	if s == null:
		return
	_bones.clear()
	for L in legs:
		_bones.append([s.find_bone(L[0]), s.find_bone(L[1]), s.find_bone(L[2])])
	_hip = s.find_bone(hip_bone)
	# высота голеностопа: самая низкая точка стоп в покое ≈ подошва
	var lo := INF
	for b in _bones:
		if b[2] >= 0:
			lo = minf(lo, s.get_bone_global_rest(b[2]).origin.y)
	_ankle = maxf(0.02, lo - _rest_floor(s))


func _rest_floor(s: Skeleton3D) -> float:
	# пол в позе покоя — низ модели (у Tripo — около нуля пространства скелета)
	var lo := INF
	for i in s.get_bone_count():
		lo = minf(lo, s.get_bone_global_rest(i).origin.y)
	return minf(lo, 0.0)


func _process_modification_with_delta(delta: float) -> void:
	var s := get_skeleton()
	if s == null or not enabled_ik:
		return
	if _bones.is_empty():
		_skel_ready()
		if _bones.is_empty() or _hip < 0:
			return
	var space := s.get_world_3d().direct_space_state if s.is_inside_tree() else null
	if space == null:
		return
	var xf := s.global_transform
	var root_y := s.get_parent_node_3d().global_position.y if s.get_parent_node_3d() else xf.origin.y
	var sc := xf.basis.get_scale().y
	var k := clampf(delta * smooth, 0.0, 1.0) if delta > 0.0 else 1.0
	var want := [0.0, 0.0]
	var nrm := [Vector3.UP, Vector3.UP]
	for li in _bones.size():
		var b: Array = _bones[li]
		if b[2] < 0:
			continue
		var foot_w := xf * s.get_bone_global_pose(b[2]).origin
		var q := PhysicsRayQueryParameters3D.create(foot_w + Vector3.UP * ray_up, foot_w + Vector3.DOWN * ray_down, mask)
		q.exclude = _exclude()
		var hit := space.intersect_ray(q)
		if hit.is_empty():
			continue
		# насколько земля под стопой выше/ниже уровня, на который рассчитан клип
		want[li] = clampf(hit.position.y - root_y, -max_drop, max_drop)
		nrm[li] = hit.normal
	for li in 2:
		_off[li] = lerpf(_off[li], want[li], k)
		_nrm[li] = _nrm[li].lerp(nrm[li], k).normalized()
	var pel := minf(minf(_off[0], _off[1]), 0.0)
	_pelvis = lerpf(_pelvis, pel, k)
	last_debug = {"off": _off.duplicate(), "pelvis": _pelvis}
	if absf(_pelvis) < 0.001 and absf(_off[0]) < 0.001 and absf(_off[1]) < 0.001:
		return
	# опустить таз (в пространстве скелета)
	var hp := s.get_bone_global_pose(_hip)
	hp.origin.y += _pelvis / sc
	s.set_bone_global_pose(_hip, hp)
	for li in _bones.size():
		var b: Array = _bones[li]
		if b[0] < 0 or b[1] < 0 or b[2] < 0:
			continue
		var foot := s.get_bone_global_pose(b[2])
		var target: Vector3 = foot.origin + Vector3.UP * ((float(_off[li]) - _pelvis) / sc)
		_solve(s, b[0], b[1], b[2], target)
		if align_feet:
			var n: Vector3 = (xf.basis.inverse() * (_nrm[li] as Vector3)).normalized()
			var f := s.get_bone_global_pose(b[2])
			var tilt := Quaternion(Vector3.UP, n)
			f.basis = Basis(tilt) * f.basis
			s.set_bone_global_pose(b[2], f)


func _exclude() -> Array:
	var p: Node = get_skeleton()
	while p and not (p is CharacterBody3D):
		p = p.get_parent()
	return [p.get_rid()] if p else []


## двухзвенная цепь: бедро a, голень b, стопа c → стопа в target (пространство скелета)
func _solve(s: Skeleton3D, a: int, b: int, c: int, target: Vector3) -> void:
	var A := s.get_bone_global_pose(a)
	var B := s.get_bone_global_pose(b)
	var C := s.get_bone_global_pose(c)
	var la := A.origin.distance_to(B.origin)
	var lb := B.origin.distance_to(C.origin)
	var at := target - A.origin
	var d := clampf(at.length(), absf(la - lb) + 0.001, la + lb - 0.001)
	var dir := at.normalized()
	# плоскость колена: текущее направление колена от линии бедро-стопа
	var ac := (C.origin - A.origin)
	var knee := B.origin - A.origin
	var pole := (knee - ac.normalized() * knee.dot(ac.normalized()))
	if pole.length() < 0.0001:
		pole = A.basis * Vector3.FORWARD
	pole = (pole - dir * pole.dot(dir)).normalized()
	var cos_a := clampf((la * la + d * d - lb * lb) / (2.0 * la * d), -1.0, 1.0)
	var new_b := A.origin + dir * (la * cos_a) + pole * (la * sqrt(1.0 - cos_a * cos_a))
	# повернуть бедро: (B − A) → (new_b − A)
	var r1 := Quaternion((B.origin - A.origin).normalized(), (new_b - A.origin).normalized())
	A.basis = Basis(r1) * A.basis
	s.set_bone_global_pose(a, A)
	# голень: после поворота бедра — заново и довести до цели
	var B2 := s.get_bone_global_pose(b)
	var C2 := s.get_bone_global_pose(c)
	var r2 := Quaternion((C2.origin - B2.origin).normalized(), (A.origin + dir * d - B2.origin).normalized())
	B2.basis = Basis(r2) * B2.basis
	s.set_bone_global_pose(b, B2)
	# стопа сохраняет мировую ориентацию из клипа
	var C3 := s.get_bone_global_pose(c)
	C3.basis = C.basis
	s.set_bone_global_pose(c, C3)
