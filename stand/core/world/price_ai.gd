class_name ULPriceAI
extends RefCounted
## Координатор цен — «мини-ИИ» экономики. Сам ничего не выдумывает: у каждой цены в игре есть ориентир, который
## считается из самой игры, и коридор вокруг него (data/price_ai.json). Цена вышла из коридора — координатор
## возвращает её на ближайший край и пишет об этом в отчёт. Всё считается в споранах (курс — обмен ресурсов
## в компьютере базы: 1 горошина = 10 споранов и так далее).
##   Оружие      — ориентир по силе: урон × темп × дробины × √дальность × запас магазина; чем сильнее — тем дороже,
##                 цена за единицу силы не уходит от средней больше чем в band раз.
##   Патроны     — выстрелить столько, чтобы убить пустыша, не должно стоить дороже доли его добычи.
##   Лекарства   — цена за единицу здоровья в коридоре.
##   Маршруты    — доля от ожидаемой выручки вылазки (враги × их добыча + награда задания), не дешевле пола
##                 своего уровня опасности; маршрут опаснее — не дешевле маршрута безопаснее.
##   Продажа     — по редкости предмета; и не дороже доли того, за сколько этот же предмет можно купить:
##                 «купил у оружейника — продал барахольщику с прибылью» невозможно.
##   Улучшения   — в долях выручки первой вылазки (коровник).
## Рынок барахольщика: первые free штук одного товара за период он берёт по полной цене, дальше — всё дешевле
## (рынок насыщен), но не ниже min_k; со сбросом маршрутов спрос возвращается.
## Правки применяются при загрузке (fix_*), файлы данных не переписываются: числа в них — предложение.

const CFG := "res://data/price_ai.json"
static var _c := {}
static var report: Array = []            ## что поправлено при загрузке: [что, было, стало, почему]
static var _done := {}


static func cfg() -> Dictionary:
	if _c.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_c = d if d is Dictionary else {"on": false}
	return _c


static func on() -> bool:
	return bool(cfg().get("on", false))


## сколько споранов стоит единица ресурса (по цепочке обмена)
static func unit(res: String) -> float:
	var ch: Array = ULEconomy.chain()
	var i := ch.find(res)
	if i < 0:
		return 0.0
	var v := 1.0
	for k in range(i, ch.size() - 1):
		v *= float(ULEconomy.rate(String(ch[k])))
	return v


## цена {ресурс: сколько} → спораны
static func sp(price: Dictionary) -> float:
	var v := 0.0
	for r in price:
		v += unit(String(r)) * float(price[r])
	return v


## спораны → цена: до pea_from — споранами, дороже — горохом (как принято у оружейника)
static func to_price(v: float, like: Dictionary = {}) -> Dictionary:
	if like.has("pea") and not like.has("spore"):
		return {"pea": maxi(1, roundi(v / unit("pea")))}
	# крупные цены — круглые (до пяти споранов)
	if v >= 40.0:
		return {"spore": maxi(1, roundi(v / 5.0) * 5)}
	return {"spore": maxi(1, roundi(v))}


# ---------------- ориентиры ----------------

## сила оружия (условные единицы)
static func power(id: String) -> float:
	var d: Dictionary = ULItems.get_def(id)
	if not d.has("dmg"):
		return 0.0
	# урон в секунду × дальность × запас магазина × «останавливающее действие» (чем сильнее один выстрел, тем
	# ценнее: дробовик и снайперская винтовка стреляют редко, но наповал)
	var dps := float(d.dmg) * float(d.get("rate", 1.0))
	var rng := sqrt(maxf(float(d.get("range", 2.0)), 1.0) / 8.0)
	var mag := 0.75 + 0.25 * minf(float(d.get("mag", 10)), 60.0) / 30.0
	var stop := 1.0 + float(d.dmg) / 60.0
	return dps * rng * mag * stop * (1.15 if bool(d.get("auto", false)) else 1.0)


## средняя добыча с врага, в споранах
static func drop_value(kind: String) -> float:
	var v := 0.0
	for l in ULEnemy.KINDS.get(kind, {}).get("loot", []):
		var id := String(l[0])
		var each := unit(id)
		if each <= 0.0:
			each = sp(ULItems.get_def(id).get("price", {}))
		v += (float(l[1]) + float(l[2])) * 0.5 * (float(l[3]) if l.size() > 3 else 1.0) * each
	return v


