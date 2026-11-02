// Контактные тени — мягкие тёмные пятна на земле у основания стен, заборов, мебели и под кронами (вместо
// теней от солнца и SSAO: один меш на всю локацию, один вызов отрисовки). UV — точка квадрата в долях
// мягкого края (|UV| ≤ UV2 − 1 — под самим предметом), COLOR.a — сила пятна.
shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;

uniform vec3 tint : source_color = vec3(0.04, 0.05, 0.07);
uniform float strength = 1.0;

void fragment() {
	vec2 d = max(abs(UV) - (UV2 - vec2(1.0)), vec2(0.0));
	float a = 1.0 - smoothstep(0.0, 1.0, length(d));
	ALBEDO = tint;
	ALPHA = a * a * COLOR.a * strength;
}
