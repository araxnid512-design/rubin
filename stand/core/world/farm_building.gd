class_name ULFarmBuilding
extends Node3D
## Сельская постройка «Опасного коровника» (коровник, сарай, хозпостройка) — собирается по описанию из деталей,
## как настоящая: бетонный цоколь, кирпичный низ стен, сверху серые доски, столбы и обвязка из бруса, окна с
## рамами и разбитыми стёклами, большие створчатые ворота, треугольные фронтоны, фермы под крышей, кровля из
## листов профнастила с ржавыми пятнами и дырами. Внутри: бетонный пол, стойла с жердями, кормушки, сено (или
## верстак, бочки, корма — по fill). Один участок стены может быть разрушен — пролом с кучей кирпича.
## Материалы — ULFarmBuilding.SHADER: текстура по мировым координатам, к земле стена темнее и грязнее (сырость),
## пятна и мох; fade — растворение точками. Когда герой внутри, крыша и стена со стороны камеры плавно
## растворяются (set_inside), как в выживалках с видом сверху.
## Детали не становятся отдельными узлами: каждая группа (крыша, ближняя стена, остальное) — несколько сеток по
## материалу (на телефоне дорог каждый вызов отрисовки).

const SHADER := """shader_type spatial;
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D albedo2 : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
uniform bool has_normal = false;
uniform bool has_second = false;
uniform bool swap_xz = false;
uniform float scale = 1.5;
uniform vec4 tint : source_color = vec4(1.0);
uniform vec4 tint2 : source_color = vec4(1.0);
uniform float grime = 1.0;
uniform float rough = 0.88;
uniform float metal = 0.0;
uniform float fade = 0.0;
uniform float second_bias = 0.0;
uniform float sat = 1.0;
varying vec3 wpos;
varying vec3 wnrm;
void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}
void fragment() {
	if (fade > 0.001 && fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715)))) < fade) { discard; }
	vec3 an = abs(wnrm);
	vec2 uv;
	if (an.y > 0.6) { uv = swap_xz ? wpos.zx : wpos.xz; }
	else if (an.x > an.z) { uv = vec2(wpos.z, -wpos.y); }
	else { uv = vec2(wpos.x, -wpos.y); }
	uv /= scale;
	vec3 c = texture(albedo_tex, uv).rgb;
	c = mix(vec3(dot(c, vec3(0.3, 0.59, 0.11))), c, sat) * tint.rgb;
	float n = texture(noise, wpos.xz / 5.0 + vec2(wpos.y * 0.11, -wpos.y * 0.07)).r;
	if (has_second) {
		// второй материал пятнами (ржавчина по серому профнастилу, грязь и навоз по бетонному полу): цвет
		// приглушён, переход мягкий, пятна вытянуты вдоль листа (потёки)
		float r = smoothstep(0.3, 0.72, n * 0.6 + texture(noise, uv * vec2(0.9, 0.18)).r * 0.4 + second_bias);
		vec3 c2 = texture(albedo2, uv).rgb;
		c2 = mix(vec3(dot(c2, vec3(0.3, 0.59, 0.11))), c2, 0.62) * tint2.rgb;
		c = mix(c, c2, r);
	}
	// к земле стена темнее (сырость, грязь); пол и крыша — меньше
	float low = (1.0 - smoothstep(0.0, 0.9 + n * 0.8, wpos.y)) * (an.y > 0.6 ? 0.25 : 1.0);
	c *= mix(1.0, 0.5, low * grime);
	c = mix(c, c * vec3(0.78, 0.88, 0.66), smoothstep(0.6, 0.82, n) * 0.45 * grime * (1.0 - smoothstep(1.5, 3.0, wpos.y)));
	c *= mix(0.9, 1.06, texture(noise, wpos.xz / 23.0 + wpos.y * 0.01).r);
	ALBEDO = c;
	if (has_normal) { NORMAL_MAP = texture(normal_tex, uv).rgb; }
	ROUGHNESS = rough;
	METALLIC = metal;
}"""

