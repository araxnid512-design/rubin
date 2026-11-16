extends Node3D
## Стартовая локация — стабильный кластер 100×100 м (для проверки героя в мире): земля с травой, проплешинами
## и вытоптанной площадкой у крыльца, деревья и кусты (модели Tripo), деревянный дом с пятью комнатами, ящики, которые можно
## ставить и убирать (сохраняются). Граница кластера — полоса гравия и невидимая стена.
## Управление: левая половина экрана — джойстик (сильнее отклонить — бег), правая — повернуть камеру, два
## пальца — приблизить. На компьютере — WASD, Shift — бег, мышь — то же, что палец.
## Проверка: --as-test=world --as-out=папка — обход локации и дома по точкам, снимки и журнал.

const SIZE := 100.0               ## кластер, м
const SAVE := "user://cluster.json"
const SAVE_V := 2                 ## версия сохранения: старые расстановки ящиков сбрасываются
const HOUSE_AT := Vector3(0, 0, -12)
## двор вокруг дома: от дома x0, z0, x1, z1 (м); калитка — спереди посередине
const YARD := [-11.0, -9.0, 11.0, 10.0]
const GATE := 2.4
const C_BG := Color(0.05, 0.07, 0.09, 0.85)
const C_LINE := Color(0.35, 0.75, 0.95, 0.7)
const C_TEXT := Color(0.88, 0.93, 0.97)
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"

## деревья: модель, высота, сколько, радиус ствола (для столкновений; 0 — без столкновений)
const FLORA := [
	["ul_birch", 5.5, 18, 0.14], ["ul_pine", 6.0, 14, 0.16], ["ul_apple", 3.6, 8, 0.15], ["ul_bush", 1.2, 20, 0.0],
]

var player: CharacterBody3D
var rig: BCCharacter
var snd: BCSound
var house: ULHouse
var cam: Camera3D
var cam_yaw := 0.0                ## камера смотрит вдоль −Z (на дом)
var cam_pitch := 1.0               ## камера сверху (≈57°); горизонт и небо в кадр не попадают
var cam_dist := 13.0
var _cam_t := Vector3.ZERO
var crates: Array[Node3D] = []
var _crate_scene: PackedScene = null
var _joy_id := -1
var _joy_o := Vector2.ZERO
var _joy_v := Vector2.ZERO
var _cam_id := -1
var _touch := {}
var _pinch := 0.0
var _run_btn := false
var _pack_i := 0
var info: Label
var joy_ui: Control
var test := ""
var out := "user://world"
var _auto: Array = []             ## проверка: точки, к которым герой идёт сам
var _auto_cb: Callable
var _steps := {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	_env()
	_ground()
	house = ULHouse.new()
	house.name = "House"
	add_child(house)
	house.position = HOUSE_AT
	house.build(MODELS + "ul_house.glb", TEX + "weathered_brown_planks", TEX + "brown_planks_03")
	_fit_shell()
	_yard()
	_flora()
	_player()
	_ui()
	if ResourceLoader.exists(MODELS + "ul_crate.glb"):
		_crate_scene = load(MODELS + "ul_crate.glb")
	_load()
	if test != "":
		_run_test.call_deferred()


# ---------------- мир ----------------

func _env() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	# небо не видно (камера сверху) — фон цвета земли; небо остаётся только как источник рассеянного света
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.4, 0.52, 0.66)
	sm.sky_horizon_color = Color(0.7, 0.72, 0.7)
	sm.ground_horizon_color = Color(0.45, 0.45, 0.4)
	sm.ground_bottom_color = Color(0.22, 0.22, 0.18)
	sky.sky_material = sm
	e.sky = sky
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.22, 0.22, 0.17)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.42
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = 1.12
	e.tonemap_white = 6.0
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.06
	e.adjustment_saturation = 1.04
	# лёгкая дымка вдали — сверху видно до ~30 м, край кластера тонет мягко
	e.fog_enabled = true
	e.fog_mode = Environment.FOG_MODE_DEPTH
	e.fog_light_color = Color(0.5, 0.52, 0.47)
	e.fog_density = 1.0
	e.fog_depth_begin = 32.0
	e.fog_depth_end = 110.0
	e.fog_depth_curve = 1.5
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-56, 38, 0)
	sun.light_energy = 1.18
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = true
	sun.shadow_blur = 1.4
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_PARALLEL_2_SPLITS
	sun.directional_shadow_max_distance = 40.0
	add_child(sun)


