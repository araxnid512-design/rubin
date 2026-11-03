class_name TouchButton
extends Control
## Круглая сенсорная кнопка (мультитач): удержание, нажатие, подпись.

signal pressed
signal released

var text := ""
var sub := ""
var color := Color(0.6, 0.1, 0.08)
var held := false
var enabled := true
var progress := -1.0
var _idx := -1
var font_size := 30

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_STOP

func _input(e: InputEvent) -> void:
	if not is_visible_in_tree() or not enabled:
		if held:
			_release()
		return
	var p := TouchInput.pos(e)
	var c := global_position + size * 0.5
	var r := minf(size.x, size.y) * 0.5
	if TouchInput.is_press(e) and _idx == -1 and p.distance_to(c) <= r * 1.1:
		_idx = TouchInput.index(e)
		held = true
		pressed.emit()
		queue_redraw()
		get_viewport().set_input_as_handled()
	elif TouchInput.is_release(e) and TouchInput.index(e) == _idx:
		_release()

func _release() -> void:
	_idx = -1
	held = false
	released.emit()
	queue_redraw()

func _draw() -> void:
	var c := size * 0.5
	var r := minf(size.x, size.y) * 0.5
	var base := color if enabled else Color(0.25, 0.25, 0.25)
	draw_circle(c, r, Color(base.r, base.g, base.b, 0.85 if held else 0.55))
	draw_arc(c, r - 2.0, 0, TAU, 48, Color(1, 1, 1, 0.6 if held else 0.35), 4.0, true)
	if progress >= 0.0:
		draw_arc(c, r + 6.0, -PI / 2, -PI / 2 + TAU * clampf(progress, 0, 1), 48, Color(1.0, 0.8, 0.3), 8.0, true)
	var f := get_theme_default_font()
	var fs := font_size
	var tw := f.get_string_size(text, HORIZONTAL_ALIGNMENT_CENTER, -1, fs).x
	draw_string(f, Vector2(c.x - tw * 0.5, c.y + fs * 0.35 - (10.0 if sub != "" else 0.0)), text, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color.WHITE)
	if sub != "":
		var ss := 20
		var sw := f.get_string_size(sub, HORIZONTAL_ALIGNMENT_CENTER, -1, ss).x
		draw_string(f, Vector2(c.x - sw * 0.5, c.y + 26.0), sub, HORIZONTAL_ALIGNMENT_LEFT, -1, ss, Color(1, 1, 1, 0.85))
