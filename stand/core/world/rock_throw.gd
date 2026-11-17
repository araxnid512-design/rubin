class_name ULRock
extends Node3D
## Бросок камня Рубера. На земле в месте, где стоял герой, появляется красный круг с отсчётом (заполняется от
## центра к краю); Рубер вырывает из земли булыжник (grab — камень появляется у его рук и держится в них), через
## aim_s секунд бросает (release) — камень летит по дуге fly_s секунд и бьёт в круг: landed → урон тем, кто в
## круге. После удара булыжник исчезает (пыль и осколки), метка гаснет. Сорвали бросок (cancel) — камень
## рассыпается в руках, метка гаснет. Настройки — data/enemies.json: rock.

signal landed(at: Vector3, r: float)

const TEX := "res://assets/world/tex/rock_boulder_dry"
const MARK_SHADER := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
// метка удара: красное кольцо, слабая заливка и круг-отсчёт, растущий от центра к кольцу к моменту удара
uniform float prog = 0.0;
uniform float fade = 1.0;
void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float r = length(c);
	float inside = 1.0 - smoothstep(0.96, 1.0, r);
	float ring = smoothstep(0.84, 0.88, r) * inside;
	float fill = (1.0 - smoothstep(prog * 0.86, prog * 0.86 + 0.03, r)) * step(0.001, prog);
	float pulse = 0.72 + 0.28 * sin(TIME * (6.0 + prog * 16.0));
	float cross = (1.0 - smoothstep(0.012, 0.03, min(abs(c.x), abs(c.y)))) * (1.0 - smoothstep(0.2, 0.24, r));
	ALBEDO = vec3(1.0, 0.07, 0.04);
	ALPHA = clamp(ring * 0.95 + inside * 0.13 + fill * 0.3 * pulse + cross * 0.7, 0.0, 1.0) * fade;
}
"""

const PIT_SHADER := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
// яма на месте вырванного камня: тёмная земля с рваным краем
uniform float fade = 1.0;
void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float a = atan(c.y, c.x);
	float r = length(c) * (1.0 + 0.16 * sin(a * 5.0 + 1.3) + 0.09 * sin(a * 11.0));
	ALBEDO = mix(vec3(0.05, 0.04, 0.03), vec3(0.2, 0.15, 0.1), smoothstep(0.35, 0.95, r));
	ALPHA = (1.0 - smoothstep(0.6, 1.0, r)) * 0.85 * fade;
}
"""

static var _shader: Shader
static var _pit_shader: Shader
static var _mesh: ArrayMesh
static var _mat: StandardMaterial3D
static var _dust_mat: StandardMaterial3D

var at := Vector3.ZERO            ## куда упадёт (на земле)
var radius := 1.7
var aim_s := 3.0                  ## от метки до броска
var fly_s := 0.75
var size := 0.75                  ## поперечник булыжника, м
var floor_y := 0.0                ## земля под хозяином: ниже неё камень в руках не опускается
var phase := "aim"                ## aim — метка стоит, камень в земле или в руках; fly — летит; done — упал или сорван
var held := false
var hands: Callable               ## где сейчас руки хозяина (середина между кистями), пока камень в них
var t := 0.0                      ## с появления метки
var _ft := 0.0                    ## в полёте
var _mark: MeshInstance3D
var _mm: ShaderMaterial
var _rock: MeshInstance3D
var _p0 := Vector3.ZERO
var _spin := Vector3(2.4, 1.1, 3.3)
var _grow := 0.0
var _out := 0.0
var _pit: MeshInstance3D


static func rock_mesh() -> ArrayMesh:
	if _mesh != null:
		return _mesh
	var sp := SphereMesh.new()
	sp.radius = 0.5
	sp.height = 1.0
	sp.radial_segments = 10
	sp.rings = 6
	var fn := FastNoiseLite.new()
	fn.seed = 77
	fn.frequency = 1.2
	var arr := sp.get_mesh_arrays()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in vs.size():
		var v := vs[i]
		v *= 1.0 + 0.3 * fn.get_noise_3dv(v * 2.0) + 0.16 * fn.get_noise_3dv(v * 5.5)
		v.y *= 0.82
		vs[i] = v
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.add_vertex(vs[i])
	st.generate_normals()
	_mesh = st.commit()
	return _mesh


