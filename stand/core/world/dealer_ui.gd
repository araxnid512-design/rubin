class_name ULDealerUI
extends Control
## Окно торговли барахольщика (во весь экран, альбомная ориентация): сверху — кто он, пять ресурсов, «Закрыть»;
## вкладки «Продать» / «Купить» и фильтр по категориям; слева — витрина карточек (значок, название, сколько, цена),
## справа — выбранный предмет: описание, категория и редкость, масса, цена за штуку, количество (−, +, «Всё»),
## итог сделки и остаток ресурсов после неё, большая кнопка «Продать» / «Купить». Снизу — «Продать весь хлам».
## Витрина тянется пальцем. Правила сделки — ULDealer; здесь только показ и нажатия.

signal closed

const C_PANEL := Color(0.03, 0.065, 0.058, 0.97)
const C_CARD := Color(0.045, 0.095, 0.083)
const C_SEL := Color(0.12, 0.17, 0.07)
const C_LINE := Color(0.19, 0.4, 0.31)
const C_GOLD := Color(1.0, 0.82, 0.32)
const C_TEXT := Color(0.87, 0.91, 0.87)
const C_DIM := Color(0.6, 0.66, 0.62)
const C_RED := Color(0.97, 0.4, 0.33)
const C_GREEN := Color(0.55, 0.95, 0.4)
const RAR_COL := {"common": Color(0.75, 0.78, 0.76), "uncommon": Color(0.45, 0.8, 1.0), "rare": Color(1.0, 0.72, 0.25)}
const SELL_CATS := [["", "Все"], ["tech", "Хлам"], ["mineral", "Минералы"], ["parts", "Запчасти"], ["tool", "Инструменты"]]
const DRAG := 12.0

var inv: ULInventory
var on_change := Callable()        ## после сделки: сохранить, обновить снаряжение (world.gd)
var dealer_name := "Кузьмич"
var tab := "sell"
var cat := ""
var sel_id := ""
var sel_kind := "stock"            ## на вкладке «Купить»: свой товар или выкуп
var qty := 1
var _bold: FontVariation
var _wallet := {}
var _grid: GridContainer
var _scroll: ScrollContainer
var _card: VBoxContainer
var _tabs := {}
var _cats: HBoxContainer
var _junk_btn: Button
var _say: Label
var _cool := 0.0                   ## после сделки кнопка на мгновение выключена — двойное касание не спишет дважды
var _press_at := Vector2.ZERO
var _dragged := false


