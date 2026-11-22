class_name BCAnimSet
## Набор клипов BunkerCore. Клипы берутся из GLB с тем же скелетом (Tripo, родная схема костей BoneRoot/Hip/…),
## пути дорожек переносятся на скелет героя, лишнее (дорожки масштаба, кости, которых нет) убирается.
## Для клипов передвижения — «на месте»: горизонтальный сдвиг корня (Hip) вычитается, вертикальное покачивание
## остаётся; родная скорость клипа (м/с) запоминается — по ней подбирается скорость проигрывания, чтобы стопы
## не скользили по полу. Описание клипов — res://game/data/anim_clips.json.

const CONFIG := "res://data/anim_clips.json"

static var _src_cache := {}
static var _ref_cache := {}       ## набор клипов → исходная поза скелета, с которого они сняты: {кость: поворот}


## исходная поза скелета-образца набора (модель с тем же именем, что и набор: anim/hero → models/hero.glb).
## Если модели-образца в игре уже нет (её заменила новая), поза берётся из записи rest.json в папке набора
## (её делает tools/anim_rest_dump.gd из старой модели).
static func _ref_rest(set_dir: String) -> Dictionary:
	if _ref_cache.has(set_dir):
		return _ref_cache[set_dir]
	var out := {}
	var js := set_dir.path_join("rest.json")
	if FileAccess.file_exists(js):
		out = rest_from_json(FileAccess.get_file_as_string(js))
	else:
		out = rest_of("res://assets/models/%s.glb" % set_dir.get_file())
	_ref_cache[set_dir] = out
	return out


## исходная поза скелета модели: {кость: поворот}, "__dirs": {кость: [дальний ребёнок, направление]}, "__hip": высота таза
static func rest_of(path: String) -> Dictionary:
	var out := {}
	if ResourceLoader.exists(path):
		var inst: Node = (load(path) as PackedScene).instantiate()
		var found := inst.find_children("*", "Skeleton3D", true, false)
		if found.size() > 0:
			var sk: Skeleton3D = found[0]
			var dirs := {}
			for i in sk.get_bone_count():
				out[sk.get_bone_name(i)] = sk.get_bone_global_rest(i).basis.get_rotation_quaternion()
				# куда «смотрит» кость в исходной позе: на самого дальнего из своих детей
				var best := ""
				var bd := 0.008
				for c in sk.get_bone_children(i):
					var l := sk.get_bone_global_rest(c).origin.distance_to(sk.get_bone_global_rest(i).origin)
					if l > bd:
						bd = l
						best = sk.get_bone_name(c)
				if best != "":
					dirs[sk.get_bone_name(i)] = [best, (sk.get_bone_global_rest(sk.find_bone(best)).origin - sk.get_bone_global_rest(i).origin).normalized()]
			out["__dirs"] = dirs
			var hip := sk.find_bone("Hip")
			out["__hip"] = sk.get_bone_global_rest(hip).origin.y if hip >= 0 else 0.0
		inst.free()
	return out


static func rest_to_json(r: Dictionary) -> String:
	var bones := {}
	var dirs := {}
	for k in r:
		if r[k] is Quaternion:
			var q: Quaternion = r[k]
			bones[k] = [q.x, q.y, q.z, q.w]
	var rd: Dictionary = r.get("__dirs", {})
	for k in rd:
		var v: Vector3 = rd[k][1]
		dirs[k] = [rd[k][0], v.x, v.y, v.z]
	return JSON.stringify({"bones": bones, "dirs": dirs, "hip": r.get("__hip", 0.0)}, "\t")


