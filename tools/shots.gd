extends Node
## Скриншоты основных игровых экранов → docs/screenshots/
## Запуск: xvfb-run -a godot --rendering-driver opengl3 --resolution 1920x1080 --path . -- shots

var main: Node
var p: Player

func _ready() -> void:
	_run()

func _save(name: String) -> void:
	for i in 6:
		await get_tree().process_frame
	var img := get_viewport().get_texture().get_image()
	img.save_jpg("res://docs/screenshots/%s.jpg" % name, 0.86)
	print("SHOT ", name)

func _tp(pos: Vector3, yaw: float = 0.0) -> void:
	p.global_position = pos
	p.rotation.y = yaw
	p.velocity = Vector3.ZERO
	p.reset_physics_interpolation()
	(p.rig as HumanRig).reset_feet()
	(Game.world.camera as GameCamera).snap()

func _sim(sec: float) -> void:
	var t := Time.get_ticks_msec()
	while (Time.get_ticks_msec() - t) / 1000.0 < sec:
		await get_tree().process_frame

func _run() -> void:
	DirAccess.make_dir_recursive_absolute("res://docs/screenshots")
	Settings.touch_controls = 1
	Settings.apply_preset(2)
	Settings.day_length_min = 600.0
	main = get_tree().root.get_node("Main")
	await _save("01_main_menu")
	await main.new_game()
	p = Game.player as Player
	Game.time_of_day = 9.5
	await _sim(0.5)
	await _save("02_intro")
	main.hud.close_window()
	# прибытие к КПП
	_tp(Vector3(0, 0, 90), 0.0)
	p.auto_walk_target = Vector3(0, 0, 70)
	await _sim(1.2)
	await _save("03_arrival_kpp")
	p.auto_walk_target = null
	# плац с бойцами
	_tp(Vector3(1, 0, -4), PI)
	await _sim(1.0)
	p.rotation.y = 0.0
	await _sim(1.0)
	main.hud.close_window()
	await _save("04_parade_soldiers")
	# в штабе (крыша скрыта)
	_tp(Vector3(-2, 0, -40), 0.4)
	await _sim(1.2)
	main.hud.close_window()
	await _save("05_inside_hq")
	# окна
	Game.inv.add("scrap", 6)
	Game.inv.add("electronics", 2)
	Game.inv.add("medkit", 1)
	main.hud.open("inventory", null)
	await _save("06_inventory")
	main.hud.close_window()
	main.hud.open("map", null)
	await _save("07_map")
	main.hud.close_window()
	main.hud.open("squad", null)
	await _save("08_squad")
	main.hud.close_window()
	main.hud.open("build", null)
	await _save("09_build_menu")
	main.hud.close_window()
	Game.warehouse_add("scrap", 10)
	Game.warehouse_add("tools", 1)
	main.hud.open("building", "generator")
	await _save("10_building_panel_generator")
	main.hud.close_window()
	main.hud.open("journal", null)
	await _save("11_journal")
	main.hud.close_window()
	main.hud.open("settings", "pause")
	await _save("12_settings")
	main.hud.close_window()
	main.hud.open("dialog", "officer")
	await _save("13_dialog_officer")
	main.hud.close_window()
	# ремонт генераторной: леса, техник работает
	Game.warehouse_add("electronics", 2)
	Game.start_job("generator")
	(Game.world.soldiers.s_tech as Soldier).give_order("repair", "generator")
	_tp(Vector3(-14, 0, -58), PI * 0.8)
	(Game.world.soldiers.s_tech as Soldier).global_position = Vector3(-19, 0, -63)
	(Game.world.soldiers.s_tech as Soldier).reset_physics_interpolation()
	await _sim(2.5)
	await _save("14_repair_generator")
	# бой за периметром со слепыми псами
	_tp(Vector3(-100, 0, -112), PI * 0.75)
	for s in ["s_rifleman", "s_gunner"]:
		var so: Soldier = Game.world.soldiers[s]
		so.global_position = Vector3(-98 + randf() * 2, 0, -108)
		so.reset_physics_interpolation()
		so.give_order("follow")
	await _sim(1.0)
	for g in Game.world.enemy_groups:
		if g.gdef.id == "dogs_nw":
			g.alert_all(p)
	p.touch_fire = true
	await _sim(1.6)
	await _save("15_combat_dogs")
	p.touch_fire = false
	p.god_mode = true
	await _sim(2.0)
	# лагерь мародёров
	_tp(Vector3(108, 0, -50), -PI * 0.6)
	await _sim(1.5)
	await _save("16_bandit_camp")
	# ночь, электричество включено
	Game.building_level("generator")
	Game.buildings.generator.level = 1
	Game.buildings.generator.job = ""
	Game.generator_fuel = 20.0
	Game.update_power()
	Events.building_changed.emit("generator")
	Game.time_of_day = 22.5
	Game.world.day_night.update_sky(true)
	_tp(Vector3(0, 0, 8), PI)
	await _sim(1.5)
	await _save("17_night_power")
	Game.time_of_day = 12.0
	Game.world.day_night.update_sky(true)
	# вид на базу с отдалённой камерой
	(Game.world.camera as GameCamera).set_zoom(1.7)
	_tp(Vector3(0, 0, 30), 0.0)
	await _sim(1.0)
	await _save("18_base_overview")
	print("SHOTS DONE")
	get_tree().quit()
