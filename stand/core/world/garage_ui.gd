class_name ULGarageUI
extends Control
## Окна гаража и машины (по фото из ТЗ). Гараж (veh = false), вкладки сверху:
##  «Улучшения» — машина в 3D на платформе (крутится, видно навесное), характеристики, пять деталей (уровень,
##    состояние, «Улучшить» за горох, «Ремонт», «Заменить») и четыре турели («Купить и установить», «Поставить»,
##    «Снять», ремонт);
##  «Заправка» — резервуар «ТОПЛИВО» со счётчиком литров: слева — залить канистру в резервуар, справа — наполнить
##    канистру из резервуара (канистры — предметы героя);
##  «Автомобили» — места гаража стрелками ◀ ▶, «Выбрать» (места 2 и 3 — под замком);
##  «Багажник» — хранилище багажника выбранной машины.
## Окно машины (veh = true): «Багажник», «Боеприпасы» (загрузка в турель из инвентаря), «Бак» (заправка из
## канистр), «Состояние» (прочность деталей). Правила — ULGarageOps; w — локация (world.gd).

const C_PANEL := Color(0.03, 0.065, 0.058, 0.97)
const C_CARD := Color(0.045, 0.095, 0.083)
const C_LINE := Color(0.19, 0.4, 0.31)
const C_GOLD := Color(1.0, 0.82, 0.32)
const C_TEXT := Color(0.87, 0.91, 0.87)
const C_DIM := Color(0.6, 0.66, 0.62)
const C_RED := Color(0.97, 0.4, 0.33)
const C_OK := Color(0.5, 0.95, 0.5)
const ICONS := "res://assets/icons/"

var w                               ## локация (world.gd)
var veh := false
var tab := "up"
var _body: VBoxContainer
var _tabs := {}
var _wallet: Label
var _msg: Label
var _msg_t := 0.0
var _view_car: ULCar
var _view_cam: Camera3D
var _sel_i := 0                     ## «Автомобили»: какое место показано
var _pick: Control                  ## выбор канистры


static func open(parent: Node, world, start_tab := "up", is_veh := false) -> ULGarageUI:
	var ui := ULGarageUI.new()
	ui.w = world
	ui.veh = is_veh
	ui.tab = start_tab
	ui._sel_i = int(ULBase.garage().get("sel", 0))
	parent.add_child(ui)
	ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ui._build()
	return ui


func cd() -> Dictionary:
	return ULBase.car_data()


# ---------------- оформление ----------------

func _sb(bg: Color, border: Color, bw := 1, radius := 6, margin := 8) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(bw)
	sb.set_corner_radius_all(radius)
	sb.set_content_margin_all(margin)
	return sb


func _lbl(t: String, fs: int, col := C_TEXT, wrap := false) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	l.add_theme_constant_override("outline_size", 3)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _btn(t: String, kind: String, cb: Callable, minw := 0.0, h := 40.0, fs := 16) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(minw, h)
	b.add_theme_font_size_override("font_size", fs)
	b.focus_mode = Control.FOCUS_NONE
	var c: Array = {
		"green": [Color(0.1, 0.27, 0.08), Color(0.55, 0.95, 0.3), Color(0.9, 1.0, 0.82)],
		"orange": [Color(0.3, 0.18, 0.04), Color(1.0, 0.68, 0.22), Color(1.0, 0.92, 0.75)],
		"red": [Color(0.42, 0.05, 0.05), Color(0.95, 0.28, 0.22), Color(1.0, 0.85, 0.85)],
		"gray": [Color(0.1, 0.13, 0.12), Color(0.3, 0.38, 0.34), Color(0.62, 0.68, 0.64)],
		"tab": [Color(0.04, 0.09, 0.08), Color(0.22, 0.4, 0.33), Color(0.8, 0.88, 0.84)],
		"tab_on": [Color(0.17, 0.2, 0.06), Color(0.95, 0.85, 0.3), Color(1.0, 0.97, 0.85)],
	}[kind]
	for st in ["normal", "hover", "pressed", "disabled", "focus"]:
		var sb := _sb(c[0].lightened(0.1 if st == "hover" else (0.2 if st == "pressed" else 0.0)), c[1], 2, 6, 6)
		b.add_theme_stylebox_override(st, sb)
	for k in ["font_color", "font_hover_color", "font_pressed_color", "font_disabled_color", "font_focus_color"]:
		b.add_theme_color_override(k, c[2] if k != "font_disabled_color" else c[2].darkened(0.35))
	b.pressed.connect(cb)
	return b


