class_name Enemy
extends CharacterBody3D
## Заражённый: бегун, топтун или рубер (модели и клипы — из браузерной игры). Стоит или бродит у своего
## места; заметил героя (глазами в пределах sight или на шум) — идёт к нему: напрямую, если видно, иначе по
## сетке проходимости в обход стен; бьёт в момент удара клипа; убит — падает и оставляет спораны.

const LOOPED := ["Idle", "Walk", "Run", "Stomp", "Charge"]
## Естественная скорость клипов, м/с: темп подгоняется под настоящую скорость — ноги не скользят.
const GAIT := {"Walk": 1.1, "Run": 3.4, "Stomp": 2.0, "Charge": 6.4}

var game: Node
var type := "runner"
var T := {}
var hp := 60.0
var alive := true
var state := "idle"
var anim: AnimationPlayer
var model: Node3D
var home := Vector3.ZERO
var path := PackedVector3Array()
var path_t := 0.0
var look_t := 0.0
var attack_t := -1.0
var hit_done := false
var dead_t := 0.0
var wander_to := Vector3.ZERO
var wander_t := 0.0
var clip := ""
var pack := 0
var speed_var := 1.0

func setup(g: Node, t: String, pos: Vector3) -> void:
	game = g
	type = t
	T = Data.ENEMY[t]
	hp = float(T["hp"])
	speed_var = randf_range(0.85, 1.12)
	collision_layer = 4
	collision_mask = Level.WALL_LAYER
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = float(T["radius"])
	cap.height = 1.7
	cs.shape = cap
	cs.position.y = 0.85
	add_child(cs)
	model = (load("res://assets/characters/%s.glb" % t) as PackedScene).instantiate()
	model.scale = Vector3.ONE * float(T["scale"])
	add_child(model)
	anim = model.find_child("AnimationPlayer", true, false)
	for c in LOOPED:
		if anim and anim.has_animation(c):
			anim.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	position = pos
	home = pos
	wander_to = pos
	rotation.y = randf() * TAU
	play("Idle")
	if anim:
		anim.seek(randf() * 2.0, true)

func play(c: String, blend := 0.2, restart := false) -> void:
	if anim == null or not anim.has_animation(c):
		return
	if c == clip and not restart:
		return
	clip = c
	anim.play(c, blend)
	if restart:
		anim.seek(0.0, true)

## Заметил героя (или его шум): поднимается вся стая.
func alert() -> void:
	if not alive or state != "idle":
		return
	state = "chase"
	path_t = 0.0
	if pack > 0:
		for e in game.enemies:
			if e != self and e.pack == pack and e.alive and e.state == "idle":
				e.state = "chase"

func damage(dmg: float, from: Vector3) -> void:
	if not alive:
		return
	dmg = maxf(1.0, dmg - float(T.get("armor", 0.0)))
	hp -= dmg
	game.blood(global_position + Vector3(0, 1.0, 0))
	if state == "idle":
		alert()
	if hp <= 0.0:
		die(from)

func die(from: Vector3) -> void:
	alive = false
	state = "dead"
	collision_layer = 0
	collision_mask = 0
	anim.speed_scale = 1.0
	play("Death", 0.1, true)
	var push := global_position - from
	push.y = 0
	if push.length() > 0.01:
		rotation.y = atan2(-push.x, -push.z)
	game.on_kill(self)

func _physics_process(delta: float) -> void:
	if not alive:
		dead_t += delta
		if dead_t > 12.0:
			queue_free()
		return
	# цель — ближайший живой: герой, мур или наёмник (game.foe_for); в погоне видит дальше
	var player = game.foe_for(global_position, float(T["sight"]) * (1.0 if state == "idle" else 2.5))
	if player == null:
		if state != "idle" and (game.player == null or not game.player.alive):
			state = "idle"
		if state == "idle":
			_idle(delta)
			return
		player = game.player
	var to: Vector3 = player.global_position - global_position
	to.y = 0
	var d := to.length()
	look_t -= delta
	if state == "idle":
		if look_t <= 0.0:
			look_t = 0.35
			if d < float(T["sight"]) and game.line_of_sight(global_position, player.global_position):
				alert()
		_idle(delta)
		return
	# атака: замах, удар в момент hit_time, отход
	if attack_t >= 0.0:
		attack_t += delta
		velocity = Vector3.ZERO
		rotation.y = lerp_angle(rotation.y, atan2(to.x, to.z), minf(1.0, delta * 6.0))
		if not hit_done and attack_t >= float(T["hit_time"]):
			hit_done = true
			if d <= float(T["range"]) + 0.5:
				player.hurt(float(T["damage"]), global_position)
		if attack_t > float(T["hit_time"]) + 0.55:
			attack_t = -1.0
		return
	if d <= float(T["range"]):
		attack_t = 0.0
		hit_done = false
		anim.speed_scale = 1.0
		play("Attack", 0.1, true)
		return
	# погоня: напрямую, если видно и близко, иначе — по пути
	var goal := player.global_position as Vector3
	path_t -= delta
	if d > 3.0 and (path_t <= 0.0 or path.is_empty()):
		path_t = 0.6 + randf() * 0.3
		if game.line_of_sight(global_position, player.global_position):
			path = PackedVector3Array()
		else:
			path = game.level.path(global_position, player.global_position)
	if not path.is_empty():
		goal = path[0]
		if Vector2(goal.x - global_position.x, goal.z - global_position.z).length() < 0.5:
			path.remove_at(0)
	var dir := goal - global_position
	dir.y = 0
	var spd: float = float(T["speed"]) * speed_var
	if type == "ruber" and d < 9.0 and d > 3.0:
		spd = float(T.get("charge", spd))
	velocity = dir.normalized() * spd + _separation() if dir.length() > 0.05 else Vector3.ZERO
	move_and_slide()
	rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 8.0))
	var mv: String = T["move"]
	if type == "ruber" and spd > 4.0:
		mv = "Charge"
	play(mv, 0.2)
	anim.speed_scale = clampf(spd / float(GAIT.get(mv, 2.0)), 0.6, 1.6)

## Стоит или бродит у своего места.
func _idle(delta: float) -> void:
	wander_t -= delta
	if wander_t <= 0.0:
		wander_t = randf_range(3.0, 8.0)
		if randf() < 0.5:
			wander_to = home + Vector3(randf_range(-3.0, 3.0), 0, randf_range(-3.0, 3.0))
		else:
			wander_to = global_position
	var dir := wander_to - global_position
	dir.y = 0
	if dir.length() > 0.4 and not game.level.blocked_at(wander_to):
		velocity = dir.normalized() * 0.6
		move_and_slide()
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 3.0))
		play("Walk")
		anim.speed_scale = 0.6
	else:
		velocity = Vector3.ZERO
		play("Idle")
		anim.speed_scale = 1.0

## Не толпиться: отталкиваться от соседей.
func _separation() -> Vector3:
	var push := Vector3.ZERO
	for e in game.enemies:
		if e == self or not e.alive:
			continue
		var off: Vector3 = global_position - e.global_position
		off.y = 0
		var min_d: float = float(T["radius"]) + float(e.T["radius"])
		var l := off.length()
		if l > 0.001 and l < min_d:
			push += off / l * (min_d - l) * 4.0
	return push
