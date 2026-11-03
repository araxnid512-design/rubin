extends Node
## Тестовая сцена анимаций героя (запуск: godot -- --animtest <папка>; в CI — под xvfb с записью видео --write-movie).
## Герой — новая модель (Tripo, SkinFollow) с АК-47 на открытом месте Заречного; цель — манекен в 6 м впереди, он
## идёт вместе с героем, поэтому корпус и ствол всё время смотрят в одну сторону (на север), а ход задаётся в осях
## корпуса. Сценарий: стойка, прицел, шаг и бег в 8 направлениях в прицеле, стрельба очередью на ходу, перезарядка на
## ходу, смена оружия, разворот на месте (цель обходит героя), старт и остановка, бег с поворотами без прицела. Первый
## проход снимает игровая камера сверху, второй (8 направлений шагом и бегом) — камера сбоку.
## Замеры — на видимой модели (её кости, не скрытого скелета), каждый кадр:
##   • скольжение стоп: горизонтальная скорость стопы, пока она стоит на земле (норма — до 0,25 м/с у 95 % кадров);
##   • левая кисть до цевья (SkinFollow.left_error; норма — до 3 см);
##   • скручивание позвоночника относительно таза (Player.pose.twist; на ходу с автоматом — до 25°);
##   • ствол сквозь корпус (отрезок ствола ближе 13 см к оси Hips→Neck) и локоть в теле (ближе 9 см) — кадров;
## и листы кадров: anim_top.jpg (сверху), anim_side.jpg (сбоку), отчёт anim_report.txt.

class Dummy extends Node3D:
	var alive := true
	var T := {"radius": 0.4}

	func damage(_dmg: float, _from: Vector3) -> void:
		pass

const DIRS := [["F", Vector2(0, 1), "вперёд"], ["FL", Vector2(0.7071, 0.7071), "вперёд-влево"], ["L", Vector2(1, 0), "влево"],
	["BL", Vector2(0.7071, -0.7071), "назад-влево"], ["B", Vector2(0, -1), "назад"], ["BR", Vector2(-0.7071, -0.7071), "назад-вправо"],
	["R", Vector2(-1, 0), "вправо"], ["FR", Vector2(-0.7071, 0.7071), "вперёд-вправо"]]
const CW := 220
const CH := 280
const FRAMES := 5
const SLIDE_OK := 0.25
const HAND_OK := 0.03
const TWIST_OK := 25.0

var game: Node
var dir := ""
var p: Player
var follow: SkinFollow
var dst: Skeleton3D
var b := {}
var dummy: Dummy
var center := Vector3.ZERO
var view := "top"
var report: Array[String] = []
var fails := 0
var sheets := {"top": [], "side": []}
var ankle0 := {"L": 0.08, "R": 0.08}
var _prev_foot := {}
var acc := {}

