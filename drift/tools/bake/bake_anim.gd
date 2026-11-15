extends RefCounted
## Поза скелета из клипа Tripo + выбор отрезка клипа для N кадров + «на месте» (горизонтальный дрейф
## кости-корня Hip вычитается — спрайт стоит на точке привязки). Логика «на месте» — по образцу
## bunker/core/animation/anim_set.gd (_strip_root/_loop_fix), но поправка считается в пространстве модели
## для каждого кадра отдельно (исходный клип не меняется).

const RATE := 30.0 # частота выборки для анализа клипов, Гц
const SKIP_BONES := ["Pinky", "Ring", "Mid", "Index", "Thumb", "Twist", "Eye", "Facial", "ShareBone"]

var skel: Skeleton3D
var model: Node3D
var m_skel: Transform3D # скелет → пространство модели
var hip := -1
var main_bones: PackedInt32Array = []
var _track_cache := {}


func _init(s: Skeleton3D, m: Node3D) -> void:
	skel = s
	model = m
	m_skel = Transform3D.IDENTITY
	var cur: Node = skel
	while cur != null and cur != model:
		if cur is Node3D:
			m_skel = (cur as Node3D).transform * m_skel
		cur = cur.get_parent()
	for nm in ["Hip", "Hips", "hip", "hips", "Pelvis", "pelvis"]:
		hip = skel.find_bone(nm)
		if hip >= 0:
			break
	if hip < 0:
		hip = 0
	for b in skel.get_bone_count():
		var n := skel.get_bone_name(b)
		var skip := false
		for sb in SKIP_BONES:
			if n.contains(sb):
				skip = true
				break
		if not skip:
			main_bones.append(b)


## дорожки клипа → [индекс дорожки, тип, кость] (пути переносятся на наш скелет по имени кости)
func tracks(a: Animation) -> Array:
	if _track_cache.has(a):
		return _track_cache[a]
	var out := []
	for i in a.get_track_count():
		var tp := a.track_get_type(i)
		if tp != Animation.TYPE_POSITION_3D and tp != Animation.TYPE_ROTATION_3D:
			continue
		var p := String(a.track_get_path(i))
		var colon := p.rfind(":")
		if colon < 0:
			continue
		var bi := skel.find_bone(p.substr(colon + 1))
		if bi < 0:
			continue
		out.append([i, tp, bi])
	_track_cache[a] = out
	return out


func _local(a: Animation, t: float, bi: int) -> Transform3D:
	var rest := skel.get_bone_rest(bi)
	var q := rest.basis.get_rotation_quaternion()
	var p := rest.origin
	var sc := rest.basis.get_scale()
	for tr in tracks(a):
		if tr[2] != bi:
			continue
		if tr[1] == Animation.TYPE_POSITION_3D:
			p = a.position_track_interpolate(tr[0], t)
		else:
			q = a.rotation_track_interpolate(tr[0], t)
	return Transform3D(Basis(q).scaled(sc), p)


func _global(a: Animation, t: float, bi: int) -> Transform3D:
	var tr := _local(a, t, bi)
	var par := skel.get_bone_parent(bi)
	while par >= 0:
		tr = _local(a, t, par) * tr
		par = skel.get_bone_parent(par)
	return tr


## положение корня (Hip) в пространстве модели
func hip_pos(a: Animation, t: float) -> Vector3:
	return m_skel * _global(a, t, hip).origin


static func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0, v.z)


## «вперёд» модели — по направлению движения в клипе ходьбы
func forward_from_walk(a: Animation) -> Vector3:
	var d := _flat(hip_pos(a, a.length) - hip_pos(a, 0.0))
	return d.normalized() if d.length() > 0.05 * _model_scale() else Vector3.ZERO


## запасной способ: глаза впереди головы
func forward_from_eyes() -> Vector3:
	var h := skel.find_bone("Head")
	var l := skel.find_bone("L_Eye")
	var r := skel.find_bone("R_Eye")
	if h < 0 or l < 0 or r < 0:
		return Vector3.ZERO
	var eyes := (skel.get_bone_global_rest(l).origin + skel.get_bone_global_rest(r).origin) * 0.5
	var d := _flat(m_skel.basis * (eyes - skel.get_bone_global_rest(h).origin))
	return d.normalized() if d.length() > 0.0001 else Vector3.ZERO


func _model_scale() -> float:
	var hp := m_skel * skel.get_bone_global_rest(hip).origin
	return maxf(absf(hp.y), 0.01)


# ---------------------------------------------------------------- анализ клипа

