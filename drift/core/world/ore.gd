class_name STOre
extends Node2D
## Рудная жила StarCore на астероиде: «Добыть» — герой копает (1.2 с), дрон-ремонтник с приказом «добывать» —
## сам. Каждый раз — 1–2 единицы ресурса в трюм корабля; после нескольких раз жила иссякает.

const LOOK := {
	"metal": {"n": "Железная руда", "col": Color(0.62, 0.5, 0.42), "hi": Color(0.85, 0.72, 0.6)},
	"cells": {"n": "Энергокристаллы", "col": Color(0.2, 0.75, 0.95), "hi": Color(0.7, 1.0, 1.0)},
	"electronics": {"n": "Редкоземельная руда", "col": Color(0.35, 0.85, 0.4), "hi": Color(0.8, 1.0, 0.7)},
}
var res := "metal"
var left := 3
var it: STInteract
var _seed := 0


func _ready() -> void:
	add_to_group("ore")
	_seed = randi()
	it = STInteract.new()
	it.action = "use"
	it.verb = "Добыть"
	it.label = LOOK[res].n
	it.radius = 1.4
	it.position = Vector2(0, 6)
	add_child(it)
	it.used.connect(func(by):
		if by is STHero:
			by.work(1.2, func(): mine_by(by)))


func mine_by(_who: Node) -> void:
	if left <= 0:
		return
	left -= 1
	var n := randi_range(1, 2)
	var ss = Core.get_meta("shipst", null)
	if ss:
		ss.add(res, n)
		Core.say("%s +%d" % [ss.res_name(res), n], "good")
	Core.play_at("mine", global_position, -4.0)
	if left <= 0:
		remove_from_group("ore")
		it.enabled = false
		create_tween().tween_property(self, "modulate:a", 0.25, 0.6)
	queue_redraw()


func _draw() -> void:
	var lk: Dictionary = LOOK[res]
	var rng := RandomNumberGenerator.new()
	rng.seed = _seed
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, SP.K))
	draw_circle(Vector2.ZERO, 26.0, Color(0, 0, 0, 0.3))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	var n := 2 + left
	for i in n:
		var x := rng.randf_range(-18, 18)
		var h := rng.randf_range(16, 34) * (0.6 + 0.15 * left)
		var w := rng.randf_range(6, 10)
		var tip := Vector2(x + rng.randf_range(-6, 6), -h)
		draw_colored_polygon(PackedVector2Array([Vector2(x - w, 0), tip, Vector2(x + w, 0)]), lk.col)
		draw_line(Vector2(x - w * 0.3, -2), tip, lk.hi, 2.0)
