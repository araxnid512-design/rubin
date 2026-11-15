extends Node
## Запекание 3D-моделей (GLB от Tripo) в спрайты 2.5D «Дрейфа»: цвет + карта нормалей + описание (json).
## Проекция: ортографическая камера, наклон −45°, 64 пикселя на метр по горизонтали (подробно —
## res://docs/ART_PIPELINE.md). Запуск (нужен дисплей, поэтому через xvfb):
##   xvfb-run -a godot --path drift --rendering-driver opengl3 res://tools/bake/bake.tscn -- \
##       --in=res://assets/src/sd_hero --out=res://assets/sprites/sd_hero --kind=character
## Параметры: см. _usage() ниже.

const BakeAnim := preload("res://tools/bake/bake_anim.gd")
const MODEL_SHADER := preload("res://tools/bake/bake_model.gdshader")
const DOWN_SHADER := preload("res://tools/bake/downsample.gdshader")

const PITCH_DEG := 45.0
const PPM := 64.0

## клипы игры ← клипы Tripo (первый найденный источник); frames — кадров в атласе, loop — цикл,
## mode: idle — самый «склеивающийся» отрезок, cycle — один полный цикл шага, active — от начала до конца движения
const DEFAULT_CLIPS := {
	"idle": {"src": ["idle", "wait"], "frames": 8, "loop": true, "mode": "idle"},
	"walk": {"src": ["walk"], "frames": 8, "loop": true, "mode": "cycle"},
	"run": {"src": ["run"], "frames": 8, "loop": true, "mode": "cycle"},
	"attack": {"src": ["box_01", "box_02", "front_kick_01"], "frames": 6, "loop": false, "mode": "active", "root": "lock"},
	"shoot": {"src": ["fire", "shoot"], "frames": 4, "loop": false, "mode": "active", "root": "lock"},
	"hit": {"src": ["hit_to_body_01", "hit_to_head", "hurt"], "frames": 4, "loop": false, "mode": "active"},
	# «fall» — падение на спину (defeat_02 у Tripo — поза «поражения» стоя, не смерть); начало — после спотыкания
	"death": {"src": ["fall", "defeat_02"], "frames": 8, "loop": false, "mode": "active", "hold": true,
		"cut": {"fall": [1.05, 0.0]}, "root": "lock"},
}
const CLIP_ORDER := ["idle", "walk", "run", "attack", "shoot", "hit", "death"]

var opt := {}
var frame_w := 128
var frame_h := 128
var anchor := Vector2(64, 100) # точка «земля под корнем» в кадре (согласовано с игрой: sprite8.gd читает anchor из json)
var ss := 3

var vp3: SubViewport
var vp2: SubViewport
var cam: Camera3D
var pivot: Node3D
var holder: Node3D
var model: Node3D
var skel: Skeleton3D
var mats: Array[ShaderMaterial] = []
var down_mat: ShaderMaterial
var pipeline_srgb := false
var clipped := 0
var log_lines: PackedStringArray = []


func _ready() -> void:
	_run.call_deferred()


func _usage() -> void:
	print("""Запекание спрайтов «Дрейфа»:
  --in=<glb | папка | префикс>   модель; для персонажа берутся и соседние <имя>_a/_b/_c….glb с движениями
  --out=res://assets/sprites/<имя>   папка результата (png + json)
  --kind=character|drone|turret|sphere
  --name=<имя>          имя в json (по умолчанию — имя папки out)
  --anims=<папка>       дополнительные клипы Animation (*.res, *.tres) или GLB
  --clips=<json>        свои настройки клипов (как DEFAULT_CLIPS в bake.gd, слияние по имени)
  --map=attack:box_02,shoot:fire   быстро поменять источник клипа
  --only=idle,walk      запечь только эти клипы (json дополняется, а не перезаписывается)
  --height=1.8          рост персонажа, м (по умолчанию 1.8)
  --size=0.8            дрон: наибольший горизонтальный размер, м (турель: если задан — тоже по нему)
  --height=1.1          турель: высота, м
  --hover=1.0           высота низа дрона над полом, м
  --split=auto|none|<м> турель: разрез на основание и голову (высота разреза в метрах после масштаба)
  --frame=128x128       размер кадра; --anchor=64,100 — точка привязки (земля под корнем)
  --dirs=8|16           число направлений (персонаж/дрон 8, турель 16)
  --yaw=<градусы>       доворот модели, если «перёд» определился неверно
  --ss=3                суперсэмплинг
  --preview=<клип Tripo>   полоса из 16 кадров всего исходного клипа (направление 7) → <out>/_preview_<клип>.png
  --list                показать клипы и выбранные отрезки""")


