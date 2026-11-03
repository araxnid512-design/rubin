class_name Actor
extends CharacterBody3D
## Базовый персонаж: здоровье, броня, фракция, оружие, восприятие, перемещение по навмешу.

enum Faction { DUTY, MUTANT, ZOMBIE, BANDIT }

signal died(actor: Actor)
signal damaged(amount: float, source: Node)

var faction := Faction.DUTY
var display_name := ""
var max_hp := 100.0
var hp := 100.0
var armor := 0.0
var alive := true
var rig: Node3D               # HumanRig или DogRig
var is_dog := false
var turn_speed := 8.0
var face_dir := Vector3.FORWARD
var aim_target: Variant = null    # Vector3 мировая точка прицела
var weapon_id := ""
var mag := 0
var reserve := 0
var reloading := false
var _reload_t := 0.0
var _fire_cd := 0.0
var _cycle_t := 0.0
var accuracy := 1.0           # множитель разброса (меньше — точнее)
var nav: NavigationAgent3D
var _nav_target := Vector3(INF, 0, 0)
var _desired_vel := Vector3.ZERO
var _hit_flash := 0.0
var _vis_skip := 0
var _was_visible := true
var sight_range := 38.0
var hearing := 1.0
var lod_far := false

func _init() -> void:
	collision_mask = 1 | 2 | 4 | 8 | 128
	floor_snap_length = 0.3
	safe_margin = 0.02

func setup_body(radius: float = 0.35, height: float = 1.8) -> void:
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = radius
	cap.height = height
	cs.shape = cap
	cs.position = Vector3(0, height * 0.5, 0)
	add_child(cs)
	add_to_group("actors")

func setup_nav(avoid: bool = true, radius: float = 0.4) -> void:
	nav = NavigationAgent3D.new()
	nav.path_desired_distance = 0.6
	nav.target_desired_distance = 0.6
	nav.radius = radius
	nav.height = 1.8
	nav.max_speed = 6.0
	nav.avoidance_enabled = avoid
	nav.neighbor_distance = 6.0
	nav.max_neighbors = 6
	nav.time_horizon_agents = 1.0
	nav.path_max_distance = 3.0
	add_child(nav)
	if avoid:
		nav.velocity_computed.connect(_on_safe_velocity)

func _on_safe_velocity(v: Vector3) -> void:
	_desired_vel = v

# ------------------------------------------------------------------ здоровье
func take_damage(amount: float, source: Node, hit_pos: Vector3 = Vector3.ZERO, dir: Vector3 = Vector3.ZERO) -> void:
	if not alive:
		return
	var dmg := amount * (1.0 - armor)
	hp -= dmg
	_hit_flash = 1.0
	if rig and rig.has_method("hit_react"):
		rig.hit_react()
	damaged.emit(dmg, source)
	_on_damaged(dmg, source)
	if Game.world and Game.world.fx and hit_pos != Vector3.ZERO:
		Game.world.fx.blood(hit_pos, -dir, is_dog)
	if hp <= 0.0:
		hp = 0.0
		die()

func _on_damaged(_dmg: float, _source: Node) -> void:
	pass

func heal(amount: float) -> void:
	if alive:
		hp = minf(max_hp, hp + amount)

func die() -> void:
	if not alive:
		return
	alive = false
	collision_layer = 0
	collision_mask = 1
	velocity = Vector3.ZERO
	if nav:
		nav.avoidance_enabled = false
	if rig and rig.has_method("die"):
		rig.die()
	remove_from_group("actors")
	died.emit(self)
	Events.actor_died.emit(self)

func is_hostile(other: Actor) -> bool:
	if other == null or other == self or not other.alive:
		return false
	if faction == other.faction:
		return false
	return true

func eye_pos() -> Vector3:
	return global_position + Vector3(0, 1.6 if not is_dog else 0.6, 0)

func center_pos() -> Vector3:
	return global_position + Vector3(0, 1.15 if not is_dog else 0.45, 0)

func line_clear(from: Vector3, to: Vector3, exclude: Array = []) -> bool:
	var q := PhysicsRayQueryParameters3D.create(from, to, 1 | 128)
	q.exclude = exclude
	var r := get_world_3d().direct_space_state.intersect_ray(q)
	return r.is_empty()

func can_see(other: Actor) -> bool:
	return line_clear(eye_pos(), other.center_pos(), [get_rid(), other.get_rid()])

# ------------------------------------------------------------------ оружие
func wdef() -> Dictionary:
	return ItemDB.weapon(weapon_id)

func can_fire() -> bool:
	return weapon_id != "" and not reloading and _fire_cd <= 0.0 and mag > 0 and _cycle_t <= 0.0

