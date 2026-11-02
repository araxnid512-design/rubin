// Статика локации «как на фото» (дома, заборы, крыши, земля): текстура с картой нормалей из браузерной игры,
// а поверх — то, что делает место сырым и заброшенным, всё по шуму в мировых координатах (одна текстура шума):
//   · крупные пятна цвета — земля и стены без повторов (где светлее и суше, где темнее);
//   · у основания стен — темнее (дешёвая контактная тень вместо SSAO) и сырость с рваным краем;
//   · мох на крышах, верхах заборов и карнизах (по нормали вверх), прожилки мха у сырого низа стен;
//   · мокрая земля и лужи на горизонтальном у самой земли: темнее, глаже, отсвет неба (без SSR).
// Для gl_compatibility (OpenGL ES 3.0). LITE (низкое качество) — одна выборка шума вместо трёх.
shader_type spatial;

uniform sampler2D albedo_tex : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float use_normal = 1.0;
uniform vec4 albedo_color : source_color = vec4(1.0);
uniform vec2 uv_scale = vec2(1.0);
uniform vec2 uv_offset = vec2(0.0);
uniform float roughness = 0.9;
uniform float metallic = 0.0;
uniform float normal_scale = 1.0;
// по виду материала (Level.LOOK): мокрость земли, мох, затемнение у земли, крупные пятна
uniform float wet = 0.0;
uniform float moss = 0.0;
uniform float base_ao = 0.0;
uniform float variation = 0.0;
// общая сырость (0 — сухо, 1 — после дождя)
uniform float wetness = 1.0;
uniform vec3 moss_color : source_color = vec3(0.27, 0.32, 0.13);
uniform vec3 moss_dry : source_color = vec3(0.44, 0.42, 0.19);
uniform vec3 sky_color : source_color = vec3(0.68, 0.74, 0.80);

varying vec3 w_pos;
varying vec3 w_nrm;

void vertex() {
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	w_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	vec2 uv = UV * uv_scale + uv_offset;
	vec4 base = texture(albedo_tex, uv);
	vec3 col = base.rgb * albedo_color.rgb;
	vec3 nmap = mix(vec3(0.5, 0.5, 1.0), texture(normal_tex, uv).rgb, use_normal);
	float rough = roughness;

	// шум: крупный (пятна ~10 м), средний (~2 м), мелкий (~0,5 м)
	float n1 = texture(noise_tex, w_pos.xz * 0.03).r;
#ifdef LITE
	float n2 = n1;
	float n3 = 1.0 - n1;
#else
	float n2 = texture(noise_tex, w_pos.xz * 0.17 + vec2(0.37, 0.71)).r;
	float n3 = texture(noise_tex, w_pos.xz * 0.7 + vec2(w_pos.y * 0.61, 0.19)).r;
#endif

	float up = w_nrm.y;
	float h = w_pos.y;
	float side = 1.0 - abs(up);

	// крупная неровность цвета и выгоревшие (желтее) места
	col *= mix(1.0, 0.8 + n1 * 0.42, variation);
	col = mix(col, col * vec3(1.12, 1.05, 0.78), variation * smoothstep(0.55, 0.8, n2) * 0.5);

	// у основания стен: темнее и сырость с рваным краем
	float foot = 1.0 - smoothstep(0.0, 0.9, h);
	col *= 1.0 - base_ao * side * foot * 0.45;
	float damp = base_ao * side * (1.0 - smoothstep(0.1, 0.35 + n2 * 0.55, h));
	col = mix(col, col * vec3(0.66, 0.7, 0.58), damp * 0.75);

	// мох: сверху (крыши, верх заборов выше 0,9 м) пятнами, у сырого низа стен — прожилками
	float top = smoothstep(0.3, 0.75, up) * smoothstep(0.8, 1.3, h);
	float mm = moss * top * smoothstep(0.45, 0.62, n2 * 0.55 + n3 * 0.3 + n1 * 0.3);
	mm = max(mm, moss * damp * smoothstep(0.58, 0.72, n3));
	vec3 mc = mix(moss_color, moss_dry, smoothstep(0.3, 0.7, n1)) * (0.7 + base.g * 0.35);
	col = mix(col, mc, mm);
	rough = mix(rough, 0.95, mm);
	nmap = mix(nmap, vec3(0.5, 0.5, 1.0), mm * 0.5);

	// мокрое и лужи: только горизонтальное у самой земли
	float ground = smoothstep(0.85, 0.97, up) * (1.0 - smoothstep(0.1, 0.3, h));
	float wm = wet * wetness * ground * smoothstep(0.4, 0.6, n1 * 0.6 + n2 * 0.4);
	float pd = wet * wetness * ground * smoothstep(0.645, 0.675, n1 * 0.55 + n2 * 0.35 + n3 * 0.1);
	col *= 1.0 - wm * 0.42;
	rough = mix(rough, 0.22, wm);
	col = mix(col, col * 0.3, pd);
	rough = mix(rough, 0.05, pd);
	nmap = mix(nmap, vec3(0.5, 0.5, 1.0), max(pd, wm * 0.5));

	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metallic;
	SPECULAR = 0.5 + 0.35 * max(wm, pd);
	NORMAL_MAP = nmap;
	NORMAL_MAP_DEPTH = normal_scale;
	// с камеры сверху в луже виден небосвод: отсвет пятнами (как отражения крон), на мокром — чуть-чуть
	EMISSION = sky_color * (pd * (0.05 + 0.09 * n3) + wm * 0.015);
}