func _parse_args() -> void:
	for a in OS.get_cmdline_user_args():
		var s := String(a)
		if not s.begins_with("--"):
			continue
		s = s.substr(2)
		var eq := s.find("=")
		if eq < 0:
			opt[s] = "1"
		else:
			opt[s.substr(0, eq)] = s.substr(eq + 1)


func _o(key: String, def = "") -> String:
	return String(opt.get(key, str(def)))


func _log(s: String) -> void:
	print(s)
	log_lines.append(s)


func _run() -> void:
	_parse_args()
	if opt.has("help") or not opt.has("out") or (not opt.has("in") and _o("kind") != "sphere"):
		_usage()
		get_tree().quit(1 if not opt.has("help") else 0)
		return
	Engine.max_fps = 0
	DisplayServer.window_set_vsync_mode(DisplayServer.VSYNC_DISABLED)
	ss = int(_o("ss", 3))
	if opt.has("frame"):
		var wh := _o("frame").split("x")
		frame_w = int(wh[0])
		frame_h = int(wh[1]) if wh.size() > 1 else frame_w
	if opt.has("anchor"):
		var xy := _o("anchor").split(",")
		anchor = Vector2(float(xy[0]), float(xy[1]))
	_setup_viewports()
	await _calibrate()
	var kind := _o("kind", "character")
	var ok := false
	match kind:
		"character":
			ok = await _bake_character()
		"drone":
			ok = await _bake_static(false)
		"turret":
			ok = await _bake_static(true)
		"sphere":
			ok = await _bake_sphere()
		_:
			push_error("неизвестный --kind=" + kind)
	get_tree().quit(0 if ok else 2)


# ---------------------------------------------------------------- сцена запекания

func _setup_viewports() -> void:
	vp3 = SubViewport.new()
	vp3.size = Vector2i(frame_w * ss, frame_h * ss)
	vp3.transparent_bg = true
	vp3.own_world_3d = true
	vp3.msaa_3d = Viewport.MSAA_DISABLED
	vp3.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp3)
	var env := Environment.new()
	env.background_mode = Environment.BG_CLEAR_COLOR
	env.ambient_light_source = Environment.AMBIENT_SOURCE_DISABLED
	env.tonemap_mode = Environment.TONE_MAPPER_LINEAR
	var we := WorldEnvironment.new()
	we.environment = env
	vp3.add_child(we)
	cam = Camera3D.new()
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.keep_aspect = Camera3D.KEEP_HEIGHT
	cam.size = frame_h / PPM
	cam.near = 0.05
	cam.far = 200.0
	cam.rotation_degrees = Vector3(-PITCH_DEG, 0, 0)
	vp3.add_child(cam)
	_place_camera()
	pivot = Node3D.new()
	vp3.add_child(pivot)
	holder = Node3D.new()
	pivot.add_child(holder)

	vp2 = SubViewport.new()
	vp2.size = Vector2i(frame_w, frame_h)
	vp2.transparent_bg = true
	vp2.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp2)
	var rect := ColorRect.new()
	rect.size = Vector2(frame_w, frame_h)
	down_mat = ShaderMaterial.new()
	down_mat.shader = DOWN_SHADER
	down_mat.set_shader_parameter("src", vp3.get_texture())
	down_mat.set_shader_parameter("ss", ss)
	rect.material = down_mat
	vp2.add_child(rect)


## точка мира (0,0,0) — «земля под корнем» — попадает в пиксель anchor кадра
func _place_camera() -> void:
	var b := cam.basis
	var right := b.x
	var up := b.y
	var back := b.z
	var dx := (anchor.x - frame_w * 0.5) / PPM
	var dy := (anchor.y - frame_h * 0.5) / PPM
	var c := up * dy - right * dx
	cam.position = c + back * 50.0


