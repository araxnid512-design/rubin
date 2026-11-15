class_name BCWeaponHold
extends SkeletonModifier3D
## Хват оружия. Оружие не «приклеено» к кисти, а стоит в позе относительно груди (стойка: прицел, наготове,
## бег), и обе руки тянутся к нему обратной кинематикой: правая — к рукояти, левая — к цевью (у пистолета —
## поддерживает правую). Пальцы сгибаются вокруг рукояти, указательный — у спуска. Клип тела даёт ноги, корпус
## и голову; руки всегда держат оружие правильно, с любым клипом. Отдача и перезарядка — движением самого оружия
## и левой руки. Холодное оружие (mode "hand") идёт за кистью из клипа, пальцы сжаты в кулак на рукояти.
## Описание оружия и стоек — data/weapons.json. Все расчёты — в системе скелета (единицы модели, k = ед./м).

const CFG := "res://data/weapons.json"
static var _all := {}

var k := 1.0                      ## единиц скелета в метре
var fwd := Vector3.RIGHT          ## «вперёд» персонажа в системе скелета
var upv := Vector3.UP
var rgt := Vector3.BACK
var wid := ""
var w := {}
var node: Node3D = null           ## модель оружия (ребёнок скелета)
var stance := "ready"
var ik_on := true                 ## false — «как было»: оружие приклеено к кисти, руки из клипа
var err_r := 0.0                  ## ладонь — рукоять после IK, м (для проверки)
var err_l := 0.0
var aim_dev := 0.0                ## отклонение ствола от «вперёд» в стойке прицела, град
var hand_r := Vector3.ZERO        ## запястья после IK, в системе скелета (вне расчёта скелет отдаёт позу клипа)
var hand_l := Vector3.ZERO
var two_hands := false
var _hf := {}
var _cur := Transform3D.IDENTITY
var _has_cur := false
var _twist := 0.0
var _follow := 1.0
var _recoil_t := 99.0
var _reload_t := -1.0
var _move := ""                   ## идущий удар холодным оружием
var _move_t := 0.0
var _sc := Vector3.ZERO           ## середина плеч в позе покоя
var _chest := -1
var _sp := [-1, -1]
var _wscale := 1.0


static func config() -> Dictionary:
	if _all.is_empty():
		_all = JSON.parse_string(FileAccess.get_file_as_string(CFG))
	return _all


func setup(units_per_m: float, forward: Vector3) -> void:
	k = units_per_m
	fwd = forward.normalized()
	rgt = fwd.cross(upv).normalized()
	var s := get_skeleton()
	_chest = s.find_bone("Spine02")
	_sp = [s.find_bone("Spine01"), s.find_bone("Spine02")]
	_sc = (s.get_bone_global_rest(s.find_bone("L_Upperarm")).origin + s.get_bone_global_rest(s.find_bone("R_Upperarm")).origin) * 0.5
	for side in ["R", "L"]:
		_hf[side] = _hand_frame(s, side)


