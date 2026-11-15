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
## суставы после IK, град: [сгиб кисти (+ к ладони, − к тыльной стороне), отведение (+ к большому пальцу,
## − к мизинцу), поворот предплечья (+ ладонью вверх, − ладонью вниз), сгиб локтя]
var joints := {"R": [0.0, 0.0, 0.0, 0.0], "L": [0.0, 0.0, 0.0, 0.0]}
var _hf := {}
var _cur := Transform3D.IDENTITY
var _has_cur := false
var _twist := 0.0
var _follow := 1.0
var _recoil_t := 99.0
var _reload_t := -1.0
var drawn := 1.0                  ## 0 — оружие убрано (кобура, ремень), 1 — в руках
var _draw_dir := 0.0
var _hip := -1
var _lock := 0.0
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
	# досягаемость руки (плечо — середина ладони) относительно «стандартного» человека 0.66 м
	_reach_k = clampf((float(_hf.R.la) + float(_hf.R.lb) + (_hf.R.palm_l as Vector3).length()) / k / 0.66, 0.7, 1.2)


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
	var pa := s.get_bone_global_rest(d.arm).origin
	var pb := s.get_bone_global_rest(d.fore).origin
	d["la"] = pa.distance_to(pb)
	d["lb"] = pb.distance_to(G.origin)
	# Пальцы. У каждой фаланги своя ось сгиба — поперёк самой фаланги (палец сгибается в своей плоскости, к
	# ладони). В основании палец ещё сводится к среднему (поворот вокруг P): в кулаке пальцы параллельны и
	# прижаты друг к другу, а не растопырены «когтями».
	var Bh := Basis(F, A, P)
	d["rest_o"] = G.origin
	d["rest_axes"] = Bh
	d["size"] = G.origin.distance_to(mid) / 0.156          # размер кисти: единиц скелета в «сантиметре образца» × 100
	d["splay"] = {}
	d["gax"] = {}
	for f in ["Index", "Mid", "Ring", "Pinky"]:
		var bones := []
		var axes := []
		for j in [1, 2, 3]:
			bones.append(s.find_bone("%s_%s%d" % [side, f, j]))
		var dir := F
		for j in 3:
			var b: int = bones[j]
			if b < 0:
				axes.append(Vector3.RIGHT)
				continue
			if j < 2 and int(bones[j + 1]) >= 0:
				dir = (s.get_bone_global_rest(bones[j + 1]).origin - s.get_bone_global_rest(b).origin).normalized()
			var Bi := s.get_bone_global_rest(b).basis.orthonormalized().inverse()
			axes.append((Bi * dir.cross(P)).normalized())
			if j == 0:
				d.splay[f] = atan2(dir.dot(A), dir.dot(F))      # насколько палец отведён от «прямо» (+ к указательному)
				d.gax[f] = (Bi * P).normalized()
		d.fingers[f] = bones
		d.axes[f] = axes
	var tb := []
	for j in [1, 2, 3]:
		tb.append(s.find_bone("%s_Thumb%d" % [side, j]))
	d.fingers["Thumb"] = tb
	d["poses"] = {}
	for pose in CURL:
		d.poses[pose] = _finger_pose(s, d, CURL[pose])
	return d


## взять оружие ("" — убрать)
## взять оружие ("" — убрать совсем); in_hands = false — оружие появляется убранным (в кобуре, на ремне)
func equip(id: String, in_hands := true) -> void:
	drawn = 1.0 if in_hands else 0.0
	_draw_dir = 0.0
	if node:
		node.queue_free()
		node = null
	for pr in [_prop, _prop_old, _drop_node]:
		if pr:
			pr.queue_free()
	_prop = null
	_prop_old = null
	_drop_node = null
	parts = null
	_pump_t = 99.0
	wid = id
	err_r = 0.0
	err_l = 0.0
	aim_dev = 0.0
	_has_cur = false
	_hs.clear()
	_fq.clear()
	_dyn_i.clear()
	_shift = Vector3.ZERO
	_reload_t = -1.0
	if id == "":
		w = {}
		return
	w = config()[id]
	node = Node3D.new()
	node.name = "Weapon"
	var m: Node3D = (load(w.model) as PackedScene).instantiate()
	if w.get("flip", false):
		m.rotation.y = PI                        # модель сделана стволом назад
	node.add_child(m)
	get_skeleton().add_child(node)
	_wscale = float(w.len_m) / float(w.model_len) * k
	parts = BCWeaponParts.build(node, m, w.get("parts", {}))
	if not parts.has("mag"):
		_make_props()
	_move = ""
	if not w.stances.has(stance):
		stance = w.stances.keys()[0]


## достать оружие: правая рука тянется к рукояти, берёт, поднимает в стойку, левая подхватывает
func draw() -> float:
	if wid == "":
		return 0.0
	_draw_dir = 1.0
	return float(w.get("holster", {}).get("time", 0.9)) * (1.0 - drawn)


## убрать оружие в кобуру / на ремень
func put_away() -> float:
	if wid == "":
		return 0.0
	_draw_dir = -1.0
	return float(w.get("holster", {}).get("time", 0.9)) * drawn


## дульный срез и направление ствола в мире (для выстрела)
func muzzle_world() -> Array:
	if node == null or not w.has("muzzle"):
		return []
	var g := node.global_transform
	return [g * Vector3(w.muzzle[0], w.muzzle[1], w.muzzle[2]), -g.basis.z.normalized()]


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
	if wid != "" and w.get("fire", {}).get("pump", false):
		_pump_t = -0.22                          # после выстрела левая рука передёргивает цевьё


## магазин (патрон, короб) в левой руке при перезарядке и выброшенный старый магазин
func _make_props() -> void:
	var rl: Dictionary = w.get("reload", {})
	if w.mode == "melee" or not rl.has("mag_size"):
		return
	var sz := Vector3(rl.mag_size[0], rl.mag_size[1], rl.mag_size[2]) * k
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.75, 0.16, 0.12) if String(rl.kind) == "shells" else Color(0.34, 0.35, 0.38)
	mat.roughness = 0.6
	mat.metallic = 0.4
	for i in 2:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = sz
		mi.mesh = bm
		mi.material_override = mat
		mi.visible = false
		get_skeleton().add_child(mi)
		if i == 0:
			_prop = mi
		else:
			_prop_old = mi


## передёргивание цевья: 0 — рука на месте, 1 — цевьё отведено назад
func _pump() -> float:
	if _pump_t < 0.0 or _pump_t > 0.5:
		return 0.0
	return sin(PI * _pump_t / 0.5)


func reload() -> float:
	if wid == "" or w.mode == "melee":
		return 0.0
	_reload_t = 0.0
	return _reload_len()


func _reload_len() -> float:
	return float(w.get("reload", {}).get("len", 2.4 if w.mode == "rifle" else 1.9))


func busy() -> bool:
	return _reload_t >= 0.0 or _move != ""


func _pt(a: Array) -> Vector3:
	return Vector3(a[0], a[1], a[2]) * _wscale


func _v(a: Array) -> Vector3:
	return fwd * float(a[0]) + upv * float(a[1]) + rgt * float(a[2])


## поза оружия для стойки — в системе покоя скелета (без масштаба)
func _stance_pose(st: Dictionary) -> Transform3D:
	return _pose_at(_v(st.pos) * (_reach_k if String(st.anchor) == "grip" else 1.0), _v(st.dir), float(st.get("roll", 0.0)), String(st.anchor))


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
			return [_pose_at(_v(a[1]).lerp(_v(b[1]), u) * _reach_k, da.slerp(db, u), 0.0, "grip"), lerpf(float(a[3]), float(b[3]), u)]
	return [_stance_pose(w.stances[stance]), 0.0]


