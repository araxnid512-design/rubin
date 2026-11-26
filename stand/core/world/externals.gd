class_name ULExternals
extends ULDepot
## «База Внешников» — укреплённая военная база 5-го уровня опасности в лесу (задание пользователя 26.11: план
## поверхности сверху и четыре видео-образца). Поле 150 × 150 м; база — квадрат 76 × 76 м в кольце высокой бетонной
## стены с четырьмя угловыми вышками; ворота — на юге, к ним из леса ведёт бетонная дорога. Север — в сторону −Z.
##
## Главное здание (посередине, один этаж, без окон) собрано из девяти прямоугольных помещений с проходами между
## ними — по плану: в центре лифтовой зал с шахтой лифта и капсулой для красной жемчужины; на востоке — зал
## терминала 1, на западе — терминала 2, на севере — терминала 3 (у каждого терминала свой компьютер на столе);
## по сторонам северного зала — две кладовые; на юго-западе — генераторная, на юго-востоке — склад; между ними —
## входной коридор от главного входа к лифту. Во дворе: охранный пост у ворот, техзона на северо-востоке,
## вертолётная площадка на северо-западе, палатки у западной стены, резервуары у восточной, контейнеры и ящики.
##
## Чего здесь пока нет (по заданию создаётся отдельно): людей, врагов, турелей и босса. Терминалы и компьютеры
## стоят, но не включаются. Подземные этажи и работа лифта — следующим этапом.
## Поясняющих надписей из плана в мире нет: названия помещений — только в интерфейсе.

const X_CFG := "res://data/externals.json"
const X_NAV := "res://assets/world/nav_externals.res"
const X_MASK := "res://assets/world/tex/externals_mask.png"
const X_CACHE := "res://assets/world/externals_blocks.res"
const X_TITLE := "База Внешников"
const X_ENTRY := Vector3(0.0, 0, 68.0)
const XH := 75.0                        ## половина поля
const XW := 38.0                        ## стена периметра: |x| = XW, |z| = XW
const X_GATE := 5.0                     ## половина ширины ворот (ворота — в южной стене у x = 0)
const X_WALL_H := 4.2
const X_WALL_T := 0.9
const X_LIFT := Vector3(0, 0, 0)        ## середина шахты лифта
const X_CAPSULE := Vector3(3.9, 0, 5.2) ## капсула для красной жемчужины — справа от входа в лифт
## терминалы и их компьютеры: [номер, блок здания, где терминал, поворот, где стол с компьютером, поворот]
const X_TERMS := [
	[1, 3, Vector3(14.0, 0, -0.5), PI * 0.5, Vector3(20.5, 0, -1.2), 0.0],
	[2, 2, Vector3(-18.5, 0, -0.5), PI * 0.5, Vector3(-13.0, 0, -1.2), 0.0],
	[3, 1, Vector3(-2.6, 0, -15.0), 0.0, Vector3(2.6, 0, -15.6), 0.0],
]

