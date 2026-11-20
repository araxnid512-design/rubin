class_name ULSanatorium
extends Node3D
## «Санаторий Луч» — временный нестабильный кластер 150×150 м по утверждённой карте пользователя: вход — ворота
## с проходной посередине южной ограды, от них аллея к главному корпусу (портик с колоннами), за ним — площадь с
## фонтаном и беседками; слева вверху — лечебный корпус (Г-образный), сверху — котельная с трубой и хозблок,
## справа — жилой корпус в четыре этажа, слева внизу — столовая с клубом, справа внизу — хоздвор с автобусом,
## грузовиком и машинами; детская площадка, заросшие дорожки, бетонная ограда с проломами, за ней лес.
## Корпуса — ULBlock (полностью проходимые: комнаты, коридоры, лестницы, двери, мебель, тайники). Постоянная часть
## одна и та же при каждом посещении; враги, содержимое тайников, следы гибели людей и хлам — заново при каждом входе.
## Баланс — data/sanatorium.json; карты земли и проходимости строятся --as-test=snbake.

const CFG := "res://data/sanatorium.json"
const NAV := "res://assets/world/nav_sanatorium.res"
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"
const MASK := "res://assets/world/tex/sanatorium_mask.png"
const BLD_CACHE := "res://assets/world/sanatorium_blocks.res"   ## готовые корпуса и карта расстояний (snbake)
const TITLE := "Санаторий Луч"
const ENTRY := Vector3(2.0, 0, 67.0)
const ENTRY_YAW := PI              ## у ворот герой смотрит на север — на аллею к главному корпусу
const FENCE := 72.5

## Корпуса. Блок: c — середина (x, z), L — длина вдоль оси axis, W — ширина, floors — этажей, stairs — в каких
## торцах лестничные клетки (−1 / +1 по оси), hall — вестибюль [где по оси, ширина], entr — входы [сторона,
## смещение, ширина] (s± — длинные стены, e± — торцы), layout corridor / hall (зал и ряд комнат row вдоль стороны
## row_side глубиной row_d). links — сквозные проёмы между блоками [точка (x, z), на скольких этажах].
## types — виды комнат по этажам с весами.
const BUILDINGS := [
	{"id": "main", "n": "Главный корпус", "skin": "facade", "int": "int_beige", "hall0": "hall0",
		"blocks": [
			{"c": Vector2(0, 21), "L": 40.0, "W": 14.0, "axis": "x", "floors": 3, "stairs": [-1, 1], "hall": [0.0, 8.0], "entr": [["s+", 0.0, 2.4], ["s-", 0.0, 2.0]], "wide": 0.5},
			{"c": Vector2(-25.5, 25), "L": 26.0, "W": 11.0, "axis": "z", "floors": 2, "stairs": [1], "entr": [["e+", 0.0, 1.6]], "wide": 0.4},
			{"c": Vector2(25.5, 25), "L": 26.0, "W": 11.0, "axis": "z", "floors": 2, "stairs": [1], "entr": [["e+", 0.0, 1.6]], "wide": 0.4},
		],
		"links": [[Vector2(-20.0, 21.0), 2], [Vector2(20.0, 21.0), 2]],
		"portico": {"c": Vector2(0, 28), "w": 12.0, "d": 4.4, "h": 6.6, "dir": Vector2(0, 1), "cols": 6},
		"types": {"0": [["office", 3], ["staff", 2], ["wc", 1], ["store", 1]], "1": [["office", 4], ["staff", 1], ["archive", 1], ["wc", 1]], "*": [["office", 2], ["staff", 2], ["archive", 1], ["store", 1], ["wc", 1]]}},
	{"id": "medical", "n": "Лечебный корпус", "skin": "facade", "int": "int_blue", "hall0": "hall_med",
		"blocks": [
			{"c": Vector2(-50, -45), "L": 30.0, "W": 13.0, "axis": "x", "floors": 2, "stairs": [-1], "hall": [2.0, 7.0], "entr": [["s+", 2.0, 2.2]], "wide": 0.55},
			{"c": Vector2(-29.5, -46), "L": 32.0, "W": 11.0, "axis": "z", "floors": 3, "stairs": [-1], "entr": [["e+", 0.0, 1.8]], "wide": 0.5},
		],
		"links": [[Vector2(-35.0, -45.0), 2]],
		"types": {"*": [["ward", 5], ["proc", 2], ["nurse", 1], ["wc", 1], ["store", 1]]}},
	{"id": "residential", "n": "Жилой корпус", "skin": "facade2", "int": "int_green", "hall0": "hall_res",
		"blocks": [
			{"c": Vector2(50, -18), "L": 40.0, "W": 13.0, "axis": "z", "floors": 4, "stairs": [-1, 1], "hall": [0.0, 7.0], "entr": [["s-", 0.0, 2.2]], "wide": 0.25, "balcony": true},
		],
		"types": {"*": [["room", 8], ["wc", 1], ["linen", 1]]}},
	{"id": "canteen", "n": "Столовая и клуб", "skin": "plaster", "int": "int_beige1", "storey": 4.0,
		"blocks": [
			{"c": Vector2(-54, 32), "L": 28.0, "W": 20.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.0,
				"row": [["club", 7.0], ["kitchen", 9.0], ["cold", 4.0], ["pantry", 4.0], ["wc", 3.4]], "hall_type": "dining",
				"entr": [["s+", 5.0, 2.4], ["s-", -4.0, 1.2]], "win_w": 2.4, "win_h": 2.4, "sill": 0.6},
		]},
	{"id": "boiler", "n": "Котельная", "skin": "brick", "int": "int_grey1", "storey": 5.0,
		"blocks": [
			{"c": Vector2(6, -62), "L": 22.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.2,
				"row": [["tech", 6.0], ["staff", 5.0], ["wc", 3.5], ["store", 6.9]], "hall_type": "boiler",
				"entr": [["s+", 3.0, 2.6], ["e-", 1.5, 1.2]], "win_h": 1.8, "sill": 2.4},
		]},
	{"id": "hozblok", "n": "Хозблок", "skin": "plaster", "int": "int_grey1", "storey": 3.8,
		"blocks": [
			{"c": Vector2(56, -61), "L": 22.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.5,
				"row": [["workshop", 8.0], ["store", 5.0], ["store", 8.4]], "hall_type": "warehouse",
				"entr": [["s+", -4.0, 3.0], ["s+", 6.0, 1.2]], "sill": 1.4, "win_h": 1.2},
		]},
]

## дороги (асфальт): ломаные, ширина
const ROADS := [
	[[Vector2(2, 80), Vector2(2, 50)], 5.0],
	[[Vector2(-35.5, 58), Vector2(38, 58)], 4.2],
	[[Vector2(-35.5, 58), Vector2(-35.5, -24), Vector2(-31, -27), Vector2(-14, -27), Vector2(-9, -33), Vector2(38, -33)], 4.0],
	[[Vector2(38, -33), Vector2(38, 58)], 4.2],
	[[Vector2(38, -33), Vector2(38, -50), Vector2(64, -50)], 4.0],
	[[Vector2(9, -33), Vector2(9, -55)], 3.6],
]
## дорожки (плитка): ломаные, ширина
const PATHS := [
	[[Vector2(0, 13), Vector2(0, -6)], 2.4],
	[[Vector2(2, -26), Vector2(2, -33)], 2.2],
	[[Vector2(12, -16), Vector2(38, -16)], 2.0],
	[[Vector2(43.5, -18), Vector2(38, -18)], 3.0],
	[[Vector2(-8, -16), Vector2(-35.5, -10)], 2.0],
	[[Vector2(-35.5, -12), Vector2(-48, -8)], 1.8],
	[[Vector2(-35.5, -26), Vector2(-46, -33), Vector2(-48, -38)], 2.0],
	[[Vector2(-25.5, 38), Vector2(-25.5, 44), Vector2(-12, 44)], 2.0],
	[[Vector2(25.5, 38), Vector2(25.5, 44), Vector2(16, 44)], 2.0],
	[[Vector2(-49, 42), Vector2(-49, 58)], 2.4],
	[[Vector2(-37, 46), Vector2(-12, 46)], 1.8],
	[[Vector2(-28, -6), Vector2(-24, 10), Vector2(-20, 12)], 1.6],
	[[Vector2(28, -6), Vector2(33, 6), Vector2(38, 8)], 1.6],
	[[Vector2(-58, -4), Vector2(-46, -4)], 1.6],
]
const PLAZA := [Vector2(2, -16), 10.5]           ## площадь с фонтаном
const FORECOURT := Rect2(-13, 33, 30, 17)        ## площадка перед главным корпусом
const YARD := Rect2(42, 26, 28, 40)              ## хоздвор
const PLAY := Vector2(-52, -2)                   ## детская площадка
const GAZEBOS := [Vector2(22, -23), Vector2(-14, -44), Vector2(-20, 4)]
const GROVES := [[Vector2(-58, -64), 12.0, 24], [Vector2(-62, 58), 11.0, 20], [Vector2(64, 4), 8.0, 14], [Vector2(-66, 4), 6.0, 10],
	[Vector2(26, -62), 7.0, 10], [Vector2(-14, -60), 8.0, 12], [Vector2(64, -36), 7.0, 10], [Vector2(-8, 60), 6.0, 8], [Vector2(24, 64), 6.0, 8]]
## одиночные деревья парка (вокруг площади и вдоль дорожек)
const PARK := [Vector2(-10, -4), Vector2(14, -4), Vector2(-12, -26), Vector2(16, -27), Vector2(-20, -18), Vector2(24, -12),
	Vector2(-24, -4), Vector2(28, 0), Vector2(-6, 6), Vector2(10, 7), Vector2(30, 14), Vector2(-30, 12), Vector2(-14, 54),
	Vector2(18, 54), Vector2(-26, 52), Vector2(30, 50), Vector2(-8, 40), Vector2(14, 38), Vector2(32, -40), Vector2(-26, -38),
	Vector2(-20, 34), Vector2(20, 34), Vector2(-44, 16), Vector2(-40, -18), Vector2(32, -22), Vector2(-4, -40), Vector2(20, -44)]
const VEHICLES := [["bus", Vector3(53, 0, 38), 0.35], ["truck", Vector3(63, 0, 53), -1.2], ["car", Vector3(49, 0, 55), 0.8],
	["car", Vector3(60, 0, 32), 2.6], ["car", Vector3(-28, 0, 60.5), 1.62]]
const VEHICLE_MODELS := {"bus": ["ul_bus", 9.0, Color(0.85, 0.82, 0.76)], "truck": ["ul_truck", 6.2, Color(0.8, 0.78, 0.74)],
	"car": ["ul_car", 4.3, Color(0.82, 0.8, 0.76)]}

static var _cfg := {}
var w                              ## локация (world.gd)
var half := 75.0
var body: StaticBody3D
var blds: Array[ULBlock] = []
var barns: Array = []              ## для общего кода кластеров: по зданию {node, id, n}
var cows: Array[Vector3] = []      ## (у коровника — останки коров; здесь не бывает)
var fence_mid: Array[Vector3] = []
var fence_pts: Array[Vector3] = []
var wood_pts: Array[Vector3] = []
var trees: Array[Node3D] = []
var blob_pts: Array = []            ## пятна-тени под предметами: [где, размер (x, z), поворот, сила] (ULBlobs)
var yard_pts: Array[Vector3] = []  ## места врагов снаружи: двор, площадь, у ограды, в зарослях
var veg_count := 0
var mask: Image
var containers: Array = []         ## все тайники всех корпусов (ULBlock.containers) + содержимое на это посещение
var doors: Array = []
var _door_grid := {}
var _moving: Array = []
var _noise_tex: ImageTexture
var _noise_img: Image
var _spruce_xf: Array[Transform3D] = []
var _scenes := {}
var _st := {}
var _bxm := BoxMesh.new()
var _mats := {}
var _tick_t := 0.0
var hero_b := -1                   ## в каком корпусе герой (−1 — снаружи) и на каком этаже
var hero_f := -1
var _lights: Array[OmniLight3D] = []
var lamp_energy := 0.9
var _bench_n := 0                  ## яркость ламп в помещениях (мигает первая)
var light_n := 2                        ## сколько ламп помещения горит сразу (ближайшие к герою)
var _flick := 0.0


