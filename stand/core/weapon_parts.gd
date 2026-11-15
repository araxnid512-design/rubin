class_name BCWeaponParts
extends RefCounted
## Подвижные части оружия из цельной модели. Модель Tripo — одна сетка, поэтому части вырезаются по области:
## треугольник, центр которого лежит в многоугольнике (вид сбоку, координаты [z, y] модели), уходит в часть.
## Части: mag — магазин (короб), bolt — затвор / кожух-затвор / рукоятка затвора, cover — крышка ствольной
## коробки (пулемёт), pump — цевьё дробовика. Каждая часть — свой узел под узлом оружия: его смещение в
## системе модели двигает часть (вынуть магазин, отвести затвор, открыть крышку).
##
## Описание в data/weapons.json, поле "parts":
##   "mag":   {"poly": [[z, y], ...], "dir": [0, -1, 0], "rock": 0}   — dir: куда магазин выходит, rock — качание
##            при вынимании (АК: магазин поворачивается вперёд вокруг передней защёлки), град
##   "bolt":  {"poly": [...], "travel": 0.08}                          — ход назад, м
##   "cover": {"poly": [...], "hinge": [z, y], "angle": 75}            — крышка поворачивается вверх на петле
##   "pump":  {"poly": [...], "travel": 0.09}
##   у любой части "x": [мин, макс] — ограничить по ширине (магазин не захватывает соседние детали);
##   "keep": true — копия области, сама модель не режется (магазин пистолета спрятан в рукоятке: копия
##   нижней части рукоятки, сжатая "scale": [x, y, z] и тёмная "mat": [r, g, b], в рукоятке не видна);
##   "handle": [z, y] — где рука берётся за часть (рукоятка затвора, задняя часть кожуха-затвора)

var pivots := {}          ## часть → узел (смещение в системе модели)
var center := {}          ## часть → середина, ед. модели
var size := {}            ## часть → габарит, ед. модели
var top := {}             ## часть → верхняя точка (у магазина — горловина), ед. модели
var cfg := {}


## разрезать модель root (ребёнок holder) по описанию parts; части кладутся в holder
static func build(holder: Node3D, root: Node3D, parts: Dictionary) -> BCWeaponParts:
	var wp := BCWeaponParts.new()
	wp.cfg = parts
	if parts.is_empty():
		return wp
	var names: Array = parts.keys()
	var acc := {}           # часть → [[меш-узел, xf, поверхность → индексы]]
	var mins := {}
	var maxs := {}
	var top_y := {}
	var zr := {}
	for n in names:
		acc[n] = []
		var ty := -1e9
		var z0 := 1e9
		var z1 := -1e9
		for q in parts[n].poly:
			ty = maxf(ty, float(q[1]))
			z0 = minf(z0, float(q[0]))
			z1 = maxf(z1, float(q[0]))
		top_y[n] = ty
		zr[n] = [z0, z1]
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		var xf := _to_holder(m, holder)
		var body := ArrayMesh.new()
		var part_mesh := {}
		for n in names:
			part_mesh[n] = ArrayMesh.new()
		for si in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(si)
			var mat: Material = m.get_surface_override_material(si) if m.get_surface_override_material(si) else m.mesh.surface_get_material(si)
			var verts: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(verts.size()))
			var out := {"": PackedInt32Array()}
			for n in names:
				out[n] = PackedInt32Array()
			for t in range(0, idx.size() - 2, 3):
				var p0: Vector3 = xf * verts[idx[t]]
				var p1: Vector3 = xf * verts[idx[t + 1]]
				var p2: Vector3 = xf * verts[idx[t + 2]]
				var c := (p0 + p1 + p2) / 3.0
				var who := ""
				for n in names:
					var pc: Dictionary = parts[n]
					if pc.has("x") and (c.x < float(pc.x[0]) or c.x > float(pc.x[1])):
						continue
					# в часть — если внутри середина или хотя бы две вершины (длинные треугольники по краю детали
					# иначе оставались бы висеть на оружии)
					var cnt := 0
					for q in [p0, p1, p2]:
						if _inside(Vector2(q.z, q.y), pc.poly):
							cnt += 1
					# длинный треугольник «коробка — дно магазина»: одна вершина в магазине, середина ниже горловины
					var hang: bool = n == "mag" and pc.get("hang", true) and cnt == 1 and c.y < float(top_y[n]) - 0.012 and c.z > float(zr[n][0]) and c.z < float(zr[n][1])
					if cnt >= 2 or _inside(Vector2(c.z, c.y), pc.poly) or hang:
						who = n
						break
				var o: PackedInt32Array = out[who]
				o.append(idx[t])
				o.append(idx[t + 1])
				o.append(idx[t + 2])
				out[who] = o
				if who != "" and parts[who].get("keep", false):
					var ob: PackedInt32Array = out[""]
					ob.append(idx[t])
					ob.append(idx[t + 1])
					ob.append(idx[t + 2])
					out[""] = ob
				if who != "":
					for q in 3:
						var p: Vector3 = xf * verts[idx[t + q]]
						mins[who] = p if not mins.has(who) else (mins[who] as Vector3).min(p)
						maxs[who] = p if not maxs.has(who) else (maxs[who] as Vector3).max(p)
			for key in out:
				if (out[key] as PackedInt32Array).is_empty():
					continue
				var a2 := arr.duplicate()
				a2[Mesh.ARRAY_INDEX] = out[key]
				var dst: ArrayMesh = body if key == "" else part_mesh[key]
				dst.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, a2)
				dst.surface_set_material(dst.get_surface_count() - 1, mat)
		m.mesh = body
		for si in body.get_surface_count():
			m.set_surface_override_material(si, null)
		for n in names:
			if (part_mesh[n] as ArrayMesh).get_surface_count() > 0:
				acc[n].append([part_mesh[n], xf])
	for n in names:
		if (acc[n] as Array).is_empty():
			continue
		var pv := Node3D.new()
		pv.name = "Part_" + n
		holder.add_child(pv)
		for it in acc[n]:
			var pm := MeshInstance3D.new()
			pm.mesh = it[0]
			pm.transform = it[1]
			pv.add_child(pm)
		wp.pivots[n] = pv
		wp.center[n] = ((mins[n] as Vector3) + (maxs[n] as Vector3)) * 0.5
		wp.size[n] = (maxs[n] as Vector3) - (mins[n] as Vector3)
		wp.top[n] = Vector3(wp.center[n].x, (maxs[n] as Vector3).y, wp.center[n].z)
		var pc: Dictionary = parts[n]
		if pc.has("scale"):
			var sv := Vector3(pc.scale[0], pc.scale[1], pc.scale[2])
			var c0: Vector3 = wp.center[n]
			var S := Transform3D(Basis.from_scale(sv), c0 - Basis.from_scale(sv) * c0)
			for ch in pv.get_children():
				(ch as MeshInstance3D).transform = S * (ch as MeshInstance3D).transform
			wp.size[n] = (wp.size[n] as Vector3) * sv
		if pc.has("mat"):
			var mt := StandardMaterial3D.new()
			mt.albedo_color = Color(pc.mat[0], pc.mat[1], pc.mat[2])
			mt.metallic = 0.6
			mt.roughness = 0.45
			for ch in pv.get_children():
				(ch as MeshInstance3D).material_override = mt
	return wp


