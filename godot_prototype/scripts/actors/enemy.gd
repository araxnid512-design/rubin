class_name Enemy
extends Actor
## Противники локации: слепые псы (слух, стая, укус), зомбированные сталкеры (медленные, плохо стреляют),
## мародёры (огнестрел, укрытия). Действуют в своей зоне с «поводком» и не заходят на охраняемую базу.

var kind := "dog"
var group: Node = null
var member_idx := 0
var home := Vector3.ZERO
var leash := 40.0
var wander_r := 12.0
var state := "idle"
var target_enemy: Actor = null
var _last_seen := Vector3.ZERO
var _ai_t := 0.0
var _wander_t := 0.0
var _wander_pt := Vector3.ZERO
var _attack_cd := 0.0
var _alert_pos: Variant = null
var _alert_t := 0.0
var _flee_t := 0.0
var _burst_left := 0
var _burst_pause := 0.0
var _sound_cd := 0.0
var _speed := 0.0
var bite_dmg := 11.0
var dormant := false
var loot := {}
var _cover: Variant = null
var _cover_t := 0.0

func _ready() -> void:
	collision_layer = 8
	add_to_group("enemies")
	setup_body(0.3 if kind == "dog" else 0.35, 0.9 if kind == "dog" else 1.8)
	setup_nav(true, 0.35)
	match kind:
		"dog":
			faction = Faction.MUTANT
			display_name = "Слепой пёс"
			is_dog = true
			max_hp = 45.0
			hp = 45.0
			turn_speed = 9.0
			sight_range = 7.0
			hearing = 1.6
			var d := DogRig.new()
			add_child(d)
			d.setup({"skin": Color(0.6, 0.47, 0.42).darkened(randf() * 0.15)})
			rig = d
		"zombie":
			faction = Faction.ZOMBIE
			display_name = "Зомбированный"
			max_hp = 90.0
			hp = 90.0
			armor = 0.1
			turn_speed = 4.0
			sight_range = 20.0
			hearing = 0.6
			accuracy = 3.0
			var r := HumanRig.new()
			add_child(r)
			r.setup({"head": ["hood", "gasmask", "bare"][member_idx % 3], "suit": Color(0.3, 0.31, 0.22), "armor": Color(0.32, 0.3, 0.22),
				"skin": Color(0.55, 0.55, 0.47), "vest_on": false, "pants": Color(0.25, 0.25, 0.2), "hair": Color(0.2, 0.18, 0.15), "hood_color": Color(0.28, 0.3, 0.22)})
			r.shamble = 1.0
			weapon_id = ["pm", "toz34", "ak74", "pm"][member_idx % 4]
			r.set_weapon(weapon_id)
			rig = r
			loot = {"ammo_9x18": 6, "canned": 1} if member_idx % 2 == 0 else {"bandage": 1, "electronics": 1}
		"bandit":
			faction = Faction.BANDIT
			display_name = "Мародёр"
			max_hp = 85.0
			hp = 85.0
			armor = 0.1
			turn_speed = 7.0
			sight_range = 34.0
			accuracy = 1.7
			var r := HumanRig.new()
			add_child(r)
			r.setup({"head": ["hood", "cap", "bare", "hood", "cap"][member_idx % 5], "suit": Color(0.12, 0.11, 0.1), "armor": Color(0.2, 0.17, 0.14),
				"pants": Color(0.24, 0.27, 0.32), "vest_on": member_idx % 2 == 0, "hood_color": Color(0.1, 0.1, 0.1), "cap_color": Color(0.08, 0.08, 0.08), "collar": false})
			weapon_id = ["akm", "toz34", "aks74u", "pm", "saiga"][member_idx % 5]
			r.set_weapon(weapon_id)
			rig = r
			loot = [{"ammo_762x39": 20, "bandage": 1}, {"ammo_12": 8, "canned": 1}, {"ammo_545": 25, "medkit": 1}, {"ammo_9x18": 12, "electronics": 1}, {"ammo_12": 10, "weapon_parts": 1}][member_idx % 5]
			loot[weapon_id] = 1
	if weapon_id != "":
		mag = int(wdef().mag)
		reserve = mag * 3
	rig.set_shadow(true)
	if kind == "dog":
		(rig as DogRig).set_shadow(true)
	Events.noise.connect(_on_noise)
	_wander_pt = home
	_ai_t = randf() * 0.5

func set_dormant(v: bool) -> void:
	if dormant == v:
		return
	dormant = v
	visible = not v
	set_physics_process(not v)
	set_process(not v)
	if nav:
		nav.avoidance_enabled = not v and alive
	if not v and rig:
		rig.reset_feet()

