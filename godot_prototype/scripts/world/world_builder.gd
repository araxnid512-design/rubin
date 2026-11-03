class_name WorldBuilder
extends RefCounted
## Строит статическую часть локации «База Долга» 300×300 м: землю, периметр, дороги, окружение,
## растительность и коллизии. Геометрия объединяется по чанкам 50×50 м (мало draw-call, отсечение).

const L = preload("res://scripts/world/layout.gd")
const M = preload("res://scripts/core/mesh_builder.gd")
const CHUNK := 50.0
const HALF := 150.0
const SPLAT_RES := 512

var root: Node3D
var rng := RandomNumberGenerator.new()
var chunks := {}          # Vector2i -> MeshBuilder (статика)
var fol_chunks := {}      # Vector2i -> MeshBuilder (растительность)
var col: Array = []       # [Transform3D, Vector3] — коллизии-боксы
var nav_extra: Array = [] # дополнительные препятствия
var splat: Image
var lamp_points: Array = []
var fire_points: Array = []
var grass_points: PackedVector3Array = PackedVector3Array()
var tree_cols: Array = []
var signs: Array = []

func _init(r: Node3D) -> void:
	root = r
	rng.seed = 20241104

func chunk_of(p: Vector3) -> Vector2i:
	return Vector2i(clampi(int(floor((p.x + HALF) / CHUNK)), 0, 5), clampi(int(floor((p.z + HALF) / CHUNK)), 0, 5))

func mb_at(p: Vector3) -> MeshBuilder:
	var k := chunk_of(p)
	if not chunks.has(k):
		chunks[k] = MeshBuilder.new()
	return chunks[k]

func fol_at(p: Vector3) -> MeshBuilder:
	var k := chunk_of(p)
	if not fol_chunks.has(k):
		fol_chunks[k] = MeshBuilder.new()
	return fol_chunks[k]

# ======================================================================
#   КАРТА СМЕШИВАНИЯ ЗЕМЛИ
# ======================================================================
func _px(v: float) -> int:
	return clampi(int((v + HALF) / (2.0 * HALF) * SPLAT_RES), 0, SPLAT_RES - 1)

func _splat_rect(cx: float, cz: float, w: float, d: float, ch: int, val: float) -> void:
	var x0 := _px(cx - w * 0.5)
	var x1 := _px(cx + w * 0.5)
	var z0 := _px(cz - d * 0.5)
	var z1 := _px(cz + d * 0.5)
	for z in range(z0, z1 + 1):
		for x in range(x0, x1 + 1):
			var c := splat.get_pixel(x, z)
			c[ch] = maxf(c[ch], val)
			if ch == 0 or ch == 2:
				c.g = minf(c.g, 1.0 - val)
			splat.set_pixel(x, z, c)

func _splat_line(a: Vector2, b: Vector2, w: float, ch: int, val: float) -> void:
	var d := b - a
	var l := d.length()
	var steps := int(l / (2.0 * HALF / SPLAT_RES)) + 1
	var r := int(w * 0.5 / (2.0 * HALF) * SPLAT_RES) + 1
	for i in steps + 1:
		var p := a.lerp(b, float(i) / steps)
		var px := _px(p.x)
		var pz := _px(p.y)
		for dz in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var x := px + dx
				var z := pz + dz
				if x < 0 or z < 0 or x >= SPLAT_RES or z >= SPLAT_RES:
					continue
				var dist := Vector2(dx, dz).length() / float(r)
				if dist > 1.0 and absf(d.normalized().cross(Vector2(dx, dz))) > r:
					continue
				var c := splat.get_pixel(x, z)
				c[ch] = maxf(c[ch], val)
				if ch != 1 and ch != 3:
					c.g = minf(c.g, 1.0 - val)
				splat.set_pixel(x, z, c)

func _splat_circle(cx: float, cz: float, r: float, ch: int, val: float, soft: bool = true) -> void:
	var pr := int(r / (2.0 * HALF) * SPLAT_RES) + 1
	var px := _px(cx)
	var pz := _px(cz)
	for dz in range(-pr, pr + 1):
		for dx in range(-pr, pr + 1):
			var x := px + dx
			var z := pz + dz
			if x < 0 or z < 0 or x >= SPLAT_RES or z >= SPLAT_RES:
				continue
			var dist := Vector2(dx, dz).length() / float(pr)
			if dist > 1.0:
				continue
			var k := val * (1.0 - dist * dist if soft else 1.0)
			var c := splat.get_pixel(x, z)
			c[ch] = maxf(c[ch], k)
			splat.set_pixel(x, z, c)

