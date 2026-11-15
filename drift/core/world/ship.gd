class_name STShip
extends Node2D
## Корабль StarCore: отсеки на сетке клеток (1 клетка = 1×1 м = 64×45 px), стены, двери, свет, столкновения,
## маршруты (AStarGrid2D). Описание — JSON: {name, rooms:[{id, n, r:[x,y,w,h], kind, light}], doors:[[x,y]],
## dock:[x,y] — стыковочный люк}. Отсеки разделены стеной в одну клетку; дверь — клетка стены, ставшая проходом.
## Вид сверху под углом: стены между отсеками — низкие (в разрезе, видно внутренность), внешние северные — во
## всю высоту. Пол отсека — один повторяющийся спрайт (один вызов отрисовки). Всё лишнее — без света.
## Тайлы — assets/tiles/<вид>.png + <вид>_n.png (карта нормалей); нет файла — рисуется заглушка кодом.

const LOW := 40.0             ## высота низкой (разрезанной) стены на экране, px (~0.9 м)

var data := {}
var cells := {}               ## Vector2i → "floor" / "wall" / "door"
var room_of := {}             ## Vector2i → id отсека
var rooms := {}               ## id → описание
var astar := AStarGrid2D.new()
var floor_layer: Node2D       ## пол (без сортировки)
var ysort: Node2D             ## стены, предметы, персонажи — сортировка по высоте экрана
var bounds := Rect2i()
var doors := {}               ## Vector2i → STDoor
var lights := {}              ## id отсека → PointLight2D
var _tex := {}
var blocked := {}             ## клетки, занятые предметами и турелями (непроходимы для маршрутов)
var _attached := []           ## узлы пристыкованной конструкции (для отстыковки)
var _attached_cells := []     ## клетки пристыкованной конструкции
var _build_into: Array = []   ## куда записывать созданные узлы (для отстыковки)


func build(d: Dictionary, parent_ysort: Node2D) -> void:
	data = d
	ysort = parent_ysort
	floor_layer = Node2D.new()
	floor_layer.name = "Floor"
	floor_layer.z_index = -10
	add_child(floor_layer)
	# клетки пола
	for r in d.get("rooms", []):
		rooms[r.id] = r
		var rr: Array = r.r
		for x in range(int(rr[0]), int(rr[0]) + int(rr[2])):
			for y in range(int(rr[1]), int(rr[1]) + int(rr[3])):
				cells[Vector2i(x, y)] = "floor"
				room_of[Vector2i(x, y)] = r.id
	# стены вокруг пола
	var walls := {}
	for c in cells.keys():
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				var n: Vector2i = c + Vector2i(dx, dy)
				if not cells.has(n):
					walls[n] = true
	for w in walls:
		cells[w] = "wall"
	for dc in d.get("doors", []) + ([d.dock] if d.has("dock") else []):
		var c := Vector2i(int(dc[0]), int(dc[1]))
		cells[c] = "door"
	_calc_bounds()
	_build_floors()
	_build_walls()
	_build_doors()
	_build_lights()
	_build_astar()
	if doors.has(dock_cell()):
		doors[dock_cell()].set_locked(true)
		doors[dock_cell()].hatch = true


func _calc_bounds() -> void:
	var mn := Vector2i(999, 999)
	var mx := Vector2i(-999, -999)
	for c in cells:
		mn = Vector2i(mini(mn.x, c.x), mini(mn.y, c.y))
		mx = Vector2i(maxi(mx.x, c.x), maxi(mx.y, c.y))
	bounds = Rect2i(mn, mx - mn + Vector2i.ONE)


func is_walkable(c: Vector2i) -> bool:
	var t: String = cells.get(c, "")
	return t == "floor" or (t == "door" and doors.has(c) and not doors[c].locked)


func room_at(p: Vector2) -> String:
	return room_of.get(SP.px_to_cell(p), "")


func room_center(id: String) -> Vector2:
	var rr: Array = rooms[id].r
	return Vector2((rr[0] + rr[2] * 0.5) * SP.TILE.x, (rr[1] + rr[3] * 0.5) * SP.TILE.y)


