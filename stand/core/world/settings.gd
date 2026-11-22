class_name ULSettings
extends RefCounted
## Настройки игры: качество графики и громкость. Хранятся в user://settings.json, применяются к окну и звуку.
## Графика: чем ниже — тем меньше точек считает телефон (трёхмерная картинка рисуется в меньшем разрешении и
## растягивается; надписи и кнопки остаются чёткими), реже трава и ближе граница её показа.

const PATH := "user://settings.json"
## Пресеты графики (одни на все локации, базу и стенды). scale — разрешение 3D (доля ширины и высоты экрана;
## подстройка под частоту кадров не опускает его ниже SCALE_MIN), msaa — сглаживание краёв, grass — густота травы,
## range — дальность травы и мелочей, м, shadows — тени солнца (0 — нет, 1 — карта 1024, 2 — 2048, 3 — 4096 и мягче),
## aniso — анизотропная фильтрация земли (чётче под углом), ground — подробная земля (false — быстрая, запечённая:
## ULGroundBake).
const GFX := [
	{"n": "Низкая", "scale": 0.7, "msaa": 0, "grass": 0.3, "range": 16.0, "shadows": 0, "aniso": false, "ground": false},
	{"n": "Средняя", "scale": 0.85, "msaa": 2, "grass": 0.6, "range": 24.0, "shadows": 1, "aniso": false, "ground": true},
	{"n": "Высокая", "scale": 1.0, "msaa": 2, "grass": 0.85, "range": 30.0, "shadows": 2, "aniso": true, "ground": true},
	{"n": "Ультра", "scale": 1.0, "msaa": 4, "grass": 1.0, "range": 40.0, "shadows": 3, "aniso": true, "ground": true},
]
## Свои настройки поверх пресета (−1 / 0 — как в пресете): разрешение 3D, %, тени, трава; auto — подстройка
## под частоту кадров (сначала сглаживание, потом тени, разрешение — последним)
const RES_OPTS := [0, 60, 70, 80, 90, 100]
const SHADOW_OPTS := [-1, 0, 2, 3]
const GRASS_OPTS := [-1.0, 0.3, 0.6, 1.0]
const GROUND_OPTS := [-1, 1, 0]            ## земля: как в качестве / подробная / быстрая (запечённая)
static var res_pct := 0
static var shadows_o := -1
static var grass_o := -1.0
static var ground_o := -1
static var auto_fps := true
static var sharp := 1                      ## резкость картинки (ULSharpen): 0 — выкл, 1 — мягкая, 2 — сильная
## Камера: угол наклона (от земли) и поворот вокруг героя. «С наклоном» — как в DoZ Survival, «По диагонали» —
## как в Last Day on Earth (дома и заборы — ромбом).
const CAMS := [
	{"n": "Сверху", "pitch": 61.0, "yaw": 0.0},
	{"n": "С наклоном", "pitch": 52.0, "yaw": 0.0},
	{"n": "По диагонали", "pitch": 50.0, "yaw": 45.0},
]
## ниже разрешение само не опускается: при 30–55 % картинка «мыльная» (снимки с телефона: 39–42 %); прежде чем
## снижать разрешение, подстройка снимает сглаживание и тени (world.gd, _auto_res)
const SCALE_MIN := 0.62
const FPS_MIN := 30.0             ## частота кадров, ниже которой разрешение снижается сразу и крупным шагом
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
static var stand_hero := ""                ## внешность героя на стенде (ULHeroes); пусто — выбранная игроком
static var stand_back := "res://world.tscn"   ## куда ведёт «Назад» со стенда
static var gfx := 1
static var dev_force := false               ## проверки: вести себя как собранная игра (без отладочных кнопок) — false


## Отрисовщик: false — «Совместимость» (OpenGL ES 3, сборка А), true — «Мобильный» (Vulkan, сборка Б). Поправки
## яркости, подобранные под OpenGL (солнце без теней ярче, тон «быстрой земли»), нужны только в первом.
static func vulkan() -> bool:
	return RenderingServer.get_current_rendering_method() != "gl_compatibility"


static func renderer_name() -> String:
	return "Vulkan" if vulkan() else "OpenGL"


## Отладочное (строка состояния с кадрами/с, «Враг +», «Тест FPS», «Убрать ящик», «3D», «Лаборатория») — только
## при запуске из редактора Godot (и в проверках); в собранной игре — одиночной и в мультиплеере — их нет
static func dev() -> bool:
	return OS.has_feature("editor") and not dev_force
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
			res_pct = int(d.get("res", 0)) if RES_OPTS.has(int(d.get("res", 0))) else 0
			shadows_o = int(d.get("shadows", -1)) if SHADOW_OPTS.has(int(d.get("shadows", -1))) else -1
			grass_o = float(d.get("grass", -1.0))
			ground_o = int(d.get("ground", -1)) if GROUND_OPTS.has(int(d.get("ground", -1))) else -1
			auto_fps = bool(d.get("auto", true))
			sharp = clampi(int(d.get("sharp", 1)), 0, 2)
			volume = clampf(float(d.get("volume", 0.8)), 0.0, 1.0)
			cam = clampi(int(d.get("cam", 1)), 0, CAMS.size() - 1)


static func save_cfg() -> void:
	var f := FileAccess.open(PATH, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify({"gfx": gfx, "volume": volume, "cam": cam, "res": res_pct, "shadows": shadows_o, "grass": grass_o, "ground": ground_o, "auto": auto_fps, "sharp": sharp}))


