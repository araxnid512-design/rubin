class_name SkinFollow
extends Node
## Новая модель героя (Tripo, свой скелет из 78 костей) повторяет позу скелета героя из player.glb: все 24 готовых
## клипа (автомат, пистолет, топор, смена оружия, перезарядка, смерть), дерево анимаций, поворот корпуса, отдача и IK
## левой кисти работают как прежде — на старом (скрытом) скелете, а новая сетка следует за ним.
##
## Перенос (проверен рендером на всех клипах): у каждой кости новой модели, у которой нашлась пара в старом скелете
## (по имени: Hip/Hips, Waist/Spine, L_Upperarm/LeftArm, пальцы…), мировой поворот = поворот парной кости × поправка
## покоя (модели предварительно развёрнуты лицом в одну сторону — Gear.hero); длины костей — свои (пропорции модели
## не ломаются), таз — на высоте старого с поправкой роста. Затем руки и ноги доводятся двухзвенным IK: кисть и
## стопа — точно туда, где кисть и стопа старого (кисть держит оружие ровно, ступни не скользят), локоть и колено —
## в сторону старых. Кости без пары (скручивающие, лицо) — в позе покоя относительно родителя. Обновление — после
## модификаторов старого скелета (сигнал skeleton_updated), то есть уже с поворотом корпуса, отдачей и IK.

var src: Skeleton3D
var dst: Skeleton3D
var pairs: Array = []        # [индекс в dst, индекс в src, поправка покоя Quaternion]
var order: Array[int] = []   # кости dst от корня к листьям
var chains: Array = []       # [dst верх, dst середина, dst конец, src середина, src конец]
var hips := -1
var hip_k := 1.0
var _world: Array[Transform3D] = []
var _by_dst := {}            # индекс dst → пара

static func _norm(n: String) -> String:
	var s := n.to_lower()
	for p in ["mixamorig:", "mixamorig_", "mixamorig", "tripo_", "bip01_", "bip001_", "def-", "def_", "armature_"]:
		if s.begins_with(p):
			s = s.substr(p.length())
	s = s.replace(" ", "").replace("_", "").replace(".", "").replace("-", "").replace(":", "")
	return s

## Короткое имя Mixamo по имени кости другого скелета (или "", если не узнали).
static func mixamo_name(n: String) -> String:
	var s := _norm(n)
	var side := ""
	for pre in ["left", "l"]:
		if s.begins_with(pre) and s.length() > pre.length():
			side = "Left"
			s = s.substr(pre.length())
			break
	if side == "":
		for pre in ["right", "r"]:
			if s.begins_with(pre) and s.length() > pre.length():
				side = "Right"
				s = s.substr(pre.length())
				break
	if side == "":
		for suf in ["left", "l"]:
			if s.ends_with(suf) and s.length() > suf.length():
				side = "Left"
				s = s.substr(0, s.length() - suf.length())
				break
	if side == "":
		for suf in ["right", "r"]:
			if s.ends_with(suf) and s.length() > suf.length():
				side = "Right"
				s = s.substr(0, s.length() - suf.length())
				break
	# (имена Tripo: Hip → Pelvis, Waist → Spine01 → Spine02 → NeckTwist01 → Head)
	const BODY := {"hips": "Hips", "hip": "Hips", "pelvis": "Hips", "root": "", "spine": "Spine", "waist": "Spine",
		"spine0": "Spine", "spine1": "Spine1", "spine01": "Spine1", "spine2": "Spine2", "spine02": "Spine2",
		"chest": "Spine1", "upperchest": "Spine2", "neck": "Neck", "neck1": "Neck", "necktwist01": "Neck", "head": "Head"}
	const LIMB := {"shoulder": "Shoulder", "clavicle": "Shoulder", "collar": "Shoulder", "arm": "Arm", "upperarm": "Arm",
		"forearm": "ForeArm", "lowerarm": "ForeArm", "elbow": "ForeArm", "hand": "Hand", "wrist": "Hand",
		"upleg": "UpLeg", "thigh": "UpLeg", "upperleg": "UpLeg", "leg": "Leg", "calf": "Leg", "shin": "Leg",
		"lowerleg": "Leg", "knee": "Leg", "foot": "Foot", "ankle": "Foot", "toebase": "ToeBase", "toe": "ToeBase",
		"toes": "ToeBase", "ball": "ToeBase",
		"thumb1": "HandThumb1", "thumb2": "HandThumb2", "thumb3": "HandThumb3",
		"index1": "HandIndex1", "index2": "HandIndex2", "index3": "HandIndex3",
		"mid1": "HandMiddle1", "mid2": "HandMiddle2", "mid3": "HandMiddle3",
		"middle1": "HandMiddle1", "middle2": "HandMiddle2", "middle3": "HandMiddle3",
		"ring1": "HandRing1", "ring2": "HandRing2", "ring3": "HandRing3",
		"pinky1": "HandPinky1", "pinky2": "HandPinky2", "pinky3": "HandPinky3"}
	if side == "":
		return BODY.get(s, "")
	var limb: String = LIMB.get(s, "")
	return (side + limb) if limb != "" else ""

