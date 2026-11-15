extends Node
## StarCore — игровая платформа «Дрейфа» поверх Godot (2D, вид сверху под углом). Godot отвечает за рендер,
## физику и Android; StarCore — за проекцию 2.5D (SP), корабль и отсеки, персонажей со спрайтами 8 направлений,
## дронов и турели, цикл «тишина → прыжок → событие», сенсорное управление, интерфейс, сохранение и звук.
## Доступ отовсюду: Core.mobile, Core.save, Core.player, Core.hud, Core.ship, Core.loop.

signal message(text: String, kind: String)

var mobile: Node
var save: Node
var player: Node = null
var hud: Node = null
var ship: Node = null
var loop: Node = null
var test_mode := ""


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--st-test="):
			test_mode = a.substr(10)
	mobile = _add("MobileSystem", preload("res://core/mobile/mobile_system.gd"))
	save = _add("SaveSystem", preload("res://core/save/save_system.gd"))


func _add(n: String, scr: Script) -> Node:
	var node: Node = scr.new()
	node.name = n
	add_child(node)
	return node


func say(text: String, kind := "info") -> void:
	message.emit(text, kind)


# ---------------- звуки ----------------
var _sfx_cache := {}

## звук по имени: res://assets/audio/<имя>.ogg/.wav; варианты <имя>_1.._12 — случайный
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


## разовый звук в точке экрана (слышно в пределах ~15 м)
func play_at(n: String, pos: Vector2, vol_db := 0.0, pitch_rand := 0.08) -> void:
	var st := sfx(n)
	if st == null or not is_inside_tree() or get_tree().current_scene == null:
		return
	var p := AudioStreamPlayer2D.new()
	p.stream = st
	p.volume_db = vol_db
	p.pitch_scale = randf_range(1.0 - pitch_rand, 1.0 + pitch_rand)
	p.max_distance = 1000.0
	get_tree().current_scene.add_child(p)
	p.global_position = pos
	p.finished.connect(p.queue_free)
	p.play()


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
	if what == NOTIFICATION_APPLICATION_PAUSED or what == NOTIFICATION_WM_CLOSE_REQUEST:
		if save and player:
			save.save_game()
