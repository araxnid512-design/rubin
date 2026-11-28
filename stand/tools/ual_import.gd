extends SceneTree
## Перенос движений из свободной библиотеки Quaternius «Universal Animation Library» (CC0) на скелет героя (Tripo).
## Скелеты разные (имена костей, оси костей, исходная поза), поэтому перенос идёт через повороты костей в
## пространстве тела:  G_наш(t) = Δ(t) · A · G_наш_покой,  где Δ(t) = F · G_ист(t) · G_ист_покой⁻¹ · F⁻¹ —
## на сколько кость источника повернулась от своей исходной позы (F — разворот тела источника в наше: у Tripo
## модель смотрит не туда же), A — совмещение исходных поз (у источника — «Т», у героя — руки вниз): направление
## кости героя в покое доворачивается до направления кости источника в покое; у таза и кистей — по двум осям.
## Таз: смещение от исходной позы × отношение длин ног. Клипы пишутся в набор героя: assets/anim/hero/q_<имя>.res
## (30 ключей/с), дальше с ними работает BCAnimSet (data/anim_clips.json), как с остальными.
##   godot4 --headless --path . -s tools/ual_import.gd -- --src=/путь/AnimationLibrary_Godot_Standard.glb
##       [--ref=res://assets/models/hero.glb] [--out=res://assets/anim/hero] [--prefix=q_] [--only=Walk_Loop,Jog_Fwd_Loop]
## Печатает по каждому клипу: длину, скорость шага (по опорной стопе), число двойных шагов и момент постановки
## левой стопы — это идёт в описание клипа (speed, strides, phase).
##   --stride=Jog_Fwd_Loop:0.36:jog_slow,Jog_Fwd_Loop:0.53:jog_run — ещё клипы с другой длиной шага: вынос стопы
##       вперёд-назад от своего среднего положения умножается на число, нога достраивается (бедро и голень — по
##       треугольнику, колено гнётся в ту же сторону, стопа держит свой наклон). Бег библиотеки снят под 6,6 м/с
##       (шаг 3 м) — герой бегает 2,4–4,4 м/с, и без этого либо стопы едут по земле, либо бег идёт как в замедлении.

const MAP1 := {
	"DEF-hips": "Hip", "DEF-spine.001": "Waist", "DEF-spine.002": "Spine01", "DEF-spine.003": "Spine02", "DEF-neck": "NeckTwist01", "DEF-head": "Head",
	"DEF-shoulder.@": "@_Clavicle", "DEF-upper_arm.@": "@_Upperarm", "DEF-forearm.@": "@_Forearm", "DEF-hand.@": "@_Hand",
	"DEF-f_index.01.@": "@_Index1", "DEF-f_index.02.@": "@_Index2", "DEF-f_index.03.@": "@_Index3",
	"DEF-f_middle.01.@": "@_Mid1", "DEF-f_middle.02.@": "@_Mid2", "DEF-f_middle.03.@": "@_Mid3",
	"DEF-f_ring.01.@": "@_Ring1", "DEF-f_ring.02.@": "@_Ring2", "DEF-f_ring.03.@": "@_Ring3",
	"DEF-f_pinky.01.@": "@_Pinky1", "DEF-f_pinky.02.@": "@_Pinky2", "DEF-f_pinky.03.@": "@_Pinky3",
	"DEF-thumb.01.@": "@_Thumb1", "DEF-thumb.02.@": "@_Thumb2", "DEF-thumb.03.@": "@_Thumb3",
	"DEF-thigh.@": "@_Thigh", "DEF-shin.@": "@_Calf", "DEF-foot.@": "@_Foot", "DEF-toe.@": "@_ToeBase",
}
const MAP2 := {
	"pelvis": "Hip", "spine_01": "Waist", "spine_02": "Spine01", "spine_03": "Spine02", "neck_01": "NeckTwist01", "Head": "Head",
	"clavicle_@": "@_Clavicle", "upperarm_@": "@_Upperarm", "lowerarm_@": "@_Forearm", "hand_@": "@_Hand",
	"index_01_@": "@_Index1", "index_02_@": "@_Index2", "index_03_@": "@_Index3",
	"middle_01_@": "@_Mid1", "middle_02_@": "@_Mid2", "middle_03_@": "@_Mid3",
	"ring_01_@": "@_Ring1", "ring_02_@": "@_Ring2", "ring_03_@": "@_Ring3",
	"pinky_01_@": "@_Pinky1", "pinky_02_@": "@_Pinky2", "pinky_03_@": "@_Pinky3",
	"thumb_01_@": "@_Thumb1", "thumb_02_@": "@_Thumb2", "thumb_03_@": "@_Thumb3",
	"thigh_@": "@_Thigh", "calf_@": "@_Calf", "foot_@": "@_Foot", "ball_@": "@_ToeBase",
}
const FPS := 30.0

