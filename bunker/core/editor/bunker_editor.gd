@tool
extends EditorPlugin
## Bunker Editor — панель BunkerCore в редакторе Godot. Добавляет в открытую сцену готовые элементы без кода:
## помещение, дверь (обычная/гермодверь/двустворчатая), стену, лестницу, светильник, точку взаимодействия,
## зону, точку появления персонажа и любой предмет из каталога BCPrefabs (мебель, оборудование, техника …).
## Новый узел ставится перед камерой редактора (на пол под точкой взгляда), выделяется и сразу настраивается в
## инспекторе — размеры, проёмы, материалы пересобираются на лету. Кнопка «Собрать локацию в сцену» строит
## поверхность и бункер первой локации в отдельные .tscn для правки руками.

var dock: Control
var _filter: LineEdit
var _list: ItemList


func _enter_tree() -> void:
	dock = _make_dock()
	add_control_to_dock(DOCK_SLOT_RIGHT_UL, dock)


func _exit_tree() -> void:
	if dock:
		remove_control_from_docks(dock)
		dock.queue_free()


func _make_dock() -> Control:
	var v := VBoxContainer.new()
	v.name = "Bunker Editor"
	var t := Label.new()
	t.text = "BunkerCore — добавить в сцену"
	v.add_child(t)
	var g := GridContainer.new()
	g.columns = 2
	v.add_child(g)
	for b in [["Помещение", "room"], ["Дверь", "door"], ["Гермодверь", "blast"], ["Двустворчатая", "blast_double"],
			["Лестница", "stairs"], ["Светильник", "light"], ["Взаимодействие", "interact"], ["Зона", "zone"],
			["Точка появления", "spawn"], ["Рельеф", "terrain"]]:
		var btn := Button.new()
		btn.text = b[0]
		btn.pressed.connect(_add.bind(b[1]))
		g.add_child(btn)
	v.add_child(HSeparator.new())
	var l2 := Label.new()
	l2.text = "Предметы (каталог BCPrefabs):"
	v.add_child(l2)
	_filter = LineEdit.new()
	_filter.placeholder_text = "поиск…"
	_filter.text_changed.connect(func(_s): _fill())
	v.add_child(_filter)
	_list = ItemList.new()
	_list.custom_minimum_size = Vector2(0, 300)
	_list.size_flags_vertical = Control.SIZE_EXPAND_FILL
	_list.item_activated.connect(_add_prefab)
	v.add_child(_list)
	var add := Button.new()
	add.text = "Поставить выбранный предмет"
	add.pressed.connect(func():
		var s := _list.get_selected_items()
		if s.size() > 0:
			_add_prefab(s[0]))
	v.add_child(add)
	v.add_child(HSeparator.new())
	var bake := Button.new()
	bake.text = "Собрать локацию в сцену (.tscn)"
	bake.pressed.connect(_bake)
	v.add_child(bake)
	_fill()
	return v


func _fill() -> void:
	if _list == null:
		return
	_list.clear()
	var f := _filter.text.to_lower() if _filter else ""
	var ids := BCPrefabs.CATALOG.keys()
	ids.sort_custom(func(a, b): return BCPrefabs.CATALOG[a].cat + a < BCPrefabs.CATALOG[b].cat + b)
	for id in ids:
		var it: Dictionary = BCPrefabs.CATALOG[id]
		var label := "%s · %s" % [it.cat, it.n]
		if f != "" and not (label.to_lower().contains(f) or id.contains(f)):
			continue
		var i := _list.add_item(label)
		_list.set_item_metadata(i, id)


func _scene_root() -> Node:
	return get_editor_interface().get_edited_scene_root()


## точка на полу перед камерой редактора
func _drop_point() -> Vector3:
	var vp := get_editor_interface().get_editor_viewport_3d(0)
	var cam := vp.get_camera_3d() if vp else null
	if cam == null:
		return Vector3.ZERO
	var o := cam.global_position
	var d := -cam.global_transform.basis.z
	if absf(d.y) > 0.01:
		var t := -o.y / d.y
		if t > 0.0 and t < 200.0:
			return (o + d * t).snapped(Vector3(0.1, 0.1, 0.1))
	return (o + d * 5.0).snapped(Vector3(0.1, 0.1, 0.1))


func _put(n: Node3D, nm: String) -> void:
	var root := _scene_root()
	if root == null:
		push_warning("Bunker Editor: откройте 3D-сцену")
		return
	var parent: Node = root
	var sel := get_editor_interface().get_selection().get_selected_nodes()
	if sel.size() == 1 and sel[0] is Node3D and not (sel[0] is BCProp or sel[0] is BCDoor):
		parent = sel[0]
	var ur := get_undo_redo()
	ur.create_action("Bunker Editor: " + nm)
	ur.add_do_method(parent, "add_child", n, true)
	ur.add_do_method(n, "set_owner", root)
	ur.add_do_property(n, "global_position", _drop_point())
	ur.add_do_reference(n)
	ur.add_undo_method(parent, "remove_child", n)
	ur.commit_action()
	n.name = nm
	get_editor_interface().get_selection().clear()
	get_editor_interface().get_selection().add_node(n)


func _add(kind: String) -> void:
	match kind:
		"room":
			var r := BCRoom.new()
			r.size = Vector3(5, 3, 4)
			r.openings = PackedStringArray(["s:0:1.0"])
			_put(r, "Room")
		"door", "blast", "blast_double":
			var d := BCDoor.new()
			d.kind = "interior" if kind == "door" else kind
			d.width = {"door": 0.95, "blast": 1.15, "blast_double": 2.6}[kind]
			_put(d, "Door")
		"stairs":
			_put(BCStairs.new(), "Stairs")
		"light":
			_put(BCLight.new(), "Light")
		"interact":
			_put(BCInteract.new(), "Interact")
		"zone":
			_put(BCZone.new(), "Zone")
		"spawn":
			var m := Marker3D.new()
			m.add_to_group("bc_spawn")
			_put(m, "Spawn")
		"terrain":
			_put(BCTerrain.new(), "Terrain")


func _add_prefab(i: int) -> void:
	var id: String = _list.get_item_metadata(i)
	var p := BCProp.new()
	p.prefab = id
	_put(p, id.capitalize().replace(" ", ""))


## собрать первую локацию в сцены game/locations/surface.tscn и bunker.tscn (для ручной правки)
func _bake() -> void:
	for which in ["surface", "bunker"]:
		var root := Node3D.new()
		root.name = which.capitalize()
		var built: Node3D = Locations.build_surface(root) if which == "surface" else Locations.build_bunker(root)
		_own(root, root)
		var ps := PackedScene.new()
		ps.pack(root)
		var path := "res://game/locations/%s.tscn" % which
		ResourceSaver.save(ps, path)
		root.free()
		print("Bunker Editor: сохранено ", path)
	get_editor_interface().get_resource_filesystem().scan()


func _own(n: Node, root: Node) -> void:
	for c in n.get_children():
		if c.has_meta("bc_gen"):
			continue
		c.owner = root
		_own(c, root)
