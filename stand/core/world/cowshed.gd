class_name ULCowshed
extends Node3D
## «Опасный коровник» — временный нестабильный кластер 150×150 м, расставлен по эталону пользователя: вход снизу
## по центру, слева два длинных коровника и загон под ними, сверху водонапорная башня с баками, справа ещё три
## коровника, между ними дороги с колеями, техника, сено, хлам; по краю — деревянный забор, за ним лес.
## Постройки — ULFarmBuilding (кирпич, доски, профнастил; во все можно зайти — крыша и ближняя стена плавно
## растворяются). Растительность — ULVegetation (злаки, сорняки у стен, крапива у заборов, цветы). Постоянная
## часть одна и та же при каждом посещении; останки коров и враги — заново при каждом входе.
## Баланс — data/cowshed.json; карта земли и проходимости строятся --as-test=csbake.

const CFG := "res://data/cowshed.json"
const NAV := "res://assets/world/nav_cowshed.res"
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"
const MASK := "res://assets/world/tex/cowshed_mask.png"
## Постройки. at — центр, yaw — поворот, L — длина (вдоль своей оси X), W — ширина, H — высота стен.
## doors — проёмы [стена, смещение вдоль неё, ширина]: «s+»/«s-» — длинные стены (+z/−z постройки), «e+»/«e-» —
## торцы. win — окон на длинную стену; fill — что внутри: barn (стойла, кормушки, сено), tools, fuel, feed.
const BUILDINGS := [
	{"id": "barnA", "n": "Коровник у башни", "at": Vector3(-39.5, 0, -34.0), "yaw": 0.0, "L": 44.0, "W": 14.0, "H": 3.3,
		"doors": [["e+", 0.0, 3.8], ["e-", 0.0, 3.8], ["s+", -9.0, 3.0], ["s+", 9.0, 3.0]], "win": 6, "fill": "barn", "ruin": 0.45},
	{"id": "annexA", "n": "Пристройка", "at": Vector3(-13.5, 0, -39.0), "yaw": 0.0, "L": 7.0, "W": 6.0, "H": 2.8,
		"doors": [["s+", 0.0, 2.2]], "win": 1, "fill": "tools", "ruin": 0.1},
	{"id": "barnB", "n": "Коровник у загона", "at": Vector3(-40.4, 0, -10.6), "yaw": 0.0, "L": 44.0, "W": 14.0, "H": 3.3,
		"doors": [["e+", 0.0, 3.8], ["s-", -6.0, 3.0], ["s+", 6.0, 3.6]], "win": 6, "fill": "barn", "ruin": 0.55},
	{"id": "barnC", "n": "Северный коровник", "at": Vector3(22.0, 0, -51.0), "yaw": 0.0, "L": 32.0, "W": 12.0, "H": 3.2,
		"doors": [["s+", -4.0, 3.6], ["e-", 0.0, 3.2], ["e+", 0.0, 3.2]], "win": 4, "fill": "barn", "ruin": 0.3},
	{"id": "barnD", "n": "Малый коровник", "at": Vector3(50.7, 0, -20.0), "yaw": PI * 0.5, "L": 22.0, "W": 13.0, "H": 3.2,
		"doors": [["e-", 0.0, 3.6], ["s-", 3.0, 2.6]], "win": 3, "fill": "feed", "ruin": 0.25},
	{"id": "barnE", "n": "Южный коровник", "at": Vector3(41.0, 0, 35.0), "yaw": 0.0, "L": 33.0, "W": 14.0, "H": 3.3,
		"doors": [["s-", -6.0, 3.6], ["e-", 0.0, 3.4], ["s+", 8.0, 3.0]], "win": 5, "fill": "barn", "ruin": 0.3},
]
## заборы: по краю (с проломами и проходом у входа), загон, ограда у башни, загородки у коровников
const FENCES := [
	[Vector2(-0.5, 72.0), Vector2(72.0, 72.0), Vector2(72.0, 14.0)],
	[Vector2(72.0, 10.0), Vector2(72.0, -72.0), Vector2(34.0, -72.0)],
	[Vector2(30.0, -72.0), Vector2(-72.0, -72.0), Vector2(-72.0, 72.0), Vector2(-9.0, 72.0)],
	[Vector2(-24.0, 12.0), Vector2(-24.0, 26.8), Vector2(-65.7, 26.8), Vector2(-65.7, 2.2), Vector2(-24.0, 2.2), Vector2(-24.0, 7.0)],
	[Vector2(-65.7, -50.4), Vector2(-17.0, -50.4)], [Vector2(-11.0, -50.4), Vector2(-5.4, -50.4)],
	[Vector2(57.5, -8.0), Vector2(66.0, -8.0), Vector2(66.0, -2.0)], [Vector2(59.5, 23.0), Vector2(66.4, 25.0), Vector2(66.4, 31.0)],
]
const PEN := [Vector2(-65.7, 2.2), Vector2(-24.0, 2.2), Vector2(-24.0, 26.8), Vector2(-65.7, 26.8)]
## дороги (накатанные колёсами, с колеями)
const ROADS := [
	[Vector2(-4.7, 76.0), Vector2(-4.2, 60.0), Vector2(-3.9, 46.1), Vector2(-2.5, 21.5), Vector2(-1.8, 3.9), Vector2(-1.1, -11.8)],
	[Vector2(-1.1, -11.8), Vector2(-2.5, -32.9), Vector2(-2.8, -52.2), Vector2(-8.0, -57.0)],
	[Vector2(-1.1, -11.8), Vector2(-8.3, -20.6), Vector2(-14.9, -28.0), Vector2(-17.6, -34.0)],
	[Vector2(-1.1, -11.8), Vector2(-11.1, -8.3), Vector2(-18.4, -10.6)],
	[Vector2(-1.1, -11.8), Vector2(11.8, -27.6), Vector2(33.4, -39.0), Vector2(54.9, -38.2), Vector2(66.0, -27.6), Vector2(66.5, -3.1),
		Vector2(63.5, 23.2), Vector2(57.5, 45.0), Vector2(49.2, 58.0)],
	[Vector2(-1.1, -11.8), Vector2(11.8, 0.4), Vector2(26.2, 14.5), Vector2(30.0, 27.5)],
	[Vector2(11.8, -27.6), Vector2(18.0, -38.0), Vector2(18.0, -44.5)],
	[Vector2(54.9, -38.2), Vector2(50.7, -31.0)],
]
## тропы (вытоптаны людьми и скотом)
const TRAILS := [[Vector2(-24.0, 9.5), Vector2(-12.0, 6.0), Vector2(-2.0, 5.0)], [Vector2(47.0, 5.0), Vector2(47.5, 17.0)]]
## где враги держатся чаще (дворы между постройками): центр и полуоси
const DANGER := [[Vector3(-40.0, 0, -22.3), Vector2(14.0, 3.0)], [Vector3(36.0, 0, -30.0), Vector2(8.0, 5.0)], [Vector3(25.0, 0, 26.0), Vector2(7.0, 6.0)]]
## места останков коров по эталону (каждое посещение — со сдвигом и поворотом); остальные — случайно: в коровниках,
## у заборов, в поле
const SKELETONS := [Vector3(30.5, 0, -18.9), Vector3(19.7, 0, -66.0), Vector3(52.0, 0, -62.7), Vector3(-28.3, 0, 36.4), Vector3(67.0, 0, -31.1)]
const CARCASSES := [Vector3(-0.8, 0, -20.6), Vector3(17.6, 0, -28.2), Vector3(-40.6, 0, 15.4), Vector3(-12.6, 0, 44.3)]
## рощи внутри забора: центр, радиус, сколько деревьев
const WOODS := [
	[Vector3(-50, 0, 48), 15.0, 20], [Vector3(47.7, 0, 7.5), 6.0, 6], [Vector3(-31, 0, -66), 4.0, 3], [Vector3(-56, 0, -63), 5.0, 4],
	[Vector3(62, 0, -62), 6.0, 5], [Vector3(19, 0, 53), 4.0, 3], [Vector3(53, 0, 61), 7.0, 6], [Vector3(-66, 0, 62), 5.0, 4],
	[Vector3(-68, 0, -8), 3.0, 2], [Vector3(68, 0, 1), 3.0, 2], [Vector3(68.5, 0, -48.7), 3.0, 2], [Vector3(19, 0, 5), 2.0, 1],
]
const ENTRY := Vector3(-4.7, 0, 66.0)
const ENTRY_YAW := PI              ## у входа герой смотрит на север — на дорогу к постройкам
const SILO := Vector3(-14.3, 0, -61.0)
## баки у башни и у коровника: точка, радиус, высота
const TANKS := [[Vector3(-38.7, 0, -47.0), 1.3, 3.2], [Vector3(1.5, 0, -59.2), 1.1, 2.6]]
## техника и телеги (модели Tripo): [вид, точка, поворот]
const VEHICLES := [["tractor", Vector3(9.0, 0, 18.9), 0.6], ["tractor", Vector3(25.5, 0, 0.4), -0.9], ["truck", Vector3(-9.5, 0, 1.3), 0.25],
	["trailer", Vector3(-50.0, 0, 7.0), 1.2], ["cart", Vector3(-31.9, 0, 18.0), -0.4], ["trailer", Vector3(-13.3, 0, 22.4), 2.0],
	["cart", Vector3(6.8, 0, 49.6), 1.4], ["trailer", Vector3(63.0, 0, -33.0), 0.3]]
