class_name ULEliteAnim
extends RefCounted
## Шесть движений Элиты — по двум видео пользователя (26.11), настоящей скелетной анимацией: на каждый кадр
## (30 в секунду) — поворот каждой кости и положение корня. Лапы ставятся решателем (две кости — плечо и
## предплечье, бедро и голень; кисть и стопа держат постановку): опорная лапа стоит на земле на одном месте, пока
## тело идёт над ней со скоростью шага (WALK_V) или галопа (RUN_V), — лапы не скользят.
##   elite_walk  (видео 1, 0–5 с)  — тяжёлый шаг: порядок лап ЛЗ → ЛП → ПЗ → ПП, перенос веса, кивки, хвост
##                                    уравновешивает;
##   elite_run   (видео 1, 5–10 с) — галоп: задние толкают парой, передние выбрасываются далеко, спина
##                                    сгибается и распрямляется, голова низко — на цель;
##   elite_idle  (видео 1, 10–15 с) — стоит: дышит, переносит вес, поворачивает голову влево и вправо,
##                                    принюхивается, пасть чуть приоткрыта, хвост медленно ходит;
##   elite_bite_attack (видео 2, 0–5 с) — поворот к цели, шея напряжена, корпус назад, пасть шире, бросок
##                                    головой вперёд, челюсти смыкаются (метка bite_hit), голова назад;
##   elite_claw_attack (видео 2, 5–10 с) — правая лапа, затем левая (метки claw_r_hit, claw_l_hit); одиночные —
##                                    elite_claw_r, elite_claw_l;
##   elite_death (видео 2, 10–15 с) — вздрагивает, голова вверх, передние подламываются, корпус заваливается
##                                    набок, задние подкашиваются, удар о землю (метка land), последние
##                                    подёргивания, замирает.

const WALK_V := 1.7
const RUN_V := 6.2
const FPS := 30.0
const WALK_T := 1.15
const RUN_T := 0.62
const LEGS := {
	"LF": ["L_Scapula", "L_UpperArm", "L_Forearm", "L_Hand", "L_Claws"],
	"RF": ["R_Scapula", "R_UpperArm", "R_Forearm", "R_Hand", "R_Claws"],
	"LH": ["L_Thigh", "L_Shin", "L_Foot", "L_Toes"],
	"RH": ["R_Thigh", "R_Shin", "R_Foot", "R_Toes"],
}

var names: Array = []
var par: Array = []
var off: Array = []                       ## сустав относительно родителя в покое
var rest_g: Array = []                    ## сустав в покое, в модели
var idx := {}
var leg_bones := {}                       ## кости лап — ими управляет решатель
var _verts: PackedVector3Array            ## для проверки «лёг на землю»
var _wts: Array = []
var report: Array = []                    ## строки проверки движений (пишет tools/elite_build.gd)


static func make_library(sk: Skeleton3D, verts := PackedVector3Array(), wts := []) -> AnimationLibrary:
	var g := ULEliteAnim.new()
	g.setup(sk, verts, wts)
	var lib := AnimationLibrary.new()
	lib.add_animation("elite_idle", g._make(6.0, true, g.idle, []))
	lib.add_animation("elite_walk", g._make(WALK_T, true, g.walk, [[0.0, "step"], [WALK_T * 0.5, "step"]]))
	lib.add_animation("elite_run", g._make(RUN_T, true, g.run, []))
	lib.add_animation("elite_bite_attack", g._make(1.8, false, g.bite, [[0.3, "swing"], [0.62, "bite_hit"]]))
	lib.add_animation("elite_claw_r", g._make(1.45, false, g.claw_r, [[0.32, "swing"], [0.46, "claw_r_hit"]]))
	lib.add_animation("elite_claw_l", g._make(1.45, false, g.claw_l, [[0.32, "swing"], [0.46, "claw_l_hit"]]))
	lib.add_animation("elite_claw_attack", g._make(2.25, false, g.claw_combo, [[0.32, "swing"], [0.46, "claw_r_hit"], [1.12, "swing"], [1.26, "claw_l_hit"]]))
	var death := g._make(3.3, false, g.death, [[1.85, "land"], [3.25, "end"]])
	g._ground_fix(death, 1.3)
	lib.add_animation("elite_death", death)
	lib.set_meta("report", g.report)
	return lib


func setup(sk: Skeleton3D, verts: PackedVector3Array, wts: Array) -> void:
	_verts = verts
	_wts = wts
	for i in sk.get_bone_count():
		names.append(sk.get_bone_name(i))
		par.append(sk.get_bone_parent(i))
		off.append(sk.get_bone_rest(i).origin)
		idx[sk.get_bone_name(i)] = i
		var p := sk.get_bone_rest(i).origin
		if par[i] >= 0:
			p += rest_g[par[i]]
		rest_g.append(p)
	for lg in LEGS:
		for b in LEGS[lg]:
			leg_bones[b] = lg


# ---------------- сборка дорожек ----------------

