class_name ULBase
extends RefCounted
## Прогресс домашней базы — отдельно от сохранения локации: установленные улучшения (оружейник), маршруты,
## таймер новых маршрутов. Хранится в user://base.json. Что продаётся и почём — data/base_shop.json.
## Маршрут живёт так: куплен («bought») → герой вошёл на локацию («active») → вышел, погиб или кластер
## перезагрузился — маршрут закрыт (записи нет), локация пропадает с карты; для нового посещения — новая покупка.
## Покупки здесь — игровая логика без интерфейса: проверка, списание из кошелька героя, запись, сохранение.

const SHOP := "res://data/base_shop.json"
const STORAGE_MAX := 6            ## хранилище: до 6 сейфов
const SAFE_CELLS := 30            ## ячеек в сейфе (сетка 6 × 5)
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
	# что сейчас на каждой локации после перезагрузки кластера (ULReload): разыгрывается при обновлении маршрутов
	if not (data.get("reload") is Dictionary):
		data["reload"] = {}
	# какие локации компьютер уже знает: новая (пришла с обновлением игры) сразу попадает в набор
	if not (data.get("seen") is Array):
		data["seen"] = (data.offers as Array).duplicate() if not (data.offers as Array).is_empty() else route_pool()
	# пройденные с последнего сброса: до следующего сброса их нет в компьютере и их не купить
	if not (data.get("done") is Array):
		data["done"] = []
	# хранилище: уровень 0–6 и сейфы с постоянными номерами (safe_1 … safe_6) — по 30 ячеек
	if not (data.get("storage") is Dictionary):
		data["storage"] = {"level": 0, "safes": {}}
	var stg: Dictionary = data.storage
	if not (stg.get("safes") is Dictionary):
		stg["safes"] = {}
	stg["level"] = clampi(int(stg.get("level", 0)), 0, STORAGE_MAX)
	for k in range(1, int(stg.level) + 1):
		var arr = stg.safes.get("safe_%d" % k)
		if not (arr is Array):
			arr = []
		arr.resize(SAFE_CELLS)
		for i in arr.size():
			if arr[i] != null and not (arr[i] is Dictionary):
				arr[i] = null
		stg.safes["safe_%d" % k] = arr


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
		if route_state(id) == "active" and not (data.done as Array).has(id):
			(data.done as Array).append(id)      # посещение окончено — локация пройдена до следующего сброса
		data.routes.erase(id)
	else:
		var keep_map := has_map(id)                # карта куплена вместе с маршрутом — остаётся с ним до конца посещения
		data.routes[id] = {"state": state, "at": int(Time.get_unix_time_from_system())}
		if keep_map:
			data.routes[id]["map"] = true
	save_state()


## Карта локации (вид сверху, на локации — кнопка «Карта» и метка героя): продаётся вместе с маршрутом за треть
## его цены сверху (по каждому ресурсу цены, округление до целого, не меньше 1) и действует, пока действует
## маршрут — на одно посещение. Купить можно сразу с маршрутом или позже, пока маршрут не использован.
static func map_price(id: String) -> Dictionary:
	var out := {}
	var pr: Dictionary = shop().get("routes", {}).get(id, {}).get("price", {})
	for r in pr:
		out[r] = maxi(int(round(float(pr[r]) / 3.0)), 1)
	return out


static func has_map(id: String) -> bool:
	load_state()
	var r = data.routes.get(id)
	return r is Dictionary and bool(r.get("map", false))


## Докупить карту к купленному маршруту. Ответ — как у buy_route; err: "none" — маршрута нет, "have" — карта уже есть.
static func buy_map(inv: ULInventory, id: String) -> Dictionary:
	load_state()
	if route_state(id) == "":
		return {"ok": false, "err": "none", "miss": {}}
	if has_map(id):
		return {"ok": false, "err": "have", "miss": {}}
	var price := map_price(id)
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty() or not inv.pay(price):
		return {"ok": false, "err": "money", "miss": miss}
	data.routes[id]["map"] = true
	save_state()
	return {"ok": true, "err": "", "miss": {}}


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


## пройдена ли локация с последнего сброса (тогда до сброса её нет в компьютере)
static func route_done(id: String) -> bool:
	load_state()
	return (data.done as Array).has(id)


