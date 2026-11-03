class_name VirtualJoystick
extends Control
## Плавающий виртуальный джойстик: касание в левой нижней части экрана задаёт центр.

signal moved(v: Vector2)

var value := Vector2.ZERO
var _idx := -1
var _center := Vector2.ZERO
var _knob := Vector2.ZERO
var radius := 120.0
var _rest := Vector2.ZERO

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE

func _input(e: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	radius = 120.0 * Settings.joystick_size
	var p := TouchInput.pos(e)
	var gr := get_global_rect()
	if TouchInput.is_press(e) and _idx == -1 and gr.has_point(p):
		_idx = TouchInput.index(e)
		_center = p - global_position
		_knob = _center
		_update(p)
		get_viewport().set_input_as_handled()
	elif TouchInput.is_release(e) and TouchInput.index(e) == _idx:
		_idx = -1
		value = Vector2.ZERO
		moved.emit(value)
		queue_redraw()
	elif TouchInput.is_drag(e) and TouchInput.index(e) == _idx:
		_update(p)
		get_viewport().set_input_as_handled()

func _update(p: Vector2) -> void:
	var local := p - global_position
	var d := local - _center
	if d.length() > radius:
		# джойстик «едет» за пальцем
		_center = local - d.normalized() * radius
		d = d.normalized() * radius
	_knob = _center + d
	value = d / radius
	moved.emit(value)
	queue_redraw()

func _draw() -> void:
	var c := _center if _idx != -1 else Vector2(radius + 70.0, size.y - radius - 60.0)
	var k := _knob if _idx != -1 else c
	draw_circle(c, radius, Color(0, 0, 0, 0.28))
	draw_arc(c, radius, 0, TAU, 48, Color(0.9, 0.85, 0.8, 0.45), 4.0, true)
	draw_circle(k, radius * 0.42, Color(0.75, 0.12, 0.08, 0.7 if _idx != -1 else 0.4))
	draw_arc(k, radius * 0.42, 0, TAU, 32, Color(1, 1, 1, 0.5), 3.0, true)
