class_name ULDepot
extends ULPort
## «Железнодорожное депо» — временный нестабильный кластер 180 × 150 м, перенесённый Ульем вместе с ремонтным
## ангаром, локомотивным депо, складом, топливным узлом, сортировочным парком, грузовыми платформами, площадкой
## металлолома, тепловозами и вагонами. Планировка — по утверждённой схеме сверху: северо-запад — ремонтный ангар,
## север — локомотивное депо (пути веером из ворот), северо-восток — топливный узел, середина — сортировочный парк,
## восток — грузовые платформы, юго-запад — склад, юго-восток — хлам и техника, юг — въезд с будкой охраны.
## Поясняющих надписей из схемы и видео в мире нет: названия зон — только в интерфейсе.
## Здания проходимые (ULBlock: двери, скрытие крыши, обстановка, тайники), рельсы — повторяемые секции (шпалы
## и две нитки рельсов по ломаным), подвижной состав — отдельные модели. Общие системы — от ULSanatorium /
## ULConvoy / ULPort. Баланс и добыча — data/depot.json. Север — в сторону −Z, вход — на юге (+Z).

const D_CFG := "res://data/depot.json"
const D_NAV := "res://assets/world/nav_depot.res"
const D_MASK := "res://assets/world/tex/depot_mask.png"
const D_CACHE := "res://assets/world/depot_blocks.res"
const D_TITLE := "Железнодорожное депо"
const D_ENTRY := Vector3(2.0, 0, 70.5)
const DX := 90.0
const DZ := 75.0
const D_FX := 86.0                      ## ограда: |x| = D_FX, z от D_FN до D_FS
const D_FN := -72.0
const D_FS := 66.5
const D_GATE_X := 2.0
const GAUGE := 1.52                     ## колея, м

