class_name STBox
extends StaticBody2D
## Предмет-ящик StarCore в проекции 2.5D: основание w×d м, высота h м. Рисуется верх (светлее) и лицевая
## сторона (темнее), по желанию — светящаяся панель. Основание — в начале координат (низ передней грани),
## поэтому сортировка с персонажами верна. Столкновение — по основанию. Заглушка до запечённых спрайтов.

var size := Vector3(1, 1, 1)        ## ширина, глубина, высота, м
var color := Color(0.4, 0.42, 0.45)
var glow := Color(0, 0, 0, 0)
var _spr: Sprite2D                  ## запечённый спрайт предмета (assets/sprites/<имя>), вместо рисованного ящика
var _t := 0.0


## загрузить запечённый предмет (kind "prop": один ракурс, anchor — пол под серединой основания); нет — false
func use_sprite(name: String) -> bool:
	var folder := "res://assets/sprites/" + name
	var jp := folder.path_join(name + ".json")
	if name == "" or not FileAccess.file_exists(jp) or not ResourceLoader.exists(folder.path_join("idle.png")):
		return false
	var info = JSON.parse_string(FileAccess.get_file_as_string(jp))
	if not (info is Dictionary):
		return false
	var ct := CanvasTexture.new()
	ct.diffuse_texture = load(folder.path_join("idle.png"))
	if ResourceLoader.exists(folder.path_join("idle_n.png")):
		ct.normal_texture = load(folder.path_join("idle_n.png"))
	_spr = Sprite2D.new()
	_spr.texture = ct
	_spr.centered = false
	var a: Array = info.get("anchor", [64, 100])
	_spr.offset = -Vector2(a[0], a[1])
	# точка привязки — середина основания; узел — у передней грани (по ней сортировка)
	_spr.position = Vector2(0, -size.y * SP.TILE.y * 0.5)
	_spr.show_behind_parent = true
	add_child(_spr)
	queue_redraw()
	return true


func setup(w: float, d: float, h: float, col: Color, glow_col := Color(0, 0, 0, 0)) -> void:
	size = Vector3(w, d, h)
	color = col
	glow = glow_col
	collision_layer = 8             # предметы: дроны пролетают над ними, выстрелы — тоже
	var cs := CollisionShape2D.new()
	var sh := RectangleShape2D.new()
	sh.size = Vector2(w * SP.PPM, d * SP.PPM * SP.K)
	cs.shape = sh
	cs.position = Vector2(0, -sh.size.y * 0.5)
	add_child(cs)
	queue_redraw()


func _process(delta: float) -> void:
	if _spr and glow.a > 0.0:
		_t += delta
		queue_redraw()


func _draw() -> void:
	if _spr:
		# у запечённого — только огонёк «здесь есть что взять»
		if glow.a > 0.0:
			var p := Vector2(0, -size.y * SP.TILE.y - size.z * SP.TILE.y - 10.0 - sin(_t * 4.0) * 3.0)
			draw_circle(p, 6.0, Color(glow, 0.9))
			draw_circle(p, 11.0, Color(glow, 0.25))
		return
	var w := size.x * SP.PPM
	var dd := size.y * SP.PPM * SP.K
	var hh := size.z * SP.PPM * SP.K
	var x0 := -w * 0.5
	# тень
	draw_rect(Rect2(x0 + 4, -dd + 4, w, dd), Color(0, 0, 0, 0.28))
	# лицевая сторона: панели со швами, тёмный цоколь
	var face := color.darkened(0.35)
	draw_rect(Rect2(x0, -hh, w, hh), face)
	draw_rect(Rect2(x0, -5, w, 5), face.darkened(0.45))
	var n := maxi(1, roundi(w / 26.0))
	for i in range(1, n):
		var x := x0 + w * i / n
		draw_line(Vector2(x, -hh + 3), Vector2(x, -6), face.darkened(0.3), 1.0)
	draw_line(Vector2(x0, -hh), Vector2(x0, 0), face.lightened(0.15), 1.0)
	draw_line(Vector2(x0 + w - 1, -hh), Vector2(x0 + w - 1, 0), face.darkened(0.4), 1.0)
	# верх: рамка и вставка
	var top := color.lightened(0.1)
	draw_rect(Rect2(x0, -dd - hh, w, dd), top)
	if w > 18.0 and dd > 12.0:
		draw_rect(Rect2(x0 + 4, -dd - hh + 3, w - 8, dd - 6), top.darkened(0.12))
	draw_rect(Rect2(x0, -dd - hh, w, 2), color.lightened(0.35))
	draw_line(Vector2(x0, -hh), Vector2(x0 + w, -hh), face.lightened(0.25), 1.0)
	if glow.a > 0.0:
		draw_rect(Rect2(-w * 0.32, -hh * 0.78, w * 0.64, hh * 0.3), glow)
		draw_rect(Rect2(-w * 0.3, -dd - hh + dd * 0.3, w * 0.6, dd * 0.4), Color(glow, 0.55))
