class_name MeshBuilder
extends RefCounted
## Процедурный генератор low-poly геометрии.
## Цвет вершины: RGB — альбедо (sRGB), A — код материала (см. MAT_*).
## Поддерживает скиннинг (кости/веса) для персонажей.

const MAT_CONCRETE := 0.0
const MAT_BRICK := 0.1
const MAT_PAINT := 0.2
const MAT_RUST := 0.3
const MAT_WOOD := 0.4
const MAT_CLOTH := 0.5
const MAT_FOLIAGE := 0.6
const MAT_GLASS := 0.7
const MAT_LAMP := 0.8
const MAT_SKIN := 0.9
const MAT_RUBBER := 1.0

var verts := PackedVector3Array()
var norms := PackedVector3Array()
var cols := PackedColorArray()
var idx := PackedInt32Array()
var bones := PackedInt32Array()
var weights := PackedFloat32Array()
var skinned := false
var _skin_b := PackedInt32Array([0, 0, 0, 0])
var _skin_w := PackedFloat32Array([1.0, 0.0, 0.0, 0.0])

static func mat(c: Color, m: float) -> Color:
	return Color(c.r, c.g, c.b, m)

static func jitter(c: Color, rng: RandomNumberGenerator, amount: float = 0.08) -> Color:
	var k := 1.0 + rng.randf_range(-amount, amount)
	return Color(clampf(c.r * k, 0, 1), clampf(c.g * k, 0, 1), clampf(c.b * k, 0, 1), c.a)

func set_bone(b: int) -> void:
	skinned = true
	_skin_b = PackedInt32Array([b, 0, 0, 0])
	_skin_w = PackedFloat32Array([1.0, 0.0, 0.0, 0.0])

func set_bone_blend(b0: int, b1: int, w1: float) -> void:
	skinned = true
	_skin_b = PackedInt32Array([b0, b1, 0, 0])
	_skin_w = PackedFloat32Array([1.0 - w1, w1, 0.0, 0.0])

func vertex_count() -> int:
	return verts.size()

func is_empty() -> bool:
	return idx.is_empty()

func _v(p: Vector3, n: Vector3, c: Color) -> int:
	verts.append(p)
	norms.append(n)
	cols.append(c)
	if skinned:
		bones.append_array(_skin_b)
		weights.append_array(_skin_w)
	return verts.size() - 1

func _v_skin(p: Vector3, n: Vector3, c: Color, b: PackedInt32Array, w: PackedFloat32Array) -> int:
	verts.append(p)
	norms.append(n)
	cols.append(c)
	bones.append_array(b)
	weights.append_array(w)
	return verts.size() - 1

func add_tri(a: Vector3, b: Vector3, c: Vector3, col: Color, n: Vector3 = Vector3.ZERO) -> void:
	var fn := (b - a).cross(c - a)
	if fn.length_squared() < 1e-12:
		return
	if n == Vector3.ZERO:
		n = fn.normalized()
	var i0 := _v(a, n, col)
	var i1 := _v(b, n, col)
	var i2 := _v(c, n, col)
	if fn.dot(n) > 0.0:
		idx.append_array([i0, i2, i1])
	else:
		idx.append_array([i0, i1, i2])

func add_quad(p0: Vector3, p1: Vector3, p2: Vector3, p3: Vector3, col: Color, n: Vector3 = Vector3.ZERO) -> void:
	var fn := (p1 - p0).cross(p2 - p0)
	if fn.length_squared() < 1e-12:
		fn = (p2 - p0).cross(p3 - p0)
	if n == Vector3.ZERO:
		n = fn.normalized()
	var i0 := _v(p0, n, col)
	var i1 := _v(p1, n, col)
	var i2 := _v(p2, n, col)
	var i3 := _v(p3, n, col)
	if fn.dot(n) > 0.0:
		idx.append_array([i0, i3, i2, i0, i2, i1])
	else:
		idx.append_array([i0, i1, i2, i0, i2, i3])

func add_quad_smooth(p: Array, n: Array, col: Color, face_n: Vector3) -> void:
	var fn: Vector3 = (p[1] - p[0]).cross(p[2] - p[0])
	var i0 := _v(p[0], n[0], col)
	var i1 := _v(p[1], n[1], col)
	var i2 := _v(p[2], n[2], col)
	var i3 := _v(p[3], n[3], col)
	if fn.dot(face_n) > 0.0:
		idx.append_array([i0, i3, i2, i0, i2, i1])
	else:
		idx.append_array([i0, i1, i2, i0, i2, i3])