func setup(inventory: ULInventory, change_cb: Callable) -> void:
	inv = inventory
	on_change = change_cb
	_bold = FontVariation.new()
	_bold.base_font = ThemeDB.fallback_font
	_bold.variation_embolden = 0.6
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_STOP
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	shade.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	add_child(shade)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", _sb(C_PANEL, Color(0.55, 0.45, 0.22), 2, 10, 14))
	pn.set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	pn.offset_left = 14
	pn.offset_top = 12
	pn.offset_right = -14
	pn.offset_bottom = -12
	add_child(pn)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 10)
	pn.add_child(v)
	# шапка
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 12)
	v.add_child(h)
	var face := TextureRect.new()
	face.texture = load("res://assets/icons/junk.png")
	face.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	face.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	face.custom_minimum_size = Vector2(54, 54)
	h.add_child(face)
	var tv := VBoxContainer.new()
	tv.add_theme_constant_override("separation", 0)
	tv.size_flags_horizontal = SIZE_EXPAND_FILL
	h.add_child(tv)
	tv.add_child(_lbl("%s — барахольщик" % dealer_name, 24, C_GOLD, true))
	var sub := _lbl("Скупает хлам, минералы, запчасти и инструменты. Продаёт припасы, б/у снаряжение и сданное вами.", 14, C_DIM)
	sub.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	sub.custom_minimum_size = Vector2(240, 0)
	tv.add_child(sub)
	for id in ULItems.MONEY:
		var chip := PanelContainer.new()
		chip.add_theme_stylebox_override("panel", _sb(C_CARD, C_LINE, 1, 6, 6))
		var ch := HBoxContainer.new()
		ch.add_theme_constant_override("separation", 4)
		chip.add_child(ch)
		ch.add_child(_icon(ULItems.icon(id), 28))
		var nl := _lbl("0", 18, C_GOLD, true)
		ch.add_child(nl)
		_wallet[id] = nl
		h.add_child(chip)
	h.add_child(_btn("✕", "red", close, Vector2(56, 50), 22))
	# вкладки и категории
	var th := HBoxContainer.new()
	th.add_theme_constant_override("separation", 8)
	v.add_child(th)
	for t in [["sell", "ПРОДАТЬ"], ["buy", "КУПИТЬ"]]:
		var b := _btn(t[1], "tab", set_tab.bind(t[0]), Vector2(170, 46), 19)
		_tabs[t[0]] = b
		th.add_child(b)
	_cats = HBoxContainer.new()
	_cats.add_theme_constant_override("separation", 6)
	_cats.size_flags_horizontal = SIZE_EXPAND_FILL
	_cats.alignment = BoxContainer.ALIGNMENT_END
	th.add_child(_cats)
	# витрина и карточка
	var body := HBoxContainer.new()
	body.add_theme_constant_override("separation", 12)
	body.size_flags_vertical = SIZE_EXPAND_FILL
	v.add_child(body)
	_scroll = ScrollContainer.new()
	_scroll.size_flags_horizontal = SIZE_EXPAND_FILL
	_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	_scroll.scroll_deadzone = int(DRAG)
	body.add_child(_scroll)
	_grid = GridContainer.new()
	_grid.columns = 5
	_grid.add_theme_constant_override("h_separation", 8)
	_grid.add_theme_constant_override("v_separation", 8)
	_grid.size_flags_horizontal = SIZE_EXPAND_FILL
	_scroll.add_child(_grid)
	var cp := PanelContainer.new()
	cp.add_theme_stylebox_override("panel", _sb(C_CARD, C_LINE, 1, 8, 12))
	cp.custom_minimum_size = Vector2(390, 0)
	cp.size_flags_horizontal = SIZE_SHRINK_END
	body.add_child(cp)
	_card = VBoxContainer.new()
	_card.add_theme_constant_override("separation", 6)
	cp.add_child(_card)
	# низ: всё хламом — одной кнопкой, реплика барахольщика
	var bh := HBoxContainer.new()
	bh.add_theme_constant_override("separation", 10)
	v.add_child(bh)
	_say = _lbl("", 16, C_TEXT)
	_say.size_flags_horizontal = SIZE_EXPAND_FILL
	_say.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bh.add_child(_say)
	_junk_btn = _btn("", "orange", sell_all_junk, Vector2(390, 48), 17)
	bh.add_child(_junk_btn)
	_say.text = "«Неси всё, что звенит и блестит. Плачу честно — по весу и по редкости.»"
	set_tab("sell")


func _process(delta: float) -> void:
	_cool = maxf(_cool - delta, 0.0)


func close() -> void:
	closed.emit()
	queue_free()


func set_tab(t: String) -> void:
	tab = t
	cat = ""
	sel_id = ""
	qty = 1
	refresh()


func set_cat(c: String) -> void:
	cat = c
	refresh()


## выбрать предмет (kind — на вкладке «Купить»: "stock" или "buyback")
func select(id: String, kind := "stock") -> void:
	sel_id = id
	sel_kind = kind
	qty = 1
	refresh()


func set_qty(n: int) -> void:
	qty = clampi(n, 1, maxi(_max_qty(), 1))
	_build_card()


## что сейчас на витрине: [{id, n, price, …}]
func entries() -> Array:
	if tab == "sell":
		return ULDealer.sellable(inv).filter(func(e): return cat == "" or String(e.cat) == cat)
	return ULDealer.stock().filter(func(e): return int(e.left) > 0)


func _entry() -> Dictionary:
	for e in entries():
		if String(e.id) == sel_id and (tab == "sell" or String(e.kind) == sel_kind):
			return e
	return {}


