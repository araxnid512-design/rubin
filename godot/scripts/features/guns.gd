extends Node
## Модели новых стволов (SCAR-H, FN FAL, Steyr AUG, PM-63 RAK, SPAS-12): свои, из game/weapons.js (makeScar,
## makeFal, makeAug, makePm63, makeSpas12) — их выгружает scripts/export-godot.mjs в assets/weapons/<id>.glb
## с точкой ствола Muzzle; какой файл у ствола — поле model в Data.NEW_WEAPONS. Здесь — только автотест:
## модель есть, грузится, у неё есть Muzzle впереди кулака, и герой берёт её в руку и вешает в крепление.

var game: Node

func setup(g: Node) -> void:
	game = g

func smoke() -> int:
	var fail := 0
	for id in Data.NEW_WEAPONS:
		var w := Data.weapon(id)
		var mid := str(w.get("model", id))
		# модель — из Tripo (assets/tripo/w_<id>.glb) или старая браузерной игры (assets/weapons/<id>.glb)
		var ok: bool = mid == id and (ResourceLoader.exists("res://assets/tripo/w_%s.glb" % mid) or ResourceLoader.exists("res://assets/weapons/%s.glb" % mid))
		var info := "нет файла модели %s" % mid
		if ok:
			var node := Gear.weapon(mid)
			var muzzle := Gear.point(node, "MuzzlePoint")
			var meshes := node.find_children("*", "MeshInstance3D", true, false).size()
			# ствол смотрит по −Y хвата: дуло впереди рукояти; рукоять — точка RightGrip
			var mp: Vector3 = Gear.point_local(node, "MuzzlePoint").origin
			ok = muzzle != null and Gear.point(node, "RightGrip") != null and mp.y < -0.05 and meshes > 0
			info = "мешей %d, дуло %s, рукоять %s" % [meshes, str(mp) if muzzle else "нет", "есть" if Gear.point(node, "RightGrip") else "нет"]
			node.free()
		print(("✓ " if ok else "✗ ") + "модель %s (%s): %s" % [w.get("name", id), id, info])
		if not ok:
			fail += 1
	# модели из Tripo (assets/tripo): вписаны в габариты старых — та же длина, дуло на месте старого
	var tripo_n := 0
	for id in Data.WEAPONS:
		if Data.weapon(id).has("alias"):
			continue
		var mid := str(Data.weapon(id).get("model", id))
		if not ResourceLoader.exists("res://assets/tripo/w_%s.glb" % mid):
			continue
		tripo_n += 1
		var node := Gear.weapon(mid)
		var old_path := "res://assets/weapons/%s.glb" % mid
		var old: Node3D = (load(old_path) as PackedScene).instantiate() if ResourceLoader.exists(old_path) else null
		var nb := Gear._box(Gear._points(node))
		var ob := Gear._box(Gear._points(old)) if old else nb
		# длина — настоящая (Gear.LENGTH) или, кого там нет, как у старой модели, и на треть меньше (Gear.SCALE)
		var want: float = Gear.target_length(mid, ob.get_longest_axis_size())
		var ok2: bool = node.find_children("*", "MeshInstance3D", true, false).size() > 0 and absf(nb.get_longest_axis_size() - want) < want * 0.12
		if old and old.find_child("Muzzle", true, false):
			ok2 = ok2 and Gear.point(node, "MuzzlePoint") != null and Gear.point(node, "RightGrip") != null
		print(("✓ " if ok2 else "✗ ") + "Tripo: %s — длина %.2f м (нужна %.2f, старая модель %.2f м)" % [Data.weapon(id).get("name", id), nb.get_longest_axis_size(), want, ob.get_longest_axis_size()])
		if not ok2:
			fail += 1
		node.free()
		if old:
			old.free()
	print("· моделей оружия из Tripo: %d" % tripo_n)
	if ResourceLoader.exists("res://assets/tripo/player.glb"):
		var th = game.player.tripo_hero
		var bound: int = int(th.get_meta("bones_bound", 0)) if th else 0
		var okh: bool = th != null and bound >= 15
		print(("✓ " if okh else "✗ ") + "герой из Tripo: костей связано со старым скелетом %d" % bound)
		if not okh:
			fail += 1
	# герой: ствол в крепление на теле и в руку (как после покупки)
	var p = game.player
	var keep: Dictionary = game.kit.duplicate()
	var hold: String = p.hold
	for id in ["aug", "glock17"]:
		game.kit["gun"] = id
		game.wear[id] = int(Data.weapon(id).get("durability", 500))
		p.hold = "melee"
		p.attach_gear()
		# крепления (кобура, ремень) — из модели героя; если такого узла нет, ствол прячется — это не про модель ствола
		var mount = p.mounts.get(Data.weapon(id).get("mount", ""))
		var on_body: bool = p.models.has(id) and (mount == null or p.models[id].get_parent() == mount)
		p.hold = "gun"
		p.attach_gear()
		var in_hand: bool = p.models[id].get_parent() == p.grip and Gear.point(p.models[id], "MuzzlePoint") != null
		print(("✓ " if on_body and in_hand else "✗ ") + "%s: в креплении «%s» — %s, в руке — %s" % [Data.weapon(id)["name"], Data.weapon(id).get("mount", ""), on_body, in_hand])
		if not (on_body and in_hand):
			fail += 1
	game.kit.clear()
	game.kit.merge(keep)
	p.hold = hold
	p.attach_gear()
	for id in ["aug", "glock17"]:
		if keep.get("gun", "") != id:
			game.wear.erase(id)
			if p.models.has(id):
				p.models[id].queue_free()
				p.models.erase(id)
	fail += await _fire_all()
	fail += await _bake_check()
	fail += await _infected_check()
	return fail

