class_name BCGrass
extends MultiMeshInstance3D
## Сухая трава BunkerCore: тысячи пучков одним MultiMesh (один вызов отрисовки), карточки крест-накрест с
## процедурной текстурой стеблей, покачивание ветром в вершинном шейдере, без теней. Плотность — по качеству.

static var _tex: Texture2D


static func make(terrain: BCTerrain, count: int, seed := 3, avoid: Array = []) -> BCGrass:
	var g := BCGrass.new()
	g.name = "Grass"
	g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = true
	mm.mesh = _clump_mesh()
	var r := RandomNumberGenerator.new()
	r.seed = seed
	var xfs := []
	var tries := 0
	var half := terrain.size * 0.5 - 1.0
	while xfs.size() < count and tries < count * 6:
		tries += 1
		var x := r.randf_range(-half, half)
		var z := r.randf_range(-half, half)
		if terrain.road_mask(x, z) > 0.2:
			continue
		var bad := false
		for a in avoid:
			if (a as Rect2).has_point(Vector2(x, z)):
				bad = true
				break
		if bad:
			continue
		# пятнами: где шум «травы» высокий — гуще
		var n := terrain._noise.get_noise_2d(x * 1.7 + 40.0, z * 1.7)
		if r.randf() > clampf(n * 2.2 + 0.75, 0.05, 1.0):
			continue
		var y := terrain.height_at(x, z)
		var s := r.randf_range(0.6, 1.25)
		var b := Basis(Vector3.UP, r.randf() * TAU).scaled(Vector3(s, s * r.randf_range(0.8, 1.3), s))
		xfs.append([Transform3D(b, Vector3(x, y - 0.02, z)), Color(r.randf_range(0.8, 1.1), r.randf_range(0.85, 1.0), r.randf_range(0.7, 0.95))])
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i][0])
		mm.set_instance_color(i, xfs[i][1])
	g.multimesh = mm
	return g


static func _clump_mesh() -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var w := 0.32
	var h := 0.55
	for k in 3:
		var a := k * PI / 3.0
		var d := Vector3(cos(a), 0, sin(a)) * w
		var n := Vector3(-sin(a), 0.6, cos(a)).normalized()
		var p := [-d, d, d + Vector3(0, h, 0), -d + Vector3(0, h, 0)]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for idx in [0, 2, 1, 0, 3, 2]:
			st.set_normal(n)
			st.set_uv(uv[idx])
			st.set_color(Color(1, 1, 1, 1.0 - uv[idx].y))   # альфа — высота (для ветра)
			st.add_vertex(p[idx])
	var m := st.commit()
	var mat := ShaderMaterial.new()
	mat.shader = preload("res://core/shaders/grass.gdshader")
	mat.set_shader_parameter("tex", _texture())
	m.surface_set_material(0, mat)
	return m


static func _texture() -> Texture2D:
	if _tex:
		return _tex
	var W := 64
	var H := 64
	var img := Image.create(W, H, true, Image.FORMAT_RGBA8)
	img.fill(Color(0, 0, 0, 0))
	var r := RandomNumberGenerator.new()
	r.seed = 11
	for b in 26:
		var x0 := r.randf_range(4, W - 4)
		var lean := r.randf_range(-14, 14)
		var top := r.randf_range(H * 0.05, H * 0.55)
		var c := Color(r.randf_range(0.55, 0.75), r.randf_range(0.48, 0.62), r.randf_range(0.28, 0.38), 1)
		for y in range(int(top), H):
			var f := (H - y) / float(H - top)
			var x := int(x0 + lean * f * f)
			for dx in [0, 1]:
				if x + dx >= 0 and x + dx < W:
					img.set_pixel(x + dx, y, c.darkened(0.35 * (1.0 - f)))
	img.generate_mipmaps()
	_tex = ImageTexture.create_from_image(img)
	return _tex
