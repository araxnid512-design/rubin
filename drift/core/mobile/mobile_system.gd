extends Node
## MobileSystem StarCore: настройки (качество, FPS, звук, панель разработчика), замер FPS, безопасная область.
## Качество: 0 — низкое (свет только в своём отсеке, меньше частиц), 1 — среднее, 2 — высокое.

signal settings_changed

const FILE := "user://settings.json"
var settings := {"quality": 1, "fps": 30, "dev": false, "sound": 1.0, "joy_size": 1.0, "joy_opacity": 0.55}
var fps_avg := 0.0
var _hist: Array = []


func _ready() -> void:
	_load()
	apply.call_deferred()


func _process(delta: float) -> void:
	_hist.append(delta)
	if _hist.size() > 120:
		_hist.pop_front()
	var s := 0.0
	for d in _hist:
		s += d
	fps_avg = _hist.size() / maxf(s, 0.0001)


func set_value(k: String, v) -> void:
	settings[k] = v
	apply()
	_save()
	settings_changed.emit()


func apply() -> void:
	Engine.max_fps = int(settings.fps)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(settings.sound, 0.0001)))


func stats() -> Dictionary:
	return {"fps": Engine.get_frames_per_second(), "fps_avg": fps_avg,
		"draw": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"mem_mb": Performance.get_monitor(Performance.MEMORY_STATIC) / 1048576.0,
		"vram_mb": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
		"gpu": RenderingServer.get_video_adapter_name()}


func safe_rect(ui_size: Vector2) -> Rect2:
	var r := DisplayServer.get_display_safe_area()
	var ws := DisplayServer.window_get_size()
	if r.size.x <= 0 or ws.x <= 0:
		return Rect2(Vector2.ZERO, ui_size)
	var k := ui_size / Vector2(ws)
	return Rect2(Vector2(r.position) * k, Vector2(r.size) * k)


func _save() -> void:
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(settings))


func _load() -> void:
	if not FileAccess.file_exists(FILE):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(FILE))
	if d is Dictionary:
		for k in d:
			settings[k] = d[k]
