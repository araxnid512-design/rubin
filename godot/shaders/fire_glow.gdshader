// Отсвет огня на земле: тёплое пятно с мерцанием (прибавляется к картинке). Даёт свет костра и на низком
// качестве, где настоящих источников света нет (в gl_compatibility каждый точечный свет — лишний проход по
// всем мешам рядом). COLOR.r — фаза мерцания пятна.
shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform vec3 glow_color : source_color = vec3(1.0, 0.55, 0.2);
uniform float strength = 0.6;

void fragment() {
	vec2 p = UV * 2.0 - 1.0;
	float a = 1.0 - smoothstep(0.0, 1.0, length(p));
	float flick = 0.85 + 0.15 * sin(TIME * 13.0 + COLOR.r * 40.0) * sin(TIME * 7.3 + COLOR.r * 17.0);
	ALBEDO = glow_color * a * a * strength * flick;
}
