class_name Level
extends Node3D
## Локация: модель из браузерной игры (assets/levels/<id>.gltf), стены — по данным (<id>.json), деревья —
## MultiMesh (образец + места), крыши домов прячутся, когда герой внутри, сетка проходимости — для
## заражённых (AStarGrid2D), муть по краю кластера, огонь в бочках. Травы, кустов и теней нет (просьба
## пользователя: не нужны) — трава из выгрузки пропускается.
##
## Графика для телефона (gl_compatibility):
## · статика из glTF при загрузке сливается: одинаковые материалы — в один, меши — по материалу и участку
##   CHUNK×CHUNK м (один MeshInstance3D на материал на участок, участок за кадром не рисуется); одноцветные
##   материалы без текстур — в три общих (матовый, металл, глянец) с цветом в вершинах; крыши и верх стен
##   каждого дома (прячутся, когда герой внутри) и крупные постройки сливаются внутри своей группы;
## · материалы по имени из браузерной игры подменяются шейдерами «как на фото» (godot/shaders): мох на крышах
##   и верхах стен, сырость у основания стен, мокрый асфальт и лужи, осенняя листва с оттенками по деревьям,
##   отсвет огня на земле;
## · качество apply_quality(0/1/2) — шейдер статики, огни, свечение (Level.quality запоминается для следующих
##   локаций). Теней от солнца нет ни на каком качестве.

const WALL_LAYER := 1
## Участок слияния статики, м (как в браузерной игре: те же границы участков).
const CHUNK := 33.0
## Деревья — пачками по виду и участку (33 м, как в выгрузке). Проверено оценкой: пачки по четвертям (66 м)
## не дают выигрыша — деревья в основном в лесополосе по краю, и мелкие участки за кадром отсекаются лучше.
const TREE_CHUNK := 33.0
const SHADERS := "res://shaders/"
## Вид материала по имени (из браузерной игры): [мокрость земли, мох, затемнение у земли, крупные пятна].
const LOOK := {
	"grass": [0.0, 0.0, 0.0, 1.0],
	"asphalt": [0.8, 0.0, 0.0, 0.7],
	"dirt": [0.4, 0.0, 0.0, 0.6],
	"sand": [0.3, 0.0, 0.0, 0.5],
	"ballast": [0.35, 0.0, 0.3, 0.5],
	"sleeper": [0.2, 0.3, 0.6, 0.3],
	"concrete": [0.1, 0.45, 1.0, 0.45],
	"concreteDark": [0.1, 0.45, 1.0, 0.4],
	"brick": [0.0, 0.45, 1.0, 0.3],
	"whiteBrick": [0.0, 0.45, 1.0, 0.3],
	"plaster": [0.0, 0.45, 1.0, 0.3],
	"wood": [0.0, 0.55, 1.0, 0.25],
	"woodGrey": [0.0, 0.55, 1.0, 0.25],
	"woodGreen": [0.0, 0.55, 1.0, 0.25],
	"woodBlue": [0.0, 0.55, 1.0, 0.25],
	"woodYellow": [0.0, 0.55, 1.0, 0.25],
	"slate": [0.0, 1.0, 0.3, 0.35],
	"roofTar": [0.0, 0.8, 0.6, 0.3],
	"roofMetal": [0.0, 0.15, 0.8, 0.3],
	"roofGreen": [0.0, 0.15, 0.8, 0.3],
	"metalRust": [0.0, 0.2, 1.0, 0.2],
	"metalOlive": [0.0, 0.2, 1.0, 0.2],
}
## То же по началу имени (текстуры с номером или вариантом: гаражные ворота, фасад хрущёвки).
const LOOK_PREFIX := {"garage": [0.0, 0.2, 1.0, 0.2], "panel": [0.0, 0.35, 1.0, 0.3]}
## Фото-текстуры CC0 (scripts/fetch-assets.mjs → assets/external/textures/<набор>/, авторы — в LICENSES.md там же):
## материал браузерной игры → [набор, размер плитки (м), контраст деталей, доля оттенков фото]. Цвет остаётся от нарисованной текстуры
## (её средний цвет), от фото — детали и рельеф (шейдер world с PHOTO). Нет набора (не скачался) — как раньше.
const PHOTO := {
	"asphalt": ["road_damaged", 5.0, 0.9, 0.3],
	"dirt": ["brown_mud_leaves_01", 3.5, 0.75, 0.3],
	"sand": ["brown_mud_leaves_01", 3.5, 0.6, 0.25],
	"grass": ["Grass007", 2.5, 0.8, 0.6],
	"concrete": ["concrete_wall_008", 3.0, 0.85, 0.4],
	"concreteDark": ["concrete_wall_008", 3.0, 0.85, 0.4],
	"roofTar": ["concrete_wall_008", 3.0, 0.7, 0.3],
	"ballast": ["concrete_wall_008", 2.0, 1.0, 0.3],
	"plaster": ["concrete_wall_001", 3.0, 0.8, 0.4],
	"brick": ["mixed_brick_wall", 2.0, 1.0, 0.8],
	"whiteBrick": ["mixed_brick_wall", 2.0, 0.8, 0.3],
	"wood": ["raw_plank_wall", 2.0, 0.9, 0.5],
	"woodGrey": ["raw_plank_wall", 2.0, 0.9, 0.5],
	"sleeper": ["raw_plank_wall", 2.0, 0.9, 0.5],
	"woodGreen": ["wood_peeling_paint_weathered", 2.0, 0.9, 0.5],
	"woodBlue": ["wood_peeling_paint_weathered", 2.0, 0.9, 0.5],
	"woodYellow": ["wood_peeling_paint_weathered", 2.0, 0.9, 0.5],
	"slate": ["asbestos_sheet", 2.0, 0.9, 0.5],
	"roofMetal": ["rusty_corrugated_iron", 2.0, 0.9, 0.9],
	"roofGreen": ["rusty_corrugated_iron", 2.0, 0.8, 0.6],
	"metalRust": ["rusty_corrugated_iron", 2.0, 1.0, 0.9],
	"metalOlive": ["rusty_corrugated_iron", 2.0, 0.8, 0.6],
}
const PHOTO_DIR := "res://assets/external/textures/"
## Листва (кроны деревьев): материал образца MultiMesh → оттенки.
const FOLIAGE := ["leaves", "leavesDry", "pine"]
## Осенние оттенки (sRGB, вес): у каждого дерева свой.
const AUTUMN := {
	"leaves": [[Color(0.74, 0.6, 0.24), 0.26], [Color(0.6, 0.58, 0.28), 0.22], [Color(0.42, 0.5, 0.25), 0.22], [Color(0.31, 0.4, 0.21), 0.18], [Color(0.66, 0.42, 0.2), 0.12]],
	"leavesDry": [[Color(0.5, 0.5, 0.26), 0.35], [Color(0.58, 0.5, 0.25), 0.3], [Color(0.5, 0.38, 0.22), 0.1], [Color(0.4, 0.46, 0.23), 0.25]],
	"pine": [[Color(0.3, 0.4, 0.24), 0.5], [Color(0.35, 0.44, 0.27), 0.3], [Color(0.26, 0.36, 0.2), 0.2]],
}
## Качество [низкое, среднее, высокое]: сколько огней с настоящим светом (каждый — лишний проход по мешам рядом).
const Q_LIGHTS := [0, 1, 2]

