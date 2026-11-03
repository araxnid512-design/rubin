extends SceneTree
## Универсальный запуск инструмента-узла после инициализации автозагрузок.
## godot --path . -s tools/run_node.gd -- res://tools/<скрипт>.gd [аргументы]
func _initialize() -> void:
	_go()

func _go() -> void:
	await process_frame
	var args := OS.get_cmdline_user_args()
	if args.is_empty():
		print("usage: -- res://tools/x.gd")
		quit(1)
		return
	var n := Node.new()
	n.set_script(load(args[0]))
	root.add_child(n)
