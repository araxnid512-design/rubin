extends Node
## CraftSystem BunkerCore: ресурсы и добыча, мастерская, ремонт помещений, питание по помещениям, обмен.
## Данные — game/data/crafting.json:
##   items   — названия и описания вещей (ресурсы, оружие, патроны, расходники);
##   loot    — таблицы добычи для точек «обыскать» (BCInteract action "search", target = id таблицы):
##             rolls бросков, строки [вещь, шанс, мин, макс], refill_h — через сколько игровых часов снова полно,
##             room — нужна работающая комната, need — нужен инструмент (лом);
##   recipes — рецепты верстака (needs → gives, или repair — починить оружие в руке); верстаку нужно питание;
##   repairs — повреждённые помещения: что нужно для ремонта;
##   power   — комнаты на щитке и расход топлива: base + per_room за каждую включённую (% в игровой час);
##   trade   — обмен у торговца: pay (что отдать) → receive (что получить).

signal changed

const DATA := "res://game/data/crafting.json"

var data := {}
var repaired := {}        ## комната → true (починена)
var powered := {}         ## комната → включена ли на щитке


func _ready() -> void:
	if FileAccess.file_exists(DATA):
		var d = JSON.parse_string(FileAccess.get_file_as_string(DATA))
		if d is Dictionary:
			data = d
	new_game()


func new_game() -> void:
	repaired = {}
	powered = {}
	for r in data.get("power", {}).get("rooms", {}):
		powered[r] = true
	# повреждённые помещения стоят без света, пока не починены
	for r in data.get("repairs", {}):
		repaired[r] = false
	apply_power()
	changed.emit()


func item_name(id: String) -> String:
	var it = data.get("items", {}).get(id)
	if it:
		return it[0]
	if Core.hud and "ITEMS" in Core.hud and Core.hud.ITEMS.has(id):
		return Core.hud.ITEMS[id][0]
	return id


func item_desc(id: String) -> String:
	var it = data.get("items", {}).get(id)
	return it[1] if it else ""


func _need_text(needs: Dictionary) -> String:
	var parts := []
	var p = Core.player
	for k in needs:
		parts.append("%s %d/%d" % [item_name(k), p.count_item(k) if p else 0, int(needs[k])])
	return ", ".join(parts)


## чего не хватает (только недостающее)
func missing_text(needs: Dictionary) -> String:
	var parts := []
	for k in needs:
		var have: int = Core.player.count_item(k)
		if have < int(needs[k]):
			parts.append("%s ×%d" % [item_name(k), int(needs[k]) - have])
	return ", ".join(parts)


func has_all(needs: Dictionary) -> bool:
	var p = Core.player
	for k in needs:
		if p.count_item(k) < int(needs[k]):
			return false
	return true


func _take(needs: Dictionary) -> void:
	for k in needs:
		Core.player.inventory_remove(k, int(needs[k]))


func _give(gets: Dictionary) -> void:
	for k in gets:
		for i in int(gets[k]):
			Core.player.inventory_add(k)


# ---------------- обыск ----------------

## можно ли обыскать сейчас (полно ли), и сколько часов до наполнения
func search_ready(point: Node) -> bool:
	var t: Dictionary = data.get("loot", {}).get(point.target, {})
	var last: float = point.get_meta("searched_h", -1e9)
	return Core.player.game_time / 3600.0 - last >= float(t.get("refill_h", 48))


func search(point: Node) -> void:
	var t: Dictionary = data.get("loot", {}).get(point.target, {})
	var p = Core.player
	if t.is_empty():
		return
	if t.has("need") and p.count_item(t.need) < 1:
		Core.say("Заперто. Нужен %s." % item_name(t.need).to_lower(), "warn")
		Core.play_at("door_locked", point.global_position + Vector3.UP, -6.0)
		return
	if t.has("room") and not room_ok(t.room):
		Core.say("Здесь ничего не растёт: %s не работает." % data.power.rooms.get(t.room, t.room).to_lower(), "warn")
		return
	if not search_ready(point):
		Core.say("Пусто. Загляните позже.", "info")
		Core.play_at("search_empty", point.global_position + Vector3.UP * 0.6, -6.0)
		return
	point.set_meta("searched_h", p.game_time / 3600.0)
	var got := {}
	for r in int(t.get("rolls", 1)):
		for row in t.table:
			if randf() < float(row[1]):
				got[row[0]] = got.get(row[0], 0) + randi_range(int(row[2]), int(row[3]))
				break
	Core.play_at("search", point.global_position + Vector3.UP * 0.6, -4.0)
	if got.is_empty():
		Core.say("Ничего полезного.", "info")
	else:
		var parts := []
		for k in got:
			parts.append("%s ×%d" % [item_name(k), got[k]] if got[k] > 1 else item_name(k))
			for i in got[k]:
				p.inventory_add(k)
		Core.say("Найдено: " + ", ".join(parts), "good")
	Core.world.notify_state(point.point_id)
	if Core.quest:
		Core.quest.count_use("search_" + point.point_id)
	changed.emit()


# ---------------- верстак ----------------

func recipes() -> Array:
	var out := []
	for r in data.get("recipes", []):
		if r.has("shown_if") and Core.player.count_item(r.shown_if) < 1:
			continue
		out.append(r)
	return out


