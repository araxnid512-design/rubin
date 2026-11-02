class_name Crowns
## Кроны деревьев из листвы, как в мобильных играх: вместо гладкой многогранной кроны из выгрузки — пучок
## карточек с текстурой листьев (прозрачные края, шейдер foliage с CARDS). Текстуры рисуются кодом при первом
## запуске (без внешних файлов): листва берёзы/яблони — гроздья листьев, ёлка — еловые лапы. Нормали у карточек
## «сферические» (от центра кроны) — крона освещена как объём, а не как набор плоскостей. В UV2.x — глубина в
## кроне (0 — снаружи, 1 — у ствола): нутро темнее, дешёвое затенение без SSAO.
##
## Нагрузка: 22–65 карточек (44–130 треугольников) на дерево; пиксели с
## прозрачностью отбрасываются (alpha scissor).

const TEX := 128
static var _tex := {}
static var _meshes := {}

## Карточная крона на месте меша кроны из выгрузки (по его габаритам); kind — материал кроны (leaves, leavesDry, pine).
static func mesh_for(src: Mesh, kind: String) -> ArrayMesh:
	var key := "%d|%s" % [src.get_instance_id(), kind]
	if _meshes.has(key):
		return _meshes[key]
	var box := src.get_aabb()
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(key)
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	if kind == "pine":
		_pine(st, box, rng)
	else:
		_leafy(st, box, rng, 30 if kind == "leaves" else 22)
	var m := st.commit()
	_meshes[key] = m
	return m

## Берёза, яблоня: карточки в эллипсоиде кроны, повёрнуты наружу и чуть вверх (камера сверху видит их лицом).
static func _leafy(st: SurfaceTool, box: AABB, rng: RandomNumberGenerator, n: int) -> void:
	var c := box.get_center()
	var r := box.size * 0.5
	var size := (r.x + r.z) * 0.5 * 0.85
	for i in n:
		var p := Vector3.ZERO
		for _t in 12:
			p = Vector3(rng.randf_range(-1, 1), rng.randf_range(-1, 1), rng.randf_range(-1, 1))
			if p.length_squared() <= 1.0:
				break
		var depth := 1.0 - p.length()
		var at := c + p * r * 0.72
		var out := (p + Vector3(0, 0.75, 0)).normalized()
		if out.length_squared() < 0.01:
			out = Vector3.UP
		var s := size * rng.randf_range(0.75, 1.1)
		_card(st, at, out, rng.randf() * TAU, s, s, c, r, depth, Rect2(0, 0, 1, 1))

## Ёлка: ярусы еловых лап от ствола наружу и вниз, к верху ярусы уже; макушка — две скрещенные карточки.
static func _pine(st: SurfaceTool, box: AABB, rng: RandomNumberGenerator) -> void:
	var c := box.get_center()
	var r := box.size * 0.5
	var tiers := 8
	var y0 := box.position.y + box.size.y * 0.08
	var y1 := box.end.y - box.size.y * 0.12
	for t in tiers:
		var k := float(t) / float(tiers - 1)
		var y := lerpf(y0, y1, k)
		var rad := lerpf(r.x * 1.0, r.x * 0.25, k)
		var count := 9 if t < tiers - 3 else 6
		var off := rng.randf() * TAU
		for b in count:
			var a := off + TAU * float(b) / float(count) + rng.randf_range(-0.2, 0.2)
			var dir := Vector3(cos(a), 0, sin(a))
			var droop := rad * rng.randf_range(0.25, 0.4)
			var root := Vector3(c.x, y + droop * 0.4, c.z)
			var tip := root + dir * rad + Vector3(0, -droop, 0)
			_branch(st, root, tip, rad * 1.05, c, r, k)
	# макушка
	var top := Vector3(c.x, box.end.y, c.z)
	for a: float in [0.0, PI * 0.5]:
		var d := Vector3(cos(a), 0, sin(a))
		var h := box.size.y * 0.16
		var w := r.x * 0.3
		var v0 := top + Vector3(0, -h * 1.6, 0)
		var quad := [v0 - d * w, v0 + d * w, top + d * w * 0.15, top - d * w * 0.15]
		_quad(st, quad, [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)], Vector3.UP, c, r, 0.0, true)

