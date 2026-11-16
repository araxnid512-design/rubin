extends Node3D
## Стартовая локация — стабильный кластер 100×100 м (для проверки героя в мире): земля с травой, проплешинами
## и вытоптанной площадкой у крыльца, деревья и кусты (модели Tripo), деревянный дом с пятью комнатами, ящики, которые можно
## ставить и убирать (сохраняются). Граница кластера — полоса гравия и невидимая стена.
## Управление: левая часть экрана — джойстик (слегка — лёгкий бег, сильнее — быстрее), справа — круглые кнопки:
## большая — атака (огонь / мачете / кулаки), смена оружия, взять-открыть, лечение, перезарядка, инвентарь. Камера неподвижна, сверху,
## следует за героем; два пальца — приблизить. На компьютере — WASD, Shift — бег, E — действие, I — инвентарь,
## Q — оружие, колесо — приблизить.
## Проверка: --as-test=world --as-out=папка — обход локации и дома по точкам, снимки и журнал.

const SIZE := 100.0               ## кластер, м
const SAVE := "user://cluster.json"
const SAVE_V := 5                 ## версия сохранения: 5 — набор припасов (новые предметы на старте)
const CRATE_SLOTS := 12
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
	["ul_birch", 5.5, 6, 0.14], ["ul_pine", 6.5, 10, 0.16], ["ul_apple", 3.6, 3, 0.15], ["ul_bush", 1.2, 22, 0.0],
]

var player: CharacterBody3D
var rig: BCCharacter
var snd: BCSound
var house: ULHouse
var cam: Camera3D
## камера как в изометрических выживалках: неподвижна, сверху под 55°, смотрит на север (дом — вверху экрана)
const CAM_YAW := 0.0
const CAM_PITCH := 0.96
var cam_dist := 12.5
var _cam_t := Vector3.ZERO
var crates: Array[Node3D] = []
var _crate_scene: PackedScene = null
var _joy_id := -1
var _joy_o := Vector2.ZERO
var _joy_v := Vector2.ZERO
var _touch := {}
var _pinch := 0.0
var info: Label
var test := ""
var out := "user://world"
var _auto: Array = []             ## проверка: точки, к которым герой идёт сам
var _steps := {}
var inv: ULInventory
var inv_ui: ULInventoryUI
var ground: Array = []            ## предметы на земле: {item, node}
var _target = null                ## ближайшее, с чем можно что-то сделать: {"type": "ground"/"crate", …}
var _open_ground = null           ## открытый рюкзак на земле (запись из ground)
var _hud: Control
var _hud_btns := {}               ## имя → [центр, радиус, подпись]
var _hud_touch := {}              ## палец → кнопка
var _pack_shown := ""
var _preview_vp: SubViewport
var _preview_rig: BCCharacter
var _preview_pack := ""
var _toast: Label
var _toast_t := 0.0


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
	_blob_layer()
	_player()
	_combat_setup()
	inv = ULInventory.new()
	_ui()
	if ResourceLoader.exists(MODELS + "ul_crate.glb"):
		_crate_scene = load(MODELS + "ul_crate.glb")
	_load()
	_apply_gear()
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
	e.ambient_light_energy = 0.7
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
	sun.light_energy = 1.05
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = false            # без теней — быстрее; под героем и деревьями — мягкие пятна
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
// Земля кластера: тёмная лесная почва, трава пятнами, натоптанная тропа с галькой от калитки и через кластер.
// Текстуры берутся в двух масштабах под углом и смешиваются по шуму — без повторяющегося рисунка. У крыльца
// и вокруг фундамента дома — вытоптанная земля.
uniform sampler2D grass : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D blades : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D soil : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D path : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D path_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform vec4 segs[8];            // тропа: отрезки (ax, az, bx, bz)
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
	float n1 = texture(noise, p / 70.0).r;
	float n2 = texture(noise, p / 19.0 + vec2(0.37, 0.11)).r;
	float n3 = texture(noise, p / 5.5 + vec2(0.71, 0.53)).r;
	vec3 g = mix(texture(grass, u1).rgb, texture(blades, rot * p / 5.3).rgb * vec3(1.5, 1.45, 1.1), 0.25 + 0.4 * n2);
	g *= vec3(0.92, 0.96, 0.8);
	vec3 so = mix(texture(soil, p / 3.4).rgb, texture(soil, rot * p / 9.7).rgb, 0.4) * vec3(1.75, 1.85, 1.95);
	vec3 e = mix(texture(path, p / 3.0).rgb, texture(path, rot * p / 8.3).rgb, 0.3) * 1.75;
	// тропа
	float td = 1000.0;
	for (int i = 0; i < 8; i++) {
		vec2 a = segs[i].xy;
		vec2 ab = segs[i].zw - a;
		float h = clamp(dot(p - a, ab) / max(dot(ab, ab), 0.0001), 0.0, 1.0);
		td = min(td, distance(p, a + ab * h));
	}
	float trail = 1.0 - smoothstep(0.5, 1.9, td + (n3 - 0.5) * 2.2);
	float porch = 1.0 - smoothstep(worn_r * 0.35, worn_r, distance(p, worn_c) + (n3 - 0.5) * 2.4);
	vec2 q = max(abs(p - house_c) - house_half, vec2(0.0));
	float ring = 1.0 - smoothstep(0.2, 1.4, length(q) + (n3 - 0.5) * 0.9);
	float bare = max(trail, max(porch, ring * 0.8));
	// трава пятнами; во дворе её меньше — ходят каждый день
	float gw = smoothstep(0.4, 0.6, n1 * 0.4 + n2 * 0.35 + n3 * 0.25);
	gw = gw * 0.88 + 0.06;
	vec2 yq = max(max(yard.xy - p, p - yard.zw), vec2(0.0));
	float in_yard = 1.0 - smoothstep(0.0, 1.2, length(yq));
	gw *= 1.0 - in_yard * 0.45;
	gw *= 1.0 - bare;
	// галька: на тропе и редкими россыпями на голой земле
	float peb = max(bare, smoothstep(0.6, 0.72, n2 * 0.5 + n3 * 0.5) * 0.75);
	vec3 col = mix(mix(so, e, peb), g, gw);
	col *= mix(0.84, 1.08, n1) * mix(0.92, 1.05, n2) * 0.66;
	// затенение у стен дома (свет туда почти не попадает)
	float wall_ao = 1.0 - (1.0 - smoothstep(0.0, 0.9, length(q))) * 0.45 * step(0.001, length(q));
	col *= wall_ao;
	NORMAL_MAP_DEPTH = 1.4;
	ALBEDO = col;
	NORMAL_MAP = mix(texture(path_n, p / 3.0).rgb, texture(grass_n, u1).rgb, gw);
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
	ALBEDO = c.rgb * COLOR.rgb * vec3(0.7, 0.75, 0.42) * mix(0.6, 1.0, 1.0 - hh);
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
		var side := Vector3(-out.z, 0, out.x) * 0.15
		var top := out * 0.2 + Vector3.UP * 0.34
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
			for k in 300:
				var p := Vector3(-SIZE * 0.5 + (cx + rng.randf()) * cell, 0, -SIZE * 0.5 + (cz + rng.randf()) * cell)
				var hp := p - HOUSE_AT
				if absf(hp.x) < ULHouse.W * 0.5 + 1.2 and absf(hp.z) < ULHouse.D * 0.5 + 1.2:
					continue
				if p.distance_to(HOUSE_AT + Vector3(0, 0, ULHouse.D * 0.5 + 2.2)) < 3.5:
					continue                                       # вытоптано у крыльца
				if hp.x > YARD[0] and hp.x < YARD[2] and hp.z > YARD[1] and hp.z < YARD[3] and rng.randf() < 0.6:
					continue                                       # во дворе травы меньше
				if _trail_dist(p) < 1.7:
					continue                                       # тропа натоптана
				var gw := _grass_w(p)
				if gw < 0.5 and rng.randf() < 0.82:
					continue                                       # на голой земле — редкие сорняки
				var sc := rng.randf_range(0.55, 1.25)
				xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.8, 1.4), sc)), p))
				var g := rng.randf_range(0.85, 1.15)
				if rng.randf() < 0.3:
					cs.append(Color(g * 1.3, g * 1.12, g * 0.8))   # сухой пучок
				else:
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


## тропа: отрезки [начало, конец] в плоскости (x, z) — от крыльца к калитке и дальше через кластер
const TRAIL := [
	[Vector2(0, -6.0), Vector2(0, -2.0)], [Vector2(0, -2.0), Vector2(0.6, 6.0)], [Vector2(0.6, 6.0), Vector2(-2.5, 17.0)],
	[Vector2(-2.5, 17.0), Vector2(-0.5, 31.0)], [Vector2(-0.5, 31.0), Vector2(3.0, 50.0)],
	[Vector2(0.6, 6.0), Vector2(15.0, 9.5)], [Vector2(15.0, 9.5), Vector2(31.0, 6.0)], [Vector2(31.0, 6.0), Vector2(50.0, 11.0)],
]
var _noise_img: Image


