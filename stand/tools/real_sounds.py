#!/usr/bin/env python3
"""Настоящие записи вместо синтезированных звуков (жалоба пользователя 26.11: «звуки нормальные сделать, а не
мультяшные»). Раньше шаги по дереву/металлу/бетону, скрип двери, ворота, взрыв гранаты, Desert Eagle, камни Рубера,
чавканье, двигатель УАЗа, дождь и слои «веса» выстрела считались программой (синус, шум), а голоса заражённых
были «фэнтезийными» рыками существ из набора для RPG. Здесь всё это собирается из настоящих записей под CC0 /
общественным достоянием (источники — docs/AUDIO.md): обрезка тишины, короткие фейды, моно, громкость — как у
прежнего файла (игру не приходится перенастраивать), Ogg Vorbis.

    python3 stand/tools/real_sounds.py <папка с распакованными наборами> [<кэш tools/sfx/_cache>]

В папке наборов: zomb/ (artisticdude «Zombies Sound Pack»), steps/ (TinyWorlds «Different steps…»),
doors/ (qubodup «Door Open / Door Close Set»), rain/ (Rain loopable), crunch/ (StarNinjas «7 Eating Crunches»),
rd75/, rd100/, rd100b/ (rubberduck: «75 CC0 breaking / falling / hit sfx», «100 CC0 metal and wood SFX»,
«100 CC0 SFX #2»), car_engine_loop_1.ogg (GGBotNet «Car Sound Effects Pack»). Из репозитория берутся настоящие
записи оружия game/sfx (см. game/sfx/CREDITS.md) и bunker/assets/audio.
"""
import subprocess
import sys
from pathlib import Path

import numpy as np

SR = 44100
ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "stand/assets/audio"
SRC = Path(sys.argv[1])
CACHE = Path(sys.argv[2]) if len(sys.argv) > 2 else None
GAME = ROOT / "game/sfx"
BUNK = ROOT / "bunker/assets/audio"


def load(path, speed=1.0):
    """запись → моно float32; speed < 1 — медленнее и ниже (как на магнитофоне)"""
    af = [] if speed == 1.0 else ["-af", "asetrate=%d,aresample=%d" % (int(SR * speed), SR)]
    pre = ["-ar", str(SR)] if speed == 1.0 else []
    cmd = ["ffmpeg", "-v", "error", "-i", str(path), "-ac", "1"]
    if speed != 1.0:
        # сначала привести к SR, потом сменить скорость
        raw = subprocess.run(cmd + ["-ar", str(SR), "-f", "f32le", "-"], capture_output=True, check=True).stdout
        x = np.frombuffer(raw, np.float32)
        n = int(len(x) / speed)
        return np.interp(np.arange(n) * speed, np.arange(len(x)), x).astype(np.float32)
    raw = subprocess.run(cmd + pre + ["-f", "f32le", "-"], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).copy()


def trim(x, thr_db=-45.0, pad=0.01):
    """обрезать тишину в начале и конце"""
    thr = 10 ** (thr_db / 20.0) * max(np.abs(x).max(), 1e-9)
    idx = np.nonzero(np.abs(x) > thr)[0]
    if len(idx) == 0:
        return x
    a = max(0, idx[0] - int(pad * SR))
    b = min(len(x), idx[-1] + int(pad * SR))
    return x[a:b]