## куст — модель Poly Haven (searsia lucida, листва прорежена для телефона), если её нет — прежний куст Tripo
static func bush_scene() -> PackedScene:
	for n in ["ph_bush", "ul_bush"]:
		if ResourceLoader.exists(MODELS + n + ".glb"):
			return load(MODELS + n + ".glb")
	return null


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


## Точки расширения для других кластеров на этой же основе (ULConvoy): настройки, вход, название, край для врагов
func conf() -> Dictionary:
	return cfg()


func entry() -> Vector3:
	return ENTRY


func title() -> String:
	return TITLE


func spawn_limit() -> float:
	return FENCE - 1.0


func build(world: Node3D) -> void:
	w = world
	half = float(cfg().get("size", 150.0)) * 0.5
	# Столкновения копятся в теле, пока оно вне сцены, и в сцену оно попадает в самом конце: физика собирает его
	# один раз. (Добавлять по одной в тело, уже стоящее в мире, — каждая добавка пересобирает всё тело: 2700 коробок
	# корпусов и ограды так строились 3 с.)
	body = StaticBody3D.new()
	body.name = "SanBody"
	var fn := FastNoiseLite.new()
	fn.seed = 91
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5521                    # постоянная часть — одна и та же
	var t0 := Time.get_ticks_msec()
	# готовые корпуса из кэша (если он от этих же описаний и этого же генератора); иначе — собрать
	var cache: ULBlockCache = null
	if w.test != "snbake" and ResourceLoader.exists(BLD_CACHE):
		var r = load(BLD_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == cache_sig():
			cache = r
		else:
			push_warning("санаторий: кэш корпусов устарел — пересоберите --as-test=snbake (корпуса строятся заново)")
	var made := {}
	for d in BUILDINGS:
		var b := ULBlock.new()
		add_child(b)
		var st0 := rng.state
		b.build(d, rng, cache.blds.get(String(d.id), {}) if cache != null else {})
		if cache == null:
			made[String(d.id)] = b.to_cache()
			made[String(d.id)]["rng0"] = st0
		for c in b.cols:
			_col_xf(c[0], c[1])
		_place_models(b)
		for h in b.hulls:
			var cs := CollisionShape3D.new()
			var sh := ConvexPolygonShape3D.new()
			sh.points = h
			cs.shape = sh
			body.add_child(cs)
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
	print("[san] корпуса%s: %d мс, столкновений %d, тайников %d, дверей %d" % [" (из кэша)" if cache != null else "", Time.get_ticks_msec() - t0, body.get_child_count(), _count_cont(), doors.size()])
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	var steps := [
		["ограда", func(): _fence(props, rng)], ["лес", func(): _forest(rng)], ["земля", func(): _ground()],
		["покрытия", func(): _paving()], ["площадь", func(): _plaza(props, rng)], ["площадка", func(): _playground(props)],
		["беседки", func(): _gazebos(props)], ["фонари", func(): _lamps_benches(props, rng)], ["котельная", func(): _boiler_yard(props)],
		["техника", func(): _vehicles()], ["мусор", func(): _yard_junk(props, rng)], ["сетки", func(): _flush(props)],
		["растения", func(): _vegetation()], ["места", func(): _yard_spots(rng)], ["лампы", func(): _light_pool()],
	]
	var tl := ""
	for st in steps:
		var ts := Time.get_ticks_msec()
		(st[1] as Callable).call()
		tl += "%s %d; " % [st[0], Time.get_ticks_msec() - ts]
	var tb := Time.get_ticks_msec()
	add_child(body)
	tl += "столкновения в мир %d; " % (Time.get_ticks_msec() - tb)
	print("[san] по шагам, мс: ", tl)
	if w.test == "snbake":
		# кэш: готовые корпуса, состояние случайности после них, карта расстояний до покрытий и корпусов
		var cr := ULBlockCache.new()
		cr.sig = cache_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, BLD_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш корпусов санатория: %s (%s)" % [BLD_CACHE, error_string(err)])
	print("[san] всё: %d мс" % (Time.get_ticks_msec() - t0))


## подпись кэша: описания корпусов и версия генератора
static func cache_sig() -> int:
	return hash(str(BUILDINGS) + "|" + str(ULBlock.GEN_V) + "|" + str(ULBlock.STOREY))


var _dist: Image                   ## карта расстояний (из кэша): R — до края покрытия, G — до корпуса


## Карта расстояний 600×600 (шаг 0,25 м): R — до края дорог и дорожек (−1…4 м), G — до корпуса (0…4 м). По ней
## растения расставляются быстро (точных расстояний на каждый пучок травы — десятки тысяч, это 1,5 с).
func _bake_dist() -> Image:
	var n := 600
	var im := Image.create(n, n, false, Image.FORMAT_RG8)
	for iy in n:
		for ix in n:
			var q := Vector2((ix + 0.5) / n - 0.5, (iy + 0.5) / n - 0.5) * half * 2.0
			im.set_pixel(ix, iy, Color(clampf((pave_dist(q) + 1.0) / 5.0, 0.0, 1.0), clampf(bld_dist(q) / 4.0, 0.0, 1.0), 0))
	return im


## расстояние до края покрытия / до корпуса: по карте, если она есть (точность ~0,25 м), иначе точно
func pave_d(q: Vector2) -> float:
	if _dist == null:
		return pave_dist(q)
	return _dist_px(q).r * 5.0 - 1.0


func bld_d(q: Vector2) -> float:
	if _dist == null:
		return bld_dist(q)
	return _dist_px(q).g * 4.0


func _dist_px(q: Vector2) -> Color:
	var n := _dist.get_width()
	var x := clampi(int((q.x / (half * 2.0) + 0.5) * n), 0, n - 1)
	var y := clampi(int((q.y / (half * 2.0) + 0.5) * n), 0, n - 1)
	return _dist.get_pixel(x, y)


func _count_cont() -> int:
	var n := 0
	for b in blds:
		n += b.containers.size()
	return n


# ---------------- служебное ----------------

## свободно ли место радиуса r от уже поставленных столкновений (тело ещё не в сцене — проверка по фигурам:
## коробки и цилиндры; стены корпусов, деревья, скамейки, техника — все через них)
func _free_at(p: Vector3, r: float) -> bool:
	for c in body.get_children():
		var cs := c as CollisionShape3D
		if cs == null or cs.shape == null:
			continue
		var lp := cs.transform.affine_inverse() * (p + Vector3.UP * 0.4)
		if cs.shape is BoxShape3D:
			var h: Vector3 = (cs.shape as BoxShape3D).size * 0.5
			if absf(lp.x) < h.x + r and absf(lp.z) < h.z + r and absf(lp.y) < h.y + 0.4:
				return false
		elif cs.shape is CylinderShape3D:
			var cy := cs.shape as CylinderShape3D
			if Vector2(lp.x, lp.z).length() < cy.radius + r and absf(lp.y) < cy.height * 0.5 + 0.4:
				return false
	return true


func _col_xf(size: Vector3, xf: Transform3D) -> void:
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.transform = xf
	body.add_child(cs)


func _cyl_col(at: Vector3, r: float, h: float) -> void:
	var cs := CollisionShape3D.new()
	var cy := CylinderShape3D.new()
	cy.radius = r
	cy.height = h
	cs.shape = cy
	cs.position = at + Vector3.UP * h * 0.5
	body.add_child(cs)


func _bx(g: Node3D, m: String, size: Vector3, xf: Transform3D, col := false) -> void:
	var key := [g, m]
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	_bxm.size = size
	(_st[key] as SurfaceTool).append_from(_bxm, 0, xf)
	if col:
		_col_xf(size, xf)


func _cy(g: Node3D, m: String, r0: float, r1: float, h: float, xf: Transform3D, seg := 12) -> void:
	var key := [g, m]
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	var cm := CylinderMesh.new()
	cm.top_radius = r0
	cm.bottom_radius = r1
	cm.height = h
	cm.radial_segments = seg
	cm.rings = 1
	(_st[key] as SurfaceTool).append_from(cm, 0, xf)


func _mat(m: String) -> Material:
	if ULBlock.mats.has(m):
		return ULBlock.mats[m]
	return _mats.get(m, ULBlock.mats["plinth"])


func _flush(g: Node3D) -> void:
	for key in _st.keys():
		if key[0] != g:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = (_st[key] as SurfaceTool).commit()
		mi.material_override = _mat(String(key[1]))
		g.add_child(mi)
		_st.erase(key)


func _at(p: Vector3, yaw := 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), p)


func _noise(uv: Vector2) -> float:
	return _noise_img.get_pixel(int(fposmod(uv.x, 1.0) * 256.0) % 256, int(fposmod(uv.y, 1.0) * 256.0) % 256).r


