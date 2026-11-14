class_name Locations
## Первая локация BUNKER SURVIVAL: поверхность 100×100 м над убежищем и сам бункер (один этаж, 8 помещений,
## коридор, шлюз, лестница на поверхность). Всё — узлы BunkerCore (BCRoom, BCDoor, BCProp, BCLight,
## BCInteract, BCZone, BCStairs, BCTerrain); тот же код используется кнопкой «Собрать локацию» в Bunker Editor.
##
## Координаты: Y — вверх, север — −Z, камера по умолчанию смотрит на север. Пол бункера — y = −6, высота
## помещений 3 м, стены 0.4 м. Лестница поднимается от шлюза на юг к порталу на поверхности.

const FLOOR := -6.0
const H := 3.0
const T := 0.4

static var _root: Node3D


# ============================== общие помощники ==============================

static func _node(n: Node3D, parent: Node3D, pos: Vector3, rot_deg := 0.0) -> Node3D:
	n.position = pos
	n.rotation.y = deg_to_rad(rot_deg)
	parent.add_child(n)
	return n


## помещение по внутреннему прямоугольнику [x0, x1] × [z0, z1] на полу y
static func room(parent: Node3D, name: String, x0: float, x1: float, z0: float, z1: float, sides: String, ops: Array, wall_mat := "concrete_wall", floor_mat := "concrete_floor", y := FLOOR, kind := "room") -> BCRoom:
	var r := BCRoom.new()
	r.name = name
	r.room_name = name
	r.size = Vector3(x1 - x0, H, z1 - z0)
	r.wall = T
	r.sides = sides
	r.wall_mat = wall_mat
	r.floor_mat = floor_mat
	var cx := (x0 + x1) * 0.5
	var cz := (z0 + z1) * 0.5
	# проёмы задаются мировой координатой вдоль стены — переводим в смещение от середины
	var out := PackedStringArray()
	for o in ops:
		var side: String = o[0]
		var at: float = o[1]
		var off := at - (cx if side == "n" or side == "s" else cz)
		out.append("%s:%.3f:%.3f:%.3f" % [side, off, o[2], o[3] if o.size() > 3 else 2.15])
	r.openings = out
	_node(r, parent, Vector3(cx, y, cz))
	r.add_to_group("minimap")
	r.set_meta("map_kind", kind)
	r.set_meta("map_rect", Rect2(-(x1 - x0) * 0.5, -(z1 - z0) * 0.5, x1 - x0, z1 - z0))
	return r


static func door(parent: Node3D, id: String, pos: Vector3, rot: float, kind := "interior", width := 0.95, label := "Дверь", open_out := true, open := false) -> BCDoor:
	var d := BCDoor.new()
	d.name = "Door_" + id
	d.door_id = id
	d.kind = kind
	d.width = width
	d.height = 2.1 if kind == "interior" else 2.05
	d.wall_thickness = T
	d.label = label
	d.open_out = open_out
	_node(d, parent, pos, rot)
	if open:
		d.set_state({"open": true})
	return d


static func prop(parent: Node3D, id: String, pos: Vector3, rot := 0.0, params := {}) -> BCProp:
	var p := BCProp.new()
	p.prefab = id
	p.params = params
	_node(p, parent, pos, rot)
	return p


static func light(parent: Node3D, id: String, pos: Vector3, fixture := "tube", group := "", color := Color(1.0, 0.86, 0.66), energy := 1.5, rng := 7.0, flicker := false, rot := 0.0) -> BCLight:
	var l := BCLight.new()
	l.light_id = id
	l.fixture = fixture
	l.group = group
	l.color = color
	l.energy = energy
	l.light_range = rng
	l.flicker = flicker
	_node(l, parent, pos, rot)
	return l


static func spot(parent: Node3D, id: String, pos: Vector3, action: String, label: String, text := "", target := "", rot := 0.0, sensor := Vector3(1.4, 2.0, 1.4), anchor := Vector3(0, 0, 0.8), snap_h := -1.0) -> BCInteract:
	var s := BCInteract.new()
	s.point_id = id
	s.action = action
	s.label = label
	s.text = text
	s.target = target
	s.sensor_size = sensor
	s.anchor = anchor
	if snap_h >= 0.0:
		s.snap = true
		s.snap_height = snap_h
	_node(s, parent, pos, rot)
	return s


static func zone(parent: Node3D, kind: String, name: String, center: Vector3, size: Vector3, hide := false, env := "surface", rad := -1.0, roof := "", prio := 0) -> BCZone:
	var z := BCZone.new()
	z.kind = kind
	z.zone_name = name
	z.size = size
	z.hide_surface = hide
	z.env_preset = env
	z.rad_rate = rad
	z.roof_tag = roof
	z.zone_priority = prio
	_node(z, parent, center)
	return z


