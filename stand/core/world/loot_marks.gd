class_name ULLootMarks
extends MultiMeshInstance3D
## Подсветка того, что можно взять: под каждым предметом на земле рядом с героем — мягкое золотистое кольцо,
## которое «дышит». Одна сетка-множество (один вызов отрисовки), положения обновляются несколько раз в секунду.

const MAX := 24
const SHADER := """shader_type spatial;
render_mode unshaded, blend_add, depth_draw_never, cull_disabled, shadows_disabled;
void fragment() {
	float r = length(UV - 0.5) * 2.0;
	float ring = smoothstep(0.55, 0.78, r) * (1.0 - smoothstep(0.82, 1.0, r));
	float core = (1.0 - smoothstep(0.0, 0.75, r)) * 0.28;
	float pulse = 0.65 + 0.35 * sin(TIME * 3.2);
	ALBEDO = vec3(1.0, 0.8, 0.32) * (ring * 0.75 + core) * pulse;
}
"""


func _init() -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var q := QuadMesh.new()
	q.size = Vector2.ONE
	q.orientation = PlaneMesh.FACE_Y
	mm.mesh = q
	mm.instance_count = MAX
	mm.visible_instance_count = 0
	multimesh = mm
	var mat := ShaderMaterial.new()
	var sh := Shader.new()
	sh.code = SHADER
	mat.shader = sh
	mat.render_priority = 2
	material_override = mat
	cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	custom_aabb = AABB(Vector3(-500, -20, -500), Vector3(1000, 60, 1000))


## pts — [где (на земле), размер кольца, м]
func show_at(pts: Array) -> void:
	var n := mini(pts.size(), MAX)
	for i in n:
		var s := float(pts[i][1])
		multimesh.set_instance_transform(i, Transform3D(Basis().scaled(Vector3(s, 1.0, s)), (pts[i][0] as Vector3) + Vector3.UP * 0.06))
	multimesh.visible_instance_count = n
