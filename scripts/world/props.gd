class_name Props
extends RefCounted
## Библиотека процедурных объектов окружения в едином стиле (low-poly, постсоветская промзона 90-х).
## Каждая функция дописывает геометрию в MeshBuilder и (опционально) коллизии в массив col: [Transform3D, Vector3].

const M = preload("res://scripts/core/mesh_builder.gd")

const C_CONCRETE := Color(0.58, 0.57, 0.53, 0.0)
const C_CONCRETE_D := Color(0.42, 0.41, 0.38, 0.0)
const C_RUST := Color(0.42, 0.24, 0.13, 0.3)
const C_METAL_GREEN := Color(0.24, 0.3, 0.2, 0.2)
const C_METAL_GRAY := Color(0.38, 0.39, 0.38, 0.2)
const C_METAL_BLUE := Color(0.22, 0.3, 0.38, 0.2)
const C_WOOD := Color(0.5, 0.38, 0.24, 0.4)
const C_WOOD_OLD := Color(0.4, 0.33, 0.25, 0.4)
const C_SAND := Color(0.55, 0.5, 0.36, 0.5)
const C_RUBBER := Color(0.1, 0.1, 0.1, 1.0)
const C_BURNT := Color(0.16, 0.13, 0.11, 0.3)
const C_BRICK := Color(0.55, 0.33, 0.25, 0.1)
const C_REBAR := Color(0.32, 0.2, 0.12, 0.3)

static func add_col(col: Variant, xf: Transform3D, size: Vector3) -> void:
	if col != null:
		(col as Array).append([xf, size])

static func xf_at(pos: Vector3, yaw: float = 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), pos)

# ---------------------------------------------------------------- ящики, бочки
static func crate(mb: MeshBuilder, col: Variant, xf: Transform3D, size: Vector3 = Vector3(1, 0.8, 1), c: Color = C_WOOD) -> void:
	var h := size.y
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, h * 0.5, 0)), size, c, true)
	var dark := c.darkened(0.25)
	for sx in [-1.0, 1.0]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx * size.x * 0.5, h * 0.5, 0)), Vector3(0.03, h + 0.02, size.z * 0.98), dark, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, h * 0.5, size.z * 0.5)), Vector3(size.x * 0.9, 0.08, 0.03), dark, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, h * 0.5, -size.z * 0.5)), Vector3(size.x * 0.9, 0.08, 0.03), dark, true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, h * 0.5, 0)), size)

static func ammo_box(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	var c := Color(0.27, 0.33, 0.2, 0.4)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.2, 0)), Vector3(0.9, 0.4, 0.45), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.41, 0)), Vector3(0.92, 0.04, 0.47), c.darkened(0.2), true)
	for sx in [-0.3, 0.3]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 0.25, 0.23)), Vector3(0.12, 0.06, 0.02), Color(0.15, 0.15, 0.15, 0.2), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.2, 0)), Vector3(0.9, 0.4, 0.45))

static func barrel(mb: MeshBuilder, col: Variant, pos: Vector3, c: Color, lying: bool = false, yaw: float = 0.0) -> void:
	var xf: Transform3D
	if lying:
		xf = Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, PI / 2), pos + Vector3(0, 0.3, 0)) * Transform3D(Basis(), Vector3(0, -0.45, 0))
	else:
		xf = Transform3D(Basis(Vector3.UP, yaw), pos)
	mb.add_cyl(xf, 0.3, 0.3, 0.9, 10, c, true, true, c.darkened(0.2))
	for y in [0.2, 0.7]:
		mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, y - 0.025, 0)), 0.315, 0.315, 0.05, 10, c.darkened(0.15), false)
	if lying:
		add_col(col, Transform3D(Basis(Vector3.UP, yaw), pos + Vector3(0, 0.3, 0)), Vector3(0.9, 0.6, 0.6))
	else:
		add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.45, 0)), Vector3(0.6, 0.9, 0.6))

static func sandbags(mb: MeshBuilder, col: Variant, a: Vector3, b: Vector3, rows: int = 3, rng: RandomNumberGenerator = null) -> void:
	## Стенка из мешков с песком вдоль отрезка a-b.
	var d := b - a
	d.y = 0
	var l := d.length()
	if l < 0.1:
		return
	var dir := d / l
	var yaw := atan2(-dir.x, -dir.z) + PI / 2
	var bag := Vector3(0.62, 0.22, 0.38)
	for r in rows:
		var off := 0.0 if r % 2 == 0 else 0.31
		var n := int((l - off) / 0.6)
		for i in n:
			var p := a + dir * (off + 0.3 + i * 0.6) + Vector3(0, 0.11 + r * 0.21, 0)
			var c := C_SAND
			if rng:
				c = M.jitter(c, rng, 0.1)
				p += Vector3(rng.randf_range(-0.03, 0.03), 0, rng.randf_range(-0.03, 0.03))
			mb.add_box(Transform3D(Basis(Vector3.UP, yaw + (rng.randf_range(-0.06, 0.06) if rng else 0.0)), p), bag, c, r == 0)
	var h := rows * 0.21 + 0.03
	add_col(col, Transform3D(Basis(Vector3.UP, yaw), (a + b) * 0.5 + Vector3(0, h * 0.5, 0)), Vector3(l, h, 0.42))

static func concrete_block(mb: MeshBuilder, col: Variant, xf: Transform3D, size: Vector3 = Vector3(2.4, 0.6, 0.6), c: Color = C_CONCRETE) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, size.y * 0.5, 0)), size, c, true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, size.y * 0.5, 0)), size)