## ожидаемая выручка вылазки: враги × добыча + награда задания, × богатство добычи (loot_k)
static func route_income(id: String) -> float:
	var path := "res://data/%s.json" % id
	if not FileAccess.file_exists(path):
		return 0.0
	var c = JSON.parse_string(FileAccess.get_file_as_string(path))
	if not (c is Dictionary):
		return 0.0
	var v := 0.0
	if c.has("pustysh"):
		v += (float(c.pustysh[0]) + float(c.pustysh[1])) * 0.5 * drop_value("infected")
	if c.has("lottery"):
		v += (float(c.lottery[0]) + float(c.lottery[1])) * 0.5 * drop_value("lottery")
	var rc: Array = c.get("ruber_chances", [])
	var rn := 0.0
	var rs := 0.0
	for i in rc.size():
		rn += float(i) * float(rc[i])
		rs += float(rc[i])
	if rs > 0.0:
		v += rn / rs * drop_value("ruber")
	for k in ["mur_ak", "mur_sg"]:
		if c.has(k) and c[k] is Array:
			v += (float(c[k][0]) + float(c[k][1])) * 0.5 * drop_value(k)
	v += sp(c.get("quest", {}).get("reward", {}))
	return v * float(cfg().get("route", {}).get("loot_k", {}).get(id, 1.0))


## за сколько (за штуку, в споранах) предмет можно купить дешевле всего: у оружейника или у барахольщика; 0 — нигде
static func cheapest_buy(id: String, shop: Dictionary) -> float:
	var best := 0.0
	for sec in shop:
		if not (shop[sec] is Array):
			continue
		for row in shop[sec]:
			if row is Array and row.size() >= 3 and String(row[0]) == id:
				var u := sp(row[2]) / maxf(float(row[1]), 1.0)
				best = u if best <= 0.0 else minf(best, u)
	for e in ULBase.shop().get("dealer", {}).get("stock", []):
		if String(e.id) == id:
			var u2 := sp(e.price) / maxf(float(e.get("lot", 1)), 1.0)
			best = u2 if best <= 0.0 else minf(best, u2)
	return best


# ---------------- правки при загрузке ----------------

const SHOP_FILE := "res://data/shop.json"
static var _arm := {}


## товар оружейника (data/shop.json) — уже согласованный; один на всю игру
static func armourer() -> Dictionary:
	if _arm.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(SHOP_FILE))
		_arm = d if d is Dictionary else {}
		fix_shop(_arm)
	return _arm


static func _note(what: String, was: float, now: float, why: String) -> void:
	report.append([what, was, now, why])