## вид → [модель, длина (наибольший размер по земле), м, оттенок (выгоревшая краска, грязь)]
const VEHICLE_MODELS := {"tractor": ["ul_tractor", 4.2, Color(0.62, 0.6, 0.56)], "truck": ["ul_truck", 6.2, Color(0.8, 0.78, 0.74)],
	"trailer": ["ul_trailer", 6.5, Color(0.8, 0.78, 0.74)], "cart": ["ul_cart", 3.2, Color(0.82, 0.8, 0.76)]}
## тюки сена (круглые): точка, сколько
const HAY := [[Vector3(-65.0, 0, -40.0), 3], [Vector3(-68.0, 0, -15.0), 4], [Vector3(42.7, 0, -45.5), 2], [Vector3(32.7, 0, -66.0), 2],
	[Vector3(60.0, 0, 34.0), 2], [Vector3(-17.0, 0, -45.5), 2]]
## кучи хлама: точка, радиус
const JUNK := [[Vector3(-15.0, 0, -4.0), 3.0], [Vector3(4.0, 0, -49.0), 3.0], [Vector3(24.0, 0, 44.0), 2.5], [Vector3(59.0, 0, -12.0), 2.5],
	[Vector3(-60.0, 0, -45.0), 2.5], [Vector3(-28.0, 0, -45.0), 2.0]]

static var _cfg := {}
var w                              ## локация (world.gd)
var half := 75.0
var body: StaticBody3D
var barns: Array = []              ## постройки: {b (ULFarmBuilding), node, roof, front, half, xf, xi, id, n}
var cows: Array[Vector3] = []
var counts := {}                   ## итог перезагрузки (ULReload): сколько пустышей, лоторейщиков, руберов; пусто — по data
var fence_mid: Array[Vector3] = []
var fence_pts: Array[Vector3] = []
var wood_pts: Array[Vector3] = []
var trees: Array[Node3D] = []      ## деревья-модели
var puddle_pts: Array[Vector3] = []
var veg_count := 0
var mask: Image                    ## карта земли (R — трава, G — дорога, B — подстилка, A — затенение)
var _noise_tex: ImageTexture
var _noise_img: Image
var _spruce_xf: Array[Transform3D] = []
var _binfo: Array = []             ## [обратное преобразование, полуразмер, проёмы (Vector2)] — для быстрых проверок
var _cow_scenes := {}
var _scenes := {}
var _tick_t := 0.0
var _mats := {}                    ## материалы построек и забора (ULFarmBuilding.make_materials)
var _st := {}                      ## [узел, материал] → SurfaceTool (заборы, хлам — одной сеткой)
var _bxm := BoxMesh.new()


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


func build(world: Node3D) -> void:
	w = world
	half = float(cfg().get("size", 150.0)) * 0.5
	# тело столкновений — в сцену в конце сборки: физика соберёт его один раз (не после каждой коробки)
	body = StaticBody3D.new()
	body.name = "CowshedBody"
	var t0 := Time.get_ticks_msec()
	var fn := FastNoiseLite.new()
	fn.seed = 77
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var fence_mat: ShaderMaterial = (_mats.planks as ShaderMaterial).duplicate()
	fence_mat.set_shader_parameter("scale", 1.3)
	fence_mat.set_shader_parameter("grime", 0.45)
	fence_mat.set_shader_parameter("tint", Color(0.8, 0.76, 0.7))
	_mats["fence"] = fence_mat
	for b in BUILDINGS:
		var xf := Transform3D(Basis(Vector3.UP, float(b.yaw)), b.at)
		var doors: Array[Vector2] = []
		for dr in b.doors:
			doors.append(_door_point(b, dr))
		_binfo.append([xf.affine_inverse(), Vector2(float(b.L) * 0.5, float(b.W) * 0.5), doors])
	var rng := RandomNumberGenerator.new()
	rng.seed = 4417                  # постоянная часть — одна и та же
	for d in BUILDINGS:
		var b := ULFarmBuilding.new()
		add_child(b)
		b.build(d, _mats, rng)
		for c in b.cols:
			_col_xf(c[0], c[1])
		barns.append({"b": b, "node": b, "roof": b.roof, "front": [b.front], "half": b.half, "xf": b.transform, "xi": b.transform.affine_inverse(), "id": String(d.id), "n": String(d.n)})
		_cull(b, 120.0)
	var fr := Node3D.new()
	fr.name = "Fences"
	add_child(fr)
	_fences(fr, rng)
	_forest(rng)
	_ground()                          # после леса: под деревьями — лесная подстилка
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_landmarks(props, rng)
	_vehicles(rng)
	_hay(rng)
	_junk(props, rng)
	_farm_props()
	_forest_props()
	_flush(fr)
	_flush(props)
	_vegetation()
	add_child(body)
	print("[cs] коровник собран: %d мс, столкновений %d" % [Time.get_ticks_msec() - t0, body.get_child_count()])


# ---------------- земля ----------------

