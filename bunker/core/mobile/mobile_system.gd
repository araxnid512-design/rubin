extends Node
## MobileSystem BunkerCore: качество графики, внутреннее разрешение (масштаб 3D), ограничение FPS, замер FPS и
## времени кадра, память, сведения об устройстве, безопасная область экрана (вырезы, скругления).
## Качество: 0 — низкое (масштаб 0.7, без теней, мало частиц), 1 — среднее (0.85, тени 1024), 2 — высокое (1.0,
## тени 2048). Авто-режим понижает масштаб, если средний FPS ниже цели.

signal settings_changed

var settings := {"quality": 1, "fps": 60, "scale": 0.85, "auto": true, "shadows": true, "joy_size": 1.0,
	"joy_opacity": 0.55, "sens": 1.0, "dev": false, "sound": 1.0}
var fps_now := 0.0
var fps_avg := 0.0
var frame_ms := 0.0
var _hist: Array = []
var _auto_t := 0.0
const FILE := "user://settings.json"


func _ready() -> void:
	_load()
	apply.call_deferred()


func _process(delta: float) -> void:
	frame_ms = delta * 1000.0
	fps_now = Engine.get_frames_per_second()
	_hist.append(delta)
	if _hist.size() > 240:
		_hist.pop_front()
	var s := 0.0
	for d in _hist:
		s += d
	fps_avg = _hist.size() / maxf(s, 0.0001)
	# авто-подстройка внутреннего разрешения: держим цель FPS
	if settings.auto:
		_auto_t += delta
		if _auto_t > 3.0 and _hist.size() >= 180:
			_auto_t = 0.0
			var target: float = settings.fps
			var sc: float = settings.scale
			if fps_avg < target * 0.85 and sc > 0.6:
				set_value("scale", snappedf(sc - 0.05, 0.05), false)
			elif fps_avg > target * 0.98 and sc < _max_scale():
				set_value("scale", snappedf(sc + 0.05, 0.05), false)


func _max_scale() -> float:
	return [0.75, 0.9, 1.0][settings.quality]


func set_value(k: String, v, save := true) -> void:
	settings[k] = v
	if k == "quality":
		settings.scale = _max_scale()
	apply()
	if save:
		_save()
	settings_changed.emit()


func apply() -> void:
	var vp := get_viewport()
	if vp == null:
		return
	var q: int = settings.quality
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = clampf(settings.scale, 0.5, 1.0)
	vp.msaa_3d = Viewport.MSAA_DISABLED if q < 2 else Viewport.MSAA_2X
	Engine.max_fps = int(settings.fps)
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_ENABLED)
	RenderingServer.directional_shadow_atlas_set_size([1024, 2048, 2048][q], true)
	if Core.env and Core.env.sun:
		Core.env.sun.shadow_enabled = settings.shadows and q > 0
		Core.env.sun.directional_shadow_max_distance = [25.0, 38.0, 50.0][q]
	if Core.env and Core.env._dust:
		Core.env._dust.amount = [60, 160, 260][q]
	# свечение и лучи света — со среднего качества
	if Core.env and Core.env.env:
		Core.env.env.glow_enabled = q > 0
	BCLight.shafts_on = q > 0
	if get_tree():
		get_tree().call_group("bc_light", "_apply")
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(settings.sound, 0.0001)))


## сведения для панели разработчика
func stats() -> Dictionary:
	var vp := get_viewport()
	var size := vp.get_visible_rect().size if vp else Vector2.ZERO
	var sc: float = settings.scale
	return {
		"fps": fps_now, "fps_avg": fps_avg, "ms": frame_ms,
		"mem_mb": OS.get_static_memory_usage() / 1048576.0,
		"vram_mb": Performance.get_monitor(Performance.RENDER_VIDEO_MEM_USED) / 1048576.0,
		"draw": Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME),
		"objects": Performance.get_monitor(Performance.RENDER_TOTAL_OBJECTS_IN_FRAME),
		"prims": Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME),
		"res": "%dx%d → 3D %dx%d" % [size.x, size.y, size.x * sc, size.y * sc],
		"device": OS.get_model_name() + " · " + OS.get_name() + " " + OS.get_version(),
		"gpu": RenderingServer.get_video_adapter_name(),
		"thermal": _thermal(),
	}


func _thermal() -> String:
	# Android отдаёт температуру батареи через намерение ACTION_BATTERY_CHANGED; без плагина — недоступно
	return "нет данных (нужен плагин Android)"


## безопасная область экрана (вырезы камеры, скругления) в координатах интерфейса
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
		# по умолчанию для телефона — среднее качество
		return
	var f := FileAccess.open(FILE, FileAccess.READ)
	var d = JSON.parse_string(f.get_as_text()) if f else null
	if d is Dictionary:
		for k in d:
			settings[k] = d[k]
