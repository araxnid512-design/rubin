extends Control
## Главное меню — экран при запуске игры. Фон — картинка с нарисованными кнопками: «Новая игра», «Продолжить»,
## «Настройки», «Выход». Новая игра стирает сохранение локации (имя героя и настройки остаются) и ведёт на карту
## мира; «Продолжить» — на карту мира с прежним сохранением.

const SAVE := "user://cluster.json"
var bd: ULBackdrop
var test := ""
var out := "user://menu"


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ULSettings.apply(get_viewport())
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
	get_tree().change_scene_to_file("res://map.tscn")


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
