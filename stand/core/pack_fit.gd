class_name BCPackFit
extends RefCounted
## Рюкзак на теле героя. Модель Tripo — цельная и жёсткая: лямки висят дугой «в воздухе», а поясной ремень
## большого рюкзака торчит крыльями шире бёдер. Поэтому рюкзак подгоняется под тело один раз при надевании:
##  1. Рюкзак ставится по телу: большой — поясом на таз (на уровень гребней подвздошных костей), малый и
##     средний — верхом по плечам. Спинка — на заданном расстоянии позади линии плеч.
##  2. Свои плечевые лямки модели убираются (они уходят внутрь туловища и протыкали бока) — на теле героя уже
##     есть лямки, идущие через плечи.
##  3. Крылья поясного ремня оборачиваются вокруг бёдер: каждая точка крыла переносится по своему направлению
##     от центра таза на поверхность тела (сечение тела замеряется по самой модели героя), толщина ремня
##     сохраняется. Чем дальше точка от спинки к телу, тем полнее она прилегает.
##  4. Рюкзак становится частью скелета (skinned mesh): корпус идёт за грудью, ремень — за тазом, переход —
##     плавный, поэтому при повороте корпуса ремень не отрывается от бёдер и не разъезжается с рюкзаком.
##
## Описание рюкзака (PACKS в stand.gd):
##   model, h (высота, м), back ("-z" / "-x": где у модели спинка), panel (координата спинки по оси к телу,
##   ед. модели), contact (какая точка модели ставится на линию GAP за плечами), cut (лямки — всё, что ближе
##   к телу, чем panel + cut), top (верх выше линии плеч, м), ride (корпус: доля груди и поясницы)
##   belt: {top: верх ремня (ед. модели, от низа), y: середина ремня, at: на сколько метров выше кости Hip}

const GAP := 0.085                ## линия спинки позади линии плеч, м (за ней — свой рюкзак модели героя)
const BINS := 36

static var _section := {}         ## высота → радиус тела по направлениям


