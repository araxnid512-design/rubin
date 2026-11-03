extends CharacterBody3D
## Наёмник на сцене (перенос класса Merc из game/main.js). Модель героя со своей окраской одежды, постоянное
## оружие бойца — в хвате GripR. В отряде (st.out) идёт за героем в строю (spot: первые двое — сзади слева
## и справа, третий и четвёртый — шире и дальше; дистанция — по классу), сам выбирает цель по классу
## и стреляет через game.fire_shot. Патронов нет: каждый выстрел изнашивает оружие (st.wear), на нуле оно
## ломается — безоружный бесполезен, жмётся к герою и отходит от заражённых; чинят в комнате в стабе.
## Медик лечит живчиками из своей аптечки, подрывник кидает Ф-1 (упрощённо: взрыв на месте падения).
## Оставлен в стабе — идёт к своей койке и ждёт там. Заражённые бросаются и на бойца (game.targets):
## alive, global_position, hurt(dmg, from); пуля мура — damage(dmg, from).

## Естественная скорость клипов ходьбы и бега героя, м/с (как Player.GAIT): темп подгоняется под скорость.
const GAIT := {"walk": 1.397, "run": 4.16}
## «Руки заняты» (перевязка у медика) — клип перезарядки под тип оружия.
const RELOAD := {"rifle": "ReloadRifle", "pistol": "Reload", "axe": "Reload"}
## Сколько здоровья даёт живчик из аптечки медика.
const HEAL := 60.0
## Граната подрывника: радиус осколков, урон в центре заражённым и своим (как в браузерной игре).
const NADE_R := 6.0
const NADE_DMG := 170.0
const NADE_FRIENDLY := 80.0

var game: Node
var mgr: Node
var st: Dictionary = {}
var D: Dictionary = {}
var C: Dictionary = {}
var W: Dictionary = {}
var CL: Dictionary = {}
var is_merc := true
var type := "merc"
var T := {"radius": 0.38}
var alive := true
var max_hp := 100.0
## Здоровье хранится в состоянии бойца (st.hp) — оно же уходит в сохранение.
var hp: float:
	get:
		return float(st.get("hp", 0.0))
	set(v):
		st["hp"] = v
var slot := 0
var model: Node3D
var anim: AnimationPlayer
## Поза оружия поверх клипа: переноска и левая кисть на цевье (npc_pose.gd) — клипы сделаны под старые стволы.
var npc: NpcPose
## FPS: у своей койки боец только стоит — клип и поза рук «лениво» (AnimLod: 15 шагов в секунду, за кадром — не
## считать); в деле (идёт, в отряде, бой, гибель) — каждый кадр, как раньше. См. _rest и _live.
var lod: AnimLod
var grip: Node3D
var gun: Node3D
var clip := ""
var cooldown := 0.0
var burst_left := 0
var retarget := 0.0
var target = null
var planted := 0.0
## Идёт разовый клип (выстрел, удар по бойцу, перевязка, бросок) — ходьба и стойка его не перебивают.
var act_t := 0.0
var treating := {}
var heal_t := 0.0
var nade_t := 1.5
var throwing := {}
var dead_t := 0.0
var path := PackedVector3Array()
var path_t := 0.0
## Герой погиб: бойцы не воюют и не получают урон, пока его не вытащат в стаб.
var frozen := false

func setup(g: Node, m: Node, state: Dictionary, def: Dictionary, cls: Dictionary) -> void:
	game = g
	mgr = m
	st = state
	D = def
	C = cls
	W = Data.weapon(str(D["weapon"]))
	max_hp = float(D["hp"])
	CL = Player.CLIPS.get(str(W.get("anim", "rifle")), Player.CLIPS["rifle"])
	name = "Merc_%s" % st["id"]
	collision_layer = 8
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
	Level.rim(model)
	anim = model.find_child("AnimationPlayer", true, false)
	for c in Player.LOOPED:
		if anim and anim.has_animation(c):
			anim.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	var tint: Array = D.get("tint", [1.0, 1.0, 1.0])
	_tint(Color(float(tint[0]), float(tint[1]), float(tint[2])))
	grip = Player.attach_point(model, "GripR")
	gun = Gear.weapon(str(W.get("model", D["weapon"])))
	if grip:
		Gear.put_in_hand(gun, grip)
	else:
		add_child(gun)
	gun.visible = not broken()
	npc = NpcPose.make_for_old(model)
	if npc:
		(model.find_children("*", "Skeleton3D", true, false)[0] as Skeleton3D).add_child(npc)
		npc.set_weapon(gun, str(D["weapon"]))
	Level.npc_lod(model)
	play(str(CL["idle"]), 0.0)
	if anim:
		anim.seek(randf() * 2.0, true)
		lod = AnimLod.new(anim)