def fade(x, fin=0.004, fout=0.03):
    x = x.copy()
    a = min(len(x) // 2, int(fin * SR))
    b = min(len(x) // 2, int(fout * SR))
    if a > 0:
        x[:a] *= np.linspace(0, 1, a)
    if b > 0:
        x[-b:] *= np.linspace(1, 0, b)
    return x


def lowpass(x, hz):
    X = np.fft.rfft(x)
    f = np.fft.rfftfreq(len(x), 1.0 / SR)
    X *= 1.0 / np.sqrt(1.0 + (f / hz) ** 8)
    return np.fft.irfft(X, len(x)).astype(np.float32)


def rms_db(x):
    return 20 * np.log10(max(np.sqrt((x ** 2).mean()), 1e-9))


def old_level(name):
    p = OUT / (name + ".ogg")
    if not p.exists():
        return None
    return rms_db(load(p))


def save(name, x, level=None, peak_db=-1.0, q=4):
    """level — средняя громкость, дБ (по умолчанию — как у прежнего файла с этим именем); пик не выше peak_db"""
    if level is None:
        level = old_level(name)
    x = x.astype(np.float32)
    if level is not None:
        x = x * 10 ** ((level - rms_db(x)) / 20.0)
    pk = np.abs(x).max()
    lim = 10 ** (peak_db / 20.0)
    if pk > lim or level is None:
        x = x * (lim / pk)
    p = OUT / (name + ".ogg")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "f32le", "-ar", str(SR), "-ac", "1", "-i", "-", "-c:a", "libvorbis", "-q:a", str(q), str(p)],
                   input=x.tobytes(), check=True)
    print("%-18s %.2f с  %.1f дБ" % (name, len(x) / SR, rms_db(x)))


def one(name, path, t0=0.0, t1=None, speed=1.0, lp=None, fin=0.004, fout=0.03, level=None, do_trim=True, thr_db=-45.0):
    x = load(path, speed)
    if do_trim:
        x = trim(x, thr_db)
    if t1 is not None or t0 > 0.0:                    # отрезок — от начала звука (после обрезки тишины)
        x = x[int(t0 * SR):int(t1 * SR) if t1 is not None else len(x)]
    if lp:
        x = lowpass(x, lp)
    save(name, fade(x, fin, fout), level)


def drop(*names):
    for n in names:
        for suf in (".ogg", ".ogg.import"):
            p = OUT / (n + suf)
            if p.exists():
                p.unlink()


# --- голоса заражённых: настоящий человеческий голос (artisticdude, CC0) вместо «рыков существ» ---
Z = SRC / "zomb/zombies"
lv_g, lv_r, lv_d = old_level("growl_1"), old_level("roar_1"), old_level("zdeath_1")
for i, n in enumerate([17, 18, 21, 15], 1):          # низкий протяжный стон
    one("growl_%d" % i, Z / ("zombie-%d.wav" % n), level=lv_g, fout=0.06)
for i, n in enumerate([10, 12, 8], 1):               # резкий крик при броске
    one("roar_%d" % i, Z / ("zombie-%d.wav" % n), level=lv_r, fout=0.05)
for i, n in enumerate([2, 22, 13], 1):               # падающий по тону хрип
    one("zdeath_%d" % i, Z / ("zombie-%d.wav" % n), level=lv_d, fout=0.08)
# ест: настоящий хруст, чуть медленнее (тяжелее)
lv = old_level("chew_1")
for i, n in enumerate([2, 4, 6], 1):
    one("chew_%d" % i, SRC / ("crunch/crunch.%d.ogg" % n), speed=0.88, level=lv)

# --- шаги ---
lv = old_level("step_concrete_1")
for i in range(1, 5):                                # бетон — те же записи Kenney, что у обычного шага
    one("step_concrete_%d" % i, OUT / ("step_%d.ogg" % i), level=lv, do_trim=False)
lv = old_level("step_wood_1")
for i in range(1, 5):                                # дерево — rubberduck «100 CC0 SFX #2»
    one("step_wood_%d" % i, SRC / ("rd100b/sfx100v2_footstep_wood_%02d.ogg" % i), level=lv)
lv = old_level("step_metal_1")
for i, n in enumerate([1, 5, 6, 4], 1):              # металл — короткий глухой удар по железу (rubberduck)
    one("step_metal_%d" % i, SRC / ("rd75/bfh1_metal_hit_%02d.ogg" % n), t1=0.26, lp=4200, level=lv, fout=0.08)

# --- двери и ворота ---
lv = old_level("door_creak_1")
one("door_creak_1", SRC / "doors/qubodup-DoorSet/flac/qubodup-DoorOpen01.flac", level=lv)
one("door_creak_2", SRC / "doors/qubodup-DoorSet/flac/qubodup-DoorOpen04.flac", level=lv)
one("gate_open", BUNK / "blast_door.ogg", t1=2.2, fout=0.5, do_trim=False)