func _icon(name: String, sz: float) -> TextureRect:
	var t := TextureRect.new()
	var p := ICONS + name + ".png"
	t.texture = load(p) if ResourceLoader.exists(p) else null
	t.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	t.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	t.custom_minimum_size = Vector2(sz, sz)
	t.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return t


func _price(price: Dictionary, fs := 18) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.alignment = BoxContainer.ALIGNMENT_CENTER
	h.add_theme_constant_override("separation", 4)
	h.mouse_filter = Control.MOUSE_FILTER_IGNORE
	for r in price:
		h.add_child(_icon("loot_" + String(r), fs + 6))
		h.add_child(_lbl(str(int(price[r])), fs, C_GOLD if ULEconomy.missing(w.inv.wallet, {r: price[r]}).is_empty() else C_RED))
	return h


func _card(border := C_LINE) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _sb(C_CARD, border, 1, 6, 8))
	return p


func say(t: String, bad := false) -> void:
	if _msg == null:
		return
	_msg.text = t
	_msg.add_theme_color_override("font_color", C_RED if bad else C_OK)
	_msg_t = 3.0


# ---------------- каркас ----------------

func _build() -> void:
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.55)
	add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", _sb(C_PANEL, Color(0.36, 0.42, 0.38), 3, 10, 10))
	add_child(pn)
	pn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pn.offset_left = 10
	pn.offset_top = 8
	pn.offset_right = -10
	pn.offset_bottom = -8
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	pn.add_child(vb)
	var top := HBoxContainer.new()
	top.add_theme_constant_override("separation", 8)
	vb.add_child(top)
	top.add_child(_icon("ui/terminal" if not veh else "crate", 34))
	top.add_child(_lbl("Гараж" if not veh else w.car_name(), 24, Color(0.97, 0.97, 0.94)))
	var tl: Array = [["up", "Улучшения"], ["fuel", "Заправка"], ["cars", "Автомобили"], ["trunk", "Багажник"]]
	if veh:
		tl = [["trunk", "Багажник"], ["ammo", "Боеприпасы"], ["tank", "Бак"], ["state", "Состояние"]]
	for t in tl:
		var b := _btn(String(t[1]), "tab", set_tab.bind(String(t[0])), 0.0, 42.0, 17)
		_tabs[String(t[0])] = b
		top.add_child(b)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	top.add_child(sp)
	_wallet = _lbl("", 17, C_GOLD)
	top.add_child(_wallet)
	top.add_child(_btn("✕", "red", close, 56.0, 42.0, 20))
	_msg = _lbl("", 16, C_OK)
	_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	vb.add_child(_msg)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(sc)
	_body = VBoxContainer.new()
	_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_body.add_theme_constant_override("separation", 8)
	sc.add_child(_body)
	set_tab(tab)


func set_tab(t: String) -> void:
	if t == "trunk":
		close()
		w.open_trunk()                        # багажник — окно хранилища (как сейф): содержимое и вещи героя
		return
	tab = t
	for k in _tabs:
		var b: Button = _tabs[k]
		var on: bool = k == t
		for st in ["normal", "hover", "pressed"]:
			b.add_theme_stylebox_override(st, _sb(Color(0.17, 0.2, 0.06) if on else Color(0.04, 0.09, 0.08), Color(0.95, 0.85, 0.3) if on else Color(0.22, 0.4, 0.33), 2, 6, 6))
	refresh()


func refresh() -> void:
	if _body == null:
		return
	_view_car = null
	for c in _body.get_children():
		c.queue_free()
	_wallet.text = "Горох %d   Спораны %d   Хлам %d" % [int(w.inv.wallet.get("pea", 0)), int(w.inv.wallet.get("spore", 0)), w.inv.count("junk")]
	match tab:
		"up":
			_build_up()
		"fuel":
			_build_fuel()
		"cars":
			_build_cars()
		"ammo":
			_build_ammo()
		"tank":
			_build_tank()
		"state":
			_build_state()


func _process(delta: float) -> void:
	if _msg_t > 0.0:
		_msg_t -= delta
		if _msg_t <= 0.0 and _msg:
			_msg.text = ""
	if _view_car != null and is_instance_valid(_view_car):
		_view_car.rotation.y += delta * 0.35


func close() -> void:
	if w != null and w.has_method("garage_changed"):
		w.garage_changed()
	queue_free()