func room_rect_px(id: String) -> Rect2:
	var rr: Array = rooms[id].r
	return Rect2(rr[0] * SP.TILE.x, rr[1] * SP.TILE.y, rr[2] * SP.TILE.x, rr[3] * SP.TILE.y)


# ---------------- текстуры ----------------

## тайл по виду: файл из assets/tiles (с картой нормалей) или заглушка
func tex(kind: String) -> Texture2D:
	if _tex.has(kind):
		return _tex[kind]
	var p := "res://assets/tiles/%s.png" % kind
	var t: Texture2D
	if ResourceLoader.exists(p):
		var ct := CanvasTexture.new()
		ct.diffuse_texture = load(p)
		var np := "res://assets/tiles/%s_n.png" % kind
		if ResourceLoader.exists(np):
			ct.normal_texture = load(np)
		ct.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
		t = ct
	else:
		t = _placeholder(kind)
	_tex[kind] = t
	return t


func _placeholder(kind: String) -> Texture2D:
	var w := 64
	var h := 45
	var base := Color(0.2, 0.22, 0.25)
	var line := Color(0.13, 0.14, 0.16)
	match kind:
		"floor_bridge": base = Color(0.18, 0.22, 0.28)
		"floor_reactor": base = Color(0.22, 0.2, 0.18)
		"floor_corridor": base = Color(0.17, 0.18, 0.2)
		"floor_med": base = Color(0.26, 0.28, 0.3)
		"floor_airlock": base = Color(0.22, 0.21, 0.17)
		"floor_derelict": base = Color(0.16, 0.17, 0.17)
		"floor_pirate": base = Color(0.22, 0.15, 0.14)
		"floor_rock": base = Color(0.24, 0.2, 0.17)
		"floor_station": base = Color(0.2, 0.24, 0.26)
		"wall_face": base = Color(0.3, 0.33, 0.37); h = int(LOW)
		"wall_face_tall": base = Color(0.28, 0.31, 0.36); h = int(SP.WALL_H)
		"wall_cap": base = Color(0.42, 0.45, 0.5)
	if kind.ends_with("_rock"):
		base = Color(0.36, 0.3, 0.25) if kind.begins_with("wall_cap") else Color(0.27, 0.22, 0.18)
		h = int(SP.WALL_H) if kind.begins_with("wall_face_tall") else (int(LOW) if kind.begins_with("wall_face") else h)
	var img := Image.create(w, h, false, Image.FORMAT_RGBA8)
	img.fill(base)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(kind)
	if kind.ends_with("_rock"):
		for i in w * h / 3:
			var px := rng.randi_range(0, w - 1)
			var py := rng.randi_range(0, h - 1)
			img.set_pixel(px, py, base.lightened(rng.randf_range(-0.18, 0.15)))
		if kind.begins_with("wall_face"):
			for x in w:
				img.set_pixel(x, 0, base.lightened(0.2))
		return ImageTexture.create_from_image(img)
	if kind == "floor_rock":
		for i in 220:
			var px := rng.randi_range(0, w - 1)
			var py := rng.randi_range(0, h - 1)
			img.set_pixel(px, py, base.lightened(rng.randf_range(-0.15, 0.12)))
	elif kind.begins_with("floor"):
		for x in w:
			img.set_pixel(x, 0, line)
		for y in h:
			img.set_pixel(0, y, line)
		for i in 40:
			var px := rng.randi_range(2, w - 3)
			var py := rng.randi_range(2, h - 3)
			img.set_pixel(px, py, base.lightened(rng.randf_range(-0.08, 0.08)))
		for k in 4:
			img.set_pixel(5 + (k % 2) * (w - 11), 5 + (k / 2) * (h - 11), line.lightened(0.3))
	elif kind.begins_with("wall_face"):
		for x in w:
			img.set_pixel(x, 0, base.lightened(0.25))
			img.set_pixel(x, h - 1, line)
		for y in h:
			img.set_pixel(0, y, line)
		if kind == "wall_face_tall":
			for y in range(18, 26):
				for x in range(6, 58):
					img.set_pixel(x, y, Color(0.12, 0.14, 0.16))
			for x in range(10, 54, 6):
				img.set_pixel(x, 60, Color(0.9, 0.6, 0.2))
	elif kind == "wall_cap":
		for x in w:
			img.set_pixel(x, 0, base.lightened(0.2))
			img.set_pixel(x, h - 1, line)
	var t := ImageTexture.create_from_image(img)
	return t


