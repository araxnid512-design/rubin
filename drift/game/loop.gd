extends Node
## Цикл «Дрейфа»: ТИШИНА (10 минут на свои дела) → тревога → ПРЫЖОК (выбор точки на пульте) → СОБЫТИЕ
## (стыковка, абордаж, астероид …) → итог → снова тишина. Сейчас — каркас: таймер, фазы, сохранение.

const CALM_SEC := 600.0
var phase := "calm"            ## calm / alarm / event
var t_left := CALM_SEC
var sector := 1
var jumps := 0


func _ready() -> void:
	Core.loop = self
	Core.save.register("loop", self)


func _process(delta: float) -> void:
	if get_tree().paused:
		return
	if phase == "calm":
		t_left -= delta
		if t_left <= 60.0 and t_left + delta > 60.0:
			Core.say("Минута до сближения. Приготовьтесь.", "warn")
		if t_left <= 0.0:
			t_left = 0.0
			phase = "alarm"
			Core.say("Сближение! Встать к пульту на мостике.", "bad")


func phase_title() -> String:
	return {"calm": "ТИШИНА · сектор %d" % sector, "alarm": "ТРЕВОГА · к пульту", "event": "СОБЫТИЕ"}.get(phase, "")


func timer_text() -> String:
	if phase != "calm":
		return "—:—"
	return "%02d:%02d" % [int(t_left) / 60, int(t_left) % 60]


## начать прыжок раньше (кнопка на пульте)
func jump_now() -> void:
	t_left = 0.0


func get_state() -> Dictionary:
	return {"phase": phase, "t": t_left, "sector": sector, "jumps": jumps}


func set_state(s: Dictionary) -> void:
	phase = s.get("phase", "calm")
	t_left = s.get("t", CALM_SEC)
	sector = int(s.get("sector", 1))
	jumps = int(s.get("jumps", 0))
