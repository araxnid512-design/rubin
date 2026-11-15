extends Node2D
## Главная сцена «Дрейфа»: космос, корабль, герой, камера, интерфейс, состояние корабля, цикл и события.
## Здесь же — создание дронов, турелей и врагов (через Core.get_meta: spawn_drone / place_turret / spawn_enemy)
## и действия пультов корабля. Автотесты: --st-test=<режим>.

var world: Node2D
var ysort: Node2D
var ship: STShip
var hero: STHero
var hud: STHud
var cam: Camera2D
var shipst: Node
var events: Node
var loop: Node


func _ready() -> void:
	var sf := STStarfield.new()
	add_child(sf)
	Core.set_meta("starfield", sf)
	world = Node2D.new()
	world.name = "World"
	add_child(world)
	ship = STShip.new()
	ship.name = "Ship"
	world.add_child(ship)
	ysort = Node2D.new()
	ysort.name = "YSort"
	ysort.y_sort_enabled = true
	world.add_child(ysort)
	Core.ship = ship
	var data = JSON.parse_string(FileAccess.get_file_as_string("res://game/data/ship_start.json"))
	ship.build(data, ysort)
	_props(data.get("props", []))
	var cm := CanvasModulate.new()
	cm.color = Color(0.5, 0.53, 0.62)
	add_child(cm)
	shipst = load("res://game/ship_state.gd").new()
	shipst.name = "ShipState"
	add_child(shipst)
	Core.set_meta("spawn_drone", spawn_drone)
	Core.set_meta("place_turret", place_turret)
	Core.set_meta("spawn_enemy", spawn_enemy)
	Core.set_meta("ship_lost", _ship_lost)
	hero = STHero.new()
	hero.name = "Hero"
	hero.color = Color(0.95, 0.55, 0.2)
	hero.sprite_dir = _sprites("hero")
	ysort.add_child(hero)
	hero.global_position = ship.room_center("bridge") + Vector2(-60, 40)
	hero.reset_physics_interpolation()
	hero.died.connect(_hero_died)
	cam = Camera2D.new()
	cam.zoom = Vector2(1.15, 1.15)
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 6.0
	hero.add_child(cam)
	cam.offset = Vector2(0, -40)
	hud = STHud.new()
	add_child(hud)
	hud.bind_player(hero)
	loop = load("res://game/loop.gd").new()
	loop.name = "Loop"
	add_child(loop)
	events = load("res://game/events.gd").new()
	events.name = "Events"
	add_child(events)
	_ambient()
	if Core.test_mode == "" and Core.save.has_save() and Core.save.load_game():
		Core.say("Сектор %d. Продолжаем дрейф." % loop.sector, "info")
	else:
		_new_game()
	if Core.test_mode != "":
		var tr: Node = load("res://tools/test_runner.gd").new()
		tr.name = "TestRunner"
		add_child(tr)


## гул корабля — бесшовный цикл
func _ambient() -> void:
	var st: AudioStream = Core.sfx("amb_ship")
	if st == null:
		return
	if "loop" in st:
		st.loop = true
	var p := AudioStreamPlayer.new()
	p.stream = st
	p.volume_db = -14.0
	add_child(p)
	p.play()


func _exit_tree() -> void:
	# ссылки на эту сцену в автозагрузке — убрать (перезапуск сцены, выход)
	for m in ["spawn_drone", "place_turret", "spawn_enemy", "ship_lost", "starfield", "shipst", "events"]:
		if Core.has_meta(m):
			Core.remove_meta(m)


func _new_game() -> void:
	# стартовый набор: дрон-ремонтник и турель-пулемёт у двери на мостик
	spawn_drone("drone_worker")
	place_turret("turret_gun", SP.cell_to_px(Vector2i(24, 7)), true)
	Core.say("«Странник», дрейф. 10 минут тишины — займитесь кораблём.", "info")
	Core.say("Пульт на мостике — карта сектора и прыжок. Верстак в мастерской — дроны и турели.", "info")


## папка запечённых спрайтов персонажа (если есть)
func _sprites(name: String) -> String:
	var p := "res://assets/sprites/" + name
	return p if FileAccess.file_exists(p.path_join(name + ".json")) else ""


func _props(list: Array) -> void:
	for p in list:
		var box := STBox.new()
		box.name = "Prop_" + String(p.id)
		var c: Array = p.color
		var g: Array = p.get("glow", [0, 0, 0, 0])
		var b: Array = p.box
		box.position = Vector2(float(p.at[0]) * SP.TILE.x, float(p.at[1]) * SP.TILE.y)
		ysort.add_child(box)
		box.setup(b[0], b[1], b[2], Color(c[0], c[1], c[2]), Color(g[0], g[1], g[2], 1.0 if g.size() == 3 else 0.0))
		var r := Rect2(box.position.x - float(b[0]) * SP.PPM * 0.5, box.position.y - float(b[1]) * SP.TILE.y, float(b[0]) * SP.PPM, float(b[1]) * SP.TILE.y)
		for cell in SP.cells_under(r):
			ship.block(cell, true)
		if p.has("label"):
			var it := STInteract.new()
			it.point_id = p.id
			it.action = p.get("action", "inspect")
			it.label = p.label
			it.verb = p.get("verb", "Осмотр")
			it.text = p.get("text", "")
			it.target = p.get("target", "")
			it.radius = maxf(float(b[0]), float(b[1])) * 0.5 + 1.0
			it.position = box.position + Vector2(0, 8)
			ysort.add_child(it)
			it.used.connect(_on_use.bind(it.target))


