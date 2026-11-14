class_name BCHud
extends CanvasLayer
## Интерфейс BunkerCore для телефона (горизонтально): полосы здоровья и выносливости, дозиметр (мощность дозы,
## накопленная доза, цвет опасности), костюм, мини-карта, пауза; справа — кнопки «Бег», «Присед», «Действие»,
## «Атака», «Инвентарь»; подпись к «Действию» — что произойдёт; сообщения; окна паузы, настроек, инвентаря,
## терминала и осмотра; панель разработчика (FPS, время кадра, память, вызовы отрисовки, объекты, разрешение).
## Всё рисуется кодом, без сцен — легко менять. Учитывается безопасная область экрана (вырезы, скругления).

var root: Control
var touch: BCTouchControls
var bars := {}
var dosi: Label
var dosi_box: PanelContainer
var zone_lbl: Label
var msg_box: VBoxContainer
var prompt_lbl: Label
var dev_lbl: Label
var minimap: Control
var modal: Control = null
var player: BCPlayer
var _joy_was := false
var _font_big := 22
var _ui_scale := 1.0

const C_BG := Color(0.07, 0.07, 0.06, 0.72)
const C_LINE := Color(0.85, 0.75, 0.45, 0.55)
const C_TEXT := Color(0.93, 0.9, 0.82)


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	Core.hud = self
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	touch = BCTouchControls.new()
	root.add_child(touch)
	touch.button.connect(_on_button)
	_build()
	Core.message.connect(_on_message)
	Core.zone_changed.connect(_on_zone)
	get_viewport().size_changed.connect(_layout)
	_layout.call_deferred()
	Core.mobile.settings_changed.connect(_apply_settings)
	_apply_settings()


func bind_player(p: BCPlayer) -> void:
	player = p
	p.interact_target_changed.connect(_on_target)
	_on_target(null)


func _style(bg := C_BG, radius := 14, border := 0) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	if border > 0:
		s.set_border_width_all(border)
		s.border_color = C_LINE
	s.content_margin_left = 10
	s.content_margin_right = 10
	s.content_margin_top = 6
	s.content_margin_bottom = 6
	return s


