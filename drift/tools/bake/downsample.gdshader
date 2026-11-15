// Уменьшение кадра (суперсэмплинг ss×ss → 1 пиксель): усреднение с весом по альфе (без тёмной каймы),
// для прохода нормалей вектор после усреднения нормализуется. Выход — «прямая» альфа (blend_premul_alpha:
// в буфер пишется ровно COLOR.rgb, на прозрачном фоне это и есть цвет пикселя PNG).
shader_type canvas_item;
render_mode blend_premul_alpha, unshaded;

uniform sampler2D src : filter_nearest;
uniform int ss = 3;
uniform bool is_normal = false;

void fragment() {
	vec2 sz = vec2(textureSize(src, 0));
	vec2 base = floor(UV * sz / float(ss)) * float(ss);
	vec3 acc = vec3(0.0);
	float wa = 0.0;
	for (int y = 0; y < ss; y++) {
		for (int x = 0; x < ss; x++) {
			vec4 c = texture(src, (base + vec2(float(x), float(y)) + 0.5) / sz);
			acc += c.rgb * c.a;
			wa += c.a;
		}
	}
	float n = float(ss * ss);
	vec3 rgb = wa > 0.0 ? acc / wa : vec3(0.0);
	if (is_normal) {
		vec3 v = rgb * 2.0 - 1.0;
		v = length(v) > 0.0001 ? normalize(v) : vec3(0.0, 0.0, 1.0);
		rgb = v * 0.5 + 0.5;
		if (wa <= 0.0) {
			rgb = vec3(0.5, 0.5, 1.0);
		}
	}
	COLOR = vec4(rgb, wa / n);
}
