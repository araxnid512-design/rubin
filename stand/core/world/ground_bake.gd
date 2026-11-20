class_name ULGroundBake
extends RefCounted
## Запечённая земля («быстрая земля»). Обычный шейдер земли в каждой точке экрана каждый кадр решает, где трава,
## где тропа, грунт и подстилка (карта, пять чтений шума, смешивание «по высоте»), и читает каждый слой дважды —
## 9–12 чтений текстур, на стыках до 20; а земля занимает почти весь экран.
## Здесь всё, что не меняется, посчитано один раз заранее (проверка --as-test=gbake, обработка tools/ground_post.py):
##   • раскладка слоёв — assets/world/tex/ground_<место>_w.jpg: вид строго сверху на всё поле, R — трава,
##     G — подстилка, B — тропа, остаток до единицы — грунт;
##   • общий тон — ground_<место>_t.png (без сжатия): во сколько раз и в какой цвет подвести землю, чтобы издалека она
##     выглядела как подробная (сухие пятна, зелёные куртины, кочки, затенение, рельеф под солнцем).
## Сами текстуры травы, подстилки, грунта и тропы — те же, что у подробной земли (резкость вблизи не теряется),
## но каждая читается один раз. В игре остаётся 4 чтения в точке: раскладка, слой, тон, запечённая тень.
##
## Колеи, проплешины, лужи, асфальт санатория и порода карьера рисуются поверх как раньше.
## Когда включается: на «Низкой» графике; настройка «Земля» (как в качестве / подробная / быстрая); подстройка
## под частоту кадров переходит на быструю землю после снятия теней и до понижения разрешения.
##
## Важно про цвет: в этом рендерере (Compatibility) шейдер работает с цветом в sRGB, в линейный свет его
## переводит движок уже после шейдера — поэтому все множители здесь и в ground_post.py считаются в sRGB.

const DIR := "res://assets/world/tex/"
const TONE_MAX := 2.0                      ## наибольший хранимый тон (то же число — в tools/ground_post.py)

const FAST_SHADER := """shader_type spatial;
//#CUT
uniform sampler2D wmap : filter_linear, repeat_disable;
uniform sampler2D tint : filter_linear, repeat_disable;
uniform sampler2D grass : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D forest : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D soil : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D path : source_color, filter_linear_mipmap, repeat_enable;
uniform float tone_k = 2.0;              // тон хранится вдвое уменьшенным (TONE_MAX)
uniform float world_size = 100.0;
uniform float path_scale = 2.6;
uniform float micro_k = 0.4;
#ifdef CUT
uniform float cut_on = 0.0;
uniform vec4 cut_rect = vec4(0.0);
#endif
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
//#SUN_SHADOW
void fragment() {
	vec2 p = wp.xz;
#ifdef CUT
	if (cut_on > 0.5 && p.x > cut_rect.x && p.x < cut_rect.z && p.y > cut_rect.y && p.y < cut_rect.w) {
		discard;
	}
#endif
	mat2 rot = mat2(vec2(0.8, 0.6), vec2(-0.6, 0.8));
	// производные координат — до ветвлений (внутри них выборки идут с явным мип-уровнем)
	vec2 dx = dFdx(p);
	vec2 dy = dFdy(p);
	vec2 uv = p / world_size + 0.5;
	vec3 w = texture(wmap, uv).rgb;
	float ws = max(1.0 - w.r - w.g - w.b, 0.0);
	// слой читается только там, где он есть; масштабы — как у первой выборки подробного шейдера
	vec3 c = vec3(0.0);
	float sum = 0.0;
	if (w.r > 0.04) { c += textureGrad(grass, p / 3.4, dx / 3.4, dy / 3.4).rgb * w.r; sum += w.r; }
	if (w.g > 0.04) { c += textureGrad(forest, rot * p / 3.2, rot * dx / 3.2, rot * dy / 3.2).rgb * w.g; sum += w.g; }
	if (ws > 0.04) { c += textureGrad(soil, p / 3.6, dx / 3.6, dy / 3.6).rgb * ws; sum += ws; }
	if (w.b > 0.04) { c += textureGrad(path, p / path_scale, dx / path_scale, dy / path_scale).rgb * w.b; sum += w.b; }
	c /= max(sum, 0.001);
	// подробный шейдер из двух выборок слоя берёт более светлую («по высоте») и подсвечивает рельеф — мелкий
	// рисунок у него контрастнее. Здесь то же даёт усиление перепадов светлоты одной выборки (без чтений);
	// среднюю яркость возвращает тон
	c *= mix(1.0, dot(c, vec3(0.3, 0.59, 0.11)) * 4.0, micro_k);
	c *= texture(tint, uv).rgb * tone_k;
	ALBEDO = c * sun_shade(p);
	// блик и отсвет неба уже в тоне (сняты видом сверху) — второй раз не считаются
	ROUGHNESS = 1.0;
	SPECULAR = 0.0;
}
"""

static var _shaders := {}
static var _white: Texture2D = null


static func path_w(place: String) -> String:
	return "%sground_%s_w.jpg" % [DIR, place]


static func path_t(place: String) -> String:
	return "%sground_%s_t.png" % [DIR, place]


static func exists(place: String) -> bool:
	return place != "" and ResourceLoader.exists(path_w(place)) and ResourceLoader.exists(path_t(place))


## шейдер быстрой земли (cut — с вырезом над погребом, как у хутора)
static func shader(cut: bool) -> Shader:
	if not _shaders.has(cut):
		var sh := Shader.new()
		sh.code = ULSunShadow.with(FAST_SHADER.replace("//#CUT", "#define CUT" if cut else ""))
		_shaders[cut] = sh
	return _shaders[cut]


## белая точка: «тон без поправки» — для второго шага запекания
static func white() -> Texture2D:
	if _white == null:
		var im := Image.create(1, 1, false, Image.FORMAT_RGB8)
		im.fill(Color(1, 1, 1))
		_white = ImageTexture.create_from_image(im)
	return _white
