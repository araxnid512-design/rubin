class_name Soldier
extends Actor
## Боец «Долга». Самостоятельно перемещается по навмешу, выполняет приказы генерала,
## обнаруживает врагов (зрение и шум), стреляет, отступает раненым, медик лечит.

const ORDER_NAMES := {
	"follow": "Следовать за мной", "guard": "Охранять позицию", "patrol": "Патрулировать",
	"repair": "Ремонтировать постройку", "heal": "Лечить раненых", "defend": "Занять оборону",
	"barracks": "Вернуться в казарму", "idle": "Вольно",
}
const L = preload("res://scripts/world/layout.gd")

var sid := ""
var def := {}
var role := ""
var order := "idle"
var order_target: Variant = null
var state := "idle"
var target_enemy: Actor = null
var _last_seen := Vector3.ZERO
var _ai_t := 0.0
var _burst_left := 0
var _burst_pause := 0.0
var _patrol_i := 0
var _heal_target: Actor = null
var _heal_t := 0.0
var _greet_cd := 0.0
var _alert_pos: Variant = null
var _alert_t := 0.0
var _no_ammo_warned := false
var _talk_t := 0.0
var _stuck_t := 0.0
var _last_pos := Vector3.ZERO
var supplied := false
var skill := 1.0
var _speed := 0.0
var _repair_b := ""
var _cover: Variant = null
var _cover_t := 0.0

func setup_soldier(d: Dictionary) -> void:
	def = d
	sid = d.id
	role = d.role
	display_name = "%s «%s»" % [d.name, d.call]
	name = "Soldier_" + sid

func _ready() -> void:
	faction = Faction.DUTY
	collision_layer = 4
	add_to_group("allies")
	add_to_group("soldiers")
	add_to_group("interactable")
	setup_body(0.35, 1.8)
	setup_nav(true, 0.4)
	var look: Dictionary = (def.get("look", {}) as Dictionary).duplicate()
	look["suit"] = Color(0.19, 0.19, 0.2)
	look["armor"] = Color(0.52, 0.09, 0.07)
	var r := HumanRig.new()
	r.name = "Rig"
	add_child(r)
	r.setup(look)
	rig = r
	var st: Dictionary = Game.soldiers[sid]
	hp = float(st.hp)
	max_hp = float(st.get("max_hp", 100.0))
	armor = 0.2
	weapon_id = String(st.weapon)
	mag = int(st.ammo)
	reserve = int(st.reserve)
	order = String(st.order)
	order_target = st.get("target")
	supplied = bool(st.get("supplied", false))
	skill = float(st.get("skill", 1.0))
	global_position = Game._to_v3(st.pos)
	rotation.y = float(st.get("yaw", 0.0))
	r.set_weapon(weapon_id)
	accuracy = 1.3 / skill
	sight_range = 70.0 if role == "sniper" else 40.0
	if not bool(st.get("alive", true)):
		alive = false
		hp = 0
		r.die()
	reset_physics_interpolation()
	_ai_t = randf() * 0.3
	Events.noise.connect(on_noise)

func write_state() -> void:
	var st: Dictionary = Game.soldiers[sid]
	st.hp = hp
	st.weapon = weapon_id
	st.ammo = mag
	st.reserve = reserve
	st.order = order
	st.target = order_target
	st.pos = global_position
	st.yaw = rotation.y
	st.supplied = supplied
	st.skill = skill
	st.alive = alive

func role_name() -> String:
	return String(def.get("role_name", role))

func order_name() -> String:
	return ORDER_NAMES.get(order, order)

func status_text() -> String:
	match state:
		"combat": return "Бой"
		"retreat": return "Отступает (ранен)"
		"heal": return "Лечит"
		"repair": return "Ремонт"
		"rest": return "Отдыхает"
		"move": return "В пути"
	return "На месте"