static func rock_mat() -> StandardMaterial3D:
	if _mat == null:
		_mat = StandardMaterial3D.new()
		if ResourceLoader.exists(TEX + "_c.jpg"):
			_mat.albedo_texture = load(TEX + "_c.jpg")
		if ResourceLoader.exists(TEX + "_n.jpg"):
			_mat.normal_enabled = true
			_mat.normal_texture = load(TEX + "_n.jpg")
		_mat.albedo_color = Color(0.6, 0.57, 0.52)
		_mat.uv1_triplanar = true              # по самому камню (не по миру): в полёте рисунок не «плывёт»
		_mat.uv1_scale = Vector3.ONE * 0.9
		_mat.roughness = 0.95
	return _mat


func setup(target: Vector3, r: float, aim: float, fly: float, sz: float) -> void:
	at = target
	radius = r
	aim_s = aim
	fly_s = maxf(fly, 0.1)
	size = sz
	if _shader == null:
		_shader = Shader.new()
		_shader.code = MARK_SHADER
	_mm = ShaderMaterial.new()
	_mm.shader = _shader
	_mm.set_shader_parameter("fade", 0.0)
	_mark = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2.ONE * radius * 2.0 / 0.86          # кольцо шейдера — на 0,86 от края: его середина — радиус удара
	_mark.mesh = pm
	_mark.material_override = _mm
	_mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_mark)
	_mark.global_position = at + Vector3.UP * 0.06
	_rock = MeshInstance3D.new()
	_rock.mesh = rock_mesh()
	_rock.material_override = rock_mat()
	_rock.scale = Vector3.ONE * size
	_rock.visible = false
	add_child(_rock)


## камень вырван из земли в точке from: дальше он в руках
func grab(from: Vector3) -> void:
	if phase != "aim" or held:
		return
	held = true
	_rock.visible = true
	_rock.global_position = from + Vector3.UP * size * 0.1
	_rock.rotation = Vector3(0.4, 1.1, 0.2)
	_grow = 0.0
	_burst(from, 0.8)
	# яма там, откуда вырван камень (остаётся, пока не осядет пыль от удара)
	if _pit_shader == null:
		_pit_shader = Shader.new()
		_pit_shader.code = PIT_SHADER
	_pit = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2.ONE * size * 1.7
	_pit.mesh = pm
	var m := ShaderMaterial.new()
	m.shader = _pit_shader
	_pit.material_override = m
	_pit.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_pit)
	_pit.global_position = Vector3(from.x, floor_y + 0.04, from.z)


## бросок: дальше — по дуге в метку
func release() -> void:
	if phase != "aim":
		return
	if not held:
		grab(_hands_pos())
	phase = "fly"
	_ft = 0.0
	_p0 = _rock.global_position


## бросок сорван (оглушили или убили до броска): камень рассыпается, метка гаснет
func cancel() -> void:
	if phase != "aim":
		return
	phase = "done"
	if held:
		_burst(_rock.global_position, 0.7)
	_rock.visible = false
	_out = 0.3


func rock_pos() -> Vector3:
	return _rock.global_position if _rock != null and _rock.visible else Vector3.INF


func _hands_pos() -> Vector3:
	if hands.is_valid():
		var p = hands.call()
		if p is Vector3:
			return p
	return _rock.global_position