## оси кисти в позе покоя: F — к пальцам, A — от мизинца к указательному, P — из ладони
func _hand_frame(s: Skeleton3D, side: String) -> Dictionary:
	var h := s.find_bone(side + "_Hand")
	var G := s.get_bone_global_rest(h)
	var o := func(n: String) -> Vector3: return s.get_bone_global_rest(s.find_bone(side + "_" + n)).origin
	var mid: Vector3 = o.call("Mid1")
	var F := (mid - G.origin).normalized()
	var A: Vector3 = o.call("Index1") - o.call("Pinky1")
	A = (A - F * A.dot(F)).normalized()
	var P := A.cross(F)
	var curl: Vector3 = o.call("Mid3") - mid
	if absf(P.dot(curl)) > 0.0005:
		if P.dot(curl) < 0.0:
			P = -P
	elif P.y > 0.0:
		P = -P                                  # Т-поза: ладони вниз
	var psign := 1.0 if P.dot(A.cross(F)) > 0.0 else -1.0
	var inv := G.basis.orthonormalized().inverse()
	var d := {"side": side, "hand": h, "arm": s.find_bone(side + "_Upperarm"), "fore": s.find_bone(side + "_Forearm"),
		"tw": [s.find_bone(side + "_ForearmTwist01"), s.find_bone(side + "_ForearmTwist02")],
		"psign": psign, "local_inv": Basis(inv * F, inv * A, inv * P).inverse(),
		"palm_l": G.affine_inverse() * G.origin.lerp(mid, 0.6), "fingers": {}, "axes": {}}
	# сгиб пальцев — вокруг линии костяшек (A), к ладони; большой — сначала поворот к пальцам (вокруг P)
	var ax := A * psign
	for f in ["Index", "Mid", "Ring", "Pinky"]:
		var bones := []
		var axes := []
		for j in [1, 2, 3]:
			var b := s.find_bone("%s_%s%d" % [side, f, j])
			bones.append(b)
			axes.append((s.get_bone_global_rest(b).basis.orthonormalized().inverse() * ax).normalized() if b >= 0 else Vector3.RIGHT)
		d.fingers[f] = bones
		d.axes[f] = axes
	var tb := []
	var ta := []
	for j in [1, 2, 3]:
		var b := s.find_bone("%s_Thumb%d" % [side, j])
		tb.append(b)
		var Bi := s.get_bone_global_rest(b).basis.orthonormalized().inverse() if b >= 0 else Basis.IDENTITY
		ta.append([(Bi * (P * psign)).normalized(), (Bi * (F * -psign)).normalized()])
	d.fingers["Thumb"] = tb
	d.axes["Thumb"] = ta
	return d


## взять оружие ("" — убрать)
func equip(id: String) -> void:
	if node:
		node.queue_free()
		node = null
	wid = id
	err_r = 0.0
	err_l = 0.0
	aim_dev = 0.0
	_has_cur = false
	_reload_t = -1.0
	if id == "":
		w = {}
		return
	w = config()[id]
	node = Node3D.new()
	node.name = "Weapon"
	var m: Node3D = (load(w.model) as PackedScene).instantiate()
	node.add_child(m)
	get_skeleton().add_child(node)
	_wscale = float(w.len_m) / float(w.model_len) * k
	_move = ""
	if not w.stances.has(stance):
		stance = w.stances.keys()[0]


func set_stance(st: String) -> void:
	if wid != "" and w.stances.has(st):
		stance = st


## удар холодным оружием (light / heavy / block); возвращает длительность
func swing(kind: String) -> float:
	if wid == "" or not w.get("moves", {}).has(kind):
		return 0.0
	_move = kind
	_move_t = 0.0
	return float(w.moves[kind].len)


func fire() -> void:
	_recoil_t = 0.0


func reload() -> float:
	if wid == "" or w.mode == "melee":
		return 0.0
	_reload_t = 0.0
	return _reload_len()


func _reload_len() -> float:
	return 2.4 if w.mode == "rifle" else 1.9


func busy() -> bool:
	return _reload_t >= 0.0 or _move != ""


func _pt(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2]) * _wscale


func _v(a: Array) -> Vector3:
	return fwd * float(a[0]) + upv * float(a[1]) + rgt * float(a[2])


## поза оружия для стойки — в системе покоя скелета (без масштаба)
func _stance_pose(st: Dictionary) -> Transform3D:
	return _pose_at(_v(st.pos), _v(st.dir), float(st.get("roll", 0.0)), String(st.anchor))


func _pose_at(pos_m: Vector3, dir: Vector3, roll_deg: float, anchor_pt: String) -> Transform3D:
	var f := dir.normalized()
	var u := upv - f * upv.dot(f)
	u = u.normalized() if u.length() > 0.05 else (-fwd - f * (-fwd).dot(f)).normalized()
	u = u.rotated(f, deg_to_rad(roll_deg))
	var B := Basis(f.cross(u), u, -f)
	var anchor: Vector3 = _sc + pos_m * k
	return Transform3D(B, anchor - B * _pt(w[anchor_pt]))


