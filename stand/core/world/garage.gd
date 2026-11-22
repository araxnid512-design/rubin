class_name ULGarage
extends Node3D
## Гараж базы (ТЗ «Гараж, транспорт, модернизация, топливо, вооружение»; data/garage.json). Стоит слева от бункера,
## воротами на ту же сторону, что и главный вход. До покупки в компьютере базы — только бетонная площадка с
## табличкой; после — здание: бетонные стены, металлическая крыша, распашные ворота (открываются сами, когда к ним
## подъезжает машина или подходит герой), отдельная дверь для человека, свет, стеллажи, верстак, ящик инструментов,
## покрышки, канистры. В центре — платформа (рифлёный металл, жёлто-чёрные полосы по краю, пологие заезды со всех
## сторон, следы колёс, огни по углам): машина заезжает на неё и съезжает сама.
## Внутри четыре места (zones): компьютер модернизации, топливная станция, выбор машины, грузовой шкаф.
## Герой (или машина с ним) внутри — крыша скрыта, стены со стороны камеры срезаны на высоте CUT.
## Своя система: центр на земле, ворота — к +Z (W — по X, D — по Z).

const W := 8.0
const D := 10.0
const H := 3.4                    ## высота стен
const T := 0.25                   ## толщина стен
const CUT := 1.1
const GATE_W := 3.4
const GATE_H := 2.9
const DOOR_Z := 3.2               ## дверь для человека — в правой стене (к бункеру), ближе к воротам
const DOOR_W := 0.95
const DOOR_H := 2.1
const PLAT := Vector3(3.0, 0.1, 5.2)      ## платформа: ширина, высота, длина верха
const PLAT_Z := 0.4
const RAMP := 0.7
const ZONE_N := {"g_term": "компьютер модернизации", "g_fuel": "топливная станция", "g_sel": "выбор машины", "g_cab": "грузовой шкаф"}
const ZONES := {"g_term": Vector3(-2.75, 0, -0.6), "g_sel": Vector3(-2.75, 0, 2.0), "g_fuel": Vector3(-2.3, 0, -3.25), "g_cab": Vector3(2.75, 0, -1.8)}
const MODELS := "res://assets/world/"
const TEX := "res://assets/world/tex/"

const PLATE_SHADER := """shader_type spatial;
// платформа: рифлёный металл (ромбы в шахматном порядке), жёлто-чёрные полосы по краю и на заездах, следы колёс
uniform vec2 half_top = vec2(1.5, 2.6);
varying vec3 lp;
void vertex() { lp = VERTEX; }
void fragment() {
	vec2 p = lp.xz;
	vec2 g = p / 0.09;
	vec2 c = fract(g) - 0.5;
	vec2 id = floor(g);
	float s = mod(id.x + id.y, 2.0) < 1.0 ? 1.0 : -1.0;
	vec2 r = vec2(c.x + s * c.y, c.x - s * c.y) * 0.7071;
	float bump = 1.0 - smoothstep(0.05, 0.11, length(r * vec2(0.32, 1.7)));
	vec3 metal = vec3(0.36, 0.37, 0.38) * (0.82 + 0.3 * bump);
	float wm = (1.0 - smoothstep(0.1, 0.26, abs(abs(p.x) - 0.72))) * 0.45;
	metal *= 1.0 - wm;
	vec2 e = half_top - abs(p);
	float edge = min(e.x, e.y);
	float st = step(0.5, fract((p.x + p.y) / 0.32));
	vec3 yb = mix(vec3(0.05, 0.05, 0.04), vec3(0.92, 0.68, 0.08), st);
	bool band = edge < 0.16;
	ALBEDO = band ? yb : metal;
	METALLIC = band ? 0.1 : 0.55;
	ROUGHNESS = band ? 0.7 : 0.5 - 0.15 * bump;
}
"""

var built := false                ## здание (после покупки); иначе — площадка
var gate_open := 0.0              ## 0 — закрыты, 1 — открыты
var inside := false
var _gate_want := false
var _leaves: Array = []           ## [pivot, знак]
var _gate_col: Array = []         ## столкновения створок (только у закрытых)
var _sides := {}                  ## сторона → {full: Node3D, low: Node3D, n: нормаль наружу (своя система)}
var _roof: Node3D
var _light: OmniLight3D
var _door: ULDoor
var _st := {}                     ## «группа/материал» → SurfaceTool
var _mats := {}
var _body: StaticBody3D
var _cfg := {}


