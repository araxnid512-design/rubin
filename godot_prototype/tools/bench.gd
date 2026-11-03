extends Node
## Замер производительности по точкам маршрута для трёх пресетов качества → docs/performance.md
## Запуск: xvfb-run -a godot --rendering-driver opengl3 --resolution 1280x720 --path . -- bench

var main: Node
var p: Player
var rows: Array = []
var _dts: Array = []
var _measuring := false

const SPOTS := [
	["КПП (въезд)", Vector3(0, 0, 92), 0.0],
	["Плац, 6 бойцов", Vector3(0, 0, -4), 0.0],
	["Внутри штаба", Vector3(-2, 0, -40), 0.0],
	["Склад / мастерская", Vector3(50, 0, -10), 0.0],
	["Окраина: лес и аномалии", Vector3(120, 0, 30), 0.0],
	["Лагерь мародёров (бой ИИ)", Vector3(110, 0, -50), 0.0],
	["Отдалённая камера над базой", Vector3(0, 0, 10), 0.0],
]

func _ready() -> void:
	_run()

func _process(delta: float) -> void:
	if _measuring:
		_dts.append(delta)

func _tp(pos: Vector3, yaw: float) -> void:
	p.global_position = pos
	p.rotation.y = yaw
	p.reset_physics_interpolation()
	(p.rig as HumanRig).reset_feet()
	(Game.world.camera as GameCamera).snap()

func _measure(sec: float) -> Dictionary:
	_dts.clear()
	var dc := 0.0
	var prim := 0.0
	var proc := 0.0
	var phys := 0.0
	var n := 0
	_measuring = true
	var t := Time.get_ticks_msec()
	while (Time.get_ticks_msec() - t) / 1000.0 < sec:
		await get_tree().process_frame
		dc += Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME)
		prim += Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME)
		proc += Performance.get_monitor(Performance.TIME_PROCESS)
		phys += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)
		n += 1
	_measuring = false
	var arr := _dts.duplicate()
	arr.sort()
	var avg := 0.0
	for d in arr:
		avg += d
	avg /= maxf(1, arr.size())
	var p95: float = arr[int(arr.size() * 0.95)] if arr.size() > 0 else 0.0
	return {"fps": 1.0 / maxf(avg, 0.0001), "ms": avg * 1000.0, "p95": p95 * 1000.0, "dc": dc / maxf(n, 1), "prim": prim / maxf(n, 1),
		"proc": proc / maxf(n, 1) * 1000.0, "phys": phys / maxf(n, 1) * 1000.0}

func _run() -> void:
	main = get_tree().root.get_node("Main")
	Settings.day_length_min = 600.0
	Settings.touch_controls = 1
	var tb := Time.get_ticks_msec()
	await main.new_game()
	var build_ms := Time.get_ticks_msec() - tb
	main.hud.close_window()
	p = Game.player as Player
	p.god_mode = true
	Game.time_of_day = 12.0
	for s in Game.world.soldiers.values():
		(s as Soldier).give_order("follow")
	var adapter := RenderingServer.get_video_adapter_name()
	var out := "# Замеры производительности\n\n"
	out += "Устройство замера: `%s` (%s), окно %s, Godot %s, рендерер Compatibility (OpenGL ES 3 / GL 3.3).\n\n" % [adapter, RenderingServer.get_video_adapter_api_version(), str(get_viewport().get_visible_rect().size), Engine.get_version_info().string]
	out += "Время построения локации (генерация 300×300 м + навмеш): **%.1f с**.\n\n" % (build_ms / 1000.0)
	out += "Статика мира: %s вершин в чанках, %s вершин растительности, %s коллизионных боксов, %s пучков травы, навмеш %d полигонов.\n\n" % [Game.world.stats.get("verts"), Game.world.stats.get("fol_verts"), Game.world.stats.get("boxes"), Game.world.stats.get("grass"), Game.world.nav_mesh.get_polygon_count()]
	for q in [0, 1, 2]:
		Settings.apply_preset(q)
		Settings.fps_limit = 0
		Settings.apply()
		Engine.max_fps = 0
		Game.world.apply_quality()
		out += "## Пресет «%s»\n\n| Точка | FPS | кадр, мс | p95, мс | draw calls | треугольники | скрипты, мс | физика, мс |\n|---|---|---|---|---|---|---|---|\n" % Settings.PRESETS[q].name
		for sp in SPOTS:
			_tp(sp[1], sp[2])
			(Game.world.camera as GameCamera).set_zoom(1.7 if String(sp[0]).begins_with("Отдал") else 1.0)
			for s in Game.world.soldiers.values():
				var so := s as Soldier
				so.global_position = p.global_position + Vector3(randf_range(-4, 4), 0, randf_range(3, 6))
				so.reset_physics_interpolation()
			await _measure(0.8)
			var r := await _measure(3.0)
			out += "| %s | %.0f | %.1f | %.1f | %.0f | %.0fk | %.2f | %.2f |\n" % [sp[0], r.fps, r.ms, r.p95, r.dc, r.prim / 1000.0, r.proc, r.phys]
			print(Settings.PRESETS[q].name, " ", sp[0], " ", r)
		out += "\n"
	var f := FileAccess.open("res://docs/performance.md", FileAccess.WRITE)
	f.store_string(out)
	f.close()
	print("BENCH DONE")
	get_tree().quit()
