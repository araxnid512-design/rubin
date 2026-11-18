class_name ULMpMenu
extends Control
## Экран «МУЛЬТИПЛЕЕР» из главного меню: профиль (постоянный идентификатор и секрет на телефоне), выбор
## персонажа, адрес выделенного сервера и его состояние, «Создать совместный мир» (код приглашения),
## «Присоединиться» по коду, кто в мире, «Продолжить игру», «Назад». Вся логика мира — на сервере (ULNet).

const CFG := "user://coop_client.json"

var net: ULNet
var _status: Label
var _addr: LineEdit
var _code_in: LineEdit
var _code_lbl: Label
var _members: Label
var _cont: Button
var _char_btns := {}
var _preview: SubViewportContainer
var _prev_rig: BCCharacter
var _busy := false


func _ready() -> void:
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.7)
	add_child(shade)
	shade.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -460
	pn.offset_right = 460
	pn.offset_top = -330
	pn.offset_bottom = 330
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	pn.add_child(sc)
	var vb := VBoxContainer.new()
	vb.size_flags_horizontal = SIZE_EXPAND_FILL
	vb.add_theme_constant_override("separation", 10)
	sc.add_child(vb)
	vb.add_child(_lbl("МУЛЬТИПЛЕЕР", 28, Color(0.95, 0.85, 0.6)))
	net = ULNet.get_net(get_tree())
	net.load_profile()
	var nm := _hero_name()
	vb.add_child(_lbl("Профиль: %s · номер игрока %s" % [nm, net.pid.substr(1, 6).to_upper()], 17, ULSettings.C_TEXT))
	# персонаж
	var cr := HBoxContainer.new()
	cr.add_theme_constant_override("separation", 8)
	vb.add_child(cr)
	cr.add_child(_row_lbl("Персонаж:"))
	for id in ULHeroes.LIST:
		var ok: bool = id in ULHeroes.ids()
		var b := _fit(ULSettings.button(ULHeroes.name_of(id) if ok else ULHeroes.name_of(id) + " (нет модели)", _pick_char.bind(id), 220.0))
		b.disabled = not ok
		cr.add_child(b)
		_char_btns[id] = b
	_preview = SubViewportContainer.new()
	_preview.stretch = true
	_preview.custom_minimum_size = Vector2(150, 200)
	_preview.mouse_filter = Control.MOUSE_FILTER_IGNORE
	cr.add_child(_preview)
	# сервер
	var sr := HBoxContainer.new()
	sr.add_theme_constant_override("separation", 8)
	vb.add_child(sr)
	sr.add_child(_row_lbl("Сервер:"))
	_addr = LineEdit.new()
	_addr.custom_minimum_size = Vector2(330, 52)
	_addr.size_flags_vertical = SIZE_SHRINK_CENTER
	_addr.add_theme_font_size_override("font_size", 19)
	_addr.placeholder_text = "адрес сервера, например 203.0.113.5:7777"
	sr.add_child(_addr)
	sr.add_child(_fit(ULSettings.button("Подключиться", _connect, 220.0)))
	_status = _lbl("Состояние сервера: не подключено", 17, Color(0.85, 0.75, 0.55))
	vb.add_child(_status)
	# мир
	var wr := HBoxContainer.new()
	wr.add_theme_constant_override("separation", 8)
	vb.add_child(wr)
	wr.add_child(_fit(ULSettings.button("Создать совместный мир", _create, 330.0)))
	_code_in = LineEdit.new()
	_code_in.custom_minimum_size = Vector2(170, 52)
	_code_in.size_flags_vertical = SIZE_SHRINK_CENTER
	_code_in.add_theme_font_size_override("font_size", 20)
	_code_in.placeholder_text = "код"
	_code_in.max_length = 6
	wr.add_child(_code_in)
	wr.add_child(_fit(ULSettings.button("Присоединиться", _join, 240.0)))
	_code_lbl = _lbl("", 20, Color(0.6, 0.95, 0.6))
	vb.add_child(_code_lbl)
	_members = _lbl("Игроки мира: —", 17, ULSettings.C_TEXT)
	vb.add_child(_members)
	vb.add_child(_lbl("В мире не больше двух игроков; войти можно только по коду приглашения, а потом — только своим профилем. База, постройки, ящики и маршруты — общие; инвентарь и спораны у каждого свои.", 14, Color(0.62, 0.68, 0.76)))
	var br := HBoxContainer.new()
	br.add_theme_constant_override("separation", 8)
	vb.add_child(br)
	_cont = _fit(ULSettings.button("Продолжить игру", _continue, 300.0))
	_cont.disabled = true
	br.add_child(_cont)
	br.add_child(_fit(ULSettings.button("Назад", queue_free, 200.0)))
	_load_cfg()
	_mark_char(ULHeroes.current())
	net.world_changed.connect(_show_world)
	net.connection_lost.connect(func() -> void: _status.text = "Состояние сервера: связь потеряна")