func setup(cfg: Dictionary, is_built: bool) -> void:
	_cfg = cfg
	built = is_built
	var at: Array = cfg.get("at", [-14.6, 0.0, -12.0])
	position = Vector3(float(at[0]), float(at[1]), float(at[2]))
	_body = StaticBody3D.new()
	_body.name = "GarageBody"
	add_child(_body)
	_materials()
	_pad()
	if built:
		_build()
	_flush()


func _materials() -> void:
	_mats["wall"] = ULHouse._mat(TEX + "worn_plaster_wall", 2.2)
	(_mats.wall as StandardMaterial3D).albedo_color = Color(0.68, 0.68, 0.66)
	_mats["plinth"] = ULHouse._mat(TEX + "damaged_concrete_floor", 1.6)
	(_mats.plinth as StandardMaterial3D).albedo_color = Color(0.55, 0.55, 0.54)
	_mats["floor"] = ULHouse._mat(TEX + "concrete_floor_worn_001", 3.0)
	(_mats.floor as StandardMaterial3D).albedo_color = Color(0.62, 0.62, 0.6)
	_mats["roof"] = ULHouse._mat(TEX + "rusty_corrugated_iron", 2.0)
	_mats["gate"] = ULHouse._mat(TEX + "worn_corrugated_iron", 1.4)
	(_mats.gate as StandardMaterial3D).albedo_color = Color(0.42, 0.5, 0.42)
	_mats["metal"] = StandardMaterial3D.new()
	(_mats.metal as StandardMaterial3D).albedo_color = Color(0.2, 0.21, 0.2)
	(_mats.metal as StandardMaterial3D).metallic = 0.5
	(_mats.metal as StandardMaterial3D).roughness = 0.55
	_mats["yellow"] = StandardMaterial3D.new()
	(_mats.yellow as StandardMaterial3D).albedo_color = Color(0.85, 0.62, 0.08)
	(_mats.yellow as StandardMaterial3D).roughness = 0.6
	_mats["wood"] = ULHouse._mat(TEX + "weathered_brown_planks", 1.0)
	_mats["rust"] = ULHouse._mat(TEX + "rusty_metal_02", 1.2)
	_mats["lamp"] = StandardMaterial3D.new()
	(_mats.lamp as StandardMaterial3D).albedo_color = Color(1.0, 0.97, 0.85)
	(_mats.lamp as StandardMaterial3D).emission_enabled = true
	(_mats.lamp as StandardMaterial3D).emission = Color(1.0, 0.92, 0.7)
	(_mats.lamp as StandardMaterial3D).emission_energy_multiplier = 2.2
	_mats["amber"] = StandardMaterial3D.new()
	(_mats.amber as StandardMaterial3D).albedo_color = Color(1.0, 0.6, 0.15)
	(_mats.amber as StandardMaterial3D).emission_enabled = true
	(_mats.amber as StandardMaterial3D).emission = Color(1.0, 0.55, 0.1)
	(_mats.amber as StandardMaterial3D).emission_energy_multiplier = 1.6
	_mats["screen"] = StandardMaterial3D.new()
	(_mats.screen as StandardMaterial3D).albedo_color = Color(0.2, 0.9, 0.45)
	(_mats.screen as StandardMaterial3D).emission_enabled = true
	(_mats.screen as StandardMaterial3D).emission = Color(0.25, 1.0, 0.5)
	(_mats.screen as StandardMaterial3D).emission_energy_multiplier = 1.2


# ---------------- геометрия ----------------

func _box(g: String, mat: String, size: Vector3, at: Vector3, col := false, yaw := 0.0) -> void:
	var key := g + "|" + mat
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	var bm := BoxMesh.new()
	bm.size = size
	(_st[key] as SurfaceTool).append_from(bm, 0, Transform3D(Basis(Vector3.UP, yaw), at))
	if col:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = size
		cs.shape = bs
		cs.transform = Transform3D(Basis(Vector3.UP, yaw), at)
		_body.add_child(cs)