## Своя окраска: одежда и снаряжение (материалы Cloth и Gear) умножаются на цвет бойца.
func _tint(t: Color) -> void:
	for n in model.find_children("*", "MeshInstance3D", true, false):
		var mi: MeshInstance3D = n
		if mi.mesh == null:
			continue
		for i in mi.mesh.get_surface_count():
			var mat := mi.get_active_material(i)
			if mat is BaseMaterial3D and (mat.resource_name.contains("Cloth") or mat.resource_name.contains("Gear")):
				var m2: BaseMaterial3D = mat.duplicate()
				var a := m2.albedo_color
				m2.albedo_color = Color(a.r * t.r, a.g * t.g, a.b * t.b, a.a)
				mi.set_surface_override_material(i, m2)

func play(c: String, blend := 0.15, restart := false, tempo := 1.0) -> void:
	if anim == null or not anim.has_animation(c):
		return
	anim.speed_scale = tempo
	if c == clip and not restart:
		return
	clip = c
	anim.play(c, blend)
	if restart:
		anim.seek(0.0, true)
	if npc:
		npc.touch()   # кости сменятся не по шагу AnimLod — поза рук пересчитается и в «ленивом» режиме

## Стоит у своей койки без дела: клип — шагом AnimLod и только в кадре; поза рук (NpcPose) — в кадре каждый кадр,
## за кадром не считается. Было: анимация, IK обеих рук на GDScript и скининг ~23 тыс. вершин у каждого из шести
## бойцов каждый кадр, даже когда комната за кадром.
func _rest(delta: float) -> void:
	if lod == null:
		return
	var seen := _on_screen(global_position)
	# поза рук (IK) в кадре — каждый кадр: скелет после каждого кадра возвращает кости к клипу, и без IK руки между
	# шагами клипа мигали бы мимо оружия; за кадром — не считать вовсе
	if npc:
		npc.lazy = not seen
	if lod.lazy(delta, seen) and npc:
		npc.touch()

## В деле: анимация и поза рук — каждый кадр, как раньше.
func _live() -> void:
	if lod:
		lod.live()
	if npc:
		npc.lazy = false

## Оружие сломано (износ на нуле): стрелять нечем.
func broken() -> bool:
	return int(st.get("wear", 0)) <= 0

func _flat(v: Vector3) -> Vector3:
	return Vector3(v.x, 0, v.z)

func _angle_to(pos: Vector3) -> float:
	var to := _flat(pos - global_position)
	return atan2(to.x, to.z) if to.length() > 0.001 else rotation.y

func _on_screen(pos: Vector3) -> bool:
	var cam: Camera3D = game.camera
	return cam != null and cam.is_position_in_frustum(pos + Vector3(0, 1.0, 0))

## Точка в строю: первые двое — сзади-слева и сзади-справа, третий и четвёртый — шире и дальше; снайпер — дальше,
## медик — ближе (keep класса). Безоружный жмётся к герою.
func spot() -> Vector3:
	var p: Player = game.player
	var row := slot >> 1
	var side := 1.0 if slot % 2 == 1 else -1.0
	var a := p.rotation.y + PI + side * (0.65 + row * 0.5)
	var k := float(C.get("keep", 2.3)) + row * 1.3
	if broken():
		k = 1.4 + row * 0.7
	return p.global_position + Vector3(sin(a) * k, 0, cos(a) * k)

