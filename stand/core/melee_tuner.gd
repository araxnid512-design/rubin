class_name ULMeleeTuner
extends RefCounted
## Помощник настройки холодного оружия (мачете): строит стойку и удары по анатомии и биомеханике рубящего удара,
## затем проверяет каждый ключ на настоящем скелете (стенд) и подправляет.
##
## Откуда правила (собраны из открытых источников, см. docs/WORLD.md, «Мачете»):
## - хват «молотком»: рукоять в кулаке поперёк ладони, держат большой и указательный пальцы, остальные — свободнее;
## - рабочий удар — диагональный, под 30–45° от вертикали: замах над плечом той же руки, клинок проходит наискось
##   через корпус вниз к противоположному бедру (обратный — зеркально); в конце удара — «щелчок» кистью;
## - удар приходится перед собой, по средней линии тела, рука почти выпрямлена (не в сторону от плеча);
## - лезвие ведёт удар (плоскостью или обухом мачете не рубят);
## - пределы запястья (активные, у взрослых): сгибание ≈ 74°, разгибание ≈ 66°, отведение к мизинцу (локтевое)
##   ≈ 28°, к большому пальцу (лучевое) ≈ 19°; в рабочих движениях — с запасом.
##
## Координаты как в data/weapons.json: [вперёд, вверх, вправо] от середины плеч, м (для руки 0.66 м — под руку
## персонажа масштабирует ULWeaponHold).

## пределы для ударов — чуть внутри предела IK (ULWeaponHold._wrist_fix: сгиб −58…60°, отведение −30…18°),
## а те — внутри анатомических; у самого предела кисть «упирается», и ладонь отходит от рукояти
const WRIST := {"flex": 58.0, "ext": 56.0, "radial": 17.0, "ulnar": 29.0}
const CUT_DEG := 40.0              ## наклон плоскости обычного удара от вертикали
const HEAVY_DEG := 14.0            ## сильный удар — почти отвесно сверху


## нормаль плоскости удара по направлениям клинка в замахе и в момент удара (вращение от замаха к удару)
static func plane_n(f_cock: Vector3, f_hit: Vector3) -> Vector3:
	return f_cock.normalized().cross(f_hit.normalized()).normalized()


## нормаль, при которой лезвие у клинка f смотрит в сторону e (лезвие = n × f)
static func n_for_edge(f: Vector3, e: Vector3) -> Vector3:
	f = f.normalized()
	e = (e - f * e.dot(f)).normalized()
	return f.cross(e).normalized()


static func _a(v: Vector3) -> Array:
	return [snappedf(v.x, 0.001), snappedf(v.y, 0.001), snappedf(v.z, 0.001)]


static func _vec(a: Array) -> Vector3:
	return Vector3(float(a[0]), float(a[1]), float(a[2]))


## направление из углов: yaw — вправо от «вперёд», pitch — вверх, град
static func dir_from(yaw_deg: float, pitch_deg: float) -> Vector3:
	var y := deg_to_rad(yaw_deg)
	var p := deg_to_rad(pitch_deg)
	return Vector3(cos(p) * cos(y), sin(p), cos(p) * sin(y))


static func angles_of(d: Vector3) -> Vector2:
	d = d.normalized()
	return Vector2(rad_to_deg(atan2(d.z, d.x)), rad_to_deg(asin(clampf(d.y, -1.0, 1.0))))


