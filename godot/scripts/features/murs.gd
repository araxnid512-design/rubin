extends Node
## Муры — бандиты Улья со своим стабом «Карьер» (в браузерной игре — game/murs.js, game/intel.js и RaidSquad,
## Garrison в game/main.js). Их до 50 (MUR_LIMIT); раз в 5–20 минут времени мира отряд в 5–10 человек уходит
## на вылазку в случайный кластер (в «Полис» — никогда), кучей или парами: бьёт заражённых и выносит тайники.
## На добытые спораны муры нанимают новых бойцов (MUR_PRICE за бойца, до лимита), остальное хранят в шкафах
## склада и будки главаря; раз в два часа времени мира «Карьер» пополняется до 50.
## Вылазка, на которую герой не попал, считается заочно: часть заражённых в кластере перебита, часть тайников
## пуста (до перезагрузки кластера). Если герой в том кластере — отряд заходит вживую через выход, идёт от
## тайника к тайнику, стреляет во всех и, когда время вышло, уходит через ближайший выход.
## В «Карьере» на постах — до 14 часовых, убитых сменяют из казармы; заметил героя один — тревога расходится
## по двору постепенно (ближние идут сразу, дальние позже). Что вынесешь из их шкафов — у муров убудет.
## Информатор у лавки торговца в «Полисе» (станция "info") за 10 споранов скажет, где сейчас отряд.
## Бой одного мура — features/bandit.gd. Учёт — в сохранении (save_data), время — game.world["time"].

const BanditScript := preload("res://scripts/features/bandit.gd")

const MUR_LIMIT := 50
## Сколько споранов стоит нанять одного мура.
const MUR_PRICE := 30
## Раз во сколько секунд времени мира стаб пополняется до лимита.
const MUR_RENEW := 7200.0
## Перерыв между вылазками, с.
const RAID_GAP := [300.0, 1200.0]
## Сколько длится вылазка, с: за это время отряд обходит кластер и уходит.
const RAID_TIME := [180.0, 300.0]
## Сколько муров всегда остаётся в стабе.
const GARRISON := 10
## Сколько секунд мур выгребает тайник.
const MUR_LOOT_TIME := 1.6
## Часовых в «Карьере» самое большее (остальные — в казарме, выходят на смену убитым).
const MAX_POSTS := 14
## Сколько споранов стоят сведения информатора.
const INTEL_PRICE := 10
## Здания «Карьера», в шкафах которых лежат запасы муров.
const STORE_BUILDINGS := ["Storage", "Boss"]

var game: Node
## Учёт: count, stash {вид: сколько}, next_raid, renew_at, raid (null или словарь вылазки), raids.
var m := {}
## Живые муры в текущей локации (узлы bandit.gd).
var bandits: Array = []
## Отряд на вылазке в кластере героя: {raid, members, groups, leaving, hurry} или пусто.
var squad := {}
## Гарнизон «Карьера»: {reserve, door, t, alerted} или пусто.
var garrison := {}
## Шкафы склада «Карьера» с запасами: [{c: тайник, items: что положили, done}].
var store: Array = []
var tick_t := 0.0
## Для автотеста: выстрелы муров и попадания по людям, последний ответ информатора.
var shots := 0
var human_hits := 0
var last_text := ""

func setup(g: Node) -> void:
	game = g

func now() -> float:
	return float(game.world.get("time", 0.0))

func _raid() -> Dictionary:
	var r = m.get("raid")
	return r if r is Dictionary else {}

func _cluster_ids() -> Array:
	var out := []
	for id in Data.NODES:
		if Data.NODES[id]["kind"] == "cluster":
			out.append(id)
	return out

# ---------- Учёт (как game/murs.js) ----------

## Муры в новом мире: полный стаб, немного запасов в шкафах, первая вылазка — через 5–20 минут.
## Патронов в Godot-версии нет — вместо них ремкомплекты.
func new_murs(t: float) -> Dictionary:
	return {
		"count": MUR_LIMIT,
		"stash": {"spore": 20, "zhivchik": 3, "repair": 3, "grenade": 1},
		"next_raid": t + randf_range(RAID_GAP[0], RAID_GAP[1]),
		"renew_at": t + MUR_RENEW,
		"raid": null,
		"raids": 0,
	}

## Из сохранения: числа из JSON — float, вылазка после загрузки — заочная (вживую — снова при входе).
func normalize(d: Dictionary, t: float) -> Dictionary:
	var r: Dictionary = d.duplicate(true)
	if typeof(r.get("stash")) != TYPE_DICTIONARY:
		r["stash"] = {}
	# убранные стволы в шкафах муров (старые сохранения) — ближайшие новые
	var st: Dictionary = {}
	for k in r["stash"]:
		var to := Data.real_id(str(k))
		st[to] = int(st.get(to, 0)) + int(r["stash"][k])
	r["stash"] = st
	r["count"] = clampi(int(r.get("count", MUR_LIMIT)), 0, MUR_LIMIT)
	if not r.has("next_raid"):
		r["next_raid"] = t + randf_range(RAID_GAP[0], RAID_GAP[1])
	if not r.has("renew_at"):
		r["renew_at"] = t + MUR_RENEW
	r["raids"] = int(r.get("raids", 0))
	var raid = r.get("raid")
	if raid is Dictionary:
		raid["live"] = false
		raid["size"] = int(raid.get("size", 0))
		if typeof(raid.get("loot")) != TYPE_DICTIONARY:
			raid["loot"] = {}
	else:
		r["raid"] = null
	return r

## На добытые спораны — новые бойцы (до лимита), остальное остаётся в шкафах.
func hire() -> int:
	var st: Dictionary = m["stash"]
	var hired := 0
	while int(m["count"]) < MUR_LIMIT and int(st.get("spore", 0)) >= MUR_PRICE:
		st["spore"] = int(st["spore"]) - MUR_PRICE
		m["count"] = int(m["count"]) + 1
		hired += 1
	return hired

## Добыча отряда — в шкафы стаба.
func store_loot(loot: Dictionary) -> void:
	var st: Dictionary = m["stash"]
	for k in loot:
		var n := int(loot[k])
		if n > 0:
			st[k] = int(st.get(k, 0)) + n