static func _seg_dist(q: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var h := clampf((q - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
	return q.distance_to(a + ab * h)


## расстояние до края ближайшей дороги или дорожки (внутри — отрицательное)
func pave_dist(q: Vector2) -> float:
	var d := 1e9
	for r in ROADS + PATHS:
		var pts: Array = r[0]
		for i in pts.size() - 1:
			d = minf(d, _seg_dist(q, pts[i], pts[i + 1]) - float(r[1]) * 0.5)
	d = minf(d, q.distance_to(PLAZA[0]) - float(PLAZA[1]))
	for rc in [FORECOURT, YARD]:
		var rr: Rect2 = rc
		var o := Vector2(maxf(maxf(rr.position.x - q.x, q.x - rr.end.x), 0.0), maxf(maxf(rr.position.y - q.y, q.y - rr.end.y), 0.0))
		var inside := rr.has_point(q)
		d = minf(d, -minf(minf(q.x - rr.position.x, rr.end.x - q.x), minf(q.y - rr.position.y, rr.end.y - q.y)) if inside else o.length())
	return d


## расстояние до ближайшего корпуса (снаружи; внутри — 0)
func bld_dist(q: Vector2) -> float:
	var d := 1e9
	for b in blds:
		for bk in b.blocks:
			var l := b._local(bk, Vector3(q.x, 0, q.y))
			var o := Vector2(maxf(absf(l.x) - float(bk.hl), 0.0), maxf(absf(l.y) - float(bk.hw), 0.0))
			d = minf(d, o.length())
	return d


func _cell(p: Vector3) -> Vector2i:
	return Vector2i(int(floor(p.x / 4.0)), int(floor(p.z / 4.0)))


# ---------------- корпуса: где герой, видимость, двери, свет ----------------

## в каком корпусе точка: [индекс, этаж] или [−1, −1]
func locate(p: Vector3) -> Vector2i:
	for i in blds.size():
		var f := blds[i].floor_at(p)
		if f >= 0:
			return Vector2i(i, f)
	return Vector2i(-1, -1)


## для общего кода кластеров: «в постройке ли» (индекс корпуса или −1)
func in_barn(p: Vector3, _m := 0.0) -> int:
	return locate(p).x


## видна ли сейчас точка (враг, вещь): внутренности корпусов скрыты, кроме этажа, где герой
func visible_at(p: Vector3) -> bool:
	var l := locate(p)
	if l.x < 0:
		return true
	return l.x == hero_b and l.y == hero_f


## Кадр: этаж героя (с запасом на лестнице) — видимость корпусов; срез стен, окно вокруг героя на экране,
## двери (открываются, когда подходит герой или гонящийся враг), лампы рядом с героем.
func tick(hero: Vector3, cam, delta: float) -> void:
	_tick_t -= delta
	if _tick_t <= 0.0:
		_tick_t = 0.08
		var nb := -1
		var nf := -1
		for i in blds.size():
			var f := blds[i].floor_hyst(hero, hero_f if i == hero_b else -1)
			if f >= 0:
				nb = i
				nf = f
				break
		if nb != hero_b or nf != hero_f:
			hero_b = nb
			hero_f = nf
			for i in blds.size():
				blds[i].set_state(nf if i == nb else -1)
			if nb >= 0:
				ULBlock.set_cut(blds[nb].base_y + nf * blds[nb].storey + ULBlock.CUT)
			_lights_place(hero)
			if w != null and w.has_method("zone_changed"):
				w.zone_changed()
	if cam is Camera3D:
		var c := cam as Camera3D
		var vp := c.get_viewport()
		var vs := vp.get_visible_rect().size
		var sp := c.unproject_position(hero + Vector3.UP * 1.0)
		var depth := -(c.global_transform.affine_inverse() * (hero + Vector3.UP * 1.0)).z
		# снаружи — окно вокруг героя (за высоким корпусом его видно); внутри срез стен уже открывает этаж
		ULBlock.set_hole(sp / vs, 0.17 if hero_b < 0 else 0.13, depth - 0.8, hero.y + 0.25)
	_doors_tick(hero, delta)
	if hero_b >= 0:
		_flick -= delta
		if _flick <= 0.0:
			_flick = randf_range(0.05, 0.4)
			if not _lights.is_empty():
				_lights[0].light_energy = lamp_energy if randf() < 0.8 else lamp_energy * 0.28
		if Engine.get_process_frames() % 20 == 0:
			_lights_place(hero)


func _doors_tick(hero: Vector3, delta: float) -> void:
	open_near(hero, 1.05)
	for i in range(_moving.size() - 1, -1, -1):
		if not (_moving[i] as ULDoor).tick(delta):
			_moving.remove_at(i)


## открыть закрытые двери рядом с точкой (герой подходит; враг толкает)
func open_near(p: Vector3, r: float) -> bool:
	var k := _cell(p)
	var any := false
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			var arr = _door_grid.get(k + Vector2i(dx, dz))
			if arr == null:
				continue
			for dd in arr:
				var d := dd as ULDoor
				if d.open or absf(d.center.y - p.y) > 1.4:
					continue
				var v := d.center - p
				v.y = 0.0
				if v.length() < r:
					d.set_open(true)
					_moving.append(d)
					any = true
	return any


## две лампы без теней — у ближайших к герою светильников его этажа (на телефоне каждый источник света дорог)
func _light_pool() -> void:
	_door_glows()
	for i in light_n:
		var l := OmniLight3D.new()
		l.light_color = Color(0.86, 0.94, 1.0) if i == 0 else Color(1.0, 0.86, 0.66)
		l.light_energy = 0.9
		l.omni_range = 7.5
		l.omni_attenuation = 1.2
		l.shadow_enabled = false
		l.light_cull_mask = 2
		l.visible = false
		add_child(l)
		_lights.append(l)


func _lights_place(hero: Vector3) -> void:
	if hero_b < 0:
		for l in _lights:
			l.visible = false
		return
	var best: Array = []
	for lp in blds[hero_b].lamps:
		if int(lp[2]) != hero_f:
			continue
		best.append([(lp[0] as Vector3).distance_to(hero), lp[0]])
	best.sort_custom(func(a, b) -> bool: return float(a[0]) < float(b[0]))
	for i in _lights.size():
		_lights[i].visible = i < best.size()
		if i < best.size():
			_lights[i].global_position = best[i][1]


# ---------------- земля ----------------

## Земля — общий шейдер земли: газоны, вытоптанная земля у дорожек и корпусов, подстилка в рощах (карта слоёв —
## --as-test=snbake). Дороги, площадь и дорожки — отдельные полосы (асфальт, плитка) с выкрошенными краями.
func _ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_for("sanatorium", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(MASK) and w.test != "snbake":
		mask = (load(MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _bake_mask()
		if w.test == "snbake":
			mask.save_png(ProjectSettings.globalize_path(MASK))
			print("[bake] карта земли санатория: ", MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # земля сама ни на что тень не бросает: в карту теней не рисуется
	add_child(mi)
	ULHouse.outer_frame(self, half, 420.0)
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


func _bake_mask() -> Image:
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
			var pd := pave_dist(p)
			var bd := bld_dist(p)
			# у края плитки и асфальта — вытоптанная земля, у стен — голая земля с сорняками
			var edge := 1.0 - smoothstep(0.0, 0.45 + n3 * 0.8, pd)
			var wall := 1.0 - smoothstep(0.3, 1.8 + n2 * 2.0, bd)
			var path := maxf(edge * 0.8, wall * 0.6)
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 2.0, bd)) * 0.45
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


func mask_px(p: Vector3) -> Color:
	if mask == null:
		return Color(1, 0, 0, 1)
	var x := clampi(int((p.x / (half * 2.0) + 0.5) * mask.get_width()), 0, mask.get_width() - 1)
	var y := clampi(int((p.z / (half * 2.0) + 0.5) * mask.get_height()), 0, mask.get_height() - 1)
	return mask.get_pixel(x, y)


const PAVE_SHADER := """shader_type spatial;
// Покрытие (асфальт, плитка): текстура по миру, края выкрошены (по шуму), в трещинах — трава и мох, пятна грязи.
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D tex_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform float scale = 2.0;
uniform vec4 tint : source_color = vec4(1.0);
uniform float sat = 0.4;
uniform float moss = 0.5;
uniform float crumble = 0.6;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
//#SUN_SHADOW
void fragment() {
	float e = min(UV.y, 1.0 - UV.y) * UV2.x;              // до края, м
	float n = texture(noise, wpos.xz / 4.0).r;
	float n2 = texture(noise, wpos.xz / 0.9 + 0.31).r;
	if (e < crumble * (n * 0.8 + n2 * 0.6) - 0.15) { discard; }
	vec3 c = texture(tex, wpos.xz / scale).rgb;
	c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, sat) * tint.rgb;
	float m = smoothstep(0.55, 0.85, n * 0.6 + n2 * 0.4) * moss;
	m = max(m, (1.0 - smoothstep(0.0, 0.7, e)) * moss * 0.8);
	c = mix(c, vec3(0.2, 0.26, 0.12) * (0.8 + n2 * 0.4), m * 0.7);
	c *= mix(0.78, 1.05, texture(noise, wpos.xz / 21.0).r);
	ALBEDO = c;
	ALBEDO *= sun_shade(wpos.xz);
	NORMAL_MAP = texture(tex_n, wpos.xz / scale).rgb;
	ROUGHNESS = 0.9;
}"""
var _pave_mats := {}


func _pave_mat(kind: String) -> ShaderMaterial:
	if _pave_mats.has(kind):
		return _pave_mats[kind]
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = ULSunShadow.with(PAVE_SHADER)
	sm.shader = sh
	sm.set_shader_parameter("noise", _noise_tex)
	if kind == "asphalt":
		sm.set_shader_parameter("tex", load(TEX + "worn_asphalt_c.jpg"))
		sm.set_shader_parameter("tex_n", load(TEX + "worn_asphalt_n.jpg"))
		sm.set_shader_parameter("scale", 2.0)
		sm.set_shader_parameter("tint", Color(1.25, 1.22, 1.18))
		sm.set_shader_parameter("sat", 0.15)
		sm.set_shader_parameter("moss", 0.45)
	else:
		sm.set_shader_parameter("tex", load(TEX + "overgrown_concrete_pavers_c.jpg"))
		sm.set_shader_parameter("tex_n", load(TEX + "overgrown_concrete_pavers_n.jpg"))
		sm.set_shader_parameter("scale", 2.0)
		sm.set_shader_parameter("tint", Color(0.92, 0.89, 0.83))
		sm.set_shader_parameter("sat", 0.35)
		sm.set_shader_parameter("moss", 0.6)
		sm.set_shader_parameter("crumble", 0.35)
	_pave_mats[kind] = sm
	return sm


## полоса покрытия по ломаной: UV.y — поперёк (0…1), UV2.x — ширина (для выкрошенных краёв)
func _strip(pts: Array, wd: float, y: float, kind: String) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[i + 1]
		var d := (b - a).normalized()
		var nrm := Vector2(-d.y, d.x) * wd * 0.5
		# на стыках — продлить, чтобы не было щелей
		var a2 := a - d * (wd * 0.5 if i > 0 else 0.0)
		var b2 := b + d * (wd * 0.5 if i < pts.size() - 2 else 0.0)
		var q := [Vector3(a2.x + nrm.x, y, a2.y + nrm.y), Vector3(a2.x - nrm.x, y, a2.y - nrm.y), Vector3(b2.x - nrm.x, y, b2.y - nrm.y), Vector3(b2.x + nrm.x, y, b2.y + nrm.y)]
		var uv := [Vector2(0, 0), Vector2(0, 1), Vector2(1, 1), Vector2(1, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_normal(Vector3.UP)
			st.set_uv(uv[k])
			st.set_uv2(Vector2(wd, 0))
			st.add_vertex(q[k])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _pave_mat(kind)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


## прямоугольник покрытия (UV — по короткой стороне)
func _pave_rect(r: Rect2, y: float, kind: String) -> void:
	if r.size.x >= r.size.y:
		_strip([Vector2(r.position.x, r.get_center().y), Vector2(r.end.x, r.get_center().y)], r.size.y, y, kind)
	else:
		_strip([Vector2(r.get_center().x, r.position.y), Vector2(r.get_center().x, r.end.y)], r.size.x, y, kind)


## круг покрытия: UV.y — от края к краю через центр (выкрошен по окружности)
func _pave_disc(c: Vector2, r: float, y: float, kind: String) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 40
	for i in n:
		var a0 := TAU * i / n
		var a1 := TAU * (i + 1) / n
		var p0 := Vector3(c.x, y, c.y)
		var p1 := Vector3(c.x + cos(a0) * r, y, c.y + sin(a0) * r)
		var p2 := Vector3(c.x + cos(a1) * r, y, c.y + sin(a1) * r)
		for v in [[p0, 0.5], [p1, 0.0], [p2, 0.0]]:
			st.set_normal(Vector3.UP)
			st.set_uv(Vector2(0, float(v[1])))
			st.set_uv2(Vector2(r * 2.0, 0))
			st.add_vertex(v[0])
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	mi.material_override = _pave_mat(kind)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _paving() -> void:
	for r in ROADS:
		_strip(r[0], float(r[1]), 0.02, "asphalt")
	for r in PATHS:
		_strip(r[0], float(r[1]), 0.03, "pavers")
	_pave_disc(PLAZA[0], PLAZA[1], 0.035, "pavers")
	_pave_rect(FORECOURT, 0.035, "pavers")
	_pave_rect(YARD, 0.025, "asphalt")
	# лужи на асфальте
	ULGroundDetail.puddles(self, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		return pave_dist(q) < -0.6 and bld_dist(q) > 2.0, half * 2.0, 61, 220, _noise_tex)


# ---------------- ограда, ворота, проходная ----------------

## Бетонная ограда: столбы через 3 м, плиты с рельефным поясом; бывают проломы (плита лежит рядом) и
## покосившиеся плиты. Ворота посередине юга: кирпичные столбы, створки (одна сорвана), проходная, шлагбаум,
## арка с вывеской.
func _fence(g: Node3D, rng: RandomNumberGenerator) -> void:
	var gate_a := -4.0
	var gate_b := 8.0
	var sides := [
		[Vector2(-FENCE, -FENCE), Vector2(FENCE, -FENCE)],
		[Vector2(FENCE, -FENCE), Vector2(FENCE, FENCE)],
		[Vector2(-FENCE, FENCE), Vector2(-FENCE, -FENCE)],
		[Vector2(FENCE, FENCE), Vector2(gate_b, FENCE)],
		[Vector2(gate_a, FENCE), Vector2(-FENCE, FENCE)],
	]
	for sd in sides:
		var a: Vector2 = sd[0]
		var b: Vector2 = sd[1]
		var L := a.distance_to(b)
		var dir := (b - a) / L
		var yaw := atan2(-dir.y, dir.x)
		var n := int(ceil(L / 3.0))
		for i in n:
			var p0 := a + dir * (i * L / n)
			var p1 := a + dir * ((i + 1) * L / n)
			var m := (p0 + p1) * 0.5
			fence_pts.append(Vector3(p0.x, 0, p0.y))
			_bx(g, "trim", Vector3(0.32, 2.3, 0.32), _at(Vector3(p0.x, 1.15, p0.y)), true)
			var r := rng.randf()
			var seg := p0.distance_to(p1) - 0.3
			if r < 0.06:
				# пролом: плита лежит на земле
				_bx(g, "plaster", Vector3(seg, 0.12, 1.8), Transform3D(Basis(Vector3.UP, yaw + rng.randf_range(-0.2, 0.2)), Vector3(m.x, 0.06, m.y) + Vector3(-dir.y, 0, dir.x) * rng.randf_range(-1.6, 1.6)))
				continue
			fence_mid.append(Vector3(m.x, 0, m.y))
			var tilt := rng.randf_range(-0.12, 0.12) if r < 0.15 else 0.0
			var bas := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, tilt)
			_bx(g, "plaster", Vector3(seg, 1.85, 0.12), Transform3D(bas, Vector3(m.x, 0.95, m.y)), false)
			_bx(g, "trim", Vector3(seg, 0.22, 0.16), Transform3D(bas, Vector3(m.x, 1.55, m.y)), false)
			_bx(g, "plinth", Vector3(seg, 0.3, 0.16), Transform3D(bas, Vector3(m.x, 0.15, m.y)), false)
			_col_xf(Vector3(seg, 1.9, 0.2), Transform3D(Basis(Vector3.UP, yaw), Vector3(m.x, 0.95, m.y)))
	# ворота
	for gx in [gate_a, gate_b]:
		_bx(g, "brick", Vector3(0.9, 3.2, 0.9), _at(Vector3(gx, 1.6, FENCE)), true)
		_bx(g, "trim", Vector3(1.05, 0.2, 1.05), _at(Vector3(gx, 3.3, FENCE)))
	_bx(g, "metal", Vector3(5.6, 2.0, 0.08), Transform3D(Basis(Vector3.UP, 1.3), Vector3(gate_a + 0.9, 1.05, FENCE - 2.6)), true)
	_bx(g, "metal", Vector3(5.4, 0.08, 2.0), Transform3D(Basis(Vector3.UP, 0.2), Vector3(gate_b - 3.0, 0.06, FENCE + 1.5)))
	# арка с вывеской
	for gx in [gate_a - 0.2, gate_b + 0.2]:
		_bx(g, "metal", Vector3(0.14, 5.2, 0.14), _at(Vector3(gx, 2.6, FENCE + 0.6)))
	_bx(g, "metal", Vector3(gate_b - gate_a + 0.6, 0.9, 0.08), _at(Vector3((gate_a + gate_b) * 0.5, 4.8, FENCE + 0.6)))
	for side in [1.0, -1.0]:
		var lb := Label3D.new()
		lb.text = "САНАТОРИЙ «ЛУЧ»"
		lb.font_size = 72
		lb.pixel_size = 0.009
		lb.modulate = Color(0.85, 0.82, 0.74)
		lb.outline_size = 0
		lb.double_sided = false
		lb.position = Vector3((gate_a + gate_b) * 0.5, 4.8, FENCE + 0.6 + side * 0.06)
		lb.rotation.y = 0.0 if side > 0.0 else PI
		lb.visibility_range_end = 70.0
		add_child(lb)
	# проходная
	var kp := Vector3(12.5, 0, FENCE - 2.0)
	_bx(g, "plaster", Vector3(4.2, 2.8, 3.2), _at(kp + Vector3(0, 1.4, 0)), true)
	_bx(g, "roof", Vector3(4.6, 0.2, 3.6), _at(kp + Vector3(0, 2.9, 0)))
	_bx(g, "glass", Vector3(2.0, 1.0, 0.05), _at(kp + Vector3(-0.6, 1.6, -1.62)))
	_bx(g, "glass", Vector3(0.05, 1.0, 1.6), _at(kp + Vector3(-2.12, 1.6, 0)))
	# шлагбаум (поднят и погнут)
	_bx(g, "metal", Vector3(0.3, 1.1, 0.3), _at(Vector3(gate_b + 1.6, 0.55, FENCE - 1.2)), true)
	_bx(g, "rust", Vector3(5.2, 0.1, 0.1), Transform3D(Basis(Vector3(0, 0, 1), 0.9), Vector3(gate_b + 0.0, 2.6, FENCE - 1.2)))


# ---------------- лес и деревья ----------------

func _forest(rng: RandomNumberGenerator) -> void:
	var kinds := []
	for k in [["ul_pine", 0.22, 4.0, 5.2], ["ul_birch", 0.24, 4.2, 5.6], ["ul_oak", 0.3, 4.2, 5.4], ["ul_dead_tree", 0.04, 3.4, 4.4]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3], String(k[0])])
	var pts: Array = []
	for gv in GROVES:
		var c: Vector2 = gv[0]
		var rr: float = gv[1]
		var n: int = gv[2]
		var tries := 0
		while n > 0 and tries < 400:
			tries += 1
			var q := c + Vector2(rng.randf_range(-rr, rr), rng.randf_range(-rr, rr))
			if q.distance_to(c) > rr or absf(q.x) > FENCE - 2.0 or absf(q.y) > FENCE - 2.0 or pave_dist(q) < 1.5 or bld_dist(q) < 3.0:
				continue
			pts.append([Vector3(q.x, 0, q.y), true, false])
			n -= 1
	for q in PARK:
		var qq: Vector2 = q
		if pave_dist(qq) > 1.2 and bld_dist(qq) > 3.0:
			pts.append([Vector3(qq.x, 0, qq.y), true, true])
	# вдоль ограды изнутри — редкий ряд, снаружи — лес кольцом в два ряда
	var t := -70.0
	while t < 70.0:
		for side in 4:
			if rng.randf() < 0.35:
				var d := FENCE - rng.randf_range(2.0, 4.0)
				var q2: Vector2 = [Vector2(t, -d), Vector2(t, d), Vector2(-d, t), Vector2(d, t)][side]
				if pave_dist(q2) > 2.0 and bld_dist(q2) > 3.0 and q2.distance_to(Vector2(ENTRY.x, ENTRY.z)) > 9.0:
					pts.append([Vector3(q2.x + rng.randf_range(-1, 1), 0, q2.y), true, false])
		t += 5.0
	t = -86.0
	while t < 86.0:
		for side in 4:
			for row in 2:
				var d := rng.randf_range(76.0, 79.5) + row * 5.0
				var along := t + rng.randf_range(-1.5, 1.5)
				var p: Vector3 = [Vector3(along, 0, -d), Vector3(along, 0, d), Vector3(-d, 0, along), Vector3(d, 0, along)][side]
				if absf(p.x - 2.0) < 6.0 and p.z > 0.0:
					continue
				pts.append([p, false, false])
		t += 4.0
	for pp in pts:
		var p: Vector3 = pp[0]
		var near := false
		for q in wood_pts:
			if q.distance_to(p) < 2.8:
				near = true
				break
		if near:
			continue
		wood_pts.append(p)
		var pick := rng.randf()
		var chosen = null
		var acc := 0.3 if not pp[2] else 0.12
		if pick >= acc:
			for k in kinds:
				acc += float(k[1])
				if pick < acc:
					chosen = k
					break
			if chosen == null and not kinds.is_empty():
				chosen = kinds[0]
		if chosen == null:
			_spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.85, 1.2)), p))
		else:
			_tree(chosen[0], p, rng.randf_range(float(chosen[2]), float(chosen[3])), rng.randf() * TAU, String(chosen[4]))
		if pp[1]:
			_cyl_col(p, 0.22, 3.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true
	mm.mesh = w._spruce_mesh(4.8, 141)
	mm.instance_count = _spruce_xf.size()
	for i in _spruce_xf.size():
		mm.set_instance_transform(i, _spruce_xf[i])
		mm.set_instance_color(i, Color.WHITE)
		mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
	w.canopy.add_multimesh(mm, 4.8)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	add_child(mi)


const TREE_TINT := {"ul_oak": Color(0.7, 0.76, 0.6), "ul_birch": Color(0.8, 0.84, 0.72), "ul_pine": Color(1.0, 1.0, 1.0), "ul_dead_tree": Color(0.62, 0.6, 0.56)}


func _tree(sc: PackedScene, p: Vector3, h: float, yaw: float, kind := "") -> void:
	var t: Node3D = sc.instantiate()
	if TREE_TINT.has(kind):
		_dirty(t, kind, TREE_TINT[kind])
	var bb: AABB = w._aabb(t)
	t.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
	t.position = p
	t.rotation.y = yaw
	add_child(t)
	_cull(t, 55.0)
	trees.append(t)
	w.canopy.add_model(t, h)


var _dirty_mats := {}


## приглушить яркую раскраску модели Tripo (одна копия материала на модель)
func _dirty(m: Node3D, key: String, col: Color) -> void:
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var g := mi as MeshInstance3D
		for s in g.mesh.get_surface_count():
			var src := g.mesh.surface_get_material(s) as StandardMaterial3D
			if src == null:
				continue
			var k := key + str(s) + str(src.get_instance_id())
			if not _dirty_mats.has(k):
				var d := src.duplicate() as StandardMaterial3D
				d.albedo_color = d.albedo_color * col
				_dirty_mats[k] = d
			g.set_surface_override_material(s, _dirty_mats[k])


func _cull(n: Node, dist: float) -> void:
	for m in n.find_children("*", "GeometryInstance3D", true, false):
		var g := m as GeometryInstance3D
		g.visibility_range_end = dist
		g.visibility_range_end_margin = 4.0


func _model(path: String, at: Vector3, yaw: float, size: float, by_height := false) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	var bb: AABB = w._aabb(n)
	n.scale = Vector3.ONE * (size / maxf(bb.size.y if by_height else maxf(bb.size.x, bb.size.z), 0.01))
	n.position = at
	n.rotation.y = yaw
	add_child(n)
	_cull(n, 60.0)
	return n


# ---------------- площадь, фонтан, беседки, площадка, фонари ----------------

func _plaza(g: Node3D, rng: RandomNumberGenerator) -> void:
	var c: Vector2 = PLAZA[0]
	var at := Vector3(c.x, 0, c.y)
	# чаша фонтана: бортик, мутная вода, ярус с чашей посередине
	_cy(g, "trim", 4.3, 4.3, 0.6, _at(at + Vector3(0, 0.3, 0)), 32)
	var water := MeshInstance3D.new()
	var wm := CylinderMesh.new()
	wm.top_radius = 3.95
	wm.bottom_radius = 3.95
	wm.height = 0.05
	wm.radial_segments = 32
	water.mesh = wm
	var wmat := StandardMaterial3D.new()
	wmat.albedo_color = Color(0.22, 0.25, 0.15)
	wmat.roughness = 0.12
	wmat.metallic = 0.1
	water.material_override = wmat
	water.position = at + Vector3(0, 0.62, 0)
	add_child(water)
	_cy(g, "plinth", 0.6, 0.75, 1.5, _at(at + Vector3(0, 1.3, 0)), 16)
	_cy(g, "trim", 1.5, 0.9, 0.35, _at(at + Vector3(0, 2.2, 0)), 20)
	_cy(g, "plinth", 0.22, 0.3, 0.9, _at(at + Vector3(0, 2.8, 0)), 10)
	_cy(g, "trim", 0.55, 0.3, 0.2, _at(at + Vector3(0, 3.3, 0)), 14)
	_cyl_col(at, 4.3, 0.7)
	# сор в фонтане: листья, ветки
	for k in 6:
		var a := rng.randf() * TAU
		var r := rng.randf_range(1.5, 3.6)
		_bx(g, "wood", Vector3(rng.randf_range(0.4, 0.9), 0.04, 0.05), Transform3D(Basis(Vector3.UP, rng.randf() * TAU), at + Vector3(cos(a) * r, 0.66, sin(a) * r)))
	# гипсовые пионеры на постаментах и бетонные вазы вокруг фонтана
	for k in 2:
		var a2 := PI * k
		var ps := at + Vector3(cos(a2), 0, sin(a2)) * 6.6
		_bx(g, "trim", Vector3(0.9, 0.7, 0.9), _at(ps + Vector3.UP * 0.35))
		_prop(MODELS + "sn_statue.glb", ps + Vector3.UP * 0.7, atan2(sin(a2), -cos(a2)), 2.0, true, "sn_statue")
		_col_xf(Vector3(0.9, 2.6, 0.9), _at(ps + Vector3.UP * 1.3))
	for k in 4:
		var a3 := TAU * k / 4.0 + PI * 0.25
		_prop(MODELS + "sn_urn.glb", at + Vector3(cos(a3), 0, sin(a3)) * 8.6, 0.0, 1.05, true, "sn_urn", 0.4, 1.0)
	# скамейки вокруг площади
	for k in 8:
		var a := TAU * (k + 0.5) / 8.0
		var p := at + Vector3(cos(a), 0, sin(a)) * (float(PLAZA[1]) - 1.1)
		_bench(g, p, a + PI * 0.5, rng)


## предмет-модель Tripo на земле: оттенок, упрощённые копии раньше, пятно-тень, столкновение (цилиндр col_r)
func _prop(path: String, at: Vector3, yaw: float, size: float, by_height: bool, key: String, col_r := 0.0, col_h := 1.2) -> Node3D:
	var n := _model(path, at, yaw, size, by_height)
	if n == null:
		return null
	_dirty(n, key, Color(0.86, 0.84, 0.8))
	for gi in n.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		(gi as GeometryInstance3D).lod_bias = 0.35
	var bb: AABB = w._aabb(n)
	blob_pts.append([at, Vector2(bb.size.x, bb.size.z), 0.0, 0.5])
	if col_r > 0.0:
		_cyl_col(at, col_r, col_h)
	return n


func _bench(g: Node3D, p: Vector3, yaw: float, rng: RandomNumberGenerator) -> void:
	# парковая скамейка — модель Tripo (чугунные ножки, рейки); лицом туда же, куда сиденье простой скамейки
	if _prop(MODELS + "sn_bench.glb", p, yaw + PI, 1.75, false, "sn_bench") != null:
		_col_xf(Vector3(1.7, 0.5, 0.5), Transform3D(Basis(Vector3.UP, yaw), p + Vector3.UP * 0.25))
		# у каждой третьей скамейки — ржавая урна с откинутой крышкой (Poly Haven, CC0)
		_bench_n += 1
		var pt := p + Basis(Vector3.UP, yaw) * Vector3(1.35, 0, 0.05)
		if _bench_n % 3 == 0 and _free_at(pt, 0.35):
			_prop(MODELS + "ph_trash.glb", pt, yaw + 0.4, 0.95, true, "ph_trash", 0.3, 0.9)
		return
	var b := Basis(Vector3.UP, yaw)
	var broken := rng.randf() < 0.2
	for sx in [-0.7, 0.7]:
		_bx(g, "plinth", Vector3(0.12, 0.45, 0.45), Transform3D(b, p + b * Vector3(sx, 0.22, 0)))
	for k in 3:
		if broken and k == 1:
			continue
		_bx(g, "wood", Vector3(1.7, 0.04, 0.12), Transform3D(b, p + b * Vector3(0, 0.46, -0.15 + k * 0.15)))
	for k in 2:
		_bx(g, "wood", Vector3(1.7, 0.1, 0.035), Transform3D(b * Basis(Vector3.RIGHT, -0.2), p + b * Vector3(0, 0.65 + k * 0.17, 0.24)))
	_col_xf(Vector3(1.7, 0.5, 0.5), Transform3D(b, p + Vector3.UP * 0.25))


## детская площадка: качели, горка, карусель, песочница
func _playground(g: Node3D) -> void:
	var c := Vector3(PLAY.x, 0, PLAY.y)
	# качели
	var s0 := c + Vector3(-4, 0, -3)
	for sx in [-1.6, 1.6]:
		for sz in [-0.7, 0.7]:
			_bx(g, "gmetal", Vector3(0.08, 2.6, 0.08), Transform3D(Basis(Vector3.RIGHT, -sz * 0.3), s0 + Vector3(sx, 1.25, sz * 0.5)))
	_bx(g, "gmetal", Vector3(3.4, 0.08, 0.08), _at(s0 + Vector3(0, 2.5, 0)))
	for sx in [-0.7, 0.7]:
		_bx(g, "metal", Vector3(0.02, 1.9, 0.02), _at(s0 + Vector3(sx - 0.2, 1.55, 0)))
		_bx(g, "metal", Vector3(0.02, 1.9, 0.02), _at(s0 + Vector3(sx + 0.2, 1.55, 0)))
		_bx(g, "wood", Vector3(0.5, 0.05, 0.22), _at(s0 + Vector3(sx, 0.6, 0)))
	_col_xf(Vector3(3.4, 2.4, 1.4), _at(s0 + Vector3(0, 1.2, 0)))
	# горка
	var h0 := c + Vector3(3, 0, -2)
	_bx(g, "wood", Vector3(1.2, 0.1, 1.2), _at(h0 + Vector3(0, 1.6, 0)))
	for sx in [-0.55, 0.55]:
		for sz in [-0.55, 0.55]:
			_bx(g, "gmetal", Vector3(0.07, 2.4, 0.07), _at(h0 + Vector3(sx, 1.2, sz)))
	_bx(g, "rust", Vector3(0.6, 0.04, 3.2), Transform3D(Basis(Vector3.RIGHT, -0.52), h0 + Vector3(0, 0.8, 1.9)))
	for k in 6:
		_bx(g, "metal", Vector3(0.6, 0.04, 0.04), _at(h0 + Vector3(0, 0.25 + k * 0.27, -0.75 - k * 0.08)))
	_col_xf(Vector3(1.4, 1.8, 1.4), _at(h0 + Vector3(0, 0.9, 0)))
	# карусель
	var k0 := c + Vector3(-2, 0, 4)
	_cy(g, "rust", 1.5, 1.5, 0.1, _at(k0 + Vector3(0, 0.35, 0)), 18)
	_cy(g, "metal", 0.07, 0.07, 1.0, _at(k0 + Vector3(0, 0.85, 0)), 6)
	for k in 4:
		var a := k * PI * 0.5
		_bx(g, "gmetal", Vector3(2.7, 0.04, 0.04), Transform3D(Basis(Vector3.UP, a), k0 + Vector3(0, 1.0, 0)))
	_cyl_col(k0, 1.5, 0.5)
	# песочница
	var p0 := c + Vector3(4, 0, 4)
	for e in [[Vector3(0, 0.15, -1.2), Vector3(2.5, 0.3, 0.12)], [Vector3(0, 0.15, 1.2), Vector3(2.5, 0.3, 0.12)], [Vector3(-1.2, 0.15, 0), Vector3(0.12, 0.3, 2.5)], [Vector3(1.2, 0.15, 0), Vector3(0.12, 0.3, 2.5)]]:
		_bx(g, "wood", e[1], _at(p0 + e[0]))
	_bx(g, "hay", Vector3(2.3, 0.1, 2.3), _at(p0 + Vector3(0, 0.05, 0)))


## беседки: восьмигранные, на столбах, с перилами и шатровой крышей
func _gazebos(g: Node3D) -> void:
	for gv in GAZEBOS:
		var c := Vector3(gv.x, 0, gv.y)
		_cy(g, "plinth", 2.9, 3.0, 0.3, _at(c + Vector3(0, 0.15, 0)), 8)
		for k in 8:
			var a := TAU * k / 8.0 + PI / 8.0
			var p := c + Vector3(cos(a), 0, sin(a)) * 2.65
			_bx(g, "wood", Vector3(0.16, 2.6, 0.16), _at(p + Vector3(0, 1.6, 0)))
			_cyl_col(p, 0.12, 2.8)
			if k != 2:
				var a2 := a + TAU / 16.0
				var pm := c + Vector3(cos(a2), 0, sin(a2)) * 2.5
				_bx(g, "wood", Vector3(2.0, 0.08, 0.06), Transform3D(Basis(Vector3.UP, -a2 + PI * 0.5), pm + Vector3(0, 1.1, 0)))
				_bx(g, "wood", Vector3(2.0, 0.5, 0.03), Transform3D(Basis(Vector3.UP, -a2 + PI * 0.5), pm + Vector3(0, 0.7, 0)))
		_cy(g, "rust", 0.05, 3.4, 1.6, _at(c + Vector3(0, 3.7, 0)), 8)
		_cy(g, "wood", 1.6, 1.6, 0.06, _at(c + Vector3(0, 0.75, 0)), 12)
		# пластиковые стулья у стола (Poly Haven, CC0): один отодвинут, другой брошен в стороне
		for e in [[3.6, 2.15, 0.2], [5.0, 2.2, 1.1]]:
			var a3: float = e[0]
			var pc := c + Vector3(cos(a3), 0, sin(a3)) * float(e[1])
			_prop(MODELS + "ph_chair.glb", pc, atan2(c.x - pc.x, c.z - pc.z) + float(e[2]), 0.86, true, "ph_chair", 0.24, 0.9)


## фонари вдоль дорог (часть погнута) и урны
func _lamps_benches(g: Node3D, rng: RandomNumberGenerator) -> void:
	for r in ROADS + PATHS:
		var pts: Array = r[0]
		var wd := float(r[1])
		var acc := 0.0
		for i in pts.size() - 1:
			var a: Vector2 = pts[i]
			var b: Vector2 = pts[i + 1]
			var L := a.distance_to(b)
			var d := (b - a) / L
			var nrm := Vector2(-d.y, d.x)
			var s := 6.0 - acc
			while s < L:
				var q := a + d * s + nrm * (wd * 0.5 + 0.6)
				if bld_dist(q) > 1.5 and absf(q.x) < FENCE - 1.0 and absf(q.y) < FENCE - 1.0 and q.distance_to(PLAZA[0]) > float(PLAZA[1]) + 0.5:
					var bent := rng.randf() < 0.18
					var bas := Basis(Vector3(d.x, 0, d.y), rng.randf_range(0.25, 0.5)) if bent else Basis()
					var p := Vector3(q.x, 0, q.y)
					if not bent and _prop(MODELS + "sn_lamp.glb", p, atan2(-nrm.y, nrm.x), 4.2, true, "sn_lamp") != null:
						_cyl_col(p, 0.1, 3.0)
						s += 16.0
						continue
					_bx(g, "gmetal", Vector3(0.1, 4.2, 0.1), Transform3D(bas, p + bas * Vector3(0, 2.1, 0)))
					_bx(g, "gmetal", Vector3(0.7, 0.06, 0.06), Transform3D(bas * Basis(Vector3.UP, atan2(-nrm.y, nrm.x)), p + bas * Vector3(0, 4.15, 0) - Vector3(nrm.x, 0, nrm.y) * 0.3))
					_bx(g, "wmetal", Vector3(0.4, 0.12, 0.22), Transform3D(bas, p + bas * Vector3(0, 4.05, 0) - Vector3(nrm.x, 0, nrm.y) * 0.6))
					_cyl_col(p, 0.1, 3.0)
					if rng.randf() < 0.35:
						_cy(g, "rust", 0.22, 0.2, 0.6, _at(p + Vector3(d.x, 0, d.y) * 0.7 + Vector3(0, 0.3, 0)), 10)
				s += 16.0
			acc = fposmod(acc + L, 16.0)
	# скамейки у дорожек
	for k in 10:
		var r: Array = PATHS[rng.randi() % PATHS.size()]
		var pts: Array = r[0]
		var a: Vector2 = pts[0]
		var b: Vector2 = pts[pts.size() - 1]
		var t := rng.randf_range(0.2, 0.8)
		var q := a.lerp(b, t)
		var d := (b - a).normalized()
		var nrm := Vector2(-d.y, d.x) * (1.0 if rng.randf() < 0.5 else -1.0)
		var p := q + nrm * (float(r[1]) * 0.5 + 0.5)
		if bld_dist(p) > 1.5 and pave_dist(p) > -0.1:
			_bench(g, Vector3(p.x, 0, p.y), atan2(nrm.x, nrm.y) + PI, rng)


## у котельной: труба, цистерна с лестницей, уголь
func _boiler_yard(g: Node3D) -> void:
	var ch := Vector3(15.5, 0, -71.0)
	_cy(g, "brick", 0.75, 1.25, 24.0, _at(ch + Vector3(0, 12.0, 0)), 16)
	for k in 4:
		_cy(g, "trim", 0.85 + (3 - k) * 0.11, 0.85 + (3 - k) * 0.11, 0.25, _at(ch + Vector3(0, 6.0 + k * 5.0, 0)), 16)
	_cyl_col(ch, 1.25, 6.0)
	var tk := Vector3(-9.5, 0, -60.0)
	_cy(g, "rust", 2.2, 2.2, 5.2, _at(tk + Vector3(0, 2.6, 0)), 20)
	_cy(g, "roof", 0.1, 2.3, 0.9, _at(tk + Vector3(0, 5.65, 0)), 20)
	_cyl_col(tk, 2.2, 5.2)
	for sx in [-0.22, 0.22]:
		_bx(g, "rust", Vector3(0.05, 5.4, 0.05), _at(tk + Vector3(2.32, 2.7, sx)))
	for k in 15:
		_bx(g, "rust", Vector3(0.04, 0.04, 0.48), _at(tk + Vector3(2.32, 0.3 + k * 0.35, 0)))
	# труба от цистерны к котельной
	_bx(g, "rust", Vector3(4.0, 0.25, 0.25), _at(Vector3(-6.0, 3.2, -60.0)))
	# куча угля у входа
	for k in 7:
		_bx(g, "roof", Vector3(1.2 - k * 0.12, 0.25, 1.0 - k * 0.1), Transform3D(Basis(Vector3.UP, k * 0.7), Vector3(-2.0 + k * 0.1, 0.12 + k * 0.08, -52.5)))


## техника: автобус, грузовик, легковушки (модели Tripo; пока модели нет — простой корпус)
func _vehicles() -> void:
	for v in VEHICLES:
		var vm: Array = VEHICLE_MODELS[String(v[0])]
		var path := MODELS + String(vm[0]) + ".glb"
		var at: Vector3 = v[1]
		var yaw: float = v[2]
		if not ResourceLoader.exists(path):
			var size := Vector3(float(vm[1]), 2.6 if String(v[0]) == "bus" else 1.5, float(vm[1]) * 0.36)
			var g := Node3D.new()
			add_child(g)
			_bx(g, "rust", size, Transform3D(Basis(Vector3.UP, yaw), at + Vector3.UP * (size.y * 0.5 + 0.3)), true)
			_flush(g)
			continue
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		var bb: AABB = w._aabb(n)
		var k := float(vm[1]) / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		n.scale = Vector3.ONE * k
		n.position = at - Vector3(0, bb.position.y * k, 0)
		n.rotation.y = yaw
		add_child(n)
		_dirty(n, String(vm[0]), vm[2])
		_cull(n, 60.0)
		var size2 := bb.size * k
		var c := bb.get_center() * k
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(size2.x * 0.92, maxf(size2.y, 1.0), size2.z * 0.92)
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at + Basis(Vector3.UP, yaw) * Vector3(c.x, maxf(size2.y, 1.0) * 0.5, c.z))
		body.add_child(cs)


