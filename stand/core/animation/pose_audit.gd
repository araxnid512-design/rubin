class_name BCPoseAudit
extends RefCounted
## Проверка поз персонажа по замерам итоговой позы (BCProbe): стоит ли ровно, не заваливается ли, не
## переваливается ли на ходу, стоят ли стопы на полу, нормально ли лежит тело после гибели.
## Один и тот же расчёт — на стенде 3D (строка «поза: …», кнопка «Проверка поз») и в автопроверке
## (--as-test=poses). Пороги — data/pose_audit.json; для существ (заражённые) допуски шире: они сутулятся.
##
## Виды замера: stand — стоит на месте; move — идёт или бежит; action — разовое движение (удар, попадание);
## dead — тело лежит после падения.

const CFG := "res://data/pose_audit.json"
const BONES := ["Hip", "Head", "Spine02", "L_Hand", "R_Hand", "L_Foot", "R_Foot", "L_Calf", "R_Calf", "L_ToeBase", "R_ToeBase", "L_Thigh", "R_Thigh"]
static var _cfg := {}

var mode := "stand"
var group := "human"              ## human — человек (герой, мур), creature — заражённый
var crouch := false               ## движение в приседе: таз низко — это норма
var k := 1.0                      ## рост / 1,78 — пороги в метрах растут с ростом
var n := 0
var t := 0.0
var _rig: BCCharacter
var _a0 := 0.09                   ## высота сустава стопы над полом в позе покоя
var _t0 := 0.03                   ## высота сустава носка над полом в позе покоя
var _side0 := 1.0                 ## знак «левая стопа левее правой» в позе покоя
var _lf := 0.0                    ## суммы наклона (вперёд, вбок), град
var _ls := 0.0
var _ls_min := 999.0
var _ls_max := -999.0
var _lf_min := 999.0
var _lf_max := -999.0
var _hx_min := 999.0
var _hx_max := -999.0
var _hip := 0.0
var _lo_sum := 0.0
var _lo_min := 999.0
var _cross := 0
var _knee := 0.0                  ## насколько колено уходило назад (худший кадр), м
var _jerk := 0.0                  ## наибольшая скорость таза между кадрами, м/с
var _prev := Vector3.INF
var _last := {}                   ## последний замер: кость → положение в системе персонажа


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG)) if FileAccess.file_exists(CFG) else null
		_cfg = d if d is Dictionary else {}
	return _cfg


static func lim(group_n: String, mode_n: String, key: String, def: float) -> float:
	var g: Dictionary = cfg().get(group_n, {})
	var m: Dictionary = g.get(mode_n, {})
	return float(m.get(key, def))


## Начать замер: rig — персонаж, mode_n — вид замера, group_n — человек или существо.
func begin(rig: BCCharacter, mode_n: String, group_n := "human", crouch_on := false) -> void:
	_rig = rig
	mode = mode_n
	group = group_n
	crouch = crouch_on
	k = rig.height / 1.78
	n = 0
	t = 0.0
	_lf = 0.0
	_ls = 0.0
	_ls_min = 999.0
	_ls_max = -999.0
	_lf_min = 999.0
	_lf_max = -999.0
	_hx_min = 999.0
	_hx_max = -999.0
	_hip = 0.0
	_lo_sum = 0.0
	_lo_min = 999.0
	_cross = 0
	_knee = 0.0
	_jerk = 0.0
	_prev = Vector3.INF
	_last = {}
	if rig.probe != null:
		var add := false
		for b in BONES:
			if not rig.probe.bones.has(b):
				rig.probe.bones.append(b)
				add = true
		if add:
			rig.probe._idx.clear()
	# поза покоя: подошва на полу — отсюда высота суставов стопы и носка
	var sk := rig.skel
	var to_rig := rig.global_transform.affine_inverse() * sk.global_transform
	var fl := sk.find_bone("L_Foot")
	var fr := sk.find_bone("R_Foot")
	var tl := sk.find_bone("L_ToeBase")
	if fl >= 0 and fr >= 0:
		var pl: Vector3 = to_rig * sk.get_bone_global_rest(fl).origin
		var pr: Vector3 = to_rig * sk.get_bone_global_rest(fr).origin
		_a0 = clampf((pl.y + pr.y) * 0.5, 0.02, 0.25 * k)
		_side0 = 1.0 if pl.x >= pr.x else -1.0
	if tl >= 0:
		_t0 = clampf((to_rig * sk.get_bone_global_rest(tl).origin).y, 0.0, 0.15 * k)


