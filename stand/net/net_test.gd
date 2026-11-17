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
	var dA: Dictionary = await A.ask("died", {"mid": mid})
	_ok("первый погиб — миссия идёт дальше (второй жив)", dA.get("ok", false) and bool(dA.open))
	var eA: Dictionary = await A.ask("enter", {"mid": mid})
	_ok("погибший в ту же миссию не входит", not eA.get("ok", true) and String(eA.err) == "dead")
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
	var f := FileAccess.open("%s/world.txt" % dir, FileAccess.WRITE)
	f.store_string(JSON.stringify({"wid": wid, "code": code}))


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
	var mb: Dictionary = await B.ask("me")
	_ok("личные кошельки сохранились раздельно (%d и %d)" % [int(me.player.wallet.spore), int(mb.player.wallet.spore)], int(me.player.wallet.spore) != int(mb.player.wallet.spore))