## хоздвор: гаражи из профнастила, бочки, покрышки, ящики; у корпусов — мусор
func _yard_junk(g: Node3D, rng: RandomNumberGenerator) -> void:
	for gz in [32.0, 39.5]:
		var p := Vector3(67.5, 0, gz)
		_bx(g, "rust", Vector3(4.2, 2.6, 6.8), _at(p + Vector3(0, 1.3, 0)), true)
		_bx(g, "roof", Vector3(4.5, 0.12, 7.1), _at(p + Vector3(0, 2.66, 0)))
	_bx(g, "rust", Vector3(2.4, 2.4, 6.0), Transform3D(Basis(Vector3.UP, 0.1), Vector3(46.5, 1.2, 62.0)), true)
	for k in 14:
		var p := Vector3(rng.randf_range(44, 70), 0, rng.randf_range(44, 64))
		if p.distance_to(Vector3(63, 0, 53)) < 4.0 or p.distance_to(Vector3(49, 0, 55)) < 3.0:
			continue
		match k % 4:
			0:
				if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
					_cyl_col(p, 0.32, 0.9)
			1:
				_model(MODELS + "ph_tyre.glb", p, rng.randf() * TAU, 0.9)
			2:
				if _model(MODELS + "ph_crate.glb", p, rng.randf() * TAU, 0.9) != null:
					_cyl_col(p, 0.42, 0.7)
			3:
				_bx(g, "rust", Vector3(rng.randf_range(1.6, 2.4), 0.04, rng.randf_range(0.8, 1.0)), Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.1, 0.1), rng.randf() * PI, rng.randf_range(-0.15, 0.15))), p + Vector3.UP * 0.06))
	# у корпусов: битые кирпичи, доски
	for b in blds:
		for e in b.entrances:
			var p: Vector3 = e[0]
			for k in 3:
				var q := p + Vector3(rng.randf_range(-3, 3), 0, rng.randf_range(-3, 3))
				if bld_dist(Vector2(q.x, q.z)) < 0.5:
					continue
				_bx(g, "rubble", Vector3(rng.randf_range(0.3, 0.8), rng.randf_range(0.1, 0.25), rng.randf_range(0.3, 0.7)), Transform3D(Basis(Vector3.UP, rng.randf() * TAU), q + Vector3.UP * 0.08))


