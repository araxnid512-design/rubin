extends Node
## Графика и нагрузка: автотест того, что делает Level при загрузке (слияние статики, подмена материалов
## шейдерами, контактные тени, бурьян, качество 0/1/2) и окружения из main._setup_scene, и печать статистики
## по каждой локации — узлы, материалы, MultiMesh, оценка вызовов отрисовки в кадре. По этим строкам
## («ГРАФИКА …») в логе CI следим за нагрузкой: число не должно расти незаметно.

var game

func setup(g) -> void:
	game = g

## Корутина автотеста: число провалов.
func smoke() -> int:
	var fails := 0
	fails += _check_env()
	fails += _check_shaders()
	var prev: String = game.loc
	for id in ["zarechny", "dachi", "himmash", "voench", "murs", "stab"]:
		var t0 := Time.get_ticks_usec()
		if id != game.loc:
			game.enter(id, prev)
			prev = id
		var enter_ms := (Time.get_ticks_usec() - t0) / 1000.0
		await game.get_tree().process_frame
		await game.get_tree().process_frame
		var lv: Level = game.level
		var st: Dictionary = lv.render_stats()
		var s: Dictionary = lv.stats
		var est := estimate_draws(game, game.camera)
		print("  · ГРАФИКА %s: узлов glTF %d, мешей %d → MeshInstance3D %d (поверхностей %d), материалов %d → %d, MultiMesh %d (экземпляров %d), бурьян %d, кусты %d, пятна теней %d; слияние %.0f мс, загрузка %.0f мс, переход %.0f мс; в кадре ≈ %d вызовов отрисовки (видно мешей %d, свет огня +%d), рендер: %d" % [
			id, s.get("gltf_nodes", 0), s.get("gltf_meshes", 0), st["meshes"], st["surfaces"], s.get("materials_in", 0), st["materials"],
			st["multimesh"], st["instances"], s.get("weeds", 0), s.get("bushes", 0), s.get("contact_shadows", 0),
			s.get("merge_ms", 0.0), s.get("load_ms", 0.0), enter_ms, est["draws"], est["visible"], est["light_passes"],
			RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)])
		var ok_merge: bool = int(st["meshes"]) < int(s.get("gltf_nodes", 0)) * 0.75 and int(st["meshes"]) < int(s.get("gltf_meshes", 0)) and int(st["materials"]) < int(s.get("materials_in", 0))
		if int(s.get("merge_tried", 0)) > 0 and int(s.get("merge_done", 0)) == 0:
			print("  · %s: рендер в этом режиме не отдаёт данные мешей — слияние не проверить (меши оставлены как есть)" % id)
		else:
			fails += _check(ok_merge, "%s: статика слита — MeshInstance3D %d при %d узлах glTF (%d с мешами), материалов %d из %d" % [id, st["meshes"], s.get("gltf_nodes", 0), s.get("gltf_meshes", 0), st["materials"], s.get("materials_in", 0)])
		fails += _check(lv.world_mats.size() > 0 and lv.grass.size() == 1, "%s: материалы «как на фото» — %d (мох, сырость, лужи), трава с бурьяном — один MultiMesh" % [id, lv.world_mats.size()])
		if id == "zarechny":
			fails += _check(int(s.get("contact_shadows", 0)) > 100 and int(s.get("weeds", 0)) > 200, "контактные тени (%d) и бурьян вдоль заборов (%d)" % [s.get("contact_shadows", 0), s.get("weeds", 0)])
			var tinted := 0
			for mmi in lv.trees:
				if mmi.multimesh.use_colors:
					tinted += 1
			fails += _check(tinted > 0 and lv.foliage_mats.size() > 0, "кроны с осенними оттенками: %d пачек" % tinted)
			fails += await _check_quality(lv)
	return fails

## Окружение: ACES, туман, тёплое солнце и голубоватый заполняющий свет.
func _check_env() -> int:
	var env: Environment = game.env
	var sun := game.get_node_or_null("Sun") as DirectionalLight3D
	var fill := game.get_node_or_null("Fill") as DirectionalLight3D
	var ok := env != null and env.tonemap_mode == Environment.TONE_MAPPER_ACES and env.fog_enabled
	ok = ok and sun != null and sun.light_color.r > sun.light_color.b and fill != null and fill.light_color.b > fill.light_color.r
	return _check(ok, "окружение: ACES, дымка, тёплое солнце (%s) и голубоватый заполняющий свет" % (sun.light_color.to_html(false) if sun else "нет"))

