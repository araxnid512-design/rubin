class_name FX
extends Node3D
## Пулы визуальных эффектов: трассеры, дульные вспышки, попадания, кровь, взрывы.

var _tracers: Array[MeshInstance3D] = []
var _tracer_t: Array[float] = []
var _flashes: Array[MeshInstance3D] = []
var _flash_t: Array[float] = []
var _flash_light: OmniLight3D
var _flash_light_t := 0.0
var _parts: Array[CPUParticles3D] = []
var _pi := 0
var _ti := 0
var _fi := 0

func _ready() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	var tm := BoxMesh.new()
	tm.size = Vector3(0.025, 0.025, 1.0)
	for i in 24:
		var t := MeshInstance3D.new()
		t.mesh = tm
		t.material_override = Mats.additive(Color(1.0, 0.82, 0.45, 0.9), 3.0)
		t.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		t.visible = false
		add_child(t)
		_tracers.append(t)
		_tracer_t.append(0.0)
	var q := QuadMesh.new()
	q.size = Vector2(0.45, 0.45)
	var fm := ShaderMaterial.new()
	fm.shader = load("res://shaders/fx_billboard.gdshader")
	fm.set_shader_parameter("color", Color(1.0, 0.7, 0.3, 1.0))
	fm.set_shader_parameter("energy", 3.0)
	for i in 8:
		var f := MeshInstance3D.new()
		f.mesh = q
		f.material_override = fm
		f.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		f.visible = false
		add_child(f)
		_flashes.append(f)
		_flash_t.append(0.0)
	_flash_light = OmniLight3D.new()
	_flash_light.light_color = Color(1.0, 0.75, 0.4)
	_flash_light.omni_range = 7.0
	_flash_light.light_energy = 0.0
	add_child(_flash_light)
	for i in 16:
		var p := CPUParticles3D.new()
		p.emitting = false
		p.one_shot = true
		p.amount = 14
		p.lifetime = 0.5
		p.explosiveness = 0.95
		p.spread = 40.0
		p.initial_velocity_min = 1.5
		p.initial_velocity_max = 4.0
		p.gravity = Vector3(0, -9, 0)
		p.scale_amount_min = 0.05
		p.scale_amount_max = 0.12
		var bm := BoxMesh.new()
		bm.size = Vector3(1, 1, 1)
		p.mesh = bm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.vertex_color_use_as_albedo = true
		p.material_override = m
		add_child(p)
		_parts.append(p)

func _process(delta: float) -> void:
	for i in _tracers.size():
		if _tracer_t[i] > 0.0:
			_tracer_t[i] -= delta
			if _tracer_t[i] <= 0.0:
				_tracers[i].visible = false
	for i in _flashes.size():
		if _flash_t[i] > 0.0:
			_flash_t[i] -= delta
			if _flash_t[i] <= 0.0:
				_flashes[i].visible = false
	if _flash_light_t > 0.0:
		_flash_light_t -= delta
		_flash_light.light_energy = maxf(0.0, _flash_light_t / 0.06) * 2.5

func tracer(from: Vector3, to: Vector3) -> void:
	var t := _tracers[_ti]
	_tracer_t[_ti] = 0.06
	_ti = (_ti + 1) % _tracers.size()
	var d := to - from
	var l := d.length()
	if l < 0.3:
		return
	t.global_transform = Transform3D(Basis.looking_at(d, Vector3.UP if absf(d.normalized().y) < 0.99 else Vector3.RIGHT).scaled(Vector3(1, 1, l)), (from + to) * 0.5)
	t.visible = true

func muzzle_flash(pos: Vector3, dir: Vector3, silenced: bool = false) -> void:
	if silenced:
		return
	var f := _flashes[_fi]
	_flash_t[_fi] = 0.05
	_fi = (_fi + 1) % _flashes.size()
	f.global_position = pos + dir * 0.1
	f.scale = Vector3.ONE * randf_range(0.8, 1.3)
	f.visible = true
	if Settings.preset().lights:
		_flash_light.global_position = pos + Vector3(0, 0.2, 0)
		_flash_light_t = 0.06

func _burst(pos: Vector3, normal: Vector3, color: Color, amount: int, vel: float, life: float = 0.5, size: float = 0.08) -> void:
	var p := _parts[_pi]
	_pi = (_pi + 1) % _parts.size()
	p.global_position = pos
	p.direction = normal if normal != Vector3.ZERO else Vector3.UP
	p.amount = amount
	p.lifetime = life
	p.initial_velocity_min = vel * 0.4
	p.initial_velocity_max = vel
	p.scale_amount_min = size * 0.5
	p.scale_amount_max = size
	p.color = color
	p.restart()
	p.emitting = true

func impact(pos: Vector3, normal: Vector3) -> void:
	_burst(pos, normal, Color(0.55, 0.5, 0.42), 10, 3.0, 0.4, 0.07)
	if randf() < 0.3:
		_burst(pos, normal, Color(1.0, 0.8, 0.4), 5, 5.0, 0.15, 0.03)
	Sfx.play_at("impact", pos, -12.0)

func blood(pos: Vector3, normal: Vector3, mutant: bool = false) -> void:
	_burst(pos, normal, Color(0.45, 0.04, 0.03) if not mutant else Color(0.35, 0.05, 0.04), 12, 2.5, 0.45, 0.07)
	Sfx.play_at("hit", pos, -6.0)

func explosion(pos: Vector3) -> void:
	_burst(pos, Vector3.UP, Color(1.0, 0.55, 0.15), 30, 9.0, 0.6, 0.25)
	_burst(pos, Vector3.UP, Color(0.25, 0.23, 0.2), 24, 5.0, 1.2, 0.35)
	_flash_light.global_position = pos + Vector3(0, 1, 0)
	_flash_light_t = 0.25