# ---------------- растительность ----------------

func _vegetation() -> void:
	var q := float(ULSettings.q().grass)
	var rng_m := float(ULSettings.q().range)
	var size := half * 2.0
	veg_count += ULVegetation.scatter(self, "grass", size, 1.5 * q + 0.15, func(p: Vector3) -> float:
		if absf(p.x) > half - 0.5 or absf(p.z) > half - 0.5:
			return 0.0
		var q2 := Vector2(p.x, p.z)
		if pave_d(q2) < 0.1 or bld_d(q2) < 0.3:
			return 0.0
		var m := mask_px(p)
		return clampf(m.r * 1.2 - m.g * 0.8 - 0.1, 0.0, 1.0), func(p: Vector3, r: RandomNumberGenerator) -> Color:
		var dry := smoothstep(0.45, 0.72, _noise(Vector2(p.x, p.z) / 60.0) * 0.6 + _noise(Vector2(p.x, p.z) / 17.0 + Vector2(0.37, 0.11)) * 0.4)
		return ULVegetation.grass_tint(dry, r) * Color(0.82, 0.86, 0.8), Vector2(0.25, 0.75), 1.4, 911, rng_m)
	veg_count += ULVegetation.scatter(self, "weed", size, 0.7 * q + 0.05, func(p: Vector3) -> float:
		var q2 := Vector2(p.x, p.z)
		var bd := bld_d(q2)
		var pd := pave_d(q2)
		if bd <= 0.25 or pd < 0.05:
			return 0.0
		return maxf((1.0 - smoothstep(0.3, 2.6, bd)) * 0.9, (1.0 - smoothstep(0.05, 0.9, pd)) * 0.45), func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.86, 0.9, 0.76) * r.randf_range(0.82, 1.05), Vector2(0.4, 0.75), 1.2, 912, rng_m)
	veg_count += ULVegetation.scatter(self, "nettle", size, 0.8 * q + 0.05, func(p: Vector3) -> float:
		var fd := minf(absf(absf(p.x) - FENCE), absf(absf(p.z) - FENCE))
		if fd > 1.8 or pave_d(Vector2(p.x, p.z)) < 0.3:
			return 0.0
		return (1.0 - smoothstep(0.25, 1.6, fd)) * 0.8, func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.8, 0.88, 0.76) * r.randf_range(0.85, 1.05), Vector2(0.55, 1.0), 0.9, 913, rng_m)
	veg_count += ULVegetation.scatter(self, "flower", size, 0.05 * q + 0.01, func(p: Vector3) -> float:
		var m := mask_px(p)
		if m.r < 0.5 or pave_d(Vector2(p.x, p.z)) < 0.3:
			return 0.0
		return m.r * smoothstep(0.55, 0.7, _noise(Vector2(p.x, p.z) / 11.0 + Vector2(0.2, 0.6))), func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.95, 0.95, 0.9) * r.randf_range(0.85, 1.05), Vector2(0.3, 0.5), 1.3, 914, rng_m)
	# кусты — у фасадов и вдоль ограды
	var bush: PackedScene = bush_scene()
	if bush == null:
		return
	var rng := RandomNumberGenerator.new()
	rng.seed = 915
	var placed := 0
	var tries := 0
	while placed < 70 and tries < 2000:
		tries += 1
		var p := Vector3(rng.randf_range(-FENCE + 1.5, FENCE - 1.5), 0, rng.randf_range(-FENCE + 1.5, FENCE - 1.5))
		var q2 := Vector2(p.x, p.z)
		var bd := bld_d(q2)
		var fd := minf(absf(absf(p.x) - FENCE), absf(absf(p.z) - FENCE))
		if not ((bd > 1.2 and bd < 2.6) or fd < 2.5) or pave_d(q2) < 1.0 or p.distance_to(ENTRY) < 8.0:
			continue
		var near_door := false
		for b in blds:
			for e in b.entrances:
				if (e[0] as Vector3).distance_to(p) < 3.5:
					near_door = true
		if near_door:
			continue
		var t: Node3D = bush.instantiate()
		var bb: AABB = w._aabb(t)
		t.scale = Vector3.ONE * (rng.randf_range(0.9, 1.6) / maxf(bb.size.y, 0.01))
		t.position = p
		t.rotation.y = rng.randf() * TAU
		add_child(t)
		_cull(t, 45.0)
		placed += 1


