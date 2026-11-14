extends Node3D
## Лаборатория анимаций: проверка качества (QA) клипов персонажа с порогами PASS / WARN / FAIL и фотоотчётами.
## Запуск (под Xvfb, OpenGL):
##   godot --path . --rendering-driver opengl3 --fixed-fps 60 res://tools/anim_lab_qa.tscn -- \
##         --bc-qa=all --bc-set=hero --bc-out=/папка [--bc-clips=a,b] [--bc-tag=after] [--bc-calib] [--bc-noshots]
## Режимы --bc-qa: clips — замеры клипов и листы кадров; sim — переходы в настоящем AnimationTree;
##                 eight — вид с 8 сторон; all — всё.
## Итог: qa_<набор>.json (замеры, ряды углов для графиков), листы кадров со скелетом и подсветкой нарушений
## (sheet_<набор>_<клип>.png), переходы (trans_<набор>_<сценарий>.png). Сводку, графики и «до/после»
## собирает tools/anim_qa_report.py.

const Body := preload("res://tools/anim_lab_body.gd")

## пороги — оценки по биомеханике и практике (источники — docs/anim_qa/README.md)
const LIM := {
	"slide_mean": [4.0, 8.0],        ## скольжение опорной точки подошвы, см/с: среднее (PASS ≤, WARN ≤)
	"slide_p95": [12.0, 25.0],       ## 95-й процентиль, см/с
	"floor": [1.0, 2.5],             ## подошва ниже пола, см
	"body_floor": 2.0,               ## точка тела (с радиусом) ниже пола, см — FAIL
	"float": [0.05, 0.25],           ## доля кадров, когда обе стопы выше 3 см (для клипов «стоя на полу»)
	"pen": [1.5, 3.0],               ## проникновение в тело, см (держится ≥ 3 кадров при 60 к/с)
	"seam": [2.0, 4.0],              ## стык цикла, см
	"si": [10.0, 25.0],              ## асимметрия шага (индекс симметрии), %
}
## пределы суставов, градусы: [WARN, FAIL] (AAOS / Norkin & White; где норма — оценка, см. отчёт)
const JLIM := {
	"колено": [140.0, 155.0], "колено_переразгиб": [3.0, 8.0], "колено_выворот": [10.0, 18.0],
	"локоть": [145.0, 155.0], "локоть_переразгиб": [5.0, 12.0], "локоть_выворот": [20.0, 30.0],
	"стопа_тыл": [30.0, 42.0], "стопа_подошв": [45.0, 58.0], "стопа_крен": [30.0, 42.0],
	"бедро_сгиб": [120.0, 135.0], "бедро_разгиб": [25.0, 35.0], "бедро_отвед": [45.0, 60.0],
	"позвоночник_сгиб": [70.0, 90.0], "позвоночник_разгиб": [25.0, 35.0], "позвоночник_вбок": [30.0, 40.0], "позвоночник_поворот": [40.0, 55.0],
	"шея_сгиб": [45.0, 60.0], "шея_разгиб": [55.0, 75.0], "шея_вбок": [40.0, 50.0], "шея_поворот": [70.0, 85.0],
	"запястье": [80.0, 95.0],
}
## категории клипов: какие проверки к ним применимы
const CAT := {
	"idle": "stand", "breathe": "stand", "combat_idle": "stand", "crouch_idle": "stand", "pistol_aim": "stand", "rifle_aim": "stand",
	"walk": "loco", "run": "loco", "sprint": "loco", "walk_back": "loco", "strafe_left": "loco", "strafe_right": "loco",
	"crouch_walk": "loco", "sneak": "loco",
	"stairs_up": "stairs", "stairs_down": "stairs", "ladder_up": "climb",
	"start": "trans", "stop": "trans", "turn_left": "turn", "turn_right": "turn",
	"door_open": "action", "door_close": "action", "terminal": "action", "pickup": "action", "suit_on": "action", "suit_off": "action",
	"inspect": "action", "pistol_draw": "action", "pistol_fire": "action", "pistol_reload": "action", "rifle_fire": "action",
	"punch_light": "action", "punch_heavy": "action", "block": "action", "kick": "action",
	"sit_down": "sit", "stand_up": "sit", "sit_idle": "sit", "bed_lie": "lie", "bed_up": "lie", "lie_idle": "lie",
	"dodge_left": "dodge", "dodge_right": "dodge",
	"hit_front": "react", "hit_back": "react", "hit_left": "react", "hit_right": "react", "stagger": "react",
	"fall": "fall", "death": "fall", "dead": "fall", "get_up": "fall",
}
const NO_SLIDE := ["lie", "climb", "stairs", "fall", "dodge"]
const GROUNDED := ["stand", "action", "turn", "react", "emote", "sit"]
const NO_FLOOR := ["stairs", "climb"]

var rig: BCCharacter
var body: Body
var cam: Camera3D
var overlay: Control
var out := "user://qa"
var set_name := "hero"
var tag := ""
var shots := true
var calib := false
var result := {"set": "", "clips": {}, "sims": {}, "body": {}, "lim": LIM, "jlim": JLIM, "qa_version": 1}
var holder: Node3D
var vp: SubViewport
var game_mode := true           ## модификаторы скелета включены (как в игре); --bc-raw — сырые клипы
var _cap := {}
var frames_cache := {}
var debug_clip := ""


func _ready() -> void:
	var mode := "all"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-out="):
			out = a.substr(9)
		elif a.begins_with("--bc-set="):
			set_name = a.substr(9)
		elif a.begins_with("--bc-qa="):
			mode = a.substr(8)
		elif a.begins_with("--bc-tag="):
			tag = a.substr(9)
		elif a == "--bc-noshots":
			shots = false
		elif a == "--bc-calib":
			calib = true
		elif a == "--bc-raw":
			game_mode = false
		elif a.begins_with("--bc-debug="):
			debug_clip = a.substr(11)
	DirAccess.make_dir_recursive_absolute(out)
	_stage()
	_run.call_deferred(mode)


