class_name ULElite
extends ULEnemy
## Элита — мини-босс локаций 3-го уровня опасности (задание пользователя 26.11): огромный четвероногий мутант,
## 3 м в высоту и 5 м в длину. Модель — Tripo, скелет, веса и шесть движений — tools/elite_build.gd
## (assets/models/elite.scn): elite_idle, elite_walk, elite_run, elite_bite_attack, elite_claw_attack (+ одиночные
## удары elite_claw_r / elite_claw_l), elite_death. Числа — data/elite.json (предложение, правится без кода).
##
## Поведение: спокойствие (стоит, дышит, осматривается) → патруль шагом по своей открытой площадке → заметил
## (поворачивает голову, разворачивается, рычит) → преследование галопом по карте проходимости, только там, где
## проходит тело шириной 2 × nav_r → атака: укус пастью, удар правой или левой лапой, иногда два удара подряд.
## Урон — только в миг смыкания челюстей или удара лапы (метка-событие в самом движении), один раз за взмах и
## только если герой там и между ними нет стены. Куда не пролезть (в здание, между контейнерами) — ждёт у прохода,
## следит за героем, потом уходит патрулировать. Гибель — тяжёлое падение, тело лежит, как у всех (CORPSE_S),
## обыск — та же добыча, что разыграна при появлении (повторный обыск новой не создаёт).

const CFG := "res://data/elite.json"
const SCENE := "res://assets/models/elite.scn"
## как называются состояния дерева движений и их движения
const ST := {"Idle": "elite_idle", "Walk": "elite_walk", "Run": "elite_run", "BiteAttack": "elite_bite_attack", "ClawAttack": "elite_claw_attack", "Death": "elite_death"}
## скорость, на которой записаны шаг и галоп (м/с): движение проигрывается быстрее или медленнее под настоящую
## скорость — лапы не скользят. Пишет tools/elite_build.gd (метаданные сцены: walk_v, run_v).
var walk_v := 1.7
var run_v := 6.2

static var _cfg := {}
static var _scene: PackedScene

var c := {}                              ## data/elite.json
var states: Dictionary = ST              ## состояния дерева движений и их движения (у босса «Мутировавшая Элита» — свои)
var model: Node3D
var skel: Skeleton3D
var anim: AnimationPlayer
var tree: AnimationTree
var sm: AnimationNodeStateMachinePlayback
var look: ULEliteLook

# для проверок
var bites := 0                           ## начал укусов
var claws_r := 0
var claws_l := 0
var combos := 0
var hits_done := 0                       ## попаданий по герою
var misses := 0                          ## удар дошёл до конца, а героя там не было
var events: Array = []                   ## [время, событие] — метки ударов из самих движений
var waits := 0                           ## сколько раз ждал у прохода, куда не пролезть
var turn_max := 0.0                      ## самый быстрый поворот корпуса, °/с
var cur_state := ""                      ## состояние дерева движений
var dmg_after_death := 0                 ## урон герою после гибели (должно быть 0)
var dead_done := false                   ## падение доиграло — можно обыскивать
var last_miss := ""                      ## почему последний удар не попал (для проверок)

var _sp := 0.0                           ## скорость сейчас, м/с
var _move := Vector3.ZERO                ## куда хочет идти (единичный)
var _atk_name := ""                      ## идущий удар: bite, claw_r, claw_l, combo
var _atk_left := 0.0                     ## сколько ещё идёт удар
var _atk_ready := 0.0                    ## через сколько можно следующий
var _hit_open := {}                      ## метки удара, которые ещё могут попасть в этом взмахе
var _alert_t := 0.0
var _wait_t := 0.0
var _wait_at := Vector3.INF
var _blocked_t := 0.0
var _route: PackedVector3Array = []
var _route_t := 0.0
var _route_ok := true
var _route_to := Vector3.INF
var _patrol := Vector3.INF
var _patrol_t := 0.0
var _look_t := 0.0
var _hero_rid := RID()
var _el_t := 0.0                         ## часы для меток в events
var _death_len := 3.0
var _cur_clip := ""                      ## движение идущего удара
var _ev_t := {}                          ## [движение, метка] → время метки


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


## настройки и сцена модели — у наследника (финальный босс ULMutElite) свои
func _conf() -> Dictionary:
	return cfg()