## Анатомический шаблон: стойка, удар (диагональ CUT_DEG), сильный удар (сверху), блок.
static func template() -> Dictionary:
	# стойка: кисть перед правым бедром-поясом, клинок вперёд-вверх на противника, лезвие к нему
	var g_pos := Vector3(0.3, -0.24, 0.12)
	var g_dir := Vector3(0.45, 0.86, -0.22).normalized()
	var g_n := n_for_edge(g_dir, Vector3(0.75, -0.6, 0.0))
	var guard := {"anchor": "grip", "pos": _a(g_pos), "dir": _a(g_dir), "edge_n": _a(g_n), "follow": 1.0, "twist": 0, "one": true}
	var gk := [_a(g_pos), _a(g_dir)]
	# удар: замах над правым плечом (клинок за головой, остриё назад-вверх), удар перед собой по средней линии
	# почти прямой рукой, клинок проходит наискось вниз к левому бедру; корпус: замах +22°, удар −12°, провод −24°
	var t := deg_to_rad(CUT_DEG)
	var cock := Vector3(-0.5, 0.78, -0.38).normalized()
	# в хвате «молотком» клинок не может лечь вдоль руки: при ударе прямой рукой он смотрит вперёд-вверх ≈ 45°
	# (лучезапястный сустав отведён к мизинцу до предела — это и есть «щелчок» кистью)
	var hit := Vector3(0.62, 0.74, -0.26).normalized()
	var light := {"len": 1.0, "edge_n": _a(plane_n(cock, hit)), "keys": [
		[0.0, gk[0], gk[1], 0],
		[0.26, _a(Vector3(0.02, 0.16, 0.3)), _a(cock), 22],
		[0.36, _a(Vector3(0.04, 0.17, 0.3)), _a((cock + Vector3(0.05, 0.02, 0.0)).normalized()), 24],
		[0.46, _a(Vector3(0.34, 0.13, 0.22)), _a(Vector3(0.3, 0.9, -0.3).normalized()), 6],
		[0.52, _a(Vector3(0.55, -0.05, 0.04)), _a(hit), -12],
		[0.6, _a(Vector3(0.43, -0.3, -0.12 - 0.1 * sin(t))), _a(Vector3(0.5, 0.35, -0.79).normalized()), -24],
		[0.74, _a(Vector3(0.37, -0.36, -0.12)), _a(Vector3(0.45, 0.3, -0.84).normalized()), -22],
		[1.0, gk[0], gk[1], 0],
	]}
	# сильный удар: замах выше головы, клинок назад; отвесно сверху вниз перед собой
	var hcock := Vector3(-0.72, 0.67, -0.16).normalized()
	var hhit := Vector3(0.62, 0.77, -0.14).normalized()
	var heavy := {"len": 1.3, "edge_n": _a(plane_n(hcock, hhit)), "keys": [
		[0.0, gk[0], gk[1], 0],
		[0.32, _a(Vector3(-0.02, 0.34, 0.16)), _a(hcock), 14],
		[0.44, _a(Vector3(-0.03, 0.36, 0.16)), _a((hcock + Vector3(0.04, 0.03, 0.0)).normalized()), 16],
		[0.54, _a(Vector3(0.38, 0.22, 0.1)), _a(Vector3(0.22, 0.96, -0.1).normalized()), 2],
		[0.6, _a(Vector3(0.56, -0.02, 0.06)), _a(hhit), -8],
		[0.68, _a(Vector3(0.46, -0.32, 0.03)), _a(Vector3(0.88, 0.35, -0.3).normalized()), -14],
		[0.8, _a(Vector3(0.42, -0.36, 0.03)), _a(Vector3(0.85, 0.4, -0.33).normalized()), -14],
		[1.0, gk[0], gk[1], 0],
	]}
	# блок: клинок поперёк перед лицом, лезвием наружу (к удару)
	var b_dir := Vector3(0.1, 0.42, -0.9).normalized()
	var block := {"len": 1.2, "edge_n": _a(n_for_edge(b_dir, Vector3(0.9, 0.4, 0.0))), "keys": [
		[0.0, gk[0], gk[1], 0],
		[0.18, _a(Vector3(0.4, 0.03, 0.19)), _a(b_dir), 8],
		[0.75, _a(Vector3(0.4, 0.04, 0.19)), _a(b_dir), 8],
		[1.0, gk[0], gk[1], 0],
	]}
	return {"guard": guard, "moves": {"light": light, "heavy": heavy, "block": block}}


## проверка одного ключа по замеру на скелете: wa — углы запястья (сгиб, отведение), err — недотяг руки, м;
## pos — точка хвата [вперёд, вверх, вправо]; impact — это ключ удара
static func check(wa: Vector2, err: float, pos: Vector3, impact: bool) -> Array:
	var bad: Array = []
	if wa.x > WRIST.flex:
		bad.append("кисть согнута %d° (норма до %d°)" % [int(wa.x), int(WRIST.flex)])
	if -wa.x > WRIST.ext:
		bad.append("кисть разогнута %d° (норма до %d°)" % [int(-wa.x), int(WRIST.ext)])
	if wa.y > WRIST.radial:
		bad.append("кисть отведена к большому пальцу %d° (норма до %d°)" % [int(wa.y), int(WRIST.radial)])
	if -wa.y > WRIST.ulnar:
		bad.append("кисть отведена к мизинцу %d° (норма до %d°)" % [int(-wa.y), int(WRIST.ulnar)])
	if err > 0.03:
		bad.append("рука не дотягивается до рукояти (%.1f см)" % (err * 100.0))
	if impact and (pos.x < 0.4 or absf(pos.z) > 0.16):
		bad.append("удар не перед собой (вперёд %.2f м, вбок %.2f м)" % [pos.x, pos.z])
	return bad


## поправка направления клинка по запястью: на сколько градусов повернуть (по сгибу и отведению), чтобы войти в
## пределы (знак — «в сторону нормы»; поворот делает стенд, проверяя, стало ли лучше)
static func excess(wa: Vector2) -> Vector2:
	var fx := 0.0
	if wa.x > WRIST.flex:
		fx = wa.x - WRIST.flex
	elif -wa.x > WRIST.ext:
		fx = wa.x + WRIST.ext
	var dv := 0.0
	if wa.y > WRIST.radial:
		dv = wa.y - WRIST.radial
	elif -wa.y > WRIST.ulnar:
		dv = wa.y + WRIST.ulnar
	return Vector2(fx, dv)
