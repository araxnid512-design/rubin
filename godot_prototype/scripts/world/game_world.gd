class_name GameWorld
extends Node3D
## Игровой мир «База Долга»: строит локацию 300×300 м, навигацию, интерактивные объекты, актёров.

signal progress(p: float, text: String)
signal ready_to_play

const L = preload("res://scripts/world/layout.gd")

var builder: WorldBuilder
var buildings := {}
var nav_region: NavigationRegion3D
var nav_mesh: NavigationMesh
var _nav_source: NavigationMeshSourceGeometryData3D
var _nav_baking := false
var _nav_dirty := false
var day_night: DayNight
var player: Node3D
var camera: Node3D
var soldiers := {}
var enemy_groups: Array = []
var fx: Node3D
var actors_root: Node3D
var objects_root: Node3D
var grass_nodes: Array = []
var cover_points: PackedVector3Array = PackedVector3Array()
var stats := {}
var build_ms := {}

func build_async(spawn_actors: bool = true) -> void:
	Game.world = self
	Mats.init_textures()
	var t := Time.get_ticks_msec()
	progress.emit(0.05, "Планировка территории…")
	await get_tree().process_frame
	builder = WorldBuilder.new(self)
	builder.build_splat()
	MapView.build_texture(builder.splat)
	build_ms["splat"] = Time.get_ticks_msec() - t
	progress.emit(0.15, "Земля и дороги…")
	await get_tree().process_frame
	t = Time.get_ticks_msec()
	builder.build_ground()
	builder.build_perimeter()
	builder.build_roads()
	build_ms["ground_perimeter"] = Time.get_ticks_msec() - t
	progress.emit(0.3, "Разрушенные постройки и техника…")
	await get_tree().process_frame
	t = Time.get_ticks_msec()
	builder.build_props()
	_build_ruins()
	build_ms["props"] = Time.get_ticks_msec() - t
	progress.emit(0.45, "Растительность…")
	await get_tree().process_frame
	t = Time.get_ticks_msec()
	builder.build_vegetation()
	stats = builder.finalize(Settings.draw_distance)
	grass_nodes = stats.get("grass_nodes", [])
	apply_quality()
	build_ms["vegetation_finalize"] = Time.get_ticks_msec() - t
	progress.emit(0.6, "Здания базы…")
	await get_tree().process_frame
	t = Time.get_ticks_msec()
	_build_buildings()
	build_ms["buildings"] = Time.get_ticks_msec() - t
	progress.emit(0.7, "Освещение и аномалии…")
	await get_tree().process_frame
	_build_lights_and_fx()
	_build_objects()
	progress.emit(0.8, "Навигационная сетка…")
	await get_tree().process_frame
	t = Time.get_ticks_msec()
	await _bake_nav_initial()
	_build_cover_points()
	build_ms["navmesh"] = Time.get_ticks_msec() - t
	progress.emit(0.92, "Личный состав…")
	await get_tree().process_frame
	if spawn_actors and has_method("_spawn_actors"):
		call("_spawn_actors")
	Settings.changed.connect(apply_quality)
	progress.emit(1.0, "Готово")
	print("[World] build times (ms): ", build_ms, " stats: verts=", stats.get("verts"), " fol=", stats.get("fol_verts"), " boxes=", stats.get("boxes"), " grass=", stats.get("grass"))
	ready_to_play.emit()

func apply_quality() -> void:
	for g in grass_nodes:
		var mm: MultiMesh = (g as MultiMeshInstance3D).multimesh
		mm.visible_instance_count = int(mm.instance_count * Settings.grass_density)
	for n in get_tree().get_nodes_in_group("chunk_mesh"):
		(n as GeometryInstance3D).visibility_range_end = Settings.draw_distance

