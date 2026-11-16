extends Control
## Карта мира. Сюда герой попадает из главного меню и когда уходит с локации. Карта большая — в два с половиной
## раза шире и выше экрана, разведанная часть посередине, остальное закрыто туманом; двигается пальцем.
## Видно, где герой сейчас («Вы здесь»). Нажатие на локацию — слева выезжает панель с её рисунком и описанием;
## вход — только кнопкой «Войти».

const IMG := Vector2(1671, 941)   ## размер картинки разведанной части, в её точках заданы локации
const BIG := 2.5                  ## во сколько раз вся карта больше разведанной части (по ширине и высоте)
## локации: область на картинке, название, вид, описание, рисунок, сцена
const PLACES := {
	"home": {"rect": Rect2(700, 300, 320, 280), "n": "Дом", "kind": "Стабильный стаб", "d": "Ваш дом. Укрытие, защита и начало нового пути в мире Стикса.", "pic": "res://assets/ui/place_home.jpg", "scene": "res://world.tscn"},
}
const MAP_SHADER := """shader_type canvas_item;
// Карта и туман: внутри разведанной части — картинка, к её краям и дальше — клубящийся туман.
uniform sampler2D map : filter_linear_mipmap;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform vec2 view_pos;            // точка всей карты в левом верхнем углу экрана
uniform vec2 view_size;           // размер экрана
uniform vec4 map_rect;            // где на всей карте лежит картинка: x, y, ширина, высота
void fragment() {
	vec2 c = view_pos + UV * view_size;
	vec2 muv = (c - map_rect.xy) / map_rect.zw;
	vec3 col = texture(map, clamp(muv, vec2(0.0), vec2(1.0))).rgb;
	float edge = min(min(muv.x, 1.0 - muv.x), min(muv.y, 1.0 - muv.y));          // < 0 — за краем картинки
	float n = texture(noise, c / 900.0 + TIME * vec2(0.004, 0.002)).r * 0.6 + texture(noise, c / 330.0 - TIME * vec2(0.007, 0.004)).r * 0.4;
	float f = smoothstep(0.12, -0.05, edge + (n - 0.5) * 0.2);
	vec3 fog = mix(vec3(0.20, 0.22, 0.24), vec3(0.50, 0.54, 0.57), smoothstep(0.3, 0.75, n));
	COLOR = vec4(mix(col, fog, f), 1.0);
}
"""