const _FACES := [
	[Vector3(1, 0, 0), Vector3(0, 0, -1), Vector3(0, 1, 0)],
	[Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 1, 0)],
	[Vector3(0, 1, 0), Vector3(1, 0, 0), Vector3(0, 0, -1)],
	[Vector3(0, -1, 0), Vector3(1, 0, 0), Vector3(0, 0, 1)],
	[Vector3(0, 0, 1), Vector3(1, 0, 0), Vector3(0, 1, 0)],
	[Vector3(0, 0, -1), Vector3(-1, 0, 0), Vector3(0, 1, 0)],
]

func add_box(xf: Transform3D, size: Vector3, col: Color, skip_bottom: bool = false, top_col: Variant = null) -> void:
	## Параллелепипед с центром в начале xf.
	var h := size * 0.5
	var b := xf.basis
	for fi in 6:
		if skip_bottom and fi == 3:
			continue
		var f: Array = _FACES[fi]
		var n: Vector3 = f[0]
		var u: Vector3 = f[1]
		var v: Vector3 = f[2]
		var c := n * h
		var uu := u * h
		var vv := v * h
		var wn := (b * n).normalized()
		var fc := col
		if fi == 2 and top_col != null:
			fc = top_col
		var i0 := _v(xf * (c - uu - vv), wn, fc)
		var i1 := _v(xf * (c + uu - vv), wn, fc)
		var i2 := _v(xf * (c + uu + vv), wn, fc)
		var i3 := _v(xf * (c - uu + vv), wn, fc)
		idx.append_array([i0, i3, i2, i0, i2, i1])

func box(center: Vector3, size: Vector3, col: Color, rot_y: float = 0.0, skip_bottom: bool = false) -> void:
	add_box(Transform3D(Basis(Vector3.UP, rot_y), center), size, col, skip_bottom)

func box_minmax(a: Vector3, b: Vector3, col: Color, skip_bottom: bool = false) -> void:
	var mn := Vector3(minf(a.x, b.x), minf(a.y, b.y), minf(a.z, b.z))
	var mx := Vector3(maxf(a.x, b.x), maxf(a.y, b.y), maxf(a.z, b.z))
	add_box(Transform3D(Basis(), (mn + mx) * 0.5), mx - mn, col, skip_bottom)

func add_cyl(xf: Transform3D, r0: float, r1: float, h: float, sides: int, col: Color, caps: bool = true, smooth: bool = true, cap_col: Variant = null) -> void:
	## Цилиндр/конус вдоль локальной оси Y от 0 до h.
	var b := xf.basis
	var slope := (r0 - r1) / maxf(h, 0.0001)
	for i in sides:
		var a0 := TAU * float(i) / sides
		var a1 := TAU * float(i + 1) / sides
		var d0 := Vector3(cos(a0), 0, sin(a0))
		var d1 := Vector3(cos(a1), 0, sin(a1))
		var p0 := xf * (d0 * r0)
		var p1 := xf * (d1 * r0)
		var p2 := xf * (d1 * r1 + Vector3(0, h, 0))
		var p3 := xf * (d0 * r1 + Vector3(0, h, 0))
		var dm := (d0 + d1).normalized()
		var fnrm := (b * (dm + Vector3(0, slope, 0)).normalized()).normalized()
		if smooth:
			var n0 := (b * (d0 + Vector3(0, slope, 0)).normalized()).normalized()
			var n1 := (b * (d1 + Vector3(0, slope, 0)).normalized()).normalized()
			add_quad_smooth([p0, p1, p2, p3], [n0, n1, n1, n0], col, fnrm)
		else:
			add_quad(p0, p1, p2, p3, col, fnrm)
	if caps:
		var cc: Color = col if cap_col == null else cap_col
		var top := xf * Vector3(0, h, 0)
		var bot := xf * Vector3.ZERO
		var up := (b * Vector3.UP).normalized()
		for i in sides:
			var a0 := TAU * float(i) / sides
			var a1 := TAU * float(i + 1) / sides
			var d0 := Vector3(cos(a0), 0, sin(a0))
			var d1 := Vector3(cos(a1), 0, sin(a1))
			if r1 > 0.001:
				add_tri(top, xf * (d0 * r1 + Vector3(0, h, 0)), xf * (d1 * r1 + Vector3(0, h, 0)), cc, up)
			if r0 > 0.001:
				add_tri(bot, xf * (d1 * r0), xf * (d0 * r0), cc, -up)