## выход рендера Compatibility: переводится ли linear→sRGB (тогда нормали кодируются с обратной поправкой)
func _calibrate() -> void:
	var q := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(1, 1)
	q.mesh = qm
	var m := ShaderMaterial.new()
	m.shader = MODEL_SHADER
	m.set_shader_parameter("mode", 1)
	m.set_shader_parameter("pipeline_srgb", true)
	q.material_override = m
	vp3.add_child(q)
	q.global_transform = Transform3D(cam.global_transform.basis, cam.global_position - cam.global_transform.basis.z * 10.0)
	down_mat.set_shader_parameter("is_normal", false)
	for i in 3:
		await RenderingServer.frame_post_draw
	var img := vp2.get_texture().get_image()
	var c := img.get_pixel(frame_w / 2, frame_h / 2)
	pipeline_srgb = c.r > 0.4
	_log("калибровка: центр (%.3f %.3f %.3f %.3f) → рендер %s" % [c.r, c.g, c.b, c.a,
		"сам переводит в sRGB" if pipeline_srgb else "пишет как есть (sRGB — в шейдере)"])
	# проверка цвета: серая текстура 0.5 при свете 1.0 должна дать 0.5 (128)
	var gi := Image.create(4, 4, false, Image.FORMAT_RGBA8)
	gi.fill(Color(0.5, 0.5, 0.5, 1.0))
	m.set_shader_parameter("mode", 0)
	m.set_shader_parameter("pipeline_srgb", pipeline_srgb)
	m.set_shader_parameter("albedo_tex", ImageTexture.create_from_image(gi))
	m.set_shader_parameter("has_albedo", true)
	m.set_shader_parameter("ambient", 1.0)
	m.set_shader_parameter("key", 0.0)
	m.set_shader_parameter("ground_ao", 0.0)
	for i in 3:
		await RenderingServer.frame_post_draw
	c = vp2.get_texture().get_image().get_pixel(frame_w / 2, frame_h / 2)
	_log("калибровка цвета: серый 0.5 → %.3f (ожидается 0.5)" % c.r)
	q.queue_free()
	await RenderingServer.frame_post_draw


func _make_materials(root: Node) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		if m.mesh == null:
			continue
		for si in m.mesh.get_surface_count():
			var src = m.get_active_material(si)
			var sm := ShaderMaterial.new()
			sm.shader = MODEL_SHADER
			sm.set_shader_parameter("pipeline_srgb", pipeline_srgb)
			if src is BaseMaterial3D:
				var bm: BaseMaterial3D = src
				sm.set_shader_parameter("albedo_col", bm.albedo_color)
				if bm.albedo_texture:
					sm.set_shader_parameter("albedo_tex", bm.albedo_texture)
					sm.set_shader_parameter("has_albedo", true)
				if bm.normal_enabled and bm.normal_texture:
					sm.set_shader_parameter("normal_tex", bm.normal_texture)
					sm.set_shader_parameter("has_normal", true)
					sm.set_shader_parameter("normal_depth", clampf(bm.normal_scale, 0.0, 1.0) * float(_o("normal_depth", 0.7)))
				if bm.emission_enabled:
					sm.set_shader_parameter("emission_col", Vector3(bm.emission.r, bm.emission.g, bm.emission.b) * bm.emission_energy_multiplier)
					if bm.emission_texture:
						sm.set_shader_parameter("emission_tex", bm.emission_texture)
						sm.set_shader_parameter("has_emission_tex", true)
				if bm.transparency != BaseMaterial3D.TRANSPARENCY_DISABLED:
					sm.set_shader_parameter("alpha_scissor", 0.5)
			m.set_surface_override_material(si, sm)
			mats.append(sm)


func _set_param(p: String, v) -> void:
	for m in mats:
		m.set_shader_parameter(p, v)


func _capture(normal: bool) -> Image:
	_set_param("mode", 1 if normal else 0)
	down_mat.set_shader_parameter("is_normal", normal)
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var img := vp2.get_texture().get_image()
	img.convert(Image.FORMAT_RGBA8)
	return img


## кадр касается края — что-то обрезано
func _touches_edge(img: Image) -> bool:
	for x in frame_w:
		if img.get_pixel(x, 0).a > 0.05 or img.get_pixel(x, frame_h - 1).a > 0.05:
			return true
	for y in frame_h:
		if img.get_pixel(0, y).a > 0.05 or img.get_pixel(frame_w - 1, y).a > 0.05:
			return true
	return false


