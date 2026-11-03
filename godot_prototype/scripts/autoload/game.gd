extends Node
## Состояние игры: инвентарь генерала, склад, здания, бойцы, флаги задания, мир, время.
## Сохранение/загрузка в user://save_N.json.

const L = preload("res://scripts/world/layout.gd")
const SAVE_VERSION := 2
const SLOTS := 3

var world: Node = null
var player: Node3D = null
var hud: Node = null

var inv := Inventory.new(16)
var equip := {}                 # {"primary": {"id","ammo"} | null, "pistol": {...} | null, "active": 0|1}
var quick: Array = ["bandage", "", "", ""]
var player_state := {}          # hp, stamina, rad, pos, yaw
var warehouse := {}             # id -> count
var buildings := {}             # id -> {"level", "job", "progress", "workers"}
var soldiers := {}              # id -> состояние бойца
var flags := {}
var world_state := {}
var time_of_day := 7.5
var day := 1
var power_on := false
var generator_fuel := 0.0       # часы работы
var quest := {}
var play_time := 0.0
var loaded_from_save := false

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	new_game_state()

# ------------------------------------------------------------------ новая игра
func new_game_state() -> void:
	inv = Inventory.new(16)
	inv.add("bandage", 2)
	inv.add("ammo_9x18", 16)
	equip = {"primary": null, "pistol": {"id": "pm", "ammo": 8}, "active": 1}
	quick = ["bandage", "", "", ""]
	player_state = {"hp": 100.0, "stamina": 100.0, "rad": 0.0, "pos": L.PLAYER_START, "yaw": L.PLAYER_START_YAW, "armor": "armor_duty"}
	warehouse = {"scrap": 2, "planks": 2, "provisions": 4}
	buildings = {}
	for b in L.BUILDINGS:
		buildings[b.id] = {"level": int(b.level), "job": "", "progress": 0.0}
	soldiers = {}
	for s in L.SOLDIERS:
		var w: Dictionary = ItemDB.weapon(s.weapon)
		var mag: int = int(w.get("mag", 0))
		soldiers[s.id] = {"hp": float(s.hp), "max_hp": 100.0, "weapon": s.weapon, "ammo": mag,
			"reserve": mag * (1 if s.role != "gunner" else 0), "order": "idle", "target": null, "pos": s.pos, "yaw": 0.0,
			"skill": 1.0, "supplied": false, "alive": true}
	flags = {}
	world_state = {"taken": {}, "containers": {}, "rubble": {}, "salvage": {}, "dead": {}, "doors": {}}
	time_of_day = 7.5
	day = 1
	power_on = false
	generator_fuel = 0.0
	quest = {}
	play_time = 0.0
	loaded_from_save = false

# ------------------------------------------------------------------ ресурсы
func warehouse_count(id: String) -> int:
	return int(warehouse.get(id, 0))

func warehouse_total() -> int:
	var t := 0
	for k in warehouse:
		t += int(warehouse[k])
	return t

func warehouse_capacity() -> int:
	var lvl := building_level("warehouse")
	return [300, 800, 2000][clampi(lvl, 0, 2)]

func warehouse_add(id: String, n: int) -> int:
	## Возвращает, сколько поместилось.
	var room := maxi(0, warehouse_capacity() - warehouse_total())
	var put := mini(n, room)
	if put > 0:
		warehouse[id] = warehouse_count(id) + put
		Events.warehouse_changed.emit()
	return put

func warehouse_remove(id: String, n: int) -> int:
	var take := mini(n, warehouse_count(id))
	if take > 0:
		warehouse[id] = warehouse_count(id) - take
		if warehouse[id] <= 0:
			warehouse.erase(id)
		Events.warehouse_changed.emit()
	return take

func total_count(id: String) -> int:
	return warehouse_count(id) + inv.count(id)

func can_afford(cost: Dictionary) -> bool:
	for k in cost:
		if total_count(k) < int(cost[k]):
			return false
	return true

func missing_for(cost: Dictionary) -> Dictionary:
	var m := {}
	for k in cost:
		var have := total_count(k)
		if have < int(cost[k]):
			m[k] = int(cost[k]) - have
	return m

func consume(cost: Dictionary) -> bool:
	if not can_afford(cost):
		return false
	for k in cost:
		var need := int(cost[k])
		need -= warehouse_remove(k, need)
		if need > 0:
			inv.remove(k, need)
	Events.inventory_changed.emit()
	return true

func deposit_resources() -> Dictionary:
	## Сдать на склад все ресурсы из рюкзака генерала.
	var moved := {}
	for id in ItemDB.RESOURCES:
		var n := inv.count(id)
		if n > 0:
			var put := warehouse_add(id, n)
			if put > 0:
				inv.remove(id, put)
				moved[id] = put
	if not moved.is_empty():
		Events.inventory_changed.emit()
	return moved

