class_name ULQuarry
extends ULConvoy
## «Карьер» — нестабильный промышленный кластер 180 × 140 м по утверждённой карте: слева (запад) — шахтёрский
## посёлок (общежития, столовая, медпункт, мастерская, склад, контора, сараи, гараж, КПП со шлагбаумом на
## выезде), справа (восток) — открытая выработка настоящей глубины: бровка на 0 м, три уступа (−4,5 / −9 / −13,5 м)
## с почти отвесными каменными стенками и спиральный съезд для техники (с запада по северной стороне на дно). На
## юге — затопленная яма, на юго-восточной бровке — дробильный цех с конвейером от первого уступа и силосы, на
## северо-востоке — сторожевая вышка. Земля посёлка — своя сетка с вырезами под выработку и яму; столкновения —
## по той же сетке (сквозь стенку не пройти, под землю не провалиться). Во все постройки посёлка можно зайти
## (крыша скрывается, стены срезаются). Враги — пустыши, лотерейщики и Рубер (общий код временных кластеров).

const Q_CFG := "res://data/quarry.json"
const Q_NAV := "res://assets/world/nav_quarry.res"
const Q_MASK := "res://assets/world/tex/quarry_mask.png"
const Q_CACHE := "res://assets/world/quarry_blocks.res"
const Q_TITLE := "Карьер"
const Q_ENTRY := Vector3(-56.0, 0, 62.0)
const HX := 90.0                       ## поле: x от −HX до HX, z от −HZ до HZ (на севере и юге за краем — лес)
const HZ := 70.0

## выработка: эллипс (центр, полуоси); край неровный — две гармоники (те же в шейдере и в проверках)
const PIT_C := Vector2(36, -6)
const PIT_R := Vector2(44, 48)
const LV := [0.0, -4.5, -9.0, -13.5]
## стенки уступов: [доля радиуса верха, низа]; между ними — полки (уровни LV)
const WALLS := [[1.0, 0.955], [0.80, 0.755], [0.60, 0.555]]
## съезды: [стенка, угол начала, угол конца (рад, от востока по часовой — к югу), ширина (доля радиуса)]
const RAMPS := [[0, -2.9, -2.3, 0.12], [1, -2.1, -1.2, 0.12], [2, -1.0, 0.0, 0.12]]
## кольца сетки выработки (доли радиуса): чаще у стенок и краёв съездов
const RINGS := [0.0, 0.12, 0.24, 0.34, 0.42, 0.48, 0.49, 0.52, 0.54, 0.555, 0.57, 0.585, 0.6, 0.62, 0.65, 0.68, 0.69,
	0.71, 0.735, 0.755, 0.77, 0.785, 0.8, 0.82, 0.835, 0.845, 0.88, 0.91, 0.935, 0.955, 0.97, 0.985, 1.0]
const ANG_N := 256
## затопленная яма на юге: центр, полуоси, глубина дна; уровень воды
const POND_C := Vector2(8, 55)
const POND_R := Vector2(10, 7.5)
const POND_D := -2.6
const WATER_Y := -1.4

