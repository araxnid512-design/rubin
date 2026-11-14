extends Node3D
## Главная сцена BUNKER SURVIVAL: строит мир (поверхность и бункер), героя, камеру и интерфейс; загружает
## сохранение. Автотесты: аргумент --bc-test=<имя> (см. tools/test_runner.gd).

var player: BCPlayer
var cam: BCCamera
var hud: BCHud


func _ready() -> void:
	Core.env.attach(self)
	Core.world.world_root = self
	var t0 := Time.get_ticks_msec()
	Locations.build_surface(self)
	Locations.build_bunker(self)
	print("BunkerCore: мир построен за %d мс" % (Time.get_ticks_msec() - t0))
	player = BCPlayer.new()
	player.name = "Player"
	add_child(player)
	# начало — в жилом отсеке
	player.global_position = Vector3(-5.2, Locations.FLOOR + 0.05, -24.8)
	player.rotation.y = PI
	cam = BCCamera.new()
	add_child(cam)
	cam.set_target(player)
	hud = BCHud.new()
	add_child(hud)
	hud.bind_player(player)
	Core.mobile.apply()
	# зона по месту старта (тела в зонах определяются физикой на следующем кадре)
	await get_tree().physics_frame
	await get_tree().physics_frame
	if Core.save.has_save() and Core.test_mode == "":
		Core.save.load_game()
		Core.say("Сохранение загружено.", "info")
	else:
		Core.say("Убежище. Генератор работает. Снаружи — фон в тысячу раз выше нормы.", "info")
	if Core.test_mode != "":
		var tr: Node = load("res://tools/test_runner.gd").new()
		tr.name = "TestRunner"
		add_child(tr)