## повторяющийся спрайт: прямоугольник rect в координатах корабля; parent — узел, к которому он крепится
## (его положение — точка сортировки, например основание стены)
func _strip(t: Texture2D, rect: Rect2, parent: Node2D) -> Sprite2D:
	var s := Sprite2D.new()
	s.texture = t
	s.centered = false
	s.region_enabled = true
	s.region_rect = Rect2(Vector2.ZERO, rect.size)
	s.texture_repeat = CanvasItem.TEXTURE_REPEAT_ENABLED
	s.position = rect.position - parent.position
	parent.add_child(s)
	_track(s)
	return s


# ---------------- постройка ----------------

func _build_floors() -> void:
	for id in rooms:
		var r: Dictionary = rooms[id]
		var kind: String = "floor_" + String(r.get("kind", "corridor"))
		var rect := room_rect_px(id)
		_strip(tex(kind), rect, floor_layer)
	# пол под дверями
	for c in cells:
		if cells[c] == "door":
			var p := Vector2(c.x * SP.TILE.x, c.y * SP.TILE.y)
			_strip(tex("floor_corridor"), Rect2(p, SP.TILE), floor_layer)


func _build_walls(only: Dictionary = {}, style := "") -> void:
	var body := StaticBody2D.new()
	body.name = "Walls"
	body.collision_layer = 1
	add_child(body)
	_track(body)
	# стены — горизонтальными отрезками одного вида (меньше узлов и вызовов)
	var wall_cells := []
	for c in cells:
		if cells[c] == "wall" and (only.is_empty() or only.has(c)):
			wall_cells.append(c)
			var cs := CollisionShape2D.new()
			var sh := RectangleShape2D.new()
			sh.size = SP.TILE
			cs.shape = sh
			cs.position = SP.cell_to_px(c)
			body.add_child(cs)
	wall_cells.sort_custom(func(a, b): return a.y < b.y or (a.y == b.y and a.x < b.x))
	var i := 0
	while i < wall_cells.size():
		var c: Vector2i = wall_cells[i]
		var tall := _tall(c)
		var face := _face(c)
		var j := i + 1
		while j < wall_cells.size():
			var n: Vector2i = wall_cells[j]
			if n.y != c.y or n.x != wall_cells[j - 1].x + 1 or _tall(n) != tall or _face(n) != face:
				break
			j += 1
		var n_cells := j - i
		var x0 := c.x * SP.TILE.x
		var w := n_cells * SP.TILE.x
		var base := (c.y + 1) * SP.TILE.y
		var hgt := SP.WALL_H if tall else LOW
		# узел у основания стены — по нему сортировка с персонажами; верх стены и видимая лицевая сторона
		var holder := Node2D.new()
		holder.position = Vector2(x0, base)
		ysort.add_child(holder)
		_track(holder)
		_strip(tex("wall_cap" + style), Rect2(x0, c.y * SP.TILE.y - hgt, w, SP.TILE.y), holder)
		if face:
			_strip(tex(("wall_face_tall" if tall else "wall_face") + style), Rect2(x0, base - hgt, w, hgt), holder)
		i = j


## стена во всю высоту: снаружи корабля к северу нет пола (внешний борт, его видно «изнутри»)
func _tall(c: Vector2i) -> bool:
	return not cells.has(c + Vector2i(0, -1)) and (cells.get(c + Vector2i(0, 1), "") == "floor")


## видна лицевая сторона: южнее — не стена
func _face(c: Vector2i) -> bool:
	var s: String = cells.get(c + Vector2i(0, 1), "")
	return s != "wall"


