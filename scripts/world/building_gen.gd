class_name BuildingGen
extends RefCounted
## Генератор геометрии зданий в локальных координатах (центр здания в начале координат).
## Состояния: разрушенное (ruin=1), рабочее (ruin=0), улучшенное (рабочее + детали), строительные леса.
## Возвращает MeshBuilder'ы: shell (стены первого этажа), roof (крыша и верхние этажи — скрываются,
## когда генерал внутри), interior (пол и обстановка), а также коллизии.

const M = preload("res://scripts/core/mesh_builder.gd")
const FLOOR_H := 3.4
const WALL_T := 0.3

static func door_info(def: Dictionary) -> Dictionary:
	## Локальная позиция и нормаль (наружу) двери здания.
	var size: Vector2 = def.size
	var side: String = def.door[0]
	var off: float = def.door[1]
	var hw := size.x * 0.5
	var hd := size.y * 0.5
	match side:
		"n": return {"pos": Vector3(off, 0, -hd), "out": Vector3(0, 0, -1)}
		"s": return {"pos": Vector3(off, 0, hd), "out": Vector3(0, 0, 1)}
		"e": return {"pos": Vector3(hw, 0, off), "out": Vector3(1, 0, 0)}
		_: return {"pos": Vector3(-hw, 0, off), "out": Vector3(-1, 0, 0)}

static func _openings_for(def: Dictionary, side: String, length: float, floor_i: int) -> Array:
	var ops: Array = []
	var kind: String = def.get("kind", "")
	var hangar: bool = def.get("hangar", false)
	var door_side: String = def.door[0]
	var door_off: float = def.door[1]
	var door_c := length * 0.5 + (door_off if side in ["n", "s"] else door_off)
	if floor_i == 0 and side == door_side:
		if hangar:
			if kind == "garage":
				for k in [-1, 0, 1]:
					ops.append({"c": length * 0.5 + k * 8.5, "w": 4.2, "kind": "gate", "h": 3.6})
			else:
				ops.append({"c": door_c, "w": 4.6, "kind": "gate", "h": 3.8})
				ops.append({"c": door_c + 4.2, "w": 1.6, "kind": "door", "h": 2.3})
		else:
			ops.append({"c": door_c, "w": 1.6, "kind": "door", "h": 2.3})
	if kind == "barracks" and floor_i == 0 and side == "e":
		ops.append({"c": length * 0.5 + 12.0, "w": 1.6, "kind": "door", "h": 2.3})
	# окна с шагом ~3.2 м, не пересекаясь с проёмами
	var step := 3.2 if not hangar else 4.5
	var n := int((length - 1.6) / step)
	if n <= 0:
		return ops
	var start := (length - (n - 1) * step) * 0.5
	for i in n:
		var c := start + i * step
		var clash := false
		for o in ops:
			if absf(c - float(o.c)) < float(o.w) * 0.5 + 1.0:
				clash = true
		if clash:
			continue
		if hangar:
			ops.append({"c": c, "w": 2.2, "kind": "window", "h": 0.9, "sill": 3.0})
		else:
			ops.append({"c": c, "w": 1.3, "kind": "window", "h": 1.4, "sill": 0.95})
	ops.sort_custom(func(a, b): return float(a.c) < float(b.c))
	return ops

