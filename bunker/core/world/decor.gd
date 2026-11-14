class_name BCDecor
## Наклейки грязи BunkerCore: пятна, трещины, ржавые потёки, мусор (атлас 2×2, tools/gen_decals.py) — плоские
## четырёхугольники на полу и стенах, одной сеткой на группу (один вызов отрисовки; объединяются с комнатой).
## Элемент: {tile: 0 пятно / 1 трещины / 2 ржавчина / 3 мусор, pos: Vector3 (локально в parent),
##           size: Vector2 (м), rot: градусы (на полу), wall: Vector3 — нормаль стены (ZERO — на полу)}.

const STAIN := 0
const CRACKS := 1
const RUST := 2
const DEBRIS := 3


static func decals(parent: Node3D, items: Array, node_name := "Grime") -> MeshInstance3D:
	if items.is_empty():
		return null
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for it in items:
		var tile: int = it.get("tile", 0)
		var u0 := float(tile % 2) * 0.5
		var v0 := float(tile / 2) * 0.5
		var sz: Vector2 = it.get("size", Vector2.ONE)
		var p: Vector3 = it.get("pos", Vector3.ZERO)
		var n: Vector3 = it.get("wall", Vector3.ZERO)
		var right: Vector3
		var up: Vector3
		var normal: Vector3
		if n == Vector3.ZERO:
			var b := Basis(Vector3.UP, deg_to_rad(it.get("rot", 0.0)))
			right = b.x * (sz.x * 0.5)
			up = -b.z * (sz.y * 0.5)
			normal = Vector3.UP
			p += Vector3(0, 0.008, 0)
		else:
			normal = n.normalized()
			right = Vector3.UP.cross(normal).normalized() * (sz.x * 0.5)
			up = Vector3.UP * (sz.y * 0.5)
			p += normal * 0.012
		var c := [p - right + up, p + right + up, p + right - up, p - right - up]
		var uv := [Vector2(u0, v0), Vector2(u0 + 0.5, v0), Vector2(u0 + 0.5, v0 + 0.5), Vector2(u0, v0 + 0.5)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(normal)
			st.set_uv(uv[k])
			st.add_vertex(c[k])
	var mesh := st.commit()
	mesh.surface_set_material(0, BCMat.get_mat("grime"))
	var mi := MeshInstance3D.new()
	mi.name = node_name
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# не объединять с предметами: общая сетка участка отбрасывает тень, и наклейка давала бы квадратную тень
	mi.set_meta("no_batch", true)
	parent.add_child(mi)
	return mi


## грязь для помещения: пятна и трещины на полу, мусор у стен, ржавые потёки на стенах.
## rect — внутренний прямоугольник (x0, z0, x1, z1) на высоте y; rng — для повторяемости.
static func room_grime(parent: Node3D, x0: float, z0: float, x1: float, z1: float, y: float, rng: RandomNumberGenerator, amount := 1.0) -> MeshInstance3D:
	var items := []
	var w := x1 - x0
	var d := z1 - z0
	var n := int(round((w * d) / 9.0 * amount)) + 1
	for i in n:
		items.append({"tile": STAIN if rng.randf() < 0.6 else CRACKS, "pos": Vector3(rng.randf_range(x0 + 0.6, x1 - 0.6), y, rng.randf_range(z0 + 0.6, z1 - 0.6)),
			"size": Vector2.ONE * rng.randf_range(0.8, 1.8), "rot": rng.randf() * 360.0})
	# мусор в углах
	for corner in [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]:
		if rng.randf() < 0.55 * amount:
			var cx: float = corner[0] + (0.5 if corner[0] == x0 else -0.5)
			var cz: float = corner[1] + (0.5 if corner[1] == z0 else -0.5)
			items.append({"tile": DEBRIS, "pos": Vector3(cx, y, cz), "size": Vector2.ONE * rng.randf_range(0.7, 1.1), "rot": rng.randf() * 360.0})
	# ржавые потёки на стенах (под трубами и просто от сырости)
	for i in int(1 + rng.randi() % 3):
		var side := rng.randi() % 4
		var along := rng.randf_range(0.15, 0.85)
		var p := Vector3.ZERO
		var nrm := Vector3.ZERO
		match side:
			0: p = Vector3(lerpf(x0, x1, along), 0, z0); nrm = Vector3(0, 0, 1)
			1: p = Vector3(lerpf(x0, x1, along), 0, z1); nrm = Vector3(0, 0, -1)
			2: p = Vector3(x0, 0, lerpf(z0, z1, along)); nrm = Vector3(1, 0, 0)
			_: p = Vector3(x1, 0, lerpf(z0, z1, along)); nrm = Vector3(-1, 0, 0)
		var hgt := rng.randf_range(1.0, 1.8)
		p.y = y + 2.85 - hgt * 0.5
		items.append({"tile": RUST, "pos": p, "size": Vector2(rng.randf_range(0.6, 1.2), hgt), "wall": nrm})
	return decals(parent, items, "Grime")