func _stage() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.19, 0.2, 0.21)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.65, 0.65, 0.65)
	e.ambient_light_energy = 0.8
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -35, 0)
	sun.light_energy = 1.1
	sun.shadow_enabled = true
	add_child(sun)
	# пол — ровный цвет и сетка 0.5 м (для сжатия PNG без текстур)
	var floor_mat := StandardMaterial3D.new()
	floor_mat.albedo_color = Color(0.36, 0.36, 0.34)
	var line_mat := StandardMaterial3D.new()
	line_mat.albedo_color = Color(0.27, 0.27, 0.26)
	line_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var axis_mat := StandardMaterial3D.new()
	axis_mat.albedo_color = Color(0.75, 0.62, 0.2)
	axis_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	var fl := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 400)
	fl.mesh = pm
	fl.material_override = floor_mat
	add_child(fl)
	for i in range(-60, 61):
		for d in 2:
			var ln := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(60, 0.002, 0.01) if d == 0 else Vector3(0.01, 0.002, 60)
			ln.mesh = bm
			ln.material_override = axis_mat if i == 0 else line_mat
			ln.position = Vector3(0, 0.001, i * 0.5) if d == 0 else Vector3(i * 0.5, 0.001, 0)
			add_child(ln)
	var sb := StaticBody3D.new()
	sb.collision_layer = 1 | 32
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(400, 0.1, 400)
	cs.shape = bs
	cs.position.y = -0.05
	sb.add_child(cs)
	add_child(sb)
	holder = Node3D.new()
	holder.name = "Holder"
	add_child(holder)
	rig = BCCharacter.new()
	holder.add_child(rig)
	rig.setup("res://assets/models/%s.glb" % ("hero" if set_name == "hero" else "hero_suit"), "res://assets/anim/" + set_name)
	# кадр — отдельный SubViewport фиксированного размера (окно под Xvfb может не менять размер)
	vp = SubViewport.new()
	vp.size = Vector2i(440, 540)
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	vp.msaa_3d = Viewport.MSAA_2X
	add_child(vp)
	cam = Camera3D.new()
	cam.fov = 32
	vp.add_child(cam)
	cam.current = true
	overlay = _Overlay.new()
	overlay.size = Vector2(vp.size)
	vp.add_child(overlay)


func _run(mode: String) -> void:
	await get_tree().process_frame
	await get_tree().process_frame
	body = Body.new()
	body.setup(rig)
	rig.skel.skeleton_updated.connect(func(): _cap = body.snap())
	if debug_clip != "" and "debug" in rig.ik:
		rig.ik.set("debug", true)
	result.set = set_name
	result["game_mode"] = game_mode
	result.body = body.info
	result.body["рост_м"] = rig.height
	result.body["масштаб"] = rig.scale_k
	print("[qa] модель: ", body.info)
	var names: Array = rig.info.keys()
	names.sort()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-clips="):
			names = Array(a.substr(11).split(","))
	var cfg := BCAnimSet.load_config()
	var missing: Array = []
	for n in cfg.clips:
		if not rig.info.has(n):
			missing.append(n)
	result["missing"] = missing
	if mode in ["all", "clips"]:
		rig.tree.active = false
		rig.skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
		for n in names:
			if not rig.info.has(n):
				continue
			vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
			RenderingServer.render_loop_enabled = false
			var r := await _analyze(n)
			RenderingServer.render_loop_enabled = true
			vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
			result.clips[n] = r
			print("[qa] %s: %s %s" % [n, r.verdict, ", ".join(r.issues)])
			if shots:
				await _sheet(n, r)
		rig.skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_IDLE
		if calib:
			_write_calib()
	if mode in ["all", "clips", "pairs"]:
		_pairs()
	if mode == "phases":
		var Ph: GDScript = load("res://tools/anim_lab_phases.gd")
		await Ph.new().run(self)
	if mode in ["all", "eight"] and shots:
		for n in ["idle", "walk", "run", "sprint", "crouch_walk"]:
			if rig.info.has(n) and (names.has(n) or mode == "eight"):
				await _eight(n)
	if mode in ["all", "sim"]:
		var Sim: GDScript = load("res://tools/anim_lab_sim.gd")
		if Sim == null or not Sim.can_instantiate():
			push_error("anim_lab_sim.gd не загрузился")
		else:
			var sim = Sim.new()
			await sim.run(self)
	var f := FileAccess.open(out.path_join("qa_%s.json" % set_name), FileAccess.WRITE)
	f.store_string(JSON.stringify(result, " ", false))
	f.close()
	print("[qa] готово: ", out)
	get_tree().quit()


# ---------------- клип в позу ----------------

func pose_clip(clip: String, t: float) -> void:
	var ap := rig.ap
	rig.tree.active = false
	if ap.current_animation != "bc/" + clip:
		ap.play("bc/" + clip)
	ap.seek(t, true)
	ap.pause()


## смещение тела в мире для клипов «на месте»: тело едет по направлению клипа с откалиброванной скоростью
func body_offset(clip: String, t: float) -> Vector3:
	var inf: Dictionary = rig.info[clip]
	if not inf.get("dir", Vector3.ZERO) is Vector3 or (inf.dir as Vector3) == Vector3.ZERO or float(inf.speed) <= 0.0:
		return Vector3.ZERO
	var d: Vector3 = rig.model.transform.basis.orthonormalized() * (inf.dir as Vector3)
	d.y = 0.0
	return d.normalized() * float(inf.speed) * t


# ---------------- замеры клипа ----------------

