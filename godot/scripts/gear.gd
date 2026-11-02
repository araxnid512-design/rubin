class_name Gear
## Модели оружия и героя из Tripo (godot/assets/tripo/, CI «Tripo (аккаунт)», правила — docs/tripo).
##
## Оружие: если есть assets/tripo/w_<id>.glb, новая модель вписывается в габариты старой (assets/weapons/<id>.glb
## из браузерной игры): та же длина, ствол туда же, куда смотрит Muzzle старой, верх — вверх (+Z в осях хвата),
## дульный срез — на месте старого, по другим осям — по центру; затем — до длины target_length (настоящая длина
## и на треть меньше, вокруг хвата).
## Узлы Muzzle и GripL берутся у старой модели (сдвинуты тем же масштабом) —
## хват правой рукой, вспышка, пули и IK левой кисти работают как прежде. Холодное оружие (без Muzzle) — по главной
## оси вершин и лезвию (_fit_melee). Посадка проверена наложением на старые модели. Нет новой — старая как есть.

## Посадка новых моделей (вычисляется один раз на модель): id → [Transform3D, {имя узла: Transform3D}, длина старой].
static var _fits := {}

## Настоящая длина оружия, м (по просьбе пользователя — размеры как в жизни; старые модели браузерной игры были
## крупнее: АК-47 1,11 м вместо 0,88, АКС-74У 0,88 вместо 0,73). Модель масштабируется вокруг хвата (рука на месте),
## дуло и точка левой кисти — вместе с ней. Кого нет в таблице — как старая модель (пожарный топор уже ~0,85 м).
const LENGTH := {
	"pistol": 0.161, "pm63": 0.333, "vector": 0.62, "obrez": 0.5, "shotgun": 1.05, "spas12": 1.04,
	"aks": 0.73, "ak74": 0.943, "ak47": 0.88, "aug": 0.79, "scar": 0.97, "fnfal": 1.09,
	"vss": 0.894, "svd": 1.225, "pkm": 1.173,
}
## И всё оружие ещё на треть меньше (просьба пользователя: при настоящих размерах рядом с крупной моделью героя
## стволы и топор выглядели гигантскими).
const SCALE := 0.67

## Длина модели в игре: настоящая (LENGTH) или как у старой модели — и на треть меньше (SCALE).
static func target_length(model_id: String, old_len: float) -> float:
	return float(LENGTH.get(model_id, old_len)) * SCALE

## Новая модель оружия (или старая, если новой нет). Каждый вызов — новый экземпляр.
static func weapon(model_id: String) -> Node3D:
	var old_path := "res://assets/weapons/%s.glb" % model_id
	var new_path := "res://assets/tripo/w_%s.glb" % model_id
	if not ResourceLoader.exists(new_path):
		if not ResourceLoader.exists(old_path):
			return Node3D.new()
		var plain: Node3D = (load(old_path) as PackedScene).instantiate()
		var lo := _box(_points(plain)).get_longest_axis_size()
		if lo > 0.01:
			plain.scale *= target_length(model_id, lo) / lo
		return plain
	var fresh: Node3D = (load(new_path) as PackedScene).instantiate()
	if not _fits.has(model_id):
		if not ResourceLoader.exists(old_path):
			return fresh
		var old: Node3D = (load(old_path) as PackedScene).instantiate()
		var marks := {}
		for nm in ["Muzzle", "GripL"]:
			var m := old.find_child(nm, true, false) as Node3D
			if m:
				marks[nm] = _rel(old, m)
		_fits[model_id] = [_fit(old, fresh), marks, _box(_points(old)).get_longest_axis_size()]
		old.free()
	var fit: Array = _fits[model_id]
	# настоящая длина: масштаб вокруг хвата (начало осей оружия — точка хвата правой кисти)
	var k := 1.0
	if float(fit[2]) > 0.01:
		k = target_length(model_id, float(fit[2])) / float(fit[2])
	var root := Node3D.new()
	root.name = "Tripo_" + model_id
	fresh.transform = Transform3D(Basis.IDENTITY.scaled(Vector3(k, k, k)), Vector3.ZERO) * (fit[0] as Transform3D)
	root.add_child(fresh)
	var marks2: Dictionary = fit[1]
	for nm in marks2:
		var marker := Node3D.new()
		marker.name = nm
		var mt: Transform3D = marks2[nm]
		marker.transform = Transform3D(mt.basis, mt.origin * k)
		root.add_child(marker)
	return root

## Положение узла n относительно root (сцена ещё не в дереве — по цепочке родителей).
static func _rel(root: Node, n: Node3D) -> Transform3D:
	var t := Transform3D.IDENTITY
	var cur: Node = n
	while cur != null and cur != root:
		if cur is Node3D:
			t = (cur as Node3D).transform * t
		cur = cur.get_parent()
	return t

## Вершины всех мешей сцены в её осях.
static func _points(root: Node3D) -> PackedVector3Array:
	var out := PackedVector3Array()
	for c in root.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = c
		if mi.mesh == null:
			continue
		var t := _rel(root, mi)
		for v in mi.mesh.get_faces():
			out.append(t * v)
	return out