func run(g: Node, out_dir: String) -> void:
	game = g
	dir = out_dir
	DirAccess.make_dir_recursive_absolute(dir)
	game.exits_off = true
	if game.loc != "zarechny":
		game.enter("zarechny", game.loc)
	await _wait(1.0)
	game.set_process(false)   # main каждый кадр ставит ход с экрана и двигает камеру — здесь это делает сцена
	game.hud.visible = false
	p = game.player
	_clear_enemies()
	game.kit["gun"] = "ak47"
	game.wear["ak47"] = int(Data.weapon("ak47").get("durability", 500)) * 10
	p.hold = "gun"
	p.attach_gear()
	follow = (p.tripo_hero.get_node_or_null("SkinFollow") as SkinFollow) if p.tripo_hero else null
	if follow == null:
		report.append("✗ нет новой модели героя (Tripo/SkinFollow) — проверять нечего")
		_finish()
		return
	dst = follow.dst
	for n in ["Hips", "Neck", "LeftFoot", "RightFoot", "LeftForeArm", "RightForeArm", "LeftToeBase", "RightToeBase"]:
		b[n] = SkinFollow.find_mixamo(dst, n)
	center = _spot()
	_place(center)
	dummy = Dummy.new()
	game.add_child(dummy)
	game.hostiles.append(dummy)
	report.append("Тестовая сцена анимаций героя (%s): новая модель Tripo, АК-47, Заречный, место %s" % [Time.get_datetime_string_from_system(true), str(center.snapped(Vector3.ONE * 0.1))])
	report.append("Нормы: скольжение стоп на земле — 95 %% кадров до %.2f м/с; левая кисть до цевья — до %.0f см; скручивание на ходу — до %.0f°; ствол сквозь корпус и локоть в теле — 0 кадров" % [SLIDE_OK, HAND_OK * 100.0, TWIST_OK])
	# ---- проход 1: игровая камера сверху ----
	view = "top"
	await _seg("стойка", 1.4, Vector2.ZERO, 0.0, false, false)
	_ankle_ref()
	await _seg("прицел стоя", 1.2, Vector2.ZERO, 0.0, true, false)
	for d in DIRS:
		await _seg("шаг %s (%s), прицел" % [d[0], d[2]], 1.7, d[1], 0.45, true, false)
	for d in DIRS:
		await _seg("бег %s (%s), прицел" % [d[0], d[2]], 1.4, d[1], 1.0, true, false)
	await _seg("стрельба очередью на ходу влево", 1.6, Vector2(1, 0), 0.45, true, true)
	await _seg("стрельба очередью на ходу вперёд-вправо", 1.4, Vector2(-0.7071, 0.7071), 0.45, true, true)
	p.mag_left["ak47"] = 1
	await _seg("перезарядка на ходу назад", 2.6, Vector2(0, -1), 0.45, true, true)
	await _seg("смена оружия стоя (на топор и обратно)", 3.2, Vector2.ZERO, 0.0, false, false, "switch")
	await _seg("разворот на месте: цель обходит героя", 3.0, Vector2.ZERO, 0.0, true, false, "orbit")
	await _seg("старт и бег вперёд без прицела", 1.4, Vector2(0, 1), 1.0, false, false)
	await _seg("остановка", 0.9, Vector2.ZERO, 0.0, false, false)
	await _seg("бег с поворотами без прицела", 2.6, Vector2(0, 1), 1.0, false, false, "curve")
	# ---- проход 2: камера сбоку (анатомия ног и рук) ----
	view = "side"
	for d in DIRS:
		await _seg("сбоку: шаг %s, прицел" % d[0], 1.6, d[1], 0.45, true, false)
	for d in DIRS:
		await _seg("сбоку: бег %s, прицел" % d[0], 1.3, d[1], 1.0, true, false)
	_finish()

func _finish() -> void:
	report.append("Итого: участков %d, вне нормы %d" % [report.size() - 3, fails])
	print("ANIMTEST: %s" % ("OK" if fails == 0 else "есть замечания: %d" % fails))
	var f := FileAccess.open(dir.path_join("anim_report.txt"), FileAccess.WRITE)
	f.store_string("\n".join(PackedStringArray(report)) + "\n")
	f.close()
	for v in ["top", "side"]:
		var cells: Array = sheets[v]
		if cells.is_empty():
			continue
		var rows := int(ceil(cells.size() / float(FRAMES)))
		var sheet := Image.create(CW * FRAMES, CH * rows, false, Image.FORMAT_RGB8)
		for i in cells.size():
			sheet.blit_rect(cells[i], Rect2i(0, 0, CW, CH), Vector2i((i % FRAMES) * CW, (i / FRAMES) * CH))
		sheet.save_jpg(dir.path_join("anim_%s.jpg" % v), 0.85)
	game.get_tree().quit(0)

func _wait(secs: float) -> void:
	await game.get_tree().create_timer(secs).timeout

func _clear_enemies() -> void:
	for e in game.enemies:
		if is_instance_valid(e):
			e.queue_free()
	game.enemies.clear()

func _place(at: Vector3) -> void:
	p.global_position = at
	p.velocity = Vector3.ZERO
	p.rotation.y = 0.0
	p.reset_physics_interpolation()

## Открытое место: вокруг 7 м без стен, построек и выходов (герой бежит в любую сторону ~5 м).
func _spot() -> Vector3:
	var lv = game.level
	var st: Dictionary = lv.meta.get("start", {"x": 0, "z": 0})
	var s0 := Vector3(float(st["x"]), 0, float(st["z"]))
	var best := s0
	var best_r := -1.0
	for r in [0.0, 6.0, 12.0, 18.0, 24.0, 30.0, 36.0]:
		for k in 16:
			var a := k * TAU / 16.0
			var c := s0 + Vector3(cos(a) * r, 0, sin(a) * r)
			var clear := 0.0
			for rr in [2.0, 3.5, 5.0, 6.0, 7.0]:
				var ok := true
				for kk in 16:
					var aa := kk * TAU / 16.0
					var q := c + Vector3(cos(aa), 0, sin(aa)) * float(rr)
					if lv.blocked_at(q) or not lv.building_at(q).is_empty() or not lv.exit_at(q).is_empty():
						ok = false
						break
				if not ok:
					break
				clear = float(rr)
			if clear > best_r:
				best_r = clear
				best = c
			if clear >= 7.0:
				return c
	return best

