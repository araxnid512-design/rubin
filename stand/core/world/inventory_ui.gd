class_name ULInventoryUI
extends Control
## Экран инвентаря. Слева — герой в полный рост (3D, с оружием в руках, если оно взято) и слоты снаряжения:
## основное оружие, пистолет, рюкзак. Справа — карманы (8 ячеек) и надетый рюкзак (+8 / +12 / +20). Когда открыто
## хранилище (ящик, рюкзак на земле), на месте героя — его ячейки. Нажатие на предмет — выбрать; внизу — что
## с ним можно сделать: экипировать, взять в руки, снять, переложить, выбросить на землю.

signal closed
signal changed                    ## снаряжение или содержимое поменялось (обновить героя, сохранить)
signal drop(item: Dictionary)     ## выбросить предмет на землю
signal wear_ground_pack           ## надеть открытый рюкзак с земли

const C_BG := Color(0.055, 0.065, 0.075, 1.0)        # отдельное меню: игра за ним не видна
const C_CELL := Color(0.11, 0.13, 0.15, 0.95)
const C_LINE := Color(0.35, 0.75, 0.95, 0.55)
const C_SEL := Color(1.0, 0.78, 0.3)
const C_TEXT := Color(0.88, 0.93, 0.97)
const C_DIM := Color(0.6, 0.68, 0.74)
var CELL := 84.0

var inv: ULInventory
var cont = null                   ## открытое хранилище: массив ячеек или null
var cont_title := ""
var cont_is_pack := false         ## хранилище — рюкзак на земле (можно надеть)
var preview_tex: Texture2D = null
var preview_rot := Callable()     ## повернуть героя на превью: f(dx)

var _sel_src := ""
var _sel_i := -1
var _left: VBoxContainer
var _right: VBoxContainer
var _eq: VBoxContainer
var _bar: HBoxContainer
var _info: Label
var _cap: Label
var _toast: Label
var _toast_t := 0.0
var _preview: TextureRect


func _ready() -> void:
	# именно «якоря и отступы»: одни якоря сохраняют прежний (нулевой) размер, и окно сжимается до содержимого
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_STOP
	var bg := ColorRect.new()
	bg.color = C_BG
	add_child(bg)
	bg.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var root := VBoxContainer.new()
	add_child(root)
	root.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	root.offset_left = 16
	root.offset_right = -16
	root.offset_top = 10
	root.offset_bottom = -10
	root.add_theme_constant_override("separation", 8)
	# верх: заголовок, занято, закрыть
	var top := HBoxContainer.new()
	root.add_child(top)
	var t := _lbl("Инвентарь", 26, C_TEXT)
	top.add_child(t)
	_cap = _lbl("", 18, C_DIM)
	_cap.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_cap.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	top.add_child(_cap)
	top.add_child(_button("✕  Закрыть", func(): closed.emit(), 150))
	var mid := HBoxContainer.new()
	mid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	mid.add_theme_constant_override("separation", 14)
	root.add_child(mid)
	_left = VBoxContainer.new()
	_left.custom_minimum_size = Vector2(330, 0)
	mid.add_child(_left)
	_eq = VBoxContainer.new()
	_eq.add_theme_constant_override("separation", 6)
	_eq.custom_minimum_size = Vector2(118, 0)
	mid.add_child(_eq)
	var sc := ScrollContainer.new()
	sc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	mid.add_child(sc)
	_right = VBoxContainer.new()
	_right.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_right.add_theme_constant_override("separation", 6)
	sc.add_child(_right)
	# низ: выбранный предмет и действия
	var bot := PanelContainer.new()
	bot.add_theme_stylebox_override("panel", _box(Color(0.08, 0.1, 0.12, 0.95)))
	bot.custom_minimum_size = Vector2(0, 74)
	root.add_child(bot)
	var bh := HBoxContainer.new()
	bh.add_theme_constant_override("separation", 10)
	bot.add_child(bh)
	_info = _lbl("Выберите предмет", 17, C_DIM)
	_info.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	_info.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	bh.add_child(_info)
	_bar = HBoxContainer.new()
	_bar.add_theme_constant_override("separation", 8)
	bh.add_child(_bar)
	_toast = _lbl("", 20, C_SEL)
	add_child(_toast)
	_toast.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_toast.offset_top = 54
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.add_theme_color_override("font_outline_color", Color.BLACK)
	_toast.add_theme_constant_override("outline_size", 6)


