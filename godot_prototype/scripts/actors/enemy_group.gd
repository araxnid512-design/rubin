class_name EnemyGroup
extends Node3D
## Группа противников с зоной обитания. Спит, пока генерал далеко (упрощённая симуляция),
## возрождается через двое суток игрового времени, если генерал далеко.

var gdef := {}
var members: Array[Enemy] = []
var _t := 0.0
const WAKE_DIST := 85.0
const RESPAWN_HOURS := 48.0

func setup(d: Dictionary) -> void:
	gdef = d
	name = String(d.id)
	position = Vector3.ZERO

func _ready() -> void:
	_spawn()

func _dead_list() -> Dictionary:
	var ws: Dictionary = Game.world_state.dead
	if not ws.has(gdef.id):
		ws[gdef.id] = {}
	return ws[gdef.id]

func _spawn() -> void:
	var dead := _dead_list()
	var center: Vector3 = gdef.pos
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(gdef.id)
	for i in int(gdef.count):
		var p := center + Vector3(rng.randf_range(-gdef.r, gdef.r) * 0.6, 0, rng.randf_range(-gdef.r, gdef.r) * 0.6)
		if dead.has(str(i)):
			continue
		var e := Enemy.new()
		e.kind = gdef.kind
		e.member_idx = i
		e.group = self
		e.home = center
		e.leash = float(gdef.leash)
		e.wander_r = float(gdef.r)
		e.position = p
		e.name = "%s_%d" % [gdef.id, i]
		add_child(e)
		members.append(e)

func alert_all(target: Actor) -> void:
	for m in members:
		if is_instance_valid(m) and m.alive:
			m.alert_to(target)

func on_member_died(e: Enemy) -> void:
	_dead_list()[str(e.member_idx)] = Game.day * 24.0 + Game.time_of_day
	Events.area_visited.emit("killed_" + String(gdef.kind))

func alive_count() -> int:
	var c := 0
	for m in members:
		if is_instance_valid(m) and m.alive:
			c += 1
	return c

func _physics_process(delta: float) -> void:
	_t -= delta
	if _t > 0.0:
		return
	_t = 1.0
	if Game.player == null:
		return
	var d: float = Game.player.global_position.distance_to(gdef.pos)
	var wake: bool = d < WAKE_DIST
	for m in members:
		if is_instance_valid(m) and m.alive:
			m.set_dormant(not wake)
	# возрождение
	if d > 120.0:
		var dead := _dead_list()
		var now := Game.day * 24.0 + Game.time_of_day
		var revive := []
		for k in dead:
			if now - float(dead[k]) > RESPAWN_HOURS:
				revive.append(k)
		if not revive.is_empty():
			for k in revive:
				dead.erase(k)
			for m in members:
				if is_instance_valid(m):
					m.queue_free()
			members.clear()
			_spawn()
