extends Node
## Рюкзак (как game/inventory.js браузерной игры): кнопка «Рюкзак» (или I) открывает окно — здоровье, оружие
## в слотах, расходники и запасное оружие. Живчик — выпить (+45), чёрная жемчужина — съесть (здоровье навсегда
## +20, до 200), ремкомплект — починить оружие в руках на половину износа, граната — бросить.
## Запасное оружие лежит в рюкзаке (game.kit["owned"] — сверх того, что в слотах): любое ставится в свой слот,
## прежнее уходит в рюкзак; сломался ствол в слоте — на его место встаёт запасной из рюкзака. Найденный ствол
## кладётся в рюкзак (main.gd, take()). Рюкзак при гибели пропадает (кроме валюты), съеденный жемчуг — навсегда
## (save_data). Ремкомплекты продаёт торговец (trade_offers), бывают в тайниках.

const PEARL_HP := 20.0
const MAX_HP_CAP := 200.0
const REPAIR_SHARE := 0.5
const PAGE := 5
const SLOT_NAMES := {"melee": "Ближний бой", "gun": "Огнестрел"}

var game: Node
## Здоровье героя с учётом съеденного жемчуга (навсегда).
var perk_hp := 100.0
var check_t := 0.0


func setup(g: Node) -> void:
	game = g
	game.hud.add_button("inventory", "Рюкзак", Vector2(-110, -520), 90, _on_button)


func _on_button(down: bool) -> void:
	if down:
		open()


func on_enter(_id: String) -> void:
	_apply_perk()


func save_data() -> Dictionary:
	return {"max_hp": perk_hp}


func load_data(d: Dictionary) -> void:
	perk_hp = clampf(float(d.get("max_hp", 100.0)), 100.0, MAX_HP_CAP)


## Новый герой (после гибели) — сразу с прибавкой от жемчуга.
func _apply_perk() -> void:
	var p = game.player
	if p != null and p.alive and p.max_hp < perk_hp:
		p.hp += perk_hp - p.max_hp
		p.max_hp = perk_hp


## Запасное оружие в рюкзаке (то, что не в слотах).
func owned() -> Array:
	if not game.kit.has("owned") or typeof(game.kit["owned"]) != TYPE_ARRAY:
		game.kit["owned"] = []
	return game.kit["owned"]


func _unhandled_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k != null and k.pressed and not k.echo and k.keycode == KEY_I and not game.hud.panel.visible:
		open()


## Слот опустел (ствол сломался или ушёл в хранилище) — в него встаёт запасное того же слота из рюкзака.
func _process(delta: float) -> void:
	check_t -= delta
	if check_t > 0.0:
		return
	check_t = 0.3
	var p = game.player
	if p == null or not p.alive or p.equipping:
		return
	for slot in ["gun", "melee"]:
		var cur: String = game.kit.get(slot, "")
		if cur != "" and cur != "fists":
			continue
		for id in owned():
			if Data.weapon(id).get("slot", "") == slot:
				owned().erase(id)
				game.kit[slot] = id
				p.attach_gear()
				game.toast("%s — из рюкзака в слот «%s»" % [Data.item_name(id), SLOT_NAMES[slot]])
				break


# ---------- Действия ----------


func drink() -> bool:
	var p = game.player
	if p == null or not p.alive:
		return false
	if int(game.bag.get("zhivchik", 0)) <= 0:
		game.toast("Живчиков нет")
		return false
	if p.hp >= p.max_hp:
		game.toast("Здоровье полное")
		return false
	game.use_zhivchik()
	game.save()
	return true


## Чёрная жемчужина: здоровье навсегда больше (до предела) и сразу полное.
func eat_pearl() -> bool:
	var p = game.player
	if p == null or not p.alive or int(game.bag.get("pearl", 0)) <= 0:
		return false
	if perk_hp >= MAX_HP_CAP:
		game.toast("Здоровье и так на пределе (%d) — лучше продай торговцу" % int(MAX_HP_CAP))
		return false
	game.bag["pearl"] = int(game.bag["pearl"]) - 1
	var add := minf(MAX_HP_CAP, perk_hp + PEARL_HP) - perk_hp
	perk_hp += add
	p.max_hp += add
	p.hp = p.max_hp
	game.toast("Организм окреп: здоровье навсегда %d (+%d)" % [int(perk_hp), int(add)])
	game.hud_refresh()
	game.save()
	return true


## Чем можно починить ремкомплектом: оружие в руках с износом (не кулаки).
func _repairable() -> String:
	var p = game.player
	if p == null:
		return ""
	var id: String = p.weapon_id()
	var w := Data.weapon(id)
	if id == "fists" or not w.has("durability"):
		return ""
	return id if p.wear_of(id) < int(w["durability"]) else ""


