class_name Building
extends Node3D
## Здание базы с визуальными состояниями:
## разрушенное → ремонт (леса) → рабочее → улучшение (леса) → улучшенное.
## Крыша и верхние этажи скрываются, когда генерал внутри. Своя интерактивная панель (терминал).

var def: Dictionary
var id := ""
var _visual_key := ""
var shell_mi: MeshInstance3D
var roof_mi: MeshInstance3D
var interior_mi: MeshInstance3D
var extras_mi: MeshInstance3D
var scaffold_mi: MeshInstance3D
var glass_mi: MeshInstance3D
var body: StaticBody3D
var area: Area3D
var terminal: Interactable
var repair_spot: Interactable
var lights: Array[OmniLight3D] = []
var door_light: OmniLight3D
var player_inside := false
var height := 3.4
var _cache := {}
var _seed := 0

func setup(d: Dictionary) -> void:
	def = d
	id = d.id
	name = "B_" + id
	_seed = hash(id)
	var p: Vector2 = d.pos
	position = Vector3(p.x, 0, p.y)
	add_to_group("buildings")
	var open: bool = d.get("open", false) or d.kind == "tower"
	shell_mi = _mi("Shell")
	roof_mi = _mi("Roof")
	interior_mi = _mi("Interior")
	extras_mi = _mi("Upgrades")
	scaffold_mi = _mi("Scaffold")
	glass_mi = _mi("Glass")
	glass_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	interior_mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	body = StaticBody3D.new()
	body.name = "Body"
	body.collision_layer = 1
	body.collision_mask = 0
	add_child(body)
	# коллизии стен — по рабочему варианту (полная высота), одинаковы для всех состояний
	var cols: Array
	var interior: Dictionary
	if open:
		var site := BuildingGen.open_site(def, 0.0, _seed)
		cols = site.col
		interior = BuildingGen.interior(def, false, _seed + 3)
	else:
		var sh := BuildingGen.shell(def, 0.0, _seed)
		_cache["shell_0"] = sh
		cols = sh.col
		height = sh.height
		interior = BuildingGen.interior(def, Game.building_level(id) == 0, _seed + 3)
	for c in cols + interior.col:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = c[1]
		cs.shape = bs
		cs.transform = c[0]
		body.add_child(cs)
	interior_mi.mesh = (interior.mb as MeshBuilder).build(Mats.world(true))
	# интерьерный объём (скрытие крыши)
	if not open:
		area = Area3D.new()
		area.name = "Inside"
		area.collision_layer = 0
		area.collision_mask = 2
		area.monitorable = false
		var acs := CollisionShape3D.new()
		var abs := BoxShape3D.new()
		var size: Vector2 = def.size
		abs.size = Vector3(size.x - 0.6, 2.8, size.y - 0.6)
		acs.shape = abs
		acs.position = Vector3(0, 1.4, 0)
		area.add_child(acs)
		add_child(area)
		area.body_entered.connect(_on_enter)
		area.body_exited.connect(_on_exit)
		for lp in interior.lights:
			var l := OmniLight3D.new()
			l.position = lp
			l.omni_range = 9.0
			l.light_energy = 1.4
			l.light_color = Color(1.0, 0.86, 0.62)
			l.shadow_enabled = false
			l.visible = false
			add_child(l)
			lights.append(l)
	# лампа над входом
	var di := BuildingGen.door_info(def)
	door_light = OmniLight3D.new()
	door_light.position = (di.pos as Vector3) + (di.out as Vector3) * 1.2 + Vector3(0, 3.0, 0)
	door_light.omni_range = 8.0
	door_light.light_energy = 1.2
	door_light.light_color = Color(1.0, 0.8, 0.55)
	door_light.visible = false
	add_child(door_light)
	# терминал (панель здания)
	terminal = BuildingTerminal.new()
	terminal.building = self
	terminal.position = interior.terminal
	add_child(terminal)
	# точка ремонта у входа
	repair_spot = RepairSpot.new()
	repair_spot.building = self
	repair_spot.position = (di.pos as Vector3) + (di.out as Vector3) * (2.0 if not open else 0.0)
	if open:
		repair_spot.position = interior.terminal + Vector3(0, 0, 1.0)
	add_child(repair_spot)
	# двери
	if not open:
		_make_doors()
	refresh()
	Events.building_changed.connect(_on_changed)
	Events.power_changed.connect(func(_on): _update_lights())

