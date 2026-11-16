class_name ULBase
extends RefCounted
## Прогресс домашней базы — отдельно от сохранения локации: установленные улучшения (оружейник), маршруты,
## таймер новых маршрутов. Хранится в user://base.json. Что продаётся и почём — data/base_shop.json.
## Маршрут живёт так: куплен («bought») → герой вошёл на локацию («active») → вышел, погиб или кластер
## перезагрузился — маршрут закрыт (записи нет), локация пропадает с карты; для нового посещения — новая покупка.
## Покупки здесь — игровая логика без интерфейса: проверка, списание из кошелька героя, запись, сохранение.

const SHOP := "res://data/base_shop.json"
static var path := "user://base.json"
static var data := {}
static var memory_only := false   ## проверки: состояние только в памяти, файл не трогается
static var _loaded := false
static var _shop := {}


static func load_state(force := false) -> void:
	if _loaded and not force:
		return
	_loaded = true
	data = {}
	if not memory_only and FileAccess.file_exists(path):
		var d = JSON.parse_string(FileAccess.get_file_as_string(path))
		if d is Dictionary:
			data = d
	for k in ["routes", "staff", "upgrades"]:
		if not data.has(k) or not (data[k] is Dictionary):
			data[k] = {}
	if not (data.get("offers") is Array):
		data["offers"] = []


static func save_state() -> void:
	if memory_only:
		return
	write_json(path, data)


## запись без порчи файла: сначала во временный, затем подмена одним действием (обрыв посреди записи
## оставляет прежний файл целым)
static func write_json(p: String, d) -> bool:
	var tmp := p + ".tmp"
	var f := FileAccess.open(tmp, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(d))
	f.close()
	return DirAccess.rename_absolute(ProjectSettings.globalize_path(tmp), ProjectSettings.globalize_path(p)) == OK


static func shop() -> Dictionary:
	if _shop.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(SHOP))
		_shop = d if d is Dictionary else {}
	return _shop


static func has_staff(id: String) -> bool:
	load_state()
	return bool(data.staff.get(id, false))


static func installed(id: String) -> bool:
	load_state()
	return int(data.upgrades.get(id, 0)) > 0


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


## Купить и установить улучшение базы (оружейник). Ответ: {ok, err: ""|"have"|"money"|"none", miss: {ресурс: сколько
## не хватает}}. Ресурсы списываются только при успехе; повторная покупка установленного невозможна.
static func buy_upgrade(inv: ULInventory, id: String) -> Dictionary:
	load_state()
	var d: Dictionary = shop().get("upgrades", {}).get(id, {})
	if d.is_empty() or d.get("soon", false):
		return {"ok": false, "err": "none", "miss": {}}
	if installed(id):
		return {"ok": false, "err": "have", "miss": {}}
	var miss := ULEconomy.missing(inv.wallet, d.price)
	if not miss.is_empty() or not inv.pay(d.price):
		return {"ok": false, "err": "money", "miss": miss}
	data.upgrades[id] = 1
	if d.has("staff"):
		data.staff[String(d.staff)] = true
	save_state()
	return {"ok": true, "err": "", "miss": {}}


## Купить маршрут. Пока маршрут куплен или идёт посещение — повторно не купить.
static func buy_route(inv: ULInventory, id: String) -> Dictionary:
	load_state()
	var d: Dictionary = shop().get("routes", {}).get(id, {})
	if d.is_empty() or d.get("soon", false) or not offers().has(id):
		return {"ok": false, "err": "none", "miss": {}}
	if route_state(id) != "":
		return {"ok": false, "err": "have", "miss": {}}
	var miss := ULEconomy.missing(inv.wallet, d.price)
	if not miss.is_empty() or not inv.pay(d.price):
		return {"ok": false, "err": "money", "miss": miss}
	set_route(id, "bought")
	return {"ok": true, "err": "", "miss": {}}


# ---------------- новые маршруты по времени ----------------

static func refresh_period() -> int:
	return maxi(int(float(shop().get("route_refresh_h", 3)) * 3600.0), 60)


## маршруты, что сейчас предлагает компьютер: пока есть только «Опасный коровник» — он и остаётся
static func _roll_offers() -> Array:
	var out := []
	for id in shop().get("routes", {}):
		if not shop().routes[id].get("soon", false):
			out.append(String(id))
	return out


static func offers() -> Array:
	routes_tick()
	return data.offers


## Сколько секунд до обновления маршрутов. Время следующего обновления хранится в base.json (unix-время),
## поэтому таймер не сбрасывается при открытии компьютера и идёт, пока игра закрыта. Истекло — предложения
## обновляются, следующий срок — через период (пропущенные периоды пропускаются целиком).
static func routes_tick(now := -1) -> int:
	load_state()
	if now < 0:
		now = int(Time.get_unix_time_from_system())
	var per := refresh_period()
	var nxt := int(data.get("routes_next", 0))
	var dirty := false
	if nxt <= 0 or nxt - now > per:
		# первый запуск, или часы устройства отведены назад больше чем на период
		nxt = now + per
		data.offers = _roll_offers()
		dirty = true
	elif now >= nxt:
		nxt += ((now - nxt) / per + 1) * per
		data.offers = _roll_offers()
		data.refreshes = int(data.get("refreshes", 0)) + 1
		dirty = true
	if (data.offers as Array).is_empty():
		data.offers = _roll_offers()
		dirty = true
	if dirty:
		data.routes_next = nxt
		save_state()
	return nxt - now


## посещение, прерванное закрытием игры (маршрут «active», а герой не на локации), считается законченным:
## маршрут закрыт. Вызывается с карты мира и из главного меню.
static func close_interrupted() -> void:
	load_state()
	for id in data.routes.keys():
		if route_state(String(id)) == "active":
			data.routes.erase(id)
	save_state()


static func clock(sec: int) -> String:
	sec = maxi(sec, 0)
	return "%02d:%02d:%02d" % [sec / 3600, (sec / 60) % 60, sec % 60]
