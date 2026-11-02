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
		var ok2: bool = node.find_children("*", "MeshInstance3D", true, false).size() > 0 and absf(nb.get_longest_axis_size() - ob.get_longest_axis_size()) < ob.get_longest_axis_size() * 0.15
		if old and old.find_child("Muzzle", true, false):
			ok2 = ok2 and node.find_child("Muzzle", true, false) != null
		print(("✓ " if ok2 else "✗ ") + "Tripo: %s — длина %.2f м (старая %.2f м)" % [Data.weapon(id).get("name", id), nb.get_longest_axis_size(), ob.get_longest_axis_size()])
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
	return fail