func _trail_dist(p: Vector3) -> float:
	var q := Vector2(p.x, p.z)
	var d := 1000.0
	for sg in TRAIL:
		var a: Vector2 = sg[0]
		var ab: Vector2 = sg[1] - a
		var h := clampf((q - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		d = minf(d, q.distance_to(a + ab * h))
	return d


func _noise(uv: Vector2) -> float:
	var x := fposmod(uv.x, 1.0) * 256.0
	var y := fposmod(uv.y, 1.0) * 256.0
	return _noise_img.get_pixel(int(x) % 256, int(y) % 256).r


## доля травы в точке — та же формула, что в шейдере земли (без двора и тропы)
func _grass_w(p: Vector3) -> float:
	var q := Vector2(p.x, p.z)
	var n1 := _noise(q / 70.0)
	var n2 := _noise(q / 19.0 + Vector2(0.37, 0.11))
	var n3 := _noise(q / 5.5 + Vector2(0.71, 0.53))
	return smoothstep(0.44, 0.56, n1 * 0.4 + n2 * 0.35 + n3 * 0.25)


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
	sm.set_shader_parameter("blades", load(TEX + "sparse_grass_c.jpg"))
	sm.set_shader_parameter("soil", load(TEX + "mud_forest_c.jpg"))
	sm.set_shader_parameter("path", load(TEX + "stony_dirt_path_c.jpg"))
	sm.set_shader_parameter("path_n", load(TEX + "stony_dirt_path_n.jpg"))
	# шум — картинкой: тот же рисунок читается и в шейдере, и здесь (где трава — там пучки)
	var fn := FastNoiseLite.new()
	fn.seed = 7
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_img.generate_mipmaps()
	sm.set_shader_parameter("noise", ImageTexture.create_from_image(_noise_img))
	var sg: Array = []
	for i in 8:
		var k := mini(i, TRAIL.size() - 1)
		sg.append(Vector4(TRAIL[k][0].x, TRAIL[k][0].y, TRAIL[k][1].x, TRAIL[k][1].y))
	sm.set_shader_parameter("segs", sg)
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
	var planks := ULHouse._mat(TEX + "old_planks_02", 1.25)
	planks.albedo_color = Color(0.92, 0.9, 0.86)
	planks.vertex_color_use_as_albedo = true
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
	# сплошной забор из серых досок: доски разной высоты, две жерди, столбы выше досок, по верху — колючая проволока
	var pickets: Array[Transform3D] = []
	var cols: Array[Color] = []
	var posts: Array[Transform3D] = []
	var rails: Array[Transform3D] = []
	var wires: Array[Transform3D] = []
	var barbs: Array[Transform3D] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 33
	for sd in sides:
		var a: Vector2 = sd[0]
		var b: Vector2 = sd[1]
		var L := a.distance_to(b)
		var dir := (b - a) / L
		var yaw := -atan2(dir.y, dir.x)
		var B := Basis(Vector3.UP, yaw)
		var n := int(L / 0.155)
		for i in n:
			var t := (i + 0.5) / n * L
			var p := a + dir * t
			var h := rng.randf_range(1.5, 1.82)
			pickets.append(Transform3D(Basis(Vector3(dir.x, 0, dir.y), rng.randf_range(-0.025, 0.025)) * B * Basis.from_scale(Vector3(rng.randf_range(0.92, 1.04), h, 1)), Vector3(p.x, h * 0.5, p.y)))
			var g := rng.randf_range(0.72, 1.08)
			cols.append(Color(g, g * rng.randf_range(0.96, 1.0), g * rng.randf_range(0.9, 0.98)))
		var np := int(ceil(L / 2.6))
		var tops: Array[Vector3] = []
		for i in np + 1:
			var p := a + dir * (L * i / np)
			posts.append(Transform3D(B * Basis(Vector3(dir.x, 0, dir.y), rng.randf_range(-0.03, 0.03)), Vector3(p.x, 1.1, p.y)))
			tops.append(Vector3(p.x, 0, p.y))
		for y in [0.42, 1.32]:
			var m := (a + b) * 0.5
			rails.append(Transform3D(B * Basis.from_scale(Vector3(L, 1, 1)), Vector3(m.x, y, m.y)))
		# проволока: две нити между столбами, провисает посередине
		for i in np:
			for wy in [1.98, 2.16]:
				var y: float = wy
				var parts := 4
				for k in parts:
					var t0 := float(k) / parts
					var t1 := float(k + 1) / parts
					var p0 := tops[i].lerp(tops[i + 1], t0) + Vector3.UP * (y - 0.07 * sin(t0 * PI))
					var p1 := tops[i].lerp(tops[i + 1], t1) + Vector3.UP * (y - 0.07 * sin(t1 * PI))
					var d := p1 - p0
					var wb := Basis.looking_at(d.normalized(), Vector3.UP) * Basis.from_scale(Vector3(1, 1, d.length()))
					wires.append(Transform3D(wb, (p0 + p1) * 0.5))
					for j in 2:
						var bp := p0.lerp(p1, (j + rng.randf_range(0.2, 0.8)) / 2.0)
						barbs.append(Transform3D(Basis(Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized(), rng.randf() * TAU), bp))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(L, 1.9, 0.14)
		cs.shape = bs
		cs.transform = Transform3D(B, Vector3((a.x + b.x) * 0.5, 0.95, (a.y + b.y) * 0.5))
		body.add_child(cs)
	_multi(pickets, _box(Vector3(0.145, 1.0, 0.024)), planks, cols)
	var post_mat: StandardMaterial3D = planks.duplicate()
	post_mat.albedo_color = Color(0.5, 0.46, 0.42)
	post_mat.vertex_color_use_as_albedo = false
	_multi(posts, _box(Vector3(0.15, 2.2, 0.15)), post_mat)
	_multi(rails, _box(Vector3(1.0, 0.09, 0.045)), post_mat)
	var wire := StandardMaterial3D.new()
	wire.albedo_color = Color(0.2, 0.19, 0.18)
	wire.metallic = 0.6
	wire.roughness = 0.6
	_multi(wires, _box(Vector3(0.014, 0.014, 1.0)), wire)
	_multi(barbs, _box(Vector3(0.012, 0.07, 0.012)), wire)
	# у забора справа от калитки: бочка и покрышка
	_prop("ph_barrel", Vector3(gx + 4.6, 0, z1 + 0.6), 0.4, 1.0, body, 0.33)
	_prop("ph_barrel", Vector3(x0 + 1.0, 0, z0 + 1.1), 2.1, 1.0, body, 0.33)
	var ty := _prop("ph_tyre", Vector3(gx + 6.4, 0.3, z1 + 0.3), 0.0, 1.05, body, 0.0)
	if ty:
		ty.rotation = Vector3(0.24, 0.25, 0)
	var ty2 := _prop("ph_tyre", Vector3(gx - 5.2, 0.085, z1 + 1.6), 0.0, 1.05, body, 0.0)
	if ty2:
		ty2.rotation = Vector3(PI * 0.5, 0.8, 0)
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
	rock.radial_segments = 6
	rock.rings = 3
	var stones: Array[Transform3D] = []
	for i in 70:
		var p := Vector3(rng.randf_range(-SIZE * 0.48, SIZE * 0.48), 0, rng.randf_range(-SIZE * 0.48, SIZE * 0.48))
		var hq := p - HOUSE_AT
		if absf(hq.x) < ULHouse.W * 0.5 + 0.6 and absf(hq.z) < ULHouse.D * 0.5 + 2.5:
			continue                                               # не в доме и не на крыльце
		var s := rng.randf_range(0.08, 0.32)
		stones.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s * rng.randf_range(0.8, 1.4), s * 0.7, s)), p + Vector3.UP * s * 0.1))
	# несколько валунов у тропы
	for i in 26:
		var sgm: Array = TRAIL[rng.randi() % TRAIL.size()]
		var bp2: Vector2 = (sgm[0] as Vector2).lerp(sgm[1], rng.randf())
		var off := Vector2.from_angle(rng.randf() * TAU) * rng.randf_range(2.0, 4.2)
		var p := Vector3(bp2.x + off.x, 0, bp2.y + off.y)
		var hq := p - HOUSE_AT
		if hq.x > YARD[0] - 0.6 and hq.x < YARD[2] + 0.6 and hq.z > YARD[1] - 0.6 and hq.z < YARD[3] + 0.6:
			continue
		var s := rng.randf_range(0.3, 0.62)
		stones.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s * rng.randf_range(0.8, 1.3), s * 0.75, s)), p + Vector3.UP * s * 0.12))
	# сухие ветки и палки на земле
	var sticks: Array[Transform3D] = []
	for i in 160:
		var p := Vector3(rng.randf_range(-SIZE * 0.48, SIZE * 0.48), 0.03, rng.randf_range(-SIZE * 0.48, SIZE * 0.48))
		var hq := p - HOUSE_AT
		if absf(hq.x) < ULHouse.W * 0.5 + 0.6 and absf(hq.z) < ULHouse.D * 0.5 + 2.5:
			continue
		var ln := rng.randf_range(0.5, 1.6)
		var sb2 := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.FORWARD, PI * 0.5 + rng.randf_range(-0.04, 0.04))
		sticks.append(Transform3D(sb2.scaled(Vector3(1.0, ln, 1.0)), p))
		if rng.randf() < 0.6:
			# сучок вбок
			var q2 := p + sb2 * Vector3(0, ln * rng.randf_range(-0.2, 0.3), 0)
			var sb3 := Basis(Vector3.UP, rng.randf_range(0.4, 0.9) * (1.0 if rng.randf() < 0.5 else -1.0)) * sb2
			sticks.append(Transform3D(sb3.scaled(Vector3(0.7, ln * 0.45, 0.7)), q2 + sb3 * Vector3(0, ln * 0.22, 0)))
	var stick := CylinderMesh.new()
	stick.top_radius = 0.016
	stick.bottom_radius = 0.03
	stick.height = 1.0
	stick.radial_segments = 5
	stick.rings = 0
	var stick_mat: StandardMaterial3D = bark.duplicate()
	stick_mat.albedo_color = Color(0.62, 0.52, 0.42)
	_multi(sticks, stick, stick_mat)
	var rm := StandardMaterial3D.new()
	rm.albedo_color = Color(0.5, 0.5, 0.48)
	rm.normal_enabled = true
	rm.normal_texture = load(TEX + "rocky_gravel_n.jpg")
	rm.uv1_triplanar = true
	rm.roughness = 0.85
	_multi(stones, rock, rm)


## предмет обстановки из модели: поставить, при radius > 0 — круглое столкновение
func _prop(model: String, at: Vector3, yaw: float, sc: float, body: StaticBody3D, radius: float) -> Node3D:
	var path := MODELS + model + ".glb"
	if not ResourceLoader.exists(path):
		return null
	var n: Node3D = (load(path) as PackedScene).instantiate()
	n.position = at
	n.rotation.y = yaw
	n.scale = Vector3.ONE * sc
	add_child(n)
	_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * 1.5), Vector3(at.x, 0.03, at.z)))
	if radius > 0.0:
		var cs := CollisionShape3D.new()
		var cy := CylinderShape3D.new()
		cy.radius = radius
		cy.height = 1.0
		cs.shape = cy
		cs.position = Vector3(at.x, 0.5, at.z)
		body.add_child(cs)
	return n


const SPRUCE_SHADER := """shader_type spatial;
render_mode cull_disabled;
// еловые лапы: вырез по альфе, обе стороны освещены одинаково, концы чуть качаются
uniform sampler2D tex : source_color, filter_linear_mipmap;
varying vec3 wn;
void vertex() {
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = sin(TIME * 1.1 + wpos.x * 0.4 + wpos.z * 0.3) + 0.5 * sin(TIME * 2.3 + wpos.z * 0.8);
	VERTEX.y += w * 0.035 * (1.0 - UV.y);
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec4 c = texture(tex, UV);
	if (c.a < 0.4) { discard; }
	// нормаль — вверх и наружу с обеих сторон лапы (иначе изнанка чёрная)
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
	vec3 a = c.rgb * COLOR.rgb;
	ALBEDO = mix(vec3(dot(a, vec3(0.3, 0.59, 0.11))), a, 0.62) * vec3(0.9, 0.88, 0.84);
	ROUGHNESS = 0.9;
	SPECULAR = 0.05;
}
"""


## ель высотой h: ствол и ярусы лап (каждая лапа — полоса из двух звеньев с рисованной текстурой хвои)
func _spruce_mesh(h: float, seed_n: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var mesh := ArrayMesh.new()
	# ствол
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var r0 := 0.018 * h + 0.06
	var sides := 7
	for i in sides:
		var a0 := TAU * i / sides
		var a1 := TAU * (i + 1) / sides
		var b0 := Vector3(cos(a0), 0, sin(a0))
		var b1 := Vector3(cos(a1), 0, sin(a1))
		var v := [b0 * r0, b1 * r0, b1 * 0.02 + Vector3.UP * h * 0.97, b0 * 0.02 + Vector3.UP * h * 0.97]
		var nn := [b0, b1, b1, b0]
		var uv := [Vector2(float(i) / sides, h * 0.5), Vector2(float(i + 1) / sides, h * 0.5), Vector2(float(i + 1) / sides, 0), Vector2(float(i) / sides, 0)]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(nn[k])
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var bark := StandardMaterial3D.new()
	bark.albedo_texture = load(TEX + "bark_brown_02_c.jpg")
	bark.albedo_color = Color(0.55, 0.48, 0.42)
	bark.roughness = 0.95
	st.set_material(bark)
	st.commit(mesh)
	# лапы
	st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tiers := int(h * 1.7)
	for ti in tiers:
		var t := float(ti) / (tiers - 1)
		var y := h * (0.13 + 0.8 * t)
		var L := h * 0.3 * pow(1.0 - t, 0.8) + 0.3
		var nb := int(round(lerpf(8.0, 5.0, t)))
		var a_off := rng.randf() * TAU
		var droop := lerpf(-0.5, -0.05, t)
		var shade := lerpf(0.5, 0.86, t)
		for bi in nb:
			var a := a_off + TAU * bi / nb + rng.randf_range(-0.2, 0.2)
			var dir := Vector3(cos(a), 0, sin(a))
			var side := Vector3(-dir.z, 0, dir.x)
			var l2 := L * rng.randf_range(0.82, 1.12)
			var p0 := Vector3(0, y + rng.randf_range(-0.12, 0.12), 0)
			var p1 := p0 + dir * (l2 * 0.45) + Vector3.UP * (l2 * 0.06)
			var p2 := p1 + dir * (l2 * 0.55) + Vector3.UP * (l2 * 0.55 * tan(droop))
			var w := l2 * 0.42
			var nrm := (Vector3.UP * 0.85 + dir * 0.55).normalized()
			var g := shade * rng.randf_range(0.85, 1.12)
			var col := Color(g * 0.8, g * 0.92, g * 0.86)
			var v := [p0 - side * w * 0.3, p0 + side * w * 0.3, p1 - side * w, p1 + side * w, p2 - side * w * 0.9, p2 + side * w * 0.9]
			var uv := [Vector2(0.2, 1), Vector2(0.8, 1), Vector2(0, 0.55), Vector2(1, 0.55), Vector2(0.05, 0), Vector2(0.95, 0)]
			for k in [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]:
				st.set_normal(nrm)
				st.set_color(col if k < 4 else col.lightened(0.12))
				st.set_uv(uv[k])
				st.add_vertex(v[k])
	# макушка: три скрещённые лапы вверх
	for i in 3:
		var a := PI * i / 3.0
		var side := Vector3(cos(a), 0, sin(a)) * h * 0.075
		var base := Vector3.UP * h * 0.86
		var top := Vector3.UP * h * 1.0
		var v := [base - side, base + side, top + side * 0.5, top - side * 0.5]
		var uv := [Vector2(0, 0.75), Vector2(1, 0.75), Vector2(0.8, 0), Vector2(0.2, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_color(Color(0.72, 0.84, 0.76))
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SPRUCE_SHADER
	sm.shader = sh
	sm.set_shader_parameter("tex", load(TEX + "spruce_bough.png"))
	st.set_material(sm)
	st.commit(mesh)
	return mesh


## ельник: три вида ели, расставлены по кластеру (не во дворе, не на тропе, не у старта)
func _spruces(body: StaticBody3D, placed: Array[Vector3], rng: RandomNumberGenerator) -> void:
	var kinds := [[7.0, 11], [9.0, 12], [11.0, 9]]
	for ki in kinds.size():
		var h0: float = kinds[ki][0]
		var xs: Array[Transform3D] = []
		var n := int(kinds[ki][1])
		var tries := 0
		while n > 0 and tries < 3000:
			tries += 1
			var p := Vector3(rng.randf_range(-SIZE * 0.47, SIZE * 0.47), 0, rng.randf_range(-SIZE * 0.47, SIZE * 0.47))
			var hp2 := p - HOUSE_AT
			if hp2.x > YARD[0] - 2.5 and hp2.x < YARD[2] + 2.5 and hp2.z > YARD[1] - 2.5 and hp2.z < YARD[3] + 2.5:
				continue
			if _trail_dist(p) < 3.2 or p.distance_to(Vector3(0, 0, 6)) < 6.0:
				continue
			var near := false
			for q in placed:
				if q.distance_to(p) < 3.4:
					near = true
					break
			if near:
				continue
			placed.append(p)
			n -= 1
			var sc := rng.randf_range(0.85, 1.15)
			xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * sc), p))
			_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * h0 * sc * 0.78), p + Vector3.UP * 0.03))
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.22 * sc
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _spruce_mesh(h0, 100 + ki)
		mm.instance_count = xs.size()
		for i in xs.size():
			mm.set_instance_transform(i, xs[i])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)


