extends SceneTree
## Перезаписать набор клипов под новую модель (её скелет): клипы набора сняты со старой модели, и без этого
## поправка под чужой скелет (BCAnimSet._rest_fix) считалась бы при каждой загрузке локации. Здесь она
## считается один раз по записи старого скелета (rest.json набора) и запекается в клипы; затем rest.json
## переписывается позой новой модели — она теперь образец набора (для неё поправки нет, другим моделям,
## которые берут клипы этого набора, поправка считается уже от неё).
## godot4 --headless --path . -s tools/anim_rebake.gd -- <модель.glb> <папка набора> [корневая кость]
func _init() -> void:
	var args := OS.get_cmdline_user_args()
	if args.size() < 2:
		print("нужно: <модель.glb> <папка набора> [корневая кость]")
		quit(1)
		return
	var root_bone := String(args[2]) if args.size() > 2 else "Hip"
	var inst: Node = (load(args[0]) as PackedScene).instantiate()
	var found := inst.find_children("*", "Skeleton3D", true, false)
	if found.is_empty():
		print("нет скелета в ", args[0])
		quit(1)
		return
	var skel: Skeleton3D = found[0]
	var set_dir := String(args[1])
	var fix := BCAnimSet._rest_fix(skel, set_dir)
	if fix.is_empty():
		print("поправка не нужна — набор уже под этот скелет: ", set_dir)
		inst.free()
		quit()
		return
	var n := 0
	for f in DirAccess.get_files_at(set_dir):
		if not f.ends_with(".res"):
			continue
		var path := set_dir.path_join(f)
		var a: Animation = (load(path) as Animation).duplicate(true)
		BCAnimSet._retarget(a, skel, "", fix, root_bone, true)
		var err := ResourceSaver.save(a, path)
		if err != OK:
			print("не сохранён ", path, ": ", err)
			continue
		n += 1
	var js := FileAccess.open(set_dir.path_join("rest.json"), FileAccess.WRITE)
	js.store_string(BCAnimSet.rest_to_json(BCAnimSet.rest_of(args[0])))
	js.close()
	print("перезаписано клипов: ", n, " (", set_dir, "), образец набора — ", args[0])
	inst.free()
	quit()