func _make(length: float, loop: bool, sampler: Callable, events: Array) -> Animation:
	var a := Animation.new()
	a.length = length
	a.loop_mode = Animation.LOOP_LINEAR if loop else Animation.LOOP_NONE
	a.step = 1.0 / FPS
	var tr: Array = []
	for i in names.size():
		var t := a.add_track(Animation.TYPE_ROTATION_3D)
		a.track_set_path(t, NodePath("Skel:" + String(names[i])))
		tr.append(t)
	var tp := a.add_track(Animation.TYPE_POSITION_3D)
	a.track_set_path(tp, NodePath("Skel:Root"))
	var n := int(round(length * FPS))
	var last := n - 1 if loop else n
	for f in range(last + 1):
		var t := float(f) / FPS
		var pose: Dictionary = sampler.call(t)
		var q: Array = solve(pose)
		for i in names.size():
			a.rotation_track_insert_key(tr[i], t, q[i])
		a.position_track_insert_key(tp, t, pose.get("root", Vector3.ZERO))
	if not events.is_empty():
		var mt := a.add_track(Animation.TYPE_METHOD)
		a.track_set_path(mt, NodePath(".."))
		for e in events:
			a.track_insert_key(mt, float(e[0]), {"method": "_anim_event", "args": [String(e[1])]})
	return a


# ---------------- поза → повороты костей ----------------

static func qd(deg: Vector3) -> Quaternion:
	return Quaternion.from_euler(Vector3(deg_to_rad(deg.x), deg_to_rad(deg.y), deg_to_rad(deg.z)))


## Поза: root — сдвиг корня, rq — поворот корня (градусы), rot — {кость: градусы} (туловище, шея, голова,
## челюсти, хвост, лопатки), legs — {LF/RF/LH/RH: {d — сдвиг опоры лапы от её места в покое, flex — сгиб кисти
## или стопы, рад}}, fk — {кость лапы: градусы} и fkw — доля «свободных» лап (смерть: лапы перестают держать).
func solve(pose: Dictionary) -> Array:
	var n := names.size()
	var loc: Array = []
	loc.resize(n)
	for i in n:
		loc[i] = Quaternion.IDENTITY
	loc[0] = qd(pose.get("rq", Vector3.ZERO))
	var rot: Dictionary = pose.get("rot", {})
	for b in rot:
		if idx.has(b):
			loc[idx[b]] = qd(rot[b])
	var gq: Array = []
	var gp: Array = []
	gq.resize(n)
	gp.resize(n)
	var root_p: Vector3 = pose.get("root", Vector3.ZERO)
	# туловище (лапы пока в покое)
	for i in n:
		_fk(i, loc, gq, gp, root_p)
	var legs: Dictionary = pose.get("legs", {})
	for lg in LEGS:
		var L: Array = LEGS[lg]
		var st: Dictionary = legs.get(lg, {})
		if lg.ends_with("F"):
			_front(L, st, loc, gq, gp, root_p, pose)
		else:
			_hind(L, st, loc, gq, gp, root_p, pose)
	# смерть: лапы отпускают опору — от решения к свободной позе
	var fkw := float(pose.get("fkw", 0.0))
	if fkw > 0.0:
		var fk: Dictionary = pose.get("fk", {})
		for b in leg_bones:
			var i: int = idx[b]
			var target := qd(fk.get(b, Vector3.ZERO))
			loc[i] = (loc[i] as Quaternion).slerp(target, fkw)
	return loc


func _fk(i: int, loc: Array, gq: Array, gp: Array, root_p: Vector3) -> void:
	if par[i] < 0:
		gq[i] = loc[i]
		gp[i] = root_p + off[i]
	else:
		gq[i] = (gq[par[i]] as Quaternion) * (loc[i] as Quaternion)
		gp[i] = (gp[par[i]] as Vector3) + (gq[par[i]] as Quaternion) * (off[i] as Vector3)


## две кости: из a к цели t, длины l1 и l2, колено (локоть) — в сторону pole; возвращает сустав посередине
static func ik2(a: Vector3, t: Vector3, l1: float, l2: float, pole: Vector3) -> Vector3:
	var d := t - a
	var dl := clampf(d.length(), absf(l1 - l2) + 0.02, l1 + l2 - 0.002)
	var dn := d.normalized()
	var ca := clampf((l1 * l1 + dl * dl - l2 * l2) / (2.0 * l1 * dl), -1.0, 1.0)
	var pn := pole - dn * pole.dot(dn)
	pn = pn.normalized() if pn.length() > 0.001 else Vector3.FORWARD
	return a + (dn * ca + pn * sqrt(1.0 - ca * ca)) * l1


## повернуть кость (её глобальный поворот сейчас base), чтобы её ось (направление на ребёнка в покое) смотрела в dir
static func aim(base: Quaternion, rest_dir: Vector3, dir: Vector3) -> Quaternion:
	var cur := (base * rest_dir).normalized()
	var to := dir.normalized()
	if cur.dot(to) > 0.99999:
		return base
	return Quaternion(cur, to) * base