# ----------------------------------------------------------------------
func _build_ruins() -> void:
	var node := Node3D.new()
	node.name = "Ruins"
	add_child(node)
	for r in L.RUINS:
		var d: Dictionary = r.duplicate()
		d["kind"] = "ruin"
		d["floors"] = 1
		var sh := BuildingGen.shell(d, 1.0, hash(r.id))
		var p: Vector2 = r.pos
		var xf := Transform3D(Basis(), Vector3(p.x, 0, p.y))
		var mb := builder.mb_at(xf.origin)
		mb.append_builder(sh.shell, xf)
		# от крыши остаются только отдельные плиты
		mb.append_builder(sh.roof, xf)
		var rng := RandomNumberGenerator.new()
		rng.seed = hash(r.id) + 1
		var inner := BuildingGen.debris_inside(d, rng)
		mb.append_builder(inner, xf)
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.015, 0)), Vector3(p.x * 0 + (r.size as Vector2).x - 0.3, 0.03, (r.size as Vector2).y - 0.3), Color(0.38, 0.36, 0.33, 0.0), true)
		for c in sh.col:
			builder.col.append([xf * (c[0] as Transform3D), c[1]])
	# дымовая труба и прочее уже добавлены в build_props

func _build_buildings() -> void:
	var node := Node3D.new()
	node.name = "Buildings"
	add_child(node)
	for d in L.BUILDINGS:
		var b := Building.new()
		node.add_child(b)
		b.setup(d)
		buildings[d.id] = b

func _build_lights_and_fx() -> void:
	fx = FX.new()
	fx.name = "FX"
	add_child(fx)
	day_night = DayNight.new()
	day_night.name = "DayNight"
	add_child(day_night)
	day_night.setup()
	var ln := Node3D.new()
	ln.name = "Lamps"
	add_child(ln)
	for p in builder.lamp_points:
		var l := Lamp.new()
		l.position = p
		ln.add_child(l)
	for p in builder.fire_points:
		var f := FireBarrel.new()
		f.position = p
		ln.add_child(f)
	for a in L.ANOMALIES:
		var an := Anomaly.new()
		an.kind = a.kind
		an.radius = a.r
		an.position = a.pos
		ln.add_child(an)
	for s in builder.signs:
		var lb := Label3D.new()
		lb.text = s.text
		lb.font_size = 96
		lb.pixel_size = 0.01
		lb.outline_size = 18
		lb.modulate = Color(0.95, 0.85, 0.5)
		lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lb.position = (s.pos as Vector3) + Vector3(0, 3.2, 0)
		ln.add_child(lb)
	# таблички на зданиях
	for d in L.BUILDINGS:
		if d.kind == "tower":
			continue
		var di := BuildingGen.door_info(d)
		var lb := Label3D.new()
		lb.text = String(d.name).to_upper()
		lb.font_size = 64
		lb.pixel_size = 0.008
		lb.outline_size = 12
		lb.modulate = Color(0.92, 0.9, 0.82)
		var p: Vector2 = d.pos
		lb.position = Vector3(p.x, 0, p.y) + (di.pos as Vector3) + (di.out as Vector3) * 0.25 + Vector3(0, 2.75 if not d.get("hangar", false) else 4.1, 0)
		lb.rotation.y = atan2((di.out as Vector3).x, (di.out as Vector3).z)
		if d.get("open", false):
			lb.position = Vector3(p.x, 3.2, p.y)
			lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		ln.add_child(lb)

func _build_objects() -> void:
	objects_root = Node3D.new()
	objects_root.name = "Objects"
	add_child(objects_root)
	var ws: Dictionary = Game.world_state
	for c in L.CONTAINERS:
		var lc := LootContainer.new()
		lc.container_id = c.id
		lc.title = c.name
		lc.kind = c.kind
		lc.items = (c.items as Dictionary).duplicate()
		lc.position = c.pos
		objects_root.add_child(lc)
	var i := 0
	for s in L.SALVAGE:
		var sid := "salv_%d" % i
		i += 1
		if ws.salvage.has(sid):
			continue
		var sv := Salvage.new()
		sv.salvage_id = sid
		sv.res_id = s[1]
		sv.amount = s[2]
		sv.position = s[0]
		objects_root.add_child(sv)
	i = 0
	for p in L.PICKUPS:
		var pid := "pick_%d" % i
		i += 1
		if ws.taken.has(pid):
			continue
		var pk := Pickup.new()
		pk.pickup_id = pid
		pk.item_id = p[1]
		pk.count = p[2]
		pk.position = p[0]
		objects_root.add_child(pk)
	for ip in L.INSPECT:
		var pt := InspectPoint.new()
		pt.point_id = ip.id
		pt.text = ip.text
		pt.position = ip.pos
		objects_root.add_child(pt)
	for e in L.EXITS:
		var ez := ExitZone.new()
		ez.exit_id = e.id
		ez.title = e.name
		ez.position = e.pos
		objects_root.add_child(ez)
	for d in L.BUILDINGS:
		if d.get("rubble", false) and not ws.rubble.has(d.id):
			var r := Rubble.new()
			r.building_id = d.id
			var di := BuildingGen.door_info(d)
			var p: Vector2 = d.pos
			r.position = Vector3(p.x, 0, p.y) + (di.pos as Vector3) + (di.out as Vector3) * 1.3
			objects_root.add_child(r)

