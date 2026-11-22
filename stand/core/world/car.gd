class_name ULCar
extends CharacterBody3D
## УАЗ-469 героя (ТЗ «Гараж, транспорт, модернизация, топливо, вооружение», docs/PLANS.md п. 5).
##
## Тело — CharacterBody3D с коробкой столкновений: держится земли, упирается в стены, не переворачивается. Кузов и
## колёса — отдельные узлы: колёса (4 модели) крутятся по пройденному пути, передние поворачиваются; кузов сидит на
## «пружинах» — повторяет неровности под колёсами, клюёт при торможении, приседает назад при разгоне, кренится в
## повороте. Поворот — по колёсной базе (велосипедная модель): машина идёт по дуге, на месте не крутится; радиус
## зависит от угла колёс, а их предельный угол на скорости меньше. Задний ход — назад и медленнее; при повёрнутых
## колёсах зад уходит в сторону поворота, как у настоящей машины.
##
## Детали (колёса, двигатель, кузов, бампер, багажник) — свои уровень и прочность (сохраняются в data, ULBase):
## изношенные колёса хуже держат дорогу, двигатель — меньше тянет, кузов — хуже защищает, бампер — хуже держит удар.
## Прочность машины — прочность кузова. Бензин тратится на ходу; нет бензина или двигатель разрушен — не едет.
## На крыше — место для турели (одна установлена): поворотная часть наводится в точку, выстрелы считает мир.
## Числа — data/car.json (предложение, не утверждённый баланс).

const CFG := "res://data/car.json"
const PARTS := ["wheels", "engine", "body", "bumper", "trunk"]
static var _cfg := {}

var data: Dictionary = {}           ## сохранение машины (ULBase.car_data): детали, бензин, багажник, турели
var speed := 0.0                    ## м/с вдоль курса: + вперёд, − назад
var steer := 0.0                    ## угол передних колёс, рад (+ — влево)
var throttle := 0.0                 ## управление: газ +1 … задний ход −1
var steer_in := 0.0                 ## руль: +1 — влево, −1 — вправо
var brake := false                  ## тормоз
var size := Vector3(2.1, 2.2, 4.0)  ## ширина, высота, длина кузова (м)
var body: Node3D                    ## кузов на пружинах: модель, навесное, турель
var model: Node3D
var parts_n: Node3D
var smoke: CPUParticles3D
var crashed := 0.0                  ## сила последнего удара (для звука), сбрасывает мир
var front_hit := false
var dist_total := 0.0
var yaw_rate := 0.0
var _crash_cd := 0.0
var _wheels: Array = []             ## {at: центр в покое (система машины), front, r, dy, steer: Node3D, spin: Node3D}
var _wheel_base_r := 0.42
var _wb := 2.38                     ## колёсная база (м)
var _track := 1.44
var _pitch := 0.0
var _roll := 0.0
var _pv := 0.0
var _rv := 0.0
var _heave := 0.0
var _hv := 0.0
var _prev_speed := 0.0
var _mat_metal: StandardMaterial3D
var _mat_plate: StandardMaterial3D
# турель
var turret_root: Node3D             ## кольцо на крыше
var turret_yaw: Node3D              ## поворотная часть
var turret_muzzle: Node3D
var turret_aim := 0.0               ## куда наведена (рад, относительно курса машины)
var turret_want := 0.0
var _fire_cd := 0.0


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


static func c(key: String, def: float) -> float:
	return float(cfg().get(key, def))


static func part_cfg(cat: String) -> Dictionary:
	return (cfg().get("parts", {}) as Dictionary).get(cat, {})


static func lvl_cfg(cat: String, n: int) -> Dictionary:
	var ls: Array = part_cfg(cat).get("levels", [])
	return ls[clampi(n, 0, ls.size() - 1)] if not ls.is_empty() else {}


static func max_lvl(cat: String) -> int:
	return (part_cfg(cat).get("levels", []) as Array).size() - 1


static func turret_cfg(t: String) -> Dictionary:
	return (cfg().get("turrets", {}) as Dictionary).get(t, {})


## сохранение новой машины: стандартные детали, немного бензина, пустой багажник, без турели
static func new_data(id := "uaz469") -> Dictionary:
	var parts := {}
	for k in PARTS:
		var p := {"lvl": 0, "own": 0}
		if lvl_cfg(k, 0).has("hp"):
			p["hp"] = float(lvl_cfg(k, 0).hp)
		parts[k] = p
	var tr := []
	tr.resize(int(lvl_cfg("trunk", 0).get("cells", 30)))
	return {"id": id, "parts": parts, "fuel": c("fuel_start", 10.0), "trunk": tr, "turret": "", "turrets": {}, "at": []}