func _max_qty() -> int:
	var e := _entry()
	if e.is_empty():
		return 0
	if tab == "sell":
		return int(e.n)
	var by_money := 9999
	for r in e.price:
		by_money = mini(by_money, int(inv.wallet.get(r, 0)) / maxi(int(e.price[r]), 1))
	return maxi(mini(int(e.left), mini(by_money, ULDealer.room(inv, String(e.id)) / maxi(int(e.lot), 1))), 0)


func refresh() -> void:
	for id in _wallet:
		(_wallet[id] as Label).text = str(int(inv.wallet.get(id, 0)))
	for t in _tabs:
		_style_btn(_tabs[t], "tab_on" if t == tab else "tab")
	for c in _cats.get_children():
		c.queue_free()
	if tab == "sell":
		for cc in SELL_CATS:
			var b := _btn(cc[1], "tab_on" if cat == cc[0] else "tab", set_cat.bind(cc[0]), Vector2(0, 40), 15)
			_cats.add_child(b)
	var es := entries()
	if sel_id == "" or _entry().is_empty():
		sel_id = String(es[0].id) if not es.is_empty() else ""
		sel_kind = String(es[0].get("kind", "stock")) if not es.is_empty() else "stock"
		qty = 1
	qty = clampi(qty, 1, maxi(_max_qty(), 1))
	for c in _grid.get_children():
		c.queue_free()
	if es.is_empty():
		var l := _lbl("Продавать нечего: хлам, минералы, запчасти и инструменты находят на вылазках." if tab == "sell" else "Товар кончился — привезут после сброса маршрутов.", 17, C_DIM)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(500, 0)
		_grid.add_child(l)
	for e in es:
		_grid.add_child(_entry_card(e))
	var jn := inv.count("junk")
	_junk_btn.visible = tab == "sell"
	_junk_btn.disabled = jn <= 0
	_junk_btn.text = "Продать весь хлам: %d → %s" % [jn, ULEconomy.list_text(ULDealer.sell_price("junk", jn))] if jn > 0 else "Хлама нет"
	_style_btn(_junk_btn, "orange" if jn > 0 else "gray")
	_build_card()


func _entry_card(e: Dictionary) -> Control:
	var id := String(e.id)
	var on := id == sel_id and (tab == "sell" or String(e.kind) == sel_kind)
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(C_SEL if on else C_CARD, C_GOLD if on else C_LINE, 2 if on else 1, 8, 8))
	p.custom_minimum_size = Vector2(146, 150)
	p.mouse_filter = MOUSE_FILTER_PASS
	p.name = "card_%s_%s" % [id, String(e.get("kind", "sell"))]
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 2)
	v.mouse_filter = MOUSE_FILTER_IGNORE
	p.add_child(v)
	var ic := _icon(ULItems.icon(id), 70)
	ic.modulate = ULItems.tint(id)
	v.add_child(ic)
	var nm := _lbl(String(ULItems.get_def(id).n), 14, RAR_COL.get(String(ULItems.get_def(id).get("rar", "common")), C_TEXT), true)
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	v.add_child(nm)
	var cnt := ("×%d" % int(e.n)) if tab == "sell" else (("лот %d шт. · " % int(e.lot) if int(e.lot) > 1 else "") + "осталось %d" % int(e.left))
	if tab == "buy" and String(e.kind) == "buyback":
		cnt = "выкуп · " + cnt
	var cl := _lbl(cnt, 13, C_DIM)
	cl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(cl)
	var ph := HBoxContainer.new()
	ph.alignment = BoxContainer.ALIGNMENT_CENTER
	ph.mouse_filter = MOUSE_FILTER_IGNORE
	_price_row(ph, e.price, 16, 22)
	v.add_child(ph)
	var kind := String(e.get("kind", "stock"))
	p.gui_input.connect(func(ev: InputEvent) -> void:
		if (ev is InputEventMouseButton or ev is InputEventScreenTouch) and ev.pressed:
			_press_at = ev.position
			_dragged = false
		elif ev is InputEventMouseMotion or ev is InputEventScreenDrag:
			if ev.position.distance_to(_press_at) > DRAG:
				_dragged = true
		elif (ev is InputEventMouseButton or ev is InputEventScreenTouch) and not ev.pressed and not _dragged:
			select(id, kind))
	return p


