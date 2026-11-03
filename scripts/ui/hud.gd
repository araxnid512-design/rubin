class_name HUD
extends Control
## Игровой интерфейс для горизонтального экрана телефона (и ПК).

var status_hp: ProgressBar
var status_st: ProgressBar
var status_rad: ProgressBar
var hp_label: Label
var armor_label: Label
var tracker_title: Label
var tracker_box: VBoxContainer
var tracker_arrow: Label
var clock: Label
var minimap: MapView
var joystick: VirtualJoystick
var fire_btn: TouchButton
var reload_btn: TouchButton
var interact_btn: TouchButton
var sprint_btn: TouchButton
var interact_label: Label
var weapon_box: HBoxContainer
var quick_box: HBoxContainer
var feed: VBoxContainer
var hold_bar: ProgressBar
var hold_label: Label
var vignette: ColorRect
var fps_label: Label
var windows: Control
var touch_root: Control
var _vig := 0.0
var _tracker_t := 0.0
var _slots_t := 0.0
var _feed_items: Array = []
var open_window: Control = null

func _ready() -> void:
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	theme = UI.theme()
	process_mode = Node.PROCESS_MODE_ALWAYS
	Game.hud = self
	_build()
	Events.message.connect(_on_message)
	Events.player_hit.connect(func(a): _vig = minf(1.0, _vig + a / 30.0))
	Events.hold_progress.connect(_on_hold)
	Events.ui_open.connect(open)
	Events.inventory_changed.connect(_refresh_slots)
	Events.equipment_changed.connect(_refresh_slots)
	Settings.changed.connect(_apply_settings)
	_apply_settings()
	_refresh_slots()

func _apply_settings() -> void:
	touch_root.visible = Settings.use_touch()
	fps_label.visible = Settings.show_fps

