extends SceneTree
## Движения врага из файлов Tripo (модель + одно движение, перенесённое на её собственный скелет) — в отдельные
## клипы набора: папка с m_<набор>_<метка>.glb → res://assets/anim/<набор>/<метка>.res. Файлы GLB читаются прямо с
## диска (в проект не кладутся: каждый весит 6–8 МБ, клип — 60 КБ).
## Запуск: godot --path . --headless -s tools/extract_anims.gd -- --as-src=/путь/к/папке

func _init() -> void:
	var src := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-src="):
			src = a.substr(9)
	var d := DirAccess.open(src)
	if d == null:
		print("нет папки ", src)
		quit()
		return
	var n := 0
	for f in d.get_files():
		if not (f.begins_with("m_") and f.ends_with(".glb")):
			continue
		# m_zombie_z_idle.glb → набор zombie, клип z_idle
		var parts := f.get_basename().split("_", false, 2)
		if parts.size() < 3:
			continue
		var out := "res://assets/anim/%s" % parts[1]
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(src.path_join(f), st) != OK:
			print("не прочитался ", f)
			continue
		var scene := doc.generate_scene(st)
		for ap in scene.find_children("*", "AnimationPlayer", true, false):
			for lib_name in (ap as AnimationPlayer).get_animation_library_list():
				var lib: AnimationLibrary = (ap as AnimationPlayer).get_animation_library(lib_name)
				for an in lib.get_animation_list():
					var a: Animation = lib.get_animation(an).duplicate(true)
					ResourceSaver.save(a, "%s/%s.res" % [out, parts[2]], ResourceSaver.FLAG_COMPRESS)
					print("%s → %s/%s.res: %.2f с, дорожек %d" % [f, out, parts[2], a.length, a.get_track_count()])
					n += 1
		scene.free()
	print("клипов: ", n)
	quit()
