class_name ULLair
extends ULConvoy
## «Логово муров» — вражеский стаб 200×200 м по утверждённой карте: двор в кольце ограды из бетонных блоков (с
## заплатами из профлиста и покрышками), на юге — проход без ворот, к нему ведёт грунтовка. На севере — штаб
## (главное здание с красным знаменем-волком): коридор и ряд комнат у задней стены — кабинет главаря (≥ 12×10 м,
## там оружейный сундук), канцелярия, оружейная, радиорубка. На западе — казарма (кубрики с койками), на юго-западе —
## длинный склад, посередине слева — мастерская, справа — столовая с трубой, на юго-востоке — жилой блок, у восточной
## ограды — сарай, контейнер и прицеп, по углам у штаба — две вышки и водонапорный бак, посреди двора — костёр с
## лавками, вокруг — грузовики, штабеля ящиков и бочки; за оградой — лес. Во все постройки можно зайти (крыша
## скрывается, стены срезаются). Враги — вооружённые муры и главарь (ULEnemy, виды mur_ak, mur_sg, mur_boss).

const L_CFG := "res://data/lair.json"
const L_NAV := "res://assets/world/nav_lair.res"
const L_MASK := "res://assets/world/tex/lair_mask.png"
const L_CACHE := "res://assets/world/lair_blocks.res"
const L_TITLE := "Логово муров"
const L_ENTRY := Vector3(0.0, 0, 92.0)
## ограда: скруглённый прямоугольник (x от −FX до FX, z от FZ0 до FZ1, радиус углов FR); проход на юге — |x| < GAP
const FX := 80.0
const FZ0 := -72.0
const FZ1 := 70.0
const FR := 22.0
const GAP := 7.5

