class_name ULAirport
extends ULDepot
## «Заброшенный аэропорт» — временный нестабильный кластер 420 × 300 м (опасность 3), перенесённый Ульем вместе с
## пассажирским терминалом, диспетчерской вышкой, ремонтными ангарами, грузовым комплексом, топливной зоной,
## самолётами и техникой. Планировка — по утверждённой схеме сверху: вход — на юге у КПП, за ним стоянка машин;
## дальше на север — взлётная полоса (с запада на восток), рулёжная дорожка, перрон со стоянками самолётов,
## терминал (высокий зал и два двухэтажных крыла), за ним вышка и служебные здания; на востоке — два ангара,
## грузовой склад и площадка; на северо-востоке — топливная зона; на западе — багажный склад и гараж техники.
## Поясняющих надписей из схемы и видео в мире нет (разметка полосы — настоящая разметка аэродрома).
## Здания проходимые (ULBlock: двери, лестницы, этажи, скрытие крыши, обстановка, тайники). В два самолёта можно
## войти по трапу: салон с креслами, кухня, кабина пилотов; пока герой внутри, верх фюзеляжа срезается.
## Общие системы — от ULSanatorium / ULConvoy / ULPort / ULDepot. Баланс и добыча — data/airport.json.
## Север — в сторону −Z, вход — на юге (+Z).

const A_CFG := "res://data/airport.json"
const A_NAV := "res://assets/world/nav_airport.res"
const A_MASK := "res://assets/world/tex/airport_mask.png"
const A_CACHE := "res://assets/world/airport_blocks.res"
const A_TITLE := "Заброшенный аэропорт"
const A_ENTRY := Vector3(0.0, 0, 137.0)
const AX := 210.0
const AZ := 150.0
const A_FX := 200.0                     ## ограда: |x| = A_FX, z от A_FN до A_FS
const A_FN := -140.0
const A_FS := 129.0
const A_GATE_X := 0.0

## покрытия: взлётная полоса, рулёжная дорожка и её съезды на полосу, перрон, стоянки машин, грузовая площадка
const RWY := Rect2(-178, 40, 356, 32)
const TWY := Rect2(-172, 8, 274, 16)
const LINKS := [Rect2(-159, 23, 16, 18), Rect2(-69, 23, 16, 18), Rect2(21, 23, 16, 18), Rect2(84, 23, 16, 18)]
const APRON := Rect2(-142, -53, 244, 62)
const PARKS := [Rect2(-78, 92, 66, 32), Rect2(12, 92, 66, 32), Rect2(-6, -126, 34, 28)]
const CARGO_YARD := Rect2(104, -42, 92, 78)
const A_FUEL := Rect2(128, -136, 68, 44)
## дороги (асфальт): въезд, подъезд к терминалу с севера, вдоль западной ограды, к ангарам и топливу
const A_ROADS := [
	[Vector2(0, 150), Vector2(0, 72)],
	[Vector2(-190, -128), Vector2(120, -128)],
	[Vector2(-190, -128), Vector2(-190, 30)],
	[Vector2(-190, 30), Vector2(-172, 30)],
	[Vector2(0, -128), Vector2(0, -88)],
	[Vector2(120, -128), Vector2(120, -92), Vector2(128, -86)],
	[Vector2(-142, -40), Vector2(-190, -40)],
	[Vector2(-100, 108), Vector2(-196, 108)],
	[Vector2(100, 108), Vector2(196, 108)],
]

const A_BUILDINGS := [
	# терминал: высокий зал — вестибюль, регистрация, досмотр, зал ожидания; вдоль южной стены — охрана, медпункт,
	# санузлы, магазины, кафетерий, камера хранения. Крылья — отдельные корпуса в два этажа (двери из зала).
	{"id": "term", "n": "Пассажирский терминал", "kind": "office", "skin": "facade", "roof": "gable", "roof_mat": "q_rust", "gable": "facade", "rise": 0.2, "ov": 0.5,
		"chimney": false, "int": "int_beige", "storey": 6.0,
		"blocks": [{"c": Vector2(0, -70), "L": 60.0, "W": 34.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 7.0,
			"row": [["guard", 7.0], ["proc", 8.0], ["wc", 5.5], ["shop", 8.0], ["shop", 8.0], ["dining", 10.5], ["wc", 5.5], ["store", 7.1]], "hall_type": "lobby",
			"entr": [["s-", 0.0, 3.6, "plain"], ["s-", -19.0, 1.8, "plain"], ["s-", 19.0, 1.8, "plain"], ["e-", 4.0, 2.2, "plain"], ["e+", 4.0, 2.2, "plain"]],
			"win_w": 2.4, "win_h": 2.4, "sill": 1.0}]},
	{"id": "term_w", "n": "Терминал: багажное крыло", "kind": "office", "skin": "facade", "int": "int_beige", "storey": 3.6, "hall0": "lounge",
		"types": {"0": [["store", 2], ["tech", 1], ["staff", 1], ["guard", 1]], "1": [["office", 3], ["staff", 1], ["archive", 1], ["tech", 1]]},
		"blocks": [{"c": Vector2(-51, -66), "L": 42.0, "W": 16.0, "axis": "x", "floors": 2, "stairs": [-1, 1], "hall": [1.0, 13.0],
			"entr": [["e+", 0.0, 2.0], ["s+", 1.0, 2.4], ["e-", 0.0, 1.6]], "wide": 0.5}]},
	{"id": "term_e", "n": "Терминал: посадочное крыло", "kind": "office", "skin": "facade", "int": "int_beige", "storey": 3.6, "hall0": "lounge",
		"types": {"0": [["shop", 2], ["wc", 1], ["nurse", 1], ["staff", 1]], "1": [["office", 3], ["staff", 1], ["m_office", 1], ["archive", 1]]},
		"blocks": [{"c": Vector2(51, -66), "L": 42.0, "W": 16.0, "axis": "x", "floors": 2, "stairs": [-1, 1], "hall": [-1.0, 13.0],
			"entr": [["e-", 0.0, 2.0], ["s+", -1.0, 2.4], ["e+", 0.0, 1.6]], "wide": 0.5}]},
	# диспетчерская вышка: четыре уровня, лестница маршами вдоль стен, наверху — кабина диспетчеров
	{"id": "tower", "n": "Диспетчерская вышка", "kind": "tech", "style": "box", "skin": "plaster", "int": "int_grey1", "storey": 3.4, "te": 0.24,
		"blocks": [{"c": Vector2(-24, -103), "L": 14.0, "W": 8.4, "axis": "x", "floors": 4, "layout": "hall", "stairs": [-1], "row": [],
			"hall_type": "tower", "entr": [["s+", 4.2, 1.2, "plain"]], "win_w": 1.9, "win_h": 1.4, "sill": 1.0}]},
	# ремонтные ангары: ворота на перрон
	{"id": "hangar1", "n": "Ремонтный ангар № 1", "kind": "workshop", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 8.0, "te": 0.2, "gates_open": true,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.26, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(122, -66), "L": 40.0, "W": 36.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.0,
			"row": [["tech", 10.0], ["store", 10.0], ["staff", 9.0], ["store", 10.6]], "hall_type": "ahangar",
			"entr": [["s+", 0.0, 22.0, "plain", 6.4], ["e-", 6.0, 1.4, "plain"]], "win_w": 1.8, "win_h": 1.2, "sill": 3.6}]},
	{"id": "hangar2", "n": "Ремонтный ангар № 2", "kind": "workshop", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 8.0, "te": 0.2, "gates_open": true,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.26, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(168, -66), "L": 40.0, "W": 36.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.0,
			"row": [["store", 10.0], ["tech", 10.0], ["store", 10.0], ["staff", 9.6]], "hall_type": "ahangar",
			"entr": [["s+", 0.0, 22.0, "plain", 6.4], ["e-", -6.0, 1.4, "plain"]], "win_w": 1.8, "win_h": 1.2, "sill": 3.6}]},
	# грузовой комплекс
	{"id": "cargo", "n": "Грузовой склад", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 5.2, "te": 0.18, "gates_open": true,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.34, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(152, 4), "L": 50.0, "W": 24.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 5.0,
			"row": [["store", 12.0], ["staff", 10.0], ["tech", 10.0], ["store", 17.6]], "hall_type": "warehouse",
			"entr": [["s-", -12.0, 4.4, "plain"], ["s-", 12.0, 4.4, "plain"], ["e-", -3.0, 1.4, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.8}]},
	{"id": "sort", "n": "Сортировочный пункт", "kind": "warehouse", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 3.6, "te": 0.14,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.4, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(118, -30), "L": 16.0, "W": 9.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "warehouse",
			"entr": [["s+", 0.0, 3.0, "plain"]], "blind": ["s-"], "win_w": 1.0, "win_h": 0.7, "sill": 2.0}]},
	# запад: багажный склад и гараж аэродромной техники
	{"id": "wstore", "n": "Багажный склад", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.6, "te": 0.18, "gates_open": true,
		"roof_mat": "q_tin", "gable": "planks", "rise": 0.36, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-170, -84), "L": 38.0, "W": 18.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.0,
			"row": [["store", 12.0], ["store", 12.0], ["staff", 13.6]], "hall_type": "warehouse",
			"entr": [["s+", -8.0, 4.0, "plain"], ["s+", 10.0, 1.4, "plain"], ["e+", 2.0, 4.0, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.6}]},
	{"id": "gse", "n": "Гараж аэродромной техники", "kind": "workshop", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 4.4, "te": 0.16, "gates_open": true,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.36, "ov": 0.4, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-172, -22), "L": 34.0, "W": 16.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.6,
			"row": [["tech", 11.0], ["store", 11.0], ["staff", 11.6]], "hall_type": "workshop",
			"entr": [["s+", -8.0, 4.4, "plain"], ["s+", 8.0, 4.4, "plain"], ["e+", 2.0, 1.4, "plain"]], "win_w": 1.4, "win_h": 0.8, "sill": 2.6}]},
	# север: администрация аэропорта (два этажа), служба полётов, техническая служба
	{"id": "office", "n": "Администрация аэропорта", "kind": "office", "skin": "plaster", "int": "int_beige1", "storey": 3.3, "hall0": "lounge",
		"types": {"0": [["office", 3], ["archive", 1], ["staff", 1], ["wc", 1]], "1": [["office", 3], ["m_office", 1], ["staff", 1], ["archive", 1]]},
		"blocks": [{"c": Vector2(-104, -106), "L": 34.0, "W": 13.0, "axis": "x", "floors": 2, "stairs": [1], "hall": [-3.0, 6.5],
			"entr": [["s+", -3.0, 2.0], ["e+", 0.0, 1.4]], "wide": 0.45}]},
	{"id": "ops", "n": "Служба полётов", "kind": "office", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.3, "ov": 0.4, "chimney": false,
		"int": "int_beige1", "storey": 3.2,
		"blocks": [{"c": Vector2(52, -108), "L": 22.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.4,
			"row": [["office", 7.0], ["m_radio", 7.0], ["archive", 7.6]], "hall_type": "m_hall",
			"entr": [["s+", 3.0, 1.4, "porch"]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	{"id": "tech", "n": "Техническая служба", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 3.2, "te": 0.14,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(86, -112), "L": 14.0, "W": 9.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "workshop",
			"entr": [["s+", 0.0, 2.4, "plain"]], "blind": ["s-"], "win_w": 0.9, "win_h": 0.7, "sill": 1.5}]},
	{"id": "fpump", "n": "Топливная насосная", "kind": "tech", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 2.8, "te": 0.08, "roof_mat": "q_rust",
		"blocks": [{"c": Vector2(138, -98), "L": 9.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s+", 0.0, 1.4, "plain"]], "blind": ["s-", "e+", "e-"]}]},
	# юг: КПП у ворот и служебные постройки вдоль ограды
	{"id": "kpp", "n": "Контрольно-пропускной пункт", "kind": "office", "style": "box", "skin": "plaster", "int": "int_grey1", "storey": 2.7, "te": 0.2,
		"blocks": [{"c": Vector2(10.5, 121.5), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "guard",
			"entr": [["e-", 0.0, 1.0, "plain"]], "win_w": 1.1, "win_h": 0.9, "sill": 1.0}]},
	{"id": "svc1", "n": "Служба перевозок", "kind": "office", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.3, "ov": 0.4, "chimney": false,
		"int": "int_beige1", "storey": 3.2,
		"blocks": [{"c": Vector2(-112, 118), "L": 20.0, "W": 11.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": 1, "row_d": 5.0,
			"row": [["office", 7.0], ["archive", 6.0], ["staff", 6.6]], "hall_type": "m_hall",
			"entr": [["s-", -3.0, 1.4, "porch"]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	{"id": "svc2", "n": "Автобусная станция", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.4, "te": 0.14,
		"roof_mat": "q_tin", "gable": "planks", "rise": 0.4, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-158, 118), "L": 18.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["s-", 0.0, 4.0, "plain"]], "blind": ["s+"], "win_w": 0.9, "win_h": 0.7, "sill": 1.8}]},
	{"id": "svc3", "n": "Аварийная служба", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 3.4, "te": 0.14, "gates_open": true,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.4, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(112, 118), "L": 20.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["s-", -4.0, 4.2, "plain"], ["e+", 0.0, 1.3, "plain"]], "blind": ["s+"], "win_w": 0.9, "win_h": 0.7, "sill": 1.8}]},
	{"id": "svc4", "n": "Склад аэродромной службы", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.6, "te": 0.14,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.4, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(160, 118), "L": 18.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "warehouse",
			"entr": [["s-", 0.0, 3.0, "plain"]], "blind": ["s+"], "win_w": 0.9, "win_h": 0.7, "sill": 1.8}]},
]

