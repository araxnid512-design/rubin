extends CharacterBody3D
## Мур — бандит из стаба «Карьер» (учёт, отряды и гарнизон — features/murs.gd; в браузерной игре — класс Bandit
## в game/main.js). Модель героя с автоматом в узле хвата, клипы под винтовку, у каждого свой оттенок одежды.
## Ходит отрядом: на вылазке — к цели своей группы (тайник, выход), в «Карьере» — стоит на посту. Стреляет
## в ближайшего, кого видит на дальность своего ствола: заражённого, героя, наёмника. По людям — хуже, чем по
## заражённым: заметив человека, сначала целится (MUR_AIM), попадает реже (MUR_ACCURACY) и ранит слабее
## (MUR_DAMAGE), а по одному человеку разом стреляют не больше MUR_SHOOTERS муров — каждый MUR_TURN секунд,
## потом отдыхает MUR_REST и уступает очередь. Заражённые бросаются и на него (он в game.targets), герой бьёт
## его как враждебного (game.hostiles). Ранили — помнит, откуда (aggro), и идёт туда; патроны не кончаются —
## только перезарядка магазина.

const HP := 110.0
## По человеку: сколько секунд целится, прежде чем выстрелить.
const MUR_AIM := [1.0, 2.2]
## По человеку: доля обычной точности.
const MUR_ACCURACY := 0.45
## По человеку: доля урона ствола.
const MUR_DAMAGE := 0.3
## По одному человеку разом стреляют не больше стольких муров.
const MUR_SHOOTERS := 3
## Сколько секунд длится очередь одного мура по человеку и сколько он потом отдыхает.
const MUR_TURN := [2.5, 4.0]
const MUR_REST := [1.5, 3.0]
## Оружие муров: у каждого — случайное из этих, больше всего АК (11 из 16: АК-74, АК-47, АКС-74У, АК-107, РПК), реже
## СВД, FN FAL, G36, AUG (без дробовиков: картечь рассчитана на заражённых).
const MUR_GUNS := ["ak74", "ak74", "ak74", "ak47", "ak47", "ak47", "aks", "aks", "ak107", "ak107", "rpk",
	"rpk", "svd", "fnfal", "g36", "aug"]
const CLIPS := {"idle": "IdleRifle", "walk": "WalkRifle", "run": "RunRifle", "aim": "AimRifle", "shoot": "ShootRifle", "hit": "HitRifle", "reload": "ReloadRifle"}
const LOOPED := ["IdleRifle", "WalkRifle", "RunRifle", "AimRifle"]
## Модели муров из Tripo (по картинкам пользователя): каждому — случайная, клипы героя пересчитаны на их скелет
## один раз (SkinBake). Нет файлов — прежняя модель героя с оттенком одежды.
const TRIPO_MODELS := ["res://assets/tripo/mur_1.glb", "res://assets/tripo/mur_2.glb"]
const BAKE_CLIPS := ["IdleRifle", "WalkRifle", "RunRifle", "AimRifle", "ShootRifle", "HitRifle", "ReloadRifle", "Death"]
## Естественная скорость клипов ходьбы и бега, м/с (как у героя) — под неё подгоняется темп.
const GAIT := {"WalkRifle": 1.45, "RunRifle": 3.9}
const WALK_SPEED := 1.6
const RUN_SPEED := 3.8
## Дальше этого от героя модель не рисуется и не анимируется (экран телефона её всё равно не покажет).
const VIEW_DIST := 36.0
## Тёмная разношёрстная одежда — не форма: оттенки, на которые умножается цвет ткани и снаряжения.
const TINTS := [Color(0.62, 0.58, 0.52), Color(0.5, 0.56, 0.5), Color(0.64, 0.58, 0.64), Color(0.5, 0.52, 0.6), Color(0.72, 0.66, 0.56), Color(0.56, 0.48, 0.44)]

## Перекрашенные материалы на всех муров: «id материала:оттенок» → копия (не плодить материалы на каждого).
static var _tinted := {}