const L_BUILDINGS := [
	# штаб: коридор вдоль фасада и ряд комнат у северной стены; кабинет главаря — 13 × 10,6 м
	{"id": "hq", "n": "Штаб", "kind": "hq", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 3.2, "te": 0.2, "plinth_h": 0.5, "plinth_mat": "brick", "antenna": true,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.5, "ov": 0.45, "shutters": false,
		"blocks": [{"c": Vector2(0, -55), "L": 30.0, "W": 16.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 10.6,
			"row": [["m_boss", 13.0], ["m_office", 6.0], ["m_armory", 5.5], ["m_radio", 5.5]], "hall_type": "m_hall",
			"entr": [["s+", 0.0, 1.6, "porch"], ["e+", 2.5, 1.1, "plain"]], "win_w": 1.0, "win_h": 1.0, "sill": 1.1}]},
	# казарма: бетонные стены, пять кубриков у западной стены, коридор к двору
	{"id": "barracks", "n": "Казарма", "kind": "barracks", "skin": "plaster", "int": "int_grey1", "storey": 3.0,
		"blocks": [{"c": Vector2(-60, -18), "L": 30.0, "W": 11.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.4,
			"row": [["m_bunk", 6.0], ["m_bunk", 6.0], ["m_bunk", 6.0], ["m_bunk", 6.0], ["m_bunk", 6.0]], "hall_type": "m_hall",
			"entr": [["s+", -8.0, 1.4], ["s+", 8.0, 1.4]], "win_w": 1.2, "win_h": 1.1, "sill": 1.0}]},
	{"id": "warehouse", "n": "Склад", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.6, "te": 0.15,
		"roof_mat": "rust", "gable": "planks", "rise": 0.4, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-46, 22), "L": 34.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.6,
			"row": [["store", 8.5], ["m_armory", 8.5], ["store", 8.5], ["store", 8.5]], "hall_type": "warehouse",
			"entr": [["s+", -6.0, 3.0, "plain"], ["s+", 9.0, 1.2, "plain"], ["e+", 2.0, 1.2, "plain"]], "win_w": 0.9, "win_h": 0.6, "sill": 1.9}]},
	{"id": "workshop", "n": "Мастерская", "kind": "workshop", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.2, "te": 0.15,
		"roof_mat": "rust", "gable": "planks", "rise": 0.45, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-14, -22), "L": 14.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.8,
			"row": [["store", 7.0], ["store", 7.0]], "hall_type": "workshop",
			"entr": [["s+", -2.0, 2.6, "plain"], ["e-", 1.5, 1.1, "plain"]], "win_w": 0.9, "win_h": 0.7, "sill": 1.5}]},
	# столовая с кухней (труба — от печи)
	{"id": "mess", "n": "Столовая", "kind": "mess", "style": "wood", "skin": "planks_brown", "int": "int_beige", "storey": 3.2, "te": 0.2, "plinth_h": 0.4,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.5, "ov": 0.4, "shutters": false,
		"blocks": [{"c": Vector2(44, -30), "L": 22.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.6,
			"row": [["kitchen", 8.0], ["pantry", 6.0], ["store", 8.0]], "hall_type": "dining",
			"entr": [["s+", 4.0, 1.6, "porch"], ["e-", 1.0, 1.1, "plain"]], "win_w": 1.2, "win_h": 1.1, "sill": 0.9}]},
	# жилой блок: бетон, комнаты у южной стены, коридор к двору
	{"id": "quarters", "n": "Жилой блок", "kind": "quarters", "skin": "plaster", "int": "int_beige1", "storey": 3.0,
		"blocks": [{"c": Vector2(44, 36), "L": 28.0, "W": 13.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 7.6,
			"row": [["m_quarters", 7.0], ["m_quarters", 7.0], ["m_office", 7.0], ["m_quarters", 7.0]], "hall_type": "m_hall",
			"entr": [["s-", -6.0, 1.4], ["e-", 0.0, 1.2]], "win_w": 1.2, "win_h": 1.1, "sill": 1.0}]},
	{"id": "shed_nw", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.7, "te": 0.12,
		"roof_mat": "rust", "gable": "planks", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-40, -58), "L": 8.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.6, "plain"]], "blind": ["s-", "e-"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "shed_ne", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.6, "te": 0.12,
		"roof_mat": "roof_tin", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(38, -60), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.4, "plain"]], "blind": ["s-", "e+"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "shed_e", "n": "Навес-гараж", "kind": "shed", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 2.8, "te": 0.08,
		"roof_mat": "rust", "gate_mat": "gmetal",
		"blocks": [{"c": Vector2(62, 2), "L": 12.0, "W": 8.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["s-", 0.0, 3.0, "gate"]], "blind": ["s+", "e+"]}]},
	{"id": "hut", "n": "Будка", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.4, "te": 0.1,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.4, "ov": 0.25, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-36, -5), "L": 4.0, "W": 3.2, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.0, "plain"]], "blind": ["s-", "e+", "e-"]}]},
	{"id": "tent", "n": "Палатка", "kind": "tent", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.1, "te": 0.1,
		"blocks": [{"c": Vector2(-32, -36), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_live",
			"entr": [["s+", 0.0, 1.6, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "container", "n": "Контейнер", "kind": "shed", "style": "box", "skin": "armygreen", "int": "gmetal", "storey": 2.4, "te": 0.08,
		"blocks": [{"c": Vector2(22, 40), "L": 6.1, "W": 2.6, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e-", 0.0, 1.8, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

## грунтовки: с юга через проход к костру, кольцо вокруг костра, к постройкам
const L_TRACKS := [
	[Vector2(0, 104), Vector2(0, 70), Vector2(0, 40), Vector2(0, 25)],
	[Vector2(0, -9), Vector2(0, -30), Vector2(0, -46)],
	[Vector2(-12, -3), Vector2(-30, -12), Vector2(-52, -18)],
	[Vector2(-13, 18), Vector2(-28, 15), Vector2(-46, 15)],
	[Vector2(13, -2), Vector2(28, -14), Vector2(42, -23)],
	[Vector2(13, 17), Vector2(28, 26), Vector2(42, 28)],
	[Vector2(0, -30), Vector2(-22, -34), Vector2(-38, -48), Vector2(-52, -52)],
	[Vector2(0, -30), Vector2(24, -36), Vector2(40, -50), Vector2(52, -54)],
	[Vector2(30, -15), Vector2(50, -6), Vector2(57, 2)],
]
const L_FIRE := Vector3(0, 0, 8)
const L_LOOP_R := 16.0
const L_TOWERS := [Vector3(-62, 0, -58), Vector3(58, 0, -60)]
const L_TANK := Vector3(67, 0, -40)
## техника: [модель, где, поворот, длина, что обыскать, вид тайника]
const L_VEHICLES := [
	["ural", Vector3(-40, 0, 46), 1.45],
	["gaz66", Vector3(26, 0, -4), 0.2],
	["uaz", Vector3(-24, 0, 56), -0.4],
]
const L_CRATES := [[Vector3(-22, 0, 40), 5, true], [Vector3(32, 0, 16), 4, true], [Vector3(-21, 0, -6), 3, false], [Vector3(-10, 0, -43), 4, true],
	[Vector3(13, 0, -43), 3, false], [Vector3(-10, 0, 14), 2, false], [Vector3(54, 0, 22), 3, true]]

static var _lcfg := {}
var towers: Array = []                  ## по вышке: {c, roof}
var chest_pos := Vector3.INF            ## оружейный сундук главаря (кабинет в штабе)
var chest_yaw := 0.0
var chest_node: Node3D
var boss_pos := Vector3.INF             ## где стоит главарь (середина кабинета)
var boss_room := Rect2()                ## кабинет главаря на плане (мир, x–z): из него он не выходит
var patrol_routes: Array = []           ## маршруты дозоров: [PackedVector3Array]
var banner_mat: StandardMaterial3D


static func lcfg() -> Dictionary:
	if _lcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(L_CFG))
		_lcfg = d if d is Dictionary else {}
	return _lcfg


func conf() -> Dictionary:
	return lcfg()


func entry() -> Vector3:
	return L_ENTRY


func title() -> String:
	return L_TITLE


func spawn_limit() -> float:
	return FX + 2.0


static func l_sig() -> int:
	return hash(str(L_BUILDINGS) + "|" + str(ULBlock.GEN_V) + "|l1")


func build(world: Node3D) -> void:
	w = world
	half = float(conf().get("size", 200.0)) * 0.5
	body = StaticBody3D.new()
	body.name = "LairBody"
	var fn := FastNoiseLite.new()
	fn.seed = 419
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7341
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "lrbake" and ResourceLoader.exists(L_CACHE):
		var r = load(L_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == l_sig():
			cache = r
		else:
			push_warning("логово: кэш построек устарел — пересоберите --as-test=lrbake")
	var made := {}
	for d in L_BUILDINGS:
		var b := ULBlock.new()
		add_child(b)
		var st0 := rng.state
		b.build(d, rng, cache.blds.get(String(d.id), {}) if cache != null else {})
		if cache == null:
			made[String(d.id)] = b.to_cache()
			made[String(d.id)]["rng0"] = st0
		for c in b.cols:
			_col_xf(c[0], c[1])
		blds.append(b)
		barns.append({"node": b, "id": b.id, "n": b.title})
		for dd in b.doors:
			doors.append(dd)
			var k := _cell(dd.center)
			if not _door_grid.has(k):
				_door_grid[k] = []
			_door_grid[k].append(dd)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_l_forest(rng)
	_l_ground()
	_l_fence(props, rng)
	for tc in L_TOWERS:
		_l_tower(props, tc)
	_l_tank(props)
	_l_camp(props, rng)
	_l_vehicles()
	_l_crates(props, rng)
	_l_banners()
	_l_boss_room()
	_flush(props)
	_c_forest_props(7171, 10, 6)
	_c_vegetation()
	_l_spots(rng)
	_l_patrols()
	_light_pool()
	add_child(body)
	if w.test == "lrbake":
		var cr := ULBlockCache.new()
		cr.sig = l_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, L_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек логова: %s (%s)" % [L_CACHE, error_string(err)])
	print("[lair] логово собрано: %d мс, построек %d, столкновений %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), _count_cont(), extra.size()])


# ---------------- расстояния и зоны ----------------

## до ограды (скруглённый прямоугольник): < 0 — внутри
func fence_sd(q: Vector2) -> float:
	var cz := (FZ0 + FZ1) * 0.5
	var hz := (FZ1 - FZ0) * 0.5
	var d := Vector2(absf(q.x) - (FX - FR), absf(q.y - cz) - (hz - FR))
	return Vector2(maxf(d.x, 0.0), maxf(d.y, 0.0)).length() + minf(maxf(d.x, d.y), 0.0) - FR


func inside_fence(q: Vector2, m := 0.0) -> bool:
	return fence_sd(q) < -m


func road_dist(q: Vector2) -> float:
	return track_dist(q)


func track_dist(q: Vector2) -> float:
	var d := 1e9
	for t in L_TRACKS:
		for i in t.size() - 1:
			d = minf(d, _seg_dist(q, t[i], t[i + 1]))
	d = minf(d, absf(q.distance_to(Vector2(L_FIRE.x, L_FIRE.z)) - L_LOOP_R))
	return d


## двор внутри ограды — утоптанная земля
func clear_w(q: Vector2) -> float:
	var f := fence_sd(q)
	return (1.0 - smoothstep(-6.0, -1.0, f)) * 0.8


func pave_dist(q: Vector2) -> float:
	return track_dist(q) - 1.6


func forest_ok(q: Vector2) -> bool:
	return fence_sd(q) > 4.0 and q.distance_to(Vector2(L_ENTRY.x, L_ENTRY.z)) > 9.0 and absf(q.x) > 5.5 or q.y < FZ0 - 4.0


func forest_n() -> int:
	return 520


# ---------------- лес и земля ----------------

## лес за оградой до края карты и ещё ряд за ним; ели — одной сеткой, остальные — модели
func _l_forest(rng: RandomNumberGenerator) -> void:
	var kinds := []
	for k in [["ul_pine", 0.3, 4.2, 5.8], ["ul_birch", 0.16, 4.2, 5.6], ["ul_oak", 0.14, 4.2, 5.2], ["ul_dead_tree", 0.06, 3.4, 4.6]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3], String(k[0])])
	var pts: Array = []
	var tries := 0
	var lim := half + 9.0
	while pts.size() < forest_n() and tries < 9000:
		tries += 1
		var q := Vector2(rng.randf_range(-lim, lim), rng.randf_range(-lim, lim))
		var inside := absf(q.x) < half - 2.0 and absf(q.y) < half - 2.0
		if not forest_ok(q) or track_dist(q) < 4.5:
			continue
		if _noise(q / 45.0 + Vector2(0.3, 0.7)) < 0.4 and rng.randf() < 0.7:
			continue
		var ok := true
		for pp in pts:
			if (pp[0] as Vector3).distance_to(Vector3(q.x, 0, q.y)) < 3.0:
				ok = false
				break
		if ok:
			pts.append([Vector3(q.x, 0, q.y), inside])
	for pp in pts:
		var p: Vector3 = pp[0]
		wood_pts.append(p)
		var pick := rng.randf()
		var chosen = null
		var acc := 0.34
		if pick >= acc:
			for k in kinds:
				acc += float(k[1])
				if pick < acc:
					chosen = k
					break
		if chosen == null:
			_spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.85, 1.25)), p))
		else:
			_tree(chosen[0], p, rng.randf_range(float(chosen[2]), float(chosen[3])), rng.randf() * TAU, String(chosen[4]))
		if pp[1]:
			_cyl_col(p, 0.22, 3.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true
	mm.mesh = w._spruce_mesh(5.0, 141)
	mm.instance_count = _spruce_xf.size()
	for i in _spruce_xf.size():
		mm.set_instance_transform(i, _spruce_xf[i])
		mm.set_instance_color(i, Color.WHITE)
		mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
	w.canopy.add_multimesh(mm, 5.0)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	add_child(mi)
	# валуны в лесу
	var rock: ArrayMesh = w._rock_mesh(37)
	var xs: Array[Transform3D] = []
	for k in 40:
		var q := Vector2(rng.randf_range(-half + 4, half - 4), rng.randf_range(-half + 4, half - 4))
		if not forest_ok(q) or track_dist(q) < 4.0:
			continue
		var s := rng.randf_range(0.5, 1.9) if k > 10 else rng.randf_range(1.6, 2.8)
		xs.append(Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.2, 0.2), rng.randf() * TAU, rng.randf_range(-0.2, 0.2))).scaled(Vector3(s, s * rng.randf_range(0.55, 0.9), s * rng.randf_range(0.8, 1.2))), Vector3(q.x, s * 0.12, q.y)))
		if s > 0.9:
			_cyl_col(Vector3(q.x, 0, q.y), s * 0.42, s * 0.7)
	var rm := MultiMesh.new()
	rm.transform_format = MultiMesh.TRANSFORM_3D
	rm.mesh = rock
	rm.instance_count = xs.size()
	for i in xs.size():
		rm.set_instance_transform(i, xs[i])
	var rmi := MultiMeshInstance3D.new()
	rmi.multimesh = rm
	var rmat := ULHouse._mat(TEX + "rock_boulder_dry", 1.2)
	rmat.albedo_color = Color(0.5, 0.5, 0.45)
	rmi.material_override = rmat
	add_child(rmi)