func _process_modification_with_delta(delta: float) -> void:
	if wid == "" or node == null:
		return
	var s := get_skeleton()
	_recoil_t += delta
	if not ik_on:
		_hand_driven(s)
		return
	var dk: Dictionary = w.get("draw", {})
	# достать / убрать
	if _draw_dir != 0.0:
		drawn = clampf(drawn + _draw_dir * delta / float(w.get("holster", {}).get("time", 0.9)), 0.0, 1.0)
		if drawn <= 0.0 or drawn >= 1.0:
			_draw_dir = 0.0
	if _hip < 0:
		_hip = s.find_bone("Hip")
	var Wh := Transform3D.IDENTITY
	if drawn < 1.0:
		var ho: Dictionary = w.get("holster", {"pos": [0.0, -0.05, 0.2], "dir": [0.1, -1.0, 0.0]})
		var f0 := _v(ho.dir).normalized()
		var u0 := (fwd - f0 * fwd.dot(f0)).normalized().rotated(f0, deg_to_rad(float(ho.get("roll", 0.0))))
		var B0 := Basis(f0.cross(u0), u0, -f0)
		# кобура на поясе идёт за тазом; ножны за спиной ("on": "chest", pos — от середины плеч) — за грудью
		var on_chest := String(ho.get("on", "hip")) == "chest"
		var hb := _chest if on_chest else _hip
		var hb_rest := s.get_bone_global_rest(hb)
		var rest_pose := Transform3D(B0, (_sc if on_chest else hb_rest.origin) + _v(ho.pos) * k - B0 * _pt(w.grip))
		Wh = (s.get_bone_global_pose(hb) * hb_rest.affine_inverse()).orthonormalized() * rest_pose
		if drawn <= 0.0:
			finger = ""
			node.transform = Transform3D(Wh.basis.scaled(Vector3.ONE * _wscale), Wh.origin)
			two_hands = false
			hand_r = s.get_bone_global_pose(_hf.R.hand).origin
			_has_cur = false
			_hs.clear()
			_fq.clear()
			return
	# Счёт доставания: до grab правая кисть идёт к рукояти и берёт её (левая — к груди), затем оружие выходит
	# из кобуры и идёт в стойку; левая рука встречает оружие на отрезке left.
	var grab := float(dk.get("grab", 0.3))
	var lift := smoothstep(grab, 1.0, drawn)
	var w_r := smoothstep(0.0, grab * 0.92, drawn)
	var lj: Array = dk.get("left", [0.62, 1.0])
	var m_l := smoothstep(float(lj[0]), float(lj[1]), drawn)
	var chest_l := bool(dk.get("left_chest", false)) and drawn < 1.0
	var w_l := smoothstep(0.04, grab, drawn) if chest_l else m_l
	var st: Dictionary = w.stances[stance]
	var tgt := _stance_pose(st)
	var tw_t := float(st.get("twist", 0.0))
	var a := 1.0 - exp(-delta * 9.0)
	# оружие — тело с массой: в новую стойку идёт с разгоном и торможением, с лёгким перелётом
	var om := 13.0
	var zt := 0.78
	if _move != "":
		_move_t += delta
		var mp := _move_pose()
		tgt = mp[0]
		tw_t = mp[1]
		a = 1.0 - exp(-delta * 40.0)
		om = 60.0
		zt = 1.0
		if _move_t >= float(w.moves[_move].len):
			_move = ""
	if not _has_cur:
		_cur = tgt
		_vel = Vector3.ZERO
		_ang = Vector3.ZERO
		_has_cur = true
		_twist = tw_t
		_follow = float(st.get("follow", 1.0))
		a = 1.0
	_spring(tgt, delta, om, zt)
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
			if w.get("fire", {}).get("pump", false):
				_pump_t = 0.0
	if rl >= 0.0:
		var e := smoothstep(0.0, 0.18, rl) * (1.0 - smoothstep(0.82, 1.0, rl))
		var roll := deg_to_rad(-32.0 if w.mode == "rifle" else -40.0) * e
		var pitch := deg_to_rad(10.0 if w.mode == "rifle" else 28.0) * e
		pose = pose * _about(grip, Basis(Vector3.BACK, roll) * Basis(Vector3.RIGHT, pitch))
		pose.origin += (-fwd * (0.05 if w.mode == "rifle" else 0.14) + upv * (-0.02 if w.mode == "rifle" else -0.06)) * k * e
	var rc: Dictionary = w.get("recoil", {})
	var rk := 0.0
	if not rc.is_empty() and _recoil_t < float(rc.time) * 4.0:
		var x := _recoil_t / (float(rc.time) * 0.25)
		rk = x * exp(1.0 - x)
		pose = pose * _about(grip, Basis(Vector3.RIGHT, deg_to_rad(float(rc.pitch)) * rk))
		pose.origin += pose.basis.z * (float(rc.back) * k * rk)
	# оружие следует за грудью (наклоны и покачивание из клипа), в прицеле — частично
	var Gc := s.get_bone_global_pose(_chest)
	var Gr := s.get_bone_global_rest(_chest)
	var T1 := (Gc * Gr.affine_inverse()).orthonormalized()
	var T0 := Transform3D(Basis.IDENTITY, Gc.origin - Gr.origin)
	var W := T0.interpolate_with(T1, _follow) * pose
	# прицел: ствол смотрит в цель, как бы ни наклонился корпус (точка опоры — приклад или рукоять — остаётся)
	_lock = lerpf(_lock, 1.0 if st.get("lock", false) and _move == "" else 0.0, a)
	if _lock > 0.001:
		var ap := _pt(w[st.anchor])
		var keep := W * ap
		W.basis = W.basis.orthonormalized().slerp(pose.basis.orthonormalized(), _lock)
		W.origin = keep - W.basis * ap
	# разворот корпуса (левое плечо вперёд), чтобы левая рука доставала до цевья; отдача толкает плечи назад
	var lean := deg_to_rad(float(rc.get("body", 0.0))) * rk
	if absf(_twist * lift) > 0.5 or lean > 0.0005:
		for b in _sp:
			var G := s.get_bone_global_pose(b)
			G.basis = Basis(upv, -deg_to_rad(_twist * lift) * 0.5) * Basis(rgt, lean * 0.5) * G.basis
			s.set_bone_global_pose(b, G)
	# --- руки: цели кистей, локти — с учётом пределов суставов ---
	var plan := _plan_for(st)
	_shift = _shift.lerp(plan.t, a)
	W.origin += T0.interpolate_with(T1, _follow).basis * _shift
	var Tb := (s.get_bone_global_pose(_chest) * Gr.affine_inverse()).basis.orthonormalized()
	var bf := Tb * fwd
	var bu := Tb * upv
	var br := Tb * rgt
	var SR := s.get_bone_global_pose(_hf.R.arm).origin
	var SL := s.get_bone_global_pose(_hf.L.arm).origin
	var bo := (SR + SL) * 0.5
	if drawn < 1.0:
		W = _draw_path(Wh, W, T1, drawn, dk)          # оружие идёт из кобуры в стойку по счётам
	# в движении (удар, перезарядка, доставание) кисть сама выбирает допустимый поворот на рукояти — каждый кадр
	var dyn := _move != "" or rl >= 0.0 or drawn < 1.0
	var gr := _dyn_goal("R", SR, W, plan.R, bo, bf, bu, br) if dyn else _goal("R", W, plan.R)
	var tr := _target_s("R", gr, delta)
	var lack := _lack(s, "R", tr[0])
	if lack > 0.0 and not dyn and drawn >= 1.0:
		# не достаёт — оружие ближе к плечу
		W.origin += (SR - tr[0]).normalized() * lack
		gr = _goal("R", W, plan.R)
		tr = _target_s("R", gr, 0.0)
	var tl := []
	if not st.get("one", false) and w_l > 0.0:
		var gl := _goal("L", W, plan.L)
		if rl >= 0.0:
			var rp: Vector3 = _reload_parts(s, W, rl, gl[0], delta) if parts.has("mag") else _reload_palm(s, W, rl, gl[0])
			gl = _dyn_goal("L", SL, W, plan.L, bo, bf, bu, br, rp)
		else:
			reload_step = ""
			_carry = false
			if _pump_t < 0.6:
				_pump_t += delta
			if rl < 0.0 and _pump() > 0.0:
				gl[0] = (gl[0] as Vector3) + W.basis.z * (0.085 * k * _pump())
		if chest_l and m_l < 1.0:
			# пока правая достаёт пистолет, левая ладонь лежит на груди — не перед стволом — и встречает оружие
			var gc := _chest_goal(T1)
			gl = [(gc[0] as Vector3).lerp(gl[0], m_l), (gc[1] as Vector3).slerp(gl[1], m_l).normalized(), (gc[2] as Vector3).slerp(gl[2], m_l).normalized()]
		tl = _target_s("L", gl, delta)
	else:
		_hs.erase("L")
	var pole_r := _swivel("R", SR, tr[0], tr[1], bo, bf, bu, br, delta)
	if w.mode == "melee":
		# оружие в кулаке: если поза требует невозможного сгиба кисти — кисть остаётся в пределах,
		# клинок поворачивается вместе с ней
		var ev := _eval("R", SR, tr[0], tr[1], bo, bf, bu, br, float(_psi.R))
		var R := _wrist_fix("R", SR, ev[2], tr[0], tr[1], ev[1])
		if lift < 1.0:
			R = Basis.IDENTITY.slerp(R.orthonormalized(), lift)     # в ножнах клинок не поворачивается за кистью
		tr[1] = (R * (tr[1] as Basis)).orthonormalized()
		_hs["R"] = tr[1]
		W = Transform3D(R * W.basis, (tr[0] as Vector3) + R * (W.origin - (tr[0] as Vector3)))
	err_r = _arm(s, "R", tr[0], tr[1], pole_r, w_r) / k
	err_l = 0.0
	hand_r = tr[0]
	two_hands = not tl.is_empty()
	if two_hands:
		hand_l = tl[0]
		err_l = _arm(s, "L", tl[0], tl[1], _swivel("L", SL, tl[0], tl[1], bo, bf, bu, br, delta), w_l) / k
		_fingers(s, "L", ("wrap" if w.mode == "rifle" else "support") if m_l > 0.6 else "open", delta, w_l)
	else:
		_fq.erase("L")
	# Пальцы правой: раскрытая кисть идёт к рукояти и смыкается на ней. Указательный лежит вдоль рамки и
	# ложится на спуск только в прицеле (и при выстреле) — как у обученного стрелка.
	finger = "knife" if w.mode == "melee" else "index"
	if w.mode != "melee" and ((stance == "aim" and _lock > 0.8 and rl < 0.0 and drawn >= 1.0) or _recoil_t < 0.3):
		finger = "trigger"
	if drawn < grab * 0.8:
		finger = "open"
	_fingers(s, "R", finger, delta, smoothstep(0.0, grab * 0.6, drawn))
	if parts.has("mag"):
		_parts_idle(rl, rk, delta)
	elif two_hands:
		_props_update(W, rl, tl[2], ((tl[1] as Basis) * ((_hf.L.local_inv as Basis).inverse().z)).normalized(), delta)
	elif _prop:
		_prop.visible = false
	aim_dev = rad_to_deg((-W.basis.z).angle_to(fwd)) if stance == "aim" else 0.0
	node.transform = Transform3D(W.basis.scaled(Vector3.ONE * _wscale), W.origin)