## Текущее качество (0/1/2) — общее для всех локаций; меняет apply_quality.
static var quality := 1
static var _noise: NoiseTexture2D
static var _shaders := {}
static var _plain := {}
static var _photo_sets := {}

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
## Крупные постройки (хрущёвка, склады, башни, труба): загораживают героя от камеры — становятся полупрозрачными.
## [{node, cx, cz, ry, hx, hz, top, ghost, parts: [[MeshInstance3D, свой материал], …]}]
var blocks := []
static var _ghost: StandardMaterial3D
var model: Node3D
## Сводка для автотеста и слежения за нагрузкой: узлы glTF, меши и материалы до и после слияния, время.
var stats := {}
var trees: Array[MultiMeshInstance3D] = []
var fire_lights: Array[OmniLight3D] = []
var world_mats: Array[ShaderMaterial] = []
var foliage_mats: Array[ShaderMaterial] = []
var _canon := {}
var _looks := {}
var _seen_at := Vector3.INF

func setup(level_id: String) -> void:
	var t0 := Time.get_ticks_usec()
	id = level_id
	name = "Level_" + id
	meta = JSON.parse_string(FileAccess.get_file_as_string("res://assets/levels/%s.json" % id))
	half = float(meta.get("half", 66.0))
	play = float(meta.get("play", 62.5))
	var scene: PackedScene = load("res://assets/levels/%s.gltf" % id)
	model = scene.instantiate()
	add_child(model)
	stats["gltf_nodes"] = _count_nodes(model)
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
	_merge_static()
	_blocks()
	if meta.get("edge", true):
		_edge_haze()
	for f in meta.get("fires", []):
		_fire(Vector3(f[0], f[1], f[2]))
	_fire_glow()
	stats["load_ms"] = (Time.get_ticks_usec() - t0) / 1000.0
	apply_quality(quality)

func _process(_delta: float) -> void:
	var t := Time.get_ticks_msec() / 1000.0
	for i in fire_lights.size():
		var l: OmniLight3D = fire_lights[i]
		if l.visible:
			l.light_energy = 1.5 * (0.82 + 0.18 * sin(t * 13.0 + i * 2.1) * sin(t * 7.3 + i))
	# кроны рядом с героем просвечивают (шейдер листвы)
	var g := get_parent()
	if g == null or foliage_mats.is_empty():
		return
	var pl = g.get("player")
	if is_instance_valid(pl) and pl is Node3D:
		var p: Vector3 = (pl as Node3D).global_position
		if p.distance_squared_to(_seen_at) > 0.0025:
			_seen_at = p
			for m in foliage_mats:
				m.set_shader_parameter("player_pos", p)

# ---------- Качество ----------

