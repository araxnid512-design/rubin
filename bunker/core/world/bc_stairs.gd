@tool
class_name BCStairs
extends Node3D
## Лестничный марш: ступени видимые, коллизия — гладкий пандус (персонаж идёт ровно, без подпрыгивания на
## каждой ступени), по бокам — стены-щёки и перила. Начало — низ первой ступени по центру; марш поднимается
## в сторону −Z (вперёд) на rise метров на длине run.

@export var width := 2.2:
	set(v): width = v; _queue()
@export var rise := 3.0:
	set(v): rise = v; _queue()
@export var run := 4.8:
	set(v): run = v; _queue()
@export var steps := 17:
	set(v): steps = v; _queue()
@export var side_walls := true:
	set(v): side_walls = v; _queue()
@export var wall_height := 3.0:
	set(v): wall_height = v; _queue()
@export var mat := "concrete_floor":
	set(v): mat = v; _queue()

var _dirty := false


func _ready() -> void:
	_build()


func _queue() -> void:
	if not is_inside_tree() or _dirty:
		return
	_dirty = true
	_build.call_deferred()


func _build() -> void:
	_dirty = false
	BCKit.clear_generated(self)
	var mk := BCMesh.new()
	var I := Transform3D.IDENTITY
	var sr := rise / steps
	var sd := run / steps
	for i in steps:
		var y1 := sr * (i + 1)
		var z0 := -sd * i
		# ступень — сплошной блок до пола, кромка жёлтая
		mk.box(mat, I, Vector3(width, y1, sd), Vector3(0, y1 * 0.5, z0 - sd * 0.5))
		mk.box("hazard", I, Vector3(width, 0.012, 0.06), Vector3(0, y1 + 0.006, z0 - 0.03))
	var cols := []
	if side_walls:
		var wt := 0.3
		for sx in [-1.0, 1.0]:
			var x = sx * (width * 0.5 + wt * 0.5)
			# стена-щека от пола до верха марша + высота помещения
			mk.box("cut:concrete_wall", I, Vector3(wt, rise + wall_height, run), Vector3(x, (rise + wall_height) * 0.5, -run * 0.5))
			cols.append([Vector3(wt, rise + wall_height, run), Vector3(x, (rise + wall_height) * 0.5, -run * 0.5)])
			# перила на кронштейнах
			var hx = sx * (width * 0.5 - 0.06)
			var a := Vector3(hx, 0.95, 0.0)
			var b := Vector3(hx, rise + 0.95, -run)
			mk.pipe("paint_yellow", I, a, b, 0.025, 8)
			for k in 5:
				var f := (k + 0.5) / 5.0
				var p := a.lerp(b, f)
				mk.pipe("steel_dark", I, p, p + Vector3(sx * 0.06, -0.12, 0), 0.012, 6)
	BCKit.mark(BCKit.add_mesh(self, mk, "Steps"))
	# пандус под ступенями для персонажа — через середины ступеней (ошибка ±полступени), от пола до площадки
	var ang := atan2(rise, run)
	var plen := sqrt(rise * rise + run * run)
	var up := Vector3(0, cos(ang), sin(ang))
	var cen := Vector3(0, rise * 0.5, (sd - run) * 0.5) - up * 0.1
	cols.append([Vector3(width, 0.2, plen), cen, Vector3(ang, 0, 0)])
	BCKit.mark(BCKit.static_boxes(self, cols))
	# настоящие ступени — отдельный слой «детали» (только для постановки стоп, персонаж по нему не ходит)
	var det := []
	for i in steps:
		var y1 := sr * (i + 1)
		det.append([Vector3(width, y1, sd), Vector3(0, y1 * 0.5, -sd * i - sd * 0.5)])
	var sb := BCKit.static_boxes(self, det, "StepsDetail")
	sb.collision_layer = BCKit.LAYER_DETAIL
	BCKit.mark(sb)
