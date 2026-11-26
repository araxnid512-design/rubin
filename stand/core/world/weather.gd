class_name ULWeather
extends Node3D
## Погода и мелкая жизнь вокруг героя (data/weather.json):
##  • ветер — глобальный параметр wind для травы, елей и деревьев (волна порыва бежит по полю, ULSunShadow.WIND);
##  • тени облаков — бесшовный шум плывёт по земле (все земляные шейдеры, cloud_shade);
##  • дождь — шанс на посещение: капли и брызги вокруг героя (под крышей капель нет), шум дождя (под крышей
##    тише), мокрая земля темнее и с бликом (wet_k), дымка гуще, солнце слабее, цвета холоднее (ULGrade);
##  • пыль в воздухе (без дождя) — редкие пылинки плывут по ветру;
##  • мухи у тел: над лежащими телами (до 5 ближайших) кружат мухи (без звука — жужжание убрано по просьбе пользователя).
## Всё — частицы и одна сетка мух вокруг героя: на телефоне дёшево (количество — по уровню графики).

const CFG := "res://data/weather.json"
static var _c := {}

var rain := false
var wind := Vector4(0.8, 0.6, 0.8, 0.7)
var on := false
var _cloud_tex: Texture2D
var _drops: CPUParticles3D
var _splash: CPUParticles3D
var _motes: CPUParticles3D
var _flies: MultiMeshInstance3D
var _rain_snd: AudioStreamPlayer
var _roof := false
var _roof_t := 0.0
var _buzz_t := 1.0
var _t := 0.0
var flies_shown := 0                 ## сколько мух сейчас видно (проверки)


static func cfg() -> Dictionary:
	if _c.is_empty():
		var d = JSON.parse_string(FileAccess.get_file_as_string(CFG))
		_c = d if d is Dictionary else {}
	return _c


## enabled — погода включена (в проверках — нет); force_rain: -1 — по шансу, 0 — сухо, 1 — дождь
func setup(place: String, rng: RandomNumberGenerator, enabled: bool, force_rain: int, gfx: int) -> void:
	on = enabled
	var c := cfg()
	rain = force_rain == 1 or (force_rain < 0 and enabled and rng.randf() < float((c.get("rain", {}) as Dictionary).get(place, 0.0)))
	var a := rng.randf() * TAU
	var wr: Array = c.get("wind", [0.5, 1.1])
	var gr: Array = c.get("gust", [0.4, 1.0])
	var st := rng.randf_range(float(wr[0]), float(wr[1])) * (float(c.get("rain_wind", 1.4)) if rain else 1.0)
	wind = Vector4(cos(a), sin(a), st, rng.randf_range(float(gr[0]), float(gr[1])) * (1.3 if rain else 1.0))
	RenderingServer.global_shader_parameter_set(&"wind", wind)
	if _cloud_tex == null:
		_cloud_tex = load("res://assets/world/tex/clouds.png")
	RenderingServer.global_shader_parameter_set(&"cloud_tex", _cloud_tex.get_rid())
	RenderingServer.global_shader_parameter_set(&"cloud_k", (float(c.get("rain_clouds", 0.05)) if rain else float(c.get("clouds", 0.16))) if enabled else 0.0)
	RenderingServer.global_shader_parameter_set(&"wet_k", float(c.get("wet", 0.85)) if rain else 0.0)
	var lv := clampi(gfx, 0, 3)
	if rain:
		_make_rain(int((c.get("drops", [140, 260, 420, 560]) as Array)[lv]))
	elif enabled and int((c.get("motes", [0, 18, 30, 44]) as Array)[lv]) > 0:
		_make_motes(int((c.get("motes", [0, 18, 30, 44]) as Array)[lv]))
	if enabled:
		_make_flies(int(c.get("flies_per_body", 6)) * int(c.get("flies_bodies", 5)))


## выключить всё (выход с локации, проверки): глобальные параметры — в покой
static func reset_globals() -> void:
	RenderingServer.global_shader_parameter_set(&"cloud_k", 0.0)
	RenderingServer.global_shader_parameter_set(&"wet_k", 0.0)


func _unshaded(col: Color) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_color = col
	m.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	m.no_depth_test = false
	return m


