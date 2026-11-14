class_name BCCharacter
extends Node3D
## Внешний вид персонажа BunkerCore: модель со скелетом, библиотека клипов (BCAnimSet), дерево анимаций
## (AnimationTree) и постановка стоп (BCFootIK).
##   передвижение — стойка ↔ движение плавным весом (без скачка позы), внутри движения — смешение walk / run
##                  по скорости (м/с) с выравниванием фаз шага: клипы приведены к общей шкале «1 с = 1 двойной шаг»
##                  (custom timeline), начинаются с постановки левой стопы, темп подбирается так, чтобы длина шага
##                  смешанной позы совпадала со скоростью тела (без скольжения стоп);
##   присед       — отдельное смешение crouch_idle / crouch_walk, плавно вместо стоя;
##   действие     — разовый клип поверх всего (дверь, терминал, удар, попадание …);
##   поза         — удерживаемая поза (сидит, лежит, боевая стойка, мёртв).

signal action_finished(name: String)

@export var model_path := "res://assets/models/hero.glb"
@export var anim_set := "res://assets/anim/hero"
@export var height := 1.8

var model: Node3D
var skel: Skeleton3D
var ap: AnimationPlayer
var tree: AnimationTree
var ik: BCFootIK
var info := {}          ## клип → {len, speed, loop, blend, rate, lock}
var scale_k := 1.0
var yaw_offset := 0.0           ## поворот модели, чтобы её «вперёд» совпало с +Z узла
var _action := ""
var _action_t := 0.0
var _pose := ""
var _speeds := {}
var _speed := 0.0
var _crouch := 0.0
var _crouch_t := 0.0
var _move_w := 0.0              ## вес «движение» против «стойка» (сглаженный)
var _crouch_move_w := 0.0
var _loco_pts: Array = []       ## точки смешения передвижения: [клип, скорость м/с, время двойного шага, длина двойного шага]
var arms: BCArmClear
var hands: BCHandIK


func setup(path := "", set_dir := "") -> void:
	if path != "":
		model_path = path
	if set_dir != "":
		anim_set = set_dir
	for c in get_children():
		c.queue_free()
	var sc: PackedScene = load(model_path)
	model = sc.instantiate()
	add_child(model)
	skel = model.find_children("*", "Skeleton3D", true, false)[0] if model.find_children("*", "Skeleton3D", true, false).size() > 0 else null
	if skel == null:
		push_error("BCCharacter: в модели нет скелета " + model_path)
		return
	# рост — по габариту сетки
	var aabb := _mesh_aabb(model)
	scale_k = height / maxf(aabb.size.y, 0.01)
	model.scale = Vector3.ONE * scale_k
	model.position.y = -aabb.position.y * scale_k
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		mi.layers = 4      # слой «персонажи»
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON
	# собственный AnimationPlayer (у модели свой может быть — отключаем)
	for old in model.find_children("*", "AnimationPlayer", true, false):
		old.active = false
	ap = AnimationPlayer.new()
	ap.name = "BCAnim"
	model.add_child(ap)
	ap.root_node = ap.get_path_to(model)
	var cfg := BCAnimSet.load_config()
	var built := BCAnimSet.build(skel, model, cfg, scale_k, anim_set)
	info = built.info
	ap.add_animation_library("bc", built.lib)
	# «вперёд» модели — по направлению шага в клипе ходьбы: поворачиваем модель так, чтобы шаг шёл по +Z узла
	var fwd: Vector3 = info.walk.dir if info.has("walk") and info.walk.dir != Vector3.ZERO else Vector3.BACK
	yaw_offset = atan2(fwd.x, fwd.z)
	model.rotation.y = -yaw_offset
	_build_tree()
	ik = BCFootIK.new()
	ik.name = "FootIK"
	skel.add_child(ik)
	# руки не уходят в туловище и бёдра (объёмная куртка); кисть — к ручке / пульту при взаимодействии
	arms = BCArmClear.new()
	arms.name = "ArmClear"
	skel.add_child(arms)
	arms.setup_model(model_path, model)
	hands = BCHandIK.new()
	hands.name = "HandIK"
	skel.add_child(hands)


