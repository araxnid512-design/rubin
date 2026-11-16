class_name ULEnemy
extends CharacterBody3D
## Враг на локации. Виды и весь баланс — в data/enemies.json (KINDS): прочность, скорости, как замечает героя,
## удары, добыча. Живёт так: стоит или бродит → заметил героя (увидел, услышал выстрел, бег или шаги) → кричит →
## бежит туда, где видел его в последний раз, обходя препятствия → вплотную бьёт (у удара есть замах: урон доходит
## не сразу, от него можно отойти) → потерял из виду — доходит до последнего места, ждёт и успокаивается.
## Убит — падает в сторону удара; тело можно обыскать (добыча — в ячейках loot); через CORPSE_S секунд тело
## исчезает, обыскали его или нет.

signal hit_player(dmg: float)
signal noise(kind: String, at: Vector3)      ## голос: growl — рычит, roar — кричит, zdeath — предсмертный

const CORPSE_S := 60.0
const CONFIG := "res://data/enemies.json"
static var KINDS: Dictionary = _load_kinds()

var kind := "infected"
var def := {}
var hp := 60.0
var state := "idle"               ## idle — стоит, wander — бродит, alert — заметил и кричит, chase — бежит, attack — бьёт, dead — убит
var rig: BCCharacter
var loot: Array = []              ## ячейки добычи (как у ящика)
var dead_t := 0.0
var home := Vector3.ZERO
var active := true
var exclude: Array[RID] = []      ## кого не считать препятствием (герой)
var last_attack := ""             ## название последнего удара (для проверок)
var death_clip := ""              ## каким клипом упал
var _t := 0.0
var _atk := 0.0
var _goal := Vector3.ZERO
var _last := Vector3.ZERO         ## где героя видели или слышали в последний раз
var _unseen := 0.0                ## сколько секунд не видит героя
var _hit_due := -1.0
var _hit_dmg := 0.0
var _growl := 5.0
var _steer_a := 0.0               ## на сколько отвернул от прямой, обходя препятствие
var _steer_t := 0.0
var _steer_n := 0
var _twist := INF                 ## падая от удара сбоку, разворачивается к нему лицом (и валится от него)
var _rng := RandomNumberGenerator.new()


static func _load_kinds() -> Dictionary:
	var out := {}
	var d = JSON.parse_string(FileAccess.get_file_as_string(CONFIG))
	if d is Dictionary:
		for k in d:
			if d[k] is Dictionary:
				out[String(k)] = d[k]
	return out


## описание вида для справочника: строки «как ходит, как нападает, что в нём бывает» — из тех же чисел баланса
static func describe(k: String) -> Array:
	var d: Dictionary = KINDS[k]
	var lt := ""
	for l in d.loot:
		var nm := String(ULItems.get_def(String(l[0])).n).to_lower()
		var part := "%s — %d" % [nm, int(l[1])] if int(l[1]) == int(l[2]) else "%s — от %d до %d" % [nm, int(l[1]), int(l[2])]
		if l.size() > 3 and float(l[3]) < 1.0:
			part += " (шанс %d %%)" % int(round(float(l[3]) * 100.0))
		lt += ("" if lt == "" else "; ") + part
	var hears := "выстрел до %d м" % int(d.hear)
	if float(d.get("hear_run", 0.0)) > 0.0:
		hears += ", бег до %d м" % int(d.hear_run)
	if float(d.get("hear_walk", 0.0)) > 0.0:
		hears += ", шаги до %d м" % int(d.hear_walk)
	var at := ""
	for a in d.get("attacks", []):
		at += ("" if at == "" else ", ") + "%s — %d" % [String(a.n), int(a.dmg)]
	return [
		String(d.d),
		"Рост %d см. Прочность: %d." % [int(round(float(d.get("height", 1.78)) * 100.0)), int(d.hp)],
		"Ходит: бродит шагом (%.1f м/с). Видит героя ближе %d м, слышит %s. Заметив — %sбежит к нему (%.1f м/с), обходя препятствия. Теряет, если не видит %d с и герой дальше %d м." % [float(d.walk), int(d.see), hears, "кричит и " if float(d.get("alert_s", 0.0)) > 0.0 else "", float(d.run), int(d.get("lose_s", 0)), int(d.lose)],
		"Нападает: вплотную, раз в %.1f с, с замахом — от удара можно отойти. Удары: %s." % [float(d.cd), at],
		"В теле может быть: %s." % lt,
		"Тело лежит минуту и исчезает — обыскали его или нет.",
	]


