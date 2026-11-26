class_name ULGarageOps
extends RefCounted
## Правила гаража без окон (их зовут окна ULGarageUI, ULVehUI и проверки): улучшение деталей машины за горох,
## ремонт и замена деталей, покупка, установка и снятие турелей, загрузка боеприпасов в турель, топливо через
## канистры (резервуар гаража ↔ канистра ↔ бак машины). cd — сохранение машины (ULBase.car_data, ULCar.new_data).
## Ответы — {ok, err, miss?, …}; err: max, money, junk, owned, none, full, empty, cap, no_turret.
## Цены и числа — data/car.json и data/garage.json (предложение, не утверждённый баланс).


# ---------------- детали ----------------

static func lvl(cd: Dictionary, cat: String) -> int:
	return int((cd.parts as Dictionary).get(cat, {}).get("lvl", 0))


## цена следующего уровня детали ({} — уже последний)
static func up_price(cd: Dictionary, cat: String) -> Dictionary:
	var n := lvl(cd, cat)
	if n >= ULCar.max_lvl(cat):
		return {}
	return ULCar.lvl_cfg(cat, n + 1).get("price", {})


## улучшить деталь на уровень: новая деталь — с полной прочностью; багажник растёт (вещи остаются)
static func upgrade(inv: ULInventory, cd: Dictionary, cat: String) -> Dictionary:
	var n := lvl(cd, cat)
	if n >= ULCar.max_lvl(cat):
		return {"ok": false, "err": "max"}
	var price := up_price(cd, cat)
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty() or not inv.pay(price):
		return {"ok": false, "err": "money", "miss": miss}
	var p: Dictionary = cd.parts[cat]
	p["lvl"] = n + 1
	p["own"] = maxi(int(p.get("own", 0)), n + 1)
	var lc := ULCar.lvl_cfg(cat, n + 1)
	if lc.has("hp"):
		p["hp"] = float(lc.hp)
	ULCar.norm_data(cd)
	ULBase.save_state()
	return {"ok": true, "err": ""}


## прочность детали: [сейчас, наибольшая]; у багажника прочности нет — [-1, -1]
static func part_hp(cd: Dictionary, cat: String) -> Vector2:
	var p: Dictionary = cd.parts.get(cat, {})
	var lc := ULCar.lvl_cfg(cat, int(p.get("lvl", 0)))
	if not lc.has("hp"):
		return Vector2(-1, -1)
	return Vector2(float(p.get("hp", lc.hp)), float(lc.hp))


## ремонт: за каждые начатые 10 % прочности — repair.per_10 (× (1 + 0.5·уровень), разрушенная — × broken_k) и хлам
static func repair_cost(cd: Dictionary, cat: String) -> Dictionary:
	var hv := part_hp(cd, cat)
	if hv.y <= 0.0 or hv.x >= hv.y - 0.01:
		return {}
	return _repair_cost(hv, lvl(cd, cat))


static func _repair_cost(hv: Vector2, level: int) -> Dictionary:
	var rc: Dictionary = ULCar.cfg().get("repair", {})
	var steps := int(ceil((hv.y - hv.x) / hv.y * 10.0 - 0.001))
	var k := (1.0 + 0.5 * level) * (float(rc.get("broken_k", 2.0)) if hv.x <= 0.0 else 1.0)
	var price := {}
	var per: Dictionary = rc.get("per_10", {"spore": 2})
	for r in per:
		price[r] = int(ceil(float(per[r]) * steps * k))
	return {"price": price, "junk": int(ceil(float(rc.get("junk_per_10", 1)) * steps * k))}


static func _pay(inv: ULInventory, cost: Dictionary) -> Dictionary:
	var price: Dictionary = cost.get("price", {})
	var junk := int(cost.get("junk", 0))
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty():
		return {"ok": false, "err": "money", "miss": miss}
	if inv.count("junk") < junk:
		return {"ok": false, "err": "junk", "miss": {"junk": junk - inv.count("junk")}}
	inv.pay(price)
	if junk > 0:
		inv.consume("junk", junk)
	return {"ok": true, "err": ""}


## отремонтировать деталь до полной прочности (уровень не меняется)
static func repair(inv: ULInventory, cd: Dictionary, cat: String) -> Dictionary:
	var cost := repair_cost(cd, cat)
	if cost.is_empty():
		return {"ok": false, "err": "full"}
	var r := _pay(inv, cost)
	if not r.ok:
		return r
	cd.parts[cat]["hp"] = part_hp(cd, cat).y
	ULBase.save_state()
	return {"ok": true, "err": "", "paid": cost}


## заменить деталь новой того же уровня: цена уровня (у заводской — replace0)
static func replace_price(cd: Dictionary, cat: String) -> Dictionary:
	var n := lvl(cd, cat)
	if n == 0:
		return ULCar.cfg().get("replace0", {}).get(cat, ULCar.cfg().get("replace0", {}).get("_", {"spore": 15}))
	return ULCar.lvl_cfg(cat, n).get("price", {})