func _plane(size: Vector2, at: Vector3, tex: String, uv: float, tint := Color.WHITE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	var m := ULHouse._mat(TEX + tex, uv)
	m.albedo_color = tint
	mi.material_override = m
	mi.position = at
	add_child(mi)
	return mi


const GROUND_SHADER := """shader_type spatial;
// Земля кластера: живая трава, пятна сухой травы и проплешины утоптанной земли с камешками. Текстуры берутся
// в двух масштабах под углом и смешиваются по шуму — без повторяющегося рисунка. У крыльца и вокруг фундамента
// дома — вытоптанная земля.
uniform sampler2D grass : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dry : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform vec2 worn_c;
uniform float worn_r = 4.0;
uniform vec2 house_c;
uniform vec2 house_half;
uniform vec4 yard;               // двор: x0, z0, x1, z1
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	mat2 rot = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8));
	vec2 u1 = p / 4.2;
	vec2 u2 = rot * p / 12.7;
	float n1 = texture(noise, p / 70.0).r;
	float n2 = texture(noise, p / 19.0 + vec2(0.37, 0.11)).r;
	float n3 = texture(noise, p / 5.5 + vec2(0.71, 0.53)).r;
	vec3 g = mix(texture(grass, u1).rgb, texture(grass, u2).rgb, 0.45);
	vec3 d = mix(texture(dry, p / 3.9).rgb, texture(dry, rot * p / 12.3).rgb, 0.45);
	vec3 e = mix(texture(dirt, p / 2.6).rgb, texture(dirt, rot * p / 8.1).rgb, 0.35);
	float dry_w = smoothstep(0.42, 0.72, n1 * 0.65 + n3 * 0.35);
	float dirt_w = smoothstep(0.7, 0.86, n2 * 0.55 + n3 * 0.45) * 0.8;
	float porch = 1.0 - smoothstep(worn_r * 0.35, worn_r, distance(p, worn_c) + (n3 - 0.5) * 2.4);
	vec2 q = max(abs(p - house_c) - house_half, vec2(0.0));
	float ring = 1.0 - smoothstep(0.2, 1.4, length(q) + (n3 - 0.5) * 0.9);
	dirt_w = max(dirt_w, max(porch, ring * 0.75));
	// во дворе трава реже и суше — ходят каждый день
	vec2 yq = max(max(yard.xy - p, p - yard.zw), vec2(0.0));
	float in_yard = 1.0 - smoothstep(0.0, 1.2, length(yq));
	dirt_w = max(dirt_w, in_yard * smoothstep(0.35, 0.75, n3 * 0.6 + n2 * 0.4) * 0.6);
	dry_w = max(dry_w, in_yard * 0.45);
	vec3 col = mix(mix(g, d, dry_w * 0.55), e, dirt_w * 0.85);
	col *= mix(0.86, 1.06, n1) * mix(0.94, 1.04, n2) * 0.62;
	// затенение у стен дома (свет туда почти не попадает)
	float wall_ao = 1.0 - (1.0 - smoothstep(0.0, 0.9, length(q))) * 0.45 * step(0.001, length(q));
	col *= wall_ao;
	NORMAL_MAP_DEPTH = 1.3;
	ALBEDO = col;
	NORMAL_MAP = mix(mix(texture(grass_n, u1).rgb, texture(grass_n, u2).rgb, 0.45), texture(dirt_n, p / 2.6).rgb, dirt_w);
	ROUGHNESS = 0.96;
}
"""


const TUFT_SHADER := """shader_type spatial;
render_mode cull_disabled;
// пучок травы: три скрещённые полосы, верх колышется от ветра
uniform sampler2D tex : source_color, filter_linear_mipmap;
uniform float sway = 0.06;
varying float hh;
void vertex() {
	hh = UV.y;
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = sin(TIME * 1.7 + wpos.x * 0.35 + wpos.z * 0.27) + 0.4 * sin(TIME * 3.1 + wpos.z * 0.9);
	VERTEX.x += w * sway * (1.0 - UV.y);
}
void fragment() {
	vec4 c = texture(tex, UV);
	if (c.a < 0.45) { discard; }
	// обе стороны травинки освещены как земля (нормаль вверх), иначе обратная сторона — чёрная
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ALBEDO = c.rgb * COLOR.rgb * vec3(0.62, 0.64, 0.5) * mix(0.55, 1.0, 1.0 - hh);
	ROUGHNESS = 0.9;
	SPECULAR = 0.1;
}
"""


## пучки травы: кусками 12.5 × 12.5 м, каждый виден до 30 м (дальше хватает текстуры земли)
func _grass() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	# кустик: пять полос, наклонённых наружу от центра (сверху — розетка травинок, сбоку — пучок)
	for i in 5:
		var a := TAU * i / 5.0 + 0.3
		var out := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-out.z, 0, out.x) * 0.13
		var top := out * 0.17 + Vector3.UP * 0.2
		var v := [-side, side, side * 1.25 + top, -side * 1.25 + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = TUFT_SHADER
	mat.shader = sh
	mat.set_shader_parameter("tex", load(TEX + "grass_tuft.png"))
	mesh.surface_set_material(0, mat)
	var rng := RandomNumberGenerator.new()
	rng.seed = 909
	var n := 8
	var cell := SIZE / n
	for cx in n:
		for cz in n:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = mesh
			var xs: Array[Transform3D] = []
			var cs: Array[Color] = []
			for k in 230:
				var p := Vector3(-SIZE * 0.5 + (cx + rng.randf()) * cell, 0, -SIZE * 0.5 + (cz + rng.randf()) * cell)
				var hp := p - HOUSE_AT
				if absf(hp.x) < ULHouse.W * 0.5 + 1.2 and absf(hp.z) < ULHouse.D * 0.5 + 1.2:
					continue
				if p.distance_to(HOUSE_AT + Vector3(0, 0, ULHouse.D * 0.5 + 2.2)) < 3.5:
					continue                                       # вытоптано у крыльца
				if hp.x > YARD[0] and hp.x < YARD[2] and hp.z > YARD[1] and hp.z < YARD[3] and rng.randf() < 0.6:
					continue                                       # во дворе травы меньше
				var sc := rng.randf_range(0.5, 1.15)
				xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.8, 1.3), sc)), p))
				var g := rng.randf_range(0.85, 1.15)
				cs.append(Color(g, g, g * rng.randf_range(0.9, 1.05)))
			mm.instance_count = xs.size()
			for k in xs.size():
				mm.set_instance_transform(k, xs[k])
				mm.set_instance_color(k, cs[k])
			var mi := MultiMeshInstance3D.new()
			mi.multimesh = mm
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.visibility_range_end = 30.0
			mi.visibility_range_end_margin = 4.0
			mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			mi.position = Vector3.ZERO
			add_child(mi)


