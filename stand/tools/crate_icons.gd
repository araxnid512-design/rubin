extends SceneTree
## Картинки ящиков с добычей для окна «Сборка ящиков» — снимки настоящих моделей игры (assets/world/xd_crate*.glb)
## на прозрачном фоне: assets/icons/crate_<вид>.png. Запуск (нужен экран, например xvfb-run):
##   godot4 --path . -s tools/crate_icons.gd
## Какая модель у какого ящика — data/crates.json (поле model). --yaw=градусы — с какой стороны снимать.

func _init() -> void:
	var yaw := 35.0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--yaw="):
			yaw = float(a.substr(6))
	var vp := SubViewport.new()
	vp.size = Vector2i(640, 480)
	vp.own_world_3d = true
	vp.transparent_bg = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 1, 1)
	e.ambient_light_energy = 0.55
	env.environment = e
	vp.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-48, 30, 0)
	key.light_energy = 1.25
	vp.add_child(key)
	var rim := DirectionalLight3D.new()
	rim.rotation_degrees = Vector3(-20, -140, 0)
	rim.light_energy = 0.5
	vp.add_child(rim)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	cam.fov = 28.0
	vp.add_child(cam)
	await process_frame
	await process_frame
	for c in ULCrates.list():
		var path := "res://assets/world/%s.glb" % String(c.model)
		if not ResourceLoader.exists(path):
			print("нет модели ", path)
			continue
		var inst: Node3D = (load(path) as PackedScene).instantiate()
		vp.add_child(inst)
		var bb := AABB()
		var first := true
		for mi in inst.find_children("*", "MeshInstance3D", true, false):
			var m := mi as MeshInstance3D
			var b: AABB = m.global_transform * m.mesh.get_aabb()
			bb = b if first else bb.merge(b)
			first = false
		var ctr := bb.get_center()
		var r := bb.size.length() * 0.5
		var dir := Basis(Vector3.UP, deg_to_rad(yaw)) * Basis(Vector3.RIGHT, deg_to_rad(-24.0)) * Vector3(0, 0, 1)
		cam.look_at_from_position(ctr + dir * (r / tan(deg_to_rad(cam.fov * 0.5)) * 1.08), ctr)
		for i in 4:
			await process_frame
		var img := vp.get_texture().get_image()
		var used := img.get_used_rect().grow(12).intersection(Rect2i(Vector2i.ZERO, img.get_size()))
		img = img.get_region(used)
		var out := "res://assets/icons/crate_%s.png" % String(c.id)
		img.save_png(ProjectSettings.globalize_path(out))
		print("%s: %s (%d × %d), модель %s, размер %.2f × %.2f × %.2f" % [String(c.n), out, img.get_width(), img.get_height(), String(c.model), bb.size.x, bb.size.y, bb.size.z])
		inst.queue_free()
		await process_frame
	quit()
