@tool
class_name BCTerrain
extends Node3D
## Рельеф поверхности: сетка с высотами (шум + ровные площадки + насыпи), смешение земли, сухой травы, гравия
## и асфальта по маске (вершинные цвета), коллизия HeightMapShape3D. Плоские участки (flats) задаются
## прямоугольниками [x, z, w, d, высота], насыпи (mounds) — [x, z, радиус, высота], дороги (roads) — ломаные
## [[x, z], ...] шириной road_width.

@export var size := 100.0
@export var cell := 1.0
@export var amp := 0.45
@export var seed_value := 7
@export var flats: Array = []
@export var mounds: Array = []
@export var roads: Array = []
@export var road_width := 3.0
@export var holes: Array = []       ## [x, z, w, d] — вырез в рельефе (проём входа в бункер)

var _noise := FastNoiseLite.new()
var heights := PackedFloat32Array()
var n := 0


func _ready() -> void:
	build()


func height_at(x: float, z: float) -> float:
	var h := _noise.get_noise_2d(x * 0.9, z * 0.9) * amp + _noise.get_noise_2d(x * 3.1, z * 3.1) * amp * 0.25
	for m in mounds:
		var d := Vector2(x - m[0], z - m[1]).length()
		var r: float = m[2]
		if d < r:
			var f := 1.0 - d / r
			h += m[3] * (f * f * (3.0 - 2.0 * f))
	for f in flats:
		var dx := maxf(absf(x - f[0]) - f[2] * 0.5, 0.0)
		var dz := maxf(absf(z - f[1]) - f[3] * 0.5, 0.0)
		var d := sqrt(dx * dx + dz * dz)
		var blend := clampf(1.0 - d / 2.5, 0.0, 1.0)
		h = lerpf(h, f[4], blend * blend * (3.0 - 2.0 * blend))
	return h


func road_mask(x: float, z: float) -> float:
	var best := 1e9
	var p := Vector2(x, z)
	for r in roads:
		for i in r.size() - 1:
			var a := Vector2(r[i][0], r[i][1])
			var b := Vector2(r[i + 1][0], r[i + 1][1])
			var ab := b - a
			var t := clampf((p - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
			best = minf(best, p.distance_to(a + ab * t))
	var hw := road_width * 0.5
	# рваный край асфальта
	var edge := hw + _noise.get_noise_2d(x * 2.0, z * 2.0) * 0.6
	return clampf((edge - best) / 0.5, 0.0, 1.0)


func build() -> void:
	BCKit.clear_generated(self)
	_noise.seed = seed_value
	_noise.frequency = 0.035
	_noise.fractal_octaves = 3
	n = int(size / cell) + 1
	heights.resize(n * n)
	var half := size * 0.5
	for j in n:
		for i in n:
			heights[j * n + i] = height_at(-half + i * cell, -half + j * cell)
	# сетка: цвет вершины — веса (R — трава, G — гравий, B — асфальт)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for j in n:
		for i in n:
			var x := -half + i * cell
			var z := -half + j * cell
			var h := heights[j * n + i]
			var hl := heights[j * n + maxi(i - 1, 0)]
			var hr := heights[j * n + mini(i + 1, n - 1)]
			var hd := heights[maxi(j - 1, 0) * n + i]
			var hu := heights[mini(j + 1, n - 1) * n + i]
			var nrm := Vector3(hl - hr, 2.0 * cell, hd - hu).normalized()
			var g := clampf(_noise.get_noise_2d(x * 1.7 + 40.0, z * 1.7) * 1.8 + 0.62, 0.0, 1.0)
			var gr := clampf(_noise.get_noise_2d(x * 2.3, z * 2.3 + 90.0) * 2.0 - 0.3, 0.0, 1.0)
			var rd := road_mask(x, z)
			st.set_color(Color(g * (1.0 - rd), gr * (1.0 - rd), rd, 1.0))
			st.set_normal(nrm)
			st.set_uv(Vector2(x, z))
			st.add_vertex(Vector3(x, h, z))
	for j in n - 1:
		for i in n - 1:
			var a := j * n + i
			var b := a + 1
			var c := a + n
			var d := c + 1
			var cx := -half + (i + 0.5) * cell
			var cz := -half + (j + 0.5) * cell
			var skip := false
			for ho in holes:
				if absf(cx - ho[0]) < ho[2] * 0.5 and absf(cz - ho[1]) < ho[3] * 0.5:
					skip = true
			if skip:
				continue
			# порядок обхода — лицом вверх (по часовой при взгляде сверху)
			st.add_index(a); st.add_index(b); st.add_index(c)
			st.add_index(b); st.add_index(d); st.add_index(c)
	st.generate_tangents()
	var mesh := st.commit()
	mesh.surface_set_material(0, _material())
	var mi := MeshInstance3D.new()
	mi.name = "Ground"
	mi.mesh = mesh
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(BCKit.mark(mi))
	# коллизия
	var sb := StaticBody3D.new()
	sb.name = "GroundCol"
	sb.collision_layer = BCKit.LAYER_WORLD | BCKit.LAYER_DETAIL
	var cs := CollisionShape3D.new()
	var hm := HeightMapShape3D.new()
	hm.map_width = n
	hm.map_depth = n
	hm.map_data = heights
	cs.shape = hm
	cs.scale = Vector3(cell, 1, cell)
	sb.add_child(cs)
	add_child(BCKit.mark(sb))


func _material() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = preload("res://core/shaders/terrain.gdshader")
	var T := "res://assets/textures/"
	var sets := {"dirt": "dry_ground_01", "grass": "sparse_grass", "gravel": "rocky_gravel", "asphalt": "asphalt_02"}
	for k in sets:
		var c = T + sets[k] + "_c.jpg"
		var nn = T + sets[k] + "_n.jpg"
		if ResourceLoader.exists(c):
			m.set_shader_parameter(k + "_c", load(c))
		if ResourceLoader.exists(nn):
			m.set_shader_parameter(k + "_n", load(nn))
	return m
