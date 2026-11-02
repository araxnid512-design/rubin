extends Node
## Наёмники (перенос из браузерной игры: game/mercs.js и Merc, hire, takeMerc, leaveMerc, mercDied в game/main.js).
## Нанимают у вербовщика у костра в стабе (станция «mercs»). Нанятый живёт в комнате героя — шесть коек
## (meta.room.spots) — и стоит у своей койки. Снарядить (живчик, починка оружия, аптечка медика, гранаты
## подрывника), взять с собой или оставить — только в комнате: у стола «Отряд» (станция «room») или подойдя
## к бойцу. На вылазку — до четырёх (MAX_PARTY); вернувшись в стаб, уцелевшие снова у своих коек.
## Патронов в Godot-версии нет: оружие бойца изнашивается выстрелами (Data.GUN_DURABILITY), сломалось — боец
## бесполезен и держится за героем; чинят в комнате за спораны (как ремонт у торговца). Погибший уходит из
## отряда: Улей вернёт его в стаб к костру, но уже вольным — нанять заново можно у вербовщика. Пропали и те,
## кто был с героем, когда кластер перезагрузился; съели героя — бойцы вытащат его в стаб.
## Значки отряда — под здоровьем героя, окно отряда — через game.hud.show_panel (кнопка «Отряд»).

const MercActor := preload("res://scripts/features/merc.gd")

## Классы: роль в бою. keep — на каком расстоянии идёт за героем; burst — длина очереди (у автоматического
## оружия); prefer/kite — снайпер выбирает дальних и отходит от подобравшихся; plant — пулемётчик стреляет стоя;
## heals — медик лечит живчиками из аптечки; grenades — подрывник кидает Ф-1.
const CLASSES := {
	"assault": {"name": "Штурмовик", "short": "ШТ", "keep": 2.3, "burst": [3, 5], "color": Color(0.62, 0.82, 0.5), "desc": "Держится рядом, бьёт короткими очередями по ближайшим."},
	"sniper": {"name": "Снайпер", "short": "СН", "keep": 4.2, "prefer": "far", "kite": 3.5, "color": Color(0.55, 0.75, 0.95), "desc": "Идёт поодаль, первым снимает тех, кто вцепился в тебя, потом топтунов и дальних. Вблизи беззащитен — отходит."},
	"gunner": {"name": "Пулемётчик", "short": "ПУЛ", "keep": 2.9, "burst": [9, 15], "plant": true, "color": Color(0.92, 0.65, 0.38), "desc": "Держит толпу длинными очередями; стреляет стоя."},
	"hunter": {"name": "Охотник", "short": "ОХ", "keep": 1.9, "color": Color(0.85, 0.75, 0.52), "desc": "Подпускает близко и бьёт картечью почти без промаха."},
	"medic": {"name": "Медик", "short": "МЕД", "keep": 1.7, "burst": [2, 4], "heals": true, "color": Color(0.95, 0.95, 0.95), "desc": "Держится ближе всех и лечит тебя и отряд живчиками из своей аптечки — пополняй её."},
	"sapper": {"name": "Подрывник", "short": "ПОД", "keep": 2.6, "burst": [3, 4], "grenades": true, "color": Color(0.92, 0.5, 0.45), "desc": "Кидает Ф-1 в кучу заражённых или в топтуна, если свои не рядом с целью. Гранаты — в разгрузку в комнате."},
}

## Бойцы: класс, постоянное оружие, цена найма, здоровье, окраска одежды.
const MERCS := {
	"shram": {"name": "Шрам", "cls": "assault", "weapon": "ak74", "price": 120, "hp": 120, "tint": [0.55, 0.58, 0.48], "desc": "Бывший контрактник с АК-74. Ровный, надёжный, оружие бережёт."},
	"botsman": {"name": "Боцман", "cls": "assault", "weapon": "ak47", "price": 130, "hp": 130, "tint": [0.46, 0.5, 0.62], "desc": "Здоровяк с АК-47. Шумный, зато бегун падает с пары попаданий."},
	"sych": {"name": "Сыч", "cls": "sniper", "weapon": "svd", "price": 150, "hp": 90, "tint": [0.64, 0.66, 0.52], "desc": "Снайпер с СВД: заражённый падает с выстрела. Стреляет редко."},
	"tihonya": {"name": "Тихоня", "cls": "sniper", "weapon": "vss", "price": 170, "hp": 90, "tint": [0.4, 0.44, 0.4], "desc": "С бесшумным «Винторезом»: стреляет почти неслышно — соседи убитого не сбегаются."},
	"kuvalda": {"name": "Кувалда", "cls": "gunner", "weapon": "pkm", "price": 200, "hp": 160, "tint": [0.58, 0.5, 0.42], "desc": "Пулемётчик с ПКМ. Держит улицу, пока ствол цел."},
	"ded": {"name": "Дед", "cls": "hunter", "weapon": "shotgun", "price": 80, "hp": 140, "tint": [0.78, 0.66, 0.52], "desc": "Старый охотник с МР-133. Ждёт, пока подойдут, и не промахивается."},
	"dok": {"name": "Док", "cls": "medic", "weapon": "vector", "price": 140, "hp": 100, "tint": [0.86, 0.86, 0.82], "desc": "Медик с «Вектором». В аптечке два живчика — дальше пополняешь ты."},
	"saper": {"name": "Сапёр", "cls": "sapper", "weapon": "aks", "price": 150, "hp": 120, "tint": [0.5, 0.54, 0.4], "desc": "Подрывник с АКС-74У и двумя Ф-1 в разгрузке."},
}
## Сколько бойцов можно взять на вылазку (остальные ждут у коек).
const MAX_PARTY := 4
## Коек в комнате героя — столько наёмников можно нанять.
const ROOM_BEDS := 6
## Сколько здоровья даёт живчик бойцу (от героя в комнате и от медика).
const MERC_HEAL := 60.0
## Снаряжение класса при найме: аптечка медика, гранаты подрывника.
const KIT := {"medic": {"meds": 2}, "sapper": {"nades": 2}}
## Ф-1 подрывнику, когда своих гранат в рюкзаке нет, — за спораны.
const NADE_PRICE := 25