## поза оружия и разворот корпуса в ударе: между ключами — плавно, сам удар — быстрее замаха
func _move_pose() -> Array:
	var mv: Dictionary = w.moves[_move]
	var x := clampf(_move_t / float(mv.len), 0.0, 1.0)
	var keys: Array = mv.keys
	for i in range(keys.size() - 1):
		var a: Array = keys[i]
		var b: Array = keys[i + 1]
		if x <= float(b[0]) or i == keys.size() - 2:
			var u := clampf((x - float(a[0])) / maxf(float(b[0]) - float(a[0]), 0.001), 0.0, 1.0)
			u = u * u * (3.0 - 2.0 * u)
			var da := _v(a[2]).normalized()
			var db := _v(b[2]).normalized()
			return [_pose_at(_v(a[1]).lerp(_v(b[1]), u), da.slerp(db, u), 0.0, "grip"), lerpf(float(a[3]), float(b[3]), u)]
	return [_stance_pose(w.stances[stance]), 0.0]


func _process_modification_with_delta(delta: float) -> void:
	if wid == "" or node == null:
		return
	var s := get_skeleton()
	_recoil_t += delta
	if not ik_on:
		_hand_driven(s)
		return
	var st: Dictionary = w.stances[stance]
	var tgt := _stance_pose(st)
	var tw_t := float(st.get("twist", 0.0))
	var a := 1.0 - exp(-delta * 9.0)
	if _move != "":
		_move_t += delta
		var mp := _move_pose()
		tgt = mp[0]
		tw_t = mp[1]
		a = 1.0 - exp(-delta * 40.0)
		if _move_t >= float(w.moves[_move].len):
			_move = ""
	if not _has_cur:
		_cur = tgt
		_has_cur = true
		_twist = tw_t
		_follow = float(st.get("follow", 1.0))
		a = 1.0
	_cur = _cur.interpolate_with(tgt, a)
	_twist = lerpf(_twist, tw_t, a)
	_follow = lerpf(_follow, float(st.get("follow", 1.0)), a)
	var pose := _cur
	var grip := _pt(w.grip)
	# перезарядка: оружие ближе к груди и на боку; отдача: назад и ствол вверх (вокруг рукояти)
	var rl := -1.0
	if _reload_t >= 0.0:
		_reload_t += delta
		rl = _reload_t / _reload_len()
		if rl >= 1.0:
			_reload_t = -1.0
			rl = -1.0
	if rl >= 0.0:
		var e := smoothstep(0.0, 0.18, rl) * (1.0 - smoothstep(0.82, 1.0, rl))
		var roll := deg_to_rad(-32.0 if w.mode == "rifle" else -40.0) * e
		var pitch := deg_to_rad(10.0 if w.mode == "rifle" else 28.0) * e
		pose = pose * _about(grip, Basis(Vector3.BACK, roll) * Basis(Vector3.RIGHT, pitch))
		pose.origin += (-fwd * (0.05 if w.mode == "rifle" else 0.14) + upv * (-0.02 if w.mode == "rifle" else -0.06)) * k * e
	var rc: Dictionary = w.get("recoil", {})
	if not rc.is_empty() and _recoil_t < float(rc.time) * 4.0:
		var x := _recoil_t / (float(rc.time) * 0.25)
		var r := x * exp(1.0 - x)
		pose = pose * _about(grip, Basis(Vector3.RIGHT, deg_to_rad(float(rc.pitch)) * r))
		pose.origin += pose.basis.z * (float(rc.back) * k * r)
	# оружие следует за грудью (наклоны и покачивание из клипа), в прицеле — частично
	var Gc := s.get_bone_global_pose(_chest)
	var Gr := s.get_bone_global_rest(_chest)
	var T1 := Gc * Gr.affine_inverse()
	var T0 := Transform3D(Basis.IDENTITY, Gc.origin - Gr.origin)
	var W := T0.interpolate_with(T1.orthonormalized(), _follow) * pose
	# разворот корпуса (левое плечо вперёд), чтобы левая рука доставала до цевья
	if absf(_twist) > 0.5:
		for b in _sp:
			var G := s.get_bone_global_pose(b)
			G.basis = Basis(upv, -deg_to_rad(_twist) * 0.5) * G.basis
			s.set_bone_global_pose(b, G)
	var wf := -W.basis.z
	var wu := W.basis.y
	var wr := W.basis.x
	# --- правая рука: рукоять (у холодного оружия клинок выходит из кулака со стороны большого пальца) ---
	var rake := deg_to_rad(float(w.get("grip_rake", 0.0)))
	var Ar := (wu * cos(rake) + wf * sin(rake)).normalized()
	if w.mode == "melee":
		Ar = wf
	var gh := (float(w.grip_half) + 0.012) * k
	var tr := _target("R", W * grip + wr * gh, Ar, -wr)
	var lack := _lack(s, "R", tr[0])
	if lack > 0.0:
		# не достаёт — оружие ближе к плечу
		var sh := s.get_bone_global_pose(_hf.R.arm).origin
		W.origin += (sh - tr[0]).normalized() * lack
		tr = _target("R", W * grip + wr * gh, Ar, -wr)
	# --- левая рука ---
	var tl := []
	if not st.get("one", false):
		if w.mode == "rifle":
			var roll := deg_to_rad(float(w.get("fore_roll", 0.0)))
			var Pl := (wu * cos(roll) + wr * sin(roll)).normalized()
			var off := (float(w.get("fore_half", 0.02)) + 0.012) * k
			var p0 := _pt(w.fore)
			var p1 := _pt(w.get("fore_min", w.fore))
			for i in 7:
				tl = _target("L", W * p0.lerp(p1, i / 6.0) - Pl * off, wf, Pl)
				if _lack(s, "L", tl[0]) <= 0.0:
					break
			if rl >= 0.0:
				tl = _reload_hand(s, W, rl, tl, Pl)
		else:
			# пистолет: левая ладонь закрывает пальцы правой, кисть наклонена вперёд
			var Al := (wu * cos(deg_to_rad(38.0)) + wf * sin(deg_to_rad(38.0))).normalized()
			var pl := W * grip - wr * ((float(w.grip_half) + 0.036) * k) + wf * (0.012 * k) - wu * (0.014 * k)
			tl = _target("L", pl, Al, wr)
			if rl >= 0.0:
				tl = _reload_hand(s, W, rl, tl, wr)
	err_r = _arm(s, "R", tr[0], tr[1], -upv + rgt * 0.55 - fwd * 0.1) / k
	err_l = 0.0
	hand_r = tr[0]
	two_hands = not tl.is_empty()
	if two_hands:
		hand_l = tl[0]
	if not tl.is_empty():
		err_l = _arm(s, "L", tl[0], tl[1], -upv - rgt * 0.45 - fwd * 0.1) / k
		_curl(s, "L", "wrap" if w.mode == "rifle" else "support")
	_curl(s, "R", "fist" if w.mode == "melee" else "trigger")
	aim_dev = rad_to_deg(wf.angle_to(fwd)) if stance == "aim" else 0.0
	node.transform = Transform3D(W.basis.scaled(Vector3.ONE * _wscale), W.origin)