func repair_in_hands() -> bool:
	var p = game.player
	if p == null or not p.alive:
		return false
	if int(game.bag.get("repair", 0)) <= 0:
		game.toast("Ремкомплектов нет")
		return false
	var id := _repairable()
	if id == "":
		game.toast("В руках нечего чинить")
		return false
	var full := int(Data.weapon(id)["durability"])
	game.wear[id] = mini(full, int(p.wear_of(id)) + int(ceil(full * REPAIR_SHARE)))
	game.bag["repair"] = int(game.bag["repair"]) - 1
	game.toast("Ремкомплект: %s — износ %d / %d" % [Data.item_name(id), int(game.wear[id]), full])
	game.hud_refresh()
	game.save()
	return true


## Запасное оружие из рюкзака — в его слот, прежнее — в рюкзак.
func equip(id: String) -> bool:
	var w := Data.weapon(id)
	if w.is_empty() or not owned().has(id):
		return false
	var slot: String = w.get("slot", "gun")
	var old: String = game.kit.get(slot, "")
	owned().erase(id)
	if old != "" and old != "fists":
		owned().append(old)
	game.kit[slot] = id
	if game.player != null:
		game.player.attach_gear()
	if old != "" and old != "fists":
		game.toast("%s — в слоте, %s — в рюкзаке" % [Data.item_name(id), Data.item_name(old)])
	else:
		game.toast("%s — в слоте" % Data.item_name(id))
	game.save()
	return true


# ---------- Окно ----------


func _wear_text(id: String) -> String:
	var w := Data.weapon(id)
	if not w.has("durability") or game.player == null:
		return ""
	return "износ %d/%d" % [game.player.wear_of(id), int(w["durability"])]


func _slot_line(slot: String) -> String:
	var id: String = game.kit.get(slot, "")
	if id == "" or id == "fists":
		return "%s: пусто" % SLOT_NAMES[slot]
	var t := _wear_text(id)
	return "%s: %s%s" % [SLOT_NAMES[slot], Data.item_name(id), (" · " + t) if t != "" else ""]


func _summary() -> String:
	var p = game.player
	var bag: Dictionary = game.bag
	var lines := []
	lines.append("Здоровье %d / %d · в руках: %s" % [int(ceil(p.hp)), int(p.max_hp), Data.item_name(p.weapon_id())])
	lines.append(_slot_line("melee") + "\n" + _slot_line("gun"))
	lines.append("Живчики %d · гранаты %d · ремкомплекты %d · запасного оружия %d" % [bag.get("zhivchik", 0), bag.get("grenade", 0), bag.get("repair", 0), owned().size()])
	lines.append("Спораны %d · горох %d · чёрный жемчуг %d (валюта — при гибели остаётся)" % [bag.get("spore", 0), bag.get("peas", 0), bag.get("pearl", 0)])
	return "\n".join(lines)


func open() -> void:
	var p = game.player
	if p == null or not p.alive:
		return
	var bag: Dictionary = game.bag
	var acts := []
	var zh := int(bag.get("zhivchik", 0))
	acts.append(["Выпить живчик (+45) · есть %d" % zh, _act.bind("drink"), zh > 0 and p.hp < p.max_hp])
	var pearls := int(bag.get("pearl", 0))
	if pearls > 0:
		var full: bool = perk_hp >= MAX_HP_CAP
		acts.append(["Здоровье на пределе" if full else "Съесть чёрную жемчужину (здоровье +20 навсегда)", _act.bind("pearl"), not full])
	var rk := int(bag.get("repair", 0))
	if rk > 0:
		var fix := _repairable()
		acts.append(["Ремкомплект: починить %s на 50%% · есть %d" % [Data.item_name(fix), rk] if fix != "" else "Ремкомплект: в руках нечего чинить", _act.bind("repair"), fix != ""])
	var gr := int(bag.get("grenade", 0))
	if gr > 0:
		var in_stab: bool = Data.NODES.get(game.loc, {}).get("kind", "") == "stab"
		acts.append(["Бросить гранату · есть %d" % gr if not in_stab else "Гранату в стабе не бросишь", _act.bind("grenade"), not in_stab])
	if not owned().is_empty():
		acts.append(["Запасное оружие (%d) — поставить в слот" % owned().size(), _weapons.bind(0)])
	acts.append(["Закрыть", Callable(game.hud, "hide_panel")])
	game.hud.show_panel("Рюкзак", _summary(), acts)


func _act(kind: String) -> void:
	match kind:
		"drink":
			drink()
		"pearl":
			eat_pearl()
		"repair":
			repair_in_hands()
		"grenade":
			game.hud.hide_panel()
			var gr = game.get_node_or_null("grenades")
			if gr != null:
				gr.throw()
			return
	open()