static func rest_from_json(text: String) -> Dictionary:
	var d = JSON.parse_string(text)
	var out := {}
	if not d is Dictionary:
		return out
	var bones: Dictionary = d.get("bones", {})
	for k in bones:
		var a: Array = bones[k]
		out[k] = Quaternion(float(a[0]), float(a[1]), float(a[2]), float(a[3]))
	var dirs := {}
	var dd: Dictionary = d.get("dirs", {})
	for k in dd:
		var a: Array = dd[k]
		dirs[k] = [String(a[0]), Vector3(float(a[1]), float(a[2]), float(a[3]))]
	out["__dirs"] = dirs
	out["__hip"] = float(d.get("hip", 0.0))
	return out


## Поправка для чужого скелета. Кости у моделей Tripo называются одинаково, но в исходной позе повёрнуты
## по-разному (корень, таз, у иных — вся рука закручена вокруг своей оси). Клип хранит повороты костей как есть,
## и на другом скелете та же запись гнёт сетку иначе. Поправка D(кость) = образец⁻¹ · наш: с ней кость
## поворачивается относительно СВОЕЙ исходной позы так же, как у образца относительно его.
## Пусто — скелет тот же (поправка не нужна).
static func _rest_fix(skel: Skeleton3D, set_dir: String) -> Dictionary:
	var ref := _ref_rest(set_dir)
	if ref.is_empty():
		return {}
	var d := {}
	var worst := 0.0
	var dirs: Dictionary = ref.get("__dirs", {})
	for i in skel.get_bone_count():
		var n := skel.get_bone_name(i)
		if ref.has(n) and ref[n] is Quaternion:
			var rt := skel.get_bone_global_rest(i).basis.get_rotation_quaternion()
			# Модели стоят в исходной позе по-разному (руки в стороны или опущены под углом). Это не закрутка кости,
			# а сама поза — её в поправку не берём: исходная поза нашего скелета сначала «доводится» до позы
			# образца (кость смотрит туда же, куда у него), и уже от неё считается закрутка. Иначе рука, которая у
			# модели и так опущена, опускалась бы ещё раз и уходила в тело.
			# (стопы — исключение: им важно не направление кости, а чтобы подошва осталась на полу, как в исходной позе)
			if dirs.has(n) and not (n.ends_with("Foot") or n.ends_with("ToeBase")):
				var ci := skel.find_bone(String(dirs[n][0]))
				if ci >= 0:
					var dt := skel.get_bone_global_rest(ci).origin - skel.get_bone_global_rest(i).origin
					if dt.length() > 0.008:
						var ds: Vector3 = dirs[n][1]
						if ds.dot(dt.normalized()) > -0.999:
							rt = Quaternion(ds, dt.normalized()).inverse() * rt
			var q: Quaternion = ((ref[n] as Quaternion).inverse() * rt).normalized()
			d[n] = q
			worst = maxf(worst, 2.0 * acos(clampf(absf(q.w), 0.0, 1.0)))
	if worst < deg_to_rad(0.5):
		return {}
	var hip := skel.find_bone("Hip")
	var h_ref := float(ref.get("__hip", 0.0))
	d["__k"] = (skel.get_bone_global_rest(hip).origin.y / h_ref) if hip >= 0 and h_ref > 0.001 else 1.0
	return d