var def: Dictionary
var half := Vector2.ONE
var roof: Node3D                  ## кровля и фермы — растворяются, когда герой внутри
var front: Node3D                 ## стена со стороны камеры (юг) — тоже
var rest: Node3D
var cols: Array = []              ## [размер, преобразование] — столкновения (добавляет ULCowshed)
var _mats: Dictionary             ## общие материалы: имя → ShaderMaterial
var _own := {}                    ## свои копии материалов для растворяемых групп
var _st := {}                     ## [группа, материал] → SurfaceTool
var _fade := 0.0
var _want := 0.0
var _rng: RandomNumberGenerator
var _drng := RandomNumberGenerator.new()   ## мелкие детали (заплаты, доски у стен, желоба) — своё зерно
var _box := BoxMesh.new()
var front_side := ""              ## какая стена больше всех смотрит на камеру: s+, s-, e+, e-
var front_sides: Array = []       ## все стены, что смотрят на камеру (растворяются, когда герой внутри)
static var cam_dir := Vector3(0, 0, 1)   ## от постройки к камере по земле (настройка «Камера»)


static func make_materials(noise: Texture2D) -> Dictionary:
	var sh := Shader.new()
	sh.code = SHADER
	var T := "res://assets/world/tex/"
	var defs := {
		"brick": [T + "brick_4", 1.6, Color(0.82, 0.74, 0.68), 1.0, 0.9],
		"planks": [T + "wood_planks_grey", 2.4, Color(0.92, 0.9, 0.86), 0.8, 0.9],
		"beam": [T + "brown_planks_03", 1.6, Color(0.55, 0.46, 0.38), 0.6, 0.9],
		"gate": [T + "wood_planks_dirt", 2.2, Color(0.78, 0.7, 0.62), 0.7, 0.9],
		"roof": [T + "corrugated_iron_02", 2.0, Color(0.85, 0.85, 0.82), 0.0, 0.62],
		"concrete": [T + "damaged_concrete_floor", 3.0, Color(0.8, 0.76, 0.7), 0.6, 0.92],
		"glass": ["", 1.0, Color(0.06, 0.07, 0.07), 0.0, 0.15],
		"hay": [T + "leafy_grass", 0.9, Color(0.72, 0.64, 0.44), 0.5, 1.0],
		"floor": [T + "damaged_concrete_floor", 3.0, Color(0.95, 0.9, 0.84), 0.0, 0.92],
		"rust": [T + "rusty_corrugated_iron", 1.4, Color(0.95, 0.8, 0.72), 0.2, 0.7],
	}
	var out := {}
	for k in defs:
		var d: Array = defs[k]
		var m := ShaderMaterial.new()
		m.shader = sh
		m.set_shader_parameter("noise", noise)
		if String(d[0]) != "":
			m.set_shader_parameter("albedo_tex", load(String(d[0]) + "_c.jpg"))
			if ResourceLoader.exists(String(d[0]) + "_n.jpg"):
				m.set_shader_parameter("normal_tex", load(String(d[0]) + "_n.jpg"))
				m.set_shader_parameter("has_normal", true)
		else:
			m.set_shader_parameter("albedo_tex", load(T + "dirt_c.jpg"))
		m.set_shader_parameter("scale", float(d[1]))
		m.set_shader_parameter("tint", d[2])
		m.set_shader_parameter("grime", float(d[3]))
		m.set_shader_parameter("rough", float(d[4]))
		if k == "roof":
			# серый профнастил с ржавыми пятнами и потёками (как на эталоне)
			m.set_shader_parameter("albedo2", load(T + "rusty_corrugated_iron_c.jpg"))
			m.set_shader_parameter("has_second", true)
			m.set_shader_parameter("tint2", Color(1.3, 1.32, 1.26))
			m.set_shader_parameter("second_bias", 0.06)
			m.set_shader_parameter("metal", 0.05)
			m.set_shader_parameter("rough", 0.86)
		elif k == "floor":
			# бетонный пол в навозе и соломенной трухе
			m.set_shader_parameter("albedo2", load(T + "brown_mud_02_c.jpg"))
			m.set_shader_parameter("has_second", true)
			m.set_shader_parameter("tint2", Color(0.85, 0.78, 0.66))
		elif k == "rust":
			m.set_shader_parameter("tint", Color(1.3, 1.3, 1.25))
			m.set_shader_parameter("sat", 0.62)
		out[k] = m
	return out


