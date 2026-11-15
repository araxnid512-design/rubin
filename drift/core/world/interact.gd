class_name STInteract
extends Node2D
## Точка взаимодействия StarCore: герой подходит — на кнопке «Действие» подпись, нажатие — действие.
## action: inspect (текст), terminal (окно), use (игровая логика по target — сигнал used), pickup (вещь target).
## Рисует подсветку-круг под собой, когда герой рядом.

signal used(by)

@export var point_id := ""
@export var action := "inspect"
@export var label := "Осмотреть"
@export var verb := "Осмотр"
@export_multiline var text := ""
@export var target := ""
@export var radius := 1.3            ## м
var enabled := true
var highlight := false


func _ready() -> void:
	add_to_group("interact")


func in_reach(p: Vector2) -> bool:
	return enabled and SP.dist_m(p, global_position) <= radius


func interact(by: Node) -> void:
	match action:
		"inspect":
			Core.hud.show_text(label, text)
		"pickup":
			if by.has_method("inventory_add"):
				by.inventory_add(target)
			Core.say("Подобрано: " + label.replace("Подобрать: ", ""), "good")
			enabled = false
			visible = false
	used.emit(by)


func _process(_d: float) -> void:
	var h: bool = Core.player != null and Core.player.target == self
	if h != highlight:
		highlight = h
		queue_redraw()


func _draw() -> void:
	if not highlight:
		return
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, SP.K))
	draw_arc(Vector2.ZERO, 26.0, 0, TAU, 32, Color(1.0, 0.8, 0.3, 0.8), 2.0, true)
