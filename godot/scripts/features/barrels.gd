extends Node
## Бочки с горючим (как FuelBarrel браузерной игры): стоят по meta.barrels локации (их модель — та же красная
## бочка «ОГНЕОПАСНО» из glTF локации; не нашлась — простой красный цилиндр). Пуля пробивает (искры), набралось
## урона — через мгновение рвётся как граната (система гранат, explode), соседние — цепочкой (on_explosion);
## остаётся смятый чёрный остов, разлитое горючее догорает секунд восемь. Взорванные помнятся в кластере до
## его перезагрузки (snapshot/restore). Целью для автоприцела (game.hostiles) бочка становится, только когда
## у неё толпа заражённых (топтун и рубер — за двоих), а герой дальше 5 м — иначе он палил бы по бочкам у себя
## под ногами. Коллайдер бочки в стенах локации — по пояс (0,9 м), чтобы прицел видел бочку поверх неё.

const HP := 24.0
const HEIGHT := 0.88
const CROWD_R := 3.2
const SAFE := 5.0
const AIM_MAX := 20.0


## Бочка: для героя и взрывов — как враждебный (alive, T, global_position, damage).
class Barrel extends Node3D:
	var fx: Node
	var index := 0
	var alive := true
	var wrecked := false
	var hp := 24.0
	var T := {"radius": 0.35}
	var is_barrel := true
	var no_blood := true
	var body: MeshInstance3D

	func damage(dmg: float, from: Vector3) -> void:
		fx.hit(self, dmg, from)


var game: Node
var barrels: Array = []
## Взорванные (номера в meta.barrels) — из сохранения кластера, пока локация строится.
var pending: Array = []
## Сколько бочек нашлось в модели локации (её меш берём себе).
var found := 0
var check_t := 0.0
var paint: StandardMaterial3D
var band: StandardMaterial3D
var wreck_mat: StandardMaterial3D
var spark_mesh: SphereMesh
var flame_mesh: QuadMesh
var flame_ramp: Gradient


func setup(g: Node) -> void:
	game = g
	paint = _mat(Color(0.56, 0.12, 0.09), 0.55, 0.35)
	band = _mat(Color(0.79, 0.64, 0.13), 0.55, 0.35)
	wreck_mat = _mat(Color(0.1, 0.086, 0.078), 0.9, 0.3)
	spark_mesh = SphereMesh.new()
	spark_mesh.radius = 0.02
	spark_mesh.height = 0.04
	spark_mesh.radial_segments = 4
	spark_mesh.rings = 2
	var sm := StandardMaterial3D.new()
	sm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	sm.albedo_color = Color(1.0, 0.8, 0.4)
	spark_mesh.material = sm
	flame_mesh = QuadMesh.new()
	flame_mesh.size = Vector2(0.5, 0.6)
	var fm := StandardMaterial3D.new()
	fm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	fm.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	fm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	fm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	fm.vertex_color_use_as_albedo = true
	fm.albedo_color = Color(1.0, 0.55, 0.18, 0.75)
	flame_mesh.material = fm
	flame_ramp = Gradient.new()
	flame_ramp.set_color(0, Color(1, 0.85, 0.4, 1))
	flame_ramp.set_color(1, Color(0.8, 0.2, 0.05, 0))


