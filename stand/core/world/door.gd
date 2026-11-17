class_name ULDoor
extends StaticBody3D
## Дверь в проёме: полотно на петлях поворачивается на 95°; закрытая — преграда для героя, врагов и пуль
## (слой столкновений 2: карта проходимости строится без дверей, путь идёт через проём), открытая — нет.
## Открывается, когда к ней подходит герой или гонящийся враг (ULSanatorium._doors_tick). Не закрывается сама.

const LAYER := 2
var pivot: Node3D
var panel: MeshInstance3D
var shape: CollisionShape3D
var open := false
var center := Vector3.ZERO        ## середина проёма (мир)
var width := 1.0
var bld := -1                     ## корпус и этаж (для видимости и срезки стен)
var floor_i := 0
var _a := 0.0
var _target := 0.0
var _swing := 1.0


## w — ширина проёма, h — высота; along — направление стены (мир, единичный), into — куда открывается (мир)
func setup(at: Vector3, along: Vector3, into: Vector3, w: float, h: float, mat: Material, start_open: bool) -> void:
	center = at
	width = w
	collision_layer = LAYER
	collision_mask = 0
	position = at
	basis = Basis(along, Vector3.UP, along.cross(Vector3.UP))
	# полотно — от петли (левый край проёма) по стене; поворот вокруг вертикали
	_swing = 1.0 if along.cross(Vector3.UP).dot(into) < 0.0 else -1.0
	pivot = Node3D.new()
	pivot.position = Vector3(-w * 0.5 + 0.02, 0, 0)
	add_child(pivot)
	panel = MeshInstance3D.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var bm := BoxMesh.new()
	bm.size = Vector3(w - 0.05, h - 0.03, 0.045)
	st.append_from(bm, 0, Transform3D(Basis(), Vector3((w - 0.05) * 0.5, (h - 0.03) * 0.5 + 0.01, 0)))
	bm.size = Vector3(0.12, 0.03, 0.06)            # ручка
	st.append_from(bm, 0, Transform3D(Basis(), Vector3(w - 0.17, 1.0, 0)))
	panel.mesh = st.commit()
	panel.material_override = mat
	panel.layers = 2
	pivot.add_child(panel)
	shape = CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(w, h, 0.12)
	shape.shape = bs
	shape.position = Vector3(0, h * 0.5, 0)
	add_child(shape)
	if start_open:
		open = true
		_a = _swing * deg_to_rad(randf_range(70.0, 100.0))
		_target = _a
		pivot.rotation.y = _a
		shape.disabled = true


func set_open(v: bool) -> void:
	if v == open:
		return
	open = v
	_target = _swing * deg_to_rad(95.0) if v else 0.0
	shape.set_deferred("disabled", v)


## поворот полотна; false — дверь остановилась
func tick(delta: float) -> bool:
	_a = move_toward(_a, _target, delta * 5.5)
	pivot.rotation.y = _a
	return absf(_a - _target) > 0.001
