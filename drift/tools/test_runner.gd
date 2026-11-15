extends Node
## Автотесты «Дрейфа» под Xvfb: --st-test=<режим> --st-out=<папка>.
##   shots — снимки отсеков; walk — проход героя по кораблю (двери, стены);
##   events — каждое событие: стыковка, снимок, проход в конструкцию, отстыковка (клетки корабля как были);
##   combat — сборка дрона и турели, абордаж пиратов: волны, турели, дроны, бластер героя.

var out := "/tmp/drift_test"
var log_lines: PackedStringArray = []


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--st-out="):
			out = a.substr(9)
	DirAccess.make_dir_recursive_absolute(out)
	call_deferred("_run")


func _log(s: String) -> void:
	print("[test] " + s)
	log_lines.append(s)


func _frames(n: int) -> void:
	for i in n:
		await get_tree().process_frame


func _shot(name: String) -> void:
	await _frames(3)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out.path_join(name + ".png"))
	var st: Dictionary = Core.mobile.stats()
	_log("%s: fps %d, вызовов %d, объектов %d" % [name, st.fps, st.draw, st.objects])


func _place(p: Vector2) -> void:
	var h: STHero = Core.player
	h.global_position = p
	h.velocity = Vector2.ZERO
	h.reset_physics_interpolation()
	var cam := get_viewport().get_camera_2d()
	if cam:
		cam.reset_smoothing()
	await _frames(10)


## идти к точке по маршруту корабля (как будут ходить дроны): от клетки к клетке
func _go(p: Vector2, timeout: float) -> bool:
	var h: STHero = Core.player
	var pts: PackedVector2Array = Core.ship.path(h.global_position, p)
	if pts.is_empty():
		return false
	var t := 0.0
	var i := 1 if pts.size() > 1 else 0
	while t < timeout:
		var goal: Vector2 = pts[i]
		var d := SP.screen_to_ground(goal - h.global_position)
		if d.length() < 22.0:
			i += 1
			if i >= pts.size():
				h.move_input = Vector2.ZERO
				return true
			continue
		d = d.normalized()
		h.move_input = Vector2(d.x, -d.y)
		await get_tree().physics_frame
		t += 1.0 / 30.0
	h.move_input = Vector2.ZERO
	return false


func _run() -> void:
	var mode := Core.test_mode
	await _frames(20)
	var ship: STShip = Core.ship
	if mode == "shots" or mode == "all":
		for id in ["bridge", "corridor", "reactor", "workshop", "airlock"]:
			await _place(ship.room_center(id))
			await _shot("s_" + id)
	if mode == "walk" or mode == "all":
		var route := ["corridor", "reactor", "corridor", "workshop", "corridor", "cargo", "corridor", "bridge"]
		await _place(ship.room_center("bridge"))
		for id in route:
			var ok := await _go(ship.room_center(id), 12.0)
			_log("до «%s»: %s, позиция %s, отсек %s" % [ship.rooms[id].n, "дошёл" if ok else "НЕ дошёл", Core.player.global_position, ship.room_at(Core.player.global_position)])
		await _shot("w_end")
	if mode == "events" or mode == "all":
		await _events()
	if mode == "combat" or mode == "all":
		await _combat()
	if mode == "save" or mode == "all":
		await _save()
	if mode == "upgrades" or mode == "all":
		await _upgrades()
	var f := FileAccess.open(out.path_join("log.txt"), FileAccess.WRITE)
	if f:
		f.store_string("\n".join(log_lines))
	get_tree().quit()


func _ev() -> Node:
	return Core.get_meta("events")


func _ss() -> Node:
	return Core.get_meta("shipst")


func _events() -> void:
	var ship: STShip = Core.ship
	var n0 := ship.cells.size()
	for id in ["derelict", "asteroid", "station", "storm"]:
		Core.hud.close_modal()
		_ev().start(id)
		await _frames(5)
		if ship.is_docked():
			var dock := SP.cell_to_px(ship.dock_cell())
			await _place(ship.room_center("airlock"))
			var ok := await _go(dock + Vector2(0, SP.TILE.y * 5.5), 15.0)
			_log("%s: стыковка, клеток %d → %d, путь в конструкцию: %s, отсек %s" % [id, n0, ship.cells.size(), "дошёл" if ok else "НЕ дошёл", ship.room_at(Core.player.global_position)])
			await _shot("e_" + id)
			var why: String = _ev().leave_block()
			_log("%s: отстыковка снаружи запрещена: %s" % [id, why != ""])
			await _place(ship.room_center("airlock"))
		else:
			var br := get_tree().get_nodes_in_group("repairable")
			_log("%s: пробоин и пожаров %d, корпус %d%%" % [id, br.size(), roundi(_ss().hull)])
			if not br.is_empty():
				await _place(br[0].global_position + Vector2(0, 30))
				await _shot("e_" + id)
			for b in br:
				b.repair_by(null)
			await _frames(40)
		if _ev().cur != "":
			_ev().finish()
		await _frames(5)
		Core.hud.close_modal()
		_log("%s: после — клеток %d (было %d), фаза %s, сектор %d" % [id, ship.cells.size(), n0, Core.loop.phase, Core.loop.sector])