## повороты основных костей с частотой RATE
func _sample_rots(a: Animation) -> Array:
	var n := int(floor(a.length * RATE)) + 1
	var trs := tracks(a)
	var rot_tracks := []
	for b in main_bones:
		for tr in trs:
			if tr[2] == b and tr[1] == Animation.TYPE_ROTATION_3D:
				rot_tracks.append(tr[0])
				break
	var out := []
	for k in n:
		var t := minf(k / RATE, a.length)
		var row := []
		for ti in rot_tracks:
			row.append(a.rotation_track_interpolate(ti, t))
		out.append(row)
	return out


static func _dist(r1: Array, r2: Array) -> float:
	var s := 0.0
	for j in r1.size():
		var d := absf((r1[j] as Quaternion).dot(r2[j]))
		s += 2.0 * acos(clampf(d, 0.0, 1.0))
	return s


## самый «склеивающийся» отрезок длиной [wmin; wmax] (для стойки: начало ≈ конец, движения поменьше)
func _best_loop_window(R: Array, wmin: float, wmax: float) -> Vector2:
	var n := R.size()
	var kmin := int(wmin * RATE)
	var kmax := mini(int(wmax * RATE), n - 1)
	if kmin >= n - 1:
		return Vector2(0, (n - 1) / RATE)
	var best := INF
	var bw := Vector2(0, (n - 1) / RATE)
	for k0 in range(0, n - kmin, 2):
		var spread := 0.0
		var row := PackedFloat32Array()
		for k in range(k0, mini(k0 + kmax, n - 1) + 1):
			var d := _dist(R[k0], R[k])
			row.append(d)
		for w in range(kmin, mini(kmax, n - 1 - k0) + 1):
			spread = 0.0
			for j in range(0, w + 1, 3):
				spread = maxf(spread, row[j])
			var score := row[w] + 0.1 * spread
			if score < best:
				best = score
				bw = Vector2(k0 / RATE, (k0 + w) / RATE)
	return bw


## период цикла шага (полный цикл: левая + правая нога) и лучшее начало
func _gait_cycle(R: Array, pmin: float, pmax: float) -> Vector2:
	var n := R.size()
	var kmin := int(pmin * RATE)
	var kmax := mini(int(pmax * RATE), n - 1)
	var D := {}
	var dmin := INF
	for p in range(kmin, kmax + 1):
		var s := 0.0
		var c := 0
		for k in range(0, n - p):
			s += _dist(R[k], R[k + p])
			c += 1
		D[p] = s / maxf(c, 1)
		dmin = minf(dmin, D[p])
	var period := kmax
	for p in range(kmin, kmax + 1):
		var left: float = D.get(p - 1, INF)
		var right: float = D.get(p + 1, INF)
		if D[p] <= left and D[p] <= right and D[p] <= dmin * 1.3 + 0.02:
			period = p
			break
	var best := INF
	var k0 := 0
	for k in range(0, n - period):
		var d := _dist(R[k], R[k + period])
		if d < best:
			best = d
			k0 = k
	return Vector2(k0 / RATE, (k0 + period) / RATE)


## активная часть клипа (обрезаются неподвижные начало и конец)
func _active_window(R: Array, hold: bool) -> Vector2:
	var n := R.size()
	if n < 3:
		return Vector2(0, (n - 1) / RATE)
	var sp := PackedFloat32Array()
	var mx := 0.0
	for k in n - 1:
		var v := _dist(R[k], R[k + 1]) * RATE
		sp.append(v)
		mx = maxf(mx, v)
	var thr := 0.12 * mx
	var thr_end := (0.04 if hold else 0.12) * mx
	var a := 0
	while a < n - 2 and sp[a] < thr:
		a += 1
	var b := n - 2
	while b > a and sp[b] < thr_end:
		b -= 1
	a = maxi(0, a - 3)
	b = mini(n - 1, b + 4)
	return Vector2(a / RATE, b / RATE)


## план кадров: моменты времени, поправка корня (пространство модели), поправка стыка цикла
func plan_clip(a: Animation, c: Dictionary, src_name := "") -> Dictionary:
	var frames: int = c.get("frames", 8)
	var loop: bool = c.get("loop", false)
	var mode: String = c.get("mode", "cycle" if loop else "active")
	var win := Vector2(0, a.length)
	# cut: {"клип": [от, до]} — для конкретного источника; 0 в «до» — автоматически
	var cut: Array = (c.get("cut", {}) as Dictionary).get(src_name, [])
	if c.has("from") or c.has("to"):
		win = Vector2(float(c.get("from", 0.0)), float(c.get("to", a.length)))
	else:
		var R := _sample_rots(a)
		var k0 := 0
		if cut.size() > 0 and float(cut[0]) > 0.0:
			k0 = mini(int(float(cut[0]) * RATE), R.size() - 2)
			R = R.slice(k0)
		match mode:
			"idle":
				win = _best_loop_window(R, float(c.get("min", 1.6)), float(c.get("max", 3.2)))
			"cycle":
				win = _gait_cycle(R, float(c.get("min", 0.35)), float(c.get("max", 2.0)))
			"active":
				win = _active_window(R, c.get("hold", false))
			_:
				win = Vector2(0, (R.size() - 1) / RATE)
		win += Vector2.ONE * (k0 / RATE)
		if cut.size() > 1 and float(cut[1]) > 0.0:
			win.y = float(cut[1])
	win.y = minf(win.y, a.length)
	return _make_plan(a, win.x, win.y, frames, loop, String(c.get("root", "line")))


