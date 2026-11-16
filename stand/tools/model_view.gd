extends SceneTree
## Просмотр моделей окружения: каждая — отдельный снимок с двух сторон (сбоку и сверху под углом игровой камеры).
## Запуск: godot --path . --resolution 900x500 -s tools/model_view.gd -- --as-out=папка ul_hay ul_oak …

func _init() -> void:
	var out := ""
	var names: Array[String] = []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-out="):
			out = a.substr(9)
		else:
			names.append(a)
	var root := Node3D.new()
	get_root().add_child(root)
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_COLOR
	env.environment.background_color = Color(0.35, 0.4, 0.38)
	env.environment.ambient_light_color = Color(0.7, 0.7, 0.7)
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	root.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 30, 0)
	root.add_child(sun)
	var cam := Camera3D.new()
	root.add_child(cam)
	for n in names:
		var m: Node3D = (load("res://assets/world/%s.glb" % n) as PackedScene).instantiate()
		root.add_child(m)
		for view in [["side", Vector3(0, 0.45, 1.6)], ["top", Vector3(0, 1.5, 0.85)]]:
			cam.position = view[1]
			cam.look_at(Vector3(0, 0.3, 0))
			await process_frame
			await process_frame
			await RenderingServer.frame_post_draw
			get_root().get_texture().get_image().save_png("%s/%s_%s.png" % [out, n, view[0]])
		m.queue_free()
	quit()
