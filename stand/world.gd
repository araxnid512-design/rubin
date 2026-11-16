extends Node3D
## Стартовая локация — стабильный кластер 100×100 м (для проверки героя в мире): земля с травой, грунтовая
## дорога к дому, деревья и кусты (модели Tripo), деревянный дом с пятью комнатами, ящики, которые можно
## ставить и убирать (сохраняются). Граница кластера — полоса гравия и невидимая стена.
## Управление: левая половина экрана — джойстик (сильнее отклонить — бег), правая — повернуть камеру, два
## пальца — приблизить. На компьютере — WASD, Shift — бег, мышь — то же, что палец.
## Проверка: --as-test=world --as-out=папка — обход локации и дома по точкам, снимки и журнал.

const SIZE := 100.0               ## кластер, м
const SAVE := "user://cluster.json"
const HOUSE_AT := Vector3(0, 0, -12)
const C_BG := Color(0.05, 0.07, 0.09, 0.85)
const C_LINE := Color(0.35, 0.75, 0.95, 0.7)
const C_TEXT := Color(0.88, 0.93, 0.97)
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"

## деревья: модель, высота, сколько, радиус ствола (для столкновений; 0 — без столкновений)
const FLORA := [
	["ul_birch", 5.5, 18, 0.14], ["ul_pine", 6.0, 14, 0.16], ["ul_apple", 3.6, 8, 0.15], ["ul_bush", 1.2, 20, 0.0],
]

var player: CharacterBody3D
var rig: BCCharacter
var snd: BCSound
var house: ULHouse
var cam: Camera3D
var cam_yaw := 0.0                ## камера смотрит вдоль −Z (на дом)
var cam_pitch := 0.92
var cam_dist := 11.0
var _cam_t := Vector3.ZERO
var crates: Array[Node3D] = []
var _crate_scene: PackedScene = null
var _joy_id := -1
var _joy_o := Vector2.ZERO
var _joy_v := Vector2.ZERO
var _cam_id := -1
var _touch := {}
var _pinch := 0.0
var _run_btn := false
var _pack_i := 0
var info: Label
var joy_ui: Control
var test := ""
var out := "user://world"
var _auto: Array = []             ## проверка: точки, к которым герой идёт сам
var _auto_cb: Callable
var _steps := {}


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	_env()
	_ground()
	_road()
	house = ULHouse.new()
	house.name = "House"
	add_child(house)
	house.position = HOUSE_AT
	house.build(MODELS + "ul_house.glb", TEX + "weathered_brown_planks", TEX + "brown_planks_03")
	_fit_shell()
	_flora()
	_player()
	_ui()
	if ResourceLoader.exists(MODELS + "ul_crate.glb"):
		_crate_scene = load(MODELS + "ul_crate.glb")
	_load()
	if test != "":
		_run_test.call_deferred()


# ---------------- мир ----------------

func _env() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.36, 0.5, 0.68)
	sm.sky_horizon_color = Color(0.72, 0.74, 0.72)
	sm.ground_horizon_color = Color(0.5, 0.5, 0.46)
	sm.ground_bottom_color = Color(0.2, 0.2, 0.18)
	sky.sky_material = sm
	e.background_mode = Environment.BG_SKY
	e.sky = sky
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.75
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	# дымка: за границей кластера всё тонет в мареве
	e.fog_enabled = true
	e.fog_mode = Environment.FOG_MODE_DEPTH
	e.fog_light_color = Color(0.66, 0.68, 0.66)
	e.fog_density = 1.0
	e.fog_depth_begin = 40.0
	e.fog_depth_end = 150.0
	e.fog_depth_curve = 1.6
	e.fog_sky_affect = 0.3
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-50, 35, 0)
	sun.light_energy = 1.2
	sun.light_color = Color(1.0, 0.96, 0.88)
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 32.0
	add_child(sun)


