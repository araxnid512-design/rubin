extends Node
## Гранаты Ф-1 (как throwGrenade/explode браузерной игры): кнопка «Граната» (или G) — бросок сверху дугой
## к ближайшему заражённому (до 14 м) или на 10 м вперёд; взрыв через 2 с после броска. Осколки до 6 м ранят
## заражённых (game.enemies), муров (game.hostiles), наёмников (game.targets) и самого героя. Вспышка, огненный
## шар, дым, комья земли, пыльное кольцо, тряска камеры, шум на 50 м. Другие системы узнают о взрыве своим
## методом on_explosion(pos, radius): бочки рвутся цепочкой, следы боя кладут гарь. Гранаты продаёт торговец
## (trade_offers — в окне main.gd, open_trade), бывают в тайниках (лут локаций).

const RADIUS := 6.0
const FUSE := 2.0
const REACH := 14.0
const PRICE := 25
## Урон в центре взрыва: заражённым и мурам — 170 (спадает к краю), людям — 80.
const DMG_FOES := 170.0
const DMG_PEOPLE := 80.0

var game: Node
var flying: Array = []
var shake := 0.0
var ui_t := 0.0
var body_mesh: SphereMesh
var fuse_mesh: CylinderMesh
var lever_mesh: BoxMesh
var olive: StandardMaterial3D
var steel: StandardMaterial3D
var soft: GradientTexture2D
var smoke_mat: StandardMaterial3D
var debris_mesh: BoxMesh
var ring_mesh: TorusMesh


func setup(g: Node) -> void:
	game = g
	game.hud.add_button("grenade", "Граната", Vector2(-340, -440), 90, _on_button)
	olive = _mat(Color(0.27, 0.31, 0.2), 0.6, 0.2)
	steel = _mat(Color(0.55, 0.55, 0.52), 0.35, 0.8)
	body_mesh = SphereMesh.new()
	body_mesh.radius = 0.034
	body_mesh.height = 0.08
	body_mesh.radial_segments = 10
	body_mesh.rings = 6
	fuse_mesh = CylinderMesh.new()
	fuse_mesh.top_radius = 0.011
	fuse_mesh.bottom_radius = 0.011
	fuse_mesh.height = 0.03
	fuse_mesh.radial_segments = 8
	lever_mesh = BoxMesh.new()
	lever_mesh.size = Vector3(0.008, 0.06, 0.014)
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0))
	soft = GradientTexture2D.new()
	soft.gradient = grad
	soft.fill = GradientTexture2D.FILL_RADIAL
	soft.fill_from = Vector2(0.5, 0.5)
	soft.fill_to = Vector2(1.0, 0.5)
	soft.width = 64
	soft.height = 64
	smoke_mat = StandardMaterial3D.new()
	smoke_mat.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	smoke_mat.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	smoke_mat.billboard_mode = BaseMaterial3D.BILLBOARD_PARTICLES
	smoke_mat.vertex_color_use_as_albedo = true
	smoke_mat.albedo_texture = soft
	debris_mesh = BoxMesh.new()
	debris_mesh.size = Vector3(0.12, 0.09, 0.1)
	debris_mesh.material = _mat(Color(0.29, 0.25, 0.19), 1.0, 0.0)
	ring_mesh = TorusMesh.new()
	ring_mesh.inner_radius = 0.82
	ring_mesh.outer_radius = 1.0
	ring_mesh.rings = 32
	ring_mesh.ring_segments = 4


func _mat(c: Color, rough: float, metal: float) -> StandardMaterial3D:
	var m := StandardMaterial3D.new()
	m.albedo_color = c
	m.roughness = rough
	m.metallic = metal
	return m


func _on_button(down: bool) -> void:
	if down:
		throw()


func _unhandled_input(event: InputEvent) -> void:
	var k := event as InputEventKey
	if k != null and k.pressed and not k.echo and k.keycode == KEY_G and not game.hud.panel.visible:
		throw()


func on_leave() -> void:
	for g in flying:
		if is_instance_valid(g["node"]):
			g["node"].queue_free()
	flying.clear()
	shake = 0.0
	if game.camera:
		game.camera.h_offset = 0.0
		game.camera.v_offset = 0.0


static func _flat(a: Vector3, b: Vector3) -> float:
	return Vector2(a.x - b.x, a.z - b.z).length()


## Ближайший живой заражённый в пределах броска.
func nearest_target(pos: Vector3):
	var best = null
	var bd := REACH
	for e in game.enemies:
		if is_instance_valid(e) and e.alive:
			var d := _flat(e.global_position, pos)
			if d < bd:
				bd = d
				best = e
	return best


