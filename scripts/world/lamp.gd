class_name Lamp
extends OmniLight3D
## Уличный фонарь: включается ночью при наличии электропитания.

func _ready() -> void:
	add_to_group("lamps")
	omni_range = 16.0
	light_energy = 3.0
	omni_attenuation = 0.8
	light_color = Color(1.0, 0.82, 0.58)
	shadow_enabled = false
	update_lamp()
	Events.power_changed.connect(func(_on): update_lamp())

func update_lamp() -> void:
	var night := Game.time_of_day < 6.5 or Game.time_of_day > 19.5
	visible = Game.power_on and night and Settings.preset().lights
