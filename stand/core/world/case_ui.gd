class_name ULCaseUI
extends Control
## Окно оружейного сундука во весь экран (горизонтальный телефон): лента карточек оружия едет справа налево —
## сначала быстро, затем всё медленнее — и останавливается под неподвижной указательной линией на награде,
## которую ULCase.open_chest уже выбрал и записал. Окно ничего не решает: оно только показывает результат.
## Карточка: значок оружия, название, рамка цвета редкости, состояние. «Пропустить» — сразу к концу. После
## остановки — крупная карточка и «Забрать» (в тесте кейсов — «Ещё раз» и «Закрыть», в инвентарь ничего не идёт).
## У легендарного — золотое сияние и искры. Звук: щелчок на каждой карточке под линией, удар замка в конце.

signal closed(claimed: bool)

const CARD_W := 210.0
const CARD_H := 220.0
const GAP := 14.0
const C_BG0 := Color(0.055, 0.06, 0.065)
const C_BG1 := Color(0.13, 0.135, 0.14)
const C_TEXT := Color(0.9, 0.9, 0.86)

var reward: Dictionary = {}
var test := false
var claim_fn: Callable                       ## () -> {ok, err}; в тесте не задаётся
var spin_s := 7.0
var done := false                            ## лента остановилась
var claimed := false

var _t := 0.0
var _x0 := 0.0
var _x1 := 0.0
var _track: Control
var _strip: Control
var _cards: Array = []
var _last_idx := -1
var _skip: Button
var _result: Control
var _msg: Label
var _tick: AudioStreamPlayer
var _stop_snd: AudioStreamPlayer
var _gold: ColorRect
var _win_card: Control
var _pulse := 0.0
var ids: Array = []                          ## что на ленте (для проверок)
var win_at := 52


func _ready() -> void:
	set_anchors_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	_tick = AudioStreamPlayer.new()
	_tick.volume_db = -10.0
	add_child(_tick)
	_stop_snd = AudioStreamPlayer.new()
	_stop_snd.volume_db = -2.0
	add_child(_stop_snd)