# ============================== БУНКЕР ==============================

static func build_bunker(root: Node3D) -> Node3D:
	var B := Node3D.new()
	B.name = "Bunker"
	root.add_child(B)
	B.add_to_group("bunker_only")
	var y := FLOOR
	var hz := Vector3(0, y, 0)
	# --- коридор ---
	room(B, "Коридор", -18.0, 13.0, -22.0, -19.6, "ew", [], "concrete_wall", "metal_plate", y, "corridor")
	# --- северный ряд: медпункт, жилое, управление, теплица ---
	room(B, "Медпункт", -18.0, -10.2, -29.6, -22.4, "nswe", [["s", -14.0, 1.0]], "plastered_wall", "tiles")
	room(B, "Жилой отсек", -9.8, -2.2, -29.6, -22.4, "nse", [["s", -6.0, 1.0]])
	room(B, "Пункт управления", -1.8, 4.6, -29.6, -22.4, "nse", [["s", 1.4, 1.0]])
	room(B, "Теплица", 5.0, 13.0, -29.6, -22.4, "nse", [["s", 9.0, 1.0]])
	# --- южный ряд: склад, мастерская, электростанция, шлюз ---
	room(B, "Склад", -18.0, -10.2, -19.2, -12.4, "nswe", [["n", -14.0, 1.0]])
	room(B, "Мастерская", -9.8, -0.2, -19.2, -12.4, "nse", [["n", -5.0, 1.0]])
	room(B, "Электростанция", 0.2, 6.6, -19.2, -12.4, "nse", [["n", 3.4, 1.0]])
	room(B, "Шлюз", 7.0, 13.0, -19.2, -12.4, "nse", [["n", 10.0, 1.2, 2.05], ["s", 10.0, 1.2, 2.05]], "concrete_wall", "metal_plate")
	# --- двери ---
	var zn := -22.2      # середина северной стены коридора
	var zs := -19.4      # середина южной стены коридора
	door(B, "d_med", Vector3(-14.0, y, zn), 0, "interior", 0.95, "Медпункт", false)
	door(B, "d_live", Vector3(-6.0, y, zn), 0, "interior", 0.95, "Жилой отсек", false, true)
	door(B, "d_ctrl", Vector3(1.4, y, zn), 0, "interior", 0.95, "Пункт управления", false)
	door(B, "d_green", Vector3(9.0, y, zn), 0, "interior", 0.95, "Теплица", false)
	door(B, "d_store", Vector3(-14.0, y, zs), 0, "interior", 0.95, "Склад")
	door(B, "d_work", Vector3(-5.0, y, zs), 0, "interior", 0.95, "Мастерская")
	door(B, "d_gen", Vector3(3.4, y, zs), 0, "interior", 0.95, "Электростанция")
	door(B, "d_lock_in", Vector3(10.0, y, zs), 0, "blast", 1.15, "Гермодверь шлюза")
	door(B, "d_lock_out", Vector3(10.0, y, -12.2), 0, "blast", 1.15, "Гермодверь лестницы")
	# --- лестница наверх (поднимается на юг) ---
	var st := BCStairs.new()
	st.name = "Stairs"
	st.width = 2.2
	st.rise = 6.0
	st.run = 9.6
	st.steps = 32
	st.wall_height = 0.0
	st.mat = "concrete_floor"
	_node(st, B, Vector3(10.0, y, -12.0), 180)
	st.add_to_group("minimap")
	st.set_meta("map_kind", "corridor")
	st.set_meta("map_rect", Rect2(-1.1, -9.6, 2.2, 9.6))
	# площадка наверху лестницы (между лестницей и порталом)
	var land := BCMesh.new()
	land.box("concrete_floor", Transform3D.IDENTITY, Vector3(2.2, 0.3, 1.4), Vector3(10.0, -0.15, -1.7))
	var lm := BCKit.add_mesh(B, land, "Landing")
	BCKit.static_boxes(B, [[Vector3(2.8, 0.3, 1.4), Vector3(10.0, -0.15, -1.7)]], "LandingCol")
	# --- земля вокруг бункера (срез грунта, виден, когда поверхность скрыта) ---
	_soil(B)
	# --- обстановка ---
	_living(B, y)
	_medbay(B, y)
	_control(B, y)
	_greenhouse(B, y)
	_storage(B, y)
	_workshop(B, y)
	_generator(B, y)
	_airlock(B, y)
	_corridor(B, y)
	# --- зоны ---
	var zr := root
	zone(zr, "bunker", "Коридор", Vector3(-2.5, y, -20.8), Vector3(31, 3, 2.4), true, "bunker", -1.0, "", 2)
	for zdef in [["Медпункт", -14.1, -26.0, 7.8, 7.2], ["Жилой отсек", -6.0, -26.0, 7.6, 7.2], ["Пункт управления", 1.4, -26.0, 6.4, 7.2],
			["Теплица", 9.0, -26.0, 8.0, 7.2], ["Склад", -14.1, -15.8, 7.8, 6.8], ["Мастерская", -5.0, -15.8, 9.6, 6.8],
			["Электростанция", 3.4, -15.8, 6.4, 6.8], ["Шлюз", 10.0, -15.8, 6.0, 6.8]]:
		zone(zr, "bunker", zdef[0], Vector3(zdef[1], y, zdef[2]), Vector3(zdef[3], 3, zdef[4]), true, "bunker", -1.0, "", 3)
	# вход: портал и лестница — поверхность скрыта, свет переходный, радиация слабее
	zone(zr, "entrance", "Спуск в убежище", Vector3(10.0, -6.0, -6.6), Vector3(2.6, 9.2, 11.2), true, "entrance", 0.35, "", 4)
	return B


