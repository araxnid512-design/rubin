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


## чего не хватает на цену {ресурс: сколько}: {ресурс: недостача}; пусто — хватает
static func missing(wallet: Dictionary, price: Dictionary) -> Dictionary:
	var out := {}
	for id in price:
		var lack := int(price[id]) - int(wallet.get(String(id), 0))
		if lack > 0:
			out[String(id)] = lack
	return out


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
