class_name Player
extends Actor
## Генерал «Долга» — управляемый игроком персонаж.

const WALK := 1.7
const RUN := 3.7
const SPRINT := 5.0

var stamina := 100.0
var radiation := 0.0
var touch_move := Vector2.ZERO      # от виртуального джойстика
var touch_fire := false
var touch_sprint := false
var touch_interact := false
var focus: Node = null              # ближайший интерактивный объект
var hold_progress := 0.0
var holding := false
var _hold_target: Node = null
var _focus_t := 0.0
var _use_item := ""
var _use_t := 0.0
var _switch_t := 0.0
var _target: Actor = null
var _retarget_t := 0.0
var _noise_t := 0.0
var _semi_ready := true
var _hurt_cd := 0.0
var flashlight: SpotLight3D
var aiming_mouse := false
var active_slot := 1
var god_mode := false
var auto_walk_target: Variant = null   # для автоматических тестов
var _prev_interact := false

func _ready() -> void:
	faction = Faction.DUTY
	display_name = "Генерал"
	collision_layer = 2
	add_to_group("allies")
	add_to_group("player")
	setup_body(0.35, 1.8)
	turn_speed = 12.0
	var r := HumanRig.new()
	r.name = "Rig"
	add_child(r)
	r.setup({"head": "bare", "hair": Color(0.32, 0.3, 0.28), "headset": true, "armband": true, "backpack": true,
		"suit": Color(0.16, 0.16, 0.17), "armor": Color(0.5, 0.08, 0.07), "collar": true})
	r.set_shadow(true)
	rig = r
	flashlight = SpotLight3D.new()
	flashlight.position = Vector3(0.15, 1.45, -0.2)
	flashlight.spot_range = 16.0
	flashlight.spot_angle = 32.0
	flashlight.light_energy = 2.2
	flashlight.light_color = Color(1.0, 0.95, 0.85)
	flashlight.rotation_degrees = Vector3(-22, 0, 0)
	flashlight.visible = false
	add_child(flashlight)
	Game.player = self
	read_state()
	Events.equipment_changed.connect(_sync_weapon)
	Events.inventory_changed.connect(func(): pass)

func read_state() -> void:
	var ps: Dictionary = Game.player_state
	hp = float(ps.get("hp", 100.0))
	stamina = float(ps.get("stamina", 100.0))
	radiation = float(ps.get("rad", 0.0))
	global_position = Game._to_v3(ps.get("pos", Vector3.ZERO))
	rotation.y = float(ps.get("yaw", 0.0))
	armor = float(ItemDB.get_item(String(ps.get("armor", "armor_duty"))).get("armor", 0.0))
	active_slot = int(Game.equip.get("active", 1))
	_sync_weapon()
	reset_physics_interpolation()
	if rig:
		rig.reset_feet()

func write_state() -> void:
	Game.player_state.hp = hp
	Game.player_state.stamina = stamina
	Game.player_state.rad = radiation
	Game.player_state.pos = global_position
	Game.player_state.yaw = rotation.y
	_store_mag()

func _slot_key(s: int) -> String:
	return "primary" if s == 0 else "pistol"

func _store_mag() -> void:
	var e = Game.equip.get(_slot_key(active_slot))
	if e != null and String(e.id) == weapon_id:
		e.ammo = mag

func _sync_weapon() -> void:
	var e = Game.equip.get(_slot_key(active_slot))
	if e == null:
		var other = Game.equip.get(_slot_key(1 - active_slot))
		if other != null:
			active_slot = 1 - active_slot
			e = other
	if e == null:
		weapon_id = ""
		mag = 0
		(rig as HumanRig).set_weapon("")
		return
	if String(e.id) != weapon_id:
		weapon_id = String(e.id)
		(rig as HumanRig).set_weapon(weapon_id)
		reloading = false
	mag = int(e.get("ammo", 0))
	Game.equip.active = active_slot

func switch_slot(s: int) -> void:
	if s == active_slot or Game.equip.get(_slot_key(s)) == null or _use_item != "":
		return
	_store_mag()
	active_slot = s
	reloading = false
	(rig as HumanRig).stop_action()
	_switch_t = 0.45
	_sync_weapon()
	Sfx.play("reload", -8.0, 1.4)
	Events.equipment_changed.emit()

