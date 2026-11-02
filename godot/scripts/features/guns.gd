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
		var path := "res://assets/weapons/%s.glb" % w.get("model", id)
		var ok: bool = w.get("model", "") == id and ResourceLoader.exists(path)
		var info := "нет файла %s" % path
		if ok:
			var node: Node3D = (load(path) as PackedScene).instantiate()
			var muzzle: Node3D = node.find_child("Muzzle", true, false)
			var meshes := node.find_children("*", "MeshInstance3D", true, false).size()
			# ствол смотрит по −Y хвата: точка ствола впереди кулака
			ok = muzzle != null and muzzle.position.y < -0.15 and meshes > 0
			info = "мешей %d, Muzzle %s" % [meshes, str(muzzle.position) if muzzle else "нет"]
			node.free()
		print(("✓ " if ok else "✗ ") + "модель %s (%s): %s" % [w.get("name", id), id, info])
		if not ok:
			fail += 1
	# модели из Tripo (assets/tripo): вписаны в габариты старых — та же длина, дуло на месте старого
	var tripo_n := 0
	for id in Data.WEAPONS:
		var mid := str(Data.weapon(id).get("model", id))
		if not ResourceLoader.exists("res://assets/tripo/w_%s.glb" % mid):
			continue
		tripo_n += 1
		var node := Gear.weapon(mid)
		var old_path := "res://assets/weapons/%s.glb" % mid
		var old: Node3D = (load(old_path) as PackedScene).instantiate() if ResourceLoader.exists(old_path) else null
		var nb := Gear._box(Gear._points(node))
		var ob := Gear._box(Gear._points(old)) if old else nb
		# длина — настоящая (Gear.LENGTH) или, кого там нет, как у старой модели
		var want: float = float(Gear.LENGTH.get(mid, ob.get_longest_axis_size()))
		var ok2: bool = node.find_children("*", "MeshInstance3D", true, false).size() > 0 and absf(nb.get_longest_axis_size() - want) < want * 0.12
		if old and old.find_child("Muzzle", true, false):
			ok2 = ok2 and node.find_child("Muzzle", true, false) != null
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
	for id in ["aug", "pm63"]:
		game.kit["gun"] = id
		game.wear[id] = int(Data.weapon(id).get("durability", 500))
		p.hold = "melee"
		p.attach_gear()
		# крепления (кобура, ремень) — из модели героя; если такого узла нет, ствол прячется — это не про модель ствола
		var mount = p.mounts.get(Data.weapon(id).get("mount", ""))
		var on_body: bool = p.models.has(id) and (mount == null or p.models[id].get_parent() == mount)
		p.hold = "gun"
		p.attach_gear()
		var in_hand: bool = p.models[id].get_parent() == p.grip and p.models[id].find_child("Muzzle", true, false) != null
		print(("✓ " if on_body and in_hand else "✗ ") + "%s: в креплении «%s» — %s, в руке — %s" % [Data.weapon(id)["name"], Data.weapon(id).get("mount", ""), on_body, in_hand])
		if not (on_body and in_hand):
			fail += 1
	game.kit.clear()
	game.kit.merge(keep)
	p.hold = hold
	p.attach_gear()
	for id in ["aug", "pm63"]:
		if keep.get("gun", "") != id:
			game.wear.erase(id)
			if p.models.has(id):
				p.models[id].queue_free()
				p.models.erase(id)
	fail += await _fire_all()
	return fail

# ---------- Стрельба из каждого ствола ----------

## Пороги проверки: дуло в прицеле смотрит туда же, куда летит пуля (по горизонтали и по высоте), градусы;
## левая кисть у двуручного ствола — на цевье, м.
const AIM_YAW_MAX := 12.0
const AIM_PITCH_MAX := 20.0
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
	if target:
		var to: Vector3 = target.global_position - from
		to.y = 0.0
		if to.length() > 0.05:
			aim = to.normalized()
	_shots.append({"from": from, "barrel": barrel, "aim": aim,
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
		if w.get("slot", "") != "gun":
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
			var a := p.rotation.y + k * PI / 4.0
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
		for sh in _shots:
			var b: Vector3 = sh["barrel"]
			var flat := Vector3(b.x, 0, b.z)
			if flat.length() > 0.05:
				yaw = maxf(yaw, rad_to_deg(flat.normalized().angle_to(sh["aim"])))
			pitch = maxf(pitch, absf(rad_to_deg(asin(clampf(b.y, -1.0, 1.0)))))
			off = minf(off, float(sh["off"]))
			ymin = minf(ymin, float(sh["y"]))
			ymax = maxf(ymax, float(sh["y"]))
			left = maxf(left, float(sh["left"]))
		var two: bool = bool(p._profile()["two"]) and str(w.get("anim", "")) == "rifle"
		var ok: bool = _shots.size() > 0 and yaw <= AIM_YAW_MAX and pitch <= AIM_PITCH_MAX and off > 0.05 \
			and ymin > 0.9 and ymax < 1.9 and (_hits > 0 or _shots.size() < 4) and (not two or left <= LEFT_MAX)
		print(("✓ " if ok else "✗ ") + "стрельба: %s — выстрелов %d, попаданий %d; дуло к цели %.0f°, наклон %.0f°, дуло впереди хвата на %.2f м, на высоте %.2f–%.2f м%s" % [
			w.get("name", id), _shots.size(), _hits, yaw, pitch, off if off < INF else -1.0, ymin if ymin < INF else -1.0, ymax,
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