## Высота лодыжек новой модели стоя — от неё считается «стопа на земле».
func _ankle_ref() -> void:
	for s in ["L", "R"]:
		var i: int = b["LeftFoot" if s == "L" else "RightFoot"]
		if i >= 0:
			ankle0[s] = _bone(i).y - p.global_position.y

func _bone(i: int) -> Vector3:
	return dst.global_transform * dst.get_bone_global_pose(i).origin

## Участок сценария: ход local (в осях корпуса: x — влево, z — вперёд; у прицела корпус смотрит на север, без прицела —
## ход в мировых осях) с силой mag, прицел/огонь, особое действие; замеры каждый кадр и FRAMES кадров на лист.
func _seg(label: String, secs: float, local: Vector2, mag: float, aim: bool, fire: bool, special := "") -> void:
	_clear_enemies()
	if special != "orbit" and special != "switch" and label != "остановка" and not label.begins_with("стрельба") and not label.begins_with("перезарядка"):
		_place(center)
	acc = {"slide": [], "hand": [], "twist": 0.0, "barrel": 0, "elbow": 0, "frames": 0, "speed": [], "ts": [], "loco": {}, "blend": Vector2.ZERO}
	_prev_foot.clear()
	if special == "switch":
		p.switch_weapon()
	var t := 0.0
	var shots_left := FRAMES
	var next_shot := secs * 0.3
	var switched_back := false
	while t < secs:
		var dt: float = get_process_delta_time() if t > 0.0 else 1.0 / 30.0
		t += dt
		var m := local * mag
		if special == "curve":
			var a := t * 2.2
			m = Vector2(sin(a), cos(a)) * mag
		p.move_input = m
		p.attack_held = fire
		if aim:
			p.aim_t = 1.0
		# цель: 6 м впереди корпуса (на север); при развороте — обходит героя по кругу
		var tgt := p.global_position + Vector3(0, 0, 6)
		if special == "orbit":
			var oa := t / secs * TAU * 0.75
			tgt = p.global_position + Vector3(sin(oa), 0, cos(oa)) * 6.0
		dummy.global_position = tgt
		if special == "switch" and not switched_back and t > secs * 0.5 and not p.equipping:
			switched_back = true
			p.switch_weapon()
		await game.get_tree().process_frame
		_camera()
		_measure(dt, aim and mag > 0.0)
		if shots_left > 0 and t >= next_shot:
			await _snap()
			shots_left -= 1
			next_shot += secs * 0.7 / FRAMES
	p.move_input = Vector2.ZERO
	p.attack_held = false
	_report(label, mag > 0.0 and aim)

func _camera() -> void:
	var cam: Camera3D = game.camera
	var at := p.get_global_transform_interpolated().origin
	if view == "top":
		cam.global_position = at + Vector3(0, 15.5, 9.5)
		cam.look_at(at + Vector3(0, 0.8, 0), Vector3.UP)
	else:
		# сбоку слева от героя (он смотрит на север): видно ноги, корпус и обе руки
		cam.global_position = at + Vector3(-4.2, 1.15, 0.0)
		cam.look_at(at + Vector3(0, 0.95, 0), Vector3.UP)

