extends Node3D
## Стенд анимаций: один персонаж, список движений (без оружия, пистолет, автомат, холодное), оружие в руках.
## Палец по экрану — вращать камеру, два пальца — приблизить. Каждое движение можно отметить «Годится» / «Брак»
## (сохраняется), «Итог» — список отметок. «Хват: новый / как было» — сравнить с прежним креплением к кисти.
## Автопроверка: --as-test=sheets --as-out=папка — снимки каждого движения с трёх точек и замеры хвата.

const ENTRIES := [
	{"id": "idle", "g": "Без оружия", "n": "Стойка"},
	{"id": "combat", "g": "Без оружия", "n": "Боевая стойка", "pose": "combat_idle"},
	{"id": "walk", "g": "Без оружия", "n": "Ходьба", "speed": 1.3},
	{"id": "run", "g": "Без оружия", "n": "Бег", "speed": 3.6},
	{"id": "sneak", "g": "Без оружия", "n": "Крадучись", "speed": 0.9, "crouch": 1.0},
	{"id": "punch", "g": "Без оружия", "n": "Джеб (левой)", "action": "punch_light", "pose": "combat_idle"},
	{"id": "cross", "g": "Без оружия", "n": "Кросс (правой)", "action": "punch_heavy", "pose": "combat_idle"},
	{"id": "kick", "g": "Без оружия", "n": "Удар ногой", "action": "kick", "pose": "combat_idle"},
	{"id": "dodge", "g": "Без оружия", "n": "Отскок назад", "action": "dodge_back", "pose": "combat_idle"},
	{"id": "hit", "g": "Без оружия", "n": "Попадание", "action": "hit_front"},
	{"id": "fall", "g": "Без оружия", "n": "Падение", "action": "death", "post_pose": "dead"},
	{"id": "getup", "g": "Без оружия", "n": "Подъём", "action": "get_up", "pre_pose": "dead"},
	{"id": "p_draw", "g": "Пистолет", "n": "Достать и убрать", "weapon": "pistol", "stance": "ready", "proc": "draw"},
	{"id": "p_aim", "g": "Пистолет", "n": "Прицел стоя", "weapon": "pistol", "stance": "aim"},
	{"id": "p_walk", "g": "Пистолет", "n": "Ходьба наготове", "weapon": "pistol", "stance": "ready", "speed": 1.3},
	{"id": "p_run", "g": "Пистолет", "n": "Бег", "weapon": "pistol", "stance": "run", "speed": 3.6},
	{"id": "p_fire", "g": "Пистолет", "n": "Выстрел", "weapon": "pistol", "stance": "aim", "proc": "fire"},
	{"id": "p_reload", "g": "Пистолет", "n": "Перезарядка", "weapon": "pistol", "stance": "aim", "proc": "reload"},
	{"id": "r_draw", "g": "Автомат", "n": "Взять и убрать", "weapon": "rifle", "stance": "ready", "proc": "draw"},
	{"id": "r_rest", "g": "Автомат", "n": "Покой (поперёк груди)", "weapon": "rifle", "stance": "ready", "still": true},
	{"id": "r_ready", "g": "Автомат", "n": "Стойка наготове", "weapon": "rifle", "stance": "ready"},
	{"id": "r_aim", "g": "Автомат", "n": "Прицел стоя", "weapon": "rifle", "stance": "aim"},
	{"id": "r_walk", "g": "Автомат", "n": "Ходьба наготове", "weapon": "rifle", "stance": "ready", "speed": 1.3},
	{"id": "r_run", "g": "Автомат", "n": "Бег", "weapon": "rifle", "stance": "run", "speed": 3.6},
	{"id": "r_fire", "g": "Автомат", "n": "Очередь", "weapon": "rifle", "stance": "aim", "proc": "burst"},
	{"id": "r_reload", "g": "Автомат", "n": "Перезарядка", "weapon": "rifle", "stance": "ready", "proc": "reload"},
	{"id": "s_draw", "g": "Дробовик SPAS-12", "n": "Взять и убрать", "weapon": "spas12", "stance": "ready", "proc": "draw"},
	{"id": "s_rest", "g": "Дробовик SPAS-12", "n": "Покой (поперёк груди)", "weapon": "spas12", "stance": "ready", "still": true},
	{"id": "s_aim", "g": "Дробовик SPAS-12", "n": "Прицел стоя", "weapon": "spas12", "stance": "aim"},
	{"id": "s_walk", "g": "Дробовик SPAS-12", "n": "Ходьба наготове", "weapon": "spas12", "stance": "ready", "speed": 1.3},
	{"id": "s_fire", "g": "Дробовик SPAS-12", "n": "Выстрел и цевьё", "weapon": "spas12", "stance": "aim", "proc": "burst"},
	{"id": "s_reload", "g": "Дробовик SPAS-12", "n": "Перезарядка", "weapon": "spas12", "stance": "ready", "proc": "reload"},
	{"id": "f_draw", "g": "FN FAL", "n": "Взять и убрать", "weapon": "fnfal", "stance": "ready", "proc": "draw"},
	{"id": "f_rest", "g": "FN FAL", "n": "Покой (поперёк груди)", "weapon": "fnfal", "stance": "ready", "still": true},
	{"id": "f_aim", "g": "FN FAL", "n": "Прицел стоя", "weapon": "fnfal", "stance": "aim"},
	{"id": "f_walk", "g": "FN FAL", "n": "Ходьба наготове", "weapon": "fnfal", "stance": "ready", "speed": 1.3},
	{"id": "f_fire", "g": "FN FAL", "n": "Выстрел", "weapon": "fnfal", "stance": "aim", "proc": "burst"},
	{"id": "f_reload", "g": "FN FAL", "n": "Перезарядка", "weapon": "fnfal", "stance": "ready", "proc": "reload"},
	{"id": "v_draw", "g": "ВСС", "n": "Взять и убрать", "weapon": "vss", "stance": "ready", "proc": "draw"},
	{"id": "v_rest", "g": "ВСС", "n": "Покой (поперёк груди)", "weapon": "vss", "stance": "ready", "still": true},
	{"id": "v_aim", "g": "ВСС", "n": "Прицел стоя", "weapon": "vss", "stance": "aim"},
	{"id": "v_walk", "g": "ВСС", "n": "Ходьба наготове", "weapon": "vss", "stance": "ready", "speed": 1.3},
	{"id": "v_fire", "g": "ВСС", "n": "Выстрел", "weapon": "vss", "stance": "aim", "proc": "burst"},
	{"id": "v_reload", "g": "ВСС", "n": "Перезарядка", "weapon": "vss", "stance": "ready", "proc": "reload"},
	{"id": "h_draw", "g": "MP5", "n": "Взять и убрать", "weapon": "mp5", "stance": "ready", "proc": "draw"},
	{"id": "h_rest", "g": "MP5", "n": "Покой (поперёк груди)", "weapon": "mp5", "stance": "ready", "still": true},
	{"id": "h_aim", "g": "MP5", "n": "Прицел стоя", "weapon": "mp5", "stance": "aim"},
	{"id": "h_walk", "g": "MP5", "n": "Ходьба наготове", "weapon": "mp5", "stance": "ready", "speed": 1.3},
	{"id": "h_fire", "g": "MP5", "n": "Очередь", "weapon": "mp5", "stance": "aim", "proc": "burst"},
	{"id": "h_reload", "g": "MP5", "n": "Перезарядка", "weapon": "mp5", "stance": "ready", "proc": "reload"},
	{"id": "k_draw", "g": "Ручной пулемёт «Печенег»", "n": "Взять и убрать", "weapon": "pkp", "stance": "ready", "proc": "draw"},
	{"id": "k_rest", "g": "Ручной пулемёт «Печенег»", "n": "Покой (поперёк груди)", "weapon": "pkp", "stance": "ready", "still": true},
	{"id": "k_aim", "g": "Ручной пулемёт «Печенег»", "n": "Прицел стоя", "weapon": "pkp", "stance": "aim"},
	{"id": "k_walk", "g": "Ручной пулемёт «Печенег»", "n": "Ходьба наготове", "weapon": "pkp", "stance": "ready", "speed": 1.3},
	{"id": "k_fire", "g": "Ручной пулемёт «Печенег»", "n": "Очередь", "weapon": "pkp", "stance": "aim", "proc": "burst"},
	{"id": "k_reload", "g": "Ручной пулемёт «Печенег»", "n": "Перезарядка", "weapon": "pkp", "stance": "ready", "proc": "reload"},
	{"id": "b_draw", "g": "Пистолет Beretta 92FS", "n": "Достать и убрать", "weapon": "beretta", "stance": "ready", "proc": "draw"},
	{"id": "b_aim", "g": "Пистолет Beretta 92FS", "n": "Прицел стоя", "weapon": "beretta", "stance": "aim"},
	{"id": "b_walk", "g": "Пистолет Beretta 92FS", "n": "Ходьба наготове", "weapon": "beretta", "stance": "ready", "speed": 1.3},
	{"id": "b_fire", "g": "Пистолет Beretta 92FS", "n": "Выстрел", "weapon": "beretta", "stance": "aim", "proc": "burst"},
	{"id": "b_reload", "g": "Пистолет Beretta 92FS", "n": "Перезарядка", "weapon": "beretta", "stance": "aim", "proc": "reload"},
	{"id": "d_draw", "g": "СВД", "n": "Достать и убрать", "weapon": "svd", "stance": "ready", "proc": "draw"},
	{"id": "d_rest", "g": "СВД", "n": "Покой (поперёк груди)", "weapon": "svd", "stance": "ready", "still": true},
	{"id": "d_aim", "g": "СВД", "n": "Прицел стоя", "weapon": "svd", "stance": "aim"},
	{"id": "d_walk", "g": "СВД", "n": "Ходьба наготове", "weapon": "svd", "stance": "ready", "speed": 1.3},
	{"id": "d_fire", "g": "СВД", "n": "Выстрел", "weapon": "svd", "stance": "aim", "proc": "burst"},
	{"id": "d_reload", "g": "СВД", "n": "Перезарядка", "weapon": "svd", "stance": "ready", "proc": "reload"},
	{"id": "m_draw", "g": "Холодное", "n": "Достать и убрать", "weapon": "melee", "stance": "guard", "proc": "draw"},
	{"id": "m_idle", "g": "Холодное", "n": "Боевая стойка", "weapon": "melee", "stance": "guard"},
	{"id": "m_walk", "g": "Холодное", "n": "Ходьба", "weapon": "melee", "stance": "guard", "speed": 1.3},
	{"id": "m_light", "g": "Холодное", "n": "Удар", "weapon": "melee", "stance": "guard", "proc": "swing:light"},
	{"id": "m_heavy", "g": "Холодное", "n": "Сильный удар", "weapon": "melee", "stance": "guard", "proc": "swing:heavy"},
	{"id": "m_block", "g": "Холодное", "n": "Блок", "weapon": "melee", "stance": "guard", "proc": "swing:block"},
]
## движения врага: стенд показывает его той же моделью и теми же клипами, что в игре; удары — из его баланса
## (data/enemies.json), остальное — общий набор
static func enemy_entries(kind: String) -> Array:
	var d: Dictionary = ULEnemy.KINDS[kind]
	var g := String(d.n)
	if d.has("gun"):
		return _armed_entries(d)
	var out: Array = [
		{"id": "z_idle", "g": g, "n": "Стоит, дышит"},
		{"id": "z_alert", "g": g, "n": "Заметил героя", "action": "alert"},
		{"id": "z_scream", "g": g, "n": "Крик", "action": "scream", "voice": "roar"},
		{"id": "z_walk", "g": g, "n": "Бродит", "speed": float(d.walk)},
		{"id": "z_run", "g": g, "n": "Бежит к герою", "speed": float(d.run)},
		{"id": "z_menace", "g": g, "n": "Вплотную, между ударами", "pose": "menace"},
		{"id": "z_turn_l", "g": g, "n": "Поворот налево", "action": "turn_left"},
		{"id": "z_turn_r", "g": g, "n": "Поворот направо", "action": "turn_right"},
	]
	var k := 0
	for a in d.get("attacks", []):
		k += 1
		out.append({"id": "z_attack%d" % k, "g": "Удары", "n": "%s (%d)" % [String(a.n).capitalize(), int(a.dmg)], "action": String(a.clip), "rate": float(a.get("rate", 1.0)), "voice": "roar", "hit": float(a.get("hit", 0.5)), "bite": bool(a.get("bite", false))})
	out += [
		{"id": "z_hit", "g": "Попадания", "n": "Попадание спереди", "action": "hit_front"},
		{"id": "z_hit_b", "g": "Попадания", "n": "Попадание сзади", "action": "hit_back"},
		{"id": "z_stagger", "g": "Попадания", "n": "Сбит с ног (сильное попадание)", "action": "stagger"},
		{"id": "z_death", "g": "Гибель", "n": "Падает на спину", "action": "death", "post_pose": "dead", "voice": "zdeath"},
		{"id": "z_death_f", "g": "Гибель", "n": "Падает лицом вперёд", "action": "death_front", "post_pose": "dead_front", "voice": "zdeath"},
		{"id": "z_death_s", "g": "Гибель", "n": "Падает набок", "action": "death_side", "post_pose": "dead_side", "voice": "zdeath"},
	]
	return out


## движения вооружённого врага (мур, главарь): стойки и шаг с оружием, прицел, огонь, перезарядка — как в игре
static func _armed_entries(d: Dictionary) -> Array:
	var g := String(d.n)
	var wid := String((d.gun as Dictionary).get("weapon", "rifle"))
	var boss := bool(d.get("boss", false))
	var out: Array = [
		{"id": "z_idle", "g": g, "n": "Стоит с оружием", "weapon": wid, "stance": "ready"},
		{"id": "z_rest", "g": g, "n": "Покой (оружие поперёк груди)", "weapon": wid, "stance": "ready", "still": true},
		{"id": "z_aim", "g": g, "n": "Целится", "weapon": wid, "stance": "aim"},
		{"id": "z_walk", "g": g, "n": "Идёт дозором", "weapon": wid, "stance": "ready", "speed": float(d.walk)},
		{"id": "z_run", "g": g, "n": "Бежит", "weapon": wid, "stance": "run" if boss else "ready", "speed": float(d.run)},
		{"id": "z_cover", "g": g, "n": "Сидит за укрытием", "weapon": wid, "stance": "ready", "speed": 0.0, "crouch": 1.0},
		{"id": "z_fire", "g": "Огонь", "n": "Стреляет", "weapon": wid, "stance": "aim", "proc": "burst"},
		{"id": "z_reload", "g": "Огонь", "n": "Перезарядка", "weapon": wid, "stance": "ready", "proc": "reload"},
	]
	if boss:
		out[2]["pose"] = "boss_pistol_aim"
		out += [
			{"id": "z_bfire", "g": "Огонь", "n": "Прицельный выстрел", "weapon": wid, "stance": "aim", "pose": "boss_pistol_aim", "action": "boss_pistol_fire"},
			{"id": "z_kick", "g": "Удары", "n": "Удар ногой", "weapon": wid, "stance": "ready", "action": "kick"},
			{"id": "z_gren", "g": "Удары", "n": "Граната: рука к подсумку", "weapon": wid, "stance": "ready", "action": "boss_grenade_prepare"},
			{"id": "z_gren2", "g": "Удары", "n": "Граната: бросок", "weapon": wid, "stance": "ready", "action": "boss_grenade_throw"},
		]
	out += [
		{"id": "z_hit", "g": "Попадания", "n": "Попадание спереди", "weapon": wid, "stance": "ready", "action": "hit_front"},
		{"id": "z_stagger", "g": "Попадания", "n": "Сбит с ног (сильное попадание)", "weapon": wid, "stance": "ready", "action": "stagger"},
		{"id": "z_death", "g": "Гибель", "n": "Падает на спину", "action": "death", "post_pose": "dead", "voice": "zdeath"},
		{"id": "z_death_f", "g": "Гибель", "n": "Падает лицом вперёд", "action": "death_front", "post_pose": "dead_front", "voice": "zdeath"},
		{"id": "z_death_s", "g": "Гибель", "n": "Падает набок", "action": "death_side", "post_pose": "dead_side", "voice": "zdeath"},
	]
	return out


