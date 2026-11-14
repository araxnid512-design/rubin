@tool
class_name BCDoor
extends Node3D
## Дверь BunkerCore. Ставится в проём (начало — середина низа проёма, дверь закрывает проём по оси X узла,
## «наружу» — +Z). Виды:
##   interior     — стальная дверь 0.9×2.1 на петлях;
##   blast        — гермодверь 1.1×2.0 со штурвалом и знаком радиации, тяжёлая, открывается медленно;
##   blast_double — двустворчатая гермодверь (вход в бункер с поверхности), створки распахиваются наружу.
## Открытая дверь сдвигает свою коллизию вместе со створкой (AnimatableBody3D), состояние сохраняется.

@export var door_id := ""
@export_enum("interior", "blast", "blast_double") var kind := "interior":
	set(v): kind = v; _queue()
@export var width := 0.95:
	set(v): width = v; _queue()
@export var height := 2.1:
	set(v): height = v; _queue()
@export var wall_thickness := 0.4:
	set(v): wall_thickness = v; _queue()
@export var open_out := true          ## створка уходит в +Z (иначе в −Z)
@export var locked := false
@export var label := "Дверь"

var is_open := false
var _t := 0.0                          ## 0 — закрыта, 1 — открыта
var _leaves: Array = []                ## [узел-петля, знак угла]
var _dirty := false
var _snd: AudioStreamPlayer3D


func _ready() -> void:
	_build()
	if Engine.is_editor_hint():
		return
	if door_id == "":
		door_id = str(get_path())
	Core.world.register(door_id, self)


func _exit_tree() -> void:
	if not Engine.is_editor_hint() and Core and Core.world:
		Core.world.unregister(door_id)


func _queue() -> void:
	if not is_inside_tree() or _dirty:
		return
	_dirty = true
	_build.call_deferred()


func _speed() -> float:
	return 0.55 if kind != "interior" else 1.6


func _build() -> void:
	_dirty = false
	BCKit.clear_generated(self)
	_leaves.clear()
	var t := wall_thickness
	# рама по периметру проёма
	var fr := BCMesh.new()
	var I := Transform3D.IDENTITY
	var fw := 0.09 if kind == "interior" else 0.16
	var fm := "steel_dark" if kind == "interior" else "paint_olive"
	fr.box(fm, I, Vector3(fw, height, t + 0.06), Vector3(-width * 0.5 - fw * 0.5, height * 0.5, 0))
	fr.box(fm, I, Vector3(fw, height, t + 0.06), Vector3(width * 0.5 + fw * 0.5, height * 0.5, 0))
	fr.box(fm, I, Vector3(width + fw * 2, fw, t + 0.06), Vector3(0, height + fw * 0.5, 0))
	fr.box("steel_dark", I, Vector3(width, 0.03, t), Vector3(0, 0.015, 0))
	if kind != "interior":
		# жёлто-чёрная окантовка
		var zf := t * 0.5 + 0.035
		for sz in [zf, -zf]:
			fr.box("hazard", I, Vector3(0.05, height + fw, 0.01), Vector3(-width * 0.5 - fw, (height + fw) * 0.5, sz))
			fr.box("hazard", I, Vector3(0.05, height + fw, 0.01), Vector3(width * 0.5 + fw, (height + fw) * 0.5, sz))
		# лампа над дверью: зелёная — открыто, красная — закрыто (меняется в _apply)
	BCKit.mark(BCKit.add_mesh(self, fr, "Frame"))
	if kind == "blast_double":
		_leaf(-width * 0.5, width * 0.5, 1.0)
		_leaf(width * 0.5, width * 0.5, -1.0)
	else:
		_leaf(-width * 0.5, width, 1.0)
	if kind != "interior":
		var lamp := MeshInstance3D.new()
		lamp.name = "Lamp"
		var bm := BoxMesh.new()
		bm.size = Vector3(0.22, 0.08, 0.06)
		lamp.mesh = bm
		lamp.position = Vector3(0, height + fw + 0.12, t * 0.5 + 0.05)
		add_child(BCKit.mark(lamp))
	if not Engine.is_editor_hint():
		BCKit.mark(BCKit.sensor(self, self, Vector3(width + 0.6, 2.0, t + 1.6), Vector3(0, 1.0, 0)))
		_snd = AudioStreamPlayer3D.new()
		_snd.name = "Snd"
		_snd.max_distance = 18.0
		_snd.unit_size = 4.0
		add_child(BCKit.mark(_snd))
	_apply()