func cyl(base: Vector3, r: float, h: float, sides: int, col: Color, caps: bool = true) -> void:
	add_cyl(Transform3D(Basis(), base), r, r, h, sides, col, caps)

func cyl_between(a: Vector3, b: Vector3, r0: float, r1: float, sides: int, col: Color, caps: bool = true) -> void:
	var d := b - a
	var l := d.length()
	if l < 0.0001:
		return
	var y := d / l
	var x := y.cross(Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT).normalized()
	var z := x.cross(y).normalized()
	add_cyl(Transform3D(Basis(x, y, z), a), r0, r1, l, sides, col, caps)

func beam(a: Vector3, b: Vector3, w: float, hgt: float, col: Color) -> void:
	## Брус прямоугольного сечения между двумя точками.
	var d := b - a
	var l := d.length()
	if l < 0.0001:
		return
	var z := d / l
	var up := Vector3.UP if absf(z.dot(Vector3.UP)) < 0.95 else Vector3.RIGHT
	var x := up.cross(z).normalized()
	var y := z.cross(x).normalized()
	add_box(Transform3D(Basis(x, y, z), (a + b) * 0.5), Vector3(w, hgt, l), col)

func add_blob(center: Vector3, radius: Vector3, col: Color, rng: RandomNumberGenerator, rough: float = 0.25, flat_bottom: bool = false) -> void:
	## Low-poly «глыба» (камень, крона, куст): деформированный октаэдр с подразделением.
	var base := [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 1, 0), Vector3(0, -1, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]
	var faces := [[0, 2, 4], [4, 2, 1], [1, 2, 5], [5, 2, 0], [0, 4, 3], [4, 1, 3], [1, 5, 3], [5, 0, 3]]
	var cache := {}
	var pts: Array = []
	for p in base:
		pts.append(p)
	var tris: Array = []
	for f in faces:
		var a: int = f[0]
		var b: int = f[1]
		var c: int = f[2]
		var ab := _mid(pts, cache, a, b)
		var bc := _mid(pts, cache, b, c)
		var ca := _mid(pts, cache, c, a)
		tris.append([a, ab, ca])
		tris.append([b, bc, ab])
		tris.append([c, ca, bc])
		tris.append([ab, bc, ca])
	var disp: Array = []
	for p in pts:
		var k := 1.0 + rng.randf_range(-rough, rough)
		var q: Vector3 = p * k
		q = Vector3(q.x * radius.x, q.y * radius.y, q.z * radius.z)
		if flat_bottom and q.y < -radius.y * 0.3:
			q.y = -radius.y * 0.3
		disp.append(center + q)
	for t in tris:
		var pa: Vector3 = disp[t[0]]
		var pb: Vector3 = disp[t[1]]
		var pc: Vector3 = disp[t[2]]
		var n := (pb - pa).cross(pc - pa).normalized()
		if n.dot((pa + pb + pc) / 3.0 - center) < 0:
			n = -n
		add_tri(pa, pb, pc, jitter(col, rng, 0.06), n)

func _mid(pts: Array, cache: Dictionary, a: int, b: int) -> int:
	var key := mini(a, b) * 64 + maxi(a, b)
	if cache.has(key):
		return cache[key]
	pts.append(((pts[a] + pts[b]) * 0.5).normalized())
	cache[key] = pts.size() - 1
	return pts.size() - 1

