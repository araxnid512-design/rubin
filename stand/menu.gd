extends Control
## Главное меню — экран при запуске игры. Фон — картинка пользователя с нарисованными кнопками: «Новая игра»,
## «Продолжить», «Мультиплеер», «Настройки», «Выход». Проверочные режимы (полигон, стенд 3D, тест уровней, тест
## кейсов) — в «Настройки» → «Лаборатория». Новая игра стирает сохранение локации и базы (имя героя и настройки остаются) и ведёт на карту
## мира; «Продолжить» — на карту мира с прежним сохранением.

const SAVE := "user://cluster.json"
var bd: ULBackdrop
var test := ""
var out := "user://menu"


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
	bd.anchor_y = 0.08              # название игры сверху видно целиком, срезается низ (камни под ногами)
	# кнопки на картинке (в её точках, 1672×941)
	bd.areas = {
		"new": Rect2(1230, 248, 400, 84), "cont": Rect2(1230, 354, 400, 84), "mp": Rect2(1230, 460, 400, 84),
		"set": Rect2(1230, 564, 400, 84), "quit": Rect2(1230, 666, 400, 82),
	}
	bd.dim["cont"] = not FileAccess.file_exists(SAVE)
	add_child(bd)
	bd.tapped.connect(_on_tap)
	# какой отрисовщик (сборка А — OpenGL, Б — Vulkan): мелкая подпись в углу — для сравнения на телефоне
	var rl := Label.new()
	rl.name = "Renderer"
	rl.text = ULSettings.renderer_name()
	rl.add_theme_font_size_override("font_size", ULSettings.fs(14))
	rl.add_theme_color_override("font_color", Color(1, 1, 1, 0.55))
	rl.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_LEFT)
	rl.position = Vector2(10, get_viewport_rect().size.y - 26)
	add_child(rl)
	# прошлый запуск закрылся не сам (вылет): где именно — строкой над подписью отрисовщика (для снимка экрана)
	var prev := ULSettings.step_prev()
	if prev != "" and test == "":
		var cl := Label.new()
		cl.name = "LastStep"
		cl.text = "Прошлый раз игра закрылась на шаге: " + prev
		cl.add_theme_font_size_override("font_size", ULSettings.fs(15))
		cl.add_theme_color_override("font_color", Color(1.0, 0.8, 0.5, 0.9))
		cl.position = Vector2(10, get_viewport_rect().size.y - 50)
		add_child(cl)
	ULSettings.step_ok()
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
		"mp":
			_multiplayer()
		"set":
			ULSettings.panel(self, func() -> void: ULSettings.apply(get_viewport()), [["Замер FPS", _levels.bind(true)]] + ([["Лаборатория", _lab]] if ULSettings.dev() else []))
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


## Лаборатория (из «Настроек»): проверочные режимы — полигон 10×10, стенд 3D (движения, редактор удара), тест
## уровней (любая локация с пулемётом, бессмертный, без сохранения), тест кейсов (прокрутка оружейного сундука)
var _lab_panel: CanvasLayer


func _lab() -> void:
	if _lab_panel != null and is_instance_valid(_lab_panel):
		_lab_panel.queue_free()
	var cl := CanvasLayer.new()
	cl.layer = 22
	add_child(cl)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.62)
	cl.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_lab_panel = cl
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	shade.add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -300
	pn.offset_right = 300
	pn.offset_top = -250
	pn.offset_bottom = 250
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	pn.add_child(vb)
	var t := Label.new()
	t.text = "Лаборатория"
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.95, 0.85, 0.6))
	vb.add_child(t)
	var d := Label.new()
	d.text = "Проверочные режимы: здесь ничего не сохраняется."
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.add_theme_font_size_override("font_size", ULSettings.fs(15))
	d.add_theme_color_override("font_color", ULSettings.C_TEXT)
	vb.add_child(d)
	for it in [["lab_arena", "Полигон 10×10", _go_arena], ["lab_stand", "Стенд 3D: движения, редактор удара", _go_stand],
			["lab_levels", "Тест уровней", _levels], ["lab_cases", "Тест кейсов", _cases]]:
		var go: Callable = it[2]
		var b := ULSettings.button(String(it[1]), func() -> void:
			cl.queue_free()                      # окно лаборатории — прочь, режим открывается поверх меню
			go.call(), 560.0)
		b.name = String(it[0])
		vb.add_child(b)
	vb.add_child(ULSettings.button("Назад", func() -> void: cl.queue_free(), 560.0))


func _multiplayer() -> void:
	var cl := CanvasLayer.new()
	cl.layer = 25
	add_child(cl)
	var m := ULMpMenu.new()
	m.name = "MpMenu"
	cl.add_child(m)
	m.tree_exited.connect(cl.queue_free)


