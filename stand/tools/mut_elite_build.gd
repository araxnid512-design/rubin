extends SceneTree
## Сборка финального босса «Мутировавшая Элита» (задание пользователя 26.11): модель Tripo по картинке пользователя
## (assets/models/mut_elite/mut_elite_src.glb) → разворот мордой в +Z, тело в «рамке Элиты» (5 м в длину; в игре
## модель увеличивается в 1,4 раза — 7 м в длину и 4 м в высоту) → тот же скелет четвероногого, что у Элиты (те же
## имена костей: таз, позвоночник, шея, голова, челюсти, лопатки, лапы, пять сегментов хвоста), суставы — по этой
## модели → веса вершин → движения (core/world/mut_elite_anim.gd) → assets/models/mut_elite.scn.
## Отдельно стоящий кусок сетки (обломок сбоку от тела, артефакт генерации) убирается.
##
##   godot --headless --path . -s tools/mut_elite_build.gd                 — собрать и записать
##   godot --path . -s tools/mut_elite_build.gd -- --view=<папка>          — снимки: кости, веса (нужен xvfb)
##   ... -- --view=<папка> --pose=mut_slam:0.4,mut_roar:0.5                — снимки кадров движений

const SRC := "res://assets/models/mut_elite/mut_elite_src.glb"
const OUT_SCN := "res://assets/models/mut_elite.scn"
const OUT_MESH := "res://assets/models/mut_elite/mut_elite_mesh.res"
const OUT_LIB := "res://assets/models/mut_elite/mut_elite_anims.res"
## исходные оси модели: z — вдоль (морда в −z), y — вверх, x — поперёк. В игре: морда в +Z.
## Длина 0,98 → 5,0 м; высота 0,452 → 2,86 м (в игре ×1,4 = 4,0 м); ширина 0,69 → 3,04 м (лапы широко расставлены).
const SCALE := Vector3(4.4, 6.32, 5.1)
const YK := 1.0


static func J(p: Vector3) -> Vector3:
	return p

## Кости: имя, родитель, сустав в покое (м, в рамке сборки; x > 0 — левый бок зверя, смотрящего в +Z)
const BONES := [
	["Root", "", Vector3(0, 0, 0)],
	["Pelvis", "Root", Vector3(0, 1.67, -1.05)],
	["Spine1", "Pelvis", Vector3(0, 1.75, -0.45)],
	["Spine2", "Spine1", Vector3(0, 1.80, 0.15)],
	["Chest", "Spine2", Vector3(0, 1.85, 0.75)],
	["Neck1", "Chest", Vector3(0, 1.95, 1.25)],
	["Neck2", "Neck1", Vector3(0, 1.85, 1.55)],
	["Head", "Neck2", Vector3(0, 1.72, 1.8)],
	["JawUp", "Head", Vector3(0, 1.62, 2.05)],
	["Jaw", "Head", Vector3(0, 1.42, 1.75)],
	["L_Scapula", "Chest", Vector3(0.45, 1.95, 0.95)],
	["L_UpperArm", "L_Scapula", Vector3(0.75, 1.75, 1.05)],
	["L_Forearm", "L_UpperArm", Vector3(0.95, 1.09, 1.15)],
	["L_Hand", "L_Forearm", Vector3(1.0, 0.41, 1.6)],
	["L_Claws", "L_Hand", Vector3(1.02, 0.14, 2.0)],
	["R_Scapula", "Chest", Vector3(-0.45, 1.95, 0.95)],
	["R_UpperArm", "R_Scapula", Vector3(-0.75, 1.75, 1.05)],
	["R_Forearm", "R_UpperArm", Vector3(-0.95, 1.09, 1.15)],
	["R_Hand", "R_Forearm", Vector3(-1.0, 0.41, 1.6)],
	["R_Claws", "R_Hand", Vector3(-1.02, 0.14, 2.0)],
	["L_Thigh", "Pelvis", Vector3(0.5, 1.5, -1.0)],
	["L_Shin", "L_Thigh", Vector3(0.68, 1.03, -0.5)],
	["L_Foot", "L_Shin", Vector3(0.7, 0.41, -1.2)],
	["L_Toes", "L_Foot", Vector3(0.72, 0.12, -0.95)],
	["R_Thigh", "Pelvis", Vector3(-0.5, 1.5, -1.0)],
	["R_Shin", "R_Thigh", Vector3(-0.68, 1.03, -0.5)],
	["R_Foot", "R_Shin", Vector3(-0.7, 0.41, -1.2)],
	["R_Toes", "R_Foot", Vector3(-0.72, 0.12, -0.95)],
	["Tail1", "Pelvis", Vector3(0, 1.6, -1.55)],
	["Tail2", "Tail1", Vector3(0, 1.5, -1.95)],
	["Tail3", "Tail2", Vector3(-0.15, 1.1, -2.25)],
	["Tail4", "Tail3", Vector3(-0.35, 0.6, -2.4)],
	["Tail5", "Tail4", Vector3(-0.55, 0.25, -2.35)],
]
## концы костей без детей (для весов: отрезок «сустав — конец»)
const TIPS := {"JawUp": Vector3(0, 1.59, 2.48), "Jaw": Vector3(0, 1.09, 2.4), "L_Claws": Vector3(1.05, 0.06, 2.42),
	"R_Claws": Vector3(-1.05, 0.06, 2.42), "L_Toes": Vector3(0.75, 0.06, -0.7), "R_Toes": Vector3(-0.75, 0.06, -0.7),
	"Tail5": Vector3(-0.7, 0.04, -2.15), "Head": Vector3(0, 1.75, 2.1)}
