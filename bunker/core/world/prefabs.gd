class_name BCPrefabs
## Каталог готовых предметов BunkerCore. Каждый предмет — функция, которая наполняет сборщик сетки и список
## коллизий; размеры — настоящие (метры). Если в res://assets/models/<id>.glb лежит модель (Tripo и т.п.), она
## используется вместо процедурной, коллизия — по габариту из каталога.
## Bunker Editor берёт список отсюда (BCPrefabs.CATALOG) — добавлять предмет в каталог, а не в код сцен.

const CATALOG := {
	# --- бункер: жилое ---
	"bunk_bed": {"n": "Двухъярусная кровать", "cat": "Жилое", "size": Vector3(0.95, 1.75, 2.05)},
	"locker": {"n": "Шкафчик", "cat": "Жилое", "size": Vector3(0.48, 1.85, 0.5)},
	"nightstand": {"n": "Тумбочка", "cat": "Жилое", "size": Vector3(0.45, 0.55, 0.42)},
	"desk": {"n": "Стол", "cat": "Жилое", "size": Vector3(1.2, 0.76, 0.62)},
	"chair": {"n": "Стул", "cat": "Жилое", "size": Vector3(0.46, 0.9, 0.48)},
	"rug": {"n": "Ковёр", "cat": "Жилое", "size": Vector3(2.0, 0.02, 1.4)},
	"table_metal": {"n": "Металлический стол", "cat": "Жилое", "size": Vector3(1.6, 0.8, 0.8)},
	# --- медпункт ---
	"med_bed": {"n": "Медицинская кровать", "cat": "Медпункт", "size": Vector3(0.95, 0.85, 2.05)},
	"med_cabinet": {"n": "Медицинский шкаф", "cat": "Медпункт", "size": Vector3(1.0, 1.85, 0.45)},
	"med_cart": {"n": "Тележка с приборами", "cat": "Медпункт", "size": Vector3(0.6, 1.0, 0.45)},
	"iv_stand": {"n": "Капельница", "cat": "Медпункт", "size": Vector3(0.45, 1.9, 0.45)},
	"first_aid": {"n": "Аптечка на стене", "cat": "Медпункт", "size": Vector3(0.5, 0.4, 0.16)},
	"scanner": {"n": "Дозиметрическая установка", "cat": "Медпункт", "size": Vector3(0.8, 1.6, 0.7)},
	# --- мастерская ---
	"workbench": {"n": "Верстак", "cat": "Мастерская", "size": Vector3(2.0, 0.92, 0.75)},
	"tool_board": {"n": "Щит с инструментами", "cat": "Мастерская", "size": Vector3(1.6, 1.0, 0.1)},
	"shelf_rack": {"n": "Стеллаж", "cat": "Склад", "size": Vector3(1.8, 2.0, 0.55)},
	"gas_cylinders": {"n": "Газовые баллоны", "cat": "Мастерская", "size": Vector3(0.6, 1.5, 0.35)},
	"welder": {"n": "Сварочный аппарат", "cat": "Мастерская", "size": Vector3(0.6, 0.95, 0.5)},
	"machine": {"n": "Станок", "cat": "Мастерская", "size": Vector3(1.1, 1.0, 0.7)},
	# --- электростанция ---
	"generator": {"n": "Дизельный генератор", "cat": "Энергия", "size": Vector3(3.0, 1.7, 1.3)},
	"elec_cabinet": {"n": "Электрощит", "cat": "Энергия", "size": Vector3(1.0, 1.9, 0.45)},
	"fuel_tank": {"n": "Топливный бак", "cat": "Энергия", "size": Vector3(2.0, 1.3, 1.0)},
	"fan_unit": {"n": "Вентустановка", "cat": "Энергия", "size": Vector3(1.4, 1.4, 1.0)},
	"pipes_wall": {"n": "Трубы вдоль стены", "cat": "Энергия", "size": Vector3(4.0, 0.5, 0.3)},
	# --- склад ---
	"crate_wood": {"n": "Ящик деревянный", "cat": "Склад", "size": Vector3(0.8, 0.6, 0.6)},
	"crate_military": {"n": "Ящик военный", "cat": "Склад", "size": Vector3(0.9, 0.45, 0.5)},
	"cardboard": {"n": "Коробка", "cat": "Склад", "size": Vector3(0.5, 0.4, 0.4)},
	"barrel": {"n": "Бочка", "cat": "Склад", "size": Vector3(0.6, 0.9, 0.6)},
	"pallet": {"n": "Поддон", "cat": "Склад", "size": Vector3(1.2, 0.15, 0.8)},
	"water_tank": {"n": "Бак с водой", "cat": "Склад", "size": Vector3(1.2, 2.2, 1.2)},
	# --- теплица ---
	"grow_rack": {"n": "Стеллаж с растениями", "cat": "Теплица", "size": Vector3(1.8, 1.9, 0.6)},
	# --- управление ---
	"console": {"n": "Пульт управления", "cat": "Управление", "size": Vector3(2.0, 1.25, 0.85)},
	"monitor_bank": {"n": "Мониторы", "cat": "Управление", "size": Vector3(1.8, 0.9, 0.35)},
	"radio_set": {"n": "Радиостанция", "cat": "Управление", "size": Vector3(0.8, 0.5, 0.45)},
	"map_board": {"n": "Карта на стене", "cat": "Управление", "size": Vector3(1.6, 1.1, 0.05)},
	# --- шлюз ---
	"decon_shower": {"n": "Дезактивационная камера", "cat": "Шлюз", "size": Vector3(1.5, 2.4, 1.5)},
	"suit_locker": {"n": "Шкаф с защитным костюмом", "cat": "Шлюз", "size": Vector3(1.0, 2.15, 0.6)},
	"floor_grate": {"n": "Решётка в полу", "cat": "Шлюз", "size": Vector3(1.2, 0.03, 0.6)},
	# --- поверхность ---
	"portal": {"n": "Вход в бункер", "cat": "Поверхность", "size": Vector3(6.4, 3.6, 6.0)},
	"fence": {"n": "Забор (участок)", "cat": "Поверхность", "size": Vector3(5.0, 2.6, 0.2)},
	"warning_sign": {"n": "Знак радиации", "cat": "Поверхность", "size": Vector3(0.6, 1.8, 0.1)},
	"power_pole": {"n": "Опора ЛЭП", "cat": "Поверхность", "size": Vector3(1.8, 8.0, 0.3)},
	"transformer": {"n": "Трансформатор", "cat": "Поверхность", "size": Vector3(1.8, 2.6, 1.4)},
	"dead_tree": {"n": "Мёртвое дерево", "cat": "Поверхность", "size": Vector3(0.6, 7.0, 0.6)},
	"truck": {"n": "Брошенный грузовик", "cat": "Поверхность", "size": Vector3(2.5, 2.9, 7.2)},
	"shed": {"n": "Разрушенная постройка", "cat": "Поверхность", "size": Vector3(6.4, 3.2, 4.6)},
	"concrete_block": {"n": "Бетонный блок", "cat": "Поверхность", "size": Vector3(1.6, 0.6, 0.6)},
	"pipe_pile": {"n": "Трубы", "cat": "Поверхность", "size": Vector3(3.2, 0.7, 1.2)},
	"cable_reel": {"n": "Кабельная катушка", "cat": "Поверхность", "size": Vector3(1.1, 1.1, 0.7)},
	"tire": {"n": "Покрышка", "cat": "Поверхность", "size": Vector3(0.9, 0.3, 0.9)},
	"rock": {"n": "Камень", "cat": "Поверхность", "size": Vector3(1.2, 0.8, 1.0)},
	"rubble": {"n": "Обломки бетона", "cat": "Поверхность", "size": Vector3(2.4, 0.7, 2.0)},
	"vent_mushroom": {"n": "Вентшахта (грибок)", "cat": "Поверхность", "size": Vector3(1.0, 1.6, 1.0)},
	"vent_box": {"n": "Вентшахта (короб)", "cat": "Поверхность", "size": Vector3(1.6, 1.4, 1.6)},
	"water_tower": {"n": "Водонапорная башня", "cat": "Поверхность", "size": Vector3(4.0, 12.0, 4.0)},
	"ibc_tank": {"n": "Еврокуб", "cat": "Поверхность", "size": Vector3(1.2, 1.15, 1.0)},
	"puddle": {"n": "Лужа", "cat": "Поверхность", "size": Vector3(3.0, 0.01, 2.0)},
	"cooling_tower": {"n": "Градирня (вдали)", "cat": "Фон", "size": Vector3(60, 90, 60)},
}


## построить предмет: узел с сеткой и коллизией
static func build(id: String, p := {}) -> Node3D:
	var root := Node3D.new()
	root.name = id
	var glb := "res://assets/models/%s.glb" % id
	var info: Dictionary = CATALOG.get(id, {"size": Vector3.ONE})
	var mk := BCMesh.new()
	var col := []
	if ResourceLoader.exists(glb) and not p.get("procedural", false):
		var sc: PackedScene = load(glb)
		var inst: Node3D = sc.instantiate()
		# модели Tripo смотрят «вперёд» по +X, в BunkerCore «вперёд» — +Z
		var holder := Node3D.new()
		holder.rotation.y = deg_to_rad(info.get("yaw", -90.0))
		holder.add_child(inst)
		root.add_child(holder)
		var sz: Vector3 = info.size
		_fit(holder, sz)
		col.append([sz, Vector3(0, sz.y * 0.5, 0)])
	else:
		var fn := "_" + id
		if not Callable(BCPrefabs, fn).is_valid():
			push_warning("BCPrefabs: нет предмета " + id)
			mk.box("paint_red", Transform3D.IDENTITY, Vector3(0.5, 0.5, 0.5), Vector3(0, 0.25, 0))
		else:
			Callable(BCPrefabs, fn).call(mk, col, p)
		var mi := mk.to_instance(p.get("shadows", true))
		mi.name = "Mesh"
		root.add_child(mi)
	if p.get("collide", true) and not col.is_empty():
		BCKit.static_boxes(root, col)
	return root


