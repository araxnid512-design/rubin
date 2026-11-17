class_name ULMur
extends ULEnemy
## Вооружённый мур (data/enemies.json: виды с «gun»): тело и движения — как у героя (тот же скелет Tripo, клипы
## героя, хват оружия BCWeaponHold: обе руки на оружии, стойки «наготове» и «в прицел»). Живёт так:
##   стоит / бродит / ходит дозором (patrol — по точкам маршрута) → заметил героя (увидел, услышал выстрел, бег,
##   шаги) → вскидывает оружие (alert_s) → бой (state «chase»):
##   • видит и достаёт — встаёт, целится (aim_s) и стреляет: автомат — короткими очередями (burst), дробовик —
##     одним выстрелом и передёргивает цевьё, пистолет главаря — одиночными; между очередями перебегает в укрытие
##     (точка рядом, откуда героя не видно на уровне груди — стена, ящики, техника, мебель) или шагает вбок;
##   • магазин пуст — перезаряжается (в укрытии, если оно рядом); дробовик заряжает по патрону;
##   • не видит — идёт туда, где видел, но не дальше pursue_r от своего места; потерял — возвращается и ждёт;
##   • дробовик подбирается ближе от укрытия к укрытию и заходит сбоку (flank), стреляет только вблизи;
##   • главарь держит дистанцию (keep), ходит боком, отступает, если подойти ближе retreat, из своего штаба (area)
##     не выходит; раз в special.cd — «прицельный выстрел»: замирает и целится, на полу от него вдоль прицела горит
##     красная полоса (до первой стены); через aim_s направление застывает, ещё lock_s — и выстрел по полосе:
##     герой на полосе (и не за стеной) — dmg_pct здоровья, ушёл — мимо; потом recovery rec_s.
## Попадание считает мир (сигнал shoot: лучи от дульного среза, стены и укрытия останавливают пули). Точность —
## не 100 %: шанс попасть падает с расстоянием (acc → acc_far на дальности range), промах уходит мимо героя.

signal shoot(from: Vector3, dirs: Array, dmg: float, info: Dictionary)
signal special_hit(from: Vector3, dir: Vector3, length: float, width: float, dmg: float)

var gun := {}
var mag := 0
var patrol := PackedVector3Array()
var sniper := false
var boss := false
var area := Rect2()                 ## главарь: откуда не выходит (план, мир x–z)
var shots := 0                      ## для проверок: выстрелов, очередей, перезарядок, укрытий, прицельных
var bursts := 0
var reloads := 0
var covers := 0
var specials := 0
var phase := ""                     ## в бою: move, aim, fire, pause, reload; главарь: sp_aim, sp_lock, sp_rec
var hp_bar: Node3D
var line: MeshInstance3D
var _pi := 0
var _pt := 0.0
var _burst := 0
var _shot_t := 0.0
var _cover := Vector3.INF
var _cover_t := 0.0
var _side := 1.0
var _side_t := 0.0
var _sp_cd := 4.0
var _sp_dir := Vector3.ZERO
var _sp_len := 0.0
var _move_dir := Vector3.ZERO
var _face_dir := Vector3.ZERO
var _bar_fill: MeshInstance3D
var _hp_shown := 1.0
var _reload_n := 0
var crouch := 0.0                   ## присел за низким укрытием (0..1)
var _hide_t := 0.0                  ## сколько уже сидит в укрытии


func setup(k: String, at: Vector3, seed_n: int) -> void:
	super.setup(k, at, seed_n)
	gun = def.get("gun", {})
	boss = bool(def.get("boss", false))
	mag = int(gun.get("mag", 30))
	if rig.hold != null:
		rig.hold.draw_rate = 2.0
		rig.hold.reload_rate = 1.3
		rig.hold.equip(String(gun.get("weapon", "rifle")), true)
		rig.hold.set_stance("ready")
	rig.set_pose("armed_idle")
	_sp_cd = float(def.get("special", {}).get("cd", 10.0)) * 0.5
	if boss:
		_make_bar()


func _calm() -> bool:
	return state == "idle" or state == "wander" or state == "patrol"


func _notice(at: Vector3) -> void:
	_last = at
	_unseen = 0.0
	state = "alert"
	_t = float(def.get("alert_s", 0.5))
	if rig.hold != null:
		rig.hold.set_stance("aim")
	noise.emit("mur_alert", global_position)