## Пересчёт клипов героя на скелет модели Tripo (так анимации получают муры — SkinBake): проверка на модели героя.
func _bake_check() -> int:
	var path := "res://assets/tripo/player.glb"
	if not ResourceLoader.exists(path):
		return 0
	var tb := SkinBake.instance(path, ["IdleRifle", "WalkRifle"], game)
	if tb == null:
		print("✗ пересчёт клипов на модель Tripo: модель не собралась")
		return 1
	game.add_child(tb)
	tb.global_position = game.player.global_position + Vector3(0, 0, 0)
	var ap := tb.get_node_or_null("AnimationPlayer") as AnimationPlayer
	var grip := tb.find_child("Grip", true, false) as Node3D
	var tracks: int = ap.get_animation("WalkRifle").get_track_count() if ap and ap.has_animation("WalkRifle") else 0
	var ys: Array = []
	if ap and grip:
		ap.play("WalkRifle")
		for k in 4:
			await game._wait(0.15)
			ys.append(grip.global_position.y - tb.global_position.y)
	var moved := false
	for y in ys:
		moved = moved or absf(float(y) - float(ys[0])) > 0.005
	var ok: bool = tracks > 10 and ys.size() == 4 and float(ys.min()) > 0.5 and float(ys.max()) < 1.8 and moved
	print(("✓ " if ok else "✗ ") + "пересчёт клипов героя на модель Tripo (для муров): дорожек в «ходьбе» %d, хват на высоте %s м, рука двигается: %s" % [tracks, ", ".join(ys.map(func(v): return "%.2f" % v)), moved])
	tb.queue_free()
	return 0 if ok else 1

