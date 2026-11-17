class_name ULBasePC
extends Control
## Экран базового компьютера (по макету пользователя, во весь экран, альбомная ориентация): сверху — название,
## пять ресурсов и кнопка закрытия; слева — улучшения базы (оружейник); справа — маршруты в нестабильные кластеры
## и таймер новых маршрутов; снизу — цепочка обмена ресурсов с кнопками «Купить» и «Продать». Всё видно сразу;
## отдельное окно открывается только для обмена и для подтверждения покупки.
## Игровая логика — в ULBase (покупки, маршруты, таймер) и ULEconomy (обмен); здесь только показ и нажатия.
## w — локация (world.gd): кошелёк героя (w.inv), сохранение и появление оружейника (w.pc_done).

signal closed

const UI := "res://assets/ui/"
const C_BG := Color(0.07, 0.08, 0.08)
const C_PANEL := Color(0.03, 0.065, 0.058, 0.97)
const C_CARD := Color(0.045, 0.095, 0.083)
const C_LINE := Color(0.19, 0.4, 0.31)
const C_GLOW := Color(0.5, 0.9, 0.36)
const C_GOLD := Color(1.0, 0.82, 0.32)
const C_TEXT := Color(0.87, 0.91, 0.87)
const C_DIM := Color(0.6, 0.66, 0.62)
const C_RED := Color(0.97, 0.4, 0.33)
const RES_NAMES := {"spore": "Спораны", "pea": "Горох", "pearl_black": "Чёрная\nжемчужина",
	"pearl_red": "Красная\nжемчужина", "pearl_white": "Белая\nжемчужина"}
const RES_SHORT := {"spore": "Спораны", "pea": "Горох", "pearl_black": "Чёрная", "pearl_red": "Красная", "pearl_white": "Белая"}

var w                              ## локация (world.gd)
var inv: ULInventory
var busy := false                  ## идёт сделка — повторное нажатие не проходит
var _bold: FontVariation
var _wallet := {}                  ## ресурс → надпись количества
var _timer_lbl: Label
var _refreshes := -1
var _tick := 0.0
var _sections := {}                ## раздел → панель (для подсветки по вкладке)
var _tabs := {}
var _left_box: VBoxContainer
var _right_box: VBoxContainer
var _dlg: Control
var _dlg_ok: Callable
var _toast: PanelContainer
var _toast_lbl: Label
var _toast_tw: Tween
# окно обмена
var ex: Control
var ex_mode := "buy"
var ex_hi := "pea"                 ## старший ресурс выбранной пары
var ex_n := 1
var _ex_edit: LineEdit
var _ex_tab_btn := {}
var _ex_give := {}
var _ex_get := {}
var _ex_lbl := {}
var _ex_ok: Button
var _ex_qty_title: Label
var _ex_cool := 0.0                ## после сделки кнопка «Подтвердить» выключена ещё на мгновение (двойное касание)


func setup(world) -> void:
	w = world
	inv = world.inv
	name = "BasePC"
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_STOP
	_bold = FontVariation.new()
	_bold.base_font = ThemeDB.fallback_font
	_bold.variation_embolden = 0.75
	var bg := ColorRect.new()
	bg.color = C_BG
	add_child(bg)
	bg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var fr := NinePatchRect.new()
	fr.texture = load(UI + "pc_frame.png")
	for s in [SIDE_LEFT, SIDE_TOP, SIDE_RIGHT, SIDE_BOTTOM]:
		fr.set_patch_margin(s, 30)
	fr.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(fr)
	fr.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var root := VBoxContainer.new()
	root.add_theme_constant_override("separation", 6)
	add_child(root)
	root.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	for s in [SIDE_LEFT, SIDE_TOP]:
		root.set_offset(s, 33)
	for s in [SIDE_RIGHT, SIDE_BOTTOM]:
		root.set_offset(s, -33)
	root.add_child(_top_bar())
	root.add_child(_tab_row())
	var mid := HBoxContainer.new()
	mid.add_theme_constant_override("separation", 8)
	mid.size_flags_vertical = SIZE_EXPAND_FILL
	root.add_child(mid)
	var left := _section("upgrades", true)
	left.size_flags_stretch_ratio = 0.44
	mid.add_child(left)
	_left_box = left.get_child(0).get_child(0) as VBoxContainer
	var right := _section("routes", true)
	right.size_flags_stretch_ratio = 0.56
	mid.add_child(right)
	_right_box = right.get_child(0).get_child(0) as VBoxContainer
	root.add_child(_exchange_bar())
	_toast = PanelContainer.new()
	_toast.add_theme_stylebox_override("panel", _sb(Color(0.03, 0.08, 0.05, 0.95), C_GLOW, 2, 6, 12))
	_toast_lbl = _lbl("", 16, C_TEXT)
	_toast.add_child(_toast_lbl)
	_toast.visible = false
	_toast.mouse_filter = MOUSE_FILTER_IGNORE
	add_child(_toast)
	inv.changed.connect(_refresh_wallet)
	ULBase.routes_tick()
	_build_upgrades()
	_build_routes()
	_refresh_wallet(false)
	_set_tab("upgrades")
	# плавное появление
	modulate.a = 0.0
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 1.0, 0.18)


