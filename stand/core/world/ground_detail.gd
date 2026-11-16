class_name ULGroundDetail
extends RefCounted
## Мелочи на земле — общие для базы и коровника: пучки полевых цветов в траве (ромашка, лютик, колокольчик,
## клевер — свои рисованные картинки, stand/tools/draw_flowers.py) и лужи в грязи (тёмная вода с бликом и мелкой
## рябью, край неровный). Где ставить — решает карта земли: mask(p) → Color (R — трава, G — тропа, B — подстилка).
## Всё одной сеткой на вид (MultiMesh), дальше дальности прорисовки не рисуется.

const TEX := "res://assets/world/tex/"
const FLOWERS := ["daisy", "buttercup", "bell", "clover"]
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
	ALBEDO = mix(vec3(0.16, 0.14, 0.11), vec3(0.09, 0.09, 0.08), smoothstep(0.2, 0.7, 1.0 - r));
	ROUGHNESS = 0.06;
	SPECULAR = 0.8;
	ALPHA = a * 0.88;
}"""


## пучок: пять наклонных полос (как пучок травы), картинка цветов на каждой
static func _tuft_mesh(tex: Texture2D, shader_code: String) -> ArrayMesh:
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	for i in 5:
		var a := TAU * i / 5.0 + 0.2
		var o := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-o.z, 0, o.x) * 0.16
		var top := o * 0.16 + Vector3.UP * 0.42
		var v := [-side, side, side * 1.2 + top, -side * 1.2 + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[k])
			st.add_vertex(v[k])
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = shader_code
	mat.shader = sh
	mat.set_shader_parameter("tex", tex)
	mat.set_shader_parameter("sway", 0.05)
	mesh.surface_set_material(0, mat)
	return mesh


## Цветы куртинами: count куртин по 4–10 пучков, только на траве (R > 0.6, вне троп и подстилки).
## avoid(p) → true — сюда нельзя (дом, двор, коровник).
static func flowers(parent: Node3D, mask: Callable, size: float, seed_n: int, count: int, tuft_shader: String, avoid: Callable, range_m: float) -> int:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var by_kind := {}
	for k in FLOWERS:
		by_kind[k] = [] as Array[Transform3D]
	var half := size * 0.5 - 3.0
	var placed := 0
	for c in count:
		var center := Vector3(rng.randf_range(-half, half), 0, rng.randf_range(-half, half))
		var m: Color = mask.call(center)
		if m.r < 0.6 or m.g > 0.2 or m.b > 0.3 or avoid.call(center):
			continue
		var kind: String = FLOWERS[rng.randi() % FLOWERS.size()]
		for i in rng.randi_range(4, 10):
			var p := center + Vector3(rng.randf_range(-1.6, 1.6), 0, rng.randf_range(-1.6, 1.6))
			if (mask.call(p) as Color).r < 0.45:
				continue
			var sc := rng.randf_range(0.7, 1.15)
			(by_kind[kind] as Array).append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sc, sc * rng.randf_range(0.85, 1.2), sc)), p))
			placed += 1
	for k in FLOWERS:
		var xs: Array = by_kind[k]
		if xs.is_empty():
			continue
		var mm := MultiMesh.new()
		mm.transform_format = MultiMesh.TRANSFORM_3D
		mm.mesh = _tuft_mesh(load(TEX + "flower_%s.png" % k), tuft_shader)
		mm.instance_count = xs.size()
		for i in xs.size():
			mm.set_instance_transform(i, xs[i])
		var mi := MultiMeshInstance3D.new()
		mi.multimesh = mm
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.visibility_range_end = range_m
		parent.add_child(mi)
	return placed


## Лужи: count попыток, только на голой земле (мало травы, не тропа, не подстилка); near(p) → true — рядом с
## местом, где лужам быть (у ворот, в загоне). Возвращает их точки.
static func puddles(parent: Node3D, mask: Callable, size: float, seed_n: int, count: int, noise: Texture2D, near: Callable) -> Array[Vector3]:
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
		var m: Color = mask.call(p)
		if m.r > 0.25 or m.g > 0.3 or m.b > 0.3 or not near.call(p):
			continue
		var close := false
		for q in pts:
			if q.distance_to(p) < 3.0:
				close = true
				break
		if close:
			continue
		var sx := rng.randf_range(1.2, 3.2)
		xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(sx, 1.0, sx * rng.randf_range(0.5, 0.9))), p + Vector3.UP * 0.012))
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
