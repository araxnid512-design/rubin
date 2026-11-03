extends Node
## Окно настроек в главном меню (вне игры).
var layer: CanvasLayer
var hud_like: Control

func _ready() -> void:
	layer = CanvasLayer.new()
	layer.layer = 30
	add_child(layer)
	hud_like = Control.new()
	hud_like.set_anchors_preset(Control.PRESET_FULL_RECT)
	hud_like.theme = UI.theme()
	hud_like.set_script(null)
	layer.add_child(hud_like)
	var w := WindowFactory.settings(self, "menu")
	hud_like.add_child(w)

func close_window() -> void:
	queue_free()

func open(_k: String, _d: Variant) -> void:
	queue_free()