var game: Node
## Нанятые: {id, hp, wear, out, bed, meds?, nades?} — out: идёт с героем, иначе ждёт у своей койки в стабе.
var roster: Array = []
## Бойцы на сцене (узлы merc.gd).
var actors: Array = []
## Что сказать, когда герой в следующий раз придёт в стаб (гибель, перезагрузка кластера с отрядом).
var note := ""
var bar_layer: CanvasLayer
var bar: HBoxContainer
var icons := {}
var bar_t := 0.0
var hero_alive := false
var cluster_next := -1.0
var smoke_shots := 0

func setup(g: Node) -> void:
	game = g
	bar_layer = CanvasLayer.new()
	bar_layer.layer = 9
	add_child(bar_layer)
	bar = HBoxContainer.new()
	bar.position = Vector2(24, 112)
	bar.add_theme_constant_override("separation", 8)
	bar.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar_layer.add_child(bar)

func _hud() -> Hud:
	return game.hud

func toast(text: String) -> void:
	game.toast(text)

func spores() -> int:
	return int(game.bag.get("spore", 0))

# ---------- Состояние ----------

func merc_state(id: String) -> Dictionary:
	for st in roster:
		if str(st["id"]) == id:
			return st
	return {}

func actor_of(id: String):
	for a in actors:
		if is_instance_valid(a) and str(a.st["id"]) == id:
			return a
	return null

## Отряд — кто идёт с героем (по порядку найма: от него — место в строю).
func party() -> Array:
	var out := []
	for st in roster:
		if bool(st["out"]):
			out.append(st)
	return out

## Живые бойцы отряда на сцене.
func party_actors() -> Array:
	var out := []
	for a in actors:
		if is_instance_valid(a) and a.alive and bool(a.st["out"]):
			out.append(a)
	return out

func new_state(id: String, bed: int) -> Dictionary:
	var d: Dictionary = MERCS[id]
	var st := {"id": id, "hp": float(d["hp"]), "wear": durability(id), "out": false, "bed": bed}
	var kit: Dictionary = KIT.get(str(d["cls"]), {})
	for k in kit:
		st[k] = int(kit[k])
	return st

## Сколько выстрелов выдерживает оружие бойца.
func durability(id: String) -> int:
	return int(Data.weapon(str(MERCS[id]["weapon"])).get("durability", 500))

## Починка оружия бойца — как у торговца: половина цены ствола за полный износ.
func repair_cost(st: Dictionary) -> int:
	if st.is_empty():
		return 0
	var id := str(st["id"])
	var w := Data.weapon(str(MERCS[id]["weapon"]))
	var lost := 1.0 - float(st["wear"]) / float(durability(id))
	return int(ceil(float(w.get("price", 100)) * 0.5 * lost))

func _free_bed() -> int:
	for b in ROOM_BEDS:
		var taken := false
		for st in roster:
			if int(st.get("bed", -1)) == b:
				taken = true
		if not taken:
			return b
	return 0

# ---------- Стаб и комната ----------

func room() -> Dictionary:
	if game == null or game.level == null:
		return {}
	var r = game.level.meta.get("room")
	return r if typeof(r) == TYPE_DICTIONARY else {}

func in_stab() -> bool:
	return not room().is_empty()

## Герой в своей комнате в стабе: только здесь бойцов снаряжают, берут с собой и оставляют.
func in_room() -> bool:
	var r := room()
	if r.is_empty() or game.player == null:
		return false
	var p: Vector3 = game.player.global_position
	return p.x > float(r["x0"]) and p.x < float(r["x1"]) and p.z > float(r["z0"]) and p.z < float(r["z1"])

## Место бойца у его койки: {pos, ry} или пусто (не в стабе).
func home_of(st: Dictionary) -> Dictionary:
	var r := room()
	if r.is_empty():
		return {}
	var spots: Array = r.get("spots", [])
	var b := int(st.get("bed", 0))
	if b < 0 or b >= spots.size():
		return {}
	var s: Array = spots[b]
	return {"pos": Vector3(float(s[0]), 0, float(s[1])), "ry": float(s[2])}