const Q_BUILDINGS := [
	# общежитие №1: два этажа, оштукатуренное; коридор вдоль, комнаты по обе стороны, лестница в торце
	{"id": "dorm1", "n": "Общежитие рабочих", "kind": "dorm", "skin": "plaster", "int": "int_beige1", "hall0": "hall0",
		"blocks": [{"c": Vector2(-60, -50), "L": 30.0, "W": 11.0, "axis": "x", "floors": 2, "stairs": [-1], "entr": [["s+", 3.0, 1.6]], "wide": 0.3}],
		"types": {"*": [["room", 6], ["wc", 1], ["linen", 1]]}},
	# общежитие №2: деревянный барак — комнаты у западной стены, коридор к посёлку
	{"id": "dorm2", "n": "Общежитие №2", "kind": "dorm", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.0, "te": 0.18,
		"roof_mat": "rust", "gable": "planks", "rise": 0.5, "ov": 0.4, "shutters": false,
		"blocks": [{"c": Vector2(-76, 2), "L": 23.0, "W": 11.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.2,
			"row": [["m_quarters", 5.6], ["m_quarters", 5.6], ["m_quarters", 5.6], ["wc", 5.6]], "hall_type": "m_hall",
			"entr": [["s+", -4.0, 1.4, "porch"], ["e-", 1.5, 1.1, "plain"]], "win_w": 1.1, "win_h": 1.1, "sill": 1.0}]},
	# столовая: обеденный зал, кухня, холодильная, кладовая
	{"id": "canteen", "n": "Столовая", "kind": "canteen", "style": "wood", "skin": "planks_brown", "int": "int_beige", "storey": 3.3, "te": 0.2, "plinth_h": 0.4,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.5, "ov": 0.4, "shutters": false,
		"blocks": [{"c": Vector2(-60, -24), "L": 24.0, "W": 13.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.8,
			"row": [["kitchen", 9.0], ["cold", 5.0], ["pantry", 5.0], ["wc", 4.6]], "hall_type": "dining",
			"entr": [["s+", 4.0, 1.6, "porch"], ["e+", 1.0, 1.1, "plain"]], "win_w": 1.4, "win_h": 1.2, "sill": 0.9}]},
	# медпункт: палата с кушетками, процедурная, кабинет фельдшера
	{"id": "med", "n": "Медпункт", "kind": "med", "skin": "plaster", "int": "int_blue", "storey": 3.0,
		"blocks": [{"c": Vector2(-27, -50), "L": 15.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.2,
			"row": [["proc", 5.2], ["nurse", 5.0], ["wc", 4.4]], "hall_type": "ward",
			"entr": [["s+", -2.5, 1.4]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	# мастерская: большой цех с воротами, кладовая, техкомната, бытовка
	{"id": "workshop", "n": "Мастерская", "kind": "workshop", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.2, "te": 0.18,
		"roof_mat": "rust", "gable": "planks", "rise": 0.45, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-31, -16), "L": 24.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.6,
			"row": [["store", 7.6], ["tech", 7.6], ["staff", 8.4]], "hall_type": "workshop",
			"entr": [["s+", -3.0, 3.4, "plain"], ["e+", 1.5, 1.1, "plain"]], "win_w": 1.2, "win_h": 0.8, "sill": 1.6}]},
	# склад: широкие ворота, зал со стеллажами и проходами, кладовые у северной стены
	{"id": "warehouse", "n": "Склад", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.4, "te": 0.15,
		"roof_mat": "rust", "gable": "planks", "rise": 0.4, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-44, 20), "L": 28.0, "W": 15.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.4,
			"row": [["store", 9.0], ["store", 9.0], ["store", 9.4]], "hall_type": "warehouse",
			"entr": [["s+", -5.0, 3.6, "plain"], ["s+", 8.0, 3.6, "plain"], ["e+", 2.0, 1.2, "plain"]], "win_w": 0.9, "win_h": 0.6, "sill": 2.2}]},
	# контора карьера: кабинет начальника, диспетчерская (радиостанция), архив; коридор вдоль фасада
	{"id": "office", "n": "Контора карьера", "kind": "office", "skin": "plaster", "int": "int_beige1", "storey": 3.2,
		"blocks": [{"c": Vector2(-62, 40), "L": 20.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.4,
			"row": [["office", 7.0], ["m_radio", 6.4], ["archive", 6.2]], "hall_type": "m_hall",
			"entr": [["s+", 3.0, 1.4, "porch"]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	{"id": "shed1", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.7, "te": 0.12,
		"roof_mat": "rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-20, 52), "L": 8.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s-", 0.0, 1.6, "plain"]], "blind": ["s+", "e-"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "shed2", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.6, "te": 0.12,
		"roof_mat": "roof_tin", "gable": "planks", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-30, 58), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s-", 0.0, 1.4, "plain"]], "blind": ["s+", "e+"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "garage", "n": "Гараж", "kind": "shed", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 3.2, "te": 0.08,
		"roof_mat": "rust", "gate_mat": "gmetal",
		"blocks": [{"c": Vector2(-82, 32), "L": 12.0, "W": 8.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["s+", 0.0, 3.2, "gate"]], "blind": ["s-", "e+"]}]},
]

## дороги посёлка и подъезды к выработке (утоптанный щебень, колеи): ломаные
const Q_ROADS := [
	[Vector2(-56, 82), Vector2(-56, 58), Vector2(-50, 40), Vector2(-42, 30), Vector2(-36, 6), Vector2(-22, -2), Vector2(-9, -12), Vector2(-4, -17)],
	[Vector2(-36, 6), Vector2(-50, 0), Vector2(-58, -12), Vector2(-61, -36), Vector2(-56, -43)],
	[Vector2(-22, -2), Vector2(-25, -30), Vector2(-27, -43)],
	[Vector2(-50, 40), Vector2(-30, 44), Vector2(-4, 44), Vector2(24, 46), Vector2(48, 50), Vector2(62, 46)],
	[Vector2(-9, -12), Vector2(-6, -40), Vector2(12, -60), Vector2(50, -62), Vector2(76, -54)],
	[Vector2(-50, 0), Vector2(-66, 4), Vector2(-80, 20), Vector2(-82, 26)],
]
const Q_TOWER := Vector3(77, 0, -50)
const Q_CRUSHER := Vector3(66, 0, 40)

static var _qcfg := {}
var pit_mat: ShaderMaterial
var water: MeshInstance3D
var quest_spots: Dictionary = {}        ## задание «Последняя смена»: вид → [{pos, n, …}] (тайники для находок)
var deposits: Array = []                ## минеральные жилы и кучи руды: {pos, kind}
var _tower2_roof: Node3D


static func qcfg() -> Dictionary:
	if _qcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(Q_CFG))
		_qcfg = d if d is Dictionary else {}
	return _qcfg


func conf() -> Dictionary:
	return qcfg()


