extends Node
## Фотосъёмка для CI: «godot --path godot --rendering-driver opengl3 --resolution 1600x720 -- --shots <папка>»
## (под xvfb, с настоящим рендером). Обходит все локации: снимок у старта, в нескольких домах у тайников
## (крыша спрятана — видно интерьер), на улице у заражённых и сверху на всю локацию. Рядом с каждым снимком —
## нагрузка кадра (вызовы отрисовки, треугольники, объекты, время кадра). Пишет <папка>/<локация>_<n>.jpg,
## stats.txt и index.html; CI выкладывает их в gh-pages/godot-shots, откуда снимки смотрят глазами и сравнивают
## сборки между собой. Без этого картинку на телефоне не увидеть: в облачной среде Godot не запустить.

const LOCS := ["zarechny", "dachi", "himmash", "voench", "murs", "stab"]
## Снимков в домах у тайников на локацию (тайники выбираются подальше друг от друга).
const INSIDE := 3

var game
var dir := ""
var rows: Array = []
var vp_rid: RID

func run(g, out_dir: String) -> void:
	game = g
	dir = out_dir
	DirAccess.make_dir_recursive_absolute(dir)
	vp_rid = game.get_viewport().get_viewport_rid()
	RenderingServer.viewport_set_measure_render_time(vp_rid, true)
	await _wait(1.0)
	game.player.max_hp = 100000.0
	game.player.hp = 100000.0
	var settings: Node = game.get_node_or_null("settings")
	if settings:
		settings.show_fps = true
		settings.auto = false
		settings.set_quality("medium")
	var size: Vector2 = game.get_viewport().get_visible_rect().size
	print("SHOTS: экран %dx%d, рендер %s, видеокарта %s" % [size.x, size.y, RenderingServer.get_current_rendering_driver_name(), RenderingServer.get_video_adapter_name()])
	await _hero_shots()
	var prev: String = game.loc
	for id in LOCS:
		if id != game.loc:
			game.enter(id, prev)
			prev = id
		await _wait(1.2)
		var lv: Level = game.level
		var start: Dictionary = lv.meta.get("start", {"x": 0, "z": 0})
		var spots: Array = [["старт", Vector3(float(start["x"]), 0, float(start["z"]))]]
		for p in _inside_spots(lv, spots[0][1]):
			spots.append(p)
		var street := _street_spot(lv, spots)
		if street != Vector3.INF:
			spots.append(["улица", street])
		var n := 0
		for s in spots:
			n += 1
			await _shoot_at(id, n, s[0], s[1])
		# нагрузка у старта на низком и высоком качестве (снимки не нужны — только числа)
		if settings:
			for q in ["low", "high"]:
				settings.set_quality(q)
				await _shoot_at(id, 0, "старт, качество " + q, spots[0][1], false)
			settings.set_quality("medium")
		await _overview(id, n + 1)
	_write()
	print("SHOTS: OK (%d снимков)" % rows.filter(func(r): return r["file"] != "").size())
	game.get_tree().quit(0)

## Герой крупно с разным оружием (модели Tripo, перенос анимаций и хват — SkinFollow): автомат в переноске спереди-справа
## и спереди-слева (видно обе кисти), пулемёт, пистолет, пожарный топор. В журнал — вес переноски и насколько левая
## кисть новой модели не достала до цевья.
func _hero_shots() -> void:
	var p = game.player
	var keep: Dictionary = game.kit.duplicate()
	var n := 0
	for w in [["gun", "ak74", 1.0], ["gun", "ak74", -1.0], ["gun", "pkm", 1.0], ["gun", "pistol", 1.0], ["melee", "fireaxe", 1.0]]:
		n += 1
		game.kit[w[0]] = w[1]
		game.wear[w[1]] = int(Data.weapon(w[1]).get("durability", 100))
		p.hold = w[0]
		p.attach_gear()
		await _wait(1.2)
		game.set_process(false)
		var cam: Camera3D = game.camera
		var at: Vector3 = p.global_position + Vector3(0, 1.15, 0)
		var fwd := Vector3(sin(p.rotation.y), 0, cos(p.rotation.y))
		var right := fwd.cross(Vector3.UP)
		cam.global_position = at + fwd * 1.7 + right * (0.9 * float(w[2])) + Vector3(0, 0.3, 0)
		cam.look_at(at, Vector3.UP)
		await _wait(0.4)
		var f: Node = p.tripo_hero.get_node_or_null("SkinFollow") if p.tripo_hero else null
		var note := ""
		if f:
			note = ", переноска %.2f, левая кисть до цевья %.3f м" % [float(p.pose.carry) if p.pose else 0.0, float(f.get("left_error"))]
		await _capture("hero", n, "герой: %s%s%s" % [Data.weapon(w[1]).get("name", w[1]), " (слева)" if float(w[2]) < 0.0 else "", note], true)
		game.set_process(true)
	game.kit.clear()
	game.kit.merge(keep)
	p.attach_gear()