func _physics_process(delta: float) -> void:
	if not alive:
		return
	update_weapon(delta)
	_attack_cd -= delta
	_alert_t -= delta
	_flee_t -= delta
	_burst_pause -= delta
	_sound_cd -= delta
	_ai_t -= delta
	if _ai_t <= 0.0:
		_ai_t = 0.25
		_think()
	_act(delta)

func _process(delta: float) -> void:
	if kind == "dog":
		(rig as DogRig).alert = 1.0 if state in ["chase", "attack"] else 0.0
	update_rig(delta)

func _hostiles() -> Array:
	var out: Array = []
	for a in get_tree().get_nodes_in_group("actors"):
		var ac := a as Actor
		if ac and ac != self and is_hostile(ac) and ac.alive:
			out.append(ac)
	return out

func _think() -> void:
	if target_enemy and (not target_enemy.alive or target_enemy.global_position.distance_to(home) > leash + 10.0 or _inside_base(target_enemy.global_position)):
		target_enemy = null
		state = "return"
	# восприятие
	if target_enemy == null:
		var best: Actor = null
		var bd := sight_range
		for e in _hostiles():
			var d := global_position.distance_to((e as Actor).global_position)
			if d < bd:
				# слепые псы «видят» только вблизи (нюх), остальным нужна прямая видимость
				if kind == "dog" or can_see(e):
					bd = d
					best = e
		if best and not _inside_base(best.global_position):
			_set_target(best)
	elif kind != "dog" and can_see(target_enemy):
		_last_seen = target_enemy.global_position
	elif kind == "dog":
		_last_seen = target_enemy.global_position
	if kind == "dog" and hp < max_hp * 0.25 and _flee_t < -5.0:
		_flee_t = 3.0
	if _flee_t > 0.0:
		state = "flee"
		return
	if global_position.distance_to(home) > leash:
		target_enemy = null
		state = "return"
	if target_enemy:
		state = "chase" if kind == "dog" else "combat"
	elif _alert_pos != null and _alert_t > 0.0:
		state = "investigate"
	elif state != "return" or global_position.distance_to(home) < wander_r:
		state = "idle"

func _set_target(e: Actor) -> void:
	var was := target_enemy
	target_enemy = e
	_last_seen = e.global_position
	if was == null:
		if kind == "dog" and _sound_cd <= 0.0:
			_sound_cd = 3.0
			Sfx.play_at("bark", global_position, 0.0)
		elif kind == "zombie" and _sound_cd <= 0.0:
			_sound_cd = 5.0
			Sfx.play_at("groan", global_position, 0.0)
		if group and group.has_method("alert_all"):
			group.alert_all(e)

static func _inside_base(p: Vector3) -> bool:
	## Укреплённый периметр: противники не преследуют внутрь базы.
	return p.x > -98.0 and p.x < 98.0 and p.z > -103.0 and p.z < 80.0

func alert_to(e: Actor) -> void:
	if target_enemy == null and alive and not dormant:
		target_enemy = e
		_last_seen = e.global_position

func _act(delta: float) -> void:
	aim_target = null
	var speed := 0.0
	match state:
		"idle":
			_wander_t -= delta
			if _wander_t <= 0.0 or _near(_wander_pt, 1.2):
				_wander_t = randf_range(4.0, 9.0)
				_wander_pt = home + Vector3(randf_range(-wander_r, wander_r), 0, randf_range(-wander_r, wander_r))
				if kind == "dog" and randf() < 0.3:
					(rig as DogRig).play("sniff", 2.0)
			move_to(_wander_pt)
			speed = 1.2 if kind != "zombie" else 0.7
			if randf() < 0.004 and _sound_cd <= 0.0:
				_sound_cd = 6.0
				Sfx.play_at("growl" if kind == "dog" else ("groan" if kind == "zombie" else "radio"), global_position, -6.0)
		"return":
			move_to(home)
			speed = 2.5 if kind != "zombie" else 1.0
		"investigate":
			move_to(_alert_pos)
			speed = 2.6 if kind == "dog" else (1.0 if kind == "zombie" else 2.0)
			if _near(_alert_pos, 2.0):
				_alert_pos = null
		"flee":
			var away := (global_position - _last_seen).normalized()
			move_to(global_position + away * 8.0)
			speed = 6.0
		"chase":
			speed = _dog_attack(delta)
		"combat":
			speed = _gun_combat(delta)
	_speed = speed
	if speed <= 0.0 and nav:
		nav.target_position = global_position
		_nav_target = global_position
	steer(speed, delta, 14.0 if kind == "dog" else 9.0)
	update_facing(delta)

