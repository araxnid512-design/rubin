class_name WeaponModels
extends RefCounted
## 20 процедурных моделей оружия. Оружие — самостоятельный 3D-объект из частей:
##   body   — корпус (ствольная коробка, приклад, ствол);
##   mag    — отделяемый магазин/короб/лента (двигается при перезарядке, переходит в левую руку);
##   bolt   — подвижная часть: затворная рама, кожух-затвор, цевьё помпы, крышка ствольной коробки;
##   barrel — откидные стволы (переломка) или барабан (револьверный гранатомёт).
## Локальная система оружия: начало — точка хвата правой руки, ствол вдоль -Z, верх +Y.

const M = preload("res://scripts/core/mesh_builder.gd")
const C_METAL := Color(0.17, 0.17, 0.18, 0.2)
const C_DARK := Color(0.1, 0.1, 0.11, 0.2)
const C_PARK := Color(0.2, 0.21, 0.19, 0.2)
const C_PLUM := Color(0.36, 0.17, 0.12, 1.0)
const C_WOOD := Color(0.46, 0.27, 0.13, 0.4)
const C_WOOD_L := Color(0.55, 0.35, 0.18, 0.4)
const C_POLY := Color(0.13, 0.13, 0.12, 1.0)
const C_GLASS := Color(0.2, 0.3, 0.4, 0.7)
const C_OLIVE := Color(0.27, 0.3, 0.22, 0.2)

static var _cache := {}

static func get_model(id: String) -> Dictionary:
	if _cache.has(id):
		return _cache[id]
	var b := MeshBuilder.new()      # корпус
	var mg := MeshBuilder.new()     # магазин (в координатах относительно mag_origin)
	var bo := MeshBuilder.new()     # подвижная часть (в покое)
	var br := MeshBuilder.new()     # стволы/барабан (относительно barrel_pivot)
	var info := {}
	match id:
		"pm": info = _pistol(b, mg, bo, 0.16, 0.032, 0.028, false, C_METAL)
		"aps": info = _pistol(b, mg, bo, 0.22, 0.036, 0.03, true, C_DARK)
		"tt": info = _pistol(b, mg, bo, 0.19, 0.034, 0.028, false, Color(0.22, 0.22, 0.24, 0.2))
		"aks74u": info = _ak(b, mg, bo, {"stock": "fold", "barrel": 0.2, "mag": "545", "fore": C_PLUM, "muzzle": "cone", "short": true})
		"ak74": info = _ak(b, mg, bo, {"stock": "plum", "barrel": 0.42, "mag": "545", "fore": C_PLUM, "muzzle": "brake"})
		"akm": info = _ak(b, mg, bo, {"stock": "wood", "barrel": 0.4, "mag": "762", "fore": C_WOOD, "muzzle": "slant"})
		"an94": info = _ak(b, mg, bo, {"stock": "poly", "barrel": 0.45, "mag": "545slant", "fore": C_POLY, "muzzle": "brake", "an94": true})
		"rpk74": info = _ak(b, mg, bo, {"stock": "rpk", "barrel": 0.62, "mag": "545long", "fore": C_PLUM, "muzzle": "brake", "bipod": true})
		"saiga": info = _ak(b, mg, bo, {"stock": "fold", "barrel": 0.36, "mag": "box12", "fore": C_POLY, "muzzle": "none", "thick": true})
		"bizon": info = _bizon(b, mg, bo)
		"kedr": info = _kedr(b, mg, bo)
		"val": info = _val(b, mg, bo, false)
		"vss": info = _val(b, mg, bo, true)
		"sks": info = _sks(b, mg, bo)
		"svd": info = _svd(b, mg, bo)
		"mosin": info = _mosin(b, mg, bo)
		"toz34": info = _toz(b, br)
		"ks23": info = _ks23(b, bo)
		"pkm": info = _pkm(b, mg, bo)
		"rg6": info = _rg6(b, br)
		_: info = _pistol(b, mg, bo, 0.16, 0.032, 0.028, false, C_METAL)
	var mat := Mats.character()
	info["body"] = b.build(mat)
	info["mag_mesh"] = null if mg.is_empty() else mg.build(mat)
	info["bolt_mesh"] = null if bo.is_empty() else bo.build(mat)
	info["barrel_mesh"] = null if br.is_empty() else br.build(mat)
	for k in ["mag_origin", "bolt_axis", "barrel_pivot", "barrel_axis", "fore", "stock", "muzzle", "mag_pt", "bolt_pt", "eye"]:
		if not info.has(k):
			info[k] = Vector3.ZERO
	if not info.has("bolt_rot"):
		info["bolt_rot"] = Vector3.ZERO
	_cache[id] = info
	return info