func _process(delta: float) -> void:
	if _toast_t > 0.0:
		_toast_t -= delta
		_toast.modulate.a = clampf(_toast_t, 0.0, 1.0)


func open(inventory: ULInventory, container = null, title := "", is_pack := false) -> void:
	inv = inventory
	cont = container
	cont_title = title
	cont_is_pack = is_pack
	_sel_src = ""
	_sel_i = -1
	visible = true
	refresh()


func say(t: String) -> void:
	_toast.text = t
	_toast_t = 2.2
	_toast.modulate.a = 1.0


# ---------------- построение ----------------

func refresh() -> void:
	# 8 ячеек в ряд должны помещаться справа от героя и слотов
	var free_w := size.x - 32.0 - 330.0 - 118.0 - 28.0 - 12.0
	CELL = clampf((free_w - 7.0 * 6.0) / 8.0, 56.0, 96.0)
	for box in [_left, _eq, _right, _bar]:
		for c in box.get_children():
			c.queue_free()
	_cap.text = "Занято %d из %d ячеек" % [inv.used(), inv.slot_count()]
	# слева: хранилище или герой
	if cont != null:
		_left.add_child(_lbl(cont_title, 20, C_TEXT))
		_left.add_child(_grid("cont", cont, 3))
		if cont_is_pack:
			_left.add_child(_button("Надеть этот рюкзак", func(): wear_ground_pack.emit(), 300))
	else:
		_preview = TextureRect.new()
		_preview.texture = preview_tex
		_preview.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		_preview.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		_preview.custom_minimum_size = Vector2(330, 470)
		_preview.size_flags_vertical = Control.SIZE_EXPAND_FILL
		_preview.mouse_filter = Control.MOUSE_FILTER_STOP
		_preview.gui_input.connect(_preview_input)
		_left.add_child(_preview)
		var hint := _lbl("проведите, чтобы повернуть", 13, C_DIM)
		hint.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		_left.add_child(hint)
	# снаряжение
	for s in [["primary", "Основное"], ["pistol", "Пистолет"], ["pack", "Рюкзак"]]:
		_eq.add_child(_lbl(s[1], 14, C_DIM))
		_eq.add_child(_cell("eq:" + s[0], 0, inv.get(s[0]), Vector2(112, 112 if s[0] != "primary" else 112)))
	if inv.hand != "":
		var h := _lbl("в руках: " + ("основное" if inv.hand == "primary" else "пистолет"), 13, C_SEL)
		_eq.add_child(h)
	# справа: карманы и рюкзак
	_right.add_child(_lbl("Карманы — %d ячеек" % ULInventory.POCKETS, 18, C_TEXT))
	_right.add_child(_grid("pockets", inv.pockets, 8))
	if inv.pack != null:
		_right.add_child(_lbl("%s — +%d ячеек" % [ULItems.get_def(String(inv.pack.id)).n, ULItems.pack_slots(inv.pack)], 18, C_TEXT))
		_right.add_child(_grid("pack", inv.pack.items, 8))
	else:
		var nl := _lbl("Рюкзака нет. Наденьте рюкзак — будет больше ячеек: малый +8, средний +12, большой +20.", 15, C_DIM)
		nl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		nl.custom_minimum_size = Vector2(200, 0)
		_right.add_child(nl)
	_update_bar()


func _grid(src: String, arr: Array, cols: int) -> GridContainer:
	var g := GridContainer.new()
	g.columns = cols
	g.add_theme_constant_override("h_separation", 6)
	g.add_theme_constant_override("v_separation", 6)
	for i in arr.size():
		g.add_child(_cell(src, i, arr[i], Vector2(CELL, CELL)))
	return g