## услышал выстрел — дальше обычного (оружие слышно далеко), снайпер на вышке — тоже
func hear(p: Vector3) -> void:
	if alive() and _calm() and global_position.distance_to(p) < float(def.hear):
		_notice(p)


func damage(d: float, from := Vector3.INF) -> void:
	var was := alive()
	super.damage(d, from)
	if was and not alive():
		_line_off()
		if hp_bar != null:
			hp_bar.visible = false
		if rig.hold != null:
			rig.hold.set_stance("ready")
	elif alive() and state == "chase" and phase == "pause":
		_pt = minf(_pt, 0.25)                          # попали — быстрее отвечает


# ---------------- кадр ----------------

func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	_hero_p = p
	if state == "dead":
		dead_t += delta
		if _twist != INF and dead_t < 0.45:
			rotation.y = lerp_angle(rotation.y, _twist, 1.0 - exp(-delta * 9.0))
		return
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	_sp_cd = maxf(0.0, _sp_cd - delta)
	var speed := 0.0
	_move_dir = Vector3.ZERO
	_face_dir = Vector3.ZERO
	match state:
		"idle", "wander", "patrol":
			if hero_alive and can_see and dist < float(def.see) * (1.3 if sniper else 1.0):
				_notice(p)
			else:
				speed = _calm_tick(delta)
		"alert":
			_face_dir = _last - global_position
			if can_see:
				_last = p
			_t -= delta
			if _t <= 0.0:
				state = "chase"
				phase = "aim"
				_pt = float(gun.get("aim_s", 0.3))
		"chase":
			speed = _combat(delta, p, to, dist, can_see, hero_alive)
	_bar_tick(delta, p)
	# поворот и шаг: в бою идёт, глядя на героя (боком, спиной вперёд) — клипы шага в любую сторону
	if _face_dir.length() > 0.05:
		_face(_face_dir, delta, 8.0 if state == "chase" else 5.0)
	var mv := _move_dir if _move_dir.length() > 0.05 else Vector3(sin(rotation.y), 0, cos(rotation.y))
	mv = mv.normalized()
	if speed > 0.05 and _move_dir.length() > 0.05:
		mv = _steer(mv, delta)
	velocity = Vector3(mv.x * speed * step_k, velocity.y - 9.8 * delta, mv.z * speed * step_k)
	move_and_slide()
	velocity.x /= step_k
	velocity.z /= step_k
	if is_on_floor():
		velocity.y = 0.0
	if boss and area.size.x > 0.0 and not area.has_point(Vector2(global_position.x, global_position.z)):
		# главарь из штаба не выходит: у границы — назад
		var c := area.get_center()
		global_position.x = clampf(global_position.x, area.position.x, area.end.x)
		global_position.z = clampf(global_position.z, area.position.y, area.end.y)
		_cover = Vector3.INF
		_move_dir = Vector3(c.x - global_position.x, 0, c.y - global_position.z)
	var real := Vector3(velocity.x, 0, velocity.z).length()
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var left := Vector3(cos(rotation.y), 0, -sin(rotation.y))
	var hv := Vector3(velocity.x, 0, velocity.z)
	var local := Vector2(hv.dot(left), hv.dot(fwd))
	rig.set_dir_move(local.normalized() if real > 0.2 and state == "chase" else Vector2.ZERO, real, delta)
	# в укрытии (дошёл до него и ждёт или перезаряжается) — присел; выглядывает и стреляет — стоя
	var in_cover := state == "chase" and _cover != Vector3.INF and _cover.distance_to(global_position) < 0.7 and (phase == "pause" or phase == "reload")
	crouch = move_toward(crouch, 1.0 if in_cover else 0.0, delta * 4.0)
	rig.set_motion(real, crouch, delta)