func entry() -> Vector3:
	return Q_ENTRY


func title() -> String:
	return Q_TITLE


func spawn_limit() -> float:
	return HX - 2.0


static func q_sig() -> int:
	return hash(str(Q_BUILDINGS) + "|" + str(ULBlock.GEN_V) + "|q1")


# ---------------- рельеф ----------------

## неровный край выработки: множитель радиуса по углу
static func pit_f(th: float) -> float:
	return 1.0 + 0.035 * sin(3.0 * th + 0.7) + 0.025 * sin(5.0 * th + 2.1)


## доля радиуса s (0 — центр, 1 — бровка) и угол θ точки относительно выработки
static func pit_st(q: Vector2) -> Vector2:
	var d := (q - PIT_C) / PIT_R
	var th := atan2(d.y, d.x)
	return Vector2(d.length() / pit_f(th), th)


static func pit_point(s: float, th: float) -> Vector2:
	return PIT_C + Vector2(cos(th), sin(th)) * PIT_R * pit_f(th) * s


## высота уступов без съездов
static func terrace(s: float) -> float:
	if s >= 1.0:
		return 0.0
	for k in WALLS.size():
		var top: float = WALLS[k][0]
		var bot: float = WALLS[k][1]
		if s >= top:
			return LV[k]
		if s >= bot:
			var t := (s - bot) / (top - bot)
			return lerpf(LV[k + 1], LV[k], pow(t, 0.85))
	return LV[LV.size() - 1]


## высота съезда (или −INF, если точка не на нём)
static func ramp_h(s: float, th: float) -> float:
	var best := -INF
	for r in RAMPS:
		var k := int(r[0])
		var top: float = WALLS[k][0]
		var wd: float = r[3]
		if s > top + 0.002 or s < top - wd:
			continue
		var u := (th - float(r[1])) / (float(r[2]) - float(r[1]))
		if u < -0.03 or u > 1.03:
			continue
		best = maxf(best, lerpf(LV[k], LV[k + 1], clampf(u, 0.0, 1.0)))
	return best


## высота земли в точке (выработка, яма, остальное — 0)
static func height(q: Vector2) -> float:
	var st := pit_st(q)
	if st.x < 1.0:
		return maxf(terrace(st.x), ramp_h(st.x, st.y))
	var dp := ((q - POND_C) / POND_R).length()
	if dp < 1.0:
		return pond_h(dp)
	return 0.0


static func pond_h(dp: float) -> float:
	return POND_D * (1.0 - smoothstep(0.35, 1.0, dp))


## на съезде ли точка (там не ставим технику и кучи)
static func on_ramp(q: Vector2) -> bool:
	var st := pit_st(q)
	return st.x < 1.0 and ramp_h(st.x, st.y) > terrace(st.x) + 0.05


## уровень точки: 0 — бровка и посёлок, 1–3 — полки уступов (по высоте)
static func level_at(q: Vector2) -> int:
	var h := height(q)
	if h > -2.0:
		return 0
	if h > -6.8:
		return 1
	if h > -11.3:
		return 2
	return 3


const PIT_SHADER := """shader_type spatial;
// Выработка: на крутом — скала (развёртка по кругу: u — вдоль бровки, v — вдоль склона), на полках — серо-бурый
// щебень с камнями (сверху, по миру) и редкие пятна светлой пыли; ниже — темнее и холоднее (меньше неба).
// Окно вокруг героя — как у построек (ULBlock.set_hole).
uniform sampler2D rock : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D rock_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D gravel : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D gravel_n : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D dust : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform float rock_scale = 4.2;
uniform float gravel_scale = 3.6;
uniform vec4 hole = vec4(0.5, 0.5, 0.0, 0.0);
uniform float hole_y = -100.0;
varying vec3 wp;
varying vec3 wn;
void vertex() {
	wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wn = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
float lum(vec3 c) { return dot(c, vec3(0.3, 0.59, 0.11)); }
float dith(vec2 fc) { return fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))); }
void fragment() {
	if (hole.z > 0.0 && wp.y > hole_y && -VERTEX.z < hole.w) {
		vec2 d = (SCREEN_UV - hole.xy) * vec2(VIEWPORT_SIZE.x / VIEWPORT_SIZE.y, 1.0);
		float r = length(d) / hole.z;
		if (r < 1.0 && dith(FRAGCOORD.xy) > smoothstep(0.62, 1.0, r)) { discard; }
	}
	float n1 = texture(noise, wp.xz / 37.0).r;
	float n2 = texture(noise, wp.xz / 9.0 + vec2(0.31, 0.77)).r;
	float wall = 1.0 - smoothstep(0.5, 0.78, wn.y);
	vec3 r = texture(rock, UV / rock_scale).rgb;
	vec3 r2 = texture(rock, UV / (rock_scale * 2.7) + vec2(0.37, 0.11)).rgb;
	r = mix(r, r2, 0.4);
	r = mix(vec3(lum(r)), r, 0.5) * vec3(1.0, 0.99, 0.97) * 1.12;
	vec2 gu = wp.xz / gravel_scale;
	vec3 g = texture(gravel, gu).rgb;
	vec3 g2 = texture(gravel, wp.xz / (gravel_scale * 2.9) + vec2(0.53, 0.21)).rgb;
	g = mix(g, g2, smoothstep(0.3, 0.7, n2) * 0.5);
	g = mix(vec3(lum(g)), g, 0.6) * 1.05;
	vec3 du = texture(dust, wp.xz / 4.5).rgb;
	du = mix(vec3(lum(du)), du, 0.3) * vec3(0.92, 0.9, 0.86);
	vec3 fl = mix(g, du, smoothstep(0.6, 0.78, n1 * 0.75 + n2 * 0.25) * 0.7);
	vec3 c = mix(fl, r, wall);
	float depth = clamp(-wp.y / 14.0, 0.0, 1.0);
	c *= mix(1.0, 0.84, depth) * mix(0.93, 1.05, n2);
	c *= mix(vec3(1.0), vec3(0.95, 0.97, 1.02), depth);
	ALBEDO = c;
	ROUGHNESS = mix(0.95, 0.86, wall);
	vec3 nf = texture(gravel_n, gu).rgb;
	NORMAL_MAP = mix(nf, texture(rock_n, UV / rock_scale).rgb, wall);
	NORMAL_MAP_DEPTH = 1.3;
}
"""


