extends Node
## Глобальная шина событий. Связывает игровые системы без жёстких зависимостей.

signal message(text: String, kind: int)            # 0 — инфо, 1 — успех, 2 — тревога, 3 — радио
signal noise(pos: Vector3, radius: float, source: Node)
signal inventory_changed
signal warehouse_changed
signal equipment_changed
signal building_changed(id: String)
signal power_changed(on: bool)
signal quest_updated
signal objective_done(text: String)
signal actor_died(actor: Node)
signal player_hit(amount: float)
signal flag_set(flag: String)
signal area_visited(id: String)
signal soldier_changed(id: String)
signal ui_open(kind: String, data: Variant)
signal ui_closed(kind: String)
signal hold_progress(progress: float, label: String)
signal nav_rebaked
signal time_tick(hour: float)

enum Msg { INFO, GOOD, ALERT, RADIO }

func msg(text: String, kind: int = Msg.INFO) -> void:
	message.emit(text, kind)