func _lbl(t: String, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## подпись в начале строки: одной строкой, фиксированной ширины (с переносом слов в узкой ячейке буквы шли столбиком)
func _row_lbl(t: String) -> Label:
	var l := _lbl(t, 17, ULSettings.C_TEXT)
	l.autowrap_mode = TextServer.AUTOWRAP_OFF
	l.custom_minimum_size = Vector2(120, 0)
	l.size_flags_vertical = SIZE_SHRINK_CENTER
	return l


func _fit(b: Button) -> Button:
	b.custom_minimum_size.y = 54
	b.size_flags_vertical = SIZE_SHRINK_CENTER
	return b


func _hero_name() -> String:
	if FileAccess.file_exists("user://profile.json"):
		var d = JSON.parse_string(FileAccess.get_file_as_string("user://profile.json"))
		if d is Dictionary and d.has("name"):
			return String(d.name)
	return "Сталкер"


func _load_cfg() -> void:
	var addr := "127.0.0.1:%d" % ULNet.PORT
	if FileAccess.file_exists(CFG):
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		if d is Dictionary:
			addr = String(d.get("addr", addr))
	_addr.text = addr


## адрес сервера и персонаж — в одном файле; запись адреса не стирает выбор персонажа
func _save_cfg(ch := "") -> void:
	var d := {}
	if FileAccess.file_exists(CFG):
		var old = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		if old is Dictionary:
			d = old
	d["addr"] = _addr.text
	if ch != "":
		d["char"] = ch
	var f := FileAccess.open(CFG, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))


func _mark_char(ch: String) -> void:
	for k in _char_btns:
		(_char_btns[k] as Button).modulate = Color(1, 1, 1) if k == ch else Color(0.6, 0.65, 0.7)
	_show_char(ch)


## как выглядит выбранный персонаж: маленькая сцена с ним в стойке
func _show_char(ch: String) -> void:
	if _preview == null:
		return
	for c in _preview.get_children():
		c.queue_free()
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.size = Vector2i(150, 200)
	_preview.add_child(vp)
	var cam := Camera3D.new()
	cam.fov = 30
	cam.position = Vector3(0, 1.0, 4.2)
	cam.look_at_from_position(cam.position, Vector3(0, 0.92, 0))
	vp.add_child(cam)
	var l := DirectionalLight3D.new()
	l.rotation_degrees = Vector3(-35, 25, 0)
	vp.add_child(l)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.6, 0.62, 0.66)
	env.environment.ambient_light_energy = 0.8
	vp.add_child(env)
	_prev_rig = BCCharacter.new()
	vp.add_child(_prev_rig)
	ULHeroes.setup_rig(_prev_rig, ch)
	_prev_rig.rotation.y = -0.4


func _pick_char(ch: String) -> void:
	_save_cfg(ch)
	_mark_char(ch)
	if net.online():
		await net.ask("set_char", {"char": ch})


func _connect() -> void:
	if _busy:
		return
	_busy = true
	_save_cfg()
	var parts := _addr.text.strip_edges().split(":")
	var host := parts[0] if parts.size() > 0 and parts[0] != "" else "127.0.0.1"
	var port := int(parts[1]) if parts.size() > 1 else ULNet.PORT
	_status.text = "Состояние сервера: подключение к %s:%d…" % [host, port]
	if net.connect_to(host, port) != OK:
		_status.text = "Состояние сервера: неверный адрес"
		_busy = false
		return
	var t0 := Time.get_ticks_msec()
	while not net.online() and Time.get_ticks_msec() - t0 < 6000:
		await get_tree().process_frame
	if not net.online():
		_status.text = "Состояние сервера: нет ответа (сервер выключен или порт закрыт)"
		_busy = false
		return
	var r: Dictionary = await net.ask("hello", {"name": _hero_name()})
	if not r.get("ok", false):
		_status.text = "Состояние сервера: отказ (%s)" % String(r.get("err", ""))
	else:
		_status.text = "Состояние сервера: в сети"
		var ws: Array = r.get("worlds", [])
		if not ws.is_empty():
			net.world = ws[0]
			_show_world(ws[0])
	_busy = false


func _create() -> void:
	if not net.online():
		_status.text = "Сначала подключитесь к серверу"
		return
	var r: Dictionary = await net.ask("create_world")
	if r.get("ok", false):
		net.world = r.world
		_show_world(r.world)


func _join() -> void:
	if not net.online():
		_status.text = "Сначала подключитесь к серверу"
		return
	var r: Dictionary = await net.ask("join", {"code": _code_in.text.strip_edges().to_upper()})
	if r.get("ok", false):
		net.world = r.world
		_show_world(r.world)
	else:
		_code_lbl.text = {"full": "В этом мире уже двое", "no_world": "Мира с таким кодом нет"}.get(String(r.get("err", "")), "Не удалось: %s" % String(r.get("err", "")))


func _show_world(w: Dictionary) -> void:
	_code_lbl.text = "Код приглашения: %s (передайте напарнику)" % String(w.get("code", ""))
	var names: Array = w.get("names", [])
	_members.text = "Игроки мира (%d из 2): %s" % [names.size(), ", ".join(names)]
	_cont.disabled = false


## совместная игра на локациях — следующие этапы; сейчас мир, база и ящики живут на сервере
func _continue() -> void:
	_status.text = "Общий мир на сервере готов. Совместное прохождение на одной локации (видеть напарника, общие враги) — следующий этап разработки."