static func jersey(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color = C_CONCRETE) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.2, 0)), Vector3(2.0, 0.4, 0.6), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.6, 0)), Vector3(2.0, 0.42, 0.24), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.6, 0)), Vector3(0.6, 0.12, 0.25), Color(0.75, 0.15, 0.1, 0.2), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.42, 0)), Vector3(2.0, 0.84, 0.6))

static func tank_trap(mb: MeshBuilder, col: Variant, pos: Vector3, yaw: float) -> void:
	var c := C_RUST
	var b := Basis(Vector3.UP, yaw)
	var axes := [Vector3(1, 0.9, 0).normalized(), Vector3(-1, 0.9, 0).normalized(), Vector3(0, 0.9, 1).normalized()]
	for ax in axes:
		var a: Vector3 = b * (ax as Vector3)
		var l := 0.85
		mb.beam(pos + Vector3(0, 0.55, 0) - a * l, pos + Vector3(0, 0.55, 0) + a * l, 0.12, 0.12, c)
	add_col(col, Transform3D(b, pos + Vector3(0, 0.55, 0)), Vector3(1.2, 1.1, 1.2))

static func tire(mb: MeshBuilder, xf: Transform3D) -> void:
	mb.add_cyl(xf, 0.42, 0.42, 0.28, 10, C_RUBBER, true, true, Color(0.06, 0.06, 0.06, 1.0))

static func tire_stack(mb: MeshBuilder, col: Variant, pos: Vector3, n: int, rng: RandomNumberGenerator) -> void:
	for i in n:
		tire(mb, Transform3D(Basis(Vector3.UP, rng.randf() * TAU), pos + Vector3(rng.randf_range(-0.06, 0.06), i * 0.28, rng.randf_range(-0.06, 0.06))))
	add_col(col, Transform3D(Basis(), pos + Vector3(0, n * 0.14, 0)), Vector3(0.84, n * 0.28, 0.84))

static func pallet(mb: MeshBuilder, xf: Transform3D, c: Color = C_WOOD_OLD) -> void:
	for i in 5:
		mb.add_box(xf * Transform3D(Basis(), Vector3(-0.48 + i * 0.24, 0.13, 0)), Vector3(0.14, 0.025, 1.2), c, true)
	for z in [-0.5, 0.0, 0.5]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.06, z)), Vector3(1.0, 0.1, 0.1), c.darkened(0.15), true)

static func cable_drum(mb: MeshBuilder, col: Variant, pos: Vector3, yaw: float) -> void:
	var xf := Transform3D(Basis(Vector3.UP, yaw) * Basis(Vector3.FORWARD, PI / 2), pos + Vector3(0, 0.75, 0)) * Transform3D(Basis(), Vector3(0, -0.5, 0))
	mb.add_cyl(xf, 0.75, 0.75, 0.08, 12, C_WOOD)
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, 0.92, 0)), 0.75, 0.75, 0.08, 12, C_WOOD)
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, 0.08, 0)), 0.45, 0.45, 0.84, 10, Color(0.15, 0.15, 0.15, 1.0), false)
	add_col(col, Transform3D(Basis(Vector3.UP, yaw), pos + Vector3(0, 0.75, 0)), Vector3(1.0, 1.5, 1.5))

static func pipe(mb: MeshBuilder, col: Variant, a: Vector3, b: Vector3, r: float, c: Color = C_RUST) -> void:
	mb.cyl_between(a, b, r, r, 10, c)
	var d := b - a
	var l := d.length()
	if col != null and l > 0.1:
		var z := d / l
		var x := Vector3.UP.cross(z).normalized() if absf(z.y) < 0.95 else Vector3.RIGHT
		var y := z.cross(x)
		add_col(col, Transform3D(Basis(x, y, z), (a + b) * 0.5), Vector3(r * 2, r * 2, l))

static func shipping_container(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color, open_door: bool = false) -> void:
	var L := 6.0
	var W := 2.44
	var H := 2.6
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, H * 0.5, 0)), Vector3(W, H, L), c, true)
	var rib := c.darkened(0.18)
	var n := 14
	for i in n:
		var z := -L * 0.5 + 0.25 + i * (L - 0.5) / (n - 1)
		for sx in [-1.0, 1.0]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx * (W * 0.5 + 0.02), H * 0.5, z)), Vector3(0.05, H - 0.2, 0.12), rib, true)
	for y in [0.06, H - 0.06]:
		for sx in [-1.0, 1.0]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx * (W * 0.5 + 0.03), y, 0)), Vector3(0.08, 0.14, L + 0.04), rib.darkened(0.2), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, H * 0.5, L * 0.5 + 0.02)), Vector3(W - 0.1, H - 0.2, 0.04), rib, true)
	for sx in [-0.4, 0.4]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx, H * 0.5, L * 0.5 + 0.06)), Vector3(0.05, H - 0.4, 0.05), C_METAL_GRAY, true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, H * 0.5, 0)), Vector3(W, H, L))