func _build() -> void:
	vignette = ColorRect.new()
	vignette.set_anchors_preset(Control.PRESET_FULL_RECT)
	vignette.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var vm := ShaderMaterial.new()
	var vs := Shader.new()
	vs.code = "shader_type canvas_item;\nuniform float amount = 0.0;\nvoid fragment(){ vec2 d = UV - 0.5; float r = length(d * vec2(1.6, 1.0)); COLOR = vec4(0.6, 0.0, 0.0, smoothstep(0.45, 0.95, r) * amount); }"
	vm.shader = vs
	vignette.material = vm
	add_child(vignette)
	# --- статус (слева сверху) ---
	var st := UI.panel(Color(0.05, 0.05, 0.05, 0.7))
	st.position = Vector2(20, 18)
	st.custom_minimum_size = Vector2(430, 0)
	add_child(st)
	var sv := UI.vbox(6)
	st.add_child(sv)
	var top := UI.hbox()
	sv.add_child(top)
	top.add_child(UI.label("ГЕНЕРАЛ «ДОЛГА»", 26, UI.RED_L))
	armor_label = UI.label("", 22, UI.DIM)
	top.add_child(UI.expand(UI.spacer()))
	top.add_child(armor_label)
	var hrow := UI.hbox()
	sv.add_child(hrow)
	status_hp = UI.bar(Color(0.75, 0.12, 0.1), 24)
	hrow.add_child(UI.expand(status_hp))
	hp_label = UI.label("100", 22)
	hp_label.custom_minimum_size = Vector2(52, 0)
	hrow.add_child(hp_label)
	status_st = UI.bar(Color(0.85, 0.7, 0.2), 12)
	sv.add_child(status_st)
	status_rad = UI.bar(Color(0.45, 0.8, 0.2), 10)
	sv.add_child(status_rad)
	# --- лента сообщений ---
	feed = UI.vbox(4)
	feed.position = Vector2(22, 200)
	feed.custom_minimum_size = Vector2(620, 0)
	feed.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(feed)
	# --- трекер задания (сверху по центру) ---
	var tp := UI.panel(Color(0.05, 0.05, 0.05, 0.62))
	UI.place(tp, Control.PRESET_CENTER_TOP, Vector2(-330, 14), Vector2.ZERO)
	tp.custom_minimum_size = Vector2(660, 0)
	tp.mouse_filter = Control.MOUSE_FILTER_STOP
	tp.gui_input.connect(func(e): if TouchInput.is_press(e) or (e is InputEventMouseButton and e.pressed): open("journal", null))
	add_child(tp)
	var tv := UI.vbox(2)
	tp.add_child(tv)
	var trow := UI.hbox()
	tv.add_child(trow)
	tracker_title = UI.label("", 24, UI.WARN)
	trow.add_child(UI.expand(tracker_title))
	tracker_arrow = UI.label("", 24, UI.WARN)
	trow.add_child(tracker_arrow)
	tracker_box = UI.vbox(0)
	tv.add_child(tracker_box)
	# --- мини-карта и часы (справа сверху) ---
	var mm_panel := Control.new()
	UI.place(mm_panel, Control.PRESET_TOP_RIGHT, Vector2(-330, 18), Vector2(310, 400))
	mm_panel.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(mm_panel)
	minimap = MapView.new()
	minimap.size = Vector2(310, 270)
	minimap.meters = 110.0
	minimap.gui_input.connect(func(e): if TouchInput.is_press(e) or (e is InputEventMouseButton and e.pressed): open("map", null))
	mm_panel.add_child(minimap)
	clock = UI.label("", 22)
	clock.position = Vector2(0, 274)
	clock.size = Vector2(310, 30)
	clock.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	mm_panel.add_child(clock)
	var mrow := UI.hbox(6)
	mrow.position = Vector2(0, 306)
	mrow.size = Vector2(310, 64)
	mm_panel.add_child(mrow)
	for b in [["Карта", "map"], ["Журнал", "journal"], ["Меню", "pause"]]:
		var bt := UI.button(b[0], func(): open(b[1], null), 22, 98, 60)
		mrow.add_child(bt)
	# правая колонка
	var rcol := UI.vbox(8)
	UI.place(rcol, Control.PRESET_TOP_RIGHT, Vector2(-200, 395), Vector2(180, 0))
	add_child(rcol)
	for b in [["Инвентарь", "inventory"], ["Отряд", "squad"], ["Стройка", "build"]]:
		rcol.add_child(UI.button(b[0], func(): open(b[1], null), 24, 180, 68))
	# --- слоты оружия и быстрые слоты (снизу по центру) ---
	var bottom := UI.hbox(10)
	UI.place(bottom, Control.PRESET_CENTER_BOTTOM, Vector2(-400, -128), Vector2.ZERO)
	add_child(bottom)
	weapon_box = UI.hbox(8)
	bottom.add_child(weapon_box)
	bottom.add_child(UI.spacer(16))
	quick_box = UI.hbox(8)
	bottom.add_child(quick_box)
	# --- удержание ---
	hold_bar = UI.bar(Color(0.95, 0.7, 0.2), 26)
	UI.place(hold_bar, Control.PRESET_CENTER, Vector2(-220, 120), Vector2(440, 26))
	hold_bar.visible = false
	add_child(hold_bar)
	hold_label = UI.label("", 26)
	UI.place(hold_label, Control.PRESET_CENTER, Vector2(-300, 80), Vector2(600, 36))
	hold_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	hold_label.visible = false
	add_child(hold_label)
	# --- сенсорное управление ---
	touch_root = Control.new()
	touch_root.set_anchors_preset(Control.PRESET_FULL_RECT)
	touch_root.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(touch_root)
	joystick = VirtualJoystick.new()
	UI.place(joystick, Control.PRESET_BOTTOM_LEFT, Vector2(0, -620), Vector2(760, 620))
	touch_root.add_child(joystick)
	joystick.moved.connect(func(v):
		if Game.player:
			(Game.player as Player).touch_move = v)
	fire_btn = _tbtn("ОГОНЬ", Color(0.7, 0.1, 0.08), Vector2(-250, -250), 210)
	fire_btn.pressed.connect(func(): if Game.player: (Game.player as Player).touch_fire = true)
	fire_btn.released.connect(func(): if Game.player: (Game.player as Player).touch_fire = false)
	reload_btn = _tbtn("R", Color(0.3, 0.3, 0.3), Vector2(-380, -150), 112)
	reload_btn.sub = "перезар."
	reload_btn.pressed.connect(func(): if Game.player: (Game.player as Player).start_reload())
	interact_btn = _tbtn("✋", Color(0.75, 0.55, 0.15), Vector2(-430, -330), 140)
	interact_btn.pressed.connect(func(): if Game.player: (Game.player as Player).touch_interact = true)
	interact_btn.released.connect(func(): if Game.player: (Game.player as Player).touch_interact = false)
	sprint_btn = _tbtn("»", Color(0.25, 0.35, 0.5), Vector2(-160, -420), 100)
	sprint_btn.sub = "бег"
	sprint_btn.pressed.connect(func(): if Game.player: (Game.player as Player).touch_sprint = not (Game.player as Player).touch_sprint)
	interact_label = UI.label("", 24, UI.WARN)
	UI.place(interact_label, Control.PRESET_BOTTOM_RIGHT, Vector2(-900, -205), Vector2(450, 34))
	interact_label.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	add_child(interact_label)
	fps_label = UI.label("", 20, Color(0.6, 1.0, 0.6))
	UI.place(fps_label, Control.PRESET_BOTTOM_LEFT, Vector2(14, -40), Vector2.ZERO)
	add_child(fps_label)
	windows = Control.new()
	windows.set_anchors_preset(Control.PRESET_FULL_RECT)
	windows.mouse_filter = Control.MOUSE_FILTER_IGNORE
	add_child(windows)

