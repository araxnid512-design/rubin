extends Node
## Настройки: качество графики (Низкое / Среднее / Высокое — масштаб 3D-рендера, сглаживание MSAA, огни
## и свечение в локации, дальность камеры), счётчик кадров (к/с, вызовы отрисовки, треугольники), автоподстройка чёткости
## (если меньше 28 кадров в секунду три секунды подряд — масштаб рендера ступенями вниз, до 0,6) и общая
## громкость (шина Master). Всё сохраняется вместе с игрой (save_data / load_data). Пока окно открыто — пауза.

const QUALITY := {
	"low": {"name": "Низкое", "scale": 0.7, "msaa": Viewport.MSAA_DISABLED, "far": 60.0},
	"medium": {"name": "Среднее", "scale": 0.85, "msaa": Viewport.MSAA_2X, "far": 90.0},
	"high": {"name": "Высокое", "scale": 1.0, "msaa": Viewport.MSAA_4X, "far": 140.0},
}
const ORDER := ["low", "medium", "high"]
const MSAA_NAME := {Viewport.MSAA_DISABLED: "нет", Viewport.MSAA_2X: "2×", Viewport.MSAA_4X: "4×", Viewport.MSAA_8X: "8×"}
## Автоподстройка: порог кадров, сколько секунд терпеть, шаг и нижний предел масштаба.
const AUTO_FPS := 28.0
const AUTO_SECS := 3.0
const AUTO_STEP := 0.1
const AUTO_MIN := 0.6
## После входа в локацию — не судить: загрузка проседает сама.
const GRACE := 4.0

var game: Node
var quality := "medium"
var show_fps := false
var auto := true
var volume := 0.8
## Масштаб рендера сейчас (автоподстройка может опустить его ниже, чем у пресета).
var render_scale := 0.85
var low_t := 0.0
var grace_t := GRACE
var fps_t := 0.0
var fps_label: Label
var paused_by_me := false
var vol_label: Label

func setup(g: Node) -> void:
	game = g
	process_mode = Node.PROCESS_MODE_ALWAYS
	var layer := CanvasLayer.new()
	layer.layer = 9
	add_child(layer)
	fps_label = Label.new()
	fps_label.add_theme_font_size_override("font_size", 14)
	fps_label.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	fps_label.add_theme_constant_override("outline_size", 4)
	fps_label.mouse_filter = Control.MOUSE_FILTER_IGNORE
	fps_label.set_anchors_preset(Control.PRESET_BOTTOM_LEFT)
	fps_label.offset_left = 12.0
	fps_label.offset_top = -28.0
	fps_label.offset_right = 420.0
	fps_label.offset_bottom = -6.0
	fps_label.visible = false
	layer.add_child(fps_label)
	# кнопка — слева под здоровьем
	game.hud.add_button("settings", "Настр.", Vector2(-120, -120), 70.0, _on_button)
	var b: Control = game.hud.buttons.get("settings")
	if b:
		b.set_anchors_preset(Control.PRESET_TOP_LEFT)
		b.offset_left = 24.0
		b.offset_right = 94.0
		b.offset_top = 104.0
		b.offset_bottom = 174.0
	apply()

func save_data() -> Dictionary:
	return {"quality": quality, "fps": show_fps, "auto": auto, "volume": volume}

func load_data(d: Dictionary) -> void:
	quality = str(d.get("quality", quality)) if QUALITY.has(str(d.get("quality", ""))) else quality
	show_fps = bool(d.get("fps", show_fps))
	auto = bool(d.get("auto", auto))
	volume = clampf(float(d.get("volume", volume)), 0.0, 1.0)
	apply()

func on_enter(_id: String) -> void:
	grace_t = GRACE
	low_t = 0.0
	_apply_level()
	if game.camera:
		game.camera.far = float(QUALITY[quality]["far"])

## Шейдер статики, свечение и огни по качеству ведёт локация (level.gd → apply_quality).
func _apply_level() -> void:
	Level.quality = ORDER.find(quality)
	if game and game.level and game.level.has_method("apply_quality"):
		game.level.apply_quality(ORDER.find(quality))

## Всё по текущим настройкам: качество (масштаб — заново по пресету), локация, дальность, громкость, счётчик.
func apply() -> void:
	var q: Dictionary = QUALITY[quality]
	render_scale = float(q["scale"])
	var vp := get_viewport()
	vp.scaling_3d_mode = Viewport.SCALING_3D_MODE_BILINEAR
	vp.scaling_3d_scale = render_scale
	vp.msaa_3d = q["msaa"]
	if game and game.camera:
		game.camera.far = float(q["far"])
	_apply_level()
	apply_volume()
	fps_label.visible = show_fps

func apply_volume() -> void:
	var bus := AudioServer.get_bus_index("Master")
	AudioServer.set_bus_mute(bus, volume <= 0.001)
	AudioServer.set_bus_volume_db(bus, linear_to_db(maxf(volume, 0.001)))

func set_quality(id: String) -> void:
	if not QUALITY.has(id):
		return
	quality = id
	low_t = 0.0
	apply()

# ---------- Каждый кадр: счётчик и автоподстройка ----------

func _process(delta: float) -> void:
	if paused_by_me and not game.hud.panel.visible:
		_unpause()
	var fps := Engine.get_frames_per_second()
	if show_fps:
		fps_t -= delta
		if fps_t <= 0.0:
			fps_t = 0.5
			fps_label.text = "%d к/с · вызовов %d · треуг. %dk · чёткость %d%%" % [fps, Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0), roundi(render_scale * 100.0)]
	if get_tree().paused or game.hud.panel.visible or game.level == null:
		low_t = 0.0
		return
	autotune(delta, fps)

