class_name STHero
extends STActor
## Герой «Дрейфа»: управление джойстиком (полный наклон — бег, лёгкий — шаг), «Действие» — ближайшая точка
## взаимодействия, удар, уклон с неуязвимостью, инвентарь (вещи списком, как в бункере).

const WALK := 1.4
const RUN := 3.4
const BLASTER_RANGE := 9.0
const BLASTER_DMG := 12.0
var move_input := Vector2.ZERO        ## от джойстика: x вправо, y вперёд (вверх по экрану)
var target: STInteract = null
var inventory: Array = []
var stamina := 100.0
var invuln := 0.0
var _dodge_t := 0.0
var _dodge_dir := Vector2.ZERO
var _cool := 0.0


func _ready() -> void:
	faction = "crew"
	super._ready()
	Core.player = self
	Core.save.register("hero", self)


func _physics_process(delta: float) -> void:
	invuln = maxf(0.0, invuln - delta)
	_cool = maxf(0.0, _cool - delta)
	if state == "dead":
		return
	var inp := move_input
	if inp == Vector2.ZERO:
		inp = Vector2(Input.get_axis("ui_left", "ui_right"), Input.get_axis("ui_down", "ui_up"))
	var mag := minf(inp.length(), 1.0)
	# на экране «вперёд» — вверх, на земле — минус y
	var dir := Vector2(inp.x, -inp.y).normalized() if mag > 0.08 else Vector2.ZERO
	if state == "dodge":
		_dodge_t -= delta
		walk(_dodge_dir, lerpf(2.0, 7.0, clampf(_dodge_t / 0.35, 0.0, 1.0)), delta, 60.0)
		if _dodge_t <= 0.0:
			state = "move"
		return
	if state != "move":
		walk(Vector2.ZERO, 0.0, delta)
		return
	var sp := lerpf(0.6, WALK, mag / 0.45) if mag < 0.45 else lerpf(WALK, RUN, clampf((mag - 0.45) / 0.3, 0.0, 1.0))
	walk(dir, sp if mag > 0.08 else 0.0, delta)
	stamina = minf(100.0, stamina + 12.0 * delta)
	_pick_target()


func _pick_target() -> void:
	var best: STInteract = null
	var bd := 1e9
	for n in get_tree().get_nodes_in_group("interact"):
		var it := n as STInteract
		if it == null or not it.is_visible_in_tree() or not it.in_reach(global_position):
			continue
		var d := SP.dist_m(global_position, it.global_position)
		if d < bd:
			bd = d
			best = it
	target = best


func action_verb() -> String:
	return target.verb if target else ""


func do_interact() -> void:
	if state != "move" or target == null:
		return
	face(target.global_position)
	target.interact(self)


## «Огонь»: враг вплотную — удар, дальше (до 9 м, в поле зрения) — выстрел бластера с автоприцелом
func attack() -> void:
	if state != "move" or _cool > 0.0:
		return
	var foe: STActor = nearest_enemy(1.6)
	if foe == null:
		var far := nearest_enemy(BLASTER_RANGE, true)
		if far:
			_shoot(far)
			return
	_cool = 0.45
	if foe:
		face(foe.global_position)
	var d := spr.play("attack", true) if spr.has_clip("attack") else 0.35
	state = "busy"
	Core.play_at("swoosh", global_position, -8.0)
	get_tree().create_timer(d * 0.45).timeout.connect(func():
		if foe and foe.alive() and SP.dist_m(global_position, foe.global_position) < 1.7:
			foe.damage(20.0, global_position, self)
			Core.play_at("punch", foe.global_position, -2.0))
	get_tree().create_timer(maxf(d - 0.05, 0.2)).timeout.connect(func():
		if state == "busy":
			state = "move")


func _shoot(foe: STActor) -> void:
	_cool = 0.32
	face(foe.global_position)
	if spr.has_clip("shoot"):
		spr.play("shoot", true)
	var aim := foe.global_position + Vector2(randf_range(-6, 6), randf_range(-4, 4))
	STBolt.fire(get_parent(), global_position, aim, 18.0, BLASTER_DMG, "crew", Color(0.45, 1.0, 0.6), self)
	Core.play_at("blaster", global_position, -6.0)


## работа на месте (заварить, добыть): герой занят sec секунд, потом done
func work(sec: float, done: Callable) -> void:
	if state != "move":
		return
	state = "busy"
	velocity = Vector2.ZERO
	if spr.has_clip("attack"):
		spr.play("attack", true)
	Core.play_at("tool", global_position, -8.0)
	get_tree().create_timer(sec).timeout.connect(func():
		if state == "busy":
			state = "move"
			done.call())


## снова в строю (после гибели — в медотсеке)
func revive(at: Vector2, hp_v: float) -> void:
	state = "move"
	hp = hp_v
	collision_layer = 2
	global_position = at
	velocity = Vector2.ZERO
	reset_physics_interpolation()
	invuln = 2.0
	if spr:
		spr.play("idle", true)


func dodge() -> void:
	if state != "move" or stamina < 15.0:
		return
	stamina -= 18.0
	var d := Vector2(move_input.x, -move_input.y)
	if d.length() < 0.2:
		var f := SP.screen_to_ground(facing).normalized()
		d = -f
	_dodge_dir = d.normalized()
	_dodge_t = 0.35
	invuln = 0.35
	state = "dodge"
	Core.play_at("swoosh", global_position, -10.0)


func nearest_enemy(radius_m: float, need_los := false) -> STActor:
	var best: STActor = null
	var bd := radius_m
	var space := get_world_2d().direct_space_state
	for a in get_tree().get_nodes_in_group("actor"):
		var e := a as STActor
		if e == null or e == self or not e.alive() or e.faction == "crew":
			continue
		var d := SP.dist_m(global_position, e.global_position)
		if d < bd and need_los:
			var q := PhysicsRayQueryParameters2D.create(global_position + Vector2(0, -10), e.global_position + Vector2(0, -10), 1)
			if not space.intersect_ray(q).is_empty():
				continue
		if d < bd:
			bd = d
			best = e
	return best


var _hurt_t := 0.0


func damage(amount: float, from := Vector2.ZERO, attacker: Node = null) -> void:
	if invuln > 0.0 or state == "dead":
		return
	super.damage(amount, from, attacker)
	var now := Time.get_ticks_msec() / 1000.0
	if now - _hurt_t > 0.5:
		_hurt_t = now
		Core.play_at("hurt_hero", global_position, -8.0)


func inventory_add(id: String) -> void:
	inventory.append(id)


func count_item(id: String) -> int:
	return inventory.count(id)


func inventory_remove(id: String, n := 1) -> void:
	for i in n:
		inventory.erase(id)


func get_state() -> Dictionary:
	return {"pos": [global_position.x, global_position.y], "hp": hp, "inv": inventory}


func set_state(s: Dictionary) -> void:
	var p: Array = s.get("pos", [global_position.x, global_position.y])
	global_position = Vector2(p[0], p[1])
	reset_physics_interpolation()
	hp = s.get("hp", max_hp)
	inventory = s.get("inv", inventory)
