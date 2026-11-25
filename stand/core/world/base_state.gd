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
	_garage_norm()


# ---------------- гараж и машины (data/garage.json, ULCar) ----------------
# data.garage: level 0–3 (0 — не построен), fuel — литры в резервуаре топливной станции, cabinet — грузовой шкаф
# (30 ячеек), sel — выбранная машина, cars — машины по местам (ULCar.new_data: детали, бензин, багажник, турели).
# Первая машина (УАЗ-469) появляется вместе с гаражом; места 2 и 3 — под будущие машины (уровни 2/3 пока закрыты).

const GARAGE := "res://data/garage.json"
static var _gcfg := {}


static func garage_cfg() -> Dictionary:
	if _gcfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(GARAGE))
		_gcfg = d if d is Dictionary else {}
	return _gcfg


static func garage_max() -> int:
	return maxi((garage_cfg().get("levels", []) as Array).size() - 1, 0)


static func station_cap() -> float:
	return float(garage_cfg().get("fuel_station", {}).get("cap", 1000))


static func _garage_norm() -> void:
	data.erase("car")                       # запись машины до гаража (в сборки не попадала)
	if not (data.get("garage") is Dictionary):
		data["garage"] = {}
	var g: Dictionary = data.garage
	g["level"] = clampi(int(g.get("level", 0)), 0, garage_max())
	g["fuel"] = clampf(float(g.get("fuel", garage_cfg().get("fuel_station", {}).get("start", 0))), 0.0, station_cap())
	var cab = g.get("cabinet")
	if not (cab is Array):
		cab = []
	cab.resize(maxi(int(garage_cfg().get("cabinet_cells", 30)), cab.size()))
	for i in cab.size():
		if cab[i] != null and not (cab[i] is Dictionary):
			cab[i] = null
	g["cabinet"] = cab
	if not (g.get("cars") is Array):
		g["cars"] = []
	var list: Array = garage_cfg().get("cars", [])
	var slots := int((garage_cfg().get("levels", []) as Array)[g.level].get("cars", 0)) if int(g.level) > 0 else 0
	for i in mini(slots, list.size()):
		if (g.cars as Array).size() <= i:
			(g.cars as Array).append(ULCar.new_data(String(list[i].id)))
	for cd in g.cars:
		if cd is Dictionary:
			ULCar.norm_data(cd)
	g["sel"] = clampi(int(g.get("sel", 0)), 0, maxi((g.cars as Array).size() - 1, 0))


static func garage() -> Dictionary:
	load_state()
	return data.garage


static func garage_level() -> int:
	return int(garage().level)


## уровень гаража n (0…3): {n, cars, price?, locked?}
static func garage_lvl(n: int) -> Dictionary:
	var ls: Array = garage_cfg().get("levels", [])
	return ls[clampi(n, 0, ls.size() - 1)] if not ls.is_empty() else {}


## Купить гараж (0 → 1) или следующий уровень. Закрытый уровень (locked) не продаётся: err «locked».
## Ответ — как у buy_upgrade; err «max» — уже последний.
static func buy_garage(inv: ULInventory) -> Dictionary:
	var lv := garage_level()
	if lv >= garage_max():
		return {"ok": false, "err": "max", "miss": {}}
	var nx := garage_lvl(lv + 1)
	if bool(nx.get("locked", false)):
		return {"ok": false, "err": "locked", "miss": {}}
	var price: Dictionary = nx.get("price", {})
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty() or not inv.pay(price):
		return {"ok": false, "err": "money", "miss": miss}
	data.garage.level = lv + 1
	data.upgrades["garage"] = lv + 1
	_garage_norm()
	save_state()
	return {"ok": true, "err": "", "miss": {}}


## машины гаража (сохранения ULCar) по местам
static func cars() -> Array:
	return garage().cars


## выбранная машина; {} — гаража нет
static func car_data() -> Dictionary:
	var cs := cars()
	if cs.is_empty():
		return {}
	return cs[clampi(int(data.garage.sel), 0, cs.size() - 1)]


static func cabinet() -> Array:
	return garage().cabinet


## литры в резервуаре топливной станции
static func station_fuel() -> float:
	return float(garage().fuel)


static func set_station_fuel(l: float) -> void:
	garage()["fuel"] = clampf(l, 0.0, station_cap())


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
		ULPriceAI.fix_base(_shop)             # координатор цен: маршруты и улучшения — в своих коридорах
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
	if not (r is Dictionary):
		return ""
	if String(r.get("state", "")) == "active" and float(r.get("end", 0)) > 0.0 and Time.get_unix_time_from_system() >= float(r.end):
		# срок кластера вышел, пока героя там не было (или игра была закрыта): локация пропадает с карты
		if not (data.done as Array).has(id):
			(data.done as Array).append(id)
		data.routes.erase(id)
		visit_clear(id)
		save_state()
		return ""
	return String(r.get("state", ""))


## Идущее посещение временного кластера. Маршрут «active» хранит срок перезагрузки кластера (end, unix-время),
## начало (start) и случайность посещения (seed). Пока срок не вышел, локация остаётся на карте: можно уйти и
## вернуться — таймер идёт, убитые не оживают, взятое не появляется заново (состояние — visit_*). Срок вышел —
## маршрут закрывается сам (route_state).
static var _visits := {}


static func route_info(id: String) -> Dictionary:
	return data.routes[id] if route_state(id) != "" else {}


## сколько секунд до перезагрузки кластера идущего посещения (0 — срок не назначен или вышел)
static func route_left(id: String) -> int:
	var r := route_info(id)
	if String(r.get("state", "")) != "active" or float(r.get("end", 0)) <= 0.0:
		return 0
	return maxi(int(ceil(float(r.end) - Time.get_unix_time_from_system())), 0)


