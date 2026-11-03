class_name Rubble
extends Interactable
## Завал у входа в здание. Разбирается удержанием «Действия»; даёт материалы.

var building_id := ""
var _mi: MeshInstance3D
var _body: StaticBody3D

func _ready() -> void:
	super()
	prompt = "Разобрать завал"
	hold_time = 4.0
	radius = 3.2
	anim = "repair"
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(building_id)
	var mb := MeshBuilder.new()
	Props.rubble_pile(mb, null, Vector3.ZERO, 1.8, rng, 1.5)
	for i in 3:
		mb.beam(Vector3(rng.randf_range(-1, 1), 0.2, rng.randf_range(-1, 1)), Vector3(rng.randf_range(-1.5, 1.5), 1.4, rng.randf_range(-1, 1)), 0.18, 0.18, Color(0.4, 0.3, 0.2, 0.4))
	_mi = MeshInstance3D.new()
	_mi.mesh = mb.build(Mats.world(true))
	add_child(_mi)
	_body = StaticBody3D.new()
	_body.collision_layer = 1
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(3.2, 1.6, 3.2)
	cs.shape = bs
	cs.position = Vector3(0, 0.8, 0)
	_body.add_child(cs)
	add_child(_body)
	add_to_group("nav_obstacles")

func interact(_actor: Node) -> void:
	Game.world_state.rubble[building_id] = true
	Game.give_player("scrap", 3)
	Game.give_player("planks", 1)
	Events.msg("Завал разобран: +3 металлолома, +1 доска.", Events.Msg.GOOD)
	Events.area_visited.emit("rubble_" + building_id)
	Events.building_changed.emit(building_id)
	queue_free()
	if Game.world:
		Game.world.request_nav_rebake()

func nav_box() -> Array:
	return [Transform3D(Basis(), global_position + Vector3(0, 0.8, 0)), Vector3(3.2, 1.6, 3.2)]