const D_BUILDINGS := [
	# ремонтный ангар: зал с тремя воротами (ремонтная площадка), у северной стены — инструментальная, склад
	# запчастей, технический участок, служебное помещение
	{"id": "hangar", "n": "Ремонтный ангар", "kind": "workshop", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 6.0, "te": 0.2,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.3, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-43, -48), "L": 62.0, "W": 36.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 7.0,
			"row": [["tech", 13.0], ["store", 16.0], ["tech", 13.0], ["staff", 10.0], ["store", 9.4]], "hall_type": "workshop",
			"entr": [["s+", -15.0, 4.6, "plain"], ["s+", 2.0, 4.6, "plain"], ["s+", 19.0, 4.6, "plain"], ["e+", 6.0, 1.4, "plain"]], "win_w": 1.6, "win_h": 1.0, "sill": 3.0}]},
	# локомотивное депо: три пути уходят в ворота; у северной стены — технические помещения
	{"id": "loco", "n": "Локомотивное депо", "kind": "workshop", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 6.6, "te": 0.2,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.34, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(27.5, -55.5), "L": 36.0, "W": 27.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.0,
			"row": [["tech", 12.0], ["staff", 10.0], ["store", 13.4]], "hall_type": "garage",
			"entr": [["s+", -11.0, 4.8, "plain"], ["s+", 0.0, 4.8, "plain"], ["s+", 11.0, 4.8, "plain"], ["e-", 4.0, 1.4, "plain"]], "win_w": 1.6, "win_h": 1.0, "sill": 3.2}]},
	# основной склад: зал с рядами груза, кладовые у северной стены
	{"id": "store", "n": "Склад депо", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.8, "te": 0.18,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.36, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-54, 38.5), "L": 38.0, "W": 24.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.0,
			"row": [["store", 12.0], ["store", 12.0], ["staff", 13.4]], "hall_type": "warehouse",
			"entr": [["s+", -8.0, 4.0, "plain"], ["s+", 12.0, 1.3, "plain"], ["e+", 2.5, 4.0, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.6}]},
	# навес грузовых платформ: длинный пакгауз с тремя воротами к платформе
	{"id": "plat", "n": "Пакгауз грузовых платформ", "kind": "warehouse", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 4.0, "te": 0.16,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.4, "ov": 0.5, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(61, 5.5), "L": 42.0, "W": 7.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "warehouse",
			"entr": [["s+", -14.0, 3.4, "plain"], ["s+", 0.0, 3.4, "plain"], ["s+", 14.0, 3.4, "plain"]], "blind": ["s-", "e+", "e-"], "win_w": 1.0, "win_h": 0.6, "sill": 2.4}]},
	{"id": "guard", "n": "Здание охраны", "style": "box", "skin": "plaster", "int": "int_grey1", "storey": 2.6, "te": 0.2,
		"blocks": [{"c": Vector2(15.5, 61.0), "L": 6.0, "W": 4.4, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "guard",
			"entr": [["e-", 0.0, 1.0, "plain"]], "win_w": 1.1, "win_h": 0.9, "sill": 1.0}]},
	{"id": "shop", "n": "Техническая мастерская", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 3.2, "te": 0.14,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-12.5, 40.0), "L": 9.0, "W": 7.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "workshop",
			"entr": [["e+", 0.0, 2.4, "plain"]], "blind": ["s-"], "win_w": 0.9, "win_h": 0.7, "sill": 1.5}]},
	{"id": "pump", "n": "Топливная насосная", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 2.8, "te": 0.08, "roof_mat": "q_rust",
		"blocks": [{"c": Vector2(63, -34.5), "L": 9.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.4, "plain"]], "blind": ["s-", "e+", "e-"]}]},
	{"id": "post", "n": "Служебная постройка", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.7, "te": 0.12,
		"roof_mat": "q_tin", "gable": "planks", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-3.5, -66.5), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.4, "plain"]], "blind": ["s-", "e+"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "shed_s", "n": "Сарай у площадки хлама", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.7, "te": 0.12,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(79.5, 41.0), "L": 9.0, "W": 6.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s-", 0.0, 1.6, "plain"]], "blind": ["s+", "e-"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	# открытые грузовые вагоны (кузова, снятые с тележек, на шпальных клетках): в них можно войти через сдвижную дверь
	{"id": "wag1", "n": "Открытый грузовой вагон", "style": "box", "skin": "rust", "int": "gmetal", "storey": 2.6, "te": 0.08,
		"blocks": [{"c": Vector2(-17.0, 16.5), "L": 13.2, "W": 3.1, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["s+", 0.0, 2.2, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "wag2", "n": "Открытый грузовой вагон", "style": "box", "skin": "armygreen", "int": "gmetal", "storey": 2.6, "te": 0.08,
		"blocks": [{"c": Vector2(38.0, 33.5), "L": 13.2, "W": 3.1, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["s+", 0.0, 2.2, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

## пути: ломаные (x, z). Сортировочный парк — веер от горловины у середины поля; тупики — на запад и восток;
## три пути — в ворота локомотивного депо (и дальше внутри него), один — в средние ворота ремонтного ангара.
const D_TRACKS := [
	[Vector2(5, 66), Vector2(5, 30), Vector2(3.5, 10), Vector2(2, -4)],
	[Vector2(2, -4), Vector2(6, -20), Vector2(16.5, -34), Vector2(16.5, -62.5)],
	[Vector2(2, -4), Vector2(12, -18), Vector2(27.5, -34), Vector2(27.5, -60.0)],
	[Vector2(3, -2), Vector2(20, -14), Vector2(38.5, -32), Vector2(38.5, -62.5)],
	[Vector2(2, -4), Vector2(-12, -10.6), Vector2(-78, -10.6)],
	[Vector2(2, -2), Vector2(-10, 1.8), Vector2(-79, 1.8)],
	[Vector2(3.5, 8), Vector2(-8, 7.6), Vector2(-79, 7.6)],
	[Vector2(3, -3), Vector2(22, -13), Vector2(40, -17.6), Vector2(84, -17.6)],
	[Vector2(3.5, 2), Vector2(22, -6), Vector2(38, -9.6), Vector2(84, -9.6)],
	[Vector2(5, 36), Vector2(9, 28.5), Vector2(20, 25.6), Vector2(84, 25.6)],
	[Vector2(-41, -57), Vector2(-41, -16), Vector2(-36, -10.6)],
]
## дороги (грунт с колеями)
const D_ROADS := [
	[Vector2(2, 75), Vector2(-1, 56), Vector2(-6, 50), Vector2(-24, 55), Vector2(-52, 58), Vector2(-78, 54), Vector2(-82, 30), Vector2(-82, -14), Vector2(-80, -62)],
	[Vector2(-1, 56), Vector2(12, 48), Vector2(30, 42), Vector2(56, 40)],
	[Vector2(-30, 55), Vector2(-28, 34), Vector2(-30, 20)],
	[Vector2(-80, -24), Vector2(-60, -24), Vector2(-14, -24)],
	[Vector2(-8, -30), Vector2(-4, -50), Vector2(-4, -62)],
	[Vector2(48, -24), Vector2(64, -26), Vector2(82, -24)],
]
## подвижной состав на путях, идущих вдоль x: [z пути, x начала, единицы подряд (зазор 1 м)]
const D_TRAINS := [
	[-10.6, -64.0, ["rd_shunter", "rd_boxcar", "rd_gondola", "rd_gondola"]],
	[7.6, -74.0, ["rd_tankcar", "rd_flatcar", "rd_boxcar", "rd_boxcar"]],
	[1.8, -72.0, ["rd_flatcar", "rd_gondola"]],
	[-17.6, 46.0, ["rd_boxcar", "rd_gondola", "rd_gondola"]],
	[-9.6, 38.0, ["rd_gondola", "rd_boxcar", "rd_tankcar", "rd_flatcar"]],
	[25.6, 24.0, ["rd_tankcar", "rd_gondola", "rd_boxcar", "rd_flatcar", "rd_gondola"]],
]
## единицы: длина и ширина в игре (модели Tripo коренастые: ширина — по габариту 3,1–3,25 м, длина — с растяжкой
## не больше трети, чтобы колёса не стали овалами), вид тайника, название
const D_UNITS := {
	"rd_shunter": [12.0, 3.2, "loco", "Кабина маневрового тепловоза"], "rd_loco": [13.5, 3.25, "loco", "Кабина грузового тепловоза"],
	"rd_boxcar": [11.5, 3.1, "wagon", "Крытый вагон"], "rd_gondola": [8.5, 3.15, "wagon_open", "Полувагон"],
	"rd_flatcar": [9.5, 3.1, "flat", "Платформа"], "rd_tankcar": [12.0, 3.0, "tank", "Железнодорожная цистерна"],
}
## топливный узел (северо-восток): ограда x 50…85, z −66…−27; две лежачие цистерны, стоячий резервуар, насосная
const D_FUEL := Rect2(50, -66, 35, 39)
const D_TANKS_H := [Vector3(58.5, 0, -52), Vector3(65.5, 0, -52)]
const D_TANK_V := Vector3(76.5, 0, -58)
## техника, оборудование и кучи: [модель, где, поворот, длина, вид тайника, название]
const D_THINGS := [
	["rd_gantry", Vector3(18, 0, 47), PI * 0.5, 16.0, "crane", "Шкаф козлового крана"],
	["ul_ural_wreck", Vector3(46, 0, 52), 0.6, 7.4, "truck", "Разбитый грузовик"], ["ul_car", Vector3(60, 0, 46), 1.9, 4.2, "cab", "Брошенная машина"],
	["qr_loader", Vector3(52, 0, 60), -0.5, 7.0, "machine", "Кабина погрузчика"], ["ul_bus", Vector3(70, 0, 56), 0.2, 9.0, "cab", "Салон автобуса"],
	["qr_scrap1", Vector3(34, 0, 58), 0.0, 3.2, "scrap", "Куча металлолома"], ["qr_scrap2", Vector3(62, 0, 62), 1.0, 3.2, "scrap", "Куча металлолома"],
	["qr_scrap3", Vector3(76, 0, 48), 2.0, 3.0, "scrap", "Куча металлолома"], ["qr_scrap1", Vector3(44, 0, 44), 2.4, 2.8, "scrap", "Куча металлолома"],
	["qr_scrap2", Vector3(28, 0, 50), 0.4, 2.6, "scrap", "Куча металлолома"], ["qr_scrap3", Vector3(82, 0, 60), 1.3, 2.6, "scrap", "Куча металлолома"],
	["rd_wheels", Vector3(-20, 0, -26.5), 0.2, 2.4, "parts", "Колёсные пары"], ["rd_wheels", Vector3(8, 0, -40), 1.5, 2.4, "parts", "Колёсные пары"],
	["rd_bogie", Vector3(-66, 0, -26), 0.1, 2.2, "parts", "Тележка вагона"], ["rd_bogie", Vector3(48, 0, -38), 1.2, 2.2, "parts", "Тележка вагона"],
	["rd_jack", Vector3(-50, 0, -27), 0.0, 1.2, "", ""], ["rd_jack", Vector3(-32, 0, -27), 0.0, 1.2, "", ""],
	["qr_cabledrum", Vector3(-8, 0, 24), 0.4, 2.0, "cable", "Барабан кабеля"], ["qr_transformer", Vector3(-84, 0, -30), 0.0, 2.6, "tech", "Трансформаторный шкаф"],
	["qr_compressor", Vector3(-10, 0, -34), 1.57, 2.2, "tech", "Компрессор"], ["hm_generator", Vector3(22, 0, 62.5), 0.0, 1.6, "tech", "Генератор"],
	["qr_beams", Vector3(-70, 0, 22), 0.1, 6.0, "", ""], ["qr_rails", Vector3(-22, 0, 22), 0.0, 6.0, "", ""], ["qr_sleepers", Vector3(-40, 0, 22), 0.2, 3.0, "", ""],
	["qr_sleepers", Vector3(12, 0, 16), 1.2, 3.0, "", ""], ["qr_pipes", Vector3(70, 0, -29), 0.0, 6.0, "", ""], ["ul_trailer", Vector3(-30, 0, 62), 1.5, 6.0, "trailer", "Прицеп с грузом"],
	["qr_tanker", Vector3(44, 0, -30), 1.4, 8.5, "fuel", "Топливозаправщик"],
]
## штабеля: [x, z, сколько, вид, обыскивается]
const D_PILES := [
	[-70, 53, 4, "crate", true], [-60, 53.5, 3, "pallet", true], [-40, 53, 3, "barrel", false], [-31, 47, 3, "crate", true], [-76, 34, 3, "barrel", false],
	[44, 13, 4, "crate", true], [56, 13.5, 3, "pallet", true], [68, 13, 4, "crate", true], [80, 14, 3, "barrel", false], [32, 12, 2, "pallet", true],
	[-70, -27, 3, "crate", true], [-14, -28, 3, "barrel", false], [5, -46, 2, "crate", true], [48, -46, 3, "pallet", true], [-8, -60, 2, "barrel", true],
	[10, 60, 2, "crate", true], [-18, 30, 2, "pallet", true], [66, -40, 2, "barrel", true], [82, -30, 2, "crate", true], [-84, 4, 2, "crate", true],
]

static var _dcfg := {}


static func dcfg() -> Dictionary:
	if _dcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(D_CFG))
		_dcfg = d if d is Dictionary else {}
	return _dcfg


func conf() -> Dictionary:
	return dcfg()


func entry() -> Vector3:
	return D_ENTRY


func title() -> String:
	return D_TITLE


func spawn_limit() -> float:
	return 86.0


static func d_sig() -> int:
	return hash(str(D_BUILDINGS) + "|" + str(ULBlock.GEN_V))


static func in_depot(q: Vector2) -> bool:
	return absf(q.x) < D_FX and q.y > D_FN and q.y < D_FS


static func rail_dist_s(q: Vector2) -> float:
	var d := 1e9
	for t in D_TRACKS:
		for i in (t as Array).size() - 1:
			d = minf(d, ULSanatorium._seg_dist(q, t[i], t[i + 1]))
	return d


func road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in D_ROADS:
		for i in (r as Array).size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func track_dist(_q: Vector2) -> float:
	return 1e9


func clear_w(q: Vector2) -> float:
	return 1.0 if absf(q.x) < D_FX + 1.5 and q.y > D_FN - 1.5 and q.y < D_FS + 1.5 else 0.0


func pave_dist(q: Vector2) -> float:
	return minf(road_dist(q) - 3.0, rail_dist_s(q) - 1.8)


func forest_ok(q: Vector2) -> bool:
	return (absf(q.x) > D_FX + 2.0 or q.y > D_FS + 2.5 or q.y < D_FN - 2.0) and absf(q.x - D_GATE_X) > 7.0


func forest_n() -> int:
	return 170


func _land_ok(q: Vector2) -> bool:
	return in_depot(q)


func _junk_spots() -> Array:
	var spots: Array = []
	for t in D_THINGS:
		spots.append(t[1])
	for tr in D_TRAINS:
		spots.append(Vector3(float(tr[1]) + 8.0, 0, float(tr[0]) + 3.4))
	return spots


func roll_containers(rng: RandomNumberGenerator) -> void:
	quest_box = -1
	super.roll_containers(rng)


# ---------------- сборка ----------------

func build(world: Node3D) -> void:
	w = world
	half = DX
	body = StaticBody3D.new()
	body.name = "DepotBody"
	var fn := FastNoiseLite.new()
	fn.seed = 5309
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7723
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "rdbake" and ResourceLoader.exists(D_CACHE):
		var r = load(D_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == d_sig():
			cache = r
		else:
			push_warning("депо: кэш построек устарел — пересоберите --as-test=rdbake")
	var made := {}
	for d in D_BUILDINGS:
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
		match String(d.id):
			"store", "plat":
				_p_warehouse(b, d)
			"hangar":
				_d_hangar(b)
			"loco":
				_d_loco(b)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_c_forest(rng)
	_d_ground()
	_d_tracks(props)
	ULGroundDetail.ruts(self, D_ROADS, _noise_tex, "stony_dirt_path", 1.8, func(q: Vector2) -> bool:
		return bld_dist(q) > 2.0 and rail_dist_s(q) > 2.2, 0.0, Color(0.7, 0.66, 0.6))
	_d_fences(props)
	_d_fuel(props)
	_d_stock()
	_d_things()
	_d_piles(rng)
	_d_lamps()
	_flush(props)
	_c_forest_props(6637, 6, 4)
	_c_vegetation()
	_d_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "rdbake":
		var cr := ULBlockCache.new()
		cr.sig = d_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, D_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек депо: %s (%s)" % [D_CACHE, error_string(err)])
	print("[depot] депо собрано: %d мс, построек %d, столкновений %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), _count_cont(), extra.size()])


# ---------------- земля ----------------

func _d_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_for("depot", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(D_MASK) and w.test != "rdbake":
		mask = (load(D_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _d_bake_mask()
		if w.test == "rdbake":
			mask.save_png(ProjectSettings.globalize_path(D_MASK))
			print("[bake] карта земли депо: ", D_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
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
		b.size = Vector3(1, 4, DZ * 2.0 + 20.0) if s.x != 0.0 else Vector3(DX * 2.0 + 20.0, 4, 1)
		wc.shape = b
		wc.position = Vector3(s.x * (DX + 9.0), 2.0, s.z * (DZ + 9.0))
		body.add_child(wc)
	# бетонные плиты: перед воротами ангара и депо, грузовая платформа, площадка у склада, у въезда
	_pave_rect(Rect2(-74.0, -29.6, 62.0, 8.0), 0.02, "pavers")
	_pave_rect(Rect2(9.5, -41.6, 36.0, 5.0), 0.02, "pavers")
	_pave_rect(Rect2(38.0, 9.6, 46.0, 9.4), 0.03, "pavers")
	_pave_rect(Rect2(-73.0, 50.8, 38.0, 6.0), 0.02, "pavers")
	_pave_rect(Rect2(-4.0, 60.0, 12.0, 6.0), 0.02, "asphalt")


func _d_bake_mask() -> Image:
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
			var road := 1.0 - smoothstep(2.4, 4.4, road_dist(p) + (n3 - 0.5) * 1.5)
			var rail := 1.0 - smoothstep(1.6, 3.2, rail_dist_s(p) + (n3 - 0.5) * 0.8)
			var inside := 1.0 if in_depot(p) else 0.0
			# двор депо: щебень и укатанный грунт; трава — пятнами, гуще у оград и между дальними путями
			var edge := minf(minf(D_FX - absf(p.x), D_FS - p.y), minf(p.y - D_FN, 60.0))
			var weeds := smoothstep(0.46, 0.7, n1 * 0.45 + n2 * 0.55) * 0.8 + (1.0 - smoothstep(1.0, 7.0, edge)) * 0.7
			var packed := inside * clampf(1.0 - weeds, 0.12, 1.0)
			var yard := 1.0 - smoothstep(2.0, 6.5, bld_dist(p) + (n3 - 0.5) * 2.0)
			var path := maxf(maxf(road, rail * 0.9 * inside), maxf(packed * 0.75, yard * inside * 0.9))
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path) * (1.0 - inside)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- пути ----------------

## Рельсовые пути — из одинаковых секций: щебёночная отсыпка (полоса), деревянные шпалы через 0,62 м, две нитки
## рельсов (колея 1,52 м). Без столкновений: по путям ходят (рельс — 12 см), заражённые не застревают.
## Внутри построек отсыпки нет (пол), шпалы и рельсы идут по полу до тупика.
func _d_tracks(g: Node3D) -> void:
	var n_sl := 0
	for t in D_TRACKS:
		var pts: Array = t
		# отсыпка — кусками вне построек
		var run: Array = []
		for i in pts.size():
			var q: Vector2 = pts[i]
			if bld_dist(q) > 0.5:
				run.append(q)
			else:
				if run.size() >= 2:
					_strip(run, 3.6, 0.015, "gravel")
				run = []
		if run.size() >= 2:
			_strip(run, 3.6, 0.015, "gravel")
		for i in pts.size() - 1:
			var a: Vector2 = pts[i]
			var b: Vector2 = pts[i + 1]
			var ln := a.distance_to(b)
			if ln < 0.2:
				continue
			var dir := (b - a) / ln
			var yaw := atan2(dir.x, dir.y)
			var mid := (a + b) * 0.5
			var nrm := Vector2(dir.y, -dir.x)
			for sgn in [-1.0, 1.0]:
				var o: Vector2 = mid + nrm * (GAUGE * 0.5 * sgn)
				_bx(g, "rust", Vector3(0.07, 0.13, ln + 0.06), Transform3D(Basis(Vector3.UP, yaw), Vector3(o.x, 0.12, o.y)))
			var k := 0.3
			while k < ln:
				var q := a + dir * k
				_bx(g, "beam", Vector3(2.6, 0.07, 0.24), Transform3D(Basis(Vector3.UP, yaw), Vector3(q.x, 0.04, q.y)))
				n_sl += 1
				k += 0.62
	# тупиковые упоры на концах тупиков
	for e in [[Vector2(-78, -10.6), PI * 0.5], [Vector2(-79, 1.8), PI * 0.5], [Vector2(-79, 7.6), PI * 0.5], [Vector2(84, -17.6), PI * 0.5], [Vector2(84, -9.6), PI * 0.5], [Vector2(84, 25.6), PI * 0.5]]:
		var p: Vector2 = e[0]
		if ResourceLoader.exists(MODELS + "rd_buffer.glb"):
			_pm("rd_buffer", Vector3(p.x, 0, p.y), float(e[1]), 3.2, true, true)
		else:
			_bx(g, "rust", Vector3(0.4, 1.1, 2.4), _at(Vector3(p.x, 0.55, p.y)), true)
	print("[depot] пути: ниток %d, шпал %d" % [D_TRACKS.size(), n_sl])


# ---------------- ограда, свет ----------------

func _d_fences(g: Node3D) -> void:
	var x := -D_FX
	while x < D_FX:
		var mid := x + 2.0
		if absf(mid - D_GATE_X) > 5.5:
			_pm("qr_concfence", Vector3(mid, 0, D_FS), PI * 0.5, 4.0, true, true)
		if absf(mid - 40.0) > 2.5:
			_pm("qr_concfence", Vector3(mid, 0, D_FN), PI * 0.5, 4.0, true, true)
		x += 4.0
	for sx in [-D_FX, D_FX]:
		var z := D_FN
		while z < D_FS:
			if not (sx < 0.0 and absf(z + 2.0 - 12.0) < 2.5):
				_pm("qr_concfence", Vector3(sx, 0, z + 2.0), 0.0, 4.0, true, true)
			z += 4.0
	# ворота: шлагбаум поднят, створки распахнуты; рядом — вышка-мачта
	_pm("qr_barrier", Vector3(D_GATE_X - 3.4, 0, D_FS - 1.5), -0.25, 5.0, false, true)
	for sgn in [-1.0, 1.0]:
		_bx(g, "concrete", Vector3(0.5, 2.6, 0.5), _at(Vector3(D_GATE_X + sgn * 4.8, 1.3, D_FS)), true)
		_bx(g, "rust", Vector3(3.8, 1.9, 0.08), Transform3D(Basis(Vector3.UP, sgn * 1.25), Vector3(D_GATE_X + sgn * 5.5, 1.05, D_FS + 2.0)), true)
	# ограда топливного узла (сетка), ворота — с юга у насосной
	var f := D_FUEL
	var fx := f.position.x
	while fx < f.end.x:
		_pm("qr_chainfence", Vector3(fx + 2.0, 0, f.position.y), PI * 0.5, 4.0, true, true)
		if absf(fx + 2.0 - 54.0) > 2.6:
			_pm("qr_chainfence", Vector3(fx + 2.0, 0, f.end.y), PI * 0.5, 4.0, true, true)
		fx += 4.0
	var fz := f.position.y
	while fz < f.end.y:
		if absf(fz + 2.0 - (-40.0)) > 2.6:
			_pm("qr_chainfence", Vector3(f.position.x, 0, fz + 2.0), 0.0, 4.0, true, true)
		fz += 4.0


func _d_lamps() -> void:
	for p in [Vector3(-6, 0, -22), Vector3(-10, 0, 14), Vector3(26, 0, -26), Vector3(34, 0, 20), Vector3(-30, 0, 28), Vector3(-80, 0, -22), Vector3(8, 0, 56), Vector3(-6, 0, 62), Vector3(84, 0, 34), Vector3(48, 0, -22)]:
		if ResourceLoader.exists(MODELS + "qr_floodlight.glb"):
			_pm("qr_floodlight", p, 0.0, 9.0, false, false, Color(0.86, 0.84, 0.8), true)
			_cyl_col(p, 0.25, 3.0)
		lamps_p.append(p)
	if ResourceLoader.exists(MODELS + "qr_radiotower.glb"):
		_pm("qr_radiotower", Vector3(29, 0, 62.5), 0.0, 12.0, false, false, Color(0.86, 0.84, 0.8), true)
		_cyl_col(Vector3(29, 0, 62.5), 1.2, 3.0)


# ---------------- топливный узел ----------------

func _d_fuel(g: Node3D) -> void:
	for t in D_TANKS_H:
		var p: Vector3 = t
		if ResourceLoader.exists(MODELS + "pt_tank_h.glb"):
			_pm("pt_tank_h", p, 0.0, 14.0, true, true)
		else:
			_cy(g, "rust", 2.4, 2.4, 14.0, Transform3D(Basis(Vector3(1, 0, 0), PI * 0.5), p + Vector3(0, 3.0, 0)), 20)
			_col_xf(Vector3(5.0, 5.6, 14.0), _at(p + Vector3(0, 2.8, 0)))
		_p_stash(p + Vector3(0, 0, 7.6), Vector3(1.2, 1.6, 1.2), 0.0, "fuel", "Вентиль цистерны")
	if ResourceLoader.exists(MODELS + "pt_tank_v.glb"):
		_pm("pt_tank_v", D_TANK_V, 0.0, 9.5, false, false, Color(0.86, 0.84, 0.8), true)
	else:
		_cy(g, "rust", 3.6, 3.6, 8.5, _at(D_TANK_V + Vector3(0, 4.25, 0)), 24)
	_cyl_col(D_TANK_V, 3.7, 6.0)
	# трубопровод от цистерн к насосной на низких опорах
	_cy(g, "rust", 0.16, 0.16, 16.0, Transform3D(Basis(Vector3(0, 0, 1), PI * 0.5), Vector3(66.0, 0.5, -43.0)), 8)
	_cy(g, "rust", 0.16, 0.16, 6.0, Transform3D(Basis(Vector3(1, 0, 0), PI * 0.5), Vector3(74.0, 0.5, -46.0)), 8)
	_col_xf(Vector3(16.0, 0.8, 0.5), _at(Vector3(66.0, 0.4, -43.0)))
	if ResourceLoader.exists(MODELS + "pt_pump.glb"):
		_pm("pt_pump", Vector3(72, 0, -38.5), 0.3, 2.2, true)
		_p_stash(Vector3(72, 0, -38.5), Vector3(2.0, 1.4, 1.4), 0.3, "tech", "Насосный агрегат")
	_pm("cv_jerrycans", Vector3(57.5, 0, -30.2), 0.4, 0.95, false)
	_p_stash(Vector3(57.5, 0, -30.2), Vector3(0.9, 0.6, 0.9), 0.4, "canisters", "Канистры")
	_pm("gr_barrels", Vector3(80, 0, -44), 1.2, 1.8, true)
	_pm("qr_ibc", Vector3(82, 0, -62), 0.0, 1.2, true)


# ---------------- подвижной состав, техника, штабеля ----------------

## вагоны и тепловозы — на путях вдоль x: каждая единица — своя модель по своим размерам; столкновение — коробка,
## обыск — с южной стороны у середины. Без модели — коробка-заместитель.
func _d_stock() -> void:
	var g := Node3D.new()
	g.name = "Stock"
	add_child(g)
	for tr in D_TRAINS:
		var z := float(tr[0])
		var x := float(tr[1])
		for id in tr[2]:
			var u: Array = D_UNITS[String(id)]
			var ln := float(u[0])
			var wd := float(u[1])
			var p := Vector3(x + ln * 0.5, 0.13, z)
			var hgt := _d_unit(g, String(id), p, ln, wd, true)
			_col_xf(Vector3(ln * 0.96, maxf(hgt, 1.6), wd * 0.94), _at(p + Vector3.UP * maxf(hgt, 1.6) * 0.5))
			blob_pts.append([p, Vector2(ln, wd), 0.0, 0.5])
			_p_stash(Vector3(p.x, 0, z + wd * 0.5 + 0.7), Vector3(2.4, 2.0, 1.2), 0.0, String(u[2]), String(u[3]))
			x += ln + 1.0


## единица подвижного состава своей моделью: длина — вдоль x (along_x) или z, ширина — поперёк, высота — в масштабе
## ширины. Возвращает высоту.
func _d_unit(g: Node3D, id: String, p: Vector3, ln: float, wd: float, along_x: bool) -> float:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(ln, 3.0, wd) if along_x else Vector3(wd, 3.0, ln)
		mi.mesh = bm
		mi.material_override = _box_mat(Color(0.5, 0.3, 0.24))
		mi.position = p + Vector3.UP * 2.2
		g.add_child(mi)
		return 3.8
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	ULSanatorium.mute(n)
	var bb: AABB = w._aabb(n)
	var long_x := bb.size.x > bb.size.z
	var ml := maxf(bb.size.x, bb.size.z)
	var mw := minf(bb.size.x, bb.size.z)
	var kw := wd / mw
	var kl := ln / ml
	var sc := Vector3(kl, kw, kw) if long_x else Vector3(kw, kw, kl)
	var rot := Basis(Vector3.UP, 0.0 if long_x == along_x else PI * 0.5)
	var c := bb.get_center()
	n.transform = Transform3D(rot * Basis.from_scale(sc), p + rot * Vector3(-c.x * sc.x, -bb.position.y * sc.y, -c.z * sc.z))
	add_child(n)
	_dirty(n, id, Color(0.86, 0.84, 0.8))
	_cull(n, 160.0)
	return bb.size.y * kw


func _d_things() -> void:
	for t in D_THINGS:
		var at: Vector3 = t[1]
		var big := String(t[0]) == "rd_gantry"
		var size := _pm(String(t[0]), at, float(t[2]), float(t[3]), not big, big, Color(0.82, 0.8, 0.76))
		if big:
			# козловой кран: проезд под мостом свободен, столкновения — только у опор
			for sx in [-7.2, 7.2]:
				_col_xf(Vector3(1.4, 4.0, 5.0), _at(at + Vector3(sx, 2.0, 0)))
			if get_child_count() > 0:
				_cull(get_child(get_child_count() - 1), 260.0)
			size = Vector3(1.2, 1.6, 1.2)
			at += Vector3(8.6, 0, 0)
		if String(t[4]) != "":
			_p_stash(at, size, float(t[2]), String(t[4]), String(t[5]))


func _d_piles(rng: RandomNumberGenerator) -> void:
	var models := {"crate": [["ul_crate", 1.1], ["ph_crate", 1.0], ["ul_army_crate", 1.2]], "pallet": [["qr_pallets", 1.3]], "barrel": [["ph_barrel", 0.75], ["gr_barrels", 1.6]]}
	var names := {"crate": "Грузовой ящик", "pallet": "Паллета с грузом", "barrel": "Бочки"}
	for pl in D_PILES:
		var c := Vector3(float(pl[0]), 0, float(pl[1]))
		var kinds: Array = models[String(pl[3])]
		for i in int(pl[2]):
			var m: Array = kinds[rng.randi() % kinds.size()]
			var p := c + Vector3((i % 2) * 1.5 - 0.7 + rng.randf_range(-0.15, 0.15), 0, (i / 2) * 1.5 + rng.randf_range(-0.15, 0.15))
			if not in_depot(Vector2(p.x, p.z)) or bld_dist(Vector2(p.x, p.z)) < 0.6 or rail_dist_s(Vector2(p.x, p.z)) < 2.0:
				continue
			var sz := _pm(String(m[0]), p, rng.randf() * TAU, float(m[1]), true)
			if i == 0 and bool(pl[4]):
				_p_stash(p, sz, 0.0, String(pl[3]), String(names[String(pl[3])]))


## Ремонтный ангар (зал 62 × 28 м): три ремонтных пути под воротами — на среднем вагон на домкратах; вдоль стен —
## верстаки, стена инструментов, сварочный пост, двигатель на стенде, стеллажи, компрессор; у ворот — свободно.
func _d_hangar(b: ULBlock) -> void:
	var items := [
		["gr_workbench", Vector3(-70.5, 0.2, -40), PI * 0.5, Vector3(2.4, 1.0, 0.9)], ["gr_upbench", Vector3(-70.5, 0.2, -35.5), PI * 0.5, Vector3(2.6, 1.6, 1.0)],
		["gr_pegboard", Vector3(-73.3, 0.9, -45), PI * 0.5, Vector3(2.4, 1.6, 0.2)], ["gr_welder", Vector3(-66, 0.2, -52.5), 0.0, Vector3(1.2, 1.3, 1.0)],
		["gr_engstand", Vector3(-50, 0.2, -52.5), 0.0, Vector3(1.6, 1.4, 1.2)], ["gr_shelf", Vector3(-58, 0.2, -53.2), 0.0, Vector3(2.4, 2.2, 0.7)],
		["gr_shelf2", Vector3(-33, 0.2, -53.2), 0.0, Vector3(2.4, 2.2, 0.7)], ["qr_compressor", Vector3(-16, 0.2, -52.5), 0.0, Vector3(2.0, 1.4, 1.1)],
		["hm_generator", Vector3(-13.5, 0.2, -46), PI * 0.5, Vector3(1.5, 1.1, 0.9)], ["gr_jack", Vector3(-45.5, 0.2, -44), 0.0, Vector3(0.8, 0.6, 0.8)],
		["gr_jack", Vector3(-36.5, 0.2, -44), 0.0, Vector3(0.8, 0.6, 0.8)], ["gr_tyres", Vector3(-70, 0.2, -50), 0.3, Vector3(1.6, 1.2, 1.6)],
		["rd_bogie", Vector3(-58, 0.2, -38), PI * 0.5, Vector3(2.2, 1.6, 1.6)], ["rd_wheels", Vector3(-24, 0.2, -38), 0.0, Vector3(2.4, 1.6, 2.2)],
		["gr_barrels", Vector3(-14, 0.2, -36), 0.6, Vector3(1.8, 1.0, 1.8)], ["gr_hoist", Vector3(-50, 0.2, -44), 0.0, Vector3(2.0, 2.8, 1.6)],
		["ul_crate", Vector3(-28, 0.2, -52.6), 0.2, Vector3(1.1, 0.9, 1.1)], ["qr_pallets", Vector3(-22, 0.2, -52.4), 0.0, Vector3(1.3, 1.2, 1.3)],
	]
	for it in items:
		if not ResourceLoader.exists(MODELS + String(it[0]) + ".glb"):
			continue
		var sz: Vector3 = it[3]
		var p: Vector3 = it[1]
		b.models.append([String(it[0]), p, float(it[2]), sz, "b0/n0", 0.0])
		var r := Basis(Vector3.UP, float(it[2]))
		_col_xf(Vector3(sz.x * 0.9, sz.y, sz.z * 0.9), Transform3D(r, Vector3(p.x, 0.2 + sz.y * 0.5, p.z)))
	# вагон на ремонте — на среднем пути (в глубине зала, перед ним проход)
	_d_inside(b, "rd_boxcar", Vector3(-41, 0.33, -45), 11.5, 4.3, 3.1)


## Локомотивное депо (зал 36 × 21 м): на крайних путях — грузовой и маневровый тепловозы, средний путь свободен.
func _d_loco(b: ULBlock) -> void:
	_d_inside(b, "rd_loco", Vector3(16.5, 0.33, -53), 13.5, 4.0, 3.25)
	_d_inside(b, "rd_shunter", Vector3(38.5, 0.33, -54), 12.0, 3.9, 3.2)
	for it in [["gr_workbench", Vector3(27.5, 0.2, -63.2), 0.0, Vector3(2.4, 1.0, 0.9)], ["gr_shelf", Vector3(22, 0.2, -63.4), 0.0, Vector3(2.4, 2.2, 0.7)],
			["gr_engstand", Vector3(33, 0.2, -63.0), 0.0, Vector3(1.6, 1.4, 1.2)], ["rd_wheels", Vector3(33, 0.2, -47), PI * 0.5, Vector3(2.4, 1.6, 2.2)]]:
		if not ResourceLoader.exists(MODELS + String(it[0]) + ".glb"):
			continue
		var sz: Vector3 = it[3]
		var p: Vector3 = it[1]
		b.models.append([String(it[0]), p, float(it[2]), sz, "b0/n0", 0.0])
		_col_xf(Vector3(sz.x * 0.9, sz.y, sz.z * 0.9), Transform3D(Basis(Vector3.UP, float(it[2])), Vector3(p.x, 0.2 + sz.y * 0.5, p.z)))


## единица подвижного состава внутри здания, на пути вдоль z: модель — обстановка зала (скрывается вместе с
## интерьером), столкновение — коробка, обыск — сбоку
func _d_inside(b: ULBlock, id: String, p: Vector3, ln: float, h: float, wd: float) -> void:
	var path := MODELS + id + ".glb"
	if ResourceLoader.exists(path):
		var lx := _p_long_x(path)
		b.models.append([id, p, PI * 0.5 if lx else 0.0, Vector3(ln, h, wd) if lx else Vector3(wd, h, ln), "b0/n0", 0.0])
	_col_xf(Vector3(wd * 0.96, h, ln * 0.96), _at(Vector3(p.x, h * 0.5 + 0.2, p.z)))
	_p_stash(Vector3(p.x + wd * 0.5 + 0.9, 0.2, p.z), Vector3(1.2, 2.0, 2.4), 0.0, "loco" if id != "rd_boxcar" else "wagon", {"rd_loco": "Кабина грузового тепловоза", "rd_shunter": "Кабина маневрового тепловоза", "rd_boxcar": "Вагон на ремонте"}.get(id, "Вагон"))


# ---------------- враги ----------------

func _d_spots(rng: RandomNumberGenerator) -> void:
	for k in 1100:
		var q := Vector2(rng.randf_range(-D_FX + 3.0, D_FX - 3.0), rng.randf_range(D_FN + 3.0, D_FS - 3.0))
		if bld_dist(q) < 1.2:
			continue
		var tag := "yard"
		if D_FUEL.grow(-1.0).has_point(q):
			tag = "fuel"
		elif q.x > 20.0 and q.y > 32.0:
			tag = "scrap"
		elif q.x > 26.0 and q.y > -2.0 and q.y < 22.0:
			tag = "platforms"
		elif q.y < -22.0 and q.x < -8.0:
			tag = "hangar_yard"
		elif q.y < -22.0:
			tag = "loco_yard"
		elif q.x < -24.0 and q.y > 22.0:
			tag = "store_yard"
		elif q.y > 52.0:
			tag = "gate"
		elif rail_dist_s(q) < 6.0:
			tag = "tracks"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)