func _plane(size: Vector2, at: Vector3, tex: String, uv: float, tint := Color.WHITE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	var m := ULHouse._mat(TEX + tex, uv)
	m.albedo_color = tint
	mi.material_override = m
	mi.position = at
	add_child(mi)
	return mi


func _ground() -> void:
	# внутри кластера — трава, снаружи — другой грунт (у кластера своя «вырезанная» земля), между — гравий
	_plane(Vector2(SIZE, SIZE), Vector3(0, 0, 0), "sparse_grass", 3.0)
	_plane(Vector2(SIZE + 3.0, SIZE + 3.0), Vector3(0, -0.02, 0), "rocky_gravel", 1.5, Color(0.8, 0.78, 0.74))
	_plane(Vector2(420, 420), Vector3(0, -0.05, 0), "dry_ground_01", 4.0, Color(0.7, 0.66, 0.6))
	var sb := StaticBody3D.new()
	add_child(sb)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	sb.add_child(cs)
	# граница кластера: дальше не пройти (для проверки)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var w := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, SIZE + 2) if s.x != 0.0 else Vector3(SIZE + 2, 4, 1)
		w.shape = b
		w.position = s * (SIZE * 0.5 + 1.0) + Vector3.UP * 2.0
		sb.add_child(w)


func _road() -> void:
	# грунтовка от крыльца к краю кластера
	var z0 := HOUSE_AT.z + ULHouse.D * 0.5 + 0.3
	var L := SIZE * 0.5 - z0
	var mi := _plane(Vector2(3.2, L), Vector3(0, 0.01, z0 + L * 0.5), "brown_mud_leaves_01", 2.5)
	mi.name = "Road"


## Дом из Tripo — по нашим стенам. Замер модели (сечение на высоте стен): стены x −0.352…+0.340 (фасад с дверью
## и крыльцом — на +x), z −0.437…+0.431, свес крыши от высоты 0.33. Поворот −90°: фасад модели (+x) → фасад дома
## (+z). Масштаб по осям модели: глубина 10 м / 0.692, длина 12 м / 0.868; по высоте — стены 3.3 м (дверь ~2 м,
## при одинаковом масштабе модель была бы с 4.6-метровыми стенами).
const SHELL_FIT := {"scale": [14.45, 10.0, 13.82], "yaw": -90.0, "center": [-0.006, 0.0, -0.003]}


func _fit_shell() -> void:
	if house.shell == null:
		return
	var sh := house.shell
	var f: Dictionary = SHELL_FIT
	var S := Vector3(f.scale[0], f.scale[1], f.scale[2])
	sh.rotation.y = deg_to_rad(float(f.yaw))
	sh.scale = S
	var c := Vector3(f.center[0], f.center[1], f.center[2])
	var off := Basis(Vector3.UP, deg_to_rad(float(f.yaw))) * (c * S)
	sh.position = Vector3(-off.x, 0.0, -off.z)


func _aabb(n: Node3D) -> AABB:
	var bb := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := n.transform * _rel(m, n)
		var a := xf * m.get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	return bb


func _rel(m: Node3D, root: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = m
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


func _flora() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2611
	var placed: Array[Vector3] = []
	var body := StaticBody3D.new()
	body.name = "Trees"
	add_child(body)
	for f in FLORA:
		var path := MODELS + String(f[0]) + ".glb"
		var scene: PackedScene = load(path) if ResourceLoader.exists(path) else null
		var n := int(f[2])
		var tries := 0
		while n > 0 and tries < 2000:
			tries += 1
			var p := Vector3(rng.randf_range(-SIZE * 0.47, SIZE * 0.47), 0, rng.randf_range(-SIZE * 0.47, SIZE * 0.47))
			# не на дом, не на дорогу, не на старт, не вплотную друг к другу
			if absf(p.x - HOUSE_AT.x) < ULHouse.W * 0.5 + 4.0 and absf(p.z - HOUSE_AT.z) < ULHouse.D * 0.5 + 4.0:
				continue
			if absf(p.x) < 3.5 and p.z > HOUSE_AT.z:
				continue
			var near := false
			for q in placed:
				if q.distance_to(p) < (2.2 if f[0] != "ul_bush" else 1.4):
					near = true
					break
			if near:
				continue
			placed.append(p)
			n -= 1
			var h := float(f[1]) * rng.randf_range(0.8, 1.2)
			var node: Node3D
			if scene:
				node = scene.instantiate()
				var bb := _aabb(node)
				node.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
			else:
				node = _fallback_tree(h, String(f[0]) == "ul_bush")
			node.rotation.y = rng.randf() * TAU
			node.position = p
			add_child(node)
			if float(f[3]) > 0.0:
				var cs := CollisionShape3D.new()
				var cy := CylinderShape3D.new()
				cy.radius = float(f[3]) * h / float(f[1])
				cy.height = 3.0
				cs.shape = cy
				cs.position = p + Vector3.UP * 1.5
				body.add_child(cs)


func _fallback_tree(h: float, bush: bool) -> Node3D:
	var n := Node3D.new()
	var leaf := StandardMaterial3D.new()
	leaf.albedo_color = Color(0.25, 0.42, 0.18)
	var crown := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = h * (0.45 if bush else 0.28)
	sm.height = sm.radius * 2.0
	crown.mesh = sm
	crown.material_override = leaf
	crown.position.y = h * (0.45 if bush else 0.7)
	n.add_child(crown)
	if not bush:
		var tr := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.08
		cm.bottom_radius = 0.13
		cm.height = h * 0.6
		tr.mesh = cm
		var bark := StandardMaterial3D.new()
		bark.albedo_color = Color(0.35, 0.28, 0.22)
		tr.material_override = bark
		tr.position.y = h * 0.3
		n.add_child(tr)
	return n


# ---------------- герой ----------------

func _player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	add_child(player)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.75
	cs.shape = cap
	cs.position.y = 0.875
	player.add_child(cs)
	player.floor_snap_length = 0.3
	rig = BCCharacter.new()
	player.add_child(rig)
	rig.setup("res://assets/models/hero.glb", "res://assets/anim/hero")
	snd = BCSound.new()
	add_child(snd)
	player.position = Vector3(0, 0.1, 6)
	player.rotation.y = PI                       # лицом к дому
	cam = Camera3D.new()
	cam.fov = 45
	cam.near = 0.1
	cam.far = 220
	add_child(cam)
	cam.current = true
	_cam_t = player.position


func _input_vec() -> Vector2:
	var v := _joy_v
	var k := Vector2(Input.get_action_strength("ui_right") - Input.get_action_strength("ui_left"), Input.get_action_strength("ui_down") - Input.get_action_strength("ui_up"))
	for key in [[KEY_W, Vector2(0, -1)], [KEY_S, Vector2(0, 1)], [KEY_A, Vector2(-1, 0)], [KEY_D, Vector2(1, 0)]]:
		if Input.is_physical_key_pressed(key[0]):
			k += key[1]
	if k.length() > 0.01:
		v = k.normalized() * (1.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 0.6)
	if not _auto.is_empty():
		v = _auto_vec()
	return v


func _process(delta: float) -> void:
	var iv := _input_vec()
	# направление — относительно камеры: «вверх» на джойстике — от камеры вперёд
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dir := right * iv.x - fwd * iv.y
	var mag := clampf(iv.length(), 0.0, 1.0)
	var run := mag > 0.85 or _run_btn
	var speed := 0.0
	if mag > 0.12:
		speed = 3.6 if run else lerpf(0.9, 1.6, clampf((mag - 0.12) / 0.6, 0.0, 1.0))
	var want := dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	var hv := Vector3(player.velocity.x, 0, player.velocity.z)
	hv = hv.move_toward(want, delta * (14.0 if want.length() > hv.length() else 10.0))
	player.velocity = Vector3(hv.x, player.velocity.y - 9.8 * delta, hv.z)
	player.move_and_slide()
	if player.is_on_floor():
		player.velocity.y = 0.0
	var real := Vector3(player.velocity.x, 0, player.velocity.z).length()
	if real > 0.2:
		var yaw := atan2(hv.x, hv.z)
		player.rotation.y = lerp_angle(player.rotation.y, yaw, 1.0 - exp(-delta * 10.0))
	rig.set_motion(real, 0.0, delta)
	_steps_sfx(real)
	# в доме: крыша и стены Tripo скрыты, видны комнаты, камера круче
	var ins := house.contains(player.global_position)
	if ins != house.inside:
		house.set_inside(ins)
	var pitch_t := 1.08 if ins else cam_pitch
	var dist_t := minf(cam_dist, 9.0) if ins else cam_dist
	_cam_t = _cam_t.lerp(player.global_position, 1.0 - exp(-delta * 8.0))
	var cp := Vector3(sin(cam_yaw) * cos(pitch_t), sin(pitch_t), cos(cam_yaw) * cos(pitch_t)) * dist_t
	var look := _cam_t + Vector3.UP * 1.0
	cam.global_position = cam.global_position.lerp(look + cp, 1.0 - exp(-delta * 6.0)) if _cam_ready else look + cp
	_cam_ready = true
	cam.look_at(look, Vector3.UP)
	if info and Engine.get_process_frames() % 10 == 0:
		info.text = "%s · %s · ящиков: %d · %d кадров/с" % [_where(), "бег" if real > 2.5 else ("шаг" if real > 0.2 else "стоит"), crates.size(), Engine.get_frames_per_second()]
	if joy_ui:
		joy_ui.queue_redraw()
	# надписи комнат на полу — всегда читаются с той стороны, откуда смотрит камера
	for lb in house.labels:
		lb.basis = Basis(Vector3.UP, cam_yaw) * Basis(Vector3.RIGHT, -PI * 0.5)


var _cam_ready := false


func _where() -> String:
	if not house.contains(player.global_position):
		return "кластер, улица"
	var l := house.to_local(player.global_position)
	var best := ""
	var bd := 1e9
	for r in ULHouse.ROOMS:
		var room: Vector2 = r[1]
		var d := Vector2(l.x, l.z).distance_to(room)
		if d < bd:
			bd = d
			best = r[0]
	return "дом, " + best.to_lower()


func _steps_sfx(speed: float) -> void:
	if rig.probe == null or rig.probe.pos.is_empty():
		return
	for b in ["L_Foot", "R_Foot"]:
		if not rig.probe.pos.has(b):
			continue
		var lp: Vector3 = rig.probe.pos[b]
		var h := lp.y * rig.scale_k
		if not _steps.has(b):
			_steps[b] = [h, false]
		var st: Array = _steps[b]
		st[0] = minf(float(st[0]) + 0.0004, h)
		if h > float(st[0]) + 0.045:
			st[1] = true
		elif bool(st[1]) and h < float(st[0]) + 0.018:
			st[1] = false
			snd.play("step", rig.skel.global_transform * lp, -8.0 + clampf(speed, 0.0, 4.0) * 1.5, 0.08)
		_steps[b] = st
	if speed >= 3.0:
		snd.loop("breath_run", player.global_position + Vector3.UP * 1.5, -10.0)
	else:
		snd.loop("", Vector3.ZERO)


# ---------------- ящики ----------------

func place_crate() -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 1.0
	# не в стену: если впереди препятствие — ближе
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 0.4, p + Vector3.UP * 0.4)
	q.exclude = [player.get_rid()]
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		p = player.global_position + f * maxf(0.0, player.global_position.distance_to(hit.position) - 0.45)
	_add_crate(p, player.rotation.y)
	snd.play("cloth", p, -6.0)
	snd.play("hit_wood", p, -8.0, 0.1, 0.15)
	_save()


func _add_crate(p: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Crate"
	add_child(body)
	var size := Vector3(1.0, 0.6, 0.6)
	var vis: Node3D
	if _crate_scene:
		vis = _crate_scene.instantiate()
		var bb := _aabb(vis)
		var s := size.x / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		vis.scale = Vector3.ONE * s
		bb = _aabb(vis)
		size = bb.size
		vis.position = Vector3(-bb.get_center().x, -bb.position.y, -bb.get_center().z)
	else:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = size
		mi.mesh = bm
		mi.material_override = ULHouse._mat(TEX + "brown_planks_03", 0.8)
		mi.position.y = size.y * 0.5
		vis = mi
	body.add_child(vis)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position.y = size.y * 0.5
	body.add_child(cs)
	# на пол дома или на землю
	body.position = Vector3(p.x, ULHouse.FLOOR_Y if house.contains(p) else 0.0, p.z)
	body.rotation.y = yaw
	crates.append(body)


func remove_crate() -> void:
	var best: Node3D = null
	var bd := 2.2
	for c in crates:
		var d := c.global_position.distance_to(player.global_position)
		if d < bd:
			bd = d
			best = c
	if best:
		snd.play("cloth", best.global_position, -6.0)
		crates.erase(best)
		best.queue_free()
		_save()


func _save() -> void:
	var arr := []
	for c in crates:
		arr.append([snappedf(c.position.x, 0.01), snappedf(c.position.z, 0.01), snappedf(c.rotation.y, 0.01)])
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"crates": arr}))


