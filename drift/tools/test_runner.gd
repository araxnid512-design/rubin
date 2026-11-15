extends Node
## Автотесты «Дрейфа» под Xvfb: --st-test=<режим> --st-out=<папка>.
##   shots — снимки отсеков; walk — проход героя по кораблю (двери, стены).

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
	var f := FileAccess.open(out.path_join("log.txt"), FileAccess.WRITE)
	if f:
		f.store_string("\n".join(log_lines))
	get_tree().quit()