func _mesh_aabb(n: Node) -> AABB:
	var out := AABB()
	var first := true
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var a: AABB = mi.get_aabb()
		var xf: Transform3D = n.global_transform.affine_inverse() * mi.global_transform if mi.is_inside_tree() else mi.transform
		a = xf * a
		out = a if first else out.merge(a)
		first = false
	return out


func has_clip(n: String) -> bool:
	return info.has(n)


func clip_len(n: String) -> float:
	return info[n].len / maxf(info[n].rate, 0.01) if info.has(n) else 0.0


func _anim(n: String) -> AnimationNodeAnimation:
	var a := AnimationNodeAnimation.new()
	a.animation = "bc/" + (n if info.has(n) else "idle")
	# цикл шага → общая шкала: 1 с шкалы = 1 двойной шаг (фаза уже выровнена в BCAnimSet)
	if info.has(n) and float(info[n].strides) > 0.0:
		a.use_custom_timeline = true
		a.timeline_length = float(info[n].strides)
		a.stretch_time_scale = true
		a.loop_mode = Animation.LOOP_LINEAR
	return a


func _build_tree() -> void:
	tree = AnimationTree.new()
	tree.name = "Tree"
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(ap)
	tree.root_node = tree.get_path_to(model)
	var bt := AnimationNodeBlendTree.new()
	# передвижение стоя: точки — по родным скоростям клипов (только по возрастанию скорости)
	var loco := AnimationNodeBlendSpace1D.new()
	loco.min_space = 0.0
	loco.max_space = 8.0
	loco.sync = true
	_speeds = {"idle": 0.0}
	_loco_pts = []
	var last := 0.0
	for k in ["walk", "run", "sprint"]:
		if info.has(k):
			var sp: float = info[k].speed if info[k].speed > 0.1 else {"walk": 1.3, "run": 3.6, "sprint": 5.6}[k]
			# точки только по возрастанию скорости: клип, который медленнее предыдущего, не годится как «быстрее»
			if sp <= last + 0.3:
				continue
			last = sp
			_speeds[k] = sp
			loco.add_blend_point(_anim(k), sp)
			var strides: float = info[k].strides
			var T: float = info[k].len / strides if strides > 0.0 else info[k].len
			_loco_pts.append([k, sp, T, sp * T, strides > 0.0])
	if _loco_pts.is_empty():
		loco.add_blend_point(_anim("idle"), 0.0)
	bt.add_node("loco", loco, Vector2(0, 0))
	var loco_ts := AnimationNodeTimeScale.new()
	bt.add_node("loco_ts", loco_ts, Vector2(200, 0))
	bt.connect_node("loco_ts", 0, "loco")
	# стойка ↔ движение: отдельный вес, сглаженный во времени (раньше точка смешения прыгала 0 → шаг за кадр)
	bt.add_node("idle_anim", _anim("idle"), Vector2(0, -150))
	var mv := AnimationNodeBlend2.new()
	bt.add_node("move", mv, Vector2(300, -50))
	bt.connect_node("move", 0, "idle_anim")
	bt.connect_node("move", 1, "loco_ts")
	# присед
	var cr := AnimationNodeBlendSpace1D.new()
	cr.min_space = 0.0
	cr.max_space = 3.0
	cr.sync = true
	var csp := 1.0
	if info.has("crouch_walk"):
		csp = info.crouch_walk.speed if info.crouch_walk.speed > 0.1 else 1.0
		cr.add_blend_point(_anim("crouch_walk"), csp)
	else:
		cr.add_blend_point(_anim("crouch_idle" if info.has("crouch_idle") else "idle"), 0.0)
	_speeds["crouch_walk"] = csp
	bt.add_node("crouch", cr, Vector2(0, 200))
	var cr_ts := AnimationNodeTimeScale.new()
	bt.add_node("crouch_ts", cr_ts, Vector2(200, 200))
	bt.connect_node("crouch_ts", 0, "crouch")
	bt.add_node("crouch_idle_anim", _anim("crouch_idle" if info.has("crouch_idle") else "idle"), Vector2(0, 350))
	var cmv := AnimationNodeBlend2.new()
	bt.add_node("crouch_move", cmv, Vector2(300, 250))
	bt.connect_node("crouch_move", 0, "crouch_idle_anim")
	bt.connect_node("crouch_move", 1, "crouch_ts")
	var cb := AnimationNodeBlend2.new()
	bt.add_node("crouch_blend", cb, Vector2(400, 100))
	bt.connect_node("crouch_blend", 0, "move")
	bt.connect_node("crouch_blend", 1, "crouch_move")
	# удерживаемая поза
	var pose := AnimationNodeAnimation.new()
	pose.animation = "bc/idle"
	bt.add_node("pose_anim", pose, Vector2(400, 300))
	var pb := AnimationNodeBlend2.new()
	bt.add_node("pose_blend", pb, Vector2(600, 150))
	bt.connect_node("pose_blend", 0, "crouch_blend")
	bt.connect_node("pose_blend", 1, "pose_anim")
	# разовое действие
	var act := AnimationNodeAnimation.new()
	act.animation = "bc/idle"
	bt.add_node("act_anim", act, Vector2(600, 350))
	var act_ts := AnimationNodeTimeScale.new()
	bt.add_node("act_ts", act_ts, Vector2(750, 350))
	bt.connect_node("act_ts", 0, "act_anim")
	var os := AnimationNodeOneShot.new()
	os.fadein_time = 0.18
	os.fadeout_time = 0.22
	bt.add_node("action", os, Vector2(900, 150))
	bt.connect_node("action", 0, "pose_blend")
	bt.connect_node("action", 1, "act_ts")
	bt.connect_node("output", 0, "action")
	tree.tree_root = bt
	tree.active = true


