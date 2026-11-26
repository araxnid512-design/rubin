class_name ULExternalsDeep
extends ULExternals
## Подземный комплекс Базы Внешников: три этажа по планам пользователя (26.11). Каждый этаж — отдельное место
## («externals_f1…3») со своей картой проходимости и своим состоянием посещения; между этажами и поверхностью возит
## лифт (посередине каждого этажа, там же, где на поверхности). Этаж — одно «здание» генератора корпусов из
## прямоугольных помещений с проходами между ними; дверей нет — при открытом комплексе все двери открыты.
##
## Этаж 1 — жилые и военные помещения: кухня, столовая, душевая, туалеты, медпункт, казармы A и B, комната связи,
## оружейная, склад личных вещей, комнаты офицеров A–D, пост охраны.
## Этаж 2 — лаборатория заражённых: карантинные камеры, обеззараживающий шлюз, морозильное и химическое хранилища,
## лаборатория анализа, исследовательская лаборатория, серверная, комната наблюдения, боксы с образцами,
## операционная, капсулы с образцами, склад контейнеров.
## Этаж 3 — экспериментальный сектор, командный пункт наблюдения, реактор, зал капсул, генераторная, зал «высокая
## опасность», биолаборатория, кладовые.
##
## Чего здесь нет (по заданию создаётся отдельно): турелей, босса, выдачи ящиков. Заражённых в капсулах и боксах
## нет — стекло тёмное, внутри только силуэт-заглушка. Поясняющих надписей в мире нет.

const DH_ := 45.0                       ## половина поля этажа (само здание — 72 × 72 м)

## Помещения этажей: [название, тип помещения генератора, x0, z0, x1, z1]. Порядок важен — на номера ссылаются
## обстановка (D_FURN), посты (D_POSTS) и проходы. Тип «cor» — пустой зал с плиточным полом (обстановка — своя).
const D_ROOMS := {
	1: [
		["Лифтовой зал", "cor", -14, -15, 14, 15], ["Северный коридор", "cor", -36, -21, 36, -15], ["Южный коридор", "cor", -36, 15, 36, 21],
		["Кухня", "kitchen", -36, -36, -24, -21], ["Столовая", "dining", -24, -36, 0, -21], ["Душевая", "wc", 0, -36, 11, -21],
		["Туалеты", "wc", 11, -36, 20, -21], ["Медпункт", "proc", 20, -36, 36, -21], ["Казарма A", "m_bunk", -36, -15, -14, 0],
		["Казарма B", "m_bunk", -36, 0, -14, 15], ["Комната связи", "m_radio", 14, -15, 36, -6], ["Оружейная", "cor", 14, -6, 36, 5],
		["Склад личных вещей", "cor", 14, 5, 36, 15], ["Комната офицеров A", "m_quarters", -36, 21, -24, 36], ["Комната офицеров B", "m_quarters", -24, 21, -12, 36],
		["Пост охраны", "guard", -9, 21, 9, 33], ["Комната офицеров C", "m_quarters", 12, 21, 24, 36], ["Комната офицеров D", "m_quarters", 24, 21, 36, 36],
	],
	2: [
		["Лифтовой зал", "cor", -14, -10, 14, 10], ["Северный коридор", "cor", -36, -26, 36, -21], ["Южный коридор", "cor", -36, 10, 36, 15],
		["Проход к лифту", "cor", -3, -21, 3, -10], ["Морозильное хранилище биоматериала", "cor", -36, -36, -20, -26], ["Карантинные камеры", "cor", -20, -36, 20, -26],
		["Обеззараживающий шлюз", "cor", 20, -36, 36, -26], ["Химическое хранилище", "cor", -36, -21, -20, -10], ["Лаборатория анализа", "proc", -20, -21, -3, -10],
		["Исследовательская лаборатория", "proc", 3, -21, 21, -10], ["Серверная", "cor", 21, -21, 36, -10], ["Боксы с заражёнными образцами", "cor", -36, -10, -14, 10],
		["Комната наблюдения", "cor", 14, -10, 36, 10], ["Операционная", "proc", -36, 15, -14, 36], ["Капсулы с образцами", "cor", -14, 15, 14, 36],
		["Склад контейнеров и образцов", "cor", 14, 15, 36, 36],
	],
	3: [
		["Лифтовой зал", "cor", -12, -12, 12, 12], ["Экспериментальный сектор", "cor", -18, -36, 18, -12], ["Командный пункт наблюдения", "cor", -36, -36, -18, -18],
		["Реактор", "cor", 18, -36, 36, -12], ["Западный коридор", "cor", -36, -18, -18, -12], ["Зал капсул", "cor", -36, -12, -12, 8],
		["Генераторная", "cor", 12, -12, 36, 8], ["Юго-западный коридор", "cor", -36, 8, -12, 13], ["Юго-восточный коридор", "cor", 12, 8, 36, 13],
		["Зал «Высокая опасность»", "cor", -12, 12, 12, 36], ["Кладовая", "cor", -36, 13, -24, 36], ["Техническая", "cor", -24, 13, -12, 36],
		["Биолаборатория", "proc", 12, 13, 36, 36],
	],
}