## машина в 3D на платформе (отдельный мир): та же модель и навесное, что в игре. Окно сначала встаёт в parent
## (машина собирается по рамкам в мире — вне дерева их нет)
func _car_view(parent: Control, sz: Vector2, data: Dictionary) -> Control:
	var svc := SubViewportContainer.new()
	svc.custom_minimum_size = sz
	svc.stretch = true
	svc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	svc.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(svc)
	var vp := SubViewport.new()
	vp.own_world_3d = true
	vp.transparent_bg = false
	vp.msaa_3d = Viewport.MSAA_2X
	svc.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.07, 0.08, 0.075)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.55, 0.56, 0.52)
	e.ambient_light_energy = 0.8
	env.environment = e
	vp.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation = Vector3(deg_to_rad(-50), deg_to_rad(35), 0)
	sun.light_energy = 1.25
	vp.add_child(sun)
	var lamp := OmniLight3D.new()
	lamp.position = Vector3(0, 4.0, 2.5)
	lamp.omni_range = 9.0
	lamp.light_energy = 0.8
	lamp.light_color = Color(1.0, 0.9, 0.7)
	vp.add_child(lamp)
	# платформа: рифлёный металл с полосами
	var pl := MeshInstance3D.new()
	pl.mesh = ULHouse._frustum(Vector2(4.4, 6.6), Vector2(3.0, 5.2), 0.1)
	var sh := Shader.new()
	sh.code = ULGarage.PLATE_SHADER
	var sm := ShaderMaterial.new()
	sm.shader = sh
	sm.set_shader_parameter("half_top", Vector2(1.5, 2.6))
	pl.material_override = sm
	vp.add_child(pl)
	if not data.is_empty():
		var car := ULCar.new()
		vp.add_child(car)
		car.setup(data)
		car.position.y = 0.1
		car.rotation.y = 0.7
		car.remove_from_group("car")
		_view_car = car
	_view_cam = Camera3D.new()
	_view_cam.fov = 32.0
	_view_cam.position = Vector3(0, 3.4, 8.6)
	vp.add_child(_view_cam)
	_view_cam.look_at(Vector3(0, 0.9, 0), Vector3.UP)
	return svc


# ---------------- «Улучшения» ----------------

