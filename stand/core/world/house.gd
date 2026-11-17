class_name ULHouse
extends Node3D
## Дом с пятью проходимыми комнатами. Снаружи виден дом из Tripo (цельная модель без внутренностей), внутри —
## свои стены, пол и проёмы дверей. Когда герой внутри, модель Tripo и крыша скрываются, а стены показываются
## срезанными по высоте (2 м — чуть выше роста героя) — комнаты видно сверху, как в изометрических играх. Столкновения — всегда со стенами
## в полную высоту.
##
## Система дома: x — вдоль длинной стороны (вправо), z — к фасаду (вперёд, там крыльцо и входная дверь), м.
##   Сени (вход)  x −1.5…1.5,  z 1.5…5      Кухня  x −6…−1.5, z 1.5…5      Оружейная x 1.5…6, z 1.5…5 (бывшая кладовая)
##   Горница      x −6…1.5,    z −5…1.5     Спальня x 1.5…6,  z −5…1.5

const W := 12.0                   ## ширина дома (по x), м
const D := 10.0                   ## глубина (по z), м
const H := 2.7                    ## высота стен, м
const CUT := 2.0                  ## высота срезанных стен, когда герой внутри, м (чуть выше роста героя)
const DOOR := 1.0                 ## ширина дверного проёма, м
const DOOR_H := 2.1
const T_OUT := 0.22               ## толщина наружных стен
const T_IN := 0.12                ## толщина перегородок
const FLOOR_Y := 0.02             ## пол чуть выше земли (только вид; ходит герой по земле — без порога)

## стены: [начало, конец, толщина, [середины проёмов вдоль стены, м от начала]]
const WALLS := [
	[Vector2(-6, 5), Vector2(6, 5), T_OUT, [6.0]],              # фасад, входная дверь посередине
	[Vector2(-6, -5), Vector2(6, -5), T_OUT, []],
	[Vector2(-6, -5), Vector2(-6, 5), T_OUT, []],
	[Vector2(6, -5), Vector2(6, 5), T_OUT, []],
	[Vector2(-6, 1.5), Vector2(6, 1.5), T_IN, [6.0]],          # перегородка: сени → горница
	[Vector2(-1.5, 1.5), Vector2(-1.5, 5), T_IN, [1.75]],      # сени → кухня
	[Vector2(1.5, 1.5), Vector2(1.5, 5), T_IN, [1.75]],        # сени → кладовая
	[Vector2(1.5, -5), Vector2(1.5, 1.5), T_IN, [3.0]],        # горница → спальня
]
const ROOMS := [
	["Сени", Vector2(0, 3.25)], ["Кухня", Vector2(-3.75, 3.25)], ["Оружейная", Vector2(3.75, 3.25), Vector2(2.45, 4.55)],
	["Горница", Vector2(-2.25, -1.75)], ["Спальня", Vector2(3.75, -1.75)],
]

var shell: Node3D = null          ## дом из Tripo (снаружи)
var inner: Node3D                 ## свои стены и пол (внутри)
var _cut_walls: Array[MeshInstance3D] = []
var inside := false
var labels: Array[Label3D] = []


