extends Node
## Процедурные звуки (генерируются при запуске — не нужны внешние файлы).
## play(name) — 2D-звук интерфейса, play_at(name, pos) — позиционный звук в мире.

const RATE := 22050
var streams := {}
var _pool3d: Array[AudioStreamPlayer3D] = []
var _pool2d: Array[AudioStreamPlayer] = []
var _i3 := 0
var _i2 := 0
var _ambient: AudioStreamPlayer
var volume := 1.0

func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	var t0 := Time.get_ticks_msec()
	_gen_all()
	for i in 14:
		var p := AudioStreamPlayer3D.new()
		p.unit_size = 8.0
		p.max_distance = 90.0
		p.attenuation_filter_cutoff_hz = 6000.0
		add_child(p)
		_pool3d.append(p)
	for i in 6:
		var p := AudioStreamPlayer.new()
		add_child(p)
		_pool2d.append(p)
	_ambient = AudioStreamPlayer.new()
	_ambient.volume_db = -14.0
	add_child(_ambient)
	print("[Sfx] сгенерировано %d звуков за %d мс" % [streams.size(), Time.get_ticks_msec() - t0])

func _wav(data: PackedFloat32Array, loop: bool = false) -> AudioStreamWAV:
	var bytes := PackedByteArray()
	bytes.resize(data.size() * 2)
	for i in data.size():
		bytes.encode_s16(i * 2, int(clampf(data[i], -1.0, 1.0) * 32000.0))
	var w := AudioStreamWAV.new()
	w.format = AudioStreamWAV.FORMAT_16_BITS
	w.mix_rate = RATE
	w.stereo = false
	w.data = bytes
	if loop:
		w.loop_mode = AudioStreamWAV.LOOP_FORWARD
		w.loop_end = data.size()
	return w

func _shot(dur: float, body: float, crack: float, low: float, seed_v: int) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var lp := 0.0
	var lp2 := 0.0
	for i in n:
		var t := float(i) / RATE
		var noise := rng.randf_range(-1, 1)
		lp += (noise - lp) * low
		lp2 += (lp - lp2) * 0.3
		var env := exp(-t * body)
		var c := exp(-t * crack) * noise
		var boom := sin(t * 2 * PI * (90.0 - t * 120.0)) * exp(-t * body * 0.7) * 0.6
		d[i] = (lp2 * 2.2 * env + c * 0.5 + boom) * 0.8
	return d

func _gen_all() -> void:
	streams["shot_pistol"] = _wav(_shot(0.35, 14.0, 60.0, 0.35, 1))
	streams["shot_rifle"] = _wav(_shot(0.45, 10.0, 45.0, 0.3, 2))
	streams["shot_smg"] = _wav(_shot(0.3, 15.0, 55.0, 0.4, 3))
	streams["shot_mg"] = _wav(_shot(0.5, 8.0, 40.0, 0.25, 4))
	streams["shot_sniper"] = _wav(_shot(0.9, 5.0, 30.0, 0.22, 5))
	streams["shot_shotgun"] = _wav(_shot(0.6, 7.0, 25.0, 0.2, 6))
	streams["shot_launcher"] = _wav(_shot(0.5, 9.0, 20.0, 0.12, 7))
	streams["shot_silenced"] = _wav(_shot(0.18, 30.0, 90.0, 0.6, 8))
	streams["explosion"] = _wav(_shot(1.4, 3.0, 12.0, 0.08, 9))
	streams["click"] = _wav(_tone(0.04, 1800.0, 80.0, 0.4))
	streams["reload"] = _wav(_clank(0.5, 3))
	streams["pickup"] = _wav(_clank(0.18, 1))
	streams["ui"] = _wav(_tone(0.06, 900.0, 50.0, 0.35))
	streams["ui_ok"] = _wav(_tone(0.15, 660.0, 18.0, 0.35, 990.0))
	streams["step"] = _wav(_noise_burst(0.09, 45.0, 0.15, 11))
	streams["hit"] = _wav(_noise_burst(0.12, 30.0, 0.5, 12))
	streams["impact"] = _wav(_noise_burst(0.08, 50.0, 0.7, 13))
	streams["bark"] = _wav(_bark())
	streams["growl"] = _wav(_growl())
	streams["groan"] = _wav(_groan())
	streams["hammer"] = _wav(_clank(0.25, 2))
	streams["door"] = _wav(_creak())
	streams["build_done"] = _wav(_tone(0.5, 440.0, 4.0, 0.3, 660.0))
	streams["power_on"] = _wav(_hum(1.2, false))
	streams["radio"] = _wav(_static(1.5, false))
	streams["zap"] = _wav(_noise_burst(0.35, 8.0, 0.9, 14))
	streams["fire"] = _wav(_noise_burst(0.6, 3.0, 0.3, 15))
	streams["amb_wind"] = _wav(_wind(6.0), true)
	streams["amb_hum"] = _wav(_hum(2.0, true), true)
	streams["amb_radio"] = _wav(_static(3.0, true), true)

