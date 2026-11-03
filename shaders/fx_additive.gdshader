shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.8, 0.4, 1.0);
uniform float energy = 2.0;
void fragment() {
	ALBEDO = color.rgb * energy * COLOR.rgb;
	ALPHA = color.a * COLOR.a;
}