func _packed() -> PackedScene:
	if _scene == null and ResourceLoader.exists(SCENE):
		_scene = load(SCENE)
	return _scene


func setup(k: String, at: Vector3, seed_n: int) -> void:
	kind = k
	c = _conf()
	def = KINDS[k].duplicate(true)
	for key in ["hp", "walk", "run", "see", "hear", "hear_run", "hear_walk", "lose", "lose_s", "alert_s", "stagger_dmg"]:
		if c.has(key):
			def[key] = c[key]
	brain = 3
	hp = float(def.hp)
	home = at
	position = at
	_last = at
	_rng.seed = seed_n
	set_meta("hp", hp)
	set_meta("hp_max", hp)
	set_meta("enemy", true)
	set_meta("elite", true)
	collision_mask = 1 | 2
	floor_snap_length = 0.6
	floor_max_angle = deg_to_rad(40.0)
	_shapes()
	_model()
	if not def.has("gun"):
		_mini_make()
		if _mini != null:
			_mini.position = Vector3(0, float(c.body[1]) + 0.4, 0)
			(_mini.mesh as QuadMesh).size = Vector2(1.6, 0.11)
	rotation.y = _rng.randf() * TAU
	_t = _rng.randf_range(2.0, 5.0)
	_growl = _rng.randf_range(6.0, 12.0)
	loot = roll_loot(k, seed_n)


## тело для столкновений: грудь, круп и голова — три капсулы по длине (стены и герой не проходят сквозь
## морду); пули попадают в любую из них
func _shapes() -> void:
	var L := float(c.body[0])
	var H := float(c.body[1])
	var W := float(c.body[2])
	var r := W * 0.5
	for p in [[0.62, r, H * 0.62], [-0.55, r * 0.95, H * 0.55], [0.0, r, H * 0.6]]:
		var cs := CollisionShape3D.new()
		var cap := CapsuleShape3D.new()
		cap.radius = float(p[1])
		cap.height = maxf(float(p[2]), cap.radius * 2.0 + 0.1)
		cs.shape = cap
		cs.position = Vector3(0, cap.height * 0.5 + 0.05, float(p[0]) * L * 0.5)
		add_child(cs)
	var hs := CollisionShape3D.new()
	var sp := SphereShape3D.new()
	sp.radius = 0.55
	hs.shape = sp
	hs.position = Vector3(0, H * 0.58, L * 0.42)
	hs.name = "HeadShape"
	add_child(hs)


func _model() -> void:
	var ps := _packed()
	if ps == null:
		push_warning("Элита: нет модели %s" % SCENE)
		return
	model = ps.instantiate()
	model.name = "Model"
	add_child(model)
	# модель собрана в «рамке Элиты» (5 м в длину); scale в настройках увеличивает её целиком — шаг и галоп
	# записаны на скорость, которая растёт во столько же раз (лапы не скользят)
	var msc := float(c.get("scale", 1.0))
	model.scale = Vector3.ONE * msc
	walk_v = float(model.get_meta("walk_v", walk_v)) * msc
	run_v = float(model.get_meta("run_v", run_v)) * msc
	skel = model.find_child("Skel", true, false) as Skeleton3D
	anim = model.find_child("Anim", true, false) as AnimationPlayer
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		_meshes.append(mi)
		(mi as GeometryInstance3D).set_meta("elite", true)
		var m3 := mi as MeshInstance3D
		var src := m3.mesh.surface_get_material(0) as StandardMaterial3D if m3.mesh != null else null
		if src != null:
			var tint: Array = c.get("tint", [0.84, 0.74, 0.72])
			var mt := src.duplicate() as StandardMaterial3D
			mt.albedo_color = Color(float(tint[0]), float(tint[1]), float(tint[2]))
			m3.set_surface_override_material(0, mt)
	_rim(model)
	if anim == null:
		return
	# дерево движений: шесть состояний; шаг и галоп — с подстройкой скорости проигрывания (TimeScale)
	var smn := AnimationNodeStateMachine.new()
	var pos := 0
	for st in states:
		var an := AnimationNodeAnimation.new()
		an.animation = states[st]
		smn.add_node(st, an, Vector2(pos * 160, 0))
		pos += 1
	for a in states:
		for b in states:
			if a == b or a == "Death":
				continue
			var tr := AnimationNodeStateMachineTransition.new()
			tr.xfade_time = 0.12 if b == "Death" else (0.18 if not b in ["Idle", "Walk", "Run", "Turn"] else 0.3)
			smn.add_transition(a, b, tr)
	var bt := AnimationNodeBlendTree.new()
	bt.add_node("sm", smn, Vector2(0, 0))
	bt.add_node("ts", AnimationNodeTimeScale.new(), Vector2(200, 0))
	bt.connect_node("ts", 0, "sm")
	bt.connect_node("output", 0, "ts")
	tree = AnimationTree.new()
	tree.name = "Tree"
	model.add_child(tree)
	tree.anim_player = tree.get_path_to(anim)
	tree.tree_root = bt
	tree.callback_mode_method = AnimationMixer.ANIMATION_CALLBACK_MODE_METHOD_IMMEDIATE
	tree.active = true
	sm = tree.get("parameters/sm/playback")
	sm.start("Idle")
	cur_state = "Idle"
	_death_len = anim.get_animation(states.Death).length if anim.has_animation(states.Death) else 3.0
	if skel != null:
		look = ULEliteLook.new()
		look.name = "Look"
		skel.add_child(look)