# ---------- Локации ----------

## Пришли в локацию: отряд — рядом с героем; в стабе уцелевшие расходятся по своим койкам.
func on_enter(_id: String) -> void:
	var back := PackedStringArray()
	if in_stab():
		for st in roster:
			if bool(st["out"]):
				back.append(str(MERCS[st["id"]]["name"]))
				st["out"] = false
	_spawn_all()
	var msg := ""
	if note != "":
		msg = note
		note = ""
	elif not back.is_empty():
		msg = "%s — у %s в твоей комнате" % [" и ".join(back), "своих коек" if back.size() > 1 else "своей койки"]
	if msg != "":
		# после названия локации (его пишет main.enter следом)
		get_tree().create_timer(1.4).timeout.connect(toast.bind(msg))
	_refresh_ui()

func on_leave() -> void:
	for a in actors:
		if is_instance_valid(a):
			a.queue_free()
	actors.clear()

func _spawn_all() -> void:
	on_leave()
	var stab := in_stab()
	for st in roster:
		if bool(st["out"]) or stab:
			var m = _spawn(st)
			var h := home_of(st)
			if bool(st["out"]) or h.is_empty():
				m.place()
			else:
				m.global_position = h["pos"]
				m.rotation.y = float(h["ry"])
	_slots()

func _spawn(st: Dictionary):
	var m: CharacterBody3D = MercActor.new()
	add_child(m)
	var d: Dictionary = MERCS[st["id"]]
	m.setup(game, self, st, d, CLASSES[d["cls"]])
	actors.append(m)
	if bool(st["out"]) and not game.targets.has(m):
		game.targets.append(m)
	return m

## Места в строю: по порядку в отряде (Merc.spot).
func _slots() -> void:
	var p := party()
	for a in actors:
		if is_instance_valid(a):
			a.slot = maxi(0, p.find(a.st))

func _process(delta: float) -> void:
	if game == null or game.level == null or game.player == null:
		return
	_watch_hero()
	if in_stab():
		_sync_stations()
	bar_t -= delta
	if bar_t <= 0.0:
		bar_t = 0.25
		actors = actors.filter(func(a): return is_instance_valid(a))
		refresh_bar()

## Гибель героя: при перезагрузке кластера пропадает и отряд (вернутся в стаб вольными); съели — бойцы
## вытащат героя в стаб. Перезагрузку видно по сроку кластера: main.advance сдвигает его перед гибелью.
func _watch_hero() -> void:
	var p: Player = game.player
	var clusters: Dictionary = game.world.get("clusters", {})
	if p.alive:
		hero_alive = true
		cluster_next = float(clusters[game.loc]["next"]) if clusters.has(game.loc) else -1.0
		return
	if not hero_alive:
		return
	hero_alive = false
	var reload: bool = clusters.has(game.loc) and absf(float(clusters[game.loc]["next"]) - cluster_next) > 0.001
	for a in actors:
		if is_instance_valid(a):
			a.frozen = true
			game.targets.erase(a)
	var names := PackedStringArray()
	for st in party():
		names.append(str(MERCS[st["id"]]["name"]))
	if names.is_empty():
		return
	if reload:
		for st in party():
			roster.erase(st)
		note = "Кластер перезагрузился вместе с отрядом: %s вернутся в стаб к костру уже вольными — нанять заново можно у вербовщика" % ", ".join(names)
		toast(note)
		_refresh_ui()
	else:
		note = "%s вытащили тебя в стаб и ждут у своих коек в твоей комнате" % " и ".join(names)

## Подойти к бойцу в комнате: у каждого — своя точка действия «Снарядить» (кнопка действия героя).
func _sync_stations() -> void:
	var list: Array = game.level.meta.get("stations", [])
	for i in range(list.size() - 1, -1, -1):
		if str(list[i].get("id", "")) == "merc":
			list.remove_at(i)
	if not in_room():
		return
	for a in actors:
		if is_instance_valid(a) and a.alive:
			list.append({"id": "merc", "merc": a.st["id"], "name": a.D["name"], "label": "Снарядить", "x": a.global_position.x, "z": a.global_position.z, "r": 2.0 if bool(a.st["out"]) else 1.5})

func interact(s: Dictionary) -> bool:
	match str(s.get("id", "")):
		"mercs":
			open_hire()
			return true
		"room":
			open_party()
			return true
		"merc":
			open_card(str(s.get("merc", "")))
			return true
	return false

# ---------- Найм, отряд, снаряжение ----------

## Нанять у вербовщика: боец идёт в комнату героя и ждёт у своей койки.
func hire(id: String) -> bool:
	if not MERCS.has(id) or not merc_state(id).is_empty():
		return false
	var d: Dictionary = MERCS[id]
	if roster.size() >= ROOM_BEDS:
		toast("В твоей комнате все %d коек заняты" % ROOM_BEDS)
		return false
	if spores() < int(d["price"]):
		toast("Не хватает споранов")
		return false
	game.bag["spore"] = spores() - int(d["price"])
	var st := new_state(id, _free_bed())
	roster.append(st)
	if in_stab():
		var m = _spawn(st)
		m.place()
	toast("%s (%s) нанят — ждёт в твоей комнате (жилой блок у казармы)" % [d["name"], str(CLASSES[d["cls"]]["name"]).to_lower()])
	_changed()
	return true

