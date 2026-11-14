class_name BCTouchControls
extends Control
## Сенсорное управление BunkerCore: слева — плавающий джойстик (появляется там, где коснулись левой половины
## экрана), справа — кнопки. Касания по свободной части экрана справа поворачивают камеру, два пальца —
## приближение. Мышь в редакторе/на ПК работает как палец.

signal button(name: String, pressed: bool)

var joy_index := -1
var joy_center := Vector2.ZERO
var joy_vec := Vector2.ZERO
var joy_radius := 90.0
var cam_touches := {}
var buttons := {}            ## имя → Control
var btn_touch := {}          ## касание → имя нажатой кнопки
var opacity := 0.55
var _pinch_d := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_PASS
	set_anchors_preset(Control.PRESET_FULL_RECT)


func set_joy_size(k: float) -> void:
	joy_radius = 90.0 * k


func _gui_input(_e: InputEvent) -> void:
	pass


func _input(e: InputEvent) -> void:
	if not is_visible_in_tree():
		return
	if e is InputEventScreenTouch:
		var pos: Vector2 = e.position
		if e.pressed:
			var bn := _button_at(pos)
			if bn != "":
				btn_touch[e.index] = bn
				_set_btn(bn, true)
				button.emit(bn, true)
				get_viewport().set_input_as_handled()
				return
			if pos.x < get_viewport_rect().size.x * 0.42 and joy_index < 0:
				joy_index = e.index
				joy_center = pos
				joy_vec = Vector2.ZERO
				queue_redraw()
			else:
				cam_touches[e.index] = pos
				if cam_touches.size() == 2:
					var ps := cam_touches.values()
					_pinch_d = (ps[0] as Vector2).distance_to(ps[1])
		else:
			if btn_touch.has(e.index):
				var bn: String = btn_touch[e.index]
				btn_touch.erase(e.index)
				_set_btn(bn, false)
				button.emit(bn, false)
				get_viewport().set_input_as_handled()
				return
			if e.index == joy_index:
				joy_index = -1
				joy_vec = Vector2.ZERO
				queue_redraw()
			cam_touches.erase(e.index)
	elif e is InputEventScreenDrag:
		if e.index == joy_index:
			var d: Vector2 = e.position - joy_center
			# джойстик «тянется» за пальцем, если тот ушёл далеко
			if d.length() > joy_radius * 1.3:
				joy_center = e.position - d.normalized() * joy_radius * 1.3
				d = e.position - joy_center
			joy_vec = (d / joy_radius).limit_length(1.0)
			queue_redraw()
		elif cam_touches.has(e.index):
			cam_touches[e.index] = e.position
			var cam = get_viewport().get_camera_3d()
			if cam_touches.size() == 2 and cam and cam.has_method("touch_pinch"):
				var ps := cam_touches.values()
				var dd := (ps[0] as Vector2).distance_to(ps[1])
				if _pinch_d > 10.0:
					cam.touch_pinch(dd / _pinch_d)
				_pinch_d = dd
			elif cam and cam.has_method("touch_drag"):
				cam.touch_drag(e.index, e.relative)


func _button_at(p: Vector2) -> String:
	for n in buttons:
		var b: Control = buttons[n]
		if b.is_visible_in_tree() and b.get_global_rect().grow(6).has_point(p):
			return n
	return ""


func _set_btn(n: String, on: bool) -> void:
	var b: Control = buttons.get(n)
	if b:
		b.modulate = Color(1.25, 1.15, 0.9) if on else Color.WHITE
		b.scale = Vector2.ONE * (0.94 if on else 1.0)


## вектор движения: x — вправо, y — вперёд (вверх по экрану)
func move_vector() -> Vector2:
	return Vector2(joy_vec.x, -joy_vec.y)


func _draw() -> void:
	var a := opacity
	if joy_index >= 0:
		draw_circle(joy_center, joy_radius, Color(0.08, 0.08, 0.07, 0.35 * a + 0.1))
		draw_arc(joy_center, joy_radius, 0, TAU, 48, Color(0.9, 0.85, 0.7, 0.6 * a), 3.0, true)
		draw_circle(joy_center + joy_vec * joy_radius, joy_radius * 0.42, Color(0.85, 0.75, 0.45, 0.75 * a + 0.1))
	else:
		# подсказка, где джойстик
		var vs := get_viewport_rect().size
		var c := Vector2(vs.x * 0.14, vs.y * 0.72)
		draw_arc(c, joy_radius * 0.8, 0, TAU, 48, Color(0.9, 0.85, 0.7, 0.22 * a), 2.0, true)
		draw_circle(c, joy_radius * 0.3, Color(0.85, 0.75, 0.45, 0.18 * a))
