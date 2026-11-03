// Аномалии: мерцающее искажённое свечение.
shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(0.4, 0.7, 1.0, 1.0);
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
global uniform float wind_time;
void fragment() {
	vec2 uv = UV - 0.5;
	float r = length(uv) * 2.0;
	float n = texture(noise_tex, UV * 1.5 + vec2(wind_time * 0.21, -wind_time * 0.17)).r;
	float n2 = texture(noise_tex, UV * 3.1 - vec2(wind_time * 0.33, wind_time * 0.12)).r;
	float a = (1.0 - smoothstep(0.2, 1.0, r)) * (0.35 + 0.65 * n * n2 * 2.0);
	ALBEDO = color.rgb * 1.8;
	ALPHA = clamp(a * color.a, 0.0, 1.0);
}