func _ground() -> void:
	# внутри кластера — своя земля, по краю — гравий, снаружи — другой грунт (кластер «вырезан» из своего мира)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(SIZE, SIZE)
	mi.mesh = pm
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = GROUND_SHADER
	sm.shader = sh
	sm.set_shader_parameter("grass", load(TEX + "forrest_ground_01_c.jpg"))
	sm.set_shader_parameter("grass_n", load(TEX + "forrest_ground_01_n.jpg"))
	sm.set_shader_parameter("dry", load(TEX + "grass_ground_c.jpg"))
	sm.set_shader_parameter("dirt", load(TEX + "forest_ground_04_c.jpg"))
	sm.set_shader_parameter("dirt_n", load(TEX + "forest_ground_04_n.jpg"))
	var nt := NoiseTexture2D.new()
	nt.width = 256
	nt.height = 256
	nt.seamless = true
	var fn := FastNoiseLite.new()
	fn.seed = 7
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	nt.noise = fn
	sm.set_shader_parameter("noise", nt)
	sm.set_shader_parameter("worn_c", Vector2(HOUSE_AT.x, HOUSE_AT.z + ULHouse.D * 0.5 + 2.2))
	sm.set_shader_parameter("worn_r", 4.2)
	sm.set_shader_parameter("house_c", Vector2(HOUSE_AT.x, HOUSE_AT.z))
	sm.set_shader_parameter("house_half", Vector2(ULHouse.W * 0.5, ULHouse.D * 0.5))
	sm.set_shader_parameter("yard", Vector4(HOUSE_AT.x + YARD[0], HOUSE_AT.z + YARD[1], HOUSE_AT.x + YARD[2], HOUSE_AT.z + YARD[3]))
	mi.material_override = sm
	add_child(mi)
	_grass()
	_plane(Vector2(SIZE + 3.0, SIZE + 3.0), Vector3(0, -0.02, 0), "rocky_gravel", 1.5, Color(0.5, 0.48, 0.44))
	_plane(Vector2(420, 420), Vector3(0, -0.05, 0), "dry_ground_01", 4.0, Color(0.5, 0.47, 0.42))
	var sb := StaticBody3D.new()
	add_child(sb)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	sb.add_child(cs)
	# граница кластера: дальше не пройти (для проверки)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var w := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, SIZE + 2) if s.x != 0.0 else Vector3(SIZE + 2, 4, 1)
		w.shape = b
		w.position = s * (SIZE * 0.5 + 1.0) + Vector3.UP * 2.0
		sb.add_child(w)


## Дом из Tripo — по нашим стенам. Замер модели (сечение на высоте стен): стены x −0.352…+0.340 (фасад с дверью
## и крыльцом — на +x), z −0.437…+0.431, свес крыши от высоты 0.33. Поворот −90°: фасад модели (+x) → фасад дома
## (+z). Масштаб по осям модели: глубина 10 м / 0.692, длина 12 м / 0.868; по высоте — стены 3.3 м (дверь ~2 м,
## при одинаковом масштабе модель была бы с 4.6-метровыми стенами).
const SHELL_FIT := {"scale": [14.45, 10.0, 13.82], "yaw": -90.0, "center": [-0.006, 0.0, -0.003]}


func _fit_shell() -> void:
	if house.shell == null:
		return
	var sh := house.shell
	var f: Dictionary = SHELL_FIT
	var S := Vector3(f.scale[0], f.scale[1], f.scale[2])
	sh.rotation.y = deg_to_rad(float(f.yaw))
	sh.scale = S
	var c := Vector3(f.center[0], f.center[1], f.center[2])
	var off := Basis(Vector3.UP, deg_to_rad(float(f.yaw))) * (c * S)
	sh.position = Vector3(-off.x, 0.0, -off.z)
	# сверху видна в основном крыша: без металлического блеска (иначе под солнцем она почти белая)
	for mi in sh.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si) as StandardMaterial3D
			if src == null:
				continue
			var mt := src.duplicate() as StandardMaterial3D
			mt.metallic = 0.0
			mt.metallic_texture = null
			mt.roughness = 0.9
			mt.roughness_texture = null
			mt.albedo_color = Color(0.62, 0.6, 0.57)
			m.set_surface_override_material(si, mt)


func _aabb(n: Node3D) -> AABB:
	var bb := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := n.transform * _rel(m, n)
		var a := xf * m.get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	return bb


