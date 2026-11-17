class_name ULInventoryUI
extends Control
## Экран инвентаря — отдельное меню на весь экран (по образцу пользователя).
## «ИНВЕНТАРЬ»: слева — колонка слотов одежды (шлем, жилет, куртка, штаны, обувь), герой в полный рост (3D,
## с оружием в руках и рюкзаком), рядом слоты «Основное / Пистолет, нож / Рюкзак», под героем — здоровье,
## энергия, вода; справа — карманы (8 ячеек) и надетый рюкзак (+8 / +12 / +20).
## «ХРАНИЛИЩЕ»: слева — картинка хранилища, название и вместимость, его содержимое; затем слоты героя и его
## карманы с рюкзаком — вещи перекладываются в обе стороны.
## Внизу — карточка выбранного предмета: значок, название, описание, действия. Нажатие выбирает предмет,
## повторное нажатие — быстрое действие (в хранилище — переложить, иначе — экипировать / использовать).

signal closed
signal changed                    ## снаряжение или содержимое поменялось (обновить героя, сохранить)
signal drop(item: Dictionary)     ## выбросить предмет на землю
signal wear_ground_pack           ## надеть открытый рюкзак с земли
signal use(id: String)            ## использовать расходник (лечение, еда, вода)

const C_BG := Color(0.035, 0.055, 0.085, 1.0)        # отдельное меню: игра за ним не видна
const C_PANEL := Color(0.06, 0.09, 0.13, 1.0)
const C_CELL := Color(0.09, 0.125, 0.17, 1.0)
const C_EMPTY := Color(0.065, 0.095, 0.135, 1.0)
const C_LINE := Color(0.24, 0.36, 0.48, 0.9)
const C_SEL := Color(1.0, 0.78, 0.3)
const C_TEXT := Color(0.9, 0.94, 0.98)
const C_DIM := Color(0.58, 0.67, 0.76)
const ICONS := "res://assets/icons/"
const SLOT_NAMES := {"primary": "Основное", "pistol": "Пистолет / нож", "pack": "Рюкзак"}
const CLOTHES := [["helmet", "Шлем"], ["vest", "Жилет"], ["jacket", "Куртка"], ["pants", "Штаны"], ["boots", "Обувь"]]

var inv: ULInventory
var cont = null                   ## открытое хранилище: массив ячеек или null
var cont_title := ""
var cont_icon := "crate"          ## значок хранилища (assets/icons)
var cont_is_pack := false         ## хранилище — рюкзак на земле (можно надеть)
var preview_tex: Texture2D = null
var preview_rot := Callable()     ## повернуть героя на превью: f(dx)
var stats := {"hp": 100, "en": 100, "water": 100}
var cell := 84.0

var _sel_src := ""
var _sel_i := -1
var _cols: HBoxContainer
var _card: HBoxContainer
var _title: Label
var _title_ic: TextureRect
var _cap: Label
var _toast: Label
var _toast_t := 0.0


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = C_BG
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var root := VBoxContainer.new()
	add_child(root)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 14
	root.offset_right = -14
	root.offset_top = 8
	root.offset_bottom = -8
	root.add_theme_constant_override("separation", 8)
	# шапка
	var head := PanelContainer.new()
	head.add_theme_stylebox_override("panel", _box(C_PANEL))
	root.add_child(head)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 12)
	head.add_child(top)
	_title_ic = _icon("ui/bag", 44)
	top.add_child(_title_ic)
	_title = _lbl("ИНВЕНТАРЬ", 26, C_TEXT)
	top.add_child(_title)
	_cap = _lbl("", 17, C_DIM)
	_cap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	top.add_child(_cap)
	top.add_child(_button("✕  Закрыть", func(): closed.emit(), 150, 48))
	# середина
	_cols = HBoxContainer.new()
	_cols.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_cols.add_theme_constant_override("separation", 10)
	root.add_child(_cols)
	# карточка выбранного предмета
	var bot := PanelContainer.new()
	bot.add_theme_stylebox_override("panel", _box(C_PANEL))
	bot.custom_minimum_size = Vector2(0, 86)
	root.add_child(bot)
	_card = HBoxContainer.new()
	_card.add_theme_constant_override("separation", 12)
	bot.add_child(_card)
	_toast = _lbl("", 20, C_SEL)
	add_child(_toast)
	_toast.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_toast.offset_top = 70
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.add_theme_color_override("font_outline_color", Color.BLACK)
	_toast.add_theme_constant_override("outline_size", 6)


