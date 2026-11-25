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
const RINGS := [0.0, 0.12, 0.24, 0.34, 0.42, 0.44, 0.455, 0.465, 0.474, 0.48, 0.49, 0.52, 0.54, 0.555, 0.57, 0.585, 0.6, 0.62,
	0.64, 0.655, 0.665, 0.674, 0.68, 0.69, 0.71, 0.735, 0.755, 0.77, 0.785, 0.8, 0.82, 0.835, 0.84, 0.855, 0.865, 0.874, 0.88, 0.91,
	0.935, 0.955, 0.97, 0.985, 1.0]
## (кольца 0,44–0,474 / 0,64–0,674 / 0,84–0,874 — у внутреннего края съездов: откос края — пологий у подножия, обрыв выше)
const ANG_N := 256
## затопленная яма на юге: центр, полуоси, глубина дна; уровень воды
const POND_C := Vector2(8, 55)
const POND_R := Vector2(10, 7.5)
const POND_D := -2.6
const WATER_Y := -1.4

const Q_BUILDINGS := [
	# общежитие №1: два этажа, оштукатуренное; коридор вдоль, комнаты по обе стороны, лестница в торце
	{"id": "dorm1", "n": "Общежитие рабочих", "kind": "dorm", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.42, "ov": 0.4, "chimney": false, "int": "int_beige1", "hall0": "hall_dorm",
		"blocks": [{"c": Vector2(-60, -50), "L": 30.0, "W": 11.0, "axis": "x", "floors": 2, "stairs": [-1], "hall": [3.0, 6.0], "entr": [["s+", 3.0, 1.6]], "wide": 0.3}],
		"types": {"*": [["room", 6], ["wc", 1], ["linen", 1]]}},
	# общежитие №2: деревянный барак — комнаты у западной стены, коридор к посёлку
	{"id": "dorm2", "n": "Общежитие №2", "kind": "dorm", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 3.0, "te": 0.18,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.5, "ov": 0.4, "shutters": false,
		"blocks": [{"c": Vector2(-76, 2), "L": 23.0, "W": 11.0, "axis": "z", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 6.2,
			"row": [["m_quarters", 5.6], ["m_quarters", 5.6], ["m_quarters", 5.6], ["wc", 5.6]], "hall_type": "m_hall",
			"entr": [["s+", -4.0, 1.4, "porch"], ["e-", 1.5, 1.1, "plain"]], "win_w": 1.1, "win_h": 1.1, "sill": 1.0}]},
	# столовая: обеденный зал, кухня, холодильная, кладовая
	{"id": "canteen", "n": "Столовая", "kind": "canteen", "style": "wood", "skin": "planks_brown", "int": "int_beige", "storey": 3.3, "te": 0.2, "plinth_h": 0.4,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.5, "ov": 0.4, "shutters": false,
		"blocks": [{"c": Vector2(-60, -24), "L": 24.0, "W": 13.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.8,
			"row": [["kitchen", 9.0], ["cold", 5.0], ["pantry", 5.0], ["wc", 4.6]], "hall_type": "dining",
			"entr": [["s+", 4.0, 1.6, "porch"], ["e+", 1.0, 1.1, "plain"]], "win_w": 1.4, "win_h": 1.2, "sill": 0.9}]},
	# медпункт: палата с кушетками, процедурная, кабинет фельдшера
	{"id": "med", "n": "Медпункт", "kind": "med", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.42, "ov": 0.4, "chimney": false, "int": "int_blue", "storey": 3.0,
		"blocks": [{"c": Vector2(-27, -50), "L": 15.0, "W": 10.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.2,
			"row": [["ward", 6.0], ["proc", 4.6], ["nurse", 4.0]], "hall_type": "hall_med",
			"entr": [["s+", -2.5, 1.4]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	# мастерская: большой цех с воротами, кладовая, техкомната, бытовка
	{"id": "workshop", "n": "Мастерская", "kind": "workshop", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.2, "te": 0.18,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.45, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-31, -16), "L": 24.0, "W": 14.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.6,
			"row": [["store", 7.6], ["tech", 7.6], ["staff", 8.4]], "hall_type": "workshop",
			"entr": [["s+", -3.0, 3.4, "plain"], ["e+", 1.5, 1.1, "plain"]], "win_w": 1.2, "win_h": 0.8, "sill": 1.6}]},
	# склад: широкие ворота, зал со стеллажами и проходами, кладовые у северной стены
	{"id": "warehouse", "n": "Склад", "kind": "warehouse", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 4.4, "te": 0.15,
		"roof_mat": "q_rust", "gable": "planks", "rise": 0.4, "ov": 0.35, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-44, 20), "L": 28.0, "W": 15.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 4.4,
			"row": [["store", 9.0], ["store", 9.0], ["store", 9.4]], "hall_type": "warehouse",
			"entr": [["s+", -5.0, 3.6, "plain"], ["s+", 8.0, 3.6, "plain"], ["e+", 2.0, 1.2, "plain"]], "win_w": 0.9, "win_h": 0.6, "sill": 2.2}]},
	# контора карьера: кабинет начальника, диспетчерская (радиостанция), архив; коридор вдоль фасада
	{"id": "office", "n": "Контора карьера", "kind": "office", "skin": "plaster", "roof": "gable", "roof_mat": "q_rust", "gable": "plaster", "rise": 0.42, "ov": 0.4, "chimney": false, "int": "int_beige1", "storey": 3.2,
		"blocks": [{"c": Vector2(-62, 40), "L": 20.0, "W": 12.0, "axis": "x", "floors": 1, "layout": "hall", "row_side": -1, "row_d": 5.4,
			"row": [["office", 7.0], ["m_radio", 6.4], ["archive", 6.2]], "hall_type": "m_hall",
			"entr": [["s+", 3.0, 1.4, "porch"]], "win_w": 1.2, "win_h": 1.2, "sill": 0.9}]},
	{"id": "shed1", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks_brown", "int": "int_wood", "storey": 2.7, "te": 0.12,
		"roof_mat": "q_rust", "gable": "planks_brown", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-20, 52), "L": 8.0, "W": 6.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s-", 0.0, 1.6, "plain"]], "blind": ["s+", "e-"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "shed2", "n": "Сарай", "kind": "shed", "style": "wood", "skin": "planks", "int": "int_wood", "storey": 2.6, "te": 0.12,
		"roof_mat": "q_tin", "gable": "planks", "rise": 0.45, "ov": 0.3, "shutters": false, "chimney": false,
		"blocks": [{"c": Vector2(-30, 58), "L": 7.0, "W": 5.0, "axis": "x", "floors": 1, "layout": "hall", "row": [], "hall_type": "shed",
			"entr": [["s-", 0.0, 1.4, "plain"]], "blind": ["s+", "e+"], "win_w": 0.7, "win_h": 0.5, "sill": 1.5}]},
	{"id": "garage", "n": "Гараж", "kind": "shed", "style": "box", "skin": "roof_tin", "int": "roof_tin", "storey": 3.2, "te": 0.08,
		"roof_mat": "q_rust", "gate_mat": "gmetal",
		"blocks": [{"c": Vector2(-82, 32), "L": 12.0, "W": 8.0, "axis": "z", "floors": 1, "layout": "hall", "row": [], "hall_type": "garage",
			"entr": [["s+", 0.0, 3.2, "gate"]], "blind": ["s-", "e+"]}]},
]