## Шейдеры godot/shaders разбираются (если рендер в этом режиме разбирает шейдеры — в headless может не уметь).
func _check_shaders() -> int:
	var probe := Shader.new()
	probe.code = "shader_type spatial;\nuniform float probe_value = 1.0;\nvoid fragment() { ALBEDO = vec3(probe_value); }\n"
	if probe.get_shader_uniform_list().is_empty():
		print("  · шейдеры: в этом режиме рендер их не разбирает — проверка пропущена")
		return 0
	var bad := []
	for nm in ["world", "world_lite", "foliage", "grass", "puddle", "contact_shadow", "fire_glow"]:
		var sh := Level.shader(nm)
		if sh == null or sh.get_shader_uniform_list().is_empty():
			bad.append(nm)
	return _check(bad.is_empty(), "шейдеры разобраны без ошибок%s" % ("" if bad.is_empty() else ": ошибка в " + ", ".join(bad)))

## Качество 0/1/2: трава гуще, тени солнца и свечение — только на высоком.
func _check_quality(lv: Level) -> int:
	var was := Level.quality
	var sun := game.get_node_or_null("Sun") as DirectionalLight3D
	var env: Environment = game.env
	lv.apply_quality(0)
	await game.get_tree().process_frame
	var g0 := lv.grass_visible()
	var low_ok := sun != null and not sun.shadow_enabled and not env.glow_enabled
	var d0: int = estimate_draws(game, game.camera)["draws"]
	lv.apply_quality(1)
	var g1 := lv.grass_visible()
	lv.apply_quality(2)
	await game.get_tree().process_frame
	var g2 := lv.grass_visible()
	var high_ok := sun != null and sun.shadow_enabled and env.glow_enabled
	var d2: int = estimate_draws(game, game.camera)["draws"]
	lv.apply_quality(was)
	return _check(g0 < g1 and g1 < g2 and low_ok and high_ok, "качество: трава и бурьян %d / %d / %d, тени солнца и свечение только на высоком, вызовов в кадре ≈ %d (низкое) / %d (высокое, без учёта теней)" % [g0, g1, g2, d0, d2])

func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1

## Оценка вызовов отрисовки в кадре: геометрия в пирамиде видимости камеры (по AABB, с дальностью видимости):
## у меша — по вызову на поверхность, у MultiMesh и частиц — один; плюс проходы точечного света
## (в gl_compatibility каждый огонь — ещё вызов на каждый меш в его радиусе). Работает и без рендера (headless).
static func estimate_draws(root: Node, cam: Camera3D) -> Dictionary:
	var out := {"draws": 0, "visible": 0, "light_passes": 0}
	if cam == null:
		return out
	var size := cam.get_viewport().get_visible_rect().size if cam.get_viewport() else Vector2(1280, 720)
	var aspect := clampf(size.x / size.y, 1.3, 2.4) if size.y > 0.0 else 16.0 / 9.0
	var proj := Projection.create_perspective(cam.fov, aspect, cam.near, cam.far)
	var planes: Array[Plane] = []
	for i in 6:
		planes.append(cam.global_transform * proj.get_projection_plane(i))
	var eye := cam.global_position
	var boxes: Array[AABB] = []
	var lights: Array[OmniLight3D] = []
	var stack: Array[Node] = [root]
	while not stack.is_empty():
		var n: Node = stack.pop_back()
		for c in n.get_children():
			stack.append(c)
		if n.is_queued_for_deletion():
			continue
		if n is OmniLight3D and (n as OmniLight3D).is_visible_in_tree():
			lights.append(n)
			continue
		if not n is GeometryInstance3D:
			continue
		var gi: GeometryInstance3D = n
		if not gi.is_visible_in_tree():
			continue
		var box: AABB = gi.global_transform * gi.get_aabb()
		if not _in_frustum(planes, box):
			continue
		if gi.visibility_range_end > 0.0 and eye.distance_to(box.get_center()) > gi.visibility_range_end + gi.visibility_range_end_margin:
			continue
		var k := 1
		if gi is MeshInstance3D:
			var mesh := (gi as MeshInstance3D).mesh
			k = mesh.get_surface_count() if mesh else 0
		elif gi is MultiMeshInstance3D:
			var mm := (gi as MultiMeshInstance3D).multimesh
			k = 1 if mm and mm.instance_count > 0 and mm.visible_instance_count != 0 else 0
		if k > 0:
			out["draws"] += k
			out["visible"] += 1
			boxes.append(box)
	for l in lights:
		var r := l.omni_range
		var lb := AABB(l.global_position - Vector3(r, r, r), Vector3(r, r, r) * 2.0)
		if not _in_frustum(planes, lb):
			continue
		for b in boxes:
			if b.intersects(lb):
				out["light_passes"] += 1
	out["draws"] += out["light_passes"]
	return out

## AABB хоть частью в пирамиде видимости (нормали плоскостей камеры — наружу).
static func _in_frustum(planes: Array[Plane], box: AABB) -> bool:
	var lo := box.position
	var hi := box.end
	for pl in planes:
		var nrm := pl.normal
		var q := Vector3(lo.x if nrm.x > 0.0 else hi.x, lo.y if nrm.y > 0.0 else hi.y, lo.z if nrm.z > 0.0 else hi.z)
		if pl.is_point_over(q):
			return false
	return true
