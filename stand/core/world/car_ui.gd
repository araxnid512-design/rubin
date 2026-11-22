class_name ULCarUI
extends Control
## Окно «УАЗ» на базе (кнопка «Улучшить» у капота машины): прочность, бензин, багажник; заправка и ремонт;
## улучшения — колёса, багажник, броня, бак (каждое меняет и вид машины). Цены — data/car.json (предложение,
## не утверждённый баланс); платится из кошелька героя (спораны, горошины) и хламом из инвентаря.

const LINES := ["wheels", "trunk", "armor", "tank"]

var car: ULCar
var inv: ULInventory
var on_change: Callable              ## мир: сохранить машину, обновить багажник
var _vb: VBoxContainer
var _msg := ""


static func open(parent: Node, c: ULCar, i: ULInventory, changed: Callable) -> ULCarUI:
	var ui := ULCarUI.new()
	ui.car = c
	ui.inv = i
	ui.on_change = changed
	parent.add_child(ui)
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui._build()
	return ui


func _build() -> void:
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
	pn.offset_left = -470
	pn.offset_right = 470
	pn.offset_top = -330
	pn.offset_bottom = 330
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	pn.add_child(sc)
	_vb = VBoxContainer.new()
	_vb.add_theme_constant_override("separation", 8)
	_vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(_vb)
	refresh()


func _lab(t: String, fs: int, col := ULSettings.C_TEXT) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## цена текстом: «60 споранов, 2 горошины, хлам ×4»
static func price_text(price: Dictionary, junk: int) -> String:
	var t := ULEconomy.list_text(price) if not price.is_empty() else ""
	if junk > 0:
		t += (", " if t != "" else "") + "хлам ×%d" % junk
	return t if t != "" else "бесплатно"


func _can(price: Dictionary, junk: int) -> bool:
	return ULEconomy.missing(inv.wallet, price).is_empty() and inv.count("junk") >= junk


func _pay(price: Dictionary, junk: int) -> bool:
	if not _can(price, junk):
		_msg = "Не хватает: " + price_text(price, junk) + " (есть %d хлама)" % inv.count("junk")
		return false
	if not inv.pay(price):
		return false
	if junk > 0:
		inv.consume("junk", junk)
	return true


## заправка: liters ≤ 0 — до полного бака. Цена — за литр (buy_price за buy_l литров), с округлением вверх
func fuel_price(liters: float) -> Dictionary:
	var fc: Dictionary = ULCar.cfg().get("fuel", {})
	var per := float(fc.get("buy_l", 10))
	var out := {}
	for k in (fc.get("buy_price", {"spore": 8}) as Dictionary):
		out[k] = int(ceil(float(fc.buy_price[k]) * liters / per))
	return out


func buy_fuel(liters: float) -> bool:
	var room := car.tank - car.fuel
	if liters <= 0.0 or liters > room:
		liters = room
	if liters < 0.05:
		_msg = "Бак полный"
		return false
	if not _pay(fuel_price(liters), 0):
		return false
	car.fuel = minf(car.tank, car.fuel + liters)
	_msg = "Залито %.0f л" % liters
	_done()
	return true


func repair_price() -> Array:
	var rc: Dictionary = ULCar.cfg().get("repair", {})
	var k := (car.hp_max - car.hp) / 100.0
	var p := {}
	for r in (rc.get("per_100", {"spore": 6}) as Dictionary):
		p[r] = int(ceil(float(rc.per_100[r]) * k))
	return [p, int(ceil(float(rc.get("junk_per_100", 1)) * k))]


func repair() -> bool:
	if car.hp >= car.hp_max - 0.5:
		_msg = "Машина цела"
		return false
	var rp := repair_price()
	if not _pay(rp[0], rp[1]):
		return false
	car.hp = car.hp_max
	car._smoke_update()
	_msg = "Отремонтировано"
	_done()
	return true


func upgrade(line: String) -> bool:
	var cur := int(car.up.get(line, 0))
	if cur >= ULCar.max_lvl(line):
		_msg = "Уже лучшее"
		return false
	var nx := ULCar.lvl(line, cur + 1)
	if not _pay(nx.get("price", {}), int(nx.get("junk", 0))):
		return false
	var old_max := car.hp_max
	var u := car.up.duplicate()
	u[line] = cur + 1
	car.apply_up(u)
	if car.hp_max > old_max:
		car.hp += car.hp_max - old_max           # броня прибавляет прочность сразу
	_msg = "Установлено: " + String(nx.get("n", ""))
	_done()
	return true


