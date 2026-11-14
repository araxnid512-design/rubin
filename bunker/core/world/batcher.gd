class_name BCBatcher
## Объединение неподвижной геометрии BunkerCore (статический батчинг): все MeshInstance3D предметов, стен и
## полов внутри root собираются в сетки по участкам (квадраты chunk×chunk метров) и материалам — вместо сотен
## вызовов отрисовки десятки. Отсечение по видимости работает по участкам. Не трогаются: двери (движутся),
## потолки и крыши (скрываются), светильники, подбираемые предметы, костюм на вешалке, персонажи, трава.

static func batch(root: Node3D, chunk := 12.0) -> Dictionary:
	var groups := {}          # ключ участка → {материал → [[сетка, поверхность, xf]]}
	var shadow := {}          # ключ участка → отбрасывает ли тень
	var removed := 0
	var inv := root.global_transform.affine_inverse()
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if not _ok(mi, root):
			continue
		var m: Mesh = mi.mesh
		var xf: Transform3D = inv * mi.global_transform
		var c := xf * m.get_aabb().get_center()
		var key := Vector2i(floori(c.x / chunk), floori(c.z / chunk))
		if not groups.has(key):
			groups[key] = {}
			shadow[key] = false
		for s in m.get_surface_count():
			var mat: Material = mi.get_surface_override_material(s)
			if mat == null:
				mat = m.surface_get_material(s)
			if mat == null:
				continue
			if not groups[key].has(mat):
				groups[key][mat] = []
			groups[key][mat].append([m, s, xf])
		if mi.cast_shadow != GeometryInstance3D.SHADOW_CASTING_SETTING_OFF:
			shadow[key] = true
		mi.visible = false
		mi.set_meta("bc_batched", true)
		removed += 1
	var made := 0
	for key in groups:
		var am := ArrayMesh.new()
		for mat in groups[key]:
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			for it in groups[key][mat]:
				st.append_from(it[0], it[1], it[2])
			var arrays := st.commit_to_arrays()
			if arrays[Mesh.ARRAY_VERTEX] == null or (arrays[Mesh.ARRAY_VERTEX] as PackedVector3Array).is_empty():
				continue
			am.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
			am.surface_set_material(am.get_surface_count() - 1, mat)
		if am.get_surface_count() == 0:
			continue
		var out := MeshInstance3D.new()
		out.name = "Batch_%d_%d" % [key.x, key.y]
		out.mesh = am
		out.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if shadow[key] else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		root.add_child(out)
		made += 1
	# исходные узлы больше не рисуются — освобождаем сетки (коллизии остаются)
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		if mi.has_meta("bc_batched"):
			mi.queue_free()
	return {"removed": removed, "made": made}


static func _ok(mi: MeshInstance3D, root: Node3D) -> bool:
	if mi.mesh == null or not mi.visible:
		return false
	if not (mi.mesh is ArrayMesh or mi.mesh is PrimitiveMesh):
		return false
	if mi.skin != null or mi.get_parent() is Skeleton3D:
		return false
	if mi.is_in_group("roof") or mi.is_in_group("suit_hanger"):
		return false
	var n: Node = mi
	while n and n != root:
		if n is BCDoor or n is BCLight or n is CharacterBody3D or n is Skeleton3D or n is BCInteract:
			return false
		if n.is_in_group("roof") or n.is_in_group("suit_hanger") or n.has_meta("pickup_mesh") or n.has_meta("no_batch"):
			return false
		if n is Node3D and not (n as Node3D).visible:
			return false
		n = n.get_parent()
	return true
