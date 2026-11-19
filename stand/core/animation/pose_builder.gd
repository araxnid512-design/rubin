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
var wrist := {}                   ## углы кистей последней поставленной позы (для проверки)
var report := []                  ## замеры кисти в ударах: строки для журнала


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

## прицел из длинного оружия: левая нога впереди, правая сзади и развёрнута наружу, колени согнуты, таз ниже,
## вес чуть на передней ноге, корпус подан вперёд — к оружию (наклон груди и посадку головы на приклад добавляет
## стойка оружия: BCWeaponHold, lean и head)
const AIM := {
	"hip": {"off": [0.07, -0.07, 0.0], "yaw": 14.0, "lean": 9.0, "roll": 0.0},
	"chest": {"yaw": 0.0, "lean": 4.0},
	"head": {"yaw": 0.0, "pitch": 0.0},
	"footL": {"pos": [0.2, 0.0], "yaw": 0.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"footR": {"pos": [-0.2, 0.05], "yaw": 40.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"handL": {"hang": 1.0, "pos": [0.1, -0.5, -0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, 1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
	"handR": {"hang": 1.0, "pos": [0.1, -0.5, 0.2], "F": [0.1, -1.0, 0.0], "P": [-0.3, 0.0, -1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
}

## покой с длинным оружием: стоит прямо, ноги на ширине плеч, носки чуть врозь, вес поровну (оружие поперёк
## груди стволом вниз-влево — стойка rest оружия)
const REST := {
	"hip": {"off": [0.0, -0.015, 0.0], "yaw": 0.0, "lean": 0.0, "roll": 0.0},
	"chest": {"yaw": 0.0, "lean": 2.0},
	"head": {"yaw": 0.0, "pitch": 0.0},
	"footL": {"pos": [0.0, -0.045], "yaw": -9.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
	"footR": {"pos": [0.0, 0.045], "yaw": 9.0, "heel": 0.0, "air": [0.0, 0.0, 0.0], "free": 0.0},
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


## поза по ключам [[доля времени, поза, ход], …]; ход — как идём К этому ключу: по умолчанию плавно (разгон и
## торможение), "in" — с разгоном до самого ключа (удар: кулак приходит в цель на полной скорости),
## "out" — быстро в начале и с торможением (возврат руки, отдёргивание)
static func at_keys(keys: Array, x: float) -> Dictionary:
	for i in range(keys.size() - 1):
		if x <= float(keys[i + 1][0]) or i == keys.size() - 2:
			var u := clampf((x - float(keys[i][0])) / maxf(float(keys[i + 1][0]) - float(keys[i][0]), 0.0001), 0.0, 1.0)
			var ease := String(keys[i + 1][2]) if (keys[i + 1] as Array).size() > 2 else ""
			if ease == "in":
				u = u * u * (1.6 - 0.6 * u)
			elif ease == "out":
				u = 1.0 - (1.0 - u) * (1.0 - u)
			else:
				u = u * u * (3.0 - 2.0 * u)
			return mix(keys[i][1], keys[i + 1][1], u)
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
	var ps := float(h._hf[side].psign)
	var A := F.cross(P) * ps
	var t := h._target(side, palm, A, P)
	var pole: Vector3
	if hang > 0.5:
		pole = -fwd + rgt * (0.25 * sg)
	else:
		var best := h._best_psi(side, S, t[0], t[1], bo, bf, bu, br)
		# Кулак: запястье прямое — кисть продолжает предплечье, костяшки указательного и среднего пальцев лежат
		# на оси предплечья (иначе при ударе кисть подламывается). Подбирается за несколько проходов: поворот
		# кисти сдвигает запястье, запястье меняет направление предплечья.
		var lockw := float(a.get("wrist", 1.0 if String(a.get("curl", "relax")) == "fist" else 0.0)) * (1.0 - hang)
		if lockw > 0.01:
			for it in 5:
				var ev := h._eval(side, S, t[0], t[1], bo, bf, bu, br, float(best[0]))
				var f := ((t[0] as Vector3) - (ev[2] as Vector3)).normalized()
				var Fn := (f - A * 0.1).normalized()
				F = F.slerp(Fn, lockw).normalized()
				P = (P - F * P.dot(F)).normalized()
				A = F.cross(P) * ps
				t = h._target(side, palm, A, P)
				best = h._best_psi(side, S, t[0], t[1], bo, bf, bu, br, float(best[0]))
		pole = h._pole(side, ((t[0] as Vector3) - S).normalized(), bu, br, float(best[0]))
	h._arm(s, side, t[0], t[1], pole)
	wrist[side] = h.joints[side]
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


func _add(name: String, a: Animation, lib: AnimationLibrary, info: Dictionary, blend := 0.25, ik := true, hit := 0.42) -> void:
	if lib.has_animation(name):
		# клип Tripo остаётся для сравнения
		if not lib.has_animation(name + "_tripo"):
			lib.add_animation(name + "_tripo", lib.get_animation(name))
			info[name + "_tripo"] = info[name]
		lib.remove_animation(name)
	lib.add_animation(name, a)
	info[name] = {"len": a.length, "speed": 0.0, "loop": a.loop_mode != Animation.LOOP_NONE, "blend": blend, "rate": 1.0, "lock": true,
		"native": 0.0, "dir": Vector3.ZERO, "phase": 0.0, "strides": 0.0, "ik": ik, "off": false, "ground": false, "built": true, "hit": hit}


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


## значение по циклическим ключам [[фаза 0..1, [числа]], …]: между ключами — линейно, стык цикла — без скачка
static func cyc(keys: Array, ph: float) -> Array:
	ph = fposmod(ph, 1.0)
	var n := keys.size()
	for i in n:
		var a: Array = keys[i]
		var b: Array = keys[(i + 1) % n]
		var pa := float(a[0])
		var pb := float(b[0]) + (1.0 if i == n - 1 else 0.0)
		if ph >= pa and ph <= pb:
			var u := (ph - pa) / maxf(pb - pa, 0.0001)
			var out := []
			for j in (a[1] as Array).size():
				out.append(lerpf(float(a[1][j]), float(b[1][j]), u))
			return out
	return keys[0][1]


## зеркальная поза: левое ↔ правое (удар левой — из удара правой)
static func mirror_pose(p: Dictionary) -> Dictionary:
	var o := p.duplicate(true)
	o.hip.yaw = -float(p.hip.yaw)
	o.hip.roll = -float(p.hip.get("roll", 0.0))
	o.hip.off = [p.hip.off[0], p.hip.off[1], -float(p.hip.off[2])]
	o.chest.yaw = -float(p.chest.yaw)
	o.head.yaw = -float(p.head.yaw)
	for pr in [["L", "R"], ["R", "L"]]:
		var f: Dictionary = (p["foot" + pr[1]] as Dictionary).duplicate(true)
		f.pos = [f.pos[0], -float(f.pos[1])]
		f.yaw = -float(f.yaw)
		f.air = [f.air[0], f.air[1], -float(f.air[2])]
		o["foot" + pr[0]] = f
		var h2: Dictionary = (p["hand" + pr[1]] as Dictionary).duplicate(true)
		for k2 in ["pos", "F", "P", "dir"]:
			if h2.has(k2):
				h2[k2] = [h2[k2][0], h2[k2][1], -float(h2[k2][2])]
		o["hand" + pr[0]] = h2
	return o


## Свои клипы вида сверх набора — по ключевым позам (скелетные, общие на всех персонажей этого вида).
## infected — заражённый (пустыш) по видео-образцу: стойка с осматриванием, бег за целью, удары руками.
func install_extra(lib: AnimationLibrary, info: Dictionary, kind: String) -> void:
	if kind != "infected":
		return
	# ---- ожидание: сутулая стойка, руки висят чуть впереди с согнутыми локтями, голова опущена; медленно
	# осматривается — голова ведёт, грудь доворачивает, вес переходит на ближнюю ногу; дыхание и покачивание ----
	var z_idle := over(NEUTRAL, {"hip": {"off": [0.0, -0.035, 0.0], "lean": 5.0}, "chest": {"lean": 15.0}, "head": {"pitch": 13.0},
		"footL": {"pos": [0.01, -0.05], "yaw": -9.0}, "footR": {"pos": [-0.02, 0.05], "yaw": 11.0},
		"handL": {"hang": 0.72, "pos": [0.22, -0.34, -0.25], "F": [0.5, -0.8, 0.1], "P": [-0.2, 0.0, 1.0]},
		"handR": {"hang": 0.66, "pos": [0.24, -0.32, 0.27], "F": [0.55, -0.75, -0.1], "P": [-0.2, 0.0, -1.0]}})
	var z_l := over(z_idle, {"hip": {"off": [0.0, -0.04, -0.014], "yaw": -3.0}, "chest": {"yaw": -10.0, "lean": 13.0}, "head": {"yaw": -36.0, "pitch": 9.0}})
	var z_r := over(z_idle, {"hip": {"off": [0.0, -0.04, 0.016], "yaw": 4.0}, "chest": {"yaw": 11.0, "lean": 14.0}, "head": {"yaw": 40.0, "pitch": 11.0}})
	var z_low := over(z_idle, {"chest": {"lean": 18.0}, "head": {"yaw": 6.0, "pitch": 21.0}})
	var idle_k := [[0.0, z_idle], [0.17, z_l], [0.29, z_l], [0.5, z_r], [0.6, z_r], [0.78, z_low], [1.0, z_idle]]
	var idle_len := 7.2
	_add("infected_idle", clip(idle_len, true, func(t: float) -> Dictionary:
		var p: Dictionary = at_keys(idle_k, t / idle_len)
		var br := sin(TAU * t / 3.6)
		var sw := sin(TAU * t / idle_len * 2.0)
		return over(p, {"chest": {"lean": float(p.chest.lean) - 1.1 * br}, "hip": {"off": [float(p.hip.off[0]) + 0.004 * sw, float(p.hip.off[1]) + 0.003 * br, p.hip.off[2]]},
			"handR": {"pos": [float(p.handR.pos[0]) + 0.012 * sw, p.handR.pos[1], p.handR.pos[2]]}}), 6.0), lib, info, 0.35)
	# ---- бег за целью: тяжёлый, с сильным наклоном; под скорость 2,9 м/с (цикл 0,7 с, шаг ~1 м): опорная стопа
	# идёт по земле ровно со скоростью тела (не скользит), маховая — по дуге с подъёмом пятки и выносом колена;
	# таз проседает на опоре и доворачивается за ногой, грудь — навстречу; руки — разные: правая машет шире и
	# ниже, левая поджата выше; голова держит цель ----
	var run_v := 2.9
	var run_T := 0.7
	var st_k := 0.4                                   # доля цикла на опоре
	var x0 := run_v * run_T * st_k * 0.5              # вынос стопы вперёд на постановке, м
	var foot := func(ph: float) -> Dictionary:
		ph = fposmod(ph, 1.0)
		if ph < st_k:
			var u := ph / st_k
			return {"pos": [x0 - 2.0 * x0 * u, 0.0], "yaw": 0.0, "heel": 0.09 * smoothstep(0.62, 1.0, u), "free": 0.0, "air": [x0 - 2.0 * x0 * u, 0.03, 0.0]}
		var sw2 := (ph - st_k) / (1.0 - st_k)
		# дуга маха: от отрыва до постановки, скорость на концах — как у земли (стопа «загребает» назад перед постановкой)
		var m := -run_v * run_T * (1.0 - st_k)
		var hx := (2.0 * sw2 * sw2 * sw2 - 3.0 * sw2 * sw2 + 1.0) * -x0 + (sw2 * sw2 * sw2 - 2.0 * sw2 * sw2 + sw2) * m + (-2.0 * sw2 * sw2 * sw2 + 3.0 * sw2 * sw2) * x0 + (sw2 * sw2 * sw2 - sw2 * sw2) * m
		var hy := 0.03 + 0.34 * sin(PI * sw2) * (1.0 - 0.4 * sw2)
		var fr := smoothstep(0.0, 0.14, sw2) * (1.0 - smoothstep(0.9, 1.0, sw2))
		return {"pos": [hx, 0.0], "yaw": 0.0, "heel": 0.09 * (1.0 - smoothstep(0.0, 0.3, sw2)), "free": fr, "air": [hx, hy, 0.0]}
	var run_pose := func(ph: float) -> Dictionary:
		# фаза 0 — постановка левой стопы; правая — через полцикла
		var sR := cos(TAU * (ph - 0.45))               # +1 — правая рука впереди (левая нога в отрыве назад… правая в махе)
		var uR := 0.5 + 0.5 * sR
		var uL := 1.0 - uR
		var bob := -0.075 + 0.032 * cos(TAU * 2.0 * (ph - 0.45))
		var tw := cos(TAU * (ph + 0.05))               # +1 — левая нога впереди
		return {
			"hip": {"off": [0.02, bob, 0.012 * sin(TAU * (ph - 0.2))], "yaw": 8.0 * tw, "lean": 14.0, "roll": 2.5 * sin(TAU * (ph - 0.2))},
			"chest": {"yaw": -17.0 * tw, "lean": 19.0 + 2.0 * cos(TAU * 2.0 * (ph - 0.2))},
			"head": {"yaw": 0.0, "pitch": 3.0},
			"footL": foot.call(ph), "footR": foot.call(ph + 0.5),
			"handL": {"hang": 0.0, "pos": [lerpf(-0.13, 0.25, uL), lerpf(-0.2, -0.03, uL), lerpf(-0.24, -0.15, uL)], "F": [0.75, 0.6, 0.15], "P": [0.0, -0.3, 1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
			"handR": {"hang": 0.0, "pos": [lerpf(-0.3, 0.3, uR), lerpf(-0.32, -0.15, uR), lerpf(0.27, 0.2, uR)], "F": [0.85, 0.35, -0.1], "P": [0.0, -0.3, -1.0], "curl": "relax", "ext": 0.0, "dir": [1.0, 0.0, 0.0]},
		}
	_add("infected_chase_run", clip(run_T, true, func(t: float) -> Dictionary: return run_pose.call(t / run_T), 60.0), lib, info, 0.25, false, 0.0)
	info["infected_chase_run"].speed = run_v
	info["infected_chase_run"].strides = 1.0
	# ---- удары: из полуприседа с руками-когтями перед грудью ----
	var z_ready := over(NEUTRAL, {"hip": {"off": [0.02, -0.095, 0.0], "lean": 8.0}, "chest": {"lean": 15.0}, "head": {"pitch": 4.0},
		"footL": {"pos": [0.14, -0.07], "yaw": -6.0}, "footR": {"pos": [-0.13, 0.07], "yaw": 16.0},
		"handL": {"hang": 0.0, "pos": [0.3, -0.06, -0.2], "F": [0.75, 0.6, 0.1], "P": [0.2, -0.5, 1.0]},
		"handR": {"hang": 0.0, "pos": [0.26, -0.1, 0.23], "F": [0.75, 0.6, -0.1], "P": [0.2, -0.5, -1.0]}})
	# размашистый удар правой: замах — правое плечо и рука уходят назад-вбок на уровне плеча, вес на задней ноге;
	# удар — таз и грудь доворачиваются, рука идёт по дуге вперёд и поперёк, вес на передней ноге, пятка задней
	# отрывается; проводка — рука уходит за середину; возврат в стойку
	var r_wind := over(z_ready, {"hip": {"off": [-0.035, -0.1, 0.02], "yaw": 14.0, "lean": 4.0}, "chest": {"yaw": 30.0, "lean": 9.0}, "head": {"yaw": -6.0},
		"handR": {"hang": 0.0, "pos": [-0.14, 0.04, 0.5], "F": [0.3, 0.3, 1.0], "P": [1.0, -0.2, 0.0]},
		"handL": {"pos": [0.3, -0.02, -0.14]}})
	var r_hit := over(z_ready, {"hip": {"off": [0.12, -0.115, -0.02], "yaw": -16.0, "lean": 12.0}, "chest": {"yaw": -28.0, "lean": 19.0}, "head": {"yaw": 5.0, "pitch": 6.0},
		"footR": {"pos": [-0.13, 0.07], "yaw": 6.0, "heel": 0.07},
		"handR": {"hang": 0.0, "ext": 1.0, "dir": [1.0, 0.02, -0.22], "P": [0.0, -1.0, 0.0]},
		"handL": {"pos": [0.16, -0.12, -0.26]}})
	var r_thru := over(r_hit, {"hip": {"yaw": -20.0}, "chest": {"yaw": -38.0, "lean": 21.0},
		"handR": {"hang": 0.0, "ext": 0.55, "dir": [0.6, -0.25, -0.75], "pos": [0.3, -0.16, -0.22], "P": [0.0, -1.0, 0.0]}})
	var atk_r := [[0.0, z_ready], [0.3, r_wind, "out"], [0.36, r_wind], [0.5, r_hit, "in"], [0.62, r_thru, "out"], [1.0, z_ready]]
	_add("infected_attack_right", clip(0.95, false, func(t: float) -> Dictionary: return at_keys(atk_r, t / 0.95), 40.0), lib, info, 0.12, true, 0.5)
	var atk_l: Array = []
	var z_ready_m := mirror_pose(z_ready)
	for kf in atk_r:
		var mk: Array = [kf[0], mirror_pose(kf[1])]
		if (kf as Array).size() > 2:
			mk.append(kf[2])
		atk_l.append(mk)
	# удар левой начинается и кончается в той же стойке, что и правой (ноги не переставляются)
	atk_l[0] = [0.0, z_ready]
	atk_l[atk_l.size() - 1] = [1.0, z_ready]
	for i2 in range(1, atk_l.size() - 1):
		atk_l[i2][1] = over(atk_l[i2][1], {"footL": z_ready.footL, "footR": over(z_ready.footR, {"heel": 0.0}), "hip": {"off": [float(atk_l[i2][1].hip.off[0]), atk_l[i2][1].hip.off[1], float(atk_l[i2][1].hip.off[2]) * 0.5]}})
	if z_ready_m.is_empty():
		return
	_add("infected_attack_left", clip(0.95, false, func(t: float) -> Dictionary: return at_keys(atk_l, t / 0.95), 40.0), lib, info, 0.12, true, 0.5)
	# попытка схватить: руки подтягиваются к груди, корпус на миг выпрямляется; выпад — шаг передней ногой, таз и
	# плечи вперёд, обе руки вытянуты к цели и сходятся, голова за руками; возврат в стойку
	var g_wind2 := over(z_ready, {"hip": {"off": [-0.04, -0.07, 0.0], "lean": 3.0}, "chest": {"lean": 7.0}, "head": {"pitch": -2.0},
		"handL": {"pos": [0.2, 0.02, -0.24], "F": [0.5, 0.85, 0.0], "P": [0.6, -0.3, 0.7]},
		"handR": {"pos": [0.2, 0.02, 0.26], "F": [0.5, 0.85, 0.0], "P": [0.6, -0.3, -0.7]}})
	var g_step2 := over(g_wind2, {"hip": {"off": [0.06, -0.09, 0.0], "lean": 10.0}, "chest": {"lean": 14.0},
		"footL": {"free": 1.0, "air": [0.24, 0.07, -0.07]}})
	var g_reach := over(z_ready, {"hip": {"off": [0.2, -0.125, 0.0], "lean": 18.0}, "chest": {"lean": 24.0}, "head": {"pitch": 2.0},
		"footL": {"pos": [0.34, -0.07], "yaw": -4.0}, "footR": {"pos": [-0.13, 0.07], "yaw": 10.0, "heel": 0.08},
		"handL": {"hang": 0.0, "ext": 1.0, "dir": [1.0, 0.12, 0.16], "P": [0.3, -0.6, 0.7]},
		"handR": {"hang": 0.0, "ext": 1.0, "dir": [1.0, 0.12, -0.16], "P": [0.3, -0.6, -0.7]}})
	var g_clutch := over(g_reach, {"hip": {"off": [0.21, -0.13, 0.0]}, "chest": {"lean": 27.0},
		"handL": {"hang": 0.0, "ext": 0.78, "dir": [1.0, 0.0, 0.3], "pos": [0.34, -0.06, -0.08], "P": [0.2, -0.3, 1.0]},
		"handR": {"hang": 0.0, "ext": 0.78, "dir": [1.0, 0.0, -0.3], "pos": [0.34, -0.06, 0.08], "P": [0.2, -0.3, -1.0]}})
	var g_back := over(z_ready, {"footL": {"free": 1.0, "air": [0.24, 0.05, -0.07]}, "hip": {"off": [0.1, -0.1, 0.0]}})
	var atk_g := [[0.0, z_ready], [0.24, g_wind2, "out"], [0.36, g_step2], [0.5, g_reach, "in"], [0.6, g_clutch], [0.7, g_clutch], [0.86, g_back], [1.0, z_ready]]
	_add("infected_attack_grab", clip(1.05, false, func(t: float) -> Dictionary: return at_keys(atk_g, t / 1.05), 40.0), lib, info, 0.12, true, 0.5)


## собрать все позы и движения в библиотеку персонажа
func install(lib: AnimationLibrary, info: Dictionary) -> void:
	_add("idle", clip(8.0, true, _breath(NEUTRAL), 4.0), lib, info, 0.3)
	_add("combat_idle", clip(8.0, true, _breath(COMBAT), 4.0), lib, info, 0.25)
	_add("armed_idle", clip(8.0, true, _breath(ARMED), 4.0), lib, info, 0.25)
	_add("aim_idle", clip(8.0, true, _breath(AIM), 4.0), lib, info, 0.2)
	_add("rest_idle", clip(8.0, true, _breath(REST), 4.0), lib, info, 0.25)
	# Джеб: передняя (левая) рука по прямой в цель на уровне подбородка, без замаха. Плечо поднимается и
	# закрывает челюсть, кулак в конце разворачивается ладонью вниз, правая остаётся у подбородка. Рука
	# выбрасывается с разгоном (кулак приходит в цель на полной скорости) и сразу отдёргивается обратно.
	var jab := over(COMBAT, {"hip": {"off": [0.045, -0.078, 0.0], "yaw": 33.0}, "chest": {"yaw": 22.0, "lean": 8.0},
		"footL": {"pos": [0.23, 0.02]},
		"handL": {"ext": 1.0, "dir": [1.0, 0.1, 0.16], "P": [0.0, -1.0, 0.15]},
		"handR": {"pos": [0.16, 0.085, 0.09]}})
	var jab_k := [[0.0, COMBAT], [0.3, jab, "in"], [0.38, jab], [0.66, COMBAT, "out"], [1.0, COMBAT]]
	_add("punch_light", clip(0.5, false, func(t): return at_keys(jab_k, t / 0.5), 40.0), lib, info, 0.1, true, 0.34)
	# Кросс: задняя (правая) рука. Удар идёт от ног: сначала доворачивается таз и отрывается задняя пятка,
	# потом плечи, и только потом выбрасывается рука — кулак приходит последним и самым быстрым. Левая рука
	# возвращается к щеке. После удара — быстрый возврат в стойку.
	var drive := over(COMBAT, {"hip": {"off": [0.035, -0.082, -0.01], "yaw": 6.0, "lean": 6.0}, "chest": {"yaw": 2.0, "lean": 8.0},
		"footR": {"yaw": 26.0, "heel": 0.05},
		"handR": {"ext": 0.1, "dir": [1.0, 0.1, -0.2]},
		"handL": {"pos": [0.22, 0.085, -0.09]}})
	var cross := over(COMBAT, {"hip": {"off": [0.075, -0.088, -0.02], "yaw": -16.0, "lean": 7.0}, "chest": {"yaw": -17.0, "lean": 9.0},
		"footR": {"yaw": 12.0, "heel": 0.08},
		"handR": {"ext": 1.0, "dir": [1.0, 0.1, -0.2], "P": [0.0, -1.0, -0.15]},
		"handL": {"pos": [0.19, 0.085, -0.1]}})
	var cross_k := [[0.0, COMBAT], [0.2, drive], [0.38, cross, "in"], [0.46, cross], [0.72, COMBAT, "out"], [1.0, COMBAT]]
	_add("punch_heavy", clip(0.7, false, func(t): return at_keys(cross_k, t / 0.7), 40.0), lib, info, 0.1, true, 0.42)
	# замер: в момент удара кисть должна быть продолжением предплечья
	for it in [["джеб", jab, "L"], ["кросс", cross, "R"], ["боевая стойка, правая", COMBAT, "R"], ["боевая стойка, левая", COMBAT, "L"]]:
		apply(it[1])
		var j: Array = wrist[it[2]]
		report.append("%s: кисть — сгиб %.0f°, вбок %.0f°, локоть %.0f°" % [it[0], j[0], j[1], j[3]])
	s.reset_bone_poses()
	# Прямой удар ногой (задней, правой) в живот. Вес уходит на левую ногу, колено поднимается к груди (голень
	# висит, стопа под коленом), таз подаётся вперёд и нога выпрямляется пяткой в цель, корпус для равновесия
	# отклоняется назад, руки остаются у головы. Затем нога сгибается обратно и ставится на место.
	var kl := over(COMBAT, {"hip": {"off": [0.03, -0.06, -0.06], "yaw": 14.0, "lean": 2.0}, "chest": {"yaw": 6.0, "lean": 8.0},
		"footL": {"yaw": -14.0}, "footR": {"heel": 0.07}})
	var k1 := over(COMBAT, {"hip": {"off": [0.05, -0.04, -0.09], "yaw": 2.0, "lean": -6.0}, "chest": {"yaw": 2.0, "lean": 10.0},
		"footL": {"yaw": -22.0},
		"footR": {"free": 1.0, "air": [0.26, 0.50, -0.06], "yaw": 0.0, "heel": 0.0},
		"handL": {"pos": [0.26, 0.1, -0.08]}, "handR": {"pos": [0.2, 0.08, 0.12]}})
	var k2 := over(k1, {"hip": {"off": [0.13, -0.03, -0.1], "yaw": -4.0, "lean": -20.0}, "chest": {"lean": 18.0},
		"footR": {"air": [0.98, 0.86, -0.1]}})
	var k0 := over(COMBAT, {"footR": {"free": 0.0, "air": [-0.2, 0.03, 0.02]}})
	var kick_k := [[0.0, k0], [0.16, kl], [0.36, k1], [0.5, k2, "in"], [0.58, k2], [0.74, k1, "out"], [0.88, kl], [1.0, k0]]
	_add("kick", clip(1.0, false, func(t): return at_keys(kick_k, t), 40.0), lib, info, 0.12, false, 0.54)
	# ---- Главарь муров с пистолетом: стойки и движения по видео-образцу (руку с оружием ведёт хват) ----
	# Стрельба с двух рук: ноги чуть шире плеч, левая на полшага впереди, колени согнуты, корпус подан вперёд,
	# голова опущена к прицелу.
	var b_aim := over(ARMED, {"hip": {"off": [0.03, -0.075, 0.0], "yaw": 14.0, "lean": 6.0}, "chest": {"yaw": -6.0, "lean": 8.0}, "head": {"pitch": 5.0},
		"footL": {"pos": [0.16, 0.05], "yaw": 2.0}, "footR": {"pos": [-0.16, -0.05], "yaw": 32.0, "heel": 0.01}})
	_add("boss_pistol_aim", clip(8.0, true, _breath(b_aim), 4.0), lib, info, 0.2)
	# Выстрел: спуск — и корпус с головой коротко отдают назад, таз подсаживается (кисти и пистолет подбрасывает
	# отдача хвата). Момент выстрела — метка клипа (hit): по ней игра считает попадание, вспышку и звук.
	var b_kick := over(b_aim, {"hip": {"off": [0.012, -0.084, 0.0], "lean": 3.0}, "chest": {"lean": 2.5, "yaw": -4.0}, "head": {"pitch": 1.0}})
	_add("boss_pistol_fire", clip(0.16, false, func(t): return at_keys([[0.0, b_aim], [0.3, b_aim], [0.8, b_kick, "in"], [1.0, b_kick]], t / 0.16), 60.0), lib, info, 0.04, false, 0.3)
	# Возврат после выстрела: корпус проходит чуть вперёд за линию прицела и успокаивается — без повторного вскидывания.
	var b_over := over(b_aim, {"chest": {"lean": 9.5}, "hip": {"lean": 6.8}})
	_add("boss_pistol_recover", clip(0.34, false, func(t): return at_keys([[0.0, b_kick], [0.45, b_over, "out"], [1.0, b_aim]], t / 0.34), 40.0), lib, info, 0.04)
	# Граната левой рукой (пистолет в правой опущен). Подготовка: левая кисть — к подсумку на груди, взгляд вниз.
	var g_ready := over(ARMED, {"hip": {"off": [0.0, -0.05, 0.0], "yaw": 6.0}, "chest": {"yaw": -8.0, "lean": 6.0}, "head": {"pitch": 10.0, "yaw": -6.0},
		"handL": {"hang": 0.0, "pos": [0.17, -0.25, -0.04], "F": [0.1, -0.35, 0.93], "P": [-1.0, 0.0, 0.1]}})
	_add("boss_grenade_prepare", clip(0.5, false, func(t): return at_keys([[0.0, ARMED], [0.7, g_ready, "out"], [1.0, g_ready]], t / 0.5), 40.0), lib, info, 0.12)
	# Замах: рука с гранатой уходит назад и вверх за плечо, корпус разворачивается левым плечом назад, вес — на
	# задней (левой) ноге, правая впереди. Бросок: корпус доворачивается, вес переходит на переднюю ногу, рука
	# выпрямляется вперёд и вверх — граната уходит (метка hit). Проводка: рука падает вниз-вперёд, корпус в наклоне.
	var g_wind := over(ARMED, {"hip": {"off": [-0.06, -0.07, 0.0], "yaw": -18.0, "lean": -3.0}, "chest": {"yaw": -34.0, "lean": -4.0}, "head": {"yaw": 22.0},
		"footR": {"pos": [0.2, -0.02], "yaw": 6.0}, "footL": {"pos": [-0.2, 0.05], "yaw": -30.0},
		"handL": {"hang": 0.0, "pos": [-0.44, 0.16, -0.36], "F": [-0.2, 0.9, -0.2], "P": [1.0, 0.1, 0.0]}})
	var g_rel := over(ARMED, {"hip": {"off": [0.1, -0.1, 0.0], "yaw": 20.0, "lean": 10.0}, "chest": {"yaw": 26.0, "lean": 14.0}, "head": {"yaw": -8.0},
		"footR": {"pos": [0.24, -0.02], "yaw": 4.0}, "footL": {"pos": [-0.2, 0.05], "yaw": -20.0, "heel": 0.07},
		"handL": {"hang": 0.0, "ext": 1.0, "dir": [1.0, 0.42, 0.06], "P": [0.0, -1.0, 0.0]}})
	var g_follow := over(g_rel, {"hip": {"off": [0.14, -0.13, 0.0], "lean": 14.0}, "chest": {"yaw": 34.0, "lean": 22.0},
		"handL": {"hang": 0.0, "ext": 1.0, "dir": [0.8, -0.55, 0.3], "P": [0.0, -1.0, 0.0]}})
	# шаг правой ногой вперёд на замахе — стопа переносится по воздуху, а не едет по земле
	var g_step := over(g_ready, {"hip": {"off": [-0.03, -0.06, 0.0], "yaw": -6.0}, "chest": {"yaw": -22.0, "lean": 1.0}, "head": {"pitch": 2.0, "yaw": 12.0},
		"footR": {"free": 1.0, "air": [0.08, 0.09, -0.02]}, "footL": {"pos": [-0.1, 0.04], "yaw": -16.0},
		"handL": {"hang": 0.0, "pos": [-0.16, -0.04, -0.32], "F": [-0.3, 0.5, -0.2], "P": [0.6, 0.2, 0.7]}})
	_add("boss_grenade_throw", clip(0.62, false, func(t): return at_keys([[0.0, g_ready], [0.2, g_step], [0.42, g_wind, "out"], [0.52, g_wind], [0.7, g_rel, "in"], [1.0, g_follow, "out"]], t / 0.62), 40.0), lib, info, 0.06, false, 0.7)
	_add("boss_grenade_recover", clip(0.6, false, func(t): return at_keys([[0.0, g_follow], [0.3, g_follow], [1.0, ARMED, "out"]], t / 0.6), 40.0), lib, info, 0.08)
	# остальные клипы главаря — те же движения набора под своими именами (стойка, бег, попадание, гибель)
	for pr in [["boss_idle", "armed_idle"], ["boss_pistol_run", "run"], ["boss_hit", "stagger"], ["boss_death", "death"]]:
		if lib.has_animation(pr[1]) and not lib.has_animation(pr[0]):
			lib.add_animation(pr[0], lib.get_animation(pr[1]).duplicate())
			info[pr[0]] = (info[pr[1]] as Dictionary).duplicate()
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
