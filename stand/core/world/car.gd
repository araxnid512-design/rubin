class_name ULCar
extends CharacterBody3D
## УАЗ героя (docs/PLANS.md, п. 5): стоит на базе и у точки входа на временной локации, в натуральную величину
## (длина 4 м). Подошёл к водительской двери — «Сесть»; за рулём джойстик ведёт машину: куда наклонён — туда
## она поворачивает и едет (сильнее — быстрее), назад — тормоз, потом задний ход. Езда «аркадная»: машина
## держится земли (тело с коробкой столкновений), поворачивает только на ходу, по радиусу. Прочность большая;
## удары врагов по машине и столкновения на скорости её тратят; при нуле машина не едет (из-под капота дым).
## Бензин тратится на ходу (покупается на базе), без него мотор не тянет. Багажник — хранилище (окно инвентаря),
## с собой из посещения в посещение. Улучшения (колёса, багажник, броня, бак) меняют и цифры, и вид: колёса
## крупнее, кузов выше, решётка с грузом на крыше, кенгурятник, бронелисты и решётки на окнах, канистры.
## Числа и цены — data/car.json.

const CFG := "res://data/car.json"
static var _cfg := {}

var speed := 0.0                    ## м/с вдоль курса: + вперёд, − назад
var hp := 600.0
var hp_max := 600.0
var size := Vector3(2.06, 2.16, 4.0)  ## ширина, высота, длина (м)
var model: Node3D
var smoke: CPUParticles3D
var crashed := 0.0                  ## сила последнего удара о препятствие (для звука), сбрасывает мир
var _crash_cd := 0.0
var up := {"wheels": 0, "trunk": 0, "armor": 0, "tank": 0}    ## уровни улучшений
var fuel := 15.0                    ## бензин, л
var tank := 30.0                    ## бак, л
var spd_k := 1.0                    ## колёса: скорость и поворот
var turn_k := 1.0
var ram_k := 1.0                    ## броня: насколько сбитые мнут машину
var wheel_k := 1.0                  ## размер колёс относительно заводских
var parts: Node3D                   ## навесное (решётка, груз, кенгурятник, листы, канистры, колёса)
var _wheels: Array = []             ## [поворотный узел, вращающийся узел, передний?]
var _lift := 0.0                    ## насколько большие колёса подняли кузов
var _mat_metal: StandardMaterial3D
var _mat_plate: StandardMaterial3D


static func cfg() -> Dictionary:
	if _cfg.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_cfg = d if d is Dictionary else {}
	return _cfg


static func c(key: String, def: float) -> float:
	return float(cfg().get(key, def))


## собрать машину (узел уже в дереве): модель по длине, коробка столкновений, дым
func setup() -> void:
	hp_max = c("hp", 600.0)
	hp = clampf(hp, 0.0, hp_max)
	var path := String(cfg().get("model", "res://assets/world/car_uaz.glb"))
	model = (load(path) as PackedScene).instantiate()
	add_child(model)
	# модели Tripo смотрят передом вдоль +X; у машины перёд — +Z (как у героя: курс = atan2(x, z))
	if String(cfg().get("model_front", "x")) == "x":
		model.rotation.y = -PI * 0.5
	# подтон как у техники на локациях: светлый тент сверху под солнцем иначе выглядит белым
	var tn: Array = cfg().get("tint", [1.0, 1.0, 1.0])
	_matte(model, Color(float(tn[0]), float(tn[1]), float(tn[2])))
	var box := _model_box()
	var k := c("length", 4.0) / maxf(box.size.z, 0.01)
	model.scale = Vector3.ONE * k
	box = _model_box()
	model.position = Vector3(-box.get_center().x, -box.position.y, -box.get_center().z)
	_model_y0 = model.position.y
	size = box.size
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	# коробка чуть уже кузова, от низа колёс до крыши без тента: колёса стоят на земле, кузов упирается в стены
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
	smoke.position = Vector3(0, size.y * 0.55, size.z * 0.36)       # из-под капота
	add_child(smoke)
	_smoke_update()


## Материалы моделей Tripo для машины: подтон темнее и матово. Сверху солнце бьёт почти отвесно, и блик на
## брезенте, ящиках и резине (глянец из карты шероховатости) выбеливал их.
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


## рамка модели в системе машины (узел уже в дереве)
func _model_box() -> AABB:
	var out := AABB()
	var first := true
	var inv := global_transform.affine_inverse()
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var b := (inv * m.global_transform) * m.get_aabb()
		out = b if first else out.merge(b)
		first = false
	return out


func fwd() -> Vector3:
	return Vector3(sin(rotation.y), 0, cos(rotation.y))