## пружина: оружие догоняет цель как тело с массой (om — жёсткость, рад/с; zt — затухание, 1 — без перелёта)
func _spring(tgt: Transform3D, delta: float, om: float, zt: float) -> void:
	if delta <= 0.0:
		return
	var n := maxi(1, ceili(delta * om / 0.35))
	var dt := delta / n
	var qt := Quaternion(tgt.basis.orthonormalized())
	var q := Quaternion(_cur.basis.orthonormalized())
	for i in n:
		_vel += ((tgt.origin - _cur.origin) * om * om - _vel * (2.0 * zt * om)) * dt
		_cur.origin += _vel * dt
		var dq := qt * q.inverse()
		if dq.w < 0.0:
			dq = -dq
		var ax := Vector3(dq.x, dq.y, dq.z)
		var err := Vector3.ZERO
		if ax.length() > 0.00001:
			err = ax.normalized() * (2.0 * acos(clampf(dq.w, -1.0, 1.0)))
		_ang += (err * om * om - _ang * (2.0 * zt * om)) * dt
		var wl := _ang.length()
		if wl > 0.00001:
			q = (Quaternion(_ang / wl, wl * dt) * q).normalized()
	_cur.basis = Basis(q)


## Путь оружия из кобуры в стойку: взял (grab) → вытянул из кобуры вдоль ствола (clear) → промежуточные положения
## из описания оружия (у груди стволом вперёд, встреча рук) → стойка. Между точками — плавная кривая.
func _draw_path(Wh: Transform3D, W: Transform3D, Tf: Transform3D, x: float, dk: Dictionary) -> Transform3D:
	var grab := float(dk.get("grab", 0.3))
	if x <= grab:
		return Wh
	var keys := [[grab, Wh]]
	var clear := float(dk.get("clear", 0.0)) * k
	if clear > 0.0:
		keys.append([float(dk.get("clear_t", grab + 0.12)), Transform3D(Wh.basis, Wh.origin + Wh.basis.z * clear)])
	for kk in dk.get("keys", []):
		keys.append([float(kk[0]), Tf * _pose_at(_v(kk[1]) * _reach_k, _v(kk[2]), float(kk[3]), "grip")])
	keys.append([1.0, W])
	var u := (x - grab) / (1.0 - grab)
	u = lerpf(u, u * u * (3.0 - 2.0 * u), 0.6)                  # общий разгон и торможение
	var xe := grab + (1.0 - grab) * u
	for i in range(keys.size() - 1):
		if xe <= float(keys[i + 1][0]) or i == keys.size() - 2:
			var t := clampf((xe - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.001), 0.0, 1.0)
			var K0: Transform3D = keys[maxi(i - 1, 0)][1]
			var K1: Transform3D = keys[i][1]
			var K2: Transform3D = keys[i + 1][1]
			var K3: Transform3D = keys[mini(i + 2, keys.size() - 1)][1]
			var pos := K1.origin.cubic_interpolate(K2.origin, K0.origin, K3.origin, t)
			var q := Quaternion(K1.basis.orthonormalized()).slerp(Quaternion(K2.basis.orthonormalized()), t * t * (3.0 - 2.0 * t))
			return Transform3D(Basis(q), pos)
	return W


## левая ладонь на груди (пока правая достаёт пистолет): [точка ладони, A, P]; Tc — куда ушла грудь из позы покоя
func _chest_goal(Tc: Transform3D) -> Array:
	var p := _sc + (fwd * 0.2 - upv * 0.23 - rgt * 0.03) * k
	return [Tc * p, (Tc.basis * (upv * 0.9 - rgt * 0.42)).normalized(), (Tc.basis * (-fwd + upv * 0.12)).normalized()]


## Пределы суставов (град): [удобно от, удобно до, предел от, предел до]. Сгиб кисти: + к ладони, − к тыльной
## стороне. Отведение: + к большому пальцу, − к мизинцу. Предплечье: + ладонью вверх, − ладонью вниз.
const LIM_FLEX := [-35.0, 25.0, -65.0, 70.0]
const LIM_DEV := [-18.0, 8.0, -32.0, 20.0]
const LIM_SUP := [-60.0, 70.0, -88.0, 92.0]
static var _plans := {}
var _psi := {"R": 0.6, "L": 0.6}
var _shift := Vector3.ZERO
var _reach_k := 1.0
var last_plan := {}
var _hs := {}                     ## сглаженная ориентация кистей
var _dyn_i := {}
var _fq := {}                     ## сглаженные повороты пальцев
var _prop: MeshInstance3D = null  ## новый магазин (патрон) в левой руке
var _prop_old: MeshInstance3D = null  ## выброшенный магазин
var _drop_t := 99.0
var _carry := false
var _drop_p := Transform3D.IDENTITY
var _pump_t := 99.0
var reload_step := ""             ## что сейчас делает левая рука при перезарядке (для подписи и проверки)
var parts: BCWeaponParts = null   ## подвижные части модели: магазин, затвор, крышка
var _drop_node: Node3D = null     ## выброшенный магазин (лежит на земле до следующей перезарядки)
var _drop_v := 0.0
var _dropped := false
var mag_state := ""               ## магазин: seat — в оружии, out — вынут, hand — в руке, none — нет (для проверки)
var _vel := Vector3.ZERO          ## скорость оружия (пружина стойки)
var _ang := Vector3.ZERO
var finger := ""                  ## поза пальцев правой кисти сейчас (index — палец вне спуска, trigger — на спуске)


