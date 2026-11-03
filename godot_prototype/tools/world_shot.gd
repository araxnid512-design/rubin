extends Node
## Строит мир без персонажей и снимает обзорные кадры → docs/worldtest/*.png

var world: GameWorld
var cam: Camera3D

func _ready() -> void:
	_run()

func _shot(name: String, pos: Vector3, look: Vector3, fov: float = 45.0, ortho: float = 0.0) -> void:
	for n in world.find_children("*", "GeometryInstance3D", true, false):
		(n as GeometryInstance3D).visibility_range_end = 0.0 if pos.y > 60.0 else Settings.draw_distance
	if ortho > 0.0:
		cam.projection = Camera3D.PROJECTION_ORTHOGONAL
		cam.size = ortho
	else:
		cam.projection = Camera3D.PROJECTION_PERSPECTIVE
		cam.fov = fov
	cam.far = 600.0
	cam.position = pos
	cam.look_at(look, Vector3.UP if absf((look - pos).normalized().y) < 0.99 else Vector3.FORWARD)
	RenderingServer.global_shader_parameter_set("player_pos", Vector3(0, -50, 0))
	for i in 4:
		await get_tree().process_frame
	get_viewport().get_texture().get_image().save_png("res://docs/worldtest/%s.png" % name)

func _run() -> void:
	DirAccess.make_dir_recursive_absolute("res://docs/worldtest")
	world = GameWorld.new()
	get_tree().root.add_child(world)
	var t := Time.get_ticks_msec()
	await world.build_async(false)
	print("WORLD BUILD MS: ", Time.get_ticks_msec() - t)
	cam = Camera3D.new()
	world.add_child(cam)
	cam.current = true
	Game.time_of_day = 13.0
	world.day_night.update_sky(true)
	var shots := OS.get_cmdline_user_args()
	await _shot("overview", Vector3(0, 400, 0.1), Vector3.ZERO, 45.0, 310.0)
	await _shot("base_center", Vector3(0, 22, 4), Vector3(0, 0, -16), 50.0)
	await _shot("kpp", Vector3(0, 20, 104), Vector3(0, 0, 84), 50.0)
	await _shot("hq", Vector3(-6, 24, -12), Vector3(0, 0, -36), 50.0)
	await _shot("generator_radio", Vector3(0, 26, -46), Vector3(0, 0, -72), 50.0)
	await _shot("warehouse", Vector3(40, 26, -24), Vector3(62, 0, -40), 50.0)
	await _shot("barracks", Vector3(-40, 26, -24), Vector3(-62, 0, -40), 50.0)
	await _shot("outskirts_bandits", Vector3(110, 26, -40), Vector3(124, 0, -62), 50.0)
	await _shot("aerial", Vector3(-60, 120, 160), Vector3(0, 0, -20), 50.0)
	Game.time_of_day = 22.5
	Game.power_on = true
	RenderingServer.global_shader_parameter_set("power_on", 1.0)
	world.day_night.update_sky(true)
	await _shot("night_center", Vector3(0, 22, 4), Vector3(0, 0, -16), 50.0)
	get_tree().quit()
