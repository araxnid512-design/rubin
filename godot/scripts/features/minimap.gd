extends Node
## Миникарта и карта локации (как game/minimap.js в браузерной игре). План рисуется один раз на локацию в Image
## из данных уровня (meta.plan: покрытия, деревья, вода; здания, стены и препятствия, край кластера, выходы) —
## чёткий и почти бесплатный для видеокарты. В углу — круг плана вокруг героя (шейдер берёт кусок общей
## текстуры), поверх — стрелка героя, наёмники и муры, стрелки к выходам. Кнопка «Карта» — план крупно:
## тайники (обысканные — серые), выходы с подписями, жители стаба; пока карта открыта — игра на паузе.

## Пикселей плана на метр.
const PX := 4.0
## Миникарта: диаметр на экране и пикселей экрана на метр.
const MINI := 196.0
const MINI_K := 3.2
## Сторона карты локации в окне, пикселей экрана.
const MAP := 410.0

const GRASS := Color(0.337, 0.396, 0.243)
const GROUND := {"asphalt": Color(0.294, 0.302, 0.310), "dirt": Color(0.541, 0.459, 0.314), "concrete": Color(0.612, 0.604, 0.569), "sand": Color(0.722, 0.635, 0.478)}
## Кроны: цвет и радиус, м.
const TREE := {"birch": [Color(0.373, 0.486, 0.216), 1.7], "pine": [Color(0.200, 0.314, 0.173), 1.9], "apple": [Color(0.490, 0.549, 0.235), 1.7]}
const HOUSE := Color(0.627, 0.518, 0.384)
const WALL := Color(0.227, 0.200, 0.157)
const OBSTACLE := Color(0.243, 0.235, 0.212)
const WATER := Color(0.184, 0.298, 0.333)
const SHORE := Color(0.478, 0.416, 0.290)
const STATION_MARK := {"trade": "Торговец", "rest": "Лекарь", "mercs": "Наёмники", "room": "Комната", "info": "Информатор", "stash": "Хранилище"}

const MINI_SHADER := """
shader_type canvas_item;
// Круг миникарты: кусок плана вокруг героя (center — где герой в долях плана, span — какая доля плана
// умещается в диаметр), тёмный ободок и мягкий край.
uniform vec2 center = vec2(0.5, 0.5);
uniform float span = 0.47;
void fragment() {
	vec2 d = UV - vec2(0.5);
	float r = length(d);
	vec2 uv = center + d * span;
	vec4 c = texture(TEXTURE, uv);
	if (uv.x < 0.0 || uv.y < 0.0 || uv.x > 1.0 || uv.y > 1.0) {
		c = vec4(0.1, 0.12, 0.1, 1.0);
	}
	c.rgb = mix(c.rgb, vec3(0.07, 0.08, 0.07), smoothstep(0.452, 0.49, r));
	c.a = (1.0 - smoothstep(0.488, 0.5, r)) * 0.93;
	COLOR = c;
}
"""

var game: Node
var layer: CanvasLayer
var holder: Control
var mini_map: TextureRect
var mini_dots: Control
var mat: ShaderMaterial
## Готовые планы: id локации → ImageTexture (рисуются один раз за игру).
var plans := {}
var plan: ImageTexture
var half := 66.0
var redraw_t := 0.0
var paused_by_map := false
var big_over: Control

func setup(g: Node) -> void:
	game = g
	process_mode = Node.PROCESS_MODE_ALWAYS
	layer = CanvasLayer.new()
	layer.layer = 9  # под окнами и надписями экрана (у него 10)
	add_child(layer)
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(root)
	holder = Control.new()
	holder.mouse_filter = Control.MOUSE_FILTER_IGNORE
	holder.set_anchors_preset(Control.PRESET_TOP_RIGHT)
	holder.offset_left = -MINI - 22.0
	holder.offset_right = -22.0
	holder.offset_top = 94.0
	holder.offset_bottom = 94.0 + MINI
	holder.visible = false
	root.add_child(holder)
	mini_map = TextureRect.new()
	mini_map.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mini_map.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	mini_map.stretch_mode = TextureRect.STRETCH_SCALE
	mini_map.set_anchors_preset(Control.PRESET_FULL_RECT)
	mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = MINI_SHADER
	mat.shader = sh
	mini_map.material = mat
	holder.add_child(mini_map)
	mini_dots = Control.new()
	mini_dots.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mini_dots.set_anchors_preset(Control.PRESET_FULL_RECT)
	mini_dots.draw.connect(_draw_mini)
	holder.add_child(mini_dots)
	# кнопка «Карта» — у нижнего левого края миникарты
	game.hud.add_button("locmap", "Карта", Vector2(-120, -120), 74.0, _on_map_button)
	var b: Control = game.hud.buttons.get("locmap")
	if b:
		b.set_anchors_preset(Control.PRESET_TOP_RIGHT)
		b.offset_left = -MINI - 22.0 - 46.0
		b.offset_right = b.offset_left + 74.0
		b.offset_top = 94.0 + MINI - 64.0
		b.offset_bottom = b.offset_top + 74.0