var who := "hero"                     ## кто на стенде: hero — герой, иначе вид врага из ULEnemy.KINDS
var hero_id := "hero"                 ## внешность героя на стенде (ULHeroes: hero — Сталкер, hero2 — Лис …)
var entries: Array = ENTRIES
const MARKS := "user://marks.json"
const C_BG := Color(0.05, 0.07, 0.09, 0.9)
const C_LINE := Color(0.35, 0.75, 0.95, 0.7)
const C_TEXT := Color(0.88, 0.93, 0.97)

var rig: BCCharacter
var snd: BCSound                     ## звуки (assets/audio, источники — docs/AUDIO.md)
var _foot := {}                       ## стопа → [нижняя точка, взведена]
var holder: Node3D
var cam: Camera3D
var cur := {}
var cur_i := 0
var marks := {}
var yaw := 0.55
var pitch := 0.22
var dist := 3.4
var look_h := 1.0
var look_hands := false           ## камера смотрит на кисти (вид «Руки»)
var speed_k := 1.0
var paused := false
var _timer := 0.0
var _phase := 0
var _burst := 0
var _touches := {}
var _pinch := 0.0
var rows := {}
var title_lbl: Label
var info_lbl: Label
var ok_btn: Button
var bad_btn: Button
var ik_btn: Button
var spd_btn: Button
var pause_btn: Button
var modal: Control
var list_sc: ScrollContainer
var target: MeshInstance3D            ## мишень в 10 м перед персонажем
var tracer: MeshInstance3D
var flash: OmniLight3D
var hits: Array = []
var last_hit := ""                    ## «отклонение от центра мишени»
var w_btns := {}
var p_btns := {}
var pack := ""                         ## надетый рюкзак
var pack_node: Node3D = null
var aim_btn: Button
var _seq := 0                         ## номер смены оружия (отложенные шаги старой смены не срабатывают)
const TARGET_DIST := 10.0
const TARGET_H := 1.36
var ui: Control
var test := ""
var cam_free := false                 ## камерой управляет проверка
var out := "user://sheets"
var audit := BCPoseAudit.new()        ## проверка позы текущего движения (наклон, стопы, раскачка, поза лёжа)
var audit_res := {}                   ## итог «Проверки поз»: движение → результат
var audit_btn: Button
var _audit_run := false
var _audit_skip := 0.0                ## после смены движения — пауза: поза ещё переходит из прежней


func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-test="):
			test = a.substr(10)
		if a.begins_with("--as-out="):
			out = a.substr(9)
	who = ULSettings.stand_who if ULEnemy.KINDS.has(ULSettings.stand_who) else "hero"
	hero_id = ULSettings.stand_hero if ULSettings.stand_hero in ULHeroes.ids() else ULHeroes.current()
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-hero=") and a.substr(10) in ULHeroes.ids():
			hero_id = a.substr(10)          # проверки стенда на другом персонаже
	if test != "" and test != "enemy":
		who = "hero"
	if test == "enemy":
		who = "infected"
	if test == "enemy" or test == "poses":
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-kind=") and ULEnemy.KINDS.has(a.substr(10)):
				who = a.substr(10)
	entries = ENTRIES if who == "hero" else enemy_entries(who)
	_stage()
	if who != "hero":
		# движений, которых у модели ещё нет, в списке не показываем
		entries = entries.filter(func(en: Dictionary) -> bool: return not en.has("action") or rig.has_clip(String(en.action)))
	_load_marks()
	_build_ui()
	select(0)
	if test != "":
		_run_test.call_deferred()


func _stage() -> void:
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.09, 0.1, 0.12)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.75, 0.8, 0.9)
	e.ambient_light_energy = 0.65
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	add_child(env)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-48, 150, 0)
	sun.light_energy = 1.25
	sun.shadow_enabled = true
	sun.directional_shadow_max_distance = 14.0
	add_child(sun)
	# пол: сетка 0.5 м (жирная — 2 м), по ней видно скольжение стоп
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(400, 400)
	floor_mi.mesh = pm
	var sh := Shader.new()
	sh.code = """shader_type spatial;
varying vec3 wp;
void vertex() { wp = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
	vec2 a = wp.xz / 0.5;
	vec2 g = abs(fract(a - 0.5) - 0.5) / fwidth(a);
	float l1 = 1.0 - min(min(g.x, g.y), 1.0);
	vec2 b = wp.xz / 2.0;
	vec2 g2 = abs(fract(b - 0.5) - 0.5) / fwidth(b);
	float l2 = 1.0 - min(min(g2.x, g2.y), 1.0);
	ALBEDO = mix(vec3(0.15, 0.16, 0.18), vec3(0.36, 0.42, 0.48), max(l1 * 0.45, l2));
	ROUGHNESS = 0.95;
}"""
	var sm := ShaderMaterial.new()
	sm.shader = sh
	floor_mi.material_override = sm
	add_child(floor_mi)
	var sb := StaticBody3D.new()
	sb.collision_layer = 1
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(400, 0.2, 400)
	cs.shape = bs
	cs.position.y = -0.1
	sb.add_child(cs)
	add_child(sb)
	holder = Node3D.new()
	add_child(holder)
	rig = BCCharacter.new()
	holder.add_child(rig)
	if who == "hero":
		ULHeroes.setup_rig(rig, hero_id)
	else:
		# враг — той же настройкой, что в игре (ULEnemy.rig_setup): свои клипы, шаг по росту, стопы, оружие
		ULEnemy.rig_setup(rig, ULEnemy.KINDS[who])
		if ULEnemy.KINDS[who].has("gun"):
			ULMur.rig_arm(rig, ULEnemy.KINDS[who])
	snd = BCSound.new()
	add_child(snd)
	rig.hold.sfx.connect(_on_sfx)
	_range()
	cam = Camera3D.new()
	cam.fov = 38
	cam.near = 0.05
	cam.h_offset = -0.42          # слева список — персонаж правее середины
	add_child(cam)
	cam.current = true


## мишень, трассер и вспышка — проверка, куда на самом деле смотрит ствол
func _range() -> void:
	target = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = Vector2(1.6, 1.6)
	target.mesh = q
	var sh := Shader.new()
	sh.code = """shader_type spatial;
render_mode unshaded, cull_disabled;
void fragment() {
	float r = length(UV - vec2(0.5)) * 1.6;
	float ring = step(0.5, fract(r * 10.0));
	vec3 c = mix(vec3(0.92), vec3(0.15), ring);
	if (r < 0.1) c = vec3(0.85, 0.15, 0.1);
	if (r > 0.8) c = vec3(0.3, 0.32, 0.35);
	ALBEDO = c;
}"""
	var m := ShaderMaterial.new()
	m.shader = sh
	target.material_override = m
	target.position = Vector3(0, TARGET_H, TARGET_DIST)
	target.rotation.y = PI
	holder.add_child(target)
	var post := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.08, TARGET_H, 0.08)
	post.mesh = bm
	post.position = Vector3(0, TARGET_H * 0.5 - 0.4, TARGET_DIST + 0.06)
	holder.add_child(post)
	tracer = MeshInstance3D.new()
	var tb := BoxMesh.new()
	tb.size = Vector3(0.012, 0.012, 1.0)
	tracer.mesh = tb
	var tm := StandardMaterial3D.new()
	tm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tm.albedo_color = Color(1.0, 0.85, 0.4)
	tracer.material_override = tm
	tracer.visible = false
	add_child(tracer)
	flash = OmniLight3D.new()
	flash.light_color = Color(1.0, 0.8, 0.5)
	flash.omni_range = 3.0
	flash.light_energy = 0.0
	add_child(flash)


## выстрел: отдача, вспышка, трассер по стволу, отметка на мишени и отклонение от её центра
func _fire() -> void:
	var h := rig.hold
	if h.wid == "" or h.drawn < 1.0:
		return
	if h.w.mode == "melee":
		_swing_sfx("light", h.swing("light"))
		return
	var mz := h.muzzle_world()
	h.fire()
	if mz.is_empty():
		return
	var from: Vector3 = mz[0]
	var sd: Dictionary = h.w.get("sound", {})
	snd.play(String(sd.get("shot", "shot_ak")), from, float(sd.get("db", 0.0)), 0.04)
	# гильза вылетает вправо и падает на землю через полсекунды
	var foot := rig.skel.global_transform * (rig.skel.get_bone_global_pose(rig.skel.find_bone("R_Foot")).origin)
	snd.play(String(sd.get("case", "casing")), foot + rig.global_transform.basis.x * -0.6, -10.0, 0.1, randf_range(0.42, 0.62))
	var dir: Vector3 = mz[1]
	var fc: Dictionary = h.w.get("fire", {})
	for pi in int(fc.get("pellets", 1)) - 1:
		# дробь: остальные дробины ложатся вокруг (первая — по стволу)
		var sp_r := deg_to_rad(float(fc.get("spread", 2.0)))
		var pd := (dir + Vector3(randf_range(-1, 1), randf_range(-1, 1), 0.0) * tan(sp_r)).normalized()
		var tzp := target.global_position.z
		if absf(pd.z) > 0.01 and (tzp - from.z) / pd.z > 0.0:
			_mark_hit(from + pd * ((tzp - from.z) / pd.z), 0.016)
	# плоскость мишени
	var tz := target.global_position.z
	var end := from + dir * 30.0
	if absf(dir.z) > 0.01 and (tz - from.z) / dir.z > 0.0:
		end = from + dir * ((tz - from.z) / dir.z)
		var off := end - target.global_position
		var cm := Vector2(off.x, off.y).length() * 100.0
		last_hit = "выстрел: %.0f см от центра мишени (10 м), ствол: вбок %+.1f°, вверх %+.1f°" % [cm,
			rad_to_deg(atan2(dir.x, dir.z)), rad_to_deg(asin(clampf(dir.y, -1.0, 1.0)))]
		if cm < 80.0:
			_mark_hit(end, 0.025)
			snd.play("hit_wood", end, -4.0, 0.08, TARGET_DIST / 343.0)
	else:
		last_hit = "выстрел: мимо плоскости мишени (ствол смотрит не вперёд)"
	tracer.visible = true
	tracer.global_position = (from + end) * 0.5
	tracer.look_at(end, Vector3.UP)
	tracer.scale = Vector3(1, 1, from.distance_to(end))
	flash.global_position = from + dir * 0.1
	flash.light_energy = 3.0
	var tw := create_tween()
	tw.tween_property(flash, "light_energy", 0.0, 0.08)
	tw.parallel().tween_interval(0.07)
	tw.tween_callback(func(): tracer.visible = false)


## звук механики оружия (сигнал BCWeaponHold.sfx): at — точка в системе скелета
func _on_sfx(n: String, at: Vector3) -> void:
	var p := rig.skel.global_transform * at
	var w: Dictionary = rig.hold.w
	var pistol := String(w.get("mode", "")) == "pistol"
	var box := String(w.get("reload", {}).get("kind", "")) == "box"
	match n:
		"mag_out":
			snd.play("click", p, -6.0)
			snd.play("mag_out", p, -3.0 if not pistol else -7.0, 0.05, 0.03)
		"mag_in":
			snd.play("box_in" if box else "mag_in", p, -2.0)
		"mag_slap":
			snd.play("click", p, -8.0)
		"bolt_back":
			snd.play("slide_back" if pistol else "bolt_back", p, -2.0)
			if not rig.hold.parts or not rig.hold.parts.has("mag"):        # старая перезарядка: затвор сам возвращается
				snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0, 0.05, 0.22)
		"bolt_fwd":
			snd.play("slide_fwd" if pistol else "bolt_fwd", p, -2.0)
		"cover_open":
			snd.play("cover_open", p, -3.0)
		"cover_close":
			snd.play("cover_close", p, -3.0)
		"pouch":
			snd.play("cloth", p, -6.0)
		"mag_drop":
			snd.play("mag_drop", p, -5.0, 0.1)
		"shell_in":
			snd.play("shell_in", p, -3.0)
		"pump":
			snd.play("pump", p, -2.0)
		"grab":
			snd.play("cloth", p, -8.0)
		"draw_out":
			if String(w.get("mode", "")) == "melee":
				snd.play("swing", p, -10.0, 0.1)
			else:
				snd.play("click" if pistol else "cloth", p, -9.0)
		"holster":
			snd.play("click" if pistol else "cloth", p, -9.0)


## звуки построенных движений: когда в клипе взмах, удар, падение
func _action_sfx(action: String, d: float) -> void:
	var c := rig.global_position + Vector3.UP * 1.3
	var g := rig.global_position + Vector3.UP * 0.1
	match action:
		"punch_light":
			snd.play("swoosh", c, -6.0, 0.08, d * 0.16)
		"punch_heavy":
			snd.play("cloth", c, -10.0, 0.08, d * 0.05)
			snd.play("swoosh", c, -3.0, 0.08, d * 0.26)
		"kick":
			snd.play("cloth", c, -9.0, 0.08, d * 0.14)
			snd.play("swoosh", c - Vector3.UP * 0.6, -3.0, 0.08, d * 0.42)
		"hit_front":
			snd.play("punch", c, -4.0, 0.08)
			snd.play("hurt", c + Vector3.UP * 0.2, -2.0, 0.05, 0.05)
		"dodge_back":
			snd.play("cloth", c, -8.0)
		"death":
			snd.play("hurt", c + Vector3.UP * 0.2, 0.0, 0.05)
			snd.play("body_fall", g, 0.0, 0.05, d * 0.55)
		"get_up":
			snd.play("cloth", g, -6.0, 0.08, d * 0.1)
			snd.play("hurt", c, -12.0, 0.04, d * 0.35)


## холодное оружие: взмах в момент удара, блок — звон
func _swing_sfx(kind: String, len_s: float) -> void:
	var c := rig.global_position + Vector3.UP * 1.3
	match kind:
		"light":
			snd.play("swing", c, -3.0, 0.08, len_s * 0.42)
		"heavy":
			snd.play("swing", c, 0.0, 0.08, len_s * 0.52)
			snd.play("cloth", c, -10.0, 0.08, len_s * 0.3)
		"block":
			snd.play("block", c, -6.0, 0.06, len_s * 0.18)


## шаги — по стопам: стопа опустилась к нижней точке после того, как поднималась; на бегу — дыхание
func _steps_sfx(speed: float) -> void:
	if rig.probe == null or rig.probe.pos.is_empty():
		return
	for b in ["L_Foot", "R_Foot"]:
		if not rig.probe.pos.has(b):
			continue
		var lp: Vector3 = rig.probe.pos[b]
		var h := lp.y * rig.scale_k
		if not _foot.has(b):
			_foot[b] = [h, false]
		var st: Array = _foot[b]
		st[0] = minf(float(st[0]) + 0.0004, h)          # нижняя точка медленно «забывается»
		if h > float(st[0]) + 0.045:
			st[1] = true
		elif bool(st[1]) and h < float(st[0]) + 0.018:
			st[1] = false
			var p: Vector3 = rig.skel.global_transform * lp
			snd.play("step", p, -8.0 + clampf(speed, 0.0, 4.0) * 1.5, 0.08)
		_foot[b] = st
	if speed >= 3.0:
		snd.loop("breath_run", rig.global_position + Vector3.UP * 1.5, -10.0)
	else:
		snd.loop("", Vector3.ZERO)


