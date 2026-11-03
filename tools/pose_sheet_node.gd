extends Node
## Рендер листов поз (20 поз на класс оружия) → docs/poses/<класс>_NN.png
## Запуск: xvfb-run godot --rendering-driver opengl3 --path . -s tools/run_tool.gd -- pose_sheet [класс ...]

const CLASSES := {"pistol": "pm", "smg": "aks74u", "rifle": "ak74", "sniper": "svd", "shotgun": "ks23", "mg": "pkm", "launcher": "rg6"}
const POSES := [
	["01", "Стойка", "idle"], ["02", "Низкая готовность", "low"], ["03", "Оружие опущено", "carry"],
	["04", "Прицел", "aim"], ["05", "Прицел в движении", "aim_strafe"], ["06", "Осмотр влево", "look_l"],
	["07", "Осмотр вправо", "look_r"], ["08", "Взгляд вниз", "look_d"], ["09", "Шаг 1", "walk0"],
	["10", "Шаг 2", "walk1"], ["11", "Шаг 3", "walk2"], ["12", "Шаг 4", "walk3"],
	["13", "Выстрел (отдача)", "fire"], ["14", "Прицел влево", "aim_left"], ["15", "Шаг назад с прицелом", "aim_back"],
	["16", "Перезарядка: извлечение", "rel1"], ["17", "Перезарядка: новый боезапас", "rel2"], ["18", "Перезарядка: досылание", "rel3"],
	["19", "Осмотр оружия", "inspect"], ["20", "Стойка (возврат)", "idle2"],
]

var cam: Camera3D
var label: Label
var rig: HumanRig
var db: Node

func _ready() -> void:
	_run()

func _env() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.62, 0.62, 0.62)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.75, 0.78)
	e.ambient_light_energy = 0.9
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-40, -35, 0)
	sun.light_energy = 1.3
	sun.shadow_enabled = true
	add_child(sun)
	var fill := DirectionalLight3D.new()
	fill.rotation_degrees = Vector3(-20, 150, 0)
	fill.light_energy = 0.4
	add_child(fill)
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 400)
	g.mesh = pm
	var gm := StandardMaterial3D.new()
	gm.albedo_color = Color(0.6, 0.6, 0.6)
	g.material_override = gm
	add_child(g)
	cam = Camera3D.new()
	cam.fov = 30
	add_child(cam)
	var cl := CanvasLayer.new()
	add_child(cl)
	label = Label.new()
	label.position = Vector2(14, 8)
	label.add_theme_font_size_override("font_size", 44)
	label.add_theme_color_override("font_color", Color(0.05, 0.05, 0.05))
	cl.add_child(label)

func _sim(t: float) -> void:
	var dt := 1.0 / 30.0
	var n := int(t / dt)
	for i in n:
		rig.position += rig.velocity * dt
		rig.update_pose(dt)

func _new_rig(weapon_id: String) -> void:
	if rig:
		rig.queue_free()
	rig = HumanRig.new()
	rig.use_interp = false
	add_child(rig)
	rig.setup({"head": "bare", "headset": true, "backpack": true, "armband": true})
	rig.set_weapon(weapon_id)
	rig.set_shadow(true)

func _pose(code: String, wid: String) -> void:
	_new_rig(wid)
	var w: Dictionary = db.weapon(wid)
	rig.hold_state = "idle"
	rig.aim_dir = Vector3.FORWARD
	match code:
		"idle", "idle2":
			_sim(1.0 if code == "idle" else 2.3)
		"low":
			rig.hold_state = "low"
			_sim(1.0)
		"carry":
			rig.hold_state = "carry"
			_sim(1.0)
		"aim":
			rig.aiming = true
			_sim(1.0)
		"aim_strafe":
			rig.aiming = true
			rig.velocity = Vector3(-1.3, 0, 0)
			_sim(1.13)
		"aim_left":
			rig.aiming = true
			rig.aim_dir = Vector3(-0.6, 0, -0.8).normalized()
			_sim(1.0)
		"aim_back":
			rig.aiming = true
			rig.velocity = Vector3(0, 0, 1.2)
			_sim(1.2)
		"fire":
			rig.aiming = true
			_sim(1.0)
			rig.on_fire()
			_sim(0.034)
		"look_l":
			rig.hold_state = "low"
			rig.look_bias = 0.9
			_sim(1.0)
		"look_r":
			rig.hold_state = "low"
			rig.look_bias = -0.9
			_sim(1.0)
		"look_d":
			rig.hold_state = "low"
			rig.look_at_pos = Vector3(0.3, 0, -1.2)
			_sim(1.0)
		"walk0", "walk1", "walk2", "walk3":
			rig.hold_state = "low"
			rig.velocity = Vector3(0, 0, -1.6)
			_sim(1.2)
			var target: float = [0.0, 0.25, 0.5, 0.75][int(code.right(1))]
			var guard := 0
			while absf(rig.phase - target) > 0.04 and guard < 200:
				_sim(1.0 / 30.0)
				guard += 1
		"rel1", "rel2", "rel3":
			rig.hold_state = "low"
			_sim(0.6)
			var dur: float = w.reload_time
			rig.play("reload", dur)
			_sim(dur * {"rel1": 0.25, "rel2": 0.5, "rel3": 0.78}[code])
		"inspect":
			rig.hold_state = "low"
			_sim(0.6)
			rig.play("inspect", 2.2)
			_sim(2.2 * 0.45)

func _run() -> void:
	db = ItemDB
	_env()
	await get_tree().process_frame
	var only := OS.get_cmdline_user_args()
	DirAccess.make_dir_recursive_absolute("res://docs/poses")
	for cls in CLASSES:
		if only.size() > 0 and not (cls in only):
			continue
		var wid: String = CLASSES[cls]
		for p in POSES:
			_pose(p[2], wid)
			var c := rig.position + Vector3(0, 1.0, 0)
			cam.position = c + Vector3(-1.9, 0.75, -3.3)
			cam.look_at(c + Vector3(0, -0.05, 0))
			label.text = "%s  %s\n%s" % [p[0], p[1], db.weapon(wid).name]
			await get_tree().process_frame
			await get_tree().process_frame
			var img := get_viewport().get_texture().get_image()
			img.save_png("res://docs/poses/%s_%s.png" % [cls, p[0]])
	get_tree().quit()
