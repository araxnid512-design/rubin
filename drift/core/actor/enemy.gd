class_name STEnemy
extends STActor
## Противник StarCore: пират (бластер, держит дистанцию), робот охраны (медленный, бьёт клешнёй, крепкий),
## ползун (быстрый, кусает). Цель — ближайший живой из экипажа (герой, дроны, турели) в поле зрения. Ходит по
## маршруту корабля (AStarGrid2D), перед ударом в ближнем бою — замах с «!» (время увернуться).

const KINDS := {
	"pirate": {"hp": 60.0, "speed": 2.6, "ranged": true, "dmg": 6.0, "range": 7.0, "cool": 1.4, "color": Color(0.75, 0.25, 0.2), "loot": {"metal": [1, 2], "cells": [0, 1]}},
	"robot": {"hp": 110.0, "speed": 1.8, "ranged": false, "dmg": 15.0, "range": 1.3, "cool": 1.6, "color": Color(0.85, 0.75, 0.2), "loot": {"electronics": [1, 2], "metal": [1, 1]}},
	"crawler": {"hp": 30.0, "speed": 3.6, "ranged": false, "dmg": 7.0, "range": 1.0, "cool": 0.9, "color": Color(0.5, 0.75, 0.35), "loot": {}},
}
var kind := "pirate"
var k := {}
var tgt: Node2D = null
var _path := PackedVector2Array()
var _pi := 0
var _repath := 0.0
var _cool := 0.0
var _bang := false
var sight := 12.0
var goal := Vector2.INF           ## куда идти, если никого не видно (пираты — к реактору)
var _sab_said := false


func _ready() -> void:
	k = KINDS.get(kind, KINDS.pirate)
	faction = "robot" if kind == "robot" else ("beast" if kind == "crawler" else "pirate")
	max_hp = k.hp
	color = k.color
	super._ready()
	add_to_group("enemy")


func _physics_process(delta: float) -> void:
	if state == "dead":
		return
	_cool = maxf(0.0, _cool - delta)
	_repath -= delta
	if _repath <= 0.0:
		_repath = 0.5
		tgt = _find_target()
		if tgt:
			_path = Core.ship.path(global_position, tgt.global_position)
			_pi = 1
		elif goal != Vector2.INF:
			_path = Core.ship.path(global_position, goal)
			_pi = 1
	if tgt == null and goal != Vector2.INF and state == "move":
		if SP.dist_m(global_position, goal) < 1.6:
			_sabotage(delta)
			walk(Vector2.ZERO, 0.0, delta)
		else:
			_follow_path(delta)
		return
	if tgt == null or state != "move":
		walk(Vector2.ZERO, 0.0, delta)
		return
	var dm := SP.dist_m(global_position, tgt.global_position)
	var los := _los(tgt.global_position)
	if k.ranged and los and dm < k.range:
		# держит дистанцию и стреляет
		face(tgt.global_position)
		var back := SP.screen_to_ground(global_position - tgt.global_position).normalized() if dm < 2.0 else Vector2.ZERO
		walk(back, 1.2, delta)
		if _cool <= 0.0:
			_shoot()
		return
	if not k.ranged and dm < k.range:
		walk(Vector2.ZERO, 0.0, delta)
		if _cool <= 0.0:
			_melee()
		return
	_follow_path(delta)


## не толпиться в одной точке: свои расталкиваются
func walk(dir: Vector2, speed: float, delta: float, accel := 14.0) -> void:
	var sep := Vector2.ZERO
	for o in get_tree().get_nodes_in_group("enemy"):
		if o == self or not o.alive():
			continue
		var g := SP.screen_to_ground(global_position - o.global_position)
		var d := g.length() / SP.PPM
		if d < 0.55:
			sep += (g.normalized() if d > 0.01 else Vector2(randf_range(-1, 1), randf_range(-1, 1)).normalized()) * (0.55 - d) / 0.55
	var keep := facing
	var standing := speed < 0.5
	if sep != Vector2.ZERO:
		if standing:
			dir = sep.normalized()
			speed = 0.9
		else:
			dir = (dir + sep).normalized()
	super.walk(dir, speed, delta, accel)
	if standing and sep != Vector2.ZERO:
		facing = keep                     # отступая от своих, смотрит туда же, куда стрелял


func _follow_path(delta: float) -> void:
	if _pi >= _path.size():
		walk(Vector2.ZERO, 0.0, delta)
		return
	var goal: Vector2 = _path[_pi]
	var d := SP.screen_to_ground(goal - global_position)
	if d.length() < 18.0:
		_pi += 1
		return
	walk(d.normalized(), k.speed, delta)


## у цели (реактор): ломает — корпус теряет прочность
func _sabotage(delta: float) -> void:
	var ss = Core.get_meta("shipst", null)
	if ss:
		ss.damage_hull(2.5 * delta)
	if not _sab_said:
		_sab_said = true
		Core.say("Пираты ломают реактор! Корпус слабеет.", "bad")
		Core.play_at("alarm", global_position, -10.0)


func _find_target() -> Node2D:
	var best: Node2D = null
	var bd := sight
	for e in get_tree().get_nodes_in_group("hittable"):
		if e.faction != "crew" or not e.alive():
			continue
		var d := SP.dist_m(global_position, e.global_position)
		if d < bd:
			bd = d
			best = e
	return best


func _los(to: Vector2) -> bool:
	var q := PhysicsRayQueryParameters2D.create(global_position + Vector2(0, -10), to + Vector2(0, -10), 1)
	return get_world_2d().direct_space_state.intersect_ray(q).is_empty()


func _shoot() -> void:
	_cool = k.cool * randf_range(0.85, 1.2)
	if spr.has_clip("shoot"):
		spr.play("shoot", true)
	var from := global_position
	var aim := tgt.global_position + Vector2(randf_range(-34, 34), randf_range(-20, 20))
	STBolt.fire(get_parent(), from, aim, 14.0, k.dmg, faction, Color(1.0, 0.35, 0.25), self)
	Core.play_at("blaster_enemy", from, -6.0)


func _melee() -> void:
	_cool = k.cool
	state = "busy"
	_bang = true
	queue_redraw()
	face(tgt.global_position)
	var t := tgt
	get_tree().create_timer(0.45).timeout.connect(func():
		_bang = false
		queue_redraw()
		if state == "dead":
			return
		if spr.has_clip("attack"):
			spr.play("attack", true)
		if is_instance_valid(t) and t.alive() and SP.dist_m(global_position, t.global_position) < k.range + 0.3:
			t.damage(k.dmg, global_position, self)
			Core.play_at("punch", t.global_position, -4.0)
		state = "move")


func die() -> void:
	super.die()
	Core.play_at("death_enemy", global_position, -4.0)
	# добыча — сразу в ресурсы корабля
	var ss = Core.get_meta("shipst", null)
	if ss:
		var got := []
		for r in k.loot:
			var n := randi_range(int(k.loot[r][0]), int(k.loot[r][1]))
			if n > 0:
				ss.add(r, n)
				got.append("%s +%d" % [ss.res_name(r), n])
		if not got.is_empty():
			Core.say("Трофеи: " + ", ".join(got), "good")
	get_tree().create_timer(20.0).timeout.connect(queue_free)


func _draw() -> void:
	if _bang:
		draw_string(ThemeDB.fallback_font, Vector2(-8, -100), "!", HORIZONTAL_ALIGNMENT_CENTER, -1, 40, Color(1, 0.3, 0.2))
