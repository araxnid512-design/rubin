extends SceneTree
## Записать исходную позу скелета модели в rest.json набора анимаций — нужно, когда модель-образец набора
## заменяют новой (клипы набора сняты со старого скелета, и поправку под новый считают по этой записи).
## godot4 --headless --path . -s tools/anim_rest_dump.gd -- <модель.glb> <папка набора>
func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		print("нужно: <модель.glb> <папка набора>")
		quit(1)
		return
	var r := BCAnimSet.rest_of(args[0])
	if r.is_empty():
		print("нет скелета в ", args[0])
		quit(1)
		return
	var f := FileAccess.open(String(args[1]).path_join("rest.json"), FileAccess.WRITE)
	f.store_string(BCAnimSet.rest_to_json(r))
	f.close()
	print("rest.json записан: ", args[1], " костей ", r.size() - 2)
	quit()
