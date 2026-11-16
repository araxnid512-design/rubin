class_name BCCreatureFx
extends SkeletonModifier3D
## Генератор «живых мелочей» существа — то, чего нет в клипах Tripo (движения по описанию ведут только крупные
## кости: пальцы в них не участвуют) и чего нет в автоматическом скелете (челюсть, ротовые отростки). Работает
## поверх любой анимации, каждый кадр:
##   пальцы   — согнуты когтями (claw), подрагивают вразнобой (twitch); на замахе раскрываются (strike 0…1);
##   дыхание  — грудь ходит вперёд-назад (breath — размах, breath_hz — частота: на бегу чаще);
##   укус     — шея и голова подаются вперёд (bite 0…1, задаёт враг на ударе пастью);
##   отростки — вершины у пасти колышутся (шейдер; место пасти находится по сетке само, см. mouth_setup).
## Оси сгиба считаются из исходной позы самой модели (куда смотрит палец, где ладонь), поэтому генератор подходит
## к любому скелету Tripo, как бы ни были закручены его кости.

const FINGERS := ["Thumb", "Index", "Mid", "Ring", "Pinky"]
const MOUTH_SHADER := """shader_type spatial;
// Материал модели (цвет, нормали, шероховатость/металл из одной карты) + колыхание вершин у пасти: чем ниже от
// точки пасти, тем сильнее (отростки висят), вразнобой по месту вершины.
uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D rm_tex : hint_default_white, filter_linear_mipmap, repeat_enable;
uniform bool has_normal = false;
uniform bool has_rm = false;
uniform float rough = 0.8;
uniform float metal = 0.0;
uniform vec3 mouth = vec3(0.0, 100.0, 0.0);
uniform float radius = 0.07;
uniform float amp = 0.006;
void vertex() {
	float d = distance(VERTEX, mouth);
	float m = 1.0 - smoothstep(radius * 0.35, radius, d);
	float hang = smoothstep(-radius * 0.15, radius * 0.7, mouth.y - VERTEX.y);
	vec3 p = VERTEX * 90.0;
	vec3 off = vec3(sin(TIME * 2.3 + p.y * 1.7 + p.x), 0.35 * sin(TIME * 1.7 + p.x * 2.1), cos(TIME * 1.9 + p.y * 1.3 + p.z));
	VERTEX += off * amp * m * hang;
}
void fragment() {
	ALBEDO = texture(albedo_tex, UV).rgb;
	if (has_normal) { NORMAL_MAP = texture(normal_tex, UV).rgb; }
	vec3 rm = texture(rm_tex, UV).rgb;
	ROUGHNESS = has_rm ? rm.g : rough;
	METALLIC = has_rm ? rm.b : metal;
}"""

var claw := 0.5                   ## сгиб пальцев, рад на сустав
var twitch := 0.12                ## размах подрагивания, рад
var breath := 0.015               ## размах дыхания, рад
var breath_hz := 0.35
var strike := 0.0                 ## 0…1 — пальцы раскрыты для удара
var bite := 0.0                   ## 0…1 — голова подана вперёд
var mouth_mat: ShaderMaterial = null
var mouth_off := Vector3.ZERO     ## точка пасти в системе кости головы
var _fingers: Array = []          ## [кость, ось сгиба в системе кости, фаза, доля сгиба]
var _spine: Array = []            ## [кость, ось]
var _neck: Array = []
var _head := -1
var _done := false
static var _mouth_cache := {}     ## модель → точка пасти в системе кости головы


func _setup() -> void:
	_done = true
	var s := get_skeleton()
	if s == null:
		return
	var up := Vector3.UP
	var ls := s.find_bone("L_Upperarm")
	var rs := s.find_bone("R_Upperarm")
	var left := Vector3.RIGHT
	if ls >= 0 and rs >= 0:
		left = (s.get_bone_global_rest(ls).origin - s.get_bone_global_rest(rs).origin).normalized()
	var spine_p := s.get_bone_global_rest(maxi(s.find_bone("Spine02"), 0)).origin
	for side in ["L", "R"]:
		var hand := s.find_bone(side + "_Hand")
		var i1 := s.find_bone(side + "_Index1")
		var p1 := s.find_bone(side + "_Pinky1")
		if hand < 0 or i1 < 0 or p1 < 0:
			continue
		var hp := s.get_bone_global_rest(hand).origin
		# ладонь: плоскость по основаниям указательного и мизинца; смотрит вниз и к телу (так стоят кисти и при
		# руках в стороны, и при опущенных)
		var n := (s.get_bone_global_rest(i1).origin - hp).cross(s.get_bone_global_rest(p1).origin - hp).normalized()
		var inward := spine_p - hp
		inward.y = 0.0
		if n.dot(-up + inward.normalized() * 0.7) < 0.0:
			n = -n
		for f in FINGERS:
			var prev_d := Vector3.ZERO
			for j in [1, 2, 3]:
				var b := s.find_bone("%s_%s%d" % [side, f, j])
				if b < 0:
					continue
				var nb := s.find_bone("%s_%s%d" % [side, f, j + 1])
				var d := prev_d
				if nb >= 0:
					d = (s.get_bone_global_rest(nb).origin - s.get_bone_global_rest(b).origin).normalized()
				prev_d = d
				if d == Vector3.ZERO:
					continue
				var axis := d.cross(n)
				if axis.length() < 0.2:
					continue
				var local := (s.get_bone_global_rest(b).basis.orthonormalized().inverse() * axis.normalized()).normalized()
				var k: float = [0.7, 1.0, 0.8][j - 1] * (0.45 if f == "Thumb" else 1.0)
				_fingers.append([b, local, float(hash("%s%s" % [side, f]) % 628) * 0.01, k])
	for bn in ["Spine01", "Spine02"]:
		var b := s.find_bone(bn)
		if b >= 0:
			_spine.append([b, (s.get_bone_global_rest(b).basis.orthonormalized().inverse() * left).normalized()])
	for bn in ["NeckTwist01", "NeckTwist02", "Head"]:
		var b := s.find_bone(bn)
		if b >= 0:
			_neck.append([b, (s.get_bone_global_rest(b).basis.orthonormalized().inverse() * left).normalized()])
	_head = s.find_bone("Head")