func _label(text: String, size := 18, color := C_TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _build() -> void:
	# --- слева сверху: здоровье, выносливость, дозиметр ---
	var stats := VBoxContainer.new()
	stats.name = "Stats"
	stats.add_theme_constant_override("separation", 6)
	stats.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(stats)
	for k in [["hp", "Здоровье", Color(0.75, 0.2, 0.17)], ["st", "Выносливость", Color(0.78, 0.66, 0.25)]]:
		var row := HBoxContainer.new()
		row.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var pb := ProgressBar.new()
		pb.custom_minimum_size = Vector2(230, 16)
		pb.show_percentage = false
		pb.max_value = 100
		var fg := _style(k[2], 6)
		var bg := _style(Color(0, 0, 0, 0.55), 6)
		pb.add_theme_stylebox_override("fill", fg)
		pb.add_theme_stylebox_override("background", bg)
		pb.mouse_filter = Control.MOUSE_FILTER_IGNORE
		row.add_child(pb)
		row.add_child(_label(" " + k[1], 15))
		stats.add_child(row)
		bars[k[0]] = pb
	dosi_box = PanelContainer.new()
	dosi_box.add_theme_stylebox_override("panel", _style(C_BG, 10, 1))
	dosi_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	dosi = _label("", 17)
	dosi_box.add_child(dosi)
	stats.add_child(dosi_box)
	dev_lbl = _label("", 14, Color(0.7, 1.0, 0.7))
	dev_lbl.visible = false
	stats.add_child(dev_lbl)
	# --- сверху по центру: название зоны ---
	zone_lbl = _label("", 22)
	zone_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	zone_lbl.modulate.a = 0.0
	root.add_child(zone_lbl)
	# --- сообщения ---
	msg_box = VBoxContainer.new()
	msg_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	msg_box.alignment = BoxContainer.ALIGNMENT_END
	root.add_child(msg_box)
	# --- мини-карта и пауза ---
	minimap = preload("res://core/mobile/minimap.gd").new()
	root.add_child(minimap)
	_btn("pause", "II", Vector2(64, 64), 26)
	_btn("inv", "Вещи", Vector2(96, 64), 18, 18)
	# --- кнопки справа: под большой палец, «Действие» — самая крупная, в углу ---
	_btn("action", "", Vector2(176, 176), 26)
	_btn("attack", "Удар", Vector2(124, 124), 22)
	_btn("crouch", "Присед", Vector2(104, 104), 19)
	prompt_lbl = _label("", 17)
	prompt_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(prompt_lbl)


func _btn(id: String, text: String, size: Vector2, fs: int, radius := -1) -> void:
	var p := Panel.new()
	p.name = "Btn_" + id
	p.custom_minimum_size = size
	p.size = size
	p.pivot_offset = size * 0.5
	var st := _style(Color(0.08, 0.08, 0.07, 0.62), int(size.x * 0.5) if radius < 0 else radius, 3 if id == "action" else 2)
	p.add_theme_stylebox_override("panel", st)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var l := _label(text, fs)
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	p.add_child(l)
	root.add_child(p)
	touch.buttons[id] = p


func _layout() -> void:
	var vs := root.get_viewport_rect().size
	var safe: Rect2 = Core.mobile.safe_rect(vs)
	var m := 18.0
	var L: float = safe.position.x + m
	var T: float = safe.position.y + m
	var R: float = safe.end.x - m
	var B: float = safe.end.y - m
	root.get_node("Stats").position = Vector2(L, T)
	zone_lbl.position = Vector2(vs.x * 0.5 - 250, T)
	zone_lbl.size = Vector2(500, 34)
	msg_box.position = Vector2(vs.x * 0.5 - 300, B - 250)
	msg_box.size = Vector2(600, 120)
	var mm := 150.0
	minimap.size = Vector2(mm, mm)
	var b: Dictionary = touch.buttons
	b.pause.position = Vector2(R - 64, T)
	b.inv.position = Vector2(R - 64 - 12 - 96, T)
	minimap.position = Vector2(R - 64 - 12 - 96 - 12 - mm, T)
	# дуга кнопок под правым большим пальцем: «Действие» в углу, «Удар» левее, «Присед» выше
	var act: Control = b.action
	act.position = Vector2(R - 176, B - 176)
	b.attack.position = act.position + Vector2(-150, 52)
	b.crouch.position = act.position + Vector2(-36, -132)
	prompt_lbl.position = Vector2(R - 620, act.position.y - 176)
	prompt_lbl.size = Vector2(600, 30)
	if modal:
		modal.position = (vs - modal.size) * 0.5


func _apply_settings() -> void:
	var s: Dictionary = Core.mobile.settings
	touch.opacity = s.joy_opacity
	touch.set_joy_size(s.joy_size)
	dev_lbl.visible = s.dev
	for n in touch.buttons:
		touch.buttons[n].modulate.a = clampf(s.joy_opacity + 0.35, 0.3, 1.0)


func _process(_d: float) -> void:
	if player == null:
		return
	# джойстик: пока палец на экране — вектор от джойстика; отпустили — один раз обнулить
	if touch.joy_index >= 0:
		player.move_input = touch.move_vector()
		_joy_was = true
	elif _joy_was:
		player.move_input = Vector2.ZERO
		_joy_was = false
	_refresh_action()
	var cb: Control = touch.buttons.crouch
	cb.self_modulate = Color(1.3, 1.15, 0.7) if player.crouching else Color.WHITE
	bars.hp.value = player.hp / player.max_hp * 100.0
	bars.st.value = player.stamina
	var rate: float = player.rad_rate * (0.15 if player.suit_on else 1.0)
	var lvl: int = Core.env.danger(rate) if Core.env else 0
	var cols := [Color(0.55, 0.85, 0.5), Color(0.95, 0.85, 0.3), Color(1.0, 0.5, 0.2), Color(1.0, 0.2, 0.15)]
	var names := ["безопасно", "повышенный фон", "опасно", "смертельно"]
	var rs := ("%.2f мкЗв/ч" % (rate * 1000.0)) if rate < 0.1 else ("%.1f мЗв/ч" % rate)
	dosi.text = "☢ %s · %s\nДоза: %.0f мЗв%s" % [rs, names[lvl], player.dose, "  · костюм" if player.suit_on else ""]
	dosi.add_theme_color_override("font_color", cols[lvl])
	if Core.mobile.settings.dev:
		var st: Dictionary = Core.mobile.stats()
		dev_lbl.text = "FPS %d (ср. %.0f) · кадр %.1f мс\nвызовов %d · объектов %d · треуг. %dк\nОЗУ %.0f МБ · видео %.0f МБ\n%s\n%s\nтемпература: %s" % [st.fps, st.fps_avg, st.ms, st.draw, st.objects, st.prims / 1000, st.mem_mb, st.vram_mb, st.res, st.gpu, st.thermal]


func _on_button(n: String, pressed: bool) -> void:
	if player == null:
		return
	match n:
		"action":
			if pressed:
				player.do_interact()
		"attack":
			if pressed:
				player.attack()
		"crouch":
			if pressed:
				player.toggle_crouch()
		"inv":
			if pressed:
				show_inventory()
		"pause":
			if pressed:
				show_pause()


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and player:
		match e.keycode:
			KEY_F: player.do_interact()
			KEY_SPACE: player.attack()
			KEY_C: player.toggle_crouch()
			KEY_I: show_inventory()
			KEY_ESCAPE: show_pause()
			KEY_F3: Core.mobile.set_value("dev", not Core.mobile.settings.dev)
	if e is InputEventKey and e.keycode == KEY_SHIFT and player:
		player.sprint_held = e.pressed


func _on_target(t) -> void:
	_refresh_action()


## кнопка «Действие» подписана тем, что произойдёт («Открыть», «Сесть», «Взять», «Встать» …); без цели — тусклая
func _refresh_action() -> void:
	if player == null:
		return
	var a: Control = touch.buttons.action
	var verb := player.action_verb()
	var lbl: Label = a.get_child(0)
	lbl.text = verb if verb != "" else "Действие"
	a.modulate.a = 1.0 if verb != "" else 0.4
	var t = player.target
	prompt_lbl.text = t.interact_label() if t and verb != "Встать" else ""


func _on_zone(info: Dictionary) -> void:
	zone_lbl.text = info.get("name", "")
	var tw := create_tween()
	tw.tween_property(zone_lbl, "modulate:a", 1.0, 0.4)
	tw.tween_interval(2.2)
	tw.tween_property(zone_lbl, "modulate:a", 0.0, 0.8)


func _on_message(text: String, kind: String) -> void:
	var col: Color = {"info": C_TEXT, "good": Color(0.6, 0.95, 0.55), "warn": Color(1.0, 0.8, 0.3), "bad": Color(1.0, 0.45, 0.35)}.get(kind, C_TEXT)
	var l := _label(text, 18, col)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	msg_box.add_child(l)
	while msg_box.get_child_count() > 3:
		msg_box.get_child(0).queue_free()
	var tw := create_tween()
	tw.tween_interval(3.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


# ---------------- окна ----------------

func _open(title: String, w := 620.0, h := 420.0) -> VBoxContainer:
	close_modal()
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _style(Color(0.06, 0.06, 0.055, 0.94), 16, 2))
	p.custom_minimum_size = Vector2(w, h)
	p.size = Vector2(w, h)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	var top := HBoxContainer.new()
	var tl := _label(title, 24, Color(0.95, 0.82, 0.45))
	tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(tl)
	var x := _button("✕", close_modal)
	x.custom_minimum_size = Vector2(56, 48)
	top.add_child(x)
	v.add_child(top)
	root.add_child(p)
	modal = p
	touch.visible = false
	for b in touch.buttons.values():
		b.visible = false
	get_tree().paused = true
	_layout()
	return v


func close_modal() -> void:
	if modal:
		modal.queue_free()
		modal = null
	touch.visible = true
	for b in touch.buttons.values():
		b.visible = true
	get_tree().paused = false


func _button(text: String, cb: Callable) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(0, 56)
	b.add_theme_font_size_override("font_size", 20)
	b.add_theme_stylebox_override("normal", _style(Color(0.16, 0.15, 0.13, 0.95), 10, 1))
	b.add_theme_stylebox_override("hover", _style(Color(0.24, 0.22, 0.17, 0.95), 10, 1))
	b.add_theme_stylebox_override("pressed", _style(Color(0.35, 0.3, 0.18, 0.95), 10, 1))
	b.process_mode = Node.PROCESS_MODE_ALWAYS
	b.pressed.connect(cb)
	return b


func show_pause() -> void:
	var v := _open("Пауза", 520, 470)
	v.add_child(_button("Продолжить", close_modal))
	v.add_child(_button("Сохранить игру", func():
		Core.say("Игра сохранена." if Core.save.save_game() else "Не удалось сохранить.", "good")
		close_modal()))
	v.add_child(_button("Загрузить сохранение", func():
		close_modal()
		if not Core.save.load_game():
			Core.say("Сохранения нет.", "warn")))
	v.add_child(_button("Настройки графики и управления", show_settings))
	v.add_child(_button("Выйти из игры", func():
		Core.save.save_game()
		get_tree().quit()))


func show_settings() -> void:
	var v := _open("Настройки", 700, 560)
	var s: Dictionary = Core.mobile.settings
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 16)
	g.add_theme_constant_override("v_separation", 10)
	g.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(g)
	v.add_child(sc)
	_opt(g, "Качество графики", ["Низкое", "Среднее", "Высокое"], s.quality, func(i): Core.mobile.set_value("quality", i))
	_opt(g, "Частота кадров", ["30", "60"], 0 if s.fps == 30 else 1, func(i): Core.mobile.set_value("fps", [30, 60][i]))
	_opt(g, "Тени", ["Выкл", "Вкл"], 1 if s.shadows else 0, func(i): Core.mobile.set_value("shadows", i == 1))
	_opt(g, "Авто-разрешение", ["Выкл", "Вкл"], 1 if s.auto else 0, func(i): Core.mobile.set_value("auto", i == 1))
	_slider(g, "Разрешение 3D", 0.5, 1.0, s.scale, func(x): Core.mobile.set_value("scale", x))
	_slider(g, "Размер джойстика", 0.7, 1.4, s.joy_size, func(x): Core.mobile.set_value("joy_size", x))
	_slider(g, "Прозрачность кнопок", 0.2, 1.0, s.joy_opacity, func(x): Core.mobile.set_value("joy_opacity", x))
	_slider(g, "Громкость", 0.0, 1.0, s.sound, func(x): Core.mobile.set_value("sound", x))
	_opt(g, "Панель разработчика", ["Выкл", "Вкл"], 1 if s.dev else 0, func(i): Core.mobile.set_value("dev", i == 1))