func _pit_material() -> ShaderMaterial:
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = PIT_SHADER if not bool(ULSettings.q().aniso) else PIT_SHADER.replace("filter_linear_mipmap,", "filter_linear_mipmap_anisotropic,")
	sm.shader = sh
	sm.set_shader_parameter("rock", load(TEX + "quarry_wall_c.jpg"))
	sm.set_shader_parameter("rock_n", load(TEX + "quarry_wall_n.jpg"))
	sm.set_shader_parameter("gravel", load(TEX + "rocks_ground_02_c.jpg"))
	sm.set_shader_parameter("gravel_n", load(TEX + "rocks_ground_02_n.jpg"))
	sm.set_shader_parameter("dust", load(TEX + "dry_ground_01_c.jpg"))
	sm.set_shader_parameter("noise", _noise_tex)
	# окно вокруг героя обновляется вместе с постройками (ULBlock.set_hole)
	ULBlock.mats["quarry_pit"] = sm
	return sm


## Сетка выработки: кольца × углы, высота — height(); стенки шероховатые (вершины уступа сдвинуты шумом). Развёртка:
## u — длина дуги по бровке, v — путь вдоль склона от центра (на стенке — по высоте). Возвращает массив треугольников
## для столкновений.
func _q_pit() -> PackedVector3Array:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var nr := RINGS.size()
	var grid := []
	var rmean := (PIT_R.x + PIT_R.y) * 0.5
	for i in ANG_N + 1:
		var th := -PI + TAU * float(i) / ANG_N
		var col := []
		var v := 0.0
		var prev := Vector3.ZERO
		for j in nr:
			var s: float = RINGS[j]
			var q := pit_point(s, th)
			var h := maxf(terrace(s), ramp_h(s, th))
			# стенки — шероховатые: выступы и ниши до 0,45 м поперёк, чуть по высоте (не на съездах)
			var wallish := false
			for wl in WALLS:
				if s < float(wl[0]) - 0.001 and s > float(wl[1]) + 0.001:
					wallish = true
			if wallish and ramp_h(s, th) < terrace(s) + 0.05:
				var nz := _noise(Vector2(th * 9.0, h * 0.35) + Vector2(0.21, 0.63)) - 0.5
				q += (q - PIT_C).normalized() * nz * 0.9
				h += (_noise(Vector2(th * 15.0, s * 30.0)) - 0.5) * 0.4
			var p := Vector3(q.x, h, q.y)
			if j > 0:
				v += prev.distance_to(p)
			prev = p
			col.append([p, Vector2(th * rmean * (0.65 + 0.35 * s), v)])
		grid.append(col)
	var tris := PackedVector3Array()
	for i in ANG_N:
		for j in nr - 1:
			var a: Array = grid[i][j]
			var b: Array = grid[i + 1][j]
			var c: Array = grid[i + 1][j + 1]
			var d: Array = grid[i][j + 1]
			for tri in [[a, c, b], [a, d, c]]:
				for vv in tri:
					st.set_uv(vv[1])
					st.add_vertex(vv[0])
					tris.append(vv[0])
	# кайма за бровкой: тот же материал заходит под землю посёлка (без щели по краю выреза)
	for i in ANG_N:
		var th0 := -PI + TAU * float(i) / ANG_N
		var th1 := -PI + TAU * float(i + 1) / ANG_N
		var ring := []
		for s in [1.0, 1.035]:
			for th in [th0, th1]:
				var q := pit_point(s, th)
				ring.append(Vector3(q.x, 0.012 if s > 1.0 else 0.0, q.y))
		for vv in [ring[0], ring[3], ring[1], ring[0], ring[2], ring[3]]:
			st.set_uv(Vector2((vv as Vector3).x, (vv as Vector3).z))
			st.add_vertex(vv)
	st.generate_normals()
	st.generate_tangents()
	var mi := MeshInstance3D.new()
	mi.name = "Pit"
	mi.mesh = st.commit()
	pit_mat = _pit_material()
	mi.material_override = pit_mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	add_child(mi)
	return tris


