class_name ULGroundDetail
extends RefCounted
## Мелочи на земле: лужи (мутная вода с отсветом неба и мелкой рябью, край неровный), колеи по дорогам (две
## продавленные колёсами полосы сырой грязи, местами в них стоит вода) и пятна гравия у ворот. Где ставить —
## решает локация (по своей карте земли). Всё одной сеткой на вид.

const TEX := "res://assets/world/tex/"
const PUDDLE_SHADER := """shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back;
// Лужа: тёмная вода с бликом неба и солнца, мелкая рябь (два слоя шума плывут), край неровный и мягкий.
uniform sampler2D noise : filter_linear, repeat_enable;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 c = UV - 0.5;
	float n = texture(noise, wp.xz / 2.3).r;
	float r = length(c) * 2.0 + (n - 0.5) * 0.55;
	float a = 1.0 - smoothstep(0.62, 0.95, r);
	if (a < 0.01) { discard; }
	float r1 = texture(noise, wp.xz / 0.9 + TIME * vec2(0.03, 0.02)).r;
	float r2 = texture(noise, wp.xz / 0.7 - TIME * vec2(0.02, 0.035)).r;
	NORMAL_MAP = normalize(vec3(0.5 + (r1 - r2) * 0.35, 0.5 + (r2 - 0.5) * 0.35, 1.0));
	// мутная вода: тёмная к середине, по ряби — отблеск неба
	vec3 water = mix(vec3(0.2, 0.18, 0.15), vec3(0.1, 0.105, 0.1), smoothstep(0.2, 0.7, 1.0 - r));
	// сверху под углом камеры в луже отражается пасмурное небо: серо-голубой отсвет, по ряби — светлее
	ALBEDO = mix(water, vec3(0.3, 0.32, 0.33), 0.2 + (r1 - r2) * 0.3);
	// блик солнца — пятнами по ряби, а не на всю лужу (иначе под камерой сверху лужа белеет целиком)
	ROUGHNESS = 0.3 + (r1 - 0.5) * 0.2;
	SPECULAR = 0.28;
	ALPHA = a * 0.9;
}"""


## Лужи: count попыток; ok(p) → true — здесь луже быть (решает локация: голая земля, колея, загон).
## Возвращает их точки.
static func puddles(parent: Node3D, ok: Callable, size: float, seed_n: int, count: int, noise: Texture2D) -> Array[Vector3]:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = PUDDLE_SHADER
	mat.shader = sh
	mat.set_shader_parameter("noise", noise)
	var quad := PlaneMesh.new()
	quad.size = Vector2(1, 1)
	quad.material = mat
	var xs: Array[Transform3D] = []
	var pts: Array[Vector3] = []
	var half := size * 0.5 - 4.0
	for c in count:
		var p := Vector3(rng.randf_range(-half, half), 0, rng.randf_range(-half, half))
		if not ok.call(p):
			continue
		var close := false
		for q in pts:
			if q.distance_to(p) < 3.0:
				close = true
				break
		if close:
			continue
		var sx := rng.randf_range(1.0, 2.8)
		xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sx, 1.0, sx * rng.randf_range(0.5, 0.9))), p + Vector3.UP * 0.06))
		pts.append(p)
	if xs.is_empty():
		return pts
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = xs.size()
	for i in xs.size():
		mm.set_instance_transform(i, xs[i])
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return pts


const RUT_SHADER := """shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back;
// Колеи: полоса вдоль дороги (UV.x — поперёк, −1…1 = ±half_w м; UV.y — вдоль, в метрах). Две продавленные полосы
// от колёс (колея 1,6 м, чуть виляет), сырая тёмная грязь с рисунком протектора, на дне местами вода с бликом
// неба. Колея то глубже, то почти пропадает (шум); на концах дороги сходит на нет (COLOR.a).
uniform sampler2D noise : filter_linear, repeat_enable;
uniform sampler2D mud : source_color, filter_linear_mipmap, repeat_enable;
uniform float half_w = 1.8;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
float track(float x, float wob, float n2) {
	float d = min(abs(x - 0.8 - wob), abs(x + 0.8 - wob));
	return 1.0 - smoothstep(0.1, 0.26 + n2 * 0.1, d);
}
void fragment() {
	float x = UV.x * half_w;
	float n = texture(noise, wp.xz / 7.0).r;
	float n2 = texture(noise, wp.xz / 1.1 + vec2(0.3, 0.7)).r;
	float wob = (texture(noise, vec2(UV.y / 31.0, 0.37)).r - 0.5) * 0.6;
	float t = track(x, wob, n2);
	float deep = mix(0.45, 1.0, smoothstep(0.3, 0.55, n)) * COLOR.a;
	float a = t * deep;
	// мокрая грязь вокруг колеи (выдавлена колёсами) — тонким ореолом
	float d0 = min(abs(x - 0.8 - wob), abs(x + 0.8 - wob));
	float rim = (1.0 - smoothstep(0.2, 0.55, d0)) * 0.35;
	a = max(a, rim * deep);
	if (a < 0.02) { discard; }
	vec3 m = texture(mud, wp.xz / 1.8).rgb * mix(vec3(0.95, 0.88, 0.8), vec3(0.72, 0.66, 0.6), t);
	float water = smoothstep(0.64, 0.76, n * 0.55 + n2 * 0.45) * t * smoothstep(0.7, 0.95, deep);
	ALBEDO = mix(m, vec3(0.12, 0.125, 0.12), water * 0.75);
	// дно колеи темнее к середине, по краю — выдавленный валик светлее
	ALBEDO *= mix(1.0, 0.82, t) * mix(1.0, 1.08, rim * (1.0 - t));
	ROUGHNESS = mix(0.72, 0.14, water);
	SPECULAR = mix(0.3, 0.38, water);
	ALPHA = clamp(a * 0.8, 0.0, 1.0);
}"""


