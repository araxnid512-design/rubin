class_name ULPort
extends ULConvoy
## «Порт» — временный нестабильный кластер 180 × 160 м: заброшенный речной грузовой порт, перенесённый Ульем
## вместе с причалами, судами, кранами, складами и рабочими. Планировка — по утверждённой карте сверху:
## юг — въезд с будкой охраны и управлением порта; середина — два больших склада и дорога между ними;
## север — контейнерная площадка, топливная зона (северо-запад), набережная с большим портальным краном,
## два причала с малым краном, буксиром, баржей и грузовым судном; за набережной — река.
## Общие системы (враги, тайники, двери, скрытие крыш, навигация, таймер) — от ULSanatorium / ULConvoy.
## Баланс и добыча — data/port.json. Север — в сторону −Z, вход — на юге (+Z).

const P_CFG := "res://data/port.json"
const P_NAV := "res://assets/world/nav_port.res"
const P_MASK := "res://assets/world/tex/port_mask.png"
const P_CACHE := "res://assets/world/port_blocks.res"
const P_TITLE := "Порт"
const P_ENTRY := Vector3(-1.0, 0, 74.0)
const PX := 90.0                        ## поле: x от −PX до PX, z от −PZ до PZ
const PZ := 80.0
const QUAY_Z := -44.0                   ## кромка набережной: севернее — река
const WATER_Y := -1.15
const FENCE_X := 85.0
const FENCE_Z := 70.0                   ## южная ограда (ворота — у x = −1)
const GATE_X := -1.0
## причалы: прямоугольники (x, z, ширина, длина) — уходят в реку от набережной
const PIERS := [Rect2(-51, -76, 12, 32), Rect2(46, -76, 11, 32)]