## показать прокрутку к уже выбранной награде rw (ULCase.roll / open_chest)
func start(rw: Dictionary, is_test := false) -> void:
	reward = rw
	test = is_test
	var cfg := ULCase.cfg()
	spin_s = float(cfg.get("spin_s", 7.0))
	win_at = int(cfg.get("win_at", 52))
	var n := maxi(int(cfg.get("cards", 64)), win_at + 6)
	for c in get_children():
		if c != _tick and c != _stop_snd:
			c.queue_free()
	_cards.clear()
	ids.clear()
	var vs := get_viewport_rect().size
	# фон: тёмный металл — вертикальный градиент, тонкие полосы, заклёпки по краям
	var bg := TextureRect.new()
	var gt := GradientTexture2D.new()
	var g := Gradient.new()
	g.set_color(0, C_BG1)
	g.set_color(1, C_BG0)
	gt.gradient = g
	gt.fill_from = Vector2(0.5, 0.0)
	gt.fill_to = Vector2(0.5, 1.0)
	bg.texture = gt
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	bg.stretch_mode = TextureRect.STRETCH_SCALE
	add_child(bg)
	for k in 14:
		var ln := ColorRect.new()
		ln.color = Color(1, 1, 1, 0.025 if k % 2 == 0 else 0.012)
		ln.position = Vector2(0, vs.y * k / 14.0)
		ln.size = Vector2(vs.x, 2)
		add_child(ln)
	for p in [Vector2(18, 18), Vector2(vs.x - 30, 18), Vector2(18, vs.y - 30), Vector2(vs.x - 30, vs.y - 30)]:
		var rv := Panel.new()
		var rs := StyleBoxFlat.new()
		rs.bg_color = Color(0.32, 0.33, 0.34)
		rs.set_corner_radius_all(6)
		rs.set_border_width_all(2)
		rs.border_color = Color(0.08, 0.08, 0.08)
		rv.add_theme_stylebox_override("panel", rs)
		rv.position = p
		rv.size = Vector2(12, 12)
		add_child(rv)
	_gold = ColorRect.new()
	_gold.color = Color(1.0, 0.75, 0.2, 0.0)
	_gold.set_anchors_preset(Control.PRESET_FULL_RECT)
	_gold.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(_gold)
	var title := Label.new()
	title.text = "ТЕСТ КЕЙСОВ — ОРУЖЕЙНЫЙ СУНДУК" if test else "ОРУЖЕЙНЫЙ СУНДУК ГЛАВАРЯ МУРОВ"
	title.add_theme_font_size_override("font_size", 34)
	title.add_theme_color_override("font_color", Color(0.95, 0.78, 0.42))
	title.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	title.add_theme_constant_override("outline_size", 6)
	title.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	title.position = Vector2(0, vs.y * 0.08)
	title.size = Vector2(vs.x, 48)
	add_child(title)
	var sub := Label.new()
	sub.text = "Один ключ — одна прокрутка — одно оружие"
	sub.add_theme_font_size_override("font_size", 20)
	sub.add_theme_color_override("font_color", Color(0.7, 0.72, 0.7))
	sub.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	sub.position = Vector2(0, vs.y * 0.08 + 46)
	sub.size = Vector2(vs.x, 30)
	add_child(sub)
	# лента
	_strip = Control.new()
	_strip.clip_contents = true
	_strip.position = Vector2(0, vs.y * 0.5 - CARD_H * 0.5 - 14)
	_strip.size = Vector2(vs.x, CARD_H + 28)
	add_child(_strip)
	var band := ColorRect.new()
	band.color = Color(0, 0, 0, 0.45)
	band.size = _strip.size
	_strip.add_child(band)
	_track = Control.new()
	_strip.add_child(_track)
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	for i in n:
		var cid := ""
		var rr := ""
		var cc := 1.0
		if i == win_at:
			cid = String(rw.id)
			rr = String(rw.rarity)
			cc = float(rw.cond)
		else:
			var f := ULCase.roll(rng)
			cid = String(f.id)
			rr = String(f.rarity)
			cc = float(f.cond)
		ids.append(cid)
		var card := _card(cid, rr, cc, CARD_W, CARD_H)
		card.position = Vector2(i * (CARD_W + GAP), 14)
		_track.add_child(card)
		_cards.append(card)
		if i == win_at:
			_win_card = card
	# неподвижная указательная линия с треугольниками сверху и снизу
	var cx := vs.x * 0.5
	var line := ColorRect.new()
	line.color = Color(1.0, 0.82, 0.3)
	line.position = Vector2(cx - 2, _strip.position.y - 6)
	line.size = Vector2(4, _strip.size.y + 12)
	add_child(line)
	for up in [true, false]:
		var tri := Polygon2D.new()
		var y: float = _strip.position.y - 8 if up else _strip.position.y + _strip.size.y + 8
		var s := -1.0 if up else 1.0
		tri.polygon = PackedVector2Array([Vector2(cx - 14, y + s * 18), Vector2(cx + 14, y + s * 18), Vector2(cx, y)])
		tri.color = Color(1.0, 0.82, 0.3)
		add_child(tri)
	# откуда и куда едет лента: под линией в конце — выбранная карточка (не точно по центру — для интриги)
	_x0 = cx - (CARD_W + GAP) * 2.5
	var jitter := rng.randf_range(-0.36, 0.36) * CARD_W
	_x1 = cx - (win_at * (CARD_W + GAP) + CARD_W * 0.5 + jitter)
	_track.position.x = _x0
	_t = 0.0
	done = false
	claimed = false
	_last_idx = -1
	_skip = _button("Пропустить", Vector2(vs.x - 270, vs.y - 96), Vector2(240, 68))
	_skip.pressed.connect(skip)
	_msg = Label.new()
	_msg.add_theme_font_size_override("font_size", 22)
	_msg.add_theme_color_override("font_color", Color(1.0, 0.6, 0.45))
	_msg.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_msg.position = Vector2(0, vs.y - 60)
	_msg.size = Vector2(vs.x, 30)
	add_child(_msg)
	set_process(true)


