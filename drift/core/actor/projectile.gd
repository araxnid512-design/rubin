class_name STBolt
extends Node2D
## Выстрел StarCore (бластер, пулемёт, лазер): летит по прямой на высоте груди, попадает в первого противника
## другой стороны (по расстоянию до линии), гаснет у стены (луч по слою стен). Рисуется светящимся штрихом.

var vel := Vector2.ZERO           ## px/с на экране
var dmg := 10.0
var faction := "crew"
var life := 1.0
var col := Color(1.0, 0.8, 0.3)
var owner_node: Node = null
const HEIGHT := 48.0              ## высота полёта над полом на экране (грудь), px


static func fire(parent: Node, from: Vector2, to: Vector2, speed_mps: float, damage: float, fac: String, color: Color, who: Node = null) -> STBolt:
	var b := STBolt.new()
	var d := SP.screen_to_ground(to - from).normalized()
	b.vel = SP.ground_to_screen(d) * speed_mps * SP.PPM
	b.dmg = damage
	b.faction = fac
	b.col = color
	b.owner_node = who
	b.life = 14.0 / speed_mps
	parent.add_child(b)
	b.global_position = from
	b.reset_physics_interpolation()
	STFx.muzzle(from + Vector2(0, -HEIGHT) + b.vel.normalized() * 18.0, color, 9.0)
	return b


func _physics_process(delta: float) -> void:
	var from := global_position
	var to := from + vel * delta
	# стена
	# луч на той же высоте, что и проверки видимости (−10 px), иначе выстрел «в зоне видимости» цепляет угол стены
	var q := PhysicsRayQueryParameters2D.create(from + Vector2(0, -10), to + Vector2(0, -10), 1)
	var hit := get_world_2d().direct_space_state.intersect_ray(q)
	if hit:
		Core.play_at("ricochet", hit.position + Vector2(0, 10), -12.0)
		STFx.sparks(hit.position + Vector2(0, 10 - HEIGHT), col, 6, 160.0)
		queue_free()
		return
	# противник рядом с линией полёта
	for e in get_tree().get_nodes_in_group("hittable"):
		# свои не попадают по своим: экипаж (герой, дроны, турели) — против всех остальных
		if (e.faction == "crew") == (faction == "crew") or not e.alive():
			continue
		var p := Geometry2D.get_closest_point_to_segment(e.global_position, from, to)
		if SP.dist_m(p, e.global_position) < 0.45:
			STFx.sparks(p + Vector2(0, -HEIGHT), col.lightened(0.3), 7, 200.0)
			e.damage(dmg, from, owner_node if is_instance_valid(owner_node) else null)
			Core.play_at("bullet_hit", e.global_position, -8.0)
			queue_free()
			return
	global_position = to
	life -= delta
	if life <= 0.0:
		queue_free()
	queue_redraw()


func _draw() -> void:
	var tail := -vel.normalized() * 22.0
	draw_line(Vector2(0, -HEIGHT), Vector2(0, -HEIGHT) + tail, col, 3.0, true)
	draw_circle(Vector2(0, -HEIGHT), 3.0, col.lightened(0.5))
