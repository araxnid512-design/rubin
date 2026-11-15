class_name BCProbe
extends SkeletonModifier3D
## Замер итоговой позы (после всех модификаторов): положения выбранных костей в системе скелета. Вне расчёта
## скелет отдаёт позу клипа без поправок, поэтому проверки читают итог отсюда. Стоит последним в цепочке.

var bones := ["Hip", "Head", "Spine02", "L_Hand", "R_Hand", "L_Forearm", "R_Forearm", "L_Foot", "R_Foot", "L_Calf", "R_Calf", "L_ToeBase", "R_ToeBase"]
var pos := {}                 ## кость → Vector3
var rot := {}                 ## кость → Basis
var _idx := {}


func _process_modification() -> void:
	var s := get_skeleton()
	if _idx.is_empty():
		for b in bones:
			_idx[b] = s.find_bone(b)
	for b in bones:
		var i: int = _idx[b]
		if i >= 0:
			var g := s.get_bone_global_pose(i)
			pos[b] = g.origin
			rot[b] = g.basis