## равномерно по всему отрезку (превью)
func plan_uniform(a: Animation, t0: float, t1: float, n: int) -> Dictionary:
	return _make_plan(a, t0, t1, n, false)


func _make_plan(a: Animation, t0: float, t1: float, frames: int, loop: bool, root := "line") -> Dictionary:
	var times := PackedFloat32Array()
	for i in frames:
		if loop:
			times.append(t0 + (t1 - t0) * i / frames)
		else:
			times.append(t0 + (t1 - t0) * i / maxf(frames - 1, 1))
	var h0 := _flat(hip_pos(a, t0))
	var h1 := _flat(hip_pos(a, t1))
	var corr := []
	var speed := 0.0
	if loop:
		var T := maxf(t1 - t0, 0.001)
		var resid := []
		var mean := Vector3.ZERO
		for t in times:
			var lin := h0 + (h1 - h0) * ((t - t0) / T)
			var r := _flat(hip_pos(a, t)) - lin
			resid.append(lin)
			mean += r
		mean /= frames
		for i in frames:
			corr.append((resid[i] as Vector3) + mean)
		speed = (h1 - h0).length() / T
	elif root == "lock":
		# корень всё время над точкой привязки (удар/выстрел: тело не уходит из кадра)
		for t in times:
			corr.append(_flat(hip_pos(a, t)))
	else:
		# дрейф от начала к концу вычитается линейно: первый и последний кадр — над точкой привязки
		var T := maxf(t1 - t0, 0.001)
		for t in times:
			corr.append(h0 + (h1 - h0) * ((t - t0) / T))
	# стык цикла: поворот каждой кости в конце отрезка доводится до позы начала (поправка растёт линейно)
	var fix := {}
	if loop:
		for tr in tracks(a):
			if tr[1] == Animation.TYPE_ROTATION_3D:
				var q0: Quaternion = a.rotation_track_interpolate(tr[0], t0)
				var q1: Quaternion = a.rotation_track_interpolate(tr[0], t1)
				fix[tr[0]] = (q0 * q1.inverse()).normalized()
			elif tr[2] == hip:
				var p0: Vector3 = a.position_track_interpolate(tr[0], t0)
				var p1: Vector3 = a.position_track_interpolate(tr[0], t1)
				fix[tr[0]] = p0 - p1 # только вертикаль (горизонталь — поправка корня)
	return {"anim": a, "times": times, "corr": corr, "fix": fix, "t0": t0, "t1": t1, "speed": speed, "loop": loop}


## поставить позу кадра i плана
func apply(plan: Dictionary, i: int) -> void:
	var a: Animation = plan.anim
	var t: float = plan.times[i]
	var frac: float = float(i) / plan.times.size() if plan.loop else 0.0
	var fix: Dictionary = plan.fix
	skel.reset_bone_poses()
	for tr in tracks(a):
		if tr[1] == Animation.TYPE_POSITION_3D:
			var p: Vector3 = a.position_track_interpolate(tr[0], t)
			if fix.has(tr[0]):
				var up := (m_skel.basis * _global(a, t, skel.get_bone_parent(hip)).basis).inverse() * Vector3.UP if skel.get_bone_parent(hip) >= 0 else m_skel.basis.inverse() * Vector3.UP
				up = up.normalized()
				var dv: Vector3 = fix[tr[0]]
				p += up * dv.dot(up) * frac
			skel.set_bone_pose_position(tr[2], p)
		else:
			var q: Quaternion = a.rotation_track_interpolate(tr[0], t)
			if fix.has(tr[0]):
				q = (Quaternion.IDENTITY.slerp(fix[tr[0]], frac) * q).normalized()
			skel.set_bone_pose_rotation(tr[2], q)
	# корень — на месте
	var c: Vector3 = plan.corr[i]
	var par := skel.get_bone_parent(hip)
	var pb := m_skel.basis
	if par >= 0:
		pb = m_skel.basis * _global(a, t, par).basis
	var dl := pb.inverse() * c
	skel.set_bone_pose_position(hip, skel.get_bone_pose_position(hip) - dl)