func _mark_hit(at: Vector3, r: float) -> void:
	if Vector2(at.x - target.global_position.x, at.y - target.global_position.y).length() > 0.8:
		return
	var hm := MeshInstance3D.new()
	var sp := SphereMesh.new()
	sp.radius = r
	sp.height = r * 2.0
	hm.mesh = sp
	var mm := StandardMaterial3D.new()
	mm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mm.albedo_color = Color(0.1, 0.9, 1.0)
	hm.material_override = mm
	add_child(hm)
	hm.global_position = at - Vector3(0, 0, 0.02)
	hm.reparent(target)
	hits.append(hm)
	if hits.size() > 30:
		(hits.pop_front() as Node).queue_free()


## Рюкзаки героя (модели Tripo, assets/packs). Подгонка под тело — core/pack_fit.gd: свои лямки модели убираются,
## поясной ремень большого рюкзака оборачивается вокруг бёдер и идёт за тазом, корпус — за грудью.


func wear_pack(id: String) -> void:
	if pack_node and id == "":
		snd.play("cloth", rig.global_position + Vector3.UP * 1.2, -4.0)
	if pack_node:
		pack_node.queue_free()
		pack_node = null
	pack = id
	for kk in p_btns:
		(p_btns[kk] as Button).add_theme_color_override("font_color", Color(0.45, 0.95, 1.0) if kk == id else C_TEXT)
	if id == "":
		return
	var mi := BCPackFit.build(rig, BCPackFit.PACKS[id])
	rig.skel.add_child(mi)
	mi.skeleton = mi.get_path_to(rig.skel)          # без ссылки на скелет рюкзак стоит в позе покоя
	pack_node = mi
	print("[pack] %s: лямок убрано %d треугольников, точек ремня на бёдрах %d" % [id, int(mi.get_meta("cut")), int(mi.get_meta("belt"))])
	snd.play("zip", rig.global_position + Vector3.UP * 1.2, -6.0)
	snd.play("cloth", rig.global_position + Vector3.UP * 1.2, -4.0, 0.08, 0.3)


## стойка тела под оружие: с пистолетом и автоматом — стойка стрелка, с холодным — боевая
func _body_pose() -> void:
	var pose := String(cur.get("pose", ""))
	var wpn := rig.hold.wid if rig.hold.drawn > 0.0 or rig.hold._draw_dir > 0.0 else ""
	if pose == "" and not cur.has("speed") and not cur.has("action"):
		pose = "" if wpn == "" else ("combat_idle" if rig.hold.w.mode == "melee" else "armed_idle")
		if wpn != "" and rig.hold.w.mode == "rifle" and rig.hold.stance == "aim" and rig.info.has("aim_idle"):
			pose = "aim_idle"
		elif wpn != "" and rig.hold.w.mode == "rifle" and bool(cur.get("still", false)) and rig.hold.w.stances.has("rest") and rig.info.has("rest_idle"):
			pose = "rest_idle"
	rig.hold.still = bool(cur.get("still", false))
	rig.set_pose(pose if rig.info.has(pose) else "")


## взять оружие кнопкой (в любом движении): прежнее убирается, новое достаётся правильным хватом
func take(wpn: String) -> void:
	_seq += 1
	var my := _seq
	var h := rig.hold
	if h.wid == wpn and h.drawn >= 1.0:
		return
	if h.wid != "" and h.wid != wpn and h.drawn > 0.0:
		var t := h.put_away()
		await get_tree().create_timer(t + 0.15).timeout
		if my != _seq:
			return
	if h.wid != wpn:
		h.equip(wpn, false)
	if wpn != "":
		h.draw()
	_body_pose()
	_refresh_weapon()


func _refresh_weapon() -> void:
	for k in w_btns:
		(w_btns[k] as Button).add_theme_color_override("font_color", Color(0.45, 0.95, 1.0) if k == rig.hold.wid else C_TEXT)
	if aim_btn:
		aim_btn.text = "Прицел" if rig.hold.stance != "aim" else "Наготове"


# ---------------- выбор движения ----------------

func select(i: int) -> void:
	cur_i = clampi(i, 0, entries.size() - 1)
	cur = entries[cur_i]
	rig.stop_action()
	var wpn := String(cur.get("weapon", ""))
	_seq += 1
	if rig.hold.wid != wpn:
		rig.hold.equip(wpn)
	elif rig.hold.drawn < 1.0:
		rig.hold.equip(wpn)
	if cur.has("stance"):
		rig.hold.set_stance(cur.stance)
	_body_pose()
	_refresh_weapon()
	_timer = 0.5
	_phase = 0
	_burst = 0
	audit.begin(rig, audit_mode(cur), "creature" if who != "hero" and not ULEnemy.KINDS[who].has("gun") else "human", float(cur.get("crouch", 0.0)) > 0.5)
	_audit_skip = 0.8
	_refresh()


## вид замера позы для движения: стоит / идёт / разовое / лежит после падения
static func audit_mode(en: Dictionary) -> String:
	if en.has("post_pose"):
		return "dead"
	if float(en.get("speed", 0.0)) > 0.05:
		return "move"
	if en.has("action") or String(en.get("proc", "")).begins_with("swing:"):
		return "action"
	return "stand"


func _process(delta: float) -> void:
	if not cam_free:
		_camera()
	if paused:
		return
	var sp := float(cur.get("speed", 0.0))
	rig.set_motion(sp, float(cur.get("crouch", 0.0)), delta)
	holder.position.z += sp * delta
	if holder.position.z > 30.0:
		holder.position.z -= 30.0
	_timer -= delta
	if _timer <= 0.0:
		_step()
	# замер позы: лежащее тело — только когда уже упало и лежит; прочее — после перехода из прежнего движения
	_audit_skip -= delta
	if _audit_skip <= 0.0 and (audit.mode != "dead" or (_phase == 2 and _timer < 0.9)):
		audit.sample(delta)
	_steps_sfx(sp)
	if info_lbl and Engine.get_process_frames() % 6 == 0:
		_info()


## разовые движения повторяются по кругу
func _step() -> void:
	if cur.has("proc"):
		if String(cur.proc).begins_with("swing:"):
			var sk := String(cur.proc).substr(6)
			var sl := rig.hold.swing(sk)
			_swing_sfx(sk, sl)
			_timer = sl + 0.7
			return
		match String(cur.proc):
			"draw":
				# достал — постоял — убрал — постоял
				if rig.hold.drawn >= 1.0 and _phase == 0:
					_phase = 1
					_timer = 1.2
				elif rig.hold.drawn >= 1.0:
					_timer = rig.hold.put_away() + 0.9
					get_tree().create_timer(_timer - 0.85).timeout.connect(_body_pose)
				else:
					_phase = 0
					_timer = rig.hold.draw() + 0.2
					_body_pose()
			"fire":
				_fire()
				_timer = 0.9
			"burst":
				# очередь по описанию оружия (burst); одиночные и дробовик — с паузой на отдачу и цевьё
				var fc: Dictionary = rig.hold.w.get("fire", {})
				var bn := int(fc.get("burst", 3))
				_fire()
				_burst += 1
				_timer = 0.1 if _burst % bn != 0 else (1.5 if fc.get("pump", false) else 1.1)
			"reload":
				_timer = rig.hold.reload() + 1.0
		return
	if not cur.has("action"):
		_timer = 1.0
		return
	if cur.has("pre_pose") and _phase == 0:
		rig.set_pose(cur.pre_pose)
		_phase = 1
		_timer = 1.3
		return
	if cur.has("post_pose") and _phase == 2:
		rig.set_pose("")
		_phase = 0
		_timer = 1.2
		return
	var d := rig.play(String(cur.action), float(cur.get("rate", 1.0)))
	if who == "hero":
		_action_sfx(String(cur.action), d)
	elif cur.has("voice"):
		snd.play(String(cur.voice), rig.global_position + Vector3.UP * 1.5, -3.0, 0.1)      # голос врага
	if rig.fx != null and cur.has("hit"):
		# как в игре: к моменту удара когти раскрываются, на укусе голова идёт вперёд
		var ft := create_tween()
		ft.tween_property(rig.fx, "strike", 1.0, d * float(cur.hit))
		ft.tween_property(rig.fx, "strike", 0.0, 0.5)
		if cur.get("bite", false):
			var bt := create_tween()
			bt.tween_property(rig.fx, "bite", 1.0, d * float(cur.hit))
			bt.tween_property(rig.fx, "bite", 0.0, 0.5)
	if cur.get("twist", false):
		# удар сбоку: разворачивает к удару и валит от него
		rig.rotation.y = 0.0
		create_tween().tween_property(rig, "rotation:y", PI * 0.5, 0.3)
	elif who != "hero":
		rig.rotation.y = 0.0
	if cur.has("pre_pose"):
		rig.set_pose("", d * 0.3)
		_phase = 0
		_timer = d + 1.2
	elif cur.has("post_pose"):
		rig.set_pose(cur.post_pose, d * 0.5)
		_phase = 2
		_timer = d + 1.6
	else:
		_timer = d + 0.9


## середина между кистями (с оружием в двух руках) или правая кисть — в мире
func _hands_center() -> Vector3:
	var sk := rig.skel
	var h := rig.hold
	if h.wid == "":
		return sk.global_transform * sk.get_bone_global_pose(sk.find_bone("R_Hand")).origin
	return sk.global_transform * (h.hand_r.lerp(h.hand_l, 0.5) if h.two_hands else h.hand_r)


func _camera() -> void:
	var t := holder.global_position + Vector3(0, look_h, 0)
	if look_hands:
		t = _hands_center()
	var d := Vector3(sin(yaw) * cos(pitch), sin(pitch), cos(yaw) * cos(pitch)) * dist
	cam.global_position = t + d
	cam.look_at(t, Vector3.UP)


func _unhandled_input(e: InputEvent) -> void:
	if e is InputEventScreenTouch:
		if e.pressed:
			_touches[e.index] = e.position
		else:
			_touches.erase(e.index)
		_pinch = 0.0
	elif e is InputEventScreenDrag:
		_touches[e.index] = e.position
		if _touches.size() >= 2:
			var k: Array = _touches.keys()
			var dd: float = (_touches[k[0]] as Vector2).distance_to(_touches[k[1]])
			if _pinch > 0.0:
				dist = clampf(dist * _pinch / maxf(dd, 1.0), 1.0, 9.0)
			_pinch = dd
		else:
			yaw -= e.relative.x * 0.008
			pitch = clampf(pitch + e.relative.y * 0.006, -0.25, 1.45)
	elif e is InputEventMouseButton and e.pressed:
		if e.button_index == MOUSE_BUTTON_WHEEL_UP:
			dist = maxf(1.0, dist * 0.9)
		elif e.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			dist = minf(9.0, dist * 1.1)


# ---------------- интерфейс ----------------

func _style(bg := C_BG, cut := 10, border := 1) -> StyleBoxFlat:
	var s := StyleBoxFlat.new()
	s.bg_color = bg
	s.set_corner_radius_all(cut)
	s.corner_detail = 1
	s.set_content_margin_all(8)
	if border > 0:
		s.set_border_width_all(border)
		s.border_color = C_LINE
	return s


func _btn(text: String, cb: Callable, w := 0.0, h := 56.0, fs := 18) -> Button:
	var b := Button.new()
	b.text = text
	b.custom_minimum_size = Vector2(w, h)
	b.add_theme_font_size_override("font_size", fs)
	b.add_theme_stylebox_override("normal", _style(Color(0.05, 0.1, 0.15, 0.92)))
	b.add_theme_stylebox_override("hover", _style(Color(0.07, 0.15, 0.22, 0.95)))
	b.add_theme_stylebox_override("pressed", _style(Color(0.1, 0.28, 0.42, 0.95), 10, 2))
	b.add_theme_stylebox_override("focus", _style(Color(0, 0, 0, 0), 10, 0))
	b.add_theme_color_override("font_color", C_TEXT)
	b.focus_mode = Control.FOCUS_NONE
	b.pressed.connect(cb)
	return b


func _lbl(text: String, fs := 18, col := C_TEXT) -> Label:
	var l := Label.new()
	l.text = text
	l.add_theme_font_size_override("font_size", fs)
	l.add_theme_color_override("font_color", col)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	l.add_theme_constant_override("outline_size", 4)
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	return l