## линия пасти: ниже неё и впереди шарнира — нижняя челюсть
const MOUTH_Y := 1.39
const MOUTH_Z := 1.75

var _view := ""
var _poses: Array = []
var _icon := ""


func _init() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--view="):
			_view = a.substr(7)
		if a.begins_with("--pose="):
			_poses = Array(a.substr(7).split(","))
		if a.begins_with("--icon="):
			_icon = a.substr(7)
	var res := build()
	if res.is_empty():
		quit(1)
		return
	if _icon != "":
		await _portrait(res)
	elif _view != "":
		await _render(res)
	else:
		_save(res)
	quit()


# ---------------- скелет и сетка ----------------

static func bone_index(name: String) -> int:
	for i in BONES.size():
		if String(BONES[i][0]) == name:
			return i
	return -1


func build() -> Dictionary:
	var src: PackedScene = load(SRC)
	if src == null:
		push_error("нет " + SRC)
		return {}
	var inst := src.instantiate()
	var mi: MeshInstance3D = inst.find_children("*", "MeshInstance3D", true, false)[0]
	var am := mi.mesh as ArrayMesh
	var arr := am.surface_get_arrays(0)
	var mat := am.surface_get_material(0)
	if mi.get_surface_override_material(0) != null:
		mat = mi.get_surface_override_material(0)
	var vin: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
	var nin: PackedVector3Array = arr[Mesh.ARRAY_NORMAL]
	# разворот: исходное (x вдоль, y вверх, z поперёк) → игра (X = −z, Y = y, Z = x), масштаб
	var V := PackedVector3Array()
	var N := PackedVector3Array()
	V.resize(vin.size())
	N.resize(vin.size())
	for i in vin.size():
		var p := vin[i]
		V[i] = Vector3(-p.x * SCALE.x, p.y * SCALE.y, -p.z * SCALE.z)
		var n := nin[i]
		N[i] = Vector3(-n.x / SCALE.x, n.y / SCALE.y, -n.z / SCALE.z).normalized()
	# скелет
	var sk := Skeleton3D.new()
	sk.name = "Skel"
	for b in BONES:
		var bi := sk.add_bone(String(b[0]))
		if String(b[1]) != "":
			sk.set_bone_parent(bi, bone_index(String(b[1])))
	for i in BONES.size():
		var pp := Vector3.ZERO if String(BONES[i][1]) == "" else J(BONES[bone_index(String(BONES[i][1]))][2])
		var rest := Transform3D(Basis(), J(BONES[i][2]) - pp)
		sk.set_bone_rest(i, rest)
		sk.set_bone_pose(i, rest)
	# веса
	var wts := _weights(V)
	var B := PackedInt32Array()
	var W := PackedFloat32Array()
	B.resize(V.size() * 4)
	W.resize(V.size() * 4)
	for i in V.size():
		var lst: Array = wts[i]
		for k in 4:
			B[i * 4 + k] = int(lst[k][0]) if k < lst.size() else 0
			W[i * 4 + k] = float(lst[k][1]) if k < lst.size() else 0.0
	var out := []
	out.resize(Mesh.ARRAY_MAX)
	out[Mesh.ARRAY_VERTEX] = V
	out[Mesh.ARRAY_NORMAL] = N
	out[Mesh.ARRAY_TEX_UV] = arr[Mesh.ARRAY_TEX_UV]
	# Отдельно стоящие куски сетки (обломок сбоку от тела — артефакт генерации): вершины склеиваются по положению,
	# считаются связные части; остаётся самая большая и те, что касаются тела (зубы, шипы), — мелкая часть, чья
	# середина в стороне от тела (|x| > 0,8 между передними и задними лапами), убирается.
	var idx_in: PackedInt32Array = arr[Mesh.ARRAY_INDEX]
	var key_of := {}
	var par := PackedInt32Array()
	par.resize(V.size())
	for i in V.size():
		par[i] = i
		var kq := Vector3i(int(round(vin[i].x * 20000.0)), int(round(vin[i].y * 20000.0)), int(round(vin[i].z * 20000.0)))
		if key_of.has(kq):
			par[i] = int(key_of[kq])
		else:
			key_of[kq] = i
	var find := func(x: int) -> int:
		while par[x] != x:
			par[x] = par[par[x]]
			x = par[x]
		return x
	for t in range(0, idx_in.size(), 3):
		var ra: int = find.call(idx_in[t])
		for k in [1, 2]:
			var rb: int = find.call(idx_in[t + k])
			if rb != ra:
				par[rb] = ra
	var comp := {}
	for i in V.size():
		var r: int = find.call(i)
		if not comp.has(r):
			comp[r] = [0, Vector3.ZERO]
		comp[r][0] = int(comp[r][0]) + 1
		comp[r][1] = (comp[r][1] as Vector3) + V[i]
	var drop := {}
	for r in comp:
		var n := int(comp[r][0])
		var cen: Vector3 = (comp[r][1] as Vector3) / float(n)
		if n < V.size() / 6 and absf(cen.x) > 0.8 and cen.z > -0.6 and cen.z < 1.0:
			drop[r] = true
			print("[mut_elite] убран отдельный кусок сетки: вершин %d, середина %s" % [n, str(cen.snapped(Vector3.ONE * 0.01))])
	var idx_out := PackedInt32Array()
	for t in range(0, idx_in.size(), 3):
		if drop.has(find.call(idx_in[t])):
			continue
		idx_out.append(idx_in[t])
		idx_out.append(idx_in[t + 1])
		idx_out.append(idx_in[t + 2])
	print("[mut_elite] частей сетки %d, треугольников %d → %d" % [comp.size(), idx_in.size() / 3, idx_out.size() / 3])
	out[Mesh.ARRAY_INDEX] = idx_out
	out[Mesh.ARRAY_BONES] = B
	out[Mesh.ARRAY_WEIGHTS] = W
	# касательные для карты нормалей — заново (оси поменялись)
	var st := SurfaceTool.new()
	st.create_from_arrays(out)
	st.generate_tangents()
	var arr2 := st.commit_to_arrays()
	arr2[Mesh.ARRAY_BONES] = B
	arr2[Mesh.ARRAY_WEIGHTS] = W
	var mesh := ArrayMesh.new()
	mesh.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr2)
	mesh.surface_set_material(0, mat)
	mesh.resource_name = "mut_elite"
	var skin := Skin.new()
	for i in BONES.size():
		skin.add_named_bind(String(BONES[i][0]), Transform3D(Basis(), -J(BONES[i][2])))
	inst.free()
	var lib := ULMutEliteAnim.make_library(sk, V, wts)
	var au := ULMutEliteAnim.new()
	au.setup(sk, V, wts)
	var rep: Array = lib.get_meta("report", [])
	rep.append_array(au.audit(lib))
	lib.set_meta("report", rep)
	for line in rep:
		print("[mut_elite] " + String(line))
	return {"sk": sk, "mesh": mesh, "skin": skin, "lib": lib, "V": V, "W": wts}


