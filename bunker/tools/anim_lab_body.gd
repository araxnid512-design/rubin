extends RefCounted
## Модель тела для проверки анимаций (лаборатория QA, tools/anim_lab_qa.gd).
## Всё строится по сетке и скелету самой модели Tripo в позе покоя:
##   * точки подошвы — пятка, «подушечка» (под плюснефаланговым суставом) и носок: самые низкие вершины,
##     привязанные к костям стопы; дальше они движутся вместе с костями;
##   * объёмы частей тела — туловище (6 поясов по высоте, в каждом эллипс с 4 полуосями: вперёд, назад,
##     вправо, влево — 85-й процентиль вершин), голова (шар), бёдра и голени (сужающиеся капсулы; для
##     проверки «нога в ногу» — внутренний, медиальный радиус);
##   * пробные наборы вершин — кисти, предплечья, голени, стопы (до 120 вершин каждый, со скиннингом
##     по 4 весам), они проверяются на попадание внутрь объёмов;
##   * анатомические оси — «вперёд/вверх/вправо» модели в пространстве скелета, шарниры колена и локтя.
## Итог — в метрах в системе героя (узел BCCharacter: +Z — вперёд, +Y — вверх, +X — влево).

var rig: BCCharacter
var sk: Skeleton3D
var k := 1.0                    ## метров в единице скелета
var F := Vector3.RIGHT          ## «вперёд» модели в пространстве скелета
var U := Vector3.UP
var R := Vector3.BACK           ## «вправо»
var bi := {}                    ## имя кости → индекс
var rest: Array = []            ## глобальные позы покоя
var rest_inv: Array = []
var sole := {"L": [], "R": []}  ## [[кость, точка в системе кости (покой), имя]]
var vols: Array = []            ## объёмы частей тела (координаты — пространство скелета в покое)
var psets: Array = []           ## пробные наборы вершин
var hinge := {}                 ## колено/локоть: направление сгиба в системе проксимальной кости
var tgroups := {}               ## вершины объёмов для точного замера: группа → [[веса, кость, нормаль в системе кости]]
var info := {}                  ## размеры (для отчёта)

const SIDES := ["L", "R"]


func setup(r: BCCharacter) -> void:
	rig = r
	sk = r.skel
	for i in sk.get_bone_count():
		bi[sk.get_bone_name(i)] = i
		var g := sk.get_bone_global_rest(i)
		rest.append(g)
		rest_inv.append(g.affine_inverse())
	var cs := char_from_skel()
	k = cs.basis.get_scale().y
	var cb := cs.basis.orthonormalized().inverse()
	F = (cb * Vector3(0, 0, 1)).normalized()
	U = (cb * Vector3(0, 1, 0)).normalized()
	R = (cb * Vector3(-1, 0, 0)).normalized()
	_mesh_model()
	# шарниры: сгиб колена уводит голень назад, сгиб локтя — предплечье вперёд (в позе покоя)
	for s in SIDES:
		hinge["knee_" + s] = _flexdir(s + "_Thigh", s + "_Calf", -F)
		hinge["elbow_" + s] = _flexdir(s + "_Upperarm", s + "_Forearm", F)


func char_from_skel() -> Transform3D:
	return rig.global_transform.affine_inverse() * sk.global_transform


func b(n: String) -> int:
	return bi.get(n, -1)


func _flexdir(prox: String, dist: String, want: Vector3) -> Vector3:
	var a: Vector3 = rest[b(prox)].origin
	var c: Vector3 = rest[b(dist)].origin
	var d := (c - a).normalized()
	var fd := (want - d * want.dot(d)).normalized()
	return (rest[b(prox)].basis.orthonormalized().inverse() * fd).normalized()


# ---------------- модель по сетке ----------------