func _front(L: Array, st: Dictionary, loc: Array, gq: Array, gp: Array, root_p: Vector3, pose: Dictionary) -> void:
	var sc: int = idx[L[0]]
	var up: int = idx[L[1]]
	var fo: int = idx[L[2]]
	var ha: int = idx[L[3]]
	var cl: int = idx[L[4]]
	var rq := qd(pose.get("rq", Vector3.ZERO))
	# лопатка (из rot) уже стоит; плечо — от неё
	_fk(sc, loc, gq, gp, root_p)
	_fk(up, loc, gq, gp, root_p)
	# опора — на земле, в осях модели (корпус может качаться и крениться — лапа стоит, где стояла)
	var target: Vector3 = (rest_g[ha] as Vector3) + (st.get("d", Vector3.ZERO) as Vector3)
	var l1 := (off[fo] as Vector3).length()
	var l2 := (off[ha] as Vector3).length()
	var s: Vector3 = gp[up]
	var side := signf((rest_g[ha] as Vector3).x)
	var pole := rq * Vector3(side * 0.15, 0.0, -1.0)            # локоть — назад
	var mid := ik2(s, target, l1, l2, pole)
	var gu := aim(gq[sc], off[fo], mid - s)
	loc[up] = (gq[sc] as Quaternion).inverse() * gu
	_fk(up, loc, gq, gp, root_p)
	_fk(fo, loc, gq, gp, root_p)
	var gf := aim(gq[fo], off[ha], target - mid)
	loc[fo] = (gq[up] as Quaternion).inverse() * gf
	_fk(fo, loc, gq, gp, root_p)
	_fk(ha, loc, gq, gp, root_p)
	# кисть: на опоре — плашмя (как в покое), в махе — подгибается
	var want := Quaternion(Vector3.RIGHT, float(st.get("flex", 0.0)))
	loc[ha] = (gq[fo] as Quaternion).inverse() * want
	_fk(ha, loc, gq, gp, root_p)
	loc[cl] = Quaternion(Vector3.RIGHT, float(st.get("claw", 0.0)))
	_fk(cl, loc, gq, gp, root_p)


func _hind(L: Array, st: Dictionary, loc: Array, gq: Array, gp: Array, root_p: Vector3, pose: Dictionary) -> void:
	var th: int = idx[L[0]]
	var sh: int = idx[L[1]]
	var ft: int = idx[L[2]]
	var to: int = idx[L[3]]
	var rq := qd(pose.get("rq", Vector3.ZERO))
	_fk(th, loc, gq, gp, root_p)
	var toes: Vector3 = (rest_g[to] as Vector3) + (st.get("d", Vector3.ZERO) as Vector3)
	# стопа (плюсна) держит наклон покоя, при отрыве пятка встаёт (flex)
	var fq := Quaternion(Vector3.RIGHT, float(st.get("flex", 0.0)))
	var hock := toes - fq * (off[to] as Vector3)
	var l1 := (off[sh] as Vector3).length()
	var l2 := (off[ft] as Vector3).length()
	var h: Vector3 = gp[th]
	var side := signf((rest_g[to] as Vector3).x)
	var pole := rq * Vector3(side * 0.2, 0.0, 1.0)              # колено — вперёд
	var mid := ik2(h, hock, l1, l2, pole)
	var gt := aim(gq[par[th]] as Quaternion, off[sh], mid - h)
	loc[th] = (gq[par[th]] as Quaternion).inverse() * gt
	_fk(th, loc, gq, gp, root_p)
	_fk(sh, loc, gq, gp, root_p)
	var gs := aim(gq[th], off[ft], hock - mid)
	loc[sh] = (gq[th] as Quaternion).inverse() * gs
	_fk(sh, loc, gq, gp, root_p)
	loc[ft] = (gq[sh] as Quaternion).inverse() * fq
	_fk(ft, loc, gq, gp, root_p)
	loc[to] = Quaternion(Vector3.RIGHT, float(st.get("toe", 0.0)))
	_fk(to, loc, gq, gp, root_p)


# ---------------- кривые ----------------

## значение по ключам [[время, значение], …] с плавным переходом между ключами
static func cv(keys: Array, t: float) -> float:
	if keys.is_empty():
		return 0.0
	if t <= float(keys[0][0]):
		return float(keys[0][1])
	for i in range(1, keys.size()):
		if t <= float(keys[i][0]):
			var t0 := float(keys[i - 1][0])
			var t1 := float(keys[i][0])
			var u := (t - t0) / maxf(t1 - t0, 1e-5)
			u = u * u * (3.0 - 2.0 * u)
			return lerpf(float(keys[i - 1][1]), float(keys[i][1]), u)
	return float(keys[keys.size() - 1][1])


## опора лапы в цикле шага: u — фаза лапы (0…1), duty — доля опоры, E — ход лапы, lift — подъём в махе
static func foot(u: float, duty: float, E: float, lift: float, front: bool) -> Dictionary:
	u = fposmod(u, 1.0)
	if u < duty:
		var s := u / duty
		# на опоре лапа на земле и уходит назад ровно со скоростью тела; в конце опоры пятка (кисть) встаёт
		var fl := (0.35 if not front else 0.5) * smoothstep(0.72, 1.0, s)
		return {"d": Vector3(0, 0, E * 0.5 - E * s), "flex": fl if not front else -fl * 0.4, "claw": 0.0, "stance": true}
	var w := (u - duty) / (1.0 - duty)
	var e := 0.5 - 0.5 * cos(PI * w)
	var y := lift * pow(sin(PI * w), 0.8)
	var flex := (0.95 if front else 0.55) * sin(PI * minf(w * 1.15, 1.0))
	return {"d": Vector3(0, y, -E * 0.5 + E * e), "flex": flex, "claw": 0.35 * sin(PI * w) if front else 0.0, "toe": 0.3 * sin(PI * w), "stance": false}


# ---------------- шаг ----------------

