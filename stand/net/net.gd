class_name ULNet
extends Node
## Сеть кооператива: один узел /root/Net и на выделенном сервере, и на телефонах (RPC в Godot ищут узел по пути).
## Транспорт — ENet по UDP (порт PORT). Сервер — отдельная сборка Godot без экрана (net/server.tscn), телефоны —
## клиенты. Клиент только просит (c_…), сервер проверяет и отвечает (s_reply) и рассылает участникам мира новое
## состояние (s_world). Предметы, валюта, покупки, миссии и смерти — только через сервер (ULServerState).

signal replied(req: int, res: Dictionary)
signal world_changed(world: Dictionary)
signal connected_ok
signal connection_lost

const PORT := 7777
const VERSION := 1
const SHOP := "res://data/base_shop.json"
const CASE := "res://data/case.json"

var is_server := false
var state: ULServerState           ## только на сервере
var peers := {}                    ## сервер: peer_id → pid
var _req := 0
var shop := {}

# клиент: кто я и где
var pid := ""
var token := ""
var world := {}


static func get_net(tree: SceneTree) -> ULNet:
	var n := tree.root.get_node_or_null("Net")
	if n == null:
		n = ULNet.new()
		n.name = "Net"
		tree.root.add_child(n)
	return n


func _ready() -> void:
	shop = JSON.parse_string(FileAccess.get_file_as_string(SHOP))


# ---------------- сервер ----------------

func start_server(port := PORT, save_path := "user://coop_server.json", grant := 0) -> int:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_server(port, 16)
	if err != OK:
		return err
	multiplayer.multiplayer_peer = peer
	is_server = true
	state = ULServerState.new(save_path)
	state.test_grant = grant
	multiplayer.peer_disconnected.connect(func(id: int) -> void:
		print("[server] отключился peer %d (%s)" % [id, String(peers.get(id, "?"))])
		peers.erase(id))
	multiplayer.peer_connected.connect(func(id: int) -> void: print("[server] подключился peer %d" % id))
	var t := Timer.new()
	t.wait_time = 1.0
	t.autostart = true
	t.timeout.connect(func() -> void:
		for mid in state.tick(Time.get_unix_time_from_system()):
			_push_world(String(state.data.missions[mid].world)))
	add_child(t)
	print("[server] слушаю UDP %d, данные %s" % [port, ProjectSettings.globalize_path(save_path)])
	return OK


func _sender_pid() -> String:
	return String(peers.get(multiplayer.get_remote_sender_id(), ""))


func _reply(req: int, res: Dictionary) -> void:
	s_reply.rpc_id(multiplayer.get_remote_sender_id(), req, res)


## разослать новое состояние мира всем его участникам, кто сейчас в сети
func _push_world(wid: String) -> void:
	if not state.data.worlds.has(wid):
		return
	var pw := state.public_world(wid)
	if String(pw.mission) != "" and state.data.missions.has(pw.mission):
		pw["mission_info"] = state.data.missions[pw.mission]
	for id in peers:
		if state.is_member(wid, String(peers[id])):
			s_world.rpc_id(id, pw)


func _price(kind: String, id: String) -> Dictionary:
	var d: Dictionary = shop.get(kind, {}).get(id, {})
	return d.get("price", {})


@rpc("any_peer", "reliable")
func c_hello(req: int, version: int, p: String, tok: String, name: String) -> void:
	if not is_server:
		return
	if version != VERSION:
		_reply(req, {"ok": false, "err": "version"})
		return
	var r := state.hello(p, tok, name)
	if r.ok:
		# один игрок — одно подключение: прежнее (повисшее) забывается
		for id in peers.keys():
			if String(peers[id]) == p:
				peers.erase(id)
		peers[multiplayer.get_remote_sender_id()] = p
	_reply(req, r)


