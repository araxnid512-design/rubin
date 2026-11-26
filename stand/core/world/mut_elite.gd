class_name ULMutElite
extends ULElite
## Финальный босс подземного комплекса Базы Внешников — «Мутировавшая Элита» (задание пользователя 26.11).
## Экспериментальная разновидность Элиты: 4 м в высоту, 7 м в длину. Живёт на третьем подземном этаже, в
## экспериментальном секторе; один на цикл комплекса (сутки после красной жемчужины). Модель — Tripo по картинке
## пользователя, скелет, веса и движения — tools/mut_elite_build.gd (assets/models/mut_elite.scn).
## Все числа — data/mut_elite.json (предложение для настройки, не утверждённый баланс).
##
## Шесть способностей:
##   1. Укус — как у Элиты: урон в миг смыкания челюстей, одной цели перед мордой.
##   2. Удары передними лапами — правой, левой или двумя подряд; замах, удар, возврат.
##   3. Удар двумя лапами по земле — перёд корпуса вверх, на полу видна красная зона; в миг удара всем в зоне —
##      урон и замедление. До удара из зоны можно выйти.
##   4. Рывок — подготовительная стойка (голова вниз, лапа роет пол), затем разгон по прямой; столкновение — урон;
##      стену не пробивает: упёрся — остановился и приходит в себя.
##   5. Удар хвостом — когда цель сзади или сбоку: широкая дуга, урон по дуге позади.
##   6. Призыв пустышей — рёв; из боковых проходов арены выбегают пустыши (их создаёт мир по сигналу boss_fx).
## Три фазы: до 70 % здоровья — укусы, лапы, хвост; ниже 70 % — ещё рывок, удар по земле и первый призыв; ниже
## 35 % — мощные атаки чаще, призыв повторяется (с перезарядкой и пределом числа пустышей).
## Состояния (ai_state): Idle, Detect, Chase, BiteAttack, ClawAttack, GroundSlam, ChargeAttack, TailAttack, Summon,
## Recovery, Death. Бой начинается, когда герой входит в центральную зону арены (или ранит босса).
## Через стену урон не проходит (луч от точки удара до героя). Тело после гибели не исчезает; обыскать можно,
## когда падение доиграло. Добыча создаётся один раз при появлении (диапазоны — loot в настройках).

const B_CFG := "res://data/mut_elite.json"
const B_SCENE := "res://assets/models/mut_elite.scn"
const B_ST := {"Idle": "elite_idle", "Walk": "elite_walk", "Run": "elite_run", "BiteAttack": "elite_bite_attack", "ClawAttack": "elite_claw_attack",
	"Death": "mut_death", "Turn": "mut_turn", "GroundSlam": "mut_slam", "ChargePrep": "mut_charge_prep", "TailAttack": "mut_tail", "Summon": "mut_roar",
	"Hit": "mut_hit"}

## события боя для мира: slam {at, r, hit}, slow {k, s}, summon {n}, phase {n}, charge {hit, wall}, start, death
signal boss_fx(kind: String, data: Dictionary)

static var _bcfg := {}
static var _bscene: PackedScene

var phase := 1
var fight := false                       ## бой начат
var ai_state := "Idle"
var slams := 0
var slam_hits := 0
var n_charges := 0
var n_charge_hits := 0
var charge_walls := 0                    ## рывков, остановленных стеной
var tails := 0
var tail_hits := 0
var summons := 0
var hit_reacts := 0
var states_seen := {}                    ## какие состояния были (для проверок)
var summoned_alive := 0                  ## сколько призванных пустышей живо (сообщает мир)

var _cd := {"slam": 0.0, "charge": 0.0, "tail": 0.0, "summon": 0.0}
var _sp_name := ""                       ## идущая особая атака: slam, charge, tail, summon
var _sp_t := 0.0
var _sp_len := 0.0
var _rec_t := 0.0                        ## восстановление после мощной атаки
var _ch_stage := ""                      ## prep, run, rec
var _ch_dir := Vector3.ZERO
var _ch_from := Vector3.ZERO
var _ch_len := 0.0
var _ch_hit := false
var _ch_block := 0.0
var _ch_last := Vector3.ZERO
var _slam_at := Vector3.ZERO
var _zone: MeshInstance3D
var _hit_acc := 0.0
var _hit_t := 0.0
var _yaw_rate := 0.0
var _dead_own := 0.0


