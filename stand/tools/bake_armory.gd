extends SceneTree
## Оружие на витрине оружейной — одной моделью без текстур: каждая модель оружия ставится на своё место (стена,
## стол, прилавок; координаты — в системе дома), цвет берётся из её текстуры в каждую вершину. В игре это одна
## сетка с одним материалом (≈60 тыс. треугольников, рисуется только когда герой в доме) вместо десяти моделей с
## текстурами на ~100 МБ памяти. Запуск: godot --path . --headless -s tools/bake_armory.gd

const OUT := "res://assets/world/ul_armory_guns.res"
## оружие (ключ data/weapons.json), как лежит (wall — на стене плашмя к зрителю, flat — на боку), где (м, дом)
const SHOW := [
	["svd", "wall", Vector3(2.45, 1.72, 1.66)], ["pkp", "wall", Vector3(2.45, 1.38, 1.68)], ["fnfal", "wall", Vector3(2.45, 1.04, 1.66)],
	["rifle", "flat", Vector3(5.2, 0.9, 2.68)], ["mp5", "flat", Vector3(5.2, 0.9, 3.78)],
	["spas12", "flat", Vector3(5.48, 0.9, 2.62)], ["vss", "flat", Vector3(5.48, 0.9, 3.72)],
	["melee", "flat", Vector3(5.76, 0.89, 2.5)], ["pistol", "flat", Vector3(5.76, 0.89, 3.15)], ["beretta", "flat", Vector3(5.76, 0.89, 3.6)],
	["pistol", "flat", Vector3(3.55, 1.08, 2.45)],
]


func _init() -> void:
	var cfg: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://data/weapons.json"))
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var base := 0
	var tris := 0
	for sh in SHOW:
		var w: Dictionary = cfg[sh[0]]
		var node: Node3D = (load(String(w.model)) as PackedScene).instantiate()
		for mi in node.find_children("*", "MeshInstance3D", true, false):
			var m: Mesh = (mi as MeshInstance3D).mesh
			var bb := m.get_aabb()
			var s := float(w.len_m) / bb.size.z
			var rot := Basis(Vector3.UP, PI * 0.5) if String(sh[1]) == "wall" else Basis(Vector3(0, 0, 1), PI * 0.5)
			if w.get("flip", false):
				rot = rot * Basis(Vector3.UP, PI)
			var xf := Transform3D(rot.scaled(Vector3.ONE * s), sh[2]) * Transform3D(Basis.IDENTITY, -bb.get_center())
			for si in m.get_surface_count():
				var a := m.surface_get_arrays(si)
				var vs: PackedVector3Array = a[Mesh.ARRAY_VERTEX]
				var ns: PackedVector3Array = a[Mesh.ARRAY_NORMAL]
				var uv: PackedVector2Array = a[Mesh.ARRAY_TEX_UV]
				var idx: PackedInt32Array = a[Mesh.ARRAY_INDEX]
				var img: Image = null
				var mt := m.surface_get_material(si) as StandardMaterial3D
				if mt and mt.albedo_texture:
					img = mt.albedo_texture.get_image()
					if img.is_compressed():
						img.decompress()
				for i in vs.size():
					var c := Color(0.2, 0.2, 0.22)
					if img != null and uv.size() > i:
						c = img.get_pixel(clampi(int(fposmod(uv[i].x, 1.0) * img.get_width()), 0, img.get_width() - 1), clampi(int(fposmod(uv[i].y, 1.0) * img.get_height()), 0, img.get_height() - 1))
					st.set_color(Color(c.r, c.g, c.b))
					st.set_normal((rot * ns[i]).normalized())
					st.add_vertex(xf * vs[i])
				for i in idx:
					st.add_index(base + i)
				base += vs.size()
				tris += idx.size() / 3
		node.free()
	var mat := StandardMaterial3D.new()
	mat.vertex_color_use_as_albedo = true
	mat.vertex_color_is_srgb = true
	mat.roughness = 0.55
	mat.metallic = 0.25
	st.set_material(mat)
	var mesh := st.commit()
	ResourceSaver.save(mesh, OUT, ResourceSaver.FLAG_COMPRESS)
	print("[armory] оружия на витрине %d, треугольников %d, вершин %d → %s" % [SHOW.size(), tris, base, OUT])
	quit()