func _load() -> void:
	var arr := []
	if FileAccess.file_exists(SAVE) and test == "":
		var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
		if d is Dictionary:
			arr = d.get("crates", [])
	else:
		# первый запуск — по ящику в кладовой и сенях
		var a := house.to_global(Vector3(4.6, 0, 3.9))
		var b := house.to_global(Vector3(3.4, 0, 4.2))
		var c := house.to_global(Vector3(-0.9, 0, 2.2))
		arr = [[a.x, a.z, 0.0], [b.x, b.z, 0.3], [c.x, c.z, 1.57]]
	for it in arr:
		_add_crate(Vector3(float(it[0]), 0, float(it[1])), float(it[2]))


# ---------------- интерфейс и касания ----------------

func _style(bg := C_BG) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = C_LINE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(4)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	return sb


func _btn(text: String, cb: Callable, w := 130.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 56)
	b.add_theme_font_size_override("font_size", 17)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_stylebox_override("normal", _style())
	b.add_theme_stylebox_override("hover", _style(Color(0.1, 0.16, 0.2, 0.9)))
	b.add_theme_stylebox_override("pressed", _style(Color(0.12, 0.3, 0.4, 0.95)))
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	ui.add_child(root)
	info = Label.new()
	info.position = Vector2(16, 12)
	info.add_theme_font_size_override("font_size", 18)
	info.add_theme_color_override("font_color", C_TEXT)
	info.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	info.add_theme_constant_override("outline_size", 6)
	root.add_child(info)
	var title := Label.new()
	title.text = "Стабильный кластер · стартовая локация (проверка)"
	title.position = Vector2(16, 40)
	title.add_theme_font_size_override("font_size", 14)
	title.add_theme_color_override("font_color", Color(0.7, 0.85, 0.95, 0.8))
	root.add_child(title)
	var bar := VBoxContainer.new()
	bar.anchor_left = 1.0
	bar.anchor_right = 1.0
	bar.offset_left = -150
	bar.offset_right = -12
	bar.offset_top = 12
	bar.add_theme_constant_override("separation", 8)
	root.add_child(bar)
	bar.add_child(_btn("Ящик +", place_crate))
	bar.add_child(_btn("Ящик −", remove_crate))
	bar.add_child(_btn("Рюкзак", _cycle_pack))
	var rb := _btn("Бег", func(): _run_btn = not _run_btn)
	rb.toggle_mode = true
	bar.add_child(rb)
	bar.add_child(_btn("Стенд", func(): get_tree().change_scene_to_file("res://stand.tscn")))
	joy_ui = Control.new()
	joy_ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	joy_ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	joy_ui.draw.connect(_draw_joy)
	root.add_child(joy_ui)


