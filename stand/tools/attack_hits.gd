extends SceneTree
## Момент удара в клипах Tripo: для каждого файла m_<набор>_<метка>.glb из папки (модель-заместитель с одним
## движением) — когда кисть (или голова, у укусов) дальше всего уходит вперёд от таза по горизонтали. Печатает долю
## клипа (0…1) — это поле "hit" удара в data/enemies.json — и вынос в метрах.
## Запуск: godot --path . --headless -s tools/attack_hits.gd -- --as-src=/путь/к/папке

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
	var files := Array(d.get_files())
	files.sort()
	for f in files:
		if not (String(f).begins_with("m_") and String(f).ends_with(".glb")):
			continue
		var doc := GLTFDocument.new()
		var st := GLTFState.new()
		if doc.append_from_file(src.path_join(f), st) != OK:
			continue
		var scene: Node = doc.generate_scene(st)
		get_root().add_child(scene)
		var sk: Skeleton3D = scene.find_children("*", "Skeleton3D", true, false)[0]
		var ap: AnimationPlayer = scene.find_children("*", "AnimationPlayer", true, false)[0]
		var an: String = ap.get_animation_list()[0]
		var a := ap.get_animation(an)
		ap.stop()
		var hip := sk.find_bone("Hip")
		var best := {"R_Hand": [0.0, -9.0], "L_Hand": [0.0, -9.0], "Head": [0.0, -9.0]}
		# вперёд модели — по исходной позе: от таза к носкам (средняя точка стоп), горизонтально
		var lt := sk.find_bone("L_ToeBase")
		var rt := sk.find_bone("R_ToeBase")
		var lf := sk.find_bone("L_Foot")
		var fwd := ((sk.get_bone_global_rest(lt).origin + sk.get_bone_global_rest(rt).origin) * 0.5 - (sk.get_bone_global_rest(lf).origin + sk.get_bone_global_rest(sk.find_bone("R_Foot")).origin) * 0.5)
		fwd.y = 0.0
		fwd = fwd.normalized() if fwd.length() > 0.001 else Vector3(0, 0, 1)
		# дорожки клипа → кости (позы ставятся прямо из дорожек: без обработки кадров плеер скелет не двигает)
		var tracks := []
		for ti in a.get_track_count():
			var tp := String(a.track_get_path(ti))
			var bi := sk.find_bone(tp.get_slice(":", 1)) if tp.contains(":") else -1
			if bi >= 0:
				tracks.append([ti, bi, a.track_get_type(ti)])
		var n := int(a.length * 30.0)
		for i in n + 1:
			var t := a.length * i / maxf(n, 1)
			for tr in tracks:
				match int(tr[2]):
					Animation.TYPE_ROTATION_3D:
						sk.set_bone_pose_rotation(int(tr[1]), a.rotation_track_interpolate(int(tr[0]), t))
					Animation.TYPE_POSITION_3D:
						sk.set_bone_pose_position(int(tr[1]), a.position_track_interpolate(int(tr[0]), t))
			var hp := _gpose(sk, hip).origin
			for b in best:
				var bp := _gpose(sk, sk.find_bone(b)).origin
				var reach := (bp - hp).dot(fwd)
				if reach > float(best[b][1]):
					best[b] = [t / a.length, reach]
		print("[hit] %s: %.2f с; правая %.2f (%.2f м), левая %.2f (%.2f м), голова %.2f (%.2f м)" % [f, a.length,
			best.R_Hand[0], best.R_Hand[1], best.L_Hand[0], best.L_Hand[1], best.Head[0], best.Head[1]])
		scene.queue_free()
	quit()


## поза кости в системе скелета — по цепочке родителей (без кадра движка скелет кэш не обновляет)
func _gpose(sk: Skeleton3D, b: int) -> Transform3D:
	var t := sk.get_bone_pose(b)
	var p := sk.get_bone_parent(b)
	while p >= 0:
		t = sk.get_bone_pose(p) * t
		p = sk.get_bone_parent(p)
	return t
