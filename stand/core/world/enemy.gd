class_name ULEnemy
extends CharacterBody3D
## Враг на локации. Виды — в KINDS: прочность, скорости, как замечает героя, как бьёт, что может лежать в теле.
## Живёт так: стоит или бродит → заметил героя (видит рядом или услышал выстрел) → бежит к нему → вплотную бьёт.
## Убит — падает; тело можно обыскать (добыча — в ячейках loot); через CORPSE_S секунд тело исчезает, обыскали
## его или нет.

signal hit_player(dmg: float)

const CORPSE_S := 60.0
const KINDS := {
	"infected": {
		"n": "Заражённый", "pic": "enemy_infected", "model": "res://assets/models/zombie.glb",
		"hp": 60.0, "walk": 1.0, "run": 2.9, "see": 13.0, "hear": 22.0, "lose": 24.0,
		"reach": 1.35, "dmg": 9.0, "cd": 1.3,
		"loot": [["spore", 0, 3]],
		"d": "Бывший человек, которого Улей переродил. Разума нет, только голод.",
	},
}

var kind := "infected"
var def := {}
var hp := 60.0
var state := "idle"               ## idle — стоит, wander — бродит, chase — бежит к герою, attack — бьёт, dead — убит
var rig: BCCharacter
var loot: Array = []              ## ячейки добычи (как у ящика)
var dead_t := 0.0
var home := Vector3.ZERO
var active := true
var _t := 0.0
var _atk := 0.0
var _goal := Vector3.ZERO
var _hit_due := -1.0
var _rng := RandomNumberGenerator.new()


## описание вида для справочника: строки «как ходит, как нападает, что в нём бывает»
static func describe(k: String) -> Array:
	var d: Dictionary = KINDS[k]
	var lt := ""
	for l in d.loot:
		lt += "%s — от %d до %d" % [ULItems.get_def(String(l[0])).n.to_lower(), int(l[1]), int(l[2])]
	return [
		String(d.d),
		"Ходит: бродит шагом (%.1f м/с). Заметив героя ближе %d м или услышав выстрел до %d м — бежит к нему (%.1f м/с). Теряет героя дальше %d м." % [float(d.walk), int(d.see), int(d.hear), float(d.run), int(d.lose)],
		"Нападает: вплотную бьёт руками — %d урона раз в %.1f с." % [int(d.dmg), float(d.cd)],
		"Прочность: %d." % int(d.hp),
		"В теле может быть: %s." % lt,
		"Тело лежит минуту и исчезает — обыскали его или нет.",
	]


func setup(k: String, at: Vector3, seed_n: int) -> void:
	kind = k
	def = KINDS[k]
	hp = float(def.hp)
	home = at
	position = at
	_rng.seed = seed_n
	set_meta("hp", hp)
	set_meta("hp_max", hp)
	set_meta("enemy", true)
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.32
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	rig = BCCharacter.new()
	rig.name = "Rig"
	rig.simple = true                # без поправок под оружие; движения — клипы как есть
	rig.built_poses = false
	add_child(rig)
	var path := String(def.model)
	var own := ResourceLoader.exists(path)
	rig.setup(path if own else "res://assets/models/hero.glb", "res://assets/anim/hero")
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
	loot = roll_loot(k, seed_n)


## добыча в теле: определяется сразу, у каждого своя (по зерну). Четыре ячейки, как у маленького хранилища
static func roll_loot(k: String, seed_n: int) -> Array:
	var r := RandomNumberGenerator.new()
	r.seed = seed_n * 7919 + 13
	var out: Array = []
	out.resize(4)
	for l in KINDS[k].loot:
		var n := r.randi_range(int(l[1]), int(l[2]))
		if n > 0:
			ULInventory.put(out, ULItems.make(String(l[0]), n))
	return out


func alive() -> bool:
	return state != "dead"


## где лежит тело: падая, заражённый отлетает от места гибели — обыскивают там, где он лежит на самом деле
func body_pos() -> Vector3:
	if alive() or rig == null or rig.skel == null:
		return global_position
	var hip := rig.skel.find_bone("Hip")
	if hip < 0:
		return global_position
	var p: Vector3 = rig.skel.global_transform * rig.skel.get_bone_global_pose(hip).origin
	return Vector3(p.x, global_position.y, p.z)


## услышал шум (выстрел) в точке p
func hear(p: Vector3) -> void:
	if alive() and state != "chase" and state != "attack" and global_position.distance_to(p) < float(def.hear):
		state = "chase"


func damage(d: float) -> void:
	if not alive():
		return
	hp = maxf(0.0, hp - d)
	set_meta("hp", hp)
	if hp <= 0.0:
		state = "dead"
		dead_t = 0.0
		velocity = Vector3.ZERO
		collision_layer = 0
		collision_mask = 0
		rig.set_motion(0.0, 0.0, 0.016)
		if rig.has_clip("death"):
			var len_s := rig.play("death")
			rig.set_pose("dead", maxf(len_s - 0.3, 0.0))
		return
	state = "chase"
	if rig.has_clip("hit_front") and not rig.busy():
		rig.play("hit_front", 1.4)


## кадр: p — где герой, can_see — нет ли стены между ним и героем, hero_alive — жив ли герой
func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	if state == "dead":
		dead_t += delta
		return
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	_atk = maxf(0.0, _atk - delta)
	var speed := 0.0
	match state:
		"idle", "wander":
			if hero_alive and dist < float(def.see) and can_see:
				state = "chase"
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
						_face(g, delta, 4.0)
				elif _t <= 0.0:
					state = "wander"
					_goal = home + Vector3(_rng.randf_range(-5, 5), 0, _rng.randf_range(-5, 5))
					_t = 6.0
		"chase":
			if not hero_alive or dist > float(def.lose):
				state = "idle"
				_t = 2.0
			elif dist <= float(def.reach):
				state = "attack"
			else:
				speed = float(def.run)
				_face(to, delta, 7.0)
		"attack":
			_face(to, delta, 9.0)
			if _hit_due >= 0.0:
				_hit_due -= delta
				if _hit_due < 0.0:
					# удар доходит: герой всё ещё рядом и перед ним — получает урон
					if hero_alive and dist <= float(def.reach) + 0.35:
						hit_player.emit(float(def.dmg))
			elif not hero_alive or dist > float(def.reach) + 0.25:
				if _atk <= float(def.cd) * 0.5:
					state = "chase"
			elif _atk <= 0.0:
				_atk = float(def.cd)
				# выпад обеими руками вперёд; удар доходит в середине движения
				var clip := "melee_light" if rig.has_clip("melee_light") else "punch_light"
				var len_s := rig.play(clip, 1.0)
				_hit_due = len_s * 0.45
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	velocity = Vector3(fwd.x * speed, velocity.y - 9.8 * delta, fwd.z * speed)
	move_and_slide()
	if is_on_floor():
		velocity.y = 0.0
	rig.set_motion(Vector3(velocity.x, 0, velocity.z).length(), 0.0, delta)


func _face(dir: Vector3, delta: float, rate: float) -> void:
	if dir.length() > 0.05:
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), 1.0 - exp(-delta * rate))


## вдали от героя не считается и не двигается
func set_active(on: bool) -> void:
	if on == active:
		return
	active = on
	rig.set_active(on)
