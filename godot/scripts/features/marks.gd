extends Node
## Следы боя (как game/marks.js браузерной игры): брызги крови от попаданий (вытянуты от стрелка), лужи под
## убитыми (растекаются секунды четыре), гарь от взрывов. Не тают со временем: держатся, пока кластер не
## перезагрузится (сохраняются с ним — snapshot/restore), в стабе — пока герой там; после перезагрузки чисто.
## Рисуются пачками: один вид следа — один MultiMesh (одна команда видеокарте), сколько бы их ни было; если
## следов больше предела, самые старые уступают место новым.
## Брызги: у заражённых — по убыли здоровья (пули, топор, осколки), у остальных (муры) — по сигналу enemy_hit;
## бочки и прочее с no_blood не кровоточат. Лужи — по сигналу enemy_killed, гарь — on_explosion.

## Сколько следов каждого вида держится разом.
const CAPS := {"splat": 600, "pool": 160, "scorch": 40}
## Высота над землёй (гарь — под кровью) и порядок отрисовки.
const LIFT := {"scorch": 0.05, "pool": 0.055, "splat": 0.06}
const GROW := 4.0


## Пачка одного вида: MultiMesh на CAPS мест, записи [x, z, поворот, размер по x, размер по z] по местам;
## когда места кончились, новая запись встаёт на место самой старой.
class Pool:
	var mm: MultiMesh
	var cap := 0
	var y := 0.0
	var recs: Array = []
	var head := 0

	func add(rec: Array) -> int:
		var slot := recs.size()
		if slot < cap:
			recs.append(rec)
		else:
			slot = head
			recs[slot] = rec
			head = (head + 1) % cap
		mm.visible_instance_count = recs.size()
		put(slot, 1.0)
		return slot

	func put(slot: int, k: float) -> void:
		var r: Array = recs[slot]
		var basis := Basis(Vector3.UP, float(r[2])) * Basis.from_scale(Vector3(float(r[3]) * k, 1.0, float(r[4]) * k))
		mm.set_instance_transform(slot, Transform3D(basis, Vector3(float(r[0]), y, float(r[1]))))

	func clear() -> void:
		recs = []
		head = 0
		mm.visible_instance_count = 0

	## От старых к новым.
	func ordered() -> Array:
		if recs.size() < cap:
			return recs
		return recs.slice(head) + recs.slice(0, head)


var game: Node
var pools := {}
## Растекающиеся лужи: [место, запись, время].
var growing: Array = []
## Здоровье заражённых на прошлом кадре (по id узла): убыло — брызги.
var last_hp := {}


func setup(g: Node) -> void:
	game = g
	_pool("scorch", _texture("scorch", 64), 1.0, 0)
	_pool("pool", _texture("pool", 96), 0.22, 1)
	_pool("splat", _texture("splat", 64), 0.25, 2)
	game.connect("enemy_hit", _on_hit)
	game.connect("enemy_killed", _on_killed)


func _pool(kind: String, tex: Texture2D, rough: float, order: int) -> void:
	var m := StandardMaterial3D.new()
	m.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	m.albedo_texture = tex
	m.roughness = rough
	m.metallic_specular = 0.6 if kind != "scorch" else 0.2
	m.render_priority = order
	var plane := PlaneMesh.new()
	plane.size = Vector2(1, 1)
	var mm := MultiMesh.new()
	mm.transform_format = MultiMesh.TRANSFORM_3D
	mm.mesh = plane
	mm.instance_count = int(CAPS[kind])
	mm.visible_instance_count = 0
	var mmi := MultiMeshInstance3D.new()
	mmi.name = "Marks_" + kind
	mmi.multimesh = mm
	mmi.material_override = m
	mmi.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
	# следы по всей локации: одна пачка — один вызов, отсекать нечего
	mmi.custom_aabb = AABB(Vector3(-100, -1, -100), Vector3(200, 4, 200))
	add_child(mmi)
	var p := Pool.new()
	p.mm = mm
	p.cap = int(CAPS[kind])
	p.y = float(LIFT[kind])
	pools[kind] = p