static func _rx(a: float) -> Basis:
	return Basis(Vector3.RIGHT, a)

static func _bx(mb: MeshBuilder, c: Vector3, s: Vector3, col: Color, rx: float = 0.0) -> void:
	mb.add_box(Transform3D(_rx(rx), c), s, col)

static func _tube(mb: MeshBuilder, z0: float, z1: float, y: float, r: float, col: Color, x: float = 0.0, sides: int = 8) -> void:
	mb.add_cyl(Transform3D(_rx(-PI / 2), Vector3(x, y, z0)), r, r, z0 - z1, sides, col)

# ------------------------------------------------------------------ пистолеты
static func _pistol(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder, length: float, h: float, w: float, aps: bool, col: Color) -> Dictionary:
	var top := 0.045
	# рамка и рукоять
	_bx(b, Vector3(0, top - h * 0.75, -length * 0.38), Vector3(w * 0.95, h * 0.6, length * 0.78), col.darkened(0.2))
	_bx(b, Vector3(0, -0.015, 0.012), Vector3(w + 0.004, 0.09, 0.04), C_PLUM if not aps else C_POLY, -0.22)
	_bx(b, Vector3(0, 0.0, -0.035), Vector3(0.008, 0.008, 0.045), C_DARK)
	_bx(b, Vector3(0, -0.012, -0.055), Vector3(0.008, 0.03, 0.008), C_DARK)
	if aps:
		_bx(b, Vector3(0, 0.0, 0.05), Vector3(0.012, 0.06, 0.03), C_DARK)
	# затвор-кожух (подвижный)
	_bx(bo, Vector3(0, top, -length * 0.42), Vector3(w, h, length), col)
	_bx(bo, Vector3(0, top + h * 0.55, -length * 0.85), Vector3(0.006, 0.01, 0.01), C_DARK)
	for i in 5:
		_bx(bo, Vector3(w * 0.5, top, 0.03 - i * 0.008), Vector3(0.003, h * 0.7, 0.004), C_DARK)
	_tube(b, -length * 0.9, -length * 0.95, top, 0.006, C_DARK)
	# магазин в рукояти
	var mo := Vector3(0, -0.03, 0.018)
	var ml := 0.075 if not aps else 0.11
	_bx(mg, Vector3(0, -ml * 0.5 + 0.03, 0), Vector3(w - 0.008, ml, 0.03), C_DARK, -0.22)
	_bx(mg, Vector3(0, -ml + 0.03, -0.012), Vector3(w + 0.004, 0.01, 0.036), C_DARK, -0.22)
	return {"hold": "pistol", "fore": Vector3(-0.028, -0.025, 0.005), "stock": Vector3(0, 0.02, 0.1),
		"muzzle": Vector3(0, top, -length * 0.95), "mag_origin": mo, "mag_pt": mo + Vector3(0, -ml + 0.02, 0.0),
		"bolt_axis": Vector3(0, 0, 0.035), "bolt_pt": Vector3(0, top, 0.025), "eye": Vector3(0, top + 0.03, 0)}

