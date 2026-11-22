class_name ULCar
extends CharacterBody3D
## УАЗ героя (docs/PLANS.md, п. 5, этап 1): стоит у точки входа на временной локации, в натуральную величину
## (длина 4 м). Подошёл к водительской двери — «Сесть»; за рулём джойстик ведёт машину: куда наклонён — туда
## она поворачивает и едет (сильнее — быстрее), назад — тормоз, потом задний ход. Езда «аркадная»: машина
## держится земли (тело с коробкой столкновений), поворачивает только на ходу, по радиусу. Прочность большая;
## удары врагов по машине и столкновения на скорости её тратят; при нуле машина не едет (из-под капота дым).
## Багажник — хранилище на 30 ячеек (окно инвентаря), с собой из посещения в посещение. Ремонт в гараже базы и
## улучшения — следующим этапом, когда появится гараж. Числа — data/car.json.

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
	var tint := Color(float(tn[0]), float(tn[1]), float(tn[2]))
	for mi in model.find_children("*", "MeshInstance3D", true, false):
		var m := mi as MeshInstance3D
		for si in m.mesh.get_surface_count():
			var mat := m.get_active_material(si)
			if mat is BaseMaterial3D:
				var mm := (mat as BaseMaterial3D).duplicate() as BaseMaterial3D
				mm.albedo_color = mm.albedo_color * tint
				# сверху солнце бьёт почти отвесно: блик на брезенте и крыше (глянец из карты шероховатости)
				# выбеливал машину — кузов матовый, не металл
				mm.metallic = 0.0
				mm.metallic_specular = c("specular", 0.25)
				mm.roughness = 1.0
				m.set_surface_override_material(si, mm)
	var box := _model_box()
	var k := c("length", 4.0) / maxf(box.size.z, 0.01)
	model.scale = Vector3.ONE * k
	box = _model_box()
	model.position = Vector3(-box.get_center().x, -box.position.y, -box.get_center().z)
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
	if broken():
		mag = 0.0
	if mag > 0.15 and dir.length() > 0.01:
		var d := dir.normalized()
		var ang := f.signed_angle_to(d, Vector3.UP)           # + — влево
		var go_fwd := absf(ang) < deg_to_rad(115.0) or (speed > 1.5 and absf(ang) < deg_to_rad(160.0))
		var k := clampf((mag - 0.15) / 0.6, 0.25, 1.0)
		if go_fwd:
			target = c("max_speed", 15.0) * k
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
	var turn := steer * c("turn_rate", 1.6) * clampf(absf(speed) / 4.0, 0.0, 1.0) * signf(speed)
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
	return Vector3(global_position - p0).length()


func save_data() -> Dictionary:
	return {"hp": hp}