func _mat(c: Color, rough: float, metal: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m


static func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


func on_enter(_id: String) -> void:
	_build()
	for i in pending:
		var k := int(i)
		if k >= 0 and k < barrels.size():
			_wreck(barrels[k], false)
	pending = []


func on_leave() -> void:
	for b in barrels:
		if is_instance_valid(b):
			game.hostiles.erase(b)
	barrels.clear()
	pending = []


func snapshot() -> Dictionary:
	var out := []
	for b in barrels:
		if is_instance_valid(b) and not b.alive:
			out.append(b.index)
	return {"wrecked": out}


func restore(d: Dictionary) -> void:
	var w = d.get("wrecked", [])
	pending = w.duplicate() if w is Array else []


## Бочки локации: узлы в уровне (уходят вместе с ним), меш — из модели локации, коллайдер — по пояс.
func _build() -> void:
	var level = game.level
	if level == null:
		return
	var list: Array = level.meta.get("barrels", [])
	if list.is_empty():
		return
	var meshes := _model_barrels(level, list)
	found = meshes.size()
	var walls: Node = level.get_node_or_null("Walls")
	for i in list.size():
		var x := float(list[i][0])
		var z := float(list[i][1])
		var b := Barrel.new()
		b.fx = self
		b.index = i
		b.hp = HP
		b.name = "FuelBarrel%d" % i
		level.add_child(b)
		b.position = Vector3(x, 0, z)
		var body := MeshInstance3D.new()
		var orig: MeshInstance3D = meshes.get(i)
		if orig != null:
			body.mesh = orig.mesh
			body.transform.basis = orig.global_transform.basis
			orig.visible = false
		else:
			var cyl := CylinderMesh.new()
			cyl.top_radius = 0.3
			cyl.bottom_radius = 0.3
			cyl.height = HEIGHT
			cyl.radial_segments = 14
			body.mesh = cyl
			body.material_override = paint
			var stripe := MeshInstance3D.new()
			var sc := CylinderMesh.new()
			sc.top_radius = 0.304
			sc.bottom_radius = 0.304
			sc.height = 0.16
			sc.radial_segments = 14
			stripe.mesh = sc
			stripe.material_override = band
			body.add_child(stripe)
		body.position.y = HEIGHT / 2.0
		b.add_child(body)
		b.body = body
		barrels.append(b)
		_lower_collider(walls, x, z)


## Бочки в модели локации: меши на высоте ~0,44 м точно над местами из meta.barrels.
func _model_barrels(level, list: Array) -> Dictionary:
	var out := {}
	if level.model == null:
		return out
	for n in level.model.find_children("*", "MeshInstance3D", true, false):
		var mi := n as MeshInstance3D
		if mi == null or not mi.visible:
			continue
		var p := mi.global_position
		if p.y < 0.3 or p.y > 0.6:
			continue
		for i in list.size():
			if not out.has(i) and absf(p.x - float(list[i][0])) < 0.06 and absf(p.z - float(list[i][1])) < 0.06:
				out[i] = mi
				break
	return out


## Коллайдер бочки (коробка 0,62×0,62 на всю высоту стен) — по пояс: герой и заражённые обходят бочку,
## а луч видимости на высоте 1,2 м проходит над ней.
func _lower_collider(walls: Node, x: float, z: float) -> void:
	if walls == null:
		return
	for c in walls.get_children():
		var cs := c as CollisionShape3D
		if cs == null or absf(cs.position.x - x) > 0.02 or absf(cs.position.z - z) > 0.02:
			continue
		var box := cs.shape as BoxShape3D
		if box != null and box.size.x < 0.8 and box.size.z < 0.8:
			box.size = Vector3(box.size.x, 0.9, box.size.z)
			cs.position.y = 0.45
			return


## Попадание (пуля, удар, осколки): искры; урон набрался — через миг взрыв.
func hit(b, dmg: float, _from: Vector3) -> void:
	if not is_instance_valid(b) or not b.alive:
		return
	b.hp -= dmg
	_sparks(b.global_position + Vector3(0, 0.55, 0))
	if b.hp > 0.0:
		return
	b.alive = false
	game.hostiles.erase(b)
	get_tree().create_timer(randf_range(0.08, 0.26)).timeout.connect(_blow.bind(b))


func _blow(b) -> void:
	if not is_instance_valid(b) or b.wrecked:
		return
	var at: Vector3 = b.global_position + Vector3(0, 0.5, 0)
	_wreck(b, true)
	var gr = game.get_node_or_null("grenades")
	if gr != null:
		gr.explode(at)


## Смятый чёрный остов (после взрыва и при возвращении в кластер до его перезагрузки).
func _wreck(b, burning: bool) -> void:
	b.alive = false
	b.wrecked = true
	game.hostiles.erase(b)
	var body: MeshInstance3D = b.body
	body.material_override = wreck_mat
	for c in body.get_children():
		if c is MeshInstance3D:
			c.material_override = wreck_mat
	body.scale = Vector3(1.12, 0.42, 0.95)
	body.position.y = 0.18
	body.rotation.x = randf_range(-0.25, 0.25)
	body.rotation.z = randf_range(-0.25, 0.25)
	if burning:
		_fire(b)


## Разлитое горючее догорает секунд восемь.
func _fire(b: Node3D) -> void:
	var f := CPUParticles3D.new()
	f.amount = 14
	f.lifetime = 0.6
	f.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	f.emission_sphere_radius = 0.35
	f.direction = Vector3.UP
	f.spread = 25.0
	f.initial_velocity_min = 0.6
	f.initial_velocity_max = 1.4
	f.gravity = Vector3(0, 0.8, 0)
	f.scale_amount_min = 0.35
	f.scale_amount_max = 0.7
	f.mesh = flame_mesh
	f.color_ramp = flame_ramp
	f.position.y = 0.15
	b.add_child(f)
	var tw := f.create_tween()
	tw.tween_interval(6.0)
	tw.tween_property(f, "scale", Vector3.ONE * 0.05, 2.0)
	tw.tween_callback(f.queue_free)


func _sparks(at: Vector3) -> void:
	var p := CPUParticles3D.new()
	p.one_shot = true
	p.amount = 8
	p.lifetime = 0.35
	p.explosiveness = 1.0
	p.spread = 70.0
	p.initial_velocity_min = 2.0
	p.initial_velocity_max = 4.5
	p.gravity = Vector3(0, -9.8, 0)
	p.mesh = spark_mesh
	p.position = at
	p.emitting = true
	add_child(p)
	get_tree().create_timer(0.6).timeout.connect(p.queue_free)


## Соседние бочки рвутся от взрыва — цепочкой.
func on_explosion(pos: Vector3, radius: float) -> void:
	for b in barrels:
		if is_instance_valid(b) and b.alive and _flat(b.global_position, pos) < radius:
			b.damage(200.0, pos)


## Автоприцел: бочка — цель (в game.hostiles), когда у неё толпа заражённых, а герой не ближе 5 м.
func _process(delta: float) -> void:
	check_t -= delta
	if check_t > 0.0:
		return
	check_t = 0.25
	var p = game.player
	for b in barrels:
		if not is_instance_valid(b) or not b.alive:
			continue
		var want := false
		if p != null and p.alive:
			var d := _flat(p.global_position, b.global_position)
			if d >= SAFE and d <= AIM_MAX:
				var crowd := 0
				for e in game.enemies:
					if is_instance_valid(e) and e.alive and _flat(e.global_position, b.global_position) < CROWD_R:
						crowd += 1 if e.type in ["runner", "lottery"] else 2
				want = crowd >= 2
		var has: bool = game.hostiles.has(b)
		if want and not has:
			game.hostiles.append(b)
		elif not want and has:
			game.hostiles.erase(b)


# ---------- Автотест ----------


func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1


func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout


func _wrecked() -> Array:
	var out := []
	for b in barrels:
		if not b.alive:
			out.append(b.index)
	return out


## Свободная точка (не в стене) на расстоянии r от at, или Vector3.INF.
func _free_near(at: Vector3, r: float) -> Vector3:
	for k in 16:
		var ang := float(k) * TAU / 16.0
		var s := at + Vector3(cos(ang), 0, sin(ang)) * r
		if not game.level.blocked_at(s):
			return s
	return Vector3.INF


## Перейти в стаб и вернуться (reload — кластер за это время перезагрузился).
func _away_and_back(reload: bool) -> void:
	game.snapshot()
	game.enter("stab", "zarechny")
	await _wait(0.3)
	if reload:
		game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 0.01
		game.advance(0.05)
	game.enter("zarechny", "stab")
	await _wait(0.3)
	game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 1000.0


func smoke() -> int:
	var fail := 0
	if game.loc != "zarechny":
		game.enter("zarechny", null)
		await _wait(0.4)
	game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 1000.0
	var p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	var n_meta: int = game.level.meta.get("barrels", []).size()
	fail += _check(n_meta > 0 and barrels.size() == n_meta, "бочки с горючим: %d из %d, модель из локации у %d" % [barrels.size(), n_meta, found])
	if barrels.is_empty():
		return fail
	# автоприцел: толпа у бочки, герой в 7 м — бочка становится целью; герой ближе 5 м — нет
	var b0 = barrels[0]
	var far := _free_near(b0.global_position, 7.0)
	var near := _free_near(b0.global_position, 3.0)
	if far != Vector3.INF:
		p.global_position = far
		var crowd := [game.spawn_enemy("runner", b0.global_position + Vector3(1.0, 0, 0)), game.spawn_enemy("runner", b0.global_position + Vector3(-0.8, 0, 0.8))]
		for e in crowd:
			e.set_physics_process(false)
		await _wait(0.5)
		fail += _check(game.hostiles.has(b0), "толпа у бочки, герой в 7 м — бочка в целях автоприцела")
		if near != Vector3.INF:
			p.global_position = near
			await _wait(0.5)
			fail += _check(not game.hostiles.has(b0), "герой в 3 м от бочки — по ней не стреляет")
		for e in crowd:
			game.enemies.erase(e)
			e.queue_free()
		p.global_position = far
	# взрыв от урона; соседняя (ближе 6 м) — цепочкой
	var first = b0
	var second = null
	for a in barrels:
		for c in barrels:
			if a != c and second == null and _flat(a.global_position, c.global_position) < 6.0:
				first = a
				second = c
	first.damage(10.0, p.global_position)
	fail += _check(first.alive and not first.wrecked, "пуля пробила бочку — ещё цела (%d из %d)" % [int(first.hp), int(HP)])
	first.damage(30.0, p.global_position)
	await _wait(1.2)
	fail += _check(first.wrecked and not game.hostiles.has(first) and first.body.scale.y < 0.5, "бочка взорвалась от урона — смятый остов")
	if second != null:
		fail += _check(second.wrecked, "соседняя бочка в %.1f м рванула цепочкой" % _flat(first.global_position, second.global_position))
	var gone := _wrecked()
	# ушёл и вернулся до перезагрузки — остовы на месте
	await _away_and_back(false)
	var same := barrels.size() == n_meta
	for b in barrels:
		if b.wrecked != gone.has(b.index):
			same = false
	fail += _check(same and not gone.is_empty(), "после ухода и возвращения взорванные — остовы %s, остальные целы" % [gone])
	# кластер перезагрузился — бочки снова целы
	await _away_and_back(true)
	fail += _check(barrels.size() == n_meta and _wrecked().is_empty(), "после перезагрузки кластера все бочки целы")
	return fail