## место водителя (слева впереди — руль слева); туда ставится герой, пока он в машине
func seat_pos() -> Vector3:
	return global_transform * Vector3(size.x * 0.22, 0.75, size.z * 0.05)


## у водительской двери снаружи — где «Сесть» и куда герой выходит
func door_pos() -> Vector3:
	return global_transform * Vector3(size.x * 0.5 + 0.6, 0.0, size.z * 0.05)


## у капота спереди (на базе — окно улучшений)
func hood_pos() -> Vector3:
	return global_transform * Vector3(0.0, 0.0, size.z * 0.5 + 0.7)


## у задней двери (багажник, запасное колесо)
func trunk_pos() -> Vector3:
	return global_transform * Vector3(0.0, 0.0, -size.z * 0.5 - 0.6)


func broken() -> bool:
	return hp <= 0.0


func damage(d: float) -> void:
	if d <= 0.0:
		return
	hp = maxf(0.0, hp - d)
	_smoke_update()


func _smoke_update() -> void:
	if smoke:
		smoke.emitting = hp < hp_max * c("smoke_below", 0.3)
		smoke.amount = 30 if hp <= 0.0 else 18


## Вести машину: dir — куда наклонён джойстик (в мире, по земле), mag — насколько (0…1). Пустой — катится и
## тормозит сама. Возвращает пройденный путь за кадр (м).
func drive(dir: Vector3, mag: float, delta: float) -> float:
	_crash_cd = maxf(0.0, _crash_cd - delta)
	var f := fwd()
	var target := 0.0
	var steer := 0.0
	if broken() or fuel <= 0.0:
		mag = 0.0                                          # сломана или нет бензина — мотор не тянет
	if mag > 0.15 and dir.length() > 0.01:
		var d := dir.normalized()
		var ang := f.signed_angle_to(d, Vector3.UP)           # + — влево
		var go_fwd := absf(ang) < deg_to_rad(115.0) or (speed > 1.5 and absf(ang) < deg_to_rad(160.0))
		var k := clampf((mag - 0.15) / 0.6, 0.25, 1.0)
		if go_fwd:
			target = c("max_speed", 15.0) * spd_k * k
			steer = clampf(ang / 0.7, -1.0, 1.0)
		else:
			# джойстик назад: сначала тормоз, потом задний ход; поворачивает так, чтобы зад шёл туда
			target = -c("reverse_speed", 5.0) * k
			steer = -clampf((-f).signed_angle_to(d, Vector3.UP) / 0.7, -1.0, 1.0)
	if mag <= 0.15:
		speed = move_toward(speed, 0.0, c("drag", 3.0) * delta)
	elif signf(target) != signf(speed) and absf(speed) > 0.2:
		speed = move_toward(speed, 0.0, c("brake", 14.0) * delta)
	elif absf(target) > absf(speed):
		speed = move_toward(speed, target, c("accel", 5.5) * delta)
	else:
		speed = move_toward(speed, target, c("drag", 3.0) * 2.0 * delta)
	# поворот — только на ходу: радиус как у машины, на месте не крутится
	var turn := steer * c("turn_rate", 1.6) * turn_k * clampf(absf(speed) / 4.0, 0.0, 1.0) * signf(speed)
	rotation.y += turn * delta
	f = fwd()
	var p0 := global_position
	velocity = Vector3(f.x * speed, velocity.y - 9.8 * delta, f.z * speed)
	var before := absf(speed)
	move_and_slide()
	if is_on_floor():
		velocity.y = 0.0
	var real := Vector3(velocity.x, 0.0, velocity.z).length()
	if before - real > c("crash_speed", 5.0) and _crash_cd <= 0.0:
		# врезался: прочность — по силе удара, скорость гаснет
		var lost := before - real
		damage((lost - 4.0) * c("crash_dmg", 9.0))
		crashed = lost
		_crash_cd = 0.6
	if absf(speed) > real + 0.3:
		speed = signf(speed) * (real + 0.3)
	var dist := Vector3(global_position - p0).length()
	fuel = maxf(0.0, fuel - dist / 1000.0 * float((cfg().get("fuel", {}) as Dictionary).get("per_km", 2.5)))
	_wheels_tick(dist * signf(speed), steer, delta)
	return dist


func no_fuel() -> bool:
	return fuel <= 0.0


# ---------------- улучшения ----------------

## уровень улучшения линии (wheels, trunk, armor, tank) из data/car.json
static func lvl(line: String, n: int) -> Dictionary:
	var ls: Array = (cfg().get("upgrades", {}) as Dictionary).get(line, {}).get("levels", [])
	return ls[clampi(n, 0, ls.size() - 1)] if not ls.is_empty() else {}


