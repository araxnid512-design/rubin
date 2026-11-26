class_name ULMutEliteAnim
extends ULEliteAnim
## Движения финального босса «Мутировавшая Элита» (задание пользователя 26.11). Скелет тот же, что у Элиты, поэтому
## ожидание, шаг, галоп, укус и удары лапами строятся тем же способом (лапы ставит решатель — опорная лапа стоит на
## месте, не скользит), а сверх того — свои, по видео пользователя и по описанию:
##   mut_turn        — разворот на месте: лапы переступают по очереди, корпус изгибается;
##   mut_slam        — удар двумя лапами по земле: перёд корпуса поднимается, обе лапы вверх, резкий удар (slam_hit);
##   mut_charge_prep — подготовка рывка: голова низко, корпус назад и вниз, лапа роет пол;
##   mut_tail        — удар хвостом: таз и позвоночник разворачиваются, хвост идёт широкой дугой (tail_hit);
##   mut_roar        — рёв и призыв: голова запрокинута, пасть раскрыта, дрожь (roar, summon);
##   mut_hit         — реакция на попадание: вздрагивает, голова в сторону;
##   mut_death       — тяжёлая гибель: голова вверх и предсмертный рёв, передние подкашиваются, корпус заваливается
##                     набок, удар о землю (land), последние движения хвоста и лап, замирает (end).


static func make_library(sk: Skeleton3D, verts := PackedVector3Array(), wts := []) -> AnimationLibrary:
	var g := ULMutEliteAnim.new()
	g.setup(sk, verts, wts)
	var lib := AnimationLibrary.new()
	lib.add_animation("elite_idle", g._make(6.0, true, g.idle, []))
	lib.add_animation("elite_walk", g._make(WALK_T, true, g.walk, [[0.0, "step"], [WALK_T * 0.5, "step"]]))
	lib.add_animation("elite_run", g._make(RUN_T, true, g.run, [[0.0, "step"]]))
	lib.add_animation("elite_bite_attack", g._make(1.8, false, g.bite, [[0.3, "swing"], [0.62, "bite_hit"]]))
	lib.add_animation("elite_claw_r", g._make(1.45, false, g.claw_r, [[0.32, "swing"], [0.46, "claw_r_hit"]]))
	lib.add_animation("elite_claw_l", g._make(1.45, false, g.claw_l, [[0.32, "swing"], [0.46, "claw_l_hit"]]))
	lib.add_animation("elite_claw_attack", g._make(2.25, false, g.claw_combo, [[0.32, "swing"], [0.46, "claw_r_hit"], [1.12, "swing"], [1.26, "claw_l_hit"]]))
	lib.add_animation("mut_turn", g._make(1.2, true, g.turn, [[0.0, "step"], [0.6, "step"]]))
	lib.add_animation("mut_slam", g._make(2.6, false, g.slam, [[0.2, "swing"], [1.15, "slam_hit"]]))
	lib.add_animation("mut_charge_prep", g._make(1.0, false, g.charge_prep, [[0.1, "swing"]]))
	lib.add_animation("mut_tail", g._make(1.9, false, g.tail_swipe, [[0.45, "swing"], [0.78, "tail_hit"]]))
	lib.add_animation("mut_roar", g._make(3.2, false, g.roar, [[0.45, "roar"], [1.7, "summon"]]))
	lib.add_animation("mut_hit", g._make(0.6, false, g.hit, []))
	var death0 := g._make(3.3, false, g.death, [[1.85, "land"], [3.25, "end"]])
	g._ground_fix(death0, 1.3)
	lib.add_animation("elite_death", death0)
	var death := g._make(5.2, false, g.death_long, [[0.35, "roar"], [3.45, "land"], [5.1, "end"]])
	g._ground_fix(death, 2.9)
	lib.add_animation("mut_death", death)
	lib.set_meta("report", g.report)
	return lib


# ---------------- разворот на месте ----------------

