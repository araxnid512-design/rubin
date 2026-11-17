class_name ULServerState
extends RefCounted
## Состояние кооператива на выделенном сервере — единственный источник правды. Клиенты только просят; всё,
## что касается предметов, валюты, покупок, миссий и смертей, решает и сохраняет сервер.
##
## Данные (одним файлом JSON, с тремя резервными копиями):
##   players  — pid → {name, token_hash, wallet {ресурс: n}, inv [предметы], char}
##   worlds   — wid → {code, owner, members [pid ≤ 2], base {installed {}, routes {маршрут: "bought"},
##              boxes {ящик: [[предмет, n], …]}}, mission (mid или "")}
##   missions — mid → {world, route, members [pid], dead [pid], left [pid], open, ends (unix), key_owner, chest_used}
##   ops      — номера уже выполненных операций (op_id): повтор той же просьбы не выполняется дважды
##
## Все операции возвращают {"ok": bool, "err": "...", …}. Ошибки — короткими словами (для проверки), текст для
## игрока — на клиенте.

const MAX_MEMBERS := 2
const BOX_CELLS := 24
const STACK := 999

var data := {"players": {}, "worlds": {}, "missions": {}, "ops": {}, "seq": 0}
var path := ""
var test_grant := 0                ## для проверок: столько споранов у нового игрока


func _init(save_path := "") -> void:
	path = save_path
	if path != "" and FileAccess.file_exists(path):
		var d = JSON.parse_string(FileAccess.get_file_as_string(path))
		if d is Dictionary:
			data = d
			for k in ["players", "worlds", "missions", "ops"]:
				if not data.has(k):
					data[k] = {}


func save() -> void:
	if path == "":
		return
	# резервные копии: .1 ← прежний, .2 ← .1, .3 ← .2
	for i in [2, 1]:
		if FileAccess.file_exists("%s.%d" % [path, i]):
			DirAccess.copy_absolute(ProjectSettings.globalize_path("%s.%d" % [path, i]), ProjectSettings.globalize_path("%s.%d" % [path, i + 1]))
	if FileAccess.file_exists(path):
		DirAccess.copy_absolute(ProjectSettings.globalize_path(path), ProjectSettings.globalize_path(path + ".1"))
	var tmp := path + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return
	f.store_string(JSON.stringify(data))
	f.close()
	DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(path))


func _id(prefix: String) -> String:
	data.seq = int(data.seq) + 1
	return "%s%d_%d" % [prefix, int(data.seq), randi() % 100000]


static func _hash(s: String) -> String:
	return s.sha256_text()


## повтор операции с тем же номером (сеть переспросила) — вернуть прежний ответ, ничего не делая
func _seen(op_id: String) -> Variant:
	if op_id != "" and data.ops.has(op_id):
		return data.ops[op_id]
	return null


func _done(op_id: String, res: Dictionary) -> Dictionary:
	if op_id != "":
		data.ops[op_id] = res
		if data.ops.size() > 4000:
			var keys: Array = data.ops.keys()
			for i in 1000:
				data.ops.erase(keys[i])
	save()
	return res


# ---------------- игроки ----------------

## вход: новый игрок регистрируется (его токен запоминается хэшем), прежний — только со своим токеном
func hello(pid: String, token: String, name: String) -> Dictionary:
	if pid.length() < 8 or token.length() < 16:
		return {"ok": false, "err": "bad_id"}
	if data.players.has(pid):
		if String(data.players[pid].token_hash) != _hash(token):
			return {"ok": false, "err": "bad_token"}
		data.players[pid].name = name.substr(0, 16)
	else:
		data.players[pid] = {"name": name.substr(0, 16), "token_hash": _hash(token), "wallet": {"spore": test_grant}, "inv": [], "char": "hero"}
	save()
	return {"ok": true, "player": public_player(pid), "worlds": worlds_of(pid)}


func public_player(pid: String) -> Dictionary:
	var p: Dictionary = data.players[pid]
	return {"pid": pid, "name": p.name, "wallet": p.wallet, "inv": p.inv, "char": p.get("char", "hero")}


func set_char(pid: String, ch: String) -> Dictionary:
	if not data.players.has(pid) or not ch in ["hero", "hero2"]:
		return {"ok": false, "err": "bad"}
	data.players[pid].char = ch
	save()
	return {"ok": true}


func worlds_of(pid: String) -> Array:
	var out: Array = []
	for wid in data.worlds:
		if (data.worlds[wid].members as Array).has(pid):
			out.append(public_world(wid))
	return out


func public_world(wid: String) -> Dictionary:
	var w: Dictionary = data.worlds[wid]
	var names: Array = []
	for m in w.members:
		names.append(String(data.players[m].name) if data.players.has(m) else "?")
	return {"wid": wid, "code": w.code, "owner": w.owner, "members": w.members, "names": names, "base": w.base, "mission": w.get("mission", "")}


# ---------------- совместный мир ----------------

