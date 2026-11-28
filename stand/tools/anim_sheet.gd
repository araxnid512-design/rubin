extends SceneTree
## Раскадровка клипов на модели героя — посмотреть движение глазами до того, как ставить его в игру.
## Клип накладывается на скелет напрямую (без дерева анимаций и без постановки стоп), по строке на клип,
## кадры — через равные промежутки. Камера держит таз в центре кадра (уход корня не мешает сравнивать).
##   godot4 --path . -s tools/anim_sheet.gd -- --out=/путь/лист.png --clips=res://assets/anim/hero/walk.res,/путь/q_walk_loop.res
##       [--model=res://assets/models/hero.glb] [--frames=8] [--view=side|front|34]
## Нужен экран (xvfb-run).

func _init() -> void:
	var out := ""
	var clips: PackedStringArray = []
	var model := "res://assets/models/hero.glb"
	var frames := 8
	var view := "34"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		elif a.begins_with("--clips="):
			clips = a.substr(8).split(",")
		elif a.begins_with("--model="):
			model = a.substr(8)
		elif a.begins_with("--frames="):
			frames = int(a.substr(9))
		elif a.begins_with("--view="):
			view = a.substr(7)
	const CW := 240
	const CH := 330
	var vp := SubViewport.new()
	vp.size = Vector2i(CW, CH)
	vp.own_world_3d = true
	vp.transparent_bg = false
	vp.msaa_3d = Viewport.MSAA_2X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.82, 0.84, 0.86)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 1, 1)
	e.ambient_light_energy = 0.7
	env.environment = e
	vp.add_child(env)
	var key := DirectionalLight3D.new()
	key.rotation_degrees = Vector3(-50, 40, 0)
	key.light_energy = 1.1
	vp.add_child(key)
	var cam := Camera3D.new()
	cam.fov = 30.0
	vp.add_child(cam)
	var inst: Node3D = (load(model) as PackedScene).instantiate()
	vp.add_child(inst)
	var skel: Skeleton3D = inst.find_children("*", "Skeleton3D", true, false)[0]
	# пол — тёмная плита на высоте нижней точки стоп в исходной позе
	await process_frame
	await process_frame
	var sx := skel.global_transform
	var low := INF
	var top := -INF
	for n in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase", "Head"]:
		var b := skel.find_bone(n)
		if b >= 0:
			var y := (sx * skel.get_bone_global_rest(b).origin).y
			low = minf(low, y)
			top = maxf(top, y)
	var h := (top - low) * 1.12
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(h * 6.0, h * 6.0)
	fl.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.55, 0.57, 0.6)
	fl.material_override = fm
	vp.add_child(fl)
	var hip := skel.find_bone("Hip")
	var lth := skel.find_bone("L_Thigh")
	var rth := skel.find_bone("R_Thigh")
	var lat: Vector3 = (sx.basis * (skel.get_bone_global_rest(lth).origin - skel.get_bone_global_rest(rth).origin)).normalized()
	var fwd := lat.cross(Vector3.UP).normalized()
	var toe: Vector3 = sx.basis * (skel.get_bone_global_rest(skel.find_bone("L_ToeBase")).origin - skel.get_bone_global_rest(skel.find_bone("L_Foot")).origin)
	if toe.dot(fwd) < 0.0:
		fwd = -fwd
	var dir := (fwd * 0.75 - lat * 0.66).normalized()
	if view == "side":
		dir = -lat
	elif view == "front":
		dir = fwd
	var sheet := Image.create(CW * frames, CH * clips.size(), false, Image.FORMAT_RGB8)
	for ci in clips.size():
		var a: Animation = load(clips[ci]) if String(clips[ci]).begins_with("res://") else ResourceLoader.load(clips[ci])
		if a == null:
			print("[sheet] нет клипа ", clips[ci])
			continue
		for f in frames:
			var t := a.length * float(f) / float(frames)
			skel.reset_bone_poses()
			for ti in a.get_track_count():
				var p := String(a.track_get_path(ti))
				var b := skel.find_bone(p.substr(p.rfind(":") + 1))
				if b < 0:
					continue
				if a.track_get_type(ti) == Animation.TYPE_ROTATION_3D:
					skel.set_bone_pose_rotation(b, a.rotation_track_interpolate(ti, t))
				elif a.track_get_type(ti) == Animation.TYPE_POSITION_3D:
					skel.set_bone_pose_position(b, a.position_track_interpolate(ti, t))
			var hp: Vector3 = sx * skel.get_bone_global_pose(hip).origin
			var mid := Vector3(hp.x, low + h * 0.5, hp.z)
			fl.global_position = Vector3(hp.x, low - 0.001, hp.z)
			cam.look_at_from_position(mid + dir * (h * 0.5 / tan(deg_to_rad(cam.fov * 0.5)) * 1.25) + Vector3.UP * h * 0.18, mid)
			for i in 3:
				await process_frame
			var img := vp.get_texture().get_image()
			img.convert(Image.FORMAT_RGB8)
			sheet.blit_rect(img, Rect2i(0, 0, CW, CH), Vector2i(f * CW, ci * CH))
		print("[sheet] %d: %s (%.2f с)" % [ci + 1, String(clips[ci]).get_file(), a.length])
	sheet.save_png(out)
	print("[sheet] записан ", out)
	quit()