## спокойный: стоит, бродит у своего места или идёт дозором по маршруту
func _calm_tick(delta: float) -> float:
	if not patrol.is_empty():
		state = "patrol"
		var g := patrol[_pi % patrol.size()] - global_position
		g.y = 0.0
		if g.length() < 1.0:
			_pi += 1
			_t = _rng.randf_range(0.5, 2.0)
		if _t > 0.0:
			_t -= delta
			return 0.0
		_move_dir = _nav_dir(patrol[_pi % patrol.size()], delta)
		_face_dir = _move_dir
		return float(def.walk)
	_t -= delta
	if sniper:
		# снайпер на вышке озирается, не сходя с места
		if _t <= 0.0:
			_t = _rng.randf_range(2.5, 5.0)
			_goal = global_position + Vector3(sin(_rng.randf() * TAU), 0, cos(_rng.randf() * TAU))
		_face_dir = _goal - global_position
		return 0.0
	if state == "wander":
		var g := _goal - global_position
		g.y = 0.0
		if g.length() < 0.4 or _t <= 0.0:
			state = "idle"
			_t = _rng.randf_range(2.0, 5.0)
			return 0.0
		_move_dir = g
		_face_dir = g
		return float(def.walk)
	if _t <= 0.0 and wander_r > 0.05:
		state = "wander"
		_goal = home + Vector3(_rng.randf_range(-wander_r, wander_r), 0, _rng.randf_range(-wander_r, wander_r))
		_t = 6.0
	elif _t <= 0.0:
		_t = _rng.randf_range(3.0, 7.0)
	return 0.0


# ---------------- бой ----------------

func _combat(delta: float, p: Vector3, to: Vector3, dist: float, can_see: bool, hero_alive: bool) -> float:
	var sp := _combat_inner(delta, p, to, dist, can_see, hero_alive)
	# главарь: герой ближе retreat — пятится от него (стреляя на ходу), кроме прицельного выстрела
	if boss and state == "chase" and not phase.begins_with("sp_") and dist < float(gun.get("retreat", 5.0)) and dist > 0.01:
		var away := -to.normalized()
		_move_dir = away + Vector3(-away.z, 0, away.x) * _side * 0.35
		_face_dir = to
		return maxf(sp, float(def.walk) * 1.6)
	return sp