func build_splat() -> void:
	splat = Image.create(SPLAT_RES, SPLAT_RES, false, Image.FORMAT_RGBA8)
	var nz := FastNoiseLite.new()
	nz.seed = 77
	nz.frequency = 0.015
	nz.fractal_octaves = 3
	var wall_min: Vector2 = L.WALL_MIN
	var wall_max: Vector2 = L.WALL_MAX
	# базовая трава: за периметром гуще, внутри — пятнами
	for z in SPLAT_RES:
		for x in SPLAT_RES:
			var wx := (x + 0.5) / SPLAT_RES * 2.0 * HALF - HALF
			var wz := (z + 0.5) / SPLAT_RES * 2.0 * HALF - HALF
			var n := nz.get_noise_2d(wx, wz) * 0.5 + 0.5
			var inside := wx > wall_min.x and wx < wall_max.x and wz > wall_min.y and wz < wall_max.y
			var g := 0.0
			if inside:
				var edge := minf(minf(wx - wall_min.x, wall_max.x - wx), minf(wz - wall_min.y, wall_max.y - wz))
				g = clampf(n * 1.4 - 0.55 + (0.5 if edge < 8.0 else 0.0), 0.0, 1.0)
			else:
				g = clampf(n * 1.3 + 0.1, 0.0, 1.0)
			var wet := clampf(nz.get_noise_2d(wx * 2.3 + 500.0, wz * 2.3) * 1.6 - 0.65, 0.0, 1.0)
			splat.set_pixel(x, z, Color(0, g, 0, wet * 0.8))
	# площадки
	for p in L.PADS:
		var c: Vector2 = p[0]
		var s: Vector2 = p[1]
		_splat_rect(c.x, c.y, s.x, s.y, 2, 1.0)
	# дороги
	for r in L.ROADS:
		var ch := 0
		match int(r[3]):
			1: ch = -1
			2: ch = 2
		if ch >= 0:
			_splat_line(r[0], r[1], r[2], ch, 1.0)
		else:
			_splat_line(r[0], r[1], r[2], 1, 0.0)
			# грунтовка: убираем траву, колея и лужи
			_splat_line_clear_grass(r[0], r[1], r[2])
			var d: Vector2 = (r[1] - r[0]).normalized()
			var sd := Vector2(-d.y, d.x)
			for s in [-0.9, 0.9]:
				_splat_line(r[0] + sd * s, r[1] + sd * s, 0.6, 3, 0.45)
	# основания зданий
	for b in L.BUILDINGS:
		var bp: Vector2 = b.pos
		var bs: Vector2 = b.size
		if b.get("open", false):
			if b.kind == "kpp":
				_splat_rect(bp.x, bp.y, bs.x, bs.y, 2, 1.0)
			else:
				_splat_rect(bp.x, bp.y, bs.x, bs.y, 1, 0.0)
				_splat_rect_clear(bp.x, bp.y, bs.x, bs.y)
			continue
		_splat_rect(bp.x, bp.y, bs.x + 3.0, bs.y + 3.0, 2, 1.0)
	for rr in L.RUINS:
		var bp: Vector2 = rr.pos
		var bs: Vector2 = rr.size
		_splat_rect_clear(bp.x, bp.y, bs.x + 2.0, bs.y + 2.0)
	# воронки, лужи, болото
	for i in 26:
		var p := Vector2(rng.randf_range(-90, 90), rng.randf_range(-95, 75))
		_splat_circle(p.x, p.y, rng.randf_range(1.5, 4.0), 3, rng.randf_range(0.55, 0.85))
	for i in 12:
		_splat_circle(rng.randf_range(-80, -40), rng.randf_range(100, 140), rng.randf_range(3, 8), 3, 0.85)
	for a in L.ANOMALIES:
		if a.kind == "fire":
			_splat_circle(a.pos.x, a.pos.z, a.r * 1.6, 1, 0.0, false)
			_splat_rect_clear(a.pos.x, a.pos.z, a.r * 2.4, a.r * 2.4)

func _splat_line_clear_grass(a: Vector2, b: Vector2, w: float) -> void:
	var d := b - a
	var steps := int(d.length() / (2.0 * HALF / SPLAT_RES)) + 1
	var r := int(w * 0.5 / (2.0 * HALF) * SPLAT_RES) + 1
	for i in steps + 1:
		var p := a.lerp(b, float(i) / steps)
		for dz in range(-r, r + 1):
			for dx in range(-r, r + 1):
				var x := _px(p.x) + dx
				var z := _px(p.y) + dz
				if x < 0 or z < 0 or x >= SPLAT_RES or z >= SPLAT_RES:
					continue
				var c := splat.get_pixel(x, z)
				c.g = minf(c.g, 0.15)
				splat.set_pixel(x, z, c)

func _splat_rect_clear(cx: float, cz: float, w: float, d: float) -> void:
	for z in range(_px(cz - d * 0.5), _px(cz + d * 0.5) + 1):
		for x in range(_px(cx - w * 0.5), _px(cx + w * 0.5) + 1):
			var c := splat.get_pixel(x, z)
			c.g = minf(c.g, 0.1)
			splat.set_pixel(x, z, c)

func grass_at(x: float, z: float) -> float:
	return splat.get_pixel(_px(x), _px(z)).g

func paved_at(x: float, z: float) -> bool:
	var c := splat.get_pixel(_px(x), _px(z))
	return c.r > 0.4 or c.b > 0.4

# ======================================================================
#   ЗЕМЛЯ
# ======================================================================
func build_ground() -> void:
	var tex := ImageTexture.create_from_image(splat)
	var mat := Mats.ground(tex)
	var n := 6
	for iz in n:
		for ix in n:
			var mb := MeshBuilder.new()
			var x0 := -HALF + ix * CHUNK
			var z0 := -HALF + iz * CHUNK
			var c := Color(1, 1, 1, 0)
			var div := 5
			var s := CHUNK / div
			for a in div:
				for b in div:
					var p0 := Vector3(x0 + a * s, 0, z0 + b * s)
					mb.add_quad(p0, p0 + Vector3(s, 0, 0), p0 + Vector3(s, 0, s), p0 + Vector3(0, 0, s), c, Vector3.UP)
			var mi := MeshInstance3D.new()
			mi.name = "Ground_%d_%d" % [ix, iz]
			mi.mesh = mb.build(mat)
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			root.add_child(mi)
	# коллизия земли + границы карты
	var body := StaticBody3D.new()
	body.name = "GroundBody"
	body.collision_layer = 1 | 64
	body.collision_mask = 0
	root.add_child(body)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(2 * HALF + 20, 1.0, 2 * HALF + 20)
	cs.shape = bs
	cs.position = Vector3(0, -0.5, 0)
	body.add_child(cs)
	for e in [[Vector3(0, 2, -HALF - 0.5), Vector3(2 * HALF + 4, 6, 1)], [Vector3(0, 2, HALF + 0.5), Vector3(2 * HALF + 4, 6, 1)],
			[Vector3(-HALF - 0.5, 2, 0), Vector3(1, 6, 2 * HALF + 4)], [Vector3(HALF + 0.5, 2, 0), Vector3(1, 6, 2 * HALF + 4)]]:
		var c2 := CollisionShape3D.new()
		var b2 := BoxShape3D.new()
		b2.size = e[1]
		c2.shape = b2
		c2.position = e[0]
		body.add_child(c2)

