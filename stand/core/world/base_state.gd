class_name ULBase
extends RefCounted
## Прогресс домашней базы — отдельно от сохранения локации: купленные маршруты, нанятые люди, улучшения.
## Хранится в user://base.json. Что продаётся и почём — data/base_shop.json (баланс, правится без кода).
## Маршрут живёт так: куплен («bought») → герой вошёл на локацию («active») → вышел, погиб или кластер
## перезагрузился — маршрут закрыт (записи нет), локация пропадает с карты; для нового посещения — новая покупка.

const SAVE := "user://base.json"
const SHOP := "res://data/base_shop.json"
static var data := {}
static var memory_only := false   ## проверки: состояние только в памяти, файл не трогается
static var _loaded := false
static var _shop := {}


static func load_state(force := false) -> void:
	if _loaded and not force:
		return
	_loaded = true
	data = {}
	if not memory_only and FileAccess.file_exists(SAVE):
		var d = JSON.parse_string(FileAccess.get_file_as_string(SAVE))
		if d is Dictionary:
			data = d
	for k in ["routes", "staff", "upgrades"]:
		if not data.has(k) or not (data[k] is Dictionary):
			data[k] = {}


static func save_state() -> void:
	if memory_only:
		return
	var f := FileAccess.open(SAVE, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(data))


static func shop() -> Dictionary:
	if _shop.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(SHOP))
		_shop = d if d is Dictionary else {}
	return _shop


static func has_staff(id: String) -> bool:
	load_state()
	return bool(data.staff.get(id, false))


static func upgrade_level(id: String) -> int:
	load_state()
	return int(data.upgrades.get(id, 0))


## «» — маршрута нет, «bought» — куплен, ждёт входа, «active» — герой на локации
static func route_state(id: String) -> String:
	load_state()
	var r = data.routes.get(id)
	return String(r.get("state", "")) if r is Dictionary else ""


static func set_route(id: String, state: String) -> void:
	load_state()
	if state == "":
		data.routes.erase(id)
	else:
		data.routes[id] = {"state": state, "at": int(Time.get_unix_time_from_system())}
	save_state()


static func hire(id: String) -> void:
	load_state()
	data.staff[id] = true
	save_state()


static func add_upgrade(id: String) -> void:
	load_state()
	data.upgrades[id] = upgrade_level(id) + 1
	save_state()


## посещение, прерванное закрытием игры (маршрут «active», а герой не на локации), считается законченным:
## маршрут закрыт. Вызывается с карты мира и из главного меню.
static func close_interrupted() -> void:
	load_state()
	for id in data.routes.keys():
		if route_state(String(id)) == "active":
			data.routes.erase(id)
	save_state()