## Земля — тот же шейдер, что на базе, слоями: трава, сухие проплешины, лесная подстилка, сырая грязь у построек и
## в загоне (скот вытоптал), накатанные дороги (Poly Haven, CC0). Карта слоёв считается один раз
## (--as-test=csbake). Сверху — колеи с водой по дорогам, гравий у ворот, лужи.
func _ground() -> void:
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	var sm: ShaderMaterial = w.ground_for("cowshed", half * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(MASK) and w.test != "csbake":
		mask = (load(MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _bake_mask()
		if w.test == "csbake":
			mask.save_png(ProjectSettings.globalize_path(MASK))
			print("[bake] карта земли коровника: ", MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF   # земля сама ни на что тень не бросает: в карту теней не рисуется
	add_child(mi)
	# за краем поля — лесная земля
	ULHouse.outer_frame(self, half, 420.0)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(420, 0.2, 420)
	cs.shape = bs
	cs.position.y = -0.1
	body.add_child(cs)
	# невидимая граница: за край можно выйти (там отсчёт до карты мира), дальше — нет
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, half * 2.0 + 2) if s.x != 0.0 else Vector3(half * 2.0 + 2, 4, 1)
		wc.shape = b
		wc.position = s * (half + 9.0) + Vector3.UP * 2.0
		body.add_child(wc)
	# колеи по дорогам, гравий у ворот, лужи в колеях, у ворот и в загоне
	ULGroundDetail.ruts(self, ROADS, _noise_tex, "brown_mud_02")
	var aprons: Array = []
	for b in BUILDINGS:
		var xf := Transform3D(Basis(Vector3.UP, float(b.yaw)), b.at)
		for dr in b.doors:
			var dp := _door_point(b, dr)
			var lp := Vector3(dp.x, 0, dp.y) + ULFarmBuilding._side_normal(String(dr[0])) * 1.8
			aprons.append([xf * lp, float(dr[2]) * 0.55 + 0.9])
	ULGroundDetail.patches(self, aprons, "gravel_floor_02", _noise_tex)
	var pen := PackedVector2Array(PEN)
	puddle_pts = ULGroundDetail.puddles(self, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		if in_barn(p, 1.0) >= 0:
			return false
		var m := mask_px(p)
		var rd := _road_dist(q)
		if absf(rd - 0.8) < 0.35:
			return _noise(q / 7.0) > 0.5            # в колее, где она глубокая
		if m.r > 0.3 or m.b > 0.3:
			return false
		return _barn_dist(q).y < 7.0 or Geometry2D.is_point_in_polygon(q, pen), half * 2.0, 53, 1400, _noise_tex)


func _noise(uv: Vector2) -> float:
	return _noise_img.get_pixel(int(fposmod(uv.x, 1.0) * 256.0) % 256, int(fposmod(uv.y, 1.0) * 256.0) % 256).r


static func _seg_dist(q: Vector2, a: Vector2, b: Vector2) -> float:
	var ab := b - a
	var h := clampf((q - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
	return q.distance_to(a + ab * h)


## расстояние от точки до постройки (снаружи; внутри — 0) и до ближайшего проёма (ворот, двери)
func _barn_dist(q: Vector2) -> Vector2:
	var d := 1e9
	var g := 1e9
	var p3 := Vector3(q.x, 0, q.y)
	for bi in _binfo:
		var l: Vector3 = (bi[0] as Transform3D) * p3
		var hh: Vector2 = bi[1]
		var o := Vector2(maxf(absf(l.x) - hh.x, 0.0), maxf(absf(l.z) - hh.y, 0.0))
		d = minf(d, o.length())
		if o.length() < 12.0:
			for dp in bi[2]:
				g = minf(g, Vector2(l.x, l.z).distance_to(dp))
	return Vector2(d, g)


## середина проёма в системе постройки (на плоскости x, z)
static func _door_point(b: Dictionary, dr: Array) -> Vector2:
	var hl := float(b.L) * 0.5
	var hw := float(b.W) * 0.5
	match String(dr[0]):
		"s+":
			return Vector2(float(dr[1]), hw)
		"s-":
			return Vector2(float(dr[1]), -hw)
		"e+":
			return Vector2(hl, float(dr[1]))
	return Vector2(-hl, float(dr[1]))


## расстояние до ближайшей дороги (до её середины)
func _road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in ROADS:
		for i in r.size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func _fence_dist(q: Vector2) -> float:
	var d := 1e9
	for line in FENCES:
		for i in line.size() - 1:
			d = minf(d, _seg_dist(q, line[i], line[i + 1]))
	return d


func _bake_mask() -> Image:
	var n := 384
	var tpts: Array = []
	for t in trees:
		tpts.append([t.position, 1.5])
	for xf in _spruce_xf:
		tpts.append([xf.origin, 1.5 * xf.basis.get_scale().x])
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var pen := PackedVector2Array(PEN)
	for iy in n:
		for ix in n:
			var p := Vector2((ix + 0.5) / n - 0.5, (iy + 0.5) / n - 0.5) * half * 2.0
			var n1 := _noise(p / 70.0)
			var n2 := _noise(p / 19.0 + Vector2(0.37, 0.11))
			var n3 := _noise(p / 5.5 + Vector2(0.71, 0.53))
			var bd := _barn_dist(p)
			var rd := _road_dist(p)
			var tr := 1e9
			for t in TRAILS:
				for i in t.size() - 1:
					tr = minf(tr, _seg_dist(p, t[i], t[i + 1]))
			# дорога: накатанная полоса ~4,5 м; посередине между колеями пробивается трава; тропа — узкая
			var road := 1.0 - smoothstep(1.7, 2.8, rd + (n3 - 0.5) * 1.0)
			var mid := 1.0 - smoothstep(0.0, 0.4, rd)
			var path := maxf(road * (1.0 - mid * 0.45 * smoothstep(0.4, 0.6, n2)), 1.0 - smoothstep(0.45, 1.0, tr + (n3 - 0.5) * 0.6))
			# у построек и ворот скот вытоптал траву до грязи, в загоне — тоже
			var yard := 1.0 - smoothstep(0.6, 4.0 + n2 * 4.0, bd.x)
			var gate := 1.0 - smoothstep(2.0, 7.5 + n3 * 2.0, bd.y)
			var in_pen := 0.9 if Geometry2D.is_point_in_polygon(p, pen) else 0.0
			var inside := 1.0 if bd.x <= 0.001 else 0.0
			var bare := maxf(maxf(maxf(yard * 0.75, gate), in_pen * smoothstep(0.3, 0.6, n2 * 0.6 + n3 * 0.4)), inside)
			var gw := smoothstep(0.22, 0.48, n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * 0.8 + 0.2
			gw *= (1.0 - bare) * (1.0 - path)
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.9
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.4, bd.x)) * 0.4 * (1.0 - inside)
			im.set_pixel(ix, iy, Color(gw, path * (1.0 - inside), fw, ao))
	return im


## точка карты земли: R — трава, G — дорога, B — подстилка
func mask_px(p: Vector3) -> Color:
	if mask == null:
		return Color(1, 0, 0, 1)
	var x := clampi(int((p.x / (half * 2.0) + 0.5) * mask.get_width()), 0, mask.get_width() - 1)
	var y := clampi(int((p.z / (half * 2.0) + 0.5) * mask.get_height()), 0, mask.get_height() - 1)
	return mask.get_pixel(x, y)


func grass_at(p: Vector3) -> float:
	return mask_px(p).r


# ---------------- растительность ----------------

## Злаки — по траве (гуще там, где трава густая; на дорогах и во вытоптанных дворах почти нет), цвет — от
## приглушённо-зелёного до выгоревшего (крупные пятна шума); сорняки — у стен построек; крапива — вдоль заборов;
## одуванчики и цветущий щавель — редкими куртинами; кусты — у забора.
func _vegetation() -> void:
	var q := float(ULSettings.q().grass)
	var rng_m := float(ULSettings.q().range)
	var size := half * 2.0
	veg_count += ULVegetation.scatter(self, "grass", size, 1.5 * q + 0.15, func(p: Vector3) -> float:
		if absf(p.x) > half - 0.5 or absf(p.z) > half - 0.5:
			return 0.0
		var m := mask_px(p)
		var v := clampf(m.r * 1.2 - m.g * 0.8 - 0.1, 0.0, 1.0)
		return v if v <= 0.0 or in_barn(p, 0.4) < 0 else 0.0, func(p: Vector3, r: RandomNumberGenerator) -> Color:
		var dry := smoothstep(0.45, 0.72, _noise(Vector2(p.x, p.z) / 70.0) * 0.6 + _noise(Vector2(p.x, p.z) / 19.0 + Vector2(0.37, 0.11)) * 0.4)
		return ULVegetation.grass_tint(dry, r) * Color(0.82, 0.84, 0.8), Vector2(0.25, 0.7), 1.4, 901, rng_m)
	veg_count += ULVegetation.scatter(self, "weed", size, 0.6 * q + 0.05, func(p: Vector3) -> float:
		var bd := _barn_dist(Vector2(p.x, p.z))
		if bd.x <= 0.2 or bd.y < 2.6:
			return 0.0
		return (1.0 - smoothstep(0.3, 3.2, bd.x)) * 0.9, func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.86, 0.9, 0.76) * r.randf_range(0.82, 1.05), Vector2(0.4, 0.7), 1.2, 902, rng_m)
	veg_count += ULVegetation.scatter(self, "nettle", size, 0.8 * q + 0.05, func(p: Vector3) -> float:
		var fd := _fence_dist(Vector2(p.x, p.z))
		if fd > 1.6 or mask_px(p).g > 0.3:
			return 0.0
		return (1.0 - smoothstep(0.25, 1.5, fd)) * 0.8, func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.8, 0.88, 0.76) * r.randf_range(0.85, 1.05), Vector2(0.55, 0.95), 0.9, 903, rng_m)
	veg_count += ULVegetation.scatter(self, "flower", size, 0.06 * q + 0.01, func(p: Vector3) -> float:
		var m := mask_px(p)
		if m.r < 0.5:
			return 0.0
		return m.r * smoothstep(0.55, 0.7, _noise(Vector2(p.x, p.z) / 11.0 + Vector2(0.2, 0.6))), func(_p: Vector3, r: RandomNumberGenerator) -> Color:
		return Color(0.95, 0.95, 0.9) * r.randf_range(0.85, 1.05), Vector2(0.3, 0.5), 1.3, 904, rng_m)
	# кусты у забора
	var bush: PackedScene = ULSanatorium.bush_scene()
	if bush and not fence_pts.is_empty():
		var rng := RandomNumberGenerator.new()
		rng.seed = 905
		var placed := 0
		var tries := 0
		while placed < 40 and tries < 900:
			tries += 1
			var p: Vector3 = fence_pts[rng.randi() % fence_pts.size()] + Vector3(rng.randf_range(-1.6, 1.6), 0, rng.randf_range(-1.6, 1.6))
			if in_barn(p, 1.5) >= 0 or mask_px(p).g > 0.3 or p.distance_to(ENTRY) < 7.0:
				continue
			var t: Node3D = bush.instantiate()
			var bb: AABB = w._aabb(t)
			t.scale = Vector3.ONE * (rng.randf_range(0.8, 1.4) / maxf(bb.size.y, 0.01))
			t.position = p
			t.rotation.y = rng.randf() * TAU
			add_child(t)
			_cull(t, 45.0)
			placed += 1


# ---------------- постройки: служебное ----------------

func _col_xf(size: Vector3, xf: Transform3D) -> void:
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.transform = xf
	body.add_child(cs)


## в какой постройке точка (по внутреннему прямоугольнику с запасом m); -1 — снаружи
func in_barn(p: Vector3, m := 0.0) -> int:
	for i in _binfo.size():
		var bi: Array = _binfo[i]
		var l: Vector3 = (bi[0] as Transform3D) * p
		var hh: Vector2 = bi[1]
		if absf(l.x) < hh.x + m and absf(l.z) < hh.y + m:
			return i
	return -1


func near_landmark(p: Vector3, m: float) -> bool:
	return in_barn(p, m) >= 0


## случайная точка внутри постройки (в проходе или стойле), в системе мира
func barn_point(i: int, rng: RandomNumberGenerator) -> Vector3:
	var b: Dictionary = barns[i]
	var hh: Vector2 = b.half
	var l := Vector3(rng.randf_range(-hh.x + 1.2, hh.x - 1.2), 0, rng.randf_range(-hh.y + 0.9, hh.y - 0.9))
	return (b.xf as Transform3D) * l


## Кадр: герой в постройке — её крыша и стена со стороны камеры плавно растворяются; вышел — проявляются.
func tick(hero: Vector3, _cam, delta: float) -> void:
	_tick_t -= delta
	if _tick_t <= 0.0:
		_tick_t = 0.1
		var inside := in_barn(hero, 0.2)
		for i in barns.size():
			(barns[i].b as ULFarmBuilding).set_inside(i == inside)
	for b in barns:
		(b.b as ULFarmBuilding).tick_fade(delta)


## деталь в общую сетку узла g (заборы, хлам, телеги)
func _bx(g: Node3D, m: String, size: Vector3, xf: Transform3D) -> void:
	var key := [g, m]
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	_bxm.size = size
	(_st[key] as SurfaceTool).append_from(_bxm, 0, xf)


func _flush(g: Node3D) -> void:
	for key in _st.keys():
		if key[0] != g:
			continue
		var mi := MeshInstance3D.new()
		mi.mesh = (_st[key] as SurfaceTool).commit()
		mi.material_override = _mats[String(key[1])]
		g.add_child(mi)
		_st.erase(key)


func _at(p: Vector3, yaw := 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), p)


# ---------------- заборы ----------------

## Деревянный забор: столбы разной высоты (чуть вкось), три жерди. Пролёты бывают целые, покосившиеся
## (завалились на бок), сломанные (верхняя жердь висит наискось) и пустые (одни столбы).
## Столкновение — у целых и покосившихся (1,1 м: перелезть нельзя, стрелять поверх — можно).
func _fences(g: Node3D, rng: RandomNumberGenerator) -> void:
	for line in FENCES:
		for i in range(line.size() - 1):
			var a: Vector2 = line[i]
			var b: Vector2 = line[i + 1]
			var L := a.distance_to(b)
			var dir := (b - a) / L
			var yaw := atan2(-dir.y, dir.x)
			var nseg := int(ceil(L / 2.6))
			for s in nseg + 1:
				var pp := a + dir * (L * s / nseg)
				var ph := rng.randf_range(1.15, 1.4)
				_bx(g, "beam", Vector3(0.13, ph, 0.13), Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.06, 0.06), rng.randf() * PI, rng.randf_range(-0.06, 0.06))), Vector3(pp.x, ph * 0.5 - 0.05, pp.y)))
			for s in nseg:
				var p0 := a + dir * (L * s / nseg)
				var p1 := a + dir * (L * (s + 1) / nseg)
				var mid := (p0 + p1) * 0.5
				var seg := p0.distance_to(p1)
				var m3 := Vector3(mid.x, 0, mid.y)
				for k in 3:
					fence_pts.append(Vector3(p0.x, 0, p0.y).lerp(Vector3(p1.x, 0, p1.y), (k + 0.5) / 3.0))
				var r := rng.randf()
				if r < 0.07:
					continue                                 # пустой пролёт
				fence_mid.append(m3)
				var bas := Basis(Vector3.UP, yaw)
				if r < 0.17:
					# сломан: верхняя жердь висит наискось, нижняя на месте, средней нет
					_bx(g, "fence", Vector3(seg, 0.1, 0.05), Transform3D(bas * Basis(Vector3.FORWARD, 0.42 * (1.0 if rng.randf() < 0.5 else -1.0)), m3 + Vector3(0, 0.62, 0)))
					_bx(g, "fence", Vector3(seg + 0.1, 0.1, 0.05), Transform3D(bas, m3 + Vector3(0, 0.36, 0)))
					continue
				var lean := 0.0
				if r < 0.27:
					lean = rng.randf_range(0.18, 0.35) * (1.0 if rng.randf() < 0.5 else -1.0)   # покосился
				var lb := bas * Basis(Vector3.RIGHT, lean)
				for hy in [0.36, 0.7, 1.04]:
					_bx(g, "fence", Vector3(seg + 0.12, 0.11, 0.05), Transform3D(lb * Basis(Vector3.FORWARD, rng.randf_range(-0.02, 0.02)), m3 + lb * Vector3(0, hy, 0)))
				var cs := CollisionShape3D.new()
				var bs := BoxShape3D.new()
				bs.size = Vector3(seg, 1.1, 0.2)
				cs.shape = bs
				cs.transform = Transform3D(bas, m3 + Vector3(0, 0.55, 0))
				body.add_child(cs)