static func load_config(path := CONFIG) -> Dictionary:
	var f := FileAccess.open(path, FileAccess.READ)
	if f == null:
		push_error("BCAnimSet: нет " + path)
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
	# поправка под чужой скелет — своя для каждой папки-источника: клипы, снятые с этой же модели (её собственный
	# набор), идут как есть, а взятые из набора героя — пересчитываются
	var fixes := {}
	# «вперёд» модели — по клипу ходьбы (нужно для зеркалирования)
	var mirror_fwd := Vector3.RIGHT
	if clips.has("walk"):
		for spec in clips.walk.get("src", []):
			var wp := String(spec).replace("{set}", set_dir)
			var wa := _source(wp)
			if wa:
				var tmp: Animation = wa.duplicate(true)
				_retarget(tmp, skel, skel_path, _fix_for(fixes, skel, wp), root_bone)
				var rr := _strip_root(tmp, skel, root_bone)
				if rr[1] != Vector3.ZERO:
					mirror_fwd = rr[1]
				break
	for clip_name in clips:
		var c: Dictionary = clips[clip_name]
		var src: Animation = null
		var src_path := ""
		for spec in c.get("src", []):
			src_path = String(spec).replace("{set}", set_dir)
			src = _source(src_path)
			if src:
				break
		if src == null:
			continue
		var a: Animation = src.duplicate(true)
		_retarget(a, skel, skel_path, _fix_for(fixes, skel, src_path), root_bone)
		if c.get("reverse", false):
			a = _reverse(a)
		var t0: float = c.get("from", 0.0)
		var t1: float = c.get("to", -1.0)
		if t0 > 0.0 or t1 > 0.0:
			a = _trim(a, t0, t1 if t1 > 0.0 else a.length)
		var speed := 0.0
		var dir := Vector3.ZERO
		if c.get("bake", "") != "":
			# движения по описанию: корень считается в системе скелета (см. _bake_root)
			var rb := _bake_root(a, skel, root_bone, String(c.bake), bool(c.get("heading_lock", false)), float(c.get("sway", 0.0)))
			speed = rb[0] * scale
			dir = rb[1]
		elif c.get("inplace", false):
			var rr := _strip_root(a, skel, root_bone, c.get("root_lock", false))
			speed = rr[0] * scale
			dir = rr[1]
			if c.get("root_smooth", 0.0) > 0.0:
				_flatten_root(a, skel, root_bone, c.root_smooth)
		elif c.get("center", false):
			# стойка: тело над капсулой (у готового «idle» таз в среднем в 12 см от точки персонажа)
			_flatten_root(a, skel, root_bone, a.length * 2.0)
		if c.get("mirror", false):
			a = _mirror(a, skel, mirror_fwd)
		if c.get("loop", false) and c.get("loop_fix", 0.0) > 0.0:
			_loop_fix(a, c.loop_fix)
		if c.get("loop", false) and c.get("phase", 0.0) > 0.0:
			# цикл шага начинается с постановки левой стопы — фазы клипов передвижения совпадают при смешении
			a = _cycle(a, c.phase)
		if c.get("hold", false):
			a = _hold_last(a)
		a.loop_mode = Animation.LOOP_LINEAR if c.get("loop", false) else Animation.LOOP_NONE
		lib.add_animation(clip_name, a)
		info[clip_name] = {"len": a.length, "speed": c.get("speed", speed), "loop": c.get("loop", false),
			"blend": c.get("blend", 0.2), "rate": c.get("rate", 1.0), "lock": c.get("lock", true), "native": speed, "dir": dir,
			"phase": c.get("phase", 0.0), "strides": c.get("strides", 0.0), "ik": c.get("ik", false), "off": c.get("off", false), "ground": c.get("ground", false)}
	return {"lib": lib, "info": info}


static func _fix_for(fixes: Dictionary, skel: Skeleton3D, path: String) -> Dictionary:
	var dir := path.split("#")[0].get_base_dir()
	if not fixes.has(dir):
		fixes[dir] = _rest_fix(skel, dir)
	return fixes[dir]