func _button(txt: String, at: Vector2, sz: Vector2) -> Button:
	var b := Button.new()
	b.text = txt
	b.position = at
	b.size = sz
	b.add_theme_font_size_override("font_size", 26)
	for st in ["normal", "hover", "pressed"]:
		var sb := StyleBoxFlat.new()
		sb.bg_color = Color(0.2, 0.22, 0.18) if st == "normal" else (Color(0.28, 0.3, 0.24) if st == "hover" else Color(0.14, 0.15, 0.12))
		sb.set_border_width_all(3)
		sb.border_color = Color(0.85, 0.66, 0.3)
		sb.set_corner_radius_all(8)
		b.add_theme_stylebox_override(st, sb)
	add_child(b)
	return b


## карточка оружия: значок, название, рамка редкости, полоса состояния
func _card(id: String, rarity_id: String, cond: float, w: float, h: float) -> Control:
	var r := ULCase.rarity(rarity_id)
	var col := Color.html(String(r.get("color", "#9aa3ad")))
	var p := Panel.new()
	p.size = Vector2(w, h)
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.1, 0.105, 0.11)
	sb.set_border_width_all(4)
	sb.border_color = col
	sb.set_corner_radius_all(8)
	sb.shadow_color = Color(col.r, col.g, col.b, 0.25)
	sb.shadow_size = 6
	p.add_theme_stylebox_override("panel", sb)
	# фон под значком — отсвет редкости снизу
	var glow := TextureRect.new()
	var gt := GradientTexture2D.new()
	var g := Gradient.new()
	g.set_color(0, Color(col.r, col.g, col.b, 0.0))
	g.set_color(1, Color(col.r, col.g, col.b, 0.35))
	gt.gradient = g
	gt.fill_from = Vector2(0.5, 0.0)
	gt.fill_to = Vector2(0.5, 1.0)
	glow.texture = gt
	glow.position = Vector2(6, 6)
	glow.size = Vector2(w - 12, h * 0.6)
	glow.stretch_mode = TextureRect.STRETCH_SCALE
	p.add_child(glow)
	var ic := TextureRect.new()
	ic.texture = ULItems.icon(id) if ULItems.ITEMS.has(id) else null
	ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	ic.position = Vector2(10, 10)
	ic.size = Vector2(w - 20, h * 0.58)
	p.add_child(ic)
	var nm := Label.new()
	nm.text = String(ULItems.get_def(id).get("n", id))
	nm.add_theme_font_size_override("font_size", int(clampf(w * 0.095, 16, 34)))
	nm.add_theme_color_override("font_color", C_TEXT)
	nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	nm.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	nm.position = Vector2(6, h * 0.62)
	nm.size = Vector2(w - 12, h * 0.2)
	p.add_child(nm)
	var cd := Label.new()
	cd.text = "%s · %d %%" % [ULCase.cond_name(cond), int(round(cond * 100.0))]
	cd.add_theme_font_size_override("font_size", int(clampf(w * 0.07, 13, 24)))
	cd.add_theme_color_override("font_color", Color(0.7, 0.72, 0.68))
	cd.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	cd.position = Vector2(6, h * 0.82)
	cd.size = Vector2(w - 12, h * 0.1)
	p.add_child(cd)
	var bar := ColorRect.new()
	bar.color = col
	bar.position = Vector2(4, h - 10)
	bar.size = Vector2(w - 8, 6)
	p.add_child(bar)
	return p


func skip() -> void:
	if not done:
		_t = spin_s


func _process(delta: float) -> void:
	if _track == null:
		return
	if not done:
		_t = minf(_t + delta, spin_s)
		var u := _t / maxf(spin_s, 0.01)
		var k := 1.0 - pow(1.0 - u, 3.4)                     # быстро в начале, всё медленнее к концу
		_track.position.x = lerpf(_x0, _x1, k)
		var idx := int(floor((get_viewport_rect().size.x * 0.5 - _track.position.x) / (CARD_W + GAP)))
		if idx != _last_idx:
			_last_idx = idx
			_play(_tick, "casing", 0.9 + u * 0.4)
		if _t >= spin_s:
			_finish()
	else:
		_pulse += delta
		if _win_card:
			_win_card.modulate = Color(1, 1, 1).lerp(Color(1.35, 1.3, 1.1), 0.5 + 0.5 * sin(_pulse * 5.0))
		if String(reward.get("rarity", "")) == "legend" and _gold:
			_gold.color.a = 0.08 + 0.06 * sin(_pulse * 3.0)


