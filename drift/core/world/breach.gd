class_name STBreach
extends Node2D
## Пробоина или пожар на корабле StarCore: пока есть — уходит кислород (ShipState считает группу "repairable"),
## пожар ещё и обжигает рядом стоящих. «Заварить» / «Потушить» — герой (1.5 с) или дрон-ремонтник (сам).

var fire := false
var it: STInteract
var _t := 0.0
var _hurt := 0.0


func _ready() -> void:
	add_to_group("repairable")
	it = STInteract.new()
	it.action = "use"
	it.verb = "Потушить" if fire else "Заварить"
	it.label = "Пожар" if fire else "Пробоина в корпусе"
	it.radius = 1.5
	add_child(it)
	it.used.connect(func(by):
		if by is STHero:
			by.work(1.5, func(): repair_by(by)))


func repair_by(_who: Node) -> void:
	if not is_in_group("repairable"):
		return
	remove_from_group("repairable")
	it.enabled = false
	STFx.sparks(global_position + Vector2(0, -12), Color(0.7, 0.9, 1.0), 14, 240.0)
	Core.play_at("weld", global_position, -3.0)
	Core.say("Пожар потушен." if fire else "Пробоина заварена.", "good")
	var tw := create_tween()
	tw.tween_property(self, "modulate:a", 0.0, 0.5)
	tw.tween_callback(queue_free)


var _puff := 0.0


func _process(delta: float) -> void:
	_t += delta
	_puff -= delta
	if _puff <= 0.0 and is_in_group("repairable"):
		_puff = 0.35 if fire else 0.6
		if fire:
			STFx.smoke(global_position + Vector2(0, -40), 1, Color(0.15, 0.14, 0.14), 0.5, 11.0)
			STFx.sparks(global_position + Vector2(0, -20), Color(1.0, 0.6, 0.2), 2, 90.0)
		else:
			STFx.smoke(global_position + Vector2(0, -8), 1, Color(0.75, 0.8, 0.85), 0.25, 8.0)
	if fmod(_t, 0.1) < delta:
		queue_redraw()
	if fire and is_in_group("repairable"):
		_hurt -= delta
		var p = Core.player
		if p and p.alive() and SP.dist_m(p.global_position, global_position) < 0.9 and _hurt <= 0.0:
			_hurt = 0.5
			p.damage(4.0, global_position, null)


func _draw() -> void:
	var r := RandomNumberGenerator.new()
	r.seed = int(_t * 10.0)
	if fire:
		for i in 6:
			var x := r.randf_range(-16, 16)
			var h := r.randf_range(18, 46)
			var c := Color(1.0, r.randf_range(0.35, 0.75), 0.15, 0.85)
			draw_colored_polygon(PackedVector2Array([Vector2(x - 8, 0), Vector2(x + r.randf_range(-5, 5), -h), Vector2(x + 8, 0)]), c)
	else:
		draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, SP.K))
		draw_circle(Vector2.ZERO, 16.0, Color(0.03, 0.03, 0.05))
		draw_arc(Vector2.ZERO, 17.0, 0, TAU, 20, Color(0.5, 0.45, 0.4), 3.0)
		draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
		for i in 4:
			var a := r.randf_range(0, TAU)
			var p0 := Vector2(0, -6)
			draw_line(p0, p0 + Vector2(cos(a), sin(a) - 0.8) * r.randf_range(8, 20), Color(1.0, 0.85, 0.4), 2.0)