func _process(delta: float) -> void:
	if _ex_cool > 0.0:
		_ex_cool -= delta
		if _ex_cool <= 0.0 and ex:
			_ex_refresh(false)
	_tick -= delta
	if _tick > 0.0:
		return
	_tick = 0.25
	var left := ULBase.routes_tick()
	if _timer_lbl:
		_timer_lbl.text = ULBase.clock(left)
	var rf := int(ULBase.data.get("refreshes", 0))
	if _refreshes >= 0 and rf != _refreshes:
		_build_routes()                     # ассортимент маршрутов обновился
	_refreshes = rf


func close() -> void:
	if ex:
		ex_close()
	closed.emit()
	queue_free()


# ---------------- оформление ----------------

func _sb(bg: Color, border: Color, bw := 1, radius := 6, margin := 8, glow := 0.0) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	if glow > 0.0:
		sb.shadow_color = Color(border.r, border.g, border.b, 0.35)
		sb.shadow_size = int(glow)
	return sb


func _lbl(t: String, fs: float, col: Color, bold := false, wrap := false) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", int(fs))
	l.add_theme_color_override("font_color", col)
	if bold:
		l.add_theme_font_override("font", _bold)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = SIZE_EXPAND_FILL
	l.mouse_filter = MOUSE_FILTER_IGNORE
	return l


func _ico(tex, sz: float) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load(UI + "pc/%s.png" % tex) if tex is String else tex
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(sz, sz)
	t.mouse_filter = MOUSE_FILTER_IGNORE
	return t


func _pic(path: String, min_size: Vector2) -> TextureRect:
	var t := TextureRect.new()
	if ResourceLoader.exists(path):
		t.texture = load(path)
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	t.custom_minimum_size = min_size
	t.mouse_filter = MOUSE_FILTER_IGNORE
	return t


## кнопка: kind — green (купить), orange (продать), red (закрыть), gray (недоступно)
func _btn(text: String, icon: String, kind: String, cb: Callable, min_size := Vector2(0, 46), fs := 17) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.add_theme_font_size_override("font_size", fs)
	b.add_theme_font_override("font", _bold)
	if icon != "":
		b.icon = load(UI + "pc/%s.png" % icon)
		b.add_theme_constant_override("icon_max_width", int(min_size.y * 0.55))
		b.add_theme_constant_override("h_separation", 10)
	_style_btn(b, kind)
	b.focus_mode = FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _style_btn(b: Button, kind: String) -> void:
	var c: Array = {
		"green": [Color(0.1, 0.27, 0.08), Color(0.55, 0.95, 0.3), Color(0.9, 1.0, 0.82)],
		"orange": [Color(0.3, 0.18, 0.04), Color(1.0, 0.68, 0.22), Color(1.0, 0.92, 0.75)],
		"red": [Color(0.42, 0.05, 0.05), Color(0.95, 0.28, 0.22), Color(1.0, 0.85, 0.85)],
		"gray": [Color(0.1, 0.13, 0.12), Color(0.3, 0.38, 0.34), Color(0.62, 0.68, 0.64)],
		"tab": [Color(0.04, 0.09, 0.08), Color(0.22, 0.4, 0.33), Color(0.8, 0.88, 0.84)],
		"tab_on": [Color(0.17, 0.2, 0.06), Color(0.95, 0.85, 0.3), Color(1.0, 0.97, 0.85)],
	}[kind]
	var glow := 5.0 if kind in ["green", "orange", "red", "tab_on"] else 0.0
	b.add_theme_stylebox_override("normal", _sb(c[0], c[1], 2, 6, 10, glow))
	b.add_theme_stylebox_override("hover", _sb(c[0].lightened(0.08), c[1], 2, 6, 10, glow))
	b.add_theme_stylebox_override("pressed", _sb(c[0].lightened(0.2), c[1].lightened(0.2), 2, 6, 10, glow))
	b.add_theme_stylebox_override("disabled", _sb(c[0], c[1], 2, 6, 10, glow))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color", "font_focus_color"]:
		b.add_theme_color_override(k, c[2])
	b.set_meta("kind", kind)


func _card(bg := C_CARD, border := C_LINE) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(bg, border, 1, 6, 8))
	return p


# ---------------- верх: название, ресурсы, закрыть ----------------

func _top_bar() -> Control:
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 6)
	top.custom_minimum_size.y = 64
	var title := _card(C_PANEL)
	title.size_flags_horizontal = SIZE_EXPAND_FILL
	title.size_flags_stretch_ratio = 1.75
	top.add_child(title)
	var th := HBoxContainer.new()
	th.add_theme_constant_override("separation", 10)
	title.add_child(th)
	th.add_child(_ico("monitor", 44))
	var tv := VBoxContainer.new()
	tv.alignment = BoxContainer.ALIGNMENT_CENTER
	tv.add_theme_constant_override("separation", 0)
	th.add_child(tv)
	tv.add_child(_lbl("БАЗОВЫЙ КОМПЬЮТЕР", 22, Color(0.95, 0.97, 0.95), true))
	tv.add_child(_lbl("Управление базой • Маршруты • Обмен ресурсов", 12, C_DIM))
	for id in ULItems.MONEY:
		var cell := _card(C_PANEL)
		cell.size_flags_horizontal = SIZE_EXPAND_FILL
		cell.name = "res_" + id
		top.add_child(cell)
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 6)
		cell.add_child(h)
		h.add_child(_ico(ULItems.icon(id), 40))
		var v := VBoxContainer.new()
		v.alignment = BoxContainer.ALIGNMENT_CENTER
		v.add_theme_constant_override("separation", -2)
		h.add_child(v)
		var nl := _lbl(String(RES_NAMES[id]), 11, C_TEXT)
		nl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(nl)
		var cl := _lbl("0", 19, C_GOLD, true)
		cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		v.add_child(cl)
		_wallet[id] = cl
	var x := _btn("✕", "", "red", close, Vector2(66, 58), 30)
	x.name = "Close"
	top.add_child(x)
	return top