func _analyze(n: String) -> Dictionary:
	var inf: Dictionary = rig.info[n]
	var L: float = inf.len
	var cat: String = CAT.get(n, "emote")
	var fps := 60.0
	var steps := maxi(2, int(ceil(L * fps)))
	var dt := L / steps
	var frames: Array = []
	# «как в игре»: модификаторы скелета (стопы, руки) работают, тело едет по направлению клипа;
	# действия и позы проигрываются как разовые клипы (у BCCharacter — свои правила для IK)
	if game_mode and not cat in ["loco", "stand"]:
		rig._action = n
		rig._action_t = 1e9
	rig.ik.enabled_ik = game_mode
	# совместимость с прежним кодом (проверка «до»): у старого BCFootIK нет фиксации стоп
	if "body_speed" in rig.ik:
		rig.ik.set("body_speed", float(inf.speed) if body_offset(n, 1.0) != Vector3.ZERO else 0.0)
	if rig.ik.has_method("reset_locks"):
		rig.ik.call("reset_locks")
	var raw: Array = []
	for i in steps + 1:
		var t := minf(i * dt, L)
		var off := body_offset(n, t)
		holder.position = off
		pose_clip(n, t)
		if i == 0 or i == steps or cat == "loco":
			raw.append(body.snap())
		var s: Dictionary
		if game_mode:
			_cap = {}
			rig.skel.advance(dt if i > 0 else 0.0)
			await get_tree().process_frame
			s = _cap if not _cap.is_empty() else body.snap()
		else:
			s = body.snap()
		var so := body.soles(s)
		if debug_clip == n:
			var dbg: Dictionary = rig.ik.last_debug
			print("[dbg] %.3f lock %s d %s infl %.2f L %s R %s" % [t, dbg.get("lock"), str(dbg.get("lock_d")), rig.ik.influence,
				(so.L as Array).map(func(p): return (p as Vector3).snapped(Vector3(0.001, 0.001, 0.001))), body.pos(s, "Hip").snapped(Vector3(0.001, 0.001, 0.001))])
		# проникновения — каждый второй кадр (30 к/с): точный замер по сетке дорогой
		frames.append({"t": t, "s": s, "so": so, "off": off, "ang": body.angles(s), "pen": body.penetrations(s, 0.01) if i % 2 == 0 else [],
			"bp": body.body_points(s)})
	rig._action = ""
	rig._action_t = 0.0
	holder.position = Vector3.ZERO
	frames_cache = {n: frames}
	var r := {"cat": cat, "len": L, "speed": inf.speed, "loop": inf.loop, "issues": [], "warn": [], "m": {}, "worst": [], "series": {}}
	var bad_frames := {}       # кадр → список нарушений (для подсветки)
	# --- опора и скольжение по подошве ---
	# опора: самая низкая точка подошвы (пятка / подушечка / носок) ниже 3 см и
	#   * в клипах передвижения («на месте») — едет назад относительно тела (стопа в переносе идёт вперёд);
	#   * в остальных — медленнее 35 см/с.
	# скольжение — горизонтальная скорость этой точки в мире (тело едет со скоростью, заданной в игре).
	# «Шарканье»: подошва касается пола (ниже 1 см), но это не опора — 4 кадра подряд и больше.
	var contact_h := 0.03
	var dir3 := body_offset(n, 1.0).normalized()
	var v_body := float(inf.speed) if dir3 != Vector3.ZERO else 0.0
	var slides: Array = []
	var contact_frames := {"L": [], "R": []}
	var floor_min := 0.0
	var float_n := 0
	var sole_min_all := INF
	var native_seg := {"L": [], "R": []}
	var native_v: Array = []
	var drag_run := {"L": 0, "R": 0}
	var drag_max := 0
	for i in frames.size():
		var fr: Dictionary = frames[i]
		var lowest_both := INF
		for sd in ["L", "R"]:
			var pts: Array = fr.so[sd]
			var lo_i := 0
			for j in pts.size():
				if (pts[j] as Vector3).y < (pts[lo_i] as Vector3).y:
					lo_i = j
			var lo: Vector3 = pts[lo_i]
			lowest_both = minf(lowest_both, lo.y)
			floor_min = minf(floor_min, lo.y)
			var i0 := i - 1 if i > 0 else 0
			var i1 := i if i > 0 else 1
			# скорость точки опоры — по кадрам, где она уже на полу: в кадре касания берётся разность вперёд
			# (иначе в «скольжение» попадает скорость самого приземления из воздуха)
			if i > 0 and i + 1 < frames.size() and (frames[i - 1].so[sd][lo_i] as Vector3).y >= contact_h and (frames[i + 1].so[sd][lo_i] as Vector3).y < contact_h:
				i0 = i
				i1 = i + 1
			var cv: Vector3 = ((frames[i1].so[sd][lo_i] as Vector3) - (frames[i0].so[sd][lo_i] as Vector3)) / dt
			var wv: Vector3 = cv + ((frames[i1].off as Vector3) - (frames[i0].off as Vector3)) / dt
			var v := Vector2(wv.x, wv.z).length()
			var on := lo.y < contact_h
			if v_body > 0.05:
				on = on and Vector2(cv.x, cv.z).dot(Vector2(dir3.x, dir3.z)) < 0.0 and v < v_body + 0.35
			else:
				on = on and v < 0.35
			contact_frames[sd].append(on)
			if debug_clip == n and lo.y < 0.05:
				print("[slide] %d %s t%.3f lo%d h%.3f v%.2f cv%s on%s" % [i, sd, fr.t, lo_i, lo.y, v, Vector2(cv.x, cv.z).snapped(Vector2(0.01, 0.01)), on])
			if on:
				slides.append(v * 100.0)
				native_seg[sd].append(-Vector2(cv.x, cv.z).dot(Vector2(dir3.x, dir3.z)))
				if v * 100.0 > LIM.slide_p95[1]:
					_mark(bad_frames, i, "slide_" + sd, v * 100.0)
			else:
				# середина опоры (без первых и последних 20%) — по ней родная скорость клипа
				var seg: Array = native_seg[sd]
				if seg.size() >= 5:
					native_v.append_array(seg.slice(int(seg.size() * 0.2), int(ceil(seg.size() * 0.8))))
				native_seg[sd] = []
			if lo.y < 0.01 and not on:
				drag_run[sd] += 1
				drag_max = maxi(drag_max, drag_run[sd])
				if drag_run[sd] >= 4:
					_mark(bad_frames, i, "slide_" + sd, v * 100.0)
			else:
				drag_run[sd] = 0
		sole_min_all = minf(sole_min_all, lowest_both)
		if lowest_both > contact_h:
			float_n += 1
	for sd in ["L", "R"]:
		var seg: Array = native_seg[sd]
		if seg.size() >= 5:
			native_v.append_array(seg.slice(int(seg.size() * 0.2), int(ceil(seg.size() * 0.8))))
	r.m["шарканье_кадров"] = drag_max
	if not cat in NO_SLIDE:
		_grade(r, "шарканье (подошва на полу едет)", 2 if drag_max >= 6 else (1 if drag_max >= 4 else 0), "%d кадров подряд" % drag_max)
	if not cat in NO_SLIDE and slides.size() > 3:
		var mean := _mean(slides)
		var p95 := _pct(slides, 0.95)
		r.m["скольжение_ср"] = snappedf(mean, 0.1)
		r.m["скольжение_p95"] = snappedf(p95, 0.1)
		_grade(r, "скольжение стоп", maxi(_lvl(mean, LIM.slide_mean), _lvl(p95, LIM.slide_p95)), "ср. %.1f / p95 %.1f см/с" % [mean, p95])
	elif slides.size() > 3:
		r.m["скольжение_ср"] = snappedf(_mean(slides), 0.1)
		r.m["скольжение_p95"] = snappedf(_pct(slides, 0.95), 0.1)
	if native_v.size() > 5:
		var nv := _pct(native_v, 0.5)
		r.m["скорость_по_подошве"] = snappedf(nv, 0.01)
	# --- пол ---
	if not cat in NO_FLOOR:
		r.m["подошва_под_полом_см"] = snappedf(-floor_min * 100.0, 0.1)
		_grade(r, "стопа под полом", _lvl(-floor_min * 100.0, LIM.floor), "%.1f см" % (-floor_min * 100.0))
		var bf := 0.0
		var bf_name := ""
		for i in frames.size():
			for p in frames[i].bp:
				var under: float = -(p[1] as Vector3).y
				if under > bf:
					bf = under
					bf_name = p[0]
				if under * 100.0 > LIM.body_floor:
					_mark(bad_frames, i, "floor_body", under * 100.0)
		r.m["тело_под_полом_см"] = snappedf(bf * 100.0, 0.1)
		if bf * 100.0 > LIM.body_floor:
			_grade(r, "тело под полом", 2, "%s %.1f см" % [bf_name, bf * 100.0])
		for i in frames.size():
			for sd in ["L", "R"]:
				for p in frames[i].so[sd]:
					if (p as Vector3).y * 100.0 < -LIM.floor[1]:
						_mark(bad_frames, i, "floor_" + sd, -(p as Vector3).y * 100.0)
	if cat in GROUNDED:
		var fr_float := float(float_n) / frames.size()
		r.m["доля_без_опоры"] = snappedf(fr_float, 0.01)
		_grade(r, "висит над полом", _lvl(fr_float, LIM.float), "%.0f%% кадров, мин. высота подошвы %.1f см" % [fr_float * 100.0, sole_min_all * 100.0])
	# --- суставы ---
	var jmax := {}
	var jcount := {}
	for i in frames.size():
		var A: Dictionary = frames[i].ang
		for chk in _joint_checks(A):
			var key: String = chk[0]
			var v: float = chk[1]
			var lim: Array = JLIM[chk[2]]
			if not jmax.has(key) or v > jmax[key][0]:
				jmax[key] = [v, chk[2]]
			if v > lim[1]:
				jcount[key] = jcount.get(key, 0) + 1
				_mark(bad_frames, i, "joint:" + key, v)
	var jsum := {}
	for key in jmax:
		var lim: Array = JLIM[jmax[key][1]]
		var v: float = jmax[key][0]
		jsum[key] = snappedf(v, 0.1)
		var lv := _lvl(v, lim)
		if lv == 2 and jcount.get(key, 0) < 2:
			lv = 1
		if lv > 0:
			_grade(r, "сустав: " + key, lv, "%.0f° (норма до %.0f°)" % [v, lim[0]])
	r.m["суставы_макс"] = jsum
	# --- проникновения ---
	var pen_run := {}
	var pen_max := {}
	for i in range(0, frames.size(), 2):
		var seen := {}
		for p in frames[i].pen:
			var key: String = p[0] + " → " + p[1]
			var d: float = p[2] * 100.0
			seen[key] = d
			if not pen_max.has(key) or d > pen_max[key][0]:
				pen_max[key] = [d, 0]
		for key in pen_max:
			if seen.has(key) and seen[key] > LIM.pen[0]:
				pen_run[key] = pen_run.get(key, 0) + 1
				pen_max[key][1] = maxi(pen_max[key][1], pen_run[key])
				if seen[key] > LIM.pen[1]:
					_mark(bad_frames, i, "pen:" + key, seen[key])
			else:
				pen_run[key] = 0
	var psum := {}
	for key in pen_max:
		var d: float = pen_max[key][0]
		var run: int = pen_max[key][1]
		psum[key] = snappedf(d, 0.1)
		var lv := _lvl(d, LIM.pen) if run >= 2 else 0
		if lv > 0:
			_grade(r, "проникновение: " + key, lv, "%.1f см" % d)
	r.m["проникновения_см"] = psum
	# --- тело над капсулой: среднее горизонтальное смещение таза от точки персонажа (клипы стоя и передвижения) ---
	if cat in ["loco", "stand", "trans"]:
		var mh := Vector3.ZERO
		for fr in frames:
			var hp := body.pos(fr.s, "Hip")
			mh += Vector3(hp.x, 0.0, hp.z)
		mh /= frames.size()
		r.m["таз_от_капсулы_см"] = snappedf(mh.length() * 100.0, 0.1)
		_grade(r, "тело смещено от капсулы", 2 if mh.length() > 0.15 else (1 if mh.length() > 0.08 else 0), "%.0f см" % (mh.length() * 100.0))
	# --- стык цикла ---
	if inf.loop and L > 1.05:
		# стык — свойство самого клипа: сравниваются сырые позы первого и последнего кадра (без модификаторов)
		var a: Dictionary = raw[0]
		var z: Dictionary = raw[raw.size() - 1]
		var jump := 0.0
		var steps_d: Array = []
		var keyb := ["Hip", "Head", "L_Hand", "R_Hand", "L_Foot", "R_Foot", "L_Calf", "R_Calf", "L_Forearm", "R_Forearm"]
		for bn in keyb:
			jump = maxf(jump, body.pos(a, bn).distance_to(body.pos(z, bn)))
		for i in range(1, frames.size() - 1):
			var mx := 0.0
			for bn in keyb:
				mx = maxf(mx, body.pos(frames[i].s, bn).distance_to(body.pos(frames[i - 1].s, bn)))
			steps_d.append(mx)
		var p95s := _pct(steps_d, 0.95)
		r.m["стык_см"] = snappedf(jump * 100.0, 0.1)
		r.m["шаг_кадра_p95_см"] = snappedf(p95s * 100.0, 0.1)
		var lv := _lvl(jump * 100.0, LIM.seam)
		if lv > 0 and jump < p95s * (3.0 if lv == 2 else 2.0):
			lv = 0
		_grade(r, "стык цикла", lv, "скачок %.1f см (обычный шаг кадра %.1f см)" % [jump * 100.0, p95s * 100.0])
	# --- ритм и симметрия шага ---
	if cat == "loco":
		# ритм шага — свойство клипа: по сырым позам (фиксация стоп в игре меняет моменты касания)
		var rf: Array = []
		for i in raw.size():
			rf.append({"t": frames[i].t, "so": body.soles(raw[i]), "off": frames[i].off})
		_gait(r, n, rf, _contacts(rf, n, dt), dt)
	# --- ряды для графиков (30 к/с) ---
	var ser := {"t": [], "колено_L": [], "колено_R": [], "бедро_сгиб_L": [], "бедро_сгиб_R": [], "стопа_сгиб_L": [], "стопа_сгиб_R": [],
		"опора_L": [], "опора_R": [], "таз_наклон": [], "позвоночник_сгиб": [], "локоть_L": [], "локоть_R": []}
	for i in range(0, frames.size(), 2):
		var A: Dictionary = frames[i].ang
		ser.t.append(snappedf(frames[i].t, 0.001))
		for key in ["колено_L", "колено_R", "бедро_сгиб_L", "бедро_сгиб_R", "стопа_сгиб_L", "стопа_сгиб_R", "таз_наклон", "позвоночник_сгиб", "локоть_L", "локоть_R"]:
			ser[key].append(snappedf(A[key], 0.1))
		ser["опора_L"].append(1 if contact_frames.L[i] else 0)
		ser["опора_R"].append(1 if contact_frames.R[i] else 0)
	r.series = ser
	# --- худшие кадры для листа ---
	var worst: Array = []
	for i in bad_frames:
		var sc := 0.0
		for v in bad_frames[i]:
			sc += 1.0
		worst.append([sc, i])
	worst.sort_custom(func(x, y): return x[0] > y[0])
	r.worst = worst.slice(0, 2).map(func(x): return x[1])
	r["bad"] = {}
	for i in bad_frames:
		r.bad[i] = bad_frames[i]
	r.verdict = "FAIL" if r.issues.size() > 0 else ("WARN" if r.warn.size() > 0 else "PASS")
	r["frames_n"] = frames.size()
	r["dt"] = dt
	return r