func _mesh_model() -> void:
	var verts: Array = []       ## [позиция покоя (скелет), главная кость, [[кость, вес, точка]], нормаль покоя]
	for mi in rig.model.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		if m.mesh == null or m.skin == null:
			continue
		var skin := m.skin
		var bind_bone: Array = []
		var bind_xf: Array = []
		for i in skin.get_bind_count():
			var bb := skin.get_bind_bone(i)
			if bb < 0:
				bb = sk.find_bone(skin.get_bind_name(i))
			bind_bone.append(bb)
			bind_xf.append(skin.get_bind_pose(i))
		for s in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(s)
			var vv: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
			var ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			var nrm: PackedVector3Array = arr[Mesh.ARRAY_NORMAL] if arr[Mesh.ARRAY_NORMAL] != null else PackedVector3Array()
			if vv.is_empty() or bones.is_empty():
				continue
			var per := bones.size() / vv.size()
			for i in vv.size():
				var p := Vector3.ZERO
				var best := -1
				var bw := -1.0
				var inf: Array = []
				var nr := Vector3.ZERO
				for j in per:
					var w: float = ws[i * per + j]
					if w <= 0.001:
						continue
					var bind: int = bones[i * per + j]
					var bone: int = bind_bone[bind]
					if bone < 0:
						continue
					var bx: Transform3D = bind_xf[bind]
					p += w * ((rest[bone] as Transform3D) * bx * vv[i])
					if nrm.size() > i:
						nr += w * (((rest[bone] as Transform3D).basis * bx.basis) * nrm[i])
					inf.append([bone, w, bx * vv[i]])
					if w > bw:
						bw = w
						best = bone
				verts.append([p, best, inf, nr.normalized()])
	info["вершин"] = verts.size()
	var by_bone := {}
	for v in verts:
		var nm := sk.get_bone_name(v[1]) if v[1] >= 0 else ""
		if not by_bone.has(nm):
			by_bone[nm] = []
		by_bone[nm].append(v)
	var floor_y := INF
	for v in verts:
		floor_y = minf(floor_y, (v[0] as Vector3).dot(U))
	# вершины объёмов для точного замера проникновения (ближайшая вершина поверхности и её нормаль)
	var tg_bones := {"torso": ["Hip", "Pelvis", "Waist", "Spine01", "Spine02"], "head": ["Head", "FacialBone", "L_Eye", "R_Eye"]}
	for s in SIDES:
		tg_bones["thigh_" + s] = [s + "_Thigh", s + "_ThighTwist01", s + "_ThighTwist02"]
		tg_bones["calf_" + s] = [s + "_Calf", s + "_CalfTwist01", s + "_CalfTwist02", s + "_KneeShareBone"]
	for g in tg_bones:
		var a: Array = []
		for n in tg_bones[g]:
			for v in by_bone.get(n, []):
				var e: Array = []
				for w in v[2]:
					e.append([w[0], w[1], rest_inv[w[0]] * ((rest[w[0]] as Transform3D) * (w[2] as Vector3))])
				a.append([e, v[1], (rest[v[1]] as Transform3D).basis.orthonormalized().inverse() * (v[3] as Vector3)])
		tgroups[g] = a
	# --- подошва ---
	for s in SIDES:
		var pts: Array = []
		for n in [s + "_Foot", s + "_ToeBase"]:
			for v in by_bone.get(n, []):
				pts.append(v[0])
		var lo := INF
		for p in pts:
			lo = minf(lo, (p as Vector3).dot(U))
		var low: Array = []
		for p in pts:
			if (p as Vector3).dot(U) < lo + 0.012:
				low.append(p)
		var heel: Vector3 = low[0]
		var toe: Vector3 = low[0]
		for p in low:
			if (p as Vector3).dot(F) < heel.dot(F):
				heel = p
			if (p as Vector3).dot(F) > toe.dot(F):
				toe = p
		var tb: Vector3 = rest[b(s + "_ToeBase")].origin
		var ball := tb - U * (tb.dot(U) - lo)
		# пятка и «подушечка» — с костью стопы, носок — с костью пальцев
		sole[s] = [[b(s + "_Foot"), rest_inv[b(s + "_Foot")] * heel, "пятка"],
			[b(s + "_Foot"), rest_inv[b(s + "_Foot")] * ball, "подушечка"],
			[b(s + "_ToeBase"), rest_inv[b(s + "_ToeBase")] * toe, "носок"]]
		info["стопа_" + s] = "длина %.1f см, подошва на %.1f см над низом модели" % [(toe - heel).dot(F) * k * 100.0, (lo - floor_y) * k * 100.0]
	# --- туловище: 6 поясов от таза до основания шеи ---
	var tv: Array = []
	for n in ["Hip", "Pelvis", "Waist", "Spine01", "Spine02"]:
		for v in by_bone.get(n, []):
			tv.append([v[0], b(n)])
	var y0: float = (rest[b("Pelvis")].origin as Vector3).dot(U) - 0.06
	var y1: float = (rest[b("NeckTwist01")].origin as Vector3).dot(U)
	var a0: Vector3 = rest[b("Hip")].origin
	var a1: Vector3 = rest[b("NeckTwist01")].origin
	var nb := 6
	for i in nb:
		var lo_y := y0 + (y1 - y0) * i / nb
		var hi_y := y0 + (y1 - y0) * (i + 1) / nb
		var fp: Array = []
		var fn: Array = []
		var lp: Array = []
		var ln: Array = []
		var cnt := {}
		var mid := (lo_y + hi_y) * 0.5
		var tt := clampf((mid - a0.dot(U)) / maxf((a1 - a0).dot(U), 0.001), 0.0, 1.0)
		var c := a0.lerp(a1, tt)
		c += U * (mid - c.dot(U))
		for e in tv:
			var p: Vector3 = e[0]
			var y := p.dot(U)
			if y < lo_y or y >= hi_y:
				continue
			var f := (p - c).dot(F)
			var l := (p - c).dot(R)
			if f > 0.0:
				fp.append(f)
			else:
				fn.append(-f)
			if l > 0.0:
				lp.append(l)
			else:
				ln.append(-l)
			cnt[e[1]] = cnt.get(e[1], 0) + 1
		if fp.size() + fn.size() < 30:
			continue
		var bone := -1
		var bc := -1
		for kk in cnt:
			if cnt[kk] > bc:
				bc = cnt[kk]
				bone = kk
		var front := _pct(fp, 0.85)
		var back := _pct(fn, 0.85)
		var right := _pct(lp, 0.85)
		var left := _pct(ln, 0.85)
		if minf(minf(front, back), minf(right, left)) * k < 0.03:
			continue
		vols.append({"name": "туловище", "kind": "ell", "bone": bone, "c": c, "lo": lo_y, "hi": hi_y,
			"front": front, "back": back, "right": right, "left": left, "group": "torso"})
		info["туловище_%d" % i] = "высота %.0f–%.0f см: вперёд %.1f, назад %.1f, вправо %.1f, влево %.1f см" % [
			(lo_y - floor_y) * k * 100.0, (hi_y - floor_y) * k * 100.0, front * k * 100.0, back * k * 100.0, right * k * 100.0, left * k * 100.0]
	# --- голова ---
	var hv: Array = by_bone.get("Head", [])
	if hv.size() > 10:
		var c := Vector3.ZERO
		for v in hv:
			c += v[0]
		c /= hv.size()
		var ds: Array = hv.map(func(v): return (v[0] as Vector3).distance_to(c))
		var r := _pct(ds, 0.6)
		vols.append({"name": "голова", "kind": "sph", "bone": b("Head"), "c": c, "r": r, "group": "head"})
		info["голова"] = "радиус %.1f см" % (r * k * 100.0)
	# --- бёдра и голени: сужающиеся капсулы ---
	for s in SIDES:
		var med := R if s == "L" else -R          # к середине тела
		for seg in [["бедро", [s + "_Thigh", s + "_ThighTwist01", s + "_ThighTwist02"], s + "_Thigh", s + "_Calf"],
				["голень", [s + "_Calf", s + "_CalfTwist01", s + "_CalfTwist02", s + "_KneeShareBone"], s + "_Calf", s + "_Foot"]]:
			var pa: Vector3 = rest[b(seg[2])].origin
			var pb: Vector3 = rest[b(seg[3])].origin
			var ab := pb - pa
			var d0: Array = []
			var d1: Array = []
			var m0: Array = []
			var m1: Array = []
			for n in seg[1]:
				for v in by_bone.get(n, []):
					var p: Vector3 = v[0]
					var t := clampf((p - pa).dot(ab) / maxf(ab.length_squared(), 1e-9), 0.0, 1.0)
					var off := p - (pa + ab * t)
					var dd := off.length()
					if t < 0.4:
						d0.append(dd)
						m0.append(off.dot(med))
					elif t > 0.6:
						d1.append(dd)
						m1.append(off.dot(med))
			var ra := _pct(d0, 0.5) if d0.size() > 10 else 0.04 / k
			var rb := _pct(d1, 0.5) if d1.size() > 10 else 0.03 / k
			var ma := minf(ra, _pct(m0, 0.85)) if m0.size() > 10 else ra
			var mb := minf(rb, _pct(m1, 0.85)) if m1.size() > 10 else rb
			vols.append({"name": seg[0] + " " + ("Л" if s == "L" else "П"), "kind": "cap", "bone": b(seg[2]),
				"a": pa, "b": pb, "ra": ra, "rb": rb, "ma": ma, "mb": mb, "group": ("thigh_" if seg[0] == "бедро" else "calf_") + s})
			info[seg[0] + "_" + s] = "радиус %.1f → %.1f см, внутрь %.1f → %.1f см" % [ra * k * 100.0, rb * k * 100.0, ma * k * 100.0, mb * k * 100.0]
	# --- пробные наборы вершин ---
	for s in SIDES:
		var ru := "Л" if s == "L" else "П"
		var hand_b: Array = [s + "_Hand"]
		for f in ["Thumb", "Index", "Mid", "Ring", "Pinky"]:
			for j in [1, 2, 3]:
				hand_b.append("%s_%s%d" % [s, f, j])
		_pset("кисть " + ru, hand_b, by_bone, s, true)
		_pset("предплечье " + ru, [s + "_Forearm", s + "_ForearmTwist01", s + "_ForearmTwist02", s + "_ElbowShareBone"], by_bone, s, true)
		_pset("голень " + ru, [s + "_Calf", s + "_CalfTwist01", s + "_CalfTwist02", s + "_KneeShareBone"], by_bone, s, false)
		_pset("стопа " + ru, [s + "_Foot", s + "_ToeBase"], by_bone, s, false)