func _l_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_material(half * 2.0, "brown_mud_02", "brown_mud_02", Vector3(0.84, 0.78, 0.68), 1.0, 0.35, "dirt", "dirt")
	sm.set_shader_parameter("noise", _noise_tex)
	sm.set_shader_parameter("grass_mul", Vector3(0.8, 0.9, 0.62))
	sm.set_shader_parameter("path_mul", Vector3(0.86, 0.78, 0.68))
	if ResourceLoader.exists(L_MASK) and w.test != "lrbake":
		mask = (load(L_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _l_bake_mask()
		if w.test == "lrbake":
			mask.save_png(ProjectSettings.globalize_path(L_MASK))
			print("[bake] карта земли логова: ", L_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	add_child(mi)
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(520, 520)
	out.mesh = om
	var omat := ULHouse._mat(TEX + "mud_forest", 3.5)
	omat.albedo_color = Color(0.6, 0.6, 0.54)
	out.material_override = omat
	out.position.y = -0.05
	add_child(out)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(520, 0.2, 520)
	cs.shape = bs
	cs.position.y = -0.1
	body.add_child(cs)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, half * 2.0 + 2) if s.x != 0.0 else Vector3(half * 2.0 + 2, 4, 1)
		wc.shape = b
		wc.position = s * (half + 9.0) + Vector3.UP * 2.0
		body.add_child(wc)
	ULGroundDetail.ruts(self, L_TRACKS, _noise_tex, "brown_mud_02")
	ULGroundDetail.patches(self, [[L_FIRE, 4.0], [Vector3(-40, 0, 46), 3.0], [Vector3(26, 0, -4), 2.5]], "worn_asphalt", _noise_tex)
	ULGroundDetail.puddles(self, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		if bld_dist(q) < 1.5:
			return false
		return track_dist(q) < 1.6 and _noise(q / 6.0 + Vector2(0.2, 0.4)) > 0.55, half * 2.0, 73, 700, _noise_tex)


func _l_bake_mask() -> Image:
	var n := 512
	var tpts: Array = []
	for t in trees:
		tpts.append([t.position, 1.6])
	for xf in _spruce_xf:
		tpts.append([xf.origin, 1.5 * xf.basis.get_scale().x])
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for iy in n:
		for ix in n:
			var p := Vector2((ix + 0.5) / n - 0.5, (iy + 0.5) / n - 0.5) * half * 2.0
			var n1 := _noise(p / 60.0)
			var n2 := _noise(p / 17.0 + Vector2(0.37, 0.11))
			var n3 := _noise(p / 5.5 + Vector2(0.71, 0.53))
			var track := 1.0 - smoothstep(1.2, 2.6, track_dist(p) + (n3 - 0.5) * 0.9)
			var clr := clear_w(p) * smoothstep(0.15, 0.5, n2 * 0.6 + n3 * 0.4 + clear_w(p) * 0.45)
			var path := maxf(track, clr * 0.9)
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- ограда ----------------

## точка на ограде по доле обхода 0..1 (по часовой, начиная от прохода с востока)
func _fence_pts(step: float) -> Array:
	var cz := (FZ0 + FZ1) * 0.5
	var hz := (FZ1 - FZ0) * 0.5
	var pts: Array = []
	# дуги углов и прямые: собираем ломаной, затем режем на равные куски
	var poly: Array = []
	var corners := [Vector2(FX - FR, cz + hz - FR), Vector2(-(FX - FR), cz + hz - FR), Vector2(-(FX - FR), cz - hz + FR), Vector2(FX - FR, cz - hz + FR)]
	# от прохода на запад по южной стороне, дальше — кругом до прохода с востока
	poly.append(Vector2(-GAP, FZ1))
	var order := [[corners[1], PI * 0.5, PI], [corners[2], PI, PI * 1.5], [corners[3], PI * 1.5, TAU], [corners[0], 0.0, PI * 0.5]]
	for o in order:
		var c0: Vector2 = o[0]
		for k in 9:
			var a := lerpf(float(o[1]), float(o[2]), k / 8.0)
			poly.append(c0 + Vector2(cos(a), sin(a)) * FR)
	poly.append(Vector2(GAP, FZ1))
	var acc := 0.0
	for i in poly.size() - 1:
		var a: Vector2 = poly[i]
		var b: Vector2 = poly[i + 1]
		var l := a.distance_to(b)
		var t := acc
		while t < l:
			var p := a.lerp(b, t / l)
			var dir := (b - a) / l
			pts.append([p, atan2(-dir.y, dir.x)])
			t += step
		acc = t - l
	return pts


## ограда: бетонные блоки (ФБС) в один ряд, кое-где — в два яруса, заплаты из ржавого профлиста и покрышки
func _l_fence(g: Node3D, rng: RandomNumberGenerator) -> void:
	var pts := _fence_pts(2.45)
	var tyres := 0
	for i in pts.size():
		var p: Vector2 = pts[i][0]
		var yaw: float = pts[i][1]
		var at := Vector3(p.x, 0, p.y)
		var roll := _noise(p / 9.0 + Vector2(0.13, 0.71))
		if roll > 0.68:
			# заплата: лист профнастила на столбах
			var b := Basis(Vector3.UP, yaw)
			_bx(g, "rust", Vector3(2.5, 2.0, 0.06), Transform3D(b * Basis(Vector3.FORWARD, rng.randf_range(-0.04, 0.04)), at + Vector3.UP * 1.05))
			for sx in [-1.2, 1.2]:
				_bx(g, "wood", Vector3(0.1, 2.2, 0.1), Transform3D(b, at + b * Vector3(sx, 1.1, -0.1)))
			_col_xf(Vector3(2.5, 2.0, 0.3), Transform3D(b, at + Vector3.UP * 1.0))
		else:
			_block(g, at, yaw, false)
			if roll < 0.32:
				# второй ярус
				var b2 := Basis(Vector3.UP, yaw + rng.randf_range(-0.05, 0.05))
				_bx(g, "plinth", Vector3(2.4, 0.9, 0.6), Transform3D(b2, at + Vector3.UP * 1.35))
				_col_xf(Vector3(2.4, 0.9, 0.6), Transform3D(b2, at + Vector3.UP * 1.35))
		if roll > 0.45 and roll < 0.52 and tyres < 18:
			tyres += 1
			var inn := -Vector2(p.x, p.y - (FZ0 + FZ1) * 0.5).normalized()
			_tyre_stack(g, at + Vector3(inn.x, 0, inn.y) * 1.0, rng.randi_range(2, 4))
	# у прохода: опрокинутый блок, мешки с песком, бочки
	_block(g, Vector3(-11.5, 0, FZ1 - 3.0), 0.6, true)
	_sandbags(g, Vector3(10.5, 0, FZ1 - 3.5), 0.3, 3, rng)
	_sandbags(g, Vector3(-10.0, 0, FZ1 - 6.5), -0.4, 3, rng)


func _tyre_stack(g: Node3D, at: Vector3, n: int) -> void:
	for k in n:
		_cy(g, "leather", 0.42, 0.42, 0.22, _at(at + Vector3(0, 0.11 + k * 0.22, 0)), 10)
	_cyl_col(at, 0.42, n * 0.22)


# ---------------- вышки и бак ----------------

## вышка (как в конвое): площадка 3,3 м, марш, перила, навес; наверху — снайпер
func _l_tower(g: Node3D, c: Vector3) -> void:
	var hh := 3.3
	for sx in [-1.7, 1.7]:
		for sz in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.22, hh + 2.4, 0.22), _at(c + Vector3(sx, (hh + 2.4) * 0.5, sz)))
			_cyl_col(c + Vector3(sx, 0, sz), 0.14, hh)
	for k in 2:
		for sx in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.08, 0.16, 4.6), Transform3D(Basis(Vector3.RIGHT, 0.75 * (1.0 if k == 0 else -1.0)), c + Vector3(sx, 1.65, 0)))
	_bx(g, "wood", Vector3(3.8, 0.14, 3.8), _at(c + Vector3(0, hh - 0.07, 0)), true)
	var sgn := 1.0 if c.x < 0.0 else -1.0                  # марш — в сторону двора
	for e in [[Vector3(0, 0, -1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(0, 0, 1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(-1.85 * sgn, 0, 0), Vector3(0.08, 0.08, 3.8)], [Vector3(1.85 * sgn, 0, 1.0), Vector3(0.08, 0.08, 1.8)]]:
		var sz: Vector3 = e[1]
		_bx(g, "wood", sz, _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 1.0)))
		_bx(g, "wood", Vector3(sz.x, 0.5, sz.z), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.35)))
		_col_xf(Vector3(maxf(sz.x, 0.1), 1.1, maxf(sz.z, 0.1)), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.55)))
	var x0 := 1.9 * sgn
	var x1 := 7.0 * sgn
	var zc := -0.9
	var n := 18
	for i in n:
		var t0 := float(i) / n
		var xa := lerpf(x1, x0, t0)
		var xb := lerpf(x1, x0, t0 + 1.0 / n)
		_bx(g, "wood", Vector3(absf(xa - xb) + 0.02, 0.06, 1.4), _at(c + Vector3((xa + xb) * 0.5, hh * (t0 + 1.0 / n) - 0.03, zc)))
	var run := absf(x1 - x0)
	for szz in [-0.75, 0.75]:
		_bx(g, "wood", Vector3(sqrt(run * run + hh * hh), 0.2, 0.08), Transform3D(Basis(Vector3.FORWARD, -atan2(hh, run) * sgn), c + Vector3((x0 + x1) * 0.5, hh * 0.5 - 0.12, zc + szz)))
	var pts := PackedVector3Array()
	for z in [zc - 0.7, zc + 0.7]:
		pts.append(c + Vector3(x1, 0, z))
		pts.append(c + Vector3(x0, 0, z))
		pts.append(c + Vector3(x0, hh, z))
	var cs := CollisionShape3D.new()
	var sh := ConvexPolygonShape3D.new()
	sh.points = pts
	cs.shape = sh
	body.add_child(cs)
	var roof := Node3D.new()
	add_child(roof)
	_bx(roof, "rust", Vector3(4.6, 0.08, 4.6), _at(c + Vector3(0, hh + 2.45, 0)))
	_bx(roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, -1.7)))
	_bx(roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, 1.7)))
	_flush(roof)
	# прожектор
	var lamp := c + Vector3(-1.5 * sgn, hh + 1.2, -1.5)
	_cy(g, "metal", 0.16, 0.12, 0.3, Transform3D(Basis(Vector3.RIGHT, -1.2), lamp), 8)
	towers.append({"c": c, "roof": roof, "top": c + Vector3(0.4 * sgn, hh, 0.3)})
	var cp := c + Vector3(-1.2 * sgn, hh, 1.2)
	_c_model_box(MODELS + "ul_army_crate.glb", cp, 0.3, 0.9, Color(0.85, 0.85, 0.8), "ul_army_crate", false)
	extra.append({"pos": cp, "size": Vector3(0.9, 0.45, 0.5), "yaw": 0.3, "kind": "mil_ammo", "n": "Ящик снайпера"})