## Веса: у каждой вершины — до четырёх ближайших костей (вес ∝ 1/d⁴ до отрезка кости), с ограничениями по частям
## тела: левая лапа не тянет правый бок, хвост — только позади таза, голова — впереди шеи, нижняя челюсть — всё,
## что ниже линии пасти и впереди шарнира; брюхо между лапами берёт лапы слабее (не растягивается за бедром).
func _weights(V: PackedVector3Array) -> Array:
	var segs: Array = []
	for i in BONES.size():
		var a: Vector3 = J(BONES[i][2])
		var b := a
		var nm := String(BONES[i][0])
		if TIPS.has(nm):
			b = J(TIPS[nm])
		else:
			for j in BONES.size():
				if String(BONES[j][1]) == nm:
					b = J(BONES[j][2])
					break
		segs.append([a, b, nm])
	var out: Array = []
	out.resize(V.size())
	var my := MOUTH_Y * YK
	var pel_z := float((BONES[bone_index("Pelvis")][2] as Vector3).z)
	var neck_z := float((BONES[bone_index("Neck2")][2] as Vector3).z)
	for vi in V.size():
		var v := V[vi]
		var cand: Array = []
		for i in range(1, segs.size()):
			var nm := String(segs[i][2])
			if nm.begins_with("L_") and v.x < -0.12:
				continue
			if nm.begins_with("R_") and v.x > 0.12:
				continue
			if nm.begins_with("Tail") and v.z > pel_z - 0.3:
				continue
			if nm in ["Head", "JawUp", "Jaw"] and v.z < neck_z - 0.05:
				continue
			if nm == "Jaw" and not (v.y < my + 0.04 and v.z > MOUTH_Z - 0.06):
				continue
			if nm == "JawUp" and (v.y < my - 0.02 or v.z < 1.98):
				continue
			var d := _seg_dist(v, segs[i][0], segs[i][1])
			var w := 1.0 / (pow(maxf(d, 0.03), 4.0))
			if (nm.contains("Thigh") or nm.contains("UpperArm") or nm.contains("Scapula")) and absf(v.x) < 0.32:
				w *= 0.25                   # середина брюха и спины — больше за туловищем
			if nm == "Jaw" and v.y < my - 0.05 and v.z > MOUTH_Z + 0.06:
				w *= 50.0                   # нижняя челюсть целиком
			cand.append([i, w])
		cand.sort_custom(func(x, y) -> bool: return float(x[1]) > float(y[1]))
		cand = cand.slice(0, 4)
		var s := 0.0
		for cw in cand:
			s += float(cw[1])
		for cw in cand:
			cw[1] = float(cw[1]) / maxf(s, 1e-9)
		# совсем малые доли — прочь (меньше дрожи на стыках)
		var keep: Array = cand.filter(func(x) -> bool: return float(x[1]) > 0.04)
		var s2 := 0.0
		for cw in keep:
			s2 += float(cw[1])
		for cw in keep:
			cw[1] = float(cw[1]) / maxf(s2, 1e-9)
		out[vi] = keep
	return out


