extends Node
## Проверка кооператива с настоящим выделенным сервером (отдельный процесс): здесь — три клиента (A, B, C) со своими
## подключениями ENet, каждый в своей ветке сцены со своим SceneMultiplayer (как три телефона).
##   godot --headless --path . res://net/server.tscn -- --port=7790 --data=<файл> --grant=100   (сервер)
##   godot --headless --path . res://net/net_test.tscn -- --port=7790 --phase=1 --dir=<папка>   (клиенты)
## phase=2 — после перезапуска сервера: всё ли сохранилось.

var port := 7790
var phase := 1
var dir := "user://net_test"
var bad := 0


func _ok(what: String, cond: bool, extra := "") -> void:
	print("[net] %s — %s%s" % [what, "верно" if cond else "НЕВЕРНО", (" (%s)" % extra) if extra != "" else ""])
	if not cond:
		bad += 1


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--port="):
			port = int(a.substr(7))
		elif a.begins_with("--phase="):
			phase = int(a.substr(8))
		elif a.begins_with("--dir="):
			dir = a.substr(6)
	DirAccess.make_dir_recursive_absolute(dir)
	_run.call_deferred()


## клиент — ветка /root/<имя> со своим SceneMultiplayer; узел сети внутри называется Net (как /root/Net у сервера)
func _client(nm: String) -> ULNet:
	var branch := Node.new()
	branch.name = nm
	get_tree().root.add_child(branch)
	var api := SceneMultiplayer.new()
	get_tree().set_multiplayer(api, branch.get_path())
	var n := ULNet.new()
	n.name = "Net"
	branch.add_child(n)
	n.load_profile("%s/profile_%s.json" % [dir, nm])
	return n


func _connect(n: ULNet, nm: String) -> bool:
	n.connect_to("127.0.0.1", port)
	var t0 := Time.get_ticks_msec()
	while not n.online() and Time.get_ticks_msec() - t0 < 8000:
		await get_tree().process_frame
	if not n.online():
		return false
	var r: Dictionary = await n.ask("hello", {"name": nm})
	return bool(r.get("ok", false))


func _run() -> void:
	if phase == 2:
		await _phase2()
	else:
		await _phase1()
	print("[net] итог: ошибок %d" % bad)
	get_tree().quit()