# ------------------------------------------------------------------ приказы
func give_order(o: String, tgt: Variant = null) -> void:
	order = o
	order_target = tgt
	target_enemy = null
	_heal_target = null
	_patrol_i = 0
	(rig as HumanRig).stop_action()
	match o:
		"guard":
			if tgt == null:
				order_target = Game.player.global_position if Game.player else global_position
		"defend":
			order_target = _pick_defense_point(tgt)
		"repair":
			_repair_b = String(tgt) if tgt is String else ""
	write_state()
	Events.soldier_changed.emit(sid)
	(rig as HumanRig).play("salute", 1.2)
	Sfx.play_at("ui_ok", global_position, -12.0)

func _pick_defense_point(near: Variant) -> Vector3:
	var origin: Vector3 = near if near is Vector3 else (Game.player.global_position if Game.player else global_position)
	var taken := []
	for s in get_tree().get_nodes_in_group("soldiers"):
		if s != self and (s as Soldier).order in ["defend", "guard"] and (s as Soldier).order_target is Vector3:
			taken.append((s as Soldier).order_target)
	var best := origin
	var bd := INF
	for p in L.DEFENSE_POINTS:
		var pv: Vector3 = p
		var used := false
		for t in taken:
			if (t as Vector3).distance_to(pv) < 1.0:
				used = true
		if used:
			continue
		var d := pv.distance_to(origin)
		if d < bd:
			bd = d
			best = pv
	return best

# ------------------------------------------------------------------ взаимодействие
func interact_pos() -> Vector3:
	return global_position

func interact_prompt() -> String:
	return "Боец: %s" % def.get("call", "")

func interact_hold() -> float:
	return 0.0

func interact_anim() -> String:
	return "use"

func can_interact(_a: Node) -> bool:
	return alive

func interact(actor: Node) -> void:
	_talk_t = 3.0
	var d: Vector3 = (actor as Node3D).global_position - global_position
	rotation.y = atan2(-d.x, -d.z)
	(rig as HumanRig).play("talk", 2.0)
	if sid == "s_officer" and Quest.current().id == "officer" and not Game.flags.get("talked_officer", false):
		Events.ui_open.emit("dialog", "officer")
	else:
		Events.ui_open.emit("soldier", self)
	Events.area_visited.emit("talk_" + sid)

# ------------------------------------------------------------------ ИИ
func _physics_process(delta: float) -> void:
	if not alive:
		return
	update_weapon(delta)
	_greet_cd -= delta
	_talk_t -= delta
	_burst_pause -= delta
	_alert_t -= delta
	_ai_t -= delta
	var far := Game.player == null or global_position.distance_to(Game.player.global_position) > 90.0
	if _ai_t <= 0.0:
		_ai_t = 0.25 if not far else 1.0
		_think()
	_act(delta)
	# натуральная регенерация
	var regen := 0.05
	if state == "rest":
		regen = 1.0 if Game.building_level("barracks") >= 1 else 0.5
	hp = minf(max_hp, hp + regen * delta)

func _think() -> void:
	# --- восприятие ---
	if target_enemy and (not target_enemy.alive or target_enemy.global_position.distance_to(global_position) > sight_range * 1.3):
		target_enemy = null
	if target_enemy == null or randf() < 0.3:
		var best: Actor = null
		var bd := sight_range
		for a in get_tree().get_nodes_in_group("enemies"):
			var e := a as Actor
			if e == null or not e.alive:
				continue
			var d := global_position.distance_to(e.global_position)
			if d < bd and can_see(e):
				bd = d
				best = e
		if best:
			if target_enemy == null:
				Events.msg("%s: «Контакт! Противник!»" % def.call, Events.Msg.ALERT)
			target_enemy = best
			_last_seen = best.global_position
	elif target_enemy:
		if can_see(target_enemy):
			_last_seen = target_enemy.global_position
	# --- ранен: отступление ---
	if hp < max_hp * 0.3 and state != "retreat" and role != "medic":
		state = "retreat"
		Events.msg("%s ранен и отходит к медпункту!" % def.call, Events.Msg.ALERT)
	if state == "retreat":
		if hp > max_hp * 0.6:
			state = "idle"
		return
	if target_enemy:
		state = "combat"
		return
	if _alert_pos != null and _alert_t > 0.0 and order in ["guard", "defend", "patrol", "idle"]:
		state = "alert"
		return
	# --- медик лечит раненых ---
	if role == "medic" and order in ["heal", "follow", "idle", "guard"]:
		var w := _find_wounded()
		if w:
			_heal_target = w
			state = "heal"
			return
	if state == "heal" and (_heal_target == null or not _heal_target.alive):
		state = "idle"
	match order:
		"repair": state = "repair"
		"barracks": state = "rest" if _near(_barracks_spot(), 1.5) else "move"
		_: state = "order"

