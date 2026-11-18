class_name ULHeroes
## Внешность героя: у каждого игрока кооператива свой персонаж (выбор — в «МУЛЬТИПЛЕЕР», он же действует
## в одиночной игре и на стенде). Скелет Tripo у всех один (BoneRoot/Hip/…), поэтому все клипы героя
## (assets/anim/hero) подходят без новых движений (Tripo, 18.11: Лис и Рысь — по ~75 кредитов): разницу исходных поз костей снимает BCAnimSet._rest_fix,
## руки к оружию ставит BCWeaponHold по скелету самой модели.

const CFG := "user://coop_client.json"      ## тот же файл, что у экрана «МУЛЬТИПЛЕЕР» (адрес сервера и персонаж)
const ANIM := "res://assets/anim/hero"
const LIST := {
	"hero": {"n": "Сталкер", "model": "res://assets/models/hero.glb", "height": 1.8},
	"hero2": {"n": "Лис", "model": "res://assets/models/hero2.glb", "height": 1.8},
	"hero3": {"n": "Рысь", "model": "res://assets/models/hero3.glb", "height": 1.74},
}


## доступные персонажи (модель есть в сборке)
static func ids() -> Array:
	var out := []
	for k in LIST:
		if ResourceLoader.exists(String(LIST[k].model)):
			out.append(k)
	return out


static func name_of(id: String) -> String:
	return String(LIST.get(id, LIST.hero).n)


static func current() -> String:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-hero=") and a.substr(10) in ids():
			return a.substr(10)          # проверки игры на другом персонаже
	var d := _cfg()
	var id := String(d.get("char", "hero"))
	return id if id in ids() else "hero"


static func set_current(id: String) -> void:
	var d := _cfg()
	d["char"] = id
	var f := FileAccess.open(CFG, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(d))


static func model(id := "") -> String:
	if id == "":
		id = current()
	var p := String(LIST.get(id, LIST.hero).model)
	return p if ResourceLoader.exists(p) else String(LIST.hero.model)


static func height(id := "") -> float:
	if id == "":
		id = current()
	return float(LIST.get(id, LIST.hero).height)


## поставить внешность на персонажа (до setup)
static func setup_rig(rig: BCCharacter, id := "") -> void:
	if id == "":
		id = current()
	rig.height = height(id)
	rig.setup(model(id), ANIM)


static func _cfg() -> Dictionary:
	if FileAccess.file_exists(CFG):
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		if d is Dictionary:
			return d
	return {}