func _refresh_wallet(rebuild := true) -> void:
	for id in _wallet:
		(_wallet[id] as Label).text = str(int(inv.wallet.get(id, 0)))
	if rebuild and is_inside_tree():
		_build_upgrades()
		_build_routes()
		if ex:
			_ex_refresh()


## количество ресурса на верхней панели (для проверок)
func shown(id: String) -> int:
	return int((_wallet[id] as Label).text)


# ---------------- вкладки-заголовки разделов ----------------

func _tab_row() -> Control:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	for t in [["upgrades", "Улучшение базы", "tools"], ["routes", "Маршруты (локации)", "map"], ["exchange", "Обмен ресурсов", "swap"]]:
		var b := _btn(String(t[1]), String(t[2]), "tab", _set_tab.bind(String(t[0])), Vector2(240, 32), 15)
		row.add_child(b)
		_tabs[t[0]] = b
	return row


## вкладка не прячет разделы (всё видно сразу) — подсвечивает выбранный
func _set_tab(id: String) -> void:
	for k in _tabs:
		_style_btn(_tabs[k], "tab_on" if k == id else "tab")
	for k in _sections:
		var p: PanelContainer = _sections[k]
		p.add_theme_stylebox_override("panel", _sb(C_PANEL, Color(0.75, 0.75, 0.3) if k == id else C_LINE, 2 if k == id else 1, 6, 8, 4.0 if k == id else 0.0))


## раздел экрана; scroll — содержимое прокручивается, если на маленьком экране не влезает (иначе раздел
## выталкивал бы нижнюю полосу за рамку)
func _section(id: String, scroll := false) -> PanelContainer:
	var p := PanelContainer.new()
	p.size_flags_horizontal = SIZE_EXPAND_FILL
	p.add_theme_stylebox_override("panel", _sb(C_PANEL, C_LINE, 1, 6, 8))
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 5)
	v.size_flags_horizontal = SIZE_EXPAND_FILL
	v.size_flags_vertical = SIZE_EXPAND_FILL
	if scroll:
		var sc := ScrollContainer.new()
		sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
		sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_AUTO
		p.add_child(sc)
		sc.add_child(v)
	else:
		p.add_child(v)
	_sections[id] = p
	return p


func _soon(text: String, icon: String) -> Control:
	var c := _card(Color(0.04, 0.07, 0.065), Color(0.16, 0.26, 0.22))
	c.size_flags_vertical = SIZE_EXPAND_FILL
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 2)
	c.add_child(v)
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 10)
	v.add_child(h)
	if icon != "":
		h.add_child(_ico(icon, 30))
	h.add_child(_ico("lock_s", 20))
	h.add_child(_lbl("В ДОРАБОТКЕ", 18, C_DIM, true))
	var l := _lbl(text, 12, C_DIM)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	return c


func _price_row(price: Dictionary, fs := 15, sz := 24.0, neutral := false) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	for id in price:
		var ok := neutral or int(inv.wallet.get(String(id), 0)) >= int(price[id])
		h.add_child(_ico(ULItems.icon(String(id)), sz))
		var l := _lbl(ULEconomy.amount(String(id), int(price[id])), fs, C_TEXT if ok else C_RED, true)
		h.add_child(l)
		var sp := Control.new()
		sp.custom_minimum_size.x = 10
		h.add_child(sp)
	return h


# ---------------- слева: улучшения базы ----------------

func _build_upgrades() -> void:
	if _left_box == null:
		return
	for c in _left_box.get_children():
		_left_box.remove_child(c)
		c.queue_free()
	_left_box.add_child(_lbl("Улучшения и постройки базы", 17, Color(0.95, 0.97, 0.95), true))
	var ups: Dictionary = ULBase.shop().get("upgrades", {})
	for id in ups:
		var d: Dictionary = ups[id]
		var card := _card()
		card.name = "up_" + String(id)
		_left_box.add_child(card)
		var h := HBoxContainer.new()
		h.add_theme_constant_override("separation", 10)
		card.add_child(h)
		h.add_child(_pic(String(d.get("pic", "")), Vector2(160, 182)))
		var v := VBoxContainer.new()
		v.size_flags_horizontal = SIZE_EXPAND_FILL
		v.add_theme_constant_override("separation", 4)
		h.add_child(v)
		var th := HBoxContainer.new()
		th.add_theme_constant_override("separation", 8)
		v.add_child(th)
		if d.has("icon"):
			th.add_child(_ico(String(d.icon), 26))
		th.add_child(_lbl(String(d.n), 20, Color(0.97, 0.97, 0.94), true))
		v.add_child(_lbl(String(d.d), 12, C_TEXT, false, true))
		var sep := HSeparator.new()
		sep.add_theme_stylebox_override("separator", _sb(C_LINE, C_LINE, 0, 0, 0))
		v.add_child(sep)
		var have := ULBase.installed(String(id))
		v.add_child(_lbl("Стоимость установки:", 13, C_DIM))
		v.add_child(_price_row(d.price, 15, 24.0, have))
		var b: Button
		if have:
			b = _btn("УСТАНОВЛЕНО", "", "gray", func() -> void: pass, Vector2(0, 42), 16)
			b.disabled = true
		else:
			b = _btn("КУПИТЬ И УСТАНОВИТЬ", "hammer", "green", ask_upgrade.bind(String(id)), Vector2(0, 42), 16)
		b.name = "buy"
		v.add_child(b)
	_left_box.add_child(_soon("Новые улучшения базы появятся позже.", "tools_off"))


