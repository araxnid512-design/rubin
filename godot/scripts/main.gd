extends Node3D

## События для систем (звуки, эффекты, следы боя): выстрел, попадание, убийство, урон герою, шум.
signal shot(shooter, weapon: Dictionary, from: Vector3)
signal enemy_hit(target, at: Vector3)
signal enemy_killed(target)
signal player_hurt(dmg: float)
signal noise_made(pos: Vector3, radius: float)
## «Улей. Кластер-17» на Godot: главный цикл. Локации, переходы по карте Улья, перезагрузка кластеров,
## заражённые, тайники и обыск, спораны, торговец и лекарь в стабе, гибель, сохранение (user://save.json).
## Запуск с «-- --smoke» — автотест для CI: проходит игру по шагам и выходит с кодом 0 (всё в порядке) или 1.

const SAVE_PATH := "user://save.json"
## Системы игры в своих файлах (scripts/features/*.gd, extends Node): подключаются одной строкой здесь.
## Необязательные методы системы: setup(game), on_enter(id), on_leave(), snapshot() -> Dictionary (в сохранение
## кластера), restore(data), save_data() -> Dictionary, load_data(d), interact(station) -> bool (станции стаба),
## smoke() -> int (корутина автотеста: число провалов). Свой _process — как у любого узла.
const FEATURE_SCRIPTS := [
	"res://scripts/features/inventory.gd",
	"res://scripts/features/stash.gd",
	"res://scripts/features/grenades.gd",
	"res://scripts/features/barrels.gd",
	"res://scripts/features/marks.gd",
	"res://scripts/features/mercs.gd",
	"res://scripts/features/murs.gd",
	"res://scripts/features/anim_check.gd",
	"res://scripts/features/minimap.gd",
	"res://scripts/features/audio.gd",
	"res://scripts/features/settings.gd",
	"res://scripts/features/guns.gd",
	"res://scripts/features/graphics.gd",
]
const CAM_OFFSET := Vector3(0, 15.5, 9.5)   # камера сверху под углом ~58°
## Сколько заражённых самое большее по опасности кластера (как в браузерной игре).
const CAP := [0, 42, 50, 58]
const PRICES := {"zhivchik": 15, "repair_kit": 25, "axe": 8, "fireaxe": 18, "pistol": 40, "obrez": 30, "shotgun": 45, "vector": 70, "aks": 80, "ak74": 110, "ak47": 120, "scar": 260, "fnfal": 240, "aug": 220, "pm63": 120, "spas12": 200, "vss": 180, "svd": 160, "pkm": 230}

var level: Level
var player: Player
var enemies: Array = []
## Кроме героя, на кого бросаются заражённые: муры, наёмники — узлы с alive, global_position, hurt(dmg, from).
var targets: Array = []
## Враждебные не-заражённые, по которым целится и бьёт герой (муры, бочки с горючим): узлы с alive, T["radius"],
## global_position, damage(dmg, from). Заражённые — в enemies.
var hostiles: Array = []
var features: Array = []
var pickups: Array = []
var npcs: Array = []
var hud: Hud
var camera: Camera3D
var env: Environment
var time := 0.0
var world := {}
var bag := {}
var kit := {"melee": "axe", "gun": ""}
var wear := {}
var loc := ""
var from_loc = null
var kills := 0
var exit_armed := false
var searching := {}
var hud_t := 0.0
var view_t := 0.0
var smoke := false
var dead := false
var reload_dying := false

func _ready() -> void:
	Data.load_all()
	smoke = OS.get_cmdline_user_args().has("--smoke")
	_setup_scene()
	hud = Hud.new()
	add_child(hud)
	hud.setup(self)
	for path in FEATURE_SCRIPTS:
		var f: Node = (load(path) as GDScript).new()
		f.name = path.get_file().get_basename()
		add_child(f)
		features.append(f)
		if f.has_method("setup"):
			f.setup(self)
	if not smoke and _load():
		enter(world.get("at", "zarechny"), null)
	else:
		new_game()
	if smoke:
		_run_smoke()

