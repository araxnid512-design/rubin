class_name ULCrates
extends RefCounted
## Ящики с добычей: обмен карт доступа Внешников на ящики у трёх терминалов главного здания Базы
## (data/crates.json — названия, цены в картах и состав по картинкам пользователя 26.11; числа — предложение).
## Здесь только правила: какой ящик у какого терминала, хватает ли карт, что лежит в собранном ящике.
## Окно «Сборка ящиков», оставшаяся в ящике добыча и её сохранение — world.gd (open_crate_ui, crate_build).

const PATH := "res://data/crates.json"
static var _cfg := {}


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		_cfg = d if d is Dictionary else {}
	return _cfg


static func list() -> Array:
	return cfg().get("crates", [])


static func by_terminal(n: int) -> Dictionary:
	for c in list():
		if int(c.get("terminal", 0)) == n:
			return c
	return {}


static func by_id(id: String) -> Dictionary:
	for c in list():
		if String(c.get("id", "")) == id:
			return c
	return {}


## оружие тира n (1 — простое, 2 — боевое, 3 — редкое: только из ящика заражённого)
static func tier(n: int) -> Array:
	return (cfg().get("tiers", {}) as Dictionary).get(str(n), [])


## в каком тире оружие (0 — ни в каком)
static func tier_of(id: String) -> int:
	for k in cfg().get("tiers", {}):
		if ((cfg().tiers as Dictionary)[k] as Array).has(id):
			return int(k)
	return 0


static func can_build(inv: ULInventory, c: Dictionary) -> bool:
	return not c.is_empty() and inv.count(String(c.card)) >= int(c.cost)


## содержимое собранного ящика — список предметов (ещё не по ячейкам); seed_n — зерно случайности
static func roll(c: Dictionary, seed_n: int) -> Array:
	var r := RandomNumberGenerator.new()
	r.seed = seed_n
	var out: Array = []
	var cond: Array = c.get("condition", [0.6, 1.0])
	var mags: Array = c.get("ammo_mags", [2, 3])
	var ammo := {}
	for w in c.get("weapons", []):
		var pool: Array = tier(int(w[0])).duplicate()
		for k in int(w[1]):
			if pool.is_empty():
				pool = tier(int(w[0])).duplicate()
			if pool.is_empty():
				break
			var id := String(pool[r.randi() % pool.size()])
			pool.erase(id)                       # в одном ящике стволы одного тира не повторяются
			var d := ULItems.get_def(id)
			var it := ULItems.make(id)
			if it.has("dur"):
				it["dur"] = maxi(1, int(round(float(d.dur) * r.randf_range(float(cond[0]), float(cond[1])))))
			out.append(it)
			if d.has("ammo"):
				var n := int(d.get("mag", 1)) * r.randi_range(int(mags[0]), int(mags[1]))
				ammo[String(d.ammo)] = mini(int(ammo.get(String(d.ammo), 0)) + n, int(c.get("ammo_max", 150)))
	for a in ammo:
		out.append(ULItems.make(String(a), int(ammo[a])))
	for key in ["med", "parts"]:
		for l in c.get(key, []):
			if r.randf() <= float(l[3]):
				var n2 := r.randi_range(int(l[1]), int(l[2]))
				if n2 > 0:
					out.append(ULItems.make(String(l[0]), n2))
	var rnd: Dictionary = c.get("random", {})
	var tb: Array = rnd.get("table", [])
	if not tb.is_empty():
		var sum := 0.0
		for l in tb:
			sum += float(l[3])
		var rolls: Array = rnd.get("rolls", [1, 2])
		for k in r.randi_range(int(rolls[0]), int(rolls[1])):
			var x := r.randf() * sum
			var pick: Array = tb[0]
			for l in tb:
				x -= float(l[3])
				if x <= 0.0:
					pick = l
					break
			out.append(ULItems.make(String(pick[0]), r.randi_range(int(pick[1]), int(pick[2]))))
	return out


## предметы — по ячейкам ящика (стопки не больше положенного; одинаковое сливается)
static func to_cells(items: Array) -> Array:
	var cells: Array = []
	cells.resize(int(cfg().get("cells", 24)))
	for it in items:
		var left := int(it.get("n", 1))
		var st := maxi(ULItems.stack(String(it.id)), 1)
		while left > 0:
			var part: Dictionary = (it as Dictionary).duplicate(true)
			part["n"] = mini(left, st)
			left -= int(part.n)
			if ULInventory.put(cells, part) > 0:
				cells.append(part)               # не поместилось — ячейка сверх положенного: добыча не теряется
	return cells


## Собрать ящик: карты списываются, возвращаются ячейки с добычей; не хватает карт — пустой массив, ничего не списано
static func build(inv: ULInventory, c: Dictionary, seed_n: int) -> Array:
	if not can_build(inv, c):
		return []
	inv.consume(String(c.card), int(c.cost))
	return to_cells(roll(c, seed_n))