## d: описание из ULCowshed.BUILDINGS; mats — общие материалы (make_materials)
func build(d: Dictionary, mats: Dictionary, rng: RandomNumberGenerator) -> void:
	def = d
	_mats = mats
	_rng = rng
	_drng.seed = hash(String(d.id)) + 911
	position = d.at
	rotation.y = float(d.yaw)
	name = String(d.id)
	var L := float(d.L)
	var W := float(d.W)
	var H := float(d.H)
	half = Vector2(L * 0.5, W * 0.5)
	roof = Node3D.new()
	front = Node3D.new()
	rest = Node3D.new()
	for g in [rest, front, roof]:
		add_child(g)
	# какие стены смотрят на камеру (cam_dir — от постройки к камере по земле): они растворяются вместе с крышей,
	# когда герой внутри. При камере «по диагонали» таких стен две (южная и восточная).
	var best := -2.0
	front_sides.clear()
	for side in ["s+", "s-", "e+", "e-"]:
		var nz := (Basis(Vector3.UP, float(d.yaw)) * _side_normal(side)).dot(cam_dir)
		if nz > best:
			best = nz
			front_side = side
		if nz > 0.3:
			front_sides.append(side)
	var ruin := float(d.get("ruin", 0.3))
	# пролом: участок длинной стены без стены (если есть разрушения) — с кучей кирпича
	var breach := []
	if ruin >= 0.3 and L > 14.0:
		var side: String = "s-" if front_side != "s-" else "s+"
		breach = [side, rng.randf_range(-L * 0.3, L * 0.3), rng.randf_range(2.5, 3.5)]
	for side in ["s+", "s-", "e+", "e-"]:
		_wall(side, L, W, H, breach)
	_roof(L, W, H, ruin)
	_gutters(L, W, H)
	_floor(L, W)
	match String(d.get("fill", "")):
		"barn":
			_stalls(L, W)
		"tools":
			_tools(L, W)
		"fuel":
			_fuel(L, W)
		"feed":
			_feed(L, W)
	_commit()


static func _side_normal(side: String) -> Vector3:
	match side:
		"s+":
			return Vector3(0, 0, 1)
		"s-":
			return Vector3(0, 0, -1)
		"e+":
			return Vector3(1, 0, 0)
	return Vector3(-1, 0, 0)


func _group(side: String) -> Node3D:
	return front if side == front_side or front_sides.has(side) else rest


## деталь: коробка size с преобразованием xf (в системе постройки) в группу g из материала m
func _bx(g: Node3D, m: String, size: Vector3, xf: Transform3D) -> void:
	var key := [g, m]
	if not _st.has(key):
		var st := SurfaceTool.new()
		st.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = st
	_box.size = size
	(_st[key] as SurfaceTool).append_from(_box, 0, xf)


func _at(p: Vector3, yaw := 0.0) -> Transform3D:
	return Transform3D(Basis(Vector3.UP, yaw), p)