func _pset(name: String, bones: Array, by_bone: Dictionary, side: String, arm: bool) -> void:
	var all: Array = []
	for n in bones:
		all.append_array(by_bone.get(n, []))
	if all.is_empty():
		return
	var step := maxi(1, all.size() / 120)
	var vs: Array = []
	for i in range(0, all.size(), step):
		var inf: Array = all[i][2]
		var e: Array = []
		for w in inf:
			e.append([w[0], w[1], rest_inv[w[0]] * ((rest[w[0]] as Transform3D) * (w[2] as Vector3))])
		vs.append(e)
	psets.append({"name": name, "side": side, "arm": arm, "v": vs})
	info["проба_" + name] = "%d вершин" % vs.size()


static func _pct(a: Array, q: float) -> float:
	if a.is_empty():
		return 0.0
	var s := a.duplicate()
	s.sort()
	return maxf(0.0, float(s[clampi(int(q * (s.size() - 1)), 0, s.size() - 1)]))


static func _seg_dist(p: Vector3, a: Vector3, c: Vector3) -> float:
	var ab := c - a
	var t := clampf((p - a).dot(ab) / maxf(ab.length_squared(), 1e-9), 0.0, 1.0)
	return p.distance_to(a + ab * t)


# ---------------- снимок позы ----------------