static func bcfg() -> Dictionary:
	if _bcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(B_CFG))
		_bcfg = d if d is Dictionary else {}
	return _bcfg


func _conf() -> Dictionary:
	return bcfg()


func _packed() -> PackedScene:
	if _bscene == null and ResourceLoader.exists(B_SCENE):
		_bscene = load(B_SCENE)
	return _bscene


func setup(k: String, at: Vector3, seed_n: int) -> void:
	states = B_ST
	super.setup(k, at, seed_n)
	set_meta("boss", true)
	rotation.y = float(c.get("face_deg", 0.0)) * PI / 180.0
	loot = roll_boss_loot(seed_n)
	_t = 1e9                              # до боя стоит на месте, не обходит площадку
	_zone_make()


## Добыча босса: для каждого предмета — случайное целое в диапазоне включительно (0 — не выпал). Создаётся один
## раз; ячеек — по числу видов добычи.
static func roll_boss_loot(seed_n: int) -> Array:
	var r := RandomNumberGenerator.new()
	r.seed = seed_n * 7919 + 131
	var rows: Array = bcfg().get("loot", [])
	var out: Array = []
	out.resize(maxi(rows.size(), 4))
	for l in rows:
		var n := r.randi_range(int(l[1]), int(l[2]))
		if n > 0:
			ULInventory.put(out, ULItems.make(String(l[0]), n))
	return out


func _zone_make() -> void:
	_zone = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 1.0
	cm.bottom_radius = 1.0
	cm.height = 0.04
	cm.radial_segments = 40
	_zone.mesh = cm
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = Color(1.0, 0.3, 0.05, 0.4)
	m.no_depth_test = false
	_zone.material_override = m
	_zone.top_level = true
	_zone.visible = false
	_zone.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_zone)


func in_arena(p: Vector3, inset := 0.0) -> bool:
	var a: Array = c.get("arena", [-18, -36, 18, -12])
	return p.x > float(a[0]) + inset and p.x < float(a[2]) - inset and p.z > float(a[1]) + inset and p.z < float(a[3]) - inset


func _cdk() -> float:
	return float(c.get("phase3_cd_k", 0.65)) if phase >= 3 else 1.0


# ---------------- кадр ----------------

func tick(delta: float, p: Vector3, can_see: bool, hero_alive: bool) -> void:
	if alive():
		for k in _cd:
			_cd[k] = maxf(0.0, float(_cd[k]) - delta)
		_rec_t = maxf(0.0, _rec_t - delta)
		_hit_t = maxf(0.0, _hit_t - delta)
		_phase_check()
		if not fight:
			if hero_alive and in_arena(p, float(c.get("trigger_inset", 3.0))):
				fight = true
				boss_fx.emit("start", {})
			else:
				can_see = false               # пока герой не вошёл в центральную зону — стоит и дышит
		elif hero_alive:
			can_see = true                    # в бою цель не теряется: арена закрыта
		if _sp_name != "":
			_special_tick(delta, p)
		elif fight and hero_alive and state == "chase" and _atk_left <= 0.0 and _atk_ready <= 0.0 and _rec_t <= 0.0:
			var pick := force_clip if force_clip in ["slam", "charge", "tail", "summon"] else _pick_special(p)
			if pick != "":
				_start_special(pick, p)
	super.tick(delta, p, can_see, hero_alive)
	_name_state()


func _phase_check() -> void:
	var k := hp / float(def.hp)
	var want := 3 if k < float(c.get("phase3", 0.35)) else (2 if k < float(c.get("phase2", 0.7)) else 1)
	if want > phase:
		phase = want
		boss_fx.emit("phase", {"n": phase})
		noise.emit("roar", global_position + Vector3.UP * 3.0)


