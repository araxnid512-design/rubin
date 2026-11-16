class_name ULInventory
extends RefCounted
## Инвентарь героя: карманы (8 ячеек всегда), надетый рюкзак (его ячейки: малый +8, средний +12, большой +20),
## слоты снаряжения — пистолет, основное оружие, рюкзак — и что в руках. Ячейка — предмет (словарь из ULItems)
## или null. Хранилища (ящик, брошенный рюкзак) — такие же массивы ячеек.

signal changed

const POCKETS := 8

var pockets: Array = []
var pistol = null
var primary = null
var pack = null                   ## надетый рюкзак (предмет; его ячейки — pack.items)
var hand := ""                    ## что в руках: "", "pistol", "primary"


func _init() -> void:
	pockets.resize(POCKETS)


## ячейки по имени: pockets — карманы, pack — надетый рюкзак
func cells(src: String) -> Array:
	if src == "pockets":
		return pockets
	if src == "pack" and pack != null:
		return pack.items
	return []


func slot_count() -> int:
	return POCKETS + ULItems.pack_slots(pack)


func used() -> int:
	var n := 0
	for c in pockets:
		if c != null:
			n += 1
	if pack != null:
		for c in pack.items:
			if c != null:
				n += 1
	return n


## положить в массив ячеек: сначала досыпать в такие же, потом в пустую ячейку; вернуть остаток (0 — всё влезло)
static func put(arr: Array, it: Dictionary) -> int:
	var left := int(it.get("n", 1))
	var mx := ULItems.stack(String(it.id))
	if mx > 1:
		for c in arr:
			if c != null and String(c.id) == String(it.id) and int(c.n) < mx:
				var k := mini(mx - int(c.n), left)
				c.n = int(c.n) + k
				left -= k
				if left <= 0:
					return 0
	for i in arr.size():
		if arr[i] == null:
			var cp := it.duplicate(true)
			cp.n = left
			arr[i] = cp
			return 0
	return left


## положить в инвентарь (карманы, затем рюкзак); оружие — в пустой слот, если он свободен. Остаток — сколько
## не влезло (у предмета n уменьшается до остатка)
func add(it: Dictionary, to_slot := true) -> int:
	var k := ULItems.kind(it)
	if to_slot and k == "pistol" and pistol == null:
		pistol = it
		changed.emit()
		return 0
	if to_slot and k == "primary" and primary == null:
		primary = it
		changed.emit()
		return 0
	var left := put(pockets, it)
	if left > 0 and pack != null:
		var rest := it.duplicate(true)
		rest.n = left
		left = put(pack.items, rest)
	it.n = left
	changed.emit()
	return left


## взять предмет из ячейки (ячейка освобождается)
static func take(arr: Array, i: int):
	var it = arr[i]
	arr[i] = null
	return it


## оружие или рюкзак из ячейки — в свой слот; что было в слоте — на его место
func equip_from(arr: Array, i: int) -> bool:
	var it = arr[i]
	if it == null:
		return false
	match ULItems.kind(it):
		"pistol":
			arr[i] = pistol
			pistol = it
		"primary":
			arr[i] = primary
			primary = it
		"pack":
			if pack != null and not ULItems.pack_empty(pack):
				return false                 # полный рюкзак в ячейку не положить — сначала снять его на землю
			if arr == cells("pack"):
				return false
			arr[i] = pack
			pack = it
		_:
			return false
	changed.emit()
	return true


## снять из слота в инвентарь (если есть место); рюкзак — только пустой
func unequip(slot: String) -> bool:
	var it = get(slot)
	if it == null:
		return false
	if slot == "pack" and not ULItems.pack_empty(it):
		return false
	set(slot, null)
	var left := put(pockets, it)
	if left > 0 and pack != null:
		left = put(pack.items, it)
	if left > 0:
		set(slot, it)
		return false
	if hand == slot:
		hand = ""
	changed.emit()
	return true


## убрать предмет из слота совсем (для выброса); вернуть его
func clear_slot(slot: String):
	var it = get(slot)
	set(slot, null)
	if hand == slot:
		hand = ""
	changed.emit()
	return it


func to_dict() -> Dictionary:
	return {"pockets": pockets, "pistol": pistol, "primary": primary, "pack": pack, "hand": hand}


func from_dict(d: Dictionary) -> void:
	var p: Array = d.get("pockets", [])
	pockets.clear()
	pockets.resize(POCKETS)
	for i in mini(p.size(), POCKETS):
		pockets[i] = _fix(p[i])
	pistol = _fix(d.get("pistol"))
	primary = _fix(d.get("primary"))
	pack = _fix(d.get("pack"))
	hand = String(d.get("hand", ""))
	changed.emit()


## после JSON числа — float; привести n к int, ячейки рюкзака — к нужному размеру
static func _fix(it):
	if it == null or not (it is Dictionary) or not it.has("id"):
		return null
	it.n = int(it.get("n", 1))
	if ULItems.kind(it) == "pack":
		var want := ULItems.pack_slots(it)
		var arr: Array = it.get("items", [])
		arr.resize(want)
		for i in arr.size():
			arr[i] = _fix(arr[i])
		it["items"] = arr
	return it
