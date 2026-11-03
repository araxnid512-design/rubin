class_name Player
extends CharacterBody3D
## Герой: модель с клипами Mixamo (та же, что в браузерной игре). Анимацию собирает AnimationTree:
##   • низ — стойка / шаг / бег под оружие в руках (топор, пистолет, автомат); темп клипа — по настоящей скорости
##     героя, поэтому ступни не скользят; ноги идут по ходу движения (спиной вперёд — клип шага назад);
##   • верх (позвоночник и выше — фильтр костей) — прицел и выстрел поверх любой походки: на ходу ноги шагают,
##     руки держат прицел; выстрел, удар, получение урона и смена оружия — OneShot (стоя — всем телом,
##     на ходу — только верх);
##   • поверх анимации — модификатор позы (hero_pose.gd): корпус плавно доворачивается к цели, короткая отдача
##     с возвратом, левая кисть — на цевье двуручного ствола (IK к узлу GripL модели), у пистолета и топора без IK.
## Оружие — в узле GripR кисти, второе — в креплении на теле (чехол топора, кобура, ремень за спиной).
## Смена оружия по стадиям: опустить → убрать в крепление → взять другое → поднять.
## Огнестрел без патронов: каждый выстрел изнашивает ствол, на нуле — ломается.

signal died

const HeroPose := preload("res://scripts/hero_pose.gd")

const CLIPS := {
	"axe": {"idle": "Idle", "walk": "Walk", "run": "Run", "hit": "Hit", "attack": "Melee"},
	"pistol": {"idle": "IdlePistol", "walk": "WalkPistol", "run": "RunPistol", "hit": "HitPistol", "aim": "AimPistol", "shoot": "Shoot"},
	"rifle": {"idle": "IdleRifle", "walk": "WalkRifle", "run": "RunRifle", "hit": "HitRifle", "aim": "AimRifle", "shoot": "ShootRifle"},
}
const EQUIP := {"pistol": {"draw": "EquipPistol", "stow": "EquipAxe"}, "rifle": {"draw": "EquipRifle", "stow": "EquipAxeR"}}
## Клип смены оружия: [когда старое оружие уже в креплении, когда новое уже в руке], с — по этим моментам
## запечены клипы (EQUIP_TIMES в src/hero-animations.js).
const EQUIP_TIMES := {"EquipPistol": [0.36, 0.74], "EquipAxe": [0.26, 0.6], "EquipRifle": [0.36, 0.74], "EquipAxeR": [0.32, 0.66]}
const LOOPED := ["Idle", "Walk", "Run", "IdlePistol", "WalkPistol", "RunPistol", "AimPistol", "IdleRifle", "WalkRifle", "RunRifle", "AimRifle", "TurnRifle", "TurnPistol"]
const MOUNTS := {"axe": "AxeMount", "holster": "HolsterMount", "back": "BackMount"}
## Скорость клипов шага и бега при темпе 1, м/с (HERO_GAIT в src/hero-animations.js: шаг и бег — по живым клипам
## Quaternius UAL, CC0): темп подгоняется под настоящую скорость героя — ступни не скользят.
const GAIT := {"Walk": 1.455, "Run": 4.29, "WalkPistol": 1.339, "RunPistol": 4.03, "WalkRifle": 1.397, "RunRifle": 4.16}
## Ход в 8 направлениях относительно корпуса (HERO_GAIT8 в src/hero-animations.js): у автомата и пистолета корпус и
## оружие смотрят на цель, ноги идут туда, куда движется герой, — смешиваются два соседних клипа (BlendSpace2D, у всех
## клипов набора один цикл, левая стопа ставится в его начале). На направление: [скорость клипа при темпе 1, м/с;
## x — влево; z — вперёд].
const DIRS8 := ["F", "FL", "L", "BL", "B", "BR", "R", "FR"]
const GAIT8 := {
	"WalkRifle": {"F": [1.397, 0.0, 1.0], "FL": [1.257, 0.708, 0.706], "L": [0.838, 0.999, 0.035], "BL": [0.978, 0.703, -0.711], "B": [0.908, 0.0, -1.0], "BR": [0.978, -0.712, -0.702], "R": [0.838, -1.0, 0.0], "FR": [1.257, -0.707, 0.707]},
	"RunRifle": {"F": [4.16, -0.001, 1.0], "FL": [4.134, 0.734, 0.68], "L": [1.44, 0.999, 0.035], "BL": [2.912, 0.71, -0.705], "B": [2.704, -0.001, -1.0], "BR": [3.177, -0.709, -0.705], "R": [1.442, -1.0, 0.0], "FR": [4.134, -0.734, 0.68]},
	"WalkPistol": {"F": [1.339, 0.0, 1.0], "FL": [1.205, 0.708, 0.706], "L": [0.803, 0.999, 0.035], "BL": [0.937, 0.703, -0.711], "B": [0.87, 0.0, -1.0], "BR": [0.937, -0.712, -0.702], "R": [0.803, -1.0, 0.0], "FR": [1.205, -0.707, 0.707]},
	"RunPistol": {"F": [4.03, -0.001, 1.0], "FL": [4.134, 0.734, 0.68], "L": [1.44, 0.999, 0.035], "BL": [2.821, 0.71, -0.705], "B": [2.62, -0.001, -1.0], "BR": [3.177, -0.709, -0.705], "R": [1.442, -1.0, 0.0], "FR": [4.134, -0.734, 0.68]},
}
## Скорость хода по направлению относительно корпуса, доля скорости «вперёд» (DIR_SPEED в src/hero-animations.js):
## в прицеле боком и спиной вперёд человек идёт медленнее; под эту скорость подогнан шаг клипов.
const DIR_SPEED := {"F": 1.0, "FL": 0.9, "L": 0.6, "BL": 0.7, "B": 0.65, "BR": 0.7, "R": 0.6, "FR": 0.9}
## Наборы клипов по направлениям включены для этих классов (остальные — по-старому: ноги разворачиваются к ходу).
## Порядок по ТЗ: сначала автомат (АК-47), после проверки — остальные.
const DIRECTIONAL := {"rifle": true}
## Разгон и торможение, м/с²: шаги и темп клипа идут за настоящей скоростью — без рывка «стоял — сразу бежит»
## (0 → бег ~0,3 с, остановка ~0,2 с — управление не вязнет).
const ACCEL := 16.0
const DECEL := 24.0
## Разворот на месте (корпус ушёл от ног дальше TURN_START): ноги переступают (клип Turn*) с этой скоростью, рад/с.
const TURN_STEP_RATE := 5.0
## Инерция оружия при повороте корпуса: насколько ствол отстаёт (рад на рад/с поворота) и жёсткость возврата
## (собственная частота, рад/с) — у тяжёлых стволов отставание больше и возврат медленнее.
const SWAY := {"pistol": [0.018, 16.0], "sawnoff": [0.022, 14.0], "smg": [0.022, 14.0], "rifle": [0.03, 12.0], "shotgun": [0.034, 11.0], "heavy": [0.04, 9.0], "melee": [0.0, 12.0]}
## Профили хвата и отдачи (пакет «СТИКС», pose_data/weapon_pose_profiles.json; числа подогнаны под наш скелет и
## клипы — клип выстрела сам даёт ~3 см отдачи, здесь — добавка по оружию): two — двуручный хват (левая кисть на
## цевье через IK); raise / lower — подъём ствола в прицел и опускание, с; back — толчок назад, м;
## climb — подброс ствола, градусы; chest — откид груди, градусы.
const POSE := {
	"rifle": {"two": true, "raise": 0.24, "lower": 0.22, "back": 0.02, "climb": 2.5, "chest": 1.2},
	"heavy": {"two": true, "raise": 0.28, "lower": 0.24, "back": 0.03, "climb": 3.5, "chest": 2.0},
	"smg": {"two": true, "raise": 0.2, "lower": 0.2, "back": 0.01, "climb": 1.5, "chest": 0.6},
	"shotgun": {"two": true, "raise": 0.26, "lower": 0.22, "back": 0.045, "climb": 6.0, "chest": 3.0},
	"pistol": {"two": false, "raise": 0.2, "lower": 0.2, "back": 0.012, "climb": 4.0, "chest": 0.5},
	"sawnoff": {"two": false, "raise": 0.22, "lower": 0.2, "back": 0.04, "climb": 9.0, "chest": 2.5},
	"melee": {"two": false, "raise": 0.2, "lower": 0.2, "back": 0.0, "climb": 0.0, "chest": 0.0},
}
## Профиль по оружию; кого нет — по набору клипов (rifle / pistol), топор и кулаки — melee.
const POSE_OF := {"aks": "smg", "mp5": "smg", "glock17": "pistol", "deagle": "sawnoff", "spas12": "shotgun", "dbarrel": "shotgun", "svd": "heavy", "awm": "heavy", "rpk": "heavy", "fnfal": "heavy"}
## Переход походки (стойка / шаг / бег), с — ТЗ: 0.12–0.2.
const XFADE := 0.18
## Пороги скорости, м/с: шаг ↔ стойка, шаг ↔ бег (с запасом, чтобы не дёргалось на границе).
const IDLE_OFF := 0.45
const IDLE_ON := 0.3
const RUN_ON := 2.6
const RUN_OFF := 2.2
## Верх доворачивается относительно ног не больше чем на столько (дальше разворачиваются ноги), рад (85°).
const MAX_TWIST := 1.48
## Стоя ноги переступают за корпусом, когда разворот больше этого, рад (50°), со скоростью LEG_TURN, рад/с.
const TURN_START := 0.87
const LEG_TURN := 7.0
## Спиной вперёд — когда цель позади хода больше чем на столько (с запасом), рад (110° / 85°).
const BACK_ON := 1.92
const BACK_OFF := 1.48
## Корпус разворачивается к цели плавно, не быстрее TURN_RATE рад/с; выстрел — когда ствол смотрит на цель
## точнее AIM_TOLERANCE рад (6°: пуля летит из дула в цель — ствол должен смотреть на неё, а не вбок).
const TURN_RATE := 9.0
const AIM_TOLERANCE := 0.1