## дороги посёлка и подъезды к выработке (утоптанный щебень, колеи): ломаные
const Q_ROADS := [
	# въезд от КПП к выработке: восточнее склада и мастерской, к началу съезда на западной бровке
	[Vector2(-56, 82), Vector2(-56, 58), Vector2(-46, 50), Vector2(-26, 40), Vector2(-22, 26), Vector2(-14, 10), Vector2(-10, -4), Vector2(-5, -15)],
	# западная петля посёлка: контора, общежитие №2, столовая, общежитие №1
	[Vector2(-46, 50), Vector2(-49, 31), Vector2(-64, 30), Vector2(-66, 14), Vector2(-64, -4), Vector2(-58, -12), Vector2(-42, -32), Vector2(-40, -40)],
	# к медпункту — восточнее мастерской
	[Vector2(-14, 10), Vector2(-14, -26), Vector2(-24, -40)],
	# вдоль южной бровки — к дробильному цеху
	[Vector2(-26, 40), Vector2(-4, 44), Vector2(24, 46), Vector2(48, 50), Vector2(62, 46)],
	# вдоль северной бровки — к сторожевой вышке
	[Vector2(-10, -4), Vector2(-6, -40), Vector2(12, -60), Vector2(50, -62), Vector2(76, -54)],
	# к заправщику и гаражу
	[Vector2(-66, 14), Vector2(-76, 18), Vector2(-80, 26)],
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
	return hash(str(Q_BUILDINGS) + "|" + str(ULBlock.GEN_V) + "|q2")


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
## Внутренний край съезда — откос к нижней полке: у подножия, где съезд невысоко над полкой (до 0,6 м), — пологий
## (~30°, на него можно зайти с полки — иначе у края съезда оставалась ступенька 0,3–0,7 м, на которую герой не
## взбирался, хотя карта проходимости вела через неё); выше — всё круче (до 75°), то есть обрыв: со середины съезда
## на нижний уступ не сбежать.
static func ramp_h(s: float, th: float) -> float:
	var best := -INF
	for r in RAMPS:
		var k := int(r[0])
		var top: float = WALLS[k][0]
		var wd: float = r[3]
		if s > top + 0.002:
			continue
		var u := (th - float(r[1])) / (float(r[2]) - float(r[1]))
		if u < -0.03 or u > 1.03:
			continue
		var hr := lerpf(LV[k], LV[k + 1], clampf(u, 0.0, 1.0))
		if s >= top - wd:
			best = maxf(best, hr)
			continue
		var fl := terrace(s)
		var dh := hr - fl
		if dh <= 0.0:
			continue
		var g := lerpf(0.58, 3.7, clampf((dh - 0.6) / 0.6, 0.0, 1.0))
		var hs := hr - (top - wd - s) * 46.0 * g
		if hs > fl + 0.005:
			best = maxf(best, hs)
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
//#SUN_SHADOW
void fragment() {
	if (hole.z > 0.0 && wp.y > hole_y && -VERTEX.z < hole.w) {
		vec2 d = (SCREEN_UV - hole.xy) * vec2(VIEWPORT_SIZE.x / VIEWPORT_SIZE.y, 1.0);
		float r = length(d) / hole.z;
		if (r < 1.0 && dith(FRAGCOORD.xy) > smoothstep(0.62, 1.0, r)) { discard; }
	}
	// производные координат — до ветвлений: внутри них выборки идут с явным мип-уровнем
	vec2 uvx = dFdx(UV);
	vec2 uvy = dFdy(UV);
	vec2 px = dFdx(wp.xz);
	vec2 py = dFdy(wp.xz);
	float n1 = texture(noise, wp.xz / 37.0).r;
	float n2 = texture(noise, wp.xz / 9.0 + vec2(0.31, 0.77)).r;
	float wall = 1.0 - smoothstep(0.5, 0.78, wn.y);
	// Скала читается только на стенках, щебень и пыль — только на полках и съездах (раньше на каждой точке
	// читались все 13 текстур; выработка занимает почти весь экран, и на дне карьера это была половина кадра)
	vec3 r = vec3(0.0);
	vec3 nr = vec3(0.5, 0.5, 1.0);
	if (wall > 0.002) {
		float rs = rock_scale;
		float rs2 = rock_scale * 2.7;
		r = textureGrad(rock, UV / rs, uvx / rs, uvy / rs).rgb;
#ifndef PIT_LOW
		vec3 r2 = textureGrad(rock, UV / rs2 + vec2(0.37, 0.11), uvx / rs2, uvy / rs2).rgb;
		r = mix(r, r2, 0.4);
#endif
		// скала уступов по видео-образцу: тёмная холодная порода с ясным рисунком — столбы и вертикальные трещины,
		// слои по высоте, у верха каждого уступа — охристый выветренный край с осыпью
		r = mix(vec3(lum(r)), r, 0.45) * vec3(0.66, 0.7, 0.78);
		r = pow(r, vec3(1.25)) * 1.5;
		float colv = texture(noise, vec2(UV.x * 0.16, wp.y * 0.012)).r;
		r *= mix(0.72, 1.16, smoothstep(0.3, 0.7, colv));
		float cr = texture(noise, vec2(UV.x * 0.5, wp.y * 0.035) + vec2(0.13, 0.57)).r;
		float crack = 1.0 - smoothstep(0.0, 0.035, abs(cr - 0.5));
		r *= mix(1.0, 0.42, crack);
		float band = 0.5 + 0.5 * sin(wp.y * 2.3 + n1 * 3.0 + n2 * 1.5);
		float band2 = 0.5 + 0.5 * sin(wp.y * 7.1 + n2 * 4.0);
		r *= mix(0.7, 1.1, band) * mix(0.86, 1.06, band2);
		float seam = 1.0 - smoothstep(0.0, 0.07, abs(fract(wp.y * 0.62 + n1 * 0.9) - 0.5));
		r *= mix(1.0, 0.6, seam * 0.7);
		float hh = fract(-wp.y / 4.5 + 0.02);
		float top_w = (1.0 - smoothstep(0.0, 0.3, hh)) * smoothstep(0.25, 0.7, n2 * 0.6 + colv * 0.4 + 0.15);
		r = mix(r, vec3(0.5, 0.36, 0.22) * (0.75 + 0.5 * n2), top_w * 0.75);
#ifndef PIT_LOW_N
		nr = textureGrad(rock_n, UV / rs, uvx / rs, uvy / rs).rgb;
#endif
	}
	vec3 fl = vec3(0.0);
	vec3 nf = vec3(0.5, 0.5, 1.0);
	if (wall < 0.998) {
		float gs = gravel_scale;
		float gs2 = gravel_scale * 3.1;
		float gs3 = gravel_scale * 8.3;
		vec3 g = textureGrad(gravel, wp.xz / gs, px / gs, py / gs).rgb;
		vec3 g2 = textureGrad(gravel, wp.xz / gs2 + vec2(0.53, 0.21), px / gs2, py / gs2).rgb;
#ifndef PIT_LOW
		vec3 g3 = textureGrad(gravel, wp.xz / gs3 + vec2(0.17, 0.71), px / gs3, py / gs3).rgb;
		g = mix(mix(g, g2, 0.45 + 0.3 * (n2 - 0.5)), g3, 0.3);
#else
		g = mix(g, g2, 0.45 + 0.3 * (n2 - 0.5));
#endif
		g = mix(vec3(lum(g)), g, 0.55) * vec3(0.94, 0.91, 0.86) * 0.95;
		fl = g;
		float dw = smoothstep(0.64, 0.8, n1 * 0.75 + n2 * 0.25) * 0.5;
		if (dw > 0.001) {
			vec3 du = textureGrad(dust, wp.xz / 4.5, px / 4.5, py / 4.5).rgb;
			du = mix(vec3(lum(du)), du, 0.3) * vec3(0.92, 0.9, 0.86);
			fl = mix(g, du, dw);
		}
		fl *= mix(0.86, 1.06, smoothstep(0.25, 0.75, n1));
		// съезды (уклон) — накатанная песочная дорога; у подножия стенок — тёмная осыпь
		float ramp = smoothstep(0.9993, 0.994, wn.y) * (1.0 - wall);
		if (ramp > 0.002) {
			vec3 road_c = textureGrad(dust, wp.xz / 3.2, px / 3.2, py / 3.2).rgb;
			road_c = mix(vec3(lum(road_c)), road_c, 0.6) * vec3(1.08, 0.9, 0.7);
			fl = mix(fl, road_c, ramp * 0.8);
		}
#ifndef PIT_LOW_N
		nf = textureGrad(gravel_n, wp.xz / gs, px / gs, py / gs).rgb;
#endif
	}
	vec3 c = mix(fl, r, wall);
	float depth = clamp(-wp.y / 14.0, 0.0, 1.0);
	c *= mix(1.0, 0.84, depth) * mix(0.93, 1.05, n2);
	c *= mix(vec3(1.0), vec3(0.95, 0.97, 1.02), depth);
	ALBEDO = c;
	ALBEDO *= sun_shade(wp.xz);
	ROUGHNESS = wet_rough(mix(0.95, 0.86, wall));
	NORMAL_MAP = mix(nf, nr, wall);
	NORMAL_MAP_DEPTH = 1.3;
}
"""


func _pit_material() -> ShaderMaterial:
	var sm := ShaderMaterial.new()
	var sh := Shader.new()
	var code: String = PIT_SHADER if not bool(ULSettings.q().aniso) else PIT_SHADER.replace("filter_linear_mipmap,", "filter_linear_mipmap_anisotropic,")
	sh.code = ULSunShadow.with(code)
	sm.shader = sh
	# облегчённый вариант — вместе с быстрой землёй (ULGroundBake; «Низкая», настройка «Земля», подстройка):
	# без второй выборки скалы, третьей щебня и карт неровностей (у быстрой земли их тоже нет) — 4 чтения вместо 7
	# на точку; на дне выработки кадр короче на пятую часть (замер gperf)
	var shl := Shader.new()
	shl.code = ULSunShadow.with(code.replace("shader_type spatial;\n", "shader_type spatial;\n#define PIT_LOW\n#define PIT_LOW_N\n"))
	sm.set_meta("full", sh)
	sm.set_meta("fast", shl)
	w.ground_alt.append(sm)
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
			var road := 1.0 - smoothstep(2.4, 4.2, road_dist(p) + (n3 - 0.5) * 1.3)
			# у бровки и вокруг техники — пыльная утоптанная площадка
			var rim := 1.0 - smoothstep(1.0, 1.16, pit_st(p).x + (n2 - 0.5) * 0.06)
			# посёлок: утоптано у стен построек (дворы) и пятнами между ними; остальное — трава (по видео-образцу)
			var yard := 1.0 - smoothstep(2.5, 7.0, bld_dist(p) + (n3 - 0.5) * 3.0)
			var vil := clear_w(p) * maxf(yard * 0.8, smoothstep(0.52, 0.72, n1 * 0.5 + n2 * 0.5) * 0.55)
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


## деревьев — 220 (было 440): середину поля занимает выработка, и с уступов кромку леса видно почти всю — лес давал
## до 130 тыс. треугольников в кадре из бюджета 450 тыс.; опушки те же, но реже
func forest_n() -> int:
	return 220


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
	var rock: ArrayMesh = _rock_angular(53)
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
	rmi.material_override = _rock_mat()
	add_child(rmi)


var _rmat: StandardMaterial3D = null


## материал обломков породы — та же скала, что у стенок выработки
func _rock_mat() -> StandardMaterial3D:
	if _rmat == null:
		_rmat = ULHouse._mat(TEX + "quarry_wall", 1.6)
		_rmat.albedo_color = Color(0.74, 0.74, 0.76)
	return _rmat


## Угловатый обломок скалы: грубый многогранник (6 × 4 граней), вершины сдвинуты шумом, грани плоские —
## на свету каждая своим тоном (прежние «камни» осыпи были гладкими шарами)
func _rock_angular(seed_n: int, segs := 6, rings := 4) -> ArrayMesh:
	var sp := SphereMesh.new()
	sp.radius = 0.5
	sp.height = 1.0
	sp.radial_segments = segs
	sp.rings = rings
	var fn := FastNoiseLite.new()
	fn.seed = seed_n
	fn.frequency = 1.1
	var arr := sp.get_mesh_arrays()
	var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var moved := {}
	for i in vs.size():
		var v := vs[i]
		var key := Vector3i(roundi(v.x * 1000.0), roundi(v.y * 1000.0), roundi(v.z * 1000.0))
		if not moved.has(key):
			var k := 1.0 + 0.42 * fn.get_noise_3dv(v * 2.3) + 0.2 * fn.get_noise_3dv(v * 6.0)
			var nv := v * k
			nv.y = maxf(nv.y * 0.7, -0.14)
			moved[key] = nv
		vs[i] = moved[key]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(0xFFFFFFFF)                   # плоские грани
	var uv: PackedVector2Array = arr[Mesh.ARRAY_TEX_UV]
	for i in arr[Mesh.ARRAY_INDEX]:
		st.set_uv(uv[i] * Vector2(2.0, 1.0))
		st.add_vertex(vs[i])
	st.generate_normals()
	st.generate_tangents()
	return st.commit()


# ---------------- подробности по видео-образцу ----------------

## Подробности по видео-образцу (21.11): рваная кромка уступов, кристаллы у жил, столбы с проводами, мелочи у
## построек. У всего своя случайность — расстановка остального (и тайников) не сдвигается.
func _q_detail(g: Node3D) -> void:
	_q_brow_rocks(g)
	_q_crystals(g)
	_q_power_lines(g)
	_q_clutter()


## Рваная стенка уступов: глыбы торчат из верхней половины каждой стенки (ниже бровки) — ровная тёмная полоса
## стенки разбивается выступами и сколами. Выше головы героя и не выше бровки — без столкновений.
func _q_brow_rocks(g: Node3D) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 8807
	# глыбы — восемью секторами по кругу чаши: один общий набор рисовался целиком, стоило попасть в кадр любой
	# его части (43 тыс. треугольников и столько же в каждой карте теней)
	const SECT := 8
	var xs: Array = []
	for i in SECT:
		xs.append([])
	for wl in WALLS:
		var s0: float = wl[0]
		var s1: float = wl[1]
		var top := terrace(s0 + 0.004)
		var bot := terrace(s1 - 0.004)
		for k in 240:
			var th := rng.randf_range(-PI, PI)
			if on_ramp(pit_point(s0 + 0.01, th)) or on_ramp(pit_point(s1 - 0.01, th)) or ramp_h(s0 - 0.01, th) > bot + 0.3:
				continue
			# доля высоты стенки от бровки вниз: глыбы сидят в самой стенке (верх — ниже бровки), гуще под бровкой
			var f := 0.1 + pow(rng.randf(), 1.6) * 0.45
			var sz := rng.randf_range(0.6, 1.5)
			var q := pit_point(lerpf(s0, s1, f) + 0.006, th)
			var y := minf(lerpf(top, bot, f), top - sz * 0.45)
			var out := (q - PIT_C).normalized()
			var basis := Basis.from_euler(Vector3(rng.randf_range(-0.6, 0.6), rng.randf() * TAU, rng.randf_range(-0.6, 0.6)))
			var sect := clampi(int((th + PI) / TAU * SECT), 0, SECT - 1)
			(xs[sect] as Array).append(Transform3D(basis.scaled(Vector3(sz, sz * rng.randf_range(0.7, 1.1), sz * rng.randf_range(0.7, 1.0))), Vector3(q.x + out.x * 0.25, y, q.y + out.y * 0.25)))
	var rock := _rock_angular(91, 5, 3)             # 40 треугольников вместо 60: глыб сотни, а видны они краем кадра
	var bm := _rock_mat().duplicate() as StandardMaterial3D
	bm.albedo_color = Color(0.5, 0.52, 0.56)            # в тон тёмной породы стенки
	for si in SECT:
		var part: Array = xs[si]
		if part.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = rock
		mm.instance_count = part.size()
		for i in part.size():
			mm.set_instance_transform(i, part[i])
		var mi := MultiMeshInstance3D.new()
		mi.name = "BrowRocks%d" % si
		mi.multimesh = mm
		mi.material_override = bm
		# глыбы сидят в самой стенке: своей тени почти не видно, а в картах теней они стоили столько же, сколько в кадре
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		g.add_child(mi)


const CRYSTAL_TINTS := [[Color(0.42, 0.78, 1.0), Color(0.16, 0.48, 1.0)], [Color(0.38, 0.95, 0.86), Color(0.1, 0.6, 0.55)],
	[Color(0.72, 0.52, 1.0), Color(0.42, 0.2, 0.95)]]


## Друза кристаллов: шестигранные столбики с заострёнными концами, растут из одной точки веером (ось — вверх
## и наружу, по +z); грани плоские
static func crystal_mesh(seed_n: int) -> ArrayMesh:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	st.set_smooth_group(0xFFFFFFFF)
	var n := rng.randi_range(6, 9)
	for c in n:
		var main := c == 0
		var r := rng.randf_range(0.16, 0.22) if main else rng.randf_range(0.06, 0.15)
		var length := rng.randf_range(1.3, 1.7) if main else rng.randf_range(0.45, 1.1)
		var tilt := rng.randf_range(0.0, 0.25) if main else rng.randf_range(0.25, 0.85)
		var az := rng.randf() * TAU
		var dir := Vector3(sin(tilt) * cos(az), cos(tilt), sin(tilt) * sin(az) + 0.35).normalized()
		var base := Vector3(rng.randf_range(-0.22, 0.22), -0.15, rng.randf_range(-0.22, 0.22))
		var side := dir.cross(Vector3.RIGHT if absf(dir.x) < 0.9 else Vector3.FORWARD).normalized()
		var side2 := dir.cross(side).normalized()
		var ring0: Array[Vector3] = []
		var ring1: Array[Vector3] = []
		var tip := base + dir * length
		for k in 6:
			var a := TAU * float(k) / 6.0 + rng.randf_range(-0.12, 0.12)
			var o := (side * cos(a) + side2 * sin(a)) * r
			ring0.append(base + o)
			ring1.append(base + dir * length * 0.78 + o * 0.92)
		for k in 6:
			var k2 := (k + 1) % 6
			for v in [ring0[k], ring1[k], ring1[k2], ring0[k], ring1[k2], ring0[k2]]:
				st.set_uv(Vector2(float(k) / 6.0, 0.0))
				st.add_vertex(v)
			for v in [ring1[k], tip, ring1[k2]]:
				st.set_uv(Vector2(float(k) / 6.0, 1.0))
				st.add_vertex(v)
	st.generate_normals()
	return st.commit()


## Кристаллы у минеральных жил: три друзы растут из подножия ближней стенки (крупная по пояс и две поменьше), у каждой жилы
## свой цвет — голубой, бирюзовый, фиолетовый; светятся изнутри (самосвечение, источников света нет)
func _q_crystals(g: Node3D) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 5531
	var mats: Array[StandardMaterial3D] = []
	for t in CRYSTAL_TINTS:
		var m := StandardMaterial3D.new()
		m.albedo_color = t[0]
		m.roughness = 0.16
		m.metallic = 0.15
		m.emission_enabled = true
		m.emission = t[1]
		m.emission_energy_multiplier = 0.75
		mats.append(m)
	var meshes: Array[ArrayMesh] = []
	for k in 4:
		meshes.append(crystal_mesh(4100 + k))
	var vi := 0
	for dp in Q_DEPOSITS:
		if String(dp[4]) != "vein":
			continue
		var sv := float(dp[1])
		var th := float(dp[2])
		# ближняя стенка снаружи от жилы — её подножие
		var foot := 1.0
		for wl in WALLS:
			if float(wl[1]) > sv and float(wl[1]) < foot:
				foot = float(wl[1])
		if foot >= 1.0:
			foot = 1.0
		for j in 3:
			var big := j == 0
			var dth := (0.045 + rng.randf_range(0.0, 0.03)) * (1.0 if j != 1 else -1.0) * (1.8 if j == 2 else 1.0)
			var q := pit_point(foot + 0.006, th + dth)
			if on_ramp(q):
				continue
			var y := terrace(foot - 0.01)
			var inward := (PIT_C - q).normalized()
			var yaw := atan2(inward.x, inward.y)
			var sc := rng.randf_range(2.1, 2.6) if big else rng.randf_range(1.1, 1.6)
			var mi := MeshInstance3D.new()
			mi.mesh = meshes[(vi * 2 + j) % meshes.size()]
			mi.material_override = mats[vi % mats.size()]
			mi.transform = Transform3D(Basis(Vector3.UP, yaw).scaled(Vector3.ONE * sc), Vector3(q.x, y, q.y))
			g.add_child(mi)
			_cyl_col(Vector3(q.x + inward.x * 0.3 * sc, y, q.y + inward.y * 0.3 * sc), 0.45 * sc, 1.3 * sc)
		vi += 1


## Столбы с проводами вдоль въезда, западной петли посёлка и южной бровки: деревянный столб 6,5 м с траверсой и
## изоляторами, между столбами — два провода с провисом. Всё одной сеткой (один вызов отрисовки).
func _q_power_lines(g: Node3D) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var wst := SurfaceTool.new()
	wst.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n_poles := 0
	for ri in [0, 1, 3]:
		var road: Array = Q_ROADS[ri]
		var pts: Array[Vector3] = []
		var acc := 6.0
		for i in road.size() - 1:
			var a: Vector2 = road[i]
			var b: Vector2 = road[i + 1]
			var d := a.distance_to(b)
			var dirv := (b - a) / maxf(d, 0.001)
			var side := Vector2(-dirv.y, dirv.x) * 3.6
			var t := acc
			while t < d:
				var q := a + dirv * t + side
				t += 17.0
				if bld_dist(q) < 2.5 or pit_st(q).x < 1.07 or absf(q.x) > HX - 3.0 or absf(q.y) > HZ - 3.0 or road_dist(q) < 2.6:
					pts.append(Vector3.INF)              # разрыв линии: здесь столб не встаёт
					continue
				if _near_thing(q, 2.5):
					pts.append(Vector3.INF)
					continue
				pts.append(Vector3(q.x, height(q), q.y))
			acc = t - d
		var prev := Vector3.INF
		var prev_side := Vector3.ZERO
		for i in pts.size():
			var p := pts[i]
			if p == Vector3.INF:
				prev = Vector3.INF
				continue
			var nxt := pts[i + 1] if i + 1 < pts.size() and pts[i + 1] != Vector3.INF else Vector3.INF
			var along := (nxt - p) if nxt != Vector3.INF else ((p - prev) if prev != Vector3.INF else Vector3.RIGHT)
			along.y = 0.0
			along = along.normalized()
			var arm := Vector3(-along.z, 0, along.x)
			_pole(st, p, arm)
			_cyl_col(p, 0.16, 6.5)
			n_poles += 1
			if prev != Vector3.INF:
				for sgn in [-1.0, 1.0]:
					var a3: Vector3 = prev + prev_side * 0.62 * sgn + Vector3.UP * 6.28
					var b3: Vector3 = p + arm * 0.62 * sgn + Vector3.UP * 6.28
					_wire(wst, a3, b3, 0.55)
			prev = p
			prev_side = arm
	var wood := StandardMaterial3D.new()
	wood.albedo_color = Color(0.3, 0.23, 0.17)
	wood.roughness = 0.95
	var mi := MeshInstance3D.new()
	mi.name = "PowerPoles"
	st.generate_normals()
	mi.mesh = st.commit()
	mi.material_override = wood
	g.add_child(mi)
	var wire := StandardMaterial3D.new()
	wire.albedo_color = Color(0.08, 0.08, 0.08)
	wire.roughness = 0.6
	wire.cull_mode = BaseMaterial3D.CULL_DISABLED
	var wi := MeshInstance3D.new()
	wi.name = "PowerWires"
	wst.generate_normals()
	wi.mesh = wst.commit()
	wi.material_override = wire
	wi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	g.add_child(wi)
	print("[quarry] столбов с проводами: %d" % n_poles)


## рядом ли с точкой предмет из списка расстановки (техника, хлам, жилы)
func _near_thing(q: Vector2, r: float) -> bool:
	for lst in [Q_THINGS, Q_MACHINES]:
		for t in lst:
			var at := _at_spec(t[1])
			if Vector2(at.x, at.z).distance_to(q) < r + float(t[3]) * 0.5:
				return true
	return false


## столб: восьмигранный ствол с сужением, траверса, три изолятора
func _pole(st: SurfaceTool, p: Vector3, arm: Vector3) -> void:
	_prism(st, p, p + Vector3.UP * 6.5, 0.13, 0.1, 8)
	var c := p + Vector3.UP * 6.15
	_prism(st, c - arm * 0.8, c + arm * 0.8, 0.055, 0.055, 4)
	for k: float in [-0.62, 0.0, 0.62]:
		var ip: Vector3 = c + arm * k + (Vector3.UP * 0.05 if k != 0.0 else Vector3.UP * 0.28)
		_prism(st, ip, ip + Vector3.UP * 0.14, 0.035, 0.03, 6)


## труба (призма) от a до b, радиусы ra и rb, n граней
static func _prism(st: SurfaceTool, a: Vector3, b: Vector3, ra: float, rb: float, n: int) -> void:
	var dir := (b - a).normalized()
	var s1 := dir.cross(Vector3.RIGHT if absf(dir.x) < 0.9 else Vector3.FORWARD).normalized()
	var s2 := dir.cross(s1).normalized()
	for k in n:
		var a0 := TAU * float(k) / float(n)
		var a1 := TAU * float(k + 1) / float(n)
		var o0 := s1 * cos(a0) + s2 * sin(a0)
		var o1 := s1 * cos(a1) + s2 * sin(a1)
		for v in [a + o0 * ra, b + o0 * rb, b + o1 * rb, a + o0 * ra, b + o1 * rb, a + o1 * ra]:
			st.add_vertex(v)


## провод с провисом: 8 звеньев по цепной линии (приближённо — парабола), лента 3 см
static func _wire(st: SurfaceTool, a: Vector3, b: Vector3, sag: float) -> void:
	var n := 8
	var side := (b - a).cross(Vector3.UP).normalized() * 0.015
	for i in n:
		var t0 := float(i) / float(n)
		var t1 := float(i + 1) / float(n)
		var p0 := a.lerp(b, t0) - Vector3.UP * sag * 4.0 * t0 * (1.0 - t0)
		var p1 := a.lerp(b, t1) - Vector3.UP * sag * 4.0 * t1 * (1.0 - t1)
		for v in [p0 - side, p1 - side, p1 + side, p0 - side, p1 + side, p0 + side]:
			st.add_vertex(v)
		for v in [p0 + Vector3.UP * 0.015, p1 + Vector3.UP * 0.015, p1 - Vector3.UP * 0.015, p0 + Vector3.UP * 0.015, p1 - Vector3.UP * 0.015, p0 - Vector3.UP * 0.015]:
			st.add_vertex(v)


const Q_CLUTTER := [["ph_barrel", 0.9], ["ph_barrel", 0.9], ["ul_crate", 1.1], ["qr_pallets", 1.2], ["kh_sacks", 1.3], ["cv_jerrycans", 0.95]]


## Мелочи у построек: бочки, ящики, поддоны, мешки, канистры — по 2–3 у каждой постройки, у стены (не у дверей и
## не на дороге), со столкновением
func _q_clutter() -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 6619
	var n := 0
	for b in blds:
		var bb: ULBlock = b
		var want := rng.randi_range(2, 3)
		var tries := 0
		while want > 0 and tries < 40:
			tries += 1
			var blk: Dictionary = bb.def.blocks[rng.randi() % bb.def.blocks.size()]
			var c: Vector2 = blk.c
			var hl := float(blk.L) * 0.5
			var hw := float(blk.W) * 0.5
			var along_x := String(blk.axis) == "x"
			var u := rng.randf_range(-hl + 1.2, hl - 1.2)
			var sd := 1.0 if rng.randf() < 0.5 else -1.0
			var off := hw + rng.randf_range(0.9, 1.5)
			var q := c + (Vector2(u, off * sd) if along_x else Vector2(off * sd, u))
			if road_dist(q) < 2.6 or pit_st(q).x < 1.06 or _near_thing(q, 1.6) or bld_dist(q) < 0.6:
				continue
			var near_door := false
			for dd in bb.doors:
				if Vector2(dd.center.x, dd.center.z).distance_to(q) < 3.0:
					near_door = true
			if near_door:
				continue
			var it: Array = Q_CLUTTER[rng.randi() % Q_CLUTTER.size()]
			if _qm(String(it[0]), Vector3(q.x, 0, q.y), rng.randf() * TAU, float(it[1]), true) != Vector3.ZERO:
				want -= 1
				n += 1
	print("[quarry] мелочей у построек: %d" % n)


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
	ULBlock.lit_windows = 0.3                     # в посёлке карьера горит часть окон (как в видео-образце)
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
		if b.id == "warehouse":
			_q_warehouse(b)
		if b.id == "workshop":
			_q_workshop(b)
		_place_models(b)
	ULBlock.lit_windows = 0.0
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
	# колеи — сухие, укатанный щебень в тон дороги; не заходят в постройки и на край выработки
	ULGroundDetail.ruts(self, Q_ROADS, _noise_tex, "stony_dirt_path", 1.8, func(q: Vector2) -> bool:
		return bld_dist(q) > 2.0 and pit_st(q).x > 1.04 and ((q - POND_C) / POND_R).length() > 1.15, 0.0, Color(0.78, 0.76, 0.72))
	_q_scree(rng)
	_q_props(props, rng)
	_q_detail(props)
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


# ---------------- свет у жил, высота земли ----------------

## высота земли в точке — для пятен света у входов (общая часть — ULSanatorium._door_glows)
func ground_y(p: Vector2) -> float:
	return height(p)


## голубой отсвет у минеральных жил — к пятнам света у входов
func extra_glows() -> Array:
	var out: Array = []
	for dp in deposits:
		if String(dp.kind) != "vein":
			continue
		var p: Vector3 = dp.pos
		out.append([Transform3D(Basis(Vector3(7.5, 0, 0), Vector3.UP, Vector3(0, 0, 7.5)), Vector3(p.x, height(Vector2(p.x, p.z)) + 0.05, p.z)), Color(0.2, 0.5, 1.0, 0.0) * Color(0.5, 0.5, 0.5, 1.0)])
	return out


# ---------------- предметы и техника ----------------

## Склад: три ряда поперёк зала (паллеты, ящики, бочки, еврокубы, мешки) с проходами между рядами и напротив
## обоих ворот; модели — мебель постройки (скрываются вместе с интерьером), у каждой — столкновение.
## Зал: x −58…−30, z 16,9…27,5 (у северной стены — кладовые), ворота в южной стене на x −49 и −36.
const Q_WH_ROWS := [-55.0, -42.5, -31.6]
const Q_WH_ITEMS := [["qr_pallets", 1.3, 1.2], ["ul_crate", 1.1, 0.9], ["ph_barrel", 0.75, 0.95], ["qr_ibc", 1.2, 1.2], ["kh_sacks", 1.3, 0.7], ["ul_army_crate", 1.1, 0.6]]


func _q_warehouse(b: ULBlock) -> void:
	var rng := RandomNumberGenerator.new()
	rng.seed = 4411
	var kinds := Q_WH_ITEMS.filter(func(x): return ResourceLoader.exists(MODELS + String(x[0]) + ".glb"))
	if kinds.is_empty():
		return
	for x in Q_WH_ROWS:
		var z := 18.4
		while z < 24.8:
			var it: Array = kinds[rng.randi() % kinds.size()]
			var sz := float(it[1])
			var p := Vector3(float(x) + rng.randf_range(-0.12, 0.12), 0.2, z + sz * 0.5)
			b.models.append([String(it[0]), p, rng.randf_range(-0.15, 0.15) + (PI * 0.5 if rng.randf() < 0.5 else 0.0), Vector3(sz, float(it[2]), sz), "b0/n0", 0.0])
			_col_xf(Vector3(sz * 0.9, float(it[2]), sz * 0.9), Transform3D(Basis.IDENTITY, p + Vector3.UP * float(it[2]) * 0.5))
			# ярус сверху (паллеты и ящики — штабелем)
			if String(it[0]) in ["qr_pallets", "ul_crate"] and rng.randf() < 0.55:
				b.models.append([String(it[0]), p + Vector3.UP * float(it[2]), rng.randf_range(-0.2, 0.2), Vector3(sz * 0.92, float(it[2]), sz * 0.92), "b0/n0", 0.0])
			z += sz + rng.randf_range(0.05, 0.3)
	var nwh := 0
	for m in b.models:
		if String(m[4]) == "b0/n0" and Q_WH_ITEMS.any(func(x): return String(x[0]) == String(m[0])):
			nwh += 1
	print("[quarry] склад: рядов %d, предметов в рядах %d, всего моделей мебели %d" % [Q_WH_ROWS.size(), nwh, b.models.size()])

## Цех мастерской (зал 23,6 × 9 м): посередине — УАЗ на ремонте, разобранный двигатель, компрессор, генератор,
## барабан кабеля, шестерни, бочки, еврокуб; у ворот (x −37…−31) и у боковой двери — свободно. Модели — в группе
## помещения (видны изнутри), столкновения — коробками; машина, двигатель и барабан — тайники.
## [модель, где, поворот, место (вдоль, высота, вглубь), тайник, название]
const Q_WS_ITEMS := [
	["ul_uaz", Vector3(-39.6, 0.2, -13.6), PI * 0.5, Vector3(4.0, 2.0, 1.9), "uaz", "УАЗ на ремонте"],
	["qr_scrap2", Vector3(-28.4, 0.2, -13.8), 0.6, Vector3(2.0, 1.6, 2.0), "scrap", "Разобранный двигатель"],
	["qr_compressor", Vector3(-24.6, 0.2, -10.7), 0.0, Vector3(1.8, 1.2, 0.9), "", ""],
	["hm_generator", Vector3(-22.0, 0.2, -10.7), 0.0, Vector3(1.3, 1.0, 0.8), "", ""],
	["qr_cabledrum", Vector3(-41.4, 0.2, -10.6), 0.0, Vector3(1.2, 1.2, 1.0), "cable", "Барабан с кабелем"],
	["qr_scrap3", Vector3(-25.0, 0.2, -15.2), 1.2, Vector3(1.6, 1.0, 1.4), "", ""],
	["ph_barrel", Vector3(-41.6, 0.2, -15.9), 0.0, Vector3(0.6, 0.9, 0.6), "", ""],
	["ph_barrel", Vector3(-40.9, 0.2, -16.5), 0.4, Vector3(0.6, 0.9, 0.6), "", ""],
	["qr_ibc", Vector3(-29.4, 0.2, -10.5), 0.2, Vector3(1.1, 1.1, 1.1), "", ""],
]


func _q_workshop(b: ULBlock) -> void:
	var n := 0
	for it in Q_WS_ITEMS:
		if not ResourceLoader.exists(MODELS + String(it[0]) + ".glb"):
			continue
		var p: Vector3 = it[1]
		var sz: Vector3 = it[3]
		b.models.append([String(it[0]), p, float(it[2]), sz, "b0/n0", 0.0])
		var bx := Vector3(sz.x, sz.y, sz.z) if absf(sin(float(it[2]))) < 0.5 else Vector3(sz.z, sz.y, sz.x)
		_col_xf(bx * 0.9, Transform3D(Basis.IDENTITY, p + Vector3.UP * sz.y * 0.5))
		if String(it[4]) != "":
			_stash(p, bx, 0.0, String(it[4]), String(it[5]))
		n += 1
	print("[quarry] мастерская: в цехе %d предметов" % n)


## модель по длине (или высоте) на земле этого места (высота — из рельефа); нет файла — ничего не ставится
func _qm(id: String, at: Vector3, yaw: float, length: float, collide := true, by_height := false, tint := Color(0.86, 0.84, 0.8), along := false) -> Vector3:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		return Vector3.ZERO
	if along and _long_x(path):
		yaw -= PI * 0.5                  # yaw — куда смотрит длинная сторона; у модели она по x — доворот
	var p := Vector3(at.x, height(Vector2(at.x, at.z)) if at.y == 0.0 else at.y, at.z)
	var sz := _c_model_box(path, p, yaw, length, tint, id, collide, by_height)
	if length >= 6.0 and get_child_count() > 0:
		_cull(get_child(get_child_count() - 1), 85.0)      # техника и цеха: дальше камера их всё равно не показывает
	return sz


var _lx := {}


## длинная сторона модели — по x (иначе по z)
func _long_x(path: String) -> bool:
	if not _lx.has(path):
		if not _scenes.has(path):
			_scenes[path] = load(path)
		var n: Node3D = (_scenes[path] as PackedScene).instantiate()
		ULSanatorium.mute(n)
		var bb: AABB = w._aabb(n)
		n.free()
		_lx[path] = bb.size.x > bb.size.z
	return _lx[path]


## тайник вне помещений (техника, ящики, кучи): к обыску — по виду из data/quarry.json (loot)
func _stash(at: Vector3, size: Vector3, yaw: float, kind: String, n: String) -> void:
	var p := Vector3(at.x, height(Vector2(at.x, at.z)) if at.y == 0.0 else at.y, at.z)
	extra.append({"pos": p, "size": size, "yaw": yaw, "kind": kind, "n": n})


## точка на полке по доле радиуса и углу (с высотой рельефа)
static func pp(s: float, th: float) -> Vector3:
	var q := pit_point(s, th)
	return Vector3(q.x, height(q), q.y)


## техника: [модель, где (доля радиуса и угол — в выработке; Vector3 — в посёлке), поворот, длина, тайник (вид, название)]
const Q_MACHINES := [
	["qr_excavator", [0.3, 2.45], 0.6, 10.0, "machine", "Кабина экскаватора"],
	["qr_dumptruck", [0.22, 0.65], -0.9, 9.5, "machine", "Кабина карьерного самосвала"],
	["qr_loader", [0.36, -2.0], 2.2, 7.5, "machine", "Кабина погрузчика"],
	["qr_drill", [0.68, 0.45], 1.9, 8.0, "machine", "Кабина буровой установки"],
	["qr_excavator2", [0.68, 1.75], 0.2, 9.0, "machine", "Кабина экскаватора"],
	["qr_dumptruck2", [0.875, -0.5], 1.1, 9.0, "machine", "Кабина самосвала"],
	["qr_tanker", Vector3(-79, 0, 14), 1.57, 8.5, "truck", "Топливозаправщик"],
	["ul_bus", Vector3(-35, 0, 56), 0.35, 9.0, "cab", "Вахтовый автобус"],
	["ul_uaz", Vector3(-38, 0, 34), -0.6, 4.0, "uaz", "УАЗ начальника"],
	["ul_ural", Vector3(-12, 0, 32), 1.2, 7.4, "truck", "Кузов бортового «Урала»"],
	["ul_gaz66", Vector3(-70, 0, 26), 0.1, 5.6, "truck", "Кузов ГАЗ-66"],
]
## мелочь и оборудование: [модель, где, поворот, длина, по высоте?, тайник (вид, название) или ""]
const Q_THINGS := [
	["hm_generator", Vector3(-17, 0, -24), 0.3, 1.6, false, "crate", "Генератор"],
	["qr_compressor", Vector3(-15, 0, -9), 1.2, 2.6, false, "", ""],
	["qr_cabledrum", Vector3(-19, 0, -4), 0.0, 1.9, true, "cable", "Кабельный барабан"],
	["qr_cabledrum2", Vector3(-22, 0, -27), 0.8, 1.7, false, "cable", "Барабан с кабелем"],
	["qr_cabledrum", Vector3(58, 0, 24), 0.4, 1.9, true, "cable", "Кабельный барабан"],
	["qr_transformer", Vector3(-36, 0, -37), 0.0, 2.2, false, "", ""],
	["qr_ibc", Vector3(-48, 0, -30), 0.2, 1.2, false, "", ""],
	["qr_ibc", Vector3(-50, 0, -31.5), 1.4, 1.2, false, "", ""],
	["qr_pallets", Vector3(-31, 0, 32.5), 0.3, 1.2, false, "", ""],
	["qr_pallets", Vector3(-58, 0, 12), 1.2, 1.2, false, "", ""],
	["qr_scrap1", Vector3(-17, 0, -31), 0.7, 3.0, false, "scrap", "Груда металлолома"],
	["qr_scrap2", Vector3(52, 0, 42), 2.1, 3.5, false, "scrap", "Груда старой техники"],
	["qr_scrap3", [0.875, 2.2], 0.4, 3.0, false, "scrap", "Обломки горного оборудования"],
	["qr_scrap1", [0.4, 1.4], 2.9, 3.0, false, "scrap", "Груда металлолома"],
	["qr_concpipes", Vector3(56, 0, 60), 0.2, 3.2, false, "", ""],
	["qr_concpipes", Vector3(61, 0, 62), 1.6, 3.2, false, "", ""],
	["qr_concblocks", Vector3(40, 0, 59), 0.1, 2.4, false, "", ""],
	["qr_slabs", Vector3(26, 0, 60), 0.05, 6.0, false, "", ""],
	["qr_rails", Vector3(76, 0, 54), 1.3, 6.0, false, "", ""],
	["qr_sleepers", Vector3(80, 0, 49), 0.4, 2.6, false, "", ""],
	["qr_beams", Vector3(-12, 0, 42), 0.5, 5.0, false, "", ""],
	["qr_pipes", Vector3(-4, 0, 58), 2.8, 6.0, false, "", ""],
	["qr_cabin", Vector3(-14, 0, 24), 0.25, 6.0, false, "crate", "Бытовка"],
	["qr_cabin2", Vector3(-6, 0, 32), -0.1, 6.0, false, "crate", "Прорабская"],
	["qr_cabin", Vector3(74, 0, 34), 1.6, 6.0, false, "toolbox", "Бытовка дробильщиков"],
	["qr_toilet", Vector3(-20, 0, 30), 0.3, 2.3, true, "", ""],
	["qr_toilet", Vector3(-82, 0, -14), 1.5, 2.3, true, "", ""],
	["qr_shower", Vector3(-84, 0, -6), 1.5, 2.6, true, "", ""],
	["qr_canopy", Vector3(-70, 0, 16), 0.0, 6.0, false, "", ""],
	["qr_satdish", Vector3(-71, 0, 48), 2.6, 4.5, true, "", ""],
	["qr_radiotower", Vector3(-22, 0, -62), 0.2, 22.0, true, "", ""],
	["qr_floodlight", Vector3(-2, 0, -24), 0.0, 12.0, true, "", ""],
	["qr_floodlight", Vector3(58, 0, 34), 0.8, 12.0, true, "", ""],
	["qr_floodlight", Vector3(84, 0, -12), 1.5, 12.0, true, "", ""],
	["qr_booth", Vector3(-50, 0, 61), 1.57, 2.6, false, "desk", "Будка КПП"],
	["qr_barrier", Vector3(-56, 0, 57.5), PI * 0.5, 5.0, false, "", "", true],
	["qr_gravel1", [0.15, -2.6], 0.0, 6.0, false, "", ""],
	["qr_gravel2", [0.42, 2.0], 1.0, 9.0, false, "", ""],
	["qr_ridge1", [0.72, 2.6], 2.6, 8.0, false, "", ""],
	["qr_ridge2", [0.9, 1.6], 1.4, 6.0, false, "", ""],
	["qr_boulder1", [0.45, -0.3], 0.3, 2.6, false, "", ""],
	["qr_boulder2", [0.62, -2.6], 1.1, 2.2, false, "", ""],
	["qr_boulder1", Vector3(14, 0, 34), 2.0, 2.8, false, "", ""],
	["qr_ridge1", Vector3(4, 0, 30), 0.6, 8.0, false, "", ""],
	["ph_barrel", Vector3(-77, 0, 8), 0.0, 0.9, true, "", ""],
	["ph_barrel", Vector3(-78, 0, 9.2), 0.7, 0.9, true, "", ""],
	["ph_barrel", Vector3(-16, 0, -12), 1.1, 0.9, true, "", ""],
	["cv_jerrycans", Vector3(-81, 0, 10), 0.6, 0.95, false, "", ""],
	["kh_sacks", Vector3(-49, 0, -18), 0.3, 1.4, false, "food", "Мешки с крупой"],
	["ul_crate", Vector3(-33, 0, 30.5), 0.5, 1.2, false, "crate", "Ящик"],
	["ul_army_crate", Vector3(60, 0, 26), 1.0, 1.1, false, "crate", "Ящик с запчастями"],
]
## жилы (минералы) и кучи руды: [модель, доля радиуса, угол, длина, вид тайника]
const Q_DEPOSITS := [
	["qr_vein1", 0.53, 0.3, 2.4, "vein"], ["qr_vein2", 0.735, 2.75, 2.4, "vein"], ["qr_vein3", 0.94, 1.0, 2.4, "vein"],
	["qr_vein1", 0.94, -0.05, 2.2, "vein"], ["qr_vein2", 0.535, -2.4, 2.2, "vein"],
	["qr_ore1", 0.4, 1.15, 3.2, "ore_pile"], ["qr_ore2", 0.12, -2.0, 3.2, "ore_pile"], ["qr_ore3", 0.66, 1.2, 3.0, "ore_pile"],
	["qr_ore2", 0.86, -0.15, 3.0, "ore_pile"],
]
## задание «Последняя смена»: где могут быть следы рабочих (вид следа → места; в каждое посещение — одно из мест)
const Q_TRACES := {
	"remains": [[0.3, -1.3], [0.86, 0.5], [0.66, 2.3], Vector3(16, 0, -62)],
	"things": [Vector3(-9, 0, 27), Vector3(70, 0, 30), [0.9, -0.2], Vector3(-38, 0, 55)],
	"docs": [Vector3(-50.8, 0, 62.4), [0.45, 2.75], Vector3(-4, 0, -27), Vector3(76, 0, -46)],
}
const Q_SAMPLE_SPOTS := [Vector3(70, 0, 40), [0.7, 0.62], Vector3(-36.5, 0, 33.5)]


static func _at_spec(v) -> Vector3:
	if v is Array:
		return pp(float(v[0]), float(v[1]))
	var p: Vector3 = v
	return Vector3(p.x, height(Vector2(p.x, p.z)), p.z)


func _q_props(g: Node3D, rng: RandomNumberGenerator) -> void:
	for m in Q_MACHINES:
		var at := _at_spec(m[1])
		var size := _qm(String(m[0]), at, float(m[2]), float(m[3]), true)
		if size != Vector3.ZERO:
			_stash(at, size, float(m[2]), String(m[4]), String(m[5]))
	for t in Q_THINGS:
		var at := _at_spec(t[1])
		var size := _qm(String(t[0]), at, float(t[2]), float(t[3]), true, bool(t[4]), Color(0.86, 0.84, 0.8), t.size() > 7 and bool(t[7]))
		if size != Vector3.ZERO and String(t[5]) != "":
			_stash(at, size, float(t[2]), String(t[5]), String(t[6]))
	for dp in Q_DEPOSITS:
		var at := pp(float(dp[1]), float(dp[2]))
		var size := _qm(String(dp[0]), at, rng.randf() * TAU, float(dp[3]), true)
		if size != Vector3.ZERO:
			_stash(at, size, 0.0, String(dp[4]), "Минеральная жила" if String(dp[4]) == "vein" else "Куча руды")
			deposits.append({"pos": at, "kind": String(dp[4])})
	_q_crusher(g)
	_q_tower(g, Q_TOWER)
	_q_fences(g)
	_q_signs(g)
	_q_quest_props(rng)


## дробильный цех на юго-восточной бровке, к нему — конвейер с первого уступа; рядом — два силоса
func _q_crusher(g: Node3D) -> void:
	var size := _qm("qr_crusher", Q_CRUSHER, -2.4, 12.0, true)
	if size != Vector3.ZERO:
		_stash(Q_CRUSHER + Vector3(-4.5, 0, 3.5), Vector3(2.4, 1.6, 2.4), 0.0, "machine", "Пульт дробильного цеха")
	_qm("qr_silo", Vector3(78, 0, 30), 0.3, 10.0, true, true)
	_qm("qr_silo", Vector3(81, 0, 41), 1.1, 10.0, true, true)
	var a := pp(0.86, 0.95) + Vector3.UP * 1.0
	var b := Q_CRUSHER + Vector3(-3.5, 7.5, -5.0)
	_q_conveyor(g, a, b)


## конвейер: секции модели Tripo вдоль отрезка a → b (наклон — поворотом вокруг поперечной оси), опоры — столбы
func _q_conveyor(g: Node3D, a: Vector3, b: Vector3) -> void:
	var path := MODELS + "qr_conveyor.glb"
	var d := b - a
	var hl := Vector2(d.x, d.z).length()
	var n := maxi(int(round(d.length() / 10.0)), 1)
	var yaw := atan2(d.x, d.z)
	var pitch := atan2(d.y, hl)
	for i in n:
		var c := a + d * ((i + 0.5) / n)
		if ResourceLoader.exists(path):
			if not _scenes.has(path):
				_scenes[path] = load(path)
			var m: Node3D = (_scenes[path] as PackedScene).instantiate()
			ULSanatorium.mute(m)
			var bb: AABB = w._aabb(m)
			var long_x := bb.size.x > bb.size.z
			var k := (d.length() / n) / maxf(maxf(bb.size.x, bb.size.z), 0.01)
			var holder := Node3D.new()
			add_child(holder)
			holder.add_child(m)
			# длинная ось модели — вдоль +z держателя; центр модели — в начале координат
			m.position = -bb.get_center()
			if long_x:
				var piv := Node3D.new()
				holder.remove_child(m)
				holder.add_child(piv)
				piv.add_child(m)
				piv.rotation.y = PI * 0.5
			holder.scale = Vector3.ONE * k
			holder.basis = Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -pitch) * Basis.from_scale(Vector3.ONE * k)
			holder.position = c
			_dirty(m, "qr_conveyor", Color(0.86, 0.84, 0.8))
			_cull(holder, 70.0)
		else:
			_bx(g, "rust", Vector3(1.2, 0.5, d.length() / n), Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.RIGHT, -pitch), c))
		# опора до земли (столкновение — столб)
		var foot := Vector3(c.x, height(Vector2(c.x, c.z)), c.z)
		var hh := c.y - foot.y - 0.4
		if hh > 0.5:
			_bx(g, "rust", Vector3(0.3, hh, 0.3), _at(foot + Vector3.UP * hh * 0.5))
			_cyl_col(foot, 0.25, hh)


## смотровая вышка на бровке (как в конвое): площадка 3,8 м, марш с перилами, навес; ящик наблюдателя — тайник
func _q_tower(g: Node3D, c: Vector3) -> void:
	var hh := 3.3
	for sx in [-1.7, 1.7]:
		for sz in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.22, hh + 2.4, 0.22), _at(c + Vector3(sx, (hh + 2.4) * 0.5, sz)))
			_cyl_col(c + Vector3(sx, 0, sz), 0.14, hh)
	for k in 2:
		for sx in [-1.7, 1.7]:
			_bx(g, "wood", Vector3(0.08, 0.16, 4.6), Transform3D(Basis(Vector3.RIGHT, 0.75 * (1.0 if k == 0 else -1.0)), c + Vector3(sx, 1.65, 0)))
	_bx(g, "wood", Vector3(3.8, 0.14, 3.8), _at(c + Vector3(0, hh - 0.07, 0)), true)
	for e in [[Vector3(0, 0, -1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(0, 0, 1.85), Vector3(3.8, 0.08, 0.08)], [Vector3(1.85, 0, 0), Vector3(0.08, 0.08, 3.8)], [Vector3(-1.85, 0, 1.0), Vector3(0.08, 0.08, 1.8)]]:
		var sz: Vector3 = e[1]
		_bx(g, "wood", sz, _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 1.0)))
		_bx(g, "wood", Vector3(sz.x, 0.5, sz.z), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.35)))
		_col_xf(Vector3(maxf(sz.x, 0.1), 1.1, maxf(sz.z, 0.1)), _at(c + (e[0] as Vector3) + Vector3.UP * (hh + 0.55)))
	# марш: от земли (x = −7) к площадке (x = −1.9) — с запада, со стороны дороги
	var x0 := -1.9
	var x1 := -7.0
	var zc := -0.9
	var n := 18
	for i in n:
		var t0 := float(i) / n
		var xa := lerpf(x1, x0, t0)
		var xb := lerpf(x1, x0, t0 + 1.0 / n)
		_bx(g, "wood", Vector3(absf(xa - xb) + 0.02, 0.06, 1.4), _at(c + Vector3((xa + xb) * 0.5, hh * (t0 + 1.0 / n) - 0.03, zc)))
	for sz in [-0.75, 0.75]:
		_bx(g, "wood", Vector3(sqrt((x1 - x0) * (x1 - x0) + hh * hh), 0.2, 0.08), Transform3D(Basis(Vector3.FORWARD, atan2(hh, x0 - x1)), c + Vector3((x0 + x1) * 0.5, hh * 0.5 - 0.12, zc + sz)))
		_bx(g, "wood", Vector3(sqrt((x1 - x0) * (x1 - x0) + hh * hh), 0.06, 0.06), Transform3D(Basis(Vector3.FORWARD, atan2(hh, x0 - x1)), c + Vector3((x0 + x1) * 0.5, hh * 0.5 + 0.95, zc + sz)))
	var pts := PackedVector3Array()
	for z in [zc - 0.7, zc + 0.7]:
		pts.append(c + Vector3(x1, 0, z))
		pts.append(c + Vector3(x0, 0, z))
		pts.append(c + Vector3(x0, hh, z))
	var cs := CollisionShape3D.new()
	var sh := ConvexPolygonShape3D.new()
	sh.points = pts
	cs.shape = sh
	body.add_child(cs)
	_tower2_roof = Node3D.new()
	add_child(_tower2_roof)
	_bx(_tower2_roof, "rust", Vector3(4.6, 0.08, 4.6), _at(c + Vector3(0, hh + 2.45, 0)))
	_bx(_tower2_roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, -1.7)))
	_bx(_tower2_roof, "wood", Vector3(4.4, 0.1, 0.1), _at(c + Vector3(0, hh + 2.38, 1.7)))
	_flush(_tower2_roof)
	var cp := c + Vector3(1.2, hh, 1.2)
	_c_model_box(MODELS + "ul_army_crate.glb", cp, 0.3, 0.9, Color(0.85, 0.85, 0.8), "ul_army_crate", false)
	extra.append({"pos": cp, "size": Vector3(0.9, 0.45, 0.5), "yaw": 0.3, "kind": "acrate", "n": "Ящик наблюдателя"})


## заборы: бетонный — вдоль южного края посёлка (проезд у КПП открыт), сетчатый — по западной бровке выработки
func _q_fences(_g: Node3D) -> void:
	var x := -88.0
	while x < -28.0:
		if absf(x + 56.0) > 5.0:
			_qm("qr_concfence", Vector3(x + 2.0, 0, 66.5), PI * 0.5, 4.0, true, false, Color(0.86, 0.84, 0.8), true)
		x += 4.0
	var th := 1.95
	while th < 3.05:
		var a := pit_point(1.06, th)
		var b := pit_point(1.06, th + 0.07)
		var mid := (a + b) * 0.5
		_qm("qr_chainfence", Vector3(mid.x, 0, mid.y), atan2(b.x - a.x, b.y - a.y), a.distance_to(b) + 0.1, true, false, Color(0.86, 0.84, 0.8), true)
		th += 0.07


## вывески и знаки: щит на столбах, надпись — своим шрифтом (у Tripo надписи нечитаемы)
func _q_signs(g: Node3D) -> void:
	_sign(g, Vector3(-60.5, 0, 59), 0.0, "КАРЬЕР «ГРАНИТНЫЙ»\nвъезд по пропускам", Vector2(3.0, 1.1), Color(0.16, 0.3, 0.55), Color(0.95, 0.95, 0.92))
	_sign(g, Vector3(-36, 0, 2), 0.15, "← ОБЩЕЖИТИЕ   СТОЛОВАЯ\nКАРЬЕР →", Vector2(2.4, 0.8), Color(0.85, 0.82, 0.74), Color(0.12, 0.12, 0.12))
	_sign(g, Vector3(-10, 0, -20), 0.2, "ОПАСНАЯ ЗОНА\nведутся горные работы", Vector2(2.2, 0.9), Color(0.8, 0.12, 0.1), Color(1, 1, 0.95))
	_sign(g, Vector3(-4, 0, 50), 0.0, "ВНИМАНИЕ!\nОбрыв. Не подходить к бровке", Vector2(2.2, 0.9), Color(0.92, 0.75, 0.12), Color(0.08, 0.08, 0.08))
	_sign(g, Vector3(70, 0, -60), 0.0, "ОПАСНАЯ ЗОНА", Vector2(1.8, 0.6), Color(0.8, 0.12, 0.1), Color(1, 1, 0.95))
	_sign(g, Vector3(-55, 0, 34.5), 0.0, "КОНТОРА КАРЬЕРА\nграфик смен · техника безопасности", Vector2(2.6, 1.2), Color(0.26, 0.3, 0.26), Color(0.92, 0.92, 0.86))
	_sign(g, Vector3(-28, 0, -44.2), 0.0, "+ МЕДПУНКТ", Vector2(1.8, 0.55), Color(0.95, 0.95, 0.93), Color(0.8, 0.1, 0.1))


func _sign(g: Node3D, at: Vector3, yaw: float, text: String, size: Vector2, bg: Color, fg: Color) -> void:
	var b := Basis(Vector3.UP, yaw)
	var h := size.y + 1.0
	for sx in [-size.x * 0.4, size.x * 0.4]:
		_bx(g, "wood", Vector3(0.1, h + size.y * 0.5, 0.1), Transform3D(b, at + b * Vector3(sx, (h + size.y * 0.5) * 0.5, 0)))
	var board := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(size.x, size.y, 0.05)
	board.mesh = bm
	var mt := StandardMaterial3D.new()
	mt.albedo_color = bg
	mt.roughness = 0.8
	board.material_override = mt
	board.transform = Transform3D(b, at + Vector3.UP * h)
	add_child(board)
	var lb := Label3D.new()
	lb.text = text
	lb.font_size = 64
	var lines := text.split("\n")
	var chars := 1
	for ln in lines:
		chars = maxi(chars, ln.length())
	lb.pixel_size = minf(size.y * 0.78 / (64.0 * lines.size() * 1.2), size.x * 0.9 / (64.0 * 0.58 * chars))
	lb.modulate = fg
	lb.outline_size = 0
	lb.shaded = true
	lb.double_sided = false
	lb.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb.transform = Transform3D(b, at + Vector3.UP * h + b * Vector3(0, 0, 0.035))
	add_child(lb)
	_cull(board, 50.0)
	_cull(lb, 35.0)
	_cyl_col(at, 0.15, 1.5)


## задание: останки, личные вещи и документы рабочих во всех местах-кандидатах (обыскать можно все; в каждое
## посещение находка задания — в одном месте каждого вида), ящики с образцами (особая партия — в одном)
func _q_quest_props(rng: RandomNumberGenerator) -> void:
	quest_spots.clear()
	for kind in Q_TRACES:
		quest_spots[kind] = []
		for v in Q_TRACES[kind]:
			var at := _at_spec(v)
			var yaw := rng.randf() * TAU
			match String(kind):
				"remains":
					var sz := _qm("qr_remains", at, yaw, 1.9, false)
					_stash(at, sz if sz != Vector3.ZERO else Vector3(1.8, 0.4, 0.6), yaw, "q_remains", "Останки рабочего")
				"things":
					var sz := _qm("qr_helmet", at, yaw, 0.55, false)
					_stash(at, sz if sz != Vector3.ZERO else Vector3(0.6, 0.3, 0.5), yaw, "q_things", "Каска и вещи рабочего")
				"docs":
					var sz := _qm("ul_crate", at, yaw, 0.7, false)
					_stash(at, sz if sz != Vector3.ZERO else Vector3(0.7, 0.4, 0.5), yaw, "q_docs", "Бумаги на ящике")
			quest_spots[kind].append(extra.size() - 1)
	quest_spots["samples"] = []
	for v in Q_SAMPLE_SPOTS:
		var at := _at_spec(v)
		var sz := _qm("qi_samplebox", at, rng.randf() * TAU, 1.0, true)
		_stash(at, sz if sz != Vector3.ZERO else Vector3(1.0, 0.5, 0.6), 0.0, "samples", "Ящик с образцами породы")
		quest_spots["samples"].append(extra.size() - 1)


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


## тайники: в помещениях (общее) и вне их — техника, ящики, жилы, кучи руды; находки задания «Последняя смена» —
## каждое посещение по-новому: по одному следу каждого вида, журнал — в диспетчерской конторы, особые образцы —
## в одном из ящиков с образцами
var quest_where := {}                   ## что задания где лежит в это посещение: предмет → индекс тайника


func roll_containers(rng: RandomNumberGenerator) -> void:
	super.roll_containers(rng)
	quest_where.clear()
	var base := containers.size() - extra.size()          # тайники вне помещений идут после тайников в постройках
	for pair in [["remains", "q_tag"], ["things", "q_photo"], ["docs", "q_pass"], ["samples", "q_samples"]]:
		var spots: Array = quest_spots.get(pair[0], [])
		if spots.is_empty():
			continue
		var ci: int = base + int(spots[rng.randi() % spots.size()])
		ULInventory.put(containers[ci].items, ULItems.make(String(pair[1]), 1))
		quest_where[pair[1]] = ci
	# журнал диспетчера: тайник в диспетчерской (по плану конторы — вторая комната ряда у северной стены)
	var room := Rect2(-65.0, 34.0, 6.4, 5.4)
	var best := -1
	var bd := 1e9
	for i in containers.size():
		var ct: Dictionary = containers[i]
		if String(ct.get("bld", "")) != "office":
			continue
		var p: Vector3 = ct.pos
		var d := room.get_center().distance_to(Vector2(p.x, p.z)) + (0.0 if room.grow(0.3).has_point(Vector2(p.x, p.z)) else 10.0)
		if d < bd:
			bd = d
			best = i
	if best >= 0:
		ULInventory.put(containers[best].items, ULItems.make("q_journal", 1))
		quest_where["q_journal"] = best


## хлам и минералы: в постройках — кучки хлама; у жил и куч руды — минералы на земле (вид предмета — по месту)
func junk_points(rng: RandomNumberGenerator) -> Array:
	var out := junk_in_buildings(rng)
	var mn: Array = conf().get("minerals", [10, 16])
	var n := rng.randi_range(int(mn[0]), int(mn[1]))
	for k in n:
		if deposits.is_empty():
			break
		var dp: Dictionary = deposits[rng.randi() % deposits.size()]
		var a := rng.randf() * TAU
		# дальше края жилы (её тайник — 1,2 м вокруг): находку на земле видно и можно поднять отдельно
		var p: Vector3 = (dp.pos as Vector3) + Vector3(cos(a), 0, sin(a)) * rng.randf_range(3.0, 4.4)
		p.y = height(Vector2(p.x, p.z)) + 0.02
		if absf(p.y - (dp.pos as Vector3).y) > 0.3 or on_ramp(Vector2(p.x, p.z)) or not _flat(p, 1.6):
			continue
		var r := rng.randf()
		var id := "ore" if String(dp.kind) == "ore_pile" else ("rare_mineral" if r < 0.06 else ("mineral_sample" if r < 0.5 else "rock_sample"))
		out.append([p, id, 1 if id != "ore" else rng.randi_range(1, 3)])
	# у техники — запчасти и кабель
	for m in Q_MACHINES:
		if rng.randf() < 0.55:
			var at := _at_spec(m[1])
			var a := rng.randf() * TAU
			var p := at + Vector3(cos(a), 0, sin(a)) * rng.randf_range(4.5, 6.0)
			p.y = height(Vector2(p.x, p.z)) + 0.02
			if absf(p.y - at.y) < 0.3 and bld_dist(Vector2(p.x, p.z)) > 0.8 and not on_ramp(Vector2(p.x, p.z)) and _flat(p, 1.6):
				out.append([p, ["spare_parts", "cable", "scrap_metal", "tech_junk"][rng.randi() % 4], 1])
	return out


## ровное место на r м вокруг (не у бровки уступа): находку на краю обрыва не достать — герой там не стоит
func _flat(p: Vector3, r: float) -> bool:
	for k in 8:
		var a := k * TAU / 8.0
		if absf(height(Vector2(p.x + cos(a) * r, p.z + sin(a) * r)) + 0.02 - p.y) > 0.3:
			return false
	return true


## герой на вышке — её навес скрыт
func tick(hero: Vector3, cam, delta: float) -> void:
	super.tick(hero, cam, delta)
	if _tower2_roof != null:
		var on := not (hero.y > 2.2 and Vector2(hero.x - Q_TOWER.x, hero.z - Q_TOWER.z).length() < 3.2)
		if on != _tower2_roof.visible:
			_tower2_roof.visible = on