## Попадание мура по человеку через game.fire_shot: та зовёт у цели damage(), а у героя и наёмников — hurt().
class HumanHit extends Node3D:
	var who = null
	var alive := true
	var type := "human"
	var T := {"radius": 0.38}

	func damage(dmg: float, from: Vector3) -> void:
		if is_instance_valid(who) and who.alive:
			who.hurt(dmg, from)

var game: Node
var sys: Node
var type := "bandit"
## Для системы боя героя и заражённых: радиус и спораны (как у заражённых в Data.ENEMY).
var T := {"radius": 0.4, "spores": [1, 3]}
var hp := HP
var alive := true
var weapon := "ak74"
var W := {}
var mag := 30
var cooldown := 0.0
var reloading := 0.0
var busy := 0.0
var burst_left := 0
var burst := 0
var last_shot := -9.0
var retarget := 0.0
var target = null
var had_target := false
var aim_at = null
var aim_t := 0.0
var turn_t := 0.0
## Ранили или подняли тревогу: {"pos": Vector3, "t": секунд} — идёт туда, пока не увидит цель.
var aggro := {}
var alarmed := false
var alarm_t := 0.0
var alarm_pos := Vector3.ZERO
## Пост в «Карьере»: {"x", "z", "ry"}; пусто — не часовой.
var post := {}
## "raid" — на вылазке, "garrison" — в «Карьере».
var role := ""
var group := {}
var offset := Vector2.ZERO
var gone := false
var left := false
var model: Node3D
var anim: AnimationPlayer
## Поза оружия поверх клипа: переноска и левая кисть на цевье (npc_pose.gd).
var npc: NpcPose
var gun: Node3D
var muzzle: Node3D
var proxy: HumanHit
var clip := ""
var dead_t := 0.0
var path := PackedVector3Array()
var path_goal := Vector3.INF
var path_t := 0.0
var los := false
var los_t := 0.0
var stuck_pos := Vector3.ZERO
var stuck_check := 1.0
var stuck_n := 0

func setup(g: Node, s: Node, gun_id: String, pos: Vector3, post_data: Dictionary = {}) -> void:
	game = g
	sys = s
	weapon = gun_id
	W = Data.weapon(gun_id)
	if W.is_empty():
		weapon = "ak74"
		W = Data.weapon(weapon)
	mag = int(W.get("mag", 30))
	collision_layer = 8
	collision_mask = Level.WALL_LAYER
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	var grip: Node3D = null
	var paths := TRIPO_MODELS.filter(func(p): return ResourceLoader.exists(p))
	if not paths.is_empty():
		model = SkinBake.instance(str(paths.pick_random()), BAKE_CLIPS, game)
	if model:
		add_child(model)
		Level.rim(model)
		anim = model.get_node_or_null("AnimationPlayer") as AnimationPlayer
		grip = model.find_child("Grip", true, false) as Node3D
		npc = NpcPose.new()
		npc.grip_r = model.get_meta("grip_r", Transform3D.IDENTITY)
		npc.grip_l = model.get_meta("grip_l", Transform3D.IDENTITY)
		npc.unit = float(model.get_meta("unit", 1.0))
	else:
		model = (load("res://assets/characters/player.glb") as PackedScene).instantiate()
		add_child(model)
		Level.rim(model)
		anim = model.find_child("AnimationPlayer", true, false)
		_tint(model, randi() % TINTS.size())
		grip = Player.attach_point(model, "GripR")
		npc = NpcPose.make_for_old(model)
	for c in LOOPED:
		if anim and anim.has_animation(c):
			anim.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	gun = Gear.weapon(str(W.get("model", weapon)))
	if grip:
		Gear.put_in_hand(gun, grip)
	else:
		model.add_child(gun)
	muzzle = Gear.point(gun, "MuzzlePoint")
	if npc:
		var sks := model.find_children("*", "Skeleton3D", true, false)
		if not sks.is_empty():
			(sks[0] as Skeleton3D).add_child(npc)
		npc.set_weapon(gun, weapon)
	proxy = HumanHit.new()
	add_child(proxy)
	global_position = pos
	post = post_data
	rotation.y = float(post.get("ry", 0.0)) if not post.is_empty() else randf() * TAU
	cooldown = randf()
	retarget = randf() * 0.4
	offset = Vector2(randf() - 0.5, randf() - 0.5) * 3.0
	stuck_pos = pos
	play(CLIPS["idle"], 0.0)
	if anim:
		anim.seek(randf() * 2.0, true)

