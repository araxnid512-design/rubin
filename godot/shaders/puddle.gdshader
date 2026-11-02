// Лужа (плоские квадраты луж из браузерной игры — их форма была в alphaMap, которого нет в glTF): неровное
// пятно с мягким краем по шуму, тёмное дно и отсвет неба пятнами (как отражения крон) — без SSR, блик солнца —
// низкой шероховатостью. Прозрачная, глубину не пишет.
shader_type spatial;
render_mode blend_mix, depth_draw_never, cull_disabled;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform vec3 sky_color : source_color = vec3(0.68, 0.74, 0.8);
uniform vec3 deep_color : source_color = vec3(0.1, 0.11, 0.12);
uniform float opacity = 0.88;

varying vec3 w_pos;

void vertex() {
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float n = texture(noise_tex, w_pos.xz * 0.35).r;
	float n2 = texture(noise_tex, w_pos.xz * 1.3 + vec2(0.5, 0.5)).r;
	float r = length(p) + (n - 0.5) * 0.55 + (n2 - 0.5) * 0.12;
	float a = 1.0 - smoothstep(0.62, 0.86, r);
	float rim = smoothstep(0.45, 0.8, r);
	ALBEDO = deep_color;
	ROUGHNESS = mix(0.04, 0.3, rim);
	METALLIC = 0.0;
	SPECULAR = 0.8;
	EMISSION = sky_color * mix(0.06, 0.16, n2) * (1.0 - rim * 0.7);
	ALPHA = a * opacity;
}
