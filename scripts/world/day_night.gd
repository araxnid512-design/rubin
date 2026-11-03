class_name DayNight
extends Node3D
## Смена времени суток: солнце/луна, цвет неба, туман, окружающий свет.

var sun: DirectionalLight3D
var env: Environment
var sky_mat: ProceduralSkyMaterial
var _t := 0.0
var _last_hour := -1.0

func setup() -> void:
	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 40.0
	sun.shadow_bias = 0.06
	sun.shadow_normal_bias = 1.2
	sun.light_angular_distance = 0.0
	add_child(sun)
	var we := WorldEnvironment.new()
	env = Environment.new()
	sky_mat = ProceduralSkyMaterial.new()
	sky_mat.sky_curve = 0.12
	sky_mat.ground_curve = 0.05
	var sky := Sky.new()
	sky.sky_material = sky_mat
	sky.radiance_size = Sky.RADIANCE_SIZE_64
	env.background_mode = Environment.BG_SKY
	env.sky = sky
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 45.0
	env.fog_depth_end = 160.0
	env.fog_depth_curve = 1.4
	env.adjustment_enabled = true
	env.adjustment_saturation = 0.82
	env.adjustment_contrast = 1.06
	we.environment = env
	add_child(we)
	apply_quality()
	Settings.changed.connect(apply_quality)
	update_sky(true)

func apply_quality() -> void:
	var p := Settings.preset()
	sun.shadow_enabled = Settings.shadows
	sun.directional_shadow_max_distance = p.shadow_dist
	env.glow_enabled = p.glow
	env.glow_intensity = 0.5
	env.glow_bloom = 0.05
	env.fog_enabled = p.fog
	env.fog_depth_end = minf(160.0, Settings.draw_distance + 30.0)

func _process(delta: float) -> void:
	_t += delta
	RenderingServer.global_shader_parameter_set("wind_time", _t)
	var day_len := maxf(1.0, Settings.day_length_min) * 60.0
	Game.advance_time(delta / day_len * 24.0)
	if absf(Game.time_of_day - _last_hour) > 0.02:
		update_sky(false)

func update_sky(force: bool) -> void:
	_last_hour = Game.time_of_day
	var h := Game.time_of_day
	# высота солнца: восход 5:30, закат 20:30
	var day_k := clampf((h - 5.5) / 15.0, 0.0, 1.0)
	var elev := sin(day_k * PI)
	var is_day := h > 5.5 and h < 20.5
	var dawn := 1.0 - smoothstep(0.0, 0.35, elev)
	if is_day:
		var az := lerpf(-100.0, 100.0, day_k)
		sun.rotation_degrees = Vector3(-lerpf(8.0, 62.0, elev), az + 20.0, 0)
		sun.light_energy = lerpf(0.25, 1.25, smoothstep(0.0, 0.6, elev))
		sun.light_color = Color(1.0, 0.72, 0.5).lerp(Color(1.0, 0.95, 0.86), smoothstep(0.1, 0.6, elev))
	else:
		sun.rotation_degrees = Vector3(-50, 40, 0)
		sun.light_energy = 0.22
		sun.light_color = Color(0.55, 0.65, 0.95)
	var night_k := 0.0 if is_day else 1.0
	if is_day:
		night_k = 1.0 - smoothstep(0.0, 0.18, elev)
	var top_day := Color(0.36, 0.45, 0.55)
	var hor_day := Color(0.66, 0.66, 0.6)
	var top_dawn := Color(0.3, 0.3, 0.42)
	var hor_dawn := Color(0.85, 0.55, 0.35)
	var top_night := Color(0.02, 0.03, 0.06)
	var hor_night := Color(0.06, 0.07, 0.1)
	var top := top_day.lerp(top_dawn, dawn).lerp(top_night, night_k)
	var hor := hor_day.lerp(hor_dawn, dawn).lerp(hor_night, night_k)
	sky_mat.sky_top_color = top
	sky_mat.sky_horizon_color = hor
	sky_mat.ground_horizon_color = hor.darkened(0.2)
	sky_mat.ground_bottom_color = hor.darkened(0.6)
	sky_mat.sun_angle_max = 20.0
	env.ambient_light_energy = lerpf(1.0, 0.45, night_k)
	env.fog_light_color = hor.lerp(Color(0.5, 0.52, 0.5), 0.3 * (1.0 - night_k))
	env.fog_density = 0.01
	if force or Engine.get_process_frames() % 30 == 0:
		get_tree().call_group("buildings", "_update_lights")
		get_tree().call_group("lamps", "update_lamp")