# ---------------- лес ----------------

## Рощи внутри забора и лес за ним: ели (одной сеткой), сосны, берёзы, дубы, сухие деревья; часть — молодые,
## пониже. Деревья, закрывающие героя, растворяет ULCanopy.
func _forest(rng: RandomNumberGenerator) -> void:
	var kinds := []
	for k in [["ul_pine", 0.16, 3.8, 4.8], ["ul_birch", 0.08, 3.6, 5.0], ["ul_oak", 0.32, 3.8, 5.0], ["ul_dead_tree", 0.06, 3.2, 4.4]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3], String(k[0])])
	var pts: Array = []
	for wd in WOODS:
		var c: Vector3 = wd[0]
		var rr: float = wd[1]
		var n: int = wd[2]
		var tries := 0
		while n > 0 and tries < 400:
			tries += 1
			var p := c + Vector3(rng.randf_range(-rr, rr), 0, rng.randf_range(-rr, rr))
			if p.distance_to(c) > rr or absf(p.x) > 70.5 or absf(p.z) > 70.5 or _road_dist(Vector2(p.x, p.z)) < 3.2 or _barn_dist(Vector2(p.x, p.z)).x < 2.5:
				continue
			pts.append([p, true])
			n -= 1
	# лес за забором — кольцом в два ряда (без столкновений: за забором — край кластера)
	var t := -84.0
	while t < 84.0:
		for side in 4:
			for row in 2:
				var d := rng.randf_range(76.5, 80.0) + row * 5.0
				var along := t + rng.randf_range(-1.5, 1.5)
				var p: Vector3 = [Vector3(along, 0, -d), Vector3(along, 0, d), Vector3(-d, 0, along), Vector3(d, 0, along)][side]
				if absf(p.x + 4.7) < 7.0 and p.z > 0.0:
					continue                                # дорога к входу
				pts.append([p, false])
		t += 4.0
	for pp in pts:
		var p: Vector3 = pp[0]
		var near := false
		for q in wood_pts:
			if q.distance_to(p) < 2.6:
				near = true
				break
		if near:
			continue
		wood_pts.append(p)
		var pick := rng.randf()
		var chosen = null
		var acc := 0.38
		if pick >= acc:
			for k in kinds:
				acc += float(k[1])
				if pick < acc:
					chosen = k
					break
		if chosen == null:
			_spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.8, 1.15)), p))
		else:
			var young: bool = pp[1] and rng.randf() < 0.25
			_tree(chosen[0], p, rng.randf_range(float(chosen[2]), float(chosen[3])) * (0.6 if young else 1.0), rng.randf() * TAU, String(chosen[4]))
		if pp[1]:
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.22
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true                # в режиме совместимости без цвета экземпляра сетка с custom data — чёрная
	mm.mesh = w._spruce_mesh(4.6, 141)
	mm.instance_count = _spruce_xf.size()
	for i in _spruce_xf.size():
		mm.set_instance_transform(i, _spruce_xf[i])
		mm.set_instance_color(i, Color.WHITE)
		mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
	w.canopy.add_multimesh(mm, 4.6)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	add_child(mi)