## «Тест кейсов»: та же прокрутка оружейного сундука, что в логове муров, но награда в инвентарь не выдаётся
## (результат — по тем же шансам из data/case.json)
var case_ui: ULCaseUI = null


func _cases() -> void:
	if case_ui != null and is_instance_valid(case_ui):
		return
	var cl := CanvasLayer.new()
	cl.layer = 20
	add_child(cl)
	case_ui = ULCaseUI.new()
	cl.add_child(case_ui)
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	case_ui.start(ULCase.roll(rng), true)
	case_ui.tree_exited.connect(cl.queue_free)


## «Тест уровней»: выбор локации — герой появляется на ней с пулемётом ПКП, бессмертный, патроны без конца;
## сохранение и база не трогаются, таймер кластера не убивает; выход за край поля — обратно сюда
const LEVELS := [["home", "Дом (стабильный стаб)"], ["cowshed", "Опасный коровник"], ["sanatorium", "Санаторий Луч"], ["convoy", "Разбитый конвой"],
	["khutor", "Хутор"], ["lair", "Логово муров"], ["quarry", "Карьер"], ["port", "Порт"], ["depot", "Железнодорожное депо"], ["airport", "Заброшенный аэропорт"], ["externals", "База Внешников (поверхность)"], ["arena", "Полигон 10×10"]]
var _lv_panel: Control


