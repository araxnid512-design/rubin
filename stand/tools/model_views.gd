extends SceneTree
## Виды сверху (+Z модели — вниз) и сбоку (+Z — вправо) нескольких GLB в ряд — понять, куда у модели Tripo смотрит перёд
## (ствол, дверцы, ящики). xvfb-run godot4 --path . -s tools/model_views.gd -- <снимок.png> <модель.glb> [...]
func _init() -> void:
	var args := OS.get_cmdline_user_args()
	var out := String(args[0])
	var vp := SubViewport.new()
	vp.size = Vector2i(1024, 512 * ((args.size() - 1 + 1) / 2))
	vp.size = Vector2i(1024, 256 * (args.size() - 1))
	vp.own_world_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.85, 0.85, 0.85)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 1, 1)
	e.ambient_light_energy = 0.8
	env.environment = e
	vp.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-60, 30, 0)
	vp.add_child(sun)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	var n := args.size() - 1
	for i in n:
		for k in 2:
			var doc := GLTFDocument.new()
			var st := GLTFState.new()
			doc.append_from_file(String(args[i + 1]), st)
			var inst: Node3D = doc.generate_scene(st)
			vp.add_child(inst)
			# в ряд: модель i, слева — вид сверху (поворот к камере), справа — сбоку
			if k == 0:
				inst.rotation.x = PI * 0.5        # верх модели — к камере (камера смотрит по −Z): +Z модели → вниз
			else:
				inst.rotation.y = PI * 0.5        # сбоку: +Z модели → вправо
			inst.position = Vector3(-1.2 + k * 2.4, (n - 1) * 1.25 - i * 2.5, 0)
	cam.size = 2.5 * n
	cam.position = Vector3(0, 0, 10)
	cam.current = true
	for i in 10:
		await process_frame
	await RenderingServer.frame_post_draw
	vp.get_texture().get_image().save_png(out)
	quit()
