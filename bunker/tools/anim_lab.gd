extends Node3D
## Лаборатория анимаций BunkerCore — проверка и настройка клипов героя.
##  * в игре/редакторе: список клипов, проигрывание, время смешивания и скорость, переход «из клипа в клип»,
##    вид с 8 сторон, сохранение в game/data/anim_clips.json (это и есть редактор анимационных переходов);
##  * автопроверка (--bc-lab=check --bc-out=папка): листы кадров каждого клипа (4 момента × 2 вида), вид
##    передвижения с 8 сторон, замеры: скольжение опорной стопы (см/с), направление шага относительно
##    «вперёд» модели, проникновение кистей в туловище, стопы ниже пола.
## Запуск: godot --path . res://tools/anim_lab.tscn -- --bc-lab=check --bc-out=/путь [--bc-set=hero]

var rig: BCCharacter
var cam: Camera3D
var out := "user://lab"
var set_name := "hero"
var report: Array = []
var calib := {}
var ui: Control


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-out="):
			out = a.substr(9)
		if a.begins_with("--bc-set="):
			set_name = a.substr(9)
	DirAccess.make_dir_recursive_absolute(out)
	_stage()
	var mode := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-lab="):
			mode = a.substr(9)
	if mode == "check":
		rig.ik.enabled_ik = false
		_check.call_deferred()
	else:
		_build_ui()


func _stage() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.16, 0.16, 0.15)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.6, 0.6, 0.6)
	e.ambient_light_energy = 0.7
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, -30, 0)
	sun.light_energy = 1.2
	sun.shadow_enabled = true
	add_child(sun)
	# пол с сеткой 0.5 м
	var mk := BCMesh.new()
	mk.box("concrete_floor", Transform3D.IDENTITY, Vector3(12, 0.1, 12), Vector3(0, -0.05, 0))
	for i in range(-12, 13):
		mk.box("paint_yellow" if i == 0 else "steel_dark", Transform3D.IDENTITY, Vector3(12, 0.004, 0.012), Vector3(0, 0.002, i * 0.5))
		mk.box("paint_yellow" if i == 0 else "steel_dark", Transform3D.IDENTITY, Vector3(0.012, 0.004, 12), Vector3(i * 0.5, 0.002, 0))
	add_child(mk.to_instance(false))
	var sb := StaticBody3D.new()
	sb.collision_layer = 1 | 32
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(12, 0.1, 12)
	cs.shape = bs
	cs.position.y = -0.05
	sb.add_child(cs)
	add_child(sb)
	# ступени для проверки IK
	var st := BCStairs.new()
	st.width = 1.2
	st.rise = 1.0
	st.run = 1.6
	st.steps = 6
	st.side_walls = false
	st.position = Vector3(3.0, 0, 1.0)
	add_child(st)
	var holder := Node3D.new()
	holder.name = "Holder"
	add_child(holder)
	rig = BCCharacter.new()
	holder.add_child(rig)
	rig.setup("res://assets/models/%s.glb" % ("hero" if set_name == "hero" else "hero_suit"), "res://assets/anim/" + set_name)
	cam = Camera3D.new()
	cam.fov = 35
	add_child(cam)
	cam.current = true


func _view(yaw_deg: float, dist := 4.2, h := 1.3, look := Vector3(0, 0.95, 0)) -> void:
	var a := deg_to_rad(yaw_deg)
	cam.global_position = look + Vector3(sin(a) * dist, h - look.y + 0.4, cos(a) * dist)
	cam.look_at(look, Vector3.UP)


## поставить клип на время t (без смешивания)
func _pose(clip: String, t: float) -> void:
	var ap := rig.ap
	rig.tree.active = false
	ap.play("bc/" + clip)
	ap.seek(t, true)
	ap.pause()


func _snap() -> Image:
	await RenderingServer.frame_post_draw
	return get_viewport().get_texture().get_image()


