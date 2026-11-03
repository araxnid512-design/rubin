class_name TouchInput
extends RefCounted
## Определение источника ввода: на сенсорных устройствах обрабатываем только касания,
## на ПК (режим сенсорного интерфейса для теста) — мышь.

static func touch_device() -> bool:
	return DisplayServer.is_touchscreen_available()

static func is_press(e: InputEvent) -> bool:
	if e is InputEventScreenTouch:
		return (e as InputEventScreenTouch).pressed
	if e is InputEventMouseButton and not touch_device():
		return (e as InputEventMouseButton).pressed and (e as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
	return false

static func is_release(e: InputEvent) -> bool:
	if e is InputEventScreenTouch:
		return not (e as InputEventScreenTouch).pressed
	if e is InputEventMouseButton and not touch_device():
		return not (e as InputEventMouseButton).pressed and (e as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT
	return false

static func is_drag(e: InputEvent) -> bool:
	return e is InputEventScreenDrag or (e is InputEventMouseMotion and not touch_device())

static func index(e: InputEvent) -> int:
	if e is InputEventScreenTouch:
		return (e as InputEventScreenTouch).index
	if e is InputEventScreenDrag:
		return (e as InputEventScreenDrag).index
	return 99

static func pos(e: InputEvent) -> Vector2:
	if e is InputEventScreenTouch:
		return (e as InputEventScreenTouch).position
	if e is InputEventScreenDrag:
		return (e as InputEventScreenDrag).position
	if e is InputEventMouse:
		return (e as InputEventMouse).position
	return Vector2.ZERO
