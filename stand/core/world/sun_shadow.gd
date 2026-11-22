class_name ULSunShadow
extends RefCounted
## Запечённые тени солнца на земле. Тени от построек, деревьев, заборов и техники считаются один раз заранее
## (проверка --as-test=shbake, картинка assets/world/tex/shadow_<место>.png: белое — свет, чёрное — тень, вид
## строго сверху на всё поле) и в игре просто умножаются на цвет земли — телефон их не считает.
##
## Показываются тогда, когда тени солнца в реальном времени выключены: на «Низкой» графике и когда подстройка
## под частоту кадров сняла тени. Раньше в этих случаях теней на земле не было вовсе. Когда настоящие тени
## включены, запечённые выключены (иначе тень была бы двойной).
##
## Земляные шейдеры (земля, порода карьера, асфальт санатория, колеи, проплешины, лужи) получают общие
## параметры (global uniform, объявлены в project.godot → [shader_globals]) и функцию sun_shade(): в исходнике
## шейдера стоит метка //#SUN_SHADOW, её подменяет with().
## Персонажи и предметы запечённой тенью не затемняются: под ними — свои мягкие пятна.

const MARK := "//#SUN_SHADOW"
const DECL := """global uniform sampler2D sun_shadow_tex : filter_linear, repeat_disable;
global uniform float sun_shadow_k;
global uniform float sun_shadow_size;
global uniform sampler2D cloud_tex : filter_linear, repeat_enable;
global uniform float cloud_k;
global uniform vec4 wind;
global uniform float wet_k;
// тени облаков: бесшовный шум 90 м, плывёт по ветру; cloud_k — сила (0 — нет облаков)
float cloud_shade(vec2 xz) {
	if (cloud_k <= 0.0) {
		return 1.0;
	}
	float c = texture(cloud_tex, xz / 90.0 - wind.xy * TIME * 0.011).r;
	return 1.0 - cloud_k * smoothstep(0.48, 0.74, c);
}
vec3 sun_shade(vec2 xz) {
	// мокрая земля (дождь) темнее; облака бегут по земле
	vec3 k = vec3(cloud_shade(xz) * mix(1.0, 0.86, wet_k));
	if (sun_shadow_k <= 0.0) {
		return k;                           // настоящие тени включены — картинку теней даже не читаем
	}
	float s = texture(sun_shadow_tex, xz / sun_shadow_size + 0.5).r;
	// цвет полной тени подобран по кадрам сверху: земля в запечённой тени темнее освещённой во столько же раз,
	// во сколько в настоящей тени солнца (проверка shcheck сравнивает); подобран уже с усиленным солнцем
	// «без теней» (world.gd, SUN_NOSHADOW_K)
	return k * mix(vec3(1.0), mix(vec3(0.5, 0.54, 0.62), vec3(1.0), s), sun_shadow_k);
}
// мокрая поверхность: глаже и с бликом
float wet_rough(float r) { return mix(r, 0.3, wet_k * 0.85); }
float wet_spec(float s) { return mix(s, 0.5, wet_k * 0.8); }
"""
## Ветер для травы, елей и деревьев-моделей (глобальный параметр wind: x, y — направление, z — сила, w — порывы).
## Порыв — волна вдоль ветра бежит по полю: трава и кроны клонятся не каждая сама по себе, а полосой.
const WIND := """global uniform vec4 wind;
float wind_gust(vec2 xz) {
	float wave = 0.5 + 0.5 * sin(dot(xz, wind.xy) * 0.09 - TIME * 1.6);
	float wave2 = 0.5 + 0.5 * sin(dot(xz, vec2(-wind.y, wind.x)) * 0.05 + TIME * 0.7);
	return wind.z * (0.35 + wind.w * wave * wave * (0.6 + 0.4 * wave2));
}
float wind_flutter(vec2 xz) {
	return sin(TIME * 2.7 + xz.x * 0.9 + xz.y * 0.5) + 0.5 * sin(TIME * 4.1 + xz.y * 1.3);
}
"""
const DIR := "res://assets/world/tex/"

static var _tex: Texture2D = null          ## держим ссылку: глобальный параметр хранит только номер текстуры
static var _place := ""
static var on := false                      ## показаны ли сейчас запечённые тени
static var size := 0.0                      ## сторона квадрата земли, под которую сейчас растянута картинка теней, м


static func with(code: String) -> String:
	return code.replace(MARK, DECL)


static func path(place: String) -> String:
	return "%sshadow_%s.png" % [DIR, place]


static func exists(place: String) -> bool:
	return place != "" and ResourceLoader.exists(path(place))


## place — локация (пусто — нет запечённых теней), span — сторона квадрата земли, м; want — показывать
## (то есть настоящие тени солнца сейчас выключены); strength — сила тени 0…1 (на базе тени солнца мягче)
static func apply(place: String, span: float, want: bool, strength := 1.0) -> void:
	if place != _place:
		_place = place
		_tex = load(path(place)) if exists(place) else null
		RenderingServer.global_shader_parameter_set(&"sun_shadow_tex", _tex.get_rid() if _tex != null else RID())
	on = want and _tex != null
	size = maxf(span, 1.0)
	RenderingServer.global_shader_parameter_set(&"sun_shadow_size", size)
	RenderingServer.global_shader_parameter_set(&"sun_shadow_k", clampf(strength, 0.0, 1.0) if on else 0.0)