var game: Node
var model: Node3D
var anim: AnimationPlayer
var anim_tree: AnimationTree
var skeleton: Skeleton3D
var pose: HeroPose
var grip: Node3D
var mounts := {}
var models := {}
var kit := {"melee": "fireaxe", "gun": ""}
var wear := {}
var hold := "melee"
var hp := 100.0
var max_hp := 100.0
var alive := true
var cooldown := 0.0
var busy := 0.0
var aim_t := 0.0
var equipping := false
var pending := []
var move_input := Vector2.ZERO
var attack_held := false
## Полуавтомат (Data.SEMI): одно нажатие — один выстрел. Нажатие запоминается на 0,8 с (shot_queued), пока ствол
## поднимается и доворачивается к цели, — короткий тап тоже стреляет; после выстрела ждёт, пока кнопку отпустят.
var shot_queued := 0.0
var _trigger_was := false
var _semi_lock := false
## Магазин: патронов в магазине по стволу (нет записи — полный) и перезарядка (сколько осталось, какой ствол).
## Износ — по-прежнему за каждый выстрел; магазин даёт паузу перезарядки, как у настоящего оружия.
var mag_left := {}
var reload_t := 0.0
var reload_id := ""
## Если у ствола в данных нет магазина или времени перезарядки — по классу хвата.
const MAG_BY_CLASS := {"pistol": 15, "smg": 30, "compact": 30, "rifle": 30, "bullpup": 30, "shotgun": 8, "lmg": 75, "sniper": 5}
const RELOAD_BY_CLASS := {"pistol": 1.3, "smg": 2.0, "compact": 2.1, "rifle": 2.3, "bullpup": 2.4, "shotgun": 2.8, "lmg": 3.6, "sniper": 2.8}
const MAG_OVERRIDE := {"fnfal": 20, "aug": 30, "spas12": 8, "dbarrel": 2}

func mag_size(id: String) -> int:
	var w := Data.weapon(id)
	var cls := str(Gear.CLASS_OF.get(Data.real_id(id), "rifle"))
	return int(w.get("mag", MAG_OVERRIDE.get(Data.real_id(id), MAG_BY_CLASS.get(cls, 30))))

func reload_time(id: String) -> float:
	var cls := str(Gear.CLASS_OF.get(Data.real_id(id), "rifle"))
	return float(Data.weapon(id).get("reload", RELOAD_BY_CLASS.get(cls, 2.3)))

## Перезарядка: клип верха (под пистолет — свой), звук; по окончании магазин полный (в _physics_process).
func start_reload(id: String) -> void:
	if reload_t > 0.0 or not alive:
		return
	reload_id = id
	reload_t = reload_time(id)
	var pistol := str(Data.weapon(id).get("anim", "rifle")) == "pistol"
	var c := "Reload" if pistol else "ReloadRifle"
	if anim and anim.has_animation(c):
		_act(c, anim.get_animation(c).length / reload_t)
	var au = game.get_node_or_null("audio") if game else null
	if au and au.has_method("on_reload"):
		au.on_reload(global_position, pistol, int(Data.weapon(id).get("pellets", 1)) > 1)
	game.hud_refresh()
