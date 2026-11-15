extends Node
## SaveSystem StarCore: одно сохранение user://drift_save.json — герой, корабль (отсеки, энергия, дроны, турели),
## цикл (сектор, таймер), склад. Каждая подсистема отдаёт get_state() / принимает set_state(). Автосохранение —
## перед прыжком, при сворачивании и раз в минуту в «тишине».

const FILE := "user://drift_save.json"
var parts := {}          ## имя → узел с get_state/set_state
var _auto := 0.0


func register(name: String, node: Node) -> void:
	parts[name] = node


func _process(delta: float) -> void:
	_auto += delta
	if _auto > 60.0 and Core.player and Core.loop and Core.loop.phase == "calm":
		_auto = 0.0
		save_game()


func has_save() -> bool:
	return FileAccess.file_exists(FILE)


func save_game() -> bool:
	var d := {"v": 1, "time": Time.get_datetime_string_from_system()}
	for k in parts:
		if is_instance_valid(parts[k]):
			d[k] = parts[k].get_state()
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	if f == null:
		return false
	f.store_string(JSON.stringify(d))
	return true


func load_game() -> bool:
	if not has_save():
		return false
	var d = JSON.parse_string(FileAccess.get_file_as_string(FILE))
	if not (d is Dictionary):
		return false
	for k in parts:
		if d.has(k) and is_instance_valid(parts[k]):
			parts[k].set_state(d[k])
	return true


func delete_save() -> void:
	if has_save():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(FILE))
