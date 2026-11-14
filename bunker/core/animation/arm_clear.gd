class_name BCArmClear
extends SkeletonModifier3D
## Руки не проходят сквозь тело (BunkerCore). Клипы Tripo сделаны на «среднего» человека, а у героя объёмная
## куртка и рюкзак: опущенные руки уходят в полы куртки и бёдра на 5–10 см. Модификатор после клипа проверяет
## точки руки (локоть, середина предплечья, запястье, кисть — с их радиусами) против объёмов тела, снятых с сетки
## этой же модели в позе покоя (туловище — эллипсы в 6 поясах по высоте, бёдра — сужающиеся капсулы), и, если
## точка внутри, отводит плечо ровно настолько, чтобы она вышла на поверхность (+ запас). Угол сглаживается.
## Намеренные касания (ладонь на груди, кулак у лица) не трогаются: они на поверхности, а не внутри.

@export var margin := 0.01                  ## запас над поверхностью, м
@export var max_angle := deg_to_rad(28.0)
@export var rate_in := 30.0                 ## 1/с: как быстро отводится
@export var rate_out := 10.0                ## 1/с: как быстро возвращается

static var _models := {}                    ## путь модели → объёмы и точки (считаются один раз)

var _m := {}
var _ang := [0.0, 0.0]
var _axis: Array = [Vector3.FORWARD, Vector3.FORWARD]
var last_depth := [0.0, 0.0]                ## для проверки: глубина до поправки, м


## разобрать сетку модели (один раз на путь)
func setup_model(path: String, model: Node) -> void:
	if _models.has(path):
		_m = _models[path]
		return
	var sk: Skeleton3D = get_parent() as Skeleton3D
	if sk == null:
		return
	_m = _build(sk, model)
	_models[path] = _m


