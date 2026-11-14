extends RefCounted
## Переходы между клипами — в настоящем дереве анимаций героя (BCCharacter, AnimationTree), так, как их видит
## игрок: тело разгоняется и тормозит как герой (player.gd: разгон 9 м/с², торможение в 1.6 раза быстрее,
## поворот 9 рад/с), старт/остановка — те же условия, действия — через play()/set_pose(), как в игре.
## Замеры на каждом кадре (60 к/с, модификаторы скелета включены):
##   * рывок — пиковая скорость суставов (в системе тела) в окне перехода против пика в спокойных участках
##     до и после; «скачок» — смещение сустава за кадр, в 3 раза больше соседних;
##   * скольжение опорной стопы в мире (как в клипах, но с настоящим движением тела).
## Итог — qa.result.sims, полосы кадров переходов (trans_<набор>_<сценарий>.png).

const ACCEL := 9.0
const TURN := 9.0
const JOINTS := ["Hip", "Head", "L_Hand", "R_Hand", "L_Foot", "R_Foot", "L_Calf", "R_Calf", "L_Forearm", "R_Forearm", "Spine02"]

var qa
var rig: BCCharacter
var body
var dt := 1.0 / 60.0
var t := 0.0
var speed := 0.0
var target_speed := 0.0
var yaw := 0.0
var target_yaw := 0.0
var crouch := 0.0
var was_moving := false
var frames: Array = []           ## {t, s, pos, yaw, speed, ev}
var events: Array = []           ## [время, название перехода, время смешивания]


func run(q) -> void:
	qa = q
	rig = q.rig
	body = q.body
	rig.skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_IDLE
	rig.ik.enabled_ik = true
	rig.tree.active = true
	var scen := _scenarios()
	var only := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--bc-sims="):
			only = a.substr(10)
	for name in scen:
		if only != "" and not name in only.split(","):
			continue
		await _play(name, scen[name])


func _scenarios() -> Dictionary:
	var s := {}
	s["передвижение"] = [["wait", 1.5], ["speed", 1.35, 3.0], ["speed", 3.1, 3.0], ["speed", 4.5, 3.0], ["speed", 3.1, 2.0], ["speed", 0.0, 2.5]]
	s["неполный_наклон"] = [["wait", 1.0], ["speed", 2.0, 3.0], ["speed", 0.8, 2.5], ["speed", 0.0, 2.0]]
	s["разворот"] = [["wait", 1.0], ["speed", 3.1, 2.0], ["turn", 180.0, 2.0], ["turn", 90.0, 1.5], ["speed", 0.0, 2.0], ["turn", -120.0, 0.0], ["speed", 1.35, 1.5], ["speed", 0.0, 2.0]]
	s["присед"] = [["wait", 1.0], ["crouch", 1.0, 1.5], ["speed", 1.15, 3.0], ["speed", 0.0, 1.5], ["crouch", 0.0, 1.5]]
	s["действия"] = [["wait", 1.0], ["act", "door_open"], ["wait", 0.6], ["speed", 1.35, 2.0], ["speed", 0.0, 1.0], ["act", "terminal"], ["wait", 0.6],
		["act", "pickup"], ["wait", 0.6], ["act", "inspect"], ["wait", 0.6], ["act", "door_close"], ["wait", 1.0]]
	s["бой"] = [["wait", 1.0], ["act", "punch_light"], ["act", "punch_light"], ["act", "punch_heavy"], ["wait", 0.5], ["act", "hit_front"], ["wait", 0.3],
		["act", "hit_left"], ["wait", 0.3], ["act", "hit_right"], ["wait", 0.3], ["act", "hit_back"], ["wait", 0.5], ["act", "stagger"], ["wait", 1.0]]
	s["сесть_лечь"] = [["wait", 1.0], ["sit", "sit_down", "sit_idle"], ["wait", 2.0], ["stand", "stand_up"], ["wait", 1.0],
		["sit", "bed_lie", "lie_idle"], ["wait", 2.0], ["stand", "bed_up"], ["wait", 1.0]]
	s["костюм_гибель"] = [["wait", 1.0], ["act", "suit_on"], ["wait", 1.0], ["death"], ["wait", 2.0]]
	var em: Array = []
	for n in ["idle_look", "idle_stretch", "idle_cough", "idle_dosimeter", "idle_scratch", "greet", "wave", "agree", "nod", "talk", "afraid", "scared"]:
		if rig.info.has(n):
			em.append(["act", n])
			em.append(["wait", 0.5])
	if not em.is_empty():
		s["эмоции"] = [["wait", 1.0]] + em
	return s