func _rel(m: Node3D, root: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = m
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


## Двор: забор-штакетник на столбах с калиткой спереди, поленница у левой стены дома, колода для колки дров,
## камни. Всё — своя геометрия с текстурами досок и коры; у забора и поленницы есть столкновения.
func _yard() -> void:
	var planks := ULHouse._mat(TEX + "weathered_brown_planks", 1.2)
	planks.albedo_color = Color(0.78, 0.74, 0.68)
	var bark := ULHouse._mat(TEX + "bark_brown_02", 0.8)
	var body := StaticBody3D.new()
	body.name = "Yard"
	add_child(body)
	var x0: float = HOUSE_AT.x + YARD[0]
	var z0: float = HOUSE_AT.z + YARD[1]
	var x1: float = HOUSE_AT.x + YARD[2]
	var z1: float = HOUSE_AT.z + YARD[3]
	var gx := HOUSE_AT.x
	# стороны: [начало, конец]; спереди — две части с калиткой посередине
	var sides := [
		[Vector2(x0, z0), Vector2(x1, z0)], [Vector2(x0, z0), Vector2(x0, z1)], [Vector2(x1, z0), Vector2(x1, z1)],
		[Vector2(x0, z1), Vector2(gx - GATE * 0.5, z1)], [Vector2(gx + GATE * 0.5, z1), Vector2(x1, z1)],
	]
	var pickets: Array[Transform3D] = []
	var posts: Array[Transform3D] = []
	var rails: Array[Transform3D] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 33
	for sd in sides:
		var a: Vector2 = sd[0]
		var b: Vector2 = sd[1]
		var L := a.distance_to(b)
		var dir := (b - a) / L
		var yaw := -atan2(dir.y, dir.x)
		var B := Basis(Vector3.UP, yaw)
		var n := int(L / 0.17)
		for i in n:
			var t := (i + 0.5) / n * L
			var p := a + dir * t
			var h := rng.randf_range(1.05, 1.22)
			pickets.append(Transform3D(Basis(Vector3(dir.x, 0, dir.y), rng.randf_range(-0.03, 0.03)) * B * Basis.from_scale(Vector3(1, h, 1)), Vector3(p.x, h * 0.5, p.y)))
		var np := int(ceil(L / 2.4))
		for i in np + 1:
			var p := a + dir * (L * i / np)
			posts.append(Transform3D(B, Vector3(p.x, 0.65, p.y)))
		for y in [0.35, 0.85]:
			var m := (a + b) * 0.5
			rails.append(Transform3D(B * Basis.from_scale(Vector3(L, 1, 1)), Vector3(m.x, y, m.y)))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(L, 1.4, 0.12)
		cs.shape = bs
		cs.transform = Transform3D(B, Vector3((a.x + b.x) * 0.5, 0.7, (a.y + b.y) * 0.5))
		body.add_child(cs)
	_multi(pickets, _box(Vector3(0.09, 1.0, 0.025)), planks)
	_multi(posts, _box(Vector3(0.11, 1.3, 0.11)), planks)
	_multi(rails, _box(Vector3(1.0, 0.07, 0.035)), planks)
	# поленница вдоль левой стены дома (снаружи), под свесом крыши
	var logs: Array[Transform3D] = []
	var wx: float = HOUSE_AT.x - ULHouse.W * 0.5 - 1.4             # из-под свеса крыши — видно сверху
	for row in 5:
		for i in 14:
			var z: float = HOUSE_AT.z - 3.2 + i * 0.21 + (0.1 if row % 2 == 1 else 0.0)
			var y := 0.11 + row * 0.19
			logs.append(Transform3D(Basis(Vector3.FORWARD, PI * 0.5) * Basis(Vector3.UP, rng.randf() * TAU), Vector3(wx + rng.randf_range(-0.03, 0.03), y, z)))
	var log_mesh := CylinderMesh.new()
	log_mesh.top_radius = 0.1
	log_mesh.bottom_radius = 0.1
	log_mesh.height = 0.6
	log_mesh.radial_segments = 8
	_multi(logs, log_mesh, bark)
	var lc := CollisionShape3D.new()
	var lb := BoxShape3D.new()
	lb.size = Vector3(0.65, 1.0, 3.1)
	lc.shape = lb
	lc.position = Vector3(wx, 0.5, HOUSE_AT.z - 3.2 + 1.45)
	body.add_child(lc)
	# колода и пара поленьев рядом
	var block := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.24
	bm.bottom_radius = 0.27
	bm.height = 0.45
	block.mesh = bm
	block.material_override = bark
	block.position = Vector3(wx - 1.2, 0.225, HOUSE_AT.z + 0.6)
	add_child(block)
	var bc := CollisionShape3D.new()
	var bcs := CylinderShape3D.new()
	bcs.radius = 0.27
	bcs.height = 0.45
	bc.shape = bcs
	bc.position = block.position
	body.add_child(bc)
	var chips: Array[Transform3D] = []
	for i in 5:
		chips.append(Transform3D(Basis(Vector3.FORWARD, PI * 0.5) * Basis(Vector3.RIGHT, rng.randf() * TAU) * Basis(Vector3.UP, rng.randf() * TAU), block.position + Vector3(rng.randf_range(-0.8, 0.8), -0.16, rng.randf_range(-0.8, 0.8))))
	_multi(chips, log_mesh, bark)
	# камни по кластеру
	var rock := SphereMesh.new()
	rock.radius = 0.5
	rock.height = 0.6
	rock.radial_segments = 7
	rock.rings = 4
	var stones: Array[Transform3D] = []
	for i in 70:
		var p := Vector3(rng.randf_range(-SIZE * 0.48, SIZE * 0.48), 0, rng.randf_range(-SIZE * 0.48, SIZE * 0.48))
		var hq := p - HOUSE_AT
		if absf(hq.x) < ULHouse.W * 0.5 + 0.6 and absf(hq.z) < ULHouse.D * 0.5 + 2.5:
			continue                                               # не в доме и не на крыльце
		var s := rng.randf_range(0.08, 0.32)
		stones.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s * rng.randf_range(0.8, 1.4), s * 0.7, s)), p + Vector3.UP * s * 0.1))
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color(0.42, 0.41, 0.39)
	rm.normal_enabled = true
	rm.normal_texture = load(TEX + "rocky_gravel_n.jpg")
	rm.uv1_triplanar = true
	rm.roughness = 0.85
	_multi(stones, rock, rm)