# ------------------------------------------------------------------ семейство Калашникова
static func _ak(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder, p: Dictionary) -> Dictionary:
	var fore_c: Color = p.get("fore", C_PLUM)
	var thick := 0.008 if p.get("thick", false) else 0.0
	var short: bool = p.get("short", false)
	# ствольная коробка
	_bx(b, Vector3(0, 0.055, -0.1), Vector3(0.048 + thick, 0.07, 0.4), C_METAL)
	_bx(b, Vector3(0, 0.094, -0.08), Vector3(0.042 + thick, 0.012, 0.34), C_DARK)
	_bx(b, Vector3(0, 0.068, -0.31), Vector3(0.04, 0.03, 0.04), C_DARK)
	_bx(b, Vector3(0, -0.02, 0.025), Vector3(0.034, 0.11, 0.045), fore_c if fore_c != C_WOOD else C_PLUM, -0.28)
	_bx(b, Vector3(0, 0.0, -0.035), Vector3(0.01, 0.01, 0.07), C_DARK)
	_bx(b, Vector3(0.026, 0.06, -0.05), Vector3(0.004, 0.025, 0.14), C_DARK)  # переводчик
	# приклад
	match p.get("stock", "plum"):
		"plum", "wood", "poly":
			var sc: Color = C_WOOD if p.stock == "wood" else (C_POLY if p.stock == "poly" else C_PLUM)
			_bx(b, Vector3(0, 0.035, 0.22), Vector3(0.042, 0.085, 0.24), sc, 0.07)
			_bx(b, Vector3(0, 0.025, 0.345), Vector3(0.046, 0.12, 0.02), C_DARK)
		"rpk":
			_bx(b, Vector3(0, 0.03, 0.22), Vector3(0.042, 0.11, 0.24), C_PLUM, 0.12)
			_bx(b, Vector3(0, 0.0, 0.345), Vector3(0.046, 0.15, 0.02), C_DARK)
		"fold":
			b.beam(Vector3(0.012, 0.07, 0.1), Vector3(0.012, 0.045, 0.42), 0.012, 0.02, C_DARK)
			b.beam(Vector3(-0.012, 0.03, 0.1), Vector3(-0.012, 0.0, 0.42), 0.012, 0.02, C_DARK)
			_bx(b, Vector3(0, 0.025, 0.43), Vector3(0.03, 0.1, 0.025), C_DARK)
	var stock_z := 0.43 if p.stock == "fold" else 0.35
	# цевьё, газовая трубка, ствол
	var bl: float = p.get("barrel", 0.42)
	var fore_len := 0.2 if not short else 0.13
	_bx(b, Vector3(0, 0.05, -0.31 - fore_len * 0.5), Vector3(0.054 + thick, 0.058, fore_len), fore_c)
	if not short:
		_bx(b, Vector3(0, 0.098, -0.31 - fore_len * 0.5), Vector3(0.036, 0.03, fore_len), fore_c)
	var bz0 := -0.31 - fore_len
	var bz1 := -0.3 - bl
	_tube(b, bz0 + 0.02, bz1, 0.055, 0.011 + thick * 0.5, C_METAL)
	if not short:
		_bx(b, Vector3(0, 0.085, bz0 - 0.02), Vector3(0.03, 0.05, 0.04), C_DARK)
		_bx(b, Vector3(0, 0.095, bz1 + 0.07), Vector3(0.016, 0.045, 0.02), C_DARK)
	if p.get("an94", false):
		_bx(b, Vector3(0, 0.12, bz1 + 0.08), Vector3(0.02, 0.06, 0.03), C_DARK)
		_bx(b, Vector3(0, 0.02, -0.4), Vector3(0.045, 0.04, 0.2), C_POLY)
	match p.get("muzzle", "brake"):
		"brake": _tube(b, bz1, bz1 - 0.07, 0.055, 0.016, C_DARK)
		"slant": _tube(b, bz1, bz1 - 0.03, 0.055, 0.014, C_DARK)
		"cone": _tube(b, bz1, bz1 - 0.07, 0.055, 0.021, C_DARK)
	if p.get("bipod", false):
		b.beam(Vector3(0.012, 0.045, bz1 + 0.12), Vector3(0.016, 0.035, bz1 + 0.4), 0.01, 0.01, C_DARK)
		b.beam(Vector3(-0.012, 0.045, bz1 + 0.12), Vector3(-0.016, 0.035, bz1 + 0.4), 0.01, 0.01, C_DARK)
	# затворная рама с рукояткой (подвижная)
	_bx(bo, Vector3(0.028, 0.072, -0.05), Vector3(0.008, 0.022, 0.14), C_METAL.lightened(0.1))
	_bx(bo, Vector3(0.04, 0.072, 0.0), Vector3(0.025, 0.014, 0.014), C_METAL.lightened(0.15))
	# магазин
	var mo := Vector3(0, 0.02, -0.17)
	var mcol := C_PLUM.darkened(0.15)
	match p.get("mag", "545"):
		"545", "545slant":
			_bx(mg, Vector3(0, -0.035, 0.0), Vector3(0.03, 0.09, 0.065), mcol, 0.18)
			_bx(mg, Vector3(0, -0.11, -0.03), Vector3(0.03, 0.09, 0.065), mcol, 0.45)
		"762":
			mcol = Color(0.25, 0.22, 0.2, 0.2)
			_bx(mg, Vector3(0, -0.035, 0.0), Vector3(0.032, 0.09, 0.07), mcol, 0.15)
			_bx(mg, Vector3(0, -0.115, -0.025), Vector3(0.032, 0.09, 0.07), mcol, 0.42)
		"545long":
			_bx(mg, Vector3(0, -0.045, 0.0), Vector3(0.03, 0.11, 0.065), mcol, 0.18)
			_bx(mg, Vector3(0, -0.15, -0.045), Vector3(0.03, 0.13, 0.065), mcol, 0.45)
		"box12":
			_bx(mg, Vector3(0, -0.07, -0.01), Vector3(0.04, 0.15, 0.09), C_POLY, 0.1)
	return {"hold": "rifle", "fore": Vector3(0, 0.035, -0.31 - fore_len * 0.55), "stock": Vector3(0, 0.04, stock_z),
		"muzzle": Vector3(0, 0.055, bz1 - 0.07), "mag_origin": mo, "mag_pt": mo + Vector3(0, -0.08, -0.02),
		"bolt_axis": Vector3(0, 0, 0.11), "bolt_pt": Vector3(0.045, 0.072, 0.0), "eye": Vector3(0, 0.12, 0.1)}