func _process(delta: float) -> void:
	if _toast_t > 0.0:
		_toast_t -= delta
		_toast.modulate.a = clampf(_toast_t, 0.0, 1.0)


func open(inventory: ULInventory, container = null, title := "", is_pack := false, icon := "crate") -> void:
	inv = inventory
	cont = container
	cont_title = title
	cont_is_pack = is_pack
	cont_icon = icon
	_sel_src = ""
	_sel_i = -1
	visible = true
	refresh()


func say(t: String) -> void:
	_toast.text = t
	_toast_t = 2.2
	_toast.modulate.a = 1.0


# ---------------- построение ----------------

## открыто тело врага (обыск), а не ящик
func _is_body() -> bool:
	return cont_icon.begins_with("enemy_")


func refresh() -> void:
	for box in [_cols, _card]:
		for c in box.get_children():
			c.queue_free()
	var total := inv.slot_count()
	_title.text = "ИНВЕНТАРЬ" if cont == null else (("ОБЫСК (%s)" if _is_body() else "ХРАНИЛИЩЕ (%s)") % cont_title.to_upper())
	_title_ic.texture = load(ICONS + ("ui/bag" if cont == null else "hud_box") + ".png")
	_cap.text = "Занято: %d из %d ячеек (%d%%)" % [inv.used(), total, int(round(100.0 * inv.used() / maxf(total, 1)))]
	if cont == null:
		_build_inventory()
	else:
		_build_storage()
	_update_card()


## «Инвентарь»: одежда | герой | слоты | карманы и рюкзак
func _build_inventory() -> void:
	var left_w := 74.0 + 230.0 + 132.0 + 20.0
	var free_w := size.x - 28.0 - left_w - 10.0 - 44.0
	cell = clampf((free_w - 7.0 * 6.0) / 8.0, 54.0, 100.0)
	var gear := _panel()
	_cols.add_child(gear)
	var gh := HBoxContainer.new()
	gh.add_theme_constant_override("separation", 8)
	gear.add_child(gh)
	# слоты одежды
	var cl := VBoxContainer.new()
	cl.add_theme_constant_override("separation", 6)
	cl.alignment = BoxContainer.ALIGNMENT_CENTER
	gh.add_child(cl)
	for c in CLOTHES:
		cl.add_child(_clothes_slot(c[0], c[1]))
	# герой и показатели
	var hv := VBoxContainer.new()
	hv.custom_minimum_size.x = 230
	gh.add_child(hv)
	var pv := TextureRect.new()
	pv.texture = preview_tex
	pv.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pv.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	pv.size_flags_vertical = Control.SIZE_EXPAND_FILL
	pv.mouse_filter = Control.MOUSE_FILTER_STOP
	pv.gui_input.connect(_preview_input)
	hv.add_child(pv)
	var st := HBoxContainer.new()
	st.alignment = BoxContainer.ALIGNMENT_CENTER
	st.add_theme_constant_override("separation", 10)
	hv.add_child(st)
	for s in [["stat_hp", "hp", Color(0.95, 0.35, 0.35)], ["stat_en", "en", Color(1.0, 0.85, 0.35)], ["stat_water", "water", Color(0.45, 0.75, 1.0)]]:
		var ic := _icon(s[0], 20)
		ic.modulate = s[2]
		st.add_child(ic)
		st.add_child(_lbl("%d/100" % int(round(float(stats.get(s[1], 100)))), 14, C_TEXT))
	hv.add_child(_wallet_box())
	# слоты оружия и рюкзака
	gh.add_child(_slots_column())
	# карманы и рюкзак
	var bag := _panel()
	bag.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cols.add_child(bag)
	bag.add_child(_bag_scroll(8))


