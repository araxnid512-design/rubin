extends Node3D
## Осмотр моделей оружия: габариты и снимки сбоку / сверху / спереди с сеткой 10% длины — по ним задаются точки хвата.
## Запуск: godot --path . res://tools/weapon_view.tscn -- --out=папка

func _ready() -> void:
	var out := "/tmp/wv"
	var dir := "res://assets/weapons"
	var list := ["w_tt", "w_ak74m", "w_machete_fix", "w_spas12", "w_fnfal", "w_vss", "w_mp5", "w_pkp"]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--out="):
			out = a.substr(6)
		if a.begins_with("--dir="):
			dir = a.substr(6)
		if a.begins_with("--list="):
			list = Array(a.substr(7).split(","))
	DirAccess.make_dir_recursive_absolute(out)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.2, 0.2, 0.22)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color.WHITE
	e.ambient_light_energy = 1.0
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, 30, 0)
	add_child(sun)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	add_child(cam)
	cam.current = true
	get_window().size = Vector2i(900, 600)
	await get_tree().create_timer(0.3).timeout
	for w in list:
		var n: Node3D = (load("%s/%s.glb" % [dir, w]) as PackedScene).instantiate()
		add_child(n)
		var bb := AABB()
		var first := true
		for mi in n.find_children("*", "MeshInstance3D", true, false):
			var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
			bb = a if first else bb.merge(a)
			first = false
		print(w, " aabb pos ", bb.position.snapped(Vector3.ONE * 0.001), " size ", bb.size.snapped(Vector3.ONE * 0.001))
		var c := bb.get_center()
		var L: float = maxf(bb.size.x, maxf(bb.size.y, bb.size.z))
		# сетка: линии через 0.1 от длины по осям X, Y, Z (цвет оси: X красный, Y зелёный, Z синий), ноль — жирнее
		var im := ImmediateMesh.new()
		var mat := StandardMaterial3D.new()
		mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		mat.vertex_color_use_as_albedo = true
		mat.no_depth_test = true
		im.surface_begin(Mesh.PRIMITIVE_LINES, mat)
		for i in range(-10, 11):
			var v := i * 0.1
			var k := 1.0 if i == 0 else (0.75 if i % 5 == 0 else 0.35)
			for ax in 3:
				var col: Color = [Color(1, 0.3, 0.3), Color(0.3, 1, 0.3), Color(0.4, 0.5, 1)][ax] * k
				for oth in 3:
					if oth == ax:
						continue
					var a := Vector3.ZERO
					var b := Vector3.ZERO
					a[ax] = v
					b[ax] = v
					a[oth] = -1.0
					b[oth] = 1.0
					im.surface_set_color(col)
					im.surface_add_vertex(a)
					im.surface_set_color(col)
					im.surface_add_vertex(b)
		im.surface_end()
		var grid := MeshInstance3D.new()
		grid.mesh = im
		add_child(grid)
		cam.size = L * 1.25
		for v in [["x", Vector3.RIGHT, Vector3.UP], ["y", Vector3.UP, Vector3.FORWARD], ["z", Vector3.BACK, Vector3.UP]]:
			cam.global_position = c + (v[1] as Vector3) * 3.0
			cam.look_at(c, v[2])
			await get_tree().process_frame
			await RenderingServer.frame_post_draw
			get_viewport().get_texture().get_image().save_png("%s/%s_from_%s.png" % [out, w, v[0]])
		n.queue_free()
		grid.queue_free()
		await get_tree().process_frame
	get_tree().quit()
