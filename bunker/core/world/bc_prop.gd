@tool
class_name BCProp
extends Node3D
## Предмет из каталога BunkerCore (BCPrefabs.CATALOG): в инспекторе выбирается id, предмет строится сам.
## Параметры предмета (цвет, количество, seed …) — словарь params.

@export var prefab := "crate_wood":
	set(v): prefab = v; _queue()
@export var params := {}:
	set(v): params = v; _queue()
@export var surface_only := false   ## виден только снаружи (предметы поверхности над бункером)

var _dirty := false


func _ready() -> void:
	_build()
	if surface_only:
		add_to_group("surface_only")


func _queue() -> void:
	if not is_inside_tree() or _dirty:
		return
	_dirty = true
	_build.call_deferred()


func _build() -> void:
	_dirty = false
	BCKit.clear_generated(self)
	var n := BCPrefabs.build(prefab, params)
	BCKit.mark(n)
	add_child(n)
