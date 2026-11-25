class_name ULEconomy
extends RefCounted
## Экономика игры. Ресурсы — один кошелёк героя (ULInventory.wallet: спораны, горох, три жемчужины): его же
## показывают окошко «Ресурсы» в инвентаре, торговля у оружейника и компьютер базы, туда же идёт добыча с тел.
## Здесь — обмен ресурсов по цепочке «белая ⇄ красная ⇄ чёрная жемчужина ⇄ горох ⇄ спораны» (курсы —
## data/base_shop.json → exchange) и русские подписи количеств. Только целые числа, без комиссий.
##   «Купить» — получить n штук старшего ресурса пары, отдав n × курс младшего;
##   «Продать» — отдать n штук старшего, получив n × курс младшего.

const NAMES := {
	# [один (им.), один (вин.), 2–4, 5+]
	"spore": ["споран", "споран", "спорана", "споранов"],
	"pea": ["горошина", "горошину", "горошины", "горошин"],
	"pearl_black": ["чёрная жемчужина", "чёрную жемчужину", "чёрные жемчужины", "чёрных жемчужин"],
	"pearl_red": ["красная жемчужина", "красную жемчужину", "красные жемчужины", "красных жемчужин"],
	"pearl_white": ["белая жемчужина", "белую жемчужину", "белые жемчужины", "белых жемчужин"],
}


static func _cfg() -> Dictionary:
	return ULBase.shop().get("exchange", {})


static func chain() -> Array:
	return _cfg().get("chain", ["pearl_white", "pearl_red", "pearl_black", "pea", "spore"])


static func max_deal() -> int:
	return int(_cfg().get("max_deal", 9999))


## курс пары, где hi — старший: сколько младшего за 1 hi; 0 — у hi нет младшего соседа
static func rate(hi: String) -> int:
	var i := chain().find(hi)
	var r: Array = _cfg().get("rates", [3, 3, 5, 10])
	return int(r[i]) if i >= 0 and i < r.size() and i < chain().size() - 1 else 0


static func lower(id: String) -> String:
	var i := chain().find(id)
	return String(chain()[i + 1]) if i >= 0 and i < chain().size() - 1 else ""


static func higher(id: String) -> String:
	var i := chain().find(id)
	return String(chain()[i - 1]) if i > 0 else ""


## условия сделки: {give, give_n, get, get_n}; пусто — пары нет или n вне 1…max_deal
static func quote(mode: String, hi: String, n: int) -> Dictionary:
	var r := rate(hi)
	if r <= 0 or n <= 0 or n > max_deal():
		return {}
	var lo := lower(hi)
	if mode == "buy":
		return {"give": lo, "give_n": n * r, "get": hi, "get_n": n}
	if mode == "sell":
		return {"give": hi, "give_n": n, "get": lo, "get_n": n * r}
	return {}


## больше скольких штук не обменять при таком кошельке (для кнопки «Максимум»)
static func max_n(wallet: Dictionary, mode: String, hi: String) -> int:
	var r := rate(hi)
	if r <= 0:
		return 0
	var n := int(wallet.get(lower(hi), 0)) / r if mode == "buy" else int(wallet.get(hi, 0))
	return mini(n, max_deal())


## Чего не хватает на цену {ресурс: сколько}: {ресурс: недостача}; пусто — хватает. Младшие ресурсы идут в счёт
## старших по курсу обмена (спораны → горох → жемчуг): цена в горохе, гороха нет, а споранов достаточно — хватает,
## при оплате они обменяются сами (settle). Наоборот игра без спроса не меняет: жемчужину на горох не разобьёт.
static func missing(wallet: Dictionary, price: Dictionary) -> Dictionary:
	return settle(wallet, price).miss