## Граната Ф-1: корпус в рёбрах (сфера), запал и спусковой рычаг.
func _nade_node() -> Node3D:
	var n := Node3D.new()
	var b := MeshInstance3D.new()
	b.mesh = body_mesh
	b.material_override = olive
	n.add_child(b)
	var f := MeshInstance3D.new()
	f.mesh = fuse_mesh
	f.material_override = steel
	f.position.y = 0.05
	n.add_child(f)
	var lv := MeshInstance3D.new()
	lv.mesh = lever_mesh
	lv.material_override = steel
	lv.position = Vector3(0.022, 0.03, 0)
	lv.rotation.z = 0.25
	n.add_child(lv)
	return n


## Бросок: at — куда (иначе к ближайшему заражённому или вперёд). Возвращает, удалось ли бросить.
func throw(at = null) -> bool:
	var p = game.player
	if p == null or not p.alive or p.busy > 0.0 or p.equipping:
		return false
	if Data.NODES.get(game.loc, {}).get("kind", "") == "stab":
		game.toast("В стабе гранаты не бросают")
		return false
	if int(game.bag.get("grenade", 0)) <= 0:
		game.toast("Гранат нет — продаёт торговец в стабе")
		return false
	game.bag["grenade"] = int(game.bag["grenade"]) - 1
	var from: Vector3 = p.global_position
	var to: Vector3
	if at is Vector3:
		to = at
	else:
		var t = nearest_target(from)
		if t != null:
			to = t.global_position
		else:
			to = from + Vector3(sin(p.rotation.y), 0, cos(p.rotation.y)) * 10.0
	if _flat(to, from) > 0.1:
		p.rotation.y = atan2(to.x - from.x, to.z - from.z)
	# в руке — граната, оружие на миг убрано; бросок сверху (клип удара)
	var held := _nade_node()
	var hand: Node3D = p.grip if p.grip != null else p
	hand.add_child(held)
	if p.grip == null:
		held.position = Vector3(0.25, 1.6, 0)
	var gun = p.models.get(p.weapon_id())
	if gun is Node3D:
		gun.visible = false
	p.play("Melee", 0.06, true)
	p.busy = 0.55
	get_tree().create_timer(0.27).timeout.connect(_release.bind(held, to))
	get_tree().create_timer(0.55).timeout.connect(_regear)
	game.hud_refresh()
	_update_button()
	return true


func _release(held, to: Vector3) -> void:
	if not is_instance_valid(held):
		return
	var from: Vector3 = held.global_position
	held.queue_free()
	launch(from, to, FUSE)


func _regear() -> void:
	if game.player != null and game.player.alive:
		game.player.attach_gear()


## Полёт дугой; fuse — через сколько после броска взрыв.
func launch(from: Vector3, to: Vector3, fuse: float) -> void:
	var n := _nade_node()
	n.scale = Vector3.ONE * 1.6
	add_child(n)
	n.global_position = from
	var d := _flat(to, from)
	flying.append({"node": n, "from": from, "to": Vector3(to.x, 0.06, to.z), "t": 0.0, "T": 0.5 + d / 22.0, "fuse": fuse, "h": 1.2 + d * 0.12, "spin": Vector3(randf(), randf(), randf()) * 10.0})


func _process(delta: float) -> void:
	for g in flying.duplicate():
		var n: Node3D = g["node"]
		g["t"] = float(g["t"]) + delta
		g["fuse"] = float(g["fuse"]) - delta
		var k := clampf(float(g["t"]) / float(g["T"]), 0.0, 1.0)
		var a: Vector3 = g["from"]
		var b: Vector3 = g["to"]
		var pos := a.lerp(b, k)
		pos.y = lerpf(a.y, b.y, k) + sin(PI * k) * float(g["h"])
		n.global_position = pos
		if k < 1.0:
			var spin: Vector3 = g["spin"]
			n.rotation += spin * delta
		if float(g["fuse"]) <= 0.0:
			flying.erase(g)
			n.queue_free()
			explode(pos)
	# тряска камеры после взрыва
	var cam = game.camera
	if shake > 0.0 and cam != null:
		shake = maxf(0.0, shake - delta * 1.8)
		var amp := shake * 0.22
		cam.h_offset = randf_range(-amp, amp)
		cam.v_offset = randf_range(-amp, amp)
	ui_t -= delta
	if ui_t <= 0.0:
		ui_t = 0.3
		_update_button()