func _act(delta: float) -> void:
	var hr := rig as HumanRig
	aim_target = null
	var speed := 0.0
	hr.hold_state = "low"
	hr.look_at_pos = null
	match state:
		"combat":
			speed = _combat(delta)
		"retreat":
			var dest := _retreat_point()
			move_to(dest)
			speed = 3.6
			hr.hold_state = "carry"
			if _near(dest, 2.0):
				speed = 0.0
				hp = minf(max_hp, hp + 0.6 * delta)
		"alert":
			move_to(_alert_pos)
			speed = 1.6
			aim_target = (_alert_pos as Vector3) + Vector3(0, 1.0, 0)
			if _near(_alert_pos, 3.0):
				speed = 0.0
				if _alert_t <= 0.0:
					_alert_pos = null
		"heal":
			speed = _heal(delta)
		"repair":
			speed = _repair(delta)
		"rest", "move":
			var spot := _barracks_spot()
			move_to(spot)
			speed = 2.0 if not _near(spot, 1.0) else 0.0
			hr.hold_state = "carry"
		_:
			speed = _follow_order(delta)
	if _talk_t > 0.0 and Game.player:
		speed = 0.0
		hr.look_at_pos = Game.player.global_position + Vector3(0, 1.6, 0)
	# приветствие генерала
	if Game.player and _greet_cd <= 0.0 and state == "order" and speed < 0.1:
		var d := global_position.distance_to(Game.player.global_position)
		if d < 4.0:
			_greet_cd = 90.0
			_face_to(Game.player.global_position)
			hr.play("salute", 1.6)
	_speed = speed
	if speed <= 0.0 and nav:
		nav.target_position = global_position
		_nav_target = global_position
	steer(speed, delta)
	update_facing(delta)
	# защита от застревания
	if speed > 0.5:
		if global_position.distance_to(_last_pos) < 0.05 * delta * 30.0:
			_stuck_t += delta
			if _stuck_t > 2.0:
				_stuck_t = 0.0
				_nav_target = Vector3(INF, 0, 0)
				velocity += Vector3(randf_range(-1, 1), 0, randf_range(-1, 1)) * 2.0
		else:
			_stuck_t = 0.0
	_last_pos = global_position

func _process(delta: float) -> void:
	update_rig(delta)

func _face_to(p: Vector3) -> void:
	var d := p - global_position
	d.y = 0
	if d.length() > 0.1:
		rotation.y = atan2(-d.x, -d.z)

func _near(p: Variant, r: float) -> bool:
	if p == null:
		return true
	var v: Vector3 = p
	return Vector2(v.x - global_position.x, v.z - global_position.z).length() < r