## Кость скелета player.glb по короткому имени Mixamo («Spine», «LeftHand»): с приставкой mixamorig или без.
static func src_bone(sk: Skeleton3D, short: String) -> int:
	for n in ["mixamorig" + short, short, "mixamorig_" + short, "mixamorig:" + short]:
		var i := sk.find_bone(n)
		if i >= 0:
			return i
	return -1

## Кость скелета по имени Mixamo (первая подходящая) или -1.
static func find_mixamo(sk: Skeleton3D, m: String) -> int:
	for i in sk.get_bone_count():
		if mixamo_name(str(sk.get_bone_name(i))) == m:
			return i
	return -1

## Связать: src — скелет из player.glb (анимированный), dst — скелет новой модели. Обе — в позе покоя и уже
## развёрнуты лицом в одну сторону (Gear.hero).
func bind(source: Skeleton3D, target: Skeleton3D) -> int:
	src = source
	dst = target
	pairs.clear()
	var used := {}
	for i in dst.get_bone_count():
		var m := mixamo_name(str(dst.get_bone_name(i)))
		if m == "" or used.has(m):
			continue
		var j := src_bone(src, m)
		if j < 0:
			continue
		used[m] = true
		var ws := src.global_transform * src.get_bone_global_rest(j)
		var wd := dst.global_transform * dst.get_bone_global_rest(i)
		var fix := ws.basis.get_rotation_quaternion().inverse() * wd.basis.get_rotation_quaternion()
		pairs.append([i, j, fix])
		if m == "Hips":
			hips = i
	_by_dst.clear()
	for p in pairs:
		_by_dst[p[0]] = p
	# таз: поправка роста (высота таза новой / старой над ступнями)
	var src_hips := src_bone(src, "Hips")
	if hips >= 0 and src_hips >= 0:
		var hs := (src.global_transform * src.get_bone_global_rest(src_hips)).origin.y - src.global_position.y
		var hd := (dst.global_transform * dst.get_bone_global_rest(hips)).origin.y - src.global_position.y
		if hs > 0.01:
			hip_k = hd / hs
	# цепочки для IK
	chains.clear()
	for ch in [["LeftArm", "LeftForeArm", "LeftHand"], ["RightArm", "RightForeArm", "RightHand"],
			["LeftUpLeg", "LeftLeg", "LeftFoot"], ["RightUpLeg", "RightLeg", "RightFoot"]]:
		var du := find_mixamo(dst, ch[0])
		var dm := find_mixamo(dst, ch[1])
		var de := find_mixamo(dst, ch[2])
		var sm := src_bone(src, ch[1])
		var se := src_bone(src, ch[2])
		if du >= 0 and dm >= 0 and de >= 0 and sm >= 0 and se >= 0:
			chains.append([du, dm, de, sm, se])
	# порядок обхода: родитель раньше ребёнка
	order.clear()
	var queue: Array[int] = []
	for i in dst.get_bone_count():
		if dst.get_bone_parent(i) < 0:
			queue.append(i)
	while not queue.is_empty():
		var b: int = queue.pop_front()
		order.append(b)
		for c in dst.get_bone_children(b):
			queue.append(c)
	_world.resize(dst.get_bone_count())
	if not src.skeleton_updated.is_connected(_follow):
		src.skeleton_updated.connect(_follow)
	return pairs.size()

