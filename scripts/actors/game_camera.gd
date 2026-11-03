class_name GameCamera
extends Camera3D
## Камера сверху под наклоном (как в 3D-выживалках), плавно следует за генералом.
## Режимы: "follow" (по умолчанию). Заготовка под "tactical" (тактический обзор) на следующих этапах.

var target: Node3D
var pitch_deg := 54.0
var base_dist := 20.0
var zoom := 1.0
var mode := "follow"
var _focus := Vector3.ZERO
var _shake := 0.0
var _init_done := false

func _ready() -> void:
	physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	fov = 42.0
	near = 0.5
	far = 220.0
	zoom = Settings.camera_zoom
	Events.player_hit.connect(func(a): _shake = minf(1.0, _shake + a * 0.03))

func shake(v: float) -> void:
	_shake = minf(1.0, _shake + v)

func snap() -> void:
	_init_done = false

func _process(delta: float) -> void:
	if target == null or not is_instance_valid(target):
		return
	far = Settings.draw_distance + 40.0
	var tp := target.get_global_transform_interpolated().origin
	var vel := Vector3.ZERO
	if target is CharacterBody3D:
		vel = (target as CharacterBody3D).velocity
		vel.y = 0
	var look := vel * 0.35
	if look.length() > 2.5:
		look = look.normalized() * 2.5
	var want := tp + look + Vector3(0, 0.8, 0)
	if not _init_done:
		_focus = want
		_init_done = true
	_focus = _focus.lerp(want, 1.0 - exp(-5.0 * delta))
	var mz := 1.0
	if mode == "tactical":
		mz = 1.8
	var d := base_dist * clampf(zoom, 0.55, 1.7) * mz
	var p := deg_to_rad(pitch_deg + (zoom - 1.0) * 6.0)
	var offset := Vector3(0, sin(p), cos(p)) * d
	var sh := Vector3.ZERO
	if _shake > 0.0:
		_shake = maxf(0.0, _shake - delta * 2.5)
		sh = Vector3(randf_range(-1, 1), randf_range(-1, 1), randf_range(-1, 1)) * _shake * 0.25
	global_position = _focus + offset + sh
	look_at(_focus + sh * 0.5, Vector3.UP)

func _unhandled_input(e: InputEvent) -> void:
	if e.is_action_pressed("zoom_in"):
		set_zoom(zoom - 0.08)
	elif e.is_action_pressed("zoom_out"):
		set_zoom(zoom + 0.08)

func set_zoom(z: float) -> void:
	zoom = clampf(z, 0.55, 1.7)
	Settings.camera_zoom = zoom