static func fuel_tank(mb: MeshBuilder, col: Variant, xf: Transform3D, length: float = 6.0, r: float = 1.2, c: Color = Color(0.5, 0.5, 0.46, 0.2)) -> void:
	var t := xf * Transform3D(Basis(Vector3.RIGHT, PI / 2), Vector3(0, r + 0.5, -length * 0.5))
	mb.add_cyl(t, r, r, length, 14, c, true, true, c.darkened(0.1))
	for z in [-length * 0.3, length * 0.3]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.45, z)), Vector3(r * 1.6, 0.9, 0.4), C_CONCRETE_D, true)
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, r * 2 + 0.45, 0)), 0.25, 0.25, 0.3, 8, c.darkened(0.2))
	mb.beam(xf * Vector3(r * 0.7, 0.0, length * 0.5 - 0.3), xf * Vector3(r * 0.7, r * 2 + 0.5, length * 0.5 - 0.3), 0.06, 0.06, C_RUST)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, r + 0.5, 0)), Vector3(r * 2, r * 2 + 1.0, length))

# ---------------------------------------------------------------- техника
static func uaz(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color = Color(0.28, 0.33, 0.22, 0.2), burnt: bool = false) -> void:
	if burnt:
		c = C_BURNT
	var glass := Color(0.12, 0.14, 0.15, 0.7) if not burnt else Color(0.05, 0.05, 0.05, 0.3)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.75, 0.2)), Vector3(1.78, 0.6, 3.2), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.62, -1.75)), Vector3(1.7, 0.42, 0.9), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.4, 0.55)), Vector3(1.72, 0.75, 2.3), c.darkened(0.08) if not burnt else c, true)
	mb.add_box(xf * Transform3D(Basis(Vector3.RIGHT, -0.25), Vector3(0, 1.33, -0.68)), Vector3(1.6, 0.55, 0.05), glass, true)
	for sx in [-1.0, 1.0]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx * 0.87, 1.42, 0.35)), Vector3(0.03, 0.4, 1.7), glass, true)
		for z in [-1.35, 1.25]:
			tire(mb, xf * Transform3D(Basis(Vector3.FORWARD, PI / 2), Vector3(sx * 0.95 - sx * 0.14, 0.4, z)) * Transform3D(Basis(), Vector3(0, -0.14, 0)))
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.6, -2.22)), Vector3(1.4, 0.3, 0.1), C_RUBBER, true)
	for sx in [-0.6, 0.6]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 0.7, -2.21)), Vector3(0.18, 0.18, 0.05), Color(0.7, 0.7, 0.6, 0.7), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.9, 0)), Vector3(1.85, 1.8, 4.5))

static func truck(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color = Color(0.3, 0.36, 0.24, 0.2), burnt: bool = false, tarp: bool = true) -> void:
	if burnt:
		c = C_BURNT
	var glass := Color(0.1, 0.12, 0.13, 0.7) if not burnt else Color(0.04, 0.04, 0.04, 0.3)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.9, 0.3)), Vector3(0.9, 0.3, 7.0), Color(0.12, 0.12, 0.12, 0.2), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.55, -2.55)), Vector3(2.3, 1.5, 1.6), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.2, -3.55)), Vector3(2.0, 0.8, 0.9), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.85, -3.32)), Vector3(2.0, 0.6, 0.05), glass, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.4, 1.2)), Vector3(2.4, 0.5, 4.6), c.darkened(0.1), true)
	if tarp and not burnt:
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, 2.4, 1.2)), Vector3(2.45, 1.6, 4.6), Color(0.33, 0.35, 0.24, 0.5), true)
	elif burnt:
		for z in [-0.6, 0.6, 1.8, 3.0]:
			mb.beam(xf * Vector3(-1.15, 1.6, z), xf * Vector3(1.15, 1.6, z), 0.05, 0.05, C_RUST)
	for sx in [-1.0, 1.0]:
		for z in [-2.9, 1.0, 2.4]:
			tire(mb, xf * Transform3D(Basis(Vector3.FORWARD, PI / 2), Vector3(sx * 1.05 - sx * 0.14, 0.52, z)) * Transform3D(Basis(Vector3.UP, 0), Vector3(0, -0.14, 0)))
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 1.4, 0.0)), Vector3(2.45, 2.8, 8.2))

static func btr(mb: MeshBuilder, col: Variant, xf: Transform3D, burnt: bool = true) -> void:
	var c := C_BURNT if burnt else Color(0.3, 0.34, 0.24, 0.2)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.3, 0)), Vector3(2.8, 1.2, 7.4), c, true)
	mb.add_box(xf * Transform3D(Basis(Vector3.RIGHT, 0.6), Vector3(0, 1.25, -3.75)), Vector3(2.7, 1.0, 0.8), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 2.05, 0.0)), Vector3(2.2, 0.35, 5.0), c.darkened(0.05), true)
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, 2.2, -0.7)), 0.6, 0.5, 0.45, 8, c)
	mb.cyl_between(xf * Vector3(0, 2.45, -1.0), xf * Vector3(0.2, 2.35, -2.9), 0.06, 0.05, 6, Color(0.1, 0.1, 0.1, 0.2))
	for sx in [-1.0, 1.0]:
		for z in [-2.6, -1.2, 1.0, 2.4]:
			tire(mb, xf * Transform3D(Basis(Vector3.FORWARD, PI / 2), Vector3(sx * 1.38 - sx * 0.14, 0.55, z)) * Transform3D(Basis(), Vector3(0, -0.14, 0)))
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 1.2, 0)), Vector3(2.9, 2.4, 8.0))

