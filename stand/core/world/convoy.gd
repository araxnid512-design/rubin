class_name ULConvoy
extends ULSanatorium
## «Разбитый конвой» — временный нестабильный кластер 150×150 м по картам пользователя: лесная дорога с юга на север
## (вход — снизу), посередине — место гибели колонны (сгоревшие «Уралы», БТР-80, ГАЗ-66, УАЗы), справа вверху —
## полевой лагерь (штабная, медицинская и две жилые палатки, штабной кунг, навес из маскировочной сети, костёр),
## справа — блокпост (бетонные блоки, мешки с песком, ежи, сторожевой пост), слева внизу — склад снабжения
## (контейнеры, штабеля ящиков, бочки, грузовик с кунгом), слева вверху — смотровая вышка (на неё можно подняться),
## справа внизу — разбитый Ми-8 среди поваленных деревьев. Вокруг — лес, камни, поваленные стволы.
## Палатки, кунг, пост и контейнер — ULBlock (в них можно зайти: крыша скрывается, стены срезаются); техника и тела —
## модели Tripo, технику и часть тел можно обыскать. Общее с санаторием (этаж героя, двери, свет, тайники, враги по
## зонам, Рубер) — от ULSanatorium. Баланс — data/convoy.json; карты земли и проходимости — --as-test=cvbake.

const C_CFG := "res://data/convoy.json"
const C_NAV := "res://assets/world/nav_convoy.res"
const C_MASK := "res://assets/world/tex/convoy_mask.png"
const C_CACHE := "res://assets/world/convoy_blocks.res"
const C_TITLE := "Разбитый конвой"
const C_ENTRY := Vector3(2.0, 0, 68.0)