## цель кисти на оружии: [точка ладони, A — от мизинца к указательному, P — из ладони]; prm — допуски хвата
func _goal(side: String, W: Transform3D, prm: Dictionary) -> Array:
	var wf := -W.basis.z
	var wu := W.basis.y
	var wr := W.basis.x
	var grip := W * _pt(w.grip)
	if side == "R":
		var gh := (float(w.grip_half) + 0.012) * k
		if w.mode == "melee":
			# кулак на рукояти, клинок — со стороны большого пальца; кулак можно провернуть вокруг рукояти
			var Pm := (-wr).rotated(wf, deg_to_rad(float(prm.get("roll", 0.0))))
			return [grip - Pm * gh, wf, Pm]
		var rake := deg_to_rad(float(w.get("grip_rake", 0.0)) + float(prm.get("rake", 0.0)))
		var A := (wu * cos(rake) + wf * sin(rake)).normalized()
		var P := (-wr).rotated(A, deg_to_rad(float(prm.get("roll", 0.0))))
		return [grip - P * gh, A, P]
	if w.mode == "rifle":
		# цевьё: ладонь снизу или сбоку (roll), ближе к магазину — если рука не достаёт (u)
		var roll := deg_to_rad(float(prm.get("roll", 25.0)))
		var Pl := (wu * cos(roll) + wr * sin(roll)).normalized()
		var c := W * _pt(w.fore).lerp(_pt(w.get("fore_min", w.fore)), float(prm.get("u", 0.0)))
		# косой хват: цевьё лежит в ладони наискось (ob), тогда предплечье подходит сзади, а не сбоку
		var Aob := wf.rotated(Pl, deg_to_rad(float(prm.get("ob", 0.0))))
		return [c - Pl * ((float(w.get("fore_half", 0.02)) + 0.012) * k), Aob, Pl]
	# пистолет: левая ладонь закрывает пальцы правой, кисть наклонена вперёд
	var cant := deg_to_rad(float(prm.get("cant", 38.0)))
	var Al := (wu * cos(cant) + wf * sin(cant)).normalized()
	return [grip - wr * ((float(w.grip_half) + 0.036) * k) + wf * (0.012 * k) - wu * (0.014 * k), Al, wr.rotated(Al, deg_to_rad(float(prm.get("proll", 0.0))))]


## цель → запястье и ориентация кисти; ориентация сглаживается (без скачков при смене хвата)
func _target_s(side: String, g: Array, delta: float) -> Array:
	var t := _target(side, g[0], g[1], g[2])
	var H: Basis = t[1]
	if _hs.has(side) and delta > 0.0:
		H = (_hs[side] as Basis).slerp(H, 1.0 - exp(-delta * 14.0)).orthonormalized()
	_hs[side] = H
	return [(g[0] as Vector3) - H * (_hf[side].palm_l as Vector3), H, g[0]]


## допуски хвата для движения: кулак проворачивается вокруг рукояти, ладонь — вокруг оси хвата
func _dyn_sets(side: String, base: Dictionary) -> Array:
	var out := []
	if side == "R":
		if w.mode == "melee":
			for r in range(-180, 180, 30):
				out.append({"roll": r})
		else:
			for rk in [-12, 0, 12]:
				for r in [-30, -15, 0, 15, 30]:
					out.append({"rake": rk, "roll": r})
	elif w.mode == "rifle":
		for r in [-30, 0, 30, 60, 90, 120]:
			for ob in [0, 30, 55]:
				out.append({"u": base.get("u", 0.0), "roll": r, "ob": ob})
	else:
		for c in [0, 20, 40, 60]:
			for r in [-50, 0, 50]:
				out.append({"cant": c, "proll": r})
	return out


## цель кисти в движении: перебор допусков хвата, лучший по анатомии (с памятью прошлого выбора)
func _dyn_goal(side: String, S: Vector3, W: Transform3D, base: Dictionary, bo: Vector3, bf: Vector3, bu: Vector3, br: Vector3, palm = null) -> Array:
	var best := []
	var bc := 1e12
	var bi := -1
	var sets := _dyn_sets(side, base)
	for i in sets.size():
		var g := _goal(side, W, sets[i])
		if palm != null:
			g[0] = palm
		var t := _target(side, g[0], g[1], g[2])
		var c := 1e12
		for j in 8:
			c = minf(c, float(_eval(side, S, t[0], t[1], bo, bf, bu, br, deg_to_rad(-30.0 + j * 20.0))[0]))
		if i != int(_dyn_i.get(side, -1)):
			c += 2.0
		if c < bc:
			bc = c
			best = g
			bi = i
	_dyn_i[side] = bi
	return best


## поворот, возвращающий кисть в пределы суставов: f — направление предплечья, H — желаемая ориентация кисти,
## ang — её углы [сгиб, вбок, предплечье]. Сгиб и отведение — поворотом кисти относительно предплечья,
## скручивание — вокруг предплечья.
func _wrist_fix(side: String, sh: Vector3, el: Vector3, wr: Vector3, H: Basis, ang: Array) -> Basis:
	var f := (wr - el).normalized()
	var flex := clampf(float(ang[0]), -58.0, 60.0)
	var dev := clampf(float(ang[1]), -30.0, 18.0)
	var R := Basis.IDENTITY
	if absf(flex - float(ang[0])) > 0.01 or absf(dev - float(ang[1])) > 0.01:
		var L: Basis = (_hf[side].local_inv as Basis).inverse()
		# где должно быть предплечье относительно кисти при допустимых углах
		var fl := (L.x - L.y * tan(deg_to_rad(dev)) - L.z * tan(deg_to_rad(flex))).normalized()
		R = Basis(Quaternion((H * fl).normalized(), f))
	# скручивание предплечья — по уже исправленной кисти
	var sup0: float = _joint_angles(side, sh, el, wr, R * H)[2]
	var sup := clampf(sup0, -85.0, 90.0)
	if absf(sup - sup0) > 0.01:
		var ex := deg_to_rad(sup - sup0)
		var Ra := Basis(f, ex) * R
		var Rb := Basis(f, -ex) * R
		var ea: float = absf(float(_joint_angles(side, sh, el, wr, Ra * H)[2]) - sup)
		var eb: float = absf(float(_joint_angles(side, sh, el, wr, Rb * H)[2]) - sup)
		R = Ra if ea < eb else Rb
	return R


static func _pen(x: float, lim: Array) -> float:
	var p := 0.0
	if x < float(lim[0]):
		p = float(lim[0]) - x
	elif x > float(lim[1]):
		p = x - float(lim[1])
	p = p * p * 0.02
	if x < float(lim[2]):
		p += (float(lim[2]) - x) * 6.0 + 20.0
	elif x > float(lim[3]):
		p += (x - float(lim[3])) * 6.0 + 20.0
	return p


## направление «локоть от оси плечо — запястье»: psi = 0 — вниз, + — наружу и вверх
func _pole(side: String, D: Vector3, bu: Vector3, br: Vector3, psi: float) -> Vector3:
	# «вниз» для локтя — вниз и немного назад: когда кисть под самым плечом (кобура на бедре, пистолет у груди),
	# локоть уходит назад и вверх, а не вперёд
	var dn := -bu - bu.cross(br) * 0.6
	var ref := dn - D * dn.dot(D)
	if ref.length() < 0.05:
		ref = -br.cross(bu) - D * (-br.cross(bu)).dot(D)
	ref = ref.normalized()
	var outw := br if side == "R" else -br
	var o := D.cross(ref)
	if o.dot(outw) < 0.0:
		o = -o
	return (ref * cos(psi) + o * sin(psi)).normalized()


## оценка позы руки (меньше — естественнее): пределы кисти и предплечья, локоть не в туловище и не задран,
## рука достаёт. Возвращает [цена, углы]
func _eval(side: String, S: Vector3, wrist: Vector3, H: Basis, bo: Vector3, bf: Vector3, bu: Vector3, br: Vector3, psi: float) -> Array:
	var la: float = _hf[side].la
	var lb: float = _hf[side].lb
	var at := wrist - S
	var dist := at.length()
	var d := clampf(dist, absf(la - lb) + 0.001, la + lb - 0.0005)
	var D := at / maxf(dist, 0.0001)
	var pole := _pole(side, D, bu, br, psi)
	var cos_a := clampf((la * la + d * d - lb * lb) / (2.0 * la * d), -1.0, 1.0)
	var el := S + D * (la * cos_a) + pole * (la * sqrt(1.0 - cos_a * cos_a))
	var ang := _joint_angles(side, S, el, S + D * d, H)
	var c := _pen(ang[0], LIM_FLEX) + _pen(ang[1], LIM_DEV) * 2.0 + _pen(ang[2], LIM_SUP)
	var lack_cm := maxf(0.0, dist - (la + lb) * 0.985) / k * 100.0
	c += lack_cm * lack_cm * 3.0
	# локоть относительно туловища (м): вперёд, вверх, наружу от середины плеч
	var e := el - bo
	var x := e.dot(bf) / k
	var y := e.dot(bu) / k
	var z := e.dot(br) / k * (1.0 if side == "R" else -1.0)
	if y > 0.02:
		c += (y - 0.02) * (y - 0.02) * 4000.0             # задранный локоть
	c += maxf(0.0, y + 0.18) * 10.0                       # чем ниже локоть, тем спокойнее поза
	var tv := (x / 0.15) * (x / 0.15) + (z / 0.2) * (z / 0.2)
	if tv < 1.0 and y < 0.05:
		c += (1.0 - tv) * 80.0                            # локоть внутри туловища
	if z < 0.06:
		c += (0.06 - z) * 300.0                           # рука поперёк груди
	if ang[3] < 10.0:
		c += (10.0 - ang[3]) * 0.4                        # прямая как палка рука
	return [c, ang, el]