# ---------------------------------------------------------------- инфраструктура
static func lamp_post(mb: MeshBuilder, col: Variant, pos: Vector3, yaw: float, broken: bool = false) -> Vector3:
	## Возвращает позицию плафона.
	var b := Basis(Vector3.UP, yaw)
	mb.add_cyl(Transform3D(b, pos), 0.12, 0.08, 7.0 if not broken else 4.2, 6, C_CONCRETE_D)
	var head := pos + Vector3(0, 7.0, 0) + b * Vector3(0, 0, -1.2)
	if not broken:
		mb.beam(pos + Vector3(0, 6.9, 0), head + Vector3(0, 0.05, 0), 0.07, 0.07, C_METAL_GRAY)
		mb.add_box(Transform3D(b, head), Vector3(0.3, 0.14, 0.55), C_METAL_GRAY, false)
		mb.add_box(Transform3D(b, head + Vector3(0, -0.08, 0)), Vector3(0.24, 0.03, 0.45), Color(1.0, 0.9, 0.7, 0.8), false)
	add_col(col, Transform3D(b, pos + Vector3(0, 3.5, 0)), Vector3(0.25, 7.0, 0.25))
	return head + Vector3(0, -0.2, 0)

static func po2_fence(mb: MeshBuilder, col: Variant, a: Vector3, b: Vector3, h: float, rng: RandomNumberGenerator, damage: float = 0.0) -> void:
	## Бетонный забор из плит ПО-2 с характерным ромбовидным рельефом.
	var d := b - a
	d.y = 0
	var l := d.length()
	if l < 0.2:
		return
	var dir := d / l
	var yaw := atan2(dir.x, dir.z) + PI / 2
	var n := int(ceil(l / 4.0))
	var seg := l / n
	var bas := Basis(Vector3.UP, yaw)
	for i in n:
		var c := (a + dir * (seg * (i + 0.5)))
		var tilt := 0.0
		var hh := h
		if damage > 0.0 and rng.randf() < damage:
			tilt = rng.randf_range(-0.18, 0.18)
			hh = h * rng.randf_range(0.75, 1.0)
		var pb := bas * Basis(Vector3.RIGHT, tilt)
		var col_c := M.jitter(C_CONCRETE, rng, 0.07)
		mb.add_box(Transform3D(pb, c + Vector3(0, hh * 0.5, 0)), Vector3(seg - 0.05, hh, 0.16), col_c, true)
		# ромбы
		var rows := 3
		for r in rows:
			for k in 4:
				var off := Vector3(-seg * 0.5 + seg * (k + 0.5) / 4.0, hh * (r + 0.5) / rows, 0)
				for side in [-1.0, 1.0]:
					var p := c + pb * (off + Vector3(0, 0, side * 0.085))
					mb.add_box(Transform3D(pb * Basis(Vector3.FORWARD, PI / 4), p), Vector3(0.32, 0.32, 0.02), col_c.darkened(0.08), false)
		mb.add_box(Transform3D(bas, a + dir * (seg * i) + Vector3(0, h * 0.5 + 0.1, 0)), Vector3(0.24, h + 0.2, 0.24), C_CONCRETE_D, true)
	mb.add_box(Transform3D(bas, b + Vector3(0, h * 0.5 + 0.1, 0)), Vector3(0.24, h + 0.2, 0.24), C_CONCRETE_D, true)
	add_col(col, Transform3D(bas, (a + b) * 0.5 + Vector3(0, h * 0.5, 0)), Vector3(l, h, 0.3))

static func barbed_wire(mb: MeshBuilder, a: Vector3, b: Vector3, y: float) -> void:
	var d := b - a
	var l := d.length()
	if l < 0.2:
		return
	var n := int(l / 0.35)
	var dir := d / l
	var side := Vector3.UP.cross(dir).normalized()
	var prev := a + Vector3(0, y, 0)
	for i in range(1, n + 1):
		var t := float(i) / n
		var ang := t * l * 9.0
		var p := a + dir * (t * l) + Vector3(0, y + sin(ang) * 0.18, 0) + side * cos(ang) * 0.18
		mb.beam(prev, p, 0.02, 0.02, Color(0.3, 0.27, 0.22, 0.3))
		prev = p

static func chainlink(mb: MeshBuilder, col: Variant, a: Vector3, b: Vector3, h: float = 2.2) -> void:
	var d := b - a
	d.y = 0
	var l := d.length()
	var dir := d / l
	var n := int(ceil(l / 3.0))
	var c := Color(0.35, 0.36, 0.34, 0.3)
	for i in n + 1:
		var p := a + dir * (l * i / n)
		mb.add_cyl(Transform3D(Basis(), p), 0.05, 0.05, h + 0.2, 6, C_METAL_GRAY, true)
	for y in [0.1, h * 0.5, h]:
		mb.beam(a + Vector3(0, y, 0), b + Vector3(0, y, 0), 0.03, 0.03, c)
	var k := int(l / 0.5)
	for i in k:
		var p0 := a + dir * (l * i / k)
		var p1 := a + dir * (l * (i + 1) / k)
		mb.beam(p0 + Vector3(0, 0.1, 0), p1 + Vector3(0, h, 0), 0.012, 0.012, c)
		mb.beam(p0 + Vector3(0, h, 0), p1 + Vector3(0, 0.1, 0), 0.012, 0.012, c)
	var yaw := atan2(dir.x, dir.z) + PI / 2
	add_col(col, Transform3D(Basis(Vector3.UP, yaw), (a + b) * 0.5 + Vector3(0, h * 0.5, 0)), Vector3(l, h, 0.15))