## скорость тела (м/с) и присед (0..1); клипы подстраиваются под скорость
func set_motion(speed: float, crouch: float, delta: float) -> void:
	_speed = speed
	_crouch = move_toward(_crouch, crouch, delta * 4.0)
	if tree == null:
		return
	# стойка ↔ движение: вес за ~0.2 с (как время смешения стойки и шага в жанре — 0.15–0.25 с)
	var moving := speed > 0.12
	_move_w = move_toward(_move_w, 1.0 if moving else 0.0, delta / 0.2)
	var w := _move_w * _move_w * (3.0 - 2.0 * _move_w)
	tree.set("parameters/move/blend_amount", w)
	var bt := _loco_solve(maxf(speed, 0.05))
	tree.set("parameters/loco/blend_position", bt[0])
	tree.set("parameters/loco_ts/scale", bt[1])
	if ik:
		ik.body_speed = speed
	var csp: float = _speeds.get("crouch_walk", 1.0)
	var cts := clampf(speed / csp, 0.3, 1.8) if speed > 0.1 else 1.0
	_crouch_move_w = move_toward(_crouch_move_w, 1.0 if moving else 0.0, delta / 0.2)
	tree.set("parameters/crouch/blend_position", csp)
	tree.set("parameters/crouch_ts/scale", cts)
	tree.set("parameters/crouch_move/blend_amount", _crouch_move_w * _crouch_move_w * (3.0 - 2.0 * _crouch_move_w))
	tree.set("parameters/crouch_blend/blend_amount", _crouch)