var ss: Skeleton3D            # источник
var ts: Skeleton3D            # наш
var pair := {}                # наша кость (индекс) → кость источника (индекс)
var s_rest_g: Array = []      # источник: исходная поза, пространство скелета
var t_rest_g: Array = []
var F := Basis.IDENTITY
var A := {}                   # наша кость → совмещение исходных поз (Basis)
var leg_k := 1.0
var hip_t := -1
var hip_s := -1
var hip_lift := Vector3.ZERO  # поправка высоты таза: в «исходной позе источника» стопы героя стоят на полу
var up_t := Vector3.UP
var fwd_t := Vector3.FORWARD
var unit_m := 1.0             # метров в единице скелета героя (рост 1,8 м)


func _init() -> void:
	var src := ""
	var ref := "res://assets/models/hero.glb"
	var out := "res://assets/anim/hero"
	var prefix := "q_"
	var only: PackedStringArray = []
	var strides := []          # [имя клипа источника, множитель шага, имя результата]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--src="):
			src = a.substr(6)
		elif a.begins_with("--ref="):
			ref = a.substr(6)
		elif a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--prefix="):
			prefix = a.substr(9)
		elif a.begins_with("--only="):
			only = a.substr(7).split(",")
		elif a.begins_with("--stride="):
			for part in a.substr(9).split(","):
				var f := part.split(":")
				strides.append([f[0], float(f[1]), f[2]])
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if src == "" or doc.append_from_file(src, st) != OK:
		print("[ual] не открыть источник: ", src)
		quit(1)
		return
	var scene: Node = doc.generate_scene(st)
	root.add_child(scene)
	ss = scene.find_children("*", "Skeleton3D", true, false)[0]
	var ap: AnimationPlayer = scene.find_children("*", "AnimationPlayer", true, false)[0]
	var inst: Node = (load(ref) as PackedScene).instantiate()
	root.add_child(inst)
	ts = inst.find_children("*", "Skeleton3D", true, false)[0]
	_setup()
	var lines := []
	for lib_name in ap.get_animation_library_list():
		var lib: AnimationLibrary = ap.get_animation_library(lib_name)
		for an in lib.get_animation_list():
			var jobs := []
			if only.is_empty() or only.has(String(an)):
				jobs.append([1.0, prefix + String(an).to_lower()])
			for sv in strides:
				if String(sv[0]) == String(an):
					jobs.append([float(sv[1]), prefix + String(sv[2])])
			for job in jobs:
				_one(lib.get_animation(an), String(an), float(job[0]), String(job[1]), out, lines)
	print("[ual] готово: клипов %d → %s" % [lines.size(), out])
	quit()