func _build_card() -> void:
	for c in _card.get_children():
		c.queue_free()
	var e := _entry()
	if e.is_empty():
		_card.add_child(_lbl("Выберите предмет на витрине.", 16, C_DIM))
		return
	var id := String(e.id)
	var d := ULItems.get_def(id)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 10)
	_card.add_child(top)
	var ic := _icon(ULItems.icon(id), 96)
	ic.modulate = ULItems.tint(id)
	top.add_child(ic)
	var tv := VBoxContainer.new()
	tv.size_flags_horizontal = SIZE_EXPAND_FILL
	top.add_child(tv)
	var rar := String(d.get("rar", "common"))
	tv.add_child(_lbl(String(d.n), 20, RAR_COL.get(rar, C_TEXT), true))
	var cat_n := String(ULItems.CATS.get(String(d.get("cat", "")), ""))
	tv.add_child(_lbl((cat_n + " · " if cat_n != "" else "") + String(ULItems.RARITY.get(rar, "")), 14, C_DIM))
	var kg := float(d.get("kg", 0.0))
	tv.add_child(_lbl(("масса %s кг · " % str(snappedf(kg, 0.01)) if kg > 0.0 else "") + "в стопке до %d" % ULItems.stack(id), 14, C_DIM))
	var ds := _lbl(String(d.get("d", "")), 14, C_TEXT)
	ds.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ds.custom_minimum_size = Vector2(360, 0)
	_card.add_child(ds)
	var lot := int(e.get("lot", 1))
	var unit := HBoxContainer.new()
	unit.add_theme_constant_override("separation", 6)
	unit.add_child(_lbl(("Цена за штуку:" if tab == "sell" else ("Цена за лот (%d шт.):" % lot if lot > 1 else "Цена за штуку:")), 16, C_TEXT))
	_price_row(unit, e.price, 17, 24)
	_card.add_child(unit)
	var mx := _max_qty()
	_card.add_child(_lbl("Количество (можно %d):" % mx if tab == "sell" or lot == 1 else "Лотов (можно %d):" % mx, 16, C_TEXT))
	var qh := HBoxContainer.new()
	qh.add_theme_constant_override("separation", 6)
	qh.add_child(_btn("−", "gray", func() -> void: set_qty(qty - 1), Vector2(54, 46), 24))
	var ql := _lbl(str(qty), 22, C_GOLD, true)
	ql.name = "Qty"
	ql.custom_minimum_size = Vector2(70, 0)
	ql.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	qh.add_child(ql)
	qh.add_child(_btn("+", "gray", func() -> void: set_qty(qty + 1), Vector2(54, 46), 24))
	qh.add_child(_btn("Всё" if tab == "sell" else "Макс.", "gray", func() -> void: set_qty(mx), Vector2(90, 46), 16))
	_card.add_child(qh)
	var total := {}
	for r in e.price:
		total[r] = int(e.price[r]) * qty
	var after := inv.wallet.duplicate()
	var sign := 1 if tab == "sell" else -1
	for r in total:
		after[r] = int(after.get(r, 0)) + sign * int(total[r])
	var short := tab == "buy" and mx < 1
	var th := HBoxContainer.new()
	th.add_theme_constant_override("separation", 6)
	th.add_child(_lbl("Вы получите:" if tab == "sell" else "Стоимость:", 17, C_TEXT, true))
	_price_row(th, total, 19, 26)
	_card.add_child(th)
	var al := _lbl("После сделки у вас: " + ", ".join(total.keys().map(func(r): return "%s — %d" % [String(ULItems.get_def(String(r)).n).to_lower(), int(after[r])])), 14, C_RED if short else C_DIM)
	al.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	_card.add_child(al)
	if short:
		var why := "Нет места в карманах и рюкзаке." if ULEconomy.missing(inv.wallet, e.price).is_empty() else "Не хватает: " + ULEconomy.list_text(ULEconomy.missing(inv.wallet, e.price)) + "."
		_card.add_child(_lbl(why, 15, C_RED))
	var sp := Control.new()
	sp.size_flags_vertical = SIZE_EXPAND_FILL
	_card.add_child(sp)
	var b := _btn(("ПРОДАТЬ ×%d" % qty) if tab == "sell" else ("КУПИТЬ ×%d" % (qty * lot)), "orange" if tab == "sell" else "green", confirm, Vector2(0, 58), 21)
	b.name = "Deal"
	b.disabled = short
	if short:
		_style_btn(b, "gray")
	_card.add_child(b)