func _phase1() -> void:
	var A := _client("A")
	var B := _client("B")
	var C := _client("C")
	_ok("три клиента подключились к выделенному серверу и вошли (идентификатор + секрет)", await _connect(A, "Первый") and await _connect(B, "Второй") and await _connect(C, "Чужой"))
	# совместный мир: код приглашения, двое, третий — нет
	var cw: Dictionary = await A.ask("create_world")
	var code := String(cw.get("world", {}).get("code", ""))
	var wid := String(cw.get("world", {}).get("wid", ""))
	_ok("первый создал совместный мир, код приглашения %s" % code, cw.get("ok", false) and code.length() == 6)
	var jb: Dictionary = await B.ask("join", {"code": code})
	_ok("второй вошёл по коду: участников 2", jb.get("ok", false) and (jb.world.members as Array).size() == 2)
	var jc: Dictionary = await C.ask("join", {"code": code})
	_ok("третьего в полный мир не пускает (максимум два игрока)", not jc.get("ok", true) and String(jc.err) == "full", String(jc.get("err", "")))
	var jbad: Dictionary = await C.ask("join", {"code": "ZZZZZZ"})
	_ok("неверный код — мира нет", not jbad.get("ok", true) and String(jbad.err) == "no_world")
	# общий ящик: положил один — видит и забирает другой
	var p1: Dictionary = await A.ask("box_put", {"wid": wid, "box": "base_box", "item": "spore", "n": 30, "op": A.op_id()})
	_ok("первый положил 30 споранов в общий ящик: у него 100 → 70", p1.get("ok", false) and int(p1.wallet.spore) == 70)
	await get_tree().create_timer(0.3).timeout
	var bw: Dictionary = B.world.get("base", {})
	_ok("второму пришло новое состояние базы: в ящике 30 споранов", (bw.get("boxes", {}).get("base_box", []) as Array).size() == 1 and int(bw.boxes.base_box[0][1]) == 30)
	var t1: Dictionary = await B.ask("box_take", {"wid": wid, "box": "base_box", "item": "spore", "n": 30, "op": B.op_id()})
	_ok("второй забрал 30: у него 100 → 130", t1.get("ok", false) and int(t1.wallet.spore) == 130)
	var v1: Dictionary = await A.ask("box_view", {"wid": wid, "box": "base_box"})
	_ok("первый видит пустой ящик", v1.get("ok", false) and (v1.box as Array).is_empty())
	var cv: Dictionary = await C.ask("box_view", {"wid": wid, "box": "base_box"})
	_ok("посторонний в чужой ящик не заглянет", not cv.get("ok", true))
	# одновременно забрать один и тот же предмет: получает только один
	await A.ask("box_put", {"wid": wid, "box": "base_box", "item": "spore", "n": 10, "op": A.op_id()})
	var res := [{}, {}]
	var ga := func() -> void: res[0] = await A.ask("box_take", {"wid": wid, "box": "base_box", "item": "spore", "n": 10, "op": A.op_id()})
	var gb := func() -> void: res[1] = await B.ask("box_take", {"wid": wid, "box": "base_box", "item": "spore", "n": 10, "op": B.op_id()})
	ga.call()
	gb.call()
	var tw := Time.get_ticks_msec()
	while (res[0] as Dictionary).is_empty() or (res[1] as Dictionary).is_empty():
		await get_tree().process_frame
		if Time.get_ticks_msec() - tw > 8000:
			break
	var oks := int(res[0].get("ok", false)) + int(res[1].get("ok", false))
	_ok("двое разом берут одни и те же 10 споранов — достаются одному", oks == 1, "%s / %s" % [str(res[0].get("err", "ok")), str(res[1].get("err", "ok"))])
	# повтор той же операции (сеть переспросила) — не дублирует
	var op := A.op_id()
	var r1: Dictionary = await A.ask("box_put", {"wid": wid, "box": "base_box", "item": "spore", "n": 5, "op": op})
	var r2: Dictionary = await A.ask("box_put", {"wid": wid, "box": "base_box", "item": "spore", "n": 5, "op": op})
	var me: Dictionary = await A.ask("me")
	_ok("повтор той же просьбы «положить 5» выполнен один раз", r1.get("ok", false) and r2.get("ok", false) and int(me.player.wallet.spore) == int(r1.wallet.spore))
	# маршрут: платит купивший, второму бесплатно, повторно не списывается
	var a_before := int(me.player.wallet.spore)
	var br: Dictionary = await A.ask("buy_route", {"wid": wid, "route": "sanatorium", "op": A.op_id()})
	_ok("первый купил «Санаторий Луч» за 25 споранов: %d → %d" % [a_before, int(br.get("wallet", {}).get("spore", -1))], br.get("ok", false) and int(br.wallet.spore) == a_before - 25)
	var mb: Dictionary = await B.ask("me")
	var br2: Dictionary = await B.ask("buy_route", {"wid": wid, "route": "sanatorium", "op": B.op_id()})
	var mb2: Dictionary = await B.ask("me")
	_ok("второму маршрут уже открыт: повторно не продаётся, споранов не списано", not br2.get("ok", true) and String(br2.err) == "have" and int(mb2.player.wallet.spore) == int(mb.player.wallet.spore))
	# совместная миссия, ключ и сундук, смерть
	var sm: Dictionary = await A.ask("start_mission", {"wid": wid, "route": "sanatorium", "ready": [A.pid, B.pid]})
	var mid := String(sm.get("mission", ""))
	_ok("совместная миссия начата: участники оба, один экземпляр", sm.get("ok", false) and (sm.members as Array).size() == 2)
	var sm2: Dictionary = await B.ask("start_mission", {"wid": wid, "route": "sanatorium", "ready": [B.pid]})
	_ok("вторую копию той же миссии не создать", not sm2.get("ok", true))
	_ok("оба входят в миссию", (await A.ask("enter", {"mid": mid})).get("ok", false) and (await B.ask("enter", {"mid": mid})).get("ok", false))
	await _loot_checks(A, B, C, mid)
	var kres := [{}, {}]
	var ka := func() -> void: kres[0] = await A.ask("take_key", {"mid": mid, "op": A.op_id()})
	var kb := func() -> void: kres[1] = await B.ask("take_key", {"mid": mid, "op": B.op_id()})
	ka.call()
	kb.call()
	tw = Time.get_ticks_msec()
	while ((kres[0] as Dictionary).is_empty() or (kres[1] as Dictionary).is_empty()) and Time.get_ticks_msec() - tw < 8000:
		await get_tree().process_frame
	var key_a: bool = kres[0].get("ok", false)
	var key_b: bool = kres[1].get("ok", false)
	_ok("ключ главаря — одному, кто первым забрал", int(key_a) + int(key_b) == 1)
	var owner: ULNet = A if key_a else B
	var other: ULNet = B if key_a else A
	_ok("без ключа сундук не открыть", not (await other.ask("open_chest", {"mid": mid, "op": other.op_id()})).get("ok", true))
	var ch1: Dictionary = await owner.ask("open_chest", {"mid": mid, "op": owner.op_id()})
	var ch2: Dictionary = await owner.ask("open_chest", {"mid": mid, "op": owner.op_id()})
	_ok("сундук открыл владелец ключа: награда «%s» — ему, второй раз — нет" % String(ch1.get("reward", "")), ch1.get("ok", false) and not ch2.get("ok", true) and String(ch2.err) == "used")
	await _storage_checks(A, B, C, wid, owner, String(ch1.get("reward", "")))
	var dA: Dictionary = await A.ask("died", {"mid": mid})
	_ok("первый погиб — миссия идёт дальше (второй жив)", dA.get("ok", false) and bool(dA.open))
	var eA: Dictionary = await A.ask("enter", {"mid": mid})
	_ok("погибший в ту же миссию не входит", not eA.get("ok", true) and String(eA.err) == "dead")
	var lo: Dictionary = await B.ask("loot_open", {"mid": mid, "key": "g:2", "table": "item:junk:2"})
	var ld: Dictionary = await A.ask("loot_take", {"mid": mid, "key": "g:2", "i": 0, "expect": "junk", "n": 2, "op": A.op_id()})
	_ok("погибший ничего не берёт из миссии (находку забирает живой)", lo.get("ok", false) and not ld.get("ok", true) and String(ld.err) == "dead")
	_ok("посторонний в миссию не входит", not (await C.ask("enter", {"mid": mid})).get("ok", true))
	# обрыв связи — не смерть: второй переподключается и возвращается
	B.multiplayer.multiplayer_peer.close()
	await get_tree().create_timer(0.5).timeout
	var rb := await _connect(B, "Второй")
	var eB: Dictionary = await B.ask("enter", {"mid": mid})
	_ok("второй потерял связь и вернулся в ту же миссию (обрыв — не гибель)", rb and eB.get("ok", false))
	var lB: Dictionary = await B.ask("left", {"mid": mid})
	_ok("второй вышел из кластера — миссия закрыта", lB.get("ok", false) and not bool(lB.open))
	_ok("после закрытия — ни погибший, ни вышедший не войдут; новая миссия — только с новой покупкой",
		not (await A.ask("enter", {"mid": mid})).get("ok", true) and String((await A.ask("start_mission", {"wid": wid, "route": "sanatorium", "ready": [A.pid]})).get("err", "")) == "no_route")
	# чужой с тем же идентификатором, но без секрета
	var D := _client("D")
	D.pid = A.pid
	D.token = "0".repeat(48)
	D.connect_to("127.0.0.1", port)
	tw = Time.get_ticks_msec()
	while not D.online() and Time.get_ticks_msec() - tw < 8000:
		await get_tree().process_frame
	var hd: Dictionary = await D.ask("hello", {"name": "Самозванец"})
	_ok("чужой телефон с идентификатором первого, но без его секрета — не входит", not hd.get("ok", true) and String(hd.err) == "bad_token")
	var sv: Dictionary = await A.ask("safe_view", {"wid": wid, "k": 2})
	var f := FileAccess.open("%s/world.txt" % dir, FileAccess.WRITE)
	f.store_string(JSON.stringify({"wid": wid, "code": code, "safe2": sv.get("cells", [])}))