## пути дорожек «…/Skeleton3D:Кость» → путь к нашему скелету; дорожки масштаба и чужие кости — прочь
## fix — поправка для чужого скелета (_rest_fix): повороты пересчитываются в его исходную позу, сдвиг таза —
## в его рост; сдвиги остальных костей убираются (длины костей — свои)
static func _retarget(a: Animation, skel: Skeleton3D, skel_path: String, fix := {}, root_bone := "Hip") -> void:
	for i in range(a.get_track_count() - 1, -1, -1):
		var p := String(a.track_get_path(i))
		var colon := p.find(":")
		if colon < 0 or a.track_get_type(i) == Animation.TYPE_SCALE_3D:
			a.remove_track(i)
			continue
		var bone := p.substr(colon + 1)
		var bi := skel.find_bone(bone)
		if bi < 0:
			a.remove_track(i)
			continue
		a.track_set_path(i, NodePath(skel_path + ":" + bone))
		if fix.is_empty():
			continue
		var par := skel.get_bone_parent(bi)
		var dp_inv: Quaternion = (fix.get(skel.get_bone_name(par), Quaternion.IDENTITY) as Quaternion).inverse() if par >= 0 else Quaternion.IDENTITY
		var tp := a.track_get_type(i)
		if tp == Animation.TYPE_ROTATION_3D:
			var db: Quaternion = fix.get(bone, Quaternion.IDENTITY)
			for k in a.track_get_key_count(i):
				a.track_set_key_value(i, k, (dp_inv * (a.track_get_key_value(i, k) as Quaternion) * db).normalized())
		elif tp == Animation.TYPE_POSITION_3D:
			if bone != root_bone:
				a.remove_track(i)
				continue
			var kk := float(fix.get("__k", 1.0))
			for k in a.track_get_key_count(i):
				a.track_set_key_value(i, k, (dp_inv * (a.track_get_key_value(i, k) as Vector3)) * kk)


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


## клип задом наперёд (встать = «сесть» наоборот: начинается ровно в позе, которой кончается посадка)
static func _reverse(a: Animation) -> Animation:
	var L := a.length
	var b := Animation.new()
	b.length = L
	var step := 1.0 / 30.0
	var n := maxi(1, int(round(L / step)))
	for i in a.get_track_count():
		var ti := b.add_track(a.track_get_type(i))
		b.track_set_path(ti, a.track_get_path(i))
		b.track_set_interpolation_type(ti, a.track_get_interpolation_type(i))
		for k in n + 1:
			var t := L * k / n
			var v = _sample(a, i, L - t)
			if v != null:
				b.track_insert_key(ti, t, v)
	return b


## сдвинуть зацикленный клип: новый t = 0 — это старый t = shift
static func _cycle(a: Animation, shift: float) -> Animation:
	var L := a.length
	shift = fposmod(shift, L)
	var b := Animation.new()
	b.length = L
	var step := 1.0 / 30.0
	var n := int(round(L / step))
	for i in a.get_track_count():
		var ti := b.add_track(a.track_get_type(i))
		b.track_set_path(ti, a.track_get_path(i))
		b.track_set_interpolation_type(ti, a.track_get_interpolation_type(i))
		for k in n + 1:
			var t := L * k / n
			var v = _sample(a, i, fposmod(t + shift, L) if k < n else shift)
			if v != null:
				b.track_insert_key(ti, t, v)
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
	# тело — над капсулой: среднее горизонтальное положение таза в ноль (у готового «run» Tripo таз в начале
	# клипа уже сдвинут на 0.9 м — бегущий герой оказывался впереди своей капсулы)
	var mean := Vector3.ZERO
	for k in n:
		mean += a.track_get_key_value(track, k)
	mean /= n
	var mh := mean - up * mean.dot(up)
	for k in n:
		a.track_set_key_value(track, k, (a.track_get_key_value(track, k) as Vector3) - mh)
	# скорость — длина дрейфа в мировых единицах модели (масштаб родителя учитывается позже)
	var w := pb * hdrift
	return [w.length() / T, Vector3(w.x, 0, w.z).normalized()]


