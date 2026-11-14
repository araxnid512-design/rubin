class_name BCPlayer
extends CharacterBody3D
## Герой BunkerCore: передвижение относительно камеры (шаг/бег/рывок/присед), выносливость, здоровье, доза
## радиации, защитный костюм, взаимодействие с предметами (подойти, повернуться, клип, действие), удары,
## инвентарь. Внешний вид — BCCharacter (модель, клипы, IK стоп).

signal stats_changed
signal interact_target_changed(target)

const WALK := 1.35
const JOG := 3.1
const SPRINT := 4.5
const CROUCH := 1.15
const ACCEL := 9.0
const TURN := 9.0

@export var hero_model := "res://assets/models/hero.glb"
@export var suit_model := "res://assets/models/hero_suit.glb"

var rig: BCCharacter
var move_input := Vector2.ZERO        ## от джойстика (−1..1), y — «вперёд» от экрана
var sprint_held := false
var crouching := false
var hp := 100.0
var max_hp := 100.0
var stamina := 100.0
var food := 70.0                      ## сытость 0..100: за игровые сутки уходит ~65
var water := 60.0                     ## вода 0..100: за игровые сутки уходит ~100
var dose := 0.0                       ## накопленная доза, мЗв
var rad_rate := 0.0                   ## текущая мощность дозы, мЗв/ч
var suit_on := false
var inventory: Array = ["dosimeter", "flashlight"]
var state := "move"                   ## move / busy / sit / lie / dead
var target = null                     ## ближайший объект для взаимодействия
var cam_yaw := 0.0                    ## задаёт камера: поворот «вперёд» джойстика
var _reach: Area3D
var _step_t := 0.0
var _snd_step: AudioStreamPlayer3D
var _punch_combo := 0
var _was_moving := false
var _idle_t := 0.0
var game_time := 8.0 * 3600.0         ## время суток в игре, секунды
var _return_pos := Vector3.INF
var _full_t := 0.0                   ## сколько бежит в полный наклон джойстика
var _tired := false                  ## выдохся — рывка нет, пока выносливость не восстановится
var _warn := {}
var _torch: SpotLight3D
const FOOD_H := 2.7                   ## расход сытости за игровой час
const WATER_H := 4.2                  ## расход воды за игровой час
## что можно использовать из «Вещей»: действие и слова
const CONSUME := {
	"canned": [{"stat": "food", "add": 40}, "Вы съели тушёнку.", "eat"],
	"medkit": [{"stat": "hp", "add": 45}, "Перевязка и обезболивающее: здоровье восстановлено.", "pickup"],
	"rad_pills": [{"stat": "dose", "add": -80}, "Радиопротектор принят: доза снижена.", "drink"],
}


func _ready() -> void:
	collision_layer = BCKit.LAYER_PLAYER
	collision_mask = BCKit.LAYER_WORLD
	floor_snap_length = 0.45
	floor_max_angle = deg_to_rad(48.0)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.28
	cap.height = 1.78
	cs.shape = cap
	cs.position.y = 0.89
	add_child(cs)
	rig = BCCharacter.new()
	rig.name = "Rig"
	add_child(rig)
	rig.setup(hero_model if not suit_on else suit_model, "res://assets/anim/" + ("suit" if suit_on else "hero"))
	rig.action_finished.connect(_on_action_done)
	_reach = Area3D.new()
	_reach.name = "Reach"
	_reach.collision_layer = 0
	_reach.collision_mask = BCKit.LAYER_INTERACT
	_reach.monitorable = false
	var rs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 1.25
	rs.shape = sp
	rs.position = Vector3(0, 1.0, 0)
	_reach.add_child(rs)
	add_child(_reach)
	_snd_step = AudioStreamPlayer3D.new()
	_snd_step.max_distance = 15.0
	_snd_step.volume_db = -8.0
	add_child(_snd_step)
	# фонарь на груди: ночью наверху и в бункере без питания
	_torch = SpotLight3D.new()
	_torch.name = "Torch"
	# над плечом и чуть сзади: луч захватывает и самого героя (камера сверху видит его в темноте)
	_torch.position = Vector3(0.15, 2.15, -0.45)
	_torch.rotation_degrees = Vector3(-32, 180, 0)
	_torch.spot_range = 17.0
	_torch.spot_angle = 40.0
	_torch.light_energy = 2.2
	_torch.light_color = Color(1.0, 0.93, 0.8)
	_torch.shadow_enabled = false
	_torch.visible = false
	add_child(_torch)
	Core.register_player(self)


