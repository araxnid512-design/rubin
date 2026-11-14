extends Control
## Мини-карта BunkerCore: круг с планом вокруг героя. Рисуются помещения (BCRoom), забор, вход в бункер,
## постройки — из узлов мира в группе "minimap" (метаданные map_rect / map_kind); герой — стрелка в центре.
## План поворачивается вместе с камерой, «вверх» на карте — вперёд от камеры.

var scale_px := 3.2          ## пикселей на метр
var _items: Array = []
var _scan := 0.0


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	clip_contents = true


func _process(delta: float) -> void:
	_scan -= delta
	if _scan <= 0.0:
		_scan = 2.0
		_items = get_tree().get_nodes_in_group("minimap")
	_draw_t -= delta
	if _draw_t <= 0.0:
		_draw_t = 1.0 / 15.0
		queue_redraw()

var _draw_t := 0.0


func _draw() -> void:
	var p: Node3D = Core.player
	if p == null:
		return
	var c := size * 0.5
	var r := minf(size.x, size.y) * 0.5
	draw_circle(c, r, Color(0.06, 0.06, 0.05, 0.7))
	var under: bool = Core.world.underground
	var yaw := 0.0
	var cam := get_viewport().get_camera_3d()
	if cam and "yaw" in cam:
		yaw = cam.yaw
	var sc := scale_px * (1.6 if under else 1.0)
	var to_map := func(w: Vector3) -> Vector2:
		var d := Vector2(w.x - p.global_position.x, w.z - p.global_position.z)
		return c + d.rotated(-yaw) * sc
	for n in _items:
		if not is_instance_valid(n):
			continue
		var kind: String = n.get_meta("map_kind", "room")
		var is_under := kind == "room" or kind == "corridor"
		if is_under != under and kind != "entrance":
			continue
		var rect: Rect2 = n.get_meta("map_rect", Rect2())
		var xf: Transform3D = n.global_transform
		var pts := PackedVector2Array()
		for q in [Vector2(rect.position.x, rect.position.y), Vector2(rect.end.x, rect.position.y), rect.end, Vector2(rect.position.x, rect.end.y)]:
			pts.append(to_map.call(xf * Vector3(q.x, 0, q.y)))
		var col := {"room": Color(0.55, 0.52, 0.45, 0.85), "corridor": Color(0.42, 0.4, 0.36, 0.85), "building": Color(0.6, 0.5, 0.38, 0.85), "entrance": Color(0.9, 0.75, 0.3, 0.9), "fence": Color(0.6, 0.6, 0.6, 0.7), "road": Color(0.3, 0.3, 0.3, 0.6)}.get(kind, Color(0.5, 0.5, 0.5, 0.7))
		if kind == "fence":
			pts.append(pts[0])
			draw_polyline(pts, col, 1.5)
		else:
			draw_colored_polygon(pts, col)
	# цель задания: точка на карте, за краем — у края
	if Core.quest:
		var mp: Vector3 = Core.quest.marker_pos()
		if mp != Vector3.INF and (mp.y < -2.0) == under:
			var q: Vector2 = to_map.call(mp)
			var off := q - c
			if off.length() > r - 9.0:
				q = c + off.normalized() * (r - 9.0)
			draw_circle(q, 6.0, Color(0.1, 0.08, 0.04, 0.9))
			draw_circle(q, 4.5, Color(1.0, 0.78, 0.25))
	# герой
	var f := Vector2(0, -1).rotated(-(p.rotation.y - yaw) + PI)
	f = Vector2(sin(p.rotation.y - yaw), cos(p.rotation.y - yaw))
	var tip := c + f * 9.0
	var side := f.orthogonal() * 6.0
	draw_colored_polygon(PackedVector2Array([tip, c - f * 6.0 + side, c - f * 3.0, c - f * 6.0 - side]), Color(1.0, 0.85, 0.3))
	draw_arc(c, r - 1.0, 0, TAU, 48, Color(0.85, 0.75, 0.45, 0.6), 2.0, true)
	# север
	var nd := Vector2(0, -1).rotated(-yaw)
	draw_string(get_theme_default_font(), c + nd * (r - 12) - Vector2(5, -6), "С", HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(0.9, 0.85, 0.7))
