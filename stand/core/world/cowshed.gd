class_name ULCowshed
extends Node3D
## «Опасный коровник» — временный нестабильный кластер 150×150 м. Постоянная часть (одна и та же при каждом
## посещении): три коровника, сарай-развалина, повреждённые загоны, перелески по краям, мусор, брошенная техника.
## Переменная часть (заново при каждом входе): останки коров и враги — сколько и где.
## Баланс — data/cowshed.json; карта проходимости — assets/world/nav_cowshed.res (строится --as-test=bake на
## этой локации). Коровники собраны из текстур проекта: внутрь цельной модели Tripo не зайти, а здесь враги
## стоят в проходах и стойлах, герой заходит внутрь, крыша над ним скрывается.

const CFG := "res://data/cowshed.json"
const NAV := "res://assets/world/nav_cowshed.res"
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"
## коровники: центр, поворот (рад), длина, ширина, насколько разрушен (0 — цел, 1 — без торца и половины крыши)
const BARNS := [
	[Vector3(-32, 0, -28), 0.0, 26.0, 10.0, 0.2],
	[Vector3(31, 0, -36), PI * 0.5, 24.0, 10.0, 0.35],
	[Vector3(-4, 0, 17), 0.08, 22.0, 9.0, 0.7],
]
## перелески: центр, радиус, сколько деревьев
const WOODS := [
	[Vector3(-60, 0, -60), 14.0, 16], [Vector3(55, 0, -62), 12.0, 12], [Vector3(63, 0, 8), 11.0, 10],
	[Vector3(-63, 0, 22), 12.0, 12], [Vector3(-38, 0, 60), 10.0, 9], [Vector3(46, 0, 52), 10.0, 9],
]
## загоны: ломаные линии забора (точки), в каждом отрезке может не хватать пролёта
const FENCES := [
	[Vector2(-52, -46), Vector2(-12, -46), Vector2(-12, -12), Vector2(-52, -12), Vector2(-52, -46)],
	[Vector2(14, -54), Vector2(46, -54), Vector2(46, -18)],
	[Vector2(-26, 8), Vector2(-26, 32), Vector2(16, 32)],
	[Vector2(22, 4), Vector2(48, 4), Vector2(48, 30)],
]
const ENTRY := Vector3(0, 0, 66)

static var _cfg := {}
var w: Node3D                      ## локация (world.gd)
var half := 75.0
var body: StaticBody3D
var barns: Array = []              ## {node, roof, front_walls, rect(локально: Vector2 half), xf}
var cows: Array[Vector3] = []
var fence_mid: Array[Vector3] = []
var wood_pts: Array[Vector3] = []
var _noise_tex: ImageTexture
var _cow_scenes := {}


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


func build(world: Node3D) -> void:
	w = world
	half = float(cfg().get("size", 150.0)) * 0.5
	body = StaticBody3D.new()
	body.name = "CowshedBody"
	add_child(body)
	_ground()
	var rng := RandomNumberGenerator.new()
	rng.seed = 4417                  # постоянная часть — одна и та же
	for b in BARNS:
		_barn(b[0], float(b[1]), float(b[2]), float(b[3]), float(b[4]), rng)
	_shed(Vector3(40, 0, 20), 0.6)
	_fences(rng)
	_forest(rng)
	_debris(rng)
	_machinery()


# ---------------- земля ----------------

const GROUND := """shader_type spatial;
// Земля коровника: выгоревшая трава, вытоптанная земля и грязь пятнами (по шуму), у коровников — истоптано.
uniform sampler2D grass : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D soil : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mud : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float n1 = texture(noise, p / 70.0).r;
	float n2 = texture(noise, p / 19.0 + 0.37).r;
	vec3 g = texture(grass, p / 4.0).rgb * vec3(1.05, 1.0, 0.82);
	vec3 s = texture(soil, p / 3.5).rgb;
	vec3 m = texture(mud, p / 5.0).rgb * 0.62;
	float ws = smoothstep(0.42, 0.62, n1 * 0.7 + n2 * 0.3);
	float wm = smoothstep(0.66, 0.78, n2 * 0.6 + n1 * 0.4);
	vec3 c = mix(g, s, ws);
	c = mix(c, m, wm * 0.85);
	ALBEDO = c * 0.92;
	ROUGHNESS = 0.95;
}"""


