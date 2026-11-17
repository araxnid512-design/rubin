class_name ULSettings
extends RefCounted
## Настройки игры: качество графики и громкость. Хранятся в user://settings.json, применяются к окну и звуку.
## Графика: чем ниже — тем меньше точек считает телефон (трёхмерная картинка рисуется в меньшем разрешении и
## растягивается; надписи и кнопки остаются чёткими), реже трава и ближе граница её показа.

const PATH := "user://settings.json"
const GFX := [
	{"n": "Низкая", "scale": 0.42, "msaa": false, "grass": 0.25, "range": 16.0},
	{"n": "Средняя", "scale": 0.55, "msaa": false, "grass": 0.6, "range": 24.0},
	{"n": "Высокая", "scale": 0.8, "msaa": true, "grass": 1.0, "range": 30.0},
]
## Камера: угол наклона (от земли) и поворот вокруг героя. «С наклоном» — как в DoZ Survival, «По диагонали» —
## как в Last Day on Earth (дома и заборы — ромбом).
const CAMS := [
	{"n": "Сверху", "pitch": 61.0, "yaw": 0.0},
	{"n": "С наклоном", "pitch": 52.0, "yaw": 0.0},
	{"n": "По диагонали", "pitch": 50.0, "yaw": 45.0},
]
const SCALE_MIN := 0.3            ## ниже разрешение само не опускается
const FPS_MIN := 38.0             ## частота кадров, ниже которой разрешение снижается сразу и крупным шагом
const C_BG := Color(0.06, 0.09, 0.13, 0.98)
const C_LINE := Color(0.35, 0.75, 0.95, 0.7)
const C_TEXT := Color(0.88, 0.93, 0.97)

static var arena := false                  ## следующая загрузка world.tscn — полигон 10×10 м, а не локация
static var level_test := false             ## «Тест уровней» из главного меню: герой с пулемётом, бессмертный, патроны без конца, без сохранения
static var bench := false                  ## «Тест уровней» с замером: герой сам обходит точки, в конце — таблица FPS
static var place := "home"                 ## какую локацию строит world.tscn: home — дом, cowshed — «Опасный коровник», sanatorium — «Санаторий Луч»
static var arrival_note := ""              ## что сказать герою по прибытии (после гибели в кластере и т. п.)
static var arrival_title := ""             ## заголовок записки (название кластера)
static var stand_who := "hero"             ## кого показывает стенд 3D: hero — герой, иначе вид врага (ULEnemy.KINDS)
static var stand_back := "res://world.tscn"   ## куда ведёт «Назад» со стенда
static var gfx := 1
static var cam := 1
static var volume := 0.8
static var _loaded := false


static func load_cfg() -> void:
	if _loaded:
		return
	_loaded = true
	if FileAccess.file_exists(PATH):
		var d = JSON.parse_string(FileAccess.get_file_as_string(PATH))
		if d is Dictionary:
			gfx = clampi(int(d.get("gfx", 1)), 0, GFX.size() - 1)
			volume = clampf(float(d.get("volume", 0.8)), 0.0, 1.0)
			cam = clampi(int(d.get("cam", 1)), 0, CAMS.size() - 1)


static func save_cfg() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"gfx": gfx, "volume": volume, "cam": cam}))


static func q() -> Dictionary:
	return GFX[gfx]


## применить к окну: разрешение трёхмерной картинки, сглаживание, громкость
static func apply(vp: Viewport) -> void:
	load_cfg()
	vp.scaling_3d_scale = float(q().scale)
	vp.msaa_3d = Viewport.MSAA_2X if bool(q().msaa) else Viewport.MSAA_DISABLED
	AudioServer.set_bus_mute(0, volume <= 0.005)
	AudioServer.set_bus_volume_db(0, linear_to_db(maxf(volume, 0.005)))


static func _box(bg: Color) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = C_LINE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(5)
	sb.set_content_margin_all(12)
	return sb