static func _wall_run(mb: MeshBuilder, glass: MeshBuilder, col: Variant, a: Vector3, b: Vector3, y0: float, h: float, t: float,
		ops: Array, color: Color, ruin: float, rng: RandomNumberGenerator, trim: Color) -> void:
	## Стена от a до b (по земле), от высоты y0 высотой h, с проёмами.
	var d := b - a
	var L := d.length()
	var dir := d / L
	var yaw := atan2(dir.x, dir.z) - PI / 2
	var bas := Basis(Vector3.UP, yaw)
	var nrm := bas * Vector3(0, 0, 1)
	var cursor := 0.0
	var segs: Array = []
	for o in ops:
		var c0 := float(o.c) - float(o.w) * 0.5
		var c1 := float(o.c) + float(o.w) * 0.5
		if c0 > cursor:
			segs.append([cursor, c0])
		cursor = c1
	if cursor < L:
		segs.append([cursor, L])
	# сплошные участки
	for sgm in segs:
		var s0: float = sgm[0]
		var s1: float = sgm[1]
		if s1 - s0 < 0.01:
			continue
		if ruin <= 0.0:
			var center := a + dir * ((s0 + s1) * 0.5) + Vector3(0, y0 + h * 0.5, 0)
			mb.add_box(Transform3D(bas, center), Vector3(s1 - s0, h, t), color, y0 > 0.01)
		else:
			var x := s0
			while x < s1 - 0.01:
				var w := minf(rng.randf_range(0.6, 1.3), s1 - x)
				var edge := minf(x, L - (x + w))
				var keep := 1.0 - ruin * clampf(rng.randf_range(0.0, 1.1) - (0.4 if edge < 1.2 else 0.0), 0.0, 0.8)
				var hh := maxf(h * keep, minf(1.0, h))
				if y0 > 0.01:
					hh = h * keep if rng.randf() > ruin * 0.5 else 0.0
				if hh > 0.05:
					var center := a + dir * (x + w * 0.5) + Vector3(0, y0 + hh * 0.5, 0)
					mb.add_box(Transform3D(bas, center), Vector3(w + 0.01, hh, t), M.jitter(color, rng, 0.05), y0 > 0.01)
				x += w
		if col != null:
			var cc := a + dir * ((s0 + s1) * 0.5) + Vector3(0, y0 + h * 0.5, 0)
			(col as Array).append([Transform3D(bas, cc), Vector3(s1 - s0, h, t)])
	# проёмы
	for o in ops:
		var oc := float(o.c)
		var ow := float(o.w)
		var oh := float(o.h)
		var base := a + dir * oc
		match String(o.kind):
			"door", "gate":
				var top := y0 + oh
				if top < y0 + h - 0.02 and (ruin <= 0.0 or rng.randf() > ruin * 0.4):
					mb.add_box(Transform3D(bas, base + Vector3(0, (top + y0 + h) * 0.5, 0)), Vector3(ow, y0 + h - top, t), color, true)
				if col != null and top < y0 + h:
					(col as Array).append([Transform3D(bas, base + Vector3(0, (top + y0 + h) * 0.5, 0)), Vector3(ow, y0 + h - top, t)])
				# коробка
				for s in [-1.0, 1.0]:
					mb.add_box(Transform3D(bas, base + dir * (s * (ow * 0.5 - 0.05)) + Vector3(0, y0 + oh * 0.5, 0)), Vector3(0.1, oh, t + 0.06), trim, true)
				mb.add_box(Transform3D(bas, base + Vector3(0, y0 + oh, 0)), Vector3(ow, 0.12, t + 0.06), trim, true)
			"window":
				var sill := float(o.get("sill", 0.95))
				var wtop := sill + oh
				mb.add_box(Transform3D(bas, base + Vector3(0, y0 + sill * 0.5, 0)), Vector3(ow, sill, t), color, y0 > 0.01)
				if wtop < h:
					if ruin <= 0.0 or rng.randf() > ruin * 0.5:
						mb.add_box(Transform3D(bas, base + Vector3(0, y0 + (wtop + h) * 0.5, 0)), Vector3(ow, h - wtop, t), color, true)
				mb.add_box(Transform3D(bas, base + Vector3(0, y0 + sill - 0.03, 0) + nrm * 0.08), Vector3(ow + 0.15, 0.06, t + 0.16), trim, true)
				if col != null:
					(col as Array).append([Transform3D(bas, base + Vector3(0, y0 + h * 0.5, 0)), Vector3(ow, h, t)])
				if ruin <= 0.0:
					# рама и стекло
					var fc := Color(0.25, 0.27, 0.25, 0.2)
					for s in [-1.0, 0.0, 1.0]:
						mb.add_box(Transform3D(bas, base + dir * (s * (ow * 0.5 - 0.03)) + Vector3(0, y0 + sill + oh * 0.5, 0)), Vector3(0.06, oh, 0.1), fc, true)
					mb.add_box(Transform3D(bas, base + Vector3(0, y0 + sill + oh * 0.55, 0)), Vector3(ow, 0.05, 0.1), fc, true)
					glass.add_box(Transform3D(bas, base + Vector3(0, y0 + sill + oh * 0.5, 0)), Vector3(ow - 0.05, oh - 0.05, 0.03), Color(0.25, 0.32, 0.36, 0.7), true)
				else:
					var roll := rng.randf()
					if roll < 0.35:
						# заколочено досками
						for k in 3:
							var by := y0 + sill + oh * (0.2 + 0.3 * k)
							mb.add_box(Transform3D(bas * Basis(Vector3.FORWARD, rng.randf_range(-0.25, 0.25)), base + Vector3(0, by, 0) + nrm * (t * 0.5 + 0.03)), Vector3(ow + 0.2, 0.16, 0.04), M.jitter(Color(0.45, 0.36, 0.25, 0.4), rng, 0.1), true)
					elif roll < 0.6:
						var fc2 := Color(0.22, 0.2, 0.18, 0.3)
						mb.add_box(Transform3D(bas * Basis(Vector3.FORWARD, 0.3), base + Vector3(0, y0 + sill + oh * 0.5, 0)), Vector3(0.05, oh * 0.9, 0.08), fc2, true)
					# копоть над окном
					mb.add_box(Transform3D(bas, base + Vector3(0, y0 + minf(wtop + 0.4, h - 0.1), 0) + nrm * (t * 0.5 + 0.005)), Vector3(ow * 0.9, 0.6, 0.01), Color(0.08, 0.07, 0.06, 0.0), true)

static func _side_ab(side: String, hw: float, hd: float) -> Array:
	match side:
		"n": return [Vector3(-hw, 0, -hd), Vector3(hw, 0, -hd)]
		"s": return [Vector3(-hw, 0, hd), Vector3(hw, 0, hd)]
		"e": return [Vector3(hw, 0, -hd), Vector3(hw, 0, hd)]
		_: return [Vector3(-hw, 0, -hd), Vector3(-hw, 0, hd)]