## событие из движения (метка на дорожке «вызов метода»): bite_hit, claw_r_hit, claw_l_hit, step, land, end
func _anim_event(ev: String) -> void:
	events.append([snappedf(_el_t, 0.01), ev, cur_state])
	match ev:
		"bite_hit":
			_strike("bite", float(c.bite_dmg), float(c.bite_r))
		"claw_r_hit":
			_strike("claw_r", float(c.claw_dmg), float(c.claw_r))
		"claw_l_hit":
			_strike("claw_l", float(c.claw_dmg), float(c.claw_r))
		"land":
			noise.emit("body_fall", global_position)
		"swing":
			noise.emit("swoosh", global_position + Vector3.UP * 1.5)


## точка удара в мире: кончик нижней челюсти или когти передней лапы (смещения — метаданные модели)
func strike_point(what: String) -> Vector3:
	var bn: String = {"bite": "Jaw", "claw_r": "R_Claws", "claw_l": "L_Claws"}.get(what, "Jaw")
	if skel != null and model != null:
		var bi := skel.find_bone(bn)
		if bi >= 0:
			var o: Vector3 = model.get_meta("bite_off" if what == "bite" else "claw_off", Vector3.ZERO)
			if what == "claw_r":
				o.x = -o.x
			return skel.global_transform * (skel.get_bone_global_pose(bi) * o)
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	return global_position + f * float(c.body[0]) * 0.45 + Vector3.UP * 1.2


func _strike(what: String, dmg: float, reach: float) -> void:
	if not _hit_open.get(what, false):
		return
	_hit_open[what] = false                  # один взмах — одно попадание, не больше
	if not alive():
		return
	# точка удара — из самого движения в миг метки (не из позы кадра: метка срабатывает раньше, чем дерево
	# движений применит позу этого мгновения, и при редких кадрах лапа была бы ещё на замахе)
	var ev: String = {"bite": "bite_hit", "claw_r": "claw_r_hit", "claw_l": "claw_l_hit"}[what]
	var p := clip_point(_cur_clip, _event_time(_cur_clip, ev), what) if _cur_clip != "" else strike_point(what)
	var hero := _hero_p + Vector3.UP * 0.9
	var d := Vector2(p.x - hero.x, p.z - hero.z).length()
	# луч «нет ли стены» — от точки удара чуть выше земли (когти в миг удара касаются её)
	if d <= reach and absf(p.y - hero.y) < 2.2 and _clear(Vector3(p.x, maxf(p.y, global_position.y + 0.6), p.z), hero):
		hits_done += 1
		hit_player.emit(dmg, global_position)
	else:
		misses += 1
		last_miss = "%s: до героя %.2f м (достаёт %.2f), по высоте %.2f, стена %s" % [what, d, reach, p.y - hero.y, str(not _clear(Vector3(p.x, maxf(p.y, global_position.y + 0.6), p.z), hero))]


