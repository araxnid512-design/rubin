class_name Combat
extends RefCounted
## Стрельба (hitscan с разбросом, дробь, взрывы), шум выстрела, эффекты.

const MASK := 1 | 2 | 4 | 8 | 128

static func shoot(shooter: Actor, origin: Vector3, muzzle: Vector3, dir: Vector3, w: Dictionary, spread_mul: float) -> void:
	var space := shooter.get_world_3d().direct_space_state
	var pellets := int(w.get("pellets", 1))
	var spread := deg_to_rad(float(w.spread)) * spread_mul
	var rng_v: float = w.range
	var fx: Node = Game.world.fx if Game.world else null
	for i in pellets:
		var d := dir
		if spread > 0.0:
			var basis := Basis.looking_at(dir, Vector3.UP if absf(dir.y) < 0.99 else Vector3.RIGHT)
			var a := randf() * TAU
			var r := sqrt(randf()) * spread
			d = (basis * Vector3(cos(a) * sin(r), sin(a) * sin(r), -cos(r))).normalized()
		var to := origin + d * rng_v
		var q := PhysicsRayQueryParameters3D.create(origin, to, MASK)
		q.exclude = [shooter.get_rid()]
		var hit := space.intersect_ray(q)
		var end := to
		if not hit.is_empty():
			end = hit.position
			var col: Object = hit.collider
			var dist := origin.distance_to(end)
			var falloff := clampf(1.2 - dist / rng_v * 0.6, 0.5, 1.0)
			if col is Actor:
				var a := col as Actor
				if a.alive:
					a.take_damage(float(w.dmg) * falloff, shooter, end, d)
			elif fx:
				fx.impact(end, hit.normal)
			if w.has("explosive"):
				explode(shooter, end, float(w.explosive), float(w.dmg))
		if fx and (i == 0 or randf() < 0.4):
			fx.tracer(muzzle, end)
	if fx:
		fx.muzzle_flash(muzzle, dir, float(w.get("noise", 40.0)) < 20.0)
	Sfx.play_at(String(w.get("sound", "shot_rifle")), muzzle, 0.0 if shooter == Game.player else -3.0)
	Events.noise.emit(shooter.global_position, float(w.get("noise", 40.0)), shooter)

static func explode(source: Actor, pos: Vector3, radius: float, dmg: float) -> void:
	for a in source.get_tree().get_nodes_in_group("actors"):
		var actor := a as Actor
		if actor == null or not actor.alive:
			continue
		var d := actor.center_pos().distance_to(pos)
		if d < radius:
			actor.take_damage(dmg * (1.0 - d / radius) * 0.9, source, actor.center_pos(), (actor.center_pos() - pos).normalized())
	if Game.world and Game.world.fx:
		Game.world.fx.explosion(pos)
	Sfx.play_at("explosion", pos, 4.0)
	Events.noise.emit(pos, 80.0, source)

static func is_ally_in_line(shooter: Actor, target_pos: Vector3) -> bool:
	## Не стрелять, если на линии огня союзник.
	var q := PhysicsRayQueryParameters3D.create(shooter.center_pos() + Vector3(0, 0.25, 0), target_pos, 2 | 4 | 8)
	q.exclude = [shooter.get_rid()]
	var hit := shooter.get_world_3d().direct_space_state.intersect_ray(q)
	if hit.is_empty():
		return false
	var c: Object = hit.collider
	return c is Actor and not shooter.is_hostile(c as Actor) and c != shooter