static func build(rig: BCCharacter, pk: Dictionary) -> MeshInstance3D:
	var sk := rig.skel
	var h := rig.hold
	var k: float = h.k
	var scene: Node3D = (load(String(pk.model)) as PackedScene).instantiate()
	var u_m: float = float(pk.h) / 0.98            # метров в единице модели
	var sc: float = u_m * k                          # единиц скелета в единице модели
	var back := String(pk.get("back", "-z"))
	# оси модели → оси героя: верх → вверх, спинка → вперёд (к телу)
	var B := Basis(h.rgt, h.upv, -h.fwd) if back == "-z" else Basis(-h.fwd, h.upv, -h.rgt)
	var panel := float(pk.get("panel", 0.0))
	var cd := float(pk.get("contact", panel))
	var contact := Vector3(0, 0, -cd) if back == "-z" else Vector3(-cd, 0, 0)
	var hip_i := sk.find_bone("Hip")
	var hip_o := sk.get_bone_global_rest(hip_i).origin
	var bl: Dictionary = pk.get("belt", {})
	# по вертикали: большой — ремнём на таз, остальные — верхом по плечам
	var o: Vector3 = h._sc - h.fwd * (GAP * k)
	var y_low: float
	if not bl.is_empty():
		var hip_y := hip_o.dot(h.upv) / k + float(bl.at)
		y_low = hip_y - float(bl.y) * u_m
	else:
		y_low = h._sc.dot(h.upv) / k + float(pk.top) - float(pk.h)
	o += h.upv * (y_low * k - o.dot(h.upv))
	var T := Transform3D(B.scaled(Vector3.ONE * sc), o - B * (contact * sc))
	var belt_top := float(bl.get("top", -1.0))
	var cut := float(pk.get("cut", 0.06))
	# сечение тела на высоте ремня
	var Hc := hip_o
	var R := []
	if not bl.is_empty():
		var yb := (T * Vector3(0, float(bl.y), 0)).dot(h.upv)
		R = section(rig, yb, 0.035 * k)
		Hc = hip_o + h.upv * (yb - hip_o.dot(h.upv))
	# кости кожи: 0 — грудь, 1 — поясница, 2 — таз
	var bones := [sk.find_bone("Spine02"), sk.find_bone("Spine01"), hip_i]
	# привязки — на все кости по порядку (привязка i = кость i): номер в ARRAY_BONES — это и номер привязки,
	# и номер кости скелета, как бы движок его ни понимал
	var skin := Skin.new()
	for b in sk.get_bone_count():
		skin.add_bind(b, sk.get_bone_global_rest(b).affine_inverse())
	var body_w: Array = pk.get("ride", [1.0, 0.0])    # корпус: доля груди, доля поясницы
	var am := ArrayMesh.new()
	var cut_n := 0
	var belt_n := 0
	for mi in scene.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xm := _to_root(m, scene)
		for si in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(si)
			var mat: Material = m.mesh.surface_get_material(si)
			var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var ns = arr[Mesh.ARRAY_NORMAL]
			var ts = arr[Mesh.ARRAY_TANGENT]
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(vs.size()))
			var n := vs.size()
			var mv := PackedVector3Array()          # координаты модели
			mv.resize(n)
			var lat := PackedFloat32Array()
			var dd := PackedFloat32Array()
			lat.resize(n)
			dd.resize(n)
			for i in n:
				var p: Vector3 = xm * vs[i]
				mv[i] = p
				lat[i] = p.x if back == "-z" else p.z
				dd[i] = -p.z if back == "-z" else -p.x
			# треугольники: лямки (ближе к телу, чем спинка) — прочь, кроме ремня
			var keep := PackedInt32Array()
			for t in range(0, idx.size() - 2, 3):
				var a := idx[t]
				var b := idx[t + 1]
				var c := idx[t + 2]
				var dc := (dd[a] + dd[b] + dd[c]) / 3.0
				var yc := (mv[a].y + mv[b].y + mv[c].y) / 3.0
				if dc > panel + cut and not (belt_top > 0.0 and yc < belt_top):
					cut_n += 1
					continue
				keep.append(a)
				keep.append(b)
				keep.append(c)
			# вершины: в систему скелета; крылья ремня — на бёдра
			var out_v := PackedVector3Array()
			out_v.resize(n)
			var wt := PackedFloat32Array()
			wt.resize(n)
			var in_r := {}                       # направление → внутренний радиус ремня (для толщины)
			for i in n:
				out_v[i] = T * mv[i]
				var f := (dd[i] - panel) * u_m
				if belt_top > 0.0 and mv[i].y < belt_top + 0.01 and f > 0.0:
					wt[i] = smoothstep(0.02, 0.12, f)
				if wt[i] > 0.001:
					var rel := out_v[i] - Hc
					var x := rel.dot(h.rgt)
					var z := rel.dot(h.fwd)
					var bi := _bin(atan2(x, -z))
					var rr := sqrt(x * x + z * z)
					in_r[bi] = minf(float(in_r.get(bi, 1e9)), rr)
			for i in n:
				if wt[i] <= 0.001:
					continue
				var rel := out_v[i] - Hc
				var x := rel.dot(h.rgt)
				var z := rel.dot(h.fwd)
				var a := atan2(x, -z)
				var rr := sqrt(x * x + z * z)
				# толщина ремня — от его внутренней стороны, не больше 2 см (мягкий пояс прижат к телу)
				var thick := clampf((rr - float(in_r.get(_bin(a), rr))) * 0.6, 0.0, 0.02 * k)
				var want := (_radius(R, a) + 0.01) * k + thick
				var rn := lerpf(rr, want, wt[i])
				var dir := (h.rgt * x + h.fwd * z) / maxf(rr, 0.0001)
				# к пряжке спереди ремень сужается по высоте (крылья пояса — широкие у бёдер, узкие спереди)
				var front := clampf((absf(a) - PI * 0.55) / (PI * 0.4), 0.0, 1.0) * wt[i]
				var yv := rel.dot(h.upv)
				yv = lerpf(yv, yv * 0.5, front)
				out_v[i] = Hc + h.upv * yv + dir * rn
				belt_n += 1
			# нормали и касательные — вслед за поворотом модели
			var Bn := B.orthonormalized()
			var out_n := PackedVector3Array()
			if ns != null:
				out_n.resize(n)
				for i in n:
					out_n[i] = (Bn * (xm.basis * (ns as PackedVector3Array)[i])).normalized()
			var out_t := PackedFloat32Array()
			if ts != null:
				var tt: PackedFloat32Array = ts
				out_t.resize(tt.size())
				for i in n:
					var tv := (Bn * (xm.basis * Vector3(tt[i * 4], tt[i * 4 + 1], tt[i * 4 + 2]))).normalized()
					out_t[i * 4] = tv.x
					out_t[i * 4 + 1] = tv.y
					out_t[i * 4 + 2] = tv.z
					out_t[i * 4 + 3] = tt[i * 4 + 3]
			# кожа: корпус — грудь (и поясница у большого), ремень — таз
			var bo := PackedInt32Array()
			var we := PackedFloat32Array()
			bo.resize(n * 4)
			we.resize(n * 4)
			for i in n:
				var hw: float = wt[i]
				bo[i * 4] = bones[0]
				bo[i * 4 + 1] = bones[1]
				bo[i * 4 + 2] = bones[2]
				bo[i * 4 + 3] = bones[0]
				we[i * 4] = float(body_w[0]) * (1.0 - hw)
				we[i * 4 + 1] = float(body_w[1]) * (1.0 - hw)
				we[i * 4 + 2] = hw
				we[i * 4 + 3] = 0.0
			var a2 := arr.duplicate()
			a2[Mesh.ARRAY_VERTEX] = out_v
			if ns != null:
				a2[Mesh.ARRAY_NORMAL] = out_n
			if ts != null:
				a2[Mesh.ARRAY_TANGENT] = out_t
			a2[Mesh.ARRAY_BONES] = bo
			a2[Mesh.ARRAY_WEIGHTS] = we
			a2[Mesh.ARRAY_INDEX] = keep
			if keep.is_empty():
				continue
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a2)
			am.surface_set_material(am.get_surface_count() - 1, _fabric(mat, float(pk.get("tint", 0.8))))
	scene.free()
	var out := MeshInstance3D.new()
	out.name = "Pack"
	out.mesh = am
	out.skin = skin
	out.set_meta("Hc", Hc)
	out.set_meta("R", R)
	out.set_meta("cut", cut_n)
	out.set_meta("belt", belt_n)
	return out


