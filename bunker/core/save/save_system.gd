extends Node
## SaveSystem BunkerCore: одно сохранение user://save.json — герой (место, здоровье, доза, костюм, инвентарь,
## сытость, вода, время), задания, ресурсы убежища и состояние объектов мира (двери, свет, подобранные
## предметы). Автосохранение — при паузе, сворачивании и каждые 60 секунд.

const FILE := "user://save.json"
const VERSION := 1

var _auto := 0.0


func _process(delta: float) -> void:
	_auto += delta
	if _auto > 60.0 and Core.player and Core.player.state == "move":
		_auto = 0.0
		save_game()


func has_save() -> bool:
	return FileAccess.file_exists(FILE)


func save_game() -> bool:
	if Core.player == null:
		return false
	var d := {"v": VERSION, "time": Time.get_datetime_string_from_system(), "player": Core.player.get_state(),
		"world": Core.world.collect_state(), "quest": Core.quest.get_state() if Core.quest else {},
		"craft": Core.craft.get_state() if Core.craft else {}}
	var f := FileAccess.open(FILE, FileAccess.WRITE)
	if f == null:
		push_error("SaveSystem: не удалось записать " + FILE)
		return false
	f.store_string(JSON.stringify(d))
	f.close()
	return true


func load_game() -> bool:
	if not has_save() or Core.player == null:
		return false
	var f := FileAccess.open(FILE, FileAccess.READ)
	var d = JSON.parse_string(f.get_as_text()) if f else null
	if not (d is Dictionary):
		return false
	Core.world.apply_state(d.get("world", {}))
	Core.player.set_state(d.get("player", {}))
	if Core.quest:
		Core.quest.set_state(d.get("quest", {}))
	if Core.craft:
		Core.craft.set_state(d.get("craft", {}))
	return true


func delete_save() -> void:
	if has_save():
		DirAccess.remove_absolute(ProjectSettings.globalize_path(FILE))