func _cyl(g: String, mat: String, r: float, h: float, xf: Transform3D, seg := 16) -> void:
	var key := g + "|" + mat
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = h
	cm.radial_segments = seg
	cm.rings = 1
	(_st[key] as SurfaceTool).append_from(cm, 0, xf)


func _group(g: String) -> Node3D:
	var n := get_node_or_null(g) as Node3D
	if n == null:
		n = Node3D.new()
		n.name = g
		add_child(n)
	return n


func _flush() -> void:
	for key in _st:
		var parts := String(key).split("|")
		var st: SurfaceTool = _st[key]
		st.generate_normals()
		var mi := MeshInstance3D.new()
		mi.mesh = st.commit()
		mi.material_override = _mats[parts[1]]
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_group(parts[0]).add_child(mi)
	_st.clear()


## площадка (и пол гаража): бетонная плита вровень с землёй, перед воротами — отмостка
func _pad() -> void:
	_box("base", "floor", Vector3(W + 0.6, 0.06, D + 0.6), Vector3(0, -0.015, 0))
	_box("base", "floor", Vector3(GATE_W + 1.6, 0.05, 3.2), Vector3(0, -0.02, D * 0.5 + 1.9))
	if not built:
		var lb := Label3D.new()
		lb.text = "Место под гараж\n(компьютер базы → улучшения)"
		lb.font_size = 64
		lb.pixel_size = 0.006
		lb.outline_size = 14
		lb.modulate = Color(1.0, 0.92, 0.7)
		lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		lb.position = Vector3(0, 1.4, D * 0.5 - 0.5)
		add_child(lb)
		# колышки с лентой по углам площадки
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				_box("base", "wood", Vector3(0.08, 0.9, 0.08), Vector3(sx * (W * 0.5 + 0.1), 0.45, sz * (D * 0.5 + 0.1)), true)


func _build() -> void:
	_walls()
	_gates()
	_roof_build()
	_platform()
	_furniture()
	_lights()
	var dm := StandardMaterial3D.new()
	dm.albedo_color = Color(0.32, 0.36, 0.3)
	dm.roughness = 0.8
	_door = ULDoor.new()
	add_child(_door)
	# дверь в правой стене: петли у края к воротам, открывается внутрь
	_door.setup(Vector3.ZERO, Vector3(0, 0, -1), Vector3(-1, 0, 0), DOOR_W, DOOR_H, dm, false)
	_door.position = Vector3(W * 0.5 - T * 0.5, 0, DOOR_Z)


## стена стороны side вдоль отрезка a…b (по оси стены), с проёмами [a0, b0, h] — полная и срезанная версии
func _wall_side(side: String, opens: Array) -> void:
	var n: Vector3 = {"f": Vector3(0, 0, 1), "b": Vector3(0, 0, -1), "l": Vector3(-1, 0, 0), "r": Vector3(1, 0, 0)}[side]
	var along_x := side == "f" or side == "b"
	var len := W if along_x else D - 2.0 * T
	var off := (D * 0.5 - T * 0.5) if along_x else (W * 0.5 - T * 0.5)
	var full := _group("w_" + side + "_full")
	var low := _group("w_" + side + "_low")
	low.visible = false
	_sides[side] = {"full": full, "low": low, "n": n}
	# куски стены между проёмами
	var cuts: Array = [[-len * 0.5, len * 0.5]]
	for o in opens:
		var nx: Array = []
		for c in cuts:
			if float(o[1]) <= float(c[0]) or float(o[0]) >= float(c[1]):
				nx.append(c)
				continue
			if float(o[0]) > float(c[0]):
				nx.append([c[0], o[0]])
			if float(o[1]) < float(c[1]):
				nx.append([o[1], c[1]])
		cuts = nx
	for g in ["full", "low"]:
		var top := H if g == "full" else CUT
		var gk: String = "w_" + side + "_" + String(g)
		for c in cuts:
			var m := (float(c[0]) + float(c[1])) * 0.5
			var l := float(c[1]) - float(c[0])
			var at := Vector3(m, 0, n.z * off) if along_x else Vector3(n.x * off, 0, m)
			var sz := Vector3(l, 0, T) if along_x else Vector3(T, 0, l)
			_box(gk, "plinth", Vector3(sz.x + (0.04 if along_x else 0.04), 0.45, sz.z + 0.04), at + Vector3(0, 0.225, 0))
			_box(gk, "wall", Vector3(sz.x, top - 0.45, sz.z), at + Vector3(0, 0.45 + (top - 0.45) * 0.5, 0), g == "full")
		if g == "full":
			for o in opens:
				var m := (float(o[0]) + float(o[1])) * 0.5
				var l := float(o[1]) - float(o[0])
				var oh := float(o[2])
				var at := Vector3(m, 0, n.z * off) if along_x else Vector3(n.x * off, 0, m)
				var sz := Vector3(l, 0, T) if along_x else Vector3(T, 0, l)
				_box(gk, "wall", Vector3(sz.x, H - oh, sz.z), at + Vector3(0, oh + (H - oh) * 0.5, 0), true)
				# рама проёма из уголка
				_box(gk, "metal", Vector3(sz.x + (0.1 if along_x else 0.06), 0.1, sz.z + (0.06 if along_x else 0.1)), at + Vector3(0, oh + 0.05, 0))