# ======================================================================
#   ПЕРИМЕТР
# ======================================================================
func _gap_list(side: String) -> Array:
	var gaps: Array = []
	if side == "s":
		gaps.append([-L.GATE_HALF, L.GATE_HALF])
	for br in L.BREACHES:
		if br.side == side:
			gaps.append([float(br.at) - float(br.w) * 0.5, float(br.at) + float(br.w) * 0.5])
	gaps.sort_custom(func(a, b): return a[0] < b[0])
	return gaps

func build_perimeter() -> void:
	var mn: Vector2 = L.WALL_MIN
	var mx: Vector2 = L.WALL_MAX
	var sides := {
		"n": [Vector3(mn.x, 0, mn.y), Vector3(mx.x, 0, mn.y), true],
		"s": [Vector3(mn.x, 0, mx.y), Vector3(mx.x, 0, mx.y), true],
		"w": [Vector3(mn.x, 0, mn.y), Vector3(mn.x, 0, mx.y), false],
		"e": [Vector3(mx.x, 0, mn.y), Vector3(mx.x, 0, mx.y), false],
	}
	for side in sides:
		var a: Vector3 = sides[side][0]
		var b: Vector3 = sides[side][1]
		var along_x: bool = sides[side][2]
		var gaps := _gap_list(side)
		var start := a.x if along_x else a.z
		var end := b.x if along_x else b.z
		var cursor := start
		var pieces: Array = []
		for g in gaps:
			pieces.append([cursor, float(g[0])])
			cursor = float(g[1])
		pieces.append([cursor, end])
		for pc in pieces:
			var p0 := float(pc[0])
			var p1 := float(pc[1])
			var x := p0
			while x < p1 - 0.5:
				var x2 := minf(x + 12.0, p1)
				var pa := Vector3(x, 0, a.z) if along_x else Vector3(a.x, 0, x)
				var pb := Vector3(x2, 0, a.z) if along_x else Vector3(a.x, 0, x2)
				var mid := (pa + pb) * 0.5
				var damage := 0.35 if rng.randf() < 0.4 else 0.05
				Props.po2_fence(mb_at(mid), col, pa, pb, L.WALL_H, rng, damage)
				if rng.randf() < 0.75:
					Props.barbed_wire(mb_at(mid), pa, pb, L.WALL_H + 0.25)
				x = x2
		# проломы: обломки плит
		for g in gaps:
			if side == "s":
				continue
			var gc := (float(g[0]) + float(g[1])) * 0.5
			var pos := Vector3(gc, 0, a.z) if along_x else Vector3(a.x, 0, gc)
			var mb := mb_at(pos)
			for k in 2:
				var off := Vector3(rng.randf_range(-1.5, 1.5), 0.15, rng.randf_range(-1.5, 1.5))
				var bas := Basis(Vector3.UP, (0.0 if along_x else PI / 2) + rng.randf_range(-0.5, 0.5)) * Basis(Vector3.RIGHT, rng.randf_range(1.2, 1.5))
				mb.add_box(Transform3D(bas, pos + off + (Vector3(0, 0, 2.5) if along_x else Vector3(2.5, 0, 0)) * (1.0 if k == 0 else -1.0)), Vector3(3.8, 2.4, 0.16), Props.C_CONCRETE)
			Props.debris_small(mb, pos, 3.0, 25, rng)
	# угловые столбы
	for c in [Vector3(mn.x, 0, mn.y), Vector3(mx.x, 0, mn.y), Vector3(mn.x, 0, mx.y), Vector3(mx.x, 0, mx.y)]:
		mb_at(c).add_box(Transform3D(Basis(), c + Vector3(0, 1.5, 0)), Vector3(0.5, 3.0, 0.5), Props.C_CONCRETE_D)

# ======================================================================
#   ДОРОГИ: бордюры, разметка
# ======================================================================
func build_roads() -> void:
	for r in L.ROADS:
		if int(r[3]) != 0:
			continue
		var a: Vector2 = r[0]
		var b: Vector2 = r[1]
		var w: float = r[2]
		var d := (b - a).normalized()
		var sd := Vector2(-d.y, d.x)
		var l := (b - a).length()
		# бордюры только внутри периметра
		for s in [-1.0, 1.0]:
			var t := 0.0
			while t < l:
				var t2 := minf(t + 6.0, l)
				var p0: Vector2 = a + d * t + sd * (w * 0.5 + 0.15) * s
				var p1: Vector2 = a + d * t2 + sd * (w * 0.5 + 0.15) * s
				var mid3 := Vector3((p0.x + p1.x) * 0.5, 0, (p0.y + p1.y) * 0.5)
				var inside := absf(mid3.x) < 98 and mid3.z > -103 and mid3.z < 80
				if inside and rng.randf() > 0.15 and not _near_junction(mid3):
					mb_at(mid3).beam(Vector3(p0.x, 0.08, p0.y), Vector3(p1.x, 0.08, p1.y), 0.2, 0.16, Color(0.6, 0.6, 0.57, 0.0))
				t = t2