# ---------------------------------------------------------------- завалы и мусор
static func rubble_pile(mb: MeshBuilder, col: Variant, center: Vector3, radius: float, rng: RandomNumberGenerator, height: float = 1.0, with_col: bool = true, c0: Color = C_CONCRETE) -> void:
	var n := int(6 + radius * 7)
	for i in n:
		var a := rng.randf() * TAU
		var r := sqrt(rng.randf()) * radius
		var p := center + Vector3(cos(a) * r, 0, sin(a) * r)
		var k := 1.0 - r / radius
		var s := Vector3(rng.randf_range(0.3, 1.1), rng.randf_range(0.15, 0.45), rng.randf_range(0.3, 1.0)) * (0.5 + k * 0.7)
		p.y = k * height * 0.6 + s.y * 0.3
		var bas := Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, rng.randf_range(-0.5, 0.5)) * Basis(Vector3.FORWARD, rng.randf_range(-0.4, 0.4))
		var cc := c0
		var roll := rng.randf()
		if roll < 0.25:
			cc = C_BRICK
		elif roll < 0.35:
			cc = C_CONCRETE_D
		mb.add_box(Transform3D(bas, p), s, M.jitter(cc, rng, 0.1))
	for i in int(radius * 2):
		var a := rng.randf() * TAU
		var p := center + Vector3(cos(a), 0, sin(a)) * rng.randf() * radius * 0.7
		mb.beam(p + Vector3(0, 0.1, 0), p + Vector3(rng.randf_range(-0.8, 0.8), rng.randf_range(0.5, 1.3) * height, rng.randf_range(-0.8, 0.8)), 0.03, 0.03, C_REBAR)
	if with_col:
		add_col(col, Transform3D(Basis(), center + Vector3(0, height * 0.4, 0)), Vector3(radius * 1.5, height * 0.8, radius * 1.5))

static func debris_small(mb: MeshBuilder, center: Vector3, radius: float, n: int, rng: RandomNumberGenerator) -> void:
	for i in n:
		var a := rng.randf() * TAU
		var p := center + Vector3(cos(a), 0, sin(a)) * sqrt(rng.randf()) * radius
		var s := Vector3(rng.randf_range(0.08, 0.35), rng.randf_range(0.04, 0.15), rng.randf_range(0.08, 0.35))
		var roll := rng.randf()
		var c := C_CONCRETE if roll < 0.5 else (C_BRICK if roll < 0.75 else (C_RUST if roll < 0.9 else C_WOOD_OLD))
		mb.add_box(Transform3D(Basis(Vector3.UP, rng.randf() * TAU), p + Vector3(0, s.y * 0.4, 0)), s, M.jitter(c, rng, 0.12), true)

static func scrap_heap(mb: MeshBuilder, col: Variant, center: Vector3, rng: RandomNumberGenerator) -> void:
	## Куча металлолома (видимая точка разборки).
	for i in 9:
		var p := center + Vector3(rng.randf_range(-0.7, 0.7), 0, rng.randf_range(-0.7, 0.7))
		var s := Vector3(rng.randf_range(0.4, 1.1), rng.randf_range(0.03, 0.3), rng.randf_range(0.3, 0.8))
		p.y = s.y * 0.5 + rng.randf() * 0.25
		mb.add_box(Transform3D(Basis(Vector3.UP, rng.randf() * TAU) * Basis(Vector3.RIGHT, rng.randf_range(-0.6, 0.6)), p), s, M.jitter(C_RUST if i % 3 else C_METAL_GRAY, rng, 0.15))
	for i in 3:
		var p := center + Vector3(rng.randf_range(-0.6, 0.6), 0.1, rng.randf_range(-0.6, 0.6))
		mb.cyl_between(p, p + Vector3(rng.randf_range(-1, 1), rng.randf_range(0.1, 0.5), rng.randf_range(-1, 1)), 0.05, 0.05, 6, C_RUST)
	add_col(col, Transform3D(Basis(), center + Vector3(0, 0.3, 0)), Vector3(1.4, 0.6, 1.4))

static func plank_stack(mb: MeshBuilder, col: Variant, center: Vector3, yaw: float, rng: RandomNumberGenerator) -> void:
	for i in 6:
		var p := center + Vector3(0, 0.06 + (i / 3) * 0.11, -0.3 + (i % 3) * 0.3)
		mb.add_box(Transform3D(Basis(Vector3.UP, yaw + rng.randf_range(-0.05, 0.05)), p), Vector3(2.4, 0.1, 0.25), M.jitter(C_WOOD, rng, 0.1), true)
	add_col(col, Transform3D(Basis(Vector3.UP, yaw), center + Vector3(0, 0.15, 0)), Vector3(2.4, 0.3, 0.9))

static func crater(mb: MeshBuilder, center: Vector3, radius: float, rng: RandomNumberGenerator) -> void:
	var n := 10
	for i in n:
		var a := TAU * i / n
		var p := center + Vector3(cos(a), 0, sin(a)) * radius
		mb.add_box(Transform3D(Basis(Vector3.UP, a), p + Vector3(0, 0.06, 0)), Vector3(0.6, 0.18, radius * 0.7), M.jitter(Color(0.3, 0.26, 0.2, 0.0), rng, 0.1), true)

# ---------------------------------------------------------------- интерьер
static func bunk_bed(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	var m := C_METAL_BLUE
	for sx in [-0.42, 0.42]:
		for sz in [-0.95, 0.95]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 0.85, sz)), Vector3(0.05, 1.7, 0.05), m, true)
	for y in [0.4, 1.3]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, y, 0)), Vector3(0.88, 0.06, 1.95), m, true)
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, y + 0.08, 0)), Vector3(0.8, 0.1, 1.85), Color(0.35, 0.37, 0.3, 0.5), true)
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, y + 0.17, -0.75)), Vector3(0.5, 0.08, 0.3), Color(0.8, 0.8, 0.75, 0.5), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.85, 0)), Vector3(0.9, 1.7, 2.0))