func _walls() -> void:
	_wall_side("f", [[-GATE_W * 0.5, GATE_W * 0.5, GATE_H]])
	_wall_side("b", [])
	_wall_side("l", [])
	_wall_side("r", [[DOOR_Z - DOOR_W * 0.5, DOOR_Z + DOOR_W * 0.5, DOOR_H]])
	# угловые столбы (железобетон) — во всю высоту, в полной версии
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			var side := "f" if sz > 0.0 else "b"
			_box("w_" + side + "_full", "plinth", Vector3(0.34, H + 0.05, 0.34), Vector3(sx * (W * 0.5 - 0.1), (H + 0.05) * 0.5, sz * (D * 0.5 - 0.1)))
			_box("w_" + side + "_low", "plinth", Vector3(0.34, CUT + 0.05, 0.34), Vector3(sx * (W * 0.5 - 0.1), (CUT + 0.05) * 0.5, sz * (D * 0.5 - 0.1)))


## распашные ворота: две створки из профлиста на раме, петли — у краёв проёма, открываются наружу
func _gates() -> void:
	var leaf_w := GATE_W * 0.5 - 0.03
	for s in [-1.0, 1.0]:
		var pv := Node3D.new()
		pv.position = Vector3(s * GATE_W * 0.5, 0, D * 0.5 + 0.02)
		add_child(pv)
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		var bm := BoxMesh.new()
		bm.size = Vector3(leaf_w, GATE_H - 0.06, 0.05)
		st.append_from(bm, 0, Transform3D(Basis(), Vector3(-s * leaf_w * 0.5, GATE_H * 0.5, 0)))
		var leaf := MeshInstance3D.new()
		leaf.mesh = st.commit()
		leaf.material_override = _mats.gate
		pv.add_child(leaf)
		# рама и диагональ створки
		var fr := SurfaceTool.new()
		fr.begin(Mesh.PRIMITIVE_TRIANGLES)
		for y in [0.08, GATE_H * 0.5, GATE_H - 0.1]:
			bm.size = Vector3(leaf_w, 0.07, 0.07)
			fr.append_from(bm, 0, Transform3D(Basis(), Vector3(-s * leaf_w * 0.5, y, 0.04)))
		for x in [0.04, leaf_w - 0.04]:
			bm.size = Vector3(0.07, GATE_H - 0.06, 0.07)
			fr.append_from(bm, 0, Transform3D(Basis(), Vector3(-s * x, GATE_H * 0.5, 0.04)))
		bm.size = Vector3(0.06, 0.06, 0.05)
		fr.append_from(bm, 0, Transform3D(Basis(), Vector3(-s * (leaf_w - 0.15), 1.25, 0.08)))      # ручка
		var frm := MeshInstance3D.new()
		frm.mesh = fr.commit()
		frm.material_override = _mats.metal
		pv.add_child(frm)
		_leaves.append([pv, s])
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(leaf_w, GATE_H, 0.12)
		cs.shape = bs
		cs.position = Vector3(s * (GATE_W * 0.5 - leaf_w * 0.5), GATE_H * 0.5, D * 0.5 + 0.02)
		_body.add_child(cs)
		_gate_col.append(cs)
	# фонарь над воротами
	_box("w_f_full", "metal", Vector3(0.3, 0.12, 0.25), Vector3(0, GATE_H + 0.3, D * 0.5 + 0.2))
	_box("w_f_full", "lamp", Vector3(0.24, 0.05, 0.18), Vector3(0, GATE_H + 0.22, D * 0.5 + 0.22))


