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
	_hs.clear()
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
	# --- руки: цели кистей, локти — с учётом пределов суставов ---
	var plan := _plan_for(st)
	_shift = _shift.lerp(plan.t, a)
	W.origin += T0.interpolate_with(T1.orthonormalized(), _follow).basis * _shift
	var Tb := (s.get_bone_global_pose(_chest) * Gr.affine_inverse()).basis.orthonormalized()
	var bf := Tb * fwd
	var bu := Tb * upv
	var br := Tb * rgt
	var SR := s.get_bone_global_pose(_hf.R.arm).origin
	var SL := s.get_bone_global_pose(_hf.L.arm).origin
	var bo := (SR + SL) * 0.5
	# в движении (удар, перезарядка) кисть сама выбирает допустимый поворот на рукояти — каждый кадр
	var dyn := _move != "" or rl >= 0.0
	var gr := _dyn_goal("R", SR, W, plan.R, bo, bf, bu, br) if dyn else _goal("R", W, plan.R)
	var tr := _target_s("R", gr, delta)
	var lack := _lack(s, "R", tr[0])
	if lack > 0.0 and not dyn:
		# не достаёт — оружие ближе к плечу
		W.origin += (SR - tr[0]).normalized() * lack
		gr = _goal("R", W, plan.R)
		tr = _target_s("R", gr, 0.0)
	var tl := []
	if not st.get("one", false):
		var gl := _goal("L", W, plan.L)
		if rl >= 0.0:
			gl = _dyn_goal("L", SL, W, plan.L, bo, bf, bu, br, _reload_palm(s, W, rl, gl[0]))
		tl = _target_s("L", gl, delta)
	else:
		_hs.erase("L")
	var pole_r := _swivel("R", SR, tr[0], tr[1], bo, bf, bu, br, delta)
	if w.mode == "melee":
		# оружие в кулаке: если поза требует невозможного сгиба кисти — кисть остаётся в пределах,
		# клинок поворачивается вместе с ней
		var ev := _eval("R", SR, tr[0], tr[1], bo, bf, bu, br, float(_psi.R))
		var R := _wrist_fix("R", SR, ev[2], tr[0], tr[1], ev[1])
		tr[1] = (R * (tr[1] as Basis)).orthonormalized()
		_hs["R"] = tr[1]
		W = Transform3D(R * W.basis, (tr[0] as Vector3) + R * (W.origin - (tr[0] as Vector3)))
	err_r = _arm(s, "R", tr[0], tr[1], pole_r) / k
	err_l = 0.0
	hand_r = tr[0]
	two_hands = not tl.is_empty()
	if two_hands:
		hand_l = tl[0]
		err_l = _arm(s, "L", tl[0], tl[1], _swivel("L", SL, tl[0], tl[1], bo, bf, bu, br, delta)) / k
		_curl(s, "L", "wrap" if w.mode == "rifle" else "support")
	_curl(s, "R", "fist" if w.mode == "melee" else "trigger")
	aim_dev = rad_to_deg((-W.basis.z).angle_to(fwd)) if stance == "aim" else 0.0
	node.transform = Transform3D(W.basis.scaled(Vector3.ONE * _wscale), W.origin)


# ---------------- анатомия: цели кистей, локти, подгонка стойки ----------------
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
	var ref := -bu - D * (-bu).dot(D)
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


## позы пальцев: trigger — рукоять, указательный у спуска; wrap — обхват цевья; support — поверх пальцев правой;
## fist — кулак на рукояти
const CURL := {
	"trigger": {"Index": [18, 42, 22], "Mid": [62, 78, 38], "Ring": [66, 80, 40], "Pinky": [70, 82, 40], "Thumb": [58, 30, 12]},
	"wrap": {"Index": [50, 62, 34], "Mid": [54, 66, 36], "Ring": [56, 68, 36], "Pinky": [58, 70, 36], "Thumb": [20, 30, 12]},
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


## левая ладонь при перезарядке: цевьё → магазин → пояс → магазин → цевьё
func _reload_palm(s: Skeleton3D, W: Transform3D, rl: float, base_palm: Vector3) -> Vector3:
	var wu := W.basis.y
	var mag := W * _pt(w.mag) - wu * (0.03 * k)
	var mag_low := mag - wu * (0.09 * k)
	var hip := s.get_bone_global_pose(s.find_bone("Hip")).origin
	var belt := hip + (fwd * 0.16 - rgt * 0.17 + upv * 0.06) * k
	var keys := [[0.0, base_palm], [0.16, mag], [0.26, mag_low], [0.46, belt], [0.56, belt], [0.74, mag_low], [0.82, mag], [0.88, mag], [1.0, base_palm]]
	for i in range(keys.size() - 1):
		if rl >= float(keys[i][0]) and rl <= float(keys[i + 1][0]):
			var u := smoothstep(0.0, 1.0, (rl - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.001))
			return (keys[i][1] as Vector3).lerp(keys[i + 1][1], u)
	return base_palm


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