## затопленная яма: чаша и вода; возвращает треугольники чаши
func _q_pond() -> PackedVector3Array:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var rings := [0.0, 0.2, 0.35, 0.5, 0.62, 0.74, 0.86, 0.94, 1.0, 1.06]
	var n := 64
	var grid := []
	for i in n + 1:
		var th := TAU * float(i) / n
		var col := []
		for s in rings:
			var q := POND_C + Vector2(cos(th), sin(th)) * POND_R * float(s)
			col.append(Vector3(q.x, pond_h(float(s)) + (0.012 if float(s) > 1.0 else 0.0), q.y))
		grid.append(col)
	var tris := PackedVector3Array()
	for i in n:
		for j in rings.size() - 1:
			var a: Vector3 = grid[i][j]
			var b: Vector3 = grid[i + 1][j]
			var c: Vector3 = grid[i + 1][j + 1]
			var d: Vector3 = grid[i][j + 1]
			for vv in [a, c, b, a, d, c]:
				st.set_uv(Vector2(vv.x, vv.z) / 3.0)
				st.add_vertex(vv)
				tris.append(vv)
	st.generate_normals()
	st.generate_tangents()
	var mi := MeshInstance3D.new()
	mi.name = "Pond"
	mi.mesh = st.commit()
	mi.material_override = pit_mat
	add_child(mi)
	# вода: тёмная, мутная, с бликом
	water = MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = POND_R * 2.0
	water.mesh = pm
	water.position = Vector3(POND_C.x, WATER_Y, POND_C.y)
	water.scale = Vector3(0.93, 1, 0.93)
	var wm := StandardMaterial3D.new()
	wm.albedo_color = Color(0.16, 0.2, 0.19, 0.86)
	wm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	wm.roughness = 0.08
	wm.metallic_specular = 0.7
	water.material_override = wm
	water.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(water)
	return tris


## Земля посёлка и вокруг: ровная сетка до края карты с вырезами по бровке выработки и краю ямы (Делоне по точкам
## сетки и по бровке; треугольники внутри вырезов отброшены). Шейдер — общий (ground_for «quarry»).
func _q_ground() -> PackedVector3Array:
	var pts := PackedVector2Array()
	var lim := half + 0.0
	var step := 6.0
	var x := -lim
	while x <= lim + 0.01:
		var z := -lim
		while z <= lim + 0.01:
			var q := Vector2(x, z)
			var edge := absf(x) > lim - 0.01 or absf(z) > lim - 0.01
			if edge or (pit_st(q).x > 1.09 and ((q - POND_C) / POND_R).length() > 1.18):
				pts.append(q)
			z += step
		x += step
	for i in ANG_N:
		pts.append(pit_point(1.0, -PI + TAU * float(i) / ANG_N))
	for i in 64:
		var th := TAU * float(i) / 64.0
		pts.append(POND_C + Vector2(cos(th), sin(th)) * POND_R)
	var idx := Geometry2D.triangulate_delaunay(pts)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var tris := PackedVector3Array()
	for t in idx.size() / 3:
		var a := pts[idx[t * 3]]
		var b := pts[idx[t * 3 + 1]]
		var c := pts[idx[t * 3 + 2]]
		var m := (a + b + c) / 3.0
		if pit_st(m).x < 1.0 or ((m - POND_C) / POND_R).length() < 1.0:
			continue
		# обход — против часовой сверху (нормаль вверх)
		var cr := (b - a).cross(c - a)
		var order := [a, b, c] if cr > 0.0 else [a, c, b]     # (проверено: так нормаль вверх — лицевая сторона к небу)
		for p in order:
			st.set_normal(Vector3.UP)
			st.set_uv(Vector2(p.x, p.y) / (lim * 2.0) + Vector2(0.5, 0.5))
			st.add_vertex(Vector3(p.x, 0, p.y))
			tris.append(Vector3(p.x, 0, p.y))
	var mi := MeshInstance3D.new()
	mi.name = "Ground"
	mi.mesh = st.commit()
	var sm: ShaderMaterial = w.ground_for("quarry", lim * 2.0)
	sm.set_shader_parameter("noise", _noise_tex)
	if ResourceLoader.exists(Q_MASK) and w.test != "qrbake":
		mask = (load(Q_MASK) as Texture2D).get_image()
		if mask.is_compressed():
			mask.decompress()
		if mask.has_mipmaps():
			mask.clear_mipmaps()
	else:
		mask = _q_bake_mask()
		if w.test == "qrbake":
			mask.save_png(ProjectSettings.globalize_path(Q_MASK))
			print("[bake] карта земли карьера: ", Q_MASK)
	sm.set_shader_parameter("mask", ImageTexture.create_from_image(mask))
	mi.material_override = sm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	ULHouse.outer_frame(self, half, 520.0)
	return tris