static func _soil(B: Node3D) -> void:
	# сетка 1×1 м на высоте верха стен; клетки над помещениями пропускаются
	var mk := BCMesh.new()
	var holes := [Rect2(-18.6, -30.2, 32.2, 18.4), Rect2(8.6, -12.2, 2.8, 11.4)]
	var y := FLOOR + H + 0.02
	for zi in range(-38, 2):
		for xi in range(-26, 22):
			var c := Vector2(xi + 0.5, zi + 0.5)
			var skip := false
			for h in holes:
				if h.has_point(c):
					skip = true
			if skip:
				continue
			mk.quad("rock", Transform3D.IDENTITY, Vector3(xi, y, zi + 1), Vector3(xi + 1, y, zi + 1), Vector3(xi + 1, y, zi), Vector3(xi, y, zi), 3.0)
	var mi := BCKit.add_mesh(B, mk, "Soil", false)
	mi.material_override = null


static func _living(B: Node3D, y: float) -> void:
	var cz := -26.0
	prop(B, "bunk_bed", Vector3(-8.9, y, -27.4), 0)
	prop(B, "bunk_bed", Vector3(-7.5, y, -27.4), 0)
	prop(B, "nightstand", Vector3(-6.3, y, -28.95), 0)
	prop(B, "locker", Vector3(-3.4, y, -29.3), 0, {"count": 3})
	prop(B, "desk", Vector3(-3.0, y, -24.5), -90)
	prop(B, "chair", Vector3(-3.9, y, -24.5), 90)
	prop(B, "rug", Vector3(-6.0, y, -25.6), 0)
	prop(B, "table_metal", Vector3(-8.4, y, -23.6), 0)
	prop(B, "chair", Vector3(-8.4, y, -22.95), 180)
	prop(B, "cardboard", Vector3(-9.3, y, -29.2), 10)
	prop(B, "crate_military", Vector3(-4.8, y, -29.3), 0)
	light(B, "l_live1", Vector3(-6.0, y + H - 0.05, -26.8), "tube", "live")
	light(B, "l_live2", Vector3(-6.0, y + H - 0.05, -23.6), "tube", "live", Color(1.0, 0.86, 0.66), 0.0, 0.1, true)
	# клип «лечь» кладёт тело на высоту 0.45 м, вдоль «назад» и на 0.6 м вбок от точки старта (замер в лаборатории)
	spot(B, "bed1", Vector3(-8.9, y, -27.4), "bed", "Лечь отдохнуть", "", "", 0, Vector3(1.2, 2, 2.2), Vector3(0.6, 180, -0.4), 0.03)
	spot(B, "bed2", Vector3(-7.5, y, -27.4), "bed", "Лечь отдохнуть", "", "", 0, Vector3(1.2, 2, 2.2), Vector3(0.6, 180, -0.4), 0.03)
	spot(B, "chair_live", Vector3(-3.9, y, -24.5), "chair", "Сесть за стол", "", "", 90, Vector3(1.0, 2, 1.0), Vector3(0.0, 0, 0.22), 0.0)
	spot(B, "sw_live", Vector3(-6.9, y, -22.6), "switch", "жилой отсек", "", "live", 0, Vector3(0.8, 2, 0.8))
	spot(B, "photo", Vector3(-6.3, y, -28.95), "inspect", "Фотография на тумбочке", "Выцветший снимок: семья на даче, лето. На обороте карандашом: «Вернусь. Обещаю»." , "", 0, Vector3(1.0, 2, 1.2))
	spot(B, "lockers", Vector3(-3.4, y, -29.3), "inspect", "Шкафчики", "Три шкафчика. В одном — запасная одежда и бритва, в другом — пустые консервные банки, третий заперт.", "", 0, Vector3(1.6, 2, 1.2))


