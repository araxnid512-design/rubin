class_name ULBackdrop
extends Control
## Картинка во весь экран с нарисованными на ней кнопками: занимает экран телефона целиком, без полей.
## Области нажатия задаются в точках самой картинки и пересчитываются под экран.

signal tapped(id: String)

var tex: Texture2D
var src_size := Vector2(1672, 941)   ## размер исходной картинки, в точках которой заданы области
var overlay := Callable()         ## что дорисовать поверх картинки (после неё)
var anchor_y := 0.5               ## какая часть лишней высоты срезается сверху (0 — верх картинки виден целиком)
var areas := {}                   ## имя → Rect2 в точках картинки
var dim := {}                     ## имя → true: область затемнена и не нажимается
var glow := {}                    ## имя → Color: подсветка (выбранное)
var _down := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP


## Прямоугольник картинки на экране. Экран шире картинки (телефон 20:9, картинка 16:9) — картинка растягивается
## на всю ширину, лишнее по высоте уходит за край: сколько сверху и снизу — задаёт anchor_y (0 — верх виден
## целиком, обрезается низ; 0.5 — поровну). Экран у́же картинки — она вписывается по ширине, поля сверху и снизу.
func fit() -> Rect2:
	var k := size.x / src_size.x
	var sz := src_size * k
	if sz.y >= size.y:
		return Rect2(Vector2(0.0, -(sz.y - size.y) * anchor_y), sz)
	return Rect2(Vector2(0.0, (size.y - sz.y) * 0.5), sz)


func to_screen(r: Rect2) -> Rect2:
	var f := fit()
	var k := f.size.x / src_size.x
	return Rect2(f.position + r.position * k, r.size * k)


func _draw() -> void:
	if tex == null:
		return
	var f := fit()
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.03, 0.03, 0.04))
	draw_texture_rect(tex, f, false)
	for id in areas:
		var r := to_screen(areas[id])
		if dim.get(id, false):
			draw_rect(r, Color(0, 0, 0, 0.55))
		elif id == _down:
			draw_rect(r, Color(1.0, 0.6, 0.2, 0.28))
		if glow.has(id):
			draw_rect(r, glow[id], false, 3.0)
	if overlay.is_valid():
		overlay.call()


func _hit(p: Vector2) -> String:
	for id in areas:
		if not dim.get(id, false) and to_screen(areas[id]).grow(6.0).has_point(p):
			return id
	return ""


func _gui_input(e: InputEvent) -> void:
	var pressed := false
	var released := false
	var pos := Vector2.ZERO
	if e is InputEventScreenTouch:
		pressed = e.pressed
		released = not e.pressed
		pos = e.position
	elif e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT:
		pressed = e.pressed
		released = not e.pressed
		pos = e.position
	else:
		return
	if pressed:
		_down = _hit(pos)
		queue_redraw()
	elif released:
		var id := _hit(pos)
		var was := _down
		_down = ""
		queue_redraw()
		if id != "" and id == was:
			tapped.emit(id)