## проверки суставов кадра: [название, значение (больше — хуже), ключ предела]
func _joint_checks(A: Dictionary) -> Array:
	var c: Array = []
	for sd in ["L", "R"]:
		var nm := " Л" if sd == "L" else " П"
		c.append(["колено" + nm, A["колено_" + sd], "колено"])
		c.append(["колено переразгиб" + nm, -A["колено_" + sd], "колено_переразгиб"])
		c.append(["колено выворот" + nm, A["колено_выворот_" + sd], "колено_выворот"])
		c.append(["локоть" + nm, A["локоть_" + sd], "локоть"])
		c.append(["локоть переразгиб" + nm, -A["локоть_" + sd], "локоть_переразгиб"])
		c.append(["локоть выворот" + nm, A["локоть_выворот_" + sd], "локоть_выворот"])
		c.append(["стопа тыльный сгиб" + nm, A["стопа_сгиб_" + sd], "стопа_тыл"])
		c.append(["стопа подошвенный сгиб" + nm, -A["стопа_сгиб_" + sd], "стопа_подошв"])
		c.append(["стопа крен" + nm, absf(A["стопа_крен_" + sd]), "стопа_крен"])
		c.append(["бедро сгиб" + nm, A["бедро_сгиб_" + sd], "бедро_сгиб"])
		c.append(["бедро разгиб" + nm, -A["бедро_сгиб_" + sd], "бедро_разгиб"])
		c.append(["бедро отведение" + nm, A["бедро_отвед_" + sd], "бедро_отвед"])
		c.append(["запястье" + nm, A["запястье_" + sd], "запястье"])
	c.append(["позвоночник сгиб", A["позвоночник_сгиб"], "позвоночник_сгиб"])
	c.append(["позвоночник разгиб", -A["позвоночник_сгиб"], "позвоночник_разгиб"])
	c.append(["позвоночник вбок", absf(A["позвоночник_вбок"]), "позвоночник_вбок"])
	c.append(["позвоночник поворот", absf(A["позвоночник_поворот"]), "позвоночник_поворот"])
	c.append(["шея сгиб", A["шея_сгиб"], "шея_сгиб"])
	c.append(["шея разгиб", -A["шея_сгиб"], "шея_разгиб"])
	c.append(["шея вбок", absf(A["шея_вбок"]), "шея_вбок"])
	c.append(["шея поворот", absf(A["шея_поворот"]), "шея_поворот"])
	return c


