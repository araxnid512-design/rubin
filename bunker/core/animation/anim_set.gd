class_name BCAnimSet
## Набор клипов BunkerCore. Клипы берутся из GLB с тем же скелетом (Tripo, родная схема костей BoneRoot/Hip/…),
## пути дорожек переносятся на скелет героя, лишнее (дорожки масштаба, кости, которых нет) убирается.
## Для клипов передвижения — «на месте»: горизонтальный сдвиг корня (Hip) вычитается, вертикальное покачивание
## остаётся; родная скорость клипа (м/с) запоминается — по ней подбирается скорость проигрывания, чтобы стопы
## не скользили по полу. Описание клипов — res://game/data/anim_clips.json.

const CONFIG := "res://game/data/anim_clips.json"

static var _src_cache := {}


static func load_config() -> Dictionary:
	var f := FileAccess.open(CONFIG, FileAccess.READ)
	if f == null:
		push_error("BCAnimSet: нет " + CONFIG)
		return {}
	var d = JSON.parse_string(f.get_as_text())
	return d if d is Dictionary else {}


static func save_config(cfg: Dictionary) -> void:
	var f := FileAccess.open(CONFIG, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(cfg, "\t", false))


## исходная анимация из «файл.glb#имя»
static func _source(spec: String) -> Animation:
	var parts := spec.split("#")
	var path := parts[0]
	var name := parts[1] if parts.size() > 1 else ""
	if not _src_cache.has(path):
		var anims := {}
		if ResourceLoader.exists(path):
			var res = load(path)
			if res is PackedScene:
				var inst: Node = res.instantiate()
				for ap in inst.find_children("*", "AnimationPlayer", true, false):
					for lib_name in ap.get_animation_library_list():
						var lib: AnimationLibrary = ap.get_animation_library(lib_name)
						for an in lib.get_animation_list():
							anims[an] = lib.get_animation(an)
				inst.free()
			elif res is Animation:
				anims[path.get_file().get_basename()] = res
		_src_cache[path] = anims
	var all: Dictionary = _src_cache[path]
	if name == "" and all.size() > 0:
		return all.values()[0]
	return all.get(name)


## построить библиотеку для скелета skel; ap_root — узел, от которого AnimationPlayer считает пути
## scale — во сколько раз модель героя больше исходной (для скорости клипов в метрах)
static func build(skel: Skeleton3D, ap_root: Node, cfg: Dictionary, scale: float, set_dir := "res://assets/anim/hero") -> Dictionary:
	var lib := AnimationLibrary.new()
	var info := {}
	var skel_path := String(ap_root.get_path_to(skel))
	var clips: Dictionary = cfg.get("clips", {})
	var root_bone: String = cfg.get("root_bone", "Hip")
	# «вперёд» модели — по клипу ходьбы (нужно для зеркалирования)
	var mirror_fwd := Vector3.RIGHT
	if clips.has("walk"):
		for spec in clips.walk.get("src", []):
			var wa := _source(String(spec).replace("{set}", set_dir))
			if wa:
				var tmp: Animation = wa.duplicate(true)
				_retarget(tmp, skel, skel_path)
				var rr := _strip_root(tmp, skel, root_bone)
				if rr[1] != Vector3.ZERO:
					mirror_fwd = rr[1]
				break
	for clip_name in clips:
		var c: Dictionary = clips[clip_name]
		var src: Animation = null
		for spec in c.get("src", []):
			src = _source(String(spec).replace("{set}", set_dir))
			if src:
				break
		if src == null:
			continue
		var a: Animation = src.duplicate(true)
		_retarget(a, skel, skel_path)
		var t0: float = c.get("from", 0.0)
		var t1: float = c.get("to", -1.0)
		if t0 > 0.0 or t1 > 0.0:
			a = _trim(a, t0, t1 if t1 > 0.0 else a.length)
		var speed := 0.0
		var dir := Vector3.ZERO
		if c.get("inplace", false):
			var rr := _strip_root(a, skel, root_bone, c.get("root_lock", false))
			speed = rr[0] * scale
			dir = rr[1]
		if c.get("mirror", false):
			a = _mirror(a, skel, mirror_fwd)
		if c.get("hold", false):
			a = _hold_last(a)
		a.loop_mode = Animation.LOOP_LINEAR if c.get("loop", false) else Animation.LOOP_NONE
		lib.add_animation(clip_name, a)
		info[clip_name] = {"len": a.length, "speed": c.get("speed", speed), "loop": c.get("loop", false),
			"blend": c.get("blend", 0.2), "rate": c.get("rate", 1.0), "lock": c.get("lock", true), "native": speed, "dir": dir}
	return {"lib": lib, "info": info}


