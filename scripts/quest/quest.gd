extends Node
## Задание «Возрождение Долга»: последовательность этапов с целями, диалоги, маркеры.

const L = preload("res://scripts/world/layout.gd")

const STAGES := [
	{"id": "arrive", "title": "Прибытие", "objs": [
		{"id": "reach_rally", "text": "Встретиться с бойцами у штаба", "kind": "area", "pos": Vector3(0, 0, -12), "r": 7.0}]},
	{"id": "hq", "title": "Штаб", "objs": [
		{"id": "inside_hq", "text": "Осмотреть штаб командования", "kind": "event", "event": "inside_hq", "pos": Vector3(0, 0, -36)}]},
	{"id": "damage", "title": "Осмотр повреждений", "objs": [
		{"id": "inspect_generator", "text": "Осмотреть генераторную", "kind": "flag", "flag": "inspect_generator", "pos": Vector3(-20, 0, -64.5)},
		{"id": "inspect_radio", "text": "Осмотреть радиоцентр", "kind": "flag", "flag": "inspect_radio", "pos": Vector3(18, 0, -64.5)},
		{"id": "inspect_armory", "text": "Осмотреть оружейную", "kind": "flag", "flag": "inspect_armory", "pos": Vector3(-53.5, 0, 2)}]},
	{"id": "officer", "title": "Доклад офицера", "objs": [
		{"id": "talk_officer", "text": "Поговорить с капитаном Рябовым", "kind": "flag", "flag": "talked_officer", "soldier": "s_officer"}]},
	{"id": "parts", "title": "Инструменты и детали", "objs": [
		{"id": "get_tools", "text": "Найти инструменты", "kind": "count", "item": "tools", "n": 1, "pos": Vector3(68, 0, -3)},
		{"id": "get_elec", "text": "Найти электронные компоненты", "kind": "count", "item": "electronics", "n": 3},
		{"id": "get_scrap", "text": "Собрать металлолом", "kind": "count", "item": "scrap", "n": 8}]},
	{"id": "deliver", "title": "Склад", "objs": [
		{"id": "deliver_wh", "text": "Сдать материалы на основной склад (панель склада)", "kind": "flag", "flag": "deposited", "pos": Vector3(55.5, 0, -44)}]},
	{"id": "power", "title": "Электроснабжение", "objs": [
		{"id": "gen_repair", "text": "Восстановить генераторную (панель → ремонт)", "kind": "building", "b": "generator", "lvl": 1, "pos": Vector3(-20, 0, -64.5)},
		{"id": "gen_fuel", "text": "Найти топливо и запустить генератор", "kind": "power", "pos": Vector3(-24.6, 0, -69.5)}]},
	{"id": "armory", "title": "Оружейная", "objs": [
		{"id": "armory_rubble", "text": "Разобрать завал у входа в оружейную", "kind": "rubble", "b": "armory", "pos": Vector3(-54.7, 0, 2)},
		{"id": "armory_cache", "text": "Обследовать оружейную: найти тайник", "kind": "event", "event": "open_armory_cache", "pos": Vector3(-68, 0, 4)}]},
	{"id": "kpp", "title": "Охрана КПП", "objs": [
		{"id": "arm_guards", "text": "Вооружить охрану КПП: 2 бойца (панель оружейной)", "kind": "kpp", "n": 2, "pos": Vector3(0, 0, 76)}]},
	{"id": "radio", "title": "Радиоцентр", "objs": [
		{"id": "radio_repair", "text": "Восстановить радиоцентр", "kind": "building", "b": "radio", "lvl": 1, "pos": Vector3(18, 0, -64.5)}]},
	{"id": "signal", "title": "Сигнал", "objs": [
		{"id": "radio_signal", "text": "Поймать сигнал выживших (панель радиоцентра)", "kind": "flag", "flag": "signal_received", "pos": Vector3(16.5, 0, -74.6)}]},
	{"id": "expedition", "title": "Подготовка экспедиции", "objs": [
		{"id": "exp_prep", "text": "Подготовить экспедицию в штабе (панель штаба)", "kind": "flag", "flag": "expedition_ready", "pos": Vector3(0, 0, -43.2)}]},
]

var stage := 0
var done := {}
var seen := {}
var finished := false
var log: Array = []
var _t := 0.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_PAUSABLE
	Events.area_visited.connect(func(id): seen[id] = true)

func reset() -> void:
	stage = 0
	done = {}
	seen = {}
	finished = false
	log = []

func current() -> Dictionary:
	return STAGES[mini(stage, STAGES.size() - 1)]