func _box(size: Vector3) -> BoxMesh:
	var bm := BoxMesh.new()
	bm.size = size
	return bm


func _multi(xs: Array[Transform3D], mesh: Mesh, mat: Material, colors: Array[Color] = []) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = not colors.is_empty()
	mm.mesh = mesh
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
		if not colors.is_empty():
			mm.set_instance_color(i, colors[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	add_child(mi)
	return mi


var _blobs: Array[Transform3D] = []


func _flora() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2611
	var placed: Array[Vector3] = []
	var body := StaticBody3D.new()
	body.name = "Trees"
	add_child(body)
	_spruces(body, placed, rng)
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
			if p.distance_to(Vector3(0, 0, 6)) < 4.0 or _trail_dist(p) < 2.4:
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
			_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * h * (0.5 if f[0] != "ul_bush" else 0.9)), p + Vector3.UP * 0.03))
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




## мягкие пятна тени под деревьями и кустами (тени от солнца выключены ради скорости)
func _blob_tex() -> Texture2D:
	var g := Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0.5))
	g.set_color(1, Color(0, 0, 0, 0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64
	gt.height = 64
	return gt


func _blob_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = _blob_tex()
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return m


func _blob_layer() -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	var mi := _multi(_blobs, pm, _blob_mat())
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


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
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.1, 1.1)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	player.add_child(blob)
	snd = BCSound.new()
	add_child(snd)
	rig.hold.sfx.connect(_on_sfx)
	player.position = Vector3(0, 0.1, 3)
	player.rotation.y = PI                       # лицом к дому
	cam = Camera3D.new()
	cam.fov = 38
	cam.near = 0.3
	cam.far = 120
	add_child(cam)
	cam.current = true
	_cam_t = player.position


func _input_vec() -> Vector2:
	var v := _joy_v
	var k := Vector2.ZERO
	for key in [[KEY_W, Vector2(0, -1)], [KEY_S, Vector2(0, 1)], [KEY_A, Vector2(-1, 0)], [KEY_D, Vector2(1, 0)]]:
		if Input.is_physical_key_pressed(key[0]):
			k += key[1]
	if k.length() > 0.01:
		v = k.normalized() * (1.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 0.6)
	if not _auto.is_empty():
		v = _auto_vec()
	if inv_ui and inv_ui.visible:
		v = Vector2.ZERO
	return v


func _process(delta: float) -> void:
	var iv := _input_vec()
	# «вверх» на джойстике — от камеры вперёд (на север)
	var fwd := Vector3(-sin(CAM_YAW), 0, -cos(CAM_YAW))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dir := right * iv.x - fwd * iv.y
	var mag := clampf(iv.length(), 0.0, 1.0)
	# слегка отклонить — лёгкий бег, сильнее — быстрее, до полного бега
	var speed := 0.0
	if mag > 0.12:
		speed = lerpf(2.0, 4.2, clampf((mag - 0.12) / 0.8, 0.0, 1.0))
	# энергия: быстрый бег тратит её; выдохся — только лёгкий бег, пока не отдышится
	if speed > 3.3 and not _tired:
		en = maxf(0.0, en - 5.0 * delta)
		if en <= 0.0:
			_tired = true
	elif water > 0.0:
		en = minf(100.0, en + (9.0 if speed < 0.2 else 5.0) * delta)
	if _tired:
		speed = minf(speed, 2.4)
		if en >= 25.0:
			_tired = false
	water = maxf(0.0, water - delta * 0.04)
	var want := dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	var hv := Vector3(player.velocity.x, 0, player.velocity.z)
	hv = hv.move_toward(want, delta * (14.0 if want.length() > hv.length() else 10.0))
	player.velocity = Vector3(hv.x, player.velocity.y - 9.8 * delta, hv.z)
	player.move_and_slide()
	if player.is_on_floor():
		player.velocity.y = 0.0
	var real := Vector3(player.velocity.x, 0, player.velocity.z).length()
	if real > 0.2 and is_nan(_face) and _aim_t > 0.6:
		var yaw := atan2(hv.x, hv.z)
		player.rotation.y = lerp_angle(player.rotation.y, yaw, 1.0 - exp(-delta * 10.0))
	rig.set_motion(real, 0.0, delta)
	_body_pose(real)
	_steps_sfx(real)
	# в доме: дом Tripo и крыша скрыты, видны комнаты, передние стены опущены
	var ins := house.contains(player.global_position)
	if ins != house.inside:
		house.set_inside(ins)
	house.update_walls(player.global_position, delta)
	var dist_t := minf(cam_dist, 13.0) if ins else cam_dist
	_cam_t = _cam_t.lerp(player.global_position, 1.0 - exp(-delta * 8.0))
	var cp := Vector3(sin(CAM_YAW) * cos(CAM_PITCH), sin(CAM_PITCH), cos(CAM_YAW) * cos(CAM_PITCH)) * dist_t
	var look := _cam_t + Vector3.UP * 0.8
	cam.global_position = cam.global_position.lerp(look + cp, 1.0 - exp(-delta * 6.0)) if _cam_ready else look + cp
	_cam_ready = true
	cam.look_at(look, Vector3.UP)
	_find_target()
	_combat_tick(delta)
	if info and Engine.get_process_frames() % 10 == 0:
		info.text = "%s · %d кадров/с" % [_where(), Engine.get_frames_per_second()]
	if _hud:
		_hud.queue_redraw()
	for lb in house.labels:
		lb.basis = Basis(Vector3.UP, CAM_YAW) * Basis(Vector3.RIGHT, -PI * 0.5)
	if _toast_t > 0.0:
		_toast_t -= delta
		_toast.modulate.a = clampf(_toast_t, 0.0, 1.0)
	if _preview_rig and inv_ui.visible and _preview_rig.hold.wid != "":
		_preview_rig.set_motion(0.0, 0.0, delta)


var _cam_ready := false
var _pose_now := "?"


## стойка: с оружием в руках — стойка стрелка, иначе обычная; на ходу — клипы передвижения
func _body_pose(speed: float) -> void:
	var want := ""
	if speed < 0.2 and rig.hold.wid != "" and rig.hold.drawn > 0.5:
		want = "combat_idle" if String(rig.hold.w.get("mode", "")) == "melee" else "armed_idle"
	if want != _pose_now:
		_pose_now = want
		rig.set_pose(want)


func _where() -> String:
	if not house.contains(player.global_position):
		return "кластер, двор" if _in_yard(player.global_position) else "кластер, улица"
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


func _in_yard(p: Vector3) -> bool:
	var h := p - HOUSE_AT
	return h.x > YARD[0] and h.x < YARD[2] and h.z > YARD[1] and h.z < YARD[3]


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


## звуки механики оружия: достать, убрать, перезарядка по шагам
func _on_sfx(n: String, at: Vector3) -> void:
	var p := rig.skel.global_transform * at
	var w: Dictionary = rig.hold.w
	var pistol := String(w.get("mode", "")) == "pistol"
	var box := String(w.get("reload", {}).get("kind", "")) == "box"
	match n:
		"grab", "pouch":
			snd.play("cloth", p, -8.0)
		"draw_out", "holster":
			snd.play("click" if pistol else "cloth", p, -9.0)
		"mag_out":
			snd.play("click", p, -6.0)
			snd.play("mag_out", p, -3.0 if not pistol else -7.0, 0.05, 0.03)
		"mag_in":
			snd.play("box_in" if box else "mag_in", p, -2.0)
		"mag_slap":
			snd.play("click", p, -8.0)
		"bolt_back":
			snd.play("slide_back" if pistol else "bolt_back", p, -2.0)
			if not rig.hold.parts or not rig.hold.parts.has("mag"):
				snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0, 0.05, 0.22)
		"bolt_fwd":
			snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0)
		"cover_open":
			snd.play("cover_open", p, -3.0)
		"cover_close":
			snd.play("cover_close", p, -3.0)
		"mag_drop":
			snd.play("mag_drop", p, -5.0, 0.1)
		"shell_in":
			snd.play("shell_in", p, -3.0)
		"pump":
			snd.play("pump", p, -2.0)


# ---------------- снаряжение на герое ----------------

## надетый рюкзак и оружие в руках — на героя (и на героя в окне инвентаря)
func _apply_gear() -> void:
	var pid := String(ULItems.get_def(String(inv.pack.id)).pack) if inv.pack != null else ""
	if pid != _pack_shown:
		_pack_shown = pid
		_wear(rig, pid)
	var wid := _hand_weapon()
	if wid != rig.hold.wid:
		if wid == "":
			rig.hold.put_away()
			get_tree().create_timer(1.0).timeout.connect(func():
				if _hand_weapon() == "" and rig.hold.wid != "":
					rig.hold.equip(""))
		else:
			rig.hold.equip(wid, false)
			rig.hold.set_stance("ready")
			rig.hold.draw()
	_update_preview()


func _hand_weapon() -> String:
	if inv.hand == "":
		return ""
	var it = inv.get(inv.hand)
	return String(ULItems.get_def(String(it.id)).weapon) if it != null else ""


func _wear(r: BCCharacter, pid: String) -> void:
	for c in r.skel.get_children():
		if c.name == "Pack":
			c.queue_free()
	if pid == "":
		return
	var mi := BCPackFit.build(r, BCPackFit.PACKS[pid])
	r.skel.add_child(mi)
	mi.skeleton = mi.get_path_to(r.skel)


## кнопка «Оружие»: основное → пистолет → убрать (только то, что есть в слотах)
func cycle_weapon() -> void:
	var order := []
	if inv.primary != null:
		order.append("primary")
	if inv.pistol != null:
		order.append("pistol")
	order.append("")
	var i := order.find(inv.hand)
	inv.hand = order[(i + 1) % order.size()]
	_reloading = false
	if inv.hand == "" and order.size() == 1:
		say("Нет оружия в слотах")
	_apply_gear()
	_save()


# ---------------- герой в окне инвентаря ----------------