static func shell(def: Dictionary, ruin: float, seed_v: int) -> Dictionary:
	## Коробка здания: стены (все этажи), крыша. Возвращает {"shell", "roof", "glass", "col"}.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var sh := MeshBuilder.new()
	var rf := MeshBuilder.new()
	var gl := MeshBuilder.new()
	var col: Array = []
	var size: Vector2 = def.size
	var hw := size.x * 0.5
	var hd := size.y * 0.5
	var floors: int = maxi(1, int(def.get("floors", 1)))
	var hangar: bool = def.get("hangar", false)
	var wall_c: Color = def.get("wall", Color(0.6, 0.58, 0.54))
	var brick: bool = def.get("brick", false)
	wall_c.a = M.MAT_BRICK if brick else M.MAT_CONCRETE
	if ruin > 0.0:
		wall_c = wall_c.darkened(0.12)
	var trim := Color(0.42, 0.41, 0.38, 0.0) if not brick else Color(0.6, 0.58, 0.52, 0.0)
	var t := WALL_T if not brick else 0.38
	var fh := FLOOR_H if not hangar else 5.2
	for side in ["n", "s", "e", "w"]:
		var ab := _side_ab(side, hw - t * 0.5 if side in ["e", "w"] else hw, hd - t * 0.5 if side in ["n", "s"] else hd)
		var a: Vector3 = ab[0]
		var b: Vector3 = ab[1]
		var L := (b - a).length()
		for fi in floors:
			var ops := _openings_for(def, side, L, fi)
			var target := sh if fi == 0 else rf
			var r := ruin if fi == 0 else minf(1.0, ruin * 1.3)
			_wall_run(target, gl, col if fi == 0 else null, a, b, fi * fh, fh, t, ops, wall_c, r, rng, trim)
		# цоколь
		var dirv := (b - a).normalized()
		var yaw := atan2(dirv.x, dirv.z) - PI / 2
		sh.add_box(Transform3D(Basis(Vector3.UP, yaw), (a + b) * 0.5 + Vector3(0, 0.2, 0)), Vector3((b - a).length() + t, 0.4, t + 0.1), Color(0.35, 0.34, 0.32, 0.0), true)
	# межэтажный пояс
	for fi in range(1, floors):
		rf.add_box(Transform3D(Basis(), Vector3(0, fi * fh, 0)), Vector3(size.x + 0.1, 0.22, size.y + 0.1), trim, false)
	var top := floors * fh
	# крыша
	if hangar:
		_hangar_roof(rf, size, top, ruin, rng, def)
	else:
		_flat_roof(rf, size, top, ruin, rng, wall_c, trim)
	return {"shell": sh, "roof": rf, "glass": gl, "col": col, "height": top}

static func _flat_roof(rf: MeshBuilder, size: Vector2, top: float, ruin: float, rng: RandomNumberGenerator, wall_c: Color, trim: Color) -> void:
	var slab := Color(0.45, 0.44, 0.41, 0.0)
	var pw := 3.0
	var nx := int(ceil(size.x / pw))
	var nz := int(ceil(size.y / pw))
	for ix in nx:
		for iz in nz:
			var x0 := -size.x * 0.5 + ix * size.x / nx
			var z0 := -size.y * 0.5 + iz * size.y / nz
			var cx := x0 + size.x / nx * 0.5
			var cz := z0 + size.y / nz * 0.5
			var ps := Vector3(size.x / nx + 0.01, 0.25, size.y / nz + 0.01)
			if ruin > 0.0:
				var roll := rng.randf()
				if roll < 0.4 * ruin:
					continue
				elif roll < 0.6 * ruin:
					# обрушенная плита
					var tilt := Basis(Vector3.RIGHT, rng.randf_range(-0.6, 0.6)) * Basis(Vector3.FORWARD, rng.randf_range(-0.6, 0.6))
					rf.add_box(Transform3D(tilt, Vector3(cx, top * 0.45, cz)), ps, slab.darkened(0.2))
					continue
				rf.add_box(Transform3D(Basis(), Vector3(cx, top + 0.12, cz)), ps, M.jitter(slab.darkened(0.15), rng, 0.08), false, M.jitter(Color(0.2, 0.19, 0.18, 0.0), rng, 0.1))
			else:
				rf.add_box(Transform3D(Basis(), Vector3(cx, top + 0.12, cz)), ps, slab, false, M.jitter(Color(0.27, 0.26, 0.25, 0.0), rng, 0.05))
	# парапет
	var pc := wall_c
	for s in [-1.0, 1.0]:
		var hh := 0.6
		if ruin <= 0.0 or rng.randf() > ruin * 0.6:
			rf.add_box(Transform3D(Basis(), Vector3(0, top + hh * 0.5, s * size.y * 0.5)), Vector3(size.x + 0.1, hh, 0.25), pc, true)
		if ruin <= 0.0 or rng.randf() > ruin * 0.6:
			rf.add_box(Transform3D(Basis(), Vector3(s * size.x * 0.5, top + hh * 0.5, 0)), Vector3(0.25, hh, size.y + 0.1), pc, true)
	rf.add_box(Transform3D(Basis(), Vector3(0, top + 0.62, 0)), Vector3(size.x + 0.3, 0.06, 0.3), trim, true)

