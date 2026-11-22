extends SceneTree
## Снимок модели спереди для заказа Tripo «по картинке» (переделать модель в высоком качестве, чтобы она
## узнавалась): исходная поза скелета (без движений), ровный свет, белый фон, 1024×1024.
## xvfb-run godot4 --path . -s tools/render_ref.gd -- <модель.glb> <файл.png> [-]  («-» — снимать с другой стороны)
func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		print("нужно: <модель.glb> <файл.png>")
		quit(1)
		return
	var vp := SubViewport.new()
	vp.size = Vector2i(1024, 1024)
	vp.transparent_bg = false
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.own_world_3d = true
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(1, 1, 1)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 1, 1)
	e.ambient_light_energy = 0.55
	e.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	env.environment = e
	vp.add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-35, 20, 0)
	sun.light_energy = 0.75
	vp.add_child(sun)
	var inst: Node3D = (load(args[0]) as PackedScene).instantiate()
	vp.add_child(inst)
	for ap in inst.find_children("*", "AnimationPlayer", true, false):
		(ap as AnimationPlayer).stop()
	for sk in inst.find_children("*", "Skeleton3D", true, false):
		(sk as Skeleton3D).reset_bone_poses()
	await process_frame                   # узлы уже в дереве — можно брать положение в мире
	# рамка по сеткам
	var box := AABB()
	var first := true
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var bb := m.global_transform * m.get_aabb()
		box = bb if first else box.merge(bb)
		first = false
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	var c := box.get_center()
	# лицом модель смотрит вдоль узкой стороны (руки в стороны — вдоль широкой); модели Tripo проекта — к +X
	# (или к +Z, если узкая сторона — по Z)
	var along_x := box.size.x < box.size.z
	var dir := Vector3.RIGHT if along_x else Vector3.BACK
	if args.size() > 2 and String(args[2]) == "-":
		dir = -dir                         # третий аргумент «-» — снимать с другой стороны
	cam.size = maxf(box.size.y, maxf(box.size.x, box.size.z)) * 1.08
	cam.look_at_from_position(c + dir * 5.0, c, Vector3.UP)
	cam.current = true
	sun.look_at_from_position(c + dir * 2.0 + Vector3(0, 2.5, 0) + dir.cross(Vector3.UP) * 1.2, c, Vector3.UP)
	for i in 8:
		await process_frame
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	img.save_png(args[1])
	print("снимок: ", args[1], " рамка ", box.size)
	quit()
