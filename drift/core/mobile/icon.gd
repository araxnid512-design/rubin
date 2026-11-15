class_name STIcon
extends Control
## Значок интерфейса StarCore, нарисованный кодом (чёткий при любом размере): прицел, действие, уклон, экипаж,
## корабль, пауза, закрыть. Цвет — голубой неон.

var kind := "fire"
var col := Color(0.55, 0.9, 1.0)


func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE


func _draw() -> void:
	var c := size * 0.5
	var r := minf(size.x, size.y) * 0.5
	var w := maxf(2.0, r * 0.12)
	match kind:
		"fire":
			draw_arc(c, r * 0.62, 0, TAU, 32, col, w, true)
			for i in 4:
				var d := Vector2.from_angle(i * PI * 0.5)
				draw_line(c + d * r * 0.35, c + d * r * 0.95, col, w, true)
			draw_circle(c, w * 0.9, col)
		"action":
			var pts := PackedVector2Array()
			for i in 7:
				pts.append(c + Vector2.from_angle(i * TAU / 6.0 - PI * 0.5) * r * 0.8)
			draw_polyline(pts, col, w, true)
			draw_circle(c, r * 0.22, col)
		"dodge":
			for k in 2:
				var o := Vector2(-r * 0.35 + k * r * 0.5, 0)
				draw_polyline(PackedVector2Array([c + o + Vector2(-r * 0.25, -r * 0.55), c + o + Vector2(r * 0.2, 0), c + o + Vector2(-r * 0.25, r * 0.55)]), col, w, true)
		"crew":
			for k in 2:
				var o := Vector2(-r * 0.32 + k * r * 0.64, 0)
				draw_circle(c + o + Vector2(0, -r * 0.3), r * 0.2, col)
				draw_arc(c + o + Vector2(0, r * 0.55), r * 0.36, PI, TAU, 16, col, w, true)
		"ship":
			draw_polyline(PackedVector2Array([c + Vector2(0, -r * 0.85), c + Vector2(r * 0.55, r * 0.55), c + Vector2(0, r * 0.25),
				c + Vector2(-r * 0.55, r * 0.55), c + Vector2(0, -r * 0.85)]), col, w, true)
			draw_line(c + Vector2(0, r * 0.25), c + Vector2(0, r * 0.75), Color(1.0, 0.6, 0.25), w, true)
		"pause":
			draw_rect(Rect2(c + Vector2(-r * 0.45, -r * 0.55), Vector2(r * 0.3, r * 1.1)), col)
			draw_rect(Rect2(c + Vector2(r * 0.15, -r * 0.55), Vector2(r * 0.3, r * 1.1)), col)
		"close":
			draw_line(c + Vector2(-r, -r) * 0.5, c + Vector2(r, r) * 0.5, col, w, true)
			draw_line(c + Vector2(r, -r) * 0.5, c + Vector2(-r, r) * 0.5, col, w, true)
		"cancel":
			draw_arc(c, r * 0.6, 0, TAU, 28, Color(1.0, 0.5, 0.4), w, true)
			draw_line(c + Vector2(-r, -r) * 0.32, c + Vector2(r, r) * 0.32, Color(1.0, 0.5, 0.4), w, true)
