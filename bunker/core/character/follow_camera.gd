class_name BCCamera
extends Camera3D
## Камера BunkerCore: над героем под углом 50–60°, плавно следует, чуть забегает вперёд по ходу движения.
## Поворот по горизонтали — проведением пальца по свободной части экрана (или Q/E), приближение — щипком
## (или колесом мыши). В бункере и постройках — ближе и включён «вырез» стен вокруг героя.

@export var pitch_deg := 55.0
@export var dist_surface := 12.5
@export var dist_inside := 9.0
@export var follow := 7.0
@export var lookahead := 0.5

var yaw := 0.0
var zoom := 1.0
var _dist := 12.5
var _focus := Vector3.ZERO
var _target: Node3D
var _drag := {}         ## касания, которые крутят камеру


func _ready() -> void:
	fov = 42.0
	near = 0.2
	far = 400.0
	cull_mask = 0xFFFFF
	current = true


func set_target(t: Node3D) -> void:
	_target = t
	_focus = t.global_position
	_update(1.0)


func _process(delta: float) -> void:
	if _target == null:
		return
	if Input.is_key_pressed(KEY_Q):
		yaw += delta * 1.6
	if Input.is_key_pressed(KEY_E):
		yaw -= delta * 1.6
	_update(delta)


func _update(delta: float) -> void:
	var inside: bool = Core.world.underground or Core.world.current.get("kind", "") == "building"
	var want := (dist_inside if inside else dist_surface) * zoom
	_dist = lerpf(_dist, want, clampf(delta * 3.0, 0.0, 1.0))
	var v := Vector3.ZERO
	if _target is CharacterBody3D:
		v = (_target as CharacterBody3D).velocity
		v.y = 0
	var goal := _target.global_position + v * lookahead + Vector3(0, 1.0, 0)
	_focus = _focus.lerp(goal, clampf(delta * follow, 0.0, 1.0))
	var p := deg_to_rad(pitch_deg)
	var off := Vector3(sin(yaw) * cos(p), sin(p), cos(yaw) * cos(p)) * _dist
	global_position = _focus + off
	look_at(_focus, Vector3.UP)
	if _target.has_method("set") and "cam_yaw" in _target:
		_target.cam_yaw = yaw
	RenderingServer.global_shader_parameter_set("bc_player_pos", _target.global_position)
	RenderingServer.global_shader_parameter_set("bc_cut_on", 1.0)


## касания вне кнопок управления — поворот и приближение камеры (вызывает слой управления)
func touch_drag(index: int, rel: Vector2) -> void:
	_drag[index] = true
	yaw -= rel.x * 0.006


func touch_pinch(factor: float) -> void:
	zoom = clampf(zoom / factor, 0.6, 1.5)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			zoom = clampf(zoom * 0.92, 0.6, 1.5)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			zoom = clampf(zoom * 1.08, 0.6, 1.5)