static func _box(pts: PackedVector3Array) -> AABB:
	if pts.is_empty():
		return AABB()
	var b := AABB(pts[0], Vector3.ZERO)
	for p in pts:
		b = b.expand(p)
	return b

## Толщина (размах по оси across) у конца оси along: доля frac длины от края (sign: +1 — у max, -1 — у min).
static func _end_size(pts: PackedVector3Array, box: AABB, along: int, sign: float, across: int, frac: float) -> float:
	var lo := box.position[along]
	var hi := box.end[along]
	var cut := hi - (hi - lo) * frac if sign > 0.0 else lo + (hi - lo) * frac
	var a := INF
	var b := -INF
	for p in pts:
		var x: float = p[along]
		if (sign > 0.0 and x >= cut) or (sign < 0.0 and x <= cut):
			a = minf(a, p[across])
			b = maxf(b, p[across])
	return b - a if b > a else 0.0

static func _axis(i: int, s: float) -> Vector3:
	var v := Vector3.ZERO
	v[i] = s
	return v

## Как поставить новую модель, чтобы она легла на место старой.
static func _fit(old: Node3D, fresh: Node3D) -> Transform3D:
	var op := _points(old)
	var np := _points(fresh)
	var ob := _box(op)
	var nb := _box(np)
	if op.is_empty() or np.is_empty():
		return Transform3D.IDENTITY
	var muzzle := old.find_child("Muzzle", true, false) as Node3D
	if muzzle == null:
		return _fit_melee(op, np)
	# старая: ось ствола (длинная) и куда смотрит дуло; верх — +Z (так выгружает браузерная игра)
	var d := _rel(old, muzzle).origin - ob.get_center()
	var o_long := 0 if absf(d.x) >= absf(d.y) and absf(d.x) >= absf(d.z) else (1 if absf(d.y) >= absf(d.z) else 2)
	var o_sign := signf(d[o_long]) if d[o_long] != 0.0 else -1.0
	var o_up := 2 if o_long != 2 else 1
	# новая (Tripo, «вид сбоку»): верх — +Y, длинная ось — X или Z; дуло — у тонкого конца
	var n_long := 0 if nb.size.x >= nb.size.z else 2
	var thin_hi := _end_size(np, nb, n_long, 1.0, 1, 0.12)
	var thin_lo := _end_size(np, nb, n_long, -1.0, 1, 0.12)
	var n_sign := 1.0 if thin_hi <= thin_lo else -1.0
	var e1 := _axis(n_long, n_sign)
	var e2 := Vector3.UP
	var f1 := _axis(o_long, o_sign)
	var f2 := _axis(o_up, 1.0)
	var E := Basis(e1, e2, e1.cross(e2))
	var F := Basis(f1, f2, f1.cross(f2))
	var s := ob.size[o_long] / maxf(nb.size[n_long], 0.0001)
	var basis := (F * E.inverse()).scaled(Vector3.ONE * s)
	# куда легла новая коробка; сдвиг: по оси ствола — дулом к дулу, по остальным — центр к центру
	var nb2 := _box(_transform_all(np, Transform3D(basis, Vector3.ZERO)))
	var shift := ob.get_center() - nb2.get_center()
	var o_end: float = ob.end[o_long] if o_sign > 0.0 else ob.position[o_long]
	var n_end: float = nb2.end[o_long] if o_sign > 0.0 else nb2.position[o_long]
	shift[o_long] = o_end - n_end
	return Transform3D(basis, shift)

## Холодное оружие (у старых моделей топорище бывает наискосок — коробка не годится): главная ось по разбросу
## вершин, голова — у конца с бо́льшим поперечным размахом, лезвие — к самой дальней от линии рукояти точке головы.
## Новая ложится осью на ось, лезвием к лезвию, той же длины, голова — к голове.
static func _fit_melee(op: PackedVector3Array, np: PackedVector3Array) -> Transform3D:
	var o := _melee_frame(op)
	var n := _melee_frame(np)
	var E := Basis(n["axis"], n["blade"], (n["axis"] as Vector3).cross(n["blade"]).normalized())
	var F := Basis(o["axis"], o["blade"], (o["axis"] as Vector3).cross(o["blade"]).normalized())
	var s: float = float(o["len"]) / maxf(float(n["len"]), 0.0001)
	var basis := (F * E.inverse()).scaled(Vector3.ONE * s)
	var shift: Vector3 = (o["head"] as Vector3) - basis * (n["head"] as Vector3)
	return Transform3D(basis, shift)