func fire_at(target: Vector3, spread_mul: float = 1.0) -> bool:
	if not can_fire():
		return false
	var w := wdef()
	_fire_cd = float(w.rof)
	mag -= 1
	var origin := center_pos() + Vector3(0, 0.25, 0)
	var muzzle := origin
	if rig and rig.has_method("muzzle_world"):
		muzzle = rig.muzzle_world()
	var dir := (target - origin).normalized()
	Combat.shoot(self, origin, muzzle, dir, w, accuracy * spread_mul)
	if rig and rig.has_method("on_fire"):
		rig.on_fire()
	# затвор/помпа после выстрела
	if weapon_id in ["mosin", "ks23"] and mag > 0:
		_cycle_t = 0.7
		if rig is HumanRig:
			(rig as HumanRig).play("cycle", 0.6)
	return true

func start_reload() -> bool:
	if reloading or weapon_id == "":
		return false
	var w := wdef()
	if mag >= int(w.mag) or available_reserve() <= 0:
		return false
	reloading = true
	_reload_t = float(w.reload_time)
	if rig is HumanRig:
		(rig as HumanRig).play("reload", _reload_t)
	Sfx.play_at("reload", global_position + Vector3(0, 1, 0), -6.0)
	return true

func available_reserve() -> int:
	return reserve

func take_reserve(n: int) -> int:
	var t := mini(n, reserve)
	reserve -= t
	return t

func _finish_reload() -> void:
	reloading = false
	var w := wdef()
	var need := int(w.mag) - mag
	mag += take_reserve(need)

func update_weapon(delta: float) -> void:
	_fire_cd -= delta
	_cycle_t -= delta
	if reloading:
		_reload_t -= delta
		if _reload_t <= 0.0:
			_finish_reload()

# ------------------------------------------------------------------ перемещение
func move_to(target: Vector3) -> void:
	if nav == null:
		return
	if target.distance_squared_to(_nav_target) > 0.6:
		_nav_target = target
		nav.target_position = target

func nav_done() -> bool:
	return nav == null or nav.is_navigation_finished()

func steer(speed: float, delta: float, accel: float = 10.0) -> void:
	## Движение по пути навигации с плавным ускорением.
	var want := Vector3.ZERO
	if nav and not nav.is_navigation_finished() and speed > 0.0:
		var nxt := nav.get_next_path_position()
		var d := nxt - global_position
		d.y = 0
		if d.length() > 0.05:
			want = d.normalized() * speed
			# не бежим боком: замедляемся при резком повороте
			var fwd := -global_transform.basis.z
			var dot := fwd.dot(want.normalized())
			if aim_target == null:
				want *= clampf(0.35 + dot * 0.65, 0.25, 1.0)
	if nav and nav.avoidance_enabled:
		nav.velocity = want
		want = _desired_vel if _desired_vel.length() <= want.length() + 0.5 else want
	var v := Vector3(velocity.x, 0, velocity.z).move_toward(want, accel * delta)
	velocity = Vector3(v.x, velocity.y - 20.0 * delta if not is_on_floor() else 0.0, v.z)
	move_and_slide()

func turn_towards(dir: Vector3, delta: float) -> void:
	dir.y = 0
	if dir.length_squared() < 0.0001:
		return
	var target_yaw := atan2(-dir.x, -dir.z)
	rotation.y = lerp_angle(rotation.y, target_yaw, clampf(turn_speed * delta, 0.0, 1.0))

func update_facing(delta: float) -> void:
	if aim_target != null:
		turn_towards((aim_target as Vector3) - global_position, delta)
	else:
		var v := Vector3(velocity.x, 0, velocity.z)
		if v.length() > 0.3:
			turn_towards(v, delta)

# ------------------------------------------------------------------ анимация
func update_rig(delta: float) -> void:
	if rig == null:
		return
	if _hit_flash > 0.0:
		_hit_flash = maxf(0.0, _hit_flash - delta * 5.0)
		var body := rig.get("body_mi") as GeometryInstance3D
		if body:
			body.set_instance_shader_parameter("hit_flash", _hit_flash)
	var cam := get_viewport().get_camera_3d()
	if cam:
		var on_screen := cam.is_position_in_frustum(global_position + Vector3(0, 1, 0)) or cam.is_position_in_frustum(global_position)
		var dist := cam.global_position.distance_to(global_position)
		if not on_screen and alive:
			_was_visible = false
			return
		if not _was_visible:
			_was_visible = true
			rig.reset_feet()
		rig.lod_skip = 0 if dist < 40.0 else (1 if dist < 65.0 else 3)
	rig.velocity = Vector3(velocity.x, 0, velocity.z)
	if aim_target != null:
		rig.aim_dir = ((aim_target as Vector3) - center_pos()).normalized()
	rig.update_pose(delta)