static func _medbay(B: Node3D, y: float) -> void:
	prop(B, "med_bed", Vector3(-16.6, y, -27.6), 0)
	prop(B, "med_bed", Vector3(-12.2, y, -27.6), 0)
	prop(B, "iv_stand", Vector3(-15.6, y, -28.6), 0)
	prop(B, "med_cabinet", Vector3(-14.3, y, -29.3), 0)
	prop(B, "med_cart", Vector3(-11.0, y, -25.2), -90)
	prop(B, "scanner", Vector3(-17.2, y, -23.8), 90)
	prop(B, "first_aid", Vector3(-10.4, y + 1.3, -26.0), -90)
	light(B, "l_med1", Vector3(-14.1, y + H - 0.05, -25.8), "tube", "med", Color(0.88, 0.94, 1.0), 1.9, 8.5)
	spot(B, "medbay", Vector3(-12.2, y, -27.6), "medbay", "Медоборудование: лечение и выведение радионуклидов", "", "", 0, Vector3(1.6, 2, 2.4), Vector3(-0.9, 0, 0))
	spot(B, "scanner", Vector3(-17.2, y, -23.8), "inspect", "Дозиметрическая установка", "Установка ДКС-02: замеряет накопленную дозу. Нормальная доза за год — до 1 мЗв; 250 мЗв и больше — первые признаки лучевой болезни.", "", 90, Vector3(1.4, 2, 1.4))
	spot(B, "aidkit", Vector3(-10.6, y, -26.0), "pickup", "Подобрать: аптечка", "", "medkit", -90, Vector3(1.0, 2, 1.2))
	spot(B, "sw_med", Vector3(-14.9, y, -22.6), "switch", "медпункт", "", "med", 0, Vector3(0.8, 2, 0.8))


static func _control(B: Node3D, y: float) -> void:
	prop(B, "console", Vector3(1.4, y, -28.7), 0)
	prop(B, "radio_set", Vector3(4.0, y + 0.76, -24.0), -90)
	prop(B, "desk", Vector3(4.05, y, -24.0), -90)
	prop(B, "map_board", Vector3(-1.75, y + 1.1, -25.8), 90)
	prop(B, "chair", Vector3(1.4, y, -27.6), 180)
	prop(B, "elec_cabinet", Vector3(-1.2, y, -28.9), 0)
	light(B, "l_ctrl", Vector3(1.4, y + H - 0.05, -26.0), "tube", "ctrl", Color(0.92, 0.95, 1.0), 1.2, 7.0)
	spot(B, "terminal", Vector3(1.4, y, -28.7), "terminal", "Терминал: состояние бункера", "", "status", 0, Vector3(2.0, 2, 1.6))
	spot(B, "radio", Vector3(4.0, y, -24.0), "inspect", "Радиостанция", "Р-159: на всех частотах — шум. Иногда сквозь треск слышны обрывки цифр. Кто-то ещё жив.", "", -90, Vector3(1.2, 2, 1.4))
	spot(B, "map", Vector3(-1.5, y, -25.8), "inspect", "Карта района", "Карта района с пометками: «склад ГО — разграблен», «НПС — опасно, фон 40+», «мост — цел». Красным обведён посёлок в 12 км к северу.", "", 90, Vector3(1.0, 2, 1.8))
	spot(B, "keycard", Vector3(4.05, y, -24.6), "pickup", "Подобрать: ключ-карта", "", "keycard", -90, Vector3(1.0, 2, 1.0))


static func _greenhouse(B: Node3D, y: float) -> void:
	for x in [6.4, 9.0, 11.6]:
		prop(B, "grow_rack", Vector3(x, y, -28.9), 0, {"seed": int(x * 10)})
	prop(B, "grow_rack", Vector3(7.7, y, -25.4), 0, {"seed": 7})
	prop(B, "grow_rack", Vector3(10.3, y, -25.4), 0, {"seed": 8})
	prop(B, "water_tank", Vector3(12.2, y, -23.4), 0)
	prop(B, "barrel", Vector3(5.6, y, -23.0), 0, {"mat": "paint_blue"})
	prop(B, "barrel", Vector3(6.3, y, -23.0), 0, {"mat": "paint_blue"})
	light(B, "l_grow", Vector3(9.0, y + H - 0.05, -26.4), "grow", "grow", Color(1.0, 0.5, 0.85), 2.0, 8.5)
	spot(B, "sw_grow", Vector3(8.2, y, -22.6), "switch", "фитолампы", "", "grow", 0, Vector3(0.8, 2, 0.8))
	spot(B, "plants", Vector3(9.0, y, -27.6), "inspect", "Грядки", "Салат, лук, картофель в ящиках. Фитолампы дают нужный спектр, вода — из бака. Урожай будет недели через три.", "", 0, Vector3(6, 2, 1.6))