## привести сохранение к нынешнему виду (новые детали, уровни в пределах, багажник по уровню)
static func norm_data(d: Dictionary) -> void:
	if not (d.get("parts") is Dictionary):
		d["parts"] = {}
	for k in PARTS:
		if not (d.parts.get(k) is Dictionary):
			d.parts[k] = {"lvl": 0, "own": 0}
		var p: Dictionary = d.parts[k]
		p["own"] = clampi(int(p.get("own", 0)), 0, max_lvl(k))
		p["lvl"] = clampi(int(p.get("lvl", 0)), 0, int(p.own))
		var lc := lvl_cfg(k, int(p.lvl))
		if lc.has("hp"):
			p["hp"] = clampf(float(p.get("hp", lc.hp)), 0.0, float(lc.hp))
	d["fuel"] = clampf(float(d.get("fuel", 0.0)), 0.0, c("fuel_tank", 60.0))
	var tr = d.get("trunk")
	if not (tr is Array):
		tr = []
	tr.resize(maxi(int(lvl_cfg("trunk", int(d.parts.trunk.lvl)).get("cells", 30)), tr.size()))
	for i in tr.size():
		if tr[i] != null and not (tr[i] is Dictionary):
			tr[i] = null
	d["trunk"] = tr
	if not (d.get("turrets") is Dictionary):
		d["turrets"] = {}
	for t in d.turrets.keys():
		if turret_cfg(String(t)).is_empty():
			d.turrets.erase(t)
	if String(d.get("turret", "")) != "" and not d.turrets.has(String(d.turret)):
		d["turret"] = ""
	if not (d.get("at") is Array):
		d["at"] = []


# ---------------- сборка ----------------

## собрать машину (узел уже в дереве): кузов без колёс, четыре колеса, коробка столкновений, дым, навесное
func setup(d: Dictionary) -> void:
	data = d
	norm_data(data)
	body = Node3D.new()
	body.name = "Body"
	add_child(body)
	var path := String(cfg().get("model", "res://assets/world/car_uaz_body.glb"))
	model = (load(path) as PackedScene).instantiate()
	body.add_child(model)
	# модели Tripo смотрят передом вдоль +X; у машины перёд — +Z (как у героя: курс = atan2(x, z))
	model.rotation.y = -PI * 0.5
	var tn: Array = cfg().get("tint", [1.0, 1.0, 1.0])
	_matte(model, Color(float(tn[0]), float(tn[1]), float(tn[2])))
	var box := _box_in(model, self)
	var k := c("length", 4.0) / maxf(box.size.z, 0.01)
	model.scale = Vector3.ONE * k
	box = _box_in(model, self)
	model.position = Vector3(-box.get_center().x, -box.position.y, -box.get_center().z)
	size = box.size
	# колёса — из записи резчика (tools/cut_wheels.mjs): центры в системе glTF-модели
	_wheels_from_json(path.get_basename() + ".wheels.json")
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	# коробка чуть уже кузова, от низа колёс до крыши без тента
	bs.size = Vector3(size.x * 0.92, size.y * 0.72, size.z * 0.96)
	cs.shape = bs
	cs.position.y = bs.size.y * 0.5
	add_child(cs)
	collision_layer = 1
	collision_mask = 1
	floor_snap_length = 0.7
	floor_max_angle = deg_to_rad(42.0)
	safe_margin = 0.02
	add_to_group("car")
	_make_smoke()
	rebuild()


## читать центры колёс (система модели) и пересчитать в систему машины
func _wheels_from_json(p: String) -> void:
	var at: Array = []
	var r := 0.42
	if FileAccess.file_exists(p):
		var j = JSON.parse_string(FileAccess.get_file_as_string(p))
		if j is Dictionary:
			var xf := global_transform.affine_inverse() * model.global_transform
			for w in j.get("wheels", []):
				at.append(xf * Vector3(float(w.x), float(w.y), float(w.z)))
				r = float(w.r) * model.scale.x
	if at.size() != 4:
		at = [Vector3(0.72, r, 1.3), Vector3(-0.72, r, 1.3), Vector3(0.72, r, -1.08), Vector3(-0.72, r, -1.08)]
	_wheel_base_r = r
	_wheels.clear()
	var zf := -99.0
	var zr := 99.0
	var xl := 0.0
	for q in at:
		zf = maxf(zf, (q as Vector3).z)
		zr = minf(zr, (q as Vector3).z)
		xl = maxf(xl, absf((q as Vector3).x))
	_wb = maxf(zf - zr, 1.5)
	_track = maxf(xl * 2.0, 1.0)
	for q in at:
		var qq: Vector3 = q
		_wheels.append({"at": Vector3(qq.x, r, qq.z), "front": qq.z > (zf + zr) * 0.5, "r": r, "dy": 0.0, "steer": null, "spin": null})


