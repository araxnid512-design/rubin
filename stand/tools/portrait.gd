extends Node3D
## Картинки врагов для справочника и окна обыска: снимок 3D-модели в живой позе (а не в исходной «руки в стороны»)
## на прозрачном фоне, 512×768. Поза — кадр клипа: POSES[вид] = [клип, доля клипа, поворот к камере, градусы].
## Запуск: godot --path . res://tools/portrait.tscn (нужен экран, xvfb). С --as-out=папка — пробные кадры
## нескольких поз в папку, без записи в assets.

const OUT := "res://assets/icons/"
const POSES := {"infected": ["idle", 0.3, 28.0], "lottery": ["attack_l", 0.55, 20.0]}       ## крадётся, руки тянутся вперёд
const TRY := [["idle", 0.2, 25.0], ["walk", 0.3, 30.0], ["walk", 0.7, 30.0], ["angry", 0.4, 20.0], ["melee_light", 0.3, 28.0], ["melee_light", 0.5, 28.0], ["sneak", 0.4, 30.0], ["look_around", 0.5, 20.0]]


func _ready() -> void:
	var out := ""
	for a in OS.get_cmdline_user_args():
		if a.begins_with("--as-out="):
			out = a.substr(9)
	var vp := SubViewport.new()
	vp.size = Vector2i(512, 768)
	vp.transparent_bg = true
	vp.own_world_3d = true
	vp.msaa_3d = Viewport.MSAA_4X
	vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	add_child(vp)
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
	var cam := Camera3D.new()
	cam.fov = 24.0
	vp.add_child(cam)
	cam.current = true
	for kind in ULEnemy.KINDS:
		var holder := Node3D.new()
		vp.add_child(holder)
		var rig := BCCharacter.new()
		rig.simple = true
		rig.built_poses = false
		rig.stand_clamp = true
		rig.height = float(ULEnemy.KINDS[kind].get("height", 1.78))
		holder.add_child(rig)
		rig.anim_cfg = String(ULEnemy.KINDS[kind].get("anim_cfg", BCAnimSet.CONFIG))
		rig.setup(String(ULEnemy.KINDS[kind].model), String(ULEnemy.KINDS[kind].get("anim", "res://assets/anim/hero")))
		var shots: Array = TRY if out != "" else [POSES.get(kind, ["idle", 0.2, 25.0])]
		for i in shots.size():
			var sh: Array = shots[i]
			# поза — кадр клипа: клип ставится позой и перематывается на нужную долю
			var an: Animation = rig.ap.get_animation("bc/" + String(sh[0]))
			rig.tree.active = false
			rig.ap.active = true
			rig.ap.play("bc/" + String(sh[0]))
			rig.ap.seek(an.length * float(sh[1]), true)
			rig.ap.pause()
			holder.rotation_degrees.y = float(sh[2])
			for k in 4:
				await get_tree().process_frame
			# камера — по росту фигуры в этой позе: от стоп до макушки с полями
			var sk := rig.skel
			var lo := Vector3(1e9, 1e9, 1e9)
			var hi := -lo
			for b in sk.get_bone_count():
				var p: Vector3 = sk.global_transform * sk.get_bone_global_pose(b).origin
				lo = lo.min(p)
				hi = hi.max(p)
			var mid := (lo + hi) * 0.5
			var hgt := maxf(hi.y - lo.y + 0.28, (hi.x - lo.x + 0.3) * 1.5)
			var dist := hgt * 0.5 / tan(deg_to_rad(cam.fov * 0.5))
			cam.look_at_from_position(Vector3(mid.x, mid.y + 0.05, mid.z + dist), Vector3(mid.x, mid.y + 0.05, mid.z))
			for k in 3:
				await RenderingServer.frame_post_draw
			var img := vp.get_texture().get_image()
			if out != "":
				DirAccess.make_dir_recursive_absolute(out)
				img.save_png("%s/%s_%d_%s.png" % [out, kind, i, sh[0]])
			else:
				img.save_png(ProjectSettings.globalize_path(OUT + "enemy_%s.png" % kind))
				print("[portrait] %s: %s, кадр %.0f %%" % [kind, sh[0], float(sh[1]) * 100.0])
		holder.queue_free()
	get_tree().quit()
