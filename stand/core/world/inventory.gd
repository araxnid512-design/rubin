class_name ULInventory
extends RefCounted
## Инвентарь героя: карманы (8 ячеек всегда), надетый рюкзак (его ячейки: малый +8, средний +12, большой +20),
## слоты снаряжения — основное оружие, второй слот (пистолет или мачете), рюкзак — и что в руках. Ячейка — предмет (словарь из ULItems)
## или null. Хранилища (ящик, брошенный рюкзак) — такие же массивы ячеек.

signal changed
signal swapped(text: String)          ## при оплате младшие ресурсы обменяны на старшие: «120 споранов → 12 горошин»

const POCKETS := 8

var pockets: Array = []
var pistol = null
var primary = null
var pack = null                   ## надетый рюкзак (предмет; его ячейки — pack.items)
var hand := ""                    ## что в руках: "", "pistol", "primary"
var wallet := {}                  ## ресурсы-валюта (спораны, горошины, жемчужины): id → сколько. Ячеек не занимают


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


## сортировка ячеек хранилища: одинаковые стопки сливаются, затем по виду (оружие, патроны, лекарства, еда,
## ресурсы, минералы, хлам) и названию; пустые — в конце
const SORT_ORDER := ["primary", "pistol", "melee", "pack", "ammo", "med", "food", "loot", "mineral", "parts", "tool", "tech", "junk", "quest"]


static func sort_cells(cells: Array) -> void:
	var merged: Array = []
	for it in cells:
		if it == null:
			continue
		var done := false
		if not it.has("items") and not it.has("mag") and not it.has("dur"):
			for m in merged:
				if String(m.id) == String(it.id) and int(m.n) < ULItems.stack(String(m.id)):
					var mv := mini(ULItems.stack(String(m.id)) - int(m.n), int(it.n))
					m.n = int(m.n) + mv
					it.n = int(it.n) - mv
					if int(it.n) <= 0:
						done = true
						break
		if not done:
			merged.append(it)
	merged.sort_custom(func(a, b) -> bool:
		var ka := SORT_ORDER.find(ULItems.kind(a))
		var kb := SORT_ORDER.find(ULItems.kind(b))
		ka = 99 if ka < 0 else ka
		kb = 99 if kb < 0 else kb
		if ka != kb:
			return ka < kb
		return ULItems.title(a) < ULItems.title(b))
	for i in cells.size():
		cells[i] = merged[i] if i < merged.size() else null


## положить в инвентарь (карманы, затем рюкзак); оружие — в пустой слот, если он свободен. Остаток — сколько
## не влезло (у предмета n уменьшается до остатка)
func add(it: Dictionary, to_slot := true) -> int:
	if ULItems.kind(it) == "loot":
		# ресурсы копятся в кошельке — сколько угодно, без ячеек
		wallet[String(it.id)] = int(wallet.get(String(it.id), 0)) + int(it.get("n", 1))
		it.n = 0
		changed.emit()
		return 0
	var sl := ULItems.slot_of(it)
	if to_slot and sl == "pistol" and pistol == null:
		pistol = it
		changed.emit()
		return 0
	if to_slot and sl == "primary" and primary == null:
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
func equip_from(arr: Array, i: int, to := "") -> bool:
	var it = arr[i]
	if it == null:
		return false
	# слот назван (мачете — в слот основного): только если предмет туда подходит
	var sl := to if to != "" and ULItems.fits(it, to) else ULItems.slot_of(it)
	if to != "" and sl != to:
		return false
	match sl:
		"pistol":
			arr[i] = pistol
			pistol = it
		"primary":
			arr[i] = primary
			primary = it
		"pack":
			if arr == cells("pack"):
				return false
			# вещи надетого рюкзака перекладываются в новый (не влезают — смены нет), старый пустой встаёт на его место
			if pack != null and not ULItems.pack_empty(pack) and not _pack_transfer(pack, it):
				return false
			arr[i] = pack
			pack = it
		_:
			return false
	changed.emit()
	return true


## переложить все вещи рюкзака src в рюкзак dst; не влезают — ничего не меняется (false)
func _pack_transfer(src: Dictionary, dst: Dictionary) -> bool:
	var tmp: Array = (dst.items as Array).duplicate(true)
	for c in src.items:
		if c != null and put(tmp, (c as Dictionary).duplicate(true)) > 0:
			return false
	dst.items = tmp
	for k in (src.items as Array).size():
		src.items[k] = null
	return true