## пересобрать навесное по уровням деталей: колёса, бампер, листы кузова, грузовые модули, турель
func rebuild() -> void:
	if parts_n != null:
		parts_n.free()
	parts_n = Node3D.new()
	parts_n.name = "Parts"
	body.add_child(parts_n)
	if _mat_metal == null:
		_mat_metal = StandardMaterial3D.new()
		_mat_metal.albedo_color = Color(0.12, 0.13, 0.12)
		_mat_metal.metallic = 0.4
		_mat_metal.roughness = 0.55
		_mat_plate = StandardMaterial3D.new()
		_mat_plate.albedo_color = Color(0.2, 0.22, 0.17)
		_mat_plate.roughness = 0.8
	_build_wheels()
	_build_bumper(lvl("bumper"))
	_build_body_kit(lvl("body"))
	_build_trunk(lvl("trunk"))
	_build_turret()
	_smoke_update()


func lvl(cat: String) -> int:
	return int((data.parts as Dictionary).get(cat, {}).get("lvl", 0))


func part(cat: String) -> Dictionary:
	return (data.parts as Dictionary).get(cat, {})


## состояние детали 0…1 (у багажника прочности нет — 1)
func cond(cat: String) -> float:
	var p := part(cat)
	if not p.has("hp"):
		return 1.0
	return clampf(float(p.hp) / maxf(float(lvl_cfg(cat, int(p.lvl)).get("hp", 1.0)), 1.0), 0.0, 1.0)


## колёса: модель по уровню (крупнее — кузов выше); прежние узлы колёс — прочь
func _build_wheels() -> void:
	for w in _wheels:
		if w.steer != null and is_instance_valid(w.steer):
			(w.steer as Node3D).free()
	var lc := lvl_cfg("wheels", lvl("wheels"))
	var mpath := "res://assets/world/%s.glb" % String(lc.get("model", "wh_stock"))
	if not ResourceLoader.exists(mpath):
		mpath = "res://assets/world/car_wheel.glb"
	var rad: float = _wheel_base_r * float([1.0, 1.04, 1.08, 1.13][clampi(lvl("wheels"), 0, 3)])
	for w in _wheels:
		var sn := Node3D.new()
		add_child(sn)                                     # колёса — на машине, не на кузове: кузов качается над ними
		var spin := Node3D.new()
		sn.add_child(spin)
		var m: Node3D = (load(mpath) as PackedScene).instantiate()
		spin.add_child(m)
		_matte(m, Color(0.55, 0.55, 0.55))
		var side := 1.0 if (w.at as Vector3).x > 0.0 else -1.0
		m.rotation.y = PI * 0.5 * side                     # ось колеса у модели — Z: поперёк машины, диск наружу
		var b := _box_in(m, spin)
		m.scale = Vector3.ONE * (rad * 2.0 / maxf(b.size.y, 0.01))
		b = _box_in(m, spin)
		m.position = -b.get_center()
		w.steer = sn
		w.spin = spin
		w.r = rad
		sn.position = Vector3((w.at as Vector3).x, rad, (w.at as Vector3).z)
	body.position.y = rad - _wheel_base_r                 # большие колёса — кузов выше