static func _bizon(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	var info := _ak(b, MeshBuilder.new(), bo, {"stock": "fold", "barrel": 0.24, "mag": "none", "fore": C_POLY, "muzzle": "none", "short": true})
	var mo := Vector3(0, 0.0, -0.2)
	mg.add_cyl(Transform3D(_rx(-PI / 2), Vector3(0, 0.0, 0.12)), 0.032, 0.032, 0.36, 10, C_POLY)
	_bx(mg, Vector3(0, 0.03, 0.05), Vector3(0.02, 0.03, 0.1), C_DARK)
	info.mag_origin = mo
	info.mag_pt = mo + Vector3(0, -0.02, -0.12)
	info.fore = Vector3(0, -0.02, -0.33)
	return info

static func _kedr(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.05, -0.08), Vector3(0.036, 0.06, 0.28), C_DARK)
	_bx(b, Vector3(0, -0.015, 0.015), Vector3(0.03, 0.1, 0.04), C_POLY, -0.15)
	_bx(b, Vector3(0, 0.0, -0.04), Vector3(0.008, 0.008, 0.05), C_DARK)
	_tube(b, -0.22, -0.3, 0.05, 0.01, C_METAL)
	b.beam(Vector3(0, 0.07, 0.06), Vector3(0, 0.07, 0.3), 0.01, 0.01, C_DARK)
	b.beam(Vector3(0, 0.0, 0.06), Vector3(0, 0.0, 0.3), 0.01, 0.01, C_DARK)
	_bx(b, Vector3(0, 0.035, 0.3), Vector3(0.025, 0.09, 0.015), C_DARK)
	_bx(bo, Vector3(0.022, 0.07, -0.02), Vector3(0.012, 0.014, 0.03), C_METAL.lightened(0.15))
	var mo := Vector3(0, 0.02, -0.08)
	_bx(mg, Vector3(0, -0.07, 0.0), Vector3(0.025, 0.16, 0.035), C_DARK, 0.05)
	return {"hold": "smg", "fore": Vector3(0, -0.04, -0.09), "stock": Vector3(0, 0.035, 0.3), "muzzle": Vector3(0, 0.05, -0.31),
		"mag_origin": mo, "mag_pt": mo + Vector3(0, -0.12, 0), "bolt_axis": Vector3(0, 0, 0.05), "bolt_pt": Vector3(0.03, 0.07, -0.02), "eye": Vector3(0, 0.09, 0.05)}