## односкатная крыша из профлиста: выше у ворот, свес со всех сторон; балки под ней
func _roof_build() -> void:
	_roof = _group("roof")
	var ov := 0.3
	var rise := 0.35
	var len := D + ov * 2.0
	var ang := atan2(rise, D)
	var mid_y := H + rise * 0.5 + 0.06
	_box("roof", "roof", Vector3(W + ov * 2.0, 0.06, len / cos(ang)), Vector3(0, mid_y, 0))
	# наклон — поворотом готового куска не сделать в общем меше: отдельный узел
	_flush()
	for mi in _roof.get_children():
		(mi as Node3D).rotation.x = -ang
		(mi as Node3D).position.y = 0.0
	_box("roof_beams", "metal", Vector3(W, 0.16, 0.12), Vector3(0, H - 0.08, -2.0))
	_box("roof_beams", "metal", Vector3(W, 0.16, 0.12), Vector3(0, H - 0.08, 1.5))
	_flush()
	_group("roof_beams").reparent(_roof)


## платформа: пологие заезды со всех сторон (машина въезжает сама), огни по углам, подъёмник по бокам
func _platform() -> void:
	var mi := MeshInstance3D.new()
	var top := Vector2(PLAT.x, PLAT.z)
	var bot := top + Vector2.ONE * RAMP * 2.0
	mi.mesh = ULHouse._frustum(bot, top, PLAT.y)
	var sh := Shader.new()
	sh.code = PLATE_SHADER
	var sm := ShaderMaterial.new()
	sm.shader = sh
	sm.set_shader_parameter("half_top", top * 0.5)
	mi.material_override = sm
	mi.position = Vector3(0, 0.0, PLAT_Z)
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
	var pts := PackedVector3Array()
	for v in [Vector3(-bot.x, 0, -bot.y), Vector3(bot.x, 0, -bot.y), Vector3(bot.x, 0, bot.y), Vector3(-bot.x, 0, bot.y)]:
		pts.append(v * 0.5 + Vector3(0, -0.02, PLAT_Z))
	for v in [Vector3(-top.x, 0, -top.y), Vector3(top.x, 0, -top.y), Vector3(top.x, 0, top.y), Vector3(-top.x, 0, top.y)]:
		pts.append(v * 0.5 + Vector3(0, PLAT.y, PLAT_Z))
	var cs := CollisionShape3D.new()
	var cp := ConvexPolygonShape3D.new()
	cp.points = pts
	cs.shape = cp
	_body.add_child(cs)
	# огни по углам верха
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			_box("plat", "amber", Vector3(0.12, 0.03, 0.12), Vector3(sx * (PLAT.x * 0.5 - 0.09), PLAT.y + 0.015, PLAT_Z + sz * (PLAT.z * 0.5 - 0.09)))
	# стойки подъёмника (жёлтые) по бокам платформы, с лапами
	var px := PLAT.x * 0.5 + RAMP - 0.2
	for sx in [-1.0, 1.0]:
		for z in [PLAT_Z - 1.4, PLAT_Z + 1.4]:
			_box("plat", "yellow", Vector3(0.2, 2.7, 0.24), Vector3(sx * px, 1.35, z), true)
			_box("plat", "metal", Vector3(0.36, 0.08, 0.4), Vector3(sx * px, 0.04, z))
			_box("plat", "metal", Vector3(0.12, 0.06, 0.5), Vector3(sx * px, 0.42, z + (0.3 if z > PLAT_Z else -0.3)))
		_box("plat", "yellow", Vector3(0.14, 0.14, 2.8 + 0.24), Vector3(sx * px, 2.62, PLAT_Z))


