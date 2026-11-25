class_name BCRagdoll
extends SkeletonModifier3D
## Тело на физике после гибели (как в мобильных выживалках): убитый не застывает последним кадром клипа над землёй,
## а валится всем весом — таз, грудь, голова, плечи и предплечья, бёдра и голени — 11 твёрдых тел, связанных
## суставами. Суставы держат позу, в которой тело было в миг перехода (клип падения уже согнул колени и локти):
## отклонение — не больше swing/twist градусов, поэтому колено не выгнется назад, а рука не провернётся. Тело ложится
## по земле, по ступеням и склону; удар толкает его от того, кто ударил. Когда всё легло (или через settle_s), поза
## записывается в скелет, тела и суставы удаляются — лежащий труп ничего не считает.
## Тела сталкиваются только с миром (земля, полы, стены, двери, ящики), не друг с другом, не с героем и не с врагами.

const LAYER := 1 << 9
const MASK := 1 | 2 | 8                         ## мир, закрытые двери, ящики и мебель
## [кость, куда (до какой кости), радиус (доля роста), масса кг, родитель, отклонение сустава °, скручивание °]
## «куда» с плюсом — продлить за кость (кисть и стопа — продолжение предплечья и голени), «^» — голова (вверх от шеи)
const SEG := [
	["Hip", "Spine01", 0.075, 11.0, "", 0, 0],
	["Spine01", "Head", 0.08, 13.0, "Hip", 22, 12],
	["Head", "^", 0.06, 4.5, "Spine01", 35, 30],
	["L_Upperarm", "L_Forearm", 0.032, 2.2, "Spine01", 55, 25],
	["L_Forearm", "+L_Hand", 0.028, 1.6, "L_Upperarm", 40, 15],
	["R_Upperarm", "R_Forearm", 0.032, 2.2, "Spine01", 55, 25],
	["R_Forearm", "+R_Hand", 0.028, 1.6, "R_Upperarm", 40, 15],
	["L_Thigh", "L_Calf", 0.045, 7.0, "Hip", 40, 12],
	["L_Calf", "+L_Foot", 0.035, 3.5, "L_Thigh", 35, 8],
	["R_Thigh", "R_Calf", 0.045, 7.0, "Hip", 40, 12],
	["R_Calf", "+R_Foot", 0.035, 3.5, "R_Thigh", 35, 8],
]

var height := 1.78                              ## рост, м (радиусы тел — доли роста)
var settle_s := 3.5                             ## дольше этого тело не считается
var running := false                            ## тела считаются
var done := false                               ## поза записана, тел больше нет
var t := 0.0
var _items: Array = []                          ## [{bone, body, k}] — от таза к конечностям
var _joints: Array = []
var _prev := {}                                 ## кость → положение в мире кадром раньше (скорость при переходе)
var _prev_dt := 0.016
var _quiet := 0.0


## Можно ли собрать тело из этого скелета (нужны все кости из SEG)
static func fits(sk: Skeleton3D) -> bool:
	for s in SEG:
		if sk.find_bone(String(s[0])) < 0:
			return false
		var to := String(s[1])
		if to != "^" and sk.find_bone(to.trim_prefix("+")) < 0:
			return false
	return sk.find_bone("Spine02") >= 0


## Перейти на физику: push — толчок (м/с) телу, hit — куда пришёлся удар (сильнее толкается ближняя часть тела)
func start(push: Vector3, hit := Vector3.INF) -> bool:
	var sk := get_skeleton()
	if sk == null or running or done or not fits(sk) or not is_inside_tree():
		return false
	var skg := sk.global_transform
	var holder := get_parent()
	while holder != null and not (holder is CharacterBody3D):
		holder = holder.get_parent()
	if holder == null:
		holder = sk
	var by_name := {}
	for s in SEG:
		var bi := sk.find_bone(String(s[0]))
		var a: Vector3 = skg * sk.get_bone_global_pose(bi).origin
		var to := String(s[1])
		var b: Vector3
		if to == "^":
			# голова: от основания черепа вверх по шее (Spine02 → Head) на ~0.2 роста
			var nk: Vector3 = skg * sk.get_bone_global_pose(sk.find_bone("Spine02")).origin
			b = a + (a - nk).normalized() * height * 0.13
		elif to.begins_with("+"):
			var e: Vector3 = skg * sk.get_bone_global_pose(sk.find_bone(to.substr(1))).origin
			b = e + (e - a) * 0.3
		else:
			b = skg * sk.get_bone_global_pose(sk.find_bone(to)).origin
		var dir := b - a
		var ln := dir.length()
		if ln < 0.01:
			_abort()
			return false
		dir /= ln
		var r := float(s[2]) * height
		var body := RigidBody3D.new()
		body.name = "RD_" + String(s[0])
		body.top_level = true
		body.collision_layer = LAYER
		body.collision_mask = MASK
		body.mass = float(s[3])
		body.continuous_cd = true
		body.linear_damp = 0.35
		body.angular_damp = 2.5
		body.can_sleep = true
		var pm := PhysicsMaterial.new()
		pm.friction = 0.95
		pm.bounce = 0.0
		body.physics_material_override = pm
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = r
		cap.height = maxf(ln + r * 0.6, r * 2.05)
		cs.shape = cap
		body.add_child(cs)
		holder.add_child(body)
		body.global_transform = Transform3D(_basis_y(dir), (a + b) * 0.5)
		var w: Transform3D = skg * sk.get_bone_global_pose(bi)
		var it := {"bone": bi, "body": body, "k": body.global_transform.affine_inverse() * w, "a": a}
		_items.append(it)
		by_name[String(s[0])] = it
		# скорость — какой была у этой части тела в клипе падения, плюс толчок (ближе к удару — сильнее)
		var v := Vector3.ZERO
		if _prev.has(bi):
			# по началу кости сейчас и кадром раньше (не по середине тела: та сдвинута на полкости, и каждая часть
			# получала лишний рывок вдоль себя — тело в миг гибели дёргалось и растягивалось)
			v = (a - (_prev[bi] as Vector3)) / maxf(_prev_dt, 0.008)
			v = v.limit_length(6.0)
		var near := 1.0
		if hit != Vector3.INF:
			near = clampf(1.4 - body.global_position.distance_to(hit) / height, 0.5, 1.4)
		body.linear_velocity = v + push * near
	# суставы: в начале кости-ребёнка, ось скручивания (X сустава) — вдоль неё
	for s in SEG:
		if String(s[4]) == "":
			continue
		var ch: Dictionary = by_name[String(s[0])]
		var pa: Dictionary = by_name[String(s[4])]
		var j := ConeTwistJoint3D.new()
		holder.add_child(j)
		j.top_level = true
		var cb := ch.body as RigidBody3D
		var dirc := cb.global_transform.basis.y
		j.global_transform = Transform3D(_basis_x(dirc), ch.a)
		j.set_param(ConeTwistJoint3D.PARAM_SWING_SPAN, deg_to_rad(float(s[5])))
		j.set_param(ConeTwistJoint3D.PARAM_TWIST_SPAN, deg_to_rad(float(s[6])))
		j.set_param(ConeTwistJoint3D.PARAM_SOFTNESS, 0.9)
		j.set_param(ConeTwistJoint3D.PARAM_RELAXATION, 1.0)
		j.exclude_nodes_from_collision = true
		j.node_a = j.get_path_to(pa.body)
		j.node_b = j.get_path_to(cb)
		_joints.append(j)
	running = true
	t = 0.0
	_quiet = 0.0
	active = true
	return true