## Купить маршрут — только из тех, что сейчас предлагает компьютер. Пока маршрут куплен или идёт посещение —
## повторно не купить; пройденный — только после следующего сброса. with_map — сразу с картой локации (цена
## маршрута и треть сверху одним платежом: не хватает на оба — не списывается ничего).
static func buy_route(inv: ULInventory, id: String, with_map := false) -> Dictionary:
	load_state()
	var d: Dictionary = shop().get("routes", {}).get(id, {})
	if d.is_empty() or d.get("soon", false) or not offers().has(id):
		return {"ok": false, "err": "none", "miss": {}}
	if route_done(id):
		return {"ok": false, "err": "done", "miss": {}}
	if route_state(id) != "":
		return {"ok": false, "err": "have", "miss": {}}
	var price: Dictionary = (d.price as Dictionary).duplicate()
	if with_map:
		var mp := map_price(id)
		for r in mp:
			price[r] = int(price.get(r, 0)) + int(mp[r])
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty() or not inv.pay(price):
		return {"ok": false, "err": "money", "miss": miss}
	set_route(id, "bought")
	if with_map:
		data.routes[id]["map"] = true
		save_state()
	return {"ok": true, "err": "", "miss": {}}


# ---------------- новые маршруты по времени ----------------

static func refresh_period() -> int:
	return maxi(int(float(shop().get("route_refresh_h", 2)) * 3600.0), 60)


## сколько разных локаций предлагает компьютер (route_slots в data/base_shop.json)
static func route_slots() -> int:
	return maxi(int(shop().get("route_slots", 3)), 1)


## все готовые локации (без «скоро»), в порядке data/base_shop.json
static func route_pool() -> Array:
	var out := []
	for id in shop().get("routes", {}):
		if not shop().routes[id].get("soon", false):
			out.append(String(id))
	return out


## Новый набор предложений: route_slots разных локаций, случайно из всех готовых — без повторов. Если локаций
## больше, чем мест, набор не повторяет прошлый целиком: хотя бы одна локация — новая. Порядок карточек — как в
## data/base_shop.json.
static func _roll_offers(prev: Array = []) -> Array:
	var pool := route_pool()
	var n := mini(route_slots(), pool.size())
	var sh := pool.duplicate()
	sh.shuffle()
	var pick := sh.slice(0, n)
	var fresh := pool.filter(func(x): return not prev.has(x))
	if pool.size() > n and not fresh.is_empty() and pick.all(func(x): return prev.has(x)):
		pick[randi() % pick.size()] = fresh[randi() % fresh.size()]
	return pool.filter(func(x): return pick.has(x))


## набор в порядке: без повторов и без локаций, которых больше нет; не хватает до route_slots (добавили локацию
## обновлением игры) — дополняется сразу, не дожидаясь таймера
static func _fix_offers(cur: Array) -> Array:
	var pool := route_pool()
	var out := []
	for id in cur:
		if pool.has(String(id)) and not out.has(String(id)):
			out.append(String(id))
	out = out.slice(0, mini(route_slots(), pool.size()))
	if out.size() < mini(route_slots(), pool.size()):
		var add := pool.filter(func(x): return not out.has(x))
		add.shuffle()
		out.append_array(add.slice(0, mini(route_slots(), pool.size()) - out.size()))
	return pool.filter(func(x): return out.has(x))