## Время мира дошло до t: пополнение раз в два часа, начало и конец вылазок. clusters — куда можно пойти,
## here — где сейчас герой (туда отряд придёт вживую). События: {started}, {ended, summary}, {renewed}.
func tick(t: float, clusters: Array, here: String) -> Array:
	var events := []
	while t >= float(m["renew_at"]):
		m["renew_at"] = float(m["renew_at"]) + MUR_RENEW
		var n: int = MUR_LIMIT - int(m["count"])
		m["count"] = MUR_LIMIT
		if n > 0:
			events.append({"renewed": n})
	var raid := _raid()
	if not raid.is_empty() and t >= float(raid["end"]) and not bool(raid.get("live", false)):
		m["raid"] = null
		var danger := int(Data.NODES.get(str(raid["at"]), {}).get("danger", 1))
		events.append({"ended": raid, "summary": resolve_raid(raid, danger)})
		m["next_raid"] = t + randf_range(RAID_GAP[0], RAID_GAP[1])
	if _raid().is_empty() and t >= float(m["next_raid"]):
		var free: int = int(m["count"]) - GARRISON
		if free >= 5 and not clusters.is_empty():
			var at: String = clusters.pick_random()
			m["raid"] = {
				"at": at, "size": mini(free, randi_range(5, 10)), "start": t, "end": t + randf_range(RAID_TIME[0], RAID_TIME[1]),
				"mode": "crowd" if randf() < 0.5 else "pairs", "loot": {}, "live": at == here, "kills": 0, "known": false,
			}
			m["raids"] = int(m.get("raids", 0)) + 1
			events.append({"started": m["raid"]})
		else:
			m["next_raid"] = t + randf_range(RAID_GAP[0], RAID_GAP[1])
	return events

## Заочная вылазка: отряд перебил часть заражённых и выгреб часть тайников (метка — на кластере), сам потерял
## 0–опасность бойцов, принёс спораны, живчики, ремкомплекты.
func resolve_raid(raid: Dictionary, danger: int) -> Dictionary:
	var size := int(raid.get("size", 0))
	var kills := int(randi_range(4, 8) * size / 6.0)
	var losses := mini(size, randi_range(0, maxi(1, danger)))
	m["count"] = maxi(0, int(m["count"]) - losses)
	var loot := {"spore": kills * randi_range(1, 2) + randi_range(1, 6), "zhivchik": randi_range(0, 2), "repair": 1 if randf() < 0.3 else 0, "grenade": 1 if randf() < 0.2 else 0}
	var rl: Dictionary = raid.get("loot", {})
	for k in rl:
		loot[k] = int(loot.get(k, 0)) + int(rl[k])
	store_loot(loot)
	var hired := hire()
	return {"kills": kills, "losses": losses, "loot": loot, "hired": hired, "mark": {"kill": randf_range(0.35, 0.65), "loot": randf_range(0.4, 0.75)}}

## Учёт по времени мира; отряд в кластер героя приходит вживую, заочная вылазка оставляет следы.
func update_murs(clusters: Array = []) -> void:
	if m.is_empty():
		m = new_murs(now())
	var cl: Array = clusters if not clusters.is_empty() else _cluster_ids()
	var here: String = game.loc if Data.NODES.get(game.loc, {}).get("kind", "") == "cluster" else ""
	for ev in tick(now(), cl, here):
		if ev.has("started") and bool(ev["started"].get("live", false)) and game.level != null:
			start_live_raid(ev["started"], false)
		if ev.has("ended"):
			mark_raided(str(ev["ended"]["at"]), ev["summary"]["mark"])

## Заочная вылазка закончилась: кластер запоминает её следы (до своей перезагрузки).
func mark_raided(at: String, mk: Dictionary) -> void:
	var c = game.world.get("clusters", {}).get(at)
	if not c is Dictionary:
		return
	if at == game.loc and game.level != null:
		apply_mark_here(mk)
		return
	var saved = c.get("saved")
	if saved is Dictionary:
		var keep := []
		for e in saved.get("enemies", []):
			if randf() >= float(mk["kill"]):
				keep.append(e)
		saved["enemies"] = keep
		for k in saved.get("containers", []):
			if not k[0] and randf() < float(mk["loot"]):
				k[0] = true
				k[1] = []
	else:
		# кластер ещё не построен: метка ждёт входа героя, но только в этом цикле кластера
		c["raided"] = {"kill": float(mk["kill"]), "loot": float(mk["loot"]), "cycle": float(c.get("next", 0.0))}

## Следы вылазки в построенном кластере: убрать долю заражённых, выгрести долю тайников.
func apply_mark_here(mk: Dictionary) -> void:
	for e in game.enemies.duplicate():
		if is_instance_valid(e) and e.alive and randf() < float(mk["kill"]):
			game.enemies.erase(e)
			e.queue_free()
	for c in game.level.containers:
		if not c["searched"] and randf() < float(mk["loot"]):
			c["items"] = []
			c["searched"] = true

func _apply_raided(id: String) -> void:
	var c = game.world.get("clusters", {}).get(id)
	if not c is Dictionary:
		return
	var mk = c.get("raided")
	if mk is Dictionary:
		c.erase("raided")
		if absf(float(mk.get("cycle", -1.0)) - float(c.get("next", 0.0))) < 1.0:
			apply_mark_here(mk)

# ---------- Системные точки ----------

func save_data() -> Dictionary:
	return m

func load_data(d) -> void:
	if typeof(d) == TYPE_DICTIONARY and not d.is_empty():
		m = normalize(d, now())
	else:
		m = new_murs(now())

func on_enter(id: String) -> void:
	update_murs()
	var kind: String = Data.NODES.get(id, {}).get("kind", "")
	if kind == "cluster":
		_apply_raided(id)
		var raid := _raid()
		if not raid.is_empty() and str(raid["at"]) == id and not bool(raid.get("live", false)):
			start_live_raid(raid, true)
	elif kind == "murs":
		populate_murs()
		_late_toast("Логово муров — около %d %s. Заметят — не уйдёшь" % [int(m["count"]), Data.plural(int(m["count"]), ["ствол", "ствола", "стволов"])])

func on_leave() -> void:
	var raid := _raid()
	if not raid.is_empty() and bool(raid.get("live", false)):
		# герой ушёл — остаток вылазки считается заочно
		raid["live"] = false
		var n := 0
		for b in bandits:
			if is_instance_valid(b) and b.alive and not b.left and b.role == "raid":
				n += 1
		raid["size"] = n
		if n == 0 and not squad.is_empty():
			finish_raid()
	for b in bandits:
		if is_instance_valid(b):
			game.hostiles.erase(b)
			game.targets.erase(b)
			b.queue_free()
	bandits.clear()
	squad = {}
	garrison = {}
	store = []

func _process(delta: float) -> void:
	if game == null or not game.world.has("time"):
		return
	tick_t -= delta
	if tick_t <= 0.0:
		tick_t = 1.0
		update_murs()
	if not squad.is_empty():
		_update_squad()
	if not garrison.is_empty():
		_update_garrison(delta)
	if not store.is_empty():
		_watch_store()