func _about(p: Vector3, B: Basis) -> Transform3D:
	return Transform3D(B, p - B * p)


## куда поставить запястье и как повернуть кисть, чтобы ладонь была в точке palm: A — от мизинца к указательному,
## P — из ладони
func _target(side: String, palm: Vector3, A: Vector3, P: Vector3) -> Array:
	var hf: Dictionary = _hf[side]
	P = (P - A * P.dot(A)).normalized()
	var F := P.cross(A) * float(hf.psign)
	var H := Basis(F, A, P) * (hf.local_inv as Basis)
	return [palm - H * (hf.palm_l as Vector3), H, palm]


## насколько запястье дальше, чем достаёт рука (0 — достаёт), ед. скелета
func _lack(s: Skeleton3D, side: String, wrist: Vector3) -> float:
	var hf: Dictionary = _hf[side]
	var A := s.get_bone_global_pose(hf.arm).origin
	var L := A.distance_to(s.get_bone_global_pose(hf.fore).origin) + s.get_bone_global_pose(hf.fore).origin.distance_to(s.get_bone_global_pose(hf.hand).origin)
	return maxf(0.0, A.distance_to(wrist) - L * 0.985)


## двухзвенный IK руки: запястье в точку, локоть — в сторону pole, кисть — в ориентацию H; возвращает промах ладони
func _arm(s: Skeleton3D, side: String, wrist: Vector3, H: Basis, pole: Vector3) -> float:
	var hf: Dictionary = _hf[side]
	var a: int = hf.arm
	var b: int = hf.fore
	var c: int = hf.hand
	var A := s.get_bone_global_pose(a)
	var B := s.get_bone_global_pose(b)
	var C := s.get_bone_global_pose(c)
	var la := A.origin.distance_to(B.origin)
	var lb := B.origin.distance_to(C.origin)
	var at := wrist - A.origin
	var d := clampf(at.length(), absf(la - lb) + 0.001, la + lb - 0.0005)
	var dir := at.normalized()
	pole = pole - dir * pole.dot(dir)
	pole = pole.normalized() if pole.length() > 0.001 else Vector3.DOWN
	var cos_a := clampf((la * la + d * d - lb * lb) / (2.0 * la * d), -1.0, 1.0)
	var nb := A.origin + dir * (la * cos_a) + pole * (la * sqrt(1.0 - cos_a * cos_a))
	A.basis = Basis(Quaternion((B.origin - A.origin).normalized(), (nb - A.origin).normalized())) * A.basis
	s.set_bone_global_pose(a, A)
	var B2 := s.get_bone_global_pose(b)
	var C2 := s.get_bone_global_pose(c)
	B2.basis = Basis(Quaternion((C2.origin - B2.origin).normalized(), (A.origin + dir * d - B2.origin).normalized())) * B2.basis
	s.set_bone_global_pose(b, B2)
	# поворот кисти вокруг предплечья распределяется по костям скручивания (иначе запястье «перекручено»)
	var C3 := s.get_bone_global_pose(c)
	var axis := (C3.origin - B2.origin).normalized()
	var expect := B2.basis * (s.get_bone_global_rest(b).basis.inverse() * s.get_bone_global_rest(c).basis)
	var dq := Quaternion((H * expect.inverse()).orthonormalized())
	var proj := Vector3(dq.x, dq.y, dq.z).dot(axis)
	var twist := 2.0 * atan2(proj, dq.w)
	if twist > PI:
		twist -= TAU
	elif twist < -PI:
		twist += TAU
	var tw: Array = hf.tw
	for i in 2:
		if int(tw[i]) >= 0:
			var T := s.get_bone_global_pose(tw[i])
			var rest_rel := s.get_bone_global_rest(b).basis.inverse() * s.get_bone_global_rest(tw[i]).basis
			T.basis = Basis(axis, twist * (0.45 if i == 0 else 0.9)) * (B2.basis * rest_rel)
			s.set_bone_global_pose(tw[i], T)
	C3 = s.get_bone_global_pose(c)
	C3.basis = H.scaled(C.basis.get_scale())
	s.set_bone_global_pose(c, C3)
	return (C3.origin).distance_to(wrist)