func _trimesh(tris: PackedVector3Array) -> void:
	var cs := CollisionShape3D.new()
	var sh := ConcavePolygonShape3D.new()
	sh.set_faces(tris)
	cs.shape = sh
	body.add_child(cs)


## граница кластера (за краем поля — выход): по x на HX + 9, по z — на HZ + 9 (на севере и юге за краем — лес)
func _q_bounds() -> void:
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var wc := CollisionShape3D.new()
		var b := BoxShape3D.new()
		b.size = Vector3(1, 4, HZ * 2.0 + 20.0) if s.x != 0.0 else Vector3(HX * 2.0 + 20.0, 4, 1)
		wc.shape = b
		wc.position = Vector3(s.x * (HX + 9.0), 2.0, s.z * (HZ + 9.0))
		body.add_child(wc)


func _q_bake_mask() -> Image:
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
			var road := 1.0 - smoothstep(2.0, 3.6, road_dist(p) + (n3 - 0.5) * 1.1)
			# у бровки и вокруг техники — пыльная утоптанная площадка
			var rim := 1.0 - smoothstep(1.0, 1.16, pit_st(p).x + (n2 - 0.5) * 0.06)
			var vil := clear_w(p) * smoothstep(0.2, 0.55, n2 * 0.6 + n3 * 0.4 + 0.2)
			var path := maxf(road, maxf(rim * 0.85, vil * 0.75))
			var gw := smoothstep(0.2, 0.5, n1 * 0.45 + n2 * 0.35 + n3 * 0.2) * 0.75 + 0.25
			gw *= 1.0 - path
			var fw: float = w.forest_w(p, tpts, n2 * 1.5) * (1.0 - path)
			gw *= 1.0 - fw * 0.85
			if pit_st(p).x < 1.02 or ((p - POND_C) / POND_R).length() < 1.05:
				gw = 0.0
				fw = 0.0
			var ao := 1.0 - (1.0 - smoothstep(0.0, 1.5, bld_dist(p))) * 0.4
			im.set_pixel(ix, iy, Color(gw, path, fw, ao))
	return im


# ---------------- зоны и расстояния ----------------

func road_dist(q: Vector2) -> float:
	var d := 1e9
	for t in Q_ROADS:
		for i in t.size() - 1:
			d = minf(d, _seg_dist(q, t[i], t[i + 1]))
	return d


func track_dist(q: Vector2) -> float:
	return road_dist(q)


## посёлок (утоптанный двор между постройками): 0 — нет, 1 — середина
func clear_w(q: Vector2) -> float:
	var v := 1.0 - smoothstep(0.0, 8.0, maxf(absf(q.x + 50.0) - 34.0, absf(q.y) - 60.0))
	return clampf(v, 0.0, 1.0) * (1.0 if q.x < -8.0 else 0.0)


func pave_dist(q: Vector2) -> float:
	return road_dist(q) - 3.0


## лес — по краям: не в посёлке, не у выработки и ямы, не на дорогах
func forest_ok(q: Vector2) -> bool:
	if pit_st(q).x < 1.25 or ((q - POND_C) / POND_R).length() < 1.6:
		return false
	if q.distance_to(Vector2(Q_ENTRY.x, Q_ENTRY.z)) < 10.0 or q.distance_to(Vector2(Q_CRUSHER.x, Q_CRUSHER.z)) < 16.0:
		return false
	if q.distance_to(Vector2(Q_TOWER.x, Q_TOWER.z)) < 9.0:
		return false
	var village := q.x < -6.0 and q.x > -88.0 and absf(q.y) < 64.0
	return not village or absf(q.y) > 62.0 or q.x < -86.0


func forest_n() -> int:
	return 440


