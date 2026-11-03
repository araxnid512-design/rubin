class_name WindowFactory
extends RefCounted
## Окна интерфейса. Каждое окно — полноэкранная подложка + панель с заголовком.

const L = preload("res://scripts/world/layout.gd")

static func create(kind: String, data: Variant, hud: Node) -> Control:
	match kind:
		"inventory": return inventory(hud)
		"loot": return loot(hud, data)
		"map": return map_window(hud)
		"squad": return squad(hud)
		"soldier": return soldier(hud, data)
		"build": return build_menu(hud)
		"building": return building(hud, String(data))
		"journal": return journal(hud)
		"pause": return pause_menu(hud)
		"settings": return settings(hud, data)
		"saveload": return saveload(hud, data)
		"dialog": return dialog(hud, String(data))
		"death": return death(hud)
		"exit": return exit_window(hud, data)
		"radio": return radio(hud)
		"expedition": return expedition(hud)
	return null

static func frame(title: String, hud: Node, w: float = 1500.0, h: float = 900.0, closable: bool = true) -> Array:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_STOP
	root.process_mode = Node.PROCESS_MODE_ALWAYS
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	var p := UI.panel(Color(0.08, 0.08, 0.08, 0.97))
	p.custom_minimum_size = Vector2(w, h)
	UI.place(p, Control.PRESET_CENTER, Vector2(-w * 0.5, -h * 0.5), Vector2(w, h))
	root.add_child(p)
	var v := UI.vbox(10)
	p.add_child(v)
	var head := UI.hbox()
	v.add_child(head)
	head.add_child(UI.label(title, 34, UI.RED_L))
	head.add_child(UI.expand(UI.spacer()))
	if closable:
		head.add_child(UI.button("✕", func(): hud.close_window(), 30, 80, 64))
	var sep := ColorRect.new()
	sep.color = Color(0.5, 0.1, 0.08)
	sep.custom_minimum_size = Vector2(0, 3)
	v.add_child(sep)
	var body := UI.vbox(10)
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	v.add_child(body)
	return [root, body]

static func scroll(content: Control) -> ScrollContainer:
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	content.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.add_child(content)
	return sc

# ======================================================================
#   ИНВЕНТАРЬ
# ======================================================================
static func inventory(hud: Node) -> Control:
	var f := frame("Инвентарь генерала", hud)
	var body: VBoxContainer = f[1]
	var state := {"sel": -1}
	var row := UI.hbox(20)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(row)
	var left := UI.vbox(10)
	row.add_child(left)
	var right := UI.vbox(10)
	right.custom_minimum_size = Vector2(560, 0)
	row.add_child(UI.expand(right))
	var refresh := func(): pass
	refresh = func():
		UI.clear(left)
		UI.clear(right)
		# экипировка
		left.add_child(UI.label("Снаряжение", 26, UI.WARN))
		var eq := UI.hbox()
		left.add_child(eq)
		for s in ["primary", "pistol"]:
			var e = Game.equip.get(s)
			var t := ("Основное: " if s == "primary" else "Пистолет: ") + ("—" if e == null else "%s (%d)" % [ItemDB.weapon(String(e.id)).name, int(e.ammo)])
			eq.add_child(UI.button(t, func():
				if e != null:
					var left_n := Game.inv.add(String(e.id), 1, {"ammo": int(e.ammo)})
					if left_n == 0:
						Game.equip[s] = null
						if Game.player:
							(Game.player as Player)._sync_weapon()
						Events.equipment_changed.emit()
				refresh.call(), 22, 330, 64))
		left.add_child(UI.label("Броня: %s · Разгрузка (4 быстрых слота) · Рюкзак (16 ячеек)" % ItemDB.item_name(String(Game.player_state.get("armor", "armor_duty"))), 22, UI.DIM))
		left.add_child(UI.label("Рюкзак  (%d/%d)" % [Game.inv.capacity - Game.inv.free_slots(), Game.inv.capacity], 26, UI.WARN))
		var grid := GridContainer.new()
		grid.columns = 4
		grid.add_theme_constant_override("h_separation", 8)
		grid.add_theme_constant_override("v_separation", 8)
		left.add_child(grid)
		for i in Game.inv.capacity:
			var s = Game.inv.slots[i]
			var t := "" if s == null else "%s\n×%d" % [HUD._short(ItemDB.item_name(String(s.id))), int(s.n)]
			var b := UI.button(t, func():
				state.sel = i
				refresh.call(), 20, 190, 100)
			if s != null:
				var c: Color = ItemDB.get_item(String(s.id)).get("color", Color.GRAY)
				b.add_theme_stylebox_override("normal", UI.sb(Color(c.r * 0.35, c.g * 0.35, c.b * 0.35, 0.95), UI.RED_L if i == state.sel else Color(0.35, 0.33, 0.3), 3 if i == state.sel else 2, 6, 8))
			grid.add_child(b)
		# детали
		var sel = Game.inv.slots[state.sel] if state.sel >= 0 and state.sel < Game.inv.capacity else null
		if sel == null:
			right.add_child(UI.label("Выберите предмет.", 26, UI.DIM))
			right.add_child(UI.label("Быстрые слоты: %s" % ", ".join(Game.quick.map(func(q): return "—" if q == "" else ItemDB.item_name(q))), 22, UI.FG, true))
			right.add_child(UI.label("Ресурсы сдаются на склад через панель основного склада. Ремонт тратит материалы со склада и из рюкзака.", 22, UI.DIM, true))
			return
		var id := String(sel.id)
		var it := ItemDB.get_item(id)
		right.add_child(UI.label(String(it.name), 30, UI.FG))
		right.add_child(UI.label(String(it.get("desc", "")), 22, UI.DIM, true))
		right.add_child(UI.label("Количество: %d · Вес: %.2f кг" % [int(sel.n), float(it.get("weight", 0.0)) * int(sel.n)], 22))
		if it.cat in [ItemDB.Cat.MED, ItemDB.Cat.FOOD]:
			right.add_child(UI.button("Использовать", func():
				if Game.player:
					(Game.player as Player).use_item(id)
				hud.close_window(), 26, 0, 72))
			var qrow := UI.hbox()
			right.add_child(qrow)
			for q in 4:
				qrow.add_child(UI.button("В слот %d" % (q + 1), func():
					Game.quick[q] = id
					Events.inventory_changed.emit()
					refresh.call(), 22, 120, 64))
		if ItemDB.is_weapon(id):
			right.add_child(UI.button("Взять в руки", func():
				var slot := "pistol" if ItemDB.weapon_slot(id) == 1 else "primary"
				var cur = Game.equip.get(slot)
				var ammo := int(sel.get("ammo", 0))
				Game.inv.take_slot(state.sel)
				if cur != null:
					Game.inv.add(String(cur.id), 1, {"ammo": int(cur.ammo)})
				Game.equip[slot] = {"id": id, "ammo": ammo}
				if Game.player:
					(Game.player as Player).active_slot = 0 if slot == "primary" else 1
					(Game.player as Player)._sync_weapon()
				Events.equipment_changed.emit()
				state.sel = -1
				refresh.call(), 26, 0, 72))
		right.add_child(UI.button("Выбросить", func():
			Game.inv.take_slot(state.sel)
			Events.inventory_changed.emit()
			state.sel = -1
			refresh.call(), 22, 0, 64))
	refresh.call()
	return f[0]

