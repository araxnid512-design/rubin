class_name Anomaly
extends Node3D
## Аномалии: «Электра» (разряды), «Жарка» (вспышки пламени), радиационные пятна.

var kind := "electro"
var radius := 3.0
var _t := 0.0
var _cool := 0.0
var _vis: MeshInstance3D
var _light: OmniLight3D
var _burst := 0.0

func _ready() -> void:
	add_to_group("anomalies")
	if kind == "rad":
		return
	_vis = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(radius * 2.4, radius * 2.4)
	q.orientation = PlaneMesh.FACE_Y
	_vis.mesh = q
	_vis.position.y = 0.05
	_vis.material_override = Mats.anomaly(Color(0.35, 0.65, 1.0, 0.8) if kind == "electro" else Color(1.0, 0.45, 0.1, 0.8))
	_vis.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_vis)
	var v2 := MeshInstance3D.new()
	var q2 := QuadMesh.new()
	q2.size = Vector2(radius * 1.6, radius * 2.2)
	v2.mesh = q2
	v2.position.y = radius * 0.9
	v2.material_override = _vis.material_override
	v2.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(v2)
	var v3 := v2.duplicate()
	v3.rotation.y = PI / 2
	add_child(v3)
	_light = OmniLight3D.new()
	_light.position.y = 1.0
	_light.omni_range = radius * 3.0
	_light.light_color = Color(0.4, 0.7, 1.0) if kind == "electro" else Color(1.0, 0.5, 0.15)
	_light.light_energy = 0.0
	add_child(_light)

func _physics_process(delta: float) -> void:
	_t += delta
	_cool -= delta
	_burst = maxf(0.0, _burst - delta * 3.0)
	if _light:
		_light.light_energy = 0.4 + _burst * 4.0 + (sin(_t * 23.0) * 0.2 if kind == "electro" else sin(_t * 3.0) * 0.15)
	var p: Node3D = Game.player
	for a in get_tree().get_nodes_in_group("actors"):
		var actor := a as Node3D
		if actor == null or not actor.has_method("take_damage"):
			continue
		var d := Vector2(actor.global_position.x - global_position.x, actor.global_position.z - global_position.z).length()
		if kind == "rad":
			if actor == p and d < radius:
				p.add_radiation(delta * 6.0 * (1.0 - d / radius) + delta * 1.5)
			continue
		if d < radius and _cool <= 0.0:
			_cool = 1.2
			_burst = 1.0
			actor.take_damage(18.0 if kind == "electro" else 22.0, self, actor.global_position + Vector3(0, 1, 0), Vector3.UP)
			Sfx.play_at("zap" if kind == "electro" else "fire", global_position, 0.0)