func _follow() -> void:
	if dst == null or not is_instance_valid(dst) or not dst.is_visible_in_tree():
		return
	var sgt := src.global_transform
	var dgt := dst.global_transform
	var sc := dgt.basis.get_scale()
	var root := src.global_position
	# 1) повороты — от старых костей, длины — свои; таз — по старому с поправкой роста
	for b in order:
		var parent := dst.get_bone_parent(b)
		var pw: Transform3D = _world[parent] if parent >= 0 else dgt
		var base: Transform3D = pw * dst.get_bone_rest(b)
		if _by_dst.has(b):
			var p: Array = _by_dst[b]
			var ws: Transform3D = sgt * src.get_bone_global_pose(p[1])
			var q: Quaternion = ws.basis.get_rotation_quaternion() * (p[2] as Quaternion)
			var pos := base.origin
			if b == hips:
				pos = root + (ws.origin - root) * hip_k
			_world[b] = Transform3D(Basis(q).scaled(sc), pos)
		else:
			_world[b] = base
	# 2) руки и ноги — двухзвенный IK к кистям и стопам старого
	for ch in chains:
		_ik(ch, sgt)
	# 3) положения — заново от родителей (повороты сохраняются), затем — в позу скелета
	var inv := dgt.affine_inverse()
	for b in order:
		var parent := dst.get_bone_parent(b)
		if b != hips:
			var pw2: Transform3D = _world[parent] if parent >= 0 else dgt
			var base2: Transform3D = pw2 * dst.get_bone_rest(b)
			_world[b] = Transform3D(_world[b].basis, base2.origin) if _by_dst.has(b) else base2
		var local: Transform3D = (inv * _world[b]) if parent < 0 else (_world[parent].affine_inverse() * _world[b])
		dst.set_bone_pose_position(b, local.origin)
		dst.set_bone_pose_rotation(b, local.basis.get_rotation_quaternion())

func _ik(ch: Array, sgt: Transform3D) -> void:
	var u: int = ch[0]
	var m: int = ch[1]
	var e: int = ch[2]
	var r := _world[u].origin
	var wm0: Transform3D = _world[u] * dst.get_bone_rest(m)
	var m0 := wm0.origin
	var e0 := (Transform3D(_world[m].basis, m0) * dst.get_bone_rest(e)).origin
	var t := (sgt * src.get_bone_global_pose(ch[4])).origin
	var pole := (sgt * src.get_bone_global_pose(ch[3])).origin
	var a := r.distance_to(m0)
	var bl := m0.distance_to(e0)
	if a < 0.0001 or bl < 0.0001:
		return
	var d := clampf(r.distance_to(t), 0.0001, (a + bl) * 0.999)
	var dir := (t - r).normalized()
	var n := dir.cross(pole - r)
	if n.length_squared() < 1e-10:
		n = Vector3.FORWARD
	n = n.normalized()
	var cos_a := clampf((a * a + d * d - bl * bl) / (2.0 * a * d), -1.0, 1.0)
	var mid := r + dir.rotated(n, acos(cos_a)) * a
	var end := r + dir * d
	_world[u] = _rot_to(_world[u], m0 - r, mid - r)
	var wm: Transform3D = _world[u] * dst.get_bone_rest(m)
	var mt := Transform3D(_world[m].basis, wm.origin)
	var e1 := (mt * dst.get_bone_rest(e)).origin
	_world[m] = _rot_to(mt, e1 - wm.origin, end - wm.origin)

static func _rot_to(t: Transform3D, from: Vector3, to: Vector3) -> Transform3D:
	if from.length_squared() < 1e-12 or to.length_squared() < 1e-12:
		return t
	var q := Quaternion(from.normalized(), to.normalized())
	return Transform3D(Basis(q) * t.basis, t.origin)
