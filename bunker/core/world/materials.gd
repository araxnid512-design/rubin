class_name BCMat
## Библиотека материалов BunkerCore: PBR-наборы текстур (цвет _c, AO/шероховатость/металл _a, нормали _n)
## из res://assets/textures/ (Poly Haven, ambientCG — CC0, см. docs/LICENSES.md) и простые цветные материалы.
## Один материал на имя — кэшируется, поэтому одинаковые поверхности батчатся.

const TEX := "res://assets/textures/"

## имя → [набор текстур, размер плитки в метрах, оттенок, шероховатость, металличность]
const SETS := {
	"concrete_wall": ["concrete_wall", 2.4, Color(0.92, 0.9, 0.86), 0.9, 0.0],
	"concrete_dark": ["concrete_wall", 2.4, Color(0.62, 0.6, 0.57), 0.92, 0.0],
	"concrete_floor": ["concrete_floor_worn_001", 3.0, Color(0.85, 0.84, 0.8), 0.85, 0.0],
	"concrete_raw": ["cracked_concrete_wall", 3.0, Color(0.9, 0.88, 0.84), 0.95, 0.0],
	"metal_plate": ["metal_plate", 1.5, Color(0.8, 0.8, 0.78), 0.55, 0.8],
	"rust": ["rusty_metal_02", 1.5, Color(1, 1, 1), 0.75, 0.6],
	"asphalt": ["asphalt_02", 4.0, Color(0.85, 0.85, 0.83), 0.9, 0.0],
	"ground_dry": ["mud_cracked_dry_03", 4.0, Color(0.95, 0.9, 0.82), 0.95, 0.0],
	"ground_grass": ["brown_mud_leaves_01", 4.0, Color(0.95, 0.9, 0.78), 0.95, 0.0],
	"gravel": ["rocky_gravel", 2.5, Color(0.95, 0.93, 0.9), 0.95, 0.0],
	"rock": ["rock_face_03", 3.0, Color(0.9, 0.88, 0.85), 0.9, 0.0],
	"wood": ["brown_planks_03", 2.0, Color(0.9, 0.85, 0.8), 0.8, 0.0],
	"wood_old": ["weathered_brown_planks", 2.0, Color(0.85, 0.82, 0.78), 0.85, 0.0],
	"brick": ["red_brick_03", 2.0, Color(0.9, 0.85, 0.82), 0.9, 0.0],
	"corrugated": ["corrugated_iron_02", 2.0, Color(0.85, 0.8, 0.75), 0.7, 0.6],
	"bark": ["bark_brown_02", 1.2, Color(0.75, 0.72, 0.68), 0.95, 0.0],
	"plaster": ["plastered_wall", 2.5, Color(0.86, 0.85, 0.8), 0.9, 0.0],
	"tiles": ["floor_tiles_06", 1.6, Color(0.95, 0.95, 0.93), 0.4, 0.0],
}

## простые материалы: цвет, шероховатость, металличность, излучение
const FLAT := {
	"paint_olive": [Color(0.27, 0.3, 0.22), 0.6, 0.35],
	"paint_green": [Color(0.22, 0.29, 0.24), 0.55, 0.35],
	"paint_grey": [Color(0.42, 0.43, 0.42), 0.55, 0.4],
	"paint_white": [Color(0.78, 0.79, 0.77), 0.45, 0.1],
	"paint_yellow": [Color(0.78, 0.6, 0.12), 0.55, 0.3],
	"paint_red": [Color(0.55, 0.12, 0.09), 0.55, 0.3],
	"paint_blue": [Color(0.16, 0.24, 0.36), 0.55, 0.3],
	"steel": [Color(0.55, 0.56, 0.57), 0.35, 0.9],
	"steel_dark": [Color(0.22, 0.23, 0.24), 0.45, 0.85],
	"chrome": [Color(0.75, 0.76, 0.77), 0.2, 1.0],
	"rubber": [Color(0.07, 0.07, 0.07), 0.9, 0.0],
	"plastic_dark": [Color(0.1, 0.1, 0.1), 0.6, 0.0],
	"plastic_white": [Color(0.82, 0.82, 0.8), 0.5, 0.0],
	"fabric_khaki": [Color(0.42, 0.4, 0.3), 0.95, 0.0],
	"fabric_white": [Color(0.75, 0.75, 0.72), 0.95, 0.0],
	"fabric_grey": [Color(0.35, 0.35, 0.34), 0.95, 0.0],
	"mattress": [Color(0.5, 0.48, 0.4), 0.95, 0.0],
	"cardboard": [Color(0.55, 0.42, 0.27), 0.9, 0.0],
	"dry_wood": [Color(0.5, 0.42, 0.32), 0.95, 0.0],
	"crate_green": [Color(0.24, 0.29, 0.2), 0.75, 0.1],
	"leaf": [Color(0.2, 0.42, 0.14), 0.7, 0.0],
	"soil": [Color(0.17, 0.12, 0.08), 1.0, 0.0],
	"glass": [Color(0.3, 0.38, 0.4), 0.05, 0.3],
	"screen_off": [Color(0.04, 0.05, 0.05), 0.2, 0.2],
	"dead_wood": [Color(0.3, 0.27, 0.23), 0.95, 0.0],
	"grass_dry": [Color(0.56, 0.47, 0.28), 0.95, 0.0],
	"black": [Color(0.03, 0.03, 0.03), 0.8, 0.0],
}