## Заражённые из Tripo (пустыш, лотерейщик, топтун, рубер): клипы старых моделей пересчитаны на новый скелет —
## рост в норме, ноги на земле, кисти ниже головы (поза покоя А/Т поправлена), в «ходьбе» тело движется.
func _infected_check() -> int:
	var fail := 0
	var p = game.player
	var k := 0
	for t in Data.ENEMY:
		var info: Dictionary = Data.ENEMY[t]
		if not ResourceLoader.exists("res://assets/tripo/%s.glb" % str(info.get("tripo", ""))):
			continue
		var t0 := Time.get_ticks_msec()
		var m := Enemy.make_model(game, t)
		var ms := Time.get_ticks_msec() - t0
		var holder := Node3D.new()
		game.add_child(holder)
		holder.add_child(m)
		m.transform = Transform3D(m.transform.basis.scaled(Vector3.ONE * float(info["scale"])), Vector3.ZERO)
		holder.global_position = p.global_position + Vector3(2.0 + k * 1.2, 0, 4.0)
		k += 1
		var ap := m.find_child("AnimationPlayer", true, false) as AnimationPlayer
		var sk := m.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D
		var head := SkinFollow.find_mixamo(sk, "Head")
		var foot := SkinFollow.find_mixamo(sk, "LeftFoot")
		var hand := SkinFollow.find_mixamo(sk, "RightHand")
		var tracks: int = ap.get_animation("Walk").get_track_count() if ap and ap.has_animation("Walk") else 0
		var hy: Array = []
		var fy := INF
		var handy := -INF
		if ap and head >= 0 and foot >= 0 and hand >= 0:
			ap.play("Walk")
			for f in 4:
				await game._wait(0.12)
				var base: float = holder.global_position.y
				hy.append((sk.global_transform * sk.get_bone_global_pose(head)).origin.y - base)
				fy = minf(fy, (sk.global_transform * sk.get_bone_global_pose(foot)).origin.y - base)
				handy = maxf(handy, (sk.global_transform * sk.get_bone_global_pose(hand)).origin.y - base - float(hy[-1]))
		var moved := hy.size() == 4 and float(hy.max()) - float(hy.min()) > 0.004
		# рубер ходит на четырёх (клипы браузерной игры: голова у старой модели в «ходьбе» на 0,9 м, кисти у земли)
		var head_min := 0.75 if t == "ruber" else 1.1
		var ok: bool = tracks > 10 and hy.size() == 4 and float(hy.min()) > head_min and float(hy.max()) < 2.8 and fy < 0.35 and handy < -0.1 and moved
		print(("✓ " if ok else "✗ ") + "заражённый из Tripo «%s»: клипов %d (дорожек в «ходьбе» %d), голова на высоте %s м, стопа %.2f м, кисть ниже головы на %.2f м, пересчёт %d мс" % [
			t, ap.get_animation_list().size() if ap else 0, tracks, ", ".join(hy.map(func(v): return "%.2f" % v)), fy, -handy, ms])
		if not ok:
			fail += 1
		holder.queue_free()
	return fail

# ---------- Стрельба из каждого ствола ----------

## Пороги проверки: дуло в прицеле смотрит туда же, куда летит пуля (по горизонтали и по высоте), градусы — с запасом
## на доворот корпуса (стреляет, когда довернул точнее 6°) и остаток подъёма ствола в первом выстреле; левая кисть
## у двуручного ствола — на цевье, м.
const AIM_YAW_MAX := 15.0
const AIM_PITCH_MAX := 25.0
const LEFT_MAX := 0.06

var _shots: Array = []
var _hits := 0

func _on_shot(shooter, w: Dictionary, from: Vector3) -> void:
	var p = game.player
	if shooter != p:
		return
	var node: Node3D = p.models.get(p.weapon_id())
	var barrel := Vector3.ZERO
	var muzzle_off := 0.0
	if node:
		barrel = -node.global_transform.basis.y.normalized()   # ствол — по −Y осей хвата
		muzzle_off = (from - node.global_position).dot(barrel)  # дуло — впереди хвата по стволу
	var f: Node = p.tripo_hero.get_node_or_null("SkinFollow") if p.tripo_hero else null
	# куда летит пуля: в цель (её выбирает attack() тем же вызовом в этом же кадре), без цели — по корпусу
	var aim := Vector3(sin(p.rotation.y), 0, cos(p.rotation.y))
	var target = game.nearest_enemy(p.global_position, float(w.get("range", 8.0)), true)
	var dist := -1.0
	var miss := 0.0
	if target:
		var to: Vector3 = target.global_position - from
		to.y = 0.0
		dist = to.length()
		if to.length() > 0.05:
			aim = to.normalized()
		miss = Player.barrel_miss(barrel, from, target.global_position)
	_shots.append({"from": from, "barrel": barrel, "aim": aim, "dist": dist, "miss": miss,
		"off": muzzle_off, "y": from.y - p.global_position.y, "left": float(f.get("left_error")) if f else -1.0})

func _on_hit(_t, _at: Vector3) -> void:
	_hits += 1