## пульты и устройства корабля
func _on_use(_by: Node, target: String) -> void:
	match target:
		"power":
			shipst.show_panel()
		"workshop":
			shipst.show_workshop()
		"helm":
			events.helm()
		"heal":
			if not shipst.powered("medbay"):
				hud.show_text("Медкапсула", "Медотсек без энергии. Выделите ему единицу реактора в окне «Корабль».")
			elif hero.hp >= hero.max_hp:
				Core.say("Вы здоровы.", "info")
			else:
				hero.work(2.0, func():
					hero.hp = hero.max_hp
					Core.play_at("heal", hero.global_position, -4.0)
					Core.say("Медкапсула: здоровье восстановлено.", "good"))
		"cargo":
			var s: Dictionary = shipst.res
			hud.show_text("Склад", "Металл: %d\nЭлектроника: %d\nЭнергоячейки: %d\nТопливо: %d\n\nАптечек в вещах: %d\n\nМеталл и электроника — сборка на верстаке; ячейки — лазер и боевые дроны; топливо — прыжки." % [
				s.metal, s.electronics, s.cells, s.fuel, hero.count_item("medkit")])


# ---------------- дроны, турели, враги ----------------

func spawn_drone(kind: String) -> STDrone:
	var d := STDrone.new()
	d.kind = kind
	d.sprite_dir = _sprites(kind)
	ysort.add_child(d)
	d.global_position = hero.global_position
	d.reset_physics_interpolation()
	shipst.drones.append(d)
	return d


## турель — на свободной клетке пола своего корабля рядом с pos (перед героем); silent — без проверок и слов
func place_turret(kind: String, pos: Vector2, silent := false) -> bool:
	var cell := SP.px_to_cell(pos)
	if not silent:
		cell = _turret_cell(pos)
		if cell.x == -9999:
			Core.say("Здесь турель не встанет: нужен свободный пол своего корабля, не у двери.", "warn")
			return false
	var t := STTurret.new()
	t.kind = kind
	t.position = SP.cell_to_px(cell) + Vector2(0, 10)
	ysort.add_child(t)
	shipst.turrets.append(t)
	ship.block(cell, true)
	t.tree_exiting.connect(func():
		if is_instance_valid(ship) and ship.is_inside_tree():
			ship.block(cell, false))
	return true


func _turret_cell(pos: Vector2) -> Vector2i:
	var front := pos + hero.facing.normalized() * 60.0 if hero.facing != Vector2.ZERO else pos + Vector2(0, 50)
	var here := SP.px_to_cell(pos)
	var best := Vector2i(-9999, -9999)
	var bd := 1e9
	for dx in range(-2, 3):
		for dy in range(-2, 3):
			var c := here + Vector2i(dx, dy)
			if c == here or not ship.own_floor(c):
				continue
			var d := SP.cell_to_px(c).distance_to(front)
			if d < bd:
				bd = d
				best = c
	return best


func spawn_enemy(kind: String, at: Vector2) -> STEnemy:
	var e := STEnemy.new()
	e.kind = kind
	e.sprite_dir = _sprites(kind)
	ysort.add_child(e)
	e.global_position = at
	e.reset_physics_interpolation()
	return e


# ---------------- гибель ----------------

func _hero_died(_a) -> void:
	Core.say("Вы ранены и без сознания…", "bad")
	await get_tree().create_timer(3.0).timeout
	var lost := []
	for k in ["metal", "electronics"]:
		var n := int(shipst.res[k]) / 4
		if n > 0:
			shipst.add(k, -n)
			lost.append("%s −%d" % [shipst.res_name(k), n])
	hero.revive(ship.room_center("medbay") + Vector2(0, 40), hero.max_hp * 0.6)
	Core.say("Дрон-санитар дотащил вас до медотсека." + (" Потеряно: " + ", ".join(lost) if not lost.is_empty() else ""), "warn")


func _ship_lost() -> void:
	Core.save.delete_save()
	hud.show_dialog("Корабль потерян", "Корпус «Странника» не выдержал. Дрейф окончен в секторе %d.\n\nПрыжков: %d." % [loop.sector, loop.jumps], [
		["Начать заново", func():
			hud.close_modal()
			get_tree().paused = false
			get_tree().reload_current_scene()]])