## водонапорный бак на опорах
func _l_tank(g: Node3D) -> void:
	var c := L_TANK
	for a in 4:
		var ang := PI * 0.25 + a * PI * 0.5
		var lp := c + Vector3(cos(ang), 0, sin(ang)) * 1.5
		_bx(g, "rust", Vector3(0.16, 4.2, 0.16), _at(lp + Vector3.UP * 2.1))
		_cyl_col(lp, 0.12, 4.0)
	_cy(g, "gmetal", 1.9, 1.9, 3.2, _at(c + Vector3(0, 5.8, 0)), 18)
	_cy(g, "rust", 1.95, 0.25, 0.7, _at(c + Vector3(0, 7.75, 0)), 18)
	_bx(g, "rust", Vector3(0.1, 3.6, 0.1), _at(c + Vector3(1.4, 2.0, 1.4)))


# ---------------- двор ----------------

## костёр с лавками кругом, бочки и ящики рядом
func _l_camp(g: Node3D, rng: RandomNumberGenerator) -> void:
	_fire(L_FIRE)
	for k in 10:
		var a := TAU * k / 10.0
		_bx(g, "rubble", Vector3(0.34, 0.2, 0.3), _at(L_FIRE + Vector3(cos(a), 0.1, sin(a)) * 1.05, a))
	_cyl_col(L_FIRE, 1.0, 0.4)
	for k in 6:
		var a := TAU * k / 6.0 + 0.3
		var p := L_FIRE + Vector3(cos(a), 0, sin(a)) * 5.0
		var yaw := -a + PI * 0.5
		_bx(g, "wood", Vector3(2.0, 0.08, 0.4), _at(p + Vector3.UP * 0.46, yaw))
		for sx in [-0.8, 0.8]:
			_bx(g, "wood", Vector3(0.1, 0.44, 0.34), Transform3D(Basis(Vector3.UP, yaw), p + Basis(Vector3.UP, yaw) * Vector3(sx, 0.22, 0)))
		_col_xf(Vector3(2.0, 0.5, 0.4), _at(p + Vector3.UP * 0.25, yaw))
	for bp in [Vector3(7.5, 0, 3.0), Vector3(8.3, 0, 3.6), Vector3(-7.0, 0, 11.5), Vector3(5.5, 0, 14.0)]:
		var p: Vector3 = L_FIRE + bp
		if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
			_cyl_col(p, 0.32, 0.9)
	for cp in [Vector3(-8.5, 0, -3.0), Vector3(7.0, 0, 11.0)]:
		var p: Vector3 = L_FIRE + cp
		_c_model_box(MODELS + "ul_army_crate.glb", p, rng.randf() * TAU, 1.0, Color(0.85, 0.85, 0.8), "ul_army_crate", true)