## Качество графики: 0 — низкое, 1 — среднее, 2 — высокое. Вызывает система настроек (и setup — для новой
## локации). Низкое: без точечных огней, упрощённый шейдер статики. Среднее: один огонь со светом. Высокое:
## два огня, свечение огня (glow) и цветокоррекция — лишние проходы, поэтому только на высоком. Теней нет.
func apply_quality(q: int) -> void:
	quality = clampi(q, 0, 2)
	for m in world_mats:
		m.shader = shader(_world_shader_name(m.has_meta("photo")))
	for i in fire_lights.size():
		fire_lights[i].visible = i < int(Q_LIGHTS[quality])
	var g := get_parent()
	if g:
		var sun := g.get_node_or_null("Sun") as DirectionalLight3D
		if sun:
			sun.shadow_enabled = false
		var env := g.get("env") as Environment
		if env:
			env.glow_enabled = quality >= 2
			env.adjustment_enabled = quality >= 2
	stats["quality"] = quality

# ---------- Деревья ----------

## Образцы MM<k> → MultiMesh с местами из meta. Деревья — по виду и участку (за кадром не рисуются),
## у крон — шейдер листвы и осенний оттенок у каждого дерева. Кустики травы из выгрузки пропускаются.
func _multimesh() -> void:
	var groups := {}   # «меш|участок» → {mesh, kind, src, list}
	for entry in meta.get("multimesh", []):
		var node := model.find_child(str(entry["node"]), true, false)
		if node == null or not node is MeshInstance3D:
			continue
		var proto: MeshInstance3D = node
		var raw: PackedByteArray = Marshalls.base64_to_raw(entry["xf"])
		var a: PackedFloat32Array = raw.to_float32_array()
		var count: int = a.size() / 12
		var src: Material = proto.get_active_material(0)
		var kind: String = str(entry.get("mat", src.resource_name if src else ""))
		if kind == "grassTuft":
			stats["grass_skipped"] = count
			proto.queue_free()
			continue
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(id + str(entry["node"]))
		var list: Array = []
		for i in count:
			var o := i * 12
			var basis := Basis(Vector3(a[o], a[o + 1], a[o + 2]), Vector3(a[o + 3], a[o + 4], a[o + 5]), Vector3(a[o + 6], a[o + 7], a[o + 8]))
			list.append([Transform3D(basis, Vector3(a[o + 9], a[o + 10], a[o + 11])), _tint(kind, rng)])
		proto.queue_free()
		for it in list:
			var t3: Transform3D = it[0]
			var key := "%d|%d,%d" % [proto.mesh.get_instance_id(), floori(t3.origin.x / TREE_CHUNK), floori(t3.origin.z / TREE_CHUNK)]
			if not groups.has(key):
				groups[key] = {"mesh": proto.mesh, "kind": kind, "src": src, "list": []}
			groups[key]["list"].append(it)
	var foliage_of := {}   # одна листва на вид кроны
	for key in groups:
		var gr: Dictionary = groups[key]
		var kind2: String = gr["kind"]
		var leafy: bool = kind2 in FOLIAGE
		# крона — карточки с текстурой листвы вместо гладкой многогранной (scripts/crowns.gd)
		var mesh: Mesh = Crowns.mesh_for(gr["mesh"], kind2) if leafy else gr["mesh"]
		var mmi := _instances(gr["list"], mesh, leafy)
		if leafy:
			if not foliage_of.has(kind2):
				foliage_of[kind2] = _foliage_material(kind2, mesh)
			mmi.material_override = foliage_of[kind2]
			mmi.extra_cull_margin = 0.5
		else:
			mmi.material_override = _canonical(gr["src"])
		mmi.visibility_range_end = 110.0
		add_child(mmi)
		trees.append(mmi)

## MultiMesh из списка [[Transform3D, Color], …].
func _instances(list: Array, mesh: Mesh, colors: bool) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = colors
	mm.mesh = mesh
	mm.instance_count = list.size()
	for i in list.size():
		mm.set_instance_transform(i, list[i][0])
		if colors:
			mm.set_instance_color(i, list[i][1])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return mmi

## Оттенок экземпляра (линейный цвет): из палитры AUTUMN с разбросом яркости; для прочего — белый.
static func _tint(kind: String, rng: RandomNumberGenerator) -> Color:
	if not AUTUMN.has(kind):
		return Color.WHITE
	var pal: Array = AUTUMN[kind]
	var c: Color = pal[0][0]
	var r := rng.randf()
	for e in pal:
		r -= float(e[1])
		if r <= 0.0:
			c = e[0]
			break
	var k := rng.randf_range(0.86, 1.08)
	c = Color(minf(c.r * k, 1.0), minf(c.g * k, 1.0), minf(c.b * k, 1.0))
	return c.srgb_to_linear()

func _foliage_material(kind: String, mesh: Mesh) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.shader = shader("foliage")
	m.set_shader_parameter("noise_tex", noise_texture())
	var box := mesh.get_aabb()
	m.set_shader_parameter("crown_y0", box.position.y)
	m.set_shader_parameter("crown_y1", box.end.y)
	m.set_shader_parameter("sway", 0.12 if kind == "pine" else 0.22)
	m.set_shader_parameter("sway_h", 4.0 if kind == "leavesDry" else 8.0)
	m.set_shader_parameter("see_through", 1.0)
	m.set_shader_parameter("leaf_tex", Crowns.texture(kind))
	m.set_shader_parameter("bumps", 0.0)
	foliage_mats.append(m)
	return m

# ---------- Слияние статики ----------