## Свет и воздух «как на фото»: тёплое низкое солнце с запада-юго-запада, голубоватый свет неба (окружение
## и слабый заполняющий свет с другой стороны — тени не чёрные), ACES, дымка вдали (туман по глубине: у героя
## чисто, к верху экрана — теплее и мутнее). Тени солнца (мягкие, один каскад ~30 м), свечение огня (glow)
## и цветокоррекция включает Level.apply_quality только на высоком качестве: в gl_compatibility это лишние
## проходы отрисовки. Узлы названы Sun и Fill — их находит Level.
func _setup_scene() -> void:
	var we := WorldEnvironment.new()
	env = Environment.new()
	env.background_mode = Environment.BG_COLOR
	env.background_color = Color(0.6, 0.59, 0.53)
	env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	env.ambient_light_color = Color(0.56, 0.62, 0.7)
	env.ambient_light_energy = 0.85
	env.tonemap_mode = Environment.TONE_MAPPER_ACES
	env.tonemap_exposure = 1.08
	env.fog_enabled = true
	env.fog_light_color = Color(0.7, 0.66, 0.56)
	env.fog_sun_scatter = 0.2
	if env.get("fog_mode") != null:
		# туман по глубине (Godot 4.3+): до 17 м от камеры чисто, дальше — дымка до 55 % к 70 м
		env.set("fog_mode", 1)
		env.set("fog_depth_begin", 17.0)
		env.set("fog_depth_end", 70.0)
		env.set("fog_depth_curve", 0.7)
		env.fog_density = 0.55
	else:
		env.fog_density = 0.006
	env.glow_enabled = false
	env.glow_intensity = 0.7
	env.glow_strength = 1.0
	env.glow_bloom = 0.04
	env.glow_hdr_threshold = 0.95
	env.glow_blend_mode = Environment.GLOW_BLEND_MODE_SOFTLIGHT
	env.adjustment_enabled = false
	env.adjustment_brightness = 1.0
	env.adjustment_contrast = 1.06
	env.adjustment_saturation = 1.12
	we.environment = env
	add_child(we)
	var sun := DirectionalLight3D.new()
	sun.name = "Sun"
	sun.light_color = Color(1.0, 0.84, 0.64)
	sun.light_energy = 1.75
	sun.rotation_degrees = Vector3(-34, -69, 0)
	sun.shadow_enabled = false
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 30.0
	sun.directional_shadow_fade_start = 0.85
	sun.shadow_blur = 1.6
	sun.shadow_opacity = 0.8
	sun.shadow_bias = 0.05
	sun.shadow_normal_bias = 1.5
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.name = "Fill"
	fill.light_color = Color(0.62, 0.72, 0.9)
	fill.light_energy = 0.3
	fill.light_specular = 0.0
	fill.rotation_degrees = Vector3(-28, 111, 0)
	fill.shadow_enabled = false
	add_child(fill)
	camera = Camera3D.new()
	camera.fov = 42.0
	camera.far = 140.0
	add_child(camera)

func new_game() -> void:
	world = {"time": 0.0, "at": "zarechny", "clusters": {}}
	for id in Data.NODES:
		if Data.NODES[id]["kind"] == "cluster":
			world["clusters"][id] = {"next": randf_range(Data.CYCLE[0], Data.CYCLE[1]), "saved": null}
	bag = {"spore": 0, "zhivchik": 1}
	kit = {"melee": "axe", "gun": "pistol"}
	wear = {}
	enter("zarechny", null)

# ---------- Локации ----------

func enter(id: String, from) -> void:
	_clear_location()
	loc = id
	from_loc = from
	world["at"] = id
	level = Level.new()
	add_child(level)
	level.setup(id)
	if player == null or not player.alive:
		if player:
			player.queue_free()
		player = Player.new()
		add_child(player)
		player.setup(self, kit, wear)
		player.died.connect(_on_player_died)
		dead = false
	var start: Dictionary = level.meta.get("start", {"x": 0, "z": 0, "ry": 0})
	var spot := Vector3(start["x"], 0, start["z"])
	var ry: float = float(start["ry"])
	if from != null:
		for e in level.exits:
			if e["to"] == from:
				spot = Vector3(e["spawn"][0], 0, e["spawn"][1])
				ry = float(e["spawn"][2])
	player.global_position = spot
	player.rotation.y = ry
	exit_armed = false
	searching = {}
	var kind: String = Data.NODES[id]["kind"]
	if kind == "cluster":
		populate(world["clusters"][id].get("saved"))
	elif kind == "stab":
		_spawn_npcs()
	for f in features:
		if f.has_method("on_enter"):
			f.on_enter(id)
	hud.hide_panel()
	toast(Data.NODES[id]["name"])
	_update_camera(1.0)
	save()

func _clear_location() -> void:
	for f in features:
		if f.has_method("on_leave"):
			f.on_leave()
	targets.clear()
	for e in enemies:
		if is_instance_valid(e):
			e.queue_free()
	enemies.clear()
	for p in pickups:
		if is_instance_valid(p["node"]):
			p["node"].queue_free()
	pickups.clear()
	for n in npcs:
		if is_instance_valid(n):
			n.queue_free()
	npcs.clear()
	if level:
		level.queue_free()
		level = null