## светящиеся: цвет, сила
const GLOW := {
	"lamp_warm": [Color(1.0, 0.82, 0.55), 3.0],
	"lamp_cold": [Color(0.85, 0.93, 1.0), 3.0],
	"led_green": [Color(0.25, 1.0, 0.35), 4.0],
	"led_red": [Color(1.0, 0.18, 0.12), 4.0],
	"led_amber": [Color(1.0, 0.6, 0.1), 3.0],
	"screen_green": [Color(0.25, 0.85, 0.45), 1.6],
	"screen_blue": [Color(0.35, 0.65, 0.95), 1.4],
	"grow_light": [Color(1.0, 0.45, 0.85), 3.0],
	"beacon_red": [Color(1.0, 0.1, 0.05), 5.0],
}

static var _cache := {}
static var _tex := {}


static func uv_scale(name: String) -> float:
	if name.begins_with("cut:"):
		name = name.substr(4)
	if SETS.has(name):
		return SETS[name][1]
	return 1.0


static func get_mat(name: String) -> Material:
	if _cache.has(name):
		return _cache[name]
	if name.begins_with("cut:"):
		return get_cut(name.substr(4))
	var m: Material
	if SETS.has(name):
		m = _textured(name)
	elif FLAT.has(name):
		var f: Array = FLAT[name]
		var sm := StandardMaterial3D.new()
		sm.albedo_color = f[0]
		sm.roughness = f[1]
		sm.metallic = f[2]
		if name == "glass":
			sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			sm.albedo_color.a = 0.35
		m = sm
	elif GLOW.has(name):
		var g: Array = GLOW[name]
		var gm := StandardMaterial3D.new()
		gm.albedo_color = g[0]
		gm.emission_enabled = true
		gm.emission = g[0]
		gm.emission_energy_multiplier = g[1]
		gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m = gm
	elif name == "hazard":
		m = _hazard()
	elif name == "chainlink":
		m = _chainlink()
	elif name == "grime":
		# атлас грязи 2×2 (tools/gen_decals.py): пятна, трещины, ржавые потёки, мусор
		var gr := StandardMaterial3D.new()
		gr.albedo_texture = _load_tex("res://assets/textures/decals/grime_atlas.png")
		gr.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		gr.roughness = 1.0
		gr.render_priority = 1
		m = gr
	elif name == "ao":
		# мягкая тень у основания стен: чёрный, прозрачность из цвета вершин
		var ao := StandardMaterial3D.new()
		ao.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		ao.vertex_color_use_as_albedo = true
		ao.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		ao.albedo_color = Color(1, 1, 1, 1)
		ao.render_priority = 2
		m = ao
	elif name == "puddle":
		var ps := ShaderMaterial.new()
		ps.shader = preload("res://core/shaders/puddle.gdshader")
		m = ps
	else:
		var em := StandardMaterial3D.new()
		em.albedo_color = Color(1, 0, 1)
		m = em
	m.resource_name = name
	_cache[name] = m
	return m