## Еловая лапа: карточка от ствола (u = 0) к кончику (u = 1), ширина w — поперёк.
static func _branch(st: SurfaceTool, root: Vector3, tip: Vector3, w: float, c: Vector3, r: Vector3, depth: float) -> void:
	var along := (tip - root).normalized()
	var side := along.cross(Vector3.UP).normalized() * w * 0.5
	var quad := [root - side * 0.4, tip - side, tip + side, root + side * 0.4]
	var up := side.cross(along).normalized()
	if up.y < 0.0:
		up = -up
	_quad(st, quad, [Vector2(0, 0), Vector2(1, 0), Vector2(1, 1), Vector2(0, 1)], up, c, r, depth * 0.3, true)

static func _card(st: SurfaceTool, at: Vector3, nrm: Vector3, spin: float, w: float, h: float, c: Vector3, r: Vector3, depth: float, uv: Rect2) -> void:
	var t := nrm.cross(Vector3(0.31, 0.12, 0.94) if absf(nrm.z) < 0.9 else Vector3(1, 0, 0)).normalized()
	var b := nrm.cross(t).normalized()
	var tt := (t * cos(spin) + b * sin(spin)) * w * 0.5
	var bb := (b * cos(spin) - t * sin(spin)) * h * 0.5
	var quad := [at - tt - bb, at + tt - bb, at + tt + bb, at - tt + bb]
	var uvs := [uv.position + Vector2(0, uv.size.y), uv.position + uv.size, uv.position + Vector2(uv.size.x, 0), uv.position]
	_quad(st, quad, uvs, nrm, c, r, depth, false)

## Четырёхугольник двумя треугольниками; нормаль вершины — между нормалью карточки и направлением от центра кроны.
static func _quad(st: SurfaceTool, q: Array, uvs: Array, nrm: Vector3, c: Vector3, r: Vector3, depth: float, flat: bool) -> void:
	for i in [0, 1, 2, 0, 2, 3]:
		var v: Vector3 = q[i]
		var sph := ((v - c) / r).normalized()
		var n := nrm.lerp(sph, 0.35 if flat else 0.7).normalized()
		st.set_normal(n)
		st.set_uv(uvs[i])
		st.set_uv2(Vector2(clampf(depth, 0.0, 1.0), 0.0))
		st.add_vertex(v)

# ---------- Текстуры ----------

## Текстура карточек: "leaf" — гроздь листьев, "pine" — еловая лапа. Светлая: цвет даёт оттенок дерева.
static func texture(kind: String) -> ImageTexture:
	var k := "pine" if kind == "pine" else "leaf"
	if _tex.has(k):
		return _tex[k]
	var rng := RandomNumberGenerator.new()
	rng.seed = 1717 if k == "leaf" else 2929
	# прозрачные пиксели — со средним цветом листвы: без тёмной каймы при фильтрации и на мелких мипах
	var data := PackedByteArray()
	data.resize(TEX * TEX * 4)
	for i in TEX * TEX:
		data[i * 4] = 196
		data[i * 4 + 1] = 200
		data[i * 4 + 2] = 170
		data[i * 4 + 3] = 0
	if k == "leaf":
		_draw_leaves(data, rng)
	else:
		_draw_pine(data, rng)
	var img := _with_mips(data)
	var tex := ImageTexture.create_from_image(img)
	_tex[k] = tex
	return tex

## Гроздь: ~170 листьев-эллипсов в круге, к краю реже (рваный круглый силуэт), у каждого своя яркость и оттенок.
static func _draw_leaves(data: PackedByteArray, rng: RandomNumberGenerator) -> void:
	var cen := Vector2(TEX, TEX) * 0.5
	for i in 170:
		var p := Vector2.ZERO
		for _t in 8:
			p = Vector2(rng.randf_range(-1, 1), rng.randf_range(-1, 1))
			if p.length() <= 1.0 and rng.randf() > p.length() * 0.55:
				break
		var at := cen + p * TEX * 0.44
		var ln := rng.randf_range(7.0, 11.0)
		var wd := ln * rng.randf_range(0.42, 0.55)
		var ang := rng.randf() * TAU
		var v := rng.randf_range(0.62, 1.0)
		var tone := rng.randf()
		var col := Color(v, v, v)
		if tone < 0.25:
			col = Color(v, v * 0.92, v * 0.62)   # пожелтевший
		elif tone < 0.5:
			col = Color(v * 0.85, v, v * 0.8)    # зеленее
		_ellipse(data, at, ln, wd, ang, col)

