// Рельеф: земля, сухая трава, гравий и асфальт смешиваются по вершинным цветам (R — трава, G — гравий,
// B — асфальт), UV — мировые метры. Дешёво для телефона: 4 цветовые и 4 нормальные текстуры, без триплана.
shader_type spatial;
render_mode cull_back;

uniform sampler2D dirt_c : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D dirt_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_c : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D grass_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D gravel_c : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D gravel_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D asphalt_c : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D asphalt_n : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform vec3 tint = vec3(0.74, 0.71, 0.64);

varying vec3 wcol;

void vertex() {
	wcol = COLOR.rgb;
}

void fragment() {
	vec2 uv = UV / 4.0;
	vec2 uv2 = UV / 2.6;
	vec3 d = texture(dirt_c, uv).rgb;
	vec3 g = texture(grass_c, uv * 0.8).rgb * vec3(1.0, 0.93, 0.72);
	float lum = dot(g, vec3(0.3, 0.59, 0.11));
	g = mix(vec3(lum), g, 0.55) * vec3(1.08, 1.0, 0.82);
	vec3 r = texture(gravel_c, uv2).rgb;
	vec3 a = texture(asphalt_c, UV / 5.0).rgb;
	float wg = wcol.r, wr = wcol.g, wa = wcol.b;
	// жёсткий переход по высоте текстуры — выглядит как пятна, а не мыльное смешение
	float hg = smoothstep(0.35, 0.65, wg + (g.g - 0.4) * 0.6);
	float hr = smoothstep(0.4, 0.6, wr + (r.r - 0.5) * 0.5);
	vec3 col = mix(d, g, hg);
	col = mix(col, r, hr * (1.0 - hg));
	col = mix(col, a, wa);
	vec3 nd = texture(dirt_n, uv).rgb;
	vec3 ng = texture(grass_n, uv * 0.8).rgb;
	vec3 nr = texture(gravel_n, uv2).rgb;
	vec3 na = texture(asphalt_n, UV / 5.0).rgb;
	vec3 nm = mix(nd, ng, hg);
	nm = mix(nm, nr, hr * (1.0 - hg));
	nm = mix(nm, na, wa);
	ALBEDO = col * tint;
	NORMAL_MAP = nm;
	ROUGHNESS = mix(0.95, 0.85, wa);
	METALLIC = 0.0;
}