## Заражённые и тайники: как оставили (saved) или заново — по опасности кластера.
func populate(saved) -> void:
	if saved != null:
		for e in saved.get("enemies", []):
			var en := spawn_enemy(e[0], Vector3(e[1], 0, e[2]))
			en.hp = float(e[3])
		var conts: Array = saved.get("containers", [])
		for i in mini(conts.size(), level.containers.size()):
			level.containers[i]["searched"] = conts[i][0]
			level.containers[i]["items"] = conts[i][1]
		for p in saved.get("pickups", []):
			spawn_pickup(p[0], p[1], Vector3(p[2], 0, p[3]))
		var fs: Dictionary = saved.get("features", {})
		for f in features:
			if f.has_method("restore") and fs.has(str(f.name)):
				f.restore(fs[str(f.name)])
		return
	for c in level.containers:
		c["items"] = Data.roll_loot(c.get("loot", {}))
	var d: int = clampi(int(Data.NODES[loc].get("danger", 1)), 1, 3)
	var f := 0.5 + 0.2 * d
	var cap: int = CAP[d] - randi() % 11
	var pack := 0
	for g in level.meta.get("groups", []):
		var at := Vector3(g["at"][0], 0, g["at"][1])
		var r: float = float(g.get("r", 5))
		var runners := int(round(float(g.get("runners", 0)) * f * randf_range(0.6, 1.4)))
		var stompers: int = int(g.get("stompers", 0))
		var rubers: int = int(g.get("rubers", 0))
		if randf() < 0.08 * (d - 1):
			stompers += 1
		var group_pack := 0
		if stompers + rubers > 0:
			pack += 1
			group_pack = pack
			runners += 1 + randi() % d
		for t in [["ruber", rubers], ["stomper", stompers], ["runner", runners]]:
			for i in t[1]:
				if enemies.size() >= cap:
					break
				var pos := _free_spot(at, r)
				if pos != Vector3.INF:
					spawn_enemy(t[0], pos).pack = group_pack
	# бродячие стаи: вожак и бегуны
	for k in d + randi() % 2:
		var at2 := Vector3(randf_range(-level.play + 8, level.play - 8), 0, randf_range(-level.play + 8, level.play - 8))
		if at2.distance_to(player.global_position) < 28.0:
			continue
		pack += 1
		var lead := "ruber" if d >= 2 and randf() < 0.3 else "stomper"
		for i in 4 + randi() % (2 + d):
			if enemies.size() >= cap:
				break
			var pos2 := _free_spot(at2, 4.0)
			if pos2 != Vector3.INF:
				spawn_enemy(lead if i == 0 else "runner", pos2).pack = pack

func _free_spot(at: Vector3, r: float) -> Vector3:
	for i in 30:
		var a := randf() * TAU
		var dd := randf() * r
		var p := at + Vector3(cos(a) * dd, 0, sin(a) * dd)
		if level.blocked_at(p) or p.distance_to(player.global_position) < 15.0:
			continue
		if not level.building_at(p).is_empty() and randf() < 0.7:
			continue
		return p
	return Vector3.INF

func spawn_enemy(t: String, pos: Vector3) -> Enemy:
	var e := Enemy.new()
	add_child(e)
	e.setup(self, t, pos)
	enemies.append(e)
	return e

## Жители стаба: торговец, лекарь, охрана — модель героя в своей позе.
func _spawn_npcs() -> void:
	var scene: PackedScene = load("res://assets/characters/player.glb")
	for n in level.meta.get("npcs", []):
		var m: Node3D = scene.instantiate()
		m.position = Vector3(n["x"], n.get("y", 0.0), n["z"])
		m.rotation.y = n.get("ry", 0.0)
		add_child(m)
		var ap: AnimationPlayer = m.find_child("AnimationPlayer", true, false)
		var c: String = n.get("clip", "Idle")
		if ap and ap.has_animation(c):
			ap.get_animation(c).loop_mode = Animation.LOOP_LINEAR
			ap.play(c)
			ap.seek(randf() * 2.0, true)
		if n.has("gun"):
			var grip: Node3D = Player.attach_point(m, "GripR")
			var path := "res://assets/weapons/%s.glb" % n["gun"]
			if grip and ResourceLoader.exists(path):
				grip.add_child((load(path) as PackedScene).instantiate())
		npcs.append(m)

# ---------- Цикл ----------

func _process(delta: float) -> void:
	if player == null or level == null:
		return
	time += delta
	if not hud.panel.visible:
		advance(delta)
	player.move_input = hud.move_vector() if not hud.panel.visible else Vector2.ZERO
	player.regen(delta)
	_update_camera(delta)
	view_t -= delta
	if view_t <= 0.0:
		view_t = 0.2
		level.update_view(player.global_position)
	_update_pickups(delta)
	_update_interact(delta)
	_update_exit()
	_update_cluster()
	hud_t -= delta
	if hud_t <= 0.0:
		hud_t = 0.25
		hud_refresh()

func _update_camera(delta: float) -> void:
	var target := player.global_position
	var want := target + CAM_OFFSET
	camera.global_position = camera.global_position.lerp(want, minf(1.0, delta * 6.0)) if delta < 1.0 else want
	camera.look_at(camera.global_position - CAM_OFFSET + Vector3(0, 0.8, 0), Vector3.UP)