func _draw_joy() -> void:
	if _joy_id < 0:
		var vs := get_viewport().get_visible_rect().size
		var c := Vector2(150, vs.y - 150)
		joy_ui.draw_circle(c, 90, Color(1, 1, 1, 0.06))
		joy_ui.draw_arc(c, 90, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.35), 2.0)
		return
	joy_ui.draw_circle(_joy_o, 90, Color(1, 1, 1, 0.08))
	joy_ui.draw_arc(_joy_o, 90, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.5), 2.0)
	joy_ui.draw_circle(_joy_o + _joy_v * 90, 34, Color(0.6, 0.85, 1.0, 0.45))


var _packs := ["", "small", "medium", "large"]


func _cycle_pack() -> void:
	_pack_i = (_pack_i + 1) % _packs.size()
	for c in rig.skel.get_children():
		if c.name == "Pack":
			c.queue_free()
	var id: String = _packs[_pack_i]
	if id != "":
		var stand_packs: Dictionary = load("res://stand.gd").get_script_constant_map().PACKS
		var mi := BCPackFit.build(rig, stand_packs[id])
		rig.skel.add_child(mi)
		mi.skeleton = mi.get_path_to(rig.skel)
		snd.play("zip", player.global_position + Vector3.UP * 1.2, -6.0)
	else:
		snd.play("cloth", player.global_position + Vector3.UP * 1.2, -4.0)