## Товар оружейника (data/shop.json): оружие — по силе, патроны и лекарства — по своим коридорам. Правит на месте.
static func fix_shop(shop: Dictionary, force := false) -> void:
	if not on() or (_done.has("shop") and not force):
		return
	_done["shop"] = true
	var wc: Dictionary = cfg().get("weapon", {})
	var band := float(wc.get("band", 2.0))
	var rows: Array = shop.get("weapons", [])
	# цена за единицу силы: медиана по всему оружию
	var ratios: Array = []
	for row in rows:
		var pw := power(String(row[0]))
		if pw > 0.0:
			ratios.append(sp(row[2]) / pow(pw, float(wc.get("pow", 1.0))))
	ratios.sort()
	if not ratios.is_empty():
		var med: float = ratios[ratios.size() / 2]
		for row in rows:
			var pw := power(String(row[0]))
			if pw <= 0.0:
				continue
			var ref := med * pow(pw, float(wc.get("pow", 1.0)))
			var was := sp(row[2])
			var now := clampf(was, ref / band, ref * band)
			if absf(now - was) >= 1.0:
				row[2] = to_price(now, row[2])
				_note("оружейник: %s" % String(ULItems.get_def(String(row[0])).n), was, sp(row[2]), "по силе оружия ориентир %d (коридор ×%.1f)" % [roundi(ref), band])
		# чем сильнее — тем не дешевле
		var order := rows.duplicate()
		order.sort_custom(func(a, b) -> bool: return power(String(a[0])) < power(String(b[0])))
		var floor_v := 0.0
		for row in order:
			if power(String(row[0])) <= 0.0:
				continue
			var was := sp(row[2])
			if was < floor_v * float(wc.get("order_slack", 0.8)):
				row[2] = to_price(floor_v * float(wc.get("order_slack", 0.8)), row[2])
				_note("оружейник: %s" % String(ULItems.get_def(String(row[0])).n), was, sp(row[2]), "сильнее соседа — не может стоить заметно дешевле")
			floor_v = maxf(floor_v, sp(row[2]))
	# патроны: убить пустыша купленными патронами — не дороже доли его добычи
	var ac: Dictionary = cfg().get("ammo", {})
	var hp := float(ULEnemy.KINDS.get("infected", {}).get("hp", 75))
	var cap := drop_value("infected") * float(ac.get("kill_share", 0.5))
	for row in shop.get("ammo", []):
		var aid := String(row[0])
		var dmg := 0.0
		for wid in ULItems.ITEMS:
			var wd: Dictionary = ULItems.ITEMS[wid]
			if String(wd.get("ammo", "")) == aid:
				dmg = maxf(dmg, float(wd.get("dmg", 0)) * float(wd.get("pellets", 1)))
		if dmg <= 0.0:
			continue
		var shots := ceilf(hp / dmg)
		var per := sp(row[2]) / maxf(float(row[1]), 1.0)
		if per * shots > cap and cap > 0.0:
			var was := sp(row[2])
			row[2] = to_price(maxf(1.0, floorf(cap / shots * float(row[1]))), row[2])
			_note("оружейник: %s" % String(ULItems.get_def(aid).n), was, sp(row[2]), "убить пустыша (%d выстр.) не должно стоить дороже %.1f спорана" % [int(shots), cap])
	# лекарства: цена за единицу здоровья
	var mc: Array = cfg().get("med", {}).get("per_hp", [0.05, 0.4])
	for row in shop.get("supplies", []):
		var heal := float(ULItems.get_def(String(row[0])).get("heal", 0)) + float(ULItems.get_def(String(row[0])).get("energy", 0)) * 0.25
		if heal < 10.0:
			continue
		var was := sp(row[2]) / maxf(float(row[1]), 1.0)
		var now := clampf(was, float(mc[0]) * heal, float(mc[1]) * heal)
		if absf(now - was) >= 1.0:
			row[2] = to_price(now * float(row[1]), row[2])
			_note("оружейник: %s" % String(ULItems.get_def(String(row[0])).n), was, now, "цена за единицу здоровья в коридоре %.2f–%.2f" % [float(mc[0]), float(mc[1])])


## Компьютер базы (data/base_shop.json): маршруты и улучшения. Правит на месте.
static func fix_base(base: Dictionary, force := false) -> void:
	if not on() or (_done.has("base") and not force):
		return
	_done["base"] = true
	var rc: Dictionary = cfg().get("route", {})
	var share: Array = rc.get("share", [0.1, 0.7])
	var floors: Dictionary = rc.get("level_floor", {})
	var routes: Dictionary = base.get("routes", {})
	for id in routes:
		var r: Dictionary = routes[id]
		if bool(r.get("soon", false)) or not r.has("price"):
			continue
		var inc := route_income(String(id))
		var was := sp(r.price)
		var lo := float(floors.get(str(int(r.get("level", 1))), 0.0))
		var now := was
		if inc > 0.0:
			now = clampf(now, maxf(lo, inc * float(share[0])), maxf(lo, inc * float(share[1])))
		else:
			now = maxf(now, lo)
		if absf(now - was) >= 1.0:
			r.price = to_price(now, r.price)
			_note("маршрут: %s" % String(r.get("n", id)), was, sp(r.price), "выручка вылазки около %d споранов, доля %.0f–%.0f %%, пол уровня %d" % [roundi(inc), float(share[0]) * 100.0, float(share[1]) * 100.0, int(lo)])
	# улучшения — в долях выручки первой вылазки
	var base_inc := maxf(route_income("cowshed"), 1.0)
	var ub: Array = cfg().get("upgrade", {}).get("share", [0.3, 4.0])
	for uid in base.get("upgrades", {}):
		var u: Dictionary = base.upgrades[uid]
		if not u.has("price"):
			continue
		var was := sp(u.price)
		var now := clampf(was, base_inc * float(ub[0]), base_inc * float(ub[1]))
		if absf(now - was) >= 1.0:
			u.price = to_price(now, u.price)
			_note("улучшение: %s" % String(u.get("n", uid)), was, sp(u.price), "в долях выручки первой вылазки (%d споранов)" % roundi(base_inc))
	# барахольщик не продаёт дешевле, чем сам покупает
	for e in base.get("dealer", {}).get("stock", []):
		var own := sp(ULItems.get_def(String(e.id)).get("price", {})) * float(e.get("lot", 1))
		var was := sp(e.price)
		if own > 0.0 and was < own * float(cfg().get("sale", {}).get("dealer_markup", 1.2)):
			e.price = to_price(ceilf(own * float(cfg().get("sale", {}).get("dealer_markup", 1.2))), e.price)
			_note("барахольщик продаёт: %s" % String(ULItems.get_def(String(e.id)).n), was, sp(e.price), "не дешевле, чем сам покупает")