func _near_junction(p: Vector3) -> bool:
	for r in L.ROADS:
		for e in [r[0], r[1]]:
			var v: Vector2 = e
			if Vector2(p.x, p.z).distance_to(v) < 6.0:
				return true
	# перекрёстки с главной поперечной
	if absf(p.z - 18.0) < 5.0 and (absf(p.x) < 6.0 or absf(absf(p.x) - 38.0) < 5.0):
		return true
	if absf(p.z + 90.0) < 5.0 and absf(absf(p.x) - 38.0) < 5.0:
		return true
	return false

# ======================================================================
#   ОКРУЖЕНИЕ
# ======================================================================
func build_props() -> void:
	var mb: MeshBuilder
	# --- фонари вдоль дорог ---
	var lamp_spots := [Vector3(-5.5, 0, 30), Vector3(5.5, 0, 50), Vector3(-5.5, 0, 66), Vector3(-30, 0, 22.5), Vector3(-60, 0, 22.5),
		Vector3(30, 0, 13.5), Vector3(62, 0, 13.5), Vector3(-42, 0, -20), Vector3(42, 0, -30), Vector3(-42, 0, -70), Vector3(42, 0, -75),
		Vector3(-18, 0, -2), Vector3(18, 0, -2), Vector3(-18, 0, -27), Vector3(18, 0, -27)]
	for i in lamp_spots.size():
		var p: Vector3 = lamp_spots[i]
		var yaw := 0.0
		if absf(p.z - 22.5) < 0.1:
			yaw = PI
		elif absf(p.z - 13.5) < 0.1:
			yaw = 0.0
		elif p.x < 0:
			yaw = -PI / 2
		else:
			yaw = PI / 2
		var broken := i % 4 == 3
		var head := Props.lamp_post(mb_at(p), col, p, yaw, broken)
		if not broken:
			lamp_points.append(head)
	# --- флагшток на плацу, бочка с огнём ---
	Props.flag(mb_at(Vector3(0, 0, -24)), col, Vector3(0, 0, -24.5), 9.0)
	fire_points.append(Vector3(5.5, 0, -12.0))
	Props.barrel(mb_at(Vector3(5.5, 0, -12)), col, Vector3(5.5, 0, -12), Color(0.2, 0.17, 0.14, 0.3))
	for p in [Vector3(4.0, 0, -13.3), Vector3(7.2, 0, -11.0)]:
		Props.crate(mb_at(p), null, Transform3D(Basis(Vector3.UP, rng.randf()), p), Vector3(0.6, 0.45, 0.6))
	# --- техника ---
	Props.btr(mb_at(Vector3(-20, 0, 58)), col, Transform3D(Basis(Vector3.UP, 0.4), Vector3(-20, 0, 58)), true)
	Props.uaz(mb_at(Vector3(24, 0, -14)), col, Transform3D(Basis(Vector3.UP, 1.9), Vector3(24, 0, -14)), Color(), true)
	Props.truck(mb_at(Vector3(46, 0, -70)), col, Transform3D(Basis(Vector3.UP, 0.05), Vector3(46, 0, -70)), Color(), true)
	Props.uaz(mb_at(Vector3(-48, 0, 12)), col, Transform3D(Basis(Vector3.UP, -0.6), Vector3(-48, 0, 12)))
	Props.truck(mb_at(Vector3(13, 0, 108)), col, Transform3D(Basis(Vector3.UP, 0.25), Vector3(13, 0, 108)), Color(0.32, 0.36, 0.25, 0.2), false, true)
	Props.uaz(mb_at(Vector3(-11, 0, 129)), col, Transform3D(Basis(Vector3.UP, -0.4), Vector3(-11, 0, 129)), Color(0.3, 0.34, 0.24, 0.2))
	Props.btr(mb_at(Vector3(-24, 0, 96)), col, Transform3D(Basis(Vector3.UP, 1.2), Vector3(-24, 0, 96)), true)
	Props.truck(mb_at(Vector3(27, 0, 26)), col, Transform3D(Basis(Vector3.UP, 1.57), Vector3(27, 0, 26)), Color(), true)
	Props.truck(mb_at(Vector3(118, 0, -58)), col, Transform3D(Basis(Vector3.UP, 2.6), Vector3(118, 0, -58)), Color(0.22, 0.24, 0.3, 0.2), false, true)
	Props.uaz(mb_at(Vector3(-114, 0, -112)), col, Transform3D(Basis(Vector3.UP, 0.9), Vector3(-114, 0, -112)), Color(), true)
	# --- контейнеры, цистерны ---
	Props.shipping_container(mb_at(Vector3(48, 0, -86)), col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(48, 0, -84)), Color(0.32, 0.38, 0.45, 0.2))
	Props.shipping_container(mb_at(Vector3(56, 0, -86)), col, Transform3D(Basis(Vector3.UP, PI / 2 + 0.05), Vector3(56, 0, -83.5)), Color(0.5, 0.25, 0.16, 0.2))
	Props.shipping_container(mb_at(Vector3(80, 0, -20)), col, Transform3D(Basis(Vector3.UP, 0.0), Vector3(82, 0, -40)), Color(0.28, 0.35, 0.25, 0.2))
	Props.shipping_container(mb_at(Vector3(82, 0, 52)), col, Transform3D(Basis(Vector3.UP, 0.1), Vector3(82, 0, 50)), Color(0.45, 0.42, 0.3, 0.2))
	Props.fuel_tank(mb_at(Vector3(-34, 0, -72)), col, Transform3D(Basis(), Vector3(-34, 0, -72)), 7.0, 1.3)
	Props.fuel_tank(mb_at(Vector3(-38, 0, -82)), col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(-30, 0, -82)), 5.0, 1.0, Color(0.42, 0.25, 0.14, 0.3))
	# --- антенная мачта радиоцентра ---
	_mast(Vector3(29, 0, -76), 24.0)
	# --- котельная: дымовая труба ---
	var ch := Vector3(26.5, 0, 53)
	mb = mb_at(ch)
	mb.add_cyl(Transform3D(Basis(), ch), 1.5, 0.9, 22.0, 12, Color(0.55, 0.33, 0.25, 0.1))
	for y in [6.0, 12.0, 18.0]:
		mb.add_cyl(Transform3D(Basis(), ch + Vector3(0, y, 0)), 1.5 - y * 0.027 + 0.08, 1.5 - y * 0.027 + 0.08, 0.3, 12, Color(0.4, 0.4, 0.4, 0.3), false)
	col.append([Transform3D(Basis(), ch + Vector3(0, 3, 0)), Vector3(2.8, 6, 2.8)])
	# --- трубопровод теплотрассы на опорах ---
	_pipeline([Vector3(26, 0, 44), Vector3(26, 0, 30), Vector3(-46, 0, 30), Vector3(-46, 0, -20)], 3.2)
	_pipeline([Vector3(-90, 0, -96), Vector3(90, 0, -96)], 2.4)
	# --- противотанковые ежи, блоки, мешки у КПП снаружи ---
	for i in 9:
		var p := Vector3(-24 + i * 6.0 + rng.randf_range(-1, 1), 0, 92 + rng.randf_range(-2, 3))
		if absf(p.x) < 6.0:
			continue
		Props.tank_trap(mb_at(p), col, p, rng.randf() * TAU)
	for i in 4:
		var p := Vector3(-6.0 + i * 4.0, 0, 88)
		if i == 1 or i == 2:
			continue
		Props.concrete_block(mb_at(p), col, Transform3D(Basis(Vector3.UP, rng.randf_range(-0.2, 0.2)), p), Vector3(2.4, 0.9, 0.9))
	# --- позиции у проломов ---
	Props.sandbags(mb_at(Vector3(-96, 0, -30)), col, Vector3(-95, 0, -26.5), Vector3(-95, 0, -24), 3, rng)
	Props.sandbags(mb_at(Vector3(96, 0, 22)), col, Vector3(95, 0, 18.5), Vector3(95, 0, 20.5), 3, rng)
	Props.sandbags(mb_at(Vector3(40, 0, -101)), col, Vector3(36, 0, -100), Vector3(38, 0, -100), 3, rng)
	# --- разрушения: завалы, воронки, мусор (база разрушена на ~70%) ---
	var rubble_spots := [Vector3(-12, 0, 8), Vector3(14, 0, -60), Vector3(-44, 0, -52), Vector3(48, 0, 8), Vector3(-32, 0, 60),
		Vector3(70, 0, 60), Vector3(-86, 0, 40), Vector3(86, 0, -10), Vector3(10, 0, 38), Vector3(-50, 0, -88), Vector3(60, 0, -95),
		Vector3(-88, 0, -50), Vector3(30, 0, -40), Vector3(-20, 0, -40)]
	for p in rubble_spots:
		Props.rubble_pile(mb_at(p), col, p, rng.randf_range(1.2, 2.4), rng, rng.randf_range(0.6, 1.2))
	for i in 140:
		var p := Vector3(rng.randf_range(-95, 95), 0, rng.randf_range(-100, 78))
		if paved_at(p.x, p.z) and rng.randf() < 0.6:
			continue
		Props.debris_small(mb_at(p), p, rng.randf_range(0.8, 2.5), rng.randi_range(4, 10), rng)
	for i in 16:
		var p := Vector3(rng.randf_range(-85, 85), 0, rng.randf_range(-95, 70))
		Props.crater(mb_at(p), p, rng.randf_range(1.5, 2.8), rng)
	# --- ящики, бочки, поддоны, покрышки ---
	var clusters := [Vector3(46, 0, -20), Vector3(-46, 0, 30), Vector3(30, 0, -84), Vector3(-30, 0, -84), Vector3(52, 0, 30),
		Vector3(-52, 0, -10), Vector3(14, 0, 62), Vector3(-14, 0, -64), Vector3(76, 0, 20), Vector3(-76, 0, -16), Vector3(84, 0, -100),
		Vector3(-84, 0, 70), Vector3(18, 0, 6), Vector3(-30, 0, 30)]
	for c in clusters:
		var m2 := mb_at(c)
		for k in rng.randi_range(2, 5):
			var p: Vector3 = c + Vector3(rng.randf_range(-3, 3), 0, rng.randf_range(-3, 3))
			match rng.randi() % 5:
				0: Props.crate(m2, col, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p), Vector3(1.0, 0.8, 1.0))
				1: Props.barrel(m2, col, p, M.jitter(Color(0.3, 0.36, 0.25, 0.2) if rng.randf() < 0.5 else Color(0.45, 0.2, 0.12, 0.3), rng), rng.randf() < 0.3, rng.randf() * TAU)
				2: Props.pallet(m2, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p))
				3: Props.tire_stack(m2, col, p, rng.randi_range(1, 4), rng)
				4: Props.ammo_box(m2, col, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p))
	Props.cable_drum(mb_at(Vector3(40, 0, 36)), col, Vector3(40, 0, 36), 0.3)
	Props.cable_drum(mb_at(Vector3(-40, 0, -96)), col, Vector3(-36, 0, -99), 1.2)
	Props.plank_stack(mb_at(Vector3(-50, 0, 18)), col, Vector3(-52, 0, 26), 0.1, rng)
	Props.plank_stack(mb_at(Vector3(50, 0, -30)), col, Vector3(49, 0, -24), PI / 2, rng)
	# --- снаружи: железная дорога ---
	_railway()
	# --- лагерь бандитов ---
	_bandit_camp(Vector3(124, 0, -62))
	# --- логово псов ---
	for i in 10:
		var p := Vector3(-118 + rng.randf_range(-10, 10), 0, -120 + rng.randf_range(-8, 8))
		mb_at(p).add_box(Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p + Vector3(0, 0.03, 0)), Vector3(0.3, 0.05, 0.05), Color(0.85, 0.82, 0.72, 0.9))
	# --- сломанный бетонный забор в деревне ---
	for i in 6:
		var p := Vector3(-140 + i * 4.0, 0, -12.0)
		if rng.randf() < 0.7:
			mb_at(p).beam(p + Vector3(0, 0.6, 0), p + Vector3(3.6, 0.6 + rng.randf_range(-0.2, 0.2), 0), 0.08, 1.2, Color(0.38, 0.3, 0.22, 0.4))
	# --- указатели выходов ---
	for e in L.EXITS:
		signs.append({"pos": (e.pos as Vector3) + Vector3(-4 if e.id == "exit_south" else 0, 0, -4 if e.id != "exit_south" else -2), "text": "→ " + String(e.name)})

