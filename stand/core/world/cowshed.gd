class_name ULCowshed
extends Node3D
## «Опасный коровник» — временный нестабильный кластер 150×150 м, расставлен по карте пользователя
## (tools/ui_src/cowshed_plan.png). Постоянная часть (одна и та же при каждом посещении): три коровника, сарай (1),
## хозпостройка (2), загон с сарайчиком (3) — во все можно зайти (двери, ворота, окна; герой внутри — крыша над
## ним и стена со стороны камеры скрыты), забор по кругу с проломами, дороги и тропы, хлам, поилки, телеги,
## перелески. Переменная часть (заново при каждом входе): останки коров и враги — сколько и где.
## Баланс — data/cowshed.json; карта земли и проходимости строятся --as-test=csbake.

const CFG := "res://data/cowshed.json"
const NAV := "res://assets/world/nav_cowshed.res"
const TEX := "res://assets/world/tex/"
const MODELS := "res://assets/world/"
## Постройки. at — центр, yaw — поворот, L — длина (вдоль своей оси X), W — ширина, H — высота стен.
## doors — проёмы [стена, смещение вдоль неё, ширина]: «s+»/«s-» — длинные стены (+z/−z постройки), «e+»/«e-» — торцы.
## win — окон на длинную стену; fill — что внутри: barn (стойла, кормушки, сено), tools, fuel, feed.
const BUILDINGS := [
	{"id": "barn1", "n": "Коровник 1", "at": Vector3(-15, 0, 23.5), "yaw": 0.0, "L": 48.0, "W": 20.0, "H": 3.4,
		"doors": [["s+", 0.0, 4.2], ["s-", 8.0, 3.2], ["e-", 0.0, 3.8], ["e+", 0.0, 3.8]], "win": 6, "fill": "barn", "ruin": 0.35},
	{"id": "barn2", "n": "Коровник 2", "at": Vector3(-26.5, 0, -31.5), "yaw": 0.0, "L": 30.0, "W": 16.0, "H": 3.2,
		"doors": [["s+", -6.5, 3.4], ["s+", 6.5, 3.4], ["e-", 0.0, 3.4], ["e+", 0.0, 3.4]], "win": 4, "fill": "barn", "ruin": 0.25},
	{"id": "barn3", "n": "Коровник 3", "at": Vector3(49.5, 0, -21.0), "yaw": PI * 0.5, "L": 44.0, "W": 18.0, "H": 3.3,
		"doors": [["e-", 0.0, 3.8], ["e+", 0.0, 3.8], ["s-", 4.0, 3.2]], "win": 5, "fill": "barn", "ruin": 0.5},
	{"id": "shed1", "n": "Сарай", "at": Vector3(23.5, 0, 42.0), "yaw": 0.0, "L": 11.0, "W": 8.5, "H": 3.0,
		"doors": [["s-", 0.0, 2.6], ["e+", 0.0, 2.2]], "win": 1, "fill": "tools", "ruin": 0.15},
	{"id": "shed2", "n": "Хозпостройка", "at": Vector3(26.5, 0, -49.5), "yaw": 0.0, "L": 9.0, "W": 7.5, "H": 3.0,
		"doors": [["s+", 0.0, 2.4]], "win": 1, "fill": "fuel", "ruin": 0.1},
	{"id": "shed3", "n": "Сарайчик в загоне", "at": Vector3(-52.5, 0, -4.0), "yaw": PI * 0.5, "L": 8.0, "W": 5.5, "H": 2.8,
		"doors": [["s+", 0.0, 2.2]], "win": 0, "fill": "feed", "ruin": 0.2},
]
## Забор по кругу (ломаные; между ними — проломы: у входа, сверху, справа и снизу) и загон у сарайчика (3)
const FENCES := [
	[Vector2(-54.0, 51.2), Vector2(-57.6, 38.9), Vector2(-63.6, 24.5), Vector2(-65.4, 10.1), Vector2(-65.4, -11.5), Vector2(-64.9, -28.8),
		Vector2(-61.9, -40.4), Vector2(-56.7, -47.6), Vector2(-46.8, -50.5), Vector2(-28.5, -54.8), Vector2(-19.3, -53.4), Vector2(-10.2, -49.8)],
	[Vector2(-4.9, -49.0), Vector2(5.6, -49.8), Vector2(7.1, -53.7), Vector2(13.4, -62.0), Vector2(26.5, -62.7), Vector2(38.6, -61.3),
		Vector2(40.9, -51.2), Vector2(44.9, -51.2), Vector2(58.0, -51.9), Vector2(62.6, -46.2), Vector2(64.8, -40.4), Vector2(66.5, -28.8),
		Vector2(67.1, -7.2), Vector2(66.5, 4.3), Vector2(65.2, 11.8)],
	[Vector2(64.8, 16.6), Vector2(63.2, 33.2), Vector2(61.2, 41.8), Vector2(50.1, 47.6), Vector2(43.6, 53.4), Vector2(26.5, 55.5),
		Vector2(10.8, 55.5), Vector2(4.9, 54.8)],
	[Vector2(-1.6, 54.1), Vector2(-25.9, 52.4), Vector2(-41.6, 56.2), Vector2(-50.5, 59.9)],
	# загон (3): ворота на восток
	[Vector2(-40.0, -1.0), Vector2(-40.0, 4.0), Vector2(-57.0, 4.0), Vector2(-57.0, -12.0), Vector2(-40.0, -12.0), Vector2(-40.0, -7.0)],
]
const PEN := [Vector2(-57.0, -12.0), Vector2(-40.0, -12.0), Vector2(-40.0, 4.0), Vector2(-57.0, 4.0)]
## дороги (накатанные колёсами, ~3,5 м) и тропы (~1,3 м)
const ROADS := [
	[Vector2(-73.0, 73.6), Vector2(-62.6, 65.6), Vector2(-52.7, 55.5), Vector2(-48.8, 44.7), Vector2(-48.1, 33.2), Vector2(-47.5, 21.6),
		Vector2(-44.9, 13.0), Vector2(-37.7, 6.5), Vector2(-25.9, 2.2), Vector2(-12.8, -2.2), Vector2(-1.0, -7.2)],
	[Vector2(-12.8, -2.2), Vector2(-19.3, -11.5), Vector2(-24.6, -19.5), Vector2(-26.0, -23.0)],
	[Vector2(-1.0, -7.2), Vector2(5.6, -15.9), Vector2(13.4, -26.0), Vector2(22.6, -36.1), Vector2(26.0, -45.0)],
	[Vector2(-1.0, -7.2), Vector2(13.4, -9.4), Vector2(27.8, -7.2), Vector2(37.0, -1.4), Vector2(44.2, 3.6), Vector2(49.5, 1.5)],
	[Vector2(-15.0, 33.5), Vector2(-19.3, 44.7), Vector2(-28.5, 49.8), Vector2(-41.6, 50.5), Vector2(-48.8, 49.0)],
	[Vector2(-1.0, -7.2), Vector2(8.2, 7.2), Vector2(16.0, 21.6), Vector2(22.6, 36.1), Vector2(23.5, 37.5)],
]
const TRAILS := [
	[Vector2(-40.0, -4.0), Vector2(-25.9, 1.4)],
	[Vector2(48.1, 4.3), Vector2(42.2, 17.3), Vector2(34.4, 33.2), Vector2(29.8, 38.9)],
]
## зоны активности врагов (по карте, ориентировочно): центр, полуоси
const DANGER := [[Vector3(6.2, 0, -32.5), Vector2(11.0, 5.5)], [Vector3(36.4, 0, 7.2), Vector2(7.0, 8.0)], [Vector3(-36.4, 0, 46.2), Vector2(8.5, 5.0)]]
## места останков коров по карте: скелеты и туши (каждое посещение — со сдвигом и поворотом; остальное — случайно)
const SKELETONS := [Vector3(-32.4, 0, -46.9), Vector3(-57.3, 0, -31.7), Vector3(13.4, 0, -49.8), Vector3(27.8, 0, -20.2), Vector3(-30.5, 0, 7.2),
	Vector3(-59.3, 0, 21.6), Vector3(2.9, 0, 43.3), Vector3(43.6, 0, 35.3)]
