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
var smooth := 0.0                ## > 0 — сдвиг сглаживается (стоя и на ходу: без подпрыгивания на каждом шаге)
var _s := 0.0
var rest_r := 0.0                 ## на какой высоте над полом самая низкая кость в исходной позе (стоит на подошвах)


## замер исходной позы: высота самой низкой кости над полом — так стоят стопы, когда подошвы на полу
func measure_rest() -> void:
	var s := get_skeleton()
	if s == null:
		return
	if _root < 0:
		_setup()
	var mn := 1e9
	for i in s.get_bone_count():
		if not _skip.has(i):
			mn = minf(mn, s.get_bone_global_rest(i).origin.y)
	rest_r = maxf(mn - floor_y, 0.0)
var _root := -1
var _skip := {}
var _low: PackedInt32Array = []   ## кости ног (бедро и ниже): стоя самая низкая кость — среди них
var legs_only := false            ## стоя и на ходу — смотреть только ноги (втрое меньше костей; задаёт BCCharacter)


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
		elif n.contains("Thigh") or n.contains("Calf") or n.contains("Foot") or n.contains("Toe"):
			_low.append(i)


func _process_modification() -> void:
	last_shift = 0.0
	if weight <= 0.001:
		return
	var s := get_skeleton()
	if _root < 0:
		_setup()
	var mn := 1e9
	if legs_only and _low.size() >= 4:
		for i in _low:
			mn = minf(mn, s.get_bone_global_pose(i).origin.y)
	else:
		for i in s.get_bone_count():
			if not _skip.has(i):
				mn = minf(mn, s.get_bone_global_pose(i).origin.y)
	var shift := (floor_y + body_r - mn) * weight
	if smooth > 0.0:
		_s = lerpf(_s, shift, 1.0 - exp(-get_process_delta_time() * smooth))
		shift = _s
	else:
		_s = shift
	if absf(shift) < 0.0005:
		return
	last_shift = shift
	s.set_bone_pose_position(_root, s.get_bone_pose_position(_root) + Vector3(0, shift, 0))
