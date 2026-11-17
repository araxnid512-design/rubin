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
	"tt": {"n": "Пистолет ТТ", "kind": "pistol", "weapon": "pistol", "ammo": "a762x25", "mag": 8, "dmg": 22, "rate": 3.0, "range": 18, "dur": 300, "fix": 6, "d": "7,62×25 ТТ, магазин на 8 патронов."},
	"beretta": {"n": "Beretta 92FS", "kind": "pistol", "weapon": "beretta", "ammo": "a9x19", "mag": 15, "dmg": 18, "rate": 3.5, "range": 18, "dur": 400, "fix": 8, "d": "9×19, магазин на 15 патронов."},
	"machete": {"n": "Мачете", "kind": "melee", "weapon": "melee", "dmg": 40, "rate": 1.0, "dur": 400, "fix": 4, "d": "Клинок 40 см. Носится в слоте пистолета."},
	"ak74m": {"n": "АК-74М", "kind": "primary", "weapon": "rifle", "ammo": "a545", "mag": 30, "dmg": 26, "rate": 9.0, "auto": true, "range": 30, "dur": 1000, "fix": 18, "d": "Автомат, 5,45×39, магазин на 30 патронов."},
	"mp5": {"n": "MP5", "kind": "primary", "weapon": "mp5", "ammo": "a9x19", "mag": 30, "dmg": 16, "rate": 11.0, "auto": true, "range": 22, "dur": 800, "fix": 12, "d": "Пистолет-пулемёт, 9×19, магазин на 30 патронов."},
	"fnfal": {"n": "FN FAL", "kind": "primary", "weapon": "fnfal", "ammo": "a762x51", "mag": 20, "dmg": 42, "rate": 3.0, "range": 34, "dur": 700, "fix": 24, "d": "Винтовка, 7,62×51, магазин на 20 патронов."},
	"svd": {"n": "СВД", "kind": "primary", "weapon": "svd", "ammo": "a762x54", "mag": 10, "dmg": 70, "rate": 1.6, "range": 48, "dur": 500, "fix": 30, "d": "Снайперская винтовка, 7,62×54R, магазин на 10 патронов."},
	"vss": {"n": "ВСС «Винторез»", "kind": "primary", "weapon": "vss", "ammo": "a9x39", "mag": 10, "dmg": 38, "rate": 4.0, "range": 30, "dur": 500, "fix": 22, "d": "Бесшумная винтовка, 9×39, магазин на 10 патронов."},
	"pkp": {"n": "ПКП «Печенег»", "kind": "primary", "weapon": "pkp", "ammo": "a762x54", "mag": 100, "dmg": 34, "rate": 10.0, "auto": true, "range": 34, "dur": 1500, "fix": 40, "d": "Ручной пулемёт, 7,62×54R, короб на 100 патронов."},
	"spas12": {"n": "SPAS-12", "kind": "primary", "weapon": "spas12", "ammo": "a12", "mag": 8, "dmg": 80, "rate": 1.1, "range": 13, "dur": 400, "fix": 14, "d": "Дробовик, 12 калибр, 8 патронов."},
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
	"junk": {"n": "Хлам", "kind": "junk", "stack": 50, "icon": "junk", "gs": 0.42, "d": "Ржавые детали, болты, провода, обломки плат. Барахольщик у дома берёт по спорану за кучку."},
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


static func title(it) -> String:
	if it == null:
		return ""
	var n := int(it.get("n", 1))
	return get_def(String(it.id)).n + (" ×%d" % n if n > 1 else "")


static func stack(id: String) -> int:
	return int(get_def(id).get("stack", 1))


## ячеек у рюкзака
static func pack_slots(it) -> int:
	if it == null or kind(it) != "pack":
		return 0
	return int(BCPackFit.PACKS[get_def(String(it.id)).pack].slots)


## новый предмет; рюкзак — с пустыми ячейками
static func make(id: String, n := 1) -> Dictionary:
	var it := {"id": id, "n": n}
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


static func icon(id: String) -> Texture2D:
	if _icons.has(id):
		return _icons[id]
	var d := get_def(id)
	var path := ICONS + String(d.get("icon", id)) + ".png"
	var t: Texture2D = load(path) if ResourceLoader.exists(path) else null
	_icons[id] = t
	return t


static func tint(id: String) -> Color:
	var t: Array = get_def(id).get("tint", [1, 1, 1])
	return Color(t[0], t[1], t[2])
