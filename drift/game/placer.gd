extends Node2D
## Установка турели с предпросмотром: «призрак» турели на клетке перед героем — зелёный (можно) или красный
## (нельзя), круг дальности огня. «Действие» — поставить, «Огонь» — отмена (ресурсы возвращаются). Так же
## переставляют уже стоящую турель (move — её узел).

var kind := ""
var refund := {}
var move: STTurret = null
var cell := Vector2i(-9999, -9999)
var _t := 0.0


func _ready() -> void:
	z_index = 5
	Core.set_meta("place_mode", self)
	Core.say("Выберите место: «Поставить» — здесь, «Огонь» — отмена.", "info")


func _exit_tree() -> void:
	if Core.has_meta("place_mode") and Core.get_meta("place_mode") == self:
		Core.remove_meta("place_mode")


func _process(delta: float) -> void:
	_t += delta
	var main = get_parent()
	cell = main._turret_cell(Core.player.global_position, move)
	if cell.x != -9999:
		global_position = SP.cell_to_px(cell) + Vector2(0, 10)
	else:
		global_position = Core.player.global_position + Core.player.facing.normalized() * 60.0
	queue_redraw()


func confirm() -> void:
	if cell.x == -9999:
		Core.say("Здесь нельзя: нужен свободный пол своего корабля, не у двери.", "warn")
		return
	var main = get_parent()
	if move and is_instance_valid(move):
		main.move_turret(move, cell)
		Core.say("Турель переставлена.", "good")
	else:
		main.place_turret(kind, SP.cell_to_px(cell), true)
		Core.say("Установлена: %s." % STTurret.KINDS[kind].n, "good")
	Core.play_at("craft_metal", global_position, -4.0)
	STFx.sparks(global_position + Vector2(0, -20), Color(0.6, 0.9, 1.0), 10, 160.0)
	queue_free()


func cancel() -> void:
	if not move:
		var ss = Core.get_meta("shipst", null)
		if ss:
			for k in refund:
				ss.add(k, int(refund[k]))
		Core.say("Установка отменена, детали — на склад.", "info")
	queue_free()


func _draw() -> void:
	var ok := cell.x != -9999
	var c := Color(0.4, 1.0, 0.55) if ok else Color(1.0, 0.35, 0.3)
	var k: Dictionary = STTurret.KINDS.get(kind if kind != "" else move.kind, STTurret.KINDS.turret_gun)
	var pulse := 0.6 + 0.4 * sin(_t * 6.0)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, SP.K))
	var rr: float = float(k.range) * SP.PPM
	draw_arc(Vector2.ZERO, rr, 0, TAU, 64, Color(c, 0.35), 2.0, true)
	draw_circle(Vector2.ZERO, rr, Color(c, 0.05))
	draw_circle(Vector2.ZERO, 20.0, Color(c, 0.25 * pulse))
	draw_arc(Vector2.ZERO, 20.0, 0, TAU, 24, Color(c, 0.9), 2.0, true)
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_rect(Rect2(-12, -40, 24, 18), Color(c, 0.35 * pulse))
	draw_line(Vector2(0, -20), Vector2(0, -6), Color(c, 0.6), 3.0)
