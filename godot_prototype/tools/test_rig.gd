extends Node3D
## Визуальная проверка анимации персонажа: рендер кадров в docs/rigtest/.

var rigs := []
var t := 0.0
var frame := 0
var cam: Camera3D
var frozen := false

func _ready() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.5, 0.55, 0.6)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.5, 0.5, 0.55)
	e.ambient_light_energy = 1.0
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -30, 0)
	sun.shadow_enabled = true
	add_child(sun)
	var g := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(200, 200)
	g.mesh = pm
	add_child(g)
	cam = Camera3D.new()
	add_child(cam)
	var configs := [
		["walk", "ak74", {"head": "helmet", "armband": true}],
		["run", "pm", {"head": "beret"}],
		["aim_rifle", "ak74", {"head": "gasmask"}],
		["aim_pistol", "pm", {"head": "bare", "headset": true}],
		["reload", "ak74", {"head": "helmet"}],
		["melee", "knife", {"head": "cap"}],
		["repair", "", {"head": "helmet", "toolbag": true}],
		["idle", "pkm", {"head": "helmet", "backpack": true, "build": 1.12}],
		["zombie", "", {"head": "hood", "suit": Color(0.3, 0.32, 0.22)}],
		["death", "ak74", {"head": "helmet"}],
	]
	configs.append(["dog_trot", "", {}])
	configs.append(["dog_gallop", "", {}])
	configs.append(["dog_attack", "", {}])
	for i in configs.size():
		var c: Array = configs[i]
		var r: Node3D
		if String(c[0]).begins_with("dog"):
			r = DogRig.new()
			add_child(r)
			r.setup(c[2])
		else:
			r = HumanRig.new()
			add_child(r)
			r.setup(c[2])
			r.set_weapon(c[1])
		r.position = Vector3((i % 5) * 12.0 - 24.0, 0, (i / 5) * 14.0)
		r.set_meta("mode", c[0])
		r.set_meta("base", r.position)
		rigs.append(r)

func _process(delta: float) -> void:
	if frozen:
		return
	delta = 1.0 / 30.0
	t += delta
	for r in rigs:
		var m: String = r.get_meta("mode")
		var base: Vector3 = r.get_meta("base")
		r.velocity = Vector3.ZERO
		if r is HumanRig:
			r.aiming = false
		match m:
			"dog_trot":
				r.velocity = Vector3(0, 0, -3.0)
			"dog_gallop":
				r.velocity = Vector3(0, 0, -7.0)
			"dog_attack":
				if r.action == "":
					r.play("attack", 0.5)
			"walk":
				r.velocity = Vector3(0, 0, -1.6)
			"run":
				r.velocity = Vector3(0, 0, -4.2)
			"aim_rifle", "aim_pistol":
				r.aiming = true
				r.aim_dir = Vector3(0, 0, -1)
			"reload":
				if r.action == "":
					r.play("reload", 2.3)
			"melee":
				if r.action == "":
					r.play("melee", 0.6)
			"repair":
				if r.action == "":
					r.play("repair", 5.0)
			"zombie":
				r.shamble = 1.0
				r.velocity = Vector3(0, 0, -0.8)
			"death":
				if t > 0.5 and not r.dead:
					r.die()
		r.position += r.velocity * delta
		if r.position.z < base.z - 9.0:
			r.position.z = base.z
			r.reset_feet()
		r.update_pose(delta)

func set_view(v: int) -> void:
	match v:
		0:
			cam.position = Vector3(0, 6, 9)
			cam.look_at(Vector3(0, 0.8, 1.5))
		1:
			cam.position = Vector3(12, 2.0, 1.5)
			cam.look_at(Vector3(0, 0.9, 1.5))
		2:
			cam.position = Vector3(0, 14, 10)
			cam.look_at(Vector3(0, 0, 1.5))

func focus(i: int, side: int) -> void:
	var r: Node3D = rigs[i]
	var c := r.position + Vector3(0, 0.9, 0)
	var off := Vector3(-2.0, 0.9, -2.6) if side == 0 else Vector3(3.6, 0.3, 0.0)
	if side == 2:
		off = Vector3(0, 6.5, 4.0)
	cam.position = c + off
	cam.look_at(c)
	cam.fov = 40