static func _build(sk: Skeleton3D, model: Node) -> Dictionary:
	var rest: Array = []
	for i in sk.get_bone_count():
		rest.append(sk.get_bone_global_rest(i))
	var by_bone := {}
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		if m.mesh == null or m.skin == null:
			continue
		var bind_bone: Array = []
		var bind_xf: Array = []
		for i in m.skin.get_bind_count():
			var bb := m.skin.get_bind_bone(i)
			if bb < 0:
				bb = sk.find_bone(m.skin.get_bind_name(i))
			bind_bone.append(bb)
			bind_xf.append(m.skin.get_bind_pose(i))
		for si in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(si)
			var vv: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
			var ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			if vv.is_empty() or bones.is_empty():
				continue
			var per := bones.size() / vv.size()
			for i in vv.size():
				var best := -1
				var bw := -1.0
				var p := Vector3.ZERO
				for j in per:
					var w: float = ws[i * per + j]
					var bind: int = bones[i * per + j]
					if w <= 0.001 or bind_bone[bind] < 0:
						continue
					p += w * ((rest[bind_bone[bind]] as Transform3D) * (bind_xf[bind] as Transform3D) * vv[i])
					if w > bw:
						bw = w
						best = bind_bone[bind]
				if best >= 0:
					if not by_bone.has(best):
						by_bone[best] = []
					by_bone[best].append(p)
	var b := func(n: String) -> int: return sk.find_bone(n)
	var F := Vector3.RIGHT
	var U := Vector3.UP
	# «вперёд» модели Tripo в пространстве скелета — +X (лицо); «вправо» — от левого бедра к правому
	var R := ((rest[b.call("R_Thigh")] as Transform3D).origin - (rest[b.call("L_Thigh")] as Transform3D).origin)
	R = (R - U * R.dot(U)).normalized()
	F = U.cross(R).normalized()
	var out := {"bins": [], "caps": [], "pts": [[], []], "upper": [b.call("L_Upperarm"), b.call("R_Upperarm")], "F": F, "U": U, "R": R}
	# туловище
	var tv: Array = []
	for n in ["Hip", "Pelvis", "Waist", "Spine01", "Spine02"]:
		for p in by_bone.get(b.call(n), []):
			tv.append([p, b.call(n)])
	var y0: float = (rest[b.call("Pelvis")] as Transform3D).origin.y - 0.06
	var y1: float = (rest[b.call("NeckTwist01")] as Transform3D).origin.y
	var a0: Vector3 = (rest[b.call("Hip")] as Transform3D).origin
	var a1: Vector3 = (rest[b.call("NeckTwist01")] as Transform3D).origin
	for i in 6:
		var lo := y0 + (y1 - y0) * i / 6.0
		var hi := y0 + (y1 - y0) * (i + 1) / 6.0
		var c := a0.lerp(a1, clampf(((lo + hi) * 0.5 - a0.y) / maxf(a1.y - a0.y, 0.001), 0.0, 1.0))
		c.y = (lo + hi) * 0.5
		var fp: Array = []
		var fn: Array = []
		var rp: Array = []
		var rn: Array = []
		var cnt := {}
		for e in tv:
			var p: Vector3 = e[0]
			if p.y < lo or p.y >= hi:
				continue
			var f := (p - c).dot(F)
			var r := (p - c).dot(R)
			(fp if f > 0.0 else fn).append(absf(f))
			(rp if r > 0.0 else rn).append(absf(r))
			cnt[e[1]] = cnt.get(e[1], 0) + 1
		if fp.size() + fn.size() < 30:
			continue
		var bone := -1
		var bc := -1
		for k in cnt:
			if cnt[k] > bc:
				bc = cnt[k]
				bone = k
		var ext := [_pct(fp, 0.85), _pct(fn, 0.85), _pct(rp, 0.85), _pct(rn, 0.85)]
		if ext.min() < 0.015:
			continue
		out.bins.append({"bone": bone, "c": c, "lo": lo, "hi": hi, "e": ext})
	# бёдра
	for s in ["L", "R"]:
		var pa: Vector3 = (rest[b.call(s + "_Thigh")] as Transform3D).origin
		var pb: Vector3 = (rest[b.call(s + "_Calf")] as Transform3D).origin
		var d0: Array = []
		var d1: Array = []
		for n in [s + "_Thigh", s + "_ThighTwist01", s + "_ThighTwist02"]:
			for p in by_bone.get(b.call(n), []):
				var t := clampf(((p as Vector3) - pa).dot(pb - pa) / (pb - pa).length_squared(), 0.0, 1.0)
				var dd := (p as Vector3).distance_to(pa.lerp(pb, t))
				if t < 0.4:
					d0.append(dd)
				elif t > 0.6:
					d1.append(dd)
		out.caps.append({"bone": b.call(s + "_Thigh"), "a": pa, "b": pb, "ra": _pct(d0, 0.5), "rb": _pct(d1, 0.5)})
	# точки рук: локоть, середина предплечья, запястье, кисть
	for si in 2:
		var s: String = ["L", "R"][si]
		var pf: Vector3 = (rest[b.call(s + "_Forearm")] as Transform3D).origin
		var ph: Vector3 = (rest[b.call(s + "_Hand")] as Transform3D).origin
		var pm: Vector3 = (rest[b.call(s + "_Mid1")] as Transform3D).origin
		var fa: Array = []
		for n in [s + "_Forearm", s + "_ForearmTwist01", s + "_ForearmTwist02"]:
			for p in by_bone.get(b.call(n), []):
				var t := clampf(((p as Vector3) - pf).dot(ph - pf) / (ph - pf).length_squared(), 0.0, 1.0)
				fa.append((p as Vector3).distance_to(pf.lerp(ph, t)))
		var rf := _pct(fa, 0.4) if fa.size() > 10 else 0.03
		var rh := clampf(rf * 0.55, 0.008, 0.03)
		var fb: int = b.call(s + "_Forearm")
		var hb: int = b.call(s + "_Hand")
		out.pts[si] = [[fb, (rest[fb] as Transform3D).affine_inverse() * pf, rf * 0.9],
			[fb, (rest[fb] as Transform3D).affine_inverse() * pf.lerp(ph, 0.5), rf],
			[hb, (rest[hb] as Transform3D).affine_inverse() * ph, rf * 0.8],
			[hb, (rest[hb] as Transform3D).affine_inverse() * ph.lerp(pm, 0.5), rh]]
	out["rest"] = rest
	return out