## время метки ev в движении clip (по дорожке «вызов метода»)
func _event_time(clip: String, ev: String) -> float:
	var key := clip + "|" + ev
	if not _ev_t.has(key):
		var t := -1.0
		if anim != null and anim.has_animation(clip):
			var a := anim.get_animation(clip)
			for ti in a.get_track_count():
				if a.track_get_type(ti) == Animation.TYPE_METHOD:
					for k in a.track_get_key_count(ti):
						if String(a.method_track_get_params(ti, k)[0]) == ev:
							t = a.track_get_key_time(ti, k)
		_ev_t[key] = t
	return float(_ev_t[key])


## Точка удара (кончик челюсти или когти) в движении clip в момент t — по дорожкам костей от корня до неё
func clip_point(clip: String, t: float, what: String) -> Vector3:
	if anim == null or skel == null or not anim.has_animation(clip) or t < 0.0:
		return strike_point(what)
	var a := anim.get_animation(clip)
	var bn: String = {"bite": "Jaw", "claw_r": "R_Claws", "claw_l": "L_Claws"}.get(what, "Jaw")
	var o: Vector3 = model.get_meta("bite_off" if what == "bite" else "claw_off", Vector3.ZERO)
	if what == "claw_r":
		o.x = -o.x
	var chain: Array = []
	var bi := skel.find_bone(bn)
	while bi >= 0:
		chain.push_front(bi)
		bi = skel.get_bone_parent(bi)
	var tr := Transform3D()
	for b in chain:
		var path := NodePath("Skel:" + skel.get_bone_name(b))
		var ti := a.find_track(path, Animation.TYPE_ROTATION_3D)
		var q := a.rotation_track_interpolate(ti, t) if ti >= 0 else Quaternion.IDENTITY
		var org := skel.get_bone_rest(b).origin
		if skel.get_bone_parent(b) < 0:
			var tp := a.find_track(path, Animation.TYPE_POSITION_3D)
			if tp >= 0:
				org = a.position_track_interpolate(tp, t)
		tr = tr * Transform3D(Basis(q), org)
	return skel.global_transform * (tr * o)


## между двумя точками нет стены (тело самой Элиты и герой не в счёт)
func _clear(a: Vector3, b: Vector3) -> bool:
	if not is_inside_tree():
		return true
	var q := PhysicsRayQueryParameters3D.create(a, b)
	var ex: Array[RID] = [get_rid()]
	ex.append_array(exclude)
	q.exclude = ex
	q.collision_mask = 1 | 2
	return get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func body_pos() -> Vector3:
	if skel != null:
		var bi := skel.find_bone("Spine2")
		if bi >= 0:
			var p: Vector3 = skel.global_transform * skel.get_bone_global_pose(bi).origin
			return Vector3(p.x, global_position.y, p.z)
	return global_position


func set_active(on: bool) -> void:
	if on == active:
		return
	active = on
	if tree != null:
		tree.active = on or not alive()
	set_shadow(on)


func _notice(at: Vector3) -> void:
	_last = at
	_unseen = 0.0
	if state == "dead":
		return
	state = "alert"
	_alert_t = float(def.get("alert_s", 1.0))
	noise.emit("roar", global_position + Vector3.UP * 2.0)


func _travel(st: String) -> void:
	if sm == null or cur_state == st:
		return
	sm.travel(st)
	cur_state = st


# ---------------- кадр ----------------