func _ground() -> void:
	var fn := FastNoiseLite.new()
	fn.seed = 77
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	var img := fn.get_seamless_image(256, 256)
	img.generate_mipmaps()
	_noise_tex = ImageTexture.create_from_image(img)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = GROUND
	sm.shader = sh
	sm.set_shader_parameter("grass", load(TEX + "forrest_ground_01_c.jpg"))
	sm.set_shader_parameter("soil", load(TEX + "dry_ground_01_c.jpg"))
	sm.set_shader_parameter("mud", load(TEX + "grass_path_2_c.jpg"))
	sm.set_shader_parameter("noise", _noise_tex)
	mi.material_override = sm
	add_child(mi)
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(420, 420)
	out.mesh = om
	var omat := _mat("dry_ground_01", 4.0)
	omat.albedo_color = Color(0.45, 0.42, 0.37)
	out.material_override = omat
	out.position.y = -0.05
	add_child(out)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	body.add_child(cs)
	# невидимая граница: за край можно выйти (там отсчёт до карты мира), дальше — нет
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, half * 2.0 + 2) if s.x != 0.0 else Vector3(half * 2.0 + 2, 4, 1)
		wc.shape = b
		wc.position = s * (half + 9.0) + Vector3.UP * 2.0
		body.add_child(wc)
	_tufts()


func _mat(tex: String, uv: float) -> StandardMaterial3D:
	return ULHouse._mat(TEX + tex, uv)


## трава пучками — как на базе (тот же шейдер), реже в загонах и у коровников
func _tufts() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 5:
		var a := TAU * i / 5.0 + 0.3
		var o := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-o.z, 0, o.x) * 0.15
		var top := o * 0.2 + Vector3.UP * 0.34
		var v := [-side, side, side * 1.25 + top, -side * 1.25 + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = w.TUFT_SHADER
	mat.shader = sh
	mat.set_shader_parameter("tex", load(TEX + "grass_tuft.png"))
	mesh.surface_set_material(0, mat)
	var rng := RandomNumberGenerator.new()
	rng.seed = 515
	var n := 10
	var cell := half * 2.0 / n
	for cx in n:
		for cz in n:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = mesh
			var xs: Array[Transform3D] = []
			var cs: Array[Color] = []
			for k in int(220.0 * float(ULSettings.q().grass)):
				var p := Vector3(-half + (cx + rng.randf()) * cell, 0, -half + (cz + rng.randf()) * cell)
				if in_barn(p, 1.0) >= 0:
					continue
				var sc := rng.randf_range(0.55, 1.2)
				xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.8, 1.4), sc)), p))
				var g := rng.randf_range(0.85, 1.15)
				cs.append(Color(g * 1.35, g * 1.15, g * 0.75) if rng.randf() < 0.5 else Color(g, g, g * 0.95))
			mm.instance_count = xs.size()
			for k in xs.size():
				mm.set_instance_transform(k, xs[k])
				mm.set_instance_color(k, cs[k])
			var mi := MultiMeshInstance3D.new()
			mi.multimesh = mm
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.visibility_range_end = float(ULSettings.q().range)
			mi.visibility_range_end_margin = 4.0
			mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			add_child(mi)


# ---------------- коровники ----------------