func on_enter(id: String) -> void:
	if game.level == null:
		return
	half = float(game.level.half)
	if not plans.has(id):
		plans[id] = build_plan(game.level)
	plan = plans[id]
	mini_map.texture = plan
	mat.set_shader_parameter("span", MINI / MINI_K / (half * 2.0))
	holder.visible = true
	_follow()

func on_leave() -> void:
	close_map()

# ---------- План ----------

## Нарисовать план локации: север сверху, x — вправо, z — вниз; PX пикселей на метр.
func build_plan(level: Node) -> ImageTexture:
	var meta: Dictionary = level.meta
	var h: float = float(level.half)
	var play: float = float(level.play)
	var n := int(ceil(h * 2.0 * PX))
	var img := Image.create_empty(n, n, false, Image.FORMAT_RGBA8)
	img.fill(GRASS)
	# пятна на траве (всегда одни и те же)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 240:
		var c := GRASS.lerp(Color8(40, 52, 30), 0.18) if rng.randf() < 0.5 else GRASS.lerp(Color8(120, 130, 80), 0.14)
		_ellipse(img, Vector2(rng.randf() * n, rng.randf() * n), Vector2.ONE * (2.5 + rng.randf() * 8.0), c)
	var p: Dictionary = meta.get("plan", {})
	for g in p.get("grounds", []):
		_rect(img, h, float(g["x"]), float(g["z"]), float(g["w"]), float(g["d"]), float(g.get("ry", 0.0)), GROUND.get(g.get("kind", ""), GROUND["dirt"]))
	for w in p.get("water", []):
		var at := _px(h, float(w[0]), float(w[1]))
		_ellipse(img, at, Vector2(float(w[2]), float(w[3])) * PX * 1.1, SHORE)
		_ellipse(img, at, Vector2(float(w[2]), float(w[3])) * PX, WATER)
	# дома, куда можно зайти: пол, поверх — стены
	for b in meta.get("buildings", []):
		_rect(img, h, float(b["cx"]), float(b["cz"]), float(b["w"]), float(b["d"]), float(b.get("ry", 0.0)), HOUSE)
	var trees := {}
	for t in p.get("trees", []):
		trees["%d:%d" % [roundi(float(t[0]) * 100.0), roundi(float(t[1]) * 100.0)]] = true
	for k in meta.get("colliders", []):
		if trees.has("%d:%d" % [roundi(float(k[0]) * 100.0), roundi(float(k[1]) * 100.0)]):
			continue  # стволы — кронами
		if _in_water(p.get("water", []), float(k[0]), float(k[1])):
			continue  # пруд не заходим — но рисуем водой, а не стеной
		var thin: bool = minf(float(k[2]), float(k[3])) < 0.2
		var hx := maxf(float(k[2]), 0.7 / PX)
		var hz := maxf(float(k[3]), 0.7 / PX)
		_rect(img, h, float(k[0]), float(k[1]), hx * 2.0, hz * 2.0, float(k[4]), WALL if thin else OBSTACLE)
	# кроны — полупрозрачные круги, под ними видно дорожки
	var stamps := {}
	for t in p.get("trees", []):
		var kind: String = str(t[2]) if t.size() > 2 else "birch"
		var spec: Array = TREE.get(kind, TREE["birch"])
		if not stamps.has(kind):
			stamps[kind] = _disc_stamp(float(spec[1]) * PX, spec[0])
		var st: Image = stamps[kind]
		var at := _px(h, float(t[0]), float(t[1]))
		img.blend_rect(st, Rect2i(0, 0, st.get_width(), st.get_height()), Vector2i(roundi(at.x - st.get_width() / 2.0), roundi(at.y - st.get_height() / 2.0)))
	# край кластера — муть: тёмная рамка и пунктир «здесь выход на карту Улья»
	var edge := int(round((h - play) * PX))
	if edge > 0 and edge * 2 < n:
		var dark := Color(0.11, 0.125, 0.11, 0.78)
		var band_h := Image.create_empty(n, edge, false, Image.FORMAT_RGBA8)
		band_h.fill(dark)
		var band_v := Image.create_empty(edge, n - edge * 2, false, Image.FORMAT_RGBA8)
		band_v.fill(dark)
		img.blend_rect(band_h, Rect2i(0, 0, n, edge), Vector2i(0, 0))
		img.blend_rect(band_h, Rect2i(0, 0, n, edge), Vector2i(0, n - edge))
		img.blend_rect(band_v, Rect2i(0, 0, edge, n - edge * 2), Vector2i(0, edge))
		img.blend_rect(band_v, Rect2i(0, 0, edge, n - edge * 2), Vector2i(n - edge, edge))
		if meta.get("edge", true):
			var yellow := Color(0.91, 0.78, 0.38)
			var a := edge
			var z := n - edge
			var s := a
			while s < z:
				var l := mini(7, z - s)
				img.fill_rect(Rect2i(s, a - 1, l, 2), yellow)
				img.fill_rect(Rect2i(s, z - 1, l, 2), yellow)
				img.fill_rect(Rect2i(a - 1, s, 2, l), yellow)
				img.fill_rect(Rect2i(z - 1, s, 2, l), yellow)
				s += 12
	# выходы у дорог — светлые полосы
	for e in meta.get("exits", []):
		var r := Rect2i(Vector2i(_px(h, float(e["x0"]), float(e["z0"])).round()), Vector2i((Vector2(float(e["x1"]) - float(e["x0"]), float(e["z1"]) - float(e["z0"])) * PX).round()))
		r = r.intersection(Rect2i(0, 0, n, n))
		if r.has_area():
			var glow := Image.create_empty(r.size.x, r.size.y, false, Image.FORMAT_RGBA8)
			glow.fill(Color(0.94, 0.82, 0.39, 0.45))
			img.blend_rect(glow, Rect2i(Vector2i.ZERO, r.size), r.position)
	return ImageTexture.create_from_image(img)