func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	_hero_p = p
	_el_t += delta
	set_meta("sees", can_see)
	if not alive():
		_dead_tick(delta)
		return
	_mini_tick(delta)
	_atk_ready = maxf(0.0, _atk_ready - delta)
	_route_t = maxf(0.0, _route_t - delta)
	_growl -= delta
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	var want_sp := 0.0
	var face := Vector3.ZERO
	var turn := float(c.turn_walk)
	if not hero_alive and state in ["chase", "attack", "alert", "wait"]:
		state = "idle"
		_t = 3.0
	if can_see and hero_alive:
		_last = p
		_unseen = 0.0
		if _calm():
			_notice(p)
	elif state in ["chase", "wait"]:
		_unseen += delta
		if _unseen > float(def.lose_s) and dist > float(def.lose):
			state = "wander"
			_patrol = home
	match state:
		"idle", "wander":
			_calm_tick(delta)
			want_sp = float(c.walk) if state == "wander" else 0.0
			face = _move
		"alert":
			_alert_t -= delta
			# голова к герою — сразу (ULEliteLook), корпус разворачивается следом, тяжело
			face = to
			turn = float(c.turn_walk) * 0.8
			if _alert_t <= 0.0:
				state = "chase"
				_route_t = 0.0
		"chase":
			if _atk_left <= 0.0 and _atk_ready <= 0.0 and _can_attack(p):
				_el_attack(p)
			else:
				var dir := _nav(p, delta)
				if dir == Vector3.ZERO:
					_start_wait(p)
				else:
					face = dir
					# близко к герою — не несётся, а подходит на удар
					want_sp = float(c.run) if dist > 6.0 else lerpf(float(c.walk) * 1.4, float(c.run), clampf((dist - 2.5) / 3.5, 0.0, 1.0))
					turn = float(c.turn_run) if _sp > 3.5 else float(c.turn_fight)
				if _growl <= 0.0:
					noise.emit("growl", global_position + Vector3.UP * 2.0)
					_growl = _rng.randf_range(4.0, 7.0)
		"attack":
			_atk_left -= delta
			face = to
			turn = float(c.turn_fight) * (0.35 if _atk_left < 0.5 else 1.0)
			if _atk_left <= 0.0:
				for k in _hit_open:
					if _hit_open[k]:
						misses += 1        # удар доиграл, метки не было (прервали) — промах
				_hit_open.clear()
				_atk_name = ""
				state = "chase"
				_atk_ready = float(c.atk_cd)
		"wait":
			_wait_t -= delta
			face = to
			turn = float(c.turn_walk)
			if _can_attack(p) and _atk_ready <= 0.0:
				_el_attack(p)
			elif _wait_t <= 0.0:
				state = "wander"
				_patrol = home
			elif _route_t <= 0.0 and _nav(p, delta) != Vector3.ZERO:
				state = "chase"              # герой вышел туда, где можно пройти
			elif _wait_at != Vector3.INF and global_position.distance_to(_wait_at) > 1.5:
				face = _wait_at - global_position
				want_sp = float(c.walk)
	_move_tick(delta, want_sp, face, turn)
	_look_tick(delta, p, can_see)
	_anim_tick()


func _calm_tick(delta: float) -> void:
	_t -= delta
	if state == "idle":
		_move = Vector3.ZERO
		if _t <= 0.0:
			# постоял — пошёл обходить свою площадку
			state = "wander"
			_patrol = _patrol_point()
			_patrol_t = 25.0
	else:
		_patrol_t -= delta
		var v := _patrol - global_position
		v.y = 0.0
		if v.length() < 2.0 or _patrol_t <= 0.0:
			state = "idle"
			_t = _rng.randf_range(4.0, 9.0)
			_move = Vector3.ZERO
		else:
			var d := _nav(_patrol, delta)
			if d == Vector3.ZERO:
				state = "idle"
				_t = _rng.randf_range(2.0, 4.0)
			_move = d


## куда пойти в дозоре: в пределах 18 м от своего места, туда, где тело проходит
func _patrol_point() -> Vector3:
	var map := get_world_3d().navigation_map
	for k in 12:
		var a := _rng.randf() * TAU
		var r := _rng.randf_range(6.0, 18.0)
		var q := home + Vector3(cos(a), 0, sin(a)) * r
		q = NavigationServer3D.map_get_closest_point(map, q)
		if absf(q.y - home.y) < 0.6 and _roomy(q):
			return q
	return home


## поместится ли тело в точке p (шар радиусом nav_r на высоте груди не задевает стен, техники, построек)
var _q_sph: PhysicsShapeQueryParameters3D


func _roomy(p: Vector3) -> bool:
	if not is_inside_tree():
		return true
	if _q_sph == null:
		_q_sph = PhysicsShapeQueryParameters3D.new()
		var s := SphereShape3D.new()
		s.radius = float(c.nav_r)
		_q_sph.shape = s
		_q_sph.collision_mask = 1 | 2
	var ex: Array[RID] = [get_rid()]
	ex.append_array(exclude)
	_q_sph.exclude = ex
	_q_sph.transform = Transform3D(Basis(), p + Vector3.UP * (float(c.nav_r) + 0.45))
	return get_world_3d().direct_space_state.intersect_shape(_q_sph, 1).is_empty()


