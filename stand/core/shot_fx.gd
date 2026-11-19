class_name BCShotFx
extends Node3D
## Эффекты выстрела в мировых координатах: гильза (вылетает из окна ствольной коробки, летит по дуге, падает,
## раз отскакивает и остаётся лежать), дульная вспышка и дымок у ствола. Один узел на стрелка (ребёнок скелета,
## top_level): всё, что вылетело, остаётся в мире и не едет за персонажем. Узлы заготовлены заранее — в бою
## объекты не создаются. Размеры — в метрах мира.

const CASES := 10                 ## сколько гильз одного стрелка видно одновременно
const PUFFS := 4
const CASE_LIFE := 5.0            ## сколько гильза лежит, с
const CASE_K := 1.3               ## гильза чуть крупнее настоящей: иначе с камеры сверху её не видно
const PUFF_LIFE := 0.75

var _cases := []
var _ci := 0
var _puffs := []
var _pi := 0
var _flash: MeshInstance3D
var _flash_t := 0.0
var ejected := 0                  ## для проверок: сколько гильз вылетело и сколько дымков пущено
var puffed := 0
static var _tex: GradientTexture2D
static var _case_res := {}


static func _blob() -> GradientTexture2D:
	if _tex == null:
		var g := Gradient.new()
		g.set_color(0, Color(1, 1, 1, 1))
		g.set_color(1, Color(1, 1, 1, 0))
		g.add_point(0.45, Color(1, 1, 1, 0.55))
		_tex = GradientTexture2D.new()
		_tex.gradient = g
		_tex.fill = GradientTexture2D.FILL_RADIAL
		_tex.fill_from = Vector2(0.5, 0.5)
		_tex.fill_to = Vector2(1.0, 0.5)
		_tex.width = 64
		_tex.height = 64
	return _tex


## сетка и материал гильзы: [длина, радиус, цвет] → одна на все гильзы такого вида
static func _case(ln: float, r: float, col: Color) -> Array:
	var key := "%.3f_%.4f_%s" % [ln, r, col.to_html()]
	if not _case_res.has(key):
		var cm := CylinderMesh.new()
		cm.height = ln * CASE_K
		cm.top_radius = r * CASE_K * 0.82          # дульце уже донца
		cm.bottom_radius = r * CASE_K
		cm.radial_segments = 6
		cm.rings = 1
		var m := StandardMaterial3D.new()
		m.albedo_color = col
		m.metallic = 0.85
		m.roughness = 0.35
		_case_res[key] = [cm, m]
	return _case_res[key]


func _ready() -> void:
	top_level = true
	global_transform = Transform3D.IDENTITY
	for i in CASES:
		var mi := MeshInstance3D.new()
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visible = false
		add_child(mi)
		_cases.append({"n": mi, "v": Vector3.ZERO, "w": Vector3.ZERO, "t": 99.0, "y0": 0.0, "rest": true, "b": 0})
	for i in PUFFS:
		var mi := MeshInstance3D.new()
		var q := QuadMesh.new()
		q.size = Vector2.ONE
		mi.mesh = q
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.billboard_keep_scale = true
		m.albedo_texture = _blob()
		m.albedo_color = Color(0.86, 0.85, 0.82, 0.0)
		m.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visible = false
		add_child(mi)
		_puffs.append({"n": mi, "m": m, "v": Vector3.ZERO, "t": 99.0})
	_flash = MeshInstance3D.new()
	var fq := QuadMesh.new()
	fq.size = Vector2(0.26, 0.26)
	_flash.mesh = fq
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	fm.billboard_keep_scale = true
	fm.albedo_texture = _blob()
	fm.albedo_color = Color(1.0, 0.74, 0.36)
	fm.depth_draw_mode = BaseMaterial3D.DEPTH_DRAW_DISABLED
	_flash.material_override = fm
	_flash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	_flash.visible = false
	add_child(_flash)
	set_process(false)


## гильза: port — окно выброса (мир), wb — оси оружия в мире (x — вправо, y — вверх, −z — по стволу),
## ground_y — высота земли под стрелком, spec — [длина, радиус, цвет]
func eject(port: Vector3, wb: Basis, ground_y: float, spec: Array) -> void:
	if _cases.is_empty():
		return
	var res := _case(float(spec[0]), float(spec[1]), spec[2])
	var c: Dictionary = _cases[_ci]
	_ci = (_ci + 1) % CASES
	var mi: MeshInstance3D = c.n
	mi.mesh = res[0]
	mi.material_override = res[1]
	# ось гильзы — по стволу; вылетает вправо и вверх, чуть назад или вперёд, кувыркается
	var B := Basis(wb.x, -wb.z, wb.y).orthonormalized()
	mi.global_transform = Transform3D(B, port + wb.x * 0.02)
	mi.visible = true
	c.v = wb.x * randf_range(1.5, 2.3) + wb.y * randf_range(1.3, 2.0) + wb.z * randf_range(-0.35, 0.45)
	c.w = (wb.z * randf_range(0.6, 1.0) + wb.y * randf_range(-0.5, 0.5)).normalized() * randf_range(14.0, 26.0)
	c.t = 0.0
	c.y0 = ground_y + float(spec[1]) * CASE_K
	c.rest = false
	c.b = 0
	ejected += 1
	set_process(true)