## надеть новый рюкзак it (купленный, ещё не в ячейках): вещи старого — в новый, старый пустой — в карман или в
## новый рюкзак. {ok, drop}: drop — старый рюкзак, если ему не нашлось места (его кладут на землю)
func wear_pack(it: Dictionary) -> Dictionary:
	if pack == null:
		pack = it
		changed.emit()
		return {"ok": true, "drop": null}
	var old: Dictionary = pack
	if not _pack_transfer(old, it):
		return {"ok": false, "drop": null}
	pack = it
	var drop = null
	if put(pockets, old) > 0 and put(pack.items, old) > 0:
		drop = old
	changed.emit()
	return {"ok": true, "drop": drop}


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
	return {"pockets": pockets, "pistol": pistol, "primary": primary, "pack": pack, "hand": hand, "wallet": wallet}


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
	wallet = {}
	var w = d.get("wallet", {})
	if w is Dictionary:
		for k in w:
			if int(w[k]) > 0:
				wallet[String(k)] = int(w[k])
	# ресурсы, лежавшие в ячейках (сохранение до появления кошелька), — в кошелёк
	for arr in [pockets, cells("pack")]:
		for i in arr.size():
			if arr[i] != null and ULItems.kind(arr[i]) == "loot":
				wallet[String(arr[i].id)] = int(wallet.get(String(arr[i].id), 0)) + int(arr[i].n)
				arr[i] = null
	changed.emit()


## после JSON числа — float; привести n к int, ячейки рюкзака — к нужному размеру
static func _fix(it):
	if it == null or not (it is Dictionary) or not it.has("id"):
		return null
	it.n = int(it.get("n", 1))
	if it.has("mag"):
		it.mag = int(it.mag)
	if ULItems.get_def(String(it.id)).has("dur"):
		it["dur"] = int(it.get("dur", ULItems.get_def(String(it.id)).dur))     # оружие из старого сохранения — как новое
	if ULItems.kind(it) == "pack":
		var want := ULItems.pack_slots(it)
		var arr: Array = it.get("items", [])
		arr.resize(want)
		for i in arr.size():
			arr[i] = _fix(arr[i])
		it["items"] = arr
	return it


## сколько предметов id во всех ячейках
func count(id: String) -> int:
	var n := int(wallet.get(id, 0))
	for arr in [pockets, cells("pack")]:
		for c in arr:
			if c != null and String(c.id) == id:
				n += int(c.n)
	return n


## забрать до n штук id из ячеек; вернуть, сколько забрано
func consume(id: String, n: int) -> int:
	var got := mini(int(wallet.get(id, 0)), n)
	if got > 0:
		wallet[id] = int(wallet[id]) - got
	for arr in [cells("pack"), pockets]:
		for i in arr.size():
			var c = arr[i]
			if c != null and String(c.id) == id and got < n:
				var k := mini(int(c.n), n - got)
				c.n = int(c.n) - k
				got += k
				if int(c.n) <= 0:
					arr[i] = null
	if got > 0:
		changed.emit()
	return got


## хватает ли ресурсов на цену {id: сколько}
func can_pay(price: Dictionary) -> bool:
	return ULEconomy.missing(wallet, price).is_empty()


## Заплатить цену из кошелька; не хватает — ничего не списывается. Не хватает старшего ресурса (гороха,
## жемчуга), а младших достаточно — они обмениваются по курсу сами (ULEconomy.settle), о чём сообщает swapped.
func pay(price: Dictionary) -> bool:
	var s := ULEconomy.settle(wallet, price)
	if not (s.miss as Dictionary).is_empty():
		return false
	for id in s.wallet:
		if wallet.has(id) or int(s.wallet[id]) != 0:
			wallet[id] = int(s.wallet[id])
	changed.emit()
	if not (s.swap as Array).is_empty():
		ULEconomy.last_swap = ULEconomy.swap_text(s.swap)
		swapped.emit(ULEconomy.last_swap)
	return true


## лучшее лечение из того, что есть: аптечка при большой потере, иначе бинт; затем еда. Вернуть id или ""
func best_heal(missing: int) -> String:
	var order := ["medkit", "bandage"] if missing >= 40 else ["bandage", "medkit"]
	for id in order + ["can", "rusk"]:
		if count(id) > 0:
			return id
	return ""
