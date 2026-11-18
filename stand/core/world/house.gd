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


func build(shell_path: String, wall_tex: String, floor_tex: String, bunker := false) -> void:
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
	wall_mat.set_shader_parameter("tint", Color(0.82, 0.83, 0.82) if bunker else Color(0.95, 0.88, 0.8))   # бункер — серый бетон
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
	floor_mat.set_shader_parameter("tint", Color(0.92, 0.9, 0.86) if bunker else Color(0.8, 0.74, 0.66))    # доски пола — темнее, иначе сверху почти белые
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
	# подписей комнат на полу нет (база — бункер; комнаты узнаются по обстановке)
	if bunker:
		shell = _bunker_shell(noise)
	elif ResourceLoader.exists(shell_path):
		shell = (load(shell_path) as PackedScene).instantiate()
		shell.name = "Shell"
		add_child(shell)
	set_inside(false)


## Бункер (вид снаружи; когда герой внутри — скрыт, видны комнаты сверху): толстые стены из старого бетона,
## перекрытие с земляной насыпью и дёрном, по краю крыши — мешки с песком, к задней стене — земляной вал,
## вход — бетонный портал с открытой стальной гермодверью, на крыше — вентиляция, люк, антенна.
## Всё — своя геометрия с материалами построек (ULBlock: бетон, земля, металл, мешковина); столкновение — у вала
## (стены дома — свои, ULHouse.WALLS).
const B_WALL_H := 2.7
const B_T := 0.45                 ## толщина бетона снаружи (наружу от линии стен)


