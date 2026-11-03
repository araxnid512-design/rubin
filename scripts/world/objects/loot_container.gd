class_name LootContainer
extends Interactable
## Контейнер с добычей (ящик, шкаф, сейф, машина). Открывается окном обмена.

var container_id := ""
var title := "Ящик"
var kind := "crate"
var items := {}

func _ready() -> void:
	super()
	radius = 2.3
	var saved: Dictionary = Game.world_state.containers
	if saved.has(container_id):
		items = saved[container_id].duplicate()
	_build_mesh()

func _build_mesh() -> void:
	var mb := MeshBuilder.new()
	var col: Array = []
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(container_id)
	match kind:
		"crate": Props.crate(mb, col, Transform3D(Basis(Vector3.UP, 0.3), Vector3.ZERO), Vector3(1.0, 0.7, 0.7))
		"ammobox", "weaponbox": Props.ammo_box(mb, col, Transform3D(Basis(), Vector3.ZERO)); Props.ammo_box(mb, null, Transform3D(Basis(Vector3.UP, 0.2), Vector3(0, 0.42, 0)))
		"locker": Props.locker(mb, col, Transform3D(Basis(), Vector3.ZERO))
		"cabinet": Props.cabinet(mb, col, Transform3D(Basis(), Vector3.ZERO))
		"safe": Props.safe_box(mb, col, Transform3D(Basis(), Vector3.ZERO))
		"desk": Props.table(mb, col, Transform3D(Basis(), Vector3.ZERO), Vector2(1.4, 0.7))
		"toolbox": Props.toolbox(mb, Transform3D(Basis(), Vector3.ZERO))
		"shelf": Props.crate(mb, col, Transform3D(Basis(), Vector3.ZERO), Vector3(0.8, 0.6, 0.6))
		"bag":
			mb.add_box(Transform3D(Basis(Vector3.FORWARD, 0.4), Vector3(0, 0.18, 0)), Vector3(0.45, 0.35, 0.3), Color(0.25, 0.24, 0.17, 0.5))
		"vehicle":
			pass
	var mi := MeshInstance3D.new()
	mi.mesh = mb.build(Mats.world(true))
	add_child(mi)
	if not col.is_empty():
		var b := StaticBody3D.new()
		b.collision_layer = 1
		for c in col:
			var cs := CollisionShape3D.new()
			var bs := BoxShape3D.new()
			bs.size = c[1]
			cs.shape = bs
			cs.transform = c[0]
			b.add_child(cs)
		add_child(b)

func is_empty() -> bool:
	return items.is_empty()

func interact_prompt() -> String:
	return "Обыскать: %s%s" % [title, " (пусто)" if items.is_empty() else ""]

func interact(_actor: Node) -> void:
	Sfx.play_at("door", global_position, -10.0, 1.6)
	Events.ui_open.emit("loot", self)
	Events.area_visited.emit("open_" + container_id)

func take(id: String, n: int) -> int:
	var have := int(items.get(id, 0))
	n = mini(n, have)
	if n <= 0:
		return 0
	var left := Game.give_player(id, n, {"ammo": ItemDB.weapon(id).get("mag", 0)} if ItemDB.is_weapon(id) else {})
	var taken := n - left
	if taken > 0:
		items[id] = have - taken
		if items[id] <= 0:
			items.erase(id)
		Game.world_state.containers[container_id] = items.duplicate()
		Events.area_visited.emit("took_" + id)
	return taken

func take_all() -> int:
	var total := 0
	for id in items.keys():
		total += take(id, int(items[id]))
	return total
