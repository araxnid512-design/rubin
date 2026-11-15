#!/usr/bin/env bash
# Перепечь все спрайты «Дрейфа» из drift/assets/src, тайлы, обзорные листы и проверку освещения.
#   drift/tools/bake/bake_all.sh            (GODOT=/путь/к/godot — если не /home/user/godotengine/godot4)
# Godot запускается по одному (общая память под xvfb).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
DRIFT="$(cd "$HERE/../.." && pwd)"
GODOT="${GODOT:-/home/user/godotengine/godot4}"
BUNKER="$(cd "$DRIFT/.." && pwd)/bunker"

bake() {
	echo "== $*"
	xvfb-run -a "$GODOT" --path "$DRIFT" --rendering-driver opengl3 res://tools/bake/bake.tscn -- "$@" 2>&1 \
		| grep -v -e ALSA -e '^\s*at:' -e 'audio driver' -e '^$' -e 'V-Sync' -e 'status < 0' || true
}

bake --kind=character --in=res://assets/src/sd_hero --out=res://assets/sprites/hero
bake --kind=character --in=res://assets/src/sd_pirate --out=res://assets/sprites/pirate
bake --kind=character --in=res://assets/src/sd_robot --out=res://assets/sprites/robot
bake --kind=drone --in=res://assets/src/sdp_drone_worker.glb --out=res://assets/sprites/drone_worker
bake --kind=drone --in=res://assets/src/sdp_drone_combat.glb --out=res://assets/sprites/drone_combat
bake --kind=turret --in=res://assets/src/sdp_turret_gun.glb --out=res://assets/sprites/turret_gun
bake --kind=turret --in=res://assets/src/sdp_turret_laser.glb --out=res://assets/sprites/turret_laser
# запасной герой — модель и клипы из BunkerSurvival
if [ -f "$BUNKER/assets/models/hero.glb" ]; then
	bake --kind=character --in="$BUNKER/assets/models/hero.glb" --anims="$BUNKER/assets/anim/hero" \
		--out=res://assets/sprites/hero_fallback
fi

python3 "$DRIFT/tools/gen_tiles.py"
python3 "$HERE/contact_sheet.py"
echo "== проверка освещения"
xvfb-run -a "$GODOT" --path "$DRIFT" --rendering-driver opengl3 res://tools/bake/lit_test.tscn 2>&1 | grep -e 'свет' -e '→'
