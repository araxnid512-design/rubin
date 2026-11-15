class_name STHud
extends CanvasLayer
## Интерфейс «Дрейфа» для телефона (горизонтально): слева сверху — здоровье и выносливость, состояние корабля;
## по центру сверху — фаза цикла и таймер (ТИШИНА 09:41 / событие); справа сверху — «Корабль» и пауза; справа
## снизу под большим пальцем — «Действие» (подписано тем, что произойдёт), «Удар», «Уклон», «⇄»; слева —
## плавающий джойстик. Окна: пауза, сообщения, разговор, текст. Всё рисуется кодом.

const C_BG := Color(0.02, 0.05, 0.09, 0.8)
const C_LINE := Color(0.35, 0.8, 1.0, 0.75)
const C_GLOW := Color(0.2, 0.65, 1.0, 0.28)
const C_TEXT := Color(0.86, 0.92, 0.97)
const C_ACC := Color(0.45, 0.85, 1.0)

var root: Control
var touch: STTouch
var bars := {}
var ship_lbl: Label
var phase_lbl: Label
var timer_lbl: Label
var msg_box: VBoxContainer
var prompt_lbl: Label
var dev_lbl: Label
var modal: Control = null
var player: STHero
var _joy_was := false
var _ui_t := 0.0
var btn_labels := {}          ## кнопка → подпись
var btn_icons := {}           ## кнопка → значок


func _ready() -> void:
	layer = 10
	process_mode = Node.PROCESS_MODE_ALWAYS
	Core.hud = self
	root = Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	touch = STTouch.new()
	root.add_child(touch)
	touch.button.connect(_on_button)
	_build()
	Core.message.connect(_on_message)
	get_viewport().size_changed.connect(_layout)
	_layout.call_deferred()


## панель в стиле корабельного интерфейса: срезанные углы (radius — размер среза), неоновая рамка, свечение
func _style(bg := C_BG, radius := 12, border := 0, glow := false) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(radius)
	s.corner_detail = 1                  # прямой срез угла вместо скругления
	s.anti_aliasing = true
	s.set_content_margin_all(10)
	if border > 0:
		s.set_border_width_all(border)
		s.border_color = C_LINE
	if glow:
		s.shadow_color = C_GLOW
		s.shadow_size = 8
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


func _bar(id: String, title: String, col: Color, parent: Control) -> void:
	var row := HBoxContainer.new()
	row.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var pb := ProgressBar.new()
	pb.custom_minimum_size = Vector2(220, 14)
	pb.show_percentage = false
	pb.max_value = 100
	pb.add_theme_stylebox_override("fill", _style(col, 4))
	var bg := _style(Color(0.02, 0.04, 0.07, 0.75), 4, 1)
	bg.border_color = Color(C_LINE, 0.45)
	pb.add_theme_stylebox_override("background", bg)
	pb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	row.add_child(pb)
	row.add_child(_label(" " + title, 14))
	parent.add_child(row)
	bars[id] = pb


func _build() -> void:
	var stats := VBoxContainer.new()
	stats.name = "Stats"
	stats.add_theme_constant_override("separation", 5)
	stats.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(stats)
	_bar("hp", "Здоровье", Color(0.85, 0.25, 0.22), stats)
	_bar("st", "Выносливость", Color(0.95, 0.75, 0.25), stats)
	var sb := PanelContainer.new()
	sb.add_theme_stylebox_override("panel", _style(C_BG, 10, 1, true))
	sb.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ship_lbl = _label("", 15, C_ACC)
	sb.add_child(ship_lbl)
	stats.add_child(sb)
	dev_lbl = _label("", 13, Color(0.7, 1.0, 0.7))
	stats.add_child(dev_lbl)
	var tp := Panel.new()
	tp.name = "TopPanel"
	tp.add_theme_stylebox_override("panel", _style(C_BG, 14, 1, true))
	tp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(tp)
	phase_lbl = _label("", 16, C_ACC)
	phase_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(phase_lbl)
	timer_lbl = _label("", 34, C_TEXT)
	timer_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	root.add_child(timer_lbl)
	msg_box = VBoxContainer.new()
	msg_box.mouse_filter = Control.MOUSE_FILTER_IGNORE
	msg_box.alignment = BoxContainer.ALIGNMENT_END
	root.add_child(msg_box)
	_btn("pause", "", Vector2(64, 64), 26, 16, "pause")
	_btn("ship", "Корабль", Vector2(150, 64), 18, 16, "ship")
	_btn("action", "", Vector2(176, 176), 24, -1, "action")
	_btn("attack", "Огонь", Vector2(124, 124), 19, -1, "fire")
	_btn("dodge", "Уклон", Vector2(100, 100), 16, -1, "dodge")
	_btn("drones", "Экипаж", Vector2(96, 96), 15, -1, "crew")
	prompt_lbl = _label("", 17)
	prompt_lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	root.add_child(prompt_lbl)