static func replace(inv: ULInventory, cd: Dictionary, cat: String) -> Dictionary:
	var hv := part_hp(cd, cat)
	if hv.y <= 0.0:
		return {"ok": false, "err": "none"}
	var r := _pay(inv, {"price": replace_price(cd, cat)})
	if not r.ok:
		return r
	cd.parts[cat]["hp"] = hv.y
	ULBase.save_state()
	return {"ok": true, "err": ""}


# ---------------- турели ----------------

## купить турель: она появляется в гараже и сразу встаёт на крышу (прежняя — снимается, остаётся своей:
## с боезапасом и прочностью). Вторую такую же не купить.
static func turret_buy(inv: ULInventory, cd: Dictionary, t: String) -> Dictionary:
	var tc := ULCar.turret_cfg(t)
	if tc.is_empty():
		return {"ok": false, "err": "none"}
	if (cd.turrets as Dictionary).has(t):
		return {"ok": false, "err": "owned"}
	var price: Dictionary = tc.get("price", {})
	# запчасти для турелей — из ящиков Базы Внешников (ULCrates): чем сложнее турель, тем выше уровень запчастей
	var pmiss := turret_parts_missing(inv, t)
	if not pmiss.is_empty():
		return {"ok": false, "err": "parts", "miss": pmiss}
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty() or not inv.pay(price):
		return {"ok": false, "err": "money", "miss": miss}
	var need: Dictionary = tc.get("parts", {})
	for pid in need:
		inv.consume(String(pid), int(need[pid]))
	cd.turrets[t] = {"ammo": 0, "hp": float(tc.get("hp", 200))}
	cd["turret"] = t
	ULBase.save_state()
	return {"ok": true, "err": ""}


## каких запчастей не хватает на турель t: {предмет: сколько ещё нужно}; пусто — хватает
static func turret_parts_missing(inv: ULInventory, t: String) -> Dictionary:
	var out := {}
	var need: Dictionary = ULCar.turret_cfg(t).get("parts", {})
	for pid in need:
		var lack := int(need[pid]) - inv.count(String(pid))
		if lack > 0:
			out[String(pid)] = lack
	return out


## запчасти на турель одной строкой: «I ур. ×4, II ур. ×3» (have — показать, сколько при себе)
static func turret_parts_text(inv: ULInventory, t: String) -> String:
	var need: Dictionary = ULCar.turret_cfg(t).get("parts", {})
	var parts: Array = []
	for pid in need:
		var lv := String(pid).trim_prefix("turret_part_")
		parts.append("%s ур. %d/%d" % [{"1": "I", "2": "II", "3": "III"}.get(lv, lv), mini(inv.count(String(pid)), int(need[pid])), int(need[pid])])
	return ", ".join(parts)


## поставить на крышу свою (купленную) турель; другая снимается и хранится в гараже со своим состоянием
static func turret_install(cd: Dictionary, t: String) -> Dictionary:
	if not (cd.turrets as Dictionary).has(t):
		return {"ok": false, "err": "none"}
	cd["turret"] = t
	ULBase.save_state()
	return {"ok": true, "err": ""}


static func turret_remove(cd: Dictionary) -> Dictionary:
	if String(cd.get("turret", "")) == "":
		return {"ok": false, "err": "no_turret"}
	cd["turret"] = ""
	ULBase.save_state()
	return {"ok": true, "err": ""}


static func turret_repair_cost(cd: Dictionary, t: String) -> Dictionary:
	var st: Dictionary = (cd.turrets as Dictionary).get(t, {})
	if st.is_empty():
		return {}
	var mx := float(ULCar.turret_cfg(t).get("hp", 200))
	if float(st.get("hp", mx)) >= mx - 0.01:
		return {}
	return _repair_cost(Vector2(float(st.get("hp", mx)), mx), 1)


static func turret_repair(inv: ULInventory, cd: Dictionary, t: String) -> Dictionary:
	var cost := turret_repair_cost(cd, t)
	if cost.is_empty():
		return {"ok": false, "err": "full"}
	var r := _pay(inv, cost)
	if not r.ok:
		return r
	cd.turrets[t]["hp"] = float(ULCar.turret_cfg(t).get("hp", 200))
	ULBase.save_state()
	return {"ok": true, "err": ""}


## загрузить боеприпасы установленной турели из инвентаря героя (до полного боекомплекта); ответ n — сколько
static func ammo_load(inv: ULInventory, cd: Dictionary) -> Dictionary:
	var t := String(cd.get("turret", ""))
	if t == "":
		return {"ok": false, "err": "no_turret"}
	var tc := ULCar.turret_cfg(t)
	var st: Dictionary = cd.turrets[t]
	var room := int(tc.get("cap", 0)) - int(st.get("ammo", 0))
	if room <= 0:
		return {"ok": false, "err": "full"}
	var aid := String(tc.get("ammo", ""))
	if inv.count(aid) <= 0:
		return {"ok": false, "err": "empty"}
	var n := inv.consume(aid, room)
	st["ammo"] = int(st.get("ammo", 0)) + n
	ULBase.save_state()
	return {"ok": n > 0, "err": "", "n": n}


