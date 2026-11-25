class_name ULDealer
extends RefCounted
## Барахольщик (Кузьмич у крыльца): покупает у героя всё, у чего в каталоге есть цена (хлам, минералы, технический
## хлам, инструменты, запчасти — ULItems.catalog), по базовой цене за штуку; продаёт свой товар (data/base_shop.json →
## dealer.stock: что, сколько в лоте, цена лота, сколько лотов) и выкупленное у героя — в buy_k раз дороже.
## Запас и выкуп обновляются при сбросе маршрутов (тот же счётчик ULBase.data.refreshes). Состояние — ULBase.data.dealer,
## сохраняется вместе с базой. Здесь только правила сделки; окно — ULDealerUI.

static func cfg() -> Dictionary:
	return ULBase.shop().get("dealer", {})


## цена, по которой барахольщик покупает n штук у героя ({} — не берёт)
## Цену согласует координатор (ULPriceAI): коридор редкости, не дороже доли покупной цены; рынок — первые free
## штук товара за период по полной цене, дальше дешевле (сколько уже продано — в состоянии барахольщика).
static func sell_price(id: String, n := 1) -> Dictionary:
	var p: Dictionary = ULItems.get_def(id).get("price", {})
	if p.is_empty():
		return {}
	var base := ULPriceAI.sp(p)
	if not ULPriceAI.on():
		var out := {}
		for r in p:
			out[r] = int(p[r]) * n
		return out
	var unit := ULPriceAI.sale_unit(id)
	var total := ULPriceAI.market_total(unit, n, sold(id))
	if float(unit) == base and total == unit * n and not p.has("spore"):
		# цена не тронута и рынок не насыщен — в тех же ресурсах, что в каталоге (редкий минерал — за горошину)
		var same := {}
		for r in p:
			same[r] = int(p[r]) * n
		return same
	return {"spore": total}


## сколько штук этого товара барахольщик уже купил у героя за период
static func sold(id: String) -> int:
	return int((_state().get("sold", {}) as Dictionary).get(id, 0))


## состояние запаса; при новом сбросе маршрутов — пополнение и выкуп с нуля
static func _state() -> Dictionary:
	ULBase.load_state()
	var gen := int(ULBase.data.get("refreshes", 0))
	var st = ULBase.data.get("dealer")
	if not (st is Dictionary) or int(st.get("gen", -1)) != gen:
		var left := {}
		for e in cfg().get("stock", []):
			left[String(e.id)] = int(e.qty)
		st = {"gen": gen, "left": left, "buyback": {}, "sold": {}}
		ULBase.data["dealer"] = st
	return st


## что можно продать: [{id, n}] по карманам и рюкзаку (надетое в слотах не продаётся), по категориям
static func sellable(inv: ULInventory) -> Array:
	var cat := ULItems.catalog()
	var by := {}
	for src in ["pockets", "pack"]:
		for it in inv.cells(src):
			if it != null and cat.has(String(it.id)):
				by[String(it.id)] = int(by.get(String(it.id), 0)) + int(it.get("n", 1))
	var order := ["tech", "mineral", "parts", "tool"]
	var out: Array = []
	for id in by:
		out.append({"id": id, "n": int(by[id]), "price": sell_price(id), "cat": String(cat[id].cat)})
	out.sort_custom(func(a, b) -> bool:
		var ka := order.find(String(a.cat))
		var kb := order.find(String(b.cat))
		if ka != kb:
			return (ka if ka >= 0 else 9) < (kb if kb >= 0 else 9)
		return String(ULItems.get_def(String(a.id)).n) < String(ULItems.get_def(String(b.id)).n))
	return out


## что продаёт барахольщик: [{id, lot, price (за лот), left (лотов), kind: "stock" | "buyback"}]
static func stock() -> Array:
	var st := _state()
	var out: Array = []
	for e in cfg().get("stock", []):
		out.append({"id": String(e.id), "lot": int(e.get("lot", 1)), "price": e.price, "left": int(st.left.get(String(e.id), 0)), "kind": "stock"})
	var k := float(cfg().get("buy_k", 2.0))
	for id in st.buyback:
		if int(st.buyback[id]) <= 0:
			continue
		var p := {}
		for r in sell_price(String(id)):
			p[r] = maxi(1, int(ceil(float(sell_price(String(id))[r]) * k)))
		out.append({"id": String(id), "lot": 1, "price": p, "left": int(st.buyback[id]), "kind": "buyback"})
	return out


static func _find(id: String, kind: String) -> Dictionary:
	for s in stock():
		if String(s.id) == id and String(s.kind) == kind:
			return s
	return {}


## продать n штук: ресурсы — в кошелёк, проданное барахольщик выставляет на выкуп
static func sell(inv: ULInventory, id: String, n: int) -> Dictionary:
	var price := sell_price(id, n)
	if price.is_empty() or not ULItems.catalog().has(id):
		return {"ok": false, "err": "no_buy"}
	if n <= 0 or inv.count(id) < n:
		return {"ok": false, "err": "not_enough"}
	inv.consume(id, n)
	for r in price:
		inv.wallet[r] = int(inv.wallet.get(r, 0)) + int(price[r])
	var st := _state()
	st.buyback[id] = int(st.buyback.get(id, 0)) + n
	if not st.has("sold"):
		st["sold"] = {}
	st.sold[id] = int(st.sold.get(id, 0)) + n
	ULBase.save_state()
	return {"ok": true, "got": price}


## сколько штук предмета влезет в карманы и рюкзак (оружие — ещё и в пустой слот)
static func room(inv: ULInventory, id: String) -> int:
	var mx := ULItems.stack(id)
	var r := 0
	for src in ["pockets", "pack"]:
		for c in inv.cells(src):
			if c == null:
				r += mx
			elif mx > 1 and String(c.id) == id and not c.has("mag") and not c.has("dur"):
				r += maxi(mx - int(c.n), 0)
	var sl := ULItems.slot_of({"id": id})
	if sl in ["pistol", "primary"] and inv.get(sl) == null:
		r += 1
	return r


## купить lots лотов товара (kind — "stock" или "buyback"): проверка запаса, ресурсов и места; всё или ничего
static func buy(inv: ULInventory, id: String, lots: int, kind := "stock") -> Dictionary:
	var s := _find(id, kind)
	if s.is_empty() or lots <= 0:
		return {"ok": false, "err": "none"}
	if int(s.left) < lots:
		return {"ok": false, "err": "stock"}
	var price := {}
	for r in s.price:
		price[r] = int(s.price[r]) * lots
	var miss := ULEconomy.missing(inv.wallet, price)
	if not miss.is_empty():
		return {"ok": false, "err": "money", "miss": miss}
	var n := int(s.lot) * lots
	if room(inv, id) < n:
		return {"ok": false, "err": "space"}
	inv.pay(price)
	var left := n
	if ULItems.stack(id) > 1:
		left = inv.add(ULItems.make(id, n))
	else:
		for i in n:
			left -= 1 if inv.add(ULItems.make(id, 1)) == 0 else 0
	var st := _state()
	if kind == "stock":
		st.left[id] = int(st.left.get(id, 0)) - lots
	else:
		st.buyback[id] = int(st.buyback.get(id, 0)) - lots
	ULBase.save_state()
	return {"ok": left == 0, "err": "" if left == 0 else "space", "paid": price, "n": n}