func current_title() -> String:
	if finished:
		return "Задание выполнено"
	return "«Возрождение Долга»: " + String(current().title)

func wants_inspect(id: String) -> bool:
	return stage >= 2 and not Game.flags.get(id, false)

func obj_done(o: Dictionary) -> bool:
	if done.get(o.id, false):
		return true
	match String(o.kind):
		"area":
			return Game.player != null and Game.player.global_position.distance_to(o.pos) < float(o.r)
		"event":
			return seen.get(o.event, false)
		"flag":
			return Game.flags.get(o.flag, false)
		"count":
			return Game.total_count(o.item) >= int(o.n) or Game.flags.get("parts_ok_" + String(o.item), false)
		"building":
			return Game.building_level(o.b) >= int(o.lvl)
		"power":
			return Game.power_on
		"rubble":
			return Game.world_state.rubble.has(o.b)
		"kpp":
			return kpp_guards() >= int(o.n)
	return false

func kpp_guards() -> int:
	var c := 0
	if Game.world == null:
		return 0
	for s in Game.world.soldiers.values():
		var so := s as Soldier
		if so and so.alive and so.supplied and so.order in ["guard", "defend"] and so.order_target is Vector3:
			var p: Vector3 = so.order_target
			if L.KPP_ZONE.has_point(Vector2(p.x, p.z)):
				c += 1
	return c

func obj_progress(o: Dictionary) -> String:
	if String(o.kind) == "count":
		return " (%d/%d)" % [mini(Game.total_count(o.item), int(o.n)), int(o.n)]
	if String(o.kind) == "kpp":
		return " (%d/%d)" % [kpp_guards(), int(o.n)]
	if String(o.kind) == "building" and Game.building_job(o.b) != "":
		return " — идёт ремонт %d%%" % int(Game.building_progress(o.b) / Game.building_work_needed(o.b) * 100.0)
	return ""

func objectives() -> Array:
	var out: Array = []
	if finished:
		return out
	for o in current().objs:
		out.append({"text": String(o.text) + obj_progress(o), "done": obj_done(o), "pos": o.get("pos"), "soldier": o.get("soldier", "")})
	return out

func marker() -> Variant:
	## Позиция ближайшей невыполненной цели (для стрелки и карты).
	if finished:
		return null
	for o in current().objs:
		if obj_done(o):
			continue
		if o.has("soldier") and Game.world and Game.world.soldiers.has(o.soldier):
			return (Game.world.soldiers[o.soldier] as Node3D).global_position
		if o.get("pos") != null:
			return o.pos
		if String(o.kind) == "count":
			return _nearest_container_with(String(o.item))
	return null

func _nearest_container_with(item: String) -> Variant:
	if Game.player == null or Game.world == null:
		return null
	var best: Variant = null
	var bd := INF
	for c in Game.world.objects_root.get_children():
		if c is LootContainer and (c as LootContainer).items.has(item):
			var d := (c as Node3D).global_position.distance_to(Game.player.global_position)
			if d < bd:
				bd = d
				best = (c as Node3D).global_position
		elif c is Salvage and (c as Salvage).res_id == item:
			var d2 := (c as Node3D).global_position.distance_to(Game.player.global_position)
			if d2 < bd:
				bd = d2
				best = (c as Node3D).global_position
	return best

func _process(delta: float) -> void:
	if Game.world == null or finished:
		return
	_t -= delta
	if _t > 0.0:
		return
	_t = 0.4
	var all := true
	for o in current().objs:
		if obj_done(o):
			if not done.get(o.id, false):
				done[o.id] = true
				Events.objective_done.emit(String(o.text))
				Events.msg("Выполнено: " + String(o.text), Events.Msg.GOOD)
				Sfx.play("ui_ok")
		else:
			all = false
	if all:
		_advance()

func _advance() -> void:
	var finished_id := String(current().id)
	stage += 1
	_on_stage_complete(finished_id)
	if stage >= STAGES.size():
		finished = true
		stage = STAGES.size() - 1
		Events.msg("Задание «Возрождение Долга» выполнено!", Events.Msg.GOOD)
	else:
		Events.msg("Новая цель: " + String(current().title), Events.Msg.INFO)
		_on_stage_start(String(current().id))
	Events.quest_updated.emit()
	if Game.world and stage > 0:
		Game.save_game(0)