## «Продать» / «Купить» выбранное в выбранном количестве; true — сделка прошла
func confirm() -> bool:
	if _cool > 0.0 or sel_id == "":
		return false
	var e := _entry()
	if e.is_empty():
		return false
	var r: Dictionary
	if tab == "sell":
		r = ULDealer.sell(inv, sel_id, qty)
		if r.ok:
			_say.text = "Продано: %s ×%d → %s. «По рукам!»" % [String(ULItems.get_def(sel_id).n), qty, ULEconomy.list_text(r.got)]
	else:
		r = ULDealer.buy(inv, sel_id, qty, sel_kind)
		if r.ok:
			_say.text = "Куплено: %s ×%d за %s. «Носи на здоровье.»" % [String(ULItems.get_def(sel_id).n), int(r.n), ULEconomy.list_text(r.paid)]
	if not r.ok:
		_say.text = {"money": "Не хватает: " + ULEconomy.list_text(r.get("miss", {})), "space": "Нет места в карманах и рюкзаке.",
			"stock": "Столько нет — кончилось.", "not_enough": "Столько у вас нет."}.get(String(r.err), "Сделка не прошла.")
		refresh()
		return false
	_cool = 0.5
	qty = 1
	if on_change.is_valid():
		on_change.call()
	refresh()
	return true


## весь хлам — одной кнопкой
func sell_all_junk() -> bool:
	var n := inv.count("junk")
	if n <= 0 or _cool > 0.0:
		return false
	var r := ULDealer.sell(inv, "junk", n)
	if r.ok:
		_say.text = "Хлам: %d кучек → %s." % [n, ULEconomy.list_text(r.got)]
		_cool = 0.5
		if on_change.is_valid():
			on_change.call()
	refresh()
	return r.ok


# ---------------- оформление ----------------

func _sb(bg: Color, border: Color, bw := 1, radius := 6, margin := 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	return sb


func _lbl(t: String, fs: int, col: Color, bold := false) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	if bold:
		l.add_theme_font_override("font", _bold)
	l.mouse_filter = MOUSE_FILTER_IGNORE
	return l


func _icon(tex: Texture2D, sz: float) -> TextureRect:
	var t := TextureRect.new()
	t.texture = tex
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(sz, sz)
	t.mouse_filter = MOUSE_FILTER_IGNORE
	return t


func _price_row(parent: Control, price: Dictionary, fs: int, sz: float) -> void:
	for r in price:
		parent.add_child(_icon(ULItems.icon(String(r)), sz))
		parent.add_child(_lbl(str(int(price[r])), fs, C_GOLD, true))


func _btn(text: String, kind: String, cb: Callable, min_size := Vector2(0, 46), fs := 17) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = min_size
	b.add_theme_font_size_override("font_size", fs)
	b.add_theme_font_override("font", _bold)
	b.focus_mode = FOCUS_NONE
	_style_btn(b, kind)
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
	for st in ["normal", "hover", "pressed", "disabled"]:
		var bg: Color = c[0].lightened(0.08 if st == "hover" else (0.2 if st == "pressed" else 0.0))
		b.add_theme_stylebox_override(st, _sb(bg, c[1], 2, 6, 10))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color", "font_focus_color"]:
		b.add_theme_color_override(k, c[2])
