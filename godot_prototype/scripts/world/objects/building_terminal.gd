class_name BuildingTerminal
extends Interactable
## Панель управления зданием.

var building: Node

func _ready() -> void:
	super()
	radius = 2.4
	var mb := MeshBuilder.new()
	mb.add_box(Transform3D(Basis(), Vector3(0, 0.55, 0)), Vector3(0.08, 1.1, 0.08), Color(0.3, 0.3, 0.3, 0.2))
	mb.add_box(Transform3D(Basis(Vector3.RIGHT, -0.5), Vector3(0, 1.15, 0)), Vector3(0.45, 0.32, 0.06), Color(0.22, 0.25, 0.22, 0.2))
	mb.add_box(Transform3D(Basis(Vector3.RIGHT, -0.5), Vector3(0, 1.17, -0.03)), Vector3(0.36, 0.22, 0.01), Color(0.95, 0.55, 0.15, 0.8))
	var mi := MeshInstance3D.new()
	mi.mesh = mb.build(Mats.world(false))
	add_child(mi)

func interact_prompt() -> String:
	return "Панель: " + String(building.def.name)

func interact(_actor: Node) -> void:
	Events.ui_open.emit("building", building.id)
