@tool
class_name BCLight
extends Node3D
## Светильник BunkerCore: корпус (видимый) + источник света. Светильники одной группы включаются вместе
## выключателем (BCInteract с действием "switch"). Состояние сохраняется.
## Виды корпуса: tube — люминесцентная лампа под потолком, bulkhead — настенный плафон в решётке,
## cage — лампа в сетке, grow — розовая фитолампа (теплица).

@export var light_id := ""
@export_enum("tube", "bulkhead", "cage", "grow") var fixture := "tube":
	set(v): fixture = v; _queue()
@export var color := Color(1.0, 0.86, 0.66):
	set(v): color = v; _queue()
@export var energy := 1.6:
	set(v): energy = v; _queue()
@export var light_range := 7.0:
	set(v): light_range = v; _queue()
@export var group := ""                ## имя группы выключателя
@export var on := true
@export var flicker := false           ## старая лампа слегка мерцает
@export var shadows := false
var powered := true                     ## есть ли питание (генератор работает); выключатель — `on`

var _light: OmniLight3D
var _glow: MeshInstance3D
var _shaft: MeshInstance3D
static var shafts_on := true            ## лучи света (выключаются на низком качестве)
var _dirty := false
var _ph := 0.0


func _ready() -> void:
	_build()
	_ph = randf() * 10.0
	if Engine.is_editor_hint():
		return
	if light_id == "":
		light_id = str(get_path())
	Core.world.register(light_id, self)
	add_to_group("bc_light")
	if group != "":
		add_to_group("bc_light:" + group)


func _queue() -> void:
	if not is_inside_tree() or _dirty:
		return
	_dirty = true
	_build.call_deferred()


func _build() -> void:
	_dirty = false
	BCKit.clear_generated(self)
	var mk := BCMesh.new()
	var gk := BCMesh.new()
	var I := Transform3D.IDENTITY
	var glow_mat := "lamp_warm" if color.b < 0.8 else "lamp_cold"
	if fixture == "grow":
		glow_mat = "grow_light"
	match fixture:
		"tube", "grow":
			mk.box("paint_white" if fixture == "tube" else "steel_dark", I, Vector3(1.25, 0.06, 0.16), Vector3(0, 0.03, 0))
			gk.box(glow_mat, I, Vector3(1.15, 0.035, 0.07), Vector3(0, -0.012, 0))
			mk.pipe("steel_dark", I, Vector3(-0.5, 0.06, 0), Vector3(-0.5, 0.3, 0), 0.006, 4, false)
			mk.pipe("steel_dark", I, Vector3(0.5, 0.06, 0), Vector3(0.5, 0.3, 0), 0.006, 4, false)
		"bulkhead":
			mk.box("steel_dark", I, Vector3(0.24, 0.3, 0.08), Vector3(0, 0, -0.04))
			gk.sphere(glow_mat, I, 0.08, Vector3(0, 0, 0.02), 10, 6, Vector3(1, 1.3, 0.7))
			for k in 3:
				mk.box("steel_dark", I, Vector3(0.012, 0.28, 0.012), Vector3(-0.07 + k * 0.07, 0, 0.09))
		"cage":
			mk.cyl("steel_dark", I, 0.07, 0.06, Vector3(0, 0.0, 0), 10)
			gk.sphere(glow_mat, I, 0.06, Vector3(0, -0.06, 0), 10, 6)
			for k in 4:
				var a := k * PI * 0.5
				mk.pipe("steel_dark", I, Vector3(cos(a) * 0.07, 0, sin(a) * 0.07), Vector3(cos(a) * 0.06, -0.14, sin(a) * 0.06), 0.006, 4, false)
	var body := BCKit.add_mesh(self, mk, "Body", false)
	BCKit.mark(body)
	_glow = BCKit.add_mesh(self, gk, "Glow", false)
	BCKit.mark(_glow)
	if fixture != "bulkhead":
		# потолочный светильник виден, только когда виден потолок
		body.add_to_group("roof")
		_glow.add_to_group("roof")
	if energy <= 0.0:
		# только светящийся плафон, без источника света (дёшево)
		_light = null
		_apply()
		return
	_light = OmniLight3D.new()
	_light.name = "Light"
	_light.light_color = color
	_light.light_energy = energy
	_light.omni_range = light_range
	_light.omni_attenuation = 1.2
	_light.shadow_enabled = shadows
	_light.light_specular = 0.35
	_light.position = Vector3(0, -0.25, 0) if fixture != "bulkhead" else Vector3(0, 0, 0.3)
	add_child(BCKit.mark(_light))
	if fixture != "bulkhead" and not Engine.is_editor_hint():
		# луч сквозь пыль: от лампы до пола
		_shaft = MeshInstance3D.new()
		_shaft.name = "Shaft"
		var cm := CylinderMesh.new()
		var hh := 2.75
		cm.top_radius = 0.35 if fixture != "cage" else 0.15
		cm.bottom_radius = minf(light_range * 0.22, 1.7)
		cm.height = hh
		cm.radial_segments = 14
		cm.rings = 1
		cm.cap_top = false
		cm.cap_bottom = false
		var sm := ShaderMaterial.new()
		sm.shader = preload("res://core/shaders/light_shaft.gdshader")
		sm.set_shader_parameter("col", color)
		sm.set_shader_parameter("strength", 0.2 * clampf(energy / 1.5, 0.6, 1.4))
		cm.material = sm
		_shaft.mesh = cm
		_shaft.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		_shaft.position = Vector3(0, -hh * 0.5 - 0.05, 0)
		if fixture == "tube" or fixture == "grow":
			_shaft.scale = Vector3(1.6, 1.0, 0.8)
		add_child(BCKit.mark(_shaft))
	_apply()


func _apply() -> void:
	if _light:
		_light.visible = on and powered
	if _glow and fixture == "bulkhead":
		_glow.visible = on and powered
	if _shaft:
		_shaft.visible = on and powered and shafts_on


func set_powered(v: bool) -> void:
	powered = v
	_apply()


func _process(_d: float) -> void:
	if Engine.is_editor_hint() or not flicker or not on or not powered or _light == null:
		return
	_ph += _d
	var f := 1.0
	if fmod(_ph, 7.3) < 0.18:
		f = 0.35 + 0.65 * absf(sin(_ph * 61.0))
	_light.light_energy = energy * f


func set_on(v: bool) -> void:
	on = v
	_apply()
	Core.world.notify_state(light_id)


func get_state() -> Dictionary:
	return {"on": on}


func set_state(s: Dictionary) -> void:
	on = s.get("on", on)
	_apply()