const TREE_TINT := {"ul_oak": Color(0.7, 0.74, 0.62), "ul_birch": Color(0.78, 0.8, 0.72), "ul_pine": Color(1.0, 1.0, 1.0), "ul_dead_tree": Color(0.62, 0.6, 0.56)}


func _tree(sc: PackedScene, p: Vector3, h: float, yaw: float, kind := "") -> void:
	var t: Node3D = sc.instantiate()
	if TREE_TINT.has(kind):
		_dirty(t, kind, TREE_TINT[kind])
	var bb: AABB = w._aabb(t)
	t.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
	t.position = p
	t.rotation.y = yaw
	add_child(t)
	_cull(t, 55.0)
	trees.append(t)
	w.canopy.add_model(t, h)


## дальше dist от камеры модель не рисуется (камера видит ~10–20 м вокруг героя)
func _cull(n: Node, dist: float) -> void:
	for m in n.find_children("*", "GeometryInstance3D", true, false):
		var g := m as GeometryInstance3D
		g.visibility_range_end = dist
		g.visibility_range_end_margin = 4.0


# ---------------- башня, баки, техника, сено, хлам ----------------

## Модели Tripo у коровников (рядом с воротами, вдоль стены): кормушки, ясли с сеном, поилки, тюки, тачки;
## у пристройки — танк-охладитель молока. Столкновение — коробка по размеру предмета.
const FARM_PROPS := {
	"barnA": [["cs_hayrack", 1.5, true], ["cs_bale", 1.2, false]], "barnB": [["cs_trough", 2.6, false], ["cs_trough", 2.6, false]],
	"barnC": [["cs_water", 1.8, false], ["cs_barrow", 1.4, false]], "barnD": [["cs_bale", 1.2, false], ["cs_hayrack", 1.5, true]],
	"barnE": [["cs_trough", 2.6, false], ["cs_barrow", 1.4, false]], "annexA": [["cs_milktank", 1.7, true]],
}


