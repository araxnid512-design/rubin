class_name ULGifts
extends RefCounted
## Дары героя. Дар пробуждается и растёт от съеденной жемчужины (окно персонажа — кнопка «три точки» у имени):
## чёрная — одна ступень, красная — две, белая — три. Ступень — новый случайный дар на 1-м уровне (пока даров меньше
## max) или +1 уровень случайному уже пробуждённому. Даров не больше max, уровней — до max_lv. Числа и описания —
## data/gifts.json. Дары — свойство героя: хранятся в профиле, не теряются при гибели.
##
## Что делает каждый дар (подключено в world.gd и enemy.gd):
##   sense — Чуйка: красные метки над врагами рядом, которых герой не видит (за стеной, на другом этаже);
##   swift — Скороход: скорость героя ×k;  regen — Живучесть: здоровье само прибывает, если 6 с не били;
##   quiet — Тихий шаг: дальность, с которой заражённые слышат шаги и бег, ×k (ULEnemy.hear_k);
##   skin — Крепкая кожа: урон по герою ×k;  luck — Фарт: спораны в телах ×k, шанс гороха ×k (ULEnemy.luck_k).

const CFG := "res://data/gifts.json"
static var D: Dictionary = _load()
static var owned := {}             ## дар → уровень (1…max_lv)


static func _load() -> Dictionary:
	var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
	return d if d is Dictionary else {"max": 3, "max_lv": 3, "pearls": {}, "gifts": {}}


static func ids() -> Array:
	return (D.gifts as Dictionary).keys()


static func name_of(id: String) -> String:
	return String(D.gifts[id].n)


static func desc(id: String) -> String:
	return String(D.gifts[id].d)


static func level(id: String) -> int:
	return int(owned.get(id, 0))


static func max_lv() -> int:
	return int(D.get("max_lv", 3))


static func max_n() -> int:
	return int(D.get("max", 3))


## число дара на его нынешнем уровне (нет дара — base)
static func val(id: String, key: String, base: float) -> float:
	var lv := level(id)
	if lv <= 0 or not D.gifts.has(id):
		return base
	var arr: Array = D.gifts[id].lv
	return float((arr[clampi(lv, 1, arr.size()) - 1] as Dictionary).get(key, base))


## что даёт дар на уровне lv (строка из data/gifts.json)
static func effect(id: String, lv: int) -> String:
	var arr: Array = D.gifts[id].lv
	return String((arr[clampi(lv, 1, arr.size()) - 1] as Dictionary).get("t", ""))


## сколько ступеней даёт жемчужина (0 — это не жемчужина)
static func steps(pearl: String) -> int:
	return int((D.get("pearls", {}) as Dictionary).get(pearl, 0))


## можно ли ещё расти: есть место под новый дар или не на пределе хотя бы один пробуждённый
static func can_grow() -> bool:
	if owned.size() < max_n():
		return true
	for id in owned:
		if int(owned[id]) < max_lv():
			return true
	return false


## одна ступень: новый дар (пока их меньше max) или +1 уровень случайному непредельному. → [дар, был, стал] или []
static func grow(rng: RandomNumberGenerator) -> Array:
	var fresh: Array = []
	for id in ids():
		if not owned.has(id):
			fresh.append(id)
	if owned.size() < max_n() and not fresh.is_empty():
		var id: String = fresh[rng.randi() % fresh.size()]
		owned[id] = 1
		return [id, 0, 1]
	var up: Array = []
	for id in owned:
		if int(owned[id]) < max_lv():
			up.append(id)
	if up.is_empty():
		return []
	var u: String = up[rng.randi() % up.size()]
	owned[u] = int(owned[u]) + 1
	return [u, int(owned[u]) - 1, int(owned[u])]


## съесть жемчужину: все её ступени по очереди → список изменений [[дар, был, стал], …]
static func eat(pearl: String, rng: RandomNumberGenerator) -> Array:
	var out: Array = []
	for i in steps(pearl):
		var g := grow(rng)
		if g.is_empty():
			break
		out.append(g)
	return out


static func to_save() -> Dictionary:
	return owned.duplicate()


static func from_save(d) -> void:
	owned = {}
	if d is Dictionary:
		for id in d:
			if D.gifts.has(String(id)):
				owned[String(id)] = clampi(int(d[id]), 1, max_lv())