const CARCASSES := [Vector3(-1.0, 0, -41.1), Vector3(12.8, 0, -2.2), Vector3(-56.0, 0, 10.8), Vector3(-8.2, 0, 47.6), Vector3(48.8, 0, 24.5)]
## перелески: центр, радиус, сколько деревьев (по карте — по краям, за забором и у него)
const WOODS := [
	[Vector3(58, 0, -66), 14.0, 13], [Vector3(-49.5, 0, -67), 11.0, 10], [Vector3(-66, 0, -50), 8.0, 6], [Vector3(-51, 0, -41), 4.0, 3],
	[Vector3(-7.5, 0, -68), 8.0, 7], [Vector3(4.3, 0, -58), 3.5, 2], [Vector3(-71, 0, -19), 4.0, 3], [Vector3(-71, 0, 4), 4.0, 3],
	[Vector3(-69, 0, 33), 6.0, 5], [Vector3(-51, 0, 68), 12.0, 11], [Vector3(-66.5, 0, 48), 6.0, 4], [Vector3(60.5, 0, 67), 12.0, 12],
	[Vector3(54, 0, 35), 3.5, 3], [Vector3(72, 0, -33), 3.5, 3], [Vector3(72, 0, 4), 3.5, 3], [Vector3(-5, 0, 65), 5.0, 4],
]
const ENTRY := Vector3(-54, 0, 57)
const ENTRY_YAW := 2.5             ## у входа герой смотрит на северо-восток — на коровники
## одинокие сухие деревья — у забора и построек
const DEAD_TREES := [Vector3(-14, 0, -46), Vector3(36, 0, -46), Vector3(56, 0, 20), Vector3(-60, 0, 30), Vector3(14, 0, 50), Vector3(-26, 0, -18)]

static var _cfg := {}
var w                              ## локация (world.gd)
var half := 75.0
var body: StaticBody3D
var barns: Array = []              ## постройки: {node, roof, front (стены со стороны камеры), half, xf, id, n}
var cows: Array[Vector3] = []
var fence_mid: Array[Vector3] = []
var wood_pts: Array[Vector3] = []
var _noise_tex: ImageTexture
var mask: Image                    ## карта земли (R — трава): по ней же — где пучки травы
var puddle_pts: Array[Vector3] = []
var _cow_scenes := {}
var trees: Array[Node3D] = []      ## деревья-модели
var _spruce_mm: MultiMesh
var _spruce_xf: Array[Transform3D] = []
var _tick_t := 0.0
var _fence_root: Node3D
var _hay: StandardMaterial3D
var _debris_root: Node3D
var _mats := {}


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


func build(world: Node3D) -> void:
	w = world
	half = float(cfg().get("size", 150.0)) * 0.5
	body = StaticBody3D.new()
	body.name = "CowshedBody"
	add_child(body)
	var rng := RandomNumberGenerator.new()
	rng.seed = 4417                  # постоянная часть — одна и та же
	for b in BUILDINGS:
		_building(b, rng)
	_fence_root = Node3D.new()
	add_child(_fence_root)
	_fences(rng)
	_merge(_fence_root)
	_forest(rng)
	_dead_trees()
	_ground()                          # после леса: под деревьями — лесная подстилка
	_debris_root = Node3D.new()
	add_child(_debris_root)
	_yard_props(rng)
	_debris(rng)
	_merge(_debris_root)


# ---------------- земля ----------------

const MASK := "res://assets/world/tex/cowshed_mask.png"
var _noise_img: Image