## Корень клипа в системе скелета — для движений, снятых Tripo по описанию. В таких клипах вращается и сам корень
## (BoneRoot: тело поворачивается на 15–20°, путь идёт дугой), а таз (Hip) едет в системе этого вращающегося корня.
## Прежняя обработка (_strip_root) вычитала сдвиг таза в неподвижной системе корня — при повороте корня ошибка
## достигала метра: тело моталось вбок от капсулы. Здесь:
##   1) курс корня приводится к курсу исходной позы модели (лицом туда же, куда модель смотрит в покое);
##      heading_lock — курс держится так весь клип (тело не виляет), иначе выравнивается только начало;
##   2) путь таза в системе скелета; при heading_lock — «выпрямляется» (скорость поворачивается вместе с курсом);
##   3) mode: "inplace" — равномерный ход вычитается (клип на месте; остаётся покачивание, а при sway > 0 — ещё и
##      медленный увод: вычитается скользящее среднее за sway секунд), "lock" — таз по горизонтали на месте,
##      "center" — среднее положение таза над капсулой, "keep" — путь как есть (падения);
##   4) обратно в систему корня. Возвращает [скорость ед./с, направление хода в системе скелета].
static func _bake_root(a: Animation, skel: Skeleton3D, hip_name: String, mode: String, heading_lock: bool, sway: float) -> Array:
	var hip := skel.find_bone(hip_name)
	if hip < 0:
		return [0.0, Vector3.ZERO]
	var rb := skel.get_bone_parent(hip)
	if rb < 0:
		return [0.0, Vector3.ZERO]
	var tr_r := -1
	var tr_h := -1
	for i in a.get_track_count():
		var bn := String(a.track_get_path(i)).get_slice(":", 1)
		if bn == skel.get_bone_name(rb) and a.track_get_type(i) == Animation.TYPE_ROTATION_3D:
			tr_r = i
		elif bn == hip_name and a.track_get_type(i) == Animation.TYPE_POSITION_3D:
			tr_h = i
	if tr_h < 0 or a.track_get_key_count(tr_h) < 2:
		return [0.0, Vector3.ZERO]
	var root_rest := skel.get_bone_rest(rb)
	var p0 := root_rest.origin
	var qr := root_rest.basis.get_rotation_quaternion()
	# «вперёд» исходной позы — по бёдрам (левое минус правое, поперёк вертикали)
	var lt := skel.find_bone("L_Thigh")
	var rt := skel.find_bone("R_Thigh")
	var fwd := Vector3.BACK
	if lt >= 0 and rt >= 0:
		var left := skel.get_bone_global_rest(lt).origin - skel.get_bone_global_rest(rt).origin
		left.y = 0.0
		if left.length() > 1e-4:
			fwd = left.cross(Vector3.UP).normalized()
	var vloc := qr.inverse() * fwd
	var th_ref := atan2(fwd.x, fwd.z)
	var orig := a.duplicate(true)
	var qa := func(t: float) -> Quaternion:
		return orig.rotation_track_interpolate(tr_r, t) if tr_r >= 0 else qr
	var corr := func(q: Quaternion) -> float:
		var h: Vector3 = q * vloc
		return angle_difference(atan2(h.x, h.z), th_ref)
	var c0: float = corr.call(qa.call(0.0))
	# 1) курс корня
	if tr_r >= 0:
		for k in a.track_get_key_count(tr_r):
			var q: Quaternion = a.track_get_key_value(tr_r, k)
			var c: float = corr.call(q) if heading_lock else c0
			a.track_set_key_value(tr_r, k, (Quaternion(Vector3.UP, c) * q).normalized())
	# 2) путь таза в системе скелета
	var n := a.track_get_key_count(tr_h)
	var ts: Array[float] = []
	var P: Array[Vector3] = []
	var Q: Array[Quaternion] = []
	for k in n:
		var t := a.track_get_key_time(tr_h, k)
		var q: Quaternion = qa.call(t)
		var c: float = corr.call(q) if heading_lock else c0
		var qn := (Quaternion(Vector3.UP, c) * q).normalized()
		ts.append(t)
		Q.append(qn)
		# положение таза при исходном (невыпрямленном) корне — и та же точка, повёрнутая вместе с курсом
		P.append(p0 + q * (a.track_get_key_value(tr_h, k) as Vector3))
	var W: Array[Vector3] = []
	W.resize(n)
	W[0] = p0 + Quaternion(Vector3.UP, (corr.call(qa.call(ts[0])) if heading_lock else c0)) * (P[0] - p0)
	for k in range(1, n):
		var c: float = corr.call(qa.call(ts[k])) if heading_lock else c0
		var dv := Quaternion(Vector3.UP, c) * (P[k] - P[k - 1])
		W[k] = W[k - 1] + dv
	var T := ts[n - 1] - ts[0]
	var drift := W[n - 1] - W[0]
	drift.y = 0.0
	var speed := drift.length() / T if T > 0.0 else 0.0
	var dir := drift.normalized() if drift.length() > 1e-4 else Vector3.ZERO
	# 3) что делать с ходом
	if mode == "inplace" or mode == "lock" or mode == "center":
		for k in n:
			var x := W[k]
			if mode == "lock":
				W[k] = Vector3(W[0].x, x.y, W[0].z)
			elif mode == "inplace":
				W[k] = x - drift * ((ts[k] - ts[0]) / T if T > 0.0 else 0.0)
		if mode == "inplace" and sway > 0.0:
			# медленный увод — вычитается скользящее среднее (по кругу: клип зациклен)
			var S: Array[Vector3] = []
			for k in n:
				var acc := Vector3.ZERO
				var m := 0
				for j in n:
					var dt := absf(ts[j] - ts[k])
					dt = minf(dt, T - dt)
					if dt <= sway * 0.5:
						acc += W[j]
						m += 1
				S.append(acc / maxf(m, 1))
			for k in n:
				W[k] = Vector3(W[k].x - S[k].x + S[0].x, W[k].y, W[k].z - S[k].z + S[0].z)
		# тело над капсулой: среднее положение таза по горизонтали — там же, где в исходной позе
		var mean := Vector3.ZERO
		for k in n:
			mean += W[k]
		mean /= n
		var rest_hip := p0 + qr * skel.get_bone_rest(hip).origin
		var sh := Vector3(mean.x - rest_hip.x, 0.0, mean.z - rest_hip.z)
		for k in n:
			W[k] -= sh
	# 4) обратно в систему корня
	for k in n:
		a.track_set_key_value(tr_h, k, Q[k].inverse() * (W[k] - p0))
	return [speed, dir]