func _measure(dt: float, moving_aim: bool) -> void:
	acc["frames"] = int(acc["frames"]) + 1
	var ground := p.global_position.y
	for s in ["L", "R"]:
		var i: int = b["LeftFoot" if s == "L" else "RightFoot"]
		if i < 0:
			continue
		var fp := _bone(i)
		if _prev_foot.has(s):
			var pp: Vector3 = _prev_foot[s]
			var low: bool = fp.y - ground < float(ankle0[s]) + 0.03 and pp.y - ground < float(ankle0[s]) + 0.03
			var vy := absf(fp.y - pp.y) / maxf(dt, 0.001)
			if low and vy < 0.4:
				(acc["slide"] as Array).append(Vector2(fp.x - pp.x, fp.z - pp.z).length() / maxf(dt, 0.001))
		_prev_foot[s] = fp
	if follow.left_error >= 0.0:
		(acc["hand"] as Array).append(follow.left_error)
	if moving_aim:
		acc["twist"] = maxf(float(acc["twist"]), absf(rad_to_deg(p.pose.twist)))
	var v := p.get_real_velocity()
	v.y = 0.0
	(acc["speed"] as Array).append(v.length())
	var lc: Dictionary = acc["loco"]
	lc[p.loco] = int(lc.get(p.loco, 0)) + 1
	if p.loco == "walk" or p.loco == "run":
		(acc["ts"] as Array).append(absf(float(p.anim_tree.get("parameters/%s_ts/scale" % p.loco))))
		acc["blend"] = p.move_dir_local
	# пересечения: ствол сквозь корпус, локоть в теле
	var hips: int = b["Hips"]
	var neck: int = b["Neck"]
	if hips >= 0 and neck >= 0:
		var a0 := _bone(hips)
		var a1 := _bone(neck)
		var node: Node3D = p.models.get(p.weapon_id())
		if node and node.is_inside_tree() and p.hold == "gun" and not p.hand_empty:
			var gp: Node3D = Gear.point(node, "RightGrip")
			var mp: Node3D = Gear.point(node, "MuzzlePoint")
			if gp and mp:
				var g0 := gp.global_position
				var g1 := mp.global_position
				var start := g0 + (g1 - g0).normalized() * 0.15
				var cl := Geometry3D.get_closest_points_between_segments(start, g1, a0, a1)
				if cl[0].distance_to(cl[1]) < 0.13:
					acc["barrel"] = int(acc["barrel"]) + 1
		for e in ["LeftForeArm", "RightForeArm"]:
			var ei: int = b[e]
			if ei >= 0:
				var ep := _bone(ei)
				var c := Geometry3D.get_closest_point_to_segment(ep, a0, a1)
				if c.distance_to(ep) < 0.09:
					acc["elbow"] = int(acc["elbow"]) + 1

static func _pct(arr: Array, q: float) -> float:
	if arr.is_empty():
		return 0.0
	var s := arr.duplicate()
	s.sort()
	return float(s[clampi(int(round(q * (s.size() - 1))), 0, s.size() - 1)])

func _report(label: String, moving_aim: bool) -> void:
	var sl: Array = acc["slide"]
	var hd: Array = acc["hand"]
	var s95 := _pct(sl, 0.95)
	var h95 := _pct(hd, 0.95)
	var tw := float(acc["twist"])
	var ok := s95 <= SLIDE_OK and (hd.is_empty() or h95 <= HAND_OK) and int(acc["barrel"]) == 0 and int(acc["elbow"]) == 0 and (not moving_aim or tw <= TWIST_OK)
	if not ok:
		fails += 1
	var lc: Dictionary = acc["loco"]
	var states := []
	for k in lc:
		states.append("%s %d" % [k, int(lc[k])])
	var bl: Vector2 = acc["blend"]
	report.append("%s %s: скорость %.2f м/с, темп клипа %.2f, походка [%s], ход в осях корпуса (%.2f, %.2f); стопы на земле: медиана %.2f, 95 %% %.2f, макс %.2f м/с (кадров %d); левая кисть до цевья: 95 %% %s; скручивание %d°; ствол сквозь корпус %d, локоть в теле %d кадров из %d" % [
		"✓" if ok else "✗", label, _pct(acc["speed"], 0.5), _pct(acc["ts"], 0.5), ", ".join(PackedStringArray(states)), bl.x, bl.y,
		_pct(sl, 0.5), s95, _pct(sl, 1.0), sl.size(), ("%.1f см" % (h95 * 100.0)) if not hd.is_empty() else "—", int(tw),
		int(acc["barrel"]), int(acc["elbow"]), int(acc["frames"])])
	print(report[report.size() - 1])

func _snap() -> void:
	await RenderingServer.frame_post_draw
	var img: Image = game.get_viewport().get_texture().get_image()
	if img == null:
		return
	img.convert(Image.FORMAT_RGB8)
	var size := Vector2(img.get_width(), img.get_height())
	var hh := int(size.y * (0.42 if view == "top" else 0.92))
	var cw := int(hh * CW / CH)
	var y0 := int(size.y * 0.5 - hh * 0.5) if view == "top" else int(size.y * 0.04)
	var crop := img.get_region(Rect2i(int(size.x * 0.5 - cw * 0.5), y0, cw, hh))
	crop.resize(CW, CH, Image.INTERPOLATE_BILINEAR)
	(sheets[view] as Array).append(crop)