## обстановка: модели Tripo (гаражные — если уже есть) и свои детали; у мест взаимодействия — свои вещи
func _furniture() -> void:
	# компьютер модернизации (у левой стены, экраном в гараж)
	if not _model("gr_terminal", Vector3(-W * 0.5 + T + 0.4, 0, ZONES.g_term.z), PI * 0.5, 1.5, "h"):
		_box("furn", "metal", Vector3(0.7, 0.9, 1.3), Vector3(-W * 0.5 + T + 0.38, 0.45, ZONES.g_term.z), true)
		_box("furn", "metal", Vector3(0.12, 0.7, 1.0), Vector3(-W * 0.5 + T + 0.12, 1.4, ZONES.g_term.z))
		_box("furn", "screen", Vector3(0.03, 0.55, 0.85), Vector3(-W * 0.5 + T + 0.2, 1.4, ZONES.g_term.z))
		_box("furn", "metal", Vector3(0.3, 0.04, 0.6), Vector3(-W * 0.5 + T + 0.6, 0.92, ZONES.g_term.z))
	# выбор машины: экран на стене с тремя местами
	_box("furn", "metal", Vector3(0.1, 1.0, 1.6), Vector3(-W * 0.5 + T + 0.05, 1.55, ZONES.g_sel.z))
	_box("furn", "screen", Vector3(0.03, 0.84, 1.44), Vector3(-W * 0.5 + T + 0.12, 1.55, ZONES.g_sel.z))
	_box("furn", "metal", Vector3(0.45, 1.0, 0.5), Vector3(-W * 0.5 + T + 0.25, 0.5, ZONES.g_sel.z), true)
	# топливная станция: большой ржавый бак «ТОПЛИВО» на опорах у задней стены, колонка со шлангом
	var tank_at := Vector3(-W * 0.5 + T + 1.25, 0, -D * 0.5 + T + 0.75)
	if not _model("gr_fueltank", tank_at, 0.0, 2.3, "x"):
		_cyl("furn", "rust", 0.62, 2.3, Transform3D(Basis(Vector3.FORWARD, PI * 0.5), tank_at + Vector3(0, 1.05, 0)), 20)
		for xx in [-0.7, 0.7]:
			_box("furn", "metal", Vector3(0.12, 0.5, 1.0), tank_at + Vector3(xx, 0.25, 0), true)
		_cyl("furn", "metal", 0.15, 0.12, Transform3D(Basis(), tank_at + Vector3(0.4, 1.7, 0)))
	# надпись по трафарету на боку бака
	var lb := Label3D.new()
	lb.text = "ТОПЛИВО"
	lb.font_size = 72
	lb.pixel_size = 0.005
	lb.modulate = Color(0.92, 0.9, 0.82)
	lb.outline_size = 0
	lb.position = tank_at + Vector3(0, 0.95, 0.6)
	add_child(lb)
	var col := CollisionShape3D.new()
	var tb := BoxShape3D.new()
	tb.size = Vector3(2.4, 1.7, 1.3)
	col.shape = tb
	col.position = tank_at + Vector3(0, 0.85, 0)
	_body.add_child(col)
	_box("furn", "metal", Vector3(0.4, 1.3, 0.35), tank_at + Vector3(1.55, 0.65, 0.2), true)
	_box("furn", "screen", Vector3(0.28, 0.18, 0.02), tank_at + Vector3(1.55, 1.05, 0.38))
	_prop("cv_jerrycans", tank_at + Vector3(-0.2, 0, 0.95), 0.0, 0.75)
	# грузовой шкаф (у правой стены, дверцами в гараж)
	if not _model("gr_cabinet", Vector3(W * 0.5 - T - 0.35, 0, ZONES.g_cab.z), PI, 2.0, "h"):        # дверцы у модели — к +X
		_box("furn", "gate", Vector3(0.6, 2.0, 1.5), Vector3(W * 0.5 - T - 0.32, 1.0, ZONES.g_cab.z), true)
		_box("furn", "metal", Vector3(0.02, 1.9, 0.02), Vector3(W * 0.5 - T - 0.62, 1.0, ZONES.g_cab.z))
		for zz in [-0.1, 0.1]:
			_box("furn", "metal", Vector3(0.04, 0.2, 0.03), Vector3(W * 0.5 - T - 0.64, 1.1, ZONES.g_cab.z + zz))
	else:
		var cc := CollisionShape3D.new()
		var cb := BoxShape3D.new()
		cb.size = Vector3(0.6, 2.0, 1.5)
		cc.shape = cb
		cc.position = Vector3(W * 0.5 - T - 0.32, 1.0, ZONES.g_cab.z)
		_body.add_child(cc)
	# верстак у задней стены, ящик инструментов, стеллаж с запчастями, покрышки
	if not _model("gr_workbench", Vector3(1.2, 0, -D * 0.5 + T + 0.38), 0.0, 2.1, "x"):
		_box("furn", "wood", Vector3(2.1, 0.08, 0.7), Vector3(1.2, 0.9, -D * 0.5 + T + 0.38), true)
		for xx in [0.25, 2.15]:
			_box("furn", "metal", Vector3(0.08, 0.86, 0.6), Vector3(xx, 0.43, -D * 0.5 + T + 0.38))
		_box("furn", "wood", Vector3(2.1, 0.9, 0.04), Vector3(1.2, 1.45, -D * 0.5 + T + 0.04))
		_prop("qi_tool", Vector3(0.9, 0.94, -D * 0.5 + T + 0.4), 0.3, 0.45, false, false)
	if not _model("gr_toolchest", Vector3(W * 0.5 - T - 0.35, 0, -D * 0.5 + T + 0.45), PI, 1.0, "h"):
		_box("furn", "yellow", Vector3(0.6, 1.0, 0.8), Vector3(W * 0.5 - T - 0.33, 0.5, -D * 0.5 + T + 0.5), true)
		for y in [0.3, 0.55, 0.8]:
			_box("furn", "metal", Vector3(0.02, 0.03, 0.6), Vector3(W * 0.5 - T - 0.64, y, -D * 0.5 + T + 0.5))
	_prop("hm_rack", Vector3(W * 0.5 - T - 0.3, 0, 1.0), -PI * 0.5, 1.8, true)
	for i in 3:
		_prop("ph_tyre", Vector3(-W * 0.5 + T + 0.55, 0.0 + i * 0.27, D * 0.5 - T - 0.6), i * 0.7, 0.95, false, false)
	_prop("ph_tyre", Vector3(W * 0.5 - T - 0.5, 0.0, 0.0), 0.0, 0.95)
	_prop("ph_barrel", Vector3(-W * 0.5 + T + 0.45, 0, -1.8), 0.0, 0.95)
	var tc := CollisionShape3D.new()
	var tyb := BoxShape3D.new()
	tyb.size = Vector3(1.0, 0.9, 1.0)
	tc.shape = tyb
	tc.position = Vector3(-W * 0.5 + T + 0.55, 0.45, D * 0.5 - T - 0.6)
	_body.add_child(tc)


