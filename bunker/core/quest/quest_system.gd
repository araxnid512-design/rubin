extends Node
## QuestSystem BunkerCore: задания, журнал, ресурсы убежища и «точки использования» (бак генератора,
## вентустановка, склад, бак с водой). Содержимое — в JSON (game/data/quests.json), код — общий.
##
## Задание: giver (id жителя), title, offer (что говорит житель, предлагая), remind (напоминание), done (слова
## после выполнения), steps (по порядку), reward (действия). Шаги:
##   talk — поговорить с жителем `npc`;
##   item — иметь в вещах `count` предметов `item`;
##   use  — использовать точку `use` `count` раз;
##   kill — победить `count` врагов вида `kind`.
## У шага `markers` — id объектов мира (точки, жители): над ближайшим висит метка, она же — на мини-карте.
## Состояния: available (житель предложит) → active → done. Действия награды и точек: give / take предмет,
## res (ресурс убежища: add / set), stat (сытость, вода, здоровье, доза), start (новое задание), say.

signal changed

const DATA := "res://game/data/quests.json"
const RES_MAX := {"fuel": 100.0, "filters": 100.0}

var data := {}
var quests := {}          ## id → {state, step, n}
var res := {}             ## fuel (%), filters (%)
var tracked := ""
var power := true
var _marker: Node3D
var _gt := -1.0           ## игровое время последнего пересчёта ресурсов
var _warned := {}
var _t := 0.0


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	if FileAccess.file_exists(DATA):
		var d = JSON.parse_string(FileAccess.get_file_as_string(DATA))
		if d is Dictionary:
			data = d
	if data.is_empty():
		push_warning("QuestSystem: нет данных " + DATA)


## метка цели в мире: перевёрнутый конус над предметом или жителем
func attach(root: Node3D) -> void:
	_marker = MeshInstance3D.new()
	_marker.name = "QuestMarker"
	var cm := CylinderMesh.new()
	cm.top_radius = 0.2
	cm.bottom_radius = 0.0
	cm.height = 0.42
	cm.radial_segments = 4
	cm.rings = 1
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.78, 0.25)
	m.no_depth_test = true
	m.render_priority = 10
	cm.material = m
	_marker.mesh = cm
	_marker.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_marker.visible = false
	_marker.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	root.add_child(_marker)


func new_game() -> void:
	quests = {}
	for id in data.get("start", []):
		quests[id] = {"state": "available", "step": 0, "n": 0}
	res = (data.get("resources", {}) as Dictionary).duplicate()
	tracked = ""
	_warned = {}
	_gt = -1.0
	_set_power(res.get("fuel", 100.0) > 0.0)
	changed.emit()


func qdef(id: String) -> Dictionary:
	return data.get("quests", {}).get(id, {})


func step_of(id: String) -> Dictionary:
	var q: Dictionary = quests.get(id, {})
	var st: Array = qdef(id).get("steps", [])
	var i: int = q.get("step", 0)
	return st[i] if i < st.size() else {}


func active() -> Array:
	var out := []
	for id in quests:
		if quests[id].state == "active":
			out.append(id)
	return out


func _npc_name(npc_id: String) -> String:
	var n = Core.world.objects.get(npc_id)
	return n.display_name if n and "display_name" in n else npc_id


# ---------------- разговор ----------------

## житель `npc_id` заговорил: сдать шаг, предложить задание или напомнить; false — заданий нет, своя реплика
func talk(npc_id: String) -> bool:
	var who := _npc_name(npc_id)
	for id in active():
		var s := step_of(id)
		if s.get("type") == "talk" and s.get("npc") == npc_id:
			var last: bool = quests[id].step == qdef(id).get("steps", []).size() - 1
			var text: String = s.get("say", qdef(id).get("done", "") if last else "")
			_advance(id)
			var next := offer_from(npc_id)
			if next != "":
				Core.hud.show_dialog(who, text, [["Дальше", _offer.bind(next, who)]])
			else:
				Core.hud.show_dialog(who, text, [])
			return true
	var off := offer_from(npc_id)
	if off != "":
		_offer(off, who)
		return true
	for id in active():
		if qdef(id).get("giver") == npc_id:
			Core.hud.show_dialog(who, qdef(id).get("remind", step_of(id).get("text", "")), [])
			return true
	return false


func offer_from(npc_id: String) -> String:
	for id in quests:
		if quests[id].state == "available" and qdef(id).get("giver") == npc_id:
			return id
	return ""


func _offer(id: String, who: String) -> void:
	var d := qdef(id)
	Core.hud.show_dialog(who + " · " + d.get("title", ""), d.get("offer", ""),
		[[d.get("accept", "Возьмусь"), _accept_dialog.bind(id)], ["Потом", Core.hud.close_modal]])


func _accept_dialog(id: String) -> void:
	Core.hud.close_modal()
	accept(id)


