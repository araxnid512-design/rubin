extends Node3D
## Главная сцена BUNKER SURVIVAL: строит мир (поверхность и бункер), героя, камеру и интерфейс; загружает
## сохранение. Автотесты: аргумент --bc-test=<имя> (см. tools/test_runner.gd).

var player: BCPlayer
var cam: BCCamera
var hud: BCHud


var _loading: CanvasLayer
const START_MSG := "Убежище-7, утро. Генератор кашляет — Михалыч хотел поговорить. Метка над ним."


func _ready() -> void:
	# экран загрузки — сразу, мир строится следующим кадром
	_loading = CanvasLayer.new()
	_loading.layer = 50
	var bg := ColorRect.new()
	bg.color = Color(0.05, 0.05, 0.045)
	bg.set_anchors_preset(Control.PRESET_FULL_RECT)
	_loading.add_child(bg)
	var lbl := Label.new()
	lbl.text = "BUNKER SURVIVAL\n\nзагрузка убежища…"
	lbl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lbl.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	lbl.set_anchors_preset(Control.PRESET_FULL_RECT)
	lbl.add_theme_font_size_override("font_size", 30)
	lbl.add_theme_color_override("font_color", Color(0.9, 0.78, 0.45))
	_loading.add_child(lbl)
	add_child(_loading)
	await get_tree().process_frame
	await get_tree().process_frame
	Core.env.attach(self)
	Core.world.world_root = self
	var t0 := Time.get_ticks_msec()
	var surf := Locations.build_surface(self)
	var bunk := Locations.build_bunker(self)
	print("BunkerCore: мир построен за %d мс" % (Time.get_ticks_msec() - t0))
	# неподвижную геометрию — в общие сетки по участкам (меньше вызовов отрисовки на телефоне)
	await get_tree().process_frame
	var t1 := Time.get_ticks_msec()
	var b1 := BCBatcher.batch(bunk, 9.0, true)
	var b2 := BCBatcher.batch(surf, 20.0)
	print("BunkerCore: объединено %d сеток в %d (бункер), %d в %d (поверхность) за %d мс" % [b1.removed, b1.made, b2.removed, b2.made, Time.get_ticks_msec() - t1])
	player = BCPlayer.new()
	player.name = "Player"
	add_child(player)
	# начало — в жилом отсеке
	player.global_position = Vector3(-5.2, Locations.FLOOR + 0.05, -24.8)
	player.reset_physics_interpolation()
	player.rotation.y = PI
	_spawn_npcs()
	Core.quest.attach(self)
	Core.quest.new_game()
	cam = BCCamera.new()
	add_child(cam)
	cam.set_target(player)
	hud = BCHud.new()
	add_child(hud)
	hud.bind_player(player)
	Core.mobile.apply()
	await _warm_shaders()
	# зона по месту старта (тела в зонах определяются физикой на следующем кадре)
	await get_tree().physics_frame
	await get_tree().physics_frame
	_loading.queue_free()
	if Core.test_mode == "":
		_menu()
	else:
		Core.say(START_MSG, "info")
	if Core.test_mode != "":
		var tr: Node = load("res://tools/test_runner.gd").new()
		tr.name = "TestRunner"
		add_child(tr)