# --- взрыв гранаты и её стук ---
lv = old_level("grenade_boom")
one("grenade_boom_1", GAME / "gren_1.ogg", level=lv, fout=0.2)
one("grenade_boom_2", GAME / "gren_2.ogg", level=lv, fout=0.2)
one("grenade_boom_3", GAME / "expl_2.ogg", level=lv, fout=0.2)
drop("grenade_boom")
if CACHE:
    one("grenade_tink", CACHE / "bmac_clink1/clink1_0.wav")
    F = CACHE / "ffsl/x/Prepared SFX Library"
    # Desert Eagle: карабин Marlin 336 (.30-30) — короткий тяжёлый выстрел
    lv = old_level("shot_deagle_1")
    one("shot_deagle_1", F / "Marlin 336/I_17P.wav", t1=1.1, level=lv, fout=0.25)
    one("shot_deagle_2", F / "Marlin 336/I_22P.wav", t1=1.1, level=lv, fout=0.25)
    # «вес» выстрела: низ настоящего выстрела вместо синусоиды
    one("thump_light", F / "1911/A_34P.wav", t1=0.3, lp=230, fout=0.12)
    one("thump_mid", F / "AK-47/C_27P.wav", t1=0.34, lp=200, fout=0.14)
    one("thump_heavy", F / "Mosin Nagant/M_21P.wav", t1=0.4, lp=180, fout=0.16)

# --- хвост выстрела: дальний микрофон настоящей записи (раскат на улице, короткий отзвук в помещении) ---
lv = old_level("tail_open_1")
one("tail_open_1", GAME / "rifle_f1.ogg", t0=0.05, lp=3500, fin=0.03, fout=0.5, level=lv)
one("tail_open_2", GAME / "sniper_f1.ogg", t0=0.05, lp=3500, fin=0.03, fout=0.5, level=lv)
lv = old_level("tail_room_1")
one("tail_room_1", GAME / "pistol_f1.ogg", t0=0.04, t1=0.5, lp=4500, fin=0.02, fout=0.25, level=lv)
one("tail_room_2", GAME / "smg_f1.ogg", t0=0.04, t1=0.5, lp=4500, fin=0.02, fout=0.25, level=lv)

# --- камни Рубера: настоящие удары и осыпь камня (rubberduck) ---
rip = np.concatenate([fade(trim(load(SRC / "rd75/bfh1_rock_breaking_01.ogg", 0.8)), 0.01, 0.15), fade(trim(load(SRC / "rd75/bfh1_rock_falling_01.ogg", 0.85)), 0.01, 0.2)])
save("rock_rip", rip)
one("rock_throw", OUT / "swoosh_1.ogg", speed=0.6, fout=0.1, thr_db=-60.0)
lv = old_level("rock_hit_1")
one("rock_hit_1", SRC / "rd75/bfh1_rock_breaking_02.ogg", speed=0.8, level=lv, fout=0.15)
one("rock_hit_2", SRC / "rd75/bfh1_rock_falling_03.ogg", speed=0.8, level=lv, fout=0.15)

# --- двигатель УАЗа и дождь: настоящие зацикленные записи ---
one("engine_loop", SRC / "car_engine_loop_1.ogg", fin=0.0, fout=0.0, do_trim=False)
x = load(SRC / "rain/2.ogg")
n = int(12.0 * SR)
x = x[int(2.0 * SR):int(2.0 * SR) + n + int(0.5 * SR)]
k = int(0.5 * SR)                                     # шов цикла — плавный переход в полсекунды
w = np.linspace(0, 1, k)
loop = x[:n].copy()
loop[:k] = x[:k] * w + x[n:n + k] * (1 - w)
save("rain_loop", loop, q=3)

# --- выстрел РПГ-7: настоящая запись (видео армии США, общественное достояние) ---
for i in range(1, 4):
    one("shot_rpg_%d" % i, GAME / ("rpg_%d.ogg" % i), level=-16.0, fout=0.3)
one("rocket_fly", GAME / "rpg_fly.ogg", level=-20.0, fout=0.3)

# --- мухи: звук убран совсем (просьба пользователя) ---
drop("flies")
print("готово")