static func _melee_frame(pts: PackedVector3Array) -> Dictionary:
	var m := Vector3.ZERO
	for p in pts:
		m += p
	m /= maxf(pts.size(), 1)
	# ковариация и степенной метод — главная ось
	var cxx := 0.0
	var cxy := 0.0
	var cxz := 0.0
	var cyy := 0.0
	var cyz := 0.0
	var czz := 0.0
	for p in pts:
		var d := p - m
		cxx += d.x * d.x
		cxy += d.x * d.y
		cxz += d.x * d.z
		cyy += d.y * d.y
		cyz += d.y * d.z
		czz += d.z * d.z
	var v := Vector3(1.0, 0.3, 0.2).normalized()
	for it in 40:
		v = Vector3(cxx * v.x + cxy * v.y + cxz * v.z, cxy * v.x + cyy * v.y + cyz * v.z, cxz * v.x + cyz * v.y + czz * v.z).normalized()
	var lo := INF
	var hi := -INF
	for p in pts:
		var t := (p - m).dot(v)
		lo = minf(lo, t)
		hi = maxf(hi, t)
	# голова — где поперечный размах больше
	var spread_hi := 0.0
	var spread_lo := 0.0
	for p in pts:
		var t := (p - m).dot(v)
		var r := ((p - m) - v * t).length()
		if t >= hi - (hi - lo) * 0.2:
			spread_hi = maxf(spread_hi, r)
		elif t <= lo + (hi - lo) * 0.2:
			spread_lo = maxf(spread_lo, r)
	var axis := v if spread_hi >= spread_lo else -v
	var lo2 := lo if spread_hi >= spread_lo else -hi
	var hi2 := hi if spread_hi >= spread_lo else -lo
	# линия рукояти — центр ближней половины; лезвие — к дальней от неё точке головы
	var hc := Vector3.ZERO
	var hn := 0
	for p in pts:
		if (p - m).dot(axis) <= lo2 + (hi2 - lo2) * 0.5:
			hc += p
			hn += 1
	hc /= maxf(hn, 1)
	var blade := Vector3.ZERO
	var bd := -1.0
	for p in pts:
		if (p - m).dot(axis) >= hi2 - (hi2 - lo2) * 0.25:
			var off := p - hc
			off -= axis * off.dot(axis)
			if off.length() > bd:
				bd = off.length()
				blade = off
	if blade.length_squared() < 1e-10:
		blade = Vector3.UP.cross(axis)
	return {"axis": axis, "blade": blade.normalized(), "len": hi2 - lo2, "head": m + axis * hi2}

static func _transform_all(pts: PackedVector3Array, t: Transform3D) -> PackedVector3Array:
	var out := PackedVector3Array()
	out.resize(pts.size())
	for i in pts.size():
		out[i] = t * pts[i]
	return out

## Герой из Tripo поверх старого (скрытого) героя: сетка следует за скелетом player.glb (SkinFollow), рост —
## как у старого. Возвращает узел новой модели или null (модели нет — остаётся старая).
static func hero(player: Node3D, old_model: Node3D, old_skeleton: Skeleton3D) -> Node3D:
	var path := "res://assets/tripo/player.glb"
	if old_skeleton == null or not ResourceLoader.exists(path):
		return null
	var model: Node3D = (load(path) as PackedScene).instantiate()
	var sks := model.find_children("*", "Skeleton3D", true, false)
	if sks.is_empty():
		model.free()
		return null
	var sk: Skeleton3D = sks[0]
	model.name = "TripoHero"
	player.add_child(model)
	Level.rim(model)
	# рост: голова новой — на высоте головы старой (в позе покоя)
	var oh := SkinFollow.src_bone(old_skeleton, "Head")
	var nh := SkinFollow.find_mixamo(sk, "Head")
	if oh >= 0 and nh >= 0:
		var old_y := (old_skeleton.global_transform * old_skeleton.get_bone_global_rest(oh)).origin.y - old_skeleton.global_position.y
		var new_y := (sk.global_transform * sk.get_bone_global_rest(nh)).origin.y - sk.global_position.y
		if new_y > 0.01:
			model.scale *= old_y / new_y
	# развернуть лицом туда же, что старая (модель Tripo в файле смотрит вбок): по линии плеч в плоскости XZ
	var ol := SkinFollow.src_bone(old_skeleton, "LeftArm")
	var orr := SkinFollow.src_bone(old_skeleton, "RightArm")
	var nl := SkinFollow.find_mixamo(sk, "LeftArm")
	var nr := SkinFollow.find_mixamo(sk, "RightArm")
	if ol >= 0 and orr >= 0 and nl >= 0 and nr >= 0:
		var so := (old_skeleton.global_transform * old_skeleton.get_bone_global_rest(ol)).origin - (old_skeleton.global_transform * old_skeleton.get_bone_global_rest(orr)).origin
		var sn := (sk.global_transform * sk.get_bone_global_rest(nl)).origin - (sk.global_transform * sk.get_bone_global_rest(nr)).origin
		model.rotate_y(atan2(so.x, so.z) - atan2(sn.x, sn.z))
	for c in old_model.find_children("*", "MeshInstance3D", true, false):
		(c as MeshInstance3D).visible = false
	var follow := SkinFollow.new()
	follow.name = "SkinFollow"
	model.add_child(follow)
	# хват правой кисти новой модели: оружие висит здесь (SkinFollow ставит его каждый кадр по кисти)
	var g := Node3D.new()
	g.name = "TripoGrip"
	model.add_child(g)
	follow.grip_node = g
	var n := follow.bind(old_skeleton, sk)
	model.set_meta("bones_bound", n)
	return model
