class_name Data
## Данные игры: оружие (характеристики — из браузерной игры, assets/weapons/weapons.json), заражённые,
## карта Улья, предметы. В Godot-версии у огнестрела нет патронов: каждый ствол изнашивается выстрелами
## (durability — сколько выстрелов выдержит) и чинится у торговца; топоры — как прежде, ударами.

## Выстрелов до поломки у огнестрела.
const GUN_DURABILITY := {
	"aks": 700, "ak74": 900, "ak47": 800, "svd": 300, "fnfal": 800, "aug": 900, "spas12": 300,
	"glock17": 450, "deagle": 260, "dbarrel": 220, "ak107": 950, "rpk": 1000, "pkt": 1300, "awm": 250, "g36": 850, "mp5": 650,
}

## Новые стволы (из пакета «СТИКС»). model — id модели: свои, из game/weapons.js (makeScar, makeFal, makeAug, makePm63,
## makeSpas12), выгружает scripts/export-godot.mjs в assets/weapons/<id>.glb.
const NEW_WEAPONS := {
	"fnfal": {"name": "FN FAL", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 46, "range": 9.0, "cooldown": 0.13, "auto": 0.13, "noise": 40, "spread": 0.05, "flash": 1.1, "price": 240, "model": "fnfal", "desc": "Боевая винтовка 7,62×51 с деревянным прикладом: бьёт сильно, уводит в очереди."},
	"aug": {"name": "Steyr AUG", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 32, "range": 8.5, "cooldown": 0.09, "auto": 0.09, "noise": 34, "spread": 0.03, "flash": 0.9, "price": 220, "model": "aug", "desc": "Автомат-буллпап 5,56: короткий, точный, магазин за рукоятью."},
	"spas12": {"name": "SPAS-12", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 15, "pellets": 9, "range": 5.0, "cooldown": 0.45, "auto": 0.5, "noise": 36, "spread": 0.22, "flash": 1.4, "price": 200, "model": "spas12", "desc": "Боевой дробовик 12 калибра: картечь веером, полуавтомат."},
	# стволы с листа пользователя (модели Tripo по картинкам — docs/tripo/refs/weapons)
	"glock17": {"name": "Glock 17", "slot": "gun", "anim": "pistol", "mount": "holster", "damage": 24, "range": 6.5, "cooldown": 0.12, "auto": 0.2, "noise": 26, "spread": 0.03, "flash": 0.8, "price": 60, "mag": 17, "model": "glock17", "desc": "Пистолет 9×19: лёгкий, магазин на 17 патронов."},
	"deagle": {"name": "Desert Eagle", "slot": "gun", "anim": "pistol", "mount": "holster", "damage": 55, "range": 7.0, "cooldown": 0.4, "auto": 0.5, "noise": 34, "spread": 0.04, "flash": 1.2, "price": 140, "mag": 7, "model": "deagle", "desc": "Тяжёлый пистолет .50 AE: валит с пары выстрелов, сильно подбрасывает."},
	"dbarrel": {"name": "Двустволка", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 17, "pellets": 9, "range": 5.0, "cooldown": 0.35, "auto": 0.6, "noise": 36, "spread": 0.26, "flash": 1.6, "price": 50, "mag": 2, "model": "dbarrel", "desc": "Охотничья двустволка 12 калибра: два быстрых выстрела картечью."},
	"ak107": {"name": "АК-107", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 33, "range": 8.5, "cooldown": 0.09, "auto": 0.09, "noise": 36, "spread": 0.025, "flash": 0.9, "price": 180, "mag": 30, "model": "ak107", "desc": "Автомат 5,45 со сбалансированной автоматикой: почти не уводит в очереди."},
	"rpk": {"name": "РПК", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 36, "range": 9.0, "cooldown": 0.1, "auto": 0.1, "noise": 42, "spread": 0.05, "flash": 1.1, "price": 200, "mag": 75, "model": "rpk", "desc": "Ручной пулемёт Калашникова 7,62×39: длинный ствол, сошки, барабан на 75."},
	"pkt": {"name": "ПКТ", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 42, "range": 9.5, "cooldown": 0.085, "auto": 0.085, "noise": 50, "spread": 0.08, "flash": 1.4, "price": 260, "mag": 100, "model": "pkt", "mounted": true, "desc": "Танковый пулемёт 7,62×54R — для установки на технику; в руки не берётся (ждёт отдельного решения: станок или машина)."},
	"awm": {"name": "Arctic Warfare", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 160, "range": 20.0, "cooldown": 1.3, "auto": 1.4, "noise": 46, "spread": 0.0, "flash": 1.2, "price": 300, "mag": 5, "falloff": 0.06, "model": "awm", "desc": "Снайперская винтовка с продольно-скользящим затвором: самый дальний и сильный выстрел."},
	"g36": {"name": "HK G36", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 30, "range": 8.5, "cooldown": 0.085, "auto": 0.085, "noise": 34, "spread": 0.03, "flash": 0.9, "price": 210, "mag": 30, "model": "g36", "desc": "Автомат 5,56 с ручкой-прицелом: лёгкий и точный."},
	"mp5": {"name": "HK MP5", "slot": "gun", "anim": "rifle", "mount": "back", "damage": 20, "range": 6.5, "cooldown": 0.07, "auto": 0.07, "noise": 24, "spread": 0.045, "flash": 0.6, "price": 110, "mag": 30, "model": "mp5", "desc": "Пистолет-пулемёт 9×19: быстрый огонь, тихий."},
}

