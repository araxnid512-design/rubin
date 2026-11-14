extends Node
## Встречи на поверхности BUNKER SURVIVAL: кто и когда появляется.
##   * мародёр у разрушенной постройки — с самого начала (один);
##   * задание «Мародёр у ворот» взято — у постройки лагерь: главарь с трубой и двое мародёров;
##   * патруль: каждые ~4 игровых часа, если наверху меньше двух живых мародёров, от северных ворот приходят 1–2;
##   * ночью (21:00–5:00) бродят мутанты (если есть модель мутанта); на рассвете уходят.
## Враги видны и действуют только снаружи (группа surface_only).

const RAIDER := ["res://assets/models/raider.glb", "res://assets/anim/raider"]
const LEADER := ["res://assets/models/leader.glb", "res://assets/anim/leader"]
const MUTANT := ["res://assets/models/mutant.glb", "res://assets/anim/mutant"]
const CAMP := Vector3(23.0, 0.3, -15.0)
const GATE := Vector3(0.0, 0.2, 27.0)

var _patrol_h := -1.0
var _leader_spawned := false


func _ready() -> void:
	if Core.quest:
		Core.quest.changed.connect(_on_quest)


func start() -> void:
	spawn("raider", Vector3(24.0, 0.3, -12.0), "raider", "Мародёр")
	_on_quest()


func _on_quest() -> void:
	var q = Core.quest
	if q == null or _leader_spawned:
		return
	if q.quests.get("q_raider", {}).get("state", "") == "active":
		_leader_spawned = true
		spawn("leader", CAMP, "leader", "Главарь мародёров")
		spawn("raider", CAMP + Vector3(-2.0, 0, 1.5), "", "Мародёр")
		spawn("raider", CAMP + Vector3(2.0, 0, 1.8), "", "Мародёр")


func spawn(variant: String, pos: Vector3, id: String, name: String) -> BCNpc:
	var m: Array = {"leader": LEADER, "mutant": MUTANT}.get(variant, RAIDER)
	if not ResourceLoader.exists(m[0]):
		if variant == "mutant":
			return null            # без модели мутанта ночью никого
		m = RAIDER
	var e := BCNpc.new()
	e.role = "enemy"
	e.variant = variant
	e.model_path = m[0]
	e.anim_set = m[1]
	e.display_name = name
	e.kind = variant
	if id != "":
		e.npc_id = id
	e.add_to_group("surface_only")
	get_parent().add_child(e)
	e.global_position = ground(pos)
	if variant == "leader" and m == RAIDER:
		e.scale = Vector3.ONE * 1.08   # пока нет своей модели — крупнее обычного мародёра
	return e


func _alive(variant: String) -> Array:
	var out := []
	for n in get_tree().get_nodes_in_group("enemy"):
		if n is BCNpc and n.variant == variant and n.state != "dead":
			out.append(n)
	return out


func _process(_d: float) -> void:
	var p = Core.player
	if p == null:
		return
	var h: float = p.game_time / 3600.0
	if _patrol_h < 0.0:
		_patrol_h = h + 4.0
	# патруль от ворот
	if h >= _patrol_h:
		_patrol_h = h + 4.0
		if _alive("raider").size() < 2:
			var n := 1 + int(randf() < 0.5)
			for i in n:
				var e := spawn("raider", GATE + Vector3(i * 1.6, 0, 0), "", "Мародёр")
				e.points = [Vector3(6.0, 0.2, 12.0), Vector3(-6.0, 0.2, 2.0)]
			if not Core.world.underground:
				Core.say("Снаружи голоса — к убежищу идут мародёры.", "warn")
	# мутанты ночью
	var night: bool = p.is_night()
	var muts := _alive("mutant")
	if night and muts.size() < 2 and ResourceLoader.exists(MUTANT[0]):
		var spots := [Vector3(-30.0, 0.2, -36.0), Vector3(30.0, 0.2, 18.0), Vector3(-28.0, 0.2, 22.0)]
		spawn("mutant", spots[randi() % spots.size()], "", "Мутант")
	elif not night and not muts.is_empty():
		for m in muts:
			if m.global_position.distance_to(p.global_position) > 25.0:
				m.queue_free()


## точка на земле под pos (луч сверху вниз по миру): рельеф неровный, иначе враг мог появиться под землёй
func ground(pos: Vector3) -> Vector3:
	var space: PhysicsDirectSpaceState3D = (get_parent() as Node3D).get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(Vector3(pos.x, 30.0, pos.z), Vector3(pos.x, -3.0, pos.z), BCKit.LAYER_WORLD)
	var hit: Dictionary = space.intersect_ray(q)
	return (hit.position + Vector3(0, 0.05, 0)) if hit else pos
