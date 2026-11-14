class_name BCCharacter
extends Node3D
## Внешний вид персонажа BunkerCore: модель со скелетом, библиотека клипов (BCAnimSet), дерево анимаций
## (AnimationTree) и постановка стоп (BCFootIK).
##   передвижение — смешение idle / walk / run / sprint по скорости (м/с), клипы проигрываются с той скоростью,
##                  при которой шаг совпадает со скоростью тела (без скольжения стоп);
##   присед       — отдельное смешение crouch_idle / crouch_walk, плавно вместо стоя;
##   действие     — разовый клип поверх всего (дверь, терминал, удар, попадание …);
##   поза         — удерживаемая поза (сидит, лежит, боевая стойка, мёртв).

signal action_finished(name: String)

@export var model_path := "res://assets/models/hero.glb"
@export var height := 1.8

var model: Node3D
var skel: Skeleton3D
var ap: AnimationPlayer
var tree: AnimationTree
var ik: BCFootIK
var info := {}          ## клип → {len, speed, loop, blend, rate, lock}
var scale_k := 1.0
var _action := ""
var _action_t := 0.0
var _pose := ""
var _speeds := {}
var _speed := 0.0
var _crouch := 0.0
var _crouch_t := 0.0


func setup(path := "") -> void:
	if path != "":
		model_path = path
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
	var built := BCAnimSet.build(skel, model, cfg, scale_k)
	info = built.info
	ap.add_animation_library("bc", built.lib)
	_build_tree()
	ik = BCFootIK.new()
	ik.name = "FootIK"
	skel.add_child(ik)


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
	return a


func _build_tree() -> void:
	tree = AnimationTree.new()
	tree.name = "Tree"
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(ap)
	tree.root_node = tree.get_path_to(model)
	var bt := AnimationNodeBlendTree.new()
	# передвижение стоя: точки — по родным скоростям клипов
	var loco := AnimationNodeBlendSpace1D.new()
	loco.min_space = 0.0
	loco.max_space = 8.0
	loco.sync = true
	_speeds = {"idle": 0.0}
	loco.add_blend_point(_anim("idle"), 0.0)
	for k in ["walk", "run", "sprint"]:
		if info.has(k):
			var sp: float = info[k].speed if info[k].speed > 0.1 else {"walk": 1.3, "run": 3.6, "sprint": 5.6}[k]
			_speeds[k] = sp
			loco.add_blend_point(_anim(k), sp)
	bt.add_node("loco", loco, Vector2(0, 0))
	var loco_ts := AnimationNodeTimeScale.new()
	bt.add_node("loco_ts", loco_ts, Vector2(200, 0))
	bt.connect_node("loco_ts", 0, "loco")
	# присед
	var cr := AnimationNodeBlendSpace1D.new()
	cr.min_space = 0.0
	cr.max_space = 3.0
	cr.sync = true
	cr.add_blend_point(_anim("crouch_idle" if info.has("crouch_idle") else "idle"), 0.0)
	var csp := 1.0
	if info.has("crouch_walk"):
		csp = info.crouch_walk.speed if info.crouch_walk.speed > 0.1 else 1.0
		cr.add_blend_point(_anim("crouch_walk"), csp)
	_speeds["crouch_walk"] = csp
	bt.add_node("crouch", cr, Vector2(0, 200))
	var cr_ts := AnimationNodeTimeScale.new()
	bt.add_node("crouch_ts", cr_ts, Vector2(200, 200))
	bt.connect_node("crouch_ts", 0, "crouch")
	var cb := AnimationNodeBlend2.new()
	bt.add_node("crouch_blend", cb, Vector2(400, 100))
	bt.connect_node("crouch_blend", 0, "loco_ts")
	bt.connect_node("crouch_blend", 1, "crouch_ts")
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
	var walk_sp: float = _speeds.get("walk", 1.3)
	var bp := speed
	var ts := 1.0
	# медленнее шага: проигрывать шаг медленнее, а не смешивать с «стоя» (иначе стопы скользят)
	if speed > 0.15 and speed < walk_sp:
		bp = walk_sp
		ts = speed / walk_sp
	elif speed <= 0.15:
		bp = 0.0
	var top: float = _speeds.get("sprint", _speeds.get("run", 3.6))
	if speed > top:
		ts = speed / top
	tree.set("parameters/loco/blend_position", bp)
	tree.set("parameters/loco_ts/scale", ts)
	var csp: float = _speeds.get("crouch_walk", 1.0)
	var cbp := csp if speed > 0.1 else 0.0
	var cts := clampf(speed / csp, 0.3, 1.8) if speed > 0.1 else 1.0
	tree.set("parameters/crouch/blend_position", cbp)
	tree.set("parameters/crouch_ts/scale", cts)
	tree.set("parameters/crouch_blend/blend_amount", _crouch)


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
		# стопы ставим, только когда стоит, идёт или сидит на корточках; в действиях и позах — нет
		ik.influence = move_toward(ik.influence, 1.0 if (_action == "" and _pose == "") else 0.0, delta * 5.0)


## кость для крепления (оружие в руку, фонарь …)
func attach(bone: String, node: Node3D) -> BoneAttachment3D:
	if skel == null:
		return null
	var ba := BoneAttachment3D.new()
	ba.bone_name = bone
	skel.add_child(ba)
	ba.add_child(node)
	return ba