## Меши glTF → по материалу и участку: одинаковые материалы — один (по текстуре, цвету и свойствам),
## одноцветные — общий материал с цветом в вершинах, по имени — шейдеры «как на фото». Группы крыш домов
## (прячутся, когда герой внутри) и крупные постройки из meta.blocks сливаются внутри себя.
func _merge_static() -> void:
	var t0 := Time.get_ticks_usec()
	var keep := {}
	for b in meta.get("buildings", []):
		if b.get("upper"):
			keep[str(b["upper"])] = true
	for n in meta.get("blocks", []):
		keep[str(n["name"]) if typeof(n) == TYPE_DICTIONARY else str(n)] = true
	var meshes: Array[MeshInstance3D] = []
	_collect_meshes(model, meshes)
	var static_root := Node3D.new()
	static_root.name = "Static"
	model.add_child(static_root)
	var buckets := {}
	var mats_in := {}
	var merged: Array[MeshInstance3D] = []
	var surfaces_in := 0
	for mi in meshes:
		var mesh := mi.mesh as ArrayMesh
		if mesh == null:
			continue
		var unit := _unit_of(mi, keep)
		var xf := _rel_xform(mi, unit)
		var all_tri := true
		for s in mesh.get_surface_count():
			if mesh.surface_get_primitive_type(s) != Mesh.PRIMITIVE_TRIANGLES:
				all_tri = false
		if not all_tri:
			continue   # линии (провода, бельевые верёвки) — как есть
		var box: AABB = xf * mesh.get_aabb()
		var chunk := ""
		if unit == model and box.size.x < CHUNK * 0.75 and box.size.z < CHUNK * 0.75:
			var c := box.get_center()
			chunk = "%d,%d" % [floori(c.x / CHUNK), floori(c.z / CHUNK)]
		for s in mesh.get_surface_count():
			surfaces_in += 1
			var src := mi.get_active_material(s)
			if src:
				mats_in[src.get_instance_id()] = true
			var look := _look(src)
			var key := "%d|%s|%s" % [unit.get_instance_id(), look["key"], chunk]
			if not buckets.has(key):
				buckets[key] = {"parent": static_root if unit == model else unit, "look": look, "items": []}
			buckets[key]["items"].append([mesh, s, xf, look.get("color", Color.WHITE), src])
		merged.append(mi)
	var mats_out := {}
	var out := 0
	var tried := 0
	var done := 0
	for key in buckets:
		var bk: Dictionary = buckets[key]
		var look: Dictionary = bk["look"]
		var items: Array = bk["items"]
		var parent: Node3D = bk["parent"]
		var plain: bool = look.get("plain", false)
		var am: ArrayMesh = null
		var first: Mesh = items[0][0]
		if items.size() > 1 or first.get_surface_count() > 1:
			tried += 1
			am = _merge_items(items, plain)
		if am != null:
			done += 1
			_put(parent, am, Transform3D.IDENTITY, look["mat"], mats_out)
			out += 1
			continue
		# один меш на материал и участок (или слить не вышло): тот же меш без чтения из видеопамяти, материал — общий
		for it in items:
			var mat: Material = _canonical(it[4]) if plain else look["mat"]
			_put(parent, it[0], it[2], mat, mats_out)
			out += 1
	# исходные меши — прочь (узел с детьми остаётся пустым)
	for mi in merged:
		if mi.get_child_count() == 0:
			mi.queue_free()
		else:
			mi.mesh = null
	stats["gltf_meshes"] = meshes.size()
	stats["surfaces_in"] = surfaces_in
	stats["materials_in"] = mats_in.size()
	stats["meshes"] = out + meshes.size() - merged.size()
	stats["materials"] = mats_out.size()
	stats["merge_tried"] = tried
	stats["merge_done"] = done
	stats["merge_ms"] = (Time.get_ticks_usec() - t0) / 1000.0

## Слить поверхности [меш, № поверхности, положение, цвет, …] в один меш (одноцветные — с цветом в вершинах).
## surface_get_arrays в gl_compatibility читает буферы из видеопамяти, поэтому зовётся только там, где сливать
## есть что. null — если данных нет (рендер без хранения мешей, например headless): тогда меши остаются как есть.
func _merge_items(items: Array, plain: bool) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var colors := PackedColorArray()
	for it in items:
		var m: ArrayMesh = it[0]
		st.append_from(m, it[1], it[2])
		if plain:
			var part := PackedColorArray()
			part.resize(m.surface_get_array_len(it[1]))
			part.fill(it[3])
			colors.append_array(part)
	var arrays: Array = st.commit_to_arrays()
	var vv = arrays[Mesh.ARRAY_VERTEX]
	var verts: PackedVector3Array = vv if vv is PackedVector3Array else PackedVector3Array()
	if verts.is_empty():
		return null
	if plain:
		if colors.size() != verts.size():
			return null
		arrays[Mesh.ARRAY_COLOR] = colors
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	return am

## Новый MeshInstance3D: меш, положение, материал. Тень (только на высоком) — от объёмного, не от земли и пятен.
func _put(parent: Node3D, mesh: Mesh, xf: Transform3D, mat: Material, mats_out: Dictionary) -> void:
	var inst := MeshInstance3D.new()
	inst.mesh = mesh
	inst.transform = xf
	inst.material_override = mat
	if mat:
		mats_out[mat.get_instance_id()] = true
	inst.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(inst)