## проходы в общих стенах помещений (1,4 м; широкие проходы — два рядом)
const D_LINKS := {
	1: [Vector2(-6, -15), Vector2(6, -15), Vector2(-6, 15), Vector2(6, 15), Vector2(-14, -7.5), Vector2(-14, 7.5), Vector2(14, -10.5), Vector2(14, -0.5),
		Vector2(14, 10), Vector2(-30, -21), Vector2(-12, -21), Vector2(-24, -28.5), Vector2(5.5, -21), Vector2(15.5, -21), Vector2(28, -21), Vector2(-25, -15),
		Vector2(25, -15), Vector2(-25, 15), Vector2(25, 15), Vector2(-30, 21), Vector2(-18, 21), Vector2(0, 21), Vector2(18, 21), Vector2(30, 21)],
	2: [Vector2(-28, -26), Vector2(-10, -26), Vector2(10, -26), Vector2(28, -26), Vector2(-28, -21), Vector2(-11.5, -21), Vector2(0, -21), Vector2(12, -21),
		Vector2(28.5, -21), Vector2(0, -10), Vector2(-3, -15.5), Vector2(3, -15.5), Vector2(-14, 0), Vector2(14, 0), Vector2(-6, 10), Vector2(6, 10),
		Vector2(-25, 10), Vector2(25, 10), Vector2(-25, 15), Vector2(-3, 15), Vector2(3, 15), Vector2(25, 15), Vector2(21, -15.5)],
	3: [Vector2(-3, -12), Vector2(3, -12), Vector2(-12, -2), Vector2(12, -2), Vector2(-3, 12), Vector2(3, 12), Vector2(18, -24), Vector2(-18, -13.6),
		Vector2(-27, -18), Vector2(-27, -12), Vector2(-24, 8), Vector2(24, 8), Vector2(27, -12), Vector2(-30, 13), Vector2(-18, 13), Vector2(24, 13),
		Vector2(-12, 24), Vector2(12, 24)],
}