func _mi(n: String) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	m.name = n
	add_child(m)
	return m

func _make_doors() -> void:
	var size: Vector2 = def.size
	var hangar: bool = def.get("hangar", false)
	var di := BuildingGen.door_info(def)
	var dp: Vector3 = di.pos
	var out: Vector3 = di.out
	var along := Vector3(-out.z, 0, out.x)
	var spots: Array = []
	if hangar:
		if def.kind != "garage":
			spots.append([dp + along * 4.2, 1.6])
	else:
		spots.append([dp, 1.6])
	if def.kind == "barracks":
		spots.append([dp + Vector3(0, 0, 12.0), 1.6])
	for s in spots:
		var door := Door.new()
		door.door_id = "%s_%d" % [id, spots.find(s)]
		door.width = s[1]
		door.position = s[0]
		door.rotation.y = atan2(out.x, out.z)
		add_child(door)

func level() -> int:
	return Game.building_level(id)

func job() -> String:
	return Game.building_job(id)

func refresh() -> void:
	var lvl := level()
	var jb := job()
	var key := "%d_%s" % [lvl, jb]
	if key == _visual_key:
		_update_lights()
		return
	_visual_key = key
	var open: bool = def.get("open", false) or def.kind == "tower"
	var ruin := 1.0 if lvl == 0 else 0.0
	var ck := "shell_%d" % (0 if ruin <= 0.0 else 1)
	if not _cache.has(ck):
		if open:
			_cache[ck] = BuildingGen.open_site(def, ruin, _seed)
		else:
			_cache[ck] = BuildingGen.shell(def, ruin, _seed)
	var sh: Dictionary = _cache[ck]
	shell_mi.mesh = (sh.shell as MeshBuilder).build(Mats.world(true))
	if sh.has("glass") and not (sh.glass as MeshBuilder).is_empty():
		glass_mi.mesh = (sh.glass as MeshBuilder).build(Mats.world(true))
		glass_mi.visible = true
	else:
		glass_mi.visible = false
	roof_mi.mesh = (sh.roof as MeshBuilder).build(Mats.world(true))
	roof_mi.visible = not player_inside
	# леса при работах
	if jb != "":
		if not _cache.has("scaffold"):
			_cache["scaffold"] = BuildingGen.scaffold(def, height if not open else 3.0)
		scaffold_mi.mesh = (_cache["scaffold"] as MeshBuilder).build(Mats.world(true))
		scaffold_mi.visible = true
	else:
		scaffold_mi.visible = false
	# улучшения
	if lvl >= 2 and not open:
		if not _cache.has("upg"):
			var rng := RandomNumberGenerator.new()
			rng.seed = _seed + 9
			_cache["upg"] = BuildingGen.upgrades(def, height, rng)
		extras_mi.mesh = (_cache["upg"] as MeshBuilder).build(Mats.world(true))
		extras_mi.visible = true
	else:
		extras_mi.visible = false
	# интерьер: мусор в разрушенном состоянии
	if not open:
		var interior := BuildingGen.interior(def, lvl == 0, _seed + 3)
		interior_mi.mesh = (interior.mb as MeshBuilder).build(Mats.world(true))
	_update_lights()

func _update_lights() -> void:
	var on := Game.power_on and level() >= 1
	var night := Game.is_night() or Game.time_of_day < 7.0 or Game.time_of_day > 19.0
	for l in lights:
		l.visible = on and Settings.preset().lights
	door_light.visible = on and night and Settings.preset().lights

func _on_changed(bid: String) -> void:
	if bid == id:
		refresh()

func _on_enter(b: Node) -> void:
	if b == Game.player:
		player_inside = true
		roof_mi.visible = false
		Events.area_visited.emit("inside_" + id)

func _on_exit(b: Node) -> void:
	if b == Game.player:
		player_inside = false
		roof_mi.visible = true

func center() -> Vector3:
	return global_position

func work_point() -> Vector3:
	return repair_spot.global_position

func entrance() -> Vector3:
	var di := BuildingGen.door_info(def)
	return to_global((di.pos as Vector3) + (di.out as Vector3) * 2.0)