## Нажата «Купить и установить»: не хватает — предупреждение с недостачей; хватает — подтверждение
func ask_upgrade(id: String) -> void:
	if busy or ULBase.installed(id):
		return
	var d: Dictionary = ULBase.shop().upgrades[id]
	var miss := ULEconomy.missing(inv.wallet, d.price)
	if not miss.is_empty():
		_dialog("Не хватает ресурсов", "Для установки «%s» нужно: %s.\nНе хватает: %s." % [String(d.n), ULEconomy.list_text(d.price), ULEconomy.list_text(miss)], Callable())
		return
	_dialog("Подтвердите покупку", "Купить и установить «%s» за %s?\nПосле установки он появится в оружейной." % [String(d.n), ULEconomy.list_text(d.price)], _do_upgrade.bind(id))


func _do_upgrade(id: String) -> void:
	if busy:
		return
	busy = true
	var r := ULBase.buy_upgrade(inv, id)
	if r.ok:
		w.pc_done("upgrade", id)
		toast("«%s» установлен — он в оружейной, за прилавком." % String(ULBase.shop().upgrades[id].n))
	elif r.err == "money":
		toast("Не хватает: " + ULEconomy.list_text(r.miss))
	_build_upgrades()
	busy = false


# ---------------- справа: маршруты ----------------

func _build_routes() -> void:
	if _right_box == null:
		return
	for c in _right_box.get_children():
		_right_box.remove_child(c)
		c.queue_free()
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 8)
	_right_box.add_child(head)
	var hl := HBoxContainer.new()
	hl.size_flags_horizontal = SIZE_EXPAND_FILL
	hl.add_theme_constant_override("separation", 8)
	head.add_child(hl)
	hl.add_child(_ico("pin", 28))
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 0)
	hl.add_child(hv)
	hv.add_child(_lbl("Маршруты (локации)", 17, Color(0.95, 0.97, 0.95), true))
	hv.add_child(_lbl("Покупка маршрутов в нестабильные кластеры.", 12, C_DIM))
	var tc := _card(C_PANEL)
	head.add_child(tc)
	var th := HBoxContainer.new()
	th.add_theme_constant_override("separation", 8)
	tc.add_child(th)
	th.add_child(_ico("clock", 30))
	var tv := VBoxContainer.new()
	tv.add_theme_constant_override("separation", -2)
	th.add_child(tv)
	tv.add_child(_lbl("Новые маршруты через:", 12, C_TEXT))
	_timer_lbl = _lbl(ULBase.clock(ULBase.routes_tick()), 21, C_GOLD, true)
	_timer_lbl.name = "RouteTimer"
	tv.add_child(_timer_lbl)
	var routes: Dictionary = ULBase.shop().get("routes", {})
	var n := 0
	for id in ULBase.offers():
		if routes.has(id):
			_right_box.add_child(_route_card(String(id), routes[id], ULBase.offers().size() > 1))
			n += 1
	if n < 2:
		_right_box.add_child(_soon("Другие локации будут добавлены позже.", ""))