## Заражённые (как в браузерной игре): hp, скорость, урон, дальность удара, момент удара в клипе.
const ENEMY := {
	"runner": {"hp": 60.0, "speed": 3.4, "scale": 1.0, "radius": 0.36, "damage": 8.0, "range": 1.25, "hit_time": 0.72, "move": "Run", "sight": 14.0, "armor": 0.0, "spores": [1, 1], "rig": "runner", "tripo": "z_pustysh"},
	# лотерейщик — между бегуном и топтуном (решение пользователя): крепче и сильнее бегуна, чуть медленнее, клипы бегуна
	"lottery": {"hp": 120.0, "speed": 2.9, "scale": 1.0, "radius": 0.42, "damage": 14.0, "range": 1.35, "hit_time": 0.75, "move": "Run", "sight": 14.0, "armor": 2.0, "spores": [1, 2], "rig": "runner", "tripo": "z_lottery"},
	"stomper": {"hp": 220.0, "speed": 2.0, "scale": 1.08, "radius": 0.5, "damage": 22.0, "range": 1.55, "hit_time": 0.85, "move": "Stomp", "sight": 14.0, "armor": 0.0, "spores": [2, 3], "rig": "stomper", "tripo": "z_stomper"},
	"ruber": {"hp": 520.0, "speed": 2.6, "charge": 6.4, "scale": 1.12, "radius": 0.58, "damage": 34.0, "range": 2.0, "hit_time": 0.5, "move": "Walk", "sight": 18.0, "armor": 8.0, "spores": [3, 5], "rig": "ruber", "tripo": "z_ruber"},
}

## Карта Улья (как в game/world.js).
const NODES := {
	"stab": {"name": "Стаб «Полис»", "short": "Полис", "kind": "stab", "danger": 0},
	"zarechny": {"name": "Кластер «Заречный»", "short": "Заречный", "kind": "cluster", "danger": 1},
	"dachi": {"name": "Кластер «Дачи»", "short": "Дачи", "kind": "cluster", "danger": 1},
	"himmash": {"name": "Кластер «Химмаш»", "short": "Химмаш", "kind": "cluster", "danger": 2},
	"voench": {"name": "Кластер «Военная часть»", "short": "В/ч", "kind": "cluster", "danger": 3},
	"murs": {"name": "Стаб муров «Карьер»", "short": "Карьер", "kind": "murs", "danger": 3},
}
const ROUTES := [
	["stab", "zarechny", 75], ["stab", "dachi", 95], ["zarechny", "dachi", 60], ["dachi", "himmash", 85],
	["zarechny", "himmash", 80], ["himmash", "voench", 90], ["murs", "dachi", 100], ["murs", "himmash", 90],
]
## Жизнь кластера между перезагрузками, с.
const CYCLE := [600.0, 720.0]
## Последняя минута — кислый запах.
const WARN := 60.0