## Земля — тот же шейдер, что на базе (трава, голая земля, утоптанные тропы; карта mask: R — трава, G — тропа,
## B — светлота, A — затенение у стен). Карта коровника считается один раз (--as-test=csbake) и лежит в проекте.
func _ground() -> void:
	var fn := FastNoiseLite.new()
	fn.seed = 77
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_img.generate_mipmaps()
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	var mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(half * 2.0, half * 2.0)
	mi.mesh = pm
	# голая земля здесь — грязь со следами (сырая, местами блестит), сухих проплешин в траве больше
	# дороги — светлая накатанная земля, у построек — грязь со следами (сырая, местами блестит)
	var sm: ShaderMaterial = w.ground_material(half * 2.0, "brown_mud_02", "brown_mud_02", Vector3(0.95, 0.9, 0.84), 1.0, 0.7, "grass_path_2", "dry_ground_01")
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(MASK) and w.test != "csbake":
		mask = (load(MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()               # по карте ставятся пучки травы — нужны точки, а не сжатый блок
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _bake_mask()
		if w.test == "csbake":
			mask.save_png(ProjectSettings.globalize_path(MASK))
			print("[bake] карта земли коровника: ", MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	add_child(mi)
	var out := MeshInstance3D.new()
	var om := PlaneMesh.new()
	om.size = Vector2(420, 420)
	out.mesh = om
	var omat := _mat("dry_ground_01", 4.0)
	omat.albedo_color = Color(0.45, 0.42, 0.37)
	out.material_override = omat
	out.position.y = -0.05
	add_child(out)
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
	_tufts()
	# цветы в траве и лужи в грязи у коровников, ворот и в загоне
	ULGroundDetail.flowers(self, mask_px, half * 2.0, 31, int(150.0 * float(ULSettings.q().grass)) + 30, w.TUFT_SHADER, func(p: Vector3) -> bool:
		return in_barn(p, 2.0) >= 0 or p.distance_to(ENTRY) < 6.0, float(ULSettings.q().range))
	var pen := PackedVector2Array(PEN)
	puddle_pts = ULGroundDetail.puddles(self, mask_px, half * 2.0, 53, 500, _noise_tex, func(p: Vector3) -> bool:
		var q := Vector2(p.x, p.z)
		return in_barn(p, 0.8) < 0 and (_barn_dist(q).x < 9.0 or Geometry2D.is_point_in_polygon(q, pen) or _road_dist(q) < 2.5))


func _mat(tex: String, uv: float) -> StandardMaterial3D:
	return ULHouse._mat(TEX + tex, uv)


## трава пучками — как на базе (тот же шейдер), реже в загонах и у коровников
func _tufts() -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 5:
		var a := TAU * i / 5.0 + 0.3
		var o := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-o.z, 0, o.x) * 0.15
		var top := o * 0.2 + Vector3.UP * 0.34
		var v := [-side, side, side * 1.25 + top, -side * 1.25 + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = w.TUFT_SHADER
	mat.shader = sh
	mat.set_shader_parameter("tex", load(TEX + "grass_tuft.png"))
	mesh.surface_set_material(0, mat)
	var rng := RandomNumberGenerator.new()
	rng.seed = 515
	var n := 10
	var cell := half * 2.0 / n
	for cx in n:
		for cz in n:
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.mesh = mesh
			var xs: Array[Transform3D] = []
			var cs: Array[Color] = []
			for k in int(300.0 * float(ULSettings.q().grass)):
				var p := Vector3(-half + (cx + rng.randf()) * cell, 0, -half + (cz + rng.randf()) * cell)
				if in_barn(p, 1.0) >= 0 or rng.randf() > grass_at(p) * 1.3:
					continue
				var sc := rng.randf_range(0.55, 1.2)
				xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.8, 1.4), sc)), p))
				var g := rng.randf_range(0.85, 1.15)
				cs.append(Color(g * 1.35, g * 1.15, g * 0.75) if rng.randf() < 0.5 else Color(g, g, g * 0.95))
			mm.instance_count = xs.size()
			for k in xs.size():
				mm.set_instance_transform(k, xs[k])
				mm.set_instance_color(k, cs[k])
			var mi := MultiMeshInstance3D.new()
			mi.multimesh = mm
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.visibility_range_end = float(ULSettings.q().range)
			mi.visibility_range_end_margin = 4.0
			mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			add_child(mi)


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
	for b in BUILDINGS:
		var xf := Transform3D(Basis(Vector3.UP, float(b.yaw)), b.at)
		var l := xf.affine_inverse() * Vector3(q.x, 0, q.y)
		var hh := Vector2(float(b.L) * 0.5, float(b.W) * 0.5)
		var o := Vector2(maxf(absf(l.x) - hh.x, 0.0), maxf(absf(l.z) - hh.y, 0.0))
		d = minf(d, o.length())
		for dr in b.doors:
			g = minf(g, Vector2(l.x, l.z).distance_to(_door_point(b, dr)))
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


## расстояние до ближайшей дороги
func _road_dist(q: Vector2) -> float:
	var d := 1e9
	for r in ROADS:
		for i in r.size() - 1:
			d = minf(d, _seg_dist(q, r[i], r[i + 1]))
	return d


func _bake_mask() -> Image:
	var n := 384
	var tpts: Array = []
	for t in trees:
		tpts.append([t.position, 1.5])
	for xf in _spruce_xf:
		tpts.append([xf.origin, 1.5 * xf.basis.get_scale().x])
	var im := Image.create(n, n, false, Image.FORMAT_RGBA8)
	var pen: PackedVector2Array = PackedVector2Array(PEN)
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
			# дорога: две колеи по краям, между ними — трава пробивается; тропа — узкая
			var road := 1.0 - smoothstep(1.4, 2.4, rd + (n3 - 0.5) * 0.9)
			var rut := 1.0 - smoothstep(0.2, 0.7, absf(rd - 1.0))
			var path := maxf(road * (0.55 + 0.45 * rut), 1.0 - smoothstep(0.5, 1.1, tr + (n3 - 0.5) * 0.6))
			# у коровников и ворот вытоптано до грязи, в загоне — тоже
			var yard := 1.0 - smoothstep(1.0, 7.0 + n2 * 4.0, bd.x)
			var gate := 1.0 - smoothstep(2.0, 9.0, bd.y)
			var in_pen := 0.7 if Geometry2D.is_point_in_polygon(p, pen) else 0.0
			var bare := maxf(maxf(yard * 0.85, gate), in_pen * smoothstep(0.3, 0.7, n2))
			var gw := smoothstep(0.32, 0.55, n1 * 0.4 + n2 * 0.35 + n3 * 0.25) * 0.85 + 0.12
			gw *= (1.0 - bare) * (1.0 - path)
			var peb := maxf(path * 0.9, smoothstep(0.64, 0.76, n2 * 0.5 + n3 * 0.5) * 0.3) * (1.0 - bare * 0.6)
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.9
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.2, bd.x)) * 0.4 * (1.0 if bd.x > 0.001 else 0.0)
			im.set_pixel(ix, iy, Color(gw, peb, fw, ao))
	return im


