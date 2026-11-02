class_name SkinBake
## Модели Tripo для персонажей без своей логики позы (муры): клипы героя из player.glb один раз пересчитываются на
## скелет новой модели — тем же переносом, что у героя (SkinFollow: повороты костей с поправкой покоя, свои длины,
## IK рук к хвату и ног к стопам) — и складываются в AnimationLibrary. Дальше её играет обычный AnimationPlayer, без
## пересчёта в каждом кадре: в «Карьере» на экране до 14 часовых и отряд — телефону это ничего не стоит.
## Заражённые — так же, но источник — старая модель с их клипами (runner.glb, stomper.glb, ruber.glb): скелет не
## Mixamo, кости сопоставляются по смыслу имени (UpperArm.L → LeftArm), поза покоя (руки вниз) поправляется.
## Библиотека, масштаб, разворот и место хвата — общие на все экземпляры модели (кэш по пути файла и источнику).

## Кадров в секунду при пересчёте (между кадрами AnimationPlayer интерполирует).
const FPS := 20.0
const SRC := "res://assets/characters/player.glb"

## путь модели → {"lib": AnimationLibrary, "scale": Vector3, "basis": Basis, "hand": имя кости, "grip": Transform3D}
static var _cache := {}

## Новая модель с анимациями clips (имена — как в player.glb): Node3D с AnimationPlayer ("AnimationPlayer") и узлом
## хвата "Grip" на правой кисти (оружие кладут в него); метаданные grip_r, grip_l, unit — для NpcPose. host — узел в дереве (на время пересчёта). null — нет модели.
## src — модель-источник клипов (по умолчанию герой); clips пусто — все клипы источника.
static func instance(path: String, clips: Array, host: Node, src := SRC) -> Node3D:
	if not ResourceLoader.exists(path) or not ResourceLoader.exists(src):
		return null
	var key := path + "|" + src + "|" + ",".join(clips)
	if not _cache.has(key):
		_cache[key] = _bake(path, clips, host, src)
	var info: Dictionary = _cache[key]
	if info.is_empty():
		return null
	var model: Node3D = (load(path) as PackedScene).instantiate()
	model.transform = Transform3D(info["basis"], Vector3.ZERO)
	for old_ap in model.find_children("*", "AnimationPlayer", true, false):
		old_ap.free()
	var sk: Skeleton3D = model.find_children("*", "Skeleton3D", true, false)[0]
	var ap := AnimationPlayer.new()
	ap.name = "AnimationPlayer"
	model.add_child(ap)
	ap.root_node = NodePath("..")
	ap.add_animation_library("", info["lib"])
	if str(info["hand"]) != "":
		var ba := BoneAttachment3D.new()
		ba.name = "HandR"
		ba.bone_name = str(info["hand"])
		sk.add_child(ba)
		var grip := Node3D.new()
		grip.name = "Grip"
		grip.transform = info["grip"]
		ba.add_child(grip)
	# для позы оружия (NpcPose): хват правой, опора цевья у левой — в осях костей кистей; метров в единице скелета
	model.set_meta("grip_r", info["grip"])
	model.set_meta("grip_l", info["grip_l"])
	model.set_meta("unit", info["unit"])
	return model

