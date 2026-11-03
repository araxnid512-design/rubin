extends Node
## Настройки: качество графики, дальность прорисовки, звук, управление. Хранятся в user://settings.cfg.

signal changed

const PATH := "user://settings.cfg"
const PRESETS := {
	0: {"name": "Низкое", "shadows": false, "shadow_size": 1024, "shadow_dist": 25.0, "msaa": 0, "scale": 0.7, "grass": 0.25, "draw": 70.0, "fps": 30, "detail": 0.0, "lights": false, "glow": false, "fog": false},
	1: {"name": "Среднее", "shadows": true, "shadow_size": 1024, "shadow_dist": 32.0, "msaa": 0, "scale": 0.85, "grass": 0.55, "draw": 95.0, "fps": 30, "detail": 1.0, "lights": true, "glow": false, "fog": true},
	2: {"name": "Высокое", "shadows": true, "shadow_size": 2048, "shadow_dist": 48.0, "msaa": 1, "scale": 1.0, "grass": 1.0, "draw": 140.0, "fps": 60, "detail": 1.0, "lights": true, "glow": true, "fog": true},
}

var quality := 1
var draw_distance := 95.0
var grass_density := 0.55
var render_scale := 0.85
var fps_limit := 30
var shadows := true
var show_fps := false
var volume := 0.8
var touch_controls := -1      # -1 — авто, 0 — выкл, 1 — вкл
var joystick_size := 1.0
var camera_zoom := 1.0
var day_length_min := 24.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_setup_input()
	if OS.has_feature("mobile"):
		quality = 1
	else:
		quality = 2
	apply_preset(quality, false)
	load_cfg()
	apply()

func _key(action: String, keys: Array) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	for k in keys:
		var e := InputEventKey.new()
		e.physical_keycode = k
		InputMap.action_add_event(action, e)

func _mouse(action: String, button: MouseButton) -> void:
	if not InputMap.has_action(action):
		InputMap.add_action(action)
	var e := InputEventMouseButton.new()
	e.button_index = button
	InputMap.action_add_event(action, e)

func _setup_input() -> void:
	_key("move_up", [KEY_W, KEY_UP])
	_key("move_down", [KEY_S, KEY_DOWN])
	_key("move_left", [KEY_A, KEY_LEFT])
	_key("move_right", [KEY_D, KEY_RIGHT])
	_key("sprint", [KEY_SHIFT])
	_key("interact", [KEY_E, KEY_F])
	_key("reload", [KEY_R])
	_key("slot_1", [KEY_1])
	_key("slot_2", [KEY_2])
	_key("quick_1", [KEY_3])
	_key("quick_2", [KEY_4])
	_key("quick_3", [KEY_5])
	_key("quick_4", [KEY_6])
	_key("inventory", [KEY_I, KEY_TAB])
	_key("map", [KEY_M])
	_key("squad", [KEY_O])
	_key("build", [KEY_B])
	_key("journal", [KEY_J])
	_key("pause", [KEY_ESCAPE])
	_key("inspect", [KEY_V])
	_key("quicksave", [KEY_F5])
	_key("quickload", [KEY_F9])
	_key("toggle_fps", [KEY_F3])
	_mouse("fire", MOUSE_BUTTON_LEFT)
	_mouse("aim", MOUSE_BUTTON_RIGHT)
	_mouse("zoom_in", MOUSE_BUTTON_WHEEL_UP)
	_mouse("zoom_out", MOUSE_BUTTON_WHEEL_DOWN)

func apply_preset(q: int, do_apply: bool = true) -> void:
	quality = clampi(q, 0, 2)
	var p: Dictionary = PRESETS[quality]
	shadows = p.shadows
	render_scale = p.scale
	grass_density = p.grass
	draw_distance = p.draw
	fps_limit = p.fps
	if do_apply:
		apply()

func preset() -> Dictionary:
	return PRESETS[quality]

func use_touch() -> bool:
	if touch_controls == -1:
		return DisplayServer.is_touchscreen_available() or OS.has_feature("mobile")
	return touch_controls == 1

func apply() -> void:
	Engine.max_fps = fps_limit
	var vp := get_viewport()
	if vp:
		vp.scaling_3d_scale = render_scale
		vp.msaa_3d = Viewport.MSAA_2X if preset().msaa > 0 else Viewport.MSAA_DISABLED
	RenderingServer.global_shader_parameter_set("detail_level", preset().detail)
	RenderingServer.directional_shadow_atlas_set_size(int(preset().shadow_size), true)
	if has_node("/root/Sfx"):
		Sfx.volume = volume
	changed.emit()
	save_cfg()

func save_cfg() -> void:
	var c := ConfigFile.new()
	for k in ["quality", "shadows", "draw_distance", "grass_density", "render_scale", "fps_limit", "shadows", "show_fps", "volume", "touch_controls", "joystick_size", "camera_zoom", "day_length_min"]:
		c.set_value("settings", k, get(k))
	c.save(PATH)

func load_cfg() -> void:
	var c := ConfigFile.new()
	if c.load(PATH) != OK:
		return
	for k in c.get_section_keys("settings"):
		set(k, c.get_value("settings", k))
