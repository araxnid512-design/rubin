extends Control
## Главное меню — экран при запуске игры. Фон — картинка с нарисованными кнопками: «Новая игра», «Продолжить»,
## «Настройки», «Выход». Новая игра стирает сохранение локации и базы (имя героя и настройки остаются) и ведёт на карту
## мира; «Продолжить» — на карту мира с прежним сохранением.

const SAVE := "user://cluster.json"
var bd: ULBackdrop
var test := ""
var out := "user://menu"
var _extra: Array = []


func _ready() -> void:
	# после «Теста уровней» — снова настоящая база (тест держал её только в памяти)
	ULSettings.level_test = false
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	if ULBase.memory_only and test == "":
		ULBase.memory_only = false
		ULBase.load_state(true)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ULSettings.apply(get_viewport())
	Music.play_menu()
	bd = ULBackdrop.new()
	bd.tex = load("res://assets/ui/title.jpg")
	bd.anchor_y = 0.04              # название игры сверху видно целиком, срезается низ (камни под ногами)
	bd.areas = {
		"new": Rect2(1230, 282, 398, 84), "cont": Rect2(1230, 390, 398, 84),
		"set": Rect2(1230, 498, 398, 84), "quit": Rect2(1230, 606, 398, 84),
	}
	bd.dim["cont"] = not FileAccess.file_exists(SAVE)
	add_child(bd)
	bd.tapped.connect(_on_tap)
	_extra_buttons.call_deferred()
	resized.connect(_extra_buttons)
	if test != "":
		_run_test.call_deferred()


func _on_tap(id: String) -> void:
	match id:
		"new":
			if FileAccess.file_exists(SAVE):
				_confirm_new()
			else:
				_go_map()
		"cont":
			_go_map()
		"set":
			ULSettings.panel(self, func() -> void: ULSettings.apply(get_viewport()))
		"quit":
			get_tree().quit()


func _go_map() -> void:
	ULSettings.arena = false
	ULSettings.place = "home"
	get_tree().change_scene_to_file("res://map.tscn")


## полигон: площадка 10×10 м — пробовать оружие и драться с врагами
func _go_arena() -> void:
	ULSettings.arena = true
	ULSettings.place = "home"
	get_tree().change_scene_to_file("res://world.tscn")


## стенд 3D: герой и враги крупным планом, все движения
func _go_stand() -> void:
	ULSettings.stand_back = "res://menu.tscn"
	get_tree().change_scene_to_file("res://stand.tscn")


## две кнопки под нарисованными: «Полигон» и «3D» (в ширину кнопки «Выход», вдвоём)
func _extra_buttons() -> void:
	for b in _extra:
		b.queue_free()
	_extra = []
	var r := bd.to_screen(Rect2(1236, 702, 386, 62))
	var h := minf(r.size.y, size.y - r.position.y - 6.0)
	if h < 30.0:
		# низ картинки срезан экраном — кнопки встают вплотную к нижнему краю
		h = 44.0
		r.position.y = size.y - h - 6.0
	var w := (r.size.x - 20.0) / 3.0
	var defs := [["Полигон", _go_arena], ["3D", _go_stand], ["Тест уровней", _levels]]
	for i in defs.size():
		var b := Button.new()
		b.text = defs[i][0]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", int(clampf(h * 0.4, 15.0, 22.0)))
		b.add_theme_color_override("font_color", Color(0.95, 0.88, 0.72))
		for st in ["normal", "hover", "pressed"]:
			var sb := StyleBoxFlat.new()
			sb.bg_color = Color(0.1, 0.085, 0.07, 0.9) if st != "pressed" else Color(0.3, 0.2, 0.08, 0.95)
			sb.border_color = Color(0.85, 0.55, 0.2, 0.9)
			sb.set_border_width_all(2)
			sb.set_corner_radius_all(8)
			b.add_theme_stylebox_override(st, sb)
		b.position = Vector2(r.position.x + i * (w + 10.0), r.position.y)
		b.size = Vector2(w, h)
		b.pressed.connect(defs[i][1])
		add_child(b)
		_extra.append(b)


## «Тест уровней»: выбор локации — герой появляется на ней с пулемётом ПКП, бессмертный, патроны без конца;
## сохранение и база не трогаются, таймер кластера не убивает; выход за край поля — обратно сюда
const LEVELS := [["home", "Дом (стабильный стаб)"], ["cowshed", "Опасный коровник"], ["sanatorium", "Санаторий Луч"], ["convoy", "Разбитый конвой"],
	["khutor", "Хутор"], ["arena", "Полигон 10×10"]]