func _l_vehicles() -> void:
	for v in L_VEHICLES:
		var vm: Array = C_VMODELS[String(v[0])]
		var at: Vector3 = v[1]
		var yaw: float = v[2]
		var size := _c_model_box(MODELS + String(vm[0]) + ".glb", at, yaw, float(vm[1]), vm[2], String(vm[0]), true)
		extra.append({"pos": at, "size": size, "yaw": yaw, "kind": "truck" if String(v[0]) != "uaz" else "cab", "n": String(vm[3])})


## штабеля армейских ящиков и бочки с топливом по двору
func _l_crates(g: Node3D, rng: RandomNumberGenerator) -> void:
	for cc in L_CRATES:
		var base: Vector3 = cc[0]
		var n: int = cc[1]
		var yaw := rng.randf() * TAU
		var b := Basis(Vector3.UP, yaw)
		var top := 0.0
		for i in n:
			var lv := 0 if i < (n + 1) / 2 else 1
			var col := i if lv == 0 else i - (n + 1) / 2
			var p := base + b * Vector3(col * 1.08 + (0.5 if lv == 1 else 0.0), 0, 0) + Vector3.UP * lv * 0.42
			var sz := _c_model_box(MODELS + "ul_army_crate.glb", p, yaw + rng.randf_range(-0.12, 0.12), 1.0, Color(0.85, 0.85, 0.8), "ul_army_crate", lv == 0)
			top = maxf(top, p.y + sz.y)
		if cc[2]:
			var w0 := ((n + 1) / 2) * 1.08
			extra.append({"pos": base + b * Vector3(w0 * 0.5 - 0.54, 0, 0), "size": Vector3(w0, top, 0.7), "yaw": yaw, "kind": "mil_ammo" if rng.randf() < 0.5 else "mil_gear", "n": "Армейские ящики"})
	for grp in [[Vector3(-26, 0, 30), 6], [Vector3(30, 0, -42), 5], [Vector3(-8, 0, 30), 4], [Vector3(56, 0, -14), 4]]:
		var base: Vector3 = grp[0]
		for k in int(grp[1]):
			var p := base + Vector3((k % 3) * 0.75, 0, (k / 3) * 0.75)
			if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
				_cyl_col(p, 0.32, 0.9)
		extra.append({"pos": base + Vector3(0.75, 0, 0.4), "size": Vector3(2.3, 0.95, 1.6), "yaw": 0.0, "kind": "fuel", "n": "Бочки"})
	# куча хлама у жилого блока и кострище с дровами
	for k in 6:
		_bx(g, "wood", Vector3(rng.randf_range(0.8, 1.8), 0.12, 0.14), _at(Vector3(10 + rng.randf_range(-1, 1), 0.08 + k * 0.05, 42 + rng.randf_range(-1, 1)), rng.randf() * TAU))


