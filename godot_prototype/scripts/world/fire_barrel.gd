class_name FireBarrel
extends Node3D
## Огонь в бочке: свет с мерцанием и частицы.

var light: OmniLight3D
var _t := 0.0

func _ready() -> void:
	light = OmniLight3D.new()
	light.position = Vector3(0, 1.4, 0)
	light.omni_range = 9.0
	light.light_color = Color(1.0, 0.55, 0.22)
	light.light_energy = 1.6
	add_child(light)
	var p := CPUParticles3D.new()
	p.position = Vector3(0, 0.9, 0)
	p.amount = 18
	p.lifetime = 0.7
	p.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	p.emission_sphere_radius = 0.18
	p.direction = Vector3.UP
	p.spread = 15.0
	p.gravity = Vector3(0, 2.0, 0)
	p.initial_velocity_min = 0.4
	p.initial_velocity_max = 1.0
	p.scale_amount_min = 0.2
	p.scale_amount_max = 0.4
	var q := QuadMesh.new()
	q.size = Vector2(0.5, 0.5)
	p.mesh = q
	var m := Mats.additive(Color(1.0, 0.5, 0.15, 0.8), 2.5).duplicate()
	(m as ShaderMaterial).shader = load("res://shaders/fx_billboard.gdshader")
	(m as ShaderMaterial).set_shader_parameter("color", Color(1.0, 0.5, 0.15, 0.8))
	p.material_override = m
	var g := Gradient.new()
	g.set_color(0, Color(1, 1, 1, 1))
	g.set_color(1, Color(1, 1, 1, 0))
	p.color_ramp = g
	add_child(p)

func _process(delta: float) -> void:
	_t += delta
	light.light_energy = 1.4 + sin(_t * 13.0) * 0.15 + sin(_t * 7.3) * 0.12