## Колеи по дорогам: roads — ломаные (точки Vector2 на плоскости x, z); полоса шириной 2·half_w м чуть над землёй.
static func ruts(parent: Node3D, roads: Array, noise: Texture2D, mud: String, half_w := 1.8) -> MeshInstance3D:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for r in roads:
		var pts: Array[Vector2] = []
		for i in r.size() - 1:
			var a: Vector2 = r[i]
			var b: Vector2 = r[i + 1]
			var n := maxi(1, int(ceil(a.distance_to(b) / 1.2)))
			for k in n:
				pts.append(a.lerp(b, float(k) / n))
		pts.append(r[r.size() - 1])
		var along := 0.0
		var total := 0.0
		for i in pts.size() - 1:
			total += pts[i].distance_to(pts[i + 1])
		var prev_l := Vector3.ZERO
		var prev_r := Vector3.ZERO
		var prev_v := 0.0
		var prev_a := 0.0
		for i in pts.size():
			var dir := (pts[mini(i + 1, pts.size() - 1)] - pts[maxi(i - 1, 0)]).normalized()
			var side := Vector2(-dir.y, dir.x) * half_w
			if i > 0:
				along += pts[i].distance_to(pts[i - 1])
			var c := Vector3(pts[i].x, 0.045, pts[i].y)
			var l := c + Vector3(side.x, 0, side.y)
			var rr := c - Vector3(side.x, 0, side.y)
			var fa := minf(smoothstep(0.0, 6.0, along), smoothstep(0.0, 6.0, total - along))
			if i > 0:
				for q in [[prev_l, -1.0, prev_v, prev_a], [prev_r, 1.0, prev_v, prev_a], [rr, 1.0, along, fa], [prev_l, -1.0, prev_v, prev_a], [rr, 1.0, along, fa], [l, -1.0, along, fa]]:
					st.set_color(Color(1, 1, 1, float(q[3])))
					st.set_uv(Vector2(float(q[1]), float(q[2])))
					st.set_normal(Vector3.UP)
					st.add_vertex(q[0])
			prev_l = l
			prev_r = rr
			prev_v = along
			prev_a = fa
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = RUT_SHADER
	mat.shader = sh
	mat.set_shader_parameter("noise", noise)
	mat.set_shader_parameter("mud", load(TEX + mud + "_c.jpg"))
	mat.set_shader_parameter("half_w", half_w)
	var mi := MeshInstance3D.new()
	mi.mesh = mesh
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
	return mi


const PATCH_SHADER := """shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_back;
// Пятно гравия (щебень, битый кирпич) у ворот и у стен: край неровный, по краю гравий редеет в землю.
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise : filter_linear, repeat_enable;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 c = UV - 0.5;
	float n = texture(noise, wp.xz / 1.7).r;
	float r = length(c) * 2.0 + (n - 0.5) * 0.7;
	float a = 1.0 - smoothstep(0.45, 0.95, r);
	vec3 g = texture(tex, wp.xz / 1.6).rgb;
	a *= smoothstep(0.18, 0.4, dot(g, vec3(0.33)) + (1.0 - r) * 0.3);
	if (a < 0.02) { discard; }
	ALBEDO = g * vec3(0.42, 0.4, 0.36);
	ROUGHNESS = 0.92;
	ALPHA = a * 0.85;
}"""


## Пятна гравия: spots — [точка Vector3, радиус]; tex — текстура (Poly Haven, CC0)
static func patches(parent: Node3D, spots: Array, tex: String, noise: Texture2D) -> void:
	if spots.is_empty():
		return
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = PATCH_SHADER
	mat.shader = sh
	mat.set_shader_parameter("tex", load(TEX + tex + "_c.jpg"))
	mat.set_shader_parameter("noise", noise)
	var quad := PlaneMesh.new()
	quad.size = Vector2(2, 2)
	quad.material = mat
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = quad
	mm.instance_count = spots.size()
	for i in spots.size():
		var p: Vector3 = spots[i][0]
		var r: float = spots[i][1]
		mm.set_instance_transform(i, Transform3D(Basis(Vector3.UP, float(i) * 1.7).scaled(Vector3(r, 1.0, r * 0.8)), p + Vector3.UP * 0.03))
	var mi := MultiMeshInstance3D.new()
	mi.multimesh = mm
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	parent.add_child(mi)
