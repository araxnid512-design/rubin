extends Node
## Автотесты BunkerCore под Xvfb: снимки экрана с разных мест, обход героем, замер FPS.
## Запуск: godot --path bunker --rendering-driver opengl3 -- --bc-test=shots --bc-out=/путь

var out := "user://shots"
var log_lines: Array = []


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-out="):
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
	var img := get_viewport().get_texture().get_image()
	img.save_png(out.path_join(name + ".png"))
	var st: Dictionary = Core.mobile.stats()
	_log("%s: fps %.0f (ср. %.0f), кадр %.1f мс, вызовов %d, объектов %d, треуг. %d" % [name, st.fps, st.fps_avg, st.ms, st.draw, st.objects, st.prims])


func _place(p: Vector3, rot := 0.0, yaw := 0.0) -> void:
	var pl: BCPlayer = Core.player
	pl.global_position = p
	pl.rotation.y = rot
	pl.velocity = Vector3.ZERO
	var cam := get_viewport().get_camera_3d()
	cam.yaw = yaw
	await get_tree().physics_frame
	await get_tree().physics_frame
	cam._focus = pl.global_position
	await _frames(20)


func _run() -> void:
	var mode := Core.test_mode
	await _frames(30)
	if mode == "shots" or mode == "all":
		await _place(Vector3(-5.2, -5.95, -24.8), PI)
		await _shot("01_living")
		await _place(Vector3(-2.0, -5.95, -20.8), -PI * 0.5)
		await _shot("02_corridor")
		await _place(Vector3(-14.0, -5.95, -25.0), PI)
		await _shot("03_medbay")
		await _place(Vector3(3.4, -5.95, -16.5), 0)
		await _shot("04_generator")
		await _place(Vector3(10.0, -5.95, -16.0), PI)
		await _shot("05_airlock")
		await _place(Vector3(10.0, -3.0, -7.0), 0)
		await _shot("06_stairs")
		await _place(Vector3(10.0, 0.1, 3.0), PI)
		await _shot("07_portal")
		await _place(Vector3(-9.0, 0.1, 9.0), PI * 0.3)
		await _shot("08_truck")
		await _place(Vector3(18.0, 0.2, -16.0), PI)
		await _shot("09_shed")
		var cam := get_viewport().get_camera_3d()
		cam.zoom = 1.5
		await _place(Vector3(0.0, 0.1, 10.0), PI, 0.6)
		await _shot("10_overview")
		cam.zoom = 1.0
		await _place(Vector3(-9.0, -5.95, -15.8), 0.0)
		await _shot("11_workshop")
		await _place(Vector3(9.0, -5.95, -25.0), PI)
		await _shot("12_greenhouse")
		await _place(Vector3(1.4, -5.95, -25.5), PI)
		await _shot("13_control")
		await _place(Vector3(-14.1, -5.95, -16.0), 0)
		await _shot("14_storage")
	if mode == "probe":
		var pl: BCPlayer = Core.player
		for spot in [[Vector3(-6.0, -5.95, -23.2), Vector3(0, 0, 1)], [Vector3(10.0, -5.95, -13.2), Vector3(0, 0, 1)], [Vector3(-3.5, -5.95, -21.0), Vector3(1, 0, 0)]]:
			await _place(spot[0], 0.0)
			for k in 30:
				var c := pl.move_and_collide(spot[1] * 0.1)
				if c:
					var o := c.get_collider() as Node
					_log("упёрся в %s (%s) у %s" % [o.get_path() if o else "?", o.get_parent().name if o else "", pl.global_position])
					break
	if mode == "surface":
		var cam := get_viewport().get_camera_3d()
		await _place(Vector3(10.0, 0.1, 3.0), PI)
		await _shot("s1_portal")
		await _place(Vector3(-9.0, 0.1, 9.0), PI * 0.3)
		await _shot("s2_truck")
		await _place(Vector3(-18.0, 0.1, -4.0), PI * 0.5)
		await _shot("s3_transformer")
		cam.zoom = 1.5
		await _place(Vector3(2.0, 0.1, 6.0), PI, 0.5)
		await _shot("s4_overview")
		await _place(Vector3(-22.0, 0.1, -26.0), PI, -0.6)
		await _shot("s5_tower")
	if mode == "perf":
		await _perf_test()
	if mode == "interact" or mode == "all" or mode == "sitlie":
		await _interact_test(mode == "sitlie")
	if mode == "walk" or mode == "all":
		await _walk_test()
	var f := FileAccess.open(out.path_join("log.txt"), FileAccess.WRITE)
	if f:
		f.store_string("\n".join(log_lines))
	get_tree().quit()