func _combat_inner(delta: float, p: Vector3, to: Vector3, dist: float, can_see: bool, hero_alive: bool) -> float:
	if can_see:
		_last = p
		_unseen = 0.0
	else:
		_unseen += delta
	if not hero_alive:
		_line_off()
		state = "idle"
		phase = ""
		_t = 3.0
		if rig.hold != null:
			rig.hold.set_stance("ready")
		return 0.0
	var rng_g := float(gun.get("range", 25.0))
	var keep: Array = gun.get("keep", [6, 18])
	_face_dir = to
	_cover_t = maxf(0.0, _cover_t - delta)
	_side_t -= delta
	# главарь: прицельный выстрел
	if phase.begins_with("sp_"):
		return _special_tick(delta, p, can_see)
	if boss and def.has("special") and _sp_cd <= 0.0 and can_see and dist >= float(def.special.get("from", 4.0)) and dist <= float(def.special.get("to", 20.0)) and phase != "reload":
		_special_start(p)
		return 0.0
	match phase:
		"reload":
			_pt -= delta
			if _pt < -2.5:
				_cover = Vector3.INF                   # до укрытия не дойти — перезаряжается на месте
			if _cover != Vector3.INF and _cover.distance_to(global_position) > 0.5:
				_move_dir = _nav_dir(_cover, delta)
				return float(def.run) * 0.8
			if _pt <= 0.0:
				if bool(gun.get("reload_shell", false)):
					mag += 1
					_reload_n -= 1
					if mag < int(gun.mag) and _reload_n > 0 and not (can_see and dist < rng_g * 0.7 and mag >= 2):
						_pt = float(gun.reload_s)
						rig.hold.reload()
						return 0.0
				else:
					mag = int(gun.mag)
				phase = "aim" if can_see else "move"
				_pt = float(gun.get("aim_s", 0.3))
			return 0.0
		"aim":
			# встал, вскинул, ведёт ствол за героем
			rig.hold.set_stance("aim")
			if not can_see or dist > rng_g:
				phase = "move"
				return 0.0
			_pt -= delta
			if _pt <= 0.0:
				phase = "fire"
				var b: Array = gun.get("burst", [1, 1])
				_burst = mini(_rng.randi_range(int(b[0]), int(b[1])), mag)
				_shot_t = 0.0
				bursts += 1
			return 0.0
		"fire":
			_shot_t -= delta
			if _shot_t <= 0.0:
				if mag <= 0:
					_start_reload()
					return 0.0
				_fire(p, dist)
				_burst -= 1
				_shot_t = 1.0 / float(gun.get("rate", 8.0))
				if _burst <= 0 or not can_see:
					phase = "pause"
					var ps: Array = gun.get("pause", [0.8, 1.4])
					_pt = _rng.randf_range(float(ps[0]), float(ps[1]))
					if mag <= 0:
						_start_reload()
					elif bool(gun.get("cover", false)) and _rng.randf() < 0.55:
						_find_cover(p, dist)
			return 0.0
		"pause":
			# между очередями: в укрытие, вбок или ближе/дальше — к своей дистанции
			_pt -= delta
			if _pt < -3.5:
				_cover = Vector3.INF                   # до укрытия не дойти — стреляет оттуда, где стоит
			var sp := _reposition(delta, p, to, dist, keep, can_see)
			var at_cover := _cover != Vector3.INF and _cover.distance_to(global_position) < 0.6
			_hide_t = _hide_t + delta if at_cover else 0.0
			# дошёл до укрытия — сидит за ним хотя бы секунду, потом выглядывает
			if _pt <= 0.0 and (_cover == Vector3.INF or (at_cover and _hide_t >= float(gun.get("hide_s", 1.0)))):
				phase = "aim" if can_see and dist <= rng_g else "move"
				_pt = float(gun.get("aim_s", 0.3)) * (0.6 if _cover != Vector3.INF else 1.0)
				if _cover != Vector3.INF and _cover.distance_to(global_position) < 0.6:
					# из укрытия — шаг в сторону, чтобы выглянуть
					_cover = Vector3.INF
			return sp
		_:
			# move: подойти на дистанцию стрельбы / туда, где видел; дальше pursue_r от своего места не гонится
			phase = "move"
			rig.hold.set_stance("ready")
			if can_see and dist <= rng_g * (0.9 if not gun.has("pellets") else 0.75):
				phase = "aim"
				_pt = float(gun.get("aim_s", 0.3))
				return 0.0
			var pursue := float(gun.get("pursue_r", 28.0))
			var tgt := _last
			if sniper:
				return 0.0
			if not boss and Vector2(tgt.x - home.x, tgt.z - home.z).length() > pursue:
				var back := home + (tgt - home).normalized() * pursue
				tgt = back
			if boss and area.size.x > 0.0:
				tgt.x = clampf(tgt.x, area.position.x + 0.6, area.end.x - 0.6)
				tgt.z = clampf(tgt.z, area.position.y + 0.6, area.end.y - 0.6)
			var tl := tgt - global_position
			tl.y = 0.0
			if tl.length() < 0.7:
				if _unseen > float(def.get("lose_s", 5.0)):
					state = "idle"
					phase = ""
					_t = 2.0
					home = global_position if not boss else home
					rig.hold.set_stance("ready")
				return 0.0
			if gun.get("flank", false) and can_see and dist > 6.0:
				# заходит сбоку: цель — точка в стороне от прямой на героя
				var side := Vector3(-to.z, 0, to.x).normalized() * _side * 4.0
				tgt = _hero_p + side - to.normalized() * 3.0
			_move_dir = _nav_dir(tgt, delta)
			_face_dir = _move_dir if not can_see else to
			return float(def.run)


## между очередями: в укрытие, если нашлось; иначе — шаг вбок, держит свою дистанцию (keep); главарь отступает
func _reposition(delta: float, p: Vector3, to: Vector3, dist: float, keep: Array, can_see: bool) -> float:
	if sniper:
		return 0.0                                     # снайпер с вышки не сходит
	if _cover != Vector3.INF:
		var c := _cover - global_position
		c.y = 0.0
		if c.length() > 0.5:
			_move_dir = _nav_dir(_cover, delta)
			return float(def.run) * 0.9
		return 0.0
	if _side_t <= 0.0:
		_side = -_side if _rng.randf() < 0.6 else _side
		_side_t = _rng.randf_range(0.8, 1.6)
	var dirn := to.normalized() if dist > 0.01 else Vector3.FORWARD
	var lat := Vector3(-dirn.z, 0, dirn.x) * _side
	var radial := 0.0
	if dist < float(keep[0]):
		radial = -1.0
	elif dist > float(keep[1]):
		radial = 1.0
	if boss and dist < float(gun.get("retreat", 5.0)):
		radial = -1.6                                  # подошли вплотную — главарь отступает
	var mv := lat + dirn * radial
	_move_dir = mv
	return float(def.walk) * (1.5 if radial < -1.0 else 1.1)