# ---------------- топливо: канистры ----------------

static func can_cap() -> float:
	return float(ULBase.garage_cfg().get("canister", {}).get("cap", 20))


## все канистры героя (карманы и рюкзак): [{src, i, it}]
static func canisters(inv: ULInventory) -> Array:
	var out := []
	for src in ["pockets", "pack"]:
		var cells: Array = inv.cells(src)
		for i in cells.size():
			var c = cells[i]
			if c != null and String(c.id) == "canister":
				out.append({"src": src, "i": i, "it": c})
	return out


static func fuel_of(it: Dictionary) -> float:
	return float(it.get("fuel", 0.0))


## слить канистру в резервуар гаража (сколько влезет); n — литров
static func pour_to_station(it: Dictionary) -> Dictionary:
	var l := fuel_of(it)
	if l <= 0.0:
		return {"ok": false, "err": "empty"}
	var room := ULBase.station_cap() - ULBase.station_fuel()
	if room <= 0.01:
		return {"ok": false, "err": "full"}
	var n := minf(l, room)
	it["fuel"] = l - n
	ULBase.set_station_fuel(ULBase.station_fuel() + n)
	ULBase.save_state()
	return {"ok": true, "err": "", "n": n}


## наполнить канистру из резервуара (сколько есть и сколько влезет)
static func fill_from_station(it: Dictionary) -> Dictionary:
	var room := can_cap() - fuel_of(it)
	if room <= 0.01:
		return {"ok": false, "err": "full"}
	var have := ULBase.station_fuel()
	if have <= 0.01:
		return {"ok": false, "err": "empty"}
	var n := minf(room, have)
	it["fuel"] = fuel_of(it) + n
	ULBase.set_station_fuel(have - n)
	ULBase.save_state()
	return {"ok": true, "err": "", "n": n}


## залить канистру в бак машины
static func pour_to_car(it: Dictionary, cd: Dictionary) -> Dictionary:
	var l := fuel_of(it)
	if l <= 0.0:
		return {"ok": false, "err": "empty"}
	var room := ULCar.c("fuel_tank", 60.0) - float(cd.get("fuel", 0.0))
	if room <= 0.01:
		return {"ok": false, "err": "full"}
	var n := minf(l, room)
	it["fuel"] = l - n
	cd["fuel"] = float(cd.get("fuel", 0.0)) + n
	ULBase.save_state()
	return {"ok": true, "err": "", "n": n}


# ---------------- для окон ----------------

## характеристики машины для окна: прочность, скорость, багажник, бак
static func stats(cd: Dictionary) -> Dictionary:
	var b := part_hp(cd, "body")
	return {"hp": b.x, "hp_max": b.y, "kmh": float(ULCar.lvl_cfg("engine", lvl(cd, "engine")).get("kmh", 65)),
		"cells": int(ULCar.lvl_cfg("trunk", lvl(cd, "trunk")).get("cells", 30)), "fuel": float(cd.get("fuel", 0.0)), "tank": ULCar.c("fuel_tank", 60.0)}


static func err_text(r: Dictionary) -> String:
	match String(r.get("err", "")):
		"money", "junk":
			return "Не хватает: " + ULEconomy.list_text(r.get("miss", {})).replace("junk", "хлам")
		"parts":
			var ps: Array = []
			for pid in r.get("miss", {}):
				ps.append("%s ×%d" % [String(ULItems.get_def(String(pid)).get("n", pid)), int(r.miss[pid])])
			return "Не хватает запчастей (они в ящиках Базы Внешников): " + ", ".join(ps)
		"max":
			return "Уже последний уровень"
		"owned":
			return "Эта турель уже есть — её можно поставить"
		"full":
			return "Уже полностью"
		"empty":
			return "Пусто"
		"no_turret":
			return "Оружейный модуль не установлен"
	return "Нельзя"


## ремкомплект (предмет car_kit): чинит самую побитую деталь на долю heal её прочности. Вернёт {ok, cat, err}
static func use_kit(inv: ULInventory, cd: Dictionary) -> Dictionary:
	if inv.count("car_kit") <= 0:
		return {"ok": false, "err": "none"}
	var best := ""
	var worst := 0.999
	for k in ULCar.PARTS:
		var hv := part_hp(cd, k)
		if hv.y > 0.0 and hv.x / hv.y < worst:
			worst = hv.x / hv.y
			best = k
	if best == "":
		return {"ok": false, "err": "full"}
	var hv2 := part_hp(cd, best)
	inv.consume("car_kit", 1)
	cd.parts[best]["hp"] = minf(hv2.y, hv2.x + hv2.y * float(ULItems.get_def("car_kit").get("heal", 0.25)))
	ULBase.save_state()
	return {"ok": true, "cat": best, "err": ""}
