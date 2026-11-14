extends Node
## BunkerCore — собственная игровая платформа поверх Godot.
## Godot отвечает за рендер, физику и Android; BunkerCore — за мир, персонажа, анимацию, среду, мобильные
## системы, сохранение и инструменты редактора. Доступ из любого скрипта: Core.world, Core.env, Core.mobile …
##
## Подсистемы — обычные узлы-дети этого автозагрузочного узла:
##   world   (WorldSystem)       — локации, зоны, состояние объектов, переходы внутри/снаружи
##   env     (EnvironmentSystem) — свет, туман, погода, звуки среды, радиация
##   mobile  (MobileSystem)      — разрешение, качество графики, FPS, память, безопасные области экрана
##   save    (SaveSystem)        — сохранение и загрузка (user://save.json)
## Персонаж, анимации и интерфейс создаются сценой игры и регистрируются здесь (Core.player, Core.hud).

const VERSION := "0.1.0"

signal player_registered(player)
signal zone_changed(zone_info: Dictionary)
signal message(text: String, kind: String)

var world: Node
var env: Node
var mobile: Node
var save: Node
var player: Node = null
var hud: Node = null
var debug := false
var test_mode := ""          ## задаётся из командной строки: --bc-test=<имя> (автотесты под Xvfb)


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-test="):
			test_mode = a.substr(10)
		if a == "--bc-debug":
			debug = true
	world = _add("WorldSystem", preload("res://core/world/world_system.gd"))
	env = _add("EnvironmentSystem", preload("res://core/environment/env_system.gd"))
	mobile = _add("MobileSystem", preload("res://core/mobile/mobile_system.gd"))
	save = _add("SaveSystem", preload("res://core/save/save_system.gd"))


func _add(n: String, scr: Script) -> Node:
	var node: Node = scr.new()
	node.name = n
	add_child(node)
	return node


func register_player(p: Node) -> void:
	player = p
	player_registered.emit(p)


func say(text: String, kind := "info") -> void:
	message.emit(text, kind)


func _notification(what: int) -> void:
	# сворачивание на телефоне: сохранить и приостановить
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if save and player:
			save.save_game()