func _make_rain(n: int) -> void:
	_drops = CPUParticles3D.new()
	_drops.amount = n
	_drops.lifetime = 0.75
	_drops.preprocess = 0.75
	_drops.local_coords = false
	_drops.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_drops.emission_box_extents = Vector3(15, 0.5, 12)
	_drops.direction = Vector3(wind.x * 0.22, -1.0, wind.y * 0.22).normalized()
	_drops.spread = 2.0
	_drops.gravity = Vector3.ZERO
	_drops.initial_velocity_min = 15.0
	_drops.initial_velocity_max = 19.0
	var qm := QuadMesh.new()
	qm.size = Vector2(0.02, 0.6)
	var m := _unshaded(Color(0.8, 0.84, 0.9, 0.3))
	m.billboard_mode = BaseMaterial3D.BILLBOARD_FIXED_Y
	qm.material = m
	_drops.mesh = qm
	_drops.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_drops)
	_splash = CPUParticles3D.new()
	_splash.amount = maxi(n / 3, 30)
	_splash.lifetime = 0.32
	_splash.local_coords = false
	_splash.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_splash.emission_box_extents = Vector3(13, 0.0, 10)
	_splash.direction = Vector3.UP
	_splash.spread = 40.0
	_splash.gravity = Vector3(0, -9.8, 0)
	_splash.initial_velocity_min = 0.7
	_splash.initial_velocity_max = 1.5
	_splash.scale_amount_min = 0.5
	_splash.scale_amount_max = 1.0
	var sq := QuadMesh.new()
	sq.size = Vector2(0.035, 0.035)
	sq.material = _unshaded(Color(0.86, 0.9, 0.95, 0.5))
	_splash.mesh = sq
	_splash.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_splash)
	_rain_snd = AudioStreamPlayer.new()
	var s: AudioStream = load("res://assets/audio/rain_loop.ogg")
	if s is AudioStreamOggVorbis:
		(s as AudioStreamOggVorbis).loop = true
	_rain_snd.stream = s
	_rain_snd.volume_db = -15.0
	add_child(_rain_snd)
	_rain_snd.play()


func _make_motes(n: int) -> void:
	_motes = CPUParticles3D.new()
	_motes.amount = n
	_motes.lifetime = 9.0
	_motes.preprocess = 9.0
	_motes.local_coords = false
	_motes.emission_shape = CPUParticles3D.EMISSION_SHAPE_BOX
	_motes.emission_box_extents = Vector3(13, 1.2, 10)
	_motes.direction = Vector3(wind.x, 0.05, wind.y)
	_motes.spread = 60.0
	_motes.gravity = Vector3(0, -0.015, 0)
	_motes.initial_velocity_min = 0.12 + 0.15 * wind.z
	_motes.initial_velocity_max = 0.3 + 0.3 * wind.z
	_motes.scale_amount_min = 0.5
	_motes.scale_amount_max = 1.2
	var q := QuadMesh.new()
	q.size = Vector2(0.03, 0.03)
	q.material = _unshaded(Color(1.0, 0.97, 0.85, 0.4))
	_motes.mesh = q
	_motes.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_motes)


func _make_flies(n: int) -> void:
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	var sm := SphereMesh.new()
	sm.radius = 0.013
	sm.height = 0.026
	sm.radial_segments = 4
	sm.rings = 2
	var m := StandardMaterial3D.new()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	m.albedo_color = Color(0.04, 0.04, 0.035)
	sm.material = m
	mm.mesh = sm
	mm.instance_count = n
	mm.visible_instance_count = 0
	_flies = MultiMeshInstance3D.new()
	_flies.multimesh = mm
	_flies.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	add_child(_flies)


## каждый кадр: hero — где герой; bodies — где лежат тела (для мух)
func tick(delta: float, hero: Vector3, bodies: Array, snd: BCSound) -> void:
	_t += delta
	if _drops:
		_drops.global_position = hero + Vector3(0, 9.0, 0)
		_splash.global_position = Vector3(hero.x, hero.y + 0.05, hero.z)
		_roof_t -= delta
		if _roof_t <= 0.0:
			_roof_t = 0.25
			_roof = _roof_over(hero)
			_drops.emitting = not _roof
			_splash.emitting = not _roof
		_rain_snd.volume_db = lerpf(_rain_snd.volume_db, -24.0 if _roof else -15.0, 1.0 - exp(-delta * 3.0))
	if _motes:
		_motes.global_position = hero + Vector3(0, 1.4, 0)
	if _flies:
		_flies_tick(delta, hero, bodies, snd)


func _roof_over(hero: Vector3) -> bool:
	var q := PhysicsRayQueryParameters3D.create(hero + Vector3.UP * 2.0, hero + Vector3.UP * 14.0)
	return not get_world_3d().direct_space_state.intersect_ray(q).is_empty()


func _flies_tick(delta: float, hero: Vector3, bodies: Array, snd: BCSound) -> void:
	var mm := _flies.multimesh
	var per := int(cfg().get("flies_per_body", 6))
	var near: Array = []
	for b in bodies:
		var d := (b as Vector3).distance_to(hero)
		if d < 16.0:
			near.append([d, b])
	near.sort_custom(func(x, y) -> bool: return float(x[0]) < float(y[0]))
	var k := 0
	for ni in mini(near.size(), mm.instance_count / per):
		var c: Vector3 = near[ni][1]
		for f in per:
			var ph := float(f) * 1.7 + float(ni) * 0.9
			var a := _t * (2.2 + float(f) * 0.37) + ph
			var r := 0.22 + 0.14 * sin(_t * 1.3 + ph)
			mm.set_instance_transform(k, Transform3D(Basis(), c + Vector3(cos(a) * r, 0.22 + 0.16 * sin(_t * 3.1 + ph * 2.0), sin(a * 1.3) * r * 0.85)))
			k += 1
	mm.visible_instance_count = k
	flies_shown = k
	# жужжания нет: пользователь попросил убрать звук мух (26.11) — мухи над телами только видны