## модель Tripo, если уже есть: низ на полу, по высоте (fit «h») или длине по X (fit «x»); false — модели нет
func _model(id: String, at: Vector3, yaw: float, sz: float, fit: String) -> bool:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		return false
	var n: Node3D = (load(path) as PackedScene).instantiate()
	_group("models").add_child(n)
	n.rotation.y = yaw
	var b := _aabb(n)
	if fit == "x" and b.size.z > b.size.x:
		n.rotation.y = yaw + PI * 0.5                      # длинная сторона — вдоль стены (по X)
		b = _aabb(n)
	var ref := b.size.y if fit == "h" else maxf(b.size.x, b.size.z)
	n.scale = Vector3.ONE * (sz / maxf(ref, 0.01))
	b = _aabb(n)
	n.position = at - Vector3(b.get_center().x - n.position.x, b.position.y - n.position.y, b.get_center().z - n.position.z)
	for gi in n.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	return true


func _prop(id: String, at: Vector3, yaw: float, sz: float, by_h := false, col := true) -> void:
	var path := MODELS + id + ".glb"
	if not ResourceLoader.exists(path):
		return
	var n: Node3D = (load(path) as PackedScene).instantiate()
	_group("models").add_child(n)
	n.rotation.y = yaw
	var b := _aabb(n)
	var ref := b.size.y if by_h else maxf(maxf(b.size.x, b.size.y), b.size.z)
	n.scale = Vector3.ONE * (sz / maxf(ref, 0.01))
	b = _aabb(n)
	n.position = at - Vector3(b.get_center().x - n.position.x, b.position.y - n.position.y, b.get_center().z - n.position.z)
	for gi in n.find_children("*", "GeometryInstance3D", true, false):
		(gi as GeometryInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	if col:
		b = _aabb(n)
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = Vector3(maxf(b.size.x * 0.9, 0.2), maxf(b.size.y, 0.3), maxf(b.size.z * 0.9, 0.2))
		cs.shape = bs
		cs.position = b.get_center()
		_body.add_child(cs)


## рамка узла в системе гаража
func _aabb(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	var inv := global_transform.affine_inverse() if is_inside_tree() else Transform3D()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var xf := (inv * m.global_transform) if is_inside_tree() else _rel(m)
		var bb := xf * m.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


func _rel(m: Node3D) -> Transform3D:
	var xf := Transform3D()
	var cur: Node = m
	while cur != null and cur != self:
		if cur is Node3D:
			xf = (cur as Node3D).transform * xf
		cur = cur.get_parent()
	return xf


## лампы под крышей (светят, только когда герой внутри — снаружи их не видно)
func _lights() -> void:
	for z in [-2.0, 2.2]:
		_box("roof_lamps", "metal", Vector3(1.3, 0.06, 0.16), Vector3(0, H - 0.2, z))
		_box("roof_lamps", "lamp", Vector3(1.2, 0.04, 0.1), Vector3(0, H - 0.24, z))
	_flush()
	_light = OmniLight3D.new()
	_light.position = Vector3(0, H - 0.6, 0.2)
	_light.omni_range = 8.5
	_light.light_energy = 1.1
	_light.light_color = Color(1.0, 0.94, 0.82)
	_light.shadow_enabled = false
	_light.visible = false
	add_child(_light)


# ---------------- в игре ----------------

## точка внутри гаража (мир)?
func contains(p: Vector3) -> bool:
	var l := to_local(p)
	return built and absf(l.x) < W * 0.5 - 0.1 and absf(l.z) < D * 0.5 - 0.05


## места взаимодействия (мир)
func zones() -> Dictionary:
	if not built:
		return {}
	var out := {}
	for k in ZONES:
		out[k] = to_global(ZONES[k])
	return out


## где машина стоит на платформе: носом к воротам
func platform_xf() -> Transform3D:
	return Transform3D(Basis.IDENTITY, to_global(Vector3(0, PLAT.y, PLAT_Z)))


## кадр: ворота (открыты, когда машина с водителем рядом с ними или герой у ворот, или машина стоит в проёме),
## дверь (герой рядом), крыша и стены со стороны камеры (герой внутри)
func tick(delta: float, hero: Vector3, car: Node3D, driving: bool, cam_dir: Vector3) -> void:
	if not built:
		return
	var gate_c := to_global(Vector3(0, 0, D * 0.5))
	var want := false
	if car != null and is_instance_valid(car):
		var cl := to_local(car.global_position)
		if driving and car.global_position.distance_to(gate_c) < 9.0:
			want = true
		if absf(cl.x) < GATE_W and absf(cl.z - D * 0.5) < 2.8:
			want = true                          # машина в проёме — ворота не закрыть
	if hero.distance_to(gate_c) < 2.6:
		want = true
	gate_open = move_toward(gate_open, 1.0 if want else 0.0, delta * (1.2 if want else 0.8))
	var a := deg_to_rad(100.0) * (1.0 - pow(1.0 - gate_open, 2.0))
	for lv in _leaves:
		(lv[0] as Node3D).rotation.y = float(lv[1]) * a
	for cs in _gate_col:
		(cs as CollisionShape3D).disabled = gate_open > 0.12
	if _door != null:
		_door.set_open(hero.distance_to(_door.global_position) < 2.2)
		_door.tick(delta)
	var ins := contains(hero)
	if ins != inside:
		inside = ins
		_roof.visible = not ins
		_light.visible = ins
	var lc := global_transform.basis.inverse() * cam_dir
	for side in _sides:
		var sd: Dictionary = _sides[side]
		var cut := ins and (sd.n as Vector3).dot(lc) > 0.25
		(sd.full as Node3D).visible = not cut
		(sd.low as Node3D).visible = cut
		if side == "f":
			# створки ворот — тоже по срезу стены: изнутри платформу и машину не загораживают
			for lv in _leaves:
				(lv[0] as Node3D).scale.y = CUT / GATE_H if cut else 1.0