# ======================================================================
#   ОБЫСК КОНТЕЙНЕРА
# ======================================================================
static func loot(hud: Node, c: Variant) -> Control:
	var lc := c as LootContainer
	var f := frame(lc.title, hud, 1200, 760)
	var body: VBoxContainer = f[1]
	var list := UI.vbox(8)
	var refresh := func(): pass
	refresh = func():
		UI.clear(list)
		if lc.items.is_empty():
			list.add_child(UI.label("Пусто.", 28, UI.DIM))
		for id in lc.items.keys():
			var r := UI.hbox()
			r.add_child(UI.expand(UI.label("%s ×%d" % [ItemDB.item_name(id), int(lc.items[id])], 28)))
			r.add_child(UI.button("Взять", func():
				var n := lc.take(id, int(lc.items.get(id, 0)))
				if n <= 0:
					Events.msg("Нет места в рюкзаке.", Events.Msg.ALERT)
				else:
					Sfx.play("pickup")
				refresh.call(), 26, 200, 70))
			list.add_child(r)
		list.add_child(UI.label("Свободно ячеек в рюкзаке: %d" % Game.inv.free_slots(), 22, UI.DIM))
	body.add_child(scroll(list))
	var row := UI.hbox()
	body.add_child(row)
	row.add_child(UI.expand(UI.button("Взять всё", func():
		if lc.take_all() > 0:
			Sfx.play("pickup")
		refresh.call()
		if lc.items.is_empty():
			hud.close_window(), 30, 0, 84)))
	refresh.call()
	return f[0]

# ======================================================================
#   КАРТА
# ======================================================================
static func map_window(hud: Node) -> Control:
	var f := frame("Карта: база «Долга» (300 × 300 м)", hud, 1700, 1000)
	var body: VBoxContainer = f[1]
	var row := UI.hbox(16)
	row.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_child(row)
	var mv := MapView.new()
	mv.follow = false
	mv.meters = 300.0
	mv.center = Vector3.ZERO
	mv.show_labels = true
	mv.custom_minimum_size = Vector2(840, 840)
	row.add_child(mv)
	var side := UI.vbox(8)
	row.add_child(UI.expand(side))
	var info := UI.label("Нажмите на здание, чтобы увидеть сведения.", 24, UI.DIM, true)
	side.add_child(UI.label("Обозначения", 28, UI.WARN))
	for l in [["■ разрушено", Color(0.75, 0.25, 0.2)], ["■ идут работы", Color(0.9, 0.7, 0.25)], ["■ работает", Color(0.65, 0.7, 0.65)], ["■ улучшено", Color(0.45, 0.8, 0.45)],
			["▲ генерал", Color.WHITE], ["● бойцы «Долга»", Color(0.3, 0.9, 0.4)], ["● противник рядом", Color(0.95, 0.25, 0.2)], ["◆ цель задания", Color(1, 0.82, 0.2)],
			["● выход с локации", Color(0.4, 0.65, 1.0)], ["○ аномалии / радиация", Color(0.6, 0.8, 1.0)], ["▬ проломы в стене", Color(0.8, 0.3, 0.2)]]:
		side.add_child(UI.label(l[0], 22, l[1]))
	side.add_child(UI.spacer(0, 10))
	side.add_child(info)
	var open_btn := UI.button("Открыть панель здания", func(): pass, 24, 0, 68)
	open_btn.visible = false
	side.add_child(open_btn)
	mv.gui_input.connect(func(e):
		if TouchInput.is_press(e) or (e is InputEventMouseButton and (e as InputEventMouseButton).pressed):
			var w := mv.m2w((e as InputEvent).position if e is InputEventMouseButton else TouchInput.pos(e) - mv.global_position)
			for d in L.BUILDINGS:
				var p: Vector2 = d.pos
				var s: Vector2 = d.size
				if absf(w.x - p.x) < s.x * 0.5 + 2.0 and absf(w.z - p.y) < s.y * 0.5 + 2.0:
					mv.selected = d.id
					var lvl := Game.building_level(d.id)
					info.text = "%s\nСостояние: %s\n%s\n%s" % [d.name, ["разрушено", "работает", "улучшено"][lvl] + (" (идут работы)" if Game.building_job(d.id) != "" else ""), d.desc, d.effect]
					open_btn.visible = true
					for c in open_btn.pressed.get_connections():
						open_btn.pressed.disconnect(c.callable)
					open_btn.pressed.connect(func(): hud.open("building", d.id))
					return)
	return f[0]