static func locker(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color = Color(0.3, 0.36, 0.3, 0.2)) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.95, 0)), Vector3(0.6, 1.9, 0.5), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.95, -0.26)), Vector3(0.02, 1.8, 0.02), c.darkened(0.3), true)
	for sx in [-0.15, 0.15]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 1.6, -0.255)), Vector3(0.18, 0.06, 0.02), c.darkened(0.3), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.95, 0)), Vector3(0.6, 1.9, 0.5))

static func table(mb: MeshBuilder, col: Variant, xf: Transform3D, size: Vector2 = Vector2(1.4, 0.8), c: Color = C_WOOD) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.76, 0)), Vector3(size.x, 0.05, size.y), c, true)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx * (size.x * 0.5 - 0.05), 0.37, sz * (size.y * 0.5 - 0.05))), Vector3(0.05, 0.74, 0.05), c.darkened(0.2), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.4, 0)), Vector3(size.x, 0.8, size.y))

static func chair(mb: MeshBuilder, xf: Transform3D, c: Color = C_WOOD) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.45, 0)), Vector3(0.42, 0.04, 0.42), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.7, 0.2)), Vector3(0.42, 0.5, 0.04), c, true)
	for sx in [-0.18, 0.18]:
		for sz in [-0.18, 0.18]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 0.22, sz)), Vector3(0.04, 0.45, 0.04), c.darkened(0.2), true)

static func shelf_rack(mb: MeshBuilder, col: Variant, xf: Transform3D, length: float, rng: RandomNumberGenerator, fill: float = 0.6) -> void:
	var m := Color(0.3, 0.32, 0.36, 0.2)
	var n := int(length / 1.2) + 1
	for i in n:
		var x := -length * 0.5 + length * i / (n - 1)
		for sz in [-0.35, 0.35]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(x, 1.2, sz)), Vector3(0.06, 2.4, 0.06), m, true)
	for y in [0.15, 0.9, 1.65, 2.35]:
		mb.add_box(xf * Transform3D(Basis(), Vector3(0, y, 0)), Vector3(length, 0.04, 0.75), m.lightened(0.05), true)
		var x := -length * 0.5 + 0.3
		while x < length * 0.5 - 0.3:
			if rng.randf() < fill:
				var s := Vector3(rng.randf_range(0.35, 0.7), rng.randf_range(0.25, 0.55), rng.randf_range(0.4, 0.6))
				var cc: Color = [C_WOOD, Color(0.55, 0.47, 0.32, 0.5), Color(0.27, 0.33, 0.2, 0.4), C_METAL_GRAY][rng.randi() % 4]
				mb.add_box(xf * Transform3D(Basis(), Vector3(x, y + 0.02 + s.y * 0.5, 0)), s, M.jitter(cc, rng, 0.1), true)
				x += s.x + 0.08
			else:
				x += 0.5
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 1.2, 0)), Vector3(length, 2.4, 0.8))

static func weapon_rack(mb: MeshBuilder, col: Variant, xf: Transform3D, length: float, guns: int) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.2, 0)), Vector3(length, 0.4, 0.5), C_WOOD.darkened(0.2), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.3, 0.2)), Vector3(length, 0.1, 0.12), C_WOOD.darkened(0.2), true)
	for i in guns:
		var x := -length * 0.5 + 0.25 + i * (length - 0.5) / maxf(1, guns - 1)
		mb.add_box(xf * Transform3D(Basis(Vector3.RIGHT, 0.12), Vector3(x, 0.85, 0.12)), Vector3(0.05, 0.95, 0.07), Color(0.15, 0.15, 0.16, 0.2), true)
		mb.add_box(xf * Transform3D(Basis(Vector3.RIGHT, 0.12), Vector3(x, 0.6, 0.05)), Vector3(0.05, 0.25, 0.1), Color(0.36, 0.17, 0.12, 0.4), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.7, 0)), Vector3(length, 1.4, 0.5))

static func workbench(mb: MeshBuilder, col: Variant, xf: Transform3D, rng: RandomNumberGenerator) -> void:
	table(mb, col, xf, Vector2(2.2, 0.9), Color(0.35, 0.3, 0.25, 0.4))
	mb.add_box(xf * Transform3D(Basis(), Vector3(-0.7, 0.88, 0)), Vector3(0.3, 0.2, 0.2), C_METAL_BLUE, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.4, 0.43)), Vector3(2.2, 1.2, 0.04), Color(0.3, 0.3, 0.28, 0.2), true)
	for i in 6:
		mb.add_box(xf * Transform3D(Basis(), Vector3(-0.9 + i * 0.35, 1.5 + rng.randf_range(-0.2, 0.2), 0.4)), Vector3(0.04, 0.3, 0.03), C_RUST, true)

static func generator_unit(mb: MeshBuilder, col: Variant, xf: Transform3D, ruined: bool) -> void:
	var c := Color(0.3, 0.4, 0.3, 0.2) if not ruined else Color(0.25, 0.24, 0.2, 0.3)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.15, 0)), Vector3(3.6, 0.3, 1.5), C_CONCRETE_D, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(-0.5, 0.95, 0)), Vector3(2.0, 1.3, 1.2), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(1.05, 0.9, 0)), Vector3(1.0, 1.2, 1.1), c.darkened(0.15), true)
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(-1.1, 1.6, 0.3)), 0.12, 0.12, 1.6, 8, C_RUST)
	mb.add_box(xf * Transform3D(Basis(), Vector3(1.05, 1.0, -0.56)), Vector3(0.5, 0.4, 0.02), Color(0.9, 0.85, 0.5, 0.8), true)
	for i in 4:
		mb.add_box(xf * Transform3D(Basis(), Vector3(-1.3 + i * 0.4, 1.62, 0)), Vector3(0.08, 0.06, 1.0), c.darkened(0.25), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.8, 0)), Vector3(3.6, 1.6, 1.5))