## створка: петля на краю hinge_x, ширина lw, знак — в какую сторону от петли лежит створка (+X / −X)
func _leaf(hinge_x: float, lw: float, side: float) -> void:
	var hinge := Node3D.new()
	hinge.name = "Hinge%d" % _leaves.size()
	hinge.position = Vector3(hinge_x, 0, 0)
	add_child(BCKit.mark(hinge))
	var th := 0.05 if kind == "interior" else 0.14
	var h := height - 0.02
	var mk := BCMesh.new()
	var I := Transform3D.IDENTITY
	var cx := side * lw * 0.5
	var mat := "paint_grey" if kind == "interior" else "paint_olive"
	mk.box(mat, I, Vector3(lw - 0.01, h, th), Vector3(cx, h * 0.5 + 0.01, 0))
	if kind == "interior":
		# ручка и смотровая решётка
		mk.box("steel", I, Vector3(0.03, 0.03, 0.12), Vector3(side * (lw - 0.1), 1.0, 0))
		mk.box("steel", I, Vector3(0.12, 0.025, 0.03), Vector3(side * (lw - 0.13), 1.0, 0.06))
		mk.box("steel", I, Vector3(0.12, 0.025, 0.03), Vector3(side * (lw - 0.13), 1.0, -0.06))
		mk.box("steel_dark", I, Vector3(0.3, 0.2, th + 0.01), Vector3(cx, 1.62, 0))
	else:
		# рёбра жёсткости, штурвал, петли, знак радиации
		for y in [0.35, h - 0.35]:
			mk.box("paint_olive", I, Vector3(lw - 0.16, 0.08, th + 0.06), Vector3(cx, y, 0))
		mk.box("steel_dark", I, Vector3(0.1, 0.22, th + 0.08), Vector3(side * 0.03, 0.45, 0))
		mk.box("steel_dark", I, Vector3(0.1, 0.22, th + 0.08), Vector3(side * 0.03, h - 0.45, 0))
		var wheel_c := Vector3(cx, h * 0.55, th * 0.5 + 0.06)
		var wt := Transform3D(Basis(Vector3.RIGHT, PI * 0.5), wheel_c)
		mk.cyl("steel", wt, 0.05, 0.08, Vector3(0, -0.04, 0), 10)
		for k in 4:
			var a := k * PI * 0.5 + PI * 0.25
			mk.pipe("steel", I, wheel_c + Vector3(0, 0, 0.04), wheel_c + Vector3(cos(a) * 0.22, sin(a) * 0.22, 0.04), 0.015, 6)
		for k in 16:
			var a0 := TAU * k / 16.0
			var a1 := TAU * (k + 1) / 16.0
			mk.pipe("steel", I, wheel_c + Vector3(cos(a0) * 0.24, sin(a0) * 0.24, 0.04), wheel_c + Vector3(cos(a1) * 0.24, sin(a1) * 0.24, 0.04), 0.02, 6)
		# знак радиации — жёлтый квадрат с тёмным трилистником (упрощённо)
		for zs in [th * 0.5 + 0.035, -th * 0.5 - 0.035]:
			mk.box("paint_yellow", I, Vector3(0.34, 0.34, 0.01), Vector3(cx, h * 0.8, zs))
			mk.cyl("black", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(cx, h * 0.8, zs)), 0.04, 0.012, Vector3(0, -0.006 * signf(zs), 0), 8)
			for k in 3:
				var a := PI * 0.5 + k * TAU / 3.0
				var p := Vector3(cx + cos(a) * 0.09, h * 0.8 + sin(a) * 0.09, zs)
				mk.box("black", Transform3D(Basis(Vector3.BACK, a), p), Vector3(0.09, 0.075, 0.014))
	BCKit.add_mesh(hinge, mk, "Leaf")
	# коллизия створки, двигается вместе с ней
	var body := AnimatableBody3D.new()
	body.name = "Body"
	body.collision_layer = BCKit.LAYER_WORLD
	body.sync_to_physics = false   # коллизия сразу следует за поворотом петли
	var cs := CollisionShape3D.new()
	var sh := BoxShape3D.new()
	sh.size = Vector3(lw, h, maxf(th, 0.08))
	cs.shape = sh
	cs.position = Vector3(cx, h * 0.5, 0)
	body.add_child(cs)
	hinge.add_child(body)
	_leaves.append([hinge, side])


func _process(delta: float) -> void:
	if Engine.is_editor_hint():
		return
	var target := 1.0 if is_open else 0.0
	if not is_equal_approx(_t, target):
		_t = move_toward(_t, target, delta * _speed())
		_apply()


func _apply() -> void:
	var e := _t * _t * (3.0 - 2.0 * _t)
	var ang := deg_to_rad(100.0 if kind == "interior" else 95.0) * e
	for L in _leaves:
		var hinge: Node3D = L[0]
		var side: float = L[1]
		hinge.rotation.y = ang * side * (-1.0 if open_out else 1.0)
	var lamp: MeshInstance3D = get_node_or_null("Lamp")
	if lamp:
		lamp.material_override = BCMat.get_mat("led_green" if is_open else "led_red")


# ---------- взаимодействие ----------

func interact_label() -> String:
	if locked:
		return label + ": заперто"
	return ("Закрыть: " if is_open else "Открыть: ") + label


func can_interact(_p) -> bool:
	return true


func interact_anim(_p) -> String:
	return "door_close" if is_open else "door_open"


func interact(_p) -> void:
	if locked:
		Core.say(label + " заперта.", "warn")
		return
	set_open(not is_open)


func set_open(v: bool) -> void:
	is_open = v
	if _snd:
		_snd.stream = Core.sfx("blast_door" if kind != "interior" else ("door_open" if v else "door_close"))
		if _snd.stream:
			_snd.play()
	Core.world.notify_state(door_id)


func get_state() -> Dictionary:
	return {"open": is_open, "locked": locked}


func set_state(s: Dictionary) -> void:
	is_open = s.get("open", false)
	locked = s.get("locked", locked)
	_t = 1.0 if is_open else 0.0
	_apply()
