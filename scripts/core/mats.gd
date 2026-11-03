class_name Mats
extends RefCounted
## Кэш материалов и процедурных текстур (общие для всей игры, чтобы не плодить draw-call и память).

static var _cache := {}
static var noise_tex: Texture2D
static var detail_tex: Texture2D

static func _make_noise(seed_v: int, freq: float, octaves: int, size: int) -> Texture2D:
	var n := FastNoiseLite.new()
	n.seed = seed_v
	n.noise_type = FastNoiseLite.TYPE_SIMPLEX_SMOOTH
	n.frequency = freq
	n.fractal_type = FastNoiseLite.FRACTAL_FBM
	n.fractal_octaves = octaves
	var img := n.get_seamless_image(size, size, false, false, 0.1, true)
	img.convert(Image.FORMAT_L8)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

static func init_textures() -> void:
	if noise_tex == null:
		noise_tex = _make_noise(1337, 0.012, 4, 256)
		detail_tex = _make_noise(4242, 0.045, 3, 256)

static func _shader(path: String) -> Shader:
	var key := "sh:" + path
	if not _cache.has(key):
		_cache[key] = load(path)
	return _cache[key]

static func world(cutout: bool = true) -> ShaderMaterial:
	init_textures()
	var key := "world_%s" % cutout
	if not _cache.has(key):
		var m := ShaderMaterial.new()
		m.shader = _shader("res://shaders/world.gdshader")
		m.set_shader_parameter("noise_tex", noise_tex)
		m.set_shader_parameter("detail_tex", detail_tex)
		m.set_shader_parameter("cutout", cutout)
		_cache[key] = m
	return _cache[key]

static func ground(splat: Texture2D) -> ShaderMaterial:
	init_textures()
	var m := ShaderMaterial.new()
	m.shader = _shader("res://shaders/ground.gdshader")
	m.set_shader_parameter("splat", splat)
	m.set_shader_parameter("noise_tex", noise_tex)
	m.set_shader_parameter("detail_tex", detail_tex)
	return m

static func foliage(cutout: bool = false, sway: float = 0.12) -> ShaderMaterial:
	var key := "fol_%s_%s" % [cutout, sway]
	if not _cache.has(key):
		var m := ShaderMaterial.new()
		m.shader = _shader("res://shaders/foliage.gdshader")
		m.set_shader_parameter("cutout", cutout)
		m.set_shader_parameter("sway", sway)
		_cache[key] = m
	return _cache[key]

static func character() -> ShaderMaterial:
	init_textures()
	if not _cache.has("char"):
		var m := ShaderMaterial.new()
		m.shader = _shader("res://shaders/character.gdshader")
		m.set_shader_parameter("detail_tex", detail_tex)
		_cache["char"] = m
	return _cache["char"]

static func additive(col: Color, energy: float = 2.0) -> ShaderMaterial:
	var key := "add_%s_%s" % [col.to_html(), energy]
	if not _cache.has(key):
		var m := ShaderMaterial.new()
		m.shader = _shader("res://shaders/fx_additive.gdshader")
		m.set_shader_parameter("color", col)
		m.set_shader_parameter("energy", energy)
		_cache[key] = m
	return _cache[key]

static func anomaly(col: Color) -> ShaderMaterial:
	init_textures()
	var key := "anom_%s" % col.to_html()
	if not _cache.has(key):
		var m := ShaderMaterial.new()
		m.shader = _shader("res://shaders/anomaly.gdshader")
		m.set_shader_parameter("color", col)
		m.set_shader_parameter("noise_tex", noise_tex)
		_cache[key] = m
	return _cache[key]

static func unshaded(col: Color, transparent: bool = false) -> StandardMaterial3D:
	var key := "uns_%s_%s" % [col.to_html(), transparent]
	if not _cache.has(key):
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.albedo_color = col
		m.vertex_color_use_as_albedo = true
		if transparent:
			m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.disable_receive_shadows = true
		_cache[key] = m
	return _cache[key]