## кнопка: восьмиугольник (срез — 30% стороны) с неоновой рамкой, значок и подпись
func _btn(id: String, text: String, size: Vector2, fs: int, radius := -1, icon := "") -> void:
	var p := Panel.new()
	p.name = "Btn_" + id
	p.custom_minimum_size = size
	p.size = size
	p.pivot_offset = size * 0.5
	var st := _style(Color(0.02, 0.06, 0.1, 0.66), int(minf(size.x, size.y) * 0.3) if radius < 0 else radius, 3 if id == "action" else 2, id == "action" or id == "attack")
	p.add_theme_stylebox_override("panel", st)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	root.add_child(p)
	touch.buttons[id] = p
	var wide := size.x > size.y * 1.6
	var ic: STIcon = null
	if icon != "":
		ic = STIcon.new()
		ic.kind = icon
		var isz := minf(size.x, size.y) * (0.62 if text == "" and id != "action" else (0.36 if wide else 0.4))
		ic.size = Vector2(isz, isz)
		if wide:
			ic.position = Vector2(14, (size.y - isz) * 0.5)
		elif text == "" and id != "action":
			ic.position = (size - ic.size) * 0.5
		else:
			ic.position = Vector2((size.x - isz) * 0.5, size.y * 0.16)
		p.add_child(ic)
		btn_icons[id] = ic
	var l := _label(text, fs)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	if wide and ic:
		l.position = Vector2(ic.position.x + ic.size.x + 4, 0)
		l.size = Vector2(size.x - l.position.x - 8, size.y)
	elif ic:
		l.position = Vector2(4, size.y * 0.56)
		l.size = Vector2(size.x - 8, size.y * 0.34)
	else:
		l.set_anchors_preset(Control.PRESET_FULL_RECT)
	p.add_child(l)
	btn_labels[id] = l


func _layout() -> void:
	var vs := root.get_viewport_rect().size
	var safe: Rect2 = Core.mobile.safe_rect(vs)
	var m := 16.0
	var L := safe.position.x + m
	var T := safe.position.y + m
	var R := safe.end.x - m
	var B := safe.end.y - m
	root.get_node("Stats").position = Vector2(L, T)
	var tp: Control = root.get_node("TopPanel")
	tp.position = Vector2(vs.x * 0.5 - 130, T - 8)
	tp.size = Vector2(260, 70)
	phase_lbl.position = Vector2(vs.x * 0.5 - 200, T - 4)
	phase_lbl.size = Vector2(400, 24)
	timer_lbl.position = Vector2(vs.x * 0.5 - 200, T + 16)
	timer_lbl.size = Vector2(400, 44)
	msg_box.position = Vector2(vs.x * 0.5 - 300, B - 240)
	msg_box.size = Vector2(600, 120)
	var b: Dictionary = touch.buttons
	b.pause.position = Vector2(R - 64, T)
	b.ship.position = Vector2(R - 64 - 12 - 150, T)
	var act: Control = b.action
	act.position = Vector2(R - 176, B - 176)
	b.attack.position = act.position + Vector2(-150, 52)
	b.dodge.position = act.position + Vector2(-172, -88)
	b.drones.position = act.position + Vector2(-26, -120)
	prompt_lbl.position = Vector2(R - 620, act.position.y - 160)
	prompt_lbl.size = Vector2(600, 30)
	if modal:
		modal.position = (vs - modal.size) * 0.5


func bind_player(p: STHero) -> void:
	player = p