## compact — карточки поменьше, чтобы два маршрута помещались без прокрутки (как на макете)
func _route_card(id: String, d: Dictionary, compact := false) -> Control:
	var cs: Dictionary = ULCowshed.cfg() if id == "cowshed" else (ULSanatorium.cfg() if id == "sanatorium" else {})
	var card := _card()
	card.name = "route_" + id
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 4)
	card.add_child(v)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 10)
	v.add_child(h)
	h.add_child(_pic(String(d.get("pic", "")), Vector2(170, 100) if compact else Vector2(182, 138)))
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = SIZE_EXPAND_FILL
	tv.add_theme_constant_override("separation", 0 if compact else 2)
	h.add_child(tv)
	var th := HBoxContainer.new()
	th.add_theme_constant_override("separation", 8)
	tv.add_child(th)
	if d.has("icon"):
		th.add_child(_ico(String(d.icon), 28))
	th.add_child(_lbl(String(d.n), 17 if compact else 19, Color(0.97, 0.97, 0.94), true))
	var dl := _lbl(String(d.d), 10 if compact else 11, C_TEXT, false, true)
	dl.add_theme_constant_override("line_spacing", -2 if compact else -1)
	tv.add_child(dl)
	var size := int(cs.get("size", 150))
	var stats := [["st_size", "Размер: %d × %d м" % [size, size]], ["st_time", "Время на локации: %d мин" % int(d.get("minutes", 10))]]
	if cs.has("pustysh"):
		stats.append(["st_skull", "Пустыши: %d – %d (случайно)" % [int(cs.pustysh[0]), int(cs.pustysh[1])]])
		stats.append(["st_claw", "Лоторейщики: %d – %d (случайно)" % [int(cs.lottery[0]), int(cs.lottery[1])]])
	var grid := GridContainer.new()
	grid.columns = 2 if compact else 1
	grid.add_theme_constant_override("h_separation", 12)
	grid.add_theme_constant_override("v_separation", 0)
	tv.add_child(grid)
	for s in stats:
		var sh := HBoxContainer.new()
		sh.add_theme_constant_override("separation", 5)
		grid.add_child(sh)
		sh.add_child(_ico(String(s[0]), 13 if compact else 16))
		sh.add_child(_lbl(String(s[1]), 10 if compact else 12, C_TEXT))
	var mv := VBoxContainer.new()
	mv.add_theme_constant_override("separation", 2)
	h.add_child(mv)
	var ml := _lbl("Карта пути", 12, C_TEXT)
	ml.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mv.add_child(ml)
	mv.add_child(_pic(String(d.get("route_pic", "")), Vector2(96, 78) if compact else Vector2(100, 100)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 10)
	v.add_child(row)
	var st := ULBase.route_state(id)
	if st == "":
		row.add_child(_lbl("Стоимость маршрута:", 14, C_TEXT, true))
		var pc := _card(C_PANEL)
		pc.add_child(_price_row(d.price, 15, 24.0))
		row.add_child(pc)
		var sp := Control.new()
		sp.size_flags_horizontal = SIZE_EXPAND_FILL
		row.add_child(sp)
	else:
		var nl := _lbl("Маршрут открыт: «%s» на глобальной карте — %s." % [String(d.n), String(d.get("where", "рядом с домашним стабом"))] if st == "bought" else "Вы сейчас на этой локации.", 12, C_GLOW, false, true)
		nl.name = "note"
		row.add_child(nl)
	var b: Button
	var bs := Vector2(214, 36) if compact else Vector2(230, 42)
	var bf := 15 if compact else 16
	match st:
		"bought":
			b = _btn("МАРШРУТ КУПЛЕН", "", "gray", func() -> void: pass, bs, bf)
			b.disabled = true
		"active":
			b = _btn("ИДЁТ ПОСЕЩЕНИЕ", "", "gray", func() -> void: pass, bs, bf)
			b.disabled = true
		_:
			b = _btn(String(d.get("btn", "КУПИТЬ МАРШРУТ")), "pin_btn", "green", ask_route.bind(id), bs, bf)
	b.name = "buy"
	row.add_child(b)
	return card


func ask_route(id: String) -> void:
	if busy or ULBase.route_state(id) != "":
		return
	var d: Dictionary = ULBase.shop().routes[id]
	var miss := ULEconomy.missing(inv.wallet, d.price)
	if not miss.is_empty():
		_dialog("Не хватает ресурсов", "Маршрут «%s» стоит %s.\nНе хватает: %s." % [String(d.n), ULEconomy.list_text(d.price), ULEconomy.list_text(miss)], Callable())
		return
	_dialog("Подтвердите покупку", "Купить маршрут «%s» за %s?\nМаршрут действует на одно посещение (%d минут на локации)." % [String(d.n), ULEconomy.list_text(d.price), int(d.get("minutes", 10))], _do_route.bind(id))


func _do_route(id: String) -> void:
	if busy:
		return
	busy = true
	var r := ULBase.buy_route(inv, id)
	if r.ok:
		w.pc_done("route", id)
		toast("Маршрут куплен — «%s» появился на глобальной карте." % String(ULBase.shop().routes[id].n))
	elif r.err == "money":
		toast("Не хватает: " + ULEconomy.list_text(r.miss))
	_build_routes()
	busy = false


# ---------------- снизу: обмен ресурсов ----------------

func _exchange_bar() -> Control:
	var p := _section("exchange")
	var root := p.get_child(0) as VBoxContainer
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 8)
	h.size_flags_vertical = SIZE_EXPAND_FILL
	root.add_child(h)
	var info := VBoxContainer.new()
	info.custom_minimum_size.x = 230
	info.size_flags_horizontal = SIZE_EXPAND_FILL
	info.size_flags_stretch_ratio = 1.2
	info.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_child(info)
	var ih := HBoxContainer.new()
	ih.add_theme_constant_override("separation", 8)
	info.add_child(ih)
	ih.add_child(_ico("swap", 32))
	ih.add_child(_lbl("Обмен ресурсов", 21, Color(0.95, 0.97, 0.95), true))
	info.add_child(_lbl("Обменяйте редкие ресурсы на более доступные или наоборот. Доступна покупка и продажа.", 12, C_TEXT, false, true))
	var ch := ULEconomy.chain()
	for i in ch.size() - 1:
		var hi := String(ch[i])
		var c := Button.new()
		c.flat = false
		c.focus_mode = FOCUS_NONE
		c.size_flags_horizontal = SIZE_EXPAND_FILL
		c.add_theme_stylebox_override("normal", _sb(C_CARD, C_LINE, 1, 6, 6))
		c.add_theme_stylebox_override("hover", _sb(C_CARD.lightened(0.05), C_GLOW, 1, 6, 6))
		c.add_theme_stylebox_override("pressed", _sb(C_CARD.lightened(0.1), C_GLOW, 2, 6, 6))
		c.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
		c.pressed.connect(open_exchange.bind("buy", hi))
		c.name = "pair_" + hi
		c.custom_minimum_size = Vector2(120, 84)
		h.add_child(c)
		var cv := VBoxContainer.new()
		cv.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
		cv.offset_left = 6
		cv.offset_right = -6
		cv.offset_top = 6
		cv.offset_bottom = -6
		cv.alignment = BoxContainer.ALIGNMENT_CENTER
		cv.mouse_filter = MOUSE_FILTER_IGNORE
		c.add_child(cv)
		var ic := HBoxContainer.new()
		ic.alignment = BoxContainer.ALIGNMENT_CENTER
		ic.add_theme_constant_override("separation", 6)
		ic.mouse_filter = MOUSE_FILTER_IGNORE
		cv.add_child(ic)
		ic.add_child(_ico(ULItems.icon(hi), 36))
		ic.add_child(_ico("arrow", 24))
		ic.add_child(_ico(ULItems.icon(ULEconomy.lower(hi)), 36))
		var rl := _lbl(_cap_rate(hi), 12, C_TEXT, false, true)
		rl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		cv.add_child(rl)
	var bv := VBoxContainer.new()
	bv.alignment = BoxContainer.ALIGNMENT_CENTER
	bv.add_theme_constant_override("separation", 8)
	h.add_child(bv)
	var bb := _btn("КУПИТЬ", "cart", "green", open_exchange.bind("buy", ""), Vector2(196, 42), 18)
	bb.name = "ExBuy"
	bv.add_child(bb)
	var sb := _btn("ПРОДАТЬ", "coins", "orange", open_exchange.bind("sell", ""), Vector2(196, 42), 18)
	sb.name = "ExSell"
	bv.add_child(sb)
	return p