func _build_ui() -> void:
	var layer := CanvasLayer.new()
	add_child(layer)
	ui = Control.new()
	ui.set_anchors_preset(Control.PRESET_FULL_RECT)
	ui.mouse_filter = Control.MOUSE_FILTER_IGNORE
	layer.add_child(ui)
	# слева — список движений
	var left := PanelContainer.new()
	left.add_theme_stylebox_override("panel", _style(C_BG, 14, 1))
	left.anchor_bottom = 1.0
	left.offset_left = 10
	left.offset_top = 10
	left.offset_right = 318
	left.offset_bottom = -10
	ui.add_child(left)
	var sc := ScrollContainer.new()
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	left.add_child(sc)
	list_sc = sc
	var list := VBoxContainer.new()
	list.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	list.add_theme_constant_override("separation", 5)
	sc.add_child(list)
	var g := ""
	for i in entries.size():
		var en: Dictionary = entries[i]
		if String(en.g) != g:
			g = en.g
			list.add_child(_lbl(g.to_upper(), 15, Color(0.45, 0.85, 1.0)))
		var b := _btn("", select.bind(i), 0, 46, 17)
		b.alignment = HORIZONTAL_ALIGNMENT_LEFT
		list.add_child(b)
		rows[en.id] = b
	# сверху — название и замеры
	title_lbl = _lbl("", 26, Color(0.55, 0.9, 1.0))
	title_lbl.position = Vector2(340, 12)
	ui.add_child(title_lbl)
	info_lbl = _lbl("", 15)
	info_lbl.position = Vector2(340, 50)
	info_lbl.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	info_lbl.custom_minimum_size = Vector2(760, 0)
	info_lbl.size = Vector2(760, 60)
	ui.add_child(info_lbl)
	# справа — виды
	var views := VBoxContainer.new()
	views.anchor_left = 1.0
	views.anchor_right = 1.0
	views.offset_left = -150
	views.offset_right = -10
	views.offset_top = 10
	views.add_theme_constant_override("separation", 6)
	ui.add_child(views)
	for v in [["Спереди", 0.0, 0.12, 3.4, 1.0], ["Сбоку", PI * 0.5, 0.12, 3.4, 1.0], ["Сзади", PI, 0.2, 3.4, 1.0], ["Сверху", 0.3, 1.2, 4.2, 0.9], ["Руки", -0.9, 0.25, 0.9, -1.0], ["Ноги", 0.9, 0.3, 2.2, 0.4], ["Мишень", PI + 0.5, 0.16, 3.2, 1.35]]:
		views.add_child(_btn(v[0], func():
			yaw = v[1]
			pitch = v[2]
			dist = v[3]
			look_hands = float(v[4]) < 0.0
			if not look_hands:
				look_h = v[4], 140, 48, 16))
	# снизу — управление
	var bar := HBoxContainer.new()
	bar.anchor_top = 1.0
	bar.anchor_bottom = 1.0
	bar.anchor_right = 1.0
	bar.offset_left = 330
	bar.offset_right = -10
	bar.offset_top = -74
	bar.offset_bottom = -10
	bar.add_theme_constant_override("separation", 8)
	ui.add_child(bar)
	var wbar := HBoxContainer.new()
	wbar.anchor_top = 1.0
	wbar.anchor_bottom = 1.0
	wbar.anchor_right = 1.0
	wbar.offset_left = 330
	wbar.offset_right = -10
	wbar.offset_top = -140
	wbar.offset_bottom = -82
	wbar.add_theme_constant_override("separation", 6)
	ui.add_child(wbar)
	wbar.add_child(_lbl("В руки:", 15, Color(0.45, 0.85, 1.0)))
	# оружия много — полоса прокручивается пальцем
	var wsc := ScrollContainer.new()
	wsc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	wsc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	wbar.add_child(wsc)
	var wrow := HBoxContainer.new()
	wrow.add_theme_constant_override("separation", 6)
	wsc.add_child(wrow)
	var cfgw := BCWeaponHold.config()
	for wv in [["", "Ничего"], ["pistol", "ТТ"], ["beretta", "Beretta"], ["rifle", "АК-74М"], ["ak74", "АК-74"], ["mp5", "MP5"], ["fnfal", "FN FAL"], ["svd", "СВД"], ["vss", "ВСС"], ["pkp", "ПКП"], ["spas12", "SPAS-12"], ["melee", "Мачете"]]:
		if wv[0] != "" and not cfgw.has(wv[0]):
			continue
		var wb := _btn(wv[1], take.bind(wv[0]), 86, 52, 14)
		wrow.add_child(wb)
		w_btns[wv[0]] = wb
	# действия с оружием — отдельной строкой выше
	var abar := HBoxContainer.new()
	abar.anchor_top = 1.0
	abar.anchor_bottom = 1.0
	abar.anchor_right = 1.0
	abar.offset_left = 330
	abar.offset_right = -10
	abar.offset_top = -200
	abar.offset_bottom = -146
	abar.add_theme_constant_override("separation", 8)
	ui.add_child(abar)
	abar.add_child(_btn("Назад", func():
		Engine.time_scale = 1.0
		get_tree().change_scene_to_file(ULSettings.stand_back), 90, 50, 16))
	# кого смотреть: герой или враг
	var whos := []
	for hid in ULHeroes.ids():
		whos.append(["hero", ULHeroes.name_of(hid), hid])
	for k in ULEnemy.KINDS:
		whos.append([k, String(ULEnemy.KINDS[k].n), ""])
	# строка «Кто» — отдельная и прокручивается пальцем: героев и врагов девять, в один ряд с кнопками оружия они
	# не помещались (муров и главаря было не выбрать)
	var who_bar := HBoxContainer.new()
	who_bar.anchor_top = 1.0
	who_bar.anchor_bottom = 1.0
	who_bar.anchor_right = 1.0
	who_bar.offset_left = 330
	who_bar.offset_right = -160
	who_bar.offset_top = -260
	who_bar.offset_bottom = -208
	who_bar.add_theme_constant_override("separation", 6)
	ui.add_child(who_bar)
	who_bar.add_child(_lbl("Кто:", 15, Color(0.45, 0.85, 1.0)))
	var who_sc := ScrollContainer.new()
	who_sc.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	who_sc.vertical_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	who_bar.add_child(who_sc)
	var who_row := HBoxContainer.new()
	who_row.add_theme_constant_override("separation", 6)
	who_sc.add_child(who_row)
	for wv2 in whos:
		var hb2 := _btn(wv2[1], func():
			if who != wv2[0] or (wv2[2] != "" and hero_id != wv2[2]):
				ULSettings.stand_who = wv2[0]
				if wv2[2] != "":
					ULSettings.stand_hero = wv2[2]
				Engine.time_scale = 1.0
				get_tree().reload_current_scene(), 124, 48, 15)
		who_row.add_child(hb2)
		if who == wv2[0] and (wv2[2] == "" or wv2[2] == hero_id):
			hb2.add_theme_color_override("font_color", Color(0.45, 0.95, 1.0))
			who_sc.ensure_control_visible.call_deferred(hb2)
	if who != "hero":
		wbar.visible = false
	abar.add_child(_lbl("Рюкзак:", 15, Color(0.45, 0.85, 1.0)))
	for pv in [["", "Нет"], ["small", "Малый 8"], ["medium", "Средний 12"], ["large", "Большой 20"]]:
		var pb := _btn(pv[1], wear_pack.bind(pv[0]), 104, 50, 14)
		abar.add_child(pb)
		p_btns[pv[0]] = pb
	var psp := Control.new()
	psp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	psp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	abar.add_child(psp)
	aim_btn = _btn("Прицел", func():
		rig.hold.set_stance("ready" if rig.hold.stance == "aim" else "aim")
		_refresh_weapon(), 110, 50, 16)
	abar.add_child(aim_btn)
	abar.add_child(_btn("Огонь", _fire, 100, 50, 16))
	abar.add_child(_btn("Перезарядка", func(): rig.hold.reload(), 140, 50, 16))
	if who != "hero":
		# врагу оружие и рюкзаки не нужны — остаются «Назад» и выбор, кого смотреть
		for ci in range(1, abar.get_child_count()):
			(abar.get_child(ci) as Control).visible = false
	bar.add_child(_btn("◀", func(): select((cur_i - 1 + entries.size()) % entries.size()), 52))
	bar.add_child(_btn("▶", func(): select((cur_i + 1) % entries.size()), 52))
	pause_btn = _btn("Пауза", _toggle_pause, 96)
	bar.add_child(pause_btn)
	spd_btn = _btn("Скорость 1×", _cycle_speed, 126, 56.0, 16)
	bar.add_child(spd_btn)
	ik_btn = _btn("Хват: новый", _toggle_ik, 126, 56.0, 16)
	bar.add_child(ik_btn)
	ik_btn.visible = who == "hero"
	var sp := Control.new()
	sp.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	sp.mouse_filter = Control.MOUSE_FILTER_IGNORE
	bar.add_child(sp)
	audit_btn = _btn("Проверка поз", _audit_all, 150, 56.0, 16)
	bar.add_child(audit_btn)
	ok_btn = _btn("Годится", _mark.bind("ok"), 100, 56.0, 16)
	bar.add_child(ok_btn)
	bad_btn = _btn("Брак", _mark.bind("bad"), 78, 56.0, 16)
	bar.add_child(bad_btn)
	bar.add_child(_btn("Итог", _summary, 74, 56.0, 16))
	if who == "hero":
		views.add_child(_btn("Редактор\nудара", _ed_toggle, 140, 64, 15))
		_ed_build()


# ---------------- редактор удара холодным оружием (мачете) ----------------
# Выбор движения (стойка, удар, сильный удар, блок) и его ключа; кнопки «−/+» двигают точку хвата (вперёд, вверх,
# вправо), наклон и поворот клинка, разворот корпуса и время ключа. Ключ показывается «замороженным».
# «Помощник» строит всё заново по анатомии (ULMeleeTuner) и проверяет на скелете: запястье в пределах, рука
# дотягивается, удар перед собой, лезвие ведёт удар. «Сохранить» — в user://weapon_tune.json (сразу и в игре).

var ed: PanelContainer
var ed_move := "guard"
var ed_key := 0
var ed_info: Label
var ed_report: Label
var ed_vals := {}
var ed_busy := false
const ED_MOVES := [["guard", "Стойка"], ["light", "Удар"], ["heavy", "Сильный"], ["block", "Блок"]]
const ED_PARAMS := [["fwd", "Вперёд, м", 0.02], ["up", "Вверх, м", 0.02], ["right", "Вправо, м", 0.02],
	["pitch", "Клинок вверх, °", 5.0], ["yaw", "Клинок вправо, °", 5.0], ["twist", "Корпус, °", 2.0], ["t", "Время ключа", 0.02]]


func _ed_build() -> void:
	ed = PanelContainer.new()
	ed.add_theme_stylebox_override("panel", _style(C_BG, 14, 1))
	ed.anchor_left = 1.0
	ed.anchor_right = 1.0
	ed.offset_left = -640
	ed.offset_right = -160
	ed.offset_top = 10
	ed.visible = false
	ui.add_child(ed)
	var v := VBoxContainer.new()
	v.add_theme_constant_override("separation", 5)
	ed.add_child(v)
	v.add_child(_lbl("РЕДАКТОР УДАРА — МАЧЕТЕ", 17, Color(0.45, 0.85, 1.0)))
	var mrow := HBoxContainer.new()
	v.add_child(mrow)
	for m in ED_MOVES:
		mrow.add_child(_btn(m[1], func():
			ed_move = m[0]
			ed_key = 0 if m[0] == "guard" else 1
			_ed_show(), 112, 44, 15))
	var krow := HBoxContainer.new()
	v.add_child(krow)
	krow.add_child(_btn("◀ ключ", func(): _ed_step_key(-1), 110, 44, 15))
	ed_info = _lbl("", 15)
	ed_info.custom_minimum_size = Vector2(230, 0)
	krow.add_child(ed_info)
	krow.add_child(_btn("ключ ▶", func(): _ed_step_key(1), 110, 44, 15))
	for pr in ED_PARAMS:
		var row := HBoxContainer.new()
		v.add_child(row)
		var nl := _lbl(String(pr[1]), 15)
		nl.custom_minimum_size = Vector2(170, 0)
		row.add_child(nl)
		row.add_child(_btn("−", func(): _ed_nudge(String(pr[0]), -float(pr[2])), 64, 42, 20))
		var vl := _lbl("", 15, Color(1.0, 0.86, 0.4))
		vl.custom_minimum_size = Vector2(90, 0)
		vl.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
		row.add_child(vl)
		ed_vals[pr[0]] = vl
		row.add_child(_btn("+", func(): _ed_nudge(String(pr[0]), float(pr[2])), 64, 42, 20))
	var arow := HBoxContainer.new()
	v.add_child(arow)
	arow.add_child(_btn("▶ Проиграть", _ed_play, 150, 46, 15))
	arow.add_child(_btn("Помощник ИИ", _ed_helper, 160, 46, 15))
	arow.add_child(_btn("Сохранить", _ed_save, 120, 46, 15))
	arow.add_child(_btn("Сброс", _ed_reset, 90, 46, 15))
	ed_report = _lbl("", 13, Color(0.8, 0.9, 0.85))
	ed_report.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	ed_report.custom_minimum_size = Vector2(460, 0)
	v.add_child(ed_report)


func _ed_toggle() -> void:
	ed.visible = not ed.visible
	if ed.visible:
		if rig.hold.wid != "melee":
			for i in entries.size():
				if entries[i].id == "m_idle":
					select(i)
		_ed_show()
	else:
		rig.hold.move_rate = 1.0
		rig.hold._move = ""
		_timer = 0.5


func _ed_w() -> Dictionary:
	return BCWeaponHold.config()["melee"]


## ключ: [время, точка хвата, направление клинка, корпус]; у стойки ключ один
func _ed_get() -> Array:
	var w := _ed_w()
	if ed_move == "guard":
		var g: Dictionary = w.stances.guard
		return [0.0, ULMeleeTuner._vec(g.pos), ULMeleeTuner._vec(g.dir), float(g.get("twist", 0))]
	var kk: Array = w.moves[ed_move].keys[ed_key]
	return [float(kk[0]), ULMeleeTuner._vec(kk[1]), ULMeleeTuner._vec(kk[2]), float(kk[3])]


func _ed_put(t: float, pos: Vector3, dir: Vector3, tw: float) -> void:
	var w := _ed_w()
	dir = dir.normalized()
	if ed_move == "guard":
		w.stances.guard.pos = ULMeleeTuner._a(pos)
		w.stances.guard.dir = ULMeleeTuner._a(dir)
		w.stances.guard.twist = tw
		# у всех ударов первый и последний ключ — стойка
		for m in w.moves:
			var ks: Array = w.moves[m].keys
			for i in [0, ks.size() - 1]:
				ks[i][1] = ULMeleeTuner._a(pos)
				ks[i][2] = ULMeleeTuner._a(dir)
		return
	var mv: Dictionary = w.moves[ed_move]
	var ks2: Array = mv.keys
	var t0 := float(ks2[maxi(ed_key - 1, 0)][0]) + 0.01
	var t1 := float(ks2[mini(ed_key + 1, ks2.size() - 1)][0]) - 0.01
	if ed_key > 0 and ed_key < ks2.size() - 1:
		t = clampf(t, t0, t1)
	else:
		t = float(ks2[ed_key][0])
	ks2[ed_key] = [snappedf(t, 0.01), ULMeleeTuner._a(pos), ULMeleeTuner._a(dir), snappedf(tw, 1.0)]
	# плоскость удара (лезвие ведёт удар) — по замаху и удару
	if mv.has("cock") and mv.has("hit"):
		mv.edge_n = ULMeleeTuner._a(ULMeleeTuner.plane_n(ULMeleeTuner._vec(ks2[int(mv.cock)][2]), ULMeleeTuner._vec(ks2[int(mv.hit)][2])))


func _ed_step_key(d: int) -> void:
	if ed_move == "guard":
		return
	var n: int = _ed_w().moves[ed_move].keys.size()
	ed_key = clampi(ed_key + d, 0, n - 1)
	_ed_show()


func _ed_nudge(p: String, d: float) -> void:
	var k := _ed_get()
	var pos: Vector3 = k[1]
	var dir: Vector3 = k[2]
	var tw := float(k[3])
	var t := float(k[0])
	var ang := ULMeleeTuner.angles_of(dir)
	match p:
		"fwd": pos.x += d
		"up": pos.y += d
		"right": pos.z += d
		"pitch": dir = ULMeleeTuner.dir_from(ang.x, clampf(ang.y + d, -89.0, 89.0))
		"yaw": dir = ULMeleeTuner.dir_from(ang.x + d, ang.y)
		"twist": tw += d
		"t": t += d
	_ed_put(t, pos, dir, tw)
	_ed_show()


## показать выбранный ключ замороженным и подписать значения
func _ed_show() -> void:
	if rig.hold.wid != "melee":
		return
	var k := _ed_get()
	var w := _ed_w()
	if ed_move == "guard":
		rig.hold._move = ""
		rig.hold.move_rate = 1.0
		ed_info.text = "  стойка"
	else:
		rig.hold.swing(ed_move)
		rig.hold.move_rate = 0.00001
		rig.hold._move_t = float(k[0]) * float(w.moves[ed_move].len)
		ed_info.text = "  ключ %d/%d · %.2f" % [ed_key + 1, w.moves[ed_move].keys.size(), float(k[0])]
	var ang := ULMeleeTuner.angles_of(k[2])
	var vals := {"fwd": (k[1] as Vector3).x, "up": (k[1] as Vector3).y, "right": (k[1] as Vector3).z, "pitch": ang.y, "yaw": ang.x, "twist": float(k[3]), "t": float(k[0])}
	for p in ed_vals:
		(ed_vals[p] as Label).text = ("%.2f" % float(vals[p])) if p in ["fwd", "up", "right", "t"] else ("%d" % int(round(float(vals[p]))))
	_timer = 1e9                                   # стенд не перезапускает удар сам, пока смотрим ключ


func _ed_play() -> void:
	if ed_move == "guard":
		return
	rig.hold.move_rate = 1.0
	rig.hold.swing(ed_move)
	_swing_sfx(ed_move, float(_ed_w().moves[ed_move].len))
	get_tree().create_timer(float(_ed_w().moves[ed_move].len) + 0.5).timeout.connect(_ed_show)


