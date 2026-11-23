class_name ULItems
extends RefCounted
## Каталог предметов. Предмет в инвентаре — словарь {"id": …, "n": количество}; у рюкзака ещё "items" — его
## ячейки (массив, пустая ячейка — null), у огнестрельного оружия — "mag" (патронов в магазине). Виды (kind):
## pistol и melee — второй слот (пистолет или мачете), primary — основное оружие (автоматы, пулемёты,
## снайперские винтовки, дробовики), pack — рюкзак, ammo, med, food — расходники.
## Оружие берёт модель и хват из data/weapons.json (weapon — его ключ там), рюкзак — из BCPackFit.PACKS.

const ICONS := "res://assets/icons/"

const ITEMS := {
	# оружие: ammo — какие патроны, mag — сколько в магазине, dmg — урон, rate — выстрелов в секунду,
	# range — дальность, на которой герой сам берёт цель, м; dur — прочность (выстрелов или ударов до поломки),
	# fix — сколько споранов стоит полный ремонт у оружейника (частичный — по доле износа)
	"tt": {"n": "Пистолет ТТ", "kind": "pistol", "weapon": "pistol", "ammo": "a762x25", "mag": 8, "dmg": 22, "rate": 3.0, "range": 8, "dur": 300, "fix": 6, "d": "7,62×25 ТТ, магазин на 8 патронов."},
	"beretta": {"n": "Beretta 92FS", "kind": "pistol", "weapon": "beretta", "ammo": "a9x19", "mag": 15, "dmg": 18, "rate": 3.5, "range": 8, "dur": 400, "fix": 8, "d": "9×19, магазин на 15 патронов."},
	"machete": {"n": "Мачете", "kind": "melee", "weapon": "melee", "dmg": 40, "rate": 1.0, "dur": 400, "fix": 5, "d": "Клинок 40 см. Носится в слоте пистолета или основного оружия."},
	"ak74m": {"n": "АК-74М", "kind": "primary", "weapon": "rifle", "ammo": "a545", "mag": 30, "dmg": 26, "rate": 9.0, "auto": true, "range": 11, "dur": 1000, "fix": 30, "d": "Автомат, 5,45×39, магазин на 30 патронов."},
	"mp5": {"n": "MP5", "kind": "primary", "weapon": "mp5", "ammo": "a9x19", "mag": 30, "dmg": 16, "rate": 11.0, "auto": true, "range": 9, "dur": 800, "fix": 16, "d": "Пистолет-пулемёт, 9×19, магазин на 30 патронов."},
	"fnfal": {"n": "FN FAL", "kind": "primary", "weapon": "fnfal", "ammo": "a762x51", "mag": 20, "dmg": 42, "rate": 3.0, "range": 13, "dur": 700, "fix": 44, "d": "Винтовка, 7,62×51, магазин на 20 патронов."},
	"svd": {"n": "СВД", "kind": "primary", "weapon": "svd", "ammo": "a762x54", "mag": 10, "dmg": 70, "rate": 1.6, "range": 17, "dur": 500, "fix": 60, "d": "Снайперская винтовка, 7,62×54R, магазин на 10 патронов."},
	"vss": {"n": "ВСС «Винторез»", "kind": "primary", "weapon": "vss", "ammo": "a9x39", "mag": 10, "dmg": 38, "rate": 4.0, "range": 13, "dur": 500, "fix": 38, "d": "Бесшумная винтовка, 9×39, магазин на 10 патронов."},
	"pkp": {"n": "ПКП «Печенег»", "kind": "primary", "weapon": "pkp", "ammo": "a762x54", "mag": 100, "dmg": 34, "rate": 10.0, "auto": true, "range": 12, "dur": 1500, "fix": 90, "d": "Ручной пулемёт, 7,62×54R, короб на 100 патронов."},
	"spas12": {"n": "SPAS-12", "kind": "primary", "weapon": "spas12", "ammo": "a12", "mag": 8, "dmg": 80, "rate": 1.1, "range": 6, "dur": 400, "fix": 22, "d": "Дробовик, 12 калибр, 8 патронов."},
	# рюкзаки
	"pack_small": {"n": "Малый рюкзак", "kind": "pack", "pack": "small", "d": "+8 ячеек."},
	"pack_medium": {"n": "Средний рюкзак", "kind": "pack", "pack": "medium", "d": "+12 ячеек."},
	"pack_large": {"n": "Большой рюкзак", "kind": "pack", "pack": "large", "d": "+20 ячеек. Поясной ремень разгружает плечи."},
	# патроны, лекарства и еда: модель и значок — из набора припасов (kit — номер предмета в ul_supplies.glb,
	# gs — наибольший размер модели на земле, м)
	"a762x25": {"n": "Патроны 7,62×25", "kind": "ammo", "stack": 60, "kit": 1, "kitf": "ammo", "gs": 0.2, "icon": "ammo_1", "d": "Для ТТ."},
	"a9x19": {"n": "Патроны 9×19", "kind": "ammo", "stack": 60, "kit": 2, "kitf": "ammo", "gs": 0.2, "icon": "ammo_2", "d": "Для Beretta и MP5."},
	"a545": {"n": "Патроны 5,45×39", "kind": "ammo", "stack": 90, "kit": 3, "kitf": "ammo", "gs": 0.3, "icon": "ammo_3", "d": "Для АК-74М."},
	"a762x51": {"n": "Патроны 7,62×51", "kind": "ammo", "stack": 60, "kit": 4, "kitf": "ammo", "gs": 0.34, "icon": "ammo_4", "d": "Для FN FAL."},
	"a762x54": {"n": "Патроны 7,62×54R", "kind": "ammo", "stack": 100, "kit": 5, "kitf": "ammo", "gs": 0.32, "icon": "ammo_5", "d": "Для СВД и ПКП."},
	"a9x39": {"n": "Патроны 9×39", "kind": "ammo", "stack": 40, "kit": 6, "kitf": "ammo", "gs": 0.32, "icon": "ammo_6", "d": "Для ВСС."},
	"a12": {"n": "Патроны 12 калибра", "kind": "ammo", "stack": 32, "kit": 7, "kitf": "ammo", "gs": 0.24, "icon": "ammo_7", "d": "Для SPAS-12."},
	"bandage": {"n": "Бинт", "kind": "med", "stack": 5, "kit": 5, "gs": 0.16, "icon": "kit_5", "heal": 15, "d": "Перевязка: +15 здоровья."},
	"medkit": {"n": "Аптечка", "kind": "med", "stack": 2, "kit": 6, "gs": 0.36, "icon": "kit_6", "heal": 50, "d": "Аптечка: +50 здоровья."},
	"tonic": {"n": "Живчик", "kind": "med", "stack": 3, "kit": 4, "gs": 0.22, "icon": "kit_4", "heal": 5, "energy": 60, "d": "Настой в аптечном пузырьке: +60 энергии, +5 здоровья."},
	"can": {"n": "Тушёнка", "kind": "food", "stack": 4, "kit": 9, "gs": 0.17, "icon": "kit_9", "heal": 8, "water": 5, "d": "Банка тушёной говядины: +8 здоровья, +5 воды."},
	"water": {"n": "Вода", "kind": "food", "stack": 3, "kit": 8, "gs": 0.28, "icon": "kit_8", "heal": 0, "water": 40, "d": "Бутылка чистой воды, 0,5 л: +40 воды."},
	"rusk": {"n": "Сухари", "kind": "food", "stack": 6, "kit": 7, "gs": 0.26, "icon": "kit_7", "heal": 5, "d": "Пачка ржаных сухарей: +5 здоровья."},
	# добыча с тел: спораны — валюта Улья; горошины и жемчужины — редкие
	# хлам — кучки в постройках временных кластеров; складывается в одну стопку, продаётся барахольщику на базе
	# ключ главаря муров: выпадает с тела главаря, открывает оружейный сундук в его комнате (один раз). Действует
	# только в том экземпляре логова, где добыт (inst у предмета), — после перезагрузки кластера недействителен
	"mur_key": {"n": "Ключ главаря муров", "kind": "key", "stack": 1, "gs": 0.14, "icon": "mur_key", "d": "Тяжёлый ключ с красной биркой. Открывает оружейный сундук в комнате главаря — один раз. После перезагрузки кластера замок сменят."},
	"junk": {"n": "Хлам", "kind": "junk", "stack": 50, "icon": "junk", "gs": 0.42, "cat": "tech", "rar": "common", "kg": 0.5, "price": {"spore": 1}, "d": "Ржавые детали, болты, провода, обломки плат. Барахольщик у дома берёт по спорану за кучку."},
	# Карьер: минералы, технический хлам, инструменты и запчасти — каталог для барахольщика (cat — категория,
	# rar — редкость: common / uncommon / rare, kg — масса одной штуки, price — базовая цена за штуку в ресурсах Улья,
	# model — модель Tripo в assets/world, gs — размер на земле, м). Цены — здесь и только здесь (настраиваются).
	"ore": {"n": "Руда", "kind": "mineral", "cat": "mineral", "rar": "common", "stack": 10, "kg": 2.0, "price": {"spore": 2}, "model": "qi_ore", "gs": 0.26, "d": "Кусок тёмной железной руды с металлическим блеском. Тяжёлая, но барахольщик берёт охотно."},
	"rock_sample": {"n": "Образец породы", "kind": "mineral", "cat": "mineral", "rar": "common", "stack": 5, "kg": 1.2, "price": {"spore": 3}, "model": "qi_core", "gs": 0.3, "d": "Керн — цилиндр слоистой породы из буровой скважины."},
	"mineral_sample": {"n": "Минеральный образец", "kind": "mineral", "cat": "mineral", "rar": "uncommon", "stack": 5, "kg": 0.6, "price": {"spore": 6}, "model": "qi_sample", "gs": 0.22, "d": "Обломок породы со щёткой прозрачных кристаллов кварца."},
	"rare_mineral": {"n": "Редкий минерал", "kind": "mineral", "cat": "mineral", "rar": "rare", "stack": 3, "kg": 0.3, "price": {"pea": 1}, "model": "qi_rare", "gs": 0.18, "d": "Друза ярко-синих кристаллов. В Улье таких не находили — перенесло вместе с карьером."},
	"spare_parts": {"n": "Металлические запчасти", "kind": "parts", "cat": "parts", "rar": "common", "stack": 10, "kg": 1.5, "price": {"spore": 2}, "model": "qi_parts", "gs": 0.26, "d": "Шестерни, подшипники, болты — связка запчастей от карьерной техники."},
	"tool_ind": {"n": "Промышленный инструмент", "kind": "tool", "cat": "tool", "rar": "uncommon", "stack": 1, "kg": 6.0, "price": {"spore": 8}, "model": "qi_tool", "gs": 0.6, "d": "Пневматический отбойный молоток. Ценится у мастеров."},
	"cable": {"n": "Кабель", "kind": "tech", "cat": "tech", "rar": "common", "stack": 10, "kg": 1.0, "price": {"spore": 2}, "model": "qi_cable", "gs": 0.28, "d": "Моток медного силового кабеля."},
	"electronics": {"n": "Электронные детали", "kind": "tech", "cat": "tech", "rar": "uncommon", "stack": 10, "kg": 0.3, "price": {"spore": 4}, "model": "qi_electro", "gs": 0.2, "d": "Платы, микросхемы, конденсаторы — снято с пультов техники."},
	"scrap_metal": {"n": "Металлолом", "kind": "tech", "cat": "tech", "rar": "common", "stack": 20, "kg": 2.5, "price": {"spore": 1}, "model": "qi_scrap", "gs": 0.32, "d": "Гнутые пластины, гайки, обломок шестерни."},
	"tech_junk": {"n": "Технический хлам", "kind": "tech", "cat": "tech", "rar": "common", "stack": 10, "kg": 1.5, "price": {"spore": 1}, "model": "qi_junk", "gs": 0.32, "d": "Сломанный приёмник, моторчик, клубок проводов."},
	# задание «Последняя смена» (Карьер): находки — в тайниках этого посещения; кроме образцов, ничего не стоят
	"q_tag": {"n": "Жетон рабочего", "kind": "quest", "cat": "quest", "rar": "common", "stack": 1, "kg": 0.05, "price": {}, "icon": "q_tag", "gs": 0.12, "d": "Латунный жетон с табельным номером. Снят с останков рабочего в карьере."},
	"q_pass": {"n": "Пропуск рабочего", "kind": "quest", "cat": "quest", "rar": "common", "stack": 1, "kg": 0.05, "price": {}, "icon": "q_pass", "gs": 0.12, "d": "Пропуск на карьер с фотографией. «Смена № 3»."},
	"q_photo": {"n": "Личные вещи", "kind": "quest", "cat": "quest", "rar": "common", "stack": 1, "kg": 0.2, "price": {}, "icon": "q_photo", "gs": 0.14, "d": "Письмо домой и фотография семьи — не успел отправить."},
	"q_journal": {"n": "Журнал диспетчера", "kind": "quest", "cat": "quest", "rar": "uncommon", "stack": 1, "kg": 0.6, "price": {}, "model": "qi_logbook", "gs": 0.24, "d": "Последняя запись: «Смена № 3 на нижнем горизонте. Связь пропала. Небо позеленело…»"},
	"q_samples": {"n": "Образцы особой партии", "kind": "quest", "cat": "mineral", "rar": "rare", "stack": 1, "kg": 4.0, "price": {"spore": 20}, "model": "qi_samplebox", "gs": 0.5, "d": "Ящик с подписанными кернами — партия, ради которой работала смена."},
	# гараж и машина (data/car.json, data/garage.json): канистра — топливо в литрах у самого предмета (fuel);
	# «fuel20» — товар барахольщика: канистра, полная бензина (as — какой предмет выдаётся, fill — сколько литров)
	"canister": {"n": "Канистра", "kind": "fuel", "stack": 1, "cap": 20, "icon": "canister", "model": "it_canister", "icon_e": "canister_e", "model_e": "it_canister_e", "gs": 0.45, "kg": 1.5, "d": "Металлическая канистра на 20 л. Топливо переносят в ней: залить в резервуар гаража, наполнить из него, заправить машину (окно машины → «Бак»)."},
	"fuel20": {"n": "Канистра с бензином (20 л)", "kind": "fuel", "stack": 1, "as": "canister", "fill": 20, "icon": "canister", "gs": 0.45, "d": "Полная канистра бензина: 20 л."},
	"fuel10": {"n": "Канистра с остатком бензина (10 л)", "kind": "fuel", "stack": 1, "as": "canister", "fill": 10, "icon": "canister", "gs": 0.45, "d": "Канистра, в которой осталось 10 л бензина."},
	# ремкомплект: собирается на верстаке гаража (data/craft.json), чинит в поле самую побитую деталь машины на heal её прочности
	"car_kit": {"n": "Ремкомплект машины", "kind": "tool", "cat": "parts", "rar": "uncommon", "stack": 5, "kg": 3.0, "price": {"spore": 6}, "icon": "tool_ind", "model": "qi_tool", "gs": 0.45, "heal": 0.25, "d": "Заплаты, хомуты, проволока и герметик. Чинит самую побитую деталь машины на четверть — в окне машины, «Состояние»."},
	# боеприпасы для турелей машины: продаёт оружейник («Боеприпасы для транспорта»), загружаются в окне машины
	"veh_am_rifle": {"n": "Патроны автоматной турели", "kind": "veh_ammo", "stack": 300, "icon": "veh_am_rifle", "model": "am_rifle", "gs": 0.4, "d": "Лента 5,45 мм для автоматной турели на крыше машины. Не для ручного оружия."},
	"veh_am_mg": {"n": "Лента пулемётной турели", "kind": "veh_ammo", "stack": 250, "icon": "veh_am_mg", "model": "am_mg", "gs": 0.45, "d": "Патроны 12,7 мм в коробе для пулемётной турели машины."},
	"veh_am_cannon": {"n": "Снаряды автопушки", "kind": "veh_ammo", "stack": 60, "icon": "veh_am_cannon", "model": "am_cannon", "gs": 0.5, "d": "Осколочные снаряды 30 мм для автопушечной турели: рвутся при попадании."},
	"veh_am_rocket": {"n": "Ракеты турели", "kind": "veh_ammo", "stack": 6, "icon": "veh_am_rocket", "model": "am_rocket", "gs": 0.8, "d": "Неуправляемые ракеты для ракетной турели машины. Сильный разрыв, боезапас невелик."},
	"spore": {"n": "Спораны", "kind": "loot", "stack": 99, "icon": "loot_spore", "d": "Мелкие белые шарики из тел заражённых. Валюта Улья."},
	"pea": {"n": "Горошина", "kind": "loot", "stack": 20, "icon": "loot_pea", "d": "Зелёная горошина из тела сильного заражённого. Ценится дороже споранов."},
	"pearl_black": {"n": "Чёрная жемчужина", "kind": "loot", "stack": 10, "icon": "loot_pearl_black", "d": "Чёрная жемчужина. Большая редкость."},
	"pearl_red": {"n": "Красная жемчужина", "kind": "loot", "stack": 10, "icon": "loot_pearl_red", "d": "Красная жемчужина. Очень большая редкость."},
	"pearl_white": {"n": "Белая жемчужина", "kind": "loot", "stack": 10, "icon": "loot_pearl_white", "d": "Белая жемчужина. Редчайшая находка."},
}


