class_name BCMesh
extends RefCounted
## Сборщик сеток BunkerCore: коробки, цилиндры, трубы, клинья — с UV в метрах (текстуры ложатся одинаково на
## любой размер), нормалями и касательными. Всё, что собрано одним сборщиком, становится ОДНОЙ сеткой с одной
## поверхностью на материал — минимум вызовов отрисовки на телефоне.

var _st := {}      # имя материала → SurfaceTool
var _aabb_min := Vector3.INF
var _aabb_max := -Vector3.INF


func _tool(mat: String) -> SurfaceTool:
	if not _st.has(mat):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[mat] = st
	return _st[mat]


## Godot считает лицевой гранью треугольник, обход которого по часовой стрелке при взгляде на лицо: тогда
## векторное произведение (p1-p0)×(p2-p0) смотрит ОТ зрителя. Порядок выбирается сам по нормали — так любая
## функция ниже может задавать вершины в удобном порядке.
const FRONT_SIGN := -1.0


func _tri3(st: SurfaceTool, xf: Transform3D, p: Array, n: Array, uv: Array) -> void:
	var g: Vector3 = (p[1] - p[0]).cross(p[2] - p[0])
	var avg: Vector3 = n[0] + n[1] + n[2]
	if g.dot(avg) * FRONT_SIGN < 0.0:
		_v(st, xf, p[0], n[0], uv[0]); _v(st, xf, p[2], n[2], uv[2]); _v(st, xf, p[1], n[1], uv[1])
	else:
		_v(st, xf, p[0], n[0], uv[0]); _v(st, xf, p[1], n[1], uv[1]); _v(st, xf, p[2], n[2], uv[2])


func _v(st: SurfaceTool, xf: Transform3D, p: Vector3, n: Vector3, uv: Vector2) -> void:
	var wp := xf * p
	st.set_normal((xf.basis * n).normalized())
	st.set_uv(uv)
	st.add_vertex(wp)
	_aabb_min = _aabb_min.min(wp)
	_aabb_max = _aabb_max.max(wp)


## четырёхугольник a-b-c-d (против часовой при взгляде с лица), uv — в метрах / масштаб
func quad(mat: String, xf: Transform3D, a: Vector3, b: Vector3, c: Vector3, d: Vector3, uvs := -1.0) -> void:
	var st := _tool(mat)
	var s := uvs if uvs > 0.0 else BCMat.uv_scale(mat)
	var n := (b - a).cross(d - a).normalized()
	# проекция на плоскость грани для UV
	var ax := (b - a).normalized()
	var ay := n.cross(ax)
	var uv := func(p: Vector3) -> Vector2: return Vector2((p - a).dot(ax), -(p - a).dot(ay)) / s
	_tri3(st, xf, [a, b, c], [n, n, n], [uv.call(a), uv.call(b), uv.call(c)])
	_tri3(st, xf, [a, c, d], [n, n, n], [uv.call(a), uv.call(c), uv.call(d)])


## коробка: центр и размер в локальных координатах xf; faces — какие грани строить (по умолчанию все)
func box(mat: String, xf: Transform3D, size: Vector3, center := Vector3.ZERO, uvs := -1.0, skip := []) -> void:
	var h := size * 0.5
	var c := center
	var p := [
		c + Vector3(-h.x, -h.y, -h.z), c + Vector3(h.x, -h.y, -h.z), c + Vector3(h.x, h.y, -h.z), c + Vector3(-h.x, h.y, -h.z),
		c + Vector3(-h.x, -h.y, h.z), c + Vector3(h.x, -h.y, h.z), c + Vector3(h.x, h.y, h.z), c + Vector3(-h.x, h.y, h.z)]
	# +Z, -Z, +X, -X, +Y, -Y
	if not "pz" in skip: quad(mat, xf, p[4], p[5], p[6], p[7], uvs)
	if not "nz" in skip: quad(mat, xf, p[1], p[0], p[3], p[2], uvs)
	if not "px" in skip: quad(mat, xf, p[5], p[1], p[2], p[6], uvs)
	if not "nx" in skip: quad(mat, xf, p[0], p[4], p[7], p[3], uvs)
	if not "py" in skip: quad(mat, xf, p[7], p[6], p[2], p[3], uvs)
	if not "ny" in skip: quad(mat, xf, p[0], p[1], p[5], p[4], uvs)


## коробка от угла (min) до угла (max)
func box_mm(mat: String, xf: Transform3D, a: Vector3, b: Vector3, uvs := -1.0, skip := []) -> void:
	box(mat, xf, (b - a).abs(), (a + b) * 0.5, uvs, skip)