func add_limb(p0: Vector3, p1: Vector3, rx0: float, rz0: float, rx1: float, rz1: float, sides: int, col: Color,
		fwd: Vector3, b0: PackedInt32Array, w0: PackedFloat32Array, b1: PackedInt32Array, w1: PackedFloat32Array,
		cap0: bool = false, cap1: bool = false) -> void:
	## Сегмент тела (эллиптическая призма) со скиннингом колец: кольцо p0 — веса b0/w0, кольцо p1 — b1/w1.
	skinned = true
	var y := (p1 - p0).normalized()
	var z := (fwd - y * fwd.dot(y)).normalized()
	var x := y.cross(z).normalized()
	var ring0: Array = []
	var ring1: Array = []
	var nrm: Array = []
	for i in sides:
		var a := TAU * float(i) / sides
		var ca := cos(a)
		var sa := sin(a)
		ring0.append(p0 + x * (ca * rx0) + z * (sa * rz0))
		ring1.append(p1 + x * (ca * rx1) + z * (sa * rz1))
		nrm.append((x * (ca / maxf(rx0, 0.001)) + z * (sa / maxf(rz0, 0.001))).normalized())
	for i in sides:
		var j := (i + 1) % sides
		var a0: Vector3 = ring0[i]
		var a1: Vector3 = ring0[j]
		var c1: Vector3 = ring1[j]
		var c0: Vector3 = ring1[i]
		var fn: Vector3 = (nrm[i] + nrm[j]).normalized()
		var i0 := _v_skin(a0, nrm[i], col, b0, w0)
		var i1 := _v_skin(a1, nrm[j], col, b0, w0)
		var i2 := _v_skin(c1, nrm[j], col, b1, w1)
		var i3 := _v_skin(c0, nrm[i], col, b1, w1)
		var tn := (a1 - a0).cross(c1 - a0)
		if tn.dot(fn) > 0.0:
			idx.append_array([i0, i3, i2, i0, i2, i1])
		else:
			idx.append_array([i0, i1, i2, i0, i2, i3])
	if cap0:
		var ci := _v_skin(p0, -y, col, b0, w0)
		for i in sides:
			var j := (i + 1) % sides
			var ia := _v_skin(ring0[i], -y, col, b0, w0)
			var ib := _v_skin(ring0[j], -y, col, b0, w0)
			var tn: Vector3 = (ring0[i] - p0).cross(ring0[j] - p0)
			if tn.dot(-y) > 0.0:
				idx.append_array([ci, ib, ia])
			else:
				idx.append_array([ci, ia, ib])
	if cap1:
		var ci := _v_skin(p1, y, col, b1, w1)
		for i in sides:
			var j := (i + 1) % sides
			var ia := _v_skin(ring1[i], y, col, b1, w1)
			var ib := _v_skin(ring1[j], y, col, b1, w1)
			var tn: Vector3 = (ring1[i] - p1).cross(ring1[j] - p1)
			if tn.dot(y) > 0.0:
				idx.append_array([ci, ib, ia])
			else:
				idx.append_array([ci, ia, ib])

func append_builder(o: MeshBuilder, xf: Transform3D = Transform3D.IDENTITY) -> void:
	var base := verts.size()
	var b := xf.basis
	for i in o.verts.size():
		verts.append(xf * o.verts[i])
		norms.append((b * o.norms[i]).normalized())
	cols.append_array(o.cols)
	if skinned or o.skinned:
		bones.append_array(o.bones)
		weights.append_array(o.weights)
	for i in o.idx:
		idx.append(base + i)

func build(material: Material = null, mesh: ArrayMesh = null) -> ArrayMesh:
	if mesh == null:
		mesh = ArrayMesh.new()
	if idx.is_empty():
		return mesh
	var arr := []
	arr.resize(Mesh.ARRAY_MAX)
	arr[Mesh.ARRAY_VERTEX] = verts
	arr[Mesh.ARRAY_NORMAL] = norms
	arr[Mesh.ARRAY_COLOR] = cols
	arr[Mesh.ARRAY_INDEX] = idx
	if skinned:
		arr[Mesh.ARRAY_BONES] = bones
		arr[Mesh.ARRAY_WEIGHTS] = weights
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
	if material:
		mesh.surface_set_material(mesh.get_surface_count() - 1, material)
	return mesh

func get_faces() -> PackedVector3Array:
	## Треугольники для навигации/коллизий.
	var f := PackedVector3Array()
	f.resize(idx.size())
	for i in idx.size():
		f[i] = verts[idx[i]]
	return f

func clear() -> void:
	verts.clear()
	norms.clear()
	cols.clear()
	idx.clear()
	bones.clear()
	weights.clear()
