extends Node
## WorldSystem — мир BunkerCore.
##  * реестр объектов с состоянием (двери, свет, предметы): id → узел; состояние сохраняется и загружается;
##  * зоны (BCZone): где игрок — на поверхности, в шлюзе, в бункере, в постройке; переключение «внутри/снаружи»
##    (скрытие крыш и поверхности над бункером, смена света и звуков);
##  * группы видимости: "surface_only" видны снаружи, "bunker_only" — внутри, "roof:<имя>" — крыши.

signal object_state_changed(id: String, state: Dictionary)

var objects := {}            ## id → узел с get_state()/set_state()
var pending_state := {}      ## состояние из сохранения для объектов, которые ещё не зарегистрированы
var zones: Array = []        ## активные зоны, где сейчас игрок (последняя — главная)
var current := {"kind": "surface", "name": "Поверхность", "rad": 0.0, "env": "surface"}
var underground := false
var world_root: Node3D = null


func register(id: String, node: Node) -> void:
	if id == "":
		return
	objects[id] = node
	if pending_state.has(id) and node.has_method("set_state"):
		node.set_state(pending_state[id])
		pending_state.erase(id)


func unregister(id: String) -> void:
	objects.erase(id)


func notify_state(id: String) -> void:
	var n = objects.get(id)
	if n and n.has_method("get_state"):
		object_state_changed.emit(id, n.get_state())


func collect_state() -> Dictionary:
	var out := {}
	for id in objects:
		var n = objects[id]
		if is_instance_valid(n) and n.has_method("get_state"):
			out[id] = n.get_state()
	return out


func apply_state(d: Dictionary) -> void:
	for id in d:
		var n = objects.get(id)
		if n and is_instance_valid(n) and n.has_method("set_state"):
			n.set_state(d[id])
		else:
			pending_state[id] = d[id]


# ---------- Зоны ----------

func enter_zone(z: Node) -> void:
	zones.erase(z)
	zones.append(z)
	_update_zone()


func exit_zone(z: Node) -> void:
	zones.erase(z)
	_update_zone()


func _update_zone() -> void:
	var z: Node = null
	# главная — с наибольшим приоритетом среди активных
	for c in zones:
		if is_instance_valid(c) and (z == null or c.zone_priority >= z.zone_priority):
			z = c
	var info := {"kind": "surface", "name": "Поверхность", "rad": -1.0, "env": "surface", "hide_surface": false, "roof": ""}
	if z:
		info = z.info()
	var was_under := underground
	underground = info.hide_surface
	current = info
	_apply_visibility(info)
	Core.zone_changed.emit(info)
	if was_under != underground and Core.env:
		Core.env.set_preset(info.env)
	elif Core.env:
		Core.env.set_preset(info.env)


## снаружи видна поверхность, внутри бункера — только бункер (поверхность над ним скрыта, иначе камера сверху
## видела бы землю); крыши построек скрываются, пока игрок в постройке
func _apply_visibility(info: Dictionary) -> void:
	var tree := get_tree()
	if tree == null:
		return
	for n in tree.get_nodes_in_group("surface_only"):
		n.visible = not info.hide_surface
	for n in tree.get_nodes_in_group("bunker_only"):
		n.visible = info.hide_surface or info.kind == "entrance"
	for n in tree.get_nodes_in_group("roof"):
		var tag: String = n.get_meta("roof_tag", "")
		# потолки бункера скрыты всегда, когда игрок под землёй; крыша постройки — когда игрок в ней
		n.visible = not (info.hide_surface or (tag != "" and tag == info.roof))
