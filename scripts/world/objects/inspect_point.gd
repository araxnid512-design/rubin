class_name InspectPoint
extends Interactable
## Точка осмотра для задания.

var point_id := ""
var text := ""

func _ready() -> void:
	super()
	prompt = "Осмотреть"
	radius = 3.0
	anim = "use"

func can_interact(_actor: Node) -> bool:
	return Quest.wants_inspect(point_id) and not Game.flags.get(point_id, false)

func interact(_actor: Node) -> void:
	Game.set_flag(point_id)
	Events.msg(text, Events.Msg.INFO)
	Events.area_visited.emit(point_id)