func _name_state() -> void:
	var s := "Idle"
	if not alive():
		s = "Death"
	elif _sp_name == "slam":
		s = "GroundSlam"
	elif _sp_name == "charge":
		s = "Recovery" if _ch_stage == "rec" else "ChargeAttack"
	elif _sp_name == "tail":
		s = "TailAttack"
	elif _sp_name == "summon":
		s = "Summon"
	elif _rec_t > 0.0:
		s = "Recovery"
	elif state == "attack":
		s = "BiteAttack" if _atk_name == "bite" else "ClawAttack"
	elif state == "alert":
		s = "Detect"
	elif state in ["chase", "wait"]:
		s = "Chase"
	ai_state = s
	states_seen[s] = true


## что из особых атак уместно сейчас: расстояние, где цель (впереди, сбоку, сзади), фаза, перезарядка
func _pick_special(p: Vector3) -> String:
	var to := p - global_position
	to.y = 0.0
	var dist := to.length()
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var dotf := f.dot(to.normalized()) if dist > 0.1 else 1.0
	if float(_cd.tail) <= 0.0 and dotf < 0.15 and dist < float(c.tail_r) + 0.8:
		return "tail"
	if phase < 2:
		return ""
	var sm_cfg: Dictionary = c.get("summon", {})
	if (phase == 2 and summons == 0) or (phase >= 3 and float(_cd.summon) <= 0.0 and summoned_alive < int(sm_cfg.get("max_alive", 8))):
		return "summon"
	if float(_cd.charge) <= 0.0 and dist >= float(c.charge_from) and dist <= float(c.charge_to) and dotf > 0.77 \
			and _clear(global_position + Vector3.UP * 1.6, p + Vector3.UP * 1.0):
		return "charge"
	if float(_cd.slam) <= 0.0 and dist >= float(c.slam_from) and dist <= float(c.slam_to) and dotf > 0.5:
		return "slam"
	return ""


func _start_special(what: String, p: Vector3) -> void:
	_sp_name = what
	_sp_t = 0.0
	state = "attack"
	_atk_name = what
	_atk_left = 99.0
	_hit_open.clear()
	last_attack = what
	var st := ""
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	match what:
		"slam":
			slams += 1
			st = "GroundSlam"
			_cd["slam"] = float(c.slam_cd) * _cdk()
			_slam_at = global_position + f * (float(c.body[0]) * 0.5 + float(c.get("slam_fwd", 0.5)))
			_slam_at.y = global_position.y + 0.09
			_zone.global_position = _slam_at
			_zone.scale = Vector3(float(c.slam_r), 1.0, float(c.slam_r))
			_zone.visible = true
		"tail":
			tails += 1
			st = "TailAttack"
			_cd["tail"] = float(c.tail_cd) * _cdk()
		"summon":
			summons += 1
			st = "Summon"
			_cd["summon"] = float((c.get("summon", {}) as Dictionary).get("cd", 45.0))
		"charge":
			n_charges += 1
			st = "ChargePrep"
			_cd["charge"] = float(c.charge_cd) * _cdk()
			_ch_stage = "prep"
			_ch_hit = false
			_ch_block = 0.0
	_cur_clip = String(states[st])
	_sp_len = anim.get_animation(_cur_clip).length if anim != null and anim.has_animation(_cur_clip) else 2.0
	if sm != null:
		sm.travel(st)
		sm.start(st, true)
	cur_state = st
	if tree != null:
		tree.set("parameters/ts/scale", 1.0)
	_sp = minf(_sp, 1.0)
	_last = p


func _end_special(rec: float) -> void:
	_sp_name = ""
	_ch_stage = ""
	_atk_left = 0.0
	_rec_t = rec
	if _zone != null:
		_zone.visible = false
	_travel("Idle")


func _special_tick(delta: float, p: Vector3) -> void:
	_sp_t += delta
	match _sp_name:
		"slam":
			if _zone.visible:
				var m := _zone.material_override as StandardMaterial3D
				m.albedo_color.a = 0.26 + 0.2 * absf(sin(_sp_t * 7.0))
			if _sp_t >= _sp_len:
				_end_special(float(c.get("slam_rec", 0.8)))
		"tail":
			if _sp_t >= _sp_len:
				_end_special(float(c.get("tail_rec", 0.4)))
		"summon":
			if _sp_t >= _sp_len:
				_end_special(0.3)
		"charge":
			_charge_tick(delta, p)