func _farm_props() -> void:
	for d in BUILDINGS:
		var items: Array = FARM_PROPS.get(String(d.id), [])
		if items.is_empty() or (d.doors as Array).is_empty():
			continue
		var at: Vector3 = d.at
		var bas := Basis(Vector3.UP, float(d.yaw))
		var dr: Array = d.doors[0]
		var side := String(dr[0])
		var off := float(dr[1])
		var dw := float(dr[2])
		var hl := float(d.L) * 0.5
		var hw := float(d.W) * 0.5
		var lp: Vector3
		var ln: Vector3
		match side:
			"s+":
				lp = Vector3(off, 0, hw)
				ln = Vector3(0, 0, 1)
			"s-":
				lp = Vector3(off, 0, -hw)
				ln = Vector3(0, 0, -1)
			"e+":
				lp = Vector3(hl, 0, off)
				ln = Vector3(1, 0, 0)
			_:
				lp = Vector3(-hl, 0, off)
				ln = Vector3(-1, 0, 0)
		var nrm: Vector3 = bas * ln
		var along := Vector3(-nrm.z, 0, nrm.x)
		var door: Vector3 = at + bas * lp
		for i in items.size():
			var it: Array = items[i]
			var sgn := 1.0 if i % 2 == 0 else -1.0
			var p := door + along * sgn * (dw * 0.5 + 1.7) + nrm * 1.1
			if not ResourceLoader.exists(MODELS + String(it[0]) + ".glb"):
				continue
			# длинное — вдоль стены
			var yaw := atan2(along.x, along.z)
			var n := _model(MODELS + String(it[0]) + ".glb", p, yaw, float(it[1]), bool(it[2]))
			if n == null:
				continue
			_dirty(n, String(it[0]), Color(0.84, 0.82, 0.78))
			for gi in n.find_children("*", "GeometryInstance3D", true, false):
				(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
				(gi as GeometryInstance3D).lod_bias = 0.35
			var bb: AABB = w._aabb(n)
			# рамка уже в мировых осях (с поворотом модели) — коробка без поворота
			_col_xf(Vector3(maxf(bb.size.x * 0.9, 0.3), maxf(bb.size.y, 0.6), maxf(bb.size.z * 0.9, 0.3)), Transform3D(Basis(), bb.get_center()))


## Лесные мелочи (Poly Haven, CC0): валуны со мхом и упавшие сухие стволы у деревьев внутри забора. Своё зерно
## случайностей — расстановка остального не сдвигается. Столкновение — коробка по модели с её поворотом.
func _forest_props() -> void:
	var rr := RandomNumberGenerator.new()
	rr.seed = 7171
	var inner := wood_pts.filter(func(p: Vector3): return absf(p.x) < 67.0 and absf(p.z) < 67.0)
	if inner.is_empty():
		return
	var placed: Array[Vector3] = []
	var want := 13
	var tries := 0
	while placed.size() < want and tries < 500:
		tries += 1
		var t: Vector3 = inner[rr.randi() % inner.size()]
		var a := rr.randf() * TAU
		var trunk := placed.size() >= 8
		var q3 := t + Vector3(cos(a), 0, sin(a)) * rr.randf_range(2.0, 2.8)
		var q := Vector2(q3.x, q3.z)
		var r := 2.0 if trunk else 1.0
		if _road_dist(q) < 4.5 or _barn_dist(q).x < 3.5 or q3.distance_to(ENTRY) < 9.0 or absf(q.x) > 68.0 or absf(q.y) > 68.0:
			continue
		var bad := false
		for wp in wood_pts:
			if wp != t and wp.distance_to(q3) < r + 0.4:
				bad = true
				break
		for pp in placed:
			if pp.distance_to(q3) < 4.0:
				bad = true
		if bad:
			continue
		var id: String = "ph_trunk" if trunk else ["ph_rock1", "ph_rock2", "ph_rock3"][rr.randi() % 3]
		var yaw := rr.randf() * TAU
		var n := _model(MODELS + id + ".glb", q3 + (Vector3.ZERO if trunk else Vector3.DOWN * 0.08), yaw, rr.randf_range(3.2, 4.0) if trunk else rr.randf_range(1.0, 1.8))
		if n == null:
			return
		placed.append(q3)
		_dirty(n, id, Color(0.82, 0.84, 0.78))
		for gi in n.find_children("*", "GeometryInstance3D", true, false):
			(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			(gi as GeometryInstance3D).lod_bias = 0.35
		n.rotation.y = 0.0
		var bb: AABB = w._aabb(n)
		n.rotation.y = yaw
		var c := bb.get_center() - n.position
		_col_xf(Vector3(bb.size.x * 0.85, maxf(bb.size.y, 1.0), bb.size.z * 0.85), Transform3D(Basis(Vector3.UP, yaw), n.position + Basis(Vector3.UP, yaw) * Vector3(c.x, maxf(bb.size.y, 1.0) * 0.5, c.z)))


func _model(path: String, at: Vector3, yaw: float, size: float, by_height := false) -> Node3D:
	if not ResourceLoader.exists(path):
		return null
	if not _scenes.has(path):
		_scenes[path] = load(path)
	var n: Node3D = (_scenes[path] as PackedScene).instantiate()
	ULSanatorium.mute(n)
	var bb: AABB = w._aabb(n)
	n.scale = Vector3.ONE * (size / maxf(bb.size.y if by_height else maxf(bb.size.x, bb.size.z), 0.01))
	n.position = at
	n.rotation.y = yaw
	add_child(n)
	_cull(n, 60.0)
	return n


func _cyl_col(at: Vector3, r: float, h: float) -> void:
	var cs := CollisionShape3D.new()
	var cy := CylinderShape3D.new()
	cy.radius = r
	cy.height = h
	cs.shape = cy
	cs.position = at + Vector3.UP * h * 0.5
	body.add_child(cs)


## водонапорная башня (модель Tripo) и ржавые баки
func _landmarks(g: Node3D, rng: RandomNumberGenerator) -> void:
	var tower := _model(MODELS + "ul_water_tower.glb", SILO, 0.3, 11.0, true)
	if tower:
		_dirty(tower, "ul_water_tower", Color(0.78, 0.74, 0.68))
		_cyl_col(SILO, 2.2, 4.0)
	for tk in TANKS:
		var at: Vector3 = tk[0]
		var r: float = tk[1]
		var h: float = tk[2]
		var tank := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = r
		cm.bottom_radius = r
		cm.height = h
		cm.radial_segments = 16
		tank.mesh = cm
		tank.material_override = _mats.rust
		tank.position = at + Vector3.UP * h * 0.5
		add_child(tank)
		var top := MeshInstance3D.new()
		var tc := CylinderMesh.new()
		tc.top_radius = 0.05
		tc.bottom_radius = r + 0.05
		tc.height = r * 0.5
		tc.radial_segments = 16
		top.mesh = tc
		top.material_override = _mats.roof
		top.position = at + Vector3.UP * (h + r * 0.25)
		add_child(top)
		_cyl_col(at, r, h)
		# лестница сбоку
		var ang := rng.randf() * TAU
		var side := Vector3(cos(ang), 0, sin(ang))
		for sx in [-0.22, 0.22]:
			_bx(g, "rust", Vector3(0.05, h, 0.05), _at(at + side * (r + 0.12) + side.cross(Vector3.UP) * sx + Vector3.UP * h * 0.5))
		for k in int(h / 0.35):
			_bx(g, "rust", Vector3(0.5, 0.04, 0.04), Transform3D(Basis(Vector3.UP, -ang + PI * 0.5), at + side * (r + 0.12) + Vector3.UP * (0.3 + k * 0.35)))


## Техника: тракторы, ржавый грузовик, прицепы и телеги — модели Tripo. Столкновение — коробка по размеру модели,
## повёрнутая вместе с ней.
func _vehicles(_rng: RandomNumberGenerator) -> void:
	for v in VEHICLES:
		var vm: Array = VEHICLE_MODELS[String(v[0])]
		var path := MODELS + String(vm[0]) + ".glb"
		if not ResourceLoader.exists(path):
			continue
		var at: Vector3 = v[1]
		var yaw: float = v[2]
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		ULSanatorium.mute(n)
		var bb: AABB = w._aabb(n)
		var k := float(vm[1]) / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		n.scale = Vector3.ONE * k
		n.position = at - Vector3(0, bb.position.y * k, 0)
		n.rotation.y = yaw
		add_child(n)
		_dirty(n, String(vm[0]), vm[2])
		_cull(n, 60.0)
		var size := bb.size * k
		var c := bb.get_center() * k
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(size.x * 0.92, maxf(size.y, 1.0), size.z * 0.92)
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at + Basis(Vector3.UP, yaw) * Vector3(c.x, maxf(size.y, 1.0) * 0.5, c.z))
		body.add_child(cs)


## круглые тюки сена: лёжа рядком
func _hay(rng: RandomNumberGenerator) -> void:
	var cm := CylinderMesh.new()
	cm.top_radius = 0.72
	cm.bottom_radius = 0.72
	cm.height = 1.15
	cm.radial_segments = 18
	for hh in HAY:
		var at: Vector3 = hh[0]
		var n: int = hh[1]
		var yaw := rng.randf() * TAU
		var dirv := Vector3(cos(yaw), 0, -sin(yaw))
		for i in n:
			var p := at + dirv * (i - (n - 1) * 0.5) * 1.3
			var bale := MeshInstance3D.new()
			bale.mesh = cm
			bale.material_override = _mats.hay
			bale.position = p + Vector3.UP * 0.7
			bale.rotation = Vector3(0, yaw + rng.randf_range(-0.15, 0.15), PI * 0.5)
			add_child(bale)
			_cull(bale, 60.0)
			_cyl_col(p, 0.7, 1.4)


## хлам: ящики, бочки, покрышки, ободья, ржавые листы, доски — кучками; вёдра и бочки у стен коровников
func _junk(g: Node3D, rng: RandomNumberGenerator) -> void:
	for j in JUNK:
		var c: Vector3 = j[0]
		var r: float = j[1]
		for i in 7:
			var p := c + Vector3(rng.randf_range(-r, r), 0, rng.randf_range(-r, r))
			if in_barn(p, 0.6) >= 0:
				continue
			match i:
				0, 1:
					if _model(MODELS + "ph_crate.glb", p, rng.randf() * TAU, 0.9) != null:
						_cyl_col(p, 0.42, 0.7)
				2:
					if _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
						_cyl_col(p, 0.32, 0.9)
				3:
					_model(MODELS + "ph_tyre.glb", p, rng.randf() * TAU, 0.9)
				4:
					_model(MODELS + "ph_rim.glb", p, rng.randf() * TAU, 0.6)
				5:
					_bx(g, "rust", Vector3(rng.randf_range(1.6, 2.4), 0.04, rng.randf_range(0.8, 1.0)), Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.1, 0.1), rng.randf() * PI, rng.randf_range(-0.15, 0.15))), p + Vector3.UP * 0.06))
				6:
					for k in 4:
						_bx(g, "planks", Vector3(rng.randf_range(1.8, 2.8), 0.06, 0.18), Transform3D(Basis(Vector3.UP, rng.randf_range(-0.5, 0.5)), p + Vector3(rng.randf_range(-0.3, 0.3), 0.04 + k * 0.06, rng.randf_range(-0.4, 0.4))))
	for b in BUILDINGS:
		var xf := Transform3D(Basis(Vector3.UP, float(b.yaw)), b.at)
		for k in 2:
			var lp := Vector3(rng.randf_range(-float(b.L) * 0.4, float(b.L) * 0.4), 0, (float(b.W) * 0.5 + 0.7) * (1.0 if k == 0 else -1.0))
			var p := xf * lp
			if _barn_dist(Vector2(p.x, p.z)).y < 3.0:
				continue
			if k == 0:
				_model(MODELS + "ph_bucket.glb", p, rng.randf() * TAU, 0.4, true)
			elif _model(MODELS + "ph_barrel.glb", p, rng.randf() * TAU, 0.9, true) != null:
				_cyl_col(p, 0.32, 0.9)