## Самолёты. c — середина, yaw — куда смотрит нос (0 — на +x), len — длина; walk — можно войти.
## Посадка в корпусе задаётся в долях длины (подбирается по модели): cab — салон от хвоста к носу [t0, t1],
## fy — высота пола салона над землёй, hw — полуширина салона, door — где дверь по длине, side — с какого борта трап
## (+1 — правый по ходу, −1 — левый). flip — у модели нос в другую сторону.
const A_PLANES := [
	{"id": "ap_airliner", "c": Vector2(-2, -29), "yaw": 1.5708, "len": 30.0, "walk": true, "side": -1.0, "n": "Самолёт у выхода № 2", "flight": true},
	{"id": "ap_airliner", "c": Vector2(-104, -24), "yaw": 0.9, "len": 30.0, "walk": true, "side": 1.0, "n": "Самолёт на западной стоянке", "tint": Color(0.8, 0.78, 0.74)},
	{"id": "ap_airliner", "c": Vector2(62, -28), "yaw": 1.5708, "len": 30.0, "walk": false, "n": "Повреждённый самолёт", "tint": Color(0.7, 0.66, 0.62)},
	{"id": "ap_regional", "c": Vector2(-62, -4), "yaw": 0.5, "len": 20.0, "walk": false, "n": "Турбовинтовой самолёт"},
	# самолёт на обслуживании — в ангаре № 1 (виден, когда крыша ангара скрыта)
	{"id": "ap_regional", "c": Vector2(122, -63), "yaw": 3.1416, "len": 20.0, "walk": false, "n": "Самолёт на обслуживании", "indoor": true},
]
const A_CABIN := {"t0": 0.27, "t1": 0.88, "fy": 0.125, "hw": 0.0583, "door": 0.76}

## топливная зона (северо-восток): три стоячих резервуара и две лежачие цистерны, насосная, заправщики
const A_TANKS_V := [Vector3(160, 0, -122), Vector3(176, 0, -122), Vector3(186, 0, -106)]
const A_TANKS_H := [Vector3(146, 0, -118), Vector3(168, 0, -103)]

## техника и оборудование: [модель, где, поворот, длина, вид тайника, название]
const A_THINGS := [
	# стоянка перед КПП и терминалом: автобусы, машины, микроавтобусы
	["ul_bus", Vector3(-66, 0, 100), 1.57, 9.0, "cab", "Салон автобуса"], ["ul_bus", Vector3(-52, 0, 101), 1.52, 9.0, "cab", "Салон автобуса"],
	["ul_car", Vector3(-38, 0, 99), 1.6, 4.2, "cab", "Брошенная машина"], ["ul_car", Vector3(-30, 0, 99.5), 1.5, 4.2, "", ""], ["ul_uaz", Vector3(-22, 0, 99), 1.62, 4.1, "cab", "Служебный УАЗ"],
	["ul_car", Vector3(-58, 0, 117), -1.5, 4.2, "", ""], ["ul_car", Vector3(-44, 0, 117.5), -1.7, 4.2, "cab", "Брошенная машина"], ["ul_gaz66", Vector3(-26, 0, 117), -1.57, 5.6, "truck", "Кузов грузовика"],
	["ul_car", Vector3(22, 0, 99), 1.55, 4.2, "cab", "Брошенная машина"], ["ul_car", Vector3(38, 0, 99.5), 1.7, 4.2, "", ""], ["ul_bus", Vector3(58, 0, 101), 1.6, 9.0, "cab", "Салон автобуса"],
	["ul_car", Vector3(30, 0, 117), -1.4, 4.2, "", ""], ["ul_uaz", Vector3(46, 0, 117), -1.6, 4.1, "", ""], ["ul_car", Vector3(66, 0, 116.5), -1.57, 4.2, "cab", "Брошенная машина"],
	["ul_car", Vector3(3, 0, 108), 0.3, 4.2, "", ""],
	# служебная стоянка за терминалом
	["ul_car", Vector3(2, 0, -118), 1.57, 4.2, "cab", "Брошенная машина"], ["ul_car", Vector3(10, 0, -118), 1.6, 4.2, "", ""], ["ul_uaz", Vector3(20, 0, -104), -1.5, 4.1, "cab", "Служебный УАЗ"],
	# перрон: тягачи, багажные тележки, трапы, автобус, заправщик, генератор
	["ap_tug", Vector3(-18, 0, -8), 0.2, 5.2, "machine", "Кабина тягача"], ["ap_tug", Vector3(74, 0, -44), 2.2, 5.2, "", ""],
	["ap_bagcart", Vector3(-26, 0, -12), 0.2, 3.4, "luggage", "Багажная тележка"], ["ap_bagcart", Vector3(-30, 0, -13), 0.25, 3.4, "luggage", "Багажная тележка"],
	["ap_bagcart", Vector3(30, 0, -47), 1.4, 3.4, "luggage", "Багажная тележка"], ["ap_bagcart", Vector3(-70, 0, -46), 0.1, 3.4, "luggage", "Багажная тележка"],
	["ap_airstairs", Vector3(78, 0, -22), 1.57, 7.0, "", ""], ["ap_airstairs", Vector3(-124, 0, -44), 0.3, 7.0, "", ""],
	["ul_bus", Vector3(24, 0, -4), 0.1, 9.0, "cab", "Перронный автобус"], ["qr_tanker", Vector3(-44, 0, -42), 2.9, 8.5, "fuel", "Топливозаправщик"],
	["hm_generator", Vector3(12, 0, -10), 0.0, 1.6, "tech", "Аэродромный генератор"], ["ap_luggage", Vector3(-86, 0, -48), 0.5, 2.4, "luggage", "Брошенный багаж"],
	["ap_luggage", Vector3(8, 0, -49), 2.0, 2.4, "luggage", "Брошенный багаж"], ["ul_mi8", Vector3(-126, 0, 16), 0.4, 18.0, "heli", "Вертолёт Ми-8"],
	["ap_platform", Vector3(52, 0, -18), 0.0, 3.4, "", ""], ["ap_engine", Vector3(70, 0, -14), 0.6, 3.2, "parts", "Снятый двигатель"],
	# грузовая площадка
	["pt_forklift", Vector3(112, 0, 10), 0.8, 3.4, "machine", "Кабина погрузчика"], ["pt_forklift", Vector3(184, 0, -30), 2.0, 3.4, "", ""],
	["ul_truck", Vector3(120, 0, 26), 1.57, 7.0, "truck", "Кузов грузовика"], ["ul_ural", Vector3(186, 0, 24), -0.3, 7.4, "truck", "Кузов грузовика"],
	["ul_trailer", Vector3(108, 0, -14), 0.2, 6.0, "trailer", "Прицеп с грузом"], ["ap_tug", Vector3(176, 0, -18), 0.9, 5.2, "machine", "Кабина тягача"],
	["ap_uld", Vector3(132, 0, -24), 0.0, 2.0, "uld", "Авиаконтейнер"], ["ap_uld", Vector3(135, 0, -24), 0.0, 2.0, "", ""], ["ap_uld", Vector3(138, 0, -24.2), 0.1, 2.0, "uld", "Авиаконтейнер"],
	["ap_uld", Vector3(150, 0, -30), 1.57, 2.0, "uld", "Авиаконтейнер"], ["ap_uld", Vector3(150, 0, -33), 1.57, 2.0, "", ""], ["ap_uld", Vector3(190, 0, -6), 0.3, 2.0, "uld", "Авиаконтейнер"],
	["ap_wing", Vector3(160, 0, -36), 0.2, 9.0, "parts", "Авиационные детали"], ["qr_transformer", Vector3(196, 0, -38), 0.0, 2.6, "tech", "Трансформаторный шкаф"],
	# топливная зона и подъезд
	["qr_tanker", Vector3(140, 0, -110), 1.57, 8.5, "fuel", "Топливозаправщик"], ["qr_tanker", Vector3(120, 0, -100), 0.1, 8.5, "fuel", "Топливозаправщик"],
	# запад
	["ap_bagcart", Vector3(-150, 0, -70), 1.5, 3.4, "luggage", "Багажная тележка"], ["ap_tug", Vector3(-160, 0, -8), 1.7, 5.2, "machine", "Кабина тягача"],
	["ul_gaz66", Vector3(-178, 0, -52), 0.1, 5.6, "truck", "Кузов грузовика"], ["qr_compressor", Vector3(-150, 0, -14), 0.0, 2.2, "tech", "Компрессор"],
	# у полосы
	["ul_ural_wreck", Vector3(-120, 0, 82), 0.5, 7.4, "truck", "Разбитый грузовик"], ["ul_car", Vector3(140, 0, 80), 2.2, 4.2, "cab", "Брошенная машина"],
	["qr_satdish", Vector3(-40, 0, -112), 0.0, 3.0, "tech", "Антенный шкаф"], ["qr_radiotower", Vector3(172, 0, 90), 0.0, 12.0, "", ""],
]
## штабеля: [x, z, сколько, вид, обыскивается]
const A_PILES := [
	[110, -2, 4, "crate", true], [118, -8, 3, "pallet", true], [126, 30, 4, "crate", true], [140, 30, 3, "pallet", true], [164, 28, 4, "crate", true],
	[192, 6, 3, "barrel", false], [188, -22, 3, "crate", true], [170, -34, 2, "pallet", true], [108, 34, 2, "barrel", true], [150, -18, 3, "crate", true],
	[-152, -60, 3, "crate", true], [-186, -66, 2, "pallet", true], [-150, -34, 3, "barrel", false], [-192, -10, 2, "crate", true],
	[92, -100, 2, "crate", true], [70, -120, 2, "barrel", false], [134, -90, 2, "barrel", true], [192, -92, 2, "crate", true],
	[-90, 100, 2, "crate", true], [90, 100, 2, "pallet", true], [186, 112, 2, "barrel", false], [-186, 96, 2, "crate", true],
	[40, -4, 2, "crate", true], [-112, -50, 2, "pallet", true], [86, -40, 3, "crate", true],
]