func _charge_tick(delta: float, p: Vector3) -> void:
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	match _ch_stage:
		"prep":
			if _sp_t >= _sp_len:
				var to := p - global_position
				to.y = 0.0
				_ch_dir = to.normalized() if to.length() > 0.5 else f
				_ch_from = global_position
				_ch_last = global_position
				_ch_len = minf(float(c.charge_len), to.length() + float(c.get("charge_over", 5.0)))
				_ch_stage = "run"
				_sp = maxf(_sp, float(c.charge_v) * 0.6)
				noise.emit("roar", global_position + Vector3.UP * 2.5)
		"run":
			var head := global_position + f * float(c.body[0]) * 0.36
			var hero := p
			if not _ch_hit and Vector2(head.x - hero.x, head.z - hero.z).length() < float(c.charge_w) and absf(hero.y - global_position.y) < 2.0 \
					and _clear(global_position + Vector3.UP * 1.6, hero + Vector3.UP * 1.0):
				_ch_hit = true
				n_charge_hits += 1
				hits_done += 1
				hit_player.emit(float(c.charge_dmg), global_position)
				boss_fx.emit("charge", {"hit": true, "wall": false})
			var step := Vector2(global_position.x - _ch_last.x, global_position.z - _ch_last.z).length()
			_ch_last = global_position
			if delta > 0.0 and step < float(c.charge_v) * delta * 0.3 and _sp_t > _sp_len + 0.15:
				_ch_block += delta
			else:
				_ch_block = 0.0
			var gone := Vector2(global_position.x - _ch_from.x, global_position.z - _ch_from.z).length()
			if _ch_block > 0.12:
				# упёрся в стену или оборудование: не проходит, оглушён дольше
				charge_walls += 1
				_ch_stage = "rec"
				_sp = 0.0
				_sp_t = 0.0
				_sp_len = float(c.charge_rec) * 1.5
				noise.emit("body_fall", global_position)
				boss_fx.emit("charge", {"hit": false, "wall": true})
				_travel("Idle")
			elif gone >= _ch_len or _sp_t > _sp_len + 4.0:
				_ch_stage = "rec"
				_sp_t = 0.0
				_sp_len = float(c.charge_rec)
				_travel("Idle")
		"rec":
			if _sp_t >= _sp_len:
				_end_special(0.2)


func _move_tick(delta: float, want_sp: float, face: Vector3, turn: float) -> void:
	var y0 := rotation.y
	if _sp_name == "charge" and _ch_stage == "run":
		super._move_tick(delta, float(c.charge_v), _ch_dir, float(c.get("charge_turn", 18.0)))
		_blocked_t = 0.0
	elif _sp_name == "charge" and _ch_stage == "prep":
		super._move_tick(delta, 0.0, face, float(c.turn_fight))
	elif _sp_name != "":
		super._move_tick(delta, 0.0, Vector3.ZERO, 0.0)
	elif _rec_t > 0.0 or _hit_t > 0.0:
		super._move_tick(delta, 0.0, face, turn * 0.35)
	else:
		super._move_tick(delta, want_sp, face, turn)
	_yaw_rate = rad_to_deg(angle_difference(y0, rotation.y)) / maxf(delta, 0.0001)


func _anim_tick() -> void:
	if tree == null or not alive():
		return
	if _sp_name == "charge" and _ch_stage == "run":
		_travel("Run")
		tree.set("parameters/ts/scale", clampf(_sp / run_v, 0.9, 1.6))
		return
	if _sp_name != "" and not (_sp_name == "charge" and _ch_stage == "rec"):
		tree.set("parameters/ts/scale", 1.0)
		return
	if _hit_t > 0.0:
		return
	if state != "attack" and _sp < 0.15 and absf(_yaw_rate) > 22.0:
		_travel("Turn")
		tree.set("parameters/ts/scale", clampf(absf(_yaw_rate) / 60.0, 0.6, 1.5))
		return
	super._anim_tick()


func _can_attack(p: Vector3) -> bool:
	if _rec_t > 0.0 or _sp_name != "" or not fight:
		return false
	return super._can_attack(p)


# ---------------- метки движений ----------------