func _reset() -> void:
	t = 0.0
	speed = 0.0
	target_speed = 0.0
	yaw = 0.0
	target_yaw = 0.0
	crouch = 0.0
	was_moving = false
	frames = []
	events = []
	qa.holder.position = Vector3.ZERO
	qa.holder.rotation = Vector3.ZERO
	rig.set_pose("")
	rig.stop_action()
	rig.set_motion(0.0, 0.0, 1.0)


func _play(name: String, steps: Array) -> void:
	_reset()
	RenderingServer.render_loop_enabled = false
	qa.vp.render_target_update_mode = SubViewport.UPDATE_DISABLED
	for i in 30:
		await _tick()
	frames = []
	t = 0.0
	for st in steps:
		match st[0]:
			"wait":
				await _run_for(st[1])
			"speed":
				target_speed = st[1]
				_ev("скорость → %.2f м/с" % st[1], 0.25)
				await _run_for(st[2])
			"turn":
				target_yaw = yaw + deg_to_rad(st[1])
				_ev("разворот %+.0f°" % st[1], 0.3)
				await _run_for(st[2])
			"crouch":
				crouch = st[1]
				_ev("присед" if st[1] > 0.5 else "встать из приседа", 0.25)
				await _run_for(st[2])
			"act":
				if not rig.has_clip(st[1]):
					continue
				var d := rig.play(st[1])
				_ev("→ " + st[1], rig.info[st[1]].blend)
				await _run_for(maxf(d - 0.1, 0.1))
				_ev(st[1] + " →", rig.info[st[1]].blend)
				await _run_for(0.1)
			"sit":
				# как player.do_interact: клип, в 45% — поза (sit()/rest()), конец клипа уходит в позу
				var d := rig.play(st[1])
				_ev("→ " + st[1], rig.info[st[1]].blend)
				var at := clampf(d * 0.45, 0.0, 0.9)
				await _run_for(at)
				rig.set_pose(st[2])
				_ev("поза " + st[2], 0.3)
				await _run_for(maxf(d - at, 0.1))
				_ev(st[1] + " → поза", rig.info[st[1]].blend)
			"stand":
				# как player.stand_up: клип поверх позы, поза снимается после его входа
				var d := rig.play(st[1])
				rig.set_pose("", rig.info[st[1]].blend)
				_ev("поза → " + st[1], rig.info[st[1]].blend)
				await _run_for(maxf(d - 0.1, 0.1))
				_ev(st[1] + " →", rig.info[st[1]].blend)
			"death":
				# как player.die
				var d := rig.play("death")
				rig.set_pose("dead", maxf(d - 0.45, 0.0))
				_ev("→ death", rig.info["death"].blend if rig.info.has("death") else 0.1)
	RenderingServer.render_loop_enabled = true
	qa.vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	var res := _measure(name)
	qa.result.sims[name] = res
	print("[qa] переходы «%s»: %s" % [name, res.verdict])
	for tr in res.transitions:
		if tr.verdict != "PASS":
			print("    ", tr.name, " ", tr.verdict, " ", tr.msg)
	if qa.shots:
		await _strip(name, res)


func _ev(what: String, blend: float) -> void:
	events.append([t, what, blend])


func _run_for(sec: float) -> void:
	var n := int(round(sec / dt))
	for i in n:
		await _tick()


