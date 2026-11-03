class_name EnvProps
## Предметы окружения из Tripo (машины, мебель, улица — план docs/tripo/plan_environment.md).
## Выгрузка для Godot (tools/godot-export.html + game/geom.js beginProp/endProp) не кладёт процедурные предметы в
## общую пачку, а пишет метки meta.props: {m: модель, x, z, ry, c: центр габарита в осях предмета, s: габарит}.
## Здесь модель вписывается в габарит старого предмета (место, поворот, коллизии и тайники — прежние) и ставится
## пачками MultiMesh по видам и участкам: вызовов отрисовки — по одному на вид в видимом участке.

## Настоящая длина, м (большая горизонтальная ось) — для показа модели отдельно (фотосъёмка CI).
const LENGTH := {
	"e_vaz2107": 4.13, "e_vaz_crashed": 4.13, "e_vaz_burned": 4.13, "e_niva": 3.74, "e_volga": 4.74, "e_uaz": 4.03,
	"e_paz": 7.15, "e_btr80": 7.65, "e_ural": 7.6,
	"e_fridge": 0.62, "e_pech": 1.6, "e_burzhuyka": 0.6, "e_sofa": 2.05, "e_bed": 2.0, "e_wardrobe": 1.1,
	"e_buffet": 1.1, "e_drawers": 1.2, "e_nightstand": 0.5, "e_chest": 1.0, "e_table": 1.1, "e_chair": 0.45,
	"e_tv": 0.8, "e_bunk": 2.0, "e_lathe": 1.9,
	"e_barrel": 0.6, "e_tire": 0.65, "e_trashbags": 1.0, "e_crate": 1.0, "e_bench": 1.6, "e_dumpster": 1.9,
	"e_block": 1.8, "e_sandbags": 2.4, "e_woodpile": 2.6, "e_well": 1.2,
	"e_pipes": 7.2, "e_hazard": 0.6, "e_ammo": 1.0,
}
## Поворот модели вокруг Y, рад, чтобы её перед смотрел туда же, что перед предмета браузерной игры. Модели Tripo
## («3/4 front view») лежат в файле передом к +X. Перед легковушки браузерной игры (addCar) — тоже +X (поворот 0),
## у автобуса, БТР и «Урала» и у мебели (лицо тайника, экран, устье печи) — +Z: поворот −90°. Сверено по листам
## моделей сверху (оси +X/+Z).
const Q := -PI * 0.5
const FRONT := {
	"e_paz": Q, "e_btr80": Q, "e_ural": Q,
	"e_fridge": Q, "e_pech": Q, "e_burzhuyka": Q, "e_sofa": Q, "e_bed": Q, "e_wardrobe": Q, "e_buffet": Q,
	"e_drawers": Q, "e_nightstand": Q, "e_chest": Q, "e_table": Q, "e_chair": -0.75, "e_tv": Q, "e_bunk": 0.0, "e_lathe": Q,
	"e_barrel": Q, "e_tire": Q, "e_trashbags": Q, "e_crate": Q, "e_dumpster": Q, "e_block": Q, "e_sandbags": Q,
	"e_woodpile": Q, "e_well": Q, "e_pipes": 0.0, "e_hazard": Q, "e_ammo": Q,
	# стул в файле повёрнут: сиденьем к +X+Z (~43°); койка уже лежит вдоль Z, трубы — вдоль X, как в браузерной игре; у скамейки браузерной игры спинка в +Z, сидят лицом к −Z: перед модели (+X) — к −Z
	"e_bench": PI * 0.5,
}

## Модель вида → {"parts": [[Mesh, Transform3D к центру габарита, на земле]], "size": Vector3 после FRONT}.
static var _cache := {}

static func _info(id: String) -> Dictionary:
	if _cache.has(id):
		return _cache[id]
	var path := "res://assets/tripo/%s.glb" % id
	var out := {}
	if ResourceLoader.exists(path):
		var m: Node3D = (load(path) as PackedScene).instantiate()
		var turn := Basis(Vector3.UP, float(FRONT.get(id, 0.0)))
		var pts := Gear._transform_all(Gear._points(m), Transform3D(turn, Vector3.ZERO))
		var box := Gear._box(pts)
		if box.size.length() > 0.0001:
			var c := box.get_center()
			var parts: Array = []
			for mi in m.find_children("*", "MeshInstance3D", true, false):
				var mesh: Mesh = (mi as MeshInstance3D).mesh
				if mesh == null:
					continue
				var t := Transform3D(turn, -c) * Gear._rel(m, mi)
				var mat: Material = (mi as MeshInstance3D).get_active_material(0)
				parts.append([mesh, t, mat])
			out = {"parts": parts, "size": box.size}
		m.free()
	_cache[id] = out
	return out

## Масштаб по осям, чтобы модель размера have легла в габарит want; искажение пропорций — не больше ±distort.
static func fit_scale(have: Vector3, want: Vector3, distort := 0.2) -> Vector3:
	var k := Vector3(want.x / maxf(have.x, 0.001), want.y / maxf(have.y, 0.001), want.z / maxf(have.z, 0.001))
	var mean := (k.x + k.y + k.z) / 3.0
	var lo := mean * (1.0 - distort)
	var hi := mean * (1.0 + distort)
	return Vector3(clampf(k.x, lo, hi), clampf(k.y, lo, hi), clampf(k.z, lo, hi))

