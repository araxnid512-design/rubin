class_name Player
extends CharacterBody3D
## Герой: модель с клипами Mixamo (браузерная игра — та же модель), клипы — по типу оружия в руках (топор,
## пистолет, автомат), оружие — в узле GripR кисти, второе — в креплении на теле (чехол топора, кобура,
## ремень за спиной). Огнестрел без патронов: каждый выстрел изнашивает ствол, на нуле — ломается.

signal died

const CLIPS := {
	"axe": {"idle": "Idle", "walk": "Walk", "run": "Run", "hit": "Hit", "attack": "Melee"},
	"pistol": {"idle": "IdlePistol", "walk": "WalkPistol", "run": "RunPistol", "hit": "HitPistol", "aim": "AimPistol", "shoot": "Shoot"},
	"rifle": {"idle": "IdleRifle", "walk": "WalkRifle", "run": "RunRifle", "hit": "HitRifle", "aim": "AimRifle", "shoot": "ShootRifle"},
}
const EQUIP := {"pistol": {"draw": "EquipPistol", "stow": "EquipAxe"}, "rifle": {"draw": "EquipRifle", "stow": "EquipAxeR"}}
const LOOPED := ["Idle", "Walk", "Run", "IdlePistol", "WalkPistol", "RunPistol", "AimPistol", "IdleRifle", "WalkRifle", "RunRifle", "AimRifle"]
const MOUNTS := {"axe": "AxeMount", "holster": "HolsterMount", "back": "BackMount"}
## Естественная скорость клипов ходьбы и бега, м/с — под неё подгоняется темп, чтобы ступни не скользили.
const GAIT := {"walk": 1.45, "run": 3.9}

var game: Node
var model: Node3D
var anim: AnimationPlayer
var grip: Node3D
var mounts := {}
var models := {}
var kit := {"melee": "axe", "gun": ""}
var wear := {}
var hold := "melee"
var hp := 100.0
var max_hp := 100.0
var alive := true
var cooldown := 0.0
var busy := 0.0
var aim_t := 0.0
var equipping := false
var pending := []
var move_input := Vector2.ZERO
var attack_held := false
var clip := ""
var last_hurt := -99.0
var speed := 0.0

func setup(g: Node, k: Dictionary, w: Dictionary) -> void:
	game = g
	kit = k
	wear = w
	collision_layer = 2
	collision_mask = Level.WALL_LAYER
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	model = (load("res://assets/characters/player.glb") as PackedScene).instantiate()
	add_child(model)
	anim = model.find_child("AnimationPlayer", true, false)
	for c in LOOPED:
		if anim and anim.has_animation(c):
			anim.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	grip = attach_point(model, "GripR")
	for m in MOUNTS:
		mounts[m] = attach_point(model, MOUNTS[m])
	attach_gear()
	play(clips()["idle"], 0.0)

## Точка крепления (хват, чехол, кобура): при импорте glTF узлы под костями становятся костями скелета —
## тогда к такой кости цепляется BoneAttachment3D.
static func attach_point(root: Node, point: String) -> Node3D:
	var found: Node = root.find_child(point, true, false)
	if found is Node3D and not found is Skeleton3D:
		return found
	for sk in root.find_children("*", "Skeleton3D", true, false):
		var skel: Skeleton3D = sk
		if skel.find_bone(point) >= 0:
			var ba := BoneAttachment3D.new()
			ba.name = point + "Attach"
			ba.bone_name = point
			skel.add_child(ba)
			return ba
	return null

func weapon_id() -> String:
	var id: String = kit.get(hold, "")
	return id if id != "" else "fists"

func W() -> Dictionary:
	return Data.weapon(weapon_id())

func clips() -> Dictionary:
	return CLIPS.get(W().get("anim", "axe"), CLIPS["axe"])

func wear_of(id: String) -> int:
	if not wear.has(id):
		wear[id] = int(Data.weapon(id).get("durability", 0))
	return int(wear[id])