## «Хранилище»: картинка и вместимость | содержимое | слоты героя | карманы и рюкзак
func _build_storage() -> void:
	var cont_cols := 4
	var bag_cols := 4
	var fixed := 28.0 + 150.0 + 132.0 + 30.0 + 3.0 * 20.0 + 24.0
	cell = clampf((size.x - fixed - (cont_cols + bag_cols - 2) * 6.0) / (cont_cols + bag_cols), 54.0, 96.0)
	var p := _panel()
	p.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cols.add_child(p)
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	p.add_child(h)
	# картинка хранилища
	var iv := VBoxContainer.new()
	iv.custom_minimum_size.x = 150
	iv.add_theme_constant_override("separation", 4)
	h.add_child(iv)
	var pic := TextureRect.new()
	pic.texture = load(ICONS + cont_icon + ".png") if ResourceLoader.exists(ICONS + cont_icon + ".png") else null
	pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	pic.custom_minimum_size = Vector2(150, 150)
	iv.add_child(pic)
	iv.add_child(_lbl(cont_title, 19, C_TEXT))
	if _is_body():
		iv.add_child(_lbl("Тело. Найдено\nпредметов: %d" % _count(cont), 15, C_DIM))
	else:
		iv.add_child(_lbl("Вместимость:\n%d ячеек" % cont.size(), 15, C_DIM))
		iv.add_child(_lbl("Занято: %d" % _count(cont), 15, C_DIM))
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	iv.add_child(sp)
	iv.add_child(_button("Взять всё", _take_all, 150, 48))
	if cont_is_pack:
		iv.add_child(_button("Надеть", func(): wear_ground_pack.emit(), 150, 48))
	# содержимое
	var cv := VBoxContainer.new()
	cv.add_theme_constant_override("separation", 6)
	h.add_child(cv)
	cv.add_child(_lbl("Добыча" if _is_body() else "Содержимое (%d ячеек)" % cont.size(), 16, C_DIM))
	var csc := ScrollContainer.new()
	csc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	csc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	csc.custom_minimum_size.x = cont_cols * cell + (cont_cols - 1) * 6.0 + 10.0
	cv.add_child(csc)
	csc.add_child(_grid("cont", cont, cont_cols))
	h.add_child(VSeparator.new())
	h.add_child(_slots_column())
	var bv := _bag_scroll(bag_cols)
	bv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	h.add_child(bv)


func _slots_column() -> VBoxContainer:
	var slots := VBoxContainer.new()
	slots.add_theme_constant_override("separation", 4)
	slots.alignment = BoxContainer.ALIGNMENT_CENTER
	for s in ["primary", "pistol", "pack"]:
		slots.add_child(_lbl(SLOT_NAMES[s], 14, C_SEL if inv.hand == s else C_DIM))
		slots.add_child(_cell("eq:" + s, 0, inv.get(s), Vector2(132, 96)))
	var hand := "ничего"
	if inv.hand != "" and inv.get(inv.hand) != null:
		hand = ULItems.get_def(String(inv.get(inv.hand).id)).n
	var hl := _lbl("В руках: " + hand, 13, C_SEL)
	hl.custom_minimum_size.x = 132
	hl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	slots.add_child(hl)
	return slots


func _bag_scroll(cols: int) -> ScrollContainer:
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var bv := VBoxContainer.new()
	bv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	bv.add_theme_constant_override("separation", 6)
	sc.add_child(bv)
	bv.add_child(_lbl("Карманы (%d ячеек)" % ULInventory.POCKETS, 16, C_DIM))
	bv.add_child(_grid("pockets", inv.pockets, cols))
	if inv.pack != null:
		bv.add_child(_lbl("%s (%d ячеек)" % [ULItems.get_def(String(inv.pack.id)).n, ULItems.pack_slots(inv.pack)], 16, C_DIM))
		bv.add_child(_grid("pack", inv.pack.items, cols))
	else:
		var nl := _lbl("Рюкзака нет. Наденьте рюкзак — будет больше ячеек: малый +8, средний +12, большой +20.", 15, C_DIM)
		nl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		nl.custom_minimum_size = Vector2(200, 0)
		bv.add_child(nl)
	if cont != null:
		bv.add_child(_wallet_box())        # в окне хранилища и обыска ресурсы видны тут же
	return sc


## окошко «Ресурсы»: спораны, горошины и жемчужины — сколько накоплено. Это валюта: копится при сборе,
## тратится при покупке; ячеек не занимает
func _wallet_box() -> Control:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(C_EMPTY))
	p.size_flags_horizontal = Control.SIZE_SHRINK_BEGIN
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	p.add_child(v)
	v.add_child(_lbl("Ресурсы", 13, C_DIM))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 4)
	v.add_child(h)
	for id in ULItems.MONEY:
		var n := int(inv.wallet.get(id, 0))
		var c := VBoxContainer.new()
		c.custom_minimum_size.x = 40
		c.add_theme_constant_override("separation", 0)
		c.mouse_filter = Control.MOUSE_FILTER_STOP
		var nm := String(ULItems.get_def(id).n)
		c.gui_input.connect(func(e: InputEvent) -> void:
			if (e is InputEventScreenTouch or e is InputEventMouseButton) and e.pressed:
				say("%s: %d" % [nm, n]))
		var ic := _icon(String(ULItems.get_def(id).icon), 30)
		ic.modulate.a = 1.0 if n > 0 else 0.35
		c.add_child(ic)
		var l := _lbl(str(n), 14, C_TEXT if n > 0 else C_DIM)
		l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		c.add_child(l)
		h.add_child(c)
	return p