## Тайники в разных домах (доступ к ним — внутри), подальше друг от друга и от старта.
func _inside_spots(lv: Level, from: Vector3) -> Array:
	var cands: Array = []
	var seen := {}
	for c in lv.containers:
		var b: String = str(c.get("building", ""))
		if b == "" or b == "null" or seen.has(b):
			continue
		var p := Vector3(float(c["ax"]), 0, float(c["az"]))
		if lv.exit_at(p).size() > 0:
			continue
		seen[b] = true
		cands.append([b, p])
	var picked: Array = []
	var taken: Array[Vector3] = [from]
	while picked.size() < INSIDE and not cands.is_empty():
		var best := -1
		var best_d := -1.0
		for i in cands.size():
			var d := INF
			for t in taken:
				d = minf(d, (cands[i][1] as Vector3).distance_to(t))
			if d > best_d:
				best_d = d
				best = i
		var c2: Array = cands[best]
		cands.remove_at(best)
		picked.append(["дом «%s»" % c2[0], c2[1]])
		taken.append(c2[1])
	return picked

## Улица: место стаи заражённых (meta.groups), дальнее от уже снятых.
func _street_spot(lv: Level, spots: Array) -> Vector3:
	var best := Vector3.INF
	var best_d := -1.0
	for g in lv.meta.get("groups", []):
		var p := Vector3(float(g["at"][0]), 0, float(g["at"][1]))
		if lv.blocked_at(p) or lv.exit_at(p).size() > 0:
			continue
		var d := INF
		for s in spots:
			d = minf(d, p.distance_to(s[1]))
		if d > best_d:
			best_d = d
			best = p
	return best

func _shoot_at(id: String, n: int, label: String, at: Vector3, save := true) -> void:
	game.hud.hide_panel()
	if game.loc != id:
		game.enter(id, null)
		await _wait(1.0)
	game.player.global_position = at
	game.player.hp = game.player.max_hp
	game.level.update_view(at)
	game._update_camera(2.0)
	await _wait(0.7)
	game.player.global_position = at   # заражённые могли оттолкнуть
	game._update_camera(2.0)
	await _capture(id, n, label, save)

## Сверху на всю локацию — видно планировку, деревья, дороги.
func _overview(id: String, n: int) -> void:
	var cam: Camera3D = game.camera
	var far := cam.far
	game.set_process(false)
	cam.far = 400.0
	cam.global_position = Vector3(0, 120, 75)
	cam.look_at(Vector3(0, 0, 4), Vector3.UP)
	await _wait(0.3)
	await _capture(id, n, "сверху", true)
	cam.far = far
	game.set_process(true)

func _capture(id: String, n: int, label: String, save: bool) -> void:
	await RenderingServer.frame_post_draw
	await RenderingServer.frame_post_draw
	var row := {
		"loc": id, "n": n, "label": label, "file": "",
		"draws": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_DRAW_CALLS_IN_FRAME),
		"prims": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_PRIMITIVES_IN_FRAME),
		"objects": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_TOTAL_OBJECTS_IN_FRAME),
		"cpu_ms": RenderingServer.viewport_get_measured_render_time_cpu(vp_rid) + RenderingServer.get_frame_setup_time_cpu(),
		"gpu_ms": RenderingServer.viewport_get_measured_render_time_gpu(vp_rid),
		"vmem_mb": RenderingServer.get_rendering_info(RenderingServer.RENDERING_INFO_VIDEO_MEM_USED) / 1048576.0,
		"enemies": game.enemies.size(),
	}
	if save:
		var img: Image = game.get_viewport().get_texture().get_image()
		var file := "%s_%d.jpg" % [id, n]
		if img and img.save_jpg(dir.path_join(file), 0.85) == OK:
			row["file"] = file
	rows.append(row)
	print("  · снимок %s %d (%s): вызовов %d, треугольников %d, объектов %d, кадр ЦП %.1f мс, ГП %.1f мс, видеопамять %.0f МБ, заражённых %d%s" % [
		id, n, label, row["draws"], row["prims"], row["objects"], row["cpu_ms"], row["gpu_ms"], row["vmem_mb"], row["enemies"],
		(" → " + row["file"]) if row["file"] != "" else ""])

func _write() -> void:
	var txt := "Снимки локаций Godot-версии (%s)\n" % Time.get_datetime_string_from_system(true)
	var html := "<!doctype html><meta charset=utf-8><title>Улей Godot: снимки</title><style>body{background:#111;color:#ddd;font:14px sans-serif;margin:12px}img{width:100%;max-width:1600px;display:block}figure{margin:0 0 18px}</style><h1>Снимки локаций</h1>"
	for r in rows:
		var line := "%s %d (%s): вызовов %d, треугольников %d, объектов %d, ЦП %.1f мс, ГП %.1f мс, видеопамять %.0f МБ%s" % [
			r["loc"], r["n"], r["label"], r["draws"], r["prims"], r["objects"], r["cpu_ms"], r["gpu_ms"], r["vmem_mb"],
			(" — " + r["file"]) if r["file"] != "" else ""]
		txt += line + "\n"
		if r["file"] != "":
			html += "<figure><img src=\"%s\" loading=lazy><figcaption>%s</figcaption></figure>" % [r["file"], line]
		else:
			html += "<p>%s</p>" % line
	var f := FileAccess.open(dir.path_join("stats.txt"), FileAccess.WRITE)
	f.store_string(txt)
	f.close()
	var h := FileAccess.open(dir.path_join("index.html"), FileAccess.WRITE)
	h.store_string(html)
	h.close()

func _wait(secs: float) -> void:
	await game.get_tree().create_timer(secs).timeout