## флаги опоры по кадрам (тот же детектор, что и для скольжения)
func _contacts(fr: Array, n: String, dt: float) -> Dictionary:
	var dir3 := body_offset(n, 1.0).normalized()
	var v_body := float(rig.info[n].speed) if dir3 != Vector3.ZERO else 0.0
	var out := {"L": [], "R": []}
	for i in fr.size():
		for sd in ["L", "R"]:
			var pts: Array = fr[i].so[sd]
			var lo_i := 0
			for j in pts.size():
				if (pts[j] as Vector3).y < (pts[lo_i] as Vector3).y:
					lo_i = j
			var i0 := i - 1 if i > 0 else 0
			var i1 := i if i > 0 else 1
			var cv: Vector3 = ((fr[i1].so[sd][lo_i] as Vector3) - (fr[i0].so[sd][lo_i] as Vector3)) / dt
			var wv: Vector3 = cv + ((fr[i1].off as Vector3) - (fr[i0].off as Vector3)) / dt
			var on := (pts[lo_i] as Vector3).y < 0.03
			if v_body > 0.05:
				on = on and Vector2(cv.x, cv.z).dot(Vector2(dir3.x, dir3.z)) < 0.0 and Vector2(wv.x, wv.z).length() < v_body + 0.35
			else:
				on = on and Vector2(wv.x, wv.z).length() < 0.35
			out[sd].append(on)
	return out


