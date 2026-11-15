class_name STDrone
extends STActor
## Дрон экипажа: летает (над предметами, сквозь стены нельзя), подчиняется приказам:
##   follow — за героем; guard — держит точку; repair — чинит пробоины и тушит пожары (группа "repairable");
##   mine — добывает руду (группа "ore"). Боевой стреляет по врагам в 6 м, ремонтник — только чинит и добывает.
## Без энергии на зарядку дронов летает медленно и не стреляет.

var kind := "drone_combat"
var order := "follow"
var guard_pos := Vector2.ZERO
var _path := PackedVector2Array()
var _pi := 0
var _repath := 0.0
var _cool := 0.0
var _work := 0.0
var _t := 0.0
var _lift := -26.0


func _ready() -> void:
	faction = "crew"
	max_hp = 60.0 if kind == "drone_combat" else 45.0
	color = Color(0.8, 0.3, 0.3) if kind == "drone_combat" else Color(0.95, 0.65, 0.25)
	super._ready()
	collision_mask = 1                    # над предметами пролетает
	spr.height = 0.6
	_lift = 0.0 if not spr.info.is_empty() else -26.0   # у запечённого спрайта высота полёта уже в кадре
	spr.position = Vector2(0, _lift)
	add_to_group("drone")
	guard_pos = global_position


func label() -> String:
	return ("Боевой дрон" if kind == "drone_combat" else "Ремонтник") + " — " + {"follow": "за мной", "guard": "охраняет", "repair": "чинит", "mine": "добывает"}.get(order, order)


func _powered() -> bool:
	var ss = Core.get_meta("shipst", null)
	return ss == null or ss.powered("drones")


func _physics_process(delta: float) -> void:
	if state == "dead":
		return
	_t += delta
	spr.position.y = _lift + sin(_t * 3.0) * 3.0
	_cool = maxf(0.0, _cool - delta)
	_repath -= delta
	var sp := 3.2 if _powered() else 1.4
	var goal := global_position
	match order:
		"follow":
			var h: Node2D = Core.player
			if h:
				goal = h.global_position + Vector2(-50, 20)
		"guard":
			goal = guard_pos
		"repair":
			var r := _nearest("repairable")
			goal = r.global_position if r else (Core.player.global_position + Vector2(50, 20))
			if r and SP.dist_m(global_position, r.global_position) < 1.0:
				_work += delta
				if _work > 2.5:
					_work = 0.0
					r.repair_by(self)
		"mine":
			var o := _nearest("ore")
			goal = o.global_position if o else global_position
			if o and SP.dist_m(global_position, o.global_position) < 1.0:
				_work += delta
				if _work > 3.0:
					_work = 0.0
					o.mine_by(self)
	if kind == "drone_combat" and _powered():
		var foe := _nearest_enemy(6.0)
		if foe:
			face(foe.global_position)
			if _cool <= 0.0:
				_cool = 0.6
				STBolt.fire(get_parent(), global_position, foe.global_position, 16.0, 6.0, "crew", Color(0.4, 0.9, 1.0), self)
				Core.play_at("blaster", global_position, -10.0)
	if SP.dist_m(global_position, goal) < 0.6:
		walk(Vector2.ZERO, 0.0, delta)
		return
	if _repath <= 0.0:
		_repath = 0.6
		_path = Core.ship.path(global_position, goal)
		_pi = 1
	if _pi < _path.size():
		var d := SP.screen_to_ground(_path[_pi] - global_position)
		if d.length() < 18.0:
			_pi += 1
		else:
			walk(d.normalized(), sp, delta)
	else:
		walk(SP.screen_to_ground(goal - global_position).normalized(), sp, delta)


func _nearest(group: String) -> Node2D:
	var best: Node2D = null
	var bd := 1e9
	for n in get_tree().get_nodes_in_group(group):
		if not (n is Node2D) or not n.is_visible_in_tree():
			continue
		var d := SP.dist_m(global_position, n.global_position)
		if d < bd:
			bd = d
			best = n
	return best


func _nearest_enemy(r: float) -> Node2D:
	var best: Node2D = null
	var bd := r
	for e in get_tree().get_nodes_in_group("enemy"):
		if not e.alive():
			continue
		var d := SP.dist_m(global_position, e.global_position)
		if d < bd:
			bd = d
			best = e
	return best


func die() -> void:
	super.die()
	Core.play_at("metal_clang", global_position, -2.0)
	Core.say("Дрон уничтожен.", "bad")
	var ss = Core.get_meta("shipst", null)
	if ss:
		ss.drones.erase(self)
	get_tree().create_timer(3.0).timeout.connect(queue_free)