## точка смешения и темп передвижения для скорости v. Между соседними клипами (скорость v_i, двойной шаг
## длиной L_i за время T_i) вес a подбирается так, чтобы смешанный шаг ((1−a)L_i + aL_j) за смешанное время
## ((1−a)T_i + aT_j) дал ровно v; темп — 1/T (шкала клипов — «1 с = 1 двойной шаг»).
## Медленнее нижнего клипа — тот же клип медленнее, быстрее верхнего — быстрее.
func _loco_solve(v: float) -> Array:
	if _loco_pts.is_empty():
		return [0.0, 1.0]
	var p0: Array = _loco_pts[0]
	var pn: Array = _loco_pts[-1]
	if v <= float(p0[1]):
		return [p0[1], (v / float(p0[1])) * (1.0 / float(p0[2]) if p0[4] else 1.0)]
	if v >= float(pn[1]):
		return [pn[1], (v / float(pn[1])) * (1.0 / float(pn[2]) if pn[4] else 1.0)]
	for i in range(_loco_pts.size() - 1):
		var A: Array = _loco_pts[i]
		var B: Array = _loco_pts[i + 1]
		if v > float(B[1]):
			continue
		if not (A[4] and B[4]):
			# без разметки шага — по-старому: линейно по скорости, клип в родном темпе
			return [v, 1.0]
		var Ta: float = A[2]
		var Tb: float = B[2]
		var La: float = A[3]
		var Lb: float = B[3]
		var den := (Lb - La) - v * (Tb - Ta)
		var a := clampf((v * Ta - La) / den, 0.0, 1.0) if absf(den) > 1e-4 else (v - float(A[1])) / (float(B[1]) - float(A[1]))
		var T := lerpf(Ta, Tb, a)
		return [lerpf(A[1], B[1], a), 1.0 / T]
	return [v, 1.0]


## удерживаемая поза (sit_idle, lie_idle, combat_idle, dead …); "" — снять
func set_pose(n: String) -> void:
	_pose = n
	if tree == null:
		return
	if n != "" and info.has(n):
		var pa: AnimationNodeAnimation = tree.tree_root.get_node("pose_anim")
		pa.animation = "bc/" + n
	var tw := create_tween()
	tw.tween_method(func(v): tree.set("parameters/pose_blend/blend_amount", v), tree.get("parameters/pose_blend/blend_amount"), 1.0 if n != "" else 0.0, 0.3)


## разовый клип; возвращает длительность (0 — клипа нет)
func play(n: String, rate := 1.0) -> float:
	if tree == null or not info.has(n):
		return 0.0
	var aa: AnimationNodeAnimation = tree.tree_root.get_node("act_anim")
	aa.animation = "bc/" + n
	var os: AnimationNodeOneShot = tree.tree_root.get_node("action")
	os.fadein_time = info[n].blend
	os.fadeout_time = info[n].blend
	var r: float = info[n].rate * rate
	tree.set("parameters/act_ts/scale", r)
	tree.set("parameters/action/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	_action = n
	_action_t = info[n].len / r
	return _action_t


func stop_action() -> void:
	if tree:
		tree.set("parameters/action/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	_action = ""


func busy() -> bool:
	return _action != ""


func _process(delta: float) -> void:
	if _action != "":
		_action_t -= delta
		if _action_t <= 0.0:
			var n := _action
			_action = ""
			action_finished.emit(n)
	if ik:
		# стопы ставим (и фиксируем опорную), когда стоит, идёт, сидит на корточках или играет клип «на ногах»
		# (старт, остановка, разворот, эмоции стоя — в конфигурации "ik": true); в остальных действиях и позах — нет
		var on := (_action == "" or bool(info.get(_action, {}).get("ik", false))) and (_pose == "" or bool(info.get(_pose, {}).get("ik", false)))
		ik.influence = move_toward(ik.influence, 1.0 if on else 0.0, delta * 5.0)


## кость для крепления (оружие в руку, фонарь …)
func attach(bone: String, node: Node3D) -> BoneAttachment3D:
	if skel == null:
		return null
	var ba := BoneAttachment3D.new()
	ba.bone_name = bone
	skel.add_child(ba)
	ba.add_child(node)
	return ba