static var _acfg := {}
var planes: Array = []                  ## {id, n, xf, cab: Rect2 (в системе самолёта), fy, mats, door, foot, inside}
var gate_pt := Vector3.ZERO             ## посадочный выход рейса (задание)
var flight_plane := -1                  ## номер самолёта рейса среди planes
var quest_stash := {}                   ## что задания в каком тайнике extra: название → номер


static func acfg() -> Dictionary:
	if _acfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(A_CFG))
		_acfg = d if d is Dictionary else {}
	return _acfg


func conf() -> Dictionary:
	return acfg()


func entry() -> Vector3:
	return A_ENTRY


func title() -> String:
	return A_TITLE


func spawn_limit() -> float:
	return A_FX - 4.0


static func a_sig() -> int:
	return hash(str(A_BUILDINGS) + "|" + str(ULBlock.GEN_V))


static func in_field(q: Vector2) -> bool:
	return absf(q.x) < A_FX and q.y > A_FN and q.y < A_FS


static func _rect_d(r: Rect2, q: Vector2) -> float:
	var dx := maxf(maxf(r.position.x - q.x, q.x - r.end.x), 0.0)
	var dy := maxf(maxf(r.position.y - q.y, q.y - r.end.y), 0.0)
	return sqrt(dx * dx + dy * dy)


## расстояние до твёрдого покрытия (0 — на нём)
static func hard_d(q: Vector2) -> float:
	var d := minf(_rect_d(RWY, q), minf(_rect_d(TWY, q), _rect_d(APRON, q)))
	d = minf(d, _rect_d(CARGO_YARD, q))
	for r in LINKS:
		d = minf(d, _rect_d(r, q))
	for r in PARKS:
		d = minf(d, _rect_d(r, q))
	return d


func road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in A_ROADS:
		for i in (r as Array).size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func track_dist(_q: Vector2) -> float:
	return 1e9


func clear_w(q: Vector2) -> float:
	return 1.0 if absf(q.x) < A_FX + 1.5 and q.y > A_FN - 1.5 and q.y < A_FS + 1.5 else 0.0


func pave_dist(q: Vector2) -> float:
	return minf(road_dist(q) - 3.5, hard_d(q))


func forest_ok(q: Vector2) -> bool:
	return (absf(q.x) > A_FX + 3.0 or q.y > A_FS + 3.0 or q.y < A_FN - 3.0) and absf(q.x - A_GATE_X) > 8.0


func forest_n() -> int:
	return 0


func _land_ok(q: Vector2) -> bool:
	return in_field(q)


func _junk_spots() -> Array:
	var spots: Array = []
	for t in A_THINGS:
		if String(t[4]) != "":
			spots.append(t[1])
	return spots


## тайники задания «Последний рейс»: сведения о рейсе — на стойке информации в зале терминала, документация —
## в кабинете второго этажа посадочного крыла, груз — в хвосте самолёта рейса.
func roll_containers(rng: RandomNumberGenerator) -> void:
	quest_box = -1
	super.roll_containers(rng)
	quest_where.clear()
	var base := containers.size() - extra.size()
	# документация: тайник на втором этаже посадочного крыла (каждое посещение — в другом)
	var up: Array = []
	for i in base:
		var ct: Dictionary = containers[i]
		if String(ct.get("bld", "")) == "term_e" and float((ct.pos as Vector3).y) > 2.0:
			up.append(i)
	if not up.is_empty():
		var ci: int = up[rng.randi() % up.size()]
		_a_put(containers[ci].items, "a_docs")
		quest_where["a_docs"] = ci
	for key in quest_stash:
		var qi: int = base + int(quest_stash[key])
		var items: Array = containers[qi].items
		if String(key) == "a_cargo":
			for k in items.size():
				items[k] = null
			for l in conf().get("loot", {}).get("quest_box", []):
				if rng.randf() <= (float(l[3]) if l.size() > 3 else 1.0):
					ULInventory.put(items, ULItems.make(String(l[0]), rng.randi_range(int(l[1]), int(l[2]))))
		_a_put(items, String(key))
		quest_where[String(key)] = qi


## предмет задания — в тайник: в свободную ячейку, а если все заняты — вместо последнего предмета
func _a_put(items: Array, id: String) -> void:
	for k in items.size():
		if items[k] == null:
			items[k] = ULItems.make(id, 1)
			return
	if not items.is_empty():
		items[items.size() - 1] = ULItems.make(id, 1)


# ---------------- сборка ----------------

func build(world: Node3D) -> void:
	w = world
	half = AX
	body = StaticBody3D.new()
	body.name = "AirportBody"
	var fn := FastNoiseLite.new()
	fn.seed = 6411
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	_mats["a_white"] = _a_paint(Color(0.74, 0.74, 0.7))
	_mats["a_yellow"] = _a_paint(Color(0.72, 0.6, 0.2))
	_mats["a_seat"] = _a_paint(Color(0.2, 0.27, 0.4))
	_mats["a_floor"] = _a_paint(Color(0.3, 0.31, 0.33))
	_mats["a_trim"] = _a_paint(Color(0.62, 0.62, 0.6))
	var rng := RandomNumberGenerator.new()
	rng.seed = 9137
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "apbake" and ResourceLoader.exists(A_CACHE):
		var r = load(A_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == a_sig():
			cache = r
		else:
			push_warning("аэропорт: кэш построек устарел — пересоберите --as-test=apbake")
	var made := {}
	for d in A_BUILDINGS:
		var b := ULBlock.new()
		add_child(b)
		var st0 := rng.state
		b.build(d, rng, cache.blds.get(String(d.id), {}) if cache != null else {})
		if cache == null:
			made[String(d.id)] = b.to_cache()
			made[String(d.id)]["rng0"] = st0
		for c in b.cols:
			_col_xf(c[0], c[1])
		# лестничные марши — клинья столкновений (по ним ходят и герой, и заражённые)
		for h in b.hulls:
			var hcs := CollisionShape3D.new()
			var hsh := ConvexPolygonShape3D.new()
			hsh.points = h
			hcs.shape = hsh
			body.add_child(hcs)
		blds.append(b)
		barns.append({"node": b, "id": b.id, "n": b.title})
		for dd in b.doors:
			doors.append(dd)
			var k := _cell(dd.center)
			if not _door_grid.has(k):
				_door_grid[k] = []
			_door_grid[k].append(dd)
		match String(d.id):
			"cargo", "wstore", "sort", "svc4":
				_p_warehouse(b, d)
			"term":
				_a_term(b)
			"term_w":
				_a_wing_w(b)
			"term_e":
				_a_wing_e(b)
			"tower":
				_a_tower(b)
			"hangar1":
				_a_hangar1(b)
			"hangar2":
				_a_hangar2(b)
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_a_forest(rng)
	_a_ground()
	_a_marks(props)
	_a_fences(props)
	_a_fuel(props)
	_a_planes(props)
	_a_bridges(props)
	_a_things()
	_a_piles(rng)
	_a_lamps()
	_flush(props)
	_c_vegetation()
	_a_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "apbake":
		var cr := ULBlockCache.new()
		cr.sig = a_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, A_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек аэропорта: %s (%s)" % [A_CACHE, error_string(err)])
	print("[airport] аэропорт собран: %d мс, построек %d, столкновений %d, тайников вне построек %d, самолётов %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), extra.size(), planes.size()])


func _a_paint(c: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = 0.9
	return m


# ---------------- лес за оградой ----------------

## Лес — только за оградой (внутри — аэродром): ели одной сеткой с повторами, полосой 6–34 м от ограды.
func _a_forest(rng: RandomNumberGenerator) -> void:
	var tries := 0
	while _spruce_xf.size() < 900 and tries < 16000:
		tries += 1
		var q := Vector2(rng.randf_range(-AX - 24.0, AX + 24.0), rng.randf_range(-AX - 20.0, AX + 20.0))
		if not forest_ok(q):
			continue
		if _noise(q / 45.0 + Vector2(0.3, 0.7)) < 0.36 and rng.randf() < 0.6:
			continue
		var p := Vector3(q.x, 0, q.y)
		wood_pts.append(p)
		_spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.9, 1.5)), p))
	# группами по участкам 70 × 70 м — чтобы дальние и те, что за спиной камеры, не рисовались (одной сеткой на всё
	# поле рисовались бы все 900 всегда). Растворение крон над героем не нужно: лес за оградой, герой туда не ходит.
	var mesh: ArrayMesh = w._spruce_mesh(5.0, 141)
	var cells := {}
	for xf in _spruce_xf:
		var key := Vector2i(int(floor(xf.origin.x / 70.0)), int(floor(xf.origin.z / 70.0)))
		if not cells.has(key):
			cells[key] = []
		(cells[key] as Array).append(xf)
	for key in cells:
		var arr: Array = cells[key]
		var mid := Vector3.ZERO
		for xf in arr:
			mid += (xf as Transform3D).origin / arr.size()
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.use_custom_data = true
		mm.use_colors = true
		mm.mesh = mesh
		mm.instance_count = arr.size()
		for i in arr.size():
			var xf: Transform3D = arr[i]
			mm.set_instance_transform(i, Transform3D(xf.basis, xf.origin - mid))
			mm.set_instance_color(i, Color.WHITE)
			mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.position = mid
		mi.visibility_range_end = 190.0
		mi.visibility_range_end_margin = 10.0
		add_child(mi)


# ---------------- земля и покрытия ----------------