func _make_preview() -> void:
	_preview_vp = SubViewport.new()
	_preview_vp.size = Vector2i(400, 580)
	_preview_vp.own_world_3d = true
	_preview_vp.transparent_bg = true
	_preview_vp.msaa_3d = Viewport.MSAA_4X
	_preview_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_preview_vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.8, 0.9)
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = 1.1
	env.environment = e
	_preview_vp.add_child(env)
	for r in [[Vector3(-30, -30, 0), 1.2], [Vector3(-15, 150, 0), 0.7]]:
		var l := DirectionalLight3D.new()
		l.rotation_degrees = r[0]
		l.light_energy = r[1]
		_preview_vp.add_child(l)
	var stand := Node3D.new()
	_preview_vp.add_child(stand)
	_preview_rig = BCCharacter.new()
	stand.add_child(_preview_rig)
	_preview_rig.setup("res://assets/models/hero.glb", "res://assets/anim/hero")
	_preview_rig.rotation.y = -0.35
	# пол: тёмный круг
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.55
	cm.height = 0.02
	disc.mesh = cm
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(0.12, 0.15, 0.18)
	disc.material_override = dm
	stand.add_child(disc)
	var c := Camera3D.new()
	c.fov = 28
	c.position = Vector3(0, 1.0, 4.3)
	_preview_vp.add_child(c)
	c.look_at(Vector3(0, 0.9, 0), Vector3.UP)
	c.current = true


func _update_preview() -> void:
	if _preview_rig == null:
		return
	var pid := String(ULItems.get_def(String(inv.pack.id)).pack) if inv.pack != null else ""
	if pid != _preview_pack:
		_preview_pack = pid
		_wear(_preview_rig, pid)
	var wid := _hand_weapon()
	if wid != _preview_rig.hold.wid:
		_preview_rig.hold.equip(wid, true)
		if wid != "":
			_preview_rig.hold.set_stance("ready")
	_preview_rig.set_pose("armed_idle" if wid != "" else "")


func _preview_on(on: bool) -> void:
	if _preview_vp == null:
		return
	_preview_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	_preview_vp.get_child(0).get_parent().process_mode = Node.PROCESS_MODE_INHERIT if on else Node.PROCESS_MODE_DISABLED


# ---------------- инвентарь ----------------

func open_inventory(container = null, title := "", is_pack := false, icon := "crate") -> void:
	if _preview_vp == null:
		_make_preview()
	_preview_on(true)
	_update_preview()
	inv_ui.preview_tex = _preview_vp.get_texture()
	inv_ui.stats = {"hp": hp, "en": en, "water": water}
	inv_ui.open(inv, container, title, is_pack, icon)
	_hud.visible = false
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()
	_touch.clear()
	snd.play("zip", player.global_position + Vector3.UP * 1.2, -12.0)


func close_inventory() -> void:
	inv_ui.visible = false
	_hud.visible = true
	_open_ground = null
	_preview_on(false)
	_sync_ground_visuals()
	_save()


func _on_inv_changed() -> void:
	_apply_gear()
	_sync_ground_visuals()
	_save()


## выбросить на землю перед героем (по кругу, чтобы предметы не ложились друг на друга)
func _on_drop(it: Dictionary) -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 0.9
	var n := 0
	for g in ground:
		if (g.node as Node3D).global_position.distance_to(p) < 0.5:
			n += 1
	if n > 0:
		p += Vector3(cos(n * 2.4), 0, sin(n * 2.4)) * (0.35 + 0.1 * n)
	_spawn_ground(it, p, player.rotation.y + randf_range(-0.6, 0.6))
	snd.play("cloth", p, -6.0)
	_apply_gear()


func _on_wear_ground_pack() -> void:
	if _open_ground == null:
		return
	var g: Dictionary = _open_ground
	if inv.pack != null:
		# надетый рюкзак ложится на место того, что надеваем (вещи остаются в нём)
		_spawn_ground(inv.pack, (g.node as Node3D).global_position + Vector3(0.6, 0, 0), randf() * TAU)
	inv.pack = g.item
	_remove_ground(g)
	snd.play("zip", player.global_position + Vector3.UP * 1.2, -6.0)
	_apply_gear()
	_save()
	inv_ui.open(inv)


# ---------------- предметы на земле ----------------

func _spawn_ground(it: Dictionary, p: Vector3, yaw: float) -> Dictionary:
	var node := Node3D.new()
	node.name = "Item"
	add_child(node)
	node.global_position = Vector3(p.x, ULHouse.FLOOR_Y if house.contains(p) else 0.0, p.z)
	node.rotation.y = yaw
	var g := {"item": it, "node": node}
	ground.append(g)
	_ground_visual(g)
	return g


func _ground_visual(g: Dictionary) -> void:
	var node: Node3D = g.node
	for c in node.get_children():
		c.queue_free()
	var it: Dictionary = g.item
	var d := ULItems.get_def(String(it.id))
	var k := String(d.kind)
	if d.has("weapon"):
		var w: Dictionary = BCWeaponHold.config()[d.weapon]
		var m: Node3D = (load(String(w.model)) as PackedScene).instantiate()
		var s := float(w.len_m) / float(w.model_len)
		var holder := Node3D.new()
		node.add_child(holder)
		holder.add_child(m)
		if w.get("flip", false):
			m.rotation.y = PI
		# лежит на боку: верх модели (+y) — вбок
		holder.basis = Basis(Vector3.FORWARD, PI * 0.5).scaled(Vector3.ONE * s)
		holder.position.y = 0.03
	elif k == "pack":
		var pk: Dictionary = BCPackFit.PACKS[d.pack]
		var m: Node3D = (load(String(pk.model)) as PackedScene).instantiate()
		var s := float(pk.h) / 0.98 * 0.9
		m.scale = Vector3.ONE * s
		m.rotation.x = -0.25 if String(pk.back) == "-z" else 0.0
		m.rotation.z = 0.0 if String(pk.back) == "-z" else 0.25
		node.add_child(m)
	elif ULItems.kit_mesh(String(it.id)) != null:
		# предмет из набора припасов — своя модель, чуть наклонена, повёрнута как упала
		var km := MeshInstance3D.new()
		km.mesh = ULItems.kit_mesh(String(it.id))
		var kb := km.mesh.get_aabb()
		var ks := float(d.get("gs", 0.25)) / maxf(kb.size.x, maxf(kb.size.y, kb.size.z))
		km.scale = Vector3.ONE * ks
		km.rotation.y = fposmod(node.global_position.x * 7.3 + node.global_position.z * 3.1, TAU)
		node.add_child(km)
	else:
		# мелкий предмет — иконка на земле, лицом к камере
		var sp := Sprite3D.new()
		sp.texture = ULItems.icon(String(it.id))
		sp.modulate = ULItems.tint(String(it.id))
		sp.pixel_size = 0.0016
		sp.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		sp.position.y = 0.2
		sp.shaded = false
		node.add_child(sp)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.9, 0.9)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.02
	node.add_child(blob)


func _remove_ground(g: Dictionary) -> void:
	if _glow_node == g.node:
		_glow_node = null
	ground.erase(g)
	(g.node as Node3D).queue_free()


func _sync_ground_visuals() -> void:
	# рюкзак на земле, из которого всё вынули и забрали сам предмет — убрать пустые записи
	for g in ground.duplicate():
		if g.item == null:
			_remove_ground(g)


# ---------------- ящики (хранилища) ----------------

func place_crate() -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 1.0
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 0.4, p + Vector3.UP * 0.4)
	q.exclude = [player.get_rid()]
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		p = player.global_position + f * maxf(0.0, player.global_position.distance_to(hit.position) - 0.45)
	var cells := []
	cells.resize(CRATE_SLOTS)
	_add_crate(p, player.rotation.y, cells)
	snd.play("hit_wood", p, -8.0, 0.1, 0.15)
	_save()


func _add_crate(p: Vector3, yaw: float, cells: Array) -> void:
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
	body.position = Vector3(p.x, ULHouse.FLOOR_Y if house.contains(p) else 0.0, p.z)
	body.rotation.y = yaw
	body.set_meta("items", cells)
	body.set_meta("size", size)
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
		# вещи из ящика — на землю рядом
		var k := 0
		for it in best.get_meta("items"):
			if it != null:
				_spawn_ground(it, best.global_position + Vector3(cos(k * 1.3), 0, sin(k * 1.3)) * 0.6, randf() * TAU)
				k += 1
		snd.play("cloth", best.global_position, -6.0)
		if _glow_node == best:
			_glow_node = null
		crates.erase(best)
		best.queue_free()
		_save()


# ---------------- действие ----------------

func _find_target() -> void:
	var p := player.global_position
	var best = null
	var bd := 1.6
	for g in ground:
		var d := (g.node as Node3D).global_position.distance_to(p)
		if d < bd:
			bd = d
			best = {"type": "ground", "g": g}
	for c in crates:
		var sz: Vector3 = c.get_meta("size")
		var d := c.global_position.distance_to(p) - maxf(sz.x, sz.z) * 0.4
		if d < bd:
			bd = d
			best = {"type": "crate", "c": c}
	var node: Node3D = null
	if best != null:
		node = best.g.node if best.type == "ground" else best.c
	_target = best
	if node != _glow_node:
		_set_glow(_glow_node, false)
		_set_glow(node, true)
		_glow_node = node
	if _glow_mat:
		# лёгкое «дыхание» подсветки
		_glow_mat.albedo_color.a = 0.16 + 0.1 * sin(Time.get_ticks_msec() * 0.006)


var _glow_node: Node3D = null
var _glow_mat: StandardMaterial3D = null


## подсветить предмет, с которым можно что-то сделать: светлая накладка поверх его материалов
func _set_glow(node: Node3D, on: bool) -> void:
	if node == null or not is_instance_valid(node):
		return
	if _glow_mat == null:
		_glow_mat = StandardMaterial3D.new()
		_glow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_glow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_glow_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_glow_mat.albedo_color = Color(1.0, 0.86, 0.5, 0.2)
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh is PlaneMesh:
			continue                                   # пятно тени не светится
		m.material_overlay = _glow_mat if on else null
	for sp in node.find_children("*", "Sprite3D", true, false):
		var s3 := sp as Sprite3D
		var base: Color = s3.get_meta("tint", s3.modulate)
		s3.set_meta("tint", base)
		s3.modulate = base.lightened(0.35) if on else base
		s3.scale = Vector3.ONE * (1.15 if on else 1.0)


func _target_pos() -> Vector3:
	if _target == null:
		return Vector3.ZERO
	return (_target.g.node as Node3D).global_position if _target.type == "ground" else (_target.c as Node3D).global_position + Vector3.UP * 0.3


func _target_name() -> String:
	if _target == null:
		return ""
	if _target.type == "crate":
		return "ящик"
	return ULItems.title(_target.g.item)


func _action_label() -> String:
	if _target == null:
		return ""
	if _target.type == "crate":
		return "Открыть"
	var it: Dictionary = _target.g.item
	return "Открыть" if ULItems.kind(it) == "pack" else "Взять"


func do_action() -> void:
	if _target == null:
		return
	if _target.type == "crate":
		open_inventory(_target.c.get_meta("items"), "Ящик", false, "crate")
		snd.play("hit_wood", (_target.c as Node3D).global_position, -10.0)
		return
	var g: Dictionary = _target.g
	var it: Dictionary = g.item
	if ULItems.kind(it) == "pack":
		_open_ground = g
		open_inventory(it.items, ULItems.get_def(String(it.id)).n, true, String(it.id))
		return
	var n0 := int(it.n)
	var left := inv.add(it)
	if left == n0:
		say("Нет места")
		return
	snd.play("cloth", (g.node as Node3D).global_position, -6.0)
	if left == 0:
		_remove_ground(g)
		say("Подобрано: " + ULItems.get_def(String(it.id)).n)
	else:
		say("Взято не всё — нет места")
	# оружие легло в пустой слот и в руках ничего — сразу в руки
	var sl := ULItems.slot_of(it)
	if inv.hand == "" and sl in ["pistol", "primary"] and inv.get(sl) == it:
		inv.hand = sl
	_apply_gear()
	_save()


func say(t: String) -> void:
	_toast.text = t
	_toast_t = 2.2
	_toast.modulate.a = 1.0


# ---------------- сохранение ----------------