## обход: идёт по коридору, открывает дверь шлюза, поднимается по лестнице, выходит наружу
func _walk_test() -> void:
	var pl: BCPlayer = Core.player
	await _place(Vector3(-6.0, -5.95, -25.0), PI)
	var path := [Vector3(-6.0, 0, -21.0), Vector3(9.6, 0, -20.8), Vector3(10.0, 0, -18.0)]
	for p in path:
		await _go(p, 12.0)
	_log("у шлюза: %s, зона %s" % [pl.global_position, Core.world.current.name])
	await _place(Vector3(10.0, -5.95, -13.6), 0)
	await _go(Vector3(10.0, 0, -1.8), 15.0, true)
	_log("лестница: %s, зона %s, под землёй %s" % [pl.global_position, Core.world.current.name, Core.world.underground])
	await _shot("20_walk_top")


func _go(p: Vector3, timeout: float, run := false) -> void:
	var pl: BCPlayer = Core.player
	var t := 0.0
	pl.sprint_held = run
	while t < timeout:
		var d := p - pl.global_position
		d.y = 0
		if d.length() < 0.5:
			break
		var cam := get_viewport().get_camera_3d()
		var yaw: float = cam.yaw
		# мировое направление → вход джойстика (x — вправо, y — вперёд от камеры)
		var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
		var right := Vector3(cos(yaw), 0, -sin(yaw))
		var dn := d.normalized()
		pl.move_input = Vector2(dn.dot(right), dn.dot(fwd))
		# дверь на пути — открыть
		if pl.target and pl.target is BCDoor and not pl.target.is_open:
			_log("открываю: %s" % pl.target.label)
			pl.do_interact()
			await get_tree().create_timer(2.8).timeout
		if int(t * 60) % 120 == 0:
			_log("  идёт: %s → %s, цель %s, состояние %s" % [pl.global_position.snapped(Vector3(0.01, 0.01, 0.01)), p, pl.target.label if pl.target and "label" in pl.target else str(pl.target), pl.state])
		await get_tree().physics_frame
		t += 1.0 / 60.0
	pl.move_input = Vector2.ZERO
	pl.sprint_held = false


## взаимодействия: подойти, нажать «Действие», снимок посреди клипа, проверка результата
func _interact_test(only_sit := false) -> void:
	var pl: BCPlayer = Core.player
	var cases := [
		["terminal", Vector3(1.4, -5.95, -27.6), PI, "i1_terminal"],
		["chair_live", Vector3(-3.3, -5.95, -24.5), -PI * 0.5, "i2_chair"],
		["bed2", Vector3(-6.6, -5.95, -27.4), -PI * 0.5, "i3_bed"],
		["aidkit", Vector3(-11.2, -5.95, -26.0), PI * 0.5, "i4_pickup"],
		["suit", Vector3(8.6, -5.95, -16.3), -PI * 0.5, "i5_suit"],
		["medbay", Vector3(-13.1, -5.95, -27.6), PI * 0.5, "i6_medbay"],
	]
	for c in cases:
		if only_sit and not (c[0] in ["chair_live", "bed2"]):
			continue
		await _place(c[1], c[2])
		await _frames(10)
		var t = pl.target
		var tid: String = (t.point_id if t is BCInteract else str(t)) if t else "нет"
		_log("%s: цель «%s» (%s)" % [c[0], t.interact_label() if t else "—", tid])
		var dose0 := pl.dose
		pl.dose = 180.0 if c[0] == "medbay" else pl.dose
		pl.hp = 60.0 if c[0] == "medbay" else pl.hp
		pl.do_interact()
		await get_tree().create_timer(1.0).timeout
		await _shot(c[3])
		await get_tree().create_timer(3.5).timeout
		_log("  после: состояние %s, костюм %s, инвентарь %s, доза %.0f, здоровье %.0f" % [pl.state, pl.suit_on, pl.inventory, pl.dose, pl.hp])
		if pl.state == "sit" or pl.state == "lie":
			await _shot(c[3] + "_hold")
			pl.do_interact()
			await get_tree().create_timer(2.5).timeout
			_log("  встал: состояние %s" % pl.state)
		Core.hud.close_modal()
	if only_sit:
		return
	# костюм обратно и удар по мародёру на поверхности
	if pl.suit_on:
		pl.toggle_suit()
	await _place(Vector3(22.4, 0.3, -11.0), PI)
	var raider: Node = get_tree().get_first_node_in_group("enemy")
	if raider:
		raider.global_position = Vector3(22.4, 0.3, -12.3)
		raider.rotation.y = 0.0
		raider.state = "idle"
		await _frames(5)
		for k in 3:
			pl.rotation.y = PI
			pl.attack()
			await get_tree().create_timer(0.7).timeout
			if k == 0:
				await _shot("i7_punch")
			await get_tree().create_timer(1.2).timeout
		_log("мародёр: здоровье %.0f, состояние %s; герой: здоровье %.0f" % [raider.hp, raider.state, pl.hp])
		await _shot("i8_fight")