## точка карты земли: R — трава, G — тропа, B — подстилка
func mask_px(p: Vector3) -> Color:
	if mask == null:
		return Color(1, 0, 0, 1)
	var x := clampi(int((p.x / (half * 2.0) + 0.5) * mask.get_width()), 0, mask.get_width() - 1)
	var y := clampi(int((p.z / (half * 2.0) + 0.5) * mask.get_height()), 0, mask.get_height() - 1)
	return mask.get_pixel(x, y)


## доля травы в точке (из карты земли)
func grass_at(p: Vector3) -> float:
	if mask == null:
		return 1.0
	var x := clampi(int((p.x / (half * 2.0) + 0.5) * mask.get_width()), 0, mask.get_width() - 1)
	var y := clampi(int((p.z / (half * 2.0) + 0.5) * mask.get_height()), 0, mask.get_height() - 1)
	return mask.get_pixel(x, y).r


# ---------------- коровники ----------------

func _box(parent: Node3D, size: Vector3, at: Vector3, mat: Material, col: bool, rot := Vector3.ZERO) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	mi.rotation = rot
	parent.add_child(mi)
	if col:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.transform = parent.transform * Transform3D(Basis.from_euler(rot), at) if parent != self else Transform3D(Basis.from_euler(rot), at)
		body.add_child(cs)
	return mi


## Коровник: длинный дощатый сарай, ворота в обоих торцах, проход посередине, стойла по бокам за низкими
## перегородками, двускатная крыша из ржавого железа (пролёты выпали). ruin — сколько разрушено: дыры в стенах,
## нет панелей крыши, при ruin > 0.5 — нет дальнего торца.
func _barn(at: Vector3, yaw: float, L: float, W: float, ruin: float, rng: RandomNumberGenerator) -> void:
	var node := Node3D.new()
	node.name = "Barn"
	add_child(node)
	node.position = at
	node.rotation.y = yaw
	var planks := _mat("weathered_plank_siding", 2.2)
	var dark := _mat("brown_planks_03", 1.6)
	dark.albedo_color = Color(0.62, 0.55, 0.47)
	var iron := _mat("worn_corrugated_iron", 2.5)
	var H := 3.0
	var T := 0.18
	var walls := Node3D.new()
	node.add_child(walls)
	var front: Array[Node3D] = []
	# длинные стены: по куску с дырой (пролом)
	for side in [-1.0, 1.0]:
		var z: float = side * W * 0.5
		var gap_c := rng.randf_range(-L * 0.3, L * 0.3)
		var gap_w := 1.8 + ruin * 2.5
		var pieces := [[-L * 0.5, gap_c - gap_w * 0.5], [gap_c + gap_w * 0.5, L * 0.5]]
		var holder := Node3D.new()
		walls.add_child(holder)
		for pc in pieces:
			var a: float = pc[0]
			var b: float = pc[1]
			if b - a < 0.3:
				continue
			_box(holder, Vector3(b - a, H, T), Vector3((a + b) * 0.5, H * 0.5, z), planks, false)
			_col(node, Vector3(b - a, H, T), Vector3((a + b) * 0.5, H * 0.5, z))
		# над проломом — обломок доски
		_box(holder, Vector3(gap_w + 0.4, 0.5, T), Vector3(gap_c, H - 0.25, z), planks, false)
		front.append(holder)
	# торцы: ворота посередине (3.6 м), над воротами — доски; у сильно разрушенного дальнего торца нет
	for end in [-1.0, 1.0]:
		if ruin > 0.5 and end > 0.0:
			for k in 3:
				_box(walls, Vector3(0.2, 0.2, rng.randf_range(1.5, 3.0)), Vector3(end * L * 0.5 + rng.randf_range(-1.0, 1.5), 0.1, rng.randf_range(-3, 3)), planks, false, Vector3(0, rng.randf() * PI, 0))
			continue
		var x: float = end * L * 0.5
		for sz in [-1.0, 1.0]:
			var len := W * 0.5 - 1.8
			_box(walls, Vector3(T, H, len), Vector3(x, H * 0.5, sz * (1.8 + len * 0.5)), planks, false)
			_col(node, Vector3(T, H, len), Vector3(x, H * 0.5, sz * (1.8 + len * 0.5)))
		_box(walls, Vector3(T, H - 2.7, 3.6), Vector3(x, 2.7 + (H - 2.7) * 0.5, 0), planks, false)
		# створка ворот, распахнутая наружу
		_box(walls, Vector3(0.08, 2.5, 1.7), Vector3(x + end * 0.85, 1.25, 1.8 + 0.1), dark, false, Vector3(0, end * 1.2, 0))
	# стойла: низкие перегородки от стен к проходу (проход посередине — 3 м)
	var aisle := 1.5
	var depth := W * 0.5 - aisle - T
	var k := -L * 0.5 + 3.0
	while k < L * 0.5 - 1.0:
		for side in [-1.0, 1.0]:
			if rng.randf() < ruin * 0.4:
				continue                                   # перегородка выломана
			var zc: float = side * (aisle + depth * 0.5)
			_box(walls, Vector3(0.1, 1.25, depth), Vector3(k, 0.625, zc), dark, false)
			_col(node, Vector3(0.1, 1.25, depth), Vector3(k, 0.625, zc))
		k += 3.0
	# кормушки вдоль стен
	for side in [-1.0, 1.0]:
		_box(walls, Vector3(L - 1.0, 0.45, 0.45), Vector3(0, 0.22, side * (W * 0.5 - 0.4)), dark, false)
	# крыша: по шесть листов на скат, часть выпала
	var roof := Node3D.new()
	node.add_child(roof)
	var ridge := 5.0
	var slope := atan2(ridge - H, W * 0.5 + 0.4)
	var span := Vector2(W * 0.5 + 0.4, ridge - H).length()
	var n := 6
	for side in [-1.0, 1.0]:
		for i in n:
			if rng.randf() < 0.15 + ruin * 0.45:
				continue
			var cx := -L * 0.5 - 0.3 + (L + 0.6) * (i + 0.5) / n
			var mid := Vector3(cx, (H + ridge) * 0.5, side * (W * 0.5 + 0.4) * 0.5)
			_box(roof, Vector3((L + 0.6) / n + 0.02, 0.05, span), mid, iron, false, Vector3(-side * slope, 0, 0))
	# сено: несколько тюков в проходе и у ворот
	if _hay == null:
		_hay = _mat("leafy_grass", 0.8)
		_hay.albedo_color = Color(1.25, 1.0, 0.45)      # солома: трава, выжженная до жёлтого
		_hay.roughness = 1.0
	var hay := _hay
	for i in 3:
		var hp := Vector3(rng.randf_range(-L * 0.4, L * 0.4), 0.4, rng.randf_range(-0.8, 0.8))
		_box(walls, Vector3(1.2, 0.8, 0.8), hp, hay, false, Vector3(0, rng.randf() * 0.6, 0))
	for g in [walls, roof] + front:
		_merge(g)
	barns.append({"node": node, "roof": roof, "front": front, "half": Vector2(L * 0.5, W * 0.5), "xf": node.transform})


