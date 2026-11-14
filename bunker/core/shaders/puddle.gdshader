// Лужа: тёмная мутная вода, отражение неба тем сильнее, чем острее угол взгляда, мягкий край (дизер).
shader_type spatial;
render_mode cull_back, specular_schlick_ggx;
uniform vec3 water = vec3(0.07, 0.065, 0.05);
uniform vec3 sky = vec3(0.62, 0.6, 0.52);
void fragment() {
	float f = pow(1.0 - clamp(dot(NORMAL, VIEW), 0.0, 1.0), 3.0);
	ALBEDO = mix(water, sky * 0.55, 0.15 + 0.6 * f);
	ROUGHNESS = 0.05;
	METALLIC = 0.0;
	SPECULAR = 0.9;
}