## Один масштаб на все оси (техника, RIGID): длинная сторона модели — по длинной стороне габарита, но поперёк — не
## больше габарита × RIGID_WIDE (иначе широкая модель торчала бы из коллайдера в стену или соседнюю машину).
static func rigid_scale(have: Vector3, want: Vector3) -> Vector3:
	var kx := want.x / maxf(have.x, 0.001)
	var kz := want.z / maxf(have.z, 0.001)
	var s := minf(kx, kz * RIGID_WIDE) if want.x >= want.z else minf(kz, kx * RIGID_WIDE)
	return Vector3.ONE * s

## Модели без «переда» (стол, ящики, блок): если их длинная сторона легла поперёк габарита — поворот на 90°.
const AUTO_TURN := {"e_table": true, "e_crate": true, "e_ammo": true, "e_block": true, "e_dumpster": true}
## Свой предел искажения: штабель труб и стенку мешков можно тянуть вдоль (коллайдер сплошной — без пустых краёв).
const DISTORT := {"e_pipes": 0.4, "e_sandbags": 0.4}
## Техника — без искажения пропорций (жалоба пользователя «машины уродливые»): раньше модель тянули в габарит
## процедурной машины до ±20 % по каждой оси, и у модели Tripo со своими пропорциями длина выходила на 20–50 % больше
## высоты и ширины: «Жигули» и «Волга» — длинные и плоские, «Нива» и УАЗ — растянутые лимузины. Теперь масштаб один на
## все оси (rigid_scale): длина — по габариту, но не шире габарита больше чем в RIGID_WIDE раз (коллайдер прежний).
const RIGID := {
	"e_vaz2107": true, "e_vaz_crashed": true, "e_vaz_burned": true, "e_niva": true, "e_volga": true, "e_uaz": true,
	"e_paz": true, "e_btr80": true, "e_ural": true,
}
const RIGID_WIDE := 1.15
## Оттенок кузова из метки (addCar: цвет краски процедурной машины) — приглушён: у моделей Tripo своя краска, и полный
## оттенок поверх неё давал грязные и кислотные машины. 0 — своя краска модели, 1 — оттенок как в метке.
const TINT_MIX := 0.5

## Поставить предметы из меток в узел parent: MultiMesh по модели и участку. Возвращает число поставленных.
static func place_all(parent: Node3D, props: Array, chunk: float) -> int:
	var groups := {}
	var n := 0
	for p in props:
		var id := str(p.get("m", ""))
		var info := _info(id)
		if info.is_empty():
			continue
		var c: Array = p["c"]
		var s: Array = p["s"]
		var want := Vector3(float(s[0]), float(s[1]), float(s[2]))
		var have: Vector3 = info["size"]
		var turn := AUTO_TURN.has(id) and (want.x - want.z) * (have.x - have.z) < 0.0
		if turn:
			have = Vector3(have.z, have.y, have.x)
		var k := rigid_scale(have, want) if RIGID.has(id) else fit_scale(have, want, float(DISTORT.get(id, 0.2)))
		var ry := float(p["ry"])
		var base := Transform3D(Basis(Vector3.UP, ry), Vector3(float(p["x"]), 0.0, float(p["z"])))
		var lb := Basis.IDENTITY.scaled(k)
		if turn:
			lb = lb * Basis(Vector3.UP, PI * 0.5)
		# низ модели — на низ габарита (по высоте масштаб мог упереться в предел искажения)
		var local := Transform3D(lb, Vector3(float(c[0]), float(c[1]) - want.y * 0.5 + have.y * k.y * 0.5, float(c[2])))
		var key := "%s|%d,%d" % [id, floori(float(p["x"]) / chunk), floori(float(p["z"]) / chunk)]
		if not groups.has(key):
			groups[key] = {"id": id, "list": [], "colors": []}
		groups[key]["list"].append(base * local)
		var col: Array = p.get("tint", [1.0, 1.0, 1.0])
		groups[key]["colors"].append(Color.WHITE.lerp(Color(float(col[0]), float(col[1]), float(col[2])), TINT_MIX))
		n += 1
	var tinted := {}
	for key in groups:
		var g: Dictionary = groups[key]
		var info2 := _info(str(g["id"]))
		for part in info2["parts"]:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = part[0]
			var list: Array = g["list"]
			mm.instance_count = list.size()
			for i in list.size():
				mm.set_instance_transform(i, (list[i] as Transform3D) * (part[1] as Transform3D))
				mm.set_instance_color(i, g["colors"][i])
			var mmi := MultiMeshInstance3D.new()
			mmi.name = "Prop_" + str(key).replace("|", "_").replace(",", "_")
			mmi.multimesh = mm
			mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			# оттенок машин — цветом экземпляра: материал умножает текстуру на цвет вершины/экземпляра
			var src: Material = part[2]
			if src is BaseMaterial3D:
				if not tinted.has(src):
					var dup := (src as BaseMaterial3D).duplicate() as BaseMaterial3D
					dup.vertex_color_use_as_albedo = true
					tinted[src] = dup
				mmi.material_override = tinted[src]
			parent.add_child(mmi)
	return n

## Отдельный экземпляр модели в настоящем размере (длина — LENGTH), стоит на земле, центр в начале осей.
static func instance(id: String) -> Node3D:
	var info := _info(id)
	if info.is_empty():
		return null
	var size: Vector3 = info["size"]
	var long := maxf(size.x, size.z)
	var k := float(LENGTH.get(id, long)) / long if long > 0.001 else 1.0
	var root := Node3D.new()
	root.name = id
	for part in info["parts"]:
		var mi := MeshInstance3D.new()
		mi.mesh = part[0]
		mi.transform = Transform3D(Basis.IDENTITY.scaled(Vector3.ONE * k), Vector3(0, size.y * 0.5 * k, 0)) * (part[1] as Transform3D)
		if part[2]:
			mi.material_override = part[2]
		root.add_child(mi)
	return root