const ITEMS := {
	"spore": {"name": "Споран", "forms": ["споран", "спорана", "споранов"]},
	"peas": {"name": "Горох", "forms": ["горошина", "горошины", "горошин"]},
	"pearl": {"name": "Чёрная жемчужина", "forms": ["жемчужина", "жемчужины", "жемчужин"]},
	"zhivchik": {"name": "Живчик", "forms": ["живчик", "живчика", "живчиков"]},
	"grenade": {"name": "Граната Ф-1", "forms": ["граната", "гранаты", "гранат"]},
	"repair": {"name": "Ремкомплект", "forms": ["ремкомплект", "ремкомплекта", "ремкомплектов"]},
}

static var WEAPONS := {}

## Убранное оружие → чем оно становится в старых сохранениях.
const REMOVED := {"axe": "fireaxe", "pistol": "glock17", "pm63": "glock17", "vector": "mp5", "obrez": "dbarrel",
	"shotgun": "spas12", "scar": "fnfal", "vss": "svd", "pkm": "rpk"}

## Настоящий id оружия (у псевдонима убранного — id нового).
static func real_id(id: String) -> String:
	return str(REMOVED.get(id, id))

## Загрузить каталог оружия: выгруженные характеристики + новые стволы + износ огнестрела.
static func load_all() -> void:
	if not WEAPONS.is_empty():
		return
	var text := FileAccess.get_file_as_string("res://assets/weapons/weapons.json")
	var parsed = JSON.parse_string(text)
	if typeof(parsed) == TYPE_DICTIONARY:
		WEAPONS = parsed
	for id in NEW_WEAPONS:
		WEAPONS[id] = NEW_WEAPONS[id].duplicate()
	for id in WEAPONS:
		var w: Dictionary = WEAPONS[id]
		w["id"] = id
		if not w.has("model"):
			w["model"] = id
		if w.get("slot", "") == "gun":
			w["durability"] = GUN_DURABILITY.get(id, 500)
	# убранное оружие (просьбы пользователя: только пожарный топор; только 16 стволов с его листа): в старых
	# сохранениях, хранилище и на земле оно становится ближайшим новым — запись-псевдоним (alias) с данными и моделью
	# нового; в перечнях оружия (лавка, проверки, листы) псевдонимы пропускаются
	for old in REMOVED:
		var to: String = REMOVED[old]
		if WEAPONS.has(to):
			var a: Dictionary = (WEAPONS[to] as Dictionary).duplicate()
			a["id"] = old
			a["alias"] = to
			WEAPONS[old] = a

static func weapon(id: String) -> Dictionary:
	load_all()
	return WEAPONS.get(id, {})

static func routes_from(id: String) -> Array:
	var out := []
	for r in ROUTES:
		if r[0] == id:
			out.append({"to": r[1], "time": r[2]})
		elif r[1] == id:
			out.append({"to": r[0], "time": r[2]})
	return out

static func travel_time(a: String, b: String) -> float:
	for r in routes_from(a):
		if r["to"] == b:
			return float(r["time"])
	return 90.0

## «3 спорана», «5 споранов».
static func plural(n: int, forms: Array) -> String:
	var a: int = absi(n) % 100
	var b: int = a % 10
	if a > 10 and a < 20:
		return forms[2]
	if b == 1:
		return forms[0]
	if b >= 2 and b <= 4:
		return forms[1]
	return forms[2]

static func item_name(kind: String) -> String:
	if ITEMS.has(kind):
		return ITEMS[kind]["name"]
	var w := weapon(kind)
	return w.get("name", kind)

## Что лежит в тайнике: спецификация из локации ({вид: вероятность} или {вид: [от, до, вероятность]}).
## Патронов в Godot-версии нет — вместо них немного споранов, изредка ремкомплект.
static func roll_loot(spec: Dictionary) -> Array:
	var out := []
	for kind in spec:
		var v = spec[kind]
		var n := 0
		if typeof(v) == TYPE_ARRAY:
			if randf() < float(v[2]):
				n = int(v[0]) + randi() % (int(v[1]) - int(v[0]) + 1)
		elif randf() < float(v):
			n = 1
		if n <= 0:
			continue
		var k: String = kind
		if k.begins_with("ammo"):
			if randf() < 0.15:
				out.append(["repair", 1])
			else:
				out.append(["spore", maxi(1, n / 6)])
			continue
		out.append([k, n])
	return out
