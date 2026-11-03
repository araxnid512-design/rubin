class_name Salvage
extends Interactable
## Куча металлолома/досок: разбирается удержанием «Действия».

var salvage_id := ""
var res_id := "scrap"
var amount := 3

func _ready() -> void:
	super()
	hold_time = 2.5
	radius = 2.2
	anim = "repair"
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(salvage_id)
	var mb := MeshBuilder.new()
	if res_id == "planks":
		Props.plank_stack(mb, null, Vector3.ZERO, rng.randf() * PI, rng)
		Props.pallet(mb, Transform3D(Basis(Vector3.UP, 0.4), Vector3(0.6, 0, 1.0)))
	else:
		Props.scrap_heap(mb, null, Vector3.ZERO, rng)
	var mi := MeshInstance3D.new()
	mi.mesh = mb.build(Mats.world(true))
	add_child(mi)

func interact_prompt() -> String:
	return "Разобрать: %s" % ItemDB.item_name(res_id)

func interact(_actor: Node) -> void:
	var left := Game.give_player(res_id, amount)
	if left >= amount:
		Events.msg("Нет места в рюкзаке.", Events.Msg.ALERT)
		return
	Events.msg("Получено: %s ×%d" % [ItemDB.item_name(res_id), amount - left], Events.Msg.INFO)
	Sfx.play("pickup")
	Game.world_state.salvage[salvage_id] = true
	queue_free()