static func _storage(B: Node3D, y: float) -> void:
	for x in [-16.7, -14.1, -11.5]:
		prop(B, "shelf_rack", Vector3(x, y, -18.75), 180, {"seed": int(-x * 3), "fill": 0.85})
	prop(B, "shelf_rack", Vector3(-17.55, y, -15.8), 90, {"seed": 4, "fill": 0.7})
	prop(B, "pallet", Vector3(-13.0, y, -14.0), 0)
	prop(B, "crate_military", Vector3(-13.0, y + 0.15, -14.0), 0)
	prop(B, "crate_military", Vector3(-13.0, y + 0.6, -14.0), 8)
	prop(B, "crate_wood", Vector3(-11.4, y, -13.4), -15)
	prop(B, "barrel", Vector3(-17.4, y, -13.0), 0, {"mat": "paint_green"})
	prop(B, "barrel", Vector3(-16.7, y, -13.1), 0, {"mat": "rust"})
	prop(B, "cardboard", Vector3(-15.0, y, -13.0), 25)
	prop(B, "cardboard", Vector3(-15.1, y + 0.4, -13.05), 10)
	light(B, "l_store", Vector3(-14.1, y + H - 0.05, -15.8), "cage", "store", Color(1.0, 0.82, 0.6), 1.3, 7.0, true)
	spot(B, "canned", Vector3(-11.4, y, -13.4), "pickup", "Подобрать: тушёнка", "", "canned", 0, Vector3(1.2, 2, 1.2))
	spot(B, "shelves", Vector3(-14.1, y, -18.4), "inspect", "Стеллажи с припасами", "Консервы, крупа в мешках, свечи, патроны 5.45, батарейки. Если экономить — хватит на месяц с небольшим.", "", 180, Vector3(7, 2, 1.4))


static func _workshop(B: Node3D, y: float) -> void:
	prop(B, "workbench", Vector3(-7.0, y, -18.75), 180, {"seed": 3})
	prop(B, "tool_board", Vector3(-7.0, y + 1.0, -19.15), 0)
	prop(B, "gas_cylinders", Vector3(-9.4, y, -18.9), 0)
	prop(B, "welder", Vector3(-1.2, y, -17.0), -90)
	prop(B, "machine", Vector3(-1.0, y, -14.0), -90)
	prop(B, "table_metal", Vector3(-5.0, y, -14.2), 0)
	prop(B, "shelf_rack", Vector3(-9.2, y, -14.4), 90, {"seed": 11, "blue": true, "fill": 0.6})
	prop(B, "crate_wood", Vector3(-3.0, y, -12.9), 0)
	light(B, "l_work1", Vector3(-5.0, y + H - 0.05, -15.8), "tube", "work", Color(0.95, 0.95, 1.0), 1.9, 9.0)
	spot(B, "bench", Vector3(-7.0, y, -18.75), "inspect", "Верстак", "Тиски, ножовка, набор ключей, паяльник. Здесь можно будет чинить снаряжение.", "", 180, Vector3(2.2, 2, 1.4))
	spot(B, "tape", Vector3(-5.0, y, -14.2), "pickup", "Подобрать: изолента", "", "tape", 0, Vector3(1.6, 2, 1.2))
	spot(B, "sw_work", Vector3(-4.2, y, -19.0), "switch", "мастерская", "", "work", 0, Vector3(0.8, 2, 0.8))


static func _generator(B: Node3D, y: float) -> void:
	prop(B, "generator", Vector3(3.6, y, -14.4), 0)
	prop(B, "elec_cabinet", Vector3(1.0, y, -18.95), 0)
	prop(B, "elec_cabinet", Vector3(2.1, y, -18.95), 0)
	prop(B, "fuel_tank", Vector3(5.4, y, -18.3), 90)
	prop(B, "fan_unit", Vector3(0.95, y, -13.4), 90)
	prop(B, "pipes_wall", Vector3(3.4, y + 1.9, -12.55), 180, {"length": 6.0})
	light(B, "l_gen", Vector3(3.4, y + H - 0.05, -16.4), "cage", "gen", Color(1.0, 0.8, 0.55), 1.5, 7.5)
	light(B, "l_gen_warn", Vector3(6.4, y + 2.2, -14.4), "bulkhead", "", Color(1.0, 0.6, 0.25), 0.0, 0.1, false, -90)
	spot(B, "genset", Vector3(3.6, y, -14.4), "inspect", "Дизельный генератор", "Дизель-генератор АД-30: 30 кВт. Работает, топлива — на шесть недель. Масло стоит сменить.", "", 0, Vector3(3.4, 2, 2.2))
	spot(B, "panel", Vector3(1.5, y, -18.95), "terminal", "Электрощит: нагрузка сети", "", "power", 0, Vector3(2.0, 2, 1.2))


