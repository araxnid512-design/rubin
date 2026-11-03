class_name WeaponView
extends Node3D
## Отдельная 3D-модель оружия в руках персонажа. Управляет подвижными частями:
## магазин (отсоединяется и переходит в руку), затвор/кожух/цевьё помпы/крышка,
## откидные стволы или барабан. Позицию задаёт скелет персонажа (HumanRig).

var id := ""
var info := {}
var hold := "rifle"
var reload_kind := "mag"
var body: MeshInstance3D
var mag: MeshInstance3D
var bolt: MeshInstance3D
var barrel_pivot: Node3D
var barrel: MeshInstance3D

var bolt_t := 0.0          # 0 — в покое, 1 — отведён
var open_t := 0.0          # переломка / откинутый барабан / крышка
var drum_angle := 0.0
var _drum_target := 0.0
var _kick := 0.0
var mag_state := 0         # 0 — в оружии, 1 — в руке, 2 — нет (убран в подсумок)
var mag_hand_xf := Transform3D.IDENTITY

func setup(weapon_id: String) -> void:
	id = weapon_id
	info = WeaponModels.get_model(id)
	var w: Dictionary = ItemDB.weapon(id)
	hold = w.get("hold", "rifle")
	reload_kind = w.get("reload", "mag")
	for c in get_children():
		c.queue_free()
	body = MeshInstance3D.new()
	body.name = "Body"
	body.mesh = info.body
	add_child(body)
	if info.mag_mesh != null:
		mag = MeshInstance3D.new()
		mag.name = "Magazine"
		mag.mesh = info.mag_mesh
		add_child(mag)
	if info.bolt_mesh != null:
		bolt = MeshInstance3D.new()
		bolt.name = "Bolt"
		bolt.mesh = info.bolt_mesh
		add_child(bolt)
	if info.barrel_mesh != null:
		barrel_pivot = Node3D.new()
		barrel_pivot.name = "BarrelPivot"
		barrel_pivot.position = info.barrel_pivot
		add_child(barrel_pivot)
		barrel = MeshInstance3D.new()
		barrel.mesh = info.barrel_mesh
		barrel_pivot.add_child(barrel)
	_apply()

func set_shadow(on: bool) -> void:
	for c in [body, mag, bolt, barrel]:
		if c != null:
			(c as MeshInstance3D).cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_ON if on else GeometryInstance3D.SHADOW_CASTING_SETTING_OFF

func point(name: String) -> Vector3:
	return info.get(name, Vector3.ZERO)

func muzzle_global() -> Vector3:
	return global_transform * (info.muzzle as Vector3)

func on_fire() -> void:
	## Отдача подвижных частей при выстреле.
	if reload_kind in ["mag", "pistol", "box", "clip"] and info.bolt_mesh != null and id != "mosin":
		_kick = 1.0
	if info.get("drum", false):
		_drum_target += TAU / 6.0

func update_parts(delta: float) -> void:
	_kick = maxf(0.0, _kick - delta * 14.0)
	drum_angle = lerpf(drum_angle, _drum_target, clampf(delta * 14.0, 0, 1))
	_apply()

func _apply() -> void:
	if mag != null:
		match mag_state:
			0:
				mag.visible = true
				mag.transform = Transform3D(Basis(), info.mag_origin)
			1:
				mag.visible = true
				mag.transform = mag_hand_xf
			_:
				mag.visible = false
	if bolt != null:
		var t := maxf(bolt_t, _kick * 0.9)
		var rot: Vector3 = info.get("bolt_rot", Vector3.ZERO)
		if info.has("bolt_pivot"):
			var piv: Vector3 = info.bolt_pivot
			bolt.transform = Transform3D(Basis.from_euler(rot * open_t), piv)
		elif rot != Vector3.ZERO:
			var c: Vector3 = info.get("bolt_center", Vector3.ZERO)
			var b := Basis.from_euler(rot * clampf(t * 2.0, 0, 1))
			bolt.transform = Transform3D(Basis(), (info.bolt_axis as Vector3) * clampf(t * 2.0 - 1.0, 0, 1) + c) * Transform3D(b, Vector3.ZERO) * Transform3D(Basis(), -c)
		else:
			bolt.transform = Transform3D(Basis(), (info.bolt_axis as Vector3) * t)
	if barrel_pivot != null:
		var ax: Vector3 = info.barrel_axis
		if info.get("drum", false):
			barrel_pivot.transform = Transform3D(Basis(ax, drum_angle) * Basis(Vector3.RIGHT, 0.0), info.barrel_pivot)
			barrel_pivot.position = (info.barrel_pivot as Vector3) + Vector3(0.09 * open_t, 0, 0)
		else:
			barrel_pivot.transform = Transform3D(Basis(ax, -0.55 * open_t), info.barrel_pivot)
