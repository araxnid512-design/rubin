class_name SkinFollow
extends Node
## Новая модель героя (Tripo, свой скелет из 78 костей) повторяет позу скелета героя из player.glb: все 24 готовых
## клипа (автомат, пистолет, топор, смена оружия, перезарядка, смерть), дерево анимаций, поворот корпуса, отдача и IK
## левой кисти работают как прежде — на старом (скрытом) скелете, а новая сетка следует за ним.
##
## Перенос (проверен рендером на всех клипах): у каждой кости новой модели, у которой нашлась пара в старом скелете
## (по имени: Hip/Hips, Waist/Spine, L_Upperarm/LeftArm, пальцы…), мировой поворот = поворот парной кости × поправка
## покоя (модели предварительно развёрнуты лицом в одну сторону — Gear.hero); длины костей — свои (пропорции модели
## не ломаются), таз — на высоте старого с поправкой роста. Кости без пары (скручивающие, лицо) — в позе покоя
## относительно родителя. Обновление — после модификаторов старого скелета (сигнал skeleton_updated), то есть уже с
## поворотом корпуса, переноской ствола, отдачей и IK.
##
## Руки (у модели Tripo плечевые суставы на ~10 см дальше назад, а запястье сидит глубже в предплечье, кисть длиннее):
##   • правая — двухзвенным IK так, чтобы точка хвата новой кисти (у костяшек, как узел GripR старой) легла на хват
##     старой; оружие висит в хвате НОВОЙ кисти (grip_node), поэтому, если рука не дотягивается, ствол идёт за ней;
##   • левая у двуручного ствола — на цевьё этого оружия (узел GripL модели ствола, как у старого), иначе — как у
##     старого; не достаёт — ключица навстречу (до CLAV_MAX), потом перехват цевья ближе (до SLIDE_MAX);
##   • пока ствол в переноске (не в прицеле), указательный палец правой лежит вдоль ствольной коробки, а не на спуске;
##   • ноги — IK к стопам старого (ступни не скользят), колени — в сторону старых.

const HeroPoseScript := preload("res://scripts/hero_pose.gd")
## Рука вытягивается не больше чем на эту долю длины.
const REACH := 0.98
## Ключица навстречу цели, рад (26°), и перехват цевья ближе к себе, м.
const CLAV_MAX := 0.45
const SLIDE_MAX := 0.07

