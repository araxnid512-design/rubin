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
	for i in _static.size():
		var s: Array = _static[i]
		var sz: Vector2 = s[1] * 1.35 + Vector2(0.35, 0.35)
		var b := Basis(Vector3.UP, float(s[2])).scaled(Vector3(sz.x, 1.0, sz.y))
		_mm_static.multimesh.set_instance_transform(i, Transform3D(b, (s[0] as Vector3) + Vector3.UP * 0.025))
		_mm_static.multimesh.set_instance_custom_data(i, Color(float(s[3]), 0, 0, 0))
	if _mm_dyn == null:
		_mm_dyn = _make(max_dyn)
		_mm_dyn.multimesh.visible_instance_count = 0


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