func _play(p: AudioStreamPlayer, n: String, pitch := 1.0) -> void:
	var path := "res://assets/audio/%s_%d.ogg" % [n, randi() % 2 + 1]
	if not ResourceLoader.exists(path):
		path = "res://assets/audio/%s.ogg" % n
	if not ResourceLoader.exists(path):
		return
	p.stream = load(path)
	p.pitch_scale = pitch
	p.play()


func _finish() -> void:
	done = true
	_track.position.x = _x1
	_play(_stop_snd, "box_in", 0.9)
	if _skip:
		_skip.visible = false
	_show_result()


func _show_result() -> void:
	var vs := get_viewport_rect().size
	_result = Control.new()
	_result.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(_result)
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.55)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	_result.add_child(dim)
	var w := minf(460.0, vs.x * 0.42)
	var h := w * 1.0
	var big := _card(String(reward.id), String(reward.rarity), float(reward.cond), w, h)
	big.position = Vector2(vs.x * 0.5 - w * 0.5, vs.y * 0.5 - h * 0.5 - 30)
	_result.add_child(big)
	var rl := Label.new()
	rl.text = "%s · прочность %d из %d" % [String(reward.get("rn", "")), int(reward.dur), int(ULItems.get_def(String(reward.id)).get("dur", 0))]
	rl.add_theme_font_size_override("font_size", 24)
	rl.add_theme_color_override("font_color", Color.html(String(reward.get("color", "#ffffff"))))
	rl.add_theme_color_override("font_outline_color", Color(0, 0, 0))
	rl.add_theme_constant_override("outline_size", 5)
	rl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	rl.position = Vector2(0, big.position.y - 40)
	rl.size = Vector2(vs.x, 34)
	_result.add_child(rl)
	if String(reward.get("rarity", "")) == "legend":
		# легендарное: золотые искры вокруг карточки
		var sp := CPUParticles2D.new()
		sp.position = big.position + Vector2(w * 0.5, h * 0.5)
		sp.amount = 90
		sp.lifetime = 1.6
		sp.emission_shape = CPUParticles2D.EMISSION_SHAPE_RECTANGLE
		sp.emission_rect_extents = Vector2(w * 0.55, h * 0.55)
		sp.direction = Vector2(0, -1)
		sp.spread = 60.0
		sp.initial_velocity_min = 30.0
		sp.initial_velocity_max = 90.0
		sp.gravity = Vector2(0, 20)
		sp.scale_amount_min = 2.0
		sp.scale_amount_max = 5.0
		sp.color = Color(1.0, 0.82, 0.3)
		_result.add_child(sp)
		_play(_tick, "shell_in", 0.8)
	var by := big.position.y + h + 18
	if test:
		var again := _button("Ещё раз", Vector2(vs.x * 0.5 - 260, by), Vector2(240, 70))
		again.pressed.connect(func():
			closed.emit(false)
			start(ULCase.roll(_rng()), true))
		var cl := _button("Закрыть", Vector2(vs.x * 0.5 + 20, by), Vector2(240, 70))
		cl.pressed.connect(close)
		_msg.text = "Тест: награда в инвентарь не выдаётся"
		_msg.reparent(_result)
	else:
		var take := _button("Забрать", Vector2(vs.x * 0.5 - 130, by), Vector2(260, 74))
		take.pressed.connect(_take)
		_msg.reparent(_result)
	_result.move_to_front()


func _rng() -> RandomNumberGenerator:
	var r := RandomNumberGenerator.new()
	r.randomize()
	return r


func _take() -> void:
	if claim_fn.is_valid():
		var res: Dictionary = claim_fn.call()
		if not res.get("ok", false):
			if String(res.get("err", "")) == "full":
				_msg.text = "Нет места в инвентаре — освободите ячейку. Награда ждёт в окне выдачи."
				var cl := _button("Закрыть", Vector2(get_viewport_rect().size.x - 270, get_viewport_rect().size.y - 96), Vector2(240, 68))
				cl.reparent(_result)
				cl.pressed.connect(close)
			return
	claimed = true
	close()


func close() -> void:
	closed.emit(claimed)
	queue_free()