## Стена. Вдоль неё — проёмы (ворота, двери, пролом) на всю высоту и окна в дощатой части. Снизу — бетонный
## цоколь и кирпич до 1,1 м, сверху — доски; столбы из бруса через ~3 м и обвязка поверху.
func _wall(side: String, L: float, W: float, H: float, breach: Array) -> void:
	var g := _group(side)
	var along_x := side.begins_with("s")
	var len := L if along_x else W
	var off := (W * 0.5 if along_x else L * 0.5) * (1.0 if side.ends_with("+") else -1.0)
	var holes := []                    # [центр, ширина, низ, верх, вид]
	var door_h := minf(H - 0.35, 3.0)
	for dr in def.doors:
		if String(dr[0]) == side:
			holes.append([float(dr[1]), float(dr[2]), 0.0, door_h if float(dr[2]) > 2.6 else 2.2, "door"])
	if not breach.is_empty() and String(breach[0]) == side:
		holes.append([float(breach[1]), float(breach[2]), 0.0, H, "breach"])
	# окна — равномерно, мимо дверей
	var nwin := int(def.get("win", 0)) if along_x else 0
	for i in nwin:
		var c := -len * 0.5 + len * (i + 0.5) / nwin
		var free := true
		for h in holes:
			if absf(c - float(h[0])) < float(h[1]) * 0.5 + 1.2:
				free = false
		if free:
			holes.append([c, 1.3, 1.55, 2.45, "win"])
	holes.sort_custom(func(a, b): return float(a[0]) < float(b[0]))
	var hb := 1.1
	var tb := 0.3
	var tp := 0.12
	# куски стены между проёмами
	var cuts := [-len * 0.5]
	for h in holes:
		cuts.append(float(h[0]) - float(h[1]) * 0.5)
		cuts.append(float(h[0]) + float(h[1]) * 0.5)
	cuts.append(len * 0.5)
	for k in range(0, cuts.size(), 2):
		var a: float = cuts[k]
		var b: float = cuts[k + 1]
		if b - a < 0.05:
			continue
		_wall_piece(g, along_x, off, a, b, 0.0, H, hb, tb, tp, true)
		_wall_decor(g, along_x, off, a, b, H, hb, tb, tp)
	for h in holes:
		var a := float(h[0]) - float(h[1]) * 0.5
		var b := float(h[0]) + float(h[1]) * 0.5
		var kind := String(h[4])
		if kind == "win":
			_wall_piece(g, along_x, off, a, b, 0.0, float(h[2]), hb, tb, tp, true)     # под окном не пройти
			_wall_piece(g, along_x, off, a, b, float(h[3]), H, hb, tb, tp, false)
			_window(g, along_x, off, a, b, float(h[2]), float(h[3]))
		elif kind == "door":
			_wall_piece(g, along_x, off, a, b, float(h[3]), H, hb, tb, tp, false)
			_gate(g, along_x, off, side, a, b, float(h[3]))
		else:
			_rubble(along_x, off, side, a, b)
	# столбы и обвязка
	var n := int(ceil(len / 3.2))
	for i in n + 1:
		var c := -len * 0.5 + len * i / n
		var inhole := false
		for h in holes:
			if absf(c - float(h[0])) < float(h[1]) * 0.5 + 0.1 and String(h[4]) != "win":
				inhole = true
		if inhole:
			continue
		var p := Vector3(c, hb + (H - hb) * 0.5, off + signf(off) * 0.02) if along_x else Vector3(off + signf(off) * 0.02, hb + (H - hb) * 0.5, c)
		_bx(g, "beam", Vector3(0.2, H - hb, 0.2), _at(p))
	var top := Vector3(len + 0.2, 0.2, 0.22) if along_x else Vector3(0.22, 0.2, len + 0.2)
	_bx(g, "beam", top, _at(Vector3(0, H - 0.1, off) if along_x else Vector3(off, H - 0.1, 0)))
	# фронтон над торцом
	if not along_x:
		_gable(g, off, W, H)


## Детали глухого куска стены: отлив над кирпичом (доска с выносом), заплаты — доски, прибитые поверх обшивки
## вкось или поперёк; иногда к стене прислонены три доски.
func _wall_decor(g: Node3D, along_x: bool, off: float, a: float, b: float, H: float, hb: float, tb: float, tp: float) -> void:
	var sg := signf(off)
	var l := b - a
	if l < 0.6:
		return
	var c := (a + b) * 0.5
	var dz := off + sg * (tb * 0.5 + 0.03)
	_bx(g, "beam", Vector3(l, 0.05, 0.1) if along_x else Vector3(0.1, 0.05, l), _at(Vector3(c, hb + 0.025, dz) if along_x else Vector3(dz, hb + 0.025, c)))
	var pz := off - sg * (tb - tp) * 0.5 + sg * (tp * 0.5 + 0.014)
	if l > 2.0 and _drng.randf() < 0.45:
		for k in _drng.randi_range(1, 2):
			var bl := _drng.randf_range(0.8, minf(1.5, l - 0.4))
			var x := _drng.randf_range(a + bl * 0.5 + 0.1, b - bl * 0.5 - 0.1)
			var y := _drng.randf_range(hb + 0.5, H - 0.6)
			var bas := Basis(Vector3(0, 0, 1) if along_x else Vector3(1, 0, 0), _drng.randf_range(-0.5, 0.5))
			_bx(g, "gate", Vector3(bl, 0.14, 0.025) if along_x else Vector3(0.025, 0.14, bl), Transform3D(bas, Vector3(x, y, pz) if along_x else Vector3(pz, y, x)))
	if l > 2.6 and _drng.randf() < 0.25:
		var x0 := _drng.randf_range(a + 0.6, b - 1.0)
		for k in 3:
			var bh := _drng.randf_range(1.6, 2.2)
			var lean := _drng.randf_range(0.22, 0.32)
			var x := x0 + k * 0.18
			var z := off + sg * (tb * 0.5 + 0.08 + sin(lean) * bh * 0.5)
			var bas := Basis(Vector3(1, 0, 0), -sg * lean) if along_x else Basis(Vector3(0, 0, 1), sg * lean)
			_bx(g, "gate" if k != 1 else "planks", Vector3(0.15, bh, 0.025) if along_x else Vector3(0.025, bh, 0.15), Transform3D(bas, Vector3(x, cos(lean) * bh * 0.5, z) if along_x else Vector3(z, cos(lean) * bh * 0.5, x)))


