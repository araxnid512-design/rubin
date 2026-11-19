class_name ULSharpen
extends CanvasLayer
## Резкость картинки: один проход поверх готовой трёхмерной сцены (под интерфейсом — надписи и кнопки он не трогает).
##
## Откуда «мыло»: 3D рисуется в доле разрешения экрана (60–85 %) и растягивается на весь экран обычным линейным
## фильтром — в этом отрисовщике (Compatibility, OpenGL ES 3) другого растяжения нет, сдвига уровней текстур тоже.
## Проход возвращает контраст мелких деталей по способу AMD CAS: сила зависит от местного контраста, поэтому
## ровные места не шумят, а на резких границах не появляется светлая кайма.
## Цена: копия экрана и пять выборок на точку.

const SHADER := """shader_type canvas_item;
render_mode unshaded, blend_disabled;
uniform sampler2D scr : hint_screen_texture, filter_linear, repeat_disable;
uniform float amount = 0.6;       // 0 — слабо, 1 — сильно
uniform float radius = 1.0;       // шаг выборки в точках экрана: при растянутой картинке — шире

void fragment() {
	vec2 px = SCREEN_PIXEL_SIZE * radius;
	vec3 c = texture(scr, SCREEN_UV).rgb;
	vec3 n = texture(scr, SCREEN_UV + vec2(0.0, -px.y)).rgb;
	vec3 s = texture(scr, SCREEN_UV + vec2(0.0, px.y)).rgb;
	vec3 w = texture(scr, SCREEN_UV + vec2(-px.x, 0.0)).rgb;
	vec3 e = texture(scr, SCREEN_UV + vec2(px.x, 0.0)).rgb;
	vec3 mn = min(c, min(min(n, s), min(w, e)));
	vec3 mx = max(c, max(max(n, s), max(w, e)));
	// чем ближе соседние точки к чёрному или белому, тем слабее усиление — без выбитых светов и провалов
	vec3 amp = sqrt(clamp(min(mn, 1.0 - mx) / max(mx, vec3(0.0001)), 0.0, 1.0));
	vec3 wgt = amp * (-1.0 / mix(8.0, 5.0, amount));
	COLOR = vec4(clamp((c + (n + s + w + e) * wgt) / (1.0 + 4.0 * wgt), 0.0, 1.0), 1.0);
}
"""

var rect: ColorRect
var mat: ShaderMaterial


func _init() -> void:
	layer = -1                                  # под интерфейсом и под всем, что рисуется в 2D
	rect = ColorRect.new()
	rect.mouse_filter = Control.MOUSE_FILTER_IGNORE
	var sh := Shader.new()
	sh.code = SHADER
	mat = ShaderMaterial.new()
	mat.shader = sh
	rect.material = mat
	add_child(rect)
	rect.set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)


## level: 0 — выключено, 1 — мягкая, 2 — сильная; scale — доля разрешения, в которой сейчас рисуется 3D
func set_level(level: int, scale: float) -> void:
	visible = level > 0
	if level <= 0:
		return
	# при 100 % усиливать почти нечего — мягче; чем сильнее растянута картинка, тем заметнее и шире проход
	var soft := clampf((1.0 - scale) / 0.38, 0.0, 1.0)
	mat.set_shader_parameter("amount", ([0.0, 0.35, 0.8][clampi(level, 0, 2)] as float) + 0.2 * soft)
	mat.set_shader_parameter("radius", lerpf(1.0, 1.3, soft))
