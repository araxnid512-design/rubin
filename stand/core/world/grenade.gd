class_name ULGrenade
extends Node3D
## Граната главаря муров. На полу, где стоял герой, загорается красный круг с отсчётом (как у броска камня
## Рубера); главарь замахивается (граната у его левой кисти), бросает (release) — она летит по дуге fly_s секунд,
## падает в круг и лежит до конца запала (fuse_s от появления метки), потом взрыв: exploded → урон тем, кто в
## круге и не за стеной (считает мир). Работает и в помещении. Сорвали бросок (cancel) — метка гаснет.
## Настройки — data/enemies.json: mur_boss.grenade.

signal exploded(at: Vector3, r: float)
signal landed(at: Vector3)

const SCORCH_SHADER := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
// след взрыва: тёмная копоть с рваным краем, тает
uniform float fade = 1.0;
void fragment() {
	vec2 c = UV * 2.0 - 1.0;
	float a = atan(c.y, c.x);
	float r = length(c) * (1.0 + 0.2 * sin(a * 7.0 + 0.7) + 0.1 * sin(a * 13.0));
	ALBEDO = mix(vec3(0.02, 0.02, 0.02), vec3(0.12, 0.09, 0.07), smoothstep(0.2, 0.95, r));
	ALPHA = (1.0 - smoothstep(0.35, 1.0, r)) * 0.8 * fade;
}
"""

static var _mark_shader: Shader
static var _scorch_shader: Shader
static var _body_mat: StandardMaterial3D
static var _fire_mat: StandardMaterial3D
static var _smoke_mat: StandardMaterial3D
static var _spark_mat: StandardMaterial3D

var at := Vector3.ZERO            ## где взорвётся (на полу)
var radius := 2.6
var throw_s := 0.6                ## от метки до броска
var fly_s := 0.8
var fuse_s := 2.2                 ## от метки до взрыва
var phase := "aim"                ## aim — в руке; fly — летит; lie — лежит в круге; boom — взорвалась; done — сорвана
var hand: Callable                ## где сейчас левая кисть хозяина
var t := 0.0
var _ft := 0.0
var _p0 := Vector3.ZERO
var _mark: MeshInstance3D
var _mm: ShaderMaterial
var _body: MeshInstance3D
var _lamp: MeshInstance3D
var _ball: MeshInstance3D
var _scorch: MeshInstance3D
var _out := 0.0
var _bt := 0.0


## взрыв без броска (снаряд турели машины): огненный шар, копоть и дым — сразу в точке p
static func boom_at(parent: Node, p: Vector3, r: float) -> ULGrenade:
	var g := ULGrenade.new()
	parent.add_child(g)
	g.setup(p, r, 0.0, 0.1, 0.3)
	g.phase = "lie"
	g._boom()
	g._mark.visible = false
	g._lamp.visible = false
	return g


func setup(target: Vector3, r: float, thr: float, fly: float, fuse: float) -> void:
	at = target
	radius = r
	throw_s = thr
	fly_s = maxf(fly, 0.1)
	fuse_s = maxf(fuse, thr + fly + 0.2)
	if _mark_shader == null:
		_mark_shader = Shader.new()
		_mark_shader.code = ULRock.MARK_SHADER
	_mm = ShaderMaterial.new()
	_mm.shader = _mark_shader
	_mm.set_shader_parameter("fade", 0.0)
	_mark = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2.ONE * radius * 2.0 / 0.86          # кольцо шейдера — на 0,86 от края: его середина — радиус взрыва
	_mark.mesh = pm
	_mark.material_override = _mm
	_mark.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_mark.layers = 1 | 2                                  # и в помещениях
	add_child(_mark)
	_mark.global_position = at + Vector3.UP * 0.06
	if _body_mat == null:
		_body_mat = StandardMaterial3D.new()
		_body_mat.albedo_color = Color(0.2, 0.26, 0.14)
		_body_mat.roughness = 0.6
		_body_mat.metallic = 0.3
	_body = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.085
	sm.height = 0.21
	sm.radial_segments = 10
	sm.rings = 6
	_body.mesh = sm
	_body.material_override = _body_mat
	_body.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_body.layers = 1 | 2
	add_child(_body)
	# красный огонёк на гранате: сверху её иначе не разглядеть; мигает чаще к взрыву
	_lamp = MeshInstance3D.new()
	var lm := SphereMesh.new()
	lm.radius = 0.06
	lm.height = 0.12
	lm.radial_segments = 8
	lm.rings = 4
	_lamp.mesh = lm
	var lmat := StandardMaterial3D.new()
	lmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	lmat.albedo_color = Color(1.0, 0.15, 0.08)
	_lamp.material_override = lmat
	_lamp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_lamp.layers = 1 | 2
	_lamp.position = Vector3(0, 0.1, 0)
	_body.add_child(_lamp)
	_body.global_position = _hand_pos()
	_body.visible = false                                 # появляется в ладони, когда кисть дошла до подсумка (arm)


## граната взята из подсумка: видна в левой кисти
func arm() -> void:
	if phase == "aim":
		_body.visible = true


func _hand_pos() -> Vector3:
	if hand.is_valid():
		var p = hand.call()
		if p is Vector3:
			return p
	return at + Vector3.UP * 1.4


## бросок: дальше — по дуге в метку
func release() -> void:
	if phase != "aim":
		return
	_body.visible = true
	_body.global_position = _hand_pos()
	phase = "fly"
	_ft = 0.0
	_p0 = _body.global_position


## бросок сорван (главаря убили до броска): метка гаснет, граната пропадает
func cancel() -> void:
	if phase != "aim":
		return
	phase = "done"
	_body.visible = false
	_out = 0.3


func body_pos() -> Vector3:
	return _body.global_position if _body != null and _body.visible else Vector3.INF


func _process(delta: float) -> void:
	t += delta
	var prog := clampf(t / fuse_s, 0.0, 1.0)
	match phase:
		"aim":
			if not hand.is_valid() or t > throw_s + 1.5:
				cancel()
				return
			_mm.set_shader_parameter("fade", clampf(t / 0.15, 0.0, 1.0))
			_mm.set_shader_parameter("prog", prog)
			_body.global_position = _hand_pos()
		"fly":
			_ft += delta
			var s := clampf(_ft / fly_s, 0.0, 1.0)
			var end := at + Vector3.UP * 0.09
			var arc := clampf(Vector2(end.x - _p0.x, end.z - _p0.z).length() * 0.12, 0.4, 1.2)
			_body.global_position = _p0.lerp(end, s) + Vector3.UP * arc * 4.0 * s * (1.0 - s)
			_body.rotation += Vector3(7.0, 3.0, 5.0) * delta
			_mm.set_shader_parameter("prog", prog)
			if s >= 1.0:
				phase = "lie"
				landed.emit(at)
		"lie":
			_mm.set_shader_parameter("prog", prog)
			if t >= fuse_s:
				_boom()
		"boom":
			_bt += delta
			# огненный шар: быстро раздувается и гаснет
			var k := clampf(_bt / 0.14, 0.0, 1.0)
			_ball.scale = Vector3.ONE * lerpf(0.4, radius * 0.95, 1.0 - (1.0 - k) * (1.0 - k))
			(_ball.material_override as StandardMaterial3D).albedo_color = Color(1.0, lerpf(0.86, 0.42, k), lerpf(0.42, 0.08, k), clampf(1.0 - (_bt - 0.08) / 0.22, 0.0, 1.0) * 0.85)
			_ball.visible = _bt < 0.32
			_mm.set_shader_parameter("fade", clampf(1.0 - _bt / 0.25, 0.0, 1.0))
			(_scorch.material_override as ShaderMaterial).set_shader_parameter("fade", clampf((7.0 - _bt) / 2.0, 0.0, 1.0))
			if _bt > 7.0:
				queue_free()
		"done":
			_out -= delta
			_mm.set_shader_parameter("fade", clampf(_out / 0.3, 0.0, 1.0))
			if _out <= 0.0:
				queue_free()
	if _lamp != null and (phase == "aim" or phase == "fly" or phase == "lie"):
		_lamp.visible = sin(t * (10.0 + prog * 34.0)) > -0.2


func _boom() -> void:
	phase = "boom"
	_bt = 0.0
	_body.visible = false
	var c := at + Vector3.UP * 0.5
	if _fire_mat == null:
		_fire_mat = StandardMaterial3D.new()
		_fire_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_fire_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_fire_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
		_smoke_mat = StandardMaterial3D.new()
		_smoke_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_smoke_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_smoke_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_smoke_mat.vertex_color_use_as_albedo = true
		_smoke_mat.albedo_color = Color(0.22, 0.2, 0.19, 0.7)
		_spark_mat = StandardMaterial3D.new()
		_spark_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_spark_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
		_spark_mat.vertex_color_use_as_albedo = true
		_spark_mat.albedo_color = Color(1.0, 0.75, 0.3)
	_ball = MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.0
	sm.height = 1.6
	sm.radial_segments = 28
	sm.rings = 12
	_ball.mesh = sm
	_ball.material_override = _fire_mat.duplicate()
	_ball.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_ball.layers = 1 | 2
	add_child(_ball)
	_ball.global_position = c
	_ball.scale = Vector3.ONE * 0.4
	# копоть на полу
	if _scorch_shader == null:
		_scorch_shader = Shader.new()
		_scorch_shader.code = SCORCH_SHADER
	_scorch = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2.ONE * radius * 1.5
	_scorch.mesh = pm
	var scm := ShaderMaterial.new()
	scm.shader = _scorch_shader
	_scorch.material_override = scm
	_scorch.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_scorch.layers = 1 | 2
	add_child(_scorch)
	_scorch.global_position = at + Vector3.UP * 0.045
	# дым и искры: два разовых облачка частиц (процессор, без света)
	var smoke := CPUParticles3D.new()
	smoke.one_shot = true
	smoke.explosiveness = 0.9
	smoke.amount = 16
	smoke.lifetime = 1.5
	var q := QuadMesh.new()
	q.size = Vector2.ONE * 1.3
	q.material = _smoke_mat
	smoke.mesh = q
	smoke.direction = Vector3.UP
	smoke.spread = 75.0
	smoke.initial_velocity_min = 1.0
	smoke.initial_velocity_max = 3.2
	smoke.gravity = Vector3(0, 0.6, 0)
	smoke.damping_min = 1.5
	smoke.damping_max = 2.5
	smoke.scale_amount_min = 0.6
	smoke.scale_amount_max = 1.5
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 0.95))
	g.set_color(1, Color(1, 1, 1, 0.0))
	smoke.color_ramp = g
	smoke.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	smoke.layers = 1 | 2
	add_child(smoke)
	smoke.global_position = c
	smoke.emitting = true
	var sparks := CPUParticles3D.new()
	sparks.one_shot = true
	sparks.explosiveness = 1.0
	sparks.amount = 22
	sparks.lifetime = 0.55
	var q2 := QuadMesh.new()
	q2.size = Vector2(0.07, 0.07)
	q2.material = _spark_mat
	sparks.mesh = q2
	sparks.direction = Vector3.UP
	sparks.spread = 85.0
	sparks.initial_velocity_min = 4.0
	sparks.initial_velocity_max = 9.0
	sparks.gravity = Vector3(0, -12.0, 0)
	sparks.color_ramp = g
	sparks.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	sparks.layers = 1 | 2
	add_child(sparks)
	sparks.global_position = c
	sparks.emitting = true
	exploded.emit(at, radius)
