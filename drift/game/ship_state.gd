extends Node
## Состояние корабля «Дрейфа»: ресурсы (металл, электроника, энергоячейки, топливо), прочность корпуса,
## кислород, реактор и распределение энергии по системам, построенные дроны и турели. Окно «Корабль» —
## энергия по системам (+/−), ресурсы, корпус и кислород; мастерская — сборка по рецептам.

signal changed

var data := {}
var res := {}                 ## ресурсы
var hull := 100.0
var oxygen := 100.0
var reactor := 8              ## всего единиц энергии
var power := {}               ## система → выделено единиц
var drones: Array = []        ## узлы дронов
var turrets: Array = []       ## узлы турелей


func _ready() -> void:
	Core.set_meta("shipst", self)
	data = JSON.parse_string(FileAccess.get_file_as_string("res://game/data/ship_systems.json"))
	var st: Dictionary = data.start
	for k in ["metal", "electronics", "cells", "fuel"]:
		res[k] = int(st[k])
	hull = st.hull
	oxygen = st.oxygen
	reactor = int(st.reactor)
	for s in data.systems:
		power[s] = int(data.systems[s].start)
	Core.save.register("ship", self)


func used() -> int:
	var n := 0
	for s in power:
		n += int(power[s])
	return n


func free_power() -> int:
	return reactor - used()


func powered(sys: String) -> bool:
	return int(power.get(sys, 0)) > 0


func set_power(sys: String, delta: int) -> void:
	var sd: Dictionary = data.systems[sys]
	if sd.get("fixed", false):
		return
	var v := clampi(int(power[sys]) + delta, int(sd.min), int(sd.max))
	if delta > 0 and free_power() < v - int(power[sys]):
		Core.say("Не хватает энергии реактора.", "warn")
		return
	power[sys] = v
	Core.play_ui("power_on" if delta > 0 else "power_off", -8.0)
	changed.emit()


func res_name(k: String) -> String:
	return data.res_names.get(k, k)


func has_all(needs: Dictionary) -> bool:
	for k in needs:
		if int(res.get(k, 0)) < int(needs[k]):
			return false
	return true


func needs_text(needs: Dictionary) -> String:
	var parts := []
	for k in needs:
		parts.append("%s %d/%d" % [res_name(k), int(res.get(k, 0)), int(needs[k])])
	return ", ".join(parts)


func take(needs: Dictionary) -> void:
	for k in needs:
		res[k] = int(res.get(k, 0)) - int(needs[k])
	changed.emit()


func add(k: String, n: int) -> void:
	res[k] = int(res.get(k, 0)) + n
	changed.emit()


var _lost := false


func damage_hull(v: float) -> void:
	hull = maxf(0.0, hull - v)
	changed.emit()
	if hull <= 0.0 and not _lost:
		_lost = true
		Core.say("Корпус разрушен!", "bad")
		if Core.has_meta("ship_lost"):
			Core.get_meta("ship_lost").call()


func status_text() -> String:
	return "Корпус %d%% · O₂ %d%% · Энергия %d/%d\nМеталл %d · Электр. %d · Ячейки %d · Топливо %d" % [roundi(hull), roundi(oxygen), used(), reactor,
		res.metal, res.electronics, res.cells, res.fuel]


func _process(delta: float) -> void:
	# кислород: без жизнеобеспечения или при пробитом корпусе убывает
	var leak := 0.0 if hull > 30.0 else (30.0 - hull) * 0.02
	if not powered("life"):
		leak += 0.4
	leak += get_tree().get_nodes_in_group("repairable").size() * 0.5
	oxygen = clampf(oxygen + (0.6 - leak) * delta if leak == 0.0 else oxygen - leak * delta, 0.0, 100.0)
	if oxygen <= 0.0 and Core.player and Core.player.alive():
		Core.player.damage(4.0 * delta)


# ---------------- окна ----------------