## лучший поворот локтя для запястья и кисти: [psi, цена, углы]
func _best_psi(side: String, S: Vector3, wrist: Vector3, H: Basis, bo: Vector3, bf: Vector3, bu: Vector3, br: Vector3, prev := -99.0) -> Array:
	var best := [0.0, 1e12, []]
	for i in 16:
		var psi := deg_to_rad(-30.0 + i * 10.0)
		var r := _eval(side, S, wrist, H, bo, bf, bu, br, psi)
		var c: float = r[0]
		if prev > -90.0:
			c += (psi - prev) * (psi - prev) * 6.0        # не дёргать локоть между кадрами
		if c < float(best[1]):
			best = [psi, c, r[1]]
	return best


## локоть в кадре: лучший угол, сглаженный
func _swivel(side: String, S: Vector3, wrist: Vector3, H: Basis, bo: Vector3, bf: Vector3, bu: Vector3, br: Vector3, delta: float) -> Vector3:
	var b := _best_psi(side, S, wrist, H, bo, bf, bu, br, float(_psi[side]))
	_psi[side] = lerpf(float(_psi[side]), float(b[0]), 1.0 - exp(-delta * 10.0))
	return _pole(side, (wrist - S).normalized(), bu, br, float(_psi[side]))


func _plan_for(st: Dictionary) -> Dictionary:
	var key := "%s|%s|%.4f|%.4f" % [wid, stance, float(_hf.R.la), _sc.y]
	if not _plans.has(key):
		_plans[key] = _make_plan(st)
	last_plan = _plans[key]
	return last_plan


## Подгонка стойки под этого персонажа: сдвиг оружия (до ~15 см) и допуски хвата (наклон и проворот кисти на
## рукояти, место левой руки на цевье), при которых кисти и предплечья в удобных пределах, а локти — в
## естественном положении. Считается один раз на оружие и стойку, в позе покоя.
func _make_plan(st: Dictionary) -> Dictionary:
	var s := get_skeleton()
	var pose := _stance_pose(st)
	var tw := -deg_to_rad(float(st.get("twist", 0.0)))
	var S := {}
	for side in ["R", "L"]:
		var p := s.get_bone_global_rest(_hf[side].arm).origin
		for b in _sp:
			var o := s.get_bone_global_rest(b).origin
			p = o + (p - o).rotated(upv, tw * 0.5)
		S[side] = p
	var bo: Vector3 = ((S.R as Vector3) + (S.L as Vector3)) * 0.5
	var one: bool = st.get("one", false)
	var sets := {"R": [], "L": []}
	if w.mode == "melee":
		for r in [-40, -20, 0, 20, 40]:
			sets.R.append({"roll": r})
	else:
		for rk in [-12, 0, 12]:
			for r in [-15, 0, 15]:
				sets.R.append({"rake": rk, "roll": r})
	if not one:
		if w.mode == "rifle":
			for u in [0.0, 0.25, 0.5, 0.75, 1.0]:
				for r in [0, 25, 50, 75, 95]:
					for ob in [0, 20, 40, 55]:
						sets.L.append({"u": u, "roll": r, "ob": ob})
		else:
			for c in [15, 35, 55]:
				sets.L.append({"cant": c})
	var prm := {"R": sets.R[0], "L": sets.L[0] if not one else {}}
	var hand := func(side: String, t: Vector3, pr: Dictionary) -> Array:
		var W := Transform3D(pose.basis, pose.origin + t)
		var g := _goal(side, W, pr)
		var tg := _target(side, g[0], g[1], g[2])
		var b := _best_psi(side, S[side], tg[0], tg[1], bo, fwd, upv, rgt)
		return [float(b[1]) + float(pr.get("u", 0.0)) * 5.0, b]
	var pick := func(t: Vector3) -> void:
		for side in ["R", "L"]:
			if side == "L" and one:
				continue
			var bc := 1e12
			for pr in sets[side]:
				var c: float = hand.call(side, t, pr)[0]
				if c < bc:
					bc = c
					prm[side] = pr
	var total := func(t: Vector3) -> float:
		var c: float = hand.call("R", t, prm.R)[0]
		if not one:
			c += float(hand.call("L", t, prm.L)[0])
		var cm := t.length() / k * 100.0
		return c + cm * cm * 0.12
	# приклад у плеча двигать почти нельзя; оружие на руках — до 16 см
	var max_shift := 0.035 if String(st.anchor) == "butt" else 0.16
	var t := Vector3.ZERO
	pick.call(t)
	var best: float = total.call(t)
	for step in [0.05, 0.025, 0.012]:
		for it in 4:
			var moved := false
			for ax in [fwd, upv, rgt]:
				for sg in [1.0, -1.0]:
					var t2: Vector3 = t + (ax as Vector3) * (step * k * sg)
					if t2.length() > max_shift * k:
						continue
					var c: float = total.call(t2)
					if c < best - 0.01:
						best = c
						t = t2
						moved = true
			if not moved:
				break
		pick.call(t)
		best = total.call(t)
	var out := {"t": t, "R": prm.R, "L": prm.L, "cost": best, "ang": {"R": hand.call("R", t, prm.R)[1][2]}}
	if not one:
		out.ang["L"] = hand.call("L", t, prm.L)[1][2]
	return out


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
func _arm(s: Skeleton3D, side: String, wrist: Vector3, H: Basis, pole: Vector3, wgt := 1.0) -> float:
	var hf: Dictionary = _hf[side]
	var a: int = hf.arm
	var b: int = hf.fore
	var c: int = hf.hand
	var A := s.get_bone_global_pose(a)
	var B := s.get_bone_global_pose(b)
	var C := s.get_bone_global_pose(c)
	if wgt < 0.999:
		# частичный вес (рука тянется к оружию): между позой клипа и целью
		if wgt <= 0.001:
			return 0.0
		wrist = C.origin.lerp(wrist, wgt)
		H = C.basis.orthonormalized().slerp(H.orthonormalized(), wgt)
		var el := B.origin - A.origin
		var dd := (wrist - A.origin).normalized()
		var pc := el - dd * el.dot(dd)
		if pc.length() > 0.001:
			pole = pc.normalized().slerp(pole.normalized(), wgt) if pc.normalized().dot(pole.normalized()) > -0.99 else pole
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
	joints[side] = _joint_angles(side, A.origin, B2.origin, C3.origin, H)
	return (C3.origin).distance_to(wrist)


## углы суставов руки для проверки анатомии: плечо sh, локоть el, запястье wr, ориентация кисти H
func _joint_angles(side: String, sh: Vector3, el: Vector3, wr: Vector3, H: Basis) -> Array:
	var hf: Dictionary = _hf[side]
	var L: Basis = (hf.local_inv as Basis).inverse()
	var F := (H * L.x).normalized()
	var A := (H * L.y).normalized()
	var P := (H * L.z).normalized()
	var u := (el - sh).normalized()
	var f := (wr - el).normalized()
	var flex := rad_to_deg(atan2(-f.dot(P), f.dot(F)))
	var dev := rad_to_deg(atan2(-f.dot(A), f.dot(F)))
	# ось локтя; в нейтральном положении предплечья ладонь смотрит вдоль неё (правая — против, левая — по)
	var e := u.cross(f)
	var sup := 0.0
	if e.length() > 0.02:
		e = e.normalized()
		var n := -e if side == "R" else e
		var Pp := (P - f * P.dot(f)).normalized()
		sup = rad_to_deg(atan2(Pp.dot(f.cross(n)), Pp.dot(n)))
		if side == "L":
			sup = -sup
	return [flex, dev, sup, rad_to_deg(u.angle_to(f))]