func _build_bumper(n: int) -> void:
	if n <= 0:
		return
	var lc := lvl_cfg("bumper", n)
	var zf := size.z * 0.5 + 0.05
	var mpath := "res://assets/world/%s.glb" % String(lc.get("model", ""))
	if lc.has("model") and ResourceLoader.exists(mpath):
		_prop(mpath, size.x * 0.98, Vector3(0, 0.32, zf), 0.0, true)
		return
	# запасной вид (пока нет модели): брус, на втором — дуга, на третьем — дуга с крыльями и лебёдка
	_plate(Vector3(0, 0.52, zf), Vector3(size.x * 0.95, 0.2, 0.18), _mat_metal)
	if n >= 2:
		for xx in [-0.5, 0.5]:
			_tube(Vector3(xx, 0.6, zf), Vector3(xx, 1.12, zf - 0.08), 0.04)
		_tube(Vector3(-0.62, 1.12, zf - 0.08), Vector3(0.62, 1.12, zf - 0.08), 0.035)
	if n >= 3:
		for sx in [-1.0, 1.0]:
			_tube(Vector3(sx * 0.93, 0.5, zf), Vector3(sx * 0.98, 0.95, zf - 0.3), 0.035)
		_plate(Vector3(0, 0.5, zf + 0.08), Vector3(0.5, 0.22, 0.22), _mat_plate)


func _build_body_kit(n: int) -> void:
	if n <= 0:
		return
	var xs := size.x * 0.5 + 0.02
	# 1: листы на нижней части дверей и на капоте
	for sx in [-1.0, 1.0]:
		_plate(Vector3(sx * xs, 0.72, 0.2), Vector3(0.03, 0.32, 0.72), _mat_plate)
	_plate(Vector3(0, size.y * 0.6, size.z * 0.36), Vector3(1.2, 0.03, 0.6), _mat_plate)
	if n >= 2:
		for sx in [-1.0, 1.0]:
			_plate(Vector3(sx * xs, 1.02, 0.2), Vector3(0.03, 0.62, 0.72), _mat_plate)      # передние двери целиком
			_plate(Vector3(sx * xs, 0.8, -1.05), Vector3(0.03, 0.5, 1.4), _mat_plate)       # борта под тентом
		_plate(Vector3(0, 0.9, -size.z * 0.5 - 0.02), Vector3(1.5, 0.5, 0.03), _mat_plate)
	if n >= 3:
		for sx in [-1.0, 1.0]:
			for zz in [-0.08, 0.06, 0.2, 0.34, 0.48]:
				_tube(Vector3(sx * (xs + 0.02), 1.45, zz), Vector3(sx * (xs + 0.02), 1.95, zz), 0.012)
		for xx in [-0.65, -0.45, -0.25, -0.05, 0.15, 0.35, 0.55]:
			_tube(Vector3(xx, 1.42, 0.72), Vector3(xx, 1.96, 0.6), 0.012)
		_tube(Vector3(-0.72, 1.7, 0.66), Vector3(0.72, 1.7, 0.66), 0.012)


func _build_trunk(n: int) -> void:
	if n <= 0:
		return
	var top := size.y + 0.04
	# 1: ящик на площадке у задней двери
	_plate(Vector3(0.55, 0.42, -size.z * 0.5 - 0.3), Vector3(0.75, 0.04, 0.5), _mat_metal)
	_prop("res://assets/world/ul_army_crate.glb", 0.7, Vector3(0.55, 0.44, -size.z * 0.5 - 0.3), 0.0)
	if n >= 2:
		# 2: решётка на крыше (задняя часть — перёд крыши оставлен под турель) с ящиком и мешками
		var x0 := -0.78
		var x1 := 0.78
		var z0 := -1.8
		var z1 := -0.25
		var y := top + 0.08
		for xx in [x0, x1]:
			_tube(Vector3(xx, y, z0), Vector3(xx, y, z1), 0.022)
		for zz in [z0, (z0 + z1) * 0.5, z1]:
			_tube(Vector3(x0, y, zz), Vector3(x1, y, zz), 0.02)
		for xx in [x0, x1]:
			for zz in [z0, z1]:
				_tube(Vector3(xx, top - 0.04, zz), Vector3(xx, y, zz), 0.018)
		_prop("res://assets/world/ul_army_crate.glb", 0.9, Vector3(0.36, y, -0.75), PI * 0.5)
		_prop("res://assets/world/kh_sacks.glb", 0.7, Vector3(-0.38, y, -1.3))
	if n >= 3:
		var y2 := top + 0.08
		_prop("res://assets/world/ul_army_crate.glb", 0.9, Vector3(-0.36, y2, -0.7), PI * 0.5)
		_prop("res://assets/world/kh_sacks.glb", 0.65, Vector3(0.38, y2, -1.45), 0.6)
		_prop("res://assets/world/cv_jerrycans.glb", 0.5, Vector3(-0.7, 0.62, -size.z * 0.5 - 0.14), PI * 0.5)