func give_player(id: String, n: int, extra: Dictionary = {}) -> int:
	## Положить предмет генералу. Оружие — в слот, если пусто. Возвращает остаток.
	if ItemDB.is_weapon(id):
		var slot := "pistol" if ItemDB.weapon_slot(id) == 1 else "primary"
		if equip.get(slot) == null:
			equip[slot] = {"id": id, "ammo": int(extra.get("ammo", 0))}
			Events.equipment_changed.emit()
			n -= 1
			if n <= 0:
				return 0
	var left := inv.add(id, n, extra)
	Events.inventory_changed.emit()
	return left

# ------------------------------------------------------------------ здания
func building_def(id: String) -> Dictionary:
	for b in L.BUILDINGS:
		if b.id == id:
			return b
	return {}

func building_level(id: String) -> int:
	return int(buildings.get(id, {}).get("level", 0))

func building_job(id: String) -> String:
	return String(buildings.get(id, {}).get("job", ""))

func building_progress(id: String) -> float:
	return float(buildings.get(id, {}).get("progress", 0.0))

func building_work_needed(id: String) -> float:
	var d := building_def(id)
	var job := building_job(id)
	return float(d.get("upgrade_work" if job == "upgrade" else "repair_work", 30.0))

func next_cost(id: String) -> Dictionary:
	var d := building_def(id)
	var lvl := building_level(id)
	if lvl == 0:
		return d.get("repair", {})
	if lvl == 1:
		return d.get("upgrade", {})
	return {}

func can_start_job(id: String) -> String:
	## Пустая строка — можно; иначе причина.
	var d := building_def(id)
	var lvl := building_level(id)
	if building_job(id) != "":
		return "Работы уже ведутся"
	if lvl >= 2:
		return "Здание полностью улучшено"
	if d.get("rubble", false) and not world_state.rubble.has(id):
		return "Вход завален — сначала разберите завал"
	if lvl == 0 and d.get("needs_power", false) and not power_on:
		return "Нет электропитания — восстановите генераторную"
	if not can_afford(next_cost(id)):
		return "Не хватает материалов"
	return ""

func start_job(id: String) -> bool:
	if can_start_job(id) != "":
		return false
	if not consume(next_cost(id)):
		return false
	var lvl := building_level(id)
	buildings[id]["job"] = "repair" if lvl == 0 else "upgrade"
	buildings[id]["progress"] = 0.0
	Events.building_changed.emit(id)
	Events.msg("%s: начаты работы (%s)." % [building_def(id).name, "ремонт" if lvl == 0 else "улучшение"], Events.Msg.INFO)
	return true

func add_work(id: String, amount: float) -> bool:
	## Добавляет работу; возвращает true, если работа завершена.
	if building_job(id) == "":
		return false
	buildings[id]["progress"] = building_progress(id) + amount
	if building_progress(id) >= building_work_needed(id):
		var job := building_job(id)
		buildings[id]["job"] = ""
		buildings[id]["progress"] = 0.0
		buildings[id]["level"] = building_level(id) + 1
		var name: String = building_def(id).name
		Events.msg("%s: %s!" % [name, "восстановлено" if job == "repair" else "улучшено"], Events.Msg.GOOD)
		Sfx.play("build_done")
		Events.building_changed.emit(id)
		_on_building_upgraded(id)
		return true
	return false

func _on_building_upgraded(id: String) -> void:
	if id == "generator" and building_level(id) >= 1:
		Events.msg("Генератор исправен. Нужно топливо — заправьте его на панели генераторной.", Events.Msg.INFO)
	if id == "barracks":
		Events.msg("Вместимость базы: %d бойцов." % soldier_capacity(), Events.Msg.GOOD)

func soldier_capacity() -> int:
	return [6, 12, 20][clampi(building_level("barracks"), 0, 2)]

func refuel_generator(units: int) -> int:
	var used := 0
	for i in units:
		if total_count("fuel") <= 0:
			break
		consume({"fuel": 1})
		generator_fuel += 8.0
		used += 1
	if used > 0:
		Events.msg("Генератор заправлен: +%d ч работы." % (used * 8), Events.Msg.GOOD)
		update_power()
	return used

func update_power() -> void:
	var on: bool = building_level("generator") >= 1 and generator_fuel > 0.0 and bool(flags.get("gen_switch", true))
	if on != power_on:
		power_on = on
		RenderingServer.global_shader_parameter_set("power_on", 1.0 if on else 0.0)
		Events.power_changed.emit(on)
		if on:
			Events.msg("Электроснабжение базы восстановлено.", Events.Msg.GOOD)
			Sfx.play("power_on")
		else:
			Events.msg("Электропитание отключено.", Events.Msg.ALERT)

func set_flag(f: String, v: Variant = true) -> void:
	flags[f] = v
	Events.flag_set.emit(f)

# ------------------------------------------------------------------ время
func advance_time(dt_hours: float) -> void:
	time_of_day += dt_hours
	if time_of_day >= 24.0:
		time_of_day -= 24.0
		day += 1
	if power_on:
		generator_fuel = maxf(0.0, generator_fuel - dt_hours)
		if generator_fuel <= 0.0:
			update_power()