## Тост после названия локации (enter() показывает его после on_enter).
func _late_toast(text: String) -> void:
	get_tree().create_timer(1.6).timeout.connect(_toast_if.bind(text, str(game.loc)))

func _toast_if(text: String, at: String) -> void:
	if game.loc == at:
		game.toast(text)

# ---------- Муры в локации ----------

func _spawn(gun: String, pos: Vector3, role: String, post: Dictionary = {}):
	var b = BanditScript.new()
	game.add_child(b)
	b.setup(game, self, gun, pos, post)
	b.role = role
	bandits.append(b)
	game.hostiles.append(b)
	game.targets.append(b)
	return b

func _free_near(at: Vector3, r: float) -> Vector3:
	for i in 24:
		var a := randf() * TAU
		var dd := randf() * r
		var p := at + Vector3(cos(a) * dd, 0, sin(a) * dd)
		if not game.level.blocked_at(p):
			return p
	return at

## Мур убит: спораны — всегда, его ствол — бывает, ремкомплект — иногда; в «Карьере» стало меньше.
func bandit_died(b) -> void:
	game.kills += 1
	game.emit_signal("enemy_killed", b)
	var p: Vector3 = b.global_position
	game.spawn_pickup("spore", 1 + randi() % 3, p + Vector3(0, 0, -0.5))
	if randf() < 0.3:
		game.spawn_pickup(str(b.weapon), 1, p + Vector3(-0.5, 0, -0.2))
	if randf() < 0.2:
		game.spawn_pickup("repair", 1, p + Vector3(0.4, 0, 0.3))
	m["count"] = maxi(0, int(m["count"]) - 1)
	if b.role == "raid" and not squad.is_empty():
		var raid: Dictionary = squad["raid"]
		raid["size"] = maxi(0, int(raid["size"]) - 1)
	game.hostiles.erase(b)
	game.targets.erase(b)
	game.hud_refresh()

## Тело убрано (через 12 с после гибели).
func forget(b) -> void:
	bandits.erase(b)
	game.hostiles.erase(b)
	game.targets.erase(b)

## Наёмник: у него поле is_merc или метод is_merc().
func is_merc(t) -> bool:
	if not is_instance_valid(t):
		return false
	if t.has_method("is_merc"):
		return bool(t.is_merc())
	var v = t.get("is_merc")
	return v is bool and v

func is_human(t) -> bool:
	return is_instance_valid(t) and (t == game.player or is_merc(t))

## Цель мура: ближайший, кого он видит на дальность своего ствола — заражённый, герой или наёмник.
func target_for(b) -> Variant:
	var reach := float(b.W.get("range", 8.0))
	var bp: Vector3 = b.global_position
	var cands := []
	for e in game.enemies:
		if is_instance_valid(e) and e.alive:
			_cand(cands, e, bp, reach)
	if is_instance_valid(game.player) and game.player.alive:
		_cand(cands, game.player, bp, reach)
	for t in game.targets:
		if is_instance_valid(t) and t.alive and is_merc(t):
			_cand(cands, t, bp, reach)
	cands.sort_custom(func(x, y): return x[0] < y[0])
	for cd in cands:
		if game.line_of_sight(bp, cd[1].global_position):
			return cd[1]
	return null

func _cand(cands: Array, a, bp: Vector3, reach: float) -> void:
	var ap: Vector3 = a.global_position
	var d := Vector2(ap.x - bp.x, ap.z - bp.z).length()
	if d < reach:
		cands.append([d, a])

## Сколько муров (кроме me) сейчас стреляют по t в свою очередь.
func shooters_on(t, me) -> int:
	var n := 0
	for b in bandits:
		if not is_instance_valid(b) or b == me or not b.alive:
			continue
		if is_instance_valid(b.aim_at) and b.aim_at == t and b.turn_t > 0.0:
			n += 1
	return n

## Не наступать на своих: отталкивание от муров ближе 0,8 м.
func separation(me) -> Vector3:
	var push := Vector3.ZERO
	var mp: Vector3 = me.global_position
	for o in bandits:
		if not is_instance_valid(o) or o == me or not o.alive:
			continue
		var op: Vector3 = o.global_position
		var off := Vector3(mp.x - op.x, 0.0, mp.z - op.z)
		var r := off.length()
		if r < 0.8 and r > 0.0001:
			push += off / r * (0.8 - r) * 2.0
	return push

## Кого-то ранили: на вылазке поднимаются все ближе 25 м, в «Карьере» — тревога расходится по двору.
func alarm(b, from: Vector3) -> void:
	if b.role == "raid" and not squad.is_empty():
		for o in squad["members"]:
			if is_instance_valid(o) and o.alive and o.aggro.is_empty() and o.global_position.distance_to(from) < 25.0:
				o.aggro = {"pos": from, "t": 8.0}
	elif b.role == "garrison" and not garrison.is_empty():
		_garrison_alarm(from)

# ---------- Вылазка вживую (RaidSquad) ----------

## Отряд муров заходит в кластер героя через выход (exit_index < 0 — случайный): кучей или парами.
func start_live_raid(raid: Dictionary, resumed: bool, exit_index := -1) -> void:
	raid["live"] = true
	var exits: Array = game.level.exits
	var st: Dictionary = game.level.meta.get("start", {"x": 0, "z": 0})
	var spawn := Vector3(float(st["x"]), 0, float(st["z"]))
	if not exits.is_empty():
		var e: Dictionary = exits[exit_index] if exit_index >= 0 and exit_index < exits.size() else exits.pick_random()
		spawn = Vector3(float(e["spawn"][0]), 0, float(e["spawn"][1]))
	var members := []
	for k in int(raid["size"]):
		var gun: String = BanditScript.MUR_GUNS.pick_random()
		members.append(_spawn(gun, _free_near(spawn, 2.0), "raid"))
	var size: int = 2 if raid.get("mode", "crowd") == "pairs" else maxi(1, members.size())
	var groups := []
	var i := 0
	while i < members.size():
		var g := {"id": groups.size(), "members": members.slice(i, i + size), "goal": {}, "loot_t": 0.0, "skip": []}
		for b in g["members"]:
			b.group = g
		groups.append(g)
		i += size
	squad = {"raid": raid, "members": members, "groups": groups, "leaving": false, "hurry": false}
	var n := int(raid["size"])
	var text := "Муры! %s отряд муров — %d %s, %s. Выносят тайники и стреляют во всех" % ["В кластере" if resumed else "В кластер зашёл", n, Data.plural(n, ["ствол", "ствола", "стволов"]), "парами" if raid.get("mode", "") == "pairs" else "кучей"]
	if resumed:
		_late_toast(text)
	else:
		game.toast(text)