func _build_up() -> void:
	var d := cd()
	if d.is_empty():
		_body.add_child(_lbl("В гараже нет машины.", 20, C_DIM))
		return
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 12)
	_body.add_child(head)
	head.add_child(_lbl("⚙ Улучшение транспорта", 20, Color(0.95, 0.97, 0.95)))
	var hsp := Control.new()
	hsp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(hsp)
	var tot := 0
	var mx := 0
	for k in ULCar.PARTS:
		tot += ULGarageOps.lvl(d, k)
		mx += ULCar.max_lvl(k)
	head.add_child(_lbl("Машина №%d — %s   ·   Уровень: %d/%d" % [int(ULBase.garage().sel) + 1, w.car_name(), tot, mx], 20, C_GOLD))
	var mid := HBoxContainer.new()
	mid.add_theme_constant_override("separation", 10)
	_body.add_child(mid)
	_car_view(mid, Vector2(560, 230), d)
	var stc := _card()
	stc.custom_minimum_size.x = 330
	mid.add_child(stc)
	var sv := VBoxContainer.new()
	sv.add_theme_constant_override("separation", 6)
	stc.add_child(sv)
	var st := ULGarageOps.stats(d)
	sv.add_child(_lbl("Характеристики", 19, Color(0.95, 0.97, 0.95)))
	sv.add_child(_lbl("Прочность: %d / %d" % [int(round(st.hp)), int(st.hp_max)], 17, C_GOLD))
	sv.add_child(_lbl("Скорость: %d км/ч" % int(st.kmh), 17, C_GOLD))
	sv.add_child(_lbl("Вместимость багажника: %d ячеек" % int(st.cells), 17, C_GOLD))
	sv.add_child(_lbl("Топливный бак: %.1f / %d л" % [float(st.fuel), int(st.tank)], 17, C_GOLD))
	var t := String(d.get("turret", ""))
	sv.add_child(_lbl("Турель: " + (String(ULCar.turret_cfg(t).n) + " (%d/%d)" % [int(d.turrets[t].get("ammo", 0)), int(ULCar.turret_cfg(t).cap)] if t != "" else "не установлена"), 16, C_TEXT))
	_body.add_child(_lbl("Доступные улучшения", 19, Color(0.95, 0.97, 0.95)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_body.add_child(row)
	for k in ULCar.PARTS:
		row.add_child(_part_card(d, k))
	_body.add_child(_lbl("Турель (оружейный модуль) — устанавливается на крышу", 19, Color(0.95, 0.97, 0.95)))
	var tr := HBoxContainer.new()
	tr.add_theme_constant_override("separation", 8)
	_body.add_child(tr)
	for tt in (ULCar.cfg().get("turrets", {}) as Dictionary):
		tr.add_child(_turret_card(d, String(tt)))


func _part_card(d: Dictionary, k: String) -> Control:
	var pc := ULCar.part_cfg(k)
	var n := ULGarageOps.lvl(d, k)
	var mx := ULCar.max_lvl(k)
	var card := _card(C_GOLD if n > 0 else C_LINE)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.name = "part_" + k
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	card.add_child(v)
	var h := HBoxContainer.new()
	v.add_child(h)
	h.add_child(_icon(String(pc.get("icon", "crate")), 40))
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 0)
	h.add_child(hv)
	hv.add_child(_lbl(String(pc.get("n", k)), 17, Color(0.97, 0.97, 0.94)))
	hv.add_child(_lbl("Уровень: %d/%d" % [n, mx], 15, C_GOLD))
	v.add_child(_lbl(String(ULCar.lvl_cfg(k, n).get("n", "")), 13, C_TEXT, true))
	var hpv := ULGarageOps.part_hp(d, k)
	if hpv.y > 0.0:
		var kk := hpv.x / hpv.y
		v.add_child(_lbl("Состояние: %d/%d%s" % [int(round(hpv.x)), int(hpv.y), "  — разрушено" if hpv.x <= 0.0 else ""], 14, C_RED if kk < 0.3 else (C_GOLD if kk < 0.7 else C_OK)))
	else:
		v.add_child(_lbl(String(pc.get("d", "")), 12, C_DIM, true))
	if n < mx:
		var pr := ULGarageOps.up_price(d, k)
		var ph := HBoxContainer.new()
		ph.alignment = BoxContainer.ALIGNMENT_CENTER
		v.add_child(ph)
		ph.add_child(_price(pr, 17))
		var b := _btn("Улучшить", "green", _do_upgrade.bind(k), 0.0, 36.0, 16)
		b.name = "up"
		b.disabled = not ULEconomy.missing(w.inv.wallet, pr).is_empty()
		v.add_child(b)
	else:
		var b := _btn("Максимум", "gray", func() -> void: pass, 0.0, 36.0, 15)
		b.disabled = true
		v.add_child(b)
	if hpv.y > 0.0:
		var rh := HBoxContainer.new()
		rh.add_theme_constant_override("separation", 4)
		v.add_child(rh)
		var rc := ULGarageOps.repair_cost(d, k)
		var rb := _btn("Ремонт" + (" " + _cost_text(rc) if not rc.is_empty() else ""), "orange", _do_repair.bind(k), 0.0, 30.0, 12)
		rb.name = "repair"
		rb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		rb.disabled = rc.is_empty()
		rh.add_child(rb)
		var xb := _btn("Заменить " + ULEconomy.list_text(ULGarageOps.replace_price(d, k)), "gray" if hpv.x > 0.0 else "orange", _do_replace.bind(k), 0.0, 30.0, 12)
		xb.name = "replace"
		xb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		xb.disabled = hpv.x >= hpv.y - 0.01
		rh.add_child(xb)
	return card


func _cost_text(c: Dictionary) -> String:
	var t := ULEconomy.list_text(c.get("price", {}))
	if int(c.get("junk", 0)) > 0:
		t += ", хлам ×%d" % int(c.junk)
	return t


func _turret_card(d: Dictionary, t: String) -> Control:
	var tc := ULCar.turret_cfg(t)
	var own := (d.turrets as Dictionary).has(t)
	var on := String(d.get("turret", "")) == t
	var card := _card(C_GOLD if on else C_LINE)
	card.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	card.name = "tur_" + t
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 3)
	card.add_child(v)
	var h := HBoxContainer.new()
	v.add_child(h)
	h.add_child(_icon(String(tc.get("icon", "crate")), 40))
	var hv := VBoxContainer.new()
	hv.add_theme_constant_override("separation", 0)
	h.add_child(hv)
	hv.add_child(_lbl(String(tc.get("n", t)), 16, Color(0.97, 0.97, 0.94)))
	hv.add_child(_lbl("Урон: %s · темп: %s · до %d м" % [String(tc.get("dmg_txt", "")), String(tc.get("rate_txt", "")), int(minf(float(tc.get("range", 10.0)), ULCar.c("turret_range_max", 10.0)))], 12, C_DIM))
	if own:
		var st: Dictionary = d.turrets[t]
		v.add_child(_lbl("Боезапас %d/%d · прочность %d/%d" % [int(st.get("ammo", 0)), int(tc.cap), int(round(float(st.get("hp", 0)))), int(tc.hp)], 13, C_OK if on else C_TEXT))
	var bh := HBoxContainer.new()
	bh.add_theme_constant_override("separation", 4)
	v.add_child(bh)
	if not own:
		bh.add_child(_price(tc.get("price", {}), 16))
		var b := _btn("Установить", "green", _do_turret_buy.bind(t), 0.0, 34.0, 15)
		b.name = "buy"
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		b.disabled = not ULEconomy.missing(w.inv.wallet, tc.get("price", {})).is_empty()
		bh.add_child(b)
	elif on:
		var b := _btn("Снять", "gray", _do_turret_off, 0.0, 34.0, 15)
		b.name = "off"
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bh.add_child(b)
	else:
		var b := _btn("Поставить", "green", _do_turret_on.bind(t), 0.0, 34.0, 15)
		b.name = "on"
		b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		bh.add_child(b)
	if own:
		var rc := ULGarageOps.turret_repair_cost(d, t)
		if not rc.is_empty():
			bh.add_child(_btn("Ремонт " + _cost_text(rc), "orange", _do_turret_repair.bind(t), 0.0, 34.0, 12))
	return card