# ---------------- враги, тайники, следы ----------------

## места снаружи: двор и площадь, у ограды, в рощах, у котельной
func _yard_spots(rng: RandomNumberGenerator) -> void:
	for k in 260:
		var q := Vector2(rng.randf_range(-FENCE + 2, FENCE - 2), rng.randf_range(-FENCE + 2, FENCE - 2))
		if bld_dist(q) < 1.0 or q.distance_to(Vector2(PLAZA[0])) < 4.6:
			continue
		var tag := "yard"
		var fd := minf(absf(absf(q.x) - FENCE), absf(absf(q.y) - FENCE))
		if fd < 5.0:
			tag = "fence"
		for gv in GROVES:
			if q.distance_to(gv[0]) < float(gv[1]):
				tag = "thicket"
		if q.distance_to(Vector2(6, -62)) < 16.0 and bld_dist(q) > 1.0:
			tag = "boiler_out"
		if q.distance_to(PLAZA[0]) < float(PLAZA[1]) + 6.0:
			tag = "plaza"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


var _yard_tags: Array[String] = []


## Где враги: зоны с весами (data/sanatorium.json: zones_pustysh / zones_lottery). Зона — «двор», «площадь»,
## «ограда», «заросли», «у котельной» (снаружи) или «корпус:вид комнаты» (внутри: палаты, коридоры главного,
## столовая, номера жилого…). Каждая точка проверяется по карте проходимости (snap — ближайшая проходимая точка:
## не в стене, не в мебели, на том же этаже), не ближе safe_r к воротам и не вплотную к другому врагу.
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var c := conf()
	var np := rng.randi_range(int(c.pustysh[0]), int(c.pustysh[1]))
	var nl := rng.randi_range(int(c.lottery[0]), int(c.lottery[1]))
	var out: Array = []
	var taken: Array[Vector3] = []
	var safe_r := float(c.get("safe_r", 25.0))
	var pools := {}
	for i in yard_pts.size():
		var tg: String = _yard_tags[i]
		if not pools.has(tg):
			pools[tg] = []
		pools[tg].append(yard_pts[i])
	for b in blds:
		for sp in b.spots:
			var parts := String(sp[1]).split(":")
			var keys := [parts[0], parts[0] + ":" + parts[1]]
			if parts[1] == "cor":
				# дальние коридоры — дальше 14 м от входов корпуса
				var far := true
				for e in b.entrances:
					if (e[1] as Vector3).distance_to(sp[0]) < 14.0:
						far = false
				if far:
					keys.append("far_cor")
			for kk in keys:
				if not pools.has(kk):
					pools[kk] = []
				pools[kk].append(sp[0])
	_zone_pools(pools)
	for kind in ["infected", "lottery"]:
		var n := np if kind == "infected" else nl
		var zones: Dictionary = c.get("zones_pustysh" if kind == "infected" else "zones_lottery", {})
		var sum := 0.0
		for z in zones:
			if pools.has(z):
				sum += float(zones[z])
		for i in n:
			var placed := false
			for attempt in 40:
				var r := rng.randf() * sum
				var zone := ""
				for z in zones:
					if not pools.has(z):
						continue
					r -= float(zones[z])
					if r <= 0.0:
						zone = z
						break
				if zone == "":
					zone = "yard"
				var pool: Array = pools.get(zone, pools.get("yard", []))
				if pool.is_empty():
					continue
				var p: Vector3 = pool[rng.randi() % pool.size()]
				p += Vector3(rng.randf_range(-0.8, 0.8), 0, rng.randf_range(-0.8, 0.8))
				if absf(p.x) > spawn_limit() or absf(p.z) > spawn_limit() or Vector2(p.x - entry().x, p.z - entry().z).length() < safe_r:
					continue
				var q: Vector3 = snap.call(p)
				if Vector2(q.x - p.x, q.z - p.z).length() > 0.45 or absf(q.y - p.y) > 0.4:
					continue
				var crowd := false
				for t in taken:
					if t.distance_to(q) < 1.4:
						crowd = true
						break
				if crowd or not body_fits(Vector3(q.x, p.y, q.z), 0.3, 1.5):
					continue
				taken.append(q)
				out.append([kind, Vector3(q.x, p.y + 0.02, q.z), zone])
				placed = true
				break
			if not placed:
				push_warning("санаторий: для врага не нашлось места")
	_plan_rubers(rng, snap, pools, taken, out)
	return out


