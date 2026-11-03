extends Node
## Точка входа: главное меню → загрузка локации → игра.
## Аргументы командной строки (после --): autotest, shots, bench — автоматические проверки.

var ui_layer: CanvasLayer
var hud_layer: CanvasLayer
var menu: Control
var loading: Control
var load_bar: ProgressBar
var load_label: Label
var world: GameWorld
var hud: HUD
var busy := false

func _ready() -> void:
	name = "Main"
	process_mode = Node.PROCESS_MODE_ALWAYS
	get_tree().root.content_scale_aspect = Window.CONTENT_SCALE_ASPECT_EXPAND
	ui_layer = CanvasLayer.new()
	ui_layer.layer = 20
	add_child(ui_layer)
	_build_menu()
	_build_loading()
	Sfx.set_ambient("amb_wind")
	var args := OS.get_cmdline_user_args()
	if "autotest" in args or "shots" in args or "bench" in args or "smoke" in args:
		var tool := Node.new()
		var script_name := "autotest" if "autotest" in args else ("shots" if "shots" in args else ("bench" if "bench" in args else "smoke"))
		var scr := load("res://tools/%s.gd" % script_name) as GDScript
		if scr == null or not scr.can_instantiate():
			push_error("Не удалось загрузить инструмент " + script_name)
			get_tree().quit(2)
			return
		tool.set_script(scr)
		tool.name = "Tool"
		add_child(tool)

func _build_menu() -> void:
	menu = Control.new()
	menu.set_anchors_preset(Control.PRESET_FULL_RECT)
	menu.theme = UI.theme()
	ui_layer.add_child(menu)
	var bg := ColorRect.new()
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = """shader_type canvas_item;
void fragment(){
	vec2 uv = UV;
	float n = fract(sin(dot(floor(uv * vec2(320.0, 180.0)), vec2(12.9898, 78.233))) * 43758.5453);
	vec3 c = mix(vec3(0.06, 0.055, 0.05), vec3(0.16, 0.05, 0.04), smoothstep(0.2, 1.2, uv.x + uv.y * 0.3));
	c += (n - 0.5) * 0.025;
	float stripe = step(0.985, fract((uv.x - uv.y) * 14.0));
	c = mix(c, vec3(0.3, 0.06, 0.05), stripe * 0.25);
	float vig = smoothstep(1.1, 0.3, length(uv - 0.5));
	COLOR = vec4(c * (0.6 + 0.4 * vig), 1.0);
}"""
	sm.shader = sh
	bg.material = sm
	menu.add_child(bg)
	var emblem := TextureRect.new()
	emblem.texture = load("res://icon.svg")
	UI.place(emblem, Control.PRESET_CENTER_LEFT, Vector2(170, -260), Vector2(300, 300))
	emblem.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	emblem.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	menu.add_child(emblem)
	var title := UI.label("ДОЛГ: ВОЗРОЖДЕНИЕ", 92, Color(0.92, 0.88, 0.8))
	UI.place(title, Control.PRESET_CENTER_LEFT, Vector2(120, 80), Vector2.ZERO)
	menu.add_child(title)
	var sub := UI.label("Зона отчуждения · Район Ростока · База группировки «Долг»", 32, UI.RED_L)
	UI.place(sub, Control.PRESET_CENTER_LEFT, Vector2(126, 200), Vector2.ZERO)
	menu.add_child(sub)
	var box := UI.vbox(14)
	UI.place(box, Control.PRESET_CENTER_RIGHT, Vector2(-640, -330), Vector2.ZERO)
	box.custom_minimum_size = Vector2(520, 0)
	menu.add_child(box)
	box.add_child(UI.button("Новая игра", new_game, 36, 520, 100))
	var cont := UI.button("Продолжить", func(): load_slot(Game.latest_slot()), 36, 520, 100)
	cont.name = "Continue"
	box.add_child(cont)
	box.add_child(UI.button("Загрузить", _show_load, 36, 520, 100))
	box.add_child(UI.button("Настройки", _show_settings, 36, 520, 100))
	if not OS.has_feature("web"):
		box.add_child(UI.button("Выход", func(): get_tree().quit(), 36, 520, 100))
	var ver := UI.label("Первый играбельный этап · v%s · Godot %s" % [ProjectSettings.get_setting("application/config/version"), Engine.get_version_info().string], 22, UI.DIM)
	UI.place(ver, Control.PRESET_BOTTOM_LEFT, Vector2(24, -50), Vector2.ZERO)
	menu.add_child(ver)
	_update_continue()

func _update_continue() -> void:
	var c := menu.find_child("Continue", true, false) as Button
	if c:
		c.disabled = Game.latest_slot() < 0