static func button(text: String, cb: Callable, w := 150.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 52)
	b.add_theme_font_size_override("font_size", 19)
	b.add_theme_stylebox_override("normal", _box(Color(0.09, 0.13, 0.19)))
	b.add_theme_stylebox_override("hover", _box(Color(0.12, 0.18, 0.26)))
	b.add_theme_stylebox_override("pressed", _box(Color(0.16, 0.3, 0.42)))
	b.add_theme_stylebox_override("focus", StyleBoxEmpty.new())
	b.pressed.connect(cb)
	return b


## Окно настроек поверх parent. changed — вызывается после каждой перемены (применить); extra — ещё кнопки
## внизу: [[подпись, действие], …]. Возвращает узел окна (закрывается само кнопкой «Закрыть»).
static func panel(parent: Node, changed: Callable, extra: Array = []) -> Control:
	load_cfg()
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	parent.add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", _box(C_BG))
	shade.add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -330
	pn.offset_right = 330
	pn.offset_top = -262
	pn.offset_bottom = 262
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 12)
	pn.add_child(vb)
	var lab := func(t: String, fs: int, col: Color) -> Label:
		var l := Label.new()
		l.text = t
		l.add_theme_font_size_override("font_size", fs)
		l.add_theme_color_override("font_color", col)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		return l
	vb.add_child(lab.call("Настройки", 24, C_TEXT))
	vb.add_child(lab.call("Графика", 18, Color(1.0, 0.86, 0.5)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	vb.add_child(row)
	var btns: Array[Button] = []
	var mark := func() -> void:
		for i in btns.size():
			btns[i].text = ("● " if i == gfx else "") + String(GFX[i].n)
			btns[i].modulate = Color(1, 1, 1) if i == gfx else Color(0.72, 0.76, 0.82)
	for i in GFX.size():
		var b := button(String(GFX[i].n), func() -> void:
			gfx = i
			save_cfg()
			mark.call()
			changed.call(), 200.0)
		btns.append(b)
		row.add_child(b)
	mark.call()
	vb.add_child(lab.call("Ниже графика — выше частота кадров. Разрешение ещё и подстраивается само, чтобы игра шла плавно. Густота травы меняется при следующем входе на локацию.", 14, Color(0.62, 0.68, 0.76)))
	# камера: сверху / с наклоном / по диагонали
	vb.add_child(lab.call("Камера", 18, Color(1.0, 0.86, 0.5)))
	var crow := HBoxContainer.new()
	crow.add_theme_constant_override("separation", 8)
	vb.add_child(crow)
	var cbtns: Array[Button] = []
	var cmark := func() -> void:
		for i in cbtns.size():
			cbtns[i].text = ("● " if i == cam else "") + String(CAMS[i].n)
			cbtns[i].modulate = Color(1, 1, 1) if i == cam else Color(0.72, 0.76, 0.82)
	for i in CAMS.size():
		var cb := button(String(CAMS[i].n), func() -> void:
			cam = i
			save_cfg()
			cmark.call()
			changed.call(), 200.0)
		cbtns.append(cb)
		crow.add_child(cb)
	cmark.call()
	var vl: Label = lab.call("Громкость: %d %%" % int(round(volume * 100.0)), 18, Color(1.0, 0.86, 0.5))
	vb.add_child(vl)
	var sl := HSlider.new()
	sl.min_value = 0
	sl.max_value = 100
	sl.step = 5
	sl.value = round(volume * 100.0)
	sl.custom_minimum_size = Vector2(0, 44)
	sl.value_changed.connect(func(v: float) -> void:
		volume = v / 100.0
		vl.text = "Громкость: %d %%" % int(v)
		save_cfg()
		changed.call())
	vb.add_child(sl)
	var sp := Control.new()
	sp.size_flags_vertical = Control.SIZE_EXPAND_FILL
	vb.add_child(sp)
	var foot := HBoxContainer.new()
	foot.alignment = BoxContainer.ALIGNMENT_END
	foot.add_theme_constant_override("separation", 8)
	vb.add_child(foot)
	for e in extra:
		foot.add_child(button(String(e[0]), e[1], 180.0))
	foot.add_child(button("Закрыть", func() -> void: shade.queue_free(), 140.0))
	return shade