func _spawn_npcs() -> void:
	var y := Locations.FLOOR + 0.05
	var eng := BCNpc.new()
	eng.name = "Engineer"
	eng.model_path = "res://assets/models/npc_eng.glb"
	eng.anim_set = "res://assets/anim/eng"
	eng.display_name = "Михалыч, инженер"
	eng.npc_id = "eng"
	eng.lines = PackedStringArray([
		"Генератор тянет, но масло пора менять. Если найдёшь наверху канистру — тащи сюда.",
		"Фильтры ФВУ я проверил. Пока держат. Без них нам тут неделю, не больше.",
		"Наверх без костюма не лезь. Фон у грузовика — как у реактора без крышки.",
		"Гермодверь шлюза закрывай за собой. Пыль с поверхности — хуже любой твари."])
	eng.points = [Vector3(3.6, y, -16.6), Vector3(-6.0, y, -17.6), Vector3(0.0, y, -20.8)]
	eng.add_to_group("bunker_only")
	add_child(eng)
	eng.global_position = Vector3(2.0, y, -16.8)
	eng.reset_physics_interpolation()
	var med := BCNpc.new()
	med.name = "Medic"
	med.model_path = "res://assets/models/npc_med.glb"
	med.anim_set = "res://assets/anim/med"
	med.display_name = "Аня, медик"
	med.npc_id = "med"
	med.lines = PackedStringArray([
		"Если доза за двести пятьдесят — сразу ко мне. Выведем, сколько получится.",
		"Йодид калия кончается. Наверху был медпункт при котельной — проверь, если будешь рядом.",
		"Спать надо. Без сна и доза переносится хуже, честно.",
		"Аптечку со стены возьми, если ещё не взял. Пригодится."])
	med.points = [Vector3(-14.0, y, -25.0), Vector3(-12.6, y, -26.2), Vector3(-16.4, y, -25.6)]
	med.add_to_group("bunker_only")
	add_child(med)
	med.global_position = Vector3(-13.0, y, -24.8)
	med.reset_physics_interpolation()
	# враги наверху — управляющий встречами (game/encounters.gd)
	var enc: Node = load("res://game/encounters.gd").new()
	enc.name = "Encounters"
	add_child(enc)
	enc.call_deferred("start")


## стартовое меню: продолжить сохранённую игру или начать заново
func _menu() -> void:
	var has: bool = Core.save.has_save()
	var v := hud._open("BUNKER SURVIVAL", 560, 400 if has else 330)
	var t := hud._label("Подземное убежище «Убежище-7». Годы после катастрофы.\nНаверху — радиация. Внизу — дом, который нужно сохранить.", 17)
	t.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	t.custom_minimum_size = Vector2(500, 0)
	v.add_child(t)
	if has:
		v.add_child(hud._button("Продолжить", func():
			hud.close_modal()
			Core.save.load_game()
			Core.say("Сохранение загружено.", "info")))
	v.add_child(hud._button("Новая игра", func():
		hud.close_modal()
		Core.save.delete_save()
		Core.quest.new_game()
		Core.say(START_MSG, "info")))
	v.add_child(hud._button("Настройки", hud.show_settings))



## прогрев шейдеров за экраном загрузки: на телефоне шейдер собирается при первом показе материала — отсюда
## подвисания при выходе наверх, первой драке, первом мутанте. Здесь на несколько кадров видно всё сразу:
## поверхность и бункер сверху, враги всех видов, фонарь, свечение, частицы.
func _warm_shaders() -> void:
	var hidden := []
	for g in ["surface_only", "bunker_only", "roof"]:
		for n in get_tree().get_nodes_in_group(g):
			if n is Node3D and not n.visible:
				hidden.append(n)
				n.visible = true
	var wc := Camera3D.new()
	wc.fov = 100.0
	wc.far = 400.0
	add_child(wc)
	wc.global_position = Vector3(0, 70, -8)
	wc.rotation_degrees = Vector3(-90, 0, 0)
	wc.current = true
	# враги и эффекты, которые появятся позже
	var temp := []
	var enc: Node = get_node_or_null("Encounters")
	if enc:
		for v in ["leader", "mutant", "raider"]:
			var e: Node = enc.spawn(v, Vector3(randf_range(-6, 6), 0.3, randf_range(-14, -2)), "", "")
			if e:
				e.role = "resident"
				e.remove_from_group("enemy")
				temp.append(e)
	player._torch.visible = true
	player._blood(Vector3(0, 1, -8))
	Core.play_at("swoosh", Vector3.ZERO, -80.0)
	for i in 4:
		await RenderingServer.frame_post_draw
	# бункер крупно: свет комнат, лучи, грязь
	wc.global_position = Vector3(-2.5, 6.0, -20.0)
	for i in 3:
		await RenderingServer.frame_post_draw
	player._torch.visible = false
	for e in temp:
		e.queue_free()
	wc.queue_free()
	for n in hidden:
		if is_instance_valid(n):
			n.visible = false
	if cam:
		cam.current = true