func _in_water(water: Array, x: float, z: float) -> bool:
	for w in water:
		var dx := (x - float(w[0])) / maxf(0.1, float(w[2]))
		var dz := (z - float(w[1])) / maxf(0.1, float(w[3]))
		if dx * dx + dz * dz < 1.0:
			return true
	return false

func _px(h: float, x: float, z: float) -> Vector2:
	return Vector2((x + h) * PX, (z + h) * PX)

## Прямоугольник w×d с центром (cx, cz), повёрнутый на ry (как rotation.y в Godot): без поворота — fill_rect,
## с поворотом — заливка многоугольника построчно.
func _rect(img: Image, h: float, cx: float, cz: float, w: float, d: float, ry: float, col: Color) -> void:
	var s := sin(ry)
	var c := cos(ry)
	if absf(s) < 0.01 or absf(c) < 0.01:
		var sw := w if absf(s) < 0.01 else d
		var sd := d if absf(s) < 0.01 else w
		var p0 := _px(h, cx - sw / 2.0, cz - sd / 2.0)
		var r := Rect2i(roundi(p0.x), roundi(p0.y), maxi(1, roundi(sw * PX)), maxi(1, roundi(sd * PX)))
		r = r.intersection(Rect2i(0, 0, img.get_width(), img.get_height()))
		if r.has_area():
			img.fill_rect(r, col)
		return
	var pts := PackedVector2Array()
	for q in [Vector2(-1, -1), Vector2(1, -1), Vector2(1, 1), Vector2(-1, 1)]:
		var lx: float = q.x * w / 2.0
		var lz: float = q.y * d / 2.0
		pts.append(_px(h, cx + lx * c + lz * s, cz - lx * s + lz * c))
	_poly(img, pts, col)

