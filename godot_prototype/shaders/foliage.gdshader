// Растительность: цвет вершины, покачивание ветром (вершины выше основания).
shader_type spatial;
render_mode diffuse_lambert, cull_disabled;

uniform float sway = 0.12;
uniform bool cutout = false;
global uniform float wind_time;
global uniform vec3 player_pos;

varying vec3 wpos;

void vertex() {
	vec3 w = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
	vec3 o = (MODEL_MATRIX * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
	float h = max(VERTEX.y, 0.0);
	float ph = o.x * 0.37 + o.z * 0.23;
	float k = sway * h * h * 0.15;
	VERTEX.x += sin(wind_time * 1.7 + ph) * k;
	VERTEX.z += cos(wind_time * 1.3 + ph * 1.3) * k * 0.6;
	wpos = w;
}

void fragment() {
	vec3 base = pow(COLOR.rgb, vec3(2.2));
	ALBEDO = base * (0.85 + 0.3 * clamp(wpos.y * 0.15, 0.0, 1.0));
	ROUGHNESS = 0.9;
	BACKLIGHT = vec3(0.15, 0.18, 0.05);
	if (cutout && PROJECTION_MATRIX[3][3] < 0.5 && wpos.y > 1.2) {
		vec3 cam = CAMERA_POSITION_WORLD;
		vec3 tp = player_pos + vec3(0.0, 1.0, 0.0) - cam;
		float dp = length(tp);
		vec3 dir = tp / max(dp, 0.001);
		vec3 tf = wpos - cam;
		float t = dot(tf, dir);
		if (t < dp - 0.8) {
			float perp = length(tf - dir * t);
			float rad = 3.0 * clamp(t / dp, 0.0, 1.0) + 0.3;
			float fade = 1.0 - smoothstep(rad * 0.6, rad, perp);
			float ign = fract(52.9829189 * fract(dot(FRAGCOORD.xy, vec2(0.06711056, 0.00583715))));
			if (fade * 0.94 > ign) {
				discard;
			}
		}
	}
}