## Цель группы: ближайший к ней тайник, к которому не идёт другая группа; нет (или время вышло) — выход.
func _pick(g: Dictionary) -> void:
	var cx := 0.0
	var cz := 0.0
	var n := 0
	for b in g["members"]:
		if is_instance_valid(b) and b.alive:
			cx += b.global_position.x
			cz += b.global_position.z
			n += 1
	if n == 0:
		g["goal"] = {}
		return
	cx /= n
	cz /= n
	var taken := []
	for o in squad["groups"]:
		if int(o["id"]) != int(g["id"]) and o["goal"].has("ci"):
			taken.append(int(o["goal"]["ci"]))
	var conts: Array = game.level.containers
	var best := -1
	var bd := INF
	if not squad["leaving"]:
		for ci in conts.size():
			var c: Dictionary = conts[ci]
			if c["searched"] or taken.has(ci) or g["skip"].has(ci):
				continue
			var d := Vector2(float(c["ax"]) - cx, float(c["az"]) - cz).length()
			if d < bd:
				bd = d
				best = ci
	if best >= 0:
		g["goal"] = {"x": float(conts[best]["ax"]), "z": float(conts[best]["az"]), "ci": best}
	else:
		var st: Dictionary = game.level.meta.get("start", {"x": 0, "z": 0})
		var goal := {"x": float(st["x"]), "z": float(st["z"]), "exit": true}
		for e in game.level.exits:
			var d2 := Vector2(float(e["spawn"][0]) - cx, float(e["spawn"][1]) - cz).length()
			if d2 < bd:
				bd = d2
				goal = {"x": float(e["spawn"][0]), "z": float(e["spawn"][1]), "exit": true}
		g["goal"] = goal
		squad["hurry"] = true
	g["loot_t"] = 0.0

## Куда идти муру на вылазке (Vector3.INF — некуда). В куче каждый держит своё место рядом с целью.
func goal_for(b) -> Vector3:
	if b.role != "raid" or squad.is_empty() or b.group.is_empty():
		return Vector3.INF
	var g: Dictionary = b.group
	var goal: Dictionary = g["goal"]
	if goal.is_empty() or (goal.has("ci") and game.level.containers[int(goal["ci"])]["searched"]):
		_pick(g)
		goal = g["goal"]
	if goal.is_empty():
		return Vector3.INF
	var p := Vector3(float(goal["x"]), 0, float(goal["z"]))
	var members: Array = g["members"]
	if members.size() > 2 and members.find(b) >= 2:
		var q := p + Vector3(b.offset.x, 0, b.offset.y)
		if not game.level.blocked_at(q):
			return q
	return p

func hurry(b) -> bool:
	return b.role == "raid" and not squad.is_empty() and bool(squad["hurry"])

## Мур дошёл до цели: у тайника — выгребает (MUR_LOOT_TIME), у выхода — уходит из кластера.
func arrived(b, dt: float) -> void:
	if b.role != "raid" or squad.is_empty() or b.group.is_empty():
		return
	var g: Dictionary = b.group
	var goal: Dictionary = g["goal"]
	if goal.is_empty():
		return
	if goal.get("exit", false):
		b.gone = true
		return
	var c: Dictionary = game.level.containers[int(goal["ci"])]
	if c["searched"]:
		_pick(g)
		return
	g["loot_t"] = float(g["loot_t"]) + dt
	if float(g["loot_t"]) < MUR_LOOT_TIME:
		return
	var loot: Dictionary = squad["raid"]["loot"]
	for it in c["items"]:
		loot[it[0]] = int(loot.get(it[0], 0)) + int(it[1])
	c["items"] = []
	c["searched"] = true
	_pick(g)

## Мур застрял надолго: к выходу — считай, ушёл; к тайнику — группа идёт к другому.
func stuck(b) -> void:
	if b.role != "raid" or squad.is_empty() or b.group.is_empty():
		return
	var g: Dictionary = b.group
	var goal: Dictionary = g["goal"]
	if goal.get("exit", false):
		b.gone = true
	elif goal.has("ci"):
		g["skip"].append(int(goal["ci"]))
		_pick(g)

func _update_squad() -> void:
	var raid: Dictionary = squad["raid"]
	if not squad["leaving"] and now() >= float(raid["end"]):
		squad["leaving"] = true
		for g in squad["groups"]:
			_pick(g)
	var late := now() > float(raid["end"]) + 120.0   # совсем застряли — всё равно уходят
	var done := true
	for b in squad["members"]:
		if not is_instance_valid(b):
			continue
		if b.alive and not b.left and (b.gone or late):
			b.left = true
			forget(b)
			b.queue_free()
			continue
		if b.alive and not b.left:
			done = false
	if done:
		finish_raid()

## Живая вылазка закончилась: добыча — в шкафы «Карьера», на спораны — новые бойцы.
func finish_raid() -> void:
	if squad.is_empty():
		return
	var raid: Dictionary = squad["raid"]
	var any_left := false
	for b in squad["members"]:
		if is_instance_valid(b) and b.left:
			any_left = true
	squad = {}
	store_loot(raid.get("loot", {}))
	hire()
	m["raid"] = null
	m["next_raid"] = now() + 300.0 + randf() * 900.0
	if any_left:
		game.toast("Отряд муров ушёл из кластера")

# ---------- «Карьер» (Garrison) ----------