## позы пальцев: trigger — рукоять, указательный у спуска; wrap — обхват цевья; support — поверх пальцев правой;
## fist — кулак на рукояти
const CURL := {
	"trigger": {"Index": [18, 42, 22], "Mid": [62, 78, 38], "Ring": [66, 80, 40], "Pinky": [70, 82, 40], "Thumb": [58, 30, 12]},
	"wrap": {"Index": [38, 52, 30], "Mid": [42, 56, 32], "Ring": [44, 58, 32], "Pinky": [46, 60, 32], "Thumb": [8, 24, 10]},
	"support": {"Index": [50, 62, 30], "Mid": [54, 66, 32], "Ring": [56, 68, 32], "Pinky": [58, 70, 32], "Thumb": [55, 14, 8]},
	"fist": {"Index": [64, 82, 40], "Mid": [66, 84, 40], "Ring": [68, 84, 40], "Pinky": [70, 84, 40], "Thumb": [48, 46, 22]},
}


func _curl(s: Skeleton3D, side: String, pose: String) -> void:
	var hf: Dictionary = _hf[side]
	var c: Dictionary = CURL[pose]
	for f in ["Index", "Mid", "Ring", "Pinky"]:
		for j in 3:
			var b: int = hf.fingers[f][j]
			if b >= 0:
				s.set_bone_pose_rotation(b, s.get_bone_rest(b).basis.get_rotation_quaternion() * Quaternion(hf.axes[f][j], deg_to_rad(float(c[f][j]))))
	var t: Array = c.Thumb
	var tb: Array = hf.fingers.Thumb
	var ta: Array = hf.axes.Thumb
	if int(tb[0]) >= 0:
		# большой палец: к пальцам (вокруг P) и внутрь ладони (вокруг F)
		s.set_bone_pose_rotation(tb[0], s.get_bone_rest(tb[0]).basis.get_rotation_quaternion() * Quaternion(ta[0][0], deg_to_rad(float(t[0]))) * Quaternion(ta[0][1], deg_to_rad(float(t[1]))))
	for j in [1, 2]:
		if int(tb[j]) >= 0:
			s.set_bone_pose_rotation(tb[j], s.get_bone_rest(tb[j]).basis.get_rotation_quaternion() * Quaternion(ta[j][1], deg_to_rad(float(t[2]))))


