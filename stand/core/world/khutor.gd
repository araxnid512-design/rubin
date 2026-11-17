class_name ULKhutor
extends ULConvoy
## «Хутор» — временный нестабильный кластер 150×150 м по карте пользователя: грунтовая дорога с юга (вход — снизу)
## упирается в кольцо улицы вокруг центральной усадьбы (большой дом, огороды, теплица, колодец); вокруг кольца —
## дома с дворами, магазин, сараи, гараж, навес с трактором, водонапорная башня, пасека; по краям — редкий
## смешанный лес. Дома, магазин, сараи и гараж — ULBlock стиля wood (в них заходят: крыша скрывается, стены
## срезаются); подвалы — ULBlock стиля cellar на 2,6 м под землёй (зал и кладовые с дверями), вход — бетонный
## портал с двустворчатой дверью в насыпи, за ним лестница вниз. Под землёй — вырез в земле над подвалом
## (уровень −1), вход и насыпь скрыты.
## Общее (этаж героя, двери, свет, тайники, враги по зонам, Рубер) — от ULSanatorium и ULConvoy.

const K_CFG := "res://data/khutor.json"
const K_NAV := "res://assets/world/nav_khutor.res"
const K_MASK := "res://assets/world/tex/khutor_mask.png"
const K_CACHE := "res://assets/world/khutor_blocks.res"
const K_TITLE := "Хутор"
const K_ENTRY := Vector3(2.0, 0, 68.0)
const DEPTH := 2.6                       ## глубина пола погреба
const RUN := 4.2                         ## длина лестницы погреба (уклон ~32°)
const SHW := 0.75                        ## полуширина лестничного колодца (в свету 1,5 м)