func _one(src_anim: Animation, an: String, stride_k: float, name: String, out: String, lines: Array) -> void:
	if true:
		if true:
			# клипы шага библиотеки сняты «на месте»; набор героя ждёт клип с ходом вперёд (по нему BCAnimSet
			# узнаёт скорость шага и куда смотрит модель) — ход добавляется с измеренной скоростью
			var travel := an.ends_with("_Loop") and (an.begins_with("Walk") or an.begins_with("Jog") or an.begins_with("Sprint") or an.begins_with("Crouch_Fwd") or an.begins_with("Zombie_Walk"))
			var res := _convert(src_anim, stride_k, travel)
			var path := "%s/%s.res" % [out, name]
			var err := ResourceSaver.save(res.anim, path)
			var ln := "%s ← %s: %.2f с, ключей %d%s" % [name, an, res.anim.length, res.keys, "" if err == OK else " (НЕ ЗАПИСАН: %d)" % err]
			if res.stride_n > 0:
				ln += "; шаг: скорость %.2f м/с, двойных шагов %d, левая стопа ставится на %.3f с" % [res.speed, res.stride_n, res.phase]
			ln += "; нижняя точка стоп за клип: %.1f см от пола" % (res.foot_min * 100.0)
			lines.append(ln)
			print("[ual] ", ln)


func _find_s(n: String) -> int:
	var i := ss.find_bone(n)
	if i < 0:
		i = ss.find_bone(n.replace(".", "_"))
	return i


func _setup() -> void:
	var m: Dictionary = MAP1 if _find_s("DEF-hips") >= 0 else MAP2
	var lower := m == MAP2
	for k in m:
		for side in ["L", "R"]:
			var sn := String(k).replace("@", side.to_lower() if lower else side)
			var tn := String(m[k]).replace("@", side)
			var si := _find_s(sn)
			var ti := ts.find_bone(tn)
			if si >= 0 and ti >= 0:
				pair[ti] = si
			elif not String(k).contains("@") and side == "L" or String(k).contains("@"):
				if si < 0 or ti < 0:
					print("[ual] нет пары: %s → %s (%d, %d)" % [sn, tn, si, ti])
			if not String(k).contains("@"):
				break
	for i in ss.get_bone_count():
		s_rest_g.append(ss.get_bone_global_rest(i))
	for i in ts.get_bone_count():
		t_rest_g.append(ts.get_bone_global_rest(i))
	hip_t = ts.find_bone("Hip")
	hip_s = pair[hip_t]
	# оси тела в каждом скелете: вверх (таз → голова, ближайшая ось), вбок (правое бедро → левое), вперёд
	var bt := _body_axes(t_rest_g, ts.find_bone("Hip"), ts.find_bone("Head"), ts.find_bone("L_Thigh"), ts.find_bone("R_Thigh"))
	var bs := _body_axes(s_rest_g, hip_s, pair[ts.find_bone("Head")], pair[ts.find_bone("L_Thigh")], pair[ts.find_bone("R_Thigh")])
	F = bt * bs.inverse()
	up_t = bt.y
	fwd_t = bt.z
	# проверка сторон: носки обоих скелетов после разворота смотрят в одну сторону
	var toe_t: Vector3 = (t_rest_g[ts.find_bone("L_ToeBase")].origin - t_rest_g[ts.find_bone("L_Foot")].origin).normalized()
	var toe_s: Vector3 = F * (s_rest_g[pair[ts.find_bone("L_ToeBase")]].origin - s_rest_g[pair[ts.find_bone("L_Foot")]].origin).normalized()
	print("[ual] пар костей %d; носки смотрят в одну сторону: %.2f (1 — да), вперёд героя в пространстве скелета %s, вверх %s" % [pair.size(), toe_t.dot(toe_s), str(fwd_t.snapped(Vector3.ONE * 0.01)), str(up_t.snapped(Vector3.ONE * 0.01))])
	# длины ног → масштаб смещений таза
	var lt := _len_t("L_Thigh", "L_Calf") + _len_t("L_Calf", "L_Foot")
	var ls := _len_s("L_Thigh", "L_Calf") + _len_s("L_Calf", "L_Foot")
	leg_k = lt / ls
	# совмещение исходных поз
	for ti in pair:
		A[ti] = Basis.IDENTITY
	for ti in pair:
		var tn := ts.get_bone_name(ti)
		var ch := _child_of(tn)
		if tn == "Hip":
			A[ti] = _frame(F * _dir_s("L_Thigh", "R_Thigh", true), F * _dir_s("Hip", "Spine02", true)) * _frame(_dir_t("L_Thigh", "R_Thigh", true), _dir_t("Hip", "Spine02", true)).inverse()
		elif tn.ends_with("_Hand"):
			var sd := tn.substr(0, 2)
			A[ti] = _frame(F * _dir_s(tn, sd + "Mid1"), F * _dir_s(sd + "Index1", sd + "Pinky1")) * _frame(_dir_t(tn, sd + "Mid1"), _dir_t(sd + "Index1", sd + "Pinky1")).inverse()
		elif ch != "":
			A[ti] = Basis(Quaternion(_dir_t(tn, ch), F * _dir_s(tn, ch)))
	# последняя фаланга и носок — как их родитель
	for ti in pair:
		var tn := ts.get_bone_name(ti)
		if _child_of(tn) == "" and tn != "Head" and not tn.ends_with("_Hand") and tn != "Hip":
			var par := ts.get_bone_parent(ti)
			if A.has(par) and not tn.ends_with("ToeBase"):
				A[ti] = A[par]
	# высота таза: в позе «источник в покое» нижняя точка стоп героя — на его полу
	var floor_t := INF
	for n in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase"]:
		floor_t = minf(floor_t, (t_rest_g[ts.find_bone(n)].origin as Vector3).dot(up_t))
	var g0 := _pose_globals(null, 0.0)
	var low := INF
	for n in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase"]:
		low = minf(low, (g0[ts.find_bone(n)].origin as Vector3).dot(up_t))
	hip_lift = up_t * (floor_t - low)
	var head_h: float = (t_rest_g[ts.find_bone("Head")].origin as Vector3).dot(up_t) - floor_t
	unit_m = 1.8 / maxf(head_h * 1.09, 0.001)
	print("[ual] ноги героя / источника: %.3f; таз поднят на %.3f ед. (в «исходной позе источника» стопы на полу); 1 ед. скелета = %.3f м" % [leg_k, (floor_t - low), unit_m])