static func max_lvl(line: String) -> int:
	return ((cfg().get("upgrades", {}) as Dictionary).get(line, {}).get("levels", []) as Array).size() - 1


static func trunk_cells(n: int) -> int:
	return int(lvl("trunk", n).get("cells", c("trunk_cells", 30.0)))


## применить уровни улучшений: цифры и вид
func apply_up(u: Dictionary) -> void:
	for k in up:
		up[k] = clampi(int(u.get(k, 0)), 0, max_lvl(k))
	var w := lvl("wheels", up.wheels)
	spd_k = float(w.get("speed", 1.0))
	turn_k = float(w.get("turn", 1.0))
	wheel_k = float(w.get("scale", 1.0))
	var a := lvl("armor", up.armor)
	hp_max = float(a.get("hp", c("hp", 600.0)))
	ram_k = float(a.get("ram_k", 1.0))
	hp = minf(hp, hp_max)
	tank = float(lvl("tank", up.tank).get("tank", float((cfg().get("fuel", {}) as Dictionary).get("tank", 30))))
	fuel = clampf(fuel, 0.0, tank)
	_build_parts()
	_smoke_update()


func _build_parts() -> void:
	if parts != null:
		parts.free()
	_wheels.clear()
	parts = Node3D.new()
	add_child(parts)
	if _mat_metal == null:
		_mat_metal = StandardMaterial3D.new()
		_mat_metal.albedo_color = Color(0.13, 0.14, 0.13)
		_mat_metal.metallic = 0.4
		_mat_metal.roughness = 0.55
		_mat_plate = StandardMaterial3D.new()
		_mat_plate.albedo_color = Color(0.2, 0.22, 0.17)
		_mat_plate.roughness = 0.8
	# колёса: крупнее заводских — кузов выше на разницу радиусов
	var r := c("wheel_r", 0.42)
	_lift = r * (wheel_k - 1.0) if up.wheels > 0 else 0.0
	model.position.y = _model_y0 + _lift
	parts.position.y = _lift
	if up.wheels > 0:
		var xw: float = c("wheel_x", 0.86) + 0.05 * float(up.wheels)
		for zz in [c("wheel_front_z", 1.35), c("wheel_rear_z", -1.17)]:
			for sx in [1.0, -1.0]:
				_wheel(Vector3(sx * xw, r * wheel_k, zz), r * wheel_k, zz > 0.0, sx)
	var top := size.y + 0.04                                 # крыша (тент)
	# багажник: решётка на крыше с грузом
	if up.trunk >= 1:
		var x0 := -0.78
		var x1 := 0.78
		var z0 := -1.75
		var z1 := 0.25
		var y := top + 0.08
		for xx in [x0, x1]:
			_tube(Vector3(xx, y, z0), Vector3(xx, y, z1), 0.022)
		for zz in [z0, (z0 + z1) * 0.5, z1]:
			_tube(Vector3(x0, y, zz), Vector3(x1, y, zz), 0.02)
		for xx in [x0, x1]:
			for zz in [z0, z1]:
				_tube(Vector3(xx, top - 0.04, zz), Vector3(xx, y, zz), 0.018)
		_prop("res://assets/world/ul_army_crate.glb", 0.95, Vector3(0.36, y, -0.55), PI * 0.5)
		_prop("res://assets/world/kh_sacks.glb", 0.75, Vector3(-0.38, y, -1.2))
	if up.trunk >= 2:
		var y2 := top + 0.08
		_prop("res://assets/world/ul_army_crate.glb", 0.95, Vector3(-0.36, y2, -0.3), PI * 0.5)
		_prop("res://assets/world/kh_sacks.glb", 0.7, Vector3(0.38, y2, -1.35), 0.6)
		_prop("res://assets/world/ul_army_crate.glb", 0.6, Vector3(0.0, 0.42, -size.z * 0.5 - 0.28), 0.0)
		_plate(Vector3(0.0, 0.4, -size.z * 0.5 - 0.28), Vector3(1.2, 0.04, 0.45), _mat_metal)   # площадка на бампере
	# броня: кенгурятник, листы на дверях, решётки на окнах
	if up.armor >= 1:
		var zf := size.z * 0.5 + 0.1
		for xx in [-0.55, 0.55]:
			_tube(Vector3(xx, 0.35, zf), Vector3(xx, 1.15, zf - 0.04), 0.04)
		_tube(Vector3(-0.72, 1.15, zf - 0.04), Vector3(0.72, 1.15, zf - 0.04), 0.035)
		_tube(Vector3(-0.8, 0.78, zf), Vector3(0.8, 0.78, zf), 0.035)
		_tube(Vector3(-0.95, 0.42, zf), Vector3(0.95, 0.42, zf), 0.045)
		for sx in [-1.0, 1.0]:
			_tube(Vector3(sx * 0.95, 0.42, zf), Vector3(sx * 0.98, 0.85, zf - 0.25), 0.03)
	if up.armor >= 2:
		var xs := size.x * 0.5 + 0.02
		for sx in [-1.0, 1.0]:
			_plate(Vector3(sx * xs, 1.05, 0.2), Vector3(0.03, 0.62, 0.72), _mat_plate)          # передние двери
			_plate(Vector3(sx * xs, 0.82, -1.05), Vector3(0.03, 0.5, 1.45), _mat_plate)        # борт под тентом
			for zz in [-0.08, 0.06, 0.2, 0.34, 0.48]:
				_tube(Vector3(sx * (xs + 0.02), 1.45, zz), Vector3(sx * (xs + 0.02), 1.98, zz), 0.012)   # решётка окна
		for xx in [-0.65, -0.45, -0.25, -0.05, 0.15, 0.35, 0.55]:
			_tube(Vector3(xx, 1.42, 0.72), Vector3(xx, 1.98, 0.6), 0.012)                       # решётка лобового
		_tube(Vector3(-0.72, 1.7, 0.66), Vector3(0.72, 1.7, 0.66), 0.012)
	# бак: канистры на задней двери (по паре) — слева, потом и справа
	for i in up.tank:
		var sx := 1.0 if i == 0 else -1.0
		_prop("res://assets/world/cv_jerrycans.glb", 0.5, Vector3(sx * 0.72, 0.62, -size.z * 0.5 - 0.14), PI * 0.5)


