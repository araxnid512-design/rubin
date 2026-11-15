class_name SP
## Проекция «Дрейфа» (вид сверху под углом 45°, ортогональная): 1 м по горизонтали = 64 px, глубина и высота
## сжаты в 0.7071. Логика и физика — прямо в экранных пикселях: движение «вглубь» (вверх-вниз по экрану)
## умножается на K, чтобы скорость выглядела одинаковой во всех направлениях.

const PPM := 64.0                 ## пикселей на метр по горизонтали
const K := 0.70710678             ## сжатие глубины и высоты (sin 45°)
const TILE := Vector2(64, 45)     ## клетка пола 1×1 м на экране
const WALL_H := 113.0             ## лицевая сторона стены 2.5 м
const WALL_TOP := 18.0            ## верх стены (толщина 0.4 м)


## направление на земле (единичный вектор в «метрах») → вектор на экране
static func ground_to_screen(v: Vector2) -> Vector2:
	return Vector2(v.x, v.y * K)


static func screen_to_ground(v: Vector2) -> Vector2:
	return Vector2(v.x, v.y / K)


## расстояние «по земле» между двумя точками экрана, в метрах
static func dist_m(a: Vector2, b: Vector2) -> float:
	return screen_to_ground(b - a).length() / PPM


## клетка → точка экрана (центр клетки)
static func cell_to_px(c: Vector2i) -> Vector2:
	return Vector2((c.x + 0.5) * TILE.x, (c.y + 0.5) * TILE.y)


static func px_to_cell(p: Vector2) -> Vector2i:
	return Vector2i(floori(p.x / TILE.x), floori(p.y / TILE.y))


## индекс направления 0..7 (0 — к зрителю, далее по часовой на экране) по вектору на экране
static func dir8(v: Vector2) -> int:
	if v.length_squared() < 0.0001:
		return 0
	var g := screen_to_ground(v)
	# угол от «вниз по экрану», по часовой стрелке (как видит зритель): вниз=0, влево=2, вверх=4, вправо=6
	var a := atan2(-g.x, g.y)
	return posmod(roundi(a / (PI / 4.0)), 8)


## клетки, середину которых (центральные 40%) накрывает прямоугольник экрана
static func cells_under(r: Rect2) -> Array:
	var out := []
	var a := px_to_cell(r.position)
	var b := px_to_cell(r.end)
	for x in range(a.x, b.x + 1):
		for y in range(a.y, b.y + 1):
			var cr := Rect2((x + 0.3) * TILE.x, (y + 0.3) * TILE.y, TILE.x * 0.4, TILE.y * 0.4)
			if cr.intersects(r):
				out.append(Vector2i(x, y))
	return out