var src: Skeleton3D
var dst: Skeleton3D
var pairs: Array = []        # [индекс в dst, индекс в src, поправка покоя Quaternion]
var order: Array[int] = []   # кости dst от корня к листьям
var arms: Array = []         # словари рук: кости dst и src, хват в осях кисти старой (gs) и новой (gd)
var legs: Array = []         # [dst верх, dst середина, dst конец, src середина, src конец]
var index_bones: Array[int] = []   # указательный палец правой кисти dst (3 фаланги)
var hips := -1
var hip_k := 1.0
## Модификатор позы старого скелета (hero_pose.gd): вес IK левой кисти, место цевья, вес переноски. Ставит player.gd.
var pose: Node
## Хват правой кисти новой модели — в нём оружие (player.gd кладёт сюда ствол или топор).
var grip_node: Node3D
var grip_world := Transform3D.IDENTITY
## Для автотеста: насколько левая кисть новой модели не достала до цевья, м (−1 — левая не на цевье).
var left_error := -1.0
## Крепления на теле новой модели (топор и ствол за спиной): [узел, кость dst, кость src, место в осях корпуса].
var mounts: Array = []
var _world: Array[Transform3D] = []
var _by_dst := {}            # индекс dst → пара
var _sc := Vector3.ONE

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
	var sgt := src.global_transform
	var dgt := dst.global_transform
	_sc = dgt.basis.get_scale()
	var used := {}
	for i in dst.get_bone_count():
		var m := mixamo_name(str(dst.get_bone_name(i)))
		if m == "" or used.has(m):
			continue
		var j := src_bone(src, m)
		if j < 0:
			continue
		used[m] = true
		var ws := sgt * src.get_bone_global_rest(j)
		var wd := dgt * dst.get_bone_global_rest(i)
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
		var hs := (sgt * src.get_bone_global_rest(src_hips)).origin.y - src.global_position.y
		var hd := (dgt * dst.get_bone_global_rest(hips)).origin.y - src.global_position.y
		if hs > 0.01:
			hip_k = hd / hs
	# руки: хват в кисти новой модели — поворот как у хвата старой кисти, точка сдвинута на разницу костяшек
	# (средний палец, Middle1): у модели Tripo кисть длиннее, хват должен лечь в ладонь, а не на запястье
	arms.clear()
	for side in ["Right", "Left"]:
		var a := {"side": side, "u": find_mixamo(dst, side + "Arm"), "m": find_mixamo(dst, side + "ForeArm"),
			"e": find_mixamo(dst, side + "Hand"), "clav": find_mixamo(dst, side + "Shoulder"),
			"sm": src_bone(src, side + "ForeArm"), "sh": src_bone(src, side + "Hand"),
			"sg": src.find_bone("GripR" if side == "Right" else "GripL")}
		if int(a["u"]) < 0 or int(a["m"]) < 0 or int(a["e"]) < 0 or int(a["sm"]) < 0 or int(a["sh"]) < 0:
			continue
		var gs: Transform3D = HeroPoseScript.grip_r_default() if side == "Right" else HeroPoseScript.grip_l_default()
		if int(a["sg"]) >= 0:
			gs = src.get_bone_global_rest(a["sh"]).affine_inverse() * src.get_bone_global_rest(a["sg"])
		a["gs"] = gs
		var gw: Transform3D = sgt * src.get_bone_global_rest(a["sh"]) * gs
		var shift := Vector3.ZERO
		var kd := find_mixamo(dst, side + "HandMiddle1")
		var ks := src_bone(src, side + "HandMiddle1")
		if kd >= 0 and ks >= 0:
			shift = (dgt * dst.get_bone_global_rest(kd)).origin - (sgt * src.get_bone_global_rest(ks)).origin
		a["gd"] = (dgt * dst.get_bone_global_rest(a["e"])).affine_inverse() * Transform3D(gw.basis.orthonormalized(), gw.origin + shift)
		arms.append(a)
		if side == "Right":
			grip_world = ((dgt * dst.get_bone_global_rest(a["e"])) * (a["gd"] as Transform3D)).orthonormalized()
	# ноги — IK к стопам старого
	legs.clear()
	for ch in [["LeftUpLeg", "LeftLeg", "LeftFoot"], ["RightUpLeg", "RightLeg", "RightFoot"]]:
		var du := find_mixamo(dst, ch[0])
		var dm := find_mixamo(dst, ch[1])
		var de := find_mixamo(dst, ch[2])
		var sm := src_bone(src, ch[1])
		var se := src_bone(src, ch[2])
		if du >= 0 and dm >= 0 and de >= 0 and sm >= 0 and se >= 0:
			legs.append([du, dm, de, sm, se])
	index_bones.clear()
	for k in ["RightHandIndex1", "RightHandIndex2", "RightHandIndex3"]:
		var i := find_mixamo(dst, k)
		if i >= 0:
			index_bones.append(i)
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
	if grip_node:
		grip_node.global_transform = grip_world
	if not src.skeleton_updated.is_connected(_follow):
		src.skeleton_updated.connect(_follow)
	return pairs.size()

## Хват правой кисти новой модели в осях её кости (и сама кость) — для оружия у муров (SkinBake).
func right_grip() -> Array:
	for a in arms:
		if a["side"] == "Right":
			return [int(a["e"]), a["gd"]]
	return [-1, Transform3D.IDENTITY]