func _process(d: float) -> void:
	if player == null:
		return
	if touch.joy_index >= 0:
		player.move_input = touch.move_vector()
		_joy_was = true
	elif _joy_was:
		player.move_input = Vector2.ZERO
		_joy_was = false
	bars.hp.value = player.hp / player.max_hp * 100.0
	bars.st.value = player.stamina
	_ui_t -= d
	if _ui_t > 0.0:
		return
	_ui_t = 0.1
	var verb := player.action_verb()
	var a: Control = touch.buttons.action
	(btn_labels.action as Label).text = verb if verb != "" else "Действие"
	var placing := Core.has_meta("place_mode")
	(btn_labels.attack as Label).text = "Отмена" if placing else "Огонь"
	var fi: STIcon = btn_icons.attack
	if fi.kind != ("cancel" if placing else "fire"):
		fi.kind = "cancel" if placing else "fire"
		fi.queue_redraw()
	a.modulate.a = 1.0 if verb != "" else 0.45
	prompt_lbl.text = player.target.label if player.target else ""
	var ss = Core.get_meta("shipst", null)
	if ss:
		ship_lbl.text = ss.status_text()
	if Core.loop:
		phase_lbl.text = Core.loop.phase_title()
		timer_lbl.text = Core.loop.timer_text()
	if Core.mobile.settings.dev:
		var st: Dictionary = Core.mobile.stats()
		dev_lbl.text = "FPS %d (ср. %.0f) · вызовов %d · объектов %d\nОЗУ %.0f МБ · видео %.0f МБ · %s" % [st.fps, st.fps_avg, st.draw, st.objects, st.mem_mb, st.vram_mb, st.gpu]
	else:
		dev_lbl.text = ""


func _on_button(n: String, pressed: bool) -> void:
	if player == null or not pressed:
		return
	match n:
		"action": player.do_interact()
		"attack": player.attack()
		"dodge": player.dodge()
		"pause": show_pause()
		"ship":
			var ss = Core.get_meta("shipst", null)
			if ss:
				ss.show_panel()
		"drones":
			if Core.loop and Core.loop.has_method("drone_orders"):
				Core.loop.drone_orders()


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventKey and e.pressed and not e.echo and player:
		match e.keycode:
			KEY_F: player.do_interact()
			KEY_SPACE: player.attack()
			KEY_X: player.dodge()
			KEY_ESCAPE: show_pause()
			KEY_F3: Core.mobile.set_value("dev", not Core.mobile.settings.dev)


func _on_message(text: String, kind: String) -> void:
	var col: Color = {"info": C_TEXT, "good": Color(0.6, 0.95, 0.6), "warn": Color(1.0, 0.82, 0.35), "bad": Color(1.0, 0.45, 0.4)}.get(kind, C_TEXT)
	var chip := PanelContainer.new()
	var cs := _style(Color(0.02, 0.05, 0.09, 0.62), 8, 0)
	cs.set_content_margin_all(6)
	cs.border_width_left = 3
	cs.border_color = col
	chip.add_theme_stylebox_override("panel", cs)
	chip.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var lt := _label(text, 17, col)
	lt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lt.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	chip.add_child(lt)
	msg_box.add_child(chip)
	var l: Control = chip
	while msg_box.get_child_count() > 3:
		var old := msg_box.get_child(0)
		msg_box.remove_child(old)
		old.queue_free()
	var tw := l.create_tween()
	tw.tween_interval(3.5)
	tw.tween_property(l, "modulate:a", 0.0, 0.8)
	tw.tween_callback(l.queue_free)


# ---------------- окна ----------------

