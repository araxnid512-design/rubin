extends Control
## Главное меню — экран при запуске игры. Фон — картинка с нарисованными кнопками: «Новая игра», «Продолжить»,
## «Настройки», «Выход». Новая игра стирает сохранение локации (имя героя и настройки остаются) и ведёт на карту
## мира; «Продолжить» — на карту мира с прежним сохранением.

const SAVE := "user://cluster.json"
var bd: ULBackdrop
var test := ""
var out := "user://menu"
var _extra: Array = []


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
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
	get_tree().change_scene_to_file("res://map.tscn")


## полигон: площадка 10×10 м — пробовать оружие и драться с врагами
func _go_arena() -> void:
	ULSettings.arena = true
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
	var w := (r.size.x - 10.0) * 0.5
	var defs := [["Полигон", _go_arena], ["3D", _go_stand]]
	for i in defs.size():
		var b := Button.new()
		b.text = defs[i][0]
		b.focus_mode = Control.FOCUS_NONE
		b.add_theme_font_size_override("font_size", int(clampf(h * 0.46, 18.0, 26.0)))
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
	get_tree().quit()