## стык цикла: поза последнего кадра не совпадает с первой — в последние w секунд добавляется поправка,
## плавно (smoothstep) доводящая конец клипа до позы первого кадра (повороты — slerp поправки, позиции — сдвиг)
static func _loop_fix(a: Animation, w: float) -> void:
	var L := a.length
	w = minf(w, L * 0.5)
	for i in a.get_track_count():
		var tp := a.track_get_type(i)
		var n := a.track_get_key_count(i)
		if n < 2 or not (tp == Animation.TYPE_ROTATION_3D or tp == Animation.TYPE_POSITION_3D):
			continue
		var v0 = _sample(a, i, 0.0)
		var v1 = _sample(a, i, L)
		for k in n:
			var t := a.track_get_key_time(i, k)
			if t < L - w:
				continue
			var x := clampf((t - (L - w)) / w, 0.0, 1.0)
			x = x * x * (3.0 - 2.0 * x)
			var v = a.track_get_key_value(i, k)
			if tp == Animation.TYPE_ROTATION_3D:
				var corr: Quaternion = (v0 as Quaternion) * (v1 as Quaternion).inverse()
				a.track_set_key_value(i, k, (Quaternion.IDENTITY.slerp(corr, x) * (v as Quaternion)).normalized())
			else:
				a.track_set_key_value(i, k, (v as Vector3) + ((v0 as Vector3) - (v1 as Vector3)) * x)