func time_string() -> String:
	var h := int(time_of_day)
	var m := int((time_of_day - h) * 60.0)
	return "День %d, %02d:%02d" % [day, h, m]

func is_night() -> bool:
	return time_of_day < 6.0 or time_of_day > 20.5

# ------------------------------------------------------------------ сохранение
func save_path(slot: int) -> String:
	return "user://save_%d.json" % slot

func has_save(slot: int) -> bool:
	return FileAccess.file_exists(save_path(slot))

func slot_info(slot: int) -> String:
	if not has_save(slot):
		return "Пусто"
	var f := FileAccess.open(save_path(slot), FileAccess.READ)
	if f == null:
		return "Ошибка"
	var data = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_DICTIONARY:
		return "Повреждено"
	return "%s · %s" % [data.get("saved_at", "?"), data.get("summary", "")]

func latest_slot() -> int:
	var best := -1
	var best_t := 0
	for i in range(0, SLOTS + 1):
		if has_save(i):
			var t := FileAccess.get_modified_time(save_path(i))
			if t > best_t:
				best_t = t
				best = i
	return best

static func _v3(v: Vector3) -> Array:
	return [snappedf(v.x, 0.01), snappedf(v.y, 0.01), snappedf(v.z, 0.01)]

static func _to_v3(a: Variant) -> Vector3:
	if a is Vector3:
		return a
	if a is Array and (a as Array).size() >= 3:
		return Vector3(float(a[0]), float(a[1]), float(a[2]))
	return Vector3.ZERO

func collect_state() -> Dictionary:
	if player and is_instance_valid(player):
		player.write_state()
	if world and is_instance_valid(world):
		world.write_state()
	var ps := player_state.duplicate()
	ps.pos = _v3(_to_v3(ps.get("pos", Vector3.ZERO)))
	var sol := {}
	for id in soldiers:
		var s: Dictionary = soldiers[id].duplicate()
		s.pos = _v3(_to_v3(s.get("pos", Vector3.ZERO)))
		if s.get("target") is Vector3:
			s.target = _v3(s.target)
		sol[id] = s
	return {
		"version": SAVE_VERSION,
		"saved_at": Time.get_datetime_string_from_system(false, true),
		"summary": "%s · %s" % [time_string(), Quest.current_title() if has_node("/root/Quest") else ""],
		"inv": inv.to_data(), "equip": equip, "quick": quick, "player": ps,
		"warehouse": warehouse, "buildings": buildings, "soldiers": sol, "flags": flags,
		"world_state": world_state, "time": time_of_day, "day": day, "power_on": power_on,
		"fuel": generator_fuel, "quest": Quest.save_data(), "play_time": play_time,
	}

func save_game(slot: int) -> bool:
	var data := collect_state()
	var f := FileAccess.open(save_path(slot), FileAccess.WRITE)
	if f == null:
		Events.msg("Не удалось сохранить игру.", Events.Msg.ALERT)
		return false
	f.store_string(JSON.stringify(data, "\t"))
	f.close()
	Events.msg("Игра сохранена (%s)." % ("автосохранение" if slot == 0 else "слот %d" % slot), Events.Msg.GOOD)
	return true

func read_save(slot: int) -> Dictionary:
	if not has_save(slot):
		return {}
	var f := FileAccess.open(save_path(slot), FileAccess.READ)
	if f == null:
		return {}
	var data = JSON.parse_string(f.get_as_text())
	if typeof(data) != TYPE_DICTIONARY:
		return {}
	return data

func apply_save(data: Dictionary) -> void:
	new_game_state()
	inv.from_data(data.get("inv", []))
	equip = data.get("equip", equip)
	quick = data.get("quick", quick)
	player_state = data.get("player", player_state)
	player_state.pos = _to_v3(player_state.get("pos", L.PLAYER_START))
	warehouse = {}
	for k in data.get("warehouse", {}):
		warehouse[k] = int(data.warehouse[k])
	var bsave: Dictionary = data.get("buildings", {})
	for k in bsave:
		if buildings.has(k):
			buildings[k] = {"level": int(bsave[k].get("level", 0)), "job": String(bsave[k].get("job", "")), "progress": float(bsave[k].get("progress", 0.0))}
	var ssave: Dictionary = data.get("soldiers", {})
	for k in ssave:
		if soldiers.has(k):
			var s: Dictionary = ssave[k]
			s.pos = _to_v3(s.get("pos", Vector3.ZERO))
			if s.get("target") is Array:
				s.target = _to_v3(s.target)
			for key in ["ammo", "reserve"]:
				s[key] = int(s.get(key, 0))
			soldiers[k].merge(s, true)
	flags = data.get("flags", {})
	var ws: Dictionary = data.get("world_state", {})
	for k in world_state:
		if ws.has(k):
			world_state[k] = ws[k]
	time_of_day = float(data.get("time", 8.0))
	day = int(data.get("day", 1))
	generator_fuel = float(data.get("fuel", 0.0))
	power_on = false
	play_time = float(data.get("play_time", 0.0))
	Quest.load_data(data.get("quest", {}))
	loaded_from_save = true