## вспышка у дульного среза
func flash(muzzle: Vector3, dir: Vector3, size := 1.0) -> void:
	if _flash == null:
		return
	_flash.global_position = muzzle + dir * (0.09 * size)
	_flash.scale = Vector3.ONE * (randf_range(0.8, 1.2) * size)
	_flash.visible = true
	_flash_t = 0.05 * clampf(size, 1.0, 2.2)       # большая вспышка (тяжёлый пистолет главаря) держится чуть дольше
	set_process(true)


## дымок: появляется у ствола, уходит вперёд, расплывается и тает
func puff(muzzle: Vector3, dir: Vector3, size := 1.0) -> void:
	if _puffs.is_empty():
		return
	var p: Dictionary = _puffs[_pi]
	_pi = (_pi + 1) % PUFFS
	var mi: MeshInstance3D = p.n
	mi.global_position = muzzle + dir * 0.08
	mi.scale = Vector3.ONE * (0.12 * size)
	mi.visible = true
	p.k = size
	p.v = dir * randf_range(0.55, 0.85) + Vector3.UP * 0.16 + Vector3(randf_range(-0.1, 0.1), 0.0, randf_range(-0.1, 0.1))
	p.t = 0.0
	puffed += 1
	set_process(true)


func _process(delta: float) -> void:
	var busy := false
	if _flash_t > 0.0:
		_flash_t -= delta
		if _flash_t <= 0.0:
			_flash.visible = false
		else:
			busy = true
	for c in _cases:
		if float(c.t) > CASE_LIFE:
			continue
		c.t = float(c.t) + delta
		var mi: MeshInstance3D = c.n
		if float(c.t) > CASE_LIFE:
			mi.visible = false
			continue
		busy = true
		if bool(c.rest):
			continue
		var v: Vector3 = c.v
		v.y -= 9.8 * delta
		var T := mi.global_transform
		T.origin += v * delta
		var w: Vector3 = c.w
		if w.length() > 0.01:
			T.basis = (Basis(w.normalized(), w.length() * delta) * T.basis).orthonormalized()
		if T.origin.y <= float(c.y0):
			T.origin.y = float(c.y0)
			if int(c.b) < 1 and absf(v.y) > 1.2:
				# один отскок: теряет скорость, кувыркается медленнее
				c.b = int(c.b) + 1
				v = Vector3(v.x * 0.45, -v.y * 0.28, v.z * 0.45)
				c.w = w * 0.5
			else:
				# легла набок: ось гильзы — в плоскости земли
				var ax := T.basis.y
				ax.y = 0.0
				ax = ax.normalized() if ax.length() > 0.05 else Vector3.RIGHT
				T.basis = Basis(ax.cross(Vector3.UP).normalized(), ax, Vector3.UP).orthonormalized()
				v = Vector3.ZERO
				c.rest = true
		c.v = v
		mi.global_transform = T
	for p in _puffs:
		if float(p.t) > PUFF_LIFE:
			continue
		p.t = float(p.t) + delta
		var mi: MeshInstance3D = p.n
		var u := float(p.t) / PUFF_LIFE
		if u >= 1.0:
			mi.visible = false
			continue
		busy = true
		var pv: Vector3 = p.v
		pv *= exp(-3.2 * delta)
		p.v = pv
		mi.global_position += pv * delta
		mi.scale = Vector3.ONE * (lerpf(0.12, 0.4, 1.0 - (1.0 - u) * (1.0 - u)) * float(p.get("k", 1.0)))
		(p.m as StandardMaterial3D).albedo_color.a = 0.55 * pow(1.0 - u, 1.3)
	if not busy:
		set_process(false)


## сколько гильз сейчас видно и сколько из них уже лежит (для проверок)
func cases_state() -> Array:
	var vis := 0
	var rest := 0
	for c in _cases:
		if (c.n as MeshInstance3D).visible:
			vis += 1
			if bool(c.rest):
				rest += 1
	return [vis, rest]