# ----------------------------------------------------------------------
#   НАВИГАЦИЯ
# ----------------------------------------------------------------------
func _make_navmesh() -> NavigationMesh:
	var nm := NavigationMesh.new()
	nm.cell_size = 0.25
	nm.cell_height = 0.25
	nm.agent_radius = 0.25
	nm.agent_height = 1.8
	nm.agent_max_climb = 0.3
	nm.agent_max_slope = 40.0
	nm.region_min_size = 4.0
	nm.edge_max_error = 1.3
	nm.geometry_parsed_geometry_type = NavigationMesh.PARSED_GEOMETRY_STATIC_COLLIDERS
	return nm

static func _box_faces(xf: Transform3D, size: Vector3, out: PackedVector3Array) -> void:
	var h := size * 0.5
	var c := [Vector3(-h.x, -h.y, -h.z), Vector3(h.x, -h.y, -h.z), Vector3(h.x, h.y, -h.z), Vector3(-h.x, h.y, -h.z),
		Vector3(-h.x, -h.y, h.z), Vector3(h.x, -h.y, h.z), Vector3(h.x, h.y, h.z), Vector3(-h.x, h.y, h.z)]
	var w: Array = []
	for v in c:
		w.append(xf * (v as Vector3))
	var quads := [[0, 1, 2, 3], [5, 4, 7, 6], [4, 0, 3, 7], [1, 5, 6, 2], [3, 2, 6, 7], [4, 5, 1, 0]]
	for q in quads:
		out.append(w[q[0]]); out.append(w[q[1]]); out.append(w[q[2]])
		out.append(w[q[0]]); out.append(w[q[2]]); out.append(w[q[3]])

func _collect_nav_source() -> NavigationMeshSourceGeometryData3D:
	var src := NavigationMeshSourceGeometryData3D.new()
	var faces := PackedVector3Array()
	# земля
	var hh := 149.5
	faces.append_array([Vector3(-hh, 0, -hh), Vector3(hh, 0, -hh), Vector3(hh, 0, hh), Vector3(-hh, 0, -hh), Vector3(hh, 0, hh), Vector3(-hh, 0, hh)])
	for c in builder.col:
		_box_faces(c[0], c[1], faces)
	for b in buildings.values():
		var bn := b as Building
		for cs in bn.body.get_children():
			var shape := (cs as CollisionShape3D).shape as BoxShape3D
			if shape:
				_box_faces(bn.global_transform * (cs as CollisionShape3D).transform, shape.size, faces)
	for o in get_tree().get_nodes_in_group("nav_obstacles"):
		if o.has_method("nav_box") and not o.is_queued_for_deletion():
			var nb: Array = o.nav_box()
			_box_faces(nb[0], nb[1], faces)
	for lc in objects_root.get_children():
		if lc is LootContainer:
			for ch in lc.get_children():
				if ch is StaticBody3D:
					for cs in ch.get_children():
						var shape := (cs as CollisionShape3D).shape as BoxShape3D
						if shape:
							_box_faces((lc as Node3D).global_transform * (cs as CollisionShape3D).transform, shape.size, faces)
	src.add_faces(faces, Transform3D.IDENTITY)
	return src