func _tone(dur: float, f: float, decay: float, amp: float, f2: float = -1.0) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	for i in n:
		var t := float(i) / RATE
		var ff := f if f2 < 0 or t < dur * 0.5 else f2
		d[i] = sin(t * TAU * ff) * exp(-t * decay) * amp
	return d

func _noise_burst(dur: float, decay: float, lowpass: float, seed_v: int) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1, 1) - lp) * lowpass
		d[i] = lp * exp(-t * decay) * 1.4
	return d

func _clank(dur: float, seed_v: int) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = seed_v
	var hits := [0.0, dur * 0.45]
	for i in n:
		var t := float(i) / RATE
		var v := 0.0
		for h in hits:
			var dt := t - float(h)
			if dt >= 0:
				v += (sin(dt * TAU * 2300.0) * 0.4 + sin(dt * TAU * 3400.0) * 0.3 + rng.randf_range(-0.3, 0.3)) * exp(-dt * 40.0)
		d[i] = v * 0.5
	return d

func _bark() -> PackedFloat32Array:
	var n := int(0.3 * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	for i in n:
		var t := float(i) / RATE
		var f := 420.0 - t * 700.0
		var env := sin(minf(t / 0.3, 1.0) * PI)
		d[i] = (sin(t * TAU * f) * 0.6 + sin(t * TAU * f * 2.1) * 0.3 + rng.randf_range(-0.4, 0.4)) * env * 0.6
	return d

func _growl() -> PackedFloat32Array:
	var n := int(0.8 * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1, 1) - lp) * 0.08
		var am := 0.6 + 0.4 * sin(t * TAU * 28.0)
		d[i] = (lp * 3.0 + sin(t * TAU * 95.0) * 0.3) * am * sin(minf(t / 0.8, 1.0) * PI) * 0.7
	return d

func _groan() -> PackedFloat32Array:
	var n := int(1.0 * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	var lp := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1, 1) - lp) * 0.05
		var f := 140.0 + sin(t * 3.0) * 25.0
		d[i] = (sin(t * TAU * f) * 0.4 + lp * 2.0) * sin(minf(t, 1.0) * PI) * 0.5
	return d

func _creak() -> PackedFloat32Array:
	var n := int(0.6 * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	for i in n:
		var t := float(i) / RATE
		var f := 300.0 + sin(t * 9.0) * 120.0
		d[i] = sin(t * TAU * f) * (0.5 + 0.5 * sin(t * TAU * 60.0)) * sin(minf(t / 0.6, 1.0) * PI) * 0.25
	return d

func _hum(dur: float, loop: bool) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	for i in n:
		var t := float(i) / RATE
		var env := 1.0 if loop else minf(t * 2.0, 1.0)
		d[i] = (sin(t * TAU * 50.0) * 0.5 + sin(t * TAU * 100.0) * 0.25 + sin(t * TAU * 150.0) * 0.1) * env * 0.4
	return d

func _static(dur: float, loop: bool) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 21
	for i in n:
		var t := float(i) / RATE
		var crackle := 1.0 if rng.randf() < 0.002 else 0.0
		d[i] = (rng.randf_range(-1, 1) * 0.25 * (0.6 + 0.4 * sin(t * 3.0)) + crackle * 0.8) * 0.5
	return d

func _wind(dur: float) -> PackedFloat32Array:
	var n := int(dur * RATE)
	var d := PackedFloat32Array()
	d.resize(n)
	var rng := RandomNumberGenerator.new()
	rng.seed = 33
	var lp := 0.0
	var lp2 := 0.0
	for i in n:
		var t := float(i) / RATE
		lp += (rng.randf_range(-1, 1) - lp) * 0.02
		lp2 += (lp - lp2) * 0.05
		var g := 0.6 + 0.4 * sin(t * TAU / dur * 2.0)
		d[i] = lp2 * 6.0 * g
	# сглаживание стыка цикла
	var fade := int(0.3 * RATE)
	for i in fade:
		var k := float(i) / fade
		d[i] = d[i] * k + d[n - fade + i] * (1.0 - k)
	return d

func play(name: String, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	if not streams.has(name) or volume <= 0.0:
		return
	var p := _pool2d[_i2]
	_i2 = (_i2 + 1) % _pool2d.size()
	p.stream = streams[name]
	p.volume_db = vol_db + linear_to_db(volume)
	p.pitch_scale = pitch
	p.play()

func play_at(name: String, pos: Vector3, vol_db: float = 0.0, pitch: float = 1.0) -> void:
	if not streams.has(name) or volume <= 0.0:
		return
	var p := _pool3d[_i3]
	_i3 = (_i3 + 1) % _pool3d.size()
	if not p.is_inside_tree():
		return
	p.global_position = pos
	p.stream = streams[name]
	p.volume_db = vol_db + linear_to_db(volume)
	p.pitch_scale = pitch * randf_range(0.94, 1.06)
	p.play()

func set_ambient(name: String) -> void:
	if name == "" or not streams.has(name):
		_ambient.stop()
		return
	if _ambient.stream != streams[name] or not _ambient.playing:
		_ambient.stream = streams[name]
		_ambient.volume_db = -16.0 + linear_to_db(maxf(volume, 0.001))
		_ambient.play()