## Постройки (описания — как у корпусов санатория и построек карьера). Склады — большие залы с рядами груза и
## кладовыми у северной стены; управление порта — контора с архивом и диспетчерской; будка охраны у ворот;
## насосная в топливной зоне; открытые грузовые контейнеры — в них можно войти (20 и 40 футов: 6,1 и 12,2 м).
const P_BUILDINGS := [
	{"id": "wh1", "n": "Склад № 1", "kind": "warehouse", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 5.0, "te": 0.18,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.34, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-47, 17), "L": 58.0, "W": 22.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.0,
			"row": [["store", 12.0], ["tech", 10.0], ["store", 12.0], ["staff", 10.0], ["store", 13.4]], "hall_type": "warehouse",
			"entr": [["s+", -12.0, 4.0, "plain"], ["s+", 10.0, 4.0, "plain"], ["e+", 3.0, 1.3, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.8}]},
	{"id": "wh2", "n": "Склад № 2", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 5.0, "te": 0.18,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.34, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(49, 17), "L": 58.0, "W": 22.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.0,
			"row": [["store", 11.0], ["store", 11.0], ["tech", 12.0], ["store", 11.0], ["staff", 12.4]], "hall_type": "warehouse",
			"entr": [["s+", -14.0, 4.4, "plain"], ["s+", 12.0, 4.0, "plain"], ["e-", 3.0, 1.3, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.8}]},
	{"id": "admin", "n": "Управление порта", "kind": "office", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.3, "ov": 0.4, "chimney": false, "int": "int_beige1", "storey": 3.2,
		"blocks": [{"c": Vector2(11, 53), "L": 20.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.4,
			"row": [["office", 7.0], ["m_radio", 6.4], ["archive", 6.2]], "hall_type": "m_hall",
			"entr": [["s+", 3.0, 1.4, "porch"]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	{"id": "guard", "n": "Будка охраны", "style": "box", "skin": "plaster", "int": "int_grey1", "storey": 2.5, "te": 0.2,
		"blocks": [{"c": Vector2(7.5, 65.5), "L": 4.2, "W": 3.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "guard",
			"entr": [["e-", 0.0, 1.0, "plain"]], "win_w": 1.1, "win_h": 0.9, "sill": 1.0}]},
	{"id": "pump", "n": "Насосная", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 2.8, "te": 0.08, "roof_mat": "q_rust",
		"blocks": [{"c": Vector2(-41, -8), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.4, "plain"]], "blind": ["s-", "e+", "e-"]}]},
	{"id": "ct1", "n": "Открытый контейнер", "style": "box", "skin": "rust", "int": "gmetal", "storey": 2.5, "te": 0.08,
		"blocks": [{"c": Vector2(14, -16.5), "L": 12.2, "W": 2.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e-", 0.0, 1.9, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "ct2", "n": "Открытый контейнер", "style": "box", "skin": "armygreen", "int": "gmetal", "storey": 2.5, "te": 0.08,
		"blocks": [{"c": Vector2(22, -9.5), "L": 6.1, "W": 2.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e+", 0.0, 1.9, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "ct3", "n": "Открытый контейнер", "style": "box", "skin": "gmetal", "int": "gmetal", "storey": 2.5, "te": 0.08,
		"blocks": [{"c": Vector2(60, -12), "L": 12.2, "W": 2.6, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e+", 0.0, 1.9, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "ct4", "n": "Открытый контейнер", "style": "box", "skin": "rust", "int": "gmetal", "storey": 2.5, "te": 0.08,
		"blocks": [{"c": Vector2(71, -7), "L": 6.1, "W": 2.6, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e-", 0.0, 1.9, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "ct5", "n": "Открытый контейнер", "style": "box", "skin": "roof_tin", "int": "gmetal", "storey": 2.5, "te": 0.08,
		"blocks": [{"c": Vector2(6, -25), "L": 6.1, "W": 2.6, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "cstore",
			"entr": [["e+", 0.0, 1.9, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

## дороги (укатанный грунт с колеями): ломаные (x, z)
const P_ROADS := [
	[Vector2(-1, 80), Vector2(-1, 62), Vector2(-4, 44), Vector2(-3, 26), Vector2(-2, 4), Vector2(-8, -14), Vector2(-14, -34)],
	[Vector2(-4, 44), Vector2(-30, 38), Vector2(-62, 36)],
	[Vector2(-4, 42), Vector2(28, 37), Vector2(64, 36)],
	[Vector2(-2, 2), Vector2(26, -1), Vector2(46, -3), Vector2(78, -1)],
	[Vector2(-4, 0), Vector2(-22, -2), Vector2(-33, -8)],
	[Vector2(-60, -37), Vector2(-14, -35), Vector2(40, -37), Vector2(76, -38)],
]
## закрытые контейнеры (модель pt_container; без модели — ржавые коробки): [x, z, поворот, ярус, цвет]
const P_STACK := [
	[10, -34, 0.0, 0, 0], [16.3, -34, 0.0, 0, 1], [22.6, -34, 0.0, 0, 0], [10, -31.2, 0.0, 0, 1], [16.3, -31.2, 0.0, 0, 2], [22.6, -31.2, 0.0, 0, 0],
	[10, -34, 0.0, 1, 0], [16.3, -34, 0.0, 1, 0], [13.1, -31.2, 0.0, 1, 3], [22.6, -32.6, 0.0, 1, 1],
	[28.9, -34, 0.0, 0, 4], [28.9, -31.2, 0.0, 0, 0], [19.2, -24.5, 0.0, 0, 2], [25.5, -24.5, 0.0, 0, 0], [19.2, -24.5, 0.0, 1, 0],
	[52, -33, 0.0, 0, 1], [58.3, -33, 0.0, 0, 0], [64.6, -33, 0.0, 0, 2], [52, -30.2, 0.0, 0, 0], [58.3, -30.2, 0.0, 0, 1], [55.1, -33, 0.0, 1, 4], [61.4, -31.6, 0.0, 1, 0],
	[70.9, -33, 0.0, 0, 3], [70.9, -30.2, 0.0, 0, 2], [66, -18, PI * 0.5, 0, 2], [69, -18, PI * 0.5, 0, 2], [72, -18, PI * 0.5, 0, 4], [75, -18, PI * 0.5, 0, 0],
	[67.5, -18, PI * 0.5, 1, 2], [73.5, -18, PI * 0.5, 1, 1], [28, -17.5, 0.0, 0, 0], [28, -14.6, 0.0, 0, 3], [9, -9.5, 0.0, 0, 1],
]
const P_TINTS := [Color(0.62, 0.24, 0.19), Color(0.26, 0.36, 0.5), Color(0.7, 0.58, 0.26), Color(0.3, 0.44, 0.34), Color(0.66, 0.65, 0.62)]
const P_QUEST_BOX := [58.3, -24.0, 0.0]          ## контейнер задания «Последний груз» (закрытый, номер — в документах)
## топливная зона (северо-запад): ограда x −82…−34, z −33…2; две лежачие цистерны, стоячий резервуар, насосная
const FUEL := Rect2(-82, -33, 48, 35)
const P_TANKS_H := [Vector3(-63, 0, -22), Vector3(-63, 0, -11)]
const P_TANK_V := Vector3(-43, 0, -25)
const P_CRANE := Vector3(-22, 0, -39.5)            ## большой портальный кран — на рельсах у кромки набережной
const P_CRANE2 := Vector3(41.0, 0, -40.5)          ## малый кран — у основания восточного причала
## техника и крупные предметы: [модель, где, поворот, длина, вид тайника, название, по высоте]
const P_THINGS := [
	["ul_ural", Vector3(-50, 0, 52), 1.75, 7.4, "truck", "Кузов грузовика", false],
	["ul_ural", Vector3(42, 0, -4.5), -1.35, 7.4, "truck", "Кузов грузовика", false],
	["ul_trailer", Vector3(-30, 0, 45), 1.57, 6.0, "trailer", "Прицеп с грузом", false],
	["ul_gaz66", Vector3(-14, 0, 60), 0.3, 5.6, "truck", "Кузов ГАЗ-66", false],
	["pt_forklift", Vector3(-5.5, 0, -21), 0.6, 3.4, "forklift", "Кабина погрузчика", false],
	["pt_forklift", Vector3(52, 0, 39), -2.2, 3.4, "forklift", "Кабина погрузчика", false],
	["qr_tanker", Vector3(-30, 0, -4), 0.2, 8.5, "fuel", "Топливозаправщик", false],
	["qr_cabledrum", Vector3(36, 0, -24), 0.4, 2.0, "cable", "Барабан кабеля", false],
	["qr_cabledrum", Vector3(-70, 0, 40), 1.1, 2.0, "cable", "Барабан кабеля", false],
	["qr_transformer", Vector3(-80, 0, 6), 0.0, 2.6, "tech", "Трансформаторный шкаф", false],
	["qr_compressor", Vector3(80, 0, 30), 1.57, 2.2, "tech", "Компрессор", false],
	["hm_generator", Vector3(22, 0, 61), 0.0, 1.6, "tech", "Генератор", false],
	["qr_pipes", Vector3(-20, 0, -30), 0.1, 6.0, "", "", false],
	["qr_beams", Vector3(34, 0, 44), 0.3, 6.0, "", "", false],
	["qr_slabs", Vector3(72, 0, 50), 0.2, 4.0, "", "", false],
	["qr_scrap1", Vector3(-78, 0, 50), 0.0, 3.0, "scrap", "Куча металлолома", false],
	["qr_scrap2", Vector3(80, 0, -24), 1.0, 3.0, "scrap", "Куча металлолома", false],
	["qr_scrap3", Vector3(-10, 0, -40), 2.0, 2.6, "scrap", "Куча металлолома", false],
]
## штабеля у складов, на площадке и на причалах: [x, z, сколько, вид, обыскивается]
const P_PILES := [
	[-70, 31, 4, "crate", true], [-58, 31.5, 3, "pallet", true], [-26, 31, 3, "barrel", false], [-15.5, 22, 3, "crate", true], [-78.5, 20, 3, "barrel", false],
	[26, 31, 4, "crate", true], [44, 31.5, 3, "pallet", true], [70, 31, 3, "barrel", false], [81, 14, 3, "crate", true], [17.5, 12, 2, "pallet", false],
	[-2, -24, 3, "crate", true], [38, -31, 3, "pallet", true], [46, -22, 2, "barrel", false], [78, -30, 3, "crate", true], [34, -9, 2, "pallet", true],
	[-45, -52, 3, "crate", true], [-42, -66, 2, "pallet", true], [-48, -70, 2, "barrel", false], [51, -55, 3, "crate", true], [53, -68, 2, "pallet", true],
	[-30, -40, 2, "barrel", false], [6, -41, 3, "crate", true], [30, -41.5, 2, "barrel", false], [66, -41, 3, "pallet", true], [-66, -40, 2, "crate", true],
	[18, 62, 2, "crate", true], [-38, -1, 3, "barrel", true], [-78, -30, 2, "barrel", true],
]

static var _pcfg := {}
var water: MeshInstance3D
var quest_box := -1                     ## номер тайника-контейнера задания среди extra
var quest_where := {}                   ## что задания где лежит в это посещение: предмет → номер тайника
var lamps_p: Array = []


static func pcfg() -> Dictionary:
	if _pcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(P_CFG))
		_pcfg = d if d is Dictionary else {}
	return _pcfg


func conf() -> Dictionary:
	return pcfg()


func entry() -> Vector3:
	return P_ENTRY


func title() -> String:
	return P_TITLE


func spawn_limit() -> float:
	return 86.0


static func p_sig() -> int:
	return hash(str(P_BUILDINGS) + "|" + str(ULBlock.GEN_V))


## суша ли это (набережная, двор, причалы) — иначе река
static func on_land(q: Vector2, grow := 0.0) -> bool:
	if q.y > QUAY_Z - grow:
		return true
	for r in PIERS:
		if (r as Rect2).grow(grow).has_point(q):
			return true
	return false


## внутри ограды порта
static func in_yard(q: Vector2) -> bool:
	return absf(q.x) < FENCE_X and q.y < FENCE_Z and on_land(q)


# ---------------- расстояния (для общего кода: лес, растения, карта земли) ----------------

func road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in P_ROADS:
		for i in (r as Array).size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func track_dist(_q: Vector2) -> float:
	return 1e9


func clear_w(q: Vector2) -> float:
	return 1.0 if (absf(q.x) < FENCE_X + 1.5 and q.y < FENCE_Z + 1.5) or q.y < QUAY_Z + 2.0 else 0.0


func pave_dist(q: Vector2) -> float:
	return road_dist(q) - 3.0


func forest_ok(q: Vector2) -> bool:
	return q.y > QUAY_Z + 6.0 and (absf(q.x) > FENCE_X + 2.0 or q.y > FENCE_Z + 2.5) and absf(q.x - GATE_X) > 7.0


func forest_n() -> int:
	return 150


# ---------------- сборка ----------------

func build(world: Node3D) -> void:
	w = world
	half = PX
	body = StaticBody3D.new()
	body.name = "PortBody"
	var fn := FastNoiseLite.new()
	fn.seed = 4177
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 9241
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "ptbake" and ResourceLoader.exists(P_CACHE):
		var r = load(P_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == p_sig():
			cache = r
		else:
			push_warning("порт: кэш построек устарел — пересоберите --as-test=ptbake")
	var made := {}
	for d in P_BUILDINGS:
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
		if b.id == "wh1" or b.id == "wh2":
			_p_warehouse(b, d)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_c_forest(rng)
	_p_ground()
	_p_water(props)
	_p_boats(props)
	_p_quay(props)
	ULGroundDetail.ruts(self, P_ROADS, _noise_tex, "stony_dirt_path", 1.8, func(q: Vector2) -> bool:
		return bld_dist(q) > 2.0 and q.y > QUAY_Z + 3.0, 0.0, Color(0.66, 0.63, 0.58))
	_p_fences(props)
	_p_fuel(props)
	_p_cranes(props)
	_p_stacks()
	_p_things()
	_p_piles(rng)
	_p_lamps(props)
	_flush(props)
	_c_forest_props(5519, 6, 4)
	_c_vegetation()
	_p_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "ptbake":
		var cr := ULBlockCache.new()
		cr.sig = p_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, P_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек порта: %s (%s)" % [P_CACHE, error_string(err)])
	print("[port] порт собран: %d мс, построек %d, столкновений %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), _count_cont(), extra.size()])


# ---------------- земля, вода, набережная ----------------

## Земля — только там, где суша: прямоугольник двора и набережной (река — без земли: там вода ниже кромки).
## Карта слоёв (трава / укатанный грунт / лес / затенение) — как у остальных локаций, по мировым координатам.
func _p_ground() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_normal(Vector3.UP)
	var x0 := -PX
	var x1 := PX
	var z0 := QUAY_Z
	var z1 := PX
	var nx := 18
	var nz := 14
	for iz in nz:
		for ix in nx:
			var a := Vector3(lerpf(x0, x1, float(ix) / nx), 0, lerpf(z0, z1, float(iz) / nz))
			var b := Vector3(lerpf(x0, x1, float(ix + 1) / nx), 0, lerpf(z0, z1, float(iz + 1) / nz))
			for v in [Vector3(a.x, 0, a.z), Vector3(b.x, 0, a.z), Vector3(b.x, 0, b.z), Vector3(a.x, 0, a.z), Vector3(b.x, 0, b.z), Vector3(a.x, 0, b.z)]:
				st.set_uv(Vector2((v.x + PX) / (PX * 2.0), (v.z + PX) / (PX * 2.0)))
				st.add_vertex(v)
	var mi := MeshInstance3D.new()
	mi.mesh = st.commit()
	var sm: ShaderMaterial = w.ground_for("port", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(P_MASK) and w.test != "ptbake":
		mask = (load(P_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _p_bake_mask()
		if w.test == "ptbake":
			mask.save_png(ProjectSettings.globalize_path(P_MASK))
			print("[bake] карта земли порта: ", P_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	# за краем поля — лесная земля с трёх сторон (на севере — река до горизонта)
	var omat := ULHouse._mat("res://assets/world/tex/mud_forest", 3.5)
	omat.albedo_color = Color(0.6, 0.6, 0.54)
	var side_len := PX + 330.0 - QUAY_Z
	var side_z := QUAY_Z + side_len * 0.5
	for s in [[Vector3(PX + 165.0, -0.05, side_z), Vector2(330, side_len)], [Vector3(-PX - 165.0, -0.05, side_z), Vector2(330, side_len)], [Vector3(0, -0.05, PX + 165.0), Vector2(PX * 2.0, 330)]]:
		var o := MeshInstance3D.new()
		var op := PlaneMesh.new()
		op.size = s[1]
		o.mesh = op
		o.material_override = omat
		o.position = s[0]
		add_child(o)
	# пол: суша и причалы (над рекой пола нет: палубы судов — свои, ниже и выше причала)
	var z_land := QUAY_Z - 0.4
	_col_xf(Vector3(420, 0.2, 210.0 - z_land), _at(Vector3(0, -0.1, (z_land + 210.0) * 0.5)))
	for r in PIERS:
		var rc: Rect2 = r
		_col_xf(Vector3(rc.size.x, 0.2, rc.size.y), _at(Vector3(rc.get_center().x, -0.1, rc.get_center().y)))
	# край кластера: за ним — туман (стены стоят дальше, чем граница выхода)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, PZ * 2.0 + 20.0) if s.x != 0.0 else Vector3(PX * 2.0 + 20.0, 4, 1)
		wc.shape = b
		wc.position = Vector3(s.x * (PX + 9.0), 2.0, s.z * (PZ + 9.0))
		body.add_child(wc)


func _p_bake_mask() -> Image:
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
			var road := 1.0 - smoothstep(2.6, 4.6, road_dist(p) + (n3 - 0.5) * 1.5)
			# двор порта — укатанный грунт и щебень; трава — пятнами между плитами и вдоль оград
			var inside := 1.0 if in_yard(p) else 0.0
			var edge := minf(minf(FENCE_X - absf(p.x), FENCE_Z - p.y), 60.0)
			var weeds := smoothstep(0.5, 0.72, n1 * 0.4 + n2 * 0.6) * 0.75 + (1.0 - smoothstep(1.0, 6.0, edge)) * 0.7
			var packed := inside * clampf(1.0 - weeds, 0.15, 1.0)
			var yard := 1.0 - smoothstep(2.0, 6.0, bld_dist(p) + (n3 - 0.5) * 2.0)
			var path := maxf(road, maxf(packed * 0.8, yard * inside * 0.9))
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path) * (1.0 - inside)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


## Река: мутная вода ниже кромки набережной (до горизонта), под ней — тёмное дно. Без коллизии: к воде не пускают
## бортики.
func _p_water(_g: Node3D) -> void:
	var bed := MeshInstance3D.new()
	var bp := PlaneMesh.new()
	bp.size = Vector2(900, 460)
	bed.mesh = bp
	var bm := StandardMaterial3D.new()
	bm.albedo_color = Color(0.07, 0.085, 0.075)
	bm.roughness = 1.0
	bed.material_override = bm
	bed.position = Vector3(0, WATER_Y - 1.6, QUAY_Z - 228.0)
	bed.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(bed)
	water = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(900, 460)
	pm.subdivide_width = 1
	water.mesh = pm
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = WATER_SHADER
	sm.shader = sh
	sm.set_shader_parameter("noise", _noise_tex)
	water.material_override = sm
	water.position = Vector3(0, WATER_Y, QUAY_Z - 229.0)
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water)


## речная вода: мутно-зелёная, мелкая рябь двумя слоями шума, отблеск неба под острым углом
const WATER_SHADER := """shader_type spatial;
render_mode cull_back, depth_draw_opaque, specular_schlick_ggx;
uniform sampler2D noise : repeat_enable, filter_linear_mipmap;
varying vec3 wp;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}
void fragment() {
	vec2 p = wp.xz;
	float t = TIME * 0.035;
	float a = texture(noise, p * 0.021 + vec2(t, t * 0.6)).r;
	float b = texture(noise, p * 0.057 - vec2(t * 1.3, t * 0.4)).r;
	float c = texture(noise, p * 0.006 + vec2(-t * 0.3, t * 0.2)).r;
	float rip = a * 0.6 + b * 0.4;
	vec3 deep = vec3(0.05, 0.075, 0.066);
	vec3 shal = vec3(0.11, 0.145, 0.12);
	ALBEDO = mix(deep, shal, smoothstep(0.35, 0.75, rip) * 0.55 + c * 0.25);
	ROUGHNESS = 0.3 + rip * 0.2;
	METALLIC = 0.0;
	SPECULAR = 0.35;
	float dx = texture(noise, p * 0.057 + vec2(0.01, 0.0) - vec2(t * 1.3, t * 0.4)).r - b;
	float dz = texture(noise, p * 0.057 + vec2(0.0, 0.01) - vec2(t * 1.3, t * 0.4)).r - b;
	NORMAL = normalize((VIEW_MATRIX * vec4(normalize(vec3(-dx * 2.2, 1.0, -dz * 2.2)), 0.0)).xyz);
}
"""


## Набережная и причалы: бетонные стенки до дна, плиты причалов, бортик-колесоотбой по кромке (к воде не пройти),
## швартовые тумбы, ограждение на причалах, рельсы портального крана, лестницы к воде.
func _p_quay(g: Node3D) -> void:
	var depth := 3.2
	# бетонные плиты (в швах — трава): набережная под краном и площадки перед воротами складов
	_pave_rect(Rect2(-FENCE_X + 1.0, QUAY_Z + 0.4, FENCE_X * 2.0 - 2.0, 11.0), 0.02, "pavers")
	_pave_rect(Rect2(-74.0, 28.6, 54.0, 7.0), 0.02, "pavers")
	_pave_rect(Rect2(22.0, 28.6, 54.0, 7.0), 0.02, "pavers")
	# стенка набережной (между причалами — сплошная)
	_bx(g, "slab", Vector3(PX * 2.0 + 60.0, depth, 0.8), _at(Vector3(0, -depth * 0.5 + 0.02, QUAY_Z - 0.4)))
	for r in PIERS:
		var rc: Rect2 = r
		var c := rc.get_center()
		_bx(g, "plinth", Vector3(rc.size.x, depth, rc.size.y), _at(Vector3(c.x, -depth * 0.5 + 0.03, c.y)))
		# плиты настила: полосы поперёк причала (швы между плитами)
		var z := rc.position.y + 1.6
		while z < rc.end.y:
			_bx(g, "rust", Vector3(rc.size.x - 0.5, 0.012, 0.06), _at(Vector3(c.x, 0.04, z)))
			z += 3.2
	# бортик по кромке: вдоль набережной (кроме оснований причалов) и вокруг причалов
	var segs: Array = []
	var xs: Array = [-PX - 9.0]
	for r in PIERS:
		xs.append((r as Rect2).position.x)
		xs.append((r as Rect2).end.x)
	xs.append(PX + 9.0)
	for i in range(0, xs.size(), 2):
		segs.append([Vector2(float(xs[i]), QUAY_Z), Vector2(float(xs[i + 1]), QUAY_Z)])
	for r in PIERS:
		var rc: Rect2 = r
		segs.append([Vector2(rc.position.x, QUAY_Z), Vector2(rc.position.x, rc.position.y)])
		segs.append([Vector2(rc.position.x, rc.position.y), Vector2(rc.end.x, rc.position.y)])
		segs.append([Vector2(rc.end.x, rc.position.y), Vector2(rc.end.x, QUAY_Z)])
	for s in segs:
		var a: Vector2 = s[0]
		var b: Vector2 = s[1]
		var mid := (a + b) * 0.5
		var ln := a.distance_to(b)
		var along_x := absf(a.y - b.y) < 0.01
		# низкий бетонный бортик виден, выше него — невидимая стенка (герой и заражённые в воду не сходят)
		_bx(g, "plinth", Vector3(ln + 0.4, 0.3, 0.4) if along_x else Vector3(0.4, 0.3, ln + 0.4), _at(Vector3(mid.x, 0.15, mid.y)))
		# невидимая стенка — с проёмами у сходней судов
		var cuts: Array = []
		for sh in ships:
			var gp: Vector3 = sh.gang
			var q2 := Vector2(gp.x, gp.z)
			if gp != Vector3.INF and _seg_dist(q2, a, b) < 0.9:
				var tg := (q2 - a).dot((b - a) / ln)
				cuts.append([tg - 1.0, tg + 1.0])
		cuts.sort_custom(func(x, y): return float(x[0]) < float(y[0]))
		cuts.append([ln + 0.3, ln + 0.3])
		var t0 := -0.3
		for cu in cuts:
			var t1 := float(cu[0])
			if t1 - t0 > 0.1:
				var m2 := a.lerp(b, ((t0 + t1) * 0.5) / ln)
				_col_xf(Vector3(t1 - t0, 3.0, 0.5) if along_x else Vector3(0.5, 3.0, t1 - t0), _at(Vector3(m2.x, 1.5, m2.y)))
			t0 = float(cu[1])
		# жёлто-чёрная полоса по бортику и тумбы через 8 м
		var k := 4.0
		var has_b := ResourceLoader.exists(MODELS + "pt_bollard.glb")
		while k < ln - 2.0:
			var q := a.lerp(b, k / ln)
			if has_b:
				# швартовая тумба с канатом — на плите у бортика, вдоль кромки
				var inw := Vector2(0, 0.9) if along_x else Vector2(0.9 if q.x < (a.x + b.x) * 0.5 + 0.01 and absf(q.x - (-51.0)) < 0.5 or absf(q.x - 46.0) < 0.5 else -0.9, 0)
				var b_yaw := PI * 0.5 if along_x else 0.0
				var b_at := Vector3(q.x + inw.x, 0, q.y + inw.y)
				_pm("pt_bollard", b_at, b_yaw, 1.3, false, true)
				# сдвоенная тумба с канатом 1,3 × 0,57 × 0,55 м — столкновение по её размеру
				_col_xf(Vector3(0.5, 0.55, 1.2), _at(b_at + Vector3(0, 0.275, 0), b_yaw))
			else:
				_cy(g, "rust", 0.2, 0.26, 0.5, _at(Vector3(q.x, 0.55, q.y)), 8)
				_cy(g, "rust", 0.32, 0.2, 0.12, _at(Vector3(q.x, 0.84, q.y)), 8)
			k += 8.0
	# рельсы большого крана вдоль набережной
	for rz in [QUAY_Z + 2.2, QUAY_Z + 7.4]:
		_bx(g, "rust", Vector3(82.0, 0.1, 0.12), _at(Vector3(-8, 0.05, rz)))
	var sx := -48.0
	while sx < 33.0:
		_bx(g, "beam", Vector3(0.22, 0.05, 6.2), _at(Vector3(sx, 0.025, QUAY_Z + 4.8)))
		sx += 1.6
	# лестницы к воде у причалов (сходни — декор: проход закрыт бортиком)
	for lx in [-36.5, 43.5]:
		for stp in 5:
			_bx(g, "concrete", Vector3(1.6, 0.2, 0.34), _at(Vector3(lx, -0.12 - stp * 0.22, QUAY_Z - 1.0 - stp * 0.34)))


# ---------------- ограда, ворота, свет ----------------

func _p_fences(g: Node3D) -> void:
	# юг: бетонные секции с проёмом ворот; местами — провалы (ограда повреждена, но снаружи — лес и край кластера)
	var x := -FENCE_X
	var gap := [-64.0, 52.0]
	while x < FENCE_X:
		var mid := x + 2.0
		var skip := absf(mid - GATE_X) < 5.5
		for gx in gap:
			if absf(mid - float(gx)) < 2.5:
				skip = true
		if not skip:
			_pm("qr_concfence", Vector3(mid, 0, FENCE_Z), PI * 0.5, 4.0, true, true)
		x += 4.0
	# запад и восток: сетка на столбах
	for sx in [-FENCE_X, FENCE_X]:
		var z := QUAY_Z + 2.0
		while z < FENCE_Z:
			_pm("qr_chainfence", Vector3(sx, 0, z + 2.0), 0.0, 4.0, true, true)
			z += 4.0
	# ворота: шлагбаум поднят, створки распахнуты
	_barrier(Vector3(GATE_X + 3.2, 0, FENCE_Z - 1.5), 0.25)
	for sgn in [-1.0, 1.0]:
		_bx(g, "concrete", Vector3(0.5, 2.6, 0.5), _at(Vector3(GATE_X + sgn * 4.6, 1.3, FENCE_Z)), true)
		_bx(g, "rust", Vector3(3.6, 1.9, 0.08), Transform3D(Basis(Vector3.UP, sgn * 1.25), Vector3(GATE_X + sgn * 5.2, 1.05, FENCE_Z + 1.9)), true)
	# ограда топливной зоны (сетка), ворота — с востока у насосной
	var f := FUEL
	var fx := f.position.x
	while fx < f.end.x:
		_pm("qr_chainfence", Vector3(fx + 2.0, 0, f.position.y), PI * 0.5, 4.0, true, true)
		if absf(fx + 2.0 - (-58.0)) > 3.0:
			_pm("qr_chainfence", Vector3(fx + 2.0, 0, f.end.y), PI * 0.5, 4.0, true, true)
		fx += 4.0
	var fz := f.position.y
	while fz < f.end.y:
		_pm("qr_chainfence", Vector3(f.position.x, 0, fz + 2.0), 0.0, 4.0, true, true)
		if absf(fz + 2.0 - (-15.0)) > 3.0:
			_pm("qr_chainfence", Vector3(f.end.x, 0, fz + 2.0), 0.0, 4.0, true, true)
		fz += 4.0


## модель из assets/world по длине; along — yaw задаёт, куда смотрит длинная сторона
## Шлагбаум у ворот (модель — две стойки и перекладина на высоте 2,4 м, стоит вдоль дороги сбоку от проезда):
## столкновения — у обеих стоек, под перекладиной проход свободен.
func _barrier(at: Vector3, yaw: float) -> void:
	_pm("qr_barrier", at, yaw, 5.0, false, true)
	var bs := Basis(Vector3.UP, yaw)
	for sgn in [-1.0, 1.0]:
		_col_xf(Vector3(1.1, 3.0, 0.9), Transform3D(bs, at + bs * Vector3(0, 1.5, sgn * 2.0)))


func _pm(id: String, at: Vector3, yaw: float, length: float, collide := true, along := false, tint := Color(0.86, 0.84, 0.8), by_height := false, key := "") -> Vector3:
	var path := MODELS + id + ".glb"
	if ResourceLoader.exists(path) and along and _p_long_x(path):
		yaw -= PI * 0.5
	var sz := _c_model_box(path, at, yaw, length, tint, id if key == "" else key, collide, by_height)
	if length >= 6.0 and get_child_count() > 0:
		_cull(get_child(get_child_count() - 1), 130.0)
	return sz


var _plx := {}


func _p_long_x(path: String) -> bool:
	if not _plx.has(path):
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		var bb: AABB = w._aabb(n)
		n.free()
		_plx[path] = bb.size.x > bb.size.z
	return _plx[path]


func _p_stash(at: Vector3, size: Vector3, yaw: float, kind: String, n: String) -> int:
	extra.append({"pos": at, "size": size, "yaw": yaw, "kind": kind, "n": n})
	return extra.size() - 1


func _p_lamps(_g: Node3D) -> void:
	for p in [Vector3(-20, 0, 34), Vector3(22, 0, 34), Vector3(-6, 0, -6), Vector3(40, 0, -40), Vector3(-34, 0, -40), Vector3(78, 0, -40), Vector3(-80, 0, 62), Vector3(80, 0, 62), Vector3(-6, 0, 64)]:
		if ResourceLoader.exists(MODELS + "qr_floodlight.glb"):
			_pm("qr_floodlight", p, 0.0, 9.0, false, false, Color(0.86, 0.84, 0.8), true)
			_cyl_col(p, 0.25, 3.0)
		lamps_p.append(p)


# ---------------- топливная зона ----------------

func _p_fuel(g: Node3D) -> void:
	for t in P_TANKS_H:
		var p: Vector3 = t
		if ResourceLoader.exists(MODELS + "pt_tank_h.glb"):
			_pm("pt_tank_h", p, PI * 0.5, 14.0, true, true)
		else:
			_cy(g, "rust", 2.6, 2.6, 18.0, Transform3D(Basis(Vector3(0, 0, 1), PI * 0.5), p + Vector3(0, 3.2, 0)), 20)
			for sx in [-6.0, 6.0]:
				_bx(g, "concrete", Vector3(1.0, 1.2, 4.6), _at(p + Vector3(sx, 0.6, 0)))
			_col_xf(Vector3(18.0, 5.8, 5.2), _at(p + Vector3(0, 2.9, 0)))
		_p_stash(p + Vector3(9.6, 0, 0), Vector3(1.2, 1.6, 1.2), 0.0, "fuel", "Вентиль цистерны")
	if ResourceLoader.exists(MODELS + "pt_tank_v.glb"):
		_pm("pt_tank_v", P_TANK_V, 0.0, 9.0, false, false, Color(0.86, 0.84, 0.8), true)
	else:
		_cy(g, "rust", 3.4, 3.4, 8.0, _at(P_TANK_V + Vector3(0, 4.0, 0)), 24)
		_cy(g, "rust", 0.4, 3.5, 1.0, _at(P_TANK_V + Vector3(0, 8.5, 0)), 24)
	_cyl_col(P_TANK_V, 3.5, 6.0)
	# трубы: от цистерн к насосной и к набережной (на низких опорах)
	for z in [-22.0, -11.0]:
		_cy(g, "rust", 0.16, 0.16, 12.0, Transform3D(Basis(Vector3(0, 0, 1), PI * 0.5), Vector3(-47.5, 0.5, z)), 8)
	_cy(g, "rust", 0.16, 0.16, 12.0, Transform3D(Basis(Vector3(1, 0, 0), PI * 0.5), Vector3(-41.5, 0.5, -16.5)), 8)
	_col_xf(Vector3(12.0, 0.8, 0.5), _at(Vector3(-47.5, 0.4, -22.0)))
	_col_xf(Vector3(4.0, 0.8, 0.5), _at(Vector3(-51.5, 0.4, -11.0)))
	if ResourceLoader.exists(MODELS + "pt_pump.glb"):
		_pm("pt_pump", Vector3(-48, 0, -16.5), 0.3, 2.2, true)
		_p_stash(Vector3(-48, 0, -16.5), Vector3(2.0, 1.4, 1.4), 0.3, "tech", "Насосный агрегат")
	# канистры и бочки у насосной
	_pm("cv_jerrycans", Vector3(-37.5, 0, -3.6), 0.4, 0.95, false)
	_p_stash(Vector3(-37.5, 0, -3.6), Vector3(0.9, 0.6, 0.9), 0.4, "canisters", "Канистры")
	_pm("gr_barrels", Vector3(-46, 0, -3.8), 1.2, 1.8, true)
	_pm("qr_ibc", Vector3(-70, 0, -30), 0.0, 1.2, true)


# ---------------- краны ----------------

func _p_cranes(g: Node3D) -> void:
	var c := P_CRANE
	if ResourceLoader.exists(MODELS + "pt_crane.glb"):
		_pm("pt_crane", c, 0.0, 30.0, false, false, Color(0.9, 0.86, 0.8), true)
		if get_child_count() > 0:
			_cull(get_child(get_child_count() - 1), 400.0)
	else:
		_crane_box(g, c, 1.0)
	# опоры крана — по углам портала (между ними — проезд)
	for sx in [-4.2, 4.2]:
		for sz in [-2.6, 2.6]:
			_col_xf(Vector3(1.3, 4.0, 1.3), _at(c + Vector3(sx, 2.0, sz)))
	_p_stash(c + Vector3(4.2, 0, 4.0), Vector3(1.2, 1.6, 1.2), 0.0, "crane", "Ящик крановщика")
	var c2 := P_CRANE2
	if ResourceLoader.exists(MODELS + "pt_crane2.glb"):
		_pm("pt_crane2", c2, PI * 0.75, 15.0, false, false, Color(0.86, 0.84, 0.8), true)
		if get_child_count() > 0:
			_cull(get_child(get_child_count() - 1), 300.0)
	else:
		_crane_box(g, c2, 0.5)
	_col_xf(Vector3(3.0, 4.0, 3.0), _at(c2 + Vector3(0, 2.0, 0)))
	_p_stash(c2 + Vector3(0, 0, 2.4), Vector3(1.2, 1.4, 1.0), 0.0, "crane", "Шкаф управления краном")


## кран из балок — пока нет модели: портал на четырёх опорах, машинное отделение, стрела с грузом
func _crane_box(g: Node3D, c: Vector3, k: float) -> void:
	for sx in [-4.2, 4.2]:
		for sz in [-2.6, 2.6]:
			_bx(g, "rust", Vector3(0.7, 12.0, 0.7) * Vector3(k, k, k), _at(c + Vector3(sx, 6.0, sz) * k))
	_bx(g, "rust", Vector3(10.0, 1.0, 6.4) * k, _at(c + Vector3(0, 12.4, 0) * k))
	_bx(g, "rust", Vector3(6.0, 4.0, 4.6) * k, _at(c + Vector3(0, 15.0, 0.6) * k))
	_bx(g, "rust", Vector3(0.8, 0.8, 26.0) * k, Transform3D(Basis(Vector3.RIGHT, 0.7), c + Vector3(0, 23.0, -9.0) * k))
	_bx(g, "rust", Vector3(0.08, 12.0, 0.08) * k, _at(c + Vector3(0, 24.0, -18.5) * k))
	_bx(g, "rust", Vector3(6.1, 2.6, 2.44) * k, _at(c + Vector3(0, 16.5, -18.5) * k))


# ---------------- суда ----------------

## Суда с проходимыми палубами. Модель Tripo — цельный корпус с надстройкой; палубы, по которым ходят, заданы
## поверх неё прямоугольниками (в долях длины модели: t — вдоль корпуса от кормового края модели, s — поперёк от
## оси; высота — в % длины): настил, перила по краю, сходня с причала и трап на вторую палубу строятся здесь же,
## поэтому пол ровный, а проходы — гарантированные. Запись: модель, середина корпуса (x, z), ось длинной стороны,
## длина м, высоты палуб %, высота первой палубы над причалом м, начало сходни у кромки причала, тайник (название,
## палуба), настилы [палуба, t0, t1, s0, s1, зеркалить к причалу], трап [t низа, t верха, s, зеркалить от причала].
const P_SHIPS := [
	# буксир: кормовая палуба (сходня — на неё), крыша рубки — верхняя палуба
	{"id": "pt_tug", "c": Vector2(-56.5, -62), "axis": "z", "len": 16.0, "lv": [12.5, 30.5], "y0": 0.7, "gang": Vector2(-51.0, -67.5), "stash": ["Рубка буксира", 1],
		"decks": [[0, 0.63, 0.94, -0.12, 0.12, false], [1, 0.385, 0.535, -0.09, 0.09, false]],
		"stair": [0.81, 0.54, 0.0, false]},
	# баржа: палуба кольцом вокруг открытого трюма, трап вниз в трюм
	{"id": "pt_barge", "c": Vector2(62.0, -60), "axis": "z", "len": 26.0, "lv": [12.5, 8.5], "y0": 0.9, "gang": Vector2(57.0, -55.0), "stash": ["Трюм баржи", 1],
		"decks": [[0, 0.06, 0.94, -0.145, 0.145, false], [1, 0.24, 0.735, -0.06, 0.06, false]],
		"stair": [0.655, 0.742, 0.0, false]},
	# грузовое судно: главная палуба вдоль трюмных крышек, крыша надстройки — верхняя палуба
	{"id": "pt_ship", "c": Vector2(8, -52.5), "axis": "x", "len": 34.0, "lv": [11.0, 20.5], "y0": 1.0, "gang": Vector2(8.0, -44.0), "stash": ["Палуба грузового судна", 1],
		"decks": [[0, 0.24, 0.86, -0.09, 0.09, false], [1, 0.105, 0.228, -0.07, 0.07, false]],
		"stair": [0.36, 0.232, 0.062, true]},
]
var ships: Array = []                   ## {id, gang, deck, upper, stair0, stash, y} — сходня, точка на палубе, верх и низ трапа


func _p_boats(g: Node3D) -> void:
	for s in P_SHIPS:
		_p_ship(g, s)


func _p_ship(g: Node3D, s: Dictionary) -> void:
	var id := String(s.id)
	var c2: Vector2 = s.c
	var along_z := String(s.axis) == "z"
	var ln := float(s.len)
	var levels: Array = s.lv
	var gp: Vector2 = s.gang
	var path := MODELS + id + ".glb"
	var y_bot := float(s.y0) - float(levels[0]) * 0.01 * ln
	var y_lv: Array = []
	for lv in levels:
		y_lv.append(y_bot + float(lv) * 0.01 * ln)
	# система корпуса: t — вдоль (0…1), s — поперёк (в долях длины)
	var yaw := PI * 0.5 if along_z else 0.0
	var rot := Basis(Vector3.UP, yaw)
	var wid := 0.25
	if ResourceLoader.exists(path):
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		ULSanatorium.mute(n)
		var bb: AABB = w._aabb(n)
		var long_x := bb.size.x > bb.size.z
		var k := ln / maxf(bb.size.x, bb.size.z)
		var mrot := rot if long_x else rot * Basis(Vector3.UP, -PI * 0.5)
		var cb := bb.get_center()
		n.transform = Transform3D(mrot.scaled(Vector3.ONE * k), Vector3(c2.x, y_bot, c2.y) - mrot * (Vector3(cb.x, bb.position.y, cb.z) * k))
		add_child(n)
		_dirty(n, id, Color(0.86, 0.84, 0.8))
		_cull(n, 300.0)
		wid = minf(bb.size.x, bb.size.z) / maxf(bb.size.x, bb.size.z)
	else:
		_bx(g, "rust", Vector3(ln, 2.6, ln * wid), Transform3D(rot, Vector3(c2.x, float(y_lv[0]) - 1.3, c2.y)))
	# точка корпуса (t, s) → мир
	var to_w := func(t: float, sv: float) -> Vector2:
		var l := rot * Vector3((t - 0.5) * ln, 0, sv * ln)
		return Vector2(c2.x + l.x, c2.y + l.z)
	var to_ts := func(q: Vector2) -> Vector2:
		var l := rot.inverse() * Vector3(q.x - c2.x, 0, q.y - c2.y)
		return Vector2(l.x / ln + 0.5, l.z / ln)
	var ps := signf((to_ts.call(gp) as Vector2).y)          # с какой стороны корпуса причал
	if ps == 0.0:
		ps = 1.0
	var rects: Array = []
	for d in s.decks:
		var s0 := float(d[3])
		var s1 := float(d[4])
		if bool(d[5]):
			var a0 := s0 * ps
			var a1 := s1 * ps
			s0 = minf(a0, a1)
			s1 = maxf(a0, a1)
		rects.append([int(d[0]), float(d[1]), float(d[2]), s0, s1])
	var level_at := func(q: Vector2) -> int:
		var ts: Vector2 = to_ts.call(q)
		var out := -1
		for r in rects:
			if ts.x >= float(r[1]) and ts.x <= float(r[2]) and ts.y >= float(r[3]) and ts.y <= float(r[4]):
				out = int(r[0])                 # позже в списке — главнее (трюм вырезается из палубы)
		return out
	# сетка 0,5 м вокруг корпуса
	var cs := 0.5
	var hx := (ln * wid * 0.5 + 1.5) if along_z else (ln * 0.5 + 1.5)
	var hz := (ln * 0.5 + 1.5) if along_z else (ln * wid * 0.5 + 1.5)
	var nx := int(ceil(hx * 2.0 / cs))
	var nz := int(ceil(hz * 2.0 / cs))
	var ox := c2.x - nx * cs * 0.5
	var oz := c2.y - nz * cs * 0.5
	var lvl := PackedInt32Array()
	lvl.resize(nx * nz)
	for iz in nz:
		for ix in nx:
			lvl[ix + iz * nx] = level_at.call(Vector2(ox + (ix + 0.5) * cs, oz + (iz + 0.5) * cs))
	var cell := func(ix: int, iz: int) -> int:
		return lvl[ix + iz * nx] if ix >= 0 and iz >= 0 and ix < nx and iz < nz else -1
	var ctr := func(ix: int, iz: int) -> Vector2:
		return Vector2(ox + (ix + 0.5) * cs, oz + (iz + 0.5) * cs)
	# сходня: клетка первой палубы, ближайшая к кромке причала
	var best := Vector2i(-1, -1)
	var bsc := 1e9
	for iz in nz:
		for ix in nx:
			if lvl[ix + iz * nx] != 0:
				continue
			var q: Vector2 = ctr.call(ix, iz)
			var sc := (absf(q.x - gp.x) + 0.15 * absf(q.y - gp.y)) if along_z else (absf(q.y - gp.y) + 0.15 * absf(q.x - gp.x))
			if sc < bsc:
				bsc = sc
				best = Vector2i(ix, iz)
	var dq: Vector2 = ctr.call(best.x, best.y)
	var p0 := Vector3(gp.x, 0, dq.y) if along_z else Vector3(dq.x, 0, gp.y)
	var p1 := Vector3(dq.x, float(y_lv[0]), dq.y)
	var gdir := (Vector3(p1.x, 0, p1.z) - p0).normalized()
	# сходня выходит на высоту палубы у самого её края (иначе у края настила — ступенька)
	var g0 := p0 - gdir * 0.7
	var g1 := p1 - gdir * (cs * 0.5 + 0.05)
	g1.y += 0.03
	# трап между палубами
	var st: Array = s.stair
	var ss := float(st[2]) * (-ps if bool(st[3]) else 1.0)
	var b2: Vector2 = to_w.call(float(st[0]), ss)
	var t2: Vector2 = to_w.call(float(st[1]), ss)
	var lo_i := level_at.call(b2) as int
	var hi_i := level_at.call(t2 + (t2 - b2).normalized() * 0.4) as int
	# верх трапа — ровно на кромке настила той палубы, куда он ведёт (настил набран клетками по 0,5 м, и кромка
	# не совпадает с описанной в долях корпуса): иначе у края остаётся порожек. У баржи он был 13 см — капсула героя
	# через такой не переступает, и из трюма нельзя было выйти (герой застревал)
	if lo_i >= 0 and hi_i >= 0 and lo_i != hi_i:
		var sdir := (t2 - b2).normalized()
		var kk2 := 0.0
		while kk2 <= b2.distance_to(t2) + 1.0:
			var qq: Vector2 = b2 + sdir * kk2
			if int(cell.call(int(floor((qq.x - ox) / cs)), int(floor((qq.y - oz) / cs)))) == hi_i:
				if kk2 > 0.5:
					t2 = b2 + sdir * (kk2 + 0.03)
				break
			kk2 += 0.02
	var st0 := Vector3(b2.x, float(y_lv[maxi(lo_i, 0)]), b2.y)
	var st1 := Vector3(t2.x, float(y_lv[maxi(hi_i, 0)]) + 0.02, t2.y)
	if lo_i < 0 or hi_i < 0 or lo_i == hi_i:
		push_warning("порт: трап судна %s не соединяет две палубы (%d → %d)" % [id, lo_i, hi_i])
	var sa := Vector2(st0.x, st0.z)
	var sb := Vector2(st1.x, st1.z)
	var ga := Vector2(g0.x, g0.z)
	var gb := Vector2(g1.x, g1.z)
	# столкновения и настил: пол палуб и преграды вокруг (ряды вдоль длины — одним брусом), перила по краю
	var y_base := 1e9
	var y_top := -1e9
	for yv in y_lv:
		y_base = minf(y_base, float(yv) - 1.2)
		y_top = maxf(y_top, float(yv) + 2.4)
	var nbox := 0
	var ncell := 0
	var na := nz if along_z else nx
	var nb := nx if along_z else nz
	for bi in nb:
		var run_a := -1
		var run_top := 0.0
		var run_floor := false
		for ai in range(na + 1):
			var top := -1e9
			var is_floor := false
			if ai < na:
				var ix := bi if along_z else ai
				var iz := ai if along_z else bi
				var t: int = lvl[ix + iz * nx]
				var q: Vector2 = ctr.call(ix, iz)
				if t >= 0:
					top = float(y_lv[t])
					is_floor = true
					ncell += 1
					# перила: край настила, за которым нет палубы (кроме мест сходни и трапа)
					for dd in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
						var nc: int = cell.call(ix + dd.x, iz + dd.y)
						if nc == t:
							continue
						var eq := q + Vector2(dd.x, dd.y) * (cs * 0.5)
						if _seg_dist(eq, ga, gb) < 1.15 or _seg_dist(eq, sa, sb) < 1.05:
							continue
						if nc >= 0 and float(y_lv[nc]) > top:
							continue                    # выше — стенка надстройки, перила не нужны
						var along := Vector3(cs, 0.05, 0.05) if dd.x == 0 else Vector3(0.05, 0.05, cs)
						_bx(g, "rust", along, _at(Vector3(eq.x, top + 0.98, eq.y)))
						_bx(g, "rust", along, _at(Vector3(eq.x, top + 0.52, eq.y)))
						if (ix + iz) % 2 == 0:
							_bx(g, "rust", Vector3(0.05, 1.0, 0.05), _at(Vector3(eq.x, top + 0.5, eq.y)))
				else:
					var near := false
					for ddx in [-1, 0, 1]:
						for ddz in [-1, 0, 1]:
							if int(cell.call(ix + ddx, iz + ddz)) >= 0:
								near = true
					# у трапа преграда не ставится (иначе она перекрыла бы проход) — но только сбоку от него. За верхним
					# концом трапа клетка без настила оставалась открытой ямой (у грузового судна трап выходит к самому
					# краю верхней палубы: шаг в сторону — и герой зажат между бортом и настилом)
					var past_top := (q - sb).dot((sb - sa).normalized()) > 0.2
					if near and _seg_dist(q, ga, gb) > 1.15 and (_seg_dist(q, sa, sb) > 1.05 or past_top):
						top = y_top
			if run_a >= 0 and (ai == na or absf(top - run_top) > 0.001):
				var a_mid := (run_a + ai) * 0.5
				var len_a := (ai - run_a) * cs
				var cx := (ox + (bi + 0.5) * cs) if along_z else (ox + a_mid * cs)
				var cz := (oz + a_mid * cs) if along_z else (oz + (bi + 0.5) * cs)
				_col_xf(Vector3(cs, run_top - y_base, len_a) if along_z else Vector3(len_a, run_top - y_base, cs), _at(Vector3(cx, (run_top + y_base) * 0.5, cz)))
				if run_floor:
					_bx(g, "gmetal", Vector3(cs, 0.06, len_a) if along_z else Vector3(len_a, 0.06, cs), _at(Vector3(cx, run_top - 0.03, cz)))
				nbox += 1
				run_a = -1
			if ai < na and top > -1e8 and run_a < 0:
				run_a = ai
				run_top = top
				run_floor = is_floor
	_p_ramp(g, g0, g1, 1.7, false)
	_p_ramp(g, st0, st1, 1.5, true)
	# тайник — ящик на своей палубе, ближе к её середине, не у трапа
	var sl := int(s.stash[1])
	var sum := Vector2.ZERO
	var cnt := 0
	for iz in nz:
		for ix in nx:
			if lvl[ix + iz * nx] == sl:
				sum += ctr.call(ix, iz)
				cnt += 1
	var sp := p1
	if cnt > 0:
		var mid := sum / cnt
		var bd := 1e9
		for iz in nz:
			for ix in nx:
				if lvl[ix + iz * nx] != sl:
					continue
				var q: Vector2 = ctr.call(ix, iz)
				var edge := 0
				for dd in [Vector2i(1, 0), Vector2i(-1, 0), Vector2i(0, 1), Vector2i(0, -1)]:
					if int(cell.call(ix + dd.x, iz + dd.y)) != sl:
						edge += 1
				# у края (у перил), но не на проходе к трапу и сходне
				var dd2 := q.distance_to(mid) * 0.3 + (0.0 if edge == 1 else 4.0)
				if _seg_dist(q, sa, sb) > 1.8 and _seg_dist(q, ga, gb) > 2.0 and dd2 < bd:
					bd = dd2
					sp = Vector3(q.x, float(y_lv[sl]), q.y)
	_pm("ul_crate", sp, 0.3, 0.9, false)
	_p_stash(sp, Vector3(1.0, 0.9, 1.0), 0.3, "boat", String(s.stash[0]))
	ships.append({"id": id, "gang": p0, "deck": p1, "upper": st1, "stair0": st0, "stash": sp, "y": y_lv})
	print("[port] судно %s: палубы на %s м, клеток настила %d, брусьев столкновения %d, сходня %s → %s, трап %s → %s" % [id, str(y_lv), ncell, nbox, str(p0), str(p1), str(st0), str(st1)])


## наклонная плита с перилами: сходня (доски) или трап (сталь, ступени)
func _p_ramp(g: Node3D, a: Vector3, b: Vector3, wd: float, steps: bool) -> void:
	var d := b - a
	var ln := d.length()
	if ln < 0.3:
		return
	var yaw := atan2(d.x, d.z)
	var bs := Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -asin(clampf(d.y / ln, -1.0, 1.0)))
	var mid := (a + b) * 0.5
	# плита — ровно от точки до точки: выступ за верхний конец был бы порожком на палубе
	_col_xf(Vector3(wd, 0.16, ln), Transform3D(bs, mid - bs.y * 0.08))
	_bx(g, "rust" if steps else "beam", Vector3(wd, 0.07, ln), Transform3D(bs, mid - bs.y * 0.035))
	for sgn in [-1.0, 1.0]:
		var side: Vector3 = bs.x * (wd * 0.5 * float(sgn))
		_bx(g, "rust", Vector3(0.05, 0.05, ln + 0.3), Transform3D(bs, mid + side + bs.y * 0.95))
		_bx(g, "rust", Vector3(0.04, 0.04, ln + 0.3), Transform3D(bs, mid + side + bs.y * 0.5))
		# боковая преграда — вертикальная стенка (наклонная нависала бы над палубой у начала трапа)
		var hl := Vector2(d.x, d.z).length()
		var yb := Basis(Vector3.UP, yaw)
		_col_xf(Vector3(0.1, absf(d.y) + 1.3, hl + 0.2), Transform3D(yb, Vector3(mid.x, mid.y + 0.65, mid.z) + yb.x * ((wd * 0.5 + 0.06) * float(sgn))))
		for kk in 3:
			var pp := a.lerp(b, 0.1 + kk * 0.4)
			_bx(g, "rust", Vector3(0.05, 0.95, 0.05), Transform3D(Basis(Vector3.UP, yaw), pp + side + Vector3.UP * 0.48))
	if steps:
		var kx := 0.2
		while kx < ln:
			_bx(g, "rust", Vector3(wd - 0.12, 0.03, 0.24), Transform3D(Basis(Vector3.UP, yaw), a + d * (kx / ln) + Vector3.UP * 0.03))
			kx += 0.32


# ---------------- контейнеры, техника, штабеля ----------------

func _p_stacks() -> void:
	var has := ResourceLoader.exists(MODELS + "pt_container.glb")
	var g := Node3D.new()
	g.name = "Stacks"
	add_child(g)
	for s in P_STACK:
		var lvl := int(s[3])
		var p := Vector3(float(s[0]), lvl * 2.6, float(s[1]))
		var tint: Color = P_TINTS[int(s[4])]
		_p_container(g, p, float(s[2]), tint, lvl == 0, has, "pt_container%d" % int(s[4]))
	# контейнер задания: закрыт, номер — в документах управления порта
	var qp := Vector3(float(P_QUEST_BOX[0]), 0, float(P_QUEST_BOX[1]))
	_p_container(g, qp, float(P_QUEST_BOX[2]), Color(0.3, 0.42, 0.52), true, has, "pt_container_q")
	quest_box = _p_stash(qp + Vector3(0, 0, 1.8), Vector3(6.1, 2.4, 1.2), 0.0, "quest_box", "Контейнер ТК-417")
	extra[quest_box]["need"] = "p_docs"
	extra[quest_box]["need_text"] = "Контейнер опломбирован. Номер и код замка — в документах управления порта"
	_flush(g)
	# часть нижних контейнеров обыскивается (двери приоткрыты)
	var k := 0
	for s in P_STACK:
		if int(s[3]) != 0:
			continue
		k += 1
		if k % 3 != 0:
			continue
		var yaw := float(s[2])
		var d := Vector3(cos(yaw), 0, -sin(yaw)) * 3.6
		_p_stash(Vector3(float(s[0]), 0, float(s[1])) + d, Vector3(1.0, 2.2, 2.3), yaw, "container", "Грузовой контейнер")


func _p_container(g: Node3D, p: Vector3, yaw: float, tint: Color, collide: bool, has: bool, key: String) -> void:
	if has:
		# модель Tripo вышла «кубиком» (короткий контейнер): растягивается по длине до 20 футов — 6,06 × 2,59 × 2,44 м
		var path := MODELS + "pt_container.glb"
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		ULSanatorium.mute(n)
		var bb: AABB = w._aabb(n)
		var sc := Vector3(6.06 / bb.size.x, 2.59 / bb.size.y, 2.44 / bb.size.z)
		var rot := Basis(Vector3.UP, yaw)
		var c := bb.get_center()
		n.transform = Transform3D(rot * Basis.from_scale(sc), p + rot * Vector3(-c.x * sc.x, -bb.position.y * sc.y, -c.z * sc.z))
		add_child(n)
		_dirty(n, key, tint)
		_cull(n, 90.0)
	else:
		# без модели — гофрированная коробка 6,06 × 2,59 × 2,44 м нужного цвета
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(6.06, 2.59, 2.44)
		mi.mesh = bm
		mi.material_override = _box_mat(tint)
		mi.transform = Transform3D(Basis(Vector3.UP, yaw), p + Vector3.UP * 1.3)
		g.add_child(mi)
	if collide:
		_col_xf(Vector3(6.06, 5.2, 2.44), Transform3D(Basis(Vector3.UP, yaw), p + Vector3.UP * 2.6))
		blob_pts.append([p, Vector2(6.06, 2.44), yaw, 0.5])


var _box_mats := {}


## гофрированный металл нужного цвета (контейнеры без модели)
func _box_mat(tint: Color) -> StandardMaterial3D:
	if not _box_mats.has(tint):
		var sm := StandardMaterial3D.new()
		sm.albedo_color = tint
		sm.roughness = 0.78
		sm.metallic = 0.2
		for nm in ["worn_corrugated_iron", "rusty_metal_02"]:
			if ResourceLoader.exists(TEX + nm + "_c.jpg"):
				sm.albedo_texture = load(TEX + nm + "_c.jpg")
				sm.uv1_triplanar = true
				sm.uv1_scale = Vector3(0.5, 0.5, 0.5)
				if ResourceLoader.exists(TEX + nm + "_n.jpg"):
					sm.normal_enabled = true
					sm.normal_texture = load(TEX + nm + "_n.jpg")
				break
		_box_mats[tint] = sm
	return _box_mats[tint]


func _p_things() -> void:
	for t in P_THINGS:
		var at: Vector3 = t[1]
		var size := _pm(String(t[0]), at, float(t[2]), float(t[3]), true, false, Color(0.82, 0.8, 0.76), bool(t[6]))
		if String(t[4]) != "":
			_p_stash(at, size, float(t[2]), String(t[4]), String(t[5]))


func _p_piles(rng: RandomNumberGenerator) -> void:
	var models := {"crate": [["ul_crate", 1.1], ["ph_crate", 1.0], ["ul_army_crate", 1.2]], "pallet": [["qr_pallets", 1.3]], "barrel": [["ph_barrel", 0.75], ["gr_barrels", 1.6]]}
	var names := {"crate": "Грузовой ящик", "pallet": "Паллета с грузом", "barrel": "Бочки"}
	for pl in P_PILES:
		var c := Vector3(float(pl[0]), 0, float(pl[1]))
		var kinds: Array = models[String(pl[3])]
		for i in int(pl[2]):
			var m: Array = kinds[rng.randi() % kinds.size()]
			var p := c + Vector3((i % 2) * 1.5 - 0.7 + rng.randf_range(-0.15, 0.15), 0, (i / 2) * 1.5 + rng.randf_range(-0.15, 0.15))
			if not on_land(Vector2(p.x, p.z), -0.8) or bld_dist(Vector2(p.x, p.z)) < 0.6:
				continue
			var sz := _pm(String(m[0]), p, rng.randf() * TAU, float(m[1]), true)
			if i == 0 and bool(pl[4]):
				_p_stash(p, sz, 0.0, String(pl[3]), String(names[String(pl[3])]))


## Склады: ряды груза в зале (паллеты, ящики, бочки, еврокубы, мешки, стеллажи) с проходами между рядами и
## напротив ворот. Модели — мебель постройки (скрываются вместе с интерьером), у каждой — столкновение.
const P_WH_ITEMS := [["qr_pallets", 1.3, 1.2], ["ul_crate", 1.1, 0.9], ["ph_barrel", 0.75, 0.95], ["qr_ibc", 1.2, 1.2], ["kh_sacks", 1.3, 0.7], ["ph_crate", 1.0, 0.8], ["ul_army_crate", 1.2, 0.6]]


func _p_warehouse(b: ULBlock, d: Dictionary) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(String(d.id))
	var kinds := P_WH_ITEMS.filter(func(x): return ResourceLoader.exists(MODELS + String(x[0]) + ".glb"))
	if kinds.is_empty():
		return
	var bk: Dictionary = d.blocks[0]
	var c: Vector2 = bk.c
	var x0 := c.x - float(bk.L) * 0.5 + 1.6
	var x1 := c.x + float(bk.L) * 0.5 - 1.6
	var z_hall0 := c.y - float(bk.W) * 0.5 + float(bk.get("row_d", 0.0)) + 1.6
	var z_max := c.y + float(bk.W) * 0.5 - 2.2
	var gates: Array = []
	for e in bk.entr:
		if String(e[0]) == "s+":
			gates.append(c.x + float(e[1]))
	var n := 0
	for row in 3:
		var z := z_hall0 + 0.6 + row * 4.6
		if z > z_max:
			break
		var x := x0
		while x < x1:
			var it: Array = kinds[rng.randi() % kinds.size()]
			var sz := float(it[1])
			var free := true
			for gx in gates:
				if absf(x + sz * 0.5 - float(gx)) < 3.0:
					free = false
			# поперечные проходы через каждые ~11 м и свободно у торцевых дверей
			if fposmod(x - x0, 11.0) > 9.2 or x > x1 - 3.0 or x < x0 + 1.5:
				free = false
			if free and rng.randf() < 0.86:
				var p := Vector3(x + sz * 0.5, 0.2, z + rng.randf_range(-0.12, 0.12))
				b.models.append([String(it[0]), p, rng.randf_range(-0.15, 0.15) + (PI * 0.5 if rng.randf() < 0.5 else 0.0), Vector3(sz, float(it[2]), sz), "b0/n0", 0.0])
				_col_xf(Vector3(sz * 0.9, float(it[2]), sz * 0.9), Transform3D(Basis.IDENTITY, p + Vector3.UP * float(it[2]) * 0.5))
				if String(it[0]) in ["qr_pallets", "ul_crate"] and rng.randf() < 0.5:
					b.models.append([String(it[0]), p + Vector3.UP * float(it[2]), rng.randf_range(-0.2, 0.2), Vector3(sz * 0.92, float(it[2]), sz * 0.92), "b0/n0", 0.0])
				n += 1
			x += sz + rng.randf_range(0.08, 0.35)
	print("[port] %s: предметов в рядах %d" % [String(d.n), n])


# ---------------- враги, тайники, хлам ----------------

func _p_spots(rng: RandomNumberGenerator) -> void:
	for k in 1100:
		var q := Vector2(rng.randf_range(-PX + 4.0, PX - 4.0), rng.randf_range(-PZ + 3.0, PZ - 6.0))
		if not on_land(q, -1.6) or bld_dist(q) < 1.2:
			continue
		if not in_yard(q) and q.y > QUAY_Z:
			continue                                 # за оградой — лес и край кластера: врагов там нет
		var tag := "yard"
		if q.y < QUAY_Z:
			tag = "piers"
		elif q.y < QUAY_Z + 9.0:
			tag = "quay"
		elif FUEL.grow(-1.0).has_point(q):
			tag = "fuel"
		elif q.x > 0.0 and q.y < -2.0 and q.y > -38.0:
			tag = "containers"
		elif q.y > 36.0:
			tag = "gate" if q.y > 58.0 else "admin_yard"
		elif road_dist(q) < 4.5:
			tag = "road"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


func _extra_pools(_pools: Dictionary) -> void:
	pass


## тайники: в постройках (общее) и вне их — контейнеры, техника, штабеля, краны, суда. Задание «Последний груз»:
## документы — в тайнике управления порта (каждое посещение — в другом), особый груз — в контейнере ТК-417.
func roll_containers(rng: RandomNumberGenerator) -> void:
	super.roll_containers(rng)
	quest_where.clear()
	var base := containers.size() - extra.size()
	var adm: Array = []
	for i in base:
		if String((containers[i] as Dictionary).get("bld", "")) == "admin":
			adm.append(i)
	if not adm.is_empty():
		var ci: int = adm[rng.randi() % adm.size()]
		ULInventory.put(containers[ci].items, ULItems.make("p_docs", 1))
		quest_where["p_docs"] = ci
	if quest_box >= 0:
		var qi := base + quest_box
		var items: Array = containers[qi].items
		for k in items.size():
			items[k] = null
		ULInventory.put(items, ULItems.make("p_cargo", 1))
		for l in conf().get("loot", {}).get("quest_box", []):
			if rng.randf() <= (float(l[3]) if l.size() > 3 else 1.0):
				ULInventory.put(items, ULItems.make(String(l[0]), rng.randi_range(int(l[1]), int(l[2]))))
		quest_where["p_cargo"] = qi


## хлам: в постройках (общее) и кучками у контейнеров, техники и на причалах
func junk_points(rng: RandomNumberGenerator) -> Array:
	# общее (кучки в постройках); точки у техники конвоя (их добавляет ULConvoy) в порту не нужны — у порта свои
	var out: Array = []
	for p in super.junk_points(rng):
		if bld_dist(Vector2((p as Vector3).x, (p as Vector3).z)) < 0.3:
			out.append(p)
	var per: Array = conf().get("junk_at_vehicles", [1, 2])
	for sp in _junk_spots():
		for k in rng.randi_range(int(per[0]), int(per[1])):
			var a := rng.randf() * TAU
			var p: Vector3 = (sp as Vector3) + Vector3(cos(a), 0, sin(a)) * rng.randf_range(3.4, 5.0)
			if bld_dist(Vector2(p.x, p.z)) > 0.8 and _land_ok(Vector2(p.x, p.z)) and body_fits(p + Vector3.UP * 0.1, 0.3, 0.5):
				out.append(Vector3(p.x, 0.02, p.z))
	return out


## у чего лежат кучки хлама вне построек (у наследников — свои места)
func _junk_spots() -> Array:
	var spots: Array = []
	for t in P_THINGS:
		spots.append(t[1])
	for i in range(0, P_STACK.size(), 4):
		spots.append(Vector3(float(P_STACK[i][0]), 0, float(P_STACK[i][1])))
	for r in PIERS:
		var c: Vector2 = (r as Rect2).get_center()
		spots.append(Vector3(c.x, 0, c.y))
	return spots


func _land_ok(q: Vector2) -> bool:
	return on_land(q, -1.2)