func build(shell_path: String, wall_tex: String, floor_tex: String) -> void:
	inner = Node3D.new()
	inner.name = "Inner"
	add_child(inner)
	# стены и пол — материал построек (ULFarmBuilding.SHADER): текстура по мировым координатам, к полу стена темнее
	# и грязнее (сырость), пятна и мох; на полу — затоптанная грязь пятнами у порогов
	var fn := FastNoiseLite.new()
	fn.seed = 31
	fn.frequency = 0.012
	fn.fractal_octaves = 3
	var noise := ImageTexture.create_from_image(fn.get_seamless_image(256, 256))
	var sh := Shader.new()
	sh.code = ULFarmBuilding.SHADER
	var wall_mat := ShaderMaterial.new()
	wall_mat.shader = sh
	wall_mat.set_shader_parameter("noise", noise)
	wall_mat.set_shader_parameter("albedo_tex", load(wall_tex + "_c.jpg"))
	if ResourceLoader.exists(wall_tex + "_n.jpg"):
		wall_mat.set_shader_parameter("normal_tex", load(wall_tex + "_n.jpg"))
		wall_mat.set_shader_parameter("has_normal", true)
	wall_mat.set_shader_parameter("scale", 1.6)
	wall_mat.set_shader_parameter("tint", Color(0.95, 0.88, 0.8))
	wall_mat.set_shader_parameter("grime", 0.85)
	wall_mat.set_shader_parameter("rough", 0.9)
	var floor_mat := ShaderMaterial.new()
	floor_mat.shader = sh
	floor_mat.set_shader_parameter("noise", noise)
	floor_mat.set_shader_parameter("albedo_tex", load(floor_tex + "_c.jpg"))
	if ResourceLoader.exists(floor_tex + "_n.jpg"):
		floor_mat.set_shader_parameter("normal_tex", load(floor_tex + "_n.jpg"))
		floor_mat.set_shader_parameter("has_normal", true)
	floor_mat.set_shader_parameter("scale", 2.0)
	floor_mat.set_shader_parameter("tint", Color(0.8, 0.74, 0.66))          # доски пола — темнее, иначе сверху почти белые
	floor_mat.set_shader_parameter("grime", 0.6)
	floor_mat.set_shader_parameter("albedo2", load("res://assets/world/tex/dirt_c.jpg"))
	floor_mat.set_shader_parameter("has_second", true)
	floor_mat.set_shader_parameter("tint2", Color(0.7, 0.62, 0.52))
	floor_mat.set_shader_parameter("second_bias", -0.12)
	floor_mat.set_shader_parameter("rough", 0.88)
	# пол
	var fl := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(W, 0.1, D)
	fl.mesh = bm
	fl.material_override = floor_mat
	fl.position = Vector3(0, FLOOR_Y - 0.05, 0)
	inner.add_child(fl)
	var body := StaticBody3D.new()
	body.name = "Walls"
	add_child(body)
	# стены с проёмами: столкновение — в полную высоту, видимые — срезанные
	for wl in WALLS:
		var a: Vector2 = wl[0]
		var b: Vector2 = wl[1]
		var th: float = wl[2]
		var L := a.distance_to(b)
		var dir := (b - a) / L
		var gaps := []
		for g in wl[3]:
			gaps.append([float(g) - DOOR * 0.5, float(g) + DOOR * 0.5])
		var s0 := 0.0
		var pieces := []
		for g in gaps:
			pieces.append([s0, float(g[0])])
			s0 = float(g[1])
		pieces.append([s0, L])
		# наружные стены продлены на полтолщины — углы без щелей
		var ext := th * 0.5 if th >= T_OUT else 0.0
		for pc in pieces:
			var p0: float = pc[0] - (ext if pc[0] <= 0.001 else 0.0)
			var p1: float = pc[1] + (ext if pc[1] >= L - 0.001 else 0.0)
			if p1 - p0 < 0.02:
				continue
			_wall_piece(body, a, dir, p0, p1, th, 0.0, H, wall_mat)
		for g in gaps:
			_wall_piece(body, a, dir, float(g[0]), float(g[1]), th, DOOR_H, H, wall_mat)  # над дверью
	for r in ROOMS:
		var lb := Label3D.new()
		lb.text = r[0]
		lb.font_size = 72
		lb.pixel_size = 0.004
		lb.modulate = Color(1, 1, 1, 0.55)
		lb.outline_size = 8
		lb.rotation_degrees = Vector3(-90, 0, 0)
		var lp: Vector2 = r[2] if r.size() > 2 else r[1]             # надпись — там, где пол свободен
		lb.position = Vector3(lp.x, FLOOR_Y + 0.045, lp.y)
		inner.add_child(lb)
		labels.append(lb)
	if ResourceLoader.exists(shell_path):
		shell = (load(shell_path) as PackedScene).instantiate()
		shell.name = "Shell"
		add_child(shell)
	set_inside(false)


func _wall_piece(body: StaticBody3D, a: Vector2, dir: Vector2, s0: float, s1: float, th: float, y0: float, y1: float, mat: Material) -> void:
	var mid := a + dir * ((s0 + s1) * 0.5)
	var size := Vector3(s1 - s0, y1 - y0, th)
	var yaw := -atan2(dir.y, dir.x)
	var xf := Transform3D(Basis(Vector3.UP, yaw), Vector3(mid.x, FLOOR_Y + (y0 + y1) * 0.5, mid.y))
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.transform = xf
	body.add_child(cs)
	# видимая стена (срезанная: над дверью — нет)
	if y0 > 0.01:
		return
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(size.x, CUT, th)
	mi.mesh = bm
	mi.material_override = mat
	mi.transform = Transform3D(xf.basis, Vector3(mid.x, FLOOR_Y + CUT * 0.5, mid.y))
	inner.add_child(mi)
	_cut_walls.append(mi)
	# стена поперёк взгляда камеры (камера стоит с +z) — может заслонять героя
	mi.set_meta("front", absf(dir.x) > 0.5)
	mi.set_meta("z", mid.y)
	mi.set_meta("x", mid.x)
	mi.set_meta("h", CUT)