## турель на крыше: кольцо, поворотная часть с моделью, точка выстрела
func _build_turret() -> void:
	turret_root = null
	turret_yaw = null
	turret_muzzle = null
	var t := turret_type()
	if t == "":
		return
	var tc := turret_cfg(t)
	turret_root = Node3D.new()
	turret_root.name = "Turret"
	parts_n.add_child(turret_root)
	turret_root.position = Vector3(0, size.y + 0.02, 0.05)
	var ring := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.36
	cm.bottom_radius = 0.4
	cm.height = 0.1
	ring.mesh = cm
	ring.material_override = _mat_metal
	ring.position.y = 0.05
	turret_root.add_child(ring)
	turret_yaw = Node3D.new()
	turret_yaw.position.y = 0.1
	turret_root.add_child(turret_yaw)
	var mpath := "res://assets/world/%s.glb" % String(tc.get("model", ""))
	var length := float(tc.get("len", 1.3))
	if ResourceLoader.exists(mpath):
		_prop(mpath, length, Vector3.ZERO, float(tc.get("model_yaw", 0.0)), false, turret_yaw)
	else:
		# запасной вид (пока нет модели): короб и ствол (у ракетной — пакет направляющих)
		var bx := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.45, 0.32, 0.55)
		bx.mesh = bm
		bx.material_override = _mat_plate
		bx.position = Vector3(0, 0.18, 0)
		turret_yaw.add_child(bx)
		var br := MeshInstance3D.new()
		var cy := CylinderMesh.new()
		cy.top_radius = 0.035 if t != "rocket" else 0.18
		cy.bottom_radius = cy.top_radius
		cy.height = 0.9 if t != "rocket" else 0.55
		br.mesh = cy
		br.material_override = _mat_metal
		br.rotation.x = PI * 0.5
		br.position = Vector3(0, 0.22, 0.6)
		turret_yaw.add_child(br)
	turret_muzzle = Node3D.new()
	turret_muzzle.position = Vector3(0, 0.25, length * 0.55)
	turret_yaw.add_child(turret_muzzle)
	turret_yaw.rotation.y = turret_aim


# ---------------- управление и движение ----------------

func fwd() -> Vector3:
	return Vector3(sin(rotation.y), 0, cos(rotation.y))


func seat_pos() -> Vector3:
	return global_transform * Vector3(size.x * 0.22, 0.75, size.z * 0.05)


func door_pos() -> Vector3:
	return global_transform * Vector3(size.x * 0.5 + 0.6, 0.0, size.z * 0.05)


func trunk_pos() -> Vector3:
	return global_transform * Vector3(0.0, 0.0, -size.z * 0.5 - 0.6)


func hood_pos() -> Vector3:
	return global_transform * Vector3(0.0, 0.0, size.z * 0.5 + 0.7)


func hp() -> float:
	return float(part("body").get("hp", 0.0))


func hp_max() -> float:
	return float(lvl_cfg("body", lvl("body")).get("hp", 1000.0))


func broken() -> bool:
	return hp() <= 0.0


func fuel() -> float:
	return float(data.get("fuel", 0.0))


func tank() -> float:
	return c("fuel_tank", 60.0)


func no_fuel() -> bool:
	return fuel() <= 0.0


func can_drive() -> bool:
	return not broken() and not no_fuel() and float(part("engine").get("hp", 0.0)) > 0.0


func trunk_cells() -> int:
	return int(lvl_cfg("trunk", lvl("trunk")).get("cells", 30))


## наибольшая скорость, м/с: двигатель по уровню и состоянию, масса кузова, разрушенные колёса
func vmax() -> float:
	var v := float(lvl_cfg("engine", lvl("engine")).get("kmh", 65.0)) / 3.6 * (0.55 + 0.45 * cond("engine"))
	v *= 1.0 - float(lvl_cfg("body", lvl("body")).get("mass", 0.0)) * 0.5
	if float(part("wheels").get("hp", 1.0)) <= 0.0:
		v *= 0.35
	return v


func accel() -> float:
	return float(lvl_cfg("engine", lvl("engine")).get("accel", 4.2)) * (0.5 + 0.5 * cond("engine")) * (1.0 - float(lvl_cfg("body", lvl("body")).get("mass", 0.0)))


func grip() -> float:
	return float(lvl_cfg("wheels", lvl("wheels")).get("grip", 1.0)) * (0.65 + 0.35 * cond("wheels"))


