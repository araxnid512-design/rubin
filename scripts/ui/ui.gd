class_name UI
extends RefCounted
## Тема интерфейса (тёмная, акцент — красный «Долга») и фабрики элементов.
## Базовое разрешение 1920×1080, крупные элементы под палец на горизонтальном экране телефона.

const RED := Color(0.72, 0.1, 0.08)
const RED_L := Color(0.9, 0.22, 0.16)
const BG := Color(0.07, 0.07, 0.07, 0.92)
const BG2 := Color(0.12, 0.12, 0.12, 0.95)
const FG := Color(0.9, 0.88, 0.82)
const DIM := Color(0.6, 0.58, 0.54)
const GOOD := Color(0.45, 0.8, 0.4)
const WARN := Color(0.95, 0.7, 0.25)

static var _theme: Theme

static func sb(c: Color, border: Color = Color(0, 0, 0, 0), bw: int = 0, radius: int = 6, pad: int = 10) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = c
	s.border_color = border
	s.set_border_width_all(bw)
	s.set_corner_radius_all(radius)
	s.content_margin_left = pad
	s.content_margin_right = pad
	s.content_margin_top = pad * 0.6
	s.content_margin_bottom = pad * 0.6
	return s

static func theme() -> Theme:
	if _theme:
		return _theme
	var t := Theme.new()
	t.default_font_size = 28
	t.set_color("font_color", "Label", FG)
	t.set_color("font_color", "Button", FG)
	t.set_color("font_hover_color", "Button", Color.WHITE)
	t.set_color("font_pressed_color", "Button", Color.WHITE)
	t.set_color("font_disabled_color", "Button", Color(0.45, 0.44, 0.42))
	t.set_stylebox("normal", "Button", sb(Color(0.16, 0.16, 0.16, 0.95), Color(0.35, 0.33, 0.3), 2, 6, 14))
	t.set_stylebox("hover", "Button", sb(Color(0.22, 0.2, 0.19, 0.95), RED, 2, 6, 14))
	t.set_stylebox("pressed", "Button", sb(Color(0.4, 0.08, 0.06, 0.95), RED_L, 2, 6, 14))
	t.set_stylebox("disabled", "Button", sb(Color(0.12, 0.12, 0.12, 0.8), Color(0.22, 0.22, 0.22), 2, 6, 14))
	t.set_stylebox("focus", "Button", StyleBoxEmpty.new())
	t.set_stylebox("panel", "Panel", sb(BG, Color(0.3, 0.28, 0.26), 2, 8))
	t.set_stylebox("panel", "PanelContainer", sb(BG, Color(0.3, 0.28, 0.26), 2, 8, 16))
	t.set_stylebox("background", "ProgressBar", sb(Color(0.05, 0.05, 0.05, 0.9), Color(0.25, 0.25, 0.25), 1, 4, 0))
	t.set_stylebox("fill", "ProgressBar", sb(RED, Color(0, 0, 0, 0), 0, 4, 0))
	t.set_color("font_color", "ProgressBar", FG)
	t.set_stylebox("slider", "HSlider", sb(Color(0.2, 0.2, 0.2), Color(0, 0, 0, 0), 0, 4, 4))
	t.set_stylebox("grabber_area", "HSlider", sb(RED, Color(0, 0, 0, 0), 0, 4, 4))
	t.set_stylebox("grabber_area_highlight", "HSlider", sb(RED_L, Color(0, 0, 0, 0), 0, 4, 4))
	t.set_constant("separation", "VBoxContainer", 8)
	t.set_constant("separation", "HBoxContainer", 8)
	t.set_stylebox("panel", "ScrollContainer", StyleBoxEmpty.new())
	t.set_stylebox("panel", "TooltipPanel", sb(BG2, RED, 1, 4, 8))
	t.set_color("font_color", "CheckBox", FG)
	t.set_color("font_color", "CheckButton", FG)
	t.set_font_size("font_size", "CheckBox", 28)
	_theme = t
	return t

static func label(text: String, size: int = 28, color: Color = FG, wrap: bool = false) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", size)
	l.add_theme_color_override("font_color", color)
	if wrap:
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l

static func button(text: String, cb: Callable, size: int = 28, min_w: float = 0.0, min_h: float = 72.0) -> Button:
	var b := Button.new()
	b.text = text
	b.add_theme_font_size_override("font_size", size)
	b.custom_minimum_size = Vector2(min_w, min_h)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(func():
		Sfx.play("ui", -6.0)
		cb.call())
	return b

static func bar(c: Color, h: float = 22.0) -> ProgressBar:
	var p := ProgressBar.new()
	p.custom_minimum_size = Vector2(0, h)
	p.show_percentage = false
	p.max_value = 100.0
	var fill := sb(c, Color(0, 0, 0, 0), 0, 4, 0)
	p.add_theme_stylebox_override("fill", fill)
	p.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return p

static func hbox(sep: int = 8) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", sep)
	return h

static func vbox(sep: int = 8) -> VBoxContainer:
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", sep)
	return v

static func panel(c: Color = BG) -> PanelContainer:
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", sb(c, Color(0.3, 0.28, 0.26), 2, 8, 16))
	return p

static func spacer(w: float = 0.0, h: float = 0.0) -> Control:
	var c := Control.new()
	c.custom_minimum_size = Vector2(w, h)
	c.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return c

static func expand(c: Control) -> Control:
	c.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	return c

static func cost_text(cost: Dictionary) -> String:
	var parts: Array = []
	for k in cost:
		var have := Game.total_count(k)
		var need := int(cost[k])
		var mark := "✓" if have >= need else "✗"
		parts.append("%s %s %d/%d" % [mark, ItemDB.item_name(k), have, need])
	return "\n".join(parts) if not parts.is_empty() else "—"

static func clear(c: Node) -> void:
	for ch in c.get_children():
		c.remove_child(ch)
		ch.queue_free()

static func place(c: Control, preset: int, pos: Vector2, sz: Vector2 = Vector2.ZERO) -> void:
	## Размещение относительно точки привязки (якоря): pos — смещение от якоря, sz — размер.
	c.set_anchors_preset(preset)
	c.offset_left = pos.x
	c.offset_top = pos.y
	c.offset_right = pos.x + sz.x
	c.offset_bottom = pos.y + sz.y

static func toggle(text: String, on: bool, cb: Callable, size: int = 24, min_w: float = 72.0, min_h: float = 64.0) -> Button:
	## Крупный переключатель (вместо мелкого CheckBox — удобно пальцем).
	var b := Button.new()
	b.toggle_mode = true
	b.button_pressed = on
	b.focus_mode = Control.FOCUS_NONE
	b.custom_minimum_size = Vector2(min_w, min_h)
	b.add_theme_font_size_override("font_size", size)
	b.add_theme_stylebox_override("pressed", sb(Color(0.35, 0.08, 0.06, 0.95), RED_L, 3, 6, 12))
	var upd := func(v: bool): b.text = ("☑ " if v else "☐ ") + text
	upd.call(on)
	b.toggled.connect(func(v):
		upd.call(v)
		Sfx.play("ui", -6.0)
		cb.call(v))
	return b