## поза скелета сейчас: глобальные позы всех костей (пространство скелета) + переход в систему героя
func snap() -> Dictionary:
	var g: Array = []
	for i in sk.get_bone_count():
		g.append(sk.get_bone_global_pose(i))
	return {"g": g, "cs": char_from_skel()}


func pos(s: Dictionary, bone: String) -> Vector3:
	return (s.cs as Transform3D) * ((s.g[b(bone)] as Transform3D).origin)


## точки подошвы в системе героя: {"L": [пятка, подушечка, носок], "R": [...]}
func soles(s: Dictionary) -> Dictionary:
	var out := {}
	for sd in SIDES:
		var a: Array = []
		for sp in sole[sd]:
			a.append((s.cs as Transform3D) * ((s.g[sp[0]] as Transform3D) * (sp[1] as Vector3)))
		out[sd] = a
	return out


## поворот кости от покоя (в осях скелета)
func _delta(s: Dictionary, bone: int) -> Basis:
	return (s.g[bone] as Transform3D).basis.orthonormalized() * (rest[bone] as Transform3D).basis.orthonormalized().inverse()


## углы суставов, градусы
func angles(s: Dictionary) -> Dictionary:
	var out := {}
	var Dh := _delta(s, b("Hip"))
	# таз относительно мира (от позы покоя): наклон вперёд и перекос вбок, в собственных осях таза
	var u := Dh * U
	var f := Dh * F
	var fh := (f - U * f.dot(U)).normalized()
	var rh := fh.cross(U).normalized()
	out["таз_наклон"] = rad_to_deg(atan2(u.dot(fh), u.dot(U)))
	out["таз_перекос"] = rad_to_deg(atan2(u.dot(rh), u.dot(U)))
	# позвоночник (таз → грудь) и шея (грудь → голова): поворот в анатомических осях, разложение
	# «сгиб (вокруг оси вправо) → наклон вбок (вокруг оси вперёд) → поворот (вокруг оси вверх)»
	var A := Basis(F, U, R)
	for pair in [["позвоночник", "Hip", "Spine02"], ["шея", "Spine02", "Head"]]:
		var rel := _delta(s, b(pair[1])).inverse() * _delta(s, b(pair[2]))
		var ra := A.transposed() * rel * A
		var e := ra.get_euler(EULER_ORDER_ZXY)
		out[pair[0] + "_сгиб"] = -rad_to_deg(e.z)
		out[pair[0] + "_вбок"] = rad_to_deg(e.x)
		out[pair[0] + "_поворот"] = rad_to_deg(e.y)
	for sd in SIDES:
		var sg := -1.0 if sd == "L" else 1.0
		var th: Vector3 = (s.g[b(sd + "_Thigh")] as Transform3D).origin
		var kn: Vector3 = (s.g[b(sd + "_Calf")] as Transform3D).origin
		var an: Vector3 = (s.g[b(sd + "_Foot")] as Transform3D).origin
		# тазобедренный: бедро в осях таза
		var d := Dh.inverse() * (kn - th).normalized()
		out["бедро_сгиб_" + sd] = rad_to_deg(atan2(d.dot(F), -d.dot(U)))
		# отведение — угол бедра к сагиттальной плоскости таза (не зависит от сгиба)
		out["бедро_отвед_" + sd] = rad_to_deg(asin(clampf(sg * d.dot(R), -1.0, 1.0)))
		# колено: сгиб со знаком (минус — переразгиб) и уход из плоскости сгиба («выворот»)
		var kk := _hinge(s, sd + "_Thigh", th, kn, an, hinge["knee_" + sd])
		out["колено_" + sd] = kk[0]
		out["колено_выворот_" + sd] = kk[1]
		# голеностоп: тыльное (+) / подошвенное (−) сгибание и крен стопы относительно голени
		var rel := _delta(s, b(sd + "_Calf")).inverse() * _delta(s, b(sd + "_Foot"))
		var ff := rel * F
		var nn := rel * U
		out["стопа_сгиб_" + sd] = rad_to_deg(atan2(ff.dot(U), ff.dot(F)))
		out["стопа_крен_" + sd] = rad_to_deg(atan2(sg * nn.dot(R), nn.dot(U)))
		# локоть
		var sh: Vector3 = (s.g[b(sd + "_Upperarm")] as Transform3D).origin
		var el: Vector3 = (s.g[b(sd + "_Forearm")] as Transform3D).origin
		var wr: Vector3 = (s.g[b(sd + "_Hand")] as Transform3D).origin
		var ee := _hinge(s, sd + "_Upperarm", sh, el, wr, hinge["elbow_" + sd])
		out["локоть_" + sd] = ee[0]
		out["локоть_выворот_" + sd] = ee[1]
		# запястье: излом оси кисти относительно предплечья (от позы покоя)
		var mid: Vector3 = (s.g[b(sd + "_Mid1")] as Transform3D).origin
		var a_now := rad_to_deg((wr - el).angle_to(mid - wr))
		var a_rest := rad_to_deg(((rest[b(sd + "_Hand")] as Transform3D).origin - (rest[b(sd + "_Forearm")] as Transform3D).origin).angle_to(
			(rest[b(sd + "_Mid1")] as Transform3D).origin - (rest[b(sd + "_Hand")] as Transform3D).origin))
		out["запястье_" + sd] = absf(a_now - a_rest)
	return out


