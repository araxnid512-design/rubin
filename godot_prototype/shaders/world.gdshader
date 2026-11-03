// Единый материал статичной геометрии: цвет вершины = альбедо, альфа вершины = код материала.
// Процедурная грязь, ржавчина, потёки + «вырез» геометрии между камерой и генералом.
shader_type spatial;
render_mode diffuse_lambert, specular_schlick_ggx, cull_back;

uniform sampler2D noise_tex : filter_linear_mipmap, repeat_enable;
uniform sampler2D detail_tex : filter_linear_mipmap, repeat_enable;
uniform bool cutout = true;
uniform float grime = 1.0;
global uniform vec3 player_pos;
global uniform float power_on;
global uniform float detail_level;

varying vec3 wpos;
varying vec3 wnrm;

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	wnrm = normalize((MODEL_MATRIX * vec4(NORMAL, 0.0)).xyz);
}

float tri_tex(sampler2D t, vec3 p, vec3 n, float s) {
	vec3 b = abs(n);
	b = b / (b.x + b.y + b.z + 0.0001);
	return texture(t, p.zy * s).r * b.x + texture(t, p.xz * s).r * b.y + texture(t, p.xy * s).r * b.z;
}

void fragment() {
	int mid = int(COLOR.a * 10.0 + 0.5);
	vec3 base = pow(COLOR.rgb, vec3(2.2));
	vec3 n = normalize(wnrm);
	float big = tri_tex(noise_tex, wpos, n, 0.07);
	float fine = mix(0.5, tri_tex(detail_tex, wpos, n, 0.85), detail_level);
	float rough = 0.92;
	float metal = 0.0;
	vec3 emis = vec3(0.0);
	vec3 col = base * (0.8 + 0.4 * big) * (0.84 + 0.32 * fine);
	if (mid <= 1) {
		float streak = texture(noise_tex, vec2(wpos.x * 0.8 + wpos.z * 0.8, wpos.y * 0.06)).r;
		col *= mix(1.0, 0.72, smoothstep(0.55, 0.8, streak) * grime * (1.0 - abs(n.y)));
		rough = 0.96;
	} else if (mid == 2) {
		float r = smoothstep(0.58, 0.72, big * 0.55 + fine * 0.5);
		col = mix(col, vec3(0.16, 0.06, 0.025) * (0.7 + 0.6 * fine), r * grime);
		rough = mix(0.5, 0.88, r);
		metal = mix(0.3, 0.1, r);
	} else if (mid == 3) {
		col = mix(col, col * vec3(1.15, 0.78, 0.55), fine);
		rough = 0.82;
		metal = 0.25;
	} else if (mid == 4) {
		float g = texture(detail_tex, vec2(wpos.x + wpos.z, wpos.y) * vec2(0.25, 3.0)).r;
		col *= 0.8 + 0.4 * g;
		rough = 0.86;
	} else if (mid == 5) {
		rough = 1.0;
	} else if (mid == 6) {
		rough = 0.88;
	} else if (mid == 7) {
		rough = 0.08;
		metal = 0.7;
		col = base * 0.5;
	} else if (mid == 8) {
		emis = base * (3.0 * power_on);
		col = base * (0.3 + 0.7 * power_on);
		rough = 0.4;
	} else if (mid == 9) {
		rough = 0.65;
		col = base * (0.95 + 0.1 * fine);
	} else {
		rough = 0.7;
	}
	float gd = 1.0 - smoothstep(0.0, 0.9, wpos.y);
	col = mix(col, col * vec3(0.5, 0.45, 0.38), gd * 0.55 * grime);
	ALBEDO = col;
	ROUGHNESS = rough;
	METALLIC = metal;
	EMISSION = emis;
	if (cutout && PROJECTION_MATRIX[3][3] < 0.5 && wpos.y > 0.4) {
		vec3 cam = CAMERA_POSITION_WORLD;
		vec3 tp = player_pos + vec3(0.0, 1.0, 0.0) - cam;
		float dp = length(tp);
		vec3 dir = tp / max(dp, 0.001);
		vec3 tf = wpos - cam;
		float t = dot(tf, dir);
		if (t < dp - 0.8) {
			float perp = length(tf - dir * t);
			float rad = 3.4 * clamp(t / dp, 0.0, 1.0) + 0.2;
			float fade = 1.0 - smoothstep(rad * 0.6, rad, perp);
			float ign = fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715))));
			if (fade * 0.94 > ign) {
				discard;
			}
		}
	}
}