## левая рука при перезарядке: цевьё → магазин → пояс → магазин → цевьё
func _reload_hand(s: Skeleton3D, W: Transform3D, rl: float, base: Array, Pl: Vector3) -> Array:
	var wu := W.basis.y
	var wf := -W.basis.z
	var mag := W * _pt(w.mag) - wu * (0.03 * k)
	var mag_low := mag - wu * (0.09 * k)
	var hip := s.get_bone_global_pose(s.find_bone("Hip")).origin
	var belt := hip + (fwd * 0.16 - rgt * 0.17 + upv * 0.06) * k
	var keys := [[0.0, base[2]], [0.16, mag], [0.26, mag_low], [0.46, belt], [0.56, belt], [0.74, mag_low], [0.82, mag], [0.88, mag], [1.0, base[2]]]
	var p: Vector3 = base[2]
	for i in range(keys.size() - 1):
		if rl >= float(keys[i][0]) and rl <= float(keys[i + 1][0]):
			var u := smoothstep(0.0, 1.0, (rl - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.001))
			p = (keys[i][1] as Vector3).lerp(keys[i + 1][1], u)
			break
	# у магазина ладонь смотрит вверх (магазин вставляется снизу)
	var e := smoothstep(0.0, 0.14, rl) * (1.0 - smoothstep(0.88, 1.0, rl))
	var P := Pl.slerp(wu, e * 0.8).normalized() if Pl.angle_to(wu) > 0.01 else Pl
	var A: Vector3 = wf if w.mode == "rifle" else (wu * 0.6 + wf * 0.8).normalized()
	return _target("L", p, A, P)


## «как было» и холодное оружие: оружие — в кисти из клипа
func _hand_driven(s: Skeleton3D) -> void:
	var hf: Dictionary = _hf.R
	var G := s.get_bone_global_pose(hf.hand)
	var Bh := G.basis.orthonormalized()
	var L: Basis = (hf.local_inv as Basis).inverse()         # столбцы: F, A, P в системе кисти
	var F := Bh * L.x
	var A := Bh * L.y
	var P := Bh * L.z
	var palm := G * (hf.palm_l as Vector3) + P * ((float(w.grip_half) + 0.012) * k)
	var B: Basis
	if w.mode == "melee":
		# рукоять в кулаке вдоль линии костяшек, клинок — со стороны большого пальца, лезвие — вперёд от кулака
		B = Basis((-F).cross(-A), -F, -A)
		_curl(s, "R", "fist")
	else:
		B = Basis(F.cross(A), A, -F)
	B = B.orthonormalized()
	node.transform = Transform3D(B.scaled(Vector3.ONE * _wscale), palm - B * _pt(w.grip))
	hand_r = G.origin
	two_hands = false
	err_r = 0.0
	err_l = 0.0
