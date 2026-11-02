class_name Hud
extends CanvasLayer
## Экран: стик движения слева (где коснулся — там центр), кнопки справа (огонь/удар — держать, смена
## оружия, обыск, живчик); касания считаются сами (несколько пальцев сразу — стик и огонь одновременно).
## Сверху — здоровье, спораны, локация и таймер перезагрузки, оружие и его износ; окна — карта Улья,
## торговец, гибель.

signal map_pick(to)
signal respawn
signal trade_action(kind, id)

var game: Node
var stick_index := -1
var stick_center := Vector2.ZERO
var stick_vec := Vector2.ZERO
var buttons := {}        # имя → Control
var pressed := {}        # индекс касания → имя кнопки
var hp_bar: ProgressBar
var hp_label: Label
var top_label: Label
var timer_label: Label
var weapon_label: Label
var toast_label: Label
var toast_t := 0.0
var stick_base: Panel
var stick_knob: Panel
var panel: PanelContainer
var panel_box: VBoxContainer
var sour: ColorRect
var hurt_flash: ColorRect

func setup(g: Node) -> void:
	game = g
	layer = 10
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(root)
	sour = _rect(root, Color(0.6, 0.58, 0.3, 0.0))
	hurt_flash = _rect(root, Color(0.6, 0.0, 0.0, 0.0))
	# здоровье и спораны
	var top := VBoxContainer.new()
	top.position = Vector2(24, 18)
	root.add_child(top)
	hp_bar = ProgressBar.new()
	hp_bar.custom_minimum_size = Vector2(260, 22)
	hp_bar.show_percentage = false
	hp_bar.add_theme_stylebox_override("fill", _box(Color(0.72, 0.16, 0.12)))
	hp_bar.add_theme_stylebox_override("background", _box(Color(0.1, 0.1, 0.1, 0.7)))
	top.add_child(hp_bar)
	hp_label = _label(top, "", 18)
	top_label = _label(top, "", 18)
	timer_label = _label(root, "", 24)
	_place(timer_label, Control.PRESET_CENTER_TOP, -150, 14, 300, 70)
	timer_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	weapon_label = _label(root, "", 20)
	_place(weapon_label, Control.PRESET_TOP_RIGHT, -400, 18, 380, 70)
	weapon_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	toast_label = _label(root, "", 22)
	_place(toast_label, Control.PRESET_CENTER, -420, -220, 840, 90)
	toast_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	toast_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	# стик
	stick_base = _circle(root, 150, Color(1, 1, 1, 0.08))
	stick_knob = _circle(root, 64, Color(1, 1, 1, 0.25))
	stick_base.visible = false
	stick_knob.visible = false
	# кнопки справа (позиции — от правого нижнего угла)
	_button(root, "fire", "Огонь", Vector2(-200, -220), 150)
	_button(root, "switch", "Смена", Vector2(-360, -150), 96)
	_button(root, "search", "Обыск", Vector2(-200, -380), 110)
	_button(root, "heal", "Живчик", Vector2(-340, -300), 96)
	buttons["search"].visible = false
	# окно (карта Улья, торговец, гибель)
	panel = PanelContainer.new()
	_place(panel, Control.PRESET_CENTER, -330, -300, 660, 600)
	panel.add_theme_stylebox_override("panel", _box(Color(0.1, 0.11, 0.1, 0.94), 14))
	panel.visible = false
	root.add_child(panel)
	panel_box = VBoxContainer.new()
	panel_box.add_theme_constant_override("separation", 10)
	panel.add_child(panel_box)

## Привязать к углу/краю экрана (preset) и задать отступы от этой точки: x, y — левый верхний угол, w×h — размер.
func _place(c: Control, preset: int, x: float, y: float, w: float, h: float) -> void:
	c.set_anchors_preset(preset)
	c.offset_left = x
	c.offset_top = y
	c.offset_right = x + w
	c.offset_bottom = y + h

func _rect(parent: Control, c: Color) -> ColorRect:
	var r := ColorRect.new()
	r.color = c
	r.set_anchors_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(r)
	return r

func _box(c: Color, radius := 6) -> StyleBoxFlat:
	var b := StyleBoxFlat.new()
	b.bg_color = c
	b.set_corner_radius_all(radius)
	b.content_margin_left = 18
	b.content_margin_right = 18
	b.content_margin_top = 14
	b.content_margin_bottom = 14
	return b

func _label(parent: Control, text: String, size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 5)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l

func _circle(parent: Control, size: float, c: Color) -> Panel:
	var p := Panel.new()
	p.size = Vector2(size, size)
	var b := StyleBoxFlat.new()
	b.bg_color = c
	b.set_corner_radius_all(int(size / 2.0))
	b.border_color = Color(1, 1, 1, 0.3)
	b.set_border_width_all(2)
	p.add_theme_stylebox_override("panel", b)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(p)
	return p

func _button(parent: Control, id: String, text: String, offset: Vector2, size: float) -> void:
	var p := _circle(parent, size, Color(0.15, 0.15, 0.14, 0.55))
	_place(p, Control.PRESET_BOTTOM_RIGHT, offset.x, offset.y, size, size)
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", 20 if size > 100 else 16)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	l.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	l.set_anchors_preset(Control.PRESET_FULL_RECT)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	p.add_child(l)
	buttons[id] = p

