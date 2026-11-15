class_name STBox
extends StaticBody2D
## Предмет-ящик StarCore в проекции 2.5D: основание w×d м, высота h м. Рисуется верх (светлее) и лицевая
## сторона (темнее), по желанию — светящаяся панель. Основание — в начале координат (низ передней грани),
## поэтому сортировка с персонажами верна. Столкновение — по основанию. Заглушка до запечённых спрайтов.

var size := Vector3(1, 1, 1)        ## ширина, глубина, высота, м
var color := Color(0.4, 0.42, 0.45)
var glow := Color(0, 0, 0, 0)


func setup(w: float, d: float, h: float, col: Color, glow_col := Color(0, 0, 0, 0)) -> void:
	size = Vector3(w, d, h)
	color = col
	glow = glow_col
	collision_layer = 1
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(w * SP.PPM, d * SP.PPM * SP.K)
	cs.shape = sh
	cs.position = Vector2(0, -sh.size.y * 0.5)
	add_child(cs)
	queue_redraw()


func _draw() -> void:
	var w := size.x * SP.PPM
	var dd := size.y * SP.PPM * SP.K
	var hh := size.z * SP.PPM * SP.K
	# тень
	draw_rect(Rect2(-w * 0.5 + 4, -dd + 4, w, dd), Color(0, 0, 0, 0.25))
	# лицевая сторона и верх
	draw_rect(Rect2(-w * 0.5, -hh, w, hh), color.darkened(0.35))
	draw_rect(Rect2(-w * 0.5, -dd - hh, w, dd), color.lightened(0.12))
	draw_rect(Rect2(-w * 0.5, -dd - hh, w, 2), color.lightened(0.35))
	if glow.a > 0.0:
		draw_rect(Rect2(-w * 0.32, -hh * 0.78, w * 0.64, hh * 0.3), glow)
		draw_rect(Rect2(-w * 0.3, -dd - hh + dd * 0.3, w * 0.6, dd * 0.4), Color(glow, 0.55))