func _process_modification() -> void:
	if not _done:
		_setup()
	var s := get_skeleton()
	if s == null:
		return
	var t := Time.get_ticks_msec() * 0.001
	for f in _fingers:
		var ph: float = f[2]
		var a := (claw * (1.0 - 0.8 * strike) + twitch * sin(t * 1.7 + ph) * sin(t * 0.63 + ph * 2.0)) * float(f[3])
		s.set_bone_pose_rotation(f[0], s.get_bone_pose_rotation(f[0]) * Quaternion(f[1], a))
	if breath > 0.0:
		var w := sin(t * TAU * breath_hz) * breath
		for i in _spine.size():
			var sp: Array = _spine[i]
			s.set_bone_pose_rotation(sp[0], s.get_bone_pose_rotation(sp[0]) * Quaternion(sp[1], w if i == 1 else -w * 0.5))
	if bite > 0.001:
		for nk in _neck:
			s.set_bone_pose_rotation(nk[0], s.get_bone_pose_rotation(nk[0]) * Quaternion(nk[1], bite * 0.2))
	if mouth_mat != null and _head >= 0:
		mouth_mat.set_shader_parameter("mouth", s.get_bone_global_pose(_head) * mouth_off)


## Отростки у пасти: материал модели заменяется шейдером с колыханием вершин вокруг точки пасти. Точка находится
## по сетке: самые выступающие вперёд вершины, привязанные к голове (у Лоторейщика это и есть отростки).
## fwd — «вперёд» модели в системе скелета; cfg — {"r": радиус, ед. модели, "amp": размах}
func mouth_setup(model: Node3D, key: String, fwd: Vector3, cfg: Dictionary) -> void:
	var s := get_skeleton()
	var head := s.find_bone("Head")
	var mi: MeshInstance3D = null
	for c in model.find_children("*", "MeshInstance3D", true, false):
		if (c as MeshInstance3D).skin != null:
			mi = c
			break
	if head < 0 or mi == null or mi.mesh == null:
		return
	if not _mouth_cache.has(key):
		var arr := mi.mesh.surface_get_arrays(0)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var bones: PackedInt32Array = arr[Mesh.ARRAY_BONES]
		var ws: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
		var per := bones.size() / maxi(vs.size(), 1)
		# какие «привязки» сетки — кости головы
		var heads := {}
		for bi in mi.skin.get_bind_count():
			var bn := String(mi.skin.get_bind_name(bi))
			if bn == "":
				bn = s.get_bone_name(mi.skin.get_bind_bone(bi))
			if bn == "Head" or bn == "FacialBone":
				heads[bi] = true
		var pts: Array = []
		var far := -1e9
		for vi in vs.size():
			var w := 0.0
			for k in per:
				if heads.has(bones[vi * per + k]):
					w += ws[vi * per + k]
			if w > 0.6:
				pts.append(vs[vi])
				far = maxf(far, vs[vi].dot(fwd))
		var c := Vector3.ZERO
		var n := 0
		for p in pts:
			if (p as Vector3).dot(fwd) > far - float(cfg.get("r", 0.07)) * 0.45:
				c += p
				n += 1
		_mouth_cache[key] = s.get_bone_global_rest(head).affine_inverse() * (c / n) if n > 0 else Vector3.ZERO
	mouth_off = _mouth_cache[key]
	var src := mi.mesh.surface_get_material(0) as StandardMaterial3D
	if src == null:
		return
	var sh := Shader.new()
	sh.code = MOUTH_SHADER
	mouth_mat = ShaderMaterial.new()
	mouth_mat.shader = sh
	mouth_mat.set_shader_parameter("albedo_tex", src.albedo_texture)
	mouth_mat.set_shader_parameter("has_normal", src.normal_enabled and src.normal_texture != null)
	mouth_mat.set_shader_parameter("normal_tex", src.normal_texture)
	mouth_mat.set_shader_parameter("has_rm", src.roughness_texture != null)
	mouth_mat.set_shader_parameter("rm_tex", src.roughness_texture)
	mouth_mat.set_shader_parameter("rough", src.roughness)
	mouth_mat.set_shader_parameter("metal", src.metallic)
	mouth_mat.set_shader_parameter("radius", float(cfg.get("r", 0.07)))
	mouth_mat.set_shader_parameter("amp", float(cfg.get("amp", 0.006)))
	mi.set_surface_override_material(0, mouth_mat)
