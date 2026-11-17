class_name ULBlock
extends Node3D
## Корпус санатория — многоэтажное здание из одного или нескольких прямоугольных блоков, полностью проходимое.
## Блок — коридорный (коридор вдоль длинной оси, комнаты по обе стороны, лестничные клетки в торцах, вестибюль у
## входа) или зальный (большой зал и ряд комнат вдоль одной стены: столовая, котельная, хозблок). Окна — ровным
## шагом по фасаду, одинаково на всех этажах; перегородки комнат — между окнами. Лестница — марши «туда-обратно»
## по сторонам клетки: между этажами в перекрытии проём над маршем, вокруг — перила.
## Каждая часть здания лежит в своей группе (этаж × что): наружные стены со стороны камеры и с обратной стороны,
## стены внутри (их срезают), внутренности (пол, мебель, двери), лестница, крыша. Герой снаружи — видны фасады и
## крыши, внутренности скрыты (окна — тёмное стекло). Герой внутри на этаже k — крыша и всё выше k скрыто, ниже k —
## только фасады; на этаже k стены внутри и фасад со стороны камеры срезаны на высоте CUT (видно комнаты).
## Внутренности на слое отрисовки 2: солнце их не освещает (ULSanatorium гасит слой 2 у солнца) — свет внутри от
## неба и ламп рядом с героем.
## Мебель — из деталей (кровати, тумбочки, шкафы, столы, стеллажи…) с простыми столкновениями. Часть мебели —
## тайники (containers): тумбочки, медицинские шкафы, шкафчики персонала, столы, ящики, кухонные шкафы.

const STOREY := 3.3
const SLAB := 0.2
const TE := 0.3                   ## толщина наружной стены
const TI := 0.12                  ## перегородки
const DW := 1.1                   ## ширина двери
const DH := 2.15
const SB := 7.4                   ## длина лестничной клетки: 1,1 м перед маршем + марш 5 м + площадка 1,3 м
const RUN := 5.0                  ## марш: длина и ширина
const FW := 1.35
const CUT := 1.2                  ## на какой высоте срезаны стены этажа, где герой
const CW := 2.4                   ## ширина коридора
const PITCH := 3.25               ## шаг окон
const GEN_V := 4                  ## версия генератора: менять при любой правке сборки корпусов (иначе возьмётся старый кэш)

const SHADER_BODY := """
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D albedo2 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D paint_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform bool has_normal = false;
uniform bool has_second = false;
uniform bool paint = false;
uniform float scale = 1.5;
uniform vec4 tint : source_color = vec4(1.0);
uniform vec4 tint2 : source_color = vec4(1.0);
uniform vec4 paint_tint : source_color = vec4(0.6, 0.78, 0.8, 1.0);
uniform float grime = 1.0;
uniform float rough = 0.88;
uniform float metal = 0.0;
uniform float sat = 1.0;
uniform float second_bias = 0.0;
uniform float streaks = 0.0;
uniform float rusty = 0.0;
uniform float storey = 3.3;
uniform float cut_y = 1000.0;
uniform vec4 hole = vec4(0.5, 0.5, 0.0, 0.0);
uniform float hole_y = -100.0;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
float dith(vec2 fc) { return fract(52.9829189 * fract(dot(fc, vec2(0.06711056, 0.00583715)))); }
void fragment() {
#ifdef CUT
	if (wpos.y > cut_y) { discard; }
#endif
	// окно вокруг героя: всё, что между ним и камерой и выше его ног, растворяется кругом
	if (hole.z > 0.0 && wpos.y > hole_y && -VERTEX.z < hole.w) {
		vec2 d = (SCREEN_UV - hole.xy) * vec2(VIEWPORT_SIZE.x / VIEWPORT_SIZE.y, 1.0);
		float r = length(d) / hole.z;
		if (r < 1.0 && dith(FRAGCOORD.xy) > smoothstep(0.62, 1.0, r)) { discard; }
	}
	vec3 an = abs(wnrm);
	vec2 uv;
	if (an.y > 0.6) { uv = wpos.xz; }
	else if (an.x > an.z) { uv = vec2(wpos.z, -wpos.y); }
	else { uv = vec2(wpos.x, -wpos.y); }
	uv /= scale;
	vec3 c = texture(albedo_tex, uv).rgb;
	// против повтора: та же текстура в крупном масштабе — светлота пятнами по 4–6 плиток (доски и кирпич не
	// поворачиваются, поэтому без второй выборки «вкось»)
	float macro = dot(texture(albedo_tex, uv * 0.21 + vec2(0.37, 0.61)).rgb, vec3(0.3, 0.59, 0.11));
	float mean = dot(textureLod(albedo_tex, vec2(0.5), 10.0).rgb, vec3(0.3, 0.59, 0.11));
	c *= clamp(mix(1.0, macro / max(mean, 0.05), 0.4), 0.7, 1.3);
	c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, sat) * tint.rgb;
	float n = texture(noise, wpos.xz / 5.0 + vec2(wpos.y * 0.11, -wpos.y * 0.07)).r;
	float hy = paint ? mod(wpos.y + 0.02, storey) : wpos.y;
	if (paint && an.y < 0.6) {
		// стены внутри: снизу масляная краска (облупилась), сверху побелка, по границе — тёмная полоса
		float g = dot(texture(paint_tex, uv * 1.3).rgb, vec3(0.3, 0.59, 0.11));
		vec3 pc = vec3(g) * paint_tint.rgb * 1.75;
		float edge = 1.5 + (texture(noise, uv * 0.3).r - 0.5) * 0.02;
		c = hy < edge ? pc : c;
		c *= 1.0 - 0.45 * (1.0 - smoothstep(0.0, 0.03, abs(hy - edge)));
	}
	if (has_second) {
		float r2 = smoothstep(0.3, 0.72, n * 0.6 + texture(noise, uv * vec2(0.9, 0.18)).r * 0.4 + second_bias);
		vec3 c2 = texture(albedo2, uv).rgb;
		c2 = mix(vec3(dot(c2, vec3(0.3, 0.59, 0.11))), c2, 0.62) * tint2.rgb;
		c = mix(c, c2, r2);
	}
	// у пола и земли — темнее и грязнее; на фасаде — потёки сверху
	float low = (1.0 - smoothstep(0.0, 0.7 + n * 0.8, hy)) * (an.y > 0.6 ? 0.2 : 1.0);
	c *= mix(1.0, 0.55, low * grime);
	if (streaks > 0.0 && an.y < 0.6) {
		float s = texture(noise, vec2((wpos.x + wpos.z) * 0.37, wpos.y * 0.015)).r;
		c *= 1.0 - streaks * 0.35 * smoothstep(0.45, 0.85, s);
	}
	c = mix(c, c * vec3(0.78, 0.88, 0.66), smoothstep(0.62, 0.84, n) * 0.4 * grime * (1.0 - smoothstep(1.0, 2.6, hy)));
	if (rusty > 0.0) {
		// ржавчина на жести: пятна и полосы, вытянутые вдоль ската
		float rp = texture(noise, vec2(wpos.x * 0.35, wpos.z * 0.35) + vec2(wpos.y * 0.9, 0.0)).r;
		float rs = texture(noise, vec2((wpos.x - wpos.z) * 0.9, (wpos.x + wpos.z) * 0.08)).r;
		float r = smoothstep(0.55, 0.78, rp * 0.6 + rs * 0.4);
		c = mix(c, c * vec3(0.95, 0.55, 0.32) + vec3(0.06, 0.02, 0.0), r * rusty);
	}
	c *= mix(0.88, 1.06, texture(noise, wpos.xz / 23.0 + wpos.y * 0.013).r);
	ALBEDO = c;
	if (has_normal) { NORMAL_MAP = texture(normal_tex, uv).rgb; }
	ROUGHNESS = rough;
	METALLIC = metal;
#ifdef CUT
	if (!FRONT_FACING) { ALBEDO = vec3(0.07, 0.065, 0.06); ROUGHNESS = 1.0; METALLIC = 0.0; }
#endif
}"""

## материалы: текстура (assets/world/tex/<имя>_c.jpg), размер плитки текстуры, м, оттенок, грязь, шероховатость
const MATS := {
	"facade": ["rectangular_facade_tiles", 2.0, Color(1.55, 1.5, 1.4), 0.9, 0.86, {"streaks": 1.0, "sat": 0.7}],
	"facade2": ["worn_plaster_wall", 1.8, Color(1.0, 0.97, 0.9), 0.9, 0.88, {"streaks": 1.0, "sat": 0.45}],
	"plaster": ["worn_plaster_wall", 1.8, Color(1.02, 0.98, 0.92), 0.8, 0.9, {"streaks": 0.7}],
	"brick": ["brick_4", 1.6, Color(0.85, 0.72, 0.64), 1.0, 0.9, {"streaks": 0.6}],
	"plinth": ["damaged_concrete_floor", 2.4, Color(0.66, 0.64, 0.6), 1.0, 0.92, {}],
	"trim": ["worn_plaster_wall", 2.6, Color(0.92, 0.9, 0.86), 0.5, 0.9, {"sat": 0.4}],
	"roof": ["worn_asphalt", 2.0, Color(0.62, 0.62, 0.6), 0.2, 0.92, {"sat": 0.15, "second": "mud_forest", "tint2": Color(0.8, 0.85, 0.62), "bias": -0.08}],
	"slab": ["damaged_concrete_floor", 2.6, Color(1.05, 1.02, 0.97), 0.4, 0.92, {}],
	"int_blue": ["worn_plaster_wall", 1.8, Color(0.94, 0.94, 0.9), 0.6, 0.9, {"paint": Color(0.6, 0.76, 0.78), "sat": 0.3}],
	"int_green": ["worn_plaster_wall", 1.8, Color(0.94, 0.94, 0.9), 0.6, 0.9, {"paint": Color(0.55, 0.7, 0.55), "sat": 0.3}],
	"int_beige": ["worn_plaster_wall", 1.8, Color(0.95, 0.93, 0.88), 0.6, 0.9, {"paint": Color(0.8, 0.68, 0.52), "sat": 0.3}],
	"int_grey": ["worn_plaster_wall", 1.8, Color(0.9, 0.9, 0.88), 0.8, 0.9, {"paint": Color(0.55, 0.6, 0.62), "sat": 0.3}],
	"int_beige1": ["worn_plaster_wall", 1.8, Color(0.95, 0.93, 0.88), 0.6, 0.9, {"paint": Color(0.8, 0.68, 0.52), "sat": 0.3, "storey": 1000.0}],
	"int_grey1": ["worn_plaster_wall", 1.8, Color(0.9, 0.9, 0.88), 0.8, 0.9, {"paint": Color(0.55, 0.6, 0.62), "sat": 0.3, "storey": 1000.0}],
	"tile_wall": ["long_white_tiles", 1.27, Color(0.9, 0.9, 0.86), 0.6, 0.5, {}],
	"lino": ["old_linoleum_flooring_01", 1.99, Color(0.78, 0.66, 0.56), 0.2, 0.75, {"sat": 0.55}],
	"tiles": ["worn_tile_floor", 2.0, Color(1.55, 1.5, 1.42), 0.2, 0.7, {"sat": 0.6}],
	"ktiles": ["dirty_tiles", 2.26, Color(1.05, 0.95, 0.9), 0.2, 0.6, {"sat": 0.7}],
	"parquet": ["herringbone_parquet", 2.2, Color(0.72, 0.62, 0.52), 0.2, 0.75, {"sat": 0.8}],
	"concrete": ["concrete_floor_worn_001", 3.0, Color(1.25, 1.22, 1.18), 0.4, 0.9, {}],
	"wood": ["brown_planks_03", 1.4, Color(0.78, 0.6, 0.45), 0.2, 0.8, {}],
	"door": ["old_planks_02", 1.6, Color(0.95, 0.9, 0.82), 0.3, 0.85, {"sat": 0.35}],
	"frame": ["worn_plaster_wall", 2.0, Color(0.95, 0.94, 0.9), 0.3, 0.8, {"sat": 0.2}],
	"metal": ["rusty_metal_02", 1.0, Color(0.78, 0.76, 0.74), 0.1, 0.55, {"metal": 0.5, "sat": 0.75}],
	"wmetal": ["rusty_metal_02", 1.4, Color(1.1, 1.12, 1.1), 0.1, 0.5, {"metal": 0.2, "sat": 0.12}],
	"gmetal": ["rusty_metal_02", 1.4, Color(0.62, 0.72, 0.66), 0.1, 0.55, {"metal": 0.3, "sat": 0.15}],
	"fabric": ["worn_plaster_wall", 1.0, Color(0.86, 0.84, 0.78), 0.0, 1.0, {"sat": 0.2}],
	"blanket": ["worn_plaster_wall", 1.0, Color(0.55, 0.42, 0.36), 0.0, 1.0, {"sat": 0.2}],
	"leather": ["worn_plaster_wall", 1.2, Color(0.42, 0.3, 0.22), 0.0, 0.7, {"sat": 0.3}],
	"green": ["worn_plaster_wall", 1.0, Color(0.25, 0.42, 0.26), 0.0, 0.95, {"sat": 0.2}],
	"rust": ["rusty_corrugated_iron", 1.4, Color(1.2, 1.15, 1.1), 0.2, 0.7, {"sat": 0.62}],
	"canvas": ["worn_plaster_wall", 2.2, Color(0.46, 0.5, 0.33), 0.5, 0.96, {"sat": 0.25, "streaks": 0.6}],
	"canvas_in": ["worn_plaster_wall", 2.2, Color(0.6, 0.62, 0.46), 0.3, 0.96, {"sat": 0.25}],
	"armygreen": ["rusty_metal_02", 1.6, Color(0.5, 0.58, 0.42), 0.5, 0.6, {"metal": 0.3, "sat": 0.15, "streaks": 0.8}],
	"panel": ["worn_plaster_wall", 2.4, Color(0.78, 0.8, 0.74), 0.3, 0.8, {"sat": 0.2}],
	"sand": ["worn_plaster_wall", 0.8, Color(0.74, 0.66, 0.5), 0.6, 1.0, {"sat": 0.3}],
	"bark": ["bark_brown_02", 0.9, Color(0.8, 0.76, 0.7), 0.4, 1.0, {}],
	"red": ["worn_plaster_wall", 1.0, Color(0.78, 0.13, 0.1), 0.0, 0.9, {"sat": 0.15}],
	"rubble": ["damaged_concrete_floor", 1.2, Color(0.75, 0.72, 0.68), 0.6, 0.95, {"second": "brick_4", "tint2": Color(0.9, 0.75, 0.66), "bias": -0.1}],
	# хутор: обшивка досками (серая, крашеная голубая и зелёная, бурая), ставни, рамы, полы, крыши, земля погребов
	"planks": ["weathered_plank_siding", 1.6, Color(1.3, 1.24, 1.14), 0.35, 0.92, {"streaks": 0.5, "sat": 0.7}],
	"planks_blue": ["weathered_plank_siding", 1.6, Color(0.95, 0.95, 0.92), 0.5, 0.9, {"paint": Color(0.33, 0.5, 0.66), "sat": 0.55, "storey": 1000.0}],
	"planks_green": ["weathered_plank_siding", 1.6, Color(0.95, 0.95, 0.92), 0.5, 0.9, {"paint": Color(0.42, 0.56, 0.42), "sat": 0.5, "storey": 1000.0}],
	"planks_brown": ["weathered_brown_planks", 1.5, Color(1.15, 1.05, 0.95), 0.35, 0.92, {"streaks": 0.4}],
	"shutter": ["old_planks_02", 1.0, Color(0.95, 0.95, 0.92), 0.4, 0.9, {"paint": Color(0.3, 0.46, 0.68), "sat": 0.6, "storey": 1000.0}],
	"wframe": ["old_planks_02", 2.0, Color(1.25, 1.24, 1.2), 0.3, 0.85, {"sat": 0.12}],
	"floorboard": ["old_planks_02", 1.4, Color(0.8, 0.68, 0.55), 0.3, 0.85, {}],
	"int_wood": ["wood_planks_grey", 1.5, Color(1.35, 1.22, 1.06), 0.25, 0.9, {"sat": 0.6}],
	"roof_tin": ["worn_corrugated_iron", 1.6, Color(0.82, 0.82, 0.8), 0.3, 0.6, {"metal": 0.3, "sat": 0.4, "rusty": 0.85}],
	# сруб: бревно (окорённое, серое от времени) и тёмная щель на месте выпавшей доски обшивки
	"logs": ["weathered_brown_planks", 1.1, Color(0.95, 0.86, 0.74), 0.7, 0.95, {"sat": 0.55}],
	"gapwood": ["old_planks_02", 1.0, Color(0.16, 0.13, 0.11), 0.0, 1.0, {}],
	"shingle": ["weathered_brown_planks", 0.9, Color(0.62, 0.58, 0.54), 0.5, 0.95, {"sat": 0.3}],
	"earth": ["brown_mud_02", 1.6, Color(0.72, 0.64, 0.54), 0.2, 1.0, {}],
	"cellar_wall": ["worn_plaster_wall", 1.6, Color(1.3, 1.18, 1.0), 0.35, 0.95, {"streaks": 0.45, "sat": 0.5}],
	"cellar_floor": ["damaged_concrete_floor", 2.2, Color(1.5, 1.3, 1.05), 0.4, 0.95, {}],
	"potato": ["dry_ground_01", 0.45, Color(1.35, 1.05, 0.72), 0.0, 1.0, {}],
}
## какие материалы срезаются на этаже героя (стены и двери)
const CUTTABLE := ["facade", "facade2", "plaster", "brick", "plinth", "trim", "int_blue", "int_green", "int_beige", "int_grey", "int_beige1", "int_grey1", "tile_wall", "door", "frame", "slab", "wood", "metal", "wmetal", "gmetal", "glass", "canvas", "canvas_in", "armygreen", "panel", "rust", "planks", "planks_blue", "planks_green", "planks_brown", "int_wood", "shutter", "wframe", "earth", "cellar_wall", "logs", "gapwood", "roof_tin"]

static var mats := {}             ## общие материалы (make_materials)
static var cut_mats := {}         ## их срезанные копии
static var cam_dir := Vector3(0, 0, 1)

var def: Dictionary
var id := ""
var title := ""
var blocks: Array = []
var floors := 1
var storey := STOREY
var rooms: Array = []             ## {bi, f, u0, u1, v0, v1, type, y}
var containers: Array = []        ## {pos, size, yaw, kind, n, bi, f, cells, node}
var doors: Array = []             ## ULDoor
var spots: Array = []             ## [точка (мир), метка] — где могут стоять враги
var lamps: Array = []             ## [точка (мир), этаж]
var cols: Array = []              ## [размер, преобразование] — столкновения (добавляет ULSanatorium)
var hulls: Array = []             ## [точки выпуклой формы] — марши лестниц
var entrances: Array = []         ## [точка снаружи у двери, точка внутри]
var junk: Array = []              ## точки для хлама (мир)
var rect := Rect2()               ## где здание по земле (мир)
var state := -99                  ## -1 — герой снаружи; k — герой внутри на этаже k
var te := TE                      ## толщина наружной стены (у палаток и кунгов — тонкая)
var base_y := 0.0                 ## высота пола первого этажа (у погреба — под землёй, −2,6 м)
var annex := Rect2()              ## у погреба — лестница вниз (мир): на ней герой уже «в погребе»
var models: Array = []            ## мебель-модели: [имя, где (мир), поворот, размер (вдоль, высота, вглубь), группа]
var style := ""                   ## «» — корпус; tent — палатка (брезент, двускатная крыша, полог); box — кунг, контейнер, пост
var _made: Array = []             ## [группа, материал, сетка] — для кэша
var _door_args: Array = []        ## как создавались двери — для кэша
var _groups := {}
var _st := {}
var _rng: RandomNumberGenerator
var _bx := BoxMesh.new()
var _cyl := CylinderMesh.new()
var _keep: Array = []             ## куда мебель не ставить (комната: проходы у дверей) — Rect2 в системе блока
var _placed: Array = []
var _cnt := 0