## Время мира: кластеры, чей срок вышел, перезагружаются (сохранённое состояние пропадает).
func advance(dt: float) -> void:
	world["time"] = float(world.get("time", 0.0)) + dt
	for id in world["clusters"]:
		var c: Dictionary = world["clusters"][id]
		while float(world["time"]) >= float(c["next"]):
			c["next"] = float(c["next"]) + randf_range(Data.CYCLE[0], Data.CYCLE[1])
			c["saved"] = null
			if id == loc and player and player.alive:
				_reload_death()

func time_left(id: String) -> float:
	if not world["clusters"].has(id):
		return INF
	return float(world["clusters"][id]["next"]) - float(world["time"])

func _update_cluster() -> void:
	var left := time_left(loc)
	hud.set_sour(clampf(1.0 - left / Data.WARN, 0.0, 1.0) if left < Data.WARN else 0.0)

func _reload_death() -> void:
	reload_dying = true
	player.die()

func clock(s: float) -> String:
	if s == INF:
		return "безопасно"
	var t := int(ceil(maxf(0.0, s)))
	return "%d:%02d" % [t / 60, t % 60]

func hud_refresh() -> void:
	if hud and player:
		hud.refresh(player, bag, Data.NODES.get(loc, {}).get("short", loc), clock(time_left(loc)))

func toast(text: String) -> void:
	if hud:
		hud.toast(text)
	if smoke:
		print("  · ", text)

# ---------- Бой ----------

func player_attack(down: bool) -> void:
	if player:
		player.attack_held = down

func player_switch() -> void:
	if player:
		player.switch_weapon()

## Все, кого можно бить: заражённые и враждебные (муры, бочки).
func foes() -> Array:
	var out := []
	for e in enemies + hostiles:
		if is_instance_valid(e) and e.alive:
			out.append(e)
	return out

func nearest_enemy(pos: Vector3, reach: float, need_los: bool):
	var best = null
	var bd := reach
	for e in foes():
		if not is_instance_valid(e) or not e.alive:
			continue
		var d: float = Vector2(e.global_position.x - pos.x, e.global_position.z - pos.z).length()
		if d < bd and (not need_los or line_of_sight(pos, e.global_position)):
			bd = d
			best = e
	return best

## На кого бросается заражённый: ближайший живой из героя и targets (муры, наёмники) в пределах sight.
func foe_for(pos: Vector3, sight: float):
	var best = player if player and player.alive and player.global_position.distance_to(pos) < sight else null
	var bd: float = player.global_position.distance_to(pos) if best else sight
	for t in targets:
		if is_instance_valid(t) and t.alive:
			var d: float = t.global_position.distance_to(pos)
			if d < bd:
				bd = d
				best = t
	return best

func line_of_sight(a: Vector3, b: Vector3) -> bool:
	var space := get_world_3d().direct_space_state
	var q := PhysicsRayQueryParameters3D.create(a + Vector3(0, 1.2, 0), b + Vector3(0, 1.2, 0), Level.WALL_LAYER)
	return space.intersect_ray(q).is_empty()

## Выстрел: попадание — по шансу (падает с дальностью), дробь — веером по нескольким; вспышка и трассер.
func fire_shot(shooter: Node3D, w: Dictionary, target, from: Vector3) -> void:
	shot.emit(shooter, w, from)
	noise(shooter.global_position, float(w.get("noise", 30)))
	_flash(from)
	var reach: float = float(w.get("range", 8.0))
	var pellets: int = int(w.get("pellets", 1))
	var aim_dir := Vector3(sin(shooter.rotation.y), 0, cos(shooter.rotation.y))
	for i in pellets:
		var hit = target
		if pellets > 1:
			# дробь: по любому заражённому в конусе
			hit = null
			var spread: float = float(w.get("spread", 0.25))
			var dir := aim_dir.rotated(Vector3.UP, randf_range(-spread, spread))
			var bd := reach
			for e in foes():
				var to: Vector3 = e.global_position - shooter.global_position
				to.y = 0
				var d := to.length()
				if d < bd and d > 0.1 and dir.dot(to / d) > 0.95:
					bd = d
					hit = e
		if hit == null:
			_tracer(from, from + aim_dir * reach)
			continue
		var dist: float = Vector2(hit.global_position.x - shooter.global_position.x, hit.global_position.z - shooter.global_position.z).length()
		var chance := clampf(1.0 - dist / reach * float(w.get("falloff", 0.35)), 0.4, 1.0)
		if randf() < chance:
			_tracer(from, hit.global_position + Vector3(0, 1.1, 0))
			enemy_hit.emit(hit, hit.global_position)
			hit.damage(float(w.get("damage", 20)), shooter.global_position)
		else:
			_tracer(from, hit.global_position + Vector3(randf_range(-1, 1), 1.0, randf_range(-1, 1)))

