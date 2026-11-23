class_name ULCraft
extends RefCounted
## Верстак: сборка расходников из хлама и запчастей. Рецепты — data/craft.json (правятся без кода).

static var _cfg := {}


static func recipes() -> Array:
	if _cfg.is_empty():
		var f := FileAccess.open("res://data/craft.json", FileAccess.READ)
		if f != null:
			var d = JSON.parse_string(f.get_as_text())
			if d is Dictionary:
				_cfg = d
	return _cfg.get("recipes", [])


## чего не хватает: {предмет: сколько}; пусто — можно собирать
static func missing(inv: ULInventory, r: Dictionary) -> Dictionary:
	var out := {}
	var need: Dictionary = r.get("need", {})
	for id in need:
		var lack := int(need[id]) - inv.count(String(id))
		if lack > 0:
			out[id] = lack
	return out


## собрать: тратит нужное, кладёт результат герою; не влезло — возвращает потраченное и отказывает
static func make(inv: ULInventory, r: Dictionary) -> Dictionary:
	if not missing(inv, r).is_empty():
		return {"ok": false, "err": "need"}
	var need: Dictionary = r.get("need", {})
	for id in need:
		inv.consume(String(id), int(need[id]))
	var it := ULItems.make(String(r.out), int(r.get("n", 1)))
	var left := inv.add(it, false)
	if left > 0:
		# не поместилось: забрать положенное обратно и вернуть материалы
		inv.consume(String(r.out), int(r.get("n", 1)) - left)
		for id in need:
			inv.add(ULItems.make(String(id), int(need[id])), false)
		return {"ok": false, "err": "room"}
	return {"ok": true, "err": ""}