func _build_doors(list: Array = []) -> void:
	for c in (list if not list.is_empty() else cells.keys()):
		if cells[c] != "door":
			continue
		var d := STDoor.new()
		d.cell = c
		d.horizontal = cells.get(c + Vector2i(-1, 0), "") == "wall" or cells.get(c + Vector2i(1, 0), "") == "wall"
		d.position = Vector2(SP.cell_to_px(c).x, (c.y + 1) * SP.TILE.y)
		ysort.add_child(d)
		_track(d)
		doors[c] = d


func _build_lights(only: Array = []) -> void:
	var grad := Gradient.new()
	grad.set_color(0, Color(1, 1, 1, 1))
	grad.set_color(1, Color(1, 1, 1, 0))
	var gt := GradientTexture2D.new()
	gt.gradient = grad
	gt.fill = GradientTexture2D.FILL_RADIAL
	gt.fill_from = Vector2(0.5, 0.5)
	gt.fill_to = Vector2(1.0, 0.5)
	gt.width = 256
	gt.height = 256
	for id in (only if not only.is_empty() else rooms.keys()):
		var r: Dictionary = rooms[id]
		var l := PointLight2D.new()
		l.texture = gt
		var rect := room_rect_px(id)
		l.texture_scale = maxf(rect.size.x, rect.size.y * 1.4) / 256.0 * 1.25
		l.position = rect.get_center() + Vector2(0, -20)
		var col: Array = r.get("light", [1.0, 0.92, 0.8])
		l.color = Color(col[0], col[1], col[2])
		l.energy = 1.1
		l.height = 60.0
		l.shadow_enabled = false
		add_child(l)
		_track(l)
		lights[id] = l


func _build_astar() -> void:
	astar.region = bounds
	astar.cell_size = SP.TILE
	astar.offset = SP.TILE * 0.5
	astar.diagonal_mode = AStarGrid2D.DIAGONAL_MODE_ONLY_IF_NO_OBSTACLES
	astar.update()
	for x in range(bounds.position.x, bounds.end.x):
		for y in range(bounds.position.y, bounds.end.y):
			var c := Vector2i(x, y)
			astar.set_point_solid(c, blocked.has(c) or not (cells.get(c, "") in ["floor", "door"]))
	for c in doors:
		if doors[c].locked and astar.is_in_boundsv(c):
			astar.set_point_solid(c, true)


## занять / освободить клетку (предмет, турель)
func block(c: Vector2i, on: bool) -> void:
	if on:
		blocked[c] = true
	else:
		blocked.erase(c)
	if astar.is_in_boundsv(c):
		astar.set_point_solid(c, on or not (cells.get(c, "") in ["floor", "door"]))


## ближайшая проходимая клетка (сама клетка или в радиусе 2)
func free_cell(c: Vector2i) -> Vector2i:
	if astar.is_in_boundsv(c) and not astar.is_point_solid(c):
		return c
	var best := Vector2i(-9999, -9999)
	var bd := 1e9
	for dx in range(-2, 3):
		for dy in range(-2, 3):
			var n := c + Vector2i(dx, dy)
			if astar.is_in_boundsv(n) and not astar.is_point_solid(n):
				var d := Vector2(dx * SP.TILE.x, dy * SP.TILE.y).length()
				if d < bd:
					bd = d
					best = n
	return best


## путь между точками экрана (точки — центры клеток); пусто — нет пути
func path(from: Vector2, to: Vector2) -> PackedVector2Array:
	var a := free_cell(SP.px_to_cell(from))
	var b := free_cell(SP.px_to_cell(to))
	if a.x == -9999 or b.x == -9999:
		return PackedVector2Array()
	return astar.get_point_path(a, b)


func _track(n: Node) -> void:
	for arr in _build_into:
		arr.append(n)