## На постах — до 14 муров (сколько их сейчас дома), остальные выходят из казармы на смену убитым.
## В шкафах склада и будки главаря — их запасы; остальная мебель — как в любом доме.
func populate_murs() -> void:
	var raid := _raid()
	var home := maxi(0, int(m["count"]) - (int(raid["size"]) if not raid.is_empty() else 0))
	var all = game.level.meta.get("posts", [])
	if not all is Array:
		all = []
	# ворота и вышки заняты всегда, остальные посты — как выпадет
	var posts: Array = all.slice(0, 6)
	var rest: Array = all.slice(6)
	rest.shuffle()
	posts.append_array(rest)
	var active := mini(MAX_POSTS, mini(home, posts.size()))
	var door := Vector3.ZERO
	var dd = game.level.meta.get("barracksDoor")
	if dd is Dictionary:
		door = Vector3(float(dd["x"]), 0, float(dd["z"]))
	garrison = {"reserve": home - active, "door": door, "t": 0.0, "alerted": false}
	for i in active:
		var p: Array = posts[i]
		var gun: String = BanditScript.MUR_GUNS.pick_random()
		_spawn(gun, Vector3(float(p[0]), 0, float(p[1])), "garrison", {"x": float(p[0]), "z": float(p[1]), "ry": float(p[2])})
	var shelves := []
	for c in game.level.containers:
		c["searched"] = false
		if c.get("building", "") in STORE_BUILDINGS:
			c["items"] = []
			shelves.append(c)
		else:
			c["items"] = Data.roll_loot(c.get("loot", {}))
	var st: Dictionary = m["stash"]
	var k := 0
	for kind in st:
		var n := int(st[kind])
		if n > 0 and not shelves.is_empty():
			var parts := mini(shelves.size(), maxi(1, ceili(n / 30.0)))
			for j in parts:
				var q: int = int(n / parts) + (1 if j < n % parts else 0)
				if q > 0:
					shelves[(k + j) % shelves.size()]["items"].append([kind, q])
		k += 1
	store = []
	for c in shelves:
		store.append({"c": c, "items": c["items"].duplicate(true), "done": false})

## Тревога расходится по «Карьеру» постепенно: кто ближе к месту — идёт сразу, дальние — позже.
func _garrison_alarm(from: Vector3) -> void:
	garrison["alerted"] = true
	for b in bandits:
		if not is_instance_valid(b) or not b.alive or not b.aggro.is_empty() or b.alarmed:
			continue
		b.alarmed = true
		b.alarm_t = b.global_position.distance_to(from) * 0.15
		b.alarm_pos = from

func _update_garrison(delta: float) -> void:
	var p = game.player
	var alive_n := 0
	var seen := false
	for b in bandits:
		if is_instance_valid(b) and b.alive:
			alive_n += 1
			if is_instance_valid(p) and is_instance_valid(b.target) and b.target == p:
				seen = true
	# кто-то видит героя — поднимает всех
	if seen and p.alive:
		_garrison_alarm(p.global_position)
	if int(garrison["reserve"]) <= 0 or alive_n >= MAX_POSTS:
		return
	garrison["t"] = float(garrison["t"]) - delta
	if float(garrison["t"]) > 0.0:
		return
	var alerted: bool = garrison["alerted"]
	garrison["t"] = 5.0 if alerted else 8.0
	garrison["reserve"] = int(garrison["reserve"]) - 1
	var door: Vector3 = garrison["door"]
	var gun: String = BanditScript.MUR_GUNS.pick_random()
	var nb = _spawn(gun, Vector3(door.x + randf() - 0.5, 0, door.z), "garrison")
	if alerted and is_instance_valid(p):
		nb.aggro = {"pos": p.global_position, "t": 12.0}
	else:
		nb.post = {"x": door.x + (randf() - 0.5) * 6.0, "z": door.z + 3.0 + randf() * 3.0, "ry": randf() * 6.0}

## Герой обыскал шкаф склада — что вынес, у муров убыло.
func _watch_store() -> void:
	var st: Dictionary = m["stash"]
	for s in store:
		if not s["done"] and s["c"]["searched"]:
			s["done"] = true
			for it in s["items"]:
				st[it[0]] = maxi(0, int(st.get(it[0], 0)) - int(it[1]))

# ---------- Информатор (как game/intel.js) ----------

func interact(s: Dictionary) -> bool:
	if str(s.get("id", "")) != "info":
		return false
	open_intel("")
	return true

## «~40 с», «~2,5 мин».
static func approx(s: float) -> String:
	if s < 50.0:
		return "~%d с" % maxi(10, int(roundf(s / 10.0)) * 10)
	var mm := roundf(s / 30.0) / 2.0
	if is_equal_approx(mm, floorf(mm)):
		return "~%d мин" % int(mm)
	return "~%d,5 мин" % int(floorf(mm))

## Что скажет информатор о мурах сейчас.
func intel_text() -> String:
	var raid := _raid()
	var t := now()
	if not raid.is_empty():
		var n := int(raid["size"])
		var how := "ходят парами" if raid.get("mode", "") == "pairs" else "идут кучей"
		var at: String = Data.NODES.get(str(raid["at"]), {}).get("short", str(raid["at"]))
		return "Отряд муров — %d %s — сейчас в кластере «%s», %s. Уйдут примерно через %s." % [n, Data.plural(n, ["ствол", "ствола", "стволов"]), at, how, approx(maxf(0.0, float(raid["end"]) - t))]
	return "Сейчас муры сидят в «Карьере», их около %d. Следующая вылазка — примерно через %s, а куда — пока не знаю: заходи потом." % [int(m["count"]), approx(maxf(0.0, float(m["next_raid"]) - t))]

## Окно информатора; told — только что купленные сведения. Купленное о текущей вылазке повторяет бесплатно.
func open_intel(told: String) -> void:
	if m.is_empty():
		m = new_murs(now())
	var sp := int(game.bag.get("spore", 0))
	var raid := _raid()
	var known: bool = told == "" and not raid.is_empty() and bool(raid.get("known", false))
	var text := told
	if text == "" and known:
		text = intel_text()
	if text == "":
		text = "«Знаю, где муры и когда пойдут на вылазку. Скажу за %d %s»." % [INTEL_PRICE, Data.plural(INTEL_PRICE, ["споран", "спорана", "споранов"])]
	last_text = text
	var acts := []
	if told == "" and not known:
		acts.append(["Узнать · %d сп." % INTEL_PRICE, _buy_intel, sp >= INTEL_PRICE])
	acts.append(["Закрыть", Callable(game.hud, "hide_panel")])
	game.hud.show_panel("Информатор", "Спораны: %d\n\n%s" % [sp, text], acts)

func _buy_intel() -> void:
	if int(game.bag.get("spore", 0)) < INTEL_PRICE:
		game.toast("Не хватает споранов")
		return
	game.bag["spore"] = int(game.bag["spore"]) - INTEL_PRICE
	var raid := _raid()
	if not raid.is_empty():
		raid["known"] = true
	game.hud_refresh()
	game.save()
	open_intel(intel_text())

# ---------- Автотест (main.gd -- --smoke) ----------

func _ok(cond: bool, msg: String) -> int:
	print(("✓ " if cond else "✗ ") + msg)
	return 0 if cond else 1

func _wait(s: float) -> void:
	await get_tree().create_timer(s).timeout