func _box(size: Vector3) -> BoxMesh:
	var bm := BoxMesh.new()
	bm.size = size
	return bm


func _multi(xs: Array[Transform3D], mesh: Mesh, mat: Material) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	add_child(mi)
	return mi


func _flora() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2611
	var placed: Array[Vector3] = []
	var body := StaticBody3D.new()
	body.name = "Trees"
	add_child(body)
	for f in FLORA:
		var path := MODELS + String(f[0]) + ".glb"
		var scene: PackedScene = load(path) if ResourceLoader.exists(path) else null
		var n := int(f[2])
		var tries := 0
		while n > 0 and tries < 2000:
			tries += 1
			var p := Vector3(rng.randf_range(-SIZE * 0.47, SIZE * 0.47), 0, rng.randf_range(-SIZE * 0.47, SIZE * 0.47))
			# не на дом, не на дорогу, не на старт, не вплотную друг к другу
			var hp := p - HOUSE_AT
			if hp.x > YARD[0] - 1.5 and hp.x < YARD[2] + 1.5 and hp.z > YARD[1] - 1.5 and hp.z < YARD[3] + 1.5:
				continue
			if p.distance_to(Vector3(0, 0, 6)) < 4.0:
				continue
			var near := false
			for q in placed:
				if q.distance_to(p) < (2.2 if f[0] != "ul_bush" else 1.4):
					near = true
					break
			if near:
				continue
			placed.append(p)
			n -= 1
			var h := float(f[1]) * rng.randf_range(0.8, 1.2)
			var node: Node3D
			if scene:
				node = scene.instantiate()
				var bb := _aabb(node)
				node.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
			else:
				node = _fallback_tree(h, String(f[0]) == "ul_bush")
			node.rotation.y = rng.randf() * TAU
			node.position = p
			add_child(node)
			if float(f[3]) > 0.0:
				var cs := CollisionShape3D.new()
				var cy := CylinderShape3D.new()
				cy.radius = float(f[3]) * h / float(f[1])
				cy.height = 3.0
				cs.shape = cy
				cs.position = p + Vector3.UP * 1.5
				body.add_child(cs)


func _fallback_tree(h: float, bush: bool) -> Node3D:
	var n := Node3D.new()
	var leaf := StandardMaterial3D.new()
	leaf.albedo_color = Color(0.25, 0.42, 0.18)
	var crown := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = h * (0.45 if bush else 0.28)
	sm.height = sm.radius * 2.0
	crown.mesh = sm
	crown.material_override = leaf
	crown.position.y = h * (0.45 if bush else 0.7)
	n.add_child(crown)
	if not bush:
		var tr := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.08
		cm.bottom_radius = 0.13
		cm.height = h * 0.6
		tr.mesh = cm
		var bark := StandardMaterial3D.new()
		bark.albedo_color = Color(0.35, 0.28, 0.22)
		tr.material_override = bark
		tr.position.y = h * 0.3
		n.add_child(tr)
	return n


# ---------------- герой ----------------

func _player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	add_child(player)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.75
	cs.shape = cap
	cs.position.y = 0.875
	player.add_child(cs)
	player.floor_snap_length = 0.3
	rig = BCCharacter.new()
	player.add_child(rig)
	rig.setup("res://assets/models/hero.glb", "res://assets/anim/hero")
	snd = BCSound.new()
	add_child(snd)
	player.position = Vector3(0, 0.1, 3)
	player.rotation.y = PI                       # лицом к дому
	cam = Camera3D.new()
	cam.fov = 40
	cam.near = 0.1
	cam.far = 220
	add_child(cam)
	cam.current = true
	_cam_t = player.position


func _input_vec() -> Vector2:
	var v := _joy_v
	var k := Vector2(Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"), Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up"))
	for key in [[KEY_W, Vector2(0, -1)], [KEY_S, Vector2(0, 1)], [KEY_A, Vector2(-1, 0)], [KEY_D, Vector2(1, 0)]]:
		if Input.is_physical_key_pressed(key[0]):
			k += key[1]
	if k.length() > 0.01:
		v = k.normalized() * (1.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 0.6)
	if not _auto.is_empty():
		v = _auto_vec()
	return v