var clip := ""
var last_hurt := -99.0
var speed := 0.0
## Набор клипов в руках (axe / pistol / rifle) и что играет низ (idle / walk / run).
var kind := ""
var loco := "idle"
## Ноги: куда смотрят (мировой угол), идёт ли спиной вперёд, переступает ли на месте.
var legs_yaw := 0.0
var backpedal := false
var turning := false
## Верх: насколько поднят ствол (0 — низкая готовность, 1 — прицел), вес IK левой кисти, сила отдачи.
var aim_w := 0.0
var ik_w := 0.0
## Переноска длинного ствола поперёк корпуса вне прицела (hero_pose.gd, CARRY): вес 0…1.
var carry_w := 0.0
var kick := 0.0
## Состояние верха: lowered / raising / aiming / firing / lowering / windup / impact / follow / recover /
## equip_<стадия> / dead.
var upper := "lowered"
## Смена оружия: клип, время, моменты, стадия; equip_log — стадии последней смены (по ним проверяет автотест).
var equip := {}
var equip_log: Array = []
var hand_empty := false
var swing_t := -1.0
var _body_yaw := 0.0
var _loco_want := "idle"
var _loco_t := 0.0
var _nodes := {}
## Ход относительно корпуса (x — влево, z — вперёд), сглаженный — точка смешивания клипов по направлениям.
var move_dir_local := Vector2(0.0, 1.0)
## Наклон корпуса от разгона и торможения (вперёд-назад, вбок), рад; отставание ствола при повороте, рад; фаза шага.
var lean := Vector2.ZERO
var sway_yaw := 0.0
var _sway_v := 0.0
var _yaw_prev := 0.0
var _vel_prev := Vector3.ZERO
var gait_phase := 0.0
## Отдача — пружина (толчок и возврат с лёгким перехлёстом), очередь накапливает подброс ствола.
var _rec_v := 0.0
var burst := 0.0
## Модель героя из Tripo поверх старой (scripts/gear.gd, SkinFollow) или null.
var tripo_hero: Node3D

func setup(g: Node, k: Dictionary, w: Dictionary) -> void:
	game = g
	kit = k
	wear = w
	collision_layer = 2
	collision_mask = Level.WALL_LAYER
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.38
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	model = (load("res://assets/characters/player.glb") as PackedScene).instantiate()
	add_child(model)
	Level.rim(model)
	anim = model.find_child("AnimationPlayer", true, false)
	if anim:
		for c in anim.get_animation_list():
			# шаг и бег по направлениям (WalkRifle_FL…) — тоже по кругу
			if c in LOOPED or (str(c).begins_with("Walk") or str(c).begins_with("Run")):
				anim.get_animation(c).loop_mode = Animation.LOOP_LINEAR
	var sks := model.find_children("*", "Skeleton3D", true, false)
	skeleton = sks[0] as Skeleton3D if sks.size() > 0 else null
	# модель героя из Tripo (если есть) — повторяет позу этого скелета: клипы, дерево анимаций и IK те же
	tripo_hero = Gear.hero(self, model, skeleton)
	grip = attach_point(model, "GripR")
	var follow: SkinFollow = (tripo_hero.get_node_or_null("SkinFollow") as SkinFollow) if tripo_hero else null
	if follow and follow.grip_node:
		grip = follow.grip_node   # оружие — в кисти новой модели (руки у неё свои: см. skin_follow.gd)
	for m in MOUNTS:
		mounts[m] = attach_point(model, MOUNTS[m])
	# у модели Tripo — свои крепления за спиной (старые висят на теле прежней модели: топор торчал вбок с бедра)
	if follow:
		var axe_m := follow.add_mount("TripoAxeMount", "Spine2", SkinFollow.axe_on_back())
		var back_m := follow.add_mount("TripoBackMount", "Spine2", SkinFollow.gun_on_back())
		if axe_m:
			mounts["axe"] = axe_m
		if back_m:
			mounts["back"] = back_m
	_body_yaw = rotation.y
	legs_yaw = rotation.y
	_build_tree()
	if skeleton:
		pose = HeroPose.new()
		pose.name = "HeroPose"
		skeleton.add_child(pose)
		if follow:
			follow.pose = pose
	attach_gear()

## Точка крепления (хват, чехол, кобура): при импорте glTF узлы под костями становятся костями скелета —
## тогда к такой кости цепляется BoneAttachment3D.
static func attach_point(root: Node, point: String) -> Node3D:
	var found: Node = root.find_child(point, true, false)
	if found is Node3D and not found is Skeleton3D:
		return found
	for sk in root.find_children("*", "Skeleton3D", true, false):
		var skel: Skeleton3D = sk
		if skel.find_bone(point) >= 0:
			var ba := BoneAttachment3D.new()
			ba.name = point + "Attach"
			ba.bone_name = point
			skel.add_child(ba)
			return ba
	return null

func weapon_id() -> String:
	var id: String = kit.get(hold, "")
	return id if id != "" else "fists"

func W() -> Dictionary:
	return Data.weapon(weapon_id())

func clips() -> Dictionary:
	return CLIPS.get(W().get("anim", "axe"), CLIPS["axe"])

func wear_of(id: String) -> int:
	if not wear.has(id):
		wear[id] = int(Data.weapon(id).get("durability", 0))
	return int(wear[id])

## 3D-модель оружия (одна на id). Новые стволы пока — в модели похожего.
func gun_model(id: String) -> Node3D:
	if not models.has(id):
		var w := Data.weapon(id)
		var node: Node3D = Gear.weapon(str(w.get("model", id)))   # модель Tripo, если есть (scripts/gear.gd)
		node.name = "Gun_" + id
		models[id] = node
	return models[id]

func _put(node: Node3D, parent: Node) -> void:
	if node.get_parent():
		node.get_parent().remove_child(node)
	if parent == grip and grip != null:
		Gear.put_in_hand(node, grip)   # RightGrip модели — точно в ладонь (обратный transform точки хвата)
	elif parent:
		parent.add_child(node)
		node.transform = Transform3D.IDENTITY

## Мгновенно: в руке — оружие слота hold (если рука не пуста посреди смены), второе — в креплении на теле,
## остальное убрано.
func attach_gear() -> void:
	var gear := [kit.get("melee", ""), kit.get("gun", "")]
	for id in models.keys():
		if not gear.has(id):
			_put(models[id], null)
	for slot in ["melee", "gun"]:
		var id: String = kit.get(slot, "")
		if id == "" or id == "fists":
			continue
		var node := gun_model(id)
		if slot == hold and not hand_empty:
			_put(node, grip)
			node.visible = true
		else:
			var mount = mounts.get(Data.weapon(id).get("mount", ""))
			_put(node, mount if mount else grip)
			node.visible = mount != null
	_apply_kind()
	if game:
		game.hud_refresh()

# ---------- AnimationTree ----------

