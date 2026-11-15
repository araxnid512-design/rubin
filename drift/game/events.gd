extends Node
## События «Дрейфа». Пульт на мостике: карта сектора — три точки на выбор, прыжок (топливо, вспышка), событие,
## итог. Через 10 минут тишины что-то сближается само: 30 секунд, чтобы уйти прыжком, иначе событие из
## «forced» (пираты, метеоры, обломки) — без расхода топлива.
## События и конструкции для стыковки — game/data/events.json; конструкция пристыковывается к люку шлюза
## (STShip.attach), враги, ящики и руда — узлы события, по окончании убираются вместе с ней.

var data := {}
var cur := ""                    ## текущее событие ("" — нет)
var choices: Array = []          ## точки на карте сектора
var nodes: Array = []            ## узлы события
var t := 0.0
var waves_left := 0
var wave_n := 0
var wave_t := 0.0
var limit := 0.0                 ## ограничение по времени (астероид)
var res0 := {}
var hull0 := 0.0
var _warned := false
var _spawn_t := 0.0
var _busy := false               ## идёт прыжок


func _ready() -> void:
	Core.set_meta("events", self)
	data = JSON.parse_string(FileAccess.get_file_as_string("res://game/data/events.json"))
	roll_choices()


func ss() -> Node:
	return Core.get_meta("shipst")


func roll_choices() -> void:
	var pool: Array = data.events.keys()
	pool.shuffle()
	# станция встречается не всегда, пираты чаще с ростом сектора
	choices = pool.slice(0, 3)


func ev_name(id: String) -> String:
	return data.events.get(id, {}).get("n", id)


# ---------------- пульт ----------------

func helm() -> void:
	if _busy:
		return
	if Core.loop.phase == "event":
		if Core.ship.is_docked():
			var why := leave_block()
			if why != "":
				Core.hud.show_text("Пульт", why)
				return
			Core.hud.show_dialog("Пульт", "%s. Отстыковаться и уйти в дрейф?" % ev_name(cur), [
				["Отстыковаться", func():
					Core.hud.close_modal()
					finish()],
				["Остаться", Core.hud.close_modal]])
		else:
			Core.hud.show_text("Пульт", status_line())
		return
	show_map()


## цена прыжка в топливе: двигатели на 2 единицах — 1, на одной — 2
func jump_cost() -> int:
	return 1 if int(ss().power.get("engines", 0)) >= 2 else 2


func show_map() -> void:
	var s := ss()
	var cost := jump_cost()
	var can: bool = s.powered("engines") and int(s.res.fuel) >= cost
	var rows := []
	for id in choices:
		var e: Dictionary = data.events[id]
		var risk := "опасность " + ("●".repeat(int(e.risk)) + "○".repeat(3 - int(e.risk)))
		rows.append(["%s · %s\n   %s" % [e.n, risk, e.d], "Прыжок", func(): jump(id), can])
	var head := "Сектор %d · топливо %d · прыжок стоит %d" % [Core.loop.sector, int(s.res.fuel), cost]
	if not s.powered("engines"):
		head += "\nДвигатели без энергии — выделите им энергию в окне «Корабль»."
	elif int(s.res.fuel) < cost:
		head += "\nНе хватает топлива. Ждите сближения или добудьте топливо (обломки, станция)."
	elif Core.loop.phase == "alarm":
		head += "\nТРЕВОГА: к нам идёт «%s». Уйдите прыжком — или встречайте." % ev_name(_forced_id())
	else:
		head += " · до сближения %s" % Core.loop.timer_text()
	Core.hud.rows("Карта сектора", head, rows)


func jump(id: String) -> void:
	var s := ss()
	var cost := jump_cost()
	if int(s.res.fuel) < cost or not s.powered("engines"):
		return
	s.add("fuel", -cost)
	Core.hud.close_modal()
	Core.save.save_game()
	_busy = true
	Core.play_ui("jump", -2.0)
	_warp_fx()
	await get_tree().create_timer(1.3).timeout
	_busy = false
	start(id)


var _forced := ""


func _forced_id() -> String:
	if _forced == "":
		var f: Array = data.forced
		_forced = f[randi() % f.size()]
	return _forced


## сближение не встретили прыжком — событие приходит само
func forced() -> void:
	if _busy or cur != "":
		return
	start(_forced_id())