## Палатки и помещения (описания — как у корпусов санатория; style tent — брезент, двускатная крыша, вход — полог;
## style box — металл, плоская крыша, дверь без крыльца)
const C_BUILDINGS := [
	{"id": "hq", "n": "Штабная палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.1, "te": 0.1,
		"blocks": [{"c": Vector2(34, -53), "L": 8.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_hq",
			"entr": [["s+", 0.0, 1.6, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "med", "n": "Медицинская палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.0, "te": 0.1, "cross": true,
		"blocks": [{"c": Vector2(51, -43), "L": 6.0, "W": 4.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_med",
			"entr": [["e+", 0.0, 1.4, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "live1", "n": "Жилая палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.0, "te": 0.1,
		"blocks": [{"c": Vector2(24, -45), "L": 6.0, "W": 4.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_live",
			"entr": [["e+", 0.0, 1.4, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "live2", "n": "Жилая палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.0, "te": 0.1,
		"blocks": [{"c": Vector2(47, -57), "L": 6.0, "W": 4.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_live",
			"entr": [["e-", 0.0, 1.4, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "kung", "n": "Командный кунг", "style": "box", "skin": "armygreen", "int": "panel", "storey": 2.3, "te": 0.1,
		"blocks": [{"c": Vector2(39, -35), "L": 6.4, "W": 2.8, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "kung",
			"entr": [["s+", -1.6, 1.0, "plain"]], "blind": ["s+", "e+", "e-"], "win_w": 0.8, "win_h": 0.5, "sill": 1.3}]},
	{"id": "post", "n": "Сторожевой пост", "style": "box", "skin": "plaster", "int": "int_grey1", "storey": 2.5, "te": 0.2,
		"blocks": [{"c": Vector2(50, 0), "L": 4.2, "W": 3.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "guard",
			"entr": [["e-", 0.0, 1.0, "plain"]], "win_w": 1.1, "win_h": 0.9, "sill": 1.0}]},
	{"id": "store", "n": "Складской контейнер", "style": "box", "skin": "rust", "int": "gmetal", "storey": 2.4, "te": 0.08,
		"blocks": [{"c": Vector2(-50, 36), "L": 6.1, "W": 2.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e+", 0.0, 1.8, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

const C_ROAD := [Vector2(2, 80), Vector2(1, 45), Vector2(-6, 18), Vector2(-5, -12), Vector2(3, -45), Vector2(5, -80)]
## грунтовые съезды: к лагерю, к блокпосту, к складу, к вышке
const C_TRACKS := [
	[Vector2(-5, -12), Vector2(16, -28), Vector2(36, -42)],
	[Vector2(-5, -4), Vector2(22, 2), Vector2(44, 3)],
	[Vector2(-6, 18), Vector2(-28, 32), Vector2(-44, 39)],
	[Vector2(-5, -20), Vector2(-28, -36), Vector2(-46, -44)],
]
## поляны (утоптанная земля): середина, радиус
const C_CLEAR := [[Vector2(38, -46), 21.0], [Vector2(48, 3), 12.0], [Vector2(-46, 40), 13.0], [Vector2(-50, -47), 8.0], [Vector2(46, 48), 12.0], [Vector2(-3, 4), 15.0]]
const C_TOWER := Vector3(-50, 0, -47)
const C_HELI := [Vector3(46, 0, 48), 0.6]
const C_FIRE := [Vector3(-5.5, 0, 3.0), Vector3(47.5, 0, 46.5)]
## техника: [вид, где, поворот]; модели — C_VMODELS: [файл, длина, оттенок, как называется при обыске, вид тайника,
## кабина — [ось модели вдоль машины, с какого конца кабина, доля длины, название]] (у грузовиков два тайника: кузов и кабина)
const C_VEHICLES := [
	["ural", Vector3(-15, 0, 31), 0.35], ["wreck", Vector3(-5.5, 0, 3.0), 0.5], ["wreck", Vector3(-1.5, 0, -29), -0.3],
	["btr", Vector3(4.5, 0, 15), 1.25], ["btr", Vector3(-22, 0, -7), -0.5], ["gaz66", Vector3(10.5, 0, -15), 0.2],
	["uaz", Vector3(-9, 0, 46), -0.7], ["uaz", Vector3(14, 0, -1), 1.9], ["kung", Vector3(-35, 0, 45), 1.3],
]
const C_VMODELS := {
	"ural": ["ul_ural", 7.4, Color(0.8, 0.8, 0.76), "Кузов «Урала»", "truck", ["x", 1.0, 0.38, "Кабина «Урала»"]], "wreck": ["ul_ural_wreck", 7.4, Color(0.7, 0.68, 0.66), "Сгоревший «Урал»", "wreck"],
	"btr": ["ul_btr", 7.6, Color(0.5, 0.56, 0.44), "БТР-80", "btr"], "gaz66": ["ul_gaz66", 5.6, Color(0.8, 0.8, 0.76), "Кузов ГАЗ-66", "truck", ["x", 1.0, 0.36, "Кабина ГАЗ-66"]],
	"uaz": ["ul_uaz", 4.0, Color(0.8, 0.8, 0.76), "УАЗ", "uaz"], "kung": ["ul_kung", 7.6, Color(0.8, 0.8, 0.76), "Кунг грузовика снабжения", "truck", ["z", -1.0, 0.36, "Кабина грузовика снабжения"]],
}
## тела военных: где, поворот, можно ли обыскать
const C_BODIES := [
	[Vector3(-2.5, 0, 7.5), 0.4, true], [Vector3(7.5, 0, 12.5), 2.1, true], [Vector3(-10, 0, -3), 1.2, false], [Vector3(12, 0, -19), 2.8, true],
	[Vector3(30, 0, -40), 0.9, true], [Vector3(41, 0, -48), 3.6, false], [Vector3(45, 0, 6), 1.7, true], [Vector3(-41, 0, 43), 4.4, true],
	[Vector3(42, 0, 44), 5.2, true], [Vector3(-46, 0, -43), 0.2, false], [Vector3(-13, 0, 26), 2.5, true],
]
## штабеля армейских ящиков: где, сколько, можно ли обыскать
const C_CRATES := [[Vector3(-43, 0, 34), 5, true], [Vector3(-55, 0, 43), 4, true], [Vector3(-40, 0, 47), 3, false], [Vector3(29, 0, -52), 3, true],
	[Vector3(44, 0, -39), 2, true], [Vector3(2, 0, 9), 2, true], [Vector3(-12, 0, -24), 2, false], [Vector3(55, 0, 5), 2, true], [Vector3(40, 0, 53), 2, true]]

static var _ccfg := {}
var extra: Array = []              ## тайники вне помещений: техника, тела, ящики — {pos, size, yaw, kind, n}
var _tower_roof: Node3D
var _fires: Array = []
var _zone_pts := {}


static func ccfg() -> Dictionary:
	if _ccfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(C_CFG))
		_ccfg = d if d is Dictionary else {}
	return _ccfg


func conf() -> Dictionary:
	return ccfg()


func entry() -> Vector3:
	return C_ENTRY


func title() -> String:
	return C_TITLE


func spawn_limit() -> float:
	return 71.0


static func c_sig() -> int:
	return hash(str(C_BUILDINGS) + "|" + str(ULBlock.GEN_V))


func build(world: Node3D) -> void:
	w = world
	half = float(conf().get("size", 150.0)) * 0.5
	body = StaticBody3D.new()
	body.name = "ConvoyBody"
	var fn := FastNoiseLite.new()
	fn.seed = 137
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 8813
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "cvbake" and ResourceLoader.exists(C_CACHE):
		var r = load(C_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == c_sig():
			cache = r
		else:
			push_warning("конвой: кэш помещений устарел — пересоберите --as-test=cvbake")
	var made := {}
	for d in C_BUILDINGS:
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
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_c_forest(rng)
	_c_ground()
	_c_vehicles()
	_c_camp(props, rng)
	_c_blockpost(props, rng)
	_c_supply(props, rng)
	_c_tower(props)
	_c_heli(props, rng)
	_c_bodies(rng)
	_c_debris(props, rng)
	_flush(props)
	_c_vegetation()
	_c_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "cvbake":
		var cr := ULBlockCache.new()
		cr.sig = c_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, C_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш помещений конвоя: %s (%s)" % [C_CACHE, error_string(err)])
	print("[conv] конвой собран: %d мс, столкновений %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, body.get_child_count(), _count_cont(), extra.size()])


# ---------------- расстояния ----------------

func road_dist(q: Vector2) -> float:
	var d := 1e9
	for i in C_ROAD.size() - 1:
		d = minf(d, _seg_dist(q, C_ROAD[i], C_ROAD[i + 1]))
	return d


func track_dist(q: Vector2) -> float:
	var d := 1e9
	for t in C_TRACKS:
		for i in t.size() - 1:
			d = minf(d, _seg_dist(q, t[i], t[i + 1]))
	return d


## насколько точка в поляне (0 — нет, 1 — середина)
func clear_w(q: Vector2) -> float:
	var v := 0.0
	for c in C_CLEAR:
		v = maxf(v, 1.0 - smoothstep(float(c[1]) * 0.7, float(c[1]), q.distance_to(c[0])))
	return v


## до края «покрытия» (для общего кода): дорога и съезды
func pave_dist(q: Vector2) -> float:
	return minf(road_dist(q) - 3.0, track_dist(q) - 1.6)


# ---------------- лес ----------------

## Лес по всей карте, кроме дороги, съездов и полян; за краем — ещё два ряда. Ели — одной сеткой, остальные — модели.
func _c_forest(rng: RandomNumberGenerator) -> void:
	var kinds := []
	for k in [["ul_pine", 0.3, 4.2, 5.6], ["ul_birch", 0.16, 4.2, 5.6], ["ul_oak", 0.14, 4.2, 5.2], ["ul_dead_tree", 0.06, 3.4, 4.6]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3], String(k[0])])
	var pts: Array = []
	var tries := 0
	while pts.size() < 330 and tries < 6000:
		tries += 1
		var q := Vector2(rng.randf_range(-84, 84), rng.randf_range(-84, 84))
		var inside := absf(q.x) < 73.0 and absf(q.y) < 73.0
		if road_dist(q) < 6.5 or track_dist(q) < 3.2 or clear_w(q) > 0.05 or bld_dist(q) < 3.5:
			continue
		if q.distance_to(Vector2(C_ENTRY.x, C_ENTRY.z)) < 8.0:
			continue
		# гуще — пятнами
		if _noise(q / 45.0 + Vector2(0.3, 0.7)) < 0.42 and rng.randf() < 0.75:
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
	# камни: валуны со столкновением и россыпь
	var rock: ArrayMesh = w._rock_mesh(31)
	var xs: Array[Transform3D] = []
	for k in 34:
		var q := Vector2(rng.randf_range(-70, 70), rng.randf_range(-70, 70))
		if road_dist(q) < 5.0 or track_dist(q) < 2.5 or bld_dist(q) < 3.0 or clear_w(q) > 0.5:
			continue
		var s := rng.randf_range(0.5, 1.9) if k > 8 else rng.randf_range(1.6, 2.8)
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
	rmi.material_override = ULHouse._mat(TEX + "rock_boulder_dry", 1.2)
	add_child(rmi)


# ---------------- земля ----------------

## Земля: трава и лесная подстилка, размокшая грязь на дороге, съездах и полянах; поверх — остатки асфальта на
## дороге (раскрошен), колеи с водой, лужи, пятна гари у сгоревшей техники и вертолёта.
func _c_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_material(half * 2.0, "brown_mud_02", "brown_mud_02", Vector3(0.82, 0.78, 0.7), 1.0, 0.35, "dirt", "dirt")
	sm.set_shader_parameter("noise", _noise_tex)
	sm.set_shader_parameter("grass_mul", Vector3(0.8, 0.92, 0.64))
	sm.set_shader_parameter("path_mul", Vector3(0.8, 0.76, 0.7))
	if ResourceLoader.exists(C_MASK) and w.test != "cvbake":
		mask = (load(C_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _c_bake_mask()
		if w.test == "cvbake":
			mask.save_png(ProjectSettings.globalize_path(C_MASK))
			print("[bake] карта земли конвоя: ", C_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	add_child(mi)
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(420, 420)
	out.mesh = om
	var omat := ULHouse._mat(TEX + "mud_forest", 3.5)
	omat.albedo_color = Color(0.6, 0.6, 0.54)
	out.material_override = omat
	out.position.y = -0.05
	add_child(out)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
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
	# остатки асфальта: полоса с сильно выкрошенными краями и дырами
	var pmat := _pave_mat("asphalt").duplicate() as ShaderMaterial
	pmat.set_shader_parameter("crumble", 1.5)
	pmat.set_shader_parameter("moss", 0.35)
	_pave_mats["broken"] = pmat
	_strip(C_ROAD, 5.6, 0.02, "broken")
	var roads: Array = [C_ROAD]
	for t in C_TRACKS:
		roads.append(t)
	ULGroundDetail.ruts(self, roads, _noise_tex, "brown_mud_02")
	var burnt: Array = []
	for f in C_FIRE:
		burnt.append([f, 4.5])
	burnt.append([Vector3(-1.5, 0, -29), 4.0])
	burnt.append([Vector3(38, 0, -44), 1.4])
	ULGroundDetail.patches(self, burnt, "worn_asphalt", _noise_tex)
	ULGroundDetail.puddles(self, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		if bld_dist(q) < 1.5:
			return false
		var rd := road_dist(q)
		if rd < 3.0:
			return _noise(q / 7.0) > 0.48
		return (track_dist(q) < 1.4 or clear_w(q) > 0.6) and _noise(q / 5.0 + Vector2(0.4, 0.2)) > 0.6, half * 2.0, 71, 900, _noise_tex)


func _c_bake_mask() -> Image:
	var n := 384
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
			var road := 1.0 - smoothstep(2.6, 4.6, road_dist(p) + (n3 - 0.5) * 1.4)
			var track := 1.0 - smoothstep(1.0, 2.2, track_dist(p) + (n3 - 0.5) * 0.8)
			var clr := clear_w(p) * smoothstep(0.25, 0.6, n2 * 0.6 + n3 * 0.4 + clear_w(p) * 0.35)
			var path := maxf(maxf(road, track), clr * 0.85)
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- техника ----------------

## Техника колонны — отдельные модели Tripo; столкновение — коробка по размеру; всю можно обыскать (кузов, кабина,
## отсек) — тайник размером с машину.
func _c_vehicles() -> void:
	for v in C_VEHICLES:
		var vm: Array = C_VMODELS[String(v[0])]
		var at: Vector3 = v[1]
		var yaw: float = v[2]
		var size := _c_model_box(MODELS + String(vm[0]) + ".glb", at, yaw, float(vm[1]), vm[2], String(vm[0]), true)
		if vm.size() < 6:
			extra.append({"pos": at, "size": size, "yaw": yaw, "kind": String(vm[4]), "n": String(vm[3])})
			continue
		# грузовик: кузов и кабина — два тайника
		var cab: Array = vm[5]
		var on_x := String(cab[0]) == "x"
		var along := (Vector3.RIGHT if on_x else Vector3.BACK) * float(cab[1])
		var len_l := size.x if on_x else size.z
		var fr := float(cab[2])
		var b := Basis(Vector3.UP, yaw)
		var body_sz := Vector3(len_l * (1.0 - fr), size.y, size.z) if on_x else Vector3(size.x, size.y, len_l * (1.0 - fr))
		var cab_sz := Vector3(len_l * fr, minf(size.y, 2.0), size.z) if on_x else Vector3(size.x, minf(size.y, 2.0), len_l * fr)
		extra.append({"pos": at - b * (along * len_l * fr * 0.5), "size": body_sz, "yaw": yaw, "kind": String(vm[4]), "n": String(vm[3])})
		extra.append({"pos": at + b * (along * len_l * (0.5 - fr * 0.5)), "size": cab_sz, "yaw": yaw, "kind": "cab", "n": String(cab[3])})


## модель по длине (наибольший размер по земле), с коробкой столкновения; возвращает её размер (в системе модели)
func _c_model_box(path: String, at: Vector3, yaw: float, length: float, tint: Color, key: String, collide: bool, by_height := false) -> Vector3:
	if not ResourceLoader.exists(path):
		var sz := Vector3(length, 1.6, length * 0.4)
		var g := Node3D.new()
		add_child(g)
		_bx(g, "rust", sz, Transform3D(Basis(Vector3.UP, yaw), at + Vector3.UP * 0.9), collide)
		_flush(g)
		return sz
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	var bb: AABB = w._aabb(n)
	var k := length / maxf(bb.size.y if by_height else maxf(bb.size.x, bb.size.z), 0.01)
	n.scale = Vector3.ONE * k
	n.position = at - Vector3(0, bb.position.y * k, 0)
	n.rotation.y = yaw
	add_child(n)
	_dirty(n, key, tint)
	if length < 2.5:
		# мелочь (ящики, тела): без тени и видна ближе — запас по треугольникам для телефона
		_cull(n, 42.0)
		for gi in n.find_children("*", "GeometryInstance3D", true, false):
			(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	else:
		_cull(n, 60.0)
	var size := bb.size * k
	if collide:
		var c := bb.get_center() * k
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(size.x * 0.9, maxf(size.y, 1.0), size.z * 0.9)
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at + Basis(Vector3.UP, yaw) * Vector3(c.x, maxf(size.y, 1.0) * 0.5, c.z))
		body.add_child(cs)
	return Vector3(size.x, minf(size.y, 2.4), size.z)


# ---------------- лагерь ----------------

## навес из маскировочной сети, костёр, генератор, прожектор, антенна, растяжки палаток
func _c_camp(g: Node3D, rng: RandomNumberGenerator) -> void:
	# навес: шесть жердей и сеть
	var nc := Vector3(31, 0, -38)
	for sx in [-2.6, 0.0, 2.6]:
		for sz in [-1.8, 1.8]:
			_bx(g, "wood", Vector3(0.08, 2.5, 0.08), _at(nc + Vector3(sx, 1.25, sz)))
			_cyl_col(nc + Vector3(sx, 0, sz), 0.08, 2.4)
	var net := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(6.2, 4.4)
	pm.subdivide_width = 6
	pm.subdivide_depth = 4
	net.mesh = pm
	net.material_override = _net_mat()
	net.position = nc + Vector3(0, 2.5, 0)
	net.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(net)
	# под навесом — стол с ящиками
	_bx(g, "wood", Vector3(2.2, 0.06, 0.9), _at(nc + Vector3(0, 0.78, 0)), false)
	for sx in [-1.0, 1.0]:
		_bx(g, "wood", Vector3(0.08, 0.76, 0.8), _at(nc + Vector3(sx, 0.38, 0)))
	_col_xf(Vector3(2.2, 0.8, 0.9), _at(nc + Vector3(0, 0.4, 0)))
	_bx(g, "gmetal", Vector3(0.5, 0.3, 0.35), _at(nc + Vector3(-0.5, 0.96, 0.05), 0.3))
	# костёр посреди лагеря: камни по кругу, головни, брёвна-сиденья
	var fc := Vector3(38, 0, -44)
	for k in 9:
		var a := TAU * k / 9.0
		_bx(g, "plinth", Vector3(0.3, 0.2, 0.24), _at(fc + Vector3(cos(a), 0, sin(a)) * 0.7 + Vector3.UP * 0.1, a))
	for k in 4:
		_bx(g, "roof", Vector3(0.9, 0.1, 0.12), _at(fc + Vector3(0, 0.08 + k * 0.03, 0), k * 0.8))
	for k in 3:
		var a := 0.6 + k * 2.1
		var lp := fc + Vector3(cos(a), 0, sin(a)) * 2.1
		_cy(g, "wood", 0.2, 0.2, 1.8, Transform3D(Basis(Vector3.UP, a + PI * 0.5) * Basis(Vector3.FORWARD, PI * 0.5), lp + Vector3.UP * 0.2), 8)
		_col_xf(Vector3(1.8, 0.4, 0.4), _at(lp + Vector3.UP * 0.2, -a + PI * 0.5))
	# генератор и прожектор
	var gp := Vector3(45, 0, -50)
	_bx(g, "gmetal", Vector3(1.3, 0.8, 0.7), _at(gp + Vector3(0, 0.5, 0), 0.4), true)
	_bx(g, "metal", Vector3(1.4, 0.08, 0.8), _at(gp + Vector3(0, 0.06, 0), 0.4))
	_bx(g, "rust", Vector3(0.12, 0.4, 0.12), _at(gp + Vector3(0.3, 1.1, 0), 0.4))
	var mp := Vector3(42, 0, -47)
	_bx(g, "metal", Vector3(0.07, 4.2, 0.07), _at(mp + Vector3(0, 2.1, 0)))
	for k in 3:
		var a := k * TAU / 3.0
		_bx(g, "metal", Vector3(0.04, 0.04, 1.5), Transform3D(Basis(Vector3.UP, a) * Basis(Vector3.RIGHT, 0.5), mp + Vector3(sin(a), 0, cos(a)) * 0.6 + Vector3.UP * 0.4))
	_bx(g, "wmetal", Vector3(0.7, 0.3, 0.2), _at(mp + Vector3(0, 4.1, 0.1), 0.5))
	_cyl_col(mp, 0.1, 3.0)
	# антенна и тарелка у кунга
	var ap := Vector3(43.5, 0, -34)
	_bx(g, "metal", Vector3(0.06, 6.0, 0.06), _at(ap + Vector3(0, 3.0, 0)))
	_cy(g, "wmetal", 0.7, 0.1, 0.25, Transform3D(Basis(Vector3.RIGHT, 1.0), ap + Vector3(0, 2.4, 0.3)), 14)
	_cyl_col(ap, 0.1, 3.0)
	# растяжки и колья у палаток
	for b in blds:
		if String(b.def.get("style", "")) != "tent":
			continue
		var r := b.rect
		for cx in [r.position.x - 0.9, r.end.x + 0.9]:
			for cz in [r.position.y - 0.9, r.end.y + 0.9]:
				_bx(g, "wood", Vector3(0.06, 0.4, 0.06), Transform3D(Basis(Vector3(1, 0, 0), 0.3), Vector3(cx, 0.18, cz)))
	# бочки и ящики россыпью
	for k in 8:
		var p := Vector3(rng.randf_range(24, 54), 0, rng.randf_range(-62, -32))
		if bld_dist(Vector2(p.x, p.z)) < 1.2 or p.distance_to(fc) < 3.0 or p.distance_to(nc) < 3.5:
			continue
		if k % 2 == 0:
			if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
				_cyl_col(p, 0.32, 0.9)
		else:
			_c_model_box(MODELS + "ul_army_crate.glb", p, rng.randf() * TAU, 1.0, Color(0.85, 0.85, 0.8), "ul_army_crate", true)


var _netm: ShaderMaterial


## маскировочная сеть: зелёно-бурые лоскуты с дырами
func _net_mat() -> ShaderMaterial:
	if _netm != null:
		return _netm
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode cull_disabled;
uniform sampler2D noise : filter_linear, repeat_enable;
varying vec3 wpos;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	VERTEX.y -= 0.18 * sin(UV.x * 3.1416) * sin(UV.y * 3.1416);
}
void fragment() {
	float n = texture(noise, wpos.xz / 1.6).r;
	float n2 = texture(noise, wpos.xz / 0.45 + 0.37).r;
	if (n * 0.6 + n2 * 0.4 < 0.4) { discard; }
	vec3 a = vec3(0.2, 0.26, 0.12);
	vec3 b = vec3(0.3, 0.26, 0.16);
	ALBEDO = mix(a, b, step(0.55, n2)) * (0.7 + n * 0.5);
	ROUGHNESS = 1.0;
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
}"""
	_netm = ShaderMaterial.new()
	_netm.shader = sh
	_netm.set_shader_parameter("noise", _noise_tex)
	return _netm


# ---------------- блокпост ----------------

## бетонные блоки поперёк дороги и съезда, стенки из мешков с песком, противотанковые ежи, шлагбаум, обломки стен
func _c_blockpost(g: Node3D, rng: RandomNumberGenerator) -> void:
	# блоки на дороге — «змейкой»
	for bb in [[Vector3(-1.5, 0, 36), 0.1], [Vector3(4.5, 0, 31), -0.15], [Vector3(-2.5, 0, 26), 0.2], [Vector3(-9, 0, -18), 1.2], [Vector3(-1, 0, -38), 0.0],
			[Vector3(38, 0, 0.5), 1.5], [Vector3(40, 0, 6.5), 1.7], [Vector3(46, 0, -5), 0.1], [Vector3(54, 0, -4.5), -0.1], [Vector3(44, 0, 10), 0.3]]:
		_block(g, bb[0], float(bb[1]), rng.randf() < 0.25)
	for sb in [[Vector3(45, 0, 4.5), 0.2, 4], [Vector3(53, 0, 5), -0.4, 3], [Vector3(6.5, 0, 34), 1.2, 3], [Vector3(-7, 0, 29), 1.9, 3], [Vector3(33, 0, -30), 0.5, 3]]:
		_sandbags(g, sb[0], float(sb[1]), int(sb[2]), rng)
	for hp in [Vector3(1.5, 0, 40), Vector3(-4, 0, 22), Vector3(41, 0, -3), Vector3(35, 0, 4)]:
		_hedgehog(g, hp, rng.randf() * TAU)
	# шлагбаум у поста (сломан)
	_bx(g, "plinth", Vector3(0.3, 1.0, 0.3), _at(Vector3(42.5, 0.5, 7.5)), true)
	_bx(g, "rust", Vector3(4.2, 0.1, 0.1), Transform3D(Basis(Vector3.UP, 1.3) * Basis(Vector3.FORWARD, 0.25), Vector3(43.2, 0.6, 5.6)))
	# обломки бетонных стен разрушенного поста
	for ww in [[Vector3(52, 0, 9.5), Vector3(5.0, 1.4, 0.3), 0.0], [Vector3(56.5, 0, 12), Vector3(0.3, 0.9, 5.0), 0.0], [Vector3(50, 0, 14.5), Vector3(3.0, 0.6, 0.3), 0.1], [Vector3(47.5, 0, 12), Vector3(0.3, 1.8, 2.4), 0.0]]:
		var sz: Vector3 = ww[1]
		_bx(g, "plinth", sz, _at((ww[0] as Vector3) + Vector3.UP * sz.y * 0.5, float(ww[2])), true)
	for k in 7:
		_bx(g, "rubble", Vector3(rng.randf_range(0.4, 1.0), rng.randf_range(0.15, 0.35), rng.randf_range(0.3, 0.8)), _at(Vector3(rng.randf_range(48, 56), 0.1, rng.randf_range(10, 14.5)), rng.randf() * TAU))


## бетонный блок (ФБС) с монтажными петлями; бывает опрокинут
func _block(g: Node3D, p: Vector3, yaw: float, fallen: bool) -> void:
	var b := Basis(Vector3.UP, yaw) * (Basis(Vector3.RIGHT, 1.35) if fallen else Basis())
	var h := 0.3 if fallen else 0.45
	_bx(g, "plinth", Vector3(2.4, 0.9, 0.6), Transform3D(b, p + Vector3.UP * h))
	_bx(g, "slab", Vector3(2.44, 0.12, 0.64), Transform3D(b, p + b * Vector3(0, 0.25, 0) + Vector3.UP * h))
	_col_xf(Vector3(2.4, 0.9 if not fallen else 0.6, 0.6 if not fallen else 0.9), Transform3D(Basis(Vector3.UP, yaw), p + Vector3.UP * h))


## стенка из мешков с песком (дугой)
func _sandbags(g: Node3D, p: Vector3, yaw: float, rows: int, rng: RandomNumberGenerator) -> void:
	var b := Basis(Vector3.UP, yaw)
	for r in rows:
		var n := 6 - r
		for i in n:
			var x := (i - (n - 1) * 0.5) * 0.62 + (0.3 if r % 2 == 1 else 0.0) - 0.15 * (r % 2)
			var z := 0.25 * cos(x * 0.6) - 0.25
			_bx(g, "sand", Vector3(0.6, 0.2, 0.34), Transform3D(b * Basis(Vector3.UP, rng.randf_range(-0.12, 0.12)), p + b * Vector3(x, 0.1 + r * 0.19, z)))
	_col_xf(Vector3(3.8, rows * 0.19 + 0.1, 0.5), Transform3D(b, p + Vector3.UP * (rows * 0.1)))


## противотанковый ёж
func _hedgehog(g: Node3D, p: Vector3, yaw: float) -> void:
	for k in 3:
		var tilt: Basis = [Basis(Vector3.RIGHT, 0.95), Basis(Vector3.FORWARD, 0.95), Basis(Vector3(1, 0, 1).normalized(), -0.95) * Basis(Vector3.UP, 0.8)][k]
		var bas := Basis(Vector3.UP, yaw) * tilt
		_bx(g, "rust", Vector3(0.1, 1.7, 0.1), Transform3D(bas, p + Vector3.UP * 0.55))
	_cyl_col(p, 0.45, 1.0)


# ---------------- склад снабжения ----------------

func _c_supply(g: Node3D, rng: RandomNumberGenerator) -> void:
	# второй контейнер — закрытый (не открывается), рядом с проходимым
	var c2 := Vector3(-50, 0, 41.5)
	_bx(g, "gmetal", Vector3(6.1, 2.5, 2.5), _at(c2 + Vector3(0, 1.25, 0), 0.06), true)
	_bx(g, "rust", Vector3(6.15, 0.08, 2.55), _at(c2 + Vector3(0, 2.52, 0), 0.06))
	for k in 6:
		_bx(g, "metal", Vector3(0.06, 2.4, 2.56), _at(c2 + Basis(Vector3.UP, 0.06) * Vector3(-2.6 + k * 1.04, 1.25, 0), 0.06))
	# штабеля армейских ящиков
	for cc in C_CRATES:
		var base: Vector3 = cc[0]
		var n: int = cc[1]
		var yaw := rng.randf() * TAU
		var b := Basis(Vector3.UP, yaw)
		var top := 0.0
		for i in n:
			var lvl := 0 if i < (n + 1) / 2 else 1
			var col := i if lvl == 0 else i - (n + 1) / 2
			var p := base + b * Vector3(col * 1.08 + (0.5 if lvl == 1 else 0.0), 0, 0) + Vector3.UP * lvl * 0.42
			var sz := _c_model_box(MODELS + "ul_army_crate.glb", p, yaw + rng.randf_range(-0.12, 0.12), 1.0, Color(0.85, 0.85, 0.8), "ul_army_crate", lvl == 0)
			top = maxf(top, p.y + sz.y)
		if cc[2]:
			var w0 := ((n + 1) / 2) * 1.08
			extra.append({"pos": base + b * Vector3(w0 * 0.5 - 0.54, 0, 0), "size": Vector3(w0, top, 0.7), "yaw": yaw, "kind": "mil_ammo", "n": "Армейские ящики"})
	# бочки с топливом
	for k in 9:
		var p := Vector3(-46 + (k % 3) * 0.75, 0, 46 + (k / 3) * 0.75)
		if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
			_cyl_col(p, 0.32, 0.9)
	extra.append({"pos": Vector3(-45.3, 0, 46.8), "size": Vector3(2.3, 0.95, 2.3), "yaw": 0.0, "kind": "fuel", "n": "Бочки с топливом"})
	_sandbags(g, Vector3(-39, 0, 37), 1.4, 3, rng)


# ---------------- вышка ----------------

## Смотровая вышка: площадка на высоте 3,3 м на четырёх столбах, наверх — пологий марш (по нему ходят и герой, и
## враги), перила, навес — навес скрывается, когда герой наверху.
func _c_tower(g: Node3D) -> void:
	var c := C_TOWER
	var hh := 3.3
	for sx in [-1.7, 1.7]:
		for sz in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.22, hh + 2.4, 0.22), _at(c + Vector3(sx, (hh + 2.4) * 0.5, sz)))
			_cyl_col(c + Vector3(sx, 0, sz), 0.14, hh)
	for k in 2:
		for sx in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.08, 0.16, 4.6), Transform3D(Basis(Vector3.RIGHT, 0.75 * (1.0 if k == 0 else -1.0)), c + Vector3(sx, 1.65, 0)))
	# площадка
	_bx(g, "wood", Vector3(3.8, 0.14, 3.8), _at(c + Vector3(0, hh - 0.07, 0)), true)
	# перила (со стороны марша — проём)
	for e in [[Vector3(0, 0, -1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(0, 0, 1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(-1.85, 0, 0), Vector3(0.08, 0.08, 3.8)], [Vector3(1.85, 0, 1.0), Vector3(0.08, 0.08, 1.8)]]:
		var sz: Vector3 = e[1]
		_bx(g, "wood", sz, _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 1.0)))
		_bx(g, "wood", Vector3(sz.x, 0.5, sz.z) if sz.x > 1.0 else Vector3(sz.x, 0.5, sz.z), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.35)))
		_col_xf(Vector3(maxf(sz.x, 0.1), 1.1, maxf(sz.z, 0.1)), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.55)))
	# марш: от земли (x = +7) к площадке (x = +1.9), ширина 1.4, со ступенями
	var x0 := 1.9
	var x1 := 7.0
	var zc := -0.9
	var n := 18
	for i in n:
		var t0 := float(i) / n
		var xa := lerpf(x1, x0, t0)
		var xb := lerpf(x1, x0, t0 + 1.0 / n)
		_bx(g, "wood", Vector3(absf(xa - xb) + 0.02, 0.06, 1.4), _at(c + Vector3((xa + xb) * 0.5, hh * (t0 + 1.0 / n) - 0.03, zc)))
	for sz in [-0.75, 0.75]:
		_bx(g, "wood", Vector3(sqrt((x1 - x0) * (x1 - x0) + hh * hh), 0.2, 0.08), Transform3D(Basis(Vector3.FORWARD, -atan2(hh, x1 - x0)), c + Vector3((x0 + x1) * 0.5, hh * 0.5 - 0.12, zc + sz)))
		_bx(g, "wood", Vector3(sqrt((x1 - x0) * (x1 - x0) + hh * hh), 0.06, 0.06), Transform3D(Basis(Vector3.FORWARD, -atan2(hh, x1 - x0)), c + Vector3((x0 + x1) * 0.5, hh * 0.5 + 0.95, zc + sz)))
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
	# навес
	_tower_roof = Node3D.new()
	add_child(_tower_roof)
	_bx(_tower_roof, "rust", Vector3(4.6, 0.08, 4.6), _at(c + Vector3(0, hh + 2.45, 0)))
	_bx(_tower_roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, -1.7)))
	_bx(_tower_roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, 1.7)))
	_flush(_tower_roof)
	# ящик наблюдателя наверху — тайник
	var cp := c + Vector3(-1.2, hh, 1.2)
	_c_model_box(MODELS + "ul_army_crate.glb", cp, 0.3, 0.9, Color(0.85, 0.85, 0.8), "ul_army_crate", false)
	extra.append({"pos": cp, "size": Vector3(0.9, 0.45, 0.5), "yaw": 0.3, "kind": "mil_gear", "n": "Ящик наблюдателя"})


# ---------------- вертолёт ----------------

func _c_heli(g: Node3D, rng: RandomNumberGenerator) -> void:
	var at: Vector3 = C_HELI[0]
	var size := _c_model_box(MODELS + "ul_mi8.glb", at, float(C_HELI[1]), 15.0, Color(0.78, 0.78, 0.74), "ul_mi8", true)
	extra.append({"pos": at, "size": Vector3(minf(size.x, 6.0), 2.2, minf(size.z, 6.0)), "yaw": float(C_HELI[1]), "kind": "heli", "n": "Грузовой отсек Ми-8"})
	# поваленные и обломанные стволы вокруг
	for k in 7:
		var a := rng.randf() * TAU
		var p := at + Vector3(cos(a), 0, sin(a)) * rng.randf_range(7.5, 12.0)
		var len_l := rng.randf_range(3.0, 5.5)
		var yaw := rng.randf() * TAU
		_cy(g, "bark", 0.22, 0.28, len_l, Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, PI * 0.5), p + Vector3.UP * 0.25), 8)
		_col_xf(Vector3(len_l, 0.5, 0.5), _at(p + Vector3.UP * 0.25, yaw))
		_cy(g, "bark", 0.2, 0.3, 0.7, _at(p + Basis(Vector3.UP, yaw) * Vector3(len_l * 0.5 + 0.7, 0.35, 0.3)), 8)
	for k in 6:
		_bx(g, "rust", Vector3(rng.randf_range(0.5, 1.6), 0.05, rng.randf_range(0.3, 0.9)), Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.3, 0.3), rng.randf() * TAU, rng.randf_range(-0.3, 0.3))), at + Vector3(rng.randf_range(-7, 7), 0.08, rng.randf_range(-7, 7))))


# ---------------- тела, обломки, огонь ----------------

func _c_bodies(_rng: RandomNumberGenerator) -> void:
	for bd in C_BODIES:
		var at: Vector3 = bd[0]
		var yaw: float = bd[1]
		_c_model_box(MODELS + "ul_soldier_down.glb", at, yaw, 1.8, Color(0.82, 0.82, 0.78), "ul_soldier_down", false)
		if bd[2]:
			extra.append({"pos": at, "size": Vector3(0.9, 0.35, 1.9), "yaw": yaw, "kind": "soldier", "n": "Погибший военный", "long_z": true})


## каски, вещмешки, бумаги, гильзы, поваленные стволы у дороги, огонь и дым над сгоревшей техникой
func _c_debris(g: Node3D, rng: RandomNumberGenerator) -> void:
	for k in 26:
		var q := Vector2(rng.randf_range(-20, 20), rng.randf_range(-40, 48))
		if k > 16:
			q = Vector2(rng.randf_range(24, 56), rng.randf_range(-60, -34))
		if bld_dist(q) < 0.6:
			continue
		var p := Vector3(q.x, 0, q.y)
		match k % 4:
			0:
				# каска
				_cy(g, "gmetal", 0.05, 0.16, 0.14, _at(p + Vector3.UP * 0.07), 10)
			1:
				# вещмешок
				_bx(g, "canvas", Vector3(0.45, 0.3, 0.32), Transform3D(Basis.from_euler(Vector3(0.2, rng.randf() * TAU, 0.1)), p + Vector3.UP * 0.15))
			2:
				# бумаги
				for j in 4:
					_bx(g, "fabric", Vector3(0.3, 0.004, 0.21), _at(p + Vector3(rng.randf_range(-0.8, 0.8), 0.035, rng.randf_range(-0.8, 0.8)), rng.randf() * TAU))
			3:
				# разбитый ящик
				for j in 3:
					_bx(g, "wood", Vector3(rng.randf_range(0.5, 0.9), 0.04, 0.16), Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.2, 0.2), rng.randf() * TAU, 0)), p + Vector3(rng.randf_range(-0.4, 0.4), 0.05 + j * 0.03, rng.randf_range(-0.4, 0.4))))
	# поваленные стволы в лесу
	for k in 12:
		var q := Vector2(rng.randf_range(-66, 66), rng.randf_range(-66, 66))
		if road_dist(q) < 5.0 or track_dist(q) < 2.5 or clear_w(q) > 0.3 or bld_dist(q) < 3.0:
			continue
		var len_l := rng.randf_range(3.5, 6.0)
		var yaw := rng.randf() * TAU
		_cy(g, "bark", 0.2, 0.26, len_l, Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, PI * 0.5), Vector3(q.x, 0.24, q.y)), 8)
		_col_xf(Vector3(len_l, 0.48, 0.48), _at(Vector3(q.x, 0.24, q.y), yaw))
	for f in C_FIRE:
		_fire(f + Vector3(0.6, 1.2, -0.3))


## огонь: три скрещённых языка (светятся, без источника света) и редкий дым
func _fire(at: Vector3) -> void:
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled, blend_add, depth_draw_never;
uniform sampler2D noise : filter_linear, repeat_enable;
void fragment() {
	float n = texture(noise, vec2(UV.x * 0.5, UV.y * 0.6 + TIME * 0.5)).r;
	float n2 = texture(noise, vec2(UV.x * 1.3 + 0.3, UV.y * 1.2 + TIME * 0.9)).r;
	float shape = (1.0 - UV.y) * (1.0 - abs(UV.x - 0.5) * 2.0);
	float a = smoothstep(0.25, 0.6, shape * (0.6 + n * 0.9) + n2 * 0.25 - UV.y * 0.3);
	ALBEDO = mix(vec3(1.0, 0.35, 0.05), vec3(1.0, 0.85, 0.4), a * (1.0 - UV.y)) * a * 1.6;
	ALPHA = a;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	m.set_shader_parameter("noise", _noise_tex)
	var qm := QuadMesh.new()
	qm.size = Vector2(1.5, 1.7)
	for k in 3:
		var mi := MeshInstance3D.new()
		mi.mesh = qm
		mi.material_override = m
		mi.position = at + Vector3(0, 0.5, 0)
		mi.rotation.y = k * PI / 3.0
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visibility_range_end = 60.0
		add_child(mi)
	var sm := CPUParticles3D.new()
	sm.amount = 12
	sm.lifetime = 4.5
	sm.direction = Vector3(0.25, 1, 0.1)
	sm.spread = 12.0
	sm.gravity = Vector3(0.15, 0.25, 0)
	sm.initial_velocity_min = 0.9
	sm.initial_velocity_max = 1.5
	sm.scale_amount_min = 1.2
	sm.scale_amount_max = 2.2
	var cur := Curve.new()
	cur.add_point(Vector2(0, 0.4))
	cur.add_point(Vector2(1, 1.6))
	sm.scale_amount_curve = cur
	var gr := Gradient.new()
	gr.set_color(0, Color(0.08, 0.08, 0.08, 0.55))
	gr.set_color(1, Color(0.25, 0.25, 0.25, 0.0))
	sm.color_ramp = gr
	var pq := QuadMesh.new()
	pq.size = Vector2(1.0, 1.0)
	var pmat := StandardMaterial3D.new()
	pmat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	pmat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	pmat.vertex_color_use_as_albedo = true
	pmat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	pmat.albedo_texture = _blood_tex()
	pq.material = pmat
	sm.mesh = pq
	sm.position = at + Vector3(0, 1.0, 0)
	sm.visibility_range_end = 60.0
	add_child(sm)
	_fires.append(at)


# ---------------- растительность ----------------

func _c_vegetation() -> void:
	var q := float(ULSettings.q().grass)
	var rng_m := float(ULSettings.q().range)
	var size := half * 2.0
	veg_count += ULVegetation.scatter(self, "grass", size, 1.5 * q + 0.15, func(p: Vector3) -> float:
		if absf(p.x) > half - 0.5 or absf(p.z) > half - 0.5:
			return 0.0
		if bld_d(Vector2(p.x, p.z)) < 0.3:
			return 0.0
		var m := mask_px(p)
		return clampf(m.r * 1.2 - m.g * 1.2 - 0.1, 0.0, 1.0), func(p: Vector3, r: RandomNumberGenerator) -> Color:
		var dry := smoothstep(0.45, 0.72, _noise(Vector2(p.x, p.z) / 60.0) * 0.6 + _noise(Vector2(p.x, p.z) / 17.0 + Vector2(0.37, 0.11)) * 0.4)
		return ULVegetation.grass_tint(dry, r) * Color(0.8, 0.86, 0.78), Vector2(0.25, 0.75), 1.4, 921, rng_m)
	veg_count += ULVegetation.scatter(self, "weed", size, 0.5 * q + 0.05, func(p: Vector3) -> float:
		var m := mask_px(p)
		if bld_d(Vector2(p.x, p.z)) < 0.3:
			return 0.0
		return clampf(m.g * (1.0 - m.g) * 2.2, 0.0, 0.8) + m.b * 0.25, func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.84, 0.9, 0.74) * r.randf_range(0.82, 1.05), Vector2(0.4, 0.75), 1.2, 922, rng_m)
	veg_count += ULVegetation.scatter(self, "nettle", size, 0.35 * q + 0.03, func(p: Vector3) -> float:
		var m := mask_px(p)
		return m.b * 0.7 * (1.0 - m.g), func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.8, 0.88, 0.76) * r.randf_range(0.85, 1.05), Vector2(0.5, 0.95), 0.9, 923, rng_m)
	var bush: PackedScene = load(MODELS + "ul_bush.glb") if ResourceLoader.exists(MODELS + "ul_bush.glb") else null
	if bush == null:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 925
	var placed := 0
	var tries := 0
	while placed < 60 and tries < 2500:
		tries += 1
		var p := Vector3(rng.randf_range(-72, 72), 0, rng.randf_range(-72, 72))
		var q2 := Vector2(p.x, p.z)
		if road_dist(q2) < 5.0 or track_dist(q2) < 2.5 or clear_w(q2) > 0.2 or bld_d(q2) < 2.5 or mask_px(p).b < 0.2:
			continue
		var t: Node3D = bush.instantiate()
		var bb: AABB = w._aabb(t)
		t.scale = Vector3.ONE * (rng.randf_range(0.9, 1.7) / maxf(bb.size.y, 0.01))
		t.position = p
		t.rotation.y = rng.randf() * TAU
		add_child(t)
		_cull(t, 45.0)
		placed += 1


# ---------------- враги ----------------

## места снаружи: у техники на дороге, в лагере, у блокпоста, на складе, у вертолёта, в лесу
func _c_spots(rng: RandomNumberGenerator) -> void:
	for k in 420:
		var q := Vector2(rng.randf_range(-70, 70), rng.randf_range(-70, 70))
		if bld_dist(q) < 1.0:
			continue
		var tag := "forest"
		if road_dist(q) < 9.0 and q.y > -42.0 and q.y < 50.0:
			tag = "road"
		if q.distance_to(Vector2(38, -46)) < 20.0:
			tag = "camp"
		elif q.distance_to(Vector2(48, 3)) < 11.0:
			tag = "post"
		elif q.distance_to(Vector2(-46, 40)) < 12.0:
			tag = "supply"
		elif q.distance_to(Vector2(46, 48)) < 12.0:
			tag = "heli"
		elif q.distance_to(Vector2(-50, -47)) < 8.0:
			tag = "tower"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


## для Рубера особых мест не нужно: его зоны — те же, что у остальных (zones_ruber)
func _extra_pools(_pools: Dictionary) -> void:
	pass


## тайники: в помещениях (общее) и вне их — техника, тела, ящики, бочки
func roll_containers(rng: RandomNumberGenerator) -> void:
	super.roll_containers(rng)
	var tables: Dictionary = conf().get("loot", {})
	var cells := int(conf().get("container_cells", 6))
	for ex in extra:
		var d: Dictionary = (ex as Dictionary).duplicate()
		var items: Array = []
		items.resize(cells)
		for l in tables.get(String(d.kind), []):
			var ch := float(l[3]) if l.size() > 3 else 1.0
			if rng.randf() <= ch:
				var n := rng.randi_range(int(l[1]), int(l[2]))
				if n > 0:
					ULInventory.put(items, ULItems.make(String(l[0]), n))
		d["items"] = items
		d["bi"] = -1
		d["f"] = 0
		var k := _cell(d.pos)
		if not _cont_grid.has(k):
			_cont_grid[k] = []
		_cont_grid[k].append(containers.size())
		containers.append(d)


## хлам: в палатках и помещениях (общее) и кучками у разбитой техники
func junk_points(rng: RandomNumberGenerator) -> Array:
	var out := super.junk_points(rng)
	var per: Array = conf().get("junk_at_vehicles", [1, 2])
	for v in C_VEHICLES:
		for k in rng.randi_range(int(per[0]), int(per[1])):
			var a := rng.randf() * TAU
			var p: Vector3 = (v[1] as Vector3) + Vector3(cos(a), 0, sin(a)) * rng.randf_range(3.2, 4.6)
			if bld_dist(Vector2(p.x, p.z)) > 0.8:
				out.append(p + Vector3.UP * 0.02)
	return out


## герой на вышке — навес скрыт; огонь слышен вблизи
func tick(hero: Vector3, cam, delta: float) -> void:
	super.tick(hero, cam, delta)
	if _tower_roof != null:
		var on := not (hero.y > 2.2 and Vector2(hero.x - C_TOWER.x, hero.z - C_TOWER.z).length() < 3.2)
		if on != _tower_roof.visible:
			_tower_roof.visible = on
