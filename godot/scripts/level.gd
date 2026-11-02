class_name Level
extends Node3D
## Локация: модель из браузерной игры (assets/levels/<id>.gltf), стены — по данным (<id>.json), деревья и
## трава — MultiMesh (образец + места), крыши домов прячутся, когда герой внутри, сетка проходимости — для
## заражённых (AStarGrid2D), муть по краю кластера, огонь в бочках.

const WALL_LAYER := 1

var id := ""
var meta := {}
var half := 66.0
var play := 62.5
var nav := AStarGrid2D.new()
var nav_n := 0
var nav_cell := 0.5
var buildings := []   # [{name, cx, cz, ry, w, d, upper: Node3D}]
var containers := []  # из meta + items/searched
var exits := []
var fires := []
var model: Node3D

func setup(level_id: String) -> void:
	id = level_id
	name = "Level_" + id
	meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/levels/%s.json" % id))
	half = float(meta.get("half", 66.0))
	play = float(meta.get("play", 62.5))
	var scene: PackedScene = load("res://assets/levels/%s.gltf" % id)
	model = scene.instantiate()
	add_child(model)
	_multimesh()
	_walls()
	_nav()
	for b in meta.get("buildings", []):
		var e: Dictionary = b.duplicate()
		e["upper"] = model.find_child(str(b.get("upper", "")), true, false) if b.get("upper") else null
		buildings.append(e)
	for c in meta.get("containers", []):
		var e2: Dictionary = c.duplicate()
		e2["items"] = []
		e2["searched"] = false
		containers.append(e2)
	exits = meta.get("exits", [])
	if meta.get("edge", true):
		_edge_haze()
	for f in meta.get("fires", []):
		_fire(Vector3(f[0], f[1], f[2]))

## Образцы MM<k> → MultiMeshInstance3D с местами из meta (деревья и трава — по одному вызову на образец).
func _multimesh() -> void:
	for entry in meta.get("multimesh", []):
		var node := model.find_child(str(entry["node"]), true, false)
		if node == null or not node is MeshInstance3D:
			continue
		var proto: MeshInstance3D = node
		var raw: PackedByteArray = Marshalls.base64_to_raw(entry["xf"])
		var a: PackedFloat32Array = raw.to_float32_array()
		var count: int = a.size() / 12
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = proto.mesh
		mm.instance_count = count
		for i in count:
			var o := i * 12
			var basis := Basis(Vector3(a[o], a[o + 1], a[o + 2]), Vector3(a[o + 3], a[o + 4], a[o + 5]), Vector3(a[o + 6], a[o + 7], a[o + 8]))
			mm.set_instance_transform(i, Transform3D(basis, Vector3(a[o + 9], a[o + 10], a[o + 11])))
		var mmi := MultiMeshInstance3D.new()
		mmi.multimesh = mm
		mmi.material_override = proto.get_active_material(0)
		mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mmi)
		proto.queue_free()

## Стены, мебель, машины — коробки на одном статическом теле.
func _walls() -> void:
	var body := StaticBody3D.new()
	body.name = "Walls"
	body.collision_layer = WALL_LAYER
	body.collision_mask = 0
	add_child(body)
	for c in meta.get("colliders", []):
		var shape := BoxShape3D.new()
		shape.size = Vector3(maxf(0.05, c[2] * 2.0), 3.0, maxf(0.05, c[3] * 2.0))
		var cs := CollisionShape3D.new()
		cs.shape = shape
		cs.position = Vector3(c[0], 1.5, c[1])
		cs.rotation.y = c[4]
		body.add_child(cs)

## Сетка проходимости (клетка 0,5 м) из браузерной игры — для поиска пути заражённых.
func _nav() -> void:
	var n: Dictionary = meta.get("nav", {})
	nav_n = int(n.get("n", 0))
	nav_cell = float(n.get("cell", 0.5))
	if nav_n <= 0:
		return
	nav.region = Rect2i(0, 0, nav_n, nav_n)
	nav.cell_size = Vector2(1, 1)
	nav.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	nav.default_compute_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	nav.default_estimate_heuristic = AStarGrid2D.HEURISTIC_OCTILE
	nav.update()
	var blocked: PackedByteArray = Marshalls.base64_to_raw(n.get("blocked", ""))
	for gz in nav_n:
		for gx in nav_n:
			if blocked[gz * nav_n + gx] != 0:
				nav.set_point_solid(Vector2i(gx, gz), true)

func cell_of(p: Vector3) -> Vector2i:
	return Vector2i(clampi(int(floor((p.x + half) / nav_cell)), 0, nav_n - 1), clampi(int(floor((p.z + half) / nav_cell)), 0, nav_n - 1))

func cell_center(c: Vector2i) -> Vector3:
	return Vector3(c.x * nav_cell - half + nav_cell * 0.5, 0, c.y * nav_cell - half + nav_cell * 0.5)

func blocked_at(p: Vector3) -> bool:
	if absf(p.x) > play or absf(p.z) > play:
		return true
	return nav.is_point_solid(cell_of(p))

