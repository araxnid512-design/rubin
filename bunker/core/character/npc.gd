class_name BCNpc
extends CharacterBody3D
## Персонаж-не-игрок BunkerCore (на той же модели/анимации, что и герой — BCCharacter).
## Роли:
##   resident — житель бункера: стоит у своего места, иногда переходит между точками, оглядывается; с ним можно
##              поговорить (реплики по очереди);
##   enemy    — враг для проверки боя: бродит, замечает героя (видимость + расстояние), догоняет, бьёт кулаками;
##              получает урон, вздрагивает от ударов, погибает, через время появляется снова.

@export var model_path := "res://assets/models/npc_eng.glb"
@export var anim_set := "res://assets/anim/eng"
@export_enum("resident", "enemy") var role := "resident"
@export var display_name := "Житель"
@export var lines: PackedStringArray = []
@export var points: Array = []          ## точки, между которыми ходит (мировые)

var rig: BCCharacter
var hp := 60.0
var state := "idle"
var _t := 0.0
var _goal := Vector3.ZERO
var _line := 0
var _home := Vector3.ZERO
var _cool := 0.0
var _fidget := 0.0          ## житель: через сколько секунд «пауза» (почесаться, оглядеться)
var _talk_t := -1.0         ## житель: сколько секунд назад говорил с героем (−1 — давно)
var _talks := 0
const WALK := 1.2
const RUN := 3.2


func _ready() -> void:
	collision_layer = BCKit.LAYER_NPC
	collision_mask = BCKit.LAYER_WORLD | BCKit.LAYER_PLAYER
	floor_snap_length = 0.4
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.78
	cs.shape = cap
	cs.position.y = 0.89
	add_child(cs)
	rig = BCCharacter.new()
	add_child(rig)
	rig.setup(model_path, anim_set)
	_home = global_position
	_goal = _home
	if role == "enemy":
		add_to_group("enemy")
		hp = 70.0
	else:
		BCKit.sensor(self, self, Vector3(1.6, 2.0, 1.6), Vector3(0, 1.0, 0))
	_t = randf() * 4.0
	_fidget = randf_range(8.0, 16.0)


func _physics_process(delta: float) -> void:
	if state == "dead":
		return
	_t -= delta
	_cool -= delta
	var want := Vector3.ZERO
	var speed := 0.0
	if role == "enemy":
		_enemy_ai(delta)
	match state:
		"walk", "chase":
			var to := _goal - global_position
			to.y = 0
			if to.length() < (1.25 if state == "chase" else 0.3):
				if state == "walk":
					state = "idle"
					_t = randf_range(3.0, 7.0)
			else:
				want = to.normalized()
				speed = RUN if state == "chase" else WALK
		"idle":
			if _t <= 0.0 and points.size() > 0 and role == "resident":
				_goal = points[randi() % points.size()]
				state = "walk"
			elif _t <= 0.0 and role == "enemy":
				_goal = _home + Vector3(randf_range(-6, 6), 0, randf_range(-6, 6))
				state = "walk"
	var hv := Vector3(velocity.x, 0, velocity.z).move_toward(want * speed, 8.0 * delta)
	velocity = Vector3(hv.x, -0.5 if is_on_floor() else velocity.y - 9.8 * delta, hv.z)
	move_and_slide()
	if want != Vector3.ZERO:
		rotation.y = lerp_angle(rotation.y, atan2(want.x, want.z), clampf(8.0 * delta, 0.0, 1.0))
	rig.set_motion(Vector3(velocity.x, 0, velocity.z).length(), 0.0, delta)
	if role == "resident":
		_resident_emotes(delta, want != Vector3.ZERO)


func _enemy_ai(_d: float) -> void:
	var p: Node3D = Core.player
	if p == null or p.state == "dead" or Core.world.underground:
		if state == "chase":
			state = "idle"
		return
	var to := p.global_position - global_position
	to.y = 0
	var d := to.length()
	if d < 12.0 and state != "attack" and state != "hit":
		state = "chase"
		_goal = p.global_position
	elif d > 18.0 and state == "chase":
		state = "idle"
		_t = 2.0
	if state == "chase" and d < 1.35 and _cool <= 0.0:
		_attack()


