extends Node
## Звуки — записи браузерной игры (assets/sounds, авторы и лицензии — assets/sounds/CREDITS.md; в проект их
## копирует scripts/export-godot.mjs): выстрел — по стволу (своя запись, высота и громкость, как в game/audio.js),
## попадание пули, смерть заражённого, удар по герою, удар топором, стоны и рёв заражённых (не больше
## GROAN_VOICES голосов разом), шаги героя по асфальту, траве, грунту и полу, ветер над кластером и дальний
## гром перед перезагрузкой. Слушатель — у героя (камера висит высоко), дальнее тише и глуше. Общая громкость —
## шина Master (её ставят настройки, features/settings.gd).

const DIR := "res://assets/sounds/%s.mp3"
const FILES := [
	"pistol", "shotgun", "ak1", "ak2", "ak3", "mg", "svd", "dry", "bolt", "flesh1", "flesh2", "chop",
	"groan1", "groan2", "groan3", "groan4", "groan5", "zhit1", "zhit2", "zdeath1", "zdeath2", "zdeath3",
	"step_road1", "step_road2", "step_road3", "step_grass1", "step_grass2", "step_dirt1", "step_dirt2", "step_floor1", "step_floor2",
	"wind", "thunder", "explosion", "reload_pistol", "reload_rifle", "shell", "casing1", "casing2",
]
const AK := ["ak1", "ak2", "ak3"]
## Голос ствола: записи, высота (скорость), громкость (доля); click — лязг затвора ВСС, pump — передёрнуть цевьё.
const GUNS := {
	"pistol": {"s": ["pistol"], "rate": 1.06, "gain": 0.7},
	"obrez": {"s": ["shotgun"], "rate": 0.94, "gain": 1.0},
	"shotgun": {"s": ["shotgun"], "rate": 1.0, "gain": 0.95, "pump": true},
	"vector": {"s": ["pistol"], "rate": 1.2, "gain": 0.5},
	"aks": {"s": AK, "rate": 1.08, "gain": 0.75},
	"ak74": {"s": AK, "rate": 1.0, "gain": 0.75},
	"ak47": {"s": AK, "rate": 0.86, "gain": 0.85},
	"vss": {"s": ["pistol"], "rate": 1.4, "gain": 0.2, "click": true},
	"pkm": {"s": ["mg"], "rate": 0.96, "gain": 0.95},
	"svd": {"s": ["svd"], "rate": 1.0, "gain": 1.0},
	"scar": {"s": AK, "rate": 0.8, "gain": 0.9},
	"fnfal": {"s": ["svd"], "rate": 1.12, "gain": 0.85},
	"aug": {"s": AK, "rate": 1.04, "gain": 0.72},
	"pm63": {"s": ["pistol"], "rate": 1.16, "gain": 0.55},
	"spas12": {"s": ["shotgun"], "rate": 0.97, "gain": 0.95},
	"glock17": {"s": ["pistol"], "rate": 1.08, "gain": 0.7},
	"deagle": {"s": ["pistol"], "rate": 0.82, "gain": 1.0},
	"dbarrel": {"s": ["shotgun"], "rate": 0.92, "gain": 1.0},
	"mp5": {"s": ["pistol"], "rate": 1.2, "gain": 0.5},
	"ak107": {"s": AK, "rate": 1.02, "gain": 0.75},
	"g36": {"s": AK, "rate": 1.08, "gain": 0.7},
	"rpk": {"s": ["mg"], "rate": 1.0, "gain": 0.9},
	"pkt": {"s": ["mg"], "rate": 0.9, "gain": 1.0},
	"awm": {"s": ["svd"], "rate": 0.86, "gain": 1.0},
}
## Голоса заражённых: чем крупнее, тем ниже и громче.
const VOICES := {"runner": {"rate": 1.02, "gain": 0.55}, "lottery": {"rate": 0.88, "gain": 0.65}, "stomper": {"rate": 0.72, "gain": 0.75}, "ruber": {"rate": 0.58, "gain": 0.9}}
const GROANS := ["groan1", "groan2", "groan3", "groan4", "groan5"]
const STEPS := {"road": ["step_road1", "step_road2", "step_road3"], "grass": ["step_grass1", "step_grass2"], "dirt": ["step_dirt1", "step_dirt2"], "floor": ["step_floor1", "step_floor2"]}
## Сколько звуков разом: выстрелы, попадания, смерти — и отдельно стоны заражённых.
const SFX_VOICES := 14
const GROAN_VOICES := 4
## Стонут только заражённые не дальше, м.
const GROAN_RANGE := 26.0