# ---------------- мебель-модели в постройках (Tripo) ----------------

## мебель Tripo из b.models — в группу этажа (скрывается с ним), на слое внутренностей
func _place_models(b: ULBlock) -> void:
	for m in b.models:
		var path := MODELS + String(m[0]) + ".glb"
		if not ResourceLoader.exists(path):
			continue
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		var bb: AABB = w._aabb(n)
		var sz: Vector3 = m[3]
		# лицо модели — в комнату (m[2] — поворот, при котором +Z смотрит от стены); модели с лицом по ±X
		# поворачиваются на четверть, тогда вдоль стены у них идёт ось Z
		var face := float(MODEL_FACE.get(String(m[0]), 0.0))
		var side := absf(sin(face)) > 0.5
		var along := bb.size.z if side else bb.size.x
		var deep := bb.size.x if side else bb.size.z
		var ra := sz.x / maxf(along, 0.01)
		var rd := sz.z / maxf(deep, 0.01)
		var ry := sz.y / maxf(bb.size.y, 0.01)
		# вписать в место: общий масштаб по самой тесной оси, остальные оси — с растяжкой не больше 35 %
		var k := minf(minf(ra, rd), ry)
		var ka := minf(ra, k * 1.35)
		var kd := minf(rd, k * 1.35)
		var ky := minf(ry, k * 1.35)
		if MODEL_FREE.has(String(m[0])):
			# плоская деталь фасада (наличник, резьба фронтона): ровно по месту по всем осям
			ka = ra
			kd = rd
			ky = ry
		n.scale = Vector3(kd, ky, ka) if side else Vector3(ka, ky, kd)
		n.rotation.y = float(m[2]) + face
		var c := bb.get_center() * n.scale
		var p: Vector3 = m[1]
		n.position = p - Basis(Vector3.UP, n.rotation.y) * Vector3(c.x, 0, c.z) - Vector3(0, bb.position.y * ky, 0)
		b._group(String(m[4])).add_child(n)
		_dirty(n, String(m[0]), Color(0.92, 0.9, 0.86))
		var outside := String(m[4]).contains("/xa") or String(m[4]).ends_with("/r")
		if not outside:
			blob_pts.append([p, Vector2(sz.x, sz.z), n.rotation.y - face, 0.5])
		for gi in n.find_children("*", "GeometryInstance3D", true, false):
			(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			# мебель мелкая на экране (камера сверху): упрощённые уровни детализации раньше — меньше треугольников
			# снаружи (наличники, трубы, резьба) — ещё раньше: деталь фасада мелкая и видна со всех сторон дома
			(gi as GeometryInstance3D).lod_bias = 0.22 if outside else 0.35
			(gi as VisualInstance3D).layers = 1 if outside else 2   # снаружи — под солнцем
		_cull(n, 26.0 if outside else 30.0)

## куда смотрит «лицо» модели Tripo (дверцы, полки): поправка поворота, рад. −π/2 — лицо по +X, π/2 — по −X,
## 0 — по +Z (мешки, бидоны, стол — без лица). Кровать — изголовьем по −X, к стене.
const MODEL_FACE := {
	"kh_fridge": -PI * 0.5, "kh_stove": -PI * 0.5, "kh_wardrobe": -PI * 0.5, "kh_sideboard": -PI * 0.5,
	"kh_jar_shelf": -PI * 0.5, "kh_bed": -PI * 0.5, "kh_counter": PI * 0.5, "kh_shop_shelf": -PI * 0.5,
	"kh_window": -PI * 0.5, "kh_gable": -PI * 0.5, "kh_door": -PI * 0.5,
	"sn_medcab": -PI * 0.5, "sn_piano": -PI * 0.5,
}
## вписываются в место ровно (без сохранения пропорций): плоские детали фасада
const MODEL_FREE := {"kh_window": true, "kh_gable": true}



## помещается ли тело такого радиуса в точке (стены, мебель, закрытые двери, техника; враги не в счёт)
func body_fits(p: Vector3, radius: float, height := 2.0) -> bool:
	var sh := CapsuleShape3D.new()
	sh.radius = radius
	sh.height = height
	var qs := PhysicsShapeQueryParameters3D.new()
	qs.shape = sh
	qs.transform = Transform3D(Basis(), p + Vector3.UP * (0.25 + height * 0.5))
	qs.collision_mask = 1 | ULDoor.LAYER
	for h in get_world_3d().direct_space_state.intersect_shape(qs, 6):
		if not (h.collider is CharacterBody3D):
			return false
	return true


## сколько Руберов в этот раз: 0, 1 или 2 — по шансам ruber_chances (data/sanatorium.json)
static func ruber_count(rng: RandomNumberGenerator, ch: Array) -> int:
	var sum := 0.0
	for v in ch:
		sum += float(v)
	if sum <= 0.0:
		return 0
	var r := rng.randf() * sum
	for i in ch.size():
		r -= float(ch[i])
		if r <= 0.0:
			return i
	return ch.size() - 1


## Руберы — после остальных (их число и места не меняют расстановку пустышей и лоторейщиков). Только просторные
## места (zones_ruber): у котельной, хоздвор, за главным корпусом, большие залы — котельная, обеденный зал, склад.
## Вокруг точки должно быть свободно на метр (восемь проб по кругу лежат на карте проходимости): не в узком
## коридоре, не в тесной комнате, не у стены. Далеко от ворот (ruber_safe_r) и не рядом друг с другом.
func _plan_rubers(rng: RandomNumberGenerator, snap: Callable, pools: Dictionary, taken: Array[Vector3], out: Array) -> void:
	var c := conf()
	var n := ruber_count(rng, c.get("ruber_chances", [1, 0, 0]))
	if n <= 0:
		return
	_extra_pools(pools)
	var zones: Dictionary = c.get("zones_ruber", {"boiler_out": 1})
	var sum := 0.0
	for z in zones:
		if not (pools.get(z, []) as Array).is_empty():
			sum += float(zones[z])
	var safe_r := float(c.get("ruber_safe_r", 45.0))
	var mine: Array[Vector3] = []
	for i in n:
		var placed := false
		for attempt in 120:
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
			if Vector2(p.x - entry().x, p.z - entry().z).length() < safe_r:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.3 or absf(q.y - p.y) > 0.4:
				continue
			var roomy := true
			for k in 8:
				var a := TAU * k / 8.0
				var e := q + Vector3(cos(a), 0, sin(a)) * 0.75
				var qe: Vector3 = snap.call(e)
				if Vector2(qe.x - e.x, qe.z - e.z).length() > 0.2 or absf(qe.y - q.y) > 0.4:
					roomy = false
					break
			if not roomy or not body_fits(Vector3(q.x, p.y, q.z), float(ULEnemy.KINDS.ruber.get("radius", 0.42)) + 0.15):
				continue
			var near := false
			for t in taken:
				if t.distance_to(q) < 2.2:
					near = true
					break
			for t in mine:
				if t.distance_to(q) < 12.0:
					near = true
					break
			if near:
				continue
			taken.append(q)
			mine.append(q)
			out.append(["ruber", Vector3(q.x, p.y + 0.02, q.z), zone])
			placed = true
			break
		if not placed:
			push_warning("санаторий: для Рубера не нашлось просторного места")


## свои зоны для пустышей и лоторейщиков (у хутора — дома, сараи, погреба по виду постройки)
func _zone_pools(_pools: Dictionary) -> void:
	pass


## особые места Рубера: хоздвор и площадка за главным корпусом
func _extra_pools(pools: Dictionary) -> void:
	var yard := Rect2(YARD.position + Vector2(2, 2), YARD.size - Vector2(4, 4))
	pools["hozdvor"] = []
	pools["behind_main"] = []
	for p in yard_pts:
		var q := Vector2(p.x, p.z)
		if yard.has_point(q):
			pools["hozdvor"].append(p)
		if absf(q.x) < 18.0 and q.y > 3.0 and q.y < 12.5:
			pools["behind_main"].append(p)


## Тайники на это посещение: содержимое — по таблицам добычи data/sanatorium.json (loot), заново каждый вход.
func roll_containers(rng: RandomNumberGenerator) -> void:
	containers.clear()
	_cont_grid.clear()
	var tables: Dictionary = conf().get("loot", {})
	var cells := int(conf().get("container_cells", 6))
	for b in blds:
		for ct in b.containers:
			var d: Dictionary = (ct as Dictionary).duplicate()
			var items: Array = []
			items.resize(cells)
			var empty_ch := float(conf().get("empty_chance", 0.3))
			if rng.randf() > empty_ch:
				for l in tables.get(String(d.kind), []):
					var ch := float(l[3]) if l.size() > 3 else 1.0
					if rng.randf() <= ch:
						var n := rng.randi_range(int(l[1]), int(l[2]))
						if n > 0:
							ULInventory.put(items, ULItems.make(String(l[0]), n))
			d["items"] = items
			var k := _cell(d.pos)
			if not _cont_grid.has(k):
				_cont_grid[k] = []
			_cont_grid[k].append(containers.size())
			containers.append(d)


## тайник в точке (ближайший, тот же этаж): индекс или −1
var _cont_grid := {}


func container_near(p: Vector3, r: float) -> int:
	var best := -1
	var bd := r
	var k0 := _cell(p)
	var near: Array = []
	for dx in [-1, 0, 1]:
		for dz in [-1, 0, 1]:
			near.append_array(_cont_grid.get(k0 + Vector2i(dx, dz), []))
	for i in near:
		var ct: Dictionary = containers[i]
		var c: Vector3 = ct.pos
		if absf(c.y - p.y) > 1.2:
			continue
		var sz: Vector3 = ct.size
		var d := Vector2(c.x - p.x, c.z - p.z).length() - maxf(sz.x, sz.z) * 0.45
		if d < bd:
			bd = d
			best = i
	return best


## хлам: в каждом корпусе — несколько кучек (в комнатах, на всех этажах), каждый вход заново
func junk_points(rng: RandomNumberGenerator) -> Array:
	return junk_in_buildings(rng)


## Ресурсы на полу построек — на всех локациях с постройками, каждое посещение по-новому. В каждой постройке часть
## свободных мест комнат занята находками по назначению комнаты: в жилых — еда, вода, бинты, патроны; на кухне
## и в столовой — консервы; в цехе, гараже и сараях — запчасти, кабель, металл; в медпункте — медицина; в конторе —
## электроника. Нет таблицы в настройках локации — находок нет. Сколько — conf: floor_share (доля мест, от и до) и floor_max, не меньше одной в постройке; что —
## conf: floor_loot (вид комнаты → [предмет, от, до, вес]; «*» — прочие комнаты). Места — готовые точки комнат
## (ULBlock.spots): там нет мебели и туда можно подойти. Запись: [точка, предмет, сколько, постройка].
func floor_loot(rng: RandomNumberGenerator) -> Array:
	var out: Array = []
	var c := conf()
	var tables: Dictionary = c.get("floor_loot", {})
	if tables.is_empty():
		return out
	var share: Array = c.get("floor_share", [0.3, 0.55])
	var cap := int(c.get("floor_max", 8))
	for b in blds:
		var pts: Array = b.spots.duplicate()
		if pts.is_empty():
			continue
		var n := mini(clampi(int(round(pts.size() * rng.randf_range(float(share[0]), float(share[1])))), 1, cap), pts.size())
		for k in n:
			var i := rng.randi() % pts.size()
			var sp: Array = pts[i]
			pts.remove_at(i)
			var parts := String(sp[1]).split(":")
			var tb: Array = tables.get(parts[1] if parts.size() > 1 else "*", tables.get("*", []))
			if tb.is_empty():
				continue
			var sum := 0.0
			for l in tb:
				sum += float(l[3])
			var r := rng.randf() * sum
			var pick: Array = tb[0]
			for l in tb:
				r -= float(l[3])
				if r <= 0.0:
					pick = l
					break
			var a := rng.randf() * TAU
			var p: Vector3 = (sp[0] as Vector3) + Vector3(cos(a), 0, sin(a)) * rng.randf_range(0.0, 0.3)
			out.append([Vector3(p.x, p.y + 0.02, p.z), String(pick[0]), rng.randi_range(int(pick[1]), int(pick[2])), b.id])
	return out


const GLOW_SHADER := """shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
// пятно света на земле: у входа — от двери (UV.y = 0) наружу, у жилы — кругом; цвет и сила — в цвете экземпляра
varying vec4 tint;
void vertex() { tint = COLOR; }
void fragment() {
	vec2 p = tint.a > 0.5 ? vec2((UV.x - 0.5) * 2.0, UV.y) : (UV - 0.5) * 2.0;
	float a = 1.0 - smoothstep(0.05, 1.0, length(p));
	ALBEDO = tint.rgb * a * a;
}
"""


## высота земли в точке (карьер — рельеф; остальные локации ровные)
func ground_y(_p: Vector2) -> float:
	return 0.0


## свои пятна света локации: [Transform3D, Color] (карьер — отсвет у минеральных жил)
func extra_glows() -> Array:
	return []


## Свет у входов — на всех локациях с постройками: из наружной двери на землю ложится тёплое пятно, над дверью
## горит лампа. Источников света нет (на телефоне каждый — заметная цена): пятна — один MultiMesh с прибавляющим
## смешением, лампы — коробочки со светящимся материалом. Двери не на уровне земли (погреба) — без света.
func _door_glows() -> void:
	var xs: Array = []          # [Transform3D, Color]
	var lamps: Array[Transform3D] = []
	for dd in doors:
		var d := dd as ULDoor
		if not d.has_meta("ext") or d.floor_i != 0:
			continue
		var n: Vector3 = d.basis.z.normalized()
		var c := d.center
		if bld_dist(Vector2(c.x + n.x * 1.3, c.z + n.z * 1.3)) < bld_dist(Vector2(c.x - n.x * 1.3, c.z - n.z * 1.3)):
			n = -n
		var gy := ground_y(Vector2(c.x + n.x * 1.5, c.z + n.z * 1.5))
		if absf(c.y - gy) > 0.9:
			continue
		var along := Vector3(-n.z, 0, n.x)
		var wd := maxf(d.width * 2.8, 3.8)
		# плоскость: x — вдоль стены, z — наружу; UV.y = 0 у двери
		xs.append([Transform3D(Basis(along * wd, Vector3.UP, n * 5.6), Vector3(c.x, gy + 0.04, c.z) + n * 2.9), Color(1.0, 0.62, 0.26, 1.0) * Color(0.62, 0.62, 0.62, 1.0)])
		lamps.append(Transform3D(Basis(along, Vector3.UP, n), Vector3(c.x, c.y + 2.42, c.z) + n * 0.2))
	xs.append_array(extra_glows())
	print("[glow] пятна света: %d (у входов %d, прочих %d)" % [xs.size(), lamps.size(), xs.size() - lamps.size()])
	if not xs.is_empty():
		var qm := QuadMesh.new()
		qm.size = Vector2(1, 1)
		qm.orientation = PlaneMesh.FACE_Y
		var sh := Shader.new()
		sh.code = GLOW_SHADER
		var gm := ShaderMaterial.new()
		gm.shader = sh
		gm.render_priority = 3
		qm.material = gm
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_colors = true
		mm.mesh = qm
		mm.instance_count = xs.size()
		for i in xs.size():
			mm.set_instance_transform(i, xs[i][0])
			mm.set_instance_color(i, xs[i][1])
		var mi := MultiMeshInstance3D.new()
		mi.name = "Glows"
		mi.multimesh = mm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
	if not lamps.is_empty():
		var bm := BoxMesh.new()
		bm.size = Vector3(0.34, 0.14, 0.2)
		var lm := StandardMaterial3D.new()
		lm.albedo_color = Color(1.0, 0.9, 0.7)
		lm.emission_enabled = true
		lm.emission = Color(1.0, 0.74, 0.4)
		lm.emission_energy_multiplier = 2.6
		bm.material = lm
		var mm2 := MultiMesh.new()
		mm2.transform_format = MultiMesh.TRANSFORM_3D
		mm2.mesh = bm
		mm2.instance_count = lamps.size()
		for i in lamps.size():
			mm2.set_instance_transform(i, lamps[i])
		var mi2 := MultiMeshInstance3D.new()
		mi2.name = "DoorLamps"
		mi2.multimesh = mm2
		mi2.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi2)