## посещение началось: срок, начало и случайность записаны при маршруте
static func route_begin(id: String, seed_n: int, start: float, end: float) -> void:
	load_state()
	var keep_map := has_map(id)
	data.routes[id] = {"state": "active", "at": int(start), "seed": seed_n, "start": start, "end": end}
	if keep_map:
		data.routes[id]["map"] = true
	visit_clear(id)
	save_state()


## оставлять ли локацию на карте после ухода (why: left — ушёл за край, menu — вышел в меню, dead — погиб)
static func route_keep(why: String) -> bool:
	return bool((shop().get("route_keep", {}) as Dictionary).get(why, false))


static func visit_path(id: String) -> String:
	return "user://visit_%s.json" % id


## состояние посещения (кто убит, что лежит, что в тайниках) — отдельным файлом на локацию; в проверках — в памяти,
## но тем же путём через JSON (числа и ключи приходят такими же, как с диска)
static func visit_save(id: String, st: Dictionary) -> void:
	if memory_only:
		_visits[id] = JSON.parse_string(JSON.stringify(st))
		return
	_visits.erase(id)
	write_json(visit_path(id), st)


static func visit_load(id: String) -> Dictionary:
	if memory_only:
		return _visits.get(id, {})
	if FileAccess.file_exists(visit_path(id)):
		var d = JSON.parse_string(FileAccess.get_file_as_string(visit_path(id)))
		if d is Dictionary:
			return d
	return {}


static func visit_clear(id: String) -> void:
	_visits.erase(id)
	if not memory_only and FileAccess.file_exists(visit_path(id)):
		DirAccess.remove_absolute(ProjectSettings.globalize_path(visit_path(id)))


## новая игра: состояния всех посещений — прочь
static func visits_wipe() -> void:
	_visits.clear()
	if memory_only:
		return
	for id in route_pool():
		if FileAccess.file_exists(visit_path(String(id))):
			DirAccess.remove_absolute(ProjectSettings.globalize_path(visit_path(String(id))))


static func set_route(id: String, state: String) -> void:
	load_state()
	if state == "":
		if route_state(id) == "active" and not (data.done as Array).has(id):
			(data.done as Array).append(id)      # посещение окончено — локация пройдена до следующего сброса
		data.routes.erase(id)
		visit_clear(id)
	elif route_state(id) == state:
		return                                     # уже так: срок и случайность идущего посещения не трогаются
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
	# случайная часть набора (route_slots) — из незакреплённых; закреплённые маршруты идут сверх неё: список в
	# компьютере прокручивается, и постоянные локации не вытесняют сменные
	var pool := route_pool()
	var pins := pinned()
	var free := pool.filter(func(x): return not pins.has(x))
	var n := mini(route_slots(), free.size())
	var sh := free.duplicate()
	sh.shuffle()
	var pick := sh.slice(0, n)
	var fresh := free.filter(func(x): return not prev.has(x))
	if free.size() > n and not fresh.is_empty() and pick.all(func(x): return prev.has(x)):
		pick[randi() % pick.size()] = fresh[randi() % fresh.size()]
	pick.append_array(pins)
	return pool.filter(func(x): return pick.has(x))


## набор в порядке: без повторов и без локаций, которых больше нет; не хватает до route_slots (добавили локацию
## обновлением игры) — дополняется сразу, не дожидаясь таймера
static func _fix_offers(cur: Array) -> Array:
	var pool := route_pool()
	var pins := pinned()
	var free := pool.filter(func(x): return not pins.has(x))
	var out := []
	for id in cur:
		if free.has(String(id)) and not out.has(String(id)):
			out.append(String(id))
	out = out.slice(0, mini(route_slots(), free.size()))
	if out.size() < mini(route_slots(), free.size()):
		var add := free.filter(func(x): return not out.has(x))
		add.shuffle()
		out.append_array(add.slice(0, mini(route_slots(), free.size()) - out.size()))
	out.append_array(pins)
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
	var of: Array = data.offers
	var pins := pinned()
	var free_n := of.filter(func(x): return not pins.has(x)).size()
	if pins.any(func(x): return not of.has(x)) or free_n < mini(route_slots(), route_pool().size() - pins.size()):
		# закреплённый маршрут появился позже, чем был разыгран набор (обновление), или сменных меньше положенного
		# (раньше закреплённые занимали их места): набор дополняется сразу
		data.offers = _fix_offers(of)
		save_state()
	return data.offers


## сколько минут живёт кластер: по уровню опасности маршрута (level_minutes в data/base_shop.json), иначе — def
static func minutes_for(id: String, def: float) -> float:
	var r: Dictionary = shop().get("routes", {}).get(id, {})
	var lm: Dictionary = shop().get("level_minutes", {})
	var key := str(int(r.get("level", 0)))
	return float(lm[key]) if lm.has(key) else def


## закреплённые маршруты ("pin": true в data/base_shop.json) — всегда среди предложений компьютера
static func pinned() -> Array:
	return route_pool().filter(func(x): return bool(shop().routes[x].get("pin", false)))


## сменная часть набора — без закреплённых маршрутов
static func offers_free() -> Array:
	var pins := pinned()
	return offers().filter(func(x): return not pins.has(x))


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


## Посещение, прерванное закрытием игры. Срок кластера ещё идёт — локация остаётся на карте, можно вернуться
## (вышел срок — её закроет route_state). Вход не состоялся (игра закрылась на загрузке, срок не назначен) —
## маршрут снова «куплен».
static func close_interrupted() -> void:
	load_state()
	var dirty := false
	for id in data.routes.keys():
		if route_state(String(id)) == "active" and float((data.routes[id] as Dictionary).get("end", 0)) <= 0.0:
			data.routes[id]["state"] = "bought"
			dirty = true
	if dirty:
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