func _count(arr: Array) -> int:
	var n := 0
	for c in arr:
		if c != null:
			n += 1
	return n


func _panel() -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _box(C_PANEL))
	return p


func _icon(name: String, sz: float) -> TextureRect:
	var t := TextureRect.new()
	t.texture = load(ICONS + name + ".png") if ResourceLoader.exists(ICONS + name + ".png") else null
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(sz, sz)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


## слот одежды: пока пустой (одежды в игре ещё нет) — значок-силуэт
func _clothes_slot(glyph: String, title: String) -> Control:
	var p := PanelContainer.new()
	var st := _box(C_EMPTY)
	st.content_margin_left = 6
	st.content_margin_right = 6
	st.content_margin_top = 6
	st.content_margin_bottom = 6
	p.add_theme_stylebox_override("panel", st)
	p.custom_minimum_size = Vector2(62, 62)
	p.tooltip_text = title
	var ic := _icon("slot_" + glyph, 46)
	ic.modulate = Color(1, 1, 1, 0.22)
	p.add_child(ic)
	return p


func _grid(src: String, arr: Array, cols: int) -> GridContainer:
	var g := GridContainer.new()
	g.columns = cols
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	for i in arr.size():
		g.add_child(_cell(src, i, arr[i], Vector2(cell, cell)))
	return g


func _cell(src: String, i: int, it, sz: Vector2) -> Control:
	var b := Button.new()
	b.custom_minimum_size = sz
	b.focus_mode = Control.FOCUS_NONE
	var sel := src == _sel_src and i == _sel_i
	var st := _box(C_CELL if it != null else C_EMPTY, C_SEL if sel else C_LINE, 3 if sel else 1)
	st.content_margin_left = 0
	st.content_margin_right = 0
	b.add_theme_stylebox_override("normal", st)
	b.add_theme_stylebox_override("hover", st)
	b.add_theme_stylebox_override("pressed", _box(Color(0.14, 0.2, 0.27), C_SEL, 2))
	if it != null:
		var id := String(it.id)
		var tr := TextureRect.new()
		tr.texture = ULItems.icon(id)
		tr.modulate = ULItems.tint(id)
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		b.add_child(tr)
		tr.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 5)
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var tag := ""
		if int(it.get("n", 1)) > 1:
			tag = str(it.n)
		elif it.has("mag"):
			tag = "%d/%d" % [int(it.mag), int(ULItems.get_def(id).mag)]
		if tag != "":
			var n := _lbl(tag, 15, C_TEXT)
			b.add_child(n)
			n.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
			n.offset_right = -5
			n.offset_top = -28 if it.has("dur") else -22
			n.offset_bottom = -6 if it.has("dur") else 0
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			n.mouse_filter = Control.MOUSE_FILTER_IGNORE
			n.add_theme_color_override("font_outline_color", Color.BLACK)
			n.add_theme_constant_override("outline_size", 5)
		if it.has("dur"):
			# прочность оружия: полоска по низу ячейки (зелёная → жёлтая → красная)
			var mx := maxf(float(ULItems.get_def(id).get("dur", 1)), 1.0)
			var k := clampf(float(it.dur) / mx, 0.0, 1.0)
			var back := ColorRect.new()
			back.color = Color(0, 0, 0, 0.55)
			back.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(back)
			back.set_anchors_and_offsets_preset(Control.PRESET_BOTTOM_WIDE)
			back.offset_left = 5
			back.offset_right = -5
			back.offset_top = -7
			back.offset_bottom = -3
			var bar := ColorRect.new()
			bar.color = Color(0.4, 0.85, 0.4) if k > 0.5 else (Color(0.95, 0.8, 0.3) if k > 0.2 else Color(0.95, 0.35, 0.3))
			bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
			back.add_child(bar)
			bar.anchor_right = k
			bar.anchor_bottom = 1.0
			if ULItems.broken(it):
				# сломано: красная надпись поверх значка (чинит оружейник)
				var br := _lbl("СЛОМАНО", 12, Color(1.0, 0.35, 0.3))
				b.add_child(br)
				br.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
				br.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
				br.add_theme_color_override("font_outline_color", Color.BLACK)
				br.add_theme_constant_override("outline_size", 6)
				br.mouse_filter = Control.MOUSE_FILTER_IGNORE
		if ULItems.kind(it) == "pack" and not ULItems.pack_empty(it):
			var dot := _lbl("с вещами", 11, C_SEL)
			dot.position = Vector2(5, 2)
			dot.mouse_filter = Control.MOUSE_FILTER_IGNORE
			b.add_child(dot)
	b.pressed.connect(_press.bind(src, i))
	return b