func _after(r: Dictionary, ok_text: String) -> bool:
	if r.ok:
		say(ok_text)
		w.garage_changed()
	else:
		say(ULGarageOps.err_text(r), true)
	refresh()
	return bool(r.ok)


func _do_upgrade(k: String) -> bool:
	var r := ULGarageOps.upgrade(w.inv, cd(), k)
	return _after(r, "Установлено: %s — %s" % [String(ULCar.part_cfg(k).n), String(ULCar.lvl_cfg(k, ULGarageOps.lvl(cd(), k)).get("n", ""))])


func _do_repair(k: String) -> bool:
	return _after(ULGarageOps.repair(w.inv, cd(), k), "Отремонтировано: " + String(ULCar.part_cfg(k).n))


func _do_replace(k: String) -> bool:
	return _after(ULGarageOps.replace(w.inv, cd(), k), "Заменено новой деталью: " + String(ULCar.part_cfg(k).n))


func _do_turret_buy(t: String) -> bool:
	return _after(ULGarageOps.turret_buy(w.inv, cd(), t), "%s куплена и установлена на крышу" % String(ULCar.turret_cfg(t).n))


func _do_turret_on(t: String) -> bool:
	return _after(ULGarageOps.turret_install(cd(), t), "%s на крыше; прежняя — в гараже" % String(ULCar.turret_cfg(t).n))


func _do_turret_off() -> bool:
	return _after(ULGarageOps.turret_remove(cd()), "Турель снята и хранится в гараже")


func _do_turret_repair(t: String) -> bool:
	return _after(ULGarageOps.turret_repair(w.inv, cd(), t), "Турель отремонтирована")


# ---------------- «Заправка» ----------------

## резервуар: ржавый бак с надписью и стеклом-указателем (рисуется), слева и справа — ячейки для канистры
func _build_fuel() -> void:
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 12)
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_body.add_child(row)
	row.add_child(_slot("Залить в резервуар", "Канистра → резервуар", _pick_canister.bind("in")))
	row.add_child(_lbl("→", 40, C_TEXT))
	var tank := _TankView.new()
	tank.ui = self
	tank.custom_minimum_size = Vector2(560, 380)
	row.add_child(tank)
	row.add_child(_lbl("→", 40, C_TEXT))
	row.add_child(_slot("Наполнить канистру", "Резервуар → канистра", _pick_canister.bind("out")))
	var cans := ULGarageOps.canisters(w.inv)
	var tot := 0.0
	for c in cans:
		tot += ULGarageOps.fuel_of(c.it)
	_body.add_child(_lbl("Канистр у героя: %d (в них %s л). Канистры продаёт барахольщик у крыльца; встречаются в кластерах." % [cans.size(), ULItems._l(tot)], 15, C_DIM, true))


