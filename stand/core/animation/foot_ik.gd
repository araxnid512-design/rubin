class_name BCFootIK
extends SkeletonModifier3D
## Постановка стоп BunkerCore (IK для ног).
##  * Земля под стопой: луч вниз (слои «мир» и «детали»); на ступенях, склонах и камнях таз опускается к нижней
##    стопе, колени сгибаются аналитическим решением двухзвенной цепи (бедро → голень → стопа) в плоскости колена,
##    стопа наклоняется по нормали поверхности. Смещения сглаживаются, чтобы не дёргалось.
##  * Пол не проходит сквозь подошву: если клип опускает стопу ниже земли, стопа поднимается до земли.
##  * Фиксация опорной стопы (foot locking): стопа на земле и почти не едет → её место в мире запоминается, и пока
##    она в опоре, IK держит её там (клип и скорость тела могут расходиться — скольжение убирается). Стопа
##    отпускается, когда клип её поднимает, когда она уехала от точки дальше max_lock_dist (тело ушло) или когда
##    тело повернулось больше чем на max_lock_yaw; отпускание плавное (release_time).

@export var legs := [["L_Thigh", "L_Calf", "L_Foot", "L_ToeBase"], ["R_Thigh", "R_Calf", "R_Foot", "R_ToeBase"]]
@export var hip_bone := "Hip"
@export var ray_up := 0.6
@export var ray_down := 0.9
@export var max_drop := 0.45                ## насколько таз может опуститься
@export var smooth := 14.0
@export var enabled_ik := true
@export var align_feet := true
@export var lock_feet := true
@export var contact_h := 0.03               ## подошва ниже — стопа на земле, м
@export var release_h := 0.05               ## подошва выше — стопа оторвалась
@export var max_lock_dist := 0.18           ## м: стопа уже отрывается — отпустить, если клип ушёл дальше
@export var max_lock_dist_hard := 0.30      ## м: подошва ещё на полу — отпустить только дальше этого
@export var max_lock_yaw := deg_to_rad(40.0)
@export var lock_in_time := 0.06
@export var release_time := 0.14
@export_flags_3d_physics var mask := 1 | 32

var body_speed := 0.0                       ## скорость тела, м/с (задаёт BCCharacter)
@export var max_yaw_rate := 3.5             ## рад/с: быстрее — стопы не фиксируются
var _last_yaw := 0.0
var _bones := []          ## [[thigh, calf, foot, toe], ...] индексы
var _hip := -1
var _off := [0.0, 0.0]    ## сглаженные смещения стоп по высоте
var _nrm := [Vector3.UP, Vector3.UP]
var _pelvis := 0.0
var _ankle_h := [0.08, 0.08]   ## высота голеностопа над подошвой в позе покоя (ед. скелета)
var _toe_h := [0.02, 0.02]     ## высота кости пальцев над подошвой
var _lock_yaw := [0.0, 0.0]
var _lock_w := [0.0, 0.0]
var _rel_off: Array = [Vector3.ZERO, Vector3.ZERO]   ## при отпускании: поправка, которая плавно уходит в ноль
var _h_prev := [1.0, 1.0]               ## высота подошвы в прошлом кадре
var _skim := [0.0, 0.0]                 ## подъём стопы над полом, пока клип «тащит» её вперёд по полу
var _knee_fwd: Array = [Vector3.FORWARD, Vector3.FORWARD]   ## «колено вперёд» в системе бедра (из позы покоя)
var _sole: Array = [[], []]              ## точки подошвы: [[кость, точка в системе кости], ...] — пятка, подушечка, носок
var last_debug := {}
var debug := false                      ## заполнять last_debug (лаборатория); в игре — без лишних словарей
# буферы кадра — без выделения памяти в каждом кадре
var _q := PhysicsRayQueryParameters3D.new()
var _excl: Array[RID] = []
var _excl_done := false
var _want := [0.0, 0.0]
var _nrmw := [Vector3.UP, Vector3.UP]
var _ground := [0.0, 0.0]
var _lockd := [Vector3.ZERO, Vector3.ZERO]
var _pts := [[Vector3.ZERO, Vector3.ZERO, Vector3.ZERO], [Vector3.ZERO, Vector3.ZERO, Vector3.ZERO]]
var _prevp := [[Vector3.ZERO, Vector3.ZERO, Vector3.ZERO], [Vector3.ZERO, Vector3.ZERO, Vector3.ZERO]]
var _has_prev := [false, false]
var _locked := [false, false]
var _lock_p := [Vector3.ZERO, Vector3.ZERO]
var _lock_j := [0, 0]