static func _airlock(B: Node3D, y: float) -> void:
	prop(B, "decon_shower", Vector3(11.9, y, -17.0), -90)
	var sl := prop(B, "suit_locker", Vector3(7.75, y, -16.3), 90)
	var suit := BCPrefabs.suit_on_hanger()
	suit.position = Vector3(7.75, y, -16.3)
	suit.rotation.y = PI * 0.5
	suit.add_to_group("suit_hanger")
	B.add_child(suit)
	prop(B, "floor_grate", Vector3(10.0, y, -15.8), 0)
	prop(B, "first_aid", Vector3(12.95, y + 1.3, -14.0), -90)
	light(B, "l_lock1", Vector3(10.0, y + H - 0.05, -16.8), "cage", "lock", Color(0.9, 0.95, 1.0), 1.4, 7.0)
	light(B, "l_lock_w1", Vector3(7.2, y + 2.3, -13.4), "bulkhead", "", Color(1.0, 0.55, 0.2), 0.0, 0.1, false, 90)
	spot(B, "suit", Vector3(7.75, y, -16.3), "suit", "Защитный костюм", "", "", 90, Vector3(1.4, 2, 1.6), Vector3(0, 0, 0.9))
	spot(B, "decon", Vector3(11.9, y, -17.0), "inspect", "Дезактивационная камера", "После выхода на поверхность — смыть радиоактивную пыль с костюма. Вода собирается в отстойник под решёткой.", "", -90, Vector3(1.8, 2, 1.8))


static func _corridor(B: Node3D, y: float) -> void:
	for x in [-12.0, -2.0, 8.0]:
		light(B, "l_cor%d" % int(x), Vector3(x, y + H - 0.05, -20.8), "tube", "cor", Color(1.0, 0.85, 0.62), 1.3, 7.5, x == -2.0)
	prop(B, "pipes_wall", Vector3(-2.5, y + 2.15, -21.85), 0, {"length": 28.0})
	prop(B, "barrel", Vector3(12.5, y, -21.5), 0, {"mat": "paint_red"})
	spot(B, "sw_cor", Vector3(12.4, y, -20.8), "switch", "коридор", "", "cor", 0, Vector3(0.8, 2, 0.8))


# ============================== ПОВЕРХНОСТЬ ==============================

