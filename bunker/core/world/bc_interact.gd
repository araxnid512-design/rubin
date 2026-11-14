@tool
class_name BCInteract
extends Node3D
## Точка взаимодействия BunkerCore: игрок подходит, на экране появляется кнопка с подписью, нажатие выполняет
## действие. Узел ставится у предмета (стол с терминалом, кровать, шкаф с костюмом, выключатель …). Действия:
##   inspect  — осмотреть (текст на экране);
##   terminal — терминал: окно с данными бункера;
##   bed      — лечь отдохнуть (восстанавливает выносливость и немного здоровья, время идёт);
##   chair    — сесть;
##   medbay   — медоборудование: лечение и выведение радиации;
##   suit     — надеть или снять защитный костюм;
##   switch   — выключатель света группы `target`;
##   pickup   — подобрать предмет (`target` — id предмета в инвентаре).
## `anchor` — где встаёт герой и куда смотрит (локально): x,z и угол в градусах.

@export var point_id := ""
@export_enum("inspect", "terminal", "bed", "chair", "medbay", "suit", "switch", "pickup") var action := "inspect"
@export var label := "Осмотреть"
@export_multiline var text := ""
@export var target := ""
@export var sensor_size := Vector3(1.4, 2.0, 1.4)
@export var anchor := Vector3(0, 0, 0.8)   ## x, z — точка героя; y — угол поворота (градусы)
@export var used := false                  ## для pickup: уже подобран

signal used_by(player)


func _ready() -> void:
	if Engine.is_editor_hint():
		return
	if point_id == "":
		point_id = str(get_path())
	Core.world.register(point_id, self)
	BCKit.sensor(self, self, sensor_size, Vector3(0, sensor_size.y * 0.5, 0))
	if used and action == "pickup":
		_hide_pickup()


func interact_label() -> String:
	if action == "switch":
		var any_on := false
		for l in get_tree().get_nodes_in_group("bc_light:" + target):
			any_on = any_on or l.on
		return ("Выключить свет" if any_on else "Включить свет") + (": " + label if label != "" else "")
	if action == "suit" and Core.player:
		return "Снять защитный костюм" if Core.player.suit_on else "Надеть защитный костюм"
	return label


func can_interact(_p) -> bool:
	return not (action == "pickup" and used)


## какую анимацию играет герой (имя клипа BunkerCore) и где он должен стоять
func interact_anim(p) -> String:
	match action:
		"terminal": return "terminal"
		"bed": return "bed_lie"
		"chair": return "sit_down"
		"medbay": return "terminal"
		"suit": return "suit_off" if p.suit_on else "suit_on"
		"switch": return "terminal"
		"pickup": return "pickup"
	return "inspect"


func stand_point() -> Transform3D:
	var b := Basis(Vector3.UP, deg_to_rad(anchor.y))
	return global_transform * Transform3D(b, Vector3(anchor.x, 0, anchor.z))


func interact(p) -> void:
	match action:
		"inspect":
			Core.hud.show_text(label, text)
		"terminal":
			Core.hud.show_terminal(target)
		"bed":
			p.rest()
		"chair":
			p.sit()
		"medbay":
			p.treat()
		"suit":
			p.toggle_suit()
		"switch":
			var lights := get_tree().get_nodes_in_group("bc_light:" + target)
			var any_on := false
			for l in lights:
				any_on = any_on or l.on
			for l in lights:
				l.set_on(not any_on)
		"pickup":
			used = true
			p.inventory_add(target)
			Core.say("Подобрано: " + label.replace("Подобрать: ", ""), "good")
			_hide_pickup()
			Core.world.notify_state(point_id)
	used_by.emit(p)


func _hide_pickup() -> void:
	var tg := get_parent()
	if tg and tg.has_meta("pickup_mesh"):
		tg.visible = false


func get_state() -> Dictionary:
	return {"used": used}


func set_state(s: Dictionary) -> void:
	used = s.get("used", used)
	if used and action == "pickup":
		_hide_pickup()