func _attack() -> void:
	state = "attack"
	velocity = Vector3.ZERO
	var to: Vector3 = Core.player.global_position - global_position
	rotation.y = atan2(to.x, to.z)
	var dur := rig.play("punch_light" if randf() < 0.6 else "punch_heavy")
	_cool = maxf(dur, 1.2) + 0.6
	get_tree().create_timer(dur * 0.45).timeout.connect(func():
		if state == "dead":
			return
		var p: Node3D = Core.player
		var dd := p.global_position - global_position
		var landed := dd.length() < 1.6 and global_transform.basis.z.dot(dd.normalized()) > 0.4
		Core.play_at("punch" if landed else "swoosh", global_position + Vector3.UP * 1.3, -3.0 if landed else -9.0)
		if landed:
			p.damage(9.0, -dd))
	get_tree().create_timer(dur).timeout.connect(func():
		if state == "attack":
			state = "chase")


func damage(amount: float, from_dir := Vector3.ZERO) -> void:
	if state == "dead":
		return
	hp -= amount
	if hp <= 0.0:
		_die()
		return
	state = "hit"
	var local := global_transform.basis.inverse() * from_dir
	var clip := "hit_front" if local.z >= 0 else "hit_back"
	if absf(local.x) > absf(local.z):
		clip = "hit_left" if local.x < 0 else "hit_right"
	var d := rig.play(clip)
	get_tree().create_timer(maxf(d * 0.7, 0.3)).timeout.connect(func():
		if state == "hit":
			state = "chase")


func _die() -> void:
	state = "dead"
	velocity = Vector3.ZERO
	collision_layer = 0
	var d := rig.play("death")
	rig.set_pose("dead", maxf(d - 0.45, 0.0))
	Core.say(display_name + " повержен.", "good")
	# появляется снова через минуту — для проверки боя
	get_tree().create_timer(60.0).timeout.connect(func():
		global_position = _home
		hp = 70.0
		state = "idle"
		collision_layer = BCKit.LAYER_NPC
		rig.set_pose(""))


# ---------------- разговор (житель) ----------------

func interact_label() -> String:
	return "Поговорить: " + display_name


func can_interact(_p) -> bool:
	return role == "resident" and state != "dead"


func interact_anim(_p) -> String:
	# разговор открывается сразу: герой не занят клипом (жест «разговор» — эмоция, её прерывает движение)
	return ""


func interact(_p) -> void:
	if lines.is_empty():
		return
	var to: Vector3 = Core.player.global_position - global_position
	# повернуться к герою плавно, не рывком
	var tw := create_tween()
	tw.tween_property(self, "rotation:y", rotation.y + angle_difference(rotation.y, atan2(to.x, to.z)), 0.35)
	state = "idle"
	_t = 6.0
	# первый раз — приветствие, дальше — кивает, объясняет, соглашается по очереди
	var clip: String = "wave" if (_talk_t < 0.0 or _talk_t > 60.0) else ["nod", "talk", "agree"][_talks % 3]
	if rig.has_clip(clip):
		get_tree().create_timer(0.3).timeout.connect(func(): if state == "idle": rig.play(clip))
	_talk_t = 0.0
	_talks += 1
	if _p and _p.has_method("_play_emote") and _p.rig and _p.rig.has_clip("talk") and not _p.rig.busy():
		_p._play_emote("talk")
	Core.hud.show_text(display_name, lines[_line % lines.size()])
	_line += 1


## житель: машет вслед, когда герой отошёл после разговора; иногда чешется или оглядывается
func _resident_emotes(delta: float, walking: bool) -> void:
	if _talk_t >= 0.0 and _talk_t < 60.0:
		_talk_t += delta
		var p: Node3D = Core.player
		if p and _talk_t > 1.5 and p.global_position.distance_to(global_position) > 3.2 and not walking:
			# дождаться конца приветствия/жеста, затем помахать вслед (один раз)
			if not rig.busy():
				if rig.has_clip("wave"):
					var to := p.global_position - global_position
					var tw := create_tween()
					tw.tween_property(self, "rotation:y", rotation.y + angle_difference(rotation.y, atan2(to.x, to.z)), 0.3)
					rig.play("wave")
				_talk_t = 60.0
	elif _talk_t >= 60.0:
		_talk_t += delta
	_fidget -= delta
	if _fidget <= 0.0:
		_fidget = randf_range(12.0, 22.0)
		if state == "idle" and not walking and not rig.busy():
			var pool := ["scratch", "look_around", "nod"].filter(func(n): return rig.has_clip(n))
			if not pool.is_empty():
				rig.play(pool[randi() % pool.size()])
