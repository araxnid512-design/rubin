extends Node3D
## Стартовая локация — стабильный кластер 100×100 м (для проверки героя в мире): земля с травой, проплешинами
## и вытоптанной площадкой у крыльца, деревья и кусты (модели Tripo), деревянный дом с пятью комнатами, ящики, которые можно
## ставить и убирать (сохраняются). Граница кластера — полоса гравия и невидимая стена.
## Управление: левая часть экрана — джойстик (слегка — лёгкий бег, сильнее — быстрее), справа — круглые кнопки:
## большая — атака (огонь / мачете / кулаки), смена оружия, взять-открыть, лечение, перезарядка, инвентарь. Камера неподвижна, сверху,
## следует за героем; два пальца — приблизить. На компьютере — WASD, Shift — бег, E — действие, I — инвентарь,
## Q — оружие, колесо — приблизить.
## Проверка: --as-test=world --as-out=папка — обход локации и дома по точкам, снимки и журнал.

const SIZE := 100.0               ## кластер, м
const SAVE := "user://cluster.json"
const SAVE_V := 7                 ## версия сохранения: 6 — в ящиках всё оружие и патроны, манекен
const CRATE_SLOTS := 12
const HOUSE_AT := Vector3(0, 0, -12)
## двор вокруг дома: от дома x0, z0, x1, z1 (м); калитка — спереди посередине
const YARD := [-11.0, -9.0, 11.0, 10.0]
const GATE := 2.4
const C_BG := Color(0.05, 0.07, 0.09, 0.85)
const C_LINE := Color(0.35, 0.75, 0.95, 0.7)
const C_TEXT := Color(0.88, 0.93, 0.97)
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"

## деревья: модель, высота, сколько, радиус ствола (для столкновений; 0 — без столкновений)
const FLORA := [
	["ul_birch", 4.0, 6, 0.14], ["ul_pine", 4.6, 10, 0.16], ["ul_apple", 3.0, 3, 0.15], ["ph_bush", 1.2, 22, 0.0],
]

var player: CharacterBody3D
var rig: BCCharacter
var snd: BCSound
var house: ULHouse
var cam: Camera3D
## камера как в изометрических выживалках: неподвижна, сверху под 55°, смотрит на север (дом — вверху экрана)
var CAM_YAW := 0.0                  ## поворот камеры вокруг героя (настройки: «Камера»), рад
var CAM_PITCH := 0.91               ## наклон: 52° — «С наклоном», как в DoZ Survival (ULSettings.CAMS)


## угол камеры — из настроек (сверху / с наклоном / по диагонали); стены построек и дома, закрывающие героя от
## камеры, выбираются по нему же
func _cam_apply() -> void:
	ULSettings.load_cfg()
	var c: Dictionary = ULSettings.CAMS[ULSettings.cam]
	CAM_YAW = deg_to_rad(float(c.yaw))
	CAM_PITCH = deg_to_rad(float(c.pitch))
	ULFarmBuilding.cam_dir = Vector3(sin(CAM_YAW), 0, cos(CAM_YAW))
	ULHouse.cam_x = sin(CAM_YAW)
var cam_dist := 12.0
var _cam_t := Vector3.ZERO
var crates: Array[Node3D] = []
var _crate_scene: PackedScene = null
var _joy_id := -1
var _joy_o := Vector2.ZERO
var _joy_v := Vector2.ZERO
var _touch := {}
var _pinch := 0.0
var info: Label
var test := ""
var out := "user://world"
var _auto: Array = []             ## проверка: точки, к которым герой идёт сам
var _steps := {}
var inv: ULInventory
var inv_ui: ULInventoryUI
var ground: Array = []            ## предметы на земле: {item, node}
var _target = null                ## ближайшее, с чем можно что-то сделать: {"type": "ground"/"crate", …}
var _open_ground = null           ## открытый рюкзак на земле (запись из ground)
var _hud: Control
var _hud_btns := {}               ## имя → [центр, радиус, подпись]
var _hud_touch := {}              ## палец → кнопка
var _pack_shown := ""
var _preview_vp: SubViewport
var _preview_rig: BCCharacter
var _preview_pack := ""
var _toast: Label
var _toast_t := 0.0


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
		if a.begins_with("--as-gfx="):
			ULSettings.load_cfg()
			ULSettings.gfx = clampi(int(a.substr(9)), 0, 2)    # уровень графики для проверок и снимков
		if a.begins_with("--as-cam="):
			ULSettings.load_cfg()
			ULSettings.cam = clampi(int(a.substr(9)), 0, ULSettings.CAMS.size() - 1)   # угол камеры для снимков
	_cam_apply()
	if test == "arena":
		ULSettings.arena = true
	if test.begins_with("cs"):
		# проверки коровника: --as-test=cs (посещение), csbake (карты проходимости и земли), csview (снимки), csperf
		ULSettings.arena = false
		ULSettings.place = "cowshed"
		if test == "csperf":
			# замер — при наибольшем числе врагов: 30 пустышей и 8 лоторейщиков
			var cc := ULCowshed.cfg().duplicate(true)
			var nmax := -1
			for a2 in OS.get_cmdline_user_args():
				if a2.begins_with("--as-n="):
					nmax = int(a2.substr(7))
			cc.pustysh = [cc.pustysh[1], cc.pustysh[1]] if nmax < 0 else [nmax, nmax]
			cc.lottery = [cc.lottery[1], cc.lottery[1]] if nmax < 0 else [0, 0]
			ULCowshed._cfg = cc
	if test.begins_with("sn"):
		# проверки санатория: --as-test=sn (посещение), snbake (карты проходимости и земли), snview (снимки), snperf
		ULSettings.arena = false
		ULSettings.place = "sanatorium"
		if test == "snperf":
			var sc := ULSanatorium.cfg().duplicate(true)
			sc.pustysh = [sc.pustysh[1], sc.pustysh[1]]
			sc.lottery = [sc.lottery[1], sc.lottery[1]]
			sc.ruber_chances = [0, 0, 1]                 # и два Рубера — всего 57
			ULSanatorium._cfg = sc
	if test == "lvl" or test == "lvlbench":
		# проверка «Теста уровней»: --as-place=khutor (по умолчанию — дом); lvlbench — с «Замером FPS»
		ULSettings.arena = false
		ULSettings.bench = test == "lvlbench"
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-place="):
				ULSettings.place = a.substr(11)
	if test.begins_with("kh"):
		# проверки хутора: --as-test=kh (посещение), khbake (карты и кэш), khview (снимки), khperf
		ULSettings.arena = false
		ULSettings.place = "khutor"
		if test == "khperf":
			var kc := ULKhutor.kcfg().duplicate(true)
			kc.pustysh = [kc.pustysh[1], kc.pustysh[1]]
			kc.lottery = [kc.lottery[1], kc.lottery[1]]
			kc.ruber_chances = [0, 1]                    # и Рубер — всего 40
			ULKhutor._kcfg = kc
	if test.begins_with("cv"):
		# проверки конвоя: --as-test=cv (посещение), cvbake (карты и кэш), cvview (снимки), cvperf
		ULSettings.arena = false
		ULSettings.place = "convoy"
		if test == "cvperf":
			var vc := ULConvoy.ccfg().duplicate(true)
			vc.pustysh = [vc.pustysh[1], vc.pustysh[1]]
			vc.lottery = [vc.lottery[1], vc.lottery[1]]
			vc.ruber_chances = [0, 1]                    # и Рубер — всего 46
			ULConvoy._ccfg = vc
	if test == "gfxdiag":
		# замер графики логова по частям — с настройками игры (как на телефоне), герой бессмертен
		ULSettings.arena = false
		ULSettings.place = "lair"
	if test.begins_with("lr"):
		# проверки логова муров: --as-test=lr (посещение и бой), lrbake (карты и кэш), lrview (снимки), lrperf
		ULSettings.arena = false
		ULSettings.place = "lair"
		if test == "lrperf":
			var lc := ULLair.lcfg().duplicate(true)
			lc.murs = [lc.murs[1], lc.murs[1]]
			ULLair._lcfg = lc
	lvl = ULSettings.level_test and test == "" or test == "lvl" or test == "lvlbench" or test == "lrview" or test == "gfxdiag"
	if test != "" or lvl:
		# проверки и тест уровней: база только в памяти; оружейник установлен (кроме проверки компьютера — там он покупается)
		ULBase.memory_only = true
		ULBase.load_state(true)
		if test != "pc":
			ULBase.data.upgrades["gunsmith"] = 1
			ULBase.data.staff["gunsmith"] = true
	arena = ULSettings.arena
	place = ULSettings.place if not arena and ULSettings.place in ["cowshed", "sanatorium", "convoy", "khutor", "lair"] else "home"
	ULSettings.apply(get_viewport())
	if test != "" and not test.ends_with("view") and test != "gfxdiag":
		# автоматические проверки идут на программной отрисовке (без видеокарты): в полном разрешении со
		# сглаживанием — 2–3 кадра/с, шаг кадра в треть секунды ломает проверки ходьбы по лестницам; поэтому
		# проверкам — дешёвая отрисовка (снимки вида — *view — в настройках игры)
		get_viewport().scaling_3d_scale = 0.5
		get_viewport().msaa_3d = Viewport.MSAA_DISABLED
	Music.stop()
	_env()
	if arena:
		_arena_ground()
	elif place == "cowshed":
		_cowshed_world()
	elif indoor():
		_san_world()
	else:
		_ground()
		house = ULHouse.new()
		house.name = "House"
		add_child(house)
		house.position = HOUSE_AT
		house.build(MODELS + "ul_house.glb", TEX + "weathered_brown_planks", TEX + "brown_planks_03")
		_fit_shell()
		_terminal_build()
		_armory()
		_yard()
		_base_props()
		_flora()
		if test == "bake":
			# карта земли — после деревьев: под ними лесная подстилка
			_mask_img = _bake_mask()
			_mask_img.save_png(ProjectSettings.globalize_path(GROUND_MASK))
			_ground_mat.set_shader_parameter("mask", ImageTexture.create_from_image(_mask_img))
		if test == "bake":
			_bake_nav()
		_nav_load()
	_blob_layer()
	_player()
	_combat_setup()
	if temp():
		_cowshed_enter.call_deferred()
	elif not arena:
		_npcs_setup()
		if test == "":
			_enemies_setup()
	_load_profile()
	inv = ULInventory.new()
	_ui()
	if ResourceLoader.exists(MODELS + "ul_crate.glb"):
		_crate_scene = load(MODELS + "ul_crate.glb")
	_load()
	if test == "" and not lvl and not temp() and not arena and ULCase.pending() != null:
		# награда из оружейного сундука не выдана (не было места, закрыли игру) — окно выдачи сразу дома
		_case_show.call_deferred(ULCase.pending(), true)
	if lvl:
		_lvl_setup()
		if ULSettings.bench and (test == "" or test == "lvlbench"):
			_bench_run.call_deferred()
	_apply_gear()
	if place == "home" and not arena and ULSettings.arrival_note != "" and test == "" and not lvl:
		var note := ULSettings.arrival_note
		ULSettings.arrival_note = ""
		_arrival.call_deferred(note)
	# герой для окна инвентаря создаётся сразу (иначе первое открытие инвентаря — заминка в четверть секунды и больше)
	_make_preview()
	_preview_on(false)
	_prewarm.call_deferred()
	if test != "":
		_run_test.call_deferred()


# ---------------- навигация врагов ----------------

## Карта проходимости кластера: где можно пройти между забором, домом, деревьями, мебелью. Строится один раз по
## столкновениям мира (--as-test=bake) и хранится в проекте — в игре только загружается. Враг, который не видит
## героя напрямую, идёт по ней: в обход забора через калитку, в дом через дверь (ULEnemy._nav_dir).
const NAV_MESH := "res://assets/world/nav_cluster.res"


func _bake_nav(path := NAV_MESH) -> void:
	var nm := NavigationMesh.new()
	nm.agent_radius = 0.35
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.3
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	if indoor():
		# в корпусах двери узкие (1,1 м): мельче сетка, точнее радиус — иначе проём «закрыт» для карты
		nm.cell_size = NAV_CELL_SAN
		nm.cell_height = 0.1
		nm.agent_radius = 0.375                 # три ячейки: с запасом на тело врага (0,28 м), но двери 1,1 м проходимы
		nm.edge_max_error = 1.0                 # углы пути срезаются не больше чем на 12 см (иначе запас у углов тает)
		nm.agent_height = 1.7
		nm.agent_max_climb = 0.25
		nm.filter_ledge_spans = true            # без «островков» на столах, кроватях и шкафах
		nm.region_min_size = 9.0
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	var hgt := 18.0 if place == "sanatorium" else (7.0 if place == "convoy" or place == "khutor" or place == "lair" else 5.0)   # в санатории — все этажи корпусов; в конвое — вышка
	var y0 := -3.4 if place == "khutor" else -1.0                # на хуторе — погреба на 2,6 м под землёй
	nm.filter_baking_aabb = AABB(Vector3(-size_m * 0.5 - 12.0, y0, -size_m * 0.5 - 12.0), Vector3(size_m + 24.0, hgt - y0 - 1.0, size_m + 24.0))
	nm.geometry_collision_mask = 1                              # без дверей (слой 2): путь идёт через проём
	var src := NavigationMeshSourceGeometryData3D.new()
	var t0 := Time.get_ticks_msec()
	NavigationServer3D.parse_source_geometry_data(nm, src, self)
	NavigationServer3D.bake_from_source_geometry_data(nm, src)
	ResourceSaver.save(nm, path, ResourceSaver.FLAG_COMPRESS)
	print("[bake] карта проходимости: многоугольников %d, вершин %d, %d мс → %s" % [nm.get_polygon_count(), nm.vertices.size(), Time.get_ticks_msec() - t0, path])


const NAV_CELL_SAN := 0.125


func _nav_load(path := NAV_MESH) -> void:
	if indoor():
		var mp := get_world_3d().navigation_map
		NavigationServer3D.map_set_cell_size(mp, NAV_CELL_SAN)
		NavigationServer3D.map_set_cell_height(mp, 0.1)
	if not ResourceLoader.exists(path):
		return
	var reg := NavigationRegion3D.new()
	reg.name = "Nav"
	reg.navigation_mesh = load(path)
	add_child(reg)


# ---------------- временный кластер «Опасный коровник» ----------------

## Локация 150×150 м собирается ULCowshed (core/world/cowshed.gd); останки коров и враги — заново при каждом входе.
## Посещение — 10 минут (data/cowshed.json): предупреждения за 5 и 2 минуты, последние 30 с — красный таймер
## и тревога; на нуле кластер перезагружается — герой погибает, всё, что при себе, теряется (вещи на базе целы),
## маршрут закрывается и локация пропадает с карты. Уйти можно раньше — за край поля, с добычей. На диск во время
## посещения пишется только то, что при себе (ящики и вещи базы не трогаются).
const NAV_COWSHED := "res://assets/world/nav_cowshed.res"
const CS_NOTES := {
	"left": "Вы покинули кластер «%s» с добычей. Маршрут закрыт — для нового посещения купите его снова.",
	"reset": "Кластер перезагрузился, пока вы были внутри. Вы погибли и потеряли всё, что было при себе. Вещи на базе целы.",
	"dead": "Вы погибли в кластере «%s» и потеряли всё, что было при себе. Вещи на базе целы.",
	"menu": "Вы покинули кластер «%s». Маршрут закрыт.",
}
var place := "home"
var cowshed: ULCowshed
var size_m := SIZE
var cs_seed := 0                  ## случайность этого посещения (останки коров, враги)
var cs_plan: Array = []           ## кто и где появился в этот раз
var _cs_end := 0.0                ## когда кластер перезагрузится (unix-время, с)
var cs_start := 0.0               ## когда начато посещение
var _cs_warned := {}
var _cs_over := false             ## время вышло — герой погибает вместе с кластером
var _cs_done := false
var _cs_alarm := 0.0
var cs_ready := false             ## враги расставлены
var sn_ready_ms := 0              ## когда (мс от запуска) локация готова
var prof_mid := 0
var prof_mid_n := 0
var prof_full := 0
var prof_full_n := 0
var prof_parts := {}              ## замер по частям кадра (snperf/csperf)


func _cowshed_world() -> void:
	size_m = float(ULCowshed.cfg().get("size", 150.0))
	cowshed = ULCowshed.new()
	cowshed.name = "Cowshed"
	add_child(cowshed)
	zone = cowshed
	cowshed.build(self)
	_noise_tex = cowshed._noise_tex
	_edge_fog()
	if test == "csbake":
		_bake_nav(NAV_COWSHED)
	_nav_load(NAV_COWSHED)


# ---------------- временный кластер «Санаторий Луч» ----------------

## Локация 150×150 м собирается ULSanatorium (core/world/sanatorium.gd) из корпусов ULBlock — во все можно зайти.
## Всё остальное (таймер, выход, гибель, перезагрузка, враги, хлам) — общее с коровником: функции ниже работают
## с текущим временным кластером (zone).
const NAV_SANATORIUM := "res://assets/world/nav_sanatorium.res"
var san: ULSanatorium
var blobs: ULBlobs                      ## пятна-тени под предметами, героем и врагами
var zone: Node3D                  ## текущий временный кластер: коровник или санаторий


func _san_world() -> void:
	san = ULKhutor.new() if place == "khutor" else (ULConvoy.new() if place == "convoy" else (ULLair.new() if place == "lair" else ULSanatorium.new()))
	size_m = float(san.conf().get("size", 150.0))
	san.name = {"khutor": "Khutor", "convoy": "Convoy", "lair": "Lair"}.get(place, "Sanatorium")
	add_child(san)
	zone = san
	san.build(self)
	_noise_tex = san._noise_tex
	_edge_fog()
	var nav := ULKhutor.K_NAV if place == "khutor" else (ULConvoy.C_NAV if place == "convoy" else (ULLair.L_NAV if place == "lair" else NAV_SANATORIUM))
	if test == "snbake" or test == "cvbake" or test == "khbake" or test == "lrbake":
		_bake_nav(nav)
	_nav_load(nav)


## кластер с помещениями, в которые можно зайти (санаторий, конвой): этажи, двери, тайники, свет внутри
func indoor() -> bool:
	return place == "sanatorium" or place == "convoy" or place == "khutor" or place == "lair"


## временный кластер (коровник, санаторий) — не база и не полигон
func temp() -> bool:
	return place == "cowshed" or indoor()


func zone_cfg() -> Dictionary:
	if place == "khutor":
		return ULKhutor.kcfg()
	if place == "lair":
		return ULLair.lcfg()
	if place == "convoy":
		return ULConvoy.ccfg()
	return ULSanatorium.cfg() if place == "sanatorium" else ULCowshed.cfg()


func zone_name() -> String:
	if place == "khutor":
		return ULKhutor.K_TITLE
	if place == "lair":
		return ULLair.L_TITLE
	if place == "convoy":
		return ULConvoy.C_TITLE
	return ULSanatorium.TITLE if place == "sanatorium" else "Опасный коровник"


func zone_entry() -> Vector3:
	if place == "khutor":
		return ULKhutor.K_ENTRY
	if place == "lair":
		return ULLair.L_ENTRY
	if place == "convoy":
		return ULConvoy.C_ENTRY
	return ULSanatorium.ENTRY if place == "sanatorium" else ULCowshed.ENTRY


func zone_entry_yaw() -> float:
	return ULSanatorium.ENTRY_YAW if place == "sanatorium" else ULCowshed.ENTRY_YAW


## герой перешёл в другой корпус или на другой этаж: скрыть то, что теперь скрыто (враги, вещи, тела внутри)
func zone_changed() -> void:
	if san == null:
		return
	for g in ground:
		var n: Node3D = g.node
		n.visible = san.visible_at(n.global_position)
	for e in enemies:
		e.visible = san.visible_at(e.global_position + Vector3.UP * 0.3)
	if _box_hl != null:
		_box_hl.visible = false


## вход: отсчёт времени, останки коров и враги — по случайности этого посещения (каждый вход — по-новому)
func _cowshed_enter() -> void:
	var c := zone_cfg()
	cs_start = Time.get_unix_time_from_system()
	_cs_end = cs_start + float(c.get("minutes", 10)) * 60.0
	if test == "" and ULBase.route_state(place) != "active":
		ULBase.set_route(place, "active")
	if cs_seed == 0:
		cs_seed = 991 if test != "" else int(Time.get_unix_time_from_system() * 1000.0) % 2147483647
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-seed="):
			cs_seed = int(a.substr(10))
	var rng := RandomNumberGenerator.new()
	rng.seed = cs_seed
	zone.place_cows(rng)
	if place == "lair":
		lair_inst = ULCase.new_instance()
	if san != null:
		san.roll_containers(rng)
	_spawn_junk(rng)
	# карта проходимости становится доступна через несколько кадров физики (сервер собирает её в фоне);
	# по ней проверяется каждая точка появления
	var map := get_world_3d().navigation_map
	var probe := zone_entry() + Vector3(0, 0, -6)
	for i in 240:
		await get_tree().physics_frame
		if NavigationServer3D.map_get_iteration_id(map) > 0 and NavigationServer3D.map_get_closest_point(map, probe).distance_to(probe) < 1.0:
			break
	var snap := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	cs_plan = zone.spawn_plan(rng, snap)
	var k := 0
	for sp in cs_plan:
		var en := spawn_enemy(String(sp[0]), sp[1])
		if sp.size() > 2:
			# санаторий: часть стоит на месте, часть бродит; в комнатах — в пределах комнаты
			var outdoor := String(sp[2]) in ["yard", "plaza", "fence", "thicket", "boiler_out", "hozdvor", "behind_main", "road", "camp", "post", "supply", "heli", "tower", "forest"]
			en.wander_r = 0.0 if rng.randf() < 0.4 else (5.0 if outdoor else 1.4)
			if String(sp[0]) == "ruber":
				en.wander_r = 4.0 if outdoor else 2.0           # тяжело бродит на своём месте
			if en is ULMur:
				_mur_role(en as ULMur, String(sp[2]), rng)
		k += 1
		if k % 6 == 0:
			await get_tree().process_frame          # по нескольку за кадр — без долгой заминки на входе
	cs_ready = true
	sn_ready_ms = Time.get_ticks_msec()
	_blobs_build()
	if san != null:
		zone_changed()
	say("%s. До перезагрузки кластера — %d минут" % [zone_name(), int(c.get("minutes", 10))] + (" · ТЕСТ УРОВНЯ: бессмертие, патроны без конца" if lvl else ""))


## Хлам в постройках временного кластера: в каждой постройке — 2–4 кучки, каждый вход заново (по случайности
## посещения). Кучка — один «Хлам»; подобранные складываются в одну стопку. Новые локации с постройками зовут то же.
func _spawn_junk(rng: RandomNumberGenerator) -> void:
	if san != null:
		for p in san.junk_points(rng):
			_spawn_ground(ULItems.make("junk"), p, rng.randf() * TAU)
		return
	if cowshed == null:
		return
	for i in cowshed.barns.size():
		for k in rng.randi_range(2, 4):
			var p := cowshed.barn_point(i, rng)
			_spawn_ground(ULItems.make("junk"), p, rng.randf() * TAU)


## сколько секунд осталось до перезагрузки кластера
func cs_left() -> float:
	return maxf(_cs_end - Time.get_unix_time_from_system(), 0.0) if _cs_end > 0.0 else 0.0


static func _minutes_text(sec: int) -> String:
	var m := sec / 60
	return "%d %s" % [m, ["минута", "минуты", "минут"][ULEconomy.plural_form(m)]]


func _cs_tick(delta: float) -> void:
	if zone:
		zone.tick(player.global_position, cam, delta)
	if _cs_done or _cs_end <= 0.0:
		return
	var left := cs_left()
	var c := zone_cfg()
	for wv in c.get("warn_s", [300, 120]):
		var ws := int(wv)
		if left <= ws and not _cs_warned.has(ws):
			_cs_warned[ws] = true
			if left > ws - 5.0:
				say("Внимание! До перезагрузки кластера %s" % _minutes_text(ws))
				snd.play("beep", player.global_position + Vector3.UP, 0.0, 0.0)
	if left <= float(c.get("alarm_s", 30)) and left > 0.0:
		_cs_alarm -= delta
		if _cs_alarm <= 0.0:
			_cs_alarm = 2.2
			snd.play("alarm", player.global_position + Vector3.UP * 2.0, -4.0, 0.0)
			if not _cs_warned.has(-1):
				_cs_warned[-1] = true
				say("ТРЕВОГА! Кластер перезагружается — уходите за край поля!")
	if left <= 0.0 and lvl:
		# тест уровня: кластер не убивает — таймер просто начинается заново
		_cs_end = Time.get_unix_time_from_system() + float(c.get("minutes", 10)) * 60.0
		_cs_warned.clear()
		say("Тест уровня: таймер кластера начат заново")
		return
	if left <= 0.0 and not _cs_over:
		_cs_over = true
		say("Кластер перезагружается!")
		if _dead_t <= 0.0:
			hp = 0.0
			_dead_t = 3.0
			close_inventory()
			_hud_touch.clear()
			_joy_id = -1
			_joy_v = Vector2.ZERO


## Конец посещения: left — ушёл за край (вещи при себе), menu — вышел в главное меню, reset — кластер
## перезагрузился с героем внутри, dead — погиб. В двух последних случаях всё, что при себе, теряется
## (data/cowshed.json: lose_on_death, lose_wallet). Маршрут закрывается — локация пропадает с карты.
func cs_finish(why: String) -> void:
	if _cs_done:
		return
	_cs_done = true
	if lvl:
		_lvl_exit()
		return
	var c := zone_cfg()
	if why == "reset" or (why == "dead" and bool(c.get("lose_on_death", true))):
		var keep: Dictionary = {} if bool(c.get("lose_wallet", true)) else inv.wallet.duplicate()
		inv.from_dict({"wallet": keep})
		hp = 50.0
	_save_carried()
	ULBase.set_route(place, "")
	ULSettings.place = "home"
	var note := String(CS_NOTES.get(why, ""))
	ULSettings.arrival_note = note % zone_name() if note.contains("%s") else note
	ULSettings.arrival_title = zone_name()
	if test == "":
		get_tree().change_scene_to_file({"left": "res://map.tscn", "menu": "res://menu.tscn"}.get(why, "res://world.tscn"))


## во временном кластере на диск пишется только то, что при себе; ящики и вещи на базе остаются как были
func _save_carried(path := SAVE, force := false) -> void:
	if (test != "" and not force) or (lvl and not force) or not FileAccess.file_exists(path):
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (d is Dictionary):
		return
	d["inv"] = inv.to_dict()
	d["hp"] = hp
	d["en"] = en
	d["water"] = water
	ULBase.write_json(path, d)


func _cs_load() -> void:
	var d = null
	if FileAccess.file_exists(SAVE) and test == "" and not lvl:
		d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if d is Dictionary:
		inv.from_dict(d.get("inv", {}))
		hp = clampf(float(d.get("hp", 65.0)), 1.0, HP_MAX)
		en = clampf(float(d.get("en", 100.0)), 0.0, 100.0)
		water = clampf(float(d.get("water", 100.0)), 0.0, 100.0)
	else:
		# проверки: автомат, пистолет, патроны, бинты, немного ресурсов (рюкзак — малый: больший только у торговца)
		inv.pack = ULItems.make("pack_small")
		inv.primary = ULItems.make("ak74m")
		inv.pistol = ULItems.make("tt")
		inv.hand = "primary"
		for it in [ULItems.make("a545", 90), ULItems.make("a762x25", 32), ULItems.make("bandage", 5)]:
			inv.add(it)
		inv.wallet = {"spore": 12, "pea": 1}
		hp = HP_MAX
	player.global_position = zone_entry() + Vector3(0, 0.1, 0)
	player.rotation.y = zone_entry_yaw()


## таймер кластера сверху посередине: белый, за 2 минуты — оранжевый, последние 30 с — красный и мигает
func _cs_hud(vs: Vector2, font0: Font) -> void:
	if not temp() or _cs_end <= 0.0:
		return
	var left := cs_left()
	var sec := int(ceil(left))
	var t := "%02d:%02d" % [sec / 60, sec % 60]
	var col := Color(0.96, 0.96, 0.92)
	if left <= float(zone_cfg().get("alarm_s", 30)):
		col = Color(1.0, 0.25, 0.2) if int(Time.get_ticks_msec() / 350) % 2 == 0 else Color(1.0, 0.6, 0.5)
	elif left <= 120.0:
		col = Color(1.0, 0.65, 0.25)
	var fs := 34
	var tw := font0.get_string_size(t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs).x
	var cap := "до перезагрузки кластера"
	var cw := font0.get_string_size(cap, HORIZONTAL_ALIGNMENT_LEFT, -1, 13).x
	var bw := maxf(tw, cw) + 36.0
	_hud.draw_rect(Rect2(vs.x * 0.5 - bw * 0.5, 8, bw, 62), Color(0.04, 0.03, 0.02, 0.62))
	_hud.draw_rect(Rect2(vs.x * 0.5 - bw * 0.5, 8, bw, 62), col * Color(1, 1, 1, 0.7), false, 1.5)
	_hud.draw_string_outline(font0, Vector2(vs.x * 0.5 - tw * 0.5, 44), t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, 6, Color(0, 0, 0, 0.8))
	_hud.draw_string(font0, Vector2(vs.x * 0.5 - tw * 0.5, 44), t, HORIZONTAL_ALIGNMENT_LEFT, -1, fs, col)
	_hud.draw_string(font0, Vector2(vs.x * 0.5 - cw * 0.5, 62), cap, HORIZONTAL_ALIGNMENT_LEFT, -1, 13, Color(0.85, 0.85, 0.8))


## записка после возвращения из временного кластера (почему вернулись и что с вещами)
func _arrival(t: String) -> void:
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	_hud.get_parent().add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_book_ui = shade
	var cc := CenterContainer.new()
	shade.add_child(cc)
	cc.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	var pn := PanelContainer.new()
	pn.custom_minimum_size = Vector2(620, 0)
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	cc.add_child(pn)
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 14)
	pn.add_child(vb)
	var tl := Label.new()
	tl.text = "Кластер перезагрузился" if t.begins_with("Кластер") else (ULSettings.arrival_title if ULSettings.arrival_title != "" else "Опасный коровник")
	tl.add_theme_font_size_override("font_size", 26)
	tl.add_theme_color_override("font_color", Color(1.0, 0.45, 0.35) if not t.begins_with("Вы покинули") else Color(1.0, 0.86, 0.5))
	vb.add_child(tl)
	var l := Label.new()
	l.text = t
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.add_theme_font_size_override("font_size", 18)
	l.add_theme_color_override("font_color", C_TEXT)
	vb.add_child(l)
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	vb.add_child(hb)
	hb.add_child(ULSettings.button("Понятно", func() -> void: shade.queue_free(), 160.0))


# ---------------- полигон ----------------

## Полигон — пустая площадка 10×10 м для проверки оружия и врагов (главное меню → «Полигон»). Тот же герой, то же
## управление и бой, что на локации; в ящиках — всё оружие и патроны, в углу — манекен, враги ставятся кнопкой.
## Ничего не сохраняется: каждый заход — с начала.
const ARENA := 10.0
var arena := false


func _arena_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(ARENA, ARENA)
	mi.mesh = pm
	var sh := Shader.new()
	# сухая земля с разметкой через метр — по ней видны расстояния
	sh.code = """shader_type spatial;
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec3 c = texture(tex, wp.xz * 0.35).rgb * 0.95;
	vec2 g = abs(fract(wp.xz - 0.5) - 0.5) / fwidth(wp.xz);
	float l = 1.0 - min(min(g.x, g.y), 1.0);
	ALBEDO = mix(c, vec3(0.9, 0.86, 0.72), l * 0.3);
	ROUGHNESS = 0.95;
}"""
	var sm := ShaderMaterial.new()
	sm.shader = sh
	sm.set_shader_parameter("tex", load(TEX + "dry_ground_01_c.jpg"))
	mi.material_override = sm
	add_child(mi)
	_plane(Vector2(420, 420), Vector3(0, -0.05, 0), "dry_ground_01", 4.0, Color(0.2, 0.19, 0.17))
	var sb := StaticBody3D.new()
	add_child(sb)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	sb.add_child(cs)
	# борт по краю: за площадку не выйти ни герою, ни врагу
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.3, 0.24, 0.17)
	wood.roughness = 0.9
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var w := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(0.5, 3, ARENA + 1) if s.x != 0.0 else Vector3(ARENA + 1, 3, 0.5)
		w.shape = b
		w.position = s * (ARENA * 0.5 + 0.25) + Vector3.UP * 1.5
		sb.add_child(w)
		var rail := MeshInstance3D.new()
		var rb := BoxMesh.new()
		rb.size = Vector3(0.16, 0.4, ARENA + 0.32) if s.x != 0.0 else Vector3(ARENA + 0.32, 0.4, 0.16)
		rail.mesh = rb
		rail.material_override = wood
		rail.position = s * (ARENA * 0.5 + 0.08) + Vector3.UP * 0.2
		add_child(rail)


## на полигоне: всё оружие и патроны — в двух ящиках у борта, автомат и пистолет — сразу при герое
func _arena_loot() -> void:
	var I := ULItems
	var a := []
	a.resize(CRATE_SLOTS)
	for wid in ["beretta", "machete", "mp5", "fnfal", "svd", "vss", "pkp", "spas12"]:
		ULInventory.put(a, I.make(wid))
	var b := []
	b.resize(CRATE_SLOTS)
	for am in [["a762x25", 60], ["a9x19", 120], ["a545", 90], ["a762x51", 60], ["a762x54", 200], ["a9x39", 40], ["a12", 64], ["medkit", 2]]:
		var left: int = am[1]
		while left > 0:
			var part := mini(left, I.stack(am[0]))
			ULInventory.put(b, I.make(am[0], part))
			left -= part
	_add_crate(Vector3(-4.2, 0, -4.3), 0.0, a)
	_add_crate(Vector3(-2.9, 0, -4.3), 0.0, b)
	inv.pack = I.make("pack_small")
	inv.primary = I.make("ak74m")
	inv.pistol = I.make("tt")
	inv.hand = "primary"
	for it in [I.make("a545", 90), I.make("a762x25", 32), I.make("bandage", 5), I.make("medkit", 2)]:
		inv.add(it)
	hp = HP_MAX
	player.global_position = Vector3(0, 0.1, 2.5)


## поставить врага у борта, подальше от героя (не больше шести сразу)
func arena_enemy(ekind := "infected") -> void:
	_menu_bar.visible = false
	var alive_n := 0
	for e in enemies:
		if e.alive():
			alive_n += 1
	if alive_n >= 6:
		say("На площадке уже шесть врагов")
		return
	var best := Vector3.ZERO
	var bd := -1.0
	for i in 10:
		var c := Vector3(randf_range(-4.2, 4.2), 0, randf_range(-4.2, 4.2))
		if c.distance_to(player.global_position) > bd:
			bd = c.distance_to(player.global_position)
			best = c
	var ae := spawn_enemy(ekind, best)
	if ae.def.has("rock"):
		# полигон 10×10 м: чтобы бросок камня был виден и здесь, Рубер бросает с 4,5 м (в кластерах — с 11 м),
		# а в рывок срывается только ближе
		ae.def = ae.def.duplicate(true)
		ae.def.rock.from = 4.5
		ae.def.charge.from = 4.5


## убрать всех врагов и тела
func clear_enemies() -> void:
	if _open_corpse != null and inv_ui.visible:
		close_inventory()
	_open_corpse = null
	if _target != null and _target.type == "corpse":
		_target = null
	for e in enemies:
		if _glow_node == e:
			_glow_node = null
		_dmg_lb.erase(e)
		targets.erase(e)
		e._rock_abort()                 # начатый бросок камня — отменить (метка и булыжник исчезают)
		e.queue_free()
	enemies.clear()
	_respawn.clear()


## полный запас патронов к оружию в слотах
func arena_ammo() -> void:
	_menu_bar.visible = false
	var got := ""
	for sl in ["primary", "pistol"]:
		var it = inv.get(sl)
		if it != null and ULItems.get_def(String(it.id)).has("ammo"):
			var am := String(ULItems.get_def(String(it.id)).ammo)
			if inv.add(ULItems.make(am, ULItems.stack(am))) == 0:
				got += ("" if got == "" else ", ") + String(ULItems.get_def(am).n).to_lower()
	say("Добавлено: " + got if got != "" else "Нет места или оружия с патронами")


func _in_house(p: Vector3) -> bool:
	return house != null and house.contains(p)


# ---------------- мир ----------------

var sun: DirectionalLight3D
var world_env: Environment


func _env() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	# небо не видно (камера сверху) — фон цвета земли; небо остаётся только как источник рассеянного света
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.4, 0.52, 0.66)
	sm.sky_horizon_color = Color(0.7, 0.72, 0.7)
	sm.ground_horizon_color = Color(0.45, 0.45, 0.4)
	sm.ground_bottom_color = Color(0.22, 0.22, 0.18)
	sky.sky_material = sm
	e.sky = sky
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.22, 0.22, 0.17)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	e.ambient_light_energy = 0.9
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = 1.12
	e.tonemap_white = 6.0
	e.adjustment_enabled = true
	e.adjustment_contrast = 1.06
	e.adjustment_saturation = 1.04
	# лёгкая дымка вдали — сверху видно до ~30 м, край кластера тонет мягко
	e.fog_enabled = true
	e.fog_mode = Environment.FOG_MODE_DEPTH
	e.fog_light_color = Color(0.5, 0.52, 0.47)
	e.fog_density = 1.0
	e.fog_depth_begin = 32.0
	e.fog_depth_end = 110.0
	e.fog_depth_curve = 1.5
	env.environment = e
	world_env = e
	add_child(env)
	sun = DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-56, 38, 0)
	sun.light_energy = 1.05
	sun.light_color = Color(1.0, 0.95, 0.86)
	sun.shadow_enabled = false            # без теней — быстрее; под героем и деревьями — мягкие пятна
	if temp():
		# коровник: пасмурно-приглушённый день — цвета спокойнее, лёгкая дымка ближе к камере, мягкие тени от
		# построек, деревьев и техники (на «Средней» и «Высокой» графике; на «Низкой» — без теней, как на базе)
		# цветокоррекция: прежняя (насыщенность 0,88, рассеянный свет 1,0 против солнца 1,0) давала серую плоскую
		# картинку — свет и тень почти не различались. Теперь солнце сильнее и теплее, рассеянный свет
		# слабее и холоднее: рельеф (карты нормалей досок, камня, грунта) читается, цвета живее, но не кричат
		e.tonemap_exposure = 1.0
		e.adjustment_saturation = 1.0
		e.adjustment_contrast = 1.12
		e.adjustment_brightness = 0.98
		e.ambient_light_energy = 0.78
		e.fog_light_color = Color(0.58, 0.6, 0.57)
		e.fog_density = 0.6
		e.fog_depth_begin = 14.0
		e.fog_depth_end = 80.0
		e.fog_depth_curve = 1.3
		sun.light_energy = 1.22
		sun.light_color = Color(1.0, 0.93, 0.83)
		if ULSettings.gfx >= 1:
			sun.shadow_enabled = true
			# одна карта теней на 34 м (камера видит ~25 м): с двумя каскадами всё, что отбрасывает тень,
			# рисовалось в карту теней дважды
			sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
			sun.directional_shadow_max_distance = 34.0
			sun.shadow_blur = 1.6
			sun.shadow_opacity = 0.78
			sun.shadow_bias = 0.06
			sun.shadow_normal_bias = 1.2
	if indoor():
		# внутренности корпусов (слой 2) солнце не освещает: там ровный рассеянный свет из окон (свой слабый
		# «верхний» свет без теней) и лампы рядом с героем; тени — дальше, корпуса выше
		sun.light_cull_mask = 0xFFFFF & ~2
		# одна карта теней на 32 м (две — каждый корпус и дерево рисуются в тени дважды)
		sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
		sun.directional_shadow_max_distance = 32.0
		e.ambient_light_energy = 1.05
		# внутри: свет «из окон» под углом (не сверху) — пол, доски и мебель получают рельеф, а не ровную заливку
		var fill := DirectionalLight3D.new()
		fill.rotation_degrees = Vector3(-52, -35, 0)
		fill.light_energy = 0.85
		fill.light_color = Color(0.86, 0.9, 0.95)
		fill.light_cull_mask = 2
		fill.shadow_enabled = false
		add_child(fill)
	_shadow_pref = sun.shadow_enabled
	add_child(sun)


func _plane(size: Vector2, at: Vector3, tex: String, uv: float, tint := Color.WHITE) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = size
	mi.mesh = pm
	var m := ULHouse._mat(TEX + tex, uv)
	m.albedo_color = tint
	mi.material_override = m
	mi.position = at
	add_child(mi)
	return mi


const GROUND_SHADER := """shader_type spatial;
// Земля (база и коровник): пять слоёв — зелёная трава, сухие проплешины, лесная подстилка под деревьями, голая
// земля (у коровника — грязь), тропа с камешками. Где что — карта mask (R — трава, G — тропа, B — подстилка,
// A — затенение у стен), посчитанная заранее. Слои смешиваются «по высоте»: на границе светлые бугорки одного слоя
// торчат сквозь другой (трава пучками поверх земли, камни тропы сквозь траву) — край живой, не размытый.
// Против повторов: трава читается в двух масштабах, крупные пятна шума меняют сухость и светлоту.
// Анизотропная фильтрация — только на «Высокой» (ground_material): камера смотрит под 52°, выигрыш в
// резкости мал, а цена — лишние выборки на каждом пикселе земли; резкость дешевле получить разрешением.
uniform sampler2D grass : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D grass2 : source_color, filter_linear_mipmap, repeat_enable;      // вторая трава: зелёные куртины
uniform sampler2D grass_n : hint_normal, filter_linear_mipmap, repeat_enable;      // рельеф стеблей
uniform sampler2D dry : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D forest : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D soil : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D soil_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D path : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D path_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform sampler2D mask : filter_linear, repeat_disable;
uniform float world_size = 100.0;
uniform vec3 soil_tint = vec3(1.0);
uniform float wet = 0.0;              // голая земля местами блестит, как сырая грязь (коровник)
uniform float dry_amount = 0.6;       // сколько сухих проплешин в траве
uniform vec3 grass_mul = vec3(0.9, 1.08, 0.76);   // оттенок травы (коровник — оливковее)
uniform vec3 path_mul = vec3(1.12, 1.08, 1.04);   // светлота дороги (коровник — темнее, сырая земля)
uniform vec4 cut_rect = vec4(0.0);    // вырез (x0, z0, x1, z1): над погребом, где герой (хутор)
uniform float cut_on = 0.0;
uniform float sharp = 0.72;
uniform float path_scale = 2.8;      // сторона плитки текстуры тропы, м
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
// две выборки одной текстуры (против повторов) — «по высоте»: в каждой точке берётся та, что светлее (с перевесом t
// у второй), переход узкий. Простое смешивание двух «шумных» фото вдвое гасило контраст — камни и стебли сливались
// в ровное размытое пятно.
vec3 hmix(vec3 a, vec3 b, float t) {
	float ha = lum(a) + (1.0 - t) * 0.5;
	float hb = lum(b) + t * 0.5;
	float top = max(ha, hb) - 0.06;
	float wa = max(ha - top, 0.0);
	float wb = max(hb - top, 0.0);
	return (a * wa + b * wb) / max(wa + wb, 0.0001);
}
void fragment() {
	vec2 p = wp.xz;
#ifdef CUT
	// вырез есть только у хутора (над погребом); в остальных картах без discard — видеочип отбрасывает скрытые
	// точки земли (под полом построек) по глубине ещё до шейдера
	if (cut_on > 0.5 && p.x > cut_rect.x && p.x < cut_rect.z && p.y > cut_rect.y && p.y < cut_rect.w) {
		discard;
	}
#endif
	mat2 rot = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8));
	// производные координат — до ветвлений (внутри них выборки идут с явным мип-уровнем, без мерцания на границах)
	// sharp < 1 — чуть более детальный мип-уровень (камни и стебли не расплываются в ровное пятно сверху)
	vec2 dx = dFdx(p) * sharp;
	vec2 dy = dFdy(p) * sharp;
	vec2 rdx = rot * dx;
	vec2 rdy = rot * dy;
	float n1 = texture(noise, p / 70.0).r;
	float n2 = texture(noise, p / 19.0 + vec2(0.37, 0.11)).r;
	float n3 = texture(noise, p / 5.5 + vec2(0.71, 0.53)).r;
	vec4 m = texture(mask, (p + vec2(n3 - 0.5, 0.5 - n3) * 1.4) / world_size + 0.5);
	float wg = m.r;
	float wt = m.g;
	float wf = m.b * (1.0 - wt);
	float ws = max(1.0 - wg - wf - wt, 0.0);
	// слой, чей вес меньше главного больше чем на 0,45, в смешивании «по высоте» не проступает никогда (светлота
	// текстуры добавляет не больше ~0,2, полоса перехода — 0,22): его текстуры не читаем вовсе
	float lw = max(max(max(wg, wf), max(ws, wt)) - 0.45, 0.002);
	float tb = smoothstep(0.32, 0.68, n2);
	// Слой читается только там, где он есть (вес > 0): раньше на каждом пикселе считались все пять слоёв —
	// около двадцати выборок текстур; теперь на чистой траве или чистой дороге — вдвое-втрое меньше
	vec3 g = vec3(0.3);
	if (wg > lw) {
		g = hmix(textureGrad(grass, p / 3.4, dx / 3.4, dy / 3.4).rgb, textureGrad(grass, rot * p / 9.0 + 0.31, rdx / 9.0, rdy / 9.0).rgb, 0.3 + tb * 0.3);
		// куртины гуще и зеленее — вторая фототекстура пятнами
		float gk = smoothstep(0.34, 0.62, textureGrad(noise, p / 13.0 + vec2(0.13, 0.77), dx / 13.0, dy / 13.0).r) * 0.75;
		if (gk > 0.01) {
			g = mix(g, textureGrad(grass2, rot * p / 6.2 + 0.47, rdx / 6.2, rdy / 6.2).rgb * vec3(0.92, 1.08, 0.86), gk);
		}
		g *= grass_mul;
		// кочки: пятнистое затенение травы — трава читается объёмной без отдельных пучков
		float tuft = textureGrad(noise, p / 1.6 + vec2(0.41, 0.19), dx / 1.6, dy / 1.6).r;
		g *= mix(0.86, 1.07, smoothstep(0.2, 0.8, tuft));
		float dw = smoothstep(0.5, 0.74, n1 * 0.7 + n2 * 0.3) * dry_amount;
		if (dw > 0.01) {
			vec3 dr = hmix(textureGrad(dry, p / 4.2, dx / 4.2, dy / 4.2).rgb, textureGrad(dry, rot * p / 5.3 + 0.17, rdx / 5.3, rdy / 5.3).rgb, tb);
			g = mix(g, dr * vec3(0.92, 0.9, 0.76), dw);
		}
	}
	vec3 f = vec3(0.3);
	if (wf > lw) { f = textureGrad(forest, rot * p / 3.2, rdx / 3.2, rdy / 3.2).rgb * vec3(1.08, 1.04, 0.98); }
	vec3 so = vec3(0.3);
	if (ws > lw) { so = hmix(textureGrad(soil, p / 3.6, dx / 3.6, dy / 3.6).rgb, textureGrad(soil, rot * p / 4.7 + 0.43, rdx / 4.7, rdy / 4.7).rgb, tb) * soil_tint; }
	vec3 pa = vec3(0.3);
	if (wt > lw) { float ps = path_scale;
		float ps2 = path_scale * 1.25;
		pa = hmix(textureGrad(path, p / ps, dx / ps, dy / ps).rgb, textureGrad(path, rot * p / ps2 + 0.29, rdx / ps2, rdy / ps2).rgb, tb * 0.8) * path_mul; }
	// смешивание по высоте: «высота» слоя — светлота его текстуры
	vec4 a = vec4(wg + lum(g) * 0.42, wf + lum(f) * 0.42, ws + lum(so) * 0.34, wt + lum(pa) * 0.46);
	a *= step(vec4(lw), vec4(wg, wf, ws, wt));
	float top = max(max(a.x, a.y), max(a.z, a.w)) - 0.22;
	vec4 b = max(a - vec4(top), vec4(0.0));
	b /= max(b.x + b.y + b.z + b.w, 0.0001);
	vec3 c = g * b.x + f * b.y + so * b.z + pa * b.w;
	float bright = mix(0.88, 1.07, n1) * mix(0.95, 1.04, n2);
	ALBEDO = c * bright * m.a * 0.92;
	vec3 nm = vec3(0.5, 0.5, 1.0) * b.y * 0.5;
	if (b.z + b.y > 0.01) { nm += textureGrad(soil_n, p / 3.6, dx / 3.6, dy / 3.6).rgb * (b.z + b.y * 0.5); }
	if (b.w > 0.01) { nm += textureGrad(path_n, p / path_scale, dx / path_scale, dy / path_scale).rgb * b.w; }
	if (b.x > 0.01) { nm += textureGrad(grass_n, p / 3.4, dx / 3.4, dy / 3.4).rgb * b.x; }
	NORMAL_MAP = nm;
	NORMAL_MAP_DEPTH = 1.1;
	float puddle = b.z * wet * smoothstep(0.55, 0.72, n3 * 0.6 + n2 * 0.4);
	ROUGHNESS = mix(0.95, 0.42, puddle);
	SPECULAR = mix(0.3, 0.6, puddle);
}
"""


## Растительность — та же, что в коровнике (ULVegetation: спрайты с моделей растений Poly Haven): злаки по траве
## карты земли (во дворе реже, у крыльца и на тропе — нет), цвет от зелёного до выгоревшего крупными пятнами;
## сорняки вдоль стен дома; одуванчики и цветущий щавель — редкими куртинами в траве.
func _vegetation() -> void:
	var q := float(ULSettings.q().grass)
	var rng_m := float(ULSettings.q().range)
	ULVegetation.scatter(self, "grass", SIZE, 1.3 * q + 0.15, func(p: Vector3) -> float:
		var hp := p - HOUSE_AT
		if absf(hp.x) < ULHouse.W * 0.5 + 1.0 and absf(hp.z) < ULHouse.D * 0.5 + 1.0:
			return 0.0
		if p.distance_to(HOUSE_AT + Vector3(0, 0, ULHouse.D * 0.5 + 2.2)) < 3.5 or _trail_dist(p) < 1.5:
			return 0.0
		var m := mask_at(p)
		return clampf(m.r * 1.2 - m.g * 0.9 - 0.1, 0.0, 1.0) * (0.45 if _in_yard(p) else 1.0), func(p: Vector3, r: RandomNumberGenerator) -> Color:
		var dry := smoothstep(0.5, 0.75, _noise(Vector2(p.x, p.z) / 70.0) * 0.6 + _noise(Vector2(p.x, p.z) / 19.0 + Vector2(0.37, 0.11)) * 0.4)
		return ULVegetation.grass_tint(dry, r) * Color(0.86, 0.9, 0.82), Vector2(0.25, 0.6), 1.4, 909, rng_m)
	ULVegetation.scatter(self, "weed", SIZE, 0.6 * q + 0.05, func(p: Vector3) -> float:
		var hp := (p - HOUSE_AT).abs() - Vector3(ULHouse.W * 0.5, 0, ULHouse.D * 0.5)
		var d := Vector2(maxf(hp.x, 0.0), maxf(hp.z, 0.0)).length()
		if hp.x < 0.0 and hp.z < 0.0 or p.distance_to(HOUSE_AT + Vector3(0, 0, ULHouse.D * 0.5 + 2.2)) < 3.0:
			return 0.0
		return (1.0 - smoothstep(0.3, 2.5, d)) * 0.8, func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.86, 0.9, 0.76) * r.randf_range(0.82, 1.05), Vector2(0.35, 0.6), 1.2, 910, rng_m)
	ULVegetation.scatter(self, "flower", SIZE, 0.06 * q + 0.01, func(p: Vector3) -> float:
		if _in_yard(p) or (p - HOUSE_AT).length() < 9.0:
			return 0.0
		var m := mask_at(p)
		return m.r * smoothstep(0.55, 0.7, _noise(Vector2(p.x, p.z) / 11.0 + Vector2(0.2, 0.6))), func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.95, 0.95, 0.9) * r.randf_range(0.85, 1.05), Vector2(0.3, 0.5), 1.3, 911, rng_m)


## тропа: отрезки [начало, конец] в плоскости (x, z) — от крыльца к калитке и дальше через кластер
const TRAIL := [
	[Vector2(0, -6.0), Vector2(0, -2.0)], [Vector2(0, -2.0), Vector2(0.6, 6.0)], [Vector2(0.6, 6.0), Vector2(-2.5, 17.0)],
	[Vector2(-2.5, 17.0), Vector2(-0.5, 31.0)], [Vector2(-0.5, 31.0), Vector2(3.0, 50.0)],
	[Vector2(0.6, 6.0), Vector2(15.0, 9.5)], [Vector2(15.0, 9.5), Vector2(31.0, 6.0)], [Vector2(31.0, 6.0), Vector2(50.0, 11.0)],
]
var _noise_img: Image
var _noise_tex: ImageTexture


func _trail_dist(p: Vector3) -> float:
	var q := Vector2(p.x, p.z)
	var d := 1000.0
	for sg in TRAIL:
		var a: Vector2 = sg[0]
		var ab: Vector2 = sg[1] - a
		var h := clampf((q - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
		d = minf(d, q.distance_to(a + ab * h))
	return d


func _noise(uv: Vector2) -> float:
	var x := fposmod(uv.x, 1.0) * 256.0
	var y := fposmod(uv.y, 1.0) * 256.0
	return _noise_img.get_pixel(int(x) % 256, int(y) % 256).r


const FOG_SHADER := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled;
// Туман за краем кластера: начинается у самой границы поля и густеет наружу; клубится (два слоя шума плывут
// в разные стороны). Слоёв несколько, на разной высоте — герой, выходя за край, входит в туман.
uniform sampler2D noise : filter_linear, repeat_enable;
uniform vec3 tint : source_color = vec3(0.62, 0.68, 0.6);
uniform float dens = 0.36;
uniform float drift = 1.0;
uniform float half = 50.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 p = wp.xz;
	float d = max(abs(p.x), abs(p.y)) - half;
	float n = texture(noise, p / 38.0 + TIME * vec2(0.006, 0.004) * drift).r * 0.6 + texture(noise, p / 13.0 - TIME * vec2(0.011, 0.007) * drift).r * 0.4;
	ALBEDO = tint * (0.86 + 0.28 * n);
	ALPHA = smoothstep(-5.0, 8.0, d + (n - 0.5) * 9.0) * dens;
}
"""


## Туман за границей поля — как на краю кластера: рамка шириной 30 м вокруг поля 100×100, три слоя на разной
## высоте (на «Низкой» графике — два). Внутри поля тумана нет.
func _edge_fog() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var a := size_m * 0.5 - 10.0
	var b := size_m * 0.5 + 30.0
	# рамка из четырёх полос
	for r in [[-b, -b, b, -a], [-b, a, b, b], [-b, -a, -a, a], [a, -a, b, a]]:
		var v := [Vector3(r[0], 0, r[1]), Vector3(r[2], 0, r[1]), Vector3(r[2], 0, r[3]), Vector3(r[0], 0, r[3])]
		for k in [0, 1, 2, 0, 2, 3]:
			st.add_vertex(v[k])
	var mesh := st.commit()
	var sh := Shader.new()
	sh.code = FOG_SHADER
	var layers := [[0.3, 0.34, 1.0], [1.15, 0.3, -0.8], [2.1, 0.3, 0.6]]
	if ULSettings.gfx == 0:
		layers = [[0.3, 0.4, 1.0], [1.6, 0.36, -0.8]]
	for l in layers:
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("noise", _noise_tex)
		m.set_shader_parameter("dens", l[1])
		m.set_shader_parameter("drift", l[2])
		m.set_shader_parameter("half", size_m * 0.5)
		var fi := MeshInstance3D.new()
		fi.mesh = mesh
		fi.material_override = m
		fi.position.y = l[0]
		fi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(fi)


const GROUND_MASK := "res://assets/world/tex/ground_mask.png"


## Карта земли 256×256 на весь кластер — где трава, где галька и тропа, светлота, затенение у стен дома.
## Считается один раз (инструментом: --as-test=bake) и лежит в проекте.
func _bake_mask() -> Image:
	var n := 384
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var worn_c := Vector2(HOUSE_AT.x, HOUSE_AT.z + ULHouse.D * 0.5 + 2.2)
	var worn_r := 4.2
	var house_c := Vector2(HOUSE_AT.x, HOUSE_AT.z)
	var house_half := Vector2(ULHouse.W * 0.5, ULHouse.D * 0.5)
	var y0 := Vector2(HOUSE_AT.x + YARD[0], HOUSE_AT.z + YARD[1])
	var y1 := Vector2(HOUSE_AT.x + YARD[2], HOUSE_AT.z + YARD[3])
	for iy in n:
		for ix in n:
			var p := Vector2((ix + 0.5) / n - 0.5, (iy + 0.5) / n - 0.5) * SIZE
			var n1 := _noise(p / 70.0)
			var n2 := _noise(p / 19.0 + Vector2(0.37, 0.11))
			var n3 := _noise(p / 5.5 + Vector2(0.71, 0.53))
			var trail := 1.0 - smoothstep(0.5, 1.9, _trail_dist(Vector3(p.x, 0, p.y)))
			var porch := 1.0 - smoothstep(worn_r * 0.35, worn_r, p.distance_to(worn_c))
			var q := (p - house_c).abs() - house_half
			var lq := Vector2(maxf(q.x, 0.0), maxf(q.y, 0.0)).length()
			var ring := 1.0 - smoothstep(0.2, 1.4, lq)
			var bare := maxf(trail, maxf(porch, ring * 0.8))
			var gw := smoothstep(0.26, 0.5, n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * 0.82 + 0.18
			var yq := Vector2(maxf(maxf(y0.x - p.x, p.x - y1.x), 0.0), maxf(maxf(y0.y - p.y, p.y - y1.y), 0.0))
			var in_yard := 1.0 - smoothstep(0.0, 1.2, yq.length())
			gw *= (1.0 - in_yard * 0.45) * (1.0 - bare)
			var peb := maxf(trail, smoothstep(0.6, 0.72, n2 * 0.5 + n3 * 0.5) * 0.35) * (1.0 - in_yard * 0.5)
			var fw := forest_w(p, _tree_pts, n2 * 1.5) * (1.0 - trail)
			gw *= 1.0 - fw * 0.9
			var ao := 1.0 - (1.0 - smoothstep(0.0, 0.9, lq)) * 0.45 * (1.0 if lq > 0.001 else 0.0)
			im.set_pixel(ix, iy, Color(gw, peb, fw, ao))
	return im


var _ground_mat: ShaderMaterial
var _mask_img: Image
var _tree_pts: Array = []         ## [точка, радиус кроны] — под деревьями лесная подстилка (карта земли, канал B)


## Материал земли (GROUND_SHADER) — общий для базы и коровника: трава sparse_grass, сухие проплешины grass_ground,
## подстилка mud_forest, тропа stony_dirt_path (Poly Haven, CC0); голая земля — своя для каждой локации.
func ground_material(size: float, soil: String, soil_n: String, soil_tint: Vector3, wet: float, dry: float, path := "stony_dirt_path", path_n := "stony_dirt_path", cuttable := false) -> ShaderMaterial:
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	var code: String = GROUND_SHADER if ULSettings.gfx < 2 else GROUND_SHADER.replace("filter_linear_mipmap,", "filter_linear_mipmap_anisotropic,")
	if cuttable:
		code = code.replace("shader_type spatial;\n", "shader_type spatial;\n#define CUT\n")
	sh.code = code
	sm.shader = sh
	# земля — после построек, людей и предметов: там, где её закрывает пол или стена, точка отбрасывается по
	# глубине до шейдера (иначе дорогая земля считалась бы и под полом каждого дома)
	sm.render_priority = 1
	sm.set_shader_parameter("grass", load(TEX + "sparse_grass_c.jpg"))
	sm.set_shader_parameter("grass2", load(TEX + "aerial_grass_c.jpg"))
	sm.set_shader_parameter("grass_n", load(TEX + "sparse_grass_n.jpg"))
	sm.set_shader_parameter("dry", load(TEX + "withered_grass_c.jpg"))
	sm.set_shader_parameter("forest", load(TEX + "mud_forest_c.jpg"))
	sm.set_shader_parameter("soil", load(TEX + soil + "_c.jpg"))
	sm.set_shader_parameter("soil_n", load(TEX + soil_n + "_n.jpg"))
	sm.set_shader_parameter("path", load(TEX + path + "_c.jpg"))
	sm.set_shader_parameter("path_n", load(TEX + path_n + "_n.jpg"))
	sm.set_shader_parameter("world_size", size)
	sm.set_shader_parameter("soil_tint", soil_tint)
	sm.set_shader_parameter("wet", wet)
	sm.set_shader_parameter("dry_amount", dry)
	return sm


## доля лесной подстилки в точке по деревьям (под кроной и чуть дальше — листья, хвоя, ростки)
static func forest_w(q: Vector2, pts: Array, wobble: float) -> float:
	var f := 0.0
	for t in pts:
		var c: Vector3 = t[0]
		var r: float = t[1]
		var dx := absf(q.x - c.x)
		var dz := absf(q.y - c.z)
		if dx > r * 2.0 + 2.0 or dz > r * 2.0 + 2.0:
			continue
		var d := Vector2(dx, dz).length()
		f = maxf(f, 1.0 - smoothstep(r * 0.55, r * 1.5 + wobble, d))
	return f


## точка карты земли (R — трава, G — тропа, B — подстилка, A — затенение)
func mask_at(p: Vector3) -> Color:
	if _mask_img == null:
		return Color(1, 0, 0, 1)
	var w := _mask_img.get_width()
	var h := _mask_img.get_height()
	return _mask_img.get_pixel(clampi(int((p.x / SIZE + 0.5) * w), 0, w - 1), clampi(int((p.z / SIZE + 0.5) * h), 0, h - 1))


func _ground() -> void:
	# внутри кластера — своя земля, по краю — гравий, снаружи — другой грунт (кластер «вырезан» из своего мира)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(SIZE, SIZE)
	mi.mesh = pm
	var sm := ground_material(SIZE, "grass_path_2", "brown_mud_02", Vector3(0.84, 0.77, 0.66), 0.0, 0.55)
	# трава спокойнее (оливковая, не ядовито-зелёная), тропа — не выбеленная
	sm.set_shader_parameter("grass_mul", Vector3(0.86, 0.97, 0.7))
	sm.set_shader_parameter("path_mul", Vector3(0.95, 0.9, 0.84))
	_ground_mat = sm
	# шум — картинкой: тот же рисунок читается и в шейдере, и здесь (где трава — там пучки)
	var fn := FastNoiseLite.new()
	fn.seed = 7
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_img.generate_mipmaps()
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	sm.set_shader_parameter("noise", _noise_tex)
	# карта земли: готовая из проекта; нет её (после правки расстановки) — считается и сохраняется
	if ResourceLoader.exists(GROUND_MASK) and test != "bake":
		_mask_img = (load(GROUND_MASK) as Texture2D).get_image()
		if _mask_img.is_compressed():
			_mask_img.decompress()
		sm.set_shader_parameter("mask", load(GROUND_MASK))
	else:
		_mask_img = _bake_mask()
		sm.set_shader_parameter("mask", ImageTexture.create_from_image(_mask_img))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # земля сама ни на что тень не бросает: в карту теней не рисуется
	add_child(mi)
	_edge_fog()
	_vegetation()
	# подложки под полем (гравийная кромка и земля за краем) рисуются после земли поля: под ней они отбрасываются
	# по глубине и не считаются (раньше их трипланарная закраска шла на каждой точке экрана впустую)
	for pl in [_plane(Vector2(SIZE + 3.0, SIZE + 3.0), Vector3(0, -0.02, 0), "rocky_gravel", 1.5, Color(0.5, 0.48, 0.44)),
			_plane(Vector2(420, 420), Vector3(0, -0.05, 0), "dry_ground_01", 4.0, Color(0.5, 0.47, 0.42))]:
		var pm: StandardMaterial3D = (pl as MeshInstance3D).material_override
		pm.render_priority = 2
		(pl as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	var sb := StaticBody3D.new()
	add_child(sb)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	sb.add_child(cs)
	# граница кластера: дальше не пройти (для проверки)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var w := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, SIZE + 2) if s.x != 0.0 else Vector3(SIZE + 2, 4, 1)
		w.shape = b
		w.position = s * (SIZE * 0.5 + 9.0) + Vector3.UP * 2.0      # за край поля можно выйти — там отсчёт до карты мира
		sb.add_child(w)


## Дом из Tripo — по нашим стенам. Замер модели (сечение на высоте стен): стены x −0.352…+0.340 (фасад с дверью
## и крыльцом — на +x), z −0.437…+0.431, свес крыши от высоты 0.33. Поворот −90°: фасад модели (+x) → фасад дома
## (+z). Масштаб по осям модели: глубина 10 м / 0.692, длина 12 м / 0.868; по высоте — стены 3.3 м (дверь ~2 м,
## при одинаковом масштабе модель была бы с 4.6-метровыми стенами).
const SHELL_FIT := {"scale": [14.45, 10.0, 13.82], "yaw": -90.0, "center": [-0.006, 0.0, -0.003]}


func _fit_shell() -> void:
	if house.shell == null:
		return
	var sh := house.shell
	var f: Dictionary = SHELL_FIT
	var S := Vector3(f.scale[0], f.scale[1], f.scale[2])
	sh.rotation.y = deg_to_rad(float(f.yaw))
	sh.scale = S
	var c := Vector3(f.center[0], f.center[1], f.center[2])
	var off := Basis(Vector3.UP, deg_to_rad(float(f.yaw))) * (c * S)
	sh.position = Vector3(-off.x, 0.0, -off.z)
	# раскраска модели Tripo вблизи размыта: поверх неё — чёткие фототекстуры по месту (кровля, стены, крыльцо)
	var code := Shader.new()
	code.code = SHELL_SHADER if ULSettings.gfx == 2 else SHELL_SHADER.replace("filter_linear_mipmap_anisotropic", "filter_linear_mipmap")
	for mi in sh.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si) as StandardMaterial3D
			if src == null:
				continue
			var mt := ShaderMaterial.new()
			mt.shader = code
			mt.set_shader_parameter("base", src.albedo_texture)
			mt.set_shader_parameter("base_lum", _tex_lum(src.albedo_texture))
			mt.set_shader_parameter("wall", load(TEX + "weathered_plank_siding_c.jpg"))
			mt.set_shader_parameter("wall_n", load(TEX + "weathered_plank_siding_n.jpg"))
			mt.set_shader_parameter("roof", load(TEX + "worn_corrugated_iron_c.jpg"))
			mt.set_shader_parameter("roof_n", load(TEX + "worn_corrugated_iron_n.jpg"))
			m.set_surface_override_material(si, mt)


const SHELL_SHADER := """shader_type spatial;
// Дом (модель Tripo): её собственная раскраска вблизи размыта, поэтому цвет берётся из чётких фототекстур
// по месту — кровля (шифер, волна вдоль ската), стены (доска-обшивка, доски горизонтально), крыльцо (доски).
// Раскраска модели задаёт только светлоту: окна, двери, наличники и тени под свесом остаются на местах.
uniform sampler2D base : source_color, filter_linear_mipmap;
uniform sampler2D wall : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D wall_n : filter_linear_mipmap, repeat_enable;
uniform sampler2D roof : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D roof_n : filter_linear_mipmap, repeat_enable;
uniform float base_lum = 0.12;
varying vec3 wp;
varying vec3 wn;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	vec3 b = texture(base, UV).rgb;
	float k = clamp(dot(b, vec3(0.3, 0.59, 0.11)) / base_lum, 0.25, 1.25);
	vec3 col;
	float relief;
	if (wn.y > 0.3 && wp.y > 1.7) {
		vec2 u = wp.xz / 2.2;
		col = texture(roof, u).rgb * 0.6 * mix(1.0, k, 0.4);
		relief = texture(roof_n, u).r - 0.5;
	} else if (wn.y > 0.5) {
		vec2 u = wp.zx / 1.6;
		col = texture(wall, u).rgb * 0.78 * mix(1.0, k, 0.7);
		relief = texture(wall_n, u).g - 0.5;
	} else {
		vec2 u = (abs(wn.x) > abs(wn.z) ? vec2(wp.z, wp.y) : vec2(wp.x, wp.y)) / 1.8;
		col = texture(wall, u).rgb * 1.02 * mix(1.0, k, 0.9);
		relief = texture(wall_n, u).g - 0.5;
	}
	ALBEDO = col * (1.0 + relief * 0.6);
	ROUGHNESS = 0.9;
	SPECULAR = 0.1;
}
"""


## средняя светлота текстуры (линейная); если картинку не прочитать (сжатая на телефоне) — типичное значение
func _tex_lum(t: Texture2D) -> float:
	if t == null:
		return 0.12
	var im := t.get_image()
	if im == null:
		return 0.12
	if im.is_compressed() and im.decompress() != OK:
		return 0.12
	im.resize(32, 32, Image.INTERPOLATE_BILINEAR)
	# пустые (чёрные) поля развёртки не считаются
	var s := 0.0
	var n := 0
	for y in 32:
		for x in 32:
			var c := im.get_pixel(x, y).srgb_to_linear()
			var l := c.r * 0.3 + c.g * 0.59 + c.b * 0.11
			if l > 0.004:
				s += l
				n += 1
	return clampf(s / maxf(n, 1.0), 0.03, 0.6)


## Замер: из чего складываются треугольники в кадре (полная сетка, без учёта упрощённых копий): видимые сетки
## в поле зрения камеры и в пределах их дальности показа, по группам (имя сетки или модели). Только для проверок.
func _tris_breakdown(tag: String) -> void:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return
	var by := {}
	for n in get_tree().root.find_children("*", "GeometryInstance3D", true, false):
		var gi := n as GeometryInstance3D
		if not gi.is_visible_in_tree():
			continue
		var mesh: Mesh = null
		var mult := 1
		if gi is MeshInstance3D:
			mesh = (gi as MeshInstance3D).mesh
		elif gi is MultiMeshInstance3D and (gi as MultiMeshInstance3D).multimesh != null:
			var mm := (gi as MultiMeshInstance3D).multimesh
			mesh = mm.mesh
			mult = mm.visible_instance_count if mm.visible_instance_count >= 0 else mm.instance_count
		if mesh == null:
			continue
		var bb := gi.global_transform * gi.get_aabb()
		if gi is MeshInstance3D:
			if not cam.is_position_in_frustum(bb.get_center()) and not cam.is_position_in_frustum(bb.position) and not cam.is_position_in_frustum(bb.end):
				continue
			if gi.visibility_range_end > 0.0 and cam.global_position.distance_to(bb.get_center()) > gi.visibility_range_end:
				continue
		var t := 0
		for si in mesh.get_surface_count():
			var arr := mesh.surface_get_arrays(si)
			var idx = arr[Mesh.ARRAY_INDEX]
			t += (idx.size() / 3) if idx != null and idx.size() > 0 else ((arr[Mesh.ARRAY_VERTEX] as PackedVector3Array).size() / 3)
		var key := mesh.resource_path.get_file() if mesh.resource_path != "" else String(gi.name)
		var p := gi.get_parent()
		while p != null and (key.begins_with("@") or key == "" or key.is_valid_int()):
			key = String(p.name)
			p = p.get_parent()
		if gi.get_parent() != null and String(gi.get_parent().name).begins_with("b") and String(gi.get_parent().name).contains("/"):
			key = "здание:" + String(gi.get_parent().name).get_slice("/", 1).left(2)
		elif gi.owner != null and gi.owner != gi:
			key = "модель:" + String(gi.owner.scene_file_path.get_file() if gi.owner.scene_file_path != "" else gi.owner.name)
		by[key] = int(by.get(key, 0)) + t * mult
	var keys := by.keys()
	keys.sort_custom(func(a, b): return int(by[a]) > int(by[b]))
	var line := ""
	for k in keys.slice(0, 22):
		line += "%s %d; " % [k, by[k]]
	print("[tris] %s: %s" % [tag, line])


func _aabb(n: Node3D) -> AABB:
	var bb := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := n.transform * _rel(m, n)
		var a := xf * m.get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	return bb


func _rel(m: Node3D, root: Node3D) -> Transform3D:
	var xf := Transform3D.IDENTITY
	var cur: Node = m
	while cur != null and cur != root:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


## Двор: забор-штакетник на столбах с калиткой спереди, поленница у левой стены дома, колода для колки дров,
## камни. Всё — своя геометрия с текстурами досок и коры; у забора и поленницы есть столкновения.
## База: дизельный генератор у западной стены дома, оружейная стойка у восточной, бочка для дождевой воды на
## углу у крыльца — модели Tripo, со столкновением и пятном-тенью.
func _base_props() -> void:
	var body := StaticBody3D.new()
	body.name = "BaseProps"
	add_child(body)
	var hw := ULHouse.W * 0.5
	var hd := ULHouse.D * 0.5
	var items := [
		["hm_generator", HOUSE_AT + Vector3(-hw - 1.3, 0, -1.0), PI * 0.5, 1.6, false],
		["hm_rack", HOUSE_AT + Vector3(hw + 0.55, 0, 1.2), PI, 1.2, false],
		["hm_raintank", HOUSE_AT + Vector3(hw - 0.5, 0, hd + 0.6), 0.0, 1.1, true],
	]
	for it in items:
		var path := MODELS + String(it[0]) + ".glb"
		if not ResourceLoader.exists(path):
			continue
		var n: Node3D = (load(path) as PackedScene).instantiate()
		add_child(n)
		var bb0 := _aabb(n)
		var k := float(it[3]) / maxf(bb0.size.y if bool(it[4]) else maxf(bb0.size.x, bb0.size.z), 0.01)
		n.scale = Vector3.ONE * k
		n.rotation.y = float(it[2])
		n.position = (it[1] as Vector3) - Vector3(0, bb0.position.y * k, 0)
		for gi in n.find_children("*", "GeometryInstance3D", true, false):
			(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			(gi as GeometryInstance3D).lod_bias = 0.35
		var bb := _aabb(n)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(maxf(bb.size.x * 0.9, 0.3), maxf(bb.size.y, 0.6), maxf(bb.size.z * 0.9, 0.3))
		cs.shape = bs
		cs.position = bb.get_center()
		body.add_child(cs)


func _yard() -> void:
	var planks := ULHouse._mat(TEX + "old_planks_02", 1.25)
	planks.albedo_color = Color(0.92, 0.9, 0.86)
	planks.vertex_color_use_as_albedo = true
	var bark := ULHouse._mat(TEX + "bark_brown_02", 0.8)
	var body := StaticBody3D.new()
	body.name = "Yard"
	add_child(body)
	var x0: float = HOUSE_AT.x + YARD[0]
	var z0: float = HOUSE_AT.z + YARD[1]
	var x1: float = HOUSE_AT.x + YARD[2]
	var z1: float = HOUSE_AT.z + YARD[3]
	var gx := HOUSE_AT.x
	# стороны: [начало, конец]; спереди — две части с калиткой посередине
	var sides := [
		[Vector2(x0, z0), Vector2(x1, z0)], [Vector2(x0, z0), Vector2(x0, z1)], [Vector2(x1, z0), Vector2(x1, z1)],
		[Vector2(x0, z1), Vector2(gx - GATE * 0.5, z1)], [Vector2(gx + GATE * 0.5, z1), Vector2(x1, z1)],
	]
	# сплошной забор из серых досок: доски разной высоты, две жерди, столбы выше досок, по верху — колючая проволока
	var pickets: Array[Transform3D] = []
	var cols: Array[Color] = []
	var posts: Array[Transform3D] = []
	var rails: Array[Transform3D] = []
	var wires: Array[Transform3D] = []
	var barbs: Array[Transform3D] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 33
	for sd in sides:
		var a: Vector2 = sd[0]
		var b: Vector2 = sd[1]
		var L := a.distance_to(b)
		var dir := (b - a) / L
		var yaw := -atan2(dir.y, dir.x)
		var B := Basis(Vector3.UP, yaw)
		var n := int(L / 0.155)
		for i in n:
			var t := (i + 0.5) / n * L
			var p := a + dir * t
			var h := rng.randf_range(1.5, 1.82)
			pickets.append(Transform3D(Basis(Vector3(dir.x, 0, dir.y), rng.randf_range(-0.025, 0.025)) * B * Basis.from_scale(Vector3(rng.randf_range(0.92, 1.04), h, 1)), Vector3(p.x, h * 0.5, p.y)))
			var g := rng.randf_range(0.72, 1.08)
			cols.append(Color(g, g * rng.randf_range(0.96, 1.0), g * rng.randf_range(0.9, 0.98)))
		var np := int(ceil(L / 2.6))
		var tops: Array[Vector3] = []
		for i in np + 1:
			var p := a + dir * (L * i / np)
			posts.append(Transform3D(B * Basis(Vector3(dir.x, 0, dir.y), rng.randf_range(-0.03, 0.03)), Vector3(p.x, 1.1, p.y)))
			tops.append(Vector3(p.x, 0, p.y))
		for y in [0.42, 1.32]:
			var m := (a + b) * 0.5
			rails.append(Transform3D(B * Basis.from_scale(Vector3(L, 1, 1)), Vector3(m.x, y, m.y)))
		# проволока: две нити между столбами, провисает посередине
		for i in np:
			for wy in [1.98, 2.16]:
				var y: float = wy
				var parts := 4
				for k in parts:
					var t0 := float(k) / parts
					var t1 := float(k + 1) / parts
					var p0 := tops[i].lerp(tops[i + 1], t0) + Vector3.UP * (y - 0.07 * sin(t0 * PI))
					var p1 := tops[i].lerp(tops[i + 1], t1) + Vector3.UP * (y - 0.07 * sin(t1 * PI))
					var d := p1 - p0
					var wb := Basis.looking_at(d.normalized(), Vector3.UP) * Basis.from_scale(Vector3(1, 1, d.length()))
					wires.append(Transform3D(wb, (p0 + p1) * 0.5))
					for j in 2:
						var bp := p0.lerp(p1, (j + rng.randf_range(0.2, 0.8)) / 2.0)
						barbs.append(Transform3D(Basis(Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-1, 1)).normalized(), rng.randf() * TAU), bp))
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(L, 1.9, 0.14)
		cs.shape = bs
		cs.transform = Transform3D(B, Vector3((a.x + b.x) * 0.5, 0.95, (a.y + b.y) * 0.5))
		body.add_child(cs)
	_multi(pickets, _box(Vector3(0.145, 1.0, 0.024)), planks, cols)
	var post_mat: StandardMaterial3D = planks.duplicate()
	post_mat.albedo_color = Color(0.5, 0.46, 0.42)
	post_mat.vertex_color_use_as_albedo = false
	_multi(posts, _box(Vector3(0.15, 2.2, 0.15)), post_mat)
	_multi(rails, _box(Vector3(1.0, 0.09, 0.045)), post_mat)
	var wire := StandardMaterial3D.new()
	wire.albedo_color = Color(0.2, 0.19, 0.18)
	wire.metallic = 0.6
	wire.roughness = 0.6
	_multi(wires, _box(Vector3(0.014, 0.014, 1.0)), wire)
	_multi(barbs, _box(Vector3(0.012, 0.07, 0.012)), wire)
	# у забора справа от калитки: бочка и покрышка
	_prop("ph_barrel", Vector3(gx + 4.6, 0, z1 + 0.6), 0.4, 1.0, body, 0.33)
	_prop("ph_barrel", Vector3(x0 + 1.0, 0, z0 + 1.1), 2.1, 1.0, body, 0.33)
	var ty := _prop("ph_tyre", Vector3(gx + 6.4, 0.3, z1 + 0.3), 0.0, 1.05, body, 0.0)
	if ty:
		ty.rotation = Vector3(0.24, 0.25, 0)
	var ty2 := _prop("ph_tyre", Vector3(gx - 5.2, 0.085, z1 + 1.6), 0.0, 1.05, body, 0.0)
	if ty2:
		ty2.rotation = Vector3(PI * 0.5, 0.8, 0)
	# поленница вдоль левой стены дома (снаружи), под свесом крыши
	var logs: Array[Transform3D] = []
	var wx: float = HOUSE_AT.x - ULHouse.W * 0.5 - 1.4             # из-под свеса крыши — видно сверху
	for row in 5:
		for i in 14:
			var z: float = HOUSE_AT.z - 3.2 + i * 0.21 + (0.1 if row % 2 == 1 else 0.0)
			var y := 0.11 + row * 0.19
			logs.append(Transform3D(Basis(Vector3.FORWARD, PI * 0.5) * Basis(Vector3.UP, rng.randf() * TAU), Vector3(wx + rng.randf_range(-0.03, 0.03), y, z)))
	var log_mesh := CylinderMesh.new()
	log_mesh.top_radius = 0.1
	log_mesh.bottom_radius = 0.1
	log_mesh.height = 0.6
	log_mesh.radial_segments = 8
	_multi(logs, log_mesh, bark)
	var lc := CollisionShape3D.new()
	var lb := BoxShape3D.new()
	lb.size = Vector3(0.65, 1.0, 3.1)
	lc.shape = lb
	lc.position = Vector3(wx, 0.5, HOUSE_AT.z - 3.2 + 1.45)
	body.add_child(lc)
	# колода и пара поленьев рядом
	var block := MeshInstance3D.new()
	var bm := CylinderMesh.new()
	bm.top_radius = 0.24
	bm.bottom_radius = 0.27
	bm.height = 0.45
	block.mesh = bm
	block.material_override = bark
	block.position = Vector3(wx - 1.2, 0.225, HOUSE_AT.z + 0.6)
	add_child(block)
	var bc := CollisionShape3D.new()
	var bcs := CylinderShape3D.new()
	bcs.radius = 0.27
	bcs.height = 0.45
	bc.shape = bcs
	bc.position = block.position
	body.add_child(bc)
	var chips: Array[Transform3D] = []
	for i in 5:
		chips.append(Transform3D(Basis(Vector3.FORWARD, PI * 0.5) * Basis(Vector3.RIGHT, rng.randf() * TAU) * Basis(Vector3.UP, rng.randf() * TAU), block.position + Vector3(rng.randf_range(-0.8, 0.8), -0.16, rng.randf_range(-0.8, 0.8))))
	_multi(chips, log_mesh, bark)
	# камни по кластеру
	var rock := _rock_mesh(5)
	var stones: Array[Transform3D] = []
	for i in 70:
		var p := Vector3(rng.randf_range(-SIZE * 0.48, SIZE * 0.48), 0, rng.randf_range(-SIZE * 0.48, SIZE * 0.48))
		var hq := p - HOUSE_AT
		if absf(hq.x) < ULHouse.W * 0.5 + 0.6 and absf(hq.z) < ULHouse.D * 0.5 + 2.5:
			continue                                               # не в доме и не на крыльце
		var s := rng.randf_range(0.08, 0.32)
		stones.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s * rng.randf_range(0.8, 1.4), s * 0.5, s)), p - Vector3.UP * s * 0.12))
	# несколько валунов у тропы
	for i in 26:
		var sgm: Array = TRAIL[rng.randi() % TRAIL.size()]
		var bp2: Vector2 = (sgm[0] as Vector2).lerp(sgm[1], rng.randf())
		var off := Vector2.from_angle(rng.randf() * TAU) * rng.randf_range(2.0, 4.2)
		var p := Vector3(bp2.x + off.x, 0, bp2.y + off.y)
		var hq := p - HOUSE_AT
		if hq.x > YARD[0] - 0.6 and hq.x < YARD[2] + 0.6 and hq.z > YARD[1] - 0.6 and hq.z < YARD[3] + 0.6:
			continue
		var s := rng.randf_range(0.3, 0.62)
		stones.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(s * rng.randf_range(0.8, 1.3), s * 0.6, s)), p - Vector3.UP * s * 0.1))
	# сухие ветки и палки на земле
	var sticks: Array[Transform3D] = []
	for i in 160:
		var p := Vector3(rng.randf_range(-SIZE * 0.48, SIZE * 0.48), 0.03, rng.randf_range(-SIZE * 0.48, SIZE * 0.48))
		var hq := p - HOUSE_AT
		if absf(hq.x) < ULHouse.W * 0.5 + 0.6 and absf(hq.z) < ULHouse.D * 0.5 + 2.5:
			continue
		var ln := rng.randf_range(0.5, 1.6)
		var sb2 := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.FORWARD, PI * 0.5 + rng.randf_range(-0.04, 0.04))
		sticks.append(Transform3D(sb2.scaled(Vector3(1.0, ln, 1.0)), p))
		if rng.randf() < 0.6:
			# сучок вбок
			var q2 := p + sb2 * Vector3(0, ln * rng.randf_range(-0.2, 0.3), 0)
			var sb3 := Basis(Vector3.UP, rng.randf_range(0.4, 0.9) * (1.0 if rng.randf() < 0.5 else -1.0)) * sb2
			sticks.append(Transform3D(sb3.scaled(Vector3(0.7, ln * 0.45, 0.7)), q2 + sb3 * Vector3(0, ln * 0.22, 0)))
	var stick := CylinderMesh.new()
	stick.top_radius = 0.016
	stick.bottom_radius = 0.03
	stick.height = 1.0
	stick.radial_segments = 5
	stick.rings = 0
	var stick_mat: StandardMaterial3D = bark.duplicate()
	stick_mat.albedo_color = Color(0.62, 0.52, 0.42)
	_multi(sticks, stick, stick_mat)
	var rm := StandardMaterial3D.new()
	rm.albedo_texture = load(TEX + "rock_boulder_dry_c.jpg")
	rm.albedo_color = Color(0.52, 0.5, 0.46)          # серо-бурые, не белые: сверху камень не должен светиться
	rm.normal_enabled = true
	rm.normal_texture = load(TEX + "rock_boulder_dry_n.jpg")
	rm.uv1_triplanar = true
	rm.uv1_scale = Vector3.ONE * 0.9
	rm.roughness = 0.9
	_multi(stones, rock, rm)


## предмет обстановки из модели: поставить, при radius > 0 — круглое столкновение
func _prop(model: String, at: Vector3, yaw: float, sc: float, body: StaticBody3D, radius: float) -> Node3D:
	var path := MODELS + model + ".glb"
	if not ResourceLoader.exists(path):
		return null
	var n: Node3D = (load(path) as PackedScene).instantiate()
	n.position = at
	n.rotation.y = yaw
	n.scale = Vector3.ONE * sc
	add_child(n)
	_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * 1.5), Vector3(at.x, 0.03, at.z)))
	if radius > 0.0:
		var cs := CollisionShape3D.new()
		var cy := CylinderShape3D.new()
		cy.radius = radius
		cy.height = 1.0
		cs.shape = cy
		cs.position = Vector3(at.x, 0.5, at.z)
		body.add_child(cs)
	return n


const SPRUCE_SHADER := """shader_type spatial;
render_mode cull_disabled;
// еловые лапы: вырез по альфе, обе стороны освещены одинаково, концы чуть качаются
uniform sampler2D tex : source_color, filter_linear_mipmap;
varying vec3 wn;
varying float fade_v;
void vertex() {
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float w = sin(TIME * 1.1 + wpos.x * 0.4 + wpos.z * 0.3) + 0.5 * sin(TIME * 2.3 + wpos.z * 0.8);
	VERTEX.y += w * 0.035 * (1.0 - UV.y);
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
	fade_v = INSTANCE_CUSTOM.r;          // ель закрывает героя — растворяется точками (ULCanopy)
}
void fragment() {
	vec4 c = texture(tex, UV);
	if (c.a < 0.4) { discard; }
	if (fade_v > 0.001 && fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715)))) < fade_v) { discard; }
	// нормаль — вверх и наружу с обеих сторон лапы (иначе изнанка чёрная)
	NORMAL = normalize((VIEW_MATRIX * vec4(wn, 0.0)).xyz);
	vec3 a = c.rgb * COLOR.rgb;
	ALBEDO = mix(vec3(dot(a, vec3(0.3, 0.59, 0.11))), a, 0.62) * vec3(0.9, 0.88, 0.84);
	ROUGHNESS = 0.9;
	SPECULAR = 0.05;
}
"""


## ель высотой h: ствол и ярусы лап (каждая лапа — полоса из двух звеньев с рисованной текстурой хвои)
func _spruce_mesh(h: float, seed_n: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var mesh := ArrayMesh.new()
	# ствол
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var r0 := 0.018 * h + 0.06
	var sides := 7
	for i in sides:
		var a0 := TAU * i / sides
		var a1 := TAU * (i + 1) / sides
		var b0 := Vector3(cos(a0), 0, sin(a0))
		var b1 := Vector3(cos(a1), 0, sin(a1))
		var v := [b0 * r0, b1 * r0, b1 * 0.02 + Vector3.UP * h * 0.97, b0 * 0.02 + Vector3.UP * h * 0.97]
		var nn := [b0, b1, b1, b0]
		var uv := [Vector2(float(i) / sides, h * 0.5), Vector2(float(i + 1) / sides, h * 0.5), Vector2(float(i + 1) / sides, 0), Vector2(float(i) / sides, 0)]
		for k in [0, 2, 1, 0, 3, 2]:
			st.set_normal(nn[k])
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var bark := StandardMaterial3D.new()
	bark.albedo_texture = load(TEX + "bark_brown_02_c.jpg")
	bark.albedo_color = Color(0.55, 0.48, 0.42)
	bark.roughness = 0.95
	st.set_material(bark)
	st.commit(mesh)
	# лапы
	st = SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tiers := int(h * (1.7 if ULSettings.gfx == 2 else 1.25))
	for ti in tiers:
		var t := float(ti) / (tiers - 1)
		var y := h * (0.13 + 0.8 * t)
		var L := h * 0.3 * pow(1.0 - t, 0.8) + 0.3
		var nb := int(round(lerpf(8.0, 5.0, t)))
		var a_off := rng.randf() * TAU
		var droop := lerpf(-0.5, -0.05, t)
		var shade := lerpf(0.5, 0.86, t)
		for bi in nb:
			var a := a_off + TAU * bi / nb + rng.randf_range(-0.2, 0.2)
			var dir := Vector3(cos(a), 0, sin(a))
			var side := Vector3(-dir.z, 0, dir.x)
			var l2 := L * rng.randf_range(0.82, 1.12)
			var p0 := Vector3(0, y + rng.randf_range(-0.12, 0.12), 0)
			var p1 := p0 + dir * (l2 * 0.45) + Vector3.UP * (l2 * 0.06)
			var p2 := p1 + dir * (l2 * 0.55) + Vector3.UP * (l2 * 0.55 * tan(droop))
			var w := l2 * 0.42
			var nrm := (Vector3.UP * 0.85 + dir * 0.55).normalized()
			var g := shade * rng.randf_range(0.85, 1.12)
			var col := Color(g * 0.8, g * 0.92, g * 0.86)
			var v := [p0 - side * w * 0.3, p0 + side * w * 0.3, p1 - side * w, p1 + side * w, p2 - side * w * 0.9, p2 + side * w * 0.9]
			var uv := [Vector2(0.2, 1), Vector2(0.8, 1), Vector2(0, 0.55), Vector2(1, 0.55), Vector2(0.05, 0), Vector2(0.95, 0)]
			for k in [0, 1, 2, 1, 3, 2, 2, 3, 4, 3, 5, 4]:
				st.set_normal(nrm)
				st.set_color(col if k < 4 else col.lightened(0.12))
				st.set_uv(uv[k])
				st.add_vertex(v[k])
	# макушка: три скрещённые лапы вверх
	for i in 3:
		var a := PI * i / 3.0
		var side := Vector3(cos(a), 0, sin(a)) * h * 0.075
		var base := Vector3.UP * h * 0.86
		var top := Vector3.UP * h * 1.0
		var v := [base - side, base + side, top + side * 0.5, top - side * 0.5]
		var uv := [Vector2(0, 0.75), Vector2(1, 0.75), Vector2(0.8, 0), Vector2(0.2, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_color(Color(0.72, 0.84, 0.76))
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SPRUCE_SHADER
	sm.shader = sh
	sm.set_shader_parameter("tex", load(TEX + "spruce_bough.png"))
	st.set_material(sm)
	st.commit(mesh)
	return mesh


## ельник: три вида ели, расставлены по кластеру (не во дворе, не на тропе, не у старта)
func _spruces(body: StaticBody3D, placed: Array[Vector3], rng: RandomNumberGenerator) -> void:
	# высоты — в 2–3 роста героя (как в выживалках с видом сверху): лес не прячет героя и не закрывает пол-экрана
	var kinds := [[3.8, 11], [4.6, 12], [5.4, 9]]
	for ki in kinds.size():
		var h0: float = kinds[ki][0]
		var xs: Array[Transform3D] = []
		var n := int(kinds[ki][1])
		var tries := 0
		while n > 0 and tries < 3000:
			tries += 1
			var p := Vector3(rng.randf_range(-SIZE * 0.47, SIZE * 0.47), 0, rng.randf_range(-SIZE * 0.47, SIZE * 0.47))
			var hp2 := p - HOUSE_AT
			if hp2.x > YARD[0] - 2.5 and hp2.x < YARD[2] + 2.5 and hp2.z > YARD[1] - 2.5 and hp2.z < YARD[3] + 2.5:
				continue
			if _trail_dist(p) < 3.2 or p.distance_to(Vector3(0, 0, 6)) < 6.0:
				continue
			var near := false
			for q in placed:
				if q.distance_to(p) < 3.4:
					near = true
					break
			if near:
				continue
			placed.append(p)
			n -= 1
			var sc := rng.randf_range(0.85, 1.15)
			xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * sc), p))
			_tree_pts.append([p, h0 * sc * 0.34])
			_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * h0 * sc * 0.78), p + Vector3.UP * 0.03))
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.22 * sc
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.use_colors = true            # в режиме совместимости без цвета экземпляра сетка с custom data — чёрная
		mm.mesh = _spruce_mesh(h0, 100 + ki)
		mm.instance_count = xs.size()
		for i in xs.size():
			mm.set_instance_transform(i, xs[i])
			mm.set_instance_color(i, Color.WHITE)
			mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
		canopy.add_multimesh(mm, h0)
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)


## камень неровной формы: шар, помятый шумом, низ приплюснут (лежит на земле)
func _rock_mesh(seed_n: int) -> ArrayMesh:
	var sp := SphereMesh.new()
	sp.radius = 0.5
	sp.height = 1.0
	sp.radial_segments = 10
	sp.rings = 6
	var fn := FastNoiseLite.new()
	fn.seed = seed_n
	fn.frequency = 1.3
	var arr := sp.get_mesh_arrays()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	for i in vs.size():
		var v := vs[i]
		var k := 1.0 + 0.34 * fn.get_noise_3dv(v * 2.0) + 0.14 * fn.get_noise_3dv(v * 5.0)
		v *= k
		v.y = maxf(v.y * 0.72, -0.16)
		vs[i] = v
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	for i in idx:
		st.add_vertex(vs[i])
	st.generate_normals()
	return st.commit()


func _box(size: Vector3) -> BoxMesh:
	var bm := BoxMesh.new()
	bm.size = size
	return bm


func _multi(xs: Array[Transform3D], mesh: Mesh, mat: Material, colors: Array[Color] = []) -> MultiMeshInstance3D:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_colors = not colors.is_empty()
	mm.mesh = mesh
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
		if not colors.is_empty():
			mm.set_instance_color(i, colors[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.material_override = mat
	add_child(mi)
	return mi


var _blobs: Array[Transform3D] = []
var canopy := ULCanopy.new()      ## деревья, закрывающие героя, растворяются


func _flora() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 2611
	var placed: Array[Vector3] = []
	var body := StaticBody3D.new()
	body.name = "Trees"
	add_child(body)
	_spruces(body, placed, rng)
	for f in FLORA:
		var path := MODELS + String(f[0]) + ".glb"
		var scene: PackedScene = load(path) if ResourceLoader.exists(path) else null
		var n := int(f[2])
		var tries := 0
		while n > 0 and tries < 2000:
			tries += 1
			var p := Vector3(rng.randf_range(-SIZE * 0.47, SIZE * 0.47), 0, rng.randf_range(-SIZE * 0.47, SIZE * 0.47))
			# не на дом, не на дорогу, не на старт, не вплотную друг к другу
			var hp := p - HOUSE_AT
			if hp.x > YARD[0] - 1.5 and hp.x < YARD[2] + 1.5 and hp.z > YARD[1] - 1.5 and hp.z < YARD[3] + 1.5:
				continue
			if p.distance_to(Vector3(0, 0, 6)) < 4.0 or _trail_dist(p) < 2.4:
				continue
			var near := false
			for q in placed:
				if q.distance_to(p) < (2.2 if f[0] != "ph_bush" else 1.4):
					near = true
					break
			if near:
				continue
			placed.append(p)
			n -= 1
			var h := float(f[1]) * rng.randf_range(0.8, 1.2)
			var node: Node3D
			if scene:
				node = scene.instantiate()
				var bb := _aabb(node)
				node.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
			else:
				node = _fallback_tree(h, String(f[0]) == "ph_bush")
			node.rotation.y = rng.randf() * TAU
			node.position = p
			add_child(node)
			if f[0] != "ph_bush":
				canopy.add_model(node, h)
			_tree_pts.append([p, h * 0.32 if f[0] != "ph_bush" else 0.7])
			_blobs.append(Transform3D(Basis.from_scale(Vector3.ONE * h * (0.5 if f[0] != "ph_bush" else 0.9)), p + Vector3.UP * 0.03))
			if float(f[3]) > 0.0:
				var cs := CollisionShape3D.new()
				var cy := CylinderShape3D.new()
				cy.radius = float(f[3]) * h / float(f[1])
				cy.height = 3.0
				cs.shape = cy
				cs.position = p + Vector3.UP * 1.5
				body.add_child(cs)


func _fallback_tree(h: float, bush: bool) -> Node3D:
	var n := Node3D.new()
	var leaf := StandardMaterial3D.new()
	leaf.albedo_color = Color(0.25, 0.42, 0.18)
	var crown := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = h * (0.45 if bush else 0.28)
	sm.height = sm.radius * 2.0
	crown.mesh = sm
	crown.material_override = leaf
	crown.position.y = h * (0.45 if bush else 0.7)
	n.add_child(crown)
	if not bush:
		var tr := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.08
		cm.bottom_radius = 0.13
		cm.height = h * 0.6
		tr.mesh = cm
		var bark := StandardMaterial3D.new()
		bark.albedo_color = Color(0.35, 0.28, 0.22)
		tr.material_override = bark
		tr.position.y = h * 0.3
		n.add_child(tr)
	return n




## мягкие пятна тени под деревьями и кустами (тени от солнца выключены ради скорости)
func _blob_tex() -> Texture2D:
	var g := Gradient.new()
	g.set_color(0, Color(0, 0, 0, 0.5))
	g.set_color(1, Color(0, 0, 0, 0))
	var gt := GradientTexture2D.new()
	gt.gradient = g
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 64
	gt.height = 64
	return gt


func _blob_mat() -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = _blob_tex()
	m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	return m


func _blob_layer() -> void:
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	var mi := _multi(_blobs, pm, _blob_mat())
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


# ---------------- герой ----------------

func _player() -> void:
	player = CharacterBody3D.new()
	player.name = "Player"
	add_child(player)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.75
	cs.shape = cap
	cs.position.y = 0.875
	player.add_child(cs)
	player.floor_snap_length = 0.4
	player.collision_mask = 1 | ULDoor.LAYER       # и двери
	rig = BCCharacter.new()
	player.add_child(rig)
	rig.setup("res://assets/models/hero.glb", "res://assets/anim/hero")
	# отшатывание от удара — последним: руки и оружие идут вместе с корпусом
	flinch = BCFlinch.new()
	flinch.name = "Flinch"
	rig.skel.add_child(flinch)
	# темп действий в игре выше, чем на стенде: отклик важнее показа движения
	rig.hold.draw_rate = 2.2
	rig.hold.move_rate = 1.3
	rig.hold.reload_rate = 1.25
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.1, 1.1)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	player.add_child(blob)
	snd = BCSound.new()
	add_child(snd)
	rig.hold.sfx.connect(_on_sfx)
	player.position = Vector3(0, 0.1, 3)
	player.rotation.y = PI                       # лицом к дому
	cam = Camera3D.new()
	cam.fov = 38
	cam.near = 0.3
	cam.far = 120
	add_child(cam)
	cam.current = true
	_cam_t = player.position


func _input_vec() -> Vector2:
	var v := _joy_v
	var k := Vector2.ZERO
	for key in [[KEY_W, Vector2(0, -1)], [KEY_S, Vector2(0, 1)], [KEY_A, Vector2(-1, 0)], [KEY_D, Vector2(1, 0)]]:
		if Input.is_physical_key_pressed(key[0]):
			k += key[1]
	if k.length() > 0.01:
		v = k.normalized() * (1.0 if Input.is_physical_key_pressed(KEY_SHIFT) else 0.6)
	if not _auto.is_empty():
		v = _auto_vec()
	if _modal():
		v = Vector2.ZERO
	return v


func _process(delta: float) -> void:
	_blobs_tick()
	var iv := _input_vec()
	# «вверх» на джойстике — от камеры вперёд (на север)
	var fwd := Vector3(-sin(CAM_YAW), 0, -cos(CAM_YAW))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dir := right * iv.x - fwd * iv.y
	var mag := clampf(iv.length(), 0.0, 1.0)
	# слегка отклонить — лёгкий бег, сильнее — быстрее, до полного бега
	var speed := 0.0
	if mag > 0.12:
		# быстрее выходит на бег: полный бег — уже на трёх четвертях хода джойстика
		speed = lerpf(2.4, 4.4, clampf((mag - 0.12) / 0.6, 0.0, 1.0))
	# энергия: быстрый бег тратит её; выдохся — только лёгкий бег, пока не отдышится
	if speed > 3.3 and not _tired:
		en = maxf(0.0, en - 5.0 * delta)
		if en <= 0.0:
			_tired = true
	elif water > 0.0:
		en = minf(100.0, en + (9.0 if speed < 0.2 else 5.0) * delta)
	if _tired:
		speed = minf(speed, 2.4)
		if en >= 25.0:
			_tired = false
	water = maxf(0.0, water - delta * 0.04)
	# Прицельное движение: пока герой стреляет (кнопка удержана или после выстрела прошло меньше секунды),
	# он стоит лицом к цели, а идёт туда, куда ведёт джойстик, — вперёд, боком или пятясь. Ноги шагают в ту
	# сторону, куда он на самом деле движется: тело и ноги не расходятся. Пятится и идёт боком он медленнее.
	var hi0 = _hand_item()
	var gun: bool = hi0 != null and ULItems.get_def(String(hi0.id)).has("ammo") and rig.hold.wid != "" and rig.hold.drawn > 0.99
	var fire_held: bool = _hud_touch.values().has("fire") or Input.is_physical_key_pressed(KEY_SPACE)
	aiming = gun and not _modal() and (fire_held or _aim_t < 0.3)
	move_mode = ""
	var local_dir := Vector2.ZERO           # куда идёт относительно взгляда: x — влево, y — вперёд
	if aiming:
		if _mark_t != null and is_instance_valid(_mark_t):
			var tv: Vector3 = (_mark_t as Node3D).global_position - player.global_position
			_aim_yaw = atan2(tv.x, tv.z)
		player.rotation.y = lerp_angle(player.rotation.y, _aim_yaw, 1.0 - exp(-delta * 16.0))
		if mag > 0.12:
			var fa := Vector3(sin(_aim_yaw), 0, cos(_aim_yaw))
			var rel := rad_to_deg(fa.signed_angle_to(dir.normalized(), Vector3.UP))     # куда идёт относительно взгляда: + — влево
			if absf(rel) > 128.0:
				move_mode = "walk_back"
			elif absf(rel) > 52.0:
				move_mode = "strafe_left" if rel > 0.0 else "strafe_right"
			else:
				move_mode = "forward"
			local_dir = Vector2(sin(deg_to_rad(rel)), cos(deg_to_rad(rel)))
			# вперёд — быстрее, вбок и назад — медленнее; между ними скорость меняется плавно
			speed = minf(speed, lerpf(2.2, 3.4, clampf((cos(deg_to_rad(rel)) - 0.2) / 0.7, 0.0, 1.0)))
	else:
		_aim_yaw = player.rotation.y
	var want := dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	var hv := Vector3(player.velocity.x, 0, player.velocity.z)
	# отклик без «плавания»: до полного бега — за десятую секунды, остановка — ещё быстрее
	hv = hv.move_toward(want, delta * (45.0 if want.length() > hv.length() else 60.0))
	# толчок от удара врага: добавка к шагу, быстро гаснет и в разгон не копится
	var kv := _knock
	player.velocity = Vector3(hv.x + kv.x, player.velocity.y - 9.8 * delta, hv.z + kv.z)
	# длинный кадр (слабый телефон, < 30 кадров/с) — шаг дробится: за раз не больше ~1/30 с пути, иначе на
	# лестнице и пандусе герой «не цепляет» ступени и стоит у первой
	var n_sub := clampi(int(ceil(delta / 0.034)), 1, 8)
	player.velocity /= float(n_sub)
	for si in n_sub:
		player.move_and_slide()
	player.velocity *= float(n_sub)
	player.velocity.x -= kv.x
	player.velocity.z -= kv.z
	_knock = _knock.move_toward(Vector3.ZERO, delta * 10.0)
	if player.is_on_floor():
		player.velocity.y = 0.0
	var real := Vector3(player.velocity.x, 0, player.velocity.z).length()
	if real > 0.2 and is_nan(_face) and not aiming and _aim_t > 0.35:
		var yaw := atan2(hv.x, hv.z)
		player.rotation.y = lerp_angle(player.rotation.y, yaw, 1.0 - exp(-delta * 24.0))
	# прицельное движение — шаг в сторону относительно взгляда (вперёд, боком, назад и всё между ними)
	rig.set_dir_move(local_dir if real > 0.2 else Vector2.ZERO, real, delta)
	rig.set_motion(real, 0.0, delta)
	_body_pose(real)
	_steps_sfx(real)
	# в доме: дом Tripo и крыша скрыты, видны комнаты, передние стены опущены
	var ins := _in_house(player.global_position)
	if house != null:
		if ins != house.inside:
			house.set_inside(ins)
		house.update_walls(player.global_position, delta)
	var dist_t := minf(cam_dist, 13.0) if ins else cam_dist
	if not _cam_ready:
		_cam_t = player.global_position
		_cam_d = dist_t
	# камера идёт за героем плотно (одно сглаживание, без отставания); расстояние меняется мягко
	_cam_t = _cam_t.lerp(player.global_position, 1.0 - exp(-delta * 16.0))
	_cam_d = lerpf(_cam_d, dist_t, 1.0 - exp(-delta * 6.0))
	var cp := Vector3(sin(CAM_YAW) * cos(CAM_PITCH), sin(CAM_PITCH), cos(CAM_YAW) * cos(CAM_PITCH)) * _cam_d
	var look := _cam_t + Vector3.UP * 0.8
	cam.global_position = look + cp
	if _hurt_t > 0.0:
		# удар по герою: камера коротко вздрагивает (сильнее от сильного удара)
		var k := _hurt_t / 0.35 * _hurt_amp
		cam.global_position += Vector3(sin(Time.get_ticks_msec() * 0.09), 0.0, cos(Time.get_ticks_msec() * 0.11)) * 0.12 * k
	_cam_ready = true
	cam.look_at(look, Vector3.UP)
	var _p0 := Time.get_ticks_usec()
	canopy.tick(cam, player.global_position, delta)
	var _p1 := Time.get_ticks_usec()
	_find_target()
	var _p2 := Time.get_ticks_usec()
	_combat_tick(delta)
	var _p3 := Time.get_ticks_usec()
	prof_parts["кроны"] = int(prof_parts.get("кроны", 0)) + _p1 - _p0
	prof_parts["цель"] = int(prof_parts.get("цель", 0)) + _p2 - _p1
	prof_parts["бой"] = int(prof_parts.get("бой", 0)) + _p3 - _p2
	if info and Engine.get_process_frames() % 10 == 0:
		var adapt := ""
		if int(ULSettings.q().msaa) > 0 and get_viewport().msaa_3d == Viewport.MSAA_DISABLED:
			adapt += " · без сглаживания"
		if _shadow_pref and sun and not sun.shadow_enabled:
			adapt += " · без теней"
		info.text = "%s · %d кадров/с · разрешение %d %%%s%s" % [_where(), Engine.get_frames_per_second(), int(round(get_viewport().scaling_3d_scale * 100.0)), adapt, _perf_text]
	_fps_tick(delta)
	_auto_res(delta)
	# за краем локации: пять секунд на возвращение, потом — на карту мира
	if not arena and _dead_t <= 0.0 and (absf(player.global_position.x) > size_m * 0.5 or absf(player.global_position.z) > size_m * 0.5):
		_leave_t += delta
		if _leave_t >= LEAVE_S and not left_location:
			left_location = true
			if temp():
				cs_finish("left")
			elif lvl:
				_lvl_exit()
			else:
				_save()
				if test == "":
					get_tree().change_scene_to_file("res://map.tscn")
	else:
		_leave_t = 0.0
	var _pz := Time.get_ticks_usec()
	if temp():
		_cs_tick(delta)
	prof_parts["зона"] = int(prof_parts.get("зона", 0)) + Time.get_ticks_usec() - _pz
	if _hud:
		_hud.queue_redraw()
	if house != null:
		for lb in house.labels:
			lb.basis = Basis(Vector3.UP, CAM_YAW) * Basis(Vector3.RIGHT, -PI * 0.5)
	if _toast_t > 0.0:
		_toast_t -= delta
		_toast.modulate.a = clampf(_toast_t, 0.0, 1.0)
	if _preview_rig and inv_ui.visible and _preview_rig.hold.wid != "":
		_preview_rig.set_motion(0.0, 0.0, delta)
	var _pe := Time.get_ticks_usec()
	_npcs_tick(delta)
	_enemies_tick(delta)
	prof_parts["враги"] = int(prof_parts.get("враги", 0)) + Time.get_ticks_usec() - _pe


var _cam_ready := false
var _cam_d := 12.0
var aiming := false               ## прицельное движение: герой лицом к цели
var move_mode := ""               ## как он при этом идёт: forward — вперёд, walk_back — пятится, strafe_left / strafe_right — боком ("" — не в прицельном движении)
var _aim_yaw := 0.0
var _pose_now := "?"


## стойка: с оружием в руках — стойка стрелка, иначе обычная; на ходу — клипы передвижения
func _body_pose(speed: float) -> void:
	var want := ""
	if speed < 0.2 and rig.hold.wid != "" and rig.hold.drawn > 0.5:
		want = "combat_idle" if String(rig.hold.w.get("mode", "")) == "melee" else "armed_idle"
	if want != _pose_now:
		_pose_now = want
		rig.set_pose(want)


func _where() -> String:
	if arena:
		return "полигон"
	if place == "cowshed":
		return "Опасный коровник" + (", коровник" if cowshed.in_barn(player.global_position) >= 0 else "")
	if indoor():
		if san.hero_b < 0:
			return zone_name()
		if place == "convoy" or place == "khutor" or place == "lair":
			return "%s, %s" % [zone_name(), san.blds[san.hero_b].title.to_lower()]
		return "%s, %s, %d этаж" % [zone_name(), san.blds[san.hero_b].title.to_lower(), san.hero_f + 1]
	if not house.contains(player.global_position):
		return "кластер, двор" if _in_yard(player.global_position) else "кластер, улица"
	var l := house.to_local(player.global_position)
	var best := ""
	var bd := 1e9
	for r in ULHouse.ROOMS:
		var room: Vector2 = r[1]
		var d := Vector2(l.x, l.z).distance_to(room)
		if d < bd:
			bd = d
			best = r[0]
	return "дом, " + best.to_lower()


func _in_yard(p: Vector3) -> bool:
	var h := p - HOUSE_AT
	return h.x > YARD[0] and h.x < YARD[2] and h.z > YARD[1] and h.z < YARD[3]


func _steps_sfx(speed: float) -> void:
	if rig.probe == null or rig.probe.pos.is_empty():
		return
	for b in ["L_Foot", "R_Foot"]:
		if not rig.probe.pos.has(b):
			continue
		var lp: Vector3 = rig.probe.pos[b]
		var h := lp.y * rig.scale_k
		if not _steps.has(b):
			_steps[b] = [h, false]
		var st: Array = _steps[b]
		st[0] = minf(float(st[0]) + 0.0004, h)
		if h > float(st[0]) + 0.045:
			st[1] = true
		elif bool(st[1]) and h < float(st[0]) + 0.018:
			st[1] = false
			snd.play("step", rig.skel.global_transform * lp, -8.0 + clampf(speed, 0.0, 4.0) * 1.5, 0.08)
		_steps[b] = st


## звуки механики оружия: достать, убрать, перезарядка по шагам
func _on_sfx(n: String, at: Vector3) -> void:
	var p := rig.skel.global_transform * at
	var w: Dictionary = rig.hold.w
	var pistol := String(w.get("mode", "")) == "pistol"
	var box := String(w.get("reload", {}).get("kind", "")) == "box"
	match n:
		"grab", "pouch":
			snd.play("cloth", p, -8.0)
		"draw_out", "holster":
			snd.play("click" if pistol else "cloth", p, -9.0)
		"mag_out":
			snd.play("click", p, -6.0)
			snd.play("mag_out", p, -3.0 if not pistol else -7.0, 0.05, 0.03)
		"mag_in":
			snd.play("box_in" if box else "mag_in", p, -2.0)
		"mag_slap":
			snd.play("click", p, -8.0)
		"bolt_back":
			snd.play("slide_back" if pistol else "bolt_back", p, -2.0)
			if not rig.hold.parts or not rig.hold.parts.has("mag"):
				snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0, 0.05, 0.22)
		"bolt_fwd":
			snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0)
		"cover_open":
			snd.play("cover_open", p, -3.0)
		"cover_close":
			snd.play("cover_close", p, -3.0)
		"mag_drop":
			snd.play("mag_drop", p, -5.0, 0.1)
		"shell_in":
			snd.play("shell_in", p, -3.0)
		"pump":
			snd.play("pump", p, -2.0)


# ---------------- снаряжение на герое ----------------

## надетый рюкзак и оружие в руках — на героя (и на героя в окне инвентаря)
func _apply_gear() -> void:
	var pid := String(ULItems.get_def(String(inv.pack.id)).pack) if inv.pack != null else ""
	if pid != _pack_shown:
		_pack_shown = pid
		_wear(rig, pid)
	var wid := _hand_weapon()
	if wid != rig.hold.wid:
		if wid == "":
			rig.hold.put_away()
			get_tree().create_timer(0.55).timeout.connect(func():
				if _hand_weapon() == "" and rig.hold.wid != "":
					rig.hold.equip(""))
		else:
			rig.hold.equip(wid, false)
			rig.hold.set_stance("ready")
			rig.hold.draw()
	_update_preview()


func _hand_weapon() -> String:
	if inv.hand == "":
		return ""
	var it = inv.get(inv.hand)
	return String(ULItems.get_def(String(it.id)).weapon) if it != null else ""


func _wear(r: BCCharacter, pid: String) -> void:
	for c in r.skel.get_children():
		if c.name == "Pack":
			c.queue_free()
	if pid == "":
		return
	var mi := BCPackFit.build(r, BCPackFit.PACKS[pid])
	r.skel.add_child(mi)
	mi.skeleton = mi.get_path_to(r.skel)


## кнопка «Оружие»: основное → пистолет → убрать (только то, что есть в слотах)
func cycle_weapon() -> void:
	var order := []
	if inv.primary != null:
		order.append("primary")
	if inv.pistol != null:
		order.append("pistol")
	order.append("")
	var i := order.find(inv.hand)
	inv.hand = order[(i + 1) % order.size()]
	_reloading = false
	if inv.hand == "" and order.size() == 1:
		say("Нет оружия в слотах")
	_apply_gear()
	_save()


# ---------------- герой в окне инвентаря ----------------

func _make_preview() -> void:
	_preview_vp = SubViewport.new()
	_preview_vp.size = Vector2i(400, 580)
	_preview_vp.own_world_3d = true
	_preview_vp.transparent_bg = true
	_preview_vp.msaa_3d = Viewport.MSAA_4X
	_preview_vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	add_child(_preview_vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.8, 0.9)
	e.ambient_light_energy = 0.6
	e.tonemap_mode = Environment.TONE_MAPPER_ACES
	e.tonemap_exposure = 1.1
	env.environment = e
	_preview_vp.add_child(env)
	for r in [[Vector3(-30, -30, 0), 1.2], [Vector3(-15, 150, 0), 0.7]]:
		var l := DirectionalLight3D.new()
		l.rotation_degrees = r[0]
		l.light_energy = r[1]
		_preview_vp.add_child(l)
	var stand := Node3D.new()
	_preview_vp.add_child(stand)
	_preview_rig = BCCharacter.new()
	stand.add_child(_preview_rig)
	_preview_rig.setup("res://assets/models/hero.glb", "res://assets/anim/hero")
	_preview_rig.rotation.y = -0.35
	# пол: тёмный круг
	var disc := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.55
	cm.bottom_radius = 0.55
	cm.height = 0.02
	disc.mesh = cm
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(0.12, 0.15, 0.18)
	disc.material_override = dm
	stand.add_child(disc)
	var c := Camera3D.new()
	c.fov = 28
	c.position = Vector3(0, 1.0, 4.3)
	_preview_vp.add_child(c)
	c.look_at(Vector3(0, 0.9, 0), Vector3.UP)
	c.current = true


func _update_preview() -> void:
	if _preview_rig == null:
		return
	var pid := String(ULItems.get_def(String(inv.pack.id)).pack) if inv.pack != null else ""
	if pid != _preview_pack:
		_preview_pack = pid
		_wear(_preview_rig, pid)
	var wid := _hand_weapon()
	if wid != _preview_rig.hold.wid:
		_preview_rig.hold.equip(wid, true)
		if wid != "":
			_preview_rig.hold.set_stance("ready")
	_preview_rig.set_pose("armed_idle" if wid != "" else "")


func _preview_on(on: bool) -> void:
	if _preview_vp == null:
		return
	_preview_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS if on else SubViewport.UPDATE_DISABLED
	_preview_vp.get_child(0).get_parent().process_mode = Node.PROCESS_MODE_INHERIT if on else Node.PROCESS_MODE_DISABLED


# ---------------- инвентарь ----------------

func open_inventory(container = null, title := "", is_pack := false, icon := "crate") -> void:
	if _preview_vp == null:
		_make_preview()
	_preview_on(true)
	_update_preview()
	inv_ui.preview_tex = _preview_vp.get_texture()
	inv_ui.stats = {"hp": hp, "en": en, "water": water}
	inv_ui.open(inv, container, title, is_pack, icon)
	_hud.visible = false
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()
	_touch.clear()
	snd.play("zip", player.global_position + Vector3.UP * 1.2, -12.0)


func close_inventory() -> void:
	inv_ui.visible = false
	_hud.visible = true
	_open_ground = null
	_preview_on(false)
	_sync_ground_visuals()
	_save()


func _on_inv_changed() -> void:
	_apply_gear()
	_sync_ground_visuals()
	_save()


## выбросить на землю перед героем (по кругу, чтобы предметы не ложились друг на друга)
func _on_drop(it: Dictionary) -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 0.9
	var n := 0
	for g in ground:
		if (g.node as Node3D).global_position.distance_to(p) < 0.5:
			n += 1
	if n > 0:
		p += Vector3(cos(n * 2.4), 0, sin(n * 2.4)) * (0.35 + 0.1 * n)
	_spawn_ground(it, p, player.rotation.y + randf_range(-0.6, 0.6))
	snd.play("cloth", p, -6.0)
	_apply_gear()


func _on_wear_ground_pack() -> void:
	if _open_ground == null:
		return
	var g: Dictionary = _open_ground
	if inv.pack != null:
		# надетый рюкзак ложится на место того, что надеваем (вещи остаются в нём)
		_spawn_ground(inv.pack, (g.node as Node3D).global_position + Vector3(0.6, 0, 0), randf() * TAU)
	inv.pack = g.item
	_remove_ground(g)
	snd.play("zip", player.global_position + Vector3.UP * 1.2, -6.0)
	_apply_gear()
	_save()
	inv_ui.open(inv)


# ---------------- предметы на земле ----------------

func _spawn_ground(it: Dictionary, p: Vector3, yaw: float) -> Dictionary:
	var node := Node3D.new()
	node.name = "Item"
	add_child(node)
	node.global_position = Vector3(p.x, ULHouse.FLOOR_Y if _in_house(p) else 0.0, p.z)
	node.rotation.y = yaw
	var g := {"item": it, "node": node}
	ground.append(g)
	_ground_visual(g)
	return g


func _ground_visual(g: Dictionary) -> void:
	var node: Node3D = g.node
	for c in node.get_children():
		c.queue_free()
	var it: Dictionary = g.item
	var d := ULItems.get_def(String(it.id))
	var k := String(d.kind)
	if d.has("weapon"):
		var w: Dictionary = BCWeaponHold.config()[d.weapon]
		var m: Node3D = (load(String(w.model)) as PackedScene).instantiate()
		var s := float(w.len_m) / float(w.model_len)
		var holder := Node3D.new()
		node.add_child(holder)
		holder.add_child(m)
		if w.get("flip", false):
			m.rotation.y = PI
		# лежит на боку: верх модели (+y) — вбок
		holder.basis = Basis(Vector3.FORWARD, PI * 0.5).scaled(Vector3.ONE * s)
		holder.position.y = 0.03
	elif k == "pack":
		var pk: Dictionary = BCPackFit.PACKS[d.pack]
		var m: Node3D = (load(String(pk.model)) as PackedScene).instantiate()
		var s := float(pk.h) / 0.98 * 0.9
		m.scale = Vector3.ONE * s
		m.rotation.x = -0.25 if String(pk.back) == "-z" else 0.0
		m.rotation.z = 0.0 if String(pk.back) == "-z" else 0.25
		node.add_child(m)
	elif String(it.id) == "junk" and ResourceLoader.exists(MODELS + "ul_junk.glb"):
		# кучка хлама — своя модель (Tripo)
		var jm: Node3D = (load(MODELS + "ul_junk.glb") as PackedScene).instantiate()
		var jb := _aabb(jm)
		jm.scale = Vector3.ONE * (float(d.get("gs", 0.42)) / maxf(jb.size.x, jb.size.z))
		node.add_child(jm)
	elif ULItems.kit_mesh(String(it.id)) != null:
		# предмет из набора припасов — своя модель, чуть наклонена, повёрнута как упала
		var km := MeshInstance3D.new()
		km.mesh = ULItems.kit_mesh(String(it.id), "a")    # у патронов на земле — только коробка
		var kb := km.mesh.get_aabb()
		var ks := float(d.get("gs", 0.25)) / maxf(kb.size.x, maxf(kb.size.y, kb.size.z))
		km.scale = Vector3.ONE * ks
		km.rotation.y = fposmod(node.global_position.x * 7.3 + node.global_position.z * 3.1, TAU)
		node.add_child(km)
	else:
		# мелкий предмет — иконка на земле, лицом к камере
		var sp := Sprite3D.new()
		sp.texture = ULItems.icon(String(it.id))
		sp.modulate = ULItems.tint(String(it.id))
		sp.pixel_size = 0.0016
		sp.billboard = BaseMaterial3D.BILLBOARD_FIXED_Y
		sp.position.y = 0.2
		sp.shaded = false
		node.add_child(sp)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(0.9, 0.9)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.02
	node.add_child(blob)


func _remove_ground(g: Dictionary) -> void:
	if _glow_node == g.node:
		_glow_node = null
	ground.erase(g)
	(g.node as Node3D).queue_free()


func _sync_ground_visuals() -> void:
	# рюкзак на земле, из которого всё вынули и забрали сам предмет — убрать пустые записи
	for g in ground.duplicate():
		if g.item == null:
			_remove_ground(g)


# ---------------- ящики (хранилища) ----------------

func place_crate() -> void:
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var p := player.global_position + f * 1.0
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 0.4, p + Vector3.UP * 0.4)
	q.exclude = [player.get_rid()]
	var hit := space.intersect_ray(q)
	if not hit.is_empty():
		p = player.global_position + f * maxf(0.0, player.global_position.distance_to(hit.position) - 0.45)
	var cells := []
	cells.resize(CRATE_SLOTS)
	_add_crate(p, player.rotation.y, cells)
	snd.play("hit_wood", p, -8.0, 0.1, 0.15)
	_save()


func _add_crate(p: Vector3, yaw: float, cells: Array) -> void:
	var body := StaticBody3D.new()
	body.name = "Crate"
	add_child(body)
	var size := Vector3(1.0, 0.6, 0.6)
	var vis: Node3D
	if _crate_scene:
		vis = _crate_scene.instantiate()
		var bb := _aabb(vis)
		var s := size.x / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		vis.scale = Vector3.ONE * s
		bb = _aabb(vis)
		size = bb.size
		vis.position = Vector3(-bb.get_center().x, -bb.position.y, -bb.get_center().z)
	else:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = size
		mi.mesh = bm
		mi.material_override = ULHouse._mat(TEX + "brown_planks_03", 0.8)
		mi.position.y = size.y * 0.5
		vis = mi
	body.add_child(vis)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position.y = size.y * 0.5
	body.add_child(cs)
	body.position = Vector3(p.x, ULHouse.FLOOR_Y if _in_house(p) else 0.0, p.z)
	body.rotation.y = yaw
	body.set_meta("items", cells)
	body.set_meta("size", size)
	crates.append(body)


func remove_crate() -> void:
	var best: Node3D = null
	var bd := 2.2
	for c in crates:
		var d := c.global_position.distance_to(player.global_position)
		if d < bd:
			bd = d
			best = c
	if best:
		# вещи из ящика — на землю рядом
		var k := 0
		for it in best.get_meta("items"):
			if it != null:
				_spawn_ground(it, best.global_position + Vector3(cos(k * 1.3), 0, sin(k * 1.3)) * 0.6, randf() * TAU)
				k += 1
		snd.play("cloth", best.global_position, -6.0)
		if _glow_node == best:
			_glow_node = null
		crates.erase(best)
		best.queue_free()
		_save()


# ---------------- действие ----------------

func _find_target() -> void:
	var p := player.global_position
	var best = null
	var bd := 1.6
	for g in ground:
		var d := (g.node as Node3D).global_position.distance_to(p)
		if d < bd:
			bd = d
			best = {"type": "ground", "g": g}
	for c in crates:
		var sz: Vector3 = c.get_meta("size")
		var d := c.global_position.distance_to(p) - maxf(sz.x, sz.z) * 0.4
		if d < bd:
			bd = d
			best = {"type": "crate", "c": c}
	for n in npcs:
		var d := (n as Node3D).global_position.distance_to(p) - 0.4
		if d < bd:
			bd = d
			best = {"type": "npc", "n": n}
	if _terminal != null:
		var dt := _terminal.global_position.distance_to(p) - 0.2
		if dt < bd:
			bd = dt
			best = {"type": "terminal"}
	for e in enemies:
		if not e.alive():
			var d := e.body_pos().distance_to(p) - 0.3
			if d < bd:
				bd = d
				best = {"type": "corpse", "e": e}
	if san != null:
		var ci := san.container_near(p, bd)
		if ci >= 0:
			best = {"type": "box", "i": ci}
	if place == "lair" and (san as ULLair).chest_pos != Vector3.INF:
		var dc := ((san as ULLair).chest_pos as Vector3).distance_to(p) - 0.5
		if dc < 1.3:
			best = {"type": "chest"}
	var node: Node3D = null
	if best != null:
		match String(best.type):
			"ground":
				node = best.g.node
			"crate":
				node = best.c
			"npc":
				node = best.n
			"corpse":
				node = best.e
			"terminal":
				node = _terminal
	_target = best
	_box_glow(best)
	if node != _glow_node:
		_set_glow(_glow_node, false)
		_set_glow(node, true)
		_glow_node = node
	if _glow_mat:
		# лёгкое «дыхание» подсветки
		_glow_mat.albedo_color.a = 0.16 + 0.1 * sin(Time.get_ticks_msec() * 0.006)


var _glow_node: Node3D = null
var _glow_mat: StandardMaterial3D = null


## подсветить предмет, с которым можно что-то сделать: светлая накладка поверх его материалов.
## Отключено по просьбе пользователя: цель видна по кнопке «Обыскать» с названием, без засветки модели.
const GLOW_ON := false


func _set_glow(node: Node3D, on: bool) -> void:
	if node == null or not is_instance_valid(node):
		return
	if not GLOW_ON:
		on = false
	if _glow_mat == null:
		_glow_mat = StandardMaterial3D.new()
		_glow_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_glow_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		_glow_mat.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		_glow_mat.albedo_color = Color(1.0, 0.86, 0.5, 0.2)
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh is PlaneMesh:
			continue                                   # пятно тени не светится
		m.material_overlay = _glow_mat if on else null
	for sp in node.find_children("*", "Sprite3D", true, false):
		var s3 := sp as Sprite3D
		var base: Color = s3.get_meta("tint", s3.modulate)
		s3.set_meta("tint", base)
		s3.modulate = base.lightened(0.35) if on else base
		s3.scale = Vector3.ONE * (1.15 if on else 1.0)


## Тайник под рукой (тумбочка, шкаф, стол…): подсвечивается светящейся коробкой по его размеру
var _box_hl: MeshInstance3D = null


func _box_glow(best) -> void:
	var on: bool = GLOW_ON and best != null and String(best.type) == "box"
	if not on:
		if _box_hl != null:
			_box_hl.visible = false
		return
	if _box_hl == null:
		_box_hl = MeshInstance3D.new()
		_box_hl.mesh = BoxMesh.new()
		var gm := StandardMaterial3D.new()
		gm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		gm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		gm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
		gm.albedo_color = Color(1.0, 0.86, 0.5, 0.18)
		gm.no_depth_test = false
		_box_hl.material_override = gm
		_box_hl.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_box_hl)
	var ct: Dictionary = san.containers[int(best.i)]
	var sz: Vector3 = ct.size
	(_box_hl.mesh as BoxMesh).size = sz + Vector3(0.06, 0.04, 0.06)
	_box_hl.global_position = (ct.pos as Vector3) + Vector3.UP * (sz.y * 0.5)
	_box_hl.rotation.y = float(ct.get("yaw", 0.0))
	# большой тайник (техника) подсвечивается слабее — иначе машина выглядит выбеленной
	(_box_hl.material_override as StandardMaterial3D).albedo_color.a = (0.14 + 0.08 * sin(Time.get_ticks_msec() * 0.006)) * clampf(1.6 / maxf(sz.x, sz.z), 0.3, 1.0)
	_box_hl.visible = true


func _target_pos() -> Vector3:
	if _target == null:
		return Vector3.ZERO
	if _target.type == "box":
		var ctp: Dictionary = san.containers[int(_target.i)]
		return (ctp.pos as Vector3) + Vector3.UP * ((ctp.size as Vector3).y + 0.2)
	if _target.type == "npc":
		return (_target.n as Node3D).global_position + Vector3.UP * 1.0
	if _target.type == "corpse":
		return (_target.e as ULEnemy).body_pos() + Vector3.UP * 0.3
	if _target.type == "terminal":
		return _terminal.global_position + Vector3.UP * 1.0
	if _target.type == "chest":
		return (san as ULLair).chest_pos + Vector3.UP * 0.9
	return (_target.g.node as Node3D).global_position if _target.type == "ground" else (_target.c as Node3D).global_position + Vector3.UP * 0.3


func _target_name() -> String:
	if _target == null:
		return ""
	if _target.type == "crate":
		return "ящик"
	if _target.type == "box":
		return String(san.containers[int(_target.i)].n).to_lower()
	if _target.type == "npc":
		return "%s, %s" % [_target.n.get_meta("name"), _target.n.get_meta("role")]
	if _target.type == "corpse":
		return "%s (тело)" % String((_target.e as ULEnemy).def.n)
	if _target.type == "terminal":
		return "компьютер базы"
	if _target.type == "chest":
		return "Оружейный сундук" if not ULCase.find_key(inv).is_empty() or ULCase.pending() != null else "Закрыто. Требуется ключ главаря муров"
	return ULItems.title(_target.g.item)


func _action_label() -> String:
	if _target == null:
		return ""
	if _target.type == "crate":
		return "Открыть"
	if _target.type == "box":
		return "Обыскать"
	if _target.type == "npc":
		return "Говорить"
	if _target.type == "corpse":
		return "Обыскать"
	if _target.type == "terminal":
		return "Открыть"
	if _target.type == "chest":
		return "Открыть оружейный сундук" if not ULCase.find_key(inv).is_empty() or ULCase.pending() != null else "Закрыто"
	var it: Dictionary = _target.g.item
	return "Открыть" if ULItems.kind(it) == "pack" else "Взять"


func do_action() -> void:
	if _target == null:
		return
	if _target.type == "crate":
		open_inventory(_target.c.get_meta("items"), "Ящик", false, "crate")
		snd.play("hit_wood", (_target.c as Node3D).global_position, -10.0)
		return
	if _target.type == "npc":
		open_talk(_target.n)
		return
	if _target.type == "terminal":
		open_terminal()
		return
	if _target.type == "chest":
		open_chest()
		return
	if _target.type == "box":
		# тайник в корпусе: его содержимое — как хранилище (взять всё или по одному)
		var ct: Dictionary = san.containers[int(_target.i)]
		var ic := {"med": "kit_6", "kitchen": "kit_9", "locker": "ammo_1", "bedside": "kit_7", "mil_med": "kit_6", "mil_ammo": "ammo_3", "soldier": "ammo_3",
			"truck": "ammo_5", "btr": "ammo_5", "soldier_bag": "kit_9", "cab": "kit_9", "fuel": "junk", "wreck": "junk"}.get(String(ct.kind), "crate")
		open_inventory(ct.items, String(ct.n), false, ic)
		snd.play("hit_wood" if String(ct.kind) in ["bedside", "wardrobe", "desk", "store", "reception", "workbench", "mil_ammo", "mil_gear", "mil_docs"] else ("cloth" if String(ct.kind) in ["soldier", "soldier_bag", "mil_med"] else "click"), ct.pos, -12.0)
		ct["opened"] = true
		return
	if _target.type == "corpse":
		# обыск тела: его добыча — как хранилище; что взять — решает игрок («Взять всё» или по одному)
		_open_corpse = _target.e
		open_inventory((_target.e as ULEnemy).loot, String((_target.e as ULEnemy).def.n), false, String((_target.e as ULEnemy).def.pic))
		return
	var g: Dictionary = _target.g
	var it: Dictionary = g.item
	if ULItems.kind(it) == "pack":
		_open_ground = g
		open_inventory(it.items, ULItems.get_def(String(it.id)).n, true, String(it.id))
		return
	var n0 := int(it.n)
	var left := inv.add(it)
	if left == n0:
		say("Нет места")
		return
	snd.play("cloth", (g.node as Node3D).global_position, -6.0)
	if left == 0:
		_remove_ground(g)
		say("Подобрано: " + ULItems.get_def(String(it.id)).n)
	else:
		say("Взято не всё — нет места")
	# оружие легло в пустой слот и в руках ничего — сразу в руки
	var sl := ULItems.slot_of(it)
	if inv.hand == "" and sl in ["pistol", "primary"] and inv.get(sl) == it:
		inv.hand = sl
	_apply_gear()
	_save()


func say(t: String) -> void:
	_toast.text = t
	_toast_t = 2.2
	_toast.modulate.a = 1.0


# ---------------- сохранение ----------------

func _save() -> void:
	if arena or test != "" or lvl:
		return                                  # полигон, проверки и тест уровней сохранение не трогают
	if temp():
		_save_carried()                         # во временном кластере сохраняется только то, что при себе
		return
	var cr := []
	for c in crates:
		cr.append([snappedf(c.position.x, 0.01), snappedf(c.position.z, 0.01), snappedf(c.rotation.y, 0.01), c.get_meta("items")])
	var gr := []
	for g in ground:
		var n: Node3D = g.node
		gr.append([g.item, snappedf(n.global_position.x, 0.01), snappedf(n.global_position.z, 0.01), snappedf(n.rotation.y, 0.01)])
	if test == "":
		ULBase.write_json(SAVE, {"v": SAVE_V, "crates": cr, "ground": gr, "inv": inv.to_dict(), "hp": hp, "en": en, "water": water})


func _load() -> void:
	if arena:
		_arena_loot()
		return
	if temp():
		_cs_load()
		return
	var d = null
	if FileAccess.file_exists(SAVE) and test == "":
		d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
	if d is Dictionary and int(d.get("v", 1)) >= SAVE_V:
		for c in d.get("crates", []):
			var cells: Array = c[3] if c.size() > 3 else []
			cells.resize(CRATE_SLOTS)
			for i in cells.size():
				cells[i] = ULInventory._fix(cells[i])
			_add_crate(Vector3(float(c[0]), 0, float(c[1])), float(c[2]), cells)
		for g in d.get("ground", []):
			var it = ULInventory._fix(g[0])
			if it != null:
				_spawn_ground(it, Vector3(float(g[1]), 0, float(g[2])), float(g[3]))
		inv.from_dict(d.get("inv", {}))
		hp = clampf(float(d.get("hp", 65.0)), 1.0, HP_MAX)
		en = clampf(float(d.get("en", 100.0)), 0.0, 100.0)
		water = clampf(float(d.get("water", 100.0)), 0.0, 100.0)
		return
	_start_loot()


## первый запуск: два ящика у стены кладовой с оружием и патронами, в доме и во дворе — рюкзаки и оружие,
## в карманах — бинты, вода, тушёнка
func _start_loot() -> void:
	var I := ULItems
	var a := []
	a.resize(CRATE_SLOTS)
	# для проверки: в первом ящике — всё оружие, что есть в игре, во втором — патроны ко всему
	for wid in ["tt", "beretta", "machete", "ak74m", "mp5", "fnfal", "svd", "vss", "pkp", "spas12"]:
		ULInventory.put(a, I.make(wid))
	var b := []
	b.resize(CRATE_SLOTS)
	for am in [["a762x25", 60], ["a9x19", 120], ["a545", 180], ["a762x51", 60], ["a762x54", 200], ["a9x39", 40], ["a12", 64], ["medkit", 2]]:
		var left: int = am[1]
		while left > 0:
			var part := mini(left, I.stack(am[0]))
			ULInventory.put(b, I.make(am[0], part))
			left -= part
	var H := house
	var g1 := H.to_global(Vector3(-5.47, 0, -3.0))
	var g2 := H.to_global(Vector3(-5.47, 0, -1.9))
	_spawn_ground(I.make("pack_small"), Vector3(1.6, 0, 1.4), 0.4)
	if test != "":
		# проверки: два ящика в горнице — всё оружие и патроны ко всему, в доме — рюкзаки побольше
		_add_crate(g1, 0.0, a)
		_add_crate(g2, 0.0, b)
		_spawn_ground(I.make("pack_medium"), H.to_global(Vector3(-3.4, 0, -2.6)), 1.1)
		_spawn_ground(I.make("pack_large"), H.to_global(Vector3(3.4, 0, -3.6)), -0.5)
	else:
		# игра: у героя — пистолет ТТ, полный магазин и 60 патронов в кармане, мачете; остальное оружие — у оружейника. В горнице — пустой ящик
		# под свои вещи
		var stash := []
		stash.resize(CRATE_SLOTS)
		_add_crate(g2, 0.0, stash)
		inv.pistol = I.make("tt")
		ULInventory.put(inv.pockets, I.make("a762x25", 60))
		ULInventory.put(inv.pockets, I.make("machete"))        # мачете — в кармане: носится в слоте пистолета
		# стартовые ресурсы (data/base_shop.json → start_wallet): хватает на первый маршрут
		var sw: Dictionary = ULBase.shop().get("start_wallet", {})
		for id in sw:
			inv.wallet[String(id)] = int(inv.wallet.get(String(id), 0)) + int(sw[id])
	_spawn_ground(I.make("rusk", 2), H.to_global(Vector3(-2.5, 0, 2.2)), 0.0)
	_spawn_ground(I.make("tonic", 2), H.to_global(Vector3(-4.6, 0, 2.3)), 0.0)
	_spawn_ground(I.make("medkit"), H.to_global(Vector3(4.6, 0, -3.0)), 0.0)
	_spawn_ground(I.make("can", 2), H.to_global(Vector3(-3.0, 0, 4.4)), 0.0)
	ULInventory.put(inv.pockets, I.make("bandage", 3))
	ULInventory.put(inv.pockets, I.make("water"))
	ULInventory.put(inv.pockets, I.make("can"))


# ---------------- интерфейс и касания ----------------

func _style(bg := C_BG) -> StyleBoxFlat:
	var sb := StyleBoxFlat.new()
	sb.bg_color = bg
	sb.border_color = C_LINE
	sb.set_border_width_all(1)
	sb.set_corner_radius_all(4)
	sb.content_margin_left = 8
	sb.content_margin_right = 8
	return sb


func _btn(text: String, cb: Callable, w := 110.0) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, 44)
	b.add_theme_font_size_override("font_size", 15)
	b.add_theme_color_override("font_color", C_TEXT)
	b.add_theme_stylebox_override("normal", _style())
	b.add_theme_stylebox_override("hover", _style(Color(0.1, 0.16, 0.2, 0.9)))
	b.add_theme_stylebox_override("pressed", _style(Color(0.12, 0.3, 0.4, 0.95)))
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _ui() -> void:
	var ui := CanvasLayer.new()
	add_child(ui)
	_hud = Control.new()
	_hud.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_hud.draw.connect(_draw_hud)
	ui.add_child(_hud)
	_hud.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	info = Label.new()
	info.position = Vector2(16, 84)
	info.add_theme_font_size_override("font_size", 15)
	info.add_theme_color_override("font_color", Color(1.0, 0.82, 0.4))
	info.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	info.add_theme_constant_override("outline_size", 6)
	_hud.add_child(info)
	# кнопки проверки — мелкие, сверху справа
	var bar := HBoxContainer.new()
	bar.anchor_left = 1.0
	bar.anchor_right = 1.0
	bar.offset_left = -360
	bar.offset_right = -12
	bar.offset_top = 98
	bar.grow_horizontal = Control.GROW_DIRECTION_BEGIN      # кнопок много — ряд растёт влево, а не за правый край экрана
	bar.alignment = BoxContainer.ALIGNMENT_END
	bar.add_theme_constant_override("separation", 6)
	bar.visible = false
	_menu_bar = bar
	_hud.add_child(bar)
	if arena:
		for ek in ULEnemy.KINDS:
			bar.add_child(_btn(String(ULEnemy.KINDS[ek].n) + " +", arena_enemy.bind(ek), 150))
		bar.add_child(_btn("Убрать врагов", func():
			clear_enemies()
			_menu_bar.visible = false, 150))
		bar.add_child(_btn("Патроны", arena_ammo, 110))
		bar.add_child(_btn("Здоровье", func():
			hp = HP_MAX
			_menu_bar.visible = false, 110))
	elif not temp():
		bar.add_child(_btn("Враг +", func():
			var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
			spawn_enemy("infected", player.global_position + f * 9.0)
			_menu_bar.visible = false, 90))
	bar.add_child(_btn("Справочник", open_book, 130))
	if not arena and not temp():
		bar.add_child(_btn("Карта", func():
			_save()
			get_tree().change_scene_to_file("res://map.tscn"), 90))
	bar.add_child(_btn("Настройки", open_settings, 120))
	bar.add_child(_btn("Тест FPS", fps_test, 110))
	if not arena and not temp():
		bar.add_child(_btn("Убрать ящик", remove_crate, 130))
	if not temp():
		bar.add_child(_btn("3D", func():
			_save()
			ULSettings.stand_back = "res://world.tscn"
			get_tree().change_scene_to_file("res://stand.tscn"), 70))
	_toast = Label.new()
	ui.add_child(_toast)
	_toast.set_anchors_and_offsets_preset(Control.PRESET_TOP_WIDE)
	_toast.offset_top = 70
	_toast.mouse_filter = Control.MOUSE_FILTER_IGNORE
	_toast.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	_toast.add_theme_font_size_override("font_size", 20)
	_toast.add_theme_color_override("font_color", Color(1.0, 0.85, 0.45))
	_toast.add_theme_color_override("font_outline_color", Color.BLACK)
	_toast.add_theme_constant_override("outline_size", 6)
	inv_ui = ULInventoryUI.new()
	inv_ui.visible = false
	ui.add_child(inv_ui)
	inv_ui.closed.connect(close_inventory)
	inv_ui.changed.connect(_on_inv_changed)
	inv_ui.drop.connect(_on_drop)
	inv_ui.wear_ground_pack.connect(_on_wear_ground_pack)
	inv_ui.use.connect(func(id: String):
		heal(id)
		inv_ui.stats = {"hp": hp, "en": en, "water": water})
	inv_ui.preview_rot = func(dx: float):
		if _preview_rig:
			_preview_rig.rotation.y += dx * 0.01


## Круглые кнопки справа снизу: [центр от правого нижнего угла, радиус]. fire — большая кнопка атаки (огонь,
## удар мачете, кулаки — смотря что в руках); swap — смена оружия; take — взять предмет / открыть ящик;
## heal — лечение; reload — перезарядка; inv — инвентарь.
const HUD_BTNS := {
	# всё у правого края, вокруг кнопки атаки: слева — взять, выше-левее — перезарядка, прямо над ней — смена
	# оружия, над сменой — рюкзак (инвентарь), между ними слева — лечение
	"fire": [Vector2(-128, -132), 76.0],
	"swap": [Vector2(-116, -274), 44.0],
	"inv": [Vector2(-116, -374), 40.0],
	"take": [Vector2(-284, -100), 46.0],
	"reload": [Vector2(-250, -210), 40.0],
	"heal": [Vector2(-224, -308), 38.0],
	# сверху справа (отсчёт от правого верхнего угла): постройка (поставить ящик) и меню
	"build": [Vector2(-140, 52), 36.0, "top"],
	"menu": [Vector2(-54, 52), 36.0, "top"],
}
var _hud_tex := {}
var _menu_bar: HBoxContainer


func _tex(path: String) -> Texture2D:
	if not _hud_tex.has(path):
		_hud_tex[path] = load(path) if ResourceLoader.exists(path) else null
	return _hud_tex[path]


func _glyph(n: String) -> Texture2D:
	if not _hud_tex.has(n):
		_hud_tex[n] = load("res://assets/icons/hud_%s.png" % n)
	return _hud_tex[n]


func _stat_tex(n: String) -> Texture2D:
	if not _hud_tex.has(n):
		_hud_tex[n] = load("res://assets/icons/%s.png" % n)
	return _hud_tex[n]


func _hud_pos(k: String) -> Vector2:
	var vs := get_viewport().get_visible_rect().size
	var b: Array = HUD_BTNS[k]
	if b.size() > 2:
		return Vector2(vs.x, 0) + (b[0] as Vector2)
	return vs + (b[0] as Vector2)


## значок кнопки из набора пользователя (assets/icons/ui): круглая картинка во всю кнопку
func _art(n: String) -> Texture2D:
	var key := "ui/" + n
	if not _hud_tex.has(key):
		_hud_tex[key] = load("res://assets/icons/ui/%s.png" % n)
	return _hud_tex[key]


func _hud_text(c: Vector2, t: String, fs: int, col := Color(0.95, 0.97, 1.0)) -> void:
	var font := ThemeDB.fallback_font
	var sz := font.get_string_size(t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs)
	_hud.draw_string_outline(font, c + Vector2(-sz.x * 0.5, fs * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, 5, Color(0, 0, 0, 0.85))
	_hud.draw_string(font, c + Vector2(-sz.x * 0.5, fs * 0.35), t, HORIZONTAL_ALIGNMENT_CENTER, -1, fs, col)


func _hud_icon(tex: Texture2D, c: Vector2, size: float, col := Color.WHITE) -> void:
	if tex:
		_hud.draw_texture_rect(tex, Rect2(c - Vector2.ONE * size * 0.5, Vector2.ONE * size), false, col)


func _draw_hud() -> void:
	var vs := get_viewport().get_visible_rect().size
	# шапка: имя, здоровье, энергия, вода
	var font0 := ThemeDB.fallback_font
	if _hurt_t > 0.0:
		# удар по герою: красные края экрана (середина остаётся видна — куда бежать)
		var ha := 0.5 * clampf(_hurt_t / 0.35, 0.0, 1.0) * clampf(_hurt_amp, 0.6, 1.2)
		var c0 := Color(0.75, 0.03, 0.02, ha)
		var c1 := Color(0.75, 0.03, 0.02, 0.0)
		var bw := vs.x * 0.16
		var bh := vs.y * 0.2
		_hud.draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(vs.x, 0), Vector2(vs.x - bw, bh), Vector2(bw, bh)]), PackedColorArray([c0, c0, c1, c1]))
		_hud.draw_polygon(PackedVector2Array([Vector2(0, vs.y), Vector2(bw, vs.y - bh), Vector2(vs.x - bw, vs.y - bh), vs]), PackedColorArray([c0, c1, c1, c0]))
		_hud.draw_polygon(PackedVector2Array([Vector2.ZERO, Vector2(bw, bh), Vector2(bw, vs.y - bh), Vector2(0, vs.y)]), PackedColorArray([c0, c1, c1, c0]))
		_hud.draw_polygon(PackedVector2Array([Vector2(vs.x, 0), vs, Vector2(vs.x - bw, vs.y - bh), Vector2(vs.x - bw, bh)]), PackedColorArray([c0, c0, c1, c1]))
	if _dead_t > 0.0:
		_hud.draw_rect(Rect2(Vector2.ZERO, vs), Color(0.1, 0.0, 0.0, 0.6))
		var dt := "Вы погибли"
		var dw := font0.get_string_size(dt, HORIZONTAL_ALIGNMENT_LEFT, -1, 40).x
		_hud.draw_string(font0, Vector2(vs.x * 0.5 - dw * 0.5, vs.y * 0.45), dt, HORIZONTAL_ALIGNMENT_LEFT, -1, 40, Color(1.0, 0.75, 0.6))
	_hud.draw_string_outline(font0, Vector2(18, 30), hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, 6, Color(0, 0, 0, 0.85))
	_hud.draw_string(font0, Vector2(18, 30), hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 20, Color(0.95, 0.97, 1.0))
	# три точки справа от имени — сменить имя
	var dc := _name_dots()
	_hud.draw_circle(dc, 15, Color(0.05, 0.07, 0.09, 0.55))
	_hud.draw_arc(dc, 15, 0, TAU, 28, Color(0.6, 0.85, 1.0, 0.55), 1.5)
	for i in 3:
		_hud.draw_circle(dc + Vector2((i - 1) * 7.0, 0), 2.4, Color(0.92, 0.96, 1.0))
	var bw := 280.0
	_hud.draw_rect(Rect2(16, 40, bw, 10), Color(0, 0, 0, 0.6))
	_hud.draw_rect(Rect2(17, 41, (bw - 2) * clampf(hp / HP_MAX, 0.0, 1.0), 8), Color(0.85, 0.25, 0.22) if hp < 35.0 else Color(0.35, 0.8, 0.3))
	_hud_text(Vector2(16 + bw - 20, 24), "%d" % int(round(hp)), 18, Color(0.75, 1.0, 0.7))
	var sx := 22.0
	for st in [["stat_en", en, Color(1.0, 0.85, 0.35)], ["stat_water", water, Color(0.45, 0.75, 1.0)]]:
		_hud_icon(_stat_tex(st[0]), Vector2(sx + 8, 68), 20, st[2])
		_hud_text(Vector2(sx + 40, 68), "%d" % int(round(float(st[1]))), 15)
		sx += 84.0
	# спораны — валюта
	_hud_icon(_tex("res://assets/icons/loot_spore.png"), Vector2(sx + 8, 68), 24)
	_hud_text(Vector2(sx + 40, 68), "%d" % inv.count("spore"), 15, Color(0.95, 0.95, 0.9))
	# джойстик
	var jc := _joy_o if _joy_id >= 0 else Vector2(160, vs.y - 160)
	_hud.draw_circle(jc, 92, Color(1, 1, 1, 0.07))
	_hud.draw_arc(jc, 92, 0, TAU, 48, Color(0.6, 0.85, 1.0, 0.45), 2.5)
	_hud.draw_circle(jc + _joy_v * 92, 36, Color(0.6, 0.85, 1.0, 0.5 if _joy_id >= 0 else 0.25))
	var it = inv.get(inv.hand) if inv.hand != "" else null
	var d := ULItems.get_def(String(it.id)) if it != null else {}
	for k in HUD_BTNS:
		var c := _hud_pos(k)
		var r: float = HUD_BTNS[k][1]
		var on: bool = _hud_touch.values().has(k)
		var active := true
		match k:
			"take":
				if _target == null:
					continue                               # рядом ничего нет — кнопки нет
			"heal":
				active = hp < HP_MAX and inv.best_heal(int(HP_MAX - hp)) != ""
			"reload":
				active = it != null and d.has("ammo") and int(it.get("mag", 0)) < int(d.mag) and inv.count(String(d.ammo)) > 0
				if it == null or not d.has("ammo"):
					continue                               # без огнестрела кнопки перезарядки нет
		var line := Color(1.0, 0.8, 0.3, 0.95) if (k == "take" and active) else (Color(1.0, 0.5, 0.4, 0.9) if k == "fire" else Color(0.6, 0.85, 1.0, 0.65 if active else 0.25))
		if k == "reload" and active and int(it.get("mag", 0)) <= 0:
			# магазин пуст — кнопка перезарядки зовёт: красная, «дышит»
			line = Color(1.0, 0.35, 0.3, 0.75 + 0.25 * sin(Time.get_ticks_msec() * 0.01))
		_hud.draw_circle(c, r, Color(0.14, 0.32, 0.42, 0.8) if on else Color(0.05, 0.07, 0.09, 0.55 if active else 0.3))
		_hud.draw_arc(c, r, 0, TAU, 44, line, 3.0 if k == "fire" else 2.5)
		var ic := Color(1, 1, 1, 1.0 if active else 0.4)
		match k:
			"fire":
				var g := "fist"
				if it != null:
					g = "weapon" if String(d.kind) == "melee" else "aim"
				_hud_icon(_art(g), c, r * 2.0, ic)
				if it != null and d.has("ammo"):
					var mag := int(it.get("mag", 0))
					_hud_text(c + Vector2(0, r - 16), "%d / %d" % [mag, inv.count(String(d.ammo))], 16, Color(1.0, 0.45, 0.35) if mag == 0 else Color(1.0, 0.9, 0.6))
			"swap":
				# оружие в руках (или нож из набора, если руки пусты) и стрелки смены
				if it != null:
					_hud_icon(ULItems.icon(String(it.id)), c, r * 1.5)
				else:
					_hud_icon(_art("weapon"), c, r * 2.0, Color(1, 1, 1, 0.75))
				_hud_icon(_glyph("swap"), c + Vector2(r * 0.66, -r * 0.66), 30, Color(1.0, 0.85, 0.4))
			"take":
				# рукопожатие — только у жителя, с которым можно говорить и торговать; у ящика и предмета — их значок
				match String(_target.type):
					"npc":
						_hud_icon(_art("use"), c, r * 2.0, ic)
					"crate", "box", "chest":
						_hud_icon(_tex("res://assets/icons/crate.png"), c, r * 1.5, ic)
					"corpse":
						_hud_icon(_tex("res://assets/icons/loot_spore.png"), c, r * 1.4, ic)
					"terminal":
						_hud_icon(_art("terminal"), c, r * 2.0, ic)
					_:
						var tid := String(_target.g.item.id)
						_hud_icon(ULItems.icon(tid), c, r * 1.5, ULItems.tint(tid))
				_hud_text(c + Vector2(0, r - 10), _action_label(), 14, Color(1.0, 0.88, 0.55))
			"heal":
				_hud_icon(_art("heal"), c, r * 2.0, ic)
				var n := inv.count("bandage") + inv.count("medkit")
				_hud_text(c + Vector2(r * 0.72, r * 0.72), str(n), 15)
			"reload":
				_hud_icon(_glyph("reload"), c, 46, ic)
			"inv":
				_hud_icon(_art("bag"), c, r * 2.0, ic)
			"build":
				_hud_icon(_art("build"), c, r * 2.0, ic)
			"menu":
				_hud_icon(_art("menu"), c, r * 2.0, ic)
		_hud.draw_arc(c, r, 0, TAU, 44, line, 3.0 if k == "fire" else 2.5)
	_cs_hud(vs, font0)
	if _leave_t > 0.0:
		var lt := "Вы покидаете локацию: %d" % int(ceil(maxf(LEAVE_S - _leave_t, 0.0)))
		var lw := font0.get_string_size(lt, HORIZONTAL_ALIGNMENT_LEFT, -1, 30).x
		_hud.draw_rect(Rect2(vs.x * 0.5 - lw * 0.5 - 22, 112, lw + 44, 78), Color(0.05, 0.03, 0.02, 0.72))
		_hud.draw_string(font0, Vector2(vs.x * 0.5 - lw * 0.5, 148), lt, HORIZONTAL_ALIGNMENT_LEFT, -1, 30, Color(1.0, 0.7, 0.3))
		var l2 := "вернитесь на локацию, чтобы остаться"
		var lw2 := font0.get_string_size(l2, HORIZONTAL_ALIGNMENT_LEFT, -1, 16).x
		_hud.draw_string(font0, Vector2(vs.x * 0.5 - lw2 * 0.5, 176), l2, HORIZONTAL_ALIGNMENT_LEFT, -1, 16, Color(0.9, 0.88, 0.8))
	# название того, что можно взять, — над кнопкой «взять»
	if _target != null:
		_hud_text(_hud_pos("take") + Vector2(0, -66), _target_name(), 14, Color(1.0, 0.88, 0.55))


func _hud_hit(p: Vector2) -> String:
	for k in HUD_BTNS:
		if k == "take" and _target == null:
			continue
		if p.distance_to(_hud_pos(k)) <= float(HUD_BTNS[k][1]) + 8.0:
			return k
	if p.distance_to(_name_dots()) <= 26.0 or Rect2(10, 4, _name_dots().x + 8, 34).has_point(p):
		return "name"
	# нажатие прямо на подсвеченный предмет — «взять»
	if _target != null and cam != null:
		var at: Vector3 = _target_pos() + Vector3.UP * 0.3
		var xf := get_viewport().get_final_transform()
		if not cam.is_position_behind(at) and cam.unproject_position(at).distance_to(xf * p) <= 70.0 * xf.get_scale().x:
			return "take"
	return ""


func _hud_press(k: String) -> void:
	match k:
		"fire":
			_atk_want = 0.0 if _try_attack() else 0.4
		"take":
			do_action()
		"inv":
			open_inventory()
		"swap":
			cycle_weapon()
		"heal":
			heal()
		"reload":
			reload_weapon()
		"build":
			if temp():
				say("Во временном кластере ящик не поставить — он исчезнет вместе с кластером")
			else:
				place_crate()
				say("Поставлен ящик")
		"menu":
			_menu_bar.visible = not _menu_bar.visible
		"name":
			open_name_panel()


## касания: кнопки справа (каждый палец отдельно — можно бежать и стрелять), джойстик слева, два пальца — масштаб
func _input(e: InputEvent) -> void:
	if _modal():
		return
	var vs := get_viewport().get_visible_rect().size
	if e is InputEventScreenTouch:
		var t := e as InputEventScreenTouch
		if t.pressed:
			var k := _hud_hit(t.position)
			if k != "":
				_hud_touch[t.index] = k
				_hud_press(k)
				get_viewport().set_input_as_handled()
				return
			_touch[t.index] = t.position
			if t.position.x < vs.x * 0.5 and _joy_id < 0:
				_joy_id = t.index
				_joy_o = t.position
				_joy_v = Vector2.ZERO
		else:
			_hud_touch.erase(t.index)
			_touch.erase(t.index)
			if t.index == _joy_id:
				_joy_id = -1
				_joy_v = Vector2.ZERO
			_pinch = 0.0
	elif e is InputEventScreenDrag:
		var d := e as InputEventScreenDrag
		if _hud_touch.has(d.index):
			return
		_touch[d.index] = d.position
		if d.index == _joy_id:
			# центр джойстика подтягивается за пальцем: развернуться можно коротким движением
			var off := d.position - _joy_o
			if off.length() > 112.0:
				_joy_o = d.position - off.normalized() * 112.0
			_joy_v = ((d.position - _joy_o) / 92.0).limit_length(1.0)
		elif _touch.size() >= 2 and _joy_id < 0:
			var ks := _touch.keys()
			var dd := (_touch[ks[0]] as Vector2).distance_to(_touch[ks[1]])
			if _pinch > 0.0:
				cam_dist = clampf(cam_dist * _pinch / dd, 10.0, 22.0)
			_pinch = dd
	elif e is InputEventMouseButton:
		var mb := e as InputEventMouseButton
		if mb.button_index == MOUSE_BUTTON_WHEEL_UP:
			cam_dist = maxf(10.0, cam_dist * 0.92)
		elif mb.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			cam_dist = minf(22.0, cam_dist * 1.08)
	elif e is InputEventKey and (e as InputEventKey).pressed and not (e as InputEventKey).echo:
		match (e as InputEventKey).physical_keycode:
			KEY_E:
				do_action()
			KEY_I, KEY_TAB:
				open_inventory()
			KEY_Q:
				cycle_weapon()
			KEY_R:
				reload_weapon()
			KEY_H:
				heal()
			KEY_SPACE:
				_atk_want = 0.0 if _try_attack() else 0.4


# ---------------- бой: огонь, мачете, кулаки ----------------

const HP_MAX := 100.0
var hp := 65.0
var en := 100.0                   ## энергия: тратится на быстром беге, восстанавливается на шаге и стоя
var water := 100.0                ## вода: медленно убывает, восполняется питьём; без воды энергия не восстанавливается
var _tired := false
var targets: Array = []           ## мишени-чучела: StaticBody3D с meta hp
var _atk_cd := 0.0
var _aim_t := 99.0
var _punch_i := 0
var _reloading := false
var _heal_cd := 0.0
var _face := NAN                  ## куда довернуть героя (атака по цели)
var _atk_want := 0.0              ## нажатие атаки ждёт своей очереди (с)
var _mark: MeshInstance3D         ## красная метка под целью
var _mark_t = null
var _flash: MeshInstance3D        ## вспышка у ствола: светящееся пятно (не источник света — тот дорог для телефона)
var _dmg_lb := {}                 ## мишень → [надпись урона, сумма, когда появилась]: частые попадания складываются в одну
var _hit_snd_t := 0.0
var _case_i := 0
var shots := 0                    ## для проверки
var hits := 0


func _hand_item():
	return inv.get(inv.hand) if inv.hand != "" else null


## кнопка атаки: огнестрел — выстрел (очередь, пока держим, у автоматического), мачете — удар, пусто — кулаки
func attack() -> void:
	if _atk_cd > 0.0 or _modal():
		return
	var it = _hand_item()
	if it == null:
		_punch()
		return
	var d := ULItems.get_def(String(it.id))
	if rig.hold.wid == "" or rig.hold.drawn < 0.99:
		return                                             # ещё достаёт
	if ULItems.broken(it):
		snd.play("dry", player.global_position + Vector3.UP * 1.3, -4.0)
		say("%s сломан — нужен ремонт у оружейника" % String(d.n))
		_atk_cd = 0.9
		_atk_want = 0.0
		return
	if String(d.kind) == "melee":
		_slash(d)
		_use_up(it)
		return
	if _reloading or rig.hold.busy():
		return
	if int(it.get("mag", 0)) <= 0:
		if inv.count(String(d.ammo)) > 0:
			reload_weapon()
		else:
			snd.play("dry", player.global_position + Vector3.UP * 1.3, -4.0)
			say("Нет патронов: " + ULItems.get_def(String(d.ammo)).n)
			_atk_cd = 0.9
		return
	_shoot(it, d)


## атака, если она сейчас возможна; true — действие началось
func _try_attack() -> bool:
	if _atk_cd > 0.0:
		return false
	attack()
	return _atk_cd > 0.0


## ближайшая живая мишень в пределах max_d и в секторе cone_deg перед героем (180 — вокруг);
## los — только те, что видно (между героем и мишенью нет стены или забора)
func _nearest_target(max_d: float, cone_deg: float, los := false):
	# сначала — враги; манекен и чучела — только когда врагов в досягаемости нет (раньше автоприцел брал
	# ближайшее чучело, а враг за ним оставался без огня)
	var en = _nearest_of(max_d, cone_deg, los, true)
	return en if en != null else _nearest_of(max_d, cone_deg, los, false)


func _nearest_of(max_d: float, cone_deg: float, los: bool, foes: bool):
	var best = null
	var bd := max_d
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	for t in targets:
		if (t is ULEnemy) != foes or float(t.get_meta("hp")) <= 0.0:
			continue
		var v: Vector3 = t.global_position - player.global_position
		if absf(v.y) > 1.6:
			continue                                    # другой этаж
		v.y = 0
		var dist := v.length()
		if dist < bd and dist > 0.05 and rad_to_deg(f.angle_to(v / dist)) <= cone_deg and (not los or _sees(t)):
			bd = dist
			best = t
	return best


func _sees(t: Node3D) -> bool:
	var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 1.35, t.global_position + Vector3.UP * 1.2)
	q.exclude = [player.get_rid()]
	var hit := get_world_3d().direct_space_state.intersect_ray(q)
	return hit.is_empty() or hit.collider == t


## цель, по которой пришёлся бы удар или выстрел сейчас: кулаки и мачете — вплотную, огнестрел — в пределах
## дальности оружия. Герой сам поворачивается к ней, под целью — красная метка
func _attack_target():
	var it = _hand_item()
	if it == null:
		return _nearest_target(1.7, 180.0)
	var d := ULItems.get_def(String(it.id))
	if String(d.kind) == "melee":
		return _nearest_target(2.1, 180.0)
	return _nearest_target(float(d.get("range", 28.0)), 180.0, true)


func _aim_at(t) -> void:
	if t != null:
		var v: Vector3 = t.global_position - player.global_position
		_face = atan2(v.x, v.z)


func _punch() -> void:
	var t = _nearest_target(1.7, 180.0)
	_aim_at(t)
	var heavy := _punch_i % 3 == 2
	_punch_i += 1
	var len_s := rig.play("punch_heavy" if heavy else "punch_light", 1.3)
	_atk_cd = len_s * 0.85
	var c := player.global_position + Vector3.UP * 1.3
	snd.play("swoosh", c, -5.0, 0.08, len_s * 0.2)
	get_tree().create_timer(len_s * 0.36).timeout.connect(_melee_hit.bind(1.7, 100.0, 14.0 if heavy else 8.0, "punch"))


func _slash(d: Dictionary) -> void:
	var t = _nearest_target(2.1, 180.0)
	_aim_at(t)
	var len_s := rig.hold.swing("light")
	_atk_cd = len_s
	snd.play("swing", player.global_position + Vector3.UP * 1.3, -3.0, 0.08, len_s * 0.42)
	get_tree().create_timer(len_s * 0.5).timeout.connect(_melee_hit.bind(2.1, 100.0, float(d.dmg), "hit_wood"))


func _melee_hit(range_m: float, cone: float, dmg: float, sound: String) -> void:
	var t = _nearest_target(range_m, cone)
	if t != null:
		snd.play(sound, t.global_position + Vector3.UP * 1.2, -2.0, 0.08)
		_damage(t, dmg, t.global_position + Vector3.UP * 1.3)


## Износ: каждый выстрел и каждый удар холодным оружием снимает единицу прочности (ТТ — 300 выстрелов, автомат —
## 1000, мачете — 400 ударов; data — ULItems). Осталось 10 % — предупреждение; на нуле оружие сломано: остаётся в
## слоте, но не стреляет и не рубит, пока его не починит оружейник («Торговать» → «Ремонт»). Сколько осталось —
## полоска на ячейке и надпись на карточке в инвентаре.
func _use_up(it: Dictionary) -> void:
	if not it.has("dur") or int(it.dur) <= 0:
		return
	it.dur = int(it.dur) - 1
	var d := ULItems.get_def(String(it.id))
	var mx := int(d.get("dur", 1))
	if int(it.dur) == mx / 10:
		say("%s изношен: осталось %d %s — почините у оружейника" % [String(d.n), int(it.dur), "ударов" if String(d.kind) == "melee" else "выстрелов"])
	if int(it.dur) > 0:
		return
	_atk_want = 0.0
	snd.play("dry", player.global_position + Vector3.UP * 1.3, -2.0)
	say("Сломалось: %s. Почините у оружейника" % String(d.n))
	_save()


## Починить оружие у оружейника до полной прочности: цена — ULItems.repair_cost (спораны); false — не хватило
func repair(it: Dictionary) -> bool:
	var cost := ULItems.repair_cost(it)
	if cost <= 0:
		return false
	var price := {"spore": cost}
	if not inv.can_pay(price):
		say("Не хватает ресурсов: " + price_text(price))
		return false
	inv.pay(price)
	it.dur = int(ULItems.get_def(String(it.id)).get("dur", 1))
	say("Починено: %s" % String(ULItems.get_def(String(it.id)).n))
	_apply_gear()
	_shop_refresh()
	_save()
	return true


## оружие героя, которому нужен ремонт: в слотах, в карманах и в рюкзаке
func repair_list() -> Array:
	var out: Array = []
	var all: Array = [inv.primary, inv.pistol] + inv.pockets
	if inv.pack != null:
		all += inv.pack.get("items", [])
	for it in all:
		if it != null and ULItems.repair_cost(it) > 0:
			out.append(it)
	return out


func _shoot(it: Dictionary, d: Dictionary) -> void:
	var wcfg: Dictionary = rig.hold.w
	if not lvl:
		it.mag = int(it.mag) - 1                # в тесте уровня патроны не кончаются
	shots += 1
	_atk_cd = minf(_atk_cd, 0.0) + 1.0 / float(d.rate)    # остаток прошлого кадра идёт в зачёт (темп не зависит от FPS)
	_aim_t = 0.0
	rig.hold.set_stance("aim")
	var t = _nearest_target(float(d.get("range", 28.0)), 180.0, true)
	if t == null:
		_why_no_target(float(d.get("range", 28.0)))
	_aim_at(t)
	var f := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
	var from := player.global_position + Vector3.UP * 1.35 + f * 0.5
	var mz := rig.hold.muzzle_world()
	var vis_from: Vector3 = mz[0] if not mz.is_empty() else from
	if t != null:
		f = ((t.global_position + Vector3.UP * 1.2) - from).normalized()
	rig.hold.fire()
	for e in enemies:
		e.hear(player.global_position)          # выстрел слышат враги поблизости
	var sd: Dictionary = wcfg.get("sound", {})
	snd.play(String(sd.get("shot", "shot_ak")), vis_from, float(sd.get("db", 0.0)), 0.04)
	_case_i += 1
	if not bool(d.get("auto", false)) or _case_i % 3 == 0:
		snd.play(String(sd.get("case", "casing")), player.global_position + Vector3(0.5, 0.05, 0), -12.0, 0.1, randf_range(0.4, 0.6))
	var fc: Dictionary = wcfg.get("fire", {})
	var pellets := int(fc.get("pellets", 1))
	var spread := deg_to_rad(float(fc.get("spread", 0.6 if pellets == 1 else 2.2)))
	var space := get_world_3d().direct_space_state
	var reach := float(d.get("range", 28.0)) + 12.0
	for i in pellets:
		var dir := (f + Vector3(randf_range(-1, 1), randf_range(-0.4, 0.4), randf_range(-1, 1)) * tan(spread)).normalized()
		var q := PhysicsRayQueryParameters3D.create(from, from + dir * reach)
		q.exclude = [player.get_rid()]
		var hit := space.intersect_ray(q)
		# пуля летит от дульного среза по прямой до того, во что попадёт (без баллистики); урон — когда долетит
		var end: Vector3 = hit.position if not hit.is_empty() else from + dir * reach
		var col: Object = hit.collider if not hit.is_empty() else null
		_fly_bullet(String(d.ammo), vis_from, end, col, float(d.dmg) / pellets)
	# вспышка у ствола
	_flash.global_position = vis_from + f * 0.12
	_flash.visible = true
	_flash.scale = Vector3.ONE * randf_range(0.8, 1.15)
	_flash_t = 0.05
	_use_up(it)


## Огонь без цели: если враг на экране есть, но прицел его не взял — сказать почему (не чаще раза в 2.5 с)
var _why_t := 0.0


func _why_no_target(rng: float) -> void:
	var now := Time.get_ticks_msec() * 0.001
	if now - _why_t < 2.5:
		return
	var best: ULEnemy = null
	var bd := 1e9
	for e in enemies:
		if e.alive() and cam.is_position_in_frustum(e.global_position + Vector3.UP):
			var dd := e.global_position.distance_to(player.global_position)
			if dd < bd:
				bd = dd
				best = e
	if best == null:
		return
	_why_t = now
	if bd > rng:
		say("Далеко: %d м — оружие бьёт на %d м. Подойдите ближе" % [int(round(bd)), int(rng)])
	elif not _sees(best):
		say("Цель за укрытием — нет линии огня")


## Круг дальности: тонкое кольцо на земле вокруг героя радиусом дальности оружия в руках (виден, когда камера
## отдалена: на обычном приближении край экрана — около 10 м вбок и 7 м вперёд)
var _range_ring: MeshInstance3D


func _range_ring_tick(delta: float) -> void:
	if _range_ring == null:
		_range_ring = MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.985
		tm.outer_radius = 1.0
		tm.rings = 96
		tm.ring_segments = 3
		_range_ring.mesh = tm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(1.0, 0.9, 0.6, 0.0)
		m.no_depth_test = true
		_range_ring.material_override = m
		_range_ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(_range_ring)
	var it = _hand_item()
	var rng := 0.0
	if it != null and rig.hold.drawn > 0.5:
		rng = float(ULItems.get_def(String(it.id)).get("range", 0.0))
	var m: StandardMaterial3D = _range_ring.material_override
	var want := (0.32 if aiming else 0.14) if rng > 0.0 else 0.0
	m.albedo_color.a = move_toward(m.albedo_color.a, want, delta * 1.5)
	_range_ring.visible = m.albedo_color.a > 0.005
	if rng > 0.0:
		_range_ring.scale = Vector3(rng, 0.02, rng)
	_range_ring.global_position = player.global_position + Vector3.UP * 0.05


## Пули. Вид — по патрону: длина и толщина (м; крупнее настоящих, иначе сверху не разглядеть), цвет оболочки,
## остроносая или тупоносая; у дробовика — дробины.
const BULLETS := {
	"a762x25": [0.3, 0.075, Color(0.8, 0.5, 0.26), false],
	"a9x19": [0.28, 0.088, Color(0.85, 0.56, 0.3), false],
	"a545": [0.42, 0.066, Color(0.88, 0.56, 0.3), true],
	"a762x51": [0.5, 0.082, Color(0.84, 0.52, 0.28), true],
	"a762x54": [0.52, 0.082, Color(0.62, 0.62, 0.66), true],
	"a9x39": [0.44, 0.094, Color(0.42, 0.43, 0.46), false],
	"a12": [0.085, 0.085, Color(0.5, 0.5, 0.54), false],
}
const BULLET_SPEED := 62.0        ## м/с: медленнее настоящей — чтобы полёт был виден
var _flash_t := 0.0
var bullet_k := 1.0               ## множитель скорости пуль (для снимков в проверке — замедление)
var _bullet_mesh := {}
var _bullet_free := {}            ## патрон → свободные узлы
var _bullets: Array = []          ## летящие: {n, a, b, t, dur, col, dmg, id}


func _bullet_shape(id: String) -> ArrayMesh:
	if _bullet_mesh.has(id):
		return _bullet_mesh[id]
	var bd: Array = BULLETS.get(id, BULLETS["a545"])
	var L: float = bd[0]
	var R: float = float(bd[1]) * 0.5
	# тело вращения вдоль −z (нос вперёд): донце, цилиндр, оживало
	var prof: Array = [[0.5, 0.0], [0.5, 0.86], [0.42, 1.0], [-0.08, 1.0]]
	if id == "a12":
		prof = [[0.5, 0.0], [0.35, 0.7], [0.0, 1.0], [-0.35, 0.7], [-0.5, 0.0]]
	elif bool(bd[3]):
		prof += [[-0.28, 0.72], [-0.42, 0.36], [-0.5, 0.06]]
	else:
		prof += [[-0.3, 0.92], [-0.42, 0.66], [-0.5, 0.2]]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var seg := 8
	for i in prof.size() - 1:
		for k in seg:
			var a0 := TAU * k / seg
			var a1 := TAU * (k + 1) / seg
			var p: Array = []
			for pr in [prof[i], prof[i + 1]]:
				for an in [a0, a1]:
					p.append(Vector3(cos(an) * R * float(pr[1]), sin(an) * R * float(pr[1]), float(pr[0]) * L))
			for idx in [0, 2, 1, 1, 2, 3]:
				var v: Vector3 = p[idx]
				st.set_normal(Vector3(v.x, v.y, 0.0).normalized() if Vector2(v.x, v.y).length() > 0.0001 else Vector3(0, 0, signf(v.z)))
				st.add_vertex(v)
	var m := StandardMaterial3D.new()
	m.albedo_color = bd[2]
	m.metallic = 0.7
	m.roughness = 0.35
	m.emission_enabled = true
	m.emission = bd[2]                                     # оболочка блестит своим цветом (медь, сталь) — не белым
	m.emission_energy_multiplier = 0.55
	st.set_material(m)
	_bullet_mesh[id] = st.commit()
	return _bullet_mesh[id]


func _fly_bullet(id: String, a: Vector3, b: Vector3, col: Object, dmg: float, foe := false) -> void:
	var pool: Array = _bullet_free.get(id, [])
	_bullet_free[id] = pool
	var n: MeshInstance3D
	if pool.is_empty():
		n = MeshInstance3D.new()
		n.mesh = _bullet_shape(id)
		n.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(n)
	else:
		n = pool.pop_back()
	n.visible = true
	n.global_position = a
	if a.distance_to(b) > 0.05:
		n.look_at(b, Vector3.UP if absf((b - a).normalized().y) < 0.98 else Vector3.RIGHT)
	_bullets.append({"n": n, "a": a, "b": b, "t": 0.0, "dur": maxf(a.distance_to(b) / (BULLET_SPEED * bullet_k), 0.02), "col": col, "dmg": dmg, "id": id, "foe": foe})


## полёт пуль: каждая летит по прямой; долетела — урон и звук попадания
func _bullets_tick(delta: float) -> void:
	_hit_snd_t = maxf(0.0, _hit_snd_t - delta)
	if _flash_t > 0.0:
		_flash_t -= delta
		if _flash_t <= 0.0:
			_flash.visible = false
	var i := 0
	while i < _bullets.size():
		var bl: Dictionary = _bullets[i]
		bl.t = float(bl.t) + delta
		var k := float(bl.t) / float(bl.dur)
		var n: MeshInstance3D = bl.n
		if k < 1.0:
			n.global_position = (bl.a as Vector3).lerp(bl.b, k)
			i += 1
			continue
		n.visible = false
		(_bullet_free[bl.id] as Array).append(n)
		var col = bl.col
		if bool(bl.get("foe", false)):
			# пуля мура: попала в героя — урон (отталкивает от стрелявшего); в стену — звук
			if col == player and float(bl.dmg) > 0.0:
				hurt(float(bl.dmg), bl.a)
				mur_hits += 1
			elif col != null and _hit_snd_t <= 0.0:
				snd.play("hit_wood", bl.b, -10.0, 0.1)
				_hit_snd_t = 0.12
			_bullets.remove_at(i)
			continue
		if col != null and is_instance_valid(col):
			if col.has_meta("hp"):
				hits += 1
				_damage(col, float(bl.dmg), bl.b)
			if _hit_snd_t <= 0.0:
				snd.play("hit_wood", bl.b, -8.0, 0.1)          # не чаще восьми раз в секунду
				_hit_snd_t = 0.12
		_bullets.remove_at(i)


func reload_weapon() -> void:
	var it = _hand_item()
	if it == null or _reloading:
		return
	var d := ULItems.get_def(String(it.id))
	if not d.has("ammo") or rig.hold.wid == "" or rig.hold.drawn < 0.99:
		return
	if int(it.get("mag", 0)) >= int(d.mag):
		return
	if inv.count(String(d.ammo)) <= 0:
		say("Нет патронов: " + ULItems.get_def(String(d.ammo)).n)
		return
	_reloading = true
	rig.hold.set_stance("ready")
	var t := rig.hold.reload()
	get_tree().create_timer(t * 0.8).timeout.connect(func():
		_reloading = false
		if _hand_item() == it:
			it.mag = int(it.get("mag", 0)) + inv.consume(String(d.ammo), int(d.mag) - int(it.get("mag", 0)))
			_save())


## кнопка лечения (id пусто): лучшее из того, что есть — аптечка при большой потере, иначе бинт, потом еда.
## С id — использовать этот предмет (еда и вода из инвентаря): здоровье и вода по описанию предмета.
func heal(id := "") -> bool:
	if _heal_cd > 0.0:
		return false
	var auto := id == ""
	if auto:
		if hp >= HP_MAX:
			say("Здоровье полное")
			return false
		id = inv.best_heal(int(HP_MAX - hp))
	if id == "" or inv.count(id) <= 0:
		say("Нечем лечиться")
		return false
	var d := ULItems.get_def(id)
	var dh := float(d.get("heal", 0))
	var dw := float(d.get("water", 0))
	var de := float(d.get("energy", 0))
	if (dh <= 0.0 or hp >= HP_MAX) and (dw <= 0.0 or water >= 100.0) and (de <= 0.0 or en >= 100.0):
		say("Сейчас не нужно")
		return false
	inv.consume(id, 1)
	hp = minf(HP_MAX, hp + dh)
	water = minf(100.0, water + dw)
	en = minf(100.0, en + de)
	_heal_cd = 0.8
	snd.play("cloth", player.global_position + Vector3.UP * 1.2, -5.0)
	say("%s: здоровье %d, энергия %d, вода %d" % [d.n, int(round(hp)), int(round(en)), int(round(water))])
	_save()
	return true


## урон по мишени: цифра над ней, качание; на нуле падает и через 6 с встаёт
func _damage(t: Node3D, dmg: float, at: Vector3) -> void:
	var left := maxf(0.0, float(t.get_meta("hp")) - dmg)
	if t is ULEnemy:
		(t as ULEnemy).damage(dmg, player.global_position)
	else:
		t.set_meta("hp", left)
	# цифра урона: попадания по той же мишени чаще трёх раз в секунду складываются в одну надпись
	# (очередь из пулемёта — это одна растущая цифра, а не десять надписей в секунду)
	var now_s := Time.get_ticks_msec() * 0.001
	var rec: Array = _dmg_lb.get(t, [])
	if not rec.is_empty() and is_instance_valid(rec[0]) and now_s - float(rec[2]) < 0.35:
		rec[1] = float(rec[1]) + dmg
		(rec[0] as Label3D).text = "−%d" % int(round(float(rec[1])))
	else:
		var lb := Label3D.new()
		lb.text = "−%d" % int(round(dmg))
		lb.font_size = 56
		lb.pixel_size = 0.006
		lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lb.no_depth_test = true
		lb.modulate = Color(1.0, 0.85, 0.3)
		lb.outline_size = 10
		add_child(lb)
		lb.global_position = at + Vector3(randf_range(-0.2, 0.2), 0.4, 0)
		var tw := create_tween()
		tw.tween_property(lb, "global_position", lb.global_position + Vector3.UP * 0.9, 0.7)
		tw.parallel().tween_property(lb, "modulate:a", 0.0, 0.7)
		tw.tween_callback(lb.queue_free)
		_dmg_lb[t] = [lb, dmg, now_s]
	if t is ULEnemy:
		# кровь из раны — в сторону выстрела или удара
		var bd := t.global_position - player.global_position
		bd.y = 0.0
		_blood(at, bd.normalized() if bd.length() > 0.01 else Vector3.FORWARD, int(clampf(dmg * 0.6, 6.0, 18.0)))
		return                                  # враг сам отыгрывает попадание и гибель
	var vis: Node3D = t.get_node("Vis")
	var tw2 := create_tween()
	if t.has_meta("dummy"):
		# манекен не падает; над ним — урон серии и урон в секунду (серия кончается после 2.5 с без попаданий)
		var now := Time.get_ticks_msec() * 0.001
		if now - _dps_last > 2.5:
			_dps_sum = 0.0
			_dps_t0 = now
		_dps_sum += dmg
		_dps_last = now
		var span := maxf(now - _dps_t0, 0.5)
		(t.get_node("Info") as Label3D).text = "Манекен · серия %d · в секунду %d" % [int(round(_dps_sum)), int(round(_dps_sum / span))]
		if left <= 0.0:
			t.set_meta("hp", float(t.get_meta("hp_max")))
		tw2.tween_property(vis, "rotation:x", -0.12, 0.05)
		tw2.tween_property(vis, "rotation:x", 0.0, 0.22)
	elif left <= 0.0:
		tw2.tween_property(vis, "rotation:x", -1.45, 0.35)
		snd.play("body_fall", t.global_position, -4.0, 0.05, 0.25)
		get_tree().create_timer(6.0).timeout.connect(func():
			if is_instance_valid(t):
				t.set_meta("hp", float(t.get_meta("hp_max")))
				create_tween().tween_property(vis, "rotation:x", 0.0, 0.5))
	else:
		tw2.tween_property(vis, "rotation:x", -0.16, 0.06)
		tw2.tween_property(vis, "rotation:x", 0.0, 0.25)


## Манекен у базы: фигура в рост человека из мешковины на стойке — на нём пробуют оружие. Не падает: запас
## прочности восстанавливается сам. Над головой — урон последней серии и урон в секунду.
func _add_mannequin(p: Vector3, yaw: float) -> void:
	var body := StaticBody3D.new()
	body.name = "Mannequin"
	add_child(body)
	body.position = p
	body.rotation.y = yaw
	body.set_meta("hp", 500.0)
	body.set_meta("hp_max", 500.0)
	body.set_meta("dummy", true)
	var wood := ULHouse._mat(TEX + "weathered_brown_planks", 1.0)
	var sack := StandardMaterial3D.new()
	sack.albedo_color = Color(0.64, 0.54, 0.38)
	sack.roughness = 1.0
	# крестовина стоит на земле, фигура с шестом качается от попаданий
	for it in [[Vector3(1.0, 0.08, 0.14), Vector3(0, 0.04, -0.12)], [Vector3(0.14, 0.08, 1.0), Vector3(0, 0.04, -0.12)]]:
		var bmi := MeshInstance3D.new()
		var bb := BoxMesh.new()
		bb.size = it[0]
		bmi.mesh = bb
		bmi.material_override = wood
		bmi.position = it[1]
		body.add_child(bmi)
	var vis := Node3D.new()
	vis.name = "Vis"
	body.add_child(vis)
	var pole := MeshInstance3D.new()
	var pb := BoxMesh.new()
	pb.size = Vector3(0.07, 1.55, 0.07)
	pole.mesh = pb
	pole.material_override = wood
	pole.position = Vector3(0, 0.78, -0.16)
	vis.add_child(pole)
	var path := "res://assets/models/hero.glb"
	if ResourceLoader.exists(path) and rig != null:
		# та же фигура, что у героя, в позе покоя — целиком из мешковины
		var m: Node3D = (load(path) as PackedScene).instantiate()
		vis.add_child(m)
		m.scale = rig.model.scale
		m.position = rig.model.position
		m.rotation.y = rig.model.rotation.y
		for mi in m.find_children("*", "MeshInstance3D", true, false):
			(mi as MeshInstance3D).material_override = sack
		for old in m.find_children("*", "AnimationPlayer", true, false):
			(old as AnimationPlayer).active = false
	var lb := Label3D.new()
	lb.name = "Info"
	lb.text = "Манекен"
	lb.font_size = 40
	lb.pixel_size = 0.006
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.no_depth_test = true
	lb.modulate = Color(0.95, 0.95, 0.9)
	lb.outline_size = 10
	lb.position = Vector3(0, 2.25, 0)
	body.add_child(lb)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.4, 1.4)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	body.add_child(blob)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	body.add_child(cs)
	targets.append(body)


var _dps_sum := 0.0               ## манекен: урон текущей серии
var _dps_t0 := 0.0                ## когда серия началась (с)
var _dps_last := -99.0            ## последнее попадание (с)


## мишень-чучело: столб, перекладина, мешок-туловище и «голова»
func _add_target(p: Vector3) -> void:
	var body := StaticBody3D.new()
	body.name = "Target"
	add_child(body)
	body.position = p
	body.set_meta("hp", 150.0)
	body.set_meta("hp_max", 150.0)
	var vis := Node3D.new()
	vis.name = "Vis"
	body.add_child(vis)
	var wood := ULHouse._mat(TEX + "weathered_brown_planks", 1.0)
	var sack := StandardMaterial3D.new()
	sack.albedo_color = Color(0.62, 0.52, 0.36)
	sack.roughness = 1.0
	for it in [[Vector3(0.1, 1.9, 0.1), Vector3(0, 0.95, 0), wood], [Vector3(0.9, 0.08, 0.08), Vector3(0, 1.4, 0), wood], [Vector3(0.5, 0.75, 0.28), Vector3(0, 1.1, 0), sack]]:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = it[0]
		mi.mesh = bm
		mi.material_override = it[2]
		mi.position = it[1]
		vis.add_child(mi)
	var head := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 0.17
	sm.height = 0.36
	head.mesh = sm
	head.material_override = sack
	head.position = Vector3(0, 1.7, 0)
	vis.add_child(head)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.2, 1.2)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	body.add_child(blob)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.6, 1.9, 0.35)
	cs.shape = bs
	cs.position.y = 0.95
	body.add_child(cs)
	targets.append(body)


func _combat_setup() -> void:
	_flash = MeshInstance3D.new()
	var fq := QuadMesh.new()
	fq.size = Vector2(0.42, 0.42)
	_flash.mesh = fq
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fm.albedo_texture = _blob_tex()
	fm.albedo_color = Color(1.0, 0.72, 0.35)
	fm.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_flash.material_override = fm
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_flash.visible = false
	add_child(_flash)
	_mark = MeshInstance3D.new()
	var ring := TorusMesh.new()
	ring.inner_radius = 0.5
	ring.outer_radius = 0.58
	ring.rings = 28
	ring.ring_segments = 4
	_mark.mesh = ring
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.albedo_color = Color(1.0, 0.25, 0.2, 0.85)
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	_mark.material_override = rm
	_mark.scale.y = 0.2
	_mark.visible = false
	add_child(_mark)
	if arena:
		_add_mannequin(Vector3(3.9, 0, -3.9), -0.6)
		return
	if temp():
		return
	# манекен у базы (во дворе справа от крыльца) и две мишени в поле — на 12 и 25 м от калитки
	_add_mannequin(HOUSE_AT + Vector3(7.2, 0, 7.0), -0.5)
	_add_target(Vector3(-7.0, 0, 9.0))
	_add_target(Vector3(9.0, 0, 22.0))


## каждый кадр: задержки, очередь при удержании, возврат из прицела, доворот к цели
func _combat_tick(delta: float) -> void:
	_atk_cd -= delta                        # в этом кадре может уйти в минус: очередь не теряет выстрелы при низком FPS
	_heal_cd = maxf(0.0, _heal_cd - delta)
	_aim_t += delta
	if not (rig.hold.wid != "" and rig.hold.drawn < 0.99):
		_atk_want = maxf(0.0, _atk_want - delta)         # пока оружие достаётся, нажатие ждёт
	# кнопка удержана — атака повторяется в темпе оружия (и кулаки, и мачете, и одиночный огонь); нажатие чуть
	# раньше срока (оружие ещё достаётся, не кончился прошлый удар) не теряется — сработает, как только можно
	var held: bool = _hud_touch.values().has("fire") or Input.is_physical_key_pressed(KEY_SPACE)
	# Кнопка удержана — оружие стреляет подряд в своём темпе, пока в магазине есть патроны: автомат — очередью,
	# пистолет и дробовик — выстрел за выстрелом. Отпустили — огонь прекращается. Магазин пуст — стрельбы нет,
	# пока не перезарядить (кнопка перезарядки рядом). Кулаки и мачете при удержании бьют подряд.
	var hi = _hand_item()
	var hd := ULItems.get_def(String(hi.id)) if hi != null else {}
	# очередь в темпе оружия, а не кадров: при редких кадрах за кадр уходит несколько выстрелов (не больше трёх)
	for k in 3:
		var repeat: bool = hi == null or String(hd.get("kind", "")) == "melee" or int(hi.get("mag", 0)) > 0
		if not (((held and repeat) or _atk_want > 0.0) and not _modal() and _atk_cd <= 0.0):
			break
		var cd0 := _atk_cd
		attack()
		if _atk_cd == cd0:
			break
		_atk_want = 0.0
	_atk_cd = maxf(_atk_cd, 0.0)
	_bullets_tick(delta)
	# метка под целью
	if Engine.get_process_frames() % 4 == 0:
		_mark_t = _attack_target()
	if _mark:
		_mark.visible = false                   # красный круг под целью не рисуется (цель выбирается как прежде)
		if _mark.visible:
			_mark.global_position = (_mark_t as Node3D).global_position + Vector3.UP * 0.05
			_mark.scale = Vector3.ONE * (1.0 + 0.06 * sin(Time.get_ticks_msec() * 0.008))
	# кончил стрелять — оружие сразу опускается из прицела в положение «наготове»
	if not aiming and rig.hold.wid != "" and rig.hold.stance == "aim" and not _reloading:
		rig.hold.set_stance("ready")
	if not is_nan(_face) and aiming:
		_aim_yaw = _face
		_face = NAN
	if not is_nan(_face):
		player.rotation.y = lerp_angle(player.rotation.y, _face, 1.0 - exp(-delta * 26.0))
		if absf(angle_difference(player.rotation.y, _face)) < 0.03 or _atk_cd <= 0.0:
			_face = NAN


# ---------------- проверка ----------------

func _auto_vec() -> Vector2:
	var p := player.global_position
	var tgt: Vector3 = _auto[0]
	var d := Vector3(tgt.x - p.x, 0, tgt.z - p.z)
	if d.length() < _auto_r:
		_auto.pop_front()
		if _auto.is_empty():
			return Vector2.ZERO
		return _auto_vec()
	var fwd := Vector3(-sin(CAM_YAW), 0, -cos(CAM_YAW))
	var right := Vector3(-fwd.z, 0, fwd.x)
	var dn := d.normalized()
	return Vector2(dn.dot(right), -dn.dot(fwd)) * _auto_k


func _snap(name: String) -> void:
	if DisplayServer.get_name() == "headless":
		return                                  # без экрана снимка нет (и кадр отрисовки не наступит)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/%s.png" % [out, name])


func _walk(points: Array, limit := 30.0) -> void:
	_auto = points.duplicate()
	var t := 0.0
	while not _auto.is_empty() and t < limit:
		await get_tree().process_frame
		t += get_process_delta_time()
	_auto.clear()
	await get_tree().create_timer(0.5).timeout


func _log(t: String) -> void:
	print("[world] " + t)


func _inv_state() -> String:
	return "ячеек %d, занято %d, в руках «%s», рюкзак %s, основное %s, пистолет %s" % [inv.slot_count(), inv.used(), inv.hand, ULItems.title(inv.pack) if inv.pack else "нет", ULItems.title(inv.primary) if inv.primary else "нет", ULItems.title(inv.pistol) if inv.pistol else "нет"]


var _fails := 0
var _auto_k := 0.6                ## сила «нажатия» джойстика в проверке
var _auto_r := 0.35               ## за сколько до точки пути поворачивать к следующей (на лестнице — ближе)


## «Тест уровней» (главное меню): герой с пулемётом ПКП, бессмертный, патроны не кончаются; ни сохранение, ни база
## не трогаются; таймер кластера не убивает; выход за край поля или «Главное меню» — обратно в главное меню.
var lvl := false


func _lvl_setup() -> void:
	inv.from_dict({})
	inv.pack = ULItems.make("pack_large")
	inv.primary = ULItems.make("pkp")
	inv.pistol = ULItems.make("tt")
	inv.hand = "primary"
	for it in [ULItems.make("a762x54", 200), ULItems.make("a762x25", 64), ULItems.make("medkit", 3), ULItems.make("bandage", 5)]:
		inv.add(it)
	hp = HP_MAX
	if not temp():
		say("Тест уровня «%s»: бессмертие, патроны без конца, без сохранения. Выход — за край поля или через меню" % ("полигон" if arena else "Дом"))


func _lvl_exit() -> void:
	ULSettings.level_test = false
	ULSettings.place = "home"
	ULSettings.arena = false
	ULBase.memory_only = false
	ULBase.load_state(true)
	if test == "":
		get_tree().change_scene_to_file("res://menu.tscn")


## точки замера нагрузки по локации: [название, где]
func _perf_points() -> Array:
	if place == "lair":
		return [["вход", ULLair.L_ENTRY + Vector3(0, 0, -3)], ["проход в ограде", Vector3(0, 0, 66)], ["костёр", Vector3(0, 0, 14)],
			["штаб, коридор", Vector3(0, 0, -50)], ["кабинет главаря", Vector3(-6, 0, -58)], ["казарма", Vector3(-58, 0, -18)], ["склад", Vector3(-46, 0, 24)],
			["вышка", Vector3(-62, 3.4, -58)], ["жилой блок", Vector3(44, 0, 33)], ["середина, все враги гонятся", Vector3(0, 0, 8)]]
	if place == "khutor":
		return [["вход", ULKhutor.K_ENTRY + Vector3(0, 0, -3)], ["кольцо улицы", Vector3(0, 0, 30)], ["усадьба", Vector3(-6, 0, -10)],
			["большой дом внутри", Vector3(-8, 0, -20)], ["магазин внутри", Vector3(47, 0, 18)], ["подвал", Vector3(18, -2.55, -20)],
			["сарай", Vector3(-44, 0, -48)], ["у трактора", Vector3(36, 0, -24)], ["огороды", Vector3(-28, 0, 33)], ["середина, все враги гонятся", Vector3(0, 0, 0)]]
	elif place == "convoy":
		return [["вход", ULConvoy.C_ENTRY + Vector3(0, 0, -3)], ["колонна на дороге", Vector3(0, 0, 8)], ["лагерь", Vector3(38, 0, -42)],
			["штабная палатка", Vector3(34, 0, -53)], ["блокпост", Vector3(46, 0, 4)], ["склад", Vector3(-44, 0, 40)], ["вертолёт", Vector3(40, 0, 44)],
			["вышка", ULConvoy.C_TOWER + Vector3(0, 3.4, 0)], ["лес", Vector3(-40, 0, 0)], ["середина, все враги гонятся", Vector3(0, 0, 8)]]
	elif place == "sanatorium":
		return [["ворота", ULSanatorium.ENTRY + Vector3(0, 0, -3)], ["перед главным корпусом", Vector3(0, 0, 42)], ["вестибюль главного", Vector3(0, 0, 23)],
			["главный, 3 этаж", Vector3(-8, 6.6, 21)], ["площадь с фонтаном", Vector3(2, 0, -6)], ["палата лечебного", Vector3(-58, 0, -45)],
			["жилой, 4 этаж", Vector3(50, 9.9, -8)], ["столовая", Vector3(-54, 0, 36)], ["хоздвор", Vector3(54, 0, 46)],
			["середина, все враги гонятся", Vector3(0, 0, -6)]]
	elif place == "cowshed":
		return [["вход", ULCowshed.ENTRY + Vector3(0, 0, -4)], ["в коровнике", cowshed.barn_point(0, RandomNumberGenerator.new())], ["у останков коров", cowshed.cows[0] + Vector3(0, 0, 2.5)],
			["лес", Vector3(-52, 0, -50)], ["середина", Vector3(0, 0, 0)], ["середина, все враги гонятся", Vector3(0, 0, 0)]]
	# дом (база) и полигон
	return [["двор", HOUSE_AT + Vector3(0, 0, 9)], ["в доме", HOUSE_AT + Vector3(1.5, 0, 0)], ["у калитки", HOUSE_AT + Vector3(0, 0, 20)],
		["ельник", Vector3(-28, 0, -30)], ["тропа", Vector3(15, 0, 9)], ["середина, все враги гонятся", Vector3(0, 0, 10)]]


## «Замер FPS» (Тест уровней с галочкой «Замер»): герой обходит точки локации; в каждой — 1,5 с на успокоение и
## 3 с замера: средние кадры в секунду, худший кадр, вызовы отрисовки и треугольники. В конце — таблица на
## экране, копия в буфер обмена и файл user://bench_<место>.txt (их можно прислать — по ним настраивается графика).
func _bench_run() -> void:
	var t0 := Time.get_ticks_msec()
	while temp() and not cs_ready and Time.get_ticks_msec() - t0 < 30000:
		await get_tree().process_frame
	await get_tree().create_timer(2.0).timeout
	var rows: Array = []
	var gfx_names := ["низкая", "средняя", "высокая"]
	var head := "Замер FPS · %s · графика %s · %s · %s · экран %dx%d" % [zone_name() if temp() else ("Полигон" if arena else "Дом"),
		gfx_names[clampi(ULSettings.gfx, 0, 2)], OS.get_model_name(), RenderingServer.get_video_adapter_name(),
		get_viewport().get_visible_rect().size.x, get_viewport().get_visible_rect().size.y]
	say("Замер FPS: герой обходит локацию, около минуты")
	for pt in _perf_points():
		player.global_position = (pt[1] as Vector3) + Vector3.UP * 0.1
		player.velocity = Vector3.ZERO
		hp = HP_MAX
		if String(pt[0]).contains("гонятся"):
			for e in enemies:
				if e.alive():
					e.hear(player.global_position)
		_cam_ready = false
		await get_tree().create_timer(1.5).timeout
		var frames := 0
		var worst := 0.0
		var draw := 0.0
		var tris := 0.0
		var t_start := Time.get_ticks_usec()
		var t_prev := t_start
		while Time.get_ticks_usec() - t_start < 3000000:
			await get_tree().process_frame
			var now := Time.get_ticks_usec()
			worst = maxf(worst, float(now - t_prev) / 1000.0)
			t_prev = now
			frames += 1
			draw = maxf(draw, float(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)))
			tris = maxf(tris, float(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)))
		var secs := float(Time.get_ticks_usec() - t_start) / 1000000.0
		rows.append([String(pt[0]), float(frames) / secs, worst, int(draw), int(tris)])
	var txt := head + "\n"
	var min_fps := 1000.0
	var worst_all := 0.0
	for r in rows:
		txt += "%-30s %5.1f к/с · худший кадр %5.1f мс · вызовов %d · треугольников %d тыс.\n" % [r[0], r[1], r[2], r[3], int(r[4]) / 1000]
		min_fps = minf(min_fps, float(r[1]))
		worst_all = maxf(worst_all, float(r[2]))
	txt += "Итог: меньше всего %.1f к/с, худший кадр %.1f мс, текстуры %d МБ" % [min_fps, worst_all, int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576)]
	bench_text = txt
	print("[bench] " + txt.replace("\n", "\n[bench] "))
	DisplayServer.clipboard_set(txt)
	var f := FileAccess.open("user://bench_%s.txt" % place, FileAccess.WRITE)
	if f:
		f.store_string(txt)
		f.close()
	_bench_panel(txt)


var bench_text := ""                    ## последний результат «Замера FPS»


func _bench_panel(txt: String) -> void:
	var layer := CanvasLayer.new()
	layer.layer = 50
	layer.name = "BenchPanel"
	add_child(layer)
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	layer.add_child(pn)
	pn.set_anchors_and_offsets_preset(Control.PRESET_CENTER)
	pn.custom_minimum_size = Vector2(minf(get_viewport().get_visible_rect().size.x - 40.0, 1100.0), 0)
	pn.position = Vector2(20, 40)
	var vb := VBoxContainer.new()
	pn.add_child(vb)
	var lb := Label.new()
	lb.text = txt + "\n\nТаблица скопирована в буфер обмена — её можно вставить в сообщение."
	lb.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	lb.add_theme_font_size_override("font_size", 15)
	lb.add_theme_color_override("font_color", ULSettings.C_TEXT)
	vb.add_child(lb)
	vb.add_child(ULSettings.button("Закрыть", func() -> void: layer.queue_free(), 300.0))


## Проверка «Теста уровней» (--as-test=lvl --as-place=khutor): пулемёт, бессмертие, патроны без конца, таймер не
## убивает, база только в памяти, выход за край — флаг снят, настоящая база снова загружена
func _lvl_test() -> void:
	var t0 := Time.get_ticks_msec()
	while temp() and not cs_ready and Time.get_ticks_msec() - t0 < 25000:
		await get_tree().process_frame
	_ok("тест уровня «%s»: герой с пулемётом ПКП в руках, патроны к нему есть" % (zone_name() if temp() else "Дом"), lvl and inv.primary != null and String(inv.primary.id) == "pkp" and inv.hand == "primary" and inv.count("a762x54") >= 200)
	for e in enemies:
		if e.alive():
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	hurt(60.0, player.global_position + Vector3(1, 0, 0))
	hurt(60.0, player.global_position + Vector3(1, 0, 0))
	_ok("бессмертие: два удара по 60 — здоровье по-прежнему %d, героя не убило" % int(hp), is_equal_approx(hp, HP_MAX) and _dead_t <= 0.0)
	var m0 := int(inv.primary.mag)
	for k in 5:
		_shoot(inv.primary, ULItems.get_def("pkp"))
	_ok("патроны без конца: 5 выстрелов — в ленте по-прежнему %d" % int(inv.primary.mag), int(inv.primary.mag) == m0)
	_ok("база и сохранение не трогаются: база только в памяти", ULBase.memory_only)
	if temp():
		_cs_end = Time.get_unix_time_from_system() - 1.0
		await get_tree().create_timer(0.5).timeout
		_ok("время кластера вышло — герой жив, таймер начат заново (%.0f с)" % cs_left(), not _cs_done and _dead_t <= 0.0 and cs_left() > 500.0 and is_equal_approx(hp, HP_MAX))
	player.global_position = Vector3(0, 0.1, size_m * 0.5 + 3.0)
	var tl := 0.0
	while ULBase.memory_only and tl < LEAVE_S + 2.0:
		await get_tree().process_frame
		tl += get_process_delta_time()
	_ok("вышел за край поля — тест окончен: флаг снят, база снова настоящая (не в памяти), путь — в главное меню", not ULSettings.level_test and not ULBase.memory_only and ULSettings.place == "home")
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## проверки: маршрут id — в наборе компьютера (набор случайный: 3 из всех локаций)
## маршрут id — в наборе компьютера (как после сброса: пройденный снова доступен)
func _offer_route(id: String) -> void:
	(ULBase.data.done as Array).erase(id)
	var offs: Array = ULBase.offers()
	if not offs.has(id):
		offs[0] = id
		ULBase.data.offers = offs


## Оружейный сундук и прокрутка (--as-test=case): вероятности на 200 000 виртуальных прокрутках, ключ и сундук,
## однократность, полный инвентарь, сохранение результата после «перезапуска» (чтение base.json заново), новый
## экземпляр логова — старый ключ недействителен.
func _case_test() -> void:
	var old_path := ULBase.path
	var old_mem := ULBase.memory_only
	ULBase.path = "user://test_case_base.json"
	ULBase.memory_only = false
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ULBase.path))
	ULBase.load_state(true)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	# 1) вероятности
	var tb := ULCase.table()
	var n := 200000
	var by_r := {}
	var by_id := {}
	for i in n:
		var r := ULCase.roll(rng)
		by_r[r.rarity] = int(by_r.get(r.rarity, 0)) + 1
		by_id[r.id] = int(by_id.get(r.id, 0)) + 1
	var worst := 0.0
	var line := ""
	for t in tb:
		var got := float(by_r.get(String(t.r.id), 0)) / n
		worst = maxf(worst, absf(got - float(t.p)))
		line += "%s %.2f%% (задано %.2f%%); " % [String(t.r.n), got * 100.0, float(t.p) * 100.0]
	_ok("200 000 прокруток: доли редкостей совпадают с заданными (наибольшее отклонение %.2f п. п.)" % (worst * 100.0), worst < 0.005, line)
	var inner_ok := true
	for t in tb:
		var items: Array = t.items
		for id in items:
			var exp_p := float(t.p) / items.size()
			if absf(float(by_id.get(id, 0)) / n - exp_p) > 0.004:
				inner_ok = false
	_ok("внутри редкости шанс делится поровну между доступными моделями", inner_ok, str(by_id))
	var off := []
	for t in tb:
		off.append_array(t.off)
	var leaked := off.filter(func(x): return by_id.has(x))
	_ok("моделей, которых нет в игре, не выпадает (%s)" % ", ".join(off), leaked.is_empty() and not off.is_empty())
	var dur_ok := true
	for i in 2000:
		var r := ULCase.roll(rng)
		var cr: Array = ULCase.rarity(String(r.rarity)).cond
		var mx := float(ULItems.get_def(String(r.id)).dur)
		if float(r.dur) < floor(mx * float(cr[0])) - 1 or float(r.dur) > ceil(mx * float(cr[1])) + 1:
			dur_ok = false
	_ok("состояние оружия — в пределах своей редкости (износ: прочность от доли)", dur_ok)
	# 2) ключ и сундук
	var inv2 := ULInventory.new()
	var inst := ULCase.new_instance()
	var r0 := ULCase.open_chest(inv2, rng)
	_ok("без ключа: «Закрыто. Требуется ключ главаря муров»", not r0.ok and r0.err == "key")
	inv2.add(ULCase.make_key("старый-экземпляр"))
	var r1 := ULCase.open_chest(inv2, rng)
	_ok("ключ из другого экземпляра логова не подходит", not r1.ok and r1.err == "stale")
	ULCase.find_key(inv2)[0][ULCase.find_key(inv2)[1]] = null
	inv2.add(ULCase.make_key(inst))
	var r2 := ULCase.open_chest(inv2, rng)
	_ok("с ключом: сундук открыт, награда выбрана до прокрутки, ключ исчез", r2.ok and not (r2.reward as Dictionary).is_empty() and ULCase.find_key(inv2).is_empty() and String(ULCase.lair().chest) == "open")
	var rw: Dictionary = r2.reward
	inv2.add(ULCase.make_key(inst))
	var r3 := ULCase.open_chest(inv2, rng)
	_ok("второй раз не открыть: награда уже ждёт выдачи, ключ не тратится", not r3.ok and r3.err == "pending" and not ULCase.find_key(inv2).is_empty())
	# 3) «перезапуск»: состояние читается заново из файла — та же награда, сундук пуст
	ULBase.load_state(true)
	var pr = ULCase.pending()
	_ok("после перезапуска награда та же (%s, прочность %d) и сундук пуст" % [String(rw.id), int(rw.dur)], pr != null and String(pr.id) == String(rw.id) and int(pr.dur) == int(rw.dur) and String(ULCase.lair().chest) == "open")
	# 4) полный инвентарь: награда остаётся ждать
	var inv3 := ULInventory.new()
	inv3.primary = ULItems.make("ak74m")
	inv3.pistol = ULItems.make("tt")
	for i in inv3.pockets.size():
		inv3.pockets[i] = ULItems.make("junk")
		inv3.pockets[i].n = 50
	var c0 := ULCase.claim(inv3)
	_ok("инвентарь полон: «Забрать» не теряет награду — она ждёт", not c0.ok and c0.err == "full" and ULCase.pending() != null)
	inv3.pockets[0] = null
	var c1 := ULCase.claim(inv3)
	var got_it = inv3.pockets[0]
	_ok("место освободилось: оружие в инвентаре с тем же износом", c1.ok and got_it != null and String(got_it.id) == String(rw.id) and int(got_it.dur) == int(rw.dur) and ULCase.pending() == null)
	var c2 := ULCase.claim(inv3)
	_ok("награда выдаётся один раз", not c2.ok and c2.err == "none")
	ULBase.load_state(true)
	_ok("после выдачи и перезапуска награды нет, сундук по-прежнему пуст", ULCase.pending() == null and String(ULCase.lair().chest) == "open")
	var r4 := ULCase.open_chest(inv2, rng)
	_ok("пустой сундук не открывается даже с ключом", not r4.ok and r4.err == "open")
	# 5) перезагрузка кластера: новый экземпляр — сундук закрыт, старый ключ недействителен
	ULCase.new_instance()
	var r5 := ULCase.open_chest(inv2, rng)
	_ok("перезагрузка кластера: сундук снова закрыт, старый ключ недействителен", not r5.ok and r5.err == "stale" and String(ULCase.lair().chest) == "closed")
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ULBase.path))
	ULBase.path = old_path
	ULBase.memory_only = old_mem
	ULBase.load_state(true)
	print("[inv] итог: ошибок %d" % _fails)


func _ok(name: String, cond: bool, extra := "") -> void:
	if not cond:
		_fails += 1
	print("[inv] %s — %s%s" % [name, "верно" if cond else "ОШИБКА", (" (" + extra + ")") if extra != "" else ""])


func _wait_drawn() -> void:
	var tw := 0.0
	while rig.hold.drawn < 0.99 and tw < 6.0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	await get_tree().create_timer(0.2).timeout


## «Опасный коровник» (--as-test=cs; --as-out=папка — снимки): размер, коровники и останки коров, сколько врагов
## и где, разные посещения, враги видят и бьют, таймер 10:00, уход за край с добычей, перезагрузка кластера с
## потерей того, что при себе (вещи базы целы), маршрут после посещения закрыт и покупается снова.
func _cs_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 15000:
		await get_tree().process_frame
	var c := ULCowshed.cfg()
	_ok("коровник: поле %d×%d м, враги расставлены" % [int(size_m), int(size_m)], size_m == 150.0 and cs_ready and place == "cowshed" and house == null)
	_ok("несколько коровников, загоны, лес, техника", cowshed.barns.size() >= 3 and cowshed.fence_mid.size() >= 20 and cowshed.wood_pts.size() >= 40)
	var jn := 0
	var jin := 0
	for g in ground:
		if g.item != null and String(g.item.id) == "junk":
			jn += 1
			if cowshed.in_barn((g.node as Node3D).global_position) >= 0:
				jin += 1
	_ok("в постройках лежит хлам: %d кучек (по 2–4 на постройку)" % jn, jn >= cowshed.barns.size() * 2 and jn <= cowshed.barns.size() * 4 and jin == jn)
	var kinds := {}
	for ch in cowshed.get_children():
		if ch.has_meta("cow"):
			kinds[String(ch.get_meta("cow"))] = int(kinds.get(String(ch.get_meta("cow")), 0)) + 1
	_ok("останки коров: около %d, два вида (скелет и тело)" % int(c.cows), cowshed.cows.size() >= int(c.cows) - 2 and kinds.size() == 2, str(kinds))
	var np := 0
	var nl := 0
	var in_barn := 0
	var by_cow := 0
	var by_wood := 0
	var near_entry := 0
	var off_nav := 0
	var map := get_world_3d().navigation_map
	for e in enemies:
		if e.kind == "infected":
			np += 1
		elif e.kind == "lottery":
			nl += 1
		var q := e.global_position
		if cowshed.in_barn(q) >= 0:
			in_barn += 1
		for cp in cowshed.cows:
			if cp.distance_to(q) < 5.0:
				by_cow += 1
				break
		for wp in cowshed.wood_pts + cowshed.fence_mid:
			if wp.distance_to(q) < 5.0:
				by_wood += 1
				break
		if q.distance_to(ULCowshed.ENTRY) < float(c.safe_r):
			near_entry += 1
		var cl := NavigationServer3D.map_get_closest_point(map, q)
		if Vector2(cl.x - q.x, cl.z - q.z).length() > 0.6:
			off_nav += 1
	_ok("пустышей %d (от %d до %d), лоторейщиков %d (от %d до %d)" % [np, int(c.pustysh[0]), int(c.pustysh[1]), nl, int(c.lottery[0]), int(c.lottery[1])], np >= int(c.pustysh[0]) and np <= int(c.pustysh[1]) and nl >= int(c.lottery[0]) and nl <= int(c.lottery[1]))
	_ok("враги в коровниках (%d), у останков коров (%d), в лесу и у загонов (%d)" % [in_barn, by_cow, by_wood], in_barn > 0 and by_cow > 0 and by_wood > 0)
	_ok("никто не стоит в стене, дереве или вне проходимой части", off_nav == 0, "вне: %d" % off_nav)
	_ok("у точки входа (%d м) врагов нет" % int(c.safe_r), near_entry == 0)
	# разные посещения: тот же расчёт с другой случайностью
	var snap := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	var counts := {}
	var lo := [99, 99]
	var hi := [0, 0]
	var first := ""
	var differ := false
	for sd in 30:
		var rng := RandomNumberGenerator.new()
		rng.seed = 5000 + sd * 7919
		var plan := cowshed.spawn_plan(rng, snap)
		var a := 0
		var b := 0
		for sp in plan:
			if String(sp[0]) == "infected":
				a += 1
			else:
				b += 1
		lo = [mini(lo[0], a), mini(lo[1], b)]
		hi = [maxi(hi[0], a), maxi(hi[1], b)]
		var sig := "%d/%d/%s" % [a, b, str((plan[0][1] as Vector3).round())]
		if first == "":
			first = sig
		elif sig != first:
			differ = true
	_ok("30 посещений: пустышей %d–%d, лоторейщиков %d–%d, состав и места каждый раз другие" % [lo[0], hi[0], lo[1], hi[1]], lo[0] >= 10 and hi[0] <= 30 and lo[1] >= 3 and hi[1] <= 8 and differ and hi[0] - lo[0] >= 10)
	# таймер
	_ok("таймер кластера начат с 10:00", cs_left() > 590.0 and cs_left() <= 600.0, "%.1f с" % cs_left())
	if out != "":
		await get_tree().create_timer(1.5).timeout
		await _snap("cs_entry")
	# постройки: стены непроходимы (луч на высоте 1 м упирается в стену), внутрь можно зайти (путь по карте
	# проходимости от ворот до середины прохода), крыша и ближняя стена растворяются, когда герой внутри
	var space := get_world_3d().direct_space_state
	var walls_ok := 0
	var enter_ok := 0
	var fade_ok := 0
	for i in cowshed.barns.size():
		var b: Dictionary = cowshed.barns[i]
		var xf: Transform3D = b.xf
		var hh: Vector2 = b.half
		# по 5 лучей на каждую из 4 стен: в проёмы (ворота, двери, пролом) луч проходит — таких меньше половины
		var hits := 0
		for side in 4:
			for k in 5:
				var u := -0.8 + 1.6 * k / 4.0
				var a0: Vector3
				var a1: Vector3
				match side:
					0:
						a0 = Vector3(u * hh.x, 1.0, -hh.y - 2.0)
						a1 = Vector3(u * hh.x, 1.0, -hh.y + 1.0)
					1:
						a0 = Vector3(u * hh.x, 1.0, hh.y + 2.0)
						a1 = Vector3(u * hh.x, 1.0, hh.y - 1.0)
					2:
						a0 = Vector3(-hh.x - 2.0, 1.0, u * hh.y)
						a1 = Vector3(-hh.x + 1.0, 1.0, u * hh.y)
					_:
						a0 = Vector3(hh.x + 2.0, 1.0, u * hh.y)
						a1 = Vector3(hh.x - 1.0, 1.0, u * hh.y)
				var q := PhysicsRayQueryParameters3D.create(xf * a0, xf * a1)
				q.collision_mask = 1
				if not space.intersect_ray(q).is_empty():
					hits += 1
		print("[inv] %s: лучей в стену %d из 20" % [String(b.n), hits])
		if hits >= 12:
			walls_ok += 1
		var bd: Dictionary = ULCowshed.BUILDINGS[i]
		var dp := ULCowshed._door_point(bd, bd.doors[0])
		var outside := xf * (Vector3(dp.x, 0, dp.y) + ULFarmBuilding._side_normal(String(bd.doors[0][0])) * 3.0)
		var inside := xf * Vector3(0, 0, 0)
		var path := NavigationServer3D.map_get_path(map, NavigationServer3D.map_get_closest_point(map, outside), inside, true)
		if path.size() > 1 and path[path.size() - 1].distance_to(inside) < 1.2:
			enter_ok += 1
		player.global_position = inside + Vector3.UP * 0.1
		await get_tree().create_timer(0.7).timeout
		var fin: float = (b.b as ULFarmBuilding).fade_value()
		player.global_position = outside + Vector3.UP * 0.1
		await get_tree().create_timer(0.7).timeout
		var fout: float = (b.b as ULFarmBuilding).fade_value()
		if fin > 0.95 and fout < 0.05:
			fade_ok += 1
	var nb := cowshed.barns.size()
	_ok("стены всех %d построек непроходимы" % nb, walls_ok == nb, "%d из %d" % [walls_ok, nb])
	_ok("в каждую постройку можно зайти через ворота", enter_ok == nb, "%d из %d" % [enter_ok, nb])
	_ok("герой внутри — крыша и ближняя стена растворяются, вышел — проявляются", fade_ok == nb, "%d из %d" % [fade_ok, nb])
	# враг видит, догоняет и бьёт
	# пустыш вне построек, рядом с которым нет других врагов (иначе первым ударит сосед)
	var tgt: ULEnemy = null
	var best_gap := 0.0
	for e in enemies:
		if e.kind != "infected" or cowshed.in_barn(e.global_position) >= 0:
			continue
		var gap := 99.0
		for o in enemies:
			if o != e:
				gap = minf(gap, o.global_position.distance_to(e.global_position))
		if gap > best_gap:
			best_gap = gap
			tgt = e
	var hp0 := hp
	if tgt:
		var fwd := Vector3(0, 0, 1)
		var at := NavigationServer3D.map_get_closest_point(map, tgt.global_position + fwd * 6.0)
		player.global_position = at + Vector3.UP * 0.1
		var tt := 0.0
		var dmin := 99.0
		while tt < 9.0 and hp >= hp0:
			await get_tree().process_frame
			tt += get_process_delta_time()
			dmin = minf(dmin, tgt.global_position.distance_to(player.global_position))
		_ok("пустыш заметил героя, подошёл вплотную и ударил", hp < hp0 and dmin < 1.3, "%.1f с, ближе всего %.2f м, состояние %s" % [tt, dmin, tgt.state])
		if out != "":
			await _snap("cs_fight")
	# дальние враги: без движений тела, но думают
	var far_ok := true
	for e in enemies:
		if e.alive() and e.global_position.distance_to(player.global_position) > 40.0 and e.active:
			far_ok = false
	_ok("дальние враги без движений тела (экономия на телефоне)", far_ok)
	# уход за край с добычей
	hp = HP_MAX
	inv.wallet = {"spore": 7, "pea": 1}
	ULBase.set_route("cowshed", "active")
	player.global_position = Vector3(0, 0.1, size_m * 0.5 + 3.0)
	var tl := 0.0
	while not _cs_done and tl < LEAVE_S + 2.0:
		await get_tree().process_frame
		tl += get_process_delta_time()
	_ok("ушёл за край: посещение окончено, добыча при себе, маршрут закрыт", _cs_done and int(inv.wallet.get("spore", 0)) == 7 and inv.primary != null and ULBase.route_state("cowshed") == "" and ULSettings.place == "home", ULSettings.arrival_note)
	# новое посещение: снова купить маршрут
	inv.wallet = {"spore": 10}
	_offer_route("cowshed")
	var rb := ULBase.buy_route(inv, "cowshed")
	_ok("для нового посещения маршрут покупается снова", rb.ok and ULBase.route_state("cowshed") == "bought" and int(inv.wallet.get("spore", 0)) == 0)
	# перезагрузка кластера с героем внутри
	_cs_done = false
	left_location = false
	_leave_t = 0.0
	ULSettings.place = "cowshed"
	ULBase.set_route("cowshed", "active")
	player.global_position = ULCowshed.ENTRY + Vector3(0, 0.1, -3)
	inv.wallet = {"spore": 25, "pea": 2}
	var fake := "user://test_cluster.json"
	var crates0 := [[1.0, 2.0, 0.0, [ULItems.make("ak74m")]]]
	ULBase.write_json(fake, {"v": SAVE_V, "crates": crates0, "ground": [[ULItems.make("bandage", 2), 3.0, 4.0, 0.0]], "inv": inv.to_dict(), "hp": 80.0})
	_cs_end = Time.get_unix_time_from_system() + 32.0
	await get_tree().create_timer(2.5).timeout
	_ok("за 30 с — тревога, таймер красный", _cs_warned.has(-1))
	_cs_end = Time.get_unix_time_from_system() + 0.5
	var tr := 0.0
	while not _cs_over and tr < 3.0:
		await get_tree().process_frame
		tr += get_process_delta_time()
	_ok("время вышло: герой погибает вместе с кластером", _cs_over and _dead_t > 0.0 and hp == 0.0)
	tr = 0.0
	while not _cs_done and tr < 5.0:
		await get_tree().process_frame
		tr += get_process_delta_time()
	_save_carried(fake, true)
	var dd = JSON.parse_string(FileAccess.get_file_as_string(fake))
	var inv3 := ULInventory.new()
	inv3.from_dict(dd.inv)
	_ok("перезагрузка: всё, что при себе, потеряно (оружие, патроны, ресурсы)", _cs_done and inv.primary == null and inv.pistol == null and inv.used() == 0 and inv.wallet.is_empty() and inv3.primary == null and inv3.wallet.is_empty())
	_ok("вещи на базе целы (ящики и вещи на земле не тронуты)", (dd.crates as Array).size() == 1 and String(dd.crates[0][3][0].id) == "ak74m" and (dd.ground as Array).size() == 1)
	_ok("после перезагрузки маршрут закрыт, коровника нет на карте, герой — дома", ULBase.route_state("cowshed") == "" and not ULMap.place_shown("cowshed") and ULSettings.place == "home" and ULSettings.arrival_note.begins_with("Кластер перезагрузился"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(fake))
	ULSettings.place = "home"
	ULSettings.arrival_note = ""
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## Санаторий «Луч» (--as-test=sn): проверки по списку задания — размер и расположение, вход во все корпуса и на все
## этажи, скрытие крыши и верхних этажей, срез стен, двери и лестницы, враги внутри корпусов, число и места врагов,
## никто не в стене и мебели, обыск тел и тайников, таймер, перезагрузка, уход с добычей.
func _sn_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 25000:
		await get_tree().process_frame
	var c := ULSanatorium.cfg()
	var map := get_world_3d().navigation_map
	var snapf := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	var space := get_world_3d().direct_space_state
	# 1–2: размер и расположение по карте пользователя
	_ok("санаторий: поле %d×%d м, враги расставлены" % [int(size_m), int(size_m)], size_m == 150.0 and cs_ready and place == "sanatorium" and house == null)
	var pos := {}
	var names := []
	for b in san.blds:
		pos[b.id] = b.rect.get_center()
		names.append(b.title)
	_ok("шесть корпусов: %s" % ", ".join(names), san.blds.size() == 6)
	var lay: bool = absf(pos.main.x) < 6.0 and pos.main.y > 10.0 and pos.medical.x < -25.0 and pos.medical.y < -30.0 and pos.boiler.y < -50.0 \
		and pos.hozblok.y < -50.0 and pos.hozblok.x > 40.0 and pos.residential.x > 40.0 and absf(pos.residential.y) < 30.0 and pos.canteen.x < -40.0 \
		and pos.canteen.y > 20.0 and ULSanatorium.YARD.get_center().x > 40.0 and ULSanatorium.YARD.get_center().y > 30.0 and (ULSanatorium.PLAZA[0] as Vector2).y < pos.main.y - 20.0 \
		and ULSanatorium.ENTRY.z > 60.0 and absf(ULSanatorium.ENTRY.x) < 6.0
	_ok("расположение по карте: ворота внизу посередине, главный корпус над ними, выше — фонтан; лечебный слева вверху, котельная и хозблок сверху, жилой справа, столовая слева внизу, хоздвор справа внизу", lay, str(pos))
	# готовые корпуса из кэша совпадают со свежей сборкой (иначе после правки генератора забыли snbake)
	var cr = load(ULSanatorium.BLD_CACHE) if ResourceLoader.exists(ULSanatorium.BLD_CACHE) else null
	var same := 0
	var diff := []
	if cr is ULBlockCache and cr.sig == ULSanatorium.cache_sig():
		for i in san.blds.size():
			var cb: Dictionary = cr.blds[san.blds[i].id]
			var rr := RandomNumberGenerator.new()
			rr.state = int(cb.rng0)
			var fresh := ULBlock.new()
			fresh.build(ULSanatorium.BUILDINGS[i], rr)
			var vc := func(made: Array) -> int:
				var n := 0
				for m in made:
					n += (m[2] as ArrayMesh).surface_get_array_len(0)
				return n
			var a1 := [fresh.rooms.size(), fresh.containers.size(), fresh._door_args.size(), fresh.cols.size(), vc.call(fresh._made)]
			var a2 := [san.blds[i].rooms.size(), san.blds[i].containers.size(), san.blds[i]._door_args.size(), san.blds[i].cols.size(), vc.call(san.blds[i]._made)]
			if a1 == a2:
				same += 1
			else:
				diff.append("%s: %s / %s" % [san.blds[i].id, str(a1), str(a2)])
			fresh.free()
	_ok("корпуса взяты из кэша и совпадают со свежей сборкой (помещения, тайники, двери, столкновения, вершины): %d из 6" % same, same == 6, str(diff))
	print("[inv] санаторий готов через %.1f с от запуска игры (сборка локации и расстановка врагов)" % (sn_ready_ms / 1000.0))
	var nrooms := 0
	for b in san.blds:
		nrooms += b.rooms.size()
	_ok("внутри — комнаты, коридоры, лестницы: помещений %d, дверей %d, тайников %d" % [nrooms, san.doors.size(), san.containers.size()], nrooms > 150 and san.doors.size() > 100 and san.containers.size() > 200)
	# 3: путь от входа на каждый этаж каждого корпуса
	var reach_ok := 0
	var reach_all := 0
	var bad := []
	for b in san.blds:
		for f in b.floors:
			var tgt := Vector3.INF
			for sp in b.spots:
				if String(sp[1]).ends_with(":%d" % f):
					tgt = sp[0]
					break
			if tgt == Vector3.INF:
				continue
			reach_all += 1
			var from: Vector3 = snapf.call(b.entrances[0][0])
			var path := NavigationServer3D.map_get_path(map, from, tgt, true)
			if path.size() > 1 and path[path.size() - 1].distance_to(tgt) < 1.0:
				reach_ok += 1
			else:
				bad.append("%s/%d" % [b.id, f + 1])
	_ok("в каждый корпус можно войти и подняться на каждый этаж (путь по карте проходимости от входа): %d из %d" % [reach_ok, reach_all], reach_ok == reach_all, str(bad))
	# стены непроходимы: лучи на высоте 1 м поперёк наружных стен
	var wall_hits := 0
	var wall_rays := 0
	for b in san.blds:
		for bk in b.blocks:
			for k in 7:
				var u := (k - 3) * float(bk.hl) / 4.0
				var a0 := b._w(bk, u, 0.5, float(bk.hw) + 1.5)
				var a1 := b._w(bk, u, 0.5, float(bk.hw) - 0.6)
				var q := PhysicsRayQueryParameters3D.create(a0, a1)
				q.collision_mask = 1 | ULDoor.LAYER
				wall_rays += 1
				if not space.intersect_ray(q).is_empty():
					wall_hits += 1
	_ok("наружные стены непроходимы (лучи в стену на высоте 0,5 м — ниже подоконника: %d из %d упёрлись — остальные во входы)" % [wall_hits, wall_rays], wall_hits >= wall_rays * 0.9)
	# проверки внутри главного корпуса — без врагов вокруг (иначе героя загрызут посреди проверки)
	for e in enemies:
		if e.global_position.distance_to(Vector3(0, 0, 21)) < 45.0:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
			e.collision_layer = 0                    # и не загораживает лестницу телом
			e.collision_mask = 0
	# 4: этаж героя — крыша и всё выше скрыто, стены этажа срезаны; снаружи — снова целиком
	var mi := 0
	var main: ULBlock = san.blds[mi]
	player.global_position = Vector3(10, 3.35, 21)
	await get_tree().create_timer(0.5).timeout
	var cut_on := false
	for m in (main._groups["b0/i1"] as Node3D).get_children():
		if (m as MeshInstance3D).material_override == ULBlock.cut_mats.get(String(m.get_meta("mat")), null):
			cut_on = true
	var hid: bool = san.hero_b == mi and san.hero_f == 1 and not main._groups["b0/r"].visible and not main._groups["b0/x2f"].visible and not main._groups["b0/n2"].visible \
		and main._groups["b0/n1"].visible and not main._groups["b0/n0"].visible and main._groups["b0/x0f"].visible
	_ok("герой на 2 этаже главного корпуса: крыша и 3 этаж скрыты, видна обстановка его этажа, стены срезаны", hid and cut_on, "%d/%d" % [san.hero_b, san.hero_f])
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.6).timeout
		await _snap("sn_floor2")
	player.global_position = Vector3(0, 0.1, 45)
	await get_tree().create_timer(0.5).timeout
	_ok("вышел — корпус снова целый: крыша и фасады видны, внутренности скрыты", san.hero_b == -1 and main._groups["b0/r"].visible and main._groups["b0/xa"].visible and not main._groups["b0/x2f"].visible and not main._groups["b0/n1"].visible)
	# 5: лестница — герой сам поднимается со 1 на 2 этаж
	var st0: Vector3 = snapf.call(Vector3(-8, 0, 21))
	var st1: Vector3 = snapf.call(Vector3(-8, 3.3, 21))
	player.global_position = st0 + Vector3.UP * 0.1
	await get_tree().create_timer(0.3).timeout
	var sp_path := NavigationServer3D.map_get_path(map, st0, st1, true)
	_auto_r = 0.12                       # у перил не срезать углы
	await _walk(Array(sp_path), 25.0)
	_ok("герой поднялся по лестнице на 2 этаж (высота %.2f м)" % player.global_position.y, player.global_position.y > 3.0 and san.hero_f == 1, str(player.global_position))
	var down := NavigationServer3D.map_get_path(map, snapf.call(player.global_position), st0, true)
	await _walk(Array(down), 25.0)
	_auto_r = 0.35
	_ok("и спустился обратно (высота %.2f м)" % player.global_position.y, player.global_position.y < 0.5 and san.hero_f == 0, "путь %d точек: %s; герой %s" % [down.size(), str(down.slice(0, 6)), str(player.global_position)])
	# двери: закрытая — преграда (луч упирается в дверь), герой подходит — открывается
	var door: ULDoor = null
	for d in san.doors:
		var dd := d as ULDoor
		if not dd.open and not dd.get_meta("ext", false) and dd.floor_i == 0 and dd.center.distance_to(player.global_position) < 40.0:
			door = dd
			break
	if door != null:
		var nrm := door.global_transform.basis.z.normalized()
		var q2 := PhysicsRayQueryParameters3D.create(door.center + Vector3.UP * 1.0 + nrm * 1.0, door.center + Vector3.UP * 1.0 - nrm * 1.0)
		q2.collision_mask = 1 | ULDoor.LAYER
		var h0 := space.intersect_ray(q2)
		var blocked: bool = not h0.is_empty() and h0.collider == door
		player.global_position = door.center + nrm * 0.8 + Vector3.UP * 0.1
		await get_tree().create_timer(0.8).timeout
		_ok("закрытая дверь — преграда; герой подошёл — дверь открылась", blocked and door.open, "закрыта: %s, открыта: %s" % [blocked, door.open])
	# 6: враг внутри корпуса идёт к герою через двери и по лестнице на другой этаж
	var room0 := Vector3.INF
	var hero2: Vector3 = snapf.call(Vector3(12, 3.3, 21))
	for sp in main.spots:
		var tg := String(sp[1])
		var dxz := Vector2((sp[0] as Vector3).x - hero2.x, (sp[0] as Vector3).z - hero2.z).length()
		if tg.ends_with(":0") and not tg.contains(":cor:") and not tg.contains(":stair:") and dxz > 6.0 and dxz < 14.0:
			room0 = sp[0]
			break
	for e in enemies:
		if e.global_position.distance_to(hero2) < 25.0 or e.global_position.distance_to(room0) < 25.0:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	var chaser := spawn_enemy("infected", snapf.call(room0))
	player.global_position = hero2 + Vector3.UP * 0.1
	await get_tree().create_timer(0.3).timeout
	chaser.state = "chase"
	chaser._last = player.global_position
	chaser._unseen = 0.0
	var tch := 0.0
	var hp1 := hp
	var best_d := 99.0
	while tch < 35.0 and hp >= hp1:
		await get_tree().process_frame
		tch += get_process_delta_time()
		best_d = minf(best_d, chaser.global_position.distance_to(player.global_position))
	_ok("пустыш из кабинета 1 этажа дошёл до героя на 2 этаже (двери, коридор, лестница) и ударил: %.1f с" % tch, hp < hp1 and chaser.global_position.y > 2.5, "ближе всего %.2f м, высота врага %.2f, состояние %s" % [best_d, chaser.global_position.y, chaser.state])
	hp = HP_MAX
	chaser.damage(999.0, player.global_position)
	# 7–9: число врагов, где они, никто не в стене и мебели
	var np := 0
	var nl := 0
	var zones := {}
	var inside := 0
	var near_entry := 0
	var stuck := 0
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.26
	capsule.height = 1.4
	var nr := 0
	for sp in cs_plan:
		if String(sp[0]) == "infected":
			np += 1
		elif String(sp[0]) == "lottery":
			nl += 1
		else:
			nr += 1
		var z := String(sp[2]).split(":")[0]
		zones[z] = int(zones.get(z, 0)) + 1
		var p: Vector3 = sp[1]
		if san.locate(p + Vector3.UP * 0.3).x >= 0:
			inside += 1
		if Vector2(p.x - ULSanatorium.ENTRY.x, p.z - ULSanatorium.ENTRY.z).length() < float(c.safe_r):
			near_entry += 1
		var qs := PhysicsShapeQueryParameters3D.new()
		qs.shape = capsule
		qs.transform = Transform3D(Basis(), p + Vector3.UP * 0.95)
		qs.collision_mask = 1
		var hits := space.intersect_shape(qs, 4).filter(func(h): return not (h.collider is CharacterBody3D))
		if not hits.is_empty():
			stuck += 1
			print("[inv]   в препятствии: %s %s (%s)" % [sp[0], str(p.snapped(Vector3.ONE * 0.1)), str(hits[0].collider)])
	_ok("пустышей %d (от %d до %d), лоторейщиков %d (от %d до %d), Руберов %d (от 0 до 2)" % [np, int(c.pustysh[0]), int(c.pustysh[1]), nl, int(c.lottery[0]), int(c.lottery[1]), nr], np >= int(c.pustysh[0]) and np <= int(c.pustysh[1]) and nl >= int(c.lottery[0]) and nl <= int(c.lottery[1]) and nr <= 2)
	_ok("враги по всей территории и в корпусах (%d внутри, %d снаружи): %s" % [inside, cs_plan.size() - inside, str(zones)], zones.size() >= 6 and inside >= cs_plan.size() * 0.35 and inside <= cs_plan.size() * 0.85)
	_ok("никто не стоит в стене, мебели или дереве (проверка формой тела)", stuck == 0, "в препятствии: %d" % stuck)
	_ok("у ворот (%d м) врагов нет" % int(c.safe_r), near_entry == 0)
	var crowd := 0
	for a in cs_plan:
		var nn := 0
		for b2 in cs_plan:
			if (a[1] as Vector3).distance_to(b2[1]) < 4.0:
				nn += 1
		crowd = maxi(crowd, nn)
	_ok("не одной толпой: рядом (4 м) не больше %d врагов" % crowd, crowd <= 6)
	var lot_zones := {}
	for sp in cs_plan:
		if String(sp[0]) == "lottery":
			lot_zones[String(sp[2])] = true
	_ok("лоторейщики — в дальних коридорах, лечебном корпусе, подсобках, у котельной, в зарослях: %s" % str(lot_zones.keys()), lot_zones.size() >= 2)
	var lo := [99, 99]
	var hi := [0, 0]
	var sigs := {}
	var rb_n := [0, 0, 0]              # в скольких посещениях 0, 1 и 2 Рубера
	var rb_zones := {}
	var rb_tight := 0
	var rb_shape := CapsuleShape3D.new()
	rb_shape.radius = float(ULEnemy.KINDS.ruber.radius) + 0.1
	rb_shape.height = 2.0
	for sd in 30:
		var rng := RandomNumberGenerator.new()
		rng.seed = 7000 + sd * 7919
		var plan := san.spawn_plan(rng, snapf)
		var a := 0
		var bb := 0
		var rr2 := 0
		for sp in plan:
			if String(sp[0]) == "infected":
				a += 1
			elif String(sp[0]) == "ruber":
				rr2 += 1
				rb_zones[String(sp[2])] = int(rb_zones.get(String(sp[2]), 0)) + 1
				var qr := PhysicsShapeQueryParameters3D.new()
				qr.shape = rb_shape
				qr.transform = Transform3D(Basis(), (sp[1] as Vector3) + Vector3.UP * 1.2)
				qr.collision_mask = 1 | ULDoor.LAYER
				if not space.intersect_shape(qr, 4).filter(func(h): return not (h.collider is CharacterBody3D)).is_empty():
					rb_tight += 1
			else:
				bb += 1
		rb_n[mini(rr2, 2)] += 1
		lo = [mini(lo[0], a), mini(lo[1], bb)]
		hi = [maxi(hi[0], a), maxi(hi[1], bb)]
		sigs["%d/%d/%s" % [a, bb, str((plan[0][1] as Vector3).round())]] = true
	_ok("30 посещений: пустышей %d–%d, лоторейщиков %d–%d, каждый раз по-другому" % [lo[0], hi[0], lo[1], hi[1]], lo[0] >= 20 and hi[0] <= 40 and lo[1] >= 5 and hi[1] <= 15 and sigs.size() >= 25 and hi[0] - lo[0] >= 12)
	# --- Рубер: сколько, где, что в нём ---
	_ok("30 посещений: без Рубера — %d, один — %d, два — %d; больше двух не бывает" % rb_n, rb_n[0] > 0 and rb_n[1] > 0 and rb_n[2] > 0 and rb_n[0] + rb_n[1] + rb_n[2] == 30)
	_ok("Руберы — только в просторных местах (%s), телу хватает места" % str(rb_zones), rb_tight == 0 and not rb_zones.is_empty(), "тесно: %d" % rb_tight)
	var cnt := [0, 0, 0]
	var rr3 := RandomNumberGenerator.new()
	rr3.seed = 4242
	for i in 6000:
		cnt[ULSanatorium.ruber_count(rr3, c.ruber_chances)] += 1
	_ok("шансы 0 / 1 / 2 Руберов поровну (из 6000: %d / %d / %d), настраиваются в data/sanatorium.json" % cnt, cnt[0] > 1850 and cnt[0] < 2150 and cnt[1] > 1850 and cnt[1] < 2150 and cnt[2] > 1850 and cnt[2] < 2150 and (c.ruber_chances as Array).size() == 3)
	var sp_seen := {}
	var pea_seen := {}
	var pearl_n := 0
	var other := {}
	for sd4 in 4000:
		var got := {"spore": 0, "pea": 0, "pearl_black": 0}
		for it4 in ULEnemy.roll_loot("ruber", sd4):
			if it4 == null:
				continue
			if got.has(String(it4.id)):
				got[String(it4.id)] = int(it4.n)
			else:
				other[String(it4.id)] = true
		sp_seen[got.spore] = true
		pea_seen[got.pea] = true
		pearl_n += int(got.pearl_black)
		if int(got.pearl_black) > 1:
			other["две жемчужины"] = true
	var spk := sp_seen.keys()
	spk.sort()
	var pk := pea_seen.keys()
	pk.sort()
	_ok("в Рубере: споранов %s, горошин %s — всегда; чёрная жемчужина — в %.1f %% тел (шанс 15 %%), красных и белых нет" % [str(spk), str(pk), pearl_n / 40.0], spk == [3, 4, 5, 6, 7, 8, 9] and pk == [1, 2, 3] and pearl_n > 500 and pearl_n < 700 and other.is_empty(), str(other))
	var RB: Dictionary = ULEnemy.KINDS.ruber
	var LT: Dictionary = ULEnemy.KINDS.lottery
	var lt_max := 0.0
	for a5 in LT.attacks:
		lt_max = maxf(lt_max, float(a5.dmg))
	var rb_min := 999.0
	for a6 in RB.attacks:
		rb_min = minf(rb_min, float(a6.dmg))
	_ok("Рубер сильнее лоторейщика: прочность %d против %d, удары от %d против до %d, рост %.1f м" % [int(RB.hp), int(LT.hp), int(rb_min), int(lt_max), float(RB.height)], float(RB.hp) >= float(LT.hp) * 3.0 and rb_min > lt_max and float(RB.height) >= 2.0 and float(RB.height) <= 2.2)
	# 10: обыск тайника и тела
	var ci := -1
	for i in san.containers.size():
		var ct: Dictionary = san.containers[i]
		var any := false
		for it in ct.items:
			if it != null:
				any = true
		if any and int(ct.f) == 0 and (ct.pos as Vector3).distance_to(Vector3(0, 0, 21)) < 30.0:
			ci = i
			break
	if ci >= 0:
		var ct2: Dictionary = san.containers[ci]
		var cp: Vector3 = ct2.pos
		var stand: Vector3 = snapf.call(cp)
		player.global_position = stand + Vector3.UP * 0.1
		await get_tree().create_timer(0.3).timeout
		var t_ok: bool = _target != null and String(_target.type) == "box" and _action_label() == "Обыскать"
		var n0 := inv.used()
		do_action()
		await get_tree().process_frame
		_ok("тайник «%s» с добычей: подсветка, «Обыскать», открывается окно обыска" % String(ct2.n), t_ok and inv_ui.visible, "цель: %s" % _target_name())
		if out != "":
			await get_tree().create_timer(0.4).timeout
			await _snap("sn_search")
		close_inventory()
		_ok("в тайнике лежат вещи из таблицы добычи", n0 >= 0 and not (ct2.items as Array).filter(func(x): return x != null).is_empty())
	var kinds := {}
	for ct3 in san.containers:
		kinds[String(ct3.kind)] = true
	_ok("виды тайников: %s" % ", ".join(kinds.keys()), kinds.has("med") and kinds.has("bedside") and kinds.has("locker") and kinds.has("desk") and kinds.has("store") and kinds.has("kitchen"))
	# тело: убить врага — обыскать
	var victim: ULEnemy = null
	for e in enemies:
		if e.alive() and e.process_mode != Node.PROCESS_MODE_DISABLED and san.locate(e.global_position).x < 0:
			victim = e
			break
	if victim:
		player.global_position = victim.global_position + Vector3(1.2, 0.1, 0)
		victim.damage(999.0, player.global_position)
		await get_tree().create_timer(2.2).timeout
		player.global_position = victim.body_pos() + Vector3(0.6, 0.1, 0)
		await get_tree().create_timer(0.3).timeout
		_ok("убитого можно обыскать (цель — тело, «Обыскать»)", _target != null and String(_target.type) == "corpse" and _action_label() == "Обыскать")
	# --- Рубер в деле: хоздвор, герой в 9 м — замечает, срывается в рывок, бьёт с замахом ---
	var rp: Vector3 = snapf.call(Vector3(56, 0, 47))
	for e in enemies:
		if e.alive() and e.global_position.distance_to(rp) < 40.0:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	var rbr := spawn_enemy("ruber", rp)
	rbr.rotation.y = -PI * 0.5                      # лицом к герою (он западнее)
	player.global_position = snapf.call(rp + Vector3(-9, 0, 0)) + Vector3.UP * 0.1
	hp = HP_MAX
	var hp2 := hp
	var tr2 := 0.0
	var seen_alert := false
	var max_v := 0.0
	var windup := 0.0
	while tr2 < 16.0 and hp >= hp2:
		await get_tree().process_frame
		tr2 += get_process_delta_time()
		seen_alert = seen_alert or rbr.state == "alert"
		max_v = maxf(max_v, Vector3(rbr.velocity.x, 0, rbr.velocity.z).length())
		if rbr._hit_due > 0.0:
			windup = maxf(windup, rbr._hit_due)
	var own_clips := 0
	for cl in ["z_idle", "z_walk", "z_run", "z_scream", "z_attack_r", "z_attack_l", "z_overhead", "z_hit_front", "z_stagger", "z_death_back"]:
		if ResourceLoader.exists("res://assets/anim/ruber/%s.res" % cl):
			own_clips += 1
	_ok("Рубер заметил героя за 9 м, взревел, сорвался в рывок (до %.1f м/с при беге %.1f) и ударил: «%s», −%d здоровья, замах %.2f с" % [max_v, float(RB.run), rbr.last_attack, int(hp2 - hp), windup],
		seen_alert and rbr.charges >= 1 and max_v > float(RB.run) + 1.0 and hp2 - hp >= rb_min and windup >= 0.5, "рывков %d, состояние %s, %.1f с" % [rbr.charges, rbr.state, tr2])
	_ok("у Рубера свои движения: стоит, идёт, бежит, ревёт, бьёт правой, левой и двумя руками, вздрагивает, шатается, падает (%d из 10)" % own_clips, own_clips == 10)
	if out != "":
		await _snap("sn_ruber_fight")
	hp = HP_MAX
	player.global_position += Vector3(-3.0, 0, 0)
	var rhp := rbr.hp
	rbr.damage(30.0, player.global_position)
	var no_stag := rbr.rig.ap.current_animation
	rbr.damage(float(RB.stagger_dmg) + 5.0, player.global_position)
	_ok("обычное попадание Рубера не сбивает, сильное (от %d урона) — оглушает: удар сорван, он теряет равновесие" % int(RB.stagger_dmg), rbr.alive() and is_equal_approx(rbr.hp, rhp - 35.0 - float(RB.stagger_dmg)) and rbr._hit_due < 0.0, str(no_stag))
	rbr.damage(99999.0, player.global_position)
	_ok("Рубер убит: тяжело падает, тело не мешает пройти", not rbr.alive() and rbr.death_clip != "" and rbr.collision_layer == 0, rbr.death_clip)
	await get_tree().create_timer(2.6).timeout
	player.global_position = rbr.body_pos() + Vector3(0.7, 0.1, 0)
	await get_tree().create_timer(0.3).timeout
	var rl := {}
	for it5 in rbr.loot:
		if it5 != null:
			rl[String(it5.id)] = int(it5.n)
	var can_search: bool = _target != null and String(_target.type) == "corpse" and _target.e == rbr
	if can_search:
		do_action()
		await get_tree().process_frame
	_ok("тело Рубера обыскивается обычным окном: %s" % str(rl), can_search and inv_ui.visible and int(rl.get("spore", 0)) >= 3 and int(rl.get("spore", 0)) <= 9 and int(rl.get("pea", 0)) >= 1 and int(rl.get("pea", 0)) <= 3)
	if out != "":
		await get_tree().create_timer(0.3).timeout
		await _snap("sn_ruber_loot")
	close_inventory()
	# 11: таймер
	_ok("таймер кластера начат с 10:00 (настройка minutes в data/sanatorium.json)", cs_left() > 400.0 and cs_left() <= 600.0 and int(c.minutes) == 10 and _cs_end - float(cs_start) > 599.0, "%.1f с" % cs_left())
	_ok("убитые враги в этом посещении больше не появляются", _respawn.is_empty())
	var jn := 0
	var jb := {}
	for g in ground:
		if g.item != null and String(g.item.id) == "junk":
			jn += 1
			var l := san.locate((g.node as Node3D).global_position + Vector3.UP * 0.2)
			if l.x >= 0:
				jb[l.x] = int(jb.get(l.x, 0)) + 1
	_ok("хлам в корпусах: %d кучек, во всех шести" % jn, jb.size() == 6)
	# 14–15: уход с добычей; новая покупка; перезагрузка с героем внутри
	for e in enemies:
		if e.alive():
			e.state = "idle"
			e.global_position = e.home
	hp = HP_MAX
	inv.wallet = {"spore": 7, "pea": 1}
	ULBase.set_route("sanatorium", "active")
	player.global_position = Vector3(2, 0.1, size_m * 0.5 + 3.0)
	var tl := 0.0
	while not _cs_done and tl < LEAVE_S + 2.0:
		await get_tree().process_frame
		tl += get_process_delta_time()
	_ok("ушёл через ворота за край: посещение окончено, добыча при себе, маршрут закрыт", _cs_done and int(inv.wallet.get("spore", 0)) == 7 and ULBase.route_state("sanatorium") == "" and ULSettings.place == "home" and ULSettings.arrival_title == "Санаторий Луч", ULSettings.arrival_note)
	_ok("санатория снова нет на карте", not ULMap.place_shown("sanatorium"))
	inv.wallet = {"spore": 25}
	_offer_route("sanatorium")
	var rb := ULBase.buy_route(inv, "sanatorium")
	_ok("для нового посещения маршрут покупается снова (25 споранов) и появляется на карте", rb.ok and ULBase.route_state("sanatorium") == "bought" and int(inv.wallet.get("spore", 0)) == 0 and ULMap.place_shown("sanatorium"))
	_cs_done = false
	left_location = false
	_leave_t = 0.0
	ULSettings.place = "sanatorium"
	ULBase.set_route("sanatorium", "active")
	player.global_position = ULSanatorium.ENTRY + Vector3(0, 0.1, -3)
	inv.primary = ULItems.make("ak74m")
	inv.wallet = {"spore": 25, "pea": 2}
	var fake := "user://test_cluster.json"
	ULBase.write_json(fake, {"v": SAVE_V, "crates": [[1.0, 2.0, 0.0, [ULItems.make("ak74m")]]], "ground": [], "inv": inv.to_dict(), "hp": 80.0})
	_cs_end = Time.get_unix_time_from_system() + 0.5
	var tr := 0.0
	while not _cs_done and tr < 6.0:
		await get_tree().process_frame
		tr += get_process_delta_time()
	_save_carried(fake, true)
	var dd2 = JSON.parse_string(FileAccess.get_file_as_string(fake))
	_ok("время вышло: герой погиб, всё при себе потеряно, вещи на базе целы", _cs_done and inv.primary == null and inv.wallet.is_empty() and (dd2.crates as Array).size() == 1)
	_ok("кластер перезагрузился: маршрут закрыт, санатория нет на карте, герой — дома", ULBase.route_state("sanatorium") == "" and not ULMap.place_shown("sanatorium") and ULSettings.place == "home" and ULSettings.arrival_note.begins_with("Кластер перезагрузился"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(fake))
	ULSettings.place = "home"
	ULSettings.arrival_note = ""
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## «Разбитый конвой» (--as-test=cv; с --as-out=папка — ещё снимки): поле и зоны по карте, техника отдельными
## моделями, вход в палатки, кунг, пост и контейнер (крыша скрывается, дверь открывается), подъём на вышку,
## враг заходит в палатку, число и места врагов, тайники (техника, тела, ящики, мебель), добыча с патронами и
## хламом, таймер 10:00, уход с добычей, новая покупка за 35 споранов, перезагрузка с героем внутри.
func _cv_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 25000:
		await get_tree().process_frame
	var c := ULConvoy.ccfg()
	var cv := san as ULConvoy
	var map := get_world_3d().navigation_map
	var snapf := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	var space := get_world_3d().direct_space_state
	# 1: поле, вход, зоны
	_ok("конвой: поле %d×%d м, загружен и заселён, вход — снизу (юг)" % [int(size_m), int(size_m)], size_m == 150.0 and cs_ready and place == "convoy" and house == null and cv != null \
		and ULConvoy.C_ENTRY.z > 60.0 and absf(ULConvoy.C_ENTRY.x) < 8.0 and player.global_position.distance_to(ULConvoy.C_ENTRY) < 6.0, str(player.global_position))
	print("[inv] конвой готов через %.1f с от запуска игры (сборка локации и расстановка врагов)" % (sn_ready_ms / 1000.0))
	var pos := {}
	var names := []
	for b in san.blds:
		pos[b.id] = b.rect.get_center()
		names.append(b.title)
	var heli: Vector3 = ULConvoy.C_HELI[0]
	var lay: bool = pos.hq.x > 20.0 and pos.hq.y < -30.0 and pos.med.x > 20.0 and pos.med.y < -30.0 and pos.kung.x > 20.0 and pos.kung.y < -25.0 \
		and pos.post.x > 40.0 and absf(pos.post.y) < 12.0 and pos.store.x < -35.0 and pos.store.y > 25.0 and ULConvoy.C_TOWER.x < -35.0 and ULConvoy.C_TOWER.z < -35.0 \
		and heli.x > 35.0 and heli.z > 35.0 and (ULConvoy.C_ROAD[0] as Vector2).y > 70.0 and (ULConvoy.C_ROAD[ULConvoy.C_ROAD.size() - 1] as Vector2).y < -70.0
	_ok("зоны по карте: дорога с юга на север, посередине — колонна, лагерь справа вверху, блокпост справа, склад слева внизу, вышка слева вверху, Ми-8 справа внизу", lay, str(pos))
	_ok("помещения, куда можно зайти (%d): %s" % [san.blds.size(), ", ".join(names)], san.blds.size() == 7 and pos.has("hq") and pos.has("med") and pos.has("live1") and pos.has("live2") and pos.has("kung") and pos.has("post") and pos.has("store"))
	var hqb: ULBlock = null
	var medb: ULBlock = null
	var liveb: ULBlock = null
	var kungb: ULBlock = null
	for b in san.blds:
		match String(b.id):
			"hq": hqb = b
			"med": medb = b
			"live1": liveb = b
			"kung": kungb = b
	_ok("размеры палаток: штабная %.0f×%.0f м, медицинская %.0f×%.0f м, жилая %.0f×%.0f м" % [hqb.rect.size.x, hqb.rect.size.y, maxf(medb.rect.size.x, medb.rect.size.y), minf(medb.rect.size.x, medb.rect.size.y), maxf(liveb.rect.size.x, liveb.rect.size.y), minf(liveb.rect.size.x, liveb.rect.size.y)],
		absf(hqb.rect.size.x - 8.0) < 0.5 and absf(hqb.rect.size.y - 5.0) < 0.5 and absf(maxf(medb.rect.size.x, medb.rect.size.y) - 6.0) < 0.5 and absf(minf(medb.rect.size.x, medb.rect.size.y) - 4.0) < 0.5)
	# 2: техника — отдельные модели, сквозь неё не пройти
	var vk := {}
	var vhit := 0
	for v in ULConvoy.C_VEHICLES:
		vk[String(v[0])] = int(vk.get(String(v[0]), 0)) + 1
		var vp: Vector3 = v[1]
		var qv := PhysicsRayQueryParameters3D.create(vp + Vector3(0, 12, 0), vp + Vector3(0, 0.3, 0))
		qv.collision_mask = 1
		if not space.intersect_ray(qv).is_empty():
			vhit += 1
	var qh := PhysicsRayQueryParameters3D.create(heli + Vector3(0, 12, 0), heli + Vector3(0, 0.3, 0))
	qh.collision_mask = 1
	var heli_hit: bool = not space.intersect_ray(qh).is_empty()
	var vfiles := 0
	for vm in ULConvoy.C_VMODELS.values():
		if ResourceLoader.exists(ULSanatorium.MODELS + String(vm[0]) + ".glb"):
			vfiles += 1
	_ok("техника — отдельные модели: «Урал» целый %d, сгоревших %d, БТР-80 %d, ГАЗ-66 %d, УАЗ %d, грузовик снабжения %d, Ми-8 1; сквозь технику не пройти (%d из %d + вертолёт)" % [int(vk.get("ural", 0)), int(vk.get("wreck", 0)), int(vk.get("btr", 0)), int(vk.get("gaz66", 0)), int(vk.get("uaz", 0)), int(vk.get("kung", 0)), vhit, ULConvoy.C_VEHICLES.size()],
		int(vk.get("ural", 0)) == 1 and int(vk.get("wreck", 0)) == 2 and int(vk.get("btr", 0)) == 2 and int(vk.get("gaz66", 0)) == 1 and int(vk.get("uaz", 0)) == 2 and int(vk.get("kung", 0)) == 1 \
		and vhit == ULConvoy.C_VEHICLES.size() and heli_hit and vfiles == ULConvoy.C_VMODELS.size() and ResourceLoader.exists(ULSanatorium.MODELS + "ul_mi8.glb"))
	# 3: во все помещения есть путь от входа на локацию
	var e0: Vector3 = snapf.call(ULConvoy.C_ENTRY)
	var reach := 0
	var bad := []
	for b in san.blds:
		var tgt: Vector3 = snapf.call(Vector3(b.rect.get_center().x, 0.1, b.rect.get_center().y))
		var path := NavigationServer3D.map_get_path(map, e0, tgt, true)
		if path.size() > 1 and path[path.size() - 1].distance_to(tgt) < 0.6 and san.locate(tgt + Vector3.UP * 0.3).x >= 0:
			reach += 1
		else:
			bad.append(String(b.id))
	_ok("от входа на локацию есть путь внутрь каждой палатки, кунга, поста и контейнера: %d из %d" % [reach, san.blds.size()], reach == san.blds.size(), str(bad))
	# стены палаток и помещений непроходимы
	var wall_hits := 0
	var wall_rays := 0
	for b in san.blds:
		for bk in b.blocks:
			for k in 5:
				var u := (k - 2) * float(bk.hl) / 3.0
				var a0 := b._w(bk, u, 0.5, float(bk.hw) + 1.2)
				var a1 := b._w(bk, u, 0.5, float(bk.hw) - 0.5)
				var q := PhysicsRayQueryParameters3D.create(a0, a1)
				q.collision_mask = 1 | ULDoor.LAYER
				wall_rays += 1
				if not space.intersect_ray(q).is_empty():
					wall_hits += 1
	_ok("стены палаток и помещений непроходимы (лучи в стену: %d из %d упёрлись — остальные во входы)" % [wall_hits, wall_rays], wall_hits >= wall_rays * 0.8)
	# дальше — без врагов рядом с лагерем (иначе героя загрызут посреди проверки)
	for e in enemies:
		if e.global_position.distance_to(Vector3(38, 0, -45)) < 40.0:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	# 4: герой сам заходит в штабную палатку через полог; крыша скрывается, обстановка видна
	var hq_i := san.blds.find(hqb)
	var hq_out: Vector3 = snapf.call(hqb.entrances[0][0])
	var hq_in: Vector3 = snapf.call(Vector3(hqb.rect.get_center().x, 0.1, hqb.rect.get_center().y))
	player.global_position = hq_out + Vector3.UP * 0.1
	await get_tree().create_timer(0.5).timeout
	var roof0: bool = hqb._groups["b0/r"].visible and san.hero_b == -1
	await _walk(Array(NavigationServer3D.map_get_path(map, hq_out, hq_in, true)), 12.0)
	await get_tree().create_timer(0.4).timeout
	_ok("герой вошёл в штабную палатку через полог: крыша скрыта, обстановка видна; снаружи крыша была на месте", roof0 and san.hero_b == hq_i and not hqb._groups["b0/r"].visible and hqb._groups["b0/n0"].visible, "корпус %d, герой %s" % [san.hero_b, str(player.global_position)])
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.6).timeout
		await _snap("cv_hq")
	var hq_k := {}
	var med_k := {}
	var live_k := {}
	var all_k := {}
	for ct in san.containers:
		all_k[String(ct.kind)] = int(all_k.get(String(ct.kind), 0)) + 1
		if String(ct.get("bld", "")) == "hq":
			hq_k[String(ct.n)] = true
		elif String(ct.get("bld", "")) == "med":
			med_k[String(ct.n)] = true
		elif String(ct.get("bld", "")) == "live1":
			live_k[String(ct.n)] = true
	_ok("штаб: %s; медицинская: %s; жилая: %s" % [", ".join(hq_k.keys()), ", ".join(med_k.keys()), ", ".join(live_k.keys())], hq_k.size() >= 2 and med_k.size() >= 2 and live_k.size() >= 2 and hq_k.has("Металлический шкаф"))
	var nlamps := 0
	for b in san.blds:
		nlamps += b.lamps.size()
	_ok("в палатках и помещениях есть свет (ламп %d)" % nlamps, nlamps >= 7)
	player.global_position = hq_out + Vector3(0, 0.1, 4.0)
	await get_tree().create_timer(0.5).timeout
	_ok("вышел — палатка снова с крышей, внутренности скрыты", san.hero_b == -1 and hqb._groups["b0/r"].visible and not hqb._groups["b0/n0"].visible)
	# 5: кунг — дверь: закрытая — преграда, герой подошёл — открылась
	var door: ULDoor = null
	for d in san.doors:
		var dd := d as ULDoor
		if dd.center.distance_to(kungb.entrances[0][1]) < 2.0 or dd.center.distance_to(kungb.entrances[0][0]) < 2.0:
			door = dd
	var door_ok := false
	if door != null:
		door.set_open(false)
		player.global_position = door.center + Vector3(0, 0.1, 12.0)
		await get_tree().create_timer(0.6).timeout
		var nrm := door.global_transform.basis.z.normalized()
		var q2 := PhysicsRayQueryParameters3D.create(door.center + Vector3.UP * 1.0 + nrm * 1.0, door.center + Vector3.UP * 1.0 - nrm * 1.0)
		q2.collision_mask = 1 | ULDoor.LAYER
		var h0 := space.intersect_ray(q2)
		var blocked: bool = not h0.is_empty() and h0.collider == door and not door.open
		var k_out: Vector3 = snapf.call(kungb.entrances[0][0])
		player.global_position = k_out + Vector3.UP * 0.1
		await get_tree().create_timer(0.8).timeout
		var opened := door.open
		await _walk(Array(NavigationServer3D.map_get_path(map, k_out, snapf.call(Vector3(kungb.rect.get_center().x, 0.1, kungb.rect.get_center().y)), true)), 10.0)
		await get_tree().create_timer(0.3).timeout
		opened = opened or door.open
		door_ok = blocked and opened and san.hero_b == san.blds.find(kungb)
		_ok("командный кунг: закрытая дверь — преграда, герой подошёл — открылась, он вошёл внутрь; крыша кунга скрыта", door_ok and not kungb._groups["b0/r"].visible, "закрыта %s, открылась %s, корпус %d" % [blocked, opened, san.hero_b])
		if out != "":
			_cam_ready = false
			await get_tree().create_timer(0.6).timeout
			await _snap("cv_kung")
	else:
		_ok("у кунга есть дверь", false)
	# 6: враг заходит в палатку за героем
	var med_i := san.blds.find(medb)
	var med_in: Vector3 = snapf.call(Vector3(medb.rect.get_center().x, 0.1, medb.rect.get_center().y))
	var med_out: Vector3 = snapf.call((medb.entrances[0][0] as Vector3) + ((medb.entrances[0][0] as Vector3) - (medb.entrances[0][1] as Vector3)).normalized() * 7.0)
	player.global_position = med_in + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	var chaser := spawn_enemy("infected", med_out)
	chaser.state = "chase"
	chaser._last = player.global_position
	chaser._unseen = 0.0
	hp = HP_MAX
	var hp1 := hp
	var tch := 0.0
	while tch < 25.0 and hp >= hp1:
		await get_tree().process_frame
		tch += get_process_delta_time()
	_ok("пустыш снаружи зашёл за героем в медицинскую палатку и ударил: %.1f с" % tch, hp < hp1 and san.locate(chaser.global_position + Vector3.UP * 0.3).x == med_i, "состояние %s, враг %s" % [chaser.state, str(chaser.global_position)])
	hp = HP_MAX
	chaser.damage(999.0, player.global_position)
	# 7: вышка — герой поднимается по сходням, навес скрывается, наверху — ящик наблюдателя
	for e in enemies:
		if e.alive() and e.global_position.distance_to(ULConvoy.C_TOWER) < 30.0:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	var tw := ULConvoy.C_TOWER
	player.global_position = tw + Vector3(8.5, 0.1, -0.9)
	await get_tree().create_timer(0.5).timeout
	var troof0: bool = cv._tower_roof.visible
	_auto_r = 0.15
	await _walk([tw + Vector3(7.0, 0, -0.9), tw + Vector3(1.7, 3.3, -0.9), tw + Vector3(-0.6, 3.3, 0.8)], 20.0)
	_auto_r = 0.35
	await get_tree().create_timer(0.4).timeout
	var up_ok: bool = player.global_position.y > 3.0 and Vector2(player.global_position.x - tw.x, player.global_position.z - tw.z).length() < 2.2
	var crate_t: bool = _target != null and String(_target.type) == "box" and _target_name().contains("наблюдателя")
	_ok("герой поднялся на смотровую вышку (высота %.2f м): навес скрыт, ящик наблюдателя можно обыскать" % player.global_position.y, up_ok and troof0 and not cv._tower_roof.visible and crate_t, "цель: %s, герой %s" % [_target_name() if _target != null else "нет", str(player.global_position)])
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.6).timeout
		await _snap("cv_tower")
	_auto_r = 0.15
	await _walk([tw + Vector3(1.7, 3.3, -0.9), tw + Vector3(7.0, 0, -0.9), tw + Vector3(9.0, 0, -0.9)], 20.0)
	_auto_r = 0.35
	_ok("и спустился обратно (высота %.2f м), навес снова виден" % player.global_position.y, player.global_position.y < 0.5 and cv._tower_roof.visible)
	# 8: враги этого посещения
	var np := 0
	var nl := 0
	var nr := 0
	var zones := {}
	var inside := 0
	var near_entry := 0
	var stuck := 0
	var capsule := CapsuleShape3D.new()
	capsule.radius = 0.26
	capsule.height = 1.4
	for sp in cs_plan:
		if String(sp[0]) == "infected":
			np += 1
		elif String(sp[0]) == "lottery":
			nl += 1
		else:
			nr += 1
		var z := String(sp[2]).split(":")[0]
		zones[z] = int(zones.get(z, 0)) + 1
		var p: Vector3 = sp[1]
		if san.locate(p + Vector3.UP * 0.3).x >= 0:
			inside += 1
		if Vector2(p.x - ULConvoy.C_ENTRY.x, p.z - ULConvoy.C_ENTRY.z).length() < float(c.safe_r):
			near_entry += 1
		var qs := PhysicsShapeQueryParameters3D.new()
		qs.shape = capsule
		qs.transform = Transform3D(Basis(), p + Vector3.UP * 0.95)
		qs.collision_mask = 1
		var hits := space.intersect_shape(qs, 4).filter(func(h): return not (h.collider is CharacterBody3D))
		if not hits.is_empty():
			stuck += 1
			print("[inv]   в препятствии: %s %s (%s)" % [sp[0], str(p.snapped(Vector3.ONE * 0.1)), str(hits[0].collider)])
	_ok("пустышей %d (от %d до %d), лоторейщиков %d (от %d до %d), Руберов %d (0 или 1); всего %d" % [np, int(c.pustysh[0]), int(c.pustysh[1]), nl, int(c.lottery[0]), int(c.lottery[1]), nr, cs_plan.size()],
		np >= int(c.pustysh[0]) and np <= int(c.pustysh[1]) and nl >= int(c.lottery[0]) and nl <= int(c.lottery[1]) and nr <= 1 and cs_plan.size() >= 18 and cs_plan.size() <= 46)
	_ok("враги по зонам (%d в помещениях, %d снаружи): %s" % [inside, cs_plan.size() - inside, str(zones)], zones.size() >= 4)
	_ok("никто не стоит в технике, палатке, ящиках или дереве (проверка формой тела)", stuck == 0, "в препятствии: %d" % stuck)
	_ok("у входа (%d м) врагов нет" % int(c.safe_r), near_entry == 0)
	var lo := [99, 99]
	var hi := [0, 0]
	var sigs := {}
	var rb_n := [0, 0]
	var rb_zones := {}
	var rb_tight := 0
	var rb_near := 0
	var tot_lo := 999
	var tot_hi := 0
	var stuck30 := 0
	var entry30 := 0
	var rb_shape := CapsuleShape3D.new()
	rb_shape.radius = float(ULEnemy.KINDS.ruber.radius) + 0.1
	rb_shape.height = 2.0
	for sd in 30:
		var rng := RandomNumberGenerator.new()
		rng.seed = 9100 + sd * 7919
		var plan := san.spawn_plan(rng, snapf)
		var a := 0
		var bb := 0
		var rr2 := 0
		for sp in plan:
			var pp: Vector3 = sp[1]
			if Vector2(pp.x - ULConvoy.C_ENTRY.x, pp.z - ULConvoy.C_ENTRY.z).length() < float(c.safe_r):
				entry30 += 1
			var qs2 := PhysicsShapeQueryParameters3D.new()
			qs2.shape = capsule
			qs2.transform = Transform3D(Basis(), pp + Vector3.UP * 0.95)
			qs2.collision_mask = 1
			var hs2 := space.intersect_shape(qs2, 4).filter(func(h): return not (h.collider is CharacterBody3D))
			if not hs2.is_empty():
				stuck30 += 1
				if stuck30 <= 12:
					print("[inv]   в препятствии (посещение %d): %s %s %s (%s)" % [sd, sp[0], sp[2], str(pp.snapped(Vector3.ONE * 0.1)), str(hs2[0].collider)])
			if String(sp[0]) == "infected":
				a += 1
			elif String(sp[0]) == "ruber":
				rr2 += 1
				rb_zones[String(sp[2])] = int(rb_zones.get(String(sp[2]), 0)) + 1
				if Vector2(pp.x - ULConvoy.C_ENTRY.x, pp.z - ULConvoy.C_ENTRY.z).length() < float(c.ruber_safe_r):
					rb_near += 1
				var qr := PhysicsShapeQueryParameters3D.new()
				qr.shape = rb_shape
				qr.transform = Transform3D(Basis(), pp + Vector3.UP * 1.2)
				qr.collision_mask = 1 | ULDoor.LAYER
				if not space.intersect_shape(qr, 4).filter(func(h): return not (h.collider is CharacterBody3D)).is_empty():
					rb_tight += 1
			else:
				bb += 1
		rb_n[mini(rr2, 1)] += 1
		if rr2 > 1:
			rb_tight += 100
		lo = [mini(lo[0], a), mini(lo[1], bb)]
		hi = [maxi(hi[0], a), maxi(hi[1], bb)]
		tot_lo = mini(tot_lo, plan.size())
		tot_hi = maxi(tot_hi, plan.size())
		sigs["%d/%d/%s" % [a, bb, str((plan[0][1] as Vector3).round())]] = true
	_ok("30 посещений: пустышей %d–%d, лоторейщиков %d–%d, всего %d–%d, каждый раз по-другому" % [lo[0], hi[0], lo[1], hi[1], tot_lo, tot_hi], lo[0] >= 15 and hi[0] <= 35 and lo[1] >= 3 and hi[1] <= 10 and tot_lo >= 18 and tot_hi <= 46 and sigs.size() >= 25 and hi[0] - lo[0] >= 10)
	_ok("30 посещений: никто не в препятствии и не у входа", stuck30 == 0 and entry30 == 0, "в препятствии %d, у входа %d" % [stuck30, entry30])
	_ok("30 посещений: без Рубера — %d, с одним — %d, двух не бывает; места: %s; телу хватает места, от входа — дальше %d м" % [rb_n[0], rb_n[1], str(rb_zones), int(c.ruber_safe_r)], rb_n[0] > 0 and rb_n[1] > 0 and rb_tight == 0 and rb_near == 0, "тесно %d, близко %d" % [rb_tight, rb_near])
	var cnt := [0, 0]
	var rr3 := RandomNumberGenerator.new()
	rr3.seed = 5151
	for i in 6000:
		cnt[ULSanatorium.ruber_count(rr3, c.ruber_chances)] += 1
	var ch1 := float(c.ruber_chances[1]) / (float(c.ruber_chances[0]) + float(c.ruber_chances[1]))
	_ok("шанс Рубера %d %% (из 6000 посещений он был в %d), настраивается в data/convoy.json" % [int(round(ch1 * 100.0)), cnt[1]], absf(cnt[1] / 6000.0 - ch1) < 0.03 and (c.ruber_chances as Array).size() == 2)
	# 9: тайники — мебель в помещениях, техника, тела, ящики, бочки
	var need := ["truck", "cab", "wreck", "btr", "uaz", "heli", "soldier", "mil_ammo", "mil_med", "mil_docs", "mil_gear", "soldier_bag", "fuel"]
	var miss := []
	for k in need:
		if not all_k.has(k):
			miss.append(k)
	var veh_n := int(all_k.get("truck", 0)) + int(all_k.get("wreck", 0)) + int(all_k.get("btr", 0)) + int(all_k.get("uaz", 0)) + int(all_k.get("heli", 0))
	_ok("тайников %d: техника %d и кабины грузовиков %d, тела военных %d, армейские ящики %d, вещмешки %d, бочки %d и мебель в помещениях" % [san.containers.size(), veh_n, int(all_k.get("cab", 0)), int(all_k.get("soldier", 0)), int(all_k.get("mil_ammo", 0)) + int(all_k.get("mil_med", 0)) + int(all_k.get("mil_docs", 0)) + int(all_k.get("mil_gear", 0)), int(all_k.get("soldier_bag", 0)), int(all_k.get("fuel", 0))],
		miss.is_empty() and veh_n == 10 and int(all_k.get("cab", 0)) == 3 and int(all_k.get("soldier", 0)) == 8 and san.containers.size() >= 40, "нет видов: %s; %s" % [str(miss), str(all_k)])
	# у каждого тайника вне помещений можно встать и получить его целью
	for e in enemies:
		if e.alive():
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	var seen_k := {}
	var tried_k := {}
	var shot := {"truck": "cv_search_truck", "soldier": "cv_search_body", "btr": "cv_search_btr", "cab": "cv_search_cab"}
	for i in san.containers.size():
		var ct: Dictionary = san.containers[i]
		if ct.has("bld") or tried_k.has(String(ct.kind)):
			continue
		tried_k[String(ct.kind)] = true
		var cp: Vector3 = ct.pos
		if cp.y > 1.0:
			continue
		var sz: Vector3 = ct.size
		var got := false
		for ang in 12:
			var dir := Vector3(cos(ang * TAU / 12.0), 0, sin(ang * TAU / 12.0))
			var st: Vector3 = snapf.call(cp + dir * (maxf(sz.x, sz.z) * 0.5 + 0.7))
			if st.y > 0.6:
				continue
			player.global_position = st + Vector3.UP * 0.1
			player.velocity = Vector3.ZERO
			await get_tree().create_timer(0.25).timeout
			if _target != null and String(_target.type) == "box" and _action_label() == "Обыскать" and int(_target.i) == i:
				got = true
				break
		if got:
			seen_k[String(ct.kind)] = String(ct.n)
			if out != "" and shot.has(String(ct.kind)):
				ULInventory.put(ct.items, ULItems.make("a545", 30))
				ULInventory.put(ct.items, ULItems.make("junk", 2))
				do_action()
				await get_tree().create_timer(0.5).timeout
				await _snap(String(shot[String(ct.kind)]))
				close_inventory()
		else:
			print("[inv]   не выбирается: %s (%s) %s" % [ct.n, ct.kind, str(cp)])
	_ok("технику, тела, ящики и бочки можно обыскать (подсветка и «Обыскать»): %s" % ", ".join(seen_k.values()), seen_k.size() == tried_k.size() - (1 if not seen_k.has("mil_gear") and tried_k.has("mil_gear") else 0) and seen_k.has("truck") and seen_k.has("cab") and seen_k.has("btr") and seen_k.has("uaz") and seen_k.has("wreck") and seen_k.has("heli") and seen_k.has("soldier"), "%d из %d видов" % [seen_k.size(), tried_k.size()])
	# обыск кузова: окно обыска и перенос в карман
	var ti := -1
	for i in san.containers.size():
		if String(san.containers[i].kind) == "truck":
			ti = i
			break
	if ti >= 0:
		var tct: Dictionary = san.containers[ti]
		for k in (tct.items as Array).size():
			tct.items[k] = null
		ULInventory.put(tct.items, ULItems.make("a545", 30))
		ULInventory.put(tct.items, ULItems.make("junk", 2))
		var tsz: Vector3 = tct.size
		var opened_ui := false
		for ang in 12:
			var dir2 := Vector3(cos(ang * TAU / 12.0), 0, sin(ang * TAU / 12.0))
			player.global_position = snapf.call((tct.pos as Vector3) + dir2 * (maxf(tsz.x, tsz.z) * 0.5 + 0.7)) + Vector3.UP * 0.1
			await get_tree().create_timer(0.25).timeout
			if _target != null and String(_target.type) == "box" and int(_target.i) == ti:
				do_action()
				await get_tree().process_frame
				opened_ui = inv_ui.visible
				break
		var a0n := inv.count("a545")
		var j0n := inv.count("junk")
		var moved := 0
		for k in (tct.items as Array).size():
			if tct.items[k] != null and inv.add(tct.items[k]) == 0:
				tct.items[k] = null
				moved += 1
		_ok("кузов «%s»: открылось окно обыска, патроны (30) и хлам (2) перенесены герою" % String(tct.n), opened_ui and moved == 2 and inv.count("a545") == a0n + 30 and inv.count("junk") == j0n + 2, "окно %s, перенесено %d" % [opened_ui, moved])
		close_inventory()
	# 10: добыча по таблицам — 300 посещений
	var found := {}
	var unknown := {}
	var rngl := RandomNumberGenerator.new()
	rngl.seed = 777
	var with_ammo := 0
	var with_junk := 0
	for visit in 300:
		san.roll_containers(rngl)
		var va := false
		var vj := false
		for ct in san.containers:
			for it in ct.items:
				if it == null:
					continue
				var id := String(it.id)
				found[id] = int(found.get(id, 0)) + int(it.n)
				if not ULItems.ITEMS.has(id):
					unknown[id] = true
				if ULItems.kind(it) == "ammo":
					va = true
				if id == "junk":
					vj = true
		if va:
			with_ammo += 1
		if vj:
			with_junk += 1
	var ammo_ids := []
	var gun_ids := []
	var med_ids := []
	for id in found:
		var kd := ULItems.kind({"id": id, "n": 1})
		if kd == "ammo":
			ammo_ids.append(id)
		elif kd in ["primary", "pistol", "melee"]:
			gun_ids.append(id)
		if id in ["bandage", "medkit", "tonic"]:
			med_ids.append(id)
	_ok("добыча за 300 посещений: патроны (%s) — в %d посещениях, хлам — в %d; медикаменты: %s; оружие (только уже существующее): %s; еда, вода, рюкзаки" % [", ".join(ammo_ids), with_ammo, with_junk, ", ".join(med_ids), ", ".join(gun_ids)],
		with_ammo == 300 and with_junk == 300 and ammo_ids.size() >= 5 and med_ids.size() == 3 and gun_ids.size() >= 4 and unknown.is_empty() and found.has("can") and found.has("water"), "неизвестные предметы: %s; %s" % [str(unknown.keys()), str(found)])
	_ok("красных и белых жемчужин в тайниках нет; спораны и горох — с заражённых", not found.has("pearl_red") and not found.has("pearl_white") and not found.has("pearl_black") and not found.has("spore"))
	# рюкзаки: в добыче — только малый; средний и большой — только у торговца
	var big_in_loot := []
	for cfg_path in ["res://data/cowshed.json", "res://data/sanatorium.json", "res://data/convoy.json", "res://data/enemies.json"]:
		var txt_cfg := FileAccess.get_file_as_string(cfg_path)
		for pid in ["pack_medium", "pack_large"]:
			if txt_cfg.contains(pid):
				big_in_loot.append("%s: %s" % [cfg_path.get_file(), pid])
	var sold := {}
	for row in SHOP.supplies:
		sold[String(row[0])] = row[2]
	_ok("рюкзаки: в тайниках и телах всех кластеров — только малый; средний (%s) и большой (%s) — только у торговца" % [str(sold.get("pack_medium", "нет")), str(sold.get("pack_large", "нет"))],
		big_in_loot.is_empty() and not found.has("pack_medium") and not found.has("pack_large") and found.has("pack_small") and sold.has("pack_small") and sold.has("pack_medium") and sold.has("pack_large"), str(big_in_loot))
	san.roll_containers(rngl)
	# Рубер в конвое — тот же, что в санатории: добыча по своей таблице
	var rl_ok := true
	var pearl_n := 0
	for sd4 in 2000:
		var got4 := {"spore": 0, "pea": 0, "pearl_black": 0}
		for it4 in ULEnemy.roll_loot("ruber", sd4):
			if it4 == null:
				continue
			if got4.has(String(it4.id)):
				got4[String(it4.id)] = int(it4.n)
			else:
				rl_ok = false
		if int(got4.spore) < 3 or int(got4.spore) > 9 or int(got4.pea) < 1 or int(got4.pea) > 3 or int(got4.pearl_black) > 1:
			rl_ok = false
		pearl_n += int(got4.pearl_black)
	_ok("в Рубере: 3–9 споранов и 1–3 горошины всегда, чёрная жемчужина — в %.1f %% тел (шанс 15 %%), других жемчужин нет" % (pearl_n / 20.0), rl_ok and pearl_n > 230 and pearl_n < 370)
	# 11: хлам кучками у техники и в помещениях
	var jn := 0
	var j_in := 0
	for g in ground:
		if g.item != null and String(g.item.id) == "junk":
			jn += 1
			if san.locate((g.node as Node3D).global_position + Vector3.UP * 0.2).x >= 0:
				j_in += 1
	_ok("хлам лежит кучками: %d (в помещениях %d, у техники %d)" % [jn, j_in, jn - j_in], jn >= 12 and j_in >= 5 and jn - j_in >= 6)
	# 12: таймер
	_ok("таймер кластера начат с 10:00 (настройка minutes в data/convoy.json)", cs_left() > 300.0 and cs_left() <= 600.0 and int(c.minutes) == 10 and _cs_end - float(cs_start) > 599.0, "%.1f с" % cs_left())
	_ok("убитые враги в этом посещении больше не появляются", _respawn.is_empty())
	# 13: маршрут в компьютере и на карте
	var rt: Dictionary = ULBase.shop().get("routes", {}).get("convoy", {})
	_ok("маршрут «Разбитый конвой» в компьютере: 35 споранов", not rt.is_empty() and int((rt.price as Dictionary).get("spore", 0)) == 35 and (rt.price as Dictionary).size() == 1, str(rt.get("price", {})))
	var hr: Rect2 = ULMap.PLACES.home.rect
	var vr: Rect2 = ULMap.PLACES.convoy.rect
	_ok("на глобальной карте конвой — ниже домашнего стаба", vr.get_center().y > hr.end.y - 20.0, "%s / %s" % [str(hr), str(vr)])
	# 14–15: уход с добычей; новая покупка; перезагрузка с героем внутри
	hp = HP_MAX
	inv.wallet = {"spore": 7, "pea": 1}
	ULBase.set_route("convoy", "active")
	var a_keep := inv.count("a545")
	player.global_position = Vector3(ULConvoy.C_ENTRY.x, 0.1, size_m * 0.5 + 3.0)
	var tl := 0.0
	while not _cs_done and tl < LEAVE_S + 2.0:
		await get_tree().process_frame
		tl += get_process_delta_time()
	_ok("ушёл по дороге за южный край: посещение окончено, добыча при себе (патронов %d, споранов 7), маршрут закрыт" % a_keep, _cs_done and int(inv.wallet.get("spore", 0)) == 7 and inv.count("a545") == a_keep and a_keep >= 30 and ULBase.route_state("convoy") == "" and ULSettings.place == "home" and ULSettings.arrival_title == "Разбитый конвой", ULSettings.arrival_note)
	_ok("конвоя снова нет на карте", not ULMap.place_shown("convoy"))
	inv.wallet = {"spore": 34}
	_offer_route("convoy")
	var rb0 := ULBase.buy_route(inv, "convoy")
	_ok("за 34 спорана маршрут не купить", not rb0.ok and int(inv.wallet.get("spore", 0)) == 34 and not ULMap.place_shown("convoy"))
	inv.wallet = {"spore": 35}
	var rb1 := ULBase.buy_route(inv, "convoy")
	_ok("для нового посещения маршрут покупается снова (35 споранов) и появляется на карте", rb1.ok and ULBase.route_state("convoy") == "bought" and int(inv.wallet.get("spore", 0)) == 0 and ULMap.place_shown("convoy"))
	_cs_done = false
	left_location = false
	_leave_t = 0.0
	ULSettings.place = "convoy"
	ULBase.set_route("convoy", "active")
	player.global_position = hq_in + Vector3(0, 0.1, 0)
	inv.primary = ULItems.make("ak74m")
	inv.wallet = {"spore": 25, "pea": 2}
	var fake := "user://test_cluster.json"
	ULBase.write_json(fake, {"v": SAVE_V, "crates": [[1.0, 2.0, 0.0, [ULItems.make("ak74m")]]], "ground": [], "inv": inv.to_dict(), "hp": 80.0})
	_cs_end = Time.get_unix_time_from_system() + 0.5
	var tr := 0.0
	while not _cs_done and tr < 6.0:
		await get_tree().process_frame
		tr += get_process_delta_time()
	_save_carried(fake, true)
	var dd2 = JSON.parse_string(FileAccess.get_file_as_string(fake))
	_ok("время вышло (герой в палатке): он погиб, всё при себе потеряно, вещи на базе целы", _cs_done and inv.primary == null and inv.wallet.is_empty() and (dd2.crates as Array).size() == 1)
	_ok("кластер перезагрузился: маршрут закрыт, конвоя нет на карте, герой — дома", ULBase.route_state("convoy") == "" and not ULMap.place_shown("convoy") and ULSettings.place == "home" and ULSettings.arrival_note.begins_with("Кластер перезагрузился"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(fake))
	ULSettings.place = "home"
	ULSettings.arrival_note = ""
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## Бросок камня Рубера (--as-test=cvrock; с --as-out=папка — ещё снимки): на дороге конвоя Рубер в 14 м от героя —
## красная метка там, где стоит герой, через 3 с бросок, полёт по дуге, урон в круге, булыжник пропадает;
## герой вышел из круга — мимо; оглушение и гибель до броска срывают его; в палатку не бросает; вблизи — рывок.
func _rock_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 25000:
		await get_tree().process_frame
	var map := get_world_3d().navigation_map
	var snapf := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	for e in enemies:
		if e.alive():
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
	var RB: Dictionary = ULEnemy.KINDS.ruber
	var rk: Dictionary = RB.rock
	var aim := float(rk.aim_s)
	var fly := float(rk.fly_s)
	var hero_at: Vector3 = snapf.call(Vector3(18, 0, 1.5))
	var rb_at: Vector3 = snapf.call(Vector3(32, 0, 2.5))
	player.global_position = hero_at + Vector3.UP * 0.1
	player.velocity = Vector3.ZERO
	hp = HP_MAX
	await get_tree().create_timer(0.4).timeout
	var rb := spawn_enemy("ruber", rb_at)
	rb.rotation.y = atan2(hero_at.x - rb_at.x, hero_at.z - rb_at.z)
	var d0 := hero_at.distance_to(rb_at)
	# сброс между случаями: Рубер снова на своём месте, готов бросать, без рывка
	var reset := func() -> void:
		hp = HP_MAX
		player.global_position = hero_at + Vector3.UP * 0.1
		player.velocity = Vector3.ZERO
		rb.global_position = rb_at
		rb.velocity = Vector3.ZERO
		rb.state = "chase"
		rb._last = player.global_position
		rb._unseen = 0.0
		rb._rock_cd = 0.0
		rb._charge_t = 0.0
		rb._charge_cd = 99.0
		rb._atk = 0.0
		rb.rig.stop_action()
		ULEnemy.rock_next_ms = 0
	# --- 1: герой стоит в круге ---
	snd.log_on = true
	snd.played.clear()
	var tw := 0.0
	while tw < 8.0 and rb.rocks == 0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r1: ULRock = rb.rock
	var t_start_ms := Time.get_ticks_msec() - int(r1.t * 1000.0) if r1 != null else Time.get_ticks_msec()
	var ok1: bool = rb.rocks == 1 and r1 != null and rb.state == "rock"
	_ok("Рубер увидел героя за %.0f м (бросает с %d–%d м) и начал бросок: красная метка — там, где стоит герой, радиус %.1f м" % [d0, int(rk.from), int(rk.to), float(rk.r)],
		ok1 and Vector2(r1.at.x - player.global_position.x, r1.at.z - player.global_position.z).length() < 0.4 and is_equal_approx(r1.radius, float(rk.r)) and r1._mark.visible and r1.phase == "aim" and not r1.held,
		"бросков %d, состояние %s, клипы: %s / %s" % [rb.rocks, rb.state, "свой «вырывает»" if rb.rig.has_clip("rock_rip") else "нет rock_rip", "свой «бросает»" if rb.rig.has_clip("rock_throw") else "нет rock_throw"])
	if not ok1:
		print("[inv] итог: ошибок %d" % _fails)
		get_tree().quit()
		return
	var landed := [false, Vector3.ZERO]
	r1.landed.connect(func(a: Vector3, _r: float) -> void:
		landed[0] = true
		landed[1] = a)
	var hp0 := hp
	var t_grab := -1.0
	var t_rel := -1.0
	var max_h := 0.0
	var moved := 0.0
	var rb_p0 := rb.global_position
	while not landed[0] and r1.t < 9.0:
		await get_tree().process_frame
		if r1.held and t_grab < 0.0:
			t_grab = r1.t
		if r1.phase == "fly":
			if t_rel < 0.0:
				t_rel = r1.t
			max_h = maxf(max_h, r1.rock_pos().y if r1.rock_pos() != Vector3.INF else 0.0)
		if r1.phase == "aim":
			moved = maxf(moved, Vector2(rb.global_position.x - rb_p0.x, rb.global_position.z - rb_p0.z).length())
	var t_land := r1.t
	_ok("камень вырван из земли на %.1f с, ушёл из рук через %.2f с после метки (настройка — %d с), летел %.2f с по дуге (до %.1f м над землёй); до броска Рубер стоял на месте" % [t_grab, t_rel, int(aim), t_land - t_rel, max_h],
		t_grab > 0.3 and t_grab < t_rel and absf(t_rel - aim) < 0.25 and absf(t_land - t_rel - fly) < 0.25 and max_h > 2.2 and moved < 0.25, "сдвиг %.2f м" % moved)
	_ok("герой остался в круге: получил %d урона (настройка dmg — %d), камень упал точно в метку" % [int(hp0 - hp), int(rk.dmg)], is_equal_approx(hp0 - hp, float(rk.dmg)) and (landed[1] as Vector3).distance_to(r1.at) < 0.05)
	_ok("после попадания булыжник пропал", not r1._rock.visible and r1.phase == "done" and r1.rock_pos() == Vector3.INF)
	# звуки броска: свои файлы, по шагам и вовремя
	var sat := {}
	for pr in snd.played:
		var nm := String(pr[1])
		if nm.begins_with("rock_") and not sat.has(nm):
			sat[nm] = (int(pr[0]) - t_start_ms) / 1000.0
	var n_files := [snd._streams("rock_rip").size(), snd._streams("rock_throw").size(), snd._streams("rock_hit").size()]
	_ok("звуки броска — свои: «вырывает» на %.2f с (камень в руках на %.2f), «бросок» на %.2f с, «удар» на %.2f с; файлов %d / %d / %d" % [float(sat.get("rock_rip", -1.0)), t_grab, float(sat.get("rock_throw", -1.0)), float(sat.get("rock_hit", -1.0)), n_files[0], n_files[1], n_files[2]],
		# часы звуков и часы камня могут разойтись на кадр (медленный первый кадр броска) — сверяются промежутки
		sat.size() == 3 and absf(float(sat.rock_rip) - t_grab) < 0.45 and absf((float(sat.rock_throw) - float(sat.rock_rip)) - (t_rel - t_grab)) < 0.25 \
		and absf((float(sat.rock_hit) - float(sat.rock_throw)) - (t_land - t_rel)) < 0.25 and n_files == [1, 1, 2], str(sat))
	var lim: bool = AudioServer.get_bus_effect_count(0) > 0 and AudioServer.get_bus_effect(0, 0) is AudioEffectHardLimiter
	var d_rb := cam.global_position.distance_to(rb.global_position + Vector3.UP)
	var d_hit := cam.global_position.distance_to(r1.at)
	_ok("на общей шине — ограничитель громкости (громкие звуки рядом не хрипят); камера в %.0f м от Рубера и %.0f м от удара: слышно на %.0f и %.0f дБ от исходной громкости" % [d_rb, d_hit, 20.0 * log(6.0 / d_rb) / log(10.0), 20.0 * log(6.0 / d_hit) / log(10.0)],
		lim and d_rb < 60.0 and d_hit < 60.0)
	snd.log_on = false
	await get_tree().create_timer(0.9).timeout
	_ok("и метка погасла", is_instance_valid(r1) and float(r1._mm.get_shader_parameter("fade")) < 0.05)
	await get_tree().create_timer(1.6).timeout
	_ok("следы броска убраны со сцены", not is_instance_valid(r1))
	var cd_left := rb._rock_cd
	_ok("следующий бросок — не раньше чем через %d с (осталось %.1f)" % [int(rk.cd), cd_left], cd_left > float(rk.cd) - aim - fly - 4.0 and cd_left <= float(rk.cd))
	# --- 2: герой вышел из круга ---
	reset.call()
	tw = 0.0
	while tw < 8.0 and rb.rocks < 2:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r2: ULRock = rb.rock
	var mark2 := r2.at
	var landed2 := [false]
	r2.landed.connect(func(_a: Vector3, _r: float) -> void: landed2[0] = true)
	await get_tree().create_timer(0.8).timeout
	player.global_position = hero_at + Vector3(0, 0.1, float(rk.r) + 1.6)       # отошёл за край круга
	while not landed2[0] and r2.t < 9.0:
		await get_tree().process_frame
	_ok("герой вышел из круга: камень упал в прежнюю метку (за героем не доворачивает), урона нет", landed2[0] and is_equal_approx(hp, HP_MAX) and r2.at.distance_to(mark2) < 0.01 and mark2.distance_to(hero_at) < 0.5, "здоровье %.0f" % hp)
	# --- 3: оглушение до броска ---
	await get_tree().create_timer(0.5).timeout
	reset.call()
	tw = 0.0
	while tw < 8.0 and rb.rocks < 3:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r3: ULRock = rb.rock
	var landed3 := [false]
	r3.landed.connect(func(_a: Vector3, _r: float) -> void: landed3[0] = true)
	while not r3.held and r3.t < 4.0:
		await get_tree().process_frame
	rb.damage(float(RB.stagger_dmg) + 5.0, player.global_position)
	var st3 := rb.state
	var ph3 := r3.phase
	var vis3: bool = r3._rock.visible
	await get_tree().create_timer(aim + fly).timeout
	_ok("сильное попадание (от %d урона), пока камень в руках, срывает бросок: камень рассыпался, метка погасла, удара нет" % int(RB.stagger_dmg), ph3 == "done" and not vis3 and not landed3[0] and st3 != "rock" and rb.alive() and is_equal_approx(hp, HP_MAX) and not is_instance_valid(r3), "состояние %s" % st3)
	# --- 4: обычное попадание броска не срывает ---
	reset.call()
	tw = 0.0
	while tw < 8.0 and rb.rocks < 4:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r4: ULRock = rb.rock
	var landed4 := [false]
	r4.landed.connect(func(_a: Vector3, _r: float) -> void: landed4[0] = true)
	await get_tree().create_timer(0.6).timeout
	rb.damage(20.0, player.global_position)
	player.global_position = hero_at + Vector3(0, 0.1, float(rk.r) + 1.6)
	while not landed4[0] and r4.t < 9.0:
		await get_tree().process_frame
	_ok("обычное попадание (20 урона) броска не срывает", landed4[0] and rb.alive())
	# --- 5: убит до броска ---
	await get_tree().create_timer(0.5).timeout
	reset.call()
	tw = 0.0
	while tw < 8.0 and rb.rocks < 5:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r5: ULRock = rb.rock
	var landed5 := [false]
	r5.landed.connect(func(_a: Vector3, _r: float) -> void: landed5[0] = true)
	while not r5.held and r5.t < 4.0:
		await get_tree().process_frame
	rb.damage(99999.0, player.global_position)
	var ph5 := r5.phase
	await get_tree().create_timer(aim + fly).timeout
	_ok("Рубер убит до броска: камень рассыпался, метка погасла, удара нет", not rb.alive() and ph5 == "done" and not landed5[0] and is_equal_approx(hp, HP_MAX) and not is_instance_valid(r5))
	rb.visible = false
	# --- 6: вблизи не бросает — срывается в рывок ---
	hp = HP_MAX
	player.global_position = hero_at + Vector3.UP * 0.1
	var near_at: Vector3 = snapf.call(hero_at + (rb_at - hero_at).normalized() * 8.0)
	var rb2 := spawn_enemy("ruber", near_at)
	rb2.rotation.y = atan2(hero_at.x - near_at.x, hero_at.z - near_at.z)
	tw = 0.0
	while tw < 6.0 and rb2.charges == 0 and rb2.rocks == 0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	_ok("с 8 м (ближе %d м) камень не бросает — срывается в рывок" % int(rk.from), rb2.rocks == 0 and rb2.charges >= 1, "бросков %d, рывков %d" % [rb2.rocks, rb2.charges])
	rb2.damage(99999.0, player.global_position)
	rb2.visible = false
	hp = HP_MAX
	# --- 7: в палатку не бросает ---
	var hqb: ULBlock = san.blds[0]
	var hq_in: Vector3 = snapf.call(Vector3(hqb.rect.get_center().x, 0.1, hqb.rect.get_center().y))
	var out_dir := ((hqb.entrances[0][0] as Vector3) - (hqb.entrances[0][1] as Vector3)).normalized()
	var rb3_at: Vector3 = snapf.call((hqb.entrances[0][0] as Vector3) + out_dir * 13.0)
	player.global_position = hq_in + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	var rb3 := spawn_enemy("ruber", rb3_at)
	rb3.state = "chase"
	rb3._last = player.global_position
	rb3._charge_cd = 99.0
	await get_tree().create_timer(2.5).timeout
	_ok("герой в палатке: Рубер камень не бросает (только под открытым небом), а идёт к нему", not rb3.throw_ok and rb3.rocks == 0 and rb3.state != "rock" and rb3.global_position.distance_to(rb3_at) > 1.0, "под небом: %s, бросков %d, прошёл %.1f м" % [rb3.throw_ok, rb3.rocks, rb3.global_position.distance_to(rb3_at)])
	rb3.damage(99999.0, player.global_position)
	rb3.visible = false
	hp = HP_MAX
	# --- 8: герой подбежал вплотную, пока камень в руках: Рубер роняет камень и бьёт рукой ---
	var rb5_at: Vector3 = snapf.call(Vector3(32, 0, 2.5))
	player.global_position = hero_at + Vector3.UP * 0.1
	hp = HP_MAX
	ULEnemy.rock_next_ms = 0
	var rb5 := spawn_enemy("ruber", rb5_at)
	rb5.rotation.y = atan2(hero_at.x - rb5_at.x, hero_at.z - rb5_at.z)
	rb5._charge_cd = 99.0
	tw = 0.0
	while tw < 8.0 and rb5.rocks == 0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r8: ULRock = rb5.rock
	var had8 := r8 != null                 # сорванный камень через 1,7 с убирается со сцены (а убранный в Godot 4 == null)
	var landed8 := [false]
	if r8 != null:
		r8.landed.connect(func(_a: Vector3, _r: float) -> void: landed8[0] = true)
	await get_tree().create_timer(0.9).timeout
	var near_p: Vector3 = snapf.call(rb5.global_position + (hero_at - rb5.global_position).normalized() * 1.25)
	player.global_position = near_p + Vector3.UP * 0.1
	var st8 := "%s, шаг броска %d, до героя %.2f" % [rb5.state, rb5._rock_step, rb5.global_position.distance_to(player.global_position)]
	var hp8 := hp
	var t8 := 0.0
	while t8 < 4.0 and hp >= hp8:
		await get_tree().process_frame
		t8 += get_process_delta_time()
	_ok("герой подбежал вплотную, пока камень в руках: Рубер уронил камень (раскололся, метка погасла) и ударил рукой — «%s», −%d" % [rb5.last_attack, int(hp8 - hp)], had8 and not landed8[0] and hp < hp8 and rb5.last_attack != String(rk.n) and (not is_instance_valid(r8) or r8.phase == "done"), "состояние %s; при подходе: %s; упал ли камень: %s, видит: %s; камень %s, фаза %s, урон %d" % [rb5.state, st8, landed8[0], str(rb5.get_meta("sees", "?")), "нет" if not had8 else ("есть" if is_instance_valid(r8) else "убран"), r8.phase if r8 != null and is_instance_valid(r8) else "-", int(hp8 - hp)])
	rb5.damage(99999.0, player.global_position)
	rb5.visible = false
	hp = HP_MAX
	# --- 9: метка у палатки, герой успел зайти внутрь — камень бьёт в крышу, не в него ---
	var hq9: ULBlock = san.blds[0]
	var o_dir := ((hq9.entrances[0][0] as Vector3) - (hq9.entrances[0][1] as Vector3)).normalized()
	# у самого порога, но ещё снаружи (под небом)
	var e_out: Vector3 = snapf.call(hq9.entrances[0][0])
	for k in 30:
		var q0: Vector3 = (hq9.entrances[0][1] as Vector3) + o_dir * (0.1 * k)
		if san.locate(q0 + Vector3.UP * 0.3).x < 0:
			e_out = snapf.call(q0 + o_dir * 0.35)
			break
	var rb6_at: Vector3 = snapf.call(e_out + o_dir * 14.0)
	player.global_position = e_out + Vector3.UP * 0.1
	ULEnemy.rock_next_ms = 0
	await get_tree().create_timer(0.3).timeout
	var rb6 := spawn_enemy("ruber", rb6_at)
	rb6.rotation.y = atan2(e_out.x - rb6_at.x, e_out.z - rb6_at.z)
	rb6._charge_cd = 99.0
	tw = 0.0
	while tw < 8.0 and rb6.rocks == 0:
		await get_tree().process_frame
		tw += get_process_delta_time()
	var r9: ULRock = rb6.rock
	var landed9 := [false]
	var in9 := Vector3.INF
	if r9 != null:
		r9.landed.connect(func(_a: Vector3, _r: float) -> void: landed9[0] = true)
		var cen := Vector3(hq9.rect.get_center().x, r9.at.y, hq9.rect.get_center().y)
		var in_dir := -o_dir
		for k in 16:
			var q9 := r9.at + in_dir * (0.3 + k * 0.1)
			if san.locate(q9 + Vector3.UP * 0.3).x >= 0:
				in9 = snapf.call(q9 + in_dir * 0.35)
				break
	if in9 != Vector3.INF:
		player.global_position = in9 + Vector3.UP * 0.1
	hp = HP_MAX
	while r9 != null and is_instance_valid(r9) and not landed9[0] and r9.t < 9.0:
		await get_tree().process_frame
	var d9 := Vector2(in9.x - r9.at.x, in9.z - r9.at.z).length() if r9 != null and in9 != Vector3.INF else 99.0
	_ok("метка у входа в палатку, герой шагнул внутрь (%.1f м от середины метки — в круге): камень ударил в крышу, урона нет" % d9, landed9[0] and d9 <= float(rk.r) and is_equal_approx(hp, HP_MAX) and san.locate(player.global_position + Vector3.UP * 0.3).x >= 0, "здоровье %.0f" % hp)
	rb6.damage(99999.0, player.global_position)
	rb6.visible = false
	hp = HP_MAX
	# --- 10: два Рубера — круги не ставят одновременно ---
	player.global_position = hero_at + Vector3.UP * 0.1
	ULEnemy.rock_next_ms = 0
	var ra: Vector3 = snapf.call(hero_at + Vector3(14, 0, 1.0))
	var rbb: Vector3 = snapf.call(hero_at + Vector3(-15, 0, 2.0))
	var r1e := spawn_enemy("ruber", ra)
	var r2e := spawn_enemy("ruber", rbb)
	var t_r := [-1.0, -1.0]
	for re in [r1e, r2e]:
		re.rotation.y = atan2(hero_at.x - re.global_position.x, hero_at.z - re.global_position.z)
		re._charge_cd = 99.0
	tw = 0.0
	var both := 0
	var marks_max := 0
	while tw < 10.0:
		await get_tree().process_frame
		tw += get_process_delta_time()
		hp = HP_MAX
		if t_r[0] < 0.0 and r1e.rocks > 0:
			t_r[0] = tw
		if t_r[1] < 0.0 and r2e.rocks > 0:
			t_r[1] = tw
		var aiming := 0
		for re in [r1e, r2e]:
			if re.rock != null and is_instance_valid(re.rock) and re.rock.phase != "done":
				aiming += 1
		marks_max = maxi(marks_max, aiming)
	var gap_s := float(rk.get("gap", 4.0))
	var both_threw: bool = t_r[0] >= 0.0 and t_r[1] >= 0.0
	_ok("два Рубера: красных кругов одновременно не больше одного (%d); %s" % [marks_max, ("второй бросок — через %.1f с после первого" % absf(t_r[1] - t_r[0])) if both_threw else "второй, пока ждал, подошёл ближе 11 м и пошёл врукопашную"],
		marks_max == 1 and (t_r[0] >= 0.0 or t_r[1] >= 0.0) and (not both_threw or absf(t_r[1] - t_r[0]) >= gap_s - 0.1), str(t_r))
	for re in [r1e, r2e]:
		re.damage(99999.0, player.global_position)
		re.visible = false
	hp = HP_MAX
	# --- справочник ---
	var txt := " ".join(ULEnemy.describe("ruber"))
	_ok("в справочнике у Рубера описан бросок камня (метка, %d с, урон %d)" % [int(aim), int(rk.dmg)], txt.contains("Бросок камня") and txt.contains("красный круг") and txt.contains("%d урона" % int(rk.dmg)))
	# --- снимки ---
	if out != "":
		player.global_position = hero_at + Vector3.UP * 0.1
		var rb4 := spawn_enemy("ruber", rb_at)
		rb4.rotation.y = atan2(hero_at.x - rb_at.x, hero_at.z - rb_at.z)
		rb4._charge_cd = 99.0
		cam_dist = 13.0
		_cam_ready = false
		tw = 0.0
		while tw < 8.0 and rb4.rocks == 0:
			await get_tree().process_frame
			tw += get_process_delta_time()
		var r6: ULRock = rb4.rock
		var zc := Camera3D.new()
		add_child(zc)
		zc.fov = 42.0
		var side := Vector3(-(hero_at - rb_at).normalized().z, 0, (hero_at - rb_at).normalized().x)
		zc.look_at_from_position(rb_at + side * 4.6 + (hero_at - rb_at).normalized() * 1.2 + Vector3.UP * 1.9, rb_at + Vector3.UP * 1.25)
		while r6.t < 0.5:
			await get_tree().process_frame
		await _snap("rock_0_mark")
		_hud.visible = false
		zc.current = true
		var step := 0
		var marks := [float(rb4._rock_plan.grab) + 0.12, float(rb4._rock_plan.swing) - 0.25, aim - 0.5]
		while step < marks.size() and r6.t < aim + 0.2:
			await get_tree().process_frame
			if r6.t >= float(marks[step]):
				await _snap("rock_%d_ruber" % (step + 1))
				step += 1
		cam.current = true
		_hud.visible = true
		while r6.phase == "aim" and r6.t < 9.0:
			await get_tree().process_frame
		while r6.phase == "fly" and r6._ft < fly * 0.55:
			await get_tree().process_frame
		await _snap("rock_4_fly")
		while r6.phase == "fly":
			await get_tree().process_frame
		await get_tree().process_frame
		await get_tree().process_frame
		await _snap("rock_5_hit")
		zc.queue_free()
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## «Хутор» (--as-test=kh; с --as-out=папка — ещё снимки): по списку §16 задания — поле и раскладка, вход во все
## постройки, двери, крыши, магазин, сараи, спуск в погреб и подъём, вид подземного уровня, обыск, враги (число,
## места, в погребах — только пустыши), ИИ в доме и в погребе, таймер, маршрут 18 споранов, перезагрузка в погребе.
func _kh_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 25000:
		await get_tree().process_frame
	var c := ULKhutor.kcfg()
	var kh := san as ULKhutor
	var map := get_world_3d().navigation_map
	var snapf := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	var space := get_world_3d().direct_space_state
	print("[inv] хутор готов через %.1f с от запуска игры" % (sn_ready_ms / 1000.0))
	# 1–2: поле и раскладка
	var kinds := {}
	var by_id := {}
	for b in san.blds:
		var kd := String(b.def.get("kind", ""))
		kinds[kd] = int(kinds.get(kd, 0)) + 1
		by_id[b.id] = b
	_ok("хутор: поле %d×%d м, вход с юга; домов %d, магазин %d, сараев и гаражей %d, погребов %d" % [int(size_m), int(size_m), int(kinds.get("house", 0)), int(kinds.get("shop", 0)), int(kinds.get("shed", 0)), int(kinds.get("cellar", 0))],
		size_m == 150.0 and place == "khutor" and ULKhutor.K_ENTRY.z > 60.0 and int(kinds.get("house", 0)) >= 6 and int(kinds.get("house", 0)) <= 8 and int(kinds.get("shop", 0)) == 1 and int(kinds.get("shed", 0)) >= 3 and int(kinds.get("cellar", 0)) >= 2)
	var sizes := []
	for b in san.blds:
		if String(b.def.get("kind", "")) == "house":
			sizes.append("%.0f×%.0f" % [float(b.blocks[0].L), float(b.blocks[0].W)])
	_ok("дома разных размеров: %s (малый 7×6, средний 9×7, большой 11×8)" % ", ".join(sizes), sizes.has("7×6") and sizes.has("9×7") and sizes.has("11×8"))
	var roomt := {}
	for b in san.blds:
		for r in b.rooms:
			roomt[String(r.type)] = true
	_ok("в домах — общая комната с прихожей, кухня, спальня, кладовая, санузел; в магазине — зал, подсобка, склад", roomt.has("izba") and roomt.has("h_kitchen") and roomt.has("h_bed") and roomt.has("h_pantry") and roomt.has("h_bath") and roomt.has("shop") and roomt.has("shop_back") and roomt.has("shop_stock"), str(roomt.keys()))
	var nmod := 0
	var mod_ids := {}
	for b in san.blds:
		nmod += b.models.size()
		for m in b.models:
			mod_ids[String(m[0])] = true
	_ok("мебель — модели Tripo (%d шт., %d видов: %s)" % [nmod, mod_ids.size(), ", ".join(mod_ids.keys())], nmod >= 40 and mod_ids.size() >= 6)
	# 3: путь от входа на поле внутрь каждой постройки (в погреба — по лестнице вниз) и ко всему полу внутри:
	# пол сеткой 0,5 м — каждая точка, где есть навигация, достижима от входной двери (мебель не перекрывает проходы)
	var e0: Vector3 = snapf.call(ULKhutor.K_ENTRY)
	var reach := 0
	var bad := []
	var floor_pts := 0
	var floor_bad := []
	for b in san.blds:
		var ins: Vector3 = snapf.call(b.entrances[0][1])
		var path := NavigationServer3D.map_get_path(map, e0, ins, true)
		if path.size() > 1 and path[path.size() - 1].distance_to(ins) < 0.6 and san.locate(ins + Vector3.UP * 0.3).x >= 0:
			reach += 1
		else:
			bad.append("%s (%s)" % [b.id, str(ins.snapped(Vector3.ONE * 0.1))])
		var gx := b.rect.position.x + 0.5
		while gx < b.rect.end.x - 0.3:
			var gz := b.rect.position.y + 0.5
			while gz < b.rect.end.y - 0.3:
				var q := Vector3(gx, b.base_y + 0.1, gz)
				var qn := NavigationServer3D.map_get_closest_point(map, q)
				if Vector2(qn.x - q.x, qn.z - q.z).length() < 0.2 and absf(qn.y - q.y) < 0.5:
					floor_pts += 1
					var pq := NavigationServer3D.map_get_path(map, ins, qn, true)
					if pq.size() == 0 or pq[pq.size() - 1].distance_to(qn) > 0.3:
						floor_bad.append("%s %s" % [b.id, str(Vector2(gx, gz))])
				gz += 0.5
			gx += 0.5
	_ok("от входа на поле есть путь внутрь каждой постройки, в погреба — по лестнице: %d из %d" % [reach, san.blds.size()], reach == san.blds.size(), str(bad))
	_ok("весь пол внутри построек достижим от входной двери (мебель не перекрывает проходы): %d точек, отрезано %d" % [floor_pts, floor_bad.size()], floor_pts > 800 and floor_bad.is_empty(), str(floor_bad.slice(0, 10)))
	# стены непроходимы
	var wall_hits := 0
	var wall_rays := 0
	for b in san.blds:
		if b.style == "cellar":
			continue
		for bk in b.blocks:
			for k in 5:
				var u := (k - 2) * float(bk.hl) / 3.0
				var q := PhysicsRayQueryParameters3D.create(b._w(bk, u, 0.5, float(bk.hw) + 1.2), b._w(bk, u, 0.5, float(bk.hw) - 0.5))
				q.collision_mask = 1 | ULDoor.LAYER
				wall_rays += 1
				if not space.intersect_ray(q).is_empty():
					wall_hits += 1
	_ok("стены построек непроходимы (лучи в стену: %d из %d упёрлись — остальные во входы)" % [wall_hits, wall_rays], wall_hits >= wall_rays * 0.8)
	for e in enemies:
		e.state = "dead"
		e.visible = false
		e.process_mode = Node.PROCESS_MODE_DISABLED
	# 4–5: большой дом — дверь крыльца, вход, крыша скрыта
	var h1: ULBlock = by_id["h1"]
	var hi := san.blds.find(h1)
	var door: ULDoor = null
	for d in san.doors:
		var dd := d as ULDoor
		if dd.get_meta("ext", false) and dd.center.distance_to(h1.entrances[0][0]) < 3.0:
			door = dd
	var blocked := false
	if door != null:
		door.set_open(false)
		await get_tree().create_timer(0.8).timeout       # дверь закрывается не мгновенно (была открыта)
		await get_tree().physics_frame
		var nrm := door.global_transform.basis.z.normalized()
		var q2 := PhysicsRayQueryParameters3D.create(door.center + Vector3.UP + nrm, door.center + Vector3.UP - nrm)
		q2.collision_mask = 1 | ULDoor.LAYER
		var hh := space.intersect_ray(q2)
		blocked = not hh.is_empty() and hh.collider == door
	var h_out: Vector3 = snapf.call(h1.entrances[0][0])
	player.global_position = h_out + Vector3.UP * 0.1
	await get_tree().create_timer(0.5).timeout
	var roof0: bool = h1._groups["b0/r"].visible and san.hero_b == -1
	await _walk(Array(NavigationServer3D.map_get_path(map, h_out, snapf.call(Vector3(h1.rect.get_center().x, 0.1, h1.rect.get_center().y)), true)), 12.0)
	await get_tree().create_timer(0.4).timeout
	_ok("большой дом: закрытая дверь — преграда, герой подошёл — открылась, вошёл; крыша скрыта, комнаты видны", blocked and door != null and door.open and roof0 and san.hero_b == hi and not h1._groups["b0/r"].visible and h1._groups["b0/n0"].visible, "дверь %s, закрыта %s, корпус %d" % [door != null, blocked, san.hero_b])
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.6).timeout
		await _snap("kh_house")
	player.global_position = h_out + Vector3(0, 0.1, 4.0)
	await get_tree().create_timer(0.5).timeout
	_ok("вышел — крыша снова на месте", san.hero_b == -1 and h1._groups["b0/r"].visible)
	# 6: магазин — вывеска, зал, прилавок и полки
	var shop: ULBlock = by_id["shop"]
	var sign_ok := false
	for n in san.find_children("*", "Label3D", true, false):
		if (n as Label3D).text == "МАГАЗИН":
			sign_ok = true
	var s_out: Vector3 = snapf.call(shop.entrances[0][0])
	player.global_position = s_out + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	await _walk(Array(NavigationServer3D.map_get_path(map, s_out, snapf.call(Vector3(shop.rect.get_center().x - 1.0, 0.1, shop.rect.get_center().y)), true)), 12.0)
	await get_tree().create_timer(0.3).timeout
	var shop_k := {}
	for ct in shop.containers:
		shop_k[String(ct.n)] = true
	_ok("магазин: вывеска «МАГАЗИН», герой вошёл, внутри %s" % ", ".join(shop_k.keys()), sign_ok and san.hero_b == san.blds.find(shop) and shop_k.has("Прилавок") and shop_k.has("Полка магазина"))
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.6).timeout
		await _snap("kh_shop")
	# 7: сарай
	var barn: ULBlock = by_id["barn"]
	var b_out: Vector3 = snapf.call(barn.entrances[0][0])
	player.global_position = b_out + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	await _walk(Array(NavigationServer3D.map_get_path(map, b_out, snapf.call(Vector3(barn.rect.get_center().x, 0.1, barn.rect.get_center().y)), true)), 12.0)
	await get_tree().create_timer(0.3).timeout
	_ok("сарай: герой зашёл в ворота, крыша скрыта", san.hero_b == san.blds.find(barn) and not barn._groups["b0/r"].visible)
	# гараж — металлический, ворота из двух створок открываются наружу
	var gar: ULBlock = by_id["garage"]
	var gout: Vector3 = (gar.entrances[0][0] as Vector3) - (gar.entrances[0][1] as Vector3)
	gout.y = 0.0
	gout = gout.normalized()
	var leaves := 0
	var outward := 0
	for d in gar.doors:
		var gd := d as ULDoor
		if not gd.has_meta("ext"):
			continue
		leaves += 1
		gd.set_open(true)
		for t in 60:
			gd.tick(0.05)                     # повернуть полотно до конца (двери далеко от героя сами не тикают)
	for d in gar.doors:
		var gd := d as ULDoor
		# середина полотна (не петля): у открытой наружу — снаружи стены
		var mid: Vector3 = gd.panel.global_transform * Vector3(gd.width * 0.5, 1.0, 0)
		if gd.has_meta("ext") and (mid - gd.center).dot(gout) > 0.25:
			outward += 1
	_ok("гараж: стены из профлиста, ворота из двух металлических створок открываются наружу", String(gar.def.skin) == "roof_tin" and leaves == 2 and outward == 2, "створок %d, наружу %d" % [leaves, outward])
	# 8–10: погреб — спуск по лестнице, вид уровня −1, свет, подъём
	var cl: Dictionary = kh.cellars[0]
	var cb: ULBlock = san.blds[int(cl.bi)]
	var cdoor: ULDoor = cl.door
	var top: Vector3 = snapf.call(cdoor.center + Vector3(0, 0, 1.6))
	# проверка лестницы, а не боя: враги у погреба — в стороне (иначе встают на марш и сталкивают героя)
	for e in enemies:
		if is_instance_valid(e) and e.alive() and e.global_position.distance_to(top) < 22.0:
			e.global_position += Vector3(0, -50, 0)
			e.set_active(false)
			e.state = "idle"
	player.global_position = top + Vector3.UP * 0.1
	await get_tree().create_timer(0.5).timeout
	var cut0 := float(kh._ground_mat.get_shader_parameter("cut_on"))
	var room: Vector3 = snapf.call(Vector3(cb.rect.get_center().x, cb.base_y + 0.05, cb.rect.get_center().y))
	var down := NavigationServer3D.map_get_path(map, top, room, true)
	_auto_r = 0.15
	var min_y := 99.0
	_auto = Array(down)
	var tw := 0.0
	while not _auto.is_empty() and tw < 15.0:
		await get_tree().process_frame
		tw += get_process_delta_time()
		min_y = minf(min_y, player.global_position.y)
	_auto.clear()
	_auto_r = 0.35
	await get_tree().create_timer(0.5).timeout
	var lights_on := 0
	for l in san._lights:
		if l.visible:
			lights_on += 1
	_ok("погреб: дверь погреба открылась, герой спустился по лестнице на %.2f м (пол — %.1f м), не провалился (ниже всего %.2f)" % [player.global_position.y, cb.base_y, min_y],
		cdoor.open and absf(player.global_position.y - cb.base_y) < 0.3 and min_y > cb.base_y - 0.3 and san.hero_b == int(cl.bi), "путь %d точек, герой %s" % [down.size(), str(player.global_position)])
	_ok("под землёй: земля над погребом вырезана, вход и насыпь скрыты, вокруг — срез земли; перекрытие скрыто, стены со стороны камеры срезаны; горит лампа",
		cut0 < 0.5 and float(kh._ground_mat.get_shader_parameter("cut_on")) > 0.5 and not (cl.cover as Node3D).visible and (cl.pit as Node3D).visible and not cb._groups["b0/r"].visible and cb._groups["b0/n0"].visible and lights_on >= 1, "ламп %d" % lights_on)
	if out != "":
		_cam_ready = false
		await get_tree().create_timer(0.7).timeout
		await _snap("kh_cellar")
	# обыск полки в погребе
	var ci := -1
	for i in san.containers.size():
		if String(san.containers[i].get("bld", "")) == cb.id:
			ci = i
			break
	var opened := false
	if ci >= 0:
		var ct: Dictionary = san.containers[ci]
		var sz: Vector3 = ct.size
		for ang in 12:
			var dir := Vector3(cos(ang * TAU / 12.0), 0, sin(ang * TAU / 12.0))
			var st: Vector3 = snapf.call((ct.pos as Vector3) + dir * (maxf(sz.x, sz.z) * 0.5 + 0.55))
			if absf(st.y - cb.base_y) > 0.3:
				continue
			player.global_position = st + Vector3.UP * 0.1
			await get_tree().create_timer(0.25).timeout
			if _target != null and String(_target.type) == "box" and int(_target.i) == ci and _action_label() == "Обыскать":
				do_action()
				await get_tree().process_frame
				opened = inv_ui.visible
				break
		if out != "" and opened:
			await get_tree().create_timer(0.4).timeout
			await _snap("kh_cellar_search")
		close_inventory()
	_ok("в погребе: «%s» — подсветка, «Обыскать», окно обыска" % (String(san.containers[ci].n) if ci >= 0 else "нет тайника"), opened)
	# подъём (проверка лестницы, а не боя: враги погреба — в стороне, иначе ударами сталкивают героя вниз)
	for e in enemies:
		if is_instance_valid(e) and e.alive() and e.global_position.distance_to(player.global_position) < 20.0:
			e.global_position += Vector3(0, -50, 0)
			e.set_active(false)
			e.state = "idle"
	var upath := NavigationServer3D.map_get_path(map, snapf.call(player.global_position), snapf.call(top + Vector3(0, 0, 1.5)), true)
	_auto_r = 0.15
	await _walk(Array(upath), 15.0)
	_auto_r = 0.35
	await get_tree().create_timer(0.4).timeout
	_ok("поднялся на поверхность (высота %.2f): вырез закрыт, вход и насыпь на месте" % player.global_position.y, player.global_position.y > -0.1 and san.hero_b == -1 and float(kh._ground_mat.get_shader_parameter("cut_on")) < 0.5 and (cl.cover as Node3D).visible and not (cl.pit as Node3D).visible)
	# 11: тайники
	var ck := {}
	for ct in san.containers:
		ck[String(ct.kind)] = int(ck.get(String(ct.kind), 0)) + 1
	_ok("тайников %d: %s" % [san.containers.size(), str(ck)], san.containers.size() >= 80 and ck.has("fridge") and ck.has("jars") and ck.has("shop") and ck.has("counter") and ck.has("cellar") and ck.has("car") and ck.has("tractor") and ck.has("tools"))
	# подвалы — как здания: несколько помещений с дверями, свет в каждом, тайники; над ними на поверхности пусто
	var cinfo := []
	var cel_ok := true
	var sp3 := get_world_3d().direct_space_state
	for ci2 in kh.cellars.size():
		var cbb: ULBlock = san.blds[int(kh.cellars[ci2].bi)]
		var nct := 0
		for ct in san.containers:
			if kh.cellar_at((ct.pos as Vector3) + Vector3.UP * 0.2) == ci2:
				nct += 1
		var ndoor := 0
		for d in cbb.doors:
			if not (d as ULDoor).has_meta("ext"):
				ndoor += 1
		var cut: Vector4 = kh.cellars[ci2].cut
		var hits := 0
		var qs := PhysicsShapeQueryParameters3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(cut.z - cut.x, 2.5, cut.w - cut.y)
		qs.shape = bs
		qs.transform = Transform3D(Basis(), Vector3((cut.x + cut.z) * 0.5, 1.4, (cut.y + cut.w) * 0.5))
		qs.collision_mask = 1
		var hr2: Rect2 = kh.cellars[ci2].hole
		for h in sp3.intersect_shape(qs, 64):
			var o: Object = h.collider
			if o is CharacterBody3D:
				continue                      # враги и герой — не постройки
			var sh_i: int = h.shape
			var owner_id: int = (o as CollisionObject3D).shape_find_owner(sh_i)
			var sn := (o as CollisionObject3D).shape_owner_get_owner(owner_id) as Node3D
			var sp_g := sn.global_position if sn != null else Vector3.ZERO
			# свои: портал, насыпь у лестницы, стенки колодца
			if sn != null and Rect2(hr2.position - Vector2(2.6, 1.8), hr2.size + Vector2(5.2, 3.6)).has_point(Vector2(sp_g.x, sp_g.z)):
				continue
			if sn != null and sp_g.y < 0.0:
				continue
			hits += 1
			var hs := sn.shape as Shape3D if sn is CollisionShape3D else null
			cinfo.append("сверху: %s %s %s" % [sn.name if sn != null else "?", str(sp_g.snapped(Vector3.ONE * 0.1)), str(hs.get("size")) if hs != null else ""])
		cinfo.append("%s %.0f×%.0f м: помещений %d, дверей %d, ламп %d, тайников %d, препятствий сверху %d" % [cbb.id, cbb.rect.size.x, cbb.rect.size.y, cbb.rooms.size(), ndoor, cbb.lamps.size(), nct, hits])
		cel_ok = cel_ok and cbb.rooms.size() >= 3 and ndoor >= 2 and cbb.lamps.size() >= 3 and nct >= 6 and hits == 0 and cbb.rect.size.x * cbb.rect.size.y >= 50.0
	_ok("подвалы — подземные здания: зал и кладовые с дверями, свет в каждом помещении, тайники; над подвалом на поверхности пусто", cel_ok, "; ".join(cinfo))
	var found := {}
	var unknown := {}
	var rngl := RandomNumberGenerator.new()
	rngl.seed = 4040
	for v in 200:
		san.roll_containers(rngl)
		for ct in san.containers:
			for it in ct.items:
				if it == null:
					continue
				found[String(it.id)] = int(found.get(String(it.id), 0)) + 1
				if not ULItems.ITEMS.has(String(it.id)):
					unknown[String(it.id)] = true
	_ok("добыча за 200 посещений: еда (тушёнка %d, сухари %d), вода %d, медицина (бинты %d, аптечки %d), хлам %d — больше всего хлама и припасов; оружия почти нет" % [int(found.get("can", 0)), int(found.get("rusk", 0)), int(found.get("water", 0)), int(found.get("bandage", 0)), int(found.get("medkit", 0)), int(found.get("junk", 0))],
		unknown.is_empty() and int(found.get("junk", 0)) > int(found.get("a12", 0)) * 5 and found.has("can") and found.has("water") and found.has("medkit") and not found.has("pack_medium") and not found.has("pack_large") and not found.has("pearl_black"), str(found))
	san.roll_containers(rngl)
	# 12: враги
	var np := 0
	var nl := 0
	var nr := 0
	var zones := {}
	var near_entry := 0
	var stuck := 0
	var cap := CapsuleShape3D.new()
	cap.radius = 0.26
	cap.height = 1.4
	for sp in cs_plan:
		match String(sp[0]):
			"infected":
				np += 1
			"lottery":
				nl += 1
			_:
				nr += 1
		zones[String(sp[2])] = int(zones.get(String(sp[2]), 0)) + 1
		var p: Vector3 = sp[1]
		if Vector2(p.x - ULKhutor.K_ENTRY.x, p.z - ULKhutor.K_ENTRY.z).length() < float(c.safe_r):
			near_entry += 1
		var qs := PhysicsShapeQueryParameters3D.new()
		qs.shape = cap
		qs.transform = Transform3D(Basis(), p + Vector3.UP * 0.95)
		qs.collision_mask = 1
		if not space.intersect_shape(qs, 4).filter(func(h): return not (h.collider is CharacterBody3D)).is_empty():
			stuck += 1
	_ok("пустышей %d (20–30), лоторейщиков %d (4–9), Руберов %d (0–1), всего %d (24–40); места: %s" % [np, nl, nr, cs_plan.size(), str(zones)], np >= 20 and np <= 30 and nl >= 4 and nl <= 9 and nr <= 1 and zones.size() >= 5)
	_ok("никто не в стене, мебели, технике или дереве и не у входа (%d м)" % int(c.safe_r), stuck == 0 and near_entry == 0, "в препятствии %d, у входа %d" % [stuck, near_entry])
	var lo := [99, 99]
	var hi2 := [0, 0]
	var rb_n := [0, 0]
	var cel_bad := 0
	var cel_n := 0
	var cel_lot := 0
	var cel_each := 0
	var sigs := {}
	for sd in 30:
		var rng := RandomNumberGenerator.new()
		rng.seed = 6100 + sd * 7919
		var plan := san.spawn_plan(rng, snapf)
		var a := 0
		var bb := 0
		var rr := 0
		var cel_here := 0
		for sp in plan:
			var p: Vector3 = sp[1]
			var in_cel := kh.cellar_at(p + Vector3.UP * 0.3) >= 0
			if in_cel:
				cel_n += 1
				cel_here += 1
				if String(sp[0]) == "lottery":
					cel_lot += 1
				elif String(sp[0]) != "infected":
					cel_bad += 1
			match String(sp[0]):
				"infected":
					a += 1
				"lottery":
					bb += 1
				_:
					rr += 1
		rb_n[mini(rr, 1)] += 1
		if cel_here > 0:
			cel_each += 1
		lo = [mini(lo[0], a), mini(lo[1], bb)]
		hi2 = [maxi(hi2[0], a), maxi(hi2[1], bb)]
		sigs[str(a) + "/" + str(bb) + str((plan[0][1] as Vector3).round())] = true
	_ok("30 посещений: пустышей %d–%d, лоторейщиков %d–%d, без Рубера %d раз, с одним — %d; каждый раз по-другому" % [lo[0], hi2[0], lo[1], hi2[1], rb_n[0], rb_n[1]], lo[0] >= 20 and hi2[0] <= 30 and lo[1] >= 4 and hi2[1] <= 9 and rb_n[0] > 0 and rb_n[1] > 0 and sigs.size() >= 25)
	_ok("в подвалах за 30 посещений — %d заражённых (из них лоторейщиков %d), враги внизу в %d посещениях из 30; Рубера под землёй нет" % [cel_n, cel_lot, cel_each], cel_n >= 60 and cel_lot > 0 and cel_each >= 27 and cel_bad == 0)
	# 13: ИИ — пустыш со двора заходит в дом к герою; другой спускается за героем в погреб
	var h_in: Vector3 = snapf.call(Vector3(h1.rect.get_center().x, 0.1, h1.rect.get_center().y))
	player.global_position = h_in + Vector3.UP * 0.1
	hp = HP_MAX
	await get_tree().create_timer(0.3).timeout
	var ch := spawn_enemy("infected", snapf.call(h_out + Vector3(0, 0, 6)))
	ch.state = "chase"
	ch._last = player.global_position
	ch._unseen = 0.0
	var hp1 := hp
	var tc := 0.0
	while tc < 25.0 and hp >= hp1:
		await get_tree().process_frame
		tc += get_process_delta_time()
	_ok("пустыш со двора зашёл за героем в дом и ударил: %.1f с" % tc, hp < hp1 and san.locate(ch.global_position + Vector3.UP * 0.3).x == hi, "враг %s, состояние %s" % [str(ch.global_position), ch.state])
	ch.damage(999.0, player.global_position)
	hp = HP_MAX
	player.global_position = room + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	var ch2 := spawn_enemy("infected", snapf.call(top + Vector3(0, 0, 5)))
	ch2.state = "chase"
	ch2._last = player.global_position
	ch2._unseen = 0.0
	hp1 = hp
	tc = 0.0
	while tc < 30.0 and hp >= hp1:
		await get_tree().process_frame
		tc += get_process_delta_time()
	_ok("пустыш с улицы спустился за героем по лестнице в погреб и ударил: %.1f с (враг на %.1f м)" % [tc, ch2.global_position.y], hp < hp1 and ch2.global_position.y < cb.base_y + 0.5, "враг %s, состояние %s" % [str(ch2.global_position), ch2.state])
	ch2.damage(999.0, player.global_position)
	hp = HP_MAX
	# Рубер не бросает камень в погреб
	_ok("в погребе — не «под открытым небом» (Рубер туда камень не бросает)", not _open_sky(room + Vector3(0, 0, 5), room))
	# 14–16: таймер, маршрут, карта
	_ok("таймер кластера — 10:00 и идёт (в том числе под землёй)", int(c.minutes) == 10 and _cs_end - float(cs_start) > 599.0 and cs_left() < 600.0)
	var rt: Dictionary = ULBase.shop().get("routes", {}).get("khutor", {})
	_ok("маршрут «Хутор» в компьютере: 18 споранов, кнопка «Открыть маршрут»", int((rt.get("price", {}) as Dictionary).get("spore", 0)) == 18 and String(rt.get("btn", "")) == "ОТКРЫТЬ МАРШРУТ")
	var hr: Rect2 = ULMap.PLACES.home.rect
	var kr: Rect2 = ULMap.PLACES.khutor.rect
	_ok("на глобальной карте хутор — слева и ниже дома", kr.get_center().x < hr.get_center().x and kr.get_center().y > hr.get_center().y)
	# уход с добычей, покупка заново, перезагрузка с героем в погребе
	inv.wallet = {"spore": 7}
	ULBase.set_route("khutor", "active")
	player.global_position = Vector3(ULKhutor.K_ENTRY.x, 0.1, size_m * 0.5 + 3.0)
	var tl := 0.0
	while not _cs_done and tl < LEAVE_S + 2.0:
		await get_tree().process_frame
		tl += get_process_delta_time()
	_ok("ушёл за южный край: посещение окончено, добыча при себе, маршрут закрыт", _cs_done and int(inv.wallet.get("spore", 0)) == 7 and ULBase.route_state("khutor") == "" and ULSettings.place == "home")
	# пройденный хутор: до сброса его нет в компьютере и не купить; после сброса — снова можно
	var offs_k: Array = ULBase.offers()
	if not offs_k.has("khutor"):
		offs_k[0] = "khutor"
		ULBase.data.offers = offs_k
	inv.wallet = {"spore": 50}
	var rd := ULBase.buy_route(inv, "khutor")
	_ok("хутор пройден: до следующего сброса в компьютере его нет, купить нельзя (спораны целы)", ULBase.route_done("khutor") and not ULBase.routes_listed().has("khutor") and not rd.ok and String(rd.err) == "done" and int(inv.wallet.get("spore", 0)) == 50, "%s, пройдены %s, в списке %s" % [str(rd), str(ULBase.data.done), str(ULBase.routes_listed())])
	var nowk := int(Time.get_unix_time_from_system())
	ULBase.data.routes_next = nowk - 1
	ULBase.routes_tick(nowk)
	_ok("сброс маршрутов — пройденные снова доступны (если попали в новый набор)", not ULBase.route_done("khutor") and (ULBase.data.done as Array).is_empty())
	_offer_route("khutor")
	inv.wallet = {"spore": 17}
	var r0 := ULBase.buy_route(inv, "khutor")
	inv.wallet = {"spore": 18}
	var r1 := ULBase.buy_route(inv, "khutor")
	_ok("за 17 споранов не купить, за 18 — куплен, хутор на карте", not r0.ok and r1.ok and int(inv.wallet.get("spore", 0)) == 0 and ULMap.place_shown("khutor"), "%s / %s, маршрут %s" % [str(r0), str(r1), ULBase.route_state("khutor")])
	_cs_done = false
	left_location = false
	_leave_t = 0.0
	ULSettings.place = "khutor"
	ULBase.set_route("khutor", "active")
	player.global_position = room + Vector3.UP * 0.1
	inv.primary = ULItems.make("ak74m")
	inv.wallet = {"spore": 25}
	var fake := "user://test_cluster.json"
	ULBase.write_json(fake, {"v": SAVE_V, "crates": [[1.0, 2.0, 0.0, [ULItems.make("ak74m")]]], "ground": [], "inv": inv.to_dict(), "hp": 80.0})
	_cs_end = Time.get_unix_time_from_system() + 0.5
	var tr := 0.0
	while not _cs_done and tr < 6.0:
		await get_tree().process_frame
		tr += get_process_delta_time()
	_save_carried(fake, true)
	var dd2 = JSON.parse_string(FileAccess.get_file_as_string(fake))
	_ok("время вышло, герой в погребе: погиб, всё при себе потеряно, вещи на базе целы; маршрут закрыт, хутора нет на карте", _cs_done and inv.primary == null and inv.wallet.is_empty() and (dd2.crates as Array).size() == 1 and ULBase.route_state("khutor") == "" and not ULMap.place_shown("khutor"))
	DirAccess.remove_absolute(ProjectSettings.globalize_path(fake))
	ULSettings.place = "home"
	ULSettings.arrival_note = ""
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## Базовый компьютер (--as-test=pc; с --as-out=папка — ещё снимки экрана): пять ресурсов, оружейник за 30 гороха
## и 50 споранов, отказ при нехватке, однократная установка, маршрут за 10 споранов, таймер новых маршрутов,
## обмен по всей цепочке в обе стороны, окно «Купить/Продать», защита от двойного нажатия, сохранение и загрузка.
func _pc_test() -> void:
	var E := ULEconomy
	await get_tree().create_timer(0.6).timeout
	inv.wallet = {}
	_ok("до установки оружейника на базе нет (у крыльца — только барахольщик)", npc_by_role("оружейник") == null and npc_by_role("барахольщик") != null and not ULBase.installed("gunsmith"))
	# барахольщик у крыльца: хлам складывается в одну стопку и продаётся по спорану за кучку
	var dl := npc_by_role("барахольщик")
	_ok("барахольщик стоит прямо перед входом в дом", dl != null and dl.global_position.distance_to(house.to_global(Vector3(0, 0, ULHouse.D * 0.5))) < 3.0)
	for k in 7:
		inv.add(ULItems.make("junk"))
	var jslots := 0
	for it in inv.pockets:
		if it != null and String(it.id) == "junk":
			jslots += 1
	_ok("7 кучек хлама в кармане — одна стопка", inv.count("junk") == 7 and jslots == 1)
	sell_junk()
	_ok("барахольщику проданы 7 кучек → 7 споранов", inv.count("junk") == 0 and int(inv.wallet.get("spore", 0)) == 7, str(inv.wallet))
	_ok("без хлама продавать нечего", not sell_junk() and int(inv.wallet.get("spore", 0)) == 7)
	inv.wallet = {}
	_ok("до покупки комната пустая и называется «Кладовая»", _armory_root == null and house.labels[2].text == "Кладовая")
	_ok("компьютер — в сенях у правой стены", _terminal != null and house.room_at(house.to_global(TERMINAL_AT)) == "Сени", str(house.room_at(house.to_global(TERMINAL_AT))))
	if out != "":
		# снимок: пустая кладовая и компьютер в сенях до покупки оружейника
		player.global_position = house.to_global(Vector3(0.3, 0.05, 3.3))
		_cam_ready = false
		await get_tree().create_timer(1.2).timeout
		await _snap("pc_room_before")
	player.global_position = house.to_global(terminal_front() + Vector3(0, 0.05, 0))
	await get_tree().create_timer(0.4).timeout
	_ok("у стола: цель — компьютер, кнопка «Открыть»", _target != null and String(_target.type) == "terminal" and _action_label() == "Открыть", _target_name())
	do_action()
	await get_tree().process_frame
	await get_tree().process_frame
	var pc := _term_ui as ULBasePC
	var vs := get_viewport().get_visible_rect().size
	_ok("компьютер открыт во весь экран, игра под ним не принимает касания", pc != null and _modal() and pc.size.distance_to(vs) < 2.0, str(pc.size if pc else Vector2.ZERO))
	if pc == null:
		print("[inv] итог: ошибок %d" % _fails)
		get_tree().quit()
		return
	inv.wallet = {"spore": 125, "pea": 42, "pearl_black": 7, "pearl_red": 3, "pearl_white": 1}
	inv.changed.emit()
	var shown := []
	for id in ULItems.MONEY:
		shown.append(pc.shown(id))
	_ok("сверху пять ресурсов: спораны, горох, чёрная, красная, белая жемчужина", shown == [125, 42, 7, 3, 1], str(shown))
	inv.add(ULItems.make("spore", 5))
	_ok("добыча (+5 споранов) сразу видна на панели", pc.shown("spore") == 130 and int(inv.wallet.spore) == 130)
	if out != "":
		await get_tree().create_timer(0.3).timeout
		await _snap("pc_main")
	# --- оружейник ---
	inv.wallet.pea = 10
	inv.changed.emit()
	pc.ask_upgrade("gunsmith")
	_ok("не хватает гороха: предупреждение и недостача (20 горошин), ничего не списано", pc.dialog_text().contains("20 горошин") and int(inv.wallet.pea) == 10 and int(inv.wallet.spore) == 130 and not ULBase.installed("gunsmith"), pc.dialog_text().replace("\n", " / "))
	if out != "":
		await _snap("pc_nomoney")
	pc.dialog_close()
	var r0 := ULBase.buy_upgrade(inv, "gunsmith")
	_ok("покупка без ресурсов отклонена логикой (не только окном)", not r0.ok and r0.err == "money" and int((r0.miss as Dictionary).get("pea", 0)) == 20)
	inv.wallet.pea = 42
	inv.changed.emit()
	pc.ask_upgrade("gunsmith")
	_ok("хватает: окно подтверждения с ценой (30 горошин, 50 споранов)", pc.dialog_text().contains("30 горошин") and pc.dialog_text().contains("50 споранов"))
	if out != "":
		await _snap("pc_confirm")
	pc.dialog_confirm()
	pc.dialog_confirm()                     # второе нажатие — окна уже нет
	_ok("оружейник куплен один раз: горох 42 → 12, спораны 130 → 80", int(inv.wallet.pea) == 12 and int(inv.wallet.spore) == 80, str(inv.wallet))
	_ok("оружейник установлен и встал за прилавок оружейной", ULBase.installed("gunsmith") and ULBase.has_staff("gunsmith") and npc_by_role("оружейник") != null and npcs.size() == 2 and npc_by_role("оружейник").global_position.distance_to(house.to_global(ARMORY_NPC)) < 0.3)
	_ok("после покупки в кладовой появилась вся оружейная (прилавок, шкафы, оружие), подпись «Оружейная»", _armory_root != null and _armory_root.get_child_count() > 10 and house.labels[2].text == "Оружейная")
	var gb := pc.find_child("up_gunsmith", true, false).find_child("buy", true, false) as Button
	_ok("кнопка сменилась на «УСТАНОВЛЕНО»", gb != null and gb.text == "УСТАНОВЛЕНО" and gb.disabled)
	var r1 := ULBase.buy_upgrade(inv, "gunsmith")
	pc.ask_upgrade("gunsmith")
	_ok("повторно не купить: ресурсы не списаны, окна нет", not r1.ok and r1.err == "have" and int(inv.wallet.spore) == 80 and pc.dialog_text() == "")
	# --- маршрут ---
	_ok("до покупки маршрута коровника нет на карте", ULBase.route_state("cowshed") == "" and not ULMap.place_shown("cowshed"))
	pc.ask_route("cowshed")
	_ok("маршрут: подтверждение за 10 споранов", pc.dialog_text().contains("10 споранов"))
	pc.dialog_confirm()
	_ok("маршрут куплен: спораны 80 → 70", int(inv.wallet.spore) == 70 and ULBase.route_state("cowshed") == "bought")
	_ok("коровник появился на глобальной карте", ULMap.place_shown("cowshed"))
	var r2 := ULBase.buy_route(inv, "cowshed")
	var rb := pc.find_child("route_cowshed", true, false).find_child("buy", true, false) as Button
	_ok("пока маршрут куплен — повторная покупка недоступна", not r2.ok and r2.err == "have" and int(inv.wallet.spore) == 70 and rb.disabled)
	# --- маршрут в санаторий: карточка по макету, 25 споранов, слева выше дома ---
	var sc := pc.find_child("route_sanatorium", true, false)
	var sb := sc.find_child("buy", true, false) as Button if sc != null else null
	_ok("в компьютере есть «Санаторий Луч»: 25 споранов, кнопка «Открыть маршрут»", sc != null and sb != null and sb.text == "ОТКРЫТЬ МАРШРУТ" and int(ULBase.shop().routes.sanatorium.price.spore) == 25)
	_ok("до покупки санатория нет на карте", ULBase.route_state("sanatorium") == "" and not ULMap.place_shown("sanatorium"))
	pc.ask_route("sanatorium")
	pc.dialog_confirm()
	var mr: Rect2 = ULMap.PLACES.sanatorium.rect
	var hr: Rect2 = ULMap.PLACES.home.rect
	_ok("санаторий куплен: спораны 70 → 45, он на карте слева выше дома", int(inv.wallet.spore) == 45 and ULBase.route_state("sanatorium") == "bought" and ULMap.place_shown("sanatorium") and mr.get_center().x < hr.get_center().x and mr.get_center().y < hr.get_center().y)
	if out != "":
		await get_tree().create_timer(0.4).timeout
		await _snap("pc_routes_bought")
	ULBase.set_route("sanatorium", "")
	inv.wallet.spore = 70
	inv.changed.emit()
	# --- таймер новых маршрутов ---
	var per := ULBase.refresh_period()
	var keep_next = ULBase.data.get("routes_next", 0)
	ULBase.data.routes_next = 0
	var now := 2000000000
	var a1 := ULBase.routes_tick(now)
	var a2 := ULBase.routes_tick(now + 100)
	var rf0 := int(ULBase.data.get("refreshes", 0))
	var offs_before: Array = (ULBase.data.get("offers", []) as Array).duplicate()
	var a3 := ULBase.routes_tick(now + per + 5)
	_ok("таймер маршрутов: идёт от сохранённого срока, не сбрасывается при открытии", a1 == per and a2 == per - 100, "%d, %d (период %d)" % [a1, a2, per])
	var offs_after: Array = ULBase.data.offers
	var oa_u := {}
	var oa_new := false
	for o in offs_after:
		oa_u[o] = true
		oa_new = oa_new or not offs_before.has(o)
	_ok("срок вышел — предложения обновлены (из 4 локаций снова 3 разные, хотя бы одна новая), следующий срок через период: %s → %s" % [", ".join(offs_before), ", ".join(offs_after)],
		a3 == per - 5 and int(ULBase.data.refreshes) == rf0 + 1 and offs_after.size() == 3 and oa_u.size() == 3 and (oa_new or offs_before.size() != 3))
	# --- три разные локации, сброс каждые 2 часа ---
	var offs: Array = ULBase.offers()
	var uniq := {}
	for o in offs:
		uniq[o] = true
	_ok("в компьютере сразу 3 локации, все разные: %s; сброс — каждые %d ч" % [", ".join(offs), per / 3600], offs.size() == 3 and uniq.size() == 3 and ULBase.route_slots() == 3 and per == 2 * 3600)
	var listed_cards := 0
	pc._build_routes()                  # набор только что сменился (на экране он обновляется по таймеру, раз в 0,25 с)
	for o in offs:
		if pc.find_child("route_" + String(o), true, false) != null:
			listed_cards += 1
	_ok("на экране — три карточки маршрутов, по одной на локацию", listed_cards == 3)
	# пул больше мест: 4 локации и ещё 3 для проверки — каждый сброс 3 разные, без повторов, набор не повторяется
	var rts: Dictionary = ULBase.shop().routes
	for fid in ["t_a", "t_b", "t_c"]:
		rts[fid] = (rts.cowshed as Dictionary).duplicate(true)
	rts["t_soon"] = {"n": "скоро", "soon": true, "price": {"spore": 1}}
	var prev: Array = ULBase.data.offers.duplicate()
	var bad_roll := 0
	var whole_repeat := 0
	var same_as_prev := 0
	var seen_sets := {}
	var seen_ids := {}
	for k in 200:
		var nx: Array = ULBase._roll_offers(prev)
		var u2 := {}
		for o in nx:
			u2[o] = true
			seen_ids[o] = true
		if nx.size() != 3 or u2.size() != 3 or nx.has("t_soon"):
			bad_roll += 1
		var rep_n := 0
		for o in nx:
			if prev.has(o):
				rep_n += 1
		same_as_prev += rep_n
		if rep_n == nx.size():
			whole_repeat += 1
		seen_sets[str(nx)] = true
		prev = nx
	var npool := ULBase.route_pool().size()
	_ok("из %d локаций, 200 сбросов: всегда 3 разные (ошибок %d), «скоро» не попадает, набор целиком не повторялся ни разу (%d), разных наборов %d из %d возможных, все %d локаций встречались" % [npool, bad_roll, whole_repeat, seen_sets.size(), npool * (npool - 1) * (npool - 2) / 6, npool],
		bad_roll == 0 and whole_repeat == 0 and seen_sets.size() >= 25 and seen_ids.size() == npool and npool >= 7)
	# купленный маршрут переживает сброс: в новом наборе его нет, но он куплен, на карте и в компьютере
	ULBase.set_route("convoy", "bought")
	var nowr := int(Time.get_unix_time_from_system())
	var no_convoy := false
	var tries := 0
	while not no_convoy and tries < 40:
		ULBase.data.offers = ["cowshed", "sanatorium", "convoy"]
		ULBase.data.routes_next = nowr - 1                  # срок вышел — сброс при следующем обращении
		ULBase.routes_tick(nowr)
		no_convoy = not (ULBase.data.offers as Array).has("convoy")
		tries += 1
	_ok("сброс, конвой в новый набор не попал, а маршрут был куплен — он остаётся: куплен, на карте, карточка в компьютере", no_convoy and ULBase.route_state("convoy") == "bought" and ULMap.place_shown("convoy") and ULBase.routes_listed().has("convoy") and (ULBase.data.offers as Array).all(func(o): return ULBase.routes_listed().has(o)), str(ULBase.routes_listed()))
	var not_off := ULBase.route_pool().filter(func(x): return not (ULBase.data.offers as Array).has(x) and ULBase.route_state(x) == "")
	var rb_no := ULBase.buy_route(inv, String(not_off[0]) if not not_off.is_empty() else "t_a")
	_ok("маршрут, которого нет в наборе, не купить", not rb_no.ok and rb_no.err == "none")
	# сохранение с повтором или с исчезнувшей локацией — набор исправляется сам
	for fid in ["t_a", "t_b", "t_c", "t_soon"]:
		rts.erase(fid)
	ULBase.set_route("convoy", "")
	ULBase.data.offers = ["cowshed", "cowshed", "t_a"]
	ULBase.routes_tick(nowr)
	var fx: Array = ULBase.data.offers
	var fx_u := {}
	var fx_real := true
	for o in fx:
		fx_u[o] = true
		fx_real = fx_real and String(o) in ["cowshed", "sanatorium", "convoy", "khutor", "lair"]
	_ok("старое сохранение с повтором («коровник» дважды) и исчезнувшей локацией — снова 3 разные: %s" % ", ".join(fx), fx.size() == 3 and fx_u.size() == 3 and fx.has("cowshed") and fx_real)
	# посещение окончено — локация до сброса пропадает из компьютера, вместо карточки — строка «Пройдено…»
	ULBase.data.offers = ["cowshed", "sanatorium", "convoy"]
	ULBase.set_route("sanatorium", "active")
	ULBase.set_route("sanatorium", "")
	pc._build_routes()
	var dn := pc.find_child("RoutesDone", true, false) as Label
	_ok("посещение окончено — «Санаторий Луч» до сброса пропал из компьютера, вместо карточки строка «Пройдено…»", ULBase.route_done("sanatorium") and pc.find_child("route_sanatorium", true, false) == null and pc.find_child("route_cowshed", true, false) != null and dn != null and dn.text.contains("Санаторий"), dn.text if dn != null else "нет строки")
	if out != "":
		await get_tree().create_timer(0.3).timeout
		await _snap("pc_routes_done")
	(ULBase.data.done as Array).clear()
	pc._build_routes()
	_ok("таймер на экране в виде ЧЧ:ММ:СС", ULBase.clock(2 * 3600 + 47 * 60 + 36) == "02:47:36" and (pc.find_child("RouteTimer", true, false) as Label).text.length() == 8)
	ULBase.data.routes_next = keep_next
	# --- обмен: логика по всей цепочке ---
	var ch := E.chain()
	var bad := ""
	for i in ch.size() - 1:
		var hi := String(ch[i])
		var lo := E.lower(hi)
		var r := E.rate(hi)
		inv.wallet = {hi: 2, lo: r * 2}
		var ok1 := E.exchange(inv, "sell", hi, 1) and int(inv.wallet[hi]) == 1 and int(inv.wallet[lo]) == r * 3
		var ok2 := E.exchange(inv, "buy", hi, 1) and int(inv.wallet[hi]) == 2 and int(inv.wallet[lo]) == r * 2
		var ok3 := not E.exchange(inv, "buy", hi, 3) and int(inv.wallet[hi]) == 2 and int(inv.wallet[lo]) == r * 2
		var ok4 := not E.exchange(inv, "sell", hi, 0) and not E.exchange(inv, "sell", hi, -2)
		_ok("обмен «%s»: продать 1 и купить обратно, нехватка и n ≤ 0 не меняют кошелёк" % E.rate_text(hi), ok1 and ok2 and ok3 and ok4, str(inv.wallet))
	_ok("курсы по макету: 1 белая = 3 красные, 1 красная = 3 чёрные, 1 чёрная = 5 горошин, 1 горошина = 10 споранов", E.rate("pearl_white") == 3 and E.rate("pearl_red") == 3 and E.rate("pearl_black") == 5 and E.rate("pea") == 10 and E.rate("spore") == 0)
	_ok("через ступень не меняется (спораны → белая жемчужина)", E.quote("buy", "spore", 1).is_empty() and E.lower("spore") == "" and E.higher("pearl_white") == "")
	# --- окно обмена ---
	inv.wallet = {"spore": 95, "pea": 2, "pearl_black": 0, "pearl_red": 1, "pearl_white": 0}
	inv.changed.emit()
	pc.open_exchange("buy", "pea")
	pc.ex_set_n(3)
	_ok("купить 3 горошины: «Вы получите: 3 горошины», «Стоимость: 30 споранов»", pc._ex_lbl.a.text == "Вы получите: 3 горошины" and pc._ex_lbl.b.text == "Стоимость: 30 споранов", pc._ex_lbl.a.text + " / " + pc._ex_lbl.b.text)
	if out != "":
		await get_tree().create_timer(0.3).timeout
		await _snap("pc_exchange_buy")
	var c1 := pc.ex_confirm()
	var c2 := pc.ex_confirm()               # двойное касание
	_ok("подтверждение: обмен прошёл один раз (спораны 95 → 65, горох 2 → 5)", c1 and not c2 and int(inv.wallet.spore) == 65 and int(inv.wallet.pea) == 5, str(inv.wallet))
	_ok("верхняя панель обновилась после обмена", pc.shown("spore") == 65 and pc.shown("pea") == 5)
	await get_tree().create_timer(0.6).timeout
	pc.ex_max()
	_ok("«Максимум»: на 65 споранов — 6 горошин", pc.ex_n == 6)
	pc.ex_set_n(7)
	_ok("не хватает: предупреждение «не хватает 5 споранов», кнопка выключена", pc._ex_lbl.warn.text.contains("5 споранов") and pc._ex_ok.disabled and not pc.ex_confirm() and int(inv.wallet.spore) == 65, pc._ex_lbl.warn.text)
	pc._ex_typed("12а")
	_ok("в поле количества — только цифры", pc.ex_n == 12 and pc._ex_edit.text == "12")
	pc._ex_typed("")
	_ok("пустое количество — сделки нет", pc.ex_n == 0 and pc._ex_ok.disabled)
	pc.ex_pick("give", "spore")
	pc.ex_set_n(1)
	_ok("выбор «отдаю спораны» при покупке — получаю горох (соседний)", pc.ex_hi == "pea")
	pc.ex_pick("get", "pearl_white")
	_ok("выбор «получаю белую жемчужину» — отдаю красную", pc.ex_hi == "pearl_white" and E.lower(pc.ex_hi) == "pearl_red")
	pc.ex_set_mode("sell")
	pc.ex_pick("give", "pearl_red")
	pc.ex_set_n(1)
	_ok("продать 1 красную: «Вы отдаёте: 1 красную жемчужину», «Вы получите: 3 чёрные жемчужины»", pc._ex_lbl.a.text == "Вы отдаёте: 1 красную жемчужину" and pc._ex_lbl.b.text == "Вы получите: 3 чёрные жемчужины", pc._ex_lbl.a.text + " / " + pc._ex_lbl.b.text)
	if out != "":
		await get_tree().create_timer(0.3).timeout
		await _snap("pc_exchange_sell")
	_ok("продажа проведена: красных 1 → 0, чёрных 0 → 3", pc.ex_confirm() and int(inv.wallet.pearl_red) == 0 and int(inv.wallet.pearl_black) == 3)
	pc.ex_pick("get", "spore")
	_ok("при продаже «получаю спораны» — отдаю горох", pc.ex_hi == "pea")
	pc.ex_close()
	# --- сохранение и загрузка ---
	var wsave := inv.to_dict()
	var inv2 := ULInventory.new()
	inv2.from_dict(JSON.parse_string(JSON.stringify(wsave)))
	var wbad := ""
	for id in ULItems.MONEY:
		if int(inv2.wallet.get(id, 0)) != int(inv.wallet.get(id, 0)):
			wbad += id + " "
	_ok("кошелёк сохраняется и загружается без потерь", wbad == "", str(inv2.wallet))
	var keep_path := ULBase.path
	ULBase.path = "user://test_base.json"
	ULBase.memory_only = false
	ULBase.save_state()
	var nxt0 := int(ULBase.data.routes_next)
	ULBase.data = {}
	ULBase.load_state(true)
	_ok("база после перезапуска: оружейник установлен, маршрут куплен, срок обновления маршрутов тот же", ULBase.installed("gunsmith") and ULBase.has_staff("gunsmith") and ULBase.route_state("cowshed") == "bought" and int(ULBase.data.get("routes_next", 0)) == nxt0)
	DirAccess.remove_absolute(ProjectSettings.globalize_path(ULBase.path))
	ULBase.path = keep_path
	ULBase.memory_only = true
	if out != "":
		await get_tree().create_timer(3.2).timeout
		await _snap("pc_main_after")
	pc.close()
	await get_tree().process_frame
	_ok("компьютер закрыт крестиком — снова игра", _term_ui == null and not _modal())
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## проверка логики инвентаря и боя: каждое правило — отдельный случай
func _inv_test() -> void:
	var I := ULItems
	await get_tree().create_timer(0.5).timeout
	# чистое состояние
	for g in ground.duplicate():
		_remove_ground(g)
	inv = ULInventory.new()
	_ok("карманы: 8 ячеек без рюкзака", inv.slot_count() == 8)
	# стопки
	inv.add(I.make("a545", 60))
	inv.add(I.make("a545", 50))
	_ok("патроны складываются в стопку до 90, остаток — в новую ячейку", inv.used() == 2 and int(inv.pockets[0].n) == 90 and int(inv.pockets[1].n) == 20, "%s / %s" % [str(inv.pockets[0]), str(inv.pockets[1])])
	# оружие в пустой слот
	inv.add(I.make("ak74m"))
	_ok("автомат ложится в слот «основное»", inv.primary != null and String(inv.primary.id) == "ak74m" and inv.used() == 2)
	inv.add(I.make("svd"))
	_ok("второе основное оружие — в карман, слот не меняется", String(inv.primary.id) == "ak74m" and inv.used() == 3)
	inv.add(I.make("tt"))
	_ok("пистолет — в слот «пистолет»", inv.pistol != null and String(inv.pistol.id) == "tt")
	# экипировать из кармана — меняется местами
	var si := -1
	for i in 8:
		if inv.pockets[i] != null and String(inv.pockets[i].id) == "svd":
			si = i
	inv.equip_from(inv.pockets, si)
	_ok("экипировать СВД из кармана: СВД в слоте, АК — в том же кармане", String(inv.primary.id) == "svd" and String(inv.pockets[si].id) == "ak74m")
	# рюкзаки и ячейки
	for id_n in [["pack_small", 16], ["pack_medium", 20], ["pack_large", 28]]:
		inv.pack = I.make(id_n[0])
		_ok("%s: всего ячеек %d" % [I.get_def(id_n[0]).n, id_n[1]], inv.slot_count() == int(id_n[1]))
	inv.pack = I.make("pack_small")
	# переполнение: карманы 8 + рюкзак 8
	var added := 0
	for i in 20:
		if inv.add(I.make("medkit", 2)) == 0:
			added += 1
	_ok("лишнее не помещается: занято ровно 16 из 16", inv.used() == 16 and inv.slot_count() == 16, "занято %d, добавлено стопок %d" % [inv.used(), added])
	var left := inv.add(I.make("can", 1))
	_ok("в полный инвентарь предмет не кладётся (остаток 1)", left == 1)
	_ok("снять пистолет в полный инвентарь нельзя", not inv.unequip("pistol") and inv.pistol != null)
	_ok("снять непустой рюкзак в ячейку нельзя", not inv.unequip("pack") and inv.pack != null)
	# выбросить рюкзак с вещами и надеть обратно — вещи на месте
	var in_pack: int = inv.pack.items.filter(func(x): return x != null).size()
	var it = inv.clear_slot("pack")
	_on_drop(it)
	_ok("выброшенный рюкзак лежит на земле, ячеек снова 8", ground.size() == 1 and inv.slot_count() == 8 and inv.pack == null)
	_ok("вещи остались в рюкзаке на земле", ground[0].item.items.filter(func(x): return x != null).size() == in_pack, "%d" % in_pack)
	_open_ground = ground[0]
	_on_wear_ground_pack()
	_ok("надеть рюкзак с земли: вещи в нём, на земле пусто", inv.pack != null and inv.pack.items.filter(func(x): return x != null).size() == in_pack and ground.is_empty())
	inv_ui.visible = false
	# надеть другой рюкзак с земли — прежний ложится на землю со своими вещами
	_spawn_ground(I.make("pack_large"), player.global_position + Vector3(0.8, 0, 0), 0.0)
	_open_ground = ground[0]
	_on_wear_ground_pack()
	_ok("сменить рюкзак: надет большой (28 ячеек), малый с вещами — на земле", inv.slot_count() == 28 and ground.size() == 1 and String(ground[0].item.id) == "pack_small" and ground[0].item.items.filter(func(x): return x != null).size() == in_pack)
	inv_ui.visible = false
	# оружие в руки и на героя
	inv.hand = "primary"
	_apply_gear()
	await _wait_drawn()
	_ok("СВД в руках у героя", rig.hold.wid == "svd" and rig.hold.drawn > 0.9, "%s, достал на %.0f %%" % [rig.hold.wid, rig.hold.drawn * 100.0])
	cycle_weapon()
	await get_tree().create_timer(1.6).timeout
	_ok("кнопка «Оружие»: основное → пистолет", inv.hand == "pistol" and rig.hold.wid == "pistol", rig.hold.wid)
	cycle_weapon()
	await get_tree().create_timer(1.6).timeout
	_ok("кнопка «Оружие»: пистолет → убрано", inv.hand == "" and rig.hold.wid == "", rig.hold.wid)
	# выбросить оружие из слота, подобрать — снова в слоте
	inv.hand = "pistol"
	_on_drop(inv.clear_slot("pistol"))
	_ok("выбросить пистолет из рук: слот пуст, в руках ничего", inv.pistol == null and inv.hand == "")
	_target = {"type": "ground", "g": ground[ground.size() - 1]}
	do_action()
	_ok("подобрать пистолет: он снова в слоте и в руках", inv.pistol != null and inv.hand == "pistol")
	# ящик: положить и взять
	var c0 := crates.size()
	place_crate()
	var cells: Array = crates[crates.size() - 1].get_meta("items")
	_ok("новый ящик: 12 пустых ячеек", crates.size() == c0 + 1 and cells.size() == CRATE_SLOTS and cells.filter(func(x): return x != null).is_empty())
	open_inventory(cells, "Ящик")
	var u0 := inv.used()
	inv_ui._sel_src = "pockets"
	inv_ui._sel_i = 0
	inv_ui._act_to_cont()
	_ok("переложить из кармана в ящик", inv.used() == u0 - 1 and cells[0] != null)
	inv_ui._sel_src = "cont"
	inv_ui._sel_i = 0
	inv_ui._act_take()
	_ok("взять из ящика обратно", inv.used() == u0 and cells[0] == null)
	close_inventory()
	# --- бой ---
	var tg: Node3D = targets[1]
	inv.hand = ""
	_apply_gear()
	await get_tree().create_timer(1.4).timeout
	player.global_position = tg.global_position + Vector3(0, 0.05, 1.1)
	player.rotation.y = PI
	await get_tree().create_timer(0.3).timeout
	var h0 := float(tg.get_meta("hp"))
	attack()
	await get_tree().create_timer(0.8).timeout
	_ok("кулаки: удар по мишени снимает 8", is_equal_approx(h0 - float(tg.get_meta("hp")), 8.0), "было %d, стало %d" % [h0, float(tg.get_meta("hp"))])
	inv.pistol = I.make("machete")
	_ok("мачете ложится в слот пистолета", I.slot_of(inv.pistol) == "pistol")
	inv.hand = "pistol"
	_apply_gear()
	await _wait_drawn()
	h0 = float(tg.get_meta("hp"))
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(1.3).timeout
	_ok("мачете: удар снимает 40", is_equal_approx(h0 - float(tg.get_meta("hp")), 40.0), "было %d, стало %d" % [h0, float(tg.get_meta("hp"))])
	inv.primary = I.make("ak74m")
	inv.hand = "primary"
	_apply_gear()
	await _wait_drawn()
	player.global_position = tg.global_position + Vector3(0, 0.05, 9.0)
	player.rotation.y = PI
	await get_tree().create_timer(0.3).timeout
	h0 = float(tg.get_meta("hp"))
	var s0 := shots
	var k0 := hits
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(0.4).timeout
	_ok("АК: выстрел тратит патрон (29 из 30)", int(inv.primary.mag) == 29 and shots == s0 + 1, "в магазине %d" % int(inv.primary.mag))
	_ok("выстрел снимает единицу прочности (999 из 1000); ТТ — 300 выстрелов, мачете — 400 ударов", int(inv.primary.dur) == 999 and I.make("tt").dur == 300 and I.make("machete").dur == 400, "прочность %d" % int(inv.primary.dur))
	_ok("АК: попадание по мишени с 9 м снимает 26", hits == k0 + 1 and is_equal_approx(h0 - float(tg.get_meta("hp")), 26.0), "попаданий %d, было %d, стало %d" % [hits - k0, h0, float(tg.get_meta("hp"))])
	# пустой магазин → перезарядка из запаса
	var res0 := inv.count("a545")
	inv.primary.mag = 0
	_atk_cd = 0.0
	attack()
	_ok("пустой магазин: начинается перезарядка", _reloading)
	await get_tree().create_timer(3.4).timeout
	_ok("перезарядка: в магазине 30, из запаса ушло 30", int(inv.primary.mag) == 30 and inv.count("a545") == res0 - 30, "магазин %d, запас %d → %d" % [int(inv.primary.mag), res0, inv.count("a545")])
	# без патронов
	inv.consume("a545", 999)
	inv.primary.mag = 0
	_atk_cd = 0.0
	s0 = shots
	attack()
	_ok("нет патронов: выстрела нет", shots == s0 and not _reloading)
	# лечение и вода
	inv.consume("medkit", 999)
	inv.add(I.make("bandage", 2))
	inv.add(I.make("water", 1))
	hp = 40.0
	_heal_cd = 0.0
	heal()
	_ok("кнопка лечения: бинт +15 (40 → 55), бинтов стало меньше", is_equal_approx(hp, 55.0) and inv.count("bandage") == 1, "здоровье %d, бинтов %d" % [hp, inv.count("bandage")])
	water = 50.0
	_heal_cd = 0.0
	heal("water")
	_ok("вода из инвентаря: +40 (50 → 90)", is_equal_approx(water, 90.0) and inv.count("water") == 0, "вода %d" % water)
	hp = 100.0
	_heal_cd = 0.0
	_ok("здоровье полное — лечение не тратит бинт", not heal() and inv.count("bandage") == 1)
	# энергия
	en = 100.0
	_auto = [player.global_position + Vector3(30, 0, 0)]
	_auto_k = 1.0
	await get_tree().create_timer(3.0).timeout
	_auto.clear()
	_auto_k = 0.6
	_ok("быстрый бег тратит энергию", en < 95.0, "энергия %d" % en)
	# набор припасов: живчик возвращает энергию; у каждого предмета набора есть своя модель и значок
	inv.add(I.make("tonic", 1))
	en = 30.0
	_heal_cd = 0.0
	heal("tonic")
	_ok("живчик: +60 энергии (30 → 90)", is_equal_approx(en, 90.0) and inv.count("tonic") == 0, "энергия %d" % en)
	var kit_bad := ""
	for kid in I.ITEMS:
		if I.ITEMS[kid].has("kit") and (I.kit_mesh(kid) == null or I.icon(kid) == null):
			kit_bad += kid + " "
	_ok("набор припасов: у всех 13 предметов есть модель и значок", kit_bad == "", kit_bad)
	var gk := _spawn_ground(I.make("medkit"), player.global_position + Vector3(1.5, 0, 0), 0.0)
	_ok("аптечка на земле — моделью из набора", (gk.node as Node3D).find_children("*", "MeshInstance3D", true, false).size() >= 2 and (gk.node as Node3D).find_children("*", "Sprite3D", true, false).is_empty())
	_remove_ground(gk)
	# --- отклик управления, автонаведение, манекен, ящики с оружием ---
	inv.hand = ""
	_apply_gear()
	en = 100.0
	_tired = false
	player.global_position = Vector3(0.3, 0.05, 8.0)
	player.velocity = Vector3.ZERO
	await get_tree().create_timer(0.8).timeout
	_auto = [player.global_position + Vector3(0, 0, 30)]
	_auto_k = 1.0
	await get_tree().create_timer(0.2).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	var v_go := Vector3(player.velocity.x, 0, player.velocity.z).length()
	_ok("отклик: полный бег через 0.2 с после нажатия", v_go > 3.9, "скорость %.1f м/с" % v_go)
	_auto.clear()
	await get_tree().create_timer(0.12).timeout
	await get_tree().process_frame
	await get_tree().process_frame
	var v_stop := Vector3(player.velocity.x, 0, player.velocity.z).length()
	_ok("отклик: остановка через 0.12 с после отпускания", v_stop < 0.2, "скорость %.1f м/с" % v_stop)
	_auto_k = 0.6
	var cam_lag := Vector2(_cam_t.x - player.global_position.x, _cam_t.z - player.global_position.z).length()
	await get_tree().create_timer(0.4).timeout
	_ok("камера догоняет героя за 0.4 с", Vector2(_cam_t.x - player.global_position.x, _cam_t.z - player.global_position.z).length() < 0.05, "отставание было %.2f м" % cam_lag)
	# манекен
	var mq: Node3D = targets[0]
	_ok("манекен стоит во дворе у базы", mq.has_meta("dummy") and _in_yard(mq.global_position))
	# цель за спиной: герой сам поворачивается и попадает
	inv.primary = I.make("ak74m")
	inv.hand = "primary"
	_apply_gear()
	player.global_position = mq.global_position + Vector3(-6.0, 0.05, 0.0)
	player.rotation.y = -PI * 0.5                                # спиной к манекену
	_atk_cd = 0.0
	_atk_want = 0.4
	_ok("нажатие, пока оружие достаётся, не теряется", rig.hold.drawn < 0.99 and _atk_want > 0.0)
	await _wait_drawn()
	await get_tree().create_timer(0.5).timeout
	_ok("выстрел сам, как только оружие в руках (29 из 30)", int(inv.primary.mag) == 29, "в магазине %d" % int(inv.primary.mag))
	_ok("манекен за спиной: герой развернулся и попал", String((mq.get_node("Info") as Label3D).text).contains("серия 26") and absf(angle_difference(player.rotation.y, PI * 0.5)) < 0.3, String((mq.get_node("Info") as Label3D).text))
	# манекен не падает
	var mq_hp := float(mq.get_meta("hp"))
	_damage(mq, 5000.0, mq.global_position)
	await get_tree().create_timer(0.5).timeout
	_ok("манекен не падает и восстанавливается", float(mq.get_meta("hp")) == float(mq.get_meta("hp_max")) and absf((mq.get_node("Vis") as Node3D).rotation.x) < 0.2, "было %d" % mq_hp)
	# за забором цель не берётся
	player.global_position = Vector3(mq.global_position.x, 0.05, HOUSE_AT.z + YARD[3] + 3.0)
	await get_tree().create_timer(0.3).timeout
	var far_t = _nearest_target(12.0, 180.0, true)
	_ok("через забор цель не берётся", far_t != mq, "взята: %s" % (String(far_t.name) if far_t != null else "нет"))
	# режим огня: пистолет при удержании стреляет выстрел за выстрелом; отпустили — огонь прекращается
	inv.pistol = I.make("tt")
	inv.hand = "pistol"
	_apply_gear()
	player.global_position = mq.global_position + Vector3(-5.0, 0.05, 0.0)
	await _wait_drawn()
	_hud_touch[99] = "fire"
	_hud_press("fire")
	await get_tree().create_timer(1.2).timeout
	_hud_touch.erase(99)
	var tt_mag := int(inv.pistol.mag)
	_ok("ТТ: удержание кнопки — выстрел за выстрелом (3–5 за 1.2 с)", tt_mag >= 3 and tt_mag <= 5, "в магазине %d из 8" % tt_mag)
	await get_tree().create_timer(0.8).timeout
	_ok("ТТ: отпустили кнопку — огонь прекратился", int(inv.pistol.mag) == tt_mag, "в магазине %d" % int(inv.pistol.mag))
	# прицельное движение: лицом к цели, пятясь и боком
	inv.consume("a762x25", 999)
	inv.add(I.make("a762x25", 40))
	inv.pistol.mag = 8
	player.global_position = mq.global_position + Vector3(-6.0, 0.05, 0.0)
	await get_tree().create_timer(0.4).timeout
	_hud_touch[99] = "fire"
	_hud_press("fire")
	_auto = [player.global_position + Vector3(-20, 0, 0)]              # от манекена — прочь
	_auto_k = 1.0
	await get_tree().create_timer(0.9).timeout
	var to_mq := mq.global_position - player.global_position
	var face_err := absf(angle_difference(player.rotation.y, atan2(to_mq.x, to_mq.z)))
	var v_back := Vector3(player.velocity.x, 0, player.velocity.z)
	_ok("стреляет и отходит: лицом к цели, пятится (шаг «назад»), медленнее бега", aiming and move_mode == "walk_back" and rig.dir_w > 0.9 and rig.dir_pos.y < -0.8 and face_err < 0.25 and v_back.x < -1.0 and v_back.length() < 2.4, "режим «%s», шаг (%.2f, %.2f), отклонение %.2f рад, скорость %.1f" % [move_mode, rig.dir_pos.x, rig.dir_pos.y, face_err, v_back.length()])
	_auto = [player.global_position + Vector3(0, 0, 20)]               # поперёк направления на цель
	await get_tree().create_timer(0.7).timeout
	to_mq = mq.global_position - player.global_position
	face_err = absf(angle_difference(player.rotation.y, atan2(to_mq.x, to_mq.z)))
	_ok("стреляет и идёт боком: лицом к цели, шаг боком", aiming and move_mode.begins_with("strafe") and rig.dir_w > 0.9 and absf(rig.dir_pos.x) > 0.8 and face_err < 0.35, "режим «%s», шаг (%.2f, %.2f), отклонение %.2f рад" % [move_mode, rig.dir_pos.x, rig.dir_pos.y, face_err])
	_auto = [player.global_position + Vector3(-14, 0, 14)]             # наискось: назад и вбок
	await get_tree().create_timer(0.7).timeout
	_ok("наискось — шаг между «назад» и «боком» (смесь соседних, без рывка)", aiming and absf(rig.dir_pos.x) > 0.35 and rig.dir_pos.y < -0.35, "шаг (%.2f, %.2f)" % [rig.dir_pos.x, rig.dir_pos.y])
	_hud_touch.erase(99)
	_auto.clear()
	await get_tree().create_timer(0.8).timeout
	_ok("кончил стрелять — через 0.8 с оружие уже опущено из прицела", rig.hold.stance == "ready" and not aiming, "стойка «%s»" % rig.hold.stance)
	await get_tree().create_timer(0.6).timeout
	_auto = [player.global_position + Vector3(-20, 0, 0)]
	await get_tree().create_timer(0.6).timeout
	_ok("не стреляет — бежит лицом по ходу, обычным бегом", not aiming and move_mode == "" and rig.dir_w < 0.05 and absf(angle_difference(player.rotation.y, -PI * 0.5)) < 0.3 and Vector3(player.velocity.x, 0, player.velocity.z).length() > 3.5, "поворот %.2f" % player.rotation.y)
	_auto.clear()
	_auto_k = 0.6
	await get_tree().create_timer(0.3).timeout
	_ok("одышки на бегу нет", not FileAccess.get_file_as_string("res://world.gd").contains("snd.loop(" + "\"breath_run\""))
	# автомат: очередь, пока держим, до пустого магазина; сам не перезаряжается — кнопка перезарядки рядом
	inv.consume("a545", 999)
	inv.add(I.make("a545", 30))
	inv.primary = I.make("ak74m")
	inv.primary.mag = 12
	inv.hand = "primary"
	_apply_gear()
	await _wait_drawn()
	_hud_touch[99] = "fire"
	_hud_press("fire")
	await get_tree().create_timer(0.6).timeout
	var mid_mag := int(inv.primary.mag)
	await get_tree().create_timer(1.6).timeout
	_hud_touch.erase(99)
	_ok("АК: очередь, пока кнопка удержана", mid_mag <= 9 and mid_mag >= 4, "через 0.6 с в магазине %d из 12" % mid_mag)
	_ok("АК: очередь идёт до нуля и останавливается (сам не перезаряжается)", int(inv.primary.mag) == 0 and not _reloading and inv.count("a545") == 30, "в магазине %d, запас %d" % [int(inv.primary.mag), inv.count("a545")])
	_ok("перезарядка — рядом с кнопкой огня", _hud_pos("reload").distance_to(_hud_pos("fire")) < 190.0 and _hud_hit(_hud_pos("reload")) == "reload", "%d точек между центрами" % int(_hud_pos("reload").distance_to(_hud_pos("fire"))))
	_hud_press("reload")
	_ok("кнопка перезарядки начинает перезарядку", _reloading)
	await get_tree().create_timer(2.6).timeout
	_ok("после перезарядки магазин полон (30), запас 0", int(inv.primary.mag) == 30 and inv.count("a545") == 0, "магазин %d, запас %d" % [int(inv.primary.mag), inv.count("a545")])
	# пули: летят от ствола, урон — когда долетят
	player.global_position = mq.global_position + Vector3(-12.0, 0.05, 0.0)
	await get_tree().create_timer(0.3).timeout
	var hh := hits
	_atk_cd = 0.0
	attack()
	_ok("выстрел: пуля в полёте, попадания ещё нет", _bullets.size() == 1 and hits == hh and (_bullets[0].n as MeshInstance3D).visible)
	await get_tree().create_timer(0.45).timeout
	_ok("пуля долетела за время полёта (12 м): попадание засчитано", _bullets.is_empty() and hits == hh + 1)
	inv.primary = I.make("spas12")
	inv.add(I.make("a12", 8))
	_apply_gear()
	await _wait_drawn()
	_atk_cd = 0.0
	attack()
	_ok("дробовик: один выстрел — 8 дробин в полёте, в магазине 7", _bullets.size() == 8 and int(inv.primary.mag) == 7, "дробин %d" % _bullets.size())
	await get_tree().create_timer(1.0).timeout
	# ящики: всё оружие и патроны к нему
	var in_crates := {}
	for cr in crates:
		for c in cr.get_meta("items"):
			if c != null:
				in_crates[String(c.id)] = true
	var miss := ""
	for wid2 in I.ITEMS:
		var wd: Dictionary = I.ITEMS[wid2]
		if wd.has("weapon") and not in_crates.has(wid2):
			miss += wid2 + " "
		if wd.has("ammo") and not in_crates.has(String(wd.ammo)):
			miss += String(wd.ammo) + " "
	_ok("в ящиках всё оружие игры и патроны к нему", miss == "", miss)
	# --- кнопка взаимодействия, житель, имя героя ---
	inv.hand = ""
	_apply_gear()
	player.global_position = Vector3(0.3, 0.05, 12.0)             # на тропе, рядом ничего нет
	await get_tree().create_timer(0.3).timeout
	_ok("рядом ничего нет: кнопки взаимодействия нет", _target == null and _hud_hit(_hud_pos("take")) != "take", "нажатие в её месте: «%s»" % _hud_hit(_hud_pos("take")))
	var npc: Node3D = npc_by_role("оружейник")
	player.global_position = npc.global_position + Vector3(-1.5, 0.05, 0.0)       # перед прилавком
	await get_tree().create_timer(0.4).timeout
	_ok("у жителя: кнопка появилась, действие «Говорить»", _target != null and String(_target.type) == "npc" and _hud_hit(_hud_pos("take")) == "take" and _action_label() == "Говорить", _target_name())
	_ok("житель повернулся к герою", absf(angle_difference(npc.rotation.y, -PI * 0.5)) < 0.35, "поворот %.2f" % npc.rotation.y)
	do_action()
	_ok("разговор открыт, герой назван по имени", _talk_ui != null and _talk_ui.visible and _talk_text.text.contains(hero_name) and _modal(), _talk_text.text)
	_talk_ui.visible = false
	var cr0: Node3D = crates[0]
	player.global_position = cr0.global_position + Vector3(-1.0, 0.05, 0.0)
	await get_tree().create_timer(0.3).timeout
	_ok("у ящика: кнопка есть, действие «Открыть» (значок ящика, не рукопожатие)", _target != null and String(_target.type) == "crate" and _action_label() == "Открыть")
	_ok("три точки у имени открывают панель имени", _hud_hit(_name_dots()) == "name")
	_hud_press("name")
	_ok("панель имени открыта, в поле — текущее имя", _name_ui.visible and _name_edit.text == "Сталкер" and _modal())
	_name_edit.text = "  Бродяга  "
	_name_ok()
	_ok("имя сменилось на «Бродяга», панель закрылась", hero_name == "Бродяга" and not _name_ui.visible)
	_ok("пустое имя не принимается, длинное обрезается до 16 знаков", not set_hero_name("   ") and set_hero_name("Очень длинное имя сталкера") and hero_name.length() == 16, hero_name)
	set_hero_name("Сталкер")
	# --- подстройка под частоту кадров: сначала сглаживание, потом тени, разрешение — последним ---
	var st0 := {"scale": 0.8, "msaa": true, "shadows": true, "cap": 0.8, "can_msaa": true, "can_shadows": true}
	var a1 := adapt_step(st0, 25.0, true)
	_ok("25 кадров/с: первым снимается сглаживание, разрешение и тени — как были", not bool(a1.msaa) and bool(a1.shadows) and is_equal_approx(float(a1.scale), 0.8))
	var a2 := adapt_step(a1, 25.0, true)
	_ok("дальше — тени солнца, разрешение всё ещё 80 %", not bool(a2.shadows) and is_equal_approx(float(a2.scale), 0.8))
	var a3 := adapt_step(a2, 25.0, true)
	_ok("и только потом разрешение: крупный шаг (80 → 74 %)", is_equal_approx(float(a3.scale), 0.74))
	_ok("35 кадров/с без сглаживания и теней: мелкий шаг вниз (80 → 77 %)", is_equal_approx(float(adapt_step(a2, 35.0, true).scale), 0.77))
	_ok("45 кадров/с: ничего не трогается", adapt_step(a1, 45.0, true) == a1)
	var r1 := adapt_step(a3, 60.0, true)
	_ok("60 кадров/с: сначала возвращается разрешение (74 → 78 %), тени ещё выключены", is_equal_approx(float(r1.scale), 0.78) and not bool(r1.shadows))
	var r2 := adapt_step(adapt_step(r1, 60.0, true), 60.0, true)
	_ok("затем тени, потом сглаживание", is_equal_approx(float(r2.scale), 0.8) and bool(r2.shadows) and not bool(r2.msaa) and bool(adapt_step(r2, 60.0, true).msaa))
	_ok("сразу после снижения вверх не идёт", adapt_step(a3, 60.0, false) == a3)
	var st_low := {"scale": 0.62, "msaa": false, "shadows": false, "cap": 0.62, "can_msaa": false, "can_shadows": false}
	_ok("«Низкая»: сглаживания и теней нет — возвращать нечего", adapt_step(st_low, 60.0, true) == st_low)
	var sc_low := 0.8
	for i in 12:
		sc_low = res_step(sc_low, 15.0, 0.8, true)
	_ok("ниже 62 % разрешение само не опускается (картинка не мылится)", is_equal_approx(sc_low, ULSettings.SCALE_MIN), "%.2f" % sc_low)
	# --- расположение кнопок ---
	var over := ""
	var ks := ["fire", "swap", "inv", "take", "reload", "heal"]
	for i in ks.size():
		for j in range(i + 1, ks.size()):
			var gap := _hud_pos(ks[i]).distance_to(_hud_pos(ks[j])) - float(HUD_BTNS[ks[i]][1]) - float(HUD_BTNS[ks[j]][1])
			if gap < 8.0:
				over += "%s/%s " % [ks[i], ks[j]]
	_ok("кнопки справа не перекрываются", over == "", over)
	_ok("рюкзак — над сменой оружия, смена оружия — над кнопкой атаки", absf(_hud_pos("inv").x - _hud_pos("swap").x) < 10.0 and _hud_pos("inv").y < _hud_pos("swap").y and _hud_pos("swap").y < _hud_pos("fire").y and _hud_pos("swap").distance_to(_hud_pos("fire")) < 160.0)
	# --- прочность оружия ---
	close_inventory()
	inv.primary = ULItems.make("ak74m")
	inv.primary.dur = 2
	inv.primary.mag = 17
	inv.hand = "primary"
	_apply_gear()
	var am0 := inv.count("a545")
	_use_up(inv.primary)
	_ok("прочность 2 → 1: оружие ещё в руках", inv.primary != null and int(inv.primary.dur) == 1 and inv.hand == "primary")
	open_inventory()
	var dtxt := ""
	inv_ui._sel_src = "eq:primary"
	inv_ui._sel_i = 0
	inv_ui.refresh()
	await get_tree().process_frame
	for l in inv_ui.find_children("*", "Label", true, false):
		dtxt += (l as Label).text + "|"
	_ok("прочность видна в инвентаре (карточка оружия)", dtxt.contains("прочность 1 из 1000 выстрелов"))
	close_inventory()
	_use_up(inv.primary)
	_ok("прочность кончилась: оружие сломано, но осталось в руках с патронами в магазине", inv.primary != null and ULItems.broken(inv.primary) and inv.hand == "primary" and int(inv.primary.mag) == 17 and inv.count("a545") == am0)
	open_inventory()
	inv_ui._sel_src = "eq:primary"
	inv_ui._sel_i = 0
	inv_ui.refresh()
	await get_tree().process_frame
	dtxt = ""
	for l in inv_ui.find_children("*", "Label", true, false):
		dtxt += (l as Label).text + "|"
	_ok("в инвентаре видно: «СЛОМАНО» на ячейке и «нужен ремонт у оружейника» на карточке", dtxt.contains("СЛОМАНО") and dtxt.contains("нужен ремонт у оружейника"))
	close_inventory()
	await _wait_drawn()
	var sb0 := shots
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(0.3).timeout
	_ok("сломанное оружие не стреляет", shots == sb0 and int(inv.primary.mag) == 17)
	# ремонт у оружейника: цена — по доле износа; не хватает — не чинит
	var full := int(ULItems.get_def("ak74m").fix)
	var wal0: Dictionary = inv.wallet.duplicate()
	inv.wallet = {"spore": full - 1}
	var fail := repair(inv.primary)
	inv.wallet = {"spore": full + 5}
	var lst := repair_list()
	var ok_r := repair(inv.primary)
	_ok("ремонт у оружейника: сломанный АК в списке ремонта, полный ремонт %d споранов, без денег — отказ" % full, lst.has(inv.primary) and not fail and ok_r and int(inv.primary.dur) == 1000 and int(inv.wallet.spore) == 5 and not ULItems.broken(inv.primary), "кошелёк %s" % str(inv.wallet))
	var tt := I.make("tt")
	tt.dur = 150
	_ok("частичный ремонт — по доле износа: ТТ 150 из 300 → %d спорана" % ULItems.repair_cost(tt), ULItems.repair_cost(tt) == int(ceil(float(ULItems.get_def("tt").fix) * 0.5)) and ULItems.repair_cost(I.make("tt")) == 0)
	inv.wallet = wal0
	_atk_cd = 0.0
	attack()
	await get_tree().create_timer(0.3).timeout
	_ok("после ремонта оружие снова стреляет", shots == sb0 + 1)
	inv.primary = null                    # дальше проверки идут без основного оружия (как раньше)
	inv.hand = ""
	_apply_gear()
	# --- враг: заражённый ---
	close_inventory()
	hp = 100.0
	player.global_position = Vector3(20.0, 0.05, 30.0)
	player.velocity = Vector3.ZERO
	var n_targets := targets.size()
	var ms0 := Time.get_ticks_msec()
	var far := spawn_enemy("infected", Vector3(20.0, 0.0, 50.0))        # дальше, чем видит, но слышит выстрел
	var ms1 := Time.get_ticks_msec()
	var e := spawn_enemy("infected", Vector3(20.0, 0.0, 39.0))
	var ms2 := Time.get_ticks_msec()
	# первый заражённый готовит движения под свой скелет (при загрузке локации), следующие берут готовые
	_ok("второй заражённый появляется без заминки (быстрее 60 мс)", ms2 - ms1 < 60, "первый %d мс, второй %d мс" % [ms1 - ms0, ms2 - ms1])
	_ok("пустыш — в списке целей, прочность %d (data/enemies.json)" % int(e.def.hp), targets.has(e) and float(e.get_meta("hp")) == float(e.def.hp) and int(e.def.hp) == 75)
	await get_tree().create_timer(0.5).timeout
	_ok("заметил героя ближе 13 м — бежит к нему", e.state == "chase", e.state)
	var low := 1e9
	var high := -1e9
	for fi in 12:
		await get_tree().process_frame
		var ymin := 1e9
		for bn in ["L_Foot", "R_Foot", "L_ToeBase", "R_ToeBase"]:
			ymin = minf(ymin, (far.rig.skel.global_transform * far.rig.skel.get_bone_global_pose(far.rig.skel.find_bone(bn)).origin).y)
		low = minf(low, ymin)
		high = maxf(high, ymin)
	_ok("стоящий враг не висит над землёй и не тонет: нижняя стопа на высоте подошвы", low > 0.0 and high < 0.09, "нижняя кость стопы: %.3f…%.3f м" % [low, high])
	_ok("дальний (20 м) героя не видит — стоит или бродит", far.state == "idle" or far.state == "wander", far.state)
	for en_ in enemies:
		en_.hear(player.global_position)
	_ok("услышал выстрел (до 22 м) — тоже бежит", far.state == "chase", far.state)
	far.state = "idle"
	far.global_position = Vector3(-40.0, 0.0, 40.0)
	var hp0 := hp
	var wait_s := 0.0
	var gap := 9.0
	while hp >= hp0 and wait_s < 8.0:
		await get_tree().create_timer(0.1).timeout
		wait_s += 0.1
		gap = minf(gap, e.global_position.distance_to(player.global_position))   # до удара: отброс потом отталкивает героя
	var dmgs := []
	for a in e.def.attacks:
		dmgs.append(float(a.dmg))
	_ok("подошёл вплотную (до 0.85 м между центрами) и ударил", hp < hp0 and dmgs.has(hp0 - hp) and gap <= 0.85, "%s: %.0f → %.0f за %.1f с, расстояние %.2f м" % [e.last_attack, hp0, hp, wait_s, gap])
	_ok("после удара экран краснеет", _hurt_t > 0.0)
	_ok("от удара герой отшатывается (корпус и голова) и брызжет кровь с той стороны, откуда ударили", flinch != null and flinch._t < 0.8 and flinch._dir.dot((player.global_position - e.global_position).normalized()) > 0.5 and not _splats.is_empty())
	_damage(e, 25.0, e.global_position + Vector3.UP)
	_ok("попадание: прочность %d → %d, жив" % [int(e.def.hp), int(e.def.hp) - 25], is_equal_approx(e.hp, float(e.def.hp) - 25.0) and e.alive())
	_damage(e, 1000.0, e.global_position + Vector3.UP)
	_ok("убит: падает, больше не цель для автонаведения", not e.alive() and float(e.get_meta("hp")) == 0.0 and e.collision_layer == 0)
	# добыча: от нуля до трёх споранов
	var seen := {}
	var bad := false
	for sd in 80:
		var n_sp := 0
		for c in ULEnemy.roll_loot("infected", sd):
			if c != null:
				bad = bad or String(c.id) != "spore"
				n_sp += int(c.n)
		seen[n_sp] = true
		bad = bad or n_sp < 0 or n_sp > 3
	_ok("в теле — от нуля до трёх споранов (встречается 0, 1, 2 и 3)", not bad and seen.size() == 4, str(seen.keys()))
	e.loot = [ULItems.make("spore", 2), null, null, null]
	var sp0 := inv.count("spore")
	await get_tree().create_timer(2.6).timeout                         # упал и лежит
	_ok("тело лежит на земле (таз ниже 0.4 м)", (e.rig.skel.global_transform * e.rig.skel.get_bone_global_pose(e.rig.skel.find_bone("Hip")).origin).y < 0.4, "таз на высоте %.2f м" % (e.rig.skel.global_transform * e.rig.skel.get_bone_global_pose(e.rig.skel.find_bone("Hip")).origin).y)
	player.global_position = e.body_pos() + Vector3(0.7, 0.05, 0.0)
	await get_tree().create_timer(0.25).timeout
	_ok("рядом с телом — действие «Обыскать»", _target != null and _target.type == "corpse" and _action_label() == "Обыскать", _action_label())
	do_action()
	_ok("обыск открывает добычу тела как хранилище", inv_ui.visible and inv_ui.cont == e.loot)
	inv_ui._take_all()
	_ok("«Взять всё»: два спорана — в инвентаре", inv.count("spore") == sp0 + 2 and e.loot[0] == null, "%d → %d" % [sp0, inv.count("spore")])
	_ok("тело лежит минуту", ULEnemy.CORPSE_S == 60.0 and is_instance_valid(e) and enemies.has(e))
	e.dead_t = ULEnemy.CORPSE_S - 0.3
	await get_tree().create_timer(0.6).timeout
	_ok("через минуту обысканное тело исчезает, окно обыска закрывается", not is_instance_valid(e) and enemies.size() == 1 and targets.size() == n_targets + 1 and not inv_ui.visible)
	_damage(far, 1000.0, far.global_position + Vector3.UP)
	far.dead_t = ULEnemy.CORPSE_S - 0.3
	await get_tree().create_timer(0.6).timeout
	_ok("необысканное тело тоже исчезает через минуту", not is_instance_valid(far) and enemies.is_empty() and targets.size() == n_targets)
	# --- Лоторейщик ---
	hp = 100.0
	player.global_position = Vector3(20.0, 0.05, 30.0)
	player.velocity = Vector3.ZERO
	var lt := spawn_enemy("lottery", Vector3(20.0, 0.0, 49.0))          # 19 м: дальше, чем видит (16)
	var top := 0.0
	for mi in lt.rig.model.find_children("*", "MeshInstance3D", true, false):
		var ab: AABB = (mi as MeshInstance3D).global_transform * (mi as MeshInstance3D).get_aabb()
		top = maxf(top, ab.end.y)
	_ok("Лоторейщик: рост 1.9 м, прочность 200, один материал", absf(top - 1.9) < 0.08 and float(lt.get_meta("hp")) == 200.0, "рост %.2f м" % top)
	await get_tree().create_timer(0.4).timeout
	_ok("стоящего героя за 19 м не видит и не слышит", lt.state == "idle" or lt.state == "wander", lt.state)
	# генератор мелких движений: пальцы согнуты когтями, на замахе раскрываются; отростки у пасти найдены
	_ok("генератор существа подключён: когти, дыхание, точка пасти найдена по сетке", lt.rig.fx != null and lt.rig.fx._fingers.size() >= 24 and lt.rig.fx.mouth_mat != null and lt.rig.fx.mouth_off.length() > 0.01, "пальцевых суставов %d, пасть в %.3f ед. от кости головы" % [lt.rig.fx._fingers.size(), lt.rig.fx.mouth_off.length()])
	lt.hear_steps(lt.global_position + Vector3(0, 0, -10.0), 3.0)
	_ok("бег героя слышит за 10 м: кричит (ещё не бежит)", lt.state == "alert", lt.state)
	lt.state = "idle"
	lt.hear_steps(lt.global_position + Vector3(0, 0, -10.0), 1.2)
	_ok("шаги за 10 м не слышит, за 3 м — слышит", lt.state == "idle")
	lt.hear_steps(lt.global_position + Vector3(0, 0, -3.0), 1.2)
	var st_alert := lt.state
	await get_tree().create_timer(1.3).timeout
	_ok("после крика (0.9 с) бежит к месту, где услышал", st_alert == "alert" and lt.state == "chase", "%s → %s" % [st_alert, lt.state])
	# обход препятствия: между ним и героем — ящик
	lt.global_position = Vector3(20.0, 0.0, 37.0)
	lt.state = "chase"
	lt._last = player.global_position
	var blocks := crates.size()
	var empty_c := []
	empty_c.resize(CRATE_SLOTS)
	_add_crate(Vector3(20.0, 0, 33.5), 0.0, empty_c)
	var hp1 := hp
	var w_s := 0.0
	while hp >= hp1 and w_s < 9.0:
		await get_tree().create_timer(0.1).timeout
		w_s += 0.1
	_ok("обошёл ящик на пути и ударил", hp < hp1 and lt.last_attack != "", "за %.1f с, %s: %.0f → %.0f" % [w_s, lt.last_attack, hp1, hp])
	crates[blocks].queue_free()
	crates.remove_at(blocks)
	var atk_seen := {}
	for sd2 in 40:
		var le: Dictionary = ULEnemy.KINDS.lottery.attacks[sd2 % ULEnemy.KINDS.lottery.attacks.size()]
		atk_seen[String(le.n)] = float(le.dmg)
	var bites := 0
	for le2 in ULEnemy.KINDS.lottery.attacks:
		if le2.get("bite", false):
			bites += 1
			bites += 10 if float(le2.reach) > 1.15 else 0
	var n_atk: int = ULEnemy.KINDS.lottery.attacks.size()
	_ok("у Лоторейщика %d разных ударов, из них укусов %d, и все укусы только вплотную (до 1.1 м)" % [atk_seen.size(), bites % 10], atk_seen.size() == n_atk and n_atk >= 7 and bites >= 4 and bites < 10)
	# сильное попадание сбивает, падение — по стороне удара
	lt.rotation.y = 0.0
	lt.global_position = Vector3(20.0, 0.0, 26.0)
	player.global_position = Vector3(20.0, 0.05, 30.0)
	_damage(lt, 60.0, lt.global_position + Vector3.UP)
	_ok("сильное попадание (60 из 200): жив, удар сорван", lt.alive() and is_equal_approx(lt.hp, 140.0) and lt._hit_due < 0.0)
	_damage(lt, 1000.0, lt.global_position + Vector3.UP)
	_ok("убит спереди — падает на спину", not lt.alive() and lt.death_clip == "death", lt.death_clip)
	var lt2 := spawn_enemy("lottery", Vector3(20.0, 0.0, 34.0))
	lt2.rotation.y = 0.0                                                # спиной к герою
	lt2.damage(500.0, player.global_position)
	var lt3 := spawn_enemy("lottery", Vector3(24.0, 0.0, 30.0))
	lt3.rotation.y = 0.0                                                # боком к герою
	lt3.damage(500.0, player.global_position)
	_ok("убит сзади — падает лицом вперёд; сбоку — разворачивает и валит от удара", lt2.death_clip == "death_front" and lt3.death_clip == "death_side", "%s, %s" % [lt2.death_clip, lt3.death_clip])
	var pea_n := 0
	var sp_bad := false
	for sd3 in 200:
		var has_sp := 0
		for c3 in ULEnemy.roll_loot("lottery", sd3):
			if c3 != null and String(c3.id) == "pea":
				pea_n += 1
			if c3 != null and String(c3.id) == "spore":
				has_sp = int(c3.n)
		sp_bad = sp_bad or has_sp < 1 or has_sp > 4
	_ok("в Лоторейщике: спораны 1–4 всегда, горошина — примерно в трети тел", not sp_bad and pea_n > 45 and pea_n < 95, "горошина в %d из 200" % pea_n)
	for e9 in [lt, lt2, lt3]:
		e9.dead_t = ULEnemy.CORPSE_S
	await get_tree().create_timer(0.3).timeout
	_ok("тела Лоторейщиков убраны", enemies.is_empty())
	# --- автоприцел: враг важнее чучела ---
	player.global_position = Vector3(-20, 0.05, 40)
	_add_target(Vector3(-17.0, 0, 40))
	var scare: Node3D = targets[targets.size() - 1]
	var foe := spawn_enemy("infected", Vector3(-12.0, 0, 40))
	foe.def = foe.def.duplicate()
	foe.def.see = 0.0
	foe.def.hear_run = 0.0
	foe.def.walk = 0.0
	_ok("автоприцел: враг в 8 м важнее чучела в 3 м", _nearest_target(18.0, 180.0, true) == foe)
	_damage(foe, 1000.0, foe.global_position)
	_ok("врага нет — прицел берёт чучело", _nearest_target(18.0, 180.0, true) == scare)
	targets.erase(scare)
	scare.queue_free()
	clear_enemies()
	# --- бег врага: тело не мотает вбок ---
	player.global_position = Vector3(0, 0.05, 40)
	var runner := spawn_enemy("lottery", Vector3(-6.0, 0, 15))
	runner.rotation.y = 0.0
	runner.state = "chase"
	runner._last = player.global_position
	await get_tree().create_timer(0.5).timeout
	var lat_max := 0.0
	var dev_max := 0.0
	for f in 90:
		await get_tree().physics_frame
		var sk: Skeleton3D = runner.rig.skel
		var hipp: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Hip")).origin
		var mv := Vector3(runner.velocity.x, 0, runner.velocity.z)
		if mv.length() < 0.5:
			continue
		var side := mv.normalized().cross(Vector3.UP)
		lat_max = maxf(lat_max, absf((hipp - runner.global_position).dot(side)))
		var lft: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("L_Thigh")).origin - sk.global_transform * sk.get_bone_global_pose(sk.find_bone("R_Thigh")).origin
		lft.y = 0.0
		dev_max = maxf(dev_max, rad_to_deg(lft.cross(Vector3.UP).normalized().angle_to(mv.normalized())))
	_ok("Лоторейщик бежит ровно: таз не уходит вбок от капсулы дальше 25 см, корпус смотрит по ходу", lat_max < 0.25 and dev_max < 30.0, "вбок до %.2f м, корпус отклоняется до %.0f°" % [lat_max, dev_max])
	clear_enemies()
	# гибель героя
	hp = 5.0
	hurt(9.0)
	_ok("здоровье кончилось — герой погиб, управление отключено", hp == 0.0 and _dead_t > 0.0 and _modal())
	await get_tree().create_timer(3.3).timeout
	_ok("через три секунды — снова у дома, здоровье 50", _dead_t == 0.0 and hp == 50.0 and player.global_position.distance_to(Vector3(0, 0, 3)) < 1.0)
	hp = 65.0
	open_book()
	var book_txt := ""
	for l in _book_ui.find_children("*", "Label", true, false):
		book_txt += (l as Label).text + "\n"
	_ok("справочник: заражённый — как ходит, как нападает, что в теле", book_txt.contains("Заражённый") and book_txt.contains("Ходит") and book_txt.contains("Нападает") and book_txt.contains("спораны — от 0 до 3"))
	_book_ui.queue_free()
	await get_tree().process_frame
	# --- ресурсы: кошелёк и торговля ---
	close_inventory()
	var used0 := inv.used()
	var w0 := inv.count("spore")
	inv.add(ULItems.make("spore", 150))
	inv.add(ULItems.make("spore", 150))
	_ok("спораны складываются в одну сумму (сверх стопки) и ячеек не занимают", inv.count("spore") == w0 + 300 and inv.used() == used0, "%d → %d, ячеек занято %d" % [w0, inv.count("spore"), inv.used()])
	for mid in ["pea", "pearl_black", "pearl_red", "pearl_white"]:
		inv.add(ULItems.make(mid, 2))
	var all5 := true
	for mid in ULItems.MONEY:
		all5 = all5 and int(inv.wallet.get(mid, 0)) > 0
	_ok("в кошельке все пять ресурсов: спораны, горошина, три жемчужины", all5 and ULItems.MONEY.size() == 5 and inv.used() == used0)
	open_inventory()
	var wtxt := ""
	for l in inv_ui.find_children("*", "Label", true, false):
		wtxt += (l as Label).text + "|"
	_ok("в инвентаре — окошко «Ресурсы» с количеством", wtxt.contains("Ресурсы") and wtxt.contains("|%d|" % inv.count("spore")))
	close_inventory()
	var sp1 := inv.count("spore")
	var band0 := inv.count("bandage")
	inv.pockets[7] = null
	_ok("покупка бинта: спораны списаны, бинт получен", buy("supplies", 0) and inv.count("spore") == sp1 - 1 and inv.count("bandage") == band0 + 1, "спораны %d → %d" % [sp1, inv.count("spore")])
	inv.wallet["pea"] = 0
	var sp2 := inv.count("spore")
	_ok("не хватает горошин — покупки нет, ничего не списано", not buy("supplies", 7) and inv.count("spore") == sp2 and inv.count("pack_medium") == 0)
	inv.wallet["pea"] = 2
	var wsnap := JSON.stringify({"inv": inv.to_dict()})
	var inv3 := ULInventory.new()
	inv3.from_dict(JSON.parse_string(wsnap).inv)
	_ok("кошелёк сохраняется и загружается", inv3.count("spore") == inv.count("spore") and int(inv3.wallet.get("pea", 0)) == 2)
	var inv4 := ULInventory.new()
	inv4.from_dict({"pockets": [ULItems.make("spore", 3), ULItems.make("bandage", 1)]})
	_ok("старое сохранение: спораны из ячеек переходят в кошелёк", int(inv4.wallet.get("spore", 0)) == 3 and inv4.used() == 1)
	# --- рюкзаки у торговца: больший надевается сразу, вещи из надетого перекладываются ---
	var keep_inv := JSON.stringify(inv.to_dict())
	var keep_ground := ground.size()
	for k in inv.pockets.size():
		inv.pockets[k] = null
	inv.pack = ULItems.make("pack_small")
	ULInventory.put(inv.pack.items, ULItems.make("rusk", 2))
	ULInventory.put(inv.pack.items, ULItems.make("water"))
	ULInventory.put(inv.pack.items, ULItems.make("a545", 30))
	inv.wallet = {"pea": 3}
	var pi_m := -1
	var pi_l := -1
	for k in SHOP.supplies.size():
		if String(SHOP.supplies[k][0]) == "pack_medium":
			pi_m = k
		elif String(SHOP.supplies[k][0]) == "pack_large":
			pi_l = k
	var bm := buy("supplies", pi_m)
	var small_in_pocket: int = inv.pockets.filter(func(x): return x != null and String(x.id) == "pack_small").size()
	_ok("купил средний рюкзак (1 горошина) с вещами в малом: средний надет сразу, сухари, вода и патроны — в нём, малый (пустой) — в кармане",
		bm and String(inv.pack.id) == "pack_medium" and inv.count("rusk") == 2 and inv.count("water") == 1 and inv.count("a545") == 30 and small_in_pocket == 1 and int(inv.wallet.get("pea", 0)) == 2 and inv.slot_count() == 20, "надет %s, в кармане малых %d" % [String(inv.pack.id), small_in_pocket])
	var bl := buy("supplies", pi_l)
	_ok("купил большой (2 горошины): надет, вещи переложены, средний — в кармане", bl and String(inv.pack.id) == "pack_large" and inv.count("rusk") == 2 and inv.count("a545") == 30 and inv.slot_count() == 28 and inv.pockets.filter(func(x): return x != null and String(x.id) == "pack_medium").size() == 1 and int(inv.wallet.get("pea", 0)) == 0)
	var psi := -1
	for k in inv.pockets.size():
		if inv.pockets[k] != null and String(inv.pockets[k].id) == "pack_small":
			psi = k
	var eq := inv.equip_from(inv.pockets, psi)
	_ok("надеть из кармана малый вместо большого с вещами: вещи (3 стопки) перекладываются, большой — в карман", eq and String(inv.pack.id) == "pack_small" and inv.count("rusk") == 2 and inv.count("a545") == 30 and inv.pockets[psi] != null and String(inv.pockets[psi].id) == "pack_large")
	for k in 8:
		ULInventory.put(inv.pack.items, ULItems.make("can"))
	var full_small: int = (inv.pack.items as Array).filter(func(x): return x != null).size()
	var mi := -1
	for k in inv.pockets.size():
		if inv.pockets[k] != null and String(inv.pockets[k].id) == "pack_medium":
			mi = k
	var keep_m: Dictionary = inv.pockets[mi].duplicate(true)
	inv.pockets[mi].items.resize(2)
	var eq2 := inv.equip_from(inv.pockets, mi)
	inv.pockets[mi] = keep_m
	_ok("не влезают вещи (%d стопок в рюкзак на 2) — смены нет, ничего не потеряно" % full_small, not eq2 and String(inv.pack.id) == "pack_small" and inv.pack.items.filter(func(x): return x != null).size() == full_small)
	inv.from_dict(JSON.parse_string(keep_inv))
	while ground.size() > keep_ground:
		ground.pop_back()
	# --- выход с локации ---
	player.global_position = Vector3(0.0, 0.05, 30.0)
	await get_tree().create_timer(0.3).timeout
	_ok("на локации отсчёта нет", _leave_t == 0.0 and not left_location)
	player.global_position = Vector3(0.0, 0.05, 53.0)
	await get_tree().create_timer(1.2).timeout
	_ok("за краем поля идёт отсчёт", _leave_t > 0.8 and _leave_t < 2.0 and not left_location, "прошло %.1f с" % _leave_t)
	player.global_position = Vector3(0.0, 0.05, 45.0)
	await get_tree().create_timer(0.3).timeout
	_ok("вернулся — отсчёт сброшен", _leave_t == 0.0 and not left_location)
	player.global_position = Vector3(0.0, 0.05, 54.0)
	await get_tree().create_timer(5.4).timeout
	_ok("пять секунд за краем — переход на карту мира", left_location, "прошло %.1f с" % _leave_t)
	# сохранение и загрузка
	var snap := JSON.stringify({"inv": inv.to_dict()})
	var inv2 := ULInventory.new()
	inv2.from_dict(JSON.parse_string(snap).inv)
	var n_int := true
	for c in inv2.pockets:
		if c != null and typeof(c.n) != TYPE_INT:
			n_int = false
	_ok("сохранение и загрузка: тот же инвентарь", JSON.stringify(inv2.to_dict()) == JSON.stringify(inv.to_dict()) and inv2.slot_count() == inv.slot_count() and n_int)
	print("[inv] итог: ошибок %d" % _fails)
	await _perf_report()
	get_tree().quit()


# ---------------- замер графики по частям ----------------

## Средние за n кадров: кадры/с, время кадра, обработка (скрипты, ИИ), физика, отрисовка на процессоре и на
## видеокарте (замер вьюпорта), вызовы отрисовки, треугольники, объекты, память текстур
func _gfx_sample(n := 60) -> Dictionary:
	var vp := get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(vp, true)
	for k in 15:
		await get_tree().process_frame
	var t0 := Time.get_ticks_usec()
	var proc := 0.0
	var phys := 0.0
	var rcpu := 0.0
	var rgpu := 0.0
	var dc := 0.0
	var tri := 0.0
	var obj := 0.0
	for k in n:
		await get_tree().process_frame
		proc += Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0
		phys += Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
		rcpu += RenderingServer.viewport_get_measured_render_time_cpu(vp)
		rgpu += RenderingServer.viewport_get_measured_render_time_gpu(vp)
		dc += RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)
		tri += RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)
		obj += RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME)
	var dt := (Time.get_ticks_usec() - t0) / 1000.0 / n
	return {"fps": 1000.0 / dt, "frame": dt, "proc": proc / n, "phys": phys / n, "rcpu": rcpu / n, "rgpu": rgpu / n, "dc": dc / n, "tri": tri / n, "obj": obj / n,
		"tex": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576.0, "vmem": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_VIDEO_MEM_USED) / 1048576.0}


func _gfx_line(name: String, r: Dictionary, base: Dictionary) -> String:
	var d := "" if base.is_empty() else "  (кадр %+.1f мс, %+.0f %%)" % [float(r.frame) - float(base.frame), (float(r.frame) / maxf(float(base.frame), 0.01) - 1.0) * 100.0]
	return "%-34s %5.1f к/с  кадр %6.1f мс | скрипты+ИИ %5.1f | физика %4.1f | отрисовка ЦП %5.1f, ГП %5.1f | вызовов %4d, треуг. %4d тыс., объектов %3d%s" % [
		name, float(r.fps), float(r.frame), float(r.proc), float(r.phys), float(r.rcpu), float(r.rgpu), int(r.dc), int(float(r.tri) / 1000.0), int(r.obj), d]


func _gfx_diag() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 40000:
		await get_tree().process_frame
	var vpo := get_viewport()
	print("[gfx] рендерер: %s, видеокарта: %s / %s" % [ProjectSettings.get_setting("rendering/renderer/rendering_method"), RenderingServer.get_video_adapter_vendor(), RenderingServer.get_video_adapter_name()])
	print("[gfx] качество «%s»: разрешение 3D %d %% (scaling_3d_scale — доля ширины и высоты экрана, в которой рисуется 3D; остальное растягивается), MSAA %s, окно %s" % [String(ULSettings.q().n), int(round(vpo.scaling_3d_scale * 100.0)), str(vpo.msaa_3d), str(vpo.get_visible_rect().size)])
	var lights := 0
	var shadowed := 0
	for l in get_tree().root.find_children("*", "Light3D", true, false):
		if (l as Light3D).visible:
			lights += 1
			if (l as Light3D).shadow_enabled:
				shadowed += 1
	var mats := {}
	var meshes := 0
	for g in get_tree().root.find_children("*", "GeometryInstance3D", true, false):
		meshes += 1
		var gi := g as GeometryInstance3D
		if gi.material_override != null:
			mats[gi.material_override] = true
		if gi is MeshInstance3D and (gi as MeshInstance3D).mesh != null:
			var mh := (gi as MeshInstance3D).mesh
			for si in mh.get_surface_count():
				var sm = mh.surface_get_material(si)
				if sm != null:
					mats[sm] = true
	print("[gfx] источников света %d (с тенями %d), сеток %d, разных материалов %d, муров %d" % [lights, shadowed, meshes, mats.size(), enemies.size()])
	# сцена неподвижна: муры стоят спокойно и героя не замечают (иначе каждый замер — другая схватка);
	# бой — отдельной строкой в конце
	for e in enemies:
		e.def = e.def.duplicate(true)
		for kk in ["see", "hear", "hear_run", "hear_walk"]:
			e.def[kk] = 0.0
		e.state = "idle"
		e.wander_r = 0.0
		if e is ULMur:
			(e as ULMur).patrol = PackedVector3Array()
	var spots := [["двор у костра", Vector3(0, 0, 16)], ["штаб, коридор", Vector3(4, 0, -50)]]
	for sp in spots:
		player.global_position = (sp[1] as Vector3) + Vector3.UP * 0.1
		_cam_ready = false
		await get_tree().create_timer(1.0).timeout
		print("[gfx] --- %s ---" % sp[0])
		var base: Dictionary = await _gfx_sample()
		print("[gfx] " + _gfx_line("всё включено", base, {}))
		if OS.get_cmdline_user_args().has("--as-quick"):
			continue
		# по одному: выключили — замерили — вернули
		var tests := ["тени солнца", "трава и бурьян", "деревья и камни", "шейдер земли → простой", "туман", "сглаживание MSAA", "муры: не рисовать", "муры: без ИИ", "постройки", "разрешение 50 %", "разрешение 100 %"]
		for tn in tests:
			var undo: Array = []
			match tn:
				"тени солнца":
					sun.shadow_enabled = false
					undo.append(func(): sun.shadow_enabled = true if ULSettings.gfx >= 1 else false)
				"трава и бурьян":
					for g in get_tree().root.find_children("*", "MultiMeshInstance3D", true, false):
						if g.has_meta("veg") and (g as Node3D).visible:
							(g as Node3D).visible = false
							undo.append(func(): (g as Node3D).visible = true)
				"деревья и камни":
					for g in san.get_children():
						if g is MultiMeshInstance3D and not g.has_meta("veg") and (g as Node3D).visible:
							(g as Node3D).visible = false
							undo.append(func(): (g as Node3D).visible = true)
					for tr in san.trees:
						if is_instance_valid(tr) and tr.visible:
							tr.visible = false
							undo.append(func(): tr.visible = true)
				"шейдер земли → простой":
					for g in san.get_children():
						if g is MeshInstance3D and (g as MeshInstance3D).mesh is PlaneMesh and (g as MeshInstance3D).material_override is ShaderMaterial and ((g as MeshInstance3D).mesh as PlaneMesh).size.x >= size_m - 1.0:
							var old_m: Material = (g as MeshInstance3D).material_override
							var sm2 := StandardMaterial3D.new()
							sm2.albedo_color = Color(0.45, 0.4, 0.3)
							(g as MeshInstance3D).material_override = sm2
							undo.append(func(): (g as MeshInstance3D).material_override = old_m)
				"туман":
					world_env.fog_enabled = false
					undo.append(func(): world_env.fog_enabled = true)
				"сглаживание MSAA":
					var ms0 := vpo.msaa_3d
					vpo.msaa_3d = Viewport.MSAA_DISABLED
					undo.append(func(): vpo.msaa_3d = ms0)
				"муры: не рисовать":
					for e in enemies:
						if e.visible:
							e.visible = false
							undo.append(func(): e.visible = true)
				"муры: без ИИ":
					var keep: Array[ULEnemy] = enemies.duplicate()
					enemies.clear()
					undo.append(func(): enemies.assign(keep))
				"постройки":
					for b in san.blds:
						if b.visible:
							b.visible = false
							undo.append(func(): b.visible = true)
				"разрешение 50 %":
					var s0 := vpo.scaling_3d_scale
					vpo.scaling_3d_scale = 0.5
					undo.append(func(): vpo.scaling_3d_scale = s0)
				"разрешение 100 %":
					var s1 := vpo.scaling_3d_scale
					vpo.scaling_3d_scale = 1.0
					undo.append(func(): vpo.scaling_3d_scale = s1)
			var r: Dictionary = await _gfx_sample()
			print("[gfx] " + _gfx_line("без: " + tn if not tn.begins_with("разрешение") else tn, r, base))
			for u in undo:
				(u as Callable).call()
		if out != "":
			await _snap("gfx_" + ("yard" if String(sp[0]).begins_with("двор") else "hq"))
	if OS.get_cmdline_user_args().has("--as-quick"):
		return
	# бой: все муры в пределах 40 м — в погоне за героем (ИИ, стрельба, пули)
	player.global_position = Vector3(0, 0.1, 16)
	await get_tree().create_timer(0.5).timeout
	for e in enemies:
		e.def.see = 40.0
		if e.alive() and e.global_position.distance_to(player.global_position) < 40.0:
			e._notice(player.global_position)
	await get_tree().create_timer(2.0).timeout
	prof_full = 0
	prof_full_n = 0
	var rb: Dictionary = await _gfx_sample(90)
	print("[gfx] --- бой у костра ---")
	print("[gfx] " + _gfx_line("все муры рядом в бою", rb, {}))
	print("[gfx] ИИ врагов: %.2f мс на кадр (%d вызовов за %d кадров)" % [prof_full / 1000.0 / 90.0, prof_full_n, 90])


# ---------------- муры ----------------

var lair_inst := ""                ## экземпляр логова этого посещения (ключ главаря — только от него)
var mur_hits := 0                  ## для проверок: сколько пуль муров попало в героя, сколько мимо
var mur_shots := 0
var special_hits := 0
var special_miss := 0


## роль мура по месту из плана логова: дозор (маршрут), снайпер на вышке, главарь (не выходит из штаба, ключ при нём)
func _mur_role(m: ULMur, zn: String, rng: RandomNumberGenerator) -> void:
	var lr := san as ULLair
	if zn.begins_with("patrol:") and lr != null:
		m.patrol = lr.patrol_routes[int(zn.substr(7)) % lr.patrol_routes.size()]
		m.wander_r = 0.0
	elif zn.begins_with("tower:"):
		m.sniper = true
		m.wander_r = 0.0
		m.def = m.def.duplicate(true)
		m.def.see = float(m.def.see) * 1.45
		m.def.lose = float(m.def.lose) * 1.2
		m.gun = m.gun.duplicate(true)
		m.gun.range = float(m.gun.range) * 1.35
		m.gun.acc_far = 0.4
	elif zn == "boss" and lr != null:
		m.wander_r = 0.0
		m.area = lr.blds[0].rect.grow(-0.45)
		# ключ от оружейного сундука — всегда при главаре (только от этого экземпляра логова)
		ULInventory.put(m.loot, ULCase.make_key(lair_inst if lair_inst != "" else String(ULCase.lair().get("inst", ""))))
		boss = m
	else:
		m.wander_r = 0.0 if rng.randf() < 0.45 else 2.5


var boss: ULMur = null


## Выстрел мура: каждая пуля (дробина) — луч от дульного среза; стены, укрытия и другие муры её останавливают.
## Урон — когда пуля долетит; у дроби он слабеет с расстоянием (near → far_k), доля здоровья (dmg < 0) — у главаря.
func _mur_shoot(from: Vector3, dirs: Array, dmg: float, info: Dictionary, m: ULMur) -> void:
	if not is_instance_valid(m):
		return
	mur_shots += 1
	var space := get_world_3d().direct_space_state
	var reach := float(info.get("range", 30.0))
	var near := float(info.get("near", 0.0))
	var per := dmg if dmg > 0.0 else -dmg * HP_MAX
	for d in dirs:
		var q := PhysicsRayQueryParameters3D.create(from, from + (d as Vector3) * reach)
		q.exclude = [m.get_rid()]
		var hit := space.intersect_ray(q)
		var end: Vector3 = hit.position if not hit.is_empty() else from + (d as Vector3) * reach
		var col: Object = hit.collider if not hit.is_empty() else null
		var k := 1.0
		if near > 0.0:
			var dd := from.distance_to(end)
			k = lerpf(1.0, float(info.get("far_k", 1.0)), clampf((dd - near) / maxf(reach - 6.0 - near, 0.1), 0.0, 1.0))
		_fly_bullet(String(info.get("tracer", "a545")), from, end, col, per * k, true)
	snd.play(String(info.get("sound", "shot_ak")), from, float(info.get("db", 0.0)), 0.05)
	# выстрел слышат другие муры: поднимаются по тревоге
	for e in enemies:
		if e != m and e is ULMur:
			e.hear(from)


## Прицельный выстрел главаря: по застывшей полосе (from, dir, длина до стены, ширина). Герой на полосе и не за
## укрытием — урон в долю здоровья; ушёл — мимо (пуля уходит вдоль полосы).
func _mur_special(from: Vector3, dir: Vector3, length: float, width: float, pct: float, m: ULMur) -> void:
	var pp := player.global_position
	var rel := Vector3(pp.x - from.x, 0, pp.z - from.z)
	var along := rel.dot(dir)
	var off := (rel - dir * along).length()
	var on_line := along > 0.0 and along <= length + 0.3 and off <= width * 0.5 + 0.3 and absf(pp.y + 1.2 - from.y) < 2.0
	var end := from + dir * length
	if on_line and _dead_t <= 0.0:
		var q := PhysicsRayQueryParameters3D.create(from, pp + Vector3.UP * 1.2)
		q.exclude = [m.get_rid(), player.get_rid()]
		if get_world_3d().direct_space_state.intersect_ray(q).is_empty():
			special_hits += 1
			hurt(pct * HP_MAX, from)
			end = pp + Vector3.UP * 1.2
			say("Прицельный выстрел главаря: −%d" % int(round(pct * HP_MAX)))
		else:
			special_miss += 1
	else:
		special_miss += 1
	_fly_bullet("a762x54", from, end, null, 0.0, true)
	snd.play("shot_svd", from, 4.0, 0.03)


## Оружейный сундук главаря: ключ (только от этого логова) → награда выбирается и записывается сразу → прокрутка
## → «Забрать». Невыданная (нет места) ждёт в окне выдачи.
var case_ui: ULCaseUI = null


func open_chest() -> void:
	if case_ui != null and is_instance_valid(case_ui):
		return
	var rng := RandomNumberGenerator.new()
	rng.randomize()
	var res := ULCase.open_chest(inv, rng)
	match String(res.err):
		"":
			_case_show(res.reward, false)
			snd.play("box_in", player.global_position, -2.0)
		"pending":
			_case_show(res.reward, true)
		"open":
			say("Сундук пуст")
		"stale":
			say("Ключ от другого логова — к этому замку не подходит")
		_:
			say("Закрыто. Требуется ключ главаря муров")


## окно прокрутки (или сразу — выдачи, если награда уже выпала раньше)
func _case_show(rw: Dictionary, result_only: bool) -> void:
	var cl := CanvasLayer.new()
	cl.layer = 30
	add_child(cl)
	case_ui = ULCaseUI.new()
	cl.add_child(case_ui)
	case_ui.claim_fn = func() -> Dictionary:
		var r := ULCase.claim(inv)
		if r.ok:
			say("Получено: %s" % ULItems.get_def(String(rw.id)).n)
			_save()
		return r
	case_ui.start(rw, false)
	if result_only:
		case_ui.skip()
	case_ui.tree_exited.connect(cl.queue_free)


## Проверка логова муров (--as-test=lr): поле и постройки по карте, проходимость, муры (сколько, роли), бой с
## каждым видом (очереди, точность не 100 %, перезарядка, укрытия, стены держат пули, погоня ограничена; дробь лучами,
## слабеет с расстоянием, стреляет только вблизи), главарь (держит дистанцию, не выходит из штаба, обычный выстрел —
## 10 % здоровья, прицельный с красной полосой: ушёл — мимо, стоял — треть), ключ при главаре, сундук и выдача.
func _lair_test() -> void:
	var t0 := Time.get_ticks_msec()
	while not cs_ready and Time.get_ticks_msec() - t0 < 40000:
		await get_tree().process_frame
	var lr := san as ULLair
	var c := ULLair.lcfg()
	var map := get_world_3d().navigation_map
	var snapf := func(p: Vector3) -> Vector3:
		return NavigationServer3D.map_get_closest_point(map, p)
	var space := get_world_3d().direct_space_state
	print("[inv] логово готово через %.1f с от запуска игры" % (sn_ready_ms / 1000.0))
	# ---- 1. поле, постройки, проходимость ----
	var by_id := {}
	for b in san.blds:
		by_id[b.id] = b
	var rt_l: Dictionary = ULBase.shop().routes.lair
	_ok("логово: поле %d×%d м, вход с юга, %d минут, маршрут %d споранов, опасность «%s»" % [int(size_m), int(size_m), int(c.minutes), int(rt_l.price.spore), String(rt_l.danger)],
		size_m == 200.0 and place == "lair" and ULLair.L_ENTRY.z > 85.0 and int(c.minutes) == 20 and int(rt_l.price.spore) == 50 and String(rt_l.danger) == "2 уровень" and absf(_cs_end - cs_start - 1200.0) < 1.0)
	var need := ["hq", "barracks", "warehouse", "workshop", "mess", "quarters", "shed_nw", "shed_ne", "shed_e", "container", "tent", "hut"]
	_ok("постройки по карте: штаб, казарма, склад, мастерская, столовая, жилой блок, сараи, гараж, контейнер, палатка, будка", need.all(func(x): return by_id.has(x)), str(by_id.keys()))
	var cpos := func(id: String) -> Vector2:
		return (by_id[id].rect as Rect2).get_center()
	_ok("расположение как на утверждённой карте: штаб — север посередине, казарма — запад, склад — юго-запад, мастерская — центр слева, столовая — восток, жилой блок — юго-восток",
		cpos.call("hq").y < -45.0 and absf(cpos.call("hq").x) < 6.0 and cpos.call("barracks").x < -50.0 and cpos.call("warehouse").x < -30.0 and cpos.call("warehouse").y > 10.0 \
		and cpos.call("workshop").x < 0.0 and cpos.call("workshop").x > -30.0 and cpos.call("mess").x > 30.0 and cpos.call("mess").y < 0.0 and cpos.call("quarters").x > 30.0 and cpos.call("quarters").y > 20.0)
	var rt := {}
	for b in san.blds:
		for r in b.rooms:
			rt[String(r.type)] = int(rt.get(String(r.type), 0)) + 1
	_ok("в штабе — кабинет главаря, канцелярия, оружейная, радиорубка; в казарме — 5 кубриков с койками; склад, мастерская, столовая с кухней, жилые комнаты",
		rt.has("m_boss") and rt.has("m_office") and rt.has("m_armory") and rt.has("m_radio") and int(rt.get("m_bunk", 0)) == 5 and rt.has("warehouse") and rt.has("workshop") and rt.has("dining") and rt.has("kitchen") and int(rt.get("m_quarters", 0)) >= 3, str(rt))
	var br: Rect2 = lr.boss_room
	_ok("кабинет главаря не меньше 12×10 м (%.1f×%.1f), оружейный сундук у дальней стены" % [maxf(br.size.x, br.size.y), minf(br.size.x, br.size.y)],
		maxf(br.size.x, br.size.y) >= 12.0 and minf(br.size.x, br.size.y) >= 10.0 and br.grow(0.1).has_point(Vector2(lr.chest_pos.x, lr.chest_pos.z)) and lr.chest_node != null)
	var nbox := 0
	for ct in san.containers:
		if String(ct.get("bld", "")) == "hq" and br.grow(0.2).has_point(Vector2((ct.pos as Vector3).x, (ct.pos as Vector3).z)):
			nbox += 1
	_ok("в кабинете — стол с картой, шкафы, стеллажи, ящики (тайников %d)" % nbox, nbox >= 4)
	var e0: Vector3 = snapf.call(ULLair.L_ENTRY)
	var bad := []
	for b in san.blds:
		var inside_p := Vector3.INF
		for r in b.rooms:
			if bool(r.get("big", false)):
				var bk: Dictionary = b.blocks[int(r.bi)]
				inside_p = b._w(bk, (float(r.u0) + float(r.u1)) * 0.5, 0.0, (float(r.v0) + float(r.v1)) * 0.5)
				break
		if inside_p == Vector3.INF:
			continue
		var path := NavigationServer3D.map_get_path(map, e0, snapf.call(inside_p), true)
		if path.is_empty() or path[path.size() - 1].distance_to(inside_p) > 1.3:
			bad.append(b.id)
	_ok("во все постройки можно зайти: путь от входа в логово до зала каждой", bad.is_empty(), str(bad))
	var bp := NavigationServer3D.map_get_path(map, e0, snapf.call(lr.boss_pos), true)
	_ok("путь от входа до кабинета главаря есть", not bp.is_empty() and bp[bp.size() - 1].distance_to(lr.boss_pos) < 1.3)
	var wall_hits := 0
	for xq in [-60.0, -30.0, 30.0, 60.0]:
		if not space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(xq, 0.5, ULLair.FZ1 + 4.0), Vector3(xq, 0.5, ULLair.FZ1 - 4.0))).is_empty():
			wall_hits += 1
	for zq in [-40.0, 0.0, 40.0]:
		if not space.intersect_ray(PhysicsRayQueryParameters3D.create(Vector3(ULLair.FX + 4.0, 0.5, zq), Vector3(ULLair.FX - 4.0, 0.5, zq))).is_empty():
			wall_hits += 1
	var gap_path := NavigationServer3D.map_get_path(map, e0, snapf.call(Vector3(0, 0, 40)), true)
	_ok("ограда из бетонных блоков: на юге — проход без ворот, по сторонам сплошная (%d из 7 лучей упёрлись)" % wall_hits, wall_hits == 7 and not gap_path.is_empty() and gap_path[gap_path.size() - 1].distance_to(Vector3(0, 0, 40)) < 1.5)
	_ok("две вышки, водонапорный бак, костёр, знамёна с волком", lr.towers.size() == 2 and lr.banner_mat != null)
	# ---- 2. муры: сколько, какие, где ----
	var nk := {}
	var roles := {}
	for sp in cs_plan:
		nk[String(sp[0])] = int(nk.get(String(sp[0]), 0)) + 1
		var zr := String(sp[2]).split(":")[0]
		roles[zr] = int(roles.get(zr, 0)) + 1
	var nm := int(nk.get("mur_ak", 0)) + int(nk.get("mur_sg", 0))
	_ok("муров %d (25–40): автоматчиков %d, с дробовиком %d, главарь %d; снайперов на вышках %d, в дозоре %d" % [nm, int(nk.get("mur_ak", 0)), int(nk.get("mur_sg", 0)), int(nk.get("mur_boss", 0)), int(roles.get("tower", 0)), int(roles.get("patrol", 0))],
		nm >= 25 and nm <= 40 and int(nk.get("mur_ak", 0)) > 0 and int(nk.get("mur_sg", 0)) > 0 and int(nk.get("mur_boss", 0)) == 1 and int(roles.get("tower", 0)) == 2 and int(roles.get("patrol", 0)) == 6, str(roles))
	var armed := true
	for e in enemies:
		if e is ULMur and ((e as ULMur).rig.hold.wid == "" or (e as ULMur).rig.hold.node == null):
			armed = false
	_ok("все муры — модели Tripo с оружием в руках (хват обеими руками, как у героя)", armed and enemies.size() == cs_plan.size())
	var bos: ULMur = boss
	var key_ok := false
	if bos != null:
		for it in bos.loot:
			if it != null and String(it.id) == ULCase.KEY and String(it.get("inst", "")) == lair_inst and lair_inst == String(ULCase.lair().inst) and lair_inst != "":
				key_ok = true
	_ok("главарь — в своём кабинете, ключ от сундука при нём (только от этого логова)", bos != null and br.grow(0.3).has_point(Vector2(bos.global_position.x, bos.global_position.z)) and key_ok)
	# ---- 3. бой: остальных муров убираем, герой не умирает (здоровья с запасом) ----
	var ak: ULMur = null
	var sg: ULMur = null
	for e in enemies:
		if e is ULMur and e != bos and (e as ULMur).patrol.is_empty() and not (e as ULMur).sniper:
			if e.kind == "mur_ak" and ak == null:
				ak = e
			elif e.kind == "mur_sg" and sg == null:
				sg = e
	for e in enemies.duplicate():
		if e != ak and e != sg and e != bos:
			e.visible = false
			e.collision_layer = 0
			e.collision_mask = 0
			e.global_position = Vector3(e.global_position.x, -90.0, e.global_position.z)
			enemies.erase(e)
			targets.erase(e)
			e.queue_free()
	var park := func(m: ULMur, at: Vector3) -> void:
		m.global_position = at
		m.home = at
		m.state = "idle"
		m.phase = ""
		m.velocity = Vector3.ZERO
		m.wander_r = 0.0
	park.call(sg, snapf.call(Vector3(62, 0, -50)))
	hp = 100000.0
	# -- автоматчик --
	var pa: Vector3 = snapf.call(Vector3(-17, 0, 46))
	park.call(ak, pa)
	ak.rotation.y = 0.0
	player.global_position = snapf.call(pa + Vector3(0, 0, -12)) + Vector3.UP * 0.1
	player.velocity = Vector3.ZERO
	mur_hits = 0
	var tw := 0.0
	while ak.state != "chase" and tw < 4.0:
		await get_tree().physics_frame
		tw += get_physics_process_delta_time()
	var mz := ak.rig.hold.muzzle_world()
	_ok("автоматчик заметил героя за %.1f с, вскинул автомат (стойка «%s»)" % [tw, ak.rig.hold.stance], ak.state == "chase" and tw < 3.5 and ak.rig.hold.stance == "aim")
	var hp_a := hp
	var t_fire := 0.0
	var sh0 := ak.shots
	while t_fire < 9.0:
		player.global_position = Vector3(player.global_position.x, player.global_position.y, player.global_position.z)
		await get_tree().physics_frame
		t_fire += get_physics_process_delta_time()
	await get_tree().create_timer(0.6).timeout
	mz = ak.rig.hold.muzzle_world()
	var n_sh := ak.shots - sh0
	_ok("стреляет короткими очередями: выстрелов %d, очередей %d (в очереди 3–5)" % [n_sh, ak.bursts], n_sh >= 6 and ak.bursts >= 2 and ak.shots <= ak.bursts * 5)
	_ok("бьёт не наверняка: попало %d из %d, урон %d" % [mur_hits, ak.shots, int(hp_a - hp)], mur_hits > 0 and mur_hits < ak.shots and hp < hp_a)
	_ok("выстрел — от дульного среза автомата в руках", not mz.is_empty() and (mz[0] as Vector3).distance_to(ak.global_position + Vector3.UP * 1.3) < 1.3)
	var tr := 0.0
	while ak.reloads < 1 and tr < 16.0:
		await get_tree().physics_frame
		tr += get_physics_process_delta_time()
	_ok("магазин (30) кончился — перезаряжается (%d раз, выстрелов всего %d)" % [ak.reloads, ak.shots], ak.reloads >= 1)
	_ok("между очередями — в укрытие (%d раз, сидя за ним) или шаг в сторону" % ak.covers, ak.covers >= 1 or ak.global_position.distance_to(pa) > 0.5, "сдвинулся на %.1f м" % ak.global_position.distance_to(pa))
	# пули не проходят сквозь стены: выстрел из-за стены склада по герою внутри — мимо; изнутри — попадает
	var hall_p: Vector3 = snapf.call(Vector3(-46, 0, 22.5))
	player.global_position = hall_p + Vector3.UP * 0.1
	await get_tree().create_timer(0.3).timeout
	var h0 := mur_hits
	var info := {"range": 40.0, "tracer": "a545", "sound": "shot_ak"}
	var outside := Vector3(-46, 1.3, 33.0)
	_mur_shoot(outside, [((player.global_position + Vector3.UP * 1.2) - outside).normalized()], 7.0, info, ak)
	await get_tree().create_timer(0.6).timeout
	var h1 := mur_hits
	var inside := Vector3(-46, 1.3, 26.0)
	_mur_shoot(inside, [((player.global_position + Vector3.UP * 1.2) - inside).normalized()], 7.0, info, ak)
	await get_tree().create_timer(0.6).timeout
	_ok("стены держат пули: из-за стены склада — мимо, изнутри — попал", h1 == h0 and mur_hits == h1 + 1, "%d → %d → %d" % [h0, h1, mur_hits])
	# погоня ограничена: герой ушёл далеко из виду — мур не уходит дальше pursue_r от своего места
	player.global_position = snapf.call(Vector3(60, 0, 40)) + Vector3.UP * 0.1
	var maxd := 0.0
	var tp := 0.0
	while tp < 10.0:
		await get_tree().physics_frame
		tp += get_physics_process_delta_time()
		maxd = maxf(maxd, Vector2(ak.global_position.x - pa.x, ak.global_position.z - pa.z).length())
	_ok("за ушедшим героем гонится не дальше %d м от своего места (отошёл на %.1f м)" % [int(ak.gun.pursue_r), maxd], maxd <= float(ak.gun.pursue_r) + 2.0)
	# укрытие: мур у юго-восточного угла склада, герой на открытом месте — между очередями уходит за стену и садится
	park.call(ak, snapf.call(Vector3(-26, 0, 30.5)))
	player.global_position = snapf.call(Vector3(-22, 0, 14)) + Vector3.UP * 0.1
	await get_tree().create_timer(0.2).timeout
	ak.hear(player.global_position)
	var cv0 := ak.covers
	var t_cv := 0.0
	var crouched := false
	while t_cv < 14.0 and (ak.covers == cv0 or not crouched):
		await get_tree().physics_frame
		t_cv += get_physics_process_delta_time()
		crouched = crouched or ak.crouch > 0.8
	_ok("между очередями уходит в укрытие — за угол склада — и садится там (%d раз, за %.1f с)" % [ak.covers - cv0, t_cv], ak.covers > cv0 and crouched,
		"состояние %s/%s, очередей %d, видит %s, мур (%.1f, %.1f)" % [ak.state, ak.phase, ak.bursts, str(ak.get_meta("sees", false)), ak.global_position.x, ak.global_position.z])
	if out != "":
		await _snap("lr_cover")
	park.call(ak, snapf.call(Vector3(-62, 0, 50)))
	ak.set_meta("sees", false)
	# -- мур с дробовиком --
	var ps: Vector3 = snapf.call(Vector3(14, 0, 40))
	park.call(sg, ps)
	sg.rotation.y = PI
	player.global_position = snapf.call(Vector3(14, 0, 24)) + Vector3.UP * 0.1
	var d_first := -1.0
	var sh_s := sg.shots
	var lat := 0.0
	var line_a := Vector2(ps.x, ps.z)
	var line_d := (Vector2(player.global_position.x, player.global_position.z) - line_a).normalized()
	var shot_ts: Array = []
	var ts := 0.0
	while ts < 16.0 and sg.shots < sh_s + 3:
		await get_tree().physics_frame
		ts += get_physics_process_delta_time()
		var q := Vector2(sg.global_position.x, sg.global_position.z) - line_a
		lat = maxf(lat, absf(q.x * line_d.y - q.y * line_d.x))
		if sg.shots > sh_s + shot_ts.size():
			shot_ts.append(ts)
			if d_first < 0.0:
				d_first = sg.global_position.distance_to(player.global_position)
	_ok("дробовик: подобрался ближе и выстрелил только с %.1f м (бьёт до %d м); заходил сбоку на %.1f м" % [d_first, int(sg.gun.range), lat], d_first > 0.0 and d_first <= float(sg.gun.range) + 0.6)
	var gaps_ok := true
	for i in range(1, shot_ts.size()):
		if float(shot_ts[i]) - float(shot_ts[i - 1]) < 0.75:
			gaps_ok = false
	_ok("после выстрела — передёргивает цевьё: между выстрелами не меньше 0,75 с (%s)" % str(shot_ts.map(func(x): return snappedf(x, 0.01))), shot_ts.size() >= 2 and gaps_ok)
	var tr2 := 0.0
	while sg.reloads < 1 and tr2 < 20.0:
		await get_tree().physics_frame
		tr2 += get_physics_process_delta_time()
	_ok("дробовик перезаряжается по патрону (перезарядок %d, в магазине %d)" % [sg.reloads, sg.mag], sg.reloads >= 1)
	park.call(sg, snapf.call(Vector3(62, 0, 50)))
	sg.set_meta("sees", false)
	await get_tree().create_timer(0.8).timeout          # дробь дробовика уже долетела, сам он — далеко
	# дробь: 8 лучей, урон слабеет с расстоянием
	var hp_b := hp
	var dirs_near: Array = []
	var near_from := player.global_position + Vector3(0, 1.25, 3.0)
	for i in 8:
		dirs_near.append(((player.global_position + Vector3.UP * 1.2) - near_from).normalized())
	var info_s := {"range": float(sg.gun.range) + 6.0, "near": float(sg.gun.near), "far_k": float(sg.gun.far_k), "tracer": "a12", "sound": "shot_spas"}
	_mur_shoot(near_from, dirs_near, float(sg.gun.dmg), info_s, sg)
	await get_tree().create_timer(0.5).timeout
	var dmg_near := hp_b - hp
	var far_from := player.global_position + Vector3(0, 1.25, 11.0)
	var dirs_far: Array = []
	for i in 8:
		dirs_far.append(((player.global_position + Vector3.UP * 1.2) - far_from).normalized())
	hp_b = hp
	_mur_shoot(far_from, dirs_far, float(sg.gun.dmg), info_s, sg)
	await get_tree().create_timer(0.6).timeout
	var dmg_far := hp_b - hp
	_ok("дробь — 8 лучей; в упор (3 м) %.0f урона, с 11 м — %.0f (слабеет с расстоянием)" % [dmg_near, dmg_far], absf(dmg_near - 8.0 * float(sg.gun.dmg)) < 0.6 and dmg_far > 0.0 and dmg_far < dmg_near * 0.5)
	# -- главарь --
	var hb: Vector3 = snapf.call(Vector3(br.position.x + 1.6, 0, br.end.y - 1.6))
	player.global_position = hb + Vector3.UP * 0.1
	var tb := 0.0
	while bos.state != "chase" and tb < 5.0:
		await get_tree().physics_frame
		tb += get_physics_process_delta_time()
	_ok("главарь заметил героя в кабинете, над ним — полоса здоровья", bos.state == "chase" and bos.hp_bar != null and bos.hp_bar.visible)
	var inside_area := true
	var min_d := 99.0
	var hp_c := hp
	var hits0 := mur_hits
	var t_b := 0.0
	bos._sp_cd = 99.0                                  # сначала — обычные выстрелы
	var bs0 := bos.shots
	while t_b < 20.0 and (t_b < 8.0 or bos.shots - bs0 < 10):
		await get_tree().physics_frame
		t_b += get_physics_process_delta_time()
		if not bos.area.grow(0.05).has_point(Vector2(bos.global_position.x, bos.global_position.z)):
			inside_area = false
		min_d = minf(min_d, bos.global_position.distance_to(player.global_position))
	await get_tree().create_timer(0.5).timeout
	var per := (hp_c - hp) / maxf(float(mur_hits - hits0), 1.0)
	_ok("обычный выстрел Desert Eagle — 10 %% здоровья (%.1f за попадание), не каждый попадает (%d из %d)" % [per, mur_hits - hits0, bos.shots - bs0], absf(per - HP_MAX * 0.1) < 0.6 and mur_hits - hits0 < bos.shots - bs0 and mur_hits - hits0 > 0)
	# подошёл вплотную — отступает
	var close_p: Vector3 = bos.global_position + (player.global_position - bos.global_position).normalized() * 2.5
	player.global_position = snapf.call(close_p) + Vector3.UP * 0.1
	var d0 := bos.global_position.distance_to(player.global_position)
	var t_r := 0.0
	while t_r < 2.5:
		await get_tree().physics_frame
		t_r += get_physics_process_delta_time()
		if not bos.area.grow(0.05).has_point(Vector2(bos.global_position.x, bos.global_position.z)):
			inside_area = false
	var d1 := bos.global_position.distance_to(player.global_position)
	_ok("герой подошёл вплотную (%.1f м) — главарь отступает (через 2,5 с — %.1f м)" % [d0, d1], d1 > d0 + 0.6)
	_ok("главарь не выходит из штаба", inside_area)
	# прицельный выстрел: красная полоса → застыла → выстрел; ушёл с полосы — мимо
	cam_dist = 17.0                                    # для снимка: в кадре и главарь, и полоса
	player.global_position = hb + Vector3.UP * 0.1
	await get_tree().create_timer(0.4).timeout
	bos._sp_cd = 0.0
	var tsp := 0.0
	var line_seen := false
	while bos.phase != "sp_lock" and tsp < 6.0:
		await get_tree().physics_frame
		tsp += get_physics_process_delta_time()
		line_seen = line_seen or bos.line_shown()
	if out != "":
		await _snap("lr_boss_line")
	var miss0 := special_miss
	var hit0 := special_hits
	var hp_s := hp
	# полоса застыла — уходим вбок на 2,5 м
	var dir_l: Vector3 = bos._sp_dir
	var side := Vector3(-dir_l.z, 0, dir_l.x)
	var dodge: Vector3 = snapf.call(player.global_position + side * 2.5)
	if dodge.distance_to(player.global_position) < 1.5:
		dodge = snapf.call(player.global_position - side * 2.5)
	player.global_position = dodge + Vector3.UP * 0.1
	var tsp2 := 0.0
	while bos.phase == "sp_lock" and tsp2 < 2.0:
		await get_tree().physics_frame
		tsp2 += get_physics_process_delta_time()
	await get_tree().create_timer(0.2).timeout
	_ok("прицельный выстрел: замер, на полу — красная полоса %.1f м (в помещении); ушёл с неё — мимо" % bos._sp_len, line_seen and special_miss == miss0 + 1 and special_hits == hit0 and absf(hp - hp_s) < 25.0)
	# второй раз — стоим на полосе (на открытом месте кабинета, откуда главаря видно)
	while bos.phase.begins_with("sp_") and tsp2 < 4.0:
		await get_tree().physics_frame
		tsp2 += get_physics_process_delta_time()
	var spots_v := [hb, snapf.call(Vector3(br.get_center().x - 3.5, 0, br.get_center().y)), snapf.call(Vector3(br.get_center().x - 3.5, 0, br.get_center().y + 2.0)),
		snapf.call(Vector3(br.get_center().x + 1.0, 0, br.get_center().y - 2.5)), snapf.call(Vector3(br.position.x + 2.0, 0, br.get_center().y))]
	for sv in spots_v:
		player.global_position = (sv as Vector3) + Vector3.UP * 0.1
		await get_tree().physics_frame
		var dv := bos.global_position.distance_to(player.global_position)
		if _sees(bos) and dv > 4.5 and dv < 18.0:
			break
	await get_tree().create_timer(0.5).timeout
	bos._sp_cd = 0.0
	var tsp3 := 0.0
	while bos.phase != "sp_lock" and tsp3 < 12.0:
		await get_tree().physics_frame
		tsp3 += get_physics_process_delta_time()
	var hp_s2 := hp
	var hit1 := special_hits
	while bos.phase == "sp_lock" and tsp3 < 14.0:
		await get_tree().physics_frame
		tsp3 += get_physics_process_delta_time()
	await get_tree().create_timer(0.2).timeout
	var got := hp_s2 - hp
	_ok("стоял на полосе — попадание в треть здоровья (%.1f)" % got, special_hits == hit1 + 1 and got >= HP_MAX * 0.333 - 0.5,
		"фаза %s, прицельных %d, попаданий %d, промахов %d, до героя %.1f, видит %s, ждали %.1f с" % [bos.phase, bos.specials, special_hits, special_miss, bos.global_position.distance_to(player.global_position), str(bos.get_meta("sees", false)), tsp3])
	_ok("перезарядка прицельного выстрела ~10 с", bos._sp_cd > 8.0 or bos.phase == "sp_rec")
	# ---- 4. ключ и сундук ----
	await _find_target_at(lr.chest_pos + Vector3(0, 0, 1.2) if lr.chest_yaw == 0.0 else lr.chest_pos - Vector3(0, 0, 1.2))
	_ok("у сундука без ключа: «Закрыто. Требуется ключ главаря муров»", _target != null and String(_target.type) == "chest" and _action_label() == "Закрыто" and _target_name().contains("Требуется ключ главаря муров"), "%s / %s" % [_action_label(), _target_name()])
	do_action()
	_ok("без ключа сундук не открывается", ULCase.lair().chest == "closed" and (case_ui == null or not is_instance_valid(case_ui)))
	bos.damage(100000.0, player.global_position)
	await get_tree().create_timer(0.5).timeout
	var key_it = null
	for i in bos.loot.size():
		if bos.loot[i] != null and String(bos.loot[i].id) == ULCase.KEY:
			key_it = bos.loot[i]
			bos.loot[i] = null
	_ok("главарь убит — в теле ключ (свой значок, его нужно взять)", not bos.alive() and key_it != null and ResourceLoader.exists(ULItems.ICONS + "mur_key.png"))
	inv.add(key_it)
	await _find_target_at(lr.chest_pos + Vector3(0, 0, 1.2) if lr.chest_yaw == 0.0 else lr.chest_pos - Vector3(0, 0, 1.2))
	_ok("с ключом: «Открыть оружейный сундук»", _target != null and String(_target.type) == "chest" and _action_label() == "Открыть оружейный сундук", _action_label())
	var n_items0 := _inv_ids()
	do_action()
	await get_tree().create_timer(0.4).timeout
	var pend = ULCase.pending()
	_ok("сундук открыт ключом: ключ израсходован, награда выбрана и записана до прокрутки", case_ui != null and is_instance_valid(case_ui) and ULCase.find_key(inv).is_empty() and ULCase.lair().chest == "open" and pend != null, str(pend))
	if out != "":
		await get_tree().create_timer(1.5).timeout
		await _snap("lr_case_spin")
	case_ui.skip()
	await get_tree().create_timer(1.2).timeout
	if out != "":
		await _snap("lr_case_result")
	var under: String = String(case_ui.ids[case_ui.win_at]) if case_ui.ids.size() > case_ui.win_at else ""
	_ok("лента остановилась на выпавшем оружии (%s, %s)" % [String(pend.id), String(pend.rn)], case_ui.done and under == String(pend.id))
	case_ui._take()
	await get_tree().create_timer(0.3).timeout
	var n_items1 := _inv_ids()
	_ok("«Забрать» — оружие в инвентаре, запись выдачи стёрта", int(n_items1.get(String(pend.id), 0)) == int(n_items0.get(String(pend.id), 0)) + 1 and ULCase.pending() == null)
	do_action()
	await get_tree().create_timer(0.3).timeout
	_ok("второй раз сундук пуст — новая прокрутка не начинается", case_ui == null or not is_instance_valid(case_ui))
	# ключ от прошлого посещения к новому логову не подходит
	var old_key := ULCase.make_key(lair_inst)
	ULCase.new_instance()
	inv.add(old_key)
	var rs := ULCase.open_chest(inv, RandomNumberGenerator.new())
	_ok("новое посещение: главарь и сундук заново, старый ключ не подходит («%s»)" % String(rs.err), not rs.ok and String(rs.err) == "stale" and ULCase.lair().chest == "closed")
	if out != "":
		await _snap("lr_end")
	print("[inv] итог: ошибок %d" % _fails)
	get_tree().quit()


## для проверок: герой встаёт в точку и выбирает цель под рукой
func _find_target_at(p: Vector3) -> void:
	player.global_position = p + Vector3.UP * 0.1
	await get_tree().physics_frame
	_find_target()


func _inv_ids() -> Dictionary:
	var out_d := {}
	for arr in [inv.pockets, inv.pack.items if inv.pack != null else []]:
		for it in arr:
			if it != null:
				out_d[String(it.id)] = int(out_d.get(String(it.id), 0)) + 1
	for it in [inv.primary, inv.pistol]:
		if it != null:
			out_d[String(it.id)] = int(out_d.get(String(it.id), 0)) + 1
	return out_d


# ---------------- враги ----------------

## где появляются заражённые (за забором, в поле); убитый появляется снова через RESPAWN_S секунд
const ENEMY_SPAWNS := [[Vector3(-13, 0, 17), "infected"], [Vector3(14, 0, 23), "infected"], [Vector3(-3, 0, 33), "infected"], [Vector3(-30, 0, 36), "lottery"]]
const RESPAWN_S := 25.0
var enemies: Array[ULEnemy] = []
var _open_corpse: ULEnemy = null
var _respawn: Array = []          ## [точка, сколько осталось ждать]
var _hurt_t := 0.0
var _hurt_amp := 1.0
var _knock := Vector3.ZERO
var _dead_t := 0.0
var _book_ui: Control
var _enemy_n := 0


func _enemies_setup() -> void:
	for sp in ENEMY_SPAWNS:
		spawn_enemy(String(sp[1]), sp[0])


func spawn_enemy(kind: String, at: Vector3) -> ULEnemy:
	_enemy_n += 1
	var e: ULEnemy = ULMur.new() if ULEnemy.KINDS[kind].has("gun") else ULEnemy.new()
	add_child(e)
	e.setup(kind, at, 7000 + _enemy_n * 37)
	if e is ULMur:
		(e as ULMur).shoot.connect(_mur_shoot.bind(e))
		(e as ULMur).special_hit.connect(_mur_special.bind(e))
	e.hit_player.connect(hurt)
	e.noise.connect(_enemy_noise.bind(e))
	e.sky = _open_sky
	e.exclude = [player.get_rid()]
	enemies.append(e)
	targets.append(e)
	return e


## пятна-тени: неподвижные — от локации (мебель, техника, ящики), движущиеся — герой и враги рядом
func _blobs_build() -> void:
	if blobs == null:
		blobs = ULBlobs.new()
		blobs.name = "Blobs"
		add_child(blobs)
	if san != null:
		for b in san.blob_pts:
			blobs.add_static(b[0], b[1], float(b[2]), float(b[3]))
	blobs.build()


func _blobs_tick() -> void:
	if blobs == null:
		if player == null:
			return
		_blobs_build()                      # дом и полигон: только движущиеся пятна
	var items: Array = [[player.global_position, 0.42, 0.6]]
	var hp := player.global_position
	for e in enemies:
		if not is_instance_valid(e) or not e.alive() or not e.visible:
			continue
		var ep: Vector3 = e.global_position
		if absf(ep.x - hp.x) > 28.0 or absf(ep.z - hp.z) > 28.0:
			continue
		items.append([ep, 0.75 if e.kind == "ruber" else 0.42, 0.55])
	blobs.set_dynamic(items)


## под открытым небом ли обе точки (враг и герой): камни Рубер бросает только так — не в помещение и не из него
func _open_sky(a: Vector3, b: Vector3) -> bool:
	if san != null:
		return san.locate(a + Vector3.UP * 0.3).x < 0 and san.locate(b + Vector3.UP * 0.3).x < 0
	if house != null and (house.contains(a) or house.contains(b)):
		return false
	return true


## голос врага: рычание, крик, предсмертный хрип — слышно, только если герой недалеко
func _enemy_noise(what: String, at: Vector3, e: ULEnemy = null) -> void:
	# бросок камня — свои звуки (tools/make_rock_sounds.py): вырывает из земли (гул, хруст, осыпь), бросок
	# (тяжёлый свист), удар (глухой удар, разлёт осколков); громкость — [дБ]
	const ROCK_SND := {"rock_rip": 1.0, "rock_throw": 0.0, "rock_hit": 3.0}
	if ROCK_SND.has(what):
		if at.distance_to(player.global_position) < 45.0:
			snd.play(what, at + Vector3.UP * 0.5, float(ROCK_SND[what]), 0.05)
		return
	if at.distance_to(player.global_position) > 30.0:
		return
	# у крупного мутанта голос ниже и громче (voice в data/enemies.json: [высота тона, прибавка громкости])
	var voice: Array = e.def.get("voice", [1.0, 0.0]) if e != null else [1.0, 0.0]
	snd.play(what, at + Vector3.UP * 1.5, float({"growl": -7.0, "roar": -2.0, "zdeath": -3.0}.get(what, -5.0)) + float(voice[1]), 0.08, 0.0, float(voice[0]))


var flinch: BCFlinch
var _blood_mat: StandardMaterial3D
var _splat_mat: ShaderMaterial
var _splats: Array[Node3D] = []

const SPLAT_SHADER := """shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back, unshaded;
// пятно крови на земле: тёмно-красное, край рваный (шум), с каплями вокруг; тает к концу (fade)
uniform sampler2D noise : filter_linear, repeat_enable;
uniform float fade = 1.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 c = UV - 0.5;
	float n = texture(noise, wp.xz * 0.9).r;
	float n2 = texture(noise, wp.xz * 3.1 + 0.4).r;
	float r = length(c) * 2.0 + (n - 0.5) * 0.9;
	float a = 1.0 - smoothstep(0.35, 0.6, r);
	a = max(a, step(0.78, n2) * (1.0 - smoothstep(0.6, 1.0, r)));
	if (a < 0.02) { discard; }
	ALBEDO = mix(vec3(0.16, 0.015, 0.01), vec3(0.3, 0.03, 0.02), n2);
	ALPHA = a * 0.85 * fade;
}"""


## Кровь от удара: брызги капель по направлению dir (летят и падают) и пятно на земле, которое через 20 с тает.
## Пятен на локации — не больше 24 (старые убираются).
func _blood(at: Vector3, dir: Vector3, n: int) -> void:
	if _blood_mat == null:
		_blood_mat = StandardMaterial3D.new()
		_blood_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		_blood_mat.albedo_color = Color(0.32, 0.02, 0.02)
		_blood_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	var p := CPUParticles3D.new()
	var qm := QuadMesh.new()
	qm.size = Vector2(0.05, 0.05)
	qm.material = _blood_mat
	p.mesh = qm
	p.amount = n
	p.one_shot = true
	p.explosiveness = 0.92
	p.lifetime = 0.55
	p.direction = (dir + Vector3.UP * 0.35).normalized()
	p.spread = 32.0
	p.initial_velocity_min = 1.6
	p.initial_velocity_max = 3.6
	p.gravity = Vector3(0, -9.8, 0)
	p.scale_amount_min = 0.6
	p.scale_amount_max = 1.6
	p.local_coords = false
	add_child(p)
	p.global_position = at
	p.emitting = true
	get_tree().create_timer(1.2).timeout.connect(p.queue_free)
	# пятно на земле — чуть дальше по удару
	if _splat_mat == null:
		_splat_mat = ShaderMaterial.new()
		var sh := Shader.new()
		sh.code = SPLAT_SHADER
		_splat_mat.shader = sh
		_splat_mat.set_shader_parameter("noise", _noise_tex)
	var sp := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	sp.mesh = pm
	var mat: ShaderMaterial = _splat_mat.duplicate()
	sp.material_override = mat
	sp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(sp)
	var k := randf_range(0.45, 0.8) * clampf(n / 14.0, 0.7, 1.4)
	sp.global_transform = Transform3D(Basis(Vector3.UP, randf() * TAU).scaled(Vector3(k, 1.0, k * randf_range(0.7, 1.0))), Vector3(at.x, 0.05, at.z) + dir * randf_range(0.25, 0.6))
	_splats.append(sp)
	if _splats.size() > 24:
		var old: Node3D = _splats.pop_front()
		if is_instance_valid(old):
			old.queue_free()
	var tw := sp.create_tween()
	tw.tween_interval(20.0)
	tw.tween_method(func(v: float) -> void: mat.set_shader_parameter("fade", v), 1.0, 0.0, 3.0)
	tw.tween_callback(func() -> void:
		_splats.erase(sp)
		sp.queue_free())


## герой получил удар (from — откуда: ударивший; тогда герой отшатывается от него и брызжет кровь с этой стороны)
func hurt(dmg: float, from := Vector3.INF) -> void:
	if _dead_t > 0.0:
		return
	if not lvl:
		hp = maxf(0.0, hp - dmg)                # в тесте уровня герой бессмертен (удар виден, здоровье не тратится)
	_hurt_t = 0.35
	_hurt_amp = clampf(dmg / 20.0, 0.4, 1.5)
	snd.play("punch", player.global_position + Vector3.UP * 1.3, -2.0, 0.08)
	if from != Vector3.INF:
		var push := player.global_position - from
		push.y = 0.0
		if push.length() > 0.01:
			push = push.normalized()
			if flinch:
				flinch.hit(push, dmg / 14.0)
			# удар отталкивает: на 15–35 см назад от врага
			_knock = push * clampf(dmg / 9.0, 1.6, 2.8)
			_blood(player.global_position + Vector3.UP * 1.3 - push * 0.18, push, int(clampf(dmg, 8.0, 24.0)))
	if hp <= 0.0:
		# погиб: через три секунды — снова у дома, с половиной здоровья; враги расходятся
		_dead_t = 3.0
		close_inventory()
		_hud_touch.clear()
		_joy_id = -1
		_joy_v = Vector2.ZERO


func _enemies_tick(delta: float) -> void:
	_hurt_t = maxf(0.0, _hurt_t - delta)
	if _dead_t > 0.0:
		_dead_t -= delta
		if _dead_t <= 0.0:
			_dead_t = 0.0
			player.velocity = Vector3.ZERO
			_cam_ready = false
			if arena:
				# на полигоне — заново посреди площадки, враги убраны
				hp = HP_MAX
				player.global_position = Vector3(0, 0.1, 2.5)
				clear_enemies()
				say("Заново. Враги убраны")
			elif temp():
				cs_finish("reset" if _cs_over else "dead")
			else:
				hp = 50.0
				player.global_position = Vector3(0, 0.1, 3)
				for e in enemies:
					if e.alive():
						e.state = "idle"
				say("Вы очнулись у дома")
				_save()
	var p := player.global_position
	var hero_ok := _dead_t <= 0.0
	var hero_v := Vector3(player.velocity.x, 0, player.velocity.z).length() if hero_ok else 0.0
	var fr := Engine.get_process_frames()
	for i in range(enemies.size() - 1, -1, -1):
		var e := enemies[i]
		if not e.alive():
			e.tick(delta, p, false, hero_ok)
			if e.dead_t >= ULEnemy.CORPSE_S:
				# тело лежит минуту и исчезает — обыскали его или нет
				if _open_corpse == e and inv_ui.visible:
					close_inventory()
				if _glow_node == e:
					_glow_node = null
				if _target != null and _target.type == "corpse" and _target.e == e:
					_target = null
				if test == "" and not arena and not temp():
					_respawn.append([e.home, RESPAWN_S, e.kind])
				_dmg_lb.erase(e)
				targets.erase(e)
				enemies.remove_at(i)
				e.queue_free()
			continue
		var d := e.global_position.distance_to(p)
		if san != null and (fr + i) % 6 == 0:
			# в корпусах: видны только враги этажа, где герой; гонящийся враг открывает двери на пути
			e.visible = san.visible_at(e.global_position + Vector3.UP * 0.3)
			if e.state == "chase" or e.state == "attack":
				san.open_near(e.global_position, 0.95)
		# кто бросает камни издали (Рубер) — движется полностью и вдалеке: бросок должен быть виден
		e.set_active(d < (18.0 if temp() and not e.def.has("rock") and not e.def.has("gun") else 36.0))
		if temp():
			e.rig.set_detail(d < 12.0)              # на экране (ближе 12 м) — полные движения и постановка стоп
		if not e.active:
			# Временный кластер (38 врагов): ближе 8 м — всё, 8–18 м — без стоп и мелочей, дальше — без движений тела; кто ближе 80 м или гонится за героем —
			# думает и ходит раз в четыре кадра (за четыре кадра сразу), видит — раз в двенадцать. Дальше 80 м
			# спокойные стоят.
			if temp() and (d < 80.0 or e.state == "chase" or e.state == "alert") and (fr + i) % 4 == 0:
				if (fr + i) % 12 == 0 or not e.has_meta("sees"):
					var vr2 := float(e.def.see) if e.state == "idle" or e.state == "wander" else float(e.def.lose)
					e.set_meta("sees", d < vr2 and _sees(e))
					e.hear_steps(p, hero_v)
				e.step_k = 4.0
				var _u0 := Time.get_ticks_usec()
				e.tick(delta * 4.0, p, bool(e.get_meta("sees")), hero_ok)
				prof_mid += Time.get_ticks_usec() - _u0
				prof_mid_n += 1
				e.step_k = 1.0
			continue
		# видит ли героя — проверяется не каждый кадр (луч через стены и забор)
		# (спокойный видит на свою дальность зрения; тот, кто уже гонится, — пока герой не уйдёт дальше «потери»)
		if (fr + i) % 6 == 0 or not e.has_meta("sees"):
			var vr := float(e.def.see) if e.state == "idle" or e.state == "wander" else float(e.def.lose)
			e.set_meta("sees", d < vr and _sees(e))
			e.hear_steps(p, hero_v)
		var _u1 := Time.get_ticks_usec()
		e.tick(delta, p, bool(e.get_meta("sees")), hero_ok)
		prof_full += Time.get_ticks_usec() - _u1
		prof_full_n += 1
	for i in range(_respawn.size() - 1, -1, -1):
		_respawn[i][1] = float(_respawn[i][1]) - delta
		if float(_respawn[i][1]) <= 0.0 and (_respawn[i][0] as Vector3).distance_to(p) > 16.0:
			spawn_enemy(String(_respawn[i][2]), _respawn[i][0])
			_respawn.remove_at(i)


## Справочник: кто водится на локации — как ходит, как нападает, что в нём бывает
func open_book() -> void:
	_menu_bar.visible = false
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.6)
	_hud.get_parent().add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_book_ui = shade
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	shade.add_child(pn)
	pn.anchor_left = 0.5
	pn.anchor_right = 0.5
	pn.anchor_top = 0.5
	pn.anchor_bottom = 0.5
	pn.offset_left = -430
	pn.offset_right = 430
	pn.offset_top = -270
	pn.offset_bottom = 270
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 10)
	pn.add_child(vb)
	var tl := Label.new()
	tl.text = "Справочник"
	tl.add_theme_font_size_override("font_size", 24)
	tl.add_theme_color_override("font_color", C_TEXT)
	vb.add_child(tl)
	var sc := ScrollContainer.new()
	sc.size_flags_vertical = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	vb.add_child(sc)
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 14)
	sc.add_child(list)
	for k in ULEnemy.KINDS:
		var d: Dictionary = ULEnemy.KINDS[k]
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 14)
		list.add_child(row)
		var pic := TextureRect.new()
		pic.texture = _tex("res://assets/icons/%s.png" % String(d.pic))
		pic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		pic.custom_minimum_size = Vector2(210, 300)
		row.add_child(pic)
		var col := VBoxContainer.new()
		col.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		col.add_theme_constant_override("separation", 6)
		row.add_child(col)
		var nm := Label.new()
		nm.text = String(d.n)
		nm.add_theme_font_size_override("font_size", 22)
		nm.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
		col.add_child(nm)
		for line in ULEnemy.describe(k):
			var l := Label.new()
			l.text = String(line)
			l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
			l.add_theme_font_size_override("font_size", 16)
			l.add_theme_color_override("font_color", C_TEXT)
			col.add_child(l)
	var hb := HBoxContainer.new()
	hb.alignment = BoxContainer.ALIGNMENT_END
	vb.add_child(hb)
	hb.add_child(ULSettings.button("Закрыть", func() -> void: shade.queue_free(), 140.0))
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


# ---------------- плавность: разрешение, прогрев, выход с локации ----------------

const LEAVE_S := 5.0              ## сколько секунд за краем локации до перехода на карту мира
var _leave_t := 0.0
var left_location := false
var _set_ui: Control
var _res_t := 0.0
var _res_n := 0
var _res_hold := 0.0
var _res_wait := 0.0


func open_settings() -> void:
	_menu_bar.visible = false
	_set_ui = ULSettings.panel(_hud.get_parent(), func() -> void:
		ULSettings.apply(get_viewport())
		# новое качество: тени — по нему (как при входе на локацию), подстройка под частоту начинает заново
		_shadow_pref = temp() and ULSettings.gfx >= 1
		if sun:
			sun.shadow_enabled = _shadow_pref
		_res_fails = 0
		_res_hold = 0.0
		_cam_apply(), [
		["Главное меню", func() -> void:
			if lvl:
				_lvl_exit()
				return
			if temp():
				cs_finish("menu")
				return
			_save()
			get_tree().change_scene_to_file("res://menu.tscn")],
		["Выйти из игры", func() -> void:
			_save()
			get_tree().quit()],
	])
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


## Подстройка под телефон, чтобы частота кадров держалась не ниже ~40: раз в секунду смотрится средняя частота.
## Разрешение снижается последним — сначала то, что дороже всего по времени и меньше всего заметно:
## 1) сглаживание краёв (MSAA), 2) тени солнца, 3) и только потом разрешение трёхмерной картинки — и не ниже
## 62 % (ниже картинка «мыльная»). Меньше 30 кадров/с — шаг сразу, 30–40 — тоже шаг, но разрешение — мелкими
## долями. Больше 52 — всё возвращается в обратном порядке (сначала разрешение до выбранного качества, затем тени,
## затем сглаживание), не раньше чем через 6 с после снижения; если вернули и снова стало тяжело — следующая
## попытка вернуть ждёт вдвое дольше (до минуты), чтобы картинка не «мигала» тенями туда-сюда.
func _auto_res(delta: float) -> void:
	if test != "":
		return
	_res_t += delta
	_res_n += 1
	_res_hold = maxf(0.0, _res_hold - delta)
	if _res_t < 1.0:
		return
	var fps := _res_n / _res_t
	_res_t = 0.0
	_res_n = 0
	var vp := get_viewport()
	if _res_wait > 0.0:
		_res_wait -= 1.0
		return                                         # после перемены — секунда передышки: смена разрешения сама даёт заминку
	var st := adapt_state()
	var nx := adapt_step(st, fps, _res_hold <= 0.0)
	if nx == st:
		return
	var down: bool = float(nx.scale) < float(st.scale) or (not bool(nx.msaa) and bool(st.msaa)) or (not bool(nx.shadows) and bool(st.shadows))
	if down:
		_res_hold = minf(60.0, 6.0 * pow(2.0, float(_res_fails)))
		if _res_raised_t >= 0.0 and Time.get_ticks_msec() * 0.001 - _res_raised_t < 20.0:
			_res_fails += 1                            # только что вернули — и снова тяжело: дольше не возвращать
	else:
		_res_raised_t = Time.get_ticks_msec() * 0.001
	_res_wait = 1.0
	vp.scaling_3d_scale = float(nx.scale)
	var ms := int(ULSettings.q().msaa)
	vp.msaa_3d = (Viewport.MSAA_4X if ms >= 4 else Viewport.MSAA_2X) if bool(nx.msaa) else Viewport.MSAA_DISABLED
	if sun:
		sun.shadow_enabled = bool(nx.shadows)


var _res_fails := 0
var _res_raised_t := -1.0
var _shadow_pref := false             ## были ли у солнца тени по выбранному качеству (подстройка их только снимает и возвращает)


## текущее состояние подстройки: разрешение, сглаживание, тени; can_* — что разрешает выбранное качество
func adapt_state() -> Dictionary:
	var vp := get_viewport()
	return {"scale": snappedf(vp.scaling_3d_scale, 0.001), "msaa": vp.msaa_3d != Viewport.MSAA_DISABLED,
		"shadows": sun != null and sun.shadow_enabled, "cap": float(ULSettings.q().scale),
		"can_msaa": int(ULSettings.q().msaa) > 0, "can_shadows": _shadow_pref}


## следующий шаг подстройки (отдельно — чтобы проверять): вниз — MSAA, тени, разрешение; вверх — наоборот
func adapt_step(st: Dictionary, fps: float, may_raise: bool) -> Dictionary:
	var nx := st.duplicate()
	if fps < 40.0:
		if bool(st.msaa):
			nx.msaa = false
		elif bool(st.shadows):
			nx.shadows = false
		else:
			nx.scale = res_step(float(st.scale), fps, float(st.cap), may_raise)
		return nx
	if fps > 52.0 and may_raise:
		if float(st.scale) < float(st.cap) - 0.001:
			nx.scale = res_step(float(st.scale), fps, float(st.cap), may_raise)
		elif bool(st.can_shadows) and not bool(st.shadows):
			nx.shadows = true
		elif bool(st.can_msaa) and not bool(st.msaa):
			nx.msaa = true
	return nx


## новое разрешение по текущему, частоте кадров и пределу качества
func res_step(sc: float, fps: float, cap: float, may_raise: bool) -> float:
	if fps < ULSettings.FPS_MIN:
		return maxf(ULSettings.SCALE_MIN, sc - 0.06)
	if fps < 40.0:
		return maxf(ULSettings.SCALE_MIN, sc - 0.03)
	if fps > 50.0 and sc < cap and may_raise:
		return minf(cap, sc + 0.04)
	return minf(sc, cap)


## Прогрев при входе на локацию: всё, что позже появится впервые (пули, цифры урона, метка цели), один раз
## рисуется сразу — иначе первый выстрел и первое попадание дают заминку (телефон готовит закраску на лету).
func _prewarm() -> void:
	var at := player.global_position + Vector3(0, 0.6, -1.5)
	var tmp: Array[Node] = []
	for id in BULLETS:
		var n := MeshInstance3D.new()
		n.mesh = _bullet_shape(id)
		n.scale = Vector3.ONE * 0.02
		add_child(n)
		n.global_position = at
		tmp.append(n)
	var lb := Label3D.new()
	lb.text = "−0123456789"
	lb.font_size = 56
	lb.pixel_size = 0.0002
	lb.outline_size = 10
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.no_depth_test = true
	add_child(lb)
	lb.global_position = at
	tmp.append(lb)
	_mark.visible = true
	_mark.global_position = at
	_flash.global_position = at
	_flash.visible = true
	for i in 3:
		await get_tree().process_frame
	_flash.visible = false
	for n in tmp:
		n.queue_free()


# ---------------- имя героя ----------------

const PROFILE := "user://profile.json"   ## имя хранится отдельно от сохранения локации — сброс добычи его не трогает
var hero_name := "Сталкер"
var _name_ui: Control
var _name_edit: LineEdit


func _modal() -> bool:
	return (inv_ui != null and inv_ui.visible) or (_name_ui != null and _name_ui.visible) or (_talk_ui != null and _talk_ui.visible) or (_set_ui != null and is_instance_valid(_set_ui)) or (_book_ui != null and is_instance_valid(_book_ui)) or (_shop_ui != null and is_instance_valid(_shop_ui)) or (_term_ui != null and is_instance_valid(_term_ui)) or _dead_t > 0.0


func _load_profile() -> void:
	if test == "" and FileAccess.file_exists(PROFILE):
		var d = JSON.parse_string(FileAccess.get_file_as_string(PROFILE))
		if d is Dictionary:
			set_hero_name(String(d.get("name", "")), false)


## сменить имя: до 16 знаков, пустое не принимается
func set_hero_name(n: String, save := true) -> bool:
	n = n.strip_edges().replace("\n", " ")
	if n == "":
		return false
	hero_name = n.substr(0, 16)
	if save and test == "":
		var f := FileAccess.open(PROFILE, FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify({"name": hero_name}))
	return true


## центр кнопки «три точки» справа от имени
func _name_dots() -> Vector2:
	return Vector2(18.0 + ThemeDB.fallback_font.get_string_size(hero_name, HORIZONTAL_ALIGNMENT_LEFT, -1, 20).x + 26.0, 23.0)


func open_name_panel() -> void:
	if _name_ui == null:
		var shade := ColorRect.new()
		shade.color = Color(0, 0, 0, 0.55)
		_hud.get_parent().add_child(shade)
		shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		_name_ui = shade
		var pn := PanelContainer.new()
		pn.add_theme_stylebox_override("panel", _style(Color(0.06, 0.09, 0.13, 0.98)))
		shade.add_child(pn)
		# сверху — чтобы экранная клавиатура не закрывала
		pn.anchor_left = 0.5
		pn.anchor_right = 0.5
		pn.offset_left = -240
		pn.offset_right = 240
		pn.offset_top = 56
		var vb := VBoxContainer.new()
		vb.add_theme_constant_override("separation", 10)
		pn.add_child(vb)
		var tl := Label.new()
		tl.text = "Имя героя"
		tl.add_theme_font_size_override("font_size", 20)
		tl.add_theme_color_override("font_color", C_TEXT)
		vb.add_child(tl)
		_name_edit = LineEdit.new()
		_name_edit.max_length = 16
		_name_edit.custom_minimum_size = Vector2(0, 54)
		_name_edit.add_theme_font_size_override("font_size", 24)
		_name_edit.placeholder_text = "до 16 знаков"
		_name_edit.text_submitted.connect(func(_t): _name_ok())
		vb.add_child(_name_edit)
		var hb := HBoxContainer.new()
		hb.alignment = BoxContainer.ALIGNMENT_END
		hb.add_theme_constant_override("separation", 8)
		vb.add_child(hb)
		hb.add_child(_btn("Отмена", func(): _name_ui.visible = false, 120))
		hb.add_child(_btn("Сохранить", _name_ok, 140))
		var gap := Control.new()
		gap.custom_minimum_size = Vector2(0, 4)
		vb.add_child(gap)
	_name_edit.text = hero_name
	_name_ui.visible = true
	_name_edit.grab_focus()
	_name_edit.select_all()
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


func _name_ok() -> void:
	if set_hero_name(_name_edit.text):
		_name_ui.visible = false
		say("Имя: " + hero_name)
	else:
		say("Имя не может быть пустым")


# ---------------- жители (NPC) ----------------

var npcs: Array = []
var _talk_ui: Control
var _talk_name: Label
var _talk_text: Label


## Житель: стоит на месте, поворачивается к герою, когда тот рядом. Кнопка-рукопожатие появляется только возле него.
## житель: model — своя модель Tripo со скелетом (движения — героя, переносятся на её скелет); без неё — модель
## героя в другой одежде (тёплый бурый тон)
func _add_npc(p: Vector3, yaw: float, nm: String, role: String, line: String, model := "") -> void:
	var body := StaticBody3D.new()
	body.name = "NPC"
	add_child(body)
	body.position = p
	body.rotation.y = yaw
	body.set_meta("name", nm)
	body.set_meta("role", role)
	body.set_meta("line", line)
	body.set_meta("yaw", yaw)
	var r := BCCharacter.new()
	r.name = "Rig"
	body.add_child(r)
	var own := model != "" and ResourceLoader.exists(model)
	r.setup(model if own else "res://assets/models/hero.glb", "res://assets/anim/hero")
	# та же фигура, другая одежда: тёплый бурый тон поверх раскраски модели (у своей модели — свои цвета)
	for mi in ([] if own else r.model.find_children("*", "MeshInstance3D", true, false)):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si) as StandardMaterial3D
			if src != null:
				var mt := src.duplicate() as StandardMaterial3D
				mt.albedo_color = Color(1.0, 0.72, 0.5)
				m.set_surface_override_material(si, mt)
	var lb := Label3D.new()
	lb.text = "%s\n%s" % [nm, role]
	lb.font_size = 36
	lb.pixel_size = 0.006
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.no_depth_test = true
	lb.modulate = Color(1.0, 0.86, 0.5)
	lb.outline_size = 10
	lb.position = Vector3(0, 2.25, 0)
	lb.name = "Label"
	body.add_child(lb)
	var blob := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(1.3, 1.3)
	blob.mesh = pm
	blob.material_override = _blob_mat()
	blob.position.y = 0.03
	body.add_child(blob)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	body.add_child(cs)
	npcs.append(body)


const DEALER_AT := Vector3(-2.3, 0, 5.85)   ## барахольщик — у крыльца, слева от входа, у стены (справа — манекен; система дома)


func _npcs_setup() -> void:
	# барахольщик — всегда, прямо перед входом в дом: покупает хлам
	if npc_by_role("барахольщик") == null:
		_add_npc(house.to_global(DEALER_AT), 0.0, "Кузьмич", "барахольщик", "Здорово, %s. Хлам тащи — болты, провода, железки. За каждую кучку — спорана, без обмана.", "res://assets/models/dealer.glb")
		_dealer_stall()
	# оружейник — в доме, за прилавком оружейной; появляется, когда нанят через компьютер базы (раздел «Персонал»)
	if ULBase.has_staff("gunsmith") and npc_by_role("оружейник") == null:
		_add_npc(house.to_global(ARMORY_NPC), -PI * 0.5, "Седой", "оружейник", "Здорово, %s. Оружие, патроны, припасы — всё за спораны. Выбирай, что по карману.")


func npc_by_role(role: String) -> Node3D:
	for n in npcs:
		if is_instance_valid(n) and String((n as Node3D).get_meta("role")) == role:
			return n
	return null


## у барахольщика — прилавок: ящик, на нём и рядом кучки хлама
func _dealer_stall() -> void:
	var root := Node3D.new()
	root.name = "DealerStall"
	house.add_child(root)
	var path := MODELS + "ph_crate.glb"
	if ResourceLoader.exists(path):
		var c: Node3D = (load(path) as PackedScene).instantiate()
		var bb := _aabb(c)
		c.scale = Vector3.ONE * (0.9 / maxf(bb.size.x, bb.size.z))
		c.position = DEALER_AT + Vector3(-0.95, 0, 0.1)
		c.rotation.y = 0.2
		root.add_child(c)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(0.85, 0.7, 0.85)
		cs.shape = bs
		cs.position = DEALER_AT + Vector3(-0.95, 0.35, 0.1)
		var sb := StaticBody3D.new()
		root.add_child(sb)
		sb.add_child(cs)
	var jp := MODELS + "ul_junk.glb"
	if ResourceLoader.exists(jp):
		for at in [Vector3(-0.95, 0.68, 0.1), Vector3(-1.2, 0, 0.75), Vector3(0.7, 0, 0.5)]:
			var j: Node3D = (load(jp) as PackedScene).instantiate()
			var bb2 := _aabb(j)
			j.scale = Vector3.ONE * (0.5 / maxf(bb2.size.x, bb2.size.z))
			j.position = DEALER_AT + at
			j.rotation.y = at.x * 2.0
			root.add_child(j)


## Продать весь хлам барахольщику: по junk_price (data/base_shop.json) за кучку; false — продавать нечего
func sell_junk() -> bool:
	var n := inv.count("junk")
	if n <= 0:
		say("Хлама нет — его находят в постройках на вылазках")
		return false
	var price: Dictionary = ULBase.shop().get("junk_price", {"spore": 1})
	inv.consume("junk", n)
	var got := ""
	for id in price:
		var k := int(price[id]) * n
		inv.wallet[String(id)] = int(inv.wallet.get(String(id), 0)) + k
		got += ("" if got == "" else ", ") + "%d %s" % [k, String(ULItems.get_def(String(id)).n).to_lower()]
	say("Продано хлама: %d → %s" % [n, got])
	snd.play("click", player.global_position + Vector3.UP, -4.0)
	if _talk_ui and _talk_ui.visible:
		_talk_sell.text = "Продать хлам (0)"
	_save()
	return true


func _npcs_tick(delta: float) -> void:
	for n in npcs:
		var b := n as Node3D
		var v := player.global_position - b.global_position
		# далеко за кадром житель не двигается и не считается
		var near := v.length() < 24.0
		var r := b.get_node("Rig") as BCCharacter
		# имя жителя в доме видно только из дома (иначе надпись висит поверх крыши)
		(b.get_node("Label") as Label3D).visible = not _in_house(b.global_position) or house.inside
		if near != bool(b.get_meta("awake", true)):
			b.set_meta("awake", near)
			r.set_active(near)
		if not near:
			continue
		r.set_motion(0.0, 0.0, delta)
		var want: float = atan2(v.x, v.z) if v.length() < 4.5 else float(b.get_meta("yaw"))
		b.rotation.y = lerp_angle(b.rotation.y, want, 1.0 - exp(-delta * 5.0))


## разговор с жителем: его имя и слова; торговля появится здесь же
func open_talk(n: Node3D) -> void:
	if _talk_ui == null:
		_talk_ui = Control.new()
		_hud.get_parent().add_child(_talk_ui)
		_talk_ui.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
		var pn := PanelContainer.new()
		pn.add_theme_stylebox_override("panel", _style(Color(0.06, 0.09, 0.13, 0.96)))
		_talk_ui.add_child(pn)
		pn.anchor_left = 0.5
		pn.anchor_right = 0.5
		pn.anchor_top = 1.0
		pn.anchor_bottom = 1.0
		pn.offset_left = -340
		pn.offset_right = 340
		pn.offset_top = -210
		pn.offset_bottom = -28
		var vb := VBoxContainer.new()
		vb.add_theme_constant_override("separation", 8)
		pn.add_child(vb)
		_talk_name = Label.new()
		_talk_name.add_theme_font_size_override("font_size", 20)
		_talk_name.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
		vb.add_child(_talk_name)
		_talk_text = Label.new()
		_talk_text.add_theme_font_size_override("font_size", 18)
		_talk_text.add_theme_color_override("font_color", C_TEXT)
		_talk_text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		_talk_text.size_flags_vertical = Control.SIZE_EXPAND_FILL
		vb.add_child(_talk_text)
		var hb := HBoxContainer.new()
		hb.alignment = BoxContainer.ALIGNMENT_END
		vb.add_child(hb)
		hb.add_theme_constant_override("separation", 8)
		_talk_trade = _btn("Торговать", open_shop, 150)
		hb.add_child(_talk_trade)
		_talk_sell = _btn("Продать хлам", func(): sell_junk(), 230)
		hb.add_child(_talk_sell)
		hb.add_child(_btn("Закрыть", func(): _talk_ui.visible = false, 130))
		var gap := Control.new()
		gap.custom_minimum_size = Vector2(0, 2)
		vb.add_child(gap)
	_talk_name.text = "%s, %s" % [n.get_meta("name"), n.get_meta("role")]
	var line := String(n.get_meta("line"))
	_talk_text.text = line % hero_name if line.contains("%s") else line
	_talk_trade.visible = String(n.get_meta("role")) in ["торговец", "оружейник"]
	_talk_sell.visible = String(n.get_meta("role")) == "барахольщик"
	_talk_sell.text = "Продать хлам (%d)" % inv.count("junk")
	_talk_ui.visible = true
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


# ---------------- оружейная ----------------

## Оружейная — в бывшей кладовой (при входе справа). Пока оружейник не куплен через компьютер базы, комната пустая
## и называется «Кладовая»; после покупки в ней появляется всё сразу: прилавок, за ним оружейник; на стене и на
## столе — оружие, у стены — шкафы с коробками патронов, в углу — сейфы. Мебель — простые объёмы с текстурой досок и крашеным
## металлом; оружие на витрине — одна запечённая сетка без текстур (tools/bake_armory.gd). Координаты — в системе
## дома; видно всё это только из дома (как и стены комнат).
const ARMORY_NPC := Vector3(4.45, 0, 3.25)


func _box_prop(parent: Node3D, size: Vector3, at: Vector3, mat: Material, body: StaticBody3D = null) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	parent.add_child(mi)
	if body != null:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.position = at
		body.add_child(cs)
	return mi


## коробка патронов или припас из набора — как товар на полке (наибольший размер sz, м)
func _shelf_item(parent: Node3D, id: String, at: Vector3, yaw: float, sz: float) -> void:
	var mesh := ULItems.kit_mesh(id, "a")
	if mesh == null:
		return
	var km := MeshInstance3D.new()
	km.mesh = mesh
	var kb := mesh.get_aabb()
	var ks := sz / maxf(kb.size.x, maxf(kb.size.y, kb.size.z))
	km.scale = Vector3.ONE * ks
	km.rotation.y = yaw
	km.position = at - Vector3(0, kb.position.y * ks, 0)
	parent.add_child(km)


func _paint(c: Color, metal := 0.0, rough := 0.7) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.metallic = metal
	m.roughness = rough
	return m


var _armory_root: Node3D


## Мебель оружейной из модели Tripo: name — файл в assets/world, at — точка на полу (система дома), yaw — поворот,
## size — длина (by "len": наибольший размер по полу) или высота (by "h"), м; col — коробка столкновения (0 — нет).
## Возвращает false, если модели нет.
func _armory_model(root: Node3D, name: String, at: Vector3, yaw: float, size: float, by: String, col: Vector3, body: StaticBody3D) -> bool:
	var path := MODELS + name + ".glb"
	if not ResourceLoader.exists(path):
		return false
	var m: Node3D = (load(path) as PackedScene).instantiate()
	var bb: AABB = _aabb(m)
	var k := size / maxf(bb.size.y if by == "h" else maxf(bb.size.x, bb.size.z), 0.01)
	m.scale = Vector3.ONE * k
	m.rotation.y = yaw
	var b2: AABB = _aabb(m)
	m.position = at + Vector3(-b2.get_center().x, -b2.position.y, -b2.get_center().z)
	root.add_child(m)
	if body != null and col != Vector3.ZERO:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = col
		cs.shape = bs
		cs.position = at + Vector3(0, col.y * 0.5, 0)
		body.add_child(cs)
	return true


## подпись комнаты на полу: до покупки оружейника — «Кладовая», после — «Оружейная»
func _armory_label() -> void:
	if house != null and house.labels.size() > 2:
		house.labels[2].text = "Оружейная" if _armory_root != null else "Кладовая"


func _armory() -> void:
	if _armory_root != null or not ULBase.installed("gunsmith"):
		_armory_label()
		return
	var root := Node3D.new()
	root.name = "Armory"
	house.inner.add_child(root)
	_armory_root = root
	_armory_label()
	var body := StaticBody3D.new()
	body.name = "ArmoryBody"
	root.add_child(body)
	var wood := ULHouse._mat(TEX + "old_planks_02", 1.3)
	wood.albedo_color = Color(0.78, 0.64, 0.5)
	var dark := ULHouse._mat(TEX + "old_planks_02", 1.3)
	dark.albedo_color = Color(0.42, 0.33, 0.26)
	var cloth := _paint(Color(0.17, 0.26, 0.19), 0.0, 0.95)
	var safe_c := _paint(Color(0.15, 0.21, 0.19), 0.55, 0.45)
	var safe_d := _paint(Color(0.2, 0.28, 0.25), 0.55, 0.4)
	var brass := _paint(Color(0.78, 0.62, 0.26), 0.8, 0.35)
	var rug := _paint(Color(0.34, 0.13, 0.11), 0.0, 1.0)
	# половик перед прилавком
	_box_prop(root, Vector3(1.3, 0.012, 2.3), Vector3(2.45, 0.032, 3.25), rug)
	# прилавок с застеклённой витриной (модель Tripo), витриной к покупателю; нет модели — тумба со столешницей
	if not _armory_model(root, "ul_gun_counter", Vector3(3.55, 0, 3.25), PI, 1.6, "len", Vector3(0.75, 1.0, 1.55), body):
		_box_prop(root, Vector3(0.55, 0.98, 2.6), Vector3(3.55, 0.49, 3.25), wood, body)
		_box_prop(root, Vector3(0.72, 0.05, 2.74), Vector3(3.55, 1.005, 3.25), dark)
		var z := 2.95
		for cid in ["a762x25", "a545", "a12", "bandage", "medkit"]:
			_shelf_item(root, cid, Vector3(3.55, 1.03, z), 0.4 + z, 0.22 if cid != "medkit" else 0.3)
			z += 0.34
	# стойка с ружьями на правой стене над столом-витриной (модель Tripo)
	_armory_model(root, "ul_gun_rack", Vector3(5.86, 1.0, 3.2), PI, 1.15, "h", Vector3.ZERO, null)
	# щит на стене с винтовками (сами стволы — в запечённой сетке)
	_box_prop(root, Vector3(1.62, 1.1, 0.04), Vector3(2.45, 1.38, 1.6), dark)
	for hy in [1.04, 1.38, 1.72]:
		for hx in [2.05, 2.85]:
			_box_prop(root, Vector3(0.03, 0.03, 0.14), Vector3(hx, hy - 0.07, 1.68), brass)
	# стол-витрина у дальней стены под зелёным сукном
	_box_prop(root, Vector3(0.9, 0.8, 2.3), Vector3(5.45, 0.4, 3.2), wood, body)
	_box_prop(root, Vector3(0.96, 0.05, 2.36), Vector3(5.45, 0.825, 3.2), cloth)
	# два стеллажа с ящиками патронов у задней стены (модель Tripo); нет модели — шкафы с коробками по калибрам
	var ammo_ids := ["a762x25", "a9x19", "a545", "a762x51", "a762x54", "a9x39", "a12"]
	var n := 0
	var shelves := 0
	for cx in [4.38, 5.38]:
		if _armory_model(root, "ul_ammo_shelf", Vector3(cx, 0, 1.8), PI * 0.5, 1.75, "h", Vector3(1.0, 1.75, 0.48), body):
			shelves += 1
	for cx in ([] if shelves == 2 else [4.47, 5.45]):
		_box_prop(root, Vector3(0.95, 1.85, 0.03), Vector3(cx, 0.925, 1.59), dark)
		for sx in [-0.46, 0.46]:
			_box_prop(root, Vector3(0.03, 1.85, 0.4), Vector3(cx + sx, 0.925, 1.78), wood)
		for sy in [0.1, 0.55, 1.0, 1.45, 1.84]:
			_box_prop(root, Vector3(0.95, 0.03, 0.4), Vector3(cx, sy, 1.78), wood)
			if sy < 1.8:
				for k in 3:
					_shelf_item(root, ammo_ids[n % ammo_ids.size()], Vector3(cx - 0.28 + k * 0.28, sy + 0.016, 1.8), 0.12 * (k - 1), 0.2)
					n += 1
		var ccs := CollisionShape3D.new()
		var cbs := BoxShape3D.new()
		cbs.size = Vector3(0.95, 1.85, 0.4)
		ccs.shape = cbs
		ccs.position = Vector3(cx, 0.925, 1.78)
		body.add_child(ccs)
	# два сейфа в углу: корпус, дверца, штурвал и табличка
	for sx in [4.92, 5.62]:
		_box_prop(root, Vector3(0.62, 1.15, 0.55), Vector3(sx, 0.575, 4.6), safe_c, body)
		_box_prop(root, Vector3(0.52, 1.02, 0.02), Vector3(sx, 0.585, 4.318), safe_d)
		_box_prop(root, Vector3(0.66, 0.03, 0.59), Vector3(sx, 1.165, 4.6), safe_d)
		var wheel := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.055
		tm.outer_radius = 0.085
		tm.rings = 14
		tm.ring_segments = 6
		wheel.mesh = tm
		wheel.material_override = brass
		wheel.rotation.x = PI * 0.5
		wheel.position = Vector3(sx + 0.08, 0.62, 4.29)
		root.add_child(wheel)
		_box_prop(root, Vector3(0.16, 0.06, 0.012), Vector3(sx - 0.1, 0.95, 4.3), brass)
	_shelf_item(root, "a762x54", Vector3(4.92, 1.185, 4.6), 0.3, 0.3)
	_shelf_item(root, "a12", Vector3(5.62, 1.185, 4.62), -0.2, 0.24)
	# оружие на стене, столе и прилавке
	if ResourceLoader.exists(MODELS + "ul_armory_guns.res"):
		var guns := MeshInstance3D.new()
		guns.mesh = load(MODELS + "ul_armory_guns.res")
		root.add_child(guns)


# ---------------- компьютер базы ----------------

## Компьютер — в сенях у правой стены (за ней оружейная), экраном в сени: стол, монитор, системный блок (модель
## Tripo ul_computer; нет её — простые объёмы). Через него: маршруты во временные кластеры, улучшения базы, персонал
## (оружейник). Что продаётся — data/base_shop.json, что куплено — ULBase (user://base.json).
const TERMINAL_AT := Vector3(1.11, 0, 4.33)
const TERMINAL_YAW := PI * 0.5            ## экран смотрит на −x (в сени), стол — вдоль стены
var _terminal: Node3D
var _term_ui: Control


## точка перед экраном (в системе дома), d м от стола
func terminal_front(d := 0.75) -> Vector3:
	return TERMINAL_AT + Basis(Vector3.UP, TERMINAL_YAW) * Vector3(0, 0, -d)


func _terminal_build() -> void:
	_terminal = Node3D.new()
	_terminal.name = "Terminal"
	house.inner.add_child(_terminal)
	_terminal.position = TERMINAL_AT
	_terminal.rotation.y = TERMINAL_YAW
	var body := StaticBody3D.new()
	body.name = "TerminalBody"
	_terminal.add_child(body)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(1.1, 0.8, 0.62)
	cs.shape = bs
	cs.position = Vector3(0, 0.4, 0.0)
	body.add_child(cs)
	var path := MODELS + "ul_computer.glb"
	if ResourceLoader.exists(path):
		# стол с компьютером — одна модель; ширина стола 1,05 м, экраном к сеням (−z в системе компьютера)
		var m: Node3D = (load(path) as PackedScene).instantiate()
		var bb: AABB = _aabb(m)
		# стол длиной 1,1 м (места у стены — между дверью в оружейную и фасадом); модель приземистая — по высоте
		# чуть вытянута, чтобы столешница была на привычной высоте
		var k := 1.1 / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		m.scale = Vector3(k, k * 1.3, k)
		m.rotation.y = TERMINAL_MODEL_YAW
		var b2: AABB = _aabb(m)
		m.position = Vector3(-b2.get_center().x, -b2.position.y, -b2.get_center().z)
		_terminal.add_child(m)
		_tint_model(m, Color(0.72, 0.7, 0.66))           # пыльный старый пластик, не белый
		return
	var dark := ULHouse._mat(TEX + "old_planks_02", 1.3)
	dark.albedo_color = Color(0.42, 0.33, 0.26)
	var metal := _paint(Color(0.22, 0.23, 0.22), 0.4, 0.5)
	var plastic := _paint(Color(0.78, 0.75, 0.66), 0.0, 0.6)
	_box_prop(_terminal, Vector3(1.0, 0.05, 0.56), Vector3(0, 0.74, 0), dark)
	for lx in [-0.45, 0.45]:
		_box_prop(_terminal, Vector3(0.05, 0.72, 0.5), Vector3(lx, 0.36, 0), metal)
	_box_prop(_terminal, Vector3(0.5, 0.4, 0.34), Vector3(0, 0.98, 0.07), plastic)
	var scr := _paint(Color(0.1, 0.35, 0.18), 0.0, 0.3)
	scr.emission_enabled = true
	scr.emission = Color(0.25, 0.9, 0.45)
	scr.emission_energy_multiplier = 0.8
	_box_prop(_terminal, Vector3(0.4, 0.3, 0.01), Vector3(0, 0.99, -0.105), scr)
	_box_prop(_terminal, Vector3(0.44, 0.03, 0.15), Vector3(0, 0.78, -0.17), plastic)
	_box_prop(_terminal, Vector3(0.2, 0.42, 0.44), Vector3(-0.3, 0.21, 0.02), plastic)


## цвет модели приглушается (свои копии материалов этой модели)
func _tint_model(n: Node, col: Color) -> void:
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var g := mi as MeshInstance3D
		for k in g.mesh.get_surface_count():
			var src := g.get_active_material(k) as StandardMaterial3D
			if src != null:
				var d := src.duplicate() as StandardMaterial3D
				d.albedo_color = src.albedo_color * col
				g.set_surface_override_material(k, d)


const TERMINAL_MODEL_YAW := PI * 0.5     ## у модели Tripo стол вдоль z, экран к +x — поворот: стол вдоль x, экран к −z


## Открыть компьютер базы: полноэкранный экран ULBasePC (core/world/base_pc.gd) поверх игры
func open_terminal() -> void:
	if _term_ui != null and is_instance_valid(_term_ui):
		return
	var pc := ULBasePC.new()
	_hud.get_parent().add_child(pc)
	pc.setup(self)
	pc.closed.connect(func() -> void: _term_ui = null)
	_term_ui = pc
	snd.play("click", player.global_position + Vector3.UP * 1.0, -6.0)
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


## Компьютер провёл покупку или обмен (kind — upgrade/route/exchange): оружейник встаёт за прилавок, всё сохраняется
func pc_done(kind: String, id: String) -> void:
	if kind == "upgrade" and ULBase.installed("gunsmith") and _armory_root == null:
		_armory()                               # куплено — в кладовой появляется вся оружейная
	if kind == "upgrade" and ULBase.has_staff("gunsmith") and npc_by_role("оружейник") == null:
		_npcs_setup()
	snd.play("click", player.global_position + Vector3.UP * 1.0, -4.0)
	_save()


# ---------------- торговля ----------------

## Товар оружейника по разделам: предмет, сколько штук за раз, цена {ресурс: сколько}. Платят ресурсами из
## кошелька (спораны, горошины, жемчужины); купленное оружие встаёт в свободный слот, остальное — в карманы и рюкзак.
const SHOP := {
	"weapons": [["tt", 1, {"spore": 6}], ["beretta", 1, {"spore": 10}], ["machete", 1, {"spore": 8}], ["mp5", 1, {"spore": 24}],
		["spas12", 1, {"spore": 30}], ["ak74m", 1, {"spore": 40}], ["vss", 1, {"spore": 50}], ["fnfal", 1, {"spore": 55}],
		["svd", 1, {"pea": 2}], ["pkp", 1, {"pea": 3}]],
	"ammo": [["a762x25", 16, {"spore": 1}], ["a9x19", 20, {"spore": 2}], ["a545", 30, {"spore": 3}], ["a12", 8, {"spore": 2}],
		["a762x51", 20, {"spore": 3}], ["a762x54", 20, {"spore": 4}], ["a9x39", 20, {"spore": 4}]],
	"supplies": [["bandage", 1, {"spore": 1}], ["medkit", 1, {"spore": 4}], ["tonic", 1, {"spore": 2}], ["water", 1, {"spore": 1}],
		["rusk", 1, {"spore": 1}], ["can", 1, {"spore": 2}], ["pack_small", 1, {"spore": 8}], ["pack_medium", 1, {"pea": 1}],
		["pack_large", 1, {"pea": 2}]],
}
const SHOP_TABS := [["weapons", "Оружие"], ["ammo", "Патроны"], ["supplies", "Припасы и снаряжение"], ["repair", "Ремонт"]]
var _talk_trade: Button
var _talk_sell: Button
var _shop_ui: Control
var _shop_wallet: Array = []      ## надписи с остатком ресурсов
var _shop_tab := "weapons"
var _shop_sel := 0
var _shop_grid: GridContainer
var _shop_card: VBoxContainer
var _shop_tabs: Array = []


static func price_text(price: Dictionary) -> String:
	var t := ""
	for id in price:
		t += ("" if t == "" else ", ") + "%s — %d" % [String(ULItems.get_def(String(id)).n).to_lower(), int(price[id])]
	return t


## купить товар номер i из раздела cat; false — не хватило ресурсов или места
func buy(cat: String, i: int) -> bool:
	var g: Array = SHOP[cat][i]
	var price: Dictionary = g[2]
	if not inv.can_pay(price):
		say("Не хватает ресурсов: " + price_text(price))
		return false
	var it := ULItems.make(String(g[0]), int(g[1]))
	if ULItems.kind(it) == "pack" and inv.pack != null and ULItems.pack_slots(it) > ULItems.pack_slots(inv.pack):
		# рюкзак больше надетого — надевается сразу, вещи перекладываются, старый (пустой) — в карман
		var wr := inv.wear_pack(it)
		if bool(wr.ok):
			if wr.drop != null:
				_spawn_ground(wr.drop, player.global_position + Vector3(-0.5, 0, 0.5), 0.0)
			inv.pay(price)
			_apply_gear()
			say("Куплено и надето: %s — вещи переложены" % String(ULItems.get_def(String(g[0])).n))
			_shop_refresh()
			_save()
			return true
	var n0 := int(it.n)
	var left := inv.add(it)
	if left >= n0:
		say("Нет места в карманах и рюкзаке")
		return false
	if left > 0:
		_spawn_ground(it, player.global_position + Vector3(-0.5, 0, 0.5), 0.0)      # что не влезло — под ноги
	inv.pay(price)
	_apply_gear()
	say("Куплено: %s" % String(ULItems.get_def(String(g[0])).n))
	_shop_refresh()
	_save()
	return true


## патроны к оружию id — тот же товар из раздела «Патроны» (кнопка на карточке оружия)
func buy_ammo_for(id: String) -> bool:
	var am := String(ULItems.get_def(id).get("ammo", ""))
	for i in SHOP.ammo.size():
		if String(SHOP.ammo[i][0]) == am:
			return buy("ammo", i)
	return false


func _shop_refresh() -> void:
	if _shop_ui == null or not is_instance_valid(_shop_ui):
		return
	for i in _shop_wallet.size():
		(_shop_wallet[i] as Label).text = str(int(inv.wallet.get(ULItems.MONEY[i], 0)))
	_shop_build()


func _shop_price(parent: Control, price: Dictionary, fs := 16, sz := 24.0) -> void:
	for id in price:
		var pi := TextureRect.new()
		pi.texture = ULItems.icon(String(id))
		pi.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		pi.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		pi.custom_minimum_size = Vector2(sz, sz)
		pi.mouse_filter = Control.MOUSE_FILTER_IGNORE
		parent.add_child(pi)
		var pl := Label.new()
		pl.text = str(int(price[id]))
		pl.add_theme_font_size_override("font_size", fs)
		pl.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5) if inv.can_pay(price) else Color(0.95, 0.45, 0.4))
		pl.mouse_filter = Control.MOUSE_FILTER_IGNORE
		parent.add_child(pl)


func _shop_lbl(t: String, fs: int, col: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	return l


## витрина раздела (карточки товара) и карточка выбранного товара справа
func _shop_build() -> void:
	for c in _shop_grid.get_children():
		c.queue_free()
	for c in _shop_card.get_children():
		c.queue_free()
	for i in _shop_tabs.size():
		(_shop_tabs[i] as Button).modulate = Color(1, 1, 1) if String(SHOP_TABS[i][0]) == _shop_tab else Color(0.62, 0.66, 0.72)
	if _shop_tab == "repair":
		_repair_build()
		return
	var goods: Array = SHOP[_shop_tab]
	_shop_sel = clampi(_shop_sel, 0, goods.size() - 1)
	for i in goods.size():
		var g: Array = goods[i]
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 132)
		b.focus_mode = Control.FOCUS_NONE
		var sel := i == _shop_sel
		for stn in ["normal", "hover", "pressed"]:
			var sb := ULSettings._box(Color(0.1, 0.15, 0.2) if sel else Color(0.07, 0.1, 0.14))
			sb.border_color = Color(1.0, 0.78, 0.3) if sel else Color(0.3, 0.4, 0.5)
			sb.set_border_width_all(2 if sel else 1)
			b.add_theme_stylebox_override(stn, sb)
		var v := VBoxContainer.new()
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_theme_constant_override("separation", 0)
		b.add_child(v)
		v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 6)
		var ic := TextureRect.new()
		ic.texture = ULItems.icon(String(g[0]))
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.size_flags_vertical = Control.SIZE_EXPAND_FILL
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(ic)
		var nm := _shop_lbl(String(ULItems.get_def(String(g[0])).n) + (" ×%d" % int(g[1]) if int(g[1]) > 1 else ""), 13, C_TEXT)
		nm.autowrap_mode = TextServer.AUTOWRAP_OFF
		nm.clip_text = true
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(nm)
		var pr := HBoxContainer.new()
		pr.alignment = BoxContainer.ALIGNMENT_CENTER
		pr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(pr)
		_shop_price(pr, g[2], 15, 20.0)
		b.pressed.connect(func() -> void:
			_shop_sel = i
			_shop_build())
		_shop_grid.add_child(b)
	# карточка выбранного
	var g: Array = goods[_shop_sel]
	var id := String(g[0])
	var d := ULItems.get_def(id)
	var big := TextureRect.new()
	big.texture = ULItems.icon(id)
	big.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	big.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	big.custom_minimum_size = Vector2(0, 120)
	_shop_card.add_child(big)
	_shop_card.add_child(_shop_lbl(String(d.n) + (" ×%d" % int(g[1]) if int(g[1]) > 1 else ""), 21, Color(1.0, 0.86, 0.5)))
	_shop_card.add_child(_shop_lbl(String(d.get("d", "")), 14, Color(0.72, 0.78, 0.85)))
	if d.has("dmg"):
		var st := "Урон %d" % int(d.dmg)
		if d.has("mag"):
			st += " · магазин %d · %s в секунду · дальность %d м" % [int(d.mag), str(snappedf(float(d.rate), 0.1)), int(d.get("range", 0))]
		_shop_card.add_child(_shop_lbl(st, 14, C_TEXT))
		_shop_card.add_child(_shop_lbl("Прочность: %d %s, потом нужен ремонт (полный — %d споранов)" % [int(d.get("dur", 0)), "ударов" if String(d.kind) == "melee" else "выстрелов", int(d.get("fix", 0))], 14, C_TEXT))
	var have := inv.count(id)
	for sl in ["primary", "pistol"]:
		if inv.get(sl) != null and String(inv.get(sl).id) == id:
			have += 1
	_shop_card.add_child(_shop_lbl("У вас: %d" % have, 14, Color(0.6, 0.85, 0.6) if have > 0 else Color(0.6, 0.66, 0.72)))
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_shop_card.add_child(row)
	_shop_price(row, g[2], 20, 30.0)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	var bb := ULSettings.button("Купить", buy.bind(_shop_tab, _shop_sel), 130.0)
	bb.modulate.a = 1.0 if inv.can_pay(g[2]) else 0.45
	row.add_child(bb)
	# у оружия — тут же патроны к нему: не надо искать калибр в другом разделе
	if d.has("ammo"):
		var am := String(d.ammo)
		for ai in SHOP.ammo.size():
			if String(SHOP.ammo[ai][0]) != am:
				continue
			var ag: Array = SHOP.ammo[ai]
			_shop_card.add_child(HSeparator.new())
			_shop_card.add_child(_shop_lbl("Патроны к нему", 14, Color(0.6, 0.66, 0.72)))
			var ar := HBoxContainer.new()
			ar.add_theme_constant_override("separation", 8)
			_shop_card.add_child(ar)
			var ai_ic := TextureRect.new()
			ai_ic.texture = ULItems.icon(am)
			ai_ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
			ai_ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
			ai_ic.custom_minimum_size = Vector2(48, 48)
			ar.add_child(ai_ic)
			var av := VBoxContainer.new()
			av.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			av.add_theme_constant_override("separation", 0)
			ar.add_child(av)
			av.add_child(_shop_lbl("%s ×%d" % [String(ULItems.get_def(am).n), int(ag[1])], 14, C_TEXT))
			av.add_child(_shop_lbl("У вас: %d" % inv.count(am), 13, Color(0.6, 0.66, 0.72)))
			var ar2 := HBoxContainer.new()
			ar2.add_theme_constant_override("separation", 8)
			_shop_card.add_child(ar2)
			_shop_price(ar2, ag[2], 18, 26.0)
			var sp2 := Control.new()
			sp2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			ar2.add_child(sp2)
			var ab := ULSettings.button("Купить патроны", buy_ammo_for.bind(id), 190.0)
			ab.modulate.a = 1.0 if inv.can_pay(ag[2]) else 0.45
			ar2.add_child(ab)


## Раздел «Ремонт»: изношенное и сломанное оружие героя (в слотах, карманах, рюкзаке) — прочность и цена;
## справа — карточка выбранного с кнопкой «Починить» и «Починить всё».
func _repair_build() -> void:
	var list := repair_list()
	if list.is_empty():
		_shop_card.add_child(_shop_lbl("Чинить нечего: всё оружие в порядке.", 18, C_TEXT))
		_shop_card.add_child(_shop_lbl("Каждый выстрел и удар снимает единицу прочности. Сломанное оружие не стреляет, пока его не починит оружейник.", 14, Color(0.72, 0.78, 0.85)))
		return
	_shop_sel = clampi(_shop_sel, 0, list.size() - 1)
	for i in list.size():
		var it: Dictionary = list[i]
		var b := Button.new()
		b.custom_minimum_size = Vector2(150, 132)
		b.focus_mode = Control.FOCUS_NONE
		var sel := i == _shop_sel
		for stn in ["normal", "hover", "pressed"]:
			var sb := ULSettings._box(Color(0.1, 0.15, 0.2) if sel else Color(0.07, 0.1, 0.14))
			sb.border_color = Color(1.0, 0.78, 0.3) if sel else Color(0.3, 0.4, 0.5)
			sb.set_border_width_all(2 if sel else 1)
			b.add_theme_stylebox_override(stn, sb)
		var v := VBoxContainer.new()
		v.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_theme_constant_override("separation", 0)
		b.add_child(v)
		v.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT, Control.PRESET_MODE_MINSIZE, 6)
		var ic := TextureRect.new()
		ic.texture = ULItems.icon(String(it.id))
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.size_flags_vertical = Control.SIZE_EXPAND_FILL
		ic.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(ic)
		var mx := int(ULItems.get_def(String(it.id)).get("dur", 1))
		var nm := _shop_lbl("%s · %d/%d" % [String(ULItems.get_def(String(it.id)).n), maxi(int(it.dur), 0), mx], 13, Color(0.95, 0.45, 0.4) if ULItems.broken(it) else C_TEXT)
		nm.autowrap_mode = TextServer.AUTOWRAP_OFF
		nm.clip_text = true
		nm.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		nm.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(nm)
		var pr := HBoxContainer.new()
		pr.alignment = BoxContainer.ALIGNMENT_CENTER
		pr.mouse_filter = Control.MOUSE_FILTER_IGNORE
		v.add_child(pr)
		_shop_price(pr, {"spore": ULItems.repair_cost(it)}, 15, 20.0)
		b.pressed.connect(func() -> void:
			_shop_sel = i
			_shop_build())
		_shop_grid.add_child(b)
	var it: Dictionary = list[_shop_sel]
	var d := ULItems.get_def(String(it.id))
	var big := TextureRect.new()
	big.texture = ULItems.icon(String(it.id))
	big.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
	big.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
	big.custom_minimum_size = Vector2(0, 120)
	_shop_card.add_child(big)
	_shop_card.add_child(_shop_lbl(String(d.n), 21, Color(1.0, 0.86, 0.5)))
	_shop_card.add_child(_shop_lbl(ULItems.dur_text(it), 16, Color(0.95, 0.45, 0.4) if ULItems.broken(it) else C_TEXT))
	_shop_card.add_child(_shop_lbl("Полный ремонт с нуля — %d споранов; платите только за изношенную часть." % int(d.get("fix", 0)), 14, Color(0.72, 0.78, 0.85)))
	var price := {"spore": ULItems.repair_cost(it)}
	var row := HBoxContainer.new()
	row.add_theme_constant_override("separation", 8)
	_shop_card.add_child(row)
	_shop_price(row, price, 20, 30.0)
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	row.add_child(sp)
	var rb := ULSettings.button("Починить", func() -> void: repair(it), 150.0)
	rb.modulate.a = 1.0 if inv.can_pay(price) else 0.45
	row.add_child(rb)
	if list.size() > 1:
		var total := 0
		for x in list:
			total += ULItems.repair_cost(x)
		var row2 := HBoxContainer.new()
		row2.add_theme_constant_override("separation", 8)
		_shop_card.add_child(row2)
		_shop_price(row2, {"spore": total}, 18, 26.0)
		var sp2 := Control.new()
		sp2.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row2.add_child(sp2)
		var ab := ULSettings.button("Починить всё", func() -> void:
			for x in repair_list():
				if not repair(x):
					break, 180.0)
		ab.modulate.a = 1.0 if inv.can_pay({"spore": total}) else 0.45
		row2.add_child(ab)


func open_shop() -> void:
	if _talk_ui:
		_talk_ui.visible = false
	var shade := ColorRect.new()
	shade.color = Color(0, 0, 0, 0.62)
	_hud.get_parent().add_child(shade)
	shade.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	_shop_ui = shade
	var pn := PanelContainer.new()
	pn.add_theme_stylebox_override("panel", ULSettings._box(ULSettings.C_BG))
	shade.add_child(pn)
	pn.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	pn.offset_left = 40
	pn.offset_right = -40
	pn.offset_top = 26
	pn.offset_bottom = -26
	var vb := VBoxContainer.new()
	vb.add_theme_constant_override("separation", 8)
	pn.add_child(vb)
	var head := HBoxContainer.new()
	head.add_theme_constant_override("separation", 10)
	vb.add_child(head)
	var tl := Label.new()
	tl.text = "Оружейная — Седой"
	tl.add_theme_font_size_override("font_size", 24)
	tl.add_theme_color_override("font_color", Color(1.0, 0.86, 0.5))
	tl.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	head.add_child(tl)
	# кошелёк: сколько каких ресурсов осталось
	_shop_wallet = []
	for id in ULItems.MONEY:
		var ic := TextureRect.new()
		ic.texture = ULItems.icon(id)
		ic.expand_mode = TextureRect.EXPAND_IGNORE_SIZE
		ic.stretch_mode = TextureRect.STRETCH_KEEP_ASPECT_CENTERED
		ic.custom_minimum_size = Vector2(30, 30)
		head.add_child(ic)
		var l := Label.new()
		l.add_theme_font_size_override("font_size", 18)
		l.add_theme_color_override("font_color", C_TEXT)
		l.custom_minimum_size.x = 30
		head.add_child(l)
		_shop_wallet.append(l)
	head.add_child(ULSettings.button("✕  Закрыть", func() -> void: shade.queue_free(), 150.0))
	# разделы
	var tabs := HBoxContainer.new()
	tabs.add_theme_constant_override("separation", 8)
	vb.add_child(tabs)
	_shop_tabs = []
	for t in SHOP_TABS:
		var tb := ULSettings.button(String(t[1]), func() -> void:
			_shop_tab = String(t[0])
			_shop_sel = 0
			_shop_build(), 150.0 if String(t[0]) != "supplies" else 280.0)
		tabs.add_child(tb)
		_shop_tabs.append(tb)
	var body := HBoxContainer.new()
	body.size_flags_vertical = Control.SIZE_EXPAND_FILL
	body.add_theme_constant_override("separation", 12)
	vb.add_child(body)
	var sc := ScrollContainer.new()
	sc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	body.add_child(sc)
	_shop_grid = GridContainer.new()
	_shop_grid.columns = maxi(3, int((get_viewport().get_visible_rect().size.x - 80.0 - 360.0 - 30.0) / 158.0))
	_shop_grid.add_theme_constant_override("h_separation", 8)
	_shop_grid.add_theme_constant_override("v_separation", 8)
	sc.add_child(_shop_grid)
	var cp := PanelContainer.new()
	cp.add_theme_stylebox_override("panel", ULSettings._box(Color(0.07, 0.1, 0.14)))
	cp.custom_minimum_size.x = 350
	body.add_child(cp)
	_shop_card = VBoxContainer.new()
	_shop_card.add_theme_constant_override("separation", 6)
	cp.add_child(_shop_card)
	_shop_refresh()
	_joy_id = -1
	_joy_v = Vector2.ZERO
	_hud_touch.clear()


# ---------------- производительность ----------------

## Бюджет кадра для телефона среднего класса (Mali-G57 / Adreno 610, цель — 60 кадров/с, отрисовка Compatibility):
## вызовов отрисовки, треугольников, память текстур (МБ), время своих скриптов и физики на кадр (мс; на компьютере —
## телефон считает в 3–4 раза медленнее, поэтому запас). Это то, что можно измерить без телефона; сама частота
## кадров измеряется только на устройстве — кнопкой «Тест FPS» в меню.
const PERF_BUDGET := {"draw": 350.0, "tris": 450000.0, "tex_mb": 450.0, "cpu_ms": 4.0}
const PERF_NAMES := {"draw": "вызовов отрисовки", "tris": "треугольников", "tex_mb": "текстуры, МБ", "cpu_ms": "скрипты и физика, худший кадр, мс"}
var _perf_text := ""
var _fps_t := -1.0
var _fps_n := 0
var _fps_worst := 0.0


## замер кадра в текущем месте: отрисовка — наибольшее за frames кадров; скрипты и физика — худший кадр за
## последнюю секунду (так считает движок; перед замером нужно простоять на месте дольше двух секунд)
func _perf_sample(frames := 20) -> Dictionary:
	var d := {"draw": 0.0, "tris": 0.0, "cpu_ms": 0.0}
	for i in frames:
		await get_tree().process_frame
		d.draw = maxf(d.draw, float(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME)))
		d.tris = maxf(d.tris, float(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME)))
	d.cpu_ms = (Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0
	if DisplayServer.get_name() == "headless":
		# разовая заминка самой машины не должна портить замер: берётся меньшее из двух соседних секунд
		await get_tree().create_timer(1.1).timeout
		d.cpu_ms = minf(d.cpu_ms, (Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0)
	d["tex_mb"] = float(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED)) / 1048576.0
	return d


## Проверка производительности для Android — в конце каждой проверки: замеры в нескольких местах локации
## против бюджета кадра. Возвращает, сколько показателей превышено.
func _perf_report() -> int:
	close_inventory()
	var H := house
	var pts := [["старт", Vector3(0, 0, 6)], ["калитка", Vector3(3.5, 0, 0.5)], ["двор", Vector3(4.0, 0, -4.5)], ["ельник", Vector3(-22, 0, 14)], ["тропа", Vector3(20, 0, 9)], ["дом, горница", H.to_global(Vector3(-2.5, 0, -1.5))]]
	var worst := {"draw": 0.0, "tris": 0.0, "tex_mb": 0.0, "cpu_ms": 0.0}
	var no_screen := DisplayServer.get_name() == "headless"
	print("[perf] место: вызовов отрисовки / треугольников / текстуры МБ / скрипты и физика мс" + (" (без экрана: только скрипты и физика)" if no_screen else " (с экраном: время кадра здесь — программная отрисовка, не показатель)"))
	for pt in pts:
		_auto.clear()
		player.global_position = pt[1]
		player.velocity = Vector3.ZERO
		_cam_ready = false
		await get_tree().create_timer(2.4 if no_screen else 1.0).timeout
		var d: Dictionary = await _perf_sample()
		print("[perf] %s: %d / %d / %d / %.2f" % [pt[0], d.draw, d.tris, d.tex_mb, d.cpu_ms])
		for k in worst:
			worst[k] = maxf(worst[k], float(d[k]))
	open_inventory()
	await get_tree().create_timer(2.4 if no_screen else 0.6).timeout
	var di: Dictionary = await _perf_sample()
	print("[perf] инвентарь открыт: %d / %d / %d / %.2f" % [di.draw, di.tris, di.tex_mb, di.cpu_ms])
	close_inventory()
	for k in worst:
		worst[k] = maxf(worst[k], float(di[k]))
	var over := 0
	for k in worst:
		if (k == "cpu_ms") != no_screen:
			continue                       # отрисовка считается с экраном, скрипты — без экрана
		var okk: bool = float(worst[k]) <= float(PERF_BUDGET[k])
		if not okk:
			over += 1
		print("[perf] %s: наибольшее %s при бюджете %s — %s" % [PERF_NAMES[k], ("%.2f" % worst[k]) if k == "cpu_ms" else str(int(worst[k])), str(PERF_BUDGET[k]), "в бюджете" if okk else "ПРЕВЫШЕНО"])
	print("[perf] итог: превышений %d. Частота кадров на телефоне здесь не измеряется — «Тест FPS» в меню игры." % over)
	return over


## «Тест FPS» в меню: 10 секунд игры — средняя и худшая частота кадров и нагрузка кадра; итог остаётся на экране
## и пишется в user://perf.txt
func fps_test() -> void:
	_fps_t = 0.0
	_fps_n = 0
	_fps_worst = 0.0
	_perf_text = "\nтест FPS: 10 с, побегайте по локации…"
	_menu_bar.visible = false


func _fps_tick(delta: float) -> void:
	if _fps_t < 0.0:
		return
	_fps_t += delta
	_fps_n += 1
	if _fps_t > 0.5:
		_fps_worst = maxf(_fps_worst, delta)
	if _fps_t < 10.0:
		return
	var avg := _fps_n / _fps_t
	var low := 1.0 / maxf(_fps_worst, 0.0001)
	var dr := int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME))
	var tr := int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME))
	var tm := int(RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TEXTURE_MEM_USED) / 1048576.0)
	var cpu := (Performance.get_monitor(Performance.TIME_PROCESS) + Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS)) * 1000.0
	_perf_text = "\nтест FPS: средняя %d, худший кадр %d к/с · разрешение %d %%\nотрисовка: %d вызовов, %d тыс. треуг., текстуры %d МБ\nрасчёты (худший кадр за секунду): %.0f мс из %.0f мс кадра" % [int(round(avg)), int(round(low)), int(round(get_viewport().scaling_3d_scale * 100.0)), dr, tr / 1000, tm, cpu, 1000.0 / maxf(avg, 1.0)]
	_fps_t = -1.0
	var f := FileAccess.open("user://perf.txt", FileAccess.WRITE)
	if f:
		f.store_string("%s %s\n%s\n" % [OS.get_model_name(), Time.get_datetime_string_from_system(), _perf_text.strip_edges()])


func _run_test() -> void:
	if test == "inv":
		await _inv_test()
		return
	if test == "pc":
		await _pc_test()
		return
	if test == "cs":
		await _cs_test()
		return
	if test == "sn":
		await _sn_test()
		return
	if test == "cv":
		await _cv_test()
		return
	if test == "cvrock":
		await _rock_test()
		return
	if test == "kh":
		await _kh_test()
		return
	if test == "lr":
		await _lair_test()
		return
	if test == "lvl":
		await _lvl_test()
		return
	if test == "lvlbench":
		# «Замер FPS»: обход всех точек, таблица, буфер обмена, файл
		var tb := Time.get_ticks_msec()
		while bench_text == "" and Time.get_ticks_msec() - tb < 240000:
			await get_tree().process_frame
		var lines := bench_text.split("\n")
		var n_pts := _perf_points().size()
		_ok("замер FPS: обошёл %d мест, таблица на экране, в буфере обмена и в файле" % (lines.size() - 2), lines.size() - 2 == n_pts and get_node_or_null("BenchPanel") != null and FileAccess.file_exists("user://bench_%s.txt" % place) and DisplayServer.clipboard_get() == bench_text, bench_text.left(400))
		if out != "":
			await _snap("bench")
		print("[inv] итог: ошибок %d" % _fails)
		get_tree().quit()
		return
	if test == "csperf" or test == "snperf" or test == "cvperf" or test == "khperf" or test == "lrperf":
		var t1 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - t1 < 25000:
			await get_tree().process_frame
		print("[perf] %s: врагов %d (наибольшее число по data/%s.json)" % [zone_name(), enemies.size(), place])
		var no_screen := DisplayServer.get_name() == "headless"
		var worst := {"draw": 0.0, "tris": 0.0, "tex_mb": 0.0, "cpu_ms": 0.0}
		var pts: Array = _perf_points()
		for pt in pts:
			player.global_position = (pt[1] as Vector3) + Vector3.UP * 0.1
			hp = HP_MAX
			if String(pt[0]).contains("гонятся"):
				for e in enemies:
					if e.alive():
						e.hear(player.global_position)
			_cam_ready = false
			await get_tree().create_timer(2.4 if no_screen else 1.0).timeout
			prof_mid = 0
			prof_mid_n = 0
			prof_full = 0
			prof_full_n = 0
			prof_parts.clear()
			var fr0 := Engine.get_process_frames()
			var d: Dictionary = await _perf_sample()
			# среднее и худшее за 60 кадров (один кадр «шумит» из-за самой машины)
			var acc := 0.0
			var acc_ph := 0.0
			var worst1 := 0.0
			for f in 60:
				await get_tree().process_frame
				var ph := Performance.get_monitor(Performance.TIME_PHYSICS_PROCESS) * 1000.0
				var ms := Performance.get_monitor(Performance.TIME_PROCESS) * 1000.0 + ph
				acc += ms
				acc_ph += ph
				worst1 = maxf(worst1, ms)
			d.cpu_ms = acc / 60.0
			print("[perf]   за 60 кадров: среднее %.2f мс (из них физика %.2f), худший %.2f мс" % [acc / 60.0, acc_ph / 60.0, worst1])
			var nf := maxi(Engine.get_process_frames() - fr0, 1)
			print("[prof] упрощённо: %.3f мс на вызов, %.2f мс на кадр; полностью: %.3f мс на вызов, %.2f мс на кадр" % [prof_mid / 1000.0 / maxf(prof_mid_n, 1), prof_mid / 1000.0 / nf, prof_full / 1000.0 / maxf(prof_full_n, 1), prof_full / 1000.0 / nf])
			var parts := ""
			for kp in prof_parts:
				parts += "%s %.2f; " % [kp, int(prof_parts[kp]) / 1000.0 / nf]
			print("[prof] по частям, мс на кадр: ", parts)
			var near := 0
			var mid := 0
			for e in enemies:
				if e.active:
					near += 1
				elif e.state in ["chase", "alert"] or e.global_position.distance_to(player.global_position) < 80.0:
					mid += 1
			print("[perf] %s: %d / %d / %d / %.2f мс (полностью считаются %d, упрощённо %d, стоят %d)" % [pt[0], d.draw, d.tris, d.tex_mb, d.cpu_ms, near, mid, enemies.size() - near - mid])
			if OS.get_cmdline_user_args().has("--as-tris"):
				_tris_breakdown(String(pt[0]))
			for k in worst:
				worst[k] = maxf(worst[k], float(d[k]))
		var over := 0
		for k in worst:
			if (k == "cpu_ms") != no_screen:
				continue
			var okk: bool = float(worst[k]) <= float(PERF_BUDGET[k])
			over += 0 if okk else 1
			print("[perf] %s: наибольшее %s при бюджете %s — %s" % [PERF_NAMES[k], ("%.2f" % worst[k]) if k == "cpu_ms" else str(int(worst[k])), str(PERF_BUDGET[k]), "в бюджете" if okk else "ПРЕВЫШЕНО"])
		print("[perf] итог: превышений %d" % over)
		get_tree().quit()
		return
	if test == "case":
		await _case_test()
		get_tree().quit()
		return
	if test == "atkview":
		# удары врагов покадрово (для проверки, что лапа доходит до героя): --as-kind=infected|lottery
		var kind := "infected"
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-kind="):
				kind = a.substr(10)
		player.global_position = Vector3(20.0, 0.05, 30.0)
		player.rotation.y = PI
		hp = 100000.0
		# враг сбоку от героя (с востока): камера видит и замах, и выпад, герой его не заслоняет
		var e := spawn_enemy(kind, Vector3(24.0, 0.0, 30.0))
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-clip="):
				e.force_clip = a.substr(10)
		e.hear(player.global_position)
		cam_dist = 7.0
		var t0 := Time.get_ticks_msec()
		var n := 0
		while Time.get_ticks_msec() - t0 < 14000 and n < 40:
			await get_tree().create_timer(0.1).timeout
			hp = 100000.0
			if e.state == "attack" or n > 0:
				await _snap("k%02d_%s" % [n, e.state])
				print("[atk] кадр %d: %s, удар «%s», лапа к герою: вес %.2f, промах %.2f м" % [n, e.state, e.last_attack, e.rig.hands.weight if e.rig.hands else -1.0, e.rig.hands.last_err if e.rig.hands else -1.0])
				n += 1
		get_tree().quit()
		return
	if test == "csview":
		# вид коровника с нескольких точек (снимки в --as-out)
		var t0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - t0 < 15000:
			await get_tree().process_frame
		var spots := [["v0_entry", ULCowshed.ENTRY + Vector3(0, 0, -4)], ["v1_barn_in", Vector3(-36, 0, -34)],
			["v2_barn_gate", Vector3(-30.5, 0, -24.5)], ["v3_cows", cowshed.cows[0] + Vector3(0, 0, 2.5)], ["v4_tractor", Vector3(9, 0, 23)],
			["v5_pen", Vector3(-40, 0, 12)], ["v6_forest", Vector3(-50, 0, 42)], ["v7_cross", Vector3(-2, 0, -12)], ["v8_barnC", Vector3(22, 0, -41)],
			["w0_barnE", Vector3(41, 0, 45)], ["w1_tower", Vector3(-14, 0, -53)], ["w2_barnD", Vector3(43, 0, -20)], ["w3_inside_E", Vector3(41, 0, 34)],
			["w5_wide", Vector3(-22, 0, -20)], ["v9_truck", Vector3(-9.5, 0, 6.5)], ["v10_cart", Vector3(-31.9, 0, 21.5)],
			["v11_trailer", Vector3(-13.3, 0, 27.0)], ["w4_top", Vector3(0, 0, 0)]]
		var only := ""
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				only = a.substr(10)
		if only != "":
			spots = spots.filter(func(sp): return only.split(",").has(String(sp[0])))
		for sp in spots:
			cam_dist = 70.0 if String(sp[0]) == "w4_top" else (22.0 if String(sp[0]) == "w5_wide" else 12.0)
			player.global_position = (sp[1] as Vector3) + Vector3.UP * 0.1
			for e in enemies:
				if e.global_position.distance_to(player.global_position) < 10.0:
					e.state = "idle"
			_cam_ready = false
			world_env.fog_enabled = String(sp[0]) != "w4_top"     # вид сверху для сравнения с эталоном — без дымки
			await get_tree().create_timer(1.2).timeout
			for t in cowshed.trees:
				var rel: Vector3 = t.global_position - player.global_position
				if absf(rel.x) < 12.0 and absf(rel.z) < 9.0:
					print("[view] %s: дерево %s в (%.1f, %.1f) от героя" % [sp[0], t.scene_file_path.get_file(), rel.x, rel.z])
			await _snap(String(sp[0]))
		get_tree().quit()
		return
	if test == "aimdbg":
		# отклик при стрельбе: огонь удержан, джойстик резко меняет сторону — через сколько герой идёт туда
		var I := ULItems
		var mq: Node3D = targets[0]
		inv.primary = I.make("pkp")
		inv.add(I.make("a762x54", 100))
		inv.hand = "primary"
		_apply_gear()
		await _wait_drawn()
		for tpos in [["цель справа", Vector3(-7, 0.05, 0)], ["цель сверху", Vector3(0, 0.05, 7)]]:
			player.global_position = mq.global_position + tpos[1]
			player.velocity = Vector3.ZERO
			await get_tree().create_timer(0.5).timeout
			_hud_touch[99] = "fire"
			_hud_press("fire")
			await get_tree().create_timer(0.6).timeout
			for dn in [["вправо", Vector2(1, 0)], ["влево", Vector2(-1, 0)], ["вверх", Vector2(0, -1)], ["вниз", Vector2(0, 1)], ["вправо", Vector2(1, 0)], ["вниз", Vector2(0, 1)], ["влево", Vector2(-1, 0)]]:
				_joy_id = 5
				_joy_v = dn[1]
				var wantv := Vector3((dn[1] as Vector2).x, 0, (dn[1] as Vector2).y)
				var t0 := Time.get_ticks_msec()
				var t_move := -1.0
				var t_anim := -1.0
				var want_local := Vector2.ZERO
				while Time.get_ticks_msec() - t0 < 1500:
					await get_tree().process_frame
					var el := (Time.get_ticks_msec() - t0) * 0.001
					var hv2 := Vector3(player.velocity.x, 0, player.velocity.z)
					if t_move < 0.0 and hv2.length() > 1.2 and hv2.normalized().dot(wantv) > 0.9:
						t_move = el
					var fa2 := Vector3(sin(player.rotation.y), 0, cos(player.rotation.y))
					var rel2 := fa2.signed_angle_to(wantv, Vector3.UP)
					want_local = Vector2(sin(rel2), cos(rel2))
					if t_anim < 0.0 and rig.dir_w > 0.8 and rig.dir_pos.dot(want_local) > 0.85:
						t_anim = el
				print("[aim] %s, джойстик %s: идёт через %.2f с, шаг ног — через %.2f с (режим %s, скорость %.1f, шаг (%.2f, %.2f) при нужном (%.2f, %.2f))" % [tpos[0], dn[0], t_move, t_anim, move_mode, Vector3(player.velocity.x, 0, player.velocity.z).length(), rig.dir_pos.x, rig.dir_pos.y, want_local.x, want_local.y])
			_joy_id = -1
			_joy_v = Vector2.ZERO
			_hud_touch.erase(99)
			await get_tree().create_timer(1.5).timeout
		get_tree().quit()
		return
	if test == "bake":
		print("[bake] карта земли сохранена: ", GROUND_MASK)
		get_tree().quit()
		return
	if test == "csbake" or test == "snbake" or test == "cvbake" or test == "khbake" or test == "lrbake":
		get_tree().quit()
		return
	if test == "khview":
		# вид хутора с нескольких точек (снимки в --as-out): снаружи, в домах, в магазине, в погребе
		var tk0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - tk0 < 20000:
			await get_tree().process_frame
		var kspots := [["k0_entry", ULKhutor.K_ENTRY + Vector3(0, 0, -3), 12.0], ["k1_loop", Vector3(0, 0, 28), 26.0], ["k2_center", Vector3(-6, 0, -8), 26.0],
			["k3_house", Vector3(-8, 0, -18.5), 11.0], ["k4_kitchen", Vector3(-11.8, 0, -22.2), 10.0], ["k5_shop_in", Vector3(46.5, 0, 17.5), 11.0], ["k6_shop_out", Vector3(40, 0, 17), 13.0],
			["k7_cellar_top", Vector3(16, 0, -11.2), 11.0], ["k8_cellar_stairs", Vector3(16, -1.2, -15.6), 10.0], ["k9_cellar_in", Vector3(18.6, -2.5, -19.6), 12.0], ["k9b_cellar_store", Vector3(12.5, -2.5, -24.6), 10.0],
			["l0_barn", Vector3(-44, 0, -47), 11.0], ["l1_garage", Vector3(-44, 0, 43.3), 10.0], ["l2_greenhouse", Vector3(11, 0, -4), 11.0], ["l3_tractor", Vector3(37, 0, -23), 13.0],
			["l4_well", Vector3(-5, 0, 21), 12.0], ["l5_apiary", Vector3(-27, 0, -60), 12.0], ["l6_h6", Vector3(53, 0, -12), 11.0], ["l7_cellar2", Vector3(-37, -2.5, 4.8), 11.0],
			["l8_cellar3", Vector3(46, -2.5, 34.4), 10.0], ["l9_top", Vector3(0, 0, 0), 85.0],
			["m0_h1_out", Vector3(-8, 0, -12.5), 13.0], ["m1_h3_out", Vector3(-44.5, 0, 22), 13.0], ["m2_h4_out", Vector3(-24, 0, 58.5), 13.0],
			["m3_h5_out", Vector3(28, 0, 58), 12.0], ["m4_h6_out", Vector3(47.5, 0, -6), 13.0], ["m5_garage_out", Vector3(-50.5, 0, 47.5), 12.0], ["m6_h1_side", Vector3(-15, 0, -16), 16.0], ["m7_h6_side", Vector3(54, 0, -3.5), 18.0],
			["n0_shop_door", Vector3(41.5, 0, 16.5), 8.0], ["n3_white", Vector3(42.5, 0, 11.5), 7.0], ["n1_picnic", Vector3(-53, 0, -11), 12.0], ["n2_forest", Vector3(-62, 0, 30), 14.0]]
		var konly := ""
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				konly = a.substr(10)
		if konly != "":
			kspots = kspots.filter(func(sp): return konly.split(",").has(String(sp[0])))
		for sp in kspots:
			cam_dist = float(sp[2])
			player.global_position = (sp[1] as Vector3) + Vector3.UP * 0.1
			player.velocity = Vector3.ZERO
			for e in enemies:
				if e.global_position.distance_to(player.global_position) < 14.0:
					e.state = "idle"
					e.wander_r = 0.0
			_cam_ready = false
			world_env.fog_enabled = String(sp[0]) != "l9_top"
			await get_tree().create_timer(1.3).timeout
			print("[view] %s: %s, герой (%.1f, %.1f, %.1f)" % [sp[0], _where(), player.global_position.x, player.global_position.y, player.global_position.z])
			if OS.get_cmdline_user_args().has("--as-near"):
				for a6 in OS.get_cmdline_user_args():
					if a6.begins_with("--as-hidemm="):
						for gi7 in get_tree().root.find_children("*", "MultiMeshInstance3D", true, false):
							var mm7 := (gi7 as MultiMeshInstance3D).multimesh
							var desc := str(gi7.material_override.resource_path if gi7.material_override else "") + " "
							if gi7.material_override is ShaderMaterial:
								desc += (gi7.material_override as ShaderMaterial).shader.code.substr(0, 200)
							elif gi7.material_override is StandardMaterial3D and (gi7.material_override as StandardMaterial3D).albedo_texture:
								desc += (gi7.material_override as StandardMaterial3D).albedo_texture.resource_path
							if mm7 and mm7.mesh and mm7.mesh.get_surface_count() > 0 and mm7.mesh.surface_get_material(0) is ShaderMaterial:
								desc += (mm7.mesh.surface_get_material(0) as ShaderMaterial).shader.code.substr(0, 200)
							if desc.contains(a6.substr(12)):
								(gi7 as Node3D).visible = false
								print("[hid] ", gi7.get_path(), " ", mm7.instance_count if mm7 else 0)
						await get_tree().create_timer(0.3).timeout
					if a6.begins_with("--as-hide="):
						for gi6 in get_tree().root.find_children("*", a6.substr(10), true, false):
							(gi6 as Node3D).visible = false
						await get_tree().create_timer(0.3).timeout
				for vi in get_tree().root.find_children("*", "VisualInstance3D", true, false):
					if vi is GeometryInstance3D or not (vi as Node3D).is_visible_in_tree():
						continue
					var p6 := (vi as Node3D).global_position
					if Vector2(p6.x, p6.z).distance_to(Vector2(40.5, 13.0)) < 4.0:
						print("[vis] ", vi.get_path(), " ", vi.get_class(), " ", p6)
				var cam3 := get_viewport().get_camera_3d()
				var px := Vector2(470, 470) * (get_viewport().get_visible_rect().size / Vector2(1280, 720))
				for gi in get_tree().root.find_children("*", "GeometryInstance3D", true, false):
					var g4 := gi as GeometryInstance3D
					if not g4.is_visible_in_tree():
						continue
					var b4 := g4.global_transform * g4.get_aabb()
					var r4 := Rect2(cam3.unproject_position(b4.position), Vector2.ZERO)
					for ci in 8:
						r4 = r4.expand(cam3.unproject_position(b4.get_endpoint(ci)))
					if r4.has_point(px) and r4.size.x < 700 and not cam3.is_position_behind(b4.get_center()):
						print("[pix] ", g4.get_path(), " ", g4.get_class(), " ", r4, " мат ", g4.material_override)
					if g4 is MultiMeshInstance3D and r4.has_point(px):
						var mm4 := (g4 as MultiMeshInstance3D).multimesh
						if mm4 == null or mm4.mesh == null:
							continue
						for ii in mm4.instance_count:
							var bi := g4.global_transform * mm4.get_instance_transform(ii) * mm4.mesh.get_aabb()
							var r5 := Rect2(cam3.unproject_position(bi.position), Vector2.ZERO)
							for ci in 8:
								r5 = r5.expand(cam3.unproject_position(bi.get_endpoint(ci)))
							if r5.has_point(px):
								var sm5 = mm4.mesh.surface_get_material(0)
								var tx5 = (sm5 as ShaderMaterial).get_shader_parameter("tex") if sm5 is ShaderMaterial else null
								print("[pixmm] ", g4.get_path(), " №", ii, " ", bi.get_center(), " ", bi.size, " tex ", tx5.resource_path if tx5 is Texture2D else str(sm5), " цвет ", mm4.get_instance_color(ii) if mm4.use_colors else Color.WHITE)
				for gi in get_tree().root.find_children("*", "GeometryInstance3D", true, false):
					var g3 := gi as GeometryInstance3D
					var bb := g3.global_transform * g3.get_aabb()
					if g3.is_visible_in_tree() and bb.size.length() < 6.0 and Vector2(bb.get_center().x, bb.get_center().z).distance_to(Vector2(player.global_position.x, player.global_position.z)) < 3.5:
						var extra := ""
						if g3 is MultiMeshInstance3D:
							var mm3 := (g3 as MultiMeshInstance3D).multimesh
							var mo = g3.material_override
							extra = " мм: %d шт., сетка %s, материал %s" % [mm3.instance_count, mm3.mesh.resource_path if mm3.mesh else "-", (mo.albedo_texture.resource_path if mo is StandardMaterial3D and mo.albedo_texture else str(mo))]
							var sm3 = mm3.mesh.surface_get_material(0) if mm3.mesh else null
							if sm3 is ShaderMaterial:
								var tx = (sm3 as ShaderMaterial).get_shader_parameter("tex")
								extra += " шейдер, tex " + (tx.resource_path if tx is Texture2D else str(tx)) + " | " + (sm3 as ShaderMaterial).shader.code.substr(0, 90).replace("\n", " ")
							for ii in mm3.instance_count:
								extra += " | " + str(mm3.get_instance_transform(ii).origin) + " " + str(mm3.get_instance_transform(ii).basis.get_scale())
						print("[near] ", g3.get_path(), " ", bb.get_center(), " ", bb.size, " owner ", g3.owner.scene_file_path if g3.owner else "-", extra)
			await _snap(String(sp[0]))
		get_tree().quit()
		return
	if test == "gfxdiag":
		await _gfx_diag()
		get_tree().quit()
		return
	if test == "lrview":
		# вид логова муров с нескольких точек (снимки в --as-out); враги рядом стоят спокойно
		var tl0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - tl0 < 30000:
			await get_tree().process_frame
		var lr := san as ULLair
		var lspots := [["r0_entry", ULLair.L_ENTRY + Vector3(0, 0, -3), 14.0], ["r1_gap", Vector3(0, 0, 64), 22.0], ["r2_fire", Vector3(0, 0, 14), 20.0],
			["r3_hq_out", Vector3(0, 0, -40), 22.0], ["r4_hq_hall", Vector3(4, 0, -50), 12.0], ["r5_boss", lr.chest_pos + Vector3(2, 0, 4.5), 13.0],
			["r6_barracks", Vector3(-57.5, 0, -16), 12.0], ["r7_barracks_out", Vector3(-46, 0, -18), 20.0], ["r8_warehouse", Vector3(-46, 0, 25), 13.0],
			["r9_tower", Vector3(-62, 3.4, -58), 16.0], ["s0_mess", Vector3(44, 0, -27), 13.0], ["s1_quarters", Vector3(44, 0, 33), 13.0],
			["s2_workshop", Vector3(-14, 0, -21), 12.0], ["s3_east", Vector3(48, 0, 8), 24.0], ["s4_wide", Vector3(0, 0, -6), 60.0], ["s5_top", Vector3(0, 0, 0), 120.0],
			["s6_murs", Vector3(0, 0, 0), 14.0], ["s7_murs_close", Vector3(0, 0, 0), 6.5]]
		var lonly := ""
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				lonly = a.substr(10)
		if lonly != "":
			lspots = lspots.filter(func(sp): return lonly.split(",").has(String(sp[0])))
		for sp in lspots:
			cam_dist = float(sp[2])
			var at: Vector3 = sp[1]
			if String(sp[0]).begins_with("s6_murs") or String(sp[0]) == "s7_murs_close":
				# муры вблизи: по одному каждого вида рядом с героем, с оружием наготове
				var kinds := ["mur_ak", "mur_sg", "mur_boss"]
				var ki := 0
				for e in enemies:
					if e is ULMur and e.alive() and kinds.has(e.kind):
						kinds.erase(e.kind)
						e.global_position = at + Vector3(-2.2 + ki * 2.2, 0.05, -1.5)
						e.rotation.y = 0.2
						e.state = "idle"
						e.wander_r = 0.0
						(e as ULMur).patrol = PackedVector3Array()
						ki += 1
			player.global_position = at + Vector3.UP * 0.1
			player.velocity = Vector3.ZERO
			for e in enemies:
				if e.global_position.distance_to(player.global_position) < 30.0:
					if String(sp[0]) != "s6_murs" and String(sp[0]) != "s7_murs_close":
						e.state = "idle"
					e.wander_r = 0.0
					if e is ULMur:
						(e as ULMur).patrol = PackedVector3Array()
			_cam_ready = false
			world_env.fog_enabled = not String(sp[0]) in ["s4_wide", "s5_top"]
			await get_tree().create_timer(1.4).timeout
			print("[view] %s: %s, герой (%.1f, %.1f, %.1f)" % [sp[0], _where(), player.global_position.x, player.global_position.y, player.global_position.z])
			await _snap(String(sp[0]))
		get_tree().quit()
		return
	if test == "cvview":
		# вид конвоя с нескольких точек (снимки в --as-out)
		var tv0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - tv0 < 20000:
			await get_tree().process_frame
		var vspots := [["c0_entry", ULConvoy.C_ENTRY + Vector3(0, 0, -3)], ["c1_road", Vector3(-1, 0, 9)], ["c2_wreck", Vector3(-3, 0, 0)], ["c3_btr", Vector3(1, 0, 18)],
			["c4_camp", Vector3(38, 0, -42)], ["c5_hq", Vector3(34, 0, -52.5)], ["c6_med", Vector3(51, 0, -43)], ["c7_live", Vector3(24, 0, -45)], ["c8_kung", Vector3(39, 0, -35)],
			["c9_post", Vector3(50, 0, 0)], ["d0_block", Vector3(44, 0, 6)], ["d1_supply", Vector3(-44, 0, 40)], ["d2_store", Vector3(-50, 0, 36)], ["d3_tower_up", ULConvoy.C_TOWER + Vector3(0, 3.4, 0)],
			["d4_tower", ULConvoy.C_TOWER + Vector3(6, 0, 3)], ["d5_heli", Vector3(40, 0, 43)], ["d6_forest", Vector3(-36, 0, -4)], ["d7_wide", Vector3(0, 0, 4)], ["d8_top", Vector3(0, 0, 0)],
			["d9_ural", Vector3(-12, 0, 35)], ["e0_camp_wide", Vector3(38, 0, -44)]]
		var vonly := ""
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				vonly = a.substr(10)
		if vonly != "":
			vspots = vspots.filter(func(sp): return vonly.split(",").has(String(sp[0])))
		for sp in vspots:
			cam_dist = 80.0 if String(sp[0]) == "d8_top" else (26.0 if String(sp[0]) in ["d7_wide", "e0_camp_wide"] else 12.0)
			player.global_position = (sp[1] as Vector3) + Vector3.UP * 0.1
			player.velocity = Vector3.ZERO
			for e in enemies:
				if e.global_position.distance_to(player.global_position) < 14.0:
					e.state = "idle"
					e.wander_r = 0.0
			_cam_ready = false
			world_env.fog_enabled = String(sp[0]) != "d8_top"
			await get_tree().create_timer(1.3).timeout
			print("[view] %s: %s, герой (%.1f, %.1f, %.1f)" % [sp[0], _where(), player.global_position.x, player.global_position.y, player.global_position.z])
			await _snap(String(sp[0]))
		get_tree().quit()
		return
	if test == "snchase":
		# отладка погони по этажам: пустыш из комнат первого этажа главного корпуса идёт к герою на втором
		var t0c := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - t0c < 25000:
			await get_tree().process_frame
		var mpc := get_world_3d().navigation_map
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-fps="):
				Engine.max_fps = int(a.substr(9))          # как на слабом телефоне под нагрузкой
		for e in enemies:
			e.state = "dead"
			e.visible = false
			e.process_mode = Node.PROCESS_MODE_DISABLED
		var mainc: ULBlock = san.blds[0]
		var hero2c: Vector3 = NavigationServer3D.map_get_closest_point(mpc, Vector3(12, 3.3, 21))
		var tried := 0
		for sp in mainc.spots:
			var tg := String(sp[1])
			var dxz := Vector2((sp[0] as Vector3).x - hero2c.x, (sp[0] as Vector3).z - hero2c.z).length()
			if not tg.ends_with(":0") or tg.contains(":stair:") or dxz > 22.0:
				continue
			tried += 1
			if tried > 10:
				break
			var ch := spawn_enemy("infected", NavigationServer3D.map_get_closest_point(mpc, sp[0]))
			player.global_position = hero2c + Vector3.UP * 0.1
			hp = HP_MAX
			await get_tree().create_timer(0.3).timeout
			ch.state = "chase"
			ch._last = player.global_position
			ch._unseen = 0.0
			var tt := 0.0
			var hp0c := hp
			var trace := []
			var nxt := 1.0
			while tt < 30.0 and hp >= hp0c:
				await get_tree().process_frame
				tt += get_process_delta_time()
				if tt >= nxt:
					nxt += 1.5
					trace.append("%.1f,%.1f,%.1f %s" % [ch.global_position.x, ch.global_position.y, ch.global_position.z, ch.state])
			print("[chase] %s из %s: %s за %.1f с" % [tg, str((sp[0] as Vector3).round()), "дошёл" if hp < hp0c else "НЕ ДОШЁЛ", tt])
			if hp >= hp0c:
				print("[chase]   след: ", " | ".join(trace))
				print("[chase]   путь: ", ch._path.slice(0, 5), " цель ", ch._last, " стена перед ним: ", ch._steer_a)
				for dd in san.doors:
					var d := dd as ULDoor
					if d.center.distance_to(ch.global_position) < 2.0:
						print("[chase]   дверь рядом: ", d.center, " открыта ", d.open, " столкновение выключено ", d.shape.disabled, " ширина ", d.width)
				var sq := PhysicsShapeQueryParameters3D.new()
				var cps := CapsuleShape3D.new()
				cps.radius = 0.36
				cps.height = 1.6
				sq.shape = cps
				sq.transform = Transform3D(Basis(), ch.global_position + Vector3.UP * 0.95)
				sq.collision_mask = 3
				sq.exclude = [ch.get_rid()]
				for h in get_world_3d().direct_space_state.intersect_shape(sq, 6):
					var co: Object = h.collider
					var shp: Node = (co as CollisionObject3D).shape_owner_get_owner((co as CollisionObject3D).shape_find_owner(h.shape)) if co is CollisionObject3D else null
					print("[chase]   касается: ", co, " форма ", (shp as CollisionShape3D).shape.get("size") if shp is CollisionShape3D else "?", " в ", (shp as Node3D).global_position if shp is Node3D else Vector3.ZERO)
			ch.damage(9999.0, player.global_position)
			ch.dead_t = ULEnemy.CORPSE_S
			await get_tree().create_timer(0.3).timeout
		get_tree().quit()
		return
	if test == "sndbg":
		# отладка карты проходимости санатория: этажи и лестницы
		var t0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - t0 < 25000:
			await get_tree().process_frame
		var mp := get_world_3d().navigation_map
		for q in [Vector3(-8, 0, 21), Vector3(-8, 3.3, 21), Vector3(-8, 6.6, 21), Vector3(-17, 1.6, 15.3), Vector3(-15, 3.3, 15.3), Vector3(-15.5, 3.3, 24)]:
			print("[dbg] ближайшая к %s: %s" % [str(q), str(NavigationServer3D.map_get_closest_point(mp, q))])
		var pth := NavigationServer3D.map_get_path(mp, Vector3(-8, 0, 21), Vector3(-8, 3.3, 21), true)
		print("[dbg] путь 1→2 этаж: ", pth)
		var ramp := NavigationServer3D.map_get_closest_point(mp, Vector3(-16.0, 1.6, 15.4))
		print("[dbg] марш: ", ramp)
		print("[dbg] марш → 1 этаж: ", NavigationServer3D.map_get_path(mp, ramp, Vector3(-8, 0.2, 21), true))
		print("[dbg] марш → 2 этаж: ", NavigationServer3D.map_get_path(mp, ramp, Vector3(-8, 3.5, 21), true))
		print("[dbg] низ марша: ", NavigationServer3D.map_get_closest_point(mp, Vector3(-13.5, 0.2, 15.4)), " площадка перед: ", NavigationServer3D.map_get_closest_point(mp, Vector3(-13.0, 0.2, 15.4)))
		print("[dbg] верх марша: ", NavigationServer3D.map_get_closest_point(mp, Vector3(-19.0, 3.4, 15.4)), " 2 этаж середина клетки: ", NavigationServer3D.map_get_closest_point(mp, Vector3(-16.0, 3.4, 21)))
		print("[dbg] 1 этаж середина клетки: ", NavigationServer3D.map_get_closest_point(mp, Vector3(-16.0, 0.2, 21)), " путь до коридора: ", NavigationServer3D.map_get_path(mp, Vector3(-16.0, 0.2, 21), Vector3(-8, 0.2, 21), true).size())
		var main: ULBlock = san.blds[0]
		var bk: Dictionary = main.blocks[0]
		for by in bk.bays:
			if String(by[2]) == "stair":
				print("[dbg] клетка ", by, " марш 0: ", main._flight_geo(bk, by, 0))
		var space := get_world_3d().direct_space_state
		for u in [-19.0, -18.0, -17.0, -16.0, -15.0, -14.0]:
			var q := PhysicsRayQueryParameters3D.create(Vector3(u, 5.0, 15.0), Vector3(u, -1.0, 15.0))
			var h := space.intersect_ray(q)
			print("[dbg] луч вниз в (%.1f, 15): %s" % [u, str(h.get("position", "нет"))])
		get_tree().quit()
		return
	if test == "snview":
		# вид санатория с нескольких точек (снимки в --as-out); внутри корпусов — на разных этажах
		var t0 := Time.get_ticks_msec()
		while not cs_ready and Time.get_ticks_msec() - t0 < 20000:
			await get_tree().process_frame
		var spots := [["s0_gate", ULSanatorium.ENTRY + Vector3(0, 0, -3)], ["s1_portico", Vector3(0, 0, 40)], ["s2_main_hall", Vector3(0, 0, 23)],
			["s3_main_f2", Vector3(10, 3.3, 21)], ["s4_main_f3", Vector3(-8, 6.6, 21)], ["s5_plaza", Vector3(2, 0, -6)], ["s6_med_out", Vector3(-48, 0, -32)],
			["s7_med_ward", Vector3(-58, 0, -45)], ["s8_res_f3", Vector3(50, 6.6, -8)], ["s9_res_out", Vector3(36, 0, -18)], ["t0_canteen", Vector3(-54, 0, 36)],
			["t1_boiler", Vector3(6, 0, -60)], ["t2_hozblok", Vector3(56, 0, -60)], ["t3_yard", Vector3(54, 0, 46)], ["t4_play", Vector3(-50, 0, 2)],
			["t5_stairs", Vector3(-15, 0.0, 17)], ["t6_wide", Vector3(0, 0, 0)], ["t7_top", Vector3(0, 0, 0)], ["t8_med_m2", Vector3(-29.5, 3.3, -40)],
			["u0_med_facade", Vector3(-46, 0, -29), 19.0], ["u1_res_facade", Vector3(36, 0, -15), 19.0], ["u2_main_facade", Vector3(8, 0, 38), 19.0],
			["u3_canteen_facade", Vector3(-50, 0, 44), 18.0]]
		var only := ""
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				only = a.substr(10)
		if only != "":
			spots = spots.filter(func(sp): return only.split(",").has(String(sp[0])))
		for sp in spots:
			cam_dist = 80.0 if String(sp[0]) == "t7_top" else (26.0 if String(sp[0]) == "t6_wide" else (float(sp[2]) if sp.size() > 2 else 12.0))
			player.global_position = (sp[1] as Vector3) + Vector3.UP * 0.1
			player.velocity = Vector3.ZERO
			for e in enemies:
				if e.global_position.distance_to(player.global_position) < 14.0:
					e.state = "idle"
					e.wander_r = 0.0
			_cam_ready = false
			world_env.fog_enabled = String(sp[0]) != "t7_top"
			await get_tree().create_timer(1.3).timeout
			print("[view] %s: %s, герой (%.1f, %.1f, %.1f)" % [sp[0], _where(), player.global_position.x, player.global_position.y, player.global_position.z])
			await _snap(String(sp[0]))
		get_tree().quit()
		return
	if test == "perf":
		await get_tree().create_timer(1.0).timeout
		await _perf_report()
		# кнопка «Тест FPS» из меню: тот же код, что на телефоне
		fps_test()
		await get_tree().create_timer(10.6).timeout
		print("[perf] кнопка «Тест FPS» (здесь — без экрана, число не показатель): " + _perf_text.strip_edges().replace("\n", " · "))
		get_tree().quit()
		return
	if test == "screen":
		# сколько метров земли видно от героя до краёв экрана (для дальности оружия)
		player.global_position = Vector3(0, 0.05, 20)
		_cam_ready = false
		await get_tree().create_timer(1.0).timeout
		var vs := get_viewport().get_visible_rect().size
		var plane := Plane(Vector3.UP, 0.0)
		var hp := player.global_position
		for pt in [["вправо", Vector2(vs.x, vs.y * 0.5)], ["влево", Vector2(0, vs.y * 0.5)], ["вверх", Vector2(vs.x * 0.5, 0)], ["вниз", Vector2(vs.x * 0.5, vs.y)], ["угол вверху справа", Vector2(vs.x, 0)], ["угол внизу справа", Vector2(vs.x, vs.y)]]:
			var o := cam.project_ray_origin(pt[1])
			var d := cam.project_ray_normal(pt[1])
			var g = plane.intersects_ray(o, d)
			var hs := cam.unproject_position(hp)
			print("[screen] %s: %.1f м (экран %dx%d, герой на экране в %s)" % [pt[0], (Vector3(g.x, 0, g.z) - Vector3(hp.x, 0, hp.z)).length() if g != null else -1.0, vs.x, vs.y, str(hs.round())])
		get_tree().quit()
		return
	if test == "range":
		# по стоячему пустышу на разных расстояниях: попадает ли каждое оружие
		player.global_position = Vector3(-20, 0.05, 40)
		player.rotation.y = PI * 0.5
		for wid in ["tt", "ak74m", "spas12", "svd"]:
			var line := ""
			for dist in [4.0, 7.0, 9.5, 13.0, 17.0, 25.0]:
				var e := spawn_enemy("infected", Vector3(-20.0 + dist, 0, 40))
				e.def = e.def.duplicate()
				e.def.see = 0.0
				e.def.hear = 0.0
				e.def.hear_run = 0.0
				e.def.walk = 0.0
				var it := ULItems.make(wid)
				if ULItems.slot_of(it) == "pistol":
					inv.pistol = it
					inv.hand = "pistol"
				else:
					inv.primary = it
					inv.hand = "primary"
				_apply_gear()
				await _wait_drawn()
				var h0 := float(e.get_meta("hp"))
				for k in 3:
					_atk_cd = 0.0
					_reloading = false
					it.mag = 5
					attack()
					await get_tree().create_timer(0.9).timeout
				var why := ""
				if h0 <= float(e.get_meta("hp")):
					var q := PhysicsRayQueryParameters3D.create(player.global_position + Vector3.UP * 1.35, e.global_position + Vector3.UP * 1.2)
					q.exclude = [player.get_rid()]
					var hit := get_world_3d().direct_space_state.intersect_ray(q)
					why = " (цель %s, луч упёрся в %s на %.1f м)" % ["выбрана" if _nearest_target(float(ULItems.get_def(wid).range), 180.0, true) == e else "не выбрана", str(hit.collider.name) + "/" + str(hit.collider.get_parent().name) if not hit.is_empty() else "ничто", (hit.position - player.global_position).length() if not hit.is_empty() else 0.0]
				line += " %d м: %s%s" % [int(dist), "урон %d" % int(h0 - float(e.get_meta("hp"))) if h0 > float(e.get_meta("hp")) else "НЕТ", why]
				clear_enemies()
			print("[range] %s (дальность %d м):%s" % [wid, int(ULItems.get_def(wid).range), line])
		get_tree().quit()
		return
	if test == "chase":
		# погоня глазами игровой камеры (камера отдалена — виден круг дальности ТТ)
		DirAccess.make_dir_recursive_absolute(out)
		cam_dist = 20.0
		player.global_position = Vector3(0, 0.05, 40)
		inv.primary = ULItems.make("spas12")
		inv.hand = "primary"
		_apply_gear()
		await _wait_drawn()
		for k in [["infected", Vector3(-7, 0, 27)], ["lottery", Vector3(7, 0, 25)], ["infected", Vector3(2, 0, 22)]]:
			var e := spawn_enemy(String(k[0]), k[1])
			e.state = "chase"
			e._last = player.global_position
		_cam_ready = false
		for i in 5:
			await get_tree().create_timer(0.45).timeout
			await _snap("ch_%d" % i)
		_why_t = -10.0
		for e in enemies:
			print("[chase] %s: %.1f м, в кадре %s" % [e.def.n, e.global_position.distance_to(player.global_position), str(cam.is_position_in_frustum(e.global_position + Vector3.UP))])
		_why_no_target(5.0)
		print("[chase] подсказка: «%s», видна %s, кольцо видно %s, масштаб %s" % [_toast.text, str(_toast.modulate.a), str(_range_ring.visible if _range_ring else null), str(_range_ring.scale if _range_ring else null)])
		await get_tree().create_timer(0.3).timeout
		await _snap("ch_hint")
		get_tree().quit()
		return
	if test == "melee":
		# каждый удар вплотную, сбоку: начало замаха, момент удара, после — и расстояние в момент удара
		DirAccess.make_dir_recursive_absolute(out)
		var kind := "infected"
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-kind="):
				kind = a.substr(10)
		player.global_position = Vector3(18.0, 0.05, 24.0)
		player.rotation.y = 0.0
		hp = 1e6
		var sc := Camera3D.new()
		add_child(sc)
		sc.fov = 34.0
		sc.look_at_from_position(Vector3(22.5, 1.5, 25.6), Vector3(18.0, 0.9, 25.0))
		sc.current = true
		_hud.visible = false
		var all: Array = ULEnemy.KINDS[kind].attacks
		for ai in all.size():
			var e := spawn_enemy(kind, Vector3(18.0, 0, 28.0))
			if not e.rig.has_clip(String(all[ai].clip)):
				print("[melee] %s %d: %s — движения ещё нет, пропуск" % [kind, ai, all[ai].n])
				clear_enemies()
				continue
			e.def = e.def.duplicate()
			e.def.attacks = [all[ai]]
			e.rotation.y = PI
			e.state = "chase"
			e._last = player.global_position
			var w := 0.0
			while e._hit_due < 0.0 and w < 6.0:
				await get_tree().process_frame
				w += get_process_delta_time()
			if not e.rig.has_clip(String(all[ai].clip)):
				print("[melee] %s: клипа %s нет" % [all[ai].n, all[ai].clip])
			await _snap("m%d_a" % ai)
			while e._hit_due >= 0.0:
				await get_tree().process_frame
			var gap := e.global_position.distance_to(player.global_position)
			await _snap("m%d_b" % ai)
			await get_tree().create_timer(0.35).timeout
			await _snap("m%d_c" % ai)
			print("[melee] %s %d: %s — в момент удара между центрами %.2f м" % [kind, ai, all[ai].n, gap])
			clear_enemies()
			await get_tree().create_timer(0.2).timeout
		get_tree().quit()
		return
	if test == "nav":
		# герой во дворе, враг за задним забором: должен обойти двор и войти через калитку
		player.global_position = HOUSE_AT + Vector3(6.0, 0.05, 7.5)
		await get_tree().create_timer(0.3).timeout
		for k in ["infected", "lottery"]:
			var e := spawn_enemy(k, HOUSE_AT + Vector3(6.0, 0, -12.0))
			e.state = "chase"
			e._last = player.global_position
			var t := 0.0
			var min_d := 1e9
			while t < 30.0 and e.state != "attack":
				await get_tree().create_timer(0.25).timeout
				t += 0.25
				min_d = minf(min_d, e.global_position.distance_to(player.global_position))
				e._last = player.global_position
			print("[nav] %s: %s за %.1f с (ближе всего %.1f м), путь сейчас из %d точек" % [e.def.n, "дошёл до героя и бьёт" if e.state == "attack" else "НЕ дошёл, " + e.state, t, min_d, e._path.size()])
			clear_enemies()
			hp = HP_MAX
		get_tree().quit()
		return
	if test == "loco":
		# враги бегут к герою по прямой: насколько тело отклоняется от направления бега (рывки вбок)
		player.global_position = Vector3(0, 0.05, 40)
		var ens: Array = []
		for k in ["infected", "lottery"]:
			var e := spawn_enemy(k, Vector3(-6.0 if k == "infected" else 6.0, 0, 15))
			e.rotation.y = 0.0
			e.state = "chase"
			e._last = player.global_position
			ens.append(e)
		await get_tree().create_timer(0.6).timeout
		for e in ens:
			var face_dev := 0.0
			var lat := 0.0
			var lat_min := 1e9
			var lat_max := -1e9
			var n := 0
			for f in 150:
				await get_tree().physics_frame
				var sk: Skeleton3D = e.rig.skel
				var lt: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("L_Thigh")).origin
				var rt: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("R_Thigh")).origin
				var hip: Vector3 = sk.global_transform * sk.get_bone_global_pose(sk.find_bone("Hip")).origin
				var left := lt - rt
				left.y = 0.0
				var body_fwd := left.cross(Vector3.UP).normalized()
				var mv := Vector3(e.velocity.x, 0, e.velocity.z)
				if mv.length() < 0.3:
					continue
				face_dev = maxf(face_dev, rad_to_deg(body_fwd.angle_to(mv.normalized())))
				var side := mv.normalized().cross(Vector3.UP)
				var off: float = (hip - e.global_position).dot(side)
				lat_min = minf(lat_min, off)
				lat_max = maxf(lat_max, off)
				n += 1
			print("[loco] %s: состояние %s, место %s, до героя %.1f м, видит %s" % [e.def.n, e.state, str(e.global_position.snapped(Vector3.ONE * 0.1)), e.global_position.distance_to(player.global_position), str(e.get_meta("sees", "?"))])
			print("[loco] %s: кадров %d, наибольшее отклонение тела от направления бега %.0f°, таз уходит вбок от капсулы %.2f…%.2f м, скорость %.1f м/с" % [e.def.n, n, face_dev, lat_min, lat_max, Vector3(e.velocity.x, 0, e.velocity.z).length()])
		get_tree().quit()
		return
	if test == "arena":
		# полигон: площадка 10×10 м, борта, оружие, враги по кнопке
		DirAccess.make_dir_recursive_absolute(out)
		_fails = 0
		await get_tree().create_timer(1.2).timeout
		await _snap("a0_start")
		_ok("полигон: дома и жителей нет, манекен и два ящика есть", house == null and npcs.is_empty() and crates.size() == 2 and targets.size() == 1)
		_ok("герой с автоматом и пистолетом, рюкзак надет", inv.primary != null and inv.pistol != null and inv.pack != null and inv.hand == "primary")
		var wpn := 0
		for c in crates[0].get_meta("items"):
			if c != null:
				wpn += 1
		_ok("в ящике — остальное оружие (8 видов)", wpn == 8, str(wpn))
		_auto_k = 1.0
		_auto = [Vector3(30, 0, 2.5)]
		await get_tree().create_timer(3.0).timeout
		_auto.clear()
		_auto_k = 0.6
		_ok("за борт не выйти: герой остался на площадке", absf(player.global_position.x) <= ARENA * 0.5 and absf(player.global_position.z) <= ARENA * 0.5, "x = %.2f" % player.global_position.x)
		_ok("отсчёта выхода на полигоне нет", _leave_t == 0.0 and not left_location)
		player.global_position = Vector3(0, 0.05, 3.0)
		for i in 8:
			arena_enemy("infected" if i % 2 == 0 else "lottery")
		var in_n := 0
		for e in enemies:
			if absf(e.global_position.x) < ARENA * 0.5 and absf(e.global_position.z) < ARENA * 0.5:
				in_n += 1
		_ok("«Враг +»: враги встают на площадке, не больше шести", enemies.size() == 6 and in_n == 6, "%d" % enemies.size())
		await get_tree().create_timer(1.6).timeout
		await _snap("a1_enemies")
		var a0 := inv.count("a545")
		arena_ammo()
		_ok("«Патроны»: запас к оружию в слотах пополнен", inv.count("a545") > a0, "%d → %d" % [a0, inv.count("a545")])
		_damage(enemies[0], 1000.0, enemies[0].global_position + Vector3.UP)
		clear_enemies()
		_ok("«Убрать врагов»: площадка пуста", enemies.is_empty() and targets.size() == 1)
		# «Рубер +»: на полигоне бросок камня виден — бросает с 4,5 м
		player.global_position = Vector3(-4.0, 0.05, 4.0)
		hp = HP_MAX
		arena_enemy("ruber")
		var arb: ULEnemy = enemies[0]
		arb.global_position = Vector3(4.0, 0.0, -4.0)
		arb._notice(player.global_position)
		var tar := 0.0
		while tar < 8.0 and arb.rocks == 0:
			await get_tree().process_frame
			tar += get_process_delta_time()
		var amark: bool = arb.rock != null and is_instance_valid(arb.rock) and arb.rock.at.distance_to(player.global_position) < 0.6
		_ok("«Рубер +»: на полигоне Рубер бросает камень (с %.1f м, в кластерах — с %d м): метка под героем" % [float(arb.def.rock.from), int(ULEnemy.KINDS.ruber.rock.from)], arb.rocks == 1 and amark and float(ULEnemy.KINDS.ruber.rock.from) == 11.0, "бросков %d, состояние %s" % [arb.rocks, arb.state])
		if out != "":
			await get_tree().create_timer(1.6).timeout
			await _snap("a2_ruber_rock")
		clear_enemies()
		hp = HP_MAX
		arena_enemy()
		hp = 5.0
		hurt(9.0)
		await get_tree().create_timer(3.3).timeout
		_ok("погиб на полигоне — заново посреди площадки, здоровье полное, враги убраны", hp == HP_MAX and enemies.is_empty() and player.global_position.distance_to(Vector3(0, 0, 2.5)) < 0.6)
		var lz := spawn_enemy("lottery", Vector3(1.5, 0, -1.0))
		lz.def = lz.def.duplicate()
		lz.def.see = 0.0
		lz.def.hear_walk = 0.0
		lz.def.hear_run = 0.0
		lz.def.walk = 0.0
		lz.rotation.y = 0.5
		var zi := spawn_enemy("infected", Vector3(-0.3, 0, -1.0))
		zi.def = lz.def.duplicate()
		zi.def.model = ULEnemy.KINDS.infected.model
		zi.rotation.y = 0.2
		player.global_position = Vector3(-2.0, 0.05, -0.6)
		player.rotation.y = 0.9
		var ac := Camera3D.new()
		add_child(ac)
		ac.fov = 38.0
		ac.look_at_from_position(Vector3(-0.2, 1.5, 4.6), Vector3(-0.2, 0.95, -1.0))
		ac.current = true
		_hud.visible = false
		await get_tree().create_timer(0.8).timeout
		await _snap("a4_lineup")
		_hud.visible = true
		cam.current = true
		clear_enemies()
		open_book()
		await get_tree().create_timer(0.4).timeout
		await _snap("a5_book")
		_book_ui.queue_free()
		inv.primary.dur = 212
		inv.pistol.dur = 31
		open_inventory()
		inv_ui._sel_src = "eq:primary"
		inv_ui._sel_i = 0
		inv_ui.refresh()
		await get_tree().create_timer(0.5).timeout
		await _snap("a6_durability")
		close_inventory()
		_menu_bar.visible = true
		await get_tree().create_timer(0.3).timeout
		await _snap("a2_menu")
		_menu_bar.visible = false
		open_inventory()
		await get_tree().create_timer(0.5).timeout
		await _snap("a3_inventory")
		close_inventory()
		print("[inv] итог: ошибок %d" % _fails)
		get_tree().quit()
		return
	if test == "shop":
		DirAccess.make_dir_recursive_absolute(out)
		inv.add(ULItems.make("spore", 14))
		inv.add(ULItems.make("pea", 1))
		inv.add(ULItems.make("pearl_black", 1))
		player.global_position = house.to_global(Vector3(2.9, 0.05, 3.25))
		_cam_ready = false
		await get_tree().create_timer(2.0).timeout
		await _snap("s0_armory")
		do_action()
		await get_tree().create_timer(0.5).timeout
		await _snap("s0_talk")
		open_shop()
		await get_tree().create_timer(0.5).timeout
		await _snap("s1_shop")
		buy("supplies", 1)
		buy("ammo", 2)
		_shop_tab = "weapons"
		_shop_sel = 5
		_shop_build()
		await get_tree().create_timer(0.4).timeout
		await _snap("s2_bought")
		# ремонт: пистолет изношен наполовину, автомат сломан
		if inv.pistol == null or not inv.pistol.has("dur"):
			inv.pistol = ULItems.make("tt")
		inv.pistol.dur = 140
		inv.primary = ULItems.make("ak74m")
		inv.primary.dur = 0
		inv.add(ULItems.make("spore", 30))
		_shop_tab = "repair"
		_shop_sel = 0
		_shop_build()
		await get_tree().create_timer(0.4).timeout
		await _snap("s4_repair")
		_shop_ui.queue_free()
		open_inventory()
		inv_ui._sel_src = "eq:primary"
		inv_ui._sel_i = 0
		inv_ui.refresh()
		await get_tree().create_timer(0.5).timeout
		await _snap("s3_inventory")
		get_tree().quit()
		return
	if test == "eclips":
		# движения заражённого крупным планом: по шесть кадров на клип
		DirAccess.make_dir_recursive_absolute(out)
		player.global_position = Vector3(18.0, 0.05, 14.0)
		var zkind := "infected"
		var zclips := ["punch_light", "punch_heavy", "melee_light", "melee_heavy", "hit_front", "death"]
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-kind="):
				zkind = a.substr(10)
			if a.begins_with("--as-clips="):
				zclips = Array(a.substr(11).split(","))
		var z := spawn_enemy(zkind, Vector3(18.0, 0.0, 27.5))
		z.def = z.def.duplicate()
		z.def.see = 0.0
		z.def.walk = 0.0
		z.rotation.y = 0.0
		var zc := Camera3D.new()
		add_child(zc)
		zc.fov = 40.0
		zc.look_at_from_position(z.global_position + Vector3(-3.6, 1.5, 2.2), z.global_position + Vector3(0, 0.9, 0.3))
		zc.current = true
		_hud.visible = false
		await get_tree().create_timer(0.6).timeout
		for cn in zclips:
			z.rotation.y = 0.0
			z.state = "idle"
			z._t = 99.0
			var ln := z.rig.play(cn)
			print("[eclips] %s длина %.2f" % [cn, ln])
			for fi in 6:
				await get_tree().create_timer(ln / 6.5).timeout
				await _snap("%s_%d" % [cn, fi])
			await get_tree().create_timer(0.5).timeout
		get_tree().quit()
		return
	if test == "enemy":
		# заражённый: стоит, бежит, бьёт, тело, обыск, справочник
		DirAccess.make_dir_recursive_absolute(out)
		hp = 100.0
		cam_dist = 5.5                                    # крупный план
		player.global_position = Vector3(18.0, 0.05, 24.0)
		player.rotation.y = 0.0
		_cam_ready = false
		var e := spawn_enemy("infected", Vector3(18.0, 0.0, 27.5))
		e.rotation.y = PI * 0.8
		e.set_physics_process(false)
		var st0: float = e.def.see
		e.def = e.def.duplicate()
		e.def.see = 0.0                                   # пока не замечает — снимок стоящего
		await get_tree().create_timer(1.5).timeout
		await _snap("e0_idle")
		# крупный план отдельной камерой
		var c2 := Camera3D.new()
		add_child(c2)
		c2.fov = 40.0
		c2.look_at_from_position(e.global_position + Vector3(-2.2, 1.9, -3.2), e.global_position + Vector3.UP * 0.95)
		c2.current = true
		_hud.visible = false
		await get_tree().create_timer(0.3).timeout
		await _snap("c0_idle")
		_hud.visible = true
		cam.current = true
		e.def.see = st0
		e.global_position = Vector3(18.0, 0.0, 31.0)
		await get_tree().create_timer(0.75).timeout
		await _snap("e1_chase")
		var hp0 := hp
		while hp >= hp0:
			await get_tree().process_frame
		await _snap("e2_attack")
		await get_tree().create_timer(0.25).timeout
		await _snap("e2b_attack")
		c2.look_at_from_position(e.global_position + Vector3(-3.4, 1.8, -1.2), (e.global_position + player.global_position) * 0.5 + Vector3.UP * 1.0)
		c2.current = true
		_hud.visible = false
		for ci in 4:
			while e._hit_due < 0.0:
				await get_tree().process_frame
			await _snap("c1_attack%d" % ci)
			await get_tree().create_timer(0.28).timeout
		await _snap("c1_attack_end")
		_damage(e, 1000.0, e.global_position + Vector3.UP * 1.3)
		await get_tree().create_timer(0.5).timeout
		await _snap("e3_dying")
		await get_tree().create_timer(2.5).timeout
		e.loot = [ULItems.make("spore", 3), null, null, null]
		c2.look_at_from_position(e.body_pos() + Vector3(-2.6, 2.6, -2.4), e.body_pos() + Vector3.UP * 0.2)
		player.global_position = e.body_pos() + Vector3(-0.2, 0.05, -1.0)
		await get_tree().create_timer(0.4).timeout
		await _snap("c2_corpse")
		_set_glow(e, false)
		await _snap("c2_corpse_plain")
		_hud.visible = true
		cam.current = true
		await _snap("e4_corpse")
		do_action()
		await get_tree().create_timer(0.6).timeout
		await _snap("e5_search")
		inv_ui._take_all()
		await get_tree().create_timer(0.3).timeout
		await _snap("e6_taken")
		close_inventory()
		open_book()
		await get_tree().create_timer(0.4).timeout
		await _snap("e7_book")
		_book_ui.queue_free()
		inv.add(ULItems.make("pea", 2))
		inv.add(ULItems.make("pearl_black", 1))
		inv.add(ULItems.make("pearl_red", 1))
		open_inventory()
		await get_tree().create_timer(0.5).timeout
		await _snap("e8_loot_items")
		get_tree().quit()
		return
	if test == "view":
		# обзор локации: несколько точек, по снимку
		DirAccess.make_dir_recursive_absolute(out)
		var pts := [["v0_start", Vector3(0, 0, 6)], ["v1_gate", Vector3(3.5, 0, 0.5)], ["v2_trail", Vector3(-2.0, 0, 20)], ["v3_yard", Vector3(4.0, 0, -4.5)], ["v4_forest", Vector3(-22, 0, 14)], ["v5_side", Vector3(20, 0, 9)], ["v6_mannequin", HOUSE_AT + Vector3(4.6, 0, 7.6)], ["v7_npc", HOUSE_AT + Vector3(2.9, 0, 3.25)], ["v7b_edge", Vector3(6.0, 0, 46.5)], ["v7c_fog", Vector3(6.0, 0, 53.0)], ["v7d_back", HOUSE_AT + Vector3(2.9, 0, 3.25)]]
		for pt in pts:
			player.global_position = pt[1]
			_cam_ready = false
			await get_tree().create_timer(1.6).timeout
			await _snap(pt[0])
		do_action()
		await get_tree().create_timer(0.5).timeout
		await _snap("v8_talk")
		if _talk_ui:
			_talk_ui.visible = false
		open_name_panel()
		await get_tree().create_timer(0.5).timeout
		await _snap("v9_name")
		_name_ui.visible = false
		# ящик с патронами: значки — патрон и коробка
		open_inventory(crates[1].get_meta("items"), "Ящик", false, "crate")
		await get_tree().create_timer(0.6).timeout
		await _snap("v10_ammo")
		close_inventory()
		# пули в полёте (замедлены для снимка) и коробки патронов на земле
		_spawn_ground(ULItems.make("a545", 30), targets[0].global_position + Vector3(-3.6, 0, 1.2), 0.0)
		_spawn_ground(ULItems.make("a762x25", 16), targets[0].global_position + Vector3(-4.3, 0, 1.5), 0.0)
		_spawn_ground(ULItems.make("a12", 8), targets[0].global_position + Vector3(-2.9, 0, 1.6), 0.0)
		inv.primary = ULItems.make("ak74m")
		inv.hand = "primary"
		_apply_gear()
		player.global_position = targets[0].global_position + Vector3(-5.5, 0.05, 0.4)
		_cam_ready = false
		await _wait_drawn()
		bullet_k = 0.004
		for i in 3:
			_atk_cd = 0.0
			attack()
			await get_tree().create_timer(1.2).timeout
		await _snap("v11_bullets")
		bullet_k = 1.0
		await get_tree().create_timer(0.5).timeout
		await _perf_report()
		get_tree().quit()
		return
	DirAccess.make_dir_recursive_absolute(out)
	await get_tree().create_timer(1.2).timeout
	await _snap("i0_start")
	_log("старт: " + _inv_state())
	# 1. малый рюкзак у старта: открыть и надеть
	await _walk([Vector3(1.6, 0, 2.2)])
	_log("рядом: «%s»" % _action_label())
	do_action()
	await get_tree().create_timer(0.8).timeout
	await _snap("i1_ground_pack")
	_on_wear_ground_pack()
	await get_tree().create_timer(1.2).timeout
	await _snap("i2_inventory_pack")
	_log("надел малый: " + _inv_state())
	close_inventory()
	# 2. в кладовую, открыть ящик, взять АК и ТТ, взять в руки
	var H := house
	await _walk([HOUSE_AT + Vector3(0, 0, YARD[3] + 1.0), HOUSE_AT + Vector3(0, 0, YARD[3] - 1.0), H.door_point(1.5), H.to_global(Vector3(0, 0, 3.25)), H.to_global(Vector3(0, 0, 0.8)), H.to_global(Vector3(-4.3, 0, -2.6))], 40.0)
	_log("у ящика: «%s», %s" % [_action_label(), _where()])
	do_action()
	await get_tree().create_timer(0.6).timeout
	await _snap("i3_crate")
	var c: Array = inv_ui.cont
	for i in c.size():
		if c[i] != null and String(c[i].id) in ["ak74m", "tt", "a545"]:
			inv_ui._sel_src = "cont"
			inv_ui._sel_i = i
			inv_ui._act_take()
	_log("взял из ящика: " + _inv_state())
	close_inventory()
	inv.hand = "primary"
	_apply_gear()
	await get_tree().create_timer(1.6).timeout
	await _snap("i4_with_ak")
	open_inventory()
	await get_tree().create_timer(1.5).timeout
	await _snap("i5_inventory_ak")
	# 3. выбросить ТТ и рюкзак на землю
	inv_ui._sel_src = "eq:pistol"
	inv_ui._sel_i = 0
	inv_ui._act_drop()
	inv_ui._sel_src = "eq:pack"
	inv_ui._sel_i = 0
	inv_ui._act_drop()
	await get_tree().create_timer(0.8).timeout
	await _snap("i6_after_drop")
	_log("выбросил ТТ и рюкзак: " + _inv_state() + ", на земле предметов: %d" % ground.size())
	close_inventory()
	await get_tree().create_timer(0.8).timeout
	await _snap("i7_ground")
	# 4. открыть брошенный рюкзак — переложить в него патроны
	for g in ground:
		if ULItems.kind(g.item) == "pack" and (g.node as Node3D).global_position.distance_to(player.global_position) < 2.5:
			_target = {"type": "ground", "g": g}
	_log("рядом: «%s» — %s" % [_action_label(), _target_name()])
	do_action()
	if _open_ground != null:
		for i in inv.pockets.size():
			if inv.pockets[i] != null and String(inv.pockets[i].id) == "bandage":
				inv_ui._sel_src = "pockets"
				inv_ui._sel_i = i
				inv_ui._act_to_cont()
				break
		await get_tree().create_timer(0.5).timeout
		await _snap("i8_into_pack")
		_log("переложил бинты в рюкзак на земле: в нём %d предм." % (_open_ground.item.items.filter(func(x): return x != null).size()))
	close_inventory()
	# 5. в горницу — вид с низкими передними стенами
	await _walk([H.to_global(Vector3(-2.5, 0, -1.5))], 25.0)
	await _snap("i9_gornica")
	_log("горница: " + _where())
	await _perf_report()
	get_tree().quit()