## ресурсы-валюта, по возрастанию ценности (так они стоят в окошке «Ресурсы»)
const MONEY := ["spore", "pea", "pearl_black", "pearl_red", "pearl_white"]


## Прочность оружия (dur у предмета) — сколько выстрелов или ударов оно ещё выдержит; у нового — dur из описания
## (ТТ — 300 выстрелов, автомат — 1000, мачете — 400 ударов…). Каждый выстрел и удар снимает единицу. На нуле оружие
## сломано: остаётся в слоте, но не стреляет и не рубит, пока его не починит оружейник (repair_cost — цена).
static func dur_text(it) -> String:
	if it == null or not it.has("dur"):
		return ""
	var mx := int(get_def(String(it.id)).get("dur", 0))
	if int(it.dur) <= 0:
		return "сломано — нужен ремонт у оружейника"
	return "прочность %d из %d %s" % [int(it.dur), mx, "ударов" if String(get_def(String(it.id)).kind) == "melee" else "выстрелов"]


## оружие сломано (прочность кончилась)
static func broken(it) -> bool:
	return it != null and it.has("dur") and int(it.dur) <= 0


## сколько споранов стоит починить до полной прочности: полный ремонт — fix, частичный — по доле износа (не меньше 1)
static func repair_cost(it) -> int:
	if it == null or not it.has("dur"):
		return 0
	var d := get_def(String(it.id))
	var mx := maxi(int(d.get("dur", 0)), 1)
	var miss := mx - maxi(int(it.dur), 0)
	if miss <= 0:
		return 0
	return maxi(1, int(ceil(float(d.get("fix", 5)) * miss / mx)))