## ритм шага: моменты постановки стоп, длина шага, каденс, симметрия, доля опоры, фаза полёта
func _gait(r: Dictionary, n: String, frames: Array, cf: Dictionary, dt: float) -> void:
	var strikes := {"L": [], "R": []}
	var stance := {"L": 0, "R": 0}
	for sd in ["L", "R"]:
		var a: Array = cf[sd].duplicate()
		# короткие (< 5 кадров) отрезки опоры и разрывы — дребезг детектора, не шаги
		for rep in 2:
			var i := 0
			while i < a.size():
				var j := i
				while j < a.size() and a[j] == a[i]:
					j += 1
				if j - i < 5 and i > 0 and j < a.size():
					for k in range(i, j):
						a[k] = not a[k]
				i = j
		for i in a.size():
			if a[i]:
				stance[sd] += 1
			if a[i] and (i == 0 and not a[-1] or i > 0 and not a[i - 1]):
				# точка постановки: средняя точка подошвы с учётом смещения тела
				var pts: Array = frames[i].so[sd]
				var c: Vector3 = (pts[0] + pts[2]) * 0.5 + frames[i].off
				strikes[sd].append([frames[i].t, c])
	var ev: Array = []
	for sd in ["L", "R"]:
		for s in strikes[sd]:
			ev.append([s[0], sd, s[1]])
	ev.sort_custom(func(x, y): return x[0] < y[0])
	var flight := 0
	for i in frames.size():
		if not cf.L[i] and not cf.R[i]:
			flight += 1
	var L: float = r.len
	r.m["полёт_доля"] = snappedf(float(flight) / frames.size(), 0.01)
	r.m["опора_доля_L"] = snappedf(float(stance.L) / frames.size(), 0.01)
	r.m["опора_доля_R"] = snappedf(float(stance.R) / frames.size(), 0.01)
	var st := {"L": [], "R": []}
	var sl := {"L": [], "R": []}
	var dirv := body_offset(n, 1.0).normalized()
	for i in range(1, ev.size()):
		if ev[i][1] == ev[i - 1][1]:
			continue
		var tt: float = ev[i][0] - ev[i - 1][0]
		var dd: Vector3 = ev[i][2] - ev[i - 1][2]
		var ln := absf(dd.dot(dirv)) if dirv != Vector3.ZERO else Vector2(dd.x, dd.z).length()
		st[ev[i][1]].append(tt)
		sl[ev[i][1]].append(ln)
	var nsteps: int = st.L.size() + st.R.size()
	if nsteps < 2 or st.L.is_empty() or st.R.is_empty():
		r.m["шагов"] = nsteps
		_grade(r, "ритм шага", 1, "мало шагов в клипе для замера (%d)" % nsteps)
		return
	var tl := _mean(st.L)
	var tr := _mean(st.R)
	var ll := _mean(sl.L)
	var lr := _mean(sl.R)
	var cad := 60.0 / ((tl + tr) * 0.5)
	r.m["шагов"] = nsteps
	r.m["каденс_шаг_мин"] = snappedf(cad, 0.1)
	r.m["время_шага_L_R"] = [snappedf(tl, 0.001), snappedf(tr, 0.001)]
	r.m["длина_шага_L_R_м"] = [snappedf(ll, 0.01), snappedf(lr, 0.01)]
	var si_t := absf(tl - tr) / (0.5 * (tl + tr)) * 100.0
	var si_l := absf(ll - lr) / maxf(0.5 * (ll + lr), 0.01) * 100.0
	r.m["симметрия_время_%"] = snappedf(si_t, 0.1)
	r.m["симметрия_длина_%"] = snappedf(si_l, 0.1)
	_grade(r, "асимметрия шага", maxi(_lvl(si_t, LIM.si), _lvl(si_l, LIM.si)), "по времени %.0f%%, по длине %.0f%%" % [si_t, si_l])


func _mark(bad: Dictionary, i: int, what: String, v: float) -> void:
	if not bad.has(i):
		bad[i] = {}
	bad[i][what] = snappedf(v, 0.1)


func _lvl(v: float, lim: Array) -> int:
	return 2 if v > float(lim[1]) else (1 if v > float(lim[0]) else 0)


func _grade(r: Dictionary, what: String, lvl: int, msg: String) -> void:
	if lvl == 2:
		r.issues.append(what + ": " + msg)
	elif lvl == 1:
		r.warn.append(what + ": " + msg)