# ---------------- переменная часть: останки коров и враги ----------------

## Останки коров — заново при каждом посещении (~20): места с эталона (со сдвигом и поворотом) и случайные — в
## коровниках, у заборов и в поле. Столкновение — на слое мелких предметов (герой и машина не проходят насквозь).
func place_cows(rng: RandomNumberGenerator) -> void:
	var n := int(cfg().get("cows", 20))
	for p in SKELETONS + CARCASSES:
		var q: Vector3 = p + Vector3(rng.randf_range(-2.0, 2.0), 0, rng.randf_range(-2.0, 2.0))
		cows.append(q)
		_cow(q, rng.randf() * TAU, SKELETONS.has(p))
	var tries := 0
	while cows.size() < n and tries < 600:
		tries += 1
		var p: Vector3
		var r := rng.randf()
		if r < 0.35:
			p = barn_point(rng.randi() % barns.size(), rng)
		elif r < 0.6 and not fence_pts.is_empty():
			p = fence_pts[rng.randi() % fence_pts.size()] + Vector3(rng.randf_range(-2.0, 2.0), 0, rng.randf_range(-2.0, 2.0))
		else:
			p = Vector3(rng.randf_range(-half + 8, half - 8), 0, rng.randf_range(-half + 8, half - 8))
			if in_barn(p, 1.0) >= 0:
				continue
		if p.distance_to(ENTRY) < 12.0 or absf(p.x) > 70.0 or absf(p.z) > 70.0:
			continue
		var near := false
		for q in cows:
			if q.distance_to(p) < 3.5:
				near = true
				break
		for q in wood_pts:
			if q.distance_to(p) < 2.0:
				near = true
				break
		if near:
			continue
		cows.append(p)
		_cow(p, rng.randf() * TAU, rng.randf() < 0.5)