static func get_def(id: String) -> Dictionary:
	return ITEMS.get(id, {"n": id, "kind": "misc"})


static func kind(it) -> String:
	return String(get_def(String(it.id)).kind) if it != null else ""


## в какой слот снаряжения идёт предмет: primary, pistol (пистолет или мачете), pack; "" — не снаряжение
static func slot_of(it) -> String:
	match kind(it):
		"primary":
			return "primary"
		"pistol", "melee":
			return "pistol"
		"pack":
			return "pack"
	return ""


## можно ли положить предмет в слот снаряжения: мачете (холодное) — и в слот пистолета, и в слот основного
static func fits(it, slot: String) -> bool:
	if it == null:
		return false
	if kind(it) == "melee":
		return slot in ["pistol", "primary"]
	return slot_of(it) == slot


static func title(it) -> String:
	if it == null:
		return ""
	var n := int(it.get("n", 1))
	if it.has("fuel"):
		# канистра: пустая, полная или с остатком — так и называется (и значок у пустой свой)
		var cap := int(get_def(String(it.id)).get("cap", 20))
		var l := float(it.fuel)
		if l <= 0.05:
			return "Пустая канистра"
		if l >= float(cap) - 0.05:
			return "Канистра с бензином — %d л" % cap
		return "Канистра с бензином — %s / %d л" % [_l(l), cap]
	return get_def(String(it.id)).n + (" ×%d" % n if n > 1 else "")


