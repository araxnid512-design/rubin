extends RefCounted
## Сравнение с эталоном (лаборатория QA, режим --bc-qa=phases): фазы шага и бега нашей модели против средних
## углов в сагиттальной плоскости из клинического анализа походки. Для каждой фазы — вид сбоку: модель со
## скелетом, поверх — эталонная нога (жёлтая), построенная из нормативных углов (бедро, колено, голеностоп) на
## длинах сегментов нашей модели от нашего тазобедренного сустава; подписи — наши углы и норма.
## Нормы (оценки по графикам, ±5–10°):
##   ходьба — Perry & Burnfield «Gait Analysis: Normal and Pathological Function», 2010; Whittle «Gait Analysis», 2007;
##   бег — Novacheck T. F. «The biomechanics of running», Gait & Posture 7 (1998) 77–95.

## фаза: [название, доля цикла от постановки стопы, бедро (сгиб +), колено (сгиб +), стопа (тыльный +)]
const WALK := [
	["постановка пятки", 0.0, 30.0, 5.0, 0.0],
	["нагружение", 0.10, 25.0, 18.0, -5.0],
	["середина опоры", 0.30, 0.0, 5.0, 5.0],
	["конец опоры", 0.50, -10.0, 5.0, 10.0],
	["отрыв носка", 0.62, 0.0, 38.0, -15.0],
	["середина переноса", 0.75, 20.0, 60.0, -5.0],
]
const RUN := [
	["касание", 0.0, 40.0, 18.0, 3.0],
	["середина опоры", 0.15, 20.0, 42.0, 18.0],
	["толчок (отрыв)", 0.35, -10.0, 20.0, -20.0],
	["полёт", 0.50, 25.0, 75.0, -5.0],
	["середина переноса", 0.70, 45.0, 100.0, 0.0],
	["конец переноса", 0.90, 45.0, 40.0, 0.0],
]

var qa


func run(q) -> void:
	qa = q
	var out := {}
	for n in ["walk", "run"]:
		if qa.rig.info.has(n):
			out[n] = await _clip(n, WALK if n == "walk" else RUN)
	qa.result["phases"] = out


func _clip(n: String, norm: Array) -> Dictionary:
	var rig: BCCharacter = qa.rig
	var body = qa.body
	var L: float = rig.info[n].len
	var strides: float = maxf(float(rig.info[n].strides), 1.0)
	var T := L / strides
	# постановка левой стопы — по сырой позе (самая низкая точка подошвы ниже 3 см, стопа едет назад)
	var dt := 1.0 / 60.0
	var t0 := 0.0
	var prev_on := true
	var t := 0.0
	var prev_z := 0.0
	while t < L:
		qa.pose_clip(n, t)
		var s: Dictionary = body.snap()
		var so: Dictionary = body.soles(s)
		var lo := INF
		var z := 0.0
		for p in so.L:
			if (p as Vector3).y < lo:
				lo = (p as Vector3).y
				z = (p as Vector3).z
		var on := lo < 0.03 and z <= prev_z
		if on and not prev_on:
			t0 = t
			break
		prev_on = on
		prev_z = z
		t += dt
	var cell := Vector2i(220, 300)
	var sheet := Image.create(cell.x * norm.size(), cell.y, false, Image.FORMAT_RGB8)
	var rows: Array = []
	for c in norm.size():
		var ph: Array = norm[c]
		var tt := fposmod(t0 + float(ph[1]) * T, L)
		qa.pose_clip(n, tt)
		await qa.get_tree().process_frame
		var s: Dictionary = body.snap()
		var A: Dictionary = body.angles(s)
		var hip: Vector3 = body.pos(s, "Hip")
		qa.view(90.0, Vector3(hip.x, 0.9, hip.z), 4.0, 1.1)
		qa.draw_skeleton(s, body.soles(s), {}, "%s: %s" % [n, ph[0]], "%.0f%% цикла, %.2f с" % [float(ph[1]) * 100.0, tt])
		# эталонная левая нога: от нашего тазобедренного сустава, наши длины сегментов, нормативные углы
		var wx: Transform3D = rig.global_transform
		var H: Vector3 = body.pos(s, "L_Thigh")
		var K: Vector3 = body.pos(s, "L_Calf")
		var An: Vector3 = body.pos(s, "L_Foot")
		var Tb: Vector3 = body.pos(s, "L_ToeBase")
		var lt := H.distance_to(K)
		var ls := K.distance_to(An)
		var lf := An.distance_to(Tb)
		var hip_a := deg_to_rad(float(ph[2]))
		var knee_a := deg_to_rad(float(ph[3]))
		var ank_a := deg_to_rad(float(ph[4]))
		# в системе героя: вперёд +Z, вверх +Y; угол от вертикали вниз, вперёд — положительный
		var d_th := Vector3(0, -cos(hip_a), sin(hip_a))
		var a_sh := hip_a - knee_a
		var d_sh := Vector3(0, -cos(a_sh), sin(a_sh))
		var a_ft := a_sh + PI * 0.5 + ank_a
		var d_ft := Vector3(0, -cos(a_ft), sin(a_ft))
		var rK := H + d_th * lt
		var rA := rK + d_sh * ls
		var rT := rA + d_ft * lf
		var o: Control = qa.overlay
		var cam: Camera3D = qa.cam
		var yc := Color(1.0, 0.85, 0.1, 0.9)
		for seg in [[H, rK], [rK, rA], [rA, rT]]:
			o.lines.append([cam.unproject_position(wx * (seg[0] as Vector3)), cam.unproject_position(wx * (seg[1] as Vector3)), yc, 3.0])
		for p in [rK, rA]:
			o.rings.append([cam.unproject_position(wx * p), 5.0, yc, 2.0])
		var our := [A["бедро_сгиб_L"], A["колено_L"], A["стопа_сгиб_L"]]
		var lines := ["бедро %+.0f° (норма %+.0f°)" % [our[0], ph[2]], "колено %.0f° (норма %.0f°)" % [our[1], ph[3]], "стопа %+.0f° (норма %+.0f°)" % [our[2], ph[4]]]
		var y0 := float(qa.vp.size.y) - 52.0
		for i in lines.size():
			var dv := absf(float(our[i]) - float(ph[2 + i]))
			o.texts.append([Vector2(6, y0 + 16.0 * i), lines[i], Color(1, 0.4, 0.4) if dv > 20.0 else (Color(1, 0.85, 0.3) if dv > 10.0 else Color(0.5, 1, 0.5)), 13])
		o.queue_redraw()
		var img: Image = await qa.grab()
		img.resize(cell.x, cell.y, Image.INTERPOLATE_BILINEAR)
		sheet.blit_rect(img, Rect2i(Vector2i.ZERO, cell), Vector2i(c * cell.x, 0))
		rows.append({"phase": ph[0], "share": ph[1], "t": snappedf(tt, 0.001), "hip": snappedf(our[0], 0.1), "knee": snappedf(our[1], 0.1),
			"ankle": snappedf(our[2], 0.1), "norm": [ph[2], ph[3], ph[4]]})
	qa.overlay.clear()
	sheet.save_png(qa.out.path_join("phases_%s_%s.png" % [qa.set_name, n]))
	return {"t0": t0, "stride": T, "rows": rows}
