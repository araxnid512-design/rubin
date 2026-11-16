class_name ULCanopy
extends RefCounted
## Кроны деревьев не прячут героя. Дерево, которое на экране закрывает героя (стоит ближе к камере и его крона
## накрывает героя на картинке), плавно растворяется — точечным узором (dither), без прозрачности: на телефоне это
## так же дёшево, как обычная непрозрачная модель. Отошёл — дерево проявляется. Столкновение со стволом остаётся.
## Деревья-модели (Tripo) получают свой материал с растворением; ели одной сеткой (MultiMesh) растворяются по
## экземплярам (custom data). Проверка — 10 раз в секунду и только для деревьев ближе 14 м.

const SHADER := """shader_type spatial;
// Материал дерева-модели (цвет, нормали, шероховатость/металл из одной карты) + растворение точками: fade 0…1.
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D rm_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform vec4 albedo_col : source_color = vec4(1.0);
uniform bool has_normal = false;
uniform bool has_rm = false;
uniform float rough = 0.85;
uniform float metal = 0.0;
uniform float alpha_cut = 0.0;
uniform float fade = 0.0;
void fragment() {
	vec4 c = texture(albedo_tex, UV) * albedo_col;
	if (alpha_cut > 0.0 && c.a < alpha_cut) { discard; }
	if (fade > 0.001) {
		float d = fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715))));
		if (d < fade) { discard; }
	}
	ALBEDO = c.rgb;
	if (has_normal) { NORMAL_MAP = texture(normal_tex, UV).rgb; }
	vec3 rm = texture(rm_tex, UV).rgb;
	ROUGHNESS = has_rm ? rm.g : rough;
	METALLIC = has_rm ? rm.b : metal;
}"""
const FADE := 0.8                 ## насколько растворяется закрывающее дерево (остаются редкие точки — видно, где оно)
const NEAR := 14.0

## дерево: {pos, top (высота центра кроны), r (радиус кроны), mats (материалы модели) или mm+i (ель в сетке), f, want}
var trees: Array = []
var _shader: Shader
var _base := {}                   ## исходный материал → материал с растворением (общий образец)
var _t := 0.0
var _moving: Array = []           ## деревья, у которых сейчас меняется прозрачность


## дерево-модель: материалы заменяются на материал с растворением (у каждого дерева свои — растворяется только оно)
func add_model(node: Node3D, h: float) -> void:
	if _shader == null:
		_shader = Shader.new()
		_shader.code = SHADER
	var mats: Array = []
	for m in node.find_children("*", "MeshInstance3D", true, false):
		var mi := m as MeshInstance3D
		if mi.mesh == null:
			continue
		for s in mi.mesh.get_surface_count():
			var src := mi.get_active_material(s)
			var sm := _fade_mat(src)
			if sm == null:
				continue
			mi.set_surface_override_material(s, sm)
			mats.append(sm)
	var bb := AABB()
	var first := true
	for m in node.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = (m as MeshInstance3D).get_aabb()
		bb = a if first else bb.merge(a)
		first = false
	var r := maxf(bb.size.x, bb.size.z) * node.scale.x * 0.5 if not first else h * 0.3
	trees.append({"pos": node.global_position, "top": h * 0.62, "r": clampf(r, 0.6, 3.5), "mats": mats, "f": 0.0, "want": 0.0})


func _fade_mat(src: Material) -> ShaderMaterial:
	if src == null or src is ShaderMaterial:
		return null
	var key = src
	if not _base.has(key):
		var sm := ShaderMaterial.new()
		sm.shader = _shader
		var st := src as StandardMaterial3D
		if st:
			sm.set_shader_parameter("albedo_tex", st.albedo_texture)
			sm.set_shader_parameter("albedo_col", st.albedo_color)
			sm.set_shader_parameter("has_normal", st.normal_enabled and st.normal_texture != null)
			sm.set_shader_parameter("normal_tex", st.normal_texture)
			sm.set_shader_parameter("has_rm", st.roughness_texture != null)
			sm.set_shader_parameter("rm_tex", st.roughness_texture)
			sm.set_shader_parameter("rough", st.roughness)
			sm.set_shader_parameter("metal", st.metallic)
			if st.transparency == BaseMaterial3D.TRANSPARENCY_ALPHA_SCISSOR:
				sm.set_shader_parameter("alpha_cut", st.alpha_scissor_threshold)
		_base[key] = sm
	return (_base[key] as ShaderMaterial).duplicate()


## ели одной сеткой: у сетки должен быть включён use_custom_data (custom.r — растворение)
func add_multimesh(mm: MultiMesh, h: float) -> void:
	for i in mm.instance_count:
		var xf := mm.get_instance_transform(i)
		var sc := xf.basis.get_scale().x
		trees.append({"pos": xf.origin, "top": h * sc * 0.55, "r": h * sc * 0.3, "mm": mm, "i": i, "f": 0.0, "want": 0.0})


## Кадр. cam — камера локации; hero — точка героя (по грудь). Раз в 0,1 с решает, какие деревья закрывают героя;
## каждый кадр плавно доводит прозрачность у тех, что меняются.
func tick(cam: Camera3D, hero: Vector3, delta: float) -> void:
	_t -= delta
	if _t <= 0.0:
		_t = 0.1
		var hs := cam.unproject_position(hero + Vector3.UP * 1.1)
		var hd := cam.global_position.distance_to(hero)
		var right := cam.global_transform.basis.x
		for t in trees:
			var p: Vector3 = t.pos
			var want := 0.0
			if Vector2(p.x - hero.x, p.z - hero.z).length() < NEAR:
				var c: Vector3 = p + Vector3.UP * float(t.top)
				if cam.global_position.distance_to(c) < hd + 0.5:
					var cs := cam.unproject_position(c)
					var rs := cs.distance_to(cam.unproject_position(c + right * float(t.r)))
					if cs.distance_to(hs) < rs * 1.05 + 18.0:
						want = FADE
			if want != float(t.want):
				t.want = want
				if not _moving.has(t):
					_moving.append(t)
	for k in range(_moving.size() - 1, -1, -1):
		var t: Dictionary = _moving[k]
		t.f = move_toward(float(t.f), float(t.want), delta * 3.5)
		_apply(t)
		if is_equal_approx(float(t.f), float(t.want)):
			_moving.remove_at(k)


func _apply(t: Dictionary) -> void:
	if t.has("mm"):
		(t.mm as MultiMesh).set_instance_custom_data(int(t.i), Color(float(t.f), 0, 0, 0))
	else:
		for m in t.mats:
			(m as ShaderMaterial).set_shader_parameter("fade", float(t.f))


## сколько деревьев сейчас растворено (для проверок)
func faded() -> int:
	var n := 0
	for t in trees:
		if float(t.f) > 0.3:
			n += 1
	return n