var _model_y0 := 0.0


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
	parts.add_child(mi)
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
	parts.add_child(mi)


## модель-деталь: длиннейшая сторона = longest, низ — в точке at (в системе машины)
func _prop(path: String, longest: float, at: Vector3, yaw := 0.0) -> Node3D:
	var n: Node3D = (load(path) as PackedScene).instantiate()
	parts.add_child(n)
	_matte(n, Color(0.72, 0.72, 0.7))
	n.rotation.y = yaw
	var b := _box_in(n)
	n.scale = Vector3.ONE * (longest / maxf(maxf(b.size.x, b.size.y), maxf(b.size.z, 0.01)))
	b = _box_in(n)
	n.position += at - Vector3(b.get_center().x, b.position.y, b.get_center().z)
	return n


## рамка узла в системе навесного (parts)
func _box_in(n: Node3D) -> AABB:
	var out := AABB()
	var first := true
	var inv := parts.global_transform.affine_inverse()
	for mi in n.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		var bb := (inv * m.global_transform) * m.get_aabb()
		out = bb if first else out.merge(bb)
		first = false
	return out


## колесо: поворотный узел (передние поворачивают) → вращающийся → модель (ось — поперёк машины)
func _wheel(at: Vector3, rad: float, front: bool, side: float) -> void:
	var steer_n := Node3D.new()
	steer_n.position = at - Vector3(0, _lift, 0)            # parts уже поднят на _lift
	parts.add_child(steer_n)
	var spin := Node3D.new()
	steer_n.add_child(spin)
	var m: Node3D = (load("res://assets/world/car_wheel.glb") as PackedScene).instantiate()
	spin.add_child(m)
	_matte(m, Color(0.4, 0.4, 0.4))                       # резина — тёмная
	m.rotation.y = PI * 0.5 * side                           # ось колеса (у модели — Z) — поперёк машины
	var inv := spin.global_transform.affine_inverse()
	var b := AABB()
	var first := true
	for mi in m.find_children("*", "MeshInstance3D", true, false):
		var bb := (inv * (mi as MeshInstance3D).global_transform) * (mi as MeshInstance3D).get_aabb()
		b = bb if first else b.merge(bb)
		first = false
	var k := rad * 2.0 / maxf(b.size.y, 0.01)
	m.scale = Vector3.ONE * k
	m.position = -b.get_center() * k
	_wheels.append([steer_n, spin, front])


func _wheels_tick(moved: float, steer: float, delta: float) -> void:
	if _wheels.is_empty():
		return
	var rad := c("wheel_r", 0.42) * wheel_k
	for w in _wheels:
		(w[1] as Node3D).rotate_object_local(Vector3.RIGHT, moved / rad)
		if w[2]:
			var sn := w[0] as Node3D
			sn.rotation.y = lerpf(sn.rotation.y, steer * 0.45, 1.0 - exp(-delta * 10.0))


func save_data() -> Dictionary:
	return {"hp": hp, "fuel": fuel, "up": up.duplicate()}