func _body_axes(g: Array, hip: int, head: int, lth: int, rth: int) -> Basis:
	var up: Vector3 = (g[head].origin - g[hip].origin).normalized()
	var ax := Vector3.ZERO
	var best := 0.0
	for c in [Vector3.RIGHT, Vector3.UP, Vector3.BACK]:
		if absf(up.dot(c)) > best:
			best = absf(up.dot(c))
			ax = c * signf(up.dot(c))
	var lat: Vector3 = g[lth].origin - g[rth].origin
	lat = (lat - ax * lat.dot(ax)).normalized()
	return Basis(lat, ax, lat.cross(ax))


func _frame(x: Vector3, y: Vector3) -> Basis:
	var xa := x.normalized()
	var ya := (y - xa * y.dot(xa)).normalized()
	return Basis(xa, ya, xa.cross(ya))


func _child_of(tn: String) -> String:
	var chain := {"Waist": "Spine01", "Spine01": "Spine02", "Spine02": "NeckTwist01", "NeckTwist01": "Head"}
	if chain.has(tn):
		return chain[tn]
	if tn.length() < 3:
		return ""
	var sd := tn.substr(0, 2)
	var b := tn.substr(2)
	var c := {"Clavicle": "Upperarm", "Upperarm": "Forearm", "Forearm": "Hand", "Thigh": "Calf", "Calf": "Foot", "Foot": "ToeBase",
		"Index1": "Index2", "Index2": "Index3", "Mid1": "Mid2", "Mid2": "Mid3", "Ring1": "Ring2", "Ring2": "Ring3", "Pinky1": "Pinky2", "Pinky2": "Pinky3",
		"Thumb1": "Thumb2", "Thumb2": "Thumb3"}
	return (sd + String(c[b])) if c.has(b) else ""