## цилиндр вдоль оси Y: низ в center, радиус r, высота h
func cyl(mat: String, xf: Transform3D, r: float, h: float, center := Vector3.ZERO, seg := 12, caps := true, r_top := -1.0) -> void:
	var st := _tool(mat)
	var rt := r if r_top < 0.0 else r_top
	var s := BCMat.uv_scale(mat)
	var circ := TAU * r
	for i in seg:
		var a0 := TAU * i / seg
		var a1 := TAU * (i + 1) / seg
		var d0 := Vector3(cos(a0), 0, sin(a0))
		var d1 := Vector3(cos(a1), 0, sin(a1))
		var slope := (r - rt) / maxf(h, 0.001)
		var n0 := (d0 + Vector3(0, slope, 0)).normalized()
		var n1 := (d1 + Vector3(0, slope, 0)).normalized()
		var u0 := circ * i / seg / s
		var u1 := circ * (i + 1) / seg / s
		var b0 := center + d0 * r
		var b1 := center + d1 * r
		var t0 := center + d0 * rt + Vector3(0, h, 0)
		var t1 := center + d1 * rt + Vector3(0, h, 0)
		_tri3(st, xf, [b0, t1, b1], [n0, n1, n1], [Vector2(u0, h / s), Vector2(u1, 0), Vector2(u1, h / s)])
		_tri3(st, xf, [b0, t0, t1], [n0, n0, n1], [Vector2(u0, h / s), Vector2(u0, 0), Vector2(u1, 0)])
		if caps:
			var tc := center + Vector3(0, h, 0)
			var c0 := Vector2(0.5 + d0.x * 0.5, 0.5 + d0.z * 0.5)
			var c1 := Vector2(0.5 + d1.x * 0.5, 0.5 + d1.z * 0.5)
			_tri3(st, xf, [tc, t1, t0], [Vector3.UP, Vector3.UP, Vector3.UP], [Vector2(0.5, 0.5), c1, c0])
			_tri3(st, xf, [center, b0, b1], [Vector3.DOWN, Vector3.DOWN, Vector3.DOWN], [Vector2(0.5, 0.5), c0, c1])


## труба/цилиндр между двумя точками
func pipe(mat: String, xf: Transform3D, a: Vector3, b: Vector3, r: float, seg := 10, caps := true) -> void:
	var d := b - a
	var plen := d.length()
	if plen < 0.001:
		return
	var up := d / plen
	var ref := Vector3.UP if absf(up.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
	var x := ref.cross(up).normalized()
	var z := x.cross(up)
	var t := Transform3D(Basis(x, up, z), a)
	cyl(mat, xf * t, r, plen, Vector3.ZERO, seg, caps)


## сфера (низкополигональная)
func sphere(mat: String, xf: Transform3D, r: float, center := Vector3.ZERO, seg := 10, rings := 6, squash := Vector3.ONE) -> void:
	var st := _tool(mat)
	for j in rings:
		var v0 := PI * j / rings
		var v1 := PI * (j + 1) / rings
		for i in seg:
			var u0 := TAU * i / seg
			var u1 := TAU * (i + 1) / seg
			var pts := []
			for uv in [[u0, v0], [u1, v0], [u1, v1], [u0, v1]]:
				var n := Vector3(sin(uv[1]) * cos(uv[0]), cos(uv[1]), sin(uv[1]) * sin(uv[0]))
				pts.append([center + n * r * squash, n, Vector2(uv[0] / TAU, uv[1] / PI)])
			_tri3(st, xf, [pts[0][0], pts[1][0], pts[2][0]], [pts[0][1], pts[1][1], pts[2][1]], [pts[0][2], pts[1][2], pts[2][2]])
			_tri3(st, xf, [pts[0][0], pts[2][0], pts[3][0]], [pts[0][1], pts[2][1], pts[3][1]], [pts[0][2], pts[2][2], pts[3][2]])


## произвольный треугольник
func tri(mat: String, xf: Transform3D, a: Vector3, b: Vector3, c: Vector3, uvs := 1.0) -> void:
	var st := _tool(mat)
	var n := (b - a).cross(c - a).normalized()
	_tri3(st, xf, [a, b, c], [n, n, n], [Vector2(a.x + a.z, a.y) / uvs, Vector2(b.x + b.z, b.y) / uvs, Vector2(c.x + c.z, c.y) / uvs])


func is_empty() -> bool:
	return _st.is_empty()


func aabb() -> AABB:
	if _aabb_min.x == INF:
		return AABB()
	return AABB(_aabb_min, _aabb_max - _aabb_min)


func commit() -> ArrayMesh:
	var mesh := ArrayMesh.new()
	for mat in _st:
		var st: SurfaceTool = _st[mat]
		st.index()
		st.generate_tangents()
		st.commit(mesh)
		mesh.surface_set_material(mesh.get_surface_count() - 1, BCMat.get_mat(mat))
	return mesh


## готовый узел MeshInstance3D (тени — по флагу)
func to_instance(shadows := true, layers := 1) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	mi.mesh = commit()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadows else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = layers
	return mi