## дождаться, пока IK доведёт оружие и руку до ключа
func _ed_settle() -> void:
	# по игровому времени ≥ 0,6 с и не меньше 5 кадров (во время помощника время идёт быстрее — Engine.time_scale)
	var t0 := 0.0
	var n := 0
	while n < 5 or t0 < 0.6:
		await get_tree().process_frame
		t0 += get_process_delta_time()
		n += 1


## замер текущего ключа: [углы запястья, недотяг руки, нарушения]
func _ed_measure(impact: bool) -> Array:
	await _ed_settle()
	var wa: Vector2 = rig.hold.wrist_angles()
	var k := _ed_get()
	var bad := ULMeleeTuner.check(wa, rig.hold.err_r, k[1], impact)
	return [wa, rig.hold.err_r, bad]


## цена ключа: выход кисти за пределы, недотяг руки, нарушения — и уход клинка от задуманного направления
## (иначе помощник «чинил» бы запястье, разворачивая удар не туда)
func _ed_score(m: Array) -> float:
	var ex := ULMeleeTuner.excess(m[0])
	var dev := 0.0
	if _ed_ref != Vector3.ZERO:
		dev = rad_to_deg((_ed_get()[2] as Vector3).normalized().angle_to(_ed_ref))
	return absf(ex.x) + absf(ex.y) + float(m[1]) * 300.0 + (m[2] as Array).size() * 5.0 + dev * 0.35


var _ed_ref := Vector3.ZERO


## Помощник: шаблон по анатомии → проверка каждого ключа на скелете → поправки (клинок доворачивается, пока
## кисть не войдёт в пределы; рука не дотягивается — точка хвата ближе к плечу) → отчёт и сохранение
func _ed_helper() -> void:
	if ed_busy:
		return
	ed_busy = true
	var ts0 := Engine.time_scale
	Engine.time_scale = 3.0
	ed_report.text = "Помощник: строю удары по анатомии и проверяю на скелете…"
	var w := _ed_w()
	var tp := ULMeleeTuner.template()
	w.stances["guard"] = tp.guard
	for m in tp.moves:
		w.moves[m] = tp.moves[m]
	w.moves.light["cock"] = 1
	w.moves.light["hit"] = 4
	w.moves.heavy["cock"] = 1
	w.moves.heavy["hit"] = 4
	var lines: Array = []
	var fixes := 0
	var todo := [["guard", 0]]
	for m in ["light", "heavy", "block"]:
		for i in range(1, w.moves[m].keys.size() - 1):
			todo.append([m, i])
	for td in todo:
		ed_move = td[0]
		ed_key = td[1]
		_ed_show()
		var impact: bool = ed_move != "guard" and ed_move != "block" and int(w.moves[ed_move].get("hit", -1)) == ed_key
		_ed_ref = (_ed_get()[2] as Vector3).normalized()
		var m0: Array = await _ed_measure(impact)
		var best := m0
		var best_s := _ed_score(m0)
		var tries := 0
		while (best[2] as Array).size() > 0 and tries < 6:
			tries += 1
			var k := _ed_get()
			var ex := ULMeleeTuner.excess(best[0])
			var cands: Array = []
			var ang := ULMeleeTuner.angles_of(k[2])
			var step := clampf(absf(ex.x) + absf(ex.y), 6.0, 40.0)
			for sk in [1.0, 0.5]:
				for c in [[step, 0.0], [-step, 0.0], [0.0, step], [0.0, -step], [step, step], [step, -step], [-step, step], [-step, -step]]:
					cands.append([k[1], ULMeleeTuner.dir_from(ang.x + float(c[1]) * sk, clampf(ang.y + float(c[0]) * sk, -89.0, 89.0))])
			if float(best[1]) > 0.03:
				cands.append([(k[1] as Vector3) * 0.93, k[2]])
			var improved := false
			for c in cands:
				_ed_put(float(k[0]), c[0], c[1], float(k[3]))
				_ed_show()
				var mc: Array = await _ed_measure(impact)
				var sc := _ed_score(mc)
				if sc < best_s - 0.5:
					best = mc
					best_s = sc
					improved = true
					fixes += 1
					break                               # первая удачная поправка — дальше от неё
				_ed_put(float(k[0]), k[1], k[2], float(k[3]))
			if not improved:
				_ed_show()
				break
		var nm := "стойка" if ed_move == "guard" else "%s, ключ %.2f%s" % [{"light": "удар", "heavy": "сильный", "block": "блок"}[ed_move], float(_ed_get()[0]), " (удар)" if impact else ""]
		var wa: Vector2 = best[0]
		lines.append("%s: запястье сгиб %d°, отведение %d°, ладонь—рукоять %.1f см — %s" % [nm, int(wa.x), int(wa.y), float(best[1]) * 100.0,
			"в норме" if (best[2] as Array).is_empty() else ", ".join(best[2])])
	# итог: сохранить и показать
	_ed_save_all(w)
	var ok := lines.filter(func(l): return String(l).ends_with("в норме")).size()
	ed_report.text = "Помощник: ключей %d, в норме %d, поправок %d. Лезвие ведёт удар (плоскость удара: замах → удар).\n" % [lines.size(), ok, fixes] + "\n".join(lines.slice(0, 6))
	for l in lines:
		print("[помощник] ", l)
	print("[помощник] итог: ключей %d, в норме %d, поправок %d" % [lines.size(), ok, fixes])
	Engine.time_scale = ts0
	ed_move = "light"
	ed_key = 4
	_ed_show()
	ed_busy = false


func _ed_save_all(w: Dictionary) -> void:
	BCWeaponHold.save_tune("melee", "stances", "guard", w.stances.guard)
	for m in ["light", "heavy", "block"]:
		BCWeaponHold.save_tune("melee", "moves", m, w.moves[m])


func _ed_save() -> void:
	_ed_save_all(_ed_w())
	ed_report.text = "Сохранено в user://weapon_tune.json — в игре мачете держится и бьёт так же."


func _ed_reset() -> void:
	BCWeaponHold.reset_tune("melee")
	take("melee")
	ed_report.text = "Сброшено к data/weapons.json."
	ed_move = "guard"
	_ed_show()


func _toggle_pause() -> void:
	paused = not paused
	Engine.time_scale = 0.0 if paused else speed_k
	pause_btn.text = "Дальше" if paused else "Пауза"


func _cycle_speed() -> void:
	speed_k = {1.0: 0.5, 0.5: 0.25, 0.25: 1.0}[speed_k]
	spd_btn.text = "Скорость %s×" % ("1" if speed_k == 1.0 else str(speed_k))
	if not paused:
		Engine.time_scale = speed_k


func _toggle_ik() -> void:
	rig.hold.ik_on = not rig.hold.ik_on
	rig.hold._has_cur = false
	ik_btn.text = "Хват: новый" if rig.hold.ik_on else "Хват: как было"


func _mark(m: String) -> void:
	marks[cur.id] = "" if marks.get(cur.id, "") == m else m
	_save_marks()
	_refresh()


func _refresh() -> void:
	for i in entries.size():
		var en: Dictionary = entries[i]
		var m := String(marks.get(en.id, ""))
		var b: Button = rows[en.id]
		b.text = "%s  %s" % [{"ok": "✔", "bad": "✖", "": "·"}[m], en.n]
		var col: Color = {"ok": Color(0.55, 1.0, 0.6), "bad": Color(1.0, 0.5, 0.45), "": C_TEXT}[m]
		if audit_res.has(en.id):
			# итог автоматической проверки позы: ! — есть замечание
			var a_ok := bool(audit_res[en.id].ok)
			b.text = "%s %s" % [b.text, "" if a_ok else "  !"]
			if m == "":
				col = Color(0.7, 0.95, 0.75) if a_ok else Color(1.0, 0.78, 0.4)
		b.add_theme_color_override("font_color", col)
		b.add_theme_stylebox_override("normal", _style(Color(0.1, 0.26, 0.38, 0.95) if i == cur_i else Color(0.05, 0.1, 0.15, 0.92), 10, 2 if i == cur_i else 1))
	title_lbl.text = "%s · %s" % [cur.g, cur.n]
	if list_sc and rows.has(cur.id):
		list_sc.ensure_control_visible.call_deferred(rows[cur.id])
	var m2 := String(marks.get(cur.id, ""))
	ok_btn.add_theme_color_override("font_color", Color(0.55, 1.0, 0.6) if m2 == "ok" else C_TEXT)
	bad_btn.add_theme_color_override("font_color", Color(1.0, 0.5, 0.45) if m2 == "bad" else C_TEXT)


func _info() -> void:
	var parts := []
	if cur.has("action"):
		parts.append("клип «%s»" % cur.action)
	elif cur.has("speed"):
		parts.append("скорость %.1f м/с" % float(cur.speed))
	var h := rig.hold
	if h.wid != "" and h.ik_on and h.w.mode != "melee":
		parts.append("ладонь до рукояти: правая %.1f см, левая %.1f см" % [h.err_r * 100.0, h.err_l * 100.0])
		if h.reload_step != "":
			parts.append("перезарядка: " + h.reload_step)
		if h.finger == "trigger" or h.finger == "index":
			parts.append("палец на спуске" if h.finger == "trigger" else "палец вдоль рамки")
	if last_hit != "" and h.wid != "" and h.w.mode != "melee":
		parts.append(last_hit)
	if pack != "":
		parts.append("%s, ячеек: %d" % [BCPackFit.PACKS[pack].n, BCPackFit.PACKS[pack].slots])
	parts.append("%d кадров/с" % Engine.get_frames_per_second())
	parts.append(audit.line())
	if who != "hero":
		var d: Dictionary = ULEnemy.KINDS[who]
		# у Рубера и муров общего «удара» нет (свои удары и оружие) — строка раньше падала с ошибкой и не показывалась
		var hit_t := ("удар %d раз в %.1f с" % [int(d.dmg), float(d.get("cd", 1.0))]) if d.has("dmg") else ("ударов в наборе: %d" % (d.get("attacks", []) as Array).size())
		if d.has("gun"):
			hit_t = "оружие: %s" % String(ULItems.get_def(String((d.gun as Dictionary).get("weapon", ""))).get("n", (d.gun as Dictionary).get("weapon", "")))
		parts.append("прочность %d, %s, шаг %.1f м/с, бег %.1f м/с, видит до %d м, слышит выстрел до %d м" % [int(d.hp), hit_t, float(d.get("walk", 0.0)), float(d.get("run", 0.0)), int(d.get("see", 0)), int(d.get("hear", 0))])
	info_lbl.text = " · ".join(parts)


func _summary() -> void:
	if modal:
		modal.queue_free()
		modal = null
		return
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _style(Color(0.02, 0.04, 0.07, 0.97), 18, 2))
	p.position = Vector2(340, 60)
	p.custom_minimum_size = Vector2(760, 560)
	var v := VBoxContainer.new()
	p.add_child(v)
	var ok := []
	var bad := []
	var none := []
	for en in entries:
		var m := String(marks.get(en.id, ""))
		var t := "%s: %s" % [en.g, en.n]
		if m == "ok":
			ok.append(t)
		elif m == "bad":
			bad.append(t)
		else:
			none.append(t)
	v.add_child(_lbl("ИТОГ ПРОВЕРКИ — сделайте снимок экрана и пришлите", 20, Color(0.55, 0.9, 1.0)))
	for blk in [["БРАК (%d)" % bad.size(), bad, Color(1.0, 0.55, 0.5)], ["ГОДИТСЯ (%d)" % ok.size(), ok, Color(0.6, 1.0, 0.65)], ["НЕ ОТМЕЧЕНО (%d)" % none.size(), none, C_TEXT]]:
		v.add_child(_lbl(blk[0], 17, blk[2]))
		var l := _lbl(", ".join(blk[1]) if not (blk[1] as Array).is_empty() else "—", 15, blk[2])
		l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
		l.custom_minimum_size = Vector2(730, 0)
		v.add_child(l)
	var hb := HBoxContainer.new()
	hb.add_child(_btn("Закрыть", _summary, 160))
	hb.add_child(_btn("Сбросить отметки", func():
		marks.clear()
		_save_marks()
		_refresh()
		_summary(), 220))
	v.add_child(hb)
	ui.add_child(p)
	modal = p


# ---------------- проверка поз ----------------
# «Проверка поз» проигрывает все движения по очереди и по замерам скелета отмечает те, где персонаж
# заваливается, переваливается, висит над полом, проваливается или криво лежит после падения (BCPoseAudit).

## сколько секунд смотреть движение, чтобы замер был полным
func _audit_wait(en: Dictionary) -> float:
	var m := audit_mode(en)
	if en.has("proc"):
		return {"draw": 5.2, "fire": 3.2, "burst": 3.6, "reload": 5.6}.get(String(en.proc), 3.4)
	if en.has("action"):
		var d := rig.clip_len(String(en.action)) / maxf(float(en.get("rate", 1.0)), 0.1)
		if en.has("pre_pose"):
			return 0.6 + 1.3 + d + 1.0
		return 0.6 + d + (1.9 if m == "dead" else 1.1)
	return 3.6 if m == "move" else 2.6


func _audit_all() -> void:
	if _audit_run:
		_audit_run = false               # повторное нажатие — остановить
		return
	if modal:
		modal.queue_free()
		modal = null
	_audit_run = true
	audit_res.clear()
	paused = false
	if audit_btn:
		audit_btn.text = "Стоп"
	# автопроверка: --as-only=idle,walk,run — только эти движения (быстрая перепроверка после правки)
	var only: PackedStringArray = []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			only = a.substr(10).split(",")
	for i in entries.size():
		if not _audit_run:
			break
		if test == "poses" and not only.is_empty() and not only.has(String(entries[i].id)):
			continue
		select(i)
		await get_tree().create_timer(_audit_wait(entries[i])).timeout
		if not is_inside_tree():
			return
		if cur_i != i:
			break                           # пользователь сам выбрал другое движение — проверка остановлена
		var r := audit.result()
		audit_res[entries[i].id] = r
		if test == "poses":
			var en: Dictionary = entries[i]
			var vs := []
			for vk in r.vals:
				vs.append("%s %.2f" % [vk, float(r.vals[vk])])
			print("[poses] %s · %s «%s» (%s): %s | %s" % [who if who != "hero" else hero_id, en.id, en.n, audit.mode, "норма" if r.ok else "ЗАМЕЧАНИЯ: " + "; ".join(r.notes), ", ".join(vs)])
			if not r.ok:
				var y0 := yaw
				get_viewport().scaling_3d_scale = 1.0
				for vw in [["f", 0.0], ["s", PI * 0.5]]:
					yaw = vw[1]
					await get_tree().process_frame
					await get_tree().process_frame
					await _snap("%s/%s_%s_%s.png" % [out, who if who != "hero" else hero_id, en.id, vw[0]])
				yaw = y0
				get_viewport().scaling_3d_scale = 0.3
		_refresh()
	_audit_run = false
	if audit_btn:
		audit_btn.text = "Проверка поз"
	if test != "poses":
		_audit_summary()


