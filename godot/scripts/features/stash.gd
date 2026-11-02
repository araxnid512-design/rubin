extends Node
## Хранилище в твоей комнате в стабе (как game/stash.js): станция «stash». Сюда складывают оружие (с износом) и
## расходники — живчики, гранаты, ремкомплекты; по одному или всё разом. При гибели сложенное цело, а всё, что
## было с собой, пропадает (main.gd, respawn_in_stab). Валюту (спораны, горох, жемчуг) класть не нужно: она и так
## остаётся при герое. Хранилище — в сохранении игры (save_data/load_data).

const CURRENCY := ["spore", "peas", "pearl"]
const PAGE := 6

var game: Node
## bag — расходники по видам, guns — оружие: id → износ.
var stash := {"bag": {}, "guns": {}}


func setup(g: Node) -> void:
	game = g


func save_data() -> Dictionary:
	return stash.duplicate(true)


func load_data(d: Dictionary) -> void:
	stash = {"bag": {}, "guns": {}}
	var b = d.get("bag", {})
	if b is Dictionary:
		for k in b:
			if int(b[k]) > 0 and not CURRENCY.has(k):
				stash["bag"][k] = int(b[k])
	var gs = d.get("guns", {})
	if gs is Dictionary:
		for id in gs:
			if id != "fists" and not Data.weapon(id).is_empty():
				stash["guns"][id] = int(gs[id])


func interact(s: Dictionary) -> bool:
	if s.get("id", "") != "stash":
		return false
	open()
	return true


func _owned() -> Array:
	if not game.kit.has("owned") or typeof(game.kit["owned"]) != TYPE_ARRAY:
		game.kit["owned"] = []
	return game.kit["owned"]


## Оружие с собой: в слотах (кроме кулаков) и в рюкзаке.
func carried() -> Array:
	var out := []
	for slot in ["melee", "gun"]:
		var id: String = game.kit.get(slot, "")
		if id != "" and id != "fists":
			out.append(id)
	for id in _owned():
		if not out.has(id):
			out.append(id)
	return out


## Расходники с собой, которые можно сложить (всё, кроме валюты).
func storable() -> Array:
	var out := []
	for k in game.bag:
		if not CURRENCY.has(k) and int(game.bag[k]) > 0:
			out.append(k)
	return out


func _wear(id: String, value: int) -> String:
	var w := Data.weapon(id)
	return "износ %d/%d" % [value, int(w["durability"])] if w.has("durability") else ""


func _carried_wear(id: String) -> int:
	if game.player != null:
		return int(game.player.wear_of(id))
	return int(game.wear.get(id, Data.weapon(id).get("durability", 0)))


## С собой — в хранилище: ствол (с износом) или все расходники этого вида.
func store(kind: String) -> bool:
	var kit: Dictionary = game.kit
	var w := Data.weapon(kind)
	if not w.is_empty():
		if not carried().has(kind):
			return false
		stash["guns"][kind] = _carried_wear(kind)
		_owned().erase(kind)
		game.wear.erase(kind)
		var slot: String = w.get("slot", "gun")
		if kit.get(slot, "") == kind:
			kit[slot] = "fists" if slot == "melee" else ""
			# на место — запасное того же слота из рюкзака
			for id in _owned():
				if Data.weapon(id).get("slot", "") == slot:
					_owned().erase(id)
					kit[slot] = id
					break
		var p = game.player
		if p != null:
			if p.hold == "gun" and kit.get("gun", "") == "":
				p.hold = "melee"
			p.attach_gear()
	elif not CURRENCY.has(kind) and int(game.bag.get(kind, 0)) > 0:
		stash["bag"][kind] = int(stash["bag"].get(kind, 0)) + int(game.bag[kind])
		game.bag[kind] = 0
	else:
		return false
	game.hud_refresh()
	game.save()
	return true


## Из хранилища — с собой: ствол — в пустой слот, иначе в рюкзак; расходники — все разом.
func take_out(kind: String) -> bool:
	var kit: Dictionary = game.kit
	if stash["guns"].has(kind):
		if carried().has(kind):
			game.toast("%s уже с собой — сначала положи свой" % Data.item_name(kind))
			return false
		var slot: String = Data.weapon(kind).get("slot", "gun")
		game.wear[kind] = int(stash["guns"][kind])
		stash["guns"].erase(kind)
		var cur: String = kit.get(slot, "")
		if cur == "" or cur == "fists":
			kit[slot] = kind
			if game.player != null:
				game.player.attach_gear()
		else:
			_owned().append(kind)
	elif int(stash["bag"].get(kind, 0)) > 0:
		game.bag[kind] = int(game.bag.get(kind, 0)) + int(stash["bag"][kind])
		stash["bag"].erase(kind)
	else:
		return false
	game.hud_refresh()
	game.save()
	return true


func store_all() -> void:
	for id in carried():
		store(id)
	for k in storable():
		store(k)


func take_all() -> void:
	for id in stash["guns"].keys():
		take_out(id)
	for k in stash["bag"].keys():
		take_out(k)


# ---------- Окно ----------


func _mine_rows() -> Array:
	var rows := []
	for id in carried():
		var where := "в рюкзаке" if _owned().has(id) else "в слоте"
		var t := _wear(id, _carried_wear(id))
		rows.append(["→ %s · %s%s" % [Data.item_name(id), where, (" · " + t) if t != "" else ""], id])
	for k in storable():
		rows.append(["→ %s ×%d" % [Data.item_name(k), int(game.bag[k])], k])
	return rows