static func make_materials(noise: Texture2D) -> void:
	if not mats.is_empty():
		return
	var sh := Shader.new()
	sh.code = "shader_type spatial;\n" + SHADER_BODY
	var shc := Shader.new()
	shc.code = "shader_type spatial;\nrender_mode cull_disabled;\n#define CUT\n" + SHADER_BODY
	var T := "res://assets/world/tex/"
	for k in MATS:
		var d: Array = MATS[k]
		var ex: Dictionary = d[5]
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("noise", noise)
		m.set_shader_parameter("albedo_tex", load(T + String(d[0]) + "_c.jpg"))
		if ResourceLoader.exists(T + String(d[0]) + "_n.jpg") and k in ["facade", "facade2", "plaster", "brick", "tiles", "roof", "int_blue", "int_green", "int_beige", "int_grey", "int_beige1", "int_grey1", "lino", "planks", "planks_blue", "planks_green", "planks_brown", "roof_tin", "floorboard", "earth", "cellar_wall", "cellar_floor", "potato"]:
			m.set_shader_parameter("normal_tex", load(T + String(d[0]) + "_n.jpg"))
			m.set_shader_parameter("has_normal", true)
		m.set_shader_parameter("scale", float(d[1]))
		m.set_shader_parameter("tint", d[2])
		m.set_shader_parameter("grime", float(d[3]))
		m.set_shader_parameter("rough", float(d[4]))
		m.set_shader_parameter("streaks", float(ex.get("streaks", 0.0)))
		m.set_shader_parameter("rusty", float(ex.get("rusty", 0.0)))
		m.set_shader_parameter("sat", float(ex.get("sat", 1.0)))
		m.set_shader_parameter("metal", float(ex.get("metal", 0.0)))
		m.set_shader_parameter("storey", float(ex.get("storey", STOREY)))
		if ex.has("paint"):
			m.set_shader_parameter("paint", true)
			m.set_shader_parameter("paint_tex", load(T + "peeling_painted_wall_c.jpg"))
			m.set_shader_parameter("paint_tint", ex.paint)
		if ex.has("second"):
			m.set_shader_parameter("has_second", true)
			m.set_shader_parameter("albedo2", load(T + String(ex.second) + "_c.jpg"))
			m.set_shader_parameter("tint2", ex.get("tint2", Color.WHITE))
			m.set_shader_parameter("second_bias", float(ex.get("bias", 0.0)))
		mats[k] = m
		var mc := m.duplicate() as ShaderMaterial
		mc.shader = shc
		cut_mats[k] = mc
	var g := StandardMaterial3D.new()
	g.albedo_color = Color(0.05, 0.06, 0.065)
	g.metallic = 0.6
	g.roughness = 0.12
	mats["glass"] = g
	var gc := StandardMaterial3D.new()
	gc.albedo_color = Color(0.05, 0.06, 0.065)
	gc.metallic = 0.6
	gc.roughness = 0.12
	cut_mats["glass"] = gc
	var lamp := StandardMaterial3D.new()
	lamp.albedo_color = Color(0.9, 0.95, 1.0)
	lamp.emission_enabled = true
	lamp.emission = Color(0.85, 0.92, 1.0)
	lamp.emission_energy_multiplier = 0.8
	mats["lamp"] = lamp
	cut_mats["lamp"] = lamp


## срез стен на этаже героя (высота — мир) и окно вокруг героя на экране
static func set_cut(y: float) -> void:
	for k in cut_mats:
		var m = cut_mats[k]
		if m is ShaderMaterial:
			(m as ShaderMaterial).set_shader_parameter("cut_y", y)


static func set_hole(screen: Vector2, radius: float, depth: float, feet_y: float) -> void:
	for k in mats:
		var m = mats[k]
		if m is ShaderMaterial:
			(m as ShaderMaterial).set_shader_parameter("hole", Vector4(screen.x, screen.y, radius, depth))
			(m as ShaderMaterial).set_shader_parameter("hole_y", feet_y)
	for k in cut_mats:
		var m = cut_mats[k]
		if m is ShaderMaterial:
			(m as ShaderMaterial).set_shader_parameter("hole", Vector4(screen.x, screen.y, radius, depth))
			(m as ShaderMaterial).set_shader_parameter("hole_y", feet_y)


# ---------------- блок: система координат ----------------
# Внутри блока: u — вдоль длинной оси, v — поперёк, y — вверх. axis «x» — u по миру x; «z» — u по миру z.

func _w(bk: Dictionary, u: float, y: float, v: float) -> Vector3:
	var c: Vector2 = bk.c
	return Vector3(c.x + u, y + base_y, c.y + v) if String(bk.axis) == "x" else Vector3(c.x + v, y + base_y, c.y + u)


func _ws(bk: Dictionary, su: float, sy: float, sv: float) -> Vector3:
	return Vector3(su, sy, sv) if String(bk.axis) == "x" else Vector3(sv, sy, su)


## мировое направление местной оси (u или v)
func _wd(bk: Dictionary, du: float, dv: float) -> Vector3:
	return Vector3(du, 0, dv) if String(bk.axis) == "x" else Vector3(dv, 0, du)


func _local(bk: Dictionary, p: Vector3) -> Vector2:
	var c: Vector2 = bk.c
	return Vector2(p.x - c.x, p.z - c.y) if String(bk.axis) == "x" else Vector2(p.z - c.y, p.x - c.x)


## Коробка в группу key. Наружное (фасады этажей, подложки окон) ещё и в общую группу блока «xa»: снаружи блок
## рисуется ею — несколько сеток на весь блок вместо нескольких на каждый этаж (меньше вызовов отрисовки).
func _box(key: String, mat: String, size: Vector3, xf: Transform3D) -> void:
	_box1(key, mat, size, xf)
	var p := key.find("/x")
	if p < 0:
		p = key.find("/o")
	if p >= 0:
		_box1(key.substr(0, p) + "/xa", mat, size, xf)


func _box1(key: String, mat: String, size: Vector3, xf: Transform3D) -> void:
	var k := key + "|" + mat
	if not _st.has(k):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[k] = st
	_bx.size = size
	(_st[k] as SurfaceTool).append_from(_bx, 0, xf)


## коробка по местным границам блока; col — со столкновением
func _lb(key: String, mat: String, bk: Dictionary, u0: float, u1: float, y0: float, y1: float, v0: float, v1: float, col := false) -> void:
	if u1 - u0 < 0.004 or y1 - y0 < 0.004 or v1 - v0 < 0.004:
		return
	var c := _w(bk, (u0 + u1) * 0.5, (y0 + y1) * 0.5, (v0 + v1) * 0.5)
	var s := _ws(bk, u1 - u0, y1 - y0, v1 - v0)
	_box(key, mat, s, Transform3D(Basis(), c))
	if col:
		cols.append([s, Transform3D(Basis(), c)])


func _cylinder(key: String, mat: String, r: float, h: float, xf: Transform3D, seg := 12) -> void:
	var k := key + "|" + mat
	if not _st.has(k):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[k] = st
	_cyl.top_radius = r
	_cyl.bottom_radius = r
	_cyl.height = h
	_cyl.radial_segments = seg
	_cyl.rings = 1
	(_st[k] as SurfaceTool).append_from(_cyl, 0, xf)


func _col(size: Vector3, at: Vector3) -> void:
	cols.append([size, Transform3D(Basis(), at)])


func _group(key: String) -> Node3D:
	if not _groups.has(key):
		var g := Node3D.new()
		g.name = key
		add_child(g)
		_groups[key] = g
	return _groups[key]


func _flush() -> void:
	for k in _st.keys():
		var parts := String(k).split("|")
		var mesh := (_st[k] as SurfaceTool).commit()
		_made.append([parts[0], parts[1], mesh])
		_add_mesh(parts[0], parts[1], mesh)
	_st.clear()


func _add_mesh(gk: String, mat: String, mesh: Mesh) -> void:
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mats[mat]
	mi.set_meta("mat", mat)
	# внутренности — на слое 2 (их не освещает солнце)
	if gk.contains("/i") or gk.contains("/n") or gk.contains("/s"):
		mi.layers = 2
	# тень отбрасывают только стены и крыши; рамы, стёкла, карнизы и всё внутри — нет (меньше треугольников)
	var big := mat in ["facade", "facade2", "plaster", "brick", "roof", "plinth", "slab", "planks", "planks_blue", "planks_green", "planks_brown", "roof_tin", "shingle"]
	if style == "cellar":
		mi.layers = 2                                  # погреб под землёй: солнце его не освещает
		big = false
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if big and not (gk.contains("/n") or gk.contains("/i") or gk.contains("/s")) else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_group(gk).add_child(mi)


## дверь: [где, вдоль стены, куда открывается, ширина, высота, открыта, блок, этаж, наружная]
func _make_door(a: Array) -> ULDoor:
	var dd := ULDoor.new()
	add_child(dd)
	var dm := String(a[9]) if a.size() > 9 else "door"
	dd.setup(a[0], a[1], a[2], float(a[3]), float(a[4]), mats[dm], bool(a[5]))
	dd.panel.set_meta("mat", dm)
	dd.bld = int(a[6])
	dd.floor_i = int(a[7])
	if bool(a[8]):
		dd.panel.layers = 1
		dd.set_meta("ext", true)
	doors.append(dd)
	_door_args.append(a)
	return dd


## всё, что нужно, чтобы поднять корпус без сборки: сетки, двери, комнаты, тайники, места, столкновения
func to_cache() -> Dictionary:
	return {"made": _made, "doors": _door_args, "blocks": blocks, "floors": floors, "storey": storey, "rect": rect,
		"rooms": rooms, "containers": containers, "spots": spots, "lamps": lamps, "cols": cols, "hulls": hulls,
		"entrances": entrances, "junk": junk, "models": models}


func _from_cache(c: Dictionary) -> void:
	blocks = c.blocks
	floors = int(c.floors)
	rect = c.rect
	rooms = c.rooms
	containers = c.containers
	spots = c.spots
	lamps = c.lamps
	cols = c.cols
	hulls = c.hulls
	entrances = c.entrances
	junk = c.junk
	models = c.get("models", [])
	for m in c.made:
		_made.append(m)
		_add_mesh(String(m[0]), String(m[1]), m[2])
	for a in c.doors:
		_make_door(a)


# ---------------- сборка ----------------

## d — описание корпуса (ULSanatorium.BUILDINGS); cache — готовый корпус (ULBlockCache), если есть
func build(d: Dictionary, rng: RandomNumberGenerator, cache := {}) -> void:
	def = d
	id = String(d.id)
	title = String(d.n)
	name = id
	storey = float(d.get("storey", STOREY))
	te = float(d.get("te", TE))
	style = String(d.get("style", ""))
	base_y = float(d.get("base_y", 0.0))
	annex = d.get("annex", Rect2())
	_rng = rng
	if not cache.is_empty():
		_from_cache(cache)
		set_state(-1)
		return
	var rmin := Vector2(1e9, 1e9)
	var rmax := Vector2(-1e9, -1e9)
	for b in d.blocks:
		var bk: Dictionary = (b as Dictionary).duplicate(true)
		bk.hl = float(bk.L) * 0.5
		bk.hw = float(bk.W) * 0.5
		bk.iu0 = -float(bk.hl) + te
		bk.iu1 = float(bk.hl) - te
		bk.iv0 = -float(bk.hw) + te
		bk.iv1 = float(bk.hw) - te
		bk.floors = int(bk.get("floors", 1))
		floors = maxi(floors, int(bk.floors))
		blocks.append(bk)
		for cu in [-1.0, 1.0]:
			for cv in [-1.0, 1.0]:
				var p := _w(bk, float(bk.hl) * cu, 0, float(bk.hw) * cv)
				rmin = Vector2(minf(rmin.x, p.x), minf(rmin.y, p.z))
				rmax = Vector2(maxf(rmax.x, p.x), maxf(rmax.y, p.z))
	rect = Rect2(rmin, rmax - rmin)
	var t0 := Time.get_ticks_usec()
	for bi in blocks.size():
		_plan(bi)
	for bi in blocks.size():
		_shell(bi)
		for f in int(blocks[bi].floors):
			_floor(bi, f)
		_roof(bi)
	if d.has("portico"):
		_portico(d.portico)
	_flush()
	print("[blk] %s собран заново: %d мс" % [id, (Time.get_ticks_usec() - t0) / 1000])
	set_state(-1)


## План блока: где лестничные клетки и вестибюль, как ряды комнат делятся (по окнам), где окна и двери наружу.
## План один на все этажи (стены стоят друг над другом, окна на фасаде — ровными рядами).
func _plan(bi: int) -> void:
	var bk: Dictionary = blocks[bi]
	var iu0: float = bk.iu0
	var iu1: float = bk.iu1
	var bays: Array = []
	for e in bk.get("stairs", []):
		if int(e) > 0:
			bays.append([iu1 - SB, iu1, "stair", 1])
		else:
			bays.append([iu0, iu0 + SB, "stair", -1])
	if bk.has("hall"):
		var hu := float(bk.hall[0])
		var hw2 := float(bk.hall[1]) * 0.5
		bays.append([hu - hw2, hu + hw2, "hall", 0])
	bays.sort_custom(func(a, b) -> bool: return float(a[0]) < float(b[0]))
	bk.bays = bays
	# промежутки между клетками — ряды комнат; окна — по шагу, близкому к PITCH
	var segs: Array = []
	var cur := iu0
	for by in bays:
		if float(by[0]) - cur > 1.5:
			segs.append([cur, float(by[0])])
		cur = float(by[1])
	if iu1 - cur > 1.5:
		segs.append([cur, iu1])
	bk.segs = segs
	var cells: Array = []             # [u0, u1] — ячейки между окнами
	for sg in segs:
		var a: float = sg[0]
		var b: float = sg[1]
		var n := maxi(1, int(round((b - a) / PITCH)))
		var p := (b - a) / n
		for i in n:
			cells.append([a + i * p, a + (i + 1) * p])
	bk.cells = cells
	# комнаты из 1–2 ячеек (для каждой стороны — своё деление; одно на все этажи)
	var split := {}
	for side in [-1, 1]:
		var arr: Array = []
		for sg in segs:
			var cs: Array = []
			for c in cells:
				if float(c[0]) >= float(sg[0]) - 0.01 and float(c[1]) <= float(sg[1]) + 0.01:
					cs.append(c)
			var i := 0
			while i < cs.size():
				var take := 2 if (i + 1 < cs.size() and _rng.randf() < float(bk.get("wide", 0.45))) else 1
				arr.append([float(cs[i][0]), float(cs[i + take - 1][1])])
				i += take
		split[side] = arr
	bk.split = split
	# вход: [сторона, смещение по u (или v для торцов), ширина]
	bk.ent = bk.get("entr", [])


# ---------------- наружные стены, окна, вход ----------------

## Наружные стены всех этажей блока: снаружи — облицовка, внутри — штукатурка с краской; окна по ячейкам;
## цоколь, пояса между этажами, двери входа с козырьком и ступенями.
func _shell(bi: int) -> void:
	var bk: Dictionary = blocks[bi]
	var fl: int = bk.floors
	var skin := String(def.get("skin", "facade"))
	var inner := String(def.get("int", "int_blue"))
	for f in fl:
		var y0 := f * storey
		var y1 := (f + 1) * storey
		for side in ["s-", "s+", "e-", "e+"]:
			var ops := _openings(bi, f, side)
			_ext_wall(bi, f, side, y0, y1, ops, skin, inner)
		# пояс между этажами
		if f > 0 and style == "":
			for side in ["s-", "s+", "e-", "e+"]:
				var key := _xkey(bi, f, side)
				_band(bk, key, side, y0 - 0.08, y0 + 0.08, 0.07, "trim")
	# цоколь: у корпуса — бетонный; у деревянного дома — низкий каменный
	if style == "wood":
		var ph := float(def.get("plinth_h", 0.42)) if String(def.get("kind", "")) != "shed" else 0.16
		var pm := String(def.get("plinth_mat", "plinth"))
		for side in ["s-", "s+", "e-", "e+"]:
			_band(bk, _xkey(bi, 0, side), side, -0.05, ph, 0.07, pm)
		if not def.get("logs", false):
			_corner_boards(bk, bi, ph, fl * storey)
		return
	if style != "":
		return
	for side in ["s-", "s+", "e-", "e+"]:
		_band(bk, _xkey(bi, 0, side), side, 0.0, 0.55, 0.06, "plinth")


## угловые доски (нащельники) дощатого дома: по две на каждом углу, от цоколя до карниза
func _corner_boards(bk: Dictionary, bi: int, y0: float, y1: float) -> void:
	var hl: float = bk.hl
	var hw: float = bk.hw
	var w := 0.15
	var t := 0.035
	for su in [-1.0, 1.0]:
		for sv in [-1.0, 1.0]:
			var side_s := "s+" if sv > 0.0 else "s-"
			var side_e := "e+" if su > 0.0 else "e-"
			# на фасаде «s±» — у торца, на торце «e±» — у фасада
			_lb(_xkey(bi, 0, side_s), "wframe", bk, su * hl - (w if su > 0.0 else 0.0) + (0.0 if su > 0.0 else -t), su * hl + (t if su > 0.0 else w), y0, y1, sv * hw - (0.0 if sv > 0.0 else t), sv * hw + (t if sv > 0.0 else 0.0))
			_lb(_xkey(bi, 0, side_e), "wframe", bk, su * hl - (0.0 if su > 0.0 else t), su * hl + (t if su > 0.0 else 0.0), y0, y1, sv * hw - (w if sv > 0.0 else 0.0), sv * hw + (0.0 if sv > 0.0 else w))


## группа наружной стены: со стороны камеры («f») или обратная («b»)
func _xkey(bi: int, f: int, side: String) -> String:
	var bk: Dictionary = blocks[bi]
	var n := _side_n(bk, side)
	return "b%d/x%d%s" % [bi, f, "f" if n.dot(cam_dir) > 0.3 else "b"]


func _ikey(bi: int, f: int, side: String) -> String:
	var bk: Dictionary = blocks[bi]
	var n := _side_n(bk, side)
	return "b%d/i%d" % [bi, f] if n.dot(cam_dir) > 0.3 else "b%d/n%d" % [bi, f]


## наружу от стены (мир)
func _side_n(bk: Dictionary, side: String) -> Vector3:
	match side:
		"s+":
			return _wd(bk, 0, 1)
		"s-":
			return _wd(bk, 0, -1)
		"e+":
			return _wd(bk, 1, 0)
	return _wd(bk, -1, 0)


## выступающая полоса по стороне (цоколь, пояс)
func _band(bk: Dictionary, key: String, side: String, y0: float, y1: float, out: float, mat: String) -> void:
	var hl: float = bk.hl
	var hw: float = bk.hw
	match side:
		"s+":
			_lb(key, mat, bk, -hl - out, hl + out, y0, y1, hw - 0.02, hw + out)
		"s-":
			_lb(key, mat, bk, -hl - out, hl + out, y0, y1, -hw - out, -hw + 0.02)
		"e+":
			_lb(key, mat, bk, hl - 0.02, hl + out, y0, y1, -hw, hw)
		"e-":
			_lb(key, mat, bk, -hl - out, -hl + 0.02, y0, y1, -hw, hw)


