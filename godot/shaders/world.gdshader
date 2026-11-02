// Статика локации «как на фото» (дома, заборы, крыши, земля): текстура с картой нормалей из браузерной игры,
// а поверх — то, что делает место сырым и заброшенным, всё по шуму в мировых координатах (одна текстура шума):
//   · крупные пятна цвета — земля и стены без повторов (где светлее и суше, где темнее);
//   · у основания стен — темнее (дешёвая контактная тень вместо SSAO) и сырость с рваным краем;
//   · мох на крышах, верхах заборов и карнизах (по нормали вверх), прожилки мха у сырого низа стен;
//   · мокрая земля и лужи на горизонтальном у самой земли: темнее, глаже, отсвет неба (без SSR).
// Для gl_compatibility (OpenGL ES 3.0). LITE (низкое качество) — одна выборка шума вместо трёх.
// PHOTO — фото-текстура CC0 (assets/external/textures) вместо нарисованной: проекция по мировым координатам
// (земля — сверху, стены — сбоку), размер плитки в метрах; средний цвет — от нарисованной текстуры (палитра
// локации сохраняется), детали и рельеф — от фото. На земле — вторая выборка крупнее и под углом: без повторов.
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
#ifdef PHOTO
uniform sampler2D photo_albedo : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D photo_normal : hint_normal, filter_linear_mipmap, repeat_enable;
uniform float photo_tile = 3.0;
uniform float photo_contrast = 1.0;
// 0 — от фото только яркость (цвет — нарисованный), 1 — и оттенки (листья, ржавчина)
uniform float photo_chroma = 0.6;
uniform float photo_normal_on = 1.0;
#endif

varying vec3 w_pos;
varying vec3 w_nrm;

void vertex() {
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	w_nrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

void fragment() {
	// шум: крупный (пятна ~10 м), средний (~2 м), мелкий (~0,5 м)
	float n1 = texture(noise_tex, w_pos.xz * 0.03).r;
#ifdef LITE
	float n2 = n1;
	float n3 = 1.0 - n1;
#else
	float n2 = texture(noise_tex, w_pos.xz * 0.17 + vec2(0.37, 0.71)).r;
	float n3 = texture(noise_tex, w_pos.xz * 0.7 + vec2(w_pos.y * 0.61, 0.19)).r;
#endif

#ifdef PHOTO
	// средний цвет нарисованной текстуры (самый мелкий мип) — цвет места; фото — только детали
	vec3 paint = textureLod(albedo_tex, vec2(0.5), 12.0).rgb;
	vec3 ph_avg = max(textureLod(photo_albedo, vec2(0.5), 12.0).rgb, vec3(0.02));
	vec3 an = abs(w_nrm);
	bool flat_up = an.y > 0.7;
	vec2 puv = (flat_up ? w_pos.xz : (an.x > an.z ? vec2(w_pos.z, -w_pos.y) : vec2(w_pos.x, -w_pos.y))) / photo_tile;
	vec3 ph = texture(photo_albedo, puv).rgb;
	vec3 pn = texture(photo_normal, puv).rgb;
#ifndef LITE
	if (flat_up) {
		// вторая выборка: крупнее в 2,7 раза и повёрнута — смешивается по шуму, повтор плитки не виден
		vec2 puv2 = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8)) * puv * 0.37 + vec2(0.31, 0.57);
		float k = smoothstep(0.35, 0.65, n2);
		ph = mix(ph, texture(photo_albedo, puv2).rgb, k);   // нормали — одной выборкой: экономия на телефоне
	}
#endif
	vec3 ratio = ph / ph_avg;
	float lr = dot(ph, vec3(0.3, 0.59, 0.11)) / dot(ph_avg, vec3(0.3, 0.59, 0.11));
	ratio = mix(vec3(lr), ratio, photo_chroma);
	vec4 base = vec4(paint * mix(vec3(1.0), ratio, photo_contrast), 1.0);
	vec3 col = base.rgb * albedo_color.rgb;
	vec3 nmap = mix(vec3(0.5, 0.5, 1.0), pn, photo_normal_on);
#else
	vec2 uv = UV * uv_scale + uv_offset;
	vec4 base = texture(albedo_tex, uv);
	vec3 col = base.rgb * albedo_color.rgb;
	vec3 nmap = mix(vec3(0.5, 0.5, 1.0), texture(normal_tex, uv).rgb, use_normal);
#endif
	float rough = roughness;

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
	// (сырость — редкими мягкими пятнами и чуть темнее: сильные тёмные пятна читались как камуфляж)
	float wm = wet * wetness * ground * smoothstep(0.6, 0.8, n1 * 0.6 + n2 * 0.4);
	float pd = wet * wetness * ground * smoothstep(0.7, 0.74, n1 * 0.55 + n2 * 0.35 + n3 * 0.1);
	col *= 1.0 - wm * 0.2;
	rough = mix(rough, 0.3, wm);
	col = mix(col, col * 0.55, pd);
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