func available_reserve() -> int:
	if weapon_id == "":
		return 0
	return Game.inv.count(String(wdef().ammo))

func take_reserve(n: int) -> int:
	var t := Game.inv.remove(String(wdef().ammo), n)
	Events.inventory_changed.emit()
	return t

func _finish_reload() -> void:
	super()
	_store_mag()

# ------------------------------------------------------------------ здоровье
func take_damage(amount: float, source: Node, hit_pos: Vector3 = Vector3.ZERO, dir: Vector3 = Vector3.ZERO) -> void:
	if god_mode or not alive:
		return
	super(amount, source, hit_pos, dir)
	Events.player_hit.emit(amount)
	if _use_item != "" and amount > 5.0:
		_cancel_use()

func die() -> void:
	super()
	Events.msg("Генерал погиб.", Events.Msg.ALERT)
	Events.ui_open.emit("death", null)

func add_radiation(v: float) -> void:
	radiation = clampf(radiation + v, 0.0, 100.0)

# ------------------------------------------------------------------ ввод
func _keyboard_move() -> Vector2:
	return Input.get_vector("move_left", "move_right", "move_up", "move_down")

func _mouse_ground() -> Variant:
	var cam := get_viewport().get_camera_3d()
	if cam == null:
		return null
	var mp := get_viewport().get_mouse_position()
	var o := cam.project_ray_origin(mp)
	var d := cam.project_ray_normal(mp)
	if absf(d.y) < 0.001:
		return null
	var t := (1.1 - o.y) / d.y
	if t < 0:
		return null
	return o + d * t

