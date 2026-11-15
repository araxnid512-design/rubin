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
var _slot := "a"                ## слот разового действия (два — для плавной смены действий)
var _pose_tw: Tween
var _pose_w := 0.0
var _crouch_move_w := 0.0
var _loco_pts: Array = []       ## точки смешения передвижения: [клип, скорость м/с, время двойного шага, длина двойного шага]
var arms: BCArmClear
var limbs: BCLimbAlign
var lite := false               ## упрощённый персонаж (житель, враг): без разворота колен/локтей и рук вне тела
var _active := true
var _near := true               ## житель/враг ближе 12 м к герою — стопы ставятся
var _near_t := 0.0
var _ik_act := false            ## текущее разовое действие разрешает IK стоп ("ik" в конфигурации)
var _ik_pose := true            ## текущая поза разрешает IK стоп
var hands: BCHandIK
var hold: BCWeaponHold          ## хват оружия: обе руки к оружию, пальцы на рукояти
var ground: BCGroundClamp       ## лежащее тело — на полу (клипы с пометкой "ground")
var probe: BCProbe              ## итоговая поза для проверок
var built_poses := true         ## стойки и удары — построенные (false — клипы Tripo как есть)


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
	# хват оружия создаётся раньше: его расчёт рук нужен построителю поз
	hold = BCWeaponHold.new()
	hold.name = "WeaponHold"
	skel.add_child(hold)
	hold.setup(1.0 / scale_k, Basis(Vector3.UP, yaw_offset) * Vector3.BACK)
	if built_poses:
		# стойки и удары по анатомическим правилам — вместо клипов Tripo (те остаются как «имя_tripo»)
		BCPoseBuilder.new(self).install(built.lib, info)
	_build_tree()
	# порядок модификаторов: стопы (IK, фиксация) → разворот колен/локтей → руки вне тела → кисть к цели.
	# Житель и враг (родитель — BCNpc) — упрощённо: только стопы, и те — рядом с героем (ближе 12 м)
	lite = false
	limbs = null
	arms = null
	hands = null
	ground = BCGroundClamp.new()
	ground.name = "GroundClamp"
	skel.add_child(ground)
	ground.floor_y = -model.position.y / scale_k
	ik = BCFootIK.new()
	ik.name = "FootIK"
	skel.add_child(ik)
	if not lite:
		limbs = BCLimbAlign.new()
		limbs.name = "LimbAlign"
		skel.add_child(limbs)
		# руки не уходят в туловище и бёдра (объёмная куртка); кисть — к ручке / пульту при взаимодействии
		arms = BCArmClear.new()
		arms.name = "ArmClear"
		skel.add_child(arms)
		arms.setup_model(model_path, model)     # разбор сетки — один раз на модель (кеш по пути)
		hands = BCHandIK.new()
		hands.name = "HandIK"
		skel.add_child(hands)
	skel.move_child(hold, -1)                 # хват — после остальных поправок
	probe = BCProbe.new()
	probe.name = "Probe"
	skel.add_child(probe)
	_ik_act = false
	_ik_pose = true
	set_active(_active)


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
	# "off": клип есть в библиотеке (лаборатория его проверяет), но игра его сама не запускает
	return info.has(n) and not info[n].get("off", false)


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
	# разовое действие — два слота поверх позы: новое действие во время старого запускается в свободном слоте,
	# старое плавно уходит (иначе повторный запуск OneShot обрывал клип и начинал новый с кадра 0 — рывок)
	var below := "pose_blend"
	for sl in ["a", "b"]:
		var act := AnimationNodeAnimation.new()
		act.animation = "bc/idle"
		bt.add_node("act_anim_" + sl, act, Vector2(600, 350 if sl == "a" else 500))
		var act_ts := AnimationNodeTimeScale.new()
		bt.add_node("act_ts_" + sl, act_ts, Vector2(750, 350 if sl == "a" else 500))
		bt.connect_node("act_ts_" + sl, 0, "act_anim_" + sl)
		var os := AnimationNodeOneShot.new()
		os.fadein_time = 0.18
		os.fadeout_time = 0.22
		os.fadein_curve = _ease_curve()
		os.fadeout_curve = _ease_curve()
		bt.add_node("action_" + sl, os, Vector2(900, 150 if sl == "a" else 300))
		bt.connect_node("action_" + sl, 0, below)
		bt.connect_node("action_" + sl, 1, "act_ts_" + sl)
		below = "action_" + sl
	bt.connect_node("output", 0, below)
	tree.tree_root = bt
	tree.active = true


## скорость тела (м/с) и присед (0..1); клипы подстраиваются под скорость
func set_motion(speed: float, crouch: float, delta: float) -> void:
	_speed = speed
	_crouch = move_toward(_crouch, crouch, delta / 0.45)
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
	tree.set("parameters/crouch_blend/blend_amount", _crouch * _crouch * (3.0 - 2.0 * _crouch))


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