func _warp_fx() -> void:
	var layer := CanvasLayer.new()
	layer.layer = 50
	var r := ColorRect.new()
	r.color = Color(0.8, 0.9, 1.0, 0.0)
	r.set_anchors_preset(Control.PRESET_FULL_RECT)
	r.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(r)
	add_child(layer)
	var sf: Parallax2D = Core.get_meta("starfield", null)
	var tw := create_tween()
	if sf:
		tw.tween_property(sf, "autoscroll", Vector2(-2600, 0), 0.8)
	tw.parallel().tween_property(r, "color:a", 0.85, 1.0).set_delay(0.3)
	tw.tween_callback(func():
		if sf:
			sf.autoscroll = Vector2.ZERO)
	tw.tween_property(r, "color:a", 0.0, 0.6)
	tw.tween_callback(layer.queue_free)


func _shake(power: float, sec: float) -> void:
	var cam := get_viewport().get_camera_2d()
	if cam == null:
		return
	var base := cam.offset
	var tw := create_tween()
	for i in int(sec / 0.05):
		tw.tween_property(cam, "offset", base + Vector2(randf_range(-power, power), randf_range(-power, power)), 0.05)
	tw.tween_property(cam, "offset", base, 0.1)


# ---------------- событие ----------------

func start(id: String) -> void:
	cur = id
	_forced = ""
	t = 0.0
	_warned = false
	_spawn_t = 0.0
	Core.loop.phase = "event"
	res0 = ss().res.duplicate()
	hull0 = ss().hull
	var e: Dictionary = data.events[id]
	Core.say(e.get("arrive", e.n), "warn")
	if e.has("dock"):
		var st: Dictionary = data.structures[e.dock]
		Core.ship.attach(st)
		_shake(4.0, 0.4)
		Core.play_at("dock_clamp", SP.cell_to_px(Core.ship.dock_cell()), 0.0)
		_populate(st)
	match id:
		"pirates":
			waves_left = 3
			wave_n = 0
			wave_t = 4.0
		"asteroid":
			limit = 180.0
		"storm":
			_storm()


## клетки конструкции (относительно люка) → точка экрана
func _rel(x: float, y: float) -> Vector2:
	var d: Vector2i = Core.ship.dock_cell()
	return Vector2((d.x + x) * SP.TILE.x, (d.y + y) * SP.TILE.y)


func _populate(st: Dictionary) -> void:
	var ysort: Node2D = Core.ship.ysort
	for b in st.get("boxes", []):
		var box := STBox.new()
		box.position = _rel(b[0], b[1])
		ysort.add_child(box)
		var c: Array = b[5]
		var g: Array = b[6] if b.size() > 6 else []
		box.setup(b[2], b[3], b[4], Color(c[0], c[1], c[2]), Color(g[0], g[1], g[2], 1.0) if g.size() == 3 else Color(0, 0, 0, 0))
		_block_box(box, b[2], b[3])
		nodes.append(box)
	for c in st.get("crates", []):
		var box := STBox.new()
		box.position = _rel(c[0], c[1])
		ysort.add_child(box)
		box.setup(1.0, 0.8, 0.8, Color(0.42, 0.36, 0.22), Color(1.0, 0.7, 0.2, 1.0))
		_block_box(box, 1.0, 0.8)
		nodes.append(box)
		var it := STInteract.new()
		it.action = "use"
		it.verb = "Обыскать"
		it.label = "Ящик с припасами"
		it.radius = 1.5
		it.position = box.position + Vector2(0, 10)
		ysort.add_child(it)
		nodes.append(it)
		it.used.connect(func(by):
			if by is STHero:
				by.work(1.0, func(): _loot_crate(it, box)))
	for o in st.get("ores", []):
		var ore := STOre.new()
		ore.res = o[0]
		ore.left = 3 if o[0] == "metal" else 2
		ore.position = _rel(o[1], o[2])
		ysort.add_child(ore)
		nodes.append(ore)
	for en in st.get("enemies", []):
		if randf() < float(en[3]):
			spawn(en[0], _rel(en[1], en[2]))
	if st.has("trader"):
		var tr: Array = st.trader
		var it := STInteract.new()
		it.action = "use"
		it.verb = "Торговать"
		it.label = "Терминал торговца"
		it.radius = 2.0
		it.position = _rel(tr[0], tr[1]) + Vector2(0, 10)
		ysort.add_child(it)
		nodes.append(it)
		it.used.connect(func(_by): show_trade())


func _block_box(box: STBox, w: float, d: float) -> void:
	var r := Rect2(box.position.x - w * SP.PPM * 0.5, box.position.y - d * SP.TILE.y, w * SP.PPM, d * SP.TILE.y)
	for c in SP.cells_under(r):
		Core.ship.block(c, true)