func _physics_process(delta: float) -> void:
	if not alive:
		velocity = Vector3.ZERO
		return
	update_weapon(delta)
	_switch_t -= delta
	_hurt_cd -= delta
	# --- движение ---
	var mv := touch_move
	var kb := _keyboard_move()
	if kb.length() > 0.05:
		mv = kb
	if auto_walk_target != null:
		var d: Vector3 = (auto_walk_target as Vector3) - global_position
		d.y = 0
		mv = Vector2(d.x, d.z).normalized() if d.length() > 0.5 else Vector2.ZERO
	var mag_in := clampf(mv.length(), 0.0, 1.0)
	var sprint := (Input.is_action_pressed("sprint") or touch_sprint) and stamina > 3.0 and mag_in > 0.5
	var speed := 0.0
	if mag_in > 0.05:
		if kb.length() > 0.05 or auto_walk_target != null:
			speed = RUN
		else:
			speed = lerpf(WALK * 0.6, RUN, smoothstep(0.15, 0.85, mag_in))
		if sprint:
			speed = SPRINT
	var busy := holding or _use_item != ""
	if _use_item != "":
		speed = minf(speed, WALK)
		sprint = false
	if holding:
		speed = 0.0
	var want := Vector3(mv.x, 0, mv.y).normalized() * speed if mag_in > 0.05 else Vector3.ZERO
	# --- прицеливание и стрельба ---
	var desktop := not Settings.use_touch()
	var fire_held := touch_fire or (desktop and Input.is_action_pressed("fire") and not _ui_blocks_mouse())
	var aim_held := desktop and Input.is_action_pressed("aim") and not _ui_blocks_mouse()
	aim_target = null
	var mouse_pt: Variant = null
	if (aim_held or (Input.is_action_pressed("fire") and not touch_fire)) and desktop:
		mouse_pt = _mouse_ground()
	_retarget_t -= delta
	if fire_held or aim_held:
		if mouse_pt != null:
			var assist := _enemy_near_point(mouse_pt as Vector3, 1.8)
			aim_target = assist.center_pos() if assist else mouse_pt
		else:
			if _retarget_t <= 0.0 or _target == null or not _target.alive:
				_retarget_t = 0.3
				_target = _find_target()
			if _target:
				aim_target = _target.center_pos()
			else:
				var fwd := -global_transform.basis.z
				aim_target = center_pos() + fwd * 10.0
	if weapon_id != "" and not busy and _switch_t <= 0.0:
		var w := wdef()
		if fire_held and aim_target != null:
			var facing := -global_transform.basis.z
			var to_t := ((aim_target as Vector3) - global_position)
			to_t.y = 0
			var aligned := facing.dot(to_t.normalized()) > 0.85 or to_t.length() < 1.5
			if mag <= 0 and not reloading:
				if available_reserve() > 0:
					start_reload()
				elif _semi_ready:
					Sfx.play("click")
					Events.msg("Нет патронов!", Events.Msg.ALERT)
					_semi_ready = false
			elif aligned:
				# удержание огня: автоматическое оружие — очередью, самозарядное — с его темпом стрельбы
				if fire_at(aim_target as Vector3, 1.0 + (0.6 if speed > WALK + 0.1 else 0.0)):
					_semi_ready = false
					_store_mag()
		if not fire_held:
			_semi_ready = true
		if Input.is_action_just_pressed("reload"):
			start_reload()
	# --- стамина ---
	if sprint and want.length() > 0.1:
		stamina = maxf(0.0, stamina - 16.0 * delta)
	else:
		stamina = minf(100.0, stamina + 11.0 * delta)
	# --- радиация ---
	if radiation > 0.0:
		radiation = maxf(0.0, radiation - 0.15 * delta)
		if radiation > 50.0:
			hp -= (0.4 if radiation < 80.0 else 1.6) * delta
			if hp <= 0.0:
				hp = 0.0
				die()
				return
	# --- физика ---
	var v := Vector3(velocity.x, 0, velocity.z).move_toward(want, 22.0 * delta)
	velocity = Vector3(v.x, 0.0 if is_on_floor() else velocity.y - 20.0 * delta, v.z)
	move_and_slide()
	update_facing(delta)
	# --- шум шагов ---
	_noise_t -= delta
	var hs := Vector3(velocity.x, 0, velocity.z).length()
	if _noise_t <= 0.0 and hs > 0.5:
		_noise_t = 0.5
		Events.noise.emit(global_position, 3.0 if hs < 2.0 else (9.0 if hs < 4.5 else 15.0), self)
	# --- взаимодействие ---
	_update_interaction(delta)
	# --- использование предметов ---
	if _use_item != "":
		_use_t -= delta
		if _use_t <= 0.0:
			_apply_item(_use_item)
			_use_item = ""
	for i in 4:
		if Input.is_action_just_pressed("quick_%d" % (i + 1)):
			use_quick(i)
	if Input.is_action_just_pressed("slot_1"):
		switch_slot(0)
	if Input.is_action_just_pressed("slot_2"):
		switch_slot(1)
	if Input.is_action_just_pressed("inspect") and weapon_id != "" and not reloading:
		(rig as HumanRig).play("inspect", 2.2)
	flashlight.visible = Game.time_of_day < 6.0 or Game.time_of_day > 20.3
	RenderingServer.global_shader_parameter_set("player_pos", global_position)

func _ui_blocks_mouse() -> bool:
	return Game.hud != null and Game.hud.has_method("mouse_over_ui") and Game.hud.mouse_over_ui()

func _process(delta: float) -> void:
	if rig == null:
		return
	var hr := rig as HumanRig
	hr.aiming = aim_target != null and weapon_id != "" and _use_item == "" and not holding
	hr.hold_state = "low" if Vector3(velocity.x, 0, velocity.z).length() < 4.0 else "carry"
	if Game.flags.get("relaxed", false):
		hr.hold_state = "idle"
	update_rig(delta)

func _find_target() -> Actor:
	var best: Actor = null
	var best_d := INF
	var rng: float = wdef().get("range", 30.0) if weapon_id != "" else 30.0
	var fwd := -global_transform.basis.z
	for a in get_tree().get_nodes_in_group("enemies"):
		var e := a as Actor
		if e == null or not e.alive:
			continue
		var d := global_position.distance_to(e.global_position)
		if d > rng:
			continue
		var to := (e.global_position - global_position).normalized()
		var score := d * (1.0 if fwd.dot(to) > 0.3 else 1.6)
		if e == _target:
			score *= 0.7
		if score < best_d and can_see(e):
			best_d = score
			best = e
	return best

func _enemy_near_point(p: Vector3, r: float) -> Actor:
	for a in get_tree().get_nodes_in_group("enemies"):
		var e := a as Actor
		if e and e.alive and Vector2(e.global_position.x - p.x, e.global_position.z - p.z).length() < r:
			return e
	return null