func _cell(src: String, i: int, it, size: Vector2) -> Control:
	var b := Button.new()
	b.custom_minimum_size = size
	b.focus_mode = Control.FOCUS_NONE
	var sel := src == _sel_src and i == _sel_i
	var st := _box(C_CELL, C_SEL if sel else C_LINE, 3 if sel else 1)
	b.add_theme_stylebox_override("normal", st)
	b.add_theme_stylebox_override("hover", st)
	b.add_theme_stylebox_override("pressed", _box(Color(0.16, 0.2, 0.24, 0.95), C_SEL, 2))
	if it != null:
		var tr := TextureRect.new()
		tr.texture = ULItems.icon(String(it.id))
		tr.modulate = ULItems.tint(String(it.id)) if ULItems.get_def(String(it.id)).has("tint") else Color.WHITE
		tr.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		tr.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		tr.set_anchors_preset(Control.PRESET_FULL_RECT)
		tr.offset_left = 5
		tr.offset_top = 5
		tr.offset_right = -5
		tr.offset_bottom = -5
		tr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		b.add_child(tr)
		if int(it.get("n", 1)) > 1:
			var n := _lbl(str(it.n), 16, C_TEXT)
			n.set_anchors_preset(Control.PRESET_BOTTOM_RIGHT)
			n.offset_left = -40
			n.offset_top = -24
			n.offset_right = -5
			n.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
			n.add_theme_color_override("font_outline_color", Color.BLACK)
			n.add_theme_constant_override("outline_size", 5)
			b.add_child(n)
		if ULItems.kind(it) == "pack" and not ULItems.pack_empty(it):
			var dot := _lbl("•", 22, C_SEL)
			dot.position = Vector2(5, -4)
			b.add_child(dot)
	b.pressed.connect(_select.bind(src, i))
	return b


# ---------------- выбор и действия ----------------

func _select(src: String, i: int) -> void:
	if src == _sel_src and i == _sel_i:
		_sel_src = ""
		_sel_i = -1
	else:
		_sel_src = src
		_sel_i = i
	refresh()


func _sel_item():
	if _sel_src == "":
		return null
	if _sel_src.begins_with("eq:"):
		return inv.get(_sel_src.substr(3))
	var arr := _arr(_sel_src)
	return arr[_sel_i] if _sel_i >= 0 and _sel_i < arr.size() else null


func _arr(src: String) -> Array:
	if src == "cont":
		return cont if cont != null else []
	return inv.cells(src)


func _update_bar() -> void:
	var it = _sel_item()
	if it == null:
		_info.text = "Выберите предмет" if inv.used() > 0 or cont != null else "Пусто"
		return
	var d := ULItems.get_def(String(it.id))
	_info.text = "%s — %s" % [ULItems.title(it), String(d.get("d", ""))]
	var k := ULItems.kind(it)
	if _sel_src.begins_with("eq:"):
		var slot := _sel_src.substr(3)
		if slot != "pack":
			_bar.add_child(_button("Убрать из рук" if inv.hand == slot else "В руки", _act_hand.bind(slot)))
		_bar.add_child(_button("Снять", _act_unequip.bind(slot)))
		if cont != null:
			_bar.add_child(_button("В хранилище", _act_slot_to_cont.bind(slot)))
		_bar.add_child(_button("Выбросить", _act_drop))
	elif _sel_src == "cont":
		_bar.add_child(_button("Взять", _act_take))
		if k in ["pistol", "primary"]:
			_bar.add_child(_button("Экипировать", _act_equip))
		_bar.add_child(_button("Выбросить", _act_drop))
	else:
		if k in ["pistol", "primary"]:
			_bar.add_child(_button("Экипировать", _act_equip))
		if k == "pack":
			_bar.add_child(_button("Надеть", _act_equip))
		if cont != null:
			_bar.add_child(_button("В хранилище", _act_to_cont))
		_bar.add_child(_button("Выбросить", _act_drop))


