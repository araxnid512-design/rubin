class_name BCGroundClamp
extends SkeletonModifier3D
## Тело не висит над полом. В части клипов Tripo (подъём с земли, падение) таз записан на высоте стоящего
## человека: лежащий персонаж парит в воздухе. Модификатор для клипов с пометкой "ground" в описании находит
## самую низкую кость и опускает (или поднимает) всё тело так, чтобы она лежала на полу. Вес плавный — без рывка
## при входе в клип и выходе из него.

var weight := 0.0                 ## 0 — не трогать, 1 — прижать к полу (задаёт BCCharacter)
var floor_y := 0.0                ## пол в системе скелета
var body_r := 0.045               ## «толщина» тела у кости, ед. скелета (кость — внутри тела)
var last_shift := 0.0             ## на сколько сдвинуто, ед. (для проверки)
var _root := -1
var _skip := {}


func _setup() -> void:
	var s := get_skeleton()
	_root = 0
	for i in s.get_bone_count():
		if s.get_bone_parent(i) < 0:
			_root = i
			break
	# кости-помощники (скручивание, «share») лежат внутри других — не считаем
	for i in s.get_bone_count():
		var n := s.get_bone_name(i)
		if n.contains("Twist") or n.contains("Share") or n.contains("Eye") or n.contains("Facial"):
			_skip[i] = true


func _process_modification() -> void:
	last_shift = 0.0
	if weight <= 0.001:
		return
	var s := get_skeleton()
	if _root < 0:
		_setup()
	var mn := 1e9
	for i in s.get_bone_count():
		if not _skip.has(i):
			mn = minf(mn, s.get_bone_global_pose(i).origin.y)
	var shift := (floor_y + body_r - mn) * weight
	if absf(shift) < 0.0005:
		return
	last_shift = shift
	s.set_bone_pose_position(_root, s.get_bone_pose_position(_root) + Vector3(0, shift, 0))