# ======================================================================
#   ОТРЯД
# ======================================================================
static func squad(hud: Node) -> Control:
	var f := frame("Управление бойцами", hud, 1760, 980)
	var body: VBoxContainer = f[1]
	var sel := {}
	var list := UI.vbox(8)
	var refresh := func(): pass
	refresh = func():
		UI.clear(list)
		if Game.world == null:
			return
		for s in Game.world.soldiers.values():
			var so := s as Soldier
			var r := UI.hbox(12)
			var cb := UI.toggle("", sel.get(so.sid, false), func(v): sel[so.sid] = v, 30, 76, 76)
			cb.disabled = not so.alive
			r.add_child(cb)
			var info := UI.vbox(2)
			info.custom_minimum_size = Vector2(520, 0)
			info.add_child(UI.label("%s «%s»" % [so.def.name, so.def.call], 24, UI.FG if so.alive else UI.DIM))
			info.add_child(UI.label("%s · %s" % [so.role_name(), so.def.duty], 18, UI.DIM, true))
			r.add_child(info)
			var hpv := UI.vbox(2)
			hpv.custom_minimum_size = Vector2(200, 0)
			var hb := UI.bar(Color(0.75, 0.12, 0.1), 20)
			hb.value = so.hp / so.max_hp * 100.0
			hpv.add_child(hb)
			hpv.add_child(UI.label("Здоровье %d" % int(so.hp) if so.alive else "ПОГИБ", 18))
			r.add_child(hpv)
			var w := ItemDB.weapon(so.weapon_id)
			r.add_child(UI.label("%s\n%d / %d патр." % [w.get("name", "—"), so.mag, so.reserve], 20))
			var ol := UI.label("%s\n%s" % [so.order_name(), so.status_text()], 20, UI.WARN)
			ol.custom_minimum_size = Vector2(300, 0)
			r.add_child(ol)
			r.add_child(UI.button("Подробнее", func(): hud.open("soldier", so), 20, 160, 60))
			list.add_child(r)
	body.add_child(scroll(list))
	body.add_child(UI.label("Отметьте бойцов и выберите приказ. Формирование боевых отрядов — на следующих этапах.", 20, UI.DIM))
	var orders := UI.hbox(8)
	body.add_child(orders)
	var all := UI.button("Все", func():
		for s in Game.world.soldiers.values():
			sel[(s as Soldier).sid] = (s as Soldier).alive
		refresh.call(), 22, 100, 70)
	orders.add_child(all)
	for o in ["follow", "guard", "patrol", "repair", "heal", "defend", "barracks", "idle"]:
		orders.add_child(UI.button(Soldier.ORDER_NAMES[o].replace(" ", "\n").replace("\nза\nмной", " за мной").replace("Охранять\nпозицию", "Охранять\nпозицию"), func():
			var n := 0
			for s in Game.world.soldiers.values():
				var so := s as Soldier
				if sel.get(so.sid, false) and so.alive:
					if o == "heal" and so.role != "medic":
						continue
					so.give_order(o)
					n += 1
			if n == 0:
				Events.msg("Не выбраны бойцы" + (" (лечить может только медик)" if o == "heal" else "") + ".", Events.Msg.ALERT)
			refresh.call(), 18, 160, 80))
	refresh.call()
	return f[0]

static func soldier(hud: Node, data: Variant) -> Control:
	var so := data as Soldier
	var f := frame("%s «%s»" % [so.def.name, so.def.call], hud, 1300, 860)
	var body: VBoxContainer = f[1]
	body.add_child(UI.label("%s. %s" % [so.role_name(), so.def.duty], 24, UI.DIM, true))
	var w := ItemDB.weapon(so.weapon_id)
	body.add_child(UI.label("Здоровье: %d/%d · Оружие: %s · Патроны: %d в магазине, %d в запасе · Подготовка: %.1f" % [int(so.hp), int(so.max_hp), w.get("name", "—"), so.mag, so.reserve, so.skill], 24))
	body.add_child(UI.label("Текущий приказ: %s (%s)" % [so.order_name(), so.status_text()], 24, UI.WARN))
	var lines := {"officer": "«Периметр дырявый, товарищ генерал. Без охраны на КПП долго не продержимся.»",
		"rifleman": "«Патронов бы побольше. С тридцатью в магазине много не навоюешь.»",
		"gunner": "«Плечо зацепило, но ПКМ держу. Ленты пустые — нужны 7,62.»",
		"sniper": "«С вышки обзор лучше. Если починить — буду держать северный сектор.»",
		"medic": "«Медикаменты на исходе. Восстановим медпункт — подниму раненых быстрее.»",
		"tech": "«Генератор живой, проводку перекинуть — и будет свет. Дайте инструменты.»"}
	body.add_child(UI.label(lines.get(so.role, ""), 24, UI.FG, true))
	var grid := GridContainer.new()
	grid.columns = 4
	grid.add_theme_constant_override("h_separation", 10)
	grid.add_theme_constant_override("v_separation", 10)
	body.add_child(grid)
	for o in ["follow", "guard", "patrol", "repair", "heal", "defend", "barracks", "idle"]:
		var b := UI.button(Soldier.ORDER_NAMES[o], func():
			so.give_order(o)
			hud.close_window(), 22, 290, 80)
		b.disabled = not so.alive or (o == "heal" and so.role != "medic")
		grid.add_child(b)
	return f[0]

# ======================================================================
#   МЕНЮ СТРОИТЕЛЬСТВА
# ======================================================================
static func build_menu(hud: Node) -> Control:
	var f := frame("Восстановление базы", hud, 1700, 980)
	var body: VBoxContainer = f[1]
	var list := UI.vbox(8)
	for d in L.BUILDINGS:
		var r := UI.hbox(12)
		var lvl := Game.building_level(d.id)
		var job := Game.building_job(d.id)
		var st: String = ["Разрушено", "Работает", "Улучшено"][lvl]
		var col: Color = [Color(0.95, 0.4, 0.3), UI.FG, UI.GOOD][lvl]
		if job != "":
			st = "%s %d%%" % ["Ремонт" if job == "repair" else "Улучшение", int(Game.building_progress(d.id) / Game.building_work_needed(d.id) * 100.0)]
			col = UI.WARN
		var nl := UI.label(String(d.name), 26)
		nl.custom_minimum_size = Vector2(380, 0)
		r.add_child(nl)
		var sl := UI.label(st, 24, col)
		sl.custom_minimum_size = Vector2(230, 0)
		r.add_child(sl)
		var cost := Game.next_cost(d.id)
		var ct := "" if cost.is_empty() or job != "" else ("Ремонт: " if lvl == 0 else "Улучшение: ") + UI.cost_text(cost).replace("\n", ", ")
		r.add_child(UI.expand(UI.label(ct, 18, UI.DIM, true)))
		r.add_child(UI.button("Панель", func(): hud.open("building", d.id), 22, 150, 64))
		list.add_child(r)
	body.add_child(scroll(list))
	body.add_child(UI.label("Ресурсы на складе: %s" % _wh_summary(), 20, UI.DIM, true))
	return f[0]