# ------------------------------------------------------------------ взаимодействие
func _update_interaction(delta: float) -> void:
	_focus_t -= delta
	if _focus_t <= 0.0 and not holding:
		_focus_t = 0.12
		focus = _find_focus()
	var pressed := Input.is_action_pressed("interact") or touch_interact
	var just := pressed and not _prev_interact
	_prev_interact = pressed
	if holding:
		if not pressed or _hold_target == null or not is_instance_valid(_hold_target) or not _hold_target.can_interact(self):
			_end_hold(false)
			return
		var ht: float = _hold_target.interact_hold()
		if ht < 0.0:
			_hold_target.work(self, delta)
			hold_progress = fmod(hold_progress + delta, 1.0)
			_keep_anim(_hold_target.interact_anim())
		else:
			hold_progress += delta / ht
			_keep_anim(_hold_target.interact_anim())
			if hold_progress >= 1.0:
				var t := _hold_target
				_end_hold(true)
				t.interact(self)
				return
		if _hold_target:
			Events.hold_progress.emit(hold_progress if ht >= 0.0 else -1.0, String(_hold_target.interact_prompt()))
		return
	if just and focus != null and is_instance_valid(focus) and _use_item == "":
		_start_interaction(focus)

func _start_interaction(f: Node) -> void:
	var ht: float = f.interact_hold()
	_face_point(f.interact_pos())
	if ht == 0.0:
		var a: String = f.interact_anim()
		(rig as HumanRig).play("pickup" if a == "pickup" else "use", 0.6)
		f.interact(self)
	else:
		holding = true
		_hold_target = f
		hold_progress = 0.0
		(rig as HumanRig).play(f.interact_anim(), 999.0)

func _keep_anim(a: String) -> void:
	var hr := rig as HumanRig
	if hr.action != a:
		hr.play(a, 999.0)

func _end_hold(_done: bool) -> void:
	holding = false
	_hold_target = null
	hold_progress = 0.0
	(rig as HumanRig).stop_action()
	Events.hold_progress.emit(-2.0, "")

func _face_point(p: Vector3) -> void:
	var d := p - global_position
	d.y = 0
	if d.length() > 0.2:
		rotation.y = atan2(-d.x, -d.z)

func _find_focus() -> Node:
	var best: Node = null
	var best_d := INF
	var pos := global_position
	for n in get_tree().get_nodes_in_group("interactable"):
		if n == self or not n.can_interact(self):
			continue
		var p: Vector3 = n.interact_pos()
		var r: float = n.get("radius") if n.get("radius") != null else 2.2
		var d := Vector2(p.x - pos.x, p.z - pos.z).length()
		if d < r and absf(p.y - pos.y) < 2.5 and d < best_d:
			best_d = d
			best = n
	return best

# ------------------------------------------------------------------ предметы
func use_quick(i: int) -> void:
	if i < 0 or i >= Game.quick.size():
		return
	var id: String = Game.quick[i]
	if id == "":
		return
	use_item(id)

func use_item(id: String) -> void:
	if _use_item != "" or Game.inv.count(id) <= 0:
		return
	var it := ItemDB.get_item(id)
	if not (it.cat in [ItemDB.Cat.MED, ItemDB.Cat.FOOD]):
		return
	if it.has("heal") and hp >= max_hp and not it.has("stamina") and not it.has("rad"):
		Events.msg("Здоровье в норме.", Events.Msg.INFO)
		return
	_use_item = id
	_use_t = float(it.get("use_time", 2.0))
	reloading = false
	(rig as HumanRig).play("bandage", _use_t)

func _cancel_use() -> void:
	_use_item = ""
	(rig as HumanRig).stop_action()

func _apply_item(id: String) -> void:
	if Game.inv.remove(id, 1) <= 0:
		return
	var it := ItemDB.get_item(id)
	if it.has("heal"):
		heal(float(it.heal))
	if it.has("rad"):
		radiation = maxf(0.0, radiation + float(it.rad))
	if it.has("stamina"):
		stamina = minf(100.0, stamina + float(it.stamina))
	Events.msg("Использовано: %s" % it.name, Events.Msg.INFO)
	Events.inventory_changed.emit()

func is_using_item() -> bool:
	return _use_item != ""
