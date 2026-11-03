class_name Interactable
extends Node3D
## Базовый интерактивный объект: генерал подходит и нажимает «Действие».
## hold_time > 0 — действие с удержанием (разбор завала, ремонт и т.п.).

@export var prompt := "Действие"
@export var hold_time := 0.0
@export var radius := 2.2
var enabled := true
var anim := "use"

func _ready() -> void:
	add_to_group("interactable")

func interact_pos() -> Vector3:
	return global_position

func interact_prompt() -> String:
	return prompt

func interact_hold() -> float:
	return hold_time

func interact_anim() -> String:
	return anim

func can_interact(_actor: Node) -> bool:
	return enabled and is_visible_in_tree()

func interact(_actor: Node) -> void:
	pass