# --- приказы вне боя ---
func _follow_order(_delta: float) -> float:
	var hr := rig as HumanRig
	match order:
		"follow":
			if Game.player == null:
				return 0.0
			var idx := _follow_index()
			var offs := [Vector3(-1.6, 0, 2.0), Vector3(1.6, 0, 2.0), Vector3(-2.6, 0, 3.8), Vector3(2.6, 0, 3.8), Vector3(0, 0, 5.0), Vector3(-3.6, 0, 5.6)]
			var pb: Basis = Game.player.global_transform.basis
			var dest: Vector3 = Game.player.global_position + pb * (offs[idx % offs.size()] as Vector3)
			var d := global_position.distance_to(dest)
			if d < 1.2:
				return 0.0
			move_to(dest)
			return 4.2 if d > 6.0 else (2.2 if d > 2.5 else 1.4)
		"guard", "defend":
			var p: Vector3 = order_target if order_target is Vector3 else global_position
			if not _near(p, 0.8):
				move_to(p)
				hr.hold_state = "low"
				return 3.4 if not _near(p, 6.0) else 1.6
			# стоит на посту, смотрит наружу
			hr.hold_state = "low"
			if randf() < 0.01:
				hr.look_bias = randf_range(-0.8, 0.8)
			var face := p - L.RALLY_POINT
			if absf(p.z - 76.0) < 10.0:
				face = Vector3(0, 0, 1)
			turn_towards(face, get_physics_process_delta_time())
			return 0.0
		"patrol":
			hr.hold_state = "carry"
			var wp: Vector3 = L.PATROL_ROUTE[_patrol_i % L.PATROL_ROUTE.size()]
			if _near(wp, 1.5):
				_patrol_i += 1
			move_to(wp)
			return 1.6
		"heal":
			if role == "medic":
				var mp := Game.world.buildings.get("medpoint") as Building if Game.world else null
				if mp and not _near(mp.entrance(), 3.0):
					move_to(mp.entrance())
					return 2.0
			return 0.0
		_:
			hr.hold_state = "idle"
			return 0.0

func _follow_index() -> int:
	var i := 0
	for s in get_tree().get_nodes_in_group("soldiers"):
		if s == self:
			return i
		if (s as Soldier).order == "follow" and (s as Soldier).alive:
			i += 1
	return i

# --- бой ---
func _combat(delta: float) -> float:
	var hr := rig as HumanRig
	if target_enemy == null or not target_enemy.alive:
		state = "idle"
		return 0.0
	var dist := global_position.distance_to(target_enemy.global_position)
	var w := wdef()
	var rng: float = float(w.get("range", 30.0)) if weapon_id != "" else 0.0
	var visible := can_see(target_enemy)
	var speed := 0.0
	# держаться приказа: часовые не уходят далеко от поста
	var anchor: Variant = null
	if order in ["guard", "defend"] and order_target is Vector3:
		anchor = order_target
	elif order == "follow" and Game.player:
		anchor = Game.player.global_position
	if not visible or dist > rng * 0.9:
		var chase: Vector3 = _last_seen
		if anchor != null and (anchor as Vector3).distance_to(chase) > 14.0:
			chase = (anchor as Vector3) + ((chase - (anchor as Vector3)).normalized() * 10.0)
		move_to(chase)
		speed = 3.4
		if visible:
			aim_target = target_enemy.center_pos()
		return speed
	aim_target = target_enemy.center_pos()
	if anchor != null and not _near(anchor, 10.0):
		move_to(anchor)
		speed = 1.6
	# укрытие: при перезарядке или ранении уходим за препятствие, закрывающее линию огня
	_cover_t -= delta
	if (reloading or hp < max_hp * 0.5) and Game.world:
		if _cover == null and _cover_t <= 0.0:
			_cover_t = 1.5
			_cover = Game.world.find_cover(global_position, target_enemy.global_position, 10.0)
		if _cover != null:
			if not _near(_cover, 0.8):
				move_to(_cover)
				return 3.8
			aim_target = null
			return 0.0
	elif _cover != null and not reloading:
		_cover = null
	# огонь очередями
	if mag <= 0:
		if not start_reload() and reserve <= 0 and not _no_ammo_warned:
			_no_ammo_warned = true
			Events.msg("%s: «Нет патронов!»" % def.call, Events.Msg.ALERT)
		return speed
	var facing := -global_transform.basis.z
	var to := (target_enemy.global_position - global_position)
	to.y = 0
	if facing.dot(to.normalized()) < 0.9:
		return speed
	if _burst_pause > 0.0:
		return speed
	if Combat.is_ally_in_line(self, target_enemy.center_pos()):
		return speed
	if fire_at(target_enemy.center_pos(), 1.0 + dist / maxf(rng, 1.0) * 0.5):
		_burst_left -= 1
		if _burst_left <= 0:
			_burst_left = randi_range(3, 6) if bool(w.get("auto", false)) else 1
			_burst_pause = randf_range(0.35, 0.9) if bool(w.get("auto", false)) else randf_range(0.2, 0.5)
	return speed

