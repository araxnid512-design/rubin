extends Control
## Карта мира. Сюда герой попадает из главного меню и когда уходит с локации. Видно, где он сейчас («Вы здесь»).
## Нажатие на локацию — слева внизу её описание; второе нажатие (или «Войти») — вход на локацию.

## локации: область на картинке карты, название, вид, описание, сцена
const PLACES := {
	"home": {"rect": Rect2(700, 300, 320, 280), "n": "Дом", "kind": "Стабильный стаб", "d": "Ваш дом. Укрытие, защита и начало нового пути в мире Стикса.", "scene": "res://world.tscn"},
}
var bd: ULBackdrop
var here := "home"                ## где герой сейчас
var sel := ""
var card: PanelContainer
var card_t: Label
var card_k: Label
var card_d: Label
var note: Label
var test := ""
var out := "user://map"


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	ULSettings.apply(get_viewport())
	bd = ULBackdrop.new()
	bd.tex = load("res://assets/ui/worldmap.jpg")
	bd.areas = {"gear": Rect2(36, 24, 94, 90)}
	for id in PLACES:
		bd.areas[id] = PLACES[id].rect
	add_child(bd)
	bd.tapped.connect(_on_tap)
	bd.overlay = _draw_here
	# карточка локации — слева внизу
	card = PanelContainer.new()
	card.add_theme_stylebox_override("panel", ULSettings._box(Color(0.05, 0.06, 0.07, 0.93)))
	add_child(card)
	card.anchor_top = 1.0
	card.anchor_bottom = 1.0
	card.offset_left = 18
	card.offset_right = 470
	card.offset_top = -214
	card.offset_bottom = -18
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 6)
	card.add_child(vb)
	card_t = _lbl(vb, 24, Color(0.96, 0.96, 0.94))
	card_k = _lbl(vb, 16, Color(0.75, 0.9, 0.35))
	card_d = _lbl(vb, 16, Color(0.82, 0.84, 0.86))
	card_d.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	vb.add_child(hb)
	hb.add_child(ULSettings.button("Войти", func() -> void: enter(sel), 150.0))
	card.visible = false
	note = Label.new()
	note.add_theme_font_size_override("font_size", 18)
	note.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	note.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.9))
	note.add_theme_constant_override("outline_size", 8)
	note.text = "Выберите локацию"
	add_child(note)
	note.anchor_left = 0.5
	note.anchor_right = 0.5
	note.offset_left = -200
	note.offset_right = 200
	note.offset_top = 18
	note.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	if test != "":
		_run_test.call_deferred()


func _lbl(parent: Node, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	parent.add_child(l)
	return l


func _process(_d: float) -> void:
	bd.queue_redraw()


## метка «Вы здесь» над локацией, где герой, и рамка вокруг выбранной
func _draw_here() -> void:
	if PLACES.has(here):
		var r := bd.to_screen(PLACES[here].rect)
		var c := Vector2(r.get_center().x, r.position.y + r.size.y * 0.08)
		var k := 1.0 + 0.08 * sin(Time.get_ticks_msec() * 0.005)
		bd.draw_arc(c + Vector2(0, r.size.y * 0.42), r.size.x * 0.46 * k, 0, TAU, 48, Color(1.0, 0.75, 0.25, 0.55), 2.5)
		var f := ThemeDB.fallback_font
		var t := "Вы здесь"
		var w := f.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17).x
		bd.draw_string_outline(f, c - Vector2(w * 0.5, 8), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, 7, Color(0, 0, 0, 0.9))
		bd.draw_string(f, c - Vector2(w * 0.5, 8), t, HORIZONTAL_ALIGNMENT_LEFT, -1, 17, Color(1.0, 0.86, 0.5))


func _on_tap(id: String) -> void:
	if id == "gear":
		ULSettings.panel(self, func() -> void: ULSettings.apply(get_viewport()), [["Главное меню", func() -> void: get_tree().change_scene_to_file("res://menu.tscn")]])
		return
	if not PLACES.has(id):
		return
	if sel == id:
		enter(id)                       # второе нажатие на выбранную локацию — войти
		return
	sel = id
	var p: Dictionary = PLACES[id]
	card_t.text = String(p.n)
	card_k.text = String(p.kind) + (" · вы здесь" if id == here else "")
	card_d.text = String(p.d)
	card.visible = true
	note.text = "Нажмите ещё раз, чтобы войти"


func enter(id: String) -> void:
	if not PLACES.has(id):
		return
	note.text = "Загрузка…"
	card.visible = false
	if test != "":
		return
	await get_tree().process_frame
	await get_tree().process_frame
	get_tree().change_scene_to_file(String(PLACES[id].scene))


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(0.8).timeout
	get_viewport().get_texture().get_image().save_png(out + "/p0_map.png")
	var c := bd.to_screen(PLACES["home"].rect).get_center()
	var ok1 := bd._hit(c) == "home" and not card.visible
	_on_tap("home")
	await get_tree().create_timer(0.5).timeout
	var ok2 := sel == "home" and card.visible and card_t.text == "Дом"
	get_viewport().get_texture().get_image().save_png(out + "/p1_selected.png")
	_on_tap("home")
	var ok3 := note.text == "Загрузка…"
	print("[map] первое нажатие на локацию — описание слева — ", "верно" if ok1 and ok2 else "ОШИБКА")
	print("[map] второе нажатие — вход на локацию — ", "верно" if ok3 else "ОШИБКА")
	get_tree().quit()
