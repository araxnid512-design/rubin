#!/usr/bin/env python3
"""Звуки стенда: выборка из уже проверенных CC0-наборов репозитория (game/sfx — оружие, FFSL и др.;
bunker/assets/audio — шаги, ткань, голос, удары) и нарезка длинных записей перезарядки на отдельные щелчки.
Запуск из корня репозитория: python3 stand/tools/build_audio.py. Источники и лицензии — stand/docs/AUDIO.md."""
import subprocess
from pathlib import Path

OUT = Path("stand/assets/audio")
G = "game/sfx"
B = "bunker/assets/audio"

# имя в стенде → (файл-источник, начало, конец; None — целиком)
COPY = {
    # выстрелы (по два-три дубля)
    "shot_tt": [f"{G}/pistol_1", f"{G}/pistol_2"],
    "shot_beretta": [f"{G}/pistol9_1", f"{G}/pistol9_2"],
    "shot_ak": [f"{G}/ak2_1", f"{G}/ak2_2"],
    "shot_mp5": [f"{G}/smg9_1", f"{G}/smg9_2"],
    "shot_fal": [f"{G}/rifle_1", f"{G}/rifle_2", f"{G}/rifle_3"],
    "shot_svd": [f"{G}/sniper_1", f"{G}/sniper_2"],
    "shot_vss": [f"{G}/supp_1", f"{G}/supp_2"],
    "shot_pkp": [f"{G}/lmg_1", f"{G}/lmg_2", f"{G}/lmg_3"],
    "shot_spas": [f"{G}/shotgun_1", f"{G}/shotgun_2", f"{G}/shotgun_3"],
    "casing": [f"{G}/cas_1", f"{G}/cas_2", f"{G}/cas_3"],
    "shell": [f"{G}/cas_sh"],
    "dry": [f"{G}/dry"],
    "pump": [f"{G}/mech_pump"],
    "hit_wood": [f"{G}/imp_wood_1", f"{G}/imp_wood_2"],
    "mag_drop": [f"{G}/imp_metal_2"],
    "click": [f"{G}/rl_click"],
    # тело и снаряжение
    "step": [f"{B}/step_concrete_{i}" for i in range(1, 6)],
    "cloth": [f"{B}/step_suit_{i}" for i in range(1, 7)],
    "zip": [f"{B}/suit_zip"],
    "swoosh": [f"{B}/swoosh_{i}" for i in range(1, 4)],
    "swing": [f"{B}/pipe_swing_1", f"{B}/pipe_swing_2"],
    "punch": [f"{B}/punch_{i}" for i in range(1, 5)],
    "hurt": [f"{B}/hurt_hero_{i}" for i in range(1, 4)],
    "body_fall": [f"{B}/body_fall_1", f"{B}/body_fall_2"],
    "breath_run": [f"{B}/breath_run"],
    "block": [f"{B}/block_1", f"{B}/block_2"],
}
# нарезка: имя → [(источник, начало с, конец с), …]
CUT = {
    "mag_out": [(f"{G}/rl_mag", 0.12, 0.80)],
    "mag_in": [(f"{G}/rl_mag", 0.92, 1.55)],
    "bolt_back": [(f"{G}/rl_bolt", 0.0, 0.40)],
    "bolt_fwd": [(f"{G}/rl_bolt", 0.40, 1.05)],
    "slide_back": [(f"{G}/mech_bolt", 0.0, 0.17)],
    "slide_fwd": [(f"{G}/mech_bolt", 0.17, 0.60)],
    "cover_open": [(f"{G}/rl_box", 0.08, 0.55)],
    "box_in": [(f"{G}/rl_box", 0.60, 0.95)],
    "cover_close": [(f"{G}/rl_box", 0.95, 1.35)],
    "shell_in": [(f"{G}/rl_pump", 0.0, 0.42)],
}


def enc(src, dst, ss=None, to=None):
    args = ["ffmpeg", "-v", "error", "-y"]
    if ss is not None:
        args += ["-ss", f"{ss:.3f}", "-to", f"{to:.3f}"]
    args += ["-i", src + ".ogg", "-ac", "1", "-ar", "44100"]
    if ss is not None:
        d = to - ss
        args += ["-af", f"afade=t=in:d=0.004,afade=t=out:st={max(0.0, d - 0.04):.3f}:d=0.04"]
    args += ["-c:a", "libvorbis", "-q:a", "4", str(dst)]
    subprocess.run(args, check=True)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    for f in OUT.glob("*.ogg"):
        f.unlink()
    for name, srcs in COPY.items():
        for i, s in enumerate(srcs):
            enc(s, OUT / (f"{name}_{i + 1}.ogg" if len(srcs) > 1 else f"{name}.ogg"))
    for name, parts in CUT.items():
        for i, (s, a, b) in enumerate(parts):
            enc(s, OUT / (f"{name}_{i + 1}.ogg" if len(parts) > 1 else f"{name}.ogg"), a, b)
    print(len(list(OUT.glob("*.ogg"))), "файлов")


if __name__ == "__main__":
    main()