## Проёмы в наружной стене этажа: [s0, s1, y0, y1, вид] — s вдоль стены (для «s±» — u, для «e±» — v)
func _openings(bi: int, f: int, side: String) -> Array:
	var bk: Dictionary = blocks[bi]
	var ops: Array = []
	var wh := float(bk.get("win_h", 1.5))
	var sill := float(bk.get("sill", 0.9))
	var ww := float(bk.get("win_w", 1.35))
	if side == "s+" or side == "s-":
		if not bk.get("blind", []).has(side):
			for c in bk.cells:
				var m := (float(c[0]) + float(c[1])) * 0.5
				ops.append([m - ww * 0.5, m + ww * 0.5, sill, sill + wh, "win"])
			for by in bk.bays:
				if String(by[2]) == "hall":
					var a: float = by[0]
					var b: float = by[1]
					var n := maxi(1, int(round((b - a) / PITCH)))
					for i in n:
						var m2 := a + (i + 0.5) * (b - a) / n
						ops.append([m2 - ww * 0.5, m2 + ww * 0.5, sill, sill + wh, "win"])
				elif String(by[2]) == "stair":
					# в лестничной клетке окно — посередине стены над маршем (на полэтажа выше)
					var m3 := (float(by[0]) + float(by[1])) * 0.5
					ops.append([m3 - 0.6, m3 + 0.6, sill + 0.4, minf(sill + 0.4 + wh, storey - 0.35), "win"])
		_add_entr(bk, f, side, ops)
		_add_links(bi, f, side, ops)
	else:
		var su := 1 if side == "e+" else -1
		var stair_here := false
		for by in bk.bays:
			if String(by[2]) == "stair" and int(by[3]) == su:
				stair_here = true
		if not bk.get("blind", []).has(side):
			if stair_here:
				ops.append([-0.65, 0.65, sill + 0.5, minf(sill + 0.5 + wh, storey - 0.4), "win"])
			elif String(bk.get("layout", "corridor")) == "corridor":
				# торец: окно в конце коридора и по окну в крайних комнатах
				ops.append([-0.6, 0.6, sill, sill + wh, "win"])
				for v in [-1.0, 1.0]:
					var m := float(v) * (CW * 0.5 + (float(bk.hw) - te - CW * 0.5) * 0.5)
					ops.append([m - ww * 0.5, m + ww * 0.5, sill, sill + wh, "win"])
			else:
				var span := float(bk.W) - 2.0 * te
				var n := maxi(1, int(round(span / PITCH)))
				for i in n:
					var m := -span * 0.5 + (i + 0.5) * span / n
					ops.append([m - ww * 0.5, m + ww * 0.5, sill, sill + wh, "win"])
		_add_entr(bk, f, side, ops)
		_add_links(bi, f, side, ops)
	# окно, которое смотрело бы в стену соседнего блока, не делается
	var keep_ops: Array = []
	for o in ops:
		if String(o[4]) == "win" and _faces_block(bi, side, (float(o[0]) + float(o[1])) * 0.5):
			continue
		keep_ops.append(o)
	ops = keep_ops
	# проёмы не должны налезать друг на друга: дверь вытесняет окна рядом
	ops.sort_custom(func(a, b) -> bool: return float(a[0]) < float(b[0]))
	var out: Array = []
	for o in ops:
		var bad := false
		for q in ops:
			if q != o and String(q[4]) != "win" and String(o[4]) == "win" and float(o[1]) > float(q[0]) - 0.25 and float(o[0]) < float(q[1]) + 0.25:
				bad = true
		if not bad:
			out.append(o)
	return out


## точка в метре снаружи от стены side в месте s — внутри другого блока?
func _faces_block(bi: int, side: String, s: float) -> bool:
	var bk: Dictionary = blocks[bi]
	var p: Vector3
	match side:
		"s+":
			p = _w(bk, s, 0, float(bk.hw) + 0.8)
		"s-":
			p = _w(bk, s, 0, -float(bk.hw) - 0.8)
		"e+":
			p = _w(bk, float(bk.hl) + 0.8, 0, s)
		_:
			p = _w(bk, -float(bk.hl) - 0.8, 0, s)
	for j in blocks.size():
		if j == bi:
			continue
		var l := _local(blocks[j], p)
		if absf(l.x) < float(blocks[j].hl) and absf(l.y) < float(blocks[j].hw):
			return true
	return false


func _add_entr(bk: Dictionary, f: int, side: String, ops: Array) -> void:
	if f != 0:
		return
	for e in bk.ent:
		if String(e[0]) == side:
			var s := float(e[1])
			var w := float(e[2])
			ops.append([s - w * 0.5, s + w * 0.5, 0.0, minf(DH + 0.25, storey - 0.12), "entr", String(e[3]) if e.size() > 3 else ""])


func _add_links(bi: int, f: int, side: String, ops: Array) -> void:
	var bk: Dictionary = blocks[bi]
	for lk in def.get("links", []):
		var p := Vector3(float(lk[0].x), 0, float(lk[0].y))
		if f >= int(lk[1]):
			continue
		var l := _local(bk, p)
		var on := false
		var s := 0.0
		match side:
			"s+":
				on = absf(l.y - float(bk.hw)) < 0.5 and absf(l.x) < float(bk.hl)
				s = l.x
			"s-":
				on = absf(l.y + float(bk.hw)) < 0.5 and absf(l.x) < float(bk.hl)
				s = l.x
			"e+":
				on = absf(l.x - float(bk.hl)) < 0.5 and absf(l.y) < float(bk.hw)
				s = l.y
			"e-":
				on = absf(l.x + float(bk.hl)) < 0.5 and absf(l.y) < float(bk.hw)
				s = l.y
		if on:
			ops.append([s - 0.7, s + 0.7, 0.0, DH + 0.1, "link"])


## Наружная стена этажа с проёмами: облицовка снаружи и штукатурка внутри; столкновение — по всей толщине.
## Окна: рама, стекло (бывает разбито или заколочено), подоконник снаружи.
func _ext_wall(bi: int, f: int, side: String, y0: float, y1: float, ops: Array, skin: String, inner: String) -> void:
	var bk: Dictionary = blocks[bi]
	var xk := _xkey(bi, f, side)
	var ik := _ikey(bi, f, side)
	var hl: float = bk.hl
	var hw: float = bk.hw
	var along_u := side == "s+" or side == "s-"
	var lo := -hl if along_u else -hw + te
	var hi := hl if along_u else hw - te
	var sgn := 1.0 if (side == "s+" or side == "e+") else -1.0
	var outer := (hw if along_u else hl) * sgn          # наружная грань
	# куски: [s0, s1, y0, y1]
	var pieces: Array = []
	var s := lo
	for o in ops:
		var a: float = maxf(float(o[0]), lo)
		var b: float = minf(float(o[1]), hi)
		if b <= a:
			continue
		if a > s:
			pieces.append([s, a, y0, y1])
		if float(o[2]) > 0.0:
			pieces.append([a, b, y0, y0 + float(o[2])])
		pieces.append([a, b, y0 + float(o[3]), y1])
		s = b
	if hi > s:
		pieces.append([s, hi, y0, y1])
	for pc in pieces:
		var a: float = pc[0]
		var b: float = pc[1]
		var ya: float = pc[2]
		var yb: float = pc[3]
		if yb - ya < 0.01:
			continue
		# облицовка (0.18 снаружи), штукатурка (0.12 внутри); у тонких стен — пополам
		var sk := minf(0.18, te * 0.55)
		if style == "wood" and def.get("logs", false):
			_logs(bk, xk, along_u, a, b, ya, yb, outer, sgn, a <= lo + 0.01, b >= hi - 0.01)
		else:
			_wall_piece(bk, xk, skin, along_u, a, b, ya, yb, outer, outer - sgn * sk)
			if style == "wood" and b - a > 1.4 and yb - ya > 1.0 and _rng.randf() < 0.3:
				# выпала доска обшивки — тёмная щель
				var gl := _rng.randf_range(0.5, minf(1.4, b - a - 0.3))
				var g0 := _rng.randf_range(a + 0.15, b - gl - 0.15)
				var gy := _rng.randf_range(maxf(ya, 0.6), yb - 0.25)
				_wall_piece(bk, xk, "gapwood", along_u, g0, g0 + gl, gy, gy + _rng.randf_range(0.08, 0.13), outer + sgn * 0.004, outer - sgn * 0.01)
		_wall_piece(bk, ik, inner, along_u, a, b, ya, yb, outer - sgn * sk, outer - sgn * te)
		_wall_col(bk, along_u, a, b, ya, yb, outer, outer - sgn * te)
	for o in ops:
		var a: float = maxf(float(o[0]), lo)
		var b: float = minf(float(o[1]), hi)
		var oy0 := y0 + float(o[2])
		var oy1 := y0 + float(o[3])
		match String(o[4]):
			"win":
				_window(bk, xk, along_u, a, b, oy0, oy1, outer, sgn)
			"entr":
				_entrance(bi, bk, xk, along_u, a, b, oy0, oy1, outer, sgn, String(o[5]) if o.size() > 5 else "")
			"link":
				pass


## Сруб: стена из брёвен по рядам (ряды на общей сетке по высоте — над и под окном брёвна совпадают); у углов
## брёвна выходят за угол («в чашу»), ряды соседних стен сдвинуты на полбревна.
func _logs(bk: Dictionary, key: String, along_u: bool, a: float, b: float, ya: float, yb: float, outer: float, sgn: float, at_lo: bool, at_hi: bool) -> void:
	var r := 0.12
	var step := 0.22
	var off := 0.0 if along_u else step * 0.5
	var d := outer - sgn * 0.05
	var a2 := a - (0.26 if at_lo else 0.0) - (0.0 if along_u or not at_lo else te)
	var b2 := b + (0.26 if at_hi else 0.0) + (0.0 if along_u or not at_hi else te)
	var k0 := int(ceil((ya - off - r * 0.4) / step))
	var k := maxi(k0, 0)
	while true:
		var y := off + k * step + r * 0.7
		if y > yb - r * 0.3:
			break
		if y >= ya + r * 0.3:
			var mid := (a2 + b2) * 0.5
			var c := _w(bk, mid if along_u else d, y, d if along_u else mid)
			var dirw := _wd(bk, 1, 0) if along_u else _wd(bk, 0, 1)
			var bas := Basis(Vector3(0, 0, 1), PI * 0.5) if absf(dirw.x) > 0.5 else Basis(Vector3(1, 0, 0), PI * 0.5)
			var rr := r * _rng.randf_range(0.92, 1.06)
			_cylinder(key, "logs", rr, b2 - a2, Transform3D(bas, c), 6)
			var xp := key.find("/x")
			if xp >= 0:
				_cylinder(key.substr(0, xp) + "/xa", "logs", rr, b2 - a2, Transform3D(bas, c), 6)   # снаружи блок рисуется общей сеткой
		k += 1


func _wall_piece(bk: Dictionary, key: String, mat: String, along_u: bool, a: float, b: float, ya: float, yb: float, d0: float, d1: float) -> void:
	if along_u:
		_lb(key, mat, bk, a, b, ya, yb, minf(d0, d1), maxf(d0, d1))
	else:
		_lb(key, mat, bk, minf(d0, d1), maxf(d0, d1), ya, yb, a, b)


func _wall_col(bk: Dictionary, along_u: bool, a: float, b: float, ya: float, yb: float, d0: float, d1: float) -> void:
	var c := _w(bk, (a + b) * 0.5 if along_u else (d0 + d1) * 0.5, (ya + yb) * 0.5, (d0 + d1) * 0.5 if along_u else (a + b) * 0.5)
	var sz := _ws(bk, (b - a) if along_u else absf(d1 - d0), yb - ya, absf(d1 - d0) if along_u else (b - a))
	cols.append([sz, Transform3D(Basis(), c)])