func _opt(g: GridContainer, title: String, items: Array, sel: int, cb: Callable) -> void:
	g.add_child(_label(title, 19))
	var o := OptionButton.new()
	o.custom_minimum_size = Vector2(220, 52)
	o.add_theme_font_size_override("font_size", 19)
	for it in items:
		o.add_item(it)
	o.selected = sel
	o.item_selected.connect(cb)
	o.process_mode = Node.PROCESS_MODE_ALWAYS
	g.add_child(o)


func _slider(g: GridContainer, title: String, a: float, b: float, val: float, cb: Callable) -> void:
	g.add_child(_label(title, 19))
	var sl := HSlider.new()
	sl.min_value = a
	sl.max_value = b
	sl.step = 0.05
	sl.value = val
	sl.custom_minimum_size = Vector2(260, 48)
	sl.value_changed.connect(cb)
	sl.process_mode = Node.PROCESS_MODE_ALWAYS
	g.add_child(sl)


const ITEMS := {
	"dosimeter": ["Дозиметр", "Показывает мощность дозы и накопленную дозу. Щёлкает чаще, когда фон растёт."],
	"flashlight": ["Фонарь", "Старый армейский фонарь."],
	"suit": ["Защитный костюм", "Снижает облучение в 6–7 раз. Хранится в шкафу у шлюза."],
	"filter": ["Фильтр противогаза", "Запасной фильтр."],
	"canned": ["Тушёнка", "Банка тушёнки из довоенных запасов."],
	"tape": ["Изолента", "Пригодится в мастерской."],
	"medkit": ["Аптечка", "Бинты, йод, обезболивающее."],
	"keycard": ["Ключ-карта", "Карта доступа к пульту управления."],
}