func _dir_t(a: String, b: String, raw := false) -> Vector3:
	var d: Vector3 = t_rest_g[ts.find_bone(b)].origin - t_rest_g[ts.find_bone(a)].origin
	return d if raw else d.normalized()


func _dir_s(a: String, b: String, raw := false) -> Vector3:
	var d: Vector3 = s_rest_g[pair[ts.find_bone(b)]].origin - s_rest_g[pair[ts.find_bone(a)]].origin
	return d if raw else d.normalized()


func _len_t(a: String, b: String) -> float:
	return _dir_t(a, b, true).length()


func _len_s(a: String, b: String) -> float:
	return _dir_s(a, b, true).length()


## поза героя в пространстве его скелета на момент t клипа a (a == null — источник в исходной позе)
func _pose_globals(a: Animation, t: float, tracks := {}) -> Array:
	# источник: локальные → глобальные
	var sg: Array = []
	sg.resize(ss.get_bone_count())
	for i in ss.get_bone_count():
		var loc := ss.get_bone_rest(i)
		if a != null and tracks.has(i):
			var tr: Dictionary = tracks[i]
			if tr.has("r"):
				loc.basis = Basis(a.rotation_track_interpolate(tr.r, t))
			if tr.has("p"):
				loc.origin = a.position_track_interpolate(tr.p, t)
		var p := ss.get_bone_parent(i)
		sg[i] = (sg[p] * loc) if p >= 0 else loc
	var tg: Array = []
	tg.resize(ts.get_bone_count())
	for i in ts.get_bone_count():
		var p := ts.get_bone_parent(i)
		var loc := ts.get_bone_rest(i)
		var g: Transform3D = (tg[p] * loc) if p >= 0 else loc
		if pair.has(i):
			var si: int = pair[i]
			var d: Basis = F * (sg[si].basis.orthonormalized() * (s_rest_g[si].basis.orthonormalized()).inverse()) * F.inverse()
			g.basis = (d * (A[i] as Basis) * (t_rest_g[i].basis as Basis).orthonormalized()).orthonormalized()
			if i == hip_t:
				g.origin = (t_rest_g[i].origin as Vector3) + hip_lift + F * ((sg[si].origin as Vector3) - (s_rest_g[si].origin as Vector3)) * leg_k
		tg[i] = g
	return tg


## нога под новое положение стопы: бедро и голень — по треугольнику, колено — с той же стороны, стопа и носок
## сохраняют свой наклон в пространстве
func _leg_reach(tg: Array, side: String, shift: Vector3) -> void:
	var th := ts.find_bone(side + "_Thigh")
	var ca := ts.find_bone(side + "_Calf")
	var fo := ts.find_bone(side + "_Foot")
	var to := ts.find_bone(side + "_ToeBase")
	var H: Vector3 = tg[th].origin
	var K: Vector3 = tg[ca].origin
	var P: Vector3 = tg[fo].origin
	var l1 := (K - H).length()
	var l2 := (P - K).length()
	var P2 := P + shift
	var d := (P2 - H).length()
	if d > (l1 + l2) * 0.995:
		P2 = H + (P2 - H).normalized() * (l1 + l2) * 0.995
		d = (P2 - H).length()
	var dir := (P2 - H) / d
	var nrm := (K - H).cross(P - H)
	if nrm.length() < 1e-6:
		nrm = (tg[th].basis as Basis).x
	nrm = nrm.normalized()
	# колено — всегда вперёд по ходу тела (у подтянутой назад ноги линия «бедро — стопа» разворачивается, и колено,
	# взятое «с той же стороны, что было», выворачивалось назад); боковой увод колена — как в исходной позе
	var side_k: Vector3 = (K - H) - dir * (K - H).dot(dir) - fwd_t * (K - H).dot(fwd_t)
	var bend := (fwd_t - dir * fwd_t.dot(dir)) + side_k.normalized() * 0.15 * (1.0 if side_k.length() > 1e-5 else 0.0)
	if bend.length() < 1e-4:
		bend = nrm.cross(dir)
		if bend.dot(K - H) < 0.0:
			bend = -bend
	bend = (bend - dir * bend.dot(dir)).normalized()
	var aa := (l1 * l1 - l2 * l2 + d * d) / (2.0 * d)
	var hh := sqrt(maxf(l1 * l1 - aa * aa, 0.0))
	var K2 := H + dir * aa + bend * hh
	var q1 := Basis(Quaternion((K - H).normalized(), (K2 - H).normalized()))
	var q2 := Basis(Quaternion((q1 * (P - K)).normalized(), (P2 - K2).normalized()))
	var foot_b: Basis = tg[fo].basis
	var toe_b: Basis = tg[to].basis
	tg[th] = Transform3D(q1 * (tg[th].basis as Basis), H)
	tg[ca] = Transform3D(q2 * q1 * (tg[ca].basis as Basis), K2)
	tg[fo] = Transform3D(foot_b, P2)
	tg[to] = Transform3D(toe_b, (tg[to].origin as Vector3) + (P2 - P))