func _levels(bench_only := false) -> void:
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
	t.text = "Замер FPS" if bench_only else "Тест уровней"
	t.add_theme_font_size_override("font_size", 26)
	t.add_theme_color_override("font_color", Color(0.95, 0.85, 0.6))
	vb.add_child(t)
	var d := Label.new()
	d.text = "Выберите локацию: герой появится там с пулемётом, бессмертный, патроны без конца. Сохранение не меняется. Выход — за край поля или «Главное меню»."
	if bench_only:
		# замер из «Настроек» (есть и в собранной игре): выбрать место — герой сам обойдёт его за минуту, в конце — оценка
		# и таблица; прошлый результат — строкой ниже
		d.text = "Выберите место. Герой сам обойдёт его примерно за минуту — ничего нажимать не нужно. В конце появится оценка и таблица: сделайте снимок экрана и пришлите. Сохранение не меняется."
		ULSettings.bench = true
		var last := ""
		if FileAccess.file_exists("user://bench_last.txt"):
			last = FileAccess.get_file_as_string("user://bench_last.txt")
		if last != "":
			d.text += "\n\nПрошлый замер: " + last
	d.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	d.add_theme_font_size_override("font_size", ULSettings.fs(15))
	d.add_theme_color_override("font_color", ULSettings.C_TEXT)
	vb.add_child(d)
	# замер: герой сам обходит локацию, в конце — таблица кадров в секунду по местам (и копия в буфер обмена)
	if not bench_only:
		var bm := CheckButton.new()
		bm.name = "bench"
		bm.text = "Замер FPS: обойти локацию и показать кадры в секунду"
		bm.button_pressed = ULSettings.bench
		bm.add_theme_font_size_override("font_size", ULSettings.fs(16))
		bm.toggled.connect(func(v: bool) -> void: ULSettings.bench = v)
		vb.add_child(bm)
	for lv in LEVELS:
		var b := ULSettings.button(String(lv[1]), _start_level.bind(String(lv[0])), 560.0)
		b.name = "lv_" + String(lv[0])
		vb.add_child(b)
	vb.add_child(ULSettings.button("Отмена", func() -> void:
		if bench_only:
			ULSettings.bench = false
		shade.queue_free(), 560.0))


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
		ULBase.visits_wipe()
		DirAccess.remove_absolute(ProjectSettings.globalize_path(ULBase.path))
		ULBase.load_state(true)
		_go_map(), 190.0))


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(0.8).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m0_menu.png")
	var ok := true
	for k in ["new", "cont", "mp", "set", "quit"]:
		if bd.dim.get(k, false):
			continue                                 # «Продолжить» без сохранения затемнена и не нажимается
		if bd._hit(bd.to_screen(bd.areas[k]).get_center()) != k:
			ok = false
	print("[menu] пять кнопок картинки («Новая игра», «Продолжить», «Мультиплеер», «Настройки», «Выход») нажимаются по своим местам — ", "верно" if ok else "ОШИБКА")
	var vis_ok := true
	for k in bd.areas:
		var r: Rect2 = bd.to_screen(bd.areas[k])
		if r.position.y < 0.0 or r.end.y > size.y:
			vis_ok = false
	print("[menu] все кнопки картинки целиком на экране — ", "верно" if vis_ok else "ОШИБКА")
	_on_tap("set")
	await get_tree().create_timer(0.6).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m1_settings.png")
	# «Настройки» → «Лаборатория»: полигон, стенд 3D, тест уровней, тест кейсов (на главном экране их больше нет)
	var labb: Button = null
	for b in find_children("*", "Button", true, false):
		if (b as Button).text == "Лаборатория":
			labb = b
	print("[menu] в настройках есть кнопка «Лаборатория» — ", "верно" if labb != null else "ОШИБКА")
	if labb:
		labb.pressed.emit()
	await get_tree().create_timer(0.4).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m1b_lab.png")
	var lab_ok := _lab_panel != null
	for nm in ["lab_arena", "lab_stand", "lab_levels", "lab_cases"]:
		if not lab_ok or _lab_panel.find_child(nm, true, false) == null:
			lab_ok = false
	print("[menu] в лаборатории — полигон, стенд 3D, тест уровней, тест кейсов — ", "верно" if lab_ok else "ОШИБКА")
	for c in get_children():
		if c is CanvasLayer or (c is Control and c != bd):
			c.queue_free()
	await get_tree().process_frame
	# мультиплеер — кнопка на картинке, экран с профилем, сервером, созданием и входом в мир
	_on_tap("mp")
	await get_tree().create_timer(0.5).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m4_multiplayer.png")
	var mp := find_child("MpMenu", true, false)
	print("[menu] «Мультиплеер» на картинке открывает экран: профиль, сервер, «Создать», «Присоединиться», «Продолжить», «Назад» — ", "верно" if mp != null else "ОШИБКА")
	if mp:
		# выбор персонажа: обе внешности доступны, выбор виден на картинке и сохраняется (и действует в игре)
		var was := ULHeroes.current()
		var all_ok: bool = mp._char_btns.size() >= 2
		for k in mp._char_btns:
			all_ok = all_ok and not (mp._char_btns[k] as Button).disabled
		print("[menu] персонажи на выбор: %s — %s" % [", ".join(mp._char_btns.keys().map(func(k): return ULHeroes.name_of(k))), "верно" if all_ok else "ОШИБКА"])
		mp._pick_char("hero2")
		await get_tree().create_timer(0.6).timeout
		get_viewport().get_texture().get_image().save_png(out + "/m4_multiplayer_hero2.png")
		var shown: bool = mp._prev_rig != null and mp._prev_rig.model_path == ULHeroes.model("hero2") and mp._prev_rig.skel != null
		print("[menu] выбран второй персонаж: сохранён (%s), на картинке его модель со скелетом — %s" % [ULHeroes.current(), "верно" if ULHeroes.current() == "hero2" and shown else "ОШИБКА"])
		mp._pick_char(was)
		mp.queue_free()
	await get_tree().process_frame
	# «Настройки» → «Замер FPS» — есть и в собранной игре (без «Лаборатории»)
	ULSettings.dev_force = true
	_on_tap("set")
	await get_tree().process_frame
	var bb: Button = null
	var has_lab := false
	for b in find_children("*", "Button", true, false):
		if (b as Button).text == "Замер FPS":
			bb = b
		if (b as Button).text == "Лаборатория":
			has_lab = true
	if bb:
		bb.pressed.emit()
	await get_tree().create_timer(0.4).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m2a_bench.png")
	print("[menu] в настройках собранной игры есть «Замер FPS» (без «Лаборатории»): окно со списком мест, замер включён — ", "верно" if bb != null and not has_lab and _lv_panel != null and _lv_panel.find_child("lv_quarry", true, false) != null and _lv_panel.find_child("bench", true, false) == null and ULSettings.bench else "ОШИБКА")
	ULSettings.dev_force = false
	ULSettings.bench = false
	for c in get_children():
		if c is CanvasLayer or (c is Control and c != bd):
			c.queue_free()
	await get_tree().process_frame
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
	# тест кейсов: лента едет, «Пропустить» — сразу к результату под линией, в инвентарь ничего
	for c in get_children():
		if c is CanvasLayer or (c is Control and c != bd):
			c.queue_free()
	await get_tree().process_frame
	_cases()
	await get_tree().create_timer(1.6).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m3_case_spin.png")
	var moving := case_ui != null and not case_ui.done and case_ui._track.position.x < case_ui._x0 - 50.0
	print("[menu] кейс: лента едет справа налево — ", "верно" if moving else "ОШИБКА")
	case_ui.skip()
	await get_tree().create_timer(0.5).timeout
	get_viewport().get_texture().get_image().save_png(out + "/m4_case_result.png")
	var idx := int(floor((case_ui.get_viewport_rect().size.x * 0.5 - case_ui._track.position.x) / (ULCaseUI.CARD_W + ULCaseUI.GAP)))
	var under := idx == case_ui.win_at and String(case_ui.ids[idx]) == String(case_ui.reward.id)
	print("[menu] кейс: «Пропустить» — сразу конец, под линией — выбранная награда «%s» — %s" % [String(case_ui.reward.id), "верно" if case_ui.done and under else "ОШИБКА"])
	case_ui.close()
	ULSettings.level_test = false
	ULSettings.place = "home"
	get_tree().quit()