func _abort() -> void:
	for it in _items:
		(it.body as Node).queue_free()
	_items.clear()


static func _basis_y(d: Vector3) -> Basis:
	var y := d.normalized()
	var ref := Vector3.FORWARD if absf(y.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
	var x := ref.cross(y).normalized()
	var z := x.cross(y).normalized()
	return Basis(x, y, z)


static func _basis_x(d: Vector3) -> Basis:
	var x := d.normalized()
	var ref := Vector3.UP if absf(x.dot(Vector3.UP)) < 0.9 else Vector3.FORWARD
	var z := x.cross(ref).normalized()
	var y := z.cross(x).normalized()
	return Basis(x, y, z)


## где таз (тело таза), пока тело на физике
func hip_pos() -> Vector3:
	if _items.is_empty():
		return get_skeleton().global_position if get_skeleton() != null else Vector3.ZERO
	return (_items[0].body as RigidBody3D).global_position


## пока клип падения идёт — запоминаются положения частей тела (скорость в миг перехода)
func remember(delta: float) -> void:
	var sk := get_skeleton()
	if sk == null or running or done:
		return
	var skg := sk.global_transform
	_prev_dt = delta
	for s in SEG:
		var bi := sk.find_bone(String(s[0]))
		if bi < 0:
			return
		# скорость части тела берётся по началу её кости (в start — та же точка)
		_prev[bi] = skg * sk.get_bone_global_pose(bi).origin


func _process_modification() -> void:
	if not running:
		return
	var sk := get_skeleton()
	var inv := sk.global_transform.affine_inverse()
	for it in _items:
		var b := it.body as RigidBody3D
		sk.set_bone_global_pose(int(it.bone), inv * (b.global_transform * (it.k as Transform3D)))


## шаг физики тела: легло — записать позу и убрать тела
func tick(delta: float) -> void:
	if not running:
		return
	t += delta
	if t > 1.0 and t - delta <= 1.0:
		# упало — гасит остаточную дрожь суставов (иначе тело на 30 шагах физики в секунду мелко шевелится и не
		# засыпает): трение воздуха и вращения выше, тело замирает за доли секунды
		for it in _items:
			(it.body as RigidBody3D).linear_damp = 2.5
			(it.body as RigidBody3D).angular_damp = 8.0
	var still := true
	for it in _items:
		var b := it.body as RigidBody3D
		if not b.sleeping and (b.linear_velocity.length() > 0.12 or b.angular_velocity.length() > 0.9):
			still = false
			break
	_quiet = _quiet + delta if still else 0.0
	if (t > 0.8 and _quiet > 0.4) or t > settle_s:
		bake()


## Записать лежащую позу в сам скелет (от таза к конечностям) и убрать тела: дальше труп — просто поза
func bake() -> void:
	if not running:
		return
	var sk := get_skeleton()
	var inv := sk.global_transform.affine_inverse()
	for it in _items:
		var bi := int(it.bone)
		var g: Transform3D = inv * ((it.body as RigidBody3D).global_transform * (it.k as Transform3D))
		var par := sk.get_bone_parent(bi)
		var loc := (sk.get_bone_global_pose(par).affine_inverse() * g) if par >= 0 else g
		sk.set_bone_pose_position(bi, loc.origin)
		sk.set_bone_pose_rotation(bi, loc.basis.get_rotation_quaternion())
	for j in _joints:
		(j as Node).queue_free()
	_joints.clear()
	_abort()
	running = false
	done = true
	active = false
