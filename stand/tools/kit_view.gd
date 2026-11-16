extends Node3D
## Осмотр набора предметов (GLB с узлами item_N): все предметы в ряд сеткой, с номерами и размерами.
## Запуск: godot --path . res://tools/kit_view.tscn -- --out=папка [--glb=res://assets/world/ul_supplies.glb]

func _ready() -> void:
	var out := "/tmp/kv"
	var glb := "res://assets/world/ul_supplies.glb"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		if a.begins_with("--glb="):
			glb = a.substr(6)
	DirAccess.make_dir_recursive_absolute(out)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.22, 0.23, 0.25)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color.WHITE
	e.ambient_light_energy = 0.9
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-45, 30, 0)
	add_child(sun)
	var n: Node3D = (load(glb) as PackedScene).instantiate()
	add_child(n)
	# только целые предметы (части «item_N_a / _b» лежат на тех же местах)
	var items := n.find_children("item_*", "MeshInstance3D", true, false).filter(func(x): return String(x.name).count("_") == 1)
	for extra in n.find_children("item_*", "MeshInstance3D", true, false):
		if String(extra.name).count("_") > 1:
			(extra as MeshInstance3D).visible = false
	var cols := 3
	var step := 0.42
	for i in items.size():
		var mi := items[i] as MeshInstance3D
		var bb := mi.get_aabb()
		mi.position = Vector3((i % cols - (cols - 1) * 0.5) * step, 0, (i / cols) * step)
		print(mi.name, " размер ", bb.size.snapped(Vector3.ONE * 0.001))
		var lb := Label3D.new()
		lb.text = "%d" % (i + 1)
		lb.font_size = 48
		lb.pixel_size = 0.0012
		lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lb.no_depth_test = true
		lb.position = mi.position + Vector3(-0.15, 0.02, 0.12)
		add_child(lb)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	add_child(cam)
	cam.current = true
	var rows := ceili(items.size() / float(cols))
	var mid := Vector3(0, 0.1, (rows - 1) * step * 0.5)
	for v in [["front", Vector3(0, 0.9, 1.6)], ["top", Vector3(0, 2.0, 0.01)], ["back", Vector3(0, 0.9, -1.6)]]:
		cam.position = mid + (v[1] as Vector3)
		cam.look_at(mid)
		cam.size = 1.55
		await get_tree().create_timer(0.4).timeout
		get_viewport().get_texture().get_image().save_png("%s/kit_%s.png" % [out, v[0]])
	get_tree().quit()