func _flash(at: Vector3) -> void:
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.75, 0.4)
	l.light_energy = 3.0
	l.omni_range = 6.0
	l.position = at
	add_child(l)
	get_tree().create_timer(0.05).timeout.connect(l.queue_free)

func _tracer(a: Vector3, b: Vector3) -> void:
	var len := a.distance_to(b)
	if len < 0.1:
		return
	var mi := MeshInstance3D.new()
	var box := BoxMesh.new()
	box.size = Vector3(0.025, 0.025, len)
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(1.0, 0.85, 0.5)
	box.material = m
	mi.mesh = box
	add_child(mi)
	mi.global_position = (a + b) / 2.0
	mi.look_at(b, Vector3.UP)
	get_tree().create_timer(0.06).timeout.connect(mi.queue_free)

## Шум: заражённые в радиусе поднимаются.
func noise(pos: Vector3, radius: float) -> void:
	noise_made.emit(pos, radius)
	for e in enemies:
		if is_instance_valid(e) and e.alive and e.global_position.distance_to(pos) < radius:
			e.alert()

func blood(at: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.emitting = true
	p.amount = 10
	p.lifetime = 0.5
	p.explosiveness = 1.0
	p.spread = 60.0
	p.initial_velocity_min = 1.5
	p.initial_velocity_max = 3.0
	p.gravity = Vector3(0, -9.8, 0)
	var s := SphereMesh.new()
	s.radius = 0.035
	s.height = 0.07
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.45, 0.03, 0.02)
	s.material = m
	p.mesh = s
	p.position = at
	add_child(p)
	get_tree().create_timer(1.0).timeout.connect(p.queue_free)

func on_kill(e) -> void:
	kills += 1
	enemy_killed.emit(e)
	var sp: Array = e.T["spores"]
	spawn_pickup("spore", sp[0] + randi() % (sp[1] - sp[0] + 1), e.global_position + Vector3(0.4, 0, 0.3))
	if e.type != "runner" and randf() < 0.6:
		spawn_pickup("peas", 1 + randi() % 2, e.global_position + Vector3(-0.4, 0, 0.2))
	if e.type == "ruber" and randf() < 0.1:
		spawn_pickup("pearl", 1, e.global_position + Vector3(0, 0, -0.4))
	enemies.erase(e)

func on_player_hurt(dmg: float) -> void:
	player_hurt.emit(dmg)
	hud.flash_hurt(dmg)
	hud_refresh()

func use_zhivchik() -> void:
	if int(bag.get("zhivchik", 0)) <= 0 or player == null or not player.alive:
		toast("Живчиков нет")
		return
	bag["zhivchik"] = int(bag["zhivchik"]) - 1
	player.hp = minf(player.max_hp, player.hp + 45.0)
	toast("Выпил живчик: +45 здоровья")
	hud_refresh()

# ---------- Предметы на земле и тайники ----------

func spawn_pickup(kind: String, n: int, pos: Vector3) -> void:
	var mi := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.13
	s.height = 0.2
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.85, 0.75, 0.35) if kind == "spore" else Color(0.5, 0.75, 0.4) if kind == "peas" else Color(0.15, 0.15, 0.18)
	m.emission_enabled = true
	m.emission = m.albedo_color * 0.6
	s.material = m
	mi.mesh = s
	mi.position = pos + Vector3(0, 0.3, 0)
	add_child(mi)
	pickups.append({"kind": kind, "n": n, "node": mi, "t": randf() * 3.0})

func _update_pickups(delta: float) -> void:
	for p in pickups.duplicate():
		var node: Node3D = p["node"]
		p["t"] += delta
		node.position.y = 0.3 + sin(p["t"] * 3.0) * 0.08
		if player.alive and Vector2(node.position.x - player.global_position.x, node.position.z - player.global_position.z).length() < 1.3:
			take(p["kind"], p["n"])
			node.queue_free()
			pickups.erase(p)

func take(kind: String, n: int) -> void:
	var w := Data.weapon(kind)
	if not w.is_empty():
		# оружие: в пустой слот — сразу, иначе — в рюкзак (kit["owned"], features/inventory.gd); такое же уже
		# есть — изношенное меняем на целое, а целое разбираем на ремкомплект
		var slot: String = w.get("slot", "gun")
		var full: int = int(w.get("durability", 500 if slot == "gun" else 60))
		var owned: Array = kit.get("owned", [])
		kit["owned"] = owned
		if kit.get(slot, "") == kind or owned.has(kind):
			if player.wear_of(kind) < full:
				wear[kind] = full
				toast("%s: сменил изношенный на целый" % w.get("name", kind))
			else:
				bag["repair"] = int(bag.get("repair", 0)) + 1
				toast("%s уже есть — снял детали: +1 ремкомплект" % w.get("name", kind))
		elif kit.get(slot, "") in ["", "fists"]:
			kit[slot] = kind
			wear[kind] = full
			player.attach_gear()
			toast("Подобрал: %s" % w.get("name", kind))
		else:
			owned.append(kind)
			wear[kind] = full
			toast("Найден: %s — в рюкзаке" % w.get("name", kind))
		hud_refresh()
		return
	bag[kind] = int(bag.get(kind, 0)) + n
	var forms: Array = Data.ITEMS.get(kind, {}).get("forms", [kind, kind, kind])
	toast("+%d %s" % [n, Data.plural(n, forms)])
	hud_refresh()