## кадр движения: управление (throttle, steer_in, brake) → скорость, руль, путь; удары, бензин, износ, подвеска
func step(delta: float) -> float:
	_crash_cd = maxf(0.0, _crash_cd - delta)
	_fire_cd = maxf(0.0, _fire_cd - delta)
	var thr := throttle if can_drive() else 0.0
	var vm := vmax()
	var acc := accel()
	if brake:
		speed = move_toward(speed, 0.0, 9.0 * delta)
	elif thr > 0.05:
		if speed < -0.3:
			speed = move_toward(speed, 0.0, 9.0 * delta)            # ехал назад — сначала тормоз
		elif speed < vm * thr:
			speed = move_toward(speed, vm * thr, acc * delta)
		else:
			speed = move_toward(speed, vm * thr, 2.0 * delta)
	elif thr < -0.05:
		if speed > 0.3:
			speed = move_toward(speed, 0.0, 9.0 * delta)            # ехал вперёд — сначала тормоз
		else:
			speed = move_toward(speed, -vm * 0.35 * -thr, acc * 0.6 * delta)
	else:
		speed = move_toward(speed, 0.0, (1.3 + 0.01 * speed * speed) * delta)
	# руль: на скорости предельный угол меньше; колёса поворачиваются не мгновенно
	var tk := float(lvl_cfg("wheels", lvl("wheels")).get("turn", 1.0)) * (0.7 + 0.3 * cond("wheels"))
	var smax := deg_to_rad(c("steer_max_deg", 34.0)) * tk * (1.0 - 0.5 * clampf(absf(speed) / 18.0, 0.0, 1.0))
	steer = move_toward(steer, clampf(steer_in, -1.0, 1.0) * smax, c("steer_speed", 2.6) * delta)
	# поворот по колёсной базе: угловая скорость = v / база · tg(угла колёс); задом — в другую сторону
	yaw_rate = speed / _wb * tan(steer) * minf(grip(), 1.0)
	rotation.y += yaw_rate * delta
	var f := fwd()
	var p0 := global_position
	velocity = Vector3(f.x * speed, velocity.y - 9.8 * delta, f.z * speed)
	var before := absf(speed)
	move_and_slide()
	if is_on_floor():
		velocity.y = 0.0
	var real := Vector3(velocity.x, 0.0, velocity.z).length()
	if before - real > c("crash_speed", 5.0) and _crash_cd <= 0.0:
		var lost := before - real
		var nrm := Vector3.ZERO
		for i in get_slide_collision_count():
			nrm += get_slide_collision(i).get_normal()
		front_hit = speed > 0.0 and nrm.length() > 0.01 and f.dot(-nrm.normalized()) > 0.5
		crash((lost - 4.0) * c("crash_dmg", 9.0), front_hit)
		crashed = lost
		_crash_cd = 0.6
	if absf(speed) > real + 0.3:
		speed = signf(speed) * (real + 0.3)
	var dist := Vector2(global_position.x - p0.x, global_position.z - p0.z).length()
	dist_total += dist
	# бензин (под газом — больше) и износ колёс и двигателя
	var km := dist / 1000.0
	data["fuel"] = maxf(0.0, fuel() - km * c("fuel_per_km", 2.5) * (0.6 + 0.4 * absf(thr)))
	var wr: Dictionary = cfg().get("wear", {})
	_wear("wheels", km * float(wr.get("wheels_per_km", 0.6)))
	_wear("engine", km * float(wr.get("engine_per_km", 0.35)) * (0.5 + absf(thr)))
	_suspension(delta, dist * signf(speed))
	_prev_speed = speed
	_turret_tick(delta)
	return dist


## стоящая (без водителя) машина: только подвеска и турель — колёса по земле, кузов успокаивается
func idle(delta: float) -> void:
	_suspension(delta, 0.0)
	_turret_tick(delta)


func _wear(cat: String, d: float) -> void:
	var p := part(cat)
	if p.has("hp") and d > 0.0:
		p["hp"] = maxf(0.0, float(p.hp) - d)


## удар о препятствие: спереди — сначала бампер (по его уровню и состоянию), остальное — кузову; колёсам — немного
func crash(dmg: float, front: bool) -> void:
	if dmg <= 0.0:
		return
	var wr: Dictionary = cfg().get("wear", {})
	if front and float(part("bumper").get("hp", 0.0)) > 0.0:
		var fk := float(lvl_cfg("bumper", lvl("bumper")).get("front", 0.0)) * cond("bumper")
		_wear("bumper", dmg * float(wr.get("crash_to_bumper", 0.6)))
		dmg *= 1.0 - fk
	_wear("wheels", dmg * float(wr.get("crash_to_wheels", 0.15)))
	hit(dmg)


