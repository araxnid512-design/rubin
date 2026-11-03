// Персонажи и оружие: цвет вершины + код материала, подсветка попаданий.
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx, cull_back;

uniform sampler2D detail_tex : filter_linear_mipmap, repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
instance uniform float hit_flash = 0.0;
instance uniform float dirt = 0.25;
global uniform float detail_level;

varying vec3 lpos;

void vertex() {
	lpos = VERTEX;
}

void fragment() {
	int mid = int(COLOR.a * 10.0 + 0.5);
	vec3 base = pow(COLOR.rgb, vec3(2.2)) * tint.rgb;
	float fine = mix(0.5, texture(detail_tex, lpos.xy * 1.7 + lpos.zz * 0.9).r, detail_level);
	float rough = 0.8;
	float metal = 0.0;
	if (mid == 2) { rough = 0.6; metal = 0.3; }
	else if (mid == 3) { rough = 0.7; metal = 0.3; }
	else if (mid == 4) { rough = 0.6; }
	else if (mid == 5) { rough = 0.95; }
	else if (mid == 7) { rough = 0.1; metal = 0.6; }
	else if (mid == 9) { rough = 0.55; }
	else if (mid == 10) { rough = 0.6; }
	vec3 col = base * (0.86 + 0.28 * fine);
	float low = 1.0 - smoothstep(0.0, 0.7, lpos.y);
	col = mix(col, col * vec3(0.55, 0.48, 0.4), low * dirt);
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	EMISSION = vec3(1.0, 0.25, 0.15) * hit_flash;
}