# ---------------- стыковка: чужая конструкция у люка ----------------
## Люк (data.dock) — запертая дверь во внешней стене. Конструкция события описана в клетках относительно люка
## (dx, dy; ниже люка — dy > 0): {rooms:[{id, n, r:[dx,dy,w,h], kind, light}], doors:[[dx,dy]]}. При стыковке её
## клетки добавляются к кораблю (новые стены — только там, где клеток ещё не было), люк отпирается; при
## отстыковке всё созданное убирается, люк запирается.

func dock_cell() -> Vector2i:
	var d: Array = data.get("dock", [0, 0])
	return Vector2i(int(d[0]), int(d[1]))


## клетка конструкции → клетка корабля
func dock_to_cell(dx: int, dy: int) -> Vector2i:
	return dock_cell() + Vector2i(dx, dy)


func attach(st: Dictionary) -> void:
	detach()
	var nodes := []
	_build_into = [nodes]
	var new_cells := {}
	var new_rooms := []
	for r0 in st.get("rooms", []):
		var r: Dictionary = r0.duplicate(true)
		var rr: Array = r.r
		var o := dock_to_cell(int(rr[0]), int(rr[1]))
		r.r = [o.x, o.y, int(rr[2]), int(rr[3])]
		rooms[r.id] = r
		new_rooms.append(r.id)
		for x in range(o.x, o.x + int(rr[2])):
			for y in range(o.y, o.y + int(rr[3])):
				var c := Vector2i(x, y)
				cells[c] = "floor"
				room_of[c] = r.id
				new_cells[c] = true
	var new_walls := {}
	for c in new_cells.keys():
		for dx in [-1, 0, 1]:
			for dy in [-1, 0, 1]:
				var n: Vector2i = c + Vector2i(dx, dy)
				if not cells.has(n):
					cells[n] = "wall"
					new_walls[n] = true
					new_cells[n] = true
	var new_doors := []
	for dc in st.get("doors", []):
		var c := dock_to_cell(int(dc[0]), int(dc[1]))
		if cells.get(c, "") == "wall" and new_cells.has(c):
			cells[c] = "door"
			new_walls.erase(c)
			new_doors.append(c)
	for id in new_rooms:
		_strip(tex("floor_" + String(rooms[id].get("kind", "derelict"))), room_rect_px(id), floor_layer)
	for c in new_doors:
		var p := Vector2(c.x * SP.TILE.x, c.y * SP.TILE.y)
		_strip(tex("floor_corridor"), Rect2(p, SP.TILE), floor_layer)
	_build_walls(new_walls, String(st.get("walls", "")))
	_build_doors(new_doors)
	_build_lights(new_rooms)
	_attached = nodes
	_attached_cells = new_cells.keys()
	_build_into = []
	_calc_bounds()
	_build_astar()
	if doors.has(dock_cell()):
		doors[dock_cell()].set_locked(false)


## отстыковаться: убрать узлы и клетки конструкции, запереть люк
func detach() -> void:
	if doors.has(dock_cell()):
		doors[dock_cell()].set_locked(true)
	if _attached_cells.is_empty():
		return
	for n in _attached:
		if is_instance_valid(n):
			n.queue_free()
	for c in _attached_cells:
		var rid: String = room_of.get(c, "")
		if rid != "":
			rooms.erase(rid)
			lights.erase(rid)
		cells.erase(c)
		room_of.erase(c)
		doors.erase(c)
		blocked.erase(c)
	_attached.clear()
	_attached_cells.clear()
	_calc_bounds()
	_build_astar()


func is_docked() -> bool:
	return not _attached_cells.is_empty()


## точка в пристыкованной конструкции (не на своём корабле)
func outside(p: Vector2) -> bool:
	return _attached_cells.has(SP.px_to_cell(p))


## клетка своего корабля, где можно стоять: пол, не у двери, не занята
func own_floor(c: Vector2i) -> bool:
	if cells.get(c, "") != "floor" or _attached_cells.has(c) or blocked.has(c):
		return false
	for dx in [-1, 0, 1]:
		for dy in [-1, 0, 1]:
			if cells.get(c + Vector2i(dx, dy), "") == "door":
				return false
	return true