func _near(p: Variant, r: float) -> bool:
	if p == null:
		return true
	var v: Vector3 = p
	return Vector2(v.x - global_position.x, v.z - global_position.z).length() < r

func _dog_attack(delta: float) -> float:
	if target_enemy == null:
		return 0.0
	var d := global_position.distance_to(target_enemy.global_position)
	if d > 1.6:
		move_to(target_enemy.global_position)
		return 6.8 if d > 4.0 else 4.0
	var to := target_enemy.global_position - global_position
	turn_towards(to, delta * 2.0)
	if _attack_cd <= 0.0:
		_attack_cd = 1.0
		(rig as DogRig).play("attack", 0.5)
		Sfx.play_at("growl", global_position, -2.0, 1.3)
		var t := target_enemy
		get_tree().create_timer(0.2).timeout.connect(func():
			if alive and is_instance_valid(t) and t.alive and global_position.distance_to(t.global_position) < 2.0:
				t.take_damage(bite_dmg, self, t.center_pos(), (t.global_position - global_position).normalized()))
	return 0.0

func _gun_combat(_delta: float) -> float:
	var hr := rig as HumanRig
	if target_enemy == null:
		return 0.0
	var w := wdef()
	var d := global_position.distance_to(target_enemy.global_position)
	var rng: float = float(w.get("range", 25.0)) * (0.7 if kind == "zombie" else 0.85)
	var vis := can_see(target_enemy)
	if not vis or d > rng:
		move_to(_last_seen)
		if vis:
			aim_target = target_enemy.center_pos()
		return 3.2 if kind == "bandit" else 1.6
	aim_target = target_enemy.center_pos()
	var speed := 0.0
	if kind == "bandit" and d < 8.0:
		var away := (global_position - target_enemy.global_position).normalized()
		move_to(global_position + away * 4.0 + away.cross(Vector3.UP) * 2.0)
		speed = 2.4
	if mag <= 0:
		start_reload()
	# мародёры перезаряжаются из-за укрытия
	_cover_t -= _delta
	if reloading and kind == "bandit" and Game.world:
		if _cover == null and _cover_t <= 0.0:
			_cover_t = 1.5
			_cover = Game.world.find_cover(global_position, target_enemy.global_position, 10.0)
		if _cover != null and not _near(_cover, 0.8):
			move_to(_cover)
			return 3.6
		return 0.0
	_cover = null
	if mag <= 0:
		return speed
	var facing := -global_transform.basis.z
	var to := target_enemy.global_position - global_position
	to.y = 0
	if facing.dot(to.normalized()) < 0.85 or _burst_pause > 0.0:
		return speed
	if fire_at(target_enemy.center_pos(), 1.0 + d / rng):
		_burst_left -= 1
		if _burst_left <= 0:
			_burst_left = randi_range(2, 5) if bool(w.get("auto", false)) else 1
			_burst_pause = randf_range(0.6, 1.4) * (1.6 if kind == "zombie" else 1.0)
	return speed

func _on_noise(pos: Vector3, radius: float, source: Node) -> void:
	if not alive or dormant:
		return
	if not (source is Actor) or not is_hostile(source as Actor):
		return
	if _inside_base(pos):
		return
	if global_position.distance_to(pos) < radius * hearing:
		if kind == "dog" and global_position.distance_to(pos) < radius * hearing * 0.6:
			_set_target(source as Actor)
		elif target_enemy == null:
			_alert_pos = pos
			_alert_t = 10.0

func _on_damaged(_dmg: float, source: Node) -> void:
	if source is Actor and is_hostile(source as Actor):
		_set_target(source as Actor)

func die() -> void:
	super()
	if group and group.has_method("on_member_died"):
		group.on_member_died(self)
	if not loot.is_empty():
		var lc := LootContainer.new()
		lc.container_id = "body_%s_%d_%d" % [String(group.name) if group else "x", member_idx, Game.day]
		lc.title = "Тело (%s)" % display_name
		lc.kind = "corpse"
		lc.items = loot.duplicate()
		lc.position = global_position
		get_parent().add_child(lc)
	# тело убирается через 4 минуты, если генерал далеко
	var tm := Timer.new()
	tm.wait_time = 240.0
	tm.one_shot = false
	tm.autostart = true
	tm.timeout.connect(func():
		if Game.player and Game.player.global_position.distance_to(global_position) > 40.0:
			queue_free())
	add_child(tm)