static func _wh_summary() -> String:
	var parts: Array = []
	for id in ItemDB.RESOURCES:
		parts.append("%s %d" % [ItemDB.item_name(id), Game.warehouse_count(id)])
	return ", ".join(parts) + "  (%d/%d)" % [Game.warehouse_total(), Game.warehouse_capacity()]

# ======================================================================
#   ПАНЕЛЬ ЗДАНИЯ
# ======================================================================
static func building(hud: Node, id: String) -> Control:
	var d := Game.building_def(id)
	var f := frame("Панель: " + String(d.name), hud, 1640, 980)
	var body: VBoxContainer = f[1]
	var content := UI.vbox(10)
	body.add_child(scroll(content))
	var refresh := func(): pass
	refresh = func():
		UI.clear(content)
		var lvl := Game.building_level(id)
		var job := Game.building_job(id)
		var row := UI.hbox(24)
		content.add_child(row)
		var left := UI.vbox(8)
		left.custom_minimum_size = Vector2(760, 0)
		row.add_child(left)
		var right := UI.vbox(8)
		row.add_child(UI.expand(right))
		left.add_child(UI.label(String(d.desc), 24, UI.FG, true))
		var st: String = ["Разрушено (≈70% повреждений)", "Работает", "Улучшено"][lvl]
		left.add_child(UI.label("Состояние: " + st, 26, [Color(0.95, 0.4, 0.3), UI.FG, UI.GOOD][lvl]))
		left.add_child(UI.label("Даёт: " + String(d.effect), 22, UI.DIM, true))
		if job != "":
			var pb := UI.bar(UI.WARN, 26)
			pb.value = Game.building_progress(id) / Game.building_work_needed(id) * 100.0
			left.add_child(UI.label("%s: %d%%" % ["Идёт ремонт" if job == "repair" else "Идёт улучшение", int(pb.value)], 24, UI.WARN))
			left.add_child(pb)
			left.add_child(UI.label("Работы ведут назначенные бойцы. Генерал может помогать: удерживать «Действие» у входа в здание.", 20, UI.DIM, true))
			var techs := UI.hbox()
			left.add_child(techs)
			techs.add_child(UI.button("Назначить техника", func():
				_assign_repair(id, true)
				refresh.call(), 22, 0, 70))
			techs.add_child(UI.button("Назначить всех свободных", func():
				_assign_repair(id, false)
				refresh.call(), 22, 0, 70))
		elif lvl < 2:
			var cost := Game.next_cost(id)
			left.add_child(UI.label(("Восстановление" if lvl == 0 else "Улучшение") + " — нужно:", 24, UI.WARN))
			left.add_child(UI.label(UI.cost_text(cost), 22))
			left.add_child(UI.label("Работа: %d чел.-сек." % int(d.get("repair_work" if lvl == 0 else "upgrade_work", 30.0)), 20, UI.DIM))
			var why := Game.can_start_job(id)
			var b := UI.button(("Начать восстановление" if lvl == 0 else "Начать улучшение"), func():
				if Game.start_job(id):
					_assign_repair(id, true)
				refresh.call(), 26, 0, 80)
			b.disabled = why != ""
			left.add_child(b)
			if why != "":
				left.add_child(UI.label(why, 22, Color(1.0, 0.5, 0.4), true))
		_specific(id, lvl, right, hud, refresh)
	refresh.call()
	return f[0]

static func _assign_repair(id: String, only_tech: bool) -> void:
	if Game.world == null:
		return
	var n := 0
	for s in Game.world.soldiers.values():
		var so := s as Soldier
		if not so.alive:
			continue
		if only_tech and so.role != "tech":
			continue
		if not only_tech and so.order not in ["idle", "follow", "barracks"]:
			continue
		so.give_order("repair", id)
		n += 1
	if n > 0:
		Events.msg("Назначено на ремонт: %d" % n, Events.Msg.INFO)
	elif only_tech:
		Events.msg("Техник недоступен.", Events.Msg.ALERT)