## Ткань и снаряжение — своего оттенка (копия материала на оттенок, общая для всех муров).
func _tint(root: Node, k: int) -> void:
	var tint: Color = TINTS[k]
	for node in root.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = node
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var mat: Material = mi.get_active_material(i)
			if not mat is BaseMaterial3D:
				continue
			var nm := str(mat.resource_name)
			if not ("Cloth" in nm or "Gear" in nm):
				continue
			var key := "%d:%d" % [mat.get_instance_id(), k]
			if not _tinted.has(key):
				var dup: BaseMaterial3D = mat.duplicate()
				dup.albedo_color = (mat as BaseMaterial3D).albedo_color * tint
				_tinted[key] = dup
			mi.set_surface_override_material(i, _tinted[key])

func play(c: String, blend := 0.15, restart := false) -> void:
	if anim == null or not anim.has_animation(c):
		return
	if c == clip and not restart:
		return
	clip = c
	anim.play(c, blend)
	if restart:
		anim.seek(0.0, true)

func muzzle_pos() -> Vector3:
	if muzzle and muzzle.is_inside_tree():
		return muzzle.global_position
	return global_position + Vector3(0, 1.3, 0) + Vector3(sin(rotation.y), 0, cos(rotation.y)) * 0.6

## Повернуться к углу want не быстрее step радиан.
func _turn(want: float, step: float) -> void:
	rotation.y += clampf(wrapf(want - rotation.y, -PI, PI), -step, step)

func _physics_process(delta: float) -> void:
	if game == null:
		return
	var near := false
	if is_instance_valid(game.player):
		var pp: Vector3 = game.player.global_position
		near = global_position.distance_to(pp) < VIEW_DIST
	if model.visible != near:
		model.visible = near
		if anim:
			anim.active = near
		if npc:
			npc.active = near
	if npc and near:
		# переноска — когда стоит, идёт или бежит; левая кисть на цевье — всегда, кроме перезарядки и смерти
		var calm := clip == CLIPS["idle"] or clip == CLIPS["walk"] or clip == CLIPS["run"]
		npc.carry = move_toward(npc.carry, 1.0 if alive and calm else 0.0, delta / 0.2)
		npc.left = move_toward(npc.left, 1.0 if alive and clip != CLIPS["reload"] else 0.0, delta / 0.15)
	if not alive:
		dead_t += delta
		if dead_t > 12.0:
			sys.forget(self)
			queue_free()
		return
	cooldown -= delta
	busy -= delta
	if not aggro.is_empty():
		aggro["t"] = float(aggro["t"]) - delta
		if float(aggro["t"]) <= 0.0:
			aggro = {}
	if alarmed:
		alarm_t -= delta
		if alarm_t <= 0.0:
			alarmed = false
			aggro = {"pos": alarm_pos, "t": 12.0}
	if reloading > 0.0:
		reloading -= delta
		if reloading <= 0.0:
			mag = int(W.get("mag", 30))
	retarget -= delta
	var has_t: bool = is_instance_valid(target) and target.alive
	if retarget <= 0.0 or (had_target and not has_t):
		retarget = 0.4
		target = sys.target_for(self)
		had_target = target != null
		has_t = had_target
	if has_t:
		_fight(target, delta)
		return
	turn_t = 0.0   # цели нет — очередь стрелять другим
	_walk(delta)

