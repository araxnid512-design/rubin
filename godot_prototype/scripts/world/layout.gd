class_name BaseLayout
extends RefCounted
## Планировка локации «База Долга» (300 × 300 м, 1 ед. = 1 м). Север = -Z, восток = +X.
## Все координаты — мировые, в метрах.

const MAP_HALF := 150.0
const WALL_MIN := Vector2(-100, -105)   # периметр укреплённой части (x, z)
const WALL_MAX := Vector2(100, 82)
const GATE_HALF := 6.0                  # половина ширины проезда КПП
const WALL_H := 2.6

## Проломы в стене (сторона, центр вдоль стороны, ширина). Через них можно выйти на окраины.
const BREACHES := [
	{"side": "w", "at": -32.0, "w": 6.0},
	{"side": "n", "at": 41.0, "w": 5.0},
	{"side": "e", "at": 24.0, "w": 5.0},
]

## Дороги: [от, до, ширина, тип] тип: 0 — асфальт, 1 — грунтовка, 2 — бетонные плиты
const ROADS := [
	[Vector2(0, 150), Vector2(0, 82), 8.0, 0],
	[Vector2(0, 82), Vector2(0, -2), 8.0, 0],
	[Vector2(-92, 18), Vector2(92, 18), 7.0, 0],
	[Vector2(-38, -98), Vector2(-38, 18), 6.0, 0],
	[Vector2(38, -98), Vector2(38, 18), 6.0, 0],
	[Vector2(-92, -90), Vector2(92, -90), 6.0, 2],
	[Vector2(38, 18), Vector2(38, 40), 6.0, 2],
	[Vector2(100, 24), Vector2(150, 34), 5.0, 1],
	[Vector2(-100, -32), Vector2(-122, -20), 4.0, 1],
	[Vector2(-122, -20), Vector2(-122, 50), 4.0, 1],
	[Vector2(41, -105), Vector2(41, -116), 4.0, 1],
	[Vector2(-150, -116), Vector2(150, -116), 4.5, 1],
	[Vector2(110, -116), Vector2(124, -66), 4.0, 1],
]

## Площадки с бетонным покрытием (центр, размер)
const PADS := [
	[Vector2(0, -14), Vector2(34, 24)],    # плац
	[Vector2(0, 74), Vector2(22, 14)],     # площадка КПП
	[Vector2(64, 22), Vector2(26, 10)],    # перед мастерской/гаражом
	[Vector2(-20, -62), Vector2(16, 6)],   # перед генераторной
	[Vector2(18, -62), Vector2(16, 6)],    # перед радиоцентром
	[Vector2(-50, -42), Vector2(10, 30)],  # у казарм
	[Vector2(48, -44), Vector2(8, 26)],    # у склада
]

enum Lvl { RUINED, WORKING, UPGRADED }

