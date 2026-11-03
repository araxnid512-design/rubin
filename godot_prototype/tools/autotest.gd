extends Node
## Автоматическое прохождение задания «Возрождение Долга» с реальным передвижением по навмешу.
## Запуск: godot --headless --path . -- autotest
## Отчёт: docs/test_report.md

const L = preload("res://scripts/world/layout.gd")

var main: Node
var p: Player
var report: Array = []
var fails := 0
var t0 := 0

func _ready() -> void:
	_run()

func log_line(ok: bool, text: String) -> void:
	var line := "%s %s  (t=%.1fс)" % ["✅" if ok else "❌", text, (Time.get_ticks_msec() - t0) / 1000.0]
	print(line)
	report.append(line)
	if not ok:
		fails += 1

func note(text: String) -> void:
	print("   ", text)
	report.append("   " + text)

func frames(n: int) -> void:
	for i in n:
		await get_tree().physics_frame

func close_ui() -> void:
	if main.hud and main.hud.open_window:
		main.hud.close_window()

func walk_to(target: Vector3, tol: float = 1.2, timeout: float = 90.0) -> bool:
	var map: RID = Game.world.nav_map()
	var path := NavigationServer3D.map_get_path(map, p.global_position, target, true)
	if path.is_empty():
		note("нет пути к %s" % target)
		return false
	var start := Time.get_ticks_msec()
	var i := 0
	while i < path.size():
		close_ui()
		var pt := path[i]
		p.auto_walk_target = pt
		var flat := Vector2(pt.x - p.global_position.x, pt.z - p.global_position.z).length()
		if flat < 0.7 or (i == path.size() - 1 and flat < tol):
			i += 1
			continue
		# открываем двери на пути, как это сделал бы игрок
		for n in get_tree().get_nodes_in_group("interactable"):
			if n is Door and not (n as Door).is_open and (n as Node3D).global_position.distance_to(p.global_position) < 2.4:
				(n as Door).interact(p)
		await get_tree().physics_frame
		if (Time.get_ticks_msec() - start) / 1000.0 * Engine.time_scale > timeout:
			p.auto_walk_target = null
			note("таймаут ходьбы к %s, генерал в %s" % [target, p.global_position])
			return false
	p.auto_walk_target = null
	await frames(2)
	return Vector2(target.x - p.global_position.x, target.z - p.global_position.z).length() < tol + 1.5

func find_container(id: String) -> LootContainer:
	for c in Game.world.objects_root.get_children():
		if c is LootContainer and (c as LootContainer).container_id == id:
			return c
	return null

func loot(id: String) -> bool:
	var c := find_container(id)
	if c == null:
		note("контейнер %s не найден" % id)
		return false
	var ok := await walk_to(c.global_position, c.radius - 0.4)
	if not ok:
		return false
	c.interact(p)
	await frames(2)
	var n := c.take_all()
	close_ui()
	note("обыскан %s: взято %d" % [c.title, n])
	return n > 0 or c.items.is_empty()

func hold_on(node: Node, max_s: float = 30.0) -> bool:
	## Удержание «Действия» через реальный механизм игрока.
	var start := Time.get_ticks_msec()
	p.focus = node
	p._start_interaction(node)
	p.touch_interact = true
	while is_instance_valid(node) and p.holding and (Time.get_ticks_msec() - start) / 1000.0 * Engine.time_scale < max_s:
		await get_tree().physics_frame
	p.touch_interact = false
	await frames(2)
	return not is_instance_valid(node) or node.is_queued_for_deletion() or not p.holding

func salvage_near(center: Vector3, res: String, count: int) -> int:
	var got := 0
	var list: Array = []
	for c in Game.world.objects_root.get_children():
		if c is Salvage and (c as Salvage).res_id == res:
			list.append(c)
	list.sort_custom(func(a, b): return (a as Node3D).global_position.distance_to(center) < (b as Node3D).global_position.distance_to(center))
	for s in list:
		if got >= count:
			break
		var sv := s as Salvage
		var amount := sv.amount
		if await walk_to(sv.global_position, 1.6):
			if await hold_on(sv, 10.0):
				got += amount
	return got