static func _mean(a: Array) -> float:
	if a.is_empty():
		return 0.0
	var s := 0.0
	for v in a:
		s += float(v)
	return s / a.size()


static func _pct(a: Array, q: float) -> float:
	if a.is_empty():
		return 0.0
	var s := a.duplicate()
	s.sort()
	return float(s[clampi(int(q * (s.size() - 1)), 0, s.size() - 1)])


func _write_calib() -> void:
	# скорости клипов передвижения по подошве (середина опоры) — печать; в конфигурацию вносит человек/скрипт
	var out_c := {}
	for n in result.clips:
		var r: Dictionary = result.clips[n]
		if r.cat == "loco" and r.m.has("скорость_по_подошве"):
			out_c[n] = r.m["скорость_по_подошве"]
	result["calib"] = out_c
	print("[qa] скорость по подошве: ", out_c)


## стыковка клипов, которые идут друг за другом: конец A против начала B (суставы в системе героя), см
func _pairs() -> void:
	var pairs := [["sit_down", "stand_up"], ["bed_lie", "bed_up"], ["sit_down", "sit_idle"], ["bed_lie", "lie_idle"],
		["fall", "get_up"], ["death", "dead"], ["idle", "walk"], ["walk", "idle"], ["crouch_idle", "crouch_walk"]]
	var out := {}
	rig.tree.active = false
	for pr in pairs:
		if not (rig.info.has(pr[0]) and rig.info.has(pr[1])):
			continue
		pose_clip(pr[0], rig.info[pr[0]].len)
		var a := body.snap()
		pose_clip(pr[1], 0.0)
		var b := body.snap()
		var mx := 0.0
		var worst := ""
		for bn in ["Hip", "Head", "L_Hand", "R_Hand", "L_Foot", "R_Foot", "L_Calf", "R_Calf"]:
			var d := body.pos(a, bn).distance_to(body.pos(b, bn))
			if d > mx:
				mx = d
				worst = bn
		out["%s → %s" % pr] = {"max_cm": snappedf(mx * 100.0, 0.1), "joint": worst, "blend": rig.info[pr[1]].blend}
	result["pairs"] = out
	print("[qa] стыковка: ", out)


# ---------------- снимки ----------------

func view(yaw_deg: float, look: Vector3, dist := 4.4, h := 1.55) -> void:
	var a := deg_to_rad(yaw_deg) + rig.global_rotation.y
	cam.global_position = look + Vector3(sin(a) * dist, h - look.y + 0.35, cos(a) * dist)
	cam.look_at(look, Vector3.UP)


func grab() -> Image:
	await RenderingServer.frame_post_draw
	var img := vp.get_texture().get_image()
	img.convert(Image.FORMAT_RGB8)
	return img


## поставить скелет в снятую позу (с учётом модификаторов) — для снимка
func apply_snap(s: Dictionary) -> void:
	var sk := rig.skel
	rig.tree.active = false
	rig.ap.pause()
	sk.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_MANUAL
	for b in sk.get_bone_count():
		var par := sk.get_bone_parent(b)
		var L: Transform3D = ((s.g[par] as Transform3D).affine_inverse() * (s.g[b] as Transform3D)) if par >= 0 else (s.g[b] as Transform3D)
		sk.set_bone_pose_position(b, L.origin)
		sk.set_bone_pose_rotation(b, L.basis.get_rotation_quaternion())