## Стоит и стреляет: очередями, с перезарядкой; по человеку — с прицелом и по очереди с другими.
func _fight(t, delta: float) -> void:
	velocity = Vector3.ZERO
	stuck_n = 0
	var tp: Vector3 = t.global_position
	var to := tp - global_position
	to.y = 0.0
	var ang := atan2(to.x, to.z)
	_turn(ang, delta * 7.0)
	var facing := absf(wrapf(ang - rotation.y, -PI, PI)) < 0.35
	var human: bool = sys.is_human(t)
	# новая цель: по человеку сначала прицеливается секунду-две, по заражённому — почти сразу
	if not is_instance_valid(aim_at) or aim_at != t:
		aim_at = t
		turn_t = 0.0
		aim_t = randf_range(MUR_AIM[0], MUR_AIM[1]) if human else 0.3
	aim_t -= delta
	if human:
		if turn_t > 0.0:
			turn_t -= delta
			if turn_t <= 0.0:
				aim_t = randf_range(MUR_REST[0], MUR_REST[1])
		if turn_t <= 0.0 and aim_t <= 0.0 and int(sys.shooters_on(t, self)) < MUR_SHOOTERS:
			turn_t = randf_range(MUR_TURN[0], MUR_TURN[1])
	var can_fire := aim_t <= 0.0 and (not human or turn_t > 0.0)
	if mag <= 0 and reloading <= 0.0:
		_reload()
	elif cooldown <= 0.0 and reloading <= 0.0 and facing and can_fire:
		_fire(t, human)
	if reloading > 0.0:
		if clip != CLIPS["reload"]:
			play(CLIPS["reload"], 0.15, true)
			var clip_len: float = anim.get_animation(CLIPS["reload"]).length if anim and anim.has_animation(CLIPS["reload"]) else 2.0
			if anim:
				anim.speed_scale = clip_len / maxf(0.5, float(W.get("reload", 2.3)))
	elif busy <= 0.0:
		play(CLIPS["aim"], 0.2)
		if anim:
			anim.speed_scale = 1.0

func _reload() -> void:
	reloading = float(W.get("reload", 2.3))
	busy = 0.0

## Выстрел: автоматы — очередями по 2–4 с паузами, винтовка — редко. По заражённому — как у всех
## (game.fire_shot), по человеку — свой бросок точности × MUR_ACCURACY, попал — урон × MUR_DAMAGE.
func _fire(t, human: bool) -> void:
	mag -= 1
	if anim:
		anim.speed_scale = 1.0
	play(CLIPS["shoot"], 0.04, true)
	busy = 0.12
	var auto := float(W.get("auto", W.get("cooldown", 0.3)))
	if auto < 0.2:
		burst_left = burst_left - 1 if burst_left > 0 else 2 + randi() % 3
		cooldown = auto if burst_left > 0 else 0.9 + randf() * 0.7
	else:
		cooldown = auto + 0.6 + randf() * 0.6
	var now: float = game.time
	burst = burst + 1 if now - last_shot < 0.35 else 0
	last_shot = now
	sys.shots += 1
	var from := muzzle_pos()
	if not human:
		game.fire_shot(self, W, t, from)
		return
	var tp: Vector3 = t.global_position
	var d := Vector2(tp.x - global_position.x, tp.z - global_position.z).length()
	var reach := maxf(1.0, float(W.get("range", 8.0)))
	var chance := clampf(1.0 - d / reach * float(W.get("falloff", 0.35)) - minf(10.0, float(burst)) * float(W.get("spread", 0.05)), 0.0, 1.0)
	chance = maxf(0.4, chance) * MUR_ACCURACY
	var w: Dictionary = W.duplicate()
	w["falloff"] = 0.0
	w["pellets"] = 1
	w["damage"] = float(W.get("damage", 30)) * MUR_DAMAGE
	if randf() < chance:
		proxy.who = t
		proxy.global_position = tp
		sys.human_hits += 1
		game.fire_shot(self, w, proxy, from)
	else:
		game.fire_shot(self, w, null, from)