## Укрытие: из 14 точек вокруг (2–7 м, на карте проходимости) — где луч от груди героя до груди мура упирается в
## препятствие (стена, ящики, техника), а до героя по-прежнему в пределах выстрела; ближе — лучше. Дробовик ищет
## укрытие ближе к герою.
func _find_cover(p: Vector3, dist: float) -> void:
	if _cover_t > 0.0 or sniper or not is_inside_tree():
		return
	_cover_t = 2.5
	var map := get_world_3d().navigation_map
	if NavigationServer3D.map_get_iteration_id(map) <= 0:
		return
	var space := get_world_3d().direct_space_state
	var best := Vector3.INF
	var bs := 1e9
	var shot := gun.has("pellets")
	for k in 14:
		var a := TAU * k / 14.0 + _rng.randf() * 0.3
		var r := _rng.randf_range(2.0, 7.0)
		var cand := global_position + Vector3(cos(a), 0, sin(a)) * r
		cand = NavigationServer3D.map_get_closest_point(map, cand)
		if absf(cand.y - global_position.y) > 0.6:
			continue
		if boss and area.size.x > 0.0 and not area.grow(-0.5).has_point(Vector2(cand.x, cand.z)):
			continue
		var dp := Vector2(cand.x - p.x, cand.z - p.z).length()
		if dp > float(gun.get("range", 25.0)) * 0.95 or dp < 2.5:
			continue
		# сидя (грудь ~0,8 м) за ящиками, мешками, бочками, техникой, стеной
		var q := PhysicsRayQueryParameters3D.create(p + Vector3.UP * 1.3, cand + Vector3.UP * 0.8)
		var ex: Array[RID] = [get_rid()]
		ex.append_array(exclude)
		q.exclude = ex
		q.collision_mask = 1
		var hit := space.intersect_ray(q)
		if hit.is_empty() or hit.collider is CharacterBody3D:
			continue
		# препятствие рядом с точкой (за ним и прячется), а не где-то посреди двора
		if (hit.position as Vector3).distance_to(cand) > maxf(2.2, dp * 0.35):
			continue
		var score := cand.distance_to(global_position) + (dp * 0.6 if shot else 0.0)
		if score < bs:
			bs = score
			best = cand
	if best != Vector3.INF:
		_cover = best
		covers += 1


func _start_reload() -> void:
	phase = "reload"
	reloads += 1
	if bool(gun.get("reload_shell", false)):
		_reload_n = int(gun.mag) - mag
		_pt = float(gun.reload_s)
	else:
		_pt = float(gun.reload_s)
	if rig.hold != null:
		rig.hold.set_stance("ready")
		rig.hold.reload()
	if bool(gun.get("cover", false)) and _cover == Vector3.INF:
		_find_cover(_hero_p, global_position.distance_to(_hero_p))
	noise.emit("mur_reload", global_position)


