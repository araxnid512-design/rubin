class_name STFx
extends Node2D
## Эффекты StarCore: вспышки выстрелов, искры, взрывы, дым, всплывающие числа урона, следы гари на полу.
## Все частицы одного вида рисует один узел (мало вызовов отрисовки на телефоне): слой «свет» — сложение цветов
## (вспышки, искры, огонь), слой «дым» — обычное смешение (дым, пыль, числа), слой «пол» — гарь под персонажами.
## Вызовы — статические: STFx.sparks(...), STFx.explosion(...); нет слоя (тест без сцены) — ничего не делают.

static var inst: STFx
var glow_layer: _Layer
var mix_layer: _Layer
var floor_layer: _Layer
const MAX := 420                  ## предел частиц на слой (защита от лавины эффектов)


class _Layer:
	extends Node2D
	var parts: Array = []         ## [kind, pos, vel, life, max_life, size, color, extra]

	func _process(delta: float) -> void:
		if parts.is_empty():
			return
		var i := parts.size() - 1
		while i >= 0:
			var p: Array = parts[i]
			p[3] -= delta
			if p[3] <= 0.0:
				parts.remove_at(i)
			else:
				p[1] += p[2] * delta
				match p[0]:
					"spark", "chunk":
						p[2].y += 420.0 * delta          # падают
						p[2] *= 1.0 - 1.5 * delta
					"smoke":
						p[2] *= 1.0 - 1.2 * delta
					"text":
						p[2] *= 1.0 - 2.0 * delta
			i -= 1
		queue_redraw()

	func _draw() -> void:
		for p in parts:
			var k: float = clampf(p[3] / p[4], 0.0, 1.0)     # 1 → 0 к концу жизни
			var c: Color = p[6]
			match p[0]:
				"spark":
					var tail: Vector2 = p[2] * 0.035
					draw_line(p[1], p[1] - tail, Color(c, k), p[5], true)
				"chunk":
					draw_rect(Rect2(p[1] - Vector2.ONE * p[5] * 0.5, Vector2.ONE * p[5]), Color(c, minf(1.0, k * 2.0)))
				"glow":
					var r: float = p[5] * (0.6 + 0.4 * (1.0 - k))
					draw_circle(p[1], r, Color(c, k * 0.55))
					draw_circle(p[1], r * 0.5, Color(c.lightened(0.5), k * 0.8))
				"ring":
					draw_arc(p[1], p[5] * (1.0 - k) + 4.0, 0, TAU, 28, Color(c, k), 3.0, true)
				"smoke":
					draw_circle(p[1], p[5] * (1.0 + (1.0 - k) * 1.2), Color(c, k * float(p[7])))
				"flash":
					var r2: float = p[5]
					var pts := PackedVector2Array()
					for j in 10:
						var a := j * TAU / 10.0
						pts.append(p[1] + Vector2(cos(a), sin(a)) * (r2 if j % 2 == 0 else r2 * 0.45))
					draw_colored_polygon(pts, Color(c, k))
					draw_circle(p[1], r2 * 0.35, Color(1, 1, 1, k))
				"text":
					var f := ThemeDB.fallback_font
					var s: String = p[7]
					draw_string_outline(f, p[1] - Vector2(20, 0), s, HORIZONTAL_ALIGNMENT_CENTER, 40, int(p[5]), 4, Color(0, 0, 0, k * 0.8))
					draw_string(f, p[1] - Vector2(20, 0), s, HORIZONTAL_ALIGNMENT_CENTER, 40, int(p[5]), Color(c, k))
				"scorch":
					draw_set_transform(p[1], 0.0, Vector2(1.0, SP.K))
					draw_circle(Vector2.ZERO, p[5], Color(c, minf(1.0, k * 3.0) * 0.55))
					draw_circle(Vector2.ZERO, p[5] * 0.6, Color(c, minf(1.0, k * 3.0) * 0.4))
					draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)

	func add(p: Array) -> void:
		if parts.size() < STFx.MAX:
			parts.append(p)


func _ready() -> void:
	inst = self
	floor_layer = _Layer.new()
	floor_layer.z_index = -9                 # над полом, под стенами и персонажами
	floor_layer.z_as_relative = false
	add_child(floor_layer)
	mix_layer = _Layer.new()
	mix_layer.z_index = 10
	add_child(mix_layer)
	glow_layer = _Layer.new()
	glow_layer.z_index = 11
	var m := CanvasItemMaterial.new()
	m.blend_mode = CanvasItemMaterial.BLEND_MODE_ADD
	glow_layer.material = m
	add_child(glow_layer)


func _exit_tree() -> void:
	if inst == self:
		inst = null


static func ok() -> bool:
	return inst != null and is_instance_valid(inst)


# ---------------- готовые эффекты ----------------

## вспышка выстрела у ствола (pos — точка экрана на высоте ствола)
static func muzzle(pos: Vector2, col: Color, size := 10.0) -> void:
	if not ok():
		return
	inst.glow_layer.add(["flash", pos, Vector2.ZERO, 0.07, 0.07, size, col.lightened(0.3), null])
	inst.glow_layer.add(["glow", pos, Vector2.ZERO, 0.12, 0.12, size * 1.8, col, null])