## Открытое место в кластере: не в стене, не в доме, вокруг на 5 м видно в 6 из 8 сторон.
func _open_spot() -> Vector3:
	var lv = game.level
	for i in 400:
		var p := Vector3(randf_range(-40, 40), 0, randf_range(-40, 40))
		if lv.blocked_at(p) or not lv.building_at(p, 1.0).is_empty():
			continue
		var ok := 0
		for k in 8:
			var q := p + Vector3(cos(k * TAU / 8.0), 0, sin(k * TAU / 8.0)) * 5.0
			if not lv.blocked_at(q) and game.line_of_sight(p, q):
				ok += 1
		if ok >= 6:
			return p
	return Vector3.INF

## Место для героя дальше min_d от всех точек pts (не у выхода).
func _spot_away(pts: Array, min_d: float) -> Vector3:
	var lv = game.level
	for i in 600:
		var p := Vector3(randf_range(-55, 55), 0, randf_range(-55, 55))
		if lv.blocked_at(p) or not lv.exit_at(p).is_empty():
			continue
		var far := true
		for q in pts:
			if p.distance_to(q) < min_d:
				far = false
				break
		if far:
			return p
	return Vector3.INF

## Поставить живых муров вокруг точки на 4–6 м, где её видно.
func _ring(bs: Array, at: Vector3) -> void:
	var n := maxi(1, bs.size())
	var i := 0
	for b in bs:
		var placed := false
		for tries in 24:
			var a := (float(i) + tries * 0.37) * TAU / n
			var q := at + Vector3(cos(a), 0, sin(a)) * randf_range(4.0, 6.0)
			if not game.level.blocked_at(q) and game.line_of_sight(at, q):
				b.global_position = q
				placed = true
				break
		if not placed:
			b.global_position = at + Vector3(4.5, 0, 0)
		# новая цель для всех: прицел заново
		b.aggro = {}
		b.alarmed = false
		b.path = PackedVector3Array()
		b.aim_at = null
		b.turn_t = 0.0
		b.target = null
		b.had_target = false
		b.retarget = 0.0
		i += 1

func _alive_bandits(role: String) -> Array:
	var out := []
	for b in bandits:
		if is_instance_valid(b) and b.alive and b.role == role and not b.left:
			out.append(b)
	return out

## Сколько муров сейчас по очереди стреляют по t.
func _shooting_at(t) -> int:
	var n := 0
	for b in bandits:
		if is_instance_valid(b) and b.alive and is_instance_valid(b.aim_at) and b.aim_at == t and b.turn_t > 0.0:
			n += 1
	return n