func walk(t: float) -> Dictionary:
	var p := t / WALK_T
	var duty := 0.65
	var E := WALK_V * duty * WALK_T
	var ph := {"LH": 0.0, "LF": 0.25, "RH": 0.5, "RF": 0.75}
	var legs := {}
	for lg in ph:
		var f := foot(p - float(ph[lg]), duty, E, 0.24 if lg.ends_with("F") else 0.2, lg.ends_with("F"))
		legs[lg] = f
	var two := TAU * 2.0 * p
	var one := TAU * p
	var rot := {
		"Pelvis": Vector3(1.5 * sin(two), 3.0 * sin(one), -2.0 * sin(one)),
		"Spine1": Vector3(0.8 * sin(two + 0.4), -2.5 * sin(one), 0),
		"Spine2": Vector3(0.6 * sin(two + 0.8), -1.5 * sin(one), 0),
		"Chest": Vector3(-1.0 * sin(two + 1.0), 2.5 * sin(one + 0.6), 1.5 * sin(one + 0.6)),
		"Neck1": Vector3(7.0 + 2.5 * sin(two + 1.6), -3.0 * sin(one + 1.0), 0),
		"Neck2": Vector3(3.0 + 1.5 * sin(two + 2.0), -2.0 * sin(one + 1.4), 0),
		"Head": Vector3(-6.0 + 2.0 * sin(two + 2.4), -1.5 * sin(one + 1.8), 0),
		"Jaw": Vector3(-24.0 + 2.0 * sin(two), 0, 0),
		"L_Scapula": Vector3(-6.0 * _sc(legs.LF, E), 0, 0),
		"R_Scapula": Vector3(-6.0 * _sc(legs.RF, E), 0, 0),
	}
	_tail(rot, t, WALK_T, 7.0, 3.0, -4.0)
	return {"root": Vector3(0.045 * sin(one + 0.3), 0.03 * cos(two) - 0.02, 0), "rq": Vector3(0, 0, 1.8 * sin(one + 0.3)), "rot": rot, "legs": legs}


## мах лопатки по ходу лапы: лапа впереди — лопатка вперёд
static func _sc(f: Dictionary, E: float) -> float:
	return clampf(float((f.d as Vector3).z) / maxf(E * 0.5, 0.01), -1.0, 1.0)


## хвост: волна от основания к концу (период per), размах вбок yaw и вверх-вниз pitch, base — подъём основания
func _tail(rot: Dictionary, t: float, per: float, yaw: float, pitch: float, base: float) -> void:
	for k in 5:
		var ph := TAU * t / per - float(k) * 0.65
		rot["Tail%d" % (k + 1)] = Vector3((base if k == 0 else 1.5) + pitch * sin(ph * 2.0), yaw * sin(ph) * (0.6 + 0.2 * k), 0)


# ---------------- галоп ----------------

func run(t: float) -> Dictionary:
	var p := t / RUN_T
	var duty := 0.32
	var E := RUN_V * duty * RUN_T
	# поперечный галоп: задние толкают парой (левая, следом правая), передние — после полёта
	var ph := {"LH": 0.0, "RH": 0.08, "LF": 0.48, "RF": 0.58}
	var legs := {}
	for lg in ph:
		legs[lg] = foot(p - float(ph[lg]), duty, E, 0.5 if lg.ends_with("F") else 0.42, lg.ends_with("F"))
	var one := TAU * p
	# спина: собрана (задние впереди) — выгнута вверх; вытянута в полёте — прогнута
	var flex := sin(one - 0.9)
	var rot := {
		"Pelvis": Vector3(-7.0 * flex, 0, 0),
		"Spine1": Vector3(-6.0 * flex, 1.5 * sin(one), 0),
		"Spine2": Vector3(-4.0 * flex, 0, 0),
		"Chest": Vector3(9.0 * flex + 3.0, 0, 0),
		"Neck1": Vector3(10.0 - 6.0 * sin(one - 2.2), 0, 0),
		"Neck2": Vector3(6.0 - 3.0 * sin(one - 2.6), 0, 0),
		"Head": Vector3(-14.0 + 4.0 * sin(one - 3.0), 0, 0),
		"Jaw": Vector3(-12.0 + 4.0 * sin(one), 0, 0),
		"JawUp": Vector3(-3.0, 0, 0),
		"L_Scapula": Vector3(-14.0 * _sc(legs.LF, E), 0, 0),
		"R_Scapula": Vector3(-14.0 * _sc(legs.RF, E), 0, 0),
	}
	_tail(rot, t, RUN_T, 4.0, 7.0, -10.0)
	return {"root": Vector3(0, -0.1 + 0.11 * sin(one - 1.6), 0.06 * sin(one)), "rq": Vector3(2.0 * sin(one - 0.5), 0, 0), "rot": rot, "legs": legs}


# ---------------- ожидание ----------------