static func _l(v: float) -> String:
	return str(int(round(v))) if absf(v - round(v)) < 0.05 else "%.1f" % v


static func stack(id: String) -> int:
	return int(get_def(id).get("stack", 1))


## ячеек у рюкзака
static func pack_slots(it) -> int:
	if it == null or kind(it) != "pack":
		return 0
	return int(BCPackFit.PACKS[get_def(String(it.id)).pack].slots)


## новый предмет; рюкзак — с пустыми ячейками
static func make(id: String, n := 1) -> Dictionary:
	if get_def(id).has("as"):
		var a := make(String(get_def(id).as), n)        # товар-набор: выдаётся сам предмет (полная канистра)
		if get_def(id).has("fill"):
			a["fuel"] = float(get_def(id).fill)
		return a
	var it := {"id": id, "n": n}
	if get_def(id).get("kind", "") == "fuel":
		it["fuel"] = 0.0                             # пустая канистра
	if get_def(id).has("mag"):
		it["mag"] = int(get_def(id).mag)             # оружие — с полным магазином
	if get_def(id).has("dur"):
		it["dur"] = int(get_def(id).dur)             # и с полной прочностью
	if get_def(id).get("kind", "") == "pack":
		var cells := []
		cells.resize(int(BCPackFit.PACKS[get_def(id).pack].slots))
		it["items"] = cells
	return it