## один кадр: тело как у героя, триггеры старта/остановки как в player.gd
func _tick() -> void:
	var dec := target_speed < speed
	speed = move_toward(speed, target_speed, ACCEL * dt * (1.6 if dec else 1.0))
	if target_speed > 0.0:
		yaw = lerp_angle(yaw, target_yaw, clampf(TURN * dt, 0.0, 1.0))
	var fwd := Vector3(sin(yaw), 0, cos(yaw))
	qa.holder.position += fwd * speed * dt
	qa.holder.rotation.y = yaw
	rig.set_motion(speed, crouch, dt)
	if speed > 2.5 and not was_moving and not rig.busy() and rig.has_clip("start"):
		rig.play("start")
		_ev("→ start", rig.info.start.blend)
	if speed < 0.3 and was_moving and not rig.busy() and rig.has_clip("stop") and speed < 0.5:
		rig.play("stop")
		_ev("→ stop", rig.info.stop.blend)
	was_moving = speed > 1.5
	qa._cap = {}
	await qa.get_tree().process_frame
	var s: Dictionary = qa._cap if not qa._cap.is_empty() else body.snap()
	if qa.debug_clip == "sim":
		var so: Dictionary = body.soles(s)
		print("[sim] %.3f v%.2f lock %s d %s R %s" % [t, speed, rig.ik.last_debug.get("lock"), str(rig.ik.last_debug.get("lock_d")), (so.R as Array).map(func(p): return (p as Vector3).snapped(Vector3(0.01, 0.01, 0.01)))])
	frames.append({"t": t, "s": s, "pos": qa.holder.position, "yaw": yaw, "speed": speed})
	t += dt


func _measure(name: String) -> Dictionary:
	var n := frames.size()
	# скорость суставов в системе тела (м/с) и смещение за кадр
	var jv: Array = []
	var jd: Array = []
	var jw: Array = []
	for i in n:
		if i == 0:
			jv.append(0.0)
			jd.append(0.0)
			jw.append("")
			continue
		var mx := 0.0
		var wj := ""
		for j in JOINTS:
			var dd: float = body.pos(frames[i].s, j).distance_to(body.pos(frames[i - 1].s, j))
			if dd > mx:
				mx = dd
				wj = j
		jd.append(mx)
		jw.append(wj)
		jv.append(mx / dt)
	# скольжение стоп в мире
	var slide: Array = []
	var slide_t: Array = []
	var prev := {}
	for i in n:
		var so: Dictionary = body.soles(frames[i].s)
		var xf := Transform3D(Basis(Vector3.UP, frames[i].yaw), frames[i].pos)
		var sv := 0.0
		for sd in ["L", "R"]:
			var pts: Array = so[sd]
			var w: Array = pts.map(func(p): return xf * (p as Vector3))
			var lo_i := 0
			for k in pts.size():
				if (pts[k] as Vector3).y < (pts[lo_i] as Vector3).y:
					lo_i = k
			if prev.has(sd) and (pts[lo_i] as Vector3).y < 0.03:
				var a: Vector3 = prev[sd][lo_i]
				var bb: Vector3 = w[lo_i]
				# кадр касания (в прошлом кадре точка была в воздухе): скорость — по следующему кадру, уже на полу
				if a.y >= 0.03 and i + 1 < n:
					var so2: Dictionary = body.soles(frames[i + 1].s)
					var xf2 := Transform3D(Basis(Vector3.UP, frames[i + 1].yaw), frames[i + 1].pos)
					a = bb
					bb = xf2 * (so2[sd][lo_i] as Vector3)
				var v := Vector2(bb.x - a.x, bb.z - a.z).length() / dt
				if v < maxf(0.35, 0.5 * float(frames[i].speed)):
					slide.append(v * 100.0)
					sv = maxf(sv, v * 100.0)
			prev[sd] = w
		slide_t.append(sv)
	var trs: Array = []
	var worst := 0
	for ev in events:
		var t0: float = ev[0]
		var bl: float = ev[2]
		var i0 := clampi(int(t0 / dt), 0, n - 1)
		var i1 := clampi(int((t0 + bl + 0.12) / dt), 0, n - 1)
		var b0 := clampi(int((t0 - 0.8) / dt), 0, n - 1)
		var a1 := clampi(int((t0 + bl + 1.0) / dt), 0, n - 1)
		var peak := 0.0
		var pop := 0.0
		var pj := ""
		for i in range(i0, i1 + 1):
			if jv[i] > peak:
				peak = jv[i]
				pj = jw[i]
			if i > 1 and i < n - 1:
				var nb := maxf(jd[i - 1], jd[i + 1])
				if jd[i] > 0.05 and jd[i] > 3.0 * maxf(nb, 0.005):
					pop = maxf(pop, jd[i])
					pj = jw[i]
		var ref := 0.0
		for i in range(b0, i0):
			ref = maxf(ref, jv[i])
		for i in range(i1 + 1, a1 + 1):
			ref = maxf(ref, jv[i])
		var r0 := maxf(ref, 0.3)
		var ratio := peak / r0
		# рывок: скачок за кадр — всегда FAIL; пик скорости суставов выше спокойных участков
		# FAIL — больше max(2×, +1.5 м/с), WARN — больше max(1.4×, +0.8 м/с)
		var lv := 0
		if pop > 0.0 or peak > maxf(2.0 * r0, r0 + 1.5):
			lv = 2
		elif peak > maxf(1.4 * r0, r0 + 0.8):
			lv = 1
		worst = maxi(worst, lv)
		trs.append({"name": ev[1], "t": snappedf(t0, 0.01), "blend": bl, "peak": snappedf(peak, 0.01), "ref": snappedf(ref, 0.01),
			"ratio": snappedf(ratio, 0.01), "pop_cm": snappedf(pop * 100.0, 0.1), "verdict": ["PASS", "WARN", "FAIL"][lv],
			"joint": pj, "msg": "пик %.2f м/с (%s) при %.2f в спокойных участках (×%.2f)%s" % [peak, pj, ref, ratio, (", скачок %.1f см за кадр" % (pop * 100.0)) if pop > 0.0 else ""]})
	var sm: float = qa._mean(slide)
	var s95: float = qa._pct(slide, 0.95)
	var slv: int = maxi(qa._lvl(sm, qa.LIM.slide_mean), qa._lvl(s95, qa.LIM.slide_p95))
	worst = maxi(worst, slv)
	var ser := {"t": [], "speed": [], "joint_v": [], "slide": []}
	for i in range(0, n, 2):
		ser.t.append(snappedf(frames[i].t, 0.001))
		ser.speed.append(snappedf(frames[i].speed, 0.01))
		ser.joint_v.append(snappedf(jv[i], 0.01))
		ser.slide.append(snappedf(slide_t[i], 0.1))
	return {"transitions": trs, "slide_mean": snappedf(sm, 0.1), "slide_p95": snappedf(s95, 0.1), "slide_verdict": ["PASS", "WARN", "FAIL"][slv],
		"verdict": ["PASS", "WARN", "FAIL"][worst], "series": ser, "events": events.map(func(e): return [snappedf(e[0], 0.01), e[1], e[2]])}