func idle(t: float) -> Dictionary:
	var br := sin(TAU * t / 2.0)                       # три вдоха за цикл
	var sw := sin(TAU * t / 6.0)
	var yaw := cv([[0.0, 0.0], [0.9, 0.0], [1.6, 24.0], [2.4, 20.0], [2.9, 0.0], [3.3, -24.0], [4.0, -20.0], [4.5, 0.0], [6.0, 0.0]], t)
	var sniff := cv([[0.0, 0.0], [4.5, 0.0], [4.9, -14.0], [5.6, -12.0], [6.0, 0.0]], t)
	var nod := 2.5 * sin(TAU * t * 2.5) * cv([[0.0, 0.0], [4.8, 0.0], [5.0, 1.0], [5.5, 1.0], [5.7, 0.0], [6.0, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(0, 0, -1.0 * sw),
		"Spine1": Vector3(0.6 * br, 0, 0),
		"Spine2": Vector3(-0.8 * br, 0, 0),
		"Chest": Vector3(-1.2 * br, 0, 1.0 * sw),
		"Neck1": Vector3(6.0 + sniff * 0.35, yaw * 0.25, 0),
		"Neck2": Vector3(3.0 + sniff * 0.3, yaw * 0.3, 0),
		"Head": Vector3(-4.0 + sniff * 0.35 + nod, yaw * 0.45, -yaw * 0.12),
		"Jaw": Vector3(-26.0 + 2.5 * br - cv([[0.0, 0.0], [4.6, 0.0], [5.0, 8.0], [5.6, 8.0], [6.0, 0.0]], t), 0, 0),
	}
	_tail(rot, t, 6.0, 6.0, 2.0, -3.0)
	return {"root": Vector3(0.05 * sw, 0.012 * br, 0), "rq": Vector3(0, 0, 1.4 * sw), "rot": rot, "legs": {}}


# ---------------- укус ----------------

func bite(t: float) -> Dictionary:
	var dz := cv([[0.0, 0.0], [0.3, -0.18], [0.55, 0.42], [0.75, 0.45], [1.15, 0.05], [1.8, 0.0]], t)
	var dy := cv([[0.0, 0.0], [0.3, 0.05], [0.55, -0.2], [0.75, -0.18], [1.15, -0.02], [1.8, 0.0]], t)
	var shake := cv([[0.0, 0.0], [0.62, 0.0], [0.69, 6.0], [0.77, -6.0], [0.85, 3.0], [0.95, 0.0], [1.8, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(cv([[0.0, 0.0], [0.3, 3.0], [0.55, -3.0], [1.2, 0.0]], t), 0, 0),
		"Spine1": Vector3(cv([[0.0, 0.0], [0.3, -3.0], [0.55, 3.0], [1.2, 0.0]], t), 0, 0),
		"Chest": Vector3(cv([[0.0, 0.0], [0.3, -6.0], [0.55, 8.0], [0.8, 6.0], [1.2, 0.0], [1.8, 0.0]], t), 0, 0),
		"Neck1": Vector3(cv([[0.0, 5.0], [0.3, -12.0], [0.55, 12.0], [0.8, 9.0], [1.2, 3.0], [1.8, 5.0]], t), 0, 0),
		"Neck2": Vector3(cv([[0.0, 3.0], [0.3, -9.0], [0.55, 7.0], [0.8, 5.0], [1.8, 3.0]], t), 0, shake * 0.5),
		"Head": Vector3(cv([[0.0, -4.0], [0.3, -12.0], [0.55, 6.0], [0.62, 12.0], [0.8, 6.0], [1.8, -4.0]], t), 0, shake),
		"Jaw": Vector3(cv([[0.0, -24.0], [0.3, 10.0], [0.5, 12.0], [0.6, -38.0], [0.95, -36.0], [1.35, -24.0], [1.8, -24.0]], t), 0, 0),
		"JawUp": Vector3(cv([[0.0, 0.0], [0.3, -7.0], [0.55, -8.0], [0.62, 0.0], [1.8, 0.0]], t), 0, 0),
	}
	_tail(rot, t, 1.8, 5.0, 3.0, -4.0 + cv([[0.0, 0.0], [0.55, -10.0], [1.2, 0.0]], t))
	return {"root": Vector3(0, dy, dz), "rot": rot, "legs": {}}


# ---------------- удары лапами ----------------

func claw_r(t: float) -> Dictionary:
	return _claw(t, -1.0, true)


func claw_l(t: float) -> Dictionary:
	return _claw(t, 1.0, true)


## два удара подряд: правая (0–1,0 с), левая — с 0,8 с
func claw_combo(t: float) -> Dictionary:
	var a := _claw(t, -1.0, false)
	var b := _claw(t - 0.8, 1.0, false)
	var w := cv([[0.0, 0.0], [0.7, 0.0], [0.9, 1.0], [2.25, 1.0]], t)
	var rot: Dictionary = (a.rot as Dictionary).duplicate()
	for k in b.rot:
		rot[k] = (rot.get(k, Vector3.ZERO) as Vector3).lerp(b.rot[k], w)
	rot["R_Scapula"] = a.rot["R_Scapula"]
	rot["L_Scapula"] = b.rot["L_Scapula"]
	var legs := {"RF": a.legs.RF, "LF": b.legs.LF}
	return {"root": (a.root as Vector3).lerp(b.root, w), "rq": (a.rq as Vector3).lerp(b.rq, w), "rot": rot, "legs": legs}


## удар передней лапой: s = −1 — правой (правый бок, −X), +1 — левой. Вес — на три другие лапы (корпус к
## противоположному боку), лапа поднимается и отводится назад, плечо назад; быстрый удар вперёд-вниз
## (метка удара — 0,46 с), лапа возвращается на землю.
func _claw(t: float, s: float, solo: bool) -> Dictionary:
	if t < 0.0:
		t = 0.0
	var end := 1.45 if solo else 1.05
	var back := 1.15 if solo else 0.85
	var lift := Vector3(
		-s * cv([[0.0, 0.0], [0.3, -0.05], [0.46, 0.28], [0.6, 0.22], [0.9, 0.06], [back, 0.0]], t),
		cv([[0.0, 0.0], [0.12, 0.3], [0.3, 1.05], [0.46, 0.32], [0.6, 0.05], [0.9, 0.35], [back, 0.0]], t),
		cv([[0.0, 0.0], [0.12, -0.08], [0.3, -0.18], [0.46, 1.0], [0.6, 0.85], [0.9, 0.35], [back, 0.0]], t))
	var flex := cv([[0.0, 0.0], [0.3, 1.2], [0.42, -0.5], [0.6, 0.0], [0.9, 0.5], [back, 0.0]], t)
	var leg := "RF" if s < 0.0 else "LF"
	var rot := {
		"Pelvis": Vector3(0, 0, -s * cv([[0.0, 0.0], [0.3, 2.0], [0.6, 0.0], [end, 0.0]], t)),
		"Spine1": Vector3(0, s * cv([[0.0, 0.0], [0.3, -3.0], [0.5, 4.0], [0.9, 0.0], [end, 0.0]], t), 0),
		"Chest": Vector3(cv([[0.0, 0.0], [0.3, -5.0], [0.5, 6.0], [0.9, 0.0], [end, 0.0]], t), s * cv([[0.0, 0.0], [0.3, -5.0], [0.5, 6.0], [0.9, 0.0], [end, 0.0]], t), 0),
		"Neck1": Vector3(cv([[0.0, 5.0], [0.3, -4.0], [0.5, 6.0], [end, 5.0]], t), s * cv([[0.0, 0.0], [0.3, 6.0], [0.6, 10.0], [1.0, 3.0], [end, 0.0]], t), 0),
		"Head": Vector3(cv([[0.0, -4.0], [0.3, -8.0], [0.5, 2.0], [end, -4.0]], t), s * cv([[0.0, 0.0], [0.3, 5.0], [0.6, 8.0], [1.0, 2.0], [end, 0.0]], t), 0),
		"Jaw": Vector3(cv([[0.0, -24.0], [0.3, 4.0], [0.5, 8.0], [1.0, -18.0], [end, -24.0]], t), 0, 0),
		"JawUp": Vector3(cv([[0.0, 0.0], [0.3, -6.0], [0.6, -6.0], [end, 0.0]], t), 0, 0),
	}
	var scap := "R_Scapula" if s < 0.0 else "L_Scapula"
	var other := "L_Scapula" if s < 0.0 else "R_Scapula"
	rot[scap] = Vector3(cv([[0.0, 0.0], [0.3, 12.0], [0.46, -16.0], [0.8, -4.0], [back, 0.0]], t), 0, s * cv([[0.0, 0.0], [0.3, 6.0], [0.46, -4.0], [back, 0.0]], t))
	rot[other] = Vector3.ZERO
	_tail(rot, t, 1.45, 5.0, 2.0, -4.0 + s * 0.0)
	var legs := {leg: {"d": lift, "flex": flex, "claw": cv([[0.0, 0.0], [0.3, 0.6], [0.44, -0.3], [0.7, 0.0]], t)}}
	# вес — на другой бок: корпус сдвигается от бьющей лапы и чуть назад, затем подаётся в удар
	var root := Vector3(-s * cv([[0.0, 0.0], [0.25, 0.14], [0.6, 0.1], [1.0, 0.03], [end, 0.0]], t), cv([[0.0, 0.0], [0.3, 0.04], [0.5, -0.08], [end, 0.0]], t), cv([[0.0, 0.0], [0.25, -0.1], [0.5, 0.25], [0.8, 0.12], [end, 0.0]], t))
	var rq := Vector3(0, 0, s * cv([[0.0, 0.0], [0.25, 4.0], [0.55, -2.0], [1.0, 0.0], [end, 0.0]], t))
	return {"root": root, "rq": rq, "rot": rot, "legs": legs}


# ---------------- гибель ----------------

func death(t: float) -> Dictionary:
	var shud := 0.045 * sin(t * 70.0) * cv([[0.0, 0.0], [0.05, 1.0], [0.35, 1.0], [0.45, 0.0]], t)
	var up := cv([[0.0, 0.0], [0.15, 0.6], [0.55, 1.0], [0.95, 0.9], [1.3, 0.2], [1.85, -0.3], [3.3, -0.3]], t)
	var roll := cv([[0.0, 0.0], [0.95, 0.0], [1.3, 18.0], [1.6, 50.0], [1.85, 86.0], [2.02, 79.0], [2.25, 84.0], [3.3, 84.0]], t)
	var fall := cv([[0.0, 0.0], [0.9, 0.0], [1.85, 1.0], [3.3, 1.0]], t)
	var tw := 5.0 * sin(t * 22.0) * cv([[0.0, 0.0], [2.3, 0.0], [2.45, 1.0], [2.9, 0.6], [3.1, 0.0], [3.3, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(cv([[0.0, 0.0], [1.2, -6.0], [1.85, 4.0], [3.3, 4.0]], t), 0, 0),
		"Spine1": Vector3(cv([[0.0, 0.0], [0.5, -3.0], [1.85, 6.0], [3.3, 5.0]], t), cv([[0.0, 0.0], [1.85, 6.0], [3.3, 6.0]], t), 0),
		"Chest": Vector3(-6.0 * up + cv([[0.0, 0.0], [1.0, 10.0], [1.85, 4.0]], t), 0, 0),
		"Neck1": Vector3(-14.0 * up, 0, cv([[0.0, 0.0], [1.6, 0.0], [1.95, -18.0], [3.3, -16.0]], t)),
		"Neck2": Vector3(-12.0 * up, 0, cv([[0.0, 0.0], [1.6, 0.0], [1.95, -14.0], [3.3, -12.0]], t)),
		"Head": Vector3(-10.0 * up + shud * 60.0, 0, cv([[0.0, 0.0], [1.7, 0.0], [2.0, -12.0], [3.3, -10.0]], t)),
		"Jaw": Vector3(cv([[0.0, -24.0], [0.5, 10.0], [1.0, 8.0], [1.85, -14.0], [3.3, -12.0]], t), 0, 0),
		"JawUp": Vector3(cv([[0.0, 0.0], [0.5, -8.0], [1.2, -3.0], [3.3, 0.0]], t), 0, 0),
		"L_Scapula": Vector3(cv([[0.9, 0.0], [1.4, -12.0], [3.3, -10.0]], t), 0, 0),
		"R_Scapula": Vector3(cv([[0.9, 0.0], [1.4, -12.0], [3.3, -10.0]], t), 0, 0),
	}
	for k in 5:
		rot["Tail%d" % (k + 1)] = Vector3(cv([[0.0, -3.0], [1.5, -14.0], [1.9, 6.0], [2.3, 2.0], [3.3, 1.5]], t) * (1.0 if k < 3 else 0.6),
			cv([[0.0, 0.0], [1.6, 0.0], [1.9, -10.0], [2.4, 4.0], [3.3, 3.0]], t) * (0.4 + 0.2 * k), 0)
	# лапы: до падения держат опору (подкашиваются передние, потом задние), потом — свободно, вытянуты
	var buckle := cv([[0.0, 0.0], [0.95, 0.0], [1.35, 1.0]], t)
	var legs := {
		"LF": {"d": Vector3(0, 0, 0.25 * buckle), "flex": 0.4 * buckle},
		"RF": {"d": Vector3(0, 0, 0.3 * buckle), "flex": 0.4 * buckle},
		"LH": {"d": Vector3(0, 0, 0.15 * buckle), "flex": 0.2 * buckle},
		"RH": {"d": Vector3(0, 0, 0.1 * buckle), "flex": 0.2 * buckle},
	}
	var fk := {
		"L_UpperArm": Vector3(-25.0 + tw, 0, -10.0), "L_Forearm": Vector3(20.0, 0, 0), "L_Hand": Vector3(35.0, 0, 0),
		"R_UpperArm": Vector3(-35.0, 0, 6.0), "R_Forearm": Vector3(25.0 + tw, 0, 0), "R_Hand": Vector3(40.0, 0, 0),
		"L_Thigh": Vector3(-30.0, 0, -8.0), "L_Shin": Vector3(-25.0 - tw, 0, 0), "L_Foot": Vector3(30.0, 0, 0),
		"R_Thigh": Vector3(-20.0 + tw, 0, 4.0), "R_Shin": Vector3(-20.0, 0, 0), "R_Foot": Vector3(25.0, 0, 0),
	}
	var fkw := cv([[0.0, 0.0], [1.0, 0.0], [1.4, 0.35], [1.8, 1.0], [3.3, 1.0]], t)
	var root := Vector3(-0.55 * fall + shud, cv([[0.0, 0.0], [0.5, 0.05], [0.95, -0.12], [1.3, -0.5], [1.85, 0.0], [3.3, 0.0]], t), 0.2 * fall)
	return {"root": root, "rq": Vector3(0, 0, roll), "rot": rot, "legs": legs, "fk": fk, "fkw": fkw}


# ---------------- проверка «лёг на землю» ----------------

## После падения тело должно лежать на земле — не висеть и не уходить в неё: по кадрам с from считается нижняя
## точка кожи (каждая восьмая вершина, веса как в сетке) и корень поднимается или опускается на столько же
func _ground_fix(a: Animation, from: float) -> void:
	if _verts.is_empty():
		return
	var tp := -1
	for i in a.get_track_count():
		if a.track_get_type(i) == Animation.TYPE_POSITION_3D:
			tp = i
	var lows: Array = []
	for k in a.track_get_key_count(tp):
		var t := a.track_get_key_time(tp, k)
		if t < from:
			continue
		var low := lowest(a, t)
		var p: Vector3 = a.track_get_key_value(tp, k)
		# всё падение тело касается земли (лапами или боком): не висит в воздухе и не уходит в землю
		var fix := -low
		a.track_set_key_value(tp, k, p + Vector3(0, fix, 0))
		lows.append([snappedf(t, 0.01), snappedf(low, 0.01)])
	report.append("гибель: нижняя точка тела до поправки (через кадр): %s" % str(lows.filter(func(x): return int(round(float(x[0]) * 30.0)) % 6 == 0)))


## нижняя точка кожи в кадре t движения a (каждая восьмая вершина)
func lowest(a: Animation, t: float) -> float:
	var g := pose_at(a, t)
	var low := 99.0
	var i := 0
	while i < _verts.size():
		low = minf(low, skin_point(i, g).y)
		i += 8
	return low


## глобальные преобразования костей в кадре t: [Transform3D] (от поворотов дорожек и сдвига корня)
func pose_at(a: Animation, t: float) -> Array:
	var loc := {}
	var rootp := Vector3.ZERO
	for i in a.get_track_count():
		var path := String(a.track_get_path(i))
		if a.track_get_type(i) == Animation.TYPE_ROTATION_3D:
			loc[path.get_slice(":", 1)] = a.rotation_track_interpolate(i, t)
		elif a.track_get_type(i) == Animation.TYPE_POSITION_3D:
			rootp = a.position_track_interpolate(i, t)
	var g: Array = []
	g.resize(names.size())
	for i in names.size():
		var q: Quaternion = loc.get(names[i], Quaternion.IDENTITY)
		var o: Vector3 = rootp if par[i] < 0 else off[i]
		var lt := Transform3D(Basis(q), o)
		g[i] = lt if par[i] < 0 else (g[par[i]] as Transform3D) * lt
	return g


## точка кожи (вершина vi) в позе g: сумма по костям вес × (кость · обратная привязка покоя)
func skin_point(vi: int, g: Array) -> Vector3:
	var v := _verts[vi]
	var out := Vector3.ZERO
	for bw in _wts[vi]:
		var bi := int(bw[0])
		out += ((g[bi] as Transform3D) * (v - (rest_g[bi] as Vector3))) * float(bw[1])
	return out


# ---------------- замеры движений (печатает tools/elite_build.gd) ----------------

## Размеры, проскальзывание опорных лап, раскрытие пасти, метки ударов. Опорная лапа шага и галопа: её точка
## опоры (запястье передней, пальцы задней) в мире = в модели + скорость × время; пока лапа на земле (не выше
## 3 см над своей высотой в покое), это место не должно сдвигаться.
func audit(lib: AnimationLibrary) -> Array:
	var out: Array = []
	var idle: Animation = lib.get_animation("elite_idle")
	var g0 := pose_at(idle, 0.0)
	var lo := Vector3(99, 99, 99)
	var hi := -lo
	var i := 0
	while i < _verts.size():
		var p := skin_point(i, g0)
		lo = lo.min(p)
		hi = hi.max(p)
		i += 4
	out.append("размер в стойке: длина %.2f м, высота %.2f м, ширина %.2f м" % [hi.z - lo.z, hi.y - lo.y, hi.x - lo.x])
	var top := 0.0
	var t := 0.0
	while t < idle.length:
		var g := pose_at(idle, t)
		top = maxf(top, (g[idx["Head"]] as Transform3D).origin.y)
		t += 0.25
	out.append("ожидание: голова поднимается до %.2f м (принюхивается)" % top)
	for an in [["elite_walk", WALK_V], ["elite_run", RUN_V]]:
		var a: Animation = lib.get_animation(an[0])
		var v := float(an[1])
		var parts: Array = []
		for lg in ["LF", "RF", "LH", "RH"]:
			var bn: String = LEGS[lg][3] if lg.ends_with("F") else LEGS[lg][3]
			var bi: int = idx[bn]
			var rest_y: float = (rest_g[bi] as Vector3).y
			var slide := 0.0
			var anchor := Vector3.INF
			var stance_n := 0
			var f := 0
			var n := int(round(a.length * FPS))
			for k in range(n * 2):
				var tt := float(k) / FPS
				var g := pose_at(a, fmod(tt, a.length))
				var pw: Vector3 = (g[bi] as Transform3D).origin + Vector3(0, 0, v * tt)
				if pw.y < rest_y + 0.03:
					if anchor == Vector3.INF:
						anchor = pw
					slide = maxf(slide, Vector2(pw.x - anchor.x, pw.z - anchor.z).length())
					stance_n += 1
				else:
					anchor = Vector3.INF
				f += 1
			parts.append("%s: скольжение %.1f см (кадров на опоре %d из %d)" % [lg, slide * 100.0, stance_n, f])
		out.append("%s (%.1f м/с): %s" % [an[0], v, ", ".join(parts)])
	var bite: Animation = lib.get_animation("elite_bite_attack")
	var jmin := 99.0
	var jmax := -99.0
	t = 0.0
	while t <= bite.length:
		var g := pose_at(bite, t)
		var jb := (g[idx["Jaw"]] as Transform3D).basis
		var hb := (g[idx["Head"]] as Transform3D).basis
		var rel := (hb.inverse() * jb).get_euler()
		jmin = minf(jmin, rad_to_deg(rel.x))
		jmax = maxf(jmax, rad_to_deg(rel.x))
		t += 1.0 / FPS
	out.append("укус: нижняя челюсть от %.0f° (шире покоя) до %.0f° (сомкнута); в покое пасть открыта на ~41°" % [jmax, jmin])
	for an in lib.get_animation_list():
		var a: Animation = lib.get_animation(an)
		var ev: Array = []
		for ti in a.get_track_count():
			if a.track_get_type(ti) == Animation.TYPE_METHOD:
				for k in a.track_get_key_count(ti):
					ev.append("%s %.2f с" % [String(a.method_track_get_params(ti, k)[0]), a.track_get_key_time(ti, k)])
		out.append("%s: %.2f с%s%s" % [an, a.length, ", по кругу" if a.loop_mode != Animation.LOOP_NONE else "", (", метки: " + ", ".join(ev)) if not ev.is_empty() else ""])
	var d: Animation = lib.get_animation("elite_death")
	out.append("гибель: нижняя точка тела после поправки: 1,3 с — %.2f м, 2,0 с — %.2f м, конец — %.2f м; корпус в конце повёрнут набок на %.0f°" % [lowest(d, 1.3), lowest(d, 2.0), lowest(d, d.length), rad_to_deg((pose_at(d, d.length)[0] as Transform3D).basis.get_euler().z)])
	return out
