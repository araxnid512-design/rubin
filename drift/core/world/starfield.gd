class_name STStarfield
extends Parallax2D
## Космос за бортом: звёзды трёх яркостей и туманности, медленный параллакс. Рисуется один раз в текстуру
## (повторяющаяся плитка) — один вызов отрисовки на телефоне.

const SIZE := Vector2i(1024, 1024)


func _ready() -> void:
	scroll_scale = Vector2(0.15, 0.15)
	repeat_size = Vector2(SIZE)
	repeat_times = 3
	z_index = -100
	var s := Sprite2D.new()
	s.centered = false
	s.texture = ImageTexture.create_from_image(_paint())
	add_child(s)


func _paint() -> Image:
	var img := Image.create(SIZE.x, SIZE.y, false, Image.FORMAT_RGB8)
	img.fill(Color(0.015, 0.02, 0.035))
	var rng := RandomNumberGenerator.new()
	rng.seed = 42
	# туманности — мягкие пятна
	for i in 3:
		var c := Vector2(rng.randf() * SIZE.x, rng.randf() * SIZE.y)
		var col: Color = [Color(0.25, 0.1, 0.35), Color(0.05, 0.2, 0.35), Color(0.35, 0.15, 0.1)][i]
		var rad := rng.randf_range(160, 260)
		for y in range(int(c.y - rad), int(c.y + rad), 2):
			for x in range(int(c.x - rad), int(c.x + rad), 2):
				var d := Vector2(x, y).distance_to(c) / rad
				if d < 1.0:
					var px := Vector2i(posmod(x, SIZE.x), posmod(y, SIZE.y))
					var a := (1.0 - d) * (1.0 - d) * 0.12
					var cur := img.get_pixelv(px)
					var nc := cur.lerp(col, a)
					img.set_pixelv(px, nc)
					img.set_pixel(posmod(x + 1, SIZE.x), px.y, nc)
					img.set_pixel(px.x, posmod(y + 1, SIZE.y), nc)
					img.set_pixel(posmod(x + 1, SIZE.x), posmod(y + 1, SIZE.y), nc)
	for i in 700:
		var p := Vector2i(rng.randi() % SIZE.x, rng.randi() % SIZE.y)
		var b := rng.randf()
		var col := Color(0.8, 0.85, 1.0).lerp(Color(1.0, 0.85, 0.7), rng.randf() * 0.4) * (0.35 + b * 0.65)
		img.set_pixelv(p, col)
		if b > 0.93:
			for o in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
				var q := Vector2i(posmod(p.x + o.x, SIZE.x), posmod(p.y + o.y, SIZE.y))
				img.set_pixelv(q, col * 0.6)
	return img