func _bunker_shell(noise: Texture2D) -> Node3D:
	ULBlock.make_materials(noise)
	var M: Dictionary = ULBlock.mats
	var root := Node3D.new()
	root.name = "Shell"
	add_child(root)
	var hw := W * 0.5
	var hd := D * 0.5
	# старый серый бетон с потёками и грязью внизу (у «concrete» тон для пола — на стене выходил почти белым)
	var conc: ShaderMaterial = (M["concrete"] as ShaderMaterial).duplicate()
	conc.set_shader_parameter("tint", Color(0.74, 0.74, 0.72))
	conc.set_shader_parameter("grime", 1.0)
	conc.set_shader_parameter("streaks", 0.9)
	# стены: фасад — с проёмом под портал
	var dw := 1.5                                              # ширина проёма в бетоне снаружи
	_bx(root, Vector3(W + B_T * 2.0, B_WALL_H, B_T), Vector3(0, B_WALL_H * 0.5, -hd - B_T * 0.5 + 0.11), conc)
	_bx(root, Vector3(B_T, B_WALL_H, D + B_T * 2.0), Vector3(-hw - B_T * 0.5 + 0.11, B_WALL_H * 0.5, 0), conc)
	_bx(root, Vector3(B_T, B_WALL_H, D + B_T * 2.0), Vector3(hw + B_T * 0.5 - 0.11, B_WALL_H * 0.5, 0), conc)
	var fw := (W + B_T * 2.0 - dw) * 0.5
	for sx in [-1.0, 1.0]:
		_bx(root, Vector3(fw, B_WALL_H, B_T), Vector3(sx * (dw * 0.5 + fw * 0.5), B_WALL_H * 0.5, hd + B_T * 0.5 - 0.11), conc)
	_bx(root, Vector3(dw, B_WALL_H - 2.2, B_T), Vector3(0, 2.2 + (B_WALL_H - 2.2) * 0.5, hd + B_T * 0.5 - 0.11), conc)
	# перекрытие (плита со свесом) и земляная насыпь с дёрном поверх — сверху бункер читается холмом
	_bx(root, Vector3(W + B_T * 2.0 + 0.3, 0.35, D + B_T * 2.0 + 0.3), Vector3(0, B_WALL_H + 0.175, 0), M["slab"])
	var mound := _frustum(Vector2(W + B_T * 2.0, D + B_T * 2.0), Vector2(W - 1.6, D - 1.8), 0.55)
	var mm := MeshInstance3D.new()
	mm.mesh = mound
	mm.material_override = M["earth"]
	mm.position.y = B_WALL_H + 0.35
	root.add_child(mm)
	# портал входа: два бетонных пилона и перемычка, выступают вперёд; гермодверь открыта к стене
	for sx in [-1.0, 1.0]:
		_bx(root, Vector3(0.4, 2.55, 0.9), Vector3(sx * (dw * 0.5 + 0.2), 1.275, hd + 0.5), conc)
	_bx(root, Vector3(dw + 0.8, 0.45, 0.9), Vector3(0, 2.55 + 0.225, hd + 0.5), conc)
	# гермодверь распахнута на 180° и лежит на фасаде справа от портала (не перегораживает проход)
	var door := _bx(root, Vector3(1.05, 2.05, 0.1), Vector3.ZERO, M["armygreen"])
	door.transform = Transform3D(Basis.IDENTITY, Vector3(dw * 0.5 + 0.4 + 0.58, 1.04, hd + B_T - 0.11 + 0.06))
	for k in 3:                                                # петли
		_bx(root, Vector3(0.08, 0.14, 0.08), door.transform * Vector3(-0.53, 0.75 - k * 0.75, 0.04), M["metal"])
	var wheel := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.14
	tm.outer_radius = 0.18
	wheel.mesh = tm
	wheel.material_override = M["metal"]
	wheel.transform = door.transform * Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0.12, 0.0, 0.07))
	root.add_child(wheel)
	# фонарь над входом (только свечение, без источника света)
	var lamp := _bx(root, Vector3(0.3, 0.12, 0.16), Vector3(0, 2.5, hd + 0.98), M.get("lamp", M["metal"]))
	lamp.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# мешки с песком по краю крыши; тело столкновений — для вала
	var body := StaticBody3D.new()
	body.name = "BunkerBody"
	add_child(body)
	var bags: Array[Transform3D] = []
	var rng := RandomNumberGenerator.new()
	rng.seed = 77
	# у входа стенок из мешков нет: там стоят жители и ходит герой (мешки — по краю крыши)
	var ry := B_WALL_H + 0.35
	var ex := hw + B_T + 0.05
	var ez := hd + B_T + 0.05
	for row in 2:
		for side in 4:
			var L := (ex if side < 2 else ez) * 2.0
			var n := int(L / 0.5)
			for i in n:
				var t := -L * 0.5 + (i + 0.5 + (0.5 if row == 1 else 0.0)) * L / (n + (1 if row == 1 else 0))
				if row == 1 and i == n - 1:
					continue
				var pos: Vector3
				var yaw := 0.0
				match side:
					0: pos = Vector3(t, 0, -ez + 0.18)
					1: pos = Vector3(t, 0, ez - 0.18)
					2: pos = Vector3(-ex + 0.18, 0, t)
					_: pos = Vector3(ex - 0.18, 0, t)
				if side >= 2:
					yaw = PI * 0.5
				if side == 1 and absf(t) < 1.4:
					continue                                   # над порталом мешков нет
				bags.append(Transform3D(Basis(Vector3.UP, yaw + rng.randf_range(-0.07, 0.07)), pos + Vector3(rng.randf_range(-0.02, 0.02), ry + 0.09 + row * 0.18, 0)))
	# мешок — сплюснутый шар (подушка): у ящика-бруска мешки читались кирпичной кладкой
	var bag := SphereMesh.new()
	bag.radius = 0.5
	bag.height = 1.0
	bag.radial_segments = 10
	bag.rings = 5
	for i in bags.size():
		bags[i] = bags[i] * Transform3D(Basis.from_scale(Vector3(0.54, 0.22, 0.34)), Vector3.ZERO)
	_multi_tr(root, bags, bag, M["sand"])
	# земляной вал к задней стене (на него не залезть: столкновение — низкой плитой)
	var berm := _wedge(W + B_T * 2.0 + 0.6, B_WALL_H - 0.25, 2.8)
	var bmi := MeshInstance3D.new()
	bmi.mesh = berm
	bmi.material_override = M["earth"]
	bmi.position = Vector3(0, 0, -hd - B_T + 0.05)
	root.add_child(bmi)
	var bc := CollisionShape3D.new()
	var bbs := BoxShape3D.new()
	bbs.size = Vector3(W + B_T * 2.0 + 0.6, 1.4, 2.2)
	bc.shape = bbs
	bc.position = Vector3(0, 0.7, -hd - B_T - 1.0)
	body.add_child(bc)
	# на крыше: две вентиляционные трубы с колпаками, люк, антенна
	for vp in [Vector3(-3.6, 0, -2.2), Vector3(3.9, 0, -2.6)]:
		var pipe := MeshInstance3D.new()
		var cm := CylinderMesh.new()
		cm.top_radius = 0.16
		cm.bottom_radius = 0.18
		cm.height = 1.1
		cm.radial_segments = 12
		pipe.mesh = cm
		pipe.material_override = M["metal"]
		pipe.position = vp + Vector3(0, ry + 0.45, 0)
		root.add_child(pipe)
		var cap := MeshInstance3D.new()
		var cc := CylinderMesh.new()
		cc.top_radius = 0.05
		cc.bottom_radius = 0.34
		cc.height = 0.2
		cc.radial_segments = 12
		cap.mesh = cc
		cap.material_override = M["metal"]
		cap.position = vp + Vector3(0, ry + 1.1, 0)
		root.add_child(cap)
	_bx(root, Vector3(0.9, 0.25, 0.9), Vector3(1.2, ry + 0.6, 0.6), M["slab"])
	_bx(root, Vector3(0.75, 0.06, 0.75), Vector3(1.2, ry + 0.75, 0.6), M["armygreen"])
	var mast := MeshInstance3D.new()
	var mc := CylinderMesh.new()
	mc.top_radius = 0.025
	mc.bottom_radius = 0.04
	mc.height = 3.4
	mc.radial_segments = 6
	mast.mesh = mc
	mast.material_override = M["metal"]
	mast.position = Vector3(-4.8, ry + 0.4 + 1.7, 2.6)
	root.add_child(mast)
	for k in 3:
		_bx(root, Vector3(0.7 - k * 0.15, 0.025, 0.025), Vector3(-4.8, ry + 2.6 + k * 0.4, 2.6), M["metal"])
	return root