static func _specific(id: String, lvl: int, box: VBoxContainer, hud: Node, refresh: Callable) -> void:
	match Game.building_def(id).kind:
		"hq":
			var alive := 0
			for s in Game.soldiers.values():
				if s.get("alive", true):
					alive += 1
			box.add_child(UI.label("Сводка по базе", 28, UI.WARN))
			box.add_child(UI.label("Личный состав: %d (вместимость %d)\nЭлектропитание: %s (топливо %.0f ч)\nСклад: %d/%d\n%s" % [alive + 1, Game.soldier_capacity(), "есть" if Game.power_on else "нет", Game.generator_fuel, Game.warehouse_total(), Game.warehouse_capacity(), Game.time_string()], 22, UI.FG, true))
			var eb := UI.button("Подготовка экспедиции", func(): hud.open("expedition", null), 26, 0, 80)
			eb.disabled = not Game.flags.get("expedition_unlocked", false)
			box.add_child(eb)
			if eb.disabled:
				box.add_child(UI.label("Станет доступно после получения сигнала выживших (радиоцентр).", 20, UI.DIM, true))
		"warehouse":
			box.add_child(UI.label("Запасы базы (%d/%d)" % [Game.warehouse_total(), Game.warehouse_capacity()], 28, UI.WARN))
			box.add_child(UI.button("Сдать все ресурсы на склад", func():
				var moved := Game.deposit_resources()
				if moved.is_empty():
					Events.msg("В рюкзаке нет ресурсов.", Events.Msg.INFO)
				else:
					Game.set_flag("deposited")
					Events.msg("Сдано на склад: " + ", ".join(moved.keys().map(func(k): return "%s ×%d" % [ItemDB.item_name(k), moved[k]])), Events.Msg.GOOD)
				refresh.call(), 26, 0, 80))
			for k in Game.warehouse.keys():
				var r := UI.hbox()
				r.add_child(UI.expand(UI.label("%s: %d" % [ItemDB.item_name(k), Game.warehouse_count(k)], 22)))
				r.add_child(UI.button("Взять 1", func():
					if Game.warehouse_remove(k, 1) > 0:
						var left := Game.give_player(k, 1)
						if left > 0:
							Game.warehouse_add(k, left)
					refresh.call(), 20, 130, 56))
				box.add_child(r)
		"generator":
			box.add_child(UI.label("Генератор", 28, UI.WARN))
			box.add_child(UI.label("Топливо: %.0f ч работы · Питание: %s" % [Game.generator_fuel, "ВКЛ" if Game.power_on else "ВЫКЛ"], 24))
			var fb := UI.button("Заправить (1 канистра = 8 ч)", func():
				if Game.refuel_generator(1) == 0:
					Events.msg("Нет топлива. Ищите канистры: гараж, грузовики у дороги, лагерь мародёров.", Events.Msg.ALERT)
				refresh.call(), 24, 0, 76)
			fb.disabled = lvl < 1
			box.add_child(fb)
			var sw := UI.button("Выключить генератор" if Game.flags.get("gen_switch", true) else "Включить генератор", func():
				Game.flags["gen_switch"] = not Game.flags.get("gen_switch", true)
				Game.update_power()
				refresh.call(), 24, 0, 70)
			sw.disabled = lvl < 1
			box.add_child(sw)
			if lvl < 1:
				box.add_child(UI.label("Сначала восстановите генераторную.", 22, Color(1.0, 0.5, 0.4)))
		"radio":
			box.add_child(UI.label("Радиостанция", 28, UI.WARN))
			var ok := lvl >= 1 and Game.power_on
			box.add_child(UI.label("Требуется: восстановленный радиоцентр и электропитание.\nПитание: %s" % ("есть" if Game.power_on else "нет"), 22, UI.FG if ok else Color(1.0, 0.5, 0.4), true))
			var rb := UI.button("Поиск сигнала выживших", func(): hud.open("radio", null), 26, 0, 80)
			rb.disabled = not ok
			box.add_child(rb)
			for e in Quest.log:
				box.add_child(UI.label("%s: %s" % [e.time, e.text], 20, Color(0.55, 0.85, 1.0), true))
		"armory":
			_armory(box, refresh)
		"medpoint":
			box.add_child(UI.label("Медицинская помощь", 28, UI.WARN))
			box.add_child(UI.button("Лечение генерала (1 медикамент)", func():
				if Game.consume({"medicine": 1}):
					if Game.player:
						(Game.player as Player).heal(100.0 if lvl >= 1 else 40.0)
					Events.msg("Генерал получил медицинскую помощь.", Events.Msg.GOOD)
				else:
					Events.msg("Нет медикаментов.", Events.Msg.ALERT)
				refresh.call(), 24, 0, 74))
			var bb := UI.button("Изготовить бинты (1 медикамент → 3 бинта)", func():
				if Game.consume({"medicine": 1}):
					Game.give_player("bandage", 3)
					Events.msg("+3 бинта", Events.Msg.GOOD)
				refresh.call(), 22, 0, 70)
			bb.disabled = lvl < 1
			box.add_child(bb)
		"workshop":
			box.add_child(UI.label("Мастерская", 28, UI.WARN))
			var b1 := UI.button("Оружейные детали (металлолом ×6)", func():
				if Game.consume({"scrap": 6}):
					Game.warehouse_add("weapon_parts", 1)
					Events.msg("+1 оружейная деталь (на склад)", Events.Msg.GOOD)
				refresh.call(), 22, 0, 70)
			b1.disabled = lvl < 1
			box.add_child(b1)
			for am in [["ammo_545", 30], ["ammo_9x18", 30], ["ammo_762r", 20]]:
				var b2 := UI.button("Снарядить: %s ×%d (деталь + металлолом ×2)" % [ItemDB.item_name(am[0]), am[1]], func():
					if Game.consume({"weapon_parts": 1, "scrap": 2}):
						Game.warehouse_add(am[0], am[1])
						Events.msg("+%d %s (на склад)" % [am[1], ItemDB.item_name(am[0])], Events.Msg.GOOD)
					refresh.call(), 20, 0, 66)
				b2.disabled = lvl < 1
				box.add_child(b2)
			if lvl < 1:
				box.add_child(UI.label("Станки не работают — нужен ремонт мастерской.", 22, Color(1.0, 0.5, 0.4)))
		"barracks":
			box.add_child(UI.label("Личный состав", 28, UI.WARN))
			box.add_child(UI.label("Вместимость: %d. Бойцы в казарме восстанавливают здоровье%s." % [Game.soldier_capacity(), " быстрее" if lvl >= 1 else ""], 22, UI.FG, true))
			box.add_child(UI.button("Отправить раненых отдыхать", func():
				for s in Game.world.soldiers.values():
					var so := s as Soldier
					if so.alive and so.hp < so.max_hp * 0.8:
						so.give_order("barracks")
				refresh.call(), 22, 0, 70))
			box.add_child(UI.label("Набор новых бойцов откроется после связи с выжившими отрядами.", 20, UI.DIM, true))
		"training":
			box.add_child(UI.label("Подготовка бойцов", 28, UI.WARN))
			for s in Game.world.soldiers.values():
				var so := s as Soldier
				if not so.alive:
					continue
				var tb := UI.button("Тренировать: %s (провизия ×2) — меткость %.1f" % [so.def.call, so.skill], func():
					if Game.consume({"provisions": 2}):
						so.skill = minf(2.0, so.skill + 0.15)
						so.accuracy = 1.3 / so.skill
						so.write_state()
						Events.msg("%s: подготовка повышена." % so.def.call, Events.Msg.GOOD)
					refresh.call(), 20, 0, 64)
				tb.disabled = lvl < 1
				box.add_child(tb)
		"kpp":
			box.add_child(UI.label("Оборона КПП", 28, UI.WARN))
			box.add_child(UI.label("Вооружённая охрана на постах: %d" % Quest.kpp_guards(), 24))
			box.add_child(UI.label("Назначение охраны и выдача патронов — в панели оружейной.", 20, UI.DIM, true))
		"garage":
			box.add_child(UI.label("Гараж", 28, UI.WARN))
			box.add_child(UI.label("Вся техника потеряна при нападении. Восстановление машин — на следующих этапах.", 22, UI.DIM, true))
		"tower":
			box.add_child(UI.label("Пост наблюдения", 28, UI.WARN))
			box.add_child(UI.button("Назначить снайпера на пост", func():
				if Game.world.soldiers.has("s_sniper"):
					var b: Building = Game.world.buildings[id]
					(Game.world.soldiers.s_sniper as Soldier).give_order("guard", b.work_point())
				refresh.call(), 22, 0, 70))