# ---------------- передвижение ----------------

func _physics_process(delta: float) -> void:
	game_time += delta * 30.0     # минута игры = 2 секунды
	var dir := Vector3.ZERO
	var inp := move_input
	if inp == Vector2.ZERO:
		inp = Input.get_vector("ui_left", "ui_right", "ui_up", "ui_down") * -1.0 * Vector2(-1, 1)
		inp = Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_down", "ui_up"))
	var mag := minf(inp.length(), 1.0)
	if state == "move" and mag > 0.08:
		var fwd := Vector3(sin(cam_yaw), 0, cos(cam_yaw)) * -1.0
		var right := Vector3(cos(cam_yaw), 0, -sin(cam_yaw))
		dir = (right * inp.x + fwd * inp.y).normalized()
	var want := 0.0
	# по умолчанию герой бежит: полный наклон джойстика — бег, лёгкий — шаг; через 2 с бега в полный наклон —
	# сам переходит на рывок, пока есть выносливость (кнопки «Бег» нет; на ПК — Shift)
	if dir != Vector3.ZERO and mag > 0.85 and not crouching:
		_full_t += delta
	else:
		_full_t = 0.0
	if stamina < 2.0 and not _tired:
		Core.play_at("breath_run", global_position + Vector3.UP * 1.6, -6.0, 0.0)
	if stamina < 2.0:
		_tired = true
	elif stamina > 30.0:
		_tired = false
	var sprint := (sprint_held or _full_t > 2.0) and not _tired
	if dir != Vector3.ZERO:
		if crouching:
			want = CROUCH * mag
		elif sprint and mag > 0.7:
			want = SPRINT
		elif mag < 0.45:
			want = lerpf(0.5, WALK, mag / 0.45)
		else:
			want = lerpf(WALK, JOG, clampf((mag - 0.45) / 0.3, 0.0, 1.0))
	if state == "sit" or state == "lie" or (state == "busy" and collision_mask == 0):
		velocity = Vector3.ZERO
		if rig:
			rig.set_motion(0.0, 0.0, delta)
		_radiation(delta)
		if state == "lie":
			stamina = minf(100.0, stamina + 12.0 * delta)
			hp = minf(max_hp, hp + 0.15 * delta)
		return
	var hv := Vector3(velocity.x, 0, velocity.z)
	var target_v := dir * want
	hv = hv.move_toward(target_v, ACCEL * delta * (1.6 if target_v.length() < hv.length() else 1.0))
	velocity.x = hv.x
	velocity.z = hv.z
	if not is_on_floor():
		velocity.y -= 9.8 * delta
	else:
		velocity.y = -0.5
	move_and_slide()
	var speed := Vector3(velocity.x, 0, velocity.z).length()
	# поворот к направлению движения (без хождения боком)
	if dir != Vector3.ZERO and state == "move":
		var tgt := atan2(dir.x, dir.z)
		rotation.y = lerp_angle(rotation.y, tgt, clampf(TURN * delta, 0.0, 1.0))
	# выносливость
	if speed > JOG + 0.3:
		stamina = maxf(0.0, stamina - 14.0 * delta)
	else:
		stamina = minf(100.0, stamina + (9.0 if speed < 0.2 else 5.0) * delta * (0.5 if food <= 0.0 or water <= 0.0 else 1.0))
	if rig:
		rig.set_motion(speed, 1.0 if crouching else 0.0, delta)
	# старт/остановка — короткие клипы поверх, только из покоя в бег и из бега в покой
	if speed > 2.5 and not _was_moving and rig and not rig.busy() and rig.has_clip("start"):
		rig.play("start")
	if speed < 0.3 and _was_moving and rig and not rig.busy() and rig.has_clip("stop") and hv.length() < 0.5:
		rig.play("stop")
	_was_moving = speed > 1.5
	_footsteps(speed, delta)
	_radiation(delta)
	_pick_target()
	if speed < 0.1 and state == "move":
		_idle_t += delta
	else:
		_idle_t = 0.0


