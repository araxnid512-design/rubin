class_name EnvProps
## Предметы окружения из Tripo (машины, мебель, улица — план docs/tripo/plan_environment.md): модель по виду, в
## настоящем размере (длина по большей горизонтальной оси, м), стоит на земле, центр — в начале осей, «вперёд» — +Z
## (как у предметов браузерной игры). Модель и её подгонка общие на все экземпляры (кэш по виду).

## Настоящая длина, м (большая горизонтальная ось).
const LENGTH := {
	"e_vaz2107": 4.13,
}

static var _fit := {}

## Новый экземпляр модели вида id или null, если файла нет.
static func instance(id: String) -> Node3D:
	var path := "res://assets/tripo/%s.glb" % id
	if not ResourceLoader.exists(path):
		return null
	var m: Node3D = (load(path) as PackedScene).instantiate()
	if not _fit.has(id):
		var pts := Gear._points(m)
		var box := Gear._box(pts)
		var long := maxf(box.size.x, box.size.z)
		var k := float(LENGTH.get(id, long)) / long if long > 0.001 else 1.0
		# длинная ось — вдоль Z (как у машин браузерной игры)
		var turn := Basis.IDENTITY if box.size.z >= box.size.x else Basis(Vector3.UP, PI * 0.5)
		var b := turn.scaled(Vector3.ONE * k)
		var c := box.get_center()
		var t := Transform3D(b, Vector3.ZERO) * Transform3D(Basis.IDENTITY, -Vector3(c.x, box.position.y, c.z))
		_fit[id] = t
	var root := Node3D.new()
	root.name = id
	m.transform = _fit[id]
	root.add_child(m)
	return root