static func _armory(box: VBoxContainer, refresh: Callable) -> void:
	box.add_child(UI.label("Снабжение бойцов", 28, UI.WARN))
	var opened: bool = Game.world_state.rubble.has("armory")
	if not opened:
		box.add_child(UI.label("Вход завален. Разберите завал, чтобы получить доступ.", 22, Color(1.0, 0.5, 0.4), true))
		return
	box.add_child(UI.label("Патроны берутся со склада и из рюкзака генерала. Оружие из рюкзака можно выдать бойцу.", 20, UI.DIM, true))
	for s in Game.world.soldiers.values():
		var so := s as Soldier
		if not so.alive:
			continue
		var w := ItemDB.weapon(so.weapon_id)
		var r := UI.vbox(4)
		r.add_child(UI.label("%s — %s, %d/%d патр.%s" % [so.def.call, w.get("name", "—"), so.mag, so.reserve, " · снабжён" if so.supplied else ""], 22, UI.GOOD if so.supplied else UI.FG))
		var h := UI.hbox()
		r.add_child(h)
		h.add_child(UI.button("Выдать патроны", func():
			var ammo := String(w.get("ammo", ""))
			var need := int(w.get("mag", 30)) * 3 - so.reserve
			var have := Game.total_count(ammo)
			var give := mini(need, have)
			if give > 0 and Game.consume({ammo: give}):
				so.reserve += give
				so.supplied = true
				so.write_state()
				Events.msg("%s получил %d патр. (%s)" % [so.def.call, give, ItemDB.item_name(ammo)], Events.Msg.GOOD)
			elif need <= 0:
				so.supplied = true
				Events.msg("%s: боезапас полный." % so.def.call, Events.Msg.INFO)
			else:
				Events.msg("Нет патронов %s." % ItemDB.item_name(ammo), Events.Msg.ALERT)
			refresh.call(), 20, 0, 60))
		h.add_child(UI.button("Выдать оружие из рюкзака", func():
			for i in Game.inv.capacity:
				var sl = Game.inv.slots[i]
				if sl != null and ItemDB.is_weapon(String(sl.id)) and ItemDB.weapon(String(sl.id)).hold != "pistol":
					Game.inv.take_slot(i)
					var old := so.weapon_id
					so.weapon_id = String(sl.id)
					so.mag = int(sl.get("ammo", 0))
					so.reserve = 0
					(so.rig as HumanRig).set_weapon(so.weapon_id)
					if old != "":
						Game.inv.add(old, 1, {"ammo": 0})
					so.write_state()
					Events.msg("%s получил %s." % [so.def.call, ItemDB.weapon(so.weapon_id).name], Events.Msg.GOOD)
					break
			refresh.call(), 20, 0, 60))
		h.add_child(UI.button("На охрану КПП", func():
			so.give_order("defend", Vector3(0, 0, 76))
			if not L.KPP_ZONE.has_point(Vector2((so.order_target as Vector3).x, (so.order_target as Vector3).z)):
				so.give_order("guard", Vector3(randf_range(-3, 3), 0, 75))
			Events.msg("%s назначен на охрану КПП%s." % [so.def.call, "" if so.supplied else " (без пополнения патронов!)"], Events.Msg.INFO)
			refresh.call(), 20, 0, 60))
		box.add_child(r)

# ======================================================================
#   ЖУРНАЛ
# ======================================================================
static func journal(hud: Node) -> Control:
	var f := frame("Журнал заданий", hud, 1500, 940)
	var body: VBoxContainer = f[1]
	var list := UI.vbox(8)
	list.add_child(UI.label("«Возрождение Долга»", 30, UI.WARN))
	list.add_child(UI.label("Генерал прибывает на разрушенную базу, встречает оставшихся бойцов и восстанавливает свет и связь, чтобы найти выживших.", 22, UI.DIM, true))
	for i in Quest.STAGES.size():
		var stg: Dictionary = Quest.STAGES[i]
		if i > Quest.stage and not Quest.finished:
			list.add_child(UI.label("•  …", 22, UI.DIM))
			break
		var done := i < Quest.stage or Quest.finished
		list.add_child(UI.label(("✓ " if done else "▶ ") + String(stg.title), 26, UI.GOOD if done else UI.FG))
		if not done:
			for o in Quest.objectives():
				list.add_child(UI.label("      " + ("✓ " if o.done else "• ") + String(o.text), 22, UI.GOOD if o.done else UI.FG, true))
	if not Quest.log.is_empty():
		list.add_child(UI.spacer(0, 10))
		list.add_child(UI.label("Записи", 28, UI.WARN))
		for e in Quest.log:
			list.add_child(UI.label("%s — %s" % [e.time, e.text], 22, Color(0.6, 0.85, 1.0), true))
	list.add_child(UI.spacer(0, 10))
	list.add_child(UI.label("Управление (ПК): WASD — движение, Shift — бег, ЛКМ — огонь, ПКМ — прицел, R — перезарядка, E — действие (удерживать для разбора/ремонта), 1/2 — оружие, 3–6 — быстрые слоты, V — осмотр оружия, I — инвентарь, M — карта, O — отряд, B — стройка, J — журнал, F5/F9 — быстрое сохранение/загрузка, F3 — производительность, колесо — масштаб.", 20, UI.DIM, true))
	body.add_child(scroll(list))
	return f[0]