## хлам в постройках: в каждой — несколько кучек (точки — ULBlock.junk)
func junk_in_buildings(rng: RandomNumberGenerator) -> Array:
	var out: Array = []
	var per: Array = conf().get("junk_per_building", [3, 6])
	for b in blds:
		var pts: Array = b.junk.duplicate()
		var n := mini(rng.randi_range(int(per[0]), int(per[1])), pts.size())
		for k in n:
			var i := rng.randi() % pts.size()
			out.append(pts[i])
			pts.remove_at(i)
	return out


var _remains: Array[Node3D] = []


## Следы недавней гибели людей — каждый вход по-разному: засохшие пятна крови в коридорах и палатах, брошенные
## чемоданы и сумки во дворе.
func place_cows(rng: RandomNumberGenerator) -> void:
	for n in _remains:
		n.queue_free()
	_remains.clear()
	var g := Node3D.new()
	g.name = "Remains"
	add_child(g)
	_remains.append(g)
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.22, 0.04, 0.03, 0.85)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.35
	mat.albedo_texture = _blood_tex()
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	for k in int(conf().get("blood", 40)):
		var b: ULBlock = blds[rng.randi() % blds.size()]
		if b.spots.is_empty():
			continue
		var sp: Array = b.spots[rng.randi() % b.spots.size()]
		var p: Vector3 = sp[0]
		var mi := MeshInstance3D.new()
		mi.mesh = pm
		mi.material_override = mat
		mi.position = p + Vector3(rng.randf_range(-0.6, 0.6), 0.045, rng.randf_range(-0.6, 0.6))
		mi.rotation.y = rng.randf() * TAU
		var sc := rng.randf_range(0.6, 1.6)
		mi.scale = Vector3(sc * rng.randf_range(0.8, 1.6), 1, sc)
		mi.layers = 2
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
		mi.set_meta("inside", true)
	for k in 10:
		var p: Vector3 = yard_pts[rng.randi() % yard_pts.size()]
		var bx := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.62, 0.42, 0.25)
		bx.mesh = bm
		bx.material_override = ULBlock.mats["leather" if rng.randf() < 0.5 else "blanket"]
		bx.position = p + Vector3(0, 0.13, 0)
		bx.rotation = Vector3(PI * 0.5 if rng.randf() < 0.6 else 0.0, rng.randf() * TAU, 0)
		g.add_child(bx)


var _btex: Texture2D


func _blood_tex() -> Texture2D:
	if _btex != null:
		return _btex
	var n := 64
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for y in n:
		for x in n:
			var p := Vector2(x + 0.5, y + 0.5) / n - Vector2(0.5, 0.5)
			var nn := _noise(p * 1.7 + Vector2(0.3, 0.1)) * 0.6 + _noise(p * 5.0) * 0.4
			var a := clampf((0.42 - p.length() * (0.9 + nn * 0.8)) * 6.0, 0.0, 1.0)
			im.set_pixel(x, y, Color(1, 1, 1, a))
	_btex = ImageTexture.create_from_image(im)
	return _btex