# ---------------- знамёна ----------------

## красное знамя с белой головой волка: по бокам двери штаба и на вышках
func _l_banners() -> void:
	banner_mat = StandardMaterial3D.new()
	banner_mat.albedo_texture = ImageTexture.create_from_image(_wolf_banner())
	banner_mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	banner_mat.roughness = 0.9
	var hq: ULBlock = blds[0]
	var bk: Dictionary = hq.blocks[0]
	var fz: float = (bk.c as Vector2).y + float(bk.W) * 0.5 + 0.06
	for bx in [-3.4, 3.4]:
		_banner(Vector3(float((bk.c as Vector2).x) + bx, 0, fz), 0.0, Vector2(1.5, 2.3), 0.85)
	for t in towers:
		var c: Vector3 = t.c
		_banner(c + Vector3(0, 0, 1.9), 0.0, Vector2(1.2, 1.5), 3.4)


func _banner(at: Vector3, yaw: float, size: Vector2, y0: float) -> void:
	var mi := MeshInstance3D.new()
	var qm := QuadMesh.new()
	qm.size = size
	mi.mesh = qm
	mi.material_override = banner_mat
	mi.position = at + Vector3.UP * (y0 + size.y * 0.5)
	mi.rotation.y = yaw
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	# перекладина
	var rod := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.025
	cm.bottom_radius = 0.025
	cm.height = size.x + 0.2
	rod.mesh = cm
	rod.material_override = _mat("wood")
	rod.position = at + Vector3.UP * (y0 + size.y + 0.03)
	rod.rotation = Vector3(0, yaw, PI * 0.5)
	add_child(rod)