func _unhandled_input(e: InputEvent) -> void:
	var vs := get_viewport().get_visible_rect().size
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			_touch[t.index] = t.position
			if t.position.x < vs.x * 0.45 and _joy_id < 0:
				_joy_id = t.index
				_joy_o = t.position
				_joy_v = Vector2.ZERO
			elif _cam_id < 0:
				_cam_id = t.index
		else:
			_touch.erase(t.index)
			if t.index == _joy_id:
				_joy_id = -1
				_joy_v = Vector2.ZERO
			if t.index == _cam_id:
				_cam_id = -1
			_pinch = 0.0
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		_touch[d.index] = d.position
		if d.index == _joy_id:
			_joy_v = ((d.position - _joy_o) / 90.0).limit_length(1.0)
		elif d.index == _cam_id:
			if _touch.size() >= 2 and _joy_id < 0:
				var ks := _touch.keys()
				var dd := (_touch[ks[0]] as Vector2).distance_to(_touch[ks[1]])
				if _pinch > 0.0:
					cam_dist = clampf(cam_dist * _pinch / dd, 5.0, 22.0)
				_pinch = dd
			else:
				cam_yaw -= d.relative.x * 0.006
				cam_pitch = clampf(cam_pitch + d.relative.y * 0.004, 0.45, 1.25)
	elif e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(5.0, cam_dist * 0.9)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(22.0, cam_dist * 1.1)


