class_name BCWeapon
## Оружие ближнего боя BunkerCore: модель в правой руке персонажа (BoneAttachment3D на кисти) и его свойства.
## Положение в кулаке считается по костям пальцев в позе покоя (а не по осям кисти, которые у разных
## скелетов направлены по-разному): ось оружия — поперёк ладони (от мизинца к указательному), центр хвата —
## у основания пальцев, большая часть длины выступает со стороны большого пальца.

## урон лёгкого / тяжёлого удара, дальность, расход выносливости, скорость клипа, прочность (−1 за удар,
## −2 за тяжёлый; на нуле ломается), короткое имя для кнопки. Пистолет: урон, дальность, магазин.
const STATS := {
	"": {"n": "Кулаки", "short": "Удар", "light": 12.0, "heavy": 25.0, "reach": 1.4, "st": 6.0, "rate": 1.15},
	"knife": {"n": "Нож", "short": "Нож", "light": 18.0, "heavy": 32.0, "reach": 1.35, "st": 5.0, "rate": 1.4, "dur": 80.0},
	"pipe": {"n": "Стальная труба", "short": "Труба", "light": 24.0, "heavy": 46.0, "reach": 1.85, "st": 10.0, "rate": 1.0, "dur": 120.0},
	"crowbar": {"n": "Лом", "short": "Лом", "light": 32.0, "heavy": 60.0, "reach": 1.9, "st": 14.0, "rate": 0.82, "dur": 200.0},
	"pistol": {"n": "Пистолет ПМ", "short": "ПМ", "gun": true, "dmg": 38.0, "range": 16.0, "mag": 8, "cool": 0.42, "reach": 1.4,
		"light": 12.0, "heavy": 25.0, "st": 6.0, "rate": 1.15},
}
const ORDER := ["", "knife", "pipe", "crowbar", "pistol"]


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
	var ba := rig.attach("R_Hand", holder)
	if ba:
		ba.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	return holder


static func _child_origin(sk: Skeleton3D, bone: String) -> Vector3:
	var b := sk.find_bone(bone)
	return sk.get_bone_rest(b).origin if b >= 0 else Vector3.ZERO


static func _mesh(id: String) -> MeshInstance3D:
	var mk := BCMesh.new()
	match id:
		"knife":
			# рукоять в кулаке, клинок — со стороны большого пальца (как труба)
			mk.cyl("rubber", Transform3D.IDENTITY, 0.018, 0.12, Vector3(0, -0.06, 0), 8)
			mk.box("steel_dark", Transform3D.IDENTITY, Vector3(0.05, 0.012, 0.02), Vector3(0, 0.065, 0))
			mk.box("steel", Transform3D.IDENTITY, Vector3(0.006, 0.17, 0.03), Vector3(0, 0.155, 0.004))
		"crowbar":
			mk.cyl("paint_red", Transform3D.IDENTITY, 0.016, 0.78, Vector3(0, -0.2, 0), 8)
			mk.box("steel_dark", Transform3D.IDENTITY, Vector3(0.03, 0.03, 0.12), Vector3(0, 0.6, 0.05))
			mk.box("steel_dark", Transform3D.IDENTITY, Vector3(0.03, 0.06, 0.03), Vector3(0, -0.22, -0.02))
		"pistol":
			# рукоять — поперёк кулака (ось Y), ствол — вперёд по пальцам (ось Z), затвор сверху
			mk.box("plastic_dark", Transform3D(Basis(Vector3.RIGHT, -0.25), Vector3(0, 0.0, -0.01)), Vector3(0.028, 0.11, 0.035), Vector3.ZERO)
			mk.box("steel_dark", Transform3D.IDENTITY, Vector3(0.026, 0.032, 0.16), Vector3(0, 0.07, 0.045))
			mk.box("steel", Transform3D.IDENTITY, Vector3(0.02, 0.012, 0.03), Vector3(0, 0.035, 0.03))
			mk.cyl("black", Transform3D(Basis(Vector3.RIGHT, PI * 0.5), Vector3(0, 0.07, 0.126)), 0.006, 0.004, Vector3.ZERO, 8)
		"pipe":
			# от −0.16 (ниже кулака) до +0.46 (со стороны большого пальца); у кулака — обмотка изолентой
			mk.cyl("rust", Transform3D.IDENTITY, 0.022, 0.62, Vector3(0, -0.16, 0), 10)
			mk.cyl("rubber", Transform3D.IDENTITY, 0.026, 0.18, Vector3(0, -0.09, 0), 10)
			mk.cyl("steel_dark", Transform3D.IDENTITY, 0.03, 0.04, Vector3(0, 0.43, 0), 10)
	var mi := mk.to_instance(true)
	mi.name = "Mesh"
	return mi