func _slot(title: String, sub: String, cb: Callable) -> Control:
	var p := _card(Color(0.55, 0.9, 0.35))
	p.custom_minimum_size = Vector2(220, 300)
	var v := VBoxContainer.new()
	v.alignment = BoxContainer.ALIGNMENT_CENTER
	v.add_theme_constant_override("separation", 10)
	p.add_child(v)
	v.add_child(_icon("canister", 64))
	var b := _btn("+", "tab", cb, 160.0, 150.0, 64)
	b.name = "slot"
	v.add_child(b)
	var l := _lbl(title, 17, Color(0.95, 0.97, 0.95), true)
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l)
	var l2 := _lbl(sub, 13, C_DIM)
	l2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	v.add_child(l2)
	return p


## выбрать канистру из инвентаря: mode in — слить в резервуар (с топливом), out — наполнить (не полные),
## car — залить в бак машины
func _pick_canister(mode: String) -> void:
	var list: Array = []
	for c in ULGarageOps.canisters(w.inv):
		var l := ULGarageOps.fuel_of(c.it)
		if (mode == "out" and l < ULGarageOps.can_cap() - 0.01) or (mode != "out" and l > 0.0):
			list.append(c)
	if list.is_empty():
		say("Нет подходящей канистры в инвентаре" if mode != "out" else "Нет канистры, куда можно налить", true)
		return
	if list.size() == 1:
		use_canister(mode, list[0].it)
		return
	if _pick != null:
		_pick.queue_free()
	_pick = PanelContainer.new()
	(_pick as PanelContainer).add_theme_stylebox_override("panel", _sb(C_PANEL, C_GOLD, 2, 8, 12))
	add_child(_pick)
	_pick.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	_pick.add_child(v)
	v.add_child(_lbl("Какую канистру?", 19, C_GOLD))
	for c in list:
		var it: Dictionary = c.it
		v.add_child(_btn(ULItems.title(it), "green", func() -> void:
			_pick.queue_free()
			_pick = null
			use_canister(mode, it), 360.0, 42.0, 16))
	v.add_child(_btn("Отмена", "gray", func() -> void:
		_pick.queue_free()
		_pick = null, 360.0, 40.0, 15))
	_pick.position = (size - _pick.get_combined_minimum_size()) * 0.5


func use_canister(mode: String, it: Dictionary) -> Dictionary:
	var r: Dictionary
	match mode:
		"in":
			r = ULGarageOps.pour_to_station(it)
			_after(r, "Залито в резервуар: %s л" % ULItems._l(float(r.get("n", 0))))
		"out":
			r = ULGarageOps.fill_from_station(it)
			_after(r, "Канистра наполнена: +%s л" % ULItems._l(float(r.get("n", 0))))
		_:
			r = ULGarageOps.pour_to_car(it, cd())
			_after(r, "Залито в бак: %s л" % ULItems._l(float(r.get("n", 0))))
	w._save()
	return r


class _TankView extends Control:
	var ui
	func _draw() -> void:
		var s := size
		var body := Rect2(s.x * 0.05, s.y * 0.18, s.x * 0.9, s.y * 0.62)
		draw_rect(Rect2(body.position.x + 40, body.end.y - 4, 60, s.y * 0.14), Color(0.2, 0.18, 0.15))
		draw_rect(Rect2(body.end.x - 100, body.end.y - 4, 60, s.y * 0.14), Color(0.2, 0.18, 0.15))
		for i in 6:
			var x := body.position.x + 40 + (i % 3) * 20
			draw_rect(Rect2(x if i < 3 else body.end.x - 100 + (i - 3) * 20, body.end.y + s.y * 0.06, 10, s.y * 0.07), Color(0.85, 0.65, 0.1))
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.48, 0.22, 0.13)
		sb.set_corner_radius_all(int(body.size.y * 0.45))
		sb.border_color = Color(0.3, 0.13, 0.08)
		sb.set_border_width_all(4)
		draw_style_box(sb, body)
		for k in 5:
			var xx := body.position.x + body.size.x * (0.18 + k * 0.16)
			draw_line(Vector2(xx, body.position.y + 6), Vector2(xx, body.end.y - 6), Color(0.32, 0.15, 0.09), 2.0)
		draw_rect(Rect2(s.x * 0.42, s.y * 0.07, s.x * 0.16, s.y * 0.12), Color(0.4, 0.2, 0.12))
		var f := ThemeDB.fallback_font
		draw_string(f, Vector2(body.position.x + body.size.x * 0.22, body.position.y + body.size.y * 0.36), "ТОПЛИВО", HORIZONTAL_ALIGNMENT_LEFT, -1, 46, Color(0.93, 0.87, 0.78))
		var l := ULBase.station_fuel()
		var cap := ULBase.station_cap()
		var t := "%s / %d л" % [ULItems._l(l), int(cap)]
		var br := Rect2(body.position.x + body.size.x * 0.2, body.position.y + body.size.y * 0.52, body.size.x * 0.5, 56)
		draw_rect(br, Color(0.05, 0.05, 0.05, 0.9))
		draw_rect(br, Color(0.7, 0.7, 0.66), false, 2.0)
		draw_string(f, br.position + Vector2(16, 40), t, HORIZONTAL_ALIGNMENT_LEFT, br.size.x - 20, 32, Color(1.0, 0.85, 0.3))
		var g := Rect2(body.end.x - body.size.x * 0.16, body.position.y + 14, 34, body.size.y - 28)
		draw_rect(g, Color(0.12, 0.12, 0.12))
		var k := clampf(l / maxf(cap, 1.0), 0.0, 1.0)
		draw_rect(Rect2(g.position.x + 3, g.end.y - 3 - (g.size.y - 6) * k, g.size.x - 6, (g.size.y - 6) * k), Color(0.95, 0.75, 0.1))
		draw_rect(g, Color(0.7, 0.7, 0.66), false, 2.0)