func _collect_meshes(n: Node, out: Array[MeshInstance3D]) -> void:
	for c in n.get_children():
		if c is MeshInstance3D and not c.is_queued_for_deletion() and (c as MeshInstance3D).mesh != null:
			out.append(c)
		_collect_meshes(c, out)

static func _count_nodes(n: Node) -> int:
	var k := 1
	for c in n.get_children():
		k += _count_nodes(c)
	return k

## Группа, внутри которой сливается меш: своя (крыша дома, крупная постройка) или вся модель.
func _unit_of(n: Node, keep: Dictionary) -> Node3D:
	var p := n.get_parent()
	while p != null and p != model:
		if keep.has(str(p.name)) and p is Node3D:
			return p as Node3D
		p = p.get_parent()
	return model

## Положение узла относительно предка unit.
static func _rel_xform(n: Node3D, unit: Node) -> Transform3D:
	var xf := n.transform
	var p := n.get_parent()
	while p != null and p != unit:
		if p is Node3D:
			xf = (p as Node3D).transform * xf
		p = p.get_parent()
	return xf

## Во что превращается материал glTF при слиянии: {key, mat, plain, color}. Кэш по исходному материалу.
func _look(src: Material) -> Dictionary:
	var sid := src.get_instance_id() if src else 0
	if _looks.has(sid):
		return _looks[sid]
	var look := {}
	var b := src as BaseMaterial3D
	var nm := src.resource_name if src else ""
	var params = _look_params(nm)
	if b and params != null and b.albedo_texture != null and b.transparency == BaseMaterial3D.TRANSPARENCY_DISABLED:
		var key := "look|" + _signature(b)
		if not _canon.has(key):
			_canon[key] = _world_material(b, params)
		look = {"key": key, "mat": _canon[key]}
	elif b and nm == "puddle":
		if not _canon.has("puddle"):
			_canon["puddle"] = _puddle_material()
		look = {"key": "puddle", "mat": _canon["puddle"]}
	elif b and _is_plain(b):
		var kind := "gloss" if b.roughness < 0.25 else ("metal" if b.metallic >= 0.3 else "matte")
		look = {"key": "plain|" + kind, "mat": _plain_material(kind), "plain": true, "color": b.albedo_color}
	else:
		var key2 := _signature(src)
		if not _canon.has(key2):
			_canon[key2] = src
		look = {"key": key2, "mat": _canon[key2]}
	_looks[sid] = look
	return look

## Тот же материал, что уже встречался (по виду), — чтобы деревья и мелочь не плодили копий.
func _canonical(src: Material) -> Material:
	var key := _signature(src)
	if not _canon.has(key):
		_canon[key] = src
	return _canon[key]

static func _look_params(nm: String):
	if LOOK.has(nm):
		return LOOK[nm]
	for p in LOOK_PREFIX:
		if nm.begins_with(p):
			return LOOK_PREFIX[p]
	return null

## Подпись вида материала: одинаковая — значит, можно рисовать одним материалом.
static func _signature(m: Material) -> String:
	var b := m as BaseMaterial3D
	if b == null:
		return "m%d" % (m.get_instance_id() if m else 0)
	var at := b.albedo_texture
	var nt: Texture2D = b.normal_texture if b.normal_enabled else null
	var family := b.resource_name if _look_params(b.resource_name) != null or b.resource_name == "puddle" else ""
	return "%s|%d|%d|%s|%.3f|%.3f|%d|%d|%d|%d|%s|%s|%.2f" % [
		family, at.get_instance_id() if at else 0, nt.get_instance_id() if nt else 0, b.albedo_color.to_html(),
		b.roughness, b.metallic, b.transparency, b.cull_mode, b.shading_mode, int(b.emission_enabled),
		b.emission.to_html() if b.emission_enabled else "", str(b.uv1_scale), b.alpha_scissor_threshold]

## Одноцветный непрозрачный материал без текстур — его можно слить с другими (цвет — в вершины).
static func _is_plain(b: BaseMaterial3D) -> bool:
	if b.albedo_texture != null or b.normal_enabled or b.vertex_color_use_as_albedo:
		return false
	if b.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED or b.albedo_color.a < 0.999:
		return false
	if b.shading_mode != BaseMaterial3D.SHADING_MODE_PER_PIXEL or b.cull_mode != BaseMaterial3D.CULL_BACK:
		return false
	if b.emission_enabled and b.emission.get_luminance() > 0.001:
		return false
	return true

## Общие материалы для одноцветного: матовый, металл, глянец (стекло); цвет — из вершин.
static func _plain_material(kind: String) -> StandardMaterial3D:
	if _plain.has(kind):
		return _plain[kind]
	var m := StandardMaterial3D.new()
	m.resource_name = "plain_" + kind
	m.vertex_color_use_as_albedo = true
	m.vertex_color_is_srgb = true
	match kind:
		"gloss":
			m.roughness = 0.1
			m.metallic = 0.5
		"metal":
			m.roughness = 0.45
			m.metallic = 0.65
		_:
			m.roughness = 0.75
			m.metallic = 0.0
	_plain[kind] = m
	return m

static func _world_shader_name(photo: bool) -> String:
	return ("world_photo" if photo else "world") + ("_lite" if quality == 0 else "")

