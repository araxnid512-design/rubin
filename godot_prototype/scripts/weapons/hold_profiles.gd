class_name HoldProfiles
extends RefCounted
## Профили хвата оружия (анимации держания) для 7 классов оружия.
## Позиции — в системе координат грудной кости персонажа (м), направления — туда же.
##   g — точка хвата правой руки, f — направление ствола, u — «верх» оружия, r — крен (рад).
## Состояния: idle (01, 20), low — низкая готовность (02), carry — опущено (03),
##            aim — прицел (04, 05), inspect — осмотр/проверка (18, 19).

const P := {
	"pistol": {
		"idle": {"g": Vector3(0.06, -0.34, -0.24), "f": Vector3(-0.1, -0.75, -0.65)},
		"low": {"g": Vector3(0.05, -0.16, -0.36), "f": Vector3(-0.05, -0.55, -0.83)},
		"carry": {"g": Vector3(0.2, -0.5, -0.06), "f": Vector3(0.0, -0.6, -0.8), "one_hand": true},
		"inspect": {"g": Vector3(0.02, -0.02, -0.36), "f": Vector3(-0.6, 0.35, -0.72), "r": 1.2},
		"aim": {"mode": "extended", "reach": 0.5},
		"twist": -0.18, "heavy": 0.0, "eye_drop": 0.0,
	},
	"smg": {
		"idle": {"g": Vector3(0.15, -0.1, -0.22), "f": Vector3(-0.62, -0.18, -0.76)},
		"low": {"g": Vector3(0.15, -0.07, -0.26), "f": Vector3(-0.2, -0.48, -0.85)},
		"carry": {"g": Vector3(0.19, -0.24, -0.13), "f": Vector3(-0.12, -0.82, -0.55)},
		"inspect": {"g": Vector3(0.05, 0.0, -0.32), "f": Vector3(-0.75, 0.12, -0.64), "r": 1.0},
		"aim": {"mode": "shoulder", "anchor": Vector3(0.15, 0.2, -0.05)},
		"twist": -0.5, "heavy": 0.0, "eye_drop": 0.0,
	},
	"rifle": {
		"idle": {"g": Vector3(0.16, -0.1, -0.22), "f": Vector3(-0.62, -0.16, -0.77)},
		"low": {"g": Vector3(0.16, -0.08, -0.27), "f": Vector3(-0.18, -0.5, -0.85)},
		"carry": {"g": Vector3(0.2, -0.24, -0.14), "f": Vector3(-0.12, -0.82, -0.55)},
		"inspect": {"g": Vector3(0.06, 0.0, -0.34), "f": Vector3(-0.75, 0.1, -0.65), "r": 1.0},
		"aim": {"mode": "shoulder", "anchor": Vector3(0.16, 0.19, -0.03)},
		"twist": -0.62, "heavy": 0.0, "eye_drop": 0.0,
	},
	"sniper": {
		"idle": {"g": Vector3(0.16, -0.11, -0.22), "f": Vector3(-0.58, -0.22, -0.78)},
		"low": {"g": Vector3(0.16, -0.1, -0.25), "f": Vector3(-0.15, -0.6, -0.78)},
		"carry": {"g": Vector3(0.21, -0.26, -0.12), "f": Vector3(-0.1, -0.86, -0.5)},
		"inspect": {"g": Vector3(0.06, 0.02, -0.34), "f": Vector3(-0.72, 0.12, -0.68), "r": 0.9},
		"aim": {"mode": "shoulder", "anchor": Vector3(0.15, 0.17, -0.02)},
		"twist": -0.7, "heavy": 0.0, "eye_drop": 0.04,
	},
	"shotgun": {
		"idle": {"g": Vector3(0.16, -0.1, -0.22), "f": Vector3(-0.6, -0.18, -0.78)},
		"low": {"g": Vector3(0.16, -0.09, -0.26), "f": Vector3(-0.2, -0.5, -0.84)},
		"carry": {"g": Vector3(0.2, -0.24, -0.14), "f": Vector3(-0.12, -0.82, -0.55)},
		"inspect": {"g": Vector3(0.06, 0.0, -0.34), "f": Vector3(-0.75, 0.15, -0.64), "r": 0.8},
		"aim": {"mode": "shoulder", "anchor": Vector3(0.16, 0.19, -0.03)},
		"twist": -0.6, "heavy": 0.0, "eye_drop": 0.0,
	},
	"mg": {
		"idle": {"g": Vector3(0.18, -0.24, -0.2), "f": Vector3(-0.3, -0.3, -0.9)},
		"low": {"g": Vector3(0.18, -0.24, -0.24), "f": Vector3(-0.12, -0.25, -0.96)},
		"carry": {"g": Vector3(0.2, -0.3, -0.16), "f": Vector3(-0.1, -0.55, -0.83)},
		"inspect": {"g": Vector3(0.1, -0.12, -0.3), "f": Vector3(-0.7, 0.0, -0.7), "r": 0.6},
		"aim": {"mode": "hip", "anchor": Vector3(0.17, -0.27, -0.32)},
		"twist": -0.32, "heavy": 0.08, "eye_drop": 0.0,
	},
	"launcher": {
		"idle": {"g": Vector3(0.16, -0.18, -0.24), "f": Vector3(-0.35, -0.25, -0.9)},
		"low": {"g": Vector3(0.17, -0.14, -0.27), "f": Vector3(-0.15, -0.3, -0.94)},
		"carry": {"g": Vector3(0.2, -0.26, -0.18), "f": Vector3(-0.1, -0.6, -0.8)},
		"inspect": {"g": Vector3(0.06, -0.04, -0.34), "f": Vector3(-0.72, 0.05, -0.7), "r": 0.7},
		"aim": {"mode": "shoulder", "anchor": Vector3(0.15, 0.15, -0.05)},
		"twist": -0.5, "heavy": 0.06, "eye_drop": 0.06,
	},
}

static func get_profile(hold: String) -> Dictionary:
	return P.get(hold, P["rifle"])