## лес: по краям поля и ещё ряд за краем (на севере и юге — до границы квадрата карты)
func _q_forest(rng: RandomNumberGenerator) -> void:
	var kinds := []
	for k in [["ul_pine", 0.32, 4.4, 6.0], ["ul_birch", 0.2, 4.2, 5.6], ["ul_oak", 0.08, 4.2, 5.2], ["ul_dead_tree", 0.05, 3.4, 4.6]]:
		if ResourceLoader.exists(MODELS + String(k[0]) + ".glb"):
			kinds.append([load(MODELS + String(k[0]) + ".glb"), k[1], k[2], k[3], String(k[0])])
	var pts: Array = []
	var tries := 0
	var lim := half + 9.0
	while pts.size() < forest_n() and tries < 12000:
		tries += 1
		var q := Vector2(rng.randf_range(-lim, lim), rng.randf_range(-lim, lim))
		var inside := absf(q.x) < HX - 2.0 and absf(q.y) < HZ - 2.0
		if not forest_ok(q) or road_dist(q) < 4.5 or bld_dist(q) < 4.0:
			continue
		if _noise(q / 45.0 + Vector2(0.3, 0.7)) < 0.38 and rng.randf() < 0.65:
			continue
		var ok := true
		for pp in pts:
			if (pp[0] as Vector3).distance_to(Vector3(q.x, 0, q.y)) < 3.0:
				ok = false
				break
		if ok:
			pts.append([Vector3(q.x, 0, q.y), inside])
	for pp in pts:
		var p: Vector3 = pp[0]
		wood_pts.append(p)
		var pick := rng.randf()
		var chosen = null
		var acc := 0.35
		if pick >= acc:
			for k in kinds:
				acc += float(k[1])
				if pick < acc:
					chosen = k
					break
		if chosen == null:
			_spruce_xf.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3.ONE * rng.randf_range(0.85, 1.25)), p))
		else:
			_tree(chosen[0], p, rng.randf_range(float(chosen[2]), float(chosen[3])), rng.randf() * TAU, String(chosen[4]))
		if pp[1]:
			_cyl_col(p, 0.22, 3.0)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.use_colors = true
	mm.mesh = w._spruce_mesh(5.0, 141)
	mm.instance_count = _spruce_xf.size()
	for i in _spruce_xf.size():
		mm.set_instance_transform(i, _spruce_xf[i])
		mm.set_instance_color(i, Color.WHITE)
		mm.set_instance_custom_data(i, Color(0, 0, 0, 0))
	w.canopy.add_multimesh(mm, 5.0)
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	add_child(mi)


## Осыпь у подножия стенок и россыпь камней на полках: валуны (одной сеткой), крупные — со столкновением.
## Не на съездах и не у самого края полки.
func _q_scree(rng: RandomNumberGenerator) -> void:
	var rock: ArrayMesh = w._rock_mesh(53)
	var xs: Array[Transform3D] = []
	for k in 420:
		var th := rng.randf_range(-PI, PI)
		var wl: Array = WALLS[rng.randi() % WALLS.size()]
		var s := float(wl[1]) - rng.randf_range(0.004, 0.03)
		var q := pit_point(s, th)
		if on_ramp(q) or on_ramp(pit_point(float(wl[1]) - 0.06, th)):
			continue
		var big := rng.randf() < 0.18
		var sz := rng.randf_range(1.1, 2.2) if big else rng.randf_range(0.3, 0.9)
		var h := height(q)
		xs.append(Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.3, 0.3), rng.randf() * TAU, rng.randf_range(-0.3, 0.3))).scaled(Vector3(sz, sz * rng.randf_range(0.5, 0.85), sz * rng.randf_range(0.8, 1.25))), Vector3(q.x, h + sz * 0.08, q.y)))
		if big:
			_cyl_col(Vector3(q.x, h, q.y), sz * 0.42, sz * 0.6)
	# россыпь на дне и полках
	for k in 160:
		var q := Vector2(rng.randf_range(-6, 80), rng.randf_range(-54, 42))
		var st := pit_st(q)
		if st.x > 0.98 or on_ramp(q):
			continue
		var sz := rng.randf_range(0.25, 0.7)
		xs.append(Transform3D(Basis.from_euler(Vector3(rng.randf_range(-0.3, 0.3), rng.randf() * TAU, 0)).scaled(Vector3(sz, sz * 0.6, sz)), Vector3(q.x, height(q) + 0.02, q.y)))
	var rm := MultiMesh.new()
	rm.transform_format = MultiMesh.TRANSFORM_3D
	rm.mesh = rock
	rm.instance_count = xs.size()
	for i in xs.size():
		rm.set_instance_transform(i, xs[i])
	var rmi := MultiMeshInstance3D.new()
	rmi.multimesh = rm
	var rmat := ULHouse._mat(TEX + "quarry_wall", 1.6)
	rmat.albedo_color = Color(0.86, 0.84, 0.82)
	rmi.material_override = rmat
	add_child(rmi)


# ---------------- сборка ----------------