func _mast(p: Vector3, h: float) -> void:
	var mb := mb_at(p)
	var c := Color(0.55, 0.2, 0.15, 0.2)
	var c2 := Color(0.8, 0.8, 0.78, 0.2)
	var w0 := 1.2
	var segs := 8
	for i in segs:
		var y0 := h * i / segs
		var y1 := h * (i + 1) / segs
		var r0 := w0 * (1.0 - 0.6 * i / segs)
		var r1 := w0 * (1.0 - 0.6 * (i + 1) / segs)
		var cc := c if i % 2 == 0 else c2
		for k in 3:
			var a0 := TAU * k / 3.0
			var a1 := TAU * (k + 1) / 3.0
			var p0 := p + Vector3(cos(a0) * r0, y0, sin(a0) * r0)
			var p1 := p + Vector3(cos(a0) * r1, y1, sin(a0) * r1)
			var q0 := p + Vector3(cos(a1) * r0, y0, sin(a1) * r0)
			mb.beam(p0, p1, 0.08, 0.08, cc)
			mb.beam(p0, p + Vector3(cos(a1) * r1, y1, sin(a1) * r1), 0.04, 0.04, cc)
			mb.beam(p0, q0, 0.04, 0.04, cc)
	mb.add_box(Transform3D(Basis(), p + Vector3(0, h * 0.8, 0)), Vector3(1.2, 0.6, 0.1), Color(0.3, 0.3, 0.3, 0.2))
	mb.add_box(Transform3D(Basis(), p + Vector3(0, h + 0.2, 0)), Vector3(0.2, 0.2, 0.2), Color(0.9, 0.2, 0.15, 0.8))
	col.append([Transform3D(Basis(), p + Vector3(0, 2, 0)), Vector3(2.4, 4, 2.4)])