func accept(id: String) -> void:
	if not quests.has(id):
		quests[id] = {"state": "available", "step": 0, "n": 0}
	quests[id].state = "active"
	quests[id].step = 0
	quests[id].n = 0
	tracked = id
	Core.say("Новое задание: " + qdef(id).get("title", id), "warn")
	Core.play_ui("quest_new")
	_check(id)
	changed.emit()


func _advance(id: String) -> void:
	quests[id].step += 1
	quests[id].n = 0
	if quests[id].step >= qdef(id).get("steps", []).size():
		_complete(id)
	else:
		_check(id)
	changed.emit()


func _complete(id: String) -> void:
	quests[id].state = "done"
	Core.say("Задание выполнено: " + qdef(id).get("title", id), "good")
	Core.play_ui("quest_done", -3.0)
	for e in qdef(id).get("reward", []):
		apply_effect(e)
	if tracked == id:
		var a := active()
		tracked = a[0] if not a.is_empty() else ""


## шаг «иметь предмет» выполняется сам, как только предметов достаточно
func _check(id: String) -> void:
	if quests.get(id, {}).get("state") != "active":
		return
	var s := step_of(id)
	if s.get("type") == "item" and Core.player and Core.player.count_item(s.item) >= int(s.get("count", 1)):
		_advance(id)


func on_inventory() -> void:
	for id in active():
		_check(id)
	changed.emit()


func on_kill(kind: String) -> void:
	for id in active():
		var s := step_of(id)
		if s.get("type") == "kill" and s.get("kind") == kind:
			quests[id].n += 1
			if quests[id].n >= int(s.get("count", 1)):
				_advance(id)
	changed.emit()


# ---------------- точки использования ----------------

func udef(use_id: String) -> Dictionary:
	return data.get("uses", {}).get(use_id, {})


func use_label(use_id: String) -> String:
	var u := udef(use_id)
	var l: String = u.get("label", use_id)
	if u.has("show"):
		l += " (%s)" % _fmt_res(u.show)
	return l


func use_verb(use_id: String) -> String:
	return udef(use_id).get("verb", "Действие")


func use_anim(use_id: String) -> String:
	return udef(use_id).get("anim", "inspect")


func use(use_id: String, p: Node) -> void:
	var u := udef(use_id)
	var need: String = u.get("need", "")
	if need != "" and p.count_item(need) < 1:
		Core.say(u.get("missing", "Нужно: " + need), "warn")
		return
	var skip: Dictionary = u.get("skip_if", {})
	if not skip.is_empty() and float(p.get(skip.stat)) >= float(skip.above):
		Core.say(skip.get("say", "Сейчас не нужно."), "info")
		return
	if u.has("room") and Core.craft and not Core.craft.room_ok(u.room):
		Core.say(u.get("no_room", "Не работает: нет питания или нужен ремонт."), "warn")
		return
	if u.has("res_min"):
		var rm: Dictionary = u.res_min
		if float(res.get(rm.res, 0.0)) < float(rm.value):
			Core.say(rm.get("say", "Запас кончился."), "bad")
			return
	if need != "":
		p.inventory_remove(need, 1)
	for e in u.get("effects", []):
		apply_effect(e)
	if u.has("say"):
		Core.say(String(u.say).format(_res_view()), "good")
	if u.has("sound") and p is Node3D:
		Core.play_at(u.sound, p.global_position + Vector3.UP, -4.0)
	if u.has("dialog"):
		Core.hud.show_dialog(u.get("label", use_id), String(u.dialog), [])
	count_use(use_id)


## шаг «использовать / сделать / починить» засчитывается (вызывают точки, верстак, ремонт)
func count_use(use_id: String) -> void:
	for id in active():
		var s := step_of(id)
		if s.get("type") == "use" and s.get("use") == use_id:
			quests[id].n += 1
			if quests[id].n >= int(s.get("count", 1)):
				_advance(id)
	changed.emit()


func apply_effect(e: Dictionary) -> void:
	var p = Core.player
	if e.has("give") and p:
		for i in int(e.get("count", 1)):
			p.inventory_add(e.give)
	if e.has("take") and p:
		p.inventory_remove(e.take, int(e.get("count", 1)))
	if e.has("res"):
		var k: String = e.res
		var v: float = float(e.set) if e.has("set") else float(res.get(k, 0.0)) + float(e.get("add", 0.0))
		res[k] = clampf(v, 0.0, RES_MAX.get(k, 1e9))
		if k == "fuel":
			_warned.erase("fuel")
			_set_power(res.fuel > 0.0)
	if e.has("stat") and p:
		var cur: float = float(p.get(e.stat))
		var mx: float = p.max_hp if e.stat == "hp" else (1e9 if e.stat == "dose" else 100.0)
		p.set(e.stat, clampf(cur + float(e.get("add", 0.0)), 0.0, mx))
		p.stats_changed.emit()
	if e.has("start") and not quests.has(e.start):
		quests[e.start] = {"state": "available", "step": 0, "n": 0}
	if e.has("say"):
		Core.say(e.say, "info")


