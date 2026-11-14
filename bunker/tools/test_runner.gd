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