## Позы пальцев. Для четырёх пальцев — сгиб трёх суставов, град (основание, средний, концевой), gather — насколько
## пальцы сведены вместе (0 — как в модели, 1 — параллельны), conv — сведение кончиков к среднему пальцу, град.
## Большой палец ставится по цели: thumb_j — где его последний сустав, thumb_tip — где кончик, в системе кисти
## [к костяшкам, к указательному, из ладони], сантиметры для кисти-образца (запястье — костяшка среднего 15.6 см),
## thumb_roll — доворот подушечкой к пальцам, град.
##   relax   — расслабленная кисть: пальцы слегка согнуты, от указательного к мизинцу — сильнее
##   fist    — кулак: пальцы плотно свёрнуты, большой лежит поперёк указательного и среднего (не внутри и не торчит)
##   trigger — рукоять пистолета/автомата, указательный на спуске
##   index   — то же, но указательный вытянут вдоль рамки (палец на спуск — только при стрельбе)
##   wrap    — обхват цевья снизу, большой с другой стороны
##   support — левая кисть поверх пальцев правой на рукояти пистолета, большой вперёд вдоль рамки
##   knife   — рукоять холодного оружия: кулак вокруг рукояти, большой замыкает хват поверх указательного
const CURL := {
	"relax": {"Index": [16, 26, 12], "Mid": [22, 30, 14], "Ring": [28, 34, 16], "Pinky": [34, 36, 18], "gather": 0.85, "conv": 0.0,
		"thumb_j": [10.9, 6.6, 3.4], "thumb_tip": [13.4, 6.4, 4.6], "thumb_roll": 0.0},
	"open": {"Index": [2, 4, 3], "Mid": [2, 4, 3], "Ring": [3, 5, 3], "Pinky": [4, 6, 3], "gather": 0.3, "conv": 0.0,
		"thumb_j": [10.4, 7.9, 4.0], "thumb_tip": [12.6, 9.4, 4.8], "thumb_roll": 0.0},
	"fist": {"Index": [88, 108, 76], "Mid": [90, 110, 76], "Ring": [92, 110, 76], "Pinky": [94, 108, 72], "gather": 1.0, "conv": 3.0,
		"thumb_j": [10.2, 4.4, 3.4], "thumb_tip": [10.9, 1.4, 3.6], "thumb_roll": 30.0},
	"trigger": {"Index": [22, 46, 24], "Mid": [70, 84, 44], "Ring": [72, 86, 44], "Pinky": [74, 86, 44], "gather": 1.0, "conv": 0.0,
		"thumb_j": [10.4, 6.2, 4.2], "thumb_tip": [13.2, 5.8, 5.0], "thumb_roll": 15.0},
	"index": {"Index": [4, 8, 6], "Mid": [70, 84, 44], "Ring": [72, 86, 44], "Pinky": [74, 86, 44], "gather": 1.0, "conv": 0.0,
		"thumb_j": [10.4, 6.2, 4.2], "thumb_tip": [13.2, 5.8, 5.0], "thumb_roll": 15.0},
	"wrap": {"Index": [52, 64, 36], "Mid": [56, 68, 38], "Ring": [58, 70, 38], "Pinky": [60, 70, 38], "gather": 0.9, "conv": 0.0,
		"thumb_j": [8.6, 6.0, 4.0], "thumb_tip": [9.4, 5.2, 6.8], "thumb_roll": 35.0},
	"support": {"Index": [52, 64, 32], "Mid": [56, 68, 34], "Ring": [58, 70, 34], "Pinky": [60, 70, 34], "gather": 1.0, "conv": 0.0,
		"thumb_j": [10.6, 6.0, 4.2], "thumb_tip": [13.4, 5.4, 5.0], "thumb_roll": 15.0},
	"knife": {"Index": [78, 92, 52], "Mid": [80, 94, 54], "Ring": [82, 94, 54], "Pinky": [84, 94, 54], "gather": 1.0, "conv": 0.0,
		"thumb_j": [11.4, 4.6, 4.6], "thumb_tip": [12.6, 1.8, 5.2], "thumb_roll": 30.0},
}


## поза пальцев → повороты костей (считается один раз, в позе покоя кисти)
func _finger_pose(s: Skeleton3D, d: Dictionary, c: Dictionary) -> Dictionary:
	var out := {}
	var ps := float(d.psign)
	for f in ["Index", "Mid", "Ring", "Pinky"]:
		for j in 3:
			var b: int = d.fingers[f][j]
			if b < 0:
				continue
			var q := s.get_bone_rest(b).basis.get_rotation_quaternion()
			if j == 0:
				# свести палец: из своего угла — к «прямо» и чуть к среднему
				var root_a: float = (d.rest_axes as Basis).y.dot(s.get_bone_global_rest(b).origin - (d.rest_o as Vector3))
				var want := -deg_to_rad(float(c.get("conv", 0.0))) * signf(root_a) * (1.0 if absf(root_a) > 0.004 * float(d.size) else 0.0)
				var da := (want - float(d.splay[f])) * float(c.get("gather", 0.0))
				q = q * Quaternion(d.gax[f], -ps * da)
			out[b] = q * Quaternion(d.axes[f][j], deg_to_rad(float(c[f][j])))
	# большой палец: два звена — к точке последнего сустава, концевая фаланга — к кончику
	var tb: Array = d.fingers.Thumb
	if int(tb[0]) < 0 or int(tb[1]) < 0 or int(tb[2]) < 0 or not c.has("thumb_j"):
		return out
	var Bh: Basis = d.rest_axes
	var u := float(d.size) * 0.01
	var to_g := func(a: Array) -> Vector3: return (d.rest_o as Vector3) + Bh * (Vector3(a[0], a[1], a[2]) * u)
	var G1 := s.get_bone_global_rest(tb[0])
	var G2 := s.get_bone_global_rest(tb[1])
	var G3 := s.get_bone_global_rest(tb[2])
	var p1 := G1.origin
	var l1 := p1.distance_to(G2.origin)
	var l2 := G2.origin.distance_to(G3.origin)
	var J: Vector3 = to_g.call(c.thumb_j)
	var T: Vector3 = to_g.call(c.thumb_tip)
	var dv := J - p1
	var dist := clampf(dv.length(), absf(l1 - l2) + 0.0001, (l1 + l2) * 0.999)
	var dn := dv.normalized()
	J = p1 + dn * dist
	# сустав в середине выгибается наружу — от ладони и от пальцев
	var pole := Bh.y * 0.8 + Bh.z * 0.45 - Bh.x * 0.3
	pole = (pole - dn * pole.dot(dn)).normalized()
	var ca := clampf((l1 * l1 + dist * dist - l2 * l2) / (2.0 * l1 * dist), -1.0, 1.0)
	var p2 := p1 + dn * (l1 * ca) + pole * (l1 * sqrt(1.0 - ca * ca))
	var R1 := Basis(Quaternion((G2.origin - p1).normalized(), (p2 - p1).normalized()))
	R1 = Basis((p2 - p1).normalized(), -ps * deg_to_rad(float(c.get("thumb_roll", 0.0)))) * R1
	var N1 := (R1 * G1.basis).orthonormalized()
	var d2 := R1 * (G3.origin - G2.origin).normalized()
	var R2 := Basis(Quaternion(d2, (J - p2).normalized())) * R1
	var N2 := (R2 * G2.basis).orthonormalized()
	var d3 := R2 * (G3.origin - G2.origin).normalized()
	var R3 := Basis(Quaternion(d3, (T - J).normalized())) * R2
	var N3 := (R3 * G3.basis).orthonormalized()
	var Gh := s.get_bone_global_rest(d.hand).basis.orthonormalized()
	out[tb[0]] = (Gh.inverse() * N1).get_rotation_quaternion()
	out[tb[1]] = (N1.inverse() * N2).get_rotation_quaternion()
	out[tb[2]] = (N2.inverse() * N3).get_rotation_quaternion()
	return out