## Расчёт оплаты, кошелёк не трогает: {miss — чего не хватает, wallet — ресурсы после оплаты (если хватает),
## swap — что при этом обменяно: [[что отдано, сколько, что получено, сколько], …]}.
static func settle(wallet: Dictionary, price: Dictionary) -> Dictionary:
	var ch := chain()
	var w := {}
	for id in ch:
		w[String(id)] = int(wallet.get(String(id), 0))
	var miss := {}
	var swap: Array = []
	for i in ch.size():
		var id := String(ch[i])
		var need := int(price.get(id, 0))
		if need <= 0:
			continue
		if int(w[id]) >= need:
			w[id] = int(w[id]) - need
			continue
		var lack := need - int(w[id])
		var can := _raise_max(w, i, ch)
		if can < lack:
			miss[id] = lack - can
			continue
		_raise(w, i, lack, swap, ch)
		w[id] = 0
	for id in price:
		if not ch.has(String(id)):
			var lack2 := int(price[id]) - int(wallet.get(String(id), 0))
			if lack2 > 0:
				miss[String(id)] = lack2
	return {"miss": miss, "wallet": w, "swap": swap}


## сколько единиц ресурса ch[i] можно получить обменом из младших (кошелёк не меняется)
static func _raise_max(w: Dictionary, i: int, ch: Array) -> int:
	if i >= ch.size() - 1:
		return 0
	var r := rate(String(ch[i]))
	if r <= 0:
		return 0
	return (int(w[String(ch[i + 1])]) + _raise_max(w, i + 1, ch)) / r


## получить k единиц ch[i] обменом из младших (вызывать, когда _raise_max ≥ k): списывает младшие
static func _raise(w: Dictionary, i: int, k: int, swap: Array, ch: Array) -> void:
	var lo := String(ch[i + 1])
	var need := k * rate(String(ch[i]))
	if int(w[lo]) < need:
		_raise(w, i + 1, need - int(w[lo]), swap, ch)       # своего младшего мало — добираем его из ещё младших
		w[lo] = need
	w[lo] = int(w[lo]) - need
	swap.append([lo, need, String(ch[i]), k])


static var last_swap := ""            ## что обменяно при последней оплате (окна покупок дописывают это к сообщению)


## «120 споранов → 12 горошин»
static func swap_text(swap: Array) -> String:
	var t := ""
	for s in swap:
		t += ("" if t == "" else ", ") + "%s → %s" % [amount(String(s[0]), int(s[1])), amount(String(s[2]), int(s[3]))]
	return t


## Провести обмен. Всё или ничего: сначала проверка условий и кошелька, затем одно изменение кошелька.
## false — нет такой пары, неверное количество или не хватает ресурса (кошелёк не тронут).
static func exchange(inv: ULInventory, mode: String, hi: String, n: int) -> bool:
	var q := quote(mode, hi, n)
	if q.is_empty():
		return false
	var have := int(inv.wallet.get(String(q.give), 0))
	if have < int(q.give_n):
		return false
	inv.wallet[String(q.give)] = have - int(q.give_n)
	inv.wallet[String(q.get)] = int(inv.wallet.get(String(q.get), 0)) + int(q.get_n)
	inv.changed.emit()
	return true


## форма слова по числу: 0 — один, 1 — 2…4, 2 — 5 и больше (и 11…14)
static func plural_form(n: int) -> int:
	var a := absi(n) % 100
	var b := a % 10
	if a >= 11 and a <= 14:
		return 2
	if b == 1:
		return 0
	if b >= 2 and b <= 4:
		return 1
	return 2


## «3 горошины», «1 красную жемчужину» (acc — винительный: «вы отдаёте …»)
static func amount(id: String, n: int, acc := false) -> String:
	var f: Array = NAMES.get(id, [id, id, id, id])
	var k := plural_form(n)
	var word: String = f[1 if acc else 0] if k == 0 else f[k + 1]
	return "%d %s" % [n, word]


## «1 белая жемчужина = 3 красные жемчужины»
static func rate_text(hi: String) -> String:
	return "%s = %s" % [amount(hi, 1), amount(lower(hi), rate(hi))]


## «12 горошин, 20 споранов»
static func list_text(price: Dictionary) -> String:
	var t := ""
	for id in price:
		t += ("" if t == "" else ", ") + amount(String(id), int(price[id]))
	return t
