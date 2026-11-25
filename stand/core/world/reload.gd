class_name ULReload
extends RefCounted
## Перезагрузка кластера: сколько людей перенёс Улей и кем они стали (data/reload.json).
## people человек → доля infected (70 %) сразу пустыши. Остальные — обычные люди, добыча: по очереди каждого
## с шансом eat ловит пустыш — съев его, пустыш отъедается в лотерейщика; с шансом kill человека убивает
## лотерейщик (если они уже появились) — и становится рубером (не больше ruber_max); остальные прячутся.
## Шансы eat и kill — свои на каждую перезагрузку. Итог разыгрывается при обновлении маршрутов (ULBase) и
## хранится до следующего обновления: в компьютере базы и на карте мира видно, что там сейчас, и на локации —
## ровно столько пустышей, лотерейщиков и руберов.

const CFG := "res://data/reload.json"
static var _c := {}


static func cfg() -> Dictionary:
	if _c.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_c = d if d is Dictionary else {"infected": [0.7, 0.7], "places": {}}
	return _c


static func has_place(id: String) -> bool:
	return (cfg().get("places", {}) as Dictionary).has(id)


## → {people, infected, eaten, killed, hid, pustysh, lottery, ruber}
static func roll(id: String, rng: RandomNumberGenerator) -> Dictionary:
	var p: Dictionary = cfg().places[id]
	var n := rng.randi_range(int(p.people[0]), int(p.people[1]))
	var sh: Array = cfg().get("infected", [0.7, 0.7])
	# доля заражённых: ровно 70 % — без случайности (у генератора дробь неточная: 65 × 0,7 давало 45, а не 46)
	var share := float(sh[0]) if is_equal_approx(float(sh[0]), float(sh[1])) else rng.randf_range(float(sh[0]), float(sh[1]))
	var inf := roundi(float(n) * share)
	var p_eat := rng.randf_range(float(p.eat[0]), float(p.eat[1]))
	var p_kill := rng.randf_range(float(p.kill[0]), float(p.kill[1]))
	var rmax := int(p.get("ruber_max", 1))
	var pust := inf
	var lot := 0
	var rub := 0
	var eaten := 0
	var killed := 0
	var hid := 0
	for i in n - inf:
		var r := rng.randf()
		if r < p_kill and lot > 0 and rub < rmax:
			lot -= 1
			rub += 1
			killed += 1
		elif r < p_kill + p_eat and pust > 0:
			pust -= 1
			lot += 1
			eaten += 1
		else:
			hid += 1
	# границы по заданию локации (необязательные): не меньше lottery_min и не больше lottery_max лотерейщиков,
	# не меньше ruber_min руберов — история остаётся связной (спрятавшегося всё-таки нашли; пойманный успел уйти)
	var rmin := int(p.get("ruber_min", 0))
	var lmin := int(p.get("lottery_min", 0)) + maxi(rmin - rub, 0)
	while lot < lmin and pust > 0 and hid > 0:
		hid -= 1
		pust -= 1
		lot += 1
		eaten += 1
	while rub < rmin and lot > 0 and hid > 0:
		hid -= 1
		lot -= 1
		rub += 1
		killed += 1
	var lmax := int(p.get("lottery_max", 100000))
	while lot > lmax:
		lot -= 1
		pust += 1
		eaten -= 1
		hid += 1
	return {"people": n, "infected": inf, "eaten": eaten, "killed": killed, "hid": hid, "pustysh": pust, "lottery": lot, "ruber": rub}


static func _plural(n: int, forms: Array) -> String:
	return "%d %s" % [n, String(forms[ULEconomy.plural_form(n)])]


## «Перенесло 52 человека: 36 сразу заражены; 7 съедены пустышами — те отъелись в лотерейщиков; …»
static func story(c: Dictionary) -> String:
	var one := func(n: int) -> bool: return ULEconomy.plural_form(n) == 0
	var t := "Перенесло %s: %d сразу %s" % [_plural(int(c.people), ["человека", "человека", "человек"]), int(c.infected), "заражён" if one.call(int(c.infected)) else "заражены"]
	var e := int(c.eaten)
	if e > 0:
		t += ("; %d съеден пустышом — тот отъелся в лотерейщика" if one.call(e) else "; %d съедены пустышами — те отъелись в лотерейщиков") % e
	var k := int(c.killed)
	if k > 0:
		t += ("; %d убит лотерейщиком — тот стал рубером" if one.call(k) else "; %d убиты лотерейщиками — те стали руберами") % k
	var h := int(c.hid)
	if h > 0:
		t += ("; %d спрятался" if one.call(h) else "; %d спрятались") % h
	return t + "."