## поставить пальцы в позу; wgt < 1 — частично, от позы клипа
func _curl(s: Skeleton3D, side: String, pose: String, wgt := 1.0) -> void:
	if wgt <= 0.001:
		return
	var q: Dictionary = _hf[side].poses.get(pose, _hf[side].poses.relax)
	for b in q:
		if wgt >= 0.999:
			s.set_bone_pose_rotation(b, q[b])
		else:
			s.set_bone_pose_rotation(b, s.get_bone_pose_rotation(b).slerp(q[b], wgt))


## пальцы плавно переходят из позы в позу (кисть смыкается на рукояти, палец ложится на спуск)
func _fingers(s: Skeleton3D, side: String, pose: String, delta: float, wgt := 1.0, rate := 16.0) -> void:
	var q: Dictionary = _hf[side].poses.get(pose, _hf[side].poses.relax)
	if not _fq.has(side):
		_fq[side] = q.duplicate()
	var cur: Dictionary = _fq[side]
	var a := 1.0 - exp(-maxf(delta, 0.0) * rate)          # на паузе пальцы не двигаются
	for b in q:
		cur[b] = (cur[b] as Quaternion).slerp(q[b], a)
		if wgt >= 0.999:
			s.set_bone_pose_rotation(b, cur[b])
		elif wgt > 0.001:
			s.set_bone_pose_rotation(b, s.get_bone_pose_rotation(b).slerp(cur[b], wgt))


## Перезарядка по шагам: [доля времени, точка ладони левой руки, в руке ли магазин, название шага].
## Магазин: рука с цевья идёт к магазину, выдёргивает его (старый падает), идёт к подсумку на поясе, берёт
## новый, вставляет, передёргивает затвор и возвращается на цевьё. Дробовик: по одному патрону с пояса в окно
## заряжания, в конце — цевьё назад-вперёд.
func _reload_plan(s: Skeleton3D, W: Transform3D, base_palm: Vector3) -> Array:
	var wu := W.basis.y
	var rc: Dictionary = w.get("reload", {})
	var kind := String(rc.get("kind", "mag"))
	var mag := W * _pt(w.mag) - wu * (0.03 * k)
	var mag_low := mag - wu * (0.1 * k)
	var hip := s.get_bone_global_pose(s.find_bone("Hip")).origin
	var belt := hip + (fwd * 0.16 - rgt * 0.17 + upv * 0.06) * k
	if kind == "shells":
		var n := int(rc.get("count", 4))
		var keys := [[0.0, base_palm, false, ""], [0.08, belt, false, "к патронташу"]]
		var d := 0.74 / n
		for i in n:
			var t0 := 0.08 + d * i
			keys.append([t0 + d * 0.12, belt, true, "патрон %d" % (i + 1)])
			keys.append([t0 + d * 0.62, mag, true, "патрон %d" % (i + 1)])
			keys.append([t0 + d * 0.78, mag + W.basis.z * (-0.03 * k), false, "патрон %d" % (i + 1)])
			keys.append([t0 + d, belt if i < n - 1 else mag, false, ""])
		keys.append([0.9, base_palm, false, "цевьё"])
		keys.append([1.0, base_palm, false, "цевьё"])
		return keys
	var bolt := W * _pt(w.get("bolt", w.mag)) if w.has("bolt") else mag + wu * (0.1 * k)
	if kind == "box":
		# ручной пулемёт: открыть крышку, снять короб (падает), новый короб с пояса, уложить ленту, закрыть
		# крышку, взвести затвор
		var cover := bolt + wu * (0.05 * k)
		var cover_up := cover + wu * (0.09 * k) + W.basis.z * (0.05 * k)
		var back := bolt + W.basis.z * (0.07 * k)
		return [[0.0, base_palm, false, ""], [0.08, cover, false, "крышка"], [0.14, cover_up, false, "крышка открыта"], [0.22, mag, false, "к коробу"],
			[0.28, mag_low, false, "короб снят"], [0.42, belt, false, "к подсумку"], [0.5, belt, true, "новый короб"], [0.62, mag_low, true, "новый короб"],
			[0.68, mag, false, "короб пристёгнут"], [0.74, cover, false, "лента уложена"], [0.79, cover_up, false, "крышка"], [0.84, cover, false, "крышка закрыта"],
			[0.9, bolt, false, "затвор"], [0.95, back, false, "затвор"], [0.97, bolt, false, "затвор"], [1.0, base_palm, false, ""]]
	var bolt_back := bolt + W.basis.z * ((0.03 if w.mode == "pistol" else 0.06) * k)
	return [[0.0, base_palm, false, ""], [0.13, mag, false, "к магазину"], [0.21, mag_low, false, "магазин вынут"], [0.4, belt, false, "к подсумку"],
		[0.5, belt, true, "новый магазин"], [0.66, mag_low, true, "новый магазин"], [0.74, mag, false, "магазин вставлен"], [0.79, mag, false, "магазин вставлен"],
		[0.87, bolt, false, "затвор"], [0.92, bolt_back, false, "затвор"], [0.95, bolt, false, "затвор"], [1.0, base_palm, false, ""]]


func _reload_palm(s: Skeleton3D, W: Transform3D, rl: float, base_palm: Vector3) -> Vector3:
	var keys := _reload_plan(s, W, base_palm)
	for i in range(keys.size() - 1):
		if rl >= float(keys[i][0]) and rl <= float(keys[i + 1][0]):
			var u := smoothstep(0.0, 1.0, (rl - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.001))
			_carry = bool(keys[i][2]) and bool(keys[i + 1][2])
			reload_step = String(keys[i + 1][3])
			return (keys[i][1] as Vector3).lerp(keys[i + 1][1], u)
	return base_palm


## магазин в руке и падающий старый магазин
func _props_update(W: Transform3D, rl: float, palm: Vector3, P: Vector3, delta: float) -> void:
	if _prop == null:
		return
	var kind := String(w.reload.kind)
	var B := W.basis.orthonormalized()
	_prop.visible = rl >= 0.0 and _carry
	if _prop.visible:
		# магазин лежит в ладони, вдоль оружия
		_prop.transform = Transform3D(B, palm + P * (0.02 * k) + B.y * (float(w.reload.mag_size[1]) * 0.25 * k if kind != "shells" else 0.0))
	if kind == "shells":
		_prop_old.visible = false
		return
	var t_out := 0.28 if kind == "box" else 0.21
	if rl >= t_out and rl < t_out + 0.09 and _drop_t > 2.0:
		_drop_t = 0.0
		_drop_p = Transform3D(B, W * _pt(w.mag) - B.y * (0.12 * k))
	if rl < 0.0 and _drop_t > 0.9:
		_drop_t = 99.0
	_prop_old.visible = _drop_t < 0.9
	if _prop_old.visible:
		_drop_t += delta
		# старый магазин падает под своим весом и слегка кувыркается
		var fall := minf(0.5 * 9.8 * _drop_t * _drop_t, 1.3)
		_prop_old.transform = Transform3D(_drop_p.basis * Basis(Vector3.RIGHT, _drop_t * 5.0), _drop_p.origin - upv * (fall * k) - fwd * (0.25 * _drop_t * k))
		if fall >= 1.3:
			_drop_t = 0.9