## Фото-текстура набора: [цвет, нормали или null]; пусто — набор не скачан. Имена файлов — как у Poly Haven
## (<id>_diff_1k.jpg, <id>_nor_gl_1k.jpg) и ambientCG (<id>_1K-JPG_Color.jpg, …_NormalGL.jpg); в собранной игре
## в папке лежат *.import — по ним и ищем.
static func photo_set(set_id: String) -> Array:
	if _photo_sets.has(set_id):
		return _photo_sets[set_id]
	var out: Array = []
	var dir := PHOTO_DIR + set_id + "/"
	if DirAccess.dir_exists_absolute(dir):
		var alb := ""
		var nor := ""
		for f in DirAccess.get_files_at(dir):
			var n := f.trim_suffix(".import").trim_suffix(".remap")
			var low := n.to_lower()
			if not (low.ends_with(".jpg") or low.ends_with(".png")):
				continue
			if alb == "" and (low.contains("_diff") or low.contains("_color")):
				alb = dir + n
			elif nor == "" and (low.contains("nor_gl") or low.contains("normalgl")):
				nor = dir + n
		if alb != "" and ResourceLoader.exists(alb):
			var at := load(alb) as Texture2D
			var nt: Texture2D = load(nor) as Texture2D if nor != "" and ResourceLoader.exists(nor) else null
			if at:
				out = [at, nt]
	_photo_sets[set_id] = out
	return out

func _world_material(b: BaseMaterial3D, params: Array) -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.resource_name = b.resource_name
	var ph: Array = PHOTO.get(b.resource_name, [])
	var tex: Array = photo_set(str(ph[0])) if not ph.is_empty() else []
	if not tex.is_empty():
		m.set_meta("photo", str(ph[0]))
		m.set_shader_parameter("photo_albedo", tex[0])
		m.set_shader_parameter("photo_normal", tex[1])
		m.set_shader_parameter("photo_normal_on", 1.0 if tex[1] != null else 0.0)
		m.set_shader_parameter("photo_tile", float(ph[1]))
		m.set_shader_parameter("photo_contrast", float(ph[2]))
		m.set_shader_parameter("photo_chroma", float(ph[3]))
		stats["photo_mats"] = int(stats.get("photo_mats", 0)) + 1
	m.shader = shader(_world_shader_name(not tex.is_empty()))
	m.set_shader_parameter("albedo_tex", b.albedo_texture)
	m.set_shader_parameter("normal_tex", b.normal_texture)
	m.set_shader_parameter("use_normal", 1.0 if b.normal_enabled and b.normal_texture != null else 0.0)
	m.set_shader_parameter("noise_tex", noise_texture())
	m.set_shader_parameter("albedo_color", b.albedo_color)
	m.set_shader_parameter("uv_scale", Vector2(b.uv1_scale.x, b.uv1_scale.y))
	m.set_shader_parameter("uv_offset", Vector2(b.uv1_offset.x, b.uv1_offset.y))
	m.set_shader_parameter("roughness", b.roughness)
	m.set_shader_parameter("metallic", b.metallic)
	m.set_shader_parameter("normal_scale", b.normal_scale)
	m.set_shader_parameter("wet", float(params[0]))
	m.set_shader_parameter("moss", float(params[1]))
	m.set_shader_parameter("base_ao", float(params[2]))
	m.set_shader_parameter("variation", float(params[3]))
	world_mats.append(m)
	return m

func _puddle_material() -> ShaderMaterial:
	var m := ShaderMaterial.new()
	m.resource_name = "puddle"
	m.shader = shader("puddle")
	m.set_shader_parameter("noise_tex", noise_texture())
	return m

## Шейдер из godot/shaders (кэш); «…_lite» — тот же с #define LITE (упрощённый для низкого качества).
static func shader(nm: String) -> Shader:
	if _shaders.has(nm):
		return _shaders[nm]
	# варианты: <имя>_photo (#define PHOTO), …_lite (#define LITE) — из того же файла
	var sh: Shader
	var base := nm
	var defs := ""
	if base.ends_with("_lite"):
		base = base.trim_suffix("_lite")
		defs += "#define LITE\n"
	if base.ends_with("_photo"):
		base = base.trim_suffix("_photo")
		defs += "#define PHOTO\n"
	if defs != "":
		sh = Shader.new()
		sh.code = shader(base).code.replace("shader_type spatial;", "shader_type spatial;\n" + defs)
	else:
		sh = load(SHADERS + nm + ".gdshader") as Shader
	_shaders[nm] = sh
	return sh

## Общая текстура шума (бесшовная, 256×256) для мха, луж, пятен и листвы.
static func noise_texture() -> NoiseTexture2D:
	if _noise == null:
		var n := FastNoiseLite.new()
		n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
		n.seed = 17
		n.frequency = 0.012
		n.fractal_type = FastNoiseLite.FRACTAL_FBM
		n.fractal_octaves = 4
		_noise = NoiseTexture2D.new()
		_noise.width = 256
		_noise.height = 256
		_noise.seamless = true
		_noise.generate_mipmaps = true
		_noise.noise = n
	return _noise