## «1 Белая жемчужина = 3 Красные жемчужины»
func _cap_rate(hi: String) -> String:
	var a := ULEconomy.amount(hi, 1).split(" ", true, 1)
	var b := ULEconomy.amount(ULEconomy.lower(hi), ULEconomy.rate(hi)).split(" ", true, 1)
	return "%s %s = %s %s" % [a[0], a[1].left(1).to_upper() + a[1].substr(1), b[0], b[1].left(1).to_upper() + b[1].substr(1)]


# ---------------- окно обмена ----------------

## Окно «Обмен ресурсов» поверх компьютера (тот слегка затемнён). mode — buy/sell; hi — старший ресурс пары
## («» — оставить прежний выбор)
func open_exchange(mode: String, hi: String) -> void:
	if ex:
		ex_close()
	ex_mode = mode
	if hi != "":
		ex_hi = hi
	ex_n = 1
	_set_tab("exchange")
	ex = Control.new()
	ex.name = "Exchange"
	add_child(ex)
	ex.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.62)
	dim.mouse_filter = MOUSE_FILTER_STOP
	ex.add_child(dim)
	dim.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var cc := CenterContainer.new()
	ex.add_child(cc)
	cc.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var vs := get_viewport_rect().size
	var pn := PanelContainer.new()
	pn.custom_minimum_size = Vector2(minf(780.0, vs.x - 40.0), minf(600.0, vs.y - 24.0))
	pn.add_theme_stylebox_override("panel", _sb(Color(0.03, 0.07, 0.06, 0.99), C_GLOW, 2, 8, 14, 8.0))
	cc.add_child(pn)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	pn.add_child(v)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	v.add_child(head)
	head.add_child(_ico("swap", 32))
	var tl := _lbl("ОБМЕН РЕСУРСОВ", 23, Color(0.97, 0.97, 0.94), true)
	tl.size_flags_horizontal = SIZE_EXPAND_FILL
	head.add_child(tl)
	head.add_child(_btn("✕", "", "red", ex_close, Vector2(56, 48), 26))
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	v.add_child(tabs)
	_ex_tab_btn = {}
	for t in [["buy", "Купить", "cart"], ["sell", "Продать", "coins"]]:
		var b := _btn(String(t[1]), String(t[2]), "tab", ex_set_mode.bind(String(t[0])), Vector2(200, 46), 18)
		tabs.add_child(b)
		_ex_tab_btn[t[0]] = b
	var hint := _lbl("", 12, C_DIM, false, true)
	v.add_child(hint)
	_ex_lbl["hint"] = hint
	var grid := GridContainer.new()
	grid.columns = 6
	grid.add_theme_constant_override("h_separation", 6)
	grid.add_theme_constant_override("v_separation", 6)
	v.add_child(grid)
	_ex_give = {}
	_ex_get = {}
	for row in ["give", "get"]:
		var rl := _lbl("Отдаёте:" if row == "give" else "Получаете:", 15, C_TEXT, true)
		rl.custom_minimum_size.x = 110
		grid.add_child(rl)
		for id in ULItems.MONEY:
			var b := Button.new()
			b.text = String(RES_SHORT[id])
			b.icon = ULItems.icon(id)
			b.add_theme_constant_override("icon_max_width", 30)
			b.add_theme_font_size_override("font_size", 13)
			b.custom_minimum_size = Vector2(112, 46)
			b.size_flags_horizontal = SIZE_EXPAND_FILL
			b.focus_mode = FOCUS_NONE
			b.pressed.connect(ex_pick.bind(row, id))
			grid.add_child(b)
			if row == "give":
				_ex_give[id] = b
			else:
				_ex_get[id] = b
	var rate := _lbl("", 15, C_GOLD, true)
	v.add_child(rate)
	_ex_lbl["rate"] = rate
	var qh := HBoxContainer.new()
	qh.add_theme_constant_override("separation", 8)
	v.add_child(qh)
	_ex_qty_title = _lbl("", 15, C_TEXT, true)
	_ex_qty_title.custom_minimum_size.x = 170
	qh.add_child(_ex_qty_title)
	qh.add_child(_btn("−", "", "gray", ex_step.bind(-1), Vector2(56, 48), 26))
	_ex_edit = LineEdit.new()
	_ex_edit.custom_minimum_size = Vector2(120, 48)
	_ex_edit.alignment = HORIZONTAL_ALIGNMENT_CENTER
	_ex_edit.add_theme_font_size_override("font_size", 22)
	_ex_edit.virtual_keyboard_type = LineEdit.KEYBOARD_TYPE_NUMBER
	_ex_edit.max_length = 5
	_ex_edit.add_theme_stylebox_override("normal", _sb(Color(0.02, 0.04, 0.035), C_LINE, 1, 6, 6))
	_ex_edit.add_theme_stylebox_override("focus", _sb(Color(0.02, 0.04, 0.035), C_GLOW, 2, 6, 6))
	_ex_edit.text_changed.connect(_ex_typed)
	qh.add_child(_ex_edit)
	qh.add_child(_btn("+", "", "gray", ex_step.bind(1), Vector2(56, 48), 26))
	qh.add_child(_btn("МАКСИМУМ", "", "tab", ex_max, Vector2(140, 48), 15))
	var pv := _card(Color(0.02, 0.05, 0.045), C_LINE)
	v.add_child(pv)
	var pvv := VBoxContainer.new()
	pvv.add_theme_constant_override("separation", 2)
	pv.add_child(pvv)
	for k in ["a", "b"]:
		var l := _lbl("", 18, Color(0.97, 0.97, 0.94), true)
		pvv.add_child(l)
		_ex_lbl[k] = l
	var bal := _lbl("", 12, C_DIM, false, true)
	pvv.add_child(bal)
	_ex_lbl["bal"] = bal
	var warn := _lbl("", 14, C_RED, true, true)
	v.add_child(warn)
	_ex_lbl["warn"] = warn
	var oh := HBoxContainer.new()
	oh.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_child(oh)
	_ex_ok = _btn("ПОДТВЕРДИТЬ ОБМЕН", "swap", "green", ex_confirm, Vector2(340, 54), 19)
	oh.add_child(_ex_ok)
	_ex_refresh()
	ex.modulate.a = 0.0
	var tw := ex.create_tween()
	tw.tween_property(ex, "modulate:a", 1.0, 0.15)