func setup(k: String, at: Vector3, seed_n: int) -> void:
	kind = k
	def = KINDS[k]
	hp = float(def.hp)
	home = at
	position = at
	_last = at
	_rng.seed = seed_n
	set_meta("hp", hp)
	set_meta("hp_max", hp)
	set_meta("enemy", true)
	var tall := float(def.get("height", 1.78))
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = tall
	cs.shape = cap
	cs.position.y = tall * 0.5
	add_child(cs)
	rig = BCCharacter.new()
	rig.name = "Rig"
	rig.simple = true                # без поправок под оружие; движения — клипы как есть
	rig.built_poses = false
	rig.stand_clamp = true
	rig.height = tall
	add_child(rig)
	var path := String(def.model)
	var own := ResourceLoader.exists(path)
	# свой набор движений (снятых под эту модель) и своё описание клипов; чего в наборе нет — берётся у героя
	rig.anim_cfg = String(def.get("anim_cfg", BCAnimSet.CONFIG))
	rig.setup(path if own else "res://assets/models/hero.glb", String(def.get("anim", "res://assets/anim/hero")) if own else "res://assets/anim/hero")
	if rig.ik != null and bool(def.get("no_foot_ik", false)):
		# постановка стоп рассчитана на обутую ногу героя; босая стопа от неё встаёт на носок
		rig.ik.queue_free()
		rig.ik = null
	if not own:
		# своей модели ещё нет — фигура героя в мертвенно-серых тонах
		for mi in rig.model.find_children("*", "MeshInstance3D", true, false):
			var m := mi as MeshInstance3D
			for si in m.mesh.get_surface_count():
				var src := m.mesh.surface_get_material(si) as StandardMaterial3D
				if src != null:
					var mt := src.duplicate() as StandardMaterial3D
					mt.albedo_color = Color(0.62, 0.74, 0.6)
					m.set_surface_override_material(si, mt)
	rotation.y = _rng.randf() * TAU
	_t = _rng.randf_range(1.0, 4.0)
	_growl = _rng.randf_range(3.0, 9.0)
	loot = roll_loot(k, seed_n)


## добыча в теле: определяется сразу, у каждого своя (по зерну). Четыре ячейки, как у маленького хранилища.
## Запись добычи: [предмет, от, до, шанс] — шанс того, что предмет вообще есть (нет его — значит 1)
static func roll_loot(k: String, seed_n: int) -> Array:
	var r := RandomNumberGenerator.new()
	r.seed = seed_n * 7919 + 13
	var out: Array = []
	out.resize(4)
	for l in KINDS[k].loot:
		var chance := float(l[3]) if l.size() > 3 else 1.0
		var n := r.randi_range(int(l[1]), int(l[2]))
		if r.randf() <= chance and n > 0:
			ULInventory.put(out, ULItems.make(String(l[0]), n))
	return out


func alive() -> bool:
	return state != "dead"


## где лежит тело: падая, враг отлетает от места гибели — обыскивают там, где он лежит на самом деле
func body_pos() -> Vector3:
	if alive() or rig == null or rig.skel == null:
		return global_position
	var hip := rig.skel.find_bone("Hip")
	if hip < 0:
		return global_position
	var p: Vector3 = rig.skel.global_transform * rig.skel.get_bone_global_pose(hip).origin
	return Vector3(p.x, global_position.y, p.z)


func _calm() -> bool:
	return state == "idle" or state == "wander"


## заметил героя: кричит (если виду положено) и только потом бежит — у игрока есть миг на решение
func _notice(at: Vector3) -> void:
	_last = at
	_unseen = 0.0
	var wait := float(def.get("alert_s", 0.0))
	if wait > 0.0:
		state = "alert"
		_t = wait
		if rig.has_clip("scream"):
			rig.play("scream", rig.clip_len("scream") / maxf(wait + 0.5, 0.3))
		noise.emit("roar", global_position)
	else:
		state = "chase"
		noise.emit("growl", global_position)