## Кнопка: видна, когда есть гранаты и герой не в стабе; на ней — сколько их.
func _update_button() -> void:
	var b = game.hud.buttons.get("grenade")
	if b == null:
		return
	var n := int(game.bag.get("grenade", 0))
	b.visible = n > 0 and Data.NODES.get(game.loc, {}).get("kind", "") != "stab"
	var l := b.get_child(0) as Label
	if l != null:
		l.text = "Граната\n×%d" % n


## Взрыв: осколки ранят всех в радиусе 6 м, шум на весь кластер, эффекты; системы — on_explosion(pos, radius).
func explode(pos: Vector3) -> void:
	var hit := {}
	for e in game.enemies.duplicate():
		if is_instance_valid(e) and e.alive:
			var d := _flat(e.global_position, pos)
			if d < RADIUS:
				hit[e.get_instance_id()] = true
				e.damage(DMG_FOES * pow(1.0 - d / RADIUS, 0.7), pos)
	# муры и прочие враждебные (бочки рвутся сами — через on_explosion)
	for h in game.hostiles.duplicate():
		if not is_instance_valid(h) or not h.alive or h.get("is_barrel") or hit.has(h.get_instance_id()):
			continue
		var d2 := _flat(h.global_position, pos)
		if d2 < RADIUS and h.has_method("damage"):
			hit[h.get_instance_id()] = true
			h.damage(DMG_FOES * pow(1.0 - d2 / RADIUS, 0.7), pos)
	# наёмники и герой
	var people: Array = game.targets.duplicate()
	people.append(game.player)
	for t in people:
		if t == null or not is_instance_valid(t) or not t.alive or hit.has(t.get_instance_id()):
			continue
		var d3 := _flat(t.global_position, pos)
		if d3 < RADIUS and t.has_method("hurt"):
			hit[t.get_instance_id()] = true
			t.hurt(DMG_PEOPLE * (1.0 - d3 / RADIUS), pos)
	game.noise(pos, 50.0)
	_fx(pos)
	if game.player != null:
		shake = minf(1.0, shake + 0.4 + 0.6 * clampf(1.0 - _flat(pos, game.player.global_position) / 25.0, 0.0, 1.0))
	for f in game.features:
		if f != self and f.has_method("on_explosion"):
			f.on_explosion(pos, RADIUS)


## Вспышка, огненный шар, дым, комья земли и пыльное кольцо по земле.
func _fx(pos: Vector3) -> void:
	var root := Node3D.new()
	add_child(root)
	root.global_position = Vector3(pos.x, 0.0, pos.z)
	var tw := root.create_tween().set_parallel(true)
	var light := OmniLight3D.new()
	light.light_color = Color(1.0, 0.7, 0.38)
	light.light_energy = 9.0
	light.omni_range = 18.0
	light.position.y = 1.2
	root.add_child(light)
	tw.tween_property(light, "light_energy", 0.0, 0.45)
	# огненный шар
	var ball := MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.4, 1.4)
	ball.mesh = q
	var bm := StandardMaterial3D.new()
	bm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	bm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	bm.blend_mode = BaseMaterial3D.BLEND_MODE_ADD
	bm.billboard_mode = BaseMaterial3D.BILLBOARD_ENABLED
	bm.billboard_keep_scale = true
	bm.albedo_texture = soft
	bm.albedo_color = Color(1.0, 0.75, 0.36, 1.0)
	ball.material_override = bm
	ball.position.y = 0.8
	root.add_child(ball)
	tw.tween_property(ball, "scale", Vector3.ONE * 5.0, 0.45)
	tw.tween_property(bm, "albedo_color:a", 0.0, 0.45)
	# дым
	var sm := CPUParticles3D.new()
	sm.one_shot = true
	sm.amount = 10
	sm.lifetime = 2.2
	sm.explosiveness = 0.9
	sm.emission_shape = CPUParticles3D.EMISSION_SHAPE_SPHERE
	sm.emission_sphere_radius = 0.9
	sm.direction = Vector3.UP
	sm.spread = 50.0
	sm.initial_velocity_min = 0.5
	sm.initial_velocity_max = 1.5
	sm.gravity = Vector3(0, 0.25, 0)
	sm.scale_amount_min = 1.4
	sm.scale_amount_max = 2.4
	var sq := QuadMesh.new()
	sq.size = Vector2(1, 1)
	sq.material = smoke_mat
	sm.mesh = sq
	var sg := Gradient.new()
	sg.set_color(0, Color(0.34, 0.33, 0.3, 0.6))
	sg.set_color(1, Color(0.3, 0.3, 0.28, 0.0))
	sm.color_ramp = sg
	sm.position.y = 0.7
	sm.emitting = true
	root.add_child(sm)
	# комья земли
	var db := CPUParticles3D.new()
	db.one_shot = true
	db.amount = 14
	db.lifetime = 1.3
	db.explosiveness = 1.0
	db.direction = Vector3.UP
	db.spread = 65.0
	db.initial_velocity_min = 3.0
	db.initial_velocity_max = 7.5
	db.gravity = Vector3(0, -18.0, 0)
	db.scale_amount_min = 0.5
	db.scale_amount_max = 1.5
	db.mesh = debris_mesh
	db.position.y = 0.2
	db.emitting = true
	root.add_child(db)
	# ударная волна по земле — пыльное кольцо
	var ring := MeshInstance3D.new()
	ring.mesh = ring_mesh
	var rm := StandardMaterial3D.new()
	rm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	rm.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	rm.albedo_color = Color(0.85, 0.8, 0.69, 0.55)
	ring.material_override = rm
	ring.position.y = 0.08
	ring.scale = Vector3(0.5, 0.04, 0.5)
	ring.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	root.add_child(ring)
	tw.tween_property(ring, "scale", Vector3(RADIUS, 0.04, RADIUS), 0.4)
	tw.tween_property(rm, "albedo_color:a", 0.0, 0.4)
	get_tree().create_timer(2.6).timeout.connect(root.queue_free)