## За сколько барахольщик берёт предмет (за штуку, в споранах, без учёта рынка): базовая цена — в коридоре редкости
## и не выше доли самой дешёвой покупки этого же предмета
static func sale_unit(id: String, shop: Dictionary = {}) -> int:
	if shop.is_empty():
		shop = armourer()
	var d: Dictionary = ULItems.get_def(id)
	var base := sp(d.get("price", {}))
	if base <= 0.0 or not on():
		return int(base)
	var v := base
	if String(d.get("kind", "")) != "quest":
		var bands: Dictionary = cfg().get("sale", {}).get("rarity", {})
		var b: Array = bands.get(String(d.get("rar", "common")), [1, 100000])
		v = clampf(v, float(b[0]), float(b[1]))
	var buy := cheapest_buy(id, shop)
	if buy > 0.0:
		v = minf(v, maxf(1.0, floorf(buy * float(cfg().get("sale", {}).get("resale_max", 0.6)))))
	return maxi(1, roundi(v))


## Рынок: сколько споранов барахольщик даст за n штук, если sold штук этого товара он уже купил за период
static func market_total(unit_sp: int, n: int, sold: int) -> int:
	var m: Dictionary = cfg().get("market", {})
	if not on() or unit_sp < int(m.get("from", 3)):
		return unit_sp * n
	var free := int(m.get("free", 12))
	var step := float(m.get("step", 0.03))
	var min_k := float(m.get("min_k", 0.6))
	var total := 0
	for i in n:
		var over := maxi(sold + i - free + 1, 0)
		total += maxi(1, roundi(float(unit_sp) * maxf(min_k, 1.0 - step * float(over))))
	return total


## текущая цена следующей штуки (для окна торговли)
static func market_unit(unit_sp: int, sold: int) -> int:
	return market_total(unit_sp, 1, sold)


# ---------------- отчёт ----------------

## Таблица всех цен: [раздел, что, цена в споранах, ориентир или коридор, вывод]
static func audit(shop: Dictionary) -> Array:
	var out: Array = []
	for row in shop.get("weapons", []):
		out.append(["оружие", String(ULItems.get_def(String(row[0])).n), sp(row[2]), "сила %d" % roundi(power(String(row[0]))), ""])
	for row in shop.get("ammo", []):
		out.append(["патроны", "%s × %d" % [String(ULItems.get_def(String(row[0])).n), int(row[1])], sp(row[2]), "", ""])
	for row in shop.get("supplies", []):
		out.append(["припасы", String(ULItems.get_def(String(row[0])).n), sp(row[2]), "", ""])
	var routes: Dictionary = ULBase.shop().get("routes", {})
	for id in routes:
		if routes[id].has("price"):
			var inc := route_income(String(id))
			out.append(["маршрут", String(routes[id].get("n", id)), sp(routes[id].price), "выручка ~%d" % roundi(inc), ("%.0f %% выручки" % (sp(routes[id].price) / inc * 100.0)) if inc > 0.0 else ""])
	for id in ULItems.catalog():
		var buy := cheapest_buy(String(id), shop)
		out.append(["продажа", String(ULItems.get_def(String(id)).n), float(sale_unit(String(id), shop)), ("купить можно за %.1f" % buy) if buy > 0.0 else String(ULItems.get_def(String(id)).get("rar", "")), ""])
	return out


## «вечные двигатели»: предметы, которые можно купить и тут же продать дороже (должно быть пусто)
static func loops(shop: Dictionary) -> Array:
	var bad: Array = []
	for id in ULItems.catalog():
		var buy := cheapest_buy(String(id), shop)
		if buy > 0.0 and float(sale_unit(String(id), shop)) > buy:
			bad.append([String(id), buy, sale_unit(String(id), shop)])
	return bad