static func _seg_dist(p: Vector3, a: Vector3, b: Vector3) -> float:
	var ab := b - a
	var t := 0.0 if ab.length_squared() < 1e-8 else clampf((p - a).dot(ab) / ab.length_squared(), 0.0, 1.0)
	return p.distance_to(a + ab * t)


# ---------------- сохранение ----------------

func _scene(res: Dictionary) -> Node3D:
	var root := Node3D.new()
	root.name = "MutElite"
	var sk: Skeleton3D = res.sk
	root.add_child(sk)
	sk.owner = root
	var mi := MeshInstance3D.new()
	mi.name = "Body"
	mi.mesh = res.mesh
	mi.skin = res.skin
	sk.add_child(mi)
	mi.owner = root
	mi.skeleton = NodePath("..")
	var ap := AnimationPlayer.new()
	ap.name = "Anim"
	root.add_child(ap)
	ap.owner = root
	ap.add_animation_library("", res.lib)
	root.set_meta("walk_v", ULMutEliteAnim.WALK_V)
	# точки удара: кончик нижней челюсти и когти — от сустава кости (в её осях покоя)
	root.set_meta("bite_off", J(TIPS.Jaw) - J(BONES[bone_index("Jaw")][2]))
	root.set_meta("claw_off", J(TIPS.L_Claws) - J(BONES[bone_index("L_Claws")][2]))
	root.set_meta("run_v", ULMutEliteAnim.RUN_V)
	return root