## убрать медленное «блуждание» таза по горизонтали у клипа «на месте»: скользящее среднее за двойной шаг
## (циклически) вычитается; покачивание с частотой шага остаётся. У готового «walk» Tripo таз уходит вбок на
## ±16 см за цикл, а опорная стопа едет вместе с ним — после вычета скольжение вбок втрое меньше.
static func _flatten_root(a: Animation, skel: Skeleton3D, root_bone: String, window: float) -> void:
	var bi := skel.find_bone(root_bone)
	var track := -1
	for i in a.get_track_count():
		if a.track_get_type(i) == Animation.TYPE_POSITION_3D and String(a.track_get_path(i)).ends_with(":" + root_bone):
			track = i
	if bi < 0 or track < 0:
		return
	var parent := skel.get_bone_parent(bi)
	var pb := skel.get_bone_global_rest(parent).basis if parent >= 0 else Basis.IDENTITY
	var up := (pb.inverse() * Vector3.UP).normalized()
	var L := a.length
	var n := a.track_get_key_count(track)
	var base: Array = []
	for k in n:
		base.append(a.track_get_key_value(track, k))
	var m := 24
	for k in n:
		var t := a.track_get_key_time(track, k)
		var avg := Vector3.ZERO
		for j in m:
			var tt := fposmod(t - window * 0.5 + window * (j + 0.5) / m, L)
			avg += a.position_track_interpolate(track, tt)
		avg /= m
		var h := avg - up * avg.dot(up)
		base[k] = (base[k] as Vector3) - h
	for k in n:
		a.track_set_key_value(track, k, base[k])


## зеркальный клип (налево ↔ направо) через позы в пространстве скелета. На каждом кадре собирается поза всего
## скелета, кости L_ ↔ R_ меняются местами, поворот каждой кости ОТ ПОЗЫ ПОКОЯ отражается относительно плоскости
## симметрии модели (боковая ось = вверх × вперёд) и накладывается на позу покоя своей кости:
##     G'(b) = M · G(пара) · G_покоя(пара)⁻¹ · M · G_покоя(b)
## (прежняя формула M · G(пара) · M верна, только если оси костей L и R зеркальны в той же плоскости — у скелета
## Tripo это не так для рук, отсюда были искажения). fwd — «вперёд» модели в пространстве скелета.
static func _mirror(a: Animation, skel: Skeleton3D, fwd := Vector3.RIGHT) -> Animation:
	var up := Vector3.UP
	var lat := up.cross(fwd).normalized()
	var M := Basis(Vector3.RIGHT - 2.0 * lat * lat.x, Vector3.UP - 2.0 * lat * lat.y, Vector3.BACK - 2.0 * lat * lat.z)
	var MT := Transform3D(M, Vector3.ZERO)
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
	# поправка покоя для каждой кости: C(b) = G_покоя(пара)⁻¹ · M · G_покоя(b)
	var C := []
	for b in nb:
		C.append(skel.get_bone_global_rest(pair[b]).affine_inverse() * MT * skel.get_bone_global_rest(b))
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
		var G := []
		G.resize(nb)
		for b in nb:
			var rest := skel.get_bone_rest(b)
			var q: Quaternion = a.rotation_track_interpolate(rot_t[b], t) if rot_t.has(b) else rest.basis.get_rotation_quaternion()
			var pv: Vector3 = a.position_track_interpolate(pos_t[b], t) if pos_t.has(b) else rest.origin
			var L := Transform3D(Basis(q), pv)
			var par := skel.get_bone_parent(b)
			G[b] = (G[par] * L) if par >= 0 else L
		var GM := []
		GM.resize(nb)
		for b in nb:
			GM[b] = MT * (G[pair[b]] as Transform3D) * (C[b] as Transform3D)
		for b in nb:
			var par := skel.get_bone_parent(b)
			var Lm: Transform3D = ((GM[par] as Transform3D).affine_inverse() * GM[b]) if par >= 0 else GM[b]
			if new_rot.has(b):
				out.rotation_track_insert_key(new_rot[b], t, Lm.basis.orthonormalized().get_rotation_quaternion())
			if new_pos.has(b):
				out.position_track_insert_key(new_pos[b], t, Lm.origin)
		t += step
	return out