static func _val(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder, vss: bool) -> Dictionary:
	_bx(b, Vector3(0, 0.055, -0.08), Vector3(0.046, 0.068, 0.34), C_METAL)
	_bx(b, Vector3(0, -0.02, 0.025), Vector3(0.034, 0.11, 0.045), C_POLY if not vss else C_WOOD, -0.28)
	_bx(b, Vector3(0, 0.0, -0.035), Vector3(0.01, 0.01, 0.07), C_DARK)
	# интегрированный глушитель
	_tube(b, -0.25, -0.62, 0.055, 0.024, C_PARK, 0.0, 10)
	_bx(b, Vector3(0, 0.05, -0.32), Vector3(0.056, 0.05, 0.14), C_POLY if not vss else C_WOOD)
	if vss:
		b.beam(Vector3(0, 0.07, 0.08), Vector3(0, 0.06, 0.4), 0.04, 0.035, C_WOOD)
		b.beam(Vector3(0, -0.06, 0.07), Vector3(0, -0.03, 0.4), 0.04, 0.03, C_WOOD)
		_bx(b, Vector3(0, 0.015, 0.41), Vector3(0.045, 0.15, 0.03), C_DARK)
		_tube(b, -0.02, -0.24, 0.13, 0.016, C_DARK, -0.025)
		_tube(b, -0.24, -0.27, 0.13, 0.02, C_GLASS, -0.025)
	else:
		b.beam(Vector3(0.015, 0.07, 0.1), Vector3(0.015, 0.05, 0.4), 0.01, 0.018, C_DARK)
		b.beam(Vector3(-0.015, 0.07, 0.1), Vector3(-0.015, 0.05, 0.4), 0.01, 0.018, C_DARK)
		_bx(b, Vector3(0, 0.04, 0.41), Vector3(0.04, 0.1, 0.02), C_POLY)
	_bx(bo, Vector3(0.028, 0.07, -0.04), Vector3(0.008, 0.02, 0.12), C_METAL.lightened(0.1))
	_bx(bo, Vector3(0.04, 0.07, 0.01), Vector3(0.022, 0.014, 0.014), C_METAL.lightened(0.15))
	var mo := Vector3(0, 0.02, -0.16)
	_bx(mg, Vector3(0, -0.05, 0.0), Vector3(0.032, 0.11 if not vss else 0.07, 0.07), C_DARK, 0.12)
	return {"hold": "sniper" if vss else "rifle", "fore": Vector3(0, 0.03, -0.32), "stock": Vector3(0, 0.04, 0.41), "muzzle": Vector3(0, 0.055, -0.62),
		"mag_origin": mo, "mag_pt": mo + Vector3(0, -0.07, 0), "bolt_axis": Vector3(0, 0, 0.09), "bolt_pt": Vector3(0.045, 0.07, 0.01), "eye": Vector3(0, 0.13, 0.1)}

static func _sks(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.02, 0.1), Vector3(0.045, 0.1, 0.5), C_WOOD, 0.06)
	_bx(b, Vector3(0, 0.045, -0.3), Vector3(0.05, 0.05, 0.3), C_WOOD)
	_bx(b, Vector3(0, 0.07, -0.08), Vector3(0.04, 0.05, 0.22), C_METAL)
	_bx(b, Vector3(0, -0.01, -0.15), Vector3(0.035, 0.05, 0.1), C_METAL)
	_bx(b, Vector3(0, 0.0, 0.36), Vector3(0.048, 0.13, 0.02), C_DARK)
	_tube(b, -0.2, -0.78, 0.07, 0.011, C_METAL)
	_tube(b, -0.2, -0.5, 0.095, 0.009, C_METAL)
	b.beam(Vector3(0, 0.035, -0.47), Vector3(0, 0.035, -0.75), 0.008, 0.012, C_METAL.lightened(0.2))
	_bx(bo, Vector3(0.0, 0.09, -0.05), Vector3(0.03, 0.02, 0.12), C_METAL.lightened(0.1))
	_bx(bo, Vector3(0.035, 0.09, 0.0), Vector3(0.03, 0.012, 0.012), C_METAL.lightened(0.15))
	var mo := Vector3(0, 0.12, -0.06)
	_bx(mg, Vector3(0, 0.02, 0), Vector3(0.012, 0.05, 0.06), Color(0.7, 0.55, 0.25, 0.2))
	return {"hold": "rifle", "fore": Vector3(0, 0.02, -0.32), "stock": Vector3(0, 0.02, 0.36), "muzzle": Vector3(0, 0.07, -0.78),
		"mag_origin": mo, "mag_pt": mo + Vector3(0, 0.04, 0), "bolt_axis": Vector3(0, 0, 0.1), "bolt_pt": Vector3(0.045, 0.09, 0.0), "eye": Vector3(0, 0.12, 0.1), "clip": true}

