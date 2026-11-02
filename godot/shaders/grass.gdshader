// Трава и бурьян (MultiMesh из образца травы браузерной игры): оттенок у каждого экземпляра (зелёная, сухая,
// рыжая), темнее у корня, нормаль — как у земли (кустик не темнеет боком к солнцу), качание на ветру,
// альфа-срез. Дальше fade_range от камеры кустики сжимаются в точку — дальность видимости по экземплярам
// (на низком качестве меньше: меньше закрашивать пикселей).
shader_type spatial;
render_mode cull_disabled;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap;
uniform float alpha_cut = 0.5;
uniform float sway = 0.07;
uniform float sway_h = 0.45;
uniform float fade_range = 40.0;

varying float vy;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	vy = clamp(VERTEX.y / sway_h, 0.0, 1.0);
	float k = vy * vy;
	VERTEX.x += sin(TIME * 1.6 + o.x * 0.35 + o.z * 0.21) * sway * k;
	VERTEX.z += cos(TIME * 1.15 + o.z * 0.31 + o.x * 0.17) * sway * 0.7 * k;
	float d = length(o - CAMERA_POSITION_WORLD);
	VERTEX *= 1.0 - smoothstep(fade_range - 4.0, fade_range, d);
}

void fragment() {
	vec4 t = texture(albedo_tex, UV);
	ALBEDO = t.rgb * COLOR.rgb * mix(0.55, 1.0, vy);
	ALPHA = t.a;
	ALPHA_SCISSOR_THRESHOLD = alpha_cut;
	NORMAL = normalize((VIEW_MATRIX * vec4(0.0, 1.0, 0.0, 0.0)).xyz);
	ROUGHNESS = 1.0;
	SPECULAR = 0.15;
}
