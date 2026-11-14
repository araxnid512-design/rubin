// Пучок сухой травы: альфа-отсечение, покачивание ветром (сильнее у верхушек), цвет — по экземпляру.
shader_type spatial;
render_mode cull_disabled, depth_prepass_alpha;
uniform sampler2D tex : source_color, filter_linear_mipmap;
uniform float wind = 0.08;
varying vec3 tint;
void vertex() {
	vec3 wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	float top = 1.0 - COLOR.a;
	float w = sin(TIME * 1.7 + wp.x * 0.35 + wp.z * 0.2) * 0.6 + sin(TIME * 3.1 + wp.x) * 0.2;
	VERTEX.x += w * wind * top;
	VERTEX.z += w * wind * 0.5 * top;
	tint = COLOR.rgb;
}
void fragment() {
	vec4 c = texture(tex, UV);
	if (c.a < 0.45) discard;
	ALBEDO = c.rgb * tint * 0.95;
	ROUGHNESS = 0.95;
	BACKLIGHT = vec3(0.25, 0.2, 0.1);
}