## Запасное оружие постранично: выбрать, что поставить в слот.
func _weapons(page: int) -> void:
	var list := owned()
	if list.is_empty():
		open()
		return
	var pages := int(ceil(list.size() / float(PAGE)))
	page = clampi(page, 0, pages - 1)
	var acts := []
	for i in range(page * PAGE, mini(list.size(), page * PAGE + PAGE)):
		var id: String = list[i]
		var slot: String = Data.weapon(id).get("slot", "gun")
		var t := _wear_text(id)
		acts.append(["%s%s → в слот «%s»" % [Data.item_name(id), (" · " + t) if t != "" else "", SLOT_NAMES.get(slot, slot)], _equip_from_list.bind(id, page)])
	if pages > 1:
		acts.append(["Дальше › (%d / %d)" % [page + 1, pages], _weapons.bind((page + 1) % pages)])
	acts.append(["‹ Назад", open])
	game.hud.show_panel("Запасное оружие", _slot_line("melee") + "\n" + _slot_line("gun") + "\nВыбери, что поставить в слот — прежнее уйдёт в рюкзак.", acts)


func _equip_from_list(id: String, page: int) -> void:
	equip(id)
	_weapons(page)


# ---------- Торговец ----------


## Товар для окна торговца (main.gd, open_trade): ремкомплект.
func trade_offers(sp: int) -> Array:
	var price := _repair_price()
	return [["Ремкомплект (починить на 50%%) · %d сп." % price, _buy_repair, sp >= price]]


func _repair_price() -> int:
	var prices = game.get("PRICES")
	return int(prices.get("repair_kit", 25)) if prices is Dictionary else 25


func _buy_repair() -> void:
	var price := _repair_price()
	if int(game.bag.get("spore", 0)) < price:
		return
	game.bag["spore"] = int(game.bag["spore"]) - price
	game.bag["repair"] = int(game.bag.get("repair", 0)) + 1
	game.toast("+1 ремкомплект")
	game.save()
	game.open_trade()


# ---------- Автотест ----------


func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1


func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout


func smoke() -> int:
	var fail := 0
	var p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	# живчик
	game.bag["zhivchik"] = 1
	p.hp = p.max_hp - 100.0
	var hp0: float = p.hp
	_act("drink")
	fail += _check(p.hp >= hp0 + 44.0 and int(game.bag.get("zhivchik", 0)) == 0 and game.hud.panel.visible, "рюкзак: выпил живчик — здоровье +%d, окно открыто" % int(p.hp - hp0))
	game.hud.hide_panel()
	# чёрная жемчужина
	var keep := perk_hp
	perk_hp = 100.0
	p.max_hp = 100.0
	p.hp = 60.0
	game.bag["pearl"] = 1
	eat_pearl()
	fail += _check(is_equal_approx(p.max_hp, 120.0) and is_equal_approx(p.hp, 120.0) and int(game.bag.get("pearl", 0)) == 0, "съел жемчужину: здоровье навсегда %d, полное" % int(p.max_hp))
	perk_hp = keep
	p.max_hp = 100000.0
	p.hp = 100000.0
	# несколько стволов: найденные — в рюкзак, смена слота
	game.kit["gun"] = "pistol"
	game.wear["pistol"] = int(Data.weapon("pistol")["durability"])
	game.kit["owned"] = []
	p.attach_gear()
	game.take("ak74", 1)
	game.take("svd", 1)
	fail += _check(owned().has("ak74") and owned().has("svd") and game.kit["gun"] == "pistol", "найденные АК-74 и СВД — в рюкзаке, в слоте ПМ (рюкзак: %s)" % [owned()])
	equip("svd")
	fail += _check(game.kit["gun"] == "svd" and owned().has("pistol") and not owned().has("svd"), "СВД — в слот огнестрела, ПМ — в рюкзак")
	if p.hold != "gun":
		p.switch_weapon()
		await _wait(1.6)
	fail += _check(p.weapon_id() == "svd", "в руках %s" % p.weapon_id())
	_weapons(0)
	fail += _check(game.hud.panel.visible, "окно запасного оружия")
	game.hud.hide_panel()
	# ремкомплект: +50% износа оружию в руках
	game.wear["svd"] = 100
	game.bag["repair"] = 1
	repair_in_hands()
	fail += _check(p.wear_of("svd") == 250 and int(game.bag.get("repair", 0)) == 0, "ремкомплект: СВД 100 → %d из 300" % p.wear_of("svd"))
	# слот опустел (как при поломке) — встаёт запасной из рюкзака
	game.kit["gun"] = ""
	game.wear.erase("svd")
	p.hold = "melee"
	p.attach_gear()
	await _wait(0.5)
	var now: String = game.kit.get("gun", "")
	fail += _check(now in ["pistol", "ak74"] and not owned().has(now), "ствол сломался — из рюкзака в слот встал %s" % Data.item_name(now))
	# такой же целый ствол найден ещё раз — разобран на ремкомплект
	var rk0 := int(game.bag.get("repair", 0))
	game.take(now, 1)
	fail += _check(int(game.bag.get("repair", 0)) == rk0 + 1, "второй такой же %s — на ремкомплект" % Data.item_name(now))
	return fail