## услышал выстрел в точке p
func hear(p: Vector3) -> void:
	if alive() and _calm() and global_position.distance_to(p) < float(def.hear):
		_notice(p)


## услышал героя: бег слышен дальше шагов, стоящего не слышно
func hear_steps(p: Vector3, speed: float) -> void:
	if not alive() or not _calm():
		return
	var r := float(def.get("hear_run", 0.0)) if speed > 2.4 else (float(def.get("hear_walk", 0.0)) if speed > 0.4 else 0.0)
	if r > 0.0 and global_position.distance_to(p) < r:
		_notice(p)


## попадание; from — откуда пришёлся удар (по нему — в какую сторону шатнётся и упадёт)
func damage(d: float, from := Vector3.INF) -> void:
	if not alive():
		return
	hp = maxf(0.0, hp - d)
	set_meta("hp", hp)
	# с какой стороны ударили: спереди, сзади или сбоку
	var side := "front"
	if from != Vector3.INF:
		var v := from - global_position
		v.y = 0.0
		if v.length() > 0.05:
			var a := absf(angle_difference(rotation.y, atan2(v.x, v.z)))
			side = "front" if a < PI * 0.3 else ("back" if a > PI * 0.7 else "side")
	if hp <= 0.0:
		state = "dead"
		dead_t = 0.0
		velocity = Vector3.ZERO
		collision_layer = 0
		collision_mask = 0
		_hit_due = -1.0
		rig.set_motion(0.0, 0.0, 0.016)
		# ударили спереди — валится на спину; сзади — лицом вперёд; сбоку — разворачивает к удару и валит от него
		var clip := "death_front" if side == "back" and rig.has_clip("death_front") else "death"
		if side == "side" and rig.has_clip("death_side"):
			clip = "death_side"                      # своё падение набок
		var pose: String = {"death": "dead", "death_front": "dead_front", "death_side": "dead_side"}[clip]
		death_clip = clip if side != "side" else "death_side"
		if side == "side" and clip != "death_side":
			var tv := from - global_position
			_twist = atan2(tv.x, tv.z)
		if rig.has_clip(clip):
			var len_s := rig.play(clip)
			rig.set_pose(pose if rig.has_clip(pose) else "dead", maxf(len_s - 0.3, 0.0))
		noise.emit("zdeath", global_position)
		return
	if _calm() or state == "alert":
		# удар будит сразу, без крика
		state = "chase"
		_last = from if from != Vector3.INF else _last
		_unseen = 0.0
	if d >= float(def.hp) * 0.3 and rig.has_clip("stagger"):
		# сильное попадание сбивает с ног: удар, который он готовил, срывается
		rig.play("stagger", 1.3)
		_hit_due = -1.0
		_atk = maxf(_atk, float(def.cd) * 0.7)
	elif not rig.busy():
		var hc := "hit_back" if side == "back" and rig.has_clip("hit_back") else "hit_front"
		if rig.has_clip(hc):
			rig.play(hc, 1.4)


