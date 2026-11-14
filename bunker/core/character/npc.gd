class_name BCNpc
extends CharacterBody3D
## Персонаж-не-игрок BunkerCore (на той же модели/анимации, что и герой — BCCharacter).
## Роли:
##   resident — житель бункера: стоит у своего места, иногда переходит между точками, оглядывается; с ним можно
##              поговорить (реплики по очереди);
##   enemy    — враг: бродит, замечает героя, догоняет. Бьёт не сразу — перед ударом замах с меткой «!»
##              (можно увернуться или поставить блок). Одновременно бьют не больше двух врагов, остальные
##              кружат рядом и ждут очереди. Раненый мародёр убегает. Тяжёлый удар и идеальный блок героя
##              сбивают врага с ног. После гибели может остаться добыча. Варианты — VARIANTS.

@export var model_path := "res://assets/models/npc_eng.glb"
@export var anim_set := "res://assets/anim/eng"
@export_enum("resident", "enemy") var role := "resident"
@export var display_name := "Житель"
@export var npc_id := ""                 ## id для заданий (Core.world.objects): eng, med, raider …
@export var kind := ""                   ## вид врага для заданий «победить»
@export var lines: PackedStringArray = []
@export var points: Array = []          ## точки, между которыми ходит (мировые)
@export var variant := "raider"          ## для врага: raider / leader / mutant

const VARIANTS := {
	"raider": {"hp": 70.0, "dmg": 9.0, "speed": 3.2, "reach": 1.35, "windup": 0.55, "cool": 1.5, "see": 12.0, "flee": 0.25, "poise": false, "weapon": "", "loot": [["canned", 0.4], ["medkit", 0.15]]},
	"leader": {"hp": 160.0, "dmg": 17.0, "speed": 2.9, "reach": 1.8, "windup": 0.75, "cool": 2.0, "see": 14.0, "flee": 0.0, "poise": true, "weapon": "pipe", "loot": [["fuel_can", 1.0], ["canned", 1.0]]},
	"mutant": {"hp": 95.0, "dmg": 13.0, "speed": 4.4, "reach": 1.5, "windup": 0.42, "cool": 1.2, "see": 18.0, "flee": 0.0, "poise": false, "weapon": "", "loot": []},
}
static var attackers: Array = []        ## враги, которым сейчас можно бить (не больше двух)
var max_hp := 60.0
var _v := {}
var _bang: Label3D                      ## «!» над головой во время замаха
var _bar: Label3D                       ## полоса здоровья
var _bar_t := 0.0
var _orbit := 0.0
var _fled := false
var respawn := false                    ## появляться снова (только для врага-образца без управляющего)

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
	if npc_id != "":
		Core.world.register(npc_id, self)
	if role == "enemy":
		add_to_group("enemy")
		_v = VARIANTS.get(variant, VARIANTS.raider)
		max_hp = _v.hp
		hp = max_hp
		_orbit = randf() * TAU
		_bang = Label3D.new()
		_bang.text = "!"
		_bang.font_size = 150
		_bang.outline_size = 18
		_bang.modulate = Color(1.0, 0.25, 0.15)
		_bang.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_bang.no_depth_test = true
		_bang.position = Vector3(0, 2.35, 0)
		_bang.visible = false
		add_child(_bang)
		_bar = Label3D.new()
		_bar.font_size = 40
		_bar.outline_size = 8
		_bar.billboard = BaseMaterial3D.BILLBOARD_ENABLED
		_bar.no_depth_test = true
		_bar.position = Vector3(0, 2.15, 0)
		_bar.visible = false
		add_child(_bar)
		_update_bar()
		if _v.weapon != "":
			BCWeapon.attach(rig, _v.weapon)
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
	elif Core.player and Core.player.state != "dead":
		# житель ждёт, когда герой подошёл, и поворачивается к нему — чтобы можно было заговорить
		var tp: Vector3 = Core.player.global_position - global_position
		tp.y = 0
		if tp.length() < 2.6 and absf(Core.player.global_position.y - global_position.y) < 1.5:
			if state == "walk":
				state = "idle"
			_t = maxf(_t, 2.5)
			rotation.y = lerp_angle(rotation.y, atan2(tp.x, tp.z), clampf(4.0 * delta, 0.0, 1.0))
	match state:
		"walk", "chase", "circle", "flee":
			var to := _goal - global_position
			to.y = 0
			if to.length() < (1.1 if state == "chase" else 0.3):
				if state == "walk":
					state = "idle"
					_t = randf_range(3.0, 7.0)
			else:
				want = to.normalized()
				speed = WALK
				if state == "chase" or state == "flee":
					speed = _v.get("speed", RUN)
				elif state == "circle":
					speed = 1.6
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
	if state == "circle" and Core.player:
		# кружит лицом к герою
		var tp: Vector3 = Core.player.global_position - global_position
		rotation.y = lerp_angle(rotation.y, atan2(tp.x, tp.z), clampf(6.0 * delta, 0.0, 1.0))
	elif want != Vector3.ZERO:
		rotation.y = lerp_angle(rotation.y, atan2(want.x, want.z), clampf(8.0 * delta, 0.0, 1.0))
	if _bar:
		_bar_t -= delta
		_bar.visible = _bar_t > 0.0 and state != "dead"
	rig.set_motion(Vector3(velocity.x, 0, velocity.z).length(), 0.0, delta)
	if role == "resident":
		_resident_emotes(delta, want != Vector3.ZERO)