# ---------------- «Автомобили» ----------------

func _build_cars() -> void:
	var gmax := ULBase.garage_max()
	var slots := int(ULBase.garage_lvl(gmax).get("cars", 3))
	_sel_i = clampi(_sel_i, 0, slots - 1)
	var cars := ULBase.cars()
	var row := HBoxContainer.new()
	row.alignment = BoxContainer.ALIGNMENT_CENTER
	row.add_theme_constant_override("separation", 16)
	_body.add_child(row)
	var lb := _btn("‹", "tab", func() -> void:
		_sel_i = (_sel_i - 1 + slots) % slots
		refresh(), 70.0, 64.0, 34)
	lb.name = "prev"
	row.add_child(lb)
	var tp := _card(C_GOLD)
	tp.custom_minimum_size = Vector2(440, 0)
	row.add_child(tp)
	var tv := VBoxContainer.new()
	tp.add_child(tv)
	var have := _sel_i < cars.size()
	var list: Array = ULBase.garage_cfg().get("cars", [])
	var t1 := _lbl("Машина №%d" % (_sel_i + 1), 26, Color(0.97, 0.97, 0.94))
	t1.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tv.add_child(t1)
	var nm := String(list[_sel_i].n) if have and _sel_i < list.size() else "место свободно"
	var t2 := _lbl(nm, 26, C_GOLD if have else C_DIM)
	t2.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	tv.add_child(t2)
	var rb := _btn("›", "tab", func() -> void:
		_sel_i = (_sel_i + 1) % slots
		refresh(), 70.0, 64.0, 34)
	rb.name = "next"
	row.add_child(rb)
	_car_view(_body, Vector2(900, 340), cars[_sel_i] if have else {})
	var lvl_need := 0
	for n in range(1, gmax + 1):
		if int(ULBase.garage_lvl(n).get("cars", 0)) > _sel_i:
			lvl_need = n
			break
	var b: Button
	if have and _sel_i == int(ULBase.garage().sel):
		b = _btn("Выбрана", "gray", func() -> void: pass, 360.0, 54.0, 22)
		b.disabled = true
	elif have:
		b = _btn("Выбрать", "green", func() -> void:
			if w.garage_select(_sel_i):
				say("Выбрана: Машина №%d — %s" % [_sel_i + 1, nm])
			refresh(), 360.0, 54.0, 22)
	elif ULBase.garage_level() < lvl_need:
		b = _btn("Место закрыто — нужен гараж %d/%d" % [lvl_need, gmax], "gray", func() -> void: pass, 460.0, 54.0, 18)
		b.disabled = true
	else:
		b = _btn("Новые машины появятся позже", "gray", func() -> void: pass, 460.0, 54.0, 18)
		b.disabled = true
	b.name = "select"
	var bc := CenterContainer.new()
	bc.add_child(b)
	_body.add_child(bc)


# ---------------- окно машины: боеприпасы, бак, состояние ----------------