func _process(delta: float) -> void:
	t += delta
	match phase:
		"aim":
			if not hands.is_valid() or t > aim_s + 0.8:
				# хозяина убрали со сцены или бросок так и не случился (его отвлекли) — метка не висит вечно
				cancel()
				return
			_mm.set_shader_parameter("fade", clampf(t / 0.18, 0.0, 1.0))
			_mm.set_shader_parameter("prog", clampf(t / (aim_s + fly_s), 0.0, 1.0))
			if held:
				_grow = minf(1.0, _grow + delta / 0.6)        # вылезает из земли
				var want := _hands_pos()
				want.y = maxf(want.y, floor_y + size * 0.15)
				_rock.global_position = _rock.global_position.lerp(want, 1.0 - exp(-delta * 22.0))
				_rock.scale = Vector3.ONE * size * lerpf(0.55, 1.0, _grow)
		"fly":
			_ft += delta
			var s := clampf(_ft / fly_s, 0.0, 1.0)
			var end := at + Vector3.UP * size * 0.3
			var arc := clampf(Vector2(end.x - _p0.x, end.z - _p0.z).length() * 0.16, 1.2, 4.5)
			_rock.global_position = _p0.lerp(end, s) + Vector3.UP * arc * 4.0 * s * (1.0 - s)
			_rock.rotation += _spin * delta
			_rock.scale = Vector3.ONE * size
			_mm.set_shader_parameter("prog", clampf(t / (aim_s + fly_s), 0.0, 1.0))
			if s >= 1.0:
				phase = "done"
				_rock.visible = false                 # после попадания булыжник пропадает
				_burst(at, 1.6)
				_out = 0.35
				landed.emit(at, radius)
		"done":
			_out -= delta
			_mm.set_shader_parameter("fade", clampf(_out / 0.3, 0.0, 1.0))
			if _pit != null:
				(_pit.material_override as ShaderMaterial).set_shader_parameter("fade", clampf((_out + 1.4) / 0.6, 0.0, 1.0))
			if _out <= -1.4:
				queue_free()              # пыль и осколки осели


## пыль и осколки: два разовых облачка частиц (процессор, без света)
func _burst(p: Vector3, k: float) -> void:
	if _dust_mat == null:
		_dust_mat = StandardMaterial3D.new()
		_dust_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_dust_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_dust_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_dust_mat.vertex_color_use_as_albedo = true
		_dust_mat.albedo_color = Color(0.62, 0.55, 0.45, 0.55)
	var dust := CPUParticles3D.new()
	dust.one_shot = true
	dust.explosiveness = 0.92
	dust.amount = int(10 + 8 * k)
	dust.lifetime = 1.1
	var q := QuadMesh.new()
	q.size = Vector2.ONE * 0.7 * k
	q.material = _dust_mat
	dust.mesh = q
	dust.direction = Vector3.UP
	dust.spread = 80.0
	dust.initial_velocity_min = 0.8 * k
	dust.initial_velocity_max = 2.6 * k
	dust.gravity = Vector3(0, -1.2, 0)
	dust.scale_amount_min = 0.5
	dust.scale_amount_max = 1.3
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 0.9))
	g.set_color(1, Color(1, 1, 1, 0.0))
	dust.color_ramp = g
	dust.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(dust)
	dust.global_position = p + Vector3.UP * 0.15
	dust.emitting = true
	var bits := CPUParticles3D.new()
	bits.one_shot = true
	bits.explosiveness = 1.0
	bits.amount = int(5 + 5 * k)
	bits.lifetime = 0.9
	bits.mesh = rock_mesh()
	bits.material_override = rock_mat()
	bits.direction = Vector3.UP
	bits.spread = 65.0
	bits.initial_velocity_min = 2.0 * k
	bits.initial_velocity_max = 4.5 * k
	bits.gravity = Vector3(0, -13.0, 0)
	bits.scale_amount_min = 0.08 * size / 0.75
	bits.scale_amount_max = 0.24 * size / 0.75
	bits.angular_velocity_min = -300.0
	bits.angular_velocity_max = 300.0
	bits.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(bits)
	bits.global_position = p + Vector3.UP * 0.2
	bits.emitting = true