# ======================================================================
#   ПАУЗА / СОХРАНЕНИЯ / НАСТРОЙКИ
# ======================================================================
static func pause_menu(hud: Node) -> Control:
	var f := frame("Пауза", hud, 760, 820)
	var body: VBoxContainer = f[1]
	body.add_child(UI.button("Продолжить", func(): hud.close_window(), 30, 0, 90))
	body.add_child(UI.button("Сохранить игру", func(): hud.open("saveload", "save"), 30, 0, 90))
	body.add_child(UI.button("Загрузить игру", func(): hud.open("saveload", "load"), 30, 0, 90))
	body.add_child(UI.button("Настройки", func(): hud.open("settings", "pause"), 30, 0, 90))
	body.add_child(UI.button("Главное меню", func():
		Game.save_game(0)
		hud.close_window()
		hud.get_tree().root.get_node("Main").to_menu(), 30, 0, 90))
	body.add_child(UI.label("Автосохранение — при выполнении целей задания и при выходе в меню.", 20, UI.DIM, true))
	return f[0]

static func saveload(hud: Node, mode: Variant) -> Control:
	var saving := String(mode) == "save"
	var f := frame("Сохранить игру" if saving else "Загрузить игру", hud, 1200, 760)
	var body: VBoxContainer = f[1]
	var start := 1 if saving else 0
	for i in range(start, Game.SLOTS + 1):
		var t := ("Автосохранение" if i == 0 else "Слот %d" % i) + ": " + Game.slot_info(i)
		var b := UI.button(t, func():
			if saving:
				Game.save_game(i)
				hud.close_window()
			else:
				hud.close_window()
				hud.get_tree().root.get_node("Main").load_slot(i), 24, 0, 90)
		if not saving and not Game.has_save(i):
			b.disabled = true
		body.add_child(b)
	body.add_child(UI.button("Назад", func(): hud.open("pause", null), 24, 0, 72))
	return f[0]

static func settings(hud: Node, back: Variant) -> Control:
	var f := frame("Настройки", hud, 1400, 960)
	var body: VBoxContainer = f[1]
	var list := UI.vbox(10)
	body.add_child(scroll(list))
	var build := func(): pass
	build = func():
		UI.clear(list)
		list.add_child(UI.label("Качество графики", 26, UI.WARN))
		var qrow := UI.hbox()
		list.add_child(qrow)
		for q in 3:
			var b := UI.button(Settings.PRESETS[q].name, func():
				Settings.apply_preset(q)
				build.call(), 24, 200, 70)
			if q == Settings.quality:
				b.add_theme_stylebox_override("normal", UI.sb(Color(0.35, 0.08, 0.06), UI.RED_L, 3, 6, 12))
			qrow.add_child(b)
		_slider(list, "Дальность прорисовки, м", 50, 160, Settings.draw_distance, func(v):
			Settings.draw_distance = v
			Settings.apply()
			if Game.world: Game.world.apply_quality())
		_slider(list, "Плотность травы", 0.0, 1.0, Settings.grass_density, func(v):
			Settings.grass_density = v
			Settings.apply()
			if Game.world: Game.world.apply_quality())
		_slider(list, "Разрешение 3D", 0.5, 1.0, Settings.render_scale, func(v):
			Settings.render_scale = v
			Settings.apply())
		_slider(list, "Громкость", 0.0, 1.0, Settings.volume, func(v):
			Settings.volume = v
			Settings.apply())
		_slider(list, "Размер джойстика", 0.7, 1.4, Settings.joystick_size, func(v):
			Settings.joystick_size = v
			Settings.apply())
		_slider(list, "Длина суток, мин", 8, 60, Settings.day_length_min, func(v):
			Settings.day_length_min = v
			Settings.apply())
		var r2 := UI.hbox()
		list.add_child(r2)
		r2.add_child(UI.button("Лимит FPS: %d" % Settings.fps_limit, func():
			Settings.fps_limit = 60 if Settings.fps_limit == 30 else 30
			Settings.apply()
			build.call(), 22, 260, 66))
		r2.add_child(UI.button("Тени: %s" % ("вкл" if Settings.shadows else "выкл"), func():
			Settings.shadows = not Settings.shadows
			Settings.apply()
			build.call(), 22, 220, 66))
		r2.add_child(UI.button("Счётчик FPS: %s" % ("вкл" if Settings.show_fps else "выкл"), func():
			Settings.show_fps = not Settings.show_fps
			Settings.apply()
			build.call(), 22, 280, 66))
		r2.add_child(UI.button("Сенсор: %s" % ["авто", "выкл", "вкл"][Settings.touch_controls + 1], func():
			Settings.touch_controls = (Settings.touch_controls + 2) % 3 - 1
			Settings.apply()
			build.call(), 22, 240, 66))
	build.call()
	body.add_child(UI.button("Назад", func():
		if String(back) == "pause":
			hud.open("pause", null)
		else:
			hud.close_window(), 24, 0, 72))
	return f[0]

static func _slider(list: VBoxContainer, title: String, mn: float, mx: float, val: float, cb: Callable) -> void:
	var r := UI.hbox(16)
	var l := UI.label("%s: %s" % [title, _fmt(val)], 22)
	l.custom_minimum_size = Vector2(460, 0)
	r.add_child(l)
	var s := HSlider.new()
	s.min_value = mn
	s.max_value = mx
	s.step = (mx - mn) / 100.0
	s.value = val
	s.custom_minimum_size = Vector2(600, 50)
	s.value_changed.connect(func(v):
		l.text = "%s: %s" % [title, _fmt(v)]
		cb.call(v))
	r.add_child(s)
	list.add_child(r)

static func _fmt(v: float) -> String:
	return str(int(v)) if v > 3.0 else "%.2f" % v

# ======================================================================
#   ДИАЛОГ
# ======================================================================
static func dialog(hud: Node, id: String) -> Control:
	var lines := Quest.get_dialog(id)
	var f := frame("Разговор" if id != "intro" else "Долг: Возрождение", hud, 1400, 640, false)
	var body: VBoxContainer = f[1]
	var who := UI.label("", 30, UI.WARN)
	var txt := UI.label("", 28, UI.FG, true)
	txt.custom_minimum_size = Vector2(1300, 0)
	var opts := UI.vbox(8)
	body.add_child(who)
	body.add_child(UI.expand(txt))
	body.add_child(UI.expand(UI.spacer()))
	body.add_child(opts)
	var show := func(_i: int): pass
	show = func(i: int):
		if i >= lines.size():
			hud.close_window()
			return
		var ln: Dictionary = lines[i]
		who.text = String(ln.get("who", ""))
		txt.text = String(ln.text)
		UI.clear(opts)
		if ln.has("options"):
			for o in ln.options:
				opts.add_child(UI.button(String(o.text), func():
					if o.has("action"):
						Quest.dialog_action(String(o.action))
						hud.close_window()
					else:
						show.call(int(o.next)), 26, 0, 76))
		else:
			opts.add_child(UI.button("Далее ▶", func(): show.call(i + 1), 26, 0, 76))
	show.call(0)
	return f[0]