# ---------- Стены и проходимость ----------

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
func update_view(player_pos: Vector3, eye := Vector3.INF) -> void:
	var inside := building_at(player_pos, -0.05)
	for b in buildings:
		var up = b.get("upper")
		if up is Node3D:
			up.visible = b != inside
	# постройка между героем и камерой — полупрозрачная (как в браузерной игре)
	if eye == Vector3.INF:
		eye = player_pos + Vector3(0, 15.5, 9.5)
	var head := player_pos + Vector3(0, 1.4, 0)
	for bl in blocks:
		var hit := _segment_hits_box(head, eye, bl)
		if hit != bool(bl["ghost"]):
			bl["ghost"] = hit
			for part in bl["parts"]:
				var mi: MeshInstance3D = part[0]
				if is_instance_valid(mi):
					mi.material_override = ghost_material() if hit else part[1]

func _blocks() -> void:
	blocks.clear()
	for b in meta.get("blocks", []):
		if typeof(b) != TYPE_DICTIONARY:
			continue
		var n := model.find_child(str(b["name"]), true, false)
		if n == null:
			continue
		var e: Dictionary = b.duplicate()
		e["node"] = n
		e["ghost"] = false
		var parts: Array = []
		for c in n.find_children("*", "MeshInstance3D", true, false):
			var mi: MeshInstance3D = c
			if mi.mesh != null:
				parts.append([mi, mi.material_override])
		e["parts"] = parts
		blocks.append(e)
	stats["blocks"] = blocks.size()

## Отрезок p→q задевает коробку постройки (центр, поворот ry, полуразмеры hx×hz, высота 0…top).
static func _segment_hits_box(p: Vector3, q: Vector3, b: Dictionary) -> bool:
	var c := cos(float(b["ry"]))
	var sn := sin(float(b["ry"]))
	var cx := float(b["cx"])
	var cz := float(b["cz"])
	var a := Vector3((p.x - cx) * c - (p.z - cz) * sn, p.y, (p.x - cx) * sn + (p.z - cz) * c)
	var e := Vector3((q.x - cx) * c - (q.z - cz) * sn, q.y, (q.x - cx) * sn + (q.z - cz) * c)
	var lo := Vector3(-float(b["hx"]), 0.0, -float(b["hz"]))
	var hi := Vector3(float(b["hx"]), float(b["top"]), float(b["hz"]))
	var t0 := 0.0
	var t1 := 1.0
	for k in 3:
		var d: float = e[k] - a[k]
		if absf(d) < 1e-9:
			if a[k] < lo[k] or a[k] > hi[k]:
				return false
			continue
		var ta: float = (lo[k] - a[k]) / d
		var tb: float = (hi[k] - a[k]) / d
		if ta > tb:
			var tmp: float = ta
			ta = tb
			tb = tmp
		t0 = maxf(t0, ta)
		t1 = minf(t1, tb)
		if t0 > t1:
			return false
	return true

## Подсветка контура персонажа (rim): тёплый ободок по краю силуэта — герой и заражённые читаются на земле и
## в тени крон (как в браузерной версии). Материалы модели общие у всех её копий — меняются один раз.
static func rim(root: Node) -> void:
	for c in root.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = c
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var m := mi.get_active_material(s) as BaseMaterial3D
			if m == null or m.has_meta("rim"):
				continue
			m.set_meta("rim", true)
			m.rim_enabled = true
			m.rim = 0.35
			m.rim_tint = 0.45

## Полупрозрачный «призрак» постройки: светлый, без текстур — видно героя и контуры здания.
static func ghost_material() -> StandardMaterial3D:
	if _ghost == null:
		_ghost = StandardMaterial3D.new()
		_ghost.resource_name = "ghost"
		_ghost.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_ghost.albedo_color = Color(0.86, 0.83, 0.76, 0.22)
		_ghost.roughness = 1.0
		_ghost.cull_mode = BaseMaterial3D.CULL_BACK
	return _ghost

## Выход, в зоне которого точка; у края кластера — ближайший выход (to может быть null — карта Улья).
func exit_at(p: Vector3) -> Dictionary:
	for e in exits:
		if p.x > e["x0"] and p.x < e["x1"] and p.z > e["z0"] and p.z < e["z1"]:
			return e
	if meta.get("edge", true) and (absf(p.x) > play - 0.8 or absf(p.z) > play - 0.8):
		return {"to": null, "edge": true}
	return {}

# ---------- Муть по краю и огонь ----------