## путь к цели по карте проходимости, только там, где проходит тело: направление на ближайшую точку пути;
## ZERO — пути для такого тела нет (узкий проход, дверь, здание)
func _nav(target: Vector3, _delta: float) -> Vector3:
	var map := get_world_3d().navigation_map
	if NavigationServer3D.map_get_iteration_id(map) <= 0:
		var v := target - global_position
		v.y = 0.0
		return v.normalized() if v.length() > 0.3 else Vector3.ZERO
	if _route_t <= 0.0 or _route_to.distance_to(target) > 2.0:
		_route_t = 0.45
		_route_to = target
		_route = NavigationServer3D.map_get_path(map, global_position, target, true)
		_route_ok = _route.size() >= 2
		if _route_ok:
			# Путь по карте проходимости прижимается к углам (он для человека). Для огромного тела — через каждые
			# 1,5 м точка пути, где тело не помещается, отодвигается от стен (до 2,4 м в сторону); не нашлось места —
			# дальше не пройти: ждать там, докуда прошла.
			var wide := PackedVector3Array()
			wide.append(_route[0])
			var prev := _route[0]
			for i in range(1, _route.size()):
				var seg := _route[i] - prev
				var n := maxi(int(ceil(seg.length() / 1.5)), 1)
				for k in n:
					var q := prev + seg * (float(k + 1) / float(n))
					var last := wide[wide.size() - 1]
					if q.distance_to(global_position) < 1.0 or (_roomy(q) and _sweep_ok(last, q)):
						wide.append(q)
						continue
					var moved := _make_room(q, map, wide[wide.size() - 1])
					if moved == Vector3.INF:
						_route_ok = false
						_wait_at = wide[wide.size() - 1]
						break
					wide.append(moved)
				if not _route_ok:
					break
				prev = _route[i]
			if _route_ok:
				_route = wide
	if not _route_ok:
		# куда можно — дойти до прохода и ждать там
		if _wait_at != Vector3.INF and global_position.distance_to(_wait_at) > 1.5 and state == "chase":
			var vw := _wait_at - global_position
			vw.y = 0.0
			return vw.normalized()
		return Vector3.ZERO
	# ближайшая ещё не пройденная точка пути
	for i in range(1, _route.size()):
		var v2 := _route[i] - global_position
		v2.y = 0.0
		if v2.length() > 1.2 or i == _route.size() - 1:
			return v2.normalized() if v2.length() > 0.3 else Vector3.ZERO
	return Vector3.ZERO


## тело проходит от a до b целиком (шар nav_r на высоте груди скользит по отрезку и ничего не задевает: косяки
## дверей и узкие проходы между точками пути тоже не пропускаются)
var _q_move: PhysicsShapeQueryParameters3D


func _sweep_ok(a: Vector3, b: Vector3) -> bool:
	if not is_inside_tree() or a.distance_to(b) < 0.05:
		return true
	if _q_move == null:
		_q_move = PhysicsShapeQueryParameters3D.new()
		var sp := SphereShape3D.new()
		sp.radius = float(c.nav_r) * 0.92
		_q_move.shape = sp
		_q_move.collision_mask = 1 | 2
	var ex: Array[RID] = [get_rid()]
	ex.append_array(exclude)
	_q_move.exclude = ex
	var lift := Vector3.UP * (float(c.nav_r) + 0.45)
	_q_move.transform = Transform3D(Basis(), a + lift)
	_q_move.motion = (b + lift) - (a + lift)
	var r := get_world_3d().direct_space_state.cast_motion(_q_move)
	return r.size() >= 1 and float(r[0]) >= 0.999


## ближайшее место рядом с q (до 2,4 м), где тело помещается, которое на карте проходимости и до которого от
## прошлой точки пути from нет стены (не «по ту сторону» стены); INF — нет такого
func _make_room(q: Vector3, map: RID, from: Vector3) -> Vector3:
	for r in [0.6, 1.2, 1.8, 2.4]:
		for k in 8:
			var a := TAU * k / 8.0
			var c: Vector3 = q + Vector3(cos(a), 0, sin(a)) * float(r)
			var cn := NavigationServer3D.map_get_closest_point(map, c)
			if Vector2(cn.x - c.x, cn.z - c.z).length() > 0.4 or absf(cn.y - q.y) > 0.6:
				continue
			if _roomy(cn) and _sweep_ok(from, cn):
				return cn
	return Vector3.INF