static func pack_empty(it) -> bool:
	if it == null or not it.has("items"):
		return true
	for c in it.items:
		if c != null:
			return false
	return true


const KITS := {"supplies": "res://assets/world/ul_supplies.glb", "ammo": "res://assets/world/ul_ammo.glb"}
static var _kit := {}


## Сетка предмета из набора (одна модель Tripo, разрезанная на части tools/split_glb.mjs); null — нет.
## Набор — по полю kitf (по умолчанию припасы), номер — kit. part: "" — предмет целиком (у патронов — коробка
## с патроном рядом, так он показан в инвентаре), "a" — самая крупная часть (коробка: так он лежит на земле),
## "b" — остальное (патрон). Нет такой части — возвращается предмет целиком.
static func kit_mesh(id: String, part := "") -> Mesh:
	var d := get_def(id)
	var k := int(d.get("kit", 0))
	if k <= 0:
		return null
	var f := String(d.get("kitf", "supplies"))
	if not _kit.has(f):
		_kit[f] = {}
		if ResourceLoader.exists(KITS[f]):
			var sc: Node = (load(KITS[f]) as PackedScene).instantiate()
			for mi in sc.find_children("item_*", "MeshInstance3D", true, false):
				var mesh: Mesh = (mi as MeshInstance3D).mesh
				# без «металла» в материале: в игре нет отражений окружения, металл выходит чёрным
				for si in mesh.get_surface_count():
					var mt := mesh.surface_get_material(si) as StandardMaterial3D
					if mt != null and (mt.metallic > 0.0 or mt.metallic_texture != null):
						mt = mt.duplicate()
						mt.metallic = 0.0
						mt.metallic_texture = null
						mt.roughness_texture = null
						mt.roughness = 0.6
						mesh.surface_set_material(si, mt)
				_kit[f][String(mi.name).trim_prefix("item_")] = mesh
			sc.free()
	var key := str(k) + ("_" + part if part != "" else "")
	return _kit[f].get(key, _kit[f].get(str(k)))