func _footsteps(speed: float, delta: float) -> void:
	if speed < 0.4 or not is_on_floor():
		_step_t = 0.0
		return
	var stride := 0.75 if speed < 2.0 else (1.05 if speed < 4.5 else 1.3)
	_step_t += speed * delta
	if _step_t >= stride:
		_step_t = 0.0
		var surf := "step_concrete" if Core.world.underground else "step_dirt"
		if suit_on:
			surf = "step_suit"
		var st := Core.sfx(surf)
		if st:
			_snd_step.stream = st
			_snd_step.pitch_scale = randf_range(0.9, 1.1)
			_snd_step.volume_db = -14.0 if crouching else (-8.0 if speed < 4.0 else -4.0)
			_snd_step.play()


# ---------------- радиация и здоровье ----------------

func _radiation(delta: float) -> void:
	rad_rate = Core.env.rad_rate_at(global_position) if Core.env else 0.0
	_needs(delta)
	var eff := rad_rate * (0.15 if suit_on else 1.0)
	# игровое время идёт быстрее: 1 с реального = 30 с игры
	dose += eff * delta * 30.0 / 3600.0
	# выше 250 мЗв — лучевая болезнь: здоровье понемногу уходит
	if dose > 250.0:
		hp -= (dose - 250.0) / 250.0 * 0.6 * delta
	elif not Core.world.underground:
		pass
	# в бункере доза понемногу «уходит» (выведение из организма в игровом упрощении)
	if Core.world.underground and dose > 0.0:
		dose = maxf(0.0, dose - 0.4 * delta)
	if hp <= 0.0 and state != "dead":
		die()
	stats_changed.emit()


## голод и жажда; фонарь по времени суток и питанию
func _needs(delta: float) -> void:
	var gh := delta * 30.0 / 3600.0
	var k := 0.5 if state == "lie" else 1.0
	food = maxf(0.0, food - FOOD_H * gh * k)
	water = maxf(0.0, water - WATER_H * gh * k)
	if food <= 0.0 or water <= 0.0:
		hp -= 0.12 * delta
	for n in [["food", food, "Хочется есть. Паёк — на складе.", "Голод! Здоровье уходит."], ["water", water, "Хочется пить. Бак с водой — в теплице.", "Жажда! Здоровье уходит."]]:
		var v: float = n[1]
		if v < 25.0 and not _warn.has(n[0] + "1"):
			_warn[n[0] + "1"] = true
			Core.say(n[2], "warn")
		elif v <= 0.0 and not _warn.has(n[0] + "0"):
			_warn[n[0] + "0"] = true
			Core.say(n[3], "bad")
		elif v > 40.0:
			_warn.erase(n[0] + "1")
			_warn.erase(n[0] + "0")
	if _torch:
		var dark: bool = (not Core.world.underground and is_night()) or (Core.world.underground and Core.quest and not Core.quest.power)
		_torch.visible = dark and "flashlight" in inventory


func hour() -> float:
	return fmod(game_time / 3600.0, 24.0)


func day() -> int:
	return int(game_time / 86400.0) + 1


func is_night() -> bool:
	var h := hour()
	return h >= 21.0 or h < 5.0


## поспать до 6 утра: время, сытость, вода, ресурсы убежища идут как обычно (их считает QuestSystem по времени)
func sleep_until_morning() -> void:
	var h := hour()
	var hours := (24.0 - h + 6.0) if h >= 6.0 else (6.0 - h)
	game_time += hours * 3600.0
	food = maxf(0.0, food - FOOD_H * hours * 0.5)
	water = maxf(0.0, water - WATER_H * hours * 0.5)
	hp = minf(max_hp, hp + 40.0)
	stamina = 100.0
	if dose < 250.0:
		dose = maxf(0.0, dose - hours * 2.0)
	Core.say("День %d. 06:00. Вы выспались." % day(), "good")
	stats_changed.emit()


func damage(amount: float, from_dir := Vector3.ZERO) -> void:
	if state == "dead":
		return
	hp -= amount
	Core.play_at("hurt_hero", global_position + Vector3.UP * 1.6, -4.0)
	if hp <= 0.0:
		die()
		return
	if rig:
		var local := global_transform.basis.inverse() * from_dir
		var clip := "hit_front"
		if absf(local.x) > absf(local.z):
			clip = "hit_left" if local.x < 0 else "hit_right"
		elif local.z < 0:
			clip = "hit_back"
		rig.play(clip)