## Водосточные желоба по нижнему краю кровли на длинных сторонах (местами оторван и висит) и труба на углу
func _gutters(L: float, W: float, H: float) -> void:
	for s in [-1.0, 1.0]:
		var z: float = s * (W * 0.5 + 0.55)
		var y := H - 0.04
		var x0 := -L * 0.5 - 0.4
		var x1 := L * 0.5 + 0.4
		if _drng.randf() < 0.4:
			# кусок у одного края оторвался: висит на одном крюке
			var xb := _drng.randf_range(x1 - 4.0, x1 - 2.2)
			var hang := x1 - xb
			var ang := _drng.randf_range(0.35, 0.6)
			_bx(roof, "rust", Vector3(hang, 0.1, 0.14), Transform3D(Basis(Vector3(0, 0, 1), -ang), Vector3(xb + cos(ang) * hang * 0.5, y - sin(ang) * hang * 0.5, z)))
			x1 = xb
		_bx(roof, "rust", Vector3(x1 - x0, 0.1, 0.14), _at(Vector3((x0 + x1) * 0.5, y, z)))
		# труба на углу (мимо ворот на этой стороне)
		var side := "s+" if s > 0.0 else "s-"
		for px in [-L * 0.5 + 0.35, L * 0.5 - 0.35]:
			var busy := false
			for dr in def.doors:
				if String(dr[0]) == side and absf(float(dr[1]) - px) < float(dr[2]) * 0.5 + 0.8:
					busy = true
			if busy or _drng.randf() < 0.5:
				continue
			var zp: float = s * (W * 0.5 + 0.32)
			_bx(_group(side), "rust", Vector3(0.11, H - 0.25, 0.11), _at(Vector3(px, (H - 0.25) * 0.5 + 0.05, zp)))
			_bx(_group(side), "rust", Vector3(0.11, 0.11, absf(z - zp) + 0.1), _at(Vector3(px, y - 0.08, (z + zp) * 0.5)))
			break


## кусок стены [a; b] по высоте [y0; y1]: цоколь, кирпич, доски; col — добавить столкновение
func _wall_piece(g: Node3D, along_x: bool, off: float, a: float, b: float, y0: float, y1: float, hb: float, tb: float, tp: float, col: bool) -> void:
	var c := (a + b) * 0.5
	var l := b - a
	var parts := [["concrete", 0.0, 0.25, tb + 0.06], ["brick", 0.25, hb, tb], ["planks", hb, 99.0, tp]]
	for pr in parts:
		var lo := maxf(float(pr[1]), y0)
		var hi := minf(float(pr[2]), y1)
		if hi - lo < 0.02:
			continue
		var t: float = pr[3]
		var sz := Vector3(l, hi - lo, t) if along_x else Vector3(t, hi - lo, l)
		var zoff := off - signf(off) * (tb - t) * 0.5 if String(pr[0]) == "planks" else off
		var p := Vector3(c, (lo + hi) * 0.5, zoff) if along_x else Vector3(zoff, (lo + hi) * 0.5, c)
		_bx(g, String(pr[0]), sz, _at(p))
	if col and y0 <= 0.01:
		var sz2 := Vector3(l, y1, tb) if along_x else Vector3(tb, y1, l)
		cols.append([sz2, transform * _at(Vector3(c, y1 * 0.5, off) if along_x else Vector3(off, y1 * 0.5, c))])