func _box_col(body: StaticBody3D, size: Vector3, at: Vector3) -> void:
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = size
	cs.shape = bs
	cs.position = at
	body.add_child(cs)


## земля за краем кластера — рамка из четырёх полос вокруг поля (side × side м всего), а не одна плита под всем
## полем: плита лежала под землёй кластера, и её тройная (трипланарная) выборка с освещением считалась на
## каждой точке экрана впустую — земля поля всё равно рисовалась поверх
static func outer_frame(parent: Node3D, half: float, side: float) -> void:
	var omat := _mat("res://assets/world/tex/mud_forest", 3.5)
	omat.albedo_color = Color(0.6, 0.6, 0.54)
	var w := side * 0.5 - half
	for s in [Vector3(1, 0, 0), Vector3(-1, 0, 0), Vector3(0, 0, 1), Vector3(0, 0, -1)]:
		var o := MeshInstance3D.new()
		var op := PlaneMesh.new()
		op.size = Vector2(w, side) if s.x != 0.0 else Vector2(half * 2.0, w)
		o.mesh = op
		o.material_override = omat
		o.position = s * (half + w * 0.5) + Vector3.UP * -0.05
		parent.add_child(o)


static func _mat(tex: String, uv: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_texture = load(tex + "_c.jpg")
	if ResourceLoader.exists(tex + "_n.jpg"):
		m.normal_enabled = true
		m.normal_texture = load(tex + "_n.jpg")
	m.uv1_triplanar = true
	m.uv1_world_triplanar = true
	m.uv1_scale = Vector3.ONE / uv
	m.roughness = 0.9
	return m


## точка в доме? (в системе мира)
func contains(p: Vector3) -> bool:
	var l := to_local(p)
	return absf(l.x) < W * 0.5 - 0.05 and absf(l.z) < D * 0.5 - 0.05


## герой вошёл / вышел: снаружи — дом Tripo, внутри — комнаты сверху
func set_inside(v: bool) -> void:
	inside = v
	if shell:
		shell.visible = not v
	inner.visible = v or shell == null


## дверь (снаружи, перед крыльцом), в системе мира
func door_point(out := 1.2) -> Vector3:
	return to_global(Vector3(0, 0, D * 0.5 + out))


## стены между камерой (она с +z) и героем опускаются до LOW — героя и комнату за ними видно; остальные — CUT
const LOW := 0.4
static var cam_x := 0.0           ## насколько камера сбоку (+x): sin поворота камеры (настройка «Камера»)


func update_walls(player_world: Vector3, delta: float) -> void:
	if not inside:
		return
	var lp := to_local(player_world)
	var pz := lp.z
	var a := 1.0 - exp(-delta * 10.0)
	for mi in _cut_walls:
		var want := LOW if bool(mi.get_meta("front")) and float(mi.get_meta("z")) > pz + 0.2 else CUT
		# камера «по диагонали» стоит ещё и сбоку (+x): стены вдоль z правее героя тоже опускаются
		if not bool(mi.get_meta("front")) and cam_x > 0.3 and float(mi.get_meta("x")) > lp.x + 0.2:
			want = LOW
		var h := lerpf(float(mi.get_meta("h")), want, a)
		mi.set_meta("h", h)
		mi.scale = Vector3(1, h / CUT, 1)
		mi.position.y = FLOOR_Y + h * 0.5


## какая комната в точке p (мировые координаты); "" — не в доме
func room_at(p: Vector3) -> String:
	var l := to_local(p)
	if absf(l.x) > W * 0.5 or absf(l.z) > D * 0.5:
		return ""
	if l.z > 1.5:
		return "Кухня" if l.x < -1.5 else ("Сени" if l.x < 1.5 else "Оружейная")
	return "Горница" if l.x < 1.5 else "Спальня"
