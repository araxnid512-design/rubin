class_name ULMapView
extends Control
## Карта локации на весь экран: снимок сверху (ULPlaceMap), метка героя — стрелка, куда он смотрит, — и метки
## мест (вход на локацию). Две кратности: вся карта и крупно вокруг героя. Закрывается кнопкой «Закрыть» или
## касанием мимо карты. Игра под картой продолжается — метка героя живая.

signal closed

const ZOOM_K := 2.6
const TOP_H := 60.0
const BOT_H := 44.0

var tex: Texture2D
var size_x := 100.0
var size_z := 100.0
var title := ""
var hero := Vector3.ZERO
var hero_yaw := 0.0                 ## поворот героя вокруг вертикали: взгляд — (sin, 0, cos)
var hero_fn := Callable()           ## откуда брать место и поворот героя каждый кадр: () → [Vector3, float]
var marks: Array = []               ## [{pos: Vector3, text: String, col: Color}]
var zoom := false


func setup(t: Texture2D, sx: float, sz: float, name_text: String) -> void:
	tex = t
	size_x = sx
	size_z = sz
	title = name_text


func _ready() -> void:
	name = "PlaceMap"
	set_anchors_and_offsets_preset(PRESET_FULL_RECT)
	mouse_filter = MOUSE_FILTER_STOP
	_pull()


func _process(_dt: float) -> void:
	_pull()
	queue_redraw()


func _pull() -> void:
	if hero_fn.is_valid():
		var h: Array = hero_fn.call()
		hero = h[0]
		hero_yaw = float(h[1])


## где на экране рисуется карта (вписана в поле между шапкой и подписью, стороны — как у локации)
func map_rect() -> Rect2:
	var area := Rect2(16, TOP_H, size.x - 32, size.y - TOP_H - BOT_H)
	var sp := ULPlaceMap.span(size_x, size_z)
	var k := minf(area.size.x / sp.x, area.size.y / sp.y)
	var sz := sp * k
	return Rect2(area.position + (area.size - sz) * 0.5, sz)


## какая часть карты сейчас показана — в долях (0…1): вся или окно вокруг героя (не выходит за край карты)
func view_uv() -> Rect2:
	if not zoom:
		return Rect2(0, 0, 1, 1)
	var w := 1.0 / ZOOM_K
	var c := ULPlaceMap.to_uv(hero, size_x, size_z)
	return Rect2(clampf(c.x - w * 0.5, 0.0, 1.0 - w), clampf(c.y - w * 0.5, 0.0, 1.0 - w), w, w)


## точка мира → точка экрана на карте
func to_screen(p: Vector3) -> Vector2:
	var r := map_rect()
	var v := view_uv()
	var uv := ULPlaceMap.to_uv(p, size_x, size_z)
	return r.position + Vector2((uv.x - v.position.x) / v.size.x, (uv.y - v.position.y) / v.size.y) * r.size


func marker_px() -> Vector2:
	return to_screen(hero)


func close_rect() -> Rect2:
	return Rect2(size.x - 176, 8, 160, 44)


func zoom_rect() -> Rect2:
	return Rect2(size.x - 176 - 196, 8, 184, 44)


func toggle_zoom() -> void:
	zoom = not zoom
	queue_redraw()


func close() -> void:
	closed.emit()
	queue_free()


func _gui_input(e: InputEvent) -> void:
	var pos := Vector2.INF
	if e is InputEventScreenTouch and (e as InputEventScreenTouch).pressed:
		pos = (e as InputEventScreenTouch).position
	elif e is InputEventMouseButton and (e as InputEventMouseButton).pressed and (e as InputEventMouseButton).button_index == MOUSE_BUTTON_LEFT:
		pos = (e as InputEventMouseButton).position
	if pos == Vector2.INF:
		return
	accept_event()
	if close_rect().has_point(pos):
		close()
	elif zoom_rect().has_point(pos):
		toggle_zoom()
	elif not map_rect().has_point(pos):
		close()