func _col(node: Node3D, size: Vector3, at: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.transform = node.transform * Transform3D(Basis.IDENTITY, at)
	body.add_child(cs)


## сарай-развалина: три стены без крыши
func _shed(at: Vector3, yaw: float) -> void:
	var node := Node3D.new()
	add_child(node)
	node.position = at
	node.rotation.y = yaw
	var planks := _mat("old_planks_02", 1.8)
	for wl in [[Vector3(6, 2.4, 0.16), Vector3(0, 1.2, -2.5)], [Vector3(0.16, 2.4, 5), Vector3(-3, 1.2, 0)], [Vector3(0.16, 1.4, 5), Vector3(3, 0.7, 0)]]:
		_box(node, wl[0], wl[1], planks, false)
		_col(node, wl[0], wl[1])


func near_landmark(p: Vector3, m: float) -> bool:
	for r in landmark_rects:
		var l := Transform3D(Basis(Vector3.UP, float(r[1])), r[0]).affine_inverse() * p
		var hh: Vector2 = r[2]
		if absf(l.x) < hh.x + m and absf(l.z) < hh.y + m:
			return true
	return false


## в каком коровнике точка (по внутреннему прямоугольнику с запасом m); -1 — снаружи
func in_barn(p: Vector3, m := 0.0) -> int:
	for i in barns.size():
		var b: Dictionary = barns[i]
		var l: Vector3 = (b.xf as Transform3D).affine_inverse() * p
		var hh: Vector2 = b.half
		if absf(l.x) < hh.x + m and absf(l.z) < hh.y + m:
			return i
	return -1


## случайная точка внутри коровника (в проходе или стойле), в системе мира
func barn_point(i: int, rng: RandomNumberGenerator) -> Vector3:
	var b: Dictionary = barns[i]
	var hh: Vector2 = b.half
	var l := Vector3(rng.randf_range(-hh.x + 1.0, hh.x - 1.0), 0, rng.randf_range(-hh.y + 0.8, hh.y - 0.8))
	return (b.xf as Transform3D) * l


## кадр: герой внутри коровника — крыша над ним скрыта, ближняя к камере стена прозрачна (видно, что внутри)
## Кадр (раз в 0,15 с): герой в коровнике — крыша над ним скрыта, длинные стены тоже (сверху видно, что внутри).
## Деревья, закрывающие героя, растворяет ULCanopy (общий для базы и коровника).
func tick(hero: Vector3, cam_pos: Vector3, delta: float) -> void:
	_tick_t -= delta
	if _tick_t > 0.0:
		return
	_tick_t = 0.15
	var inside := in_barn(hero, 0.3)
	for i in barns.size():
		var b: Dictionary = barns[i]
		(b.roof as Node3D).visible = i != inside
		var long_x := absf((b.xf as Transform3D).basis.x.z) < 0.7      # длинные стены смотрят на камеру
		for f in b.front:
			(f as Node3D).visible = i != inside or not long_x


# ---------------- заборы, лес, мусор, техника ----------------

## загоны: столбы и две жерди; часть пролётов выломана, часть жердей висит наискось
func _fences(rng: RandomNumberGenerator) -> void:
	var wood := _mat("old_planks_02", 1.2)
	wood.albedo_color = Color(0.7, 0.62, 0.52)
	for line in FENCES:
		for i in range(line.size() - 1):
			var a: Vector2 = line[i]
			var b: Vector2 = line[i + 1]
			var L := a.distance_to(b)
			var dir := (b - a) / L
			var yaw := atan2(dir.x, dir.y) + PI * 0.5
			var nseg := int(ceil(L / 3.0))
			for s in nseg:
				var p0 := a + dir * (L * s / nseg)
				var p1 := a + dir * (L * (s + 1) / nseg)
				var mid := (p0 + p1) * 0.5
				var seg := p0.distance_to(p1)
				_box(_fence_root, Vector3(0.14, 1.3, 0.14), Vector3(p0.x, 0.65, p0.y), wood, false)
				var r := rng.randf()
				if r < 0.25:
					continue                                       # пролёта нет
				var m3 := Vector3(mid.x, 0, mid.y)
				fence_mid.append(m3)
				if r < 0.4:
					# жердь висит наискось, проходить можно
					_box(_fence_root, Vector3(seg, 0.08, 0.06), m3 + Vector3(0, 0.55, 0), wood, false, Vector3(0, yaw, 0.35))
					continue
				for hy in [0.5, 1.0]:
					_box(_fence_root, Vector3(seg, 0.08, 0.06), m3 + Vector3(0, hy, 0), wood, false, Vector3(0, yaw, 0))
				# столкновение — по высоте жердей (1 м): пройти нельзя, стрелять поверх — можно
				var cs := CollisionShape3D.new()
				var bs := BoxShape3D.new()
				bs.size = Vector3(seg, 1.05, 0.2)
				cs.shape = bs
				cs.transform = Transform3D(Basis(Vector3.UP, yaw), m3 + Vector3(0, 0.52, 0))
				body.add_child(cs)


## перелески: ели (те же, что на базе), сосны и берёзы
func _forest(rng: RandomNumberGenerator) -> void:
	var kinds := []                    # [модель, доля, высота от, до]
	for k in [["ul_pine", 0.15, 3.8, 4.8], ["ul_birch", 0.15, 4.0, 5.0], ["ul_oak", 0.2, 3.8, 5.0], ["ul_dead_tree", 0.1, 3.4, 4.6]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3]])
	var spruce_xf := _spruce_xf
	for wd in WOODS:
		var c: Vector3 = wd[0]
		var rr: float = wd[1]
		var n: int = wd[2]
		var tries := 0
		while n > 0 and tries < 400:
			tries += 1
			var p := c + Vector3(rng.randf_range(-rr, rr), 0, rng.randf_range(-rr, rr))
			if p.distance_to(c) > rr or absf(p.x) > half - 2.0 or absf(p.z) > half - 2.0:
				continue
			var near := false
			for q in wood_pts:
				if q.distance_to(p) < 3.0:
					near = true
					break
			if near:
				continue
			wood_pts.append(p)
			n -= 1
			# ели (одна сетка на все) — 40 %, остальное — модели: сосна, берёза, дуб, сухое дерево
			var pick := rng.randf()
			var chosen = null
			var acc := 0.4
			for k in kinds:
				acc += float(k[1])
				if pick < acc and pick >= 0.4:
					chosen = k
					break
			if chosen == null:
				spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.85, 1.15)), p))
			else:
				_tree(chosen[0], p, rng.randf_range(float(chosen[2]), float(chosen[3])), rng.randf() * TAU)
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.22
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
	var mm := MultiMesh.new()
	_spruce_mm = mm
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = w._spruce_mesh(4.6, 141)
	mm.instance_count = spruce_xf.size()
	for i in spruce_xf.size():
		mm.set_instance_transform(i, spruce_xf[i])
		mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
	w.canopy.add_multimesh(mm, 4.6)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)