## создать мир: код приглашения — 6 знаков без похожих букв; владелец сразу участник
func create_world(pid: String) -> Dictionary:
	if not data.players.has(pid):
		return {"ok": false, "err": "no_player"}
	var alphabet := "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	var code := ""
	while code == "" or _world_by_code(code) != "":
		code = ""
		for i in 6:
			code += alphabet[randi() % alphabet.length()]
	var wid := _id("w")
	data.worlds[wid] = {"code": code, "owner": pid, "members": [pid], "mission": "",
		"base": {"installed": {}, "routes": {}, "boxes": {"base_box": []}}}
	save()
	return {"ok": true, "world": public_world(wid)}


func _world_by_code(code: String) -> String:
	for wid in data.worlds:
		if String(data.worlds[wid].code) == code.to_upper():
			return wid
	return ""


## войти в мир по коду: участник — всегда; новый — пока есть место (два игрока); посторонний к полному миру — нет
func join_world(pid: String, code: String) -> Dictionary:
	if not data.players.has(pid):
		return {"ok": false, "err": "no_player"}
	var wid := _world_by_code(code)
	if wid == "":
		return {"ok": false, "err": "no_world"}
	var w: Dictionary = data.worlds[wid]
	if not (w.members as Array).has(pid):
		if (w.members as Array).size() >= MAX_MEMBERS:
			return {"ok": false, "err": "full"}
		(w.members as Array).append(pid)
	save()
	return {"ok": true, "world": public_world(wid)}


func is_member(wid: String, pid: String) -> bool:
	return data.worlds.has(wid) and (data.worlds[wid].members as Array).has(pid)


# ---------------- кошелёк и общие ящики ----------------

func _wallet(pid: String) -> Dictionary:
	return data.players[pid].wallet


## положить из своего кошелька в общий ящик базы
func box_put(wid: String, pid: String, box: String, item: String, n: int, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid) or n <= 0:
		return {"ok": false, "err": "bad"}
	var boxes: Dictionary = data.worlds[wid].base.boxes
	if not boxes.has(box):
		return {"ok": false, "err": "no_box"}
	var wl := _wallet(pid)
	if int(wl.get(item, 0)) < n:
		return _done(op_id, {"ok": false, "err": "not_enough"})
	var cells: Array = boxes[box]
	var placed := false
	for c in cells:
		if String(c[0]) == item and int(c[1]) + n <= STACK:
			c[1] = int(c[1]) + n
			placed = true
			break
	if not placed:
		if cells.size() >= BOX_CELLS:
			return _done(op_id, {"ok": false, "err": "box_full"})
		cells.append([item, n])
	wl[item] = int(wl.get(item, 0)) - n
	return _done(op_id, {"ok": true, "box": cells, "wallet": wl})


## забрать из общего ящика в свой кошелёк; если столько уже нет (забрал напарник) — отказ, ничего не меняется
func box_take(wid: String, pid: String, box: String, item: String, n: int, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid) or n <= 0:
		return {"ok": false, "err": "bad"}
	var boxes: Dictionary = data.worlds[wid].base.boxes
	if not boxes.has(box):
		return {"ok": false, "err": "no_box"}
	var cells: Array = boxes[box]
	for i in cells.size():
		var c: Array = cells[i]
		if String(c[0]) == item and int(c[1]) >= n:
			c[1] = int(c[1]) - n
			if int(c[1]) <= 0:
				cells.remove_at(i)
			var wl := _wallet(pid)
			wl[item] = int(wl.get(item, 0)) + n
			return _done(op_id, {"ok": true, "box": cells, "wallet": wl})
	return _done(op_id, {"ok": false, "err": "gone", "box": cells})


func box_view(wid: String, pid: String, box: String) -> Dictionary:
	if not is_member(wid, pid) or not data.worlds[wid].base.boxes.has(box):
		return {"ok": false, "err": "bad"}
	return {"ok": true, "box": data.worlds[wid].base.boxes[box]}


# ---------------- маршруты и улучшения базы ----------------