static var _icons := {}


## пустая ли канистра (у пустой — свой значок и своя модель на земле)
static func empty_can(it) -> bool:
	return it != null and it.has("fuel") and float(it.fuel) <= 0.05


## значок предмета с учётом состояния (пустая канистра — серая, без бензина)
static func icon_of(it) -> Texture2D:
	if it == null:
		return null
	var id := String(it.id)
	if empty_can(it) and get_def(id).has("icon_e"):
		var key := "%s#e" % id
		if not _icons.has(key):
			var path := ICONS + String(get_def(id).icon_e) + ".png"
			_icons[key] = load(path) if ResourceLoader.exists(path) else icon(id)
		return _icons[key]
	return icon(id)


## модель предмета на земле с учётом состояния
static func model_of(it) -> String:
	var id := String(it.id)
	if empty_can(it) and get_def(id).has("model_e"):
		var m := "res://assets/world/" + String(get_def(id).model_e) + ".glb"
		if ResourceLoader.exists(m):
			return m
	return model_path(id)


static func icon(id: String) -> Texture2D:
	if _icons.has(id):
		return _icons[id]
	var d := get_def(id)
	var path := ICONS + String(d.get("icon", id)) + ".png"
	var t: Texture2D = load(path) if ResourceLoader.exists(path) else null
	_icons[id] = t
	return t


## категория для барахольщика и подписи в инвентаре
const CATS := {"mineral": "Минералы", "tech": "Технический хлам", "tool": "Инструменты", "parts": "Запчасти", "quest": "Задание"}
const RARITY := {"common": "обычный", "uncommon": "необычный", "rare": "редкий"}


## каталог товаров для барахольщика: всё, у чего есть цена (id → {n, cat, rar, kg, stack, price, model, icon})
static func catalog() -> Dictionary:
	var out := {}
	for id in ITEMS:
		var d: Dictionary = ITEMS[id]
		if d.has("price") and not (d.price as Dictionary).is_empty():
			out[id] = {"n": d.n, "cat": String(d.get("cat", "")), "rar": String(d.get("rar", "common")), "kg": float(d.get("kg", 0.0)),
				"stack": stack(id), "price": d.price, "model": String(d.get("model", "")), "icon": String(d.get("icon", id))}
	return out


## модель предмета (Tripo) или ""
static func model_path(id: String) -> String:
	var m := String(get_def(id).get("model", ""))
	return ("res://assets/world/" + m + ".glb") if m != "" and ResourceLoader.exists("res://assets/world/" + m + ".glb") else ""


static func tint(id: String) -> Color:
	var t: Array = get_def(id).get("tint", [1, 1, 1])
	return Color(t[0], t[1], t[2])