## нарисовать скелет поверх модели: кости, суставы, точки подошвы, подсветка нарушений
func draw_skeleton(s: Dictionary, so: Dictionary, bad: Dictionary, title: String, sub: String, verdict := "", pens: Array = []) -> void:
	var o: _Overlay = overlay
	o.clear()
	var wx := rig.global_transform
	var P := func(bn: String) -> Vector2:
		return cam.unproject_position(wx * body.pos(s, bn))
	var chains := [["Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "Head"],
		["Hip", "L_Thigh", "L_Calf", "L_Foot", "L_ToeBase"], ["Hip", "R_Thigh", "R_Calf", "R_Foot", "R_ToeBase"],
		["Spine02", "L_Clavicle", "L_Upperarm", "L_Forearm", "L_Hand", "L_Mid1"], ["Spine02", "R_Clavicle", "R_Upperarm", "R_Forearm", "R_Hand", "R_Mid1"]]
	for ch in chains:
		var col := Color(0.95, 0.95, 0.95)
		if ch[1].begins_with("L_"):
			col = Color(0.35, 0.7, 1.0)
		elif ch[1].begins_with("R_"):
			col = Color(1.0, 0.55, 0.25)
		for i in range(1, ch.size()):
			o.lines.append([P.call(ch[i - 1]), P.call(ch[i]), col, 2.5])
		for bn in ch:
			o.dots.append([P.call(bn), 3.0, col])
	# голова — кружок
	o.rings.append([P.call("Head"), 7.0, Color(0.95, 0.95, 0.95), 1.5])
	# подошва: зелёная — опора, серая — в воздухе, красная — скольжение
	for sd in ["L", "R"]:
		var pts: Array = so[sd]
		var sliding: bool = bad.has("slide_" + sd)
		for j in pts.size():
			var p: Vector3 = pts[j]
			var on := p.y < 0.03
			var c := Color(0.55, 0.55, 0.55)
			if on:
				c = Color(1.0, 0.15, 0.15) if sliding else Color(0.2, 0.95, 0.3)
			o.dots.append([cam.unproject_position(wx * p), 3.5, c])
		o.lines.append([cam.unproject_position(wx * (pts[0] as Vector3)), cam.unproject_position(wx * (pts[2] as Vector3)), Color(0.2, 0.95, 0.3, 0.7), 1.5])
	# нарушения
	var notes: Array = []
	for key in bad:
		var v: float = bad[key]
		if key.begins_with("joint:"):
			var nm: String = key.substr(6)
			var bn := _joint_bone(nm)
			if bn != "":
				o.rings.append([P.call(bn), 11.0, Color(1, 0.1, 0.1), 3.0])
			notes.append("%s %.0f°" % [nm, v])
		elif key.begins_with("pen:"):
			notes.append("%s %.1f см" % [key.substr(4), v])
		elif key.begins_with("slide_"):
			notes.append("скольжение %s %.0f см/с" % ["Л" if key.ends_with("L") else "П", v])
		elif key.begins_with("floor"):
			notes.append("под полом %.1f см" % v)
	for p in pens:
		o.rings.append([cam.unproject_position(wx * (p[3] as Vector3)), 9.0, Color(1, 0.1, 0.9), 3.0])
	o.texts.append([Vector2(6, 16), title, Color(1, 1, 1), 15])
	o.texts.append([Vector2(6, 34), sub, Color(0.85, 0.85, 0.85), 13])
	if verdict != "":
		var vc := Color(0.3, 1.0, 0.4) if verdict == "PASS" else (Color(1.0, 0.85, 0.2) if verdict == "WARN" else Color(1.0, 0.3, 0.3))
		o.texts.append([Vector2(Vector2(vp.size).x - 54, 16), verdict, vc, 15])
	var y := Vector2(vp.size).y - 8.0 - 15.0 * mini(notes.size(), 4)
	for i in mini(notes.size(), 4):
		o.texts.append([Vector2(6, y + 15.0 * i + 12.0), notes[i], Color(1, 0.4, 0.4), 13])
	o.queue_redraw()


func _joint_bone(nm: String) -> String:
	var sd := "L_" if nm.ends_with(" Л") else ("R_" if nm.ends_with(" П") else "")
	if nm.begins_with("колено"):
		return sd + "Calf"
	if nm.begins_with("локоть"):
		return sd + "Forearm"
	if nm.begins_with("стопа"):
		return sd + "Foot"
	if nm.begins_with("бедро"):
		return sd + "Thigh"
	if nm.begins_with("запястье"):
		return sd + "Hand"
	if nm.begins_with("позвоночник"):
		return "Spine01"
	if nm.begins_with("шея"):
		return "NeckTwist01"
	return ""


## лист: 6 моментов клипа (равномерно + худшие кадры) × 2 вида (спереди-сбоку, сбоку), скелет поверх модели
func _sheet(n: String, r: Dictionary) -> void:
	var L: float = r.len
	var nfr: int = r.frames_n
	var dt: float = r.dt
	var idx: Array = []
	var cols := 6
	var worst: Array = r.worst
	var uni := cols - worst.size()
	for k in uni:
		idx.append(int(round(float(k) / maxf(uni - 1, 1) * (nfr - 1))))
	for w in worst:
		if not idx.has(w):
			idx.append(w)
	idx.sort()
	var cell := Vector2i(220, 270)
	var sheet := Image.create(cell.x * idx.size(), cell.y * 2, false, Image.FORMAT_RGB8)
	for row in 2:
		for c in idx.size():
			var i: int = idx[c]
			var t := minf(i * dt, L)
			var fr: Dictionary = frames_cache[n][i]
			holder.position = Vector3.ZERO
			apply_snap(fr.s)
			await get_tree().process_frame
			var s: Dictionary = fr.s
			var so: Dictionary = fr.so
			var hip := body.pos(s, "Hip")
			view(35.0 if row == 0 else 90.0, Vector3(hip.x, 0.9, hip.z))
			var bad: Dictionary = r.bad.get(i, {})
			var mark := " ◆" if worst.has(i) else ""
			var pens := body.penetrations(s, LIM.pen[1] / 100.0)
			draw_skeleton(s, so, bad, "%s  %.2f с%s" % [n, t, mark], ("спереди-сбоку" if row == 0 else "сбоку") + "  кадр %d/%d" % [i, nfr - 1], r.verdict if c == 0 else "", pens)
			var img := await grab()
			img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
			sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(c * cell.x, row * cell.y))
	overlay.clear()
	sheet.save_png(out.path_join("sheet_%s_%s.png" % [set_name, n]))


## вид с 8 сторон (момент 30% клипа) со скелетом
func _eight(n: String) -> void:
	var cell := Vector2i(200, 250)
	var sheet := Image.create(cell.x * 4, cell.y * 2, false, Image.FORMAT_RGB8)
	var L: float = rig.info[n].len
	for k in 8:
		pose_clip(n, L * 0.3)
		await get_tree().process_frame
		var s := body.snap()
		var hip := body.pos(s, "Hip")
		view(k * 45.0, Vector3(hip.x, 0.9, hip.z), 4.8, 1.7)
		draw_skeleton(s, body.soles(s), {}, "%s  %d°" % [n, k * 45], "")
		var img := await grab()
		img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
		sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i((k % 4) * cell.x, (k / 4) * cell.y))
	overlay.clear()
	sheet.save_png(out.path_join("eight_%s_%s.png" % [set_name, n]))


## слой рисования поверх кадра
class _Overlay extends Control:
	var lines: Array = []
	var dots: Array = []
	var rings: Array = []
	var texts: Array = []

	func clear() -> void:
		lines.clear()
		dots.clear()
		rings.clear()
		texts.clear()
		queue_redraw()

	func _draw() -> void:
		for l in lines:
			draw_line(l[0], l[1], Color(0, 0, 0, 0.6), float(l[3]) + 2.0, true)
		for l in lines:
			draw_line(l[0], l[1], l[2], l[3], true)
		for d in dots:
			draw_circle(d[0], float(d[1]) + 1.0, Color(0, 0, 0, 0.7))
			draw_circle(d[0], d[1], d[2])
		for r in rings:
			draw_arc(r[0], r[1], 0.0, TAU, 24, r[2], r[3], true)
		var font := ThemeDB.fallback_font
		for t in texts:
			draw_string_outline(font, t[0], t[1], HORIZONTAL_ALIGNMENT_LEFT, -1, t[3], 3, Color(0, 0, 0, 0.85))
			draw_string(font, t[0], t[1], HORIZONTAL_ALIGNMENT_LEFT, -1, t[3], t[2])