# ---------- Торговец ----------


## Товар для окна торговца (main.gd, open_trade).
func trade_offers(sp: int) -> Array:
	return [["Граната Ф-1 · %d сп." % PRICE, _buy, sp >= PRICE]]


func _buy() -> void:
	if int(game.bag.get("spore", 0)) < PRICE:
		return
	game.bag["spore"] = int(game.bag["spore"]) - PRICE
	game.bag["grenade"] = int(game.bag.get("grenade", 0)) + 1
	game.toast("+1 граната")
	game.save()
	game.open_trade()


# ---------- Автотест ----------


func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1


func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout


func smoke() -> int:
	var fail := 0
	# у торговца
	game.bag["spore"] = int(game.bag.get("spore", 0)) + PRICE
	var n0 := int(game.bag.get("grenade", 0))
	var offers := trade_offers(int(game.bag["spore"]))
	fail += _check(offers.size() == 1 and offers[0][2] == true, "граната у торговца: %s" % offers[0][0])
	_buy()
	fail += _check(int(game.bag.get("grenade", 0)) == n0 + 1, "куплена граната")
	game.hud.hide_panel()
	# в стабе не бросают
	if game.loc == "stab":
		fail += _check(not throw(), "в стабе граната не бросается")
	if Data.NODES.get(game.loc, {}).get("kind", "") != "cluster":
		game.enter("zarechny", null)
		await _wait(0.4)
	var p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	await _wait(0.6)
	# бегун в 7 м (стоит на месте): граната к нему, взрыв через 2 с
	var z = game.spawn_enemy("runner", p.global_position + Vector3(0, 0, 7))
	z.set_physics_process(false)
	game.bag["grenade"] = 1
	var marks = game.get_node_or_null("marks")
	var sc0: int = int(marks.counts()["scorch"]) if marks != null else 0
	p.busy = 0.0
	var ok := throw(z.global_position)
	fail += _check(ok and int(game.bag.get("grenade", 0)) == 0, "граната брошена, осталось %d" % int(game.bag.get("grenade", 0)))
	await _wait(1.0)
	fail += _check(not flying.is_empty() and z.alive, "летит, ещё не взорвалась")
	await _wait(2.0)
	fail += _check(flying.is_empty() and not z.alive, "взрыв через 2 с: бегун в 7 м убит осколками")
	if marks != null:
		fail += _check(int(marks.counts()["scorch"]) > sc0, "гарь от взрыва на земле")
	if is_instance_valid(z):
		z.queue_free()
	# осколки задевают и своих: взрыв в 2 м от героя
	var hp1: float = p.hp
	explode(p.global_position + Vector3(2, 0, 0))
	fail += _check(p.hp < hp1, "взрыв в 2 м ранит героя: −%d" % int(hp1 - p.hp))
	# цель броска — ближайший заражённый
	var z2 = game.spawn_enemy("runner", p.global_position + Vector3(-0.6, 0, 0))
	z2.set_physics_process(false)
	fail += _check(nearest_target(p.global_position) == z2, "цель броска — ближайший заражённый")
	game.enemies.erase(z2)
	z2.queue_free()
	return fail