var game: Node
var streams := {}
var listener: AudioListener3D
var sfx: Array = []
var groan_pool: Array = []
var steps: AudioStreamPlayer
var hurt: AudioStreamPlayer
var wind: AudioStreamPlayer
var sky: AudioStreamPlayer
var started := {}   # плеер → когда запущен (кого заменить, если все заняты)
var groan_t := {}   # id заражённого → через сколько застонет
var states := {}    # id заражённого → прошлое состояние (рёв рубера, когда кинулся)
var scan_t := 0.0
var stride := 0.0
var thunder_t := 0.0
var wind_db := -80.0
## Сколько звуков запущено (для автотеста).
var played := 0

func setup(g: Node) -> void:
	game = g
	for f in FILES:
		var path: String = DIR % f
		if ResourceLoader.exists(path):
			var s = load(path)
			if s is AudioStream:
				streams[f] = s
	if streams.has("wind") and "loop" in streams["wind"]:
		streams["wind"].loop = true
	listener = AudioListener3D.new()
	add_child(listener)
	listener.make_current()
	for i in SFX_VOICES:
		sfx.append(_player3d(70.0))
	for i in GROAN_VOICES:
		groan_pool.append(_player3d(GROAN_RANGE + 4.0))
	steps = _player2d()
	hurt = _player2d()
	wind = _player2d()
	sky = _player2d()
	game.shot.connect(_on_shot)
	game.enemy_hit.connect(_on_hit)
	game.enemy_killed.connect(_on_killed)
	game.player_hurt.connect(_on_player_hurt)
	game.noise_made.connect(_on_noise)

func _player3d(reach: float) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.unit_size = 8.0
	p.max_db = 0.0
	p.max_distance = reach
	p.attenuation_filter_cutoff_hz = 6000.0
	p.attenuation_filter_db = -18.0
	p.doppler_tracking = AudioStreamPlayer3D.DOPPLER_TRACKING_DISABLED
	add_child(p)
	return p

func _player2d() -> AudioStreamPlayer:
	var p := AudioStreamPlayer.new()
	add_child(p)
	return p

func on_enter(_id: String) -> void:
	groan_t.clear()
	states.clear()
	thunder_t = 0.0
	if streams.has("wind") and not wind.playing:
		wind.stream = streams["wind"]
		wind.volume_db = -60.0
		wind_db = -60.0
		var length: float = wind.stream.get_length()
		wind.play(randf() * maxf(0.0, length - 1.0))

# ---------- Проигрывание ----------

func _vary(k := 0.05) -> float:
	return randf_range(1.0 - k, 1.0 + k)

## Свободный плеер из набора; если все заняты — тот, что звучит дольше всех (новое важнее хвоста старого).
## steal = false — не заменять (стоны: лишний голос в толпе не нужен).
func _free(pool: Array, steal := true) -> Node:
	var oldest: Node = null
	var t0 := INF
	for p in pool:
		if not p.playing:
			return p
		var t: float = started.get(p, 0.0)
		if t < t0:
			t0 = t
			oldest = p
	return oldest if steal else null

## Запись snd в точке pos: gain — доля громкости, rate — высота; false — записи нет или некому играть.
func play_at(snd: String, pos: Vector3, gain := 1.0, rate := 1.0, pool: Array = [], steal := true) -> bool:
	if pool.is_empty():
		pool = sfx
	var s: AudioStream = streams.get(snd)
	if s == null or gain < 0.01:
		return false
	var p: AudioStreamPlayer3D = _free(pool, steal)
	if p == null:
		return false
	p.stream = s
	p.global_position = pos
	p.volume_db = linear_to_db(gain)
	# потолок — своя громкость: иначе ближе unit_size·gain звук упирается в 0 дБ и доли громкости (тихий MP5,
	# пуля в тело, бегун и рубер) вблизи звучат одинаково
	p.max_db = p.volume_db
	p.pitch_scale = rate
	p.play()
	started[p] = Time.get_ticks_msec() / 1000.0
	played += 1
	return true

## То же с задержкой (передёрнуть цевьё, лязг затвора).
func play_later(delay: float, snd: String, pos: Vector3, gain := 1.0, rate := 1.0) -> void:
	get_tree().create_timer(delay, false).timeout.connect(func(): play_at(snd, pos, gain, rate))

