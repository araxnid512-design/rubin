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
	"e_fridge": Q, "e_pech": Q, "e_burzhuyka": Q,
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

## Масштаб по осям, чтобы модель размера have легла в габарит want; искажение пропорций — не больше ±20 %.
static func fit_scale(have: Vector3, want: Vector3) -> Vector3:
	var k := Vector3(want.x / maxf(have.x, 0.001), want.y / maxf(have.y, 0.001), want.z / maxf(have.z, 0.001))
	var mean := (k.x + k.y + k.z) / 3.0
	return Vector3(clampf(k.x, mean * 0.8, mean * 1.2), clampf(k.y, mean * 0.8, mean * 1.2), clampf(k.z, mean * 0.8, mean * 1.2))

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
		var k := fit_scale(info["size"], want)
		var ry := float(p["ry"])
		var base := Transform3D(Basis(Vector3.UP, ry), Vector3(float(p["x"]), 0.0, float(p["z"])))
		var local := Transform3D(Basis.IDENTITY.scaled(k), Vector3(float(c[0]), float(c[1]), float(c[2])))
		var key := "%s|%d,%d" % [id, floori(float(p["x"]) / chunk), floori(float(p["z"]) / chunk)]
		if not groups.has(key):
			groups[key] = {"id": id, "list": [], "colors": []}
		groups[key]["list"].append(base * local)
		var col: Array = p.get("tint", [1.0, 1.0, 1.0])
		groups[key]["colors"].append(Color(float(col[0]), float(col[1]), float(col[2])))
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