## Дерево: loco (стойка / шаг / бег, темп — TimeScale) → aim_mix (Blend2, верх — прицел) → shot (OneShot, верх —
## выстрел) → act_up (OneShot, верх — удар, урон, смена оружия) → act_low (OneShot, ноги — то же действие, только
## стоя) → life (жив / смерть). Клипы в узлах меняются под оружие в руках (_apply_kind).
func _build_tree() -> void:
	if anim == null:
		return
	var bt := AnimationNodeBlendTree.new()
	var x := 0.0
	# сразу с настоящими клипами (под топор; _apply_kind поменяет под оружие в руках)
	var first := {"idle": "Idle", "turn": "Idle", "aim": "AimRifle", "shoot": "ShootRifle", "act_u": "Hit", "act_l": "Hit", "death": "Death"}
	for n in first:
		var a := AnimationNodeAnimation.new()
		a.animation = first[n]
		_nodes[n] = a
		bt.add_node(n, a, Vector2(0, x))
		x += 140.0
	# шаг и бег: по клипу на каждое из 8 направлений относительно корпуса (точки — направления хода клипов); пока
	# у оружия нет набора по направлениям, во всех точках клип «вперёд» (ноги тогда разворачиваются к ходу)
	for g in ["walk", "run"]:
		var bs := AnimationNodeBlendSpace2D.new()
		bs.sync = true   # клипы набора одной длины и начаты вместе — шаги соседних направлений совпадают
		var table: Dictionary = GAIT8["WalkRifle" if g == "walk" else "RunRifle"]
		for d in DIRS8:
			var pa := AnimationNodeAnimation.new()
			pa.animation = "Walk" if g == "walk" else "Run"
			_nodes["%s_%s" % [g, d]] = pa
			var e: Array = table[d]
			bs.add_blend_point(pa, Vector2(float(e[1]), float(e[2])))
		bt.add_node(g, bs, Vector2(0, x))
		x += 140.0
	kind = "axe"
	for n in ["walk", "run", "turn", "act_u", "act_l"]:
		bt.add_node(n + "_ts", AnimationNodeTimeScale.new())
		bt.connect_node(n + "_ts", 0, n)
	var loco_n := AnimationNodeTransition.new()
	loco_n.xfade_time = XFADE
	loco_n.input_count = 4
	loco_n.set_input_name(0, "idle")
	loco_n.set_input_name(1, "walk")
	loco_n.set_input_name(2, "run")
	loco_n.set_input_name(3, "turn")
	bt.add_node("loco", loco_n)
	bt.connect_node("loco", 0, "idle")
	bt.connect_node("loco", 1, "walk_ts")
	bt.connect_node("loco", 2, "run_ts")
	bt.connect_node("loco", 3, "turn_ts")
	var f := _bone_filters()
	var aim_mix := AnimationNodeBlend2.new()
	_filter(aim_mix, f[0])
	bt.add_node("aim_mix", aim_mix)
	bt.connect_node("aim_mix", 0, "loco")
	bt.connect_node("aim_mix", 1, "aim")
	bt.add_node("shot", _one_shot(f[0], 0.02, 0.06))
	bt.connect_node("shot", 0, "aim_mix")
	bt.connect_node("shot", 1, "shoot")
	bt.add_node("act_up", _one_shot(f[0], 0.12, 0.18))
	bt.connect_node("act_up", 0, "shot")
	bt.connect_node("act_up", 1, "act_u_ts")
	bt.add_node("act_low", _one_shot(f[1], 0.12, 0.18))
	bt.connect_node("act_low", 0, "act_up")
	bt.connect_node("act_low", 1, "act_l_ts")
	var life := AnimationNodeTransition.new()
	life.xfade_time = 0.15
	life.input_count = 2
	life.set_input_name(0, "alive")
	life.set_input_name(1, "dead")
	bt.add_node("life", life)
	bt.connect_node("life", 0, "act_low")
	bt.connect_node("life", 1, "death")
	bt.connect_node("output", 0, "life")
	# клипы играет дерево; сам AnimationPlayer молчит, чтобы не спорить с ним за кости
	anim.stop()
	anim.active = false
	anim_tree = AnimationTree.new()
	anim_tree.name = "AnimTree"
	add_child(anim_tree)
	anim_tree.anim_player = anim_tree.get_path_to(anim)
	anim_tree.tree_root = bt
	anim_tree.active = true
	anim_tree.set("parameters/life/transition_request", "alive")
	anim_tree.set("parameters/loco/transition_request", "idle")

func _one_shot(paths: Array, fade_in: float, fade_out: float) -> AnimationNodeOneShot:
	var o := AnimationNodeOneShot.new()
	o.fadein_time = fade_in
	o.fadeout_time = fade_out
	_filter(o, paths)
	return o

func _filter(node: AnimationNode, paths: Array) -> void:
	if paths.is_empty():
		return
	node.filter_enabled = true
	for p in paths:
		node.set_filter_path(p, true)

## Дорожки клипов: [верх — позвоночник и всё, что выше (руки, голова, точки хвата), низ — таз и ноги].
func _bone_filters() -> Array:
	var upper_bones := {}
	if skeleton:
		var spine := HeroPose.find_bone(skeleton, "Spine")
		for i in skeleton.get_bone_count():
			var p := i
			while p >= 0:
				if p == spine:
					upper_bones[str(skeleton.get_bone_name(i))] = true
					break
				p = skeleton.get_bone_parent(p)
	var up := []
	var low := []
	var seen := {}
	for an in anim.get_animation_list():
		var a := anim.get_animation(an)
		for t in a.get_track_count():
			var path := a.track_get_path(t)
			var key := str(path)
			if seen.has(key):
				continue
			seen[key] = true
			if upper_bones.has(str(path.get_concatenated_subnames())):
				up.append(path)
			else:
				low.append(path)
	if up.is_empty():
		push_warning("Герой: не нашёл кость Spine — верх и низ не разделены")
	return [up, low]

## Клипы в узлах дерева — под оружие в руках; точка левой кисти — под модель ствола.
func _apply_kind() -> void:
	if pose:
		pose.marker = _grip_marker()
		pose.weapon_id = "" if hand_empty else weapon_id()
	var k: String = W().get("anim", "axe")
	if k == kind or _nodes.is_empty():
		kind = k
		return
	kind = k
	var c := clips()
	(_nodes["idle"] as AnimationNodeAnimation).animation = c["idle"]
	var dirn := directional()
	for g in ["walk", "run"]:
		var base: String = c[g]
		for d in DIRS8:
			var nm: String = base if d == "F" or not dirn else "%s_%s" % [base, d]
			if not anim.has_animation(nm):
				nm = base
			(_nodes["%s_%s" % [g, d]] as AnimationNodeAnimation).animation = nm
	var tn := "Turn" + ("Rifle" if k == "rifle" else "Pistol")
	(_nodes["turn"] as AnimationNodeAnimation).animation = tn if dirn and anim.has_animation(tn) else c["idle"]
	(_nodes["aim"] as AnimationNodeAnimation).animation = c.get("aim", "AimRifle")
	(_nodes["shoot"] as AnimationNodeAnimation).animation = c.get("shoot", "ShootRifle")

## Как цевьё лежит в левой ладони (оси узла GripL кисти в осях оружия): наискось, большой палец вперёд-влево
## вдоль ствола — FOREGRIP из src/hero-animations.js (с ним запечены клипы с автоматом).
static func fore_basis() -> Basis:
	var z := Vector3(0.6, -0.6, 0.3).normalized()
	var blade := Vector3(-0.6, -0.6, 0.2)
	var y := -(blade - z * blade.dot(z)).normalized()
	return Basis(y.cross(z), y, z)

## Где левая кисть берётся за оружие в руке (в осях узла хвата правой кисти): точка LeftSupportGrip модели ствола
## относительно его RightGrip (Gear.point_local); у старых моделей — GripL; иначе — цевьё «как у АК».
func _grip_marker() -> Transform3D:
	var fallback := Transform3D(fore_basis(), Vector3(0.03, -0.29, 0.02))
	var node: Node3D = models.get(weapon_id())
	if node == null or hand_empty or Gear.point(node, "LeftSupportGrip") == null:
		return fallback
	return Gear.point_local(node, "RightGrip").affine_inverse() * Gear.point_local(node, "LeftSupportGrip")