## рисунок знамени: тёмно-красное полотно, кайма, белая голова волка с красными глазами, низ — «ласточкин хвост»
static func _wolf_banner() -> Image:
	var wd := 128
	var ht := 192
	var im := Image.create(wd, ht, false, Image.FORMAT_RGBA8)
	var head := PackedVector2Array([Vector2(0.5, 0.74), Vector2(0.41, 0.67), Vector2(0.31, 0.53), Vector2(0.2, 0.43), Vector2(0.25, 0.38),
		Vector2(0.16, 0.31), Vector2(0.23, 0.27), Vector2(0.2, 0.08), Vector2(0.37, 0.21), Vector2(0.5, 0.25), Vector2(0.63, 0.21),
		Vector2(0.8, 0.08), Vector2(0.77, 0.27), Vector2(0.84, 0.31), Vector2(0.75, 0.38), Vector2(0.8, 0.43), Vector2(0.69, 0.53), Vector2(0.59, 0.67)])
	var eye_l := PackedVector2Array([Vector2(0.33, 0.39), Vector2(0.45, 0.43), Vector2(0.37, 0.45)])
	var eye_r := PackedVector2Array([Vector2(0.67, 0.39), Vector2(0.55, 0.43), Vector2(0.63, 0.45)])
	var nose := PackedVector2Array([Vector2(0.45, 0.6), Vector2(0.55, 0.6), Vector2(0.5, 0.66)])
	var fn := FastNoiseLite.new()
	fn.seed = 77
	fn.frequency = 0.05
	for y in ht:
		for x in wd:
			var u := (x + 0.5) / wd
			var v := (y + 0.5) / ht
			# хвост: вырез треугольником снизу
			if v > 0.86 and absf(u - 0.5) < (v - 0.86) / 0.14 * 0.5:
				im.set_pixel(x, y, Color(0, 0, 0, 0))
				continue
			var n := fn.get_noise_2d(x, y) * 0.5 + 0.5
			var c := Color(0.48, 0.05, 0.04).lerp(Color(0.62, 0.1, 0.07), n)
			if u < 0.06 or u > 0.94 or v < 0.04:
				c = Color(0.25, 0.03, 0.02)
			var q := Vector2(u, v * 1.0)
			if Geometry2D.is_point_in_polygon(q, head):
				c = Color(0.92, 0.9, 0.86).lerp(Color(0.75, 0.73, 0.7), n * 0.6)
				if Geometry2D.is_point_in_polygon(q, eye_l) or Geometry2D.is_point_in_polygon(q, eye_r):
					c = Color(0.7, 0.04, 0.03)
				elif Geometry2D.is_point_in_polygon(q, nose):
					c = Color(0.12, 0.1, 0.1)
			im.set_pixel(x, y, c)
	im.generate_mipmaps()
	return im


# ---------------- кабинет главаря ----------------

## кабинет главаря — комната m_boss штаба: середина (где он стоит), прямоугольник (откуда не выходит) и место
## оружейного сундука у дальней стены
func _l_boss_room() -> void:
	var hq: ULBlock = blds[0]
	for r in hq.rooms:
		if String(r.type) != "m_boss":
			continue
		var bk: Dictionary = hq.blocks[int(r.bi)]
		var u0 := float(r.u0)
		var u1 := float(r.u1)
		var v0 := float(r.v0)
		var v1 := float(r.v1)
		var a := hq._w(bk, u0, 0.0, v0)
		var b := hq._w(bk, u1, 0.0, v1)
		boss_room = Rect2(Vector2(minf(a.x, b.x), minf(a.z, b.z)), Vector2(absf(b.x - a.x), absf(b.z - a.z)))
		var side := int(r.get("side", -1))
		var ext_v := v0 if side < 0 else v1
		var inward := 1.0 if side < 0 else -1.0
		chest_pos = hq._w(bk, (u0 + u1) * 0.5, 0.0, ext_v + inward * 0.55)
		chest_yaw = 0.0 if inward > 0.0 else PI
		boss_pos = hq._w(bk, (u0 + u1) * 0.5 + 2.5, 0.0, (v0 + v1) * 0.5 + inward * 1.6)
		break
	if chest_pos == Vector3.INF:
		push_warning("логово: в штабе нет кабинета главаря")
		return
	chest_node = _chest_model(chest_pos, chest_yaw)


## оружейный сундук: окованный металлический ящик с замком (столкновение — коробка)
func _chest_model(at: Vector3, yaw: float) -> Node3D:
	var g := Node3D.new()
	g.name = "WeaponChest"
	add_child(g)
	g.position = at
	g.rotation.y = yaw
	var body_m := StandardMaterial3D.new()
	body_m.albedo_color = Color(0.22, 0.26, 0.2)
	body_m.metallic = 0.5
	body_m.roughness = 0.55
	var band := StandardMaterial3D.new()
	band.albedo_color = Color(0.32, 0.3, 0.27)
	band.metallic = 0.85
	band.roughness = 0.4
	var lock_m := StandardMaterial3D.new()
	lock_m.albedo_color = Color(0.85, 0.66, 0.25)
	lock_m.metallic = 0.9
	lock_m.roughness = 0.3
	var parts := [[Vector3(1.3, 0.55, 0.62), Vector3(0, 0.275, 0), body_m], [Vector3(1.34, 0.12, 0.66), Vector3(0, 0.6, 0), body_m],
		[Vector3(0.06, 0.68, 0.68), Vector3(-0.5, 0.34, 0), band], [Vector3(0.06, 0.68, 0.68), Vector3(0.5, 0.34, 0), band],
		[Vector3(1.36, 0.05, 0.68), Vector3(0, 0.08, 0), band], [Vector3(0.16, 0.16, 0.04), Vector3(0, 0.46, 0.34), lock_m]]
	for p in parts:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = p[0]
		mi.mesh = bm
		mi.position = p[1]
		mi.material_override = p[2]
		mi.layers = 2                       # внутри штаба: солнце не освещает (как мебель)
		g.add_child(mi)
	_col_xf(Vector3(1.34, 0.66, 0.66), Transform3D(Basis(Vector3.UP, yaw), at + Vector3.UP * 0.33))
	return g


# ---------------- враги ----------------

## места снаружи: у костра, у прохода, вдоль ограды, двор; в постройках — по их видам (_extra_pools)
func _l_spots(rng: RandomNumberGenerator) -> void:
	for k in 700:
		var q := Vector2(rng.randf_range(-FX, FX), rng.randf_range(FZ0, FZ1))
		if not inside_fence(q, 2.0) or bld_dist(q) < 1.2:
			continue
		var tag := "yard"
		if q.distance_to(Vector2(L_FIRE.x, L_FIRE.z)) < 12.0:
			tag = "camp"
		elif q.distance_to(Vector2(0, FZ1)) < 16.0:
			tag = "gap"
		elif fence_sd(q) > -6.0:
			tag = "fence"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