## двухзвенный шарнир: [угол сгиба со знаком, уход из плоскости сгиба], градусы
func _hinge(s: Dictionary, prox: String, a: Vector3, m: Vector3, c: Vector3, fd_local: Vector3) -> Array:
	var d1 := (m - a).normalized()
	var d2 := (c - m).normalized()
	var ang := rad_to_deg(d1.angle_to(d2))
	var fd: Vector3 = (s.g[b(prox)] as Transform3D).basis.orthonormalized() * fd_local
	var hexp := d1.cross(fd).normalized()
	var n := d1.cross(d2)
	var sgn := 1.0
	if n.length() > 0.02 and n.normalized().dot(hexp) < 0.0:
		sgn = -1.0
	var oop := rad_to_deg(asin(clampf(absf(d2.dot(hexp)), 0.0, 1.0)))
	return [ang * sgn, oop if ang > 12.0 else 0.0]


## вершины пробного набора сейчас (пространство скелета)
func pset_points(s: Dictionary, ps: Dictionary) -> Array:
	var out: Array = []
	for e in ps.v:
		var p := Vector3.ZERO
		for w in e:
			p += float(w[1]) * ((s.g[w[0]] as Transform3D) * (w[2] as Vector3))
		out.append(p)
	return out


## проникновения: [[набор, часть тела, глубина в метрах, точка в системе героя]] (глубже tol).
## Сначала грубо — вершины пробного набора внутри упрощённого объёма; затем точно — по ближайшей вершине
## поверхности этой части тела в той же позе и её нормали: глубина = −(p − q)·n.
func penetrations(s: Dictionary, tol := 0.0) -> Array:
	var out: Array = []
	var pts: Array = []
	for ps in psets:
		pts.append(pset_points(s, ps))
	var cand := {}          # "набор|группа" → {индекс вершины: точка}
	var gname := {}
	for v in vols:
		var vb: int = v.bone
		var M: Transform3D = (rest[vb] as Transform3D) * (s.g[vb] as Transform3D).affine_inverse()
		var g: String = v.group
		gname[g] = "туловище" if g == "torso" else v.name
		for i in psets.size():
			var ps: Dictionary = psets[i]
			# руки — со всем телом; ноги — только с другой ногой
			if not ps.arm and (g == "torso" or g == "head" or g.ends_with("_" + ps.side)):
				continue
			var key := "%d|%s" % [i, g]
			for j in pts[i].size():
				if _depth(v, M * (pts[i][j] as Vector3), false, 1.15) > 0.0:
					if not cand.has(key):
						cand[key] = {}
					cand[key][j] = pts[i][j]
	var posed := {}
	for key in cand:
		var parts: PackedStringArray = key.split("|")
		var i := int(parts[0])
		var g := parts[1]
		if not posed.has(g):
			posed[g] = _pose_group(s, g)
		var surf: Array = posed[g]
		var best := 0.0
		var bp := Vector3.ZERO
		for j in cand[key]:
			var p: Vector3 = cand[key][j]
			var qd := INF
			var qi := -1
			for t in surf.size():
				var d2 := p.distance_squared_to(surf[t][0])
				if d2 < qd:
					qd = d2
					qi = t
			if qi < 0:
				continue
			var depth := -(p - (surf[qi][0] as Vector3)).dot(surf[qi][1])
			if depth > best:
				best = depth
				bp = p
		if best * k > tol:
			out.append([psets[i].name, gname[g], best * k, (s.cs as Transform3D) * bp])
	return out