func _bx(parent: Node3D, size: Vector3, at: Vector3, mat: Material) -> MeshInstance3D:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = size
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	parent.add_child(mi)
	return mi


func _multi_tr(parent: Node3D, xfs: Array[Transform3D], mesh: Mesh, mat: Material) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = mesh
	mm.instance_count = xfs.size()
	for i in xfs.size():
		mm.set_instance_transform(i, xfs[i])
	var mmi := MultiMeshInstance3D.new()
	mmi.multimesh = mm
	mmi.material_override = mat
	parent.add_child(mmi)


## усечённая пирамида (насыпь): низ — bot (x, z), верх — top, высота h; основание в y = 0
static func _frustum(bot: Vector2, top: Vector2, h: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var b := [Vector3(-bot.x, 0, -bot.y), Vector3(bot.x, 0, -bot.y), Vector3(bot.x, 0, bot.y), Vector3(-bot.x, 0, bot.y)]
	var t := [Vector3(-top.x, h * 2.0, -top.y), Vector3(top.x, h * 2.0, -top.y), Vector3(top.x, h * 2.0, top.y), Vector3(-top.x, h * 2.0, top.y)]
	for i in 4:
		b[i] *= 0.5
		t[i] *= 0.5
	for i in 4:
		var j := (i + 1) % 4
		for v in [b[i], t[j], t[i], b[i], b[j], t[j]]:     # обход — как у Godot (лицевая сторона наружу)
			st.set_uv(Vector2(v.x + v.y, v.z + v.y))      # развёртка нужна для касательных (карта нормалей)
			st.add_vertex(v)
	for v in [t[0], t[1], t[2], t[0], t[2], t[3]]:
		st.set_uv(Vector2(v.x, v.z))
		st.add_vertex(v)
	st.generate_normals()
	st.generate_tangents()
	return st.commit()


## вал: клин вдоль x шириной w, высотой h у стены (z = 0), сходит на нет к z = −depth
static func _wedge(w: float, h: float, depth: float) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var x := w * 0.5
	var a := Vector3(-x, h, 0)
	var b := Vector3(x, h, 0)
	var c := Vector3(x, 0, -depth)
	var d := Vector3(-x, 0, -depth)
	for v in [a, d, c, a, c, b]:
		st.set_uv(Vector2(v.x, v.z - v.y))
		st.add_vertex(v)
	# торцы
	for v in [Vector3(-x, 0, 0), d, a, Vector3(x, 0, 0), b, c]:
		st.set_uv(Vector2(v.z, v.y))
		st.add_vertex(v)
	st.generate_normals()
	st.generate_tangents()
	return st.commit()


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