## Обстановка главного здания (кроме терминалов и компьютеров): [модель, блок, где, поворот, размер]. Все залы — с
## одинаковым серым плиточным полом (тип помещения «cor»), поэтому мебель генератор сам не ставит — она вся здесь.
const X_FURN := [
	# генераторная (блок 7): два генератора, трансформатор, шкафы, бочки
	["hm_generator", 7, Vector3(-16.5, 0, 16.5), 0.0, Vector3(2.6, 1.7, 1.5)], ["hm_generator", 7, Vector3(-11.5, 0, 16.5), 0.0, Vector3(2.6, 1.7, 1.5)],
	["qr_transformer", 7, Vector3(-20.0, 0, 10.5), 0.0, Vector3(2.2, 2.0, 1.4)], ["gr_cabinet", 7, Vector3(-7.0, 0, 9.0), 0.0, Vector3(1.2, 1.9, 0.6)],
	["gr_cabinet", 7, Vector3(-5.4, 0, 9.0), 0.0, Vector3(1.2, 1.9, 0.6)], ["gr_barrels", 7, Vector3(-5.5, 0, 18.3), 0.4, Vector3(1.6, 1.0, 1.6)],
	["gr_toolchest", 7, Vector3(-13.5, 0, 9.0), 0.0, Vector3(1.4, 1.1, 0.7)],
	# склад (блок 8): стеллажи вдоль стен, ящики и паллеты посередине
	["gr_shelf", 8, Vector3(6.5, 0, 9.0), 0.0, Vector3(2.4, 2.2, 0.7)], ["gr_shelf2", 8, Vector3(9.5, 0, 9.0), 0.0, Vector3(2.4, 2.2, 0.7)],
	["gr_shelf", 8, Vector3(12.5, 0, 9.0), 0.0, Vector3(2.4, 2.2, 0.7)], ["ul_ammo_shelf", 8, Vector3(16.0, 0, 9.0), 0.0, Vector3(2.2, 2.0, 0.7)],
	["ul_army_crate", 8, Vector3(8.0, 0, 17.8), 0.2, Vector3(1.3, 0.8, 0.9)], ["ul_army_crate", 8, Vector3(10.0, 0, 18.0), 0.0, Vector3(1.3, 0.8, 0.9)],
	["qr_pallets", 8, Vector3(13.5, 0, 17.6), 0.0, Vector3(1.3, 1.2, 1.3)], ["ul_crate", 8, Vector3(16.0, 0, 17.8), 0.5, Vector3(1.1, 0.9, 1.1)],
	["pt_forklift", 8, Vector3(18.5, 0, 14.5), 1.2, Vector3(2.6, 2.0, 1.3)],
	# кладовая северо-запад (блок 4): ящики и стеллажи
	["ul_army_crate", 4, Vector3(-17.5, 0, -20.5), 0.0, Vector3(1.3, 0.8, 0.9)], ["ul_army_crate", 4, Vector3(-15.5, 0, -20.5), 0.1, Vector3(1.3, 0.8, 0.9)],
	["ul_crate", 4, Vector3(-18.5, 0, -17.0), 0.3, Vector3(1.1, 0.9, 1.1)], ["gr_shelf", 4, Vector3(-11.0, 0, -21.0), 0.0, Vector3(2.4, 2.2, 0.7)],
	["qr_pallets", 4, Vector3(-18.0, 0, -11.0), 0.0, Vector3(1.3, 1.2, 1.3)], ["ul_crate", 4, Vector3(-15.5, 0, -10.5), 0.9, Vector3(1.1, 0.9, 1.1)],
	# кладовая северо-восток (блок 5): стойки с аппаратурой и шкафы
	["hm_rack", 5, Vector3(9.0, 0, -21.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 5, Vector3(10.4, 0, -21.0), 0.0, Vector3(1.0, 2.0, 0.8)],
	["hm_rack", 5, Vector3(11.8, 0, -21.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 5, Vector3(13.2, 0, -21.0), 0.0, Vector3(1.0, 2.0, 0.8)],
	["gr_cabinet", 5, Vector3(18.6, 0, -18.0), -PI * 0.5, Vector3(1.2, 1.9, 0.6)], ["gr_cabinet", 5, Vector3(18.6, 0, -16.2), -PI * 0.5, Vector3(1.2, 1.9, 0.6)],
	["ul_army_crate", 5, Vector3(16.0, 0, -10.5), 0.0, Vector3(1.3, 0.8, 0.9)],
	# залы терминалов: по паре ящиков у стен (сами терминалы и компьютеры — X_TERMS)
	["ul_army_crate", 3, Vector3(23.5, 0, 6.0), 0.0, Vector3(1.3, 0.8, 0.9)], ["gr_cabinet", 3, Vector3(24.5, 0, -6.8), 0.0, Vector3(1.2, 1.9, 0.6)],
	["ul_army_crate", 2, Vector3(-23.5, 0, 6.0), 0.0, Vector3(1.3, 0.8, 0.9)], ["gr_shelf", 2, Vector3(-22.0, 0, -6.8), 0.0, Vector3(2.4, 2.2, 0.7)],
	["gr_cabinet", 1, Vector3(4.6, 0, -21.0), 0.0, Vector3(1.2, 1.9, 0.6)], ["ul_army_crate", 1, Vector3(-4.5, 0, -10.0), 0.2, Vector3(1.3, 0.8, 0.9)],
]

## Главное здание: девять блоков одного здания. Порядок блоков важен (на него ссылаются X_TERMS и обстановка):
## 0 лифтовой зал, 1 терминал 3 (север), 2 терминал 2 (запад), 3 терминал 1 (восток), 4 кладовая СЗ, 5 кладовая СВ,
## 6 входной коридор, 7 генераторная, 8 склад. links — проходы в общих стенах: [точка, сколько этажей].
const X_BUILDINGS := [
	{"id": "main", "n": "Главное здание", "kind": "hq", "skin": "xb_wall", "int": "xb_wall", "floor_mat": {"*": "xb_floor"}, "storey": 3.6, "te": 0.45,
		"links": [[Vector2(0, -8), 1], [Vector2(-8, 0), 1], [Vector2(8, 0), 1], [Vector2(0, 8), 1],
			[Vector2(-6, -15), 1], [Vector2(6, -15), 1], [Vector2(-3, 14), 1], [Vector2(3, 14), 1]],
		"blocks": [
			{"c": Vector2(0, 0), "L": 16.0, "W": 16.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(0, -15), "L": 12.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(-17, 0), "L": 18.0, "W": 16.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(17, 0), "L": 18.0, "W": 16.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(-13, -15), "L": 14.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(13, -15), "L": 14.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor", "entr": [], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(0, 14), "L": 6.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor",
				"entr": [["s+", 0.0, 3.0, "plain"]], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(-12.5, 14), "L": 19.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor",
				"entr": [["e-", 0.0, 1.4, "plain"]], "blind": ["s+", "s-", "e+", "e-"]},
			{"c": Vector2(12.5, 14), "L": 19.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "cor",
				"entr": [["e+", 0.0, 2.6, "plain"]], "blind": ["s+", "s-", "e+", "e-"]},
		]},
	{"id": "guard", "n": "Охранный пост", "skin": "plaster", "int": "int_grey1", "storey": 2.8, "te": 0.3,
		"blocks": [{"c": Vector2(-17, 33.5), "L": 12.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "guard",
			"entr": [["s-", 2.0, 1.2, "plain"]], "win_w": 1.2, "win_h": 0.9, "sill": 1.1, "blind": ["s+", "e-"]}]},
	{"id": "tech", "n": "Техзона", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 3.4, "te": 0.1, "roof_mat": "q_tin",
		"blocks": [{"c": Vector2(27.5, -29), "L": 13.0, "W": 9.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "tech",
			"entr": [["s+", -3.0, 1.6, "plain"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "tent1", "n": "Палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.0, "te": 0.1, "cross": false,
		"blocks": [{"c": Vector2(-31.5, 1), "L": 6.0, "W": 4.5, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_live",
			"entr": [["e+", 0.0, 1.4, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
	{"id": "tent2", "n": "Палатка", "style": "tent", "skin": "canvas", "int": "canvas_in", "storey": 2.0, "te": 0.1, "cross": false,
		"blocks": [{"c": Vector2(-31.5, 10), "L": 6.0, "W": 4.5, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "tent_live",
			"entr": [["e+", 0.0, 1.4, "flap"]], "blind": ["s+", "s-", "e+", "e-"]}]},
]

## бетонная дорога: из леса с юга к воротам и дальше к главному входу
const X_ROADS := [
	[Vector2(0, 75), Vector2(0, 38), Vector2(0, 21)],
]
const X_HELIPAD := Vector2(-25.5, -27.5)
## техника, оборудование, груз во дворе: [модель, где, поворот, длина, вид тайника, название]
const X_THINGS := [
	["pt_container", Vector3(-2, 0, -33.5), PI * 0.5, 6.0, "crate", "Контейнер"], ["pt_container", Vector3(31.5, 0, 16), 0.0, 6.0, "crate", "Контейнер"],
	["pt_container", Vector3(31.5, 0, 24), 0.0, 6.0, "crate", "Контейнер"],
	["pt_tank_v", Vector3(31.0, 0, -8.5), 0.0, 5.0, "fuel", "Резервуар"], ["pt_tank_v", Vector3(34.0, 0, -8.5), 0.0, 5.0, "", ""],
	["qr_transformer", Vector3(33.5, 0, -19.5), 0.0, 2.6, "tech", "Трансформаторный шкаф"], ["hm_generator", Vector3(21.5, 0, -22.0), 0.0, 1.6, "tech", "Генератор"],
	["qr_satdish", Vector3(18.0, 0, -33.0), 0.6, 3.0, "", ""], ["qr_ibc", Vector3(33.0, 0, 3.0), 0.0, 1.2, "", ""], ["qr_ibc", Vector3(33.0, 0, 5.0), 0.0, 1.2, "", ""],
	["gr_barrels", Vector3(-33.0, 0, -18.0), 0.4, 1.8, "", ""], ["gr_barrels", Vector3(8.0, 0, -33.5), 1.1, 1.8, "", ""],
	["cv_sandbags", Vector3(-8.5, 0, 34.5), 0.0, 3.0, "", ""], ["cv_sandbags", Vector3(8.5, 0, 34.5), 0.0, 3.0, "", ""],
	["cv_sandbags", Vector3(-4.5, 0, 24.5), PI * 0.5, 3.0, "", ""], ["cv_sandbags", Vector3(4.5, 0, 24.5), PI * 0.5, 3.0, "", ""],
	["xd_heli", Vector3(-25.5, 0, -27.5), 0.6, 13.0, "", ""], ["xd_apc", Vector3(-21.0, 0, 27.0), 0.0, 7.4, "", ""], ["xd_apc", Vector3(26.0, 0, 4.0), PI * 0.5, 7.4, "", ""],
	["ul_gaz66", Vector3(20.0, 0, 30.5), PI * 0.5, 6.0, "truck", "Грузовик"], ["ul_kung", Vector3(-30.0, 0, -8.5), 0.0, 6.5, "kung", "Кунг"],
]
## штабеля: [x, z, сколько, вид, обыскивается]
const X_PILES := [
	[-33, 20, 3, "crate", true], [-33, 26, 2, "pallet", true], [-12, -33.5, 3, "crate", true], [-17, -33.5, 2, "barrel", false], [26, -19, 2, "crate", true],
	[33, 31, 3, "crate", true], [27, 9, 2, "pallet", true], [-27, 30, 2, "crate", true], [12, 26, 2, "crate", true], [-12, 26, 2, "barrel", false],
]

static var _xcfg := {}
static var _xm := {}                    ## свои материалы базы (свечение ламп, стекло капсул) — «x_…»

var level := 0                          ## 0 — поверхность; 1–3 — подземные этажи (ULExternalsDeep)
var _door_body: StaticBody3D            ## створки лифта: закрыты, пока комплекс не открыт жемчужиной
var _door_l: MeshInstance3D
var _door_r: MeshInstance3D
var _caps_glow: MeshInstance3D          ## жемчужина в капсуле (видна, пока комплекс открыт)
var lift_open := false
var arrived := false                    ## герой приехал на лифте: появляется в кабине, а не у ворот
const X_LIFT_IN := Vector3(0, 0.2, 0.3)  ## где герой стоит в кабине лифта (и появляется, приехав на лифте)


static func xcfg() -> Dictionary:
	if _xcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(X_CFG))
		_xcfg = d if d is Dictionary else {}
	return _xcfg


func conf() -> Dictionary:
	return xcfg()


func entry() -> Vector3:
	return X_LIFT_IN if arrived else X_ENTRY


## как называется место для игрока и для сохранения: поверхность — «externals», этажи — «externals_f1…3»
static func place_of(lv: int) -> String:
	return "externals" if lv <= 0 else "externals_f%d" % lv


static func level_of(pl: String) -> int:
	return int(pl.substr(11)) if pl.begins_with("externals_f") else 0


static func level_title(lv: int) -> String:
	return "Поверхность" if lv <= 0 else "Подземный этаж %d" % lv


## что строится: постройки, их кэш, карта проходимости, подпись кэша — у подземных этажей свои
func x_defs() -> Array:
	return X_BUILDINGS


func x_cache() -> String:
	return X_CACHE


func nav_path() -> String:
	return X_NAV


func x_sig_n() -> int:
	return x_sig()


## точки взаимодействия: [вид, где] — капсула для жемчужины (только на поверхности) и пульт в кабине лифта
func x_zones() -> Array:
	var out := [["x_lift", X_LIFT + Vector3(0, 0.2, 0)]]
	if level == 0:
		out.append(["x_capsule", X_CAPSULE])
		for t in X_TERMS:
			out.append(["x_term%d" % int(t[0]), t[2]])   # терминалы сборки ящиков (ULCrates)
	return out


## собранный ящик с добычей у терминала n: модель стоит рядом с терминалом, пока в ящике что-то лежит
var _crate_nodes := {}


func crate_show(n: int, model: String, on: bool) -> void:
	if not _crate_nodes.has(n):
		if not on:
			return
		for t in X_TERMS:
			if int(t[0]) == n:
				var at: Vector3 = (t[2] as Vector3) + Vector3(0.0, 0.2, 1.45)
				_crate_nodes[n] = null
				if ResourceLoader.exists(MODELS + model + ".glb"):
					# пропорции — как у самой модели, длинной стороной (1,25 м) вдоль стены
					var tmp: Node3D = (load(MODELS + model + ".glb") as PackedScene).instantiate()
					var bb: AABB = w._aabb(tmp)
					tmp.free()
					var k := 1.25 / maxf(maxf(bb.size.x, bb.size.z), 0.01)
					_crate_nodes[n] = _xd(model, Vector3(at.x, 0.2, at.z), 0.0 if bb.size.x >= bb.size.z else PI * 0.5, bb.size * k, Vector3.ZERO, 40.0)
	var nd = _crate_nodes.get(n)
	if nd != null and is_instance_valid(nd):
		(nd as Node3D).visible = on


## свои материалы: свечение (красное, зелёное, тёплое), цветное стекло капсул, чёрная порода вокруг этажа
func _mat(m: String) -> Material:
	if not m.begins_with("x_"):
		return super._mat(m)
	if not _xm.has(m):
		var sm := StandardMaterial3D.new()
		var cols := {"x_red": Color(1.0, 0.16, 0.12), "x_green": Color(0.3, 1.0, 0.42), "x_warm": Color(1.0, 0.86, 0.6), "x_blue": Color(0.45, 0.8, 1.0),
			"x_yellow": Color(0.95, 0.75, 0.1), "x_dark": Color(0.035, 0.035, 0.04), "x_rglass": Color(1.0, 0.2, 0.15, 0.2), "x_gglass": Color(0.3, 1.0, 0.45, 0.17),
			"x_glass": Color(0.7, 0.85, 0.9, 0.22), "x_steel": Color(0.3, 0.32, 0.34), "x_black": Color(0.08, 0.08, 0.09)}
		var c: Color = cols.get(m, Color(1, 0, 1))
		sm.albedo_color = c
		if m in ["x_red", "x_green", "x_warm", "x_blue"]:
			sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		elif m.ends_with("glass"):
			sm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
			sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			sm.cull_mode = BaseMaterial3D.CULL_DISABLED
		elif m == "x_dark":
			sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		else:
			sm.roughness = 0.6
			sm.metallic = 0.4 if m == "x_steel" else 0.0
		_xm[m] = sm
	return _xm[m]


func title() -> String:
	return X_TITLE


func spawn_limit() -> float:
	return XW - 2.0


static func x_sig() -> int:
	return hash(str(X_BUILDINGS) + str(X_FURN) + str(X_TERMS) + "|" + str(ULBlock.GEN_V))


static func in_base(q: Vector2) -> bool:
	return absf(q.x) < XW and absf(q.y) < XW


func road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in X_ROADS:
		for i in (r as Array).size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func clear_w(q: Vector2) -> float:
	return 1.0 if absf(q.x) < XW + 2.5 and absf(q.y) < XW + 2.5 else 0.0


func pave_dist(q: Vector2) -> float:
	return road_dist(q) - 4.0


func forest_ok(q: Vector2) -> bool:
	return (absf(q.x) > XW + 3.5 or absf(q.y) > XW + 3.5) and not (absf(q.x) < 7.5 and q.y > 0.0)


func forest_n() -> int:
	return 210


func _land_ok(q: Vector2) -> bool:
	return in_base(q)


func _junk_spots() -> Array:
	var spots: Array = []
	for t in X_THINGS:
		if String(t[4]) != "":
			spots.append(t[1])
	return spots


# ---------------- сборка ----------------

func build(world: Node3D) -> void:
	w = world
	half = XH
	body = StaticBody3D.new()
	body.name = "ExternalsBody"
	var fn := FastNoiseLite.new()
	fn.seed = 9151
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4407
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "xbbake" and ResourceLoader.exists(x_cache()):
		var r = load(x_cache())
		if r is ULBlockCache and (r as ULBlockCache).sig == x_sig_n():
			cache = r
		else:
			push_warning("база Внешников: кэш построек устарел — пересоберите --as-test=xbbake")
	var made := {}
	for d in x_defs():
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
		_x_inside(b)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_x_outdoor(rng, props)
	add_child(body)
	set_lift_open(level > 0 or ULBase.ext_left() > 0 or bool(w.lvl))
	if w.test == "xbbake":
		var cr := ULBlockCache.new()
		cr.sig = x_sig_n()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, x_cache(), ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек базы Внешников: %s (%s)" % [x_cache(), error_string(err)])
	print("[externals] база (уровень %d) собрана: %d мс, построек %d, столкновений %d" % [level, Time.get_ticks_msec() - t0, blds.size(), body.get_child_count()])


## Модель декорации (assets/world/xd_*.glb, Tripo) в точные габариты size (по осям самой модели: X × высота × Z),
## повёрнутая на yaw; col — коробка столкновения (ZERO — нет); far — с какого расстояния не рисуется.
## fx (можно несколько слов): «cut» — срезать всё выше cut_y (кабина лифта: герой внутри виден сверху), «swap» — зелёное
## в красное и наоборот, «glow» — цветные (насыщенные) части светятся сами: стекло капсул, огни реактора.
## Нет файла модели — вернёт null (вызывающий рисует простую форму).
func _xd(id: String, at: Vector3, yaw: float, size: Vector3, col := Vector3.ZERO, far := 60.0, fx := "", cut_y := 0.0) -> Node3D:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		return null
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	var bb: AABB = w._aabb(n)
	var sc := Vector3(size.x / maxf(bb.size.x, 0.01), size.y / maxf(bb.size.y, 0.01), size.z / maxf(bb.size.z, 0.01))
	n.scale = sc
	n.rotation.y = yaw
	var c := bb.get_center() * sc
	n.position = at - Basis(Vector3.UP, yaw) * Vector3(c.x, 0, c.z) - Vector3(0, bb.position.y * sc.y, 0)
	add_child(n)
	for gi in n.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		(gi as GeometryInstance3D).lod_bias = 0.5
	if fx != "":
		_xd_fx(n, fx, cut_y)
	else:
		ULSanatorium.mute(n)
	_cull(n, far)
	blob_pts.append([at, Vector2(size.x, size.z), yaw, 0.5])
	if col != Vector3.ZERO:
		_col_xf(col, Transform3D(Basis(Vector3.UP, yaw), at + Vector3(0, col.y * 0.5, 0)))
	return n


const XD_SHADER := """shader_type spatial;
render_mode cull_disabled;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform float cut_y = 1000.0;
uniform bool swap_rg = false;
uniform float glow = 0.0;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	if (wp.y > cut_y) discard;
	vec3 a = texture(albedo_tex, UV).rgb;
	if (swap_rg) a = a.grb;
	ALBEDO = a * 0.9;
	float sat = max(a.r, max(a.g, a.b)) - min(a.r, min(a.g, a.b));
	EMISSION = a * glow * smoothstep(0.16, 0.42, sat);
	ROUGHNESS = 0.7;
	METALLIC = 0.25;
}"""
static var _xd_sh: Shader


func _xd_fx(n: Node3D, fx: String, cut_y: float) -> void:
	if _xd_sh == null:
		_xd_sh = Shader.new()
		_xd_sh.code = XD_SHADER
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var src := m.mesh.surface_get_material(si) as BaseMaterial3D
			var sm := ShaderMaterial.new()
			sm.shader = _xd_sh
			if src != null:
				sm.set_shader_parameter("albedo_tex", src.albedo_texture)
			sm.set_shader_parameter("cut_y", cut_y if fx.contains("cut") else 1000.0)
			sm.set_shader_parameter("swap_rg", fx.contains("swap"))
			sm.set_shader_parameter("glow", 1.3 if fx.contains("glow") else 0.0)
			m.set_surface_override_material(si, sm)


## обстановка построек, которую ставит не генератор (терминалы, компьютеры, мебель по таблице)
func _x_inside(b: ULBlock) -> void:
	if b.id == "main":
		_x_main(b)


## всё вокруг построек: лес, земля, стена с вышками, лифт, техника, штабеля, свет, точки двора
func _x_outdoor(rng: RandomNumberGenerator, props: Node3D) -> void:
	_c_forest(rng)
	_x_ground()
	_x_walls(props)
	_x_lift(props)
	_x_things()
	_x_piles(rng)
	_x_lamps()
	_flush(props)
	_c_forest_props(8123, 8, 5)
	_c_vegetation()
	_x_spots(rng)
	_light_pool()


# ---------------- земля ----------------

func _x_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_for("externals", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(X_MASK) and w.test != "xbbake":
		mask = (load(X_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _x_bake_mask()
		if w.test == "xbbake":
			mask.save_png(ProjectSettings.globalize_path(X_MASK))
			print("[bake] карта земли базы Внешников: ", X_MASK)
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
		b.size = Vector3(1, 4, XH * 2.0 + 20.0) if s.x != 0.0 else Vector3(XH * 2.0 + 20.0, 4, 1)
		wc.shape = b
		wc.position = Vector3(s.x * (XH + 9.0), 2.0, s.z * (XH + 9.0))
		body.add_child(wc)
	# бетон: дорога к воротам и к главному входу, площадка у ворот, вертолётная площадка
	_pave_rect(Rect2(-4.5, 21.0, 9.0, 54.0), 0.02, "asphalt")
	_pave_rect(Rect2(-12.0, 28.0, 24.0, 9.0), 0.025, "pavers")
	_pave_disc(X_HELIPAD, 7.5, 0.03, "asphalt")


func _x_bake_mask() -> Image:
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
			var road := 1.0 - smoothstep(3.6, 5.6, road_dist(p) + (n3 - 0.5) * 1.2)
			var inside := 1.0 if in_base(p) else 0.0
			# двор базы: укатанный грунт и бетонная крошка; трава — редкими пятнами у стен
			var edge := XW - maxf(absf(p.x), absf(p.y))
			var weeds := smoothstep(0.58, 0.8, n1 * 0.45 + n2 * 0.55) * 0.5 + (1.0 - smoothstep(0.5, 3.5, edge)) * 0.35
			var packed := inside * clampf(1.0 - weeds, 0.3, 1.0)
			# полоса вытоптанной земли снаружи вдоль стены
			var apron := (1.0 - inside) * (1.0 - smoothstep(0.0, 4.0, -edge + (n3 - 0.5) * 2.0)) * 0.7
			var path := maxf(maxf(road, packed * 0.92), apron)
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path) * (1.0 - inside)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- периметр: стена, вышки, ворота ----------------

## Бетонная стена высотой 4,2 м с пилястрами через 9,5 м и плитой-козырьком поверху; на углах — вышки; ворота на юге:
## два пилона, балка над проездом, створки распахнуты внутрь, шлагбаум поднят.
func _x_walls(g: Node3D) -> void:
	var h := X_WALL_H
	var ln := XW * 2.0
	# север, запад, восток — сплошные
	_bx(g, "xb_wall", Vector3(ln, h, X_WALL_T), _at(Vector3(0, h * 0.5, -XW)), true)
	_bx(g, "xb_wall", Vector3(X_WALL_T, h, ln), _at(Vector3(-XW, h * 0.5, 0)), true)
	_bx(g, "xb_wall", Vector3(X_WALL_T, h, ln), _at(Vector3(XW, h * 0.5, 0)), true)
	# юг — две половины по сторонам ворот
	var side := XW - X_GATE - 0.8
	for sgn in [-1.0, 1.0]:
		_bx(g, "xb_wall", Vector3(side, h, X_WALL_T), _at(Vector3(sgn * (X_GATE + 0.8 + side * 0.5), h * 0.5, XW)), true)
	# козырёк и пилястры
	for sgn in [-1.0, 1.0]:
		_bx(g, "xb_wall", Vector3(X_WALL_T + 0.5, 0.22, ln), _at(Vector3(sgn * XW, h + 0.11, 0)))
		_bx(g, "xb_wall", Vector3(side, 0.22, X_WALL_T + 0.5), _at(Vector3(sgn * (X_GATE + 0.8 + side * 0.5), h + 0.11, XW)))
	_bx(g, "xb_wall", Vector3(ln, 0.22, X_WALL_T + 0.5), _at(Vector3(0, h + 0.11, -XW)))
	var s := -XW + 9.5
	while s < XW - 4.0:
		for sgn in [-1.0, 1.0]:
			_bx(g, "xb_wall", Vector3(X_WALL_T + 0.6, h + 0.3, 1.1), _at(Vector3(sgn * XW, (h + 0.3) * 0.5, s)))
			if absf(s) > X_GATE + 2.5 or sgn < 0.0:
				_bx(g, "xb_wall", Vector3(1.1, h + 0.3, X_WALL_T + 0.6), _at(Vector3(s, (h + 0.3) * 0.5, sgn * XW)))
		s += 9.5
	# вышки по углам: основание, площадка с ограждением, будка с тёмным остеклением, крыша, прожектор
	for cx in [-XW, XW]:
		for cz in [-XW, XW]:
			var c := Vector3(cx, 0, cz)
			if _xd("xd_tower", c, atan2(-cx, -cz) + PI * 0.25, Vector3(5.6, 10.5, 5.6), Vector3(4.8, 6.0, 4.8), 130.0) == null:
				_bx(g, "plinth", Vector3(5.2, 6.4, 5.2), _at(c + Vector3(0, 3.2, 0)), true)
				_bx(g, "plinth", Vector3(6.2, 0.3, 6.2), _at(c + Vector3(0, 6.55, 0)))
				_bx(g, "plinth", Vector3(4.6, 1.0, 4.6), _at(c + Vector3(0, 7.2, 0)))
				_bx(g, "glass", Vector3(4.7, 0.9, 4.7), _at(c + Vector3(0, 8.15, 0)))
				_bx(g, "plinth", Vector3(5.6, 0.3, 5.6), _at(c + Vector3(0, 8.75, 0)))
				_bx(g, "rust", Vector3(0.5, 0.5, 0.7), _at(c + Vector3(-signf(cx) * 2.3, 9.15, -signf(cz) * 2.3), atan2(-cx, -cz)))
			lamps_p.append(c + Vector3(-signf(cx) * 5.0, 0, -signf(cz) * 5.0))
	# ворота
	# ворота: модель (пролёт по оси Z модели — поворот на четверть); столкновение — только пилоны
	if _xd("xd_gate", Vector3(0, 0, XW), PI * 0.5, Vector3(4.2, 8.2, X_GATE * 2.0 + 7.0), Vector3.ZERO, 130.0) != null:
		for sgn in [-1.0, 1.0]:
			_col_xf(Vector3(3.4, 5.6, 3.0), _at(Vector3(sgn * (X_GATE + 1.7), 2.8, XW)))
	else:
		for sgn in [-1.0, 1.0]:
			_bx(g, "plinth", Vector3(1.6, 5.6, 1.8), _at(Vector3(sgn * (X_GATE + 0.8), 2.8, XW)), true)
			_bx(g, "rust", Vector3(4.6, 3.2, 0.14), Transform3D(Basis(Vector3.UP, sgn * 1.35), Vector3(sgn * (X_GATE - 0.4), 1.7, XW - 2.6)), true)
		_bx(g, "plinth", Vector3(X_GATE * 2.0 + 3.2, 0.9, 1.4), _at(Vector3(0, 5.6, XW)))
	_barrier(Vector3(-X_GATE + 0.6, 0, XW + 2.4), -0.25)
	for sgn in [-1.0, 1.0]:
		if ResourceLoader.exists(MODELS + "qr_concblocks.glb"):
			_pm("qr_concblocks", Vector3(sgn * 7.0, 0, XW + 7.0), sgn * 0.3, 2.4, true)


# ---------------- лифт и капсула ----------------

## Лифт посреди лифтового зала: восьмиугольное основание, четыре стойки с балками, кабина-платформа с низкими
## бортами (герой в ней виден сверху) и створками с юга. Створки закрыты, пока комплекс не открыт красной
## жемчужиной; открыт — створки разведены, в кабину можно войти. Рядом (только на поверхности) — капсула для
## жемчужины: тумба со стеклянным колпаком; пока комплекс открыт, в колпаке светится жемчужина.
func _x_lift(g: Node3D) -> void:
	var c := X_LIFT
	_cy(g, "xb_plate", 4.6, 4.8, 0.12, _at(c + Vector3(0, 0.26, 0)), 8)
	# кабина — модель грузового лифта (открытая сторона модели смотрит по +X — поворот к югу), срезана на высоте
	# груди: герой внутри виден сверху. Столкновения — борта с трёх сторон и стойки у входа.
	var cab := _xd("xd_lift", c + Vector3(0, 0.2, 0), -PI * 0.5, Vector3(4.6, 3.4, 4.9), Vector3.ZERO, 60.0, "cut", 1.55 + c.y)
	_col_xf(Vector3(4.6, 3.0, 0.25), _at(c + Vector3(0, 1.7, -2.2)))
	for sgn in [-1.0, 1.0]:
		_col_xf(Vector3(0.25, 3.0, 4.4), _at(c + Vector3(sgn * 2.3, 1.7, 0)))
		_col_xf(Vector3(0.8, 3.0, 0.25), _at(c + Vector3(sgn * 1.9, 1.7, 2.2)))
	if cab == null:
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				_bx(g, "gmetal", Vector3(0.5, 3.2, 0.5), _at(c + Vector3(sx * 2.3, 1.8, sz * 2.3)))
		_bx(g, "x_steel", Vector3(4.2, 0.06, 4.2), _at(c + Vector3(0, 0.35, 0)))
		_bx(g, "x_steel", Vector3(4.2, 1.15, 0.2), _at(c + Vector3(0, 0.9, -2.2)))
		for sgn in [-1.0, 1.0]:
			_bx(g, "x_steel", Vector3(0.2, 1.15, 4.2), _at(c + Vector3(sgn * 2.2, 0.9, 0)))
			_bx(g, "x_steel", Vector3(0.75, 1.15, 0.2), _at(c + Vector3(sgn * 1.83, 0.9, 2.2)))
		_bx(g, "x_yellow", Vector3(2.9, 0.03, 0.3), _at(c + Vector3(0, 0.37, 2.25)))
	# пульт в кабине
	_bx(g, "x_black", Vector3(0.5, 1.1, 0.25), _at(c + Vector3(1.75, 0.9, -1.85)))
	_bx(g, "x_blue", Vector3(0.36, 0.26, 0.03), _at(c + Vector3(1.75, 1.25, -1.71)))
	# створки (отдельно от остального: открываются)
	_door_body = StaticBody3D.new()
	_door_body.name = "LiftDoors"
	var dcs := CollisionShape3D.new()
	var dbs := BoxShape3D.new()
	dbs.size = Vector3(3.0, 3.0, 0.25)
	dcs.shape = dbs
	dcs.position = c + Vector3(0, 1.7, 2.2)
	_door_body.add_child(dcs)
	if not String(w.test).ends_with("bake"):
		add_child(_door_body)                       # при запекании карты проходимости створок нет: в кабину есть путь
	for sgn in [-1.0, 1.0]:
		var mi := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(1.46, 2.3, 0.1)
		mi.mesh = bm
		mi.material_override = _mat("x_steel")
		mi.position = c + Vector3(sgn * 0.74, 1.5, 2.2)
		add_child(mi)
		if sgn < 0.0:
			_door_l = mi
		else:
			_door_r = mi
	if level == 0:
		var k := X_CAPSULE
		if _xd("xd_pearl", k + Vector3(0, 0.2, 0), 0.0, Vector3(0.8, 1.5, 0.8)) == null:
			_cy(g, "metal", 0.34, 0.42, 1.0, _at(k + Vector3(0, 0.7, 0)), 10)
			_cy(g, "x_glass", 0.24, 0.24, 0.42, _at(k + Vector3(0, 1.41, 0)), 10)
		_cyl_col(k, 0.45, 1.6)
		_caps_glow = MeshInstance3D.new()
		var sp := SphereMesh.new()
		sp.radius = 0.09
		sp.height = 0.18
		_caps_glow.mesh = sp
		_caps_glow.material_override = _mat("x_red")
		_caps_glow.position = k + Vector3(0, 1.58, 0)
		_caps_glow.visible = false
		add_child(_caps_glow)


## створки лифта: открыты — разведены в стороны и не мешают пройти; закрыты — стена
func set_lift_open(on: bool) -> void:
	lift_open = on
	if _door_body == null:
		return
	(_door_body.get_child(0) as CollisionShape3D).set_deferred("disabled", on)
	_door_body.collision_layer = 0 if on else 1
	_door_l.position.x = X_LIFT.x - (1.83 if on else 0.74)
	_door_r.position.x = X_LIFT.x + (1.83 if on else 0.74)
	_door_l.scale = Vector3(0.5, 1.0, 1.6) if on else Vector3.ONE
	_door_r.scale = Vector3(0.5, 1.0, 1.6) if on else Vector3.ONE
	if _caps_glow != null:
		_caps_glow.visible = on and level == 0 and ULBase.ext_left() > 0


# ---------------- главное здание: терминалы, компьютеры ----------------

## Три терминала и у каждого — свой компьютер на столе (модели gr_terminal и ul_computer): обстановка залов,
## скрывается вместе с интерьером. Столкновения — коробки.
func _x_main(b: ULBlock) -> void:
	for t in X_TERMS:
		var bi := int(t[1])
		var tp: Vector3 = t[2]
		var pp: Vector3 = t[4]
		if ResourceLoader.exists(MODELS + "xd_terminal.glb"):
			b.models.append(["xd_terminal", Vector3(tp.x, 0.2, tp.z), float(t[3]), Vector3(1.0, 2.2, 1.0), "b%d/n0" % bi, 0.0])
		elif ResourceLoader.exists(MODELS + "gr_terminal.glb"):
			b.models.append(["gr_terminal", Vector3(tp.x, 0.2, tp.z), float(t[3]), Vector3(1.3, 2.0, 1.0), "b%d/n0" % bi, 0.0])
		_col_xf(Vector3(1.2, 2.0, 1.0), Transform3D(Basis(Vector3.UP, float(t[3])), Vector3(tp.x, 1.2, tp.z)))
		if ResourceLoader.exists(MODELS + "ul_computer.glb"):
			b.models.append(["ul_computer", Vector3(pp.x, 0.2, pp.z), float(t[5]), Vector3(1.8, 1.4, 0.9), "b%d/n0" % bi, 0.0])
		_col_xf(Vector3(1.7, 1.2, 0.9), Transform3D(Basis(Vector3.UP, float(t[5])), Vector3(pp.x, 0.8, pp.z)))
	_x_furn(b, X_FURN)


## обстановка-модели по таблице: [модель, блок, где, поворот, размер] — на полу блока, со столкновением-коробкой
func _x_furn(b: ULBlock, table: Array) -> void:
	for it in table:
		if not ResourceLoader.exists(MODELS + String(it[0]) + ".glb"):
			continue
		var sz: Vector3 = it[4]
		var p: Vector3 = it[2]
		b.models.append([String(it[0]), Vector3(p.x, 0.2, p.z), float(it[3]), sz, "b%d/n0" % int(it[1]), 0.0])
		_col_xf(Vector3(sz.x * 0.9, sz.y, sz.z * 0.9), Transform3D(Basis(Vector3.UP, float(it[3])), Vector3(p.x, 0.2 + sz.y * 0.5, p.z)))


# ---------------- двор ----------------

func _x_things() -> void:
	for t in X_THINGS:
		var at: Vector3 = t[1]
		var tall := String(t[0]) == "pt_tank_v" or String(t[0]) == "qr_satdish"
		var size := _pm(String(t[0]), at, float(t[2]), float(t[3]), not tall, false, Color(0.82, 0.8, 0.76), tall)
		if tall:
			_cyl_col(at, 1.4, 4.0)
		if String(t[4]) != "":
			_p_stash(at, size, float(t[2]), String(t[4]), String(t[5]))


func _x_piles(rng: RandomNumberGenerator) -> void:
	var models := {"crate": [["ul_army_crate", 1.2], ["ul_crate", 1.1], ["ph_crate", 1.0]], "pallet": [["qr_pallets", 1.3]], "barrel": [["ph_barrel", 0.75], ["gr_barrels", 1.6]]}
	var names := {"crate": "Армейский ящик", "pallet": "Паллета с грузом", "barrel": "Бочки"}
	for pl in X_PILES:
		var c := Vector3(float(pl[0]), 0, float(pl[1]))
		var kinds: Array = models[String(pl[3])]
		for i in int(pl[2]):
			var m: Array = kinds[rng.randi() % kinds.size()]
			var p := c + Vector3((i % 2) * 1.5 - 0.7 + rng.randf_range(-0.15, 0.15), 0, (i / 2) * 1.5 + rng.randf_range(-0.15, 0.15))
			if not in_base(Vector2(p.x, p.z)) or bld_dist(Vector2(p.x, p.z)) < 0.6:
				continue
			var sz := _pm(String(m[0]), p, rng.randf() * TAU, float(m[1]), true)
			if i == 0 and bool(pl[4]):
				_p_stash(p, sz, 0.0, String(pl[3]), String(names[String(pl[3])]))


## прожекторы на мачтах во дворе и у ворот (свет — пятнами, как в остальных локациях)
func _x_lamps() -> void:
	for p in [Vector3(-12, 0, 24), Vector3(12, 0, 24), Vector3(-34, 0, -34), Vector3(34, 0, 34), Vector3(-34, 0, 34), Vector3(34, 0, -34),
			Vector3(0, 0, -30.5), Vector3(-34, 0, -4), Vector3(34, 0, 10), Vector3(-9, 0, 44), Vector3(9, 0, 44)]:
		if ResourceLoader.exists(MODELS + "qr_floodlight.glb"):
			_pm("qr_floodlight", p, 0.0, 9.0, false, false, Color(0.86, 0.84, 0.8), true)
			_cyl_col(p, 0.25, 3.0)
		lamps_p.append(p)
	if ResourceLoader.exists(MODELS + "qr_radiotower.glb"):
		_pm("qr_radiotower", Vector3(-22, 0, 33.5), 0.0, 12.0, false, false, Color(0.86, 0.84, 0.8), true)
		_cyl_col(Vector3(-22, 0, 33.5), 1.2, 3.0)


# ---------------- точки двора (для будущих врагов и добычи) ----------------

func _x_spots(rng: RandomNumberGenerator) -> void:
	for k in 700:
		var q := Vector2(rng.randf_range(-XW + 3.0, XW - 3.0), rng.randf_range(-XW + 3.0, XW - 3.0))
		if bld_dist(q) < 1.2:
			continue
		var tag := "yard"
		if q.y > 26.0:
			tag = "gate"
		elif q.distance_to(X_HELIPAD) < 9.0:
			tag = "helipad"
		elif q.x > 20.0 and q.y < -20.0:
			tag = "tech_yard"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)


# ---------------- солдаты Внешников ----------------

## где на поверхности стоят снайперы (у стен и на площадке — с длинным обзором двора и ворот) и Титаны (ворота
## главного здания, коридор, лифтовой зал, двор)
const X_SNIPER_POS := [Vector3(-33, 0, -33), Vector3(33, 0, -33), Vector3(-33, 0, 29), Vector3(33, 0, 29), Vector3(4, 0, -34.5), Vector3(-33, 0, -20)]
const X_TITAN_POS := [Vector3(0, 0, 25.5), Vector3(0, 0.2, 12.5), Vector3(0, 0.2, 6.0), Vector3(-30, 0, -20), Vector3(30, 0, -14), Vector3(-17, 0.2, 4.0)]
const X_ROOM_POS := [Vector3(17, 0.2, 4.0), Vector3(-19, 0.2, 5.0), Vector3(0, 0.2, -11.5), Vector3(-12, 0.2, 13.0), Vector3(12, 0.2, 13.5), Vector3(-13, 0.2, -14.0), Vector3(13, 0.2, -14.0)]


## План появления на поверхности: число каждого вида — data/externals.json → soldiers.surface. Снайперы и Титаны — на
## своих местах, штурмовики — часть в помещениях главного здания, остальные по двору. Запись — [вид, где, зона].
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var cnt: Dictionary = (conf().get("soldiers", {}) as Dictionary).get("surface", {})
	var out: Array = []
	var taken: Array[Vector3] = []
	for i in mini(int(cnt.get("ext_sniper", 0)), X_SNIPER_POS.size()):
		var p: Vector3 = X_SNIPER_POS[i]
		out.append(["ext_sniper", Vector3(p.x, p.y + 0.02, p.z), "post"])
		taken.append(p)
	for i in mini(int(cnt.get("ext_titan", 0)), X_TITAN_POS.size()):
		var p: Vector3 = X_TITAN_POS[i]
		out.append(["ext_titan", Vector3(p.x, p.y + 0.02, p.z), "post" if p.y < 0.1 else "main"])
		taken.append(p)
	var na := int(cnt.get("ext_assault", 0))
	var in_rooms := mini(na / 3, X_ROOM_POS.size())
	for i in in_rooms:
		var p: Vector3 = X_ROOM_POS[i]
		out.append(["ext_assault", Vector3(p.x, p.y + 0.02, p.z), "main"])
		taken.append(p)
	for i in na - in_rooms:
		for attempt in 60:
			if yard_pts.is_empty():
				break
			var p: Vector3 = yard_pts[rng.randi() % yard_pts.size()]
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.45:
				continue
			var crowd := false
			for t in taken:
				if t.distance_to(q) < 2.5:
					crowd = true
					break
			if crowd or not body_fits(Vector3(q.x, 0.0, q.z), 0.3, 1.5):
				continue
			taken.append(q)
			out.append(["ext_assault", Vector3(q.x, 0.02, q.z), "yard"])
			break
	return out