func _enemy_ai(delta: float) -> void:
	var p: Node3D = Core.player
	if p == null or p.state == "dead" or Core.world.underground or not is_visible_in_tree():
		if state in ["chase", "circle", "flee"]:
			state = "idle"
			_release()
		return
	var to := p.global_position - global_position
	to.y = 0
	var d := to.length()
	var see: float = _v.see * (0.6 if p.crouching else 1.0) * (0.75 if Core.env and Core.env.daylight < 0.3 and variant != "mutant" else 1.0)
	if state in ["idle", "walk"] and d < see:
		Core.play_at("mutant_growl" if variant == "mutant" else "enemy_alert", global_position + Vector3.UP * 1.6, -3.0)
		state = "chase"
	if state in ["chase", "circle"]:
		if d > see * 1.7:
			state = "idle"
			_t = 2.0
			_release()
			return
		if _v.flee > 0.0 and hp < max_hp * _v.flee and not _fled:
			_fled = true
			_release()
			state = "flee"
			_t = 4.0
			return
		if not (self in attackers) and attackers.size() < 2:
			attackers.append(self)
		if self in attackers:
			state = "chase"
			_goal = p.global_position
			if d < _v.reach and _cool <= 0.0:
				_attack()
		else:
			# ждёт очереди: кружит в 3–3.5 м от героя
			state = "circle"
			_orbit += delta * 0.5
			var r := 3.3
			_goal = p.global_position + Vector3(cos(_orbit), 0, sin(_orbit)) * r
	elif state == "flee":
		_goal = global_position - to.normalized() * 6.0
		if _t <= 0.0:
			state = "chase"


func _release() -> void:
	attackers.erase(self)


## замах с меткой «!», затем удар; скорость клипа подобрана так, чтобы удар пришёлся на конец замаха
func _attack() -> void:
	state = "windup"
	velocity = Vector3.ZERO
	var to: Vector3 = Core.player.global_position - global_position
	rotation.y = atan2(to.x, to.z)
	var clip := "punch_light" if randf() < 0.55 else "punch_heavy"
	if variant == "mutant" and rig.has_clip("kick") and randf() < 0.3:
		clip = "kick"
	var windup: float = _v.windup
	var rate := clampf(rig.clip_len(clip) * 0.45 / windup, 0.55, 1.6)
	var dur := rig.play(clip, rate)
	_cool = _v.cool + randf() * 0.5
	_bang.visible = true
	if variant == "mutant":
		Core.play_at("mutant_attack", global_position + Vector3.UP * 1.5, -3.0)
	get_tree().create_timer(windup).timeout.connect(func():
		_bang.visible = false
		if state != "windup":
			return
		state = "attack"
		var pl: Node3D = Core.player
		var dd := pl.global_position - global_position
		dd.y = 0
		var landed: bool = dd.length() < _v.reach + 0.3 and global_transform.basis.z.dot(dd.normalized()) > 0.35
		if landed:
			Core.play_at("pipe_hit" if _v.weapon == "pipe" else "punch", global_position + Vector3.UP * 1.3, -3.0)
			pl.damage(_v.dmg, -dd, self)
		else:
			Core.play_at("swoosh", global_position + Vector3.UP * 1.3, -9.0))
	get_tree().create_timer(windup + maxf(dur - windup, 0.2) * 0.6).timeout.connect(func():
		if state == "attack":
			state = "chase")


## сбит с ног / потерял равновесие: тяжёлый удар или идеальный блок героя
func stagger() -> void:
	if state == "dead":
		return
	_bang.visible = false
	state = "stagger"
	velocity = Vector3.ZERO
	var d := rig.play("stagger")
	_cool = maxf(_cool, 0.8)
	get_tree().create_timer(maxf(d * 0.8, 0.9)).timeout.connect(func():
		if state == "stagger":
			state = "chase")