## Добыча в совместной миссии: оба видят одно содержимое; разом взяли одну ячейку — одному; на земле — первому;
## тело — одно на двоих; второй получает обновление сразу; посторонний не открывает; повтор не дублирует
func _loot_checks(A: ULNet, B: ULNet, C: ULNet, mid: String) -> void:
	var b_events := []
	B.loot_changed.connect(func(m: String, k: String, cells: Array) -> void: b_events.append([k, cells.duplicate(true)]))
	var key := ""
	var oa := {}
	for t in 40:
		key = "c:%d" % t
		oa = await A.ask("loot_open", {"mid": mid, "key": key, "table": "store"})
		if (oa.get("cells", []) as Array).any(func(c): return c != null):
			break
	var ob: Dictionary = await B.ask("loot_open", {"mid": mid, "key": key, "table": "store"})
	_ok("тайник %s: содержимое разыграл сервер, оба видят одно и то же" % key, oa.get("ok", false) and ob.get("ok", false) and JSON.stringify(oa.cells) == JSON.stringify(ob.cells), JSON.stringify(oa.get("cells", [])).substr(0, 120))
	var ci := (oa.cells as Array).find((oa.cells as Array).filter(func(c): return c != null)[0])
	var it: Dictionary = oa.cells[ci]
	var before_a := JSON.stringify((await A.ask("me")).player)
	var res := [{}, {}]
	var ga := func() -> void: res[0] = await A.ask("loot_take", {"mid": mid, "key": key, "i": ci, "expect": String(it.id), "n": int(it.n), "op": A.op_id()})
	var gb := func() -> void: res[1] = await B.ask("loot_take", {"mid": mid, "key": key, "i": ci, "expect": String(it.id), "n": int(it.n), "op": B.op_id()})
	ga.call()
	gb.call()
	var tw := Time.get_ticks_msec()
	while ((res[0] as Dictionary).is_empty() or (res[1] as Dictionary).is_empty()) and Time.get_ticks_msec() - tw < 8000:
		await get_tree().process_frame
	var oks := int(res[0].get("ok", false)) + int(res[1].get("ok", false))
	var loser: Dictionary = res[1] if res[0].get("ok", false) else res[0]
	_ok("оба разом берут «%s ×%d» из одного тайника — получает один, второму «gone» и пустая ячейка" % [String(it.id), int(it.n)],
		oks == 1 and String(loser.get("err", "")) == "gone" and (loser.get("cells", []) as Array).size() > ci and loser.cells[ci] == null)
	var cnt := 0
	for P in [A, B]:
		var pl: Dictionary = (await P.ask("me")).player
		for x in pl.inv:
			if x is Dictionary and String(x.id) == String(it.id):
				cnt += int(x.n)
		cnt += int(pl.wallet.get(String(it.id), 0)) if ULServerState._wallet_item(String(it.id)) else 0
	_ok("предмет теперь ровно у одного игрока, копий нет", ULServerState._wallet_item(String(it.id)) or cnt == int(it.n), "%d шт." % cnt)
	# на земле: первый подобрал — второму нечего
	var g1: Dictionary = await B.ask("loot_open", {"mid": mid, "key": "g:1", "table": "item:ore:3"})
	var gt1: Dictionary = await B.ask("loot_take", {"mid": mid, "key": "g:1", "i": 0, "expect": "ore", "n": 3, "op": B.op_id()})
	var gt2: Dictionary = await A.ask("loot_take", {"mid": mid, "key": "g:1", "i": 0, "expect": "ore", "n": 3, "op": A.op_id()})
	_ok("руда на земле: подобрал второй — первому уже нечего («gone»)", g1.get("ok", false) and gt1.get("ok", false) and not gt2.get("ok", true) and String(gt2.err) == "gone")
	var ga2: Dictionary = await A.ask("loot_open", {"mid": mid, "key": "g:1", "table": "item:svd:1"})
	var gw: Dictionary = await A.ask("loot_open", {"mid": mid, "key": "g:99", "table": "item:svd:1"})
	_ok("та же находка не разыгрывается заново под другую таблицу; оружие «с земли» сервер не выдаёт", ga2.get("ok", false) and ga2.cells[0] == null and not gw.get("ok", true))
	# тело: одно содержимое на двоих, частями
	var e1: Dictionary = await A.ask("loot_open", {"mid": mid, "key": "e:1", "table": "enemy:infected"})
	var e2: Dictionary = await B.ask("loot_open", {"mid": mid, "key": "e:1", "table": "enemy:infected"})
	_ok("тело пустыша: у обоих одна и та же добыча", e1.get("ok", false) and JSON.stringify(e1.cells) == JSON.stringify(e2.cells), JSON.stringify(e1.get("cells", [])))
	b_events.clear()
	var took := 0
	for j in (e1.cells as Array).size():
		var c = e1.cells[j]
		if c != null:
			var r: Dictionary = await A.ask("loot_take", {"mid": mid, "key": "e:1", "i": j, "expect": String(c.id), "n": int(c.n), "op": A.op_id()})
			took += int(r.get("ok", false))
	await get_tree().create_timer(0.4).timeout
	var e3: Dictionary = await B.ask("loot_open", {"mid": mid, "key": "e:1", "table": "enemy:infected"})
	_ok("первый обыскал тело (%d) — второму пришло обновление, тело пустое" % took, (took == 0 or b_events.size() == took) and (e3.cells as Array).all(func(c): return c == null))
	_ok("посторонний не открывает находки чужой миссии", not (await C.ask("loot_open", {"mid": mid, "key": key, "table": "store"})).get("ok", true))
	var g3: Dictionary = await A.ask("loot_open", {"mid": mid, "key": "g:3", "table": "item:junk:5"})
	var opx := A.op_id()
	var r1: Dictionary = await A.ask("loot_take", {"mid": mid, "key": "g:3", "i": 0, "expect": "junk", "n": 2, "op": opx})
	var r2: Dictionary = await A.ask("loot_take", {"mid": mid, "key": "g:3", "i": 0, "expect": "junk", "n": 2, "op": opx})
	var g4: Dictionary = await B.ask("loot_open", {"mid": mid, "key": "g:3", "table": "item:junk:5"})
	_ok("повтор той же просьбы «взять 2 хлама» выполнен один раз (осталось 3)", g3.get("ok", false) and r1.get("ok", false) and r2.get("ok", false) and g4.cells[0] != null and int(g4.cells[0].n) == 3)