func die() -> void:
	state = "dead"
	hp = 0.0
	velocity = Vector3.ZERO
	if rig:
		rig.play("death")
		rig.set_pose("dead")
	Core.say("Вы погибли. Загрузка последнего сохранения…", "bad")
	get_tree().create_timer(4.0).timeout.connect(func(): Core.save.load_game())


# ---------------- взаимодействие ----------------

func _pick_target() -> void:
	var best = null
	var bd := 1e9
	if state == "move":
		for a in _reach.get_overlapping_areas():
			var t = a.get_meta("bc_target", null)
			if t == null or not is_instance_valid(t) or not t.can_interact(self):
				continue
			var to: Vector3 = a.global_position - global_position
			to.y = 0
			# предпочитаем то, что впереди
			var fwd := global_transform.basis.z
			var score := to.length() - fwd.dot(to.normalized()) * 0.6
			if score < bd:
				bd = score
				best = t
	if best != target:
		target = best
		interact_target_changed.emit(target)


func do_interact() -> void:
	if state == "sit" or state == "lie":
		stand_up()
		return
	if state != "move" or target == null:
		return
	var t = target
	if t is BCInteract and t.snap:
		# сесть/лечь точно на предмет: встать в его точку, физику — на время позы выключить
		var sp: Transform3D = t.stand_point()
		_return_pos = global_position
		# столкновения с предметами выключить (слой героя остаётся — по нему зоны знают, где он)
		collision_mask = 0
		global_position = sp.origin
		rotation.y = sp.basis.get_euler().y
	else:
		# развернуться к объекту
		var p: Vector3 = (t.global_position if t is Node3D else global_position)
		var to := p - global_position
		to.y = 0
		if to.length() > 0.05:
			rotation.y = atan2(to.x, to.z)
	var clip: String = t.interact_anim(self) if t.has_method("interact_anim") else "inspect"
	var dur := rig.play(clip) if rig else 0.0
	state = "busy"
	velocity = Vector3.ZERO
	# действие срабатывает в середине клипа (рука на ручке двери / кнопке)
	var at := clampf(dur * 0.45, 0.0, 0.9)
	get_tree().create_timer(at).timeout.connect(func():
		if is_instance_valid(t):
			t.interact(self)
		if state == "busy":
			get_tree().create_timer(maxf(dur - at - 0.15, 0.05)).timeout.connect(func():
				if state == "busy":
					state = "move"))


func _on_action_done(_n: String) -> void:
	pass


func sit() -> void:
	state = "sit"
	rig.set_pose("sit_idle" if rig.has_clip("sit_idle") else "sit_down")
	Core.say("Вы сели. Нажмите «Действие», чтобы встать.", "info")


func rest() -> void:
	state = "lie"
	rig.set_pose("lie_idle" if rig.has_clip("lie_idle") else "bed_lie")
	if hour() >= 20.0 or hour() < 5.0:
		Core.hud.ask_sleep()
	else:
		Core.say("Отдых… Выносливость и здоровье восстанавливаются. Спать можно с 20:00.", "info")


func stand_up() -> void:
	var clip := "stand_up" if state == "sit" else "bed_up"
	state = "busy"
	rig.set_pose("")
	var d := rig.play(clip)
	get_tree().create_timer(maxf(d - 0.1, 0.1)).timeout.connect(func():
		# вернуться на пол рядом с предметом и включить физику
		if _return_pos != Vector3.INF:
			global_position = _return_pos
			_return_pos = Vector3.INF
		collision_layer = BCKit.LAYER_PLAYER
		collision_mask = BCKit.LAYER_WORLD
		state = "move")


func treat() -> void:
	var healed := minf(max_hp - hp, 40.0)
	hp += healed
	var cleared := minf(dose, 120.0)
	dose -= cleared
	Core.say("Медпункт: +%d здоровья, выведено %d мЗв." % [int(healed), int(cleared)], "good")


