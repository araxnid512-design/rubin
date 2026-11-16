class_name ULBackdrop
extends Control
## Картинка во весь экран с нарисованными на ней кнопками: вписывается по высоте, по бокам — та же картинка,
## растянутая и затемнённая. Области нажатия задаются в точках самой картинки и пересчитываются под экран.

signal tapped(id: String)

var tex: Texture2D
var src_size := Vector2(1672, 941)   ## размер исходной картинки, в точках которой заданы области
var overlay := Callable()         ## что дорисовать поверх картинки (после неё)
var areas := {}                   ## имя → Rect2 в точках картинки
var dim := {}                     ## имя → true: область затемнена и не нажимается
var glow := {}                    ## имя → Color: подсветка (выбранное)
var _down := ""


func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP


## прямоугольник картинки на экране
func fit() -> Rect2:
	var ts := tex.get_size()
	var k := minf(size.y / ts.y, size.x / ts.x)
	if size.x / size.y > ts.x / ts.y:
		k = size.y / ts.y
	var sz := ts * k
	return Rect2((size - sz) * 0.5, sz)


func to_screen(r: Rect2) -> Rect2:
	var f := fit()
	var k := f.size.x / src_size.x
	return Rect2(f.position + r.position * k, r.size * k)


func _draw() -> void:
	if tex == null:
		return
	var f := fit()
	if f.size.x < size.x - 1.0:
		# поля по бокам: та же картинка на весь экран, тёмная
		var ts := tex.get_size()
		var k := maxf(size.x / ts.x, size.y / ts.y)
		draw_texture_rect(tex, Rect2((size - ts * k) * 0.5, ts * k), false, Color(0.13, 0.13, 0.15))
	draw_texture_rect(tex, f, false)
	if f.size.x < size.x - 1.0:
		# мягкий переход на стыках
		for sd in [0, 1]:
			var x0 := f.position.x if sd == 0 else f.end.x
			var dirx := 1.0 if sd == 0 else -1.0
			var pts := PackedVector2Array([Vector2(x0, 0), Vector2(x0 + dirx * 90.0, 0), Vector2(x0 + dirx * 90.0, size.y), Vector2(x0, size.y)])
			var c0 := Color(0.04, 0.04, 0.05, 0.85)
			var c1 := Color(0.04, 0.04, 0.05, 0.0)
			draw_polygon(pts, PackedColorArray([c0, c1, c1, c0]))
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