func turn(t: float) -> Dictionary:
	var per := 1.2
	var p := t / per
	var ph := {"LH": 0.0, "LF": 0.25, "RH": 0.5, "RF": 0.75}
	var legs := {}
	for lg in ph:
		legs[lg] = foot(p - float(ph[lg]), 0.7, 0.0, 0.2 if lg.ends_with("F") else 0.16, lg.ends_with("F"))
	var one := TAU * p
	var rot := {
		"Pelvis": Vector3(0, 4.0 * sin(one), -2.0 * sin(one)),
		"Spine1": Vector3(0, -3.0 * sin(one), 0),
		"Chest": Vector3(0, 3.0 * sin(one + 0.5), 1.5 * sin(one + 0.5)),
		"Neck1": Vector3(7.0, 5.0 * sin(one + 0.9), 0),
		"Neck2": Vector3(3.0, 3.0 * sin(one + 1.2), 0),
		"Head": Vector3(-5.0, 2.0 * sin(one + 1.5), 0),
		"Jaw": Vector3(-22.0, 0, 0),
	}
	_tail(rot, t, per, 9.0, 3.0, -3.0)
	return {"root": Vector3(0.05 * sin(one), 0.02 * cos(one * 2.0) - 0.02, 0), "rq": Vector3(0, 0, 1.6 * sin(one)), "rot": rot, "legs": legs}


# ---------------- удар двумя лапами по земле ----------------