@rpc("any_peer", "reliable")
func c_call(req: int, op: String, args: Dictionary) -> void:
	if not is_server:
		return
	var p := _sender_pid()
	if p == "":
		_reply(req, {"ok": false, "err": "no_hello"})
		return
	var wid := String(args.get("wid", ""))
	var opid := String(args.get("op", ""))
	var res := {}
	var now := Time.get_unix_time_from_system()
	match op:
		"create_world":
			res = state.create_world(p)
		"join":
			res = state.join_world(p, String(args.get("code", "")))
			if res.ok:
				wid = String(res.world.wid)
		"me":
			res = {"ok": true, "player": state.public_player(p), "worlds": state.worlds_of(p)}
		"set_char":
			res = state.set_char(p, String(args.get("char", "")))
		"box_view":
			res = state.box_view(wid, p, String(args.get("box", "")))
		"box_put":
			res = state.box_put(wid, p, String(args.get("box", "")), String(args.get("item", "")), int(args.get("n", 0)), opid)
		"box_take":
			res = state.box_take(wid, p, String(args.get("box", "")), String(args.get("item", "")), int(args.get("n", 0)), opid)
		"buy_route":
			var rid := String(args.get("route", ""))
			res = state.buy_route(wid, p, rid, _price("routes", rid), opid) if shop.get("routes", {}).has(rid) else {"ok": false, "err": "no_route"}
		"install":
			var uid := String(args.get("what", ""))
			res = state.install(wid, p, uid, _price("upgrades", uid), opid) if shop.get("upgrades", {}).has(uid) else {"ok": false, "err": "no_upgrade"}
		"start_mission":
			var route := String(args.get("route", ""))
			var minutes := float(shop.get("routes", {}).get(route, {}).get("minutes", 10))
			res = state.start_mission(wid, p, route, args.get("ready", []), minutes, now)
		"storage_upgrade":
			res = state.storage_upgrade(wid, p, _price("upgrades", "storage"), opid)
		"safe_view":
			res = state.safe_view(wid, p, int(args.get("k", 0)))
		"safe_put":
			res = state.safe_put(wid, p, int(args.get("k", 0)), args.get("item", {}) if args.get("item") is Dictionary else {}, opid)
		"safe_take":
			res = state.safe_take(wid, p, int(args.get("k", 0)), int(args.get("i", -1)), String(args.get("expect", "")), int(args.get("n", 0)), opid)
		"safe_move":
			res = state.safe_move(wid, p, int(args.get("k", 0)), int(args.get("i", -1)), int(args.get("k2", 0)), int(args.get("i2", -1)), String(args.get("expect", "")), opid)
		"safe_sort":
			res = state.safe_sort(wid, p, int(args.get("k", 0)), opid)
		"enter":
			res = state.can_enter(String(args.get("mid", "")), p)
		"died":
			res = state.died(String(args.get("mid", "")), p)
		"left":
			res = state.left(String(args.get("mid", "")), p)
		"take_key":
			res = state.take_key(String(args.get("mid", "")), p, opid)
		"open_chest":
			res = state.open_chest(String(args.get("mid", "")), p, _roll_case(), opid)
		_:
			res = {"ok": false, "err": "no_op"}
	if res.get("ok", false) and res.has("wallet"):
		res["player"] = state.public_player(p)
	_reply(req, res)
	if wid == "" and String(args.get("mid", "")) != "" and state.data.missions.has(String(args.mid)):
		wid = String(state.data.missions[String(args.mid)].world)
	if wid != "":
		_push_world(wid)


## награда сундука на сервере (клиенту не доверяем): редкость по шансам, модель — поровну внутри редкости
func _roll_case() -> String:
	var c = JSON.parse_string(FileAccess.get_file_as_string(CASE))
	if not (c is Dictionary):
		return "ak74m"
	var total := 0.0
	for r in c.rarities:
		total += float(r.chance)
	var x := randf() * total
	for r in c.rarities:
		x -= float(r.chance)
		if x <= 0.0 and (r.items as Array).size() > 0:
			return String(r.items[randi() % (r.items as Array).size()])
	return "ak74m"


# ---------------- клиент ----------------

func connect_to(host: String, port := PORT) -> int:
	var peer := ENetMultiplayerPeer.new()
	var err := peer.create_client(host, port)
	if err != OK:
		return err
	multiplayer.multiplayer_peer = peer
	if not multiplayer.connected_to_server.is_connected(_on_connected):
		multiplayer.connected_to_server.connect(_on_connected)
		multiplayer.connection_failed.connect(func() -> void: connection_lost.emit())
		multiplayer.server_disconnected.connect(func() -> void: connection_lost.emit())
	return OK


func _on_connected() -> void:
	connected_ok.emit()


func online() -> bool:
	return multiplayer.multiplayer_peer != null and multiplayer.multiplayer_peer.get_connection_status() == MultiplayerPeer.CONNECTION_CONNECTED and not is_server


## просьба серверу и ожидание ответа (с пределом времени)
func ask(op: String, args := {}, timeout_s := 8.0) -> Dictionary:
	_req += 1
	var my := _req
	var box := [{"ok": false, "err": "timeout"}]       # лямбда видит массив по ссылке (переменную — копией)
	var got := [false]
	var cb := func(r: int, d: Dictionary) -> void:
		if r == my:
			box[0] = d
			got[0] = true
	replied.connect(cb)
	if op == "hello":
		c_hello.rpc_id(1, my, VERSION, pid, token, String(args.get("name", "Сталкер")))
	else:
		c_call.rpc_id(1, my, op, args)
	var t0 := Time.get_ticks_msec()
	while not got[0] and Time.get_ticks_msec() - t0 < timeout_s * 1000.0:
		await get_tree().process_frame
	replied.disconnect(cb)
	return box[0]


## номер операции: повтор просьбы после обрыва связи сервер не выполнит дважды
func op_id() -> String:
	return "%s-%d-%d" % [pid.substr(0, 8), Time.get_ticks_usec(), randi() % 100000]


@rpc("authority", "reliable")
func s_reply(req: int, res: Dictionary) -> void:
	replied.emit(req, res)


@rpc("authority", "reliable")
func s_world(w: Dictionary) -> void:
	world = w
	world_changed.emit(w)


# ---------------- профиль на телефоне ----------------

const PROFILE := "user://coop_profile.json"


## постоянный идентификатор игрока и секрет (только на этом телефоне; сервер хранит хэш секрета)
func load_profile(path := PROFILE) -> void:
	if FileAccess.file_exists(path):
		var d = JSON.parse_string(FileAccess.get_file_as_string(path))
		if d is Dictionary:
			pid = String(d.get("pid", ""))
			token = String(d.get("token", ""))
	if pid == "" or token == "":
		var c := Crypto.new()
		pid = "p" + c.generate_random_bytes(8).hex_encode()
		token = c.generate_random_bytes(24).hex_encode()
		var f := FileAccess.open(path, FileAccess.WRITE)
		if f:
			f.store_string(JSON.stringify({"pid": pid, "token": token}))