func _profile() -> Dictionary:
	var cat: String = POSE_OF.get(Data.real_id(weapon_id()), "")
	if cat == "":
		var a: String = W().get("anim", "axe")
		cat = a if POSE.has(a) else "melee"
	return POSE[cat]

## Действие поверх походки (удар, урон, смена оружия): верх — всегда, ноги — только стоя (на ходу они шагают).
func _act(c: String, tempo := 1.0) -> void:
	if anim_tree == null or not anim.has_animation(c):
		return
	clip = c
	for n in ["act_u", "act_l"]:
		(_nodes[n] as AnimationNodeAnimation).animation = c
		anim_tree.set("parameters/%s_ts/scale" % n, tempo)
	anim_tree.set("parameters/act_up/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	if loco == "idle":
		anim_tree.set("parameters/act_low/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	elif bool(anim_tree.get("parameters/act_low/active")):
		anim_tree.set("parameters/act_low/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)

## Сыграть клип (для совместимости): «Death» — смерть; стойка, шаг, бег и прицел идут сами от состояния героя;
## остальное (удар, урон, смена оружия, перезарядка) — действием поверх походки.
func play(c: String, _blend := 0.15, restart := false) -> void:
	if anim == null or not anim.has_animation(c):
		return
	if c == clip and not restart:
		return
	if c == "Death":
		clip = c
		if anim_tree:
			anim_tree.set("parameters/life/transition_request", "dead")
		return
	if c in LOOPED:
		clip = c
		return
	_act(c)

func muzzle_pos() -> Vector3:
	var node: Node3D = models.get(weapon_id())
	var m: Node3D = Gear.point(node, "MuzzlePoint")
	return m.global_position if m else global_position + Vector3(0, 1.3, 0) - global_transform.basis.z * -0.6

# ---------- Каждый кадр ----------

func _physics_process(delta: float) -> void:
	if not alive:
		return
	if reload_t > 0.0:
		reload_t -= delta
		if reload_t <= 0.0:
			mag_left[reload_id] = mag_size(reload_id)
			game.hud_refresh()
	cooldown -= delta
	busy -= delta
	aim_t -= delta
	for p in pending.duplicate():
		p["t"] -= delta
		if p["t"] <= 0.0:
			pending.erase(p)
			p["fn"].call()
	_sync_body()
	var mi := move_input
	if mi.length() > 1.0:
		mi = mi.normalized()
	var mag := mi.length()
	var dir := Vector3(mi.x, 0, mi.y)
	var w := W()
	var gun: bool = w.get("slot", "") == "gun"
	speed = 0.0
	if mag > 0.12:
		speed = 3.6 + 1.4 * (mag - 0.55) / 0.45 if mag > 0.55 else 1.1 + 0.6 * minf(1.0, (mag - 0.12) / 0.43)
		if busy > 0.0 and not gun:
			speed *= 0.5
		if gun and aim_t > 0.0:
			speed *= 0.75
	var want_v := dir.normalized() * speed if mag > 0.12 else Vector3.ZERO
	# в прицеле (корпус к цели) боком и спиной вперёд — медленнее, как в клипах по направлениям
	if want_v.length() > 0.01 and directional() and (attack_held or aim_t > 0.0):
		var lw := want_v.rotated(Vector3.UP, -rotation.y)
		want_v *= dir_factor(Vector2(lw.x, lw.z))
	# разгон и торможение: скорость догоняет желаемую (поворот на бегу — дугой, без рывка)
	var hv := Vector3(velocity.x, 0.0, velocity.z)
	hv = hv.move_toward(want_v, (ACCEL if want_v.length() > hv.length() + 0.01 else DECEL) * delta)
	velocity = hv
	move_and_slide()
	# за край кластера не уйти (стен по краю нет; в браузерной игре позицию тоже держали в ±PLAY)
	if game and game.level:
		var lim: float = game.level.play
		global_position.x = clampf(global_position.x, -lim, lim)
		global_position.z = clampf(global_position.z, -lim, lim)
	# куда смотрит корпус: на цель, пока стреляет или целится; иначе — по ходу. Ноги — в _update_legs.
	var target = game.nearest_enemy(global_position, float(w.get("range", 2.0)) + 1.5, true) if (attack_held or aim_t > 0.0) else null
	var want := rotation.y
	if target:
		var to: Vector3 = target.global_position - global_position
		want = atan2(to.x, to.z)
	elif mag > 0.12:
		want = atan2(dir.x, dir.z)
	var turn := wrapf(want - rotation.y, -PI, PI) * minf(1.0, delta * 12.0)
	rotation.y = wrapf(rotation.y + clampf(turn, -TURN_RATE * delta, TURN_RATE * delta), -PI, PI)
	_body_yaw = rotation.y
	if attack_held and not _trigger_was:
		shot_queued = 0.8
		_semi_lock = false
	_trigger_was = attack_held
	shot_queued -= delta
	var semi: bool = gun and bool(w.get("semi", false))
	var pull: bool = (attack_held and not (semi and _semi_lock)) or (semi and shot_queued > 0.0)
	if pull and cooldown <= 0.0 and busy <= 0.05 and not equipping:
		attack()

func _process(delta: float) -> void:
	if anim_tree == null:
		return
	if alive:
		_update_legs(delta)
		_update_equip(delta)
	_update_upper(delta)
	_update_pose(delta)

## Героя повернули извне (вход в локацию) — ноги поворачиваются вместе с ним, а не переступают.
func _sync_body() -> void:
	legs_yaw += wrapf(rotation.y - _body_yaw, -PI, PI)
	_body_yaw = rotation.y

## Набор клипов по направлениям у оружия в руках (корпус к цели, ноги — по ходу).
func directional() -> bool:
	return DIRECTIONAL.has(str(W().get("anim", "axe"))) and not hand_empty

## Направление набора по точке на круге (x — влево, z — вперёд) → индекс в DIRS8 и доля к следующему (против часовой).
static func _dir_index(d: Vector2) -> Array:
	var ang := fposmod(atan2(d.x, d.y), TAU)   # 0 — вперёд, PI/2 — влево
	var f := ang / (PI / 4.0)
	var i := int(floor(f)) % 8
	return [i, f - floor(f)]

## Доля скорости «вперёд» для хода в направлении d относительно корпуса (между соседними направлениями — линейно).
static func dir_factor(d: Vector2) -> float:
	if d.length() < 0.01:
		return 1.0
	var r := _dir_index(d.normalized())
	var i: int = r[0]
	var t: float = r[1]
	return lerpf(float(DIR_SPEED[DIRS8[i]]), float(DIR_SPEED[DIRS8[(i + 1) % 8]]), t)

## Скорость клипа при темпе 1 (м/с) для хода в направлении d: у набора по направлениям — между соседними клипами.
func natural_speed(g: String, d: Vector2) -> float:
	var base: String = clips().get(g, "")
	if not directional() or not GAIT8.has(base):
		return float(GAIT.get(base, 1.5))
	var r := _dir_index(d.normalized())
	var i: int = r[0]
	var t: float = r[1]
	var table: Dictionary = GAIT8[base]
	return lerpf(float(table[DIRS8[i]][0]), float(table[DIRS8[(i + 1) % 8]][0]), t)

## Низ: стойка / шаг / бег по настоящей скорости (с запасом на границах), куда идут ноги и темп шага.
##   • автомат (набор по направлениям): таз и корпус смотрят на цель, ноги идут по ходу — точка смешивания клипов
##     8 направлений = ход в осях корпуса; позвоночник не скручивается. Стоя корпус доворачивается к цели, а когда
##     разворот больше TURN_START — ноги переступают (клип разворота) за корпусом;
##   • остальное оружие (пока без набора): ноги разворачиваются к ходу, верх доворачивается к цели (спиной вперёд —
##     клип шага назад).
func _update_legs(delta: float) -> void:
	_sync_body()
	var v := get_real_velocity()
	v.y = 0.0
	var spd := v.length()
	var dirn := directional()
	var body := rotation.y
	var off2 := wrapf(body - legs_yaw, -PI, PI)
	var next := loco
	if loco == "idle" or loco == "turn":
		if spd > IDLE_OFF:
			next = "run" if spd > RUN_ON else "walk"
		elif dirn and (loco == "turn" or absf(off2) > TURN_START):
			next = "turn" if absf(off2) > 0.06 else "idle"
		else:
			next = "idle"
	elif spd < IDLE_ON:
		next = "idle"
	elif loco == "walk" and spd > RUN_ON:
		next = "run"
	elif loco == "run" and spd < RUN_OFF:
		next = "walk"
	# смена походки — только если держится дольше пары кадров (толчок от удара не дёргает ноги)
	if next == loco:
		_loco_t = 0.0
	else:
		_loco_t = _loco_t + delta if next == _loco_want else 0.0
		_loco_want = next
		if _loco_t >= 0.05 or next == "turn":
			loco = next
			_loco_t = 0.0
			anim_tree.set("parameters/loco/transition_request", loco)
	if (loco == "walk" or loco == "run") and spd > 0.05:
		if dirn:
			# ход в осях корпуса (x — влево, z — вперёд), сглаженный по углу: точка смешивания клипов направлений
			var lv := v.rotated(Vector3.UP, -body)
			var a0 := atan2(move_dir_local.x, move_dir_local.y)
			var a1 := atan2(lv.x, lv.z)
			var a := lerp_angle(a0, a1, minf(1.0, delta * 10.0))
			move_dir_local = Vector2(sin(a), cos(a))
			anim_tree.set("parameters/walk/blend_position", move_dir_local)
			anim_tree.set("parameters/run/blend_position", move_dir_local)
			legs_yaw = lerp_angle(legs_yaw, body, minf(1.0, delta * 10.0))
			backpedal = false
		else:
			# ноги — по ходу; если цель позади хода — спиной вперёд (клип шага назад)
			var mv := atan2(v.x, v.z)
			var off := absf(wrapf(mv - body, -PI, PI))
			backpedal = off > BACK_OFF if backpedal else off > BACK_ON
			legs_yaw = lerp_angle(legs_yaw, mv + PI if backpedal else mv, minf(1.0, delta * 12.0))
		turning = false
	elif loco == "turn":
		# разворот на месте: ноги переступают за корпусом
		backpedal = false
		var step := TURN_STEP_RATE * delta
		legs_yaw += clampf(off2, -step, step)
		turning = true
	elif loco == "idle":
		# стоя ноги не крутятся за каждым движением корпуса — переступают, когда разворот большой
		backpedal = false
		move_dir_local = Vector2(0.0, 1.0)
		if not dirn:
			if absf(off2) > TURN_START:
				turning = true
			if turning:
				var step2 := LEG_TURN * delta
				legs_yaw += clampf(off2, -step2, step2)
				if absf(off2) <= step2 + 0.02:
					turning = false
		else:
			turning = false
	var rel := wrapf(legs_yaw - body, -PI, PI)
	if absf(rel) > MAX_TWIST:
		rel = signf(rel) * MAX_TWIST
		legs_yaw = body + rel
	model.rotation.y = rel
	# темп шага — по настоящей скорости и направлению: ступни не скользят; спиной вперёд (без набора) — клип назад
	if loco == "walk" or loco == "run":
		var natural := natural_speed(loco, move_dir_local) if dirn else float(GAIT.get(clips().get(loco, ""), 1.5))
		var ts := clampf(spd / natural, 0.55, 1.8) * (-1.0 if backpedal else 1.0)
		anim_tree.set("parameters/%s_ts/scale" % loco, ts)
		var clen := 1.333 if loco == "walk" else 0.933
		gait_phase = fposmod(gait_phase + delta * absf(ts) / clen, 1.0)
	elif loco == "turn":
		anim_tree.set("parameters/turn_ts/scale", 1.0)
		gait_phase = fposmod(gait_phase + delta / 0.8, 1.0)

## Смена оружия по стадиям — по часам клипа смены (тот же кадр, что у AnimationTree).
func _update_equip(delta: float) -> void:
	if not equipping:
		return
	equip["t"] = float(equip["t"]) + delta
	var t: float = equip["t"]
	if equip["stage"] == "lower" and t >= float(equip["stow"]):
		# рука донесла оружие до крепления: оно на теле, рука пустая
		_stage("stow")
		hand_empty = true
		attach_gear()
	if equip["stage"] == "stow" and t >= float(equip["draw"]):
		# рука взяла другое оружие из крепления
		_stage("take")
		hold = equip["to"]
		hand_empty = false
		attach_gear()
		_stage("raise")
	if equip["stage"] == "raise" and t >= float(equip["len"]) - 0.1:
		_stage("ready")
		equipping = false
		clip = ""

func _stage(s: String) -> void:
	equip["stage"] = s
	equip_log.append(s)

## Верх: подъём ствола в прицел и опускание, вес IK левой кисти, затухание отдачи, состояние верха.
func _update_upper(delta: float) -> void:
	var prof := _profile()
	var gun: bool = W().get("slot", "") == "gun" and not hand_empty
	var want_aim := 1.0 if alive and gun and not equipping and (aim_t > 0.0 or attack_held) else 0.0
	var rate: float = prof["raise"] if want_aim > aim_w else prof["lower"]
	aim_w = move_toward(aim_w, want_aim, delta / rate)
	anim_tree.set("parameters/aim_mix/blend_amount", smoothstep(0.0, 1.0, aim_w))
	# левая кисть на цевье — только у двуручного ствола в руке: при уборке отпускает (быстро, пока клип уводит
	# оружие), при подъёме берёт — за остаток клипа смены или за время подъёма ствола
	var want_ik := 0.0
	if alive and gun and bool(Gear.grip_class(weapon_id())["two"]) and (not equipping or equip.get("stage", "") == "raise"):
		want_ik = 1.0
	var ik_rate := 0.14
	if want_ik > ik_w:
		ik_rate = maxf(0.12, float(equip["len"]) - float(equip["t"])) if equipping else float(prof["raise"])
	# перезарядка (клип ReloadRifle): левая кисть уходит с цевья к магазину в первые ~10 % клипа и возвращается на
	# цевьё к ~85–90 % — вес IK идёт по клипу, а не выключается на всю перезарядку
	if reload_t > 0.0 and want_ik > 0.0:
		var pr := 1.0 - reload_t / maxf(0.05, reload_time(reload_id))
		want_ik = 1.0 - smoothstep(0.02, 0.11, pr) + smoothstep(0.8, 0.9, pr)
		ik_rate = 0.06
	ik_w = move_toward(ik_w, want_ik, delta / ik_rate)
	# переноска двуручного ствола поперёк корпуса — когда он в руке и верх свободен (не смена оружия, не удар/урон)
	var want_carry := 0.0
	if alive and gun and bool(Gear.carry_grip(weapon_id())[1]) and not equipping and not bool(anim_tree.get("parameters/act_up/active")):
		want_carry = 1.0
	carry_w = move_toward(carry_w, want_carry, delta / 0.2)
	# отдача — пружина: толчок, возврат за ~0,15 с с лёгким перехлёстом вперёд (как у ствола в руках), шагами по 1/120 с;
	# очередь накапливает подброс (burst), между очередями он уходит за ~0,3 с
	var left_t := delta
	while left_t > 0.0:
		var h := minf(left_t, 1.0 / 120.0)
		_rec_v += (-900.0 * kick - 33.0 * _rec_v) * h
		kick += _rec_v * h
		left_t -= h
	burst = move_toward(burst, 0.0, delta * 3.5)
	# пошёл посреди удара или смены оружия — ноги переходят на шаг, верх доигрывает
	if alive and loco != "idle" and bool(anim_tree.get("parameters/act_low/active")):
		anim_tree.set("parameters/act_low/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FADE_OUT)
	if swing_t >= 0.0:
		swing_t += delta * float(W().get("speed", 1.0))
		if swing_t > 0.75:
			swing_t = -1.0
	upper = _upper_state(want_aim)

func _upper_state(want_aim: float) -> String:
	if not alive:
		return "dead"
	if equipping:
		return "equip_" + str(equip.get("stage", ""))
	if swing_t >= 0.0:
		# удар топором (клип Melee): замах → удар → проводка → возврат
		if swing_t < 0.2:
			return "windup"
		if swing_t < 0.36:
			return "impact"
		if swing_t < 0.55:
			return "follow"
		return "recover"
	if bool(anim_tree.get("parameters/shot/active")):
		return "firing"
	if aim_w >= 0.999:
		return "aiming"
	if aim_w <= 0.001:
		return "lowered"
	return "raising" if want_aim > aim_w else "lowering"

## Числа для модификатора позы (он отрабатывает после AnimationTree, в этом же кадре).
func _update_pose(delta: float) -> void:
	if pose == null:
		return
	var prof := _profile()
	var tw := clampf(-model.rotation.y, -MAX_TWIST, MAX_TWIST) if alive else 0.0
	pose.twist = tw if alive else move_toward(pose.twist, 0.0, delta * 4.0)
	pose.kick = kick if alive else 0.0
	pose.kick_back = float(prof["back"])
	pose.kick_climb = deg_to_rad(float(prof["climb"]))
	pose.kick_chest = deg_to_rad(float(prof["chest"]))
	pose.ik_weight = ik_w
	pose.carry = carry_w * (1.0 - smoothstep(0.0, 1.0, aim_w))
	pose.feet_lock = alive
	# очередь у автоматов накапливает подброс ствола (до +60 %)
	pose.kick_climb *= 1.0 + 0.12 * burst
	if not alive or delta <= 0.0:
		return
	# наклон корпуса от разгона и торможения (в осях корпуса): разгон вперёд — наклон вперёд, торможение — назад;
	# вбок — к центру поворота; плавно (без дрожи от шагов скорости)
	var v := get_real_velocity()
	v.y = 0.0
	var acc := ((v - _vel_prev) / delta).rotated(Vector3.UP, -rotation.y)
	_vel_prev = v
	var want_lean := Vector2(clampf(acc.z * 0.01, -0.12, 0.12), clampf(-acc.x * 0.008, -0.08, 0.08))
	lean = lean.lerp(want_lean, minf(1.0, delta * 6.0))
	pose.lean = lean
	# инерция оружия: при повороте корпуса ствол отстаёт и догоняет пружиной (у тяжёлых — больше и медленнее)
	var cat: String = POSE_OF.get(Data.real_id(weapon_id()), "")
	if cat == "":
		cat = str(W().get("anim", "melee"))
	var sw: Array = SWAY.get(cat, SWAY["rifle"])
	var omega := wrapf(rotation.y - _yaw_prev, -PI, PI) / delta
	_yaw_prev = rotation.y
	var target := clampf(-omega * float(sw[0]), -0.18, 0.18)
	var wn := float(sw[1])
	_sway_v += ((target - sway_yaw) * wn * wn - 2.0 * 0.8 * wn * _sway_v) * delta
	sway_yaw += _sway_v * delta
	pose.sway_yaw = sway_yaw if W().get("slot", "") == "gun" else 0.0
	# покачивание ствола от шага: вниз на каждой постановке стопы, вбок — за тазом; амплитуда — от скорости
	var spd := v.length()
	var amp := clampf(spd / 4.0, 0.0, 1.0) * (0.012 if cat == "heavy" or cat == "shotgun" else 0.009)
	var ph := gait_phase * TAU
	pose.bob = Vector3(sin(ph) * amp * 0.6, -absf(sin(ph)) * amp, 0.0) * (1.0 - 0.6 * aim_w)

# ---------- Бой ----------

## Удар или выстрел: цель — ближайший заражённый в пределах дальности и в прямой видимости. Ствол сначала
## поднимается в прицел и корпус доворачивается к цели — выстрел, когда ствол смотрит на неё.
func attack() -> void:
	var w := W()
	var id := weapon_id()
	var target = game.nearest_enemy(global_position, float(w.get("range", 2.0)), true)
	if w.get("slot", "") == "melee":
		cooldown = float(w.get("cooldown", 0.8))
		busy = 0.55
		swing_t = 0.0
		# темп клипа — скорость оружия: момент удара в клипе совпадает с hitTime
		_act(clips()["attack"], float(w.get("speed", 1.0)))
		pending.append({"t": float(w.get("hitTime", 0.3)), "fn": _melee_hit})
		return
	# поднять → прицелиться → выстрел (без рывка ствола из низкой готовности в прицел)
	aim_t = maxf(aim_t, 0.4)
	if aim_w < 0.85:
		return
	if target:
		var to: Vector3 = target.global_position - global_position
		if absf(wrapf(atan2(to.x, to.z) - rotation.y, -PI, PI)) > AIM_TOLERANCE:
			return
		# и сам ствол в руке смотрит на цель (руки с оружием догоняют корпус, когда цель бежит вбок): пуля и
		# трассер летят из дула в цель — без этого они уходили на 17–22° от ствола
		if not _barrel_on(target.global_position) and _barrel_wait < 0.5:
			_barrel_wait += get_physics_process_delta_time()
			return
	_barrel_wait = 0.0
	# магазин: пустой — перезарядка (клип, звук), стрелять нельзя
	if reload_t > 0.0:
		return
	var left := int(mag_left.get(id, mag_size(id)))
	if left <= 0:
		start_reload(id)
		return
	mag_left[id] = left - 1
	cooldown = float(w.get("auto", w.get("cooldown", 0.2)))
	if bool(w.get("semi", false)):
		_semi_lock = true
		shot_queued = 0.0
	aim_t = 1.4
	busy = 0.1
	# выстрел: клип (OneShot верха), толчок отдачи и вспышка с пулей — в один кадр
	anim_tree.set("parameters/shot/request", AnimationNodeOneShot.ONE_SHOT_REQUEST_FIRE)
	# отдача по мощности ствола: Glock и MP5 — едва дёргает, АК — ощутимо, СВД, Desert Eagle, дробовики — сильно
	var power := float(w.get("damage", 20)) * float(w.get("pellets", 1))
	# толчок пружины: пик отклонения ≈ скорость × 0,0173 (частота 30 рад/с, затухание 0,55) — пик 0,5…1,6
	_rec_v += 57.7 * clampf(0.45 + power / 70.0, 0.5, 1.6)
	if float(w.get("auto", w.get("cooldown", 1.0))) < 0.2:
		burst = minf(burst + 1.0, 5.0)
	game.fire_shot(self, w, target, muzzle_pos())
	wear[id] = wear_of(id) - 1
	if wear[id] <= 0:
		break_weapon(id)
	elif int(mag_left[id]) <= 0:
		start_reload(id)
	game.hud_refresh()

## Ствол в руке смотрит на точку at: луч из дула проходит через цель — мимо её центра не дальше BARREL_MISS (тело
## заражённого) или в пределах BARREL_TOLERANCE по углу (дальняя цель). Мерить только угол нельзя: вплотную дуло
## длинного ствола уже сбоку от цели, и угол до её центра велик, хотя пуля попадает. Если за полсекунды так и не
## довернулся (_barrel_wait), выстрел всё равно разрешается — ствол не «замирает».
const BARREL_TOLERANCE := 0.14
const BARREL_MISS := 0.25
var _barrel_wait := 0.0

func _barrel_on(at: Vector3) -> bool:
	var node: Node3D = models.get(weapon_id())
	if node == null or not node.is_inside_tree():
		return true
	return barrel_miss(-node.global_transform.basis.y, muzzle_pos(), at) <= 0.0

## Насколько луч ствола b из дула m проходит мимо точки at (по горизонтали), сверх допуска; ≤ 0 — смотрит на неё.
static func barrel_miss(b: Vector3, m: Vector3, at: Vector3) -> float:
	var to := at - m
	b.y = 0.0
	to.y = 0.0
	if b.length() < 0.05 or to.length() < 0.3:
		return 0.0
	b = b.normalized()
	var along := to.dot(b)
	if along <= 0.0:
		return to.length() - BARREL_MISS   # цель уже за срезом дула (вплотную)
	var side := (to - b * along).length()
	return side - maxf(BARREL_MISS, along * tan(BARREL_TOLERANCE))

func _melee_hit() -> void:
	if not alive:
		return
	var w := W()
	var id := weapon_id()
	var fwd := Vector3(sin(rotation.y), 0, cos(rotation.y))
	var best = null
	var bd := 1e9
	for e in game.foes():
		var to: Vector3 = e.global_position - global_position
		to.y = 0
		var d := to.length()
		if d > float(w.get("range", 2.0)) + float(e.T["radius"]):
			continue
		if d > 0.3 and fwd.dot(to / d) < cos(float(w.get("arc", 1.0))):
			continue
		if d < bd:
			bd = d
			best = e
	game.noise(global_position, float(w.get("noise", 6)))
	if best == null:
		return
	best.damage(float(w.get("damage", 12)), global_position)
	if w.has("durability"):
		wear[id] = wear_of(id) - 1
		if wear[id] <= 0:
			break_weapon(id)
	game.hud_refresh()

## Износ кончился: оружие ломается и пропадает (топор → кулаки, ствол → в руках топор).
func break_weapon(id: String) -> void:
	game.toast("%s сломался" % Data.weapon(id).get("name", id))
	wear.erase(id)
	if kit.get("melee", "") == id:
		kit["melee"] = "fists"
	if kit.get("gun", "") == id:
		kit["gun"] = ""
		hold = "melee"
	if models.has(id):
		_put(models[id], null)
		models[id].queue_free()
		models.erase(id)
	attach_gear()

## Смена оружия анимацией по стадиям: опустить → убрать на тело → взять другое → поднять (_update_equip).
func switch_weapon() -> void:
	if not alive or equipping or busy > 0.0:
		return
	reload_t = 0.0   # смена оружия прерывает перезарядку (магазин остаётся, как был)
	var gun_id: String = kit.get("gun", "")
	if gun_id == "":
		game.toast("Огнестрела нет — купи в стабе или найди")
		return
	var to := "gun" if hold == "melee" else "melee"
	var gun_kind: String = Data.weapon(gun_id).get("anim", "rifle")
	var eq: Dictionary = EQUIP.get(gun_kind, EQUIP["rifle"])
	var c: String = eq["draw"] if to == "gun" else eq["stow"]
	var times: Array = EQUIP_TIMES.get(c, [0.36, 0.74])
	var length: float = anim.get_animation(c).length if anim and anim.has_animation(c) else 1.0
	equipping = true
	aim_t = 0.0
	equip = {"clip": c, "to": to, "t": 0.0, "len": length, "stow": float(times[0]), "draw": float(times[1]), "stage": ""}
	equip_log = []
	_stage("lower")
	_act(c)

func hurt(dmg: float, from: Vector3) -> void:
	if not alive:
		return
	hp -= dmg
	last_hurt = game.time
	game.on_player_hurt(dmg)
	var push := global_position - from
	push.y = 0
	if push.length() > 0.01:
		velocity = push.normalized() * 2.0
		move_and_slide()
	if hp <= 0.0:
		die()
	elif busy <= 0.0 and not equipping:
		_act(clips()["hit"])
		busy = 0.3

func die() -> void:
	if not alive:
		return
	hp = 0.0
	alive = false
	equipping = false
	clip = "Death"
	if anim_tree:
		anim_tree.set("parameters/life/transition_request", "dead")
	died.emit()

## Здоровье понемногу возвращается, если давно не били.
func regen(delta: float) -> void:
	if alive and game.time - last_hurt > 6.0 and hp < max_hp:
		hp = minf(max_hp, hp + delta * 3.0)