func _a_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_for("airport", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(A_MASK) and w.test != "apbake":
		mask = (load(A_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _a_bake_mask(1024 if w.test == "apbake" else 256)
		if w.test == "apbake":
			mask.save_png(ProjectSettings.globalize_path(A_MASK))
			print("[bake] карта земли аэропорта: ", A_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	ULHouse.outer_frame(self, half, 640.0)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(640, 0.2, 640)
	cs.shape = bs
	cs.position.y = -0.1
	body.add_child(cs)
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, AZ * 2.0 + 20.0) if s.x != 0.0 else Vector3(AX * 2.0 + 20.0, 4, 1)
		wc.shape = b
		wc.position = Vector3(s.x * (AX + 9.0), 2.0, s.z * (AZ + 9.0))
		body.add_child(wc)
	# покрытия: перрон — бетонные плиты; полоса, рулёжка, стоянки и дороги — асфальт
	_pave_rect(APRON, 0.014, "pavers")
	_pave_rect(CARGO_YARD, 0.013, "pavers")
	_pave_rect(TWY, 0.02, "asphalt")
	for r in LINKS:
		_pave_rect(r, 0.023, "asphalt")
	_pave_rect(RWY, 0.026, "asphalt")
	for r in PARKS:
		_pave_rect(r, 0.016, "asphalt")
	for r in A_ROADS:
		_strip(r, 7.0, 0.018, "asphalt")
	# у ворот ангаров и у терминала со стороны города — плиты
	_pave_rect(Rect2(100, -48, 90, 8), 0.012, "pavers")
	_pave_rect(Rect2(-34, -96, 68, 9), 0.012, "pavers")


func _a_bake_mask(n: int) -> Image:
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	for iy in n:
		for ix in n:
			var p := Vector2((ix + 0.5) / n - 0.5, (iy + 0.5) / n - 0.5) * half * 2.0
			var n1 := _noise(p / 60.0)
			var n2 := _noise(p / 17.0 + Vector2(0.37, 0.11))
			var n3 := _noise(p / 5.5 + Vector2(0.71, 0.53))
			var inside := 1.0 if in_field(p) else 0.0
			var hd := minf(hard_d(p), road_dist(p) - 3.5)
			var hard := 1.0 - smoothstep(0.0, 1.6, hd + (n3 - 0.5) * 1.2)
			var bd := bld_dist(p) if hd > 0.5 else 9.0
			var yard := (1.0 - smoothstep(1.5, 5.5, bd + (n3 - 0.5) * 2.0)) * inside
			# между покрытиями — луг; вытоптано у построек и пятнами
			var bare := smoothstep(0.58, 0.8, n1 * 0.4 + n2 * 0.6) * 0.5 * inside
			var path := maxf(hard, maxf(yard * 0.9, bare))
			var gw := (smoothstep(0.15, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.6 + 0.4) * (1.0 - path)
			var out_d := maxf(maxf(absf(p.x) - A_FX, p.y - A_FS), A_FN - p.y)
			var fw := smoothstep(3.0, 12.0, out_d + (n2 - 0.5) * 6.0) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bd)) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- разметка ----------------

## Разметка аэродрома: осевая и края полосы, пороги, цифры курса, жёлтые оси рулёжек и стоянок, места на стоянках
## машин. Тонкие плашки краски (без столкновений); это настоящая разметка, а не пояснения со схемы.
func _a_marks(g: Node3D) -> void:
	var y := 0.034
	var zc := RWY.get_center().y
	var x := RWY.position.x + 34.0
	while x < RWY.end.x - 34.0:
		_bx(g, "a_white", Vector3(7.0, 0.012, 0.5), _at(Vector3(x, y, zc)))
		x += 14.0
	for z in [RWY.position.y + 1.2, RWY.end.y - 1.2]:
		_bx(g, "a_white", Vector3(RWY.size.x - 4.0, 0.012, 0.4), _at(Vector3(0, y, z)))
	for sx in [-1.0, 1.0]:
		for i in 8:
			_bx(g, "a_white", Vector3(9.0, 0.012, 1.3), _at(Vector3(sx * (RWY.size.x * 0.5 - 8.0), y, RWY.position.y + 3.6 + i * 3.55)))
	_a_number(g, "10", Vector3(RWY.position.x + 22.0, y, zc), 1.0)
	_a_number(g, "28", Vector3(RWY.end.x - 22.0, y, zc), -1.0)
	# рулёжка и съезды: жёлтая ось
	_bx(g, "a_yellow", Vector3(TWY.size.x - 6.0, 0.012, 0.22), _at(Vector3(TWY.get_center().x, y, TWY.get_center().y)))
	for r in LINKS:
		_bx(g, "a_yellow", Vector3(0.22, 0.012, r.size.y + 8.0), _at(Vector3(r.get_center().x, y, r.get_center().y)))
	# стоянки самолётов: ось заруливания и стоп-линия
	for pl in A_PLANES:
		if bool(pl.get("indoor", false)):
			continue
		var c: Vector2 = pl.c
		var yaw := float(pl.yaw)
		var fwd := Vector3(cos(yaw), 0, -sin(yaw))
		var ln := float(pl.len)
		_bx(g, "a_yellow", Vector3(ln + 14.0, 0.012, 0.2), Transform3D(Basis(Vector3.UP, yaw), Vector3(c.x, y, c.y) - fwd * 5.0))
		_bx(g, "a_yellow", Vector3(0.2, 0.012, 5.0), Transform3D(Basis(Vector3.UP, yaw), Vector3(c.x, y, c.y) + fwd * (ln * 0.5 + 2.0)))
	# стоянки машин: места
	for r in PARKS:
		var pr: Rect2 = r
		var px: float = pr.position.x + 3.0
		while px < pr.end.x - 2.0:
			for z in [pr.position.y + 3.5, pr.end.y - 3.5]:
				_bx(g, "a_white", Vector3(0.12, 0.012, 5.0), _at(Vector3(px, y, z)))
			px += 2.9


## цифры курса на торце полосы — из плашек (семь сегментов); dir — в какую сторону «верх» цифр
func _a_number(g: Node3D, txt: String, at: Vector3, dir: float) -> void:
	var segs := {"0": "abcdef", "1": "bc", "2": "abged", "8": "abcdefg"}
	var hgt := 9.0
	var wid := 4.0
	var th := 0.9
	for i in txt.length():
		var o := at + Vector3(0, 0, (float(i) - (txt.length() - 1) * 0.5) * (wid + 2.6) * dir)
		for s in String(segs.get(txt[i], "")):
			var sz := Vector3(th, 0.012, wid)
			var off := Vector3.ZERO
			match s:
				"a":
					off = Vector3(hgt * 0.5, 0, 0)
				"g":
					off = Vector3.ZERO
				"d":
					off = Vector3(-hgt * 0.5, 0, 0)
				"b":
					sz = Vector3(hgt * 0.5, 0.012, th)
					off = Vector3(hgt * 0.25, 0, wid * 0.5)
				"c":
					sz = Vector3(hgt * 0.5, 0.012, th)
					off = Vector3(-hgt * 0.25, 0, wid * 0.5)
				"f":
					sz = Vector3(hgt * 0.5, 0.012, th)
					off = Vector3(hgt * 0.25, 0, -wid * 0.5)
				"e":
					sz = Vector3(hgt * 0.5, 0.012, th)
					off = Vector3(-hgt * 0.25, 0, -wid * 0.5)
			_bx(g, "a_white", sz, _at(o + Vector3(off.x * dir, 0, off.z * dir)))


# ---------------- ограда, свет ----------------

## много одинаковых секций одной сеткой с повторами (по группам — чтобы дальние отсекались): модель id длиной
## length вдоль своей длинной стороны; xfs — где стоит каждая (поворот — вокруг вертикали)
## far > 0 — дальше vis метров вместо модели рисуется простая коробка её размеров (до far метров): у ограды
## 334 секции по 2,8 тыс. треугольников — вдали хватает плиты. Возвращает созданные узлы (в _rep_nodes).
var _rep_nodes: Array = []


func _a_repeat(id: String, pts: Array, length: float, vis := 170.0, far := 0.0, far_mat := "concrete") -> bool:
	_rep_nodes = []
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path) or pts.is_empty():
		return false
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	var bb: AABB = w._aabb(n)
	var mis := n.find_children("*", "MeshInstance3D", true, false)
	if mis.is_empty():
		n.free()
		return false
	var src: MeshInstance3D = mis[0]
	var long_x := bb.size.x > bb.size.z
	var k := length / maxf(bb.size.x, bb.size.z)
	var fix := Basis(Vector3.UP, 0.0 if long_x else PI * 0.5)
	# сетка модели в её корне (до масштаба и поворота секции)
	var local := Transform3D.IDENTITY
	var cur: Node = src
	while cur != null and cur != n:
		if cur is Node3D:
			local = (cur as Node3D).transform * local
		cur = cur.get_parent()
	var c := bb.get_center()
	var base := Transform3D(fix.scaled(Vector3.ONE * k), -(fix * (Vector3(c.x, bb.position.y, c.z) * k))) * local
	var mesh := src.mesh
	var mat: Material = src.get_active_material(0)
	n.free()
	var group := 12
	var i := 0
	while i < pts.size():
		var cnt := mini(group, pts.size() - i)
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = mesh
		mm.instance_count = cnt
		var mid := Vector3.ZERO
		for j in cnt:
			mid += (pts[i + j][0] as Vector3) / cnt
		for j in cnt:
			var at: Vector3 = pts[i + j][0]
			mm.set_instance_transform(j, Transform3D(Basis(Vector3.UP, float(pts[i + j][1])), at - mid) * base)
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.material_override = mat
		mi.position = mid
		mi.visibility_range_end = vis
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		add_child(mi)
		_rep_nodes.append(mi)
		if far > vis:
			var bm := BoxMesh.new()
			bm.size = Vector3(length, bb.size.y * k, maxf(minf(bb.size.x, bb.size.z) * k * 0.5, 0.12))
			var m2 := MultiMesh.new()
			m2.transform_format = MultiMesh.TRANSFORM_3D
			m2.mesh = bm
			m2.instance_count = cnt
			for j in cnt:
				var at2: Vector3 = pts[i + j][0]
				m2.set_instance_transform(j, Transform3D(Basis(Vector3.UP, float(pts[i + j][1])), at2 - mid + Vector3.UP * (bb.size.y * k * 0.5)))
			var mi2 := MultiMeshInstance3D.new()
			mi2.multimesh = m2
			mi2.material_override = _mats.get(far_mat)
			mi2.position = mid
			mi2.visibility_range_begin = vis
			mi2.visibility_range_end = far
			mi2.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			add_child(mi2)
		i += cnt
	return true


func _a_fences(g: Node3D) -> void:
	var pts: Array = []
	var x := -A_FX
	while x < A_FX:
		var mid := x + 2.0
		if absf(mid - A_GATE_X) > 6.5:
			pts.append([Vector3(mid, 0, A_FS), 0.0])
		pts.append([Vector3(mid, 0, A_FN), 0.0])
		x += 4.0
	for sx in [-A_FX, A_FX]:
		var z := A_FN
		while z < A_FS:
			pts.append([Vector3(sx, 0, z + 2.0), PI * 0.5])
			z += 4.0
	if not _a_repeat("qr_concfence", pts, 4.0, 46.0, 300.0):
		for pp in pts:
			_bx(g, "concrete", Vector3(4.0, 2.4, 0.2), _at(pp[0] + Vector3.UP * 1.2, float(pp[1])))
	# столкновения — длинными коробками (южная сторона — с проёмом ворот)
	_col_xf(Vector3(A_FX * 2.0, 2.6, 0.4), _at(Vector3(0, 1.3, A_FN)))
	_col_xf(Vector3(0.4, 2.6, A_FS - A_FN), _at(Vector3(-A_FX, 1.3, (A_FS + A_FN) * 0.5)))
	_col_xf(Vector3(0.4, 2.6, A_FS - A_FN), _at(Vector3(A_FX, 1.3, (A_FS + A_FN) * 0.5)))
	for sgn in [-1.0, 1.0]:
		_col_xf(Vector3(A_FX - 6.5, 2.6, 0.4), _at(Vector3(sgn * (A_FX + 6.5) * 0.5 + A_GATE_X, 1.3, A_FS)))
	# ворота: столбы, распахнутые створки, поднятый шлагбаум
	for sgn in [-1.0, 1.0]:
		_bx(g, "concrete", Vector3(0.6, 3.0, 0.6), _at(Vector3(A_GATE_X + sgn * 6.3, 1.5, A_FS)), true)
		_bx(g, "rust", Vector3(5.2, 2.2, 0.08), Transform3D(Basis(Vector3.UP, sgn * 1.3), Vector3(A_GATE_X + sgn * 7.2, 1.2, A_FS + 2.6)), true)
	_barrier(Vector3(A_GATE_X - 4.4, 0, A_FS - 3.0), -0.25)
	# ограда топливной зоны (сетка), ворота — с запада
	var f := A_FUEL
	var fp: Array = []
	var fx := f.position.x
	while fx < f.end.x:
		fp.append([Vector3(fx + 2.0, 0, f.position.y), 0.0])
		fp.append([Vector3(fx + 2.0, 0, f.end.y), 0.0])
		fx += 4.0
	var fz := f.position.y
	while fz < f.end.y:
		if absf(fz + 2.0 - (-102.0)) > 4.2:
			fp.append([Vector3(f.position.x, 0, fz + 2.0), PI * 0.5])
		fp.append([Vector3(f.end.x, 0, fz + 2.0), PI * 0.5])
		fz += 4.0
	_a_repeat("qr_chainfence", fp, 4.0, 70.0)
	_col_xf(Vector3(f.size.x, 2.2, 0.2), _at(Vector3(f.get_center().x, 1.1, f.position.y)))
	_col_xf(Vector3(f.size.x, 2.2, 0.2), _at(Vector3(f.get_center().x, 1.1, f.end.y)))
	_col_xf(Vector3(0.2, 2.2, f.size.y), _at(Vector3(f.end.x, 1.1, f.get_center().y)))
	_col_xf(Vector3(0.2, 2.2, -106.0 - f.position.y), _at(Vector3(f.position.x, 1.1, (f.position.y - 106.0) * 0.5)))
	_col_xf(Vector3(0.2, 2.2, f.end.y + 98.0), _at(Vector3(f.position.x, 1.1, (f.end.y - 98.0) * 0.5)))


func _a_lamps() -> void:
	var pts := [Vector3(-120, 0, -54), Vector3(-80, 0, -54), Vector3(-34, 0, -50), Vector3(34, 0, -50), Vector3(90, 0, -54), Vector3(-140, 0, 4), Vector3(-40, 0, 4), Vector3(60, 0, 4),
		Vector3(-76, 0, 90), Vector3(-10, 0, 90), Vector3(14, 0, 90), Vector3(80, 0, 90), Vector3(-8, 0, 126), Vector3(102, 0, -44), Vector3(196, 0, 36), Vector3(104, 0, 36),
		Vector3(-150, 0, -50), Vector3(-196, 0, -100), Vector3(30, 0, -126), Vector3(126, 0, -90)]
	for p in pts:
		_cyl_col(p, 0.25, 3.0)
		lamps_p.append(p)
	if ResourceLoader.exists(MODELS + "qr_floodlight.glb"):
		for p in pts:
			_pm("qr_floodlight", p, 0.0, 9.0, false, false, Color(0.86, 0.84, 0.8), true)
			_cull(get_child(get_child_count() - 1), 110.0)
	# огни полосы: низкие столбики по краям через 24 м
	var g := get_node("Props")
	var x := RWY.position.x + 6.0
	while x < RWY.end.x:
		for z in [RWY.position.y - 1.4, RWY.end.y + 1.4]:
			_bx(g, "a_trim", Vector3(0.16, 0.34, 0.16), _at(Vector3(x, 0.17, z)))
			_bx(g, "a_yellow", Vector3(0.22, 0.1, 0.22), _at(Vector3(x, 0.39, z)))
		x += 24.0


# ---------------- топливная зона ----------------

func _a_fuel(g: Node3D) -> void:
	for t in A_TANKS_V:
		var p: Vector3 = t
		if ResourceLoader.exists(MODELS + "pt_tank_v.glb"):
			_pm("pt_tank_v", p, 0.0, 11.0, false, false, Color(0.86, 0.84, 0.8), true)
		else:
			_cy(g, "rust", 4.2, 4.2, 10.0, _at(p + Vector3(0, 5.0, 0)), 24)
		_cyl_col(p, 4.3, 6.0)
		_p_stash(p + Vector3(-5.0, 0, 0), Vector3(1.2, 1.6, 1.2), 0.0, "fuel", "Вентиль резервуара")
	for t in A_TANKS_H:
		var p: Vector3 = t
		if ResourceLoader.exists(MODELS + "pt_tank_h.glb"):
			_pm("pt_tank_h", p, 0.0, 14.0, true, true)
		else:
			_cy(g, "rust", 2.4, 2.4, 14.0, Transform3D(Basis(Vector3(1, 0, 0), PI * 0.5), p + Vector3(0, 3.0, 0)), 20)
			_col_xf(Vector3(5.0, 5.6, 14.0), _at(p + Vector3(0, 2.8, 0)))
	# трубопровод от резервуаров к насосной на низких опорах
	_cy(g, "rust", 0.18, 0.18, 30.0, Transform3D(Basis(Vector3(0, 0, 1), PI * 0.5), Vector3(160.0, 0.5, -112.0)), 8)
	_col_xf(Vector3(30.0, 0.8, 0.5), _at(Vector3(160.0, 0.4, -112.0)))
	_cy(g, "rust", 0.18, 0.18, 12.0, Transform3D(Basis(Vector3(1, 0, 0), PI * 0.5), Vector3(145.0, 0.5, -106.0)), 8)
	if ResourceLoader.exists(MODELS + "pt_pump.glb"):
		_pm("pt_pump", Vector3(150, 0, -98), 0.3, 2.2, true)
		_p_stash(Vector3(150, 0, -98), Vector3(2.0, 1.4, 1.4), 0.3, "tech", "Насосный агрегат")
	_pm("cv_jerrycans", Vector3(133, 0, -94.6), 0.4, 0.95, false)
	_p_stash(Vector3(133, 0, -94.6), Vector3(0.9, 0.6, 0.9), 0.4, "canisters", "Канистры")
	_pm("gr_barrels", Vector3(192, 0, -126), 1.2, 1.8, true)
	_pm("qr_ibc", Vector3(190, 0, -96), 0.0, 1.2, true)


# ---------------- самолёты ----------------

const CUT_SHADER := """shader_type spatial;
render_mode cull_disabled;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float rough = 0.75;
uniform float cut_y = 10000.0;
varying float wy;
void vertex() {
	wy = (MODEL_MATRIX * vec4(VERTEX, 1.0)).y;
}
void fragment() {
	if (wy > cut_y) {
		discard;
	}
	vec3 c = texture(albedo_tex, UV).rgb * tint.rgb;
	if (!FRONT_FACING) {
		c = vec3(0.34, 0.35, 0.36);
	}
	ALBEDO = c;
	ROUGHNESS = rough;
}
"""
static var _cut_sh: Shader


## Самолёт своей моделью: стоит на шасси, нос — по yaw. Столкновения: фюзеляж и двигатели (под крыльями пройти
## можно). Материалы — со срезом по высоте: пока герой в салоне, всё выше плеч не рисуется.
func _a_planes(g: Node3D) -> void:
	for d in A_PLANES:
		_a_plane(g, d)


func _a_plane(g: Node3D, d: Dictionary) -> void:
	var id := String(d.id)
	var c2: Vector2 = d.c
	var ln := float(d.len)
	var yaw := float(d.yaw)
	var rot := Basis(Vector3.UP, yaw)
	var xf := Transform3D(rot, Vector3(c2.x, 0, c2.y))           # система самолёта: +x — к носу, z — поперёк
	var path := MODELS + id + ".glb"
	var wid := 0.1                                                # ширина фюзеляжа в долях длины
	var hgt := 0.3
	var mats: Array = []
	var node: Node3D = null
	if ResourceLoader.exists(path):
		if not _scenes.has(path):
			_scenes[path] = load(path)
		node = (_scenes[path] as PackedScene).instantiate()
		ULSanatorium.mute(node)
		# модель может стоять в своём файле как угодно (лайнер — по диагонали): ось фюзеляжа, нос и середина — по сетке
		var fit := _plane_fit(id, node)
		var k := ln / float(fit.len)
		var mrot := rot * Basis(Vector3.UP, float(fit.nose))
		if bool(acfg().get("plane_flip", {}).get(id, false)):
			mrot = mrot * Basis(Vector3.UP, PI)
		var cb: Vector3 = fit.mid
		node.transform = Transform3D(mrot.scaled(Vector3.ONE * k), Vector3(c2.x, 0, c2.y) - mrot * (cb * k))
		add_child(node)
		hgt = float(fit.h) * k / ln
		mats = _a_cut_mats(node, d.get("tint", Color(0.9, 0.9, 0.88)))
		_cull(node, 320.0)
	else:
		_bx(g, "a_trim", Vector3(ln, ln * 0.1, ln * 0.1), xf * Transform3D(Basis(), Vector3(0, ln * 0.13, 0)))
		_bx(g, "a_trim", Vector3(ln * 0.16, 0.3, ln * 0.9), xf * Transform3D(Basis(), Vector3(-ln * 0.02, ln * 0.09, 0)))
	var cab: Dictionary = acfg().get("cabin", {}).get(id, A_CABIN)
	var fy := float(cab.get("fy", A_CABIN.fy)) * ln
	var hw := float(cab.get("hw", A_CABIN.hw)) * ln
	var t0 := float(cab.get("t0", A_CABIN.t0))
	var t1 := float(cab.get("t1", A_CABIN.t1))
	var x0 := (t0 - 0.5) * ln
	var x1 := (t1 - 0.5) * ln
	if not bool(d.get("indoor", false)):
		blob_pts.append([Vector3(c2.x, 0, c2.y), Vector2(ln * 0.9, hw * 2.4), yaw, 0.55])
	var rec := {"id": id, "n": String(d.n), "xf": xf, "cab": Rect2(x0, -hw, x1 - x0, hw * 2.0), "fy": fy, "mats": mats, "walk": bool(d.walk), "inside": false,
		"door": Vector3.ZERO, "foot": Vector3.ZERO, "aisle": Vector3.ZERO, "tail": Vector3.ZERO, "node": node}
	# крылья с двигателями — преграда (сверху видно, что это предмет; под крылом героя не было бы видно)
	var wing: Array = acfg().get("wing", {}).get(id, [])
	if wing.size() >= 5:
		for sgn in [-1.0, 1.0]:
			var wb := Basis(Vector3.UP, float(sgn) * deg_to_rad(float(wing[4])))
			_col_xf(Vector3(float(wing[2]) * ln, 3.4, float(wing[3]) * ln), xf * Transform3D(wb, Vector3(float(wing[0]) * ln, 1.7, float(sgn) * float(wing[1]) * ln)))
	if not bool(d.walk):
		# закрытый самолёт: фюзеляж — преграда от земли; обыск — у багажного люка
		_col_xf(Vector3(ln * 0.86, fy + 2.2, hw * 2.0 + 0.4), xf * Transform3D(Basis(), Vector3(0, (fy + 2.2) * 0.5, 0)))
		var sd := 1.0
		_p_stash(xf * Vector3(ln * 0.3, 0, sd * (hw + 0.9)), Vector3(1.6, 1.6, 1.0), yaw, "plane_hold", "Багажный люк: " + String(d.n).to_lower())
		planes.append(rec)
		return
	# --- проходимый самолёт ---
	var side := float(d.get("side", 1.0))
	var door_x := (float(cab.get("door", A_CABIN.door)) - 0.5) * ln
	var th := 0.12
	# под фюзеляжем — преграда от земли до пола салона (под крыльями — свободно)
	_col_xf(Vector3(ln * 0.84, fy - 0.2, hw * 1.6), xf * Transform3D(Basis(), Vector3(0, (fy - 0.2) * 0.5, 0)))
	# пол салона
	_col_xf(Vector3(x1 - x0, 0.2, hw * 2.0), xf * Transform3D(Basis(), Vector3((x0 + x1) * 0.5, fy - 0.1, 0)))
	_bx(g, "a_floor", Vector3(x1 - x0, 0.04, hw * 2.0), xf * Transform3D(Basis(), Vector3((x0 + x1) * 0.5, fy + 0.02, 0)))
	# борта (со стороны трапа — с проёмом двери 1,2 м), перегородки в хвосте и в носу
	var dw := 1.2
	for sgn in [-1.0, 1.0]:
		if sgn == side:
			var a := door_x - dw * 0.5
			var b := door_x + dw * 0.5
			_col_xf(Vector3(a - x0, 2.2, th), xf * Transform3D(Basis(), Vector3((x0 + a) * 0.5, fy + 1.1, sgn * hw)))
			_col_xf(Vector3(x1 - b, 2.2, th), xf * Transform3D(Basis(), Vector3((b + x1) * 0.5, fy + 1.1, sgn * hw)))
		else:
			_col_xf(Vector3(x1 - x0, 2.2, th), xf * Transform3D(Basis(), Vector3((x0 + x1) * 0.5, fy + 1.1, sgn * hw)))
	_col_xf(Vector3(th, 2.2, hw * 2.0), xf * Transform3D(Basis(), Vector3(x0, fy + 1.1, 0)))
	_col_xf(Vector3(th, 2.2, hw * 2.0), xf * Transform3D(Basis(), Vector3(x1, fy + 1.1, 0)))
	# кабина пилотов: перегородка с проходом, два кресла, приборная доска
	var ck := x1 - 2.6
	for sgn in [-1.0, 1.0]:
		var wl := hw - 0.62
		_bx(g, "a_trim", Vector3(0.08, 1.2, wl), xf * Transform3D(Basis(), Vector3(ck, fy + 0.6, sgn * (0.62 + wl * 0.5))), true)
		_bx(g, "a_seat", Vector3(0.6, 0.5, 0.55), xf * Transform3D(Basis(), Vector3(x1 - 1.3, fy + 0.25, sgn * 1.0)))
		_bx(g, "a_seat", Vector3(0.14, 0.7, 0.55), xf * Transform3D(Basis(), Vector3(x1 - 1.62, fy + 0.6, sgn * 1.0)))
		_col_xf(Vector3(0.8, 1.0, 0.6), xf * Transform3D(Basis(), Vector3(x1 - 1.35, fy + 0.5, sgn * 1.05)))
	_bx(g, "a_floor", Vector3(0.5, 0.9, hw * 1.7), xf * Transform3D(Basis(), Vector3(x1 - 0.4, fy + 0.45, 0)), true)
	# кухня: шкафы у двери напротив трапа
	var gal := door_x
	_bx(g, "a_trim", Vector3(1.4, 1.15, 0.6), xf * Transform3D(Basis(), Vector3(gal, fy + 0.58, -side * (hw - 0.4))), true)
	_bx(g, "a_floor", Vector3(1.4, 0.05, 0.62), xf * Transform3D(Basis(), Vector3(gal, fy + 1.18, -side * (hw - 0.4))))
	# ряды кресел: от хвоста до двери; проход посередине 0,95 м
	var seat_w := hw - 0.65
	var sx := x0 + 2.6
	var rows := 0
	var last := door_x - dw * 0.5 - 0.7
	var seat_pts: Array = []
	var seat_model := ResourceLoader.exists(MODELS + "ap_cabinseats.glb")
	var seat_yaw := yaw + PI * 0.5 + deg_to_rad(float(acfg().get("seat_yaw", 0.0)))
	while sx < last:
		for sgn in [-1.0, 1.0]:
			var zc: float = float(sgn) * (0.6 + seat_w * 0.5)
			if seat_model:
				seat_pts.append([xf * Vector3(sx, fy + 0.03, zc), seat_yaw])
			else:
				_bx(g, "a_seat", Vector3(0.5, 0.42, seat_w - 0.08), xf * Transform3D(Basis(), Vector3(sx, fy + 0.26, zc)))
				_bx(g, "a_seat", Vector3(0.12, 0.62, seat_w - 0.08), xf * Transform3D(Basis(), Vector3(sx - 0.27, fy + 0.74, zc)))
		rows += 1
		sx += 0.86
	# кресла салона — одной сеткой с повторами; видны только вблизи (в закрытом самолёте их всё равно не видно)
	_a_repeat("ap_cabinseats", seat_pts, seat_w - 0.06, 34.0)
	rec["seats"] = _rep_nodes.duplicate()
	for sn in rec.seats:
		(sn as Node3D).visible = false
	for sgn in [-1.0, 1.0]:
		var a2 := x0 + 2.2
		_col_xf(Vector3(last - a2 + 0.3, 1.1, seat_w), xf * Transform3D(Basis(), Vector3((a2 + last + 0.3) * 0.5, fy + 0.55, sgn * (0.6 + seat_w * 0.5))))
	# трап: от земли к двери
	var run := fy / 0.62
	var door_w: Vector3 = xf * Vector3(door_x, fy, side * (hw + 0.08))
	var foot_w: Vector3 = xf * Vector3(door_x, 0.02, side * (hw + 0.08 + run))
	_p_ramp(g, foot_w, door_w, 1.3, true)
	rec.door = door_w
	rec.foot = foot_w
	rec.aisle = xf * Vector3((x0 + door_x) * 0.5, fy, 0)
	rec.tail = xf * Vector3(x0 + 1.1, fy, 0)
	# тайники: кухня, полки над креслами (середина салона), кабина пилотов, хвостовой отсек
	_p_stash(xf * Vector3(gal - 1.0, fy, -side * (hw - 0.9)), Vector3(1.2, 1.2, 0.6), yaw, "plane_galley", "Кухня самолёта")
	_p_stash(xf * Vector3((x0 + door_x) * 0.5, fy, 0.0), Vector3(1.6, 1.2, 0.8), yaw, "plane_cabin", "Багажные полки салона")
	_p_stash(xf * Vector3(x1 - 2.2, fy, 0.0), Vector3(0.9, 1.2, 0.9), yaw, "plane_cockpit", "Кабина пилотов")
	var tail_i := _p_stash(xf * Vector3(x0 + 1.0, fy, 0.0), Vector3(1.4, 1.2, 1.2), yaw, "plane_tail", "Хвостовой отсек")
	_bx(g, "a_trim", Vector3(1.0, 0.9, 1.4), xf * Transform3D(Basis(), Vector3(x0 + 0.6, fy + 0.45, 0)), true)
	if bool(d.get("flight", false)):
		flight_plane = planes.size()
		quest_stash["a_cargo"] = tail_i
		# грузовой отсек рейса опечатан: без документации рейса не открыть
		extra[tail_i]["need"] = "a_docs"
		extra[tail_i]["need_text"] = "Отсек опечатан. Нужна документация рейса — она в служебных кабинетах посадочного крыла"
		extra[tail_i]["flag"] = "a_hold"
		extra[tail_i]["open_text"] = "грузовой отсек вскрыт"
		extra[tail_i]["n"] = "Опечатанный грузовой отсек"
	planes.append(rec)
	print("[airport] самолёт «%s»: пол %.2f м, салон %.1f × %.1f м, рядов кресел %d, трап %.1f м" % [String(d.n), fy, x1 - x0, hw * 2.0, rows, run])


static var _fits := {}


## Посадка модели самолёта: ось фюзеляжа (по вершинам пояса на высоте фюзеляжа — поперёк неё они ближе всего
## к середине), нос — конец, противоположный килю (самой высокой точке), середина и длина — вдоль оси.
## Возврат: nose — на сколько повернуть модель, чтобы нос смотрел в +x; mid — середина фюзеляжа у земли (в модели);
## len — длина вдоль оси; h — высота.
func _plane_fit(id: String, n: Node3D) -> Dictionary:
	if _fits.has(id):
		return _fits[id]
	var pts := PackedVector3Array()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var mx := Transform3D.IDENTITY
		var cur: Node = m
		while cur != null and cur != n:
			if cur is Node3D:
				mx = (cur as Node3D).transform * mx
			cur = cur.get_parent()
		for si in m.mesh.get_surface_count():
			var arr: PackedVector3Array = m.mesh.surface_get_arrays(si)[Mesh.ARRAY_VERTEX]
			for i in range(0, arr.size(), 2):
				pts.append(mx * arr[i])
	var c := Vector3.ZERO
	var ymax := -1e9
	var ymin := 1e9
	for p in pts:
		c += p / pts.size()
		ymax = maxf(ymax, p.y)
		ymin = minf(ymin, p.y)
	var band := PackedVector3Array()
	for p in pts:
		if p.y > ymin + (ymax - ymin) * 0.45 and p.y < ymin + (ymax - ymin) * 0.62:
			band.append(p)
	var best := 0.0
	var best_w := 1e9
	for k in 180:
		var a := deg_to_rad(float(k))
		var nrm := Vector3(-sin(a), 0, cos(a))
		var ws := 0.0
		for i in range(0, band.size(), 3):
			ws += absf((band[i] - c).dot(nrm))
		if ws < best_w:
			best_w = ws
			best = a
	var dir := Vector3(cos(best), 0, sin(best))
	var t0 := 1e9
	var t1 := -1e9
	var top_t := 0.0
	for p in pts:
		var t := (p - c).dot(dir)
		t0 = minf(t0, t)
		t1 = maxf(t1, t)
		if p.y >= ymax - 0.0005:
			top_t = t
	# киль — у конца t1? тогда нос — в сторону −dir
	var tail_at_end := (top_t - t0) / maxf(t1 - t0, 0.001) > 0.5
	var nose := best + (PI if tail_at_end else 0.0)
	var mid := c + dir * ((t0 + t1) * 0.5)
	mid.y = ymin
	_fits[id] = {"nose": nose, "mid": mid, "len": t1 - t0, "h": ymax - ymin}
	return _fits[id]


## материалы модели — на шейдер со срезом по высоте (текстура и оттенок сохраняются)
func _a_cut_mats(node: Node3D, tint: Color) -> Array:
	if _cut_sh == null:
		_cut_sh = Shader.new()
		_cut_sh.code = CUT_SHADER
	var out: Array = []
	for mi in node.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var src := m.get_active_material(si)
			var sm := ShaderMaterial.new()
			sm.shader = _cut_sh
			if src is BaseMaterial3D:
				sm.set_shader_parameter("albedo_tex", (src as BaseMaterial3D).albedo_texture)
			sm.set_shader_parameter("tint", tint)
			m.set_surface_override_material(si, sm)
			out.append(sm)
	return out


func tick(hero: Vector3, cam, delta: float) -> void:
	super.tick(hero, cam, delta)
	planes_tick(hero)


## каждый кадр: герой в салоне — верх фюзеляжа срезается (как крыша постройки)
func planes_tick(hero: Vector3) -> void:
	for pl in planes:
		if not bool(pl.walk):
			continue
		var l: Vector3 = (pl.xf as Transform3D).affine_inverse() * hero
		var inside: bool = (pl.cab as Rect2).grow(0.3).has_point(Vector2(l.x, l.z)) and hero.y > float(pl.fy) - 0.7
		if inside != bool(pl.inside):
			pl.inside = inside
			for sm in pl.mats:
				(sm as ShaderMaterial).set_shader_parameter("cut_y", float(pl.fy) + 1.25 if inside else 10000.0)
			# кресла рисуются только пока салон виден (в закрытом самолёте их не видно, а треугольников — 95 тыс.)
			for sn in pl.get("seats", []):
				(sn as Node3D).visible = inside


## в каком самолёте герой (−1 — ни в каком)
func plane_at(p: Vector3) -> int:
	for i in planes.size():
		var pl: Dictionary = planes[i]
		if not bool(pl.walk):
			continue
		var l: Vector3 = (pl.xf as Transform3D).affine_inverse() * p
		if (pl.cab as Rect2).grow(0.2).has_point(Vector2(l.x, l.z)) and p.y > float(pl.fy) - 0.7:
			return i
	return -1


## телескопические трапы у южной стены терминала: галерея на опоре (под ней можно пройти), столкновение — опора
func _a_bridges(g: Node3D) -> void:
	for bx in [[-52.0, -58.0], [16.0, -53.0], [40.0, -58.0], [70.0, -58.0]]:
		var at := Vector3(float(bx[0]), 0, float(bx[1]) + 8.0)
		if ResourceLoader.exists(MODELS + "ap_jetbridge.glb"):
			_pm("ap_jetbridge", at, PI * 0.5, 15.0, false, true, Color(0.84, 0.82, 0.78))
		else:
			_bx(g, "a_trim", Vector3(2.6, 2.6, 15.0), _at(at + Vector3(0, 4.6, 0)))
		_col_xf(Vector3(1.2, 4.0, 1.2), _at(at + Vector3(0, 2.0, 6.4)))
	gate_pt = Vector3(16.0, 0, -47.0)


# ---------------- техника, штабеля ----------------

func _a_things() -> void:
	var tints := [Color(0.82, 0.8, 0.76), Color(0.62, 0.66, 0.72), Color(0.74, 0.6, 0.52), Color(0.6, 0.68, 0.6), Color(0.86, 0.84, 0.72)]
	var k := 0
	for t in A_THINGS:
		var at: Vector3 = t[1]
		var id := String(t[0])
		if not ResourceLoader.exists(MODELS + id + ".glb"):
			continue
		var tall := id in ["qr_radiotower", "ap_airstairs"]
		var tint: Color = tints[k % tints.size()] if id in ["ul_car", "ul_bus", "ul_uaz"] else Color(0.82, 0.8, 0.76)
		k += 1
		var size := _pm(id, at, float(t[2]), float(t[3]), not tall, true, tint, false, id + ("_%d" % (k % tints.size())) if id in ["ul_car", "ul_bus", "ul_uaz"] else "")
		if float(t[3]) < 6.0 and get_child_count() > 0:
			_cull(get_child(get_child_count() - 1), 110.0)
		if tall:
			_cyl_col(at, 1.3, 3.0)
			size = Vector3(1.4, 1.8, 1.4)
		if String(t[4]) != "":
			_p_stash(at, size, float(t[2]), String(t[4]), String(t[5]))


func _a_piles(rng: RandomNumberGenerator) -> void:
	var models := {"crate": [["ul_crate", 1.1], ["ph_crate", 1.0], ["ul_army_crate", 1.2]], "pallet": [["qr_pallets", 1.3]], "barrel": [["ph_barrel", 0.75], ["gr_barrels", 1.6]]}
	var names := {"crate": "Грузовой ящик", "pallet": "Паллета с грузом", "barrel": "Бочки"}
	for pl in A_PILES:
		var c := Vector3(float(pl[0]), 0, float(pl[1]))
		var kinds: Array = models[String(pl[3])]
		for i in int(pl[2]):
			var m: Array = kinds[rng.randi() % kinds.size()]
			var p := c + Vector3((i % 2) * 1.5 - 0.7 + rng.randf_range(-0.15, 0.15), 0, (i / 2) * 1.5 + rng.randf_range(-0.15, 0.15))
			if not in_field(Vector2(p.x, p.z)) or bld_dist(Vector2(p.x, p.z)) < 0.8:
				continue
			var sz := _pm(String(m[0]), p, rng.randf() * TAU, float(m[1]), true)
			if i == 0 and bool(pl[4]):
				_p_stash(p, sz, 0.0, String(pl[3]), String(names[String(pl[3])]))


# ---------------- обстановка зданий ----------------

## предмет обстановки в постройке: модель в группе этажа (скрывается вместе с интерьером) и коробка-преграда
func _a_item(b: ULBlock, id: String, p: Vector3, yaw: float, sz: Vector3, grp := "b0/n0", col := true) -> bool:
	if not ResourceLoader.exists(MODELS + id + ".glb"):
		return false
	# sz — (длинная сторона, высота, короткая). Модель вписывается в место по своим осям X и Z: если у неё длинная
	# сторона идёт по Z, место задаётся повёрнутым на четверть
	if sz.x >= sz.z == _p_long_x(MODELS + id + ".glb"):
		b.models.append([id, p, yaw, sz, grp, 0.0])
	else:
		b.models.append([id, p, yaw + PI * 0.5, Vector3(sz.z, sz.y, sz.x), grp, 0.0])
	if col:
		_col_xf(Vector3(sz.x * 0.9, sz.y, sz.z * 0.9), Transform3D(Basis(Vector3.UP, yaw), Vector3(p.x, p.y + sz.y * 0.5, p.z)))
	return true


## Зал терминала (60 × 27 м, вход с севера): у входа — стойка информации и ряды кресел зала ожидания; на западе —
## стойки регистрации в ряд; на востоке — досмотр (сканеры с рамками) перед дверью в посадочное крыло; багаж.
func _a_term(b: ULBlock) -> void:
	var y := 0.2
	# стойки регистрации: шесть в ряд вдоль западной части зала, лицом на восток
	for i in 6:
		_a_item(b, "ap_checkin", Vector3(-21.0, y, -84.0 + i * 3.4), PI * 0.5, Vector3(2.6, 1.3, 2.0))
	_p_stash(Vector3(-19.0, y, -75.5), Vector3(1.2, 1.2, 1.2), 0.0, "checkin", "Стойка регистрации")
	# стойка информации у входа — сведения о рейсе (задание)
	var info := Vector3(0.0, y, -79.5)
	if not _a_item(b, "ap_checkin", info, 0.0, Vector3(2.6, 1.3, 2.0)):
		_a_item(b, "kh_counter", info, 0.0, Vector3(2.4, 1.1, 0.8))
	quest_stash["a_flight"] = _p_stash(info + Vector3(0, 0, 1.6), Vector3(1.6, 1.2, 1.0), 0.0, "info_desk", "Стойка информации")
	# зал ожидания: ряды кресел спинка к спинке
	for r in 4:
		for c in 3:
			var p := Vector3(-9.0 + c * 6.0, y, -74.0 + r * 3.0)
			if absf(p.x) < 2.0 and p.z < -76.0:
				continue
			_a_item(b, "ap_seats", p, 0.0 if r % 2 == 0 else PI, Vector3(2.6, 0.95, 0.75))
	# досмотр: два сканера с рамками перед восточной дверью
	_a_item(b, "ap_scanner", Vector3(22.5, y, -70.0), 0.0, Vector3(3.2, 2.0, 1.8))
	_a_item(b, "ap_scanner", Vector3(22.5, y, -62.0), 0.0, Vector3(3.2, 2.0, 1.8))
	_p_stash(Vector3(20.0, y, -70.0), Vector3(1.0, 1.2, 1.0), 0.0, "security", "Лоток досмотра")
	# брошенный багаж
	_a_item(b, "ap_luggage", Vector3(-12.0, y, -84.5), 0.4, Vector3(2.2, 0.9, 1.8))
	_p_stash(Vector3(-12.0, y, -84.5), Vector3(2.0, 0.9, 1.6), 0.4, "luggage", "Брошенный багаж")
	_a_item(b, "ap_luggage", Vector3(12.0, y, -80.0), 2.2, Vector3(2.2, 0.9, 1.8))
	_p_stash(Vector3(12.0, y, -80.0), Vector3(2.0, 0.9, 1.6), 2.2, "luggage", "Брошенный багаж")
	_a_item(b, "sn_bench", Vector3(26.0, y, -84.0), PI * 0.5, Vector3(1.8, 0.9, 0.6))
	_a_item(b, "ph_trash", Vector3(-27.5, y, -62.5), 0.0, Vector3(0.6, 0.8, 0.6))


## Багажное крыло: в зале выдачи — багажная лента и тележки
func _a_wing_w(b: ULBlock) -> void:
	var y := 0.2
	_a_item(b, "ap_carousel", Vector3(-50.0, y, -69.5), 0.0, Vector3(8.0, 1.0, 3.2))
	_p_stash(Vector3(-50.0, y, -66.6), Vector3(2.0, 1.0, 1.0), 0.0, "luggage", "Багажная лента")
	_a_item(b, "ap_luggage", Vector3(-45.5, y, -62.0), 1.0, Vector3(2.0, 0.9, 1.6))
	_p_stash(Vector3(-45.5, y, -62.0), Vector3(1.8, 0.9, 1.4), 1.0, "luggage", "Невостребованный багаж")


## Посадочное крыло: в зале ожидания у выходов — кресла
func _a_wing_e(b: ULBlock) -> void:
	var y := 0.2
	for i in 3:
		_a_item(b, "ap_seats", Vector3(46.5 + i * 3.4, y, -70.5), 0.0, Vector3(2.6, 0.95, 0.75))
	_a_item(b, "ap_luggage", Vector3(54.5, y, -62.5), 0.3, Vector3(1.8, 0.8, 1.4))


## Вышка: на уровнях — шкафы связи и ящики, наверху — кабина диспетчеров (пульты, мониторы, радио)
func _a_tower(b: ULBlock) -> void:
	var st := 3.4
	var cx := -24.0
	var cz := -103.0
	# свободная часть этажа — восточная (лестница — в западной): x от cx + 1.2 до cx + 6.6
	_a_item(b, "qr_transformer", Vector3(cx + 5.6, 0.2, cz - 2.6), PI * 0.5, Vector3(1.0, 1.8, 2.0))
	_p_stash(Vector3(cx + 5.6, 0.2, cz - 2.6), Vector3(1.0, 1.8, 2.0), PI * 0.5, "tech", "Щит питания вышки")
	_a_item(b, "gr_cabinet", Vector3(cx + 5.9, st + 0.02, cz + 2.8), -PI * 0.5, Vector3(1.0, 1.9, 0.5), "b0/n1")
	_p_stash(Vector3(cx + 5.9, st, cz + 2.8), Vector3(1.0, 1.9, 0.5), -PI * 0.5, "tool", "Шкаф связиста")
	_a_item(b, "cv_radio", Vector3(cx + 5.8, st * 2.0 + 0.02, cz - 2.8), PI * 0.5, Vector3(1.0, 1.1, 0.6), "b0/n2")
	_p_stash(Vector3(cx + 5.8, st * 2.0, cz - 2.8), Vector3(1.0, 1.1, 0.6), PI * 0.5, "electronics", "Стойка радиосвязи")
	# кабина диспетчеров (четвёртый уровень): пульты вдоль восточной и южной стен, шкаф, радио
	var y3 := st * 3.0 + 0.02
	_a_item(b, "gr_terminal", Vector3(cx + 5.9, y3, cz - 1.6), -PI * 0.5, Vector3(1.4, 1.3, 0.8), "b0/n3")
	_a_item(b, "gr_terminal", Vector3(cx + 5.9, y3, cz + 1.4), -PI * 0.5, Vector3(1.4, 1.3, 0.8), "b0/n3")
	_a_item(b, "ul_computer", Vector3(cx + 3.2, y3, cz + 3.4), PI, Vector3(1.4, 1.2, 0.7), "b0/n3")
	_a_item(b, "cv_radio", Vector3(cx + 3.0, y3, cz - 3.4), 0.0, Vector3(1.0, 1.1, 0.6), "b0/n3")
	_a_item(b, "ph_chair", Vector3(cx + 4.6, y3, cz - 1.4), PI * 0.5, Vector3(0.55, 0.9, 0.55), "b0/n3", false)
	_a_item(b, "ph_chair", Vector3(cx + 4.6, y3, cz + 1.5), PI * 0.5, Vector3(0.55, 0.9, 0.55), "b0/n3", false)
	_p_stash(Vector3(cx + 5.9, st * 3.0, cz - 1.6), Vector3(1.4, 1.3, 0.8), -PI * 0.5, "electronics", "Пульт диспетчера")
	_p_stash(Vector3(cx + 3.0, st * 3.0, cz - 3.4), Vector3(1.0, 1.1, 0.6), 0.0, "electronics", "Радиостанция вышки")
	_p_stash(Vector3(cx + 3.2, st * 3.0, cz + 3.4), Vector3(1.4, 1.2, 0.7), PI, "tech", "Стол руководителя полётов")
	# снаружи: балкон-галерея вокруг кабины (на уровне её пола), перила, мачта антенны у угла
	var g := Node3D.new()
	g.name = "TowerTrim"
	add_child(g)
	var by := st * 3.0 - 0.1
	var hl := 7.0
	var hw := 4.2
	for sgn in [-1.0, 1.0]:
		_bx(g, "concrete", Vector3(hl * 2.0 + 2.4, 0.22, 1.2), _at(Vector3(cx, by, cz + float(sgn) * (hw + 0.6))))
		_bx(g, "concrete", Vector3(1.2, 0.22, hw * 2.0), _at(Vector3(cx + float(sgn) * (hl + 0.6), by, cz)))
		_bx(g, "rust", Vector3(hl * 2.0 + 2.4, 0.06, 0.06), _at(Vector3(cx, by + 1.1, cz + float(sgn) * (hw + 1.15))))
		_bx(g, "rust", Vector3(0.06, 0.06, hw * 2.0 + 2.3), _at(Vector3(cx + float(sgn) * (hl + 1.15), by + 1.1, cz)))
		for k in 7:
			_bx(g, "rust", Vector3(0.05, 1.0, 0.05), _at(Vector3(cx - hl - 1.0 + k * (hl * 2.0 + 2.0) / 6.0, by + 0.6, cz + float(sgn) * (hw + 1.15))))
	_cy(g, "rust", 0.09, 0.14, 9.0, _at(Vector3(cx + hl + 0.9, st * 4.0 + 4.0, cz - hw - 0.9)), 8)
	_bx(g, "concrete", Vector3(0.5, st * 4.0, 0.5), _at(Vector3(cx + hl + 0.9, st * 2.0, cz - hw - 0.9)))
	_bx(g, "a_white", Vector3(1.6, 0.9, 0.3), _at(Vector3(cx + hl + 0.9, st * 4.0 + 6.4, cz - hw - 0.9), 0.6))
	_flush(g)


## Ангар № 1 (зал 40 × 30 м): самолёт на обслуживании, ремонтные платформы, верстаки, инструменты, тележки
func _a_hangar1(b: ULBlock) -> void:
	var y := 0.2
	_a_item(b, "ap_platform", Vector3(113, y, -55), 0.0, Vector3(3.2, 3.0, 2.0))
	_a_item(b, "ap_platform", Vector3(131, y, -71), PI, Vector3(3.2, 3.0, 2.0))
	_a_item(b, "gr_workbench", Vector3(104, y, -74.5), 0.0, Vector3(2.4, 1.0, 0.9))
	_a_item(b, "gr_upbench", Vector3(108, y, -74.6), 0.0, Vector3(2.6, 1.6, 1.0))
	_a_item(b, "gr_toolchest", Vector3(112, y, -74.6), 0.0, Vector3(1.2, 1.1, 0.6))
	_p_stash(Vector3(112, y, -74.6), Vector3(1.2, 1.1, 0.6), 0.0, "tool", "Инструментальная тележка")
	_a_item(b, "gr_cabinet", Vector3(140, y, -74.8), 0.0, Vector3(1.0, 1.9, 0.5))
	_p_stash(Vector3(140, y, -74.8), Vector3(1.0, 1.9, 0.5), 0.0, "tool", "Металлический шкаф")
	_a_item(b, "gr_shelf", Vector3(136, y, -74.8), 0.0, Vector3(2.4, 2.2, 0.7))
	_a_item(b, "gr_pegboard", Vector3(103.0, y + 0.8, -66), PI * 0.5, Vector3(2.4, 1.6, 0.2), "b0/n0", false)
	_a_item(b, "gr_tyres", Vector3(139, y, -52), 0.3, Vector3(1.6, 1.2, 1.6))
	_a_item(b, "gr_jack", Vector3(117, y, -66), 0.0, Vector3(0.8, 0.6, 0.8))
	_a_item(b, "gr_barrels", Vector3(105, y, -52), 0.6, Vector3(1.8, 1.0, 1.8))


## Ангар № 2: запасные двигатели, крылья и обшивка, подъёмник, грузовые ящики
func _a_hangar2(b: ULBlock) -> void:
	var y := 0.2
	_a_item(b, "ap_engine", Vector3(158, y, -58), 0.3, Vector3(3.4, 2.2, 2.0))
	_p_stash(Vector3(158, y, -58), Vector3(3.4, 2.2, 2.0), 0.3, "parts", "Запасной двигатель")
	_a_item(b, "ap_engine", Vector3(166, y, -70), 1.4, Vector3(3.4, 2.2, 2.0))
	_a_item(b, "ap_wing", Vector3(176, y, -60), 1.57, Vector3(9.0, 1.4, 4.0))
	_p_stash(Vector3(171.5, y, -60), Vector3(1.2, 1.4, 3.0), 0.0, "parts", "Крыло и обшивка")
	_a_item(b, "gr_hoist", Vector3(160, y, -66), 0.0, Vector3(2.0, 2.8, 1.6))
	_a_item(b, "gr_engstand", Vector3(152, y, -72), 0.0, Vector3(1.6, 1.4, 1.2))
	_a_item(b, "gr_shelf2", Vector3(182, y, -74.8), 0.0, Vector3(2.4, 2.2, 0.7))
	_a_item(b, "gr_parts", Vector3(178, y, -74.4), 0.0, Vector3(1.6, 1.0, 1.0))
	_p_stash(Vector3(178, y, -74.4), Vector3(1.6, 1.0, 1.0), 0.0, "parts", "Ящик авиазапчастей")
	_a_item(b, "ul_crate", Vector3(150, y, -52), 0.2, Vector3(1.1, 0.9, 1.1))
	_a_item(b, "qr_pallets", Vector3(153, y, -52.4), 0.0, Vector3(1.3, 1.2, 1.3))
	_a_item(b, "ul_army_crate", Vector3(185, y, -54), 1.2, Vector3(1.2, 0.6, 0.8))
	_p_stash(Vector3(185, y, -54), Vector3(1.2, 0.6, 0.8), 1.2, "crate", "Грузовой ящик")
	_a_item(b, "ap_platform", Vector3(184, y, -66), PI * 0.5, Vector3(3.2, 3.0, 2.0))
	_a_item(b, "gr_welder", Vector3(150, y, -62), 0.0, Vector3(1.2, 1.3, 1.0))


# ---------------- враги ----------------

func _a_spots(rng: RandomNumberGenerator) -> void:
	for k in 2600:
		var q := Vector2(rng.randf_range(-A_FX + 4.0, A_FX - 4.0), rng.randf_range(A_FN + 4.0, A_FS - 4.0))
		if bld_dist(q) < 1.4:
			continue
		var tag := "field"
		if A_FUEL.grow(-1.5).has_point(q):
			tag = "fuel"
		elif CARGO_YARD.grow(-1.0).has_point(q):
			tag = "cargo_yard"
		elif APRON.has_point(q):
			tag = "apron"
		elif q.y > 88.0:
			tag = "parking" if absf(q.x) < 84.0 else "south"
		elif RWY.grow(4.0).has_point(q):
			tag = "runway"
		elif TWY.grow(2.0).has_point(q):
			tag = "taxiway"
		elif q.y < -88.0:
			tag = "north"
		elif q.x < -142.0:
			tag = "west"
		elif q.x > 100.0:
			tag = "hangar_yard"
		yard_pts.append(Vector3(q.x, 0, q.y))
		_yard_tags.append(tag)