## Обстановка-модели: [модель, помещение, где, поворот, размер]. Стоит на полу помещения, скрывается вместе с ним.
const D_FURN := {
	1: [
		# оружейная: стойки с оружием и патронные полки вдоль северной стены, прилавок, ящики
		["ul_gun_rack", 11, Vector3(18.0, 0, -5.0), 0.0, Vector3(2.4, 2.0, 0.6)], ["ul_gun_rack", 11, Vector3(21.5, 0, -5.0), 0.0, Vector3(2.4, 2.0, 0.6)],
		["ul_gun_rack", 11, Vector3(25.0, 0, -5.0), 0.0, Vector3(2.4, 2.0, 0.6)], ["ul_ammo_shelf", 11, Vector3(29.0, 0, -5.0), 0.0, Vector3(2.2, 2.0, 0.7)],
		["ul_ammo_shelf", 11, Vector3(32.5, 0, -5.0), 0.0, Vector3(2.2, 2.0, 0.7)], ["ul_gun_counter", 11, Vector3(26.0, 0, 1.5), 0.0, Vector3(3.2, 1.1, 1.0)],
		["ul_army_crate", 11, Vector3(18.0, 0, 3.6), 0.2, Vector3(1.3, 0.8, 0.9)], ["ul_army_crate", 11, Vector3(33.5, 0, 3.4), -0.3, Vector3(1.3, 0.8, 0.9)],
		# склад личных вещей: стеллажи, шкафы, ящики
		["gr_shelf", 12, Vector3(18.0, 0, 6.0), 0.0, Vector3(2.4, 2.2, 0.7)], ["gr_shelf2", 12, Vector3(21.5, 0, 6.0), 0.0, Vector3(2.4, 2.2, 0.7)],
		["gr_shelf", 12, Vector3(28.0, 0, 6.0), 0.0, Vector3(2.4, 2.2, 0.7)], ["gr_cabinet", 12, Vector3(32.0, 0, 6.0), 0.0, Vector3(1.2, 1.9, 0.6)],
		["gr_cabinet", 12, Vector3(33.6, 0, 6.0), 0.0, Vector3(1.2, 1.9, 0.6)], ["ul_crate", 12, Vector3(19.0, 0, 13.4), 0.4, Vector3(1.1, 0.9, 1.1)],
		["ul_army_crate", 12, Vector3(30.0, 0, 13.6), 0.0, Vector3(1.3, 0.8, 0.9)], ["ul_army_crate", 12, Vector3(32.0, 0, 13.5), 0.2, Vector3(1.3, 0.8, 0.9)],
		# пост охраны: пульт с компьютерами
		["ul_computer", 15, Vector3(-3.0, 0, 31.6), PI, Vector3(1.8, 1.4, 0.9)], ["ul_computer", 15, Vector3(3.0, 0, 31.6), PI, Vector3(1.8, 1.4, 0.9)],
		["gr_cabinet", 15, Vector3(-7.6, 0, 27.0), PI * 0.5, Vector3(1.2, 1.9, 0.6)],
		# комната связи: аппаратура
		["hm_rack", 10, Vector3(31.0, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 10, Vector3(32.4, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)],
		["hm_rack", 10, Vector3(33.8, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["ul_computer", 10, Vector3(22.0, 0, -7.2), PI, Vector3(1.8, 1.4, 0.9)],
		# лифтовой зал: ящики по углам (укрытия)
		["ul_army_crate", 0, Vector3(-11.5, 0, -12.5), 0.3, Vector3(1.3, 0.8, 0.9)], ["ul_crate", 0, Vector3(11.5, 0, -12.5), 0.0, Vector3(1.1, 0.9, 1.1)],
		["ul_crate", 0, Vector3(-11.5, 0, 12.5), 0.6, Vector3(1.1, 0.9, 1.1)], ["ul_army_crate", 0, Vector3(11.5, 0, 12.5), 0.0, Vector3(1.3, 0.8, 0.9)],
	],
	2: [
		# серверная: два ряда стоек
		["hm_rack", 10, Vector3(24.0, 0, -19.8), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 10, Vector3(25.4, 0, -19.8), 0.0, Vector3(1.0, 2.0, 0.8)],
		["hm_rack", 10, Vector3(31.6, 0, -19.8), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 10, Vector3(33.0, 0, -19.8), 0.0, Vector3(1.0, 2.0, 0.8)],
		["hm_rack", 10, Vector3(26.0, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 10, Vector3(27.4, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)],
		["hm_rack", 10, Vector3(31.0, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)], ["hm_rack", 10, Vector3(32.4, 0, -14.0), 0.0, Vector3(1.0, 2.0, 0.8)],
		# комната наблюдения: пульты с экранами
		["ul_computer", 12, Vector3(20.0, 0, -8.6), 0.0, Vector3(1.8, 1.4, 0.9)], ["ul_computer", 12, Vector3(25.0, 0, -8.6), 0.0, Vector3(1.8, 1.4, 0.9)],
		["ul_computer", 12, Vector3(30.0, 0, -8.6), 0.0, Vector3(1.8, 1.4, 0.9)], ["ul_computer", 12, Vector3(34.4, 0, -2.0), -PI * 0.5, Vector3(1.8, 1.4, 0.9)],
		["ul_computer", 12, Vector3(34.4, 0, 4.0), -PI * 0.5, Vector3(1.8, 1.4, 0.9)], ["gr_cabinet", 12, Vector3(20.0, 0, 8.8), PI, Vector3(1.2, 1.9, 0.6)],
		# морозильное хранилище: шкафы-морозильники
		["gr_cabinet", 4, Vector3(-34.0, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)], ["gr_cabinet", 4, Vector3(-32.4, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)],
		["gr_cabinet", 4, Vector3(-30.8, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)], ["gr_cabinet", 4, Vector3(-25.0, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)],
		["gr_cabinet", 4, Vector3(-23.4, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)], ["ul_army_crate", 4, Vector3(-33.5, 0, -28.0), 0.0, Vector3(1.3, 0.8, 0.9)],
		# химическое хранилище: бочки, кубовые ёмкости, шкафы
		["gr_barrels", 7, Vector3(-33.5, 0, -19.0), 0.3, Vector3(1.6, 1.0, 1.6)], ["gr_barrels", 7, Vector3(-33.5, 0, -12.0), 1.0, Vector3(1.6, 1.0, 1.6)],
		["qr_ibc", 7, Vector3(-30.0, 0, -11.6), 0.0, Vector3(1.2, 1.2, 1.0)], ["qr_ibc", 7, Vector3(-28.4, 0, -11.6), 0.0, Vector3(1.2, 1.2, 1.0)],
		["gr_cabinet", 7, Vector3(-22.0, 0, -11.2), PI, Vector3(1.2, 1.9, 0.6)], ["gr_shelf", 7, Vector3(-24.5, 0, -19.9), 0.0, Vector3(2.4, 2.2, 0.7)],
		# склад контейнеров и образцов
		["pt_container", 15, Vector3(31.5, 0, 22.0), PI * 0.5, Vector3(6.0, 2.6, 2.5)], ["ul_army_crate", 15, Vector3(18.0, 0, 18.0), 0.0, Vector3(1.3, 0.8, 0.9)],
		["ul_army_crate", 15, Vector3(20.0, 0, 18.0), 0.2, Vector3(1.3, 0.8, 0.9)], ["ul_crate", 15, Vector3(18.0, 0, 24.0), 0.0, Vector3(1.1, 0.9, 1.1)],
		["ul_crate", 15, Vector3(19.6, 0, 24.2), 0.5, Vector3(1.1, 0.9, 1.1)], ["qr_pallets", 15, Vector3(24.5, 0, 28.0), 0.0, Vector3(1.3, 1.2, 1.3)],
		["qr_pallets", 15, Vector3(24.5, 0, 31.0), 0.3, Vector3(1.3, 1.2, 1.3)], ["gr_barrels", 15, Vector3(17.5, 0, 33.5), 0.0, Vector3(1.6, 1.0, 1.6)],
		["gr_shelf", 15, Vector3(26.0, 0, 34.8), PI, Vector3(2.4, 2.2, 0.7)], ["gr_shelf2", 15, Vector3(31.0, 0, 34.8), PI, Vector3(2.4, 2.2, 0.7)],
		# операционная: каталка посередине
		["cv_stretcher", 13, Vector3(-25.0, 0, 26.0), 0.0, Vector3(2.0, 0.6, 0.7)],
	],
	3: [
		# командный пункт наблюдения: пульты дугой
		["ul_computer", 2, Vector3(-30.0, 0, -29.0), 0.5, Vector3(1.8, 1.4, 0.9)], ["ul_computer", 2, Vector3(-27.0, 0, -30.0), 0.0, Vector3(1.8, 1.4, 0.9)],
		["ul_computer", 2, Vector3(-24.0, 0, -29.0), -0.5, Vector3(1.8, 1.4, 0.9)], ["hm_rack", 2, Vector3(-34.6, 0, -34.6), 0.0, Vector3(1.0, 2.0, 0.8)],
		["hm_rack", 2, Vector3(-33.2, 0, -34.6), 0.0, Vector3(1.0, 2.0, 0.8)], ["gr_cabinet", 2, Vector3(-20.0, 0, -34.8), 0.0, Vector3(1.2, 1.9, 0.6)],
		# генераторная: три генератора, трансформаторы
		["hm_generator", 6, Vector3(27.0, 0, -8.0), 0.0, Vector3(2.6, 1.7, 1.5)], ["hm_generator", 6, Vector3(27.0, 0, -2.5), 0.0, Vector3(2.6, 1.7, 1.5)],
		["hm_generator", 6, Vector3(27.0, 0, 3.0), 0.0, Vector3(2.6, 1.7, 1.5)], ["qr_transformer", 6, Vector3(33.5, 0, -9.0), PI * 0.5, Vector3(2.2, 2.0, 1.4)],
		["qr_transformer", 6, Vector3(33.5, 0, 4.5), PI * 0.5, Vector3(2.2, 2.0, 1.4)], ["gr_cabinet", 6, Vector3(16.0, 0, 6.8), PI, Vector3(1.2, 1.9, 0.6)],
		# кладовая и техническая
		["ul_army_crate", 10, Vector3(-33.5, 0, 20.0), 0.0, Vector3(1.3, 0.8, 0.9)], ["ul_army_crate", 10, Vector3(-33.5, 0, 22.0), 0.1, Vector3(1.3, 0.8, 0.9)],
		["gr_shelf", 10, Vector3(-30.0, 0, 34.8), PI, Vector3(2.4, 2.2, 0.7)], ["ul_crate", 10, Vector3(-27.0, 0, 30.0), 0.4, Vector3(1.1, 0.9, 1.1)],
		["hm_generator", 11, Vector3(-18.0, 0, 30.0), PI * 0.5, Vector3(2.6, 1.7, 1.5)], ["gr_toolchest", 11, Vector3(-21.5, 0, 34.6), PI, Vector3(1.4, 1.1, 0.7)],
		["gr_cabinet", 11, Vector3(-14.0, 0, 34.8), PI, Vector3(1.2, 1.9, 0.6)],
		# зал «Высокая опасность»: мешки с песком — укрытия охраны
		["cv_sandbags", 9, Vector3(-5.0, 0, 20.0), 0.0, Vector3(3.0, 1.0, 0.9)], ["cv_sandbags", 9, Vector3(5.0, 0, 20.0), 0.0, Vector3(3.0, 1.0, 0.9)],
		["cv_sandbags", 9, Vector3(0.0, 0, 30.0), 0.0, Vector3(3.0, 1.0, 0.9)],
	],
}

## посты: в каких помещениях стоят снайперы (длинные залы и коридоры) и Титаны (проходы и ключевые залы)
const D_POSTS := {
	1: {"ext_sniper": [], "ext_titan": [1, 2, 11, 15], "ext_assault": [3, 4, 7, 8, 8, 9, 9, 10, 11, 12, 13, 14, 15, 16, 17, 1, 2, 4, 8, 9]},
	2: {"ext_sniper": [1, 2, 5, 11, 14], "ext_titan": [3, 9, 12, 14, 15], "ext_assault": [4, 6, 7, 8, 9, 10, 11, 12, 13, 13, 15, 15, 1, 2]},
	3: {"ext_sniper": [1, 1, 9, 5, 6], "ext_titan": [1, 1, 3, 9, 9, 2, 5], "ext_assault": [2, 3, 5, 6, 12, 10, 11, 4, 7, 8]},
}

static var _ugcfg := {}


static func nav_of(lv: int) -> String:
	return "res://assets/world/nav_externals_f%d.res" % lv


func conf() -> Dictionary:
	if not _ugcfg.has(level):
		var d := xcfg().duplicate(true)
		d["size"] = DH_ * 2.0
		d["size_z"] = DH_ * 2.0
		d["blood"] = 0
		d["junk_per_building"] = [0, 0]
		d["junk_at_vehicles"] = [0, 0]
		_ugcfg[level] = d
	return _ugcfg[level]


func entry() -> Vector3:
	return X_LIFT_IN


func title() -> String:
	return "%s · %s" % [X_TITLE, level_title(level).to_lower()]


func spawn_limit() -> float:
	return 36.0


func nav_path() -> String:
	return nav_of(level)


func x_cache() -> String:
	return "res://assets/world/externals_f%d_blocks.res" % level


func x_sig_n() -> int:
	return hash(str(D_ROOMS[level]) + str(D_LINKS[level]) + str(D_FURN[level]) + "|" + str(ULBlock.GEN_V))


func x_defs() -> Array:
	var blocks: Array = []
	for r in D_ROOMS[level]:
		var x0 := float(r[2])
		var z0 := float(r[3])
		var x1 := float(r[4])
		var z1 := float(r[5])
		blocks.append({"c": Vector2((x0 + x1) * 0.5, (z0 + z1) * 0.5), "L": x1 - x0, "W": z1 - z0, "axis": "x", "floors": 1, "layout": "hall", "row": [],
			"hall_type": String(r[1]), "entr": [], "blind": ["s+", "s-", "e+", "e-"]})
	var links: Array = []
	for p in D_LINKS[level]:
		links.append([p, 1])
	return [{"id": "ug", "n": level_title(level), "kind": "hq", "skin": "plaster", "int": "tile_wall" if level == 2 else "int_grey1", "storey": 3.6, "te": 0.4,
		"links": links, "blocks": blocks}]


## в каком помещении точка: название или «»
func room_at(p: Vector3) -> String:
	for r in D_ROOMS[level]:
		if p.x >= float(r[2]) and p.x <= float(r[4]) and p.z >= float(r[3]) and p.z <= float(r[5]):
			return String(r[0])
	return ""


func road_dist(_q: Vector2) -> float:
	return 1e9


func clear_w(_q: Vector2) -> float:
	return 1.0


func forest_ok(_q: Vector2) -> bool:
	return false


func forest_n() -> int:
	return 0


func _junk_spots() -> Array:
	return []


func _x_inside(b: ULBlock) -> void:
	_x_furn(b, D_FURN[level])


func _x_outdoor(rng: RandomNumberGenerator, props: Node3D) -> void:
	half = DH_
	_d_ground()
	_x_lift(props)
	match level:
		1:
			_d_floor1(props)
		2:
			_d_floor2(props)
		3:
			_d_floor3(props)
	_flush(props)
	_light_pool()
	# свет этажа: первый — тёплые лампы, второй — зеленоватый, третий — красный аварийный
	var tint: Color = [Color(1.0, 0.9, 0.72), Color(0.72, 1.0, 0.8), Color(1.0, 0.5, 0.42)][level - 1]
	for l in _lights:
		l.light_color = tint


## вокруг этажа — порода: чёрная плоскость, пол-столкновение и стены по краю поля
func _d_ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(420, 420)
	mi.mesh = pm
	mi.material_override = _mat("x_dark")
	mi.position.y = -0.02
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	mask = Image.create(16, 16, false, Image.FORMAT_RGBA8)
	mask.fill(Color(0, 1, 0, 1))
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	body.add_child(cs)


## полоса света на полу вдоль стены (m — «x_warm», «x_green», «x_red», «x_blue»)
func _glow_strip(g: Node3D, a: Vector3, b: Vector3, m: String) -> void:
	var d := b - a
	var along_x := absf(d.x) > absf(d.z)
	_bx(g, m, Vector3(absf(d.x) if along_x else 0.12, 0.05, 0.12 if along_x else absf(d.z)), _at((a + b) * 0.5 + Vector3(0, 0.245, 0)))


## светящаяся кайма по периметру помещения (на полу, в 0,6 м от стен; у проходов — разрывы не делаются: полоса плоская)
func _d_room_glow(g: Node3D, ri: int, m: String, inset := 0.75) -> void:
	var r: Array = D_ROOMS[level][ri]
	var x0 := float(r[2]) + inset
	var z0 := float(r[3]) + inset
	var x1 := float(r[4]) - inset
	var z1 := float(r[5]) - inset
	# не сплошной линией, а штрихами по 2 м через 2 м
	var x := x0
	while x < x1 - 1.0:
		_glow_strip(g, Vector3(x, 0, z0), Vector3(minf(x + 2.0, x1), 0, z0), m)
		_glow_strip(g, Vector3(x, 0, z1), Vector3(minf(x + 2.0, x1), 0, z1), m)
		x += 4.0
	var z := z0
	while z < z1 - 1.0:
		_glow_strip(g, Vector3(x0, 0, z), Vector3(x0, 0, minf(z + 2.0, z1)), m)
		_glow_strip(g, Vector3(x1, 0, z), Vector3(x1, 0, minf(z + 2.0, z1)), m)
		z += 4.0


## капсула: основание, стеклянный цилиндр со светом (glass — «x_gglass» или «x_rglass»), крышка; внутри — тёмный
## силуэт-заглушка (заражённых и образцов пока нет — создаются отдельно)
func _d_capsule(g: Node3D, p: Vector3, r: float, h: float, glass: String, lying := false) -> void:
	var glow := "x_green" if glass == "x_gglass" else "x_red"
	if lying:
		# лежачая капсула вдоль X: стеклянный цилиндр на ложементах
		var rot := Basis(Vector3(0, 0, 1), PI * 0.5)
		_bx(g, "x_steel", Vector3(h + 0.5, 0.35, r * 2.0 + 0.3), _at(p + Vector3(0, 0.38, 0)), true)
		_cy(g, glass, r, r, h, Transform3D(rot, p + Vector3(0, 0.55 + r, 0)), 12)
		_cy(g, "x_black", r * 0.45, r * 0.45, h * 0.7, Transform3D(rot, p + Vector3(0, 0.55 + r * 0.8, 0)), 8)
		for sgn in [-1.0, 1.0]:
			_cy(g, "x_steel", r + 0.06, r + 0.06, 0.3, Transform3D(rot, p + Vector3(sgn * (h * 0.5 + 0.1), 0.55 + r, 0)), 12)
		_bx(g, glow, Vector3(h, 0.05, 0.1), _at(p + Vector3(0, 0.6, r + 0.22)))
		_col_xf(Vector3(h + 0.5, 2.0, r * 2.0 + 0.3), _at(p + Vector3(0, 1.2, 0)))
		return
	_cy(g, "x_steel", r + 0.18, r + 0.25, 0.45, _at(p + Vector3(0, 0.42, 0)), 12)
	_cy(g, glass, r, r, h, _at(p + Vector3(0, 0.65 + h * 0.5, 0)), 12)
	_cy(g, "x_black", r * 0.42, r * 0.5, h * 0.72, _at(p + Vector3(0, 0.65 + h * 0.4, 0)), 8)
	_cy(g, "x_steel", r * 0.55, r + 0.05, 0.22, _at(p + Vector3(0, 0.76 + h, 0)), 12)
	_cy(g, glow, r + 0.2, r + 0.2, 0.05, _at(p + Vector3(0, 0.67, 0)), 12)
	_cyl_col(Vector3(p.x, 0.2, p.z), r + 0.2, 2.2)


## стеклянная стенка (карантинная камера, бокс): от a до b, высотой 2,2 м, с рамой; столкновение — стена
func _d_glass_wall(g: Node3D, a: Vector3, b: Vector3, glass := "x_gglass") -> void:
	var d := b - a
	var along_x := absf(d.x) > absf(d.z)
	var ln := absf(d.x) if along_x else absf(d.z)
	var mid := (a + b) * 0.5
	var sz := Vector3(ln, 2.0, 0.06) if along_x else Vector3(0.06, 2.0, ln)
	_bx(g, glass, sz, _at(mid + Vector3(0, 1.3, 0)))
	_bx(g, "x_steel", Vector3(ln, 0.12, 0.14) if along_x else Vector3(0.14, 0.12, ln), _at(mid + Vector3(0, 0.28, 0)))
	_bx(g, "x_steel", Vector3(ln, 0.1, 0.14) if along_x else Vector3(0.14, 0.1, ln), _at(mid + Vector3(0, 2.34, 0)))
	_col_xf(Vector3(ln, 2.4, 0.16) if along_x else Vector3(0.16, 2.4, ln), _at(mid + Vector3(0, 1.4, 0)))


## стеклянный бокс w × d с тёмным силуэтом внутри (вход не делается: бокс закрыт)
func _d_glass_box(g: Node3D, c: Vector3, w: float, d: float, glass := "x_gglass") -> void:
	_d_glass_wall(g, c + Vector3(-w * 0.5, 0, -d * 0.5), c + Vector3(w * 0.5, 0, -d * 0.5), glass)
	_d_glass_wall(g, c + Vector3(-w * 0.5, 0, d * 0.5), c + Vector3(w * 0.5, 0, d * 0.5), glass)
	_d_glass_wall(g, c + Vector3(-w * 0.5, 0, -d * 0.5), c + Vector3(-w * 0.5, 0, d * 0.5), glass)
	_d_glass_wall(g, c + Vector3(w * 0.5, 0, -d * 0.5), c + Vector3(w * 0.5, 0, d * 0.5), glass)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_bx(g, "x_steel", Vector3(0.16, 2.3, 0.16), _at(c + Vector3(sx * w * 0.5, 1.35, sz * d * 0.5)))
	_bx(g, "x_black", Vector3(w * 0.3, 0.5, d * 0.3), _at(c + Vector3(0, 0.47, 0)))
	_bx(g, "x_green" if glass == "x_gglass" else "x_red", Vector3(w - 0.4, 0.04, 0.1), _at(c + Vector3(0, 0.24, d * 0.5 - 0.25)))
	# внутрь не пройти
	_col_xf(Vector3(w, 2.4, d), _at(c + Vector3(0, 1.4, 0)))


## армейская койка вдоль Z: стальная рама, матрас, подушка, одеяло; столкновение — коробка
func _d_bed(g: Node3D, p: Vector3) -> void:
	_bx(g, "x_steel", Vector3(0.95, 0.1, 2.0), _at(p + Vector3(0, 0.42, 0)))
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_bx(g, "x_steel", Vector3(0.07, 0.75, 0.07), _at(p + Vector3(sx * 0.44, 0.38, sz * 0.96)))
	_bx(g, "canvas", Vector3(0.86, 0.14, 1.9), _at(p + Vector3(0, 0.54, 0)))
	_bx(g, "x_black", Vector3(0.86, 0.05, 1.1), _at(p + Vector3(0, 0.63, 0.35)))
	_bx(g, "canvas_in", Vector3(0.6, 0.1, 0.36), _at(p + Vector3(0, 0.65, -0.7)))
	_col_xf(Vector3(0.95, 0.9, 2.0), _at(p + Vector3(0, 0.45, 0)))


# ---------------- этаж 1: жилые и военные помещения ----------------

func _d_floor1(g: Node3D) -> void:
	# жёлтая разметка вокруг лифта, тёплые полосы в коридорах
	for sgn in [-1.0, 1.0]:
		_bx(g, "x_yellow", Vector3(13.0, 0.03, 0.25), _at(Vector3(0, 0.235, sgn * 6.5)))
		_bx(g, "x_yellow", Vector3(0.25, 0.03, 13.0), _at(Vector3(sgn * 6.5, 0.235, 0)))
	_d_room_glow(g, 1, "x_warm")
	_d_room_glow(g, 2, "x_warm")
	# казармы A и B: по два ряда армейских коек (изголовьем к стене) и тумбочки
	for zrow in [-12.6, -2.4, 2.4, 12.6]:
		for bx in [-33.5, -30.5, -27.5, -21.5, -18.5]:
			_d_bed(g, Vector3(bx, 0.2, zrow))
	# душевая: перегородки кабин вдоль северной стены
	for i in 5:
		_bx(g, "x_steel", Vector3(0.08, 1.9, 1.4), _at(Vector3(1.6 + i * 1.9, 1.15, -34.6)), true)
	# пост охраны: стойка поперёк входа (укрытие)
	_bx(g, "x_steel", Vector3(5.0, 1.05, 0.5), _at(Vector3(0, 0.72, 25.0)), true)


# ---------------- этаж 2: лаборатория заражённых ----------------

func _d_floor2(g: Node3D) -> void:
	for sgn in [-1.0, 1.0]:
		_bx(g, "x_yellow", Vector3(12.0, 0.03, 0.25), _at(Vector3(0, 0.235, sgn * 5.5)))
		_bx(g, "x_yellow", Vector3(0.25, 0.03, 11.0), _at(Vector3(sgn * 6.0, 0.235, 0)))
	_d_room_glow(g, 1, "x_green")
	_d_room_glow(g, 2, "x_green")
	_d_room_glow(g, 4, "x_blue")
	# карантинные камеры: четыре стеклянные камеры у северной стены, проход вдоль них с юга
	for i in 4:
		var cx := -15.0 + i * 10.0
		_d_glass_box(g, Vector3(cx, 0.2, -32.6), 8.0, 5.2)
	# обеззараживающий шлюз: две стеклянные рамы поперёк и зелёные полосы
	_d_glass_wall(g, Vector3(22.0, 0.2, -31.0), Vector3(26.5, 0.2, -31.0))
	_d_glass_wall(g, Vector3(29.5, 0.2, -31.0), Vector3(34.0, 0.2, -31.0))
	_d_room_glow(g, 6, "x_green", 1.0)
	# боксы с заражёнными образцами: шесть стеклянных боксов в два ряда
	for ix in 3:
		for iz in 2:
			_d_glass_box(g, Vector3(-32.0 + ix * 6.2, 0.2, -5.6 + iz * 11.2), 4.6, 4.6)
	# капсулы с образцами: пять капсул в ряд
	for i in 5:
		_d_capsule(g, Vector3(-9.0 + i * 4.5, 0.2, 27.0), 1.0, 1.9, "x_gglass")
	_d_room_glow(g, 14, "x_green", 1.0)
	# исследовательская лаборатория: капсула посередине
	_d_capsule(g, Vector3(12.0, 0.2, -15.5), 1.1, 1.9, "x_gglass")
	# операционная: лампы над столом — светящийся круг на полу под каталкой
	_cy(g, "x_warm", 1.6, 1.6, 0.03, _at(Vector3(-25.0, 0.235, 26.0)), 16)


# ---------------- этаж 3: экспериментальный сектор ----------------

func _d_floor3(g: Node3D) -> void:
	for sgn in [-1.0, 1.0]:
		_bx(g, "x_yellow", Vector3(11.0, 0.03, 0.25), _at(Vector3(0, 0.235, sgn * 5.5)))
		_bx(g, "x_yellow", Vector3(0.25, 0.03, 11.0), _at(Vector3(sgn * 5.5, 0.235, 0)))
	for ri in [0, 1, 4, 7, 8, 9]:
		_d_room_glow(g, ri, "x_red", 0.8)
	# экспериментальный сектор: круглый помост, красное кольцо, четыре опоры и капсулы по углам
	var ec := Vector3(0, 0.2, -24.0)
	_cy(g, "x_steel", 7.0, 7.2, 0.1, _at(ec + Vector3(0, 0.05, 0)), 24)
	_cy(g, "x_red", 7.5, 7.5, 0.04, _at(ec + Vector3(0, 0.02, 0)), 24)
	_cy(g, "x_black", 2.2, 2.2, 0.05, _at(ec + Vector3(0, 0.12, 0)), 16)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_bx(g, "x_steel", Vector3(0.6, 2.4, 0.6), _at(ec + Vector3(sx * 9.0, 1.2, sz * 7.0)), true)
			_d_capsule(g, ec + Vector3(sx * 14.5, 0, -9.0 if sz < 0.0 else 5.5), 0.9, 1.8, "x_rglass")
	# реактор: основание, корпус с красным поясом, купол, баки и трубы
	var rc := Vector3(27.0, 0.2, -23.0)
	_cy(g, "x_steel", 5.2, 5.5, 0.4, _at(rc + Vector3(0, 0.2, 0)), 16)
	_cy(g, "x_steel", 3.6, 4.0, 1.6, _at(rc + Vector3(0, 1.2, 0)), 16)
	_cy(g, "x_red", 3.7, 3.7, 0.5, _at(rc + Vector3(0, 1.5, 0)), 16)
	_cy(g, "x_rglass", 3.3, 3.6, 0.9, _at(rc + Vector3(0, 2.45, 0)), 16)
	_cy(g, "x_steel", 1.6, 2.6, 0.7, _at(rc + Vector3(0, 3.2, 0)), 16)
	_cyl_col(rc, 4.0, 3.0)
	for i in 2:
		var tp := Vector3(24.0 + i * 5.5, 0.2, -33.6)
		_cy(g, "x_steel", 1.3, 1.3, 2.4, _at(tp + Vector3(0, 1.2, 0)), 12)
		_cyl_col(tp, 1.35, 2.4)
	# трубы от баков к реактору — вдоль северной стены
	_bx(g, "x_steel", Vector3(12.0, 0.3, 0.3), _at(Vector3(27.0, 0.75, -35.2)))
	# зал капсул: четыре лежачие красные капсулы у западной стены
	for i in 4:
		_d_capsule(g, Vector3(-31.0, 0.2, -8.5 + i * 4.4), 0.95, 4.4, "x_rglass", true)
	_d_room_glow(g, 5, "x_red", 0.8)
	# биолаборатория: три стоячие капсулы у северной стены
	for i in 3:
		_d_capsule(g, Vector3(26.0 + i * 3.6, 0.2, 16.4), 0.9, 1.8, "x_rglass")
	# зал «Высокая опасность»: красно-жёлтая разметка и большие ворота в южной стене (закрыты, за ними ничего нет)
	_bx(g, "x_red", Vector3(14.0, 0.03, 0.5), _at(Vector3(0, 0.235, 15.0)))
	_bx(g, "x_yellow", Vector3(14.0, 0.03, 0.25), _at(Vector3(0, 0.235, 15.8)))
	_bx(g, "x_steel", Vector3(7.0, 1.15, 0.3), _at(Vector3(0, 0.78, 35.3)))
	_bx(g, "x_yellow", Vector3(7.0, 0.12, 0.32), _at(Vector3(0, 1.2, 35.3)))


# ---------------- солдаты ----------------

## Расстановка этажа: число каждого вида — data/externals.json → soldiers.floorN; посты — D_POSTS (в каких
## помещениях). У лифта (ближе 9 м) никто не стоит — герой, приехав, успевает осмотреться.
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var cnt: Dictionary = (conf().get("soldiers", {}) as Dictionary).get("floor%d" % level, {})
	var out: Array = []
	var taken: Array[Vector3] = []
	for kind in ["ext_titan", "ext_sniper", "ext_assault"]:
		var rooms: Array = (D_POSTS[level] as Dictionary).get(kind, [])
		if rooms.is_empty():
			continue
		for i in int(cnt.get(kind, 0)):
			var ri := int(rooms[i % rooms.size()])
			var r: Array = D_ROOMS[level][ri]
			for attempt in 80:
				var p := Vector3(rng.randf_range(float(r[2]) + 1.4, float(r[4]) - 1.4), 0.2, rng.randf_range(float(r[3]) + 1.4, float(r[5]) - 1.4))
				if Vector2(p.x, p.z).length() < 9.0:
					continue
				var q: Vector3 = snap.call(p)
				if Vector2(q.x - p.x, q.z - p.z).length() > 0.4 or absf(q.y - 0.2) > 0.35:
					continue
				var crowd := false
				for t in taken:
					if t.distance_to(q) < 2.2:
						crowd = true
						break
				if crowd or not body_fits(Vector3(q.x, 0.2, q.z), 0.32, 1.5):
					continue
				taken.append(q)
				out.append([kind, Vector3(q.x, 0.22, q.z), "post" if kind != "ext_assault" else "main"])
				break
	return out


## следы на полу: на первом этаже чисто, на втором и третьем — пятна крови (как на планах); брошенных вещей двора нет
func place_cows(rng: RandomNumberGenerator) -> void:
	for n in _remains:
		n.queue_free()
	_remains.clear()
	var g := Node3D.new()
	g.name = "Remains"
	add_child(g)
	_remains.append(g)
	var n_blood: int = [0, 14, 24][level - 1]
	if n_blood <= 0 or blds.is_empty() or blds[0].spots.is_empty():
		return
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.22, 0.04, 0.03, 0.85)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.roughness = 0.35
	mat.albedo_texture = _blood_tex()
	mat.cull_mode = BaseMaterial3D.CULL_DISABLED
	var pm := PlaneMesh.new()
	pm.size = Vector2(1, 1)
	var b: ULBlock = blds[0]
	for k in n_blood:
		var sp: Array = b.spots[rng.randi() % b.spots.size()]
		var p: Vector3 = sp[0]
		var mi := MeshInstance3D.new()
		mi.mesh = pm
		mi.material_override = mat
		mi.position = p + Vector3(rng.randf_range(-0.6, 0.6), 0.045, rng.randf_range(-0.6, 0.6))
		mi.rotation.y = rng.randf() * TAU
		var sc := rng.randf_range(0.8, 2.0)
		mi.scale = Vector3(sc * rng.randf_range(0.8, 1.6), 1, sc)
		mi.layers = 2
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)
		mi.set_meta("inside", true)