## поверхность части тела в текущей позе: [[точка, нормаль]] (пространство скелета)
func _pose_group(s: Dictionary, g: String) -> Array:
	var out: Array = []
	for e in tgroups.get(g, []):
		var p := Vector3.ZERO
		for w in e[0]:
			p += float(w[1]) * ((s.g[w[0]] as Transform3D) * (w[2] as Vector3))
		out.append([p, ((s.g[e[1]] as Transform3D).basis.orthonormalized() * (e[2] as Vector3)).normalized()])
	return out


func _depth(v: Dictionary, q: Vector3, medial := false, grow := 1.0) -> float:
	match v.kind:
		"sph":
			return float(v.r) * grow - q.distance_to(v.c)
		"cap":
			var a: Vector3 = v.a
			var ab: Vector3 = (v.b as Vector3) - a
			var t := clampf((q - a).dot(ab) / maxf(ab.length_squared(), 1e-9), 0.0, 1.0)
			var r := lerpf(v.ma, v.mb, t) if medial else lerpf(v.ra, v.rb, t)
			return r * grow - q.distance_to(a + ab * t)
		"ell":
			var y := q.dot(U)
			if y < float(v.lo) or y > float(v.hi):
				return -1.0
			var c: Vector3 = v.c
			var df := (q - c).dot(F)
			var dl := (q - c).dot(R)
			var dist := sqrt(df * df + dl * dl)
			if dist < 1e-6:
				return minf(v.front, v.right)
			var a: float = v.front if df > 0.0 else v.back
			var bb: float = v.right if dl > 0.0 else v.left
			var cs := df / dist
			var sn := dl / dist
			var re := 1.0 / sqrt(pow(cs / maxf(a, 1e-4), 2.0) + pow(sn / maxf(bb, 1e-4), 2.0))
			return re * grow - dist
	return -1.0


## точки тела для проверки «под полом»: [имя, позиция в системе героя (самая низкая вершина набора / сустав)]
func body_points(s: Dictionary) -> Array:
	var out: Array = []
	for n in ["Hip", "Head"]:
		out.append([n, pos(s, n) - Vector3(0, 0.08, 0)])
	for ps in psets:
		if ps.name.begins_with("стопа"):
			continue
		var lo := Vector3(0, INF, 0)
		for p in pset_points(s, ps):
			var w := (s.cs as Transform3D) * (p as Vector3)
			if w.y < lo.y:
				lo = w
		out.append([ps.name, lo])
	return out