func _tree(sc: PackedScene, p: Vector3, h: float, yaw: float) -> void:
	var t: Node3D = sc.instantiate()
	var bb: AABB = w._aabb(t)
	t.scale = Vector3.ONE * (h / maxf(bb.size.y, 0.01))
	t.position = p
	t.rotation.y = yaw
	add_child(t)
	_cull(t, 48.0)
	trees.append(t)
	w.canopy.add_model(t, h)


## дальше dist от камеры модель не рисуется (камера видит ~10 м вокруг героя; это экономит вызовы отрисовки)
func _cull(n: Node, dist: float) -> void:
	for m in n.find_children("*", "GeometryInstance3D", true, false):
		var g := m as GeometryInstance3D
		g.visibility_range_end = dist
		g.visibility_range_end_margin = 4.0
		g.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


## Склеить все коробки группы с одним материалом в одну сетку: стены, стойла, жерди, доски — сотни отдельных
## деталей превращаются в несколько сеток (на телефоне дорог каждый вызов отрисовки). Текстуры наложены по
## мировым координатам, поэтому склейка их не сдвигает.
func _merge(g: Node3D) -> void:
	var by_mat := {}
	var drop: Array[Node] = []
	for c in g.get_children():
		var mi := c as MeshInstance3D
		if mi == null or not (mi.mesh is BoxMesh) or mi.material_override == null:
			continue
		var mat: Material = mi.material_override
		if not by_mat.has(mat):
			var st := SurfaceTool.new()
			st.begin(Mesh.PRIMITIVE_TRIANGLES)
			by_mat[mat] = st
		(by_mat[mat] as SurfaceTool).append_from(mi.mesh, 0, mi.transform)
		drop.append(mi)
	if drop.size() < 2:
		return
	for c in drop:
		g.remove_child(c)
		c.queue_free()
	for mat in by_mat:
		var st: SurfaceTool = by_mat[mat]
		var m := MeshInstance3D.new()
		m.mesh = st.commit()
		m.material_override = mat
		m.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(m)


## Постройки-модели Tripo: длинные коровники, сарай, водонапорная башня — внутрь не зайти, столкновение коробкой
## (у башни — цилиндр по основанию); одинокие сухие деревья у загонов.
func _landmarks() -> void:
	for lm in LANDMARKS:
		var path := MODELS + String(lm[0]) + ".glb"
		if not ResourceLoader.exists(path):
			continue
		var n: Node3D = (load(path) as PackedScene).instantiate()
		var bb: AABB = w._aabb(n)
		var k := float(lm[3]) / maxf(maxf(bb.size.x, bb.size.z), 0.01)
		n.scale = Vector3.ONE * k
		n.position = lm[1]
		n.rotation.y = float(lm[2])
		add_child(n)
		_cull(n, 95.0)
		var sz := bb.size * k
		var cs := CollisionShape3D.new()
		if String(lm[0]) == "ul_water_tower":
			var cy := CylinderShape3D.new()
			cy.radius = minf(sz.x, sz.z) * 0.42
			cy.height = 4.0
			cs.shape = cy
			cs.position = (lm[1] as Vector3) + Vector3.UP * 2.0
		else:
			var bs := BoxShape3D.new()
			bs.size = Vector3(sz.x * 0.96, minf(sz.y, 4.0), sz.z * 0.92)
			cs.shape = bs
			var c := (bb.position + bb.size * 0.5) * k
			cs.transform = Transform3D(Basis(Vector3.UP, float(lm[2])), (lm[1] as Vector3) + Basis(Vector3.UP, float(lm[2])) * Vector3(c.x, 0, c.z) + Vector3.UP * minf(sz.y, 4.0) * 0.5)
		body.add_child(cs)
		landmark_rects.append([lm[1], float(lm[2]), Vector2(sz.x, sz.z) * 0.5])
	var dead := MODELS + "ul_dead_tree.glb"
	if ResourceLoader.exists(dead):
		var sc: PackedScene = load(dead)
		var rng := RandomNumberGenerator.new()
		rng.seed = 808
		for p in DEAD_TREES:
			_tree(sc, p, rng.randf_range(3.5, 4.5), rng.randf() * TAU)
			var cs := CollisionShape3D.new()
			var cy := CylinderShape3D.new()
			cy.radius = 0.25
			cy.height = 3.0
			cs.shape = cy
			cs.position = p + Vector3.UP * 1.5
			body.add_child(cs)
			wood_pts.append(p)


