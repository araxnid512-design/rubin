extends SceneTree
## Загружает все скрипты и шейдеры проекта, чтобы выявить ошибки компиляции.
## Запуск: godot --headless --path . -s tools/check_all.gd
var bad := 0

func _initialize() -> void:
	_scan("res://scripts")
	_scan("res://tools")
	_scan("res://scenes")
	print("CHECK DONE, failed: ", bad)
	quit(1 if bad > 0 else 0)

func _scan(dir: String) -> void:
	var d := DirAccess.open(dir)
	if d == null:
		return
	for f in d.get_files():
		var p := dir + "/" + f
		if f.ends_with(".gd") or f.ends_with(".tscn"):
			var r = load(p)
			if r == null:
				bad += 1
				print("FAILED: ", p)
			elif r is GDScript and not (r as GDScript).can_instantiate() and not f.begins_with("check_"):
				bad += 1
				print("CANNOT INSTANTIATE: ", p)
	for sub in d.get_directories():
		_scan(dir + "/" + sub)