func _pipeline(pts: Array, h: float) -> void:
	for i in pts.size() - 1:
		var a: Vector3 = pts[i]
		var b: Vector3 = pts[i + 1]
		var l := (b - a).length()
		var n := int(l / 6.0)
		for k in n + 1:
			var p := a.lerp(b, float(k) / maxf(n, 1))
			var m := mb_at(p)
			m.add_box(Transform3D(Basis(), p + Vector3(0, h * 0.5, 0)), Vector3(0.3, h, 0.3), Props.C_CONCRETE_D, true)
			m.add_box(Transform3D(Basis(), p + Vector3(0, h, 0)), Vector3(1.4, 0.15, 1.4) if absf(a.x - b.x) < 0.1 else Vector3(1.4, 0.15, 1.4), Props.C_CONCRETE_D, true)
			col.append([Transform3D(Basis(), p + Vector3(0, 1.0, 0)), Vector3(0.4, 2.0, 0.4)])
		var seg := 0.0
		while seg < l:
			var s2 := minf(seg + 10.0, l)
			var p0 := a.lerp(b, seg / l) + Vector3(0, h + 0.4, 0)
			var p1 := a.lerp(b, s2 / l) + Vector3(0, h + 0.4, 0)
			var mid := (p0 + p1) * 0.5
			var side := (b - a).normalized().cross(Vector3.UP) * 0.35
			if rng.randf() > 0.12:
				mb_at(mid).cyl_between(p0 + side, p1 + side, 0.28, 0.28, 8, Color(0.5, 0.48, 0.42, 0.5) if rng.randf() < 0.6 else Props.C_RUST, false)
			mb_at(mid).cyl_between(p0 - side, p1 - side, 0.2, 0.2, 8, Props.C_RUST, false)
			seg = s2