static func build_surface(root: Node3D) -> Node3D:
	var S := Node3D.new()
	S.name = "Surface"
	root.add_child(S)
	S.add_to_group("surface_only")
	var ter := BCTerrain.new()
	ter.name = "Terrain"
	ter.size = 100.0
	ter.cell = 1.0
	ter.amp = 0.5
	# ровные места: подъезд к порталу, дорога, площадки под постройку и трансформатор
	ter.flats = [[10.0, 4.5, 4.0, 8.0, 0.0], [20.0, -20.0, 9.0, 7.0, 0.15], [-20.0, -8.0, 4.0, 4.0, 0.1], [-12.0, 6.0, 4.0, 9.0, 0.05]]
	# насыпь над входом и бункером
	ter.mounds = [[10.0, -5.5, 8.5, 3.0], [5.6, 0.2, 3.8, 1.9], [14.4, 0.2, 3.8, 1.9], [3.0, -6.0, 6.0, 1.0], [-6.0, -24.0, 10.0, 0.7]]
	ter.roads = [[[0.0, 52.0], [0.0, 30.0], [5.0, 15.0], [10.0, 3.0]], [[0.0, 30.0], [-10.0, 18.0], [-14.0, 8.0]]]
	ter.road_width = 3.2
	ter.holes = [[10.0, -4.6, 3.1, 7.4]]
	_node(ter, S, Vector3.ZERO)
	ter.set_meta("no_batch", true)
	# сухая трава пучками (не на дорогах, не у входа и не в постройке)
	var gcount: int = [1800, 4200, 7000][Core.mobile.settings.quality] if not Engine.is_editor_hint() else 3000
	var grass := BCGrass.make(ter, gcount, 3, [Rect2(6.5, -8.0, 7.0, 14.0), Rect2(16.5, -23.0, 7.0, 6.0)])
	S.add_child(grass)
	# --- вход в бункер ---
	prop(S, "portal", Vector3(10.0, 0.0, -1.0), 0)
	door(S, "d_portal", Vector3(10.0, 0.0, -1.3), 0, "blast_double", 2.6, "Гермодвери убежища", true)
	light(S, "l_portal", Vector3(10.0, 2.85, -0.85), "bulkhead", "", Color(0.85, 0.92, 1.0), 1.2, 6.0, false, 0)
	# --- забор участка ---
	var fx0 := -38.0
	var fx1 := 38.0
	var fz0 := -44.0
	var fz1 := 30.0
	_fence_line(S, Vector3(fx0, 0, fz0), Vector3(fx1, 0, fz0))
	_fence_line(S, Vector3(fx0, 0, fz0), Vector3(fx0, 0, fz1))
	_fence_line(S, Vector3(fx1, 0, fz0), Vector3(fx1, 0, fz1))
	_fence_line(S, Vector3(fx0, 0, fz1), Vector3(-2.5, 0, fz1))
	_fence_line(S, Vector3(2.5, 0, fz1), Vector3(fx1, 0, fz1))
	var fm := Node3D.new()
	fm.name = "FenceMap"
	S.add_child(fm)
	fm.add_to_group("minimap")
	fm.set_meta("map_kind", "fence")
	fm.set_meta("map_rect", Rect2(fx0, fz0, fx1 - fx0, fz1 - fz0))
	var pm := Node3D.new()
	pm.position = Vector3(10, 0, -3.5)
	S.add_child(pm)
	pm.add_to_group("minimap")
	pm.set_meta("map_kind", "entrance")
	pm.set_meta("map_rect", Rect2(-2.2, -2.5, 4.4, 5.0))
	# --- постройки и техника ---
	prop(S, "truck", Vector3(-12.0, 0.05, 6.0), 28)
	var shed := prop(S, "shed", Vector3(20.0, 0.15, -20.0), -12, {"seed": 5})
	var roof := BCPrefabs.shed_roof()
	shed.add_child(roof)
	roof.add_to_group("roof")
	roof.set_meta("roof_tag", "shed")
	shed.add_to_group("minimap")
	shed.set_meta("map_kind", "building")
	shed.set_meta("map_rect", Rect2(-3.2, -2.3, 6.4, 4.6))
	zone(S, "building", "Разрушенная постройка", Vector3(20.0, 0.0, -20.0), Vector3(6.0, 3.0, 4.2), false, "building", -1.0, "shed", 5)
	spot(S, "filter", Vector3(18.4, 0.15, -20.8), "pickup", "Подобрать: фильтр противогаза", "", "filter", 0, Vector3(1.2, 2, 1.2))
	prop(S, "transformer", Vector3(-20.0, 0.1, -8.0), 15)
	prop(S, "water_tower", Vector3(-27.0, 0.0, -33.0), 10)
	# опоры ЛЭП вдоль дороги и провода
	var poles := [Vector3(-4.0, 0, 27.0), Vector3(-7.5, 0, 14.0), Vector3(-14.0, 0, 1.0), Vector3(-19.0, 0, -6.4)]
	for i in poles.size():
		prop(S, "power_pole", poles[i], 20 + i * 8, {"tilt": [0.0, 0.08, -0.05, 0.0][i]})
	_wires(S, poles)
	# вентиляционные шахты бункера
	prop(S, "vent_mushroom", Vector3(-14.0, 0.0, -26.0), 0)
	prop(S, "vent_mushroom", Vector3(-6.0, 0.0, -26.5), 0)
	prop(S, "vent_box", Vector3(3.4, 0.0, -16.0), 0)
	prop(S, "vent_mushroom", Vector3(9.0, 0.0, -26.0), 0)
	# мёртвые деревья
	var trees := [[-30, -20, 7.5], [-24, 12, 6.5], [-33, 18, 8.0], [26, 12, 7.0], [30, -34, 6.0], [-8, -38, 7.0], [16, -36, 6.5], [33, -8, 7.5], [-34, -38, 5.5], [24, 24, 6.0], [-18, 24, 6.8], [6, 20, 5.0]]
	for i in trees.size():
		prop(S, "dead_tree", Vector3(trees[i][0], 0.0, trees[i][1]), i * 37, {"seed": 100 + i, "height": trees[i][2]})
	# мусор, бочки, трубы, бетон
	prop(S, "pipe_pile", Vector3(17.0, 0.0, 5.0), 75)
	prop(S, "cable_reel", Vector3(14.0, 0.0, 8.5), 30)
	prop(S, "concrete_block", Vector3(3.0, 0.0, 9.0), 12)
	prop(S, "concrete_block", Vector3(4.2, 0.0, 10.1), -30)
	prop(S, "concrete_block", Vector3(-3.5, 0.0, 30.8), 0)
	prop(S, "concrete_block", Vector3(3.5, 0.0, 30.8), 0)
	prop(S, "rubble", Vector3(-6.0, 0.0, -4.0), 20, {"seed": 3})
	prop(S, "rubble", Vector3(26.0, 0.0, -16.0), 60, {"seed": 9})
	prop(S, "pallet", Vector3(5.0, 0.0, 2.6), 10)
	prop(S, "crate_military", Vector3(5.0, 0.15, 2.6), 5)
	prop(S, "crate_wood", Vector3(4.6, 0.0, 4.0), -20)
	prop(S, "ibc_tank", Vector3(3.0, 0.0, 3.4), 0)
	for b in [[22.0, -6.0, true], [22.8, -5.4, true], [23.4, -6.5, false], [21.6, -4.9, true], [16.0, -11.0, false]]:
		prop(S, "barrel", Vector3(b[0], 0.0, b[1]), randf() * 360.0, {"mat": "rust" if not b[2] else "paint_yellow", "rad": b[2]})
	prop(S, "tire", Vector3(-9.0, 0.0, 10.5), 0)
	prop(S, "tire", Vector3(-8.6, 0.3, 10.3), 20)
	for r in [[-25, -2, 1.2], [12, 18, 0.9], [28, 4, 1.4], [-16, -28, 1.1], [30, 22, 1.0], [-28, 28, 1.3]]:
		prop(S, "rock", Vector3(r[0], 0.0, r[1]), r[0] * 13.0, {"seed": r[0] + 50, "scale": r[2]})
	for pd in [[1.0, 18.0, 1.2], [8.0, 6.0, 0.8], [-10.0, 20.0, 1.0], [14.0, -10.0, 0.7]]:
		prop(S, "puddle", Vector3(pd[0], 0.0, pd[1]), 0, {"seed": int(pd[0]), "scale": pd[2], "collide": false})
	# знаки радиационной опасности
	for s in [[-1.0, 0.0, 30.4, 0], [24.0, 0.0, -3.6, 200], [-12.0, 0.0, 10.2, 160], [-37.6, 0.0, -10.0, 90], [37.6, 0.0, 6.0, -90], [7.2, 0.0, 1.2, 0]]:
		prop(S, "warning_sign", Vector3(s[0], s[1], s[2]), s[3])
	# вдали — градирни АЭС в тумане
	prop(S, "cooling_tower", Vector3(150.0, -2.0, -300.0), 0, {"collide": false, "shadows": false})
	prop(S, "cooling_tower", Vector3(225.0, -2.0, -280.0), 0, {"collide": false, "shadows": false})
	# источники радиации: кузов грузовика, протёкшие бочки, обломки
	if not Engine.is_editor_hint():
		Core.env.add_source(Vector3(-12.0, 0.0, 5.0), 34.0, 8.0)
		Core.env.add_source(Vector3(22.4, 0.0, -5.8), 26.0, 6.5)
		Core.env.add_source(Vector3(26.0, 0.0, -16.0), 9.0, 5.0)
	# зона поверхности
	zone(S, "surface", "Поверхность", Vector3(0, -1.0, 0), Vector3(100, 12, 100), false, "surface", -1.0, "", 0)
	return S


static func _fence_line(S: Node3D, a: Vector3, b: Vector3) -> void:
	var d := b - a
	var L := d.length()
	var n := maxi(1, int(L / 5.0))
	for i in n:
		var p0 := a + d * (float(i) / n)
		var p1 := a + d * (float(i + 1) / n)
		var mid := (p0 + p1) * 0.5
		prop(S, "fence", mid, rad_to_deg(atan2(-d.z, d.x)), {"length": L / n})


static func _wires(S: Node3D, poles: Array) -> void:
	var mk := BCMesh.new()
	for i in poles.size() - 1:
		for k in [-0.75, 0.0, 0.75]:
			var a: Vector3 = poles[i] + Vector3(k, 7.5, 0)
			var b: Vector3 = poles[i + 1] + Vector3(k, 7.5, 0)
			var prev := a
			for s in range(1, 9):
				var t := s / 8.0
				var p := a.lerp(b, t) + Vector3(0, -1.2 * 4.0 * t * (1.0 - t), 0)
				mk.pipe("black", Transform3D.IDENTITY, prev, p, 0.012, 3, false)
				prev = p
	BCKit.add_mesh(S, mk, "Wires", false)