## мусор: бочки, покрышки, ящики, кучи досок, ржавые листы железа, камни
func _debris(rng: RandomNumberGenerator) -> void:
	var iron := _mat("worn_corrugated_iron", 2.0)
	var planks := _mat("old_planks_02", 1.0)
	for i in 34:
		var p := Vector3(rng.randf_range(-half + 6, half - 6), 0, rng.randf_range(-half + 6, half - 6))
		if in_barn(p, 1.5) >= 0 or p.distance_to(ENTRY) < 8.0 or near_landmark(p, 2.0):
			continue
		var kind := rng.randi() % 5
		match kind:
			0:
				_prop("ph_barrel", p, rng.randf() * TAU, 1.0, 0.4)
			1:
				_prop("ph_tyre", p, rng.randf() * TAU, 1.0, 0.0)
			2:
				_box(_debris_root, Vector3(rng.randf_range(1.5, 2.6), 0.05, rng.randf_range(0.8, 1.1)), p + Vector3(0, 0.05, 0), iron, false, Vector3(rng.randf_range(-0.1, 0.1), rng.randf() * PI, rng.randf_range(-0.12, 0.12)))
			3:
				for k in 4:
					_box(_debris_root, Vector3(rng.randf_range(1.8, 3.0), 0.08, 0.2), p + Vector3(rng.randf_range(-0.3, 0.3), 0.06 + k * 0.08, rng.randf_range(-0.4, 0.4)), planks, false, Vector3(0, rng.randf_range(-0.5, 0.5), 0))
			4:
				var rock := MeshInstance3D.new()
				rock.mesh = w._rock_mesh(900 + i)
				var rs := rng.randf_range(0.6, 1.3)
				rock.scale = Vector3(rs, rs * 0.7, rs)
				rock.position = p
				var rmat := _mat("rock_boulder_dry", 1.5)
				rmat.albedo_color = Color(0.52, 0.5, 0.46)
				rock.material_override = rmat
				add_child(rock)
				var cs := CollisionShape3D.new()
				var sp := SphereShape3D.new()
				sp.radius = 0.5 * rs
				cs.shape = sp
				cs.position = p + Vector3.UP * 0.2
				body.add_child(cs)


func _prop(model: String, at: Vector3, yaw: float, sc: float, radius: float) -> void:
	var path := MODELS + model + ".glb"
	if not ResourceLoader.exists(path):
		return
	var n: Node3D = (load(path) as PackedScene).instantiate()
	n.position = at
	n.rotation.y = yaw
	n.scale = Vector3.ONE * sc
	add_child(n)
	_cull(n, 40.0)
	if radius > 0.0:
		var cs := CollisionShape3D.new()
		var cy := CylinderShape3D.new()
		cy.radius = radius
		cy.height = 1.0
		cs.shape = cy
		cs.position = at + Vector3.UP * 0.5
		body.add_child(cs)


## брошенная техника: трактор (модель Tripo, если есть) и ржавый прицеп
func _machinery() -> void:
	var rust := StandardMaterial3D.new()
	rust.albedo_texture = load(TEX + "worn_corrugated_iron_c.jpg")
	rust.albedo_color = Color(0.75, 0.42, 0.25)
	rust.uv1_triplanar = true
	rust.uv1_world_triplanar = true
	rust.uv1_scale = Vector3.ONE * 0.6
	rust.metallic = 0.3
	rust.roughness = 0.8
	var tyre := StandardMaterial3D.new()
	tyre.albedo_color = Color(0.09, 0.09, 0.09)
	tyre.roughness = 0.95
	for spot in [[Vector3(18, 0, -12), 0.5, "tractor"], [Vector3(-20, 0, 2), -0.3, "trailer"], [Vector3(10, 0, 45), 1.9, "trailer"]]:
		var at: Vector3 = spot[0]
		var yaw: float = spot[1]
		if String(spot[2]) == "tractor" and ResourceLoader.exists(MODELS + "ul_tractor.glb"):
			var t: Node3D = (load(MODELS + "ul_tractor.glb") as PackedScene).instantiate()
			var bb: AABB = w._aabb(t)
			t.scale = Vector3.ONE * (4.2 / maxf(maxf(bb.size.x, bb.size.z), 0.01))
			t.position = at
			t.rotation.y = yaw
			add_child(t)
			_cull(t, 60.0)
		else:
			# прицеп: кузов на четырёх колёсах, одно спущено
			var node := Node3D.new()
			add_child(node)
			node.position = at
			node.rotation.y = yaw
			_box(node, Vector3(4.0, 0.12, 2.0), Vector3(0, 0.75, 0), rust, false)
			for s in [-1.0, 1.0]:
				_box(node, Vector3(4.0, 0.5, 0.08), Vector3(0, 1.05, s * 0.96), rust, false)
				_box(node, Vector3(0.08, 0.5, 2.0), Vector3(s * 1.96, 1.05, 0), rust, false)
			for wx in [-1.2, 1.2]:
				for wz in [-1.05, 1.05]:
					var wh := MeshInstance3D.new()
					var cm := CylinderMesh.new()
					cm.top_radius = 0.42
					cm.bottom_radius = 0.42
					cm.height = 0.25
					wh.mesh = cm
					wh.material_override = tyre
					wh.rotation.x = PI * 0.5
					wh.position = Vector3(wx, 0.42 if wx > 0.0 or wz > 0.0 else 0.3, wz)
					node.add_child(wh)
			_box(node, Vector3(1.6, 0.08, 0.08), Vector3(-2.7, 0.55, 0), rust, false, Vector3(0, 0, 0.2))
			_merge(node)
			_cull(node, 60.0)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(4.2, 1.6, 2.2)
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at + Vector3.UP * 0.8)
		body.add_child(cs)


# ---------------- переменная часть: останки коров и враги ----------------