## урон кузову (удары врагов, взрывы, столкновения): броня кузова по уровню и состоянию гасит часть
func hit(dmg: float) -> void:
	if dmg <= 0.0:
		return
	var arm := float(lvl_cfg("body", lvl("body")).get("armor", 0.0)) * (0.4 + 0.6 * cond("body"))
	var p := part("body")
	p["hp"] = maxf(0.0, float(p.get("hp", 0.0)) - dmg * (1.0 - arm))
	_smoke_update()


## сбитый враг спереди: бампер берёт часть удара на себя
func ram(dmg: float) -> void:
	crash(dmg, true)


# ---------------- подвеска ----------------

## колёса — по земле под ними (луч вниз), кузов — на пружинах: средняя высота, клевок и крен по неровностям,
## торможению и повороту
func _suspension(delta: float, moved: float) -> void:
	if not is_inside_tree():
		return
	var space := get_world_3d().direct_space_state
	var travel := 0.12
	var fr := 0.0
	var rr := 0.0
	var lf := 0.0
	var rt := 0.0
	for w in _wheels:
		var at: Vector3 = w.at
		var top := global_transform * Vector3(at.x, at.y + 0.6, at.z)
		var q := PhysicsRayQueryParameters3D.create(top, top + Vector3.DOWN * 1.6)
		q.exclude = [get_rid()]
		q.collision_mask = 1
		var h := space.intersect_ray(q)
		var want := 0.0
		if not h.is_empty():
			want = clampf((h.position as Vector3).y - global_position.y, -travel, travel)
		w.dy = lerpf(float(w.dy), want, 1.0 - exp(-delta * 18.0))
		var sn := w.steer as Node3D
		if sn != null:
			sn.position.y = float(w.r) + float(w.dy)
			if w.front:
				sn.rotation.y = steer
			(w.spin as Node3D).rotate_object_local(Vector3.RIGHT, moved / maxf(float(w.r), 0.05))
		if w.front:
			fr += float(w.dy) * 0.5
		else:
			rr += float(w.dy) * 0.5
		if at.x > 0.0:
			lf += float(w.dy) * 0.5
		else:
			rt += float(w.dy) * 0.5
	var acc_l := (speed - _prev_speed) / maxf(delta, 0.001)
	# цели: наклон по земле + динамика (торможение — нос вниз, разгон — вверх; поворот — крен наружу)
	var pitch_t := -atan2(fr - rr, _wb) + clampf(-acc_l, -10.0, 10.0) * 0.0045
	var roll_t := atan2(lf - rt, _track) + clampf(speed * yaw_rate, -12.0, 12.0) * 0.0055
	var heave_t := (fr + rr) * 0.5
	var k := 90.0
	var cd := 13.0
	var dt := minf(delta, 0.05)
	_pv += (k * (pitch_t - _pitch) - cd * _pv) * dt
	_pitch += _pv * dt
	_rv += (k * (roll_t - _roll) - cd * _rv) * dt
	_roll += _rv * dt
	_hv += (k * (heave_t - _heave) - cd * _hv) * dt
	_heave += _hv * dt
	body.rotation = Vector3(clampf(_pitch, -0.12, 0.12), 0.0, clampf(_roll, -0.1, 0.1))
	var lift := (float(_wheels[0].r) - _wheel_base_r) if not _wheels.is_empty() else 0.0
	body.position.y = lift + _heave


## наклон кузова сейчас (для проверок): клевок и крен, рад
func body_tilt() -> Vector2:
	return Vector2(_pitch, _roll)


# ---------------- турель ----------------

func turret_type() -> String:
	return String(data.get("turret", ""))


## навести турель на точку мира (в пределах сектора от курса)
func aim_at(world_p: Vector3) -> void:
	if turret_root == null:
		return
	var lp := global_transform.affine_inverse() * world_p
	var arc := deg_to_rad(c("turret_arc_deg", 150.0))
	turret_want = clampf(atan2(lp.x, lp.z), -arc, arc)


func _turret_tick(delta: float) -> void:
	if turret_yaw == null:
		return
	turret_aim = move_toward(turret_aim, turret_want, 2.6 * delta)
	turret_yaw.rotation.y = turret_aim


