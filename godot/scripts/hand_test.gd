extends Node
## Тестовая сцена хвата оружия (фотосъёмка CI, shots.gd): все типы персонажей — герой (модель Tripo поверх скелета
## player.glb, SkinFollow + HeroPose), мур 1 и мур 2 (модели Tripo, клипы пересчитаны SkinBake + NpcPose), наёмник
## (player.glb + NpcPose) — с одним и тем же стволом. Видно оси точек оружия (RightGrip, LeftSupportGrip, MuzzlePoint,
## StockContact) и ладоней, кости рук — линиями поверх всего. Меряет в каждом состоянии (стойка/переноска, шаг, бег,
## прицел, выстрел, поворот, смена оружия) расхождение ладоней с точками хвата и куда смотрит ствол; сначала АК-74 и
## Glock — со снимками спереди, сбоку, сверху и под углом, потом все стволы — только числа. Норма — 2 см.

const LIMIT := 0.02
const CHARS := ["герой", "мур 1", "мур 2", "наёмник"]
const VIEWS := ["спереди", "сбоку", "сверху", "под углом"]

var game
var dir := ""
var report: PackedStringArray = []
var fails := 0
var checks := 0
var _dbg: MeshInstance3D
var _im: ImmediateMesh
var _axes: Array = []      # [Node3D, длина]
var _bones: Array = []     # [Skeleton3D, [кости]]
var _npcs: Array = []      # {"root": Node3D, "model": Node3D, "pose": NpcPose, "gun": Node3D, "grip": Node3D, "unit": float, "anim": AnimationPlayer, "pistol": bool}

func run(g, out_dir: String) -> void:
	game = g
	dir = out_dir
	_make_debug()
	var p = game.player
	var keep: Dictionary = game.kit.duplicate()
	game.exits_off = true
	game.hud.hide_panel()
	# заражённые локации не мешают сцене (подходили к героям и заслоняли снимки)
	for e in game.enemies:
		if is_instance_valid(e):
			e.queue_free()
	game.enemies.clear()
	report.append("Проверка хвата оружия (%s): норма — ладонь не дальше %.0f см от точки хвата в обычных состояниях" % [Time.get_datetime_string_from_system(true), LIMIT * 100.0])
	# 1) АК-74 и пистолет — со снимками со всех сторон
	for id in ["ak74", "glock17"]:
		await _weapon(id, true)
	# 2) остальные стволы (кроме установочных) — числа
	for id in Data.WEAPONS:
		var w := Data.weapon(id)
		if w.get("slot", "") != "gun" or bool(w.get("mounted", false)) or w.has("alias") or id in ["ak74", "glock17"]:
			continue
		await _weapon(id, false)
	report.append("Итого: проверок %d, вне нормы %d" % [checks, fails])
	game.exits_off = false
	var f := FileAccess.open(dir.path_join("handtest.txt"), FileAccess.WRITE)
	f.store_string("\n".join(report) + "\n")
	f.close()
	print("HANDTEST: проверок %d, вне нормы %d" % [checks, fails])
	for line in report:
		if line.begins_with("✗"):
			print("  " + line)
	_clear_npcs()
	if game.get_tree().process_frame.is_connected(_draw):
		game.get_tree().process_frame.disconnect(_draw)
	_dbg.queue_free()
	game.kit.clear()
	game.kit.merge(keep)
	p.attach_gear()

# ---------- Один ствол на всех ----------