func _window(g: Node3D, along_x: bool, off: float, a: float, b: float, y0: float, y1: float) -> void:
	var c := (a + b) * 0.5
	var w := b - a
	var fr := 0.07
	for pr in [[Vector3(w, fr, 0.16), Vector3(c, y0, off)], [Vector3(w, fr, 0.16), Vector3(c, y1, off)],
			[Vector3(fr, y1 - y0, 0.16), Vector3(a, (y0 + y1) * 0.5, off)], [Vector3(fr, y1 - y0, 0.16), Vector3(b, (y0 + y1) * 0.5, off)],
			[Vector3(fr * 0.6, y1 - y0, 0.1), Vector3(c, (y0 + y1) * 0.5, off)]]:
		var sz: Vector3 = pr[0]
		var p: Vector3 = pr[1]
		if not along_x:
			sz = Vector3(sz.z, sz.y, sz.x)
			p = Vector3(p.z, p.y, p.x)
		_bx(g, "gate", sz, _at(p))
	# стёкла: одно целое (тёмное), второе выбито или с осколком
	var r := _rng.randf()
	for k in 2:
		if (k == 0 and r < 0.35) or (k == 1 and r < 0.75):
			continue
		var pc := Vector3(c + (k - 0.5) * w * 0.5, (y0 + y1) * 0.5, off)
		var gs := Vector3(w * 0.45, (y1 - y0) * (0.95 if k == 0 else 0.5), 0.02)
		if not along_x:
			gs = Vector3(gs.z, gs.y, gs.x)
			pc = Vector3(pc.z, pc.y if k == 0 else y0 + (y1 - y0) * 0.27, pc.x)
		elif k == 1:
			pc.y = y0 + (y1 - y0) * 0.27
		_bx(g, "glass", gs, _at(pc))


## ворота: перемычка, створки (одна распахнута, вторая прикрыта, висит криво или её нет)
func _gate(g: Node3D, along_x: bool, off: float, side: String, a: float, b: float, h: float) -> void:
	var w := b - a
	var c := (a + b) * 0.5
	_bx(g, "beam", Vector3(w + 0.4, 0.22, 0.24) if along_x else Vector3(0.24, 0.22, w + 0.4), _at(Vector3(c, h + 0.11, off) if along_x else Vector3(off, h + 0.11, c)))
	var out := signf(off)
	var leaves := 2 if w > 2.6 else 1
	var lw := w / leaves
	for k in leaves:
		var r := _rng.randf()
		if r < 0.18 and leaves == 2:
			continue                                    # створки нет — сорвана
		var hinge := a if k == 0 else b
		var open := _rng.randf_range(0.9, 1.7) if r < 0.65 else _rng.randf_range(0.05, 0.25)
		var dirk := 1.0 if k == 0 else -1.0
		# створка — доска lw×h, поворот вокруг петли наружу
		var ang := (-dirk * open * out) if along_x else (dirk * open * out)
		var hp := Vector3(hinge, h * 0.5, off + out * 0.08) if along_x else Vector3(off + out * 0.08, h * 0.5, hinge)
		var bas := Basis(Vector3.UP, ang if along_x else ang - PI * 0.5)
		var leaf_c := hp + bas * Vector3(dirk * lw * 0.5, 0, 0)
		if r > 0.92:
			bas = bas * Basis(Vector3.FORWARD, 0.12 * dirk)     # висит на одной петле
		_bx(g, "gate", Vector3(lw - 0.04, h - 0.1, 0.07), Transform3D(bas, leaf_c))
		# поперечины и раскос на створке
		for yy in [-0.38, 0.38]:
			_bx(g, "beam", Vector3(lw - 0.1, 0.12, 0.05), Transform3D(bas, leaf_c + bas * Vector3(0, yy * (h - 0.1), out * 0.06)))


## фронтон: треугольник досок над торцом от верха стены до конька
func _gable(g: Node3D, off: float, W: float, H: float) -> void:
	var ridge := H + W * 0.3
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var x := off
	var pts := [Vector3(x, H, -W * 0.5), Vector3(x, H, W * 0.5), Vector3(x, ridge, 0)]
	var nrm := Vector3(signf(off), 0, 0)
	for side in [1.0, -1.0]:
		var dx := Vector3(side * 0.06, 0, 0)
		var tri := [pts[0] + dx, pts[1] + dx, pts[2] + dx] if side * signf(off) > 0.0 else [pts[1] + dx, pts[0] + dx, pts[2] + dx]
		for p in tri:
			st.set_normal(nrm * side)
			st.set_uv(Vector2(p.z, -p.y))
			st.add_vertex(p)
	st.generate_tangents()
	var key := [g, "planks"]
	if not _st.has(key):
		var s2 := SurfaceTool.new()
		s2.begin(Mesh.PRIMITIVE_TRIANGLES)
		_st[key] = s2
	(_st[key] as SurfaceTool).append_from(st.commit(), 0, Transform3D.IDENTITY)