static func _hangar_roof(rf: MeshBuilder, size: Vector2, top: float, ruin: float, rng: RandomNumberGenerator, def: Dictionary) -> void:
	## Двускатная металлическая крыша (конёк вдоль длинной стороны).
	var along_z := size.y >= size.x
	var span := size.x if along_z else size.y
	var length := size.y if along_z else size.x
	var rise := span * 0.18
	var sheet := Color(0.38, 0.4, 0.4, 0.2)
	var n := int(length / 1.5)
	for side in [-1.0, 1.0]:
		for i in n:
			if ruin > 0.0 and rng.randf() < ruin * 0.45:
				continue
			var l0 := -length * 0.5 + i * length / n
			var lc := l0 + length / n * 0.5
			var p_edge := Vector3(side * span * 0.5 * 1.04, top, lc)
			var p_ridge := Vector3(0, top + rise, lc)
			var c := (p_edge + p_ridge) * 0.5
			var ang := atan2(rise, span * 0.5)
			var bas := Basis(Vector3.FORWARD, -side * ang)
			var sz := Vector3(span * 0.5 * 1.08 / cos(ang), 0.06, length / n + 0.02)
			var cc := M.jitter(sheet, rng, 0.08)
			if ruin > 0.0 and rng.randf() < 0.4:
				cc = Color(0.4, 0.24, 0.13, 0.3)
			if not along_z:
				bas = Basis(Vector3.UP, PI / 2) * bas
				c = Vector3(c.z, c.y, c.x)
			rf.add_box(Transform3D(bas, c), sz, cc)
	# фронтоны
	for e in [-1.0, 1.0]:
		var a := Vector3(-span * 0.5, top, e * length * 0.5)
		var b := Vector3(span * 0.5, top, e * length * 0.5)
		var r := Vector3(0, top + rise, e * length * 0.5)
		if not along_z:
			a = Vector3(a.z, a.y, a.x)
			b = Vector3(b.z, b.y, b.x)
			r = Vector3(r.z, r.y, r.x)
		var gc: Color = def.get("wall", Color(0.5, 0.5, 0.46))
		gc.a = 0.0
		if ruin <= 0.0 or rng.randf() > ruin * 0.5:
			var nrm := Vector3(0, 0, e) if along_z else Vector3(e, 0, 0)
			rf.add_tri(a, b, r, gc, nrm)
			rf.add_tri(a, r, b, gc, -nrm)
	# фермы
	for i in range(0, int(length / 4.0) + 1):
		var lc := -length * 0.5 + i * 4.0
		var p0 := Vector3(-span * 0.5, top, lc)
		var p1 := Vector3(0, top + rise - 0.1, lc)
		var p2 := Vector3(span * 0.5, top, lc)
		if not along_z:
			p0 = Vector3(p0.z, p0.y, p0.x)
			p1 = Vector3(p1.z, p1.y, p1.x)
			p2 = Vector3(p2.z, p2.y, p2.x)
		rf.beam(p0, p1, 0.15, 0.2, Color(0.3, 0.2, 0.12, 0.3))
		rf.beam(p1, p2, 0.15, 0.2, Color(0.3, 0.2, 0.12, 0.3))
		rf.beam(p0, p2, 0.12, 0.15, Color(0.3, 0.2, 0.12, 0.3))

static func scaffold(def: Dictionary, height: float) -> MeshBuilder:
	var mb := MeshBuilder.new()
	var size: Vector2 = def.size
	var off := 0.9
	var pole := Color(0.4, 0.4, 0.42, 0.2)
	var plank := Color(0.55, 0.42, 0.26, 0.4)
	var hw := size.x * 0.5 + off
	var hd := size.y * 0.5 + off
	var h := minf(height + 1.0, 8.0)
	for side in ["n", "s", "e", "w"]:
		var ab := _side_ab(side, hw, hd)
		var a: Vector3 = ab[0]
		var b: Vector3 = ab[1]
		var L := (b - a).length()
		var n := int(L / 2.5) + 1
		for i in n + 1:
			var p := a.lerp(b, float(i) / n)
			mb.cyl_between(p, p + Vector3(0, h, 0), 0.04, 0.04, 5, pole, false)
		for y in [1.6, 3.4, 5.2]:
			if y < h:
				mb.beam(a + Vector3(0, y, 0), b + Vector3(0, y, 0), 0.05, 0.05, pole)
				var inn := (Vector3.ZERO - (a + b) * 0.5)
				inn.y = 0
				inn = inn.normalized() * 0.35
				mb.beam(a + Vector3(0, y - 0.05, 0) + inn, b + Vector3(0, y - 0.05, 0) + inn, 0.6, 0.04, plank)
		for i in n:
			var p0 := a.lerp(b, float(i) / n)
			var p1 := a.lerp(b, float(i + 1) / n)
			mb.beam(p0 + Vector3(0, 0.2, 0), p1 + Vector3(0, minf(h, 3.4), 0), 0.03, 0.03, pole)
	return mb

static func upgrades(def: Dictionary, height: float, rng: RandomNumberGenerator) -> MeshBuilder:
	## Детали улучшенного состояния: мешки у входа, ставни, антенны, флаг, прожектор.
	var mb := MeshBuilder.new()
	var size: Vector2 = def.size
	var di := door_info(def)
	var dp: Vector3 = di.pos
	var out: Vector3 = di.out
	var side := Vector3(out.z, 0, -out.x)
	var c := dp + out * 2.2
	Props.sandbags(mb, null, c + side * 3.2 - out * 0.3, c + side * 1.3, 4, rng)
	Props.sandbags(mb, null, c - side * 1.3, c - side * 3.2 - out * 0.3, 4, rng)
	# металлические щиты на окна (по углам)
	for s in [-1.0, 1.0]:
		var p := Vector3(s * (size.x * 0.5 + 0.2), 1.6, 0.0)
		mb.add_box(Transform3D(Basis(), p), Vector3(0.05, 1.6, 1.6), Color(0.3, 0.32, 0.3, 0.2), true)
	# антенна и прожектор на крыше
	var rp := Vector3(size.x * 0.3, height + 0.3, -size.y * 0.25)
	mb.cyl_between(rp, rp + Vector3(0, 4.0, 0), 0.04, 0.02, 5, Color(0.3, 0.3, 0.3, 0.2))
	mb.add_box(Transform3D(Basis(), Vector3(-size.x * 0.3, height + 0.5, size.y * 0.25)), Vector3(1.2, 0.8, 0.8), Color(0.55, 0.55, 0.52, 0.2), true)
	mb.add_box(Transform3D(Basis(), dp + out * 0.25 + Vector3(0, 3.0, 0)), Vector3(0.4, 0.25, 0.3), Color(0.25, 0.25, 0.25, 0.2), true)
	mb.add_box(Transform3D(Basis(), dp + out * 0.42 + Vector3(0, 3.0, 0)), Vector3(0.3, 0.18, 0.02), Color(1.0, 0.95, 0.8, 0.8), true)
	# полотнище с цветами «Долга»
	var fp := dp + out * 0.2 + side * 1.6 + Vector3(0, 2.6, 0)
	mb.add_box(Transform3D(Basis.looking_at(out, Vector3.UP), fp), Vector3(0.9, 0.6, 0.02), Color(0.08, 0.08, 0.08, 0.5), true)
	mb.add_box(Transform3D(Basis.looking_at(out, Vector3.UP), fp + Vector3(0, -0.6, 0)), Vector3(0.9, 0.6, 0.02), Color(0.6, 0.06, 0.05, 0.5), true)
	return mb