func _res_view() -> Dictionary:
	return {"fuel": "%d%%" % roundi(res.get("fuel", 0.0)), "food": "%.1f" % res.get("food", 0.0),
		"water": "%d" % roundi(res.get("water", 0.0)), "filters": "%d%%" % roundi(res.get("filters", 0.0))}


func _fmt_res(k: String) -> String:
	return {"fuel": "топливо %s", "food": "запас %s сут.", "water": "вода %s л", "filters": "фильтры %s"}.get(k, "%s") % _res_view().get(k, "")


# ---------------- время, ресурсы, питание ----------------

func _process(delta: float) -> void:
	var p = Core.player
	if p == null or data.is_empty():
		return
	if _gt < 0.0:
		_gt = p.game_time
	var dh: float = (p.game_time - _gt) / 3600.0
	if dh > 0.02:
		_gt = p.game_time
		var r: Dictionary = data.get("rates", {})
		for k in r:
			if res.has(k):
				var rate := float(r[k])
				# топливо — по нагрузке: сколько помещений запитано на щитке
				if k == "fuel" and Core.craft:
					rate = Core.craft.fuel_rate()
				res[k] = maxf(0.0, float(res[k]) - rate * dh)
		if res.get("fuel", 1.0) <= 0.0 and power:
			_set_power(false)
			Core.say("Генератор заглох: кончилось топливо. Свет и медоборудование не работают.", "bad")
		elif res.get("fuel", 0.0) < 10.0 and power and not _warned.has("fuel"):
			_warned["fuel"] = true
			Core.say("Топливо генератора на исходе — меньше 10%.", "warn")
	_t += delta
	if _t > 0.5:
		_t = 0.0
		changed.emit()
	_update_marker(delta)


func _set_power(v: bool) -> void:
	power = v
	if Core.craft:
		Core.craft.apply_power()
		return
	for l in get_tree().get_nodes_in_group("bc_light"):
		if l is Node3D and l.global_position.y < -2.0 and l.has_method("set_powered"):
			l.set_powered(v)


# ---------------- метка цели ----------------

## точка, куда вести игрока: текущий шаг отслеживаемого задания или житель с новым заданием
func marker_pos() -> Vector3:
	var ids: Array = []
	if tracked != "" and quests.get(tracked, {}).get("state") == "active":
		var s := step_of(tracked)
		ids = s.get("markers", [])
		if s.get("type") == "talk":
			ids = [s.npc]
	else:
		for id in quests:
			if quests[id].state == "available":
				ids = [qdef(id).get("giver", "")]
				break
	var best := Vector3.INF
	var bd := 1e9
	for oid in ids:
		var n = Core.world.objects.get(oid)
		if n == null or not is_instance_valid(n) or not (n is Node3D):
			continue
		if n is BCInteract and n.action == "pickup" and n.used:
			continue
		var d: float = (n as Node3D).global_position.distance_to(Core.player.global_position)
		if d < bd:
			bd = d
			best = (n as Node3D).global_position
	return best


func _update_marker(delta: float) -> void:
	if _marker == null:
		return
	var mp := marker_pos()
	var under: bool = Core.world.underground
	_marker.visible = mp != Vector3.INF and (mp.y < -2.0) == under and mp.distance_to(Core.player.global_position) < 60.0
	if _marker.visible:
		_marker.rotation.y += delta * 2.0
		_marker.global_position = mp + Vector3(0, 2.3 + sin(Time.get_ticks_msec() * 0.004) * 0.12, 0)


## строка на экране: что делать сейчас
func tracker_text() -> String:
	if tracked != "" and quests.get(tracked, {}).get("state") == "active":
		var s := step_of(tracked)
		var prog := ""
		var c := int(s.get("count", 1))
		if s.get("type") == "item" and c > 1:
			prog = " (%d/%d)" % [mini(Core.player.count_item(s.item), c), c]
		elif s.get("type") in ["use", "kill"] and c > 1:
			prog = " (%d/%d)" % [quests[tracked].n, c]
		return "%s\n▸ %s%s" % [qdef(tracked).get("title", ""), s.get("text", ""), prog]
	for id in quests:
		if quests[id].state == "available":
			return "Есть разговор\n▸ Поговорить: " + _npc_name(qdef(id).get("giver", ""))
	return ""


# ---------------- сохранение ----------------

func get_state() -> Dictionary:
	return {"q": quests, "res": res, "tracked": tracked}


func set_state(s: Dictionary) -> void:
	if s.is_empty():
		return
	quests = s.get("q", quests)
	for id in quests:
		quests[id].step = int(quests[id].step)
		quests[id].n = int(quests[id].n)
	res = s.get("res", res)
	tracked = s.get("tracked", "")
	_gt = -1.0
	_set_power(float(res.get("fuel", 100.0)) > 0.0)
	changed.emit()