func recipe_needs_text(r: Dictionary) -> String:
	return _need_text(r.get("needs", {}))


## почему нельзя сделать (пусто — можно)
func craft_block(r: Dictionary) -> String:
	if not room_ok("work"):
		return "В мастерской нет питания"
	if r.get("repair", false):
		var w: String = Core.player.weapon
		if w == "" or w == "pistol":
			return "В руке нет оружия ближнего боя"
		if Core.player.weapon_dur.get(w, 0.0) >= BCWeapon.stats(w).get("dur", 100.0):
			return "Оружие цело"
	if not has_all(r.get("needs", {})):
		return "Не хватает: " + missing_text(r.needs)
	return ""


func craft(r: Dictionary) -> bool:
	var why := craft_block(r)
	if why != "":
		Core.say(why, "warn")
		return false
	_take(r.get("needs", {}))
	if r.get("repair", false):
		var w: String = Core.player.weapon
		Core.player.weapon_dur[w] = BCWeapon.stats(w).get("dur", 100.0)
		Core.say("Починено: " + BCWeapon.stats(w).n.to_lower() + ".", "good")
	else:
		_give(r.get("gives", {}))
		Core.say("Сделано: " + String(r.n) + ".", "good")
	Core.play_at(r.get("sound", "craft_metal"), Core.player.global_position + Vector3.UP, -3.0)
	if Core.quest:
		Core.quest.count_use("craft_" + String(r.id))
	changed.emit()
	return true


# ---------------- ремонт помещений ----------------

func room_broken(room: String) -> bool:
	return repaired.has(room) and not repaired[room]


## помещение работает: починено и запитано (и генератор работает)
func room_ok(room: String) -> bool:
	if room_broken(room):
		return false
	if Core.quest and not Core.quest.power:
		return false
	return powered.get(room, true)


func repair_info(room: String) -> Dictionary:
	return data.get("repairs", {}).get(room, {})


func repair(room: String) -> bool:
	var info := repair_info(room)
	if info.is_empty() or not room_broken(room):
		return false
	if not has_all(info.needs):
		Core.say("Не хватает: " + missing_text(info.needs), "warn")
		return false
	_take(info.needs)
	repaired[room] = true
	Core.play_at("repair", Core.player.global_position + Vector3.UP, -2.0)
	Core.say("Отремонтировано: " + String(info.n) + ".", "good")
	apply_power()
	get_tree().call_group("repair:" + room, "queue_free")
	if Core.quest:
		Core.quest.count_use("repair_" + room)
	changed.emit()
	return true


# ---------------- питание ----------------

func toggle_power(room: String) -> void:
	powered[room] = not powered.get(room, true)
	Core.play_ui("power_on" if powered[room] else "power_off", -4.0)
	apply_power()
	changed.emit()


func powered_count() -> int:
	var n := 0
	for r in powered:
		if powered[r] and not room_broken(r):
			n += 1
	return n


## расход топлива, % в игровой час
func fuel_rate() -> float:
	var pw: Dictionary = data.get("power", {})
	return float(pw.get("base", 0.15)) + float(pw.get("per_room", 0.07)) * powered_count()


## свет комнат: генератор работает, комната запитана и не сломана
func apply_power() -> void:
	if not is_inside_tree():
		return
	var gen_on: bool = Core.quest == null or Core.quest.power
	for l in get_tree().get_nodes_in_group("bc_light"):
		if not (l is Node3D) or l.global_position.y > -2.0 or not l.has_method("set_powered"):
			continue
		var g: String = l.group
		var on := gen_on
		if powered.has(g):
			on = on and powered[g] and not room_broken(g)
		l.set_powered(on)


# ---------------- обмен ----------------

func trades() -> Array:
	return data.get("trade", [])


func trade_text(t: Dictionary) -> String:
	var pay := []
	for k in t.pay:
		pay.append("%s ×%d" % [item_name(k), t.pay[k]])
	var rec := []
	for k in t.receive:
		rec.append("%s ×%d" % [item_name(k), t.receive[k]])
	return "%s → %s" % [", ".join(pay), ", ".join(rec)]


func trade(t: Dictionary) -> bool:
	if not has_all(t.pay):
		Core.say("Не хватает: " + missing_text(t.pay), "warn")
		return false
	_take(t.pay)
	_give(t.receive)
	Core.play_ui("trade", -4.0)
	Core.say("Обмен: " + trade_text(t), "good")
	changed.emit()
	return true


# ---------------- сохранение ----------------

func get_state() -> Dictionary:
	var searched := {}
	for id in Core.world.objects:
		var n = Core.world.objects[id]
		if n is BCInteract and n.action == "search" and n.has_meta("searched_h"):
			searched[id] = n.get_meta("searched_h")
	return {"repaired": repaired, "powered": powered, "searched": searched}


func set_state(s: Dictionary) -> void:
	if s.is_empty():
		return
	repaired = s.get("repaired", repaired)
	powered = s.get("powered", powered)
	for id in s.get("searched", {}):
		var n = Core.world.objects.get(id)
		if n:
			n.set_meta("searched_h", float(s.searched[id]))
	apply_power()
	for room in repaired:
		if repaired[room]:
			get_tree().call_group("repair:" + room, "queue_free")
	changed.emit()