func _railway() -> void:
	var z := -128.0
	var x := -HALF
	while x < HALF:
		var x2 := minf(x + 10.0, HALF)
		var p := Vector3((x + x2) * 0.5, 0, z)
		var m := mb_at(p)
		m.add_box(Transform3D(Basis(), Vector3((x + x2) * 0.5, 0.1, z)), Vector3(x2 - x, 0.2, 3.4), Color(0.36, 0.34, 0.3, 0.0), true)
		for s in [-0.76, 0.76]:
			m.add_box(Transform3D(Basis(), Vector3((x + x2) * 0.5, 0.32, z + s)), Vector3(x2 - x, 0.14, 0.08), Color(0.35, 0.22, 0.14, 0.3), true)
		var k := x
		while k < x2:
			m.add_box(Transform3D(Basis(), Vector3(k + 0.3, 0.22, z)), Vector3(0.25, 0.1, 2.6), Color(0.3, 0.24, 0.18, 0.4), true)
			k += 0.75
		x = x2
	# вагоны
	for i in 4:
		var wx := -58.0 + i * 13.5
		var p := Vector3(wx, 0, z)
		var m := mb_at(p)
		var c := M.jitter(Color(0.42, 0.24, 0.16, 0.3), rng, 0.1)
		if i == 2:
			m.add_cyl(Transform3D(Basis(Vector3.FORWARD, PI / 2), p + Vector3(6.0, 2.3, 0)), 1.4, 1.4, 12.0, 12, Color(0.2, 0.2, 0.2, 0.2))
		else:
			m.add_box(Transform3D(Basis(), p + Vector3(0, 2.5, 0)), Vector3(12.5, 3.0, 2.9), c, true)
			m.add_box(Transform3D(Basis(), p + Vector3(0, 4.05, 0)), Vector3(12.6, 0.12, 3.0), c.darkened(0.2), true)
			m.add_box(Transform3D(Basis(), p + Vector3(0, 2.4, 1.46)), Vector3(2.6, 2.6, 0.05), Color(0.08, 0.07, 0.06, 0.3), true)
		m.add_box(Transform3D(Basis(), p + Vector3(0, 0.9, 0)), Vector3(12.0, 0.5, 2.6), Color(0.15, 0.14, 0.13, 0.2), true)
		for s in [-4.5, 4.5]:
			for zz in [-0.76, 0.76]:
				m.add_cyl(Transform3D(Basis(Vector3.RIGHT, PI / 2), p + Vector3(s, 0.45, zz - 0.06)), 0.45, 0.45, 0.12, 10, Color(0.15, 0.13, 0.12, 0.3))
		col.append([Transform3D(Basis(), p + Vector3(0, 2.0, 0)), Vector3(12.5, 4.0, 3.0)])

func _bandit_camp(c: Vector3) -> void:
	var m := mb_at(c)
	# палатки
	for t in [[c + Vector3(-6, 0, -4), 0.3], [c + Vector3(-1, 0, 6), -0.4], [c + Vector3(6, 0, -6), 1.2]]:
		var p: Vector3 = t[0]
		var yaw: float = t[1]
		var b := Basis(Vector3.UP, yaw)
		var tc := M.jitter(Color(0.3, 0.32, 0.22, 0.5), rng, 0.1)
		var w := 1.6
		var l := 3.2
		var h := 1.7
		for s in [-1.0, 1.0]:
			m.add_quad(p + b * Vector3(s * w, 0, -l * 0.5), p + b * Vector3(s * w, 0, l * 0.5), p + b * Vector3(0, h, l * 0.5), p + b * Vector3(0, h, -l * 0.5), tc, b * Vector3(s, 0.9, 0).normalized())
			m.add_quad(p + b * Vector3(s * w, 0, -l * 0.5), p + b * Vector3(0, h, -l * 0.5), p + b * Vector3(0, h, l * 0.5), p + b * Vector3(s * w, 0, l * 0.5), tc.darkened(0.3), b * Vector3(-s, -0.9, 0).normalized())
		m.add_tri(p + b * Vector3(-w, 0, l * 0.5), p + b * Vector3(w, 0, l * 0.5), p + b * Vector3(0, h, l * 0.5), tc.darkened(0.1), b * Vector3(0, 0, 1))
		col.append([Transform3D(b, p + Vector3(0, 0.8, 0)), Vector3(w * 2, 1.6, l)])
	fire_points.append(c + Vector3(0, 0, 0))
	Props.barrel(m, col, c, Color(0.18, 0.15, 0.12, 0.3))
	Props.sandbags(m, col, c + Vector3(-12, 0, 8), c + Vector3(-12, 0, 2), 3, rng)
	Props.sandbags(m, col, c + Vector3(-10, 0, -10), c + Vector3(-14, 0, -6), 3, rng)
	for i in 4:
		Props.crate(m, col, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), c + Vector3(rng.randf_range(-4, 4), 0, rng.randf_range(2, 5))), Vector3(0.9, 0.7, 0.9))
	Props.chainlink(m, col, c + Vector3(-16, 0, -14), c + Vector3(-16, 0, 14))

# ======================================================================
#   РАСТИТЕЛЬНОСТЬ
# ======================================================================
func _blocked(p: Vector3, r: float) -> bool:
	if paved_at(p.x, p.z):
		return true
	for b in L.BUILDINGS:
		var bp: Vector2 = b.pos
		var bs: Vector2 = b.size
		if absf(p.x - bp.x) < bs.x * 0.5 + r + 1.5 and absf(p.z - bp.y) < bs.y * 0.5 + r + 1.5:
			return true
	for rr in L.RUINS:
		var bp: Vector2 = rr.pos
		var bs: Vector2 = rr.size
		if absf(p.x - bp.x) < bs.x * 0.5 + r + 1.0 and absf(p.z - bp.y) < bs.y * 0.5 + r + 1.0:
			return true
	if absf(p.z + 128.0) < 3.5 + r:
		return true
	for e in L.EXITS:
		if Vector2(p.x, p.z).distance_to(Vector2(e.pos.x, e.pos.z)) < 10.0:
			return true
	for c in L.CONTAINERS:
		if Vector2(p.x, p.z).distance_to(Vector2(c.pos.x, c.pos.z)) < 3.0 + r:
			return true
	for g in L.ENEMY_GROUPS:
		if g.kind == "bandit" and Vector2(p.x, p.z).distance_to(Vector2(g.pos.x, g.pos.z)) < 17.0:
			return true
	return false

func _inside_wall(p: Vector3, margin: float) -> bool:
	var mn: Vector2 = L.WALL_MIN
	var mx: Vector2 = L.WALL_MAX
	return p.x > mn.x - margin and p.x < mx.x + margin and p.z > mn.y - margin and p.z < mx.y + margin