func _skel_ready() -> void:
	var s := get_skeleton()
	if s == null:
		return
	_bones.clear()
	for L in legs:
		_bones.append([s.find_bone(L[0]), s.find_bone(L[1]), s.find_bone(L[2]), s.find_bone(L[3])])
	_hip = s.find_bone(hip_bone)
	var fl := _rest_floor(s)
	# «вперёд» модели в пространстве скелета — перпендикуляр к линии бёдер
	var Rv := s.get_bone_global_rest(_bones[1][0]).origin - s.get_bone_global_rest(_bones[0][0]).origin if _bones.size() > 1 and _bones[0][0] >= 0 and _bones[1][0] >= 0 else Vector3.BACK
	Rv.y = 0.0
	var Fv := Vector3.UP.cross(Rv.normalized()).normalized()
	for li in _bones.size():
		var b: Array = _bones[li]
		_sole[li] = []
		if b[0] >= 0 and b[1] >= 0:
			var Th := s.get_bone_global_rest(b[0])
			var dth := (s.get_bone_global_rest(b[1]).origin - Th.origin).normalized()
			var kf := (Fv - dth * Fv.dot(dth)).normalized()
			_knee_fwd[li] = Th.basis.orthonormalized().inverse() * kf
		if b[2] >= 0:
			_ankle_h[li] = maxf(0.02, s.get_bone_global_rest(b[2]).origin.y - fl)
		if b[3] >= 0:
			_toe_h[li] = maxf(0.0, s.get_bone_global_rest(b[3]).origin.y - fl)
		if b[2] >= 0 and b[3] >= 0:
			var Fr := s.get_bone_global_rest(b[2])
			var Tr := s.get_bone_global_rest(b[3])
			var a := Fr.origin
			var t := Tr.origin
			var flen := (t - a).dot(Fv)
			var heel := Vector3(a.x, fl, a.z) - Fv * flen * 0.45
			var ball := Vector3(t.x, fl, t.z)
			var toe := Vector3(t.x, fl, t.z) + Fv * flen * 0.55
			_sole[li] = [[b[2], Fr.affine_inverse() * heel], [b[2], Fr.affine_inverse() * ball], [b[3], Tr.affine_inverse() * toe]]


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
	# при интерполяции физики модель рисуется в промежуточном положении — им и считаем (иначе зафиксированная
	# стопа «дрожала» бы на величину шага физики)
	var xf := s.get_global_transform_interpolated() if s.is_physics_interpolated_and_enabled() else s.global_transform
	var root := s.get_parent_node_3d()
	var root_y := (root.get_global_transform_interpolated().origin.y if root.is_physics_interpolated_and_enabled() else root.global_position.y) if root else xf.origin.y
	var sc := xf.basis.get_scale().y
	var k := clampf(delta * smooth, 0.0, 1.0) if delta > 0.0 else 1.0
	var yaw := _yaw_of(xf)
	# быстрый поворот тела (разворот на бегу) — стопы не фиксируются: иначе ногу «выкручивает» под телом
	var yaw_rate := absf(angle_difference(_last_yaw, yaw)) / delta if delta > 0.0 else 0.0
	_last_yaw = yaw
	var spinning := yaw_rate > max_yaw_rate
	var want: Array = _want
	var nrm: Array = _nrmw
	var ground: Array = _ground
	if not _excl_done:
		_excl = _exclude()
		_excl_done = true
	for li in _bones.size():
		var b: Array = _bones[li]
		want[li] = 0.0
		nrm[li] = Vector3.UP
		ground[li] = root_y
		if b[2] < 0:
			continue
		# один луч на стопу за кадр
		var foot_w := xf * s.get_bone_global_pose(b[2]).origin
		_q.from = foot_w + Vector3.UP * ray_up
		_q.to = foot_w + Vector3.DOWN * ray_down
		_q.collision_mask = mask
		_q.exclude = _excl
		var hit := space.intersect_ray(_q)
		var g := root_y
		if not hit.is_empty():
			g = hit.position.y
			nrm[li] = hit.normal
		ground[li] = g
		# насколько земля под стопой выше/ниже уровня, на который рассчитан клип
		var w := clampf(g - root_y, -max_drop, max_drop)
		# подошва из клипа не должна уходить под свой пол: голеностоп/пальцы ниже высоты покоя — поднять
		var sole := _sole_h(s, xf, b, li) - root_y
		if sole < 0.0:
			w += -sole
		want[li] = w
	for li in 2:
		_off[li] = lerpf(_off[li], want[li], k)
		_nrm[li] = _nrm[li].lerp(nrm[li], k).normalized()
	var pel := minf(minf(_off[0], _off[1]), 0.0)
	_pelvis = lerpf(_pelvis, pel, k)
	# --- фиксация опорной стопы ---
	# опора — самая низкая из точек подошвы (пятка, «подушечка», носок); фиксируется именно она: при ударе пяткой —
	# пятка, при перекате — носок (точка опоры меняется без скачка: новая точка берёт текущую поправку).
	# Отпускается, когда вся стопа поднялась (поправка уходит уже в воздухе — без скольжения по полу).
	var lock_d: Array = _lockd     # горизонтальная поправка стопы в мире
	lock_d[0] = Vector3.ZERO
	lock_d[1] = Vector3.ZERO
	for li in _bones.size():
		var b: Array = _bones[li]
		var sol: Array = _sole[li]
		if b[2] < 0 or sol.is_empty():
			continue
		var pts: Array = _pts[li]
		for kk in 3:
			var sp: Array = sol[kk]
			pts[kk] = xf * (s.get_bone_global_pose(sp[0]) * (sp[1] as Vector3))
		var lift := float(_off[li]) - float(ground[li])
		var j := 0
		for i in 3:
			if (pts[i] as Vector3).y < (pts[j] as Vector3).y:
				j = i
		var P: Vector3 = pts[j]
		var h: float = P.y + lift
		var v := 0.0
		if _has_prev[li] and delta > 0.0:
			var pv: Vector3 = _prevp[li][j]
			v = Vector2(P.x - pv.x, P.z - pv.z).length() / delta
		for kk in 3:
			_prevp[li][kk] = pts[kk]
		_has_prev[li] = true
		if not lock_feet or delta <= 0.0:
			_locked[li] = false
			continue
		# «скольжение при приземлении»: у бега Tripo стопа касается пола ещё в переносе (летит вперёд быстрее
		# тела) и едет по полу 0.1 с — пока так, стопа приподнимается над полом и ставится, когда клип её остановит
		var skim := body_speed > 0.6 and h < contact_h + 0.02 and v > body_speed + 0.1
		_skim[li] = lerpf(_skim[li], maxf(contact_h + 0.012 - h, 0.0) if skim else 0.0, clampf(delta * 40.0, 0.0, 1.0))
		h += float(_skim[li])
		var planted := h < contact_h and v < maxf(0.4, 0.6 * body_speed) and not spinning
		# на ходу стопа фиксируется в первом же кадре касания, даже если клип ещё «тащит» её вперёд
		# (у клипов Tripo пятка касается пола на скорости 2–3 м/с — проскальзывание при ударе пяткой)
		var touchdown := h < contact_h and float(_h_prev[li]) >= contact_h and body_speed > 0.5 and not spinning and not skim
		_h_prev[li] = h
		var Pf := Vector3(P.x, 0.0, P.z)
		if not _locked[li]:
			if planted or touchdown:
				# новая фиксация продолжает текущую поправку (иначе на один кадр стопа прыгала к клипу)
				_locked[li] = true
				_lock_p[li] = Pf + (_rel_off[li] as Vector3)
				_lock_j[li] = j
				_lock_yaw[li] = yaw
				_lock_w[li] = 1.0 if (touchdown or (_rel_off[li] as Vector3).length() >= 0.001) else 0.0
				lock_d[li] = _rel_off[li]
				_rel_off[li] = Vector3.ZERO
		else:
			if int(_lock_j[li]) != j:
				# точка опоры сменилась (пятка → носок): новая точка продолжает с той же поправкой
				var prevP: Vector3 = pts[int(_lock_j[li])]
				_lock_p[li] = Pf + ((_lock_p[li] as Vector3) - Vector3(prevP.x, 0.0, prevP.z))
				_lock_j[li] = j
			var c := (_lock_p[li] as Vector3) - Pf
			var turned := absf(angle_difference(_lock_yaw[li], yaw)) > max_lock_yaw
			# далеко от клипа — отпустить, но пока подошва на полу, держать до жёсткого предела (иначе стопа
			# уезжает прямо по полу)
			var far := c.length() > (max_lock_dist_hard if h < contact_h else max_lock_dist)
			if h > release_h or far or turned or spinning:
				# отпустить: поправка плавно уходит (стопа уже в воздухе), стопа догоняет клип
				_rel_off[li] = c * _lock_w[li]
				_locked[li] = false
			else:
				_lock_w[li] = move_toward(_lock_w[li], 1.0, delta / lock_in_time)
				lock_d[li] = c * _lock_w[li]
		if not _locked[li]:
			_rel_off[li] = (_rel_off[li] as Vector3).move_toward(Vector3.ZERO, maxf((_rel_off[li] as Vector3).length(), 0.02) * delta / release_time)
			lock_d[li] = _rel_off[li]
			# стопа догоняет клип — не волоком по полу, а коротким шагом (подъём до 4 см)
			var step_up := clampf((_rel_off[li] as Vector3).length() * 0.4, 0.0, 0.04)
			_skim[li] = maxf(float(_skim[li]), step_up) if step_up > 0.005 else float(_skim[li])
	if debug:
		last_debug = {"off": _off.duplicate(), "pelvis": _pelvis, "lock": _locked.duplicate(), "lock_d": lock_d.duplicate()}
	var idle := absf(_pelvis) < 0.001 and absf(_off[0]) < 0.001 and absf(_off[1]) < 0.001 and float(_skim[0]) < 0.001 and float(_skim[1]) < 0.001 \
		and (lock_d[0] as Vector3).length() < 0.0005 and (lock_d[1] as Vector3).length() < 0.0005
	if idle:
		return
	# опустить таз (в пространстве скелета)
	var hp := s.get_bone_global_pose(_hip)
	hp.origin.y += _pelvis / sc
	s.set_bone_global_pose(_hip, hp)
	var inv := xf.basis.inverse()
	for li in _bones.size():
		var b: Array = _bones[li]
		if b[0] < 0 or b[1] < 0 or b[2] < 0:
			continue
		var foot := s.get_bone_global_pose(b[2])
		var target: Vector3 = foot.origin + Vector3.UP * ((float(_off[li]) + float(_skim[li]) - _pelvis) / sc) + inv * (lock_d[li] as Vector3)
		_solve(s, b[0], b[1], b[2], target, s.get_bone_global_pose(b[0]).basis.orthonormalized() * (_knee_fwd[li] as Vector3))
		if align_feet:
			var n: Vector3 = (inv * (_nrm[li] as Vector3)).normalized()
			var f := s.get_bone_global_pose(b[2])
			var tilt := Quaternion(Vector3.UP, n)
			f.basis = Basis(tilt) * f.basis
			s.set_bone_global_pose(b[2], f)