## Взять бойца из комнаты на вылазку (только в комнате).
func take(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or bool(st["out"]):
		return false
	if not in_room():
		toast("Взять бойца с собой можно только в твоей комнате в стабе")
		return false
	if party().size() >= MAX_PARTY:
		toast("С тобой уже %d — сначала оставь кого-нибудь в комнате" % MAX_PARTY)
		return false
	st["out"] = true
	var a = actor_of(id)
	if a != null and not game.targets.has(a):
		game.targets.append(a)
	toast("%s идёт с тобой" % MERCS[id]["name"])
	_changed()
	return true

## Оставить бойца в комнате (только в комнате): он уходит к своей койке.
func leave(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or not bool(st["out"]) or not in_room():
		return false
	st["out"] = false
	var a = actor_of(id)
	if a != null:
		game.targets.erase(a)
	toast("%s остаётся в комнате" % MERCS[id]["name"])
	_changed()
	return true

## Живчик бойцу: сам он не лечится (только в комнате).
func heal(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or not in_room() or int(game.bag.get("zhivchik", 0)) <= 0:
		return false
	var top := float(MERCS[id]["hp"])
	if float(st["hp"]) >= top:
		return false
	game.bag["zhivchik"] = int(game.bag["zhivchik"]) - 1
	st["hp"] = minf(top, float(st["hp"]) + MERC_HEAL)
	toast("%s: +%d здоровья" % [MERCS[id]["name"], int(MERC_HEAL)])
	_changed()
	return true

## Починить оружие бойца за спораны (только в комнате).
func repair(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or not in_room():
		return false
	var cost := repair_cost(st)
	if cost <= 0 or spores() < cost:
		return false
	game.bag["spore"] = spores() - cost
	st["wear"] = durability(id)
	var a = actor_of(id)
	if a != null and a.gun:
		a.gun.visible = true
	toast("%s: %s как новый (−%d сп.)" % [MERCS[id]["name"], Data.weapon(str(MERCS[id]["weapon"])).get("name", ""), cost])
	_changed()
	return true

## Живчик в аптечку медика — он сам лечит им раненых.
func give_meds(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or not st.has("meds") or not in_room() or int(game.bag.get("zhivchik", 0)) <= 0:
		return false
	game.bag["zhivchik"] = int(game.bag["zhivchik"]) - 1
	st["meds"] = int(st["meds"]) + 1
	toast("%s: в аптечке %d %s" % [MERCS[id]["name"], int(st["meds"]), Data.plural(int(st["meds"]), Data.ITEMS["zhivchik"]["forms"])])
	_changed()
	return true

## Ф-1 подрывнику: из рюкзака, а нет своих — за спораны.
func give_nade(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty() or not st.has("nades") or not in_room():
		return false
	if int(game.bag.get("grenade", 0)) > 0:
		game.bag["grenade"] = int(game.bag["grenade"]) - 1
	elif spores() >= NADE_PRICE:
		game.bag["spore"] = spores() - NADE_PRICE
	else:
		return false
	st["nades"] = int(st["nades"]) + 1
	toast("%s: гранат %d" % [MERCS[id]["name"], int(st["nades"])])
	_changed()
	return true

## Отпустить наёмника совсем (у вербовщика): освобождает койку.
func dismiss(id: String) -> bool:
	var st := merc_state(id)
	if st.is_empty():
		return false
	roster.erase(st)
	var a = actor_of(id)
	if a != null:
		game.targets.erase(a)
		actors.erase(a)
		a.queue_free()
	_slots()
	toast("%s ушёл из стаба" % MERCS[id]["name"])
	_changed()
	return true

## Погиб: койка освобождается; Улей вернёт его в стаб, но уже не твоим — нанять заново можно у вербовщика.
func merc_died(a) -> void:
	roster.erase(a.st)
	game.targets.erase(a)
	_slots()
	toast("%s погиб. Улей вернёт его в стаб к костру — но уже вольным: нанять заново можно у вербовщика" % a.D["name"])
	_changed()

func _changed() -> void:
	_slots()
	_refresh_ui()
	game.hud_refresh()
	game.save()

# ---------- Окна ----------

## Вербовщик: классы бойцов (у каждого — свой экран с наймом и «отпустить»).
func open_hire() -> void:
	var acts := []
	for cls in CLASSES:
		var vacant := PackedStringArray()
		for id in MERCS:
			if str(MERCS[id]["cls"]) == cls and merc_state(id).is_empty():
				vacant.append(str(MERCS[id]["name"]))
		var state := "свободны: %s" % ", ".join(vacant) if not vacant.is_empty() else "все у тебя"
		acts.append(["%s · %s" % [CLASSES[cls]["name"], state], open_class.bind(cls)])
	acts.append(["Закрыть", _hud().hide_panel])
	var beds := ROOM_BEDS - roster.size()
	_hud().show_panel("Вербовщик", "Спораны: %d. Свободных коек в твоей комнате: %d из %d. Патронов бойцам не нужно — оружие изнашивается выстрелами, чинят его в комнате за спораны." % [spores(), beds, ROOM_BEDS], acts)

func open_class(cls: String) -> void:
	var c: Dictionary = CLASSES[cls]
	var lines := PackedStringArray([str(c["desc"])])
	var acts := []
	var full := roster.size() >= ROOM_BEDS
	for id in MERCS:
		var d: Dictionary = MERCS[id]
		if str(d["cls"]) != cls:
			continue
		var w := Data.weapon(str(d["weapon"]))
		lines.append("%s — %s, здоровье %d. %s" % [d["name"], w.get("name", ""), int(d["hp"]), d["desc"]])
		if merc_state(id).is_empty():
			acts.append(["Нанять: %s (%s) · %d сп." % [d["name"], w.get("name", ""), int(d["price"])], _hire_from.bind(id, cls), not full and spores() >= int(d["price"])])
		else:
			acts.append(["Отпустить совсем: %s" % d["name"], _dismiss_from.bind(id, cls)])
	acts.append(["Назад", open_hire])
	acts.append(["Закрыть", _hud().hide_panel])
	_hud().show_panel(str(c["name"]), "\n".join(lines), acts)

func _hire_from(id: String, cls: String) -> void:
	hire(id)
	open_class(cls)

func _dismiss_from(id: String, cls: String) -> void:
	dismiss(id)
	open_class(cls)

## Окно отряда: кто с героем и кто ждёт у коек; выбрать бойца — его карточка.
func open_party() -> void:
	var acts := []
	var room_here := in_room()
	for st in roster:
		var id := str(st["id"])
		var d: Dictionary = MERCS[id]
		var w := Data.weapon(str(d["weapon"]))
		var pct := int(round(100.0 * float(st["wear"]) / float(durability(id))))
		acts.append(["%s · %d/%d · %s %s · %s" % [d["name"], int(ceil(float(st["hp"]))), int(d["hp"]), w.get("name", ""), ("%d%%" % maxi(1, pct)) if int(st["wear"]) > 0 else "сломан", "с тобой" if bool(st["out"]) else "у койки"], open_card.bind(id)])
	acts.append(["Закрыть", _hud().hide_panel])
	var text := "С тобой %d из %d · спораны %d. " % [party().size(), MAX_PARTY, spores()]
	if roster.is_empty():
		text = "Наёмников нет. Нанять можно у вербовщика у костра в стабе «Полис»."
	elif room_here:
		text += "Ты в своей комнате: выбери бойца — снарядить, взять с собой или оставить у койки."
	else:
		text += "Снарядить бойцов, взять с собой или оставить — только в твоей комнате в стабе, у их коек."
	_hud().show_panel("Отряд", text, acts)

## Карточка бойца: здоровье, износ, снаряжение класса; в комнате — действия.
func open_card(id: String) -> void:
	var st := merc_state(id)
	if st.is_empty():
		open_party()
		return
	var d: Dictionary = MERCS[id]
	var c: Dictionary = CLASSES[d["cls"]]
	var w := Data.weapon(str(d["weapon"]))
	var room_here := in_room()
	var zh := int(game.bag.get("zhivchik", 0))
	var dur := durability(id)
	var text := "%s. %s\nЗдоровье %d/%d · %s: износ %d/%d" % [c["name"], d["desc"], int(ceil(float(st["hp"]))), int(d["hp"]), w.get("name", ""), int(st["wear"]), dur]
	if int(st["wear"]) <= 0:
		text += " — сломан, без оружия боец бесполезен"
	if st.has("meds"):
		text += " · в аптечке %d" % int(st["meds"])
	if st.has("nades"):
		text += " · гранат %d" % int(st["nades"])
	var acts := []
	if room_here:
		if bool(st["out"]):
			acts.append(["Оставить у койки", _card_act.bind("leave", id)])
		else:
			acts.append(["Взять с собой (с тобой %d/%d)" % [party().size(), MAX_PARTY], _card_act.bind("take", id), party().size() < MAX_PARTY])
		acts.append(["Живчик: +%d здоровья (есть %d)" % [int(MERC_HEAL), zh], _card_act.bind("heal", id), zh > 0 and float(st["hp"]) < float(d["hp"])])
		var cost := repair_cost(st)
		acts.append(["Починить %s · %d сп." % [w.get("name", ""), cost], _card_act.bind("repair", id), cost > 0 and spores() >= cost])
		if st.has("meds"):
			acts.append(["Живчик в аптечку (есть %d)" % zh, _card_act.bind("meds", id), zh > 0])
		if st.has("nades"):
			var own := int(game.bag.get("grenade", 0))
			var label := "Ф-1 в разгрузку (есть %d)" % own if own > 0 else "Ф-1 в разгрузку · %d сп." % NADE_PRICE
			acts.append([label, _card_act.bind("nade", id), own > 0 or spores() >= NADE_PRICE])
	else:
		text += "\nСнарядить, взять или оставить — только в твоей комнате в стабе."
	acts.append(["Весь отряд", open_party])
	acts.append(["Закрыть", _hud().hide_panel])
	_hud().show_panel("%s · %s" % [d["name"], str(c["name"]).to_lower()], text, acts)

func _card_act(kind: String, id: String) -> void:
	match kind:
		"take":
			take(id)
		"leave":
			leave(id)
		"heal":
			heal(id)
		"repair":
			repair(id)
		"meds":
			give_meds(id)
		"nade":
			give_nade(id)
	open_card(id)

func _on_party_button(down: bool) -> void:
	if down:
		open_party()

# ---------- Значки отряда ----------

## Значки бойцов, что с героем, и кнопка «Отряд» (пока есть нанятые).
func _refresh_ui() -> void:
	if game == null or game.hud == null:
		return
	var hud := _hud()
	if not roster.is_empty() and not hud.buttons.has("party"):
		hud.add_button("party", "Отряд", Vector2(-322, -620), 88, _on_party_button)   # слева от миникарты
	elif roster.is_empty() and hud.buttons.has("party"):
		hud.remove_button("party")
	for ch in bar.get_children():
		ch.queue_free()
	icons.clear()
	for st in party():
		var id := str(st["id"])
		var d: Dictionary = MERCS[id]
		var c: Dictionary = CLASSES[d["cls"]]
		var box := PanelContainer.new()
		box.mouse_filter = Control.MOUSE_FILTER_IGNORE
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.08, 0.09, 0.08, 0.72)
		sb.set_corner_radius_all(8)
		sb.content_margin_left = 8
		sb.content_margin_right = 8
		sb.content_margin_top = 5
		sb.content_margin_bottom = 5
		box.add_theme_stylebox_override("panel", sb)
		var v := VBoxContainer.new()
		v.add_theme_constant_override("separation", 3)
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		box.add_child(v)
		var title := _label(v, "%s %s" % [c["short"], d["name"]], 15)
		title.add_theme_color_override("font_color", c["color"])
		var hp := _meter(v, Color(0.75, 0.18, 0.14), 8)
		var wr := _meter(v, Color(0.82, 0.7, 0.32), 5)
		var info := _label(v, "", 12)
		bar.add_child(box)
		icons[id] = {"box": box, "hp": hp, "wear": wr, "info": info}
	refresh_bar()

func _label(parent: Control, text: String, size: int) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(l)
	return l

func _meter(parent: Control, fill: Color, h: float) -> ProgressBar:
	var b := ProgressBar.new()
	b.custom_minimum_size = Vector2(92, h)
	b.show_percentage = false
	var f := StyleBoxFlat.new()
	f.bg_color = fill
	f.set_corner_radius_all(2)
	var bg := StyleBoxFlat.new()
	bg.bg_color = Color(0.1, 0.1, 0.1, 0.8)
	bg.set_corner_radius_all(2)
	b.add_theme_stylebox_override("fill", f)
	b.add_theme_stylebox_override("background", bg)
	b.mouse_filter = Control.MOUSE_FILTER_IGNORE
	parent.add_child(b)
	return b

## Значения на значках: здоровье, износ, аптечка/гранаты; раненый или безоружный — красноватый.
func refresh_bar() -> void:
	for st in party():
		var id := str(st["id"])
		if not icons.has(id):
			continue
		var ic: Dictionary = icons[id]
		var top := float(MERCS[id]["hp"])
		var dur := float(durability(id))
		var hp_bar: ProgressBar = ic["hp"]
		var wear_bar: ProgressBar = ic["wear"]
		hp_bar.max_value = top
		hp_bar.value = clampf(float(st["hp"]), 0.0, top)
		wear_bar.max_value = dur
		wear_bar.value = float(st["wear"])
		var line := "без оружия" if int(st["wear"]) <= 0 else "оружие %d%%" % maxi(1, int(round(100.0 * float(st["wear"]) / dur)))
		if st.has("meds"):
			line += " · аптечка %d" % int(st["meds"])
		if st.has("nades"):
			line += " · Ф-1 %d" % int(st["nades"])
		var info: Label = ic["info"]
		info.text = line
		var low := float(st["hp"]) < top * 0.3 or int(st["wear"]) <= 0
		var box: Control = ic["box"]
		box.modulate = Color(1.0, 0.7, 0.7) if low else Color(1, 1, 1)

# ---------- Сохранение ----------

func save_data() -> Dictionary:
	return {"roster": roster.duplicate(true)}

func load_data(d) -> void:
	roster = []
	if typeof(d) != TYPE_DICTIONARY:
		return
	var out_n := 0
	for m in d.get("roster", []):
		if typeof(m) != TYPE_DICTIONARY:
			continue
		var id := str(m.get("id", ""))
		if not MERCS.has(id) or not merc_state(id).is_empty() or roster.size() >= ROOM_BEDS:
			continue
		var st := new_state(id, -1)
		st["hp"] = clampf(float(m.get("hp", st["hp"])), 0.0, float(MERCS[id]["hp"]))
		if float(st["hp"]) <= 0.0:
			continue
		st["wear"] = clampi(int(m.get("wear", st["wear"])), 0, int(st["wear"]))
		st["out"] = bool(m.get("out", false)) and out_n < MAX_PARTY
		if bool(st["out"]):
			out_n += 1
		for k in ["meds", "nades"]:
			if st.has(k):
				st[k] = maxi(0, int(m.get(k, st[k])))
		var b := int(m.get("bed", -1))
		for o in roster:
			if int(o["bed"]) == b:
				b = -1
		st["bed"] = b if b >= 0 and b < ROOM_BEDS else -1
		roster.append(st)
	for st in roster:
		if int(st["bed"]) < 0:
			st["bed"] = _free_bed()
	_refresh_ui()

# ---------- Автотест (CI) ----------

func _ok(cond: bool, msg: String) -> int:
	print(("✓ " if cond else "✗ ") + msg)
	return 0 if cond else 1

func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

func _on_shot(shooter, _w, _from) -> void:
	if actors.has(shooter):
		smoke_shots += 1

func _station_of(id: String) -> Dictionary:
	for s in game.level.meta.get("stations", []):
		if str(s.get("id", "")) == id:
			return s
	return {}

func _wear_sum() -> int:
	var n := 0
	for st in roster:
		n += int(st["wear"])
	return n

## Свободная точка в dist от from: не в стене, не у выхода, видна от from; ближе к середине кластера.
func _free_point(from: Vector3, dist: float) -> Vector3:
	var best := from
	var bd := INF
	for i in 24:
		var a := TAU * float(i) / 24.0
		var q := from + Vector3(cos(a), 0, sin(a)) * dist
		if game.level.blocked_at(q) or not game.level.exit_at(q).is_empty() or not game.line_of_sight(from, q):
			continue
		if q.length() < bd:
			bd = q.length()
			best = q
	return best

## Свободное место в комнате героя (для автотеста).
func _room_point() -> Vector3:
	var r := room()
	var c := Vector3((float(r["x0"]) + float(r["x1"])) / 2.0, 0, (float(r["z0"]) + float(r["z1"])) / 2.0 + 1.0)
	for i in 40:
		var q := c + Vector3(randf_range(-3.0, 3.0), 0, randf_range(-1.5, 1.5))
		if not game.level.blocked_at(q):
			return q
	return c

func _names(list: Array) -> String:
	var out := PackedStringArray()
	for st in list:
		out.append(str(MERCS[st["id"]]["name"]))
	return ", ".join(out)

func smoke() -> int:
	var fails := 0
	var hud := _hud()
	# стаб: комната и вербовщик
	game.enter("stab", game.loc)
	await _wait(0.6)
	var r := room()
	var beds: Array = r.get("spots", [])
	fails += _ok(in_stab() and beds.size() == ROOM_BEDS, "стаб: комната героя, мест у коек %d" % beds.size())
	var rec := _station_of("mercs")
	fails += _ok(not rec.is_empty() and interact(rec) and hud.panel.visible, "у костра вербовщик: окно найма открылось")
	hud.hide_panel()
	game.bag["spore"] = 3000
	var cost := 0
	for id in ["shram", "sych", "kuvalda", "dok", "botsman", "ded"]:
		if hire(id):
			cost += int(MERCS[id]["price"])
	fails += _ok(roster.size() == ROOM_BEDS and spores() == 3000 - cost, "нанято %d (%s), спораны 3000 → %d" % [roster.size(), _names(roster), spores()])
	fails += _ok(not hire("saper") and roster.size() == ROOM_BEDS, "седьмого не нанять: все %d коек заняты" % ROOM_BEDS)
	fails += _ok(not take("shram") and party().is_empty(), "вне комнаты бойца с собой не взять")
	# комната: подойти к бойцам, взять четверых, пятого нельзя
	game.player.global_position = _room_point()
	await _wait(0.5)
	var near := 0
	for s in game.level.meta.get("stations", []):
		if str(s.get("id", "")) == "merc":
			near += 1
	fails += _ok(in_room() and near == ROOM_BEDS, "герой в своей комнате, к бойцам можно подойти: %d" % near)
	for id in ["shram", "sych", "kuvalda", "dok"]:
		take(id)
	fails += _ok(party().size() == MAX_PARTY, "взяты с собой: %s" % _names(party()))
	fails += _ok(not take("botsman") and party().size() == MAX_PARTY, "пятого не взять: на вылазку до %d" % MAX_PARTY)
	fails += _ok(bar.get_child_count() >= MAX_PARTY and hud.buttons.has("party"), "значки отряда и кнопка «Отряд» на экране")
	# кластер: бойцы с героем
	game.enter("zarechny", "stab")
	await _wait(0.6)
	for e in game.enemies.duplicate():
		if is_instance_valid(e):
			e.queue_free()
	game.enemies.clear()
	var in_targets := 0
	for a in actors:
		if game.targets.has(a):
			in_targets += 1
	fails += _ok(party_actors().size() == MAX_PARTY and in_targets == MAX_PARTY, "в кластере с героем %d бойца, все — цели заражённых" % party_actors().size())
	for a in actors:
		a.st["hp"] = 5000.0   # тест не должен зависеть от случайных укусов
	var p: Player = game.player
	p.global_position = _free_point(p.global_position, 9.0)
	await _wait(3.5)
	var far := 0.0
	for a in party_actors():
		far = maxf(far, Vector2(a.global_position.x - p.global_position.x, a.global_position.z - p.global_position.z).length())
	fails += _ok(far < 8.0, "бойцы идут за героем: дальний в %.1f м" % far)
	# стрельба по заражённому
	var w0 := _wear_sum()
	smoke_shots = 0
	game.connect("shot", _on_shot)
	var z = game.spawn_enemy("runner", _free_point(p.global_position, 6.0))
	z.alert()
	var hp0: float = z.hp
	await _wait(3.0)
	var hit: bool = not is_instance_valid(z) or not z.alive or z.hp < hp0
	fails += _ok(smoke_shots > 0 and hit, "бойцы стреляют сами: выстрелов %d, заражённый получил урон (%s)" % [smoke_shots, "убит" if not is_instance_valid(z) or not z.alive else "%d → %d" % [int(hp0), int(z.hp)]])
	fails += _ok(_wear_sum() < w0, "износ оружия бойцов растёт: %d → %d" % [w0, _wear_sum()])
	# оружие сломалось — безоружный не стреляет
	var sh = actor_of("shram")
	sh.st["wear"] = 1
	var z2 = game.spawn_enemy("runner", _free_point(p.global_position, 5.0))
	sh._fire(z2)
	fails += _ok(sh.broken() and not sh.gun.visible, "износ кончился — АК-74 Шрама сломался")
	await _wait(1.0)
	fails += _ok(sh.target == null and int(sh.st["wear"]) == 0, "без оружия боец не стреляет, держится за героем")
	# медик перевязывает раненого героя
	var dok = actor_of("dok")
	var m0 := int(dok.st.get("meds", 0))
	p.hp = p.max_hp * 0.4
	await _wait(3.0)
	fails += _ok(int(dok.st.get("meds", 0)) < m0, "медик перевязал героя: в аптечке %d → %d" % [m0, int(dok.st.get("meds", 0))])
	p.hp = p.max_hp
	# граната подрывника (упрощённо: взрыв на месте)
	var z3 = game.spawn_enemy("runner", _free_point(p.global_position, 9.0))
	var hp3: float = z3.hp
	dok.explode(z3.global_position)
	fails += _ok(not z3.alive or z3.hp < hp3, "взрыв Ф-1 ранит заражённых рядом")
	# гибель бойца
	var ku = actor_of("kuvalda")
	ku.st["hp"] = 1.0
	ku.hurt(10.0, ku.global_position + Vector3(1, 0, 0))
	fails += _ok(not ku.alive and merc_state("kuvalda").is_empty() and party().size() == MAX_PARTY - 1 and not game.targets.has(ku), "Кувалда погиб: ушёл из отряда, у вербовщика снова вольный")
	game.disconnect("shot", _on_shot)
	# сохранение
	for a in party_actors():
		a.st["hp"] = minf(float(a.st["hp"]), a.max_hp)
	var saved = JSON.parse_string(JSON.stringify(save_data()))
	var sv: Array = saved.get("roster", []) if typeof(saved) == TYPE_DICTIONARY else []
	var n_out := 0
	var sh_wear := -1
	for m in sv:
		if bool(m.get("out", false)):
			n_out += 1
		if str(m.get("id", "")) == "shram":
			sh_wear = int(m.get("wear", -1))
	fails += _ok(sv.size() == ROOM_BEDS - 1 and n_out == MAX_PARTY - 1 and sh_wear == 0, "сохранение: нанятых %d, с героем %d, износ Шрама %d" % [sv.size(), n_out, sh_wear])
	# назад в стаб: уцелевшие у своих коек
	game.enter("stab", game.loc)
	await _wait(0.5)
	var at_home := 0
	for a in actors:
		var h := home_of(a.st)
		if not h.is_empty() and Vector2(a.global_position.x - h["pos"].x, a.global_position.z - h["pos"].z).length() < 0.6:
			at_home += 1
	fails += _ok(party().is_empty() and actors.size() == ROOM_BEDS - 1 and at_home == actors.size(), "в стабе уцелевшие у своих коек: %d" % at_home)
	# починка в комнате
	game.player.global_position = _room_point()
	await _wait(0.3)
	var s0 := spores()
	var rc := repair_cost(merc_state("shram"))
	fails += _ok(rc > 0 and repair("shram") and int(merc_state("shram")["wear"]) == durability("shram") and spores() == s0 - rc, "починка в комнате: %d сп., АК-74 Шрама как новый" % rc)
	# загрузка сохранения
	load_data(saved)
	fails += _ok(roster.size() == ROOM_BEDS - 1 and int(merc_state("shram").get("wear", -1)) == 0 and party().size() == MAX_PARTY - 1, "загрузка: нанятых %d, с героем %d" % [roster.size(), party().size()])
	game.enter("stab", null)
	await _wait(0.3)
	fails += _ok(party().is_empty() and actors.size() == ROOM_BEDS - 1, "после загрузки в стабе все у коек: %d" % actors.size())
	return fails