## выстрел: шанс попасть падает с расстоянием; промах — ствол уводит мимо героя (пуля видна, ложится рядом)
func _fire(p: Vector3, dist: float) -> void:
	mag -= 1
	shots += 1
	rig.hold.fire()
	var mz := rig.hold.muzzle_world() if rig.hold != null else []
	var from: Vector3 = mz[0] if not mz.is_empty() else global_position + Vector3.UP * 1.4
	var rng_g := float(gun.get("range", 25.0))
	var acc := lerpf(float(gun.get("acc", 0.6)), float(gun.get("acc_far", 0.3)), clampf(dist / rng_g, 0.0, 1.0))
	var tgt := p + Vector3.UP * 1.15
	var dirs: Array = []
	var pellets := int(gun.get("pellets", 1))
	var spread := deg_to_rad(float(gun.get("spread", 2.0)))
	if pellets > 1:
		# дробь: каждая дробина — свой луч с разбросом вокруг направления на героя
		var base := (tgt - from).normalized()
		for i in pellets:
			dirs.append((base + Vector3(_rng.randf_range(-1, 1), _rng.randf_range(-0.4, 0.4), _rng.randf_range(-1, 1)) * tan(spread)).normalized())
	else:
		var aim := tgt
		if _rng.randf() > acc:
			# мимо: в сторону и чуть выше/ниже героя
			var side := Vector3(-(p - from).z, 0, (p - from).x).normalized()
			aim += side * _rng.randf_range(0.7, 1.4) * (1.0 if _rng.randf() < 0.5 else -1.0) + Vector3.UP * _rng.randf_range(-0.5, 0.6)
		else:
			aim += Vector3(_rng.randf_range(-0.12, 0.12), _rng.randf_range(-0.15, 0.15), _rng.randf_range(-0.12, 0.12))
		dirs.append(((aim - from).normalized() + Vector3(_rng.randf_range(-1, 1), _rng.randf_range(-1, 1), _rng.randf_range(-1, 1)) * tan(spread) * 0.25).normalized())
	var dmg := float(gun.get("dmg", 0.0))
	if gun.has("dmg_pct"):
		dmg = -float(gun.dmg_pct)                     # мир переводит долю здоровья героя в урон
	shoot.emit(from, dirs, dmg, {"range": rng_g + 6.0, "near": float(gun.get("near", 0.0)), "far_k": float(gun.get("far_k", 1.0)),
		"sound": String(gun.get("sound", "shot_ak")), "db": float(gun.get("db", 0.0)), "tracer": String(gun.get("tracer", "a545")), "pellets": pellets})


# ---------------- прицельный выстрел главаря ----------------

func _special_start(p: Vector3) -> void:
	phase = "sp_aim"
	_pt = float(def.special.get("aim_s", 1.2))
	specials += 1
	rig.hold.set_stance("aim")
	_sp_dir = (p - global_position)
	_sp_dir.y = 0.0
	_sp_dir = _sp_dir.normalized()
	_line_on()
	noise.emit("boss_aim", global_position)


func _special_tick(delta: float, p: Vector3, can_see: bool) -> float:
	var sp: Dictionary = def.special
	_pt -= delta
	match phase:
		"sp_aim":
			# целится: полоса идёт за героем
			var d := p - global_position
			d.y = 0.0
			if d.length() > 0.1:
				_sp_dir = _sp_dir.slerp(d.normalized(), 1.0 - exp(-delta * 7.0)).normalized()
			_face_dir = _sp_dir
			_line_update(false)
			if _pt <= 0.0:
				phase = "sp_lock"
				_pt = float(sp.get("lock_s", 0.35))
		"sp_lock":
			# направление застыло — полоса ярче, герою пора уходить
			_face_dir = _sp_dir
			_line_update(true)
			if _pt <= 0.0:
				var from := global_position + Vector3.UP * 1.35
				var mz := rig.hold.muzzle_world()
				if not mz.is_empty():
					from = mz[0]
				rig.hold.fire()
				shots += 1
				special_hit.emit(Vector3(global_position.x, from.y, global_position.z), _sp_dir, _sp_len, float(sp.get("width", 0.7)), float(sp.get("dmg_pct", 0.333)))
				_line_off()
				phase = "sp_rec"
				_pt = float(sp.get("rec_s", 0.8))
		"sp_rec":
			_face_dir = _sp_dir
			if _pt <= 0.0:
				_sp_cd = float(sp.get("cd", 10.0))
				phase = "pause"
				_pt = 0.3
				rig.hold.set_stance("ready")
	return 0.0


func _line_on() -> void:
	if line == null:
		line = MeshInstance3D.new()
		line.name = "BossAimLine"
		var qm := QuadMesh.new()
		qm.size = Vector2(1, 1)
		qm.orientation = PlaneMesh.FACE_Y
		line.mesh = qm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = Color(1.0, 0.08, 0.05, 0.55)
		m.cull_mode = BaseMaterial3D.CULL_DISABLED
		m.no_depth_test = true                         # полоса видна целиком; сквозь стены не идёт — её длина обрезана у стены
		m.render_priority = 2
		line.material_override = m
		line.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		line.layers = 1 | 2                           # и в помещениях (слой внутренностей)
		line.top_level = true
		add_child(line)
	line.visible = true
	_line_update(false)