## 3D-модель оружия (одна на id). Новые стволы пока — в модели похожего.
func gun_model(id: String) -> Node3D:
	if not models.has(id):
		var w := Data.weapon(id)
		var path := "res://assets/weapons/%s.glb" % w.get("model", id)
		var node: Node3D = (load(path) as PackedScene).instantiate() if ResourceLoader.exists(path) else Node3D.new()
		node.name = "Gun_" + id
		models[id] = node
	return models[id]

func _put(node: Node3D, parent: Node) -> void:
	if node.get_parent():
		node.get_parent().remove_child(node)
	if parent:
		parent.add_child(node)
		node.transform = Transform3D.IDENTITY

## Мгновенно: в руке — оружие слота hold, второе — в креплении на теле, остальное убрано.
func attach_gear() -> void:
	var gear := [kit.get("melee", ""), kit.get("gun", "")]
	for id in models.keys():
		if not gear.has(id):
			_put(models[id], null)
	for slot in ["melee", "gun"]:
		var id: String = kit.get(slot, "")
		if id == "" or id == "fists":
			continue
		var node := gun_model(id)
		if slot == hold:
			_put(node, grip)
			node.visible = true
		else:
			var mount = mounts.get(Data.weapon(id).get("mount", ""))
			_put(node, mount if mount else grip)
			node.visible = mount != null
	if game:
		game.hud_refresh()

func play(c: String, blend := 0.15, restart := false) -> void:
	if anim == null or not anim.has_animation(c):
		return
	if c == clip and not restart:
		return
	clip = c
	anim.play(c, blend)
	if restart:
		anim.seek(0.0, true)

func muzzle_pos() -> Vector3:
	var node: Node3D = models.get(weapon_id())
	var m: Node3D = node.find_child("Muzzle", true, false) if node else null
	return m.global_position if m else global_position + Vector3(0, 1.3, 0) - global_transform.basis.z * -0.6

func _physics_process(delta: float) -> void:
	if not alive:
		return
	cooldown -= delta
	busy -= delta
	aim_t -= delta
	for p in pending.duplicate():
		p["t"] -= delta
		if p["t"] <= 0.0:
			pending.erase(p)
			p["fn"].call()
	var mi := move_input
	if mi.length() > 1.0:
		mi = mi.normalized()
	var mag := mi.length()
	var dir := Vector3(mi.x, 0, mi.y)
	var w := W()
	var gun: bool = w.get("slot", "") == "gun"
	speed = 0.0
	if mag > 0.12:
		speed = 3.6 + 1.4 * (mag - 0.55) / 0.45 if mag > 0.55 else 1.1 + 0.6 * minf(1.0, (mag - 0.12) / 0.43)
		if busy > 0.0 and not gun:
			speed *= 0.5
		if gun and aim_t > 0.0:
			speed *= 0.75
	velocity = dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	move_and_slide()
	# куда смотрит: на цель, пока стреляет или целится; иначе — по ходу
	var target = game.nearest_enemy(global_position, float(w.get("range", 2.0)) + 1.5, true) if (attack_held or aim_t > 0.0) else null
	var want := rotation.y
	if target:
		var to: Vector3 = target.global_position - global_position
		want = atan2(to.x, to.z)
	elif mag > 0.12:
		want = atan2(dir.x, dir.z)
	rotation.y = lerp_angle(rotation.y, want, minf(1.0, delta * 12.0))
	if attack_held and cooldown <= 0.0 and busy <= 0.05 and not equipping:
		attack()
	_animate()

func _animate() -> void:
	if busy > 0.0 or equipping:
		anim.speed_scale = 1.0
		return
	var c := clips()
	if speed > 0.1:
		var running := speed > 2.4
		play(c["run"] if running else c["walk"], 0.18)
		anim.speed_scale = clampf(speed / (GAIT["run"] if running else GAIT["walk"]), 0.7, 1.5)
	elif aim_t > 0.0 and c.has("aim"):
		play(c["aim"], 0.15)
		anim.speed_scale = 1.0
	else:
		play(c["idle"], 0.2)
		anim.speed_scale = 1.0