static func radio_console(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	table(mb, col, xf, Vector2(2.4, 0.8), C_METAL_GRAY)
	var c := Color(0.32, 0.36, 0.3, 0.2)
	mb.add_box(xf * Transform3D(Basis(), Vector3(-0.6, 1.05, 0.1)), Vector3(0.9, 0.55, 0.5), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0.55, 1.0, 0.1)), Vector3(0.8, 0.45, 0.5), c.darkened(0.1), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(-0.6, 1.1, -0.16)), Vector3(0.5, 0.2, 0.02), Color(0.3, 0.9, 0.5, 0.8), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0.55, 1.05, -0.16)), Vector3(0.3, 0.12, 0.02), Color(1.0, 0.7, 0.2, 0.8), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.55, 0.3)), Vector3(2.2, 0.5, 0.25), c.darkened(0.2), true)

static func med_bed(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	var m := Color(0.75, 0.76, 0.74, 0.2)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.55, 0)), Vector3(0.9, 0.12, 2.0), m, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.66, 0)), Vector3(0.82, 0.1, 1.9), Color(0.85, 0.87, 0.85, 0.5), true)
	for sx in [-0.4, 0.4]:
		for sz in [-0.9, 0.9]:
			mb.add_box(xf * Transform3D(Basis(), Vector3(sx, 0.27, sz)), Vector3(0.04, 0.55, 0.04), m.darkened(0.3), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.9, -0.98)), Vector3(0.9, 0.6, 0.04), m, true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.45, 0)), Vector3(0.9, 0.9, 2.0))

static func cabinet(mb: MeshBuilder, col: Variant, xf: Transform3D, c: Color = Color(0.7, 0.7, 0.68, 0.2)) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.9, 0)), Vector3(1.0, 1.8, 0.45), c, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.35, -0.23)), Vector3(0.9, 0.75, 0.02), Color(0.4, 0.5, 0.55, 0.7), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.9, 0)), Vector3(1.0, 1.8, 0.45))

static func map_table(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	table(mb, col, xf, Vector2(2.4, 1.4), C_WOOD.darkened(0.1))
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.79, 0)), Vector3(2.0, 0.01, 1.1), Color(0.75, 0.72, 0.55, 0.5), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0.3, 0.8, 0.1)), Vector3(0.5, 0.01, 0.02), Color(0.7, 0.1, 0.1, 0.5), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(-0.4, 0.8, -0.2)), Vector3(0.02, 0.01, 0.6), Color(0.1, 0.1, 0.5, 0.5), true)

static func safe_box(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.5, 0)), Vector3(0.7, 1.0, 0.6), Color(0.22, 0.25, 0.22, 0.2), true)
	mb.add_cyl(xf * Transform3D(Basis(Vector3.RIGHT, -PI / 2), Vector3(0.1, 0.6, -0.3)), 0.08, 0.08, 0.04, 8, C_METAL_GRAY)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.5, 0)), Vector3(0.7, 1.0, 0.6))

static func toolbox(mb: MeshBuilder, xf: Transform3D) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.15, 0)), Vector3(0.6, 0.3, 0.3), Color(0.75, 0.3, 0.1, 0.2), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.35, 0)), Vector3(0.3, 0.05, 0.05), C_RUBBER, true)

static func stove(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	mb.add_cyl(xf, 0.35, 0.35, 0.8, 10, Color(0.15, 0.14, 0.13, 0.3))
	mb.add_cyl(xf * Transform3D(Basis(), Vector3(0, 0.8, 0)), 0.08, 0.08, 2.2, 6, Color(0.2, 0.18, 0.16, 0.3))
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.4, 0)), Vector3(0.7, 0.8, 0.7))

static func flag(mb: MeshBuilder, col: Variant, pos: Vector3, h: float = 9.0) -> void:
	mb.add_cyl(Transform3D(Basis(), pos), 0.08, 0.05, h, 8, C_METAL_GRAY)
	mb.add_cyl(Transform3D(Basis(), pos), 0.4, 0.4, 0.3, 8, C_CONCRETE_D)
	var top := pos + Vector3(0, h - 0.1, 0)
	for i in 6:
		var x0 := 0.08 + i * 0.3
		var w0 := sin(i * 0.9) * 0.1
		var w1 := sin((i + 1) * 0.9) * 0.1
		mb.add_quad(top + Vector3(x0, 0, w0), top + Vector3(x0 + 0.3, 0, w1), top + Vector3(x0 + 0.3, -0.6, w1), top + Vector3(x0, -0.6, w0), Color(0.08, 0.08, 0.08, 0.5))
		mb.add_quad(top + Vector3(x0, -0.6, w0), top + Vector3(x0 + 0.3, -0.6, w1), top + Vector3(x0 + 0.3, -1.2, w1), top + Vector3(x0, -1.2, w0), Color(0.6, 0.06, 0.05, 0.5))
		mb.add_quad(top + Vector3(x0, 0, w0), top + Vector3(x0, -0.6, w0), top + Vector3(x0 + 0.3, -0.6, w1), top + Vector3(x0 + 0.3, 0, w1), Color(0.08, 0.08, 0.08, 0.5))
		mb.add_quad(top + Vector3(x0, -0.6, w0), top + Vector3(x0, -1.2, w0), top + Vector3(x0 + 0.3, -1.2, w1), top + Vector3(x0 + 0.3, -0.6, w1), Color(0.6, 0.06, 0.05, 0.5))
	add_col(col, Transform3D(Basis(), pos + Vector3(0, h * 0.5, 0)), Vector3(0.3, h, 0.3))