## дозоры: по кругу вдоль ограды (два — в разные стороны), вокруг костра и от прохода к штабу
func _l_patrols() -> void:
	patrol_routes.clear()
	var ring := PackedVector3Array()
	for pp in _fence_pts(9.0):
		var p: Vector2 = pp[0]
		var inn := Vector2(p.x, p.y - (FZ0 + FZ1) * 0.5).normalized()
		var q := p - inn * 7.0
		if bld_dist(q) > 2.0:
			ring.append(Vector3(q.x, 0, q.y))
	patrol_routes.append(ring)
	var rev := ring.duplicate()
	rev.reverse()
	patrol_routes.append(rev)
	var loop := PackedVector3Array()
	for k in 10:
		var a := TAU * k / 10.0
		loop.append(L_FIRE + Vector3(cos(a), 0, sin(a)) * L_LOOP_R)
	patrol_routes.append(loop)
	patrol_routes.append(PackedVector3Array([Vector3(0, 0, FZ1 - 4.0), Vector3(0, 0, 30), Vector3(-12, 0, -2), Vector3(0, 0, -36), Vector3(14, 0, -2), Vector3(0, 0, 30)]))


func _zone_pools(pools: Dictionary) -> void:
	_extra_pools(pools)


func _extra_pools(pools: Dictionary) -> void:
	for kz in ["hq", "barracks", "warehouse", "workshop", "mess", "quarters", "sheds"]:
		pools[kz] = []
	for b in blds:
		var kind := String(b.def.get("kind", ""))
		var key := kind if pools.has(kind) else "sheds"
		for sp in b.spots:
			# в кабинете главаря — только он сам
			if String(sp[1]).contains(":m_boss:"):
				continue
			pools[key].append(sp[0])


## План появления: главарь (в своём кабинете), снайперы на вышках, дозоры (по двое), остальные — по зонам
## (zones_mur). Запись — [вид, где, зона]; у дозора зона «patrol:N» (N — маршрут), у снайпера «tower:N».
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var c := conf()
	var n := rng.randi_range(int(c.murs[0]), int(c.murs[1]))
	var mix: Dictionary = c.get("mix", {"mur_ak": 0.6, "mur_sg": 0.4})
	var out: Array = []
	var taken: Array[Vector3] = []
	var pick_kind := func() -> String:
		return "mur_ak" if rng.randf() < float(mix.get("mur_ak", 0.6)) / maxf(float(mix.get("mur_ak", 0.6)) + float(mix.get("mur_sg", 0.4)), 0.01) else "mur_sg"
	if boss_pos != Vector3.INF:
		var bq: Vector3 = snap.call(boss_pos)
		out.append(["mur_boss", Vector3(bq.x, boss_pos.y + 0.02, bq.z), "boss"])
		taken.append(bq)
	var ns := mini(int(c.get("snipers", 2)), towers.size())
	for i in ns:
		var tp: Vector3 = towers[i].top
		out.append(["mur_ak", tp + Vector3.UP * 0.05, "tower:%d" % i])
		taken.append(tp)
		n -= 1
	var np := mini(int(c.get("patrols", 3)), patrol_routes.size())
	for i in np:
		var route: PackedVector3Array = patrol_routes[i]
		var at := route[rng.randi() % route.size()]
		for m in 2:
			var p: Vector3 = snap.call(at + Vector3(m * 1.4, 0, m * 0.6))
			out.append([pick_kind.call(), Vector3(p.x, 0.02, p.z), "patrol:%d" % i])
			taken.append(p)
			n -= 1
	var pools := {}
	for i in yard_pts.size():
		var tg: String = _yard_tags[i]
		if not pools.has(tg):
			pools[tg] = []
		pools[tg].append(yard_pts[i])
	_zone_pools(pools)
	var zones: Dictionary = c.get("zones_mur", {"yard": 1})
	var sum := 0.0
	for z in zones:
		if not (pools.get(z, []) as Array).is_empty():
			sum += float(zones[z])
	var safe_r := float(c.get("safe_r", 30.0))
	for i in maxi(n, 0):
		for attempt in 50:
			var r := rng.randf() * sum
			var zone := ""
			for z in zones:
				if (pools.get(z, []) as Array).is_empty():
					continue
				r -= float(zones[z])
				if r <= 0.0:
					zone = z
					break
			if zone == "":
				continue
			var pool: Array = pools[zone]
			var p: Vector3 = pool[rng.randi() % pool.size()]
			p += Vector3(rng.randf_range(-0.6, 0.6), 0, rng.randf_range(-0.6, 0.6))
			if Vector2(p.x - L_ENTRY.x, p.z - L_ENTRY.z).length() < safe_r:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.45 or absf(q.y - p.y) > 0.4:
				continue
			var crowd := false
			for t in taken:
				if t.distance_to(q) < 1.6:
					crowd = true
					break
			if crowd or not body_fits(Vector3(q.x, p.y, q.z), 0.3, 1.5):
				continue
			taken.append(q)
			out.append([pick_kind.call(), Vector3(q.x, p.y + 0.02, q.z), zone])
			break
	return out


## тайники: в помещениях и вне их (вышки, техника, ящики, бочки)
func roll_containers(rng: RandomNumberGenerator) -> void:
	super.roll_containers(rng)


## хлам — только в постройках
func junk_points(rng: RandomNumberGenerator) -> Array:
	return junk_in_buildings(rng)


## герой на вышке — её навес скрыт
func tick(hero: Vector3, cam, delta: float) -> void:
	_tower_roof = null
	super.tick(hero, cam, delta)
	for t in towers:
		var c: Vector3 = t.c
		var on := not (hero.y > 2.2 and Vector2(hero.x - c.x, hero.z - c.z).length() < 3.2)
		var roof: Node3D = t.roof
		if on != roof.visible:
			roof.visible = on


## на какой вышке точка (−1 — ни на какой)
func tower_at(p: Vector3) -> int:
	for i in towers.size():
		var c: Vector3 = towers[i].c
		if p.y > 2.0 and Vector2(p.x - c.x, p.z - c.z).length() < 2.6:
			return i
	return -1
