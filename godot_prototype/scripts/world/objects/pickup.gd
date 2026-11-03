class_name Pickup
extends Interactable
## Предмет, лежащий на земле.

var pickup_id := ""
var item_id := ""
var count := 1

func _ready() -> void:
	super()
	radius = 1.8
	anim = "pickup"
	var mb := MeshBuilder.new()
	var c: Color = ItemDB.get_item(item_id).get("color", Color.WHITE)
	var cat: int = ItemDB.get_item(item_id).get("cat", 0)
	match cat:
		ItemDB.Cat.AMMO:
			Props.ammo_box(mb, null, Transform3D(Basis().scaled(Vector3(0.45, 0.45, 0.45)), Vector3.ZERO))
		ItemDB.Cat.MED:
			mb.add_box(Transform3D(Basis(), Vector3(0, 0.08, 0)), Vector3(0.3, 0.16, 0.2), Color(c.r, c.g, c.b, 0.2))
			mb.add_box(Transform3D(Basis(), Vector3(0, 0.165, 0)), Vector3(0.12, 0.01, 0.04), Color(0.9, 0.1, 0.1, 0.2))
		ItemDB.Cat.RESOURCE:
			if item_id == "planks":
				for i in 3:
					mb.add_box(Transform3D(Basis(Vector3.UP, i * 0.2), Vector3(0, 0.05 + i * 0.1, 0)), Vector3(1.6, 0.08, 0.2), Color(0.55, 0.42, 0.26, 0.4))
			elif item_id == "scrap":
				var rng := RandomNumberGenerator.new()
				rng.seed = hash(pickup_id)
				for i in 4:
					mb.add_box(Transform3D(Basis(Vector3.UP, rng.randf() * 3.0) * Basis(Vector3.RIGHT, rng.randf() * 0.5), Vector3(rng.randf_range(-0.2, 0.2), 0.05, rng.randf_range(-0.2, 0.2))), Vector3(0.5, 0.04, 0.3), Color(0.42, 0.26, 0.15, 0.3))
			else:
				mb.add_box(Transform3D(Basis(), Vector3(0, 0.15, 0)), Vector3(0.4, 0.3, 0.3), Color(c.r, c.g, c.b, 0.2))
		_:
			mb.add_box(Transform3D(Basis(), Vector3(0, 0.1, 0)), Vector3(0.3, 0.2, 0.25), Color(c.r, c.g, c.b, 0.2))
	var mi := MeshInstance3D.new()
	mi.mesh = mb.build(Mats.world(false))
	add_child(mi)
	_add_marker()

func _add_marker() -> void:
	var ring := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.45
	tm.outer_radius = 0.55
	tm.rings = 16
	tm.ring_segments = 4
	ring.mesh = tm
	ring.material_override = Mats.additive(Color(1.0, 0.75, 0.3, 0.6), 1.5)
	ring.position.y = 0.03
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(ring)

func interact_prompt() -> String:
	return "Подобрать: %s ×%d" % [ItemDB.item_name(item_id), count]

func interact(_actor: Node) -> void:
	var left := Game.give_player(item_id, count)
	if left >= count:
		Events.msg("Нет места в рюкзаке.", Events.Msg.ALERT)
		return
	Sfx.play("pickup")
	Events.msg("Подобрано: %s ×%d" % [ItemDB.item_name(item_id), count - left], Events.Msg.INFO)
	if left > 0:
		count = left
		return
	Game.world_state.taken[pickup_id] = true
	queue_free()
