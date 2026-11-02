// Кроны деревьев и кусты (MultiMesh). Цвет — у каждого экземпляра свой (осенние оттенки: MultiMesh с цветами,
// Level.AUTUMN), поверх — гроздья листвы светлее и темнее по шуму, низ и нутро кроны темнее (дешёвое
// затенение без SSAO), качание на ветру. Крона между камерой и героем «просвечивает» (дизеринг), чтобы не
// закрывать его при виде сверху. fade_range > 0 — экземпляры дальше от камеры сжимаются в точку (дальность
// видимости по экземплярам, для кустов). bumps — неровный край куста (вершины смещаются по шуму).
// Кроны — карточки с текстурой листвы (scripts/crowns.gd): прозрачное отбрасывается, видны обе стороны,
// нормали сферические (не переворачиваются у обратной стороны); UV2.x — глубина в кроне (нутро темнее).
shader_type spatial;
render_mode cull_disabled, diffuse_lambert_wrap;

uniform sampler2D leaf_tex : source_color, filter_linear_mipmap, repeat_disable;
uniform float leaf_gain = 1.25;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform float crown_y0 = 3.0;
uniform float crown_y1 = 9.0;
uniform float sway = 0.2;
uniform float sway_h = 8.0;
uniform float bumps = 0.0;
uniform float fade_range = 0.0;
uniform vec3 player_pos = vec3(0.0, -100.0, 0.0);
uniform float see_through = 0.0;

varying vec3 w_pos;
varying float y01;
varying float depth;

void vertex() {
	vec3 o = MODEL_MATRIX[3].xyz;
	if (bumps > 0.0) {
		float b = textureLod(noise_tex, (VERTEX.xz + vec2(VERTEX.y, 0.0) + o.xz) * 0.37, 0.0).r;
		VERTEX += NORMAL * (b - 0.5) * bumps;
	}
	float k = clamp(VERTEX.y / sway_h, 0.0, 1.0);
	k *= k;
	VERTEX.x += sin(TIME * 1.6 + o.x * 0.35 + o.z * 0.21) * sway * k;
	VERTEX.z += cos(TIME * 1.15 + o.z * 0.31 + o.x * 0.17) * sway * 0.7 * k;
	y01 = clamp((VERTEX.y - crown_y0) / max(crown_y1 - crown_y0, 0.01), 0.0, 1.0);
	if (fade_range > 0.0) {
		float d = length(o - CAMERA_POSITION_WORLD);
		VERTEX *= 1.0 - smoothstep(fade_range - 4.0, fade_range, d);
	}
	w_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	depth = UV2.x;
}

void fragment() {
	if (see_through > 0.0 && w_pos.y > 1.6) {
		// луч от героя к камере (камера сверху и с юга): на высоте y он смещён к югу на ~0,62·y
		vec2 d = w_pos.xz - player_pos.xz - vec2(0.0, (w_pos.y - player_pos.y - 1.0) * 0.62);
		float k = (1.0 - smoothstep(1.6, 3.4, length(d))) * see_through;
		vec2 f = mod(floor(FRAGCOORD.xy), 2.0);
		float dith = (mix(mix(0.0, 2.0, f.y), mix(3.0, 1.0, f.y), f.x) + 0.5) / 4.0;
		if (k * 0.85 > dith) {
			discard;
		}
	}
	vec4 leaf = texture(leaf_tex, UV);
	if (leaf.a < 0.5) {
		discard;
	}
	// у обратной стороны карточки Godot переворачивает нормаль — у кроны она сферическая, возвращаем
	if (!FRONT_FACING) {
		NORMAL = -NORMAL;
	}
	float n = texture(noise_tex, w_pos.xz * 0.35 + vec2(w_pos.y * 0.3, 0.0)).r;
	float n2 = texture(noise_tex, w_pos.xz * 0.09 + vec2(0.5, 0.2)).r;
	vec3 c = COLOR.rgb * leaf.rgb * leaf_gain;
	c *= 0.8 + n * 0.4;
	c = mix(c, c * vec3(1.15, 1.05, 0.7), smoothstep(0.6, 0.8, n2) * 0.5);
	c *= mix(0.7, 1.08, y01) * (1.0 - depth * 0.45);
	ALBEDO = c;
	ROUGHNESS = 0.85;
	SPECULAR = 0.2;
}