func show_inventory() -> void:
	var v := _open("Вещи", 640, 440)
	var g := GridContainer.new()
	g.columns = 2
	g.add_theme_constant_override("h_separation", 14)
	g.add_theme_constant_override("v_separation", 10)
	v.add_child(g)
	for id in player.inventory:
		var it: Array = ITEMS.get(id, [id, ""])
		var box := PanelContainer.new()
		box.add_theme_stylebox_override("panel", _style(Color(0.13, 0.12, 0.1, 0.9), 10, 1))
		box.custom_minimum_size = Vector2(290, 72)
		var l := _label("%s\n%s" % [it[0], it[1]], 15)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(270, 0)
		box.add_child(l)
		g.add_child(box)
	if player.suit_on:
		v.add_child(_label("Надет защитный костюм.", 17, Color(0.95, 0.85, 0.3)))


func show_text(title: String, text: String) -> void:
	var v := _open(title, 640, 340)
	var l := _label(text, 19)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(580, 0)
	v.add_child(l)


func show_terminal(kind: String) -> void:
	var v := _open("Терминал бункера", 720, 470)
	var p := player
	var hours := int(p.game_time / 3600.0) % 24
	var mins := int(p.game_time / 60.0) % 60
	var doors := 0
	var open := 0
	for id in Core.world.objects:
		var o = Core.world.objects[id]
		if o is BCDoor:
			doors += 1
			if o.is_open:
				open += 1
	var lights := 0
	for id in Core.world.objects:
		var o2 = Core.world.objects[id]
		if o2 is BCLight and o2.on:
			lights += 1
	var t := "> СИСТЕМА ЖИЗНЕОБЕСПЕЧЕНИЯ «УБЕЖИЩЕ-7»\n> Время: %02d:%02d\n> Генератор: РАБОТАЕТ · топливо 63%%\n> Вентиляция: фильтры ФВУ — норма\n> Гермодвери: %d из %d открыты\n> Освещение: %d светильников включено\n> Радиация снаружи: %.1f мЗв/ч\n> Радиация внутри: 0.20 мкЗв/ч — норма\n> Запас воды: 1 870 л · продовольствие: 41 сут.\n> Связь: нет сигнала" % [hours, mins, open, doors, lights, Core.env.surface_rate if Core.env else 0.0]
	var l := _label(t, 18, Color(0.45, 0.95, 0.55))
	l.add_theme_font_override("font", SystemFont.new())
	v.add_child(l)
