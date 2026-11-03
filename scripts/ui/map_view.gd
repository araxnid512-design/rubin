class_name MapView
extends Control
## Карта локации: подложка из карты смешивания + динамические слои (здания, бойцы, враги, цели).
## Используется и для мини-карты (следует за генералом), и для полноэкранной карты.

const L = preload("res://scripts/world/layout.gd")
static var map_tex: ImageTexture

var follow := true
var meters := 90.0          # сколько метров по ширине видно
var center := Vector3.ZERO
var show_labels := false
var round_mask := false
var selected := ""

static func build_texture(splat: Image) -> void:
	var n := splat.get_width()
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	var dirt := Color(0.33, 0.31, 0.26)
	var grass := Color(0.24, 0.29, 0.16)
	var asph := Color(0.2, 0.2, 0.2)
	var conc := Color(0.46, 0.45, 0.42)
	var wet := Color(0.16, 0.2, 0.22)
	for z in n:
		for x in n:
			var s := splat.get_pixel(x, z)
			var c := dirt.lerp(grass, smoothstep(0.35, 0.7, s.g))
			c = c.lerp(asph, smoothstep(0.4, 0.6, s.r))
			c = c.lerp(conc, smoothstep(0.4, 0.6, s.b))
			c = c.lerp(wet, smoothstep(0.55, 0.75, s.a) * 0.7)
			img.set_pixel(x, z, c)
	var px := func(v: float) -> int: return clampi(int((v + 150.0) / 300.0 * n), 0, n - 1)
	# периметр
	var mn: Vector2 = L.WALL_MIN
	var mx: Vector2 = L.WALL_MAX
	var wall_c := Color(0.75, 0.73, 0.68)
	for x in range(px.call(mn.x), px.call(mx.x) + 1):
		for z in [px.call(mn.y), px.call(mx.y)]:
			img.set_pixel(x, z, wall_c)
	for z in range(px.call(mn.y), px.call(mx.y) + 1):
		for x in [px.call(mn.x), px.call(mx.x)]:
			img.set_pixel(x, z, wall_c)
	# проёмы и проломы
	for br in L.BREACHES:
		var a := float(br.at) - float(br.w) * 0.5
		var b := float(br.at) + float(br.w) * 0.5
		var g := grass.lerp(dirt, 0.5)
		match String(br.side):
			"n":
				for x in range(px.call(a), px.call(b) + 1): img.set_pixel(x, px.call(mn.y), Color(0.8, 0.3, 0.2))
			"w":
				for z in range(px.call(a), px.call(b) + 1): img.set_pixel(px.call(mn.x), z, Color(0.8, 0.3, 0.2))
			"e":
				for z in range(px.call(a), px.call(b) + 1): img.set_pixel(px.call(mx.x), z, Color(0.8, 0.3, 0.2))
	for x in range(px.call(-L.GATE_HALF), px.call(L.GATE_HALF) + 1):
		img.set_pixel(x, px.call(mx.y), asph)
	# железная дорога
	for x in n:
		img.set_pixel(x, px.call(-128.8), Color(0.3, 0.25, 0.2))
		img.set_pixel(x, px.call(-127.2), Color(0.3, 0.25, 0.2))
	# руины
	for r in L.RUINS:
		var p: Vector2 = r.pos
		var s2: Vector2 = r.size
		img.fill_rect(Rect2i(px.call(p.x - s2.x * 0.5), px.call(p.y - s2.y * 0.5), int(s2.x / 300.0 * n), int(s2.y / 300.0 * n)), Color(0.27, 0.24, 0.22))
	map_tex = ImageTexture.create_from_image(img)

func _ready() -> void:
	clip_contents = true
	mouse_filter = Control.MOUSE_FILTER_PASS

func _process(_d: float) -> void:
	if is_visible_in_tree():
		if follow and Game.player:
			center = Game.player.global_position
		queue_redraw()

func w2m(p: Vector3) -> Vector2:
	var scale := size.x / meters
	return size * 0.5 + Vector2(p.x - center.x, p.z - center.z) * scale