func _tbtn(t: String, c: Color, pos: Vector2, s: float) -> TouchButton:
	var b := TouchButton.new()
	b.text = t
	b.color = c
	UI.place(b, Control.PRESET_BOTTOM_RIGHT, pos, Vector2(s, s))
	b.font_size = 30 if s > 120 else 26
	touch_root.add_child(b)
	return b

func mouse_over_ui() -> bool:
	var h := get_viewport().gui_get_hovered_control()
	return h != null and h != self and h.mouse_filter == Control.MOUSE_FILTER_STOP

# ------------------------------------------------------------------ обновление
func _process(delta: float) -> void:
	var p := Game.player as Player
	if p:
		status_hp.value = p.hp
		hp_label.text = str(int(ceil(p.hp)))
		status_st.value = p.stamina
		status_rad.value = p.radiation
		status_rad.visible = p.radiation > 0.5
		armor_label.text = "броня %d%%" % int(p.armor * 100.0)
		var f: Node = p.focus
		if f != null and is_instance_valid(f) and not p.holding:
			interact_label.text = String(f.interact_prompt()) + ("  [E]" if not Settings.use_touch() else "")
			interact_btn.enabled = true
		else:
			interact_label.text = ""
			interact_btn.enabled = p.holding
		sprint_btn.color = Color(0.3, 0.5, 0.8) if p.touch_sprint else Color(0.25, 0.35, 0.5)
		sprint_btn.queue_redraw()
		interact_btn.queue_redraw()
		if p.weapon_id != "":
			fire_btn.sub = "%d / %d" % [p.mag, p.available_reserve()]
		else:
			fire_btn.sub = "нет оружия"
		fire_btn.queue_redraw()
	_vig = maxf(0.0, _vig - delta * 0.8)
	var low := 0.0
	if p and p.hp < 30.0:
		low = 0.35 + sin(Time.get_ticks_msec() * 0.006) * 0.1
	(vignette.material as ShaderMaterial).set_shader_parameter("amount", maxf(_vig, low))
	clock.text = "%s  %s" % [Game.time_string(), "⚡" if Game.power_on else "—"]
	_tracker_t -= delta
	if _tracker_t <= 0.0:
		_tracker_t = 0.5
		_refresh_tracker()
	_slots_t -= delta
	if _slots_t <= 0.0:
		_slots_t = 0.4
		_refresh_slots()
	if fps_label.visible:
		fps_label.text = "FPS %d | %.1f мс | вызовов %d | треуг. %dk | узлов %d" % [Engine.get_frames_per_second(), Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0,
			Performance.get_monitor(Performance.RENDER_TOTAL_DRAW_CALLS_IN_FRAME), int(Performance.get_monitor(Performance.RENDER_TOTAL_PRIMITIVES_IN_FRAME) / 1000.0),
			Performance.get_monitor(Performance.OBJECT_NODE_COUNT)]
	for i in range(_feed_items.size() - 1, -1, -1):
		var it: Dictionary = _feed_items[i]
		it.t -= delta
		var lb: Control = it.node
		if it.t < 1.0:
			lb.modulate.a = maxf(0.0, it.t)
		if it.t <= 0.0:
			lb.queue_free()
			_feed_items.remove_at(i)

func _input(e: InputEvent) -> void:
	if e.is_action_pressed("toggle_fps"):
		Settings.show_fps = not Settings.show_fps
		Settings.apply()
	if open_window != null:
		if e.is_action_pressed("pause") or e.is_action_pressed("inventory") and open_window.get_meta("kind", "") == "inventory":
			close_window()
			get_viewport().set_input_as_handled()
		return
	for pair in [["inventory", "inventory"], ["map", "map"], ["squad", "squad"], ["build", "build"], ["journal", "journal"], ["pause", "pause"]]:
		if e.is_action_pressed(pair[0]):
			open(pair[1], null)
			get_viewport().set_input_as_handled()
			return
	if e.is_action_pressed("quicksave"):
		Game.save_game(1)
	elif e.is_action_pressed("quickload") and Game.has_save(1):
		get_tree().root.get_node("Main").load_slot(1)

