class_name STSprite8
extends Node2D
## Спрайт персонажа StarCore: атласы, запечённые из 3D (tools/bake): строки — 8 направлений, столбцы — кадры,
## к каждому атласу — карта нормалей (CanvasTexture), поэтому 2D-свет даёт объём. Описание — <папка>/<имя>.json:
## {frame_w, frame_h, anchor:[x,y], fps, clips:{имя:{frames, loop}}}. Нет атласов — рисуется заглушка
## (тело, голова, указатель направления), чтобы игра работала до запекания.

signal finished(clip: String)

@export var color := Color(0.85, 0.55, 0.25)
var info := {}
var dir := 0                 ## 0..7 (SP.dir8)
var clip := ""
var _sprite: Sprite2D
var _tex := {}               ## клип → CanvasTexture
var _t := 0.0
var _frame := 0
var _loop := true
var _hold := false
var height := 1.8            ## для заглушки, м
var speed_mps := -1.0        ## текущая скорость, м/с: темп walk/run подстраивается под неё (без скольжения ног)
var _rate := 12.0            ## кадров в секунду текущего клипа
var _dirs := 8


func setup(folder: String) -> void:
	var name := folder.get_file()
	var jp := folder.path_join(name + ".json")
	if not FileAccess.file_exists(jp):
		queue_redraw()
		return
	var d = JSON.parse_string(FileAccess.get_file_as_string(jp))
	if not (d is Dictionary):
		return
	info = d
	_sprite = Sprite2D.new()
	_sprite.centered = false
	var a: Array = info.get("anchor", [64, 100])
	_sprite.offset = -Vector2(a[0], a[1])
	_dirs = int(info.get("dirs", 8))
	_sprite.vframes = _dirs
	add_child(_sprite)
	for c in info.get("clips", {}):
		var p := folder.path_join(c + ".png")
		if not ResourceLoader.exists(p):
			continue
		var ct := CanvasTexture.new()
		ct.diffuse_texture = load(p)
		var np := folder.path_join(c + "_n.png")
		if ResourceLoader.exists(np):
			ct.normal_texture = load(np)
		_tex[c] = ct
	play("idle")


func has_clip(c: String) -> bool:
	return _tex.has(c) or (info.is_empty() and c in ["idle", "walk", "run"])


## длительность клипа, с
func clip_len(c: String) -> float:
	var ci: Dictionary = info.get("clips", {}).get(c, {})
	return float(ci.get("frames", 6)) / _clip_fps(ci)


## темп клипа: циклы (стойка, шаг, бег) — родной темп записи, удары и попадания — общий темп атласа
func _clip_fps(ci: Dictionary) -> float:
	if ci.get("loop", false) and ci.has("native_fps"):
		return float(ci.native_fps)
	return float(info.get("fps", 12))


func play(c: String, restart := false) -> float:
	if c == clip and not restart and not _hold:
		return clip_len(c)
	if not _tex.has(c):
		clip = c
		return clip_len(c) if not info.is_empty() else 0.4
	clip = c
	var ci: Dictionary = info.clips[c]
	_loop = ci.get("loop", false)
	_hold = false
	_t = 0.0
	_frame = 0
	_sprite.texture = _tex[c]
	_sprite.hframes = int(ci.frames)
	_sprite.vframes = int(ci.get("dirs", _dirs))
	_rate = _clip_fps(ci)
	_apply()
	return clip_len(c)


func set_dir(d: int) -> void:
	if d != dir:
		dir = d
		_apply()
		if info.is_empty():
			queue_redraw()


func _apply() -> void:
	if _sprite and _sprite.texture:
		var d := dir if _sprite.vframes == 8 else int(round(dir * _sprite.vframes / 8.0)) % _sprite.vframes
		_sprite.frame = clampi(d * _sprite.hframes + _frame, 0, _sprite.hframes * _sprite.vframes - 1)


func _process(delta: float) -> void:
	if _sprite == null or _sprite.texture == null or _hold:
		if info.is_empty():
			_t += delta
			if clip == "walk" or clip == "run":
				queue_redraw()
		return
	var rate := _rate
	var ci: Dictionary = info.clips.get(clip, {})
	if speed_mps > 0.05 and ci.has("speed_native"):
		rate *= clampf(speed_mps / float(ci.speed_native), 0.5, 1.8)
	_t += delta * rate
	var n: int = _sprite.hframes
	var f := int(_t)
	if f >= n:
		if _loop:
			_t = fmod(_t, n)
			f = int(_t)
		else:
			f = n - 1
			_hold = true
			finished.emit(clip)
	if f != _frame:
		_frame = f
		_apply()


## заглушка: тень, тело, голова, указатель взгляда
func _draw() -> void:
	if not info.is_empty():
		return
	var h := height * SP.PPM * SP.K
	var bob := sin(_t * 14.0) * 2.0 if clip in ["walk", "run"] else 0.0
	draw_set_transform(Vector2.ZERO, 0.0, Vector2(1.0, 0.45))
	draw_circle(Vector2.ZERO, 16.0, Color(0, 0, 0, 0.35))
	draw_set_transform(Vector2.ZERO, 0.0, Vector2.ONE)
	draw_rect(Rect2(-11, -h * 0.82 + bob, 22, h * 0.62), color.darkened(0.15))
	draw_circle(Vector2(0, -h * 0.86 + bob), 9.0, color.lightened(0.25))
	var ang := (dir * PI / 4.0)
	var fwd := SP.ground_to_screen(Vector2(-sin(ang), cos(ang)))
	draw_line(Vector2(0, -h * 0.5), Vector2(0, -h * 0.5) + fwd * 18.0, Color(1, 1, 1, 0.8), 3.0)