static func target_stand(mb: MeshBuilder, col: Variant, xf: Transform3D) -> void:
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 0.6, 0)), Vector3(0.08, 1.2, 0.08), C_WOOD, true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.35, 0)), Vector3(0.6, 0.9, 0.03), Color(0.7, 0.65, 0.5, 0.5), true)
	mb.add_box(xf * Transform3D(Basis(), Vector3(0, 1.45, -0.02)), Vector3(0.25, 0.35, 0.01), Color(0.2, 0.2, 0.18, 0.5), true)
	add_col(col, xf * Transform3D(Basis(), Vector3(0, 0.9, 0)), Vector3(0.6, 1.8, 0.1))

# ---------------------------------------------------------------- растительность (в foliage-билдер)
static func tree_pine(mb: MeshBuilder, pos: Vector3, h: float, rng: RandomNumberGenerator) -> void:
	var trunk := Color(0.33, 0.24, 0.17, 0.6)
	mb.add_cyl(Transform3D(Basis(Vector3.UP, rng.randf() * TAU), pos), 0.18 * h / 10.0 + 0.05, 0.05, h, 6, trunk, false)
	var g := M.jitter(Color(0.21, 0.31, 0.16, 0.6), rng, 0.12)
	var tiers := 4
	for i in tiers:
		var y := h * (0.35 + 0.17 * i)
		var r := (1.0 - float(i) / tiers) * h * 0.22 + 0.4
		mb.add_cyl(Transform3D(Basis(Vector3.UP, rng.randf() * TAU), pos + Vector3(0, y, 0)), r, 0.05, h * 0.3, 7, g.darkened(0.06 * i), true, false)

static func tree_birch(mb: MeshBuilder, pos: Vector3, h: float, rng: RandomNumberGenerator) -> void:
	var bark := Color(0.82, 0.8, 0.74, 0.6)
	var top := pos + Vector3(rng.randf_range(-0.3, 0.3), h, rng.randf_range(-0.3, 0.3))
	mb.cyl_between(pos, top, 0.13 * h / 9.0 + 0.04, 0.04, 6, bark, false)
	mb.cyl_between(pos + Vector3(0, h * 0.3, 0), pos + Vector3(0, h * 0.3 + 0.12, 0), 0.15 * h / 9.0 + 0.045, 0.14 * h / 9.0 + 0.04, 6, Color(0.1, 0.1, 0.1, 0.6), false)
	var g := M.jitter(Color(0.32, 0.4, 0.16, 0.6), rng, 0.15)
	for i in 4:
		var c := pos + Vector3(rng.randf_range(-1.2, 1.2), h * rng.randf_range(0.55, 0.95), rng.randf_range(-1.2, 1.2))
		mb.add_blob(c, Vector3(1.4, 1.1, 1.4) * rng.randf_range(0.7, 1.1) * h / 9.0, g, rng, 0.3)

static func tree_dead(mb: MeshBuilder, pos: Vector3, h: float, rng: RandomNumberGenerator) -> void:
	var c := Color(0.28, 0.23, 0.19, 0.6)
	var top := pos + Vector3(rng.randf_range(-0.4, 0.4), h, rng.randf_range(-0.4, 0.4))
	mb.cyl_between(pos, top, 0.2, 0.04, 6, c, false)
	for i in 4:
		var a := pos.lerp(top, rng.randf_range(0.4, 0.85))
		mb.cyl_between(a, a + Vector3(rng.randf_range(-1.8, 1.8), rng.randf_range(0.5, 1.5), rng.randf_range(-1.8, 1.8)), 0.06, 0.02, 4, c, false)

static func bush(mb: MeshBuilder, pos: Vector3, s: float, rng: RandomNumberGenerator) -> void:
	var g := M.jitter(Color(0.27, 0.32, 0.14, 0.6), rng, 0.15)
	for i in 3:
		mb.add_blob(pos + Vector3(rng.randf_range(-0.5, 0.5) * s, 0.4 * s, rng.randf_range(-0.5, 0.5) * s), Vector3(0.8, 0.6, 0.8) * s * rng.randf_range(0.7, 1.1), g, rng, 0.3, true)

static func grass_tuft_mesh() -> ArrayMesh:
	var mb := MeshBuilder.new()
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in 7:
		var a := rng.randf() * TAU
		var r := rng.randf() * 0.18
		var base := Vector3(cos(a) * r, 0, sin(a) * r)
		var h := rng.randf_range(0.3, 0.6)
		var lean := Vector3(cos(a), 0, sin(a)) * rng.randf_range(0.05, 0.2)
		var w := Vector3(-sin(a), 0, cos(a)) * 0.045
		var g0 := Color(0.25, 0.3, 0.12, 0.6)
		var g1 := Color(0.5, 0.5, 0.24, 0.6)
		mb.add_tri(base - w, base + w, base + lean + Vector3(0, h, 0), g0)
		mb.cols[mb.cols.size() - 1] = g1
	return mb.build(Mats.foliage(false, 0.5))
