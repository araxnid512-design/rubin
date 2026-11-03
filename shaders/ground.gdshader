// Земля базы: карта смешивания (R — асфальт, G — трава, B — бетонные плиты, A — сырость/лужи/колея).
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx, cull_back;

uniform sampler2D splat : filter_linear, repeat_disable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D detail_tex : filter_linear_mipmap, repeat_enable;
uniform vec2 map_origin = vec2(-150.0, -150.0);
uniform float map_size = 300.0;
global uniform float detail_level;

varying vec3 wpos;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	vec2 uv = (wpos.xz - map_origin) / map_size;
	float big = texture(noise_tex, wpos.xz * 0.031).r;
	float mid = texture(noise_tex, wpos.xz * 0.16).r;
	float mid2 = texture(noise_tex, wpos.xz * 0.16 + vec2(0.37, 0.71)).r;
	float fine = mix(0.5, texture(detail_tex, wpos.xz * 0.75).r, detail_level);
	float fine2 = mix(0.5, texture(detail_tex, wpos.xz * 2.3).r, detail_level);
	vec2 off = (vec2(mid, mid2) - 0.5) * 0.0035;
	vec4 s = texture(splat, uv + off);

	vec3 dirt = mix(vec3(0.37, 0.34, 0.28), vec3(0.47, 0.44, 0.37), big) * (0.78 + 0.44 * fine);
	vec3 grass = mix(vec3(0.27, 0.31, 0.15), vec3(0.40, 0.38, 0.20), mid) * (0.72 + 0.5 * fine2);
	vec3 asphalt = vec3(0.34, 0.34, 0.33) * (0.8 + 0.4 * fine) * (0.9 + 0.2 * big);
	// тонкие трещины там, где мелкий шум близок к 0.5 (только на части покрытия)
	float crack = smoothstep(0.0, 0.03, abs(fine - 0.5));
	asphalt *= mix(1.0, mix(0.6, 1.0, crack), step(0.45, big));
	vec3 conc = vec3(0.50, 0.49, 0.46) * (0.82 + 0.3 * fine) * (0.9 + 0.2 * big);
	vec2 g = fract(wpos.xz / vec2(2.0, 6.0));
	float seam = max(1.0 - smoothstep(0.0, 0.02, min(g.x, 1.0 - g.x)), 1.0 - smoothstep(0.0, 0.008, min(g.y, 1.0 - g.y)));
	conc *= 1.0 - 0.45 * seam;

	float wg = smoothstep(0.25, 0.75, s.g + (mid - 0.5) * 0.6);
	float wa = smoothstep(0.35, 0.65, s.r + (mid2 - 0.5) * 0.25);
	float wc = smoothstep(0.35, 0.65, s.b + (mid - 0.5) * 0.2);
	vec3 col = dirt;
	col = mix(col, grass, wg);
	col = mix(col, asphalt, wa);
	col = mix(col, conc, wc);
	float rough = 0.95;
	float wet = smoothstep(0.5, 0.7, s.a + (big - 0.5) * 0.5 + (fine - 0.5) * 0.15);
	float damp = smoothstep(0.15, 0.45, s.a + (big - 0.5) * 0.4);
	col = mix(col, col * 0.62, damp * 0.6);
	col = mix(col, vec3(0.16, 0.155, 0.13), wet * 0.75);
	rough = mix(rough, 0.18, wet);
	ALBEDO = pow(col, vec3(2.2));
	ROUGHNESS = rough;
	SPECULAR = mix(0.3, 0.55, wet);
}