static func debris_inside(def: Dictionary, rng: RandomNumberGenerator) -> MeshBuilder:
	var mb := MeshBuilder.new()
	var size: Vector2 = def.size
	for i in int(size.x * size.y / 40.0) + 2:
		var p := Vector3(rng.randf_range(-size.x * 0.4, size.x * 0.4), 0, rng.randf_range(-size.y * 0.4, size.y * 0.4))
		Props.debris_small(mb, p, 1.2, 6, rng)
	return mb

# ======================================================================
#   ИНТЕРЬЕРЫ
# ======================================================================

static func _partition(mb: MeshBuilder, col: Array, a: Vector3, b: Vector3, door_c: float, color: Color) -> void:
	var L := (b - a).length()
	var ops := []
	if door_c >= 0.0:
		ops.append({"c": door_c, "w": 1.6, "kind": "door", "h": 2.3})
	var dummy := MeshBuilder.new()
	_wall_run(mb, dummy, col, a, b, 0.0, 3.2, 0.15, ops, color, 0.0, RandomNumberGenerator.new(), color.darkened(0.2))

static func interior(def: Dictionary, ruined: bool, seed_v: int) -> Dictionary:
	## Пол и обстановка. Возвращает {"mb", "col", "terminal" (локальная точка панели), "lights": [локальные точки]}.
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var mb := MeshBuilder.new()
	var col: Array = []
	var size: Vector2 = def.size
	var hw := size.x * 0.5
	var hd := size.y * 0.5
	var kind: String = def.kind
	var term := Vector3.ZERO
	var lights: Array = []
	var floor_c := Color(0.42, 0.41, 0.38, 0.0)
	match kind:
		"hq": floor_c = Color(0.45, 0.33, 0.22, 0.4)
		"medpoint": floor_c = Color(0.62, 0.64, 0.6, 0.0)
		"barracks": floor_c = Color(0.48, 0.36, 0.25, 0.4)
	if not def.get("open", false) and kind != "tower":
		mb.add_box(Transform3D(Basis(), Vector3(0, 0.015, 0)), Vector3(size.x - 0.2, 0.03, size.y - 0.2), floor_c, true)
	var wc := Color(0.66, 0.64, 0.58, 0.0)
	match kind:
		"hq":
			_partition(mb, col, Vector3(-5, 0, -hd + 0.15), Vector3(-5, 0, hd - 0.15), size.y - 2.5, wc)
			_partition(mb, col, Vector3(5, 0, -hd + 0.15), Vector3(5, 0, hd - 0.15), size.y - 2.5, wc)
			Props.map_table(mb, col, Transform3D(Basis(), Vector3(0, 0, -2.5)))
			term = Vector3(0, 0, -1.2)
			Props.table(mb, col, Transform3D(Basis(), Vector3(-9.5, 0, 0.0)), Vector2(1.6, 0.8))
			Props.chair(mb, Transform3D(Basis(), Vector3(-9.5, 0, -0.8)))
			Props.locker(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(-12.5, 0, -6.5)))
			Props.locker(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(-11.8, 0, -6.5)))
			Props.table(mb, col, Transform3D(Basis(), Vector3(9.5, 0, -4.5)), Vector2(2.0, 1.0), Color(0.35, 0.22, 0.14, 0.4))
			Props.chair(mb, Transform3D(Basis(Vector3.UP, PI), Vector3(9.5, 0, -5.4)))
			Props.shelf_rack(mb, col, Transform3D(Basis(), Vector3(9.5, 0, 6.6)), 4.0, rng, 0.5)
			Props.flag(mb, null, Vector3(12.5, 0, -6.8), 2.4)
			# лестница на второй этаж (декорация)
			for i in 8:
				mb.add_box(Transform3D(Basis(), Vector3(-3.6, 0.1 + i * 0.2, -6.5 + i * 0.3)), Vector3(1.0, 0.2, 0.3), Color(0.4, 0.4, 0.38, 0.0), true)
			col.append([Transform3D(Basis(), Vector3(-3.6, 0.8, -5.4)), Vector3(1.0, 1.6, 2.4)])
			lights = [Vector3(0, 3.0, -2), Vector3(-9.5, 3.0, 0), Vector3(9.5, 3.0, 0)]
		"barracks":
			for i in 7:
				var z := -hd + 2.5 + i * 4.4
				if absf(z - 0.0) < 1.6 or absf(z - 12.0) < 1.6:
					continue
				Props.bunk_bed(mb, col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(-hw + 1.4, 0, z)))
				Props.bunk_bed(mb, col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(hw - 1.4, 0, z + 2.2)))
			Props.table(mb, col, Transform3D(Basis(), Vector3(0, 0, -4.0)), Vector2(1.0, 2.6))
			Props.stove(mb, col, Transform3D(Basis(), Vector3(0, 0, 6.0)))
			term = Vector3(1.5, 0, -1.5)
			lights = [Vector3(0, 3.0, -10), Vector3(0, 3.0, 8)]
		"armory":
			Props.weapon_rack(mb, col, Transform3D(Basis(), Vector3(-1.0, 0, -hd + 0.6)), 6.0, 8)
			Props.weapon_rack(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(-1.0, 0, hd - 0.6)), 6.0, 6)
			for i in 4:
				Props.ammo_box(mb, col, Transform3D(Basis(Vector3.UP, rng.randf_range(-0.2, 0.2)), Vector3(-hw + 1.2, 0.4 * (i % 2), -2.0 + (i / 2) * 1.0)))
			Props.table(mb, col, Transform3D(Basis(), Vector3(2.5, 0, 1.5)), Vector2(1.6, 0.8))
			term = Vector3(4.0, 0, -2.5)
			lights = [Vector3(0, 3.0, 0)]
		"warehouse":
			for row in 3:
				Props.shelf_rack(mb, col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(-2.0 + row * 4.5, 0, -6.0)), 9.0, rng, 0.7 if not ruined else 0.25)
				Props.shelf_rack(mb, col, Transform3D(Basis(Vector3.UP, PI / 2), Vector3(-2.0 + row * 4.5, 0, 7.0)), 9.0, rng, 0.7 if not ruined else 0.25)
			for i in 6:
				Props.pallet(mb, Transform3D(Basis(Vector3.UP, rng.randf() * 0.4), Vector3(-hw + 2.5, 0, -12 + i * 4.6)))
				Props.crate(mb, col, Transform3D(Basis(Vector3.UP, rng.randf() * 0.4), Vector3(-hw + 2.5, 0.15, -12 + i * 4.6)), Vector3(1.0, 0.8, 1.0))
			Props.table(mb, col, Transform3D(Basis(), Vector3(-hw + 2.0, 0, 3.5)), Vector2(1.6, 0.8))
			term = Vector3(-hw + 3.2, 0, 3.5)
			lights = [Vector3(0, 4.5, -8), Vector3(0, 4.5, 8)]
		"workshop":
			Props.workbench(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(2.0, 0, -hd + 0.9)), rng)
			Props.workbench(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(6.0, 0, -hd + 0.9)), rng)
			Props.shelf_rack(mb, col, Transform3D(Basis(), Vector3(4.0, 0, hd - 0.7)), 6.0, rng, 0.5)
			mb.add_box(Transform3D(Basis(), Vector3(-2.0, 0.5, 2.0)), Vector3(1.4, 1.0, 1.0), Color(0.3, 0.32, 0.3, 0.2), true)
			col.append([Transform3D(Basis(), Vector3(-2.0, 0.5, 2.0)), Vector3(1.4, 1.0, 1.0)])
			Props.tire_stack(mb, col, Vector3(hw - 1.2, 0, 2.5), 3, rng)
			term = Vector3(4.0, 0, -hd + 2.0)
			lights = [Vector3(0, 4.5, 0)]
		"medpoint":
			for i in 3:
				Props.med_bed(mb, col, Transform3D(Basis(), Vector3(-1.5 + i * 2.4, 0, 3.0)))
			Props.cabinet(mb, col, Transform3D(Basis(Vector3.UP, PI), Vector3(4.5, 0, hd - 0.6)))
			Props.table(mb, col, Transform3D(Basis(), Vector3(5.0, 0, -1.5)), Vector2(1.4, 0.8), Color(0.75, 0.76, 0.74, 0.2))
			term = Vector3(5.0, 0, -0.5)
			lights = [Vector3(0, 3.0, 0)]
		"radio":
			Props.radio_console(mb, col, Transform3D(Basis(), Vector3(-1.5, 0, -hd + 1.0)))
			Props.chair(mb, Transform3D(Basis(Vector3.UP, PI), Vector3(-1.5, 0, -hd + 2.0)))
			term = Vector3(-1.5, 0, -hd + 2.4)
			lights = [Vector3(0, 3.0, 0)]
		"generator":
			Props.generator_unit(mb, col, Transform3D(Basis(), Vector3(0.5, 0, -1.0)), ruined)
			mb.add_box(Transform3D(Basis(), Vector3(-hw + 0.5, 1.4, 2.5)), Vector3(0.3, 1.4, 1.2), Color(0.35, 0.38, 0.35, 0.2), true)
			mb.add_box(Transform3D(Basis(), Vector3(-hw + 0.66, 1.6, 2.5)), Vector3(0.02, 0.3, 0.4), Color(0.9, 0.7, 0.2, 0.8), true)
			for i in 3:
				Props.barrel(mb, col, Vector3(hw - 1.0, 0, 2.6 - i * 0.7), Color(0.25, 0.35, 0.22, 0.2))
			term = Vector3(-hw + 1.4, 0, 2.5)
			lights = [Vector3(0, 3.0, 0)]
		"garage":
			for k in [-1, 0, 1]:
				mb.add_box(Transform3D(Basis(), Vector3(k * 8.5, 0.035, 1.0)), Vector3(1.0, 0.02, 6.0), Color(0.15, 0.14, 0.13, 0.0), true)
			Props.shelf_rack(mb, col, Transform3D(Basis(), Vector3(0, 0, hd - 0.7)), 8.0, rng, 0.4)
			if ruined:
				Props.uaz(mb, col, Transform3D(Basis(Vector3.UP, 0.15), Vector3(8.5, 0, 0.5)), Color(), true)
			term = Vector3(-4.0, 0, hd - 2.0)
			lights = [Vector3(-8, 4.5, 0), Vector3(8, 4.5, 0)]
		"training":
			term = Vector3(hw - 2.0, 0, 0.0)
		"kpp":
			term = Vector3(8.0, 0, -2.5)
		"tower":
			term = Vector3(0, 0, 2.6 if def.door[0] == "s" else -2.6)
	if ruined and not def.get("open", false) and kind != "tower":
		mb.append_builder(debris_inside(def, rng))
	return {"mb": mb, "col": col, "terminal": term, "lights": lights}

