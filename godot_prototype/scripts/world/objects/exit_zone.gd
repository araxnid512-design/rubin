class_name ExitZone
extends Interactable
## Выход на соседнюю локацию (переход по краю карты).

var exit_id := ""
var title := ""

func _ready() -> void:
	super()
	radius = 6.0

func interact_prompt() -> String:
	return "Выход: " + title

func interact(_actor: Node) -> void:
	Events.ui_open.emit("exit", {"id": exit_id, "name": title})
