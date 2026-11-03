class_name RepairSpot
extends Interactable
## Точка ремонта: генерал удерживает «Действие», чтобы вести работы (доступно, пока идёт ремонт/улучшение).

var building: Node

func _ready() -> void:
	super()
	radius = 3.0
	anim = "repair"

func can_interact(_actor: Node) -> bool:
	return Game.building_job(building.id) != ""

func interact_prompt() -> String:
	var need := Game.building_work_needed(building.id)
	return "Ремонтировать: %s (%d%%)" % [building.def.name, int(Game.building_progress(building.id) / need * 100.0)]

func interact_hold() -> float:
	return -1.0   # непрерывная работа

func work(_actor: Node, delta: float) -> void:
	Game.add_work(building.id, delta * 1.0)
	if randf() < delta * 2.0:
		Sfx.play_at("hammer", global_position + Vector3(0, 1, 0), -6.0)