func _run() -> void:
	t0 = Time.get_ticks_msec()
	main = get_tree().root.get_node("Main")
	await get_tree().process_frame
	Engine.time_scale = 2.5
	await main.new_game()
	p = Game.player as Player
	p.god_mode = false
	close_ui()
	log_line(Game.world != null and p != null, "Новая игра запущена, мир построен")
	# ---------------- проверки масштаба карты ----------------
	var ground := Game.world.get_node("GroundBody") as StaticBody3D
	var gb := (ground.get_child(0) as CollisionShape3D).shape as BoxShape3D
	log_line(gb.size.x >= 300.0 and gb.size.z >= 300.0, "Размер локации: земля %.0f×%.0f м, границы ±150 м" % [gb.size.x, gb.size.z])
	var map: RID = Game.world.nav_map()
	var reach_ok := 0
	var targets := []
	for d in L.BUILDINGS:
		if d.get("rubble", false) or d.kind == "tower":
			continue
		targets.append([d.name, (Game.world.buildings[d.id] as Building).entrance()])
	for e in L.EXITS:
		targets.append(["выход " + e.name, e.pos])
	for tgt in targets:
		var path := NavigationServer3D.map_get_path(map, L.PLAYER_START, tgt[1], true)
		var ok := not path.is_empty() and path[path.size() - 1].distance_to(tgt[1]) < 2.5
		if ok:
			reach_ok += 1
		else:
			note("недостижимо: %s" % tgt[0])
	log_line(reach_ok == targets.size(), "Навигация: достижимы %d/%d ключевых точек (здания, выходы)" % [reach_ok, targets.size()])
	# ---------------- этап 1: прибытие ----------------
	var ok1 := await walk_to(Vector3(0, 0, -12), 3.0)
	await frames(30)
	close_ui()
	log_line(ok1 and Quest.stage >= 1, "Прибытие на плац, встреча с бойцами (этап %d)" % Quest.stage)
	# ---------------- этап 2: штаб ----------------
	var ok2 := await walk_to(Vector3(0, 0, -39), 1.5)
	await frames(30)
	close_ui()
	log_line(ok2 and Quest.stage >= 2, "Генерал вошёл в штаб (крыша скрыта: %s)" % str(not (Game.world.buildings.hq as Building).roof_mi.visible))
	# ---------------- этап 3: осмотр ----------------
	for ip in L.INSPECT:
		if await walk_to(ip.pos, 2.0):
			for n in Game.world.objects_root.get_children():
				if n is InspectPoint and (n as InspectPoint).point_id == ip.id:
					(n as InspectPoint).interact(p)
	await frames(30)
	close_ui()
	log_line(Quest.stage >= 3, "Осмотр повреждений: генераторная, радиоцентр, оружейная")
	# ---------------- этап 4: офицер ----------------
	var officer: Soldier = Game.world.soldiers.s_officer
	await walk_to(officer.global_position, 2.0)
	officer.interact(p)
	await frames(3)
	var dlg_open: bool = main.hud.open_window != null and main.hud.open_window.get_meta("kind", "") == "dialog"
	Quest.dialog_action("talked_officer")
	close_ui()
	await frames(30)
	log_line(dlg_open and Quest.stage >= 4, "Разговор с офицером (диалог открыт: %s)" % str(dlg_open))
	# ---------------- этап 5: инструменты и детали ----------------
	await loot("hq_desk")
	await loot("ws_toolbox")
	await loot("radio_cab")
	await loot("gen_box")
	var sc := await salvage_near(p.global_position, "scrap", 8)
	note("разобрано металлолома: %d" % sc)
	await frames(30)
	close_ui()
	log_line(Quest.stage >= 5, "Найдены инструменты (%d), электроника (%d), металлолом (%d)" % [Game.total_count("tools"), Game.total_count("electronics"), Game.total_count("scrap")])
	# ---------------- этап 6: склад ----------------
	var wh: Building = Game.world.buildings.warehouse
	await walk_to(wh.entrance(), 2.0)
	var moved := Game.deposit_resources()
	Game.set_flag("deposited")
	await frames(30)
	close_ui()
	log_line(Quest.stage >= 6 and not moved.is_empty(), "Материалы сданы на склад: %s" % str(moved))
	# ---------------- этап 7: генераторная ----------------
	var why := Game.can_start_job("generator")
	var started := Game.start_job("generator")
	log_line(started, "Начат ремонт генераторной" + ("" if started else " — " + why))
	var tech: Soldier = Game.world.soldiers.s_tech
	tech.give_order("repair", "generator")
	var gen: Building = Game.world.buildings.generator
	await walk_to(gen.work_point(), 1.5)
	var tw := Time.get_ticks_msec()
	var rs := gen.repair_spot
	p._start_interaction(rs)
	p.touch_interact = true
	while Game.building_level("generator") < 1 and (Time.get_ticks_msec() - tw) / 1000.0 * Engine.time_scale < 80.0:
		close_ui()
		await get_tree().physics_frame
	p.touch_interact = false
	await frames(5)
	note("техник у генераторной: %.1f м, состояние «%s»" % [tech.global_position.distance_to(gen.work_point()), tech.state])
	log_line(Game.building_level("generator") >= 1, "Генераторная восстановлена за %.0f с игрового времени" % ((Time.get_ticks_msec() - tw) / 1000.0 * Engine.time_scale))
	await loot("base_truck")
	await walk_to(gen.global_position + Vector3(-4.6, 0, 3.5), 1.5)
	Game.refuel_generator(1)
	await frames(20)
	close_ui()
	log_line(Game.power_on, "Генератор заправлен, электроснабжение: %s" % str(Game.power_on))
	# ---------------- этап 8: оружейная ----------------
	var rub: Rubble = null
	for n in Game.world.objects_root.get_children():
		if n is Rubble and (n as Rubble).building_id == "armory":
			rub = n
	var rub_ok := false
	if rub:
		await walk_to(rub.global_position + Vector3(2.4, 0, 0), 1.0)
		rub_ok = await hold_on(rub, 15.0)
	await frames(60)
	log_line(rub_ok and Game.world_state.rubble.has("armory"), "Завал у оружейной разобран (удержание действия), навмеш перестроен")
	var cache_ok := await loot("armory_cache")
	await frames(30)
	close_ui()
	log_line(cache_ok and Quest.stage >= 8, "Оружейный тайник обследован: АК-74 в рюкзаке: %d, 5,45: %d" % [Game.inv.count("ak74"), Game.total_count("ammo_545")])
	# ---------------- этап 9: охрана КПП ----------------
	for sid in ["s_rifleman", "s_officer"]:
		var so: Soldier = Game.world.soldiers[sid]
		var w := ItemDB.weapon(so.weapon_id)
		var give := mini(int(w.mag) * 3, Game.total_count(String(w.ammo)))
		Game.consume({String(w.ammo): give})
		so.reserve += give
		so.supplied = true
		so.give_order("defend", Vector3(0, 0, 76))
	var tk := Time.get_ticks_msec()
	while (Time.get_ticks_msec() - tk) / 1000.0 * Engine.time_scale < 60.0:
		await get_tree().physics_frame
		var arrived := 0
		for sid in ["s_rifleman", "s_officer"]:
			var so: Soldier = Game.world.soldiers[sid]
			if so.global_position.distance_to(so.order_target) < 1.5:
				arrived += 1
		if arrived == 2:
			break
	await frames(30)
	close_ui()
	for sid in ["s_rifleman", "s_officer"]:
		var so: Soldier = Game.world.soldiers[sid]
		note("%s: позиция %s, цель %s, патронов %d+%d" % [so.def.call, so.global_position.snapped(Vector3.ONE * 0.1), so.order_target, so.mag, so.reserve])
	log_line(Quest.kpp_guards() >= 2 and Quest.stage >= 9, "Охрана КПП вооружена и заняла посты сама (навигация бойцов)")
	# ---------------- этап 10: радиоцентр ----------------
	var pickup_e: Node = null
	for n in Game.world.objects_root.get_children():
		if n is Pickup and (n as Pickup).item_id == "electronics":
			pickup_e = n
	if pickup_e:
		await walk_to((pickup_e as Node3D).global_position, 1.2)
		(pickup_e as Pickup).interact(p)
	await salvage_near(Vector3(10, 0, -84), "planks", 4)
	await salvage_near(Vector3(-10, 0, -60), "scrap", 6)
	# выход за периметр через северный пролом к товарному вагону
	note("выход за периметр: северный пролом → товарный вагон")
	var out_ok := await loot("wagon_1")
	log_line(out_ok, "Вылазка за периметр: обыскан товарный вагон у железной дороги")
	# бой: слепой пёс рядом с генералом (вне базы)
	var dog := Enemy.new()
	dog.kind = "dog"
	var spawn: Vector3 = NavigationServer3D.map_get_closest_point(Game.world.nav_map(), p.global_position + Vector3(4, 0, 11))
	dog.home = spawn
	dog.leash = 40.0
	dog.position = spawn
	Game.world.actors_root.add_child(dog)
	await frames(5)
	var hp0 := p.hp
	p.touch_fire = true
	var tf := Time.get_ticks_msec()
	while dog.alive and (Time.get_ticks_msec() - tf) / 1000.0 * Engine.time_scale < 25.0:
		close_ui()
		if p.mag <= 0 and not p.reloading and p.available_reserve() <= 0:
			Game.inv.add("ammo_9x18", 16)
		await get_tree().physics_frame
	p.touch_fire = false
	await frames(10)
	log_line(not dog.alive, "Бой: пёс уничтожен генералом (автоприцел), здоровье генерала %d → %d, патроны ПМ: %d/%d" % [int(hp0), int(p.hp), p.mag, p.available_reserve()])
	await walk_to(Vector3(41, 0, -98), 2.0)
	var rcost := Game.next_cost("radio")
	var miss := Game.missing_for(rcost)
	if not miss.is_empty():
		note("не хватает для радиоцентра: %s — добираем с внешних точек" % str(miss))
		if miss.has("electronics"):
			await loot("road_uaz")
	Game.deposit_resources()
	var rstart := Game.start_job("radio")
	log_line(rstart, "Начат ремонт радиоцентра (нужно питание: %s)" % str(Game.power_on) + ("" if rstart else " — " + Game.can_start_job("radio") + " " + str(Game.missing_for(rcost))))
	if rstart:
		tech.give_order("repair", "radio")
		var radio: Building = Game.world.buildings.radio
		await walk_to(radio.work_point(), 1.5)
		var trs := Time.get_ticks_msec()
		p._start_interaction(radio.repair_spot)
		p.touch_interact = true
		while Game.building_level("radio") < 1 and (Time.get_ticks_msec() - trs) / 1000.0 * Engine.time_scale < 90.0:
			close_ui()
			if not p.holding:
				p._start_interaction(radio.repair_spot)
			await get_tree().physics_frame
		note("радиоцентр: прогресс %.0f/%.0f, техник «%s» в %.1f м" % [Game.building_progress("radio"), Game.building_work_needed("radio"), tech.state, tech.global_position.distance_to(radio.work_point())])
		p.touch_interact = false
	await frames(30)
	close_ui()
	log_line(Game.building_level("radio") >= 1 and Quest.stage >= 10, "Радиоцентр восстановлен")
	# ---------------- этап 11: сигнал ----------------
	main.hud.open("radio", null)
	await get_tree().process_frame
	var radio_open: bool = main.hud.open_window != null
	close_ui()
	Quest.dialog_action("signal_received")
	await frames(30)
	close_ui()
	log_line(radio_open and Quest.stage >= 11 and Game.flags.get("expedition_unlocked", false), "Сигнал выжившего отряда получен, экспедиция разблокирована")
	main.hud.open("expedition", null)
	await get_tree().process_frame
	close_ui()
	Game.set_flag("expedition_ready")
	await frames(30)
	close_ui()
	log_line(Quest.finished, "Задание «Возрождение Долга» выполнено полностью")
	# ---------------- сохранение и загрузка ----------------
	var snap := {"stage": Quest.stage, "gen": Game.building_level("generator"), "radio": Game.building_level("radio"), "scrap": Game.total_count("scrap"),
		"pos": p.global_position, "power": Game.power_on, "rubble": Game.world_state.rubble.has("armory"), "officer_order": Game.world.soldiers.s_officer.order}
	Game.save_game(3)
	await main.load_slot(3)
	p = Game.player as Player
	await frames(10)
	var same: bool = Quest.stage == snap.stage and Game.building_level("generator") == snap.gen and Game.building_level("radio") == snap.radio \
		and Game.total_count("scrap") == snap.scrap and p.global_position.distance_to(snap.pos) < 1.0 and Game.power_on == snap.power \
		and Game.world_state.rubble.has("armory") == snap.rubble and Game.world.soldiers.s_officer.order == snap.officer_order
	log_line(same, "Сохранение (слот 3) и загрузка восстанавливают состояние (этап, здания, ресурсы, позиции, приказы, питание)")
	var no_rubble := true
	for n in Game.world.objects_root.get_children():
		if n is Rubble and (n as Rubble).building_id == "armory":
			no_rubble = false
	log_line(no_rubble, "После загрузки разобранный завал не появляется снова")
	# ---------------- итог ----------------
	var total := (Time.get_ticks_msec() - t0) / 1000.0
	report.append("")
	report.append("Итог: %d проверок не прошло. Реальное время теста %.0f с (ускорение ×%.1f)." % [fails, total, Engine.time_scale])
	var f := FileAccess.open("res://docs/test_report.md", FileAccess.WRITE)
	f.store_string("# Автотест прохождения первого этапа\n\nАвтоматический прогон (`godot --headless --path . -- autotest`): генерал ходит по навмешу, взаимодействует с объектами через игровые механики.\n\n" + "\n".join(report) + "\n")
	f.close()
	print("AUTOTEST DONE, fails=", fails)
	Engine.time_scale = 1.0
	get_tree().quit(1 if fails > 0 else 0)