func damage(amount: float, from_dir := Vector3.ZERO, heavy := false) -> void:
	if state == "dead":
		return
	hp -= amount
	_bar_t = 5.0
	_update_bar()
	if hp <= 0.0:
		_die()
		return
	if state in ["idle", "walk"]:
		state = "chase"
	Core.play_at("hurt_enemy", global_position + Vector3.UP * 1.5, -5.0)
	# тяжёлый удар сбивает; лёгкий прерывает замах (кроме главаря — его не собьёшь лёгким)
	if heavy and not _v.get("poise", false):
		stagger()
		return
	if _v.get("poise", false) and state in ["windup", "attack"]:
		return
	_bang.visible = false
	state = "hit"
	var local := global_transform.basis.inverse() * from_dir
	var clip := "hit_front" if local.z >= 0 else "hit_back"
	if absf(local.x) > absf(local.z):
		clip = "hit_left" if local.x < 0 else "hit_right"
	var d := rig.play(clip)
	get_tree().create_timer(maxf(d * 0.6, 0.3)).timeout.connect(func():
		if state == "hit":
			state = "chase")


func _update_bar() -> void:
	if _bar == null:
		return
	var n := clampi(ceili(hp / max_hp * 10.0), 0, 10)
	_bar.text = "■".repeat(n) + "□".repeat(10 - n)
	_bar.modulate = Color(0.95, 0.25, 0.2) if variant != "mutant" else Color(0.6, 0.95, 0.3)


func _die() -> void:
	state = "dead"
	_release()
	velocity = Vector3.ZERO
	collision_layer = 0
	if _bang:
		_bang.visible = false
	if _bar:
		_bar.visible = false
	var d := rig.play("death")
	rig.set_pose("dead", maxf(d - 0.45, 0.0))
	Core.play_at("mutant_death" if variant == "mutant" else "death_enemy", global_position + Vector3.UP * 1.4, -2.0)
	Core.play_at("body_fall", global_position, -4.0)
	Core.say(display_name + " повержен.", "good")
	if Core.quest and kind != "":
		Core.quest.on_kill(kind)
	_drop_loot()
	if respawn:
		get_tree().create_timer(60.0).timeout.connect(func():
			global_position = _home
			hp = max_hp
			_fled = false
			state = "idle"
			collision_layer = BCKit.LAYER_NPC
			rig.set_pose(""))
	else:
		# тело лежит 3 минуты, потом убирается
		get_tree().create_timer(180.0).timeout.connect(queue_free)


static var _loot_n := 0

## добыча: вещь на земле рядом с телом (подбирается как обычный предмет)
func _drop_loot() -> void:
	for l in _v.get("loot", []):
		if randf() > float(l[1]):
			continue
		_loot_n += 1
		var holder := Node3D.new()
		holder.set_meta("pickup_mesh", true)
		get_parent().add_child(holder)
		holder.global_position = global_position + Vector3(randf_range(-0.6, 0.6), 0.0, randf_range(-0.6, 0.6))
		var pr := BCProp.new()
		pr.prefab = {"canned": "can_food", "medkit": "medkit_box", "fuel_can": "jerrycan"}.get(l[0], "cardboard")
		pr.params = {"collide": false}
		holder.add_child(pr)
		var it := BCInteract.new()
		it.point_id = "loot_%d" % _loot_n
		it.action = "pickup"
		it.label = "Подобрать: " + {"canned": "тушёнка", "medkit": "аптечка", "fuel_can": "канистра с топливом"}.get(l[0], l[0])
		it.target = l[0]
		it.sensor_size = Vector3(1.3, 2.0, 1.3)
		holder.add_child(it)
		if is_in_group("surface_only"):
			holder.add_to_group("surface_only")


func _exit_tree() -> void:
	_release()


# ---------------- разговор (житель) ----------------

func interact_label() -> String:
	return "Поговорить: " + display_name


func can_interact(_p) -> bool:
	return role == "resident" and state != "dead"


## разговор начинается сразу — без клипа (длинный «осмотр» задерживал героя на несколько секунд)
func interact_anim(_p) -> String:
	# разговор открывается сразу: герой не занят клипом (жест «разговор» — эмоция, её прерывает движение)
	return ""


func interact(_p) -> void:
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
	# сначала задания (сдать шаг, взять новое), иначе — обычная реплика
	if Core.quest and npc_id != "" and Core.quest.talk(npc_id):
		return
	if lines.is_empty():
		return
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
