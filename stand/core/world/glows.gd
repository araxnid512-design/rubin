class_name ULGlows
extends Node3D
## Лужи тёплого света на полу под лампами (как в Dawn of Zombies / Last Day): настоящих ламп с расчётом света на
## телефоне не держим, а пол под лампой должен быть светлее и теплее, углы — темнее. Все лужи — одна
## сетка-множество (один вызов отрисовки), рисуются сложением поверх пола.

const SHADER := """shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
varying vec4 c;
void vertex() { c = INSTANCE_CUSTOM; }
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float a = 1.0 - smoothstep(0.0, 1.0, r);
	ALBEDO = c.rgb * a * a * c.a;
}
"""

var _items: Array = []            ## [где, размер (x, z), цвет, сила]


func add(at: Vector3, size: Vector2, col := Color(1.0, 0.74, 0.42), strength := 0.3) -> void:
	_items.append([at, size, col, strength])


func clear() -> void:
	_items.clear()
	for ch in get_children():
		ch.queue_free()


func build() -> void:
	for ch in get_children():
		ch.queue_free()
	if _items.is_empty():
		return
	var mi := MultiMeshInstance3D.new()
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.use_custom_data = true
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	q.orientation = PlaneMesh.FACE_Y
	mm.mesh = q
	mm.instance_count = _items.size()
	for i in _items.size():
		var it: Array = _items[i]
		var sz: Vector2 = it[1]
		mm.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(sz.x, 1.0, sz.y)), it[0]))
		var col: Color = it[2]
		mm.set_instance_custom_data(i, Color(col.r, col.g, col.b, float(it[3])))
	mi.multimesh = mm
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SHADER
	mat.shader = sh
	mat.render_priority = 1
	mi.material_override = mat
	mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(mi)
