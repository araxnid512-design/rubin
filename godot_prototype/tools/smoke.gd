extends Node
## Быстрая проверка: вход в штаб, срабатывание интерьерной зоны (headless).
func _ready() -> void:
	_run()

func _run() -> void:
	var main = get_tree().root.get_node("Main")
	await get_tree().process_frame
	await main.new_game()
	main.hud.close_window()
	var p: Player = Game.player
	p.global_position = Vector3(0, 0, -30)
	p.reset_physics_interpolation()
	for i in 10:
		await get_tree().physics_frame
	var map: RID = Game.world.nav_map()
	var path := NavigationServer3D.map_get_path(map, p.global_position, Vector3(0, 0, -39), true)
	print("SMOKE path ", path)
	for q in [Vector3(0, 0, -42), Vector3(-9, 0, -40), Vector3(-64, 0, -42), Vector3(64, 0, -44), Vector3(18, 0, -72)]:
		print("SMOKE closest to ", q, " = ", NavigationServer3D.map_get_closest_point(map, q))
	for n in get_tree().get_nodes_in_group("interactable"):
		if n is Door and (n as Node3D).global_position.distance_to(p.global_position) < 6.0:
			print("SMOKE door ", (n as Door).door_id, " at ", (n as Node3D).global_position, " open ", (n as Door).is_open)
			(n as Door).interact(p)
	for pt in path:
		p.auto_walk_target = pt
		for i in 60:
			await get_tree().physics_frame
			if Vector2(pt.x - p.global_position.x, pt.z - p.global_position.z).length() < 0.6:
				break
		print("SMOKE reached ", p.global_position, " target ", pt)
	p.auto_walk_target = null
	for i in 10:
		await get_tree().physics_frame
	var hq: Building = Game.world.buildings.hq
	print("SMOKE inside? roof visible ", hq.roof_mi.visible, " overlapping ", hq.area.get_overlapping_bodies(), " area pos ", hq.area.global_position, " monitoring ", hq.area.monitoring)
	print("SMOKE DONE")
	get_tree().quit()