func _audit_summary() -> void:
	if modal:
		modal.queue_free()
		modal = null
	var p := PanelContainer.new()
	p.add_theme_stylebox_override("panel", _style(Color(0.02, 0.04, 0.07, 0.97), 18, 2))
	p.position = Vector2(340, 60)
	p.custom_minimum_size = Vector2(760, 520)
	var v := VBoxContainer.new()
	p.add_child(v)
	var bad := []
	var okn := 0
	for en in entries:
		if not audit_res.has(en.id):
			continue
		if bool(audit_res[en.id].ok):
			okn += 1
		else:
			bad.append("%s: %s — %s" % [en.g, en.n, "; ".join(audit_res[en.id].notes)])
	v.add_child(_lbl("ПРОВЕРКА ПОЗ — %s" % (ULHeroes.name_of(hero_id) if who == "hero" else String(ULEnemy.KINDS[who].n)), 20, Color(0.55, 0.9, 1.0)))
	v.add_child(_lbl("В норме: %d · с замечаниями: %d" % [okn, bad.size()], 17, Color(0.6, 1.0, 0.65) if bad.is_empty() else Color(1.0, 0.78, 0.4)))
	var sc := ScrollContainer.new()
	sc.custom_minimum_size = Vector2(740, 380)
	sc.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	v.add_child(sc)
	var l := _lbl("\n".join(bad) if not bad.is_empty() else "Все движения прошли проверку: никто не заваливается, стопы на полу, тела лежат ровно.", 15, C_TEXT)
	l.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	l.custom_minimum_size = Vector2(720, 0)
	sc.add_child(l)
	v.add_child(_btn("Закрыть", func():
		modal.queue_free()
		modal = null, 160))
	ui.add_child(p)
	modal = p


func _load_marks() -> void:
	if FileAccess.file_exists(MARKS):
		var d = JSON.parse_string(FileAccess.get_file_as_string(MARKS))
		if d is Dictionary:
			marks = d


func _save_marks() -> void:
	var f := FileAccess.open(MARKS, FileAccess.WRITE)
	if f:
		f.store_string(JSON.stringify(marks))


# ---------------- автопроверка ----------------

func _snap(path: String) -> void:
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(path)


func _run_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	if test == "poses":
		# проверка поз всех движений этого персонажа: замечания — в журнал, по два снимка на каждое замечание.
		# Картинка на время проверки — лёгкая (без теней, 3D в треть разрешения): на программной отрисовке это
		# даёт в несколько раз больше кадров, а значит и замеров позы; для снимка разрешение возвращается.
		for sl in find_children("*", "DirectionalLight3D", true, false):
			(sl as DirectionalLight3D).shadow_enabled = false
		get_viewport().scaling_3d_scale = 0.3
		await get_tree().create_timer(1.0).timeout
		await _audit_all()
		var bad_n := 0
		for id in audit_res:
			if not bool(audit_res[id].ok):
				bad_n += 1
		print("[poses] итог %s: движений %d, с замечаниями %d" % [who if who != "hero" else hero_id, audit_res.size(), bad_n])
		get_tree().quit()
		return
	if test == "enemy":
		# враг на стенде: по снимку на движение и общий вид с панелями; стойка — ещё и сбоку (как стоят стопы)
		select(0)
		yaw = PI * 0.5
		pitch = 0.05
		look_h = 0.6
		await get_tree().create_timer(1.2).timeout
		await _snap("%s/z_side.png" % out)
		# генератор мелких движений: кисти и голова крупно, по два кадра с паузой (видно, что пальцы и отростки живут)
		look_hands = true
		cam.h_offset = 0.0
		ui.visible = false
		yaw = 0.2
		pitch = 0.25
		dist = 1.3
		await get_tree().create_timer(0.5).timeout
		await _snap("%s/z_hands_a.png" % out)
		await get_tree().create_timer(0.9).timeout
		await _snap("%s/z_hands_b.png" % out)
		look_hands = false
		yaw = 0.35
		pitch = 0.0
		dist = 1.1
		look_h = rig.height * 0.88
		await get_tree().create_timer(0.5).timeout
		await _snap("%s/z_head_a.png" % out)
		await get_tree().create_timer(0.45).timeout
		await _snap("%s/z_head_b.png" % out)
		var ia := Image.load_from_file("%s/z_head_a.png" % out)
		var ib := Image.load_from_file("%s/z_head_b.png" % out)
		var diff := 0.0
		for yy in range(ia.get_height() / 4, ia.get_height() * 3 / 4, 2):
			for xx in range(ia.get_width() / 3, ia.get_width() * 2 / 3, 2):
				var ca := ia.get_pixel(xx, yy)
				var cb := ib.get_pixel(xx, yy)
				diff += absf(ca.r - cb.r) + absf(ca.g - cb.g) + absf(ca.b - cb.b)
		print("[stand] голова: различие двух кадров через 0.45 с — %.0f (0 — картинка неподвижна)" % diff)
		dist = 3.4
		cam.h_offset = -0.42
		ui.visible = true
		yaw = 0.55
		pitch = 0.22
		look_h = 1.0
		for i in entries.size():
			select(i)
			await get_tree().create_timer(1.6 if not entries[i].has("post_pose") else 3.4).timeout
			_info()
			await _snap("%s/z_%s.png" % [out, entries[i].id])
		print("[stand] враг «%s»: движений %d, модель %s, костей %d" % [String(ULEnemy.KINDS[who].n), entries.size(), rig.model_path.get_file(), rig.skel.get_bone_count()])
		get_tree().quit()
		return
	if test == "machdbg":
		for i in entries.size():
			if entries[i].id == "m_idle":
				select(i)
		await get_tree().create_timer(1.5).timeout
		var w := _ed_w()
		var tp := ULMeleeTuner.template()
		w.stances["guard"] = tp.guard
		for m in tp.moves:
			w.moves[m] = tp.moves[m]
		_ed_toggle()
		var h := rig.hold
		for kk in [["guard", 0], ["light", 4], ["heavy", 4]]:
			ed_move = kk[0]
			ed_key = kk[1]
			_ed_show()
			await _ed_settle()
			var sh: Vector3 = h._shift / h.k
			var hr: Vector3 = (h.hand_r - h._sc) / h.k
			var sk := rig.skel
			var ch := sk.find_bone("Spine02")
			var T1 := (sk.get_bone_global_pose(ch) * sk.get_bone_global_rest(ch).affine_inverse()).basis.orthonormalized()
			var cf: Vector3 = T1 * h.fwd
			print("[dbg] грудь повёрнута на %.0f° (вправо +), наклон %.0f°" % [rad_to_deg(atan2(cf.dot(h.rgt), cf.dot(h.fwd))), rad_to_deg(asin(clampf(cf.dot(h.upv), -1, 1)))])
			print("[dbg] %s/%d: цель %s · сдвиг плана (вперёд, вверх, вправо) %.2f %.2f %.2f · кисть %.2f %.2f %.2f · запястье %s" % [kk[0], kk[1], str(_ed_get()[1]), sh.dot(h.fwd), sh.dot(h.upv), sh.dot(h.rgt), hr.dot(h.fwd), hr.dot(h.upv), hr.dot(h.rgt), str(h.wrist_angles())])
		get_tree().quit()
		return
	if test == "machtune":
		# помощник: удары мачете по анатомии с проверкой на скелете; итог — в лог и в файл (для data/weapons.json)
		for i in entries.size():
			if entries[i].id == "m_idle":
				select(i)
		await get_tree().create_timer(1.5).timeout
		_ed_toggle()
		await _ed_helper()
		var w := _ed_w()
		var res := {"stances": {"guard": w.stances.guard}, "moves": {"light": w.moves.light, "heavy": w.moves.heavy, "block": w.moves.block}}
		var f := FileAccess.open("%s/melee_tuned.json" % out, FileAccess.WRITE)
		f.store_string(JSON.stringify(res, "\t"))
		f.close()
		_ed_toggle()
		await _mach_frames()
		get_tree().quit()
		return
	if test == "mach":
		# мачете: стойка и каждый ключ ударов — замороженными кадрами, с трёх сторон (сбоку, спереди, сверху как в игре)
		await _mach_frames()
		get_tree().quit()
		return
	if test == "ui":
		# снимки самого стенда с интерфейсом
		for id in ["r_aim", "p_aim", "m_idle"]:
			for i in entries.size():
				if entries[i].id == id:
					select(i)
			marks["idle"] = "ok"
			marks["getup"] = "bad"
			_refresh()
			await get_tree().create_timer(1.2).timeout
			_info()
			await _snap("%s/ui_%s.png" % [out, id])
		_summary()
		await get_tree().create_timer(0.2).timeout
		await _snap("%s/ui_summary.png" % out)
		get_tree().quit()
		return
	if test == "draw":
		await _draw_test()
		get_tree().quit()
		return
	if test == "wobble":
		await _wobble()
		get_tree().quit()
		return
	if test == "hands":
		await _hands_test()
		get_tree().quit()
		return
	if test == "strip":
		await _strip_test()
		get_tree().quit()
		return
	if test == "body":
		# размеры тела: высоты костей и сечение тела (радиус по направлениям) на нескольких высотах, метры
		var sk := rig.skel
		var k := rig.hold.k
		var h0: float = sk.get_bone_global_rest(sk.find_bone("BoneRoot")).origin.y if sk.find_bone("BoneRoot") >= 0 else 0.0
		for b in ["Hip", "Waist", "Spine01", "Spine02", "L_Thigh", "R_Thigh", "L_Upperarm", "Head"]:
			var o := sk.get_bone_global_rest(sk.find_bone(b)).origin
			print("[body] %s: вверх %.3f, вперёд %.3f, вправо %.3f" % [b, (o.dot(rig.hold.upv)) / k, o.dot(rig.hold.fwd) / k, o.dot(rig.hold.rgt) / k])
		var mi: MeshInstance3D = null
		for m in rig.model.find_children("*", "MeshInstance3D", true, false):
			mi = m
		var xf := sk.global_transform.affine_inverse() * mi.global_transform
		var verts := []
		for si in mi.mesh.get_surface_count():
			var arr := mi.mesh.surface_get_arrays(si)
			for v in (arr[Mesh.ARRAY_VERTEX] as PackedVector3Array):
				verts.append(xf * v)
		print("[body] вершин ", verts.size())
		var hip := sk.get_bone_global_rest(sk.find_bone("Hip")).origin
		for dy in [-0.06, -0.02, 0.02, 0.06, 0.1, 0.14]:
			var y0: float = hip.dot(rig.hold.upv) / k + dy
			var bins := []
			for i in 16:
				bins.append(0.0)
			var n := 0
			for v in verts:
				var p: Vector3 = (v as Vector3) - hip
				if absf((v as Vector3).dot(rig.hold.upv) / k - y0) > 0.012:
					continue
				var x := p.dot(rig.hold.rgt) / k
				var z := p.dot(rig.hold.fwd) / k
				var a := atan2(x, -z)                     # 0 — назад, ±PI — вперёд
				var bi := int(floor((a + PI) / TAU * 16.0)) % 16
				bins[bi] = maxf(bins[bi], sqrt(x * x + z * z))
				n += 1
			print("[body] Hip%+.2f (%.3f м): %d вершин; радиус по направлениям от «вперёд» через «вправо» назад и влево: %s" % [dy, y0, n, str(bins.map(func(r): return snappedf(r, 0.005)))])
		get_tree().quit()
		return
	if test == "packtop":
		# вид сверху на высоте ремня: точки тела (серые), ремень (жёлтые), сечение R (синее) — в файл
		var f := FileAccess.open(out.path_join("packtop.txt"), FileAccess.WRITE)
		wear_pack("large")
		var sk := rig.skel
		var k := rig.hold.k
		var mi: MeshInstance3D = pack_node
		var Hc: Vector3 = mi.get_meta("Hc")
		var R: Array = mi.get_meta("R")
		f.store_line("R " + " ".join(R.map(func(x): return str(x))))
		for m in rig.model.find_children("*", "MeshInstance3D", true, false):
			var xf := sk.global_transform.affine_inverse() * (m as MeshInstance3D).global_transform
			for si in (m as MeshInstance3D).mesh.get_surface_count():
				for v in ((m as MeshInstance3D).mesh.surface_get_arrays(si)[Mesh.ARRAY_VERTEX] as PackedVector3Array):
					var p := xf * v - Hc
					if absf(p.dot(rig.hold.upv)) < 0.05 * k:
						f.store_line("B %.4f %.4f %.4f" % [p.dot(rig.hold.rgt) / k, p.dot(rig.hold.fwd) / k, p.dot(rig.hold.upv) / k])
		for si in mi.mesh.get_surface_count():
			var arr := mi.mesh.surface_get_arrays(si)
			var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
			var we: PackedFloat32Array = arr[Mesh.ARRAY_WEIGHTS]
			for i in vs.size():
				var p := vs[i] - Hc
				f.store_line("P %.4f %.4f %.4f %.3f" % [p.dot(rig.hold.rgt) / k, p.dot(rig.hold.fwd) / k, p.dot(rig.hold.upv) / k, we[i * 4 + 2]])
		f.close()
		get_tree().quit()
		return
	if test == "packs":
		ui.visible = false
		cam.h_offset = 0.0
		DirAccess.make_dir_recursive_absolute(out)
		var poses := [""]
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				poses = Array(a.substr(10).split(","))
		for i in entries.size():
			if entries[i].id == poses[0]:
				select(i)
		for id in ["", "small", "medium", "large"]:
			wear_pack(id)
			await get_tree().create_timer(0.8).timeout
			if id == "large":
				# наклон костей: угол «вверх» кости от вертикали (с учётом покоя), град
				var sk := rig.skel
				var parts := []
				for b in ["Hip", "Waist", "Spine01", "Spine02", "NeckTwist01", "Head"]:
					var bi := sk.find_bone(b)
					var R := sk.get_bone_global_pose(bi).basis.orthonormalized() * sk.get_bone_global_rest(bi).basis.orthonormalized().inverse()
					parts.append("%s %.0f°" % [b, rad_to_deg((R * rig.hold.upv).angle_to(rig.hold.upv))])
				print("[pack] наклон костей (поза клипа): ", ", ".join(parts))
				var pr: Dictionary = rig.probe.rot
				var p2 := []
				for b in ["Hip", "Spine02", "Head"]:
					if pr.has(b):
						var R2 := (pr[b] as Basis).orthonormalized() * sk.get_bone_global_rest(sk.find_bone(b)).basis.orthonormalized().inverse()
						p2.append("%s %.0f°" % [b, rad_to_deg((R2 * rig.hold.upv).angle_to(rig.hold.upv))])
				print("[pack] наклон костей (итог после поправок): ", ", ".join(p2))
				var mi := pack_node as MeshInstance3D
				var fm: int = mi.mesh.surface_get_format(0)
				print("[pack] кожа: skin %s, skeleton %s → %s, формат: кости %s, веса %s, ссылка %s" % [str(mi.skin != null), str(mi.skeleton), str(mi.get_node_or_null(mi.skeleton)), str(fm & Mesh.ARRAY_FORMAT_BONES != 0), str(fm & Mesh.ARRAY_FORMAT_WEIGHTS != 0), str(mi.get_skin_reference())])
			for v in [["a", PI * 0.5, 0.1, 2.6, 1.1], ["b", PI - 0.6, 0.15, 2.6, 1.1], ["c", 0.5, 0.1, 2.6, 1.1], ["d", 0.0, 0.02, 2.0, 0.95], ["e", -PI * 0.5, 0.05, 2.0, 0.95], ["f", PI * 0.75, 1.25, 1.6, 1.0], ["g", PI * 0.25, -0.15, 1.7, 0.8], ["h", -0.6, 0.05, 1.1, 0.98], ["i", -PI * 0.5, 0.0, 1.1, 0.98], ["j", PI * 0.6, 0.1, 1.1, 0.98]]:
				yaw = v[1]
				pitch = v[2]
				dist = v[3]
				look_h = v[4]
				_camera()
				await get_tree().process_frame
				await _snap("%s/draw_pack_%d%s.png" % [out, ["", "small", "medium", "large"].find(id), v[0]])
		get_tree().quit()
		return
	if test == "parts":
		# оружие отдельно от героя: целиком, без магазина (и без затвора), только части; справа и слева
		ui.visible = false
		DirAccess.make_dir_recursive_absolute(out)
		var ids := ["rifle"]
		for a in OS.get_cmdline_user_args():
			if a.begins_with("--as-only="):
				ids = Array(a.substr(10).split(","))
		cam_free = true
		for wid in ids:
			var w: Dictionary = BCWeaponHold.config()[wid]
			var holder := Node3D.new()
			add_child(holder)
			holder.global_position = Vector3(6, 1.2, 0)
			var m: Node3D = (load(w.model) as PackedScene).instantiate()
			if w.get("flip", false):
				m.rotation.y = PI
			holder.add_child(m)
			var wp := BCWeaponParts.build(holder, m, w.get("parts", {}))
			var L := float(w.model_len)
			cam.fov = 30.0
			for st in ["all", "body", "parts"]:
				m.visible = st != "parts"
				for pn in wp.pivots:
					(wp.pivots[pn] as Node3D).visible = st != "body"
				for sd in [["r", 1.0], ["l", -1.0]]:
					var aabb_c := holder.global_position + Vector3(0, float(w.get("view_y", 0.2)), 0)
					cam.global_position = aabb_c + Vector3(float(sd[1]) * L * 2.0, 0.0, 0)
					cam.look_at(aabb_c, Vector3.UP)
					await get_tree().process_frame
					await _snap("%s/parts_%s_%s_%s.png" % [out, wid, st, sd[0]])
			holder.queue_free()
		get_tree().quit()
		return
	if test == "sound":
		await _sound_test()
		get_tree().quit()
		return
	if test == "grips":
		await _grips_test()
		get_tree().quit()
		return
	if test == "vidseq":
		await _vidseq_test()
		get_tree().quit()
		return
	ui.visible = false
	cam.h_offset = 0.0
	if OS.get_cmdline_user_args().has("--as-ik=off"):
		rig.hold.ik_on = false               # «как было»: оружие приклеено к кисти, руки из клипа
	var only := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			only = Array(a.substr(10).split(","))
	var lines := []
	await get_tree().create_timer(0.5).timeout
	for i in entries.size():
		var en: Dictionary = entries[i]
		if not only.is_empty() and not only.has(en.id):
			continue
		select(i)
		var er := 0.0
		var el := 0.0
		var dev := 0.0
		var rng := {}                 # размах углов суставов за всё движение: "R0" → [мин, макс]
		# два момента × три вида (спереди-сбоку, слева, руки крупно)
		var times := [0.9, 0.5] if not en.has("proc") else ([0.58, 0.25] if en.proc != "reload" else [1.3, 0.75])
		if en.has("proc") and String(en.proc).begins_with("swing:"):
			times = [0.5 + 0.33 * float(rig.hold.w.moves[String(en.proc).substr(6)].len), 0.2 * float(rig.hold.w.moves[String(en.proc).substr(6)].len)]
		if en.has("action"):
			var al: float = rig.info[en.action].len if rig.info.has(en.action) else 1.0
			# построенные удары снимаются в момент касания ("hit" — доля длины клипа)
			var hit := float(rig.info.get(en.action, {}).get("hit", 0.42))
			times = [0.5 + (1.3 if en.has("pre_pose") else 0.0) + (al * hit if rig.info.get(en.action, {}).get("built", false) else 0.45), (al * 0.25 if rig.info.get(en.action, {}).get("built", false) else 0.5)]
		# покой включается сам через BCWeaponHold.REST_AFTER с после остановки: ждём его и переход в него не считаем
		var skip := 0.45
		if bool(en.get("still", false)):
			skip = BCWeaponHold.REST_AFTER + 1.0
			times = [skip + 0.6, 0.5]
		for m in times.size():
			var t := 0.0
			while t < float(times[m]):
				await get_tree().process_frame
				t += get_process_delta_time()
				if (m > 0 or t > skip) and rig.hold.wid != "" and rig.hold.ik_on:
					for sd in (["R", "L"] if rig.hold.two_hands else ["R"]):
						for ji in 3:
							var v: float = rig.hold.joints[sd][ji]
							var key := "%s%d" % [sd, ji]
							if not rng.has(key):
								rng[key] = [v, v]
							rng[key] = [minf(rng[key][0], v), maxf(rng[key][1], v)]
				if m > 0 or t > skip:                     # переход из прошлой стойки не считаем
					er = maxf(er, rig.hold.err_r)
					el = maxf(el, rig.hold.err_l)
					dev = maxf(dev, rig.hold.aim_dev)
			var was := Engine.time_scale
			Engine.time_scale = 0.0
			var views := [["a", 0.6, 0.15, 2.9, 1.0], ["b", -PI * 0.5, 0.1, 2.9, 1.0], ["c", -1.0, 0.3, 0.75, -1.0], ["d", 1.1, 0.25, 0.75, -1.0], ["e", 0.0, 1.35, 1.0, -1.0]]
			if OS.get_cmdline_user_args().has("--as-views=vid"):
				# как в видео-образце: спереди в рост, справа в рост, справа крупно (плечи и оружие), спереди-справа крупно
				views = [["f", 0.0, 0.06, 3.3, 0.95], ["s", -PI * 0.5, 0.04, 3.3, 0.95], ["k", -PI * 0.5, 0.03, 1.35, 1.42], ["q", -0.55, 0.08, 1.5, 1.4]]
			for v in views:
				yaw = v[1]
				pitch = v[2]
				dist = v[3]
				look_hands = float(v[4]) < 0.0
				if not look_hands:
					look_h = v[4]
				_camera()
				await get_tree().process_frame
				await _snap("%s/%s_%d%s.png" % [out, en.id, m, v[0]])
			Engine.time_scale = was
		var line := "%s (%s · %s): ладонь—рукоять правая %.1f см, левая %.1f см, ствол от «вперёд» %.1f°" % [en.id, en.g, en.n, er * 100.0, el * 100.0, dev]
		if not rng.is_empty():
			var lim := [BCWeaponHold.LIM_FLEX, BCWeaponHold.LIM_DEV, BCWeaponHold.LIM_SUP]
			var nm := ["сгиб", "вбок", "предплечье"]
			var bad := []
			for sd in ["R", "L"]:
				if not rng.has(sd + "0"):
					continue
				var parts := []
				for ji in 3:
					var r: Array = rng["%s%d" % [sd, ji]]
					parts.append("%s %.0f…%.0f°" % [nm[ji], r[0], r[1]])
					if float(r[0]) < float(lim[ji][2]) - 0.5 or float(r[1]) > float(lim[ji][3]) + 0.5:
						bad.append("%s %s" % ["правая" if sd == "R" else "левая", nm[ji]])
				line += "\n    %s кисть: %s" % ["правая" if sd == "R" else "левая", ", ".join(parts)]
			line += "\n    анатомия: %s" % ("в пределах" if bad.is_empty() else "ВНЕ ПРЕДЕЛОВ — " + ", ".join(bad))
			# установившаяся поза (последний кадр): отдельно от размаха за всё движение, куда входит и переход в стойку
			var fin := []
			for sd in (["R", "L"] if rig.hold.two_hands else ["R"]):
				var jj: Array = rig.hold.joints[sd]
				var okj := true
				for ji in 3:
					if float(jj[ji]) < float(lim[ji][2]) - 0.5 or float(jj[ji]) > float(lim[ji][3]) + 0.5:
						okj = false
				fin.append("%s %.0f/%.0f/%.0f°%s" % ["правая" if sd == "R" else "левая", jj[0], jj[1], jj[2], "" if okj else " (ВНЕ)"])
			line += "\n    в конце (сгиб/вбок/предплечье): %s; ладони мимо: правая %.1f см, левая %.1f см; стойка «%s»" % [", ".join(fin), rig.hold.err_r * 100.0, rig.hold.err_l * 100.0, rig.hold.stance_now()]
		print("[stand] " + line)
		lines.append(line)
	var f := FileAccess.open(out.path_join("log.txt"), FileAccess.WRITE)
	if f:
		f.store_string("\n".join(lines))
	get_tree().quit()


