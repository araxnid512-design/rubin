class_name ULEliteLook
extends SkeletonModifier3D
## Поворот головы Элиты к цели поверх движения: шея и голова доворачиваются к точке target (в мире) с весом
## weight, не дальше пределов (yaw_max — вбок, pitch_max — вверх-вниз). Используется, когда Элита замечает
## героя, следит за ним в ожидании и осматривается. Доля поворота: шея — neck_k, голова — остальное.

var target := Vector3.INF
var weight := 0.0
var yaw_max := deg_to_rad(55.0)
var pitch_max := deg_to_rad(22.0)
var neck_k := 0.45
var bones := ["Neck1", "Neck2", "Head"]
var _idx: Array = []


func _process_modification() -> void:
	var sk := get_skeleton()
	if sk == null or weight <= 0.001 or target == Vector3.INF:
		return
	if _idx.is_empty():
		for b in bones:
			_idx.append(sk.find_bone(String(b)))
		if _idx.has(-1):
			_idx.clear()
			return
	var head := int(_idx[_idx.size() - 1])
	var gt := sk.global_transform
	var hp: Transform3D = gt * sk.get_bone_global_pose(head)
	# куда смотрит морда сейчас (ось +Z кости головы в мире) и куда надо
	var fwd := (hp.basis * Vector3(0, 0, 1)).normalized()
	var want := (target - hp.origin)
	if want.length() < 0.2:
		return
	want = want.normalized()
	# раздельно: поворот вбок (вокруг вертикали) и наклон
	var yaw := clampf(angle_difference(atan2(fwd.x, fwd.z), atan2(want.x, want.z)), -yaw_max, yaw_max) * weight
	var pf := asin(clampf(fwd.y, -1.0, 1.0))
	var pw := asin(clampf(want.y, -1.0, 1.0))
	var pitch := clampf(pw - pf, -pitch_max, pitch_max) * weight
	var n := _idx.size()
	for i in n:
		var bi := int(_idx[i])
		var share := neck_k / float(n - 1) if i < n - 1 else 1.0 - neck_k
		var g: Transform3D = sk.get_bone_global_pose(bi)
		var wb: Basis = gt.basis.orthonormalized()
		# вертикаль и ось наклона — в пространстве скелета
		var up_l := (wb.inverse() * Vector3.UP).normalized()
		var side_w := Vector3(want.z, 0, -want.x).normalized() if Vector2(want.x, want.z).length() > 0.01 else Vector3.RIGHT
		var side_l := (wb.inverse() * side_w).normalized()
		var q := Quaternion(up_l, yaw * share) * Quaternion(side_l, -pitch * share)
		g.basis = Basis(q) * g.basis
		sk.set_bone_global_pose(bi, g)