func _box(parent: Node3D, size: Vector3, at: Vector3, mat: Material, col: bool, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	mi.rotation = rot
	parent.add_child(mi)
	if col:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.transform = parent.transform * Transform3D(Basis.from_euler(rot), at) if parent != self else Transform3D(Basis.from_euler(rot), at)
		body.add_child(cs)
	return mi


## Коровник: длинный дощатый сарай, ворота в обоих торцах, проход посередине, стойла по бокам за низкими
## перегородками, двускатная крыша из ржавого железа (пролёты выпали). ruin — сколько разрушено: дыры в стенах,
## нет панелей крыши, при ruin > 0.5 — нет дальнего торца.
func _barn(at: Vector3, yaw: float, L: float, W: float, ruin: float, rng: RandomNumberGenerator) -> void:
	var node := Node3D.new()
	node.name = "Barn"
	add_child(node)
	node.position = at
	node.rotation.y = yaw
	var planks := _mat("weathered_plank_siding", 2.2)
	var dark := _mat("brown_planks_03", 1.6)
	dark.albedo_color = Color(0.62, 0.55, 0.47)
	var iron := _mat("worn_corrugated_iron", 2.5)
	var H := 3.0
	var T := 0.18
	var walls := Node3D.new()
	node.add_child(walls)
	var front: Array[Node3D] = []
	# длинные стены: по куску с дырой (пролом)
	for side in [-1.0, 1.0]:
		var z: float = side * W * 0.5
		var gap_c := rng.randf_range(-L * 0.3, L * 0.3)
		var gap_w := 1.8 + ruin * 2.5
		var pieces := [[-L * 0.5, gap_c - gap_w * 0.5], [gap_c + gap_w * 0.5, L * 0.5]]
		var holder := Node3D.new()
		walls.add_child(holder)
		for pc in pieces:
			var a: float = pc[0]
			var b: float = pc[1]
			if b - a < 0.3:
				continue
			_box(holder, Vector3(b - a, H, T), Vector3((a + b) * 0.5, H * 0.5, z), planks, false)
			_col(node, Vector3(b - a, H, T), Vector3((a + b) * 0.5, H * 0.5, z))
		# над проломом — обломок доски
		_box(holder, Vector3(gap_w + 0.4, 0.5, T), Vector3(gap_c, H - 0.25, z), planks, false)
		front.append(holder)
	# торцы: ворота посередине (3.6 м), над воротами — доски; у сильно разрушенного дальнего торца нет
	for end in [-1.0, 1.0]:
		if ruin > 0.5 and end > 0.0:
			for k in 3:
				_box(walls, Vector3(0.2, 0.2, rng.randf_range(1.5, 3.0)), Vector3(end * L * 0.5 + rng.randf_range(-1.0, 1.5), 0.1, rng.randf_range(-3, 3)), planks, false, Vector3(0, rng.randf() * PI, 0))
			continue
		var x: float = end * L * 0.5
		for sz in [-1.0, 1.0]:
			var len := W * 0.5 - 1.8
			_box(walls, Vector3(T, H, len), Vector3(x, H * 0.5, sz * (1.8 + len * 0.5)), planks, false)
			_col(node, Vector3(T, H, len), Vector3(x, H * 0.5, sz * (1.8 + len * 0.5)))
		_box(walls, Vector3(T, H - 2.7, 3.6), Vector3(x, 2.7 + (H - 2.7) * 0.5, 0), planks, false)
		# створка ворот, распахнутая наружу
		_box(walls, Vector3(0.08, 2.5, 1.7), Vector3(x + end * 0.85, 1.25, 1.8 + 0.1), dark, false, Vector3(0, end * 1.2, 0))
	# стойла: низкие перегородки от стен к проходу (проход посередине — 3 м)
	var aisle := 1.5
	var depth := W * 0.5 - aisle - T
	var k := -L * 0.5 + 3.0
	while k < L * 0.5 - 1.0:
		for side in [-1.0, 1.0]:
			if rng.randf() < ruin * 0.4:
				continue                                   # перегородка выломана
			var zc: float = side * (aisle + depth * 0.5)
			_box(walls, Vector3(0.1, 1.25, depth), Vector3(k, 0.625, zc), dark, false)
			_col(node, Vector3(0.1, 1.25, depth), Vector3(k, 0.625, zc))
		k += 3.0
	# кормушки вдоль стен
	for side in [-1.0, 1.0]:
		_box(walls, Vector3(L - 1.0, 0.45, 0.45), Vector3(0, 0.22, side * (W * 0.5 - 0.4)), dark, false)
	# крыша: по шесть листов на скат, часть выпала
	var roof := Node3D.new()
	node.add_child(roof)
	var ridge := 5.0
	var slope := atan2(ridge - H, W * 0.5 + 0.4)
	var span := Vector2(W * 0.5 + 0.4, ridge - H).length()
	var n := 6
	for side in [-1.0, 1.0]:
		for i in n:
			if rng.randf() < 0.15 + ruin * 0.45:
				continue
			var cx := -L * 0.5 - 0.3 + (L + 0.6) * (i + 0.5) / n
			var mid := Vector3(cx, (H + ridge) * 0.5, side * (W * 0.5 + 0.4) * 0.5)
			_box(roof, Vector3((L + 0.6) / n + 0.02, 0.05, span), mid, iron, false, Vector3(-side * slope, 0, 0))
	# сено: несколько тюков в проходе и у ворот
	var hay := StandardMaterial3D.new()
	hay.albedo_color = Color(0.72, 0.6, 0.32)
	hay.roughness = 1.0
	for i in 3:
		var hp := Vector3(rng.randf_range(-L * 0.4, L * 0.4), 0.4, rng.randf_range(-0.8, 0.8))
		_box(walls, Vector3(1.2, 0.8, 0.8), hp, hay, false, Vector3(0, rng.randf() * 0.6, 0))
	barns.append({"node": node, "roof": roof, "front": front, "half": Vector2(L * 0.5, W * 0.5), "xf": node.transform})


func _col(node: Node3D, size: Vector3, at: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.transform = node.transform * Transform3D(Basis.IDENTITY, at)
	body.add_child(cs)


## сарай-развалина: три стены без крыши
func _shed(at: Vector3, yaw: float) -> void:
	var node := Node3D.new()
	add_child(node)
	node.position = at
	node.rotation.y = yaw
	var planks := _mat("old_planks_02", 1.8)
	for wl in [[Vector3(6, 2.4, 0.16), Vector3(0, 1.2, -2.5)], [Vector3(0.16, 2.4, 5), Vector3(-3, 1.2, 0)], [Vector3(0.16, 1.4, 5), Vector3(3, 0.7, 0)]]:
		_box(node, wl[0], wl[1], planks, false)
		_col(node, wl[0], wl[1])


## в каком коровнике точка (по внутреннему прямоугольнику с запасом m); -1 — снаружи
func in_barn(p: Vector3, m := 0.0) -> int:
	for i in barns.size():
		var b: Dictionary = barns[i]
		var l: Vector3 = (b.xf as Transform3D).affine_inverse() * p
		var hh: Vector2 = b.half
		if absf(l.x) < hh.x + m and absf(l.z) < hh.y + m:
			return i
	return -1


## случайная точка внутри коровника (в проходе или стойле), в системе мира
func barn_point(i: int, rng: RandomNumberGenerator) -> Vector3:
	var b: Dictionary = barns[i]
	var hh: Vector2 = b.half
	var l := Vector3(rng.randf_range(-hh.x + 1.0, hh.x - 1.0), 0, rng.randf_range(-hh.y + 0.8, hh.y - 0.8))
	return (b.xf as Transform3D) * l


## кадр: герой внутри коровника — крыша над ним скрыта, ближняя к камере стена прозрачна (видно, что внутри)
func tick(hero: Vector3) -> void:
	var inside := in_barn(hero, 0.3)
	for i in barns.size():
		var b: Dictionary = barns[i]
		(b.roof as Node3D).visible = i != inside
		var fr: Array = b.front
		for f in fr:
			# стена, что ближе к камере (камера смотрит с +z), скрыта, пока герой внутри
			(f as Node3D).visible = i != inside or (f as Node3D).global_position.z < (b.xf as Transform3D).origin.z - 0.1 or absf((f as Node3D).global_transform.basis.x.z) > 0.7
	return


# ---------------- заборы, лес, мусор, техника ----------------

## загоны: столбы и две жерди; часть пролётов выломана, часть жердей висит наискось
func _fences(rng: RandomNumberGenerator) -> void:
	var wood := _mat("old_planks_02", 1.2)
	wood.albedo_color = Color(0.7, 0.62, 0.52)
	for line in FENCES:
		for i in range(line.size() - 1):
			var a: Vector2 = line[i]
			var b: Vector2 = line[i + 1]
			var L := a.distance_to(b)
			var dir := (b - a) / L
			var yaw := atan2(dir.x, dir.y) + PI * 0.5
			var nseg := int(ceil(L / 3.0))
			for s in nseg:
				var p0 := a + dir * (L * s / nseg)
				var p1 := a + dir * (L * (s + 1) / nseg)
				var mid := (p0 + p1) * 0.5
				var seg := p0.distance_to(p1)
				_box(self, Vector3(0.14, 1.3, 0.14), Vector3(p0.x, 0.65, p0.y), wood, false)
				var r := rng.randf()
				if r < 0.25:
					continue                                       # пролёта нет
				var m3 := Vector3(mid.x, 0, mid.y)
				fence_mid.append(m3)
				if r < 0.4:
					# жердь висит наискось, проходить можно
					_box(self, Vector3(seg, 0.08, 0.06), m3 + Vector3(0, 0.55, 0), wood, false, Vector3(0, yaw, 0.35))
					continue
				for hy in [0.5, 1.0]:
					_box(self, Vector3(seg, 0.08, 0.06), m3 + Vector3(0, hy, 0), wood, false, Vector3(0, yaw, 0))
				# столкновение — по высоте жердей (1 м): пройти нельзя, стрелять поверх — можно
				var cs := CollisionShape3D.new()
				var bs := BoxShape3D.new()
				bs.size = Vector3(seg, 1.05, 0.2)
				cs.shape = bs
				cs.transform = Transform3D(Basis(Vector3.UP, yaw), m3 + Vector3(0, 0.52, 0))
				body.add_child(cs)


## перелески: ели (те же, что на базе), сосны и берёзы
func _forest(rng: RandomNumberGenerator) -> void:
	var pine: PackedScene = load(MODELS + "ul_pine.glb") if ResourceLoader.exists(MODELS + "ul_pine.glb") else null
	var birch: PackedScene = load(MODELS + "ul_birch.glb") if ResourceLoader.exists(MODELS + "ul_birch.glb") else null
	var spruce_xf: Array[Transform3D] = []
	for wd in WOODS:
		var c: Vector3 = wd[0]
		var rr: float = wd[1]
		var n: int = wd[2]
		var tries := 0
		while n > 0 and tries < 400:
			tries += 1
			var p := c + Vector3(rng.randf_range(-rr, rr), 0, rng.randf_range(-rr, rr))
			if p.distance_to(c) > rr or absf(p.x) > half - 2.0 or absf(p.z) > half - 2.0:
				continue
			var near := false
			for q in wood_pts:
				if q.distance_to(p) < 3.0:
					near = true
					break
			if near:
				continue
			wood_pts.append(p)
			n -= 1
			var pick := rng.randf()
			if pick < 0.5:
				spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.85, 1.15)), p))
			else:
				var sc: PackedScene = pine if pick < 0.8 else birch
				if sc:
					var t: Node3D = sc.instantiate()
					var bb: AABB = w._aabb(t)
					var h := rng.randf_range(5.5, 7.5)
					t.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
					t.position = p
					t.rotation.y = rng.randf() * TAU
					add_child(t)
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.22
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = w._spruce_mesh(8.0, 141)
	mm.instance_count = spruce_xf.size()
	for i in spruce_xf.size():
		mm.set_instance_transform(i, spruce_xf[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


## мусор: бочки, покрышки, ящики, кучи досок, ржавые листы железа, камни
func _debris(rng: RandomNumberGenerator) -> void:
	var iron := _mat("worn_corrugated_iron", 2.0)
	var planks := _mat("old_planks_02", 1.0)
	for i in 34:
		var p := Vector3(rng.randf_range(-half + 6, half - 6), 0, rng.randf_range(-half + 6, half - 6))
		if in_barn(p, 1.5) >= 0 or p.distance_to(ENTRY) < 8.0:
			continue
		var kind := rng.randi() % 5
		match kind:
			0:
				_prop("ph_barrel", p, rng.randf() * TAU, 1.0, 0.4)
			1:
				_prop("ph_tyre", p, rng.randf() * TAU, 1.0, 0.0)
			2:
				_box(self, Vector3(rng.randf_range(1.5, 2.6), 0.05, rng.randf_range(0.8, 1.1)), p + Vector3(0, 0.05, 0), iron, false, Vector3(rng.randf_range(-0.1, 0.1), rng.randf() * PI, rng.randf_range(-0.12, 0.12)))
			3:
				for k in 4:
					_box(self, Vector3(rng.randf_range(1.8, 3.0), 0.08, 0.2), p + Vector3(rng.randf_range(-0.3, 0.3), 0.06 + k * 0.08, rng.randf_range(-0.4, 0.4)), planks, false, Vector3(0, rng.randf_range(-0.5, 0.5), 0))
			4:
				var rock := MeshInstance3D.new()
				rock.mesh = w._rock_mesh(900 + i)
				var rs := rng.randf_range(0.6, 1.3)
				rock.scale = Vector3(rs, rs * 0.7, rs)
				rock.position = p
				rock.material_override = _mat("rock_boulder_dry", 1.5)
				add_child(rock)
				var cs := CollisionShape3D.new()
				var sp := SphereShape3D.new()
				sp.radius = 0.5 * rs
				cs.shape = sp
				cs.position = p + Vector3.UP * 0.2
				body.add_child(cs)


func _prop(model: String, at: Vector3, yaw: float, sc: float, radius: float) -> void:
	var path := MODELS + model + ".glb"
	if not ResourceLoader.exists(path):
		return
	var n: Node3D = (load(path) as PackedScene).instantiate()
	n.position = at
	n.rotation.y = yaw
	n.scale = Vector3.ONE * sc
	add_child(n)
	if radius > 0.0:
		var cs := CollisionShape3D.new()
		var cy := CylinderShape3D.new()
		cy.radius = radius
		cy.height = 1.0
		cs.shape = cy
		cs.position = at + Vector3.UP * 0.5
		body.add_child(cs)


## брошенная техника: трактор (модель Tripo, если есть) и ржавый прицеп
func _machinery() -> void:
	var rust := StandardMaterial3D.new()
	rust.albedo_texture = load(TEX + "worn_corrugated_iron_c.jpg")
	rust.albedo_color = Color(0.75, 0.42, 0.25)
	rust.uv1_triplanar = true
	rust.uv1_world_triplanar = true
	rust.uv1_scale = Vector3.ONE * 0.6
	rust.metallic = 0.3
	rust.roughness = 0.8
	var tyre := StandardMaterial3D.new()
	tyre.albedo_color = Color(0.09, 0.09, 0.09)
	tyre.roughness = 0.95
	for spot in [[Vector3(18, 0, -12), 0.5, "tractor"], [Vector3(-20, 0, 2), -0.3, "trailer"], [Vector3(10, 0, 45), 1.9, "trailer"]]:
		var at: Vector3 = spot[0]
		var yaw: float = spot[1]
		if String(spot[2]) == "tractor" and ResourceLoader.exists(MODELS + "ul_tractor.glb"):
			var t: Node3D = (load(MODELS + "ul_tractor.glb") as PackedScene).instantiate()
			var bb: AABB = w._aabb(t)
			t.scale = Vector3.ONE * (4.2 / maxf(maxf(bb.size.x, bb.size.z), 0.01))
			t.position = at
			t.rotation.y = yaw
			add_child(t)
		else:
			# прицеп: кузов на четырёх колёсах, одно спущено
			var node := Node3D.new()
			add_child(node)
			node.position = at
			node.rotation.y = yaw
			_box(node, Vector3(4.0, 0.12, 2.0), Vector3(0, 0.75, 0), rust, false)
			for s in [-1.0, 1.0]:
				_box(node, Vector3(4.0, 0.5, 0.08), Vector3(0, 1.05, s * 0.96), rust, false)
				_box(node, Vector3(0.08, 0.5, 2.0), Vector3(s * 1.96, 1.05, 0), rust, false)
			for wx in [-1.2, 1.2]:
				for wz in [-1.05, 1.05]:
					var wh := MeshInstance3D.new()
					var cm := CylinderMesh.new()
					cm.top_radius = 0.42
					cm.bottom_radius = 0.42
					cm.height = 0.25
					wh.mesh = cm
					wh.material_override = tyre
					wh.rotation.x = PI * 0.5
					wh.position = Vector3(wx, 0.42 if wx > 0.0 or wz > 0.0 else 0.3, wz)
					node.add_child(wh)
			_box(node, Vector3(1.6, 0.08, 0.08), Vector3(-2.7, 0.55, 0), rust, false, Vector3(0, 0, 0.2))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(4.2, 1.6, 2.2)
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at + Vector3.UP * 0.8)
		body.add_child(cs)


# ---------------- переменная часть: останки коров и враги ----------------

## останки коров — заново при каждом посещении: скелеты и тела, в коровниках и в поле. Без столкновений
## (низкие, через них проходят), на карту проходимости не влияют.
func place_cows(rng: RandomNumberGenerator) -> void:
	var n := int(cfg().get("cows", 20))
	var tries := 0
	while cows.size() < n and tries < 600:
		tries += 1
		var p: Vector3
		if rng.randf() < 0.4:
			p = barn_point(rng.randi() % barns.size(), rng)
		else:
			p = Vector3(rng.randf_range(-half + 8, half - 8), 0, rng.randf_range(-half + 8, half - 8))
			if in_barn(p, 1.0) >= 0:
				continue
		if p.distance_to(ENTRY) < 12.0:
			continue
		var near := false
		for q in cows:
			if q.distance_to(p) < 3.5:
				near = true
				break
		for q in wood_pts:
			if q.distance_to(p) < 2.0:
				near = true
				break
		if near:
			continue
		cows.append(p)
		_cow(p, rng.randf() * TAU, rng.randf() < 0.5)


func _cow(at: Vector3, yaw: float, skeleton: bool) -> void:
	var model := "ul_cow_skel" if skeleton else "ul_cow_dead"
	var path := MODELS + model + ".glb"
	var node: Node3D
	if ResourceLoader.exists(path):
		if not _cow_scenes.has(model):
			_cow_scenes[model] = load(path)
		node = (_cow_scenes[model] as PackedScene).instantiate()
		var bb: AABB = w._aabb(node)
		node.scale = Vector3.ONE * (2.3 / maxf(maxf(bb.size.x, bb.size.z), 0.01))
	else:
		node = _cow_fallback(skeleton)
	node.position = at
	node.rotation.y = yaw
	add_child(node)


## запасной вид, пока нет моделей: скелет — позвоночник, рёбра и череп из костей; тело — туша на боку
func _cow_fallback(skeleton: bool) -> Node3D:
	var n := Node3D.new()
	if skeleton:
		var bone := StandardMaterial3D.new()
		bone.albedo_color = Color(0.86, 0.82, 0.72)
		bone.roughness = 0.8
		_box(n, Vector3(1.9, 0.1, 0.1), Vector3(0, 0.12, 0), bone, false)
		for i in 7:
			for s in [-1.0, 1.0]:
				_box(n, Vector3(0.05, 0.05, 0.55), Vector3(-0.5 + i * 0.16, 0.2, s * 0.25), bone, false, Vector3(s * 0.9, 0, 0))
		_box(n, Vector3(0.5, 0.2, 0.22), Vector3(1.15, 0.12, 0), bone, false)
		for lx in [-0.7, 0.6]:
			for s in [-1.0, 1.0]:
				_box(n, Vector3(0.07, 0.06, 0.8), Vector3(lx, 0.05, s * 0.55), bone, false, Vector3(0, s * 0.3, 0))
	else:
		var hide := StandardMaterial3D.new()
		hide.albedo_color = Color(0.32, 0.26, 0.22)
		hide.roughness = 0.95
		var mi := MeshInstance3D.new()
		var cm := CapsuleMesh.new()
		cm.radius = 0.42
		cm.height = 2.0
		mi.mesh = cm
		mi.material_override = hide
		mi.rotation.z = PI * 0.5
		mi.scale = Vector3(1, 1, 0.8)
		mi.position = Vector3(0, 0.36, 0)
		n.add_child(mi)
		_box(n, Vector3(0.45, 0.3, 0.3), Vector3(1.15, 0.25, 0.1), hide, false)
		for lx in [-0.6, 0.55]:
			for k in 2:
				_box(n, Vector3(0.1, 0.1, 0.9), Vector3(lx + k * 0.15, 0.25, 0.75), hide, false, Vector3(0.2, 0, 0))
	return n


## План врагов на это посещение: сколько (пустышей 10–30, лоторейщиков 3–8 — data/cowshed.json) и где —
## внутри коровников, у останков коров, в лесу и у загонов. Каждая точка проверяется по карте проходимости
## (snap — функция «ближайшая проходимая точка»; не в стене, не в бревне, не за краем), не ближе safe_r к точке
## входа и не вплотную к другому врагу. Возвращает [[вид, точка], …].
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var c := cfg()
	var np := rng.randi_range(int(c.pustysh[0]), int(c.pustysh[1]))
	var nl := rng.randi_range(int(c.lottery[0]), int(c.lottery[1]))
	var kinds: Array = []
	for i in np:
		kinds.append("infected")
	for i in nl:
		kinds.append("lottery")
	var out: Array = []
	var taken: Array[Vector3] = []
	var safe_r := float(c.get("safe_r", 28.0))
	for k in kinds:
		var placed := false
		for attempt in 40:
			var r := rng.randf()
			var p: Vector3
			if r < 0.35:
				p = barn_point(rng.randi() % barns.size(), rng)
			elif r < 0.7 and not cows.is_empty():
				var cp: Vector3 = cows[rng.randi() % cows.size()]
				var a := rng.randf() * TAU
				p = cp + Vector3(cos(a), 0, sin(a)) * rng.randf_range(1.5, 4.0)
			else:
				var anchor: Vector3 = wood_pts[rng.randi() % wood_pts.size()] if (rng.randf() < 0.55 or fence_mid.is_empty()) else fence_mid[rng.randi() % fence_mid.size()]
				var a2 := rng.randf() * TAU
				p = anchor + Vector3(cos(a2), 0, sin(a2)) * rng.randf_range(1.0, 3.5)
			if absf(p.x) > half - 2.0 or absf(p.z) > half - 2.0 or p.distance_to(ENTRY) < safe_r:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.45:
				continue                                   # точка в стене, в дереве или вне проходимой части
			var crowd := false
			for t in taken:
				if t.distance_to(q) < 1.3:
					crowd = true
					break
			if crowd:
				continue
			taken.append(q)
			out.append([k, Vector3(q.x, 0, q.z)])
			placed = true
			break
		if not placed:
			push_warning("коровник: для врага не нашлось места")
	return out
