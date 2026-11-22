class_name ULEnemy
extends CharacterBody3D
## Враг на локации. Виды и весь баланс — в data/enemies.json (KINDS): прочность, скорости, как замечает героя,
## удары, добыча. Живёт так: стоит или бродит → заметил героя (увидел, услышал выстрел, бег или шаги) → кричит →
## бежит туда, где видел его в последний раз, обходя препятствия → вплотную бьёт (у удара есть замах: урон доходит
## не сразу, от него можно отойти) → потерял из виду — доходит до последнего места, ждёт и успокаивается.
## Убит — падает в сторону удара; тело можно обыскать (добыча — в ячейках loot); через CORPSE_S секунд тело
## исчезает, обыскали его или нет.

signal hit_player(dmg: float, from: Vector3)
signal noise(kind: String, at: Vector3)      ## голос: growl — рычит, roar — кричит, zdeath — предсмертный

const CORPSE_S := 60.0
const CONFIG := "res://data/enemies.json"
static var KINDS: Dictionary = _load_kinds()

var kind := "infected"
var def := {}
var hp := 60.0
var state := "idle"               ## idle — стоит, wander — бродит, alert — заметил и кричит, chase — бежит, attack — бьёт, rock — бросает камень, dead — убит
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
var _hit_reach := 1.0             ## до какого расстояния доходит начатый удар
var _atk_t := 0.0                 ## сколько идёт удар
var _snap_at := -1.0              ## когда замах сменяется рывком
var _lunge_t := 0.0               ## сколько ещё длится выпад вперёд
var _atk_rate := 1.0              ## своя скорость клипа удара
var _snap_rate := 1.0             ## во сколько раз рывок быстрее клипа
var force_clip := ""              ## проверки: бить только этим ударом
var _menace := false
var _still := 0.0
var _fx_t := 99.0                 ## сколько прошло с начала удара (для когтей и выпада головы)
var _fx_len := 1.0
var _fx_bite := false
var _twist := INF                 ## падая от удара сбоку, разворачивается к нему лицом (и валится от него)
var _rng := RandomNumberGenerator.new()
var _path: PackedVector3Array = []   ## путь по карте проходимости к месту, где видели героя
var _path_t := 0.0
var _path_to := Vector3.INF
var wander_r := 5.0               ## насколько отходит от своего места, бродя (в комнате — меньше; 0 — стоит)
var charges := 0                  ## сколько раз сорвался в рывок (для проверок)
var _charge_t := 0.0              ## рывок: сколько ещё длится
var _charge_cd := 0.0             ## и через сколько возможен следующий
var rock: ULRock = null           ## бросок камня, который сейчас готовит или уже бросил (метка, булыжник)
var rocks := 0                    ## сколько раз начинал бросок (для проверок)
var sky: Callable                 ## спросить мир: под открытым небом ли он сам и герой (в помещении камни не бросает)
var throw_ok := true              ## что мир ответил в последний раз (для проверок)
var _rock_cd := 0.0               ## через сколько возможен следующий бросок
var _rock_t := 0.0                ## сколько прошло с появления метки
var _rock_step := 0               ## 0 — вырывает камень, 1 — держит, 2 — замах броска, 3 — бросил
var _rock_plan := {}              ## по секундам: grab — камень в руках, swing — начало броска, rel — бросок, end — конец
static var hear_k := 1.0             ## дар «Тихий шаг» (ULGifts): во сколько раз ближе слышат шаги и бег героя
static var luck_k := 1.0             ## дар «Фарт»: спораны в телах ×k, шанс гороха ×k (при появлении врага)
## Голод (world.gd: _evo_tick, data/evolve.json): голодный пустыш идёт к телу (feed_at), ест feed_need секунд и
## перерождается — превращение делает мир (видит fed). Заметил героя, услышал выстрел, ранен — бросает еду.
var feed_at := Vector3.INF
var feed_t := 0.0
var feed_need := 20.0
var fed := false
var _feeding := false
var _feed_go := 0.0
static var rock_next_ms := 0      ## раньше этого времени никто из Руберов новый бросок не начинает (два круга сразу — нечестно)


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
	var chg := ""
	if d.has("charge"):
		chg = " Рывок: ближе %d м срывается и %.1f с несётся со скоростью %.1f м/с, потом %d с отдышки." % [int(d.charge.from), float(d.charge.s), float(d.charge.speed), int(d.charge.cd)]
	if d.has("rock"):
		chg += " Бросок камня: с %d–%d м вырывает из земли булыжник; на земле, где стоит герой, появляется красный круг — через %d с туда прилетает камень (%d урона в круге %.1f м). Успеть выйти из круга — мимо. Раз в %d с, только под открытым небом; сильное попадание срывает бросок, а если подбежать вплотную — роняет камень и бьёт рукой." % [
			int(d.rock.from), int(d.rock.to), int(round(float(d.rock.aim_s))), int(d.rock.dmg), float(d.rock.r), int(d.rock.cd)]
	if d.has("gun"):
		var g: Dictionary = d.gun
		var gd := "%d урона за пулю" % int(g.dmg) if g.has("dmg") else "%d %% здоровья героя за выстрел" % int(round(float(g.dmg_pct) * 100.0))
		if g.has("pellets"):
			gd = "%d дробин по %.1f урона (вблизи; дальше %d м — слабее)" % [int(g.pellets), float(g.dmg), int(g.get("near", 4.0))]
		at = "%s: бьёт до %d м, %s; магазин — %d, перезарядка %.1f с" % [String(g.n), int(g.range), gd, int(g.mag), float(g.reload_s) * (float(g.mag) if g.get("reload_shell", false) else 1.0)]
		if d.has("special"):
			at += ". %s: красная полоса на полу %.1f с, потом выстрел в %d %% здоровья — успейте уйти с полосы; раз в %d с" % [String(d.special.n), float(d.special.aim_s), int(round(float(d.special.dmg_pct) * 100.0)), int(d.special.cd)]
		return [
			String(d.d),
			"Рост %d см. Прочность: %d." % [int(round(float(d.get("height", 1.78)) * 100.0)), int(d.hp)],
			"Видит героя ближе %d м, слышит %s. Заметив — вскидывает оружие и через %.1f с открывает огонь." % [int(d.see), hears, float(d.get("alert_s", 0.5))],
			"Оружие — %s." % at,
			"В теле может быть: %s." % lt,
			"Тело лежит минуту и исчезает — обыскали его или нет.",
		]
	return [
		String(d.d),
		"Рост %d см. Прочность: %d." % [int(round(float(d.get("height", 1.78)) * 100.0)), int(d.hp)],
		"Ходит: бродит шагом (%.1f м/с). Видит героя ближе %d м, слышит %s. Заметив — %sбежит к нему (%.1f м/с), обходя препятствия. Теряет, если не видит %d с и герой дальше %d м." % [float(d.walk), int(d.see), hears, "кричит и " if float(d.get("alert_s", 0.0)) > 0.0 else "", float(d.run), int(d.get("lose_s", 0)), int(d.lose)] + chg,
		"Нападает: подходит вплотную, раз в %.1f с, с замахом — от удара можно отскочить. Удары: %s." % [float(d.cd), at],
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
	collision_mask = 1 | 2           # и закрытые двери (слой 2)
	floor_snap_length = 0.45         # по лестнице вниз — не отрываясь от ступеней
	var tall := float(def.get("height", 1.78))
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = float(def.get("radius", 0.28))      # уже запаса карты путей (0,3 м): углы и торцы перил не цепляет
	cap.height = tall
	cs.shape = cap
	cs.position.y = tall * 0.5
	add_child(cs)
	rig = BCCharacter.new()
	rig.name = "Rig"
	var armed := def.has("gun")
	rig.simple = true                # без поправок под оружие; движения — клипы как есть
	rig.strike_ik = not armed        # лапа на ударе доводится до героя (_plan_strikes)
	rig.built_poses = armed          # вооружённый (мур) — стойки с оружием, как у героя
	rig.stand_clamp = not armed
	rig.fx_cfg = def.get("fx", {})
	rig.height = tall
	rig.speed_k = float(def.get("stride_k", 1.0))    # рослый — шаг длиннее: темп клипов по росту, стопы не скользят
	rig.alias = def.get("clips", {})                 # свои клипы вместо общих (главарь муров, пустыш)
	rig.extra_build = String(def.get("build", ""))   # клипы по ключевым позам сверх набора (пустыш)
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
	_rim(rig.model)
	rotation.y = _rng.randf() * TAU
	_t = _rng.randf_range(1.0, 4.0)
	_growl = _rng.randf_range(3.0, 9.0)
	loot = roll_loot(k, seed_n)


## Подсветка контура: края фигуры чуть светлее (со стороны камеры сверху враг отделяется от земли и пола).
## Материал модели общий у всех врагов этого вида — меняется один раз; на «Низкой» графике — без подсветки.
static var rim_k := 0.35


static func _rim(model: Node) -> void:
	if model == null or rim_k <= 0.0 or ULSettings.gfx < 1:
		return
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		if m.mesh == null:
			continue
		for si in m.mesh.get_surface_count():
			var mt := m.get_active_material(si) as BaseMaterial3D
			if mt == null or mt.has_meta("rim"):
				continue
			mt.set_meta("rim", true)
			mt.rim_enabled = true
			mt.rim = rim_k
			mt.rim_tint = 0.35


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
		if luck_k != 1.0 and String(l[0]) == "spore":
			n = roundi(float(n) * luck_k)
		elif luck_k != 1.0 and String(l[0]) == "pea":
			chance = minf(chance * luck_k, 1.0)
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
	return state == "idle" or state == "wander" or state == "feed"


## голод: идти к телу в точке at и есть need секунд
func start_feed(at: Vector3, need: float) -> void:
	state = "feed"
	feed_at = at
	feed_t = 0.0
	feed_need = need
	fed = false
	_feed_go = 0.0
	_path = PackedVector3Array()
	_path_to = Vector3.INF


## бросить еду (заметил героя, ранен, не дошёл)
func end_feed() -> void:
	if _feeding:
		_feeding = false
		rig.set_pose("")
	feed_at = Vector3.INF
	if state == "feed":
		state = "idle"
		_t = _rng.randf_range(1.0, 3.0)


## заметил героя: кричит (если виду положено) и только потом бежит — у игрока есть миг на решение
func _notice(at: Vector3) -> void:
	if state == "feed":
		end_feed()
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
	r *= hear_k
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
	if state == "feed":
		end_feed()
	if hp <= 0.0:
		state = "dead"
		dead_t = 0.0
		if _menace:
			_menace = false
		velocity = Vector3.ZERO
		collision_layer = 0
		collision_mask = 0
		_hit_due = -1.0
		_snap_at = -1.0
		_lunge_t = 0.0
		_charge_t = 0.0
		_rock_abort()
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
	if d >= float(def.get("stagger_dmg", minf(float(def.hp) * 0.3, 60.0))) and rig.has_clip("stagger"):
		# сильное попадание (СВД, дробовик в упор) сбивает с ног: удар, который он готовил, срывается
		rig.play("stagger", 1.3)
		_hit_due = -1.0
		_snap_at = -1.0
		_lunge_t = 0.0
		_atk = maxf(_atk, float(def.cd) * 0.7)
		if state == "rock" and _rock_step < 3:
			# оглушён до броска: камень рассыпается в руках, метка гаснет
			_rock_abort()
			state = "chase"
	elif not rig.busy() and not bool(def.get("no_flinch", false)):
		var hc := "hit_back" if side == "back" and rig.has_clip("hit_back") else "hit_front"
		if rig.has_clip(hc):
			rig.play(hc, 1.4)


## кадр: p — где герой, can_see — видит ли его сейчас (без стены между ними), hero_alive — жив ли герой
func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	_hero_p = p
	if not _strikes.is_empty():
		_strike_tick(delta)
	if state == "dead":
		dead_t += delta
		if _twist != INF and dead_t < 0.45:
			rotation.y = lerp_angle(rotation.y, _twist, 1.0 - exp(-delta * 9.0))
		return
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	_atk = maxf(0.0, _atk - delta)
	_rock_cd = maxf(0.0, _rock_cd - delta)
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
				elif _t <= 0.0 and wander_r > 0.05:
					state = "wander"
					_goal = home + Vector3(_rng.randf_range(-wander_r, wander_r), 0, _rng.randf_range(-wander_r, wander_r))
					_t = 6.0
				elif _t <= 0.0:
					_t = _rng.randf_range(3.0, 7.0)
				if _growl <= 0.0:
					_growl = _rng.randf_range(7.0, 15.0)
					noise.emit("growl", global_position)
		"feed":
			# голодный: идёт к телу (по карте проходимости), садится и ест; видит героя — бросает еду
			if hero_alive and dist < float(def.see) and can_see:
				_notice(p)
			else:
				var g := feed_at - global_position
				g.y = 0.0
				if g.length() > 0.8:
					_feed_go += delta
					if _feed_go > 40.0:
						end_feed()                       # не дошёл за 40 с — дорогу не нашёл
					else:
						speed = float(def.walk) * 1.5
						_face(_nav_dir(feed_at, delta) if g.length() > 3.0 else _steer(g, delta), delta, 5.0)
				else:
					_face(g, delta, 4.0)
					if not _feeding:
						_feeding = true
						rig.set_pose("infected_feed" if rig.has_clip("infected_feed") else "")
					feed_t += delta
					if _growl <= 0.0:
						_growl = _rng.randf_range(2.2, 3.8)
						noise.emit("chew", global_position)
					if feed_t >= feed_need:
						fed = true
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
			var tly := tl.y
			tl.y = 0.0
			var same_floor := absf(p.y - global_position.y) < 1.2
			if not hero_alive or (_unseen > float(def.get("lose_s", 0.0)) and (dist > float(def.lose) or (tl.length() < 0.8 and absf(tly) < 1.2))):
				# потерял: не видит дольше положенного, а герой далеко — или дошёл до места, где видел, и там пусто
				state = "idle"
				_t = 2.5
			elif can_see and same_floor and dist <= _close() + maxf(0.9, float(def.get("strike_d", 1.0))):
				state = "attack"
			elif tl.length() < 0.5 and absf(tly) < 1.2:
				_face(to, delta, 3.0)                    # дошёл до последнего места — озирается
			elif _rock_cd <= 0.0 and _charge_t <= 0.0 and hero_alive and can_see and same_floor and def.has("rock") \
					and dist >= float(def.rock.from) and dist <= float(def.rock.to) and Time.get_ticks_msec() >= rock_next_ms and _sky_ok(p):
				_start_rock(p)
			else:
				speed = float(def.run)
				# Рывок (у кого он есть — data/enemies.json: charge): видит героя на средней дистанции — рёв и резкое
				# ускорение на пару секунд; потом — передышка. Тяжёлый, но догоняет бегущего.
				var chg: Dictionary = def.get("charge", {})
				if not chg.is_empty():
					_charge_cd = maxf(0.0, _charge_cd - delta)
					if _charge_t > 0.0:
						_charge_t -= delta
						speed = float(chg.speed)
					elif _charge_cd <= 0.0 and can_see and same_floor and dist < float(chg.from) and dist > float(chg.to):
						_charge_t = float(chg.s)
						_charge_cd = float(chg.cd)
						charges += 1
						noise.emit("roar", global_position)
				var go := tl if can_see else _nav_dir(_last, delta)
				# по пути карты проходимости идёт как есть: путь уже обходит стены и мебель, а «щуп» перед собой у перил и
				# косяков только сбивал с него; щуп — когда идёт напрямик (видит героя) или пути нет
				_face(_steer(go, delta) if (can_see or _path.is_empty()) else go, delta, 7.0)
				if _growl <= 0.0:
					_growl = _rng.randf_range(3.0, 6.0)
					noise.emit("growl", global_position)
		"rock":
			# Бросок камня (data/enemies.json: rock): метка уже стоит там, где был герой; Рубер стоит на месте лицом к
			# ней, вырывает булыжник, поднимает и через aim_s секунд бросает. Попадание считает сам бросок (ULRock).
			var tm := (rock.at if rock != null and is_instance_valid(rock) else p) - global_position
			tm.y = 0.0
			_face(tm, delta, 6.0)
			if can_see:
				_last = p
				_unseen = 0.0
			_rock_t += delta
			if rock == null or not is_instance_valid(rock):
				state = "chase"
			elif _rock_step < 3 and hero_alive and can_see and absf(p.y - global_position.y) < 1.2 and dist <= _close() + 0.9:
				# герой подбежал вплотную, пока камень не брошен: бросать некуда — роняет камень (он раскалывается)
				# и бьёт рукой
				_rock_abort()
				rig.stop_action()
				state = "attack"
				_atk = minf(_atk, 0.3)
			else:
				if _rock_step == 0 and _rock_t >= float(_rock_plan.grab):
					_rock_step = 1
					rock.floor_y = global_position.y
					rock.grab(global_position + Vector3(sin(rotation.y), 0, cos(rotation.y)) * 0.8)
					noise.emit("rock_rip", global_position)
				if _rock_step == 1 and _rock_t >= float(_rock_plan.swing):
					_rock_step = 2
					if String(_rock_plan.throw) != "":
						rig.play(String(_rock_plan.throw), float(_rock_plan.throw_rate))
				if _rock_step == 2 and _rock_t >= float(_rock_plan.rel):
					_rock_step = 3
					rock.release()
					noise.emit("rock_throw", global_position)
				if _rock_step == 3 and _rock_t >= float(_rock_plan.end):
					state = "chase"
		"attack":
			# Ближний бой вплотную: подходит до касания (close — расстояние между центрами; капсулы героя и врага
			# соприкасаются на ~0.62 м), только оттуда начинает удар и на замахе ещё дожимает вперёд. Удар выбирается
			# из тех, что достают с этого расстояния (укус и захват — только впритык). Урон — в момент удара, если
			# герой всё ещё в досягаемости: отскочил — мимо.
			_last = p
			var close := _close()
			if _hit_due >= 0.0:
				# удар по-настоящему: замах (клип медленнее, враг на месте, следит за героем) → резкий выпад вперёд
				# до касания (клип быстрее) → удар; герой, отскочивший на замахе, уходит от удара
				_atk_t += delta
				if _snap_at >= 0.0 and _atk_t >= _snap_at:
					_snap_at = -1.0
					rig.action_rate(_atk_rate * _snap_rate)
					_lunge_t = _hit_due + 0.04
				if _lunge_t > 0.0:
					_lunge_t -= delta
					_face(to, delta, 5.0)
					speed = clampf((dist - close + 0.05) / maxf(_hit_due, 0.06), 0.0, float(def.get("lunge_v", 4.5)))
				else:
					# замах на бегу: не останавливается, добегает до героя
					_face(to, delta, 9.0)
					if dist > close + 0.15:
						speed = float(def.run)
				_hit_due -= delta
				if _hit_due < 0.0:
					rig.action_rate(_atk_rate * float(def.get("recover_k", 1.4)))   # отход — быстрее: снова в бой
					_lunge_t = 0.0
					if hero_alive and dist <= _hit_reach and absf(p.y - global_position.y) < 1.2:
						hit_player.emit(_hit_dmg, global_position)
			elif not hero_alive or dist > close + 1.5 or absf(p.y - global_position.y) > 1.5:
				_face(to, delta, 9.0)
				if _atk <= float(def.cd) * 0.5:
					state = "chase"
			else:
				_face(to, delta, 9.0)
				# подбежал — сразу бьёт (замах начинается ещё на бегу, с ~1 м до касания); между ударами держится на
				# шаг от героя, а не вплотную
				var keep := close + float(def.get("keep", 0.3))
				if _atk <= 0.0 and dist <= close + float(def.get("strike_d", 1.0)) and not rig.busy():
					_start_attack(dist)
				elif dist > keep + 0.06 and not rig.busy():
					speed = float(def.run)
	# стойка вплотную: между ударами покачивается и тянет руки к герою (если есть такой клип)
	_still = _still + delta if speed < 0.1 and state == "attack" and _hit_due < 0.0 else 0.0
	var want_menace := _still > 0.2 and rig.has_clip("menace")
	if want_menace != _menace:
		_menace = want_menace
		rig.set_pose("menace" if want_menace else "")
	if rig.fx != null:
		# генератор мелких движений: к моменту удара когти раскрываются (и голова подаётся вперёд на укусе), потом
		# за полсекунды всё возвращается; на бегу и в драке дышит чаще
		_fx_t += delta
		var ph := _fx_t / _fx_len
		var pulse := clampf(ph, 0.0, 1.0) * clampf(ph, 0.0, 1.0) if ph < 1.0 else clampf(1.0 - (ph - 1.0) / 0.6, 0.0, 1.0)
		rig.fx.strike = pulse
		rig.fx.bite = pulse if _fx_bite else 0.0
		rig.fx.breath_hz = 0.9 if state == "chase" or state == "attack" else 0.35
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	# разгон (accel, м/с²): из стойки в бег — не рывком, а через шаг; тормозит сразу (удар с подбега — как прежде)
	if def.has("accel") and speed > _spd_s:
		_spd_s = move_toward(_spd_s, speed, delta * float(def.accel))
		speed = _spd_s
	else:
		_spd_s = speed
	velocity = Vector3(fwd.x * speed * step_k, velocity.y - 9.8 * delta, fwd.z * speed * step_k)
	move_and_slide()
	velocity.x /= step_k
	velocity.z /= step_k
	if is_on_floor():
		velocity.y = 0.0
	rig.set_motion(Vector3(velocity.x, 0, velocity.z).length(), 0.0, delta)


## Начать бросок камня в точку, где сейчас герой. Расписание — по клипам: «вырывает» (rock_rip) растягивается на
## время до замаха, «бросает» (rock_throw) начинается так, чтобы камень ушёл из рук ровно через aim_s после метки.
## Своих клипов нет — весь бросок идёт одним ударом двумя руками сверху (overhead).
func _start_rock(p: Vector3) -> void:
	var rk: Dictionary = def.rock
	var aim := float(rk.get("aim_s", 3.0))
	var rip := String(rk.get("rip", "rock_rip"))
	var thr := String(rk.get("throw", "rock_throw"))
	_rock_plan = {"grab": aim * 0.45, "swing": aim, "rel": aim, "end": aim + 0.8, "throw": "", "throw_rate": 1.0}
	if rig.has_clip(rip) and rig.has_clip(thr):
		var tr := float(rk.get("throw_rate", 1.3))
		var t_len := rig.clip_len(thr) / tr
		var rel_s := t_len * float(rk.get("rel", 0.45))             # от начала клипа броска до отрыва камня от рук
		var rip_s := maxf(aim - rel_s, 0.5)
		rig.play(rip, rig.clip_len(rip) / rip_s)
		_rock_plan = {"grab": rip_s * float(rk.get("grab", 0.5)), "swing": rip_s, "rel": aim, "end": aim + t_len - rel_s, "throw": thr, "throw_rate": tr}
	elif rig.has_clip("overhead"):
		var hit := float(rk.get("rel_overhead", 0.7))
		var o_len := rig.play("overhead", rig.clip_len("overhead") * hit / aim)
		_rock_plan = {"grab": aim * 0.4, "swing": aim, "rel": aim, "end": maxf(o_len, aim + 0.3), "throw": "", "throw_rate": 1.0}
	state = "rock"
	_rock_t = 0.0
	_rock_step = 0
	_rock_cd = float(rk.get("cd", 10.0))
	_charge_cd = maxf(_charge_cd, 2.0)                # после броска не срывается в рывок сразу
	rocks += 1
	rock_next_ms = Time.get_ticks_msec() + int(float(rk.get("gap", 4.0)) * 1000.0)
	rock = ULRock.new()
	get_parent().add_child(rock)
	rock.setup(Vector3(p.x, p.y, p.z), float(rk.get("r", 1.7)), aim, float(rk.get("fly_s", 0.75)), float(rk.get("size", 0.75)))
	rock.hands = _rock_hands
	rock.floor_y = global_position.y
	rock.landed.connect(_rock_landed.bind(float(rk.get("dmg", 40.0))))
	last_attack = String(rk.get("n", "бросок камня"))
	if _menace:
		_menace = false
		rig.set_pose("")
	noise.emit("roar", global_position)


func _sky_ok(p: Vector3) -> bool:
	throw_ok = not sky.is_valid() or bool(sky.call(global_position, p))
	return throw_ok


## где держит камень: чуть дальше середины между кистями (от груди) — камень больше, чем расстояние между ладонями
func _rock_hands() -> Vector3:
	if rig == null or rig.skel == null:
		return global_position + Vector3.UP * 2.0
	var sk := rig.skel
	var l := sk.find_bone("L_Hand")
	var r := sk.find_bone("R_Hand")
	if l < 0 or r < 0:
		return global_position + Vector3.UP * 2.0
	var gt := sk.global_transform
	var mid := (gt * sk.get_bone_global_pose(l).origin + gt * sk.get_bone_global_pose(r).origin) * 0.5
	var c := sk.find_bone("Spine02")
	var chest := gt * sk.get_bone_global_pose(c).origin if c >= 0 else global_position + Vector3.UP * 1.4
	var out := mid - chest
	return mid + (out.normalized() * float(def.rock.get("size", 0.75)) * 0.3 if out.length() > 0.05 else Vector3.ZERO)


## камень упал: задело героя, если он всё ещё в круге (на той же высоте)
func _rock_landed(at: Vector3, r: float, dmg: float) -> void:
	noise.emit("rock_hit", at)
	if sky.is_valid() and not bool(sky.call(at, _hero_p)):
		return                     # герой успел зайти под крышу (палатка, корпус) — камень бьёт в неё, не в него
	var d := Vector2(_hero_p.x - at.x, _hero_p.z - at.z).length()
	if d <= r and absf(_hero_p.y - at.y) < 1.5:
		hit_player.emit(dmg, at)


## бросок сорван (убит или оглушён до броска)
func _rock_abort() -> void:
	if rock != null and is_instance_valid(rock) and _rock_step < 3:
		rock.cancel()


## на каком расстоянии от героя (между центрами) стоит, когда бьёт
func _close() -> float:
	return float(def.get("close", 0.72))


## Начать удар: из тех, что достают с расстояния dist с учётом выпада (захват и укус — только вплотную).
## Время клипа делится на замах (медленнее, wind), рывок (быстрее, snap — враг бросается вперёд) и отход.
func _start_attack(dist: float) -> void:
	_atk = float(def.cd)
	var fit: Array = []
	var w_sum := 0.0
	var eff := maxf(dist - float(def.get("lunge", 0.45)), _close())
	for a in def.get("attacks", []):
		if force_clip != "" and String(a.clip) != force_clip:
			continue
		if (float(a.get("reach", 1.0)) >= eff or force_clip != "") and rig.has_clip(String(a.clip)):
			fit.append(a)
			w_sum += float(a.get("w", 1.0))
	if fit.is_empty():
		return
	var r := _rng.randf() * w_sum
	var a: Dictionary = fit[fit.size() - 1]
	for x in fit:
		r -= float(x.get("w", 1.0))
		if r <= 0.0:
			a = x
			break
	var clip := String(a.clip)
	_atk_rate = float(a.get("rate", 1.0))
	var h := float(a.get("hit", 0.45))
	var len_s := rig.play(clip, _atk_rate)                     # весь клип в своём темпе
	# Удар с ходу: замах длится wind_t секунд, рывок — snap_t, сколько бы ни шёл замах в самом клипе (у клипов
	# Tripo он бывает в секунду — враг «стоял» бы перед ударом). Клип ускоряется под эти сроки, но не замедляется.
	var t_wind := len_s * h * 0.6
	var t_snap := len_s * h * 0.4
	var w_rate := maxf(1.0, t_wind / maxf(float(def.get("wind_t", 0.3)), 0.05))
	_snap_rate = maxf(1.0, t_snap / maxf(float(def.get("snap_t", 0.14)), 0.03))
	rig.action_rate(_atk_rate * w_rate)
	_atk_t = 0.0
	_snap_at = t_wind / w_rate
	_hit_due = _snap_at + t_snap / _snap_rate
	_lunge_t = 0.0
	_hit_dmg = float(a.dmg)
	_hit_reach = float(a.get("reach", 1.0)) + 0.25
	_fx_t = 0.0
	_fx_len = maxf(_hit_due, 0.15)
	_fx_bite = bool(a.get("bite", false))
	last_attack = String(a.n)
	_plan_strikes(clip, len_s, _hit_due)
	if String(a.get("hands", "")) == "both" and rig.hands != null:
		_strikes = [[_hit_due, "R"], [_hit_due, "L"]]          # удар двумя руками: обе кисти доходят до героя
	if _menace:
		_menace = false
		rig.set_pose("")
	if _rng.randf() < 0.6 or _fx_bite:
		noise.emit("roar", global_position)


var _hero_p := Vector3.ZERO
var _spd_s := 0.0                 ## скорость с разгоном (accel)
var _strikes: Array = []          ## [через сколько секунд, рука "L"/"R"] — лапа к герою по ходу удара


## Удар лапой доходит до героя: клипы Tripo машут «в воздух» (широко вбок, на уровне головы), поэтому в момент удара
## бьющая кисть доводится (IK руки) до плеча или груди героя со стороны этой руки и сразу уходит назад. Правой,
## левой; «два удара подряд» — правой, потом левой; удар сверху — правой сверху вниз. Укусы и захваты — головой,
## без доводки руки.
func _plan_strikes(clip: String, len_s: float, hit_s: float) -> void:
	_strikes.clear()
	if rig == null or rig.hands == null:
		return
	match clip:
		"attack_r", "overhead":
			_strikes = [[hit_s, "R"]]
		"attack_l":
			_strikes = [[hit_s, "L"]]
		"claw_combo", "claw2":
			_strikes = [[maxf(hit_s - len_s * 0.24, 0.12), "R"], [hit_s, "L"]]
		"backhand":
			_strikes = [[hit_s, "L"]]
		"hook_r", "slash_r", "infected_attack_right":
			_strikes = [[hit_s, "R"]]
		"hook_l", "slash_l", "infected_attack_left":
			_strikes = [[hit_s, "L"]]
		"combo5":
			_strikes = [[maxf(hit_s - len_s * 0.3, 0.1), "R"], [maxf(hit_s - len_s * 0.15, 0.12), "L"], [hit_s, "R"]]
		"leap", "shove", "infected_attack_grab":
			_strikes = [[hit_s, "R"], [hit_s, "L"]]          # обе лапы доходят до героя разом


func _strike_tick(delta: float) -> void:
	for st in _strikes:
		st[0] = float(st[0]) - delta
	# за 0.16 с до удара кисть начинает тянуться к герою
	while not _strikes.is_empty() and float(_strikes[0][0]) <= 0.16:
		var side := String(_strikes[0][1])
		var lead := maxf(float(_strikes[0][0]), 0.02)
		_strikes.pop_front()
		var to := _hero_p - global_position
		to.y = 0.0
		if to.length() > 1.6:
			continue                                   # герой отскочил — лапа рассекает воздух, как в клипе
		var f := to.normalized()
		var right := Vector3(-f.z, 0, f.x)                # правая рука врага (смотрит на героя): f × вверх
		var sgn := 1.0 if side == "R" else -1.0
		var tgt := _hero_p + Vector3.UP * (1.35 if last_attack.contains("сверху") else 1.2) - f * 0.16 + right * sgn * 0.14
		rig.hands.reach(side, tgt, 0.0, lead, 0.07, 0.24)


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
			var hit := space.intersect_ray(q)
			# пологое (марш лестницы, пандус) — не препятствие: по нему идут
			if hit.is_empty() or hit.collider is ULEnemy or (hit.normal as Vector3).y > 0.6:
				free_a = a
				break
		if free_a == 999.0:
			free_a = _steer_a
		if free_a != _steer_a:
			_steer_a = free_a
			_steer_t = 0.5 if free_a != 0.0 else 0.0
	return d.rotated(Vector3.UP, _steer_a)


## Направление к цели в обход препятствий: путь по карте проходимости (обновляется раз в 0.4 с или когда цель
## сдвинулась на метр), берётся ближайший ещё не пройденный поворот. Карты нет или путь пуст — прямо.
func _nav_dir(target: Vector3, delta: float) -> Vector3:
	_path_t -= delta
	if _path_t <= 0.0 or _path_to.distance_to(target) > 1.0:
		_path_t = 0.4
		_path_to = target
		var map := get_world_3d().navigation_map
		_path = NavigationServer3D.map_get_path(map, global_position, target, true) if NavigationServer3D.map_get_iteration_id(map) > 0 else PackedVector3Array()
	var me := Vector3(global_position.x, 0, global_position.z)
	while _path.size() > 1 and Vector3(_path[0].x, 0, _path[0].z).distance_to(me) < 0.6 and absf(_path[0].y - global_position.y) < 1.0:
		_path.remove_at(0)
	if _path.is_empty():
		return Vector3(target.x - me.x, 0, target.z - me.z)
	var nx := _path[0]
	return Vector3(nx.x - me.x, 0, nx.z - me.z)


func _face(dir: Vector3, delta: float, rate: float) -> void:
	if dir.length() > 0.05:
		rotation.y = lerp_angle(rotation.y, atan2(dir.x, dir.z), 1.0 - exp(-delta * rate))


var step_k := 1.0                 ## дальний враг думает раз в несколько кадров — и шагает за них все сразу


## вдали от героя не считается и не двигается
func set_active(on: bool) -> void:
	if on == active:
		return
	active = on
	rig.set_active(on)
	set_shadow(on)


## настоящая тень от солнца: у дальних (не считаются) её нет — под ними мягкое пятно, а карта теней не рисует тело
## второй раз; в толпе тень оставляется только ближайшим (world.gd — _enemy_shadows)
var shadow_on := true


func set_shadow(on: bool) -> void:
	if on == shadow_on and not _geo.is_empty():
		return
	shadow_on = on
	if _geo.is_empty():
		# заражённых бывает до 70: их сетки упрощаются с расстоянием раньше, чем герой и окружение (по пресету графики)
		var lb: float = [0.35, 0.6, 0.85, 1.0][clampi(ULSettings.gfx, 0, 3)]
		for g in find_children("*", "GeometryInstance3D", true, false):
			_geo.append([g, (g as GeometryInstance3D).cast_shadow])
			(g as GeometryInstance3D).lod_bias = lb
	for it in _geo:
		if is_instance_valid(it[0]):
			(it[0] as GeometryInstance3D).cast_shadow = it[1] if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF


var _geo: Array = []              ## [сетка, её тень по умолчанию]