## Светлая жёлто-серая муть по краю: земля уходит в дымку. Полотно — рамкой по краю (без середины):
## прозрачная плоскость на всю локацию закрашивала бы каждый пиксель экрана лишний раз.
func _edge_haze() -> void:
	var inner := half - 13.0
	var outer := half + 30.0
	var v := PackedVector3Array([
		Vector3(-outer, 0, -outer), Vector3(outer, 0, -outer), Vector3(outer, 0, outer), Vector3(-outer, 0, outer),
		Vector3(-inner, 0, -inner), Vector3(inner, 0, -inner), Vector3(inner, 0, inner), Vector3(-inner, 0, inner)])
	var idx := PackedInt32Array([0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v
	arrays[Mesh.ARRAY_INDEX] = idx
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
uniform vec3 haze : source_color = vec3(0.6, 0.58, 0.5);
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
	# стены мути по краю: клубящаяся муть (шум плывёт), внизу прозрачнее, кверху гуще; два слоя — ближний
	# реже, дальний гуще: край читается как туман с глубиной, а не плоская стена. Один материал на все полотна.
	var wm := ShaderMaterial.new()
	var wsh := Shader.new()
	wsh.code = """
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
uniform vec3 haze : source_color = vec3(0.74, 0.71, 0.6);
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float strength = 1.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	float h = clamp(wp.y / 18.0, 0.0, 1.0);
	vec2 q = vec2(wp.x + wp.z, wp.y * 1.6) * 0.03;
	float n = texture(noise_tex, q + vec2(TIME * 0.008, 0.0)).r;
	float n2 = texture(noise_tex, q * 2.4 - vec2(TIME * 0.015, TIME * 0.004)).r;
	float a = (0.18 + 0.5 * smoothstep(0.0, 0.7, h)) * (0.45 + 0.8 * (n * 0.6 + n2 * 0.4));
	ALBEDO = haze * (0.94 + 0.12 * n2);
	ALPHA = clamp(a * strength, 0.0, 0.85);
}
"""
	wm.shader = wsh
	wm.set_shader_parameter("noise_tex", noise_texture())
	var wm_near := wm.duplicate() as ShaderMaterial
	wm_near.set_shader_parameter("strength", 0.55)
	for layer in 2:
		var q := QuadMesh.new()
		var d := half - 1.5 + layer * 5.0
		q.size = Vector2(d * 2.0 + 30.0, 18.0)
		for side in 4:
			var wall := MeshInstance3D.new()
			wall.mesh = q
			wall.material_override = wm_near if layer == 0 else wm
			wall.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
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

## Огонь в бочке или на остове: частицы пламени (яркие — на высоком качестве светятся через glow) и тёплый
## свет — у первых двух огней (сколько из них горит светом — по качеству, Q_LIGHTS).
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
	m.albedo_color = Color(1.6, 0.85, 0.3, 0.8)
	m.vertex_color_use_as_albedo = true
	quad.material = m
	fx.mesh = quad
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 0.85, 0.4, 1))
	grad.set_color(1, Color(0.8, 0.2, 0.05, 0))
	fx.color_ramp = grad
	fx.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(fx)
	fires.append(fx)
	if fires.size() <= 2:
		var light := OmniLight3D.new()
		light.light_color = Color(1.0, 0.6, 0.3)
		light.light_energy = 1.5
		light.omni_range = 7.0
		light.position = p + Vector3(0, 0.6, 0)
		add_child(light)
		fire_lights.append(light)

## Отсветы всех огней на земле — один меш (один вызов отрисовки).
func _fire_glow() -> void:
	if fires.is_empty():
		return
	var v := PackedVector3Array()
	var uv := PackedVector2Array()
	var col := PackedColorArray()
	var idx := PackedInt32Array()
	var r := 3.2
	for i in fires.size():
		var p: Vector3 = (fires[i] as Node3D).position
		var base := v.size()
		var phase := Color(fmod(i * 0.37, 1.0), 0, 0, 1)
		for k in 4:
			var sx := -1.0 if k == 0 or k == 3 else 1.0
			var sz := -1.0 if k < 2 else 1.0
			v.append(Vector3(p.x + sx * r, 0.05, p.z + sz * r))
			uv.append(Vector2((sx + 1.0) * 0.5, (sz + 1.0) * 0.5))
			col.append(phase)
		idx.append_array(PackedInt32Array([base, base + 1, base + 2, base, base + 2, base + 3]))
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = v
	arrays[Mesh.ARRAY_TEX_UV] = uv
	arrays[Mesh.ARRAY_COLOR] = col
	arrays[Mesh.ARRAY_INDEX] = idx
	var am := ArrayMesh.new()
	am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
	var m := ShaderMaterial.new()
	m.shader = shader("fire_glow")
	var mi := MeshInstance3D.new()
	mi.name = "FireGlow"
	mi.mesh = am
	mi.material_override = m
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)

# ---------- Статистика ----------

## Что рисует локация: MeshInstance3D, поверхности, MultiMesh, экземпляры, разные материалы, огни.
func render_stats() -> Dictionary:
	var meshes := 0
	var surfaces := 0
	var mms := 0
	var inst := 0
	var mats := {}
	var stack: Array[Node] = [self]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		if n.is_queued_for_deletion():
			continue
		if n is MeshInstance3D:
			var mi: MeshInstance3D = n
			if mi.mesh == null:
				continue
			meshes += 1
			for s in mi.mesh.get_surface_count():
				surfaces += 1
				var m := mi.get_active_material(s)
				if m:
					mats[m.get_instance_id()] = true
		elif n is MultiMeshInstance3D:
			var mmi: MultiMeshInstance3D = n
			if mmi.multimesh == null:
				continue
			mms += 1
			var vis := mmi.multimesh.visible_instance_count
			inst += mmi.multimesh.instance_count if vis < 0 else vis
			if mmi.material_override:
				mats[mmi.material_override.get_instance_id()] = true
	var lights := 0
	for l in fire_lights:
		if l.visible:
			lights += 1
	return {"meshes": meshes, "surfaces": surfaces, "multimesh": mms, "instances": inst, "materials": mats.size(), "lights": lights}