func ex_close() -> void:
	if ex:
		ex.queue_free()
		ex = null


func ex_set_mode(mode: String) -> void:
	ex_mode = mode
	_ex_refresh()


## выбор ресурса: в ряду «Отдаёте» или «Получаете»; второй ресурс пары — сосед по цепочке
func ex_pick(row: String, id: String) -> void:
	var hi := ""
	if ex_mode == "buy":
		hi = ULEconomy.higher(id) if row == "give" else id
	else:
		hi = id if row == "give" else ULEconomy.higher(id)
	if ULEconomy.rate(hi) > 0:
		ex_hi = hi
	_ex_refresh()


func ex_set_n(n: int) -> void:
	ex_n = clampi(n, 0, ULEconomy.max_deal())
	_ex_refresh()


func ex_step(d: int) -> void:
	ex_set_n(maxi(ex_n + d, 1))


func ex_max() -> void:
	ex_set_n(maxi(ULEconomy.max_n(inv.wallet, ex_mode, ex_hi), 1))


func _ex_typed(t: String) -> void:
	var digits := ""
	for ch in t:
		if ch >= "0" and ch <= "9":
			digits += ch
	if digits != t:
		_ex_edit.text = digits
		_ex_edit.caret_column = digits.length()
	ex_n = clampi(int(digits) if digits != "" else 0, 0, ULEconomy.max_deal())
	_ex_refresh(false)


func _ex_refresh(set_edit := true) -> void:
	if ex == null:
		return
	for k in _ex_tab_btn:
		_style_btn(_ex_tab_btn[k], "tab_on" if k == ex_mode else "tab")
	var lo := ULEconomy.lower(ex_hi)
	var give := lo if ex_mode == "buy" else ex_hi
	var get_id := ex_hi if ex_mode == "buy" else lo
	for id in ULItems.MONEY:
		# в ряду «Отдаёте» при покупке — младшие ресурсы пар, при продаже — старшие; выбранный — подсвечен
		var g_ok := (ULEconomy.higher(id) != "") if ex_mode == "buy" else (ULEconomy.lower(id) != "")
		var r_ok := (ULEconomy.lower(id) != "") if ex_mode == "buy" else (ULEconomy.higher(id) != "")
		_res_btn(_ex_give[id], id == give, g_ok)
		_res_btn(_ex_get[id], id == get_id, r_ok)
	_ex_lbl.hint.text = "Купить: получить более ценный ресурс за соседний, менее ценный." if ex_mode == "buy" else "Продать: отдать ценный ресурс и получить соседний, менее ценный."
	_ex_lbl.rate.text = "Курс: " + ULEconomy.rate_text(ex_hi)
	_ex_qty_title.text = "Сколько получить:" if ex_mode == "buy" else "Сколько отдать:"
	if set_edit and _ex_edit.text != str(ex_n):
		_ex_edit.text = str(ex_n)
	var q := ULEconomy.quote(ex_mode, ex_hi, ex_n)
	var warn := ""
	if q.is_empty():
		_ex_lbl.a.text = "Укажите количество"
		_ex_lbl.b.text = ""
		warn = "Количество — целое число от 1 до %d." % ULEconomy.max_deal()
	else:
		if ex_mode == "buy":
			_ex_lbl.a.text = "Вы получите: " + ULEconomy.amount(String(q.get), int(q.get_n), true)
			_ex_lbl.b.text = "Стоимость: " + ULEconomy.amount(String(q.give), int(q.give_n))
		else:
			_ex_lbl.a.text = "Вы отдаёте: " + ULEconomy.amount(String(q.give), int(q.give_n), true)
			_ex_lbl.b.text = "Вы получите: " + ULEconomy.amount(String(q.get), int(q.get_n), true)
		var have := int(inv.wallet.get(String(q.give), 0))
		if have < int(q.give_n):
			warn = "Недостаточно: не хватает %s." % ULEconomy.amount(String(q.give), int(q.give_n) - have)
	var hg := int(inv.wallet.get(give, 0))
	var hr := int(inv.wallet.get(get_id, 0))
	if not q.is_empty() and warn == "":
		_ex_lbl.bal.text = "У вас: %s → останется %d;  %s → станет %d." % [ULEconomy.amount(give, hg), hg - int(q.give_n), ULEconomy.amount(get_id, hr), hr + int(q.get_n)]
	else:
		_ex_lbl.bal.text = "У вас: %s, %s." % [ULEconomy.amount(give, hg), ULEconomy.amount(get_id, hr)]
	_ex_lbl.warn.text = warn
	_ex_ok.disabled = warn != "" or busy or _ex_cool > 0.0
	_style_btn(_ex_ok, "green" if not _ex_ok.disabled else "gray")