# ---------------------------------------------------------------- загрузка

func _abs(p: String) -> String:
	if p.begins_with("res://") or p.begins_with("user://"):
		return ProjectSettings.globalize_path(p)
	return p


static func load_glb(path: String) -> Node3D:
	var doc := GLTFDocument.new()
	var st := GLTFState.new()
	var err := doc.append_from_file(path, st)
	if err != OK:
		push_error("не загрузился " + path + " (" + str(err) + ")")
		return null
	return doc.generate_scene(st) as Node3D


## файлы модели: папка — все GLB в ней; файл/префикс X — X.glb и X_a.glb … X_h.glb рядом
func _input_files() -> PackedStringArray:
	var p := _abs(_o("in"))
	var out: PackedStringArray = []
	if DirAccess.dir_exists_absolute(p):
		var files := DirAccess.get_files_at(p)
		files.sort()
		for f in files:
			if f.get_extension().to_lower() in ["glb", "gltf"]:
				out.append(p.path_join(f))
		return out
	var base := p
	if base.get_extension().to_lower() in ["glb", "gltf"]:
		base = base.get_basename()
	var re := RegEx.create_from_string("_[a-h]$")
	if re.search(base.get_file()) and not FileAccess.file_exists(p):
		base = base.substr(0, base.length() - 2)
	elif re.search(base.get_file()):
		# дан X_a.glb — соседи X_b … тоже нужны
		base = base.substr(0, base.length() - 2)
	if FileAccess.file_exists(base + ".glb"):
		out.append(base + ".glb")
	for s in "abcdefgh":
		if FileAccess.file_exists(base + "_" + s + ".glb"):
			out.append(base + "_" + s + ".glb")
	if out.is_empty() and FileAccess.file_exists(p):
		out.append(p)
	return out


static func clean_anim_name(n: String) -> String:
	var s := n
	if s.contains("|"):
		s = s.get_slice("|", s.get_slice_count("|") - 1)
	s = s.replace("preset:biped:", "").replace("preset:", "")
	return s


func _collect_anims(root: Node, into: Dictionary) -> void:
	for ap in root.find_children("*", "AnimationPlayer", true, false):
		var player: AnimationPlayer = ap
		for an in player.get_animation_list():
			var nm := clean_anim_name(String(an))
			if not into.has(nm):
				into[nm] = player.get_animation(an)


# ---------------------------------------------------------------- персонаж