## полоса от главаря вдоль прицела до первой стены (не дальше special.len): на полу, чуть выше его ног
func _line_update(locked: bool) -> void:
	if line == null:
		return
	var sp: Dictionary = def.special
	var max_l := float(sp.get("len", 30.0))
	var from := global_position + Vector3.UP * 1.2
	var l := max_l
	if is_inside_tree():
		var q := PhysicsRayQueryParameters3D.create(from, from + _sp_dir * max_l)
		var ex: Array[RID] = [get_rid()]
		ex.append_array(exclude)
		q.exclude = ex
		q.collision_mask = 1
		var hit := get_world_3d().direct_space_state.intersect_ray(q)
		if not hit.is_empty():
			l = from.distance_to(hit.position)
	_sp_len = l
	var wdt := float(sp.get("width", 0.7))
	var c := global_position + _sp_dir * (l * 0.5) + Vector3.UP * 0.06
	# поворот по прицелу, растяжка — в своих осях полосы (ширина × длина), иначе тянется по мировой оси
	line.global_transform = Transform3D(Basis(Vector3.UP, atan2(_sp_dir.x, _sp_dir.z)) * Basis.from_scale(Vector3(wdt, 1.0, l)), c)
	var m := line.material_override as StandardMaterial3D
	var pulse := 0.5 + 0.5 * sin(Time.get_ticks_msec() * 0.03)
	m.albedo_color = Color(1.0, 0.1, 0.05, 0.85 if locked else 0.45 + pulse * 0.2)


func _line_off() -> void:
	if line != null:
		line.visible = false


func line_shown() -> bool:
	return line != null and line.visible


# ---------------- полоса здоровья главаря ----------------

func _make_bar() -> void:
	hp_bar = Node3D.new()
	hp_bar.name = "BossBar"
	add_child(hp_bar)
	hp_bar.position = Vector3(0, float(def.get("height", 1.9)) + 0.45, 0)
	var mk := func(col: Color, w: float, h: float, pr: int) -> MeshInstance3D:
		var mi := MeshInstance3D.new()
		var qm := QuadMesh.new()
		qm.size = Vector2(w, h)
		mi.mesh = qm
		var m := StandardMaterial3D.new()
		m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		m.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
		m.billboard_keep_scale = true                  # полоса убывает — масштаб по ширине
		m.no_depth_test = true
		m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		m.albedo_color = col
		m.render_priority = pr
		mi.material_override = m
		mi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		mi.layers = 1 | 2
		return mi
	hp_bar.add_child(mk.call(Color(0.05, 0.05, 0.05, 0.8), 1.24, 0.16, 3))
	_bar_fill = mk.call(Color(0.86, 0.12, 0.1, 0.95), 1.2, 0.12, 4)
	hp_bar.add_child(_bar_fill)
	var lb := Label3D.new()
	lb.text = String(def.n)
	lb.font_size = 40
	lb.pixel_size = 0.004
	lb.outline_size = 10
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.no_depth_test = true
	lb.render_priority = 5
	lb.position = Vector3(0, 0.2, 0)
	lb.modulate = Color(1.0, 0.86, 0.8)
	lb.layers = 1 | 2
	hp_bar.add_child(lb)
	hp_bar.visible = false


func _bar_tick(delta: float, p: Vector3) -> void:
	if hp_bar == null:
		return
	var on := alive() and (state == "chase" or state == "alert" or hp < float(def.hp)) and global_position.distance_to(p) < 30.0
	hp_bar.visible = on
	if not on:
		return
	var k := clampf(hp / float(def.hp), 0.0, 1.0)
	_hp_shown = move_toward(_hp_shown, k, delta * 1.5)
	# полоса убывает влево: сдвиг середины на половину потери (в плоскости экрана — вдоль «вправо» камеры)
	_bar_fill.scale = Vector3(maxf(_hp_shown, 0.001), 1, 1)
	var cam := get_viewport().get_camera_3d()
	var rt := cam.global_transform.basis.x if cam != null else Vector3.RIGHT
	_bar_fill.global_position = hp_bar.global_position - rt * (1.0 - _hp_shown) * 0.6 + (cam.global_transform.basis.z * 0.01 if cam != null else Vector3.ZERO)