func _res_btn(b: Button, on: bool, ok: bool) -> void:
	b.disabled = not ok
	var bg := Color(0.17, 0.2, 0.06) if on else Color(0.04, 0.08, 0.07)
	var bc := Color(0.95, 0.85, 0.3) if on else C_LINE
	for st in ["normal", "hover", "pressed", "disabled"]:
		b.add_theme_stylebox_override(st, _sb(bg, bc, 2 if on else 1, 6, 6, 4.0 if on else 0.0))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.modulate.a = 1.0 if ok else 0.32
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color"]:
		b.add_theme_color_override(k, Color(1, 0.97, 0.85) if on else C_TEXT)


## «Подтвердить обмен»: сделка проводится один раз — пока она идёт и пока окно не обновилось, повторные
## нажатия не проходят (кнопка выключена, busy). Ресурсы меняются целиком или никак (ULEconomy.exchange).
func ex_confirm() -> bool:
	if busy or ex == null or _ex_ok.disabled or _ex_cool > 0.0:
		return false
	busy = true
	_ex_ok.disabled = true
	_ex_cool = 0.45
	var q := ULEconomy.quote(ex_mode, ex_hi, ex_n)
	var ok := ULEconomy.exchange(inv, ex_mode, ex_hi, ex_n)
	if ok:
		w.pc_done("exchange", ex_hi)
		toast("Обмен выполнен: %s → %s" % [ULEconomy.amount(String(q.give), int(q.give_n), true), ULEconomy.amount(String(q.get), int(q.get_n), true)])
	else:
		toast("Обмен не выполнен: не хватает ресурса")
	busy = false
	_ex_refresh()
	return ok


# ---------------- подтверждение и сообщения ----------------

## окно поверх: заголовок, текст; ok пустой — только «Понятно», иначе «Отмена» и «Подтвердить»
func _dialog(title: String, text: String, ok: Callable) -> void:
	if _dlg:
		_dlg.queue_free()
	_dlg_ok = ok
	_dlg = Control.new()
	_dlg.name = "Dialog"
	add_child(_dlg)
	_dlg.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.6)
	_dlg.add_child(dim)
	dim.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var cc := CenterContainer.new()
	_dlg.add_child(cc)
	cc.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.custom_minimum_size = Vector2(560, 0)
	pn.add_theme_stylebox_override("panel", _sb(Color(0.03, 0.07, 0.06, 0.99), C_RED if not ok.is_valid() else C_GLOW, 2, 8, 18, 8.0))
	cc.add_child(pn)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 12)
	pn.add_child(v)
	v.add_child(_lbl(title, 22, C_RED if not ok.is_valid() else Color(0.97, 0.97, 0.94), true))
	v.add_child(_lbl(text, 16, C_TEXT, false, true))
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_END
	h.add_theme_constant_override("separation", 12)
	v.add_child(h)
	if ok.is_valid():
		h.add_child(_btn("ОТМЕНА", "", "gray", dialog_close, Vector2(160, 50), 17))
		var yes := _btn("ПОДТВЕРДИТЬ", "", "green", dialog_confirm, Vector2(200, 50), 17)
		yes.name = "Yes"
		h.add_child(yes)
	else:
		h.add_child(_btn("ПОНЯТНО", "", "gray", dialog_close, Vector2(180, 50), 17))
	_dlg.modulate.a = 0.0
	_dlg.create_tween().tween_property(_dlg, "modulate:a", 1.0, 0.12)


func dialog_text() -> String:
	if _dlg == null:
		return ""
	var t := ""
	for l in _dlg.find_children("*", "Label", true, false):
		t += (l as Label).text + "\n"
	return t


func dialog_close() -> void:
	if _dlg:
		_dlg.queue_free()
		_dlg = null
	_dlg_ok = Callable()


## «Подтвердить»: окно закрывается до покупки — второе нажатие уже некуда сделать
func dialog_confirm() -> void:
	var cb := _dlg_ok
	dialog_close()
	if cb.is_valid():
		cb.call()


func toast(t: String) -> void:
	_toast_lbl.text = t
	_toast.visible = true
	_toast.reset_size()
	var vs := get_viewport_rect().size
	_toast.position = Vector2((vs.x - _toast.size.x) * 0.5, 10)
	_toast.modulate.a = 1.0
	if _toast_tw:
		_toast_tw.kill()
	_toast_tw = create_tween()
	_toast_tw.tween_interval(2.6)
	_toast_tw.tween_property(_toast, "modulate:a", 0.0, 0.4)
	_toast_tw.tween_callback(func() -> void: _toast.visible = false)
	move_child(_toast, get_child_count() - 1)