## Ближайший тайник (или станция в стабе), у которого стоит герой.
func _near_interact() -> Dictionary:
	var p := player.global_position
	for c in level.containers:
		if not c["searched"] and Vector2(p.x - float(c["ax"]), p.z - float(c["az"])).length() < 1.3:
			return {"kind": "container", "c": c, "label": "Обыск"}
	for s in level.meta.get("stations", []):
		if Vector2(p.x - float(s["x"]), p.z - float(s["z"])).length() < float(s.get("r", 1.5)):
			return {"kind": "station", "s": s, "label": s.get("label", "")}
	return {}

func _update_interact(delta: float) -> void:
	if not player.alive:
		hud.show_search(false)
		return
	var near := _near_interact()
	hud.show_search(not near.is_empty() and searching.is_empty(), near.get("label", ""))
	if searching.is_empty():
		return
	# обыск прерывает только сам игрок — пошёл со стика (а не толчок от удара или остаточная скорость)
	if player.move_input.length() > 0.15 or near.is_empty() or near.get("c") != searching["c"]:
		searching = {}
		toast("Обыск прерван")
		return
	searching["t"] = float(searching["t"]) - delta
	if float(searching["t"]) <= 0.0:
		var c: Dictionary = searching["c"]
		c["searched"] = true
		searching = {}
		if c["items"].is_empty():
			toast("%s — пусто" % c["name"])
		for it in c["items"]:
			take(it[0], it[1])
		c["items"] = []
		save()

func search_start() -> void:
	var near := _near_interact()
	if near.is_empty():
		return
	if near["kind"] == "container":
		searching = {"c": near["c"], "t": 1.4}
		toast("Обыскиваю: %s…" % near["c"]["name"])
	else:
		_station(near["s"])

# ---------- Стаб: торговец и лекарь ----------

func _station(s: Dictionary) -> void:
	for f in features:
		if f.has_method("interact") and f.interact(s):
			return
	match s.get("id", ""):
		"rest":
			player.hp = player.max_hp
			advance(120.0)
			toast("Отдохнул у лекаря: здоровье полное, прошло 2 минуты")
			hud_refresh()
		"trade":
			open_trade()
		_:
			toast("%s — скоро" % s.get("name", ""))

func repair_cost(id: String) -> int:
	var w := Data.weapon(id)
	if not w.has("durability"):
		return 0
	var lost := 1.0 - float(player.wear_of(id)) / float(w["durability"])
	return int(ceil(float(PRICES.get(id, 40)) * 0.5 * lost))

func open_trade() -> void:
	var sp: int = int(bag.get("spore", 0))
	var acts := []
	acts.append(["Живчик · %d сп." % PRICES["zhivchik"], _buy.bind("zhivchik"), sp >= PRICES["zhivchik"]])
	# товары систем (гранаты, ремкомплекты): f.trade_offers(спораны) -> [[надпись, Callable, можно ли], ...]
	for f in features:
		if f.has_method("trade_offers"):
			acts.append_array(f.trade_offers(sp))
	# починка: оружие в слотах и запасное в рюкзаке
	for id in [kit.get("melee", ""), kit.get("gun", "")] + kit.get("owned", []):
		if id != "" and id != "fists" and repair_cost(id) > 0:
			acts.append(["Починить %s · %d сп." % [Data.weapon(id).get("name", id), repair_cost(id)], _repair.bind(id), sp >= repair_cost(id)])
	for id in ["axe", "pistol", "pm63", "obrez", "shotgun", "spas12", "vector", "aks", "ak74", "aug", "ak47", "scar", "fnfal", "svd", "vss", "pkm"]:
		acts.append(["%s · %d сп." % [Data.weapon(id).get("name", id), PRICES[id]], _buy.bind(id), sp >= PRICES[id]])
	if int(bag.get("peas", 0)) > 0:
		acts.append(["Продать горох ×%d · +%d сп." % [bag["peas"], int(bag["peas"]) * 5], _sell.bind("peas")])
	if int(bag.get("pearl", 0)) > 0:
		acts.append(["Продать чёрную жемчужину · +150 сп.", _sell.bind("pearl")])
	acts.append(["Закрыть", hud.hide_panel])
	hud.show_panel("Торговец", "Спораны: %d. Оружие изнашивается — чини его здесь, пока не сломалось." % sp, acts)

