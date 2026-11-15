// Запекание спрайтов «Дрейфа»: один шейдер на все поверхности модели.
// mode 0 — цвет: альбедо × мягкий нейтральный свет (почти рассеянный, слабый ключ слева сверху);
// mode 1 — нормали в пространстве камеры: RGB = n·0.5+0.5 (X вправо, Y вверх по экрану, Z на зрителя —
//          так Godot 2D читает карту нормалей CanvasTexture).
// Освещение считается здесь вручную (unshaded), чтобы результат не зависел от настроек рендера.
shader_type spatial;
render_mode unshaded, cull_back, depth_draw_opaque, shadows_disabled, fog_disabled;

uniform int mode = 0;
// текстуры читаются как есть (sRGB) и переводятся в линейные вручную — так одинаково при любом рендере
uniform sampler2D albedo_tex : filter_linear_mipmap, repeat_enable;
uniform bool has_albedo = false;
uniform vec4 albedo_col = vec4(1.0);
uniform sampler2D normal_tex : hint_normal, filter_linear_mipmap, repeat_enable;
uniform bool has_normal = false;
uniform float normal_depth = 0.7;
uniform sampler2D emission_tex : filter_linear_mipmap, repeat_enable;
uniform bool has_emission_tex = false;
uniform vec3 emission_col = vec3(0.0);
uniform float alpha_scissor = -1.0;
// свет (в пространстве камеры)
uniform vec3 key_dir = vec3(-0.55, 0.62, 0.56);
uniform float ambient = 0.78;
uniform float key = 0.32;
uniform float ground_ao = 0.12; // лёгкое затемнение у пола (до 0.6 м)
// обрезка по высоте (мир, м): база / голова турели
uniform float clip_min = -1000.0;
uniform float clip_max = 1000.0;
// переводит ли сам рендер выход linear→sRGB (проверяется калибровкой в bake.gd); если нет — переводим здесь
uniform bool pipeline_srgb = false;

varying vec3 wpos;

vec3 srgb_to_linear(vec3 c) {
	return mix(c / 12.92, pow((c + vec3(0.055)) / 1.055, vec3(2.4)), step(vec3(0.04045), c));
}

vec3 linear_to_srgb(vec3 c) {
	c = clamp(c, 0.0, 1.0);
	return mix(c * 12.92, 1.055 * pow(c, vec3(1.0 / 2.4)) - 0.055, step(vec3(0.0031308), c));
}

void vertex() {
	wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz;
}

void fragment() {
	if (wpos.y < clip_min || wpos.y > clip_max) {
		discard;
	}
	vec4 a = albedo_col;
	if (has_albedo) {
		a *= texture(albedo_tex, UV);
	}
	if (alpha_scissor > 0.0 && a.a < alpha_scissor) {
		discard;
	}
	vec3 n = normalize(NORMAL);
	if (has_normal) {
		vec3 nm;
		nm.xy = texture(normal_tex, UV).xy * 2.0 - 1.0;
		nm.z = sqrt(max(0.0, 1.0 - dot(nm.xy, nm.xy)));
		n = normalize(mix(n, TANGENT * nm.x + BINORMAL * nm.y + NORMAL * nm.z, normal_depth));
	}
	if (mode == 1) {
		vec3 enc = clamp(n * 0.5 + 0.5, 0.0, 1.0);
		ALBEDO = pipeline_srgb ? srgb_to_linear(enc) : enc;
	} else {
		float ndl = max(dot(n, normalize(key_dir)), 0.0);
		float wrap = n.y * 0.5 + 0.5; // небо/пол
		float shade = ambient + key * ndl + 0.08 * (wrap - 0.5);
		shade *= 1.0 - ground_ao * (1.0 - smoothstep(0.0, 0.6, wpos.y));
		vec3 e = srgb_to_linear(emission_col);
		if (has_emission_tex) {
			e *= srgb_to_linear(texture(emission_tex, UV).rgb);
		}
		vec3 lit = srgb_to_linear(a.rgb) * shade + e;
		ALBEDO = pipeline_srgb ? lit : linear_to_srgb(lit);
	}
}