static func death(hud: Node) -> Control:
	var f := frame("Генерал погиб", hud, 900, 520, false)
	var body: VBoxContainer = f[1]
	body.add_child(UI.label("Без командира «Долг» не возродится. Попробуйте снова.", 26, UI.FG, true))
	var last := Game.latest_slot()
	var b := UI.button("Загрузить последнее сохранение", func():
		hud.close_window()
		hud.get_tree().root.get_node("Main").load_slot(last), 28, 0, 90)
	b.disabled = last < 0
	body.add_child(b)
	body.add_child(UI.button("Главное меню", func():
		hud.close_window()
		hud.get_tree().root.get_node("Main").to_menu(), 28, 0, 90))
	return f[0]

static func exit_window(hud: Node, data: Variant) -> Control:
	var d: Dictionary = data
	var f := frame("Выход: " + String(d.name), hud, 1100, 600)
	var body: VBoxContainer = f[1]
	body.add_child(UI.label("Переход на локацию «%s».\n\nЭта локация ещё не создана: первый этап посвящён базе «Долга». Следующая локация будет разработана после подтверждения." % d.name, 26, UI.FG, true))
	if d.id == "exit_south" and Game.flags.get("expedition_unlocked", false):
		body.add_child(UI.button("Подготовка экспедиции", func(): hud.open("expedition", null), 26, 0, 80))
	body.add_child(UI.button("Вернуться на базу", func(): hud.close_window(), 26, 0, 80))
	return f[0]

# ======================================================================
#   РАДИО: поиск сигнала
# ======================================================================
static func radio(hud: Node) -> Control:
	var f := frame("Радиостанция Р-159: поиск сигнала", hud, 1300, 760)
	var body: VBoxContainer = f[1]
	var target := 147.3
	var state := {"lock": 0.0, "done": Game.flags.get("signal_received", false)}
	body.add_child(UI.label("Медленно вращайте ручку настройки. Удерживайте частоту, когда уровень сигнала максимален.", 24, UI.DIM, true))
	var freq := UI.label("", 44, Color(0.5, 1.0, 0.6))
	body.add_child(freq)
	var lvl := UI.bar(Color(0.4, 0.9, 0.5), 40)
	body.add_child(lvl)
	var status := UI.label("", 26, UI.WARN, true)
	body.add_child(status)
	var s := HSlider.new()
	s.min_value = 120.0
	s.max_value = 175.0
	s.step = 0.1
	s.value = 128.0
	s.custom_minimum_size = Vector2(1200, 80)
	body.add_child(s)
	Sfx.set_ambient("amb_radio")
	var timer := Timer.new()
	timer.wait_time = 0.1
	timer.autostart = true
	timer.process_mode = Node.PROCESS_MODE_ALWAYS
	body.add_child(timer)
	var tick := func():
		var v := float(s.value)
		freq.text = "%.1f МГц" % v
		var strength := clampf(1.0 - absf(v - target) / 6.0, 0.0, 1.0)
		strength = strength * strength
		lvl.value = strength * 100.0
		if state.done:
			status.text = "Сигнал получен. Отряд сержанта Ковалёва — Свалка, старое депо."
			return
		if strength > 0.92:
			state.lock += 0.1
			status.text = "Сигнал… держите частоту (%d%%)" % int(state.lock / 2.0 * 100.0)
			if state.lock >= 2.0:
				state.done = true
				Sfx.set_ambient("amb_wind")
				hud.open("dialog", "signal")
		else:
			state.lock = maxf(0.0, state.lock - 0.2)
			status.text = "Шум эфира…" if strength < 0.3 else "Что-то есть рядом…"
	timer.timeout.connect(tick)
	tick.call()
	var root: Control = f[0]
	root.tree_exiting.connect(func(): Sfx.set_ambient("amb_wind"))
	return root

# ======================================================================
#   ЭКСПЕДИЦИЯ
# ======================================================================
static func expedition(hud: Node) -> Control:
	var f := frame("Подготовка экспедиции", hud, 1400, 900)
	var body: VBoxContainer = f[1]
	body.add_child(UI.label("Цель: Свалка, старое депо — отряд сержанта Ковалёва (5 человек, двое ранены).", 24, UI.WARN, true))
	body.add_child(UI.label("Выберите бойцов (база не должна остаться без охраны):", 22, UI.FG))
	var sel := {}
	for s in Game.world.soldiers.values():
		var so := s as Soldier
		var cb := UI.toggle("%s «%s» — %s, здоровье %d" % [so.def.name, so.def.call, so.role_name(), int(so.hp)], false, func(v): sel[so.sid] = v, 24, 0, 64)
		cb.alignment = HORIZONTAL_ALIGNMENT_LEFT
		cb.disabled = not so.alive
		body.add_child(cb)
	body.add_child(UI.label("Снаряжение: патроны и медикаменты берутся со склада базы. Склад: %s" % _wh_summary(), 20, UI.DIM, true))
	body.add_child(UI.button("Утвердить состав экспедиции", func():
		var n := 0
		for k in sel:
			if sel[k]:
				n += 1
		if n == 0:
			Events.msg("Выберите хотя бы одного бойца.", Events.Msg.ALERT)
			return
		Game.set_flag("expedition_ready")
		Game.flags["expedition_team"] = sel.keys().filter(func(k): return sel[k])
		Events.msg("Экспедиция подготовлена (%d бойцов). Выход — южные ворота → «Свалка» (локация в разработке)." % n, Events.Msg.GOOD)
		hud.close_window(), 28, 0, 88))
	return f[0]