## что показывать в компьютере: предложения (кроме пройденных с последнего сброса) и купленные, но ещё не
## пройденные маршруты (они переживают обновление)
static func routes_listed() -> Array:
	var out := offers().filter(func(x): return not (data.done as Array).has(String(x)))
	for id in data.routes:
		if not out.has(String(id)) and shop().get("routes", {}).has(String(id)):
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
		_reroll_all()
		dirty = true
	elif now >= nxt:
		# сброс: новый набор локаций (купленные и не пройденные маршруты остаются — см. routes_listed)
		nxt += ((now - nxt) / per + 1) * per
		data.offers = _roll_offers(data.offers)
		data.refreshes = int(data.get("refreshes", 0)) + 1
		data.done = []                          # пройденные снова доступны (если попали в новый набор)
		_reroll_all()                           # кластеры перезагрузились: на каждой локации — новые люди и твари
		dirty = true
	var fixed := _fix_offers(data.offers)
	if fixed != data.offers:
		data.offers = fixed
		dirty = true
	# новая локация (добавлена обновлением) — сразу в наборе: вместо случайной некупленной
	for id in route_pool():
		if (data.seen as Array).has(id):
			continue
		(data.seen as Array).append(id)
		var offs: Array = data.offers
		if not offs.has(id):
			var free := offs.filter(func(x): return route_state(String(x)) == "")
			if offs.size() < mini(route_slots(), route_pool().size()):
				offs.append(id)
			elif not free.is_empty():
				offs[offs.find(free[randi() % free.size()])] = id
			data.offers = route_pool().filter(func(x): return offs.has(x))
		dirty = true
	if dirty:
		data.routes_next = nxt
		save_state()
	return nxt - now


## посещение, прерванное закрытием игры (маршрут «active», а герой не на локации), считается законченным:
## маршрут закрыт. Вызывается с карты мира и из главного меню.
## Что сейчас на локации после перезагрузки (ULReload.roll): нет записи — разыгрывается сразу
static func reload_of(id: String) -> Dictionary:
	load_state()
	if not ULReload.has_place(id):
		return {}
	var r = data.reload.get(id)
	if not (r is Dictionary) or not r.has("pustysh"):
		r = ULReload.roll(id, _reload_rng())
		data.reload[id] = r
		save_state()
	return r


static var reload_seed := 0               ## проверки: своя случайность розыгрыша (0 — случайная)
static var _rr: RandomNumberGenerator


static func _reload_rng() -> RandomNumberGenerator:
	if _rr == null:
		_rr = RandomNumberGenerator.new()
		if reload_seed != 0:
			_rr.seed = reload_seed
		else:
			_rr.randomize()
	return _rr


## перезагрузка всех кластеров: новый розыгрыш везде, кроме купленных и идущих маршрутов (там — как было)
static func _reroll_all() -> void:
	for id in route_pool():
		if ULReload.has_place(String(id)) and route_state(String(id)) == "":
			data.reload[String(id)] = ULReload.roll(String(id), _reload_rng())


static func close_interrupted() -> void:
	load_state()
	for id in data.routes.keys():
		if route_state(String(id)) == "active":
			if not (data.done as Array).has(String(id)):
				(data.done as Array).append(String(id))
			data.routes.erase(id)
	save_state()


static func clock(sec: int) -> String:
	sec = maxi(sec, 0)
	return "%02d:%02d:%02d" % [sec / 3600, (sec / 60) % 60, sec % 60]


# ---------------- хранилище (сейфы на базе) ----------------

static func storage_level() -> int:
	load_state()
	return int(data.storage.level)


## ячейки сейфа k (1…6): тот же массив, что в сохранении базы — изменения сразу в нём (сохранять — save_state)
static func safe_cells(k: int) -> Array:
	load_state()
	if k < 1 or k > storage_level():
		return []
	return data.storage.safes["safe_%d" % k]


## Купить хранилище (уровень 0 → 1) или улучшить (+1 сейф). Каждый переход — upgrades.storage.price; новый сейф
## добавляется пустым, содержимое прежних не трогается. Ответ — как у buy_upgrade, err «max» — уже 6/6.
static func buy_storage(inv: ULInventory) -> Dictionary:
	load_state()
	var d: Dictionary = shop().get("upgrades", {}).get("storage", {})
	if d.is_empty():
		return {"ok": false, "err": "none", "miss": {}}
	var lv := storage_level()
	if lv >= STORAGE_MAX:
		return {"ok": false, "err": "max", "miss": {}}
	var miss := ULEconomy.missing(inv.wallet, d.price)
	if not miss.is_empty() or not inv.pay(d.price):
		return {"ok": false, "err": "money", "miss": miss}
	lv += 1
	data.storage.level = lv
	var arr := []
	arr.resize(SAFE_CELLS)
	if not data.storage.safes.has("safe_%d" % lv):
		data.storage.safes["safe_%d" % lv] = arr
	data.upgrades["storage"] = lv
	save_state()
	return {"ok": true, "err": "", "miss": {}}