## пролом: стены нет, у края — куча кирпича и обломки досок
func _rubble(along_x: bool, off: float, side: String, a: float, b: float) -> void:
	var g := _group(side)
	for i in 26:
		var t := _rng.randf_range(a - 0.6, b + 0.6)
		var o := off + signf(off) * _rng.randf_range(-0.5, 1.6)
		var p := Vector3(t, _rng.randf_range(0.05, 0.25), o) if along_x else Vector3(o, _rng.randf_range(0.05, 0.25), t)
		_bx(g, "brick", Vector3(0.25, 0.08, 0.12), Transform3D(Basis.from_euler(Vector3(_rng.randf() * 0.6, _rng.randf() * TAU, _rng.randf() * 0.6)), p))
	for i in 4:
		var t2 := _rng.randf_range(a, b)
		var p2 := Vector3(t2, 0.08, off + signf(off) * _rng.randf_range(0.3, 1.4)) if along_x else Vector3(off + signf(off) * _rng.randf_range(0.3, 1.4), 0.08, t2)
		_bx(g, "planks", Vector3(_rng.randf_range(1.2, 2.2), 0.04, 0.16), Transform3D(Basis.from_euler(Vector3(0, _rng.randf() * PI, _rng.randf_range(-0.2, 0.2))), p2))


## Кровля: фермы через ~3 м (затяжка, две стропилины), конёк, листы профнастила внахлёст; часть листов выпала
## (дыры кучками), сквозь них видны фермы.
func _roof(L: float, W: float, H: float, ruin: float) -> void:
	var ridge := H + W * 0.3
	var span := Vector2(W * 0.5 + 0.5, ridge - H + 0.15).length()
	var slope := atan2(ridge - H + 0.15, W * 0.5 + 0.5)
	var n := int(ceil(L / 3.0))
	for i in n + 1:
		var x := -L * 0.5 + L * i / n
		_bx(roof, "beam", Vector3(0.14, 0.16, W), _at(Vector3(x, H, 0)))
		for s in [-1.0, 1.0]:
			var mid := Vector3(x, (H + ridge) * 0.5, s * W * 0.25)
			_bx(roof, "beam", Vector3(0.14, 0.14, Vector2(W * 0.5, ridge - H).length()), Transform3D(Basis(Vector3.RIGHT, s * atan2(ridge - H, W * 0.5)), mid))
	_bx(roof, "beam", Vector3(L, 0.16, 0.16), _at(Vector3(0, ridge, 0)))
	var sheets := int(ceil((L + 0.8) / 1.1))
	var hole_c := _rng.randf_range(0.0, 1.0)
	for s in [-1.0, 1.0]:
		for i in sheets:
			var u := float(i) / sheets
			var hole: bool = _rng.randf() < 0.02 + ruin * 0.08 or (absf(u - hole_c) < ruin * 0.12 and _rng.randf() < 0.6 and s > 0.0)
			if hole:
				continue
			var x := -L * 0.5 - 0.4 + (L + 0.8) * (i + 0.5) / sheets
			var mid := Vector3(x, (H + ridge) * 0.5 + 0.12, s * (W * 0.5 + 0.5) * 0.5)
			var tilt := _rng.randf_range(-0.03, 0.03)
			_bx(roof, "roof", Vector3((L + 0.8) / sheets + 0.08, 0.035, span), Transform3D(Basis(Vector3.RIGHT, s * slope) * Basis(Vector3.FORWARD, tilt), mid))
	_bx(roof, "rust", Vector3(L + 0.8, 0.08, 0.5), _at(Vector3(0, ridge + 0.18, 0)))


func _floor(L: float, W: float) -> void:
	_bx(rest, "floor", Vector3(L - 0.3, 0.06, W - 0.3), _at(Vector3(0, 0.03, 0)))