func _save(res: Dictionary) -> void:
	ResourceSaver.save(res.mesh, OUT_MESH)
	(res.mesh as Resource).take_over_path(OUT_MESH)
	ResourceSaver.save(res.lib, OUT_LIB)
	(res.lib as Resource).take_over_path(OUT_LIB)
	var root := _scene(res)
	var ps := PackedScene.new()
	ps.pack(root)
	var e := ResourceSaver.save(ps, OUT_SCN)
	print("[mut_elite] записано: %s (%d), костей %d, вершин %d, движений %d" % [OUT_SCN, e, BONES.size(), (res.V as PackedVector3Array).size(), (res.lib as AnimationLibrary).get_animation_list().size()])
	for an in (res.lib as AnimationLibrary).get_animation_list():
		var a: Animation = res.lib.get_animation(an)
		print("[mut_elite]   %s: %.2f с, дорожек %d%s" % [an, a.length, a.get_track_count(), ", по кругу" if a.loop_mode != Animation.LOOP_NONE else ""])
	root.free()


# ---------------- снимки для проверки ----------------

func _render(res: Dictionary) -> void:
	DirAccess.make_dir_recursive_absolute(_view)
	var vp := SubViewport.new()
	vp.size = Vector2i(960, 640)
	vp.own_world_3d = true
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_COLOR
	e.background_color = Color(0.78, 0.78, 0.78)
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(1, 1, 1)
	e.ambient_light_energy = 0.55
	env.environment = e
	vp.add_child(env)
	var l := DirectionalLight3D.new()
	l.rotation_degrees = Vector3(-50, 35, 0)
	l.shadow_enabled = true
	vp.add_child(l)
	var floor_mi := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(14, 14)
	floor_mi.mesh = pm
	var fm := StandardMaterial3D.new()
	fm.albedo_color = Color(0.6, 0.6, 0.58)
	floor_mi.material_override = fm
	vp.add_child(floor_mi)
	var scn := _scene(res)
	vp.add_child(scn)
	var sk: Skeleton3D = scn.get_node("Skel")
	var body: MeshInstance3D = sk.get_node("Body")
	var cam := Camera3D.new()
	vp.add_child(cam)
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	var shot := func(nm: String, from: Vector3, at: Vector3, size: float) -> void:
		cam.size = size
		cam.look_at_from_position(from, at, Vector3.UP if absf(from.y - at.y) < 9.0 else Vector3.FORWARD)
		for i in 3:
			await process_frame
		vp.get_texture().get_image().save_png("%s/%s.png" % [_view, nm])
	if _poses.is_empty():
		# 1) кости поверх полупрозрачного тела
		var xr := StandardMaterial3D.new()
		xr.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
		xr.albedo_color = Color(0.8, 0.55, 0.5, 0.35)
		body.material_override = xr
		var dots := Node3D.new()
		vp.add_child(dots)
		for i in BONES.size():
			var s := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.05
			sm.height = 0.1
			s.mesh = sm
			var dm := StandardMaterial3D.new()
			dm.no_depth_test = true
			dm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
			dm.albedo_color = Color.from_hsv(float(i) / BONES.size(), 0.9, 0.9)
			s.material_override = dm
			s.position = J(BONES[i][2])
			dots.add_child(s)
		# линии «сустав — сустав»
		var im := ImmediateMesh.new()
		var lm := StandardMaterial3D.new()
		lm.no_depth_test = true
		lm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		lm.albedo_color = Color(0.05, 0.05, 0.6)
		im.surface_begin(Mesh.PRIMITIVE_LINES, lm)
		for i in BONES.size():
			if String(BONES[i][1]) != "":
				im.surface_add_vertex(J(BONES[bone_index(String(BONES[i][1]))][2]))
				im.surface_add_vertex(J(BONES[i][2]))
		for nm in TIPS:
			im.surface_add_vertex(J(BONES[bone_index(String(nm))][2]))
			im.surface_add_vertex(J(TIPS[nm]))
		im.surface_end()
		var lmi := MeshInstance3D.new()
		lmi.mesh = im
		dots.add_child(lmi)
		await shot.call("bones_side", Vector3(12, 1.4, 0), Vector3(0, 1.4, 0), 6.0)
		await shot.call("zoom_front_leg", Vector3(12, 1.1, 1.0), Vector3(0, 1.1, 1.0), 2.6)
		await shot.call("zoom_hind_leg", Vector3(12, 1.0, -0.6), Vector3(0, 1.0, -0.6), 2.6)
		await shot.call("zoom_head", Vector3(12, 1.65, 2.0), Vector3(0, 1.65, 2.0), 1.5)
		await shot.call("zoom_front_front", Vector3(0, 1.1, 12), Vector3(0, 1.1, 0), 2.8)
		await shot.call("bones_top", Vector3(0, 12, 0.001), Vector3(0, 0, 0), 6.0)
		await shot.call("bones_front", Vector3(0, 1.4, 12), Vector3(0, 1.4, 0), 4.0)
		dots.queue_free()
		# 2) веса: цвет главной кости
		var cols := PackedColorArray()
		var V: PackedVector3Array = res.V
		cols.resize(V.size())
		for i in V.size():
			var c := Color(0, 0, 0)
			for bw in res.W[i]:
				c += Color.from_hsv(fmod(float(bw[0]) * 0.618, 1.0), 0.85, 0.95) * float(bw[1])
			cols[i] = c
		var arr := (res.mesh as ArrayMesh).surface_get_arrays(0)
		arr[Mesh.ARRAY_COLOR] = cols
		var cm := ArrayMesh.new()
		cm.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		var vm := StandardMaterial3D.new()
		vm.vertex_color_use_as_albedo = true
		vm.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
		cm.surface_set_material(0, vm)
		body.mesh = cm
		body.material_override = null
		await shot.call("weights_side", Vector3(12, 1.4, 0), Vector3(0, 1.4, 0), 6.0)
		await shot.call("weights_other", Vector3(-12, 1.4, 0), Vector3(0, 1.4, 0), 6.0)
		await shot.call("weights_front", Vector3(0, 1.4, 12), Vector3(0, 1.4, 0), 4.0)
		body.mesh = res.mesh
		await shot.call("model_iso", Vector3(8, 5, 8), Vector3(0, 1.2, 0), 6.5)
		return
	# 3) кадры движений
	var ap: AnimationPlayer = scn.get_node("Anim")
	for ps in _poses:
		var parts := String(ps).split(":")
		var an := parts[0]
		var k := float(parts[1]) if parts.size() > 1 else 0.0
		if not ap.has_animation(an):
			print("нет движения ", an)
			continue
		ap.play(an)
		ap.seek(ap.current_animation_length * k, true)
		ap.pause()
		for view in [["side", Vector3(12, 1.4, 0), 6.2], ["iso", Vector3(7, 4, 8), 6.5], ["front", Vector3(0, 1.4, 12), 5.0]]:
			await shot.call("%s_%02d_%s" % [an, int(round(k * 100.0)), view[0]], view[1], Vector3(0, 1.3, 0), float(view[2]))