## замер производительности: маршрут по бункеру и поверхности бегом, каждые 0.5 с — FPS, время кадра,
## вызовы отрисовки, объекты, треугольники, память; итог — среднее, 1% худших кадров, максимум
func _perf_test() -> void:
	var pl: BCPlayer = Core.player
	var route := [
		["бункер", Vector3(-6.0, -5.95, -25.0), [Vector3(-6.0, 0, -21.0), Vector3(9.6, 0, -20.8), Vector3(10.0, 0, -18.0), Vector3(10.0, 0, -13.4)]],
		["лестница и выход", Vector3(10.0, -5.95, -13.6), [Vector3(10.0, 0, -1.6), Vector3(10.0, 0, 4.0)]],
		["поверхность", Vector3(10.0, 0.1, 4.0), [Vector3(-8.0, 0, 10.0), Vector3(-20.0, 0, -6.0), Vector3(16.0, 0, -18.0), Vector3(10.0, 0, 4.0)]],
	]
	var all_ms: Array = []
	for leg in route:
		await _place(leg[1], 0.0)
		var samples: Array = []
		var t := 0.0
		for p in leg[2]:
			var start := Time.get_ticks_msec()
			pl.sprint_held = true
			while Time.get_ticks_msec() - start < 20000:
				var d: Vector3 = p - pl.global_position
				d.y = 0
				if d.length() < 0.6:
					break
				var cam := get_viewport().get_camera_3d()
				var yaw: float = cam.yaw
				var fwd := Vector3(-sin(yaw), 0, -cos(yaw))
				var right := Vector3(cos(yaw), 0, -sin(yaw))
				pl.move_input = Vector2(d.normalized().dot(right), d.normalized().dot(fwd))
				if pl.target and pl.target is BCDoor and not pl.target.is_open:
					pl.do_interact()
				await get_tree().process_frame
				var ms := get_process_delta_time() * 1000.0
				all_ms.append(ms)
				t += ms
				if t > 500.0:
					t = 0.0
					samples.append(Core.mobile.stats())
		pl.move_input = Vector2.ZERO
		pl.sprint_held = false
		var dc := 0.0
		var ob := 0.0
		var tr := 0.0
		for s in samples:
			dc += s.draw
			ob += s.objects
			tr += s.prims
		var n: float = maxf(samples.size(), 1)
		_log("%s: вызовов отрисовки %.0f, объектов %.0f, треугольников %.0fк (среднее по %d замерам)" % [leg[0], dc / n, ob / n, tr / n / 1000.0, samples.size()])
	all_ms.sort()
	var sum := 0.0
	for m in all_ms:
		sum += m
	var avg: float = sum / maxf(all_ms.size(), 1)
	var p99: float = all_ms[int(all_ms.size() * 0.99)] if all_ms.size() > 0 else 0.0
	_log("Итог: кадров %d, среднее %.1f мс (%.0f FPS), 1%% худших — %.1f мс, максимум %.1f мс, ОЗУ %.0f МБ, видео %.0f МБ" % [all_ms.size(), avg, 1000.0 / maxf(avg, 0.001), p99, all_ms[-1] if all_ms.size() > 0 else 0.0, Core.mobile.stats().mem_mb, Core.mobile.stats().vram_mb])