## пути дорожек «…/Skeleton3D:Кость» → путь к нашему скелету; дорожки масштаба и чужие кости — прочь
static func _retarget(a: Animation, skel: Skeleton3D, skel_path: String) -> void:
	for i in range(a.get_track_count() - 1, -1, -1):
		var p := String(a.track_get_path(i))
		var colon := p.find(":")
		if colon < 0 or a.track_get_type(i) == Animation.TYPE_SCALE_3D:
			a.remove_track(i)
			continue
		var bone := p.substr(colon + 1)
		if skel.find_bone(bone) < 0:
			a.remove_track(i)
			continue
		a.track_set_path(i, NodePath(skel_path + ":" + bone))


## вырезать часть клипа [t0; t1]
static func _trim(a: Animation, t0: float, t1: float) -> Animation:
	var b := Animation.new()
	b.length = t1 - t0
	for i in a.get_track_count():
		var ti := b.add_track(a.track_get_type(i))
		b.track_set_path(ti, a.track_get_path(i))
		b.track_set_interpolation_type(ti, a.track_get_interpolation_type(i))
		# ключи на границах — из интерполяции
		var t := t0
		var step := 1.0 / 30.0
		while t <= t1 + 0.0001:
			var v = _sample(a, i, t)
			if v != null:
				b.track_insert_key(ti, t - t0, v)
			t += step
	return b


static func _sample(a: Animation, i: int, t: float):
	match a.track_get_type(i):
		Animation.TYPE_POSITION_3D:
			return a.position_track_interpolate(i, t)
		Animation.TYPE_ROTATION_3D:
			return a.rotation_track_interpolate(i, t)
		Animation.TYPE_SCALE_3D:
			return a.scale_track_interpolate(i, t)
	return null


## поза из последнего кадра (держится, пока не снимут)
static func _hold_last(a: Animation) -> Animation:
	var b := Animation.new()
	b.length = 1.0
	for i in a.get_track_count():
		var ti := b.add_track(a.track_get_type(i))
		b.track_set_path(ti, a.track_get_path(i))
		var v = _sample(a, i, a.length)
		if v != null:
			b.track_insert_key(ti, 0.0, v)
	return b


## «на месте»: вычесть горизонтальный дрейф кости-корня; вернуть родную скорость (единиц модели/с)
static func _strip_root(a: Animation, skel: Skeleton3D, root_bone: String, lock := false) -> Array:
	var bi := skel.find_bone(root_bone)
	if bi < 0:
		return [0.0, Vector3.ZERO]
	var track := -1
	for i in a.get_track_count():
		if a.track_get_type(i) == Animation.TYPE_POSITION_3D and String(a.track_get_path(i)).ends_with(":" + root_bone):
			track = i
	if track < 0 or a.track_get_key_count(track) < 2:
		return [0.0, Vector3.ZERO]
	# «вверх» модели в системе родителя кости
	var parent := skel.get_bone_parent(bi)
	var pb := skel.get_bone_global_rest(parent).basis if parent >= 0 else Basis.IDENTITY
	var up := (pb.inverse() * Vector3.UP).normalized()
	var n := a.track_get_key_count(track)
	var v0: Vector3 = a.track_get_key_value(track, 0)
	var v1: Vector3 = a.track_get_key_value(track, n - 1)
	var T := a.track_get_key_time(track, n - 1) - a.track_get_key_time(track, 0)
	var drift := v1 - v0
	var hdrift := drift - up * drift.dot(up)
	if T <= 0.0:
		return [0.0, Vector3.ZERO]
	for k in n:
		var t := a.track_get_key_time(track, k)
		var v: Vector3 = a.track_get_key_value(track, k)
		if lock:
			# переходные клипы (старт, остановка): движение неравномерное — таз держим на месте по горизонтали
			var dv := v - v0
			a.track_set_key_value(track, k, v - (dv - up * dv.dot(up)))
		else:
			a.track_set_key_value(track, k, v - hdrift * (t / T))
	# скорость — длина дрейфа в мировых единицах модели (масштаб родителя учитывается позже)
	var w := pb * hdrift
	return [w.length() / T, Vector3(w.x, 0, w.z).normalized()]


