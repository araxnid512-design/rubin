class_name ULBlobs
extends Node3D
## Мягкие пятна-тени на земле и полу: под мебелью, техникой, ящиками и под героем с врагами. Настоящие тени от
## солнца отбрасывают только стены и крыши (на телефоне дорого), а без тени предмет «висит» над землёй —
## пятно сажает его на место почти бесплатно: все неподвижные пятна — одна сетка-множество (MultiMesh, один вызов
## отрисовки), все движущиеся (герой, враги) — вторая, её положения обновляются каждый кадр.

const SHADER := """shader_type spatial;
render_mode unshaded, blend_mix, depth_draw_never, cull_disabled, shadows_disabled;
// пятно: тёмное в середине, к краю мягко сходит на нет; сила — в цвете экземпляра (альфа)
varying float k;
void vertex() { k = INSTANCE_CUSTOM.r; }
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = (1.0 - smoothstep(0.25, 1.0, r)) * k;
	ALBEDO = vec3(0.02, 0.018, 0.015);
	ALPHA = a;
}
"""

static var _mat: ShaderMaterial = null
var _static: Array = []            ## [где, размер (x, z), поворот, сила]
var _mm_static: MultiMeshInstance3D
var _mm_dyn: MultiMeshInstance3D
var max_dyn := 64


static func material() -> ShaderMaterial:
	if _mat == null:
		_mat = ShaderMaterial.new()
		var sh := Shader.new()
		sh.code = SHADER
		_mat.shader = sh
	return _mat


static func _quad() -> QuadMesh:
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	q.orientation = PlaneMesh.FACE_Y
	return q


## неподвижное пятно: size — размер предмета по земле (пятно чуть шире), strength — насколько тёмное
func add_static(at: Vector3, size: Vector2, yaw := 0.0, strength := 0.55) -> void:
	_static.append([at, size, yaw, strength])


## собрать неподвижные пятна в одну сетку (после того как локация расставила предметы)
func build() -> void:
	if _mm_static != null:
		_mm_static.queue_free()
	_mm_static = _make(_static.size())
	var kk := _levelled()
	for i in _static.size():
		var s: Array = _static[i]
		var sz: Vector2 = _size(s)
		# размер — по своим осям пятна, потом поворот (Basis.scaled растягивает по осям мира: у повёрнутых предметов
		# пятно ложилось поперёк — тёмные полосы через ряды кресел, тень сбоку от фюзеляжа)
		var b := Basis(Vector3.UP, float(s[2])) * Basis.from_scale(Vector3(sz.x, 1.0, sz.y))
		_mm_static.multimesh.set_instance_transform(i, Transform3D(b, (s[0] as Vector3) + Vector3.UP * 0.025))
		_mm_static.multimesh.set_instance_custom_data(i, Color(float(kk[i]), 0, 0, 0))
	if _mm_dyn == null:
		_mm_dyn = _make(max_dyn)
		_mm_dyn.multimesh.visible_instance_count = 0


## размер пятна по земле: чуть шире предмета
## (у крупных — вагон, самолёт, штабель — запас не растёт с размером: иначе вокруг них тёмный ореол на 2–3 м)
static func _size(s: Array) -> Vector2:
	var b: Vector2 = s[1]
	return b + Vector2(minf(b.x * 0.35, 0.9), minf(b.y * 0.35, 0.9)) + Vector2(0.35, 0.35)


## насколько темно пятно s в точке p (0…сила): та же формула, что в шейдере
static func _dark_at(s: Array, p: Vector3) -> float:
	var sz := _size(s)
	var l: Vector3 = Basis(Vector3.UP, float(s[2])).inverse() * (p - (s[0] as Vector3))
	if absf(p.y - (s[0] as Vector3).y) > 1.2:
		return 0.0                                   # другой этаж
	var r := Vector2(l.x / (sz.x * 0.5), l.z / (sz.y * 0.5)).length()
	return (1.0 - smoothstep(0.25, 1.0, r)) * float(s[3])


## Сила каждого пятна с поправкой на соседей. Пятна стоят вплотную (ряды кресел в зале, штабеля ящиков, пульт
## из нескольких частей) — и накладываются: четыре пятна по 0,6 дают почти чёрную кляксу вместо мягкой тени.
## Здесь считается, насколько темно под каждым пятном вместе с соседями, и если темнее MAX_DARK — пятно
## ослабляется так, чтобы группа в сумме была как одно пятно. Крупные предметы (длиннее 5 м) — тень слабее:
## большое ровное тёмное пятно сверху выглядит дырой в полу.
const MAX_DARK := 0.6
const CELL := 3.0

func _levelled() -> Array:
	var n := _static.size()
	var grid := {}
	for i in n:
		var s: Array = _static[i]
		var sz := _size(s)
		var rr := maxf(sz.x, sz.y) * 0.5
		var p: Vector3 = s[0]
		for cx in range(int(floor((p.x - rr) / CELL)), int(floor((p.x + rr) / CELL)) + 1):
			for cz in range(int(floor((p.z - rr) / CELL)), int(floor((p.z + rr) / CELL)) + 1):
				var key := Vector2i(cx, cz)
				if not grid.has(key):
					grid[key] = []
				(grid[key] as Array).append(i)
	var out := []
	out.resize(n)
	for i in n:
		var s: Array = _static[i]
		var p: Vector3 = s[0]
		var own := float(s[3])
		if maxf((s[1] as Vector2).x, (s[1] as Vector2).y) > 5.0:
			own *= 0.75
		var light := 1.0 - own                       # сколько света остаётся под пятном
		for j in grid.get(Vector2i(int(floor(p.x / CELL)), int(floor(p.z / CELL))), []):
			if j != i:
				light *= 1.0 - _dark_at(_static[j], p)
		var dark := 1.0 - light
		if dark > MAX_DARK and own > 0.001 and own < 0.999:
			# во столько раз уменьшить «плотность» тени, чтобы вместе вышло MAX_DARK
			var f := log(1.0 - MAX_DARK) / log(maxf(1.0 - dark, 0.0001))
			own = 1.0 - pow(1.0 - own, f)
		out[i] = own
	return out


func _make(n: int) -> MultiMeshInstance3D:
	var mi := MultiMeshInstance3D.new()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	mm.mesh = _quad()
	mm.instance_count = maxi(n, 1)
	mm.visible_instance_count = n
	mi.multimesh = mm
	mi.material_override = material()
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	mi.layers = 3
	add_child(mi)
	return mi


## движущиеся пятна: [[где (ноги), радиус, сила], …] — каждый кадр
func set_dynamic(items: Array) -> void:
	if _mm_dyn == null:
		_mm_dyn = _make(max_dyn)
	var n := mini(items.size(), max_dyn)
	for i in n:
		var it: Array = items[i]
		var r := float(it[1]) * 2.0
		_mm_dyn.multimesh.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(r, 1.0, r)), (it[0] as Vector3) + Vector3.UP * 0.03))
		_mm_dyn.multimesh.set_instance_custom_data(i, Color(float(it[2]), 0, 0, 0))
	_mm_dyn.multimesh.visible_instance_count = n


func static_count() -> int:
	return _static.size()
