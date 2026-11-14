shader_type spatial;
// Луч света от потолочной лампы сквозь пыль: мягкий конус, ярче у лампы, края и низ растворяются.
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled, fog_disabled;

uniform vec4 col : source_color = vec4(1.0, 0.85, 0.6, 1.0);
uniform float strength = 0.09;

void fragment() {
	float edge = abs(dot(normalize(NORMAL), normalize(VIEW)));
	float fall = pow(1.0 - UV.y, 1.6);
	float flick = 0.92 + 0.08 * sin(TIME * 0.7 + UV.x * 6.28);
	ALBEDO = col.rgb * smoothstep(0.0, 0.9, edge) * fall * strength * flick;
}
