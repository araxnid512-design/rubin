class_name ULVegetation
extends RefCounted
## Растительность на земле: пучки злаков, сорняков, крапивы, одуванчиков и цветущего щавеля. Картинки пучков —
## спрайты, снятые с моделей Poly Haven (CC0; stand/tools/impostor.gd → tools/veg_src/veg_atlas.py), по две ячейки
## в атласе. Пучок — четыре наклонные полосы крест-накрест (сверху читается как куст, сбоку — как трава), все пучки
## одного вида на участке 15×15 м — одна сетка (MultiMesh) с цветом и ячейкой на экземпляр; дальше дальности
## прорисовки не рисуются. Цвет — от приглушённо-зелёного до выгоревшего жёлтого, высота и густота — разные.

const TEX := "res://assets/world/tex/"
const SHADER := """shader_type spatial;
render_mode cull_disabled;
// Пучок растений: ячейка атласа (INSTANCE_CUSTOM.r: 0 или 1), цвет экземпляра, вырез по альфе, верх качается от
// ветра, низ темнее (тень в гуще травы); нормаль — вверх (сверху пучок освещён ровно, без чёрной изнанки).
uniform sampler2D tex : source_color, filter_linear_mipmap, repeat_disable;
uniform float sway = 0.05;
// вырез земли над погребом (хутор): там, где земля скрыта, трава тоже не рисуется
uniform vec4 cut_rect = vec4(0.0);
uniform float cut_on = 0.0;
//#WIND
varying float cell;
varying vec3 tint;
varying vec2 wxz;
void vertex() {
	cell = INSTANCE_CUSTOM.r;
	tint = COLOR.rgb;
	vec3 wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wxz = wpos.xz;
	// ветер: общий порыв (волна по полю) по направлению ветра + мелкая дрожь; верх пучка, низ стоит
	float top = 1.0 - UV.y;
	float g = wind_gust(wpos.xz);
	vec3 off = vec3(wind.x, 0.0, wind.y) * g * 2.2 + vec3(0.6, 0.0, 0.4) * wind_flutter(wpos.xz) * 0.35;
	float s2 = max(dot(MODEL_MATRIX[0].xyz, MODEL_MATRIX[0].xyz), 0.0001);
	VERTEX += (vec4(off * sway * top, 0.0) * MODEL_MATRIX).xyz / s2;
}
void fragment() {
	vec4 c = texture(tex, vec2(UV.x * 0.5 + cell * 0.5, UV.y));
	if (c.a < 0.45) { discard; }
	if (cut_on > 0.5 && wxz.x > cut_rect.x && wxz.x < cut_rect.z && wxz.y > cut_rect.y && wxz.y < cut_rect.w) { discard; }
	float ao = mix(0.55, 1.0, smoothstep(1.0, 0.45, UV.y));
	// обе стороны полосы освещены как земля: у обратной стороны Godot переворачивает нормаль — без этого она чёрная
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ALBEDO = c.rgb * tint * ao;
	ROUGHNESS = 0.95;
	SPECULAR = 0.15;
}"""

static var _meshes := {}
static var _mats := {}


## пучок: четыре полосы шириной w и высотой h, наклонены наружу (верх отходит на lean)
static func clump_mesh(kind: String) -> ArrayMesh:
	if _meshes.has(kind):
		return _meshes[kind]
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var lean := 0.38
	for i in 4:
		var a := TAU * i / 4.0 + 0.4
		var o := Vector3(cos(a), 0, sin(a))
		var side := Vector3(-o.z, 0, o.x) * 0.5
		var top := o * lean + Vector3.UP
		var v := [-side, side, side + top, -side + top]
		var uv := [Vector2(0, 1), Vector2(1, 1), Vector2(1, 0), Vector2(0, 0)]
		for k in [0, 1, 2, 0, 2, 3]:
			st.set_uv(uv[k])
			st.set_normal(Vector3.UP)
			st.add_vertex(v[k])
	var mesh := st.commit()
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SHADER.replace("//#WIND", ULSunShadow.WIND)
	mat.shader = sh
	mat.set_shader_parameter("tex", load(TEX + "veg_%s.png" % kind))
	mat.set_shader_parameter("sway", 0.03 if kind == "nettle" else 0.05)
	mesh.surface_set_material(0, mat)
	_meshes[kind] = mesh
	return mesh