func smoke() -> int:
	var fails := 0
	game.enter("stab", null)
	await _wait(0.3)
	var t0 := now()
	# --- учёт: новый мир, наём, пополнение ---
	m = new_murs(t0)
	m["next_raid"] = t0 + 99999.0
	fails += _ok(int(m["count"]) == MUR_LIMIT and m["stash"].has("spore"), "муры: в новом мире %d в «Карьере», в шкафах %s" % [int(m["count"]), m["stash"]])
	m["count"] = 40
	m["stash"]["spore"] = 100
	var hired := hire()
	fails += _ok(hired == 3 and int(m["count"]) == 43 and int(m["stash"]["spore"]) == 10, "наём на спораны: +%d бойца, муров %d, споранов в шкафах %d" % [hired, int(m["count"]), int(m["stash"]["spore"])])
	m["renew_at"] = t0 - 1.0
	var evs := tick(t0, _cluster_ids(), "")
	var renewed := 0
	for ev in evs:
		renewed += int(ev.get("renewed", 0))
	fails += _ok(renewed == 7 and int(m["count"]) == MUR_LIMIT and float(m["renew_at"]) > t0, "пополнение раз в два часа: +%d, муров %d" % [renewed, int(m["count"])])
	# --- заочная вылазка: следы в сохранённом кластере ---
	var cl: Dictionary = game.world["clusters"]["himmash"]
	var old_saved = cl.get("saved")
	var fake_en := []
	for i in 20:
		fake_en.append(["runner", float(i), 5.0, 60.0])
	var fake_cs := []
	for i in 12:
		fake_cs.append([false, [["spore", 2]]])
	cl["saved"] = {"enemies": fake_en, "containers": fake_cs, "pickups": [], "features": {}}
	m["next_raid"] = t0 - 1.0
	evs = tick(t0, ["himmash"], "stab")
	var raid := _raid()
	fails += _ok(not raid.is_empty() and raid["at"] == "himmash" and int(raid["size"]) >= 5 and int(raid["size"]) <= 10 and not raid["live"], "вылазка: отряд %s стволов ушёл в «Химмаш» (%s), героя там нет — заочно" % [raid.get("size", 0), raid.get("mode", "")])
	var count0 := int(m["count"])
	raid["end"] = t0 - 1.0
	evs = tick(t0, ["himmash"], "stab")
	var summary := {}
	for ev in evs:
		if ev.has("ended"):
			summary = ev["summary"]
			mark_raided(str(ev["ended"]["at"]), ev["summary"]["mark"])
	var left_en: int = cl["saved"]["enemies"].size()
	var emptied := 0
	for k in cl["saved"]["containers"]:
		if k[0]:
			emptied += 1
	fails += _ok(_raid().is_empty() and not summary.is_empty() and int(summary["kills"]) > 0 and int(summary["loot"]["spore"]) > 0 and int(m["count"]) <= count0, "вылазка вернулась: убито %s, потери %s, добыча %s, нанято %s" % [summary.get("kills"), summary.get("losses"), summary.get("loot"), summary.get("hired")])
	fails += _ok(left_en < 20 and emptied > 0, "следы в «Химмаше»: заражённых 20 → %d, тайников выгребено %d из 12" % [left_en, emptied])
	cl["saved"] = old_saved
	# --- заочная вылазка в непостроенный кластер: метка ждёт входа героя ---
	var cd: Dictionary = game.world["clusters"]["dachi"]
	cd["saved"] = null
	cd["next"] = now() + 600.0
	mark_raided("dachi", {"kill": 0.5, "loot": 0.6})
	fails += _ok(cd.get("raided") is Dictionary, "метка вылазки на «Дачах» (кластер ещё не построен)")
	game.enter("dachi", null)
	await _wait(0.3)
	var searched := 0
	for c in game.level.containers:
		if c["searched"]:
			searched += 1
	fails += _ok(searched > 0 and not cd.has("raided"), "«Дачи»: при входе тайников выгребено %d из %d, заражённых %d" % [searched, game.level.containers.size(), game.enemies.size()])
	# --- живая вылазка в кластере героя ---
	game.world["clusters"]["zarechny"]["next"] = now() + 600.0
	game.enter("zarechny", null)
	await _wait(0.3)
	for e in game.enemies:
		if is_instance_valid(e):
			e.queue_free()
	game.enemies.clear()
	var spot := _open_spot()
	if spot == Vector3.INF:
		spot = Vector3(0, 0, 0)
	var far_exit := 0
	var fd := 0.0
	for i in game.level.exits.size():
		var e: Dictionary = game.level.exits[i]
		var dd := spot.distance_to(Vector3(float(e["spawn"][0]), 0, float(e["spawn"][1])))
		if dd > fd:
			fd = dd
			far_exit = i
	game.player.global_position = spot
	m["next_raid"] = now() - 1.0
	evs = tick(now(), ["zarechny"], "zarechny")
	raid = _raid()
	if not raid.is_empty() and raid["live"]:
		start_live_raid(raid, false, far_exit)
	var raiders := _alive_bandits("raid")
	var listed := true
	for b in raiders:
		if not game.hostiles.has(b) or not game.targets.has(b):
			listed = false
	fails += _ok(not raid.is_empty() and raid["live"] and raiders.size() == int(raid["size"]) and listed and not squad.is_empty(), "муры зашли в «Заречный»: %d, групп %d (%s), в hostiles и targets: %s" % [raiders.size(), squad.get("groups", []).size(), raid.get("mode", ""), listed])
	await _wait(1.0)
	var goals := 0
	for g in squad.get("groups", []):
		if g["goal"].has("ci"):
			goals += 1
	fails += _ok(goals > 0, "группы идут к тайникам: целей %d" % goals)
	# стреляют по заражённому
	if raiders.is_empty():
		return fails + 1
	var b0 = raiders[0]
	var fwd := Vector3(sin(b0.rotation.y), 0, cos(b0.rotation.y))
	var zpos := _free_near(b0.global_position + fwd * 4.0, 1.5)
	var z = game.spawn_enemy("runner", zpos)
	var s0 := shots
	await _wait(3.0)
	var z_hit: bool = not is_instance_valid(z) or not z.alive or z.hp < 60.0
	fails += _ok(shots > s0 and z_hit, "муры стреляют по заражённому: выстрелов %d, бегун %s" % [shots - s0, "убит" if not is_instance_valid(z) or not z.alive else "ранен" if z_hit else "цел"])
	if is_instance_valid(z) and z.alive:
		z.damage(1000.0, z.global_position)
	# стреляют по герою: сначала целятся, разом — не больше трёх
	raiders = _alive_bandits("raid")
	_ring(raiders, game.player.global_position)
	game.player.hp = game.player.max_hp   # на полном здоровье не лечится само — убыль только от попаданий
	var hp0: float = game.player.hp
	var hits0 := human_hits
	var t_start := Time.get_ticks_msec()
	var first_hit := -1.0
	var max_sh := 0
	for i in 60:
		await _wait(0.1)
		max_sh = maxi(max_sh, _shooting_at(game.player))
		# первое попадание именно мура (урон от заражённого рядом сюда не идёт)
		if first_hit < 0.0 and human_hits > hits0:
			first_hit = (Time.get_ticks_msec() - t_start) / 1000.0
	fails += _ok(game.player.hp < hp0 and human_hits > hits0, "муры стреляют по герою: здоровье %d → %d, попаданий %d" % [int(hp0), int(game.player.hp), human_hits - hits0])
	# прицел не меньше MUR_AIM[0] (1 с); замер — раз в 0,1 с, отсюда запас
	fails += _ok(first_hit >= BanditScript.MUR_AIM[0] - 0.15, "по герою — не сразу: первое попадание через %.1f с (прицел %.1f–%.1f с)" % [first_hit, BanditScript.MUR_AIM[0], BanditScript.MUR_AIM[1]])
	fails += _ok(max_sh >= 1 and max_sh <= BanditScript.MUR_SHOOTERS, "по одному человеку разом стреляют не больше %d: самое большее %d из %d" % [BanditScript.MUR_SHOOTERS, max_sh, raiders.size()])
	# мур убит: дроп и учёт
	raiders = _alive_bandits("raid")
	var c_before := int(m["count"])
	var size_before := int(raid["size"])
	var pk0: int = game.pickups.size()
	var victim = raiders[0]
	victim.damage(5000.0, game.player.global_position)
	await _wait(0.2)
	fails += _ok(not victim.alive and int(m["count"]) == c_before - 1 and int(raid["size"]) == size_before - 1 and game.pickups.size() > pk0 and not game.hostiles.has(victim), "мур убит: муров %d → %d, в отряде %d, на земле +%d" % [c_before, int(m["count"]), int(raid["size"]), game.pickups.size() - pk0])
	# группа выгребает тайник
	raiders = _alive_bandits("raid")
	var g0: Dictionary = raiders[0].group
	if g0["goal"].is_empty() or not g0["goal"].has("ci"):
		g0["skip"] = []
		_pick(g0)
	var looted := false
	var lspore := 0
	if g0["goal"].has("ci"):
		var ci := int(g0["goal"]["ci"])
		var box: Dictionary = game.level.containers[ci]
		box["items"] = [["spore", 5]]
		var gp := Vector3(float(g0["goal"]["x"]), 0, float(g0["goal"]["z"]))
		var pts := [gp]
		for b in raiders:
			pts.append(b.global_position)
		var away := _spot_away(pts, 24.0)
		if away != Vector3.INF:
			game.player.global_position = away
		var l0 := int(raid["loot"].get("spore", 0))
		for b in g0["members"]:
			if is_instance_valid(b) and b.alive:
				b.aggro = {}
				b.alarmed = false
				b.global_position = goal_for(b)
		await _wait(2.6)
		lspore = int(raid["loot"].get("spore", 0)) - l0
		looted = box["searched"] and lspore >= 5
	fails += _ok(looted, "муры выгребли тайник: в добыче отряда +%d споранов" % lspore)
	# время вышло — уходят через выход, добыча — в шкафы «Карьера»
	var stash0 := int(m["stash"].get("spore", 0)) + int(m["count"]) * MUR_PRICE
	raid["end"] = now() - 1.0
	await _wait(0.3)
	var exits_n := 0
	var groups_n := 0
	for g in squad.get("groups", []):
		var any_alive := false
		for b in g["members"]:
			if is_instance_valid(b) and b.alive:
				any_alive = true
		if any_alive:
			groups_n += 1
			if g["goal"].get("exit", false):
				exits_n += 1
	fails += _ok(not squad.is_empty() and groups_n > 0 and exits_n == groups_n, "время вышло: к выходу идут групп %d из %d" % [exits_n, groups_n])
	# герой — подальше от выходов и муров, чтобы его не видели у выхода
	var pts2 := []
	for e in game.level.exits:
		pts2.append(Vector3(float(e["spawn"][0]), 0, float(e["spawn"][1])))
	for b in _alive_bandits("raid"):
		pts2.append(b.global_position)
	var away2 := _spot_away(pts2, 24.0)
	if away2 != Vector3.INF:
		game.player.global_position = away2
	for b in _alive_bandits("raid"):
		b.aggro = {}
		b.alarmed = false
		b.target = null
		b.had_target = false
		b.global_position = goal_for(b)
	await _wait(1.0)
	var stash1 := int(m["stash"].get("spore", 0)) + int(m["count"]) * MUR_PRICE
	fails += _ok(_raid().is_empty() and squad.is_empty() and _alive_bandits("raid").is_empty() and stash1 >= stash0 + 5, "отряд ушёл из кластера, добыча в шкафах (спораны и наём: %d → %d), следующая вылазка через %s" % [stash0, stash1, approx(float(m["next_raid"]) - now())])
	# --- «Карьер»: часовые на постах, смена из казармы, тревога, склад ---
	m["count"] = MUR_LIMIT
	m["stash"]["spore"] = 64
	m["stash"]["zhivchik"] = 5
	game.enter("murs", null)
	await _wait(0.6)
	var posts: Array = game.level.meta.get("posts", [])
	var sentries := _alive_bandits("garrison")
	var expected := mini(MAX_POSTS, mini(MUR_LIMIT, posts.size()))
	var on_post := 0
	for b in sentries:
		if not b.post.is_empty() and Vector2(b.global_position.x - float(b.post["x"]), b.global_position.z - float(b.post["z"])).length() < 0.8:
			on_post += 1
	fails += _ok(sentries.size() == expected and on_post == expected and int(garrison.get("reserve", 0)) == MUR_LIMIT - expected, "«Карьер»: часовых %d (на постах %d из %d), в казарме %d" % [sentries.size(), on_post, posts.size(), int(garrison.get("reserve", 0))])
	var in_store := 0
	for s in store:
		for it in s["c"]["items"]:
			if it[0] == "spore":
				in_store += int(it[1])
	fails += _ok(store.size() > 0 and in_store == 64, "запасы муров по шкафам склада и будки главаря: шкафов %d, споранов %d" % [store.size(), in_store])
	# тревога: герой у часовых — ближние сразу, дальние позже; стреляют по очереди
	var best_spot := Vector3.INF
	var best_n := 0
	for b in sentries:
		for k in 8:
			var q: Vector3 = b.global_position + Vector3(cos(k * TAU / 8.0), 0, sin(k * TAU / 8.0)) * 5.0
			if game.level.blocked_at(q) or not game.level.exit_at(q).is_empty():
				continue
			var n := 0
			for o in sentries:
				if o.global_position.distance_to(q) < 7.0 and game.line_of_sight(o.global_position, q):
					n += 1
			if n > best_n:
				best_n = n
				best_spot = q
	if best_spot != Vector3.INF:
		game.player.global_position = best_spot
	game.player.hp = game.player.max_hp
	hp0 = game.player.hp
	hits0 = human_hits
	max_sh = 0
	var max_pending := 0.0
	var raised := 0
	for i in 60:
		await _wait(0.1)
		max_sh = maxi(max_sh, _shooting_at(game.player))
		raised = 0
		for b in _alive_bandits("garrison"):
			if b.alarmed:
				max_pending = maxf(max_pending, b.alarm_t)
			if b.alarmed or not b.aggro.is_empty() or (is_instance_valid(b.target) and b.target == game.player):
				raised += 1
	fails += _ok(game.player.hp < hp0 and human_hits > hits0 and max_sh >= 1 and max_sh <= BanditScript.MUR_SHOOTERS, "часовые стреляют по герою (видят %d): здоровье %d → %d, попаданий %d, разом стреляли самое большее %d" % [best_n, int(hp0), int(game.player.hp), human_hits - hits0, max_sh])
	fails += _ok(bool(garrison.get("alerted", false)) and raised >= 4 and max_pending > 0.5, "тревога расходится постепенно: поднято %d, дальним идти через %.1f с" % [raised, max_pending])
	# убили часового — из казармы выходит смена
	var reserve0 := int(garrison["reserve"])
	var n_alive := _alive_bandits("garrison").size()
	var dead_one = _alive_bandits("garrison")[0]
	dead_one.damage(5000.0, dead_one.global_position + Vector3(0, 0, 1))
	await _wait(0.5)
	var door: Vector3 = garrison["door"]
	var fresh := false
	for b in _alive_bandits("garrison"):
		if b.global_position.distance_to(door) < 6.0 and b.post.is_empty() or b.global_position.distance_to(door) < 1.5:
			fresh = true
	fails += _ok(int(garrison["reserve"]) == reserve0 - 1 and _alive_bandits("garrison").size() == n_alive and fresh, "убит часовой — из казармы вышла смена: в казарме %d → %d" % [reserve0, int(garrison["reserve"])])
	# вынесли из шкафа — у муров убыло
	var shelf: Dictionary = {}
	for s in store:
		if not s["items"].is_empty():
			shelf = s
			break
	if not shelf.is_empty():
		var kind: String = shelf["items"][0][0]
		var q0 := int(m["stash"].get(kind, 0))
		var took := int(shelf["items"][0][1])
		shelf["c"]["searched"] = true
		await _wait(0.2)
		fails += _ok(int(m["stash"].get(kind, 0)) == maxi(0, q0 - took), "вынесли из шкафа %s: %s ×%d — у муров %d → %d" % [shelf["c"]["name"], kind, took, q0, int(m["stash"].get(kind, 0))])
	else:
		fails += _ok(false, "в шкафах склада нет запасов")
	# --- информатор в «Полисе» ---
	game.enter("stab", null)
	await _wait(0.3)
	var info := {}
	for s in game.level.meta.get("stations", []):
		if s.get("id", "") == "info":
			info = s
	game.bag["spore"] = 25
	if not info.is_empty():
		game._station(info)
	fails += _ok(not info.is_empty() and game.hud.panel.visible and "Скажу за" in last_text, "информатор: окно открыто — %s" % last_text)
	_buy_intel()
	fails += _ok(int(game.bag["spore"]) == 15 and "мур" in last_text and "Карьер" in last_text, "информатор за 10 споранов: %s" % last_text)
	game.hud.hide_panel()
	m["next_raid"] = now() + randf_range(RAID_GAP[0], RAID_GAP[1])
	return fails
