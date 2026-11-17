class_name ULCase
extends RefCounted
## Оружейный сундук главаря муров: ключ, одна прокрутка — одно оружие.
## Порядок — как у настоящей выдачи, без лазеек:
##   1) open_chest: проверяется ключ (только из этого экземпляра логова), ключ тут же убирается из инвентаря,
##      награда выбирается случайно ОДИН раз и вместе с отметкой «сундук пуст» сразу пишется в base.json —
##      до всякой анимации. Закрыть окно, перезапустить игру — результат тот же: он уже записан.
##   2) лента прокрутки (ULCaseUI) только показывает уже выбранное;
##   3) claim: «Забрать» — оружие в инвентарь; нет места — награда остаётся ждать (окно выдачи откроется снова,
##      в логове или дома), пока не освободится ячейка. Выданная награда стирается из записи — второй раз её не взять.
## Шансы и состав редкостей — data/case.json; модель, которой нет в игре, не выпадает (шанс её редкости делится
## между доступными моделями; редкость без доступных моделей не выпадает вовсе).

const CFG := "res://data/case.json"
const KEY := "mur_key"
static var _cfg := {}


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


## модель есть в игре: предмет описан и у него есть значок (иначе карточку нечем показать)
static func available(id: String) -> bool:
	return ULItems.ITEMS.has(id) and ResourceLoader.exists(ULItems.ICONS + id + ".png")


## таблица выпадения: [{r: редкость, p: доля 0…1, items: доступные модели, off: недоступные}]
static func table() -> Array:
	var out := []
	var sum := 0.0
	for r in cfg().get("rarities", []):
		var av := []
		var off := []
		for id in r.get("items", []):
			if available(String(id)):
				av.append(String(id))
			else:
				off.append(String(id))
		var ch := float(r.get("chance", 0.0)) if not av.is_empty() else 0.0
		sum += ch
		out.append({"r": r, "p": ch, "items": av, "off": off})
	for t in out:
		t.p = float(t.p) / maxf(sum, 0.0001)
	return out


## выбрать награду: редкость по шансам, модель — поровну внутри редкости, состояние — из её диапазона
static func roll(rng: RandomNumberGenerator) -> Dictionary:
	var tb := table()
	var x := rng.randf()
	var pick: Dictionary = {}
	for t in tb:
		if float(t.p) <= 0.0:
			continue
		pick = t
		x -= float(t.p)
		if x < 0.0:
			break
	if pick.is_empty():
		return {}
	var items: Array = pick.items
	var id := String(items[rng.randi() % items.size()])
	var cr: Array = pick.r.get("cond", [0.5, 1.0])
	var c := rng.randf_range(float(cr[0]), float(cr[1]))
	var mx := int(ULItems.get_def(id).get("dur", 100))
	return {"id": id, "rarity": String(pick.r.id), "rn": String(pick.r.n), "color": String(pick.r.color),
		"cond": snappedf(c, 0.01), "dur": maxi(1, int(round(mx * c))), "t": int(Time.get_unix_time_from_system())}


static func cond_name(c: float) -> String:
	var n := ""
	for e in cfg().get("cond_names", []):
		if c >= float(e[0]):
			n = String(e[1])
	return n


static func rarity(id: String) -> Dictionary:
	for r in cfg().get("rarities", []):
		if String(r.id) == id:
			return r
	return {}


## предмет награды: то же оружие, но с износом из прокрутки (магазин полный)
static func make_item(rw: Dictionary) -> Dictionary:
	var it := ULItems.make(String(rw.id))
	if it.has("dur"):
		it.dur = int(rw.dur)
	return it


# ---------------- ключ и сундук (состояние — в base.json, ULBase.data.lair) ----------------

## состояние логова: inst — номер экземпляра (новый при каждом входе по маршруту), chest — «closed» / «open»
static func lair() -> Dictionary:
	ULBase.load_state()
	if not (ULBase.data.get("lair") is Dictionary):
		ULBase.data["lair"] = {"inst": "", "chest": "closed"}
	return ULBase.data.lair


## новый экземпляр логова (вход по маршруту): босс и сундук — заново, старые ключи недействительны
static func new_instance() -> String:
	var l := lair()
	l["inst"] = "%d-%d" % [int(Time.get_unix_time_from_system()), randi() % 100000]
	l["chest"] = "closed"
	ULBase.save_state()
	return String(l.inst)


static func make_key(inst: String) -> Dictionary:
	var it := ULItems.make(KEY)
	it["inst"] = inst
	return it


## где лежит ключ: [массив, индекс] или []
static func find_key(inv: ULInventory) -> Array:
	for arr in [inv.pockets, inv.pack.items if inv.pack != null else []]:
		for i in (arr as Array).size():
			var it = arr[i]
			if it != null and String(it.id) == KEY:
				return [arr, i]
	return []


## Открыть сундук. Ответ {ok, err: ""|"open"|"key"|"stale"|"pending", reward}. При успехе ключ уже убран, награда
## выбрана и записана — дальше её можно только показать и выдать.
static func open_chest(inv: ULInventory, rng: RandomNumberGenerator) -> Dictionary:
	var l := lair()
	if pending() != null:
		return {"ok": false, "err": "pending", "reward": pending()}
	if String(l.get("chest", "closed")) == "open":
		return {"ok": false, "err": "open", "reward": {}}
	var at := find_key(inv)
	if at.is_empty():
		return {"ok": false, "err": "key", "reward": {}}
	var key: Dictionary = at[0][at[1]]
	if String(key.get("inst", "")) != String(l.get("inst", "")):
		return {"ok": false, "err": "stale", "reward": {}}
	var rw := roll(rng)
	if rw.is_empty():
		return {"ok": false, "err": "empty", "reward": {}}
	# всё одним сохранением: ключа нет, сундук пуст, награда ждёт выдачи
	at[0][at[1]] = null
	inv.changed.emit()
	l["chest"] = "open"
	ULBase.data["case_pending"] = rw
	var log: Array = ULBase.data.get("case_log", []) if ULBase.data.get("case_log") is Array else []
	log.append(rw)
	ULBase.data["case_log"] = log.slice(maxi(0, log.size() - 20))
	ULBase.save_state()
	return {"ok": true, "err": "", "reward": rw}


## невыданная награда или null
static func pending():
	ULBase.load_state()
	var p = ULBase.data.get("case_pending")
	return p if p is Dictionary and not (p as Dictionary).is_empty() else null


## Забрать награду в инвентарь. {ok, err: ""|"none"|"full"}. Нет места — награда остаётся ждать.
static func claim(inv: ULInventory) -> Dictionary:
	var rw = pending()
	if rw == null:
		return {"ok": false, "err": "none"}
	var it := make_item(rw)
	var left := inv.add(it)
	if left > 0:
		return {"ok": false, "err": "full"}
	ULBase.data["case_pending"] = {}
	ULBase.save_state()
	return {"ok": true, "err": ""}