## Ближайшая свободная клетка (если точка в стене).
func free_cell(c: Vector2i) -> Vector2i:
	if not nav.is_point_solid(c):
		return c
	for r in range(1, 6):
		for dz in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var q := Vector2i(clampi(c.x + dx, 0, nav_n - 1), clampi(c.y + dz, 0, nav_n - 1))
				if not nav.is_point_solid(q):
					return q
	return c

## Путь между точками по сетке (мировые точки, без первой).
func path(from: Vector3, to: Vector3) -> PackedVector3Array:
	var out := PackedVector3Array()
	if nav_n <= 0:
		return out
	var ids: Array[Vector2i] = nav.get_id_path(free_cell(cell_of(from)), free_cell(cell_of(to)))
	for i in range(1, ids.size()):
		out.append(cell_center(ids[i]))
	return out

## Здание, в котором стоит точка (по наружному контуру), или пустой словарь.
func building_at(p: Vector3, margin := 0.0) -> Dictionary:
	for b in buildings:
		var dx: float = p.x - b["cx"]
		var dz: float = p.z - b["cz"]
		var c := cos(float(b["ry"]))
		var s := sin(float(b["ry"]))
		var lx := dx * c - dz * s
		var lz := dx * s + dz * c
		if absf(lx) < float(b["w"]) / 2.0 + margin and absf(lz) < float(b["d"]) / 2.0 + margin:
			return b
	return {}

## Крыша и верх стен дома, где герой, прячутся.
func update_view(player_pos: Vector3) -> void:
	var inside := building_at(player_pos, -0.05)
	for b in buildings:
		var up = b.get("upper")
		if up is Node3D:
			up.visible = b != inside

## Выход, в зоне которого точка; у края кластера — ближайший выход (to может быть null — карта Улья).
func exit_at(p: Vector3) -> Dictionary:
	for e in exits:
		if p.x > e["x0"] and p.x < e["x1"] and p.z > e["z0"] and p.z < e["z1"]:
			return e
	if meta.get("edge", true) and (absf(p.x) > play - 0.8 or absf(p.z) > play - 0.8):
		return {"to": null, "edge": true}
	return {}

## Светлая жёлто-серая муть по краю: земля уходит в дымку.
func _edge_haze() -> void:
	var mesh := PlaneMesh.new()
	mesh.size = Vector2(half * 2.0 + 60.0, half * 2.0 + 60.0)
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
uniform vec3 haze : source_color = vec3(0.55, 0.54, 0.47);
uniform float edge = 65.0;
varying vec2 p;
void vertex() { p = VERTEX.xz; }
void fragment() {
	float d = max(abs(p.x), abs(p.y));
	float k = smoothstep(edge - 10.0, edge + 4.0, d);
	ALBEDO = haze;
	ALPHA = k * k * (3.0 - 2.0 * k) * 0.9;
}
"""
	mat.shader = sh
	mat.set_shader_parameter("edge", half - 1.0)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.position.y = 0.06
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	# стены мути — полупрозрачные полотна по краю
	for side in 4:
		var wall := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2(half * 2.0 + 30.0, 18.0)
		wall.mesh = q
		var wm := StandardMaterial3D.new()
		wm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		wm.albedo_color = Color(0.72, 0.7, 0.6, 0.5)
		wm.cull_mode = BaseMaterial3D.CULL_DISABLED
		wall.material_override = wm
		var d := half - 1.5
		wall.position = Vector3(0, 9.0, 0)
		match side:
			0: wall.position.z = -d
			1: wall.position.z = d
			2:
				wall.position.x = -d
				wall.rotation.y = PI / 2.0
			3:
				wall.position.x = d
				wall.rotation.y = PI / 2.0
		add_child(wall)

## Огонь в бочке или на остове: частицы пламени и тёплый отсвет.
func _fire(p: Vector3) -> void:
	var fx := CPUParticles3D.new()
	fx.amount = 18
	fx.lifetime = 0.7
	fx.position = p
	fx.direction = Vector3.UP
	fx.spread = 18.0
	fx.initial_velocity_min = 0.8
	fx.initial_velocity_max = 1.6
	fx.gravity = Vector3(0, 0.8, 0)
	fx.scale_amount_min = 0.25
	fx.scale_amount_max = 0.5
	var quad := QuadMesh.new()
	quad.size = Vector2(0.5, 0.6)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	m.albedo_color = Color(1.0, 0.55, 0.18, 0.75)
	m.vertex_color_use_as_albedo = true
	quad.material = m
	fx.mesh = quad
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 0.85, 0.4, 1))
	grad.set_color(1, Color(0.8, 0.2, 0.05, 0))
	fx.color_ramp = grad
	add_child(fx)
	fires.append(fx)
	if fires.size() <= 2:
		var light := OmniLight3D.new()
		light.light_color = Color(1.0, 0.6, 0.3)
		light.light_energy = 1.6
		light.omni_range = 7.0
		light.position = p + Vector3(0, 0.6, 0)
		add_child(light)