func spawn(kind: String, at: Vector2) -> STEnemy:
	var e: STEnemy = Core.get_meta("spawn_enemy").call(kind, at)
	nodes.append(e)
	return e


func _loot_crate(it: STInteract, box: STBox) -> void:
	if not it.enabled:
		return
	it.enabled = false
	box.glow = Color(0, 0, 0, 0)
	box.queue_redraw()
	var got := []
	var s := ss()
	for row in data.loot.crate:
		if randf() < float(row[1]):
			var n := randi_range(int(row[2]), int(row[3]))
			s.add(row[0], n)
			got.append("%s +%d" % [s.res_name(row[0]), n])
	Core.play_at("crate_open", box.global_position, -4.0)
	Core.say("Найдено: " + (", ".join(got) if not got.is_empty() else "пусто"), "good" if not got.is_empty() else "info")


func _alive_enemies(only_ship := false) -> int:
	var n := 0
	for e in get_tree().get_nodes_in_group("enemy"):
		if e.alive() and (not only_ship or not Core.ship.outside(e.global_position)):
			n += 1
	return n


func _wave() -> void:
	waves_left -= 1
	wave_n += 1
	wave_t = 28.0
	var spots: Array = data.structures.pirate.spawns
	var n := 1 + wave_n
	var goal: Vector2 = Core.ship.room_center("reactor")
	for i in n:
		var p: Array = spots[i % spots.size()]
		var e := spawn("pirate", _rel(p[0], p[1]) + Vector2(randf_range(-10, 10), 0))
		e.goal = goal
	if wave_n == 3:
		var r := spawn("robot", _rel(0, 6))
		r.goal = goal
	Core.say("Волна %d из 3: %d %s." % [wave_n, n + int(wave_n == 3), "пиратов" if wave_n < 3 else "пиратов и робот"], "bad")
	Core.play_at("alarm", SP.cell_to_px(Core.ship.dock_cell()), -10.0)


func _storm() -> void:
	_shake(9.0, 1.2)
	ss().damage_hull(12.0)
	Core.play_ui("impact", 0.0)
	var ids := ["engines", "reactor", "workshop", "medbay", "corridor", "quarters", "cargo"]
	ids.shuffle()
	for i in 4:
		var b := STBreach.new()
		b.fire = i == 3
		b.position = _free_point(ids[i])
		Core.ship.ysort.add_child(b)
		nodes.append(b)
	var where := []
	for i in 4:
		where.append(Core.ship.rooms[ids[i]].n.to_lower())
	Core.say("Повреждения: " + ", ".join(where) + ".", "bad")


## случайная свободная клетка пола в отсеке
func _free_point(room: String) -> Vector2:
	var rr: Array = Core.ship.rooms[room].r
	for i in 30:
		var c := Vector2i(randi_range(int(rr[0]), int(rr[0]) + int(rr[2]) - 1), randi_range(int(rr[1]), int(rr[1]) + int(rr[3]) - 1))
		if Core.ship.own_floor(c):
			return SP.cell_to_px(c)
	return Core.ship.room_center(room)


func _process(delta: float) -> void:
	if cur == "" or get_tree().paused:
		return
	t += delta
	match cur:
		"pirates":
			wave_t -= delta
			if waves_left > 0 and (wave_t <= 0.0 or (_alive_enemies() == 0 and t > 2.0)):
				_wave()
			elif waves_left == 0 and _alive_enemies() == 0:
				var s := ss()
				for k in data.loot.pirates_won:
					s.add(k, int(data.loot.pirates_won[k]))
				Core.say("Пираты отбиты! Их трюм — наш.", "good")
				finish()
		"asteroid":
			var left := limit - t
			_spawn_t -= delta
			if _spawn_t <= 0.0:
				_spawn_t = 40.0
				if t > 20.0 and _alive_enemies() < 3:
					var sp: Array = data.structures.asteroid.spawns
					var p: Array = sp[randi() % sp.size()]
					spawn("crawler", _rel(p[0], p[1]))
			if left <= 30.0 and not _warned:
				_warned = true
				Core.say("30 секунд — астероид уходит! Возвращайтесь на борт.", "warn")
				Core.play_ui("alarm", -12.0)
			if left <= 0.0:
				finish()
		"storm":
			if get_tree().get_nodes_in_group("repairable").is_empty():
				ss().add("fuel", 1)
				Core.say("Прошли поток насквозь — сэкономили топливо (+1).", "good")
				finish()