## насколько «гуляют» части тела в покое: размах (см) и средняя скорость (см/с) за 8 секунд
## кадры мачете: ключи движений (доли времени) — кадр за кадром, удар «стоит» на месте (move_rate ≈ 0)
func _mach_frames() -> void:
	for i in entries.size():
		if entries[i].id == "m_idle":
			select(i)
	await get_tree().create_timer(2.5).timeout
	ui.visible = false
	cam_free = true
	var views := [["side", PI * 0.5, 0.12, 2.6], ["front", 0.0, 0.1, 2.8], ["top", 0.35, 0.95, 4.2]]
	var frames := [["guard", ""]]
	for mv in ["light", "heavy"]:
		for kk in rig.hold.w.moves[mv].keys:
			frames.append(["%s_%02d" % [mv, int(float(kk[0]) * 100.0)], mv, float(kk[0])])
	for fr in frames:
		if String(fr[1]) != "":
			rig.hold.swing(String(fr[1]))
			rig.hold.move_rate = 0.00001
			rig.hold._move_t = float(fr[2]) * float(rig.hold.w.moves[fr[1]].len)
		await get_tree().create_timer(0.6).timeout
		for v in views:
			yaw = float(v[1])
			pitch = float(v[2])
			dist = float(v[3])
			look_h = 1.2
			_camera()
			await get_tree().create_timer(0.15).timeout
			await _snap("%s/m_%s_%s.png" % [out, fr[0], v[0]])
		rig.hold.move_rate = 1.0
		rig.hold._move = ""
	print("[stand] мачете: кадров %d" % frames.size())


func _wobble() -> void:
	var ids := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			ids = Array(a.substr(10).split(","))
	for i in entries.size():
		var en: Dictionary = entries[i]
		if not ids.has(en.id):
			continue
		select(i)
		await get_tree().create_timer(1.5).timeout
		var mn := {}
		var mx := {}
		var path := {}
		var last := {}
		var t := 0.0
		while t < 8.0:
			await get_tree().process_frame
			t += get_process_delta_time()
			for b in rig.probe.pos:
				var p: Vector3 = (rig.probe.pos[b] as Vector3) * rig.scale_k * 100.0
				if not mn.has(b):
					mn[b] = p
					mx[b] = p
					path[b] = 0.0
				else:
					mn[b] = (mn[b] as Vector3).min(p)
					mx[b] = (mx[b] as Vector3).max(p)
					path[b] += p.distance_to(last[b])
				last[b] = p
		var parts := []
		for b in ["Hip", "Head", "L_Hand", "R_Hand", "L_Forearm", "L_Calf", "R_Calf", "L_Foot", "R_Foot"]:
			if mn.has(b):
				var r: Vector3 = (mx[b] as Vector3) - (mn[b] as Vector3)
				parts.append("%s размах %.1f см, %.1f см/с" % [b, maxf(r.x, maxf(r.y, r.z)), float(path[b]) / t])
		print("[stand] покой «%s»: %s" % [en.n, "; ".join(parts)])


## достать оружие по шагам и выстрелить: снимки (общий вид и кисти) и отклонение на мишени
func _draw_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	ui.visible = false
	cam.h_offset = 0.0
	for i in entries.size():
		if entries[i].id == "idle":
			select(i)
	await get_tree().create_timer(0.6).timeout
	for ln in rig.pose_report:
		print("[stand] " + String(ln))
	var only := []
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			only = Array(a.substr(10).split(","))
	for wpn in ["pistol", "rifle", "melee", "spas12", "fnfal", "vss", "mp5", "pkp"]:
		if not only.is_empty() and not only.has(wpn):
			continue
		rig.hold.equip(wpn, false)
		_body_pose()
		await get_tree().create_timer(0.5).timeout
		# счёт доставания: убрано → кисть на рукояти → вынул → у груди → встреча рук → стойка
		var dk: Dictionary = rig.hold.w.get("draw", {})
		var g := float(dk.get("grab", 0.3))
		var marks_at := [0.0, g, float(dk.get("clear_t", g + 0.14)), 0.56, 0.76, 1.0] if rig.hold.w.mode != "melee" else [0.0, g, float(dk.get("clear_t", g + 0.14)), 0.72, 0.87, 1.0]
		for mi in marks_at.size():
			# кадр ставится точно на счёт (при программной отрисовке кадры редкие) и успевает «устояться»
			rig.hold._draw_dir = 0.0
			rig.hold.drawn = float(marks_at[mi])
			_body_pose()
			await get_tree().create_timer(0.7).timeout
			var was := Engine.time_scale
			Engine.time_scale = 0.0
			for v in [["a", -0.75, 0.12, 2.3, 1.15], ["b", -PI * 0.5, 0.1, 2.3, 1.15], ["c", 0.0, 0.1, 2.0, 1.2], ["d", -1.0, 0.3, 0.8, -1.0]]:
				yaw = v[1]
				pitch = v[2]
				dist = v[3]
				look_hands = float(v[4]) < 0.0
				if not look_hands:
					look_h = v[4]
				_camera()
				await get_tree().process_frame
				await _snap("%s/draw_%s_%d%s.png" % [out, wpn, mi, v[0]])
			Engine.time_scale = was
			var jr: Array = rig.hold.joints.R
			print("[stand] %s, счёт %d (%.2f): палец — %s, ладонь—рукоять %.1f см, кисть: сгиб %.0f°, вбок %.0f°, предплечье %.0f°" % [wpn, mi, rig.hold.drawn, rig.hold.finger, rig.hold.err_r * 100.0, jr[0], jr[1], jr[2]])
			if mi == marks_at.size() - 1:
				print("[stand] %s, стойка %s: сдвиг оружия при подгонке %s см" % [wpn, rig.hold.stance, str(((rig.hold.last_plan.t as Vector3) / rig.hold.k * 100.0).snapped(Vector3.ONE * 0.1))])
		var j: Dictionary = rig.hold.joints
		print("[stand] достал %s: правая кисть сгиб %.0f°, вбок %.0f°, предплечье %.0f°" % [wpn, j.R[0], j.R[1], j.R[2]])
		if rig.hold.w.mode != "melee":
			rig.hold.set_stance("aim")
			await get_tree().create_timer(0.9).timeout
			for n in 3:
				_fire()
				print("[stand] %s, выстрел %d — %s" % [wpn, n + 1, last_hit])
				if n == 0:
					await get_tree().process_frame
					Engine.time_scale = 0.0
					yaw = PI + 0.5
					pitch = 0.16
					dist = 3.2
					look_hands = false
					look_h = 1.35
					_camera()
					await get_tree().process_frame
					await _snap("%s/fire_%s.png" % [out, wpn])
					Engine.time_scale = 1.0
				await get_tree().create_timer(0.5).timeout
			rig.hold.set_stance("ready")