## останки коров — заново при каждом посещении: скелеты и тела, в коровниках и в поле. Без столкновений
## (низкие, через них проходят), на карту проходимости не влияют.
func place_cows(rng: RandomNumberGenerator) -> void:
	var n := int(cfg().get("cows", 20))
	var tries := 0
	while cows.size() < n and tries < 600:
		tries += 1
		var p: Vector3
		if rng.randf() < 0.4:
			p = barn_point(rng.randi() % barns.size(), rng)
		else:
			p = Vector3(rng.randf_range(-half + 8, half - 8), 0, rng.randf_range(-half + 8, half - 8))
			if in_barn(p, 1.0) >= 0:
				continue
		if p.distance_to(ENTRY) < 12.0 or near_landmark(p, 1.5):
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


## Останки коровы: скелет (половина — целый скелет на боку, половина — череп и кости) или тело погибшей коровы
## (модели Tripo; нет модели — запасной вид из простых форм). Без столкновений: через них проходят.
func _cow(at: Vector3, yaw: float, skeleton: bool) -> void:
	var model := "ul_cow_dead"
	var length := 2.3
	var on_side := false
	if skeleton:
		if (cows.size() % 2 == 0) and ResourceLoader.exists(MODELS + "ul_cow_bones.glb"):
			model = "ul_cow_bones"
			length = 1.2
		else:
			model = "ul_cow_skel"
			length = 2.0
			on_side = true
	var path := MODELS + model + ".glb"
	var node := Node3D.new()
	if ResourceLoader.exists(path):
		if not _cow_scenes.has(model):
			_cow_scenes[model] = load(path)
		var m: Node3D = (_cow_scenes[model] as PackedScene).instantiate()
		node.add_child(m)
		var bb: AABB = w._aabb(m)
		m.scale = Vector3.ONE * (length / maxf(maxf(bb.size.x, bb.size.z), 0.01))
		if on_side:
			m.rotation.z = PI * 0.5                # целый скелет лежит на боку
		var b2: AABB = w._aabb(node)
		m.position.y = -b2.position.y - (0.12 if on_side else 0.0)
	else:
		node = _cow_fallback(skeleton)
	node.position = at
	node.rotation.y = yaw
	node.set_meta("cow", "skeleton" if skeleton else "body")
	add_child(node)
	_cull(node, 40.0)


## запасной вид, пока нет моделей: скелет — позвоночник, рёбра и череп из костей; тело — туша на боку
func _cow_fallback(skeleton: bool) -> Node3D:
	var n := Node3D.new()
	if skeleton:
		var bone := StandardMaterial3D.new()
		bone.albedo_color = Color(0.86, 0.82, 0.72)
		bone.roughness = 0.8
		_box(n, Vector3(1.9, 0.1, 0.1), Vector3(0, 0.12, 0), bone, false)
		for i in 7:
			for s in [-1.0, 1.0]:
				_box(n, Vector3(0.05, 0.05, 0.55), Vector3(-0.5 + i * 0.16, 0.2, s * 0.25), bone, false, Vector3(s * 0.9, 0, 0))
		_box(n, Vector3(0.5, 0.2, 0.22), Vector3(1.15, 0.12, 0), bone, false)
		for lx in [-0.7, 0.6]:
			for s in [-1.0, 1.0]:
				_box(n, Vector3(0.07, 0.06, 0.8), Vector3(lx, 0.05, s * 0.55), bone, false, Vector3(0, s * 0.3, 0))
	else:
		var hide := StandardMaterial3D.new()
		hide.albedo_color = Color(0.32, 0.26, 0.22)
		hide.roughness = 0.95
		var mi := MeshInstance3D.new()
		var cm := CapsuleMesh.new()
		cm.radius = 0.42
		cm.height = 2.0
		mi.mesh = cm
		mi.material_override = hide
		mi.rotation.z = PI * 0.5
		mi.scale = Vector3(1, 1, 0.8)
		mi.position = Vector3(0, 0.36, 0)
		n.add_child(mi)
		_box(n, Vector3(0.45, 0.3, 0.3), Vector3(1.15, 0.25, 0.1), hide, false)
		for lx in [-0.6, 0.55]:
			for k in 2:
				_box(n, Vector3(0.1, 0.1, 0.9), Vector3(lx + k * 0.15, 0.25, 0.75), hide, false, Vector3(0.2, 0, 0))
	return n


## План врагов на это посещение: сколько (пустышей 10–30, лоторейщиков 3–8 — data/cowshed.json) и где —
## внутри коровников, у останков коров, в лесу и у загонов. Каждая точка проверяется по карте проходимости
## (snap — функция «ближайшая проходимая точка»; не в стене, не в бревне, не за краем), не ближе safe_r к точке
## входа и не вплотную к другому врагу. Возвращает [[вид, точка], …].
func spawn_plan(rng: RandomNumberGenerator, snap: Callable) -> Array:
	var c := cfg()
	var np := rng.randi_range(int(c.pustysh[0]), int(c.pustysh[1]))
	var nl := rng.randi_range(int(c.lottery[0]), int(c.lottery[1]))
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
			if r < 0.35:
				p = barn_point(rng.randi() % barns.size(), rng)
			elif r < 0.7 and not cows.is_empty():
				var cp: Vector3 = cows[rng.randi() % cows.size()]
				var a := rng.randf() * TAU
				p = cp + Vector3(cos(a), 0, sin(a)) * rng.randf_range(1.5, 4.0)
			else:
				var anchor: Vector3 = wood_pts[rng.randi() % wood_pts.size()] if (rng.randf() < 0.55 or fence_mid.is_empty()) else fence_mid[rng.randi() % fence_mid.size()]
				var a2 := rng.randf() * TAU
				p = anchor + Vector3(cos(a2), 0, sin(a2)) * rng.randf_range(1.0, 3.5)
			if absf(p.x) > half - 2.0 or absf(p.z) > half - 2.0 or p.distance_to(ENTRY) < safe_r:
				continue
			var q: Vector3 = snap.call(p)
			if Vector2(q.x - p.x, q.z - p.z).length() > 0.45:
				continue                                   # точка в стене, в дереве или вне проходимой части
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
	return out