func _bake_character() -> bool:
	var files := _input_files()
	if files.is_empty():
		push_error("нет файлов модели для --in=" + _o("in"))
		return false
	var anims := {}
	for f in files:
		var node := load_glb(f)
		if node == null:
			continue
		var sk := node.find_children("*", "Skeleton3D", true, false)
		var has_mesh := not node.find_children("*", "MeshInstance3D", true, false).is_empty()
		if model == null and sk.size() > 0 and has_mesh:
			model = node
			skel = sk[0]
			_log("модель: " + f.get_file())
		_collect_anims(node, anims)
		if node != model:
			node.free()
	if opt.has("anims"):
		var d := _abs(_o("anims"))
		for f in DirAccess.get_files_at(d):
			var ext := f.get_extension().to_lower()
			if ext in ["res", "tres"]:
				var a = ResourceLoader.load(d.path_join(f))
				if a is Animation and not anims.has(f.get_basename()):
					anims[f.get_basename()] = a
			elif ext in ["glb", "gltf"]:
				var n2 := load_glb(d.path_join(f))
				if n2:
					_collect_anims(n2, anims)
					n2.free()
	if model == null:
		push_error("в файлах нет модели со скелетом")
		return false
	var names := anims.keys()
	names.sort()
	_log("клипы: " + ", ".join(PackedStringArray(names)))
	holder.add_child(model)
	# движения из других файлов — тоже на этот скелет (пути дорожек переносятся по имени кости)
	for ap in model.find_children("*", "AnimationPlayer", true, false):
		(ap as AnimationPlayer).active = false
	_make_materials(model)
	var ba = BakeAnim.new(skel, model)

	# ---- рост, «земля», «перёд»
	var aabb := _model_aabb(model)
	var height := float(_o("height", 1.8))
	var sc := height / maxf(aabb.size.y, 0.001)
	var fwd := Vector3.ZERO
	if anims.has("walk"):
		fwd = ba.forward_from_walk(anims["walk"])
	if fwd == Vector3.ZERO:
		fwd = ba.forward_from_eyes()
	if fwd == Vector3.ZERO:
		fwd = Vector3.BACK
	var yaw0 := -atan2(fwd.x, fwd.z) + deg_to_rad(float(_o("yaw", 0)))
	_log("габарит %.3f м → масштаб %.3f; «перёд» модели %s" % [aabb.size.y, sc, str(fwd.snapped(Vector3.ONE * 0.01))])
	var basis := Basis(Vector3.UP, yaw0) * Basis.from_scale(Vector3.ONE * sc)
	holder.transform = Transform3D(basis, basis * Vector3(0, -aabb.position.y, 0))

	# ---- клипы
	var cfg: Dictionary = DEFAULT_CLIPS.duplicate(true)
	if opt.has("clips"):
		var f := FileAccess.open(_o("clips"), FileAccess.READ)
		if f == null:
			f = FileAccess.open(_abs(_o("clips")), FileAccess.READ)
		if f:
			var extra = JSON.parse_string(f.get_as_text())
			if extra is Dictionary:
				var cl: Dictionary = extra.get("clips", extra)
				for k in cl:
					if cfg.has(k):
						cfg[k].merge(cl[k], true)
					else:
						cfg[k] = cl[k]
	if opt.has("map"):
		for pair in _o("map").split(","):
			var kv := pair.split(":")
			if kv.size() == 2 and cfg.has(kv[0]):
				cfg[kv[0]]["src"] = [kv[1]]

	if opt.has("preview"):
		var all_ok := true
		for pv in _o("preview").split(","):
			all_ok = await _preview(ba, anims, pv, sc) and all_ok
		return all_ok

	var out_dir := _abs(_o("out"))
	DirAccess.make_dir_recursive_absolute(out_dir)
	var name := _o("name", out_dir.get_file())
	var json_path := out_dir.path_join(name + ".json")
	var meta := {}
	if opt.has("only") and FileAccess.file_exists(json_path):
		var prev = JSON.parse_string(FileAccess.get_file_as_string(json_path))
		if prev is Dictionary:
			meta = prev
	var only: PackedStringArray = _o("only").split(",", false) if opt.has("only") else PackedStringArray()
	var dirs := int(_o("dirs", 8))
	meta.merge({"name": name, "kind": "character", "frame_w": frame_w, "frame_h": frame_h,
		"anchor": [int(anchor.x), int(anchor.y)], "fps": 12, "dirs": dirs, "ppm": PPM, "height_m": height,
		"dir_order": "0=S(к зрителю),1=SW,2=W,3=NW,4=N,5=NE,6=E,7=SE — по часовой на экране",
		"clips": {}}, true)
	if not meta.has("clips") or not (meta.clips is Dictionary):
		meta["clips"] = {}
	var order: Array = CLIP_ORDER.duplicate()
	for k in cfg:
		if not order.has(k):
			order.append(k)
	for clip in order:
		if only.size() > 0 and not only.has(clip):
			continue
		var c: Dictionary = cfg[clip]
		var src_name := ""
		for s in c.get("src", []):
			if anims.has(s):
				src_name = s
				break
		if src_name == "":
			_log("! клип %s: нет источника %s — пропущен" % [clip, str(c.get("src"))])
			continue
		var plan: Dictionary = ba.plan_clip(anims[src_name], c, src_name)
		var frames: int = c.get("frames", 8)
		_log("%s ← %s: отрезок %.2f–%.2f с из %.2f, кадров %d%s" % [clip, src_name, plan.t0, plan.t1,
			(anims[src_name] as Animation).length, frames, (", скорость %.2f м/с" % (plan.speed * sc)) if plan.speed * sc > 0.1 else ""])
		var color := Image.create(frame_w * frames, frame_h * dirs, false, Image.FORMAT_RGBA8)
		var normal := Image.create(frame_w * frames, frame_h * dirs, false, Image.FORMAT_RGBA8)
		clipped = 0
		for d in dirs:
			pivot.rotation = Vector3(0, -TAU * d / dirs, 0)
			for fi in frames:
				ba.apply(plan, fi)
				var ci := await _capture(false)
				var ni := await _capture(true)
				if _touches_edge(ci):
					clipped += 1
				color.blit_rect(ci, Rect2i(0, 0, frame_w, frame_h), Vector2i(fi * frame_w, d * frame_h))
				normal.blit_rect(ni, Rect2i(0, 0, frame_w, frame_h), Vector2i(fi * frame_w, d * frame_h))
		if clipped > 0:
			_log("  ! кадров, касающихся края: %d" % clipped)
		color.save_png(out_dir.path_join(clip + ".png"))
		normal.save_png(out_dir.path_join(clip + "_n.png"))
		var dur: float = plan.t1 - plan.t0
		var info := {"frames": frames, "loop": c.get("loop", false), "src": src_name,
			"src_from": snappedf(plan.t0, 0.001), "src_to": snappedf(plan.t1, 0.001),
			"duration": snappedf(dur, 0.001), "native_fps": snappedf(frames / maxf(dur, 0.001) if c.get("loop", false) else (frames - 1) / maxf(dur, 0.001), 0.01)}
		if c.get("hold", false):
			info["hold_last"] = true
		if plan.speed * sc > 0.1:
			info["speed_native"] = snappedf(plan.speed * sc, 0.01)
			info["speed_at_fps"] = snappedf(plan.speed * sc * 12.0 / float(info.native_fps), 0.01)
		meta.clips[clip] = info
	_save_json(json_path, meta)
	_save_log(out_dir)
	return true