## Звук самого героя (шаги, удар по нему) — без расстояния.
func play_self(p: AudioStreamPlayer, snd: String, gain: float, rate := 1.0) -> bool:
	var s: AudioStream = streams.get(snd)
	if s == null:
		return false
	p.stream = s
	p.volume_db = linear_to_db(gain)
	p.pitch_scale = rate
	p.play()
	played += 1
	return true

# ---------- События игры ----------

## Выстрел: голос по id ствола; у чужих стволов без id — по устройству (дробь, пистолет, автомат).
func _on_shot(_shooter, w: Dictionary, from: Vector3) -> void:
	var G: Dictionary = GUNS.get(Data.real_id(str(w.get("id", ""))), {})
	if G.is_empty():
		G = GUNS["shotgun"] if int(w.get("pellets", 1)) > 1 else GUNS["pistol"] if w.get("anim", "") == "pistol" else GUNS["ak74"]
	var names: Array = G["s"]
	play_at(names.pick_random(), from, float(G["gain"]), float(G["rate"]) * _vary(0.04))
	if G.get("click", false):
		play_later(0.02, "dry", from, 0.55, 0.8 * _vary())
	if G.get("pump", false):
		play_later(0.28, "bolt", from, 0.55, 1.3)
	elif int(w.get("pellets", 1)) <= 1 and _shooter == game.player:
		# гильза звякнула об землю (только у героя — не забивать голоса чужой стрельбой)
		play_later(0.32 + randf() * 0.1, "casing1" if randf() < 0.5 else "casing2", from - Vector3(0, 1.3, 0), 0.22, _vary(0.1))

## Пуля в тело: у дроби (9 дробин в одну цель) — один звук на цель за 80 мс; бочки (no_blood) не «чавкают».
var _hit_t := {}

func _on_hit(target, at: Vector3) -> void:
	if is_instance_valid(target) and target.get("no_blood"):
		return
	var now := Time.get_ticks_msec()
	var key: int = target.get_instance_id() if is_instance_valid(target) else 0
	if now - int(_hit_t.get(key, -1000)) < 80:
		return
	_hit_t[key] = now
	if _hit_t.size() > 64:
		_hit_t.clear()
	play_at("flesh1" if randf() < 0.5 else "flesh2", at + Vector3(0, 1.0, 0), 0.45, _vary(0.12))

## Перезарядка героя: магазин (пистолет / автомат) или патроны в трубчатый магазин дробовика.
func on_reload(pos: Vector3, pistol: bool, shotgun: bool) -> void:
	var at := pos + Vector3(0, 1.2, 0)
	if shotgun:
		for i in 3:
			play_later(0.25 + i * 0.55, "shell", at, 0.5, _vary(0.06))
	else:
		play_at("reload_pistol" if pistol else "reload_rifle", at, 0.6, _vary(0.04))

## Взрыв гранаты или бочки (grenades.gd зовёт on_explosion у систем; граната наёмника — merc.gd).
func on_explosion(pos: Vector3, _radius: float) -> void:
	play_at("explosion", pos + Vector3(0, 0.5, 0), 1.0, _vary(0.04))

func _on_killed(target) -> void:
	if not is_instance_valid(target):
		return
	if not VOICES.has(str(target.get("type"))):
		return   # мур и прочие люди — не рычат, как заражённые
	var V: Dictionary = VOICES[str(target.get("type"))]
	play_at(["zdeath1", "zdeath2", "zdeath3"].pick_random(), target.global_position + Vector3(0, 1.2, 0), float(V["gain"]) * 1.1, float(V["rate"]) * _vary(0.06))
	groan_t.erase(target.get_instance_id())
	states.erase(target.get_instance_id())

## Удар заражённого по герою — только если рядом заражённый в замахе (пуля мура и осколки — без звука когтей).
func _on_player_hurt(_dmg: float) -> void:
	var pl = game.player
	if pl == null:
		return
	for e in game.enemies:
		if is_instance_valid(e) and e.alive and float(e.attack_t) >= 0.0 \
				and e.global_position.distance_to(pl.global_position) <= float(e.T.get("range", 1.3)) + 0.6:
			play_self(hurt, "zhit1" if randf() < 0.5 else "zhit2", 0.75, _vary(0.1))
			return