## Пятно: лужа с каплями, брызги (основное пятно сзади, капли летят по +X) или мягкая гарь.
func _texture(kind: String, size: int) -> ImageTexture:
	var data := PackedByteArray()
	data.resize(size * size * 4)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(kind)
	var col := Color(0.055, 0.048, 0.04) if kind == "scorch" else Color(0.3, 0.015, 0.015)
	var base := 0.78 if kind == "scorch" else 0.6 if kind == "pool" else 0.36
	var shift := 0.3 if kind == "splat" else 0.0
	var soft := 0.28 if kind == "scorch" else 0.05
	var opacity := 0.82 if kind == "scorch" else 0.93
	var ph := PackedFloat32Array([rng.randf() * TAU, rng.randf() * TAU, rng.randf() * TAU])
	# капли: x, y, радиус
	var drops := PackedFloat32Array()
	var nd := 7 if kind == "pool" else 11 if kind == "splat" else 0
	for i in nd:
		var a := rng.randf_range(-0.55, 0.55) if kind == "splat" else rng.randf() * TAU
		var r := rng.randf_range(0.2, 0.92) if kind == "splat" else rng.randf_range(0.62, 0.9)
		drops.append(cos(a) * r)
		drops.append(sin(a) * r)
		drops.append(rng.randf_range(0.03, 0.075))
	for py in size:
		for px in size:
			var u := (float(px) + 0.5) / size * 2.0 - 1.0
			var v := (float(py) + 0.5) / size * 2.0 - 1.0
			var uu := u + shift
			var r := sqrt(uu * uu + v * v)
			var a := atan2(v, uu)
			var edge := base * (1.0 + 0.12 * sin(3.0 * a + ph[0]) + 0.08 * sin(5.0 * a + ph[1]) + 0.05 * sin(11.0 * a + ph[2]))
			var al := clampf((edge - r) / soft, 0.0, 1.0)
			for i in range(0, drops.size(), 3):
				var dd := Vector2(u - drops[i], v - drops[i + 1]).length()
				al = maxf(al, clampf((drops[i + 2] - dd) / 0.02, 0.0, 1.0))
			# к середине темнее — кровь свернулась, гарь гуще
			var shade := 1.0 - 0.35 * clampf(1.0 - r / edge, 0.0, 1.0)
			var o := (int(py) * size + int(px)) * 4
			data[o] = int(col.r * shade * 255.0)
			data[o + 1] = int(col.g * shade * 255.0)
			data[o + 2] = int(col.b * shade * 255.0)
			data[o + 3] = int(al * opacity * 255.0)
	var img := Image.create_from_data(size, size, false, Image.FORMAT_RGBA8, data)
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)


# ---------- Следы ----------


## Брызги: size — размер, dir — куда летели капли (пятно вытягивается по ходу).
func splat(pos: Vector3, size: float, dir := Vector3.ZERO) -> void:
	var ry := randf() * TAU
	var stretch := 1.0
	if Vector2(dir.x, dir.z).length() > 0.1:
		ry = atan2(-dir.z, dir.x)
		stretch = 1.5
	pools["splat"].add([pos.x, pos.z, ry, size * stretch * randf_range(0.8, 1.2), size * randf_range(0.7, 1.1)])


## Лужа под убитым: растекается от пятнышка до size за четыре секунды (grown — сразу растёкшаяся).
func pool(pos: Vector3, size: float, grown := false) -> void:
	var rec := [pos.x, pos.z, randf() * TAU, size, size]
	var slot: int = pools["pool"].add(rec)
	if not grown:
		pools["pool"].put(slot, 0.2)
		growing.append([slot, rec, 0.0])


## Выжженное пятно от взрыва.
func scorch(pos: Vector3) -> void:
	var s := randf_range(2.9, 3.5)
	pools["scorch"].add([pos.x, pos.z, randf() * TAU, s, s])


## Всё смыть: другая локация или перезагрузка кластера.
func clear() -> void:
	for k in pools:
		pools[k].clear()
	growing.clear()
	last_hp.clear()


func counts() -> Dictionary:
	var out := {}
	for k in pools:
		out[k] = pools[k].recs.size()
	return out


# ---------- События ----------


func on_leave() -> void:
	clear()


func on_explosion(pos: Vector3, _radius: float) -> void:
	scorch(pos)


## Для сохранения кластера: {вид: [[x, z, поворот, sx, sz], ...]} от старых к новым, с точностью до сантиметра.
func snapshot() -> Dictionary:
	var out := {}
	for k in pools:
		var list := []
		for r in pools[k].ordered():
			var row := []
			for v in r:
				row.append(snappedf(float(v), 0.01))
			list.append(row)
		if not list.is_empty():
			out[k] = list
	return out


## Следы, какими их оставили (лужи — сразу растёкшиеся).
func restore(d: Dictionary) -> void:
	clear()
	for k in d:
		if not pools.has(k) or typeof(d[k]) != TYPE_ARRAY:
			continue
		var list: Array = d[k]
		var cap: int = pools[k].cap
		for r in list.slice(maxi(0, list.size() - cap)):
			if typeof(r) == TYPE_ARRAY and r.size() >= 5:
				pools[k].add([float(r[0]), float(r[1]), float(r[2]), float(r[3]), float(r[4])])