## искры: n штук, разлёт speed px/с, вверх и в стороны
static func sparks(pos: Vector2, col: Color, n := 8, speed := 220.0) -> void:
	if not ok():
		return
	for i in n:
		var a := randf_range(-PI, 0.0)
		var v := Vector2(cos(a), sin(a)) * randf_range(speed * 0.4, speed)
		inst.glow_layer.add(["spark", pos, v, randf_range(0.15, 0.4), 0.4, randf_range(1.5, 2.5), col, null])
	inst.glow_layer.add(["glow", pos, Vector2.ZERO, 0.1, 0.1, 10.0, col, null])


## дым: клубы поднимаются
static func smoke(pos: Vector2, n := 3, col := Color(0.25, 0.25, 0.27), alpha := 0.45, size := 10.0) -> void:
	if not ok():
		return
	for i in n:
		var v := Vector2(randf_range(-14, 14), randf_range(-40, -18))
		var life := randf_range(0.9, 1.6)
		inst.mix_layer.add(["smoke", pos + Vector2(randf_range(-8, 8), randf_range(-4, 4)), v, life, life, size * randf_range(0.7, 1.3), col, alpha])


## осколки и пыль (камень, металл)
static func debris(pos: Vector2, col: Color, n := 6) -> void:
	if not ok():
		return
	for i in n:
		var a := randf_range(-PI * 0.95, -PI * 0.05)
		var v := Vector2(cos(a), sin(a)) * randf_range(80, 200)
		inst.mix_layer.add(["chunk", pos, v, randf_range(0.3, 0.6), 0.6, randf_range(2.0, 4.0), col, null])
	smoke(pos, 2, col.darkened(0.3), 0.35, 8.0)


## взрыв: вспышка, кольцо, искры, дым, гарь на полу, тряска камеры, звук; big — турель, корпус
static func explosion(ground: Vector2, big := false) -> void:
	if not ok():
		return
	var h := Vector2(0, -26 if big else -20)
	var p := ground + h
	var s := 1.6 if big else 1.0
	inst.glow_layer.add(["glow", p, Vector2.ZERO, 0.35 * s, 0.35 * s, 34.0 * s, Color(1.0, 0.6, 0.2), null])
	inst.glow_layer.add(["flash", p, Vector2.ZERO, 0.12, 0.12, 26.0 * s, Color(1.0, 0.85, 0.5), null])
	inst.glow_layer.add(["ring", ground, Vector2.ZERO, 0.4, 0.4, 70.0 * s, Color(1.0, 0.7, 0.35), null])
	sparks(p, Color(1.0, 0.75, 0.3), int(14 * s), 320.0 * s)
	debris(p, Color(0.35, 0.33, 0.32), int(6 * s))
	smoke(p, int(5 * s), Color(0.18, 0.17, 0.17), 0.6, 14.0 * s)
	scorch(ground, 26.0 * s)
	shake(5.0 * s, 0.35 * s)
	Core.play_at("explosion", ground, -2.0 if big else -5.0)
	# короткий свет от взрыва (один источник на 0.3 с)
	var l := PointLight2D.new()
	l.texture = _light_tex()
	l.color = Color(1.0, 0.6, 0.3)
	l.energy = 1.6
	l.texture_scale = 1.2 * s
	l.height = 40.0
	l.position = p
	inst.add_child(l)
	var tw := l.create_tween()
	tw.tween_property(l, "energy", 0.0, 0.35)
	tw.tween_callback(l.queue_free)


## гарь на полу (держится 25 с)
static func scorch(ground: Vector2, r := 24.0) -> void:
	if not ok():
		return
	inst.floor_layer.add(["scorch", ground, Vector2.ZERO, 25.0, 25.0, r, Color(0.05, 0.04, 0.04), null])


## всплывающее число (урон, добыча)
static func number(pos: Vector2, text: String, col: Color, size := 18) -> void:
	if not ok():
		return
	inst.mix_layer.add(["text", pos + Vector2(randf_range(-10, 10), 0), Vector2(randf_range(-10, 10), -70), 0.8, 0.8, size, col, text])


## тряска камеры
static func shake(power: float, sec: float) -> void:
	if not ok():
		return
	var cam := inst.get_viewport().get_camera_2d()
	if cam == null or cam.has_meta("shaking"):
		return
	cam.set_meta("shaking", true)
	var base := cam.offset
	var tw := cam.create_tween()
	for i in maxi(1, int(sec / 0.04)):
		var k := 1.0 - float(i) / maxf(1.0, sec / 0.04)
		tw.tween_property(cam, "offset", base + Vector2(randf_range(-power, power), randf_range(-power, power)) * k, 0.04)
	tw.tween_property(cam, "offset", base, 0.05)
	tw.tween_callback(func(): cam.remove_meta("shaking"))


static var _lt: Texture2D


static func _light_tex() -> Texture2D:
	if _lt == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		var gt := GradientTexture2D.new()
		gt.gradient = g
		gt.fill = GradientTexture2D.FILL_RADIAL
		gt.fill_from = Vector2(0.5, 0.5)
		gt.fill_to = Vector2(1.0, 0.5)
		gt.width = 128
		gt.height = 128
		_lt = gt
	return _lt