## Шум от героя с топором — это удар: если кто-то в зоне удара, слышно, как топор входит в тело.
func _on_noise(pos: Vector3, radius: float) -> void:
	var pl = game.player
	if radius > 9.0 or pl == null or not pl.alive or pos.distance_to(pl.global_position) > 0.3:
		return
	var w: Dictionary = pl.W()
	if w.get("slot", "") != "melee":
		return
	var fwd := Vector3(sin(pl.rotation.y), 0, cos(pl.rotation.y))
	for e in game.foes():
		var to: Vector3 = e.global_position - pl.global_position
		to.y = 0
		var d := to.length()
		if e.get("no_blood"):
			continue
		if d <= float(w.get("range", 2.0)) + float(e.T.get("radius", 0.4)) and (d < 0.3 or fwd.dot(to / d) >= cos(float(w.get("arc", 1.0)))):
			var fist: bool = pl.weapon_id() == "fists"
			play_at("flesh1" if fist else "chop", e.global_position + Vector3(0, 1.1, 0), 0.6 if fist else 0.8, _vary(0.08))
			return

# ---------- Каждый кадр: стоны, шаги, ветер, гром ----------

func _process(delta: float) -> void:
	var pl = game.player
	if pl == null or game.level == null:
		return
	listener.global_transform = Transform3D(game.camera.global_transform.basis, pl.global_position + Vector3(0, 1.6, 0))
	scan_t -= delta
	if scan_t <= 0.0:
		_groans(0.25 - scan_t)
		scan_t = 0.25
	_steps(delta, pl)
	_ambient(delta, pl)

## Стоны: у каждого заражённого рядом свой срок; в погоне — чаще; рубер, кинувшись, ревёт.
func _groans(dt: float) -> void:
	var p: Vector3 = game.player.global_position
	for e in game.enemies:
		if not is_instance_valid(e) or not e.alive:
			continue
		var id: int = e.get_instance_id()
		var chase: bool = e.state != "idle"
		if e.type == "ruber" and chase and states.get(id, "idle") == "idle" and e.global_position.distance_to(p) < GROAN_RANGE:
			roar(e)
		states[id] = e.state
		if e.global_position.distance_to(p) > GROAN_RANGE:
			continue
		if not groan_t.has(id):
			groan_t[id] = randf_range(0.5, 8.0)
		groan_t[id] = float(groan_t[id]) - dt
		if float(groan_t[id]) <= 0.0:
			groan_t[id] = randf_range(2.5, 6.0) if chase else randf_range(7.0, 16.0)
			if not groan(e):
				groan_t[id] = randf_range(0.8, 2.0)  # все голоса заняты — попробует позже

## Стон заражённого e; false — все голоса стонов заняты.
func groan(e) -> bool:
	var V: Dictionary = VOICES.get(str(e.type), VOICES["runner"])
	return play_at(GROANS.pick_random(), e.global_position + Vector3(0, 1.5, 0), float(V["gain"]), float(V["rate"]) * _vary(0.08), groan_pool, false)

## Рёв рубера: два стона октавой ниже внахлёст.
func roar(e) -> void:
	var at: Vector3 = e.global_position + Vector3(0, 1.6, 0)
	if play_at("groan3", at, 1.0, 0.5, groan_pool, false):
		get_tree().create_timer(0.25, false).timeout.connect(func(): play_at("groan1", at, 0.7, 0.62, groan_pool, false))

## Шаги героя: по пройденному пути (на бегу шаг длиннее и громче), запись — по покрытию.
func _steps(delta: float, pl) -> void:
	if not pl.alive or pl.speed < 0.1:
		stride = 0.0
		return
	var run: bool = pl.speed > 2.4
	stride += pl.speed * delta
	if stride > (1.05 if run else 0.68):
		stride = 0.0
		step(surface(pl.global_position), run)

func step(kind: String, run := false) -> bool:
	var list: Array = STEPS.get(kind, STEPS["road"])
	return play_self(steps, list.pick_random(), 0.32 if run else 0.2, _vary(0.08))

## Покрытие под ногами: пол в доме, асфальт и бетон, грунт, иначе трава (как level.surface в браузерной игре).
func surface(p: Vector3) -> String:
	if not game.level.building_at(p).is_empty():
		return "floor"
	var gr: Array = game.level.meta.get("plan", {}).get("grounds", [])
	for i in range(gr.size() - 1, -1, -1):
		var g: Dictionary = gr[i]
		var ry := float(g.get("ry", 0.0))
		var dx := p.x - float(g["x"])
		var dz := p.z - float(g["z"])
		var lx := dx * cos(ry) - dz * sin(ry)
		var lz := dx * sin(ry) + dz * cos(ry)
		if absf(lx) <= float(g["w"]) / 2.0 and absf(lz) <= float(g["d"]) / 2.0:
			return "road" if g.get("kind", "") in ["asphalt", "concrete"] else "dirt"
	return "grass"