## кадр: p — где герой, can_see — видит ли его сейчас (без стены между ними), hero_alive — жив ли герой
func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	if state == "dead":
		dead_t += delta
		if _twist != INF and dead_t < 0.45:
			rotation.y = lerp_angle(rotation.y, _twist, 1.0 - exp(-delta * 9.0))
		return
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	_atk = maxf(0.0, _atk - delta)
	_growl -= delta
	var speed := 0.0
	match state:
		"idle", "wander":
			if hero_alive and dist < float(def.see) and can_see:
				_notice(p)
			else:
				_t -= delta
				if state == "wander":
					var g := _goal - global_position
					g.y = 0.0
					if g.length() < 0.4 or _t <= 0.0:
						state = "idle"
						_t = _rng.randf_range(2.0, 5.0)
					else:
						speed = float(def.walk)
						_face(_steer(g, delta), delta, 4.0)
				elif _t <= 0.0:
					state = "wander"
					_goal = home + Vector3(_rng.randf_range(-5, 5), 0, _rng.randf_range(-5, 5))
					_t = 6.0
				if _growl <= 0.0:
					_growl = _rng.randf_range(7.0, 15.0)
					noise.emit("growl", global_position)
		"alert":
			var la := _last - global_position
			la.y = 0.0
			_face(la, delta, 6.0)
			if can_see:
				_last = p
			_t -= delta
			if _t <= 0.0:
				state = "chase"
		"chase":
			if can_see:
				_last = p
				_unseen = 0.0
			else:
				_unseen += delta
			var tl := _last - global_position
			tl.y = 0.0
			if not hero_alive or (_unseen > float(def.get("lose_s", 0.0)) and (dist > float(def.lose) or tl.length() < 0.8)):
				# потерял: не видит дольше положенного, а герой далеко — или дошёл до места, где видел, и там пусто
				state = "idle"
				_t = 2.5
			elif can_see and dist <= float(def.reach):
				state = "attack"
			elif tl.length() < 0.5:
				_face(to, delta, 3.0)                    # дошёл до последнего места — озирается
			else:
				speed = float(def.run)
				_face(_steer(tl, delta), delta, 7.0)
				if _growl <= 0.0:
					_growl = _rng.randf_range(3.0, 6.0)
					noise.emit("growl", global_position)
		"attack":
			_face(to, delta, 9.0)
			_last = p
			if _hit_due >= 0.0:
				_hit_due -= delta
				if _hit_due < 0.0:
					# удар доходит: герой всё ещё рядом — получает урон
					if hero_alive and dist <= float(def.reach) + 0.35:
						hit_player.emit(_hit_dmg)
			elif not hero_alive or dist > float(def.reach) + 0.25:
				if _atk <= float(def.cd) * 0.5:
					state = "chase"
			elif _atk <= 0.0:
				_atk = float(def.cd)
				var list: Array = def.get("attacks", [])
				var a: Dictionary = list[_rng.randi() % list.size()] if not list.is_empty() else {"clip": "melee_light", "dmg": float(def.dmg), "hit": 0.45, "n": "удар"}
				var clip := String(a.clip) if rig.has_clip(String(a.clip)) else "attack_r"
				var len_s := rig.play(clip, float(a.get("rate", 1.0)))
				_hit_due = len_s * float(a.get("hit", 0.45))
				_hit_dmg = float(a.dmg)
				last_attack = String(a.n)
				if _rng.randf() < 0.6:
					noise.emit("roar", global_position)
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	velocity = Vector3(fwd.x * speed, velocity.y - 9.8 * delta, fwd.z * speed)
	move_and_slide()
	if is_on_floor():
		velocity.y = 0.0
	rig.set_motion(Vector3(velocity.x, 0, velocity.z).length(), 0.0, delta)


## Обход препятствий: луч вперёд на уровне голени; упёрся (стена, забор, ящик, другой враг) — пробуются повороты
## всё круче в обе стороны, берётся первый свободный и держится полсекунды (иначе дёргался бы у каждого угла).
## Проверка — раз в три кадра: это один луч на врага, а не расчёт пути.
func _steer(dir: Vector3, delta: float) -> Vector3:
	if dir.length() < 0.05:
		return dir
	var d := dir.normalized()
	_steer_t -= delta
	_steer_n += 1
	if _steer_n % 3 == 0 and is_inside_tree():
		var space := get_world_3d().direct_space_state
		var from := global_position + Vector3.UP * 0.4       # на уровне голени: ящик по колено — тоже препятствие
		var free_a := 999.0
		for a in [0.0, 0.6, -0.6, 1.2, -1.2, 1.9, -1.9]:
			if _steer_t > 0.0 and a == 0.0 and _steer_a != 0.0:
				continue                              # только что отвернул — прямо пока не пробует
			var v := d.rotated(Vector3.UP, a)
			var q := PhysicsRayQueryParameters3D.create(from, from + v * 1.1)
			var ex: Array[RID] = [get_rid()]
			ex.append_array(exclude)
			q.exclude = ex
			if space.intersect_ray(q).is_empty():
				free_a = a
				break
		if free_a == 999.0:
			free_a = _steer_a
		if free_a != _steer_a:
			_steer_a = free_a
			_steer_t = 0.5 if free_a != 0.0 else 0.0
	return d.rotated(Vector3.UP, _steer_a)


func _face(dir: Vector3, delta: float, rate: float) -> void:
	if dir.length() > 0.05:
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), 1.0 - exp(-delta * rate))


## вдали от героя не считается и не двигается
func set_active(on: bool) -> void:
	if on == active:
		return
	active = on
	rig.set_active(on)
