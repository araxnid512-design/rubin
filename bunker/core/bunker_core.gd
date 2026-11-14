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
##   quest   (QuestSystem)       — задания, журнал, ресурсы убежища, точки использования, метка цели
##   craft   (CraftSystem)       — добыча, мастерская, ремонт помещений, питание по помещениям, обмен
## Персонаж, анимации и интерфейс создаются сценой игры и регистрируются здесь (Core.player, Core.hud).

const VERSION := "0.1.0"

signal player_registered(player)
signal zone_changed(zone_info: Dictionary)
signal message(text: String, kind: String)

var world: Node
var env: Node
var mobile: Node
var save: Node
var quest: Node
var craft: Node
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
	quest = _add("QuestSystem", preload("res://core/quest/quest_system.gd"))
	craft = _add("CraftSystem", preload("res://core/craft/craft_system.gd"))


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


# ---------------- звуки ----------------
var _sfx_cache := {}

## звук по имени: res://assets/audio/<имя>.ogg или .wav. Если есть варианты <имя>_1, <имя>_2 … — каждый раз
## случайный из них (шаги, удары не повторяются одинаково). Нет файла — null, игра продолжается без звука.
func sfx(n: String) -> AudioStream:
	if not _sfx_cache.has(n):
		var list: Array = []
		for i in range(1, 13):
			for ext in ["ogg", "wav"]:
				var p := "res://assets/audio/%s_%d.%s" % [n, i, ext]
				if ResourceLoader.exists(p):
					list.append(load(p))
		if list.is_empty():
			for ext in ["ogg", "wav"]:
				var p := "res://assets/audio/%s.%s" % [n, ext]
				if ResourceLoader.exists(p):
					list.append(load(p))
					break
		_sfx_cache[n] = list
	var l: Array = _sfx_cache[n]
	return null if l.is_empty() else l.pick_random()


## разовый звук в точке мира (удар, подбор, рычание); громкость в дБ, высота тона слегка случайная
func play_at(n: String, pos: Vector3, vol_db := 0.0, pitch_rand := 0.08) -> void:
	var st := sfx(n)
	if st == null or world == null or not is_inside_tree():
		return
	var p := AudioStreamPlayer3D.new()
	p.stream = st
	p.volume_db = vol_db
	p.pitch_scale = randf_range(1.0 - pitch_rand, 1.0 + pitch_rand)
	p.unit_size = 6.0
	p.max_distance = 40.0
	get_tree().current_scene.add_child(p)
	p.global_position = pos
	p.reset_physics_interpolation()
	p.finished.connect(p.queue_free)
	p.play()


## звук интерфейса (без положения в мире)
func play_ui(n: String, vol_db := -6.0) -> void:
	var st := sfx(n)
	if st == null:
		return
	var p := AudioStreamPlayer.new()
	p.stream = st
	p.volume_db = vol_db
	add_child(p)
	p.finished.connect(p.queue_free)
	p.play()


func _notification(what: int) -> void:
	# сворачивание на телефоне: сохранить и приостановить
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if save and player:
			save.save_game()