## стойла: по обе стороны прохода — перегородки из столбика и двух жердей, кормушки вдоль прохода, сено
func _stalls(L: float, W: float) -> void:
	var aisle := 1.8
	var depth := W * 0.5 - aisle - 0.5
	var side_doors := []
	for dr in def.doors:
		if String(dr[0]).begins_with("s"):
			side_doors.append([String(dr[0]), float(dr[1]), float(dr[2])])
	var x := -L * 0.5 + 3.5
	while x < L * 0.5 - 2.5:
		for s in [-1.0, 1.0]:
			var by_door := false
			for sd in side_doors:
				if (String(sd[0]) == "s+") == (s > 0.0) and absf(x - float(sd[1])) < float(sd[2]) * 0.5 + 1.4:
					by_door = true
			if by_door or _rng.randf() < 0.12:
				continue                                # у двери прохода нет, часть перегородок выломана
			var zc: float = s * (aisle + depth * 0.5)
			_bx(rest, "beam", Vector3(0.12, 1.3, 0.12), _at(Vector3(x, 0.65, s * aisle)))
			for yy in [0.55, 1.1]:
				_bx(rest, "gate", Vector3(0.07, 0.09, depth), _at(Vector3(x, yy, zc)))
			cols.append([Vector3(0.12, 1.2, depth), transform * _at(Vector3(x, 0.6, zc))])
			# кормушка у прохода — на часть стойла (в стойло можно зайти мимо неё)
			_bx(rest, "concrete", Vector3(1.4, 0.45, 0.45), _at(Vector3(x + 0.85, 0.22, s * (aisle + 0.25))))
			cols.append([Vector3(1.4, 0.45, 0.45), transform * _at(Vector3(x + 0.85, 0.22, s * (aisle + 0.25)))])
		x += 2.6
	for i in 4:
		var p := Vector3(_rng.randf_range(-L * 0.4, L * 0.4), 0.35, _rng.randf_range(-W * 0.4, W * 0.4))
		_bx(rest, "hay", Vector3(1.1, 0.6, 0.6), _at(p, _rng.randf() * PI))


func _tools(L: float, W: float) -> void:
	_bx(rest, "gate", Vector3(2.4, 0.08, 0.8), _at(Vector3(-L * 0.25, 0.9, -W * 0.5 + 0.6)))
	for lx in [-1.1, 1.1]:
		_bx(rest, "beam", Vector3(0.08, 0.9, 0.7), _at(Vector3(-L * 0.25 + lx, 0.45, -W * 0.5 + 0.6)))
	for k in 3:
		_bx(rest, "planks", Vector3(2.0, 0.05, 0.45), _at(Vector3(L * 0.2, 0.6 + k * 0.6, -W * 0.5 + 0.35)))
	cols.append([Vector3(2.4, 0.95, 0.8), transform * _at(Vector3(-L * 0.25, 0.47, -W * 0.5 + 0.6))])


func _fuel(L: float, W: float) -> void:
	for k in 6:
		_bx(rest, "rust", Vector3(0.6, 0.9, 0.6), _at(Vector3(-L * 0.3 + (k % 3) * 0.7, 0.45, -W * 0.5 + 0.6 + (k / 3) * 0.7)))
	cols.append([Vector3(2.2, 0.9, 1.4), transform * _at(Vector3(-L * 0.3 + 0.7, 0.45, -W * 0.5 + 0.95))])


func _feed(L: float, W: float) -> void:
	for k in 5:
		_bx(rest, "hay", Vector3(1.1, 0.5, 0.55), _at(Vector3(-L * 0.25 + (k % 3) * 1.15, 0.25 + (k / 3) * 0.5, -W * 0.5 + 0.5)))


func _commit() -> void:
	for key in _st:
		var g: Node3D = key[0]
		var mname: String = key[1]
		var mat: ShaderMaterial = _mats[mname]
		if g != rest:
			# растворяемые группы — свои копии материалов (растворяется только эта постройка)
			var k2 := str(g.get_instance_id()) + mname
			if not _own.has(k2):
				_own[k2] = mat.duplicate()
			mat = _own[k2]
		var mi := MeshInstance3D.new()
		mi.mesh = (_st[key] as SurfaceTool).commit()
		mi.material_override = mat
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if g == roof or g == rest else GeometryInstance3D.SHADOW_CASTING_SETTING_ON
		g.add_child(mi)
	_st.clear()


## герой внутри — крыша и ближняя стена растворяются (плавно, за ~0,3 с)
func set_inside(on: bool) -> void:
	_want = 1.0 if on else 0.0


func tick_fade(delta: float) -> void:
	if is_equal_approx(_fade, _want):
		return
	_fade = move_toward(_fade, _want, delta * 3.5)
	for k in _own:
		(_own[k] as ShaderMaterial).set_shader_parameter("fade", _fade)
	roof.visible = _fade < 0.999
	front.visible = _fade < 0.999


func fade_value() -> float:
	return _fade