## полоса кадров вокруг самых тяжёлых переходов сценария (до 3 переходов × 6 кадров), вид сбоку-спереди
func _strip(name: String, res: Dictionary) -> void:
	var trs: Array = res.transitions.duplicate()
	trs.sort_custom(func(a, b): return a.ratio + a.pop_cm > b.ratio + b.pop_cm)
	trs = trs.slice(0, 3)
	if trs.is_empty():
		return
	var cell := Vector2i(180, 220)
	var cols := 6
	var sheet := Image.create(cell.x * cols, cell.y * trs.size(), false, Image.FORMAT_RGB8)
	for row in trs.size():
		var tr: Dictionary = trs[row]
		var t0: float = tr.t - 0.1
		var t1: float = tr.t + float(tr.blend) + 0.25
		for c in cols:
			var tt := lerpf(t0, t1, float(c) / (cols - 1))
			var i := clampi(int(tt / dt), 0, frames.size() - 1)
			var fr: Dictionary = frames[i]
			qa.holder.position = fr.pos
			qa.holder.rotation.y = fr.yaw
			qa.apply_snap(fr.s)
			await qa.get_tree().process_frame
			var hip: Vector3 = qa.holder.global_transform * body.pos(fr.s, "Hip")
			qa.view(50.0, Vector3(hip.x, 0.9, hip.z), 4.6, 1.6)
			qa.draw_skeleton(fr.s, body.soles(fr.s), {}, "%s %.2f с" % [tr.name, fr.t], "%s ×%.2f" % [tr.verdict, tr.ratio], tr.verdict if c == 0 else "")
			var img: Image = await qa.grab()
			img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
			sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(c * cell.x, row * cell.y))
	qa.overlay.clear()
	qa.holder.position = Vector3.ZERO
	qa.holder.rotation = Vector3.ZERO
	rig.skel.modifier_callback_mode_process = Skeleton3D.MODIFIER_CALLBACK_MODE_PROCESS_IDLE
	rig.tree.active = true
	sheet.save_png(qa.out.path_join("trans_%s_%s.png" % [qa.set_name, name]))