func _weapon(id: String, shots: bool) -> void:
	var p = game.player
	var w := Data.weapon(id)
	var pistol: bool = str(w.get("anim", "rifle")) == "pistol"
	var two: bool = bool(Gear.grip_class(id)["two"])
	report.append("")
	report.append("== %s (класс %s, %s) ==" % [w.get("name", id), Gear.CLASS_OF.get(id, "rifle"), "двуручный" if two else "одноручный"])
	game.kit["gun"] = id
	game.wear[id] = int(w.get("durability", 100))
	p.hold = "gun"
	p.attach_gear()
	p.global_position = _spot()
	p.rotation.y = 0.0
	_clear_npcs()
	var fwd := Vector3(sin(p.rotation.y), 0, cos(p.rotation.y))
	var right := fwd.cross(Vector3.UP)
	for k in 3:
		_add_npc(k, id, p.global_position + right * (3.0 * (k + 1)), pistol)   # 3 м — соседи не заслоняют снимки сбоку
	_axes.clear()
	_bones.clear()
	var hero_gun: Node3D = p.models.get(id)
	_watch_gun(hero_gun)
	if p.skeleton:
		var th: Node3D = p.tripo_hero
		var tsk: Skeleton3D = th.find_children("*", "Skeleton3D", true, false)[0] if th else p.skeleton
		_bones.append([tsk, _arm_bones(tsk)])
	for n in _npcs:
		_watch_gun(n["gun"])
		_bones.append([n["sk"], _arm_bones(n["sk"])])
	await _wait(0.8)
	# состояния героя
	await _state(id, "стойка/переноска", 0.6, two, func(): p.move_input = Vector2.ZERO)
	if shots:
		await _photos(id, "стойка")
	await _state(id, "шаг", 0.8, two, func(): p.move_input = Vector2(0, -0.45))
	await _state(id, "бег", 0.8, two, func(): p.move_input = Vector2(0, -1.0))
	p.move_input = Vector2.ZERO
	p.global_position = _spot()
	await _wait(0.4)
	await _state(id, "прицел", 0.6, two, func(): p.aim_t = 2.5)
	if shots:
		await _photos(id, "прицел")
	var z = game.spawn_enemy("runner", p.global_position + fwd * 3.0)
	z.hp = 100000.0
	await _state(id, "выстрел", 1.0, two, func(): p.attack_held = true)
	p.attack_held = false
	if is_instance_valid(z):
		game.enemies.erase(z)
		z.queue_free()
	await _state(id, "поворот", 0.8, two, func(): p.move_input = Vector2(1.0, 0.0))
	p.move_input = Vector2.ZERO
	p.aim_t = 0.0
	# смена оружия: левая кисть отпускает и снова берёт цевьё — норма не применяется, только число
	p.switch_weapon()
	await _state(id, "смена оружия (без нормы)", 1.6, false, func(): pass)
	if p.hold != "gun":
		p.switch_weapon()
		await _wait(1.6)

## Одно состояние: замер каждого кадра в течение secs; во всех персонажах — максимум расхождения ладоней.
func _state(id: String, label: String, secs: float, strict: bool, setup: Callable) -> void:
	var p = game.player
	setup.call()
	var npc_clip := _npc_clip(label)
	for n in _npcs:
		_npc_play(n, npc_clip, label)
	var worst := {}
	var lefts := {}   # персонаж → промахи левой по кадрам (для медианы: разовый промах на переходе или всё время)
	var t := 0.0
	while t < secs:
		await game.get_tree().physics_frame
		t += 1.0 / 60.0
		if t < 0.25:
			continue
		var m := _measure()
		for k in m:
			var prev: Array = worst.get(k, [0.0, 0.0, 0.0])
			var cur: Array = m[k]
			worst[k] = [maxf(prev[0], cur[0]), maxf(prev[1], cur[1]), maxf(prev[2], cur[2])]
			if float(cur[1]) >= 0.0:
				if not lefts.has(k):
					lefts[k] = []
				lefts[k].append(float(cur[1]))
	for k in CHARS:
		if not worst.has(k):
			continue
		var v: Array = worst[k]
		var ok: bool = not strict or (v[0] <= LIMIT and v[1] <= LIMIT)
		var aimed: bool = label in ["прицел", "выстрел"]
		if aimed and v[2] > 15.0:
			ok = false
		checks += 1
		if not ok:
			fails += 1
		var med := ""
		if lefts.has(k) and (lefts[k] as Array).size() > 2:
			var arr: Array = lefts[k]
			arr.sort()
			med = " (медиана %.1f см, кадров > 2 см: %d из %d)" % [float(arr[arr.size() / 2]) * 100.0, arr.filter(func(e): return e > LIMIT).size(), arr.size()]
		report.append("%s %s · %s · %s: правая %.1f см, левая %s%s, ствол к направлению взгляда %.0f°" % [
			"✓" if ok else "✗", Data.weapon(id).get("name", id), k, label, v[0] * 100.0,
			("%.1f см" % (v[1] * 100.0)) if v[1] >= 0.0 else "—", med, v[2]])
	p.move_input = Vector2.ZERO