func _show_load() -> void:
	var w := _sub_window("Загрузить игру")
	for i in range(0, Game.SLOTS + 1):
		var t := ("Автосохранение" if i == 0 else "Слот %d" % i) + ": " + Game.slot_info(i)
		var b := UI.button(t, func():
			w.queue_free()
			load_slot(i), 26, 1000, 90)
		b.disabled = not Game.has_save(i)
		w.get_node("Box").add_child(b)

func _show_settings() -> void:
	var dummy := Node.new()
	dummy.set_script(load("res://scripts/ui/menu_settings_host.gd"))
	add_child(dummy)

func _sub_window(title: String) -> Control:
	var root := Control.new()
	root.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.theme = UI.theme()
	var dim := ColorRect.new()
	dim.color = Color(0, 0, 0, 0.7)
	dim.set_anchors_preset(Control.PRESET_FULL_RECT)
	root.add_child(dim)
	var p := UI.panel()
	UI.place(p, Control.PRESET_CENTER, Vector2(-560, -380), Vector2.ZERO)
	p.custom_minimum_size = Vector2(1120, 760)
	root.add_child(p)
	var v := UI.vbox(12)
	v.name = "Box"
	p.add_child(v)
	var head := UI.hbox()
	v.add_child(head)
	head.add_child(UI.label(title, 34, UI.RED_L))
	head.add_child(UI.expand(UI.spacer()))
	head.add_child(UI.button("✕", func(): root.queue_free(), 28, 80, 64))
	ui_layer.add_child(root)
	return root

func _build_loading() -> void:
	loading = Control.new()
	loading.set_anchors_preset(Control.PRESET_FULL_RECT)
	loading.theme = UI.theme()
	loading.visible = false
	ui_layer.add_child(loading)
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.045, 0.04)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	loading.add_child(bg)
	var t := UI.label("ДОЛГ: ВОЗРОЖДЕНИЕ", 64)
	UI.place(t, Control.PRESET_CENTER, Vector2(-420, -200), Vector2.ZERO)
	loading.add_child(t)
	load_label = UI.label("", 30, UI.DIM)
	UI.place(load_label, Control.PRESET_CENTER, Vector2(-500, -40), Vector2.ZERO)
	loading.add_child(load_label)
	load_bar = UI.bar(UI.RED, 30)
	UI.place(load_bar, Control.PRESET_CENTER, Vector2(-500, 20), Vector2(1000, 30))
	loading.add_child(load_bar)
	var hint := UI.label("Совет: ресурсы сдавайте на склад — ремонт берёт материалы оттуда. За периметром опасно: псы слышат шаги и выстрелы.", 24, UI.DIM, true)
	UI.place(hint, Control.PRESET_CENTER, Vector2(-500, 90), Vector2(1000, 100))
	loading.add_child(hint)

func new_game() -> void:
	if busy:
		return
	Game.new_game_state()
	Quest.reset()
	await start_world()
	if hud:
		hud.open("dialog", "intro")

func load_slot(slot: int) -> void:
	if busy or slot < 0:
		return
	var data := Game.read_save(slot)
	if data.is_empty():
		return
	Game.apply_save(data)
	await start_world()
	Events.msg("Загружено: " + ("автосохранение" if slot == 0 else "слот %d" % slot), Events.Msg.INFO)

func _free_world() -> void:
	get_tree().paused = false
	if hud_layer:
		hud_layer.queue_free()
		hud_layer = null
		hud = null
	if world:
		world.queue_free()
		world = null
	Game.world = null
	Game.player = null
	Game.hud = null

func start_world() -> void:
	busy = true
	_free_world()
	await get_tree().process_frame
	menu.visible = false
	loading.visible = true
	load_bar.value = 0
	world = GameWorld.new()
	world.name = "World"
	add_child(world)
	world.progress.connect(func(p, t):
		load_bar.value = p * 100.0
		load_label.text = t)
	await world.build_async(true)
	hud_layer = CanvasLayer.new()
	hud_layer.layer = 10
	add_child(hud_layer)
	hud = HUD.new()
	hud_layer.add_child(hud)
	loading.visible = false
	Game.power_on = false
	Game.update_power()
	RenderingServer.global_shader_parameter_set("power_on", 1.0 if Game.power_on else 0.0)
	busy = false

func to_menu() -> void:
	_free_world()
	menu.visible = true
	_update_continue()

func _notification(what: int) -> void:
	if what == NOTIFICATION_WM_GO_BACK_REQUEST:
		if hud and hud.open_window:
			hud.close_window()
		elif hud:
			hud.open("pause", null)
	elif what == NOTIFICATION_APPLICATION_PAUSED and world and Game.player:
		Game.save_game(0)
