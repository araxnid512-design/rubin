// Частицы/вспышки: билборд с мягким круглым спрайтом, аддитивно.
shader_type spatial;
render_mode blend_add, unshaded, cull_disabled, depth_draw_never, shadows_disabled;
uniform vec4 color : source_color = vec4(1.0, 0.6, 0.2, 1.0);
uniform float energy = 2.0;
void vertex() {
	MODELVIEW_MATRIX = VIEW_MATRIX * mat4(INV_VIEW_MATRIX[0], INV_VIEW_MATRIX[1], INV_VIEW_MATRIX[2], MODEL_MATRIX[3]);
	MODELVIEW_MATRIX = MODELVIEW_MATRIX * mat4(vec4(length(MODEL_MATRIX[0].xyz), 0.0, 0.0, 0.0), vec4(0.0, length(MODEL_MATRIX[1].xyz), 0.0, 0.0), vec4(0.0, 0.0, length(MODEL_MATRIX[2].xyz), 0.0), vec4(0.0, 0.0, 0.0, 1.0));
}
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = (1.0 - smoothstep(0.0, 1.0, r));
	ALBEDO = color.rgb * energy * COLOR.rgb;
	ALPHA = a * color.a * COLOR.a;
}