## force — и для скрытой модели (пересчёт клипов в SkinBake).
func _follow(force := false) -> void:
	if dst == null or not is_instance_valid(dst) or (not force and not dst.is_visible_in_tree()):
		return
	var sgt := src.global_transform
	var dgt := dst.global_transform
	_sc = dgt.basis.get_scale()
	var root := src.global_position
	var two := 0.0
	var straight := 0.0
	var marker := Transform3D.IDENTITY
	if pose != null and is_instance_valid(pose):
		two = clampf(float(pose.get("ik_weight")), 0.0, 1.0)
		straight = clampf(float(pose.get("carry")), 0.0, 1.0)
		marker = pose.get("marker")
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
			_world[b] = Transform3D(Basis(q).scaled(_sc), pos)
		else:
			_world[b] = base
	# 2) руки (сначала правая — по ней хват оружия, к нему левая) и ноги — двухзвенный IK
	left_error = -1.0
	for a in arms:
		_arm(a, sgt, two, marker)
	for ch in legs:
		_ik(ch[0], ch[1], ch[2], (sgt * src.get_bone_global_pose(ch[4])).origin, (sgt * src.get_bone_global_pose(ch[3])).origin)
	# указательный правой — вдоль ствольной коробки, пока ствол в переноске (в прицеле — на спуске, как у старого)
	if straight > 0.001 and index_bones.size() == 3 and not arms.is_empty():
		_index_straight(straight)
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
	# крепления на теле: у сустава кости новой модели, оси — как у парной кости старого (x — влево, y — вверх, z — вперёд)
	for mt in mounts:
		var mn: Node3D = mt[0]
		if is_instance_valid(mn):
			mn.global_transform = Transform3D((sgt.basis * src.get_bone_global_pose(mt[2]).basis).orthonormalized(), _world[mt[1]].origin) * (mt[3] as Transform3D)
	# хват — по готовой кисти; левая — насколько не достала до цевья
	for a in arms:
		var hand: Transform3D = _world[a["e"]] * (a["gd"] as Transform3D)
		if a["side"] == "Right":
			grip_world = hand.orthonormalized()
			if grip_node:
				grip_node.global_transform = grip_world
		elif two > 0.5:
			left_error = hand.origin.distance_to(grip_world * marker.origin)

## Крепление на теле новой модели: узел у сустава кости short (имя Mixamo, напр. «Spine2»), local — место и оси
## в осях парной кости старого скелета (x — влево, y — вверх, z — вперёд, от сустава новой модели). Узел — ребёнок
## модели; оружие кладут в него, как в узлы креплений player.glb.
func add_mount(mount_name: String, short: String, local: Transform3D) -> Node3D:
	var d := find_mixamo(dst, short)
	var s := src_bone(src, short)
	var model := get_parent() as Node3D
	if d < 0 or s < 0 or model == null:
		return null
	var n := Node3D.new()
	n.name = mount_name
	model.add_child(n)
	n.global_transform = Transform3D((src.global_transform.basis * src.get_bone_global_rest(s).basis).orthonormalized(), (dst.global_transform * dst.get_bone_global_rest(d)).origin) * local
	mounts.append([n, d, s, local])
	return n

## Пожарный топор за спиной по диагонали: рукоять у правого бедра, голова за левым плечом, лезвие вверх-вправо,
## плашмя к спине (у модели Tripo толстый бронежилет — спина в ~23 см за суставом позвоночника). Оси топора
## (модель fireaxe, оси хвата): рукоять от хвата к голове — ha, плоскость топора — X, лезвие — ba.
static func axe_on_back() -> Transform3D:
	var dh := Vector3(0.5, 0.87, -0.15).normalized()   # от хвата к голове: вверх-влево, верх чуть дальше от спины
	var nc := Vector3(0, 0, -1)
	nc = (nc - dh * nc.dot(dh)).normalized()
	var bc := dh.cross(nc)
	var ha := Vector3(0, -0.63, 0.78).normalized()
	var xa := Vector3(1, 0, 0)
	var ba := ha.cross(xa)
	# середина топора (~0,35 м от хвата у полноразмерного) — на середине спины; топор уменьшен вместе со всем оружием
	return Transform3D(Basis(nc, dh, bc) * Basis(xa, ha, ba).transposed(), Vector3(0, -0.12, -0.25) - dh * (0.35 * Gear.SCALE))

## Ствол за спиной: как ремень в player.glb (дулом вниз, справа), но дальше от спины — снаружи бронежилета.
static func gun_on_back() -> Transform3D:
	var b := Basis(Vector3(-0.1, -0.25, 0.96), Vector3(-0.02, 0.97, 0.25), Vector3(-1, 0, -0.1)).orthonormalized()
	return Transform3D(b, Vector3(-0.2, -0.39, -0.25))