## Еловая лапа: стебель вдоль u, иголки в обе стороны, к кончику короче; боковые веточки.
static func _draw_pine(data: PackedByteArray, rng: RandomNumberGenerator) -> void:
	var mid := TEX * 0.5
	_stem(data, Vector2(0, mid), Vector2(TEX - 2, mid), rng, TEX * 0.42)
	for i in 5:
		var x := TEX * (0.15 + 0.15 * i)
		var s := 1.0 if i % 2 == 0 else -1.0
		var bl := TEX * (0.36 - 0.05 * i)
		_stem(data, Vector2(x, mid), Vector2(x + bl * 0.75, mid + s * bl * 0.6), rng, bl * 0.5)

static func _stem(data: PackedByteArray, a: Vector2, b: Vector2, rng: RandomNumberGenerator, needle: float) -> void:
	var d := b - a
	var n := int(d.length() / 1.6)
	var side := Vector2(-d.y, d.x).normalized()
	for i in n:
		var t := float(i) / float(max(n - 1, 1))
		var p := a + d * t
		var nl := needle * (1.0 - t * 0.65) * rng.randf_range(0.7, 1.0)
		for s: float in [-1.0, 1.0]:
			var dir := (side * s + d.normalized() * 0.55).normalized()
			var v := rng.randf_range(0.55, 1.0)
			_line(data, p, p + dir * nl, Color(v * 0.9, v, v * 0.85))
	_line(data, a, b, Color(0.45, 0.35, 0.25))

static func _ellipse(data: PackedByteArray, at: Vector2, ln: float, wd: float, ang: float, col: Color) -> void:
	var ca := cos(ang)
	var sa := sin(ang)
	var r := int(ceil(ln * 0.5)) + 1
	for y in range(int(at.y) - r, int(at.y) + r + 1):
		if y < 0 or y >= TEX:
			continue
		for x in range(int(at.x) - r, int(at.x) + r + 1):
			if x < 0 or x >= TEX:
				continue
			var dx := x + 0.5 - at.x
			var dy := y + 0.5 - at.y
			var u := (dx * ca + dy * sa) / (ln * 0.5)
			var w := (-dx * sa + dy * ca) / (wd * 0.5)
			var e := u * u + w * w
			if e <= 1.0:
				# к краю листа и к прожилке чуть темнее
				var k := 1.0 - 0.18 * e - 0.12 * (1.0 - smoothstep(0.0, 0.12, absf(w)))
				_put(data, x, y, Color(col.r * k, col.g * k, col.b * k))

static func _line(data: PackedByteArray, a: Vector2, b: Vector2, col: Color) -> void:
	var n := int(maxf(absf(b.x - a.x), absf(b.y - a.y))) + 1
	for i in n + 1:
		var p := a.lerp(b, float(i) / float(n))
		_put(data, int(p.x), int(p.y), col)

static func _put(data: PackedByteArray, x: int, y: int, col: Color) -> void:
	if x < 0 or y < 0 or x >= TEX or y >= TEX:
		return
	var o := (y * TEX + x) * 4
	data[o] = int(clampf(col.r, 0.0, 1.0) * 255.0)
	data[o + 1] = int(clampf(col.g, 0.0, 1.0) * 255.0)
	data[o + 2] = int(clampf(col.b, 0.0, 1.0) * 255.0)
	data[o + 3] = 255

## Мип-уровни вручную: прозрачность на мелких уровнях усиливается, иначе вдали листва «тает» (alpha scissor).
static func _with_mips(base: PackedByteArray) -> Image:
	var all := PackedByteArray()
	var cur := base
	var w := TEX
	all.append_array(cur)
	while w > 1:
		var nw: int = w / 2
		var nxt := PackedByteArray()
		nxt.resize(nw * nw * 4)
		for y in nw:
			for x in nw:
				var acc := [0.0, 0.0, 0.0, 0.0]
				for oy in 2:
					for ox in 2:
						var o := ((y * 2 + oy) * w + x * 2 + ox) * 4
						for ch in 4:
							acc[ch] += float(cur[o + ch])
				var q := (y * nw + x) * 4
				for ch in 3:
					nxt[q + ch] = int(acc[ch] / 4.0)
				nxt[q + 3] = int(minf(255.0, acc[3] / 4.0 * 1.3))
		cur = nxt
		w = nw
		all.append_array(cur)
	return Image.create_from_data(TEX, TEX, true, Image.FORMAT_RGBA8, all)