## Ветер: в кластере громче, в стабе тише, в доме — глухо; последняя минута кластера — дальний гром.
func _ambient(delta: float, pl) -> void:
	var kind: String = Data.NODES.get(game.loc, {}).get("kind", "cluster")
	var want := 0.2 if kind == "cluster" else 0.1 if kind == "stab" else 0.15
	if not game.level.building_at(pl.global_position, -0.05).is_empty():
		want *= 0.35
	wind_db = lerpf(wind_db, linear_to_db(want), minf(1.0, delta * 1.5))
	wind.volume_db = wind_db
	var left: float = game.time_left(game.loc)
	if left < Data.WARN and left > 0.0:
		thunder_t -= delta
		if thunder_t <= 0.0:
			thunder_t = randf_range(9.0, 16.0)
			play_self(sky, "thunder", 0.55 * (1.0 - left / Data.WARN * 0.6), _vary(0.08))

# ---------- Автотест ----------

func smoke() -> int:
	var fail := 0
	var ok := streams.size() == FILES.size()
	print(("✓ " if ok else "✗ ") + "звуки загружены: %d из %d%s" % [streams.size(), FILES.size(), "" if ok else " (нет: %s)" % ", ".join(FILES.filter(func(f): return not streams.has(f)))])
	if not ok:
		fail += 1
	var at: Vector3 = game.player.global_position
	var n0 := played
	# обработчики событий — напрямую: сигналы игры слушают и другие системы
	for id in ["ak74", "fnfal", "spas12", "glock17", "awm"]:
		_on_shot(game.player, Data.weapon(id), at + Vector3(0, 1.3, 0))
	ok = played - n0 >= 5
	print(("✓ " if ok else "✗ ") + "выстрелы звучат по стволу: запущено %d" % (played - n0))
	if not ok:
		fail += 1
	var zs := []
	for i in 8:
		zs.append(game.spawn_enemy("runner", at + Vector3(2.0 + i * 0.6, 0, 3.0)))
	n0 = played
	_on_hit(zs[0], zs[0].global_position)
	_on_hit(zs[0], zs[0].global_position)   # вторая дробина в ту же цель — без второго звука
	_on_killed(zs[0])
	_on_player_hurt(5.0)   # рядом никто не замахивается (пуля, осколок) — без звука когтей
	var z1 = zs[1]
	z1.global_position = game.player.global_position + Vector3(0, 0, 1.0)
	z1.attack_t = 0.2
	_on_player_hurt(5.0)   # заражённый в замахе рядом — звук удара
	z1.attack_t = -1.0
	ok = played - n0 == 3
	print(("✓ " if ok else "✗ ") + "попадание (дробь — один звук), смерть заражённого, удар когтями только от заражённого рядом: %d звука" % (played - n0))
	if not ok:
		fail += 1
	# голоса стонов ограничены
	for p in groan_pool:
		p.stop()
	var voiced := 0
	for z in zs:
		if groan(z):
			voiced += 1
	var busy := 0
	for p in groan_pool:
		if p.playing:
			busy += 1
	ok = voiced >= 1 and voiced <= GROAN_VOICES and busy <= GROAN_VOICES
	print(("✓ " if ok else "✗ ") + "стоны: из %d заражённых застонали %d, голосов не больше %d" % [zs.size(), voiced, GROAN_VOICES])
	if not ok:
		fail += 1
	for z in zs:
		if is_instance_valid(z):
			z.queue_free()
		game.enemies.erase(z)
	n0 = played
	var kinds := []
	for k in STEPS:
		if step(k):
			kinds.append(k)
	var here := surface(game.player.global_position)
	ok = played - n0 == STEPS.size()
	print(("✓ " if ok else "✗ ") + "шаги по покрытиям: %s; под героем — %s" % [", ".join(kinds), here])
	if not ok:
		fail += 1
	ok = listener.is_current() and wind.stream != null
	print(("✓ " if ok else "✗ ") + "слушатель у героя, ветер над локацией")
	if not ok:
		fail += 1
	return fail