## кисть крупным планом: каждая поза пальцев с пяти сторон (тыл, ладонь, костяшки, со стороны большого, мизинца)
func _hands_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	ui.visible = false
	cam.h_offset = 0.0
	cam_free = true
	rig.set_process(false)
	rig.tree.active = false
	var sk := rig.skel
	for c in sk.get_children():
		if c is SkeletonModifier3D:
			(c as SkeletonModifier3D).active = false
	var h := rig.hold
	var poses := ["relax", "fist", "trigger", "index", "wrap", "support"]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			poses = Array(a.substr(10).split(","))
	cam.near = 0.01
	cam.fov = 24.0
	var fill := OmniLight3D.new()                 # подсветка со стороны камеры: ладонь не в тени
	fill.light_energy = 1.4
	fill.omni_range = 3.0
	cam.add_child(fill)
	if OS.get_cmdline_user_args().has("--as-dump"):
		for side in ["R", "L"]:
			var hf0: Dictionary = h._hf[side]
			var G0: Transform3D = sk.get_bone_global_rest(hf0.hand)
			var ax0: Basis = (hf0.local_inv as Basis).inverse()
			var B0 := G0.basis.orthonormalized() * ax0
			print("[hand] %s psign %.0f" % [side, hf0.psign])
			for f in ["Thumb", "Index", "Mid", "Ring", "Pinky"]:
				var line := "  %s:" % f
				var prev := Vector3.ZERO
				for j in 3:
					var b: int = hf0.fingers[f][j]
					var o: Vector3 = B0.inverse() * (sk.get_bone_global_rest(b).origin - G0.origin) / h.k * 100.0
					line += " j%d(F %.1f A %.1f P %.1f)" % [j + 1, o.x, o.y, o.z]
					var ch := sk.get_bone_children(b)
					if j == 2:
						for c2 in ch:
							var o2: Vector3 = B0.inverse() * (sk.get_bone_global_rest(c2).origin - G0.origin) / h.k * 100.0
							line += " %s(F %.1f A %.1f P %.1f)" % [sk.get_bone_name(c2), o2.x, o2.y, o2.z]
				print(line)
	for pose in poses:
		if not BCWeaponHold.CURL.has(pose):
			continue
		for side in ["R", "L"]:
			sk.reset_bone_poses()
			h._curl(sk, side, pose)
			await get_tree().process_frame
			var hf: Dictionary = h._hf[side]
			var G: Transform3D = sk.global_transform * sk.get_bone_global_pose(hf.hand)
			var ax: Basis = (hf.local_inv as Basis).inverse()
			var Gb := G.basis.orthonormalized()
			var F := (Gb * ax.x).normalized()
			var A := (Gb * ax.y).normalized()
			var P := (Gb * ax.z).normalized()
			var c := G * ((hf.palm_l as Vector3) * 1.25)
			var views := [["a", -P, F], ["b", P, F], ["c", F, -P], ["d", A, -P], ["e", -A, -P], ["f", (F + A - P * 0.8).normalized(), -P]]
			for v in views:
				cam.global_position = c + (v[1] as Vector3) * 0.62
				cam.look_at(c, v[2])
				await get_tree().process_frame
				await _snap("%s/hand_%s_%s%s.png" % [out, pose, side, v[0]])


## Последовательность как в видео-образце: покой (оружие поперёк груди) → вскинул → прицел → выстрелы → опустил.
## Кадры справа в рост (как в видео) в заданные моменты; --as-only=<приставка оружия>, по умолчанию r (автомат).
func _vidseq_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	ui.visible = false
	cam.h_offset = 0.0
	var pre := "r"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			pre = a.substr(10)
	var pick := func(id: String) -> void:
		for i in entries.size():
			if entries[i].id == id:
				select(i)
	var shot := func(nm: String, front: bool) -> void:
		var was := Engine.time_scale
		Engine.time_scale = 0.0
		yaw = 0.0 if front else -PI * 0.5
		pitch = 0.05
		dist = 3.3
		look_hands = false
		look_h = 0.95
		_camera()
		await get_tree().process_frame
		await _snap("%s/%s.png" % [out, nm])
		Engine.time_scale = was
	var wait := func(sec: float) -> void:
		var t := 0.0
		while t < sec:
			await get_tree().process_frame
			t += get_process_delta_time()
	paused = true                      # сами ведём последовательность: без повторов движения стенда
	var seq := ""
	var st_from := "aim"
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-seq="):
			seq = a.substr(9)
		if a.begins_with("--as-from="):
			st_from = a.substr(10)
	# крупные кадры: вид справа (плечи и оружие) и спереди-справа
	var close := func(nm: String, v: String) -> void:
		var was := Engine.time_scale
		Engine.time_scale = 0.0
		yaw = -PI * 0.5 if v in ["k", "w"] else (-0.55 if v == "q" else -PI * 0.5)
		pitch = 0.03 if v == "k" else 0.08
		dist = 1.55 if v == "k" else (1.6 if v == "q" else (2.6 if v == "w" else 3.3))
		look_hands = false
		look_h = 1.42 if v == "k" else (1.38 if v == "q" else (1.25 if v == "w" else 0.95))
		# крупный вид справа: в кадре не только плечи, но и оружие с руками; w — шире, с дульным срезом и дымком
		cam.h_offset = 0.36 if v == "k" else (0.75 if v == "w" else 0.0)
		_camera()
		await get_tree().process_frame
		await _snap("%s/%s_%s.png" % [out, nm, v])
		cam.h_offset = 0.0
		Engine.time_scale = was
	if seq == "fire":
		# одиночный выстрел покадрово: отдача, затвор, гильза, дым
		pick.call(pre + "_aim")
		rig.set_motion(0.0, 0.0, 0.016)
		await wait.call(1.6)
		await close.call("f00_before", "k")
		# время замедлено: кадр отрисовки здесь долгий, а выстрел длится две десятых секунды
		Engine.time_scale = 0.1
		_fire()
		var pv := 0.0
		var fi := 1
		for tm in [0.012, 0.03, 0.05, 0.08, 0.12, 0.17, 0.24, 0.34, 0.5]:
			await wait.call(float(tm) - pv)
			pv = tm
			await close.call("f%02d_%03d" % [fi, int(float(tm) * 1000.0)], "k")
			if fi in [1, 3, 5, 7]:
				await close.call("f%02d_%03d" % [fi, int(float(tm) * 1000.0)], "w")
			fi += 1
		Engine.time_scale = 1.0
		await wait.call(0.6)
		# очередь: три выстрела подряд, кадр на каждом — вид спереди-справа и общий
		Engine.time_scale = 0.15
		for bi in 3:
			_fire()
			await wait.call(0.03)
			await close.call("b%d_shot" % bi, "q")
			await close.call("b%d_shot" % bi, "w")
			await wait.call(0.07)
		Engine.time_scale = 1.0
		var cs: Array = rig.hold.fx.cases_state() if rig.hold.fx != null else [0, 0]
		print("[stand] vidseq fire %s: гильз вылетело %d, дымков %d, видно гильз %d" % [pre, rig.hold.fx.ejected if rig.hold.fx != null else 0, rig.hold.fx.puffed if rig.hold.fx != null else 0, int(cs[0])])
		return
	if seq == "reload":
		pick.call(pre + ("_aim" if st_from == "aim" else "_walk"))
		if st_from != "aim":
			rig.hold.set_stance("ready")
		rig.set_motion(0.0, 0.0, 0.016)
		await wait.call(1.6)
		rig.hold.set_stance("ready")           # как в игре: на время перезарядки оружие — в стойке «наготове»
		# время замедлено и считается по ходу самой перезарядки: кадр отрисовки здесь долгий
		Engine.time_scale = 0.25
		var rlen := rig.hold.reload()
		var ri := 0
		for fr in [0.05, 0.12, 0.19, 0.24, 0.33, 0.43, 0.52, 0.62, 0.7, 0.76, 0.84, 0.89, 0.95]:
			while rig.hold._reload_t >= 0.0 and rig.hold._reload_t / rig.hold._reload_len() < float(fr):
				await get_tree().process_frame
			await close.call("r%02d_%03d" % [ri, int(float(fr) * 100.0)], "s")
			await close.call("r%02d_%03d" % [ri, int(float(fr) * 100.0)], "q")
			print("[stand] reload %.2f: шаг «%s», магазин %s, ладони мимо: правая %.1f см" % [float(fr), rig.hold.reload_step, rig.hold.mag_state, rig.hold.err_r * 100.0])
			ri += 1
		Engine.time_scale = 1.0
		print("[stand] vidseq reload %s: длительность %.2f с" % [pre, rlen])
		return
	pick.call(pre + "_rest")
	rig.set_motion(0.0, 0.0, 0.016)
	await wait.call(BCWeaponHold.REST_AFTER + 1.6)
	await shot.call("q0_rest_front", true)
	await shot.call("q1_rest", false)
	pick.call(pre + "_aim")
	var prev := 0.0
	var k := 2
	for tm in [0.1, 0.2, 0.32, 0.5, 0.9]:
		await wait.call(float(tm) - prev)
		prev = tm
		await shot.call("q%d_raise_%03d" % [k, int(float(tm) * 100.0)], false)
		k += 1
	_fire()
	await wait.call(0.04)
	await shot.call("q%d_fire_a" % k, false)
	k += 1
	await wait.call(0.06)
	_fire()
	await wait.call(0.05)
	await shot.call("q%d_fire_b" % k, false)
	k += 1
	await wait.call(0.5)
	pick.call(pre + "_rest")
	prev = 0.0
	for tm in [0.3, BCWeaponHold.REST_AFTER + 0.2, BCWeaponHold.REST_AFTER + 0.5, BCWeaponHold.REST_AFTER + 1.4]:
		await wait.call(float(tm) - prev)
		prev = tm
		await shot.call("q%d_lower_%03d" % [k, int(float(tm) * 100.0)], false)
		k += 1
	print("[stand] vidseq %s: кадров %d, ладони в конце: правая %.1f см, левая %.1f см, стойка «%s»" % [pre, k, rig.hold.err_r * 100.0, rig.hold.err_l * 100.0, rig.hold.stance_now()])


## кисти на оружии крупным планом: справа, слева, сверху, снизу-спереди
func _grips_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	ui.visible = false
	cam.h_offset = 0.0
	var ids := ["p_walk", "p_aim", "r_ready", "r_aim", "m_idle"]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			ids = Array(a.substr(10).split(","))
	var fill := OmniLight3D.new()
	fill.light_energy = 1.2
	fill.omni_range = 3.0
	cam.add_child(fill)
	for id in ids:
		for i in entries.size():
			if entries[i].id == id:
				select(i)
		await get_tree().create_timer(1.6).timeout
		Engine.time_scale = 0.0
		cam_free = true
		cam.near = 0.02
		cam.fov = 26.0
		var W: Transform3D = rig.skel.global_transform * rig.hold.node.transform
		var B := W.basis.orthonormalized()
		var c: Vector3 = W * Vector3(rig.hold.w.grip[0], rig.hold.w.grip[1], rig.hold.w.grip[2]) + B.y * 0.03
		if rig.hold.two_hands and rig.hold.w.mode == "rifle":
			c = rig.skel.global_transform * rig.hold.hand_r.lerp(rig.hold.hand_l, 0.5)
		var dd := 0.55 if rig.hold.w.mode != "rifle" else 0.95
		for v in [["a", B.x, B.y], ["b", -B.x, B.y], ["c", B.y + B.z * 0.15, -B.z], ["d", (-B.y * 0.55 - B.z * 0.75 + B.x * 0.3).normalized(), B.y]]:
			cam.global_position = c + (v[1] as Vector3).normalized() * dd
			cam.look_at(c, v[2])
			await get_tree().process_frame
			await _snap("%s/grip_%s_%s.png" % [out, id, v[0]])
		print("[stand] хват %s: палец — %s" % [id, rig.hold.finger])
		cam_free = false
		cam.fov = 38.0
		Engine.time_scale = 1.0


## полоса кадров одного движения: время замедляется, кадры снимаются точно на заданных долях движения
func _strip_test() -> void:
	DirAccess.make_dir_recursive_absolute(out)
	ui.visible = false
	cam.h_offset = 0.0
	var ids := ["kick"]
	var fr := [0.1, 0.3, 0.42, 0.52, 0.65, 0.85]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			ids = Array(a.substr(10).split(","))
		if a.begins_with("--as-at="):
			fr = []
			for x in a.substr(8).split(","):
				fr.append(float(x))
	for id in ids:
		for i in entries.size():
			if entries[i].id == id:
				select(i)
		var en: Dictionary = cur
		_timer = 1e9                              # движение запускает проверка
		await get_tree().create_timer(1.0).timeout
		Engine.time_scale = 0.12
		var total := 1.0
		var t0 := 0.0
		var clock := func() -> float: return 0.0
		if en.has("action"):
			total = rig.play(String(en.action))
		elif String(en.get("proc", "")).begins_with("swing:"):
			total = rig.hold.swing(String(en.proc).substr(6))
		elif String(en.get("proc", "")) == "reload":
			total = rig.hold.reload()
		elif String(en.get("proc", "")) in ["fire", "burst"]:
			_fire()
			total = float(en.get("strip_len", 1.0))
		var el := 0.0
		for k in fr.size():
			while el < float(fr[k]) * total:
				await get_tree().process_frame
				el += get_process_delta_time()
			var was := Engine.time_scale
			Engine.time_scale = 0.0
			for v in [["a", -0.75, 0.12, 2.6, 1.1], ["b", -PI * 0.5, 0.08, 2.6, 1.1], ["c", -1.0, 0.3, 0.8, -1.0], ["d", 0.35, 0.12, 1.5, 1.15], ["e", -PI * 0.5, 0.12, 0.85, -1.0]]:
				yaw = v[1]
				pitch = v[2]
				dist = v[3]
				look_hands = float(v[4]) < 0.0
				if not look_hands:
					look_h = v[4]
				_camera()
				if v[0] == "e" and rig.hold.node and rig.hold.parts and rig.hold.parts.has("mag"):
					# крупно справа на магазин
					var g := rig.hold.node.global_transform
					var tg: Vector3 = g * (rig.hold.parts.center.mag as Vector3)
					var rx := g.basis.x.normalized()
					cam.global_position = tg + rx * 0.7 + Vector3.UP * 0.12
					cam.look_at(tg, Vector3.UP)
					cam_free = true
				await get_tree().process_frame
				await _snap("%s/draw_%s_%d%s.png" % [out, id, k, v[0]])
				cam_free = false
			Engine.time_scale = was
			if rig.hold.wid != "":
				print("[stand] %s %.2f: шаг «%s», магазин: %s, в руке: %s, выброшен: %s" % [id, fr[k], rig.hold.reload_step, rig.hold.mag_state, str(rig.hold._prop != null and rig.hold._prop.visible), str(rig.hold._drop_node != null)])
		Engine.time_scale = 1.0
		await get_tree().create_timer(0.6).timeout


## проверка звуков: движения по очереди, журнал «что прозвучало и когда»
func _sound_test() -> void:
	ui.visible = false
	snd.log_on = true
	var ids := ["walk", "run", "punch", "cross", "kick", "hit", "fall", "p_draw", "p_fire", "p_reload", "r_fire", "r_reload", "h_reload", "k_reload", "b_reload", "s_fire", "s_reload", "m_light", "m_heavy", "m_block"]
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-only="):
			ids = Array(a.substr(10).split(","))
	var sum := {}
	for id in ids:
		for i in entries.size():
			if entries[i].id == id:
				select(i)
		snd.played.clear()
		var t0 := Time.get_ticks_msec()
		var dur := 5.0 if not String(id).ends_with("reload") else 7.0
		await get_tree().create_timer(dur).timeout
		var parts := []
		for e in snd.played:
			parts.append("%.2f %s" % [(int(e[0]) - t0) / 1000.0, e[1]])
		print("[sound] %s: %s" % [id, ", ".join(parts)])
		sum[id] = snd.played.size()
	for pk in ["small", ""]:
		snd.played.clear()
		wear_pack(pk)
		await get_tree().create_timer(0.6).timeout
		print("[sound] рюкзак «%s»: %s" % [pk, ", ".join(snd.played.map(func(e): return e[1]))])
	print("[sound] итог: ", sum)
