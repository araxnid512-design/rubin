class_name BCKit
## Общие помощники BunkerCore для построения мира: статические тела с коллизиями, датчики взаимодействия.

const LAYER_WORLD := 1
const LAYER_PLAYER := 2
const LAYER_INTERACT := 4
const LAYER_ZONES := 8
const LAYER_NPC := 16
const LAYER_DETAIL := 32       ## точная геометрия для постановки стоп (IK), персонаж по ней не ходит


## статическое тело с коробчатыми коллизиями; boxes — [[размер, центр], ...] в координатах parent
static func static_boxes(parent: Node3D, boxes: Array, name := "Col") -> StaticBody3D:
	var sb := StaticBody3D.new()
	sb.name = name
	sb.collision_layer = LAYER_WORLD
	sb.collision_mask = 0
	parent.add_child(sb)
	for b in boxes:
		var cs := CollisionShape3D.new()
		var sh := BoxShape3D.new()
		sh.size = b[0]
		cs.shape = sh
		cs.position = b[1]
		if b.size() > 2:
			cs.rotation = b[2]
		sb.add_child(cs)
	return sb


## датчик взаимодействия: Area3D на слое «interact», ссылается на объект target (у него методы
## interact_label(), can_interact(p), interact(p))
static func sensor(parent: Node3D, target: Object, size: Vector3, offset := Vector3.ZERO) -> Area3D:
	var a := Area3D.new()
	a.name = "Sensor"
	a.collision_layer = LAYER_INTERACT
	a.collision_mask = 0
	a.monitoring = false
	a.monitorable = true
	a.set_meta("bc_target", target)
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = size
	cs.shape = sh
	cs.position = offset
	a.add_child(cs)
	parent.add_child(a)
	return a


## меш-экземпляр по сборщику, добавленный в parent
static func add_mesh(parent: Node3D, mk: BCMesh, name := "Mesh", shadows := true) -> MeshInstance3D:
	if mk.is_empty():
		return null
	var mi := mk.to_instance(shadows)
	mi.name = name
	parent.add_child(mi)
	return mi


## для генерации в редакторе: владелец сцены, чтобы созданные узлы сохранялись (не нужно — мы строим заново
## при каждой загрузке, поэтому узлы-детки помечаются как внутренние и не пишутся в .tscn)
static func clear_generated(node: Node) -> void:
	for c in node.get_children():
		if c.has_meta("bc_gen"):
			node.remove_child(c)
			c.queue_free()


static func mark(n: Node) -> Node:
	n.set_meta("bc_gen", true)
	return n