func _kept_rows() -> Array:
	var rows := []
	for id in stash["guns"]:
		var t := _wear(id, int(stash["guns"][id]))
		rows.append(["← %s%s" % [Data.item_name(id), (" · " + t) if t != "" else ""], id])
	for k in stash["bag"]:
		rows.append(["← %s ×%d" % [Data.item_name(k), int(stash["bag"][k])], k])
	return rows


func _names(rows: Array) -> String:
	var out := []
	for r in rows:
		out.append(str(r[0]).substr(2))
	return ", ".join(out) if not out.is_empty() else "ничего"


func open() -> void:
	var mine := _mine_rows()
	var kept := _kept_rows()
	var text := "С собой: %s.\nВ хранилище: %s.\nПри гибели сложенное здесь цело, а всё, что с собой, пропадает. Спораны %d · горох %d · жемчуг %d — валюта и так остаётся при тебе." % [_names(mine), _names(kept), game.bag.get("spore", 0), game.bag.get("peas", 0), game.bag.get("pearl", 0)]
	var acts := []
	acts.append(["Всё в хранилище →", _all.bind(true), not mine.is_empty()])
	acts.append(["← Забрать всё", _all.bind(false), not kept.is_empty()])
	acts.append(["Положить по одному…", _list.bind(true, 0), not mine.is_empty()])
	acts.append(["Забрать по одному…", _list.bind(false, 0), not kept.is_empty()])
	acts.append(["Закрыть", Callable(game.hud, "hide_panel")])
	game.hud.show_panel("Хранилище", text, acts)


func _all(put: bool) -> void:
	if put:
		store_all()
	else:
		take_all()
	open()


## Постраничный список: put — что положить (с собой), иначе — что забрать (из хранилища).
func _list(put: bool, page: int) -> void:
	var rows := _mine_rows() if put else _kept_rows()
	if rows.is_empty():
		open()
		return
	var pages := int(ceil(rows.size() / float(PAGE)))
	page = clampi(page, 0, pages - 1)
	var acts := []
	for i in range(page * PAGE, mini(rows.size(), page * PAGE + PAGE)):
		acts.append([rows[i][0], _pick.bind(put, str(rows[i][1]), page)])
	if pages > 1:
		acts.append(["Дальше › (%d / %d)" % [page + 1, pages], _list.bind(put, (page + 1) % pages)])
	acts.append(["‹ Назад", open])
	game.hud.show_panel("Хранилище: положить" if put else "Хранилище: забрать", "", acts)


func _pick(put: bool, kind: String, page: int) -> void:
	if put:
		store(kind)
	else:
		take_out(kind)
	_list(put, page)


# ---------- Автотест ----------


func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1


func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout


func smoke() -> int:
	var fail := 0
	if game.loc != "stab":
		game.enter("stab", null)
		await _wait(0.3)
	var p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	var kit: Dictionary = game.kit
	kit["gun"] = "pistol"
	game.wear["pistol"] = 300
	kit["owned"] = []
	p.attach_gear()
	game.take("ak47", 1)
	game.wear["ak47"] = 555
	game.bag["zhivchik"] = 2
	game.bag["grenade"] = 1
	fail += _check(interact({"id": "stash", "name": "Хранилище"}) and game.hud.panel.visible, "хранилище открывается в комнате")
	_list(true, 0)
	fail += _check(game.hud.panel.visible, "список «положить по одному»")
	game.hud.hide_panel()
	store("ak47")
	store("zhivchik")
	fail += _check(int(stash["guns"].get("ak47", -1)) == 555 and int(stash["bag"].get("zhivchik", 0)) == 2 and not _owned().has("ak47") and int(game.bag.get("zhivchik", 0)) == 0, "положил АК-47 (износ 555) и 2 живчика")
	store("pistol")
	fail += _check(kit.get("gun", "") == "" and stash["guns"].has("pistol") and p.hold == "melee", "ПМ из слота — в хранилище, в руках %s" % Data.item_name(p.weapon_id()))
	game.bag["spore"] = int(game.bag.get("spore", 0)) + 7
	var sp := int(game.bag["spore"])
	# гибель: рюкзак пропадает, хранилище цело
	game.respawn_in_stab()
	await _wait(0.3)
	p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	fail += _check(stash["guns"].has("ak47") and stash["guns"].has("pistol") and int(stash["bag"].get("zhivchik", 0)) == 2, "после гибели в хранилище всё цело: %s" % _names(_kept_rows()))
	fail += _check(int(game.bag.get("grenade", 0)) == 0 and _owned().is_empty() and int(game.bag.get("spore", 0)) == sp, "граната с собой пропала, спораны при себе (%d)" % sp)
	take_out("ak47")
	fail += _check(game.kit.get("gun", "") == "ak47" and int(p.wear_of("ak47")) == 555, "АК-47 из хранилища — в слоте, износ %d" % int(p.wear_of("ak47")))
	take_out("zhivchik")
	fail += _check(int(game.bag.get("zhivchik", 0)) == 2 and not stash["bag"].has("zhivchik"), "живчики забраны")
	return fail
