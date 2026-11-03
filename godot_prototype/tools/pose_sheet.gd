extends SceneTree
## Обёртка: загружает инструмент после инициализации автозагрузок.
## Запуск: xvfb-run -a godot --rendering-driver opengl3 --path . -s tools/pose_sheet.gd [-- класс ...]
func _initialize() -> void:
	_go()

func _go() -> void:
	await process_frame
	var n := Node.new()
	n.set_script(load("res://tools/pose_sheet_node.gd"))
	root.add_child(n)