## Выпуклый многоугольник (точки в пикселях плана) — построчно.
func _poly(img: Image, pts: PackedVector2Array, col: Color) -> void:
	var n := img.get_width()
	var y0 := n
	var y1 := -1
	for p in pts:
		y0 = mini(y0, int(floor(p.y)))
		y1 = maxi(y1, int(ceil(p.y)))
	for y in range(maxi(0, y0), mini(img.get_height() - 1, y1) + 1):
		var fy: float = y + 0.5
		var xa := INF
		var xb := -INF
		for i in pts.size():
			var a: Vector2 = pts[i]
			var b: Vector2 = pts[(i + 1) % pts.size()]
			if (a.y <= fy and b.y > fy) or (b.y <= fy and a.y > fy):
				var x := a.x + (fy - a.y) / (b.y - a.y) * (b.x - a.x)
				xa = minf(xa, x)
				xb = maxf(xb, x)
		if xb > xa:
			var ia := clampi(roundi(xa), 0, n)
			var ib := clampi(roundi(xb), 0, n)
			if ib == ia and ia < n:
				ib = ia + 1
			if ib > ia:
				img.fill_rect(Rect2i(ia, y, ib - ia, 1), col)

## Эллипс (радиусы в пикселях) — построчно.
func _ellipse(img: Image, at: Vector2, r: Vector2, col: Color) -> void:
	var n := img.get_width()
	for y in range(maxi(0, int(floor(at.y - r.y))), mini(img.get_height() - 1, int(ceil(at.y + r.y))) + 1):
		var k: float = (y + 0.5 - at.y) / r.y
		if absf(k) >= 1.0:
			continue
		var dx := r.x * sqrt(1.0 - k * k)
		var ia := clampi(roundi(at.x - dx), 0, n)
		var ib := clampi(roundi(at.x + dx), 0, n)
		if ib > ia:
			img.fill_rect(Rect2i(ia, y, ib - ia, 1), col)

## Круг кроны с прозрачностью 0,82 и мягким краем — штамп для blend_rect.
func _disc_stamp(r: float, col: Color) -> Image:
	var d := int(ceil(r * 2.0)) + 2
	var st := Image.create_empty(d, d, false, Image.FORMAT_RGBA8)
	st.fill(Color(col, 0.0))
	var c := d / 2.0
	for y in d:
		for x in d:
			var dist := Vector2(x + 0.5 - c, y + 0.5 - c).length()
			var a := clampf(r - dist + 0.5, 0.0, 1.0) * 0.82
			if a > 0.0:
				st.set_pixel(x, y, Color(col, a))
	return st

# ---------- Миникарта ----------

func _process(delta: float) -> void:
	if paused_by_map and not game.hud.panel.visible:
		_unpause()
	if get_tree().paused:
		return
	redraw_t -= delta
	if redraw_t <= 0.0 and holder.visible:
		redraw_t = 0.05
		_follow()

func _follow() -> void:
	if game.player == null or plan == null:
		return
	var p: Vector3 = game.player.global_position
	mat.set_shader_parameter("center", Vector2((p.x + half) / (half * 2.0), (p.z + half) / (half * 2.0)))
	mini_dots.queue_redraw()

## Направление взгляда героя на плане (x — вправо, z — вниз).
func _facing() -> Vector2:
	var ry: float = game.player.rotation.y
	return Vector2(sin(ry), cos(ry))

func _arrow(c: Control, at: Vector2, f: Vector2, size: float, fill: Color) -> void:
	var p := Vector2(-f.y, f.x)
	var pts := PackedVector2Array([at + f * size, at - f * size * 0.6 + p * size * 0.62, at - f * size * 0.25, at - f * size * 0.6 - p * size * 0.62])
	c.draw_colored_polygon(pts, fill)
	pts.append(pts[0])
	c.draw_polyline(pts, Color(0.05, 0.05, 0.05, 0.9), 1.5, true)

func _exit_name(e: Dictionary) -> String:
	var to = e.get("to")
	if to == null or not Data.NODES.has(str(to)):
		return "Улей"
	return Data.NODES[str(to)]["short"]

## Свои (наёмники) и муры: заражённые бросаются и на тех, и на других (game.targets), муры ещё и враги (hostiles).
func _people() -> Array:
	var out := []
	for t in game.targets:
		if is_instance_valid(t) and t.alive:
			out.append([t.global_position, game.hostiles.has(t)])
	return out