# ======================================================================
#   ОТКРЫТЫЕ ОБЪЕКТЫ: КПП, ТРЕНИРОВОЧНАЯ ПЛОЩАДКА, ВЫШКИ
# ======================================================================

static func open_site(def: Dictionary, ruin: float, seed_v: int) -> Dictionary:
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var mb := MeshBuilder.new()
	var rf := MeshBuilder.new()
	var col: Array = []
	var size: Vector2 = def.size
	match String(def.kind):
		"kpp":
			# будка охраны
			var bp := Vector3(9.0, 0, -2.0)
			var booth := {"size": Vector2(4, 3), "floors": 1, "door": ["w", 0.0], "wall": Color(0.62, 0.62, 0.58), "kind": "booth"}
			var bs := shell(booth, ruin * 0.6, seed_v + 5)
			mb.append_builder(bs.shell, Transform3D(Basis(), bp))
			rf.append_builder(bs.roof, Transform3D(Basis(), bp))
			mb.append_builder(bs.glass, Transform3D(Basis(), bp))
			for c in bs.col:
				col.append([Transform3D(Basis(), bp) * (c[0] as Transform3D), c[1]])
			mb.add_box(Transform3D(Basis(), bp + Vector3(0, 0.015, 0)), Vector3(3.8, 0.03, 2.8), Color(0.4, 0.4, 0.38, 0.0), true)
			# шлагбаум
			var arm_ang := 0.0 if ruin <= 0.0 else -0.35
			mb.add_box(Transform3D(Basis(), Vector3(5.2, 0.5, 2.5)), Vector3(0.4, 1.0, 0.4), Color(0.3, 0.3, 0.3, 0.2), true)
			mb.add_box(Transform3D(Basis(Vector3.FORWARD, arm_ang), Vector3(1.0, 1.0 + (0.0 if ruin <= 0.0 else -0.4), 2.5)), Vector3(8.0, 0.12, 0.12), Color(0.85, 0.85, 0.82, 0.2), true)
			for i in 4:
				mb.add_box(Transform3D(Basis(Vector3.FORWARD, arm_ang), Vector3(-2.0 + i * 2.0, 1.0 + (0.0 if ruin <= 0.0 else -0.4 + (i - 2) * 0.0), 2.5)), Vector3(0.9, 0.13, 0.13), Color(0.8, 0.12, 0.1, 0.2), true)
			# мешки с песком и блоки
			var bags := [[Vector3(-7.5, 0, -1.5), Vector3(-2.5, 0, -1.5)], [Vector3(2.5, 0, -1.5), Vector3(6.0, 0, -1.5)],
				[Vector3(-11.0, 0, -4.0), Vector3(-7.0, 0, -4.0)], [Vector3(7.5, 0, -5.5), Vector3(11.0, 0, -5.5)]]
			for b in bags:
				var a: Vector3 = b[0]
				var bb: Vector3 = b[1]
				if ruin > 0.0:
					bb = a.lerp(bb, rng.randf_range(0.5, 0.8))
				Props.sandbags(mb, col, a, bb, 4 if ruin <= 0.0 else 2, rng)
			# блоки «змейкой» — проезд остаётся, но на скорости не проскочить
			for jp in [Vector3(-3.4, 0, 8.6), Vector3(3.4, 0, 5.6)]:
				Props.jersey(mb, col, Transform3D(Basis(Vector3.UP, rng.randf_range(-0.2, 0.2) * ruin), jp))
			# ворота: створки
			if ruin <= 0.0:
				for s in [-1.0, 1.0]:
					mb.add_box(Transform3D(Basis(), Vector3(s * 9.0, 1.3, 2.0)), Vector3(5.8, 2.4, 0.08), Color(0.3, 0.33, 0.28, 0.2), true)
			else:
				mb.add_box(Transform3D(Basis(Vector3.RIGHT, -1.45) * Basis(Vector3.UP, 0.2), Vector3(-5.0, 0.15, 5.0)), Vector3(5.8, 2.4, 0.08), Color(0.35, 0.22, 0.13, 0.3), true)
		"training":
			var hw := size.x * 0.5
			var hd := size.y * 0.5
			# ограждение площадки
			var c := Color(0.45, 0.36, 0.25, 0.4)
			for s in [-1.0, 1.0]:
				mb.beam(Vector3(-hw, 0.9, s * hd), Vector3(hw, 0.9, s * hd), 0.08, 0.08, c)
				mb.beam(Vector3(-hw, 0.9, s * hd), Vector3(-hw, 0.9, -s * hd), 0.08, 0.08, c)
				for i in int(size.x / 3.0) + 1:
					mb.add_box(Transform3D(Basis(), Vector3(-hw + i * 3.0, 0.5, s * hd)), Vector3(0.1, 1.0, 0.1), c, true)
			# мишени стрельбища
			for i in 5:
				var p := Vector3(-hw + 2.0, 0, -8.0 + i * 3.5)
				if ruin > 0.0 and rng.randf() < 0.4:
					mb.add_box(Transform3D(Basis(Vector3.FORWARD, PI / 2), p + Vector3(0, 0.1, 0)), Vector3(0.6, 0.9, 0.03), Color(0.6, 0.55, 0.42, 0.5), true)
				else:
					Props.target_stand(mb, col, Transform3D(Basis(Vector3.UP, -PI / 2), p))
			# огневые рубежи
			for i in 5:
				Props.sandbags(mb, col, Vector3(hw - 9.0, 0, -9.0 + i * 3.5), Vector3(hw - 9.0, 0, -7.6 + i * 3.5), 2, rng)
			# полоса препятствий
			for i in 3:
				var p := Vector3(-6.0 + i * 5.0, 0, hd - 4.0)
				mb.add_box(Transform3D(Basis(), p + Vector3(0, 0.6, 0)), Vector3(0.3, 1.2, 3.0), Color(0.45, 0.36, 0.25, 0.4), true)
				col.append([Transform3D(Basis(), p + Vector3(0, 0.6, 0)), Vector3(0.3, 1.2, 3.0)])
			for i in 6:
				Props.tire(mb, Transform3D(Basis(), Vector3(-10.0 + (i % 2) * 1.0, 0, hd - 9.0 - i * 1.0)))
			mb.beam(Vector3(4.0, 2.4, -hd + 3.0), Vector3(7.0, 2.4, -hd + 3.0), 0.06, 0.06, Props.C_METAL_GRAY)
			for x in [4.0, 7.0]:
				mb.add_box(Transform3D(Basis(), Vector3(x, 1.2, -hd + 3.0)), Vector3(0.1, 2.4, 0.1), Props.C_METAL_GRAY, true)
			# стенд
			mb.add_box(Transform3D(Basis(), Vector3(hw - 1.5, 1.2, 0.0)), Vector3(0.1, 1.2, 2.0), Color(0.35, 0.3, 0.22, 0.4), true)
			mb.add_box(Transform3D(Basis(), Vector3(hw - 1.56, 1.3, 0.0)), Vector3(0.02, 0.9, 1.8), Color(0.75, 0.7, 0.6, 0.5), true)
			col.append([Transform3D(Basis(), Vector3(hw - 1.5, 1.2, 0.0)), Vector3(0.12, 2.4, 2.0)])
		"tower":
			_tower(mb, rf, col, ruin, rng)
	return {"shell": mb, "roof": rf, "col": col}

