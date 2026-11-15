extends Node
## Проверка освещения 2D-светом по картам нормалей: комната из тайлов + запечённые персонажи/турель,
## PointLight2D слева (левая половина картинки) и справа (правая половина). Пишет docs/art/lit_test.png и
## печатает яркость левой/правой половины персонажа — свет слева должен освещать левую сторону.
##   xvfb-run -a godot --path drift --rendering-driver opengl3 res://tools/bake/lit_test.tscn

const W := 448
const H := 300
const OUT := "res://docs/art/lit_test.png"

var _cache := {}


func _ready() -> void:
	_run.call_deferred()


func _img(path: String) -> Texture2D:
	if _cache.has(path):
		return _cache[path]
	var im := Image.load_from_file(ProjectSettings.globalize_path(path))
	var t := ImageTexture.create_from_image(im)
	_cache[path] = t
	return t


func _ct(base: String) -> CanvasTexture:
	var ct := CanvasTexture.new()
	ct.diffuse_texture = _img(base + ".png")
	ct.normal_texture = _img(base + "_n.png")
	return ct


func _sprite(parent: Node, base: String, pos: Vector2, region := Rect2(), offset := Vector2.ZERO) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = _ct(base)
	s.centered = false
	s.position = pos
	s.offset = offset
	if region.size != Vector2.ZERO:
		s.region_enabled = true
		s.region_rect = region
	parent.add_child(s)
	return s


## кадр спрайта: строка — направление, столбец — кадр; точка привязки — из json
func _frame(parent: Node, char_dir: String, clip: String, dir: int, frame: int, ground: Vector2) -> Sprite2D:
	var name := char_dir.get_file()
	var meta = JSON.parse_string(FileAccess.get_file_as_string(char_dir + "/" + name + ".json"))
	var fw: int = meta.frame_w
	var fh: int = meta.frame_h
	var anc := Vector2(meta.anchor[0], meta.anchor[1])
	return _sprite(parent, char_dir + "/" + clip, ground, Rect2(frame * fw, dir * fh, fw, fh), -anc)


func _build_scene(vp: SubViewport, light_left: bool) -> Dictionary:
	var root := Node2D.new()
	vp.add_child(root)
	var cm := CanvasModulate.new()
	cm.color = Color(0.2, 0.22, 0.27)
	root.add_child(cm)
	var T := "res://assets/tiles/"
	var y0 := 131 + 4 # верх стены (полоса 18 + лицевая грань 113)
	var floors := ["floor_plate_a", "floor_plate_b", "floor_plate_a", "floor_grating", "floor_plate_c", "floor_plate_a", "floor_plate_b"]
	for j in 4:
		for i in 7:
			var nm: String = floors[(i + j * 3) % floors.size()]
			if j == 3:
				nm = "floor_hazard_n"
			_sprite(root, T + nm, Vector2(i * 64, y0 + j * 45))
	var walls := ["wall_plain", "wall_console", "door_closed", "wall_pipes", "wall_window", "wall_vent", "wall_plain"]
	for i in 7:
		_sprite(root, T + walls[i], Vector2(i * 64, y0 - 113))
		_sprite(root, T + "wall_top", Vector2(i * 64, y0 - 131))
	var S := "res://assets/sprites/"
	var hero := _frame(root, S + "hero", "idle", 0, 0, Vector2(160, y0 + 70))
	_frame(root, S + "pirate", "idle", 2, 0, Vector2(250, y0 + 110))
	_frame(root, S + "robot", "walk", 6, 2, Vector2(90, y0 + 130))
	if DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(S + "turret_gun")):
		_frame(root, S + "turret_gun", "base", 0, 0, Vector2(345, y0 + 75))
		_frame(root, S + "turret_gun", "head", 5, 0, Vector2(345, y0 + 75))
	if DirAccess.dir_exists_absolute(ProjectSettings.globalize_path(S + "drone_worker")):
		_frame(root, S + "drone_worker", "idle", 1, 0, Vector2(400, y0 + 140))
	var light := PointLight2D.new()
	var g := GradientTexture2D.new()
	g.width = 512
	g.height = 512
	g.fill = GradientTexture2D.FILL_RADIAL
	g.fill_from = Vector2(0.5, 0.5)
	g.fill_to = Vector2(1.0, 0.5)
	var gr := Gradient.new()
	gr.set_color(0, Color(1, 1, 1, 1))
	gr.set_color(1, Color(0, 0, 0, 1))
	g.gradient = gr
	light.texture = g
	light.texture_scale = 1.3
	light.energy = 2.6
	light.color = Color(1.0, 0.86, 0.66)
	light.height = 40.0
	light.position = Vector2(70 if light_left else W - 70, y0 + 50)
	root.add_child(light)
	var marker := Sprite2D.new() # где лампа
	var mi := Image.create(6, 6, false, Image.FORMAT_RGBA8)
	mi.fill(Color(1, 0.95, 0.6))
	marker.texture = ImageTexture.create_from_image(mi)
	marker.position = light.position
	marker.light_mask = 0
	root.add_child(marker)
	return {"root": root, "hero": hero}


func _run() -> void:
	var halves: Array[Image] = []
	var report := []
	for left in [true, false]:
		var vp := SubViewport.new()
		vp.size = Vector2i(W, H)
		vp.transparent_bg = false
		vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
		add_child(vp)
		var sc := _build_scene(vp, left)
		for i in 4:
			await RenderingServer.frame_post_draw
		var img := vp.get_texture().get_image()
		img.convert(Image.FORMAT_RGBA8)
		halves.append(img)
		# яркость левой и правой половины героя (пиксели с альфой спрайта)
		var hero: Sprite2D = sc.hero
		var reg := hero.region_rect
		var atlas: Image = (hero.texture as CanvasTexture).diffuse_texture.get_image()
		var top_left := hero.position + hero.offset
		var sum_l := 0.0
		var sum_r := 0.0
		var nl := 0
		var nr := 0
		for y in int(reg.size.y):
			for x in int(reg.size.x):
				if atlas.get_pixel(int(reg.position.x) + x, int(reg.position.y) + y).a < 0.9:
					continue
				var p := top_left + Vector2(x, y)
				if p.x < 0 or p.y < 0 or p.x >= W or p.y >= H:
					continue
				var c := img.get_pixelv(Vector2i(p))
				var lum := 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b
				if x < reg.size.x * 0.5:
					sum_l += lum
					nl += 1
				else:
					sum_r += lum
					nr += 1
		var L := sum_l / maxf(nl, 1)
		var R := sum_r / maxf(nr, 1)
		report.append([left, L, R])
		print("свет %s: левая половина героя %.3f, правая %.3f → %s" % ["слева" if left else "справа", L, R,
			"ВЕРНО" if (L > R) == left else "НЕВЕРНО"])
		vp.queue_free()
	var out := Image.create(W * 2 + 6, H, false, Image.FORMAT_RGBA8)
	out.fill(Color(0.05, 0.05, 0.06))
	out.blit_rect(halves[0], Rect2i(0, 0, W, H), Vector2i(0, 0))
	out.blit_rect(halves[1], Rect2i(0, 0, W, H), Vector2i(W + 6, 0))
	DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(OUT).get_base_dir())
	out.save_png(ProjectSettings.globalize_path(OUT))
	print("→ ", OUT)
	var ok := true
	for r in report:
		ok = ok and ((r[1] > r[2]) == r[0])
	get_tree().quit(0 if ok else 3)