static func _pct(a: Array, q: float) -> float:
	if a.is_empty():
		return 0.0
	var s := a.duplicate()
	s.sort()
	return float(s[clampi(int(q * (s.size() - 1)), 0, s.size() - 1)])


func _process_modification_with_delta(delta: float) -> void:
	var s := get_skeleton()
	if s == null or _m.is_empty():
		return
	var sc := s.global_transform.basis.get_scale().y
	var mg := margin / maxf(sc, 0.001)
	var rest: Array = _m.rest
	for si in 2:
		var up_b: int = _m.upper[si]
		if up_b < 0:
			continue
		var S := s.get_bone_global_pose(up_b).origin
		var best := 0.0
		var push := Vector3.ZERO
		var bp := Vector3.ZERO
		for pt in _m.pts[si]:
			var p: Vector3 = s.get_bone_global_pose(pt[0]) * (pt[1] as Vector3)
			var r: float = pt[2]
			for bin in _m.bins:
				var G := s.get_bone_global_pose(bin.bone)
				var Rt: Transform3D = rest[bin.bone]
				var q: Vector3 = Rt * (G.affine_inverse() * p)
				if q.y < float(bin.lo) or q.y > float(bin.hi):
					continue
				var c: Vector3 = bin.c
				var df := (q - c).dot(_m.F)
				var dr := (q - c).dot(_m.R)
				var dist := sqrt(df * df + dr * dr)
				if dist < 1e-5:
					continue
				var e: Array = bin.e
				var a: float = e[0] if df > 0.0 else e[1]
				var bb: float = e[2] if dr > 0.0 else e[3]
				var re := 1.0 / sqrt(pow(df / dist / a, 2.0) + pow(dr / dist / bb, 2.0))
				var d := re + r + mg - dist
				if d > best:
					best = d
					# наружу по нормали эллипса, обратно в текущую позу
					var nl: Vector3 = (_m.F as Vector3) * (df / (a * a)) + (_m.R as Vector3) * (dr / (bb * bb))
					push = (G.basis.orthonormalized() * Rt.basis.orthonormalized().inverse() * nl).normalized()
					bp = p
			for cap in _m.caps:
				var G := s.get_bone_global_pose(cap.bone)
				var Rt: Transform3D = rest[cap.bone]
				var q: Vector3 = Rt * (G.affine_inverse() * p)
				var A: Vector3 = cap.a
				var ab: Vector3 = (cap.b as Vector3) - A
				var t := clampf((q - A).dot(ab) / ab.length_squared(), 0.0, 1.0)
				var ax := A + ab * t
				var dist := q.distance_to(ax)
				var d := lerpf(cap.ra, cap.rb, t) + r + mg - dist
				if d > best and dist > 1e-5:
					best = d
					push = (G.basis.orthonormalized() * Rt.basis.orthonormalized().inverse() * (q - ax)).normalized()
					bp = p
		last_depth[si] = maxf(0.0, best - mg) * sc
		var want := 0.0
		if best > 0.0:
			var arm := bp - S
			var ax := arm.cross(push)
			if ax.length() > 1e-5:
				_axis[si] = ax.normalized()
				want = clampf(atan2(best, arm.length()), 0.0, max_angle)
		var rate := rate_in if want > _ang[si] else rate_out
		_ang[si] = lerpf(_ang[si], want, clampf(rate * delta, 0.0, 1.0)) if delta > 0.0 else want
		if _ang[si] > 0.0005:
			var G := s.get_bone_global_pose(up_b)
			G.basis = Basis(_axis[si], _ang[si]) * G.basis
			s.set_bone_global_pose(up_b, G)