func _done(msg := "") -> void:
	if msg != "":
		say(msg)
	_sel_src = ""
	_sel_i = -1
	changed.emit()
	refresh()


func _act_hand(slot: String) -> void:
	inv.hand = "" if inv.hand == slot else slot
	_done()


func _act_unequip(slot: String) -> void:
	if inv.unequip(slot):
		_done()
	elif slot == "pack" and not ULItems.pack_empty(inv.pack):
		say("В рюкзаке есть вещи — его можно только выбросить на землю")
	else:
		say("Нет места")


func _act_slot_to_cont(slot: String) -> void:
	var it = inv.get(slot)
	if slot == "pack" and not ULItems.pack_empty(it):
		say("Рюкзак с вещами в хранилище не положить")
		return
	if ULInventory.put(cont, it) > 0:
		say("В хранилище нет места")
		return
	inv.clear_slot(slot)
	_done()


func _act_equip() -> void:
	var arr := _arr(_sel_src)
	var it = arr[_sel_i]
	var k := ULItems.kind(it)
	if k == "pack" and inv.pack != null and not ULItems.pack_empty(inv.pack):
		say("Сначала выбросьте или разберите надетый рюкзак")
		return
	if not inv.equip_from(arr, _sel_i):
		say("Нельзя")
		return
	if k in ["pistol", "primary"] and inv.hand == "":
		inv.hand = k
	_done()


func _act_to_cont() -> void:
	var arr := _arr(_sel_src)
	var it = arr[_sel_i]
	var left := ULInventory.put(cont, it)
	if left == int(it.n):
		say("В хранилище нет места")
		return
	if left > 0:
		it.n = left
		_done("Поместилось не всё")
		return
	arr[_sel_i] = null
	_done()


func _act_take() -> void:
	var it = cont[_sel_i]
	var k := ULItems.kind(it)
	if k == "pack" and not ULItems.pack_empty(it):
		say("Рюкзак с вещами — выложите вещи или наденьте его")
		return
	var n0 := int(it.n)
	var left := inv.add(it)
	if left == n0:
		say("Нет места")
		return
	if left == 0:
		cont[_sel_i] = null
	_done("" if left == 0 else "Взято не всё — нет места")


func _act_drop() -> void:
	var it
	if _sel_src.begins_with("eq:"):
		it = inv.clear_slot(_sel_src.substr(3))
	else:
		var arr := _arr(_sel_src)
		it = arr[_sel_i]
		arr[_sel_i] = null
	if it != null:
		drop.emit(it)
	_done()


func _preview_input(e: InputEvent) -> void:
	if (e is InputEventScreenDrag or e is InputEventMouseMotion) and preview_rot.is_valid():
		var rel: Vector2 = e.relative
		if e is InputEventMouseMotion and not (e as InputEventMouseMotion).button_mask & MOUSE_BUTTON_MASK_LEFT:
			return
		preview_rot.call(rel.x)


# ---------------- оформление ----------------

func _box(bg: Color, border := C_LINE, w := 1) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = border
	sb.set_border_width_all(w)
	sb.set_corner_radius_all(6)
	sb.content_margin_left = 10
	sb.content_margin_right = 10
	sb.content_margin_top = 6
	sb.content_margin_bottom = 6
	return sb


func _lbl(t: String, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	return l


func _button(t: String, cb: Callable, w := 130.0) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(w, 58)
	b.focus_mode = Control.FOCUS_NONE
	b.add_theme_font_size_override("font_size", 17)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_stylebox_override("normal", _box(Color(0.1, 0.14, 0.17, 0.95)))
	b.add_theme_stylebox_override("hover", _box(Color(0.12, 0.18, 0.22, 0.95)))
	b.add_theme_stylebox_override("pressed", _box(Color(0.15, 0.32, 0.42, 0.95), C_SEL, 2))
	b.pressed.connect(cb)
	return b