# ---------------- проверка ----------------

func _auto_vec() -> Vector2:
	var p := player.global_position
	var tgt: Vector3 = _auto[0]
	var d := Vector3(tgt.x - p.x, 0, tgt.z - p.z)
	if d.length() < 0.35:
		_auto.pop_front()
		if _auto.is_empty():
			return Vector2.ZERO
		return _auto_vec()
	var fwd := Vector3(-sin(cam_yaw), 0, -cos(cam_yaw))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dn := d.normalized()
	return Vector2(dn.dot(right), -dn.dot(fwd)) * 0.6


func _snap(name: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, name])


func _walk(points: Array, limit := 30.0) -> void:
	_auto = points.duplicate()
	var t := 0.0
	while not _auto.is_empty() and t < limit:
		await get_tree().process_frame
		t += get_process_delta_time()
	_auto.clear()
	await get_tree().create_timer(0.6).timeout


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(1.0).timeout
	# общий вид сверху
	var keep := cam_dist
	cam_dist = 60.0
	cam_pitch = 1.2
	await get_tree().create_timer(1.2).timeout
	await _snap("w0_overview")
	cam_dist = 14.0
	cam_pitch = 0.5
	await get_tree().create_timer(1.0).timeout
	await _snap("w1_start")
	cam_dist = keep
	cam_pitch = 0.92
	# к дому, внутрь и по комнатам
	var H := house
	var route := [
		["w2_door", [H.door_point(1.5)]],
		["w3_seni", [H.to_global(Vector3(0, 0, 3.4))]],
		["w4_kitchen", [H.to_global(Vector3(0, 0, 3.25)), H.to_global(Vector3(-1.0, 0, 3.25)), H.to_global(Vector3(-3.6, 0, 3.4))]],
		["w5_store", [H.to_global(Vector3(-1.0, 0, 3.25)), H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(2.4, 0, 3.0))]],
		["w6_gornica", [H.to_global(Vector3(1.0, 0, 3.25)), H.to_global(Vector3(0, 0, 2.6)), H.to_global(Vector3(0, 0, 0.5)), H.to_global(Vector3(-2.5, 0, -1.5))]],
		["w7_bedroom", [H.to_global(Vector3(0.8, 0, -2.0)), H.to_global(Vector3(2.4, 0, -2.0)), H.to_global(Vector3(3.8, 0, -2.5))]],
	]
	for r in route:
		await _walk(r[1])
		print("[world] %s: герой в %s, «%s»" % [r[0], str(player.global_position.snapped(Vector3.ONE * 0.01)), _where()])
		await _snap(r[0])
	place_crate()
	await get_tree().create_timer(0.4).timeout
	await _snap("w8_crate")
	print("[world] ящиков: %d, последний в %s" % [crates.size(), str(crates[-1].global_position.snapped(Vector3.ONE * 0.01))])
	# обратно на улицу и к краю кластера
	await _walk([H.to_global(Vector3(0.8, 0, -2.0)), H.to_global(Vector3(0, 0, 0.5)), H.to_global(Vector3(0, 0, 3.0)), H.door_point(2.5)], 20.0)
	player.global_position = Vector3(0, 0.05, 44)
	await _walk([Vector3(0, 0, 60)], 8.0)
	print("[world] у края: %s (дальше края кластера пройти нельзя)" % str(player.global_position.snapped(Vector3.ONE * 0.01)))
	await _snap("w9_edge")
	get_tree().quit()