## Удар или выстрел: цель — ближайший заражённый в пределах дальности и в прямой видимости.
func attack() -> void:
	var w := W()
	var id := weapon_id()
	var target = game.nearest_enemy(global_position, float(w.get("range", 2.0)), true)
	if target:
		var to: Vector3 = target.global_position - global_position
		rotation.y = atan2(to.x, to.z)
	if w.get("slot", "") == "melee":
		cooldown = float(w.get("cooldown", 0.8))
		busy = 0.55
		play(clips()["attack"], 0.06, true)
		pending.append({"t": float(w.get("hitTime", 0.3)), "fn": _melee_hit})
		return
	cooldown = float(w.get("auto", w.get("cooldown", 0.2)))
	aim_t = 1.4
	busy = 0.1
	play(clips().get("shoot", clips()["idle"]), 0.04, true)
	game.fire_shot(self, w, target, muzzle_pos())
	wear[id] = wear_of(id) - 1
	if wear[id] <= 0:
		break_weapon(id)
	game.hud_refresh()

func _melee_hit() -> void:
	if not alive:
		return
	var w := W()
	var id := weapon_id()
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var best = null
	var bd := 1e9
	for e in game.enemies:
		if not e.alive:
			continue
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		var d := to.length()
		if d > float(w.get("range", 2.0)) + float(e.T["radius"]):
			continue
		if d > 0.3 and fwd.dot(to / d) < cos(float(w.get("arc", 1.0))):
			continue
		if d < bd:
			bd = d
			best = e
	game.noise(global_position, float(w.get("noise", 6)))
	if best == null:
		return
	best.damage(float(w.get("damage", 12)), global_position)
	if w.has("durability"):
		wear[id] = wear_of(id) - 1
		if wear[id] <= 0:
			break_weapon(id)
	game.hud_refresh()

## Износ кончился: оружие ломается и пропадает (топор → кулаки, ствол → в руках топор).
func break_weapon(id: String) -> void:
	game.toast("%s сломался" % Data.weapon(id).get("name", id))
	wear.erase(id)
	if kit.get("melee", "") == id:
		kit["melee"] = "fists"
	if kit.get("gun", "") == id:
		kit["gun"] = ""
		hold = "melee"
	if models.has(id):
		_put(models[id], null)
		models[id].queue_free()
		models.erase(id)
	attach_gear()

## Смена оружия анимацией: убрать текущее на тело, достать другое.
func switch_weapon() -> void:
	if not alive or equipping or busy > 0.0:
		return
	var gun_id: String = kit.get("gun", "")
	if gun_id == "":
		game.toast("Огнестрела нет — купи в стабе или найди")
		return
	var to := "gun" if hold == "melee" else "melee"
	var kind: String = Data.weapon(gun_id).get("anim", "rifle")
	var eq: Dictionary = EQUIP.get(kind, EQUIP["rifle"])
	var c: String = eq["draw"] if to == "gun" else eq["stow"]
	equipping = true
	play(c, 0.1, true)
	var length := anim.get_animation(c).length if anim.has_animation(c) else 0.8
	pending.append({"t": length * 0.45, "fn": _take.bind(to)})
	pending.append({"t": length * 0.9, "fn": _equipped})

func _take(to: String) -> void:
	hold = to
	attach_gear()

func _equipped() -> void:
	equipping = false
	clip = ""

func hurt(dmg: float, from: Vector3) -> void:
	if not alive:
		return
	hp -= dmg
	last_hurt = game.time
	game.on_player_hurt(dmg)
	var push := global_position - from
	push.y = 0
	if push.length() > 0.01:
		velocity = push.normalized() * 2.0
		move_and_slide()
	if hp <= 0.0:
		die()
	elif busy <= 0.0 and not equipping:
		play(clips()["hit"], 0.06, true)
		busy = 0.3

func die() -> void:
	if not alive:
		return
	hp = 0.0
	alive = false
	anim.speed_scale = 1.0
	play("Death", 0.1, true)
	died.emit()

## Здоровье понемногу возвращается, если давно не били.
func regen(delta: float) -> void:
	if alive and game.time - last_hurt > 6.0 and hp < max_hp:
		hp = minf(max_hp, hp + delta * 3.0)
