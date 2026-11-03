class_name AnimLod
extends RefCounted
## «Ленивая» анимация тех, кто стоит без дела (жители стаба, наёмники у своих коек) — ради FPS на телефоне.
## Обычно AnimationPlayer считает клип каждый кадр: скелет player.glb (65 костей) пересчитывается, и кожа (~23 тыс.
## вершин, 5 поверхностей) заново скинится на видеокарте. У десятка жителей «Полиса» и шести наёмников у коек это
## каждый кадр и ЦП, и ГП, хотя они только дышат на месте. Здесь AnimationPlayer переводится в ручной режим и
## продвигается своим шагом RATE раз в секунду — и только когда персонаж в кадре; за кадром клип стоит (скелет и кожа
## не считаются вовсе, Skeleton3D не меняется — перезаливки нет). Шаги разных персонажей разнесены по кадрам (случайная
## фаза), чтобы не совпадали в одном кадре. Клип стойки при 15 шагах в секунду с камеры сверху от плавного не отличить.
## Занят делом (идёт, бежит, стреляет, гибнет) — live(): всё снова каждый кадр, как раньше.

## Шагов анимации в секунду у стоящего в кадре (было — каждый кадр, до 60).
const RATE := 15.0
## Больше этого за раз не продвигать: стоял за кадром долго — клип стойки зациклен, хватит и этого.
const MAX_STEP := 4.0

var ap: AnimationPlayer
## Сейчас в ручном режиме (шаг считает lazy).
var manual := false
var _acc := 0.0

func _init(player: AnimationPlayer) -> void:
	ap = player
	_acc = randf() / RATE

## Стоит без дела: шаг клипа RATE раз в секунду и только в кадре (seen). true — в этом кадре был шаг (поза сменилась).
func lazy(delta: float, seen: bool) -> bool:
	if not is_instance_valid(ap):
		return false
	if not manual:
		manual = true
		ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_MANUAL
	_acc = minf(_acc + delta, MAX_STEP)
	if not seen or _acc < 1.0 / RATE:
		return false
	ap.advance(_acc)
	_acc = 0.0
	return true

## Занят делом: AnimationPlayer снова сам, каждый кадр.
func live() -> void:
	if not manual or not is_instance_valid(ap):
		return
	manual = false
	ap.callback_mode_process = AnimationMixer.ANIMATION_CALLBACK_MODE_PROCESS_IDLE
	_acc = randf() / RATE