## Расхождения: правая ладонь ↔ RightGrip, левая ладонь ↔ LeftSupportGrip (м), угол ствола к взгляду (°).
func _measure() -> Dictionary:
	var out := {}
	var p = game.player
	var gun: Node3D = p.models.get(p.weapon_id())
	if gun and gun.is_inside_tree():
		var rg := Gear.point(gun, "RightGrip")
		var r_err: float = p.grip.global_position.distance_to(rg.global_position) if rg and p.grip else 0.0
		var l_err := -1.0
		var f: Node = p.tripo_hero.get_node_or_null("SkinFollow") if p.tripo_hero else null
		if f and Gear.point(gun, "LeftSupportGrip") and float(p.ik_w) > 0.95:
			l_err = maxf(0.0, float(f.get("left_error")))
		var fwd := Vector3(sin(p.rotation.y), 0, cos(p.rotation.y))
		out["герой"] = [r_err, l_err, _barrel_angle(gun, fwd)]
	for n in _npcs:
		var g: Node3D = n["gun"]
		var rg2 := Gear.point(g, "RightGrip")
		var r2: float = (n["grip"] as Node3D).global_position.distance_to(rg2.global_position) if rg2 else 0.0
		var np: NpcPose = n["pose"]
		var l2: float = np.left_error * float(n["unit"]) if np.left_error >= 0.0 and np.left > 0.95 else -1.0
		var root: Node3D = n["root"]
		var fwd2 := root.global_transform.basis.z
		fwd2.y = 0.0
		out[n["name"]] = [r2, l2, _barrel_angle(g, fwd2.normalized())]
	return out

func _barrel_angle(gun: Node3D, fwd: Vector3) -> float:
	var b := -gun.global_transform.basis.y.normalized()
	var flat := Vector3(b.x, 0, b.z)
	if flat.length() < 0.05 or fwd.length() < 0.05:
		return 90.0
	return rad_to_deg(flat.normalized().angle_to(fwd.normalized()))

# ---------- Персонажи-участники ----------

func _add_npc(k: int, id: String, pos: Vector3, pistol: bool) -> void:
	var holder := Node3D.new()
	game.add_child(holder)
	holder.global_position = pos
	var model: Node3D
	var pose: NpcPose
	var grip: Node3D
	var unit := 1.0
	var clips := ["IdleRifle", "WalkRifle", "RunRifle", "AimRifle", "ShootRifle", "IdlePistol", "WalkPistol", "RunPistol", "AimPistol", "Shoot"]
	if k < 2:
		model = SkinBake.instance(["res://assets/tripo/mur_1.glb", "res://assets/tripo/mur_2.glb"][k], clips, game)
	if model:
		holder.add_child(model)
		grip = model.find_child("Grip", true, false) as Node3D
		pose = NpcPose.new()
		pose.grip_r = model.get_meta("grip_r", Transform3D.IDENTITY)
		pose.grip_l = model.get_meta("grip_l", Transform3D.IDENTITY)
		unit = float(model.get_meta("unit", 1.0))
		pose.unit = unit
	else:
		model = (load("res://assets/characters/player.glb") as PackedScene).instantiate()
		holder.add_child(model)
		grip = Player.attach_point(model, "GripR")
		pose = NpcPose.make_for_old(model)
	var sk: Skeleton3D = model.find_children("*", "Skeleton3D", true, false)[0]
	sk.add_child(pose)
	var gun := Gear.weapon(str(Data.weapon(id).get("model", id)))
	Gear.put_in_hand(gun, grip)
	pose.set_weapon(gun, id)
	var ap: AnimationPlayer = model.get_node_or_null("AnimationPlayer") as AnimationPlayer
	if ap == null:
		ap = model.find_child("AnimationPlayer", true, false) as AnimationPlayer
	_npcs.append({"root": holder, "model": model, "pose": pose, "gun": gun, "grip": grip, "unit": unit, "anim": ap,
		"pistol": pistol, "sk": sk, "name": CHARS[k + 1]})