## Поставить рядом с героем (пришёл в локацию с героем, отстал вне экрана).
func place() -> void:
	var p: Player = game.player
	var s := spot()
	if game.level.blocked_at(s):
		s = p.global_position
		for i in 8:
			var a := TAU * float(i) / 8.0 + float(slot)
			var q := p.global_position + Vector3(cos(a), 0, sin(a)) * 1.3
			if not game.level.blocked_at(q):
				s = q
				break
	global_position = Vector3(s.x, 0, s.z)
	rotation.y = p.rotation.y
	path = PackedVector3Array()
	path_t = 0.0

func _muzzle() -> Vector3:
	if gun != null and gun.visible:
		var m := Gear.point(gun, "MuzzlePoint")
		if m is Node3D:
			return (m as Node3D).global_position
	if grip != null:
		return grip.global_position
	return global_position + Vector3(0, 1.3, 0) + Vector3(sin(rotation.y), 0, cos(rotation.y)) * 0.6

func _physics_process(delta: float) -> void:
	if not alive:
		dead_t += delta
		if dead_t > 12.0:
			queue_free()
		return
	if game == null or game.level == null or game.player == null:
		return
	if npc:
		# переноска — когда стоит, идёт или бежит; левая кисть на цевье, пока ствол цел
		var calm := clip == str(CL["idle"]) or clip == str(CL["walk"]) or clip == str(CL["run"])
		npc.carry = move_toward(npc.carry, 1.0 if calm and gun.visible else 0.0, delta / 0.2)
		npc.left = move_toward(npc.left, 1.0 if gun.visible and clip != str(CL.get("reload", "")) else 0.0, delta / 0.15)
	cooldown -= delta
	act_t -= delta
	retarget -= delta
	path_t -= delta
	var p: Player = game.player
	if frozen or not p.alive:
		_live()
		_stand(str(CL["idle"]))
		return
	if not bool(st.get("out", false)):
		_stay_home(delta)
		return
	_live()
	if not throwing.is_empty():
		_throw_step(delta)
		return
	var dP := _flat(p.global_position - global_position).length()
	# отстал или застрял вне экрана — догоняет (появляется рядом с героем)
	if dP > 26.0 and not _on_screen(global_position):
		place()
		return
	# медик: раненый рядом важнее стрельбы; подрывник: граната в кучу заражённых
	if bool(C.get("heals", false)) and _medic(delta):
		return
	if bool(C.get("grenades", false)) and _sapper(delta):
		return
	if not is_instance_valid(target) or not target.alive:
		target = null
	if retarget <= 0.0:
		retarget = 0.35
		# та же дальность, что у героя с этим оружием
		target = null if broken() else _pick_target(float(W.get("range", 8.0)))
	var t = target
	# снайпер вблизи беззащитен, безоружный — тем более: от заражённого вплотную отходят (к герою)
	var kite := float(C.get("kite", 0.0))
	if broken():
		kite = 4.0
	var close = _nearest_foe(kite, false) if kite > 0.0 else null
	var keep := float(C.get("keep", 2.3))
	var follow := dP > ((12.0 + keep - 2.3) if t != null else (keep + 1.1))
	var shooting := false
	if t != null and not follow and close == null:
		shooting = true
		var want := _angle_to(t.global_position)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, delta * 8.0))
		var facing := absf(wrapf(want - rotation.y, -PI, PI)) < 0.35
		# пулемётчик сначала встаёт и упирает приклад
		var steady := not bool(C.get("plant", false)) or planted > 0.45
		if cooldown <= 0.0 and facing and steady:
			_fire(t)
	# строй: держится сзади героя; во время стрельбы стоит
	var s := spot()
	var dS := _flat(s - global_position).length()
	if close != null or (not shooting and dS > 0.9) or follow:
		var dir: Vector3
		if close != null:
			dir = _flat(global_position - close.global_position).normalized()
			if dP > 0.01:
				dir += _flat(p.global_position - global_position) / dP * 0.6
			dir = dir.normalized()
		else:
			dir = _dir_to(s)
		var run := close != null or dP > 6.0 or dS > 4.0
		var spd := (4.6 if run else minf(1.7, 0.6 + dS)) * (0.88 if bool(C.get("plant", false)) else 1.0)
		_walk(dir, spd, run, not shooting or close != null, delta)
		planted = 0.0
	else:
		planted += delta
		velocity = Vector3.ZERO
		if act_t <= 0.0:
			play(str(CL["aim"] if shooting and CL.has("aim") else CL["idle"]), 0.2)