func _draw_mini() -> void:
	if game.player == null or game.level == null:
		return
	var c := mini_dots
	var r := MINI / 2.0
	var mid := Vector2(r, r)
	var p: Vector3 = game.player.global_position
	var font := ThemeDB.fallback_font
	for t in _people():
		var off := Vector2(t[0].x - p.x, t[0].z - p.z) * MINI_K
		if off.length() < r - 4.0:
			c.draw_circle(mid + off, 4.0, Color(0.85, 0.2, 0.15) if t[1] else Color(0.35, 0.7, 1.0))
	# выходы: дальше видимого — стрелка на краю круга с подписью
	for e in game.level.exits:
		var cx := clampf(p.x, float(e["x0"]), float(e["x1"]))
		var cz := clampf(p.z, float(e["z0"]), float(e["z1"]))
		var d := Vector2(cx - p.x, cz - p.z)
		var dist := d.length() * MINI_K
		var dir := d.normalized() if d.length() > 0.01 else Vector2.UP
		if dist > r - 12.0:
			var at := mid + dir * (r - 11.0)
			_arrow(c, at, dir, 9.0, Color(0.95, 0.82, 0.4))
			var text := _exit_name(e)
			var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
			var lp := at - dir * 20.0 + Vector2(-w / 2.0, 5.0)
			c.draw_string_outline(font, lp, text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, 4, Color(0, 0, 0, 0.85))
			c.draw_string(font, lp, text, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(1.0, 0.92, 0.65))
	_arrow(c, mid, _facing(), 11.0, Color(1, 1, 1))

# ---------- Карта локации ----------

func _on_map_button(down: bool) -> void:
	if down:
		open_map()

func open_map() -> void:
	if game.level == null or plan == null or game.hud.panel.visible:
		return
	var hud = game.hud
	var node: Dictionary = Data.NODES.get(game.loc, {})
	hud.show_panel(node.get("name", game.loc), "", [])
	var box: VBoxContainer = hud.panel_box
	var frame := Control.new()
	frame.custom_minimum_size = Vector2(MAP, MAP)
	frame.size_flags_horizontal = Control.SIZE_SHRINK_CENTER
	frame.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var tr := TextureRect.new()
	tr.texture = plan
	tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	tr.stretch_mode = TextureRect.STRETCH_SCALE
	tr.set_anchors_preset(Control.PRESET_FULL_RECT)
	tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
	frame.add_child(tr)
	big_over = Control.new()
	big_over.set_anchors_preset(Control.PRESET_FULL_RECT)
	big_over.mouse_filter = Control.MOUSE_FILTER_IGNORE
	big_over.draw.connect(_draw_big.bind(big_over))
	frame.add_child(big_over)
	box.add_child(frame)
	var info := Label.new()
	info.text = _map_info()
	info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info.custom_minimum_size = Vector2(580, 0)
	info.add_theme_font_size_override("font_size", 15)
	info.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	info.add_theme_constant_override("outline_size", 4)
	box.add_child(info)
	var close := Button.new()
	close.text = "Закрыть"
	close.custom_minimum_size = Vector2(0, 50)
	close.add_theme_font_size_override("font_size", 20)
	close.pressed.connect(close_map)
	box.add_child(close)
	# пока смотрим карту — игра на паузе (окно и кнопки работают)
	hud.process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().paused = true
	paused_by_map = true

func close_map() -> void:
	if paused_by_map:
		game.hud.hide_panel()
		_unpause()

func _unpause() -> void:
	paused_by_map = false
	big_over = null
	get_tree().paused = false

func _map_info() -> String:
	var lines := []
	var conts: Array = game.level.containers
	if not conts.is_empty():
		var left := 0
		for c in conts:
			if not c.get("searched", false):
				left += 1
		lines.append("Тайников не обыскано: %d из %d (жёлтые — не обысканы, серые — обысканы)" % [left, conts.size()])
	var exits := []
	for e in game.level.exits:
		exits.append(_exit_name(e))
	if not exits.is_empty():
		lines.append("Выходы: " + ", ".join(exits))
	if game.level.meta.get("edge", true):
		lines.append("Уйти можно и через край кластера — до мути (жёлтый пунктир).")
	return "\n".join(lines)

