extends Node
## Выделенный сервер кооператива (без экрана): godot --headless --path . res://net/server.tscn -- --port=7777
## [--data=user://coop_server.json] [--grant=N — для проверок: столько споранов у нового игрока вместо стартового запаса].
## Порт UDP открыть на VPS (ufw allow 7777/udp). Перезапуск безопасен: состояние — в файле с резервными копиями.

func _ready() -> void:
	_start.call_deferred()                      # корень сцены ещё собирается: узел сети — после


func _start() -> void:
	var port := ULNet.PORT
	var data := "user://coop_server.json"
	var grant := -1                             # −1 — стартовые ресурсы из data/base_shop.json (coop.start_wallet: 300 споранов и 50 горошин)
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--port="):
			port = int(a.substr(7))
		elif a.begins_with("--data="):
			data = a.substr(7)
		elif a.begins_with("--grant="):
			grant = int(a.substr(8))
	var net := ULNet.get_net(get_tree())
	var err := net.start_server(port, data, grant)
	if err != OK:
		push_error("[server] не удалось открыть порт %d: %s" % [port, error_string(err)])
		get_tree().quit(1)
