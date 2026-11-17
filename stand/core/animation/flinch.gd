class_name BCFlinch
extends SkeletonModifier3D
## Отшатывание от удара: поясница, грудь, шея и голова коротко дёргаются в сторону удара (по направлению «от
## ударившего») и за ~0.4 с возвращаются — поверх любой анимации, без отдельного клипа. Руки, оружие и голова
## идут вместе с корпусом (их кости — дочерние). Сила — от урона.

const BONES := [["Waist", 0.22], ["Spine01", 0.3], ["Spine02", 0.26], ["NeckTwist01", 0.12], ["Head", 0.1]]
const PEAK := 0.07                ## через сколько секунд отшатывание сильнее всего
var _bi: Array = []
var _t := 99.0
var _amp := 0.0
var _dir := Vector3.ZERO          ## куда толкнуло (мировые координаты, по земле)


## толкнуло в сторону push (мировой вектор, по земле) с силой k (0…1.5)
func hit(push: Vector3, k: float) -> void:
	push.y = 0.0
	if push.length() < 0.01:
		return
	_dir = push.normalized()
	_amp = clampf(k, 0.2, 1.5) * 0.42
	_t = 0.0


func _process_modification_with_delta(delta: float) -> void:
	if _t > 0.8:
		return
	var s := get_skeleton()
	if s == null:
		return
	_t += delta
	if _bi.is_empty():
		for b in BONES:
			_bi.append([s.find_bone(String(b[0])), float(b[1])])
	# толчок: быстрый рост к PEAK, затем затухание (x·e^(1−x)), лёгкий отскок назад в конце
	var x := _t / PEAK
	var a := _amp * x * exp(1.0 - x) - _amp * 0.12 * sin(clampf((_t - 0.25) / 0.45, 0.0, 1.0) * PI)
	if absf(a) < 0.0005:
		return
	var sb := s.global_transform.basis.orthonormalized()
	# ось наклона: перпендикулярно толчку по земле — корпус клонится в сторону толчка
	var axis_w := Vector3.UP.cross(_dir).normalized()
	var axis := (sb.inverse() * axis_w).normalized()
	for bw in _bi:
		var bi: int = bw[0]
		if bi < 0:
			continue
		var g := s.get_bone_global_pose(bi)
		g.basis = Basis(axis, a * float(bw[1])) * g.basis
		s.set_bone_global_pose(bi, g)