## купить маршрут: платит только покупатель; маршрут становится общим; повторно не списывается
func buy_route(wid: String, pid: String, route: String, price: Dictionary, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var routes: Dictionary = data.worlds[wid].base.routes
	if routes.get(route, "") == "bought":
		return _done(op_id, {"ok": false, "err": "have", "routes": routes})
	var wl := _wallet(pid)
	for r in price:
		if int(wl.get(r, 0)) < int(price[r]):
			return _done(op_id, {"ok": false, "err": "money"})
	for r in price:
		wl[r] = int(wl.get(r, 0)) - int(price[r])
	routes[route] = "bought"
	return _done(op_id, {"ok": true, "routes": routes, "wallet": wl})


## установить улучшение базы (оружейник и т. п.): общее для мира, платит покупатель, второй раз не покупается
func install(wid: String, pid: String, what: String, price: Dictionary, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var inst: Dictionary = data.worlds[wid].base.installed
	if inst.get(what, false):
		return _done(op_id, {"ok": false, "err": "have"})
	var wl := _wallet(pid)
	for r in price:
		if int(wl.get(r, 0)) < int(price[r]):
			return _done(op_id, {"ok": false, "err": "money"})
	for r in price:
		wl[r] = int(wl.get(r, 0)) - int(price[r])
	inst[what] = true
	return _done(op_id, {"ok": true, "installed": inst, "wallet": wl})


# ---------------- совместные миссии ----------------

## начать миссию по купленному маршруту: один экземпляр на мир; маршрут после старта расходуется
func start_mission(wid: String, pid: String, route: String, ready: Array, minutes: float, now: float) -> Dictionary:
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var w: Dictionary = data.worlds[wid]
	if String(w.get("mission", "")) != "" and bool(data.missions[w.mission].open):
		return {"ok": false, "err": "busy", "mission": w.mission}
	if w.base.routes.get(route, "") != "bought":
		return {"ok": false, "err": "no_route"}
	var members: Array = []
	for m in ready:
		if is_member(wid, String(m)) and not members.has(m):
			members.append(m)
	if not members.has(pid):
		members.append(pid)
	var mid := _id("m")
	data.missions[mid] = {"world": wid, "route": route, "members": members, "dead": [], "left": [], "open": true,
		"ends": now + minutes * 60.0, "key_owner": "", "chest_used": false}
	w.mission = mid
	w.base.routes.erase(route)                    # маршрут израсходован; следующий раз — новая покупка
	save()
	return {"ok": true, "mission": mid, "members": members}


## можно ли войти (или вернуться после обрыва связи) в миссию: живой участник открытой миссии — да; погибший — нет
func can_enter(mid: String, pid: String) -> Dictionary:
	if not data.missions.has(mid):
		return {"ok": false, "err": "no_mission"}
	var m: Dictionary = data.missions[mid]
	if not bool(m.open):
		return {"ok": false, "err": "closed"}
	if (m.dead as Array).has(pid):
		return {"ok": false, "err": "dead"}
	if (m.left as Array).has(pid):
		return {"ok": false, "err": "left"}
	if not (m.members as Array).has(pid):
		return {"ok": false, "err": "not_member"}
	return {"ok": true}


## гибель в миссии: запоминается навсегда для этой миссии (перезапуск приложения не помогает)
func died(mid: String, pid: String) -> Dictionary:
	if not data.missions.has(mid) or not (data.missions[mid].members as Array).has(pid):
		return {"ok": false, "err": "bad"}
	var m: Dictionary = data.missions[mid]
	if not (m.dead as Array).has(pid):
		(m.dead as Array).append(pid)
	_maybe_close(mid)
	save()
	return {"ok": true, "open": m.open}


## вышел из кластера (жив)
func left(mid: String, pid: String) -> Dictionary:
	if not data.missions.has(mid) or not (data.missions[mid].members as Array).has(pid):
		return {"ok": false, "err": "bad"}
	var m: Dictionary = data.missions[mid]
	if not (m.left as Array).has(pid) and not (m.dead as Array).has(pid):
		(m.left as Array).append(pid)
	_maybe_close(mid)
	save()
	return {"ok": true, "open": m.open}


## миссия закрывается, когда в ней не осталось живых (все погибли или вышли) или вышло время
func _maybe_close(mid: String) -> void:
	var m: Dictionary = data.missions[mid]
	var inside := 0
	for p in m.members:
		if not (m.dead as Array).has(p) and not (m.left as Array).has(p):
			inside += 1
	if inside == 0:
		_close(mid)


func _close(mid: String) -> void:
	var m: Dictionary = data.missions[mid]
	m.open = false
	var w: Dictionary = data.worlds.get(String(m.world), {})
	if not w.is_empty() and String(w.get("mission", "")) == mid:
		w.mission = ""


## таймер: истекшие миссии закрываются
func tick(now: float) -> Array:
	var closed: Array = []
	for mid in data.missions:
		var m: Dictionary = data.missions[mid]
		if bool(m.open) and now >= float(m.ends):
			_close(mid)
			closed.append(mid)
	if not closed.is_empty():
		save()
	return closed


## ключ главаря: достаётся тому, кто первым забрал его с тела; второй раз — никому
func take_key(mid: String, pid: String, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	var ce := can_enter(mid, pid)
	if not ce.ok:
		return ce
	var m: Dictionary = data.missions[mid]
	if String(m.key_owner) != "":
		return _done(op_id, {"ok": false, "err": "taken", "owner": m.key_owner})
	m.key_owner = pid
	return _done(op_id, {"ok": true})


## оружейный сундук: открывает владелец ключа, один раз; награда — ему
func open_chest(mid: String, pid: String, reward: String, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	var ce := can_enter(mid, pid)
	if not ce.ok:
		return ce
	var m: Dictionary = data.missions[mid]
	if String(m.key_owner) != pid:
		return _done(op_id, {"ok": false, "err": "no_key"})
	if bool(m.chest_used):
		return _done(op_id, {"ok": false, "err": "used"})
	m.chest_used = true
	(data.players[pid].inv as Array).append(reward)
	return _done(op_id, {"ok": true, "reward": reward})
