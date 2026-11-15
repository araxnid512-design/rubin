class_name STActor
extends CharacterBody2D
## Персонаж StarCore (герой, экипаж, пираты, роботы): движение по полу в проекции 2.5D (скорость в м/с, глубина
## сжата), спрайт 8 направлений (STSprite8), здоровье, урон, гибель, сторона (crew / pirate / robot / beast).
## Ноги — в начале координат: сортировка по высоте экрана правильно ставит его перед стенами и предметами.

signal died(actor)

@export var faction := "crew"
@export var max_hp := 100.0
@export var sprite_dir := ""          ## папка атласов (res://assets/sprites/<имя>)
@export var color := Color(0.85, 0.55, 0.25)
var hp := 100.0
var state := "move"                   ## move / busy / dodge / dead
var spr: STSprite8
var facing := Vector2.DOWN            ## направление взгляда на экране
var speed_now := 0.0                  ## м/с


func _ready() -> void:
	hp = max_hp
	collision_layer = 2 if faction == "crew" else 4
	collision_mask = 1 | 8          # стены и предметы
	motion_mode = CharacterBody2D.MOTION_MODE_FLOATING
	var cs := CollisionShape2D.new()
	var cap := CapsuleShape2D.new()
	cap.radius = 11.0
	cap.height = 36.0
	cs.shape = cap
	cs.rotation = PI * 0.5
	add_child(cs)
	spr = STSprite8.new()
	spr.color = color
	add_child(spr)
	if sprite_dir != "":
		spr.setup(sprite_dir)
	add_to_group("actor")
	add_to_group("hittable")
	add_to_group("faction_" + faction)


## идти по полу: dir — направление на земле (единичный, x вправо, y «вглубь вниз»), speed — м/с
func walk(dir: Vector2, speed: float, delta: float, accel := 14.0) -> void:
	var want := SP.ground_to_screen(dir) * speed * SP.PPM
	velocity = velocity.move_toward(want, accel * SP.PPM * delta)
	move_and_slide()
	speed_now = SP.screen_to_ground(velocity).length() / SP.PPM
	if dir.length() > 0.1:
		facing = SP.ground_to_screen(dir)
	_anim_move()


func _anim_move() -> void:
	if state != "move" or spr == null:
		return
	spr.set_dir(SP.dir8(facing))
	spr.speed_mps = speed_now
	spr.play("run" if speed_now > 2.2 else ("walk" if speed_now > 0.3 else "idle"))


func face(to: Vector2) -> void:
	facing = to - global_position
	if spr:
		spr.set_dir(SP.dir8(facing))


func damage(amount: float, from := Vector2.ZERO, _attacker: Node = null) -> void:
	if state == "dead":
		return
	hp -= amount
	if hp <= 0.0:
		die()
		return
	if spr and spr.has_clip("hit"):
		spr.play("hit", true)
	_flash()


func _flash() -> void:
	var tw := create_tween()
	tw.tween_property(self, "modulate", Color(1.8, 0.6, 0.6), 0.05)
	tw.tween_property(self, "modulate", Color.WHITE, 0.15)


func die() -> void:
	state = "dead"
	hp = 0.0
	velocity = Vector2.ZERO
	collision_layer = 0
	if spr:
		spr.play("death", true)
	died.emit(self)


func alive() -> bool:
	return state != "dead"