# ---------------- выбор и действия ----------------

func _press(src: String, i: int) -> void:
	if src == _sel_src and i == _sel_i:
		if _sel_item() != null:
			_quick()                    # повторное нажатие — быстрое действие
			return
		_sel_src = ""
		_sel_i = -1
	else:
		_sel_src = src
		_sel_i = i
	refresh()


func _sel_item():
	if _sel_src == "":
		return null
	if _sel_src.begins_with("eq:"):
		return inv.get(_sel_src.substr(3))
	var arr := _arr(_sel_src)
	return arr[_sel_i] if _sel_i >= 0 and _sel_i < arr.size() else null


func _arr(src: String) -> Array:
	if src == "cont":
		return cont if cont != null else []
	return inv.cells(src)


## быстрое действие для выбранного предмета
func _quick() -> void:
	var it = _sel_item()
	var k := ULItems.kind(it)
	if _sel_src.begins_with("eq:"):
		var slot := _sel_src.substr(3)
		if cont != null:
			_act_slot_to_cont(slot)
		elif slot != "pack":
			_act_hand(slot)
		return
	if _sel_src == "cont":
		_act_take()
	elif cont != null:
		_act_to_cont()
	elif ULItems.slot_of(it) != "":
		_act_equip()
	elif k in ["med", "food"]:
		_act_use()


func _update_card() -> void:
	var it = _sel_item()
	if it == null:
		var hint := _lbl("Нажмите на предмет, чтобы выбрать. Повторное нажатие — быстрое действие: " + ("переложить." if cont != null else "экипировать или использовать."), 16, C_DIM)
		hint.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hint.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		hint.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
		_card.add_child(hint)
		return
	var id := String(it.id)
	var d := ULItems.get_def(id)
	var ic := TextureRect.new()
	ic.texture = ULItems.icon(id)
	ic.modulate = ULItems.tint(id)
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.custom_minimum_size = Vector2(70, 70)
	_card.add_child(ic)
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	tv.alignment = BoxContainer.ALIGNMENT_CENTER
	_card.add_child(tv)
	var name := ULItems.title(it)
	if it.has("mag"):
		name += " · в магазине %d из %d" % [int(it.mag), int(d.mag)]
	if it.has("dur"):
		name += " · " + ULItems.dur_text(it)
	tv.add_child(_lbl(name, 19, C_TEXT))
	var ds := _lbl(String(d.get("d", "")), 14, C_DIM)
	ds.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	tv.add_child(ds)
	var k := ULItems.kind(it)
	var slot_k := ULItems.slot_of(it)
	var acts := []                 # [подпись, действие]
	if _sel_src.begins_with("eq:"):
		var slot := _sel_src.substr(3)
		if slot != "pack":
			acts.append(["Убрать из рук" if inv.hand == slot else "В руки", _act_hand.bind(slot)])
		acts.append(["Снять", _act_unequip.bind(slot)])
		if cont != null:
			acts.append(["В хранилище", _act_slot_to_cont.bind(slot)])
	elif _sel_src == "cont":
		acts.append(["Взять", _act_take])
		if slot_k in ["pistol", "primary"]:
			acts.append(["Экипировать", _act_equip])
	else:
		if slot_k in ["pistol", "primary"]:
			acts.append(["Экипировать", _act_equip])
		if slot_k == "pack":
			acts.append(["Надеть", _act_equip])
		if k in ["med", "food"]:
			acts.append(["Использовать", _act_use])
		if cont != null:
			acts.append(["В хранилище", _act_to_cont])
	acts.append(["Выбросить", _act_drop])
	for a in acts:
		_card.add_child(_button(a[0], a[1], 136))