## Автоподстройка: кадров меньше AUTO_FPS три секунды подряд — масштаб рендера на ступень ниже (не ниже 0,6).
func autotune(delta: float, fps: float) -> void:
	if not auto:
		return
	if grace_t > 0.0:
		grace_t -= delta
		return
	low_t = low_t + delta if fps < AUTO_FPS else 0.0
	if low_t < AUTO_SECS or render_scale <= AUTO_MIN + 0.001:
		return
	low_t = 0.0
	render_scale = maxf(AUTO_MIN, snappedf(render_scale - AUTO_STEP, 0.05))
	get_viewport().scaling_3d_scale = render_scale
	game.toast("Игра шла медленно — чёткость снижена до %d%%" % roundi(render_scale * 100.0))

# ---------- Окно настроек ----------

func _on_button(down: bool) -> void:
	if down and not game.hud.panel.visible:
		open_settings()

func open_settings() -> void:
	var hud = game.hud
	var q: Dictionary = QUALITY[quality]
	hud.show_panel("Настройки", "", [])
	var box: VBoxContainer = hud.panel_box
	box.add_child(_text("Качество графики"))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	for id in ORDER:
		var b := _button(("[ %s ]" if id == quality else "%s") % QUALITY[id]["name"], set_and_reopen.bind(id))
		if id == quality:
			b.modulate = Color(1.25, 1.15, 0.7)
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(b)
	box.add_child(row)
	box.add_child(_text("Чёткость %d%%%s · сглаживание %s · дальность %d м" % [roundi(render_scale * 100.0), " (снижена автоподстройкой)" if render_scale < float(q["scale"]) - 0.001 else "", MSAA_NAME.get(q["msaa"], "?"), int(q["far"])], 15))
	box.add_child(_button("Автоподстройка чёткости: %s" % ("вкл" if auto else "выкл"), toggle_auto))
	box.add_child(_button("Счётчик кадров: %s" % ("вкл" if show_fps else "выкл"), toggle_fps))
	vol_label = _text("Громкость: %d%%" % roundi(volume * 100.0))
	box.add_child(vol_label)
	var slider := HSlider.new()
	slider.min_value = 0.0
	slider.max_value = 100.0
	slider.step = 5.0
	slider.value = volume * 100.0
	slider.custom_minimum_size = Vector2(0, 40)
	slider.value_changed.connect(_on_volume)
	box.add_child(slider)
	box.add_child(_button("Закрыть", close_settings))
	hud.process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().paused = true
	paused_by_me = true

func _text(t: String, size := 18) -> Label:
	var l := Label.new()
	l.text = t
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(580, 0)
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 4)
	return l

func _button(t: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(0, 54)
	b.add_theme_font_size_override("font_size", 19)
	b.pressed.connect(cb)
	return b

func set_and_reopen(id: String) -> void:
	set_quality(id)
	open_settings()

func toggle_auto() -> void:
	auto = not auto
	if not auto:
		apply()  # вернуть чёткость пресета
	open_settings()

func toggle_fps() -> void:
	show_fps = not show_fps
	fps_label.visible = show_fps
	fps_t = 0.0
	open_settings()

func _on_volume(v: float) -> void:
	volume = v / 100.0
	apply_volume()
	if is_instance_valid(vol_label):
		vol_label.text = "Громкость: %d%%" % roundi(volume * 100.0)

func close_settings() -> void:
	game.hud.hide_panel()
	_unpause()
	game.save()

func _unpause() -> void:
	paused_by_me = false
	get_tree().paused = false

# ---------- Автотест ----------

func smoke() -> int:
	var fail := 0
	var was := save_data()
	var vp := get_viewport()
	var res := []
	for id in ORDER:
		set_quality(id)
		res.append([id, vp.scaling_3d_scale, vp.msaa_3d, game.camera.far])
	var ok: bool = absf(res[0][1] - 0.7) < 0.01 and absf(res[1][1] - 0.85) < 0.01 and absf(res[2][1] - 1.0) < 0.01 and res[0][2] == Viewport.MSAA_DISABLED and res[2][3] > res[0][3]
	print(("✓ " if ok else "✗ ") + "качество меняет масштаб рендера: %s" % ", ".join(res.map(func(r): return "%s %.2f" % [QUALITY[r[0]]["name"], r[1]])))
	if not ok:
		fail += 1
	# автоподстройка: 3,5 с по 20 кадров — масштаб на ступень ниже, но не ниже 0,6
	set_quality("medium")
	auto = true
	grace_t = 0.0
	low_t = 0.0
	for i in 35:
		autotune(0.1, 20.0)
	var after := vp.scaling_3d_scale
	for i in 200:
		autotune(0.1, 20.0)
	ok = after < 0.85 - 0.01 and absf(vp.scaling_3d_scale - AUTO_MIN) < 0.01
	print(("✓ " if ok else "✗ ") + "автоподстройка: при 20 к/с чёткость 0.85 → %.2f, предел %.2f" % [after, vp.scaling_3d_scale])
	if not ok:
		fail += 1
	open_settings()
	await get_tree().create_timer(0.2).timeout
	ok = game.hud.panel.visible and get_tree().paused
	close_settings()
	await get_tree().create_timer(0.1).timeout
	ok = ok and not get_tree().paused
	print(("✓ " if ok else "✗ ") + "окно настроек открывается (пауза) и закрывается")
	if not ok:
		fail += 1
	load_data(was)
	return fail
