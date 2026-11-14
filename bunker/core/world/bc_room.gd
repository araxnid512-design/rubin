@tool
class_name BCRoom
extends Node3D
## Помещение BunkerCore: пол, стены с проёмами, потолок и коллизии строятся по параметрам — в редакторе и в
## игре одинаково. Начало координат — центр пола. Стороны: n (−Z), s (+Z), e (+X), w (−X).
## Проём: строка "сторона:смещение:ширина[:высота]", смещение — от середины стены вдоль неё (по X для n/s, по Z
## для e/w). Пример: "s:1.5:1.2:2.1".

@export var size := Vector3(6, 3, 5):
	set(v): size = v; _queue()
@export var wall := 0.4:
	set(v): wall = v; _queue()
@export var openings := PackedStringArray():
	set(v): openings = v; _queue()
@export var sides := "nsew":           ## какие стены строить (общие стены соседних комнат — только у одной)
	set(v): sides = v; _queue()
@export var floor_mat := "concrete_floor":
	set(v): floor_mat = v; _queue()
@export var wall_mat := "concrete_wall":
	set(v): wall_mat = v; _queue()
@export var ceiling := true:
	set(v): ceiling = v; _queue()
@export var stripe := true:            ## тёмная полоса понизу стен и жёлтая разметка у проёмов
	set(v): stripe = v; _queue()
@export var room_name := "":
	set(v): room_name = v

var _dirty := false


func _ready() -> void:
	_build()


func _queue() -> void:
	if not is_inside_tree() or _dirty:
		return
	_dirty = true
	_build.call_deferred()


func _parse_openings() -> Dictionary:
	var out := {"n": [], "s": [], "e": [], "w": []}
	for o in openings:
		var p := o.split(":")
		if p.size() < 3 or not out.has(p[0]):
			continue
		out[p[0]].append([float(p[1]), float(p[2]), float(p[3]) if p.size() > 3 else 2.15])
	return out


func _build() -> void:
	_dirty = false
	BCKit.clear_generated(self)
	var w := size.x
	var h := size.y
	var d := size.z
	var t := wall
	var mk := BCMesh.new()
	var cutw := "cut:" + wall_mat
	var I := Transform3D.IDENTITY
	var cols := []
	# пол
	mk.box(floor_mat, I, Vector3(w, 0.2, d), Vector3(0, -0.1, 0))
	cols.append([Vector3(w + 2 * t, 0.2, d + 2 * t), Vector3(0, -0.1, 0)])
	var ops := _parse_openings()
	for side in "nsew":
		if not sides.contains(side):
			continue
		var along_x := side == "n" or side == "s"
		var L := (w + 2 * t) if along_x else d
		var sgn := -1.0 if side == "n" or side == "w" else 1.0
		var c := Vector3(0, 0, sgn * (d * 0.5 + t * 0.5)) if along_x else Vector3(sgn * (w * 0.5 + t * 0.5), 0, 0)
		# сплошные куски между проёмами
		var cuts: Array = ops[side].duplicate()
		cuts.sort_custom(func(a, b): return a[0] < b[0])
		var pos := -L * 0.5
		var segs := []
		for o in cuts:
			var a: float = o[0] - o[1] * 0.5
			var b: float = o[0] + o[1] * 0.5
			if a > pos:
				segs.append([pos, a, 0.0, h])
			segs.append([a, b, o[2], h])   # перемычка над проёмом
			pos = b
		if pos < L * 0.5:
			segs.append([pos, L * 0.5, 0.0, h])
		for s in segs:
			var a: float = s[0]
			var b: float = s[1]
			var y0: float = s[2]
			var y1: float = s[3]
			if b - a < 0.01 or y1 - y0 < 0.01:
				continue
			var mid := (a + b) * 0.5
			var sz := Vector3(b - a, y1 - y0, t) if along_x else Vector3(t, y1 - y0, b - a)
			var cen := c + (Vector3(mid, (y0 + y1) * 0.5, 0) if along_x else Vector3(0, (y0 + y1) * 0.5, mid))
			mk.box(cutw, I, sz, cen)
			cols.append([sz, cen])
			# тёмный цоколь изнутри
			if stripe and y0 == 0.0:
				var inward := -sgn
				var off := Vector3(0, 0, inward * (t * 0.5 + 0.005)) if along_x else Vector3(inward * (t * 0.5 + 0.005), 0, 0)
				var bsz := Vector3(b - a, 0.18, 0.012) if along_x else Vector3(0.012, 0.18, b - a)
				mk.box("concrete_dark", I, bsz, cen * Vector3(1, 0, 1) + off + Vector3(0, 0.09, 0) + (c * 0.0))
		# разметка у проёмов: жёлто-чёрная полоса на полу
		if stripe:
			for o in cuts:
				var inward2 := -sgn
				var fp := c + (Vector3(o[0], 0.002, inward2 * (t * 0.5 + 0.25)) if along_x else Vector3(inward2 * (t * 0.5 + 0.25), 0.002, o[0]))
				var fsz := Vector3(o[1] + 0.2, 0.004, 0.18) if along_x else Vector3(0.18, 0.004, o[1] + 0.2)
				mk.box("hazard", I, fsz, fp)
	BCKit.mark(BCKit.add_mesh(self, mk, "Shell"))
	# потолок отдельно: скрывается, когда камера должна видеть внутрь
	if ceiling:
		var ck := BCMesh.new()
		ck.box("concrete_raw", I, Vector3(w + 2 * t, 0.3, d + 2 * t), Vector3(0, h + 0.15, 0))
		var ci := BCKit.add_mesh(self, ck, "Ceiling", false)
		BCKit.mark(ci)
		ci.add_to_group("roof")
		cols.append([Vector3(w + 2 * t, 0.3, d + 2 * t), Vector3(0, h + 0.15, 0)])
	BCKit.mark(BCKit.static_boxes(self, cols))