## Рука: точка хвата новой кисти — на хват старой (левая у двуручного ствола — на цевьё оружия в новой правой).
func _arm(a: Dictionary, sgt: Transform3D, two: float, marker: Transform3D) -> void:
	var u: int = a["u"]
	var m: int = a["m"]
	var e: int = a["e"]
	var og: Transform3D
	if int(a["sg"]) >= 0:
		og = sgt * src.get_bone_global_pose(a["sg"])
	else:
		og = sgt * src.get_bone_global_pose(a["sh"]) * (a["gs"] as Transform3D)
	var p := og.origin
	var left: bool = a["side"] == "Left"
	if left and two > 0.0:
		p = p.lerp(grip_world * marker.origin, two)
	var gd: Transform3D = a["gd"]
	var t := p - _world[e].basis * gd.origin
	var lim := ((_world[u].basis * dst.get_bone_rest(m).origin).length() + (_world[m].basis * dst.get_bone_rest(e).origin).length()) * REACH
	if _world[u].origin.distance_to(t) > lim:
		_clavicle(a, t, lim)
		if left and two > 0.0 and _world[u].origin.distance_to(t) > lim:
			# и с ключицей не достаёт — перехватить цевьё ближе к себе (по стволу назад, +Y хвата)
			var back := grip_world.basis.y.normalized()
			var d0 := t - _world[u].origin
			var bd := back.dot(d0)
			var disc := bd * bd - (d0.length_squared() - lim * lim)
			var s := (-bd - sqrt(disc)) if disc >= 0.0 else -bd
			t += back * clampf(s, 0.0, SLIDE_MAX) * two
	_ik(u, m, e, t, (sgt * src.get_bone_global_pose(a["sm"])).origin)
	if not left:
		var hand := Transform3D(_world[e].basis, (_world[m] * dst.get_bone_rest(e)).origin)
		grip_world = (hand * gd).orthonormalized()

## Ключица навстречу цели (плечо выдвигается вперёд-внутрь) — до CLAV_MAX, сколько нужно.
func _clavicle(a: Dictionary, t: Vector3, lim: float) -> void:
	var cl: int = a["clav"]
	if cl < 0:
		return
	var u: int = a["u"]
	var c := _world[cl].origin
	var uv := _world[u].origin - c
	var n := uv.cross(t - c)
	if n.length_squared() < 1e-10:
		return
	n = n.normalized()
	var ang := CLAV_MAX
	if (c + uv.rotated(n, CLAV_MAX)).distance_to(t) <= lim:
		var lo := 0.0
		var hi := CLAV_MAX
		for _k in 8:
			var mid := (lo + hi) * 0.5
			if (c + uv.rotated(n, mid)).distance_to(t) <= lim:
				hi = mid
			else:
				lo = mid
		ang = hi
	var q := Basis(n, ang)
	_world[cl] = Transform3D(q * _world[cl].basis, c)
	_world[u] = Transform3D(_world[u].basis, c + q * uv)

## Указательный палец правой кисти — прямой, вдоль ствола (по оси −Y хвата), с весом w.
func _index_straight(w: float) -> void:
	var dirw := -grip_world.basis.y.normalized()
	for k in 3:
		var i: int = index_bones[k]
		var parent := dst.get_bone_parent(i)
		if parent < 0:
			return
		var base: Basis = _world[parent].basis * dst.get_bone_rest(i).basis
		if k == 0:
			var along: Vector3 = base * dst.get_bone_rest(index_bones[1]).origin
			base = Basis(HeroPoseScript._arc(along, dirw)) * base
		var q := _world[i].basis.get_rotation_quaternion().slerp(base.get_rotation_quaternion(), w)
		_world[i] = Transform3D(Basis(q).scaled(_sc), _world[i].origin)

## Двухзвенный IK: верх u → середина m → конец e; конец — в t, середина (локоть, колено) — в сторону pole.
func _ik(u: int, m: int, e: int, t: Vector3, pole: Vector3) -> void:
	var r := _world[u].origin
	var wm0: Transform3D = _world[u] * dst.get_bone_rest(m)
	var m0 := wm0.origin
	var e0 := (Transform3D(_world[m].basis, m0) * dst.get_bone_rest(e)).origin
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