func _stand(c: String) -> void:
	velocity = Vector3.ZERO
	if act_t <= 0.0:
		play(c, 0.2)

## Шаг в сторону dir: не наступает на героя и соседей; turn — разворачиваться по ходу.
func _walk(dir: Vector3, spd: float, run: bool, turn: bool, delta: float) -> void:
	var others: Array = [game.player]
	others.append_array(mgr.actors)
	for o in others:
		if not is_instance_valid(o) or o == self or not o.alive:
			continue
		var off := _flat(global_position - o.global_position)
		var d := off.length()
		if d < 0.8 and d > 0.0001:
			dir += off / d * (0.8 - d) * 3.0
	if dir.length() < 0.01:
		_stand(str(CL["idle"]))
		return
	dir = dir.normalized()
	velocity = dir * spd
	move_and_slide()
	if turn:
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 10.0))
	if act_t <= 0.0 or run:
		var c: String = CL["run"] if run else CL["walk"]
		play(c, 0.18, false, clampf(spd / float(GAIT["run" if run else "walk"]), 0.6, 1.5))

## Куда идти к точке: напрямую, если видно, иначе — по сетке проходимости уровня (путь обновляется раз в ~0,7 с).
func _dir_to(goal: Vector3) -> Vector3:
	if path_t <= 0.0:
		path_t = 0.6 + randf() * 0.3
		if game.line_of_sight(global_position, goal):
			path = PackedVector3Array()
		else:
			path = game.level.path(global_position, goal)
	while not path.is_empty() and _flat(path[0] - global_position).length() < 0.5:
		path.remove_at(0)
	var g := goal
	if not path.is_empty():
		g = path[0]
	var dir := _flat(g - global_position)
	return dir.normalized() if dir.length() > 0.01 else Vector3.ZERO

## Можно ли стрелять в этого врага (бочки с горючим, если они среди hostiles, бойцы не трогают).
func _usable(e) -> bool:
	if not is_instance_valid(e) or not e.alive:
		return false
	var b = e.get("is_barrel")
	if typeof(b) == TYPE_BOOL and b:
		return false
	return not str(e.get("type")).contains("barrel")

## Ближайший враг (заражённый или враждебный) в пределах reach; need_los — только видимый.
func _nearest_foe(reach: float, need_los: bool):
	var cands := []
	for e in game.foes():
		if not _usable(e):
			continue
		var d := _flat(e.global_position - global_position).length()
		if d < reach:
			cands.append([d, e])
	cands.sort_custom(func(a, b): return a[0] < b[0])
	for c in cands:
		if not need_los or game.line_of_sight(global_position, c[1].global_position):
			return c[1]
	return null

## Цель по классу: обычно — ближайший видимый. Снайпер сначала снимает тех, кто вцепился в героя, потом
## враждебных людей, руберов и топтунов, потом самых дальних.
func _pick_target(reach: float):
	if str(C.get("prefer", "")) != "far":
		return _nearest_foe(reach, true)
	var p: Player = game.player
	var best = null
	var score := -INF
	for e in game.foes():
		if not _usable(e):
			continue
		var d := _flat(e.global_position - global_position).length()
		if d > reach or not game.line_of_sight(global_position, e.global_position):
			continue
		var on_hero := _flat(e.global_position - p.global_position).length() < 3.0
		var ty := str(e.get("type"))
		var bonus := 150.0 if ty == "ruber" else (100.0 if ty == "stomper" else (50.0 if ty == "lottery" else (0.0 if ty == "runner" else 200.0)))
		var sc := (1000.0 if on_hero else 0.0) + bonus + d
		if sc > score:
			score = sc
			best = e
	return best