func build(world: Node3D) -> void:
	w = world
	half = HX
	body = StaticBody3D.new()
	body.name = "QuarryBody"
	var fn := FastNoiseLite.new()
	fn.seed = 2207
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	_noise_img = fn.get_seamless_image(256, 256)
	_noise_tex = ImageTexture.create_from_image(_noise_img)
	ULBlock.cam_dir = ULFarmBuilding.cam_dir
	ULBlock.make_materials(_noise_tex)
	_mats = ULFarmBuilding.make_materials(_noise_tex)
	var rng := RandomNumberGenerator.new()
	rng.seed = 6113
	var t0 := Time.get_ticks_msec()
	var cache: ULBlockCache = null
	if w.test != "qrbake" and ResourceLoader.exists(Q_CACHE):
		var r = load(Q_CACHE)
		if r is ULBlockCache and (r as ULBlockCache).sig == q_sig():
			cache = r
		else:
			push_warning("карьер: кэш построек устарел — пересоберите --as-test=qrbake")
	var made := {}
	for d in Q_BUILDINGS:
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
		_place_models(b)
	if cache != null:
		rng.state = cache.rng_state
		_dist = cache.dist
	var bld_state := rng.state
	var props := Node3D.new()
	props.name = "Props"
	add_child(props)
	_q_forest(rng)
	var tris := _q_pit()
	tris.append_array(_q_pond())
	tris.append_array(_q_ground())
	_trimesh(tris)
	_q_bounds()
	ULGroundDetail.ruts(self, Q_ROADS, _noise_tex, "brown_mud_02")
	_q_scree(rng)
	_q_props(props, rng)
	_flush(props)
	_c_forest_props(7373, 8, 5)
	_c_vegetation()
	_q_spots(rng)
	_light_pool()
	add_child(body)
	if w.test == "qrbake":
		var cr := ULBlockCache.new()
		cr.sig = q_sig()
		cr.rng_state = bld_state
		cr.blds = made
		cr.dist = _bake_dist()
		var err := ResourceSaver.save(cr, Q_CACHE, ResourceSaver.FLAG_COMPRESS)
		print("[bake] кэш построек карьера: %s (%s)" % [Q_CACHE, error_string(err)])
	print("[quarry] карьер собран: %d мс, построек %d, столкновений %d, треугольников земли %d, тайников в помещениях %d, вне — %d" % [Time.get_ticks_msec() - t0, blds.size(), body.get_child_count(), tris.size() / 3, _count_cont(), extra.size()])


# ---------------- предметы и техника ----------------

## модель по длине (или высоте) на земле этого места (высота — из рельефа); нет файла — ничего не ставится
func _qm(id: String, at: Vector3, yaw: float, length: float, collide := true, by_height := false, tint := Color(0.86, 0.84, 0.8)) -> Vector3:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		return Vector3.ZERO
	var p := Vector3(at.x, height(Vector2(at.x, at.z)) if at.y == 0.0 else at.y, at.z)
	return _c_model_box(path, p, yaw, length, tint, id, collide, by_height)


## тайник вне помещений (техника, ящики, кучи): к обыску — по виду из data/quarry.json (loot)
func _stash(at: Vector3, size: Vector3, yaw: float, kind: String, n: String) -> void:
	var p := Vector3(at.x, height(Vector2(at.x, at.z)) if at.y == 0.0 else at.y, at.z)
	extra.append({"pos": p, "size": size, "yaw": yaw, "kind": kind, "n": n})


func _q_props(g: Node3D, rng: RandomNumberGenerator) -> void:
	pass


# ---------------- враги ----------------

## места снаружи по зонам: посёлок, дороги, дно, полки, у техники, у дробилки, у ямы, лес
func _q_spots(rng: RandomNumberGenerator) -> void:
	for k in 900:
		var q := Vector2(rng.randf_range(-HX + 4.0, HX - 4.0), rng.randf_range(-HZ + 4.0, HZ - 4.0))
		if bld_dist(q) < 1.2 or on_ramp(q):
			continue
		var st := pit_st(q)
		var tag := ""
		if st.x < 1.0:
			# не у самой кромки полки (оттуда сорвётся) и не на стенке
			var h := height(q)
			var flat := true
			for dd in [Vector2(1.2, 0), Vector2(-1.2, 0), Vector2(0, 1.2), Vector2(0, -1.2)]:
				if absf(height(q + dd) - h) > 0.3:
					flat = false
			if not flat:
				continue
			tag = ["pit_bottom", "bench2", "bench1", "bench1"][3 - level_at(q)] if level_at(q) > 0 else "rim"
		elif ((q - POND_C) / POND_R).length() < 1.6:
			if ((q - POND_C) / POND_R).length() < 1.08:
				continue
			tag = "pond"
		elif q.distance_to(Vector2(Q_CRUSHER.x, Q_CRUSHER.z)) < 16.0:
			tag = "crusher"
		elif q.x < -8.0 and absf(q.y) < 62.0:
			tag = "village" if road_dist(q) > 4.0 else "road"
		elif road_dist(q) < 5.0:
			tag = "road"
		else:
			tag = "forest"
		if tag == "rim":
			tag = "road"
		yard_pts.append(Vector3(q.x, height(q), q.y))
		_yard_tags.append(tag)


func _extra_pools(_pools: Dictionary) -> void:
	pass


## тайники: в помещениях (общее) и вне их — техника, ящики, жилы, кучи руды
func roll_containers(rng: RandomNumberGenerator) -> void:
	super.roll_containers(rng)


## хлам и минералы: в постройках — кучки хлама; у жил и куч руды — минералы (вид предмета — по месту)
func junk_points(rng: RandomNumberGenerator) -> Array:
	return junk_in_buildings(rng)


func tick(hero: Vector3, cam, delta: float) -> void:
	super.tick(hero, cam, delta)
