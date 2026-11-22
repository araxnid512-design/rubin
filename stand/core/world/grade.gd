class_name ULGrade
extends RefCounted
## Цветокоррекция по таблице (data/grade.json). Таблица 17×17×17 строится из нескольких чисел (подкраска теней и
## светов, насыщенность, S-кривая, выцветание) и ставится в Environment.adjustment_color_correction — её применяет
## тот же проход, что и тонмаппинг, поэтому для телефона она почти бесплатна (проверено: в отрисовщике
## «Совместимость» таблица работает). Настроение складывается: локация + дождь + стадия голода заражённых.
## Средняя яркость при этом почти не меняется (после подкраски уровень серого возвращается к исходному).

const CFG := "res://data/grade.json"
const N := 17
static var _c := {}


static func cfg() -> Dictionary:
	if _c.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_c = d if d is Dictionary else {"looks": {}}
	return _c


## настроение: локация (+ дождь, + стадия голода 0…3)
static func look(place: String, rain := false, hunger := 0) -> Dictionary:
	var l: Dictionary = (cfg().get("looks", {}) as Dictionary).get(place, (cfg().looks as Dictionary).get("cowshed", {})).duplicate()
	if rain:
		l = mix_add(l, cfg().get("rain", {}))
	var hs: Array = cfg().get("hunger", [])
	if hunger >= 2 and hunger - 1 < hs.size():
		l = mix_add(l, hs[hunger - 1])
	return l


## сложить настроения: подкраски теней складываются, светов и насыщенность — перемножаются, прочее — складывается
static func mix_add(a: Dictionary, b: Dictionary) -> Dictionary:
	var o := a.duplicate()
	for k in b:
		match String(k):
			"lift":
				var la: Array = a.get("lift", [0.0, 0.0, 0.0])
				o.lift = [float(la[0]) + float(b.lift[0]), float(la[1]) + float(b.lift[1]), float(la[2]) + float(b.lift[2])]
			"gain":
				var ga: Array = a.get("gain", [1.0, 1.0, 1.0])
				o.gain = [float(ga[0]) * float(b.gain[0]), float(ga[1]) * float(b.gain[1]), float(ga[2]) * float(b.gain[2])]
			"sat":
				o.sat = float(a.get("sat", 1.0)) * float(b.sat)
			"vig_tint":
				o.vig_tint = b.vig_tint
			_:
				o[k] = float(a.get(k, 0.0)) + float(b[k])
	return o


## плавный переход между настроениями (t 0…1)
static func lerp_look(a: Dictionary, b: Dictionary, t: float) -> Dictionary:
	var o := {}
	for k in ["lift", "gain"]:
		var d0: Array = [0.0, 0.0, 0.0] if k == "lift" else [1.0, 1.0, 1.0]
		var x: Array = a.get(k, d0)
		var y: Array = b.get(k, d0)
		o[k] = [lerpf(float(x[0]), float(y[0]), t), lerpf(float(x[1]), float(y[1]), t), lerpf(float(x[2]), float(y[2]), t)]
	for k in ["sat", "curve", "fade", "vig", "grain"]:
		var dv := 1.0 if k == "sat" else 0.0
		o[k] = lerpf(float(a.get(k, dv)), float(b.get(k, dv)), t)
	var ta: Array = a.get("vig_tint", [1.0, 1.0, 1.0])
	var tb: Array = b.get("vig_tint", [1.0, 1.0, 1.0])
	o.vig_tint = [lerpf(float(ta[0]), float(tb[0]), t), lerpf(float(ta[1]), float(tb[1]), t), lerpf(float(ta[2]), float(tb[2]), t)]
	return o


## цвет после таблицы (то же, что пишется в таблицу; для проверок)
static func apply_color(c: Color, l: Dictionary) -> Color:
	var lift: Array = l.get("lift", [0.0, 0.0, 0.0])
	var gain: Array = l.get("gain", [1.0, 1.0, 1.0])
	var sat := float(l.get("sat", 1.0))
	var curve := float(l.get("curve", 0.0))
	var fade := float(l.get("fade", 0.0))
	var v := Vector3(c.r, c.g, c.b)
	var y0 := v.dot(Vector3(0.2126, 0.7152, 0.0722))
	# подкраска: тени — прибавкой (сильнее в тёмном), света — множителем (сильнее в светлом)
	var lv := Vector3(float(lift[0]), float(lift[1]), float(lift[2])) * (1.0 - y0)
	var gv := Vector3.ONE.lerp(Vector3(float(gain[0]), float(gain[1]), float(gain[2])), y0)
	v = (v + lv) * gv
	# насыщенность вокруг яркости точки
	var y1 := v.dot(Vector3(0.2126, 0.7152, 0.0722))
	v = Vector3(y1, y1, y1).lerp(v, sat)
	# серый уровень — как был (подкраска не делает кадр темнее или светлее)
	var y2 := v.dot(Vector3(0.2126, 0.7152, 0.0722))
	if y2 > 0.0001:
		v *= y1 / y2
	if absf(y1 - y0) > 0.0 and y1 > 0.0001:
		v *= lerpf(1.0, y0 / y1, 0.85)
	# S-кривая: середина контрастнее, края мягче
	var s := Vector3(_s(v.x), _s(v.y), _s(v.z))
	v = v.lerp(s, curve)
	# выцветание: чёрный приподнят
	v = v * (1.0 - fade) + Vector3.ONE * fade
	return Color(clampf(v.x, 0.0, 1.0), clampf(v.y, 0.0, 1.0), clampf(v.z, 0.0, 1.0))


static func _s(x: float) -> float:
	x = clampf(x, 0.0, 1.0)
	return x * x * (3.0 - 2.0 * x)


## слои таблицы (можно считать в фоновом потоке)
static func lut_images(l: Dictionary) -> Array[Image]:
	var imgs: Array[Image] = []
	for z in N:
		var im := Image.create(N, N, false, Image.FORMAT_RGB8)
		for y in N:
			for x in N:
				im.set_pixel(x, y, apply_color(Color(float(x) / (N - 1), float(y) / (N - 1), float(z) / (N - 1)), l))
		imgs.append(im)
	return imgs


static func lut(l: Dictionary) -> ImageTexture3D:
	var imgs := lut_images(l)
	var t := ImageTexture3D.new()
	t.create(Image.FORMAT_RGB8, N, N, N, false, imgs)
	return t
