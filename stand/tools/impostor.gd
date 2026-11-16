extends SceneTree
## Спрайты растений с моделей (Poly Haven, CC0): модель glTF рисуется сбоку чуть сверху на прозрачном фоне —
## получается карточка с альфой для пучков травы, крапивы, сорняков, кустов (на телефоне — две-три полоски
## вместо десятков тысяч треугольников модели).
## Запуск: godot --path . --resolution 512x512 -s tools/impostor.gd -- --as-src=папка/модель.gltf --as-out=файл.png [--as-yaw=0] [--as-tilt=18]

func _init() -> void:
	_run.call_deferred()


func _run() -> void:
	await process_frame
	var src := ""
	var out := ""
	var yaw := 0.0
	var tilt := 18.0
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-src="):
			src = a.substr(9)
		elif a.begins_with("--as-out="):
			out = a.substr(9)
		elif a.begins_with("--as-yaw="):
			yaw = float(a.substr(9))
		elif a.begins_with("--as-tilt="):
			tilt = float(a.substr(10))
	var vp := SubViewport.new()
	vp.size = Vector2i(512, 512)
	vp.transparent_bg = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	get_root().add_child(vp)
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	if doc.append_from_file(src, st) != OK:
		print("не прочитался ", src)
		quit()
		return
	var model: Node3D = doc.generate_scene(st)
	vp.add_child(model)
	model.rotation_degrees.y = yaw
	await process_frame
	var env := WorldEnvironment.new()
	env.environment = Environment.new()
	env.environment.background_mode = Environment.BG_CLEAR_COLOR
	env.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.environment.ambient_light_color = Color(0.62, 0.64, 0.6)
	env.environment.ambient_light_energy = 0.9
	vp.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, 35, 0)
	sun.light_energy = 1.1
	vp.add_child(sun)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	# в модели Poly Haven несколько вариантов растения в ряд — каждый снимается отдельно
	var meshes := model.find_children("*", "MeshInstance3D", true, false)
	var k := 0
	for m in meshes:
		for o in meshes:
			(o as MeshInstance3D).visible = o == m
		var mi := m as MeshInstance3D
		var bb := mi.global_transform * mi.get_aabb()
		var c := bb.get_center()
		var ext := maxf(maxf(bb.size.x, bb.size.z), bb.size.y)
		cam.size = ext * 1.06
		var d := ext * 3.0
		var t := deg_to_rad(tilt)
		var pos := c + Vector3(0, sin(t), cos(t)) * d
		cam.transform = Transform3D(Basis.looking_at(c - pos, Vector3.UP), pos)
		cam.near = 0.01
		cam.far = d * 4.0
		for i in 4:
			await process_frame
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.convert(Image.FORMAT_RGBA8)
		var f := out.get_basename() + "_%d.png" % k
		img.save_png(f)
		print("снимок ", f, " размер ", bb.size)
		k += 1
	quit()