func _process(delta: float) -> void:
	var iv := _input_vec()
	# направление — относительно камеры: «вверх» на джойстике — от камеры вперёд
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dir := right * iv.x - fwd * iv.y
	var mag := clampf(iv.length(), 0.0, 1.0)
	var run := mag > 0.85 or _run_btn
	var speed := 0.0
	if mag > 0.12:
		speed = 3.6 if run else lerpf(0.9, 1.6, clampf((mag - 0.12) / 0.6, 0.0, 1.0))
	var want := dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	var hv := Vector3(player.velocity.x, 0, player.velocity.z)
	hv = hv.move_toward(want, delta * (14.0 if want.length() > hv.length() else 10.0))
	player.velocity = Vector3(hv.x, player.velocity.y - 9.8 * delta, hv.z)
	player.move_and_slide()
	if player.is_on_floor():
		player.velocity.y = 0.0
	var real := Vector3(player.velocity.x, 0, player.velocity.z).length()
	if real > 0.2:
		var yaw := atan2(hv.x, hv.z)
		player.rotation.y = lerp_angle(player.rotation.y, yaw, 1.0 - exp(-delta * 10.0))
	rig.set_motion(real, 0.0, delta)
	_steps_sfx(real)
	# в доме: крыша и стены Tripo скрыты, видны комнаты, камера круче
	var ins := house.contains(player.global_position)
	if ins != house.inside:
		house.set_inside(ins)
	var pitch_t := maxf(1.2, cam_pitch) if ins else cam_pitch
	var dist_t := clampf(cam_dist, 9.0, 12.0) if ins else cam_dist
	_cam_t = _cam_t.lerp(player.global_position, 1.0 - exp(-delta * 8.0))
	var cp := Vector3(sin(cam_yaw) * cos(pitch_t), sin(pitch_t), cos(cam_yaw) * cos(pitch_t)) * dist_t
	var look := _cam_t + Vector3.UP * 1.0
	cam.global_position = cam.global_position.lerp(look + cp, 1.0 - exp(-delta * 6.0)) if _cam_ready else look + cp
	_cam_ready = true
	cam.look_at(look, Vector3.UP)
	if info and Engine.get_process_frames() % 10 == 0:
		info.text = "%s · %s · ящиков: %d · %d кадров/с" % [_where(), "бег" if real > 2.5 else ("шаг" if real > 0.2 else "стоит"), crates.size(), Engine.get_frames_per_second()]
	if joy_ui:
		joy_ui.queue_redraw()
	# надписи комнат на полу — всегда читаются с той стороны, откуда смотрит камера
	for lb in house.labels:
		lb.basis = Basis(Vector3.UP, cam_yaw) * Basis(Vector3.RIGHT, -PI * 0.5)


var _cam_ready := false


func _where() -> String:
	if not house.contains(player.global_position):
		return "кластер, улица"
	var l := house.to_local(player.global_position)
	var best := ""
	var bd := 1e9
	for r in ULHouse.ROOMS:
		var room: Vector2 = r[1]
		var d := Vector2(l.x, l.z).distance_to(room)
		if d < bd:
			bd = d
			best = r[0]
	return "дом, " + best.to_lower()


func _steps_sfx(speed: float) -> void:
	if rig.probe == null or rig.probe.pos.is_empty():
		return
	for b in ["L_Foot", "R_Foot"]:
		if not rig.probe.pos.has(b):
			continue
		var lp: Vector3 = rig.probe.pos[b]
		var h := lp.y * rig.scale_k
		if not _steps.has(b):
			_steps[b] = [h, false]
		var st: Array = _steps[b]
		st[0] = minf(float(st[0]) + 0.0004, h)
		if h > float(st[0]) + 0.045:
			st[1] = true
		elif bool(st[1]) and h < float(st[0]) + 0.018:
			st[1] = false
			snd.play("step", rig.skel.global_transform * lp, -8.0 + clampf(speed, 0.0, 4.0) * 1.5, 0.08)
		_steps[b] = st
	if speed >= 3.0:
		snd.loop("breath_run", player.global_position + Vector3.UP * 1.5, -10.0)
	else:
		snd.loop("", Vector3.ZERO)


# ---------------- ящики ----------------

func place_crate() -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 1.0
	# не в стену: если впереди препятствие — ближе
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 0.4, p + Vector3.UP * 0.4)
	q.exclude = [player.get_rid()]
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		p = player.global_position + f * maxf(0.0, player.global_position.distance_to(hit.position) - 0.45)
	_add_crate(p, player.rotation.y)
	snd.play("cloth", p, -6.0)
	snd.play("hit_wood", p, -8.0, 0.1, 0.15)
	_save()