## выстрел турели, если готова: тратит боезапас; {from, dir, cfg, type}, {"empty": true} — нечем, {} — не готова
func turret_fire() -> Dictionary:
	var t := turret_type()
	if t == "" or turret_muzzle == null or _fire_cd > 0.0:
		return {}
	var st: Dictionary = (data.turrets as Dictionary).get(t, {})
	if int(st.get("ammo", 0)) <= 0:
		return {"empty": true}
	if float(st.get("hp", 1.0)) <= 0.0:
		return {"broken": true}
	var tc := turret_cfg(t)
	st["ammo"] = int(st.ammo) - 1
	_fire_cd = 1.0 / maxf(float(tc.get("rate", 4.0)), 0.1)
	var d := turret_muzzle.global_transform.basis.z
	d = Vector3(d.x, 0.0, d.z).normalized()
	return {"from": turret_muzzle.global_position, "dir": d, "cfg": tc, "type": t}


# ---------------- вид ----------------

func _make_smoke() -> void:
	smoke = CPUParticles3D.new()
	smoke.amount = 18
	smoke.lifetime = 1.8
	smoke.emitting = false
	smoke.local_coords = false
	smoke.direction = Vector3.UP
	smoke.spread = 25.0
	smoke.initial_velocity_min = 0.6
	smoke.initial_velocity_max = 1.2
	smoke.gravity = Vector3(0, 0.4, 0)
	smoke.scale_amount_min = 0.6
	smoke.scale_amount_max = 1.4
	var sm := QuadMesh.new()
	sm.size = Vector2(0.7, 0.7)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	mat.albedo_color = Color(0.32, 0.31, 0.3, 0.45)
	sm.material = mat
	smoke.mesh = sm
	smoke.position = Vector3(0, size.y * 0.55, size.z * 0.36)
	body.add_child(smoke)


func _smoke_update() -> void:
	if smoke:
		smoke.emitting = hp() < hp_max() * c("smoke_below", 0.3) or float(part("engine").get("hp", 1.0)) <= 0.0
		smoke.amount = 30 if broken() else 18


## материалы моделей Tripo: подтон темнее и матово (сверху солнце бьёт отвесно — блик выбеливал брезент и резину)
func _matte(root: Node, tint: Color) -> void:
	for mi in root.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var mat := m.get_active_material(si)
			if mat is BaseMaterial3D:
				var mm := (mat as BaseMaterial3D).duplicate() as BaseMaterial3D
				mm.albedo_color = mm.albedo_color * tint
				mm.metallic = 0.0
				mm.metallic_specular = c("specular", 0.25)
				mm.roughness = 1.0
				m.set_surface_override_material(si, mm)


## рамка узла n в системе узла rel
func _box_in(n: Node3D, rel: Node3D) -> AABB:
	var out := AABB()
	var first := true
	var inv := rel.global_transform.affine_inverse()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var bb := (inv * m.global_transform) * m.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


func _tube(a: Vector3, b: Vector3, r: float) -> void:
	var mi := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = a.distance_to(b)
	cm.radial_segments = 8
	cm.rings = 1
	mi.mesh = cm
	mi.material_override = _mat_metal
	parts_n.add_child(mi)
	var d := (b - a).normalized()
	var axis := Vector3.UP.cross(d)
	var basis := Basis.IDENTITY if axis.length() < 0.0001 else Basis(axis.normalized(), Vector3.UP.angle_to(d))
	mi.transform = Transform3D(basis, (a + b) * 0.5)


func _plate(at: Vector3, sz: Vector3, mat: Material) -> void:
	var mi := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = sz
	mi.mesh = bm
	mi.material_override = mat
	mi.position = at
	parts_n.add_child(mi)


## деталь-модель: ширина по X (by_width) или длиннейшая сторона = n_size, низ — в точке at (в системе родителя)
func _prop(path: String, n_size: float, at: Vector3, yaw := 0.0, by_width := false, parent: Node3D = null) -> Node3D:
	var host := parent if parent != null else parts_n
	var n: Node3D = (load(path) as PackedScene).instantiate()
	host.add_child(n)
	_matte(n, Color(0.72, 0.72, 0.7))
	n.rotation.y = yaw
	var b := _box_in(n, host)
	var ref := b.size.x if by_width else maxf(maxf(b.size.x, b.size.y), b.size.z)
	n.scale = Vector3.ONE * (n_size / maxf(ref, 0.01))
	b = _box_in(n, host)
	n.position += at - Vector3(b.get_center().x, b.position.y, b.get_center().z)
	return n