static func _tower(mb: MeshBuilder, rf: MeshBuilder, col: Array, ruin: float, rng: RandomNumberGenerator) -> void:
	var h := 5.5
	var w := 1.6
	var wood := Color(0.42, 0.33, 0.22, 0.4)
	var lean := Basis(Vector3.FORWARD, 0.08 * ruin) * Basis(Vector3.RIGHT, 0.05 * ruin)
	for sx in [-1.0, 1.0]:
		for sz in [-1.0, 1.0]:
			var base := Vector3(sx * w * 1.2, 0, sz * w * 1.2)
			var top := lean * Vector3(sx * w, h, sz * w)
			mb.beam(base, top, 0.2, 0.2, wood)
			col.append([Transform3D(Basis(), base + Vector3(0, 1.5, 0)), Vector3(0.3, 3.0, 0.3)])
	for y in [1.8, 3.6]:
		for s in [-1.0, 1.0]:
			mb.beam(lean * Vector3(-w * 1.13, y, s * w * 1.13), lean * Vector3(w * 1.13, y, s * w * 1.13), 0.1, 0.1, wood)
			mb.beam(lean * Vector3(s * w * 1.13, y, -w * 1.13), lean * Vector3(s * w * 1.13, y, w * 1.13), 0.1, 0.1, wood)
	# лестница
	for i in 14:
		mb.beam(Vector3(-0.3, 0.3 + i * 0.38, w * 1.35 - i * 0.02), Vector3(0.3, 0.3 + i * 0.38, w * 1.35 - i * 0.02), 0.05, 0.05, wood)
	# площадка
	var plat := Transform3D(lean, Vector3(0, h, 0))
	if ruin < 0.8 or rng.randf() < 0.5:
		rf.add_box(plat * Transform3D(Basis(), Vector3(0, 0.1, 0)), Vector3(w * 2.6, 0.15, w * 2.6), wood)
		for s in [-1.0, 1.0]:
			rf.add_box(plat * Transform3D(Basis(), Vector3(0, 0.6, s * w * 1.25)), Vector3(w * 2.6, 0.9, 0.06), wood.darkened(0.1))
			rf.add_box(plat * Transform3D(Basis(), Vector3(s * w * 1.25, 0.6, 0)), Vector3(0.06, 0.9, w * 2.6), wood.darkened(0.1))
	if ruin <= 0.0:
		for sx in [-1.0, 1.0]:
			for sz in [-1.0, 1.0]:
				rf.beam(plat * Vector3(sx * w * 1.2, 0.2, sz * w * 1.2), plat * Vector3(sx * w * 1.2, 2.4, sz * w * 1.2), 0.08, 0.08, wood)
		rf.add_box(plat * Transform3D(Basis(), Vector3(0, 2.5, 0)), Vector3(w * 3.0, 0.08, w * 3.0), Color(0.33, 0.35, 0.32, 0.2))
		rf.add_box(plat * Transform3D(Basis(), Vector3(w, 1.3, -w)), Vector3(0.35, 0.3, 0.4), Color(0.25, 0.25, 0.25, 0.2))
		rf.add_box(plat * Transform3D(Basis(), Vector3(w, 1.3, -w - 0.21)), Vector3(0.28, 0.22, 0.02), Color(1.0, 0.95, 0.8, 0.8))