func _npc_clip(label: String) -> String:
	if label.begins_with("шаг"):
		return "Walk"
	if label.begins_with("бег"):
		return "Run"
	if label.begins_with("прицел"):
		return "Aim"
	if label.begins_with("выстрел"):
		return "Shoot"
	return "Idle"

func _npc_play(n: Dictionary, kind: String, label: String) -> void:
	var ap: AnimationPlayer = n["anim"]
	var pistol: bool = n["pistol"]
	var names := {"Idle": "IdlePistol" if pistol else "IdleRifle", "Walk": "WalkPistol" if pistol else "WalkRifle",
		"Run": "RunPistol" if pistol else "RunRifle", "Aim": "AimPistol" if pistol else "AimRifle", "Shoot": "Shoot" if pistol else "ShootRifle"}
	var c: String = names[kind]
	if ap and ap.has_animation(c):
		ap.get_animation(c).loop_mode = Animation.LOOP_LINEAR
		ap.play(c, 0.1)
	var np: NpcPose = n["pose"]
	np.carry = 1.0 if kind in ["Idle", "Walk", "Run"] else 0.0
	np.left = 1.0
	# поворот: участник медленно разворачивается вместе с героем
	if label.begins_with("поворот"):
		var tw: Tween = game.create_tween()
		tw.tween_property(n["root"], "rotation:y", (n["root"] as Node3D).rotation.y + PI * 0.5, 0.6)

func _clear_npcs() -> void:
	for n in _npcs:
		if is_instance_valid(n["root"]):
			(n["root"] as Node3D).queue_free()
	_npcs.clear()

## Открытое место для замера: не у выхода (точка старта — у выхода, и шаг уводил героя на карту Улья), вокруг
## 5 м без стен и построек — герой ходит и бегает, справа от него стоят три NPC.
func _spot() -> Vector3:
	var lv = game.level
	for r in [0.0, 6.0, 12.0, 18.0, 24.0, 30.0]:
		for k in 12:
			var a := k * TAU / 12.0
			var c := Vector3(cos(a) * r, 0, sin(a) * r)
			var ok := true
			for dx in [-5.0, 0.0, 5.0]:
				for dz in [-5.0, 0.0, 5.0]:
					var q := c + Vector3(dx, 0, dz)
					if lv.blocked_at(q) or not lv.building_at(q).is_empty() or not lv.exit_at(q).is_empty():
						ok = false
			if ok:
				return c
	var st: Dictionary = lv.meta.get("start", {"x": 0, "z": 0})
	return Vector3(float(st["x"]), 0, float(st["z"]))

# ---------- Снимки со всех сторон ----------

func _photos(id: String, label: String) -> void:
	var p = game.player
	game.set_process(false)
	var cam: Camera3D = game.camera
	var CW := 380
	var CH := 340
	var sheet := Image.create(CW * VIEWS.size(), CH * CHARS.size(), false, Image.FORMAT_RGB8)
	var size: Vector2 = game.get_viewport().get_visible_rect().size
	game.hud.hide_panel()
	game.hud.visible = false
	var targets: Array = [p]
	for n in _npcs:
		targets.append(n["root"])
	for ci in targets.size():
		var t: Node3D = targets[ci]
		var fwd := t.global_transform.basis.z
		if ci == 0:
			fwd = Vector3(sin(p.rotation.y), 0, cos(p.rotation.y))
		fwd.y = 0.0
		fwd = fwd.normalized()
		var right := fwd.cross(Vector3.UP)
		var at := t.global_position + Vector3(0, 1.35, 0)
		for vi in VIEWS.size():
			var off: Vector3 = [fwd * 2.2 + Vector3(0, 0.2, 0), right * 2.2 + Vector3(0, 0.2, 0), Vector3(0, 2.6, 0) + fwd * 0.15, fwd * 1.6 + right * 1.3 + Vector3(0, 0.9, 0)][vi]
			cam.global_position = at + off
			cam.look_at(at, Vector3.UP if vi != 2 else fwd)
			await RenderingServer.frame_post_draw
			await RenderingServer.frame_post_draw
			var img: Image = game.get_viewport().get_texture().get_image()
			if img:
				img.convert(Image.FORMAT_RGB8)
				var cw := int(size.y * 0.95 * CW / CH)
				var crop := img.get_region(Rect2i(int(size.x * 0.5 - cw * 0.5), int(size.y * 0.025), cw, int(size.y * 0.95)))
				crop.resize(CW, CH, Image.INTERPOLATE_BILINEAR)
				sheet.blit_rect(crop, Rect2i(0, 0, CW, CH), Vector2i(vi * CW, ci * CH))
	game.set_process(true)
	game.hud.visible = true
	var file := "handtest_%s_%s.jpg" % [id, "aim" if label == "прицел" else "idle"]
	sheet.save_jpg(dir.path_join(file), 0.85)
	report.append("  снимок: %s — %s (строки: %s; столбцы: %s)" % [file, label, ", ".join(CHARS), ", ".join(VIEWS)])

