extends Node
## Автотест анимаций героя (система main.gd, строка в FEATURE_SCRIPTS; в обычной игре ничего не делает):
## AnimationTree активен; смена оружия проходит стадии «опустить → убрать → взять → поднять» и кончается нужным
## оружием; у автомата левая кисть на цевье (IK к GripL), у топора IK выключен; стрельба на ходу — ноги в клипе
## шага, верх в прицеле/выстреле и доворачивается к цели сбоку; удар топором стоя — всем телом, на ходу — верхом.

## Неподвижная цель для стрельбы: «враждебный» (game.hostiles), которого не убить.
class Dummy extends Node3D:
	var alive := true
	var T := {"radius": 0.4}

	func damage(_dmg: float, _from: Vector3) -> void:
		pass

const STAGES := ["lower", "stow", "take", "raise", "ready"]

var game: Node
## Движение героя на время автотеста: main каждый кадр ставит move_input с экрана, эта система — после него
## (process_priority) — туда-обратно по drive, чтобы не упереться в стену.
var drive := Vector2.ZERO
var drive_t := 0.0

func setup(g: Node) -> void:
	game = g
	process_priority = 100

func _process(delta: float) -> void:
	if drive == Vector2.ZERO or game == null or game.player == null:
		return
	drive_t += delta
	game.player.move_input = drive * (1.0 if int(drive_t / 0.5) % 2 == 0 else -1.0)

func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1

func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout

func _drive(dir: Vector2) -> void:
	drive = dir
	drive_t = 0.0
	if dir == Vector2.ZERO and game.player:
		game.player.move_input = Vector2.ZERO

## Дождаться конца смены оружия (не дольше 4 с).
func _equip_done(p: Player) -> void:
	for _i in 80:
		if not p.equipping:
			return
		await _wait(0.05)

## Место для цели: в прямой видимости, 4–6 м сбоку, и чтобы герою было где пройти поперёк линии огня.
func _side_spot(p: Player) -> Array:
	var at := p.global_position
	for dist in [5.0, 4.0, 6.0, 3.0]:
		for k in 8:
			var a := TAU * k / 8.0
			var d := Vector3(sin(a), 0.0, cos(a))
			var pos: Vector3 = at + d * float(dist)
			var side := Vector3(d.z, 0.0, -d.x)
			if game.level.blocked_at(pos) or game.level.blocked_at(at + side * 0.9) or game.level.blocked_at(at - side * 0.9):
				continue
			if game.line_of_sight(at, pos):
				return [pos, Vector2(side.x, side.z), true]
	return [at + Vector3(0, 0, 5), Vector2(1, 0), false]