## высота подошвы (мир): ниже из «голеностоп − его высота в покое» и «пальцы − их высота в покое»
func _sole_h(s: Skeleton3D, xf: Transform3D, b: Array, li: int) -> float:
	var sc := xf.basis.get_scale().y
	var a := (xf * s.get_bone_global_pose(b[2]).origin).y - float(_ankle_h[li]) * sc
	if b[3] >= 0:
		a = minf(a, (xf * s.get_bone_global_pose(b[3]).origin).y - float(_toe_h[li]) * sc)
	return a


func _yaw_of(xf: Transform3D) -> float:
	var z := xf.basis.z
	return atan2(z.x, z.z)


func _exclude() -> Array[RID]:
	var p: Node = get_skeleton()
	while p and not (p is CharacterBody3D):
		p = p.get_parent()
	var out: Array[RID] = []
	if p:
		out.append(p.get_rid())
	return out


## сбросить фиксацию (телепорт, смена модели, посадка)
func reset_locks() -> void:
	_h_prev = [1.0, 1.0]
	_skim = [0.0, 0.0]
	_locked = [false, false]
	_has_prev = [false, false]
	_lock_w = [0.0, 0.0]
	_rel_off = [Vector3.ZERO, Vector3.ZERO]


## двухзвенная цепь: бедро a, голень b, стопа c → стопа в target (пространство скелета)
func _solve(s: Skeleton3D, a: int, b: int, c: int, target: Vector3, knee_fwd := Vector3.ZERO) -> void:
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
	# колено — всегда вперёд: у почти прямой ноги текущий вынос колена мал и может смотреть назад,
	# тогда IK сгибал колено в обратную сторону (переразгиб до 17°); анатомическое «вперёд» бедра важнее
	if knee_fwd != Vector3.ZERO:
		var kf := knee_fwd.normalized()
		if pole.length() < 0.02 * (A.origin.distance_to(B.origin)) or pole.dot(kf) <= 0.0:
			pole = kf
		else:
			pole = pole.normalized() + kf
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
