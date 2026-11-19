class_name ULPlaceMap
extends RefCounted
## Карты локаций для игрока: снимок локации строго сверху (запекается проверкой --as-test=mapbake, лежит в
## assets/ui/topmaps/top_<место>.jpg). На карте — всё поле и по MARGIN метров за его краем с каждой стороны;
## середина поля — середина карты, верх карты — «вверх» на экране в игре (−z).
## На базе карта есть всегда; во временных кластерах — если куплена вместе с маршрутом (ULBase.has_map).

const DIR := "res://assets/ui/topmaps/"
const MARGIN := 3.0


static func path(place: String) -> String:
	return "%stop_%s.jpg" % [DIR, place]


static func exists(place: String) -> bool:
	return ResourceLoader.exists(path(place))


## сколько метров на карте по x и по z
static func span(size_x: float, size_z: float) -> Vector2:
	return Vector2(size_x + MARGIN * 2.0, size_z + MARGIN * 2.0)


## точка мира → место на карте в долях (0…1 слева направо и сверху вниз); за краем карты — прижата к краю
static func to_uv(p: Vector3, size_x: float, size_z: float) -> Vector2:
	var sp := span(size_x, size_z)
	return Vector2(clampf(p.x / sp.x + 0.5, 0.0, 1.0), clampf(p.z / sp.y + 0.5, 0.0, 1.0))


## место на карте в долях → точка мира (на земле)
static func to_world(uv: Vector2, size_x: float, size_z: float) -> Vector3:
	var sp := span(size_x, size_z)
	return Vector3((uv.x - 0.5) * sp.x, 0.0, (uv.y - 0.5) * sp.y)
