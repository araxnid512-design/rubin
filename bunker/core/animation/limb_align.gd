class_name BCLimbAlign
extends SkeletonModifier3D
## Колено и локоть «смотрят» туда, куда сгибаются (BunkerCore). В части клипов Tripo (попадания, боевая стойка,
## подъём по ступеням) бедро закручено вокруг своей оси, а голень сгибается в другой плоскости: коленная чашечка
## смотрит внутрь, а голень уходит вперёд-вбок (проверка QA — «колено выворот» 26–59°, «локоть выворот» до 49°).
## Модификатор поворачивает бедро (плечо) вокруг его оси так, чтобы плоскость сгиба сустава совпала с реальным
## положением голени (предплечья), и обратным поворотом голени сохраняет положение стопы (кисти) — стопа и кисть
## остаются там же, где в клипе, меняется только разворот колена (локтя). Почти прямой сустав не трогается
## (плоскость сгиба не определена), переразгиб — тоже (это другой дефект).

@export var min_flex := deg_to_rad(15.0)
@export var full_flex := deg_to_rad(35.0)
@export var tolerance := deg_to_rad(6.0)
@export var max_fix := deg_to_rad(60.0)

var _chains: Array = []        ## [бедро/плечо, голень/предплечье, стопа/кисть, направление сгиба в системе проксимальной кости]


func _setup() -> void:
	var s := get_skeleton()
	if s == null:
		return
	_chains.clear()
	var lt := s.find_bone("L_Thigh")
	var rt := s.find_bone("R_Thigh")
	if lt < 0 or rt < 0:
		return
	var U := Vector3.UP
	var R := s.get_bone_global_rest(rt).origin - s.get_bone_global_rest(lt).origin
	R = (R - U * R.dot(U)).normalized()
	var F := U.cross(R).normalized()
	for sd in ["L", "R"]:
		# колено сгибается назад, локоть — вперёд
		for ch in [[sd + "_Thigh", sd + "_Calf", sd + "_Foot", -F], [sd + "_Upperarm", sd + "_Forearm", sd + "_Hand", F]]:
			var a := s.find_bone(ch[0])
			var b := s.find_bone(ch[1])
			var c := s.find_bone(ch[2])
			if a < 0 or b < 0 or c < 0:
				continue
			var A := s.get_bone_global_rest(a)
			var d := (s.get_bone_global_rest(b).origin - A.origin).normalized()
			var want: Vector3 = ch[3]
			var fd := (want - d * want.dot(d)).normalized()
			_chains.append([a, b, c, A.basis.orthonormalized().inverse() * fd])


func _process_modification_with_delta(_delta: float) -> void:
	var s := get_skeleton()
	if s == null:
		return
	if _chains.is_empty():
		_setup()
	for ch in _chains:
		var GA := s.get_bone_global_pose(ch[0])
		var GB := s.get_bone_global_pose(ch[1])
		var C := s.get_bone_global_pose(ch[2]).origin
		var d1 := (GB.origin - GA.origin).normalized()
		var d2 := (C - GB.origin).normalized()
		var flex := d1.angle_to(d2)
		if flex < min_flex:
			continue
		var fd: Vector3 = GA.basis.orthonormalized() * (ch[3] as Vector3)
		var h := d1.cross(fd).normalized()
		var n := d1.cross(d2).normalized()
		var phi := h.signed_angle_to(n, d1)
		if absf(phi) < tolerance or absf(phi) > deg_to_rad(85.0):
			continue
		var w := clampf((flex - min_flex) / (full_flex - min_flex), 0.0, 1.0)
		w = w * w * (3.0 - 2.0 * w)
		# у 90° плоскость сгиба «перевёрнута» (это скорее переразгиб) — поправка плавно уходит, без скачка
		w *= clampf((deg_to_rad(85.0) - absf(phi)) / deg_to_rad(30.0), 0.0, 1.0)
		var fix := clampf(phi - signf(phi) * tolerance, -max_fix, max_fix) * w
		# бедро (плечо) — вокруг своей оси; голень (предплечье) — обратно, чтобы стопа (кисть) осталась на месте
		GA.basis = Basis(d1, fix) * GA.basis
		s.set_bone_global_pose(ch[0], GA)
		var GB2 := s.get_bone_global_pose(ch[1])
		GB2.basis = Basis(d1, -fix) * GB2.basis
		s.set_bone_global_pose(ch[1], GB2)