## Дома (wood): общая комната с прихожей у входа (izba) и ряд комнат вдоль задней стены — кухня, спальня,
## кладовая, санузел. Магазин: торговый зал, подсобка, склад. Сараи, гараж — один зал. Погреба — cellar.
const K_BUILDINGS := [
	{"id": "h1", "n": "Большой дом", "kind": "house", "style": "wood", "skin": "planks_blue", "int": "int_beige", "storey": 2.8, "te": 0.2, "plinth_h": 0.55, "plinth_mat": "brick", "antenna": true,
		"roof_mat": "roof_tin", "gable": "planks_blue", "rise": 0.55, "ov": 0.45,
		"blocks": [{"c": Vector2(-8, -20), "L": 11.0, "W": 8.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.2,
			"row": [["h_kitchen", 3.0], ["h_bed", 3.2], ["h_bath", 1.9], ["h_pantry", 2.5]], "hall_type": "izba",
			"entr": [["s+", 2.2, 1.15, "porch"]], "win_w": 0.9, "win_h": 1.1, "sill": 0.85}]},
	{"id": "h2", "n": "Дом", "kind": "house", "style": "wood", "skin": "planks", "int": "int_green", "storey": 2.8, "te": 0.2, "plinth_h": 0.36,
		"roof_mat": "rust", "gable": "planks", "rise": 0.55, "ov": 0.4,
		"blocks": [{"c": Vector2(-52, -14), "L": 9.0, "W": 7.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.0,
			"row": [["h_kitchen", 3.0], ["h_bed", 3.4], ["h_pantry", 2.2]], "hall_type": "izba",
			"entr": [["s+", -1.8, 1.15, "porch"]], "win_w": 0.9, "win_h": 1.1, "sill": 0.85}]},
	{"id": "h3", "n": "Дом", "kind": "house", "style": "wood", "skin": "planks_green", "int": "int_blue", "storey": 2.7, "te": 0.2, "logs": true, "plinth_h": 0.3,
		"roof_mat": "shingle", "gable": "planks_green", "rise": 0.6, "ov": 0.4,
		"blocks": [{"c": Vector2(-50, 20), "L": 7.0, "W": 6.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 2.8,
			"row": [["h_kitchen", 3.0], ["h_bed", 3.6]], "hall_type": "izba",
			"entr": [["s+", 1.4, 1.15, "porch"]], "win_w": 0.85, "win_h": 1.05, "sill": 0.85}]},
	{"id": "h4", "n": "Дом", "kind": "house", "style": "wood", "skin": "planks_brown", "int": "int_beige", "storey": 2.8, "te": 0.2, "logs": true, "plinth_h": 0.4, "antenna": true,
		"roof_mat": "roof_tin", "gable": "planks_brown", "rise": 0.55, "ov": 0.4,
		"blocks": [{"c": Vector2(-24, 52), "L": 9.0, "W": 7.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 3.0,
			"row": [["h_pantry", 2.2], ["h_bed", 3.4], ["h_kitchen", 3.0]], "hall_type": "izba",
			"entr": [["s-", 1.8, 1.15, "porch"]], "win_w": 0.9, "win_h": 1.1, "sill": 0.85}]},
	{"id": "h5", "n": "Дом", "kind": "house", "style": "wood", "skin": "planks_blue", "int": "int_green", "storey": 2.7, "te": 0.2, "plinth_h": 0.45,
		"roof_mat": "rust", "gable": "planks_blue", "rise": 0.6, "ov": 0.4,
		"blocks": [{"c": Vector2(28, 52), "L": 7.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 2.8,
			"row": [["h_bed", 3.6], ["h_kitchen", 3.0]], "hall_type": "izba",
			"entr": [["s-", -1.4, 1.15, "porch"]], "win_w": 0.85, "win_h": 1.05, "sill": 0.85}]},
	{"id": "h6", "n": "Большой дом", "kind": "house", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.8, "te": 0.2, "logs": true, "plinth_h": 0.5, "plinth_mat": "brick",
		"roof_mat": "shingle", "gable": "planks", "rise": 0.55, "ov": 0.45,
		"blocks": [{"c": Vector2(54, -12), "L": 11.0, "W": 8.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 3.2,
			"row": [["h_pantry", 2.5], ["h_bath", 1.9], ["h_bed", 3.2], ["h_kitchen", 3.0]], "hall_type": "izba",
			"entr": [["s-", 1.6, 1.15, "porch"]], "win_w": 0.9, "win_h": 1.1, "sill": 0.85}]},
	{"id": "h7", "n": "Дом", "kind": "house", "style": "wood", "skin": "planks_brown", "int": "int_blue", "storey": 2.7, "te": 0.2, "plinth_h": 0.38, "antenna": true,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.6, "ov": 0.4,
		"blocks": [{"c": Vector2(-14, -60), "L": 7.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 2.8,
			"row": [["h_kitchen", 3.0], ["h_bed", 3.6]], "hall_type": "izba",
			"entr": [["s+", -1.2, 1.15, "porch"]], "win_w": 0.85, "win_h": 1.05, "sill": 0.85}]},
	{"id": "shop", "n": "Магазин", "kind": "shop", "style": "wood", "skin": "plaster", "int": "int_grey1", "storey": 3.0, "te": 0.25,
		"roof_mat": "rust", "gable": "plaster", "rise": 0.4, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(48, 18), "L": 9.0, "W": 7.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 2.6,
			"row": [["shop_back", 4.2], ["shop_stock", 4.3]], "hall_type": "shop",
			"entr": [["s-", -1.6, 1.2, "porch"]], "win_w": 1.5, "win_h": 1.3, "sill": 0.8, "blind": ["s+"]}]},
	{"id": "barn", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.9, "te": 0.12,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-44, -48), "L": 8.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "barn",
			"entr": [["s+", 0.0, 2.4, "plain"]], "blind": ["s-", "e+", "e-"], "win_w": 0.7, "win_h": 0.5, "sill": 1.7}]},
	{"id": "shed", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.8, "te": 0.12,
		"roof_mat": "roof_tin", "gable": "planks", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(36, -52), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 2.2, "plain"]], "blind": ["s-", "e+"], "win_w": 0.7, "win_h": 0.5, "sill": 1.6}]},
	{"id": "khoz", "n": "Хозпостройка", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.6, "te": 0.12,
		"roof_mat": "shingle", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-58, -34), "L": 5.0, "W": 4.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.5, 1.2, "plain"]], "blind": ["s-", "e-"], "win_w": 0.6, "win_h": 0.5, "sill": 1.4}]},
	# гараж — металлический (профлист), плоская крыша с рёбрами, распашные ворота наружу
	{"id": "garage", "n": "Гараж", "kind": "shed", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 2.5, "te": 0.08,
		"roof_mat": "rust", "gate_mat": "gmetal",
		"blocks": [{"c": Vector2(-44, 46), "L": 6.5, "W": 4.6, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["e-", 0.0, 2.7, "gate"]], "blind": ["s-", "s+", "e+"]}]},
	# подвалы — подземные здания: зал у входа и ряд кладовых за перегородкой с дверями; над ними ровная земля
	# (двор, усадьба), сверху виден только вход — бетонный портал в насыпи
	{"id": "cellar1", "n": "Большой подвал", "kind": "cellar", "style": "cellar", "skin": "cellar_wall", "int": "cellar_wall", "storey": 2.35, "te": 0.25, "base_y": -2.6,
		"blocks": [{"c": Vector2(16, -22), "L": 12.0, "W": 9.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.8,
			"row": [["cellar_store", 4.0], ["cellar_root", 4.0], ["cellar_store", 4.0]], "hall_type": "cellar",
			"entr": [["s+", 0.0, 1.5, "open"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "cellar2", "n": "Подвал", "kind": "cellar", "style": "cellar", "skin": "cellar_wall", "int": "cellar_wall", "storey": 2.35, "te": 0.25, "base_y": -2.6,
		"blocks": [{"c": Vector2(-39, 3), "L": 10.0, "W": 7.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.3,
			"row": [["cellar_root", 5.0], ["cellar_store", 5.0]], "hall_type": "cellar",
			"entr": [["s+", 0.0, 1.5, "open"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "cellar3", "n": "Погреб", "kind": "cellar", "style": "cellar", "skin": "cellar_wall", "int": "cellar_wall", "storey": 2.35, "te": 0.25, "base_y": -2.6,
		"blocks": [{"c": Vector2(44, 33), "L": 9.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 3.0,
			"row": [["cellar_store", 4.5], ["cellar_root", 4.5]], "hall_type": "cellar",
			"entr": [["s+", 0.0, 1.5, "open"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

## дорога с юга, кольцо улицы вокруг усадьбы и съезды к дворам
const K_ROAD := [Vector2(2, 82), Vector2(1, 60), Vector2(0, 34)]
const K_LOOP := [Vector2(0, 34), Vector2(-16, 30), Vector2(-27, 18), Vector2(-31, 0), Vector2(-28, -18), Vector2(-20, -33), Vector2(-6, -41),
	Vector2(10, -41), Vector2(23, -33), Vector2(30, -18), Vector2(31, 0), Vector2(27, 18), Vector2(16, 30), Vector2(0, 34)]
const K_TRACKS := [
	[Vector2(-29, -14), Vector2(-46, -14)], [Vector2(-29, 14), Vector2(-45, 20)], [Vector2(-24, -27), Vector2(-44, -43)],
	[Vector2(-10, -40), Vector2(-15, -54)], [Vector2(18, -36), Vector2(36, -48)], [Vector2(31, -10), Vector2(46, -10.8)],
	[Vector2(29, 12), Vector2(43, 16.4)], [Vector2(12, 32), Vector2(25, 44)], [Vector2(-12, 32), Vector2(-22, 41), Vector2(-40, 41)],
	[Vector2(30, -20), Vector2(40, -26)],
]
## огороды: прямоугольники грядок
const K_GARDENS := [Rect2(-17, -11, 16, 9), Rect2(-59, -7, 10, 6), Rect2(-36, 28, 16, 10), Rect2(21, 55, 7, 3.5), Rect2(47.5, -22, 9, 4), Rect2(-38, -56, 8, 5)]
const K_GREENHOUSE := [Vector3(12, 0, -4), 0.0]         ## теплица 6×3,5: где, поворот
const K_WELL := Vector3(-5, 0, 24)
const K_TOWER := Vector3(56, 0, -38)                     ## водонапорная башня
const K_APIARY := Vector3(-30, 0, -64)                   ## пасека
## дворы домов: [прямоугольник забора, сторона калитки (s+ — юг, s- — север, e+ — восток, e- — запад), где калитка вдоль стороны 0..1]
const K_YARDS := [
	[Rect2(-19, -30, 26, 30), "s+", 0.55], [Rect2(-60, -22, 14, 22), "e+", 0.36], [Rect2(-58, 12, 13, 17), "e+", 0.5],
	[Rect2(-32, 44, 17, 15), "s-", 0.6], [Rect2(20, 45, 16, 14), "s-", 0.35], [Rect2(46, -24, 16, 24), "e-", 0.55], [Rect2(-21, -67, 14, 13), "s+", 0.4],
]
## техника: [модель, где, поворот, длина, что обыскать, вид тайника]
const K_VEHICLES := [
	["ul_tractor", Vector3(40, 0, -28), 0.5, 4.2, "Кабина трактора", "tractor"],
	["ul_trailer", Vector3(44.5, 0, -33.5), 0.9, 4.4, "Прицеп", "trailer"],
	["ul_car", Vector3(-31, 0, 37.5), 1.35, 4.2, "Багажник легковушки", "car"],
	["ul_cart", Vector3(-30, 0, -48), 2.2, 3.0, "", ""],
]
const K_GARAGE_CAR := [Vector3(-44, 0, 46), 0.0]

static var _kcfg := {}
var cellars: Array = []                ## по погребу: {bi, cover (будка и насыпь), door, cut (x0, z0, x1, z1)}
var _ground_mat: ShaderMaterial
var _cut_on := -1
var hero_lamp: OmniLight3D              ## фонарь героя — светит под землёй


static func kcfg() -> Dictionary:
	if _kcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(K_CFG))
		_kcfg = d if d is Dictionary else {}
	return _kcfg


func conf() -> Dictionary:
	return kcfg()


func entry() -> Vector3:
	return K_ENTRY


func title() -> String:
	return K_TITLE


func spawn_limit() -> float:
	return 71.0


static func k_sig() -> int:
	return hash(str(K_BUILDINGS) + "|" + str(ULBlock.GEN_V) + "|k13")


## описание здания с вычисленной лестницей погреба (annex — где лестница: на ней герой уже «в погребе»)
static func _bdef(d: Dictionary) -> Dictionary:
	if String(d.get("style", "")) != "cellar":
		return d
	var dd := d.duplicate(true)
	var bk: Dictionary = dd.blocks[0]
	var c: Vector2 = bk.c
	var zb := c.y + float(bk.W) * 0.5
	dd["annex"] = Rect2(c.x - SHW - 0.1, zb - 0.3, SHW * 2.0 + 0.2, RUN + 0.6)
	return dd


func build(world: Node3D) -> void:
	w = world
	half = float(conf().get("size", 150.0)) * 0.5
	body = StaticBody3D.new()
	body.name = "KhutorBody"
	var fn := FastNoiseLite.new()
	fn.seed = 211
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 5517
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "khbake" and ResourceLoader.exists(K_CACHE):
		var r = load(K_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == k_sig():
			cache = r
		else:
			push_warning("хутор: кэш построек устарел — пересоберите --as-test=khbake")
	var made := {}
	for d0 in K_BUILDINGS:
		var d := _bdef(d0)
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
			_add_door(dd)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	for i in blds.size():
		if blds[i].style == "cellar":
			_k_cellar(i)
	_c_forest(rng)
	_k_ground()
	_k_shop_sign(props)
	_k_vehicles()
	_k_yards(props, rng)
	_k_gardens(props, rng)
	_k_greenhouse(props)
	_k_props(props, rng)
	_k_wall_clutter(props, rng)
	_k_tripo_props(rng)
	_flush(props)
	_k_trees(rng)
	_c_vegetation()
	_k_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "khbake":
		var cr := ULBlockCache.new()
		cr.sig = k_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, K_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек хутора: %s (%s)" % [K_CACHE, error_string(err)])
	print("[khut] хутор собран: %d мс, построек %d, столкновений %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), _count_cont(), extra.size()])


func _add_door(dd: ULDoor) -> void:
	doors.append(dd)
	var k := _cell(dd.center)
	if not _door_grid.has(k):
		_door_grid[k] = []
	_door_grid[k].append(dd)


# ---------------- расстояния и зоны ----------------

func road_dist(q: Vector2) -> float:
	var d := 1e9
	for pts in [K_ROAD, K_LOOP]:
		for i in pts.size() - 1:
			d = minf(d, _seg_dist(q, pts[i], pts[i + 1]))
	return d


func track_dist(q: Vector2) -> float:
	var d := 1e9
	for t in K_TRACKS:
		for i in t.size() - 1:
			d = minf(d, _seg_dist(q, t[i], t[i + 1]))
	return d


## «поляна» — дворы домов (утоптанная земля у построек)
func clear_w(q: Vector2) -> float:
	var v := 0.0
	for y in K_YARDS:
		var r: Rect2 = (y[0] as Rect2).grow(-1.0)
		if r.has_point(q):
			v = maxf(v, 0.55)
	return v


func pave_dist(q: Vector2) -> float:
	return minf(road_dist(q) - 2.4, track_dist(q) - 1.3)


## до построек — и до лестниц погребов (на них ничего не ставить)
func bld_dist(q: Vector2) -> float:
	var d := super.bld_dist(q)
	for b in blds:
		if b.style == "cellar":
			var r: Rect2 = b.annex.grow(0.6)
			var o := Vector2(maxf(maxf(r.position.x - q.x, q.x - r.end.x), 0.0), maxf(maxf(r.position.y - q.y, q.y - r.end.y), 0.0))
			d = minf(d, o.length())
	return d


func in_garden(q: Vector2) -> bool:
	for g in K_GARDENS:
		if (g as Rect2).has_point(q):
			return true
	return false


# ---------------- мебель-модели в домах ----------------

# ---------------- погреба ----------------

## Погреб: под землёй — помещение ULBlock (стены, полки, свет); здесь — лестница вниз (ступени, кирпичные стенки,
## столкновение — наклонная плита), над ней — дощатая будка с дверью (вход), над помещением — насыпь с травой.
## Дыра в земле — только под лестницей (столкновение земли собирается кусками в обход неё).
func _k_cellar(bi: int) -> void:
	var b := blds[bi]
	var bk: Dictionary = b.blocks[0]
	var c: Vector2 = bk.c
	var hl := float(bk.L) * 0.5
	var hw := float(bk.W) * 0.5
	var zb := c.y + hw                       # наружная грань южной стены (там проём)
	var zt := zb + RUN                       # верх лестницы (на земле)
	var by := -DEPTH
	var under := Node3D.new()
	under.name = "CellarStairs%d" % bi
	add_child(under)
	var cover := Node3D.new()
	cover.name = "CellarCover%d" % bi
	add_child(cover)
	# пол погреба — со столкновением (у построек на земле пол держит сама земля, здесь под полом пусто)
	_col_xf(Vector3(float(bk.L), 0.3, float(bk.W)), _at(Vector3(c.x, by + 0.012 - 0.15, c.y)))
	# ступени и наклонная плита
	var n := 16
	for i in n:
		var t0 := float(i) / n
		var t1 := float(i + 1) / n
		var za := lerpf(zb - 0.25, zt, t0)
		var zc := lerpf(zb - 0.25, zt, t1)
		var ya := lerpf(by, 0.0, t1)
		_bx(under, "slab", Vector3(SHW * 2.0, 0.08, absf(zc - za) + 0.02), _at(Vector3(c.x, ya - 0.04, (za + zc) * 0.5)))
		_bx(under, "earth", Vector3(SHW * 2.0, maxf(ya - by, 0.05), absf(zc - za)), _at(Vector3(c.x, by + (ya - by) * 0.5 - 0.06, (za + zc) * 0.5)))
	var pts := PackedVector3Array()
	for x in [c.x - SHW, c.x + SHW]:
		pts.append(Vector3(x, by - 0.1, zb - 0.3))
		pts.append(Vector3(x, by + 0.012, zb - 0.3))
		pts.append(Vector3(x, 0.0, zt))
		pts.append(Vector3(x, -0.12, zt))
	var cs := CollisionShape3D.new()
	var sh := ConvexPolygonShape3D.new()
	sh.points = pts
	cs.shape = sh
	body.add_child(cs)
	# стенки колодца — бетон, со столкновением (сбоку под землёй пусто); потолок над лестницей
	for sx in [-1.0, 1.0]:
		_bx(under, "cellar_wall", Vector3(0.2, DEPTH + 0.1, RUN + 0.5), _at(Vector3(c.x + sx * (SHW + 0.1), by + DEPTH * 0.5 - 0.05, (zb + zt) * 0.5)), true)
		var ln := sqrt(RUN * RUN + DEPTH * DEPTH)
		_bx(under, "planks_brown", Vector3(0.05, 0.05, ln), Transform3D(Basis(Vector3.RIGHT, atan2(DEPTH, RUN)), Vector3(c.x + sx * (SHW - 0.08), by * 0.5 + 0.9, (zb + zt) * 0.5)))
	# потолок над лестницей — вместе со входом (скрывается, когда герой внизу)
	_bx(cover, "slab", Vector3(SHW * 2.0 + 0.4, 0.15, RUN + 0.3), _at(Vector3(c.x, -0.1, (zb + zt) * 0.5)))
	_flush(under)
	for mi in under.get_children():
		(mi as VisualInstance3D).layers = 3              # видна и при солнце, когда земля над лестницей вырезана
		(mi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# вход: бетонный портал в насыпи, двустворчатая дощатая дверь на юг
	var hz0 := zb - 0.35
	var hz1 := zt + 0.15
	var hh := 2.1
	for sx in [-1.0, 1.0]:
		_bx(cover, "concrete", Vector3(0.35, hh, 1.3), _at(Vector3(c.x + sx * (0.65 + 0.175), hh * 0.5, hz1 - 0.5)), true)
		# откосы портала — бетонные «крылья» уходят в насыпь
		_bx(cover, "concrete", Vector3(0.25, hh * 0.7, 1.2), Transform3D(Basis(Vector3.UP, sx * 0.55), Vector3(c.x + sx * 1.35, hh * 0.35, hz1 - 0.15)), true)
	_bx(cover, "concrete", Vector3(2.0, 0.35, 1.3), _at(Vector3(c.x, hh + 0.17, hz1 - 0.5)))
	_bx(cover, "concrete", Vector3(2.4, 0.12, 1.6), _at(Vector3(c.x, hh + 0.4, hz1 - 0.45)))
	# лампа над дверью (как на образце): плафон и тёплое пятно света
	var lamp := MeshInstance3D.new()
	var lm := SphereMesh.new()
	lm.radius = 0.09
	lm.height = 0.18
	lamp.mesh = lm
	var lmat := StandardMaterial3D.new()
	lmat.albedo_color = Color(1.0, 0.85, 0.55)
	lmat.emission_enabled = true
	lmat.emission = Color(1.0, 0.75, 0.4)
	lmat.emission_energy_multiplier = 2.5
	lamp.material_override = lmat
	lamp.position = Vector3(c.x, hh + 0.05, hz1 + 0.05)
	cover.add_child(lamp)
	# насыпь — только над лестницей (над самим подвалом ровная земля); столкновение — подковой вокруг лестничного
	# проёма (с боков и с севера), чтобы в него не упасть сверху; вход — только через портал с юга
	var mound := MeshInstance3D.new()
	var sp := SphereMesh.new()
	sp.radius = 1.0
	sp.height = 2.0
	sp.radial_segments = 20
	sp.rings = 8
	mound.mesh = sp
	var bw := SHW + 1.4                       # полуширина насыпи
	var mz0 := hz0 - 0.9
	var mz1 := zt - 0.6
	mound.scale = Vector3(bw + 0.4, 1.2, (mz1 - mz0) * 0.5 + 0.4)
	mound.position = Vector3(c.x, -0.35, (mz0 + mz1) * 0.5)
	mound.name = "Mound"                   # покрытие — тот же шейдер земли, что вокруг (ставится в _k_ground)
	cover.add_child(mound)
	var berm := [
		[Vector3(bw * 2.0, 0.85, 1.2), Vector3(c.x, 0.42, hz0 - 0.2)],
	]
	for sx in [-1.0, 1.0]:
		berm.append([Vector3(bw - SHW - 0.2, 0.85, zt - 1.0 - hz0), Vector3(c.x + sx * (SHW + 0.2 + bw) * 0.5, 0.42, (hz0 + zt - 1.0) * 0.5)])
	for box in berm:
		var mc := CollisionShape3D.new()
		var mb := BoxShape3D.new()
		mb.size = box[0]
		mc.shape = mb
		mc.position = box[1]
		body.add_child(mc)
	_flush(cover)
	# дверь — две створки
	var leaves: Array = []
	for k in 2:
		var dd := ULDoor.new()
		add_child(dd)
		var sgn := -1.0 if k == 0 else 1.0
		dd.setup(Vector3(c.x + sgn * 0.325, 0.0, hz1 - 0.05), Vector3.RIGHT if k == 0 else Vector3.LEFT, Vector3.FORWARD, 0.65, 2.0, ULBlock.mats["door"], false)
		dd.panel.set_meta("mat", "door")
		dd.bld = 0
		dd.floor_i = 0
		dd.set_meta("ext", true)
		dd.set_meta("cellar", bi)
		_add_door(dd)
		leaves.append(dd)
	var dd: ULDoor = leaves[0]
	# вырез в земле, когда герой внизу: помещение и лестница, в сторону камеры — с запасом на наклон взгляда
	var ext := DEPTH / tan(deg_to_rad(48.0)) + 0.8
	var cd: Vector3 = ULBlock.cam_dir
	var x0 := c.x - hl - 0.15 - (ext if cd.x < -0.3 else 0.0)
	var x1 := c.x + hl + 0.15 + (ext if cd.x > 0.3 else 0.0)
	var z0 := c.y - hw - 0.15 - (ext if cd.z < -0.3 else 0.0)
	var z1 := zt + 0.5 + (ext if cd.z > 0.3 else 0.0)
	# «яма»: когда земля над погребом вырезана, вокруг помещения видна толща земли (срез), а не небо — дно на
	# 3,2 м и стенки по краю выреза; показывается только вместе с вырезом
	var pit := Node3D.new()
	pit.name = "CellarPit%d" % bi
	add_child(pit)
	var pd := 3.2
	_bx(pit, "earth", Vector3(x1 - x0, 0.05, z1 - z0), _at(Vector3((x0 + x1) * 0.5, -pd, (z0 + z1) * 0.5)))
	_bx(pit, "earth", Vector3(x1 - x0, pd, 0.05), _at(Vector3((x0 + x1) * 0.5, -pd * 0.5, z0)))
	_bx(pit, "earth", Vector3(x1 - x0, pd, 0.05), _at(Vector3((x0 + x1) * 0.5, -pd * 0.5, z1)))
	_bx(pit, "earth", Vector3(0.05, pd, z1 - z0), _at(Vector3(x0, -pd * 0.5, (z0 + z1) * 0.5)))
	_bx(pit, "earth", Vector3(0.05, pd, z1 - z0), _at(Vector3(x1, -pd * 0.5, (z0 + z1) * 0.5)))
	_flush(pit)
	for mi2 in pit.get_children():
		(mi2 as VisualInstance3D).layers = 1               # срез земли — при солнечном свете, а не чёрная яма
		(mi2 as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	pit.visible = false
	cellars.append({"bi": bi, "cover": cover, "door": dd, "leaves": leaves, "under": under, "pit": pit, "cut": Vector4(x0, z0, x1, z1), "hole": Rect2(c.x - SHW, zb - 0.3, SHW * 2.0, RUN + 0.3)})


# ---------------- земля ----------------

func _k_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_material(half * 2.0, "brown_mud_02", "brown_mud_02", Vector3(0.86, 0.8, 0.7), 0.7, 0.45, "dirt", "dirt")
	sm.set_shader_parameter("noise", _noise_tex)
	sm.set_shader_parameter("grass_mul", Vector3(0.86, 0.95, 0.66))
	sm.set_shader_parameter("path_mul", Vector3(0.86, 0.8, 0.72))
	if ResourceLoader.exists(K_MASK) and w.test != "khbake":
		mask = (load(K_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _k_bake_mask()
		if w.test == "khbake":
			mask.save_png(ProjectSettings.globalize_path(K_MASK))
			print("[bake] карта земли хутора: ", K_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	_ground_mat = sm
	for cl in cellars:
		var mo := (cl.cover as Node3D).get_node_or_null("Mound") as MeshInstance3D
		if mo != null:
			mo.material_override = sm
	sm.set_shader_parameter("cut_on", 0.0)
	sm.set_shader_parameter("cut_rect", Vector4.ZERO)
	add_child(mi)
	# за краем поля — рамка из четырёх полос (под полем ничего нет: погреба видны сквозь вырез)
	var omat := ULHouse._mat(TEX + "mud_forest", 3.5)
	omat.albedo_color = Color(0.6, 0.6, 0.54)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var o := MeshInstance3D.new()
		var op := PlaneMesh.new()
		op.size = Vector2(135, 420) if s.x != 0.0 else Vector2(half * 2.0, 135)
		o.mesh = op
		o.material_override = omat
		o.position = s * (half + 67.5) + Vector3.UP * -0.05
		add_child(o)
	# столкновение земли: плита толщиной 0,2 м — кусками в обход лестниц погребов
	var holes: Array = []
	for cl in cellars:
		holes.append(cl.hole)
	for r in _rect_minus(Rect2(-210, -210, 420, 420), holes):
		var rr: Rect2 = r
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(rr.size.x, 0.2, rr.size.y)
		cs.shape = bs
		cs.position = Vector3(rr.get_center().x, -0.1, rr.get_center().y)
		body.add_child(cs)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, half * 2.0 + 2) if s.x != 0.0 else Vector3(half * 2.0 + 2, 4, 1)
		wc.shape = b
		wc.position = s * (half + 9.0) + Vector3.UP * 2.0
		body.add_child(wc)
	var roads: Array = [K_ROAD, K_LOOP]
	for t in K_TRACKS:
		roads.append(t)
	ULGroundDetail.ruts(self, roads, _noise_tex, "brown_mud_02")
	ULGroundDetail.puddles(self, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		if bld_dist(q) < 2.0 or in_garden(q):
			return false
		if road_dist(q) < 2.6:
			return _noise(q / 7.0) > 0.5
		return track_dist(q) < 1.2 and _noise(q / 5.0 + Vector2(0.4, 0.2)) > 0.62, half * 2.0, 73, 700, _noise_tex)


static func _rect_minus(r0: Rect2, holes: Array) -> Array:
	var rects: Array = [r0]
	for h in holes:
		var hr: Rect2 = h
		var nxt: Array = []
		for r in rects:
			var rr: Rect2 = r
			if not rr.intersects(hr):
				nxt.append(rr)
				continue
			var ix := rr.intersection(hr)
			if ix.position.x > rr.position.x:
				nxt.append(Rect2(rr.position.x, rr.position.y, ix.position.x - rr.position.x, rr.size.y))
			if ix.end.x < rr.end.x:
				nxt.append(Rect2(ix.end.x, rr.position.y, rr.end.x - ix.end.x, rr.size.y))
			if ix.position.y > rr.position.y:
				nxt.append(Rect2(ix.position.x, rr.position.y, ix.size.x, ix.position.y - rr.position.y))
			if ix.end.y < rr.end.y:
				nxt.append(Rect2(ix.position.x, ix.end.y, ix.size.x, rr.end.y - ix.end.y))
		rects = nxt
	return rects


## слои земли: трава, тропы и дороги (сухая колейная грязь), дворы — вытоптанная земля, грядки — пашня, лес по краю
func _k_bake_mask() -> Image:
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
			var road := 1.0 - smoothstep(1.8, 3.4, road_dist(p) + (n3 - 0.5) * 1.2)
			var track := 1.0 - smoothstep(0.8, 1.9, track_dist(p) + (n3 - 0.5) * 0.8)
			var yard := clear_w(p) * smoothstep(0.3, 0.65, n2 * 0.6 + n3 * 0.4 + 0.15)
			var garden := 1.0 if in_garden(p) else 0.0
			var path := maxf(maxf(road, track), maxf(yard * 0.8, garden))
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			for cl in cellars:
				var cr: Vector4 = cl.cut
				if p.x > cr.x - 0.5 and p.x < cr.z + 0.5 and p.y > cr.y - 0.5 and p.y < cr.w + 0.5:
					gw *= 0.4
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- постройки снаружи: вывеска, техника, дворы, огороды, теплица ----------------

func _k_shop_sign(g: Node3D) -> void:
	for b in blds:
		if b.id != "shop":
			continue
		var bk: Dictionary = b.blocks[0]
		var c: Vector2 = bk.c
		var x := c.x - float(bk.W) * 0.5 - 0.06
		_bx(g, "plaster", Vector3(0.06, 0.62, 3.6), _at(Vector3(x - 0.02, 2.85, c.y - 1.6)))
		_bx(g, "red", Vector3(0.05, 0.52, 3.45), _at(Vector3(x - 0.06, 2.85, c.y - 1.6)))
		var lb := Label3D.new()
		lb.text = "МАГАЗИН"
		lb.font_size = 96
		lb.pixel_size = 0.0042
		lb.outline_size = 0
		lb.modulate = Color(0.97, 0.95, 0.9)
		lb.position = Vector3(x - 0.1, 2.85, c.y - 1.6)
		lb.rotation.y = -PI * 0.5
		lb.double_sided = false
		lb.shaded = true
		add_child(lb)


func _k_vehicles() -> void:
	for v in K_VEHICLES:
		var path := MODELS + String(v[0]) + ".glb"
		var size := _c_model_box(path, v[1], float(v[2]), float(v[3]), Color(0.82, 0.8, 0.76), String(v[0]), true)
		if String(v[5]) != "":
			extra.append({"pos": v[1], "size": size, "yaw": float(v[2]), "kind": String(v[5]), "n": String(v[4])})
	# легковушка в гараже
	var gp: Vector3 = K_GARAGE_CAR[0]
	if ResourceLoader.exists(MODELS + "ul_car.glb"):
		var gs := _c_model_box(MODELS + "ul_car.glb", gp, float(K_GARAGE_CAR[1]) + PI * 0.5, 3.9, Color(0.74, 0.72, 0.7), "ul_car_g", true)
		extra.append({"pos": gp, "size": gs, "yaw": float(K_GARAGE_CAR[1]) + PI * 0.5, "kind": "car", "n": "Багажник машины в гараже"})
	# навес над трактором: четыре столба и крыша
	var tp: Vector3 = (K_VEHICLES[0][1] as Vector3)
	var tg := Node3D.new()
	add_child(tg)
	for sx in [-2.4, 2.4]:
		for sz in [-3.0, 3.0]:
			var q := tp + Basis(Vector3.UP, 0.5) * Vector3(sx, 0, sz)
			_cy(tg, "planks_brown", 0.1, 0.12, 3.2, _at(q + Vector3.UP * 1.6), 8)
			_cyl_col(q, 0.12, 3.0)
	_bx(tg, "rust", Vector3(5.6, 0.06, 7.0), Transform3D(Basis(Vector3.UP, 0.5) * Basis(Vector3.RIGHT, 0.08), tp + Vector3.UP * 3.25))
	_flush(tg)


## заборы дворов: штакетник со столбами, калитка — проём; где забор пересекает лестницу погреба — пропуск
func _k_yards(g: Node3D, rng: RandomNumberGenerator) -> void:
	for y in K_YARDS:
		var r: Rect2 = y[0]
		var gate := String(y[1])
		var gt := float(y[2])
		var sides := {"s-": [Vector2(r.position.x, r.position.y), Vector2(r.end.x, r.position.y)], "s+": [Vector2(r.position.x, r.end.y), Vector2(r.end.x, r.end.y)],
			"e-": [Vector2(r.position.x, r.position.y), Vector2(r.position.x, r.end.y)], "e+": [Vector2(r.end.x, r.position.y), Vector2(r.end.x, r.end.y)]}
		for sk in sides:
			var a: Vector2 = sides[sk][0]
			var b: Vector2 = sides[sk][1]
			var ln := a.distance_to(b)
			var dir := (b - a) / ln
			var t := 0.0
			while t < ln - 0.1:
				var seg := minf(2.4, ln - t)
				var mid := t + seg * 0.5
				var gap: bool = sk == gate and absf(mid - gt * ln) < 1.6
				var broken := rng.randf() < 0.1
				var pa := a + dir * t
				var pm := a + dir * mid
				var q := Vector3(pm.x, 0, pm.y)
				if not gap and not broken and bld_dist(pm) > 0.4 and road_dist(pm) > 2.4:
					var yaw := atan2(dir.y, dir.x)
					_bx(g, "planks", Vector3(seg, 0.07, 0.04), Transform3D(Basis(Vector3.UP, -yaw), q + Vector3.UP * 0.35))
					_bx(g, "planks", Vector3(seg, 0.07, 0.04), Transform3D(Basis(Vector3.UP, -yaw), q + Vector3.UP * 1.0))
					var k := 0.0
					while k < seg - 0.05:
						var pp := pa + dir * (k + 0.06)
						var tilt := rng.randf_range(-0.05, 0.05)
						_bx(g, "planks", Vector3(0.09, rng.randf_range(1.1, 1.3), 0.025), Transform3D(Basis(Vector3(dir.x, 0, dir.y), tilt) * Basis(Vector3.UP, -yaw), Vector3(pp.x, 0.6, pp.y)))
						k += 0.16
					_col_xf(Vector3(seg, 1.2, 0.12), Transform3D(Basis(Vector3.UP, -yaw), q + Vector3.UP * 0.6))
				if not gap:
					_cy(g, "planks_brown", 0.06, 0.07, 1.45, _at(Vector3(pa.x, 0.72, pa.y)), 6)
				t += seg


## огороды: грядки (пашня), ботва картошки, капуста, жерди; вдоль — тропка
func _k_gardens(g: Node3D, rng: RandomNumberGenerator) -> void:
	for gr in K_GARDENS:
		var r: Rect2 = gr
		var along_x := r.size.x >= r.size.y
		var rows := int((r.size.y if along_x else r.size.x) / 1.1)
		for i in rows:
			var o := 0.55 + i * 1.1
			var c := Vector3(r.get_center().x if along_x else r.position.x + o, 0.06, r.position.y + o if along_x else r.get_center().y)
			var ln := (r.size.x if along_x else r.size.y) - 0.6
			_bx(g, "earth", Vector3(ln if along_x else 0.7, 0.12, 0.7 if along_x else ln), _at(c))
			var k := 0.3
			while k < ln - 0.3:
				if rng.randf() < 0.82:
					var pp := c + (Vector3(k - ln * 0.5, 0, 0) if along_x else Vector3(0, 0, k - ln * 0.5))
					var s := rng.randf_range(0.18, 0.32)
					_bx(g, "green", Vector3(s, s * rng.randf_range(0.8, 1.4), s), Transform3D(Basis(Vector3.UP, rng.randf() * TAU), pp + Vector3.UP * (0.12 + s * 0.4)))
				k += rng.randf_range(0.35, 0.5)


## теплица: деревянный каркас, стекло (прозрачное), вход с торца; внутри — грядки с рассадой и ящик
func _k_greenhouse(g: Node3D) -> void:
	var c: Vector3 = K_GREENHOUSE[0]
	var L := 6.0
	var W := 3.5
	var H := 2.3
	var glass := StandardMaterial3D.new()
	glass.albedo_color = Color(0.8, 0.9, 0.88, 0.22)
	glass.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	glass.roughness = 0.1
	glass.metallic = 0.2
	glass.cull_mode = BaseMaterial3D.CULL_DISABLED
	var gg := Node3D.new()
	add_child(gg)
	for x in [-L * 0.5, -L * 0.25, 0.0, L * 0.25, L * 0.5]:
		for z in [-W * 0.5, W * 0.5]:
			_bx(g, "planks_brown", Vector3(0.07, H, 0.07), _at(c + Vector3(x, H * 0.5, z)))
		_bx(g, "planks_brown", Vector3(0.06, 0.06, W + 0.1), Transform3D(Basis(), c + Vector3(x, H + 0.45, 0)))
	_bx(g, "planks_brown", Vector3(L, 0.06, 0.06), _at(c + Vector3(0, H + 0.5, 0)))
	for z in [-W * 0.5, W * 0.5]:
		_bx(g, "planks_brown", Vector3(L, 0.08, 0.08), _at(c + Vector3(0, H, z)))
		_bx(g, "planks_brown", Vector3(L, 0.3, 0.06), _at(c + Vector3(0, 0.15, z)))
	var panes: Array = []
	for z in [-W * 0.5, W * 0.5]:
		panes.append([Vector3(L, H - 0.3, 0.02), c + Vector3(0, 0.3 + (H - 0.3) * 0.5, z), Basis(), true])
	for sz in [-1.0, 1.0]:
		var ang := atan2(0.5, W * 0.5)
		panes.append([Vector3(L, 0.02, W * 0.5 / cos(ang) + 0.05), c + Vector3(0, H + 0.25, sz * W * 0.25), Basis(Vector3.RIGHT, -sz * ang), false])
	panes.append([Vector3(0.02, H, W), c + Vector3(-L * 0.5, H * 0.5, 0), Basis(), true])
	# у входа (восточный торец) — две половины стекла по сторонам проёма
	for sz in [-1.0, 1.0]:
		panes.append([Vector3(0.02, H, W * 0.5 - 0.5), c + Vector3(L * 0.5, H * 0.5, sz * (W * 0.25 + 0.25)), Basis(), true])
	for p in panes:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = p[0]
		mi.mesh = bm
		mi.material_override = glass
		mi.transform = Transform3D(p[2], p[1])
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		gg.add_child(mi)
		if p[3]:
			_col_xf(p[0] + Vector3(0.08, 0, 0.08), Transform3D(p[2], p[1]))
	# грядки внутри и рассада
	for z in [-W * 0.5 + 0.55, W * 0.5 - 0.55]:
		_bx(g, "planks_brown", Vector3(L - 0.8, 0.3, 0.8), _at(c + Vector3(-0.2, 0.15, z)), true)
		_bx(g, "earth", Vector3(L - 0.9, 0.04, 0.7), _at(c + Vector3(-0.2, 0.31, z)))
		for k in 9:
			_bx(g, "green", Vector3(0.22, 0.32, 0.22), _at(c + Vector3(-L * 0.5 + 0.8 + k * 0.55, 0.48, z), k * 0.7))
	extra.append({"pos": c + Vector3(-L * 0.5 + 0.6, 0, 0), "size": Vector3(0.6, 0.5, 0.8), "yaw": 0.0, "kind": "garden", "n": "Ящик с рассадой"})
	_bx(g, "planks_brown", Vector3(0.6, 0.45, 0.8), _at(c + Vector3(-L * 0.5 + 0.6, 0.22, 0)), true)


## мелочи дворов и улицы: колодец, уличные туалеты, поленницы, пасека, бидоны, мешки, ящики, бочки, хлам,
## сено у сарая, столбы с проводами, водонапорная башня
func _k_props(g: Node3D, rng: RandomNumberGenerator) -> void:
	_c_model_box(MODELS + "kh_well.glb", K_WELL, 0.3, 1.9, Color(0.88, 0.86, 0.82), "kh_well", true)
	if ResourceLoader.exists(MODELS + "ul_water_tower.glb"):
		_c_model_box(MODELS + "ul_water_tower.glb", K_TOWER, 0.2, 9.0, Color(0.8, 0.78, 0.74), "ul_water_tower", true, true)
	# пасека: ульи рядами
	for i in 6:
		var p := K_APIARY + Vector3((i % 3) * 1.6, 0, (i / 3) * 1.7)
		_c_model_box(MODELS + "kh_beehive.glb", p, rng.randf_range(-0.2, 0.2), 0.7, Color(0.9, 0.88, 0.84), "kh_beehive", true)
	# у каждого дома: туалет в глубине двора, поленница у стены, бидоны или мешки у крыльца
	var spots := [
		[Vector3(-15.5, 0, -20), 1.6, Vector3(1, 0, -27)], [Vector3(-57, 0, -20), 0.0, Vector3(-47.5, 0, -20.5)], [Vector3(-55, 0, 25), 1.6, Vector3(-56.5, 0, 13.5)],
		[Vector3(-30, 0, 46.5), 3.1, Vector3(-17, 0, 57.5)], [Vector3(33, 0, 47), 3.1, Vector3(34.5, 0, 57)], [Vector3(59, 0, -20), -1.6, Vector3(60, 0, -2)],
		[Vector3(-9, 0, -56), 0.0, Vector3(-19, 0, -65.5)],
	]
	for s in spots:
		_c_model_box(MODELS + "kh_woodpile.glb", s[0], float(s[1]), 2.2, Color(0.72, 0.68, 0.62), "kh_woodpile", true)
		_c_model_box(MODELS + "kh_outhouse.glb", s[2], float(s[1]), 1.3, Color(0.88, 0.86, 0.82), "kh_outhouse", true, false)
	for p in [Vector3(-2.5, 0, -14), Vector3(-47, 0, -10), Vector3(43, 0, 11), Vector3(-19, 0, 46.5), Vector3(-41, 0, -44)]:
		_c_model_box(MODELS + ("kh_cans.glb" if rng.randf() < 0.5 else "kh_sacks.glb"), p, rng.randf() * TAU, 1.0, Color(0.9, 0.88, 0.84), "kh_props", true)
	# сено у сарая (тюки и стог)
	for i in 5:
		var hp := Vector3(-36.0 + (i % 3) * 1.3, 0.35 + (i / 3) * 0.6, -42.5)
		_bx(g, "sand", Vector3(1.2, 0.6, 0.8), _at(hp, rng.randf_range(-0.1, 0.1)), i < 3)
	var stack := MeshInstance3D.new()
	var sm := SphereMesh.new()
	sm.radius = 1.6
	sm.height = 3.6
	stack.mesh = sm
	stack.position = Vector3(-52, 1.2, -42)
	stack.material_override = _mat("sand")
	add_child(stack)
	_cyl_col(Vector3(-52, 0, -42), 1.4, 2.6)
	# хлам, ящики, бочки, покрышки у сараев и гаража
	var junk := [Vector3(-49, 0, -44), Vector3(31, 0, -48), Vector3(-41, 0, 51), Vector3(42, 0, -24), Vector3(-61, 0, -30)]
	for p in junk:
		if ResourceLoader.exists(MODELS + "ul_junk.glb"):
			_c_model_box(MODELS + "ul_junk.glb", p, rng.randf() * TAU, 1.6, Color(0.8, 0.78, 0.74), "ul_junk", true)
		for k in 2:
			var q: Vector3 = p + Vector3(rng.randf_range(-2.2, 2.2), 0, rng.randf_range(-2.2, 2.2))
			if bld_dist(Vector2(q.x, q.z)) < 1.0:
				continue
			var f: String = ["ul_crate", "ph_barrel", "ph_tyre", "ph_bucket"][rng.randi() % 4]
			_c_model_box(MODELS + f + ".glb", q, rng.randf() * TAU, 0.9 if f != "ph_bucket" else 0.35, Color(0.85, 0.83, 0.8), f, f != "ph_bucket")
	# столбы с проводами вдоль дороги и кольца
	var poles: Array = []
	var pts: Array = K_ROAD + K_LOOP
	var acc := 0.0
	for i in pts.size() - 1:
		var a: Vector2 = pts[i]
		var b: Vector2 = pts[i + 1]
		var ln := a.distance_to(b)
		var t := 0.0
		while t < ln:
			if acc <= 0.0:
				var q := a.lerp(b, t / ln)
				var nrm := (b - a).normalized().orthogonal() * 3.3
				var pp := Vector3(q.x + nrm.x, 0, q.y + nrm.y)
				if bld_dist(Vector2(pp.x, pp.z)) > 1.5:
					poles.append(pp)
				acc = 18.0
			var stp := minf(2.0, ln - t)
			t += stp
			acc -= stp
	for i in poles.size():
		var p: Vector3 = poles[i]
		_cy(g, "planks_brown", 0.1, 0.13, 6.5, _at(p + Vector3.UP * 3.25), 6)
		_bx(g, "planks_brown", Vector3(1.4, 0.1, 0.1), _at(p + Vector3.UP * 6.1, rng.randf() * 0.3))
		_cyl_col(p, 0.13, 3.0)
		if i > 0 and (poles[i - 1] as Vector3).distance_to(p) < 24.0:
			var a3: Vector3 = poles[i - 1] + Vector3.UP * 6.15
			var b3: Vector3 = p + Vector3.UP * 6.15
			var mid := (a3 + b3) * 0.5 - Vector3.UP * 0.35
			for seg in [[a3, mid], [mid, b3]]:
				var s0: Vector3 = seg[0]
				var s1: Vector3 = seg[1]
				var ln2 := s0.distance_to(s1)
				var bas := Basis.looking_at((s1 - s0).normalized(), Vector3.UP if absf((s1 - s0).normalized().y) < 0.9 else Vector3.RIGHT)
				_bx(g, "metal", Vector3(0.02, 0.02, ln2), Transform3D(bas, (s0 + s1) * 0.5))


## Мелочь у стен домов и сараев (кроме стены с входом): ведро, доски, прислонённые к стене, покрышка, ящик —
## дом не стоит на чистой плоскости. Без столкновений (не мешает проходам и карте проходимости), с пятном-тенью.
func _k_wall_clutter(g: Node3D, rng: RandomNumberGenerator) -> void:
	for b in blds:
		var kind := String(b.def.get("kind", ""))
		if kind != "house" and kind != "shed" and kind != "shop":
			continue
		var bk: Dictionary = b.blocks[0]
		var c: Vector2 = bk.c
		var r: Rect2 = b.rect
		var ent_side := String((bk.ent[0] as Array)[0]) if not (bk.ent as Array).is_empty() else ""
		var sides := ["s+", "s-", "e+", "e-"]
		var n := 0
		for tries in 12:
			if n >= 2:
				break
			var sd: String = sides[rng.randi() % 4]
			if sd == ent_side:
				continue
			# сторона в местных осях блока → мир: точка вдоль стены и наружу на 0,45 м
			var nrm: Vector3 = b._side_n(bk, sd)
			var along: Vector3 = Vector3(-nrm.z, 0, nrm.x)
			var half := (r.size.x if absf(along.x) > 0.5 else r.size.y) * 0.5 - 0.8
			var cen := Vector3(r.get_center().x, 0, r.get_center().y)
			var ext := (r.size.y if absf(nrm.z) > 0.5 else r.size.x) * 0.5
			var p := cen + nrm * (ext + 0.45) + along * rng.randf_range(-half, half)
			if bld_dist(Vector2(p.x, p.z)) < 0.25 or road_dist(Vector2(p.x, p.z)) < 3.0:
				continue
			var yaw := atan2(nrm.x, nrm.z)
			match [0, 1, 1, 2, 3][rng.randi() % 5]:
				0:
					_c_model_box(MODELS + "ph_bucket.glb", p, rng.randf() * TAU, 0.35, Color(0.85, 0.83, 0.8), "ph_bucket", false)
				1:
					# доски, прислонённые к стене
					for k in rng.randi_range(2, 4):
						var q := p + along * (k * 0.22 - 0.3) - nrm * 0.12
						_bx(g, "planks_brown", Vector3(0.18, 1.9, 0.03), Transform3D(Basis(along, -0.22) * Basis(Vector3.UP, yaw), q + Vector3.UP * 0.93))
					blob_pts.append([p - nrm * 0.1, Vector2(0.9, 0.5), yaw, 0.45])
				2:
					_c_model_box(MODELS + "ph_tyre.glb", p + nrm * 0.1, rng.randf() * TAU, 0.75, Color(0.85, 0.83, 0.8), "ph_tyre", false)
				_:
					_c_model_box(MODELS + "ul_crate.glb", p + nrm * 0.15, yaw + rng.randf_range(-0.3, 0.3), 0.75, Color(0.85, 0.83, 0.8), "ul_crate", false)
			n += 1
	_flush(g)


## поворот модели с «лицом» по +X так, чтобы лицо смотрело в сторону dir (для _c_model_box: +Z → (sin, cos))
static func face_x(dir: Vector3) -> float:
	return atan2(-dir.z, dir.x)


## Модели Tripo для двора: лавка у крыльца каждого дома, собачьи будки, пугала на огородах, двери на глухих
## стенах сараев, летняя веранда во дворе большого дома, пасека за штакетником с открытой калиткой.
func _k_tripo_props(rng: RandomNumberGenerator) -> void:
	var tint := Color(0.86, 0.84, 0.8)
	for b in blds:
		var kind := String(b.def.get("kind", ""))
		if (b.entrances as Array).is_empty():
			continue
		var outp: Vector3 = b.entrances[0][0]
		var inp: Vector3 = b.entrances[0][1]
		var nrm := outp - inp
		nrm.y = 0.0
		nrm = nrm.normalized()
		var along := Vector3(-nrm.z, 0, nrm.x)
		if kind == "house":
			# лавка у стены рядом с крыльцом, лицом во двор
			var pb := outp - nrm * 1.05 + along * (2.4 if rng.randf() < 0.5 else -2.4)
			if bld_dist(Vector2(pb.x, pb.z)) > 0.3:
				_c_model_box(MODELS + "kh_bench.glb", pb, face_x(nrm), 1.5, tint, "kh_bench", true)
		elif kind == "shed":
			# дверь на глухой стене напротив ворот (сарай, хозпостройка; у гаража — нет)
			if String(b.def.id) == "garage":
				continue
			var r: Rect2 = b.rect
			var cen := Vector3(r.get_center().x, 0, r.get_center().y)
			var ext := (r.size.y if absf(nrm.z) > 0.5 else r.size.x) * 0.5
			_c_model_box(MODELS + "kh_door.glb", cen - nrm * (ext + 0.03), face_x(-nrm), 2.05, tint, "kh_door", false, true)
	# собачьи будки — в трёх дворах, в углу подальше от дома
	for yi in [0, 2, 5]:
		var yr: Rect2 = (K_YARDS[yi][0] as Rect2).grow(-1.6)
		for tries in 8:
			var q := Vector2(yr.position.x if rng.randf() < 0.5 else yr.end.x, yr.position.y if rng.randf() < 0.5 else yr.end.y)
			if bld_dist(q) < 3.0 or in_garden(q):
				continue
			var to_c := Vector3(yr.get_center().x - q.x, 0, yr.get_center().y - q.y).normalized()
			_c_model_box(MODELS + "kh_kennel.glb", Vector3(q.x, 0, q.y), face_x(to_c), 1.1, tint, "kh_kennel", true)
			break
	# пугала посреди огородов
	for gi in [0, 2, 4]:
		var gr: Rect2 = K_GARDENS[gi]
		var pc := Vector3(gr.get_center().x, 0, gr.get_center().y)
		_c_model_box(MODELS + "kh_scarecrow.glb", pc, face_x(Vector3(0, 0, 1)), 1.9, tint, "kh_scarecrow", false, true)
	# летняя веранда во дворе большого дома (h6)
	_c_model_box(MODELS + "kh_porch.glb", Vector3(58.0, 0, -4.5), face_x(Vector3(-1, 0, 0)), 3.0, tint, "kh_porch", true)
	# пасека: штакетник из секций по периметру, на южной стороне проход и распахнутая калитка
	var ax0 := K_APIARY.x - 1.8
	var ax1 := K_APIARY.x + 3.2 + 1.8
	var az0 := K_APIARY.z - 1.6
	var az1 := K_APIARY.z + 1.7 + 1.6
	var sides := [[Vector2(ax0, az0), Vector2(ax1, az0)], [Vector2(ax1, az0), Vector2(ax1, az1)], [Vector2(ax0, az1), Vector2(ax0, az0)]]
	var gm := (ax0 + ax1) * 0.5
	sides.append([Vector2(ax1, az1), Vector2(gm + 0.75, az1)])
	sides.append([Vector2(gm - 0.75, az1), Vector2(ax0, az1)])
	for sd in sides:
		var a2: Vector2 = sd[0]
		var b2: Vector2 = sd[1]
		var ln := a2.distance_to(b2)
		var n := maxi(int(ceil(ln / 1.9)), 1)
		var dv := (b2 - a2) / ln
		for k in n:
			var c2 := a2 + dv * (ln * (k + 0.5) / n)
			_c_model_box(MODELS + "kh_fence.glb", Vector3(c2.x, 0, c2.y), atan2(dv.x, dv.y), ln / n, tint, "kh_fence", false)
			var cs := CollisionShape3D.new()
			var bs := BoxShape3D.new()
			bs.size = Vector3(0.1, 1.1, ln / n)
			cs.shape = bs
			cs.transform = Transform3D(Basis(Vector3.UP, atan2(dv.x, dv.y)), Vector3(c2.x, 0.55, c2.y))
			body.add_child(cs)
	# калитка распахнута наружу у прохода
	_c_model_box(MODELS + "kh_gate.glb", Vector3(gm + 0.8, 0, az1 + 0.75), atan2(0.0, 1.0), 1.5, tint, "kh_gate", false)


## лес: редкий, только по краям — внутри кольца улицы поле и усадьба
func forest_ok(q: Vector2) -> bool:
	if absf(q.x) < 36.0 and q.y > -46.0 and q.y < 40.0:
		return false
	if over_cellar(q, 3.0):
		return false
	for y in K_YARDS:
		if (y[0] as Rect2).grow(1.5).has_point(q):
			return false
	return not in_garden(q)


func forest_n() -> int:
	return 210


## деревья хутора: яблони во дворах, берёзы у домов
func _k_trees(rng: RandomNumberGenerator) -> void:
	var apple: PackedScene = load(MODELS + "ul_apple.glb") if ResourceLoader.exists(MODELS + "ul_apple.glb") else null
	var birch: PackedScene = load(MODELS + "ul_birch.glb") if ResourceLoader.exists(MODELS + "ul_birch.glb") else null
	var placed := 0
	var tries := 0
	while placed < 26 and tries < 1500:
		tries += 1
		var y: Array = K_YARDS[rng.randi() % K_YARDS.size()]
		var r: Rect2 = (y[0] as Rect2).grow(-1.2)
		var q := Vector2(rng.randf_range(r.position.x, r.end.x), rng.randf_range(r.position.y, r.end.y))
		if bld_dist(q) < 2.5 or in_garden(q) or road_dist(q) < 4.0 or track_dist(q) < 2.0:
			continue
		var near := false
		for t in trees:
			if Vector2(t.position.x, t.position.z).distance_to(q) < 4.0:
				near = true
				break
		if near:
			continue
		var sc: PackedScene = apple if rng.randf() < 0.7 or birch == null else birch
		if sc == null:
			continue
		_tree(sc, Vector3(q.x, 0, q.y), rng.randf_range(3.2, 4.4) if sc == apple else rng.randf_range(5.0, 6.5), rng.randf() * TAU, "ul_apple" if sc == apple else "ul_birch")
		_cyl_col(Vector3(q.x, 0, q.y), 0.2, 2.5)
		placed += 1


# ---------------- враги, тайники, хлам ----------------

## места снаружи: улица, дворы, огороды, у сараев, у техники, поле, лес
func _k_spots(rng: RandomNumberGenerator) -> void:
	for k in 460:
		var q := Vector2(rng.randf_range(-70, 70), rng.randf_range(-70, 70))
		if bld_dist(q) < 1.0:
			continue
		var tag := "forest"
		if road_dist(q) < 4.0:
			tag = "street"
		elif in_garden(q):
			tag = "garden"
		elif clear_w(q) > 0.0:
			tag = "yard"
		elif absf(q.x) < 34.0 and q.y > -44.0 and q.y < 38.0:
			tag = "field"
		for b in blds:
			if b.style == "wood" and b.def.get("kind", "") == "shed" and b.rect.grow(7.0).has_point(q) and not b.rect.grow(0.8).has_point(q):
				tag = "barns"
		for v in K_VEHICLES:
			if Vector2((v[1] as Vector3).x, (v[1] as Vector3).z).distance_to(q) < 6.0:
				tag = "tech"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


func _zone_pools(pools: Dictionary) -> void:
	_extra_pools(pools)


## зоны внутри: дома, магазин, сараи, погреба (по виду постройки)
func _extra_pools(pools: Dictionary) -> void:
	for kz in ["houses", "big_houses", "shop", "sheds", "cellars"]:
		pools[kz] = []
	for b in blds:
		var kind := String(b.def.get("kind", ""))
		for sp in b.spots:
			match kind:
				"house":
					pools["houses"].append(sp[0])
					if float(b.blocks[0].L) >= 10.0:
						pools["big_houses"].append(sp[0])
				"shop":
					pools["shop"].append(sp[0])
				"shed":
					pools["sheds"].append(sp[0])
				"cellar":
					pools["cellars"].append(sp[0])


## хлам: в постройках (общее) и кучками у сараев и техники
func junk_points(rng: RandomNumberGenerator) -> Array:
	var out := junk_in_buildings(rng)
	for v in K_VEHICLES:
		var a := rng.randf() * TAU
		var p: Vector3 = (v[1] as Vector3) + Vector3(cos(a), 0, sin(a)) * rng.randf_range(2.8, 4.0)
		if bld_dist(Vector2(p.x, p.z)) > 0.8:
			out.append(p + Vector3.UP * 0.02)
	return out


# ---------------- кадр: погреба ----------------

## Герой в погребе (или на его лестнице): земля над ним вырезана, будка и насыпь скрыты — виден подземный уровень −1.
## Вышел — всё на месте.
func tick(hero: Vector3, cam, delta: float) -> void:
	super.tick(hero, cam, delta)
	var cur := -1
	for i in cellars.size():
		if int(cellars[i].bi) == hero_b:
			cur = i
	if hero_lamp != null:
		hero_lamp.visible = cur >= 0 or hero.y < -0.6
		if hero_lamp.visible:
			hero_lamp.global_position = hero + Vector3.UP * 1.7
	if cur != _cut_on:
		_cut_on = cur
		for i in cellars.size():
			var cl: Dictionary = cellars[i]
			(cl.cover as Node3D).visible = i != cur
			for lf in cl.leaves:
				(lf as Node3D).visible = i != cur
			(cl.pit as Node3D).visible = i == cur
		if _ground_mat != null:
			_ground_mat.set_shader_parameter("cut_on", 1.0 if cur >= 0 else 0.0)
			if cur >= 0:
				_ground_mat.set_shader_parameter("cut_rect", cellars[cur].cut)
		ULVegetation.set_cut(cellars[cur].cut if cur >= 0 else Vector4.ZERO, cur >= 0)


func _exit_tree() -> void:
	ULVegetation.set_cut(Vector4.ZERO, false)


## свет: тёплые лампы, в подвале горят все его помещения сразу (до четырёх ламп); под землёй у героя — фонарь
func _light_pool() -> void:
	light_n = 4
	super._light_pool()
	for l in _lights:
		l.light_color = Color(1.0, 0.8, 0.55)
		l.light_energy = 1.45
		l.omni_range = 8.5
	lamp_energy = 1.45
	hero_lamp = OmniLight3D.new()
	hero_lamp.name = "HeroLamp"
	hero_lamp.light_color = Color(1.0, 0.9, 0.75)
	hero_lamp.light_energy = 0.9
	hero_lamp.omni_range = 5.5
	hero_lamp.omni_attenuation = 1.4
	hero_lamp.shadow_enabled = false
	hero_lamp.light_cull_mask = 2
	hero_lamp.visible = false
	add_child(hero_lamp)
	_cellar_fixtures()


## лампочки под потолком подвалов: провод, жестяной абажур и светящаяся лампа — там, где горит свет помещения
func _cellar_fixtures() -> void:
	var bulb := StandardMaterial3D.new()
	bulb.albedo_color = Color(1.0, 0.9, 0.7)
	bulb.emission_enabled = true
	bulb.emission = Color(1.0, 0.78, 0.45)
	bulb.emission_energy_multiplier = 3.0
	var shade := StandardMaterial3D.new()
	shade.albedo_color = Color(0.32, 0.36, 0.3)
	shade.metallic = 0.5
	shade.roughness = 0.6
	var wire := StandardMaterial3D.new()
	wire.albedo_color = Color(0.08, 0.08, 0.08)
	for cl in cellars:
		var b := blds[int(cl.bi)]
		var g := Node3D.new()
		g.name = "CellarLamps%d" % int(cl.bi)
		add_child(g)
		var ceil_y := b.base_y + b.storey - 0.22
		for lp in b.lamps:
			var p: Vector3 = lp[0]
			var parts := [
				[BoxMesh.new(), Vector3(0.015, ceil_y - p.y, 0.015), p + Vector3.UP * (ceil_y - p.y) * 0.5, wire],
				[CylinderMesh.new(), Vector3.ZERO, p + Vector3.DOWN * 0.04, shade],
				[SphereMesh.new(), Vector3.ZERO, p + Vector3.DOWN * 0.12, bulb],
			]
			(parts[0][0] as BoxMesh).size = parts[0][1]
			var cy := parts[1][0] as CylinderMesh
			cy.top_radius = 0.05
			cy.bottom_radius = 0.2
			cy.height = 0.12
			cy.radial_segments = 12
			var sp := parts[2][0] as SphereMesh
			sp.radius = 0.06
			sp.height = 0.12
			sp.radial_segments = 8
			sp.rings = 4
			for pr in parts:
				var mi := MeshInstance3D.new()
				mi.mesh = pr[0]
				mi.material_override = pr[3]
				mi.position = pr[2]
				mi.layers = 2
				mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				g.add_child(mi)


## над подвалом (с вырезом земли и запасом m) — тут на поверхности ничего не ставится
func over_cellar(q: Vector2, m: float) -> bool:
	for b in K_BUILDINGS:
		if String(b.kind) != "cellar":
			continue
		var bk: Dictionary = b.blocks[0]
		var c: Vector2 = bk.c
		var r := Rect2(c.x - float(bk.L) * 0.5, c.y - float(bk.W) * 0.5, float(bk.L), float(bk.W) + RUN + 4.0)
		if r.grow(m).has_point(q):
			return true
	return false


## в погребе ли точка (индекс погреба или −1)
func cellar_at(p: Vector3) -> int:
	var l := locate(p)
	if l.x < 0:
		return -1
	for i in cellars.size():
		if int(cellars[i].bi) == l.x:
			return i
	return -1