## Выстрел; у автоматов — очередями по классу (штурмовик 3–5, пулемётчик 9–15) с паузами. Износ — на выстрел.
func _fire(t) -> void:
	rotation.y = _angle_to(t.global_position)
	play(str(CL.get("shoot", CL["idle"])), 0.04, true)
	act_t = 0.18
	var auto := float(W.get("auto", W.get("cooldown", 0.5)))
	if auto < 0.2:
		var b: Array = C.get("burst", [3, 5])
		if burst_left > 0:
			burst_left -= 1
		else:
			burst_left = int(b[0]) - 1 + randi() % (int(b[1]) - int(b[0]) + 1)
		cooldown = auto if burst_left > 0 else (0.6 if bool(C.get("plant", false)) else 0.45) + randf() * 0.4
	else:
		cooldown = auto + randf() * 0.15
	game.fire_shot(self, W, t, _muzzle())
	st["wear"] = int(st.get("wear", 0)) - 1
	if int(st["wear"]) <= 0:
		_break()

## Износ кончился: оружие сломалось (в руках пусто), боец держится за героем, пока не починят в стабе.
func _break() -> void:
	st["wear"] = 0
	if gun:
		gun.visible = false
	target = null
	burst_left = 0
	game.toast("%s: %s сломался — без оружия держится за тобой. Починить — в твоей комнате в стабе" % [D["name"], W.get("name", "")])
	mgr.refresh_bar()

## Медик: раненый (герой или боец отряда меньше чем на половине) — подбегает и лечит живчиком из аптечки.
func _medic(delta: float) -> bool:
	if not treating.is_empty():
		treating["t"] = float(treating["t"]) - delta
		var who = treating["who"]
		velocity = Vector3.ZERO
		if is_instance_valid(who) and who != self:
			rotation.y = lerp_angle(rotation.y, _angle_to(who.global_position), minf(1.0, delta * 8.0))
		if float(treating["t"]) <= 0.0:
			treating = {}
			heal_t = 2.5
			if is_instance_valid(who) and who.alive and int(st.get("meds", 0)) > 0:
				st["meds"] = int(st["meds"]) - 1
				who.hp = minf(who.max_hp, who.hp + HEAL)
				var whom := "тебя" if who == game.player else ("себя" if who == self else str(who.D["name"]))
				game.toast("%s перевязал %s: +%d%s" % [D["name"], whom, int(HEAL), "" if int(st["meds"]) > 0 else " · аптечка пуста"])
				game.hud_refresh()
				mgr.refresh_bar()
		return true
	heal_t -= delta
	if heal_t > 0.0 or int(st.get("meds", 0)) <= 0:
		return false
	var p: Player = game.player
	var who = null
	if p.alive and p.hp < p.max_hp * 0.5:
		who = p
	if who == null:
		for a in mgr.party_actors():
			if is_instance_valid(a) and a != self and a.alive and a.hp < a.max_hp * 0.5:
				who = a
				break
	if who == null and hp < max_hp * 0.5:
		who = self
	if who == null:
		return false
	var d := 0.0 if who == self else _flat(who.global_position - global_position).length()
	if d > 1.3:
		_walk(_dir_to(who.global_position), 4.6, true, true, delta)
		return true
	# рядом: перевязка (достаёт живчик и колет — та же анимация рук, что при перезарядке)
	treating = {"who": who, "t": 0.9}
	velocity = Vector3.ZERO
	var rc: String = RELOAD.get(str(W.get("anim", "rifle")), "ReloadRifle")
	var length := anim.get_animation(rc).length if anim and anim.has_animation(rc) else 0.9
	play(rc, 0.1, true, length / 0.9)
	act_t = 0.9
	return true