func _save() -> void:
	var cr := []
	for c in crates:
		cr.append([snappedf(c.position.x, 0.01), snappedf(c.position.z, 0.01), snappedf(c.rotation.y, 0.01), c.get_meta("items")])
	var gr := []
	for g in ground:
		var n: Node3D = g.node
		gr.append([g.item, snappedf(n.global_position.x, 0.01), snappedf(n.global_position.z, 0.01), snappedf(n.rotation.y, 0.01)])
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f and test == "":
		f.store_string(JSON.stringify({"v": SAVE_V, "crates": cr, "ground": gr, "inv": inv.to_dict(), "hp": hp, "en": en, "water": water}))


func _load() -> void:
	var d = null
	if FileAccess.file_exists(SAVE) and test == "":
		d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if d is Dictionary and int(d.get("v", 1)) >= SAVE_V:
		for c in d.get("crates", []):
			var cells: Array = c[3] if c.size() > 3 else []
			cells.resize(CRATE_SLOTS)
			for i in cells.size():
				cells[i] = ULInventory._fix(cells[i])
			_add_crate(Vector3(float(c[0]), 0, float(c[1])), float(c[2]), cells)
		for g in d.get("ground", []):
			var it = ULInventory._fix(g[0])
			if it != null:
				_spawn_ground(it, Vector3(float(g[1]), 0, float(g[2])), float(g[3]))
		inv.from_dict(d.get("inv", {}))
		hp = clampf(float(d.get("hp", 65.0)), 1.0, HP_MAX)
		en = clampf(float(d.get("en", 100.0)), 0.0, 100.0)
		water = clampf(float(d.get("water", 100.0)), 0.0, 100.0)
		return
	_start_loot()


## первый запуск: два ящика у стены кладовой с оружием и патронами, в доме и во дворе — рюкзаки и оружие,
## в карманах — бинты, вода, тушёнка
func _start_loot() -> void:
	var I := ULItems
	var a := []
	a.resize(CRATE_SLOTS)
	ULInventory.put(a, I.make("tt"))
	ULInventory.put(a, I.make("a762x25", 32))
	ULInventory.put(a, I.make("ak74m"))
	ULInventory.put(a, I.make("a545", 60))
	var b := []
	b.resize(CRATE_SLOTS)
	ULInventory.put(b, I.make("svd"))
	ULInventory.put(b, I.make("a762x54", 30))
	ULInventory.put(b, I.make("mp5"))
	ULInventory.put(b, I.make("a9x19", 45))
	ULInventory.put(b, I.make("medkit"))
	var g1 := house.to_global(Vector3(5.47, 0, 2.2))
	var g2 := house.to_global(Vector3(5.47, 0, 3.3))
	_add_crate(g1, 0.0, a)
	_add_crate(g2, 0.0, b)
	var H := house
	_spawn_ground(I.make("pack_small"), Vector3(1.6, 0, 1.4), 0.4)
	_spawn_ground(I.make("pack_medium"), H.to_global(Vector3(-3.4, 0, -2.6)), 1.1)
	_spawn_ground(I.make("pack_large"), H.to_global(Vector3(3.4, 0, -3.6)), -0.5)
	_spawn_ground(I.make("beretta"), H.to_global(Vector3(-4.2, 0, 3.6)), 0.7)
	_spawn_ground(I.make("a9x19", 30), H.to_global(Vector3(-3.6, 0, 4.0)), 0.0)
	_spawn_ground(I.make("pkp"), H.to_global(Vector3(4.5, 0, -1.0)), 1.9)
	_spawn_ground(I.make("fnfal"), H.to_global(Vector3(-1.5, 0, -3.8)), 0.2)
	_spawn_ground(I.make("vss"), H.to_global(Vector3(-0.6, 0, -4.2)), -0.3)
	_spawn_ground(I.make("spas12"), HOUSE_AT + Vector3(-ULHouse.W * 0.5 - 2.6, 0, 2.2), 2.4)
	_spawn_ground(I.make("a12", 16), HOUSE_AT + Vector3(-ULHouse.W * 0.5 - 2.0, 0, 2.8), 0.0)
	_spawn_ground(I.make("rusk", 2), H.to_global(Vector3(-2.5, 0, 2.2)), 0.0)
	_spawn_ground(I.make("tonic", 2), H.to_global(Vector3(-4.6, 0, 2.3)), 0.0)
	_spawn_ground(I.make("medkit"), H.to_global(Vector3(4.6, 0, -3.0)), 0.0)
	_spawn_ground(I.make("a762x51", 40), H.to_global(Vector3(-1.0, 0, -3.3)), 0.0)
	_spawn_ground(I.make("a9x39", 20), H.to_global(Vector3(-0.2, 0, -3.7)), 0.0)
	_spawn_ground(I.make("can", 2), H.to_global(Vector3(-3.0, 0, 4.4)), 0.0)
	_spawn_ground(I.make("machete"), H.to_global(Vector3(-0.9, 0, 4.2)), 1.2)
	_spawn_ground(I.make("a762x51", 40), H.to_global(Vector3(-2.1, 0, -3.4)), 0.0)
	_spawn_ground(I.make("a9x39", 30), H.to_global(Vector3(-0.2, 0, -3.6)), 0.0)
	_spawn_ground(I.make("a762x54", 100), H.to_global(Vector3(4.0, 0, -0.4)), 0.0)
	ULInventory.put(inv.pockets, I.make("bandage", 3))
	ULInventory.put(inv.pockets, I.make("water"))
	ULInventory.put(inv.pockets, I.make("can"))


# ---------------- интерфейс и касания ----------------

func _style(bg := C_BG) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = C_LINE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(4)
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	return sb


func _btn(text: String, cb: Callable, w := 110.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 44)
	b.add_theme_font_size_override("font_size", 15)
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
	_hud = Control.new()
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.draw.connect(_draw_hud)
	ui.add_child(_hud)
	_hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	info = Label.new()
	info.position = Vector2(16, 84)
	info.add_theme_font_size_override("font_size", 15)
	info.add_theme_color_override("font_color", Color(1.0, 0.82, 0.4))
	info.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	info.add_theme_constant_override("outline_size", 6)
	_hud.add_child(info)
	# кнопки проверки — мелкие, сверху справа
	var bar := HBoxContainer.new()
	bar.anchor_left = 1.0
	bar.anchor_right = 1.0
	bar.offset_left = -360
	bar.offset_right = -12
	bar.offset_top = 98
	bar.alignment = BoxContainer.ALIGNMENT_END
	bar.add_theme_constant_override("separation", 6)
	bar.visible = false
	_menu_bar = bar
	_hud.add_child(bar)
	bar.add_child(_btn("Убрать ящик", remove_crate, 130))
	bar.add_child(_btn("Стенд", func(): get_tree().change_scene_to_file("res://stand.tscn")))
	_toast = Label.new()
	ui.add_child(_toast)
	_toast.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_toast.offset_top = 70
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_font_size_override("font_size", 20)
	_toast.add_theme_color_override("font_color", Color(1.0, 0.85, 0.45))
	_toast.add_theme_color_override("font_outline_color", Color.BLACK)
	_toast.add_theme_constant_override("outline_size", 6)
	inv_ui = ULInventoryUI.new()
	inv_ui.visible = false
	ui.add_child(inv_ui)
	inv_ui.closed.connect(close_inventory)
	inv_ui.changed.connect(_on_inv_changed)
	inv_ui.drop.connect(_on_drop)
	inv_ui.wear_ground_pack.connect(_on_wear_ground_pack)
	inv_ui.use.connect(func(id: String):
		heal(id)
		inv_ui.stats = {"hp": hp, "en": en, "water": water})
	inv_ui.preview_rot = func(dx: float):
		if _preview_rig:
			_preview_rig.rotation.y += dx * 0.01


## Круглые кнопки справа снизу: [центр от правого нижнего угла, радиус]. fire — большая кнопка атаки (огонь,
## удар мачете, кулаки — смотря что в руках); swap — смена оружия; take — взять предмет / открыть ящик;
## heal — лечение; reload — перезарядка; inv — инвентарь.
const HUD_BTNS := {
	"fire": [Vector2(-132, -140), 76.0],
	"swap": [Vector2(-132, -306), 46.0],
	"take": [Vector2(-292, -96), 48.0],
	"heal": [Vector2(-282, -226), 42.0],
	"reload": [Vector2(-246, -338), 34.0],
	"inv": [Vector2(-416, -72), 42.0],
	# сверху справа (отсчёт от правого верхнего угла): постройка (поставить ящик) и меню
	"build": [Vector2(-140, 52), 36.0, "top"],
	"menu": [Vector2(-54, 52), 36.0, "top"],
}
var _hud_tex := {}
var _menu_bar: HBoxContainer


func _glyph(n: String) -> Texture2D:
	if not _hud_tex.has(n):
		_hud_tex[n] = load("res://assets/icons/hud_%s.png" % n)
	return _hud_tex[n]


func _stat_tex(n: String) -> Texture2D:
	if not _hud_tex.has(n):
		_hud_tex[n] = load("res://assets/icons/%s.png" % n)
	return _hud_tex[n]


func _hud_pos(k: String) -> Vector2:
	var vs := get_viewport().get_visible_rect().size
	var b: Array = HUD_BTNS[k]
	if b.size() > 2:
		return Vector2(vs.x, 0) + (b[0] as Vector2)
	return vs + (b[0] as Vector2)


## значок кнопки из набора пользователя (assets/icons/ui): круглая картинка во всю кнопку
func _art(n: String) -> Texture2D:
	var key := "ui/" + n
	if not _hud_tex.has(key):
		_hud_tex[key] = load("res://assets/icons/ui/%s.png" % n)
	return _hud_tex[key]


