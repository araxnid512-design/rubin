class_name STTurret
extends StaticBody2D
## Турель экипажа: пулемёт (часто, слабо, 6 м) или лазер (редко, сильно, 8 м, ×2 по роботам). Поворачивается к
## ближайшему видимому врагу и стреляет, если ей хватает энергии (каждая единица «Турели» питает одну турель).
## Враги могут её разбить. Основание — в начале координат (сортировка), столкновение — слой предметов.

const KINDS := {
	"turret_gun": {"n": "Турель-пулемёт", "range": 6.0, "dmg": 5.0, "cool": 0.28, "hp": 90.0, "col": Color(1.0, 0.85, 0.35)},
	"turret_laser": {"n": "Лазерная турель", "range": 8.0, "dmg": 26.0, "cool": 1.3, "hp": 70.0, "col": Color(0.45, 0.85, 1.0)},
}
var kind := "turret_gun"
var faction := "crew"
var hp := 90.0
var aim := 0.0                    ## угол на земле (рад), 0 — к зрителю
var _cool := 0.0
var _dead := false
var _shown := 0.0


func _ready() -> void:
	var k: Dictionary = KINDS[kind]
	hp = k.hp
	collision_layer = 8
	var cs := CollisionShape2D.new()
	var sh := CircleShape2D.new()
	sh.radius = 16.0
	cs.shape = sh
	cs.position = Vector2(0, -6)
	add_child(cs)
	add_to_group("hittable")
	add_to_group("turret")


func alive() -> bool:
	return not _dead


func _index() -> int:
	var ss = Core.get_meta("shipst", null)
	return ss.turrets.find(self) if ss else 0


func powered() -> bool:
	var ss = Core.get_meta("shipst", null)
	return ss == null or _index() < int(ss.power.get("turrets", 0))


func _physics_process(delta: float) -> void:
	if _dead:
		return
	_cool = maxf(0.0, _cool - delta)
	_shown = maxf(0.0, _shown - delta)
	var k: Dictionary = KINDS[kind]
	if not powered():
		queue_redraw()
		return
	var foe: Node2D = null
	var bd: float = k.range
	for e in get_tree().get_nodes_in_group("enemy"):
		if not e.alive():
			continue
		var d := SP.dist_m(global_position, e.global_position)
		if d < bd:
			var q := PhysicsRayQueryParameters2D.create(global_position + Vector2(0, -10), e.global_position + Vector2(0, -10), 1)
			if get_world_2d().direct_space_state.intersect_ray(q).is_empty():
				bd = d
				foe = e
	if foe == null:
		return
	var g := SP.screen_to_ground(foe.global_position - global_position)
	aim = atan2(-g.x, g.y)
	queue_redraw()
	if _cool <= 0.0:
		_cool = k.cool
		var dmg: float = k.dmg * (2.0 if kind == "turret_laser" and foe.faction == "robot" else 1.0)
		STBolt.fire(get_parent(), global_position + Vector2(0, -4), foe.global_position, 22.0 if kind == "turret_gun" else 40.0, dmg, "crew",
			k.col, self)
		_shown = 0.06
		Core.play_at("turret_gun" if kind == "turret_gun" else "turret_laser", global_position, -8.0)


func damage(amount: float, _from := Vector2.ZERO, _who: Node = null) -> void:
	if _dead:
		return
	hp -= amount
	modulate = Color(1.6, 0.7, 0.7)
	create_tween().tween_property(self, "modulate", Color.WHITE, 0.2)
	if hp <= 0.0:
		_dead = true
		Core.say(KINDS[kind].n + " разбита.", "bad")
		Core.play_at("metal_clang", global_position, -2.0)
		var ss = Core.get_meta("shipst", null)
		if ss:
			ss.turrets.erase(self)
		queue_free()


func _draw() -> void:
	var k: Dictionary = KINDS[kind]
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, SP.K))
	draw_circle(Vector2.ZERO, 20.0, Color(0.15, 0.17, 0.2))
	draw_circle(Vector2.ZERO, 15.0, Color(0.35, 0.38, 0.42))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var head := Vector2(0, -22)
	var dir := SP.ground_to_screen(Vector2(-sin(aim), cos(aim)))
	var on := powered()
	draw_rect(Rect2(head - Vector2(12, 9), Vector2(24, 16)), Color(0.45, 0.47, 0.5) if on else Color(0.25, 0.26, 0.28))
	draw_line(head, head + dir * 26.0, Color(0.2, 0.2, 0.22), 6.0 if kind == "turret_gun" else 4.0)
	draw_circle(head + Vector2(0, -2), 3.0, k.col if on else Color(0.3, 0.1, 0.1))
	if _shown > 0.0:
		draw_circle(head + dir * 28.0, 7.0, Color(k.col, 0.9))