## вырез над погребом: трава в прямоугольнике (x0, z0, x1, z1) не рисуется, пока on
static func set_cut(rect: Vector4, on: bool) -> void:
	for k in _meshes:
		var m := (_meshes[k] as ArrayMesh).surface_get_material(0) as ShaderMaterial
		m.set_shader_parameter("cut_rect", rect)
		m.set_shader_parameter("cut_on", 1.0 if on else 0.0)


## Рассыпать пучки вида kind по квадрату size×size с центром в 0. density — пучков на м² там, где вес 1;
## weight(p) → 0…1 — где расти (0 — нигде); tint(p, rng) → цвет; size_h — [высота от, до]; size_w — ширина к
## высоте. Участки по cell м — отдельные сетки. Возвращает число пучков.
## доля пучков по видам: мелкие пучки травы по всему полю убраны (их заменяет трава на текстуре земли — дешевле
## и не рябит), сорняки у стен и крапива у заборов — реже; цветы как были
const KIND_K := {"grass": 0.0, "weed": 0.5, "nettle": 0.6, "flower": 1.0}


static func scatter(parent: Node3D, kind: String, size: float, density: float, weight: Callable, tint: Callable, size_h: Vector2, size_w: float, seed_n: int, range_m: float, cell := 15.0) -> int:
	density *= float(KIND_K.get(kind, 1.0))
	if density <= 0.0:
		return 0
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_n
	var n := int(ceil(size / cell))
	var total := 0
	var mesh := clump_mesh(kind)
	for cx in n:
		for cz in n:
			var xs: Array[Transform3D] = []
			var cs: Array[Color] = []
			var cells: Array[float] = []
			var tries := int(cell * cell * density * 1.6)
			for k in tries:
				var p := Vector3(-size * 0.5 + (cx + rng.randf()) * cell, 0, -size * 0.5 + (cz + rng.randf()) * cell)
				var wv: float = weight.call(p)
				if wv <= 0.0 or rng.randf() > wv / 1.6:
					continue
				var h := rng.randf_range(size_h.x, size_h.y)
				var wd := h * size_w * rng.randf_range(0.85, 1.2)
				xs.append(Transform3D(Basis(Vector3.UP, rng.randf() * TAU).scaled(Vector3(wd, h, wd)), p))
				cs.append(tint.call(p, rng))
				cells.append(0.0 if rng.randf() < 0.5 else 1.0)
			if xs.is_empty():
				continue
			var mm := MultiMesh.new()
			mm.transform_format = MultiMesh.TRANSFORM_3D
			mm.use_colors = true
			mm.use_custom_data = true
			mm.mesh = mesh
			mm.instance_count = xs.size()
			for i in xs.size():
				mm.set_instance_transform(i, xs[i])
				mm.set_instance_color(i, cs[i])
				mm.set_instance_custom_data(i, Color(cells[i], 0, 0, 0))
			var mi := MultiMeshInstance3D.new()
			mi.multimesh = mm
			mi.set_meta("veg", kind)                   # для замера: трава, бурьян, крапива
			mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
			mi.visibility_range_end = range_m
			mi.visibility_range_end_margin = 4.0
			mi.visibility_range_fade_mode = GeometryInstance3D.VISIBILITY_RANGE_FADE_SELF
			parent.add_child(mi)
			total += xs.size()
	return total


## цвет злаков: приглушённо-зелёный, местами (по крупному пятну dry 0…1) — выгоревший жёлтый
static func grass_tint(dry: float, rng: RandomNumberGenerator) -> Color:
	var green := Color(0.78, 0.95, 0.62)
	var yellow := Color(1.12, 1.0, 0.68)
	var c := green.lerp(yellow, clampf(dry + rng.randf_range(-0.25, 0.25), 0.0, 1.0))
	var v := rng.randf_range(0.82, 1.08)
	return Color(c.r * v, c.g * v, c.b * v)