## Идёт к цели: раненый — туда, откуда стреляли; на вылазке — к цели группы; часовой — к своему посту.
func _walk(delta: float) -> void:
	var goal := Vector3.INF
	var thr := 1.2
	if not aggro.is_empty():
		goal = aggro["pos"]
	else:
		goal = sys.goal_for(self)
		if goal == Vector3.INF and not post.is_empty():
			goal = Vector3(float(post["x"]), 0.0, float(post["z"]))
			thr = 0.5
	var d := INF
	if goal != Vector3.INF:
		d = Vector2(goal.x - global_position.x, goal.z - global_position.z).length()
	if goal == Vector3.INF or d < thr:
		velocity = Vector3.ZERO
		stuck_n = 0
		if not post.is_empty() and aggro.is_empty():
			_turn(float(post.get("ry", 0.0)), delta * 2.0)
		if busy <= 0.0 and reloading <= 0.0:
			play(CLIPS["idle"], 0.3)
			if anim:
				anim.speed_scale = 1.0
		if aggro.is_empty():
			sys.arrived(self, delta)
		return
	var dir := Vector3(goal.x - global_position.x, 0.0, goal.z - global_position.z) / d
	los_t -= delta
	if los_t <= 0.0:
		los_t = 0.3
		los = game.line_of_sight(global_position, goal)
	if los:
		path = PackedVector3Array()
	else:
		path_t -= delta
		if path.is_empty() or path_t <= 0.0 or path_goal.distance_to(goal) > 1.5:
			path_t = 2.0
			path_goal = goal
			path = game.level.path(global_position, goal)
		if not path.is_empty():
			var p: Vector3 = path[0]
			if Vector2(p.x - global_position.x, p.z - global_position.z).length() < 0.5:
				path.remove_at(0)
			if not path.is_empty():
				var q: Vector3 = path[0]
				var off := Vector3(q.x - global_position.x, 0.0, q.z - global_position.z)
				if off.length() > 0.01:
					dir = off.normalized()
	# не наступает на своих
	var sep: Vector3 = sys.separation(self)
	dir = (dir + sep).normalized()
	var run: bool = not aggro.is_empty() or bool(sys.hurry(self))
	var spd := RUN_SPEED if run else WALK_SPEED
	velocity = dir * spd
	move_and_slide()
	if dir.length() > 0.01:
		_turn(atan2(dir.x, dir.z), delta * 8.0)
	var c: String = CLIPS["run"] if run else CLIPS["walk"]
	if busy <= 0.0:
		play(c, 0.18)
		if anim:
			anim.speed_scale = clampf(spd / float(GAIT[c]), 0.7, 1.5)
	# застрял (стена, свои): ищет путь заново, у самой цели — считается дошедшим, долго — сдаётся
	stuck_check -= delta
	if stuck_check <= 0.0:
		stuck_check = 1.0
		stuck_n = stuck_n + 1 if global_position.distance_to(stuck_pos) < 0.4 else 0
		stuck_pos = global_position
		if stuck_n >= 2:
			path_t = 0.0
		if stuck_n >= 8:
			stuck_n = 0
			if aggro.is_empty():
				sys.stuck(self)
			else:
				aggro = {}
	if stuck_n >= 3 and d < 4.0 and aggro.is_empty():
		sys.arrived(self, delta)

## Попадание (пуля, удар заражённого). from — откуда: туда мур и пойдёт разбираться.
func damage(dmg: float, from: Vector3) -> void:
	if not alive:
		return
	hp -= dmg
	game.blood(global_position + Vector3(0, 1.2, 0))
	var push := global_position - from
	push.y = 0.0
	if push.length() > 0.01:
		move_and_collide(push.normalized() * 0.2)
	aggro = {"pos": from, "t": 10.0}
	sys.alarm(self, from)
	if hp <= 0.0:
		_die(from)
	elif reloading <= 0.0:
		play(CLIPS["hit"], 0.06, true)
		busy = 0.3

## Заражённые бьют его так же, как героя.
func hurt(dmg: float, from: Vector3) -> void:
	damage(dmg, from)

func _die(from: Vector3) -> void:
	hp = 0.0
	alive = false
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	if anim:
		anim.speed_scale = 1.0
	play("Death", 0.1, true)
	var push := global_position - from
	push.y = 0.0
	if push.length() > 0.01:
		rotation.y = atan2(-push.x, -push.z)
	sys.bandit_died(self)