func _add_crate(p: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Crate"
	add_child(body)
	var size := Vector3(1.0, 0.6, 0.6)
	var vis: Node3D
	if _crate_scene:
		vis = _crate_scene.instantiate()
		var bb := _aabb(vis)
		var s := size.x / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		vis.scale = Vector3.ONE * s
		bb = _aabb(vis)
		size = bb.size
		vis.position = Vector3(-bb.get_center().x, -bb.position.y, -bb.get_center().z)
	else:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = size
		mi.mesh = bm
		mi.material_override = ULHouse._mat(TEX + "brown_planks_03", 0.8)
		mi.position.y = size.y * 0.5
		vis = mi
	body.add_child(vis)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position.y = size.y * 0.5
	body.add_child(cs)
	# на пол дома или на землю
	body.position = Vector3(p.x, ULHouse.FLOOR_Y if house.contains(p) else 0.0, p.z)
	body.rotation.y = yaw
	crates.append(body)


func remove_crate() -> void:
	var best: Node3D = null
	var bd := 2.2
	for c in crates:
		var d := c.global_position.distance_to(player.global_position)
		if d < bd:
			bd = d
			best = c
	if best:
		snd.play("cloth", best.global_position, -6.0)
		crates.erase(best)
		best.queue_free()
		_save()


func _save() -> void:
	var arr := []
	for c in crates:
		arr.append([snappedf(c.position.x, 0.01), snappedf(c.position.z, 0.01), snappedf(c.rotation.y, 0.01)])
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"v": SAVE_V, "crates": arr}))


func _load() -> void:
	var arr := []
	var have := false
	if FileAccess.file_exists(SAVE) and test == "":
		var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
		if d is Dictionary and int(d.get("v", 1)) >= SAVE_V:
			arr = d.get("crates", [])
			have = true
	if not have:
		# первый запуск — два ящика в кладовой, длинной стороной вдоль наружной стены (стена x = 6, её внутренняя
		# сторона — 5.89; ящик 0.78 в глубину — центр в 5.47)
		for z in [2.2, 3.3]:
			var g := house.to_global(Vector3(5.47, 0, z))
			arr.append([g.x, g.z, 0.0])
	for it in arr:
		_add_crate(Vector3(float(it[0]), 0, float(it[1])), float(it[2]))


# ---------------- интерфейс и касания ----------------

func _style(bg := C_BG) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = C_LINE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(4)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	return sb


func _btn(text: String, cb: Callable, w := 130.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 56)
	b.add_theme_font_size_override("font_size", 17)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_stylebox_override("normal", _style())
	b.add_theme_stylebox_override("hover", _style(Color(0.1, 0.16, 0.2, 0.9)))
	b.add_theme_stylebox_override("pressed", _style(Color(0.12, 0.3, 0.4, 0.95)))
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(root)
	info = Label.new()
	info.position = Vector2(16, 12)
	info.add_theme_font_size_override("font_size", 18)
	info.add_theme_color_override("font_color", C_TEXT)
	info.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	info.add_theme_constant_override("outline_size", 6)
	root.add_child(info)
	var title := Label.new()
	title.text = "Стабильный кластер · стартовая локация (проверка)"
	title.position = Vector2(16, 40)
	title.add_theme_font_size_override("font_size", 14)
	title.add_theme_color_override("font_color", Color(0.7, 0.85, 0.95, 0.8))
	root.add_child(title)
	var bar := VBoxContainer.new()
	bar.anchor_left = 1.0
	bar.anchor_right = 1.0
	bar.offset_left = -150
	bar.offset_right = -12
	bar.offset_top = 12
	bar.add_theme_constant_override("separation", 8)
	root.add_child(bar)
	bar.add_child(_btn("Ящик +", place_crate))
	bar.add_child(_btn("Ящик −", remove_crate))
	bar.add_child(_btn("Рюкзак", _cycle_pack))
	var rb := _btn("Бег", func(): _run_btn = not _run_btn)
	rb.toggle_mode = true
	bar.add_child(rb)
	bar.add_child(_btn("Стенд", func(): get_tree().change_scene_to_file("res://stand.tscn")))
	joy_ui = Control.new()
	joy_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	joy_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	joy_ui.draw.connect(_draw_joy)
	root.add_child(joy_ui)


func _draw_joy() -> void:
	if _joy_id < 0:
		var vs := get_viewport().get_visible_rect().size
		var c := Vector2(150, vs.y - 150)
		joy_ui.draw_circle(c, 90, Color(1, 1, 1, 0.06))
		joy_ui.draw_arc(c, 90, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.35), 2.0)
		return
	joy_ui.draw_circle(_joy_o, 90, Color(1, 1, 1, 0.08))
	joy_ui.draw_arc(_joy_o, 90, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.5), 2.0)
	joy_ui.draw_circle(_joy_o + _joy_v * 90, 34, Color(0.6, 0.85, 1.0, 0.45))


var _packs := ["", "small", "medium", "large"]


func _cycle_pack() -> void:
	_pack_i = (_pack_i + 1) % _packs.size()
	for c in rig.skel.get_children():
		if c.name == "Pack":
			c.queue_free()
	var id: String = _packs[_pack_i]
	if id != "":
		var stand_packs: Dictionary = load("res://stand.gd").get_script_constant_map().PACKS
		var mi := BCPackFit.build(rig, stand_packs[id])
		rig.skel.add_child(mi)
		mi.skeleton = mi.get_path_to(rig.skel)
		snd.play("zip", player.global_position + Vector3.UP * 1.2, -6.0)
	else:
		snd.play("cloth", player.global_position + Vector3.UP * 1.2, -4.0)