## окно: рама, переплёт, стекло (или его осколки, или доски), отлив
func _window(bk: Dictionary, key: String, along_u: bool, a: float, b: float, y0: float, y1: float, outer: float, sgn: float) -> void:
	if style == "wood":
		_window_wood(bk, key, along_u, a, b, y0, y1, outer, sgn)
		return
	var fd := outer - sgn * 0.12                       # плоскость рамы
	var t := 0.06
	_wall_piece(bk, key, "frame", along_u, a, a + t, y0, y1, fd, fd - sgn * 0.08)
	_wall_piece(bk, key, "frame", along_u, b - t, b, y0, y1, fd, fd - sgn * 0.08)
	_wall_piece(bk, key, "frame", along_u, a, b, y0, y0 + t, fd, fd - sgn * 0.08)
	_wall_piece(bk, key, "frame", along_u, a, b, y1 - t, y1, fd, fd - sgn * 0.08)
	var m := (a + b) * 0.5
	_wall_piece(bk, key, "frame", along_u, m - 0.025, m + 0.025, y0, y1, fd, fd - sgn * 0.07)
	_wall_piece(bk, key, "frame", along_u, a, b, y1 - 0.45, y1 - 0.4, fd, fd - sgn * 0.07)
	_wall_piece(bk, key, "plinth", along_u, a - 0.05, b + 0.05, y0 - 0.06, y0, outer + sgn * 0.08, outer - sgn * 0.1)
	var r := _rng.randf()
	if r < 0.12:
		# заколочено досками
		for k in 3:
			var yy := y0 + 0.25 + k * (y1 - y0 - 0.5) * 0.5
			var tilt := _rng.randf_range(-0.12, 0.12)
			var c := _w(bk, m if along_u else outer + sgn * 0.02, yy, outer + sgn * 0.02 if along_u else m)
			var sz := _ws(bk, b - a + 0.2, 0.16, 0.035) if along_u else _ws(bk, 0.035, 0.16, b - a + 0.2)
			var ax := _wd(bk, 0, 1) if along_u else _wd(bk, 1, 0)
			_box(key, "wood", sz, Transform3D(Basis(ax, tilt), c))
	elif r < 0.3:
		# стекло выбито: тёмная пустота за рамой (внутри не видно — там чёрная подложка)
		_wall_piece(bk, key, "glass", along_u, a + t, b - t, y0 + t, y0 + (y1 - y0) * _rng.randf_range(0.15, 0.4), fd - sgn * 0.035, fd - sgn * 0.045)
		_wall_piece(bk, key.replace("/x", "/o").trim_suffix("f").trim_suffix("b"), "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.25, fd - sgn * 0.26)
	else:
		_wall_piece(bk, key, "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.035, fd - sgn * 0.045)


## окно деревенского дома: белая рама с переплётом крестом, резной наличник, распахнутые ставни, подоконник;
## часть окон заколочена или без стёкол
func _window_wood(bk: Dictionary, key: String, along_u: bool, a: float, b: float, y0: float, y1: float, outer: float, sgn: float) -> void:
	# у сруба брёвна выступают на 7 см — наличник, подоконник и ставни выносятся поверх них
	if def.get("logs", false):
		outer += sgn * 0.075
	var fd := outer - sgn * 0.06 - (sgn * 0.075 if def.get("logs", false) else 0.0)
	var t := 0.06
	var m := (a + b) * 0.5
	for e in [[a, a + t], [b - t, b]]:
		_wall_piece(bk, key, "wframe", along_u, float(e[0]), float(e[1]), y0, y1, fd, fd - sgn * 0.07)
	_wall_piece(bk, key, "wframe", along_u, a, b, y0, y0 + t, fd, fd - sgn * 0.07)
	_wall_piece(bk, key, "wframe", along_u, a, b, y1 - t, y1, fd, fd - sgn * 0.07)
	_wall_piece(bk, key, "wframe", along_u, m - 0.025, m + 0.025, y0, y1, fd, fd - sgn * 0.06)
	_wall_piece(bk, key, "wframe", along_u, a, b, y0 + (y1 - y0) * 0.62, y0 + (y1 - y0) * 0.62 + 0.05, fd, fd - sgn * 0.06)
	var r := _rng.randf()
	if r >= 0.1 and String(def.get("kind", "")) == "house" and ResourceLoader.exists("res://assets/world/kh_window.glb"):
		# резной наличник со ставнями — модель Tripo (снаружи, общей сеткой блока); стекло и переплёт — свои
		var nw := (_wd(bk, 0, 1) if along_u else _wd(bk, 1, 0)) * sgn
		var pw := _w(bk, m if along_u else outer + sgn * 0.02, y0 - 0.22, outer + sgn * 0.02 if along_u else m)
		var xa := key.substr(0, key.find("/x")) + "/xa"
		models.append(["kh_window", pw, atan2(nw.x, nw.z), Vector3((b - a) * 2.05 + 0.1, y1 - y0 + 0.46, 0.22), xa, 0.0])
		if r < 0.25:
			_wall_piece(bk, key.replace("/x", "/o").trim_suffix("f").trim_suffix("b"), "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.25, fd - sgn * 0.26)
		else:
			_wall_piece(bk, key, "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.02, fd - sgn * 0.03)
		return
	# наличник и подоконник
	_wall_piece(bk, key, "wframe", along_u, a - 0.1, b + 0.1, y1, y1 + 0.16, outer + sgn * 0.05, outer - sgn * 0.01)
	_wall_piece(bk, key, "wframe", along_u, a - 0.08, b + 0.08, y0 - 0.06, y0, outer + sgn * 0.1, outer - sgn * 0.02)
	if r < 0.85 and def.get("shutters", true):
		# ставни распахнуты по сторонам окна
		var sw := (b - a) * 0.5
		var hang := _rng.randf() < 0.15
		for e in [[a - sw - 0.04, a - 0.04], [b + 0.04, b + sw + 0.04]]:
			if hang and float(e[0]) > a:
				# сорвалась с верхней петли — висит косо
				var ang := _rng.randf_range(0.25, 0.45)
				var sc := (float(e[0]) + float(e[1])) * 0.5
				var c := _w(bk, sc if along_u else outer + sgn * 0.04, (y0 + y1) * 0.5 - 0.12, outer + sgn * 0.04 if along_u else sc)
				var sz := _ws(bk, sw, y1 - y0 + 0.04, 0.04) if along_u else _ws(bk, 0.04, y1 - y0 + 0.04, sw)
				var ax := _wd(bk, 0, 1) if along_u else _wd(bk, 1, 0)
				_box(key, "shutter", sz, Transform3D(Basis(ax, ang * sgn), c))
			else:
				_wall_piece(bk, key, "shutter", along_u, float(e[0]), float(e[1]), y0 - 0.02, y1 + 0.02, outer + sgn * 0.05, outer + sgn * 0.01)
	if r < 0.1:
		for k in 2:
			var yy := y0 + 0.3 + k * (y1 - y0 - 0.6)
			var c := _w(bk, m if along_u else outer + sgn * 0.03, yy, outer + sgn * 0.03 if along_u else m)
			var sz := _ws(bk, b - a + 0.2, 0.15, 0.03) if along_u else _ws(bk, 0.03, 0.15, b - a + 0.2)
			var ax := _wd(bk, 0, 1) if along_u else _wd(bk, 1, 0)
			_box(key, "planks_brown", sz, Transform3D(Basis(ax, _rng.randf_range(-0.15, 0.15)), c))
	elif r < 0.25:
		_wall_piece(bk, key.replace("/x", "/o").trim_suffix("f").trim_suffix("b"), "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.25, fd - sgn * 0.26)
	else:
		_wall_piece(bk, key, "glass", along_u, a + t, b - t, y0 + t, y1 - t, fd - sgn * 0.02, fd - sgn * 0.03)


## вход: двустворчатая дверь, наличник, козырёк на кронштейнах, две ступени
## kind: «» — парадный вход корпуса; flap — полог палатки (проём без двери, брезент подвязан по сторонам);
## plain — простая дверь без крыльца (кунг, пост, контейнер: одна створка до 1,2 м, шире — две)
func _entrance(bi: int, bk: Dictionary, key: String, along_u: bool, a: float, b: float, y0: float, y1: float, outer: float, sgn: float, kind := "") -> void:
	var m := (a + b) * 0.5
	var w := b - a
	if kind != "":
		var outp2 := _w(bk, m if along_u else outer + sgn * 1.6, 0, outer + sgn * 1.6 if along_u else m)
		var inp2 := _w(bk, m if along_u else outer - sgn * 1.2, 0, outer - sgn * 1.2 if along_u else m)
		entrances.append([outp2, inp2])
		if kind == "open":
			return                                  # проём без двери (погреб: вход с лестницы)
		if kind == "flap":
			# подвязанные полы полога и перекладина над входом
			for e in [a + 0.07, b - 0.07]:
				_wall_piece(bk, key, String(def.get("skin", "canvas")), along_u, e - 0.09, e + 0.09, y0, y1, outer + sgn * 0.1, outer - sgn * 0.02)
			_wall_piece(bk, key, "wood", along_u, a - 0.05, b + 0.05, y1 - 0.06, y1 + 0.02, outer + sgn * 0.04, outer - sgn * 0.04)
			return
		var dmat := "gmetal" if style == "box" else "door"
		if kind == "porch":
			# крыльцо: дощатый настил, ступень, два столба и навес; наличник
			_wall_piece(bk, key, "wframe", along_u, a - 0.12, a, y0, y1 + 0.1, outer + sgn * 0.05, outer - sgn * 0.02)
			_wall_piece(bk, key, "wframe", along_u, b, b + 0.12, y0, y1 + 0.1, outer + sgn * 0.05, outer - sgn * 0.02)
			_wall_piece(bk, key, "wframe", along_u, a - 0.12, b + 0.12, y1, y1 + 0.12, outer + sgn * 0.05, outer - sgn * 0.02)
			_wall_piece(bk, key, "floorboard", along_u, a - 0.7, b + 0.7, -0.02, 0.13, outer, outer + sgn * 1.45)
			_wall_piece(bk, key, "floorboard", along_u, a - 0.3, b + 0.3, -0.02, 0.06, outer + sgn * 1.45, outer + sgn * 1.85)
			for e in [a - 0.6, b + 0.6]:
				_wall_piece(bk, key, "planks_brown", along_u, e - 0.06, e + 0.06, 0.13, y1 + 0.45, outer + sgn * 1.3, outer + sgn * 1.42)
			_wall_piece(bk, key, String(def.get("roof_mat", "roof_tin")), along_u, a - 0.85, b + 0.85, y1 + 0.45, y1 + 0.52, outer, outer + sgn * 1.65)
			kind = "plain"
		var along2 := _wd(bk, 1, 0) if along_u else _wd(bk, 0, 1)
		var into2 := -_side_n(bk, _side_of(along_u, sgn))
		var dv := outer - sgn * te * 0.5
		if kind == "gate":
			# ворота гаража: две металлические створки, петли у наружной грани, открываются наружу; рама из уголка
			var dvo := outer + sgn * 0.03
			var gm := String(def.get("gate_mat", "gmetal"))
			for k in 2:
				var cg := _w(bk, (a + w * 0.25 + k * w * 0.5) if along_u else dvo, y0, dvo if along_u else (a + w * 0.25 + k * w * 0.5))
				_make_door([cg, along2 if k == 0 else -along2, -into2, w * 0.5, y1 - y0 - 0.04, _rng.randf() < 0.45, bi, 0, true, gm])
			for e in [[a - 0.08, a], [b, b + 0.08]]:
				_wall_piece(bk, key, "metal", along_u, float(e[0]), float(e[1]), y0, y1 + 0.08, outer + sgn * 0.04, outer - sgn * 0.04)
			_wall_piece(bk, key, "metal", along_u, a - 0.08, b + 0.08, y1, y1 + 0.08, outer + sgn * 0.04, outer - sgn * 0.04)
			return
		if w <= 1.2:
			_make_door([_w(bk, m if along_u else dv, y0, dv if along_u else m), along2, into2, w, y1 - y0 - 0.04, _rng.randf() < 0.35, bi, 0, true, dmat])
		else:
			for k in 2:
				var cc := _w(bk, (a + w * 0.25 + k * w * 0.5) if along_u else dv, y0, dv if along_u else (a + w * 0.25 + k * w * 0.5))
				_make_door([cc, along2 if k == 0 else -along2, into2, w * 0.5, y1 - y0 - 0.04, _rng.randf() < 0.5, bi, 0, true, dmat])
		return
	_wall_piece(bk, key, "trim", along_u, a - 0.18, a, y0, y1 + 0.18, outer + sgn * 0.06, outer - sgn * 0.02)
	_wall_piece(bk, key, "trim", along_u, b, b + 0.18, y0, y1 + 0.18, outer + sgn * 0.06, outer - sgn * 0.02)
	_wall_piece(bk, key, "trim", along_u, a - 0.18, b + 0.18, y1, y1 + 0.18, outer + sgn * 0.06, outer - sgn * 0.02)
	# козырёк
	var cy := y1 + 0.5
	_wall_piece(bk, key, "slab", along_u, a - 0.9, b + 0.9, cy, cy + 0.16, outer, outer + sgn * 1.7)
	for e in [a - 0.7, b + 0.7]:
		_wall_piece(bk, key, "metal", along_u, e - 0.04, e + 0.04, cy - 0.5, cy, outer, outer + sgn * 1.5)
	# ступени (без столкновения — низкие)
	_wall_piece(bk, key, "slab", along_u, a - 0.6, b + 0.6, -0.05, 0.1, outer, outer + sgn * 1.6)
	_wall_piece(bk, key, "slab", along_u, a - 0.3, b + 0.3, 0.05, 0.16, outer, outer + sgn * 0.8)
	# створки
	for k in 2:
		var c := _w(bk, (a + w * 0.25 + k * w * 0.5) if along_u else outer - sgn * 0.15, y0, outer - sgn * 0.15 if along_u else (a + w * 0.25 + k * w * 0.5))
		var along := _wd(bk, 1, 0) if along_u else _wd(bk, 0, 1)
		var into := -_side_n(bk, _side_of(along_u, sgn))
		if k == 1:
			along = -along
		_make_door([c, along, into, w * 0.5, y1 - y0 - 0.1, _rng.randf() < 0.6, bi, 0, true])
	var outp := _w(bk, m if along_u else outer + sgn * 2.2, 0, outer + sgn * 2.2 if along_u else m)
	var inp := _w(bk, m if along_u else outer - sgn * 2.0, 0, outer - sgn * 2.0 if along_u else m)
	entrances.append([outp, inp])


func _side_of(along_u: bool, sgn: float) -> String:
	if along_u:
		return "s+" if sgn > 0.0 else "s-"
	return "e+" if sgn > 0.0 else "e-"


# ---------------- этаж: перекрытие, перегородки, двери, лестница, мебель ----------------

func _floor(bi: int, f: int) -> void:
	var bk: Dictionary = blocks[bi]
	var y := f * storey
	var nk := "b%d/n%d" % [bi, f]
	var ik := "b%d/i%d" % [bi, f]
	var iu0: float = bk.iu0
	var iu1: float = bk.iu1
	var iv0: float = bk.iv0
	var iv1: float = bk.iv1
	# перекрытие этажа (у первого — пол на земле) с проёмом над маршем снизу
	var holes: Array = []
	if f > 0:
		for by in bk.bays:
			if String(by[2]) == "stair":
				holes.append(_flight_rect(bk, by, f - 1))
	_slab(bk, nk, iu0, iu1, iv0, iv1, y, holes, f > 0)
	var layout := String(bk.get("layout", "corridor"))
	var fr: Array = []                # комнаты этажа: {u0,u1,v0,v1,type,side,cor(дверь в стене)}
	if layout == "corridor":
		fr = _corridor_rooms(bi, f)
	else:
		fr = _hall_rooms(bi, f)
	# покрытие пола по комнатам
	for r in fr:
		var fm := String(_floor_mat(String(r.type)))
		var fy := y + (0.012 if f == 0 else 0.0)
		# в лестничной клетке покрытие — в обход проёма над маршем
		for rr in _rect_minus(Rect2(float(r.u0), float(r.v0), float(r.u1) - float(r.u0), float(r.v1) - float(r.v0)), holes if String(r.type) == "stair" else []):
			var q: Rect2 = rr
			_lb(nk, fm, bk, q.position.x, q.end.x, fy, fy + 0.02, q.position.y, q.end.y)
	# лестничные клетки
	for by in bk.bays:
		if String(by[2]) == "stair":
			if f < int(bk.floors) - 1:
				_flight(bi, bk, by, f)
			if f > 0:
				_rails(bk, nk, by, f)
	for r in fr:
		r.bi = bi
		r.f = f
		r.y = y
		rooms.append(r)
		_furnish(bk, r, nk, ik)
	# лампы: по коридору и в больших комнатах
	if layout == "corridor":
		var u := iu0 + 3.0
		while u < iu1:
			lamps.append([_w(bk, u, y + 2.7, 0), bi, f])
			u += 6.5
	elif style == "cellar":
		# подвал: лампа в каждом помещении (зал, кладовые)
		for r in fr:
			lamps.append([_w(bk, (float(r.u0) + float(r.u1)) * 0.5, y + storey - 0.3, (float(r.v0) + float(r.v1)) * 0.5), bi, f])
	else:
		lamps.append([_w(bk, (iu0 + iu1) * 0.5, y + minf(2.7, storey - 0.25), (iv0 + iv1) * 0.5), bi, f])


func _floor_mat(t: String) -> String:
	match t:
		"cor", "hall0", "lounge", "stair", "wc", "proc":
			return "tiles"
		"kitchen", "cold":
			return "ktiles"
		"office", "club", "library":
			return "parquet"
		"boiler", "tech", "store", "workshop", "warehouse", "pantry":
			return "concrete"
		"tent_hq", "tent_med", "tent_live":
			return "wood"
		"cstore":
			return "metal"
		"izba", "h_kitchen", "h_bed", "h_pantry", "shop_back":
			return "floorboard"
		"h_bath":
			return "tiles"
		"shop", "shop_stock":
			return "lino"
		"shed", "barn", "garage":
			return "earth" if t != "garage" else "concrete"
		"cellar", "cellar_store", "cellar_root":
			return "cellar_floor"
	return "lino"


## перекрытие: прямоугольник без проёмов-дыр (дыры — прямоугольники в системе блока)
## прямоугольник без дыр — до четырёх кусков вокруг каждой
func _rect_minus(r0: Rect2, holes: Array) -> Array:
	var rects: Array = [r0]
	for h in holes:
		var hr: Rect2 = h
		var nxt: Array = []
		for r in rects:
			var rr: Rect2 = r
			if not rr.intersects(hr):
				nxt.append(rr)
				continue
			var ix := rr.intersection(hr)
			# до 4 кусков вокруг дыры
			if ix.position.x > rr.position.x:
				nxt.append(Rect2(rr.position.x, rr.position.y, ix.position.x - rr.position.x, rr.size.y))
			if ix.end.x < rr.end.x:
				nxt.append(Rect2(ix.end.x, rr.position.y, rr.end.x - ix.end.x, rr.size.y))
			if ix.position.y > rr.position.y:
				nxt.append(Rect2(ix.position.x, rr.position.y, ix.size.x, ix.position.y - rr.position.y))
			if ix.end.y < rr.end.y:
				nxt.append(Rect2(ix.position.x, ix.end.y, ix.size.x, rr.end.y - ix.end.y))
		rects = nxt
	return rects


func _slab(bk: Dictionary, key: String, u0: float, u1: float, v0: float, v1: float, y: float, holes: Array, solid: bool) -> void:
	var rects := _rect_minus(Rect2(u0, v0, u1 - u0, v1 - v0), holes)
	for r in rects:
		var rr: Rect2 = r
		if solid:
			_lb(key, "slab", bk, rr.position.x, rr.end.x, y - SLAB, y, rr.position.y, rr.end.y, true)
		else:
			# пол первого этажа — чуть выше земли (иначе мерцает вместе с ней)
			_lb(key, "slab", bk, rr.position.x, rr.end.x, y - 0.03, y + 0.012, rr.position.y, rr.end.y)


## Ряды комнат по обе стороны коридора, вестибюль и лестничные клетки; двери из коридора.
func _corridor_rooms(bi: int, f: int) -> Array:
	var bk: Dictionary = blocks[bi]
	var y := f * storey
	var ik := "b%d/i%d" % [bi, f]
	var nk := "b%d/n%d" % [bi, f]
	var iv0: float = bk.iv0
	var iv1: float = bk.iv1
	var h := storey - SLAB
	var out: Array = []
	var types: Array = _types_for(f)
	# коридор: полоса v ∈ [−CW/2, CW/2] вдоль рядов комнат
	for sg in bk.segs:
		out.append({"u0": float(sg[0]), "u1": float(sg[1]), "v0": -CW * 0.5 + TI * 0.5, "v1": CW * 0.5 - TI * 0.5, "type": "cor", "side": 0})
	for side in [-1, 1]:
		var vin := CW * 0.5 * float(side)              # стена коридора
		var vout: float = iv1 if side > 0 else iv0
		var rs: Array = bk.split[side]
		# стена коридора по рядам с дверями
		for sg in bk.segs:
			var ops: Array = []
			for rr in rs:
				if float(rr[0]) >= float(sg[0]) - 0.01 and float(rr[1]) <= float(sg[1]) + 0.01:
					var ru0: float = rr[0]
					var ru1: float = rr[1]
					var dc := clampf(ru0 + 0.95 + _rng.randf() * maxf(ru1 - ru0 - 1.9, 0.0), ru0 + 0.75, ru1 - 0.75)
					ops.append([dc - DW * 0.5, dc + DW * 0.5])
					var t := String(_pick(types))
					out.append({"u0": ru0 + TI * 0.5, "u1": ru1 - TI * 0.5, "v0": minf(vin, vout) + (TI * 0.5 if side > 0 else 0.0), "v1": maxf(vin, vout) - (0.0 if side > 0 else TI * 0.5), "type": t, "side": side, "door": dc, "dv": vin})
			_iwall_u(bk, ik, float(sg[0]), float(sg[1]), vin, y, y + h, ops, f, float(side))
		# перегородки между комнатами (от стены коридора к наружной)
		var bounds := {}
		for rr in rs:
			bounds[snappedf(float(rr[0]), 0.01)] = true
			bounds[snappedf(float(rr[1]), 0.01)] = true
		for bu in bounds:
			if absf(float(bu) - float(bk.iu0)) < 0.05 or absf(float(bu) - float(bk.iu1)) < 0.05:
				continue
			_iwall_v(bk, ik, float(bu), minf(vin, vout), maxf(vin, vout), y, y + h, [])
	# вестибюль / холл этажа и лестничные клетки
	for by in bk.bays:
		var t := "stair"
		if String(by[2]) == "hall":
			t = String(def.get("hall0", "hall0")) if f == 0 else "lounge"
		out.append({"u0": float(by[0]) + TI * 0.5, "u1": float(by[1]) - TI * 0.5, "v0": iv0, "v1": iv1, "type": t, "side": 0})
	return out


## Зальный блок: зал и ряд комнат вдоль одной стены (row — [[вид, ширина], …]), двери из зала.
func _hall_rooms(bi: int, f: int) -> Array:
	var bk: Dictionary = blocks[bi]
	var y := f * storey
	var ik := "b%d/i%d" % [bi, f]
	var iu0: float = bk.iu0
	var iu1: float = bk.iu1
	var iv0: float = bk.iv0
	var iv1: float = bk.iv1
	var h := storey - SLAB
	var out: Array = []
	var side := int(bk.get("row_side", -1))
	var rd := float(bk.get("row_d", 4.5))
	var vw := iv0 + rd if side < 0 else iv1 - rd       # стена между залом и рядом
	var row: Array = bk.get("row", [])
	var u := iu0
	var rv0 := minf(vw, iv0 if side < 0 else iv1)
	var rv1 := maxf(vw, iv0 if side < 0 else iv1)
	var ops: Array = []
	for i in row.size():
		var t := String(row[i][0])
		var wdt := float(row[i][1])
		var u1 := minf(u + wdt, iu1) if i < row.size() - 1 else iu1
		var dc := clampf((u + u1) * 0.5 + _rng.randf_range(-0.8, 0.8), u + 0.8, u1 - 0.8)
		ops.append([dc - DW * 0.5, dc + DW * 0.5])
		out.append({"u0": u + TI * 0.5, "u1": u1 - TI * 0.5, "v0": rv0 + (0.0 if side < 0 else TI * 0.5), "v1": rv1 - (TI * 0.5 if side < 0 else 0.0), "type": t, "side": side, "door": dc, "dv": vw})
		if u1 < iu1 - 0.05:
			_iwall_v(bk, ik, u1, rv0, rv1, y, y + h, [])
		u = u1
	if not row.is_empty():
		_iwall_u(bk, ik, iu0, iu1, vw, y, y + h, ops, f, float(side))
	var hv0 := vw if side < 0 else iv0
	var hv1 := iv1 if side < 0 else vw
	if row.is_empty():
		hv0 = iv0
		hv1 = iv1
	out.append({"u0": iu0, "u1": iu1, "v0": hv0 + (TI * 0.5 if side < 0 and not row.is_empty() else 0.0), "v1": hv1 - (0.0 if side < 0 or row.is_empty() else TI * 0.5), "type": String(bk.get("hall_type", "warehouse")), "side": -side, "big": true, "doors": ops.map(func(o): return (float(o[0]) + float(o[1])) * 0.5), "dv": vw})
	return out


func _types_for(f: int) -> Array:
	var tt: Dictionary = def.get("types", {})
	if tt.has(str(f)):
		return tt[str(f)]
	return tt.get("*", [["office", 1]])


func _pick(arr: Array) -> String:
	var sum := 0.0
	for a in arr:
		sum += float(a[1])
	var r := _rng.randf() * sum
	for a in arr:
		r -= float(a[1])
		if r <= 0.0:
			return String(a[0])
	return String(arr[arr.size() - 1][0])


## перегородка вдоль u на линии v с дверными проёмами; двери ставятся в проёмы
func _iwall_u(bk: Dictionary, key: String, u0: float, u1: float, v: float, y0: float, y1: float, ops: Array, f: int, into_s: float) -> void:
	var s := u0
	for o in ops:
		var a: float = o[0]
		var b: float = o[1]
		_lb(key, String(def.get("int", "int_blue")), bk, s, a, y0, y1, v - TI * 0.5, v + TI * 0.5, true)
		_lb(key, String(def.get("int", "int_blue")), bk, a, b, y0 + DH, y1, v - TI * 0.5, v + TI * 0.5, true)
		# наличник
		_lb(key, "frame", bk, a - 0.07, a, y0, y0 + DH + 0.07, v - TI * 0.5 - 0.02, v + TI * 0.5 + 0.02)
		_lb(key, "frame", bk, b, b + 0.07, y0, y0 + DH + 0.07, v - TI * 0.5 - 0.02, v + TI * 0.5 + 0.02)
		_lb(key, "frame", bk, a - 0.07, b + 0.07, y0 + DH, y0 + DH + 0.07, v - TI * 0.5 - 0.02, v + TI * 0.5 + 0.02)
		if _rng.randf() > 0.12:
			# дверь открывается в комнату (от коридора, v = 0)
			_make_door([_w(bk, (a + b) * 0.5, y0, v), _wd(bk, 1, 0), _wd(bk, 0, into_s), b - a, DH, _rng.randf() < 0.45, blocks.find(bk), f, false])
		s = b
	_lb(key, String(def.get("int", "int_blue")), bk, s, u1, y0, y1, v - TI * 0.5, v + TI * 0.5, true)


func _iwall_v(bk: Dictionary, key: String, u: float, v0: float, v1: float, y0: float, y1: float, _ops: Array) -> void:
	_lb(key, String(def.get("int", "int_blue")), bk, u - TI * 0.5, u + TI * 0.5, y0, y1, v0, v1, true)


# ---------------- лестница ----------------

## где марш с этажа f на f+1: [u0, u1, v0, v1] (прямоугольник по плану), направление подъёма и сторона
func _flight_geo(bk: Dictionary, by: Array, f: int) -> Dictionary:
	var e: int = by[3]                                 # +1 — клетка в торце +u
	var u_in: float = float(by[0]) if e > 0 else float(by[1])     # граница с коридором
	var s0 := u_in + e * 1.1
	var s1 := s0 + e * RUN
	var side := -1 if f % 2 == 0 else 1
	var v0: float = (float(bk.iv0) + 0.08) if side < 0 else (float(bk.iv1) - 0.08 - FW)
	var bottom := s0 if f % 2 == 0 else s1
	var top := s1 if f % 2 == 0 else s0
	return {"u0": minf(s0, s1), "u1": maxf(s0, s1), "v0": v0, "v1": v0 + FW, "bottom": bottom, "top": top, "side": side}


func _flight_rect(bk: Dictionary, by: Array, f: int) -> Rect2:
	var g := _flight_geo(bk, by, f)
	return Rect2(float(g.u0) - 0.05, float(g.v0) - 0.05, float(g.u1) - float(g.u0) + 0.1, FW + 0.1)


## марш: ступени (видимые) и наклонная плоскость (столкновение — клин), перила на внутренней стороне
func _flight(bi: int, bk: Dictionary, by: Array, f: int) -> void:
	var g := _flight_geo(bk, by, f)
	var sk := "b%d/s%d" % [bi, f]
	var y0 := f * storey
	var h := storey
	var n := int(round(h / 0.18))
	var rise := h / n
	var run := RUN / n
	var dir := signf(float(g.top) - float(g.bottom))
	for i in n:
		var ua := float(g.bottom) + dir * i * run
		var ub := ua + dir * run
		_lb(sk, "tiles", bk, minf(ua, ub), maxf(ua, ub), y0, y0 + (i + 1) * rise, float(g.v0), float(g.v1))
	# клин столкновения: снизу у bottom на полу, сверху у top на уровне следующего этажа
	var pts := PackedVector3Array()
	for v in [float(g.v0), float(g.v1)]:
		pts.append(_w(bk, float(g.bottom), y0, v))
		pts.append(_w(bk, float(g.top), y0, v))
		pts.append(_w(bk, float(g.top), y0 + h, v))
	hulls.append(pts)
	# перила со стороны середины клетки (наклонные)
	var vi: float = float(g.v1) + 0.03 if int(g.side) < 0 else float(g.v0) - 0.03
	var ax := _wd(bk, 0, 1)
	var len_s := sqrt(RUN * RUN + h * h)
	var ang := atan2(h, RUN)
	var mid := _w(bk, (float(g.bottom) + float(g.top)) * 0.5, y0 + h * 0.5 + 0.95, vi)
	var along := _wd(bk, dir, 0)
	var bas := Basis(along.cross(Vector3.UP).normalized(), ang)
	_box(sk, "metal", (_ws(bk, len_s, 0.05, 0.06)), Transform3D(bas, mid))
	for k in 6:
		var t := (k + 0.5) / 6.0
		var uu := lerpf(float(g.bottom), float(g.top), t)
		_lb(sk, "metal", bk, uu - 0.015, uu + 0.015, y0 + h * t, y0 + h * t + 0.95, vi - 0.015, vi + 0.015)
	# перила марша — без столкновения: иначе у нижней ступени (вместе с перегородкой клетки) не пройти;
	# сойти с марша вбок безопасно — просто окажешься на этаже ниже


## перила вокруг проёма в перекрытии этажа f (над маршем с f−1): вдоль внутреннего края и поперёк у его низа
func _rails(bk: Dictionary, key: String, by: Array, f: int) -> void:
	var g := _flight_geo(bk, by, f - 1)
	var y := f * storey
	var vi: float = float(g.v1) + 0.05 if int(g.side) < 0 else float(g.v0) - 0.05
	_lb(key, "metal", bk, float(g.u0), float(g.u1), y + 0.9, y + 0.95, vi - 0.03, vi + 0.03)
	_lb(key, "metal", bk, float(g.u0), float(g.u1), y, y + 0.08, vi - 0.03, vi + 0.03)
	var u := float(g.u0)
	while u <= float(g.u1) + 0.01:
		_lb(key, "metal", bk, u - 0.015, u + 0.015, y, y + 0.95, vi - 0.015, vi + 0.015)
		u += 0.5
	# столкновение перил — короче на 0,9 м у верхней площадки: там поворачивают с марша (у торца перил цеплялись)
	var top_dir := signf(float(g.top) - float(g.bottom))
	var ca: float = g.bottom
	var cb: float = float(g.top) - top_dir * 0.9
	cols.append([_ws(bk, absf(cb - ca), 1.0, 0.08), Transform3D(Basis(), _w(bk, (ca + cb) * 0.5, y + 0.5, vi))])
	# поперёк — у нижнего конца марша (там проём глубже всего)
	var ub: float = g.bottom
	_lb(key, "metal", bk, ub - 0.03, ub + 0.03, y + 0.9, y + 0.95, float(g.v0), float(g.v1))
	_lb(key, "metal", bk, ub - 0.03, ub + 0.03, y, y + 0.95, float(g.v0) + FW * 0.5 - 0.015, float(g.v0) + FW * 0.5 + 0.015)
	cols.append([_ws(bk, 0.08, 1.0, FW), Transform3D(Basis(), _w(bk, ub, y + 0.5, (float(g.v0) + float(g.v1)) * 0.5))])


# ---------------- крыша ----------------

## плоская кровля: рубероид с мхом, парапет, карниз, вентиляционные короба, выходы с лестниц
func _roof(bi: int) -> void:
	var bk: Dictionary = blocks[bi]
	var rk := "b%d/r" % bi
	var top := int(bk.floors) * storey
	var hl: float = bk.hl
	var hw: float = bk.hw
	if style == "tent" or style == "wood":
		_roof_gable(bk, rk, top)
		return
	if style == "cellar":
		# перекрытие погреба (снизу — плита, сверху — слой земли до поверхности)
		_lb(rk, "slab", bk, -hl, hl, top - 0.2, top, -hw, hw)
		_lb(rk, "earth", bk, -hl - 0.1, hl + 0.1, top, -base_y - 0.03, -hw - 0.1, hw + 0.1)
		return
	if style == "box":
		# плоская крыша без парапета: лист с небольшим свесом
		var rmat := String(def.get("roof_mat", def.get("skin", "rust")))
		_lb(rk, rmat, bk, -hl - 0.04, hl + 0.04, top - 0.02, top + 0.07, -hw - 0.04, hw + 0.04)
		for k in int(float(bk.L) / 1.5):
			var u := -hl + 0.75 + k * 1.5
			_lb(rk, "metal", bk, u - 0.03, u + 0.03, top + 0.07, top + 0.1, -hw, hw)
		return
	_lb(rk, "roof", bk, -hl + 0.05, hl - 0.05, top - SLAB, top + 0.06, -hw + 0.05, hw - 0.05)
	# парапет и карниз
	var pm := String(def.get("skin", "facade"))
	_lb(rk, pm, bk, -hl, hl, top, top + 0.6, hw - 0.25, hw)
	_lb(rk, pm, bk, -hl, hl, top, top + 0.6, -hw, -hw + 0.25)
	_lb(rk, pm, bk, -hl, -hl + 0.25, top, top + 0.6, -hw, hw)
	_lb(rk, pm, bk, hl - 0.25, hl, top, top + 0.6, -hw, hw)
	# карниз и отлив по краю (полосами по периметру)
	for e in [[top + 0.6, top + 0.68, 0.1, 0.35], [top - 0.3, top - 0.12, 0.12, 0.14]]:
		var y0: float = e[0]
		var y1: float = e[1]
		var o: float = e[2]
		var d: float = e[3]
		_lb(rk, "trim", bk, -hl - o, hl + o, y0, y1, hw - d, hw + o)
		_lb(rk, "trim", bk, -hl - o, hl + o, y0, y1, -hw - o, -hw + d)
		_lb(rk, "trim", bk, -hl - o, -hl + d, y0, y1, -hw, hw)
		_lb(rk, "trim", bk, hl - d, hl + o, y0, y1, -hw, hw)
	for by in bk.bays:
		if String(by[2]) == "stair" and int(bk.floors) > 1:
			var m := (float(by[0]) + float(by[1])) * 0.5
			_lb(rk, pm, bk, m - 2.2, m + 2.2, top, top + 2.5, -hw * 0.5, hw * 0.5 - 1.0)
			_lb(rk, "roof", bk, m - 2.35, m + 2.35, top + 2.5, top + 2.62, -hw * 0.5 - 0.15, hw * 0.5 - 0.85)
	for k in int(float(bk.L) / 8.0) + 1:
		var u := _rng.randf_range(-hl + 2.0, hl - 2.0)
		var v := _rng.randf_range(-hw + 1.5, hw - 1.5)
		var s := _rng.randf_range(0.5, 1.1)
		_lb(rk, "rust" if _rng.randf() < 0.5 else "plinth", bk, u - s * 0.5, u + s * 0.5, top, top + _rng.randf_range(0.5, 1.2), v - s * 0.4, v + s * 0.4)


## двускатная крыша палатки: два ската со свесом, конёк, торцевые треугольники (ступенями под скатом), красный
## крест у медицинской
func _roof_gable(bk: Dictionary, rk: String, top: float) -> void:
	var hl: float = bk.hl
	var hw: float = bk.hw
	var skin := String(def.get("skin", "canvas"))
	var rmat := String(def.get("roof_mat", skin))
	var gmat := String(def.get("gable", skin))
	var rr := hw * float(def.get("rise", 0.5))
	var ov := float(def.get("ov", 0.3))
	var th := atan2(rr, hw)
	var sl := (hw + ov) / cos(th)
	var s_ax := 1.0 if String(bk.axis) == "x" else -1.0
	var ax := _wd(bk, 1, 0)
	for sv in [-1.0, 1.0]:
		var c := _w(bk, 0, top + rr - (hw + ov) * 0.5 * tan(th), sv * (hw + ov) * 0.5)
		var bas := Basis(ax, s_ax * sv * th)
		_box(rk, rmat, _ws(bk, float(bk.L) + 0.5 + (0.3 if style == "wood" else 0.0), 0.05 if style != "wood" else 0.08, sl), Transform3D(bas, c))
		if def.get("cross", false):
			var cc := _w(bk, 0, top + rr - hw * 0.5 * tan(th) + 0.05, sv * hw * 0.5)
			_box(rk, "fabric", _ws(bk, 1.1, 0.02, 1.1), Transform3D(bas, cc))
			_box(rk, "red", _ws(bk, 0.8, 0.03, 0.26), Transform3D(bas, cc))
			_box(rk, "red", _ws(bk, 0.26, 0.03, 0.8), Transform3D(bas, cc))
	_lb(rk, "wood", bk, -hl - 0.3, hl + 0.3, top + rr - 0.03, top + rr + 0.05, -0.04, 0.04)
	if style == "wood":
		# фронтон — ровный треугольник (у палатки — ступенями под скатом, её ткань так и висит)
		for e in [-1.0, 1.0]:
			var u0: float = e * hl - (te if e > 0.0 else 0.0)
			var u1: float = e * hl + (te if e < 0.0 else 0.0)
			_tri_prism(rk, gmat, [_w(bk, u0, top, -hw), _w(bk, u0, top, hw), _w(bk, u0, top + rr, 0)], _w(bk, u1, 0, 0) - _w(bk, u0, 0, 0))
			# причелины вдоль скатов и доска под коньком — у края крыши, чуть ниже кровли
			var ue: float = e * (hl + 0.38)
			for sv in [-1.0, 1.0]:
				var cc := _w(bk, ue, top + rr - (hw + ov) * 0.5 * tan(th) - 0.12, sv * (hw + ov) * 0.5)
				var bas2 := Basis(ax, s_ax * sv * th)
				_box(rk, "wframe", _ws(bk, 0.04, 0.2, sl), Transform3D(bas2, cc))
		# лобовая доска по свесу вдоль карниза
		for sv in [-1.0, 1.0]:
			var ye := top + rr - (hw + ov) * tan(th)
			_lb(rk, "wframe", bk, -hl - 0.4, hl + 0.4, ye - 0.2, ye - 0.02, sv * (hw + ov) - (0.04 if sv > 0.0 else 0.0), sv * (hw + ov) + (0.0 if sv > 0.0 else 0.04))
		if def.get("antenna", false):
			# телевизионная антенна на коньке
			var au := -hl * 0.4
			_lb(rk, "metal", bk, au - 0.025, au + 0.025, top + rr, top + rr + 1.7, -0.025, 0.025)
			for k in 3:
				var ay := top + rr + 1.1 + k * 0.22
				var aw := 0.9 - k * 0.18
				_lb(rk, "metal", bk, au - 0.015, au + 0.015, ay, ay + 0.03, -aw * 0.5, aw * 0.5)
	else:
		var n := 5
		for e in [-1.0, 1.0]:
			for i in n:
				var hv := hw * (1.0 - (i + 0.5) / n)
				_lb(rk, gmat, bk, e * hl - (te if e > 0.0 else 0.0), e * hl + (te if e < 0.0 else 0.0), top + i * rr / n, top + (i + 1) * rr / n + 0.01, -hv, hv)
	var house := style == "wood" and String(def.get("kind", "")) == "house"
	if style == "wood" and def.get("chimney", true):
		# печная труба над избой: модель Tripo (кирпич, жестяной колпак) или кирпичный столб
		var cu := hl * 0.35
		if house and ResourceLoader.exists("res://assets/world/kh_chimney.glb"):
			var by0 := top + rr * 0.65 - 0.35
			models.append(["kh_chimney", _w(bk, cu, by0, -hw * 0.35), 0.0, Vector3(0.62, rr * 0.35 + 1.35, 0.62), rk, 0.0])
		else:
			_lb(rk, "brick", bk, cu - 0.28, cu + 0.28, top, top + rr + 0.9, -hw * 0.35 - 0.28, -hw * 0.35 + 0.28)
	if house and ResourceLoader.exists("res://assets/world/kh_gable.glb"):
		# резьба под коньком на фронтонах — модель Tripo, лицом наружу
		for e in [-1.0, 1.0]:
			var nw2 := _wd(bk, e, 0)
			models.append(["kh_gable", _w(bk, e * (hl + 0.36), top + rr * 0.32, 0), atan2(nw2.x, nw2.z), Vector3(hw * 1.15, rr * 0.7, 0.18), rk, 0.0])


## треугольная призма: треугольник p (три точки, мир) и он же, сдвинутый на ext, — стенка фронтона
func _tri_prism(key: String, mat: String, p: Array, ext: Vector3) -> void:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var a: Vector3 = p[0]
	var b: Vector3 = p[1]
	var c: Vector3 = p[2]
	var q := [a + ext, b + ext, c + ext]
	var tris := [[a, c, b], [q[0], q[1], q[2]]]
	for e in [[a, b], [b, c], [c, a]]:
		var e0: Vector3 = e[0]
		var e1: Vector3 = e[1]
		tris.append([e0, e1, e1 + ext])
		tris.append([e0, e1 + ext, e0 + ext])
	var ctr := (a + b + c) / 3.0 + ext * 0.5
	for t in tris:
		var t0: Vector3 = t[0]
		var t1: Vector3 = t[1]
		var t2: Vector3 = t[2]
		var n := (t1 - t0).cross(t2 - t0).normalized()
		if n.dot((t0 + t1 + t2) / 3.0 - ctr) < 0.0:
			n = -n
		# обе стороны треугольника с наружной нормалью — порядок обхода не важен
		for tv in [[t0, t1, t2], [t0, t2, t1]]:
			for v in tv:
				st.set_normal(n)
				st.set_uv(Vector2((v as Vector3).x + (v as Vector3).z, (v as Vector3).y))
				st.add_vertex(v)
	st.generate_tangents()
	var mesh := st.commit()
	var k := key + "|" + mat
	if not _st.has(k):
		var st2 := SurfaceTool.new()
		st2.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[k] = st2
	(_st[k] as SurfaceTool).append_from(mesh, 0, Transform3D.IDENTITY)


## портик главного корпуса: колонны в два этажа, антаблемент, ступени
func _portico(p: Dictionary) -> void:
	var c: Vector2 = p.c
	var w := float(p.w)
	var d := float(p.d)
	var h := float(p.h)
	var dirv: Vector2 = p.dir                       # наружу от фасада
	var right := Vector2(-dirv.y, dirv.x)
	var key := "portico"
	var n := int(p.get("cols", 6))
	for i in n:
		var t := -w * 0.5 + 0.6 + i * (w - 1.2) / (n - 1)
		var q := c + right * t + dirv * (d - 0.6)
		_cylinder(key, "trim", 0.32, h, Transform3D(Basis(), Vector3(q.x, h * 0.5, q.y)), 14)
		_box(key, "plinth", Vector3(0.9, 0.3, 0.9), Transform3D(Basis(), Vector3(q.x, 0.15, q.y)))
		_box(key, "trim", Vector3(0.85, 0.22, 0.85), Transform3D(Basis(), Vector3(q.x, h - 0.11, q.y)))
		_col(Vector3(0.7, h, 0.7), Vector3(q.x, h * 0.5, q.y))
	var ctr := c + dirv * (d * 0.5)
	var yaw := atan2(dirv.x, dirv.y)
	var bas := Basis(Vector3.UP, yaw)
	_box(key, "trim", Vector3(w, 0.7, d), Transform3D(bas, Vector3(ctr.x, h + 0.35, ctr.y)))
	_box(key, "roof", Vector3(w - 0.3, 0.1, d - 0.3), Transform3D(bas, Vector3(ctr.x, h + 0.72, ctr.y)))
	# фронтон — треугольник ступенями
	for k in 4:
		_box(key, "trim", Vector3(w * (1.0 - k * 0.22), 0.35, 0.5), Transform3D(bas, Vector3(c.x + dirv.x * (d - 0.25), h + 0.7 + k * 0.35 + 0.17, c.y + dirv.y * (d - 0.25))))
	for k in 3:
		var dd := d + 1.6 - k * 0.5
		var st := c + dirv * (dd * 0.5)
		_box(key, "slab", Vector3(w + 1.0 - k * 0.3, 0.12 + k * 0.1, dd), Transform3D(bas, Vector3(st.x, (0.12 + k * 0.1) * 0.5, st.y)))


# ---------------- мебель ----------------

## Обстановка комнаты по виду. Вещи ставятся к стенам (не в проходы у дверей), часть — тайники.
func _furnish(bk: Dictionary, r: Dictionary, nk: String, ik: String) -> void:
	_placed.clear()
	_keep.clear()
	var y: float = r.y
	var t := String(r.type)
	# проход у двери в комнату (и в коридоре напротив)
	if r.has("door"):
		var dc: float = r.door
		var dv: float = r.dv
		var inward := signf(((float(r.v0) + float(r.v1)) * 0.5) - dv)
		var d0 := dv
		var d1 := dv + inward * 1.35
		_keep.append(Rect2(dc - DW * 0.5 - 0.2, minf(d0, d1), DW + 0.4, absf(d1 - d0)))
	# зал с дверями в ряд комнат — проход у каждой двери со стороны зала
	for dc2 in r.get("doors", []):
		var dv2: float = r.dv
		var inw := signf(((float(r.v0) + float(r.v1)) * 0.5) - dv2)
		_keep.append(Rect2(float(dc2) - DW * 0.5 - 0.25, minf(dv2, dv2 + inw * 1.4), DW + 0.5, 1.4))
	for o in _room_links(bk, r):
		_keep.append(o)
	if style != "":
		# у входа в палатку или кунг — свободно
		for e in bk.ent:
			var es := float(e[1])
			var ew := float(e[2]) + 0.5
			match String(e[0]):
				"s+":
					_keep.append(Rect2(es - ew * 0.5, float(bk.iv1) - 1.3, ew, 1.3))
				"s-":
					_keep.append(Rect2(es - ew * 0.5, float(bk.iv0), ew, 1.3))
				"e+":
					_keep.append(Rect2(float(bk.iu1) - 1.3, es - ew * 0.5, 1.3, ew))
				_:
					_keep.append(Rect2(float(bk.iu0), es - ew * 0.5, 1.3, ew))
	var ctx := {"bk": bk, "r": r, "nk": nk, "ik": ik, "y": y}
	match t:
		"cor":
			_corridor_decor(ctx)
		"ward":
			_beds_ext(ctx, "bed", true)
			_try(ctx, "m_medcab", ["l", "r"], 0.6)
			if _rng.randf() < 0.35:
				_try(ctx, "m_wheel", ["cor", "l", "r"], 0.85)
			_try(ctx, "sink", ["cor", "l"], 0.3)
			_try(ctx, "chair", ["l", "r", "cor"], 0.5)
			if _rng.randf() < 0.5:
				_try(ctx, "suitcase", ["l", "r"], 0.5)
		"proc":
			_try(ctx, "couch", ["l", "r"], 0.5)
			_try(ctx, "m_medcab", ["ext", "r", "l"], 0.2)
			_try(ctx, "m_medcab", ["ext", "r", "l"], 0.8)
			_try(ctx, "sink", ["cor"], 0.8)
			_try(ctx, "desk", ["ext"], 0.5)
			_try(ctx, "drip", ["l", "r"], 0.3)
		"nurse":
			_try(ctx, "desk", ["ext"], 0.5)
			_try(ctx, "m_medcab", ["l"], 0.4)
			_try(ctx, "m_medcab", ["r"], 0.4)
			_try(ctx, "sofa", ["r", "l"], 0.6)
			_try(ctx, "sink", ["cor"], 0.7)
		"office":
			_try(ctx, "desk", ["ext"], 0.5)
			_try(ctx, "wardrobe", ["l", "r"], 0.25)
			_try(ctx, "shelf", ["r", "l"], 0.7)
			_try(ctx, "chair", ["l", "r"], 0.6)
			_try(ctx, "board", ["l", "r"], 0.5)
		"staff":
			_try(ctx, "locker", ["l", "r"], 0.3)
			_try(ctx, "locker", ["l", "r"], 0.75)
			_center_model(ctx, "m_sntable")
			_try(ctx, "sofa", ["ext", "r"], 0.5)
			_try(ctx, "sink", ["cor"], 0.8)
		"room":
			_beds_side(ctx)
			_try(ctx, "bedside", ["ext"], 0.5)
			_try(ctx, "wardrobe", ["cor", "l"], 0.15)
			_try(ctx, "chair", ["ext", "l", "r"], 0.8)
			if _rng.randf() < 0.6:
				_try(ctx, "suitcase", ["l", "r"], 0.75)
			_bath(ctx)
		"wc":
			_stalls(ctx)
			_try(ctx, "sink", ["cor"], 0.3)
			_try(ctx, "sink", ["cor"], 0.7)
		"store", "linen", "archive":
			for k in 3:
				_try(ctx, "shelf", ["l", "r", "ext"], 0.2 + k * 0.3)
			_try(ctx, "crate", ["ext", "l", "r"], 0.5)
			_try(ctx, "crate", ["l", "r"], 0.8)
		"hall0", "hall_med", "hall_res":
			_try(ctx, "reception", ["ext", "l", "r"], 0.5)
			_try(ctx, "bench", ["l", "r"], 0.3)
			_try(ctx, "bench", ["l", "r"], 0.7)
			_try(ctx, "board", ["l", "r"], 0.5)
			_try(ctx, "plant", ["ext", "l", "r"], 0.1)
			_try(ctx, "plant", ["ext", "l", "r"], 0.9)
			_try(ctx, "m_wheel", ["l", "r", "ext"], 0.15)
		"lounge":
			_try(ctx, "sofa", ["ext"], 0.35)
			_try(ctx, "sofa", ["l", "r"], 0.5)
			_try(ctx, "tv", ["l", "r"], 0.5)
			_center_model(ctx, "m_sntable")
			_try(ctx, "plant", ["ext", "l", "r"], 0.9)
		"kitchen":
			for k in 4:
				_try(ctx, "kcab", ["ext"], 0.1 + k * 0.12)
			_try(ctx, "stove", ["ext", "l"], 0.75)
			_try(ctx, "stove", ["l", "r"], 0.5)
			_try(ctx, "sink", ["ext", "r"], 0.95)
			_try(ctx, "kcab", ["r", "l"], 0.3)
			_center(ctx, "worktable")
		"cold", "pantry":
			for k in 3:
				_try(ctx, "shelf", ["l", "r", "ext"], 0.2 + k * 0.3)
			_try(ctx, "crate", ["ext", "l", "r"], 0.5)
			_try(ctx, "kcab", ["l", "r"], 0.8)
		"club":
			_center(ctx, "billiard")
			_try(ctx, "sofa", ["ext", "l"], 0.5)
			_try(ctx, "m_piano", ["l", "r"], 0.5)
			_try(ctx, "chair", ["r", "l"], 0.3)
			_try(ctx, "plant", ["ext"], 0.95)
		"tech":
			_try(ctx, "panel", ["l", "r", "ext"], 0.3)
			_try(ctx, "panel", ["l", "r", "ext"], 0.6)
			_try(ctx, "workbench", ["ext", "l"], 0.5)
			_try(ctx, "shelf", ["r"], 0.5)
		"workshop":
			_try(ctx, "workbench", ["ext"], 0.3)
			_try(ctx, "workbench", ["l", "r"], 0.6)
			_try(ctx, "shelf", ["l", "r"], 0.3)
			_try(ctx, "crate", ["l", "r", "ext"], 0.85)
		"stair":
			pass
		"dining":
			_dining(ctx)
		"boiler":
			_boiler_hall(ctx)
		"warehouse":
			_warehouse(ctx)
		"tent_hq":
			ctx["ckind"] = "mil_docs"
			_center(ctx, "table4")
			_try(ctx, "radio", ["cor", "l", "r"], 0.3)
			_try(ctx, "mcab", ["cor", "l", "r"], 0.75)
			_try(ctx, "board", ["l", "r"], 0.5)
			_try(ctx, "board", ["cor"], 0.5)
			_try(ctx, "acrate", ["l", "r", "cor"], 0.2)
			_try(ctx, "acrate", ["r", "l", "ext"], 0.8)
		"tent_med":
			ctx["ckind"] = "mil_med"
			_try(ctx, "cot", ["ext"], 0.22)
			_try(ctx, "cot", ["ext"], 0.66)
			_try(ctx, "cot", ["cor"], 0.25)
			_try(ctx, "medcab", ["l", "cor"], 0.3)
			_try(ctx, "medcab", ["l", "cor"], 0.75)
			_try(ctx, "medbag", ["cor", "ext"], 0.62)
			_try(ctx, "medbag", ["ext", "cor"], 0.45)
			_try(ctx, "acrate", ["cor", "l"], 0.82)
			_try(ctx, "drip", ["ext", "cor"], 0.45)
		"tent_live":
			ctx["ckind"] = "mil_gear"
			_try(ctx, "cot", ["ext"], 0.22)
			_try(ctx, "cot", ["ext"], 0.66)
			_try(ctx, "cot", ["cor"], 0.22)
			_try(ctx, "cot", ["cor"], 0.66)
			_try(ctx, "duffel", ["ext", "l"], 0.45)
			_try(ctx, "duffel", ["cor", "l"], 0.45)
			_try(ctx, "duffel", ["l", "r"], 0.3)
			_try(ctx, "bedside", ["l", "r"], 0.7)
			_try(ctx, "acrate", ["l", "r"], 0.5)
		"kung":
			ctx["ckind"] = "mil_docs"
			_try(ctx, "desk", ["l"], 0.5)
			_try(ctx, "radio", ["cor"], 0.45)
			_try(ctx, "mcab", ["r", "cor"], 0.5)
			_try(ctx, "acrate", ["cor"], 0.75)
			_try(ctx, "board", ["cor"], 0.2)
		"guard":
			ctx["ckind"] = "mil_gear"
			_try(ctx, "desk", ["ext", "cor"], 0.5)
			_try(ctx, "mcab", ["r", "cor"], 0.3)
			_try(ctx, "radio", ["cor", "ext"], 0.7)
			_try(ctx, "chair", ["r", "cor"], 0.8)
		"izba":
			# общая комната (у входа — прихожая): буфет, шкаф, диван, телевизор, стол со стульями, вешалка
			_try(ctx, "m_sideboard", ["cor", "l", "r"], 0.3)
			_try(ctx, "m_wardrobe", ["l", "r", "cor"], 0.6)
			_try(ctx, "sofa", ["cor", "l", "r"], 0.8)
			_try(ctx, "tv", ["l", "r"], 0.4)
			_center_model(ctx, "m_table")
			_try(ctx, "bedside", ["ext", "l", "r"], 0.12)
		"h_kitchen":
			_try(ctx, "m_stove", ["ext", "l", "r"], 0.2)
			_try(ctx, "m_fridge", ["l", "r", "ext"], 0.85)
			_try(ctx, "kcab", ["ext", "l", "r"], 0.55)
			_try(ctx, "kcab", ["l", "r", "cor"], 0.4)
			_try(ctx, "washstand", ["cor", "l", "r"], 0.2)
			_center_model(ctx, "m_table")
		"h_bed":
			_try(ctx, "m_bed", ["ext", "l", "r"], 0.3)
			if _rng.randf() < 0.5:
				_try(ctx, "m_bed", ["ext", "l", "r"], 0.8)
			_try(ctx, "m_wardrobe", ["l", "r", "cor"], 0.5)
			_try(ctx, "bedside", ["ext", "l", "r"], 0.6)
			_try(ctx, "suitcase", ["l", "r", "cor"], 0.3)
		"h_pantry":
			_try(ctx, "m_jars", ["ext", "l", "r"], 0.5)
			_try(ctx, "m_sacks", ["l", "r", "cor"], 0.5)
			_try(ctx, "m_cans", ["r", "l", "cor"], 0.7)
		"h_bath":
			_try(ctx, "tub", ["ext", "l", "r"], 0.5)
			_try(ctx, "washstand", ["l", "r", "cor"], 0.4)
		"shop":
			# торговый зал: прилавок с весами и кассой, полки, холодильники с напитками
			_try(ctx, "m_counter", ["cor"], 0.35)
			for k in 3:
				_try(ctx, "m_shopshelf", ["l", "r", "ext"], 0.2 + k * 0.3)
			_try(ctx, "m_drinks", ["cor", "l", "r"], 0.85)
			_try(ctx, "m_drinks", ["ext", "l", "r"], 0.12)
		"shop_back":
			_try(ctx, "desk", ["ext", "l", "r"], 0.4)
			_try(ctx, "m_wardrobe", ["l", "r"], 0.5)
			_try(ctx, "crate", ["l", "r", "cor"], 0.7)
		"shop_stock":
			_try(ctx, "m_shopshelf", ["ext", "l", "r"], 0.3)
			_try(ctx, "m_sacks", ["ext", "l", "r"], 0.8)
			_try(ctx, "m_cans", ["l", "r", "cor"], 0.5)
			_try(ctx, "crate", ["l", "r", "cor"], 0.3)
		"shed":
			# сарай: верстак, полки с инструментом, ящики, бочки, сено, хлам
			_try(ctx, "workbench", ["ext", "l", "r"], 0.4)
			_try(ctx, "shelf", ["l", "r", "ext"], 0.75)
			_try(ctx, "toolbox", ["l", "r", "cor"], 0.3)
			_try(ctx, "barrel", ["l", "r", "cor", "ext"], 0.9)
			_try(ctx, "m_cans", ["l", "r", "ext"], 0.5)
			_try(ctx, "crate", ["l", "r", "ext"], 0.2)
		"barn":
			for k in 4:
				_try(ctx, "hay", ["ext", "l", "r"], 0.12 + k * 0.25)
			_try(ctx, "m_sacks", ["l", "r", "cor"], 0.6)
			_try(ctx, "barrel", ["l", "r", "cor"], 0.3)
			_try(ctx, "toolbox", ["cor", "l", "r"], 0.8)
		"garage":
			_try(ctx, "workbench", ["ext"], 0.5)
			_try(ctx, "tyres", ["l", "r"], 0.8)
			_try(ctx, "shelf", ["l", "r"], 0.3)
			_try(ctx, "toolbox", ["l", "r", "ext"], 0.6)
			_try(ctx, "barrel", ["l", "r"], 0.95)
		"cellar":
			# зал подвала: стол с лампой и банками, полки с закатками, бидоны, мешки, ящик
			if (float(r.u1) - float(r.u0)) * (float(r.v1) - float(r.v0)) > 18.0:
				_center_model(ctx, "m_table")
			_try(ctx, "m_jars", ["l", "r"], 0.5)
			_try(ctx, "m_cans", ["ext", "r", "l"], 0.15)
			_try(ctx, "m_sacks", ["ext", "l", "r"], 0.85)
			_try(ctx, "crate", ["cor", "l", "r"], 0.12)
			_try(ctx, "bin", ["l", "r", "cor"], 0.6)
		"cellar_store":
			# кладовая: стеллажи с закатками вдоль стен, ящики, бочка, бидоны
			_try(ctx, "m_jars", ["ext"], 0.27)
			_try(ctx, "m_jars", ["ext"], 0.75)
			_try(ctx, "m_jars", ["l", "r"], 0.4)
			_try(ctx, "crate", ["r", "l", "cor"], 0.75)
			_try(ctx, "barrel", ["cor", "l", "r"], 0.85)
			_try(ctx, "m_cans", ["l", "r", "cor"], 0.2)
		"cellar_root":
			# овощная: закрома с картошкой, мешки, ящик
			_try(ctx, "bin", ["ext"], 0.25)
			_try(ctx, "bin", ["ext"], 0.78)
			_try(ctx, "m_sacks", ["l", "r", "cor"], 0.45)
			_try(ctx, "m_sacks", ["r", "l"], 0.8)
			_try(ctx, "crate", ["cor", "l", "r"], 0.8)
		"cstore":
			ctx["ckind"] = "mil_ammo"
			for k in 3:
				_try(ctx, "acrate", ["ext"], 0.15 + k * 0.27)
			for k in 2:
				_try(ctx, "acrate", ["cor"], 0.25 + k * 0.3)
			_try(ctx, "shelf", ["l"], 0.5)
	# сор: листы бумаги, опрокинутые стулья, осколки
	if t != "stair" and t != "boiler":
		for k in _rng.randi_range(0, 3 if t != "cor" else 2):
			var p := _free_pt(r, 0.3)
			if p.x > 1e8:
				break
			var c := _w(bk, p.x, y + 0.03, p.y)
			_box(nk, "fabric", Vector3(0.3, 0.004, 0.22), Transform3D(Basis(Vector3.UP, _rng.randf() * TAU), c))
	# места для врагов и хлама
	var nsp := 1 if (float(r.u1) - float(r.u0)) * (float(r.v1) - float(r.v0)) < 25.0 else 3
	if t == "stair":
		nsp = 0
	for k in nsp:
		var p := _free_pt(r, 0.45)
		if p.x > 1e8:
			break
		spots.append([_w(bk, p.x, y, p.y), "%s:%s:%d" % [id, t, int(r.get("f", 0))]])
	if t != "cor" and t != "stair" and _rng.randf() < 0.6:
		var p := _free_pt(r, 0.35)
		if p.x < 1e8:
			junk.append(_w(bk, p.x, y + 0.02, p.y))


## проходы у сквозных проёмов между блоками
func _room_links(bk: Dictionary, r: Dictionary) -> Array:
	var out: Array = []
	for lk in def.get("links", []):
		var l := _local(bk, Vector3(float(lk[0].x), 0, float(lk[0].y)))
		var rr := Rect2(float(r.u0) - 1.0, float(r.v0) - 1.0, float(r.u1) - float(r.u0) + 2.0, float(r.v1) - float(r.v0) + 2.0)
		if rr.has_point(l):
			out.append(Rect2(l.x - 1.6, l.y - 1.6, 3.2, 3.2))
	return out


## свободная точка в комнате (не в мебели, с отступом m от стен)
func _free_pt(r: Dictionary, m: float) -> Vector2:
	for k in 30:
		var p := Vector2(_rng.randf_range(float(r.u0) + m, float(r.u1) - m), _rng.randf_range(float(r.v0) + m, float(r.v1) - m))
		var ok := true
		for q in _placed:
			if (q as Rect2).grow(m).has_point(p):
				ok = false
				break
		if ok:
			return p
	return Vector2(1e9, 1e9)


## Рамка стены комнаты: начало у стены, a — вдоль неё, n — внутрь комнаты (оси u/v блока).
## wall: ext — наружная стена, cor — стена с дверью, l / r — перегородки слева и справа (по u).
func _wall_frame(r: Dictionary, wall: String) -> Dictionary:
	var side: int = r.get("side", 0)
	var u0: float = r.u0
	var u1: float = r.u1
	var v0: float = r.v0
	var v1: float = r.v1
	var ext_hi := side > 0 or (side == 0 and true)
	match wall:
		"ext":
			if ext_hi:
				return {"o": Vector2(u0, v1), "a": Vector2(1, 0), "n": Vector2(0, -1), "len": u1 - u0}
			return {"o": Vector2(u0, v0), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": u1 - u0}
		"cor":
			if ext_hi:
				return {"o": Vector2(u0, v0), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": u1 - u0}
			return {"o": Vector2(u0, v1), "a": Vector2(1, 0), "n": Vector2(0, -1), "len": u1 - u0}
		"l":
			return {"o": Vector2(u0, v0), "a": Vector2(0, 1), "n": Vector2(1, 0), "len": v1 - v0}
	return {"o": Vector2(u1, v0), "a": Vector2(0, 1), "n": Vector2(-1, 0), "len": v1 - v0}


const SIZES := {
	"bed": Vector2(0.95, 2.05), "bedside": Vector2(0.45, 0.42), "wardrobe": Vector2(1.0, 0.58), "desk": Vector2(1.3, 1.2),
	"chair": Vector2(0.48, 0.48), "medcab": Vector2(0.8, 0.42), "couch": Vector2(1.95, 0.7), "sink": Vector2(0.55, 0.45),
	"locker": Vector2(1.25, 0.5), "sofa": Vector2(1.85, 0.85), "shelf": Vector2(1.25, 0.48), "crate": Vector2(0.85, 0.65),
	"kcab": Vector2(0.62, 0.62), "stove": Vector2(1.25, 0.82), "reception": Vector2(3.0, 1.0), "bench": Vector2(1.7, 0.48),
	"plant": Vector2(0.6, 0.6), "board": Vector2(1.3, 0.06), "tv": Vector2(0.9, 0.5), "piano": Vector2(1.5, 0.62),
	"panel": Vector2(0.9, 0.35), "workbench": Vector2(2.0, 0.8), "suitcase": Vector2(0.65, 0.28), "drip": Vector2(0.45, 0.45),
	"cot": Vector2(1.95, 0.75), "acrate": Vector2(1.0, 0.5), "radio": Vector2(1.0, 0.6), "mcab": Vector2(0.9, 0.45), "duffel": Vector2(0.75, 0.36),
	"medbag": Vector2(0.5, 0.3),
	"gurney": Vector2(2.0, 0.7),
	# хутор: мебель — модели Tripo (MODEL_KINDS); столкновение и тайник — по этой коробке
	"m_fridge": Vector2(0.62, 0.62), "m_stove": Vector2(0.62, 0.62), "m_wardrobe": Vector2(1.1, 0.58), "m_sideboard": Vector2(1.3, 0.5),
	"m_jars": Vector2(1.2, 0.42), "m_bed": Vector2(0.95, 2.0), "m_counter": Vector2(1.7, 0.85), "m_shopshelf": Vector2(1.5, 0.5),
	"m_sacks": Vector2(1.0, 0.8), "m_cans": Vector2(1.0, 0.6), "m_drinks": Vector2(0.7, 0.65), "m_table": Vector2(1.5, 1.3),
	"m_medcab": Vector2(0.8, 0.45), "m_piano": Vector2(1.5, 0.62), "m_sntable": Vector2(1.5, 1.4), "m_wheel": Vector2(0.65, 0.95),
	"washstand": Vector2(0.6, 0.45), "tub": Vector2(1.6, 0.75), "toolbox": Vector2(0.7, 0.4), "hay": Vector2(1.2, 0.9),
	"bin": Vector2(1.2, 0.9), "barrel": Vector2(0.6, 0.6), "tyres": Vector2(0.75, 0.75),
}
## мебель-модель: [файл (assets/world), высота, вид тайника, название тайника] («» — не обыскивается)
const MODEL_KINDS := {
	"m_fridge": ["kh_fridge", 1.55, "fridge", "Холодильник"], "m_stove": ["kh_stove", 0.95, "", ""],
	"m_wardrobe": ["kh_wardrobe", 1.95, "wardrobe", "Шкаф"], "m_sideboard": ["kh_sideboard", 1.9, "sideboard", "Буфет"],
	"m_jars": ["kh_jar_shelf", 1.8, "jars", "Полка с закатками"], "m_bed": ["kh_bed", 1.0, "", ""],
	"m_counter": ["kh_counter", 1.25, "counter", "Прилавок"], "m_shopshelf": ["kh_shop_shelf", 1.9, "shop", "Полка магазина"],
	"m_sacks": ["kh_sacks", 0.8, "sacks", "Мешки с картошкой"], "m_cans": ["kh_cans", 0.9, "cans", "Бидоны и канистры"],
	"m_drinks": ["kh_fridge", 1.6, "drinks", "Холодильник с напитками"], "m_table": ["kh_table_set", 1.0, "", ""],
	"m_medcab": ["sn_medcab", 1.85, "med", "Медицинский шкаф"], "m_piano": ["sn_piano", 1.3, "", ""],
	"m_sntable": ["sn_table", 0.85, "", ""], "m_wheel": ["sn_wheelchair", 0.95, "", ""],
}


## поставить вещь kind к одной из стен walls в долю t длины стены; удалось ли
func _try(ctx: Dictionary, kind: String, walls: Array, t: float) -> bool:
	var sz: Vector2 = SIZES[kind]
	for wl in walls:
		var fr := _wall_frame(ctx.r, String(wl))
		var len_w: float = fr.len
		if len_w < sz.x + 0.1:
			continue
		for dt in [0.0, 0.13, -0.13, 0.26, -0.26]:
			var tt := clampf(t + float(dt), 0.0, 1.0)
			var x := clampf(tt * len_w, sz.x * 0.5 + 0.05, len_w - sz.x * 0.5 - 0.05)
			var off := 0.02 if kind != "board" else 0.0
			var rr := _item_rect(fr, x, sz, off)
			if _fits(ctx.r, rr, kind == "board"):
				_placed.append(rr)
				_emit(ctx, kind, fr, x, off)
				return true
	return false


func _item_rect(fr: Dictionary, x: float, sz: Vector2, off: float) -> Rect2:
	var o: Vector2 = fr.o
	var a: Vector2 = fr.a
	var n: Vector2 = fr.n
	var p0 := o + a * (x - sz.x * 0.5) + n * off
	var p1 := o + a * (x + sz.x * 0.5) + n * (off + sz.y)
	return Rect2(Vector2(minf(p0.x, p1.x), minf(p0.y, p1.y)), (p1 - p0).abs())


func _fits(r: Dictionary, rr: Rect2, flat := false) -> bool:
	var room := Rect2(float(r.u0) - 0.01, float(r.v0) - 0.01, float(r.u1) - float(r.u0) + 0.02, float(r.v1) - float(r.v0) + 0.02)
	if not room.encloses(rr):
		return false
	if flat:
		return true
	for q in _placed:
		if (q as Rect2).intersects(rr):
			return false
	for q in _keep:
		if (q as Rect2).intersects(rr):
			return false
	return true


## коробка вещи в её собственной системе: x — вдоль стены (от −w/2 до w/2 вокруг x0), z — от стены внутрь
func _ib(ctx: Dictionary, fr: Dictionary, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float, mat: String, col := false, key := "") -> void:
	var o: Vector2 = fr.o
	var a: Vector2 = fr.a
	var n: Vector2 = fr.n
	var p0 := o + a * x0 + n * z0
	var p1 := o + a * x1 + n * z1
	var y: float = ctx.y
	_lb(key if key != "" else String(ctx.nk), mat, ctx.bk, minf(p0.x, p1.x), maxf(p0.x, p1.x), y + y0, y + y1, minf(p0.y, p1.y), maxf(p0.y, p1.y), col)


## только столкновение вещи (в её системе)
func _icol(ctx: Dictionary, fr: Dictionary, x0: float, x1: float, y0: float, y1: float, z0: float, z1: float) -> void:
	var o: Vector2 = fr.o
	var a: Vector2 = fr.a
	var n: Vector2 = fr.n
	var p0 := o + a * x0 + n * z0
	var p1 := o + a * x1 + n * z1
	var bk: Dictionary = ctx.bk
	var y: float = ctx.y
	var c := _w(bk, (p0.x + p1.x) * 0.5, y + (y0 + y1) * 0.5, (p0.y + p1.y) * 0.5)
	cols.append([_ws(bk, absf(p1.x - p0.x), y1 - y0, absf(p1.y - p0.y)), Transform3D(Basis(), c)])


## тайник: запомнить, где он (для обыска)
func _cont(ctx: Dictionary, fr: Dictionary, x: float, sz: Vector2, h: float, kind: String, n: String, off := 0.0) -> void:
	var o: Vector2 = fr.o
	var a: Vector2 = fr.a
	var nn: Vector2 = fr.n
	var c := o + a * x + nn * (off + sz.y * 0.5)
	var bk: Dictionary = ctx.bk
	var r: Dictionary = ctx.r
	var w := _w(bk, c.x, float(ctx.y), c.y)
	var size := _ws(bk, absf(a.x) * sz.x + absf(nn.x) * sz.y, h, absf(a.y) * sz.x + absf(nn.y) * sz.y)
	containers.append({"pos": w, "size": size, "kind": kind, "n": n, "bi": blocks.find(bk), "f": int(r.f), "bld": id, "i": _cnt})
	_cnt += 1


func _emit(ctx: Dictionary, kind: String, fr: Dictionary, x: float, off: float) -> void:
	var sz: Vector2 = SIZES[kind]
	var a := x - sz.x * 0.5
	var b := x + sz.x * 0.5
	var z0 := off
	var z1 := off + sz.y
	match kind:
		"bed":
			_bed(ctx, fr, a, b, z0, z1, false)
		"bedside":
			_ib(ctx, fr, a, b, 0, 0.62, z0, z1, "wood", true)
			_ib(ctx, fr, a + 0.03, b - 0.03, 0.4, 0.42, z1 - 0.005, z1 + 0.005, "metal")
			_cont(ctx, fr, x, sz, 0.62, "bedside", "Тумбочка", off)
		"wardrobe":
			_ib(ctx, fr, a, b, 0, 1.95, z0, z1, "wood", true)
			_ib(ctx, fr, x - 0.01, x + 0.01, 0.1, 1.85, z1 - 0.005, z1 + 0.004, "metal")
			_cont(ctx, fr, x, sz, 1.95, "wardrobe", "Шкаф", off)
		"desk":
			_ib(ctx, fr, a, b, 0.72, 0.76, z0, z0 + 0.7, "wood", true)
			_ib(ctx, fr, a, a + 0.42, 0, 0.72, z0, z0 + 0.68, "wood")
			_ib(ctx, fr, b - 0.05, b, 0, 0.72, z0, z0 + 0.68, "wood")
			_ib(ctx, fr, x - 0.22, x + 0.22, 0, 0.45, z0 + 0.75, z0 + 1.15, "leather")
			_ib(ctx, fr, x - 0.22, x + 0.22, 0.45, 0.95, z0 + 1.1, z0 + 1.15, "leather")
			_ib(ctx, fr, x - 0.25, x + 0.05, 0.76, 0.78, z0 + 0.15, z0 + 0.45, "fabric")
			_cont(ctx, fr, x, Vector2(1.3, 0.7), 0.76, "desk", "Письменный стол", off)
		"chair":
			_ib(ctx, fr, a + 0.02, b - 0.02, 0.43, 0.47, z0 + 0.02, z1 - 0.02, "wood")
			_ib(ctx, fr, a + 0.02, b - 0.02, 0.47, 0.92, z0, z0 + 0.05, "wood")
			for lx in [a + 0.04, b - 0.08]:
				for lz in [z0 + 0.02, z1 - 0.06]:
					_ib(ctx, fr, lx, lx + 0.04, 0, 0.43, lz, lz + 0.04, "wood")
		"medcab":
			_ib(ctx, fr, a, b, 0, 1.75, z0, z1, "wmetal", true)
			_ib(ctx, fr, a + 0.06, b - 0.06, 0.5, 1.68, z1 - 0.01, z1 + 0.005, "glass")
			_cont(ctx, fr, x, sz, 1.75, "med", "Медицинский шкаф", off)
		"couch":
			_ib(ctx, fr, a, b, 0.0, 0.5, z0 + 0.05, z1, "wmetal", true)
			_ib(ctx, fr, a, b, 0.5, 0.62, z0 + 0.05, z1, "leather")
			_ib(ctx, fr, a, a + 0.5, 0.62, 0.72, z0 + 0.05, z1, "leather")
		"sink":
			_ib(ctx, fr, a, b, 0.72, 0.86, z0, z1, "wmetal", true)
			_ib(ctx, fr, x - 0.04, x + 0.04, 0, 0.72, z0, z0 + 0.08, "metal")
			_ib(ctx, fr, x - 0.2, x + 0.2, 1.2, 1.7, z0, z0 + 0.02, "glass")
		"drip":
			_ib(ctx, fr, x - 0.02, x + 0.02, 0, 1.8, z0 + 0.2, z0 + 0.24, "metal")
			_ib(ctx, fr, x - 0.2, x + 0.2, 0, 0.04, z0 + 0.02, z1 - 0.02, "metal")
		"locker":
			for k in 3:
				var la := a + k * sz.x / 3.0
				_ib(ctx, fr, la + 0.01, la + sz.x / 3.0 - 0.01, 0, 1.85, z0, z1, "gmetal", false)
				_ib(ctx, fr, la + 0.05, la + 0.25, 1.55, 1.65, z1 - 0.005, z1 + 0.004, "metal")
			_icol(ctx, fr, a, b, 0, 1.85, z0, z1)
			_cont(ctx, fr, x, sz, 1.85, "locker", "Шкафчики персонала", off)
		"sofa":
			_ib(ctx, fr, a, b, 0.0, 0.42, z0, z1, "leather", true)
			_ib(ctx, fr, a, b, 0.42, 0.85, z0, z0 + 0.22, "leather")
			_ib(ctx, fr, a, a + 0.18, 0.42, 0.62, z0, z1, "leather")
			_ib(ctx, fr, b - 0.18, b, 0.42, 0.62, z0, z1, "leather")
		"shelf":
			for k in 5:
				_ib(ctx, fr, a, b, 0.05 + k * 0.45, 0.08 + k * 0.45, z0, z1, "metal")
			for px in [a, b - 0.04]:
				for pz in [z0, z1 - 0.04]:
					_ib(ctx, fr, px, px + 0.04, 0, 1.9, pz, pz + 0.04, "metal")
			for k in 4:
				if _rng.randf() < 0.65:
					var bw := _rng.randf_range(0.25, 0.5)
					var bx0 := _rng.randf_range(a + 0.05, b - bw - 0.05)
					_ib(ctx, fr, bx0, bx0 + bw, 0.08 + k * 0.45, 0.08 + k * 0.45 + _rng.randf_range(0.15, 0.32), z0 + 0.05, z1 - 0.05, "wood" if _rng.randf() < 0.5 else "fabric")
			_icol(ctx, fr, a, b, 0, 1.9, z0, z1)
			_cont(ctx, fr, x, sz, 1.9, "store", "Стеллаж", off)
		"crate":
			_ib(ctx, fr, a, b, 0, 0.6, z0, z1, "wood", true)
			_ib(ctx, fr, a - 0.01, b + 0.01, 0.27, 0.33, z0 - 0.01, z1 + 0.01, "wood")
			_cont(ctx, fr, x, sz, 0.6, "store", "Хозяйственный ящик", off)
		"kcab":
			_ib(ctx, fr, a, b, 0, 0.86, z0, z1, "wmetal", true)
			_ib(ctx, fr, a - 0.01, b + 0.01, 0.86, 0.9, z0, z1 + 0.02, "metal")
			_ib(ctx, fr, a, b, 1.45, 2.1, z0, z0 + 0.35, "wmetal")
			_cont(ctx, fr, x, sz, 0.9, "kitchen", "Кухонный шкаф", off)
		"stove":
			_ib(ctx, fr, a, b, 0, 0.85, z0, z1, "metal", true)
			for k in 4:
				var cx := a + 0.3 + (k % 2) * (sz.x - 0.6)
				var cz := z0 + 0.22 + (k / 2) * 0.38
				_ib(ctx, fr, cx - 0.14, cx + 0.14, 0.85, 0.88, cz - 0.14, cz + 0.14, "rust")
		"reception":
			_ib(ctx, fr, a, b, 0, 1.05, z1 - 0.3, z1, "wood", true)
			_ib(ctx, fr, a, b, 1.05, 1.1, z1 - 0.4, z1, "wood")
			_ib(ctx, fr, a, a + 0.3, 0, 1.05, z0, z1, "wood", true)
			_ib(ctx, fr, a + 0.1, b - 0.1, 1.1, 1.75, z1 - 0.32, z1 - 0.3, "glass")
			_ib(ctx, fr, a + 0.4, a + 1.2, 0.72, 0.76, z0 + 0.1, z1 - 0.3, "wood")
			_cont(ctx, fr, x, sz, 1.1, "reception", "Стойка регистратуры", off)
		"bench":
			_ib(ctx, fr, a, b, 0.42, 0.47, z0, z1, "wood", true)
			_ib(ctx, fr, a, b, 0.5, 0.9, z0, z0 + 0.05, "wood")
			for lx in [a + 0.1, b - 0.14]:
				_ib(ctx, fr, lx, lx + 0.04, 0, 0.42, z0, z1, "metal")
		"plant":
			_ib(ctx, fr, a + 0.12, b - 0.12, 0, 0.5, z0 + 0.12, z1 - 0.12, "plinth", true)
			for k in 4:
				var ang := k * PI * 0.5 + _rng.randf() * 0.6
				var cx := x + cos(ang) * 0.12
				var cz := (z0 + z1) * 0.5 + sin(ang) * 0.12
				_ib(ctx, fr, cx - 0.14, cx + 0.14, 0.5, 0.5 + _rng.randf_range(0.35, 0.8), cz - 0.14, cz + 0.14, "green")
		"board":
			_ib(ctx, fr, a, b, 1.0, 1.8, z0, z0 + 0.03, "wood", false, String(ctx.ik))
			for k in 5:
				var px := _rng.randf_range(a + 0.1, b - 0.35)
				var py := _rng.randf_range(1.1, 1.5)
				_ib(ctx, fr, px, px + 0.24, py, py + 0.3, z0 + 0.03, z0 + 0.035, "fabric", false, String(ctx.ik))
		"tv":
			_ib(ctx, fr, a + 0.1, b - 0.1, 0, 0.6, z0, z1, "wood", true)
			_ib(ctx, fr, a + 0.15, b - 0.15, 0.6, 1.05, z0 + 0.05, z1 - 0.05, "leather")
			_ib(ctx, fr, a + 0.22, b - 0.22, 0.66, 0.98, z1 - 0.06, z1 - 0.045, "glass")
		"piano":
			_ib(ctx, fr, a, b, 0, 1.25, z0, z0 + 0.4, "leather", true)
			_ib(ctx, fr, a, b, 0.68, 0.74, z0 + 0.4, z1, "leather")
			_ib(ctx, fr, a + 0.05, b - 0.05, 0.74, 0.77, z0 + 0.4, z0 + 0.55, "fabric")
		"panel":
			_ib(ctx, fr, a, b, 0.4, 1.9, z0, z1, "gmetal", true)
			for k in 3:
				_ib(ctx, fr, a + 0.1 + k * 0.25, a + 0.25 + k * 0.25, 1.5, 1.65, z1, z1 + 0.01, "fabric")
		"workbench":
			_ib(ctx, fr, a, b, 0.86, 0.92, z0, z1, "wood", true)
			_ib(ctx, fr, a, b, 0, 0.86, z0, z0 + 0.05, "metal")
			_ib(ctx, fr, a + 0.05, a + 0.6, 0, 0.6, z0 + 0.05, z1 - 0.05, "gmetal")
			_ib(ctx, fr, b - 0.4, b - 0.1, 0.92, 1.1, z1 - 0.3, z1 - 0.1, "metal")
			_ib(ctx, fr, a, b, 1.0, 1.7, z0, z0 + 0.03, "wood", false, String(ctx.ik))
			_cont(ctx, fr, x, sz, 0.92, "workbench", "Верстак", off)
		"cot":
			# раскладушка: рама, брезент, скатка одеяла
			for lx in [a + 0.1, x - 0.03, b - 0.16]:
				_ib(ctx, fr, lx, lx + 0.06, 0, 0.36, z0 + 0.04, z1 - 0.04, "metal")
			_ib(ctx, fr, a, b, 0.36, 0.4, z0, z1, "canvas", true)
			_ib(ctx, fr, a + 0.06, a + 0.42, 0.4, 0.52, z0 + 0.1, z1 - 0.1, "blanket" if _rng.randf() < 0.6 else "fabric")
		"acrate":
			_ib(ctx, fr, a, b, 0, 0.4, z0, z1, "armygreen", true)
			_ib(ctx, fr, a - 0.01, b + 0.01, 0.3, 0.33, z0 - 0.01, z1 + 0.01, "metal")
			_ib(ctx, fr, x - 0.06, x + 0.06, 0.2, 0.3, z1, z1 + 0.015, "metal")
			_cont(ctx, fr, x, sz, 0.42, String(ctx.get("ckind", "mil_gear")), "Армейский ящик", off)
		"radio":
			_ib(ctx, fr, a, b, 0.7, 0.74, z0, z1, "wood", true)
			for lx in [a + 0.03, b - 0.07]:
				_ib(ctx, fr, lx, lx + 0.04, 0, 0.7, z0 + 0.03, z1 - 0.03, "metal")
			_ib(ctx, fr, a + 0.1, a + 0.62, 0.74, 1.06, z0 + 0.05, z0 + 0.4, "armygreen")
			_ib(ctx, fr, a + 0.16, a + 0.3, 0.82, 0.96, z0 + 0.4, z0 + 0.41, "glass")
			_ib(ctx, fr, a + 0.56, a + 0.58, 1.06, 1.9, z0 + 0.1, z0 + 0.12, "metal")
			_ib(ctx, fr, b - 0.3, b - 0.08, 0.74, 0.8, z0 + 0.15, z0 + 0.4, "leather")
		"mcab":
			_ib(ctx, fr, a, b, 0, 1.8, z0, z1, "gmetal", true)
			_ib(ctx, fr, x - 0.01, x + 0.01, 0.1, 1.7, z1 - 0.005, z1 + 0.004, "metal")
			_cont(ctx, fr, x, sz, 1.8, String(ctx.get("ckind", "mil_gear")), "Металлический шкаф", off)
		"duffel":
			_ib(ctx, fr, a, b, 0, 0.3, z0, z1, "canvas", true)
			_ib(ctx, fr, a + 0.1, b - 0.1, 0.3, 0.36, z0 + 0.06, z1 - 0.06, "canvas")
			_cont(ctx, fr, x, sz, 0.36, "soldier_bag", "Вещмешок", off)
		"medbag":
			_ib(ctx, fr, a, b, 0, 0.3, z0, z1, "fabric", true)
			_ib(ctx, fr, x - 0.1, x + 0.1, 0.12, 0.2, z1, z1 + 0.01, "red")
			_ib(ctx, fr, x - 0.04, x + 0.04, 0.06, 0.26, z1, z1 + 0.012, "red")
			_cont(ctx, fr, x, sz, 0.3, "mil_med", "Медицинская сумка", off)
		"suitcase":
			_ib(ctx, fr, a, b, 0, 0.45, z0, z1, "leather" if _rng.randf() < 0.5 else "blanket", true)
			_ib(ctx, fr, x - 0.08, x + 0.08, 0.45, 0.5, z0 + 0.12, z0 + 0.16, "metal")
		"washstand":
			_ib(ctx, fr, a, b, 0, 0.8, z0, z1, "int_wood", true)
			_ib(ctx, fr, a + 0.05, b - 0.05, 0.8, 0.86, z0 + 0.05, z1 - 0.05, "wmetal")
			_ib(ctx, fr, x - 0.12, x + 0.12, 1.1, 1.45, z0, z0 + 0.18, "wmetal")
			_ib(ctx, fr, x - 0.22, x + 0.22, 1.5, 2.0, z0, z0 + 0.02, "glass")
			_cont(ctx, fr, x, sz, 0.86, "medbox", "Аптечка в умывальнике", off)
		"tub":
			_ib(ctx, fr, a, b, 0, 0.55, z0, z1, "wmetal", true)
			_ib(ctx, fr, a + 0.06, b - 0.06, 0.5, 0.56, z0 + 0.06, z1 - 0.06, "metal")
		"toolbox":
			_ib(ctx, fr, a, b, 0, 0.35, z0, z1, "metal", true)
			_ib(ctx, fr, a + 0.05, b - 0.05, 0.35, 0.4, z0 + 0.1, z1 - 0.1, "rust")
			_cont(ctx, fr, x, sz, 0.4, "tools", "Ящик с инструментами", off)
		"hay":
			_ib(ctx, fr, a, b, 0, 0.55, z0, z1, "sand", true)
			_ib(ctx, fr, a + 0.05, b - 0.05, 0.55, 1.05, z0 + 0.05, z1 - 0.05, "sand")
		"bin":
			# закром с картошкой
			_ib(ctx, fr, a, b, 0, 0.7, z0, z0 + 0.05, "int_wood", true)
			_ib(ctx, fr, a, a + 0.05, 0, 0.7, z0, z1, "int_wood")
			_ib(ctx, fr, b - 0.05, b, 0, 0.7, z0, z1, "int_wood")
			_ib(ctx, fr, a, b, 0, 0.45, z1 - 0.05, z1, "int_wood")
			_ib(ctx, fr, a + 0.05, b - 0.05, 0, 0.42, z0 + 0.05, z1 - 0.05, "potato")
			_icol(ctx, fr, a, b, 0, 0.7, z0, z1)
			_cont(ctx, fr, x, sz, 0.7, "cellar", "Закром с картошкой", off)
		"barrel":
			var bk2: Dictionary = ctx.bk
			var c2 := _w(bk2, float(fr.o.x) + float(fr.a.x) * x + float(fr.n.x) * (off + 0.3), float(ctx.y) + 0.45, float(fr.o.y) + float(fr.a.y) * x + float(fr.n.y) * (off + 0.3))
			_cylinder(String(ctx.nk), "rust", 0.28, 0.9, Transform3D(Basis(), c2), 10)
			_icol(ctx, fr, a + 0.02, b - 0.02, 0, 0.9, z0 + 0.02, z1 - 0.02)
		"tyres":
			for k in 3:
				var bk3: Dictionary = ctx.bk
				var c3 := _w(bk3, float(fr.o.x) + float(fr.a.x) * x + float(fr.n.x) * (off + 0.37), float(ctx.y) + 0.12 + k * 0.22, float(fr.o.y) + float(fr.a.y) * x + float(fr.n.y) * (off + 0.37))
				_cylinder(String(ctx.nk), "leather", 0.35, 0.2, Transform3D(Basis(), c3), 12)
			_icol(ctx, fr, a, b, 0, 0.66, z0, z1)
		_:
			if MODEL_KINDS.has(kind):
				_model_item(ctx, kind, fr, x, off, sz)


## мебель-модель Tripo: столкновение и тайник — коробка размера SIZES; сама модель ставится владельцем зданий
## (ULKhutor) по записи в models — в группу этажа, чтобы скрываться вместе с ним. Модели нет — простые коробки.
func _model_item(ctx: Dictionary, kind: String, fr: Dictionary, x: float, off: float, sz: Vector2) -> void:
	var mk: Array = MODEL_KINDS[kind]
	var h := float(mk[1])
	var a := x - sz.x * 0.5
	var b := x + sz.x * 0.5
	var z0 := off
	var z1 := off + sz.y
	var o: Vector2 = fr.o
	var av: Vector2 = fr.a
	var n: Vector2 = fr.n
	var bk: Dictionary = ctx.bk
	var c := o + av * x + n * (off + sz.y * 0.5)
	var nw := _wd(bk, n.x, n.y)
	var aw := _wd(bk, av.x, av.y)
	var pos := _w(bk, c.x, float(ctx.y), c.y)
	if ResourceLoader.exists("res://assets/world/%s.glb" % String(mk[0])):
		models.append([String(mk[0]), pos, atan2(nw.x, nw.z), Vector3(sz.x, h, sz.y), String(ctx.nk), atan2(aw.x, aw.z)])
	else:
		_ib(ctx, fr, a, b, 0, h, z0, z1, "int_wood" if kind != "m_fridge" and kind != "m_drinks" else "wmetal")
	_icol(ctx, fr, a, b, 0, h, z0, z1)
	if String(mk[2]) != "":
		_cont(ctx, fr, x, sz, h, String(mk[2]), String(mk[3]), off)


## посередине комнаты — модель (стол со стульями)
func _center_model(ctx: Dictionary, kind: String) -> void:
	var r: Dictionary = ctx.r
	var sz: Vector2 = SIZES[kind]
	var cu := (float(r.u0) + float(r.u1)) * 0.5 + _rng.randf_range(-0.3, 0.3)
	var cv := (float(r.v0) + float(r.v1)) * 0.5 + _rng.randf_range(-0.2, 0.2)
	var rr := Rect2(cu - sz.x * 0.5 - 0.2, cv - sz.y * 0.5 - 0.2, sz.x + 0.4, sz.y + 0.4)
	if not _fits(r, rr):
		return
	_placed.append(rr)
	var fr := {"o": Vector2(cu, cv - sz.y * 0.5), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": 0.0}
	_model_item(ctx, kind, fr, 0.0, 0.0, sz)


## кровать: металлическая (больничная) или деревянная; along — вдоль стены (иначе — изголовьем к стене)
func _bed(ctx: Dictionary, fr: Dictionary, a: float, b: float, z0: float, z1: float, wooden: bool) -> void:
	var fm := "wood" if wooden else "wmetal"
	_ib(ctx, fr, a, b, 0.3, 0.42, z0 + 0.04, z1 - 0.04, fm, true)
	_ib(ctx, fr, a, b, 0, 1.0 if not wooden else 0.9, z0, z0 + 0.05, fm)
	_ib(ctx, fr, a, b, 0, 0.75, z1 - 0.05, z1, fm)
	_ib(ctx, fr, a + 0.04, b - 0.04, 0.42, 0.58, z0 + 0.06, z1 - 0.06, "fabric")
	_ib(ctx, fr, a + 0.12, b - 0.12, 0.58, 0.68, z0 + 0.1, z0 + 0.45, "fabric")
	if _rng.randf() < 0.7:
		var cut := _rng.randf_range(0.5, 0.8)
		_ib(ctx, fr, a + 0.02, b - 0.02, 0.5, 0.62, z0 + 0.6, z0 + 0.6 + (z1 - z0 - 0.65) * cut, "blanket")


## кровати изголовьем к окну (палата): сколько уместится, с тумбочками между
func _beds_ext(ctx: Dictionary, _kind: String, with_bedside: bool) -> void:
	var fr := _wall_frame(ctx.r, "ext")
	var len_w: float = fr.len
	var n := clampi(int((len_w - 0.3) / 1.5), 1, 4)
	var step := len_w / n
	for i in n:
		var x := step * (i + 0.5)
		var rr := _item_rect(fr, x, Vector2(0.95, 2.05), 0.12)
		if _fits(ctx.r, rr):
			_placed.append(rr)
			_bed(ctx, fr, x - 0.475, x + 0.475, 0.12, 2.17, false)
		if with_bedside and i < n - 1:
			var bx := step * (i + 1)
			var r2 := _item_rect(fr, bx, Vector2(0.42, 0.42), 0.12)
			if _fits(ctx.r, r2):
				_placed.append(r2)
				_emit(ctx, "bedside", fr, bx, 0.12)


## номер: кровати вдоль боковых стен, изголовьем к окну
func _beds_side(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var head_hi := int(r.get("side", 0)) >= 0          # наружная стена — у v1
	for wl in ["l", "r"]:
		var fr := _wall_frame(r, wl)
		var o: Vector2 = fr.o
		var a: Vector2 = fr.a
		var len_w: float = fr.len
		var xh := len_w - 0.15 if head_hi else 0.15
		var xc := xh - 1.025 if head_hi else xh + 1.025
		var rr := _item_rect(fr, xc, Vector2(2.05, 0.95), 0.02)
		if not _fits(r, rr):
			continue
		_placed.append(rr)
		# повёрнутая рамка: x — поперёк кровати (от стены внутрь), z — от изголовья к ногам
		var fr2 := {"o": o + a * xh, "a": fr.n, "n": -a if head_hi else a, "len": 2.05}
		_bed(ctx, fr2, 0.02, 0.97, 0.0, 2.05, true)


## санузел в номере: угол у двери — перегородки в плитке, унитаз и раковина
func _bath(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var fr := _wall_frame(r, "cor")
	var len_w: float = fr.len
	var door: float = float(r.get("door", 0.0)) - float(r.u0)
	# сторона, где нет двери
	var x0 := 0.0 if door > len_w * 0.5 else len_w - 1.5
	var rr := _item_rect(fr, x0 + 0.75, Vector2(1.5, 1.7), 0.0)
	if not _fits(r, rr):
		return
	_placed.append(rr)
	var ik: String = ctx.ik
	var h := 2.2
	# стенка вдоль коридора внутрь и поперёк, проём 0.75
	var inner_x := x0 + (1.5 if x0 == 0.0 else 0.0)
	_ib(ctx, fr, inner_x - 0.05, inner_x + 0.05, 0, h, 0.0, 0.85, "tile_wall", true, ik)
	_ib(ctx, fr, x0, x0 + 1.5, 0, h, 1.65, 1.75, "tile_wall", true, ik)
	_ib(ctx, fr, x0 + 0.2, x0 + 0.62, 0, 0.42, 0.1, 0.62, "wmetal", false)
	_ib(ctx, fr, x0 + 0.95, x0 + 1.4, 0.75, 0.86, 0.05, 0.45, "wmetal", false)
	_ib(ctx, fr, x0 + 0.05, x0 + 1.45, 0.01, 0.03, 0.05, 1.6, "ktiles", false)


## общий туалет: кабинки у наружной стены
func _stalls(ctx: Dictionary) -> void:
	var fr := _wall_frame(ctx.r, "ext")
	var len_w: float = fr.len
	var n := clampi(int(len_w / 1.0), 1, 5)
	var w := len_w / n
	var rr := _item_rect(fr, len_w * 0.5, Vector2(len_w, 1.5), 0.0)
	_placed.append(rr)
	for i in n:
		var a := i * w
		_ib(ctx, fr, a + w * 0.5 - 0.2, a + w * 0.5 + 0.2, 0, 0.42, 0.1, 0.62, "wmetal")
		if i > 0:
			_ib(ctx, fr, a - 0.025, a + 0.025, 0, 1.9, 0, 1.45, "tile_wall", true, String(ctx.ik))
		_ib(ctx, fr, a + 0.05, a + w * 0.45, 0, 1.9, 1.42, 1.47, "door", false, String(ctx.ik))


## посередине комнаты: стол со стульями, бильярд, разделочный стол
func _center(ctx: Dictionary, kind: String) -> void:
	var r: Dictionary = ctx.r
	var cu := (float(r.u0) + float(r.u1)) * 0.5
	var cv := (float(r.v0) + float(r.v1)) * 0.5
	var fr := {"o": Vector2(cu, cv), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": 0.0}
	match kind:
		"table4":
			var rr := Rect2(cu - 1.0, cv - 0.85, 2.0, 1.7)
			if not _fits(r, rr):
				return
			_placed.append(rr)
			_table(ctx, fr, 1.1, 0.75)
		"worktable":
			var rr := Rect2(cu - 1.0, cv - 0.5, 2.0, 1.0)
			if not _fits(r, rr):
				return
			_placed.append(rr)
			_ib(ctx, fr, -0.95, 0.95, 0.85, 0.9, -0.45, 0.45, "wmetal", true)
			for lx in [-0.9, 0.86]:
				for lz in [-0.4, 0.36]:
					_ib(ctx, fr, lx, lx + 0.04, 0, 0.85, lz, lz + 0.04, "metal")
		"billiard":
			var rr := Rect2(cu - 1.3, cv - 0.8, 2.6, 1.6)
			if not _fits(r, rr):
				return
			_placed.append(rr)
			_ib(ctx, fr, -1.2, 1.2, 0, 0.72, -0.7, 0.7, "wood", true)
			_ib(ctx, fr, -1.1, 1.1, 0.72, 0.8, -0.6, 0.6, "green")
			_ib(ctx, fr, -0.6, 0.9, 0.81, 0.83, 0.1, 0.13, "wood")


func _table(ctx: Dictionary, fr: Dictionary, w: float, d: float) -> void:
	_ib(ctx, fr, -w * 0.5, w * 0.5, 0.72, 0.76, -d * 0.5, d * 0.5, "wood", true)
	for lx in [-w * 0.5 + 0.03, w * 0.5 - 0.07]:
		for lz in [-d * 0.5 + 0.03, d * 0.5 - 0.07]:
			_ib(ctx, fr, lx, lx + 0.04, 0, 0.72, lz, lz + 0.04, "metal")
	# стулья с двух сторон; некоторые опрокинуты
	for side in [-1.0, 1.0]:
		for k in 2:
			var cx := (k - 0.5) * w * 0.5
			var cz := float(side) * (d * 0.5 + 0.3)
			if _rng.randf() < 0.15:
				var bk: Dictionary = ctx.bk
				var c := _w(bk, float(fr.o.x) + cx, float(ctx.y) + 0.22, float(fr.o.y) + cz + side * 0.3)
				_box(String(ctx.nk), "wood", Vector3(0.44, 0.44, 0.44), Transform3D(Basis.from_euler(Vector3(PI * 0.5, _rng.randf() * TAU, 0)), c))
				continue
			_ib(ctx, fr, cx - 0.21, cx + 0.21, 0.43, 0.47, cz - 0.21, cz + 0.21, "wood")
			_ib(ctx, fr, cx - 0.21, cx + 0.21, 0.47, 0.88, cz + side * 0.18, cz + side * 0.21 + (0.0 if side > 0 else 0.0), "wood")
			for lx in [cx - 0.19, cx + 0.15]:
				for lz in [cz - 0.19, cz + 0.15]:
					_ib(ctx, fr, lx, lx + 0.04, 0, 0.43, lz, lz + 0.04, "metal")


## столовая: столы на четверых рядами, раздача у кухни
func _dining(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var u0 := float(r.u0) + 1.6
	var u1 := float(r.u1) - 1.6
	var v0 := float(r.v0) + 1.6
	var v1 := float(r.v1) - 2.2
	var u := u0
	# раздача — вдоль стены с кухней
	for k in 3:
		_try(ctx, "kcab", ["cor"], 0.3 + k * 0.06)
	while u < u1:
		var v := v0
		while v < v1:
			var fr := {"o": Vector2(u, v), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": 0.0}
			var rr := Rect2(u - 1.0, v - 0.85, 2.0, 1.7)
			if _fits(r, rr):
				_placed.append(rr)
				_table(ctx, fr, 1.2, 0.8)
			v += 2.9
		u += 3.1


## котельная: три котла, трубы вдоль стен, щиты
func _boiler_hall(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var bk: Dictionary = ctx.bk
	var nk: String = ctx.nk
	var y: float = ctx.y
	var cv := (float(r.v0) + float(r.v1)) * 0.5
	var n := 3
	var span := float(r.u1) - float(r.u0)
	for i in n:
		var u := float(r.u0) + span * (i + 0.5) / n
		var c := _w(bk, u, y + 1.35, cv + 0.6)
		# котёл лежит поперёк зала (ось цилиндра — вдоль v)
		_cylinder(nk, "rust", 0.95, 4.2, Transform3D(Basis(_wd(bk, 1, 0), PI * 0.5), c), 16)
		_lb(nk, "plinth", bk, u - 1.0, u + 1.0, y, y + 0.45, cv + 0.6 - 2.0, cv + 0.6 + 2.0, true)
		_col(_ws(bk, 1.9, 1.9, 4.2), c)
		_cylinder(nk, "metal", 0.18, storey - 2.2, Transform3D(Basis(), _w(bk, u, y + 2.3 + (storey - 2.2) * 0.5 - 0.1, cv + 1.8)), 8)
		_placed.append(Rect2(u - 1.2, cv + 0.6 - 2.3, 2.4, 4.6))
		spots.append([_w(bk, u + 1.6, y, cv - 1.8), "%s:boiler:0" % id])
	# трубы под потолком вдоль зала
	for k in 2:
		var vv := float(r.v0) + 0.35 + k * 0.32
		var c2 := _w(bk, (float(r.u0) + float(r.u1)) * 0.5, y + storey - 0.9 - k * 0.3, vv)
		_cylinder(nk, "rust", 0.12, span - 0.4, Transform3D(Basis(_wd(bk, 0, 1), PI * 0.5), c2), 8)
	_try(ctx, "panel", ["l", "r"], 0.4)
	_try(ctx, "panel", ["l", "r"], 0.7)
	_try(ctx, "workbench", ["ext"], 0.15)
	_try(ctx, "crate", ["ext"], 0.85)


## склад хозблока: стеллажи рядами, ящики
func _warehouse(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var u := float(r.u0) + 1.5
	while u < float(r.u1) - 2.0:
		for v in [float(r.v0) + 0.3, float(r.v1) - 0.78]:
			var fr := {"o": Vector2(u, v), "a": Vector2(1, 0), "n": Vector2(0, 1), "len": 1.25}
			var rr := Rect2(u, v, 1.25, 0.48)
			if _fits(r, rr):
				_placed.append(rr)
				_emit(ctx, "shelf", fr, 0.625, 0.0)
		u += 2.4
	for k in 4:
		_try(ctx, "crate", ["l", "r", "ext", "cor"], 0.2 + k * 0.2)


## коридор: скамьи и стулья у стен между дверями, каталка, цветы
func _corridor_decor(ctx: Dictionary) -> void:
	var r: Dictionary = ctx.r
	var kinds := ["bench", "chair", "plant"]
	if String(def.get("id", "")) == "medical":
		kinds.append("gurney")
	for k in 3:
		var t := _rng.randf()
		var kind: String = kinds[_rng.randi() % kinds.size()]
		if kind == "gurney":
			var fr := _wall_frame(r, "ext") if _rng.randf() < 0.5 else _wall_frame(r, "cor")
			var x := clampf(t * float(fr.len), 1.2, float(fr.len) - 1.2)
			var rr := _item_rect(fr, x, Vector2(2.0, 0.6), 0.05)
			if _fits(r, rr) and not _blocks_door(rr, int(r.bi), int(r.f)):
				_placed.append(rr)
				_ib(ctx, fr, x - 0.95, x + 0.95, 0.75, 0.82, 0.08, 0.62, "fabric", true)
				_ib(ctx, fr, x - 0.95, x + 0.95, 0.15, 0.2, 0.1, 0.6, "wmetal")
			continue
		_try_corr(ctx, kind, t)


## у стены коридора — только там, где нет дверей
func _try_corr(ctx: Dictionary, kind: String, t: float) -> void:
	var r: Dictionary = ctx.r
	var sz: Vector2 = SIZES[kind]
	for wl in ["ext", "cor"]:
		var fr := _wall_frame(r, wl)
		var x := clampf(t * float(fr.len), sz.x * 0.5 + 0.1, float(fr.len) - sz.x * 0.5 - 0.1)
		var rr := _item_rect(fr, x, sz, 0.02)
		if _fits(r, rr) and not _blocks_door(rr, int(r.bi), int(r.f)):
			_placed.append(rr)
			_emit(ctx, kind, fr, x, 0.02)
			return


## не загораживает ли дверь в комнату (двери коридора — в стенах v = ±CW/2)
func _blocks_door(rr: Rect2, bi: int, f: int) -> bool:
	for dd in doors:
		var d := dd as ULDoor
		if d.get_meta("ext", false) or d.bld != bi or d.floor_i != f:
			continue
		var bk: Dictionary = blocks[d.bld]
		var l := _local(bk, d.center)
		if Rect2(l.x - 0.85, l.y - 1.2, 1.7, 2.4).intersects(rr):
			return true
	return false


# ---------------- видимость ----------------

## −1 — герой снаружи (видны фасады и крыши); k — герой внутри на этаже k
func set_state(k: int) -> void:
	if k == state:
		return
	state = k
	for bi in blocks.size():
		var bk: Dictionary = blocks[bi]
		var fl: int = bk.floors
		var kk := k if k < fl else -1                 # блок ниже этажа героя — как снаружи
		_show("b%d/xa" % bi, kk < 0)
		for f in fl:
			var inside := kk >= 0
			_show("b%d/x%df" % [bi, f], inside and f <= kk)
			_show("b%d/x%db" % [bi, f], inside and f <= kk)
			_show("b%d/o%d" % [bi, f], inside and f < kk)
			_show("b%d/i%d" % [bi, f], inside and f == kk)
			_show("b%d/n%d" % [bi, f], inside and f == kk)
			_show("b%d/s%d" % [bi, f], inside and (f == kk or f == kk - 1))
			_cut("b%d/x%df" % [bi, f], inside and f == kk)
			_cut("b%d/i%d" % [bi, f], inside and f == kk)
		_show("b%d/r" % bi, kk < 0)
	if _groups.has("portico"):
		_show("portico", k < 0)
	for dd in doors:
		var d := dd as ULDoor
		var fl2: int = blocks[d.bld].floors
		var kk2 := k if k < fl2 else -1
		if d.get_meta("ext", false):
			d.visible = kk2 < 0 or kk2 >= 0
			_cut_mesh(d.panel, kk2 == 0)
		else:
			d.visible = kk2 >= 0 and d.floor_i == kk2
			_cut_mesh(d.panel, kk2 >= 0 and d.floor_i == kk2)


func _show(key: String, on: bool) -> void:
	if _groups.has(key):
		(_groups[key] as Node3D).visible = on


func _cut(key: String, on: bool) -> void:
	if not _groups.has(key):
		return
	for mi in (_groups[key] as Node3D).get_children():
		_cut_mesh(mi as MeshInstance3D, on)


func _cut_mesh(mi: MeshInstance3D, on: bool) -> void:
	if mi == null:
		return
	var m := String(mi.get_meta("mat", "door"))
	if not CUTTABLE.has(m):
		return
	mi.material_override = cut_mats[m] if on else mats[m]


## внутри ли точка (по плану) и на каком этаже: −1 — снаружи
func floor_at(p: Vector3) -> int:
	if style == "cellar":
		# погреб: только под землёй; лестница вниз (annex) — уже погреб
		if p.y > base_y + storey - 0.1:
			return -1
		if annex.size != Vector2.ZERO and annex.has_point(Vector2(p.x, p.z)) and p.y < -0.15:
			return 0
	if not rect.grow(0.05).has_point(Vector2(p.x, p.z)):
		return -1
	for bk in blocks:
		var l := _local(bk, p)
		if absf(l.x) < float(bk.hl) - te * 0.5 and absf(l.y) < float(bk.hw) - te * 0.5:
			return clampi(int(floor((p.y - base_y + 0.9) / storey)), 0, int(bk.floors) - 1)
	return -1


## этаж по высоте с запасом (не мигать на лестнице): остаётся прежний, пока высота в его пределах ±0.4
func floor_hyst(p: Vector3, cur: int) -> int:
	var f := floor_at(p)
	if f < 0 or cur < 0:
		return f
	var rel := p.y - base_y - cur * storey
	if rel > -1.3 and rel < storey - 0.5:
		return cur
	return f