func _hud_text(c: Vector2, t: String, fs: int, col := Color(0.95, 0.97, 1.0)) -> void:
	var font := ThemeDB.fallback_font
	var sz := font.get_string_size(t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs)
	_hud.draw_string_outline(font, c + Vector2(-sz.x * 0.5, fs * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, 5, Color(0, 0, 0, 0.85))
	_hud.draw_string(font, c + Vector2(-sz.x * 0.5, fs * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, col)


func _hud_icon(tex: Texture2D, c: Vector2, size: float, col := Color.WHITE) -> void:
	if tex:
		_hud.draw_texture_rect(tex, Rect2(c - Vector2.ONE * size * 0.5, Vector2.ONE * size), false, col)


func _draw_hud() -> void:
	var vs := get_viewport().get_visible_rect().size
	# шапка: имя, здоровье, энергия, вода
	var font0 := ThemeDB.fallback_font
	_hud.draw_string_outline(font0, Vector2(18, 30), "Сталкер", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, 6, Color(0, 0, 0, 0.85))
	_hud.draw_string(font0, Vector2(18, 30), "Сталкер", HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(0.95, 0.97, 1.0))
	var bw := 280.0
	_hud.draw_rect(Rect2(16, 40, bw, 10), Color(0, 0, 0, 0.6))
	_hud.draw_rect(Rect2(17, 41, (bw - 2) * clampf(hp / HP_MAX, 0.0, 1.0), 8), Color(0.85, 0.25, 0.22) if hp < 35.0 else Color(0.35, 0.8, 0.3))
	_hud_text(Vector2(16 + bw - 20, 24), "%d" % int(round(hp)), 18, Color(0.75, 1.0, 0.7))
	var sx := 22.0
	for st in [["stat_en", en, Color(1.0, 0.85, 0.35)], ["stat_water", water, Color(0.45, 0.75, 1.0)]]:
		_hud_icon(_stat_tex(st[0]), Vector2(sx + 8, 68), 20, st[2])
		_hud_text(Vector2(sx + 40, 68), "%d" % int(round(float(st[1]))), 15)
		sx += 84.0
	# джойстик
	var jc := _joy_o if _joy_id >= 0 else Vector2(160, vs.y - 160)
	_hud.draw_circle(jc, 92, Color(1, 1, 1, 0.07))
	_hud.draw_arc(jc, 92, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.45), 2.5)
	_hud.draw_circle(jc + _joy_v * 92, 36, Color(0.6, 0.85, 1.0, 0.5 if _joy_id >= 0 else 0.25))
	var it = inv.get(inv.hand) if inv.hand != "" else null
	var d := ULItems.get_def(String(it.id)) if it != null else {}
	for k in HUD_BTNS:
		var c := _hud_pos(k)
		var r: float = HUD_BTNS[k][1]
		var on: bool = _hud_touch.values().has(k)
		var active := true
		match k:
			"take":
				active = _target != null
			"heal":
				active = hp < HP_MAX and inv.best_heal(int(HP_MAX - hp)) != ""
			"reload":
				active = it != null and d.has("ammo") and int(it.get("mag", 0)) < int(d.mag) and inv.count(String(d.ammo)) > 0
				if it == null or not d.has("ammo"):
					continue                               # без огнестрела кнопки перезарядки нет
		var line := Color(1.0, 0.8, 0.3, 0.95) if (k == "take" and active) else (Color(1.0, 0.5, 0.4, 0.9) if k == "fire" else Color(0.6, 0.85, 1.0, 0.65 if active else 0.25))
		_hud.draw_circle(c, r, Color(0.14, 0.32, 0.42, 0.8) if on else Color(0.05, 0.07, 0.09, 0.55 if active else 0.3))
		_hud.draw_arc(c, r, 0, TAU, 44, line, 3.0 if k == "fire" else 2.5)
		var ic := Color(1, 1, 1, 1.0 if active else 0.4)
		match k:
			"fire":
				var g := "fist"
				if it != null:
					g = "weapon" if String(d.kind) == "melee" else "aim"
				_hud_icon(_art(g), c, r * 2.0, ic)
				if it != null and d.has("ammo"):
					var mag := int(it.get("mag", 0))
					_hud_text(c + Vector2(0, r - 16), "%d / %d" % [mag, inv.count(String(d.ammo))], 16, Color(1.0, 0.45, 0.35) if mag == 0 else Color(1.0, 0.9, 0.6))
			"swap":
				# оружие в руках (или нож из набора, если руки пусты) и стрелки смены
				if it != null:
					_hud_icon(ULItems.icon(String(it.id)), c, r * 1.5)
				else:
					_hud_icon(_art("weapon"), c, r * 2.0, Color(1, 1, 1, 0.75))
				_hud_icon(_glyph("swap"), c + Vector2(r * 0.66, -r * 0.66), 30, Color(1.0, 0.85, 0.4))
			"take":
				_hud_icon(_art("use"), c, r * 2.0, ic)
				if active:
					_hud_text(c + Vector2(0, r - 10), _action_label(), 14, Color(1.0, 0.88, 0.55))
			"heal":
				_hud_icon(_art("heal"), c, r * 2.0, ic)
				var n := inv.count("bandage") + inv.count("medkit")
				_hud_text(c + Vector2(r * 0.72, r * 0.72), str(n), 15)
			"reload":
				_hud_icon(_glyph("reload"), c, 36, ic)
			"inv":
				_hud_icon(_art("bag"), c, r * 2.0, ic)
			"build":
				_hud_icon(_art("build"), c, r * 2.0, ic)
			"menu":
				_hud_icon(_art("menu"), c, r * 2.0, ic)
		_hud.draw_arc(c, r, 0, TAU, 44, line, 3.0 if k == "fire" else 2.5)
	# название того, что можно взять, — над кнопкой «взять»
	if _target != null:
		_hud_text(_hud_pos("take") + Vector2(0, -66), _target_name(), 14, Color(1.0, 0.88, 0.55))


func _hud_hit(p: Vector2) -> String:
	for k in HUD_BTNS:
		if p.distance_to(_hud_pos(k)) <= float(HUD_BTNS[k][1]) + 8.0:
			return k
	# нажатие прямо на подсвеченный предмет — «взять»
	if _target != null and cam != null:
		var at: Vector3 = _target_pos() + Vector3.UP * 0.3
		var xf := get_viewport().get_final_transform()
		if not cam.is_position_behind(at) and cam.unproject_position(at).distance_to(xf * p) <= 70.0 * xf.get_scale().x:
			return "take"
	return ""


func _hud_press(k: String) -> void:
	match k:
		"fire":
			attack()
		"take":
			do_action()
		"inv":
			open_inventory()
		"swap":
			cycle_weapon()
		"heal":
			heal()
		"reload":
			reload_weapon()
		"build":
			place_crate()
			say("Поставлен ящик")
		"menu":
			_menu_bar.visible = not _menu_bar.visible


## касания: кнопки справа (каждый палец отдельно — можно бежать и стрелять), джойстик слева, два пальца — масштаб
func _input(e: InputEvent) -> void:
	if inv_ui and inv_ui.visible:
		return
	var vs := get_viewport().get_visible_rect().size
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			var k := _hud_hit(t.position)
			if k != "":
				_hud_touch[t.index] = k
				_hud_press(k)
				get_viewport().set_input_as_handled()
				return
			_touch[t.index] = t.position
			if t.position.x < vs.x * 0.5 and _joy_id < 0:
				_joy_id = t.index
				_joy_o = t.position
				_joy_v = Vector2.ZERO
		else:
			_hud_touch.erase(t.index)
			_touch.erase(t.index)
			if t.index == _joy_id:
				_joy_id = -1
				_joy_v = Vector2.ZERO
			_pinch = 0.0
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		if _hud_touch.has(d.index):
			return
		_touch[d.index] = d.position
		if d.index == _joy_id:
			_joy_v = ((d.position - _joy_o) / 92.0).limit_length(1.0)
		elif _touch.size() >= 2 and _joy_id < 0:
			var ks := _touch.keys()
			var dd := (_touch[ks[0]] as Vector2).distance_to(_touch[ks[1]])
			if _pinch > 0.0:
				cam_dist = clampf(cam_dist * _pinch / dd, 10.0, 22.0)
			_pinch = dd
	elif e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(10.0, cam_dist * 0.92)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(22.0, cam_dist * 1.08)
	elif e is InputEventKey and (e as InputEventKey).pressed and not (e as InputEventKey).echo:
		match (e as InputEventKey).physical_keycode:
			KEY_E:
				do_action()
			KEY_I, KEY_TAB:
				open_inventory()
			KEY_Q:
				cycle_weapon()
			KEY_R:
				reload_weapon()
			KEY_H:
				heal()
			KEY_SPACE:
				attack()


# ---------------- бой: огонь, мачете, кулаки ----------------

const HP_MAX := 100.0
var hp := 65.0
var en := 100.0                   ## энергия: тратится на быстром беге, восстанавливается на шаге и стоя
var water := 100.0                ## вода: медленно убывает, восполняется питьём; без воды энергия не восстанавливается
var _tired := false
var targets: Array = []           ## мишени-чучела: StaticBody3D с meta hp
var _atk_cd := 0.0
var _aim_t := 99.0
var _punch_i := 0
var _reloading := false
var _heal_cd := 0.0
var _face := NAN                  ## куда довернуть героя (атака по цели)
var _tracer: MeshInstance3D
var _flash: OmniLight3D
var shots := 0                    ## для проверки
var hits := 0


func _hand_item():
	return inv.get(inv.hand) if inv.hand != "" else null


## кнопка атаки: огнестрел — выстрел (очередь, пока держим, у автоматического), мачете — удар, пусто — кулаки
func attack() -> void:
	if _atk_cd > 0.0 or (inv_ui and inv_ui.visible):
		return
	var it = _hand_item()
	if it == null:
		_punch()
		return
	var d := ULItems.get_def(String(it.id))
	if rig.hold.wid == "" or rig.hold.drawn < 0.99:
		return                                             # ещё достаёт
	if String(d.kind) == "melee":
		_slash(d)
		return
	if _reloading or rig.hold.busy():
		return
	if int(it.get("mag", 0)) <= 0:
		if inv.count(String(d.ammo)) > 0:
			reload_weapon()
		else:
			snd.play("dry", player.global_position + Vector3.UP * 1.3, -4.0)
			say("Нет патронов: " + ULItems.get_def(String(d.ammo)).n)
			_atk_cd = 0.4
		return
	_shoot(it, d)


## ближайшая мишень в секторе перед героем (для доворота и попадания)
func _nearest_target(max_d: float, cone_deg: float):
	var best = null
	var bd := max_d
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	for t in targets:
		if float(t.get_meta("hp")) <= 0.0:
			continue
		var v: Vector3 = t.global_position - player.global_position
		v.y = 0
		var dist := v.length()
		if dist < bd and dist > 0.05 and rad_to_deg(f.angle_to(v / dist)) <= cone_deg:
			bd = dist
			best = t
	return best


func _aim_at(t) -> void:
	if t != null:
		var v: Vector3 = t.global_position - player.global_position
		_face = atan2(v.x, v.z)


func _punch() -> void:
	var t = _nearest_target(1.5, 80.0)
	_aim_at(t)
	var heavy := _punch_i % 3 == 2
	_punch_i += 1
	var len_s := rig.play("punch_heavy" if heavy else "punch_light")
	_atk_cd = len_s * 0.85
	var c := player.global_position + Vector3.UP * 1.3
	snd.play("swoosh", c, -5.0, 0.08, len_s * 0.2)
	get_tree().create_timer(len_s * 0.36).timeout.connect(_melee_hit.bind(1.5, 80.0, 14.0 if heavy else 8.0, "punch"))


func _slash(d: Dictionary) -> void:
	var t = _nearest_target(2.0, 80.0)
	_aim_at(t)
	var len_s := rig.hold.swing("light")
	_atk_cd = len_s
	snd.play("swing", player.global_position + Vector3.UP * 1.3, -3.0, 0.08, len_s * 0.42)
	get_tree().create_timer(len_s * 0.5).timeout.connect(_melee_hit.bind(2.0, 80.0, float(d.dmg), "hit_wood"))


func _melee_hit(range_m: float, cone: float, dmg: float, sound: String) -> void:
	var t = _nearest_target(range_m, cone)
	if t != null:
		snd.play(sound, t.global_position + Vector3.UP * 1.2, -2.0, 0.08)
		_damage(t, dmg, t.global_position + Vector3.UP * 1.3)


func _shoot(it: Dictionary, d: Dictionary) -> void:
	var wcfg: Dictionary = rig.hold.w
	it.mag = int(it.mag) - 1
	shots += 1
	_atk_cd = 1.0 / float(d.rate)
	_aim_t = 0.0
	rig.hold.set_stance("aim")
	var t = _nearest_target(45.0, 14.0)
	_aim_at(t)
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var from := player.global_position + Vector3.UP * 1.35 + f * 0.5
	var mz := rig.hold.muzzle_world()
	var vis_from: Vector3 = mz[0] if not mz.is_empty() else from
	if t != null:
		f = ((t.global_position + Vector3.UP * 1.2) - from).normalized()
	rig.hold.fire()
	var sd: Dictionary = wcfg.get("sound", {})
	snd.play(String(sd.get("shot", "shot_ak")), vis_from, float(sd.get("db", 0.0)), 0.04)
	snd.play(String(sd.get("case", "casing")), player.global_position + Vector3(0.5, 0.05, 0), -12.0, 0.1, randf_range(0.4, 0.6))
	var fc: Dictionary = wcfg.get("fire", {})
	var pellets := int(fc.get("pellets", 1))
	var spread := deg_to_rad(float(fc.get("spread", 0.6 if pellets == 1 else 2.2)))
	var space := get_world_3d().direct_space_state
	var end := from + f * 60.0
	for i in pellets:
		var dir := (f + Vector3(randf_range(-1, 1), randf_range(-0.4, 0.4), randf_range(-1, 1)) * tan(spread)).normalized()
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * 60.0)
		q.exclude = [player.get_rid()]
		var hit := space.intersect_ray(q)
		if hit.is_empty():
			continue
		if i == 0:
			end = hit.position
		var col: Object = hit.collider
		if col != null and col.has_meta("hp"):
			hits += 1
			_damage(col, float(d.dmg) / pellets, hit.position)
		snd.play("hit_wood", hit.position, -8.0, 0.1, from.distance_to(hit.position) / 343.0)
	# трассер и вспышка
	_tracer.visible = true
	_tracer.global_position = (vis_from + end) * 0.5
	if vis_from.distance_to(end) > 0.1:
		_tracer.look_at(end, Vector3.UP)
	_tracer.scale = Vector3(1, 1, vis_from.distance_to(end))
	_flash.global_position = vis_from + f * 0.15
	_flash.light_energy = 2.5
	var tw := create_tween()
	tw.tween_property(_flash, "light_energy", 0.0, 0.07)
	tw.tween_callback(func(): _tracer.visible = false)
	if int(it.mag) <= 0 and inv.count(String(d.ammo)) > 0:
		get_tree().create_timer(0.35).timeout.connect(reload_weapon)       # магазин пуст — перезарядка сама


