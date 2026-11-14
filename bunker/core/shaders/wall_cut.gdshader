// Стена с «вырезом»: часть стены между камерой и игроком не рисуется (круг вокруг героя на экране),
// чтобы герой был виден в комнатах при взгляде сверху. Ниже пояса героя стена остаётся — видно, где она.
shader_type spatial;
render_mode cull_back;

global uniform vec3 bc_player_pos;
global uniform float bc_cut_on;

uniform vec4 tint : source_color = vec4(1.0);
uniform sampler2D tex_color : source_color, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_normal : hint_normal, filter_linear_mipmap_anisotropic, repeat_enable;
uniform sampler2D tex_arm : hint_default_white, filter_linear_mipmap_anisotropic, repeat_enable;
uniform bool has_tex = true;
uniform float metal = 0.0;
uniform float cut_radius = 0.2;

void fragment() {
	if (bc_cut_on > 0.5) {
		vec3 wp = (INV_VIEW_MATRIX * vec4(VERTEX, 1.0)).xyz;
		vec3 pv = (VIEW_MATRIX * vec4(bc_player_pos + vec3(0.0, 0.9, 0.0), 1.0)).xyz;
		// фрагмент ближе к камере, чем герой, и в круге вокруг него на экране
		if (VERTEX.z > pv.z + 0.35 && wp.y > bc_player_pos.y + 0.45) {
			vec2 d = VERTEX.xy / -VERTEX.z - pv.xy / -pv.z;
			d.x *= 0.85;
			float r = length(d);
			// мягкий край: шахматный дизер на границе круга
			float edge = 1.0 - smoothstep(cut_radius * 0.82, cut_radius, r);
			float dith = fract(dot(floor(FRAGCOORD.xy), vec2(0.5, 0.25)) * 2.0);
			if (edge > dith * 0.98 + 0.01) discard;
		}
	}
	if (has_tex) {
		vec3 arm = texture(tex_arm, UV).rgb;
		ALBEDO = texture(tex_color, UV).rgb * tint.rgb;
		NORMAL_MAP = texture(tex_normal, UV).rgb;
		AO = arm.r;
		AO_LIGHT_AFFECT = 0.6;
		ROUGHNESS = arm.g;
		METALLIC = arm.b * metal;
	} else {
		ALBEDO = tint.rgb;
		ROUGHNESS = 0.9;
		METALLIC = metal;
	}
}