static func _load_tex(path: String) -> Texture2D:
	if _tex.has(path):
		return _tex[path]
	var t: Texture2D = null
	if ResourceLoader.exists(path):
		t = load(path)
	_tex[path] = t
	return t


static func _textured(name: String) -> StandardMaterial3D:
	var s: Array = SETS[name]
	var base: String = TEX + s[0]
	var m := StandardMaterial3D.new()
	m.albedo_color = s[2]
	m.roughness = s[3]
	m.metallic = s[4]
	var c := _load_tex(base + "_c.jpg")
	if c:
		m.albedo_texture = c
	else:
		m.albedo_color = s[2] * Color(0.5, 0.5, 0.48)
	var n := _load_tex(base + "_n.jpg")
	if n:
		m.normal_enabled = true
		m.normal_texture = n
		m.normal_scale = 0.9
	var a := _load_tex(base + "_a.jpg")
	if a:
		# упакованная карта: R — затенение (AO), G — шероховатость, B — металличность
		m.ao_enabled = true
		m.ao_texture = a
		m.ao_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_RED
		m.roughness_texture = a
		m.roughness_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_GREEN
		m.roughness = 1.0
		if s[4] > 0.0:
			m.metallic_texture = a
			m.metallic_texture_channel = BaseMaterial3D.TEXTURE_CHANNEL_BLUE
			m.metallic = 1.0
	m.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS_ANISOTROPIC
	return m


## материал стены с вырезом вокруг героя (см. core/shaders/wall_cut.gdshader); те же текстуры, что у набора
static func get_cut(name: String) -> Material:
	var key := "cut:" + name
	if _cache.has(key):
		return _cache[key]
	var m := ShaderMaterial.new()
	m.shader = preload("res://core/shaders/wall_cut.gdshader")
	if SETS.has(name):
		var s: Array = SETS[name]
		var base: String = TEX + s[0]
		var c := _load_tex(base + "_c.jpg")
		m.set_shader_parameter("tint", s[2])
		m.set_shader_parameter("has_tex", c != null)
		if c:
			m.set_shader_parameter("tex_color", c)
			m.set_shader_parameter("tex_normal", _load_tex(base + "_n.jpg"))
			m.set_shader_parameter("tex_arm", _load_tex(base + "_a.jpg"))
		m.set_shader_parameter("metal", s[4])
	elif FLAT.has(name):
		m.set_shader_parameter("tint", FLAT[name][0])
		m.set_shader_parameter("has_tex", false)
		m.set_shader_parameter("metal", FLAT[name][2])
	m.resource_name = key
	_cache[key] = m
	return m


## сетка-рабица: процедурная текстура ромбиками с прозрачностью (alpha scissor — дёшево на телефоне)
static func _chainlink() -> StandardMaterial3D:
	var n := 128
	var img := Image.create(n, n, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	for y in n:
		for x in n:
			var a := (x + y) % 32
			var b := (x - y + 256) % 32
			if a < 3 or b < 3:
				var c := 0.55 + 0.1 * sin(x * 0.3)
				img.set_pixel(x, y, Color(c, c * 0.97, c * 0.92, 1))
	img.generate_mipmaps()
	var m := StandardMaterial3D.new()
	m.albedo_texture = ImageTexture.create_from_image(img)
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR
	m.alpha_scissor_threshold = 0.4
	m.cull_mode = BaseMaterial3D.CULL_DISABLED
	m.metallic = 0.7
	m.roughness = 0.5
	m.uv1_scale = Vector3(1, 1, 1)
	return m


## жёлто-чёрные предупреждающие полосы (без текстуры — шейдер)
static func _hazard() -> Material:
	var sh := Shader.new()
	sh.code = """
shader_type spatial;
void fragment() {
	vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float s = fract((wp.x + wp.y + wp.z) * 3.0);
	vec3 y = vec3(0.72, 0.55, 0.08), k = vec3(0.05);
	ALBEDO = mix(k, y, step(0.5, s));
	ROUGHNESS = 0.6;
}
"""
	var m := ShaderMaterial.new()
	m.shader = sh
	return m
