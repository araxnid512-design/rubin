class_name BCSound
extends Node3D
## Звуки в пространстве: пул источников AudioStreamPlayer3D. Звук берётся по имени из assets/audio: варианты
## <имя>_1.ogg, <имя>_2.ogg … выбираются случайно (не два раза подряд один и тот же), одиночный — <имя>.ogg.
## Высота тона чуть плавает, чтобы повторы не звучали одинаково. Задержка — для гильзы, падения, звука удара.

const DIR := "res://assets/audio/"
const POOL := 12

var _players: Array[AudioStreamPlayer3D] = []
var _cache := {}          ## имя → [потоки]
var _last := {}           ## имя → индекс последнего варианта
var _loop: AudioStreamPlayer3D = null
var log_on := false       ## проверка: печатать, что прозвучало
var played: Array = []    ## [время, имя] — для проверки


func _ready() -> void:
	for i in POOL:
		var p := AudioStreamPlayer3D.new()
		p.unit_size = 6.0              # стенд — камера в 1–4 м, звук почти не тише от расстояния
		p.max_distance = 60.0
		p.attenuation_filter_cutoff_hz = 20500.0
		add_child(p)
		_players.append(p)
	_loop = AudioStreamPlayer3D.new()
	_loop.unit_size = 6.0
	add_child(_loop)


func _streams(n: String) -> Array:
	if _cache.has(n):
		return _cache[n]
	var out := []
	if ResourceLoader.exists(DIR + n + ".ogg"):
		out.append(load(DIR + n + ".ogg"))
	var i := 1
	while ResourceLoader.exists("%s%s_%d.ogg" % [DIR, n, i]):
		out.append(load("%s%s_%d.ogg" % [DIR, n, i]))
		i += 1
	_cache[n] = out
	return out


## сыграть звук n в точке at (мир); db — громкость, pitch — разброс высоты тона
func play(n: String, at: Vector3, db := 0.0, pitch := 0.06, delay := 0.0) -> void:
	if delay > 0.0:
		get_tree().create_timer(delay, false).timeout.connect(play.bind(n, at, db, pitch, 0.0))
		return
	var ss := _streams(n)
	if ss.is_empty():
		push_warning("нет звука " + n)
		return
	var k := randi() % ss.size()
	if ss.size() > 1 and k == int(_last.get(n, -1)):
		k = (k + 1) % ss.size()
	_last[n] = k
	var p: AudioStreamPlayer3D = null
	for q in _players:
		if not q.playing:
			p = q
			break
	if p == null:
		p = _players[0]
		_players.push_back(_players.pop_front())
	p.stream = ss[k]
	p.global_position = at
	p.volume_db = db
	p.pitch_scale = 1.0 + randf_range(-pitch, pitch)
	p.play()
	if log_on:
		played.append([Time.get_ticks_msec(), n])


## зацикленный звук (дыхание на бегу); "" — выключить
func loop(n: String, at: Vector3, db := 0.0) -> void:
	if n == "":
		if _loop.playing:
			_loop.stop()
		_loop.set_meta("n", "")
		return
	_loop.global_position = at
	_loop.volume_db = db
	if String(_loop.get_meta("n", "")) == n and _loop.playing:
		return
	var ss := _streams(n)
	if ss.is_empty():
		return
	var st: AudioStream = ss[0]
	if st is AudioStreamOggVorbis:
		(st as AudioStreamOggVorbis).loop = true
	_loop.stream = st
	_loop.set_meta("n", n)
	_loop.play()
	if log_on:
		played.append([Time.get_ticks_msec(), n + " (цикл)"])