func _check() -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	var vs := Vector2i(640, 480)
	get_window().size = vs
	await get_tree().create_timer(0.3).timeout
	var names: Array = rig.info.keys()
	names.sort()
	_log("Набор %s: клипов %d (из конфигурации %d)" % [set_name, names.size(), BCAnimSet.load_config().clips.size()])
	var missing: Array = []
	for n in BCAnimSet.load_config().clips:
		if not rig.info.has(n):
			missing.append(n)
	_log("Нет источника: " + ", ".join(missing))
	_log("Масштаб модели: %.3f, рост %.2f м" % [rig.scale_k, rig.height])
	for n in names:
		await _sheet(n)
		_metrics(n)
	# передвижение — с 8 сторон
	for n in ["idle", "walk", "run", "sprint"]:
		if rig.info.has(n):
			await _eight(n)
	# калибровка: скорость клипов передвижения — по опорной стопе (тогда стопы не скользят)
	if set_name == "hero" and not calib.is_empty():
		var cfg := BCAnimSet.load_config()
		for k in calib:
			cfg.clips[k]["speed"] = calib[k]
		BCAnimSet.save_config(cfg)
		_log("Записаны скорости клипов (по опорной стопе): " + str(calib))
	var f := FileAccess.open(out.path_join("report_%s.txt" % set_name), FileAccess.WRITE)
	f.store_string("\n".join(report))
	get_tree().quit()


func _log(s: String) -> void:
	print("[lab] " + s)
	report.append(s)


## лист: 4 момента клипа × 2 вида (спереди-сбоку и сбоку)
func _sheet(n: String) -> void:
	var L: float = rig.info[n].len
	var cell := Vector2i(320, 240)
	var sheet := Image.create(cell.x * 4, cell.y * 2, false, Image.FORMAT_RGB8)
	for row in 2:
		_view(35.0 if row == 0 else 90.0)
		for k in 4:
			var t := L * (k / 3.0) * 0.999
			_pose(n, t)
			await get_tree().process_frame
			var img := await _snap()
			img.convert(Image.FORMAT_RGB8)
			img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
			sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(k * cell.x, row * cell.y))
	sheet.save_png(out.path_join("clip_%s_%s.png" % [set_name, n]))


func _eight(n: String) -> void:
	var cell := Vector2i(240, 240)
	var sheet := Image.create(cell.x * 4, cell.y * 2, false, Image.FORMAT_RGB8)
	var L: float = rig.info[n].len
	for k in 8:
		_view(k * 45.0, 4.6, 1.6)
		_pose(n, L * 0.3)
		await get_tree().process_frame
		var img := await _snap()
		img.convert(Image.FORMAT_RGB8)
		img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
		sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i((k % 4) * cell.x, (k / 4) * cell.y))
	sheet.save_png(out.path_join("eight_%s_%s.png" % [set_name, n]))


## замеры клипа: скольжение опорной стопы, направление шага, стопы под полом, кисти в туловище
func _metrics(n: String) -> void:
	var sk := rig.skel
	var info: Dictionary = rig.info[n]
	var L: float = info.len
	var speed: float = info.speed
	var lf := sk.find_bone("L_Foot")
	var rf := sk.find_bone("R_Foot")
	var lh := sk.find_bone("L_Hand")
	var rh := sk.find_bone("R_Hand")
	var sp := sk.find_bone("Spine02")
	if lf < 0 or rf < 0:
		_log("%s: нет костей стоп" % n)
		return
	var steps := 48
	var prev := {}
	var prev_m := {}
	var stride := 0.0
	var stride_n := 0
	# порог опоры: стопа считается на земле, если ниже минимума по клипу + 4 см
	var miny := INF
	for k in steps:
		_pose(n, L * k / steps)
		var xf0 := sk.global_transform
		miny = minf(miny, minf((xf0 * sk.get_bone_global_pose(lf).origin).y, (xf0 * sk.get_bone_global_pose(rf).origin).y))
	var slide := 0.0
	var slide_n := 0
	var below := 0.0
	var pen := 0
	var xf := sk.global_transform
	for k in steps:
		var t := L * k / steps
		_pose(n, t)
		var pl := xf * sk.get_bone_global_pose(lf).origin
		var pr := xf * sk.get_bone_global_pose(rf).origin
		# тело движется вперёд (+Z модели) со скоростью клипа — опорная стопа должна стоять на месте
		var body: Vector3 = (rig.model.global_transform.basis.orthonormalized() * (info.dir as Vector3)) * speed * t if info.dir != Vector3.ZERO else Vector3.ZERO
		var low := pl if pl.y < pr.y else pr
		var key := "l" if pl.y < pr.y else "r"
		var wpos := low + body
		if prev.has(key) and speed > 0.1 and low.y < miny + 0.04:
			var dv := Vector2(wpos.x - prev[key].x, wpos.z - prev[key].z).length() / (L / steps)
			slide += dv
			slide_n += 1
		# скорость опорной стопы относительно тела = скорость, с которой клип «толкает» землю
		if prev_m.has(key) and low.y < miny + 0.04:
			stride += Vector2(low.x - prev_m[key].x, low.z - prev_m[key].z).length() / (L / steps)
			stride_n += 1
		prev_m = {key: low}
		prev = {key: wpos}
		below = minf(below, minf(pl.y, pr.y) - rig.model.global_position.y)
		if lh >= 0 and sp >= 0:
			var c := xf * sk.get_bone_global_pose(sp).origin
			for hb in [lh, rh]:
				var hp: Vector3 = xf * sk.get_bone_global_pose(hb).origin
				var d := Vector2(hp.x - c.x, hp.z - c.z).length()
				if d < 0.09 and absf(hp.y - c.y) < 0.25:
					pen += 1
	var msg := "%s: длина %.2f с, скорость %.2f м/с" % [n, L, speed]
	if slide_n > 0:
		msg += ", скольжение опорной стопы %.0f см/с" % (slide / slide_n * 100.0)
	msg += ", ниже пола %.0f мм" % (-below * 1000.0) if below < -0.005 else ""
	if pen > 0:
		msg += ", кисть у туловища %d кадров" % pen
	if stride_n > 4 and info.native > 0.0:
		var vs := stride / stride_n
		msg += ", скорость по опорной стопе %.2f м/с" % vs
		calib[n] = snappedf(vs, 0.01)
	if info.native > 0.0:
		var wd: Vector3 = rig.global_transform.basis.inverse() * (rig.model.global_transform.basis.orthonormalized() * (info.dir as Vector3))
		msg += ", шаг вдоль «вперёд» героя: отклонение %.0f°" % rad_to_deg(Vector2(wd.x, wd.z).angle_to(Vector2(0, 1)))
	_log(msg)