func _button_at(pos: Vector2) -> String:
	for id in buttons:
		var b: Control = buttons[id]
		if b.visible and b.get_global_rect().grow(12).has_point(pos):
			return id
	return ""

## Касания: левая половина — стик, кнопки — по своим кругам (каждый палец отдельно).
func _input(event: InputEvent) -> void:
	if panel.visible:
		return
	if event is InputEventScreenTouch:
		var t: InputEventScreenTouch = event
		if t.pressed:
			var b := _button_at(t.position)
			if b != "":
				pressed[t.index] = b
				_press(b, true)
			elif t.position.x < get_viewport().get_visible_rect().size.x * 0.5 and stick_index < 0:
				stick_index = t.index
				stick_center = t.position
				stick_vec = Vector2.ZERO
				stick_base.visible = true
				stick_knob.visible = true
				stick_base.position = stick_center - stick_base.size / 2.0
				stick_knob.position = stick_center - stick_knob.size / 2.0
		else:
			if pressed.has(t.index):
				_press(pressed[t.index], false)
				pressed.erase(t.index)
			if t.index == stick_index:
				stick_index = -1
				stick_vec = Vector2.ZERO
				stick_base.visible = false
				stick_knob.visible = false
	elif event is InputEventScreenDrag:
		var d: InputEventScreenDrag = event
		if d.index == stick_index:
			var off := d.position - stick_center
			var r := stick_base.size.x / 2.0
			if off.length() > r:
				off = off.normalized() * r
			stick_vec = off / r
			stick_knob.position = stick_center + off - stick_knob.size / 2.0

func _press(id: String, down: bool) -> void:
	var b: Panel = buttons[id]
	b.modulate = Color(1.4, 1.4, 1.2) if down else Color(1, 1, 1)
	match id:
		"fire":
			game.player_attack(down)
		"switch":
			if down:
				game.player_switch()
		"search":
			if down:
				game.search_start()
		"heal":
			if down:
				game.use_zhivchik()

## Движение: стик или клавиатура (WASD/стрелки — на компьютере).
func move_vector() -> Vector2:
	var k := Vector2.ZERO
	if Input.is_key_pressed(KEY_A) or Input.is_key_pressed(KEY_LEFT):
		k.x -= 1
	if Input.is_key_pressed(KEY_D) or Input.is_key_pressed(KEY_RIGHT):
		k.x += 1
	if Input.is_key_pressed(KEY_W) or Input.is_key_pressed(KEY_UP):
		k.y -= 1
	if Input.is_key_pressed(KEY_S) or Input.is_key_pressed(KEY_DOWN):
		k.y += 1
	return k.normalized() if k != Vector2.ZERO else stick_vec

func _process(delta: float) -> void:
	if toast_t > 0.0:
		toast_t -= delta
		toast_label.modulate.a = clampf(toast_t, 0.0, 1.0)
	hurt_flash.color.a = maxf(0.0, hurt_flash.color.a - delta * 1.5)

func toast(text: String, secs := 3.0) -> void:
	toast_label.text = text
	toast_t = secs
	toast_label.modulate.a = 1.0

func flash_hurt(dmg: float) -> void:
	hurt_flash.color.a = clampf(0.25 + dmg / 60.0, 0.0, 0.6)

func set_sour(k: float) -> void:
	sour.color.a = k * 0.55

func refresh(p: Player, bag: Dictionary, loc_name: String, timer: String) -> void:
	if p == null:
		return
	hp_bar.max_value = p.max_hp
	hp_bar.value = p.hp
	hp_label.text = "Здоровье %d" % int(ceil(p.hp))
	top_label.text = "Спораны %d · Горох %d · Живчики %d" % [bag.get("spore", 0), bag.get("peas", 0), bag.get("zhivchik", 0)]
	timer_label.text = "%s\n%s" % [loc_name, timer]
	var id := p.weapon_id()
	var w := Data.weapon(id)
	var line: String = w.get("name", id)
	if w.has("durability"):
		line += "\nизнос %d / %d" % [p.wear_of(id), int(w["durability"])]
	weapon_label.text = line

func show_search(on: bool, label := "Обыск") -> void:
	buttons["search"].visible = on
	(buttons["search"].get_child(0) as Label).text = label

## Окно со строкой заголовка, текстом и кнопками [[надпись, Callable], ...].
func show_panel(title: String, text: String, actions: Array) -> void:
	for c in panel_box.get_children():
		c.queue_free()
	var t := _label(panel_box, title, 28)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	if text != "":
		var body := _label(panel_box, text, 18)
		body.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		body.custom_minimum_size = Vector2(580, 0)
	for a in actions:
		var b := Button.new()
		b.text = a[0]
		b.custom_minimum_size = Vector2(0, 58)
		b.add_theme_font_size_override("font_size", 20)
		b.pressed.connect(a[1])
		if a.size() > 2 and a[2] == false:
			b.disabled = true
		panel_box.add_child(b)
	panel.visible = true
	# пальцы, что держали кнопки, — отпустить
	for i in pressed.keys():
		_press(pressed[i], false)
	pressed.clear()
	stick_index = -1
	stick_vec = Vector2.ZERO
	stick_base.visible = false
	stick_knob.visible = false

func hide_panel() -> void:
	panel.visible = false