func m2w(v: Vector2) -> Vector3:
	var scale := size.x / meters
	var d := (v - size * 0.5) / scale
	return Vector3(center.x + d.x, 0, center.z + d.y)

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.08, 0.08, 0.07))
	if map_tex:
		var a := w2m(Vector3(-150, 0, -150))
		var b := w2m(Vector3(150, 0, 150))
		draw_texture_rect(map_tex, Rect2(a, b - a), false)
	var f := get_theme_default_font()
	var scale := size.x / meters
	# здания
	for d in L.BUILDINGS:
		var p: Vector2 = d.pos
		var s: Vector2 = d.size
		var lvl := Game.building_level(d.id)
		var job := Game.building_job(d.id)
		var c := Color(0.55, 0.16, 0.12)
		if job != "":
			c = Color(0.85, 0.65, 0.2)
		elif lvl == 1:
			c = Color(0.5, 0.55, 0.5)
		elif lvl >= 2:
			c = Color(0.35, 0.65, 0.35)
		if d.get("open", false):
			c.a = 0.45
		var r := Rect2(w2m(Vector3(p.x - s.x * 0.5, 0, p.y - s.y * 0.5)), s * scale)
		draw_rect(r, c)
		draw_rect(r, Color(0, 0, 0, 0.6) if d.id != selected else Color(1, 0.9, 0.3), false, 2.0 if d.id == selected else 1.0)
		if show_labels and d.kind != "tower":
			var t := String(d.name)
			var fs := 18
			var tw := f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
			var lp := r.get_center() + Vector2(-tw * 0.5, 6)
			draw_string_outline(f, lp, t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 4, Color(0, 0, 0, 0.85))
			draw_string(f, lp, t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, Color(1, 0.97, 0.9))
	# выходы
	for e in L.EXITS:
		var ep := w2m(e.pos)
		draw_circle(ep, 7.0, Color(0.3, 0.6, 1.0))
		if show_labels:
			draw_string_outline(f, ep + Vector2(-60, -12), "→ " + String(e.name), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, 4, Color(0, 0, 0, 0.85))
			draw_string(f, ep + Vector2(-60, -12), "→ " + String(e.name), HORIZONTAL_ALIGNMENT_LEFT, -1, 18, Color(0.6, 0.85, 1.0))
	# аномалии
	for an in L.ANOMALIES:
		var ap := w2m(an.pos)
		var col := Color(0.4, 0.7, 1.0, 0.5) if an.kind == "electro" else (Color(1.0, 0.5, 0.15, 0.5) if an.kind == "fire" else Color(0.7, 0.9, 0.2, 0.35))
		draw_circle(ap, maxf(3.0, float(an.r) * scale), col)
	# бойцы
	if Game.world:
		for s in Game.world.soldiers.values():
			var so := s as Soldier
			if so and so.alive:
				draw_circle(w2m(so.global_position), 6.0, Color(0.3, 0.9, 0.4))
				draw_arc(w2m(so.global_position), 6.0, 0, TAU, 12, Color(0, 0, 0, 0.7), 1.5)
		# враги рядом с генералом или бойцами
		for e in Game.world.get_tree().get_nodes_in_group("enemies"):
			var en := e as Enemy
			if en == null or not en.alive or en.dormant:
				continue
			if Game.player and en.global_position.distance_to(Game.player.global_position) < 40.0:
				draw_circle(w2m(en.global_position), 5.0, Color(0.95, 0.2, 0.15))
	# цель задания
	var m: Variant = Quest.marker()
	if m != null:
		var mp := w2m(m as Vector3)
		var rr := size * 0.5
		if not Rect2(Vector2.ZERO, size).grow(-8).has_point(mp):
			mp = rr + (mp - rr).limit_length(minf(rr.x, rr.y) - 12.0)
		var pts := PackedVector2Array([mp + Vector2(0, -11), mp + Vector2(9, 0), mp + Vector2(0, 11), mp + Vector2(-9, 0)])
		draw_colored_polygon(pts, Color(1.0, 0.82, 0.2))
		draw_polyline(PackedVector2Array([pts[0], pts[1], pts[2], pts[3], pts[0]]), Color(0, 0, 0), 2.0)
	# генерал
	if Game.player:
		var pp := w2m(Game.player.global_position)
		var fwd := -Game.player.global_transform.basis.z
		var dir := Vector2(fwd.x, fwd.z).normalized()
		var side := Vector2(-dir.y, dir.x)
		var tri := PackedVector2Array([pp + dir * 12.0, pp - dir * 8.0 + side * 7.0, pp - dir * 8.0 - side * 7.0])
		draw_colored_polygon(tri, Color.WHITE)
		draw_polyline(PackedVector2Array([tri[0], tri[1], tri[2], tri[0]]), Color(0.7, 0.1, 0.08), 2.0)
	draw_rect(Rect2(Vector2.ZERO, size), Color(0.75, 0.2, 0.15, 0.9), false, 3.0)