func _start_wait(p: Vector3) -> void:
	if state == "wait":
		return
	state = "wait"
	waits += 1
	_wait_t = float(c.wait_s)
	if _wait_at == Vector3.INF:
		_wait_at = global_position
	noise.emit("growl", global_position + Vector3.UP * 2.0)
	_last = p


## можно ли ударить сейчас: герой у пасти или у лапы, впереди, и между ними нет стены
func _can_attack(p: Vector3) -> bool:
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var to := p - global_position
	to.y = 0.0
	if to.length() < 0.1:
		return true
	var ang := rad_to_deg(f.angle_to(to.normalized()))
	if ang > 50.0:
		return false
	var mouth := global_position + f * float(c.body[0]) * 0.47
	var dm := Vector2(mouth.x - p.x, mouth.z - p.z).length()
	if dm > maxf(float(c.bite_r), float(c.claw_r)) + 0.6 or absf(p.y - global_position.y) > 1.8:
		return false
	return _clear(mouth + Vector3.UP * 1.2, p + Vector3.UP * 1.0)


func _el_attack(p: Vector3) -> void:
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var right := Vector3(-f.z, 0, f.x)       # правая сторона тела (у четвероногого, смотрящего вдоль +Z)
	var to := p - global_position
	to.y = 0.0
	var side := to.dot(right)
	# укус — когда герой прямо перед пастью; лапа — когда сбоку от морды; иногда два удара подряд
	var pick := "bite" if absf(side) < 0.6 and _rng.randf() < 0.55 else ("claw_r" if side >= 0.0 else "claw_l")
	if pick != "bite" and _rng.randf() < float(c.claw_combo):
		pick = "combo"
	if force_clip != "":
		pick = force_clip
	_atk_name = pick
	state = "attack"
	_hit_open.clear()
	var st := "BiteAttack"
	var clip: String = states.BiteAttack
	match pick:
		"bite":
			bites += 1
			_hit_open["bite"] = true
		"claw_r":
			claws_r += 1
			clip = "elite_claw_r"
			st = "ClawAttack"
			_hit_open["claw_r"] = true
		"claw_l":
			claws_l += 1
			clip = "elite_claw_l"
			st = "ClawAttack"
			_hit_open["claw_l"] = true
		"combo":
			combos += 1
			claws_r += 1
			claws_l += 1
			clip = states.ClawAttack
			st = "ClawAttack"
			_hit_open["claw_r"] = true
			_hit_open["claw_l"] = true
	last_attack = pick
	_cur_clip = clip
	if tree != null and st == "ClawAttack":
		var smn := (tree.tree_root as AnimationNodeBlendTree).get_node("sm") as AnimationNodeStateMachine
		(smn.get_node("ClawAttack") as AnimationNodeAnimation).animation = clip
	_atk_left = anim.get_animation(clip).length if anim != null and anim.has_animation(clip) else 1.4
	if cur_state == st and sm != null:
		sm.start(st, true)                   # второй удар подряд — с начала
	_travel(st)
	if sm != null and cur_state == st:
		sm.start(st, true)
	_sp = minf(_sp, 1.0)


func _move_tick(delta: float, want_sp: float, face: Vector3, turn: float) -> void:
	# разгон и торможение: огромная масса — не мгновенно
	var acc := float(c.accel) if want_sp > _sp else float(c.accel) * 1.4
	_sp = move_toward(_sp, want_sp, acc * delta)
	if face.length() > 0.05:
		var y0 := rotation.y
		var goal := atan2(face.x, face.z)
		var d := angle_difference(rotation.y, goal)
		var mx := deg_to_rad(turn) * delta
		rotation.y += clampf(d, -mx, mx)
		if delta > 0.0:
			turn_max = maxf(turn_max, absf(rad_to_deg(angle_difference(y0, rotation.y))) / delta)
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	# идёт туда, куда смотрит корпус (четвероногое не ходит боком): поворачивает по дуге
	var v := f * _sp * step_k
	velocity.x = v.x
	velocity.z = v.z
	velocity.y = 0.0 if is_on_floor() else velocity.y - 9.8 * delta
	var was := global_position
	move_and_slide()
	velocity.x /= maxf(step_k, 0.001)
	velocity.z /= maxf(step_k, 0.001)
	# упёрся (стена, техника): не пробивает, а ищет обход — путь заново, долго стоит — ждёт
	if want_sp > 0.5 and delta > 0.0:
		var moved := Vector2(global_position.x - was.x, global_position.z - was.z).length() / delta
		if moved < want_sp * 0.2:
			_blocked_t += delta
			if _blocked_t > 1.2:
				_blocked_t = 0.0
				_route_t = 0.0
				if state == "chase":
					_wait_at = global_position
					_start_wait(_hero_p)
		else:
			_blocked_t = 0.0