func _done(msg := "") -> void:
	if msg != "":
		say(msg)
	_sel_src = ""
	_sel_i = -1
	changed.emit()
	refresh()


func _act_hand(slot: String) -> void:
	inv.hand = "" if inv.hand == slot else slot
	changed.emit()
	refresh()


func _act_unequip(slot: String) -> void:
	if inv.unequip(slot):
		_done()
	elif slot == "pack" and not ULItems.pack_empty(inv.pack):
		say("В рюкзаке есть вещи — его можно только выбросить на землю")
	else:
		say("Нет места")


func _act_slot_to_cont(slot: String) -> void:
	var it = inv.get(slot)
	if slot == "pack" and not ULItems.pack_empty(it):
		say("Рюкзак с вещами в хранилище не положить")
		return
	if ULInventory.put(cont, it) > 0:
		say("В хранилище нет места")
		return
	inv.clear_slot(slot)
	_done()


func _act_equip() -> void:
	var arr := _arr(_sel_src)
	var it = arr[_sel_i]
	var sl := ULItems.slot_of(it)
	if not inv.equip_from(arr, _sel_i):
		say("Вещи из надетого рюкзака не помещаются в этот" if sl == "pack" else "Нельзя")
		return
	if sl in ["pistol", "primary"] and inv.hand == "":
		inv.hand = sl
	_done()


func _act_use() -> void:
	var it = _sel_item()
	if it != null:
		use.emit(String(it.id))
	changed.emit()
	if _sel_item() == null:
		_sel_src = ""
		_sel_i = -1
	refresh()


func _act_to_cont() -> void:
	var arr := _arr(_sel_src)
	var it = arr[_sel_i]
	if ULItems.kind(it) == "pack" and cont_is_pack:
		say("Рюкзак в рюкзак не положить")
		return
	var left := ULInventory.put(cont, it)
	if left == int(it.n):
		say("В хранилище нет места")
		return
	if left > 0:
		it.n = left
		_done("Поместилось не всё")
		return
	arr[_sel_i] = null
	_done()


func _act_take() -> void:
	var it = cont[_sel_i]
	if ULItems.kind(it) == "pack" and not ULItems.pack_empty(it):
		say("Рюкзак с вещами — выложите вещи или наденьте его")
		return
	var n0 := int(it.n)
	var left := inv.add(it)
	if left == n0:
		say("Нет места")
		return
	if left == 0:
		cont[_sel_i] = null
	_done("" if left == 0 else "Взято не всё — нет места")


func _take_all() -> void:
	var moved := 0
	var stuck := 0
	for i in cont.size():
		var it = cont[i]
		if it == null:
			continue
		if ULItems.kind(it) == "pack" and not ULItems.pack_empty(it):
			stuck += 1
			continue
		var n0 := int(it.n)
		var left := inv.add(it)
		if left == 0:
			cont[i] = null
			moved += 1
		else:
			stuck += 1
			if left < n0:
				moved += 1
	if moved + stuck == 0:
		_done("Хранилище пусто")
	else:
		_done("Взято: %d" % moved + (", не поместилось: %d" % stuck if stuck > 0 else ""))


func _act_drop() -> void:
	var it
	if _sel_src.begins_with("eq:"):
		it = inv.clear_slot(_sel_src.substr(3))
	else:
		var arr := _arr(_sel_src)
		it = arr[_sel_i]
		arr[_sel_i] = null
	if it != null:
		drop.emit(it)
	_done()


func _preview_input(e: InputEvent) -> void:
	if (e is InputEventScreenDrag or e is InputEventMouseMotion) and preview_rot.is_valid():
		var rel: Vector2 = e.relative
		if e is InputEventMouseMotion and not (e as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT:
			return
		preview_rot.call(rel.x)


# ---------------- оформление ----------------

func _box(bg: Color, border := C_LINE, w := 1) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(w)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 8
	sb.content_margin_bottom = 8
	return sb


func _lbl(t: String, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	return l


func _button(t: String, cb: Callable, w := 130.0, h := 56.0) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(w, h)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 16)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_stylebox_override("normal", _box(Color(0.09, 0.14, 0.2)))
	b.add_theme_stylebox_override("hover", _box(Color(0.11, 0.18, 0.25)))
	b.add_theme_stylebox_override("pressed", _box(Color(0.14, 0.3, 0.42), C_SEL, 2))
	b.pressed.connect(cb)
	return b