static func _to_holder(n: Node3D, holder: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != holder:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


static func _inside(p: Vector2, poly: Array) -> bool:
	var inside := false
	var j := poly.size() - 1
	for i in poly.size():
		var a := Vector2(poly[i][0], poly[i][1])
		var b := Vector2(poly[j][0], poly[j][1])
		if (a.y > p.y) != (b.y > p.y) and p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x:
			inside = not inside
		j = i
	return inside


func has(n: String) -> bool:
	return pivots.has(n)


## смещение части (система модели)
func place(n: String, t: Transform3D) -> void:
	if pivots.has(n):
		(pivots[n] as Node3D).transform = t


func show(n: String, on: bool) -> void:
	if pivots.has(n):
		(pivots[n] as Node3D).visible = on


## копия части (выброшенный магазин): узел с теми же сетками, кладётся в parent
func copy(n: String, parent: Node3D) -> Node3D:
	if not pivots.has(n):
		return null
	var c := Node3D.new()
	for ch in (pivots[n] as Node3D).get_children():
		var m := MeshInstance3D.new()
		m.mesh = (ch as MeshInstance3D).mesh
		m.transform = (ch as MeshInstance3D).transform
		c.add_child(m)
	parent.add_child(c)
	return c


## магазин вынут: сдвиг вдоль dir на свою длину с качанием rock (вокруг передней верхней точки)
func mag_out() -> Transform3D:
	if not has("mag"):
		return Transform3D.IDENTITY
	var mc: Dictionary = cfg.mag
	var d := Vector3(mc.get("dir", [0, -1, 0])[0], mc.get("dir", [0, -1, 0])[1], mc.get("dir", [0, -1, 0])[2]).normalized()
	var sz: Vector3 = size.mag
	var L := absf(sz.dot(d)) * 1.08 + 0.02
	var rock := deg_to_rad(float(mc.get("rock", 0.0)))
	var piv: Vector3 = top.mag + Vector3(0, 0, -sz.z * 0.5)       # передний край горловины (ствол смотрит в −Z)
	var R := Basis(Vector3.RIGHT, rock)
	return Transform3D(R, piv - R * piv).translated(d * L)


## точка хвата магазина рукой (ниже середины), в системе модели при смещении t
func mag_grip(t: Transform3D) -> Vector3:
	var mc: Dictionary = cfg.get("mag", {})
	var d := Vector3(mc.get("dir", [0, -1, 0])[0], mc.get("dir", [0, -1, 0])[1], mc.get("dir", [0, -1, 0])[2]).normalized()
	var sz: Vector3 = size.get("mag", Vector3.ONE * 0.1)
	return t * ((center.get("mag", Vector3.ZERO) as Vector3) + d * (absf(sz.dot(d)) * 0.22))


## затвор отведён на долю u хода
func bolt_t(n: String, u: float, metres_to_model: float) -> Transform3D:
	if not has(n):
		return Transform3D.IDENTITY
	return Transform3D(Basis.IDENTITY, Vector3(0, 0, float(cfg[n].get("travel", 0.06)) * metres_to_model * u))


## крышка открыта на долю u
func cover_t(u: float) -> Transform3D:
	if not has("cover"):
		return Transform3D.IDENTITY
	var cc: Dictionary = cfg.cover
	var h := Vector3(0, float(cc.hinge[1]), float(cc.hinge[0]))
	var R := Basis(Vector3.RIGHT, -deg_to_rad(float(cc.get("angle", 70.0))) * u)
	return Transform3D(R, h - R * h)


## точка, за которую рука берётся за часть (handle или середина), в системе модели
func grab_point(n: String) -> Vector3:
	if not has(n):
		return Vector3.ZERO
	if cfg[n].has("handle"):
		return Vector3((center[n] as Vector3).x, float(cfg[n].handle[1]), float(cfg[n].handle[0]))
	return center[n]
