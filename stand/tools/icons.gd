extends Node3D
## Иконки инвентаря: оружие и рюкзаки — снимки 3D-моделей на прозрачном фоне (256×256), оружие — сбоку стволом
## влево, рюкзак — спереди в три четверти. Запуск: godot --path . res://tools/icons.tscn (нужен экран, xvfb).

const OUT := "res://assets/icons/"
const AMMO_YAW := 0.0            ## поворот набора патронов перед камерой


func _ready() -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(256, 256)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.85, 0.88, 0.95)
	e.ambient_light_energy = 0.7
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	vp.add_child(env)
	for r in [Vector3(-35, -40, 0), Vector3(-20, 140, 0)]:
		var l := DirectionalLight3D.new()
		l.rotation_degrees = r
		l.light_energy = 1.3 if r.y < 0 else 0.6
		vp.add_child(l)
	var cam := Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	vp.add_child(cam)
	cam.current = true
	var cfg := BCWeaponHold.config()
	var list := ULItems.ITEMS.duplicate()
	list["crate"] = {"kind": "prop", "model": "res://assets/world/ul_crate.glb"}
	var kits := {}
	# --as-only=a,b — только эти значки (новые предметы), прежние не перерисовываются
	var only := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			only = Array(a.substr(10).split(","))
	for src_id in list:
		var id := String(src_id)
		var d: Dictionary = list[src_id]
		if not only.is_empty() and not only.has(id):
			continue
		var path := ""
		var flip := false
		var is_pack := String(d.kind) == "pack"
		if d.has("weapon"):
			path = String(cfg[d.weapon].model)
			flip = cfg[d.weapon].get("flip", false)
		elif is_pack:
			path = String(BCPackFit.PACKS[d.pack].model)
		elif d.has("model"):
			path = String(d.model) if String(d.model).begins_with("res://") else "res://assets/world/%s.glb" % String(d.model)
			if not ResourceLoader.exists(path):
				continue
			is_pack = true                       # снимается так же — спереди в три четверти
		elif d.has("kit"):
			# предмет из набора: один значок на номер (припасы — kit_N, патроны — ammo_N)
			id = ("ammo_%d" if String(d.get("kitf", "")) == "ammo" else "kit_%d") % int(d.kit)
			if kits.has(id):
				continue
			kits[id] = true
			is_pack = true
		else:
			continue
		var holder := Node3D.new()
		vp.add_child(holder)
		if d.has("kit"):
			var km := MeshInstance3D.new()
			km.mesh = ULItems.kit_mesh(String(src_id))
			holder.add_child(km)
			holder.rotation.y = 0.5
			if String(d.get("kitf", "")) == "ammo":
				# патроны: коробка и патрон рядом, как на фото; если патрон в наборе не получился — берётся соседний
				holder.rotation.y = AMMO_YAW
				if ULItems.kit_mesh(String(src_id), "b") == km.mesh:
					var extra := MeshInstance3D.new()
					extra.mesh = ULItems.kit_mesh("a762x25", "b")
					extra.scale = Vector3(1.12, 0.95, 1.12)
					holder.add_child(extra)
		else:
			var m: Node3D = (load(path) as PackedScene).instantiate()
			holder.add_child(m)
			if flip:
				m.rotation.y = PI
		if d.has("kit"):
			pass
		elif d.has("model"):
			holder.rotation.y = 0.6
			holder.rotation.x = 0.35
		elif is_pack:
			# спинка модели: у малого — −z, у среднего и большого — −x; повернуть лицевой стороной к камере
			holder.rotation.y = (0.0 if String(BCPackFit.PACKS[d.pack].back) == "-z" else -PI * 0.5) + 0.5
		await get_tree().process_frame
		var bb := _aabb(holder)
		var c := bb.get_center()
		if d.has("kit"):
			# стоит ровно, камера чуть сверху
			cam.global_position = c + Vector3(0, 1.3, 3.0)
			cam.look_at(c, Vector3.UP)
			cam.size = maxf(bb.size.y * 1.05, maxf(bb.size.x, bb.size.z) * 1.12) * 1.1
		elif is_pack:
			cam.global_position = c + Vector3(0, 0.05, 3.0)
			cam.look_at(c, Vector3.UP)
			cam.size = maxf(bb.size.y, maxf(bb.size.x, bb.size.z)) * 1.15
		else:
			# сбоку, стволом влево: камера с −X смотрит на +X, справа на экране — приклад (+Z)
			cam.global_position = c + Vector3(-3.0, 0, 0)
			cam.look_at(c, Vector3.UP)
			cam.size = maxf(bb.size.z, bb.size.y) * 1.08
		await RenderingServer.frame_post_draw
		await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.save_png(ProjectSettings.globalize_path(OUT + "%s.png" % id))
		print("[icons] ", id)
		holder.queue_free()
		await get_tree().process_frame
	get_tree().quit()


func _aabb(n: Node3D) -> AABB:
	var bb := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	return bb