func show_panel() -> void:
	var rows := []
	for s in data.systems:
		var sd: Dictionary = data.systems[s]
		var p := int(power[s])
		var bar := "■".repeat(p) + "□".repeat(int(sd.max) - p)
		rows.append(["%s  %s" % [sd.n, bar], "−", func():
			set_power(s, -1)
			show_panel(), not sd.get("fixed", false) and p > int(sd.min), "+", func():
			set_power(s, 1)
			show_panel(), not sd.get("fixed", false) and p < int(sd.max) and free_power() > 0])
	var mk: int = Core.player.count_item("medkit") if Core.player else 0
	rows.append(["Аптечки: %d (+40 здоровья)" % mk, "Лечить", func():
		if Core.player.count_item("medkit") > 0 and Core.player.hp < Core.player.max_hp:
			Core.player.inventory_remove("medkit")
			Core.player.hp = minf(Core.player.max_hp, Core.player.hp + 40.0)
			Core.play_ui("heal", -4.0)
		show_panel(), mk > 0])
	Core.hud.rows2("Корабль «Странник»", "Корпус %d%% · Кислород %d%% · Реактор: свободно %d из %d\nМеталл %d · Электроника %d · Энергоячейки %d · Топливо %d · Дронов %d · Турелей %d" % [
		roundi(hull), roundi(oxygen), free_power(), reactor, res.metal, res.electronics, res.cells, res.fuel, drones.size(), turrets.size()], rows)


func show_workshop() -> void:
	if not powered("workshop"):
		Core.hud.show_text("Мастерская", "Мастерская без энергии. Выделите ей единицу реактора в окне «Корабль».")
		return
	var rows := []
	for b in data.builds:
		var ok := has_all(b.needs)
		rows.append(["%s — %s\n   нужно: %s" % [b.n, b.d, needs_text(b.needs)], "Собрать", func():
			if build(b):
				show_workshop(), ok])
	Core.hud.rows("Мастерская: сборка", "Есть: металл %d, электроника %d, ячейки %d" % [res.metal, res.electronics, res.cells], rows)


func build(b: Dictionary) -> bool:
	if not has_all(b.needs):
		return false
	take(b.needs)
	Core.play_at("craft_metal", Core.player.global_position, -4.0)
	match String(b.id):
		"drone_worker", "drone_combat":
			Core.get_meta("spawn_drone").call(b.id)
			Core.say("Собран: %s." % b.n, "good")
		"turret_gun", "turret_laser":
			if not Core.get_meta("place_turret").call(b.id, Core.player.global_position):
				for k in b.needs:
					add(k, int(b.needs[k]))
				return false
			Core.say("Установлена: %s." % b.n, "good")
		"medkit":
			Core.player.inventory_add("medkit")
			Core.say("Аптечка — в вещах.", "good")
		"repair_hull":
			hull = minf(100.0, hull + 20.0)
			Core.say("Корпус залатан: %d%%." % roundi(hull), "good")
	changed.emit()
	return true


func get_state() -> Dictionary:
	var ds := []
	for d in drones:
		if is_instance_valid(d):
			ds.append({"kind": d.kind, "order": d.order, "hp": d.hp})
	var ts := []
	for t in turrets:
		if is_instance_valid(t):
			ts.append({"kind": t.kind, "pos": [t.position.x, t.position.y]})
	return {"res": res, "hull": hull, "oxygen": oxygen, "reactor": reactor, "power": power, "drones": ds, "turrets": ts}


func set_state(s: Dictionary) -> void:
	res = s.get("res", res)
	hull = s.get("hull", hull)
	oxygen = s.get("oxygen", oxygen)
	reactor = int(s.get("reactor", reactor))
	power = s.get("power", power)
	for d in drones:
		if is_instance_valid(d):
			d.queue_free()
	drones.clear()
	for t in turrets:
		if is_instance_valid(t):
			t.queue_free()
	turrets.clear()
	for d in s.get("drones", []):
		var n: Node = Core.get_meta("spawn_drone").call(d.kind)
		if n:
			n.order = d.order
			n.hp = d.hp
	for t in s.get("turrets", []):
		Core.get_meta("place_turret").call(t.kind, Vector2(t.pos[0], t.pos[1]), true)
	changed.emit()