func smoke() -> int:
	var fails := 0
	# стаб: без заражённых — никто не сбивает позы ударами
	game.enter("stab", null)
	await _wait(0.6)
	var p: Player = game.player
	var tr: AnimationTree = p.anim_tree
	if tr == null or p.pose == null:
		return _check(false, "герой без AnimationTree или модификатора позы")
	fails += _check(tr.active and str(tr.get("parameters/life/current_state")) == "alive", "AnimationTree активен: низ — %s, верх — %s" % [tr.get("parameters/loco/current_state"), p.upper])
	fails += _check(p.pose.frames > 0, "модификатор позы (корпус, отдача, IK) работает: кадров %d" % p.pose.frames)
	# в руках топор: IK левой кисти выключен
	if p.hold == "gun":
		p.switch_weapon()
		await _equip_done(p)
	p.kit["gun"] = "ak74"
	p.wear["ak74"] = int(Data.weapon("ak74")["durability"])
	p.attach_gear()
	await _wait(0.5)
	fails += _check(p.hold == "melee" and p.pose.ik_weight < 0.05, "%s в руке: IK левой кисти выключен (вес %.2f)" % [p.weapon_id(), p.pose.ik_weight])
	# смена на автомат по стадиям
	p.switch_weapon()
	var seen := []
	for _i in 80:
		if not seen.has(p.upper):
			seen.append(p.upper)
		if not p.equipping:
			break
		await _wait(0.05)
	fails += _check(p.equip_log == STAGES and p.hold == "gun" and p.weapon_id() == "ak74", "смена на автомат: %s → в руках %s (верх: %s)" % [" → ".join(PackedStringArray(p.equip_log)), p.weapon_id(), ", ".join(PackedStringArray(seen))])
	await _wait(0.5)
	fails += _check(p.pose.ik_weight > 0.95 and p.pose.ik_error >= 0.0 and p.pose.ik_error < 0.04, "АК-74: левая кисть на цевье (IK к GripL, вес %.2f, промах %.1f см, перехват ближе на %.1f см)" % [p.pose.ik_weight, p.pose.ik_error * 100.0, p.pose.ik_slide * 100.0])
	# стрельба на ходу по цели сбоку: ноги шагают поперёк, верх целится
	var spot: Array = _side_spot(p)
	var side: Vector2 = spot[1]
	var dummy := Dummy.new()
	game.add_child(dummy)
	dummy.global_position = spot[0]
	game.hostiles.append(dummy)
	var w0: int = p.wear_of("ak74")
	p.attack_held = true
	_drive(side * 0.35)
	await _wait(0.4)
	var samples := 0
	var good := 0
	var held := 0
	var fired := false
	var max_twist := 0.0
	var side_blend := 0.0   # у набора по направлениям: ход вбок в осях корпуса (|x| точки смешивания клипов)
	for _i in 36:
		await _wait(0.05)
		var v := p.get_real_velocity()
		v.y = 0.0
		if v.length() < 0.5:
			continue
		samples += 1
		var shooting := bool(tr.get("parameters/shot/active"))
		fired = fired or shooting
		if str(tr.get("parameters/loco/current_state")) == "walk" and (float(tr.get("parameters/aim_mix/blend_amount")) > 0.9 or shooting):
			good += 1
		if p.pose.ik_weight > 0.9 and p.pose.ik_error >= 0.0 and p.pose.ik_error < 0.05:
			held += 1
		max_twist = maxf(max_twist, absf(p.pose.twist))
		side_blend = maxf(side_blend, absf(p.move_dir_local.x))
	p.attack_held = false
	_drive(Vector2.ZERO)
	game.hostiles.erase(dummy)
	dummy.queue_free()
	fails += _check(samples >= 10 and good >= samples * 0.8, "стрельба на ходу: ноги — клип шага, верх — прицел/выстрел (%d из %d)" % [good, samples])
	fails += _check(fired and p.wear_of("ak74") < w0, "выстрелы на ходу: износ АК-74 %d → %d" % [w0, p.wear_of("ak74")])
	if spot[2]:
		if p.directional():
			# автомат: корпус к цели, ноги идут вбок клипом хода вбок — позвоночник не скручивается
			fails += _check(side_blend > 0.6 and max_twist < 0.35, "цель сбоку: ноги идут вбок клипом направления (ход в осях корпуса %.2f), позвоночник не скручен (%d°)" % [side_blend, int(rad_to_deg(max_twist))])
		else:
			fails += _check(max_twist > 0.5, "верх доворачивается к цели сбоку, ноги идут по ходу: разворот корпуса до %d°" % int(rad_to_deg(max_twist)))
	else:
		print("  · цель сбоку поставить негде — разворот корпуса не проверен")
	fails += _check(samples > 0 and held >= samples * 0.8, "левая кисть держит цевьё при стрельбе на ходу (%d из %d)" % [held, samples])
	# обратно на топор: те же стадии, IK выключается
	await _wait(0.3)
	p.switch_weapon()
	await _equip_done(p)
	fails += _check(p.equip_log == STAGES and p.hold == "melee", "смена на топор: %s → в руках %s" % [" → ".join(PackedStringArray(p.equip_log)), p.weapon_id()])
	await _wait(0.3)
	fails += _check(p.pose.ik_weight < 0.05, "топор: IK левой кисти выключен (вес %.2f)" % p.pose.ik_weight)
	# удар топором: стоя — всем телом, на ходу — только верх, ноги шагают
	p.attack_held = true
	await _wait(0.12)
	var full := bool(tr.get("parameters/act_up/active")) and bool(tr.get("parameters/act_low/active"))
	var swing := p.upper
	p.attack_held = false
	await _wait(1.0)
	_drive(side * 0.35)
	await _wait(0.3)
	p.attack_held = true
	await _wait(0.12)
	var top := bool(tr.get("parameters/act_up/active")) and not bool(tr.get("parameters/act_low/active")) and str(tr.get("parameters/loco/current_state")) == "walk"
	p.attack_held = false
	_drive(Vector2.ZERO)
	fails += _check(full and top, "удар топором (%s): стоя — всем телом (%s), на ходу — верхом, ноги шагают (%s)" % [swing, full, top])
	await _wait(0.8)
	return fails
