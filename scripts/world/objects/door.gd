class_name Door
extends Interactable
## Распашная дверь. Генерал открывает её действием, союзники — автоматически при подходе.

var door_id := ""
var width := 1.4
var is_open := false
var _angle := 0.0
var _hinge: Node3D
var _body: AnimatableBody3D
var _auto_t := 0.0
var _opened_by_npc := false

func _ready() -> void:
	super()
	radius = 2.0
	_hinge = Node3D.new()
	_hinge.position = Vector3(-width * 0.5 + 0.05, 0, 0)
	add_child(_hinge)
	var mb := MeshBuilder.new()
	var c := Color(0.3, 0.32, 0.28, 0.2)
	mb.add_box(Transform3D(Basis(), Vector3(width * 0.5 - 0.05, 1.12, 0)), Vector3(width - 0.12, 2.2, 0.06), c)
	mb.add_box(Transform3D(Basis(), Vector3(width - 0.25, 1.05, 0.05)), Vector3(0.12, 0.03, 0.05), Color(0.6, 0.6, 0.55, 0.2))
	mb.add_box(Transform3D(Basis(), Vector3(width * 0.5, 1.8, 0.035)), Vector3(width * 0.5, 0.4, 0.01), c.darkened(0.2))
	var mi := MeshInstance3D.new()
	mi.mesh = mb.build(Mats.world(true))
	_hinge.add_child(mi)
	_body = AnimatableBody3D.new()
	_body.collision_layer = 128
	_body.collision_mask = 0
	_body.sync_to_physics = false
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(width - 0.12, 2.2, 0.08)
	cs.shape = bs
	cs.position = Vector3(width * 0.5 - 0.05, 1.12, 0)
	_body.add_child(cs)
	_hinge.add_child(_body)
	is_open = Game.world_state.get("doors", {}).get(door_id, false)
	_angle = 1.0 if is_open else 0.0
	_apply()

func interact_prompt() -> String:
	return "Закрыть дверь" if is_open else "Открыть дверь"

func interact(_actor: Node) -> void:
	set_open(not is_open)

func set_open(v: bool) -> void:
	if v == is_open:
		return
	is_open = v
	Game.world_state.doors[door_id] = v
	Sfx.play_at("door", global_position + Vector3(0, 1, 0), -4.0)

func _physics_process(delta: float) -> void:
	var target := 1.0 if is_open else 0.0
	if absf(_angle - target) > 0.001:
		_angle = move_toward(_angle, target, delta * 2.5)
		_apply()
	_auto_t -= delta
	if _auto_t <= 0.0:
		_auto_t = 0.3
		var near := false
		for s in get_tree().get_nodes_in_group("allies"):
			if s != Game.player and (s as Node3D).global_position.distance_to(global_position) < 2.2:
				near = true
				break
		if near and not is_open:
			_opened_by_npc = true
			set_open(true)

func _apply() -> void:
	_hinge.rotation.y = -_angle * 1.75
	# створка блокирует проход только закрытой: открытая/открывающаяся не должна зажимать персонажей в проёме
	if _body:
		_body.collision_layer = 128 if _angle < 0.02 else 0
