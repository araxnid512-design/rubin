extends Node
## EnvironmentSystem BunkerCore: свет, туман, небо, погода (пыль в воздухе), звуки среды и поле радиации.
## Наборы (preset):
##   surface  — холодное жёлто-серое небо, низкое солнце сквозь облака, плотный туман на горизонте, ветер;
##   entrance — переход: туман слабее, солнце слабее, гул вентиляции нарастает;
##   bunker   — без солнца, тёплый свет ламп, гул генератора и вентиляции, капель;
##   building — как поверхность, но ветер тише.
## Радиация: фон поверхности + источники (точка, мощность мЗв/ч, радиус); в бункере — безопасно.

var world_env: WorldEnvironment
var env: Environment
var sun: DirectionalLight3D
var preset := ""
var sources: Array = []          ## [{pos, rate, radius}]
var surface_rate := 2.4          ## фон поверхности, мЗв/ч
var bunker_rate := 0.0002
var _amb := {}                   ## имя → AudioStreamPlayer
var _amb_target := {}
var _dust: GPUParticles3D
var quality := 1


func attach(root: Node3D) -> void:
	world_env = WorldEnvironment.new()
	world_env.name = "Env"
	env = Environment.new()
	world_env.environment = env
	root.add_child(world_env)
	sun = DirectionalLight3D.new()
	sun.name = "Sun"
	sun.rotation_degrees = Vector3(-38, -35, 0)
	sun.light_color = Color(1.0, 0.9, 0.74)
	sun.light_energy = 1.05
	sun.shadow_enabled = true
	sun.directional_shadow_mode = DirectionalLight3D.SHADOW_ORTHOGONAL
	sun.directional_shadow_max_distance = 45.0
	sun.shadow_bias = 0.04
	sun.shadow_normal_bias = 1.2
	sun.light_cull_mask = 0xFFFFF & ~2     # бункер (слой 2) солнцем не освещается
	root.add_child(sun)
	var sky := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.5, 0.5, 0.47)
	sm.sky_horizon_color = Color(0.72, 0.67, 0.55)
	sm.ground_bottom_color = Color(0.2, 0.18, 0.15)
	sm.ground_horizon_color = Color(0.7, 0.64, 0.52)
	sm.sun_angle_max = 40.0
	sm.sun_curve = 0.12
	sky.sky_material = sm
	env.sky = sky
	env.background_mode = Environment.BG_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 1.0
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.fog_enabled = true
	env.fog_mode = Environment.FOG_MODE_DEPTH
	env.fog_depth_begin = 30.0
	env.fog_depth_end = 220.0
	env.fog_depth_curve = 1.2
	env.adjustment_enabled = true
	_ambient_players(root)
	_make_dust(root)
	set_preset("surface")


func _ambient_players(root: Node) -> void:
	for n in ["wind", "hum", "drip", "geiger"]:
		var p := AudioStreamPlayer.new()
		p.name = "Amb_" + n
		var w: AudioStream = Core.sfx("amb_" + n)
		if w:
			# зацикливание звука среды
			if w is AudioStreamOggVorbis:
				w = w.duplicate()
				w.loop = true
			elif w is AudioStreamWAV:
				w = w.duplicate()
				w.loop_mode = AudioStreamWAV.LOOP_FORWARD
				w.loop_begin = 0
				w.loop_end = int(w.get_length() * w.mix_rate)
			p.stream = w
		p.volume_db = -60.0
		p.bus = "Master"
		root.add_child(p)
		if p.stream:
			p.play()
		_amb[n] = p
		_amb_target[n] = -60.0


func _make_dust(root: Node3D) -> void:
	# пыль/пепел в воздухе на поверхности — немного частиц вокруг камеры
	_dust = GPUParticles3D.new()
	_dust.name = "Dust"
	_dust.amount = 220
	_dust.lifetime = 6.0
	_dust.visibility_aabb = AABB(Vector3(-20, -5, -20), Vector3(40, 15, 40))
	var pm := ParticleProcessMaterial.new()
	pm.emission_shape = ParticleProcessMaterial.EMISSION_SHAPE_BOX
	pm.emission_box_extents = Vector3(18, 4, 18)
	pm.direction = Vector3(1, -0.1, 0.3)
	pm.spread = 25.0
	pm.initial_velocity_min = 0.6
	pm.initial_velocity_max = 1.6
	pm.gravity = Vector3(0.3, -0.12, 0)
	pm.scale_min = 0.5
	pm.scale_max = 1.4
	_dust.process_material = pm
	var qm := QuadMesh.new()
	qm.size = Vector2(0.05, 0.05)
	var mat := StandardMaterial3D.new()
	mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat.albedo_color = Color(0.85, 0.8, 0.68, 0.45)
	mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	qm.material = mat
	_dust.draw_pass_1 = qm
	_dust.add_to_group("surface_only")
	root.add_child(_dust)