func _combat() -> void:
	var ss := _ss()
	var ship: STShip = Core.ship
	for k in ss.res:
		ss.res[k] = 30
	ss.power.engines = 0
	ss.power.medbay = 0
	ss.power.turrets = 3
	ss.power.drones = 1
	await _place(ship.room_center("corridor") + Vector2(-100, 0))
	var b_drone := {}
	var b_laser := {}
	for b in ss.data.builds:
		if b.id == "drone_combat":
			b_drone = b
		if b.id == "turret_laser":
			b_laser = b
	_log("сборка боевого дрона: %s" % ss.build(b_drone))
	await _place(SP.cell_to_px(Vector2i(17, 8)))
	_log("лазерная турель у шлюза: %s, турелей %d" % [ss.build(b_laser), ss.turrets.size()])
	Core.hud.close_modal()
	await _place(SP.cell_to_px(Vector2i(14, 8)))
	var h: STHero = Core.player
	_ev().start("pirates")
	var t := 0.0
	var shot_done := false
	var kills := 0
	var seen := {}
	var hp_log := 0.0
	while t < 150.0 and _ev().cur == "pirates":
		hp_log += 0.25
		if hp_log >= 15.0:
			hp_log = 0.0
			var where := []
			for e in get_tree().get_nodes_in_group("enemy"):
				if e.alive():
					where.append("%s@%s(%s)" % [e.kind, SP.px_to_cell(e.global_position), ship.room_at(e.global_position)])
			_log("t=%d: волна %d, живых %s, герой %d" % [t, _ev().wave_n, ", ".join(where), roundi(h.hp)])
		h.attack()
		for e in get_tree().get_nodes_in_group("enemy"):
			seen[e.get_instance_id()] = e
		await get_tree().create_timer(0.25).timeout
		t += 0.25
		if not shot_done and get_tree().get_nodes_in_group("enemy").size() >= 2 and t > 8.0:
			shot_done = true
			await _shot("c_fight")
	for id in seen:
		var e = instance_from_id(id)
		if e == null or not e.alive():
			kills += 1
	_log("абордаж: %s за %.0f с, врагов было %d, убито %d, корпус %d%%, здоровье героя %d, дронов %d, турелей %d" % [
		"отбит" if _ev().cur == "" else "НЕ окончен", t, seen.size(), kills, roundi(ss.hull), roundi(h.hp), ss.drones.size(), ss.turrets.size()])
	await _frames(5)
	await _shot("c_end")
	Core.hud.close_modal()


func _save() -> void:
	var ss := _ss()
	Core.hud.close_modal()
	ss.res.metal = 17
	ss.hull = 77.0
	Core.loop.sector = 6
	var nd: int = ss.drones.size()
	var nt: int = ss.turrets.size()
	var ok: bool = Core.save.save_game()
	ss.res.metal = 0
	ss.hull = 10.0
	Core.loop.sector = 1
	var ld: bool = Core.save.load_game()
	await _frames(10)
	_log("сохранение %s, загрузка %s: металл %d (17), корпус %d (77), сектор %d (6), дронов %d (%d), турелей %d (%d)" % [
		ok, ld, ss.res.metal, roundi(ss.hull), Core.loop.sector, ss.drones.size(), nd, ss.turrets.size(), nt])
	Core.save.delete_save()


func _upgrades() -> void:
	var ss := _ss()
	Core.hud.close_modal()
	for k in ss.res:
		ss.res[k] = 200
	var bought := 0
	for u in ss.data.upgrades:
		for i in int(u.max):
			if ss.upgrade(u):
				bought += 1
	Core.hud.close_modal()
	ss.set_power("shield", 1)
	ss.set_power("shield", 1)
	await get_tree().create_timer(2.0).timeout
	var sh: float = ss.shield
	var h0: float = ss.hull
	ss.damage_hull(10.0)
	_log("улучшений куплено %d: реактор %d, корпус макс %d, щит %d/%d (после удара 10: корпус %d→%d, щит %d), дронов макс %d, турели макс %d, сканер — точек %d, бластер %d" % [
		bought, ss.reactor, roundi(ss.hull_max()), roundi(sh), roundi(ss.shield_max()), roundi(h0), roundi(ss.hull), roundi(ss.shield),
		ss.drones_max(), ss.sys_max("turrets"), _ev().choices.size(), ss.lvl("blaster")])
	ss.show_upgrades()
	await _shot("u_window")
	Core.hud.close_modal()
