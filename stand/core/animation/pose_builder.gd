class_name BCPoseBuilder
## Построитель поз и движений по анатомическим правилам (вместо клипов Tripo, где персонаж в покое раскачивается
## на 30 см). Поза задаётся словами, понятными человеку: где стоят стопы, насколько согнуты колени (высота таза),
## разворот и наклон таза и груди, куда смотрит голова, где кисти и как они повёрнуты. Ноги и руки ставятся
## обратной кинематикой, локти — с учётом пределов суставов (BCWeaponHold). Из поз по ключам собираются клипы
## (Animation) и кладутся в библиотеку персонажа: стойка с дыханием, боевая стойка, стойка с оружием, удары
## рукой и ногой, реакция на попадание, отскок.
##
## Величины — в метрах и градусах, векторы — [вперёд, вверх, вправо] относительно персонажа:
##   hip   {off, yaw, lean, roll}  — сдвиг таза, разворот вправо, наклон вперёд, крен вправо
##   chest {yaw, lean}             — добавка для груди (распределяется по трём позвонкам)
##   head  {yaw, pitch}            — куда смотрит голова (pitch + — вниз)
##   footL / footR {pos [вперёд, вправо], yaw, heel, air [вперёд, вверх, вправо], free 0..1}
##                                 — сдвиг стопы от места покоя, разворот, подъём пятки; air — стопа в воздухе
##   handL / handR {hang 0..1, pos, F, P, curl, ext 0..1, dir} — рука висит или кисть в точке pos от середины
##                                 плеч, F — куда направлены костяшки, P — куда смотрит ладонь;
##                                 ext — прямой удар: рука вытянута от плеча по направлению dir

var rig: BCCharacter
var s: Skeleton3D
var h: BCWeaponHold
var k := 1.0
var fwd := Vector3.RIGHT
var upv := Vector3.UP
var rgt := Vector3.BACK
var skel_path := ""
var _b := {}