func _bake_nav_initial() -> void:
	nav_region = NavigationRegion3D.new()
	nav_region.name = "Navigation"
	add_child(nav_region)
	nav_mesh = _make_navmesh()
	_nav_source = _collect_nav_source()
	var done := [false]
	NavigationServer3D.bake_from_source_geometry_data_async(nav_mesh, _nav_source, func(): done[0] = true)
	while not done[0]:
		await get_tree().process_frame
	nav_region.navigation_mesh = nav_mesh
	# дождаться синхронизации карты навигации, чтобы ИИ сразу получил пути
	for i in 3:
		await get_tree().physics_frame
	NavigationServer3D.map_force_update(nav_map())
	print("[Nav] polygons: ", nav_mesh.get_polygon_count(), " vertices: ", nav_mesh.get_vertices().size())

# ----------------------------------------------------------------------
#   УКРЫТИЯ
# ----------------------------------------------------------------------
func _build_cover_points() -> void:
	## Точки у высоких препятствий (машины, контейнеры, стены, углы зданий), достижимые по навмешу.
	var boxes: Array = builder.col.duplicate()
	for b in buildings.values():
		var bn := b as Building
		for cs in bn.body.get_children():
			var shape := (cs as CollisionShape3D).shape as BoxShape3D
			if shape:
				boxes.append([bn.global_transform * (cs as CollisionShape3D).transform, shape.size])
	var map := nav_map()
	for c in boxes:
		var xf: Transform3D = c[0]
		var sz: Vector3 = c[1]
		if sz.y < 1.5 or maxf(sz.x, sz.z) > 16.0 or xf.origin.y - sz.y * 0.5 > 0.5:
			continue
		for d in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
			var ext: float = sz.x * 0.5 if d.x != 0.0 else sz.z * 0.5
			var p: Vector3 = xf * (d * (ext + 0.8))
			p.y = 0.0
			var np := NavigationServer3D.map_get_closest_point(map, p)
			if Vector2(np.x - p.x, np.z - p.z).length() < 0.4:
				cover_points.append(Vector3(np.x, 0.0, np.z))
	print("[World] укрытий: ", cover_points.size())

func find_cover(from: Vector3, threat: Vector3, max_d: float = 12.0) -> Variant:
	## Ближайшая точка, закрытая от угрозы препятствием.
	var cands: Array = []
	for p in cover_points:
		var d := Vector2(p.x - from.x, p.z - from.z).length()
		if d < max_d and d > 0.5:
			cands.append([d, p])
	cands.sort_custom(func(a, b): return a[0] < b[0])
	var space := get_world_3d().direct_space_state
	var n := 0
	for c in cands:
		if n >= 8:
			break
		n += 1
		var p: Vector3 = c[1]
		var q := PhysicsRayQueryParameters3D.create(threat + Vector3(0, 1.2, 0), p + Vector3(0, 1.2, 0), 1)
		if not space.intersect_ray(q).is_empty():
			return p
	return null

func request_nav_rebake() -> void:
	if _nav_baking:
		_nav_dirty = true
		return
	_nav_baking = true
	var nm := _make_navmesh()
	var src := _collect_nav_source()
	NavigationServer3D.bake_from_source_geometry_data_async(nm, src, func():
		nav_region.navigation_mesh = nm
		nav_mesh = nm
		_nav_baking = false
		Events.nav_rebaked.emit()
		if _nav_dirty:
			_nav_dirty = false
			request_nav_rebake())

func nav_map() -> RID:
	return get_world_3d().navigation_map

func _spawn_actors() -> void:
	actors_root = Node3D.new()
	actors_root.name = "Actors"
	add_child(actors_root)
	var p := Player.new()
	p.name = "General"
	actors_root.add_child(p)
	player = p
	var cam := GameCamera.new()
	cam.name = "Camera"
	cam.target = p
	add_child(cam)
	cam.current = true
	camera = cam
	for d in L.SOLDIERS:
		if not Game.soldiers[d.id].get("alive", true):
			pass
		var s := Soldier.new()
		s.setup_soldier(d)
		actors_root.add_child(s)
		soldiers[d.id] = s
	for g in L.ENEMY_GROUPS:
		var eg := EnemyGroup.new()
		eg.setup(g)
		actors_root.add_child(eg)
		enemy_groups.append(eg)

func write_state() -> void:
	for id in soldiers:
		var s = soldiers[id]
		if is_instance_valid(s):
			s.write_state()
