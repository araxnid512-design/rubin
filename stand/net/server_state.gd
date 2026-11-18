class_name ULServerState
extends RefCounted
## Состояние кооператива на выделенном сервере — единственный источник правды. Клиенты только просят; всё,
## что касается предметов, валюты, покупок, миссий и смертей, решает и сохраняет сервер.
##
## Данные (одним файлом JSON, с тремя резервными копиями):
##   players  — pid → {name, token_hash, wallet {ресурс: n}, inv [предметы], char}
##   worlds   — wid → {code, owner, members [pid ≤ 2], base {installed {}, routes {маршрут: "bought"},
##              boxes {ящик: [[предмет, n], …]}, storage {level 0–6, safes {safe_k: [30 ячеек]}}}, mission (mid или "")}
##   missions — mid → {world, route, members [pid], dead [pid], left [pid], open, ends (unix), key_owner, chest_used,
##              loot {ключ находки: [ячейки]} — что лежит в тайниках, телах и на земле этой миссии}
##   ops      — номера уже выполненных операций (op_id): повтор той же просьбы не выполняется дважды
##
## Все операции возвращают {"ok": bool, "err": "...", …}. Ошибки — короткими словами (для проверки), текст для
## игрока — на клиенте.

const MAX_MEMBERS := 2
const BOX_CELLS := 24
const STACK := 999
const STORAGE_MAX := 6
const SAFE_CELLS := 30

var data := {"players": {}, "worlds": {}, "missions": {}, "ops": {}, "seq": 0}
var path := ""
var test_grant := -1               ## для проверок: столько споранов у нового игрока (−1 — как в настройках)


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
		data.players[pid] = {"name": name.substr(0, 16), "token_hash": _hash(token), "wallet": start_wallet(), "inv": [], "char": "hero"}
	save()
	return {"ok": true, "player": public_player(pid), "worlds": worlds_of(pid)}


## Стартовые ресурсы нового игрока — один раз, при первом входе (data/base_shop.json → coop.start_wallet;
## по умолчанию 50 споранов). Повторный вход ничего не добавляет: кошелёк хранится на сервере.
func start_wallet() -> Dictionary:
	if test_grant >= 0:
		return {"spore": test_grant}
	var out := {"spore": 50}
	var path := "res://data/base_shop.json"
	if FileAccess.file_exists(path):
		var d = JSON.parse_string(FileAccess.get_file_as_string(path))
		if d is Dictionary and d.get("coop") is Dictionary and d.coop.get("start_wallet") is Dictionary:
			out = {}
			for k in d.coop.start_wallet:
				out[String(k)] = int(d.coop.start_wallet[k])
	return out


func public_player(pid: String) -> Dictionary:
	var p: Dictionary = data.players[pid]
	return {"pid": pid, "name": p.name, "wallet": p.wallet, "inv": p.inv, "char": p.get("char", "hero")}


func set_char(pid: String, ch: String) -> Dictionary:
	if not data.players.has(pid) or not ULHeroes.LIST.has(ch):
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
		"base": {"installed": {}, "routes": {}, "boxes": {"base_box": []}, "storage": {"level": 0, "safes": {}}}}
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


# ---------------- хранилище базы: общие сейфы ----------------
## Сейфы мира общие для обоих участников. Каждое действие — одной операцией на сервере (он обрабатывает просьбы по
## очереди), поэтому «взяли разом одно и то же» достаётся одному, второму — отказ «gone» и свежее содержимое.
## Предметы приходят из личного инвентаря игрока на сервере (players.inv), ресурсы (спораны, горох, жемчуг) — из
## кошелька. Ответ хранится по op_id без содержимого сейфа (повтор просьбы — тот же итог, без повторного действия).

func _storage(wid: String) -> Dictionary:
	var b: Dictionary = data.worlds[wid].base
	if not (b.get("storage") is Dictionary):
		b["storage"] = {"level": 0, "safes": {}}
	return b.storage