func _init(character: BCCharacter) -> void:
	rig = character
	s = rig.skel
	h = rig.hold
	k = h.k
	fwd = h.fwd
	upv = h.upv
	rgt = h.rgt
	skel_path = String(rig.model.get_path_to(s))
	for n in ["Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "NeckTwist02", "Head"]:
		_b[n] = s.find_bone(n)
	for side in ["L", "R"]:
		for n in ["Thigh", "Calf", "Foot", "ToeBase", "Upperarm"]:
			_b[side + n] = s.find_bone(side + "_" + n)


func v(a: Array) -> Vector3:
	return (fwd * float(a[0]) + upv * float(a[1]) + rgt * float(a[2])) * k


func d(a: Array) -> Vector3:
	return (fwd * float(a[0]) + upv * float(a[1]) + rgt * float(a[2])).normalized()


## поворот: вправо (yaw), наклон вперёд (lean), крен вправо (roll)
func rot(yaw: float, lean := 0.0, roll := 0.0) -> Basis:
	return Basis(upv, -deg_to_rad(yaw)) * Basis(rgt, -deg_to_rad(lean)) * Basis(fwd, deg_to_rad(roll))


# ---------------- готовые позы ----------------

const NEUTRAL := {
	"hip": {"off": [0.0, -0.012, 0.0], "yaw": 0.0, "lean": 0.0, "roll": 0.0},
	"chest": {"yaw": 0.0, "lean": 0.0},
	"head": {"yaw": 0.0, "pitch": 0.0},
	"footL": {"pos": [0.0, 0.03], "yaw": 0.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"footR": {"pos": [0.0, -0.03], "yaw": 0.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"handL": {"hang": 1.0, "pos": [0.1, -0.5, -0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, 1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
	"handR": {"hang": 1.0, "pos": [0.1, -0.5, 0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, -1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
}
## боевая стойка: левая нога и левое плечо впереди, колени согнуты, вес посередине, кулаки у подбородка,
## локти вниз, подбородок опущен
const COMBAT := {
	"hip": {"off": [0.0, -0.075, 0.0], "yaw": 26.0, "lean": 5.0, "roll": 0.0},
	"chest": {"yaw": 8.0, "lean": 7.0},
	"head": {"yaw": 0.0, "pitch": 6.0},
	"footL": {"pos": [0.2, 0.02], "yaw": 6.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"footR": {"pos": [-0.2, 0.02], "yaw": 42.0, "heel": 0.03, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"handL": {"hang": 0.0, "pos": [0.3, 0.09, -0.07], "F": [0.4, 0.92, 0.0], "P": [0.0, -0.15, 1.0], "curl": "fist", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
	"handR": {"hang": 0.0, "pos": [0.17, 0.07, 0.1], "F": [0.3, 0.95, 0.0], "P": [0.0, -0.15, -1.0], "curl": "fist", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
}
## стойка с оружием: ноги на ширине плеч, левая чуть впереди, колени мягко согнуты, корпус слегка вперёд
const ARMED := {
	"hip": {"off": [0.0, -0.04, 0.0], "yaw": 12.0, "lean": 4.0, "roll": 0.0},
	"chest": {"yaw": 0.0, "lean": 5.0},
	"head": {"yaw": 0.0, "pitch": 0.0},
	"footL": {"pos": [0.11, 0.0], "yaw": 2.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"footR": {"pos": [-0.11, 0.03], "yaw": 28.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"handL": {"hang": 1.0, "pos": [0.1, -0.5, -0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, 1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
	"handR": {"hang": 1.0, "pos": [0.1, -0.5, 0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, -1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
}


## словарь поверх словаря (вложенные — тоже)
static func over(base: Dictionary, o: Dictionary) -> Dictionary:
	var out := base.duplicate(true)
	for key in o:
		if out.has(key) and out[key] is Dictionary and o[key] is Dictionary:
			out[key] = over(out[key], o[key])
		else:
			out[key] = o[key]
	return out


## смесь двух поз
static func mix(a, b, u: float):
	if a is Dictionary:
		var out := {}
		for key in a:
			out[key] = mix(a[key], b[key], u) if b.has(key) else a[key]
		return out
	if a is Array:
		var arr := []
		for i in a.size():
			arr.append(lerpf(float(a[i]), float(b[i]), u))
		return arr
	if a is String:
		return a if u < 0.5 else b
	return lerpf(float(a), float(b), u)


## поза по ключам [[доля времени, поза], …]; между ключами — плавно
static func at_keys(keys: Array, x: float) -> Dictionary:
	for i in range(keys.size() - 1):
		if x <= float(keys[i + 1][0]) or i == keys.size() - 2:
			var u := clampf((x - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.0001), 0.0, 1.0)
			return mix(keys[i][1], keys[i + 1][1], u * u * (3.0 - 2.0 * u))
	return keys[0][1]


# ---------------- поставить позу на скелет ----------------

func apply(p: Dictionary) -> void:
	s.reset_bone_poses()
	# таз
	var hip: int = _b.Hip
	var hp: Dictionary = p.hip
	var G := s.get_bone_global_rest(hip)
	s.set_bone_global_pose(hip, Transform3D(rot(hp.yaw, hp.lean, hp.roll) * G.basis, G.origin + v(hp.off)))
	# грудь: добавка поровну на три позвонка
	var ch: Dictionary = p.chest
	var part := rot(float(ch.yaw) / 3.0, float(ch.lean) / 3.0)
	for n in ["Waist", "Spine01", "Spine02"]:
		var T := s.get_bone_global_pose(_b[n])
		T.basis = part * T.basis
		s.set_bone_global_pose(_b[n], T)
	# голова смотрит куда задано (шея — на полпути)
	var hd: Dictionary = p.head
	var want := rot(hd.yaw, hd.pitch)
	for n in ["NeckTwist01", "Head"]:
		var T := s.get_bone_global_pose(_b[n])
		var tgt := want * s.get_bone_global_rest(_b[n]).basis
		T.basis = T.basis.orthonormalized().slerp(tgt.orthonormalized(), 0.5 if n == "NeckTwist01" else 1.0)
		s.set_bone_global_pose(_b[n], T)
	for side in ["L", "R"]:
		_leg(side, p["foot" + side])
	var Gc := s.get_bone_global_pose(_b.Spine02)
	var Tb := (Gc * s.get_bone_global_rest(_b.Spine02).affine_inverse()).basis.orthonormalized()
	for side in ["L", "R"]:
		_hand(side, p["hand" + side], Tb)


func _leg(side: String, f: Dictionary) -> void:
	var th: int = _b[side + "Thigh"]
	var ca: int = _b[side + "Calf"]
	var fo: int = _b[side + "Foot"]
	var to: int = _b[side + "ToeBase"]
	var A0 := s.get_bone_global_rest(fo)
	var B0 := s.get_bone_global_rest(to)
	var Ry := Basis(upv, -deg_to_rad(float(f.yaw)))
	var lat := Ry * rgt
	# подъём пятки: стопа вращается вокруг подушечки
	var d0 := A0.origin - B0.origin
	var back := -(d0 - upv * d0.dot(upv))
	var heel := asin(clampf(float(f.heel) * k / maxf(back.length(), 0.001), 0.0, 0.9))
	var Rh := Basis(lat, -heel)
	var ball := B0.origin + (fwd * float(f.pos[0]) + rgt * float(f.pos[1])) * k
	var ankle := ball + Rh * (Ry * d0)
	var flat := Rh * Ry * A0.basis
	var free := float(f.get("free", 0.0))
	if free > 0.001:
		ankle = ankle.lerp(A0.origin + v(f.air), free)
	_two_bone(th, ca, fo, ankle, (Ry * fwd) + upv * 0.2 * free)
	var F := s.get_bone_global_pose(fo)
	F.basis = flat.orthonormalized().slerp(F.basis.orthonormalized(), free)
	s.set_bone_global_pose(fo, F)
	if free < 0.5:
		var T := s.get_bone_global_pose(to)
		T.basis = Ry * B0.basis
		s.set_bone_global_pose(to, T)


func _two_bone(a: int, b: int, c: int, target: Vector3, pole: Vector3) -> void:
	var A := s.get_bone_global_pose(a)
	var B := s.get_bone_global_pose(b)
	var C := s.get_bone_global_pose(c)
	var la := A.origin.distance_to(B.origin)
	var lb := B.origin.distance_to(C.origin)
	var at := target - A.origin
	var dist := clampf(at.length(), absf(la - lb) + 0.001, (la + lb) * 0.999)
	var dir := at.normalized()
	pole = pole - dir * pole.dot(dir)
	pole = pole.normalized() if pole.length() > 0.001 else fwd
	var cos_a := clampf((la * la + dist * dist - lb * lb) / (2.0 * la * dist), -1.0, 1.0)
	var nb := A.origin + dir * (la * cos_a) + pole * (la * sqrt(1.0 - cos_a * cos_a))
	A.basis = Basis(Quaternion((B.origin - A.origin).normalized(), (nb - A.origin).normalized())) * A.basis
	s.set_bone_global_pose(a, A)
	var B2 := s.get_bone_global_pose(b)
	var C2 := s.get_bone_global_pose(c)
	B2.basis = Basis(Quaternion((C2.origin - B2.origin).normalized(), (A.origin + dir * dist - B2.origin).normalized())) * B2.basis
	s.set_bone_global_pose(b, B2)


func _hand(side: String, a: Dictionary, Tb: Basis) -> void:
	var sg := 1.0 if side == "R" else -1.0
	var S := s.get_bone_global_pose(_b[side + "Upperarm"]).origin
	var bo := (s.get_bone_global_pose(_b.LUpperarm).origin + s.get_bone_global_pose(_b.RUpperarm).origin) * 0.5
	var bf := Tb * fwd
	var bu := Tb * upv
	var br := Tb * rgt
	var hang := float(a.get("hang", 0.0))
	# висящая рука: кисть у бедра, ладонь к бедру и чуть назад, локоть слегка согнут и смотрит назад
	var reach: float = (float(h._hf[side].la) + float(h._hf[side].lb)) / k
	var palm_h := S + (fwd * 0.07 - upv * (reach * 0.975 + 0.085) + rgt * (0.06 * sg)) * k
	var F_h := d([0.12, -1.0, 0.0])
	var P_h := d([-0.35, 0.0, -sg])
	var palm := bo + v(a.pos)
	var F := d(a.F)
	var P := d(a.P)
	if hang > 0.0:
		palm = palm.lerp(palm_h, hang)
		F = F.slerp(F_h, hang)
		P = P.slerp(P_h, hang)
	# прямой удар: рука вытянута от плеча по направлению dir, кисть — продолжение предплечья
	var ext := float(a.get("ext", 0.0))
	if ext > 0.0:
		var dr := d(a.dir)
		palm = palm.lerp(S + dr * ((reach * 0.975 + 0.094) * k), ext)
		F = F.slerp(dr, ext)
	P = (P - F * P.dot(F)).normalized()
	var A := F.cross(P) * float(h._hf[side].psign)
	var t := h._target(side, palm, A, P)
	var pole: Vector3
	if hang > 0.5:
		pole = -fwd + rgt * (0.25 * sg)
	else:
		var best := h._best_psi(side, S, t[0], t[1], bo, bf, bu, br)
		pole = h._pole(side, ((t[0] as Vector3) - S).normalized(), bu, br, float(best[0]))
	h._arm(s, side, t[0], t[1], pole)
	h._curl(s, side, String(a.get("curl", "relax")))


## снять позу со скелета: кость → [положение, поворот]
func capture() -> Dictionary:
	var out := {}
	for i in s.get_bone_count():
		out[i] = [s.get_bone_pose_position(i), s.get_bone_pose_rotation(i)]
	return out


# ---------------- клипы ----------------

## клип из функции «время → поза»
func clip(length: float, loop: bool, fn: Callable, fps := 20.0) -> Animation:
	var a := Animation.new()
	a.length = length
	a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	var n := maxi(2, ceili(length * fps))
	var rt := {}
	var hip: int = _b.Hip
	var pt := a.add_track(Animation.TYPE_POSITION_3D)
	a.track_set_path(pt, "%s:%s" % [skel_path, s.get_bone_name(hip)])
	for i in s.get_bone_count():
		var t := a.add_track(Animation.TYPE_ROTATION_3D)
		a.track_set_path(t, "%s:%s" % [skel_path, s.get_bone_name(i)])
		rt[i] = t
	for j in n + 1:
		var tm := length * j / n
		apply(fn.call(0.0 if (loop and j == n) else tm))
		var c := capture()
		a.position_track_insert_key(pt, tm, c[hip][0])
		for i in s.get_bone_count():
			a.rotation_track_insert_key(rt[i], tm, c[i][1])
	s.reset_bone_poses()
	return a


func _add(name: String, a: Animation, lib: AnimationLibrary, info: Dictionary, blend := 0.25, ik := true) -> void:
	if lib.has_animation(name):
		# клип Tripo остаётся для сравнения
		if not lib.has_animation(name + "_tripo"):
			lib.add_animation(name + "_tripo", lib.get_animation(name))
			info[name + "_tripo"] = info[name]
		lib.remove_animation(name)
	lib.add_animation(name, a)
	info[name] = {"len": a.length, "speed": 0.0, "loop": a.loop_mode != Animation.LOOP_NONE, "blend": blend, "rate": 1.0, "lock": true,
		"native": 0.0, "dir": Vector3.ZERO, "phase": 0.0, "strides": 0.0, "ik": ik, "off": false, "ground": false, "built": true}


## стойка с дыханием: грудь поднимается и опускается (4 с), вес чуть переходит с ноги на ногу (8 с) — сантиметр,
## а не тридцать
func _breath(base: Dictionary, length := 8.0) -> Callable:
	return func(t: float) -> Dictionary:
		var b := sin(TAU * t / 4.0)
		var w := sin(TAU * t / length)
		return over(base, {
			"hip": {"off": [float(base.hip.off[0]), float(base.hip.off[1]) + 0.002 * b, float(base.hip.off[2]) + 0.005 * w],
				"roll": float(base.hip.roll) + 0.5 * w},
			"chest": {"lean": float(base.chest.lean) - 0.9 * b, "yaw": float(base.chest.yaw)},
		})


## собрать все позы и движения в библиотеку персонажа
func install(lib: AnimationLibrary, info: Dictionary) -> void:
	_add("idle", clip(8.0, true, _breath(NEUTRAL), 4.0), lib, info, 0.3)
	_add("combat_idle", clip(8.0, true, _breath(COMBAT), 4.0), lib, info, 0.25)
	_add("armed_idle", clip(8.0, true, _breath(ARMED), 4.0), lib, info, 0.25)
	# джеб: передняя (левая) рука по прямой в цель на уровне подбородка, плечо закрывает челюсть, кулак ладонью вниз
	var jab := over(COMBAT, {"hip": {"off": [0.04, -0.075, 0.0], "yaw": 32.0}, "chest": {"yaw": 22.0, "lean": 8.0},
		"handL": {"ext": 1.0, "dir": [1.0, 0.1, 0.16], "P": [0.0, -1.0, 0.15]}})
	_add("punch_light", clip(0.5, false, func(t): return at_keys([[0.0, COMBAT], [0.34, jab], [0.44, jab], [1.0, COMBAT]], t / 0.5), 30.0), lib, info, 0.1)
	# кросс: задняя (правая) рука, таз и плечи разворачиваются в удар, задняя пятка отрывается
	var cross := over(COMBAT, {"hip": {"off": [0.07, -0.085, -0.02], "yaw": -16.0, "lean": 7.0}, "chest": {"yaw": -16.0, "lean": 9.0},
		"footR": {"yaw": 12.0, "heel": 0.075},
		"handR": {"ext": 1.0, "dir": [1.0, 0.1, -0.2], "P": [0.0, -1.0, -0.15]},
		"handL": {"pos": [0.2, 0.08, -0.1]}})
	_add("punch_heavy", clip(0.7, false, func(t): return at_keys([[0.0, COMBAT], [0.38, cross], [0.5, cross], [1.0, COMBAT]], t / 0.7), 30.0), lib, info, 0.1)
	# прямой удар ногой (задней, правой): вес на левую ногу, колено вверх, выпрямление в живот, возврат
	var k1 := over(COMBAT, {"hip": {"off": [0.03, -0.05, -0.07], "yaw": 6.0, "lean": -4.0}, "chest": {"yaw": 4.0, "lean": 10.0},
		"footR": {"free": 1.0, "air": [0.16, 0.46, -0.05], "yaw": 0.0, "heel": 0.0}})
	var k2 := over(k1, {"hip": {"off": [0.06, -0.04, -0.08], "lean": -14.0}, "chest": {"lean": 16.0},
		"footR": {"air": [0.74, 0.74, -0.08]}})
	var k0 := over(COMBAT, {"footR": {"free": 0.0, "air": [-0.2, 0.03, 0.02]}})
	_add("kick", clip(1.0, false, func(t): return at_keys([[0.0, k0], [0.3, k1], [0.46, k2], [0.56, k2], [0.74, k1], [1.0, k0]], t), 30.0), lib, info, 0.12, false)
	# попадание спереди: корпус и голова отброшены назад, шаг назад правой, возврат
	var hit := over(NEUTRAL, {"hip": {"off": [-0.07, -0.04, 0.0], "lean": -7.0}, "chest": {"lean": -13.0, "yaw": 6.0}, "head": {"pitch": -12.0, "yaw": 8.0},
		"footR": {"pos": [-0.16, -0.01], "yaw": 14.0},
		"handL": {"hang": 0.75, "pos": [0.25, -0.2, -0.2], "F": [0.5, 0.6, 0.0], "P": [0.0, -0.3, 1.0]},
		"handR": {"hang": 0.75, "pos": [0.25, -0.2, 0.2], "F": [0.5, 0.6, 0.0], "P": [0.0, -0.3, -1.0]}})
	_add("hit_front", clip(0.7, false, func(t): return at_keys([[0.0, NEUTRAL], [0.2, hit], [0.4, hit], [1.0, NEUTRAL]], t / 0.7), 30.0), lib, info, 0.08)
	# отскок назад из боевой стойки: присел, корпус ушёл назад, руки закрывают голову
	var dg := over(COMBAT, {"hip": {"off": [-0.2, -0.13, 0.0], "lean": -6.0}, "chest": {"lean": -8.0}, "head": {"pitch": 10.0},
		"footL": {"pos": [0.08, 0.02]}, "footR": {"pos": [-0.34, 0.03], "heel": 0.0},
		"handL": {"pos": [0.22, 0.12, -0.06]}, "handR": {"pos": [0.14, 0.11, 0.08]}})
	_add("dodge_back", clip(0.6, false, func(t): return at_keys([[0.0, COMBAT], [0.3, dg], [0.5, dg], [1.0, COMBAT]], t / 0.6), 30.0), lib, info, 0.1)