func _draw_big(c: Control) -> void:
	if game.level == null or game.player == null:
		return
	var k := MAP / (half * 2.0)
	var to := func(x: float, z: float) -> Vector2: return Vector2((x + half) * k, (z + half) * k)
	var font := ThemeDB.fallback_font
	for cont in game.level.containers:
		var done: bool = cont.get("searched", false)
		c.draw_circle(to.call(float(cont["x"]), float(cont["z"])), 4.5, Color(0.55, 0.55, 0.52) if done else Color(0.98, 0.8, 0.25))
		c.draw_arc(to.call(float(cont["x"]), float(cont["z"])), 4.5, 0.0, TAU, 12, Color(0.1, 0.1, 0.1, 0.8), 1.0, true)
	for s in game.level.meta.get("stations", []):
		var at: Vector2 = to.call(float(s["x"]), float(s["z"]))
		c.draw_circle(at, 6.0, Color(0.11, 0.31, 0.61))
		var text: String = STATION_MARK.get(str(s.get("id", "")), str(s.get("name", "")))
		_label(c, font, at + Vector2(0, -9), text, 12, Color(0.85, 0.92, 1.0))
	var play: float = float(game.level.play)
	for e in game.level.exits:
		var x := clampf((float(e["x0"]) + float(e["x1"])) / 2.0, -play + 5.0, play - 5.0)
		var z := clampf((float(e["z0"]) + float(e["z1"])) / 2.0, -play + 3.0, play - 3.0)
		var text := _exit_name(e) if e.get("to") != null else "Выход"
		var at2: Vector2 = to.call(x, z)
		var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14).x
		var box := StyleBoxFlat.new()
		box.bg_color = Color(0.12, 0.12, 0.1, 0.85)
		box.border_color = Color(0.95, 0.82, 0.4)
		box.set_border_width_all(2)
		box.set_corner_radius_all(11)
		c.draw_style_box(box, Rect2(at2 - Vector2(w / 2.0 + 10.0, 11.0), Vector2(w + 20.0, 22.0)))
		c.draw_string(font, at2 + Vector2(-w / 2.0, 5.0), text, HORIZONTAL_ALIGNMENT_LEFT, -1, 14, Color(1.0, 0.92, 0.65))
	for t in _people():
		c.draw_circle(to.call(t[0].x, t[0].z), 4.5, Color(0.85, 0.2, 0.15) if t[1] else Color(0.35, 0.7, 1.0))
	var p: Vector3 = game.player.global_position
	var hero: Vector2 = to.call(p.x, p.z)
	c.draw_circle(hero, 13.0, Color(1, 1, 1, 0.18))
	_arrow(c, hero, _facing(), 11.0, Color(1, 1, 1))

func _label(c: Control, font: Font, at: Vector2, text: String, size: int, col: Color) -> void:
	var w := font.get_string_size(text, HORIZONTAL_ALIGNMENT_LEFT, -1, size).x
	var lp := at + Vector2(-w / 2.0, 0)
	c.draw_string_outline(font, lp, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, 4, Color(0, 0, 0, 0.85))
	c.draw_string(font, lp, text, HORIZONTAL_ALIGNMENT_LEFT, -1, size, col)

# ---------- Автотест ----------

func smoke() -> int:
	var fail := 0
	# автотест игры уже прошёл по всем локациям — у каждой должен быть свой план
	for id in Data.NODES:
		var tex: ImageTexture = plans.get(id)
		var ok: bool = tex != null and tex.get_width() >= int(132.0 * PX) - 2
		print(("✓ " if ok else "✗ ") + "миникарта: план «%s» %s" % [Data.NODES[id]["short"], ("%d×%d" % [tex.get_width(), tex.get_height()]) if tex else "не нарисован"])
		if not ok:
			fail += 1
	var shown: bool = holder.visible and mini_map.texture == plans.get(game.loc)
	print(("✓ " if shown else "✗ ") + "миникарта в углу показывает план текущей локации (%s)" % game.loc)
	if not shown:
		fail += 1
	# план не пустой: в середине не одна трава
	var img: Image = plan.get_image() if plan else null
	if img and not img.is_empty():
		var colors := {}
		for i in 400:
			colors[img.get_pixel(i * 7 % img.get_width(), i * 13 % img.get_height()).to_html()] = true
		var varied := colors.size() > 3
		print(("✓ " if varied else "✗ ") + "на плане разные покрытия и постройки: цветов в пробе %d" % colors.size())
		if not varied:
			fail += 1
	else:
		print("· картинку плана в этом режиме не прочитать — проверка цветов пропущена")
	open_map()
	await get_tree().create_timer(0.3).timeout
	var opened: bool = game.hud.panel.visible and get_tree().paused and big_over != null
	print(("✓ " if opened else "✗ ") + "карта локации открылась, игра на паузе")
	if not opened:
		fail += 1
	close_map()
	await get_tree().create_timer(0.1).timeout
	var closed: bool = not game.hud.panel.visible and not get_tree().paused
	print(("✓ " if closed else "✗ ") + "карта закрылась, игра идёт")
	if not closed:
		fail += 1
	return fail