## Картинка для справочника и окна обыска: 512 × 768, прозрачный фон, стойка ожидания с повёрнутой головой
func _portrait(res: Dictionary) -> void:
	var vp := SubViewport.new()
	vp.size = Vector2i(512, 768)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	root.add_child(vp)
	var env := WorldEnvironment.new()
	var e := Environment.new()
	e.background_mode = Environment.BG_CLEAR_COLOR
	e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	e.ambient_light_color = Color(0.85, 0.88, 0.95)
	e.ambient_light_energy = 0.75
	e.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.environment = e
	vp.add_child(env)
	for r in [Vector3(-35, -40, 0), Vector3(-20, 140, 0)]:
		var l := DirectionalLight3D.new()
		l.rotation_degrees = r
		l.light_energy = 1.3 if r.y < 0 else 0.6
		vp.add_child(l)
	var scn := _scene(res)
	vp.add_child(scn)
	var ap: AnimationPlayer = scn.get_node("Anim")
	ap.play("elite_bite_attack")
	ap.seek(0.32, true)
	ap.pause()
	var cam := Camera3D.new()
	vp.add_child(cam)
	cam.fov = 28.0
	cam.look_at_from_position(Vector3(5.2, 3.4, 9.5), Vector3(0.1, 1.35, 0.4), Vector3.UP)
	for i in 6:
		await process_frame
	vp.get_texture().get_image().save_png(_icon)
	print("[mut_elite] картинка: ", _icon)
