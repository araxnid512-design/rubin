class_name STCrew
extends STActor
## Член экипажа StarCore: медик лечит героя и своих, стрелок отстреливается, механик заваривает пробоины и
## понемногу чинит корпус в тишине. Приказ: «на посту» (свой отсек) или «за мной». Ранен — лежит до конца
## события, потом приходит в себя в медотсеке. Выживший до спасения ждёт («Забрать на борт»), потом идёт за героем.

const ROLES := {
	"medic": {"n": "Медик", "name": "Ирина", "fem": true, "post": "medbay", "hp": 70.0, "color": Color(0.9, 0.95, 1.0),
		"d": "лечит вас и экипаж рядом"},
	"gunner": {"n": "Стрелок", "name": "Тимур", "fem": false, "post": "corridor", "hp": 110.0, "color": Color(0.3, 0.45, 0.85),
		"d": "стреляет по врагам в 7 м"},
	"mechanic": {"n": "Механик", "name": "Лёша", "fem": false, "post": "workshop", "hp": 80.0, "color": Color(0.95, 0.8, 0.25),
		"d": "заваривает пробоины, в тишине чинит корпус"},
}
var role := "medic"
var order := "post"                   ## post / follow / wait (выживший до спасения)
var rescued := true
var it: STInteract
var _path := PackedVector2Array()
var _pi := 0
var _repath := 0.0
var _cool := 0.0
var _work := 0.0


func rd() -> Dictionary:
	return ROLES.get(role, ROLES.medic)


func person() -> String:
	return String(rd().name)


## «ранен» / «ранена»
func gend(m: String, f: String) -> String:
	return f if rd().fem else m


func _ready() -> void:
	faction = "crew"
	max_hp = rd().hp
	color = rd().color
	super._ready()
	add_to_group("crew")
	it = STInteract.new()
	it.action = "use"
	it.radius = 1.4
	it.position = Vector2(0, 4)
	add_child(it)
	it.used.connect(_on_use)
	_update_it()


func _update_it() -> void:
	if not rescued:
		it.verb = "Забрать"
		it.label = "%s, %s — забрать на борт" % [person(), rd().n.to_lower()]
		it.enabled = true
	elif state == "dead":
		it.verb = "Поднять"
		it.label = "%s %s" % [person(), gend("ранен", "ранена")]
		it.enabled = true
	else:
		it.enabled = false


func _on_use(by: Node) -> void:
	if not rescued and order == "wait":
		order = "follow"
		Core.say("%s: «Спасибо! Иду за вами.»" % person(), "good")
		_update_it()
	elif state == "dead" and by is STHero:
		by.work(2.0, func(): revive_at(global_position, max_hp * 0.4))


func label() -> String:
	var o: String = {"post": "на посту", "follow": "за мной", "wait": "ждёт"}.get(order, order)
	return "%s, %s — %s" % [person(), rd().n.to_lower(), o]


func revive_at(at: Vector2, hp_v: float) -> void:
	state = "move"
	hp = hp_v
	collision_layer = 2
	global_position = at
	velocity = Vector2.ZERO
	reset_physics_interpolation()
	if spr:
		spr.play("idle", true)
	_update_it()


func die() -> void:
	super.die()
	Core.say("%s %s!" % [person(), gend("ранен", "ранена")], "bad")
	_update_it()


func _physics_process(delta: float) -> void:
	if state == "dead":
		return
	_cool = maxf(0.0, _cool - delta)
	_repath -= delta
	var h: STHero = Core.player
	var goal := global_position
	match order:
		"wait":
			walk(Vector2.ZERO, 0.0, delta)
			return
		"follow":
			if h:
				goal = h.global_position + Vector2(40, 26)
		"post":
			goal = Core.ship.room_center(rd().post) + Vector2(-30, 20) if Core.ship.rooms.has(rd().post) else global_position
	# дело по роли
	match role:
		"medic":
			if h and h.alive() and h.hp < h.max_hp * 0.75 and SP.dist_m(global_position, h.global_position) < 16.0:
				goal = h.global_position + Vector2(30, 10)
			for c in get_tree().get_nodes_in_group("hittable"):
				if c is STActor and c.faction == "crew" and c.alive() and c != self and c.hp < c.max_hp and SP.dist_m(global_position, c.global_position) < 1.6:
					c.hp = minf(c.max_hp, c.hp + 6.0 * delta)
					_work += delta
					if _work > 0.6:
						_work = 0.0
						STFx.number(c.global_position + Vector2(0, -100), "+", Color(0.5, 1.0, 0.6), 16)
		"gunner":
			var foe := _nearest_enemy(7.0)
			if foe:
				face(foe.global_position)
				if _cool <= 0.0:
					_cool = 0.55
					if spr.has_clip("shoot"):
						spr.play("shoot", true)
					STBolt.fire(get_parent(), global_position, foe.global_position, 17.0, 9.0, "crew", Color(1.0, 0.9, 0.4), self)
					Core.play_at("blaster", global_position, -9.0)
		"mechanic":
			var r := _nearest_group("repairable", 18.0)
			if r:
				goal = r.global_position + Vector2(0, 20)
				if SP.dist_m(global_position, r.global_position) < 1.1:
					_work += delta
					if _work > 1.5:
						_work = 0.0
						r.repair_by(self)
			elif Core.loop and Core.loop.phase == "calm":
				var ss = Core.get_meta("shipst", null)
				if ss and ss.powered("workshop") and ss.hull < ss.hull_max():
					ss.hull = minf(ss.hull_max(), ss.hull + 0.08 * delta)
	_move_to(goal, delta)


func _move_to(goal: Vector2, delta: float) -> void:
	if SP.dist_m(global_position, goal) < 0.6:
		walk(Vector2.ZERO, 0.0, delta)
		return
	if _repath <= 0.0:
		_repath = 0.6
		_path = Core.ship.path(global_position, goal)
		_pi = 1
	var sp := 3.0 if SP.dist_m(global_position, goal) > 3.0 else 1.4
	if _pi < _path.size():
		var d := SP.screen_to_ground(_path[_pi] - global_position)
		if d.length() < 18.0:
			_pi += 1
		else:
			walk(d.normalized(), sp, delta)
	else:
		walk(SP.screen_to_ground(goal - global_position).normalized(), sp, delta)


func _nearest_group(group: String, r: float) -> Node2D:
	var best: Node2D = null
	var bd := r
	for n in get_tree().get_nodes_in_group(group):
		if not (n is Node2D):
			continue
		var d := SP.dist_m(global_position, n.global_position)
		if d < bd:
			bd = d
			best = n
	return best


func _nearest_enemy(r: float) -> Node2D:
	var best: Node2D = null
	var bd := r
	var space := get_world_2d().direct_space_state
	for e in get_tree().get_nodes_in_group("enemy"):
		if not e.alive():
			continue
		var d := SP.dist_m(global_position, e.global_position)
		if d < bd:
			var q := PhysicsRayQueryParameters2D.create(global_position + Vector2(0, -10), e.global_position + Vector2(0, -10), 1)
			if space.intersect_ray(q).is_empty():
				bd = d
				best = e
	return best