## Перезарядка с настоящими частями модели. Ключи: [доля времени, где ладонь, магазин, затвор 0..1, крышка 0..1,
## шаг]. Ладонь: base — на цевье, mag — на магазине, drop — магазин отброшен, belt — подсумок, slap — дослать
## ладонью снизу, bolt — на рукоятке затвора (идёт вместе с ним), boltb — рука осталась сзади (затвор сорвался
## вперёд сам), cover — на крышке. Магазин: seat — в оружии, out — вынут, hand — в руке, none — нет.
func _reload_keys() -> Array:
	var kind := String(w.get("reload", {}).get("kind", "mag"))
	if kind == "box":
		# пулемёт: крышка → короб → новый короб → лента → крышка → затвор
		return [[0.0, "base", "seat", 0, 0, ""], [0.07, "cover", "seat", 0, 0, "крышка"], [0.15, "cover", "seat", 0, 1, "крышка открыта"],
			[0.22, "mag", "seat", 0, 1, "к коробу"], [0.3, "mag", "out", 0, 1, "короб снят"], [0.32, "drop", "none", 0, 1, "короб сброшен"],
			[0.46, "belt", "none", 0, 1, "к подсумку"], [0.52, "belt", "hand", 0, 1, "новый короб"], [0.64, "mag", "out", 0, 1, "новый короб"],
			[0.72, "mag", "seat", 0, 1, "короб пристёгнут"], [0.77, "cover", "seat", 0, 1, "лента уложена"], [0.84, "cover", "seat", 0, 0, "крышка закрыта"],
			[0.88, "bolt", "seat", 0, 0, "затвор"], [0.94, "bolt", "seat", 1, 0, "затвор"], [0.96, "boltb", "seat", 0, 0, "затвор"], [1.0, "base", "seat", 0, 0, ""]]
	if w.mode == "pistol":
		# пистолет: кнопка — магазин выпадает сам, левая рука сразу к подсумку; новый магазин, дослать, затвор
		return [[0.0, "base", "seat", 0, 0, ""], [0.06, "base", "seat", 0, 0, "кнопка защёлки"], [0.13, "base", "out", 0, 0, "магазин выпал"],
			[0.15, "drop", "none", 0, 0, "магазин выпал"], [0.34, "belt", "none", 0, 0, "к подсумку"], [0.4, "belt", "hand", 0, 0, "новый магазин"],
			[0.56, "mag", "out", 0, 0, "новый магазин"], [0.64, "mag", "seat", 0, 0, "магазин вставлен"], [0.68, "slap", "seat", 0, 0, "дослал"],
			[0.75, "bolt", "seat", 0, 0, "затвор"], [0.83, "bolt", "seat", 1, 0, "затвор"], [0.86, "boltb", "seat", 0, 0, "затвор"], [1.0, "base", "seat", 0, 0, ""]]
	# автомат, винтовка, пистолет-пулемёт: рука вынимает магазин, отбрасывает, новый с пояса, вставить, затвор
	return [[0.0, "base", "seat", 0, 0, ""], [0.12, "mag", "seat", 0, 0, "к магазину"], [0.22, "mag", "out", 0, 0, "магазин вынут"],
		[0.25, "drop", "none", 0, 0, "магазин сброшен"], [0.4, "belt", "none", 0, 0, "к подсумку"], [0.46, "belt", "hand", 0, 0, "новый магазин"],
		[0.6, "mag", "out", 0, 0, "новый магазин"], [0.7, "mag", "seat", 0, 0, "магазин вставлен"], [0.74, "slap", "seat", 0, 0, "дослал"],
		[0.8, "bolt", "seat", 0, 0, "затвор"], [0.87, "bolt", "seat", 1, 0, "затвор"], [0.9, "boltb", "seat", 0, 0, "затвор"], [1.0, "base", "seat", 0, 0, ""]]


func _m2m() -> float:
	return float(w.model_len) / float(w.len_m)


## точка модели → система скелета
func _mw(W: Transform3D, p: Vector3) -> Vector3:
	return W.origin + W.basis * (p * _wscale)


func _mag_pose(st: String) -> Transform3D:
	return parts.mag_out() if st == "out" else Transform3D.IDENTITY


func _key_palm(s: Skeleton3D, W: Transform3D, key: Array, base_palm: Vector3) -> Vector3:
	var wu := W.basis.y
	match String(key[1]):
		"mag":
			return _mw(W, parts.mag_grip(_mag_pose(String(key[2]))))
		"drop":
			return _mw(W, parts.mag_grip(parts.mag_out())) - wu * (0.08 * k) - W.basis.x * (0.06 * k)
		"belt":
			var hip := s.get_bone_global_pose(s.find_bone("Hip")).origin
			return hip + (fwd * 0.16 - rgt * 0.17 + upv * 0.06) * k
		"slap":
			var d := Vector3(0, -1, 0)
			return _mw(W, (parts.center.mag as Vector3) + d * (absf((parts.size.mag as Vector3).y) * 0.55))
		"bolt", "boltb":
			var u := 1.0 if String(key[1]) == "boltb" else float(key[3])
			return _mw(W, parts.bolt_t("bolt", u, _m2m()) * (parts.center.get("bolt", parts.center.mag) as Vector3))
		"cover":
			if parts.has("cover"):
				var cs: Vector3 = parts.size.cover
				var rear: Vector3 = (parts.center.cover as Vector3) + Vector3(0, cs.y * 0.5, cs.z * 0.45)
				return _mw(W, parts.cover_t(float(key[4])) * rear)
	return base_palm


func _reload_parts(s: Skeleton3D, W: Transform3D, rl: float, base_palm: Vector3, delta: float) -> Vector3:
	var keys := _reload_keys()
	var i := 0
	while i < keys.size() - 2 and rl > float(keys[i + 1][0]):
		i += 1
	var k0: Array = keys[i]
	var k1: Array = keys[i + 1]
	var u := clampf((rl - float(k0[0])) / maxf(float(k1[0]) - float(k0[0]), 0.001), 0.0, 1.0)
	var us := u * u * (3.0 - 2.0 * u)
	reload_step = String(k1[5])
	var palm := _key_palm(s, W, k0, base_palm).lerp(_key_palm(s, W, k1, base_palm), us)
	# затвор и крышка
	parts.place("bolt", parts.bolt_t("bolt", lerpf(float(k0[3]), float(k1[3]), u if float(k1[3]) < float(k0[3]) else us), _m2m()))
	parts.place("cover", parts.cover_t(lerpf(float(k0[4]), float(k1[4]), us)))
	# магазин
	var m0 := String(k0[2])
	var m1 := String(k1[2])
	if m1 == "none" and m0 != "none":
		if not _dropped:
			_drop_mag(W, _mag_pose(m0) if m0 != "hand" else _mag_pose("out"))
		parts.show("mag", false)
		mag_state = "none"
	elif m0 == "none" and m1 == "none":
		parts.show("mag", false)
		mag_state = "none"
	elif m0 == "hand" or m1 == "hand":
		# магазин в руке: горловина вперёд-вверх, как в вынутом положении, хват — в ладони
		var show_it := not (m0 == "none" and us < 0.5)
		parts.show("mag", show_it)
		var out := parts.mag_out()
		var pal_m := (W.affine_inverse() * palm) / _wscale
		var g0 := parts.mag_grip(Transform3D.IDENTITY)
		parts.place("mag", Transform3D(out.basis, pal_m - out.basis * g0))
		mag_state = "hand" if show_it else "none"
	else:
		parts.show("mag", true)
		var a := _mag_pose(m0)
		var b := _mag_pose(m1)
		parts.place("mag", a.interpolate_with(b, us))
		mag_state = m1 if us > 0.5 else m0
	_drop_fall(delta)
	return palm


## выброшенный магазин: копия части падает под своим весом, кувыркается и остаётся лежать
func _drop_mag(W: Transform3D, t: Transform3D) -> void:
	_dropped = true
	if _drop_node:
		_drop_node.queue_free()
	_drop_node = parts.copy("mag", get_skeleton())
	if _drop_node:
		_drop_node.transform = Transform3D(W.basis.scaled(Vector3.ONE * _wscale), W.origin) * t
	_drop_v = 0.0


func _drop_fall(delta: float) -> void:
	if _drop_node == null or delta <= 0.0:
		return
	var h := _drop_node.transform.origin.dot(upv) / k
	if h <= 0.03:
		return
	_drop_v += 9.8 * delta
	var T := _drop_node.transform
	T.origin -= upv * (minf(_drop_v * delta, h - 0.025) * k)
	T.origin -= fwd * (0.3 * delta * k)
	T.basis = Basis(rgt, 4.0 * delta) * T.basis
	_drop_node.transform = T


## части вне перезарядки: магазин на месте, затвор ходит при выстреле, цевьё дробовика — при передёргивании
func _parts_idle(rl: float, rk: float, delta: float) -> void:
	if rl >= 0.0:
		return
	_dropped = false
	mag_state = "seat"
	parts.show("mag", true)
	parts.place("mag", Transform3D.IDENTITY)
	parts.place("cover", Transform3D.IDENTITY)
	parts.place("bolt", parts.bolt_t("bolt", clampf(rk, 0.0, 1.0), _m2m()))
	if parts.has("pump"):
		parts.place("pump", parts.bolt_t("pump", _pump(), _m2m()))
	_drop_fall(delta)


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
		_curl(s, "R", "knife")
	else:
		B = Basis(F.cross(A), A, -F)
	B = B.orthonormalized()
	node.transform = Transform3D(B.scaled(Vector3.ONE * _wscale), palm - B * _pt(w.grip))
	hand_r = G.origin
	two_hands = false
	err_r = 0.0
	err_l = 0.0