func _buy(id: String) -> void:
	var price: int = PRICES[id]
	if int(bag.get("spore", 0)) < price:
		return
	bag["spore"] = int(bag["spore"]) - price
	if id == "zhivchik":
		bag["zhivchik"] = int(bag.get("zhivchik", 0)) + 1
	else:
		# новое — в слот, прежнее оружие слота — в рюкзак; такое же из рюкзака меняется на новое
		var w := Data.weapon(id)
		var slot: String = w.get("slot", "gun")
		var owned: Array = kit.get("owned", [])
		kit["owned"] = owned
		owned.erase(id)
		var old: String = kit.get(slot, "")
		if old != "" and old != "fists" and old != id:
			owned.append(old)
		kit[slot] = id
		wear[id] = int(w.get("durability", 100))
		player.attach_gear()
	save()
	open_trade()

func _repair(id: String) -> void:
	var cost := repair_cost(id)
	if int(bag.get("spore", 0)) < cost:
		return
	bag["spore"] = int(bag["spore"]) - cost
	wear[id] = int(Data.weapon(id)["durability"])
	save()
	open_trade()

func _sell(kind: String) -> void:
	var n: int = int(bag.get(kind, 0))
	bag["spore"] = int(bag.get("spore", 0)) + (n * 5 if kind == "peas" else 150)
	bag[kind] = 0 if kind == "peas" else n - 1
	save()
	open_trade()

# ---------- Выходы и карта Улья ----------

func _update_exit() -> void:
	if not player.alive or hud.panel.visible:
		return
	var e := level.exit_at(player.global_position)
	if not e.is_empty() and exit_armed:
		exit_armed = false
		show_map()
	elif e.is_empty():
		exit_armed = true

func show_map() -> void:
	var acts := []
	for r in Data.routes_from(loc):
		var to: String = r["to"]
		var node: Dictionary = Data.NODES[to]
		var state := "безопасно"
		if node["kind"] == "cluster":
			state = "перезагрузка через ~%d мин" % int(ceil(time_left(to) / 60.0))
		elif node["kind"] == "murs":
			state = "логово муров"
		acts.append(["%s · в пути ~%s мин · %s" % [node["short"], str(snappedf(float(r["time"]) / 60.0, 0.5)), state], _travel.bind(to)])
	acts.append(["Остаться", hud.hide_panel])
	hud.show_panel("Карта Улья", "Ты здесь: %s. Куда идти?" % Data.NODES[loc]["name"], acts)

func _travel(to: String) -> void:
	hud.hide_panel()
	snapshot()
	var t := Data.travel_time(loc, to)
	var from := loc
	advance(t)
	enter(to, from)

## Запомнить кластер, каким его оставляем.
func snapshot() -> void:
	if not world["clusters"].has(loc) or level == null:
		return
	var es := []
	for e in enemies:
		if is_instance_valid(e) and e.alive:
			es.append([e.type, snappedf(e.global_position.x, 0.01), snappedf(e.global_position.z, 0.01), ceilf(e.hp)])
	var cs := []
	for c in level.containers:
		cs.append([c["searched"], c["items"]])
	var ps := []
	for p in pickups:
		ps.append([p["kind"], p["n"], snappedf(p["node"].position.x, 0.01), snappedf(p["node"].position.z, 0.01)])
	var fs := {}
	for f in features:
		if f.has_method("snapshot"):
			fs[str(f.name)] = f.snapshot()
	world["clusters"][loc]["saved"] = {"enemies": es, "containers": cs, "pickups": ps, "features": fs}

# ---------- Гибель ----------

func _on_player_died() -> void:
	if dead:
		return
	dead = true
	player.attack_held = false
	var reload := reload_dying
	reload_dying = false
	var title := "Кластер перезагрузился" if reload else "Тебя сожрали"
	if not reload:
		snapshot()
	await get_tree().create_timer(1.6).timeout
	hud.show_panel(title, "Убито заражённых: %d. Спораны, горох и жемчуг остаются при тебе, всё остальное — там." % kills, [["Очнуться в стабе", respawn_in_stab]])

func respawn_in_stab() -> void:
	for k in bag.keys():
		if not k in ["spore", "peas", "pearl"]:
			bag[k] = 0
	kit["melee"] = "axe"
	kit["gun"] = ""
	kit["owned"] = []   # рюкзак пропал; сложенное в хранилище (features/stash.gd) цело
	wear.clear()
	wear["axe"] = 30
	advance(90.0)
	player.queue_free()
	player = null
	enter("stab", null)
	toast("Тебя вытащили рейдеры. Охрана выдала старый топор")

# ---------- Сохранение ----------

func save() -> void:
	if smoke:
		return
	var f := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if f:
		var fd := {}
		for ft in features:
			if ft.has_method("save_data"):
				fd[str(ft.name)] = ft.save_data()
		f.store_string(JSON.stringify({"world": world, "bag": bag, "kit": kit, "wear": wear, "features": fd}))