var _lv_panel: Control


func _levels() -> void:
	if _lv_panel != null and is_instance_valid(_lv_panel):
		_lv_panel.queue_free()
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.62)
	add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_lv_panel = shade
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	shade.add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -300
	pn.offset_right = 300
	pn.offset_top = -315
	pn.offset_bottom = 315
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	pn.add_child(vb)
	var t := Label.new()
	t.text = "Тест уровней"
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.95, 0.85, 0.6))
	vb.add_child(t)
	var d := Label.new()
	d.text = "Выберите локацию: герой появится там с пулемётом, бессмертный, патроны без конца. Сохранение не меняется. Выход — за край поля или «Главное меню»."
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.add_theme_font_size_override("font_size", 15)
	d.add_theme_color_override("font_color", ULSettings.C_TEXT)
	vb.add_child(d)
	# замер: герой сам обходит локацию, в конце — таблица кадров в секунду по местам (и копия в буфер обмена)
	var bm := CheckButton.new()
	bm.name = "bench"
	bm.text = "Замер FPS: обойти локацию и показать кадры в секунду"
	bm.button_pressed = ULSettings.bench
	bm.add_theme_font_size_override("font_size", 16)
	bm.toggled.connect(func(v: bool) -> void: ULSettings.bench = v)
	vb.add_child(bm)
	for lv in LEVELS:
		var b := ULSettings.button(String(lv[1]), _start_level.bind(String(lv[0])), 560.0)
		b.name = "lv_" + String(lv[0])
		vb.add_child(b)
	vb.add_child(ULSettings.button("Отмена", func() -> void: shade.queue_free(), 560.0))


func _start_level(id: String) -> void:
	ULSettings.level_test = true
	ULSettings.arena = id == "arena"
	ULSettings.place = "home" if id == "arena" else id
	if test == "":
		get_tree().change_scene_to_file("res://world.tscn")


## новая игра при существующем сохранении — переспросить
func _confirm_new() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	shade.add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -270
	pn.offset_right = 270
	pn.offset_top = -100
	pn.offset_bottom = 100
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	pn.add_child(vb)
	var l := Label.new()
	l.text = "Начать заново? Вещи, ящики и запасы на локации вернутся к начальным. Имя героя и настройки останутся."
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_color", ULSettings.C_TEXT)
	l.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(l)
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	hb.add_theme_constant_override("separation", 8)
	vb.add_child(hb)
	hb.add_child(ULSettings.button("Отмена", func() -> void: shade.queue_free(), 130.0))
	hb.add_child(ULSettings.button("Начать заново", func() -> void:
		DirAccess.remove_absolute(ProjectSettings.globalize_path(SAVE))
		# новая игра — и база с нуля: без оружейника, без купленных маршрутов, таймер маршрутов заново
		DirAccess.remove_absolute(ProjectSettings.globalize_path(ULBase.path))
		ULBase.load_state(true)
		_go_map(), 190.0))


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(0.8).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m0_menu.png")
	var ok := bd._hit(bd.to_screen(bd.areas["new"]).get_center()) == "new" and bd._hit(bd.to_screen(bd.areas["quit"]).get_center()) == "quit"
	print("[menu] кнопки «Новая игра» и «Выход» нажимаются по своим местам на картинке — ", "верно" if ok else "ОШИБКА")
	_on_tap("set")
	await get_tree().create_timer(0.6).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m1_settings.png")
	# тест уровней: окно со списком локаций, выбор — флаг и место
	for c in get_children():
		if c is CanvasLayer or (c is Control and c != bd and not _extra.has(c)):
			c.queue_free()
	await get_tree().process_frame
	var lb: Button = null
	for b in _extra:
		if (b as Button).text == "Тест уровней":
			lb = b
	print("[menu] кнопка «Тест уровней» есть — ", "верно" if lb != null else "ОШИБКА")
	_levels()
	await get_tree().create_timer(0.4).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m2_levels.png")
	var has_all := true
	for lv in LEVELS:
		if _lv_panel.find_child("lv_" + String(lv[0]), true, false) == null:
			has_all = false
	print("[menu] в окне — все локации (%d) — %s" % [LEVELS.size(), "верно" if has_all else "ОШИБКА"])
	_start_level("khutor")
	print("[menu] выбор «Хутор»: тест уровня включён, место — хутор — ", "верно" if ULSettings.level_test and ULSettings.place == "khutor" and not ULSettings.arena else "ОШИБКА")
	ULSettings.level_test = false
	ULSettings.place = "home"
	get_tree().quit()