## Подрывник: раз в секунду ищет, куда бросить Ф-1 — топтун или кучка из трёх и больше заражённых в 6–16 м,
## и чтобы ни героя, ни бойцов отряда не было ближе 7 м к цели. Граната выдержана в руке: рвётся почти сразу.
func _sapper(delta: float) -> bool:
	nade_t -= delta
	if nade_t > 0.0 or int(st.get("nades", 0)) <= 0:
		return false
	nade_t = 1.0
	var friends: Array = [game.player]
	friends.append_array(mgr.party_actors())
	var foes: Array = game.enemies
	var best = null
	var score := 2.0
	for e in foes:
		if not is_instance_valid(e) or not e.alive:
			continue
		var d := _flat(e.global_position - global_position).length()
		if d < 6.0 or d > 16.0:
			continue
		var n := 0
		for o in foes:
			if is_instance_valid(o) and o.alive and _flat(o.global_position - e.global_position).length() < 3.0:
				n += 1
		var ty := str(e.get("type"))
		var sc := float(n) + (3.0 if ty == "ruber" else (2.0 if ty == "stomper" else 0.0))
		if sc <= score:
			continue
		var near_friend := false
		for a in friends:
			if is_instance_valid(a) and a.alive and _flat(a.global_position - e.global_position).length() < 7.0:
				near_friend = true
		if near_friend or not game.line_of_sight(global_position, e.global_position):
			continue
		score = sc
		best = e
	if best == null:
		return false
	st["nades"] = int(st["nades"]) - 1
	nade_t = 6.0
	var to: Vector3 = best.global_position
	throwing = {"t": 0.55, "to": to, "thrown": false}
	rotation.y = _angle_to(to)
	velocity = Vector3.ZERO
	if gun:
		gun.visible = false
	play("Melee", 0.06, true, 1.25)
	act_t = 0.55
	game.toast("%s: граната!" % D["name"])
	mgr.refresh_bar()
	return true

## Бросок идёт: на взмахе граната улетает, потом в руки снова оружие.
func _throw_step(delta: float) -> void:
	velocity = Vector3.ZERO
	throwing["t"] = float(throwing["t"]) - delta
	if not bool(throwing["thrown"]) and float(throwing["t"]) <= 0.28:
		throwing["thrown"] = true
		_launch(_muzzle(), throwing["to"])
	if float(throwing["t"]) <= 0.0:
		throwing = {}
		if gun:
			gun.visible = not broken()
		clip = ""

## Граната летит дугой и рвётся через 0,3 с после падения.
func _launch(from: Vector3, to: Vector3) -> void:
	var nade := MeshInstance3D.new()
	var s := SphereMesh.new()
	s.radius = 0.06
	s.height = 0.12
	s.radial_segments = 10
	s.rings = 6
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.25, 0.3, 0.2)
	s.material = m
	nade.mesh = s
	nade.top_level = true
	add_child(nade)
	nade.global_position = from
	var d := _flat(to - from).length()
	var tw := create_tween()
	tw.tween_method(_fly.bind(nade, from, to, 1.2 + d * 0.12), 0.0, 1.0, 0.5 + d / 22.0)
	tw.tween_interval(0.3)
	tw.tween_callback(_boom.bind(nade, to))

func _fly(k: float, nade: Node3D, from: Vector3, to: Vector3, h: float) -> void:
	if is_instance_valid(nade):
		var p := from.lerp(Vector3(to.x, 0.06, to.z), k)
		p.y += sin(PI * k) * h
		nade.global_position = p

func _boom(nade: Node3D, at: Vector3) -> void:
	if is_instance_valid(nade):
		nade.queue_free()
	explode(Vector3(at.x, 0.5, at.z))

## Взрыв Ф-1: осколки ранят всех в радиусе 6 м (и героя с бойцами), шум на полкластера, вспышка и дым.
func explode(pos: Vector3) -> void:
	for e in game.foes():
		var d := _flat(e.global_position - pos).length()
		if d < NADE_R:
			e.damage(NADE_DMG * pow(1.0 - d / NADE_R, 0.7), pos)
	var friends: Array = [game.player]
	friends.append_array(mgr.party_actors())
	for a in friends:
		if is_instance_valid(a) and a.alive:
			var d2 := _flat(a.global_position - pos).length()
			if d2 < NADE_R:
				a.hurt(NADE_FRIENDLY * (1.0 - d2 / NADE_R), pos)
	game.noise(pos, 50.0)
	# системы: звук взрыва, гарь, бочки рядом рвутся цепочкой — как у гранаты героя
	for f in game.features:
		if f.has_method("on_explosion"):
			f.on_explosion(pos, NADE_R)
	var l := OmniLight3D.new()
	l.light_color = Color(1.0, 0.7, 0.35)
	l.light_energy = 8.0
	l.omni_range = 14.0
	game.add_child(l)
	l.global_position = pos + Vector3(0, 0.8, 0)
	get_tree().create_timer(0.15).timeout.connect(l.queue_free)
	var fx := CPUParticles3D.new()
	fx.one_shot = true
	fx.emitting = true
	fx.amount = 24
	fx.lifetime = 0.9
	fx.explosiveness = 1.0
	fx.spread = 180.0
	fx.direction = Vector3.UP
	fx.initial_velocity_min = 2.0
	fx.initial_velocity_max = 6.0
	fx.gravity = Vector3(0, -6.0, 0)
	var q := SphereMesh.new()
	q.radius = 0.12
	q.height = 0.24
	q.radial_segments = 6   # частица вспышки: по умолчанию сфера — 4096 треугольников
	q.rings = 3
	var qm := StandardMaterial3D.new()
	qm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	qm.albedo_color = Color(1.0, 0.6, 0.25)
	q.material = qm
	fx.mesh = q
	game.add_child(fx)
	fx.global_position = pos
	get_tree().create_timer(1.5).timeout.connect(fx.queue_free)