func slam(t: float) -> Dictionary:
	# 0–0,95 с — перёд корпуса вверх, обе лапы поднимаются; 0,95–1,15 — удар; дальше — тяжёлое восстановление
	var up := cv([[0.0, 0.0], [0.55, 0.85], [0.95, 1.0], [1.15, -0.35], [1.5, -0.2], [2.1, 0.0], [2.6, 0.0]], t)
	var paw_y := cv([[0.0, 0.0], [0.25, 0.25], [0.6, 1.15], [0.95, 1.35], [1.13, 0.0], [2.6, 0.0]], t)
	var paw_z := cv([[0.0, 0.0], [0.6, -0.25], [0.95, -0.15], [1.13, 0.55], [1.6, 0.45], [2.3, 0.0], [2.6, 0.0]], t)
	var shake := 0.03 * sin(t * 60.0) * cv([[0.0, 0.0], [1.14, 0.0], [1.18, 1.0], [1.5, 0.0], [2.6, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(4.0 * up, 0, 0),
		"Spine1": Vector3(-7.0 * up, 0, 0),
		"Spine2": Vector3(-7.0 * up, 0, 0),
		"Chest": Vector3(-9.0 * up, 0, 0),
		"Neck1": Vector3(5.0 + 10.0 * up, 0, 0),
		"Neck2": Vector3(3.0 + 6.0 * up, 0, 0),
		"Head": Vector3(-4.0 + cv([[0.0, 0.0], [0.95, -6.0], [1.15, 14.0], [1.8, 4.0], [2.6, 0.0]], t), 0, 0),
		"Jaw": Vector3(cv([[0.0, -24.0], [0.6, 6.0], [1.1, 10.0], [1.3, -30.0], [2.6, -24.0]], t), 0, 0),
		"JawUp": Vector3(cv([[0.0, 0.0], [0.6, -6.0], [1.15, -8.0], [1.4, 0.0], [2.6, 0.0]], t), 0, 0),
		"L_Scapula": Vector3(cv([[0.0, 0.0], [0.8, 14.0], [1.13, -14.0], [2.2, 0.0], [2.6, 0.0]], t), 0, 0),
		"R_Scapula": Vector3(cv([[0.0, 0.0], [0.8, 14.0], [1.13, -14.0], [2.2, 0.0], [2.6, 0.0]], t), 0, 0),
	}
	for k in 5:
		rot["Tail%d" % (k + 1)] = Vector3(cv([[0.0, 0.0], [0.9, -8.0], [1.2, 10.0], [2.6, 0.0]], t) * (1.0 if k < 2 else 0.5), 3.0 * sin(t * 2.4 - k * 0.5), 0)
	var fl := cv([[0.0, 0.0], [0.6, 0.9], [0.95, 0.6], [1.13, -0.3], [1.6, 0.0], [2.6, 0.0]], t)
	var lw := 1.0 - 0.12 * sin(t * 2.0)
	var legs := {
		"LF": {"d": Vector3(0.05 * up, paw_y * lw, paw_z), "flex": fl, "claw": 0.4 * up},
		"RF": {"d": Vector3(-0.05 * up, paw_y, paw_z), "flex": fl, "claw": 0.4 * up},
	}
	var root := Vector3(shake, cv([[0.0, 0.0], [0.6, 0.06], [0.95, 0.1], [1.15, -0.2], [1.6, -0.1], [2.3, 0.0], [2.6, 0.0]], t), cv([[0.0, 0.0], [0.7, -0.3], [0.95, -0.35], [1.15, 0.3], [1.7, 0.2], [2.4, 0.0], [2.6, 0.0]], t))
	return {"root": root, "rq": Vector3(-6.0 * maxf(up, 0.0) + 3.0 * maxf(-up, 0.0), 0, 0), "rot": rot, "legs": legs}


# ---------------- подготовка рывка ----------------

func charge_prep(t: float) -> Dictionary:
	var k := cv([[0.0, 0.0], [0.35, 1.0], [0.85, 1.0], [1.0, 0.7]], t)
	var paw := cv([[0.0, 0.0], [0.25, 0.0], [0.4, 1.0], [0.55, 0.0], [0.7, 1.0], [0.85, 0.0], [1.0, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(-5.0 * k, 0, 0),
		"Spine1": Vector3(4.0 * k, 0, 0),
		"Chest": Vector3(7.0 * k, 0, 0),
		"Neck1": Vector3(5.0 + 14.0 * k, 0, 0),
		"Neck2": Vector3(3.0 + 8.0 * k, 0, 0),
		"Head": Vector3(-4.0 - 10.0 * k, 0, 2.5 * sin(t * 26.0) * k),
		"Jaw": Vector3(-24.0 - 8.0 * k, 0, 0),
		"L_Scapula": Vector3(8.0 * paw, 0, 0),
	}
	for i in 5:
		rot["Tail%d" % (i + 1)] = Vector3(-2.0 + 7.0 * k * (1.0 if i < 2 else 0.4), 8.0 * sin(t * 9.0 - i * 0.6) * k, 0)
	var legs := {"LF": {"d": Vector3(0, 0.22 * paw, 0.25 - 0.55 * paw), "flex": 0.5 * paw, "claw": 0.4 * paw}}
	return {"root": Vector3(0, -0.2 * k, -0.34 * k), "rq": Vector3(3.0 * k, 0, 0), "rot": rot, "legs": legs}


# ---------------- удар хвостом ----------------

func tail_swipe(t: float) -> Dictionary:
	# замах влево (0–0,45 с), широкая дуга вправо (0,45–0,85), возврат
	var sw := cv([[0.0, 0.0], [0.45, -1.0], [0.78, 1.0], [1.0, 0.9], [1.5, 0.15], [1.9, 0.0]], t)
	var lift := cv([[0.0, 0.0], [0.4, 1.0], [0.9, 1.0], [1.5, 0.2], [1.9, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(0, 10.0 * sw, 3.0 * sw),
		"Spine1": Vector3(0, -7.0 * sw, 0),
		"Spine2": Vector3(0, -6.0 * sw, 0),
		"Chest": Vector3(0, -5.0 * sw, -2.0 * sw),
		"Neck1": Vector3(6.0, -8.0 * sw, 0),
		"Neck2": Vector3(3.0, -6.0 * sw, 0),
		"Head": Vector3(-4.0, -8.0 * sw, 0),
		"Jaw": Vector3(cv([[0.0, -24.0], [0.45, 2.0], [0.9, 6.0], [1.5, -24.0], [1.9, -24.0]], t), 0, 0),
	}
	for k in 5:
		rot["Tail%d" % (k + 1)] = Vector3(lift * (22.0 if k == 0 else (16.0 if k == 1 else 9.0)), sw * (20.0 + 5.0 * k), 0)
	var legs := {
		"LH": {"d": Vector3(-0.12 * sw, 0.1 * absf(sin(PI * clampf((t - 0.3) / 0.5, 0.0, 1.0))), 0), "flex": 0.2 * lift},
		"RH": {"d": Vector3(-0.12 * sw, 0.0, 0), "flex": 0.0},
	}
	return {"root": Vector3(-0.1 * sw, -0.05 * lift, 0.06 * lift), "rq": Vector3(0, 9.0 * sw, -2.0 * sw), "rot": rot, "legs": legs}


# ---------------- рёв и призыв ----------------

func roar(t: float) -> Dictionary:
	var up := cv([[0.0, 0.0], [0.45, 1.0], [2.5, 1.0], [3.0, 0.1], [3.2, 0.0]], t)
	var sh := sin(t * 34.0) * cv([[0.0, 0.0], [0.5, 1.0], [2.4, 1.0], [2.7, 0.0], [3.2, 0.0]], t)
	var rot := {
		"Pelvis": Vector3(3.0 * up, 0, 0),
		"Spine1": Vector3(-4.0 * up, 0, 0),
		"Spine2": Vector3(-4.0 * up, 0, 0),
		"Chest": Vector3(-7.0 * up + 0.8 * sh, 0, 0),
		"Neck1": Vector3(5.0 - 22.0 * up, 2.0 * sh, 0),
		"Neck2": Vector3(3.0 - 18.0 * up, 0, 1.5 * sh),
		"Head": Vector3(-4.0 - 16.0 * up, 0, 3.0 * sh),
		"Jaw": Vector3(-24.0 + 38.0 * up + 2.0 * sh, 0, 0),
		"JawUp": Vector3(-9.0 * up, 0, 0),
		"L_Scapula": Vector3(-5.0 * up, 0, 0),
		"R_Scapula": Vector3(-5.0 * up, 0, 0),
	}
	for k in 5:
		rot["Tail%d" % (k + 1)] = Vector3(up * (14.0 if k < 2 else 6.0), 7.0 * sin(t * 5.0 - k * 0.7) * up, 0)
	return {"root": Vector3(0.012 * sh, 0.07 * up, -0.12 * up), "rq": Vector3(-3.0 * up, 0, 0), "rot": rot, "legs": {}}


# ---------------- реакция на попадание ----------------

func hit(t: float) -> Dictionary:
	var k := cv([[0.0, 0.0], [0.1, 1.0], [0.3, 0.5], [0.6, 0.0]], t)
	var rot := {
		"Spine2": Vector3(-2.0 * k, 3.0 * k, 0),
		"Chest": Vector3(-4.0 * k, 4.0 * k, 2.0 * k),
		"Neck1": Vector3(5.0 - 8.0 * k, 10.0 * k, 0),
		"Neck2": Vector3(3.0 - 4.0 * k, 8.0 * k, 0),
		"Head": Vector3(-4.0 - 6.0 * k, 8.0 * k, -6.0 * k),
		"Jaw": Vector3(-24.0 + 22.0 * k, 0, 0),
	}
	_tail(rot, t, 0.6, 6.0, 4.0, -4.0 + 8.0 * k)
	return {"root": Vector3(0.04 * k, -0.04 * k, -0.12 * k), "rq": Vector3(0, 0, -2.0 * k), "rot": rot, "legs": {}}


# ---------------- тяжёлая гибель ----------------

## 0–1,6 с — голова вверх, предсмертный рёв, тело дрожит; дальше — падение Элиты, растянутое в 1,15 раза
## (подкашиваются передние, корпус набок, удар о землю, последние движения), полная неподвижность.
func death_long(t: float) -> Dictionary:
	var lead := 1.6
	var td := maxf(t - lead, 0.0) / 1.15
	var d: Dictionary = death(td)
	var k := cv([[0.0, 0.0], [0.4, 1.0], [1.3, 1.0], [1.6, 0.6], [2.3, 0.0], [5.2, 0.0]], t)
	var sh := sin(t * 30.0) * cv([[0.0, 0.0], [0.4, 1.0], [1.3, 1.0], [1.7, 0.0], [5.2, 0.0]], t)
	var rot: Dictionary = (d.rot as Dictionary).duplicate()
	var add := {"Chest": Vector3(-6.0 * k, 0, 0), "Neck1": Vector3(-16.0 * k, 0, 2.0 * sh), "Neck2": Vector3(-14.0 * k, 0, 0), "Head": Vector3(-12.0 * k, 0, 3.0 * sh),
		"Jaw": Vector3(30.0 * k, 0, 0), "JawUp": Vector3(-7.0 * k, 0, 0)}
	for b in add:
		rot[b] = (rot.get(b, Vector3.ZERO) as Vector3) + (add[b] as Vector3)
	# последние движения хвоста после падения
	var tw := sin(t * 9.0) * cv([[0.0, 0.0], [3.6, 0.0], [3.8, 1.0], [4.5, 0.5], [4.9, 0.0], [5.2, 0.0]], t)
	for i in 5:
		var key := "Tail%d" % (i + 1)
		rot[key] = (rot.get(key, Vector3.ZERO) as Vector3) + Vector3(0, 5.0 * tw * (0.5 + 0.2 * i), 0)
	var out := d.duplicate()
	out["rot"] = rot
	out["root"] = (d.root as Vector3) + Vector3(0.012 * sh, 0.05 * k, 0)
	return out