static func _svd(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.055, -0.1), Vector3(0.044, 0.065, 0.42), C_METAL)
	b.beam(Vector3(0, 0.08, 0.1), Vector3(0, 0.07, 0.44), 0.04, 0.035, C_WOOD)
	b.beam(Vector3(0, -0.06, 0.08), Vector3(0, -0.04, 0.44), 0.04, 0.03, C_WOOD)
	b.beam(Vector3(0, -0.06, 0.08), Vector3(0, 0.04, 0.02), 0.035, 0.035, C_WOOD)
	_bx(b, Vector3(0, 0.08, 0.32), Vector3(0.045, 0.03, 0.12), C_WOOD.darkened(0.1))
	_bx(b, Vector3(0, 0.015, 0.45), Vector3(0.046, 0.15, 0.03), C_DARK)
	_bx(b, Vector3(0, 0.055, -0.45), Vector3(0.05, 0.06, 0.28), C_WOOD)
	_tube(b, -0.59, -1.0, 0.055, 0.011, C_METAL)
	_tube(b, -1.0, -1.08, 0.055, 0.014, C_DARK)
	_tube(b, 0.1, -0.14, 0.135, 0.017, C_DARK, -0.03)
	_tube(b, -0.14, -0.18, 0.135, 0.022, C_GLASS, -0.03)
	_bx(b, Vector3(-0.015, 0.1, -0.02), Vector3(0.02, 0.05, 0.06), C_DARK)
	_bx(bo, Vector3(0.028, 0.07, -0.05), Vector3(0.008, 0.02, 0.12), C_METAL.lightened(0.1))
	_bx(bo, Vector3(0.04, 0.07, 0.0), Vector3(0.022, 0.014, 0.014), C_METAL.lightened(0.15))
	var mo := Vector3(0, 0.02, -0.16)
	_bx(mg, Vector3(0, -0.04, 0), Vector3(0.03, 0.08, 0.06), C_DARK, 0.15)
	return {"hold": "sniper", "fore": Vector3(0, 0.035, -0.4), "stock": Vector3(0, 0.03, 0.46), "muzzle": Vector3(0, 0.055, -1.08),
		"mag_origin": mo, "mag_pt": mo + Vector3(0, -0.07, 0), "bolt_axis": Vector3(0, 0, 0.1), "bolt_pt": Vector3(0.045, 0.07, 0.0), "eye": Vector3(-0.03, 0.135, 0.12)}

static func _mosin(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.02, 0.14), Vector3(0.045, 0.1, 0.42), C_WOOD, 0.08)
	_bx(b, Vector3(0, 0.04, -0.4), Vector3(0.048, 0.05, 0.62), C_WOOD)
	_bx(b, Vector3(0, 0.07, -0.04), Vector3(0.036, 0.04, 0.2), C_METAL)
	_bx(b, Vector3(0, -0.005, -0.1), Vector3(0.03, 0.05, 0.08), C_METAL)
	_bx(b, Vector3(0, 0.0, 0.36), Vector3(0.048, 0.13, 0.02), C_DARK)
	_tube(b, -0.12, -1.12, 0.065, 0.011, C_METAL)
	_tube(b, 0.06, -0.18, 0.14, 0.016, C_DARK, -0.02)
	_tube(b, -0.18, -0.22, 0.14, 0.02, C_GLASS, -0.02)
	# затвор с рукоятью (поворот и отвод)
	_bx(bo, Vector3(0, 0.08, 0.02), Vector3(0.025, 0.025, 0.12), C_METAL.lightened(0.15))
	bo.beam(Vector3(0.0, 0.08, 0.06), Vector3(0.07, 0.04, 0.06), 0.012, 0.012, C_METAL.lightened(0.15))
	bo.add_cyl(Transform3D(Basis(), Vector3(0.07, 0.025, 0.06)), 0.015, 0.015, 0.025, 6, C_METAL.lightened(0.15))
	var mo := Vector3(0, 0.12, -0.05)
	_bx(mg, Vector3(0, 0.02, 0), Vector3(0.012, 0.05, 0.06), Color(0.7, 0.55, 0.25, 0.2))
	return {"hold": "sniper", "fore": Vector3(0, 0.02, -0.38), "stock": Vector3(0, 0.02, 0.36), "muzzle": Vector3(0, 0.065, -1.12),
		"mag_origin": mo, "mag_pt": mo + Vector3(0, 0.04, 0), "bolt_axis": Vector3(0, 0, 0.09), "bolt_rot": Vector3(0, 0, -1.2), "bolt_center": Vector3(0, 0.08, 0),
		"bolt_pt": Vector3(0.07, 0.04, 0.06), "eye": Vector3(-0.02, 0.14, 0.12), "clip": true}