## Хранилище в кооперативе: общий уровень (платит купивший), общие сейфы, «разом взяли одно» — одному,
## предмет из инвентаря одного — в сейф — другому, перенос между сейфами, сортировка, повтор просьбы, посторонний
func _storage_checks(A: ULNet, B: ULNet, C: ULNet, wid: String, owner: ULNet, reward: String) -> void:
	var ma: Dictionary = await A.ask("me")
	var mb: Dictionary = await B.ask("me")
	var a0 := int(ma.player.wallet.get("spore", 0))
	var b0 := int(mb.player.wallet.get("spore", 0))
	var u1: Dictionary = await B.ask("storage_upgrade", {"wid": wid, "op": B.op_id()})
	await get_tree().create_timer(0.3).timeout
	var ma1: Dictionary = await A.ask("me")
	_ok("хранилище: второй купил (ур. 1) за 50 споранов — %d → %d, у первого не списано (%d)" % [b0, int(u1.get("wallet", {}).get("spore", -1)), int(ma1.player.wallet.spore)],
		u1.get("ok", false) and int(u1.level) == 1 and int(u1.wallet.spore) == b0 - 50 and int(ma1.player.wallet.spore) == a0)
	_ok("первому пришло: хранилище ур. 1, сейф №1 — 30 ячеек", int(A.world.get("base", {}).get("storage", {}).get("level", 0)) == 1 and (A.world.base.storage.safes.safe_1 as Array).size() == 30)
	var u2: Dictionary = await A.ask("storage_upgrade", {"wid": wid, "op": A.op_id()})
	if a0 < 50:
		_ok("у первого не хватает (%d) — улучшение не прошло, уровень тот же" % a0, not u2.get("ok", true) and String(u2.err) == "money" and int(u2.level) == 1)
	else:
		_ok("первый улучшил до ур. 2", u2.get("ok", false) and int(u2.level) == 2)
	if int((await B.ask("safe_view", {"wid": wid, "k": 1})).get("level", 0)) < 2:
		await B.ask("storage_upgrade", {"wid": wid, "op": B.op_id()})
	var v2: Dictionary = await A.ask("safe_view", {"wid": wid, "k": 2})
	_ok("уровень 2: у обоих сейф №2", v2.get("ok", false) and int(v2.level) == 2 and (v2.cells as Array).size() == 30)
	_ok("посторонний не видит сейфы мира", not (await C.ask("safe_view", {"wid": wid, "k": 1})).get("ok", true))
	# ресурс — в сейф; второй видит; разом берут одно — одному
	var who: ULNet = A if int((await A.ask("me")).player.wallet.spore) >= 20 else B
	var p1: Dictionary = await who.ask("safe_put", {"wid": wid, "k": 1, "item": {"id": "spore", "n": 20}, "op": who.op_id()})
	await get_tree().create_timer(0.3).timeout
	var s1: Array = B.world.get("base", {}).get("storage", {}).get("safes", {}).get("safe_1", [])
	_ok("в сейф №1 положено 20 споранов — второй видит их у себя", p1.get("ok", false) and s1.size() == 30 and s1[0] != null and String(s1[0].id) == "spore" and int(s1[0].n) == 20)
	var tot0 := int((await A.ask("me")).player.wallet.spore) + int((await B.ask("me")).player.wallet.spore) + 20
	var res := [{}, {}]
	var ga := func() -> void: res[0] = await A.ask("safe_take", {"wid": wid, "k": 1, "i": 0, "expect": "spore", "n": 20, "op": A.op_id()})
	var gb := func() -> void: res[1] = await B.ask("safe_take", {"wid": wid, "k": 1, "i": 0, "expect": "spore", "n": 20, "op": B.op_id()})
	ga.call()
	gb.call()
	var tw := Time.get_ticks_msec()
	while ((res[0] as Dictionary).is_empty() or (res[1] as Dictionary).is_empty()) and Time.get_ticks_msec() - tw < 8000:
		await get_tree().process_frame
	var tot1 := int((await A.ask("me")).player.wallet.spore) + int((await B.ask("me")).player.wallet.spore)
	_ok("двое разом забирают одну ячейку сейфа — получает один, у второго «gone»; споранов не прибавилось (%d = %d)" % [tot0, tot1],
		int(res[0].get("ok", false)) + int(res[1].get("ok", false)) == 1 and (String(res[0].get("err", "")) == "gone" or String(res[1].get("err", "")) == "gone") and tot0 == tot1)
	# предмет из инвентаря владельца ключа — в сейф №2 — забирает другой
	var other: ULNet = B if owner == A else A
	var pw: Dictionary = await owner.ask("safe_put", {"wid": wid, "k": 2, "item": {"id": reward, "n": 1}, "op": owner.op_id()})
	var mo: Dictionary = await owner.ask("me")
	var has_o := false
	for it in mo.player.inv:
		if (it is String and it == reward) or (it is Dictionary and String(it.id) == reward):
			has_o = true
	_ok("награда сундука «%s» — из инвентаря первого в сейф №2 (у него её больше нет)" % reward, pw.get("ok", false) and not has_o)
	var c2: Array = pw.get("cells", [])
	var wi := -1
	for i in c2.size():
		if c2[i] != null and String(c2[i].id) == reward:
			wi = i
	var tk: Dictionary = await other.ask("safe_take", {"wid": wid, "k": 2, "i": wi, "expect": reward, "n": 1, "op": other.op_id()})
	var again: Dictionary = await owner.ask("safe_take", {"wid": wid, "k": 2, "i": wi, "expect": reward, "n": 1, "op": owner.op_id()})
	_ok("второй забрал её себе; повторно взять уже нечего (без дубликата)", tk.get("ok", false) and not again.get("ok", true) and String(again.err) == "gone")
	# вернуть в сейф №2, перенести в №1, сортировка, повтор той же просьбы
	await other.ask("safe_put", {"wid": wid, "k": 2, "item": {"id": reward, "n": 1}, "op": other.op_id()})
	var mv: Dictionary = await A.ask("safe_move", {"wid": wid, "k": 2, "i": 0, "k2": 1, "i2": 5, "expect": reward, "op": A.op_id()})
	_ok("перенос между сейфами: №2 → №1 (ячейка 6)", mv.get("ok", false) and mv.cells2[5] != null and String(mv.cells2[5].id) == reward and mv.cells[0] == null)
	var me_a: Dictionary = await A.ask("me")
	var put_n := mini(int(me_a.player.wallet.spore), 7)
	var opx := A.op_id()
	var q1: Dictionary = await A.ask("safe_put", {"wid": wid, "k": 1, "item": {"id": "spore", "n": put_n}, "op": opx})
	var q2: Dictionary = await A.ask("safe_put", {"wid": wid, "k": 1, "item": {"id": "spore", "n": put_n}, "op": opx})
	var me_a2: Dictionary = await A.ask("me")
	_ok("повтор той же просьбы «положить %d» в сейф выполнен один раз" % put_n, put_n == 0 or (q1.get("ok", false) and q2.get("ok", false) and int(me_a2.player.wallet.spore) == int(me_a.player.wallet.spore) - put_n))
	var so: Dictionary = await B.ask("safe_sort", {"wid": wid, "k": 1, "op": B.op_id()})
	_ok("сортировка сейфа №1: занятые ячейки — подряд с начала", so.get("ok", false) and so.cells[0] != null and (put_n == 0 or so.cells[1] != null) and so.cells[29] == null)
	# обратно в сейф №2 — для проверки после перезапуска
	await B.ask("safe_move", {"wid": wid, "k": 1, "i": int((so.cells as Array).map(func(c): return c != null and String(c.id) == reward).find(true)), "k2": 2, "i2": 0, "expect": reward, "op": B.op_id()})


