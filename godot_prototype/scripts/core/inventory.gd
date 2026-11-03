class_name Inventory
extends RefCounted
## Инвентарь из ячеек. Каждая ячейка: {"id": String, "n": int, "ammo": int (для оружия)} или null.

signal changed

var slots: Array = []
var capacity: int = 16

func _init(cap: int = 16) -> void:
	capacity = cap
	slots.resize(cap)

func resize(cap: int) -> void:
	capacity = cap
	slots.resize(cap)
	changed.emit()

func count(id: String) -> int:
	var c := 0
	for s in slots:
		if s != null and s.id == id:
			c += int(s.n)
	return c

func free_slots() -> int:
	var c := 0
	for s in slots:
		if s == null:
			c += 1
	return c

func can_add(id: String, n: int) -> int:
	## Сколько единиц поместится.
	var stack := ItemDB.stack_size(id)
	var room := 0
	for s in slots:
		if s == null:
			room += stack
		elif s.id == id and not ItemDB.is_weapon(id):
			room += max(0, stack - int(s.n))
	return min(n, room)

func add(id: String, n: int, extra: Dictionary = {}) -> int:
	## Добавляет предмет, возвращает остаток, который не поместился.
	if n <= 0:
		return 0
	var stack := ItemDB.stack_size(id)
	var left := n
	if not ItemDB.is_weapon(id):
		for s in slots:
			if left <= 0:
				break
			if s != null and s.id == id and int(s.n) < stack:
				var put: int = min(stack - int(s.n), left)
				s.n = int(s.n) + put
				left -= put
	for i in slots.size():
		if left <= 0:
			break
		if slots[i] == null:
			var put: int = min(stack, left)
			var d := {"id": id, "n": put}
			for k in extra:
				d[k] = extra[k]
			slots[i] = d
			left -= put
	if left != n:
		changed.emit()
	return left

func remove(id: String, n: int) -> int:
	## Удаляет n единиц, возвращает сколько удалено.
	var left := n
	for i in range(slots.size() - 1, -1, -1):
		if left <= 0:
			break
		var s = slots[i]
		if s != null and s.id == id:
			var take: int = min(int(s.n), left)
			s.n = int(s.n) - take
			left -= take
			if int(s.n) <= 0:
				slots[i] = null
	if left != n:
		changed.emit()
	return n - left

func take_slot(i: int) -> Variant:
	var s = slots[i]
	slots[i] = null
	if s != null:
		changed.emit()
	return s

func put_slot(i: int, s: Variant) -> void:
	slots[i] = s
	changed.emit()

func first_index(id: String) -> int:
	for i in slots.size():
		if slots[i] != null and slots[i].id == id:
			return i
	return -1

func is_empty() -> bool:
	for s in slots:
		if s != null:
			return false
	return true

func items_summary() -> Dictionary:
	var d := {}
	for s in slots:
		if s != null:
			d[s.id] = d.get(s.id, 0) + int(s.n)
	return d

func to_data() -> Array:
	var out := []
	for s in slots:
		out.append(null if s == null else s.duplicate())
	return out

func from_data(data: Array) -> void:
	slots.resize(capacity)
	for i in capacity:
		slots[i] = null
	for i in min(data.size(), capacity):
		if data[i] != null:
			var d: Dictionary = data[i]
			var s := {"id": String(d.id), "n": int(d.n)}
			if d.has("ammo"):
				s["ammo"] = int(d.ammo)
			slots[i] = s
	changed.emit()