## Останки коровы: скелет (целый на боку или череп с костями) или тело погибшей коровы (модели Tripo)
func _cow(at: Vector3, yaw: float, skeleton: bool) -> void:
	var model := "ul_cow_dead"
	var length := 2.3
	var on_side := false
	if skeleton:
		if cows.size() % 2 == 0 and ResourceLoader.exists(MODELS + "ul_cow_bones.glb"):
			model = "ul_cow_bones"
			length = 1.4
		else:
			model = "ul_cow_skel"
			length = 2.1
			on_side = true
	var path := MODELS + model + ".glb"
	var node := Node3D.new()
	if ResourceLoader.exists(path):
		if not _cow_scenes.has(model):
			_cow_scenes[model] = load(path)
		var m: Node3D = (_cow_scenes[model] as PackedScene).instantiate()
		node.add_child(m)
		_dirty(m, model)
		var bb: AABB = w._aabb(m)
		m.scale = Vector3.ONE * (length / maxf(maxf(bb.size.x, bb.size.z), 0.01))
		if on_side:
			m.rotation.z = PI * 0.5
		var b2: AABB = w._aabb(node)
		m.position.y = -b2.position.y - (0.1 if on_side else 0.0)
	node.position = at
	node.rotation.y = yaw
	node.set_meta("cow", "skeleton" if skeleton else "body")
	add_child(node)
	_cull(node, 45.0)
	w.prop_col_node(node, 0.8, 1.2)        # через останки не пройти (заражённые их обходят — слой только героя)


## кости и туши пролежали под дождём и в грязи, техника выгорела и заржавела, листва под пасмурным небом — цвет
## модели темнее и глуше (общий материал на вид модели; col — множитель, по умолчанию для костей и туш)
func _dirty(m: Node3D, key: String, col := Color(0, 0, 0, 0)) -> void:
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var g := mi as MeshInstance3D
		for s in g.mesh.get_surface_count():
			var src := g.get_active_material(s) as StandardMaterial3D
			if src == null:
				continue
			var k := key + str(s)
			if not _cow_scenes.has(k):
				var d := src.duplicate() as StandardMaterial3D
				if col.a > 0.0:
					d.albedo_color = col
				else:
					d.albedo_color = Color(0.68, 0.64, 0.58) if key != "ul_cow_dead" else Color(0.85, 0.82, 0.78)
				_cow_scenes[k] = d
			g.set_surface_override_material(s, _cow_scenes[k])


## План врагов на это посещение: сколько (пустышей 10–30, лоторейщиков 3–8 — data/cowshed.json) и где —
## в постройках, во дворах между ними (DANGER), у останков коров, в рощах и у заборов. Каждая точка проверяется
## по карте проходимости (snap — «ближайшая проходимая точка»: не в стене, не в дереве, не за краем), не ближе
## safe_r к входу и не вплотную к другому врагу. Возвращает [[вид, точка], …].
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var c := cfg()
	var np := int(counts.pustysh) if counts.has("pustysh") else rng.randi_range(int(c.pustysh[0]), int(c.pustysh[1]))
	var nl := int(counts.lottery) if counts.has("lottery") else rng.randi_range(int(c.lottery[0]), int(c.lottery[1]))
	var kinds: Array = []
	for i in np:
		kinds.append("infected")
	for i in nl:
		kinds.append("lottery")
	var out: Array = []
	var taken: Array[Vector3] = []
	var safe_r := float(c.get("safe_r", 28.0))
	for k in kinds:
		var placed := false
		for attempt in 40:
			var r := rng.randf()
			var p: Vector3
			if r < 0.3:
				p = barn_point(rng.randi() % barns.size(), rng)
			elif r < 0.55:
				var dz: Array = DANGER[rng.randi() % DANGER.size()]
				var a := rng.randf() * TAU
				var rad := sqrt(rng.randf())
				p = (dz[0] as Vector3) + Vector3(cos(a) * (dz[1] as Vector2).x, 0, sin(a) * (dz[1] as Vector2).y) * rad
			elif r < 0.8 and not cows.is_empty():
				var cp: Vector3 = cows[rng.randi() % cows.size()]
				var a2 := rng.randf() * TAU
				p = cp + Vector3(cos(a2), 0, sin(a2)) * rng.randf_range(1.5, 4.0)
			else:
				var anchor: Vector3 = wood_pts[rng.randi() % wood_pts.size()] if (rng.randf() < 0.5 or fence_mid.is_empty()) else fence_mid[rng.randi() % fence_mid.size()]
				var a3 := rng.randf() * TAU
				p = anchor + Vector3(cos(a3), 0, sin(a3)) * rng.randf_range(1.0, 3.5)
			if absf(p.x) > 70.0 or absf(p.z) > 70.0 or p.distance_to(ENTRY) < safe_r:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.45:
				continue
			var crowd := false
			for t in taken:
				if t.distance_to(q) < 1.3:
					crowd = true
					break
			if crowd:
				continue
			taken.append(q)
			out.append([k, Vector3(q.x, 0, q.z)])
			placed = true
			break
		if not placed:
			push_warning("коровник: для врага не нашлось места")
	_plan_rubers(rng, snap, taken, out, int(counts.get("ruber", 0)))
	return out


## Руберы (если лоторейщики убили людей — ULReload): во дворах между постройками (DANGER) и в поле, не в
## постройке, далеко от входа (ruber_safe_r) и друг от друга; вокруг точки свободно на метр (восемь проб на карте
## проходимости) — большому телу хватает места, камень есть где вырвать
func _plan_rubers(rng: RandomNumberGenerator, snap: Callable, taken: Array[Vector3], out: Array, n: int) -> void:
	var safe_r := float(cfg().get("ruber_safe_r", 45.0))
	var mine: Array[Vector3] = []
	for i in n:
		var placed := false
		for attempt in 160:
			var p: Vector3
			if rng.randf() < 0.6:
				var dz: Array = DANGER[rng.randi() % DANGER.size()]
				var a := rng.randf() * TAU
				p = (dz[0] as Vector3) + Vector3(cos(a) * (dz[1] as Vector2).x, 0, sin(a) * (dz[1] as Vector2).y) * sqrt(rng.randf())
			else:
				p = Vector3(rng.randf_range(-62.0, 62.0), 0, rng.randf_range(-62.0, 40.0))
			if p.distance_to(ENTRY) < safe_r or in_barn(p, 2.0) >= 0:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.3:
				continue
			var open := true
			for k in 8:
				var o := q + Vector3(cos(k * TAU / 8.0), 0, sin(k * TAU / 8.0)) * 1.0
				var oq: Vector3 = snap.call(o)
				if Vector2(oq.x - o.x, oq.z - o.z).length() > 0.25:
					open = false
					break
			if not open:
				continue
			var near := false
			for t in taken:
				if t.distance_to(q) < 2.5:
					near = true
					break
			for t in mine:
				if t.distance_to(q) < 25.0:
					near = true
					break
			if near:
				continue
			mine.append(q)
			taken.append(q)
			out.append(["ruber", Vector3(q.x, 0, q.z)])
			placed = true
			break
		if not placed:
			push_warning("коровник: для Рубера не нашлось места")