## удерживаемая поза (sit_idle, lie_idle, combat_idle, dead …); "" — снять.
## delay — через сколько секунд начать смену (например, после того как разовый клип полностью вошёл):
## иначе поза уходит раньше, чем клип её закрывает, и на мгновение видна стойка (рывок).
func set_pose(n: String, delay := 0.0) -> void:
	_pose = n
	_ik_pose = n == "" or (info.has(n) and bool(info[n].get("ik", false)))
	if tree == null:
		return
	if n != "" and info.has(n):
		var pa: AnimationNodeAnimation = tree.tree_root.get_node("pose_anim")
		pa.animation = "bc/" + n
	if _pose_tw and _pose_tw.is_valid():
		_pose_tw.kill()
	_pose_tw = create_tween()
	if delay > 0.0:
		_pose_tw.tween_interval(delay)
	_pose_tw.tween_method(func(v):
		_pose_w = v
		tree.set("parameters/pose_blend/blend_amount", v * v * (3.0 - 2.0 * v)), _pose_w, 1.0 if n != "" else 0.0, 0.3)


## разовый клип; возвращает длительность (0 — клипа нет)
func play(n: String, rate := 1.0) -> float:
	if tree == null or not info.has(n):
		return 0.0
	var other := _slot
	if _action != "":
		_slot = "b" if _slot == "a" else "a"
		# прежнее действие уходит за время смешивания нового
		var o: AnimationNodeOneShot = tree.tree_root.get_node("action_" + other)
		o.fadeout_time = info[n].blend
		tree.set("parameters/action_%s/request" % other, AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	var aa: AnimationNodeAnimation = tree.tree_root.get_node("act_anim_" + _slot)
	aa.animation = "bc/" + n
	var os: AnimationNodeOneShot = tree.tree_root.get_node("action_" + _slot)
	os.fadein_time = info[n].blend
	os.fadeout_time = info[n].blend
	var r: float = info[n].rate * rate
	tree.set("parameters/act_ts_%s/scale" % _slot, r)
	tree.set("parameters/action_%s/request" % _slot, AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	_action = n
	_ik_act = bool(info[n].get("ik", false))
	_action_t = info[n].len / r
	return _action_t


func stop_action() -> void:
	if tree:
		for sl in ["a", "b"]:
			tree.set("parameters/action_%s/request" % sl, AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	_action = ""


static func _ease_curve() -> Curve:
	var c := Curve.new()
	c.add_point(Vector2(0, 0), 0, 0)
	c.add_point(Vector2(1, 1), 0, 0)
	return c


func busy() -> bool:
	return _action != ""


func _process(delta: float) -> void:
	if not _active:
		return
	if _action != "":
		_action_t -= delta
		if _action_t <= 0.0:
			var n := _action
			_action = ""
			action_finished.emit(n)
	# поправки для клипов Tripo (разворот локтей и колен, руки вне тела) построенным позам не нужны:
	# там суставы уже стоят по анатомии, а поправка только портит (кисть в ударе «свисала»)
	var cur_clip := _action if _action != "" else (_pose if _pose != "" else ("idle" if _move_w < 0.5 else "walk"))
	var built_now: bool = info.has(cur_clip) and bool(info[cur_clip].get("built", false))
	for m in [limbs, arms]:
		if m and m.active == built_now:
			m.active = not built_now
	if ground:
		var g := (_action != "" and bool(info[_action].get("ground", false))) or (_pose != "" and info.has(_pose) and bool(info[_pose].get("ground", false)))
		ground.weight = move_toward(ground.weight, 1.0 if g else 0.0, delta * 6.0)
	if ik:
		if lite:
			# житель/враг: стопы — только рядом с героем (проверка 4 раза в секунду)
			_near_t -= delta
			if _near_t <= 0.0:
				_near_t = 0.25
				_near = true
				ik.active = _near
		# стопы ставим (и фиксируем опорную), когда стоит, идёт, сидит на корточках или играет клип «на ногах»
		# (старт, остановка, разворот, эмоции стоя — в конфигурации "ik": true); в остальных действиях и позах — нет
		var on := (_action == "" or _ik_act) and _ik_pose
		ik.influence = move_toward(ik.influence, 1.0 if on else 0.0, delta * 5.0)


## пауза / продолжение: дерево анимаций и все модификаторы скелета (житель, которого не видно, и т. п.)
func set_active(on: bool) -> void:
	_active = on
	if tree:
		tree.active = on
	if ik:
		ik.active = on and (not lite or _near)
	for m in [limbs, arms, hands, hold, ground]:
		if m:
			m.active = on
	set_process(on)


## кость для крепления (оружие в руку, фонарь …)
func attach(bone: String, node: Node3D) -> BoneAttachment3D:
	if skel == null:
		return null
	var ba := BoneAttachment3D.new()
	ba.bone_name = bone
	skel.add_child(ba)
	ba.add_child(node)
	return ba
