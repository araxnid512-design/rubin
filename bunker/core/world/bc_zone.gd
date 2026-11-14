@tool
class_name BCZone
extends Area3D
## Зона мира: объём, в котором действуют свои правила — вид (поверхность/вход/бункер/постройка), уровень
## радиации, набор света и звуков, скрытие поверхности или крыши. Игрок в нескольких зонах сразу — главная та,
## у которой приоритет выше.

@export_enum("surface", "entrance", "bunker", "building") var kind := "surface"
@export var zone_name := "Поверхность"
@export var size := Vector3(10, 4, 10):
	set(v):
		size = v
		_rebuild()
@export var rad_rate := -1.0          ## мЗв/ч; -1 — по полю радиации среды
@export var env_preset := "surface"   ## surface / bunker / entrance / building
@export var hide_surface := false     ## скрыть поверхность (игрок под землёй)
@export var roof_tag := ""            ## скрыть крыши с этой меткой
@export var zone_priority := 0


func _ready() -> void:
	collision_layer = 0
	collision_mask = 2      # игрок
	monitoring = true
	monitorable = false
	_rebuild()
	if Engine.is_editor_hint():
		return
	body_entered.connect(func(b): if b == Core.player: Core.world.enter_zone(self))
	body_exited.connect(func(b): if b == Core.player: Core.world.exit_zone(self))


func _rebuild() -> void:
	if not is_inside_tree():
		return
	var cs: CollisionShape3D = get_node_or_null("Shape")
	if cs == null:
		cs = CollisionShape3D.new()
		cs.name = "Shape"
		add_child(cs)
	var b := BoxShape3D.new()
	b.size = size
	cs.shape = b
	cs.position = Vector3(0, size.y * 0.5, 0)


func info() -> Dictionary:
	return {"kind": kind, "name": zone_name, "rad": rad_rate, "env": env_preset, "hide_surface": hide_surface, "roof": roof_tag}