static func _toz(b: MeshBuilder, br: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.05, -0.04), Vector3(0.05, 0.07, 0.1), C_METAL)
	_bx(b, Vector3(0, 0.02, 0.18), Vector3(0.045, 0.1, 0.34), C_WOOD_L, 0.12)
	_bx(b, Vector3(0, 0.0, 0.36), Vector3(0.048, 0.14, 0.02), C_DARK)
	_bx(b, Vector3(0, 0.0, -0.035), Vector3(0.01, 0.01, 0.06), C_DARK)
	# стволы на шарнире
	var piv := Vector3(0, 0.03, -0.09)
	_tube(br, 0.0, -0.64, 0.045, 0.014, C_METAL)
	_tube(br, 0.0, -0.64, 0.015, 0.014, C_METAL)
	_bx(br, Vector3(0, 0.0, -0.22), Vector3(0.04, 0.04, 0.24), C_WOOD_L)
	return {"hold": "shotgun", "fore": Vector3(0, 0.02, -0.3), "stock": Vector3(0, 0.03, 0.37), "muzzle": Vector3(0, 0.06, -0.73),
		"barrel_pivot": piv, "barrel_axis": Vector3(1, 0, 0), "mag_pt": Vector3(0, 0.06, -0.08), "eye": Vector3(0, 0.1, 0.1), "break": true}

static func _ks23(b: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.055, -0.06), Vector3(0.052, 0.08, 0.2), C_METAL)
	_bx(b, Vector3(0, -0.02, 0.025), Vector3(0.034, 0.11, 0.045), C_POLY, -0.25)
	_bx(b, Vector3(0, 0.03, 0.22), Vector3(0.045, 0.1, 0.3), C_WOOD, 0.08)
	_bx(b, Vector3(0, 0.01, 0.37), Vector3(0.048, 0.14, 0.02), C_DARK)
	_tube(b, -0.15, -0.72, 0.07, 0.019, C_METAL)
	_tube(b, -0.15, -0.6, 0.03, 0.014, C_DARK)
	# цевьё помпы (подвижное)
	_bx(bo, Vector3(0, 0.035, -0.38), Vector3(0.05, 0.05, 0.16), C_WOOD)
	return {"hold": "shotgun", "fore": Vector3(0, 0.02, -0.38), "stock": Vector3(0, 0.03, 0.37), "muzzle": Vector3(0, 0.07, -0.72),
		"bolt_axis": Vector3(0, 0, 0.12), "bolt_pt": Vector3(0, 0.02, -0.38), "mag_pt": Vector3(0, 0.0, -0.06), "eye": Vector3(0, 0.11, 0.1)}