func _convert(a: Animation, stride_k := 1.0, travel := false) -> Dictionary:
	# дорожки источника по костям
	var tracks := {}
	for ti in a.get_track_count():
		var path := String(a.track_get_path(ti))
		var c := path.rfind(":")
		if c < 0:
			continue
		var bi := ss.find_bone(path.substr(c + 1))
		if bi < 0:
			continue
		if not tracks.has(bi):
			tracks[bi] = {}
		if a.track_get_type(ti) == Animation.TYPE_ROTATION_3D:
			tracks[bi]["r"] = ti
		elif a.track_get_type(ti) == Animation.TYPE_POSITION_3D:
			tracks[bi]["p"] = ti
	var out := Animation.new()
	out.length = a.length
	var rot_tr := {}
	for ti in pair:
		var idx := out.add_track(Animation.TYPE_ROTATION_3D)
		out.track_set_path(idx, NodePath("Armature/Skeleton3D:" + ts.get_bone_name(ti)))
		rot_tr[ti] = idx
	var pos_idx := out.add_track(Animation.TYPE_POSITION_3D)
	out.track_set_path(pos_idx, NodePath("Armature/Skeleton3D:Hip"))
	# корень стоит в исходной позе (как в клипах набора: дорожка есть, тело ведёт таз)
	var br := ts.find_bone("BoneRoot")
	if br >= 0:
		var ridx := out.add_track(Animation.TYPE_ROTATION_3D)
		out.track_set_path(ridx, NodePath("Armature/Skeleton3D:BoneRoot"))
		out.rotation_track_insert_key(ridx, 0.0, ts.get_bone_rest(br).basis.get_rotation_quaternion())
	var n := maxi(int(round(a.length * FPS)), 1)
	var keys := 0
	var feet := []            # по кадрам: [левая стопа, правая стопа] в пространстве скелета
	var foot_min := INF
	var lf := ts.find_bone("L_Foot")
	var rf := ts.find_bone("R_Foot")
	var floor_t := INF
	for nm in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase"]:
		floor_t = minf(floor_t, (t_rest_g[ts.find_bone(nm)].origin as Vector3).dot(up_t))
	# длина шага: среднее положение каждой стопы «вперёд» относительно таза за клип
	var mean_f := {"L": 0.0, "R": 0.0}
	if not is_equal_approx(stride_k, 1.0):
		for k in range(n):
			var tg0 := _pose_globals(a, a.length * float(k) / float(n), tracks)
			for sd in ["L", "R"]:
				mean_f[sd] += ((tg0[ts.find_bone(sd + "_Foot")].origin - tg0[hip_t].origin) as Vector3).dot(fwd_t) / float(n)
	for k in range(n + 1):
		var t := minf(a.length * float(k) / float(n), a.length)
		var tg := _pose_globals(a, t, tracks)
		if not is_equal_approx(stride_k, 1.0):
			for sd in ["L", "R"]:
				var f: float = ((tg[ts.find_bone(sd + "_Foot")].origin - tg[hip_t].origin) as Vector3).dot(fwd_t)
				_leg_reach(tg, sd, fwd_t * ((float(mean_f[sd]) + (f - float(mean_f[sd])) * stride_k) - f))
		for ti in pair:
			var p := ts.get_bone_parent(ti)
			var loc: Basis = ((tg[p].basis as Basis).inverse() * (tg[ti].basis as Basis)) if p >= 0 else (tg[ti].basis as Basis)
			out.rotation_track_insert_key(rot_tr[ti], t, loc.get_rotation_quaternion())
			keys += 1
		var hp := ts.get_bone_parent(hip_t)
		var hl: Vector3 = ((tg[hp] as Transform3D).affine_inverse() * (tg[hip_t].origin as Vector3)) if hp >= 0 else (tg[hip_t].origin as Vector3)
		out.position_track_insert_key(pos_idx, t, hl)
		feet.append([tg[lf].origin, tg[rf].origin, tg[ts.find_bone("L_ToeBase")].origin, tg[ts.find_bone("R_ToeBase")].origin])
		for nm in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase"]:
			foot_min = minf(foot_min, ((tg[ts.find_bone(nm)].origin as Vector3).dot(up_t) - floor_t) * unit_m)
	# шаг: скорость тела = скорость, с которой опорный носок уходит назад. Носок считается опорным, пока он не выше
	# 1,5 см над своей нижней точкой за клип; берётся медиана по таким кадрам обеих ног (в беге пятка пола не касается,
	# поэтому меряется носок, а не голеностоп)
	var dt := a.length / float(n)
	var vs := []
	for side in [2, 3]:
		var lowv := INF
		for fr in feet:
			lowv = minf(lowv, (fr[side] as Vector3).dot(up_t))
		for k in range(n):
			var p0: Vector3 = feet[k][side]
			var p1: Vector3 = feet[k + 1][side]
			if p0.dot(up_t) < lowv + 0.008 and p1.dot(up_t) < lowv + 0.008:
				vs.append((p0 - p1).dot(fwd_t) / dt)
	vs.sort()
	var speed: float = (float(vs[vs.size() / 2]) if vs.size() > 0 else 0.0) * unit_m
	var stride_n := 0
	var phase := 0.0
	if absf(speed) > 0.3:
		# постановка левой стопы: её положение «вперёд» проходит максимум
		var best_k := -1
		for k in range(n):
			var p0: float = (feet[(k - 1 + n) % n][0] as Vector3).dot(fwd_t) * signf(speed)
			var p1: float = (feet[k][0] as Vector3).dot(fwd_t) * signf(speed)
			var p2: float = (feet[(k + 1) % n][0] as Vector3).dot(fwd_t) * signf(speed)
			if p1 >= p0 and p1 > p2:
				# только настоящие максимумы: впереди таза
				if p1 > 0.0:
					stride_n += 1
					if best_k < 0:
						best_k = k
		phase = a.length * float(maxi(best_k, 0)) / float(n)
	if travel and speed > 0.2:
		var hp2 := ts.get_bone_parent(hip_t)
		var pb: Basis = (t_rest_g[hp2].basis as Basis).orthonormalized().inverse() if hp2 >= 0 else Basis.IDENTITY
		var step: Vector3 = pb * (fwd_t * (speed / unit_m))
		for ki in out.track_get_key_count(pos_idx):
			var kt := out.track_get_key_time(pos_idx, ki)
			out.track_set_key_value(pos_idx, ki, (out.track_get_key_value(pos_idx, ki) as Vector3) + step * kt)
	return {"anim": out, "keys": keys, "speed": speed, "stride_n": stride_n, "phase": phase, "foot_min": foot_min}