func _anim_event(ev: String) -> void:
	match ev:
		"slam_hit":
			events.append([snappedf(_el_t, 0.01), ev, cur_state])
			_slam_hit()
		"tail_hit":
			events.append([snappedf(_el_t, 0.01), ev, cur_state])
			_tail_hit()
		"summon":
			events.append([snappedf(_el_t, 0.01), ev, cur_state])
			_do_summon()
		"roar":
			noise.emit("roar", global_position + Vector3.UP * 3.0)
		"step":
			pass
		_:
			super._anim_event(ev)


func _slam_hit() -> void:
	if _sp_name != "slam" or not alive():
		return
	_zone.visible = false
	noise.emit("body_fall", _slam_at)
	var hero := _hero_p
	var d := Vector2(_slam_at.x - hero.x, _slam_at.z - hero.z).length()
	var got := d <= float(c.slam_r) and absf(hero.y - global_position.y) < 2.0 and _clear(_slam_at + Vector3.UP * 1.0, hero + Vector3.UP * 0.9)
	if got:
		slam_hits += 1
		hits_done += 1
		hit_player.emit(float(c.slam_dmg), _slam_at)
		boss_fx.emit("slow", {"k": float(c.get("slam_slow", 0.5)), "s": float(c.get("slam_slow_s", 2.5))})
	else:
		misses += 1
		last_miss = "slam: до героя %.2f м (зона %.2f)" % [d, float(c.slam_r)]
	boss_fx.emit("slam", {"at": _slam_at, "r": float(c.slam_r), "hit": got})


func _tail_hit() -> void:
	if _sp_name != "tail" or not alive():
		return
	var f := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var rump := global_position - f * float(c.body[0]) * 0.3
	var hero := _hero_p
	var to := hero - global_position
	to.y = 0.0
	var d := Vector2(rump.x - hero.x, rump.z - hero.z).length()
	var behind := to.length() < 0.3 or f.dot(to.normalized()) < cos(deg_to_rad(180.0 - float(c.get("tail_arc", 200.0)) * 0.5))
	if d <= float(c.tail_r) and behind and absf(hero.y - global_position.y) < 2.0 and _clear(rump + Vector3.UP * 1.2, hero + Vector3.UP * 0.9):
		tail_hits += 1
		hits_done += 1
		hit_player.emit(float(c.tail_dmg), rump)
	else:
		misses += 1
		last_miss = "tail: до героя %.2f м (достаёт %.2f), сзади %s" % [d, float(c.tail_r), str(behind)]


func _do_summon() -> void:
	if not alive():
		return
	var sc: Dictionary = c.get("summon", {})
	var rng: Array = sc.get("first", [3, 5]) if summons <= 1 else sc.get("next", [4, 6])
	boss_fx.emit("summon", {"n": _rng.randi_range(int(rng[0]), int(rng[1])), "max": int(sc.get("max_alive", 8)), "kind": String(sc.get("kind", "infected"))})


# ---------------- попадание и гибель ----------------

## броня: из каждого попадания вычитается armor (слабые пули почти не берут), но не меньше доли armor_min;
## затем — сопротивление шкуры (resist), как у Элиты
func damage(d: float, from := Vector3.INF) -> void:
	if not alive():
		return
	if not fight:
		fight = true
		boss_fx.emit("start", {})
	d = maxf(d - float(c.get("armor", 0.0)), d * float(c.get("armor_min", 0.25)))
	super.damage(d, from)
	if not alive():
		return
	_hit_acc += d
	if _hit_acc >= float(c.get("hit_react_dmg", 600.0)) and _sp_name == "" and state != "attack" and _rec_t <= 0.0:
		_hit_acc = 0.0
		_hit_t = 0.6
		hit_reacts += 1
		if sm != null:
			sm.travel("Hit")
			sm.start("Hit", true)
		cur_state = "Hit"


func _die() -> void:
	_sp_name = ""
	_ch_stage = ""
	_rec_t = 0.0
	if _zone != null:
		_zone.visible = false
	super._die()
	boss_fx.emit("death", {})
	_name_state()


## тело не исчезает (в отличие от остальных): его можно обыскать, пока герой на этаже
func _dead_tick(delta: float) -> void:
	_dead_own += delta
	dead_t = minf(_dead_own, CORPSE_S - 20.0)
	if not dead_done and _dead_own >= _death_len:
		dead_done = true