func _refresh_tracker() -> void:
	tracker_title.text = Quest.current_title()
	UI.clear(tracker_box)
	for o in Quest.objectives():
		var l := UI.label(("✓ " if o.done else "• ") + String(o.text), 22, UI.GOOD if o.done else UI.FG, true)
		l.custom_minimum_size = Vector2(620, 0)
		tracker_box.add_child(l)
	var m: Variant = Quest.marker()
	if m != null and Game.player:
		var d: Vector3 = (m as Vector3) - Game.player.global_position
		d.y = 0
		var ang := atan2(d.x, -d.z)
		var arrows := ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"]
		var idx := int(round(ang / (PI / 4.0))) % 8
		if idx < 0:
			idx += 8
		tracker_arrow.text = "%s %d м" % [arrows[idx], int(d.length())]
	else:
		tracker_arrow.text = ""

func _refresh_slots() -> void:
	if weapon_box == null:
		return
	UI.clear(weapon_box)
	UI.clear(quick_box)
	var p := Game.player as Player
	for s in [0, 1]:
		var e = Game.equip.get("primary" if s == 0 else "pistol")
		var active: bool = p != null and p.active_slot == s
		var txt := "—"
		if e != null:
			var w := ItemDB.weapon(String(e.id))
			var mag_now := p.mag if (active and p) else int(e.get("ammo", 0))
			txt = "%s\n%d/%d" % [w.get("name", e.id), mag_now, Game.inv.count(String(w.get("ammo", "")))]
		var b := UI.button(txt, func(): if Game.player: (Game.player as Player).switch_slot(s), 20, 150, 84)
		if active:
			b.add_theme_stylebox_override("normal", UI.sb(Color(0.35, 0.08, 0.06, 0.95), UI.RED_L, 3, 6, 10))
		weapon_box.add_child(b)
	for i in 4:
		var id: String = Game.quick[i] if i < Game.quick.size() else ""
		var t := "+"
		if id != "":
			t = "%s\n×%d" % [_short(ItemDB.item_name(id)), Game.inv.count(id)]
		var b := UI.button(t, func(): if Game.player: (Game.player as Player).use_quick(i), 18, 96, 84)
		quick_box.add_child(b)

static func _short(n: String) -> String:
	return n if n.length() <= 9 else n.substr(0, 8) + "."

func _on_message(text: String, kind: int) -> void:
	var colors := [UI.FG, UI.GOOD, Color(1.0, 0.45, 0.35), Color(0.55, 0.85, 1.0)]
	var l := UI.label(text, 22, colors[clampi(kind, 0, 3)], true)
	l.custom_minimum_size = Vector2(620, 0)
	var bg := PanelContainer.new()
	bg.add_theme_stylebox_override("panel", UI.sb(Color(0, 0, 0, 0.5), Color(0, 0, 0, 0), 0, 4, 8))
	bg.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bg.add_child(l)
	feed.add_child(bg)
	_feed_items.append({"node": bg, "t": 6.0})
	while _feed_items.size() > 5:
		(_feed_items[0].node as Node).queue_free()
		_feed_items.remove_at(0)
	if kind == Events.Msg.RADIO:
		Quest.add_log(text)

func _on_hold(p: float, label: String) -> void:
	if p <= -2.0:
		hold_bar.visible = false
		hold_label.visible = false
		interact_btn.progress = -1.0
		return
	hold_bar.visible = true
	hold_label.visible = true
	hold_label.text = label
	hold_bar.value = (p if p >= 0.0 else fmod(Time.get_ticks_msec() / 1000.0, 1.0)) * 100.0
	interact_btn.progress = p if p >= 0.0 else -1.0

# ------------------------------------------------------------------ окна
func open(kind: String, data: Variant) -> void:
	if open_window != null:
		if open_window.get_meta("kind", "") == kind and kind != "dialog":
			close_window()
			return
		close_window()
	var w: Control = WindowFactory.create(kind, data, self)
	if w == null:
		return
	w.set_meta("kind", kind)
	windows.add_child(w)
	open_window = w
	touch_root.visible = false
	get_tree().paused = true
	if Game.player:
		var p := Game.player as Player
		p.touch_fire = false
		p.touch_move = Vector2.ZERO
		p.touch_interact = false
	Sfx.play("ui", -4.0)

func close_window() -> void:
	if open_window:
		open_window.queue_free()
		open_window = null
	touch_root.visible = Settings.use_touch()
	get_tree().paused = false
	_refresh_slots()
	Events.ui_closed.emit("")