func _load() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE_PATH))
	if typeof(d) != TYPE_DICTIONARY or not d.has("world"):
		return false
	world = d["world"]
	bag = d.get("bag", {})
	kit = d.get("kit", {"melee": "axe", "gun": ""})
	wear = d.get("wear", {})
	var fd: Dictionary = d.get("features", {})
	for f in features:
		if f.has_method("load_data") and fd.has(str(f.name)):
			f.load_data(fd[str(f.name)])
	for id in Data.NODES:
		if Data.NODES[id]["kind"] == "cluster" and not world["clusters"].has(id):
			world["clusters"][id] = {"next": float(world["time"]) + randf_range(90.0, Data.CYCLE[1]), "saved": null}
	return true

# ---------- Автотест (CI): godot --headless --path godot -- --smoke ----------

var smoke_fail := 0

func _check(ok: bool, msg: String) -> void:
	print(("✓ " if ok else "✗ ") + msg)
	if not ok:
		smoke_fail += 1

func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

func _run_smoke() -> void:
	await _wait(0.5)
	player.max_hp = 100000.0
	player.hp = 100000.0
	_check(level != null and level.meta.get("colliders", []).size() > 100, "Заречный загружен: стен %d, тайников %d, выходов %d" % [level.meta.get("colliders", []).size(), level.containers.size(), level.exits.size()])
	_check(enemies.size() >= 20, "заражённых в кластере: %d" % enemies.size())
	_check(player != null and player.anim != null and player.anim.has_animation("IdleRifle") and player.grip != null, "герой: анимации (%s) и точка хвата (%s), крепления: %s" % [player.anim.get_animation_list().size() if player.anim else 0, player.grip, player.mounts.values().map(func(v): return v != null)])
	# автомат: выстрелы изнашивают ствол, заражённый падает
	kit["gun"] = "ak74"
	wear["ak74"] = int(Data.weapon("ak74")["durability"])
	player.attach_gear()
	player.switch_weapon()
	await _wait(1.5)
	_check(player.hold == "gun" and player.weapon_id() == "ak74", "смена оружия анимацией: в руках %s" % player.weapon_id())
	var z := spawn_enemy("runner", player.global_position + Vector3(0, 0, 3))
	var w0: int = player.wear_of("ak74")
	player.attack_held = true
	await _wait(2.5)
	player.attack_held = false
	_check(player.wear_of("ak74") < w0, "АК-74 изнашивается: %d → %d" % [w0, player.wear_of("ak74")])
	_check(not z.alive, "бегун застрелен")
	await _wait(0.5)
	_check(pickups.size() > 0, "с убитого — спораны на земле")
	# износ до нуля — ствол ломается
	wear["ak74"] = 1
	var z2 := spawn_enemy("runner", player.global_position + Vector3(0, 0, 3))
	player.attack_held = true
	await _wait(0.6)
	player.attack_held = false
	_check(kit["gun"] == "" and player.hold == "melee", "износ кончился — автомат сломался, в руках топор")
	z2.queue_free()
	enemies.erase(z2)
	# топор: удар изнашивает
	var z3 := spawn_enemy("runner", player.global_position + Vector3(0, 0, 1.2))
	var a0: int = player.wear_of("axe")
	player.attack_held = true
	await _wait(1.2)
	player.attack_held = false
	_check(player.wear_of("axe") < a0, "топор тупится: %d → %d" % [a0, player.wear_of("axe")])
	if is_instance_valid(z3):
		z3.queue_free()
		enemies.erase(z3)
	# обыск тайника
	var c: Dictionary = level.containers[0]
	player.global_position = Vector3(c["ax"], 0, c["az"])
	c["items"] = [["spore", 3]]
	var s0: int = int(bag.get("spore", 0))
	search_start()
	await _wait(2.0)
	_check(c["searched"] and int(bag.get("spore", 0)) >= s0 + 3, "обыск: %s — спораны %d → %d" % [c["name"], s0, bag.get("spore", 0)])
	# переходы по карте Улья
	for to in ["stab", "zarechny", "dachi", "himmash", "voench", "murs"]:
		var prev := loc
		if to == loc:
			continue
		enter(to, prev)
		await _wait(0.5)
		_check(level != null and level.id == to and player.alive, "%s: стен %d, тайников %d, заражённых %d" % [Data.NODES[to]["name"], level.meta.get("colliders", []).size(), level.containers.size(), enemies.size()])
	for f in features:
		if f.has_method("smoke"):
			print("— %s —" % f.name)
			smoke_fail += await f.smoke()
	print("SMOKE: %s" % ("OK" if smoke_fail == 0 else "FAIL (%d)" % smoke_fail))
	get_tree().quit(0 if smoke_fail == 0 else 1)
