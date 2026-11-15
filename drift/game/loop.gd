extends Node
## Цикл «Дрейфа»: ТИШИНА (10 минут на свои дела) → ТРЕВОГА (что-то сближается: 30 секунд, чтобы уйти прыжком
## с пульта) → СОБЫТИЕ (game/events.gd: стыковка, абордаж, астероид, станция, метеоры) → итог → снова тишина,
## следующий сектор. Здесь же окно приказов дронам.

const CALM_SEC := 600.0
const ALARM_SEC := 30.0
var phase := "calm"            ## calm / alarm / event
var t_left := CALM_SEC
var alarm_t := 0.0
var sector := 1
var jumps := 0


func _ready() -> void:
	Core.loop = self
	Core.save.register("loop", self)


func ev() -> Node:
	return Core.get_meta("events", null)


func _process(delta: float) -> void:
	if get_tree().paused:
		return
	match phase:
		"calm":
			t_left -= delta
			if t_left <= 60.0 and t_left + delta > 60.0:
				Core.say("Минута до сближения. Приготовьтесь.", "warn")
			if t_left <= 0.0:
				t_left = 0.0
				phase = "alarm"
				alarm_t = ALARM_SEC
				var e := ev()
				Core.say("Сближение: «%s»! 30 секунд — уйти прыжком с пульта на мостике или встречать." % (e.ev_name(e._forced_id()) if e else "?"), "bad")
				Core.play_ui("alarm", -10.0)
		"alarm":
			alarm_t -= delta
			if alarm_t <= 0.0 and ev():
				ev().forced()


func phase_title() -> String:
	match phase:
		"calm": return "ТИШИНА · сектор %d" % sector
		"alarm": return "ТРЕВОГА · пульт на мостике"
		"event": return ev().status_line() if ev() else "СОБЫТИЕ"
	return ""


func timer_text() -> String:
	match phase:
		"calm": return "%02d:%02d" % [int(t_left) / 60, int(t_left) % 60]
		"alarm": return "00:%02d" % ceili(maxf(0.0, alarm_t))
		"event": return ev().timer_text() if ev() else "—:—"
	return "—:—"


## событие окончено — следующий сектор, снова тишина
func next_calm() -> void:
	phase = "calm"
	t_left = CALM_SEC
	sector += 1
	jumps += 1


# ---------------- дроны ----------------

const ORDERS := {"drone_combat": ["follow", "guard"], "drone_worker": ["follow", "repair", "mine", "guard"]}


func drone_orders() -> void:
	var ss = Core.get_meta("shipst", null)
	if ss == null:
		return
	var rows := []
	for d in ss.drones:
		if not is_instance_valid(d) or not d.alive():
			continue
		var list: Array = ORDERS.get(d.kind, ["follow"])
		rows.append(["%s · здоровье %d" % [d.label(), roundi(d.hp)], "Приказ ▸", func():
			var i := list.find(d.order)
			d.order = list[(i + 1) % list.size()]
			if d.order == "guard":
				d.guard_pos = Core.player.global_position
			drone_orders(), true, "Ко мне", func():
			d.order = "follow"
			drone_orders(), d.order != "follow"])
	if rows.is_empty():
		Core.hud.show_text("Дроны", "Дронов нет. Соберите их на верстаке в мастерской: боевой дрон — защита, ремонтник — чинит пробоины и добывает руду.")
		return
	var head := "«Приказ» — следующий приказ: за мной → охранять здесь (боевой); ремонтник ещё чинит и добывает руду."
	if not ss.powered("drones"):
		head += "\nЗарядка дронов без энергии: летают медленно, боевые не стреляют."
	Core.hud.rows2("Дроны", head, rows)


func get_state() -> Dictionary:
	return {"phase": phase, "t": t_left, "sector": sector, "jumps": jumps}


func set_state(s: Dictionary) -> void:
	# событие не сохраняется: после загрузки — тишина (если сохранились во время события — сближение скоро)
	phase = "calm"
	t_left = float(s.get("t", CALM_SEC)) if s.get("phase", "calm") == "calm" else 60.0
	sector = int(s.get("sector", 1))
	jumps = int(s.get("jumps", 0))