var here := "home"                ## где герой сейчас
var sel := ""
var view: ColorRect
var mat: ShaderMaterial
var over: Control
var pan := Vector2.ZERO           ## точка всей карты в левом верхнем углу экрана
var panel: PanelContainer
var p_pic: TextureRect
var p_t: Label
var p_k: Label
var p_d: Label
var note: Label
var entering := false
var _drag := false
var _moved := 0.0
var _set_ui: Control
var test := ""
var out := "user://map"
const PANEL_W := 400.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ULSettings.apply(get_viewport())
	Music.play_menu()
	view = ColorRect.new()
	add_child(view)
	view.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	view.mouse_filter = Control.MOUSE_FILTER_IGNORE
	mat = ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = MAP_SHADER
	mat.shader = sh
	mat.set_shader_parameter("map", load("res://assets/ui/worldmap.jpg"))
	var fn := FastNoiseLite.new()
	fn.seed = 21
	fn.frequency = 0.011
	fn.fractal_octaves = 4
	mat.set_shader_parameter("noise", ImageTexture.create_from_image(fn.get_seamless_image(256, 256)))
	view.material = mat
	over = Control.new()
	add_child(over)
	over.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	over.mouse_filter = Control.MOUSE_FILTER_STOP
	over.draw.connect(_draw_over)
	over.gui_input.connect(_on_input)
	# панель локации — выезжает слева
	panel = PanelContainer.new()
	panel.add_theme_stylebox_override("panel", ULSettings._box(Color(0.05, 0.06, 0.07, 0.95)))
	add_child(panel)
	panel.anchor_bottom = 1.0
	panel.offset_top = 12
	panel.offset_bottom = -12
	_panel_x(-PANEL_W - 30.0)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	panel.add_child(vb)
	p_pic = TextureRect.new()
	p_pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	p_pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_COVERED
	p_pic.custom_minimum_size = Vector2(0, 250)
	vb.add_child(p_pic)
	p_t = _lbl(vb, 28, Color(0.96, 0.96, 0.94))
	p_k = _lbl(vb, 17, Color(0.75, 0.9, 0.35))
	p_d = _lbl(vb, 17, Color(0.82, 0.84, 0.86))
	p_d.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var hb := HBoxContainer.new()
	hb.add_theme_constant_override("separation", 8)
	vb.add_child(hb)
	hb.add_child(ULSettings.button("Закрыть", func() -> void: select(""), 130.0))
	var go := ULSettings.button("Войти", func() -> void: enter(sel), 200.0)
	go.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	hb.add_child(go)
	# шестерёнка — своя, всегда в углу экрана
	var gear := TextureButton.new()
	gear.texture_normal = load("res://assets/icons/ui/menu.png")
	gear.ignore_texture_size = true
	gear.stretch_mode = TextureButton.STRETCH_KEEP_ASPECT_CENTERED
	gear.anchor_left = 1.0
	gear.anchor_right = 1.0
	gear.offset_left = -98
	gear.offset_right = -22
	gear.offset_top = 16
	gear.offset_bottom = 92
	gear.pressed.connect(open_settings)
	add_child(gear)
	note = Label.new()
	note.add_theme_font_size_override("font_size", 18)
	note.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	note.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	note.add_theme_constant_override("outline_size", 8)
	note.text = "Карту можно двигать пальцем. Нажмите на локацию."
	add_child(note)
	note.anchor_left = 0.5
	note.anchor_right = 0.5
	note.offset_left = -300
	note.offset_right = 300
	note.offset_top = 16
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	note.mouse_filter = Control.MOUSE_FILTER_IGNORE
	await get_tree().process_frame
	center_on(here)
	if test != "":
		_run_test.call_deferred()


func _lbl(parent: Node, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l


func _panel_x(x: float) -> void:
	panel.offset_left = x
	panel.offset_right = x + PANEL_W


## масштаб: разведанная часть по ширине — как экран
func k() -> float:
	return size.x / IMG.x


## где на всей карте лежит картинка разведанной части
func map_rect() -> Rect2:
	var sz := IMG * k()
	return Rect2(sz * (BIG - 1.0) * 0.5, sz)


func canvas_size() -> Vector2:
	return IMG * k() * BIG


func set_pan(p: Vector2) -> void:
	var mx := canvas_size() - size
	pan = Vector2(clampf(p.x, 0.0, maxf(mx.x, 0.0)), clampf(p.y, 0.0, maxf(mx.y, 0.0)))


## локация в точках всей карты
func place_rect(id: String) -> Rect2:
	var r: Rect2 = PLACES[id].rect
	return Rect2(map_rect().position + r.position * k(), r.size * k())


func center_on(id: String) -> void:
	set_pan(place_rect(id).get_center() - size * 0.5)


func _process(_d: float) -> void:
	var mr := map_rect()
	mat.set_shader_parameter("view_pos", pan)
	mat.set_shader_parameter("view_size", size)
	mat.set_shader_parameter("map_rect", Vector4(mr.position.x, mr.position.y, mr.size.x, mr.size.y))
	over.queue_redraw()


## метка «Вы здесь» над локацией, где герой, и кольцо вокруг выбранной
func _draw_over() -> void:
	var f := ThemeDB.fallback_font
	for id in PLACES:
		var r := place_rect(id)
		r.position -= pan
		var c := r.get_center()
		if id == sel:
			over.draw_arc(c, r.size.x * 0.5, 0, TAU, 56, Color(1.0, 0.8, 0.3, 0.9), 3.0)
		if id == here:
			var kk := 1.0 + 0.07 * sin(Time.get_ticks_msec() * 0.005)
			over.draw_arc(c, r.size.x * 0.46 * kk, 0, TAU, 48, Color(1.0, 0.75, 0.25, 0.5), 2.0)
			var t := "Вы здесь"
			var w := f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
			var at := Vector2(c.x - w * 0.5, r.position.y - 6.0)
			over.draw_string_outline(f, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 7, Color(0, 0, 0, 0.9))
			over.draw_string(f, at, t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.86, 0.5))