## Каждый ствол: герой берёт его, поднимает в прицел и стреляет по бегуну в 2,5 м. Проверка: выстрелы есть,
## вспышка и пуля вылетают из дула модели в руке (впереди хвата по стволу, на высоте рук), в момент выстрела дуло
## смотрит туда, куда летит пуля, левая кисть у двуручных — на цевье, есть попадания.
func _fire_all() -> int:
	var fail := 0
	var p = game.player
	var keep: Dictionary = game.kit.duplicate()
	var keep_hold: String = p.hold
	var hp0: float = p.hp
	p.max_hp = maxf(p.max_hp, 100000.0)
	p.hp = p.max_hp
	game.shot.connect(_on_shot)
	game.enemy_hit.connect(_on_hit)
	var n_ok := 0
	var n_all := 0
	for id in Data.WEAPONS:
		var w := Data.weapon(id)
		if w.get("slot", "") != "gun" or bool(w.get("mounted", false)) or w.has("alias"):
			continue
		n_all += 1
		game.kit["gun"] = id
		game.wear[id] = int(w.get("durability", 500))
		p.hold = "gun"
		p.attach_gear()
		await game._wait(0.5)
		# бегун в 2,5 м — в сторону, где нет стены
		var spot: Vector3 = p.global_position + Vector3(0, 0, 2.5)
		for k in 8:
			var a: float = p.rotation.y + k * PI / 4.0
			var c: Vector3 = p.global_position + Vector3(sin(a), 0, cos(a)) * 2.5
			if game.line_of_sight(p.global_position, c):
				spot = c
				break
		var z = game.spawn_enemy("runner", spot)
		_shots.clear()
		_hits = 0
		p.attack_held = true
		var t := 0.0
		while t < 4.0 and not (_hits > 0 and _shots.size() >= 2):
			await game._wait(0.1)
			t += 0.1
		p.attack_held = false
		var yaw := 0.0
		var pitch := 0.0
		var off := INF
		var ymin := INF
		var ymax := -INF
		var left := -1.0
		var miss := -INF
		var dmin := INF
		for sh in _shots:
			var b: Vector3 = sh["barrel"]
			var flat := Vector3(b.x, 0, b.z)
			if flat.length() > 0.05:
				yaw = maxf(yaw, rad_to_deg(flat.normalized().angle_to(sh["aim"])))
			miss = maxf(miss, float(sh["miss"]))
			if float(sh["dist"]) >= 0.0:
				dmin = minf(dmin, float(sh["dist"]))
			pitch = maxf(pitch, absf(rad_to_deg(asin(clampf(b.y, -1.0, 1.0)))))
			off = minf(off, float(sh["off"]))
			ymin = minf(ymin, float(sh["y"]))
			ymax = maxf(ymax, float(sh["y"]))
			left = maxf(left, float(sh["left"]))
		var two: bool = bool(p._profile()["two"]) and str(w.get("anim", "")) == "rifle"
		# дуло смотрит на цель: угол до её центра в допуске или луч ствола проходит через её тело (вплотную угол велик)
		var ok: bool = _shots.size() > 0 and (yaw <= AIM_YAW_MAX or miss <= 0.0) and pitch <= AIM_PITCH_MAX and off > 0.05 \
			and ymin > 0.9 and ymax < 1.9 and (_hits > 0 or _shots.size() < 4) and (not two or left <= LEFT_MAX)
		print(("✓ " if ok else "✗ ") + "стрельба: %s — выстрелов %d, попаданий %d; дуло к цели %.0f° (до цели от %.2f м, луч мимо тела %+.2f м), наклон %.0f°, дуло впереди хвата на %.2f м, на высоте %.2f–%.2f м%s" % [
			w.get("name", id), _shots.size(), _hits, yaw, dmin if dmin < INF else -1.0, miss if miss > -INF else 0.0, pitch, off if off < INF else -1.0, ymin if ymin < INF else -1.0, ymax,
			(", левая кисть до цевья %.3f м" % left) if two else ""])
		if ok:
			n_ok += 1
		else:
			fail += 1
		if is_instance_valid(z):
			game.enemies.erase(z)
			z.queue_free()
		await game._wait(0.2)
	game.shot.disconnect(_on_shot)
	game.enemy_hit.disconnect(_on_hit)
	print("· стреляют как положено: %d из %d стволов" % [n_ok, n_all])
	game.kit.clear()
	game.kit.merge(keep)
	p.hold = keep_hold
	p.attach_gear()
	p.hp = minf(hp0, p.max_hp)
	return fail