# --- лечение ---
func _find_wounded() -> Actor:
	var best: Actor = null
	var bd := 45.0
	for a in get_tree().get_nodes_in_group("allies"):
		var ac := a as Actor
		if ac == null or ac == self or not ac.alive:
			continue
		if ac.hp < ac.max_hp * 0.65:
			var d := global_position.distance_to(ac.global_position)
			if d < bd:
				bd = d
				best = ac
	return best

func _heal(delta: float) -> float:
	var hr := rig as HumanRig
	if _heal_target == null or not _heal_target.alive or _heal_target.hp >= _heal_target.max_hp * 0.95:
		_heal_target = null
		state = "idle"
		hr.stop_action()
		return 0.0
	if not _near(_heal_target.global_position, 1.5):
		move_to(_heal_target.global_position)
		_heal_t = 0.0
		return 3.6
	_face_to(_heal_target.global_position)
	if hr.action != "heal_other":
		hr.play("heal_other", 3.0)
	_heal_t += delta
	if _heal_t >= 3.0:
		_heal_t = 0.0
		var amount := 22.0
		if Game.warehouse_count("medicine") > 0 or Game.inv.count("medicine") > 0:
			Game.consume({"medicine": 1})
			amount = 40.0
		if Game.building_level("medpoint") >= 1:
			amount *= 1.3
		_heal_target.heal(amount)
		Events.msg("%s оказал помощь: %s (+%d)" % [def.call, _heal_target.display_name, int(amount)], Events.Msg.GOOD)
	return 0.0

# --- ремонт ---
func _repair(delta: float) -> float:
	var hr := rig as HumanRig
	var b := _repair_building()
	if b == null:
		hr.stop_action()
		if Game.player:
			move_to(L.RALLY_POINT)
			return 1.6 if not _near(L.RALLY_POINT, 2.0) else 0.0
		return 0.0
	var wp := b.work_point()
	if not _near(wp, 1.6):
		move_to(wp)
		return 3.0
	_face_to(b.center())
	if hr.action != "repair":
		hr.play("repair", 999.0)
	var rate := 1.5 if role == "tech" else 0.7
	Game.add_work(b.id, rate * delta)
	if randf() < delta * 1.5:
		Sfx.play_at("hammer", global_position + Vector3(0, 1, 0), -8.0)
	return 0.0

func _repair_building() -> Building:
	if Game.world == null:
		return null
	if _repair_b != "" and Game.building_job(_repair_b) != "":
		return Game.world.buildings.get(_repair_b)
	var best: Building = null
	var bd := INF
	for id in Game.world.buildings:
		if Game.building_job(id) != "":
			var b: Building = Game.world.buildings[id]
			var d := b.global_position.distance_to(global_position)
			if d < bd:
				bd = d
				best = b
	return best

func _barracks_spot() -> Vector3:
	var idx := 0
	var i := 0
	for s in L.SOLDIERS:
		if s.id == sid:
			idx = i
		i += 1
	return L.BARRACKS_SPOTS[idx % L.BARRACKS_SPOTS.size()]

func _retreat_point() -> Vector3:
	if Game.world and Game.world.buildings.has("medpoint"):
		return (Game.world.buildings.medpoint as Building).entrance()
	return L.RALLY_POINT

func on_noise(pos: Vector3, radius: float, source: Node) -> void:
	if source is Actor and is_hostile(source as Actor) and global_position.distance_to(pos) < radius * hearing:
		if target_enemy == null:
			_alert_pos = pos
			_alert_t = 8.0

func _on_damaged(_dmg: float, source: Node) -> void:
	if source is Actor and is_hostile(source as Actor):
		if target_enemy == null:
			target_enemy = source as Actor
			_last_seen = target_enemy.global_position

func die() -> void:
	super()
	Game.soldiers[sid].alive = false
	Events.msg("Погиб боец: %s" % display_name, Events.Msg.ALERT)