func set_preset(p: String) -> void:
	if p == preset or env == null:
		return
	preset = p
	var tw := create_tween().set_parallel(true)
	match p:
		"surface", "building":
			tw.tween_property(sun, "light_energy", 1.05, 1.0)
			tw.tween_property(env, "ambient_light_energy", 0.75, 1.0)
			tw.tween_property(env, "fog_light_color", Color(0.72, 0.68, 0.56), 1.0)
			tw.tween_property(env, "fog_density", 0.01, 1.0)
			tw.tween_property(env, "adjustment_saturation", 0.7, 1.0)
			tw.tween_property(env, "adjustment_contrast", 1.05, 1.0)
			env.background_mode = Environment.BG_SKY
			_amb_target = {"wind": -10.0 if p == "surface" else -18.0, "hum": -60.0, "drip": -60.0}
		"entrance":
			tw.tween_property(sun, "light_energy", 0.6, 0.8)
			tw.tween_property(env, "ambient_light_energy", 0.3, 0.8)
			_amb_target = {"wind": -20.0, "hum": -22.0, "drip": -60.0}
		"bunker":
			tw.tween_property(sun, "light_energy", 0.0, 0.6)
			tw.tween_property(env, "ambient_light_energy", 0.32, 0.6)
			tw.tween_property(env, "fog_density", 0.0, 0.6)
			tw.tween_property(env, "adjustment_saturation", 0.92, 0.6)
			tw.tween_property(env, "adjustment_contrast", 1.08, 0.6)
			env.background_mode = Environment.BG_COLOR
			env.background_color = Color(0.03, 0.028, 0.025)
			env.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
			env.ambient_light_color = Color(0.55, 0.5, 0.45)
			_amb_target = {"wind": -60.0, "hum": -12.0, "drip": -20.0}
	if p != "bunker":
		env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	if sun:
		sun.visible = p != "bunker"


func _process(delta: float) -> void:
	for n in _amb_target:
		var pl: AudioStreamPlayer = _amb.get(n)
		if pl:
			pl.volume_db = move_toward(pl.volume_db, _amb_target[n], delta * 25.0)
	# щелчки дозиметра — громче и чаще при высокой мощности дозы
	var gp: AudioStreamPlayer = _amb.get("geiger")
	if gp and Core.player:
		var r: float = Core.player.rad_rate * (0.15 if Core.player.suit_on else 1.0)
		gp.volume_db = -60.0 if r < 0.5 else lerpf(-26.0, -6.0, clampf(r / 40.0, 0.0, 1.0))
		gp.pitch_scale = lerpf(0.7, 2.2, clampf(r / 40.0, 0.0, 1.0))
	if _dust and Core.player:
		_dust.global_position = Core.player.global_position + Vector3(0, 2, 0)


# ---------------- радиация ----------------

func add_source(pos: Vector3, rate: float, radius: float) -> void:
	sources.append({"pos": pos, "rate": rate, "radius": radius})


## мощность дозы в точке, мЗв/ч
func rad_rate_at(p: Vector3) -> float:
	var z: Dictionary = Core.world.current
	if z.get("rad", -1.0) >= 0.0:
		return z.rad
	if Core.world.underground:
		return bunker_rate
	var r := surface_rate
	for s in sources:
		var d: float = p.distance_to(s.pos)
		if d < s.radius:
			var f: float = 1.0 - d / s.radius
			r += s.rate * f * f
	return r


## опасность по мощности дозы: 0 — безопасно, 1 — повышенная, 2 — опасно, 3 — смертельно
static func danger(rate: float) -> int:
	if rate < 0.5:
		return 0
	if rate < 5.0:
		return 1
	if rate < 30.0:
		return 2
	return 3