## Один замер (каждый кадр, пока идёт движение). direct — читать позу прямо из скелета (тело после падения
## на физике: поправки уже не считаются, поза записана в кости).
func sample(delta: float, direct := false) -> void:
	if _rig == null or _rig.skel == null:
		return
	if not direct and (_rig.probe == null or _rig.probe.pos.is_empty()):
		return
	var to_rig := _rig.global_transform.affine_inverse() * _rig.skel.global_transform
	var p := {}
	for b in BONES:
		if direct:
			var bi := _rig.skel.find_bone(b)
			if bi >= 0:
				p[b] = to_rig * _rig.skel.get_bone_global_pose(bi).origin
		elif _rig.probe.pos.has(b):
			p[b] = to_rig * (_rig.probe.pos[b] as Vector3)
	if not (p.has("Hip") and p.has("Head") and p.has("L_Foot") and p.has("R_Foot")):
		return
	_last = p
	n += 1
	t += delta
	var feet: Vector3 = ((p.L_Foot as Vector3) + (p.R_Foot as Vector3)) * 0.5
	var v: Vector3 = (p.Head as Vector3) - feet
	var lf := rad_to_deg(atan2(v.z, maxf(v.y, 0.001)))
	var ls := rad_to_deg(atan2(v.x, maxf(v.y, 0.001)))
	_lf += lf
	_ls += ls
	_lf_min = minf(_lf_min, lf)
	_lf_max = maxf(_lf_max, lf)
	_ls_min = minf(_ls_min, ls)
	_ls_max = maxf(_ls_max, ls)
	var hip: Vector3 = p.Hip
	_hx_min = minf(_hx_min, hip.x - feet.x)
	_hx_max = maxf(_hx_max, hip.x - feet.x)
	_hip += hip.y
	# нижняя точка стоп над полом: сустав стопы и сустав носка, каждый — за вычетом своей высоты в покое
	var lo := 999.0
	for s in ["L", "R"]:
		lo = minf(lo, (p[s + "_Foot"] as Vector3).y - _a0)
		if p.has(s + "_ToeBase"):
			lo = minf(lo, (p[s + "_ToeBase"] as Vector3).y - _t0)
	_lo_sum += lo
	_lo_min = minf(_lo_min, lo)
	if ((p.L_Foot as Vector3).x - (p.R_Foot as Vector3).x) * _side0 < -0.04 * k:
		_cross += 1
	# колено: середина «бедро — стопа» против сустава колена; колено позади этой линии — нога выгнута назад
	for s in ["L", "R"]:
		if p.has(s + "_Thigh") and p.has(s + "_Calf"):
			var mid: Vector3 = ((p[s + "_Thigh"] as Vector3) + (p[s + "_Foot"] as Vector3)) * 0.5
			_knee = maxf(_knee, mid.z - (p[s + "_Calf"] as Vector3).z)
	if _prev != Vector3.INF and delta > 0.0005:
		_jerk = maxf(_jerk, (hip - _prev).length() / delta)
	_prev = hip