func _phase2() -> void:
	var w = JSON.parse_string(FileAccess.get_file_as_string("%s/world.txt" % dir))
	var A := _client("A")
	var B := _client("B")
	_ok("после перезапуска сервера оба снова входят своими профилями", await _connect(A, "Первый") and await _connect(B, "Второй"))
	var me: Dictionary = await A.ask("me")
	var ws: Array = me.get("worlds", [])
	_ok("совместный мир сохранился: код %s, участников 2" % String(w.code), ws.size() == 1 and String(ws[0].code) == String(w.code) and (ws[0].members as Array).size() == 2)
	var bv: Dictionary = await B.ask("box_view", {"wid": String(w.wid), "box": "base_box"})
	_ok("содержимое общего ящика сохранилось", bv.get("ok", false))
	var sv: Dictionary = await B.ask("safe_view", {"wid": String(w.wid), "k": 2})
	var c2: Array = sv.get("cells", [])
	_ok("хранилище после перезапуска: уровень 2, в сейфе №2 — %s (сохранено %s)" % [str(c2[0].id) if c2.size() > 0 and c2[0] != null else "пусто", str(w.safe2[0].id) if (w.safe2 as Array).size() > 0 and w.safe2[0] != null else "пусто"],
		sv.get("ok", false) and int(sv.level) == 2 and c2.size() == 30 and c2[0] != null and (w.safe2 as Array).size() == 30 and w.safe2[0] != null and String(c2[0].id) == String(w.safe2[0].id))
	var mb: Dictionary = await B.ask("me")
	_ok("личные кошельки сохранились раздельно (%d и %d)" % [int(me.player.wallet.spore), int(mb.player.wallet.spore)], int(me.player.wallet.spore) != int(mb.player.wallet.spore))