static func _bake(path: String, clips: Array, host: Node, src: String) -> Dictionary:
	var t0 := Time.get_ticks_msec()
	var old: Node3D = (load(src) as PackedScene).instantiate()
	var model: Node3D = (load(path) as PackedScene).instantiate()
	host.add_child(old)
	host.add_child(model)
	old.visible = false
	model.visible = false
	old.global_transform = Transform3D.IDENTITY
	model.global_transform = Transform3D.IDENTITY
	var osks := old.find_children("*", "Skeleton3D", true, false)
	var dsks := model.find_children("*", "Skeleton3D", true, false)
	var oap := old.find_child("AnimationPlayer", true, false) as AnimationPlayer
	if osks.is_empty() or dsks.is_empty() or oap == null:
		old.queue_free()
		model.queue_free()
		return {}
	var osk: Skeleton3D = osks[0]
	var dsk: Skeleton3D = dsks[0]
	oap.active = false
	Gear.fit_body(model, dsk, osk)
	var follow := SkinFollow.new()
	model.add_child(follow)
	follow.bind(osk, dsk)
	if osk.skeleton_updated.is_connected(follow._follow):
		osk.skeleton_updated.disconnect(follow._follow)
	var hips := follow.hips
	var sk_path := str(model.get_path_to(dsk))
	var lib := AnimationLibrary.new()
	var frames := 0
	if clips.is_empty():
		clips = Array(oap.get_animation_list())
	for c in clips:
		if not oap.has_animation(c) or lib.has_animation(c):
			continue
		var a: Animation = oap.get_animation(c)
		# дорожки клипа: [номер, кость, тип]
		var tracks: Array = []
		for t in a.get_track_count():
			var tp := a.track_get_type(t)
			if tp != Animation.TYPE_ROTATION_3D and tp != Animation.TYPE_POSITION_3D:
				continue
			var bi := osk.find_bone(str(a.track_get_path(t).get_concatenated_subnames()))
			if bi >= 0:
				tracks.append([t, bi, tp])
		var n := maxi(2, int(ceil(a.length * FPS)) + 1)
		var rots: Array = []
		rots.resize(dsk.get_bone_count())
		for b in dsk.get_bone_count():
			rots[b] = []
		var hip_pos: Array = []
		for f in n:
			var time := minf(a.length, float(f) / FPS)
			osk.reset_bone_poses()
			for tr in tracks:
				if tr[2] == Animation.TYPE_ROTATION_3D:
					osk.set_bone_pose_rotation(tr[1], a.rotation_track_interpolate(tr[0], time))
				else:
					osk.set_bone_pose_position(tr[1], a.position_track_interpolate(tr[0], time))
			follow._follow(true)
			for b in dsk.get_bone_count():
				rots[b].append(dsk.get_bone_pose_rotation(b))
			if hips >= 0:
				hip_pos.append(dsk.get_bone_pose_position(hips))
			frames += 1
		var out := Animation.new()
		out.length = a.length
		out.loop_mode = a.loop_mode
		for b in dsk.get_bone_count():
			# кость, которая весь клип в позе покоя, дорожки не получает
			var rest := dsk.get_bone_rest(b).basis.get_rotation_quaternion()
			var moves := false
			for q in rots[b]:
				if absf((q as Quaternion).dot(rest)) < 0.99999:
					moves = true
					break
			if not moves:
				continue
			var ti := out.add_track(Animation.TYPE_ROTATION_3D)
			out.track_set_path(ti, NodePath(sk_path + ":" + dsk.get_bone_name(b)))
			for f in n:
				out.rotation_track_insert_key(ti, minf(a.length, float(f) / FPS), rots[b][f])
		if hips >= 0:
			var pi := out.add_track(Animation.TYPE_POSITION_3D)
			out.track_set_path(pi, NodePath(sk_path + ":" + dsk.get_bone_name(hips)))
			for f in n:
				out.position_track_insert_key(pi, minf(a.length, float(f) / FPS), hip_pos[f])
		lib.add_animation(c, out)
	var rg: Array = follow.right_grip()
	var lg: Array = follow.left_grip()
	var info := {"lib": lib, "basis": model.transform.basis, "hand": dsk.get_bone_name(int(rg[0])) if int(rg[0]) >= 0 else "",
		"grip": rg[1], "grip_l": lg[1], "unit": model.transform.basis.get_scale().x}
	old.queue_free()
	model.queue_free()
	print("SkinBake: %s — клипов %d, кадров %d, %d мс" % [path.get_file(), lib.get_animation_list().size(), frames, Time.get_ticks_msec() - t0])
	return info