## Здания. door: сторона и смещение центра двери вдоль стороны (от центра здания).
const BUILDINGS := [
	{"id": "hq", "name": "Штаб командования", "kind": "hq", "pos": Vector2(0, -42), "size": Vector2(28, 16), "floors": 2,
		"door": ["s", 0.0], "level": 1, "wall": Color(0.62, 0.6, 0.55), "brick": false,
		"repair": {"scrap": 10, "planks": 6}, "repair_work": 40.0,
		"upgrade": {"scrap": 20, "planks": 10, "electronics": 4}, "upgrade_work": 90.0,
		"desc": "Центральное здание генерала. Отсюда ведётся управление базой и планируются экспедиции.",
		"effect": "Управление базой, планирование экспедиций."},
	{"id": "barracks", "name": "Казармы", "kind": "barracks", "pos": Vector2(-64, -42), "size": Vector2(14, 36), "floors": 1,
		"door": ["e", 0.0], "level": 0, "wall": Color(0.55, 0.36, 0.28), "brick": true,
		"repair": {"planks": 12, "scrap": 8, "provisions": 4}, "repair_work": 60.0,
		"upgrade": {"planks": 16, "scrap": 10, "provisions": 8}, "upgrade_work": 80.0,
		"desc": "Размещение личного состава. Бойцы восстанавливают здесь силы.",
		"effect": "Вместимость базы: 6 → 12 бойцов (улучшение: 20). Отдых ускоряет лечение."},
	{"id": "armory", "name": "Оружейная", "kind": "armory", "pos": Vector2(-64, 2), "size": Vector2(16, 12), "floors": 1,
		"door": ["e", 0.0], "level": 0, "wall": Color(0.5, 0.5, 0.47), "brick": false, "rubble": true,
		"repair": {"scrap": 12, "weapon_parts": 4, "tools": 1}, "repair_work": 50.0,
		"upgrade": {"scrap": 16, "weapon_parts": 8, "electronics": 2}, "upgrade_work": 70.0,
		"desc": "Хранение оружия и боеприпасов. Позволяет снабжать бойцов.",
		"effect": "Выдача оружия и патронов бойцам. После ремонта — снаряжение патронов из деталей."},
	{"id": "warehouse", "name": "Основной склад", "kind": "warehouse", "pos": Vector2(64, -44), "size": Vector2(22, 34), "floors": 1,
		"door": ["w", 0.0], "level": 0, "wall": Color(0.45, 0.47, 0.45), "brick": false, "hangar": true,
		"repair": {"planks": 10, "scrap": 10}, "repair_work": 50.0,
		"upgrade": {"planks": 14, "scrap": 16, "tools": 1}, "upgrade_work": 70.0,
		"desc": "Материалы, инструменты и припасы базы. Сюда сдаются найденные ресурсы.",
		"effect": "Вместимость склада: 300 → 800 ед. (улучшение: 2000)."},
	{"id": "workshop", "name": "Ремонтная мастерская", "kind": "workshop", "pos": Vector2(64, 0), "size": Vector2(20, 14), "floors": 1,
		"door": ["w", 0.0], "level": 0, "wall": Color(0.52, 0.5, 0.46), "brick": false, "hangar": true,
		"repair": {"scrap": 15, "tools": 1, "electronics": 2}, "repair_work": 60.0,
		"upgrade": {"scrap": 20, "electronics": 4, "tools": 1}, "upgrade_work": 80.0,
		"desc": "Ремонт оружия, брони и оборудования.",
		"effect": "Ремонт брони, изготовление оружейных деталей из металлолома."},
	{"id": "medpoint", "name": "Медицинский пункт", "kind": "medpoint", "pos": Vector2(-22, 40), "size": Vector2(16, 11), "floors": 1,
		"door": ["n", 0.0], "level": 0, "wall": Color(0.7, 0.7, 0.66), "brick": false,
		"repair": {"medicine": 4, "planks": 6, "scrap": 4}, "repair_work": 45.0,
		"upgrade": {"medicine": 8, "electronics": 2, "scrap": 6}, "upgrade_work": 60.0,
		"desc": "Лечение бойцов и генерала.",
		"effect": "Лечение до полного здоровья, изготовление бинтов. Ускоряет восстановление раненых."},
	{"id": "radio", "name": "Радиоцентр", "kind": "radio", "pos": Vector2(18, -72), "size": Vector2(12, 10), "floors": 1,
		"door": ["s", 0.0], "level": 0, "wall": Color(0.58, 0.56, 0.5), "brick": true,
		"repair": {"electronics": 4, "scrap": 6, "planks": 4}, "repair_work": 45.0, "needs_power": true,
		"upgrade": {"electronics": 8, "scrap": 8, "tools": 1}, "upgrade_work": 70.0,
		"desc": "Связь с другими отрядами и поиск выживших.",
		"effect": "Поиск сигналов выживших отрядов «Долга». Требует электропитания."},
	{"id": "generator", "name": "Генераторная", "kind": "generator", "pos": Vector2(-20, -72), "size": Vector2(12, 10), "floors": 1,
		"door": ["s", 0.0], "level": 0, "wall": Color(0.55, 0.52, 0.48), "brick": true,
		"repair": {"scrap": 8, "electronics": 2, "tools": 1}, "repair_work": 40.0,
		"upgrade": {"scrap": 14, "electronics": 4, "fuel": 2}, "upgrade_work": 60.0,
		"desc": "Дизель-генератор базы. Даёт свет и питание радиоцентру.",
		"effect": "Электроснабжение базы: освещение, радиоцентр. Расходует топливо."},
	{"id": "training", "name": "Тренировочная площадка", "kind": "training", "pos": Vector2(-62, 52), "size": Vector2(34, 28), "floors": 0,
		"door": ["e", 0.0], "level": 0, "wall": Color(0.5, 0.45, 0.35), "open": true,
		"repair": {"planks": 8, "scrap": 6}, "repair_work": 40.0,
		"upgrade": {"planks": 12, "scrap": 10, "ammo_545": 60}, "upgrade_work": 60.0,
		"desc": "Подготовка солдат: стрельбище и полоса препятствий.",
		"effect": "Тренировка бойцов повышает меткость."},
	{"id": "kpp", "name": "Главный КПП", "kind": "kpp", "pos": Vector2(0, 80), "size": Vector2(24, 8), "floors": 0,
		"door": ["s", 0.0], "level": 0, "wall": Color(0.55, 0.55, 0.5), "open": true,
		"repair": {"scrap": 10, "planks": 6}, "repair_work": 45.0,
		"upgrade": {"scrap": 16, "planks": 8, "electronics": 2}, "upgrade_work": 60.0,
		"desc": "Укреплённые ворота базы: шлагбаум, мешки с песком, ограждения.",
		"effect": "Ворота закрываются, растёт обороноспособность. Посты для охраны."},
	{"id": "garage", "name": "Гараж", "kind": "garage", "pos": Vector2(58, 48), "size": Vector2(28, 13), "floors": 1,
		"door": ["n", 0.0], "level": 0, "wall": Color(0.5, 0.5, 0.46), "brick": false, "rubble": true, "hangar": true,
		"repair": {"scrap": 20, "tools": 1, "fuel": 2, "electronics": 2}, "repair_work": 80.0,
		"upgrade": {"scrap": 30, "electronics": 4, "fuel": 4}, "upgrade_work": 90.0,
		"desc": "Боксы для техники. Пока пусто — вся техника потеряна.",
		"effect": "Подготовка к восстановлению техники (следующие этапы)."},
	{"id": "tower_nw", "name": "Вышка (СЗ)", "kind": "tower", "pos": Vector2(-95, -100), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["s", 0.0], "level": 0,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Сторожевая вышка. Обзор периметра.", "effect": "Пост наблюдения."},
	{"id": "tower_ne", "name": "Вышка (СВ)", "kind": "tower", "pos": Vector2(95, -100), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["s", 0.0], "level": 0,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Сторожевая вышка. Обзор периметра.", "effect": "Пост наблюдения."},
	{"id": "tower_sw", "name": "Вышка (ЮЗ)", "kind": "tower", "pos": Vector2(-95, 77), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["n", 0.0], "level": 1,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Сторожевая вышка. Обзор периметра.", "effect": "Пост наблюдения."},
	{"id": "tower_se", "name": "Вышка (ЮВ)", "kind": "tower", "pos": Vector2(95, 77), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["n", 0.0], "level": 0,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Сторожевая вышка. Обзор периметра.", "effect": "Пост наблюдения."},
	{"id": "tower_gw", "name": "Вышка КПП (З)", "kind": "tower", "pos": Vector2(-13, 77), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["n", 0.0], "level": 1,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Вышка у ворот.", "effect": "Пост наблюдения за дорогой."},
	{"id": "tower_ge", "name": "Вышка КПП (В)", "kind": "tower", "pos": Vector2(13, 77), "size": Vector2(3.5, 3.5), "floors": 0, "door": ["n", 0.0], "level": 0,
		"repair": {"planks": 6, "scrap": 2}, "repair_work": 20.0, "upgrade": {"planks": 4, "scrap": 4, "electronics": 1}, "upgrade_work": 20.0,
		"desc": "Вышка у ворот.", "effect": "Пост наблюдения за дорогой."},
]

## Разрушенные вспомогательные здания (не восстанавливаются, частично обыскиваются)
const RUINS := [
	{"id": "boiler", "name": "Котельная", "pos": Vector2(20, 46), "size": Vector2(12, 10), "chimney": true, "wall": Color(0.55, 0.35, 0.27), "door": ["w", 0.0]},
	{"id": "store_ruin", "name": "Склад ГСМ", "pos": Vector2(-27, -10), "size": Vector2(8, 10), "wall": Color(0.5, 0.48, 0.44), "door": ["e", 0.0]},
	{"id": "ne_ruin", "name": "Казарма №2", "pos": Vector2(80, -77), "size": Vector2(18, 10), "wall": Color(0.55, 0.36, 0.28), "door": ["s", 0.0]},
	{"id": "nw_ruin", "name": "Столовая", "pos": Vector2(-80, -76), "size": Vector2(16, 12), "wall": Color(0.6, 0.58, 0.52), "door": ["s", 0.0]},
	{"id": "e_ruin", "name": "Пост связи", "pos": Vector2(86, 30), "size": Vector2(8, 8), "wall": Color(0.55, 0.53, 0.5), "door": ["w", 0.0]},
	{"id": "vil_1", "name": "Дом", "pos": Vector2(-131, -2), "size": Vector2(9, 8), "wall": Color(0.5, 0.4, 0.3), "door": ["e", 0.0], "outside": true},
	{"id": "vil_2", "name": "Дом", "pos": Vector2(-111, 26), "size": Vector2(8, 9), "wall": Color(0.55, 0.45, 0.33), "door": ["e", 0.0], "outside": true},
	{"id": "vil_3", "name": "Сарай", "pos": Vector2(-136, 38), "size": Vector2(7, 6), "wall": Color(0.45, 0.35, 0.25), "door": ["n", 0.0], "outside": true},
	{"id": "lair_hut", "name": "Будка", "pos": Vector2(-124, -128), "size": Vector2(7, 6), "wall": Color(0.5, 0.48, 0.45), "door": ["e", 0.0], "outside": true},
	{"id": "bandit_hut", "name": "Сторожка", "pos": Vector2(130, -70), "size": Vector2(8, 7), "wall": Color(0.5, 0.42, 0.33), "door": ["w", 0.0], "outside": true},
]

## Выходы с локации
const EXITS := [
	{"id": "exit_south", "name": "Свалка", "pos": Vector3(0, 0, 146), "size": Vector3(14, 4, 6)},
	{"id": "exit_east", "name": "Агропром", "pos": Vector3(146, 0, 34), "size": Vector3(6, 4, 12)},
	{"id": "exit_north", "name": "Железнодорожная ветка", "pos": Vector3(-146, 0, -128), "size": Vector3(6, 4, 12)},
]

## Аномалии и радиационные пятна: тип, позиция, радиус
const ANOMALIES := [
	{"kind": "electro", "pos": Vector3(62, 0, -128), "r": 3.0},
	{"kind": "electro", "pos": Vector3(70, 0, -134), "r": 2.5},
	{"kind": "fire", "pos": Vector3(126, 0, 8), "r": 2.5},
	{"kind": "fire", "pos": Vector3(118, 0, 16), "r": 2.2},
	{"kind": "rad", "pos": Vector3(-130, 0, 72), "r": 9.0},
	{"kind": "rad", "pos": Vector3(118, 0, 52), "r": 7.0},
	{"kind": "rad", "pos": Vector3(-88, 0, 60), "r": 4.0},
	{"kind": "rad", "pos": Vector3(84, 0, -96), "r": 4.0},
]

## Группы противников: тип, центр, радиус блуждания, количество, радиус «поводка»
const ENEMY_GROUPS := [
	{"id": "dogs_nw", "kind": "dog", "pos": Vector3(-118, 0, -120), "r": 16.0, "count": 4, "leash": 48.0},
	{"id": "dogs_se", "kind": "dog", "pos": Vector3(78, 0, 120), "r": 14.0, "count": 3, "leash": 42.0},
	{"id": "zombies_w", "kind": "zombie", "pos": Vector3(-126, 0, 14), "r": 22.0, "count": 4, "leash": 40.0},
	{"id": "bandits_ne", "kind": "bandit", "pos": Vector3(124, 0, -62), "r": 12.0, "count": 5, "leash": 45.0},
]

## Контейнеры с добычей
const CONTAINERS := [
	{"id": "hq_desk", "name": "Стол дежурного", "kind": "desk", "pos": Vector3(-9.5, 0, -40.5), "items": {"electronics": 1, "bandage": 1, "ammo_9x18": 16}},
	{"id": "hq_safe", "name": "Сейф генерала", "kind": "safe", "pos": Vector3(11.5, 0, -48.5), "items": {"medkit": 1, "ammo_545": 30, "antirad": 1}},
	{"id": "ws_toolbox", "name": "Ящик с инструментами", "kind": "toolbox", "pos": Vector3(68, 0, -3), "items": {"tools": 1, "scrap": 4}},
	{"id": "radio_cab", "name": "Шкаф с аппаратурой", "kind": "cabinet", "pos": Vector3(21.5, 0, -74.5), "items": {"electronics": 1}},
	{"id": "gen_box", "name": "Ящик ЗИП", "kind": "crate", "pos": Vector3(-24, 0, -64), "items": {"electronics": 1, "scrap": 2}},
	{"id": "garage_cans", "name": "Канистры", "kind": "crate", "pos": Vector3(50, 0, 50), "items": {"fuel": 1, "scrap": 3}},
	{"id": "wh_shelf1", "name": "Стеллаж", "kind": "shelf", "pos": Vector3(70, 0, -54), "items": {"planks": 4, "provisions": 3}},
	{"id": "wh_shelf2", "name": "Стеллаж", "kind": "shelf", "pos": Vector3(70, 0, -36), "items": {"scrap": 5, "medicine": 2}},
	{"id": "barracks_locker", "name": "Шкафчик", "kind": "locker", "pos": Vector3(-69, 0, -50), "items": {"canned": 2, "bandage": 2, "ammo_9x18": 8}},
	{"id": "med_cab", "name": "Медицинский шкаф", "kind": "cabinet", "pos": Vector3(-28, 0, 44), "items": {"medicine": 3, "bandage": 3, "antirad": 1}},
	{"id": "armory_cache", "name": "Оружейный тайник", "kind": "weaponbox", "pos": Vector3(-68, 0, 4), "items": {"ak74": 2, "ammo_545": 150, "ammo_762r": 60, "weapon_parts": 2}},
	{"id": "kpp_box", "name": "Ящик поста", "kind": "ammobox", "pos": Vector3(9.5, 0, 76.5), "items": {"ammo_545": 30, "bandage": 1}},
	{"id": "base_truck", "name": "Сгоревший ЗИЛ", "kind": "vehicle", "pos": Vector3(30, 0, 30), "items": {"scrap": 4, "fuel": 1}},
	{"id": "boiler_box", "name": "Завал в котельной", "kind": "crate", "pos": Vector3(18, 0, 47), "items": {"scrap": 6, "planks": 3}},
	{"id": "parade_box", "name": "Ящик у плаца", "kind": "crate", "pos": Vector3(12.5, 0, -6), "items": {"planks": 3, "provisions": 2}},
	{"id": "wagon_1", "name": "Товарный вагон", "kind": "crate", "pos": Vector3(-34, 0, -125.6), "items": {"electronics": 2, "scrap": 4}},
	{"id": "lair_bag", "name": "Рюкзак погибшего", "kind": "bag", "pos": Vector3(-121, 0, -126), "items": {"electronics": 1, "medkit": 1, "ammo_545": 20}},
	{"id": "vil_box1", "name": "Сундук", "kind": "crate", "pos": Vector3(-132, 0, -1), "items": {"electronics": 1, "canned": 1}},
	{"id": "vil_box2", "name": "Шкаф", "kind": "cabinet", "pos": Vector3(-112, 0, 28), "items": {"planks": 4, "medicine": 2, "antirad": 1}},
	{"id": "bandit_stash", "name": "Схрон бандитов", "kind": "ammobox", "pos": Vector3(131, 0, -71), "items": {"electronics": 3, "fuel": 2, "weapon_parts": 3, "ammo_545": 40, "medkit": 1}},
	{"id": "road_truck", "name": "Грузовик", "kind": "vehicle", "pos": Vector3(16, 0, 116), "items": {"fuel": 1, "scrap": 4}},
	{"id": "road_uaz", "name": "УАЗ", "kind": "vehicle", "pos": Vector3(-13, 0, 132), "items": {"electronics": 1, "tools": 1}},
]

## Точки «разборки» металлолома/досок (удержание взаимодействия)
const SALVAGE := [
	[Vector3(-30, 0, 24), "scrap", 3], [Vector3(26, 0, 22), "scrap", 3], [Vector3(-46, 0, -14), "scrap", 2],
	[Vector3(46, 0, -18), "scrap", 3], [Vector3(-10, 0, -60), "scrap", 2], [Vector3(10, 0, -84), "planks", 3],
	[Vector3(-56, 0, 30), "planks", 3], [Vector3(80, 0, 8), "scrap", 3], [Vector3(-84, 0, 6), "planks", 2],
	[Vector3(30, 0, 62), "scrap", 2], [Vector3(-30, 0, 66), "planks", 3], [Vector3(84, 0, -60), "scrap", 3],
	[Vector3(-84, 0, -64), "scrap", 3], [Vector3(54, 0, -88), "planks", 3], [Vector3(-56, 0, -94), "scrap", 2],
	[Vector3(-112, 0, -100), "scrap", 3], [Vector3(112, 0, -96), "scrap", 3], [Vector3(-120, 0, 90), "planks", 3],
	[Vector3(118, 0, 90), "scrap", 3], [Vector3(30, 0, 100), "scrap", 3], [Vector3(-40, 0, 104), "planks", 3],
	[Vector3(80, 0, -126), "scrap", 3], [Vector3(-80, 0, -128), "scrap", 3], [Vector3(130, 0, -20), "scrap", 3],
]

## Предметы, лежащие на земле
const PICKUPS := [
	[Vector3(3, 0, -30), "bandage", 1], [Vector3(-36, 0, 12), "scrap", 2], [Vector3(36, 0, -60), "planks", 2],
	[Vector3(-62, 0, -20), "ammo_9x18", 8], [Vector3(60, 0, 30), "electronics", 1], [Vector3(-14, 0, 62), "scrap", 2],
	[Vector3(-98, 0, -40), "canned", 1], [Vector3(-110, 0, -118), "ammo_545", 15], [Vector3(122, 0, -54), "medkit", 1],
	[Vector3(-131, 0, 22), "antirad", 1], [Vector3(66, 0, 110), "bandage", 2], [Vector3(140, 0, 30), "scrap", 3],
]

## Точки осмотра для задания
const INSPECT := [
	{"id": "inspect_generator", "pos": Vector3(-20, 0, -64.5), "text": "Генераторная разбита: дизель цел, но проводка сгорела. Нужны инструменты и детали."},
	{"id": "inspect_radio", "pos": Vector3(18, 0, -64.5), "text": "Радиоцентр без питания, аппаратура частично разграблена."},
	{"id": "inspect_armory", "pos": Vector3(-53.5, 0, 2), "text": "Вход в оружейную завален. Придётся разбирать завал."},
]

## Позиции обороны (за мешками с песком), используются приказом «Занять оборону» и охраной КПП
const DEFENSE_POINTS := [
	Vector3(-4.5, 0, 76.6), Vector3(4.5, 0, 76.6), Vector3(-9, 0, 74.5), Vector3(9, 0, 73.2),
	Vector3(-96, 0, -30), Vector3(40, 0, -101), Vector3(96, 0, 22), Vector3(-30, 0, -96), Vector3(30, 0, -96),
]
const KPP_ZONE := Rect2(-16, 66, 32, 18)

const PATROL_ROUTE := [
	Vector3(-34, 0, 14), Vector3(-34, 0, -86), Vector3(34, 0, -86), Vector3(34, 0, 14), Vector3(6, 0, 70), Vector3(-6, 0, 70),
]

const PLAYER_START := Vector3(0, 0, 96)
const PLAYER_START_YAW := 0.0
const RALLY_POINT := Vector3(0, 0, -12)
const BARRACKS_SPOTS := [Vector3(-66, 0, -54), Vector3(-66, 0, -48), Vector3(-66, 0, -42), Vector3(-66, 0, -36), Vector3(-66, 0, -30), Vector3(-66, 0, -24),
	Vector3(-61, 0, -54), Vector3(-61, 0, -48), Vector3(-61, 0, -30), Vector3(-61, 0, -24), Vector3(-61, 0, -36), Vector3(-61, 0, -42)]

## Выжившие бойцы «Долга»
const SOLDIERS := [
	{"id": "s_officer", "name": "Капитан Сергей Рябов", "call": "Рябой", "role": "officer", "role_name": "Офицер", "weapon": "aks74u", "hp": 85.0,
		"pos": Vector3(-3, 0, -18), "duty": "Заместитель генерала. Координирует оборону и докладывает обстановку.",
		"look": {"head": "beret", "armband": true, "headset": true}},
	{"id": "s_rifleman", "name": "Сержант Илья Захаров", "call": "Гром", "role": "rifleman", "role_name": "Автоматчик", "weapon": "ak74", "hp": 100.0,
		"pos": Vector3(4, 0, -16), "duty": "Штурмовик. Основная огневая единица отряда.",
		"look": {"head": "helmet"}},
	{"id": "s_gunner", "name": "Рядовой Богдан Кравец", "call": "Бизон", "role": "gunner", "role_name": "Пулемётчик", "weapon": "pkm", "hp": 60.0,
		"pos": Vector3(7, 0, -11), "duty": "Огневое прикрытие. Ранен при нападении на базу.",
		"look": {"head": "helmet", "build": 1.12, "backpack": true}},
	{"id": "s_sniper", "name": "Мл. сержант Олег Лисицын", "call": "Лис", "role": "sniper", "role_name": "Снайпер", "weapon": "svd", "hp": 100.0,
		"pos": Vector3(-6, 0, -12), "duty": "Наблюдение и точный огонь с дистанции.",
		"look": {"head": "hood", "hood_color": Color(0.16, 0.16, 0.15)}},
	{"id": "s_medic", "name": "Прапорщик Виктор Белов", "call": "Док", "role": "medic", "role_name": "Медик", "weapon": "pm", "hp": 90.0,
		"pos": Vector3(-1, 0, -9), "duty": "Лечит раненых, следит за медикаментами.",
		"look": {"head": "cap", "medbag": true, "armband": true, "armband_color": Color(0.92, 0.92, 0.9)}},
	{"id": "s_tech", "name": "Рядовой Тимур Сабиров", "call": "Паяльник", "role": "tech", "role_name": "Техник", "weapon": "toz34", "hp": 95.0,
		"pos": Vector3(3, 0, -8), "duty": "Ремонт построек, генератора и радиоаппаратуры.",
		"look": {"head": "helmet", "goggles": true, "toolbag": true}},
]