func _done() -> void:
	if on_change.is_valid():
		on_change.call()
	refresh()


func refresh() -> void:
	if _vb == null:
		return
	for ch in _vb.get_children():
		ch.queue_free()
	var head := HBoxContainer.new()
	_vb.add_child(head)
	var tl := _lab("УАЗ-469", 24)
	tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(tl)
	head.add_child(_lab("%s · хлам %d" % [ULEconomy.list_text({"spore": int(inv.wallet.get("spore", 0)), "pea": int(inv.wallet.get("pea", 0))}), inv.count("junk")], 15, Color(1.0, 0.9, 0.6)))
	head.add_child(ULSettings.button("Закрыть", close, 120))
	_vb.add_child(_lab("Прочность %d / %d · бензин %.1f / %d л · багажник %d ячеек" % [int(round(car.hp)), int(round(car.hp_max)), car.fuel, int(car.tank), ULCar.trunk_cells(int(car.up.trunk))], 16, Color(0.75, 0.9, 1.0)))
	# заправка и ремонт
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_vb.add_child(row)
	var fc: Dictionary = ULCar.cfg().get("fuel", {})
	var l10 := float(fc.get("buy_l", 10))
	var b1 := ULSettings.button("Бензин +%d л — %s" % [int(l10), price_text(fuel_price(l10), 0)], func() -> void: buy_fuel(l10), 280)
	b1.disabled = car.tank - car.fuel < 0.05
	row.add_child(b1)
	var room := car.tank - car.fuel
	var b2 := ULSettings.button("Полный бак — %s" % price_text(fuel_price(room), 0), func() -> void: buy_fuel(0.0), 260)
	b2.disabled = room < 0.05
	row.add_child(b2)
	var rp := repair_price()
	var b3 := ULSettings.button("Починить — %s" % price_text(rp[0], rp[1]) if car.hp < car.hp_max - 0.5 else "Машина цела", repair, 300)
	b3.disabled = car.hp >= car.hp_max - 0.5
	row.add_child(b3)
	_vb.add_child(_lab("Улучшения — меняют и вид машины", 18, Color(1.0, 0.86, 0.5)))
	for line in LINES:
		var cur := int(car.up.get(line, 0))
		var mx := ULCar.max_lvl(line)
		var box := PanelContainer.new()
		box.add_theme_stylebox_override("panel", ULSettings._box(Color(0.07, 0.1, 0.14)))
		_vb.add_child(box)
		var hb := HBoxContainer.new()
		hb.add_theme_constant_override("separation", 10)
		box.add_child(hb)
		var tv := VBoxContainer.new()
		tv.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		hb.add_child(tv)
		var lv := ULCar.lvl(line, cur)
		var dots := ""
		for j in mx + 1:
			dots += "●" if j <= cur else "○"
		tv.add_child(_lab("%s  %s  %s" % [String((ULCar.cfg().upgrades[line] as Dictionary).n), dots, String(lv.get("n", ""))], 17))
		if cur < mx:
			var nx := ULCar.lvl(line, cur + 1)
			tv.add_child(_lab("Дальше: %s — %s" % [String(nx.get("n", "")), String(nx.get("d", ""))], 14, Color(0.7, 0.76, 0.84)))
			tv.add_child(_lab("Цена: " + price_text(nx.get("price", {}), int(nx.get("junk", 0))), 14, Color(1.0, 0.9, 0.6)))
			var ub := ULSettings.button("Улучшить", func() -> void: upgrade(line), 150)
			ub.disabled = not _can(nx.get("price", {}), int(nx.get("junk", 0)))
			hb.add_child(ub)
		else:
			tv.add_child(_lab(String(lv.get("d", "")) + " — лучшее", 14, Color(0.6, 0.9, 0.6)))
	if _msg != "":
		_vb.add_child(_lab(_msg, 15, Color(1.0, 0.8, 0.5)))


func close() -> void:
	queue_free()
