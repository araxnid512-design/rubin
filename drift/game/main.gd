extends Node2D
## Главная сцена «Дрейфа»: космос, корабль, герой, камера, интерфейс, цикл. Автотесты: --st-test=<режим>.

var world: Node2D
var ysort: Node2D
var ship: STShip
var hero: STHero
var hud: STHud
var cam: Camera2D


func _ready() -> void:
	add_child(STStarfield.new())
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
	hero = STHero.new()
	hero.name = "Hero"
	hero.color = Color(0.95, 0.55, 0.2)
	hero.sprite_dir = _sprites("hero")
	ysort.add_child(hero)
	hero.global_position = ship.room_center("bridge") + Vector2(-60, 40)
	hero.reset_physics_interpolation()
	cam = Camera2D.new()
	cam.zoom = Vector2(1.15, 1.15)
	cam.position_smoothing_enabled = true
	cam.position_smoothing_speed = 6.0
	hero.add_child(cam)
	cam.offset = Vector2(0, -40)
	hud = STHud.new()
	add_child(hud)
	hud.bind_player(hero)
	var loop: Node = load("res://game/loop.gd").new()
	loop.name = "Loop"
	add_child(loop)
	Core.say("«Странник», дрейф. 10 минут тишины — займитесь кораблём.", "info")
	if Core.test_mode != "":
		var tr: Node = load("res://tools/test_runner.gd").new()
		tr.name = "TestRunner"
		add_child(tr)


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