func _model_aabb(root: Node3D) -> AABB:
	var res := AABB()
	var first := true
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		if m.mesh == null:
			continue
		var t := _rel_xform(m, root)
		var bb := t * m.mesh.get_aabb()
		res = bb if first else res.merge(bb)
		first = false
	return res


## преобразование узла n в системе root (без самого root)
static func _rel_xform(n: Node3D, root: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != root:
		if cur is Node3D:
			t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t


func _preview(ba, anims: Dictionary, clip: String, sc: float) -> bool:
	if not anims.has(clip):
		push_error("нет клипа " + clip)
		return false
	var a: Animation = anims[clip]
	var n := int(_o("frames", 16))
	var plan: Dictionary = ba.plan_uniform(a, 0.0, a.length, n)
	var img := Image.create(frame_w * n, frame_h, false, Image.FORMAT_RGBA8)
	pivot.rotation = Vector3(0, -TAU * int(_o("dir", 7)) / 8.0, 0)
	for fi in n:
		ba.apply(plan, fi)
		var ci := await _capture(false)
		img.blit_rect(ci, Rect2i(0, 0, frame_w, frame_h), Vector2i(fi * frame_w, 0))
	var out_dir := _abs(_o("out"))
	DirAccess.make_dir_recursive_absolute(out_dir)
	img.save_png(out_dir.path_join("_preview_" + clip + ".png"))
	_log("превью %s: %.2f с, %d кадров (шаг %.3f с)" % [clip, a.length, n, a.length / (n - 1)])
	return true


# ---------------------------------------------------------------- дроны и турели

func _static_vertices(root: Node3D) -> PackedVector3Array:
	var pts := PackedVector3Array()
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m: MeshInstance3D = mi
		if m.mesh == null:
			continue
		var t := _rel_xform(m, root)
		for si in m.mesh.get_surface_count():
			var arr := m.mesh.surface_get_arrays(si)
			for v in arr[Mesh.ARRAY_VERTEX]:
				pts.append(t * v)
	return pts


func _bake_static(turret: bool) -> bool:
	var files := _input_files()
	if files.is_empty():
		push_error("нет файла модели для --in=" + _o("in"))
		return false
	model = load_glb(files[0])
	if model == null:
		return false
	_log("модель: " + files[0].get_file())
	holder.add_child(model)
	_make_materials(model)
	var pts := _static_vertices(model)
	var aabb := _model_aabb(model)
	var dirs := int(_o("dirs", 16 if turret else 8))
	# масштаб: наибольший горизонтальный размер
	# масштаб: турель — по высоте (--height, 1.1 м), дрон — по наибольшему горизонтальному размеру (--size, 0.8 м)
	var size := float(_o("size", 0.8))
	var horiz := maxf(aabb.size.x, aabb.size.z)
	var sc := size / maxf(horiz, 0.001)
	if turret and not opt.has("size"):
		sc = float(_o("height", 1.1)) / maxf(aabb.size.y, 0.001)
		size = horiz * sc
	var y0 := aabb.position.y
	var H := aabb.size.y
	# ось вращения и разрез (турель): по профилю ширины слоёв
	var center := Vector3(aabb.get_center().x, 0, aabb.get_center().z)
	var split_m := -1.0 # в единицах модели (от y0)
	if turret:
		var prof := _profile(pts, y0, H, 40)
		center = prof.base_center
		var sp := _o("split", "auto")
		if sp == "auto":
			split_m = _find_neck(pts, prof, y0, H)
		elif sp != "none":
			split_m = float(sp) / sc
	var fwd := Vector3.ZERO
	if turret:
		fwd = _turret_forward(pts, center, y0 + maxf(split_m, 0.0))
	if fwd == Vector3.ZERO:
		fwd = Vector3.BACK
	var yaw0 := -atan2(fwd.x, fwd.z) + deg_to_rad(float(_o("yaw", 0)))
	var hover := float(_o("hover", 1.0)) if not turret else 0.0
	var basis := Basis(Vector3.UP, yaw0) * Basis.from_scale(Vector3.ONE * sc)
	holder.transform = Transform3D(basis, Vector3(0, hover, 0) + basis * Vector3(-center.x, -y0, -center.z))
	_log("габарит %.3f×%.3f×%.3f → масштаб %.3f (%.2f м по горизонтали, высота %.2f м); «перёд» %s" % [
		aabb.size.x, aabb.size.y, aabb.size.z, sc, size, H * sc, str(fwd.snapped(Vector3.ONE * 0.01))])

	var out_dir := _abs(_o("out"))
	DirAccess.make_dir_recursive_absolute(out_dir)
	var name := _o("name", out_dir.get_file())
	var meta := {"name": name, "kind": "turret" if turret else "drone", "frame_w": frame_w, "frame_h": frame_h,
		"anchor": [int(anchor.x), int(anchor.y)], "fps": 12, "dirs": dirs, "ppm": PPM,
		"dir_order": "0=S(к зрителю), далее по часовой на экране, шаг 360/dirs", "clips": {}}
	if turret:
		meta["height_m"] = snappedf(H * sc, 0.01)
		if split_m > 0.0:
			meta["split"] = true
			meta["split_m"] = snappedf(split_m * sc, 0.01)
			_log("разрез на высоте %.2f м: основание + голова" % (split_m * sc))
			_set_param("clip_max", split_m * sc)
			await _bake_sheet(out_dir, "base", 1)
			meta.clips["base"] = {"frames": 1, "dirs": 1, "loop": true}
			_set_param("clip_max", 1000.0)
			_set_param("clip_min", split_m * sc)
			await _bake_sheet(out_dir, "head", dirs)
			meta.clips["head"] = {"frames": 1, "dirs": dirs, "loop": true}
			_set_param("clip_min", -1000.0)
		else:
			meta["split"] = false
			_log("разрез не найден — турель целиком в %d направлениях" % dirs)
			await _bake_sheet(out_dir, "turret", dirs)
			meta.clips["turret"] = {"frames": 1, "dirs": dirs, "loop": true}
	else:
		meta["hover_m"] = hover
		meta["height_m"] = snappedf(H * sc, 0.01)
		await _bake_sheet(out_dir, "idle", dirs)
		meta.clips["idle"] = {"frames": 1, "dirs": dirs, "loop": true}
	_save_json(out_dir.path_join(name + ".json"), meta)
	_save_log(out_dir)
	return true


func _bake_sheet(out_dir: String, clip: String, dirs: int) -> void:
	var color := Image.create(frame_w, frame_h * dirs, false, Image.FORMAT_RGBA8)
	var normal := Image.create(frame_w, frame_h * dirs, false, Image.FORMAT_RGBA8)
	clipped = 0
	for d in dirs:
		pivot.rotation = Vector3(0, -TAU * d / dirs, 0)
		var ci := await _capture(false)
		var ni := await _capture(true)
		if _touches_edge(ci):
			clipped += 1
		color.blit_rect(ci, Rect2i(0, 0, frame_w, frame_h), Vector2i(0, d * frame_h))
		normal.blit_rect(ni, Rect2i(0, 0, frame_w, frame_h), Vector2i(0, d * frame_h))
	pivot.rotation = Vector3.ZERO
	if clipped > 0:
		_log("  ! %s: кадров, касающихся края: %d" % [clip, clipped])
	color.save_png(out_dir.path_join(clip + ".png"))
	normal.save_png(out_dir.path_join(clip + "_n.png"))


## профиль по высоте: радиус слоя относительно оси основания
func _profile(pts: PackedVector3Array, y0: float, H: float, n: int) -> Dictionary:
	# центр основания — середина нижних 15 % вершин
	var lo := AABB()
	var first := true
	for p in pts:
		if p.y <= y0 + H * 0.15:
			if first:
				lo = AABB(p, Vector3.ZERO)
				first = false
			else:
				lo = lo.expand(p)
	var c := Vector3(lo.get_center().x, 0, lo.get_center().z)
	var rad := PackedFloat32Array()
	rad.resize(n)
	for p in pts:
		var k := clampi(int((p.y - y0) / H * n), 0, n - 1)
		rad[k] = maxf(rad[k], Vector2(p.x - c.x, p.z - c.z).length())
	return {"base_center": c, "rad": rad, "n": n}


## «шея» турели: самый узкий слой между основанием и головой (заметно уже обоих)
func _find_neck(_pts: PackedVector3Array, prof: Dictionary, _y0: float, H: float) -> float:
	var rad: PackedFloat32Array = prof.rad
	var n: int = prof.n
	var best := -1
	var best_r := INF
	for k in range(int(n * 0.12), int(n * 0.65)):
		var below := 0.0
		for j in range(0, k):
			below = maxf(below, rad[j])
		var above := 0.0
		for j in range(k + 1, n):
			above = maxf(above, rad[j])
		if rad[k] < 0.72 * minf(below, above) and rad[k] < best_r:
			best_r = rad[k]
			best = k
	if best < 0:
		return -1.0
	return (best + 0.5) / n * H


## ствол — самая дальняя от оси точка головы
func _turret_forward(pts: PackedVector3Array, c: Vector3, y_split: float) -> Vector3:
	var far := 0.0
	var dir := Vector3.ZERO
	for p in pts:
		if p.y < y_split:
			continue
		var h := Vector3(p.x - c.x, 0, p.z - c.z)
		if h.length() > far:
			far = h.length()
			dir = h
	if far <= 0.0:
		return Vector3.ZERO
	return dir.normalized()


# ---------------------------------------------------------------- проверка нормалей: шар

func _bake_sphere() -> bool:
	model = Node3D.new()
	var mi := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.5
	sm.height = 1.0
	sm.radial_segments = 64
	sm.rings = 32
	mi.mesh = sm
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.8, 0.8, 0.8)
	mi.material_override = null
	mi.set_surface_override_material(0, mat)
	model.add_child(mi)
	mi.position = Vector3(0, 0.5, 0)
	holder.add_child(model)
	_make_materials(model)
	var out_dir := _abs(_o("out"))
	DirAccess.make_dir_recursive_absolute(out_dir)
	await _bake_sheet(out_dir, "sphere", 1)
	_save_json(out_dir.path_join("sphere.json"), {"name": "sphere", "kind": "test", "frame_w": frame_w, "frame_h": frame_h,
		"anchor": [int(anchor.x), int(anchor.y)], "clips": {"sphere": {"frames": 1, "dirs": 1}}})
	return true


func _save_json(path: String, d: Dictionary) -> void:
	var f := FileAccess.open(path, FileAccess.WRITE)
	f.store_string(JSON.stringify(d, "\t", false) + "\n")
	_log("→ " + ProjectSettings.localize_path(path))


func _save_log(out_dir: String) -> void:
	var f := FileAccess.open(out_dir.path_join("bake.log"), FileAccess.WRITE)
	if f:
		f.store_string("\n".join(log_lines) + "\n")