func reload_weapon() -> void:
	var it = _hand_item()
	if it == null or _reloading:
		return
	var d := ULItems.get_def(String(it.id))
	if not d.has("ammo") or rig.hold.wid == "" or rig.hold.drawn < 0.99:
		return
	if int(it.get("mag", 0)) >= int(d.mag):
		return
	if inv.count(String(d.ammo)) <= 0:
		say("Нет патронов: " + ULItems.get_def(String(d.ammo)).n)
		return
	_reloading = true
	rig.hold.set_stance("ready")
	var t := rig.hold.reload()
	get_tree().create_timer(t * 0.8).timeout.connect(func():
		_reloading = false
		if _hand_item() == it:
			it.mag = int(it.get("mag", 0)) + inv.consume(String(d.ammo), int(d.mag) - int(it.get("mag", 0)))
			_save())


## кнопка лечения (id пусто): лучшее из того, что есть — аптечка при большой потере, иначе бинт, потом еда.
## С id — использовать этот предмет (еда и вода из инвентаря): здоровье и вода по описанию предмета.
func heal(id := "") -> bool:
	if _heal_cd > 0.0:
		return false
	var auto := id == ""
	if auto:
		if hp >= HP_MAX:
			say("Здоровье полное")
			return false
		id = inv.best_heal(int(HP_MAX - hp))
	if id == "" or inv.count(id) <= 0:
		say("Нечем лечиться")
		return false
	var d := ULItems.get_def(id)
	var dh := float(d.get("heal", 0))
	var dw := float(d.get("water", 0))
	var de := float(d.get("energy", 0))
	if (dh <= 0.0 or hp >= HP_MAX) and (dw <= 0.0 or water >= 100.0) and (de <= 0.0 or en >= 100.0):
		say("Сейчас не нужно")
		return false
	inv.consume(id, 1)
	hp = minf(HP_MAX, hp + dh)
	water = minf(100.0, water + dw)
	en = minf(100.0, en + de)
	_heal_cd = 0.8
	snd.play("cloth", player.global_position + Vector3.UP * 1.2, -5.0)
	say("%s: здоровье %d, энергия %d, вода %d" % [d.n, int(round(hp)), int(round(en)), int(round(water))])
	_save()
	return true


## урон по мишени: цифра над ней, качание; на нуле падает и через 6 с встаёт
func _damage(t: Node3D, dmg: float, at: Vector3) -> void:
	var left := maxf(0.0, float(t.get_meta("hp")) - dmg)
	t.set_meta("hp", left)
	var lb := Label3D.new()
	lb.text = "−%d" % int(round(dmg))
	lb.font_size = 56
	lb.pixel_size = 0.006
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.no_depth_test = true
	lb.modulate = Color(1.0, 0.85, 0.3)
	lb.outline_size = 10
	add_child(lb)
	lb.global_position = at + Vector3(randf_range(-0.2, 0.2), 0.4, 0)
	var tw := create_tween()
	tw.tween_property(lb, "global_position", lb.global_position + Vector3.UP * 0.9, 0.7)
	tw.parallel().tween_property(lb, "modulate:a", 0.0, 0.7)
	tw.tween_callback(lb.queue_free)
	var vis: Node3D = t.get_node("Vis")
	var tw2 := create_tween()
	if left <= 0.0:
		tw2.tween_property(vis, "rotation:x", -1.45, 0.35)
		snd.play("body_fall", t.global_position, -4.0, 0.05, 0.25)
		get_tree().create_timer(6.0).timeout.connect(func():
			if is_instance_valid(t):
				t.set_meta("hp", float(t.get_meta("hp_max")))
				create_tween().tween_property(vis, "rotation:x", 0.0, 0.5))
	else:
		tw2.tween_property(vis, "rotation:x", -0.16, 0.06)
		tw2.tween_property(vis, "rotation:x", 0.0, 0.25)


## мишень-чучело: столб, перекладина, мешок-туловище и «голова»
func _add_target(p: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "Target"
	add_child(body)
	body.position = p
	body.set_meta("hp", 150.0)
	body.set_meta("hp_max", 150.0)
	var vis := Node3D.new()
	vis.name = "Vis"
	body.add_child(vis)
	var wood := ULHouse._mat(TEX + "weathered_brown_planks", 1.0)
	var sack := StandardMaterial3D.new()
	sack.albedo_color = Color(0.62, 0.52, 0.36)
	sack.roughness = 1.0
	for it in [[Vector3(0.1, 1.9, 0.1), Vector3(0, 0.95, 0), wood], [Vector3(0.9, 0.08, 0.08), Vector3(0, 1.4, 0), wood], [Vector3(0.5, 0.75, 0.28), Vector3(0, 1.1, 0), sack]]:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = it[0]
		mi.mesh = bm
		mi.material_override = it[2]
		mi.position = it[1]
		vis.add_child(mi)
	var head := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.17
	sm.height = 0.36
	head.mesh = sm
	head.material_override = sack
	head.position = Vector3(0, 1.7, 0)
	vis.add_child(head)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.2, 1.2)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	body.add_child(blob)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.6, 1.9, 0.35)
	cs.shape = bs
	cs.position.y = 0.95
	body.add_child(cs)
	targets.append(body)


func _combat_setup() -> void:
	_tracer = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.025, 0.025, 1.0)
	_tracer.mesh = bm
	var tm := StandardMaterial3D.new()
	tm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tm.albedo_color = Color(1.0, 0.9, 0.55)
	_tracer.material_override = tm
	_tracer.visible = false
	add_child(_tracer)
	_flash = OmniLight3D.new()
	_flash.light_color = Color(1.0, 0.8, 0.5)
	_flash.omni_range = 5.0
	_flash.light_energy = 0.0
	add_child(_flash)
	# мишени: во дворе справа и две в поле — на 12 и 25 м от калитки
	_add_target(HOUSE_AT + Vector3(8.5, 0, 6.5))
	_add_target(Vector3(-7.0, 0, 9.0))
	_add_target(Vector3(9.0, 0, 22.0))


## каждый кадр: задержки, очередь при удержании, возврат из прицела, доворот к цели
func _combat_tick(delta: float) -> void:
	_atk_cd = maxf(0.0, _atk_cd - delta)
	_heal_cd = maxf(0.0, _heal_cd - delta)
	_aim_t += delta
	var held: bool = _hud_touch.values().has("fire") or Input.is_physical_key_pressed(KEY_SPACE)
	var it = _hand_item()
	if held and it != null and _atk_cd <= 0.0 and bool(ULItems.get_def(String(it.id)).get("auto", false)) and int(it.get("mag", 0)) > 0:
		attack()
	if _aim_t > 1.8 and rig.hold.wid != "" and rig.hold.stance == "aim" and not _reloading:
		rig.hold.set_stance("ready")
	if not is_nan(_face):
		player.rotation.y = lerp_angle(player.rotation.y, _face, 1.0 - exp(-delta * 18.0))
		if absf(angle_difference(player.rotation.y, _face)) < 0.03 or _atk_cd <= 0.0:
			_face = NAN


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
	var fwd := Vector3(-sin(CAM_YAW), 0, -cos(CAM_YAW))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dn := d.normalized()
	return Vector2(dn.dot(right), -dn.dot(fwd)) * _auto_k


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
	await get_tree().create_timer(0.5).timeout


func _log(t: String) -> void:
	print("[world] " + t)


func _inv_state() -> String:
	return "ячеек %d, занято %d, в руках «%s», рюкзак %s, основное %s, пистолет %s" % [inv.slot_count(), inv.used(), inv.hand, ULItems.title(inv.pack) if inv.pack else "нет", ULItems.title(inv.primary) if inv.primary else "нет", ULItems.title(inv.pistol) if inv.pistol else "нет"]


var _fails := 0
var _auto_k := 0.6                ## сила «нажатия» джойстика в проверке


func _ok(name: String, cond: bool, extra := "") -> void:
	if not cond:
		_fails += 1
	print("[inv] %s — %s%s" % [name, "верно" if cond else "ОШИБКА", (" (" + extra + ")") if extra != "" else ""])


func _wait_drawn() -> void:
	var tw := 0.0
	while rig.hold.drawn < 0.99 and tw < 6.0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	await get_tree().create_timer(0.2).timeout