func _open(title: String, w := 620.0, h := 420.0) -> VBoxContainer:
	close_modal()
	var p := PanelContainer.new()
	var ps := _style(Color(0.015, 0.035, 0.065, 0.96), 22, 2, true)
	ps.set_content_margin_all(16)
	p.add_theme_stylebox_override("panel", ps)
	p.custom_minimum_size = Vector2(w, h)
	p.size = Vector2(w, h)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	var top := HBoxContainer.new()
	var mark := ColorRect.new()
	mark.color = C_ACC
	mark.custom_minimum_size = Vector2(5, 30)
	mark.mouse_filter = Control.MOUSE_FILTER_IGNORE
	top.add_child(mark)
	var tl := _label("  " + title.to_upper(), 22, C_ACC)
	tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(tl)
	var x := _button("", close_modal)
	x.custom_minimum_size = Vector2(56, 48)
	var xi := STIcon.new()
	xi.kind = "close"
	xi.size = Vector2(26, 26)
	xi.position = Vector2(15, 11)
	x.add_child(xi)
	top.add_child(x)
	v.add_child(top)
	var line := ColorRect.new()
	line.color = Color(C_LINE, 0.5)
	line.custom_minimum_size = Vector2(0, 2)
	line.mouse_filter = Control.MOUSE_FILTER_IGNORE
	v.add_child(line)
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
	b.add_theme_stylebox_override("normal", _style(Color(0.04, 0.1, 0.16, 0.95), 12, 2))
	b.add_theme_stylebox_override("hover", _style(Color(0.07, 0.17, 0.26, 0.95), 12, 2, true))
	b.add_theme_stylebox_override("pressed", _style(Color(0.1, 0.3, 0.45, 0.95), 12, 2, true))
	b.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), 12, 0))
	var dis := _style(Color(0.03, 0.05, 0.07, 0.9), 12, 1)
	dis.border_color = Color(0.3, 0.4, 0.48, 0.4)
	b.add_theme_stylebox_override("disabled", dis)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_color_override("font_pressed_color", Color(1, 1, 1))
	b.add_theme_color_override("font_disabled_color", Color(0.45, 0.5, 0.55))
	b.process_mode = Node.PROCESS_MODE_ALWAYS
	b.pressed.connect(cb)
	return b


func show_text(title: String, text: String) -> void:
	var v := _open(title, 640, 340)
	var l := _label(text, 19)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(580, 0)
	v.add_child(l)


func show_dialog(title: String, text: String, options: Array) -> void:
	var v := _open(title, 700, 400)
	var l := _label(text, 19)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(660, 0)
	l.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(l)
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 12)
	if options.is_empty():
		options = [["Понятно", close_modal]]
	for o in options:
		var b := _button(o[0], o[1])
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(b)
	v.add_child(hb)


func show_pause() -> void:
	var v := _open("Пауза", 520, 420)
	v.add_child(_button("Продолжить", close_modal))
	v.add_child(_button("Сохранить игру", func():
		Core.say("Игра сохранена." if Core.save.save_game() else "Не удалось сохранить.", "good")
		close_modal()))
	v.add_child(_button("Панель разработчика: " + ("вкл" if Core.mobile.settings.dev else "выкл"), func():
		Core.mobile.set_value("dev", not Core.mobile.settings.dev)
		show_pause()))
	v.add_child(_button("Начать заново", func():
		show_dialog("Начать заново?", "Сохранение будет удалено, корабль и сектор — с начала.", [["Да, заново", func():
			Core.save.delete_save()
			close_modal()
			get_tree().paused = false
			get_tree().reload_current_scene()], ["Нет", close_modal]])))
	v.add_child(_button("Выйти из игры", func():
		Core.save.save_game()
		get_tree().quit()))


## окно со строками: [подпись, кнопка, действие, можно?]
func rows(title: String, header: String, list: Array, w := 780.0) -> void:
	rows2(title, header, list, w)


## окно со строками: [подпись, кнопка1, действие1, можно1, (кнопка2, действие2, можно2)] — прокрутка
func rows2(title: String, header: String, list: Array, w := 780.0) -> void:
	var v := _open(title, w, 500)
	if header != "":
		var hl := _label(header, 16, C_ACC)
		hl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hl.custom_minimum_size = Vector2(w - 40, 0)
		v.add_child(hl)
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(w - 40, 370)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(sc)
	var box := VBoxContainer.new()
	box.add_theme_constant_override("separation", 8)
	sc.add_child(box)
	for r in list:
		var hb := HBoxContainer.new()
		var l := _label(r[0], 16, C_TEXT if r[3] or r.size() > 4 else Color(0.55, 0.6, 0.65))
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		l.custom_minimum_size = Vector2(w - (300 if r.size() > 4 else 220), 0)
		hb.add_child(l)
		var b := _button(r[1], r[2])
		b.custom_minimum_size = Vector2(70 if r.size() > 4 else 150, 56)
		b.disabled = not r[3]
		hb.add_child(b)
		if r.size() > 4:
			var b2 := _button(r[4], r[5])
			b2.custom_minimum_size = Vector2(70, 56)
			b2.disabled = not r[6]
			hb.add_child(b2)
		box.add_child(hb)