func _safe(wid: String, k: int) -> Variant:
	var st := _storage(wid)
	if k < 1 or k > int(st.level):
		return null
	return st.safes.get("safe_%d" % k)


static func _norm(it) -> Dictionary:
	if it is String:
		return {"id": it, "n": 1}
	var d: Dictionary = (it as Dictionary).duplicate(true)
	d["n"] = int(d.get("n", 1))
	return d


static func _wallet_item(id: String) -> bool:
	return ULItems.kind({"id": id}) == "loot"


## сколько штук предмета поместится в ячейки (свободные + досыпать в неполные стопки)
static func _room(cells: Array, it: Dictionary) -> int:
	var mx := ULItems.stack(String(it.id))
	var room := 0
	for c in cells:
		if c == null:
			room += mx
		elif mx > 1 and String(c.id) == String(it.id) and not c.has("mag") and not c.has("dur") and not it.has("mag") and not it.has("dur"):
			room += maxi(mx - int(c.n), 0)
	return room


func _fin(op_id: String, res: Dictionary, extra := {}) -> Dictionary:
	_done(op_id, res.duplicate())
	var out := res.duplicate()
	out.merge(extra)
	return out


## купить хранилище (уровень 0 → 1) или улучшить (+1 сейф): платит тот, кто нажал; уровень общий для мира
func storage_upgrade(wid: String, pid: String, price: Dictionary, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var st := _storage(wid)
	if int(st.level) >= STORAGE_MAX:
		return _fin(op_id, {"ok": false, "err": "max", "level": int(st.level)})
	var wl := _wallet(pid)
	for r in price:
		if int(wl.get(r, 0)) < int(price[r]):
			return _fin(op_id, {"ok": false, "err": "money", "level": int(st.level)})
	for r in price:
		wl[r] = int(wl.get(r, 0)) - int(price[r])
	st.level = int(st.level) + 1
	var key := "safe_%d" % int(st.level)
	if not st.safes.has(key):
		var arr := []
		arr.resize(SAFE_CELLS)
		st.safes[key] = arr
	return _fin(op_id, {"ok": true, "level": int(st.level)}, {"wallet": wl})


func safe_view(wid: String, pid: String, k: int) -> Dictionary:
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var cells = _safe(wid, k)
	if cells == null:
		return {"ok": false, "err": "no_safe"}
	return {"ok": true, "cells": cells, "level": int(_storage(wid).level)}


## положить в сейф k предмет из своего инвентаря (или ресурс из кошелька); не помещается целиком — отказ «full»
func safe_put(wid: String, pid: String, k: int, item: Dictionary, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid) or not item.has("id"):
		return {"ok": false, "err": "bad"}
	var cells = _safe(wid, k)
	if cells == null:
		return _fin(op_id, {"ok": false, "err": "no_safe"})
	var it := _norm(item)
	var id := String(it.id)
	var n := int(it.n)
	if n <= 0:
		return {"ok": false, "err": "bad"}
	var pl: Dictionary = data.players[pid]
	var src := -1
	if _wallet_item(id):
		if int(pl.wallet.get(id, 0)) < n:
			return _fin(op_id, {"ok": false, "err": "not_enough"}, {"cells": cells})
	else:
		var inv: Array = pl.inv
		for i in inv.size():
			var c := _norm(inv[i])
			if String(c.id) == id and int(c.n) >= n:
				src = i
				it = c
				it.n = n
				break
		if src < 0:
			return _fin(op_id, {"ok": false, "err": "not_enough"}, {"cells": cells})
	if _room(cells, it) < n:
		return _fin(op_id, {"ok": false, "err": "full"}, {"cells": cells})
	ULInventory.put(cells, it)
	if src < 0:
		pl.wallet[id] = int(pl.wallet.get(id, 0)) - n
	else:
		var c := _norm(pl.inv[src])
		if int(c.n) == n:
			(pl.inv as Array).remove_at(src)
		else:
			c.n = int(c.n) - n
			pl.inv[src] = c
	return _fin(op_id, {"ok": true}, {"cells": cells, "wallet": pl.wallet, "inv": pl.inv})


## забрать из сейфа k ячейку i (expect — что там ждёт игрок, n — сколько); уже забрал другой — «gone»
func safe_take(wid: String, pid: String, k: int, i: int, expect: String, n: int, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid) or n <= 0:
		return {"ok": false, "err": "bad"}
	var cells = _safe(wid, k)
	if cells == null:
		return _fin(op_id, {"ok": false, "err": "no_safe"})
	if i < 0 or i >= (cells as Array).size() or cells[i] == null or String(cells[i].id) != expect or int(cells[i].n) < n:
		return _fin(op_id, {"ok": false, "err": "gone"}, {"cells": cells})
	var c: Dictionary = cells[i]
	var got: Dictionary = c.duplicate(true)
	got.n = n
	if int(c.n) == n:
		cells[i] = null
	else:
		c.n = int(c.n) - n
	var pl: Dictionary = data.players[pid]
	if _wallet_item(expect):
		pl.wallet[expect] = int(pl.wallet.get(expect, 0)) + n
	else:
		(pl.inv as Array).append(got)
	return _fin(op_id, {"ok": true, "item": got}, {"cells": cells, "wallet": pl.wallet, "inv": pl.inv})


## переложить внутри сейфа или между сейфами: в пустую — перенести, к тому же — дополнить стопку, к другому — поменять
func safe_move(wid: String, pid: String, k1: int, i1: int, k2: int, i2: int, expect: String, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var a = _safe(wid, k1)
	var b = _safe(wid, k2)
	if a == null or b == null or i1 < 0 or i1 >= (a as Array).size() or i2 < 0 or i2 >= (b as Array).size():
		return _fin(op_id, {"ok": false, "err": "no_safe"})
	if a[i1] == null or String(a[i1].id) != expect:
		return _fin(op_id, {"ok": false, "err": "gone"}, {"cells": a})
	if k1 == k2 and i1 == i2:
		return _fin(op_id, {"ok": true}, {"cells": a})
	var x: Dictionary = a[i1]
	var y = b[i2]
	var mx := ULItems.stack(String(x.id))
	if y == null:
		b[i2] = x
		a[i1] = null
	elif String(y.id) == String(x.id) and mx > 1 and not x.has("mag") and not x.has("dur"):
		var mv := mini(mx - int(y.n), int(x.n))
		y.n = int(y.n) + mv
		x.n = int(x.n) - mv
		if int(x.n) <= 0:
			a[i1] = null
	else:
		b[i2] = x
		a[i1] = y
	return _fin(op_id, {"ok": true}, {"cells": a, "cells2": b})


## сортировка сейфа: одинаковые стопки сливаются, затем по виду и названию (как в окне сейфа на телефоне)
func safe_sort(wid: String, pid: String, k: int, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	if not is_member(wid, pid):
		return {"ok": false, "err": "bad"}
	var cells = _safe(wid, k)
	if cells == null:
		return _fin(op_id, {"ok": false, "err": "no_safe"})
	ULInventory.sort_cells(cells)
	return _fin(op_id, {"ok": true}, {"cells": cells})


# ---------------- добыча в совместной миссии ----------------
## Что лежит в тайнике, в теле или на земле, решает сервер — один раз на миссию для каждой находки (ключ: «c:12» —
## тайник, «e:3» — тело, «g:7» — на земле). Оба игрока открывают одно и то же; взять ячейку успевает первый,
## второму — «gone» и свежее содержимое. Погибший и вышедший брать не могут. Розыгрыш — по таблицам добычи локации
## (data/<маршрут>.json → loot, container_cells, empty_chance), по видам врагов (data/enemies.json) или предмет на
## земле (только хлам, минералы, запчасти, еда, лекарства, патроны — оружие так не выдаётся).
const LOOT_KEYS_MAX := 3000
const GROUND_KINDS := ["junk", "mineral", "tech", "parts", "tool", "food", "med", "ammo"]
static var _zone_cache := {}


static func _zone(route: String) -> Dictionary:
	if not _zone_cache.has(route):
		var path := "res://data/%s.json" % route
		var d = JSON.parse_string(FileAccess.get_file_as_string(path)) if FileAccess.file_exists(path) else null
		_zone_cache[route] = d if d is Dictionary else {}
	return _zone_cache[route]


func _roll_loot(m: Dictionary, mid: String, key: String, table: String) -> Variant:
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(mid + "|" + key)
	if table.begins_with("enemy:"):
		var kind := table.substr(6)
		if not ULEnemy.KINDS.has(kind):
			return null
		return ULEnemy.roll_loot(kind, rng.randi())
	if table.begins_with("item:"):
		var parts := table.split(":")
		if parts.size() != 3:
			return null
		var id := String(parts[1])
		if ULItems.get_def(id).is_empty() or not GROUND_KINDS.has(ULItems.kind({"id": id})):
			return null
		var cells := []
		cells.resize(1)
		cells[0] = ULItems.make(id, clampi(int(parts[2]), 1, ULItems.stack(id)))
		return cells
	var zc := _zone(String(m.route))
	var tables: Dictionary = zc.get("loot", {})
	if not tables.has(table):
		return null
	var cells := []
	cells.resize(int(zc.get("container_cells", 6)))
	if rng.randf() > float(zc.get("empty_chance", 0.3)):
		for l in tables[table]:
			var ch := float(l[3]) if l.size() > 3 else 1.0
			if rng.randf() <= ch:
				var n := rng.randi_range(int(l[1]), int(l[2]))
				if n > 0:
					ULInventory.put(cells, ULItems.make(String(l[0]), n))
	return cells


## открыть находку: первый открывший — сервер разыгрывает содержимое; дальше оба видят его как есть
func loot_open(mid: String, pid: String, key: String, table: String) -> Dictionary:
	var ce := can_enter(mid, pid)
	if not ce.ok:
		return ce
	var m: Dictionary = data.missions[mid]
	if not (m.get("loot") is Dictionary):
		m["loot"] = {}
	if not m.loot.has(key):
		if key.length() > 32 or (m.loot as Dictionary).size() >= LOOT_KEYS_MAX:
			return {"ok": false, "err": "limit"}
		var cells = _roll_loot(m, mid, key, table)
		if cells == null:
			return {"ok": false, "err": "bad_table"}
		m.loot[key] = cells
		save()
	return {"ok": true, "key": key, "cells": m.loot[key]}


## взять из находки ячейку i (expect — что там видит игрок, n — сколько): кто первый — тому; уже забрали — «gone»
func loot_take(mid: String, pid: String, key: String, i: int, expect: String, n: int, op_id := "") -> Dictionary:
	var seen = _seen(op_id)
	if seen != null:
		return seen
	var ce := can_enter(mid, pid)
	if not ce.ok:
		return ce
	var m: Dictionary = data.missions[mid]
	var cells = (m.get("loot", {}) as Dictionary).get(key)
	if cells == null or n <= 0:
		return _fin(op_id, {"ok": false, "err": "no_loot"})
	if i < 0 or i >= (cells as Array).size() or cells[i] == null or String(cells[i].id) != expect or int(cells[i].n) < n:
		return _fin(op_id, {"ok": false, "err": "gone"}, {"key": key, "cells": cells})
	var c: Dictionary = cells[i]
	var got: Dictionary = c.duplicate(true)
	got.n = n
	if int(c.n) == n:
		cells[i] = null
	else:
		c.n = int(c.n) - n
	var pl: Dictionary = data.players[pid]
	if _wallet_item(expect):
		pl.wallet[expect] = int(pl.wallet.get(expect, 0)) + n
	else:
		(pl.inv as Array).append(got)
	return _fin(op_id, {"ok": true, "item": got}, {"key": key, "cells": cells, "wallet": pl.wallet, "inv": pl.inv})