## проверка логики инвентаря и боя: каждое правило — отдельный случай
func _inv_test() -> void:
	var I := ULItems
	await get_tree().create_timer(0.5).timeout
	# чистое состояние
	for g in ground.duplicate():
		_remove_ground(g)
	inv = ULInventory.new()
	_ok("карманы: 8 ячеек без рюкзака", inv.slot_count() == 8)
	# стопки
	inv.add(I.make("a545", 60))
	inv.add(I.make("a545", 50))
	_ok("патроны складываются в стопку до 90, остаток — в новую ячейку", inv.used() == 2 and int(inv.pockets[0].n) == 90 and int(inv.pockets[1].n) == 20, "%s / %s" % [str(inv.pockets[0]), str(inv.pockets[1])])
	# оружие в пустой слот
	inv.add(I.make("ak74m"))
	_ok("автомат ложится в слот «основное»", inv.primary != null and String(inv.primary.id) == "ak74m" and inv.used() == 2)
	inv.add(I.make("svd"))
	_ok("второе основное оружие — в карман, слот не меняется", String(inv.primary.id) == "ak74m" and inv.used() == 3)
	inv.add(I.make("tt"))
	_ok("пистолет — в слот «пистолет»", inv.pistol != null and String(inv.pistol.id) == "tt")
	# экипировать из кармана — меняется местами
	var si := -1
	for i in 8:
		if inv.pockets[i] != null and String(inv.pockets[i].id) == "svd":
			si = i
	inv.equip_from(inv.pockets, si)
	_ok("экипировать СВД из кармана: СВД в слоте, АК — в том же кармане", String(inv.primary.id) == "svd" and String(inv.pockets[si].id) == "ak74m")
	# рюкзаки и ячейки
	for id_n in [["pack_small", 16], ["pack_medium", 20], ["pack_large", 28]]:
		inv.pack = I.make(id_n[0])
		_ok("%s: всего ячеек %d" % [I.get_def(id_n[0]).n, id_n[1]], inv.slot_count() == int(id_n[1]))
	inv.pack = I.make("pack_small")
	# переполнение: карманы 8 + рюкзак 8
	var added := 0
	for i in 20:
		if inv.add(I.make("medkit", 2)) == 0:
			added += 1
	_ok("лишнее не помещается: занято ровно 16 из 16", inv.used() == 16 and inv.slot_count() == 16, "занято %d, добавлено стопок %d" % [inv.used(), added])
	var left := inv.add(I.make("can", 1))
	_ok("в полный инвентарь предмет не кладётся (остаток 1)", left == 1)
	_ok("снять пистолет в полный инвентарь нельзя", not inv.unequip("pistol") and inv.pistol != null)
	_ok("снять непустой рюкзак в ячейку нельзя", not inv.unequip("pack") and inv.pack != null)
	# выбросить рюкзак с вещами и надеть обратно — вещи на месте
	var in_pack: int = inv.pack.items.filter(func(x): return x != null).size()
	var it = inv.clear_slot("pack")
	_on_drop(it)
	_ok("выброшенный рюкзак лежит на земле, ячеек снова 8", ground.size() == 1 and inv.slot_count() == 8 and inv.pack == null)
	_ok("вещи остались в рюкзаке на земле", ground[0].item.items.filter(func(x): return x != null).size() == in_pack, "%d" % in_pack)
	_open_ground = ground[0]
	_on_wear_ground_pack()
	_ok("надеть рюкзак с земли: вещи в нём, на земле пусто", inv.pack != null and inv.pack.items.filter(func(x): return x != null).size() == in_pack and ground.is_empty())
	inv_ui.visible = false
	# надеть другой рюкзак с земли — прежний ложится на землю со своими вещами
	_spawn_ground(I.make("pack_large"), player.global_position + Vector3(0.8, 0, 0), 0.0)
	_open_ground = ground[0]
	_on_wear_ground_pack()
	_ok("сменить рюкзак: надет большой (28 ячеек), малый с вещами — на земле", inv.slot_count() == 28 and ground.size() == 1 and String(ground[0].item.id) == "pack_small" and ground[0].item.items.filter(func(x): return x != null).size() == in_pack)
	inv_ui.visible = false
	# оружие в руки и на героя
	inv.hand = "primary"
	_apply_gear()
	await _wait_drawn()
	_ok("СВД в руках у героя", rig.hold.wid == "svd" and rig.hold.drawn > 0.9, "%s, достал на %.0f %%" % [rig.hold.wid, rig.hold.drawn * 100.0])
	cycle_weapon()
	await get_tree().create_timer(1.6).timeout
	_ok("кнопка «Оружие»: основное → пистолет", inv.hand == "pistol" and rig.hold.wid == "pistol", rig.hold.wid)
	cycle_weapon()
	await get_tree().create_timer(1.6).timeout
	_ok("кнопка «Оружие»: пистолет → убрано", inv.hand == "" and rig.hold.wid == "", rig.hold.wid)
	# выбросить оружие из слота, подобрать — снова в слоте
	inv.hand = "pistol"
	_on_drop(inv.clear_slot("pistol"))
	_ok("выбросить пистолет из рук: слот пуст, в руках ничего", inv.pistol == null and inv.hand == "")
	_target = {"type": "ground", "g": ground[ground.size() - 1]}
	do_action()
	_ok("подобрать пистолет: он снова в слоте и в руках", inv.pistol != null and inv.hand == "pistol")
	# ящик: положить и взять
	var c0 := crates.size()
	place_crate()
	var cells: Array = crates[crates.size() - 1].get_meta("items")
	_ok("новый ящик: 12 пустых ячеек", crates.size() == c0 + 1 and cells.size() == CRATE_SLOTS and cells.filter(func(x): return x != null).is_empty())
	open_inventory(cells, "Ящик")
	var u0 := inv.used()
	inv_ui._sel_src = "pockets"
	inv_ui._sel_i = 0
	inv_ui._act_to_cont()
	_ok("переложить из кармана в ящик", inv.used() == u0 - 1 and cells[0] != null)
	inv_ui._sel_src = "cont"
	inv_ui._sel_i = 0
	inv_ui._act_take()
	_ok("взять из ящика обратно", inv.used() == u0 and cells[0] == null)
	close_inventory()
	# --- бой ---
	var tg: Node3D = targets[1]
	inv.hand = ""
	_apply_gear()
	await get_tree().create_timer(1.4).timeout
	player.global_position = tg.global_position + Vector3(0, 0.05, 1.1)
	player.rotation.y = PI
	await get_tree().create_timer(0.3).timeout
	var h0 := float(tg.get_meta("hp"))
	attack()
	await get_tree().create_timer(0.8).timeout
	_ok("кулаки: удар по мишени снимает 8", is_equal_approx(h0 - float(tg.get_meta("hp")), 8.0), "было %d, стало %d" % [h0, float(tg.get_meta("hp"))])
	inv.pistol = I.make("machete")
	_ok("мачете ложится в слот пистолета", I.slot_of(inv.pistol) == "pistol")
	inv.hand = "pistol"
	_apply_gear()
	await _wait_drawn()
	h0 = float(tg.get_meta("hp"))
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(1.3).timeout
	_ok("мачете: удар снимает 40", is_equal_approx(h0 - float(tg.get_meta("hp")), 40.0), "было %d, стало %d" % [h0, float(tg.get_meta("hp"))])
	inv.primary = I.make("ak74m")
	inv.hand = "primary"
	_apply_gear()
	await _wait_drawn()
	player.global_position = tg.global_position + Vector3(0, 0.05, 9.0)
	player.rotation.y = PI
	await get_tree().create_timer(0.3).timeout
	h0 = float(tg.get_meta("hp"))
	var s0 := shots
	var k0 := hits
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(0.4).timeout
	_ok("АК: выстрел тратит патрон (29 из 30)", int(inv.primary.mag) == 29 and shots == s0 + 1, "в магазине %d" % int(inv.primary.mag))
	_ok("АК: попадание по мишени с 9 м снимает 26", hits == k0 + 1 and is_equal_approx(h0 - float(tg.get_meta("hp")), 26.0), "попаданий %d, было %d, стало %d" % [hits - k0, h0, float(tg.get_meta("hp"))])
	# пустой магазин → перезарядка из запаса
	var res0 := inv.count("a545")
	inv.primary.mag = 0
	_atk_cd = 0.0
	attack()
	_ok("пустой магазин: начинается перезарядка", _reloading)
	await get_tree().create_timer(3.4).timeout
	_ok("перезарядка: в магазине 30, из запаса ушло 30", int(inv.primary.mag) == 30 and inv.count("a545") == res0 - 30, "магазин %d, запас %d → %d" % [int(inv.primary.mag), res0, inv.count("a545")])
	# без патронов
	inv.consume("a545", 999)
	inv.primary.mag = 0
	_atk_cd = 0.0
	s0 = shots
	attack()
	_ok("нет патронов: выстрела нет", shots == s0 and not _reloading)
	# лечение и вода
	inv.consume("medkit", 999)
	inv.add(I.make("bandage", 2))
	inv.add(I.make("water", 1))
	hp = 40.0
	_heal_cd = 0.0
	heal()
	_ok("кнопка лечения: бинт +15 (40 → 55), бинтов стало меньше", is_equal_approx(hp, 55.0) and inv.count("bandage") == 1, "здоровье %d, бинтов %d" % [hp, inv.count("bandage")])
	water = 50.0
	_heal_cd = 0.0
	heal("water")
	_ok("вода из инвентаря: +40 (50 → 90)", is_equal_approx(water, 90.0) and inv.count("water") == 0, "вода %d" % water)
	hp = 100.0
	_heal_cd = 0.0
	_ok("здоровье полное — лечение не тратит бинт", not heal() and inv.count("bandage") == 1)
	# энергия
	en = 100.0
	_auto = [player.global_position + Vector3(30, 0, 0)]
	_auto_k = 1.0
	await get_tree().create_timer(3.0).timeout
	_auto.clear()
	_auto_k = 0.6
	_ok("быстрый бег тратит энергию", en < 95.0, "энергия %d" % en)
	# набор припасов: живчик возвращает энергию; у каждого предмета набора есть своя модель и значок
	inv.add(I.make("tonic", 1))
	en = 30.0
	_heal_cd = 0.0
	heal("tonic")
	_ok("живчик: +60 энергии (30 → 90)", is_equal_approx(en, 90.0) and inv.count("tonic") == 0, "энергия %d" % en)
	var kit_bad := ""
	for kid in I.ITEMS:
		if I.ITEMS[kid].has("kit") and (I.kit_mesh(kid) == null or I.icon(kid) == null):
			kit_bad += kid + " "
	_ok("набор припасов: у всех 13 предметов есть модель и значок", kit_bad == "", kit_bad)
	var gk := _spawn_ground(I.make("medkit"), player.global_position + Vector3(1.5, 0, 0), 0.0)
	_ok("аптечка на земле — моделью из набора", (gk.node as Node3D).find_children("*", "MeshInstance3D", true, false).size() >= 2 and (gk.node as Node3D).find_children("*", "Sprite3D", true, false).is_empty())
	_remove_ground(gk)
	# сохранение и загрузка
	var snap := JSON.stringify({"inv": inv.to_dict()})
	var inv2 := ULInventory.new()
	inv2.from_dict(JSON.parse_string(snap).inv)
	var n_int := true
	for c in inv2.pockets:
		if c != null and typeof(c.n) != TYPE_INT:
			n_int = false
	_ok("сохранение и загрузка: тот же инвентарь", JSON.stringify(inv2.to_dict()) == JSON.stringify(inv.to_dict()) and inv2.slot_count() == inv.slot_count() and n_int)
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


func _run_test() -> void:
	if test == "inv":
		await _inv_test()
		return
	if test == "view":
		# обзор локации: несколько точек, по снимку
		DirAccess.make_dir_recursive_absolute(out)
		var pts := [["v0_start", Vector3(0, 0, 6)], ["v1_gate", Vector3(3.5, 0, 0.5)], ["v2_trail", Vector3(-2.0, 0, 20)], ["v3_yard", Vector3(4.0, 0, -4.5)], ["v4_forest", Vector3(-22, 0, 14)], ["v5_side", Vector3(20, 0, 9)]]
		for pt in pts:
			player.global_position = pt[1]
			_cam_ready = false
			await get_tree().create_timer(1.6).timeout
			await _snap(pt[0])
		get_tree().quit()
		return
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(1.2).timeout
	await _snap("i0_start")
	_log("старт: " + _inv_state())
	# 1. малый рюкзак у старта: открыть и надеть
	await _walk([Vector3(1.6, 0, 2.2)])
	_log("рядом: «%s»" % _action_label())
	do_action()
	await get_tree().create_timer(0.8).timeout
	await _snap("i1_ground_pack")
	_on_wear_ground_pack()
	await get_tree().create_timer(1.2).timeout
	await _snap("i2_inventory_pack")
	_log("надел малый: " + _inv_state())
	close_inventory()
	# 2. в кладовую, открыть ящик, взять АК и ТТ, взять в руки
	var H := house
	await _walk([HOUSE_AT + Vector3(0, 0, YARD[3] + 1.0), HOUSE_AT + Vector3(0, 0, YARD[3] - 1.0), H.door_point(1.5), H.to_global(Vector3(0, 0, 3.25)), H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(4.3, 0, 2.6))], 40.0)
	_log("у ящика: «%s», %s" % [_action_label(), _where()])
	do_action()
	await get_tree().create_timer(0.6).timeout
	await _snap("i3_crate")
	var c: Array = inv_ui.cont
	for i in c.size():
		if c[i] != null and String(c[i].id) in ["ak74m", "tt", "a545"]:
			inv_ui._sel_src = "cont"
			inv_ui._sel_i = i
			inv_ui._act_take()
	_log("взял из ящика: " + _inv_state())
	close_inventory()
	inv.hand = "primary"
	_apply_gear()
	await get_tree().create_timer(1.6).timeout
	await _snap("i4_with_ak")
	open_inventory()
	await get_tree().create_timer(1.5).timeout
	await _snap("i5_inventory_ak")
	# 3. выбросить ТТ и рюкзак на землю
	inv_ui._sel_src = "eq:pistol"
	inv_ui._sel_i = 0
	inv_ui._act_drop()
	inv_ui._sel_src = "eq:pack"
	inv_ui._sel_i = 0
	inv_ui._act_drop()
	await get_tree().create_timer(0.8).timeout
	await _snap("i6_after_drop")
	_log("выбросил ТТ и рюкзак: " + _inv_state() + ", на земле предметов: %d" % ground.size())
	close_inventory()
	await get_tree().create_timer(0.8).timeout
	await _snap("i7_ground")
	# 4. открыть брошенный рюкзак — переложить в него патроны
	for g in ground:
		if ULItems.kind(g.item) == "pack" and (g.node as Node3D).global_position.distance_to(player.global_position) < 2.5:
			_target = {"type": "ground", "g": g}
	_log("рядом: «%s» — %s" % [_action_label(), _target_name()])
	do_action()
	if _open_ground != null:
		for i in inv.pockets.size():
			if inv.pockets[i] != null and String(inv.pockets[i].id) == "a545":
				inv_ui._sel_src = "pockets"
				inv_ui._sel_i = i
				inv_ui._act_to_cont()
				break
		await get_tree().create_timer(0.5).timeout
		await _snap("i8_into_pack")
		_log("переложил патроны в рюкзак на земле: в нём %d предм." % (_open_ground.item.items.filter(func(x): return x != null).size()))
	close_inventory()
	# 5. в горницу — вид с низкими передними стенами
	await _walk([H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(0, 0, 2.6)), H.to_global(Vector3(0, 0, 0.5)), H.to_global(Vector3(-2.5, 0, -1.5))], 25.0)
	await _snap("i9_gornica")
	_log("горница: " + _where())
	get_tree().quit()
