extends SceneTree
## Запуск: godot --path . -s tools/test_rig_runner.gd  → docs/rigtest/*.png
func _initialize() -> void:
	var scene := Node3D.new()
	scene.set_script(load("res://tools/test_rig.gd"))
	root.add_child(scene)
	_run(scene)

func _run(scene: Node) -> void:
	DirAccess.make_dir_recursive_absolute("res://docs/rigtest")
	await process_frame
	for tt in [0.4, 0.55, 0.7, 1.2]:
		while scene.t < tt:
			await process_frame
		scene.frozen = true
		var only := OS.get_cmdline_user_args()
		for i in scene.rigs.size():
			if only.size() > 0 and not (str(i) in only):
				continue
			for side in [0, 1]:
				scene.focus(i, side)
				await process_frame
				await process_frame
				var img := root.get_viewport().get_texture().get_image()
				img.save_png("res://docs/rigtest/r%d_s%d_t%03d.png" % [i, side, int(tt * 100)])
		scene.frozen = false
	quit()
