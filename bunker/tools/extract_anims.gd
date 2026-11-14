extends SceneTree
## Извлечь клипы из GLB (Tripo: модель + движения) в отдельные ресурсы Animation:
##   res://assets/anim/src/<набор>/*.glb → res://assets/anim/<набор>/<клип>.res
## Файлы движений по тексту называются m_<набор>_<метка>.glb — клип получает имя «m_<метка>».
## Запуск: godot --headless --path . --script res://tools/extract_anims.gd

func _init() -> void:
	var src := "res://assets/anim/src"
	var d := DirAccess.open(src)
	if d == null:
		print("нет ", src)
		quit()
		return
	for set_name in d.get_directories():
		var out := "res://assets/anim/" + set_name
		DirAccess.make_dir_recursive_absolute(ProjectSettings.globalize_path(out))
		var sd := DirAccess.open(src + "/" + set_name)
		var n := 0
		for f in sd.get_files():
			if not f.ends_with(".glb"):
				continue
			var ps: PackedScene = load(src + "/" + set_name + "/" + f)
			if ps == null:
				print("не загрузился ", f)
				continue
			var inst := ps.instantiate()
			var tag := ""
			if f.begins_with("m_"):
				# m_hero_walk_back.glb → m_walk_back
				var parts := f.get_basename().split("_", false, 2)
				tag = "m_" + (parts[2] if parts.size() > 2 else parts[-1])
			for ap in inst.find_children("*", "AnimationPlayer", true, false):
				for lib_name in ap.get_animation_library_list():
					var lib: AnimationLibrary = ap.get_animation_library(lib_name)
					for an in lib.get_animation_list():
						var a: Animation = lib.get_animation(an).duplicate(true)
						var name := tag if tag != "" else String(an).replace("preset:biped:", "")
						ResourceSaver.save(a, out + "/" + name + ".res", ResourceSaver.FLAG_COMPRESS)
						n += 1
			inst.free()
		print("набор ", set_name, ": клипов ", n)
	quit()