func _on_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch or (e is InputEventMouseButton and e.button_index == MOUSE_BUTTON_LEFT):
		if e.pressed:
			_drag = true
			_moved = 0.0
		else:
			if _drag and _moved < 14.0:
				tap(e.position)
			_drag = false
	elif (e is InputEventScreenDrag or e is InputEventMouseMotion) and _drag:
		_moved += e.relative.length()
		set_pan(pan - e.relative)


## нажатие в точке экрана: локация — открыть её панель; мимо — закрыть панель
func tap(p: Vector2) -> void:
	for id in PLACES:
		if place_rect(id).has_point(p + pan):
			select(id)
			return
	select("")


func select(id: String) -> void:
	sel = id
	var tw := create_tween()
	if id == "":
		tw.tween_method(_panel_x, panel.offset_left, -PANEL_W - 30.0, 0.2)
		note.text = "Карту можно двигать пальцем. Нажмите на локацию."
		return
	var p: Dictionary = PLACES[id]
	p_pic.texture = load(String(p.pic)) if ResourceLoader.exists(String(p.pic)) else null
	p_t.text = String(p.n)
	p_k.text = String(p.kind) + (" · вы здесь" if id == here else "")
	p_d.text = String(p.d)
	tw.tween_method(_panel_x, panel.offset_left, 12.0, 0.25).set_trans(Tween.TRANS_CUBIC).set_ease(Tween.EASE_OUT)
	note.text = "«Войти» — зайти на локацию"


func enter(id: String) -> void:
	if not PLACES.has(id) or entering:
		return
	entering = true
	note.text = "Загрузка…"
	if test != "":
		return
	await get_tree().process_frame
	await get_tree().process_frame
	get_tree().change_scene_to_file(String(PLACES[id].scene))


func open_settings() -> void:
	if _set_ui != null and is_instance_valid(_set_ui):
		return
	_set_ui = ULSettings.panel(self, func() -> void: ULSettings.apply(get_viewport()), [
		["Главное меню", func() -> void: get_tree().change_scene_to_file("res://menu.tscn")],
		["Выйти из игры", func() -> void: get_tree().quit()],
	])


func _snap(n: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(out + "/" + n + ".png")


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	var ok := func(name: String, v: bool, extra := "") -> void:
		print("[map] %s — %s%s" % [name, "верно" if v else "ОШИБКА", (" (" + extra + ")") if extra != "" else ""])
	await get_tree().create_timer(0.8).timeout
	await _snap("p0_map")
	var c := place_rect("home").get_center() - pan
	ok.call("карта в 2.5 раза больше экрана по ширине, дом — посередине экрана", is_equal_approx(canvas_size().x, size.x * BIG) and c.distance_to(size * 0.5) < 2.0)
	var p0 := pan
	set_pan(pan + Vector2(260, 120))
	ok.call("карта двигается", pan.distance_to(p0 + Vector2(260, 120)) < 1.0)
	set_pan(Vector2(-5000, -5000))
	var at_min := pan == Vector2.ZERO
	set_pan(Vector2(1e6, 1e6))
	ok.call("за край карты увести нельзя", at_min and pan.is_equal_approx(canvas_size() - size))
	await get_tree().create_timer(0.4).timeout
	await _snap("p3_fog")
	center_on("home")
	tap(place_rect("home").get_center() - pan)
	await get_tree().create_timer(0.5).timeout
	ok.call("нажатие на дом — слева выехала панель с рисунком и описанием", sel == "home" and panel.offset_left > 0.0 and p_pic.texture != null and p_t.text == "Дом")
	await _snap("p1_selected")
	tap(place_rect("home").get_center() - pan)
	ok.call("второе нажатие на дом на локацию не заводит", not entering)
	enter(sel)
	ok.call("«Войти» — вход на локацию", entering and note.text == "Загрузка…")
	entering = false
	select("")
	open_settings()
	await get_tree().create_timer(0.5).timeout
	await _snap("p2_settings")
	get_tree().quit()