func _build_ammo() -> void:
	var d := cd()
	var t := String(d.get("turret", ""))
	var card := _card(C_GOLD)
	_body.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	card.add_child(v)
	v.add_child(_lbl("БОЕПРИПАСЫ", 22, Color(0.97, 0.97, 0.94)))
	if t == "":
		v.add_child(_lbl("Оружейный модуль не установлен", 20, C_RED))
		v.add_child(_lbl("Турель покупается и ставится на крышу в гараже базы (компьютер модернизации).", 15, C_DIM, true))
		return
	var tc := ULCar.turret_cfg(t)
	var st: Dictionary = d.turrets[t]
	var aid := String(tc.get("ammo", ""))
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 14)
	v.add_child(h)
	h.add_child(_icon(String(tc.get("icon", "crate")), 72))
	var hv := VBoxContainer.new()
	h.add_child(hv)
	hv.add_child(_lbl("Турель: " + String(tc.n), 19, C_GOLD))
	hv.add_child(_lbl("Боеприпасы: " + String(ULItems.get_def(aid).n), 16, C_TEXT))
	hv.add_child(_lbl("Заряжено: %d / %d" % [int(st.get("ammo", 0)), int(tc.cap)], 18, C_OK))
	hv.add_child(_lbl("В инвентаре: %d" % w.inv.count(aid), 16, C_TEXT))
	h.add_child(_icon(String(ULItems.get_def(aid).get("icon", "crate")), 72))
	var b := _btn("Загрузить", "green", func() -> void:
		var r := ULGarageOps.ammo_load(w.inv, cd())
		_after(r, "Загружено: %d" % int(r.get("n", 0)))
		w._save(), 260.0, 48.0, 20)
	b.name = "load"
	b.disabled = w.inv.count(aid) <= 0 or int(st.get("ammo", 0)) >= int(tc.cap)
	v.add_child(b)
	v.add_child(_lbl("Боеприпасы для транспорта продаёт оружейник (раздел «Боеприпасы для транспорта»).", 14, C_DIM, true))


func _build_tank() -> void:
	var d := cd()
	var card := _card(C_GOLD)
	_body.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 8)
	card.add_child(v)
	v.add_child(_lbl("БАК", 22, Color(0.97, 0.97, 0.94)))
	var f := float(d.get("fuel", 0.0))
	var tk := ULCar.c("fuel_tank", 60.0)
	v.add_child(_lbl("Бензин: %s / %d л" % [ULItems._l(f), int(tk)], 20, C_GOLD))
	var bar := ProgressBar.new()
	bar.max_value = tk
	bar.value = f
	bar.show_percentage = false
	bar.custom_minimum_size = Vector2(500, 22)
	v.add_child(bar)
	var cans := ULGarageOps.canisters(w.inv)
	if cans.is_empty():
		v.add_child(_lbl("Канистр с бензином нет. Их продаёт барахольщик; наполнить — в гараже (топливная станция).", 15, C_DIM, true))
	for c in cans:
		var it: Dictionary = c.it
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 10)
		v.add_child(row)
		row.add_child(_icon("canister_e" if ULItems.empty_can(it) else "canister", 36))
		row.add_child(_lbl(ULItems.title(it), 17, C_TEXT))
		var b := _btn("Залить в бак", "green", func() -> void: use_canister("car", it), 200.0, 40.0, 16)
		b.name = "pour"
		b.disabled = ULGarageOps.fuel_of(it) <= 0.0 or f >= tk - 0.01
		row.add_child(b)


func _build_state() -> void:
	var d := cd()
	var card := _card()
	_body.add_child(card)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 6)
	card.add_child(v)
	v.add_child(_lbl("СОСТОЯНИЕ ДЕТАЛЕЙ", 22, Color(0.97, 0.97, 0.94)))
	for k in ULCar.PARTS:
		var hv := ULGarageOps.part_hp(d, k)
		var lv := ULCar.lvl_cfg(k, ULGarageOps.lvl(d, k))
		var t := "%s — %s (ур. %d)" % [String(ULCar.part_cfg(k).n), String(lv.get("n", "")), ULGarageOps.lvl(d, k)]
		if hv.y > 0.0:
			t += ": %d / %d" % [int(round(hv.x)), int(hv.y)]
		v.add_child(_lbl(t, 17, C_RED if hv.y > 0.0 and hv.x < hv.y * 0.3 else C_TEXT))
	var tt := String(d.get("turret", ""))
	if tt != "":
		var st: Dictionary = d.turrets[tt]
		v.add_child(_lbl("Турель — %s: %d / %d, боезапас %d" % [String(ULCar.turret_cfg(tt).n), int(round(float(st.get("hp", 0)))), int(ULCar.turret_cfg(tt).hp), int(st.get("ammo", 0))], 17, C_TEXT))
	v.add_child(_lbl("Ремонт и замена деталей — в гараже базы, у компьютера модернизации.", 15, C_DIM, true))
