extends Node
## Музыка вне локации: главное меню и карта мира. Одна дорожка («Dead Sector», прислана пользователем) играет
## без перерыва — и при открытии настроек, и при переходе между меню и картой — и плавно стихает при входе
## на локацию. Громкость — общая, из настроек.

const MENU := "res://assets/audio/music_menu.mp3"
var _p: AudioStreamPlayer
var _tw: Tween


func _ready() -> void:
	process_mode = Node.PROCESS_MODE_ALWAYS
	_p = AudioStreamPlayer.new()
	_p.volume_db = -40.0
	add_child(_p)


func is_playing() -> bool:
	return _p.playing


func play_menu() -> void:
	if not ResourceLoader.exists(MENU):
		return
	if _tw:
		_tw.kill()
	if not _p.playing:
		var st: AudioStream = load(MENU)
		if st is AudioStreamMP3:
			(st as AudioStreamMP3).loop = true
		elif st is AudioStreamOggVorbis:
			(st as AudioStreamOggVorbis).loop = true
		_p.stream = st
		_p.volume_db = -36.0
		_p.play()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", -5.0, 2.5)


func stop(fade := 1.5) -> void:
	if not _p.playing:
		return
	if _tw:
		_tw.kill()
	_tw = create_tween()
	_tw.tween_property(_p, "volume_db", -45.0, fade)
	_tw.tween_callback(_p.stop)