func _unhandled_input(e: InputEvent) -> void:
	var vs := get_viewport().get_visible_rect().size
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			_touch[t.index] = t.position
			if t.position.x < vs.x * 0.45 and _joy_id < 0:
				_joy_id = t.index
				_joy_o = t.position
				_joy_v = Vector2.ZERO
			elif _cam_id < 0:
				_cam_id = t.index
		else:
			_touch.erase(t.index)
			if t.index == _joy_id:
				_joy_id = -1
				_joy_v = Vector2.ZERO
			if t.index == _cam_id:
				_cam_id = -1
			_pinch = 0.0
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		_touch[d.index] = d.position
		if d.index == _joy_id:
			_joy_v = ((d.position - _joy_o) / 90.0).limit_length(1.0)
		elif d.index == _cam_id:
			if _touch.size() >= 2 and _joy_id < 0:
				var ks := _touch.keys()
				var dd := (_touch[ks[0]] as Vector2).distance_to(_touch[ks[1]])
				if _pinch > 0.0:
					cam_dist = clampf(cam_dist * _pinch / dd, 7.0, 22.0)
				_pinch = dd
			else:
				cam_yaw -= d.relative.x * 0.006
				cam_pitch = clampf(cam_pitch + d.relative.y * 0.004, 0.9, 1.35)
	elif e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(7.0, cam_dist * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(22.0, cam_dist * 1.1)


# ---------------- проверка ----------------

func _auto_vec() -> Vector2:
	var p := player.global_position
	var tgt: Vector3 = _auto[0]
	var d := Vector3(tgt.x - p.x, 0, tgt.z - p.z)
	if d.length() < 0.35:
		_auto.pop_front()
		if _auto.is_empty():
			return Vector2.ZERO
		return _auto_vec()
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dn := d.normalized()
	return Vector2(dn.dot(right), -dn.dot(fwd)) * 0.6


func _snap(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, name])


func _walk(points: Array, limit := 30.0) -> void:
	_auto = points.duplicate()
	var t := 0.0
	while not _auto.is_empty() and t < limit:
		await get_tree().process_frame
		t += get_process_delta_time()
	_auto.clear()
	await get_tree().create_timer(0.6).timeout


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(1.0).timeout
	# общий вид сверху
	var keep := cam_dist
	cam_dist = 60.0
	cam_pitch = 1.2
	await get_tree().create_timer(1.2).timeout
	await _snap("w0_overview")
	cam_dist = 13.0
	cam_pitch = 1.0
	await get_tree().create_timer(1.0).timeout
	await _snap("w1_start")
	cam_dist = 8.0
	cam_pitch = 0.95
	await get_tree().create_timer(1.0).timeout
	await _snap("w1b_ground")
	cam_dist = keep
	cam_pitch = 1.0
	# к дому, внутрь и по комнатам
	var H := house
	var route := [
		["w2_door", [HOUSE_AT + Vector3(0, 0, YARD[3] + 1.0), HOUSE_AT + Vector3(0, 0, YARD[3] - 1.0), H.door_point(1.5)]],
		["w3_seni", [H.to_global(Vector3(0, 0, 3.4))]],
		["w4_kitchen", [H.to_global(Vector3(0, 0, 3.25)), H.to_global(Vector3(-1.0, 0, 3.25)), H.to_global(Vector3(-3.6, 0, 3.4))]],
		["w5_store", [H.to_global(Vector3(-1.0, 0, 3.25)), H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(2.4, 0, 3.0))]],
		["w6_gornica", [H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(0, 0, 2.6)), H.to_global(Vector3(0, 0, 0.5)), H.to_global(Vector3(-2.5, 0, -1.5))]],
		["w7_bedroom", [H.to_global(Vector3(0.8, 0, -2.0)), H.to_global(Vector3(2.4, 0, -2.0)), H.to_global(Vector3(3.8, 0, -2.5))]],
	]
	var keep_p := player.global_position
	player.global_position = HOUSE_AT + Vector3(-ULHouse.W * 0.5 - 2.0, 0.05, 1.5)
	await get_tree().create_timer(1.2).timeout
	await _snap("w1c_yard")
	player.global_position = keep_p
	await get_tree().create_timer(0.6).timeout
	for r in route:
		await _walk(r[1])
		print("[world] %s: герой в %s, «%s»" % [r[0], str(player.global_position.snapped(Vector3.ONE * 0.01)), _where()])
		await _snap(r[0])
	place_crate()
	await get_tree().create_timer(0.4).timeout
	await _snap("w8_crate")
	print("[world] ящиков: %d, последний в %s" % [crates.size(), str(crates[-1].global_position.snapped(Vector3.ONE * 0.01))])
	# обратно на улицу и к краю кластера
	await _walk([H.to_global(Vector3(0.8, 0, -2.0)), H.to_global(Vector3(0, 0, 0.5)), H.to_global(Vector3(0, 0, 3.0)), H.door_point(2.5), HOUSE_AT + Vector3(0, 0, YARD[3] + 1.5)], 25.0)
	print("[world] вышел со двора: %s" % str(player.global_position.snapped(Vector3.ONE * 0.01)))
	player.global_position = Vector3(0, 0.05, 44)
	await _walk([Vector3(0, 0, 60)], 8.0)
	print("[world] у края: %s (дальше края кластера пройти нельзя)" % str(player.global_position.snapped(Vector3.ONE * 0.01)))
	await _snap("w9_edge")
	get_tree().quit()
