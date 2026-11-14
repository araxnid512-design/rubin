class_name BCWeapon
## Оружие ближнего боя BunkerCore: модель в правой руке персонажа (BoneAttachment3D на кисти) и его свойства.
## Положение в кулаке считается по костям пальцев в позе покоя (а не по осям кисти, которые у разных
## скелетов направлены по-разному): ось оружия — поперёк ладони (от мизинца к указательному), центр хвата —
## у основания пальцев, большая часть длины выступает со стороны большого пальца.

## урон лёгкого / тяжёлого удара, дальность, расход выносливости, скорость клипа
const STATS := {
	"": {"n": "Кулаки", "light": 12.0, "heavy": 25.0, "reach": 1.4, "st": 6.0, "rate": 1.15},
	"pipe": {"n": "Стальная труба", "light": 24.0, "heavy": 46.0, "reach": 1.85, "st": 10.0, "rate": 1.0},
}


static func stats(id: String) -> Dictionary:
	return STATS.get(id, STATS[""])


## повесить модель оружия на правую кисть; вернуть узел (null — нет скелета или кисти)
static func attach(rig: BCCharacter, id: String) -> Node3D:
	if rig == null or rig.skel == null or id == "":
		return null
	var sk := rig.skel
	var hand := sk.find_bone("R_Hand")
	if hand < 0:
		return null
	var mid := _child_origin(sk, "R_Mid1")
	var idx := _child_origin(sk, "R_Index1")
	var pinky := _child_origin(sk, "R_Pinky1")
	if mid == Vector3.ZERO or idx == Vector3.ZERO or pinky == Vector3.ZERO:
		return null
	var k := maxf(rig.scale_k, 0.0001)        # оружие в единицах модели (модель масштабирована до 1.8 м)
	var axis := (idx - pinky).normalized()     # поперёк кулака
	var fingers := mid.normalized()
	var side := axis.cross(fingers).normalized()
	fingers = side.cross(axis).normalized()
	var grip := mid * 0.95 + side * (0.02 / k)
	var holder := Node3D.new()
	holder.name = "Weapon_" + id
	holder.add_child(_mesh(id))
	holder.transform = Transform3D(Basis(side, axis, fingers).scaled(Vector3.ONE / k), grip)
	rig.attach("R_Hand", holder)
	return holder


static func _child_origin(sk: Skeleton3D, bone: String) -> Vector3:
	var b := sk.find_bone(bone)
	return sk.get_bone_rest(b).origin if b >= 0 else Vector3.ZERO


static func _mesh(id: String) -> MeshInstance3D:
	var mk := BCMesh.new()
	match id:
		"pipe":
			# от −0.16 (ниже кулака) до +0.46 (со стороны большого пальца); у кулака — обмотка изолентой
			mk.cyl("rust", Transform3D.IDENTITY, 0.022, 0.62, Vector3(0, -0.16, 0), 10)
			mk.cyl("rubber", Transform3D.IDENTITY, 0.026, 0.18, Vector3(0, -0.09, 0), 10)
			mk.cyl("steel_dark", Transform3D.IDENTITY, 0.03, 0.04, Vector3(0, 0.43, 0), 10)
	var mi := mk.to_instance(true)
	mi.name = "Mesh"
	return mi