func toggle_suit() -> void:
	suit_on = not suit_on
	# модель меняется в момент, когда клип закрыт костюмом (середина)
	if rig and ResourceLoader.exists(suit_model if suit_on else hero_model):
		var keep_pose := rig._pose
		rig.setup(suit_model if suit_on else hero_model, "res://assets/anim/" + ("suit" if suit_on else "hero"))
		if keep_pose != "":
			rig.set_pose(keep_pose)
	Core.say("Защитный костюм надет: облучение снижено в 6–7 раз." if suit_on else "Костюм снят.", "info")
	Core.world.notify_state("player")
	get_tree().call_group("suit_hanger", "set_visible", not suit_on)


func inventory_add(id: String) -> void:
	inventory.append(id)
	stats_changed.emit()
	if Core.quest:
		Core.quest.on_inventory()


func count_item(id: String) -> int:
	return inventory.count(id)


func inventory_remove(id: String, n := 1) -> void:
	for i in n:
		inventory.erase(id)
	stats_changed.emit()
	if Core.quest:
		Core.quest.on_inventory()


func can_consume(id: String) -> bool:
	return CONSUME.has(id)


## использовать вещь из инвентаря (еда, аптечка, таблетки)
func consume(id: String) -> void:
	if not CONSUME.has(id) or count_item(id) < 1:
		return
	var c: Array = CONSUME[id]
	inventory_remove(id, 1)
	Core.quest.apply_effect(c[0])
	Core.say(c[1], "good")
	Core.play_ui(c[2], -4.0)


# ---------------- бой ----------------

func attack() -> void:
	if state != "move" or rig == null:
		return
	_punch_combo = (_punch_combo + 1) % 3
	var clip := "punch_heavy" if _punch_combo == 0 else "punch_light"
	var d := rig.play(clip)
	if d <= 0.0:
		return
	state = "busy"
	velocity = Vector3.ZERO
	get_tree().create_timer(d * 0.4).timeout.connect(_punch_hit.bind(clip))
	get_tree().create_timer(maxf(d - 0.1, 0.1)).timeout.connect(func(): if state == "busy": state = "move")


func _punch_hit(clip: String) -> void:
	var fwd := global_transform.basis.z
	var hit := false
	for n in get_tree().get_nodes_in_group("enemy"):
		var to: Vector3 = n.global_position - global_position
		if to.length() < 1.4 and fwd.dot(to.normalized()) > 0.5 and n.has_method("damage"):
			n.damage(25.0 if clip == "punch_heavy" else 12.0, -to)
			hit = true
	Core.play_at("punch" if hit else "swoosh", global_position + fwd * 0.6 + Vector3.UP * 1.3, -2.0 if hit else -8.0)


func toggle_crouch() -> void:
	crouching = not crouching


# ---------------- сохранение ----------------

func get_state() -> Dictionary:
	return {"pos": [global_position.x, global_position.y, global_position.z], "rot": rotation.y, "hp": hp, "stamina": stamina,
		"dose": dose, "suit": suit_on, "inv": inventory, "crouch": crouching, "time": game_time, "food": food, "water": water}


func set_state(s: Dictionary) -> void:
	var p: Array = s.get("pos", [global_position.x, global_position.y, global_position.z])
	global_position = Vector3(p[0], p[1], p[2])
	rotation.y = s.get("rot", 0.0)
	hp = s.get("hp", 100.0)
	stamina = s.get("stamina", 100.0)
	dose = s.get("dose", 0.0)
	inventory = s.get("inv", inventory)
	crouching = s.get("crouch", false)
	game_time = s.get("time", game_time)
	food = s.get("food", 70.0)
	water = s.get("water", 60.0)
	if s.get("suit", false) != suit_on:
		toggle_suit()
	state = "move"
	velocity = Vector3.ZERO
	if rig:
		rig.set_pose("")
	stats_changed.emit()


## короткая подпись для кнопки «Действие» — что произойдёт при нажатии
func action_verb() -> String:
	if state == "sit" or state == "lie":
		return "Встать"
	var t = target
	if t == null:
		return ""
	if t is BCDoor:
		return "Закрыть" if t.is_open else "Открыть"
	if t is BCNpc:
		return "Говорить"
	if t is BCInteract and t.action == "use":
		return Core.quest.use_verb(t.target)
	if t is BCInteract:
		return {"terminal": "Терминал", "bed": "Лечь", "chair": "Сесть", "medbay": "Лечиться", "suit": "Снять" if suit_on else "Надеть",
			"switch": "Свет", "pickup": "Взять", "inspect": "Осмотр"}.get(t.action, "Действие")
	return "Действие"