## зеркальный клип (налево ↔ направо) через позы в пространстве скелета: на каждом кадре собирается поза всего
## скелета, отражается относительно плоскости симметрии модели (боковая ось = вверх × вперёд), кости L_ ↔ R_
## меняются местами, затем позы снова переводятся в локальные. fwd — «вперёд» модели в пространстве скелета.
static func _mirror(a: Animation, skel: Skeleton3D, fwd := Vector3.RIGHT) -> Animation:
	var lat := Vector3.UP.cross(fwd).normalized()
	var M := Basis(Vector3.RIGHT - 2.0 * lat * lat.x, Vector3.UP - 2.0 * lat * lat.y, Vector3.BACK - 2.0 * lat * lat.z)
	var nb := skel.get_bone_count()
	var rot_t := {}
	var pos_t := {}
	for i in a.get_track_count():
		var p := String(a.track_get_path(i))
		var bi := skel.find_bone(p.substr(p.find(":") + 1))
		if bi < 0:
			continue
		if a.track_get_type(i) == Animation.TYPE_ROTATION_3D:
			rot_t[bi] = i
		elif a.track_get_type(i) == Animation.TYPE_POSITION_3D:
			pos_t[bi] = i
	var pair := []
	for b in nb:
		var n := skel.get_bone_name(b)
		var o := n
		if n.begins_with("L_"):
			o = "R_" + n.substr(2)
		elif n.begins_with("R_"):
			o = "L_" + n.substr(2)
		var oi := skel.find_bone(o)
		pair.append(oi if oi >= 0 else b)
	var skel_path := ""
	for i in a.get_track_count():
		var p := String(a.track_get_path(i))
		skel_path = p.substr(0, p.find(":"))
		break
	var out := Animation.new()
	out.length = a.length
	var new_rot := {}
	var new_pos := {}
	for b in nb:
		if rot_t.has(b) or rot_t.has(pair[b]):
			var ti := out.add_track(Animation.TYPE_ROTATION_3D)
			out.track_set_path(ti, NodePath(skel_path + ":" + skel.get_bone_name(b)))
			new_rot[b] = ti
		if pos_t.has(b) or pos_t.has(pair[b]):
			var tp := out.add_track(Animation.TYPE_POSITION_3D)
			out.track_set_path(tp, NodePath(skel_path + ":" + skel.get_bone_name(b)))
			new_pos[b] = tp
	var t := 0.0
	var step := 1.0 / 30.0
	while t <= a.length + 0.0001:
		# поза в пространстве скелета
		var G := []
		G.resize(nb)
		for b in nb:
			var rest := skel.get_bone_rest(b)
			var q: Quaternion = a.rotation_track_interpolate(rot_t[b], t) if rot_t.has(b) else rest.basis.get_rotation_quaternion()
			var pv: Vector3 = a.position_track_interpolate(pos_t[b], t) if pos_t.has(b) else rest.origin
			var L := Transform3D(Basis(q), pv)
			var par := skel.get_bone_parent(b)
			G[b] = (G[par] * L) if par >= 0 else L
		# отражение и обмен сторон
		var GM := []
		GM.resize(nb)
		for b in nb:
			var src: Transform3D = G[pair[b]]
			GM[b] = Transform3D(M * src.basis * M, M * src.origin)
		for b in nb:
			var par := skel.get_bone_parent(b)
			var Lm: Transform3D = ((GM[par] as Transform3D).affine_inverse() * GM[b]) if par >= 0 else GM[b]
			if new_rot.has(b):
				out.rotation_track_insert_key(new_rot[b], t, Lm.basis.orthonormalized().get_rotation_quaternion())
			if new_pos.has(b):
				out.position_track_insert_key(new_pos[b], t, Lm.origin)
		t += step
	return out