## действующие настройки графики: пресет и свои поправки поверх
static func q() -> Dictionary:
	var d: Dictionary = (GFX[gfx] as Dictionary).duplicate()
	if res_pct > 0:
		d.scale = res_pct / 100.0
	if shadows_o >= 0:
		d.shadows = shadows_o
	if grass_o > 0.0:
		d.grass = grass_o
	if ground_o >= 0:
		d.ground = ground_o == 1
	return d


## тени солнца по настройкам: 0 — нет, 1–3 — размер карты теней 1024 / 2048 / 4096
static func shadows() -> int:
	return int(q().shadows)


## применить к окну: разрешение трёхмерной картинки, сглаживание, громкость
static func apply(vp: Viewport) -> void:
	load_cfg()
	vp.scaling_3d_scale = float(q().scale)
	# упрощение моделей с расстоянием (уровни детализации, созданные при импорте): насколько пикселей может
	# «сдвинуться» силуэт — на «Низкой» сильнее, на «Ультра» как есть; толпа заражённых — главная доля треугольников
	vp.mesh_lod_threshold = [6.0, 3.0, 1.5, 1.0][clampi(gfx, 0, 3)]
	# сглаживание краёв: на мобильных видеочипах (плиточная отрисовка) 2× и 4× почти бесплатны
	var ms := int(q().msaa)
	vp.msaa_3d = Viewport.MSAA_4X if ms >= 4 else (Viewport.MSAA_2X if ms >= 2 else Viewport.MSAA_DISABLED)
	# карта теней солнца — по качеству: чётче тени на «Высокой» и «Ультра»
	var sh := shadows()
	if sh > 0:
		RenderingServer.directional_shadow_atlas_set_size([1024, 1024, 2048, 4096][clampi(sh, 0, 3)], true)
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
	pn.offset_left = -440
	pn.offset_right = 440
	pn.offset_top = -330
	pn.offset_bottom = 330
	# на невысоком экране настройки прокручиваются
	var psc := ScrollContainer.new()
	psc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	pn.add_child(psc)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	vb.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	psc.add_child(vb)
	var lab := func(t: String, fs: int, col: Color) -> Label:
		var l := Label.new()
		l.text = t
		l.add_theme_font_size_override("font_size", fs)
		l.add_theme_color_override("font_color", col)
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		return l
	vb.add_child(lab.call("Настройки", 24, C_TEXT))
	vb.add_child(lab.call("Графика (для всех локаций)", 18, Color(1.0, 0.86, 0.5)))
	# ряд выбора: подписи, текущее значение, что делать при нажатии
	var choice := func(title: String, names: Array, cur: Callable, pick: Callable) -> void:
		var hr := HBoxContainer.new()
		hr.add_theme_constant_override("separation", 6)
		vb.add_child(hr)
		var tl: Label = lab.call(title, 15, C_TEXT)
		tl.custom_minimum_size = Vector2(150, 0)
		tl.autowrap_mode = TextServer.AUTOWRAP_OFF
		hr.add_child(tl)
		var bs: Array[Button] = []
		var mk := func() -> void:
			for j in bs.size():
				bs[j].text = ("● " if j == int(cur.call()) else "") + String(names[j])
				bs[j].modulate = Color(1, 1, 1) if j == int(cur.call()) else Color(0.72, 0.76, 0.82)
		for j in names.size():
			var b2 := button(String(names[j]), func() -> void:
				pick.call(j)
				save_cfg()
				mk.call()
				changed.call(), maxf(90.0, 560.0 / names.size()))
			b2.custom_minimum_size.y = 46
			b2.add_theme_font_size_override("font_size", 16)
			bs.append(b2)
			hr.add_child(b2)
		mk.call()
	var gnames: Array = []
	for g in GFX:
		gnames.append(String(g.n))
	choice.call("Качество", gnames, func() -> int: return gfx, func(j: int) -> void: gfx = j)
	choice.call("Разрешение 3D", ["Как в качестве", "60 %", "70 %", "80 %", "90 %", "100 %"], func() -> int: return RES_OPTS.find(res_pct), func(j: int) -> void: res_pct = int(RES_OPTS[j]))
	choice.call("Тени", ["Как в качестве", "Выкл", "Хорошие", "Лучшие"], func() -> int: return SHADOW_OPTS.find(shadows_o), func(j: int) -> void: shadows_o = int(SHADOW_OPTS[j]))
	choice.call("Трава", ["Как в качестве", "Мало", "Средне", "Много"], func() -> int: return maxi(0, GRASS_OPTS.find(grass_o)), func(j: int) -> void: grass_o = float(GRASS_OPTS[j]))
	choice.call("Земля", ["Как в качестве", "Подробная", "Быстрая"], func() -> int: return GROUND_OPTS.find(ground_o), func(j: int) -> void: ground_o = int(GROUND_OPTS[j]))
	choice.call("Резкость", ["Выкл", "Мягкая", "Сильная"], func() -> int: return sharp, func(j: int) -> void: sharp = j)
	choice.call("Подстройка FPS", ["Вкл", "Выкл"], func() -> int: return 0 if auto_fps else 1, func(j: int) -> void: auto_fps = j == 0)
	vb.add_child(lab.call("Подстройка держит плавность: при нехватке FPS сначала снимает сглаживание, потом тени, затем переходит на быструю землю и только потом понижает разрешение (не ниже 62 %). Трава и тени меняются при следующем входе на локацию.", 13, Color(0.62, 0.68, 0.76)))
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