func build_vegetation() -> void:
	# деревья: плотная полоса у границы карты + рощи за периметром + редкие берёзы внутри
	var placed := 0
	var attempts := 0
	while placed < 520 and attempts < 6000:
		attempts += 1
		var p := Vector3(rng.randf_range(-HALF + 2, HALF - 2), 0, rng.randf_range(-HALF + 2, HALF - 2))
		var edge := minf(HALF - absf(p.x), HALF - absf(p.z))
		var inside := _inside_wall(p, 4.0)
		var prob := 0.0
		if edge < 14.0:
			prob = 0.95
		elif not inside:
			prob = 0.25 + clampf(grass_at(p.x, p.z) - 0.5, 0, 0.5)
		else:
			prob = 0.0
			var mn: Vector2 = L.WALL_MIN
			var mx: Vector2 = L.WALL_MAX
			var we := minf(minf(p.x - mn.x, mx.x - p.x), minf(p.z - mn.y, mx.y - p.z))
			if we > 2.0 and we < 6.0:
				prob = 0.25
		if rng.randf() > prob:
			continue
		if _blocked(p, 1.5):
			continue
		var road_clear := true
		for r in L.ROADS:
			var a: Vector2 = r[0]
			var b: Vector2 = r[1]
			if Geometry2D.get_closest_point_to_segment(Vector2(p.x, p.z), a, b).distance_to(Vector2(p.x, p.z)) < float(r[2]) * 0.5 + 2.5:
				road_clear = false
				break
		if not road_clear:
			continue
		if absf(absf(p.x) - absf(L.WALL_MIN.x)) < 3.0 or absf(p.z - L.WALL_MIN.y) < 3.0 or absf(p.z - L.WALL_MAX.y) < 3.0:
			if _inside_wall(p, 3.5) and not _inside_wall(p, -3.5):
				continue
		var fm := fol_at(p)
		var h := rng.randf_range(7.0, 13.0)
		var roll := rng.randf()
		if inside or roll < 0.35:
			Props.tree_birch(fm, p, h * 0.85, rng)
		elif roll < 0.85:
			Props.tree_pine(fm, p, h, rng)
		else:
			Props.tree_dead(fm, p, h * 0.7, rng)
		tree_cols.append(p)
		col.append([Transform3D(Basis(), p + Vector3(0, 1.5, 0)), Vector3(0.5, 3.0, 0.5)])
		placed += 1
	# кусты
	for i in 420:
		var p := Vector3(rng.randf_range(-HALF + 3, HALF - 3), 0, rng.randf_range(-HALF + 3, HALF - 3))
		var g := grass_at(p.x, p.z)
		if g < 0.45 or _blocked(p, 1.0):
			continue
		Props.bush(fol_at(p), p, rng.randf_range(0.7, 1.4), rng)
	# точки травы (MultiMesh)
	for i in 26000:
		var p := Vector3(rng.randf_range(-HALF, HALF), 0, rng.randf_range(-HALF, HALF))
		if grass_at(p.x, p.z) < 0.5 + rng.randf() * 0.25:
			continue
		if paved_at(p.x, p.z):
			continue
		grass_points.append(p)

# ======================================================================
#   ФИНАЛИЗАЦИЯ: меши чанков, коллизии
# ======================================================================
func finalize(draw_distance: float) -> Dictionary:
	var mat := Mats.world(true)
	var fmat := Mats.foliage(true, 0.06)
	var stats := {"chunks": 0, "verts": 0, "fol_verts": 0, "boxes": col.size()}
	var node := Node3D.new()
	node.name = "StaticChunks"
	root.add_child(node)
	for k in chunks:
		var mb: MeshBuilder = chunks[k]
		if mb.is_empty():
			continue
		var mi := MeshInstance3D.new()
		mi.name = "Chunk_%d_%d" % [k.x, k.y]
		mi.mesh = mb.build(mat)
		mi.visibility_range_end = draw_distance
		mi.visibility_range_end_margin = 10.0
		mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_DISABLED
		node.add_child(mi)
		stats.chunks += 1
		stats.verts += mb.vertex_count()
	for k in fol_chunks:
		var mb: MeshBuilder = fol_chunks[k]
		if mb.is_empty():
			continue
		var mi := MeshInstance3D.new()
		mi.name = "Foliage_%d_%d" % [k.x, k.y]
		mi.mesh = mb.build(fmat)
		mi.visibility_range_end = draw_distance + 20.0
		node.add_child(mi)
		stats.fol_verts += mb.vertex_count()
	# трава: MultiMesh по чанкам (отсечение по видимости), плотность регулируется настройками
	var gmesh := Props.grass_tuft_mesh()
	var gchunks := {}
	for p in grass_points:
		var k := chunk_of(p)
		if not gchunks.has(k):
			gchunks[k] = []
		(gchunks[k] as Array).append(p)
	var grass_nodes: Array = []
	for k in gchunks:
		var pts: Array = gchunks[k]
		pts.shuffle()
		var grass := MultiMeshInstance3D.new()
		grass.name = "Grass_%d_%d" % [k.x, k.y]
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = gmesh
		mm.instance_count = pts.size()
		for i in pts.size():
			var sc := rng.randf_range(0.7, 1.4)
			mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc, sc)), pts[i]))
		grass.multimesh = mm
		grass.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		grass.visibility_range_end = 70.0
		node.add_child(grass)
		grass_nodes.append(grass)
	stats["grass"] = grass_points.size()
	stats["grass_nodes"] = grass_nodes
	# коллизии по чанкам
	var bodies := {}
	for c in col:
		var xf: Transform3D = c[0]
		var k := chunk_of(xf.origin)
		if not bodies.has(k):
			var b := StaticBody3D.new()
			b.name = "Col_%d_%d" % [k.x, k.y]
			b.collision_layer = 1
			b.collision_mask = 0
			node.add_child(b)
			bodies[k] = b
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = c[1]
		cs.shape = bs
		cs.transform = xf
		(bodies[k] as StaticBody3D).add_child(cs)
	return stats