# ---------------- интерфейс редактора переходов ----------------

var _clip_list: ItemList
var _blend: HSlider
var _rate: HSlider
var _cur := "idle"
var _yaw := 30.0


func _build_ui() -> void:
	_view(_yaw)
	var cl := CanvasLayer.new()
	add_child(cl)
	ui = PanelContainer.new()
	ui.position = Vector2(10, 10)
	ui.size = Vector2(330, 700)
	cl.add_child(ui)
	var v := VBoxContainer.new()
	ui.add_child(v)
	var t := Label.new()
	t.text = "Лаборатория анимаций (%s)" % set_name
	v.add_child(t)
	_clip_list = ItemList.new()
	_clip_list.custom_minimum_size = Vector2(300, 380)
	var names: Array = rig.info.keys()
	names.sort()
	for n in names:
		_clip_list.add_item(n)
	_clip_list.item_selected.connect(func(i):
		_cur = _clip_list.get_item_text(i)
		_blend.value = rig.info[_cur].blend
		_rate.value = rig.info[_cur].rate
		rig.tree.active = true
		rig.play(_cur))
	v.add_child(_clip_list)
	v.add_child(_lbl("Смешивание, с"))
	_blend = _slider(0.0, 0.8, 0.2)
	v.add_child(_blend)
	v.add_child(_lbl("Скорость"))
	_rate = _slider(0.3, 2.0, 1.0)
	v.add_child(_rate)
	var row := HBoxContainer.new()
	v.add_child(row)
	for b in [["◀ Повернуть", func(): _yaw -= 45.0; _view(_yaw)], ["Повернуть ▶", func(): _yaw += 45.0; _view(_yaw)]]:
		var btn := Button.new()
		btn.text = b[0]
		btn.pressed.connect(b[1])
		row.add_child(btn)
	var save := Button.new()
	save.text = "Сохранить в anim_clips.json"
	save.pressed.connect(func():
		var cfg := BCAnimSet.load_config()
		cfg.clips[_cur]["blend"] = _blend.value
		cfg.clips[_cur]["rate"] = _rate.value
		BCAnimSet.save_config(cfg)
		rig.info[_cur].blend = _blend.value
		rig.info[_cur].rate = _rate.value)
	v.add_child(save)


func _lbl(s: String) -> Label:
	var l := Label.new()
	l.text = s
	return l


func _slider(a: float, b: float, val: float) -> HSlider:
	var s := HSlider.new()
	s.min_value = a
	s.max_value = b
	s.step = 0.01
	s.value = val
	return s