## Капли летят от героя (он стреляет и рубит), падают за раненым.
func _bleed(pos: Vector3, dmg: float) -> void:
	var dir := Vector3.ZERO
	var p = game.player
	if p != null and is_instance_valid(p):
		dir = pos - p.global_position
		dir.y = 0.0
		dir = dir.normalized() if dir.length() > 0.05 else Vector3.ZERO
	var n := 2 if dmg > 40.0 else 1
	for i in n:
		var off := dir * randf_range(0.2, 1.3) + Vector3(randf_range(-0.35, 0.35), 0, randf_range(-0.35, 0.35))
		splat(pos + off, randf_range(0.22, 0.36) * (1.0 + minf(1.0, dmg / 80.0)), dir)


func _on_hit(target, at: Vector3) -> void:
	if target == null or not is_instance_valid(target) or game.enemies.has(target):
		return
	if target.get("is_barrel") or target.get("no_blood"):
		return
	_bleed(at, 25.0)


func _on_killed(target) -> void:
	if target == null or not is_instance_valid(target) or target.get("no_blood"):
		return
	var size := 1.4
	var t = target.get("T")
	if t is Dictionary:
		size = 1.25 * float(t.get("scale", 1.0)) + (0.3 if target.get("type") == "ruber" else 0.0)
	var pos: Vector3 = target.global_position
	pool(pos + Vector3(randf_range(-0.2, 0.2), 0, randf_range(-0.2, 0.2)), size)


func _process(delta: float) -> void:
	# лужи растекаются
	for g in growing.duplicate():
		g[2] = float(g[2]) + delta
		var slot: int = g[0]
		var p: Pool = pools["pool"]
		if slot >= p.recs.size() or not is_same(p.recs[slot], g[1]):
			growing.erase(g)
			continue
		var t := float(g[2]) / GROW
		if t >= 1.0:
			p.put(slot, 1.0)
			growing.erase(g)
		else:
			p.put(slot, 0.2 + 0.8 * (1.0 - (1.0 - t) * (1.0 - t)))
	# брызги: у кого из заражённых убыло здоровье
	for e in game.enemies:
		if not is_instance_valid(e) or not e.alive:
			continue
		var id: int = e.get_instance_id()
		var h: float = e.hp
		var was: float = last_hp.get(id, h)
		if h < was - 0.5:
			_bleed(e.global_position, was - h)
		last_hp[id] = h
	if last_hp.size() > game.enemies.size() * 2 + 32:
		last_hp.clear()


# ---------- Автотест ----------


func _check(ok: bool, msg: String) -> int:
	print(("✓ " if ok else "✗ ") + msg)
	return 0 if ok else 1


func _wait(secs: float) -> void:
	await get_tree().create_timer(secs).timeout


func _total() -> int:
	var c := counts()
	return int(c["splat"]) + int(c["pool"]) + int(c["scorch"])


func smoke() -> int:
	var fail := 0
	if game.loc != "zarechny":
		game.enter("zarechny", null)
		await _wait(0.4)
	game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 1000.0
	var p = game.player
	p.max_hp = 100000.0
	p.hp = 100000.0
	var c0 := counts()
	var z = game.spawn_enemy("runner", p.global_position + Vector3(2.5, 0, 0))
	z.set_physics_process(false)
	await _wait(0.1)
	z.damage(25.0, p.global_position)
	await _wait(0.2)
	fail += _check(int(counts()["splat"]) > int(c0["splat"]), "брызги крови от попадания: %d → %d" % [c0["splat"], counts()["splat"]])
	z.damage(1000.0, p.global_position)
	await _wait(0.2)
	fail += _check(int(counts()["pool"]) > int(c0["pool"]), "лужа крови под убитым")
	scorch(p.global_position + Vector3(-3, 0, 0))
	var c1 := counts()
	# стаб — следов нет; вернулся в кластер — следы на месте
	game.snapshot()
	game.enter("stab", "zarechny")
	await _wait(0.3)
	fail += _check(_total() == 0, "в стабе следов нет")
	game.enter("zarechny", "stab")
	await _wait(0.3)
	var c2 := counts()
	fail += _check(c2["pool"] == c1["pool"] and c2["splat"] == c1["splat"] and c2["scorch"] == c1["scorch"], "после возвращения следы на месте: лужи %d, брызги %d, гарь %d" % [c2["pool"], c2["splat"], c2["scorch"]])
	# кластер перезагрузился — чисто
	game.snapshot()
	game.enter("stab", "zarechny")
	await _wait(0.2)
	game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 0.01
	game.advance(0.05)
	game.enter("zarechny", "stab")
	await _wait(0.3)
	fail += _check(_total() == 0, "после перезагрузки кластера чисто")
	game.world["clusters"]["zarechny"]["next"] = float(game.world["time"]) + 1000.0
	return fail