## Итог: {ok, notes — что не так (простыми словами), text — короткая строка, vals — числа}.
func result() -> Dictionary:
	var notes: Array = []
	if n < 3 and not (mode == "dead" and n > 0):
		return {"ok": true, "notes": notes, "text": "мало замеров", "vals": {}, "n": n}
	var lf := _lf / n
	var ls := _ls / n
	var hip := _hip / n
	var lo := _lo_sum / n
	var sway := (_hx_max - _hx_min) / k
	var roll := _ls_max - _ls_min
	var vals := {"lean_f": lf, "lean_s": ls, "roll": roll, "sway": sway, "hip": hip / k, "foot_avg": lo / k, "foot_min": _lo_min / k, "knee": _knee / k, "jerk": _jerk / k, "cross": float(_cross) / n}
	if mode == "dead":
		_dead(notes, vals)
	else:
		var m := mode
		var f_max := lim(group, m, "fwd_max", 16.0)
		var f_min := lim(group, m, "fwd_min", -8.0)
		var s_max := lim(group, m, "side_max", 6.0)
		if m != "action":
			if lf > f_max:
				notes.append("заваливается вперёд: %.0f° (норма до %.0f°)" % [lf, f_max])
			if lf < f_min:
				notes.append("заваливается назад: %.0f° (норма до %.0f°)" % [-lf, -f_min])
			if absf(ls) > s_max:
				notes.append("заваливается на%s: %.0f° (норма до %.0f°)" % ["лево" if ls > 0.0 else "право", absf(ls), s_max])
			var hip_min := lim(group, m, "hip_min", 0.42)
			if not crouch and hip / k < hip_min * 1.0:
				notes.append("осел: таз на высоте %.2f м (норма от %.2f м)" % [hip, hip_min * k])
			if float(_cross) / n > 0.5:
				notes.append("ноги скрещены")
		if m == "move":
			var roll_max := lim(group, m, "roll_max", 14.0)
			var sway_max := lim(group, m, "sway_max", 0.16)
			if roll > roll_max:
				notes.append("переваливается с боку на бок: размах %.0f° (норма до %.0f°)" % [roll, roll_max])
			if sway > sway_max:
				notes.append("таз гуляет вбок на %.0f см (норма до %.0f см)" % [sway * k * 100.0, sway_max * k * 100.0])
			if _lo_min > lim(group, m, "air_max", 0.05) * k:
				notes.append("стопы не касаются пола: зазор %.0f см" % (_lo_min * 100.0))
		elif m == "stand":
			if lo > lim(group, m, "air_max", 0.04) * k:
				notes.append("висит над полом: %.0f см" % (lo * 100.0))
			var jerk_max := lim(group, m, "jerk_max", 1.6)
			if _jerk / k > jerk_max and t > 0.5:
				notes.append("дёргается: таз смещается рывком (%.1f м/с)" % _jerk)
		if _lo_min < -lim(group, m, "sink_max", 0.06) * k:
			notes.append("стопа уходит под пол на %.0f см" % (-_lo_min * 100.0))
		var knee_max := lim(group, m, "knee_back", 0.07)
		if _knee / k > knee_max:
			notes.append("колено выгибается назад на %.0f см" % (_knee * 100.0))
	var text := "норма" if notes.is_empty() else String(notes[0])
	return {"ok": notes.is_empty(), "notes": notes, "text": text, "vals": vals, "n": n}


## Тело после гибели — по последнему замеру: лежит (ничего не торчит вверх), не ушло в пол.
func _dead(notes: Array, vals: Dictionary) -> void:
	var top := -999.0
	var low := 999.0
	var top_b := ""
	for b in _last:
		var y: float = (_last[b] as Vector3).y
		if y > top:
			top = y
			top_b = String(b)
		low = minf(low, y)
	vals["top"] = top / k
	vals["low"] = low / k
	var names := {"Hip": "таз", "Head": "голова", "Spine02": "грудь", "L_Hand": "левая кисть", "R_Hand": "правая кисть", "L_Foot": "левая стопа", "R_Foot": "правая стопа", "L_Calf": "левое колено", "R_Calf": "правое колено", "L_ToeBase": "левый носок", "R_ToeBase": "правый носок", "L_Thigh": "левое бедро", "R_Thigh": "правое бедро"}
	var body_max := lim(group, "dead", "body_max", 0.42)
	var limb_max := lim(group, "dead", "limb_max", 0.6)
	for b in ["Hip", "Head", "Spine02"]:
		if _last.has(b) and (_last[b] as Vector3).y > body_max * k:
			notes.append("не лёг: %s на высоте %.2f м (норма до %.2f м)" % [names[b], (_last[b] as Vector3).y, body_max * k])
	if top > limb_max * k and not top_b in ["Hip", "Head", "Spine02"]:
		notes.append("торчит вверх %s: %.2f м (норма до %.2f м)" % [names.get(top_b, top_b), top, limb_max * k])
	if low < -lim(group, "dead", "sink_max", 0.1) * k:
		notes.append("тело уходит под пол на %.0f см" % (-low * 100.0))


## Короткая строка для стенда.
func line() -> String:
	var r := result()
	if r.vals.is_empty():
		return "поза: замер…"
	if mode == "dead":
		return "поза лёжа: %s" % r.text
	return "поза: %s (вперёд %.0f°, вбок %.0f°, стопы %+.0f см)" % [r.text, float(r.vals.lean_f), float(r.vals.lean_s), float(r.vals.foot_avg) * k * 100.0]