func _on_stage_complete(id: String) -> void:
	match id:
		"arrive":
			Events.ui_open.emit("dialog", "arrival")
		"parts":
			for it in ["tools", "electronics", "scrap"]:
				Game.flags["parts_ok_" + it] = true
		"signal":
			Game.set_flag("expedition_unlocked")
		"expedition":
			Events.ui_open.emit("dialog", "finale")

func _on_stage_start(id: String) -> void:
	match id:
		"officer":
			if Game.world and Game.world.soldiers.has("s_officer"):
				var o: Soldier = Game.world.soldiers.s_officer
				if o.alive:
					o.give_order("idle")
		"power":
			Events.msg("Подсказка: откройте панель генераторной и начните ремонт. Работать можно самому (удерживать «Действие» у входа) или назначить техника.", Events.Msg.INFO)
		"kpp":
			Events.msg("Подсказка: в панели оружейной выдайте бойцам патроны и назначьте их на охрану КПП.", Events.Msg.INFO)

func add_log(text: String) -> void:
	log.append({"day": Game.day, "time": Game.time_string(), "text": text})

# ------------------------------------------------------------------ диалоги
func get_dialog(id: String) -> Array:
	## Последовательность реплик: {"who", "text", "options": [{"text", "next" | "action"}]}
	match id:
		"intro":
			return [
				{"who": "", "text": "Зона отчуждения. Район Ростока.\n\nПосле внезапного нападения группировка «Долг» почти уничтожена: бойцы погибли или пропали, техника потеряна, склады разграблены.\n\nГенерал возвращается на разрушенную базу с небольшой группой выживших."},
			]
		"arrival":
			return [
				{"who": "Сержант Захаров «Гром»", "text": "Товарищ генерал! Живой… Мы уж и не надеялись. Здесь все, кто остался — шесть человек."},
				{"who": "Генерал", "text": "Вольно, бойцы. Сначала осмотрюсь в штабе. Потом — доклад."},
			]
		"officer":
			return [
				{"who": "Капитан Рябов", "text": "Товарищ генерал, докладываю. База разрушена примерно на семьдесят процентов. Генераторная разбита, радиоцентр без питания, вход в оружейную завалило при обстреле.",
					"options": [{"text": "Что с личным составом?", "next": 1}, {"text": "С чего начинаем?", "next": 2}]},
				{"who": "Капитан Рябов", "text": "Шесть человек вместе со мной. Кравец ранен, но держится. Остальные погибли или пропали без вести. Связи ни с кем нет.",
					"options": [{"text": "С чего начинаем?", "next": 2}]},
				{"who": "Капитан Рябов", "text": "Свет и связь. Без генератора не поднять радиоцентр, а без радио своих не найти. Нужны инструменты, электроника и металл. Ищите в мастерской, в разбитой технике и за периметром — но там слепые псы, зомбированные и мародёры. Найденное сдавайте на склад.",
					"options": [{"text": "Приступаем. Выполнять!", "action": "talked_officer"}]},
			]
		"signal":
			return [
				{"who": "Радиоэфир", "text": "…ш-ш-ш… говорит сержант Ковалёв… отряд «Долга»… нас пятеро, двое ранены… держимся у старого депо на Свалке… мародёры прижали… боеприпасы на исходе… кто слышит — приём…"},
				{"who": "Генерал", "text": "Ковалёв, слышу тебя. Это база. Держитесь — готовим выход к вам.",
					"options": [{"text": "Конец связи.", "action": "signal_received"}]},
			]
		"finale":
			return [
				{"who": "Капитан Рябов", "text": "Экспедиция готова к выходу, товарищ генерал. Маршрут — через южные ворота, на Свалку, к старому депо."},
				{"who": "", "text": "Первый этап завершён: база частично восстановлена, электроснабжение и связь работают, найден выживший отряд.\n\nСледующая локация («Свалка») будет создана после подтверждения."},
			]
	return []

func dialog_action(action: String) -> void:
	if action == "":
		return
	Game.set_flag(action)
	if action == "signal_received":
		add_log("Сигнал отряда сержанта Ковалёва: Свалка, старое депо. Пятеро, двое ранены.")
	if action == "talked_officer":
		add_log("Доклад капитана Рябова: нужны свет и связь — генераторная и радиоцентр.")

# ------------------------------------------------------------------ сохранение
func save_data() -> Dictionary:
	return {"stage": stage, "done": done, "seen": seen, "finished": finished, "log": log}

func load_data(d: Dictionary) -> void:
	reset()
	stage = int(d.get("stage", 0))
	done = d.get("done", {})
	seen = d.get("seen", {})
	finished = bool(d.get("finished", false))
	log = d.get("log", [])