## можно ли отстыковаться сейчас (пусто — можно)
func leave_block() -> String:
	if cur == "pirates":
		return "Пираты на борту — отстыковаться не дадут. Отбейте все волны."
	if Core.ship.outside(Core.player.global_position):
		return "Сначала вернитесь на свой корабль."
	if _alive_enemies(true) > 0:
		return "На борту враги. Разберитесь с ними, потом уходим."
	return ""


func status_line() -> String:
	match cur:
		"pirates": return "АБОРДАЖ · волна %d/3" % wave_n
		"asteroid": return "АСТЕРОИД · добыча"
		"derelict": return "ОБЛОМКИ · обыск"
		"station": return "СТАНЦИЯ · торговля"
		"storm": return "МЕТЕОРЫ · ремонт (%d)" % get_tree().get_nodes_in_group("repairable").size()
	return "СОБЫТИЕ"


func timer_text() -> String:
	if cur == "asteroid":
		var left := maxf(0.0, limit - t)
		return "%02d:%02d" % [int(left) / 60, int(left) % 60]
	if cur == "pirates" and waves_left > 0:
		return "волна через %d" % ceili(maxf(0.0, wave_t))
	return "—:—"


## конец события: всех на борт, конструкцию — прочь, итог, снова тишина
func finish() -> void:
	if cur == "":
		return
	var h: STHero = Core.player
	if Core.ship.is_docked():
		if Core.ship.outside(h.global_position) and h.alive():
			h.global_position = Core.ship.room_center("airlock")
			h.reset_physics_interpolation()
			h.damage(15.0)
			Core.say("Трос шлюза втянул вас на борт — с ушибами.", "warn")
		var s := ss()
		for d in s.drones:
			if is_instance_valid(d) and Core.ship.outside(d.global_position):
				d.global_position = h.global_position
				d.reset_physics_interpolation()
	for n in nodes:
		if is_instance_valid(n):
			n.queue_free()
	nodes.clear()
	for e in get_tree().get_nodes_in_group("enemy"):
		e.queue_free()
	Core.ship.detach()
	Core.play_at("dock_clamp", SP.cell_to_px(Core.ship.dock_cell()), -4.0)
	var name := ev_name(cur)
	var lines := []
	var s := ss()
	for k in s.res:
		var dv := int(s.res[k]) - int(res0.get(k, 0))
		if dv != 0:
			lines.append("%s %s%d" % [s.res_name(k), "+" if dv > 0 else "", dv])
	var dh := roundi(s.hull - hull0)
	if dh != 0:
		lines.append("Корпус %s%d%%" % ["+" if dh > 0 else "", dh])
	cur = ""
	Core.loop.next_calm()
	roll_choices()
	Core.hud.show_text("Итог: " + name, ("\n".join(lines) if not lines.is_empty() else "Без потерь и находок.") +
		"\n\nСектор %d. Снова тишина — 10 минут на ремонт и сборку." % Core.loop.sector)
	Core.save.save_game()


# ---------------- торговля ----------------

func _trade_text(tr: Dictionary) -> String:
	var s := ss()
	var pay := []
	for k in tr.pay:
		pay.append("%s ×%d" % [s.res_name(k), int(tr.pay[k])])
	var got := []
	for k in tr.get("get", {}):
		got.append("%s ×%d" % [s.res_name(k), int(tr.get[k])])
	if tr.has("hull"):
		got.append("ремонт корпуса +%d%%" % int(tr.hull))
	return "%s  →  %s" % [", ".join(pay), ", ".join(got)]


func show_trade() -> void:
	var s := ss()
	var rows := []
	for tr in data.trades:
		var ok: bool = s.has_all(tr.pay) and (not tr.has("hull") or s.hull < 100.0)
		rows.append([_trade_text(tr), "Обмен", func():
			if not s.has_all(tr.pay):
				return
			s.take(tr.pay)
			for k in tr.get("get", {}):
				s.add(k, int(tr.get[k]))
			if tr.has("hull"):
				s.hull = minf(100.0, s.hull + float(tr.hull))
			Core.play_ui("trade", -4.0)
			show_trade(), ok])
	Core.hud.rows("Торговец станции", "Есть: металл %d, электроника %d, ячейки %d, топливо %d · корпус %d%%" % [
		s.res.metal, s.res.electronics, s.res.cells, s.res.fuel, roundi(s.hull)], rows)