static func _pkm(b: MeshBuilder, mg: MeshBuilder, bo: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, 0.06, -0.12), Vector3(0.06, 0.085, 0.44), C_DARK)
	_bx(b, Vector3(0, -0.02, 0.03), Vector3(0.035, 0.11, 0.045), C_PLUM, -0.25)
	b.beam(Vector3(0, 0.07, 0.1), Vector3(0, 0.06, 0.42), 0.035, 0.03, C_WOOD)
	b.beam(Vector3(0, 0.0, 0.12), Vector3(0, -0.02, 0.42), 0.035, 0.025, C_WOOD)
	_bx(b, Vector3(0, 0.03, 0.43), Vector3(0.045, 0.13, 0.03), C_DARK)
	_tube(b, -0.34, -0.94, 0.07, 0.016, C_METAL)
	_tube(b, -0.34, -0.7, 0.035, 0.012, C_DARK)
	_tube(b, -0.94, -1.01, 0.07, 0.02, C_DARK)
	_bx(b, Vector3(0, 0.04, -0.3), Vector3(0.05, 0.05, 0.12), C_WOOD)
	b.beam(Vector3(0.012, 0.04, -0.7), Vector3(0.016, 0.03, -0.42), 0.01, 0.01, C_DARK)
	b.beam(Vector3(-0.012, 0.04, -0.7), Vector3(-0.016, 0.03, -0.42), 0.01, 0.01, C_DARK)
	b.beam(Vector3(0, 0.12, -0.22), Vector3(0, 0.15, -0.3), 0.02, 0.02, C_WOOD)
	# крышка ствольной коробки (откидывается)
	_bx(bo, Vector3(0, 0.0, 0.12), Vector3(0.058, 0.02, 0.24), C_METAL)
	# короб с лентой
	var mo := Vector3(0.0, 0.0, -0.12)
	_bx(mg, Vector3(0, -0.06, 0), Vector3(0.09, 0.12, 0.13), C_OLIVE)
	_bx(mg, Vector3(0.05, 0.05, 0), Vector3(0.05, 0.02, 0.04), Color(0.7, 0.5, 0.2, 0.2))
	return {"hold": "mg", "fore": Vector3(0, 0.0, -0.3), "stock": Vector3(0, 0.03, 0.44), "muzzle": Vector3(0, 0.07, -1.01),
		"mag_origin": mo, "mag_pt": mo + Vector3(0.0, -0.1, 0), "bolt_rot": Vector3(-1.1, 0, 0), "bolt_pivot": Vector3(0, 0.11, -0.12),
		"bolt_pt": Vector3(0, 0.12, -0.05), "eye": Vector3(0, 0.13, 0.1), "cover": true}

static func _rg6(b: MeshBuilder, br: MeshBuilder) -> Dictionary:
	_bx(b, Vector3(0, -0.02, 0.025), Vector3(0.036, 0.11, 0.05), C_POLY, -0.2)
	_bx(b, Vector3(0, 0.07, 0.0), Vector3(0.05, 0.05, 0.12), C_DARK)
	b.beam(Vector3(0.0, 0.08, 0.06), Vector3(0.0, 0.07, 0.42), 0.03, 0.03, C_DARK)
	b.beam(Vector3(0.0, 0.0, 0.06), Vector3(0.0, -0.02, 0.42), 0.02, 0.02, C_DARK)
	_bx(b, Vector3(0, 0.02, 0.43), Vector3(0.05, 0.14, 0.04), C_POLY)
	_tube(b, -0.36, -0.62, 0.1, 0.028, C_OLIVE, 0.0, 10)
	_tube(b, -0.04, -0.06, 0.1, 0.09, C_DARK, 0.0, 10)
	_tube(b, -0.3, -0.33, 0.1, 0.09, C_DARK, 0.0, 10)
	_bx(b, Vector3(0, -0.05, -0.45), Vector3(0.035, 0.12, 0.04), C_POLY, 0.25)
	_bx(b, Vector3(-0.04, 0.2, -0.2), Vector3(0.02, 0.05, 0.08), C_DARK)
	# барабан (вращается)
	var piv := Vector3(0, 0.1, -0.18)
	br.add_cyl(Transform3D(_rx(-PI / 2), Vector3(0, 0, 0.12)), 0.085, 0.085, 0.24, 6, C_OLIVE, true, false)
	for i in 6:
		var a := TAU * i / 6.0
		br.add_cyl(Transform3D(_rx(-PI / 2), Vector3(cos(a) * 0.055, sin(a) * 0.055, 0.125)), 0.022, 0.022, 0.01, 8, C_DARK)
	return {"hold": "launcher", "fore": Vector3(0, -0.07, -0.45), "stock": Vector3(0, 0.03, 0.44), "muzzle": Vector3(0, 0.1, -0.62),
		"barrel_pivot": piv, "barrel_axis": Vector3(0, 0, 1), "mag_pt": Vector3(0.0, 0.1, -0.06), "eye": Vector3(-0.04, 0.22, 0.1), "drum": true}