## модель из файла — по размеру из каталога: высота как в каталоге, низ на полу, по центру
static func _fit(inst: Node3D, sz: Vector3) -> void:
	var box := AABB()
	var first := true
	var rot := Transform3D(inst.transform.basis, Vector3.ZERO)
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		var xf := Transform3D.IDENTITY
		var n: Node = mi
		while n and n != inst:
			if n is Node3D:
				xf = (n as Node3D).transform * xf
			n = n.get_parent()
		xf = rot * xf
		var a: AABB = xf * (mi as MeshInstance3D).get_aabb()
		box = a if first else box.merge(a)
		first = false
	if first or box.size.y <= 0.0:
		return
	var k := sz.y / box.size.y
	# не шире габарита из каталога
	var kx := sz.x / maxf(box.size.x, 0.001)
	var kz := sz.z / maxf(box.size.z, 0.001)
	k = minf(k, maxf(kx, kz) * 1.15)
	var c := box.get_center()
	# поворот держателя сохраняется, масштаб — общий
	inst.transform.basis = Basis(rot.basis.get_rotation_quaternion()).scaled(Vector3.ONE * k)
	inst.position = Vector3(-c.x * k, -box.position.y * k, -c.z * k)
	for mi in inst.find_children("*", "MeshInstance3D", true, false):
		(mi as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON


static func _rng(p: Dictionary) -> RandomNumberGenerator:
	var r := RandomNumberGenerator.new()
	r.seed = int(p.get("seed", 1))
	return r


const I := Transform3D.IDENTITY


# ======================= БУНКЕР: ЖИЛОЕ =======================

static func _bunk_bed(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var w := 0.95
	var L := 2.0
	for x in [-w * 0.5 + 0.03, w * 0.5 - 0.03]:
		for z in [-L * 0.5 + 0.03, L * 0.5 - 0.03]:
			mk.pipe("paint_green", I, Vector3(x, 0, z), Vector3(x, 1.75, z), 0.025, 8)
	for y in [0.32, 1.27]:
		for x in [-w * 0.5 + 0.03, w * 0.5 - 0.03]:
			mk.pipe("paint_green", I, Vector3(x, y, -L * 0.5), Vector3(x, y, L * 0.5), 0.02, 6)
		for z in [-L * 0.5 + 0.03, L * 0.5 - 0.03]:
			mk.pipe("paint_green", I, Vector3(-w * 0.5, y, z), Vector3(w * 0.5, y, z), 0.02, 6)
		mk.box("steel_dark", I, Vector3(w - 0.08, 0.02, L - 0.08), Vector3(0, y, 0))
		mk.box("mattress", I, Vector3(w - 0.1, 0.14, L - 0.1), Vector3(0, y + 0.08, 0))
		mk.box("fabric_khaki", I, Vector3(w - 0.08, 0.05, L * 0.62), Vector3(0, y + 0.17, L * 0.16))
		mk.box("fabric_white", I, Vector3(0.55, 0.1, 0.32), Vector3(0, y + 0.2, -L * 0.5 + 0.25))
	# лесенка
	for y in [0.55, 0.8, 1.05]:
		mk.pipe("paint_green", I, Vector3(w * 0.5, y, L * 0.5 - 0.35), Vector3(w * 0.5, y, L * 0.5 - 0.03), 0.015, 6)
	for x in [-1.0, 1.0]:
		mk.box("paint_green", I, Vector3(0.03, 0.18, L - 0.1), Vector3(x * (w * 0.5 - 0.03), 1.55, 0))
	col.append([Vector3(w, 1.75, L), Vector3(0, 0.875, 0)])


static func _locker(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var n := int(p.get("count", 1))
	var w := 0.48
	for i in n:
		var x := (i - (n - 1) * 0.5) * w
		mk.box("paint_grey", I, Vector3(w - 0.01, 1.85, 0.5), Vector3(x, 0.925, 0))
		mk.box("steel_dark", I, Vector3(w - 0.06, 1.75, 0.01), Vector3(x, 0.93, 0.255))
		mk.box("paint_grey", I, Vector3(w - 0.08, 1.72, 0.012), Vector3(x, 0.93, 0.26))
		for k in 4:
			mk.box("steel_dark", I, Vector3(0.22, 0.012, 0.012), Vector3(x, 1.6 + k * 0.035, 0.27))
		mk.box("chrome", I, Vector3(0.03, 0.12, 0.03), Vector3(x + w * 0.32, 1.0, 0.28))
	col.append([Vector3(w * n, 1.85, 0.5), Vector3(0, 0.925, 0)])


static func _nightstand(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_olive", I, Vector3(0.45, 0.55, 0.42), Vector3(0, 0.275, 0))
	mk.box("steel_dark", I, Vector3(0.4, 0.2, 0.01), Vector3(0, 0.4, 0.215))
	mk.box("chrome", I, Vector3(0.12, 0.02, 0.03), Vector3(0, 0.42, 0.23))
	if p.get("lamp", true):
		mk.cyl("steel_dark", I, 0.07, 0.02, Vector3(0, 0.55, -0.05), 10)
		mk.pipe("steel_dark", I, Vector3(0, 0.56, -0.05), Vector3(0.03, 0.82, -0.08), 0.01, 6)
		mk.cyl("paint_green", I, 0.09, 0.12, Vector3(0.05, 0.76, -0.08), 10, false, 0.04)
		mk.sphere("lamp_warm", I, 0.035, Vector3(0.05, 0.75, -0.08), 8, 5)
	mk.box("paper" if false else "fabric_white", I, Vector3(0.18, 0.03, 0.12), Vector3(-0.1, 0.565, 0.08))
	col.append([Vector3(0.45, 0.55, 0.42), Vector3(0, 0.275, 0)])


static func _desk(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_grey", I, Vector3(1.2, 0.04, 0.62), Vector3(0, 0.74, 0))
	mk.box("paint_grey", I, Vector3(0.42, 0.72, 0.58), Vector3(0.37, 0.36, 0))
	for k in 3:
		mk.box("steel_dark", I, Vector3(0.38, 0.005, 0.01), Vector3(0.37, 0.2 + k * 0.22, 0.295))
		mk.box("chrome", I, Vector3(0.1, 0.015, 0.02), Vector3(0.37, 0.28 + k * 0.22, 0.3))
	mk.box("paint_grey", I, Vector3(0.03, 0.72, 0.58), Vector3(-0.58, 0.36, 0))
	mk.box("fabric_white", I, Vector3(0.3, 0.005, 0.21), Vector3(-0.2, 0.765, 0.05))
	mk.cyl("steel_dark", I, 0.04, 0.1, Vector3(-0.45, 0.76, -0.18), 8)
	col.append([Vector3(1.2, 0.76, 0.62), Vector3(0, 0.38, 0)])


static func _chair(mk: BCMesh, col: Array, p: Dictionary) -> void:
	for x in [-0.2, 0.2]:
		for z in [-0.2, 0.2]:
			mk.pipe("steel_dark", I, Vector3(x, 0, z), Vector3(x, 0.45, z), 0.012, 6)
	mk.box("wood", I, Vector3(0.44, 0.03, 0.44), Vector3(0, 0.46, 0))
	mk.pipe("steel_dark", I, Vector3(-0.2, 0.45, -0.2), Vector3(-0.2, 0.9, -0.22), 0.012, 6)
	mk.pipe("steel_dark", I, Vector3(0.2, 0.45, -0.2), Vector3(0.2, 0.9, -0.22), 0.012, 6)
	mk.box("wood", I, Vector3(0.42, 0.2, 0.025), Vector3(0, 0.78, -0.215))
	col.append([Vector3(0.46, 0.9, 0.48), Vector3(0, 0.45, 0)])


static func _rug(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_red", I, Vector3(2.0, 0.012, 1.4), Vector3(0, 0.006, 0))
	mk.box("fabric_khaki", I, Vector3(1.7, 0.014, 1.1), Vector3(0, 0.007, 0))
	mk.box("paint_red", I, Vector3(1.1, 0.016, 0.55), Vector3(0, 0.008, 0))


static func _table_metal(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("metal_plate", I, Vector3(1.6, 0.05, 0.8), Vector3(0, 0.775, 0))
	for x in [-0.74, 0.74]:
		for z in [-0.34, 0.34]:
			mk.box("steel_dark", I, Vector3(0.05, 0.75, 0.05), Vector3(x, 0.375, z))
	mk.box("steel_dark", I, Vector3(1.5, 0.03, 0.7), Vector3(0, 0.18, 0))
	col.append([Vector3(1.6, 0.8, 0.8), Vector3(0, 0.4, 0)])


# ======================= МЕДПУНКТ =======================

static func _med_bed(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("chrome", I, Vector3(0.9, 0.06, 2.0), Vector3(0, 0.55, 0))
	for x in [-0.4, 0.4]:
		for z in [-0.9, 0.9]:
			mk.pipe("chrome", I, Vector3(x, 0.08, z), Vector3(x, 0.55, z), 0.02, 6)
			mk.cyl("rubber", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(x, 0.05, z)), 0.05, 0.04, Vector3(0, -0.02, 0), 8)
	mk.box("fabric_white", I, Vector3(0.86, 0.12, 1.96), Vector3(0, 0.64, 0))
	mk.box("paint_blue", I, Vector3(0.88, 0.04, 1.2), Vector3(0, 0.715, 0.35))
	mk.box("fabric_white", I, Vector3(0.55, 0.1, 0.3), Vector3(0, 0.75, -0.75))
	mk.box("chrome", I, Vector3(0.9, 0.55, 0.04), Vector3(0, 0.82, -1.0))
	for x in [-0.46, 0.46]:
		mk.pipe("chrome", I, Vector3(x, 0.8, -0.6), Vector3(x, 0.8, 0.6), 0.015, 6)
		mk.pipe("chrome", I, Vector3(x, 0.6, -0.6), Vector3(x, 0.8, -0.6), 0.012, 6)
		mk.pipe("chrome", I, Vector3(x, 0.6, 0.6), Vector3(x, 0.8, 0.6), 0.012, 6)
	col.append([Vector3(0.95, 0.85, 2.05), Vector3(0, 0.425, 0)])


static func _med_cabinet(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_white", I, Vector3(1.0, 1.85, 0.45), Vector3(0, 0.925, 0))
	mk.box("steel_dark", I, Vector3(0.94, 0.95, 0.4), Vector3(0, 1.3, 0.03))
	var r := _rng(p)
	for sh in 3:
		var y := 0.88 + sh * 0.3
		mk.box("paint_white", I, Vector3(0.92, 0.02, 0.38), Vector3(0, y, 0.03))
		for k in 7:
			var x := -0.38 + k * 0.125 + r.randf_range(-0.02, 0.02)
			var h := r.randf_range(0.1, 0.2)
			mk.cyl(["plastic_white", "paint_blue", "glass", "paint_red"][r.randi() % 4], I, r.randf_range(0.025, 0.04), h, Vector3(x, y + 0.01, 0.05), 8)
	mk.box("glass", I, Vector3(0.94, 0.95, 0.01), Vector3(0, 1.3, 0.23))
	mk.box("steel_dark", I, Vector3(0.02, 0.95, 0.02), Vector3(0, 1.3, 0.235))
	for k in 2:
		mk.box("steel_dark", I, Vector3(0.45, 0.005, 0.01), Vector3(-0.23 + k * 0.46, 0.4, 0.226))
	mk.box("paint_red", I, Vector3(0.2, 0.06, 0.005), Vector3(0, 1.72, 0.229))
	mk.box("paint_red", I, Vector3(0.06, 0.2, 0.005), Vector3(0, 1.72, 0.229))
	col.append([Vector3(1.0, 1.85, 0.45), Vector3(0, 0.925, 0)])


static func _med_cart(mk: BCMesh, col: Array, p: Dictionary) -> void:
	for y in [0.15, 0.5, 0.85]:
		mk.box("chrome", I, Vector3(0.58, 0.02, 0.42), Vector3(0, y, 0))
	for x in [-0.28, 0.28]:
		for z in [-0.2, 0.2]:
			mk.pipe("chrome", I, Vector3(x, 0.05, z), Vector3(x, 0.9, z), 0.01, 5)
	mk.box("plastic_white", I, Vector3(0.36, 0.25, 0.28), Vector3(0, 1.0, -0.02))
	mk.box("screen_green", I, Vector3(0.26, 0.15, 0.005), Vector3(0, 1.03, 0.122))
	mk.box("plastic_dark", I, Vector3(0.3, 0.12, 0.25), Vector3(0.05, 0.57, 0))
	col.append([Vector3(0.6, 1.0, 0.45), Vector3(0, 0.5, 0)])


static func _iv_stand(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.pipe("chrome", I, Vector3(0, 0.05, 0), Vector3(0, 1.85, 0), 0.012, 6)
	for k in 5:
		var a := TAU * k / 5.0
		mk.pipe("chrome", I, Vector3(0, 0.06, 0), Vector3(cos(a) * 0.22, 0.03, sin(a) * 0.22), 0.01, 5)
	mk.pipe("chrome", I, Vector3(-0.12, 1.82, 0), Vector3(0.12, 1.82, 0), 0.008, 5)
	mk.box("glass", I, Vector3(0.09, 0.16, 0.04), Vector3(0.1, 1.68, 0))
	col.append([Vector3(0.3, 1.9, 0.3), Vector3(0, 0.95, 0)])


static func _first_aid(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_white", I, Vector3(0.5, 0.4, 0.15), Vector3(0, 0.2, 0.075))
	mk.box("paint_red", I, Vector3(0.18, 0.05, 0.005), Vector3(0, 0.2, 0.152))
	mk.box("paint_red", I, Vector3(0.05, 0.18, 0.005), Vector3(0, 0.2, 0.152))


static func _scanner(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_white", I, Vector3(0.8, 0.12, 0.7), Vector3(0, 0.06, 0))
	mk.box("paint_white", I, Vector3(0.12, 1.6, 0.6), Vector3(-0.34, 0.8, 0))
	mk.box("paint_white", I, Vector3(0.12, 1.6, 0.6), Vector3(0.34, 0.8, 0))
	mk.box("paint_white", I, Vector3(0.8, 0.15, 0.6), Vector3(0, 1.55, 0))
	mk.box("led_green", I, Vector3(0.6, 0.02, 0.02), Vector3(0, 1.47, 0.29))
	mk.box("screen_blue", I, Vector3(0.008, 0.2, 0.3), Vector3(0.405, 1.2, 0))
	col.append([Vector3(0.12, 1.6, 0.7), Vector3(-0.34, 0.8, 0)])
	col.append([Vector3(0.12, 1.6, 0.7), Vector3(0.34, 0.8, 0)])


# ======================= МАСТЕРСКАЯ =======================

static func _workbench(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("wood_old", I, Vector3(2.0, 0.06, 0.75), Vector3(0, 0.89, 0))
	for x in [-0.95, 0.95]:
		for z in [-0.32, 0.32]:
			mk.box("steel_dark", I, Vector3(0.05, 0.86, 0.05), Vector3(x, 0.43, z))
	mk.box("paint_red", I, Vector3(0.55, 0.7, 0.68), Vector3(0.68, 0.43, 0))
	for k in 4:
		mk.box("steel_dark", I, Vector3(0.5, 0.005, 0.01), Vector3(0.68, 0.2 + k * 0.16, 0.345))
		mk.box("chrome", I, Vector3(0.14, 0.015, 0.02), Vector3(0.68, 0.24 + k * 0.16, 0.35))
	mk.box("metal_plate", I, Vector3(1.8, 0.03, 0.6), Vector3(-0.1, 0.15, 0))
	# тиски
	mk.box("paint_blue", I, Vector3(0.18, 0.12, 0.2), Vector3(-0.7, 0.98, 0.25))
	mk.box("paint_blue", I, Vector3(0.18, 0.1, 0.06), Vector3(-0.7, 1.04, 0.38))
	mk.pipe("chrome", I, Vector3(-0.7, 1.0, 0.4), Vector3(-0.7, 1.0, 0.52), 0.01, 6)
	mk.pipe("chrome", I, Vector3(-0.78, 1.0, 0.52), Vector3(-0.62, 1.0, 0.52), 0.008, 5)
	var r := _rng(p)
	for k in 6:
		mk.box(["steel", "paint_red", "steel_dark", "paint_yellow"][r.randi() % 4], Transform3D(Basis(Vector3.UP, r.randf() * TAU), Vector3(r.randf_range(-0.4, 0.4), 0.93, r.randf_range(-0.25, 0.25))), Vector3(r.randf_range(0.08, 0.25), 0.03, r.randf_range(0.03, 0.08)))
	col.append([Vector3(2.0, 0.92, 0.75), Vector3(0, 0.46, 0)])


static func _tool_board(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_grey", I, Vector3(1.6, 1.0, 0.03), Vector3(0, 0.5, 0.015))
	for k in 8:
		var x := -0.65 + k * 0.18
		mk.box("chrome", I, Vector3(0.025, 0.24 + (k % 3) * 0.05, 0.02), Vector3(x, 0.62, 0.05))
		mk.box("steel_dark", I, Vector3(0.06, 0.04, 0.025), Vector3(x, 0.76 + (k % 3) * 0.025, 0.05))
	for k in 5:
		mk.pipe("paint_red", I, Vector3(-0.6 + k * 0.28, 0.2, 0.06), Vector3(-0.6 + k * 0.28, 0.38, 0.06), 0.015, 6)
		mk.box("chrome", I, Vector3(0.02, 0.12, 0.015), Vector3(-0.6 + k * 0.28, 0.44, 0.06))
	mk.cyl("steel_dark", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0.6, 0.3, 0.06)), 0.12, 0.03, Vector3.ZERO, 14)


static func _shelf_rack(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var w := 1.8
	var d := 0.55
	for x in [-w * 0.5 + 0.02, w * 0.5 - 0.02]:
		for z in [-d * 0.5 + 0.02, d * 0.5 - 0.02]:
			mk.box("paint_blue" if p.get("blue", false) else "paint_grey", I, Vector3(0.04, 2.0, 0.04), Vector3(x, 1.0, z))
	var r := _rng(p)
	var fill: float = p.get("fill", 0.8)
	for s in 4:
		var y := 0.1 + s * 0.6
		mk.box("metal_plate", I, Vector3(w, 0.03, d), Vector3(0, y, 0))
		if s == 3:
			continue
		var x := -w * 0.5 + 0.05
		while x < w * 0.5 - 0.3:
			var bw := r.randf_range(0.3, 0.55)
			if r.randf() < fill and x + bw < w * 0.5 - 0.03:
				var kind := r.randi() % 4
				var bh := r.randf_range(0.2, 0.45)
				var mat = ["cardboard", "crate_green", "paint_olive", "cardboard"][kind]
				if kind == 3:
					mk.cyl("steel", I, 0.08, 0.13, Vector3(x + 0.1, y + 0.015, 0.05), 10)
					mk.cyl("steel", I, 0.08, 0.13, Vector3(x + 0.27, y + 0.015, -0.05), 10)
				else:
					mk.box(mat, I, Vector3(bw - 0.03, bh, d - 0.08), Vector3(x + bw * 0.5, y + 0.015 + bh * 0.5, 0))
					if kind == 1:
						mk.box("steel_dark", I, Vector3(0.05, 0.04, 0.01), Vector3(x + bw * 0.5, y + bh * 0.6, (d - 0.08) * 0.5 + 0.005))
			x += bw
	col.append([Vector3(w, 2.0, d), Vector3(0, 1.0, 0)])


static func _gas_cylinders(mk: BCMesh, col: Array, p: Dictionary) -> void:
	for k in 2:
		var x := -0.14 + k * 0.28
		mk.cyl(["paint_red", "paint_blue"][k], I, 0.12, 1.25, Vector3(x, 0, 0), 12, true, 0.12)
		mk.sphere(["paint_red", "paint_blue"][k], I, 0.12, Vector3(x, 1.25, 0), 12, 6, Vector3(1, 0.6, 1))
		mk.cyl("chrome", I, 0.03, 0.12, Vector3(x, 1.3, 0), 8)
	mk.pipe("steel_dark", I, Vector3(-0.3, 0.9, -0.13), Vector3(0.3, 0.9, -0.13), 0.01, 5)
	col.append([Vector3(0.6, 1.5, 0.3), Vector3(0, 0.75, 0)])


static func _welder(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_red", I, Vector3(0.5, 0.55, 0.42), Vector3(0, 0.55, 0))
	mk.box("steel_dark", I, Vector3(0.46, 0.2, 0.01), Vector3(0, 0.62, 0.215))
	mk.cyl("plastic_white", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(-0.12, 0.68, 0.22)), 0.05, 0.02, Vector3.ZERO, 10)
	mk.cyl("plastic_white", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0.1, 0.68, 0.22)), 0.04, 0.02, Vector3.ZERO, 10)
	mk.box("steel_dark", I, Vector3(0.5, 0.04, 0.42), Vector3(0, 0.25, 0))
	for x in [-0.22, 0.22]:
		mk.cyl("rubber", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(x, 0.11, -0.15)), 0.1, 0.05, Vector3(0, -0.025, 0), 10)
	mk.pipe("steel_dark", I, Vector3(-0.2, 0.25, 0.15), Vector3(-0.2, 0.25, 0.15), 0.01)
	# кабель
	var a := Vector3(0.25, 0.6, 0.0)
	for k in 6:
		var b := a + Vector3(0.08, -0.1, 0.05 * sin(k))
		mk.pipe("rubber", I, a, b, 0.015, 5)
		a = b
	col.append([Vector3(0.6, 0.95, 0.5), Vector3(0, 0.47, 0)])


static func _machine(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_green", I, Vector3(1.1, 0.75, 0.6), Vector3(0, 0.375, 0))
	mk.box("paint_green", I, Vector3(0.3, 0.35, 0.5), Vector3(-0.35, 0.92, 0))
	mk.pipe("chrome", I, Vector3(-0.2, 0.9, 0), Vector3(0.45, 0.9, 0), 0.04, 10)
	mk.cyl("steel_dark", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(-0.55, 0.92, 0)), 0.12, 0.08, Vector3.ZERO, 12)
	mk.box("hazard", I, Vector3(1.12, 0.06, 0.62), Vector3(0, 0.03, 0))
	col.append([Vector3(1.1, 1.0, 0.7), Vector3(0, 0.5, 0)])


# ======================= ЭЛЕКТРОСТАНЦИЯ =======================

static func _generator(mk: BCMesh, col: Array, p: Dictionary) -> void:
	# рама
	mk.box("steel_dark", I, Vector3(3.0, 0.18, 1.3), Vector3(0, 0.09, 0))
	# двигатель
	mk.box("paint_yellow", I, Vector3(1.5, 0.85, 0.9), Vector3(-0.5, 0.6, 0))
	for k in 6:
		mk.box("paint_yellow", I, Vector3(0.2, 0.22, 0.32), Vector3(-1.05 + k * 0.22, 1.12, 0))
		mk.cyl("steel_dark", I, 0.03, 0.08, Vector3(-1.05 + k * 0.22, 1.23, 0.08), 6)
	mk.box("steel_dark", I, Vector3(1.4, 0.06, 0.12), Vector3(-0.5, 1.25, -0.2))
	# генератор (цилиндр)
	mk.cyl("paint_yellow", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(0.75, 0.68, 0)), 0.48, 0.9, Vector3(0, -0.45, 0), 18)
	for k in 8:
		mk.box("steel_dark", I, Vector3(0.9, 0.02, 0.02), Vector3(0.75, 0.68 + 0.45 * sin(TAU * k / 8.0), 0.45 * cos(TAU * k / 8.0)))
	# радиатор
	mk.box("paint_yellow", I, Vector3(0.25, 1.15, 1.2), Vector3(-1.38, 0.75, 0))
	mk.box("steel_dark", I, Vector3(0.02, 0.95, 1.0), Vector3(-1.51, 0.75, 0))
	# пульт с лампами
	mk.box("paint_grey", I, Vector3(0.45, 0.55, 0.25), Vector3(0.9, 1.4, 0.35))
	mk.box("screen_green", I, Vector3(0.2, 0.1, 0.005), Vector3(0.85, 1.48, 0.476))
	mk.sphere("led_red", I, 0.02, Vector3(1.05, 1.52, 0.48), 6, 4)
	mk.sphere("led_green", I, 0.02, Vector3(1.05, 1.44, 0.48), 6, 4)
	# выхлоп и трубы
	mk.pipe("steel", I, Vector3(-0.6, 1.25, -0.25), Vector3(-0.6, 1.75, -0.25), 0.1, 12)
	mk.pipe("steel", I, Vector3(-0.6, 1.75, -0.25), Vector3(-0.6, 1.75, -1.9), 0.1, 12)
	mk.cyl("rubber", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(-0.6, 1.75, -1.0)), 0.13, 0.3, Vector3(0, -0.15, 0), 12)
	mk.pipe("rust", I, Vector3(-0.2, 1.0, -0.45), Vector3(-0.2, 1.0, -1.9), 0.06, 10)
	mk.box("hazard", I, Vector3(3.2, 0.012, 1.5), Vector3(0, 0.006, 0))
	col.append([Vector3(3.0, 1.7, 1.3), Vector3(0, 0.85, 0)])


static func _elec_cabinet(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_grey", I, Vector3(1.0, 1.9, 0.45), Vector3(0, 0.95, 0))
	mk.box("steel_dark", I, Vector3(0.01, 1.8, 0.01), Vector3(0, 0.95, 0.23))
	for k in 4:
		var y := 1.55 - k * 0.25
		mk.cyl("plastic_white", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(-0.25, y, 0.23)), 0.06, 0.02, Vector3.ZERO, 12)
		mk.sphere(["led_green", "led_green", "led_amber", "led_red"][k], I, 0.018, Vector3(0.25, y, 0.235), 6, 4)
	mk.box("paint_yellow", I, Vector3(0.22, 0.18, 0.005), Vector3(0.25, 0.5, 0.228))
	mk.box("black", I, Vector3(0.1, 0.08, 0.006), Vector3(0.25, 0.5, 0.23))
	mk.box("steel_dark", I, Vector3(0.05, 0.15, 0.04), Vector3(0.42, 0.95, 0.24))
	mk.pipe("rubber", I, Vector3(-0.3, 1.9, -0.1), Vector3(-0.3, 1.9, -0.24), 0.04, 8)
	mk.box("steel_dark", I, Vector3(0.8, 0.12, 0.12), Vector3(-0.1, 1.98, -0.17))
	col.append([Vector3(1.0, 1.9, 0.45), Vector3(0, 0.95, 0)])


static func _fuel_tank(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.cyl("rust", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(0, 0.75, 0)), 0.5, 1.8, Vector3(0, -0.9, 0), 18)
	for x in [-0.6, 0.6]:
		mk.box("steel_dark", I, Vector3(0.12, 0.3, 0.9), Vector3(x, 0.15, 0))
	mk.cyl("steel_dark", I, 0.08, 0.15, Vector3(0.3, 1.24, 0), 8)
	mk.box("paint_yellow", I, Vector3(0.5, 0.25, 0.005), Vector3(0, 0.8, 0.505))
	col.append([Vector3(2.0, 1.3, 1.0), Vector3(0, 0.65, 0)])


static func _fan_unit(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_grey", I, Vector3(1.4, 1.4, 1.0), Vector3(0, 0.7, 0))
	mk.cyl("steel_dark", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 0.75, 0.5)), 0.55, 0.04, Vector3.ZERO, 20)
	for k in 6:
		var a := TAU * k / 6.0
		mk.box("steel", Transform3D(Basis(Vector3.BACK, a), Vector3(0, 0.75, 0.53)), Vector3(0.45, 0.1, 0.01), Vector3(0.24, 0, 0))
	for k in 8:
		mk.box("steel_dark", I, Vector3(1.1, 0.012, 0.012), Vector3(0, 0.3 + k * 0.13, 0.555))
	mk.box("steel", I, Vector3(0.7, 0.6, 0.9), Vector3(0, 1.0, -0.95))
	col.append([Vector3(1.4, 1.4, 1.0), Vector3(0, 0.7, 0)])


static func _pipes_wall(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var L: float = p.get("length", 4.0)
	for k in 3:
		var y := 0.15 + k * 0.17
		var mat = ["rust", "paint_green", "steel"][k]
		mk.pipe(mat, I, Vector3(-L * 0.5, y, 0.1), Vector3(L * 0.5, y, 0.1), 0.05 + k * 0.01, 10)
		for x in range(0, int(L) + 1):
			mk.box("steel_dark", I, Vector3(0.04, 0.12, 0.14), Vector3(-L * 0.5 + x, y, 0.06))
	mk.cyl("paint_red", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(L * 0.25, 0.32, 0.18)), 0.07, 0.03, Vector3.ZERO, 10)


# ======================= СКЛАД =======================

static func _crate_wood(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var s: Vector3 = p.get("size", Vector3(0.8, 0.6, 0.6))
	mk.box("wood", I, s, Vector3(0, s.y * 0.5, 0))
	for x in [-s.x * 0.5 + 0.04, s.x * 0.5 - 0.04]:
		mk.box("wood_old", I, Vector3(0.08, s.y + 0.01, s.z + 0.01), Vector3(x, s.y * 0.5, 0))
	col.append([s, Vector3(0, s.y * 0.5, 0)])


static func _crate_military(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("crate_green", I, Vector3(0.9, 0.38, 0.5), Vector3(0, 0.19, 0))
	mk.box("crate_green", I, Vector3(0.92, 0.07, 0.52), Vector3(0, 0.41, 0))
	for x in [-0.3, 0.3]:
		mk.box("steel_dark", I, Vector3(0.08, 0.05, 0.02), Vector3(x, 0.32, 0.26))
		mk.box("steel_dark", I, Vector3(0.03, 0.04, 0.54), Vector3(x, 0.42, 0))
	mk.box("paint_white", I, Vector3(0.3, 0.06, 0.005), Vector3(0, 0.2, 0.252))
	col.append([Vector3(0.9, 0.45, 0.5), Vector3(0, 0.225, 0)])


static func _cardboard(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("cardboard", I, Vector3(0.5, 0.4, 0.4), Vector3(0, 0.2, 0))
	mk.box("paint_yellow", I, Vector3(0.505, 0.06, 0.06), Vector3(0, 0.4, 0))
	col.append([Vector3(0.5, 0.4, 0.4), Vector3(0, 0.2, 0)])


static func _barrel(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var mat: String = p.get("mat", "paint_blue")
	mk.cyl(mat, I, 0.29, 0.88, Vector3.ZERO, 16)
	for y in [0.29, 0.59]:
		mk.cyl(mat, I, 0.3, 0.03, Vector3(0, y, 0), 16)
	mk.cyl("steel_dark", I, 0.04, 0.02, Vector3(0.15, 0.88, 0.05), 8)
	if p.get("rad", false):
		mk.box("paint_yellow", I, Vector3(0.24, 0.24, 0.005), Vector3(0, 0.45, 0.293))
		mk.cyl("black", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 0.45, 0.297)), 0.03, 0.006, Vector3.ZERO, 8)
	col.append([Vector3(0.6, 0.9, 0.6), Vector3(0, 0.45, 0)])


static func _pallet(mk: BCMesh, col: Array, p: Dictionary) -> void:
	for k in 5:
		mk.box("wood_old", I, Vector3(1.2, 0.022, 0.12), Vector3(0, 0.133, -0.34 + k * 0.17))
	for x in [-0.55, 0, 0.55]:
		mk.box("wood_old", I, Vector3(0.1, 0.1, 0.8), Vector3(x, 0.06, 0))
	col.append([Vector3(1.2, 0.15, 0.8), Vector3(0, 0.075, 0)])


static func _water_tank(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.cyl("paint_blue", I, 0.58, 2.0, Vector3(0, 0.15, 0), 18)
	mk.sphere("paint_blue", I, 0.58, Vector3(0, 2.15, 0), 18, 6, Vector3(1, 0.25, 1))
	for k in 4:
		var a := TAU * k / 4.0
		mk.box("steel_dark", I, Vector3(0.06, 0.15, 0.06), Vector3(cos(a) * 0.45, 0.075, sin(a) * 0.45))
	mk.pipe("chrome", I, Vector3(0, 0.4, 0.58), Vector3(0, 0.4, 0.75), 0.03, 8)
	mk.cyl("paint_red", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 0.4, 0.76)), 0.05, 0.02, Vector3.ZERO, 8)
	col.append([Vector3(1.2, 2.2, 1.2), Vector3(0, 1.1, 0)])


# ======================= ТЕПЛИЦА =======================

static func _grow_rack(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var w := 1.8
	var d := 0.6
	var r := _rng(p)
	for x in [-w * 0.5 + 0.02, w * 0.5 - 0.02]:
		for z in [-d * 0.5 + 0.02, d * 0.5 - 0.02]:
			mk.box("steel", I, Vector3(0.035, 1.9, 0.035), Vector3(x, 0.95, z))
	for s in 3:
		var y := 0.25 + s * 0.6
		mk.box("steel", I, Vector3(w, 0.03, d), Vector3(0, y, 0))
		mk.box("plastic_dark", I, Vector3(w - 0.1, 0.1, d - 0.08), Vector3(0, y + 0.065, 0))
		mk.box("soil", I, Vector3(w - 0.14, 0.01, d - 0.12), Vector3(0, y + 0.115, 0))
		var n := 7
		for k in n:
			var x := -w * 0.5 + 0.18 + k * (w - 0.36) / (n - 1)
			for j in 2:
				var c := Vector3(x + r.randf_range(-0.04, 0.04), y + 0.14, -0.12 + j * 0.24)
				var sz := r.randf_range(0.08, 0.13)
				mk.sphere("leaf", I, sz, c + Vector3(0, sz * 0.6, 0), 7, 4, Vector3(1.2, 0.8, 1.2))
				mk.sphere("leaf", I, sz * 0.7, c + Vector3(sz * 0.4, sz * 1.1, sz * 0.2), 6, 4)
		# фитолампа над полкой
		mk.box("steel_dark", I, Vector3(w - 0.2, 0.03, 0.1), Vector3(0, y + 0.52, 0))
		mk.box("grow_light", I, Vector3(w - 0.26, 0.012, 0.06), Vector3(0, y + 0.503, 0))
	col.append([Vector3(w, 1.9, d), Vector3(0, 0.95, 0)])


# ======================= УПРАВЛЕНИЕ =======================

static func _console(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_grey", I, Vector3(2.0, 0.78, 0.7), Vector3(0, 0.39, -0.05))
	# наклонная панель
	var t := Transform3D(Basis(Vector3.RIGHT, -0.5), Vector3(0, 0.9, 0.05))
	mk.box("paint_grey", t, Vector3(2.0, 0.04, 0.5))
	var r := _rng(p)
	for k in 18:
		var x := -0.85 + (k % 9) * 0.21
		var z := -0.12 + (k / 9) * 0.2
		var m = ["led_green", "led_red", "led_amber", "plastic_white", "plastic_dark"][r.randi() % 5]
		mk.box(m, t, Vector3(0.06, 0.03, 0.05), Vector3(x, 0.03, z))
	mk.box("screen_green", t, Vector3(0.4, 0.01, 0.2), Vector3(0.6, 0.025, 0.05))
	mk.box("screen_blue", t, Vector3(0.3, 0.01, 0.16), Vector3(-0.6, 0.025, 0.05))
	mk.box("plastic_dark", I, Vector3(2.0, 0.42, 0.3), Vector3(0, 1.03, -0.28))
	for k in 3:
		mk.box(["screen_green", "screen_blue", "screen_green"][k], I, Vector3(0.5, 0.3, 0.005), Vector3(-0.62 + k * 0.62, 1.04, -0.128))
	col.append([Vector3(2.0, 1.25, 0.85), Vector3(0, 0.62, -0.05)])


static func _monitor_bank(mk: BCMesh, col: Array, p: Dictionary) -> void:
	for k in 3:
		var x := -0.6 + k * 0.6
		mk.box("plastic_dark", I, Vector3(0.56, 0.4, 0.3), Vector3(x, 0.45, 0))
		mk.box(["screen_green", "screen_blue", "screen_green"][k], I, Vector3(0.46, 0.32, 0.005), Vector3(x, 0.46, 0.153))
	for k in 2:
		mk.box("plastic_dark", I, Vector3(0.56, 0.36, 0.3), Vector3(-0.3 + k * 0.6, 0.0 + 0.85, 0))
		mk.box("screen_off", I, Vector3(0.46, 0.28, 0.005), Vector3(-0.3 + k * 0.6, 0.85, 0.153))


static func _radio_set(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("crate_green", I, Vector3(0.8, 0.42, 0.42), Vector3(0, 0.21, 0))
	for k in 5:
		mk.cyl("plastic_white", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(-0.3 + k * 0.15, 0.15, 0.215)), 0.03, 0.03, Vector3.ZERO, 8)
	mk.box("screen_green", I, Vector3(0.3, 0.1, 0.005), Vector3(0, 0.31, 0.212))
	mk.pipe("steel", I, Vector3(0.3, 0.42, -0.1), Vector3(0.36, 1.1, -0.15), 0.006, 4)
	mk.box("plastic_dark", I, Vector3(0.12, 0.08, 0.06), Vector3(-0.42, 0.45, 0.1))


static func _map_board(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("wood_old", I, Vector3(1.6, 1.1, 0.03), Vector3(0, 0.55, 0.015))
	mk.box("fabric_khaki", I, Vector3(1.45, 0.95, 0.005), Vector3(0, 0.55, 0.032))
	var r := _rng(p)
	for k in 9:
		mk.sphere(["led_red", "paint_blue", "paint_yellow"][k % 3], I, 0.015, Vector3(r.randf_range(-0.65, 0.65), r.randf_range(0.15, 0.95), 0.04), 5, 3)
	for k in 4:
		mk.box("paint_red", Transform3D(Basis(Vector3.BACK, r.randf_range(-1, 1)), Vector3(r.randf_range(-0.5, 0.5), r.randf_range(0.3, 0.8), 0.036)), Vector3(r.randf_range(0.2, 0.5), 0.008, 0.002))


# ======================= ШЛЮЗ =======================

static func _decon_shower(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var w := 1.5
	mk.box("steel_dark", I, Vector3(w, 0.08, w), Vector3(0, 0.04, 0))
	for k in 8:
		mk.box("steel", I, Vector3(w - 0.1, 0.02, 0.04), Vector3(0, 0.09, -w * 0.5 + 0.12 + k * 0.18))
	for x in [-w * 0.5, w * 0.5]:
		for z in [-w * 0.5, w * 0.5]:
			mk.box("steel", I, Vector3(0.06, 2.4, 0.06), Vector3(x, 1.2, z))
	mk.box("steel", I, Vector3(w + 0.06, 0.12, w + 0.06), Vector3(0, 2.36, 0))
	# стенки из стекла (кроме передней — проход) и задняя — стальная
	mk.box("glass", I, Vector3(0.02, 2.2, w - 0.06), Vector3(-w * 0.5, 1.2, 0))
	mk.box("glass", I, Vector3(0.02, 2.2, w - 0.06), Vector3(w * 0.5, 1.2, 0))
	mk.box("metal_plate", I, Vector3(w - 0.06, 2.2, 0.03), Vector3(0, 1.2, -w * 0.5))
	for k in 3:
		mk.cyl("chrome", I, 0.07, 0.05, Vector3(-0.4 + k * 0.4, 2.22, 0), 10)
		mk.sphere("lamp_cold", I, 0.03, Vector3(-0.4 + k * 0.4, 2.21, 0), 6, 3)
	mk.box("led_amber", I, Vector3(0.3, 0.06, 0.02), Vector3(0, 2.3, w * 0.5 + 0.03))
	mk.box("hazard", I, Vector3(w, 0.01, 0.15), Vector3(0, 0.005, w * 0.5 + 0.12))
	col.append([Vector3(0.08, 2.4, w), Vector3(-w * 0.5, 1.2, 0)])
	col.append([Vector3(0.08, 2.4, w), Vector3(w * 0.5, 1.2, 0)])
	col.append([Vector3(w, 2.4, 0.08), Vector3(0, 1.2, -w * 0.5)])


static func _suit_locker(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("paint_olive", I, Vector3(1.0, 2.1, 0.08), Vector3(0, 1.05, -0.26))
	mk.box("paint_olive", I, Vector3(0.05, 2.1, 0.6), Vector3(-0.5, 1.05, 0))
	mk.box("paint_olive", I, Vector3(0.05, 2.1, 0.6), Vector3(0.5, 1.05, 0))
	mk.box("paint_olive", I, Vector3(1.0, 0.06, 0.6), Vector3(0, 2.1, 0))
	mk.box("paint_olive", I, Vector3(1.0, 0.06, 0.6), Vector3(0, 0.03, 0))
	mk.pipe("chrome", I, Vector3(-0.45, 1.85, 0), Vector3(0.45, 1.85, 0), 0.015, 6)
	mk.box("paint_yellow", I, Vector3(0.36, 0.36, 0.005), Vector3(0, 1.75, 0.31))
	col.append([Vector3(1.0, 2.15, 0.6), Vector3(0, 1.07, 0)])


## костюм на вешалке — отдельный предмет, исчезает, когда герой его надел
static func suit_on_hanger() -> MeshInstance3D:
	var mk := BCMesh.new()
	var y := 1.85
	mk.pipe("chrome", I, Vector3(0, y, 0), Vector3(0, y - 0.1, 0), 0.006, 4)
	mk.pipe("steel_dark", I, Vector3(-0.22, y - 0.16, 0), Vector3(0.22, y - 0.16, 0), 0.01, 4)
	mk.sphere("paint_yellow", I, 0.12, Vector3(0, y - 0.1, 0.02), 10, 6, Vector3(1, 1.2, 1))
	mk.sphere("glass", I, 0.09, Vector3(0, y - 0.1, 0.1), 8, 5, Vector3(1, 0.8, 0.5))
	mk.box("paint_yellow", I, Vector3(0.44, 0.62, 0.22), Vector3(0, y - 0.5, 0))
	mk.box("paint_yellow", I, Vector3(0.38, 0.12, 0.2), Vector3(0, y - 0.86, 0))
	for sx in [-1.0, 1.0]:
		mk.pipe("paint_yellow", I, Vector3(sx * 0.24, y - 0.24, 0), Vector3(sx * 0.3, y - 0.8, 0.02), 0.06, 8)
		mk.pipe("paint_yellow", I, Vector3(sx * 0.1, y - 0.92, 0), Vector3(sx * 0.12, y - 1.62, 0.02), 0.075, 8)
		mk.box("rubber", I, Vector3(0.12, 0.12, 0.24), Vector3(sx * 0.12, y - 1.7, 0.05))
		mk.sphere("rubber", I, 0.055, Vector3(sx * 0.3, y - 0.85, 0.02), 6, 4)
	mk.box("steel_dark", I, Vector3(0.24, 0.16, 0.08), Vector3(0, y - 0.45, 0.14))
	var mi := mk.to_instance(true)
	mi.name = "HangingSuit"
	return mi


static func _floor_grate(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("steel_dark", I, Vector3(1.2, 0.02, 0.6), Vector3(0, 0.005, 0))
	for k in 12:
		mk.box("steel", I, Vector3(0.025, 0.025, 0.56), Vector3(-0.55 + k * 0.1, 0.012, 0))


# ======================= ПОВЕРХНОСТЬ =======================

## вход в бункер: бетонный портал в насыпи, двустворчатая гермодверь (отдельный BCDoor), козырёк, вентиляция,
## маячок. Начало — середина порога, проход в −Z (вниз по лестнице), лицо портала смотрит в +Z.
static func _portal(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var W := 3.0      # ширина прохода
	var H := 2.5      # высота проёма
	var D := 5.0      # глубина портала
	var t := 0.6
	var top := 3.4
	# боковые стены (над лестницей) и задняя крыша
	for sx in [-1.0, 1.0]:
		var x = sx * (W * 0.5 + t * 0.5)
		mk.box("concrete_raw", I, Vector3(t, top, D), Vector3(x, top * 0.5, -D * 0.5))
		col.append([Vector3(t, top, D), Vector3(x, top * 0.5, -D * 0.5)])
		# откосы-крылья, уходящие в насыпь
		var wt := Transform3D(Basis(Vector3.UP, sx * 0.55), Vector3(sx * (W * 0.5 + t + 1.1), 0, 0.6))
		mk.box("concrete_raw", wt, Vector3(2.4, 1.6, 0.45), Vector3(0, 0.8, 0))
		mk.tri("concrete_raw", wt, Vector3(-1.2, 1.6, 0.226), Vector3(1.2, 1.6, 0.226), Vector3(-1.2, 2.8, 0.226), 2.4)
		col.append([Vector3(2.4, 1.6, 0.45), wt.origin + Vector3(0, 0.8, 0), Vector3(0, sx * 0.55, 0)])
	# лицевая стена над проёмом
	mk.box("concrete_raw", I, Vector3(W + 2 * t, top - H, t), Vector3(0, H + (top - H) * 0.5, -t * 0.5))
	col.append([Vector3(W + 2 * t, top - H, t), Vector3(0, H + (top - H) * 0.5, -t * 0.5)])
	# крыша-плита
	mk.box("concrete_raw", I, Vector3(W + 2 * t + 0.4, 0.35, D + 0.4), Vector3(0, top + 0.175, -D * 0.5 + 0.2))
	col.append([Vector3(W + 2 * t + 0.4, 0.35, D + 0.4), Vector3(0, top + 0.175, -D * 0.5 + 0.2)])
	# козырёк над дверью
	mk.box("concrete_raw", I, Vector3(W + 0.6, 0.15, 0.9), Vector3(0, H + 0.5, 0.45))
	mk.box("hazard", I, Vector3(W + 0.6, 0.15, 0.01), Vector3(0, H + 0.5, 0.905))
	# решётчатый пол перед входом и перила
	mk.box("steel_dark", I, Vector3(W + 1.0, 0.05, 2.2), Vector3(0, 0.025, 1.1))
	for k in 14:
		mk.box("steel", I, Vector3(W + 0.9, 0.02, 0.03), Vector3(0, 0.055, 0.1 + k * 0.15))
	for sx in [-1.0, 1.0]:
		var x = sx * (W * 0.5 + 0.35)
		mk.pipe("paint_yellow", I, Vector3(x, 0, 2.1), Vector3(x, 1.0, 2.1), 0.03, 8)
		mk.pipe("paint_yellow", I, Vector3(x, 1.0, 2.1), Vector3(x, 1.0, 0.6), 0.03, 8)
		mk.pipe("paint_yellow", I, Vector3(x, 0.5, 2.1), Vector3(x, 0.5, 0.6), 0.02, 6)
	# вентиляция на крыше: короб с решёткой и труба с колпаком (как на эскизе)
	mk.box("steel", I, Vector3(1.1, 0.55, 0.9), Vector3(-0.7, top + 0.62, -1.4))
	for k in 6:
		mk.box("steel_dark", I, Vector3(0.9, 0.02, 0.02), Vector3(-0.7, top + 0.45 + k * 0.06, -0.94))
	mk.pipe("steel", I, Vector3(0.4, top + 0.6, -0.9), Vector3(0.4, top + 0.6, -2.6), 0.22, 14)
	mk.pipe("steel", I, Vector3(0.4, top + 0.35, -2.6), Vector3(0.4, top + 1.3, -2.6), 0.24, 14)
	mk.cyl("steel", I, 0.45, 0.85, Vector3(1.3, top + 0.35, -2.6), 18)
	for k in 8:
		mk.cyl("steel_dark", I, 0.46, 0.02, Vector3(1.3, top + 0.42 + k * 0.1, -2.6), 18)
	mk.cyl("steel", I, 0.5, 0.06, Vector3(1.3, top + 1.2, -2.6), 18)
	mk.pipe("steel", I, Vector3(0.4, top + 1.3, -2.6), Vector3(0.95, top + 1.3, -2.6), 0.22, 14)
	# маячок
	mk.cyl("steel_dark", I, 0.08, 0.08, Vector3(W * 0.5 + 0.3, top + 0.35, 0.0), 8)
	mk.sphere("beacon_red", I, 0.08, Vector3(W * 0.5 + 0.3, top + 0.5, 0.0), 8, 5)
	# лампа над дверью
	mk.box("steel_dark", I, Vector3(0.5, 0.08, 0.15), Vector3(0, H + 0.38, 0.1))
	mk.box("lamp_cold", I, Vector3(0.44, 0.02, 0.1), Vector3(0, H + 0.335, 0.1))
	# кабели по фасаду
	mk.pipe("rubber", I, Vector3(W * 0.5 + 0.12, 0.2, 0.02), Vector3(W * 0.5 + 0.12, top, 0.02), 0.03, 6)
	mk.box("paint_grey", I, Vector3(0.3, 0.4, 0.15), Vector3(W * 0.5 + 0.25, 1.3, 0.1))


static func _fence(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var L: float = p.get("length", 5.0)
	var n := maxi(1, int(round(L / 2.5)))
	var step := L / n
	for k in n + 1:
		var x := -L * 0.5 + k * step
		mk.pipe("steel", I, Vector3(x, 0, 0), Vector3(x, 2.3, 0), 0.035, 8)
		mk.pipe("steel", I, Vector3(x, 2.3, 0), Vector3(x, 2.6, 0.25), 0.02, 6)
	mk.pipe("steel", I, Vector3(-L * 0.5, 2.25, 0), Vector3(L * 0.5, 2.25, 0), 0.02, 6)
	mk.pipe("steel", I, Vector3(-L * 0.5, 0.1, 0), Vector3(L * 0.5, 0.1, 0), 0.015, 6)
	# колючая проволока
	for k in 3:
		mk.pipe("steel_dark", I, Vector3(-L * 0.5, 2.35 + k * 0.1, 0.08 + k * 0.08), Vector3(L * 0.5, 2.35 + k * 0.1, 0.08 + k * 0.08), 0.006, 4, false)
	# сетка-рабица: две грани с прозрачной текстурой (материал fence_mesh)
	mk.quad("chainlink", I, Vector3(-L * 0.5, 0.1, 0), Vector3(L * 0.5, 0.1, 0), Vector3(L * 0.5, 2.25, 0), Vector3(-L * 0.5, 2.25, 0), 1.0)
	col.append([Vector3(L, 2.6, 0.2), Vector3(0, 1.3, 0)])


static func _warning_sign(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.pipe("rust", I, Vector3(0, 0, 0), Vector3(0, 1.75, 0), 0.03, 6)
	var t := Transform3D(Basis(Vector3.BACK, PI * 0.25), Vector3(0, 1.45, 0.04))
	mk.box("paint_yellow", t, Vector3(0.42, 0.42, 0.012))
	mk.box("black", t, Vector3(0.44, 0.44, 0.008), Vector3(0, 0, -0.004))
	mk.cyl("black", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 1.45, 0.05)), 0.03, 0.006, Vector3.ZERO, 8)
	for k in 3:
		var a := PI * 0.5 + k * TAU / 3.0
		mk.box("black", Transform3D(Basis(Vector3.BACK, a), Vector3(cos(a) * 0.075, 1.45 + sin(a) * 0.075, 0.05)), Vector3(0.08, 0.065, 0.008))
	col.append([Vector3(0.1, 1.8, 0.1), Vector3(0, 0.9, 0)])


static func _power_pole(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var tilt: float = p.get("tilt", 0.0)
	var b := Basis(Vector3.BACK, tilt)
	var t := Transform3D(b, Vector3.ZERO)
	mk.cyl("dead_wood", t, 0.14, 8.0, Vector3.ZERO, 10, true, 0.11)
	mk.box("dead_wood", t, Vector3(1.8, 0.12, 0.12), Vector3(0, 7.4, 0))
	for x in [-0.75, 0.0, 0.75]:
		mk.cyl("glass" if false else "plastic_white", t, 0.04, 0.16, Vector3(x, 7.46, 0), 8)
	col.append([Vector3(0.3, 8.0, 0.3), Vector3(0, 4.0, 0)])


static func _transformer(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("concrete_raw", I, Vector3(2.2, 0.3, 1.8), Vector3(0, 0.15, 0))
	mk.box("paint_grey", I, Vector3(1.5, 1.4, 1.0), Vector3(0, 1.0, 0))
	for k in 7:
		mk.box("steel_dark", I, Vector3(0.03, 1.1, 1.2), Vector3(-0.6 + k * 0.2, 1.0, 0))
	for x in [-0.45, 0.0, 0.45]:
		mk.cyl("plastic_white", I, 0.06, 0.6, Vector3(x, 1.7, 0.2), 10)
		for k in 4:
			mk.cyl("plastic_white", I, 0.1, 0.03, Vector3(x, 1.8 + k * 0.12, 0.2), 10)
	mk.box("paint_yellow", I, Vector3(0.3, 0.3, 0.005), Vector3(0, 1.1, 0.503))
	mk.box("rust", I, Vector3(1.52, 0.06, 1.02), Vector3(0, 1.72, 0))
	col.append([Vector3(1.8, 2.6, 1.4), Vector3(0, 1.3, 0)])


## мёртвое дерево: ствол и ветви — рекурсивные сужающиеся цилиндры
static func _dead_tree(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var r := _rng(p)
	var h: float = p.get("height", r.randf_range(5.0, 8.0))
	_branch(mk, r, Vector3.ZERO, Vector3(r.randf_range(-0.08, 0.08), 1, r.randf_range(-0.08, 0.08)).normalized(), h * 0.55, 0.22 * h / 7.0, 0)
	col.append([Vector3(0.5, 3.0, 0.5), Vector3(0, 1.5, 0)])


static func _branch(mk: BCMesh, r: RandomNumberGenerator, a: Vector3, dir: Vector3, length: float, rad: float, depth: int) -> void:
	var segs := 3
	var p := a
	var d := dir
	for s in segs:
		var q := p + d * (length / segs)
		var r0 := rad * (1.0 - 0.25 * s / segs)
		var r1 := rad * (1.0 - 0.25 * (s + 1) / segs)
		var t := Transform3D(_basis_y(q - p), p)
		mk.cyl("bark", t, r0, (q - p).length(), Vector3.ZERO, 7 if depth == 0 else 5, false, r1)
		# изгиб
		d = (d + Vector3(r.randf_range(-0.25, 0.25), r.randf_range(-0.05, 0.12), r.randf_range(-0.25, 0.25))).normalized()
		p = q
		if depth < 3 and s >= 1:
			var nb := 2 if depth < 2 else 1
			for k in nb:
				if r.randf() < 0.75:
					var side := Vector3(r.randf_range(-1, 1), r.randf_range(0.2, 0.9), r.randf_range(-1, 1)).normalized()
					var nd := (d * 0.35 + side).normalized()
					_branch(mk, r, p, nd, length * r.randf_range(0.45, 0.65), rad * 0.5, depth + 1)
	if depth < 3:
		_branch(mk, r, p, (d + Vector3(r.randf_range(-0.3, 0.3), 0.2, r.randf_range(-0.3, 0.3))).normalized(), length * 0.55, rad * 0.62, depth + 1)


static func _basis_y(dir: Vector3) -> Basis:
	var up := dir.normalized()
	var ref := Vector3.FORWARD if absf(up.dot(Vector3.FORWARD)) < 0.95 else Vector3.RIGHT
	var x := ref.cross(up).normalized()
	var z := x.cross(up)
	return Basis(x, up, z)


## брошенный грузовик (кабина, кузов с тентом, колёса) — запасной вид, если нет модели truck.glb
static func _truck(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var cab := "rust"
	mk.box("steel_dark", I, Vector3(1.0, 0.25, 6.6), Vector3(0, 0.75, 0))
	# кабина
	mk.box(cab, I, Vector3(2.3, 1.2, 1.9), Vector3(0, 1.55, 2.25))
	mk.box(cab, I, Vector3(2.2, 0.9, 1.0), Vector3(0, 1.2, 3.45))
	mk.box("glass", I, Vector3(2.0, 0.6, 0.02), Vector3(0, 1.85, 3.2))
	mk.box("steel_dark", I, Vector3(1.2, 0.5, 0.02), Vector3(0, 1.1, 3.96))
	for sx in [-1.0, 1.0]:
		mk.sphere("glass", I, 0.1, Vector3(sx * 0.85, 1.1, 3.95), 6, 4)
		mk.box("glass", I, Vector3(0.02, 0.55, 0.9), Vector3(sx * 1.155, 1.85, 2.25))
	# кузов и тент (рваный)
	mk.box("wood_old", I, Vector3(2.4, 0.08, 4.2), Vector3(0, 1.25, -1.0))
	for sx in [-1.0, 1.0]:
		mk.box("wood_old", I, Vector3(0.06, 0.6, 4.2), Vector3(sx * 1.2, 1.58, -1.0))
	mk.box("wood_old", I, Vector3(2.4, 0.6, 0.06), Vector3(0, 1.58, -3.1))
	for k in 5:
		var z := -2.9 + k * 0.95
		mk.pipe("steel_dark", I, Vector3(-1.18, 1.85, z), Vector3(-1.0, 2.7, z), 0.02, 5)
		mk.pipe("steel_dark", I, Vector3(-1.0, 2.7, z), Vector3(1.0, 2.7, z), 0.02, 5)
		mk.pipe("steel_dark", I, Vector3(1.0, 2.7, z), Vector3(1.18, 1.85, z), 0.02, 5)
	mk.quad("fabric_khaki", I, Vector3(-1.0, 2.72, -2.9), Vector3(1.0, 2.72, -2.9), Vector3(1.0, 2.72, -0.6), Vector3(-1.0, 2.72, -0.6), 2.0)
	mk.quad("fabric_khaki", I, Vector3(-1.2, 1.9, -2.9), Vector3(-1.0, 2.72, -2.9), Vector3(-1.0, 2.72, -0.2), Vector3(-1.2, 1.9, -0.2), 2.0)
	# колёса
	for z in [2.6, -0.9, -2.2]:
		for sx in [-1.0, 1.0]:
			var wt := Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(sx * 1.05, 0.55, z))
			mk.cyl("rubber", wt, 0.55, 0.38, Vector3(0, -0.19, 0), 14)
			mk.cyl("steel_dark", wt, 0.28, 0.4, Vector3(0, -0.2, 0), 10)
	col.append([Vector3(2.4, 2.8, 7.0), Vector3(0, 1.4, 0)])


static func _shed(mk: BCMesh, col: Array, p: Dictionary) -> void:
	# сама постройка — стены с проёмами (кирпич/штукатурка), рваная крыша строится отдельно (BCShed в локации)
	var W := 6.0
	var D := 4.2
	var H := 2.9
	var t := 0.25
	var walls := [
		[Vector3(W + 2 * t, H, t), Vector3(0, H * 0.5, -D * 0.5 - t * 0.5)],
		[Vector3(t, H, D), Vector3(-W * 0.5 - t * 0.5, H * 0.5, 0)],
		[Vector3(t, H, D), Vector3(W * 0.5 + t * 0.5, H * 0.5, 0)],
	]
	for w in walls:
		mk.box("cut:plaster", I, w[0], w[1])
		col.append(w)
	# передняя стена с дверью и окном
	var fz := D * 0.5 + t * 0.5
	mk.box("cut:plaster", I, Vector3(1.5, H, t), Vector3(-W * 0.5 - t + 0.75, H * 0.5, fz))
	col.append([Vector3(1.5, H, t), Vector3(-W * 0.5 - t + 0.75, H * 0.5, fz)])
	mk.box("cut:plaster", I, Vector3(1.0, H - 2.1, t), Vector3(-W * 0.5 - t + 2.0, 2.1 + (H - 2.1) * 0.5, fz))
	mk.box("cut:plaster", I, Vector3(3.75, 0.9, t), Vector3(W * 0.5 + t - 1.875, 0.45, fz))
	mk.box("cut:plaster", I, Vector3(3.75, H - 2.0, t), Vector3(W * 0.5 + t - 1.875, 2.0 + (H - 2.0) * 0.5, fz))
	mk.box("cut:plaster", I, Vector3(1.2, 1.1, t), Vector3(W * 0.5 + t - 0.6, 1.45, fz))
	mk.box("cut:plaster", I, Vector3(0.9, 1.1, t), Vector3(-0.4, 1.45, fz))
	col.append([Vector3(3.75, H, t), Vector3(W * 0.5 + t - 1.875, H * 0.5, fz)])
	# кирпич, проступающий из-под штукатурки
	mk.box("brick", I, Vector3(1.2, 0.8, 0.02), Vector3(1.6, 0.6, fz + t * 0.5 + 0.005))
	mk.box("brick", I, Vector3(0.02, 0.9, 1.4), Vector3(-W * 0.5 - t - 0.005, 1.8, -0.8))
	mk.box("concrete_floor", I, Vector3(W, 0.12, D), Vector3(0, 0.06, 0))
	# хлам внутри и навес сбоку
	var r := _rng(p)
	for k in 6:
		mk.box(["wood_old", "cardboard", "rust"][k % 3], Transform3D(Basis(Vector3.UP, r.randf() * TAU), Vector3(r.randf_range(-2.4, 2.4), 0.12, r.randf_range(-1.6, 1.2))), Vector3(r.randf_range(0.3, 0.9), r.randf_range(0.05, 0.3), r.randf_range(0.2, 0.6)), Vector3(0, 0.1, 0))
	for z in [-1.8, 0.0, 1.8]:
		mk.pipe("dead_wood", I, Vector3(-W * 0.5 - t - 2.2, 0, z), Vector3(-W * 0.5 - t - 2.2, 2.2, z), 0.06, 6)
	mk.box("corrugated", Transform3D(Basis(Vector3.BACK, -0.12), Vector3(-W * 0.5 - t - 1.1, 2.35, 0)), Vector3(2.4, 0.03, 4.2))


static func shed_roof(p := {}) -> MeshInstance3D:
	var mk := BCMesh.new()
	var W := 6.0
	var D := 4.2
	var H := 2.9
	# односкатная крыша с дырой
	var rt := Transform3D(Basis(Vector3.RIGHT, 0.12), Vector3(0, H + 0.25, 0))
	mk.box("corrugated", rt, Vector3(W + 0.9, 0.04, 1.6), Vector3(0, 0, -1.7))
	mk.box("corrugated", rt, Vector3(2.6, 0.04, 2.6), Vector3(-2.0, 0, 0.4))
	mk.box("corrugated", rt, Vector3(1.6, 0.04, 2.6), Vector3(2.8, 0, 0.4))
	for x in [-3.0, -1.0, 1.0, 3.0]:
		mk.box("dead_wood", rt, Vector3(0.1, 0.12, D + 0.6), Vector3(x, -0.08, 0))
	var mi := mk.to_instance(true)
	mi.name = "Roof"
	return mi


static func _concrete_block(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("concrete_raw", I, Vector3(1.6, 0.6, 0.6), Vector3(0, 0.3, 0))
	mk.pipe("rust", I, Vector3(-0.5, 0.6, 0), Vector3(-0.5, 0.75, 0), 0.015, 5)
	mk.pipe("rust", I, Vector3(0.5, 0.6, 0), Vector3(0.5, 0.75, 0), 0.015, 5)
	col.append([Vector3(1.6, 0.6, 0.6), Vector3(0, 0.3, 0)])


static func _pipe_pile(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var r := 0.17
	var rows := [[-0.36, 0.0, 0.36], [-0.18, 0.18], [0.0]]
	for j in rows.size():
		for z in rows[j]:
			var y := r + j * r * 1.75
			mk.pipe("rust", I, Vector3(-1.6, y, z), Vector3(1.6, y, z), r, 12, false)
			mk.cyl("black", Transform3D(Basis(Vector3.BACK, PI * 0.5), Vector3(-1.59, y, z)), r * 0.85, 0.02, Vector3(0, -0.01, 0), 12)
	col.append([Vector3(3.2, 0.7, 1.2), Vector3(0, 0.35, 0)])


static func _cable_reel(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var t := Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 0.55, 0))
	mk.cyl("wood_old", t, 0.55, 0.06, Vector3(0, 0.27, 0), 18)
	mk.cyl("wood_old", t, 0.55, 0.06, Vector3(0, -0.33, 0), 18)
	mk.cyl("rubber", t, 0.38, 0.54, Vector3(0, -0.27, 0), 16)
	col.append([Vector3(1.1, 1.1, 0.7), Vector3(0, 0.55, 0)])


static func _tire(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.cyl("rubber", I, 0.45, 0.28, Vector3.ZERO, 16)
	mk.cyl("black", I, 0.24, 0.285, Vector3.ZERO, 12)
	col.append([Vector3(0.9, 0.3, 0.9), Vector3(0, 0.15, 0)])


static func _rock(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var r := _rng(p)
	var s: float = p.get("scale", 1.0)
	mk.sphere("rock", Transform3D(Basis(Vector3.UP, r.randf() * TAU), Vector3.ZERO), 0.55 * s, Vector3(0, 0.15 * s, 0), 9, 6, Vector3(r.randf_range(0.9, 1.2), r.randf_range(0.55, 0.8), r.randf_range(0.8, 1.0)))
	col.append([Vector3(1.0, 0.6, 0.9) * s, Vector3(0, 0.3 * s, 0)])


static func _rubble(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var r := _rng(p)
	for k in 9:
		var sz := Vector3(r.randf_range(0.25, 0.8), r.randf_range(0.12, 0.35), r.randf_range(0.2, 0.6))
		var t := Transform3D(Basis.from_euler(Vector3(r.randf_range(-0.3, 0.3), r.randf() * TAU, r.randf_range(-0.3, 0.3))), Vector3(r.randf_range(-1.0, 1.0), sz.y * 0.4, r.randf_range(-0.8, 0.8)))
		mk.box("concrete_raw", t, sz)
		if r.randf() < 0.5:
			mk.pipe("rust", t, Vector3(0, 0, 0), Vector3(r.randf_range(-0.4, 0.4), 0.3, r.randf_range(-0.2, 0.2)), 0.01, 4)
	col.append([Vector3(2.2, 0.5, 1.8), Vector3(0, 0.25, 0)])


static func _vent_mushroom(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("concrete_raw", I, Vector3(1.0, 0.3, 1.0), Vector3(0, 0.15, 0))
	mk.cyl("steel", I, 0.22, 1.25, Vector3(0, 0.3, 0), 14)
	mk.cyl("steel", I, 0.42, 0.06, Vector3(0, 1.32, 0), 16)
	mk.cyl("steel", I, 0.42, 0.18, Vector3(0, 1.38, 0), 16, true, 0.08)
	for k in 6:
		mk.cyl("steel_dark", I, 0.23, 0.02, Vector3(0, 0.5 + k * 0.12, 0), 14)
	col.append([Vector3(1.0, 1.6, 1.0), Vector3(0, 0.8, 0)])


static func _vent_box(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("concrete_raw", I, Vector3(1.6, 0.9, 1.6), Vector3(0, 0.45, 0))
	mk.box("steel", I, Vector3(1.3, 0.5, 1.3), Vector3(0, 1.15, 0))
	for sx in [-1.0, 1.0]:
		for k in 5:
			mk.box("steel_dark", I, Vector3(0.01, 0.04, 1.1), Vector3(sx * 0.655, 0.98 + k * 0.08, 0))
	mk.box("steel", I, Vector3(1.45, 0.05, 1.45), Vector3(0, 1.42, 0))
	col.append([Vector3(1.6, 1.4, 1.6), Vector3(0, 0.7, 0)])


static func _water_tower(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var h := 9.0
	for k in 4:
		var a := TAU * k / 4.0 + PI * 0.25
		var b0 := Vector3(cos(a) * 2.0, 0, sin(a) * 2.0)
		var b1 := Vector3(cos(a) * 1.2, h, sin(a) * 1.2)
		mk.pipe("rust", I, b0, b1, 0.08, 8)
	for j in 3:
		var y := 2.0 + j * 2.6
		for k in 4:
			var a0 := TAU * k / 4.0 + PI * 0.25
			var a1 := TAU * (k + 1) / 4.0 + PI * 0.25
			var f := y / h
			var r := 2.0 - 0.8 * f
			mk.pipe("rust", I, Vector3(cos(a0) * r, y, sin(a0) * r), Vector3(cos(a1) * r, y, sin(a1) * r), 0.04, 6)
	mk.cyl("rust", I, 1.9, 2.6, Vector3(0, h, 0), 20)
	mk.cyl("rust", I, 1.95, 0.6, Vector3(0, h + 2.6, 0), 20, true, 0.2)
	mk.pipe("rust", I, Vector3(0, 0, 0), Vector3(0, h, 0), 0.15, 8)
	# лестница
	mk.pipe("steel_dark", I, Vector3(1.55, 0, 1.55), Vector3(1.0, h, 1.0), 0.02, 4)
	mk.pipe("steel_dark", I, Vector3(1.75, 0, 1.25), Vector3(1.2, h, 0.75), 0.02, 4)
	for k in 4:
		var a := TAU * k / 4.0 + PI * 0.25
		col.append([Vector3(0.3, 2.0, 0.3), Vector3(cos(a) * 1.95, 1.0, sin(a) * 1.95)])


static func _ibc_tank(mk: BCMesh, col: Array, p: Dictionary) -> void:
	mk.box("plastic_white", I, Vector3(1.1, 0.95, 0.9), Vector3(0, 0.6, 0))
	mk.box("steel_dark", I, Vector3(1.2, 0.14, 1.0), Vector3(0, 0.07, 0))
	for x in range(-2, 3):
		mk.pipe("steel", I, Vector3(x * 0.27, 0.14, 0.5), Vector3(x * 0.27, 1.12, 0.5), 0.012, 4)
		mk.pipe("steel", I, Vector3(x * 0.27, 0.14, -0.5), Vector3(x * 0.27, 1.12, -0.5), 0.012, 4)
	for y in [0.4, 0.75, 1.1]:
		mk.pipe("steel", I, Vector3(-0.6, y, 0.5), Vector3(0.6, y, 0.5), 0.012, 4)
		mk.pipe("steel", I, Vector3(-0.6, y, -0.5), Vector3(0.6, y, -0.5), 0.012, 4)
	mk.cyl("steel_dark", I, 0.1, 0.06, Vector3(0, 1.08, 0), 10)
	col.append([Vector3(1.2, 1.15, 1.0), Vector3(0, 0.575, 0)])


static func _puddle(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var r := _rng(p)
	var s: float = p.get("scale", 1.0)
	var c := Vector3(0, 0.02, 0)
	var n := 14
	var pts := []
	for k in n:
		var a := TAU * k / n
		var rr := s * r.randf_range(0.7, 1.3)
		pts.append(c + Vector3(cos(a) * rr * 1.4, 0, sin(a) * rr))
	for k in n:
		mk.tri("puddle", I, c, pts[(k + 1) % n], pts[k], 2.0)


## градирня вдали (силуэт в тумане)
static func _cooling_tower(mk: BCMesh, col: Array, p: Dictionary) -> void:
	var h := 90.0
	var segs := 8
	for s in segs:
		var y0 := h * s / segs
		var y1 := h * (s + 1) / segs
		var r0 := _hyper(y0 / h) * 30.0
		var r1 := _hyper(y1 / h) * 30.0
		mk.cyl("concrete_raw", I, r0, y1 - y0, Vector3(0, y0, 0), 24, false, r1)


static func _hyper(f: float) -> float:
	return 0.62 + 0.38 * pow(absf(f - 0.72) / 0.72, 1.6)