func _btn(r: Rect2, t: String, font: Font) -> void:
	draw_rect(r, Color(0.07, 0.13, 0.17, 0.95))
	draw_rect(r, Color(0.6, 0.85, 1.0, 0.7), false, 2.0)
	var w := font.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 18).x
	draw_string(font, r.position + Vector2((r.size.x - w) * 0.5, r.size.y * 0.5 + 7), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.92, 0.96, 1.0))


func _label(font: Font, at: Vector2, t: String, fs: int, col: Color) -> void:
	draw_string_outline(font, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 5, Color(0, 0, 0, 0.85))
	draw_string(font, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)


func _draw() -> void:
	var font := ThemeDB.fallback_font
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.02, 0.03, 0.04, 0.86))
	var r := map_rect()
	var v := view_uv()
	if tex != null:
		var ts := tex.get_size()
		draw_texture_rect_region(tex, r, Rect2(v.position * ts, v.size * ts))
	draw_rect(r, Color(0.6, 0.85, 1.0, 0.6), false, 2.0)
	# метки мест — только те, что попали в показанную часть карты
	for m in marks:
		var q := to_screen(m.pos)
		if not r.grow(2.0).has_point(q):
			continue
		var col: Color = m.get("col", Color(0.5, 1.0, 0.55))
		draw_circle(q, 9.0, Color(0, 0, 0, 0.7))
		draw_circle(q, 6.5, col)
		_label(font, q + Vector2(12, 24), String(m.get("text", "")), 16, col)      # ниже точки: над ней — подпись героя
	# герой: кольцо и стрелка — куда он смотрит (на карте вправо — x, вниз — z)
	var hp := marker_px()
	var d := Vector2(sin(hero_yaw), cos(hero_yaw))
	var n := Vector2(-d.y, d.x)
	var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.006)
	draw_arc(hp, 20.0 + 5.0 * pulse, 0, TAU, 40, Color(1.0, 0.9, 0.3, 0.75 - 0.4 * pulse), 2.5)
	var tri := PackedVector2Array([hp + d * 17.0, hp - d * 10.0 + n * 10.0, hp - d * 4.0, hp - d * 10.0 - n * 10.0])
	draw_colored_polygon(tri, Color(1.0, 0.86, 0.2))
	draw_polyline(PackedVector2Array([tri[0], tri[1], tri[2], tri[3], tri[0]]), Color(0.1, 0.07, 0.0), 2.0)
	_label(font, hp + Vector2(16, -14), "вы", 16, Color(1.0, 0.92, 0.5))
	# шапка, кнопки, подпись с мерной линейкой
	_label(font, Vector2(20, 40), "Карта: %s" % title, 26, Color(0.95, 0.97, 1.0))
	_btn(zoom_rect(), "ВСЯ КАРТА" if zoom else "КРУПНЕЕ", font)
	_btn(close_rect(), "ЗАКРЫТЬ", font)
	var sp := ULPlaceMap.span(size_x, size_z)
	var px_m := r.size.x / (sp.x * v.size.x)
	var bar_m := 20.0 if px_m * 20.0 < 220.0 else 10.0
	var by := size.y - BOT_H * 0.5
	var bx := r.position.x
	draw_line(Vector2(bx, by), Vector2(bx + px_m * bar_m, by), Color(0.95, 0.97, 1.0), 3.0)
	draw_line(Vector2(bx, by - 6), Vector2(bx, by + 6), Color(0.95, 0.97, 1.0), 3.0)
	draw_line(Vector2(bx + px_m * bar_m, by - 6), Vector2(bx + px_m * bar_m, by + 6), Color(0.95, 0.97, 1.0), 3.0)
	_label(font, Vector2(bx + px_m * bar_m + 12, by + 6), "%d м · верх карты — вверх на экране · касание мимо карты закрывает её" % int(bar_m), 16, Color(0.85, 0.9, 0.95))