## радиус тела (м) от центра таза по направлениям на высоте y (ед. скелета), по вершинам модели героя
static func section(rig: BCCharacter, y: float, band: float) -> Array:
	var key := "%d|%.4f" % [rig.get_instance_id(), y]
	if _section.has(key):
		return _section[key]
	var sk := rig.skel
	var h := rig.hold
	var k: float = h.k
	var hip_o := sk.get_bone_global_rest(sk.find_bone("Hip")).origin
	var r := []
	for i in BINS:
		r.append(0.0)
	for mi in rig.model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.name == "Pack" or m.mesh == null:
			continue
		var xf := sk.global_transform.affine_inverse() * m.global_transform
		for si in m.mesh.get_surface_count():
			for v in (m.mesh.surface_get_arrays(si)[Mesh.ARRAY_VERTEX] as PackedVector3Array):
				var p := xf * v
				if absf(p.dot(h.upv) - y) > band:
					continue
				var rel := p - hip_o
				var x := rel.dot(h.rgt) / k
				var z := rel.dot(h.fwd) / k
				var bi := _bin(atan2(x, -z))
				r[bi] = maxf(float(r[bi]), sqrt(x * x + z * z))
	# пустые направления — по соседям, затем сглаживание
	for pass_i in 3:
		for i in BINS:
			if float(r[i]) <= 0.0:
				var a := float(r[(i + BINS - 1) % BINS])
				var b := float(r[(i + 1) % BINS])
				r[i] = maxf(a, b)
	var s := []
	for i in BINS:
		s.append(maxf(float(r[i]), (float(r[(i + BINS - 1) % BINS]) + float(r[(i + 1) % BINS])) * 0.5))
	_section[key] = s
	return s


static func _bin(a: float) -> int:
	return int(floor((a + PI) / TAU * BINS)) % BINS


static func _radius(R: Array, a: float) -> float:
	if R.is_empty():
		return 0.2
	var x := (a + PI) / TAU * BINS - 0.5
	var i0 := int(floor(x))
	var u := x - i0
	return lerpf(float(R[(i0 % BINS + BINS) % BINS]), float(R[((i0 + 1) % BINS + BINS) % BINS]), u)


static func _to_root(n: Node3D, root: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


## ткань: без металла, матовая, цвет чуть приглушён
static func _fabric(src: Material, tint: float) -> Material:
	var s := src as StandardMaterial3D
	if s == null:
		return src
	var mt := s.duplicate() as StandardMaterial3D
	mt.metallic = 0.0
	mt.metallic_texture = null
	mt.roughness = 0.95
	mt.roughness_texture = null
	mt.albedo_color = Color(tint, tint, tint * 0.92)
	return mt