## Оставлен в стабе: идёт к своей койке (по сетке проходимости) и ждёт там; к подошедшему герою поворачивается.
func _stay_home(delta: float) -> void:
	var h: Dictionary = mgr.home_of(st)
	if h.is_empty():
		_live()
		_stand(str(CL["idle"]))
		return
	var home: Vector3 = h["pos"]
	var d := _flat(home - global_position).length()
	if d > 0.3:
		_live()
		# боец и койка вне экрана — сразу у койки
		if not _on_screen(global_position) and not _on_screen(home):
			global_position = home
			rotation.y = float(h["ry"])
			velocity = Vector3.ZERO
			return
		var dir := _dir_to(home)
		for a in mgr.actors:
			if not is_instance_valid(a) or a == self or not a.alive:
				continue
			var off := _flat(global_position - a.global_position)
			var r := off.length()
			if r < 0.8 and r > 0.0001:
				dir += off / r * (0.8 - r) * 2.0
		if dir.length() < 0.01:
			_stand(str(CL["idle"]))
			return
		dir = dir.normalized()
		var spd := 3.4 if d > 4.0 else minf(1.7, 0.6 + d)
		if d > 0.6:
			velocity = dir * spd
			move_and_slide()
		else:
			# у самой койки — без столкновений (место у кровати впритык к мебели)
			velocity = Vector3.ZERO
			global_position += dir * minf(spd * delta, d)
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), minf(1.0, delta * 10.0))
		var run := d > 4.0
		var c: String = CL["run"] if run else CL["walk"]
		play(c, 0.18, false, clampf(spd / float(GAIT["run" if run else "walk"]), 0.6, 1.5))
	else:
		velocity = Vector3.ZERO
		var p: Player = game.player
		var want := float(h["ry"])
		if p != null and p.alive and _flat(p.global_position - global_position).length() < 3.5:
			want = _angle_to(p.global_position)
		rotation.y = lerp_angle(rotation.y, want, minf(1.0, delta * 3.0))
		if act_t <= 0.0:
			play(str(CL["idle"]), 0.3)
			_rest(delta)
		else:
			_live()

## Удар заражённого (или пуля мура через damage): отталкивает, на нуле — гибель.
func hurt(dmg: float, from: Vector3) -> void:
	if not alive or frozen:
		return
	hp = hp - dmg
	var push := _flat(global_position - from)
	if push.length() > 0.01:
		velocity = push.normalized() * 2.0
		move_and_slide()
	if hp <= 0.0:
		die()
	elif act_t <= 0.0 and treating.is_empty() and throwing.is_empty():
		play(str(CL["hit"]), 0.06, true)
		act_t = 0.3

func damage(dmg: float, from: Vector3) -> void:
	hurt(dmg, from)

func die() -> void:
	if not alive:
		return
	alive = false
	hp = 0.0
	collision_layer = 0
	collision_mask = 0
	velocity = Vector3.ZERO
	treating = {}
	_live()   # клип гибели должен доиграть: после гибели _physics_process до шага AnimLod не доходит
	play("Death", 0.1, true)
	game.targets.erase(self)
	mgr.merc_died(self)