# ---------- Оси и кости поверх всего ----------

func _make_debug() -> void:
	_im = ImmediateMesh.new()
	_dbg = MeshInstance3D.new()
	_dbg.mesh = _im
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.vertex_color_use_as_albedo = true
	m.no_depth_test = true
	m.render_priority = 10
	_dbg.material_override = m
	_dbg.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	game.add_child(_dbg)
	_dbg.set_process(true)
	game.get_tree().process_frame.connect(_draw)

func _watch_gun(gun: Node3D) -> void:
	if gun == null:
		return
	for nm in ["RightGrip", "LeftSupportGrip", "MuzzlePoint", "StockContact"]:
		var n := Gear.point(gun, nm)
		if n:
			_axes.append([n, 0.07 if nm != "RightGrip" else 0.1])

func _arm_bones(sk: Skeleton3D) -> Array:
	var out: Array = []
	for nm in ["RightShoulder", "RightArm", "RightForeArm", "RightHand", "LeftShoulder", "LeftArm", "LeftForeArm", "LeftHand", "Spine2"]:
		out.append(SkinFollow.find_mixamo(sk, nm))
	return out

func _draw() -> void:
	if not is_instance_valid(_dbg):
		return
	_im.clear_surfaces()
	if _axes.is_empty() and _bones.is_empty():
		return
	_im.surface_begin(Mesh.PRIMITIVE_LINES)
	var inv := _dbg.global_transform.affine_inverse()
	# пустая поверхность — ошибка движка: одна нулевая линия всегда
	_im.surface_set_color(Color.BLACK)
	_im.surface_add_vertex(Vector3.ZERO)
	_im.surface_add_vertex(Vector3.ZERO)
	for a in _axes:
		var n: Node3D = a[0]
		if not is_instance_valid(n) or not n.is_inside_tree() or not n.is_visible_in_tree():
			continue
		var t := n.global_transform.orthonormalized()
		var l: float = a[1]
		for k in 3:
			_im.surface_set_color([Color(1, 0.15, 0.15), Color(0.2, 1, 0.2), Color(0.3, 0.5, 1)][k])
			_im.surface_add_vertex(inv * t.origin)
			_im.surface_add_vertex(inv * (t.origin + t.basis[k] * l))
	for bset in _bones:
		var sk: Skeleton3D = bset[0]
		if not is_instance_valid(sk) or not sk.is_visible_in_tree():
			continue
		var b: Array = bset[1]
		_im.surface_set_color(Color(1, 0.9, 0.2))
		for chain in [[0, 1, 2, 3], [4, 5, 6, 7]]:
			for i in chain.size() - 1:
				var i0: int = b[chain[i]]
				var i1: int = b[chain[i + 1]]
				if i0 < 0 or i1 < 0:
					continue
				_im.surface_add_vertex(inv * (sk.global_transform * sk.get_bone_global_pose(i0)).origin)
				_im.surface_add_vertex(inv * (sk.global_transform * sk.get_bone_global_pose(i1)).origin)
	_im.surface_end()

func _wait(secs: float) -> void:
	await game.get_tree().create_timer(secs).timeout
