class_name STDoor
extends Node2D
## Автоматическая дверь StarCore: открывается, когда рядом кто-то живой (кроме запертой), закрывается сама.
## Створки разъезжаются; закрытая — твёрдая (слой стен) и непроходима для маршрутов. Положение — основание клетки.

var cell := Vector2i.ZERO
var horizontal := true          ## дверь в горизонтальной стене (проход вверх-вниз)
var locked := false
var hatch := false              ## стыковочный люк (жёлто-чёрные полосы)
var is_open := false
var _t := 0.0                   ## 0 — закрыта, 1 — открыта
var _body: StaticBody2D
var _sensor: Area2D
var _near := 0


func _ready() -> void:
	_body = StaticBody2D.new()
	_body.collision_layer = 1
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = SP.TILE
	cs.shape = sh
	cs.position = Vector2(0, -SP.TILE.y * 0.5)
	_body.add_child(cs)
	add_child(_body)
	_sensor = Area2D.new()
	_sensor.collision_layer = 0
	_sensor.collision_mask = 2 | 4
	_sensor.monitorable = false
	var ss := CollisionShape2D.new()
	var sc := CircleShape2D.new()
	sc.radius = 80.0
	ss.shape = sc
	ss.position = Vector2(0, -SP.TILE.y * 0.5)
	_sensor.add_child(ss)
	add_child(_sensor)
	_sensor.body_entered.connect(func(_b): _near += 1)
	_sensor.body_exited.connect(func(_b): _near = maxi(0, _near - 1))


func _process(delta: float) -> void:
	var want := (not locked) and _near > 0
	if want != is_open:
		is_open = want
		Core.play_at("door_open" if want else "door_close", global_position, -10.0)
		_body.collision_layer = 0 if want else 1
		if Core.ship:
			Core.ship.astar.set_point_solid(cell, locked)
	var target := 1.0 if is_open else 0.0
	if not is_equal_approx(_t, target):
		_t = move_toward(_t, target, delta * 4.0)
		queue_redraw()


func set_locked(v: bool) -> void:
	locked = v
	if Core.ship:
		Core.ship.astar.set_point_solid(cell, v)
	queue_redraw()


func _draw() -> void:
	var w := SP.TILE.x
	var h := 40.0
	var top := -SP.TILE.y - h + 6.0
	var col := Color(0.55, 0.58, 0.62) if not locked else Color(0.6, 0.3, 0.25)
	if hatch:
		col = Color(0.75, 0.62, 0.2)
	var gap := _t * w * 0.5
	# створки: левая и правая половины уезжают в стороны
	draw_rect(Rect2(-w * 0.5, top, w * 0.5 - gap, h), col)
	draw_rect(Rect2(gap, top, w * 0.5 - gap, h), col)
	draw_rect(Rect2(-w * 0.5, top, w, 4), Color(0.25, 0.27, 0.3))
	if hatch:
		for i in 4:
			var x := -w * 0.5 + i * w * 0.25 + 4.0
			if x + 8.0 < -gap or x > gap:
				draw_rect(Rect2(x, top + 10, 8, h - 14), Color(0.12, 0.12, 0.12))
	var led := Color(0.3, 1.0, 0.4) if is_open else (Color(1.0, 0.25, 0.2) if locked else Color(1.0, 0.75, 0.25))
	draw_rect(Rect2(-3, top - 6, 6, 4), led)