func _look_tick(delta: float, p: Vector3, can_see: bool) -> void:
	if look == null:
		return
	var tgt := Vector3.INF
	var w := 0.0
	if state in ["alert", "wait", "chase", "attack"] and (can_see or state == "alert"):
		tgt = p + Vector3.UP * 1.0
		w = 0.0 if state == "attack" else 1.0
	elif state == "idle":
		# осматривается: то влево, то вправо, иногда принюхивается — морда чуть вверх
		_look_t -= delta
		if _look_t <= 0.0 or look.target == Vector3.INF:
			_look_t = _rng.randf_range(2.0, 4.5)
			var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
			var a := _rng.randf_range(-0.9, 0.9)
			look.target = global_position + f.rotated(Vector3.UP, a) * 8.0 + Vector3.UP * _rng.randf_range(1.5, 3.8)
		tgt = look.target
		w = 0.6
	if tgt != Vector3.INF:
		look.target = look.target.lerp(tgt, 1.0 - exp(-delta * 4.0)) if look.target != Vector3.INF else tgt
	look.weight = move_toward(look.weight, w, delta * 2.0)


func _anim_tick() -> void:
	if tree == null or not alive():
		return
	if state == "attack":
		tree.set("parameters/ts/scale", 1.0)
		return
	var st := "Idle"
	var sc := 1.0
	if _sp > 3.4:
		st = "Run"
		sc = clampf(_sp / run_v, 0.55, 1.4)
	elif _sp > 0.15:
		st = "Walk"
		sc = clampf(_sp / walk_v, 0.35, 2.2)
	_travel(st)
	tree.set("parameters/ts/scale", sc)


# ---------------- попадание и гибель ----------------

func damage(d: float, from := Vector3.INF) -> void:
	if not alive():
		return
	d *= 1.0 - float(c.get("resist", 0.0))
	hp = maxf(0.0, hp - d)
	set_meta("hp", hp)
	if hp <= 0.0:
		_die()
		return
	_hit_fx(d * 0.15, from)                  # тяжёлую тушу почти не отбрасывает
	_kb = Vector3.ZERO
	if _calm() or state == "alert" or state == "wait":
		state = "chase"
		_last = from if from != Vector3.INF else _last
		_unseen = 0.0
		_route_t = 0.0


func _die() -> void:
	state = "dead"
	dead_t = 0.0
	velocity = Vector3.ZERO
	collision_layer = 0
	collision_mask = 0
	_hit_open.clear()
	_atk_left = 0.0
	_atk_name = ""
	_mini_show(false)
	if look != null:
		look.weight = 0.0
	if tree != null:
		tree.active = true
		tree.set("parameters/ts/scale", 1.0)
		sm.travel("Death")
		cur_state = "Death"
	noise.emit("zdeath", global_position + Vector3.UP * 2.0)


## гибель: падение доигрывает, тело лежит; последние две секунды уходит в землю (как у всех)
func _dead_tick(delta: float) -> void:
	dead_t += delta
	if not dead_done and dead_t >= _death_len:
		dead_done = true
	var sink := clampf((dead_t - (CORPSE_S - 2.0)) / 2.0, 0.0, 1.0)
	if sink > 0.0 and model != null:
		model.position.y = -1.2 * sink * sink


func settled() -> bool:
	return dead_done


## урон герою после гибели — ни при каких метках (проверка)
func _emit_guard(dmg: float) -> void:
	if not alive():
		dmg_after_death += 1
		return
	hit_player.emit(dmg, global_position)
